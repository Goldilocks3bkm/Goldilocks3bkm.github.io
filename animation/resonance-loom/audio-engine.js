import {clamp,describeSignal,encodeWav,makeDemo,waveformPeaks} from './audio-math.js';

const MAX_BYTES=150*1024*1024;
const CANCELLED=Symbol('microphone-cancelled');
const stopTracks=stream=>stream?.getTracks().forEach(track=>track.stop());

// Float32 Web Audio channels can be much larger than a source PCM WAV.
function checkWavBudget(bytes,outputRate){
  if(bytes.byteLength<44)return;
  const view=new DataView(bytes),tag=offset=>String.fromCharCode(...new Uint8Array(bytes,offset,4));
  if(tag(0)!=='RIFF'||tag(8)!=='WAVE')return;
  let channels=0,rate=0,align=0,dataBytes=0,format=0;
  for(let offset=12;offset+8<=view.byteLength;){
    const kind=tag(offset),size=view.getUint32(offset+4,true),start=offset+8;
    if(kind==='fmt '&&size>=16&&start+16<=view.byteLength){format=view.getUint16(start,true);channels=view.getUint16(start+2,true);rate=view.getUint32(start+4,true);align=view.getUint16(start+12,true);}
    if(kind==='data')dataBytes+=Math.min(size,Math.max(0,view.byteLength-start));
    const next=start+size+(size%2);if(next<=offset||next>view.byteLength)break;offset=next;
  }
  if([1,3,65534].includes(format)&&channels&&rate&&align&&dataBytes/align*channels*4*Math.max(1,outputRate/rate)>MAX_BYTES)throw new RangeError('展開後の音声が150 MiBを超えます。短い音声でお試しください。');
}

export class AudioEngine extends EventTarget {
  constructor(){
    super();this.context=null;this.buffer=null;this.name='まだ音を選んでいません';this.kind='none';this.state='empty';this.offset=0;this.source=null;this.loop=false;this.volume=.45;this.recordingBuffer=null;this.micStream=null;this.micRequested=false;this.operation=0;this.playOperation=0;this.chunks=[];this.frames=0;this.maxRecordSeconds=300;this._workletLoaded=false;this._workletPromise=null;this._micSession=null;this._finishing=null;this.busy=false;this.destroyed=false;
  }
  emit(type='change',detail={}){if(!this.destroyed)this.dispatchEvent(new CustomEvent(type,{detail}));}
  _busy(active){if(this.busy===active)return;this.busy=active;this.emit('busy',{active});}
  _operation(){this._busy(false);return ++this.operation;}
  async ensureContext(){
    if(this.destroyed)throw new Error('音声処理は終了しています。ページを開き直してください。');
    if(!this.context){
      const Constructor=window.AudioContext||window.webkitAudioContext;if(!Constructor)throw new Error('このブラウザーは Web Audio に対応していません。');
      this.context=new Constructor();this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.15;this.analyser.minDecibels=-100;this.analyser.maxDecibels=-10;
      this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);
      this.silence=this.context.createGain();this.silence.gain.value=0;this.analyser.connect(this.silence);this.silence.connect(this.context.destination);
      this.wave=new Float32Array(this.analyser.fftSize);this.bins=new Float32Array(this.analyser.frequencyBinCount);
    }
    // Safari also uses "interrupted" after a tab, screen-lock or session change.
    if(this.context.state==='suspended'||this.context.state==='interrupted')await this.context.resume();
    if(this.destroyed)return this.context;
    if(this.context.state!=='running')throw new Error('音声が中断されています。ページへ戻り、もう一度操作してください。');
    return this.context;
  }
  get duration(){return this.buffer?.duration||0;}
  get currentTime(){if(this.state==='playing'){const t=this.offset+this.context.currentTime-this.startedAt;return this.loop&&this.duration?t%this.duration:Math.min(this.duration,t);}return this.offset;}
  get recordingTime(){return this.state==='recording'&&this.context?Math.max(0,this.context.currentTime-this.recordStarted):0;}
  _stopSource(){if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}}
  pause(){++this.playOperation;if(this.state!=='playing')return;this.offset=this.currentTime;this._stopSource();this.state='paused';this.emit();}
  stop(){++this.playOperation;if(this.micRequested){this.cancelMicrophone();return;}if(this.micStream)return this.stopMicrophone();this._stopSource();this.offset=0;if(this.buffer)this.state='ready';this.emit();}
  async play(){
    if(!this.buffer||this.micRequested||this.micStream||this._finishing||this.destroyed)return;
    const id=++this.playOperation,buffer=this.buffer;
    try{await this.ensureContext();}catch(error){if(id===this.playOperation&&!this.destroyed)throw error;return;}
    if(id!==this.playOperation||this.buffer!==buffer||this.micRequested||this.micStream||this._finishing||this.destroyed)return;
    if(this.state==='playing')return;if(this.offset>=this.duration-.005)this.offset=0;
    const source=this.context.createBufferSource();this.source=source;source.buffer=buffer;source.loop=this.loop;source.connect(this.master);source.connect(this.analyser);this.startedAt=this.context.currentTime;
    source.onended=()=>{if(this.source!==source)return;source.disconnect();this.source=null;this.offset=this.duration;this.state='ended';this.emit();};
    source.start(0,this.offset);this.state='playing';this.emit();
  }
  seek(seconds){if(!this.buffer||this.micStream||this.micRequested||this._finishing)return;++this.playOperation;const playing=this.state==='playing';this._stopSource();this.offset=clamp(seconds,0,this.duration);this.state='paused';if(playing)this.play().catch(error=>this.emit('error',{message:error.message}));else this.emit();}
  setVolume(value){this.volume=clamp(value);if(this.master)this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.03);this.emit();}
  setLoop(value){this.loop=!!value;if(this.source)this.source.loop=this.loop;this.emit();}
  _setBuffer(buffer,name,kind){++this.playOperation;this._stopSource();this.buffer=buffer;this.name=name;this.kind=kind;this.offset=0;this.state='ready';this.peaks=waveformPeaks(buffer);this.emit();}
  async loadFile(file){
    if(!file)return;if(file.size>MAX_BYTES)throw new Error('この試作では150 MiBまでの音声を選べます。短いファイルでお試しください。');
    if(this.micRequested||this.micStream||this._finishing)throw new Error('録音を終えてから、ファイルを選んでください。');
    const id=this._operation();this._busy(true);
    try{
      await this.ensureContext();if(id!==this.operation||this.destroyed)return;
      const bytes=await file.arrayBuffer();if(id!==this.operation||this.destroyed)return;
      checkWavBudget(bytes,this.context.sampleRate);
      let buffer;try{buffer=await this.context.decodeAudioData(bytes);}catch{throw new Error('この音声を開けませんでした。PCM WAV・MP3・FLACをお試しください。形式やコーデックによってはブラウザーが対応していません。');}
      if(id!==this.operation||this.destroyed)return;
      if(!buffer.length)throw new Error('音声のサンプルがありません。');
      if(buffer.length*buffer.numberOfChannels*4>MAX_BYTES)throw new RangeError('展開後の音声が150 MiBを超えます。短い音声でお試しください。');
      this._setBuffer(buffer,file.name,'file');return buffer;
    }catch(error){if(id===this.operation&&!this.destroyed)throw error;}finally{if(id===this.operation)this._busy(false);}
  }
  async loadDemo(){if(this.micRequested||this.micStream||this._finishing||this.destroyed)return;const id=this._operation(),playId=this.playOperation;await this.ensureContext();if(id!==this.operation||playId!==this.playOperation||this.destroyed)return;this._setBuffer(makeDemo(this.context),'糸のための、24秒','demo');await this.play();}
  clear(){if(this.micRequested||this.micStream||this._finishing)return;this._operation();++this.playOperation;this._stopSource();this.buffer=null;this.peaks=null;this.offset=0;this.kind='none';this.name='まだ音を選んでいません';this.state='empty';this.emit();}
  metrics(){if(!this.context||!['playing','recording'].includes(this.state)||this.context.state!=='running')return {rms:0,bass:0,mid:0,treble:0,centroid:0};this.analyser.getFloatTimeDomainData(this.wave);this.analyser.getFloatFrequencyData(this.bins);return describeSignal(this.wave,this.bins,this.context.sampleRate,this.analyser.fftSize);}
  _ownsMic(session){return this._micSession===session&&session.id===this.operation&&!session.finished&&!this.destroyed;}
  async startMicrophone(){
    if(this.micRequested||this.micStream||this._finishing||this.destroyed)return;
    if(!window.isSecureContext)throw new Error('マイクはHTTPSまたはlocalhostでのみ使用できます。');if(!navigator.mediaDevices?.getUserMedia)throw new Error('このブラウザーではマイクを使用できません。');
    const session={id:this._operation(),stream:null,input:null,recorder:null,chunks:[],frames:0,finished:false,stopping:false};
    session.cancellation=new Promise(resolve=>{session.cancel=()=>resolve(CANCELLED);});
    this.pause();this._micSession=session;this.micRequested=true;this.emit();
    try{
      await Promise.race([this.ensureContext(),session.cancellation]);if(!this._ownsMic(session))return;
      if(!this.context.audioWorklet||!window.AudioWorkletNode)throw new Error('このブラウザーではWAV録音に対応していません。新しいSafari / Chrome / Firefoxをお試しください。');
      if(!this._workletLoaded){if(!this._workletPromise)this._workletPromise=this.context.audioWorklet.addModule(new URL('./recorder-worklet.js',import.meta.url)).then(()=>{this._workletLoaded=true;}).finally(()=>{this._workletPromise=null;});await Promise.race([this._workletPromise,session.cancellation]);}
      if(!this._ownsMic(session))return;
      // Permission prompts are allowed to remain unresolved forever. Cancellation
      // settles our public operation now, while a late grant still stops its track.
      const request=navigator.mediaDevices.getUserMedia({video:false,audio:{echoCancellation:true,noiseSuppression:false,autoGainControl:false}}).then(stream=>{if(!this._ownsMic(session)){stopTracks(stream);return null;}return stream;});
      const stream=await Promise.race([request,session.cancellation]);
      if(!this._ownsMic(session)){if(stream&&stream!==CANCELLED)stopTracks(stream);return;}session.stream=stream;this.micStream=stream;
      // Permission/device changes may interrupt Safari's previously resumed context.
      await Promise.race([this.ensureContext(),session.cancellation]);if(!this._ownsMic(session)){this.releaseMic(session);return;}
      session.input=this.context.createMediaStreamSource(stream);session.recorder=new AudioWorkletNode(this.context,'loom-recorder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
      this.micInput=session.input;this.recorder=session.recorder;this.chunks=session.chunks;this.frames=0;
      session.recorder.port.onmessage=({data})=>{
        if(!this._ownsMic(session))return;
        if(data.samples){const remaining=Math.max(0,Math.floor(this.context.sampleRate*this.maxRecordSeconds)-session.frames),samples=data.samples.length>remaining?data.samples.slice(0,remaining):data.samples;if(samples.length){session.chunks.push(samples);session.frames+=samples.length;this.frames=session.frames;}if(!remaining||session.frames>=this.context.sampleRate*this.maxRecordSeconds){if(!session.stopping)this.stopMicrophone('5分の上限で録音を終了しました。').catch(error=>this.emit('error',{message:error.message}));}}
        if(data.done)session.finishResolve?.();
      };
      session.input.connect(this.analyser);session.input.connect(session.recorder);session.recorder.connect(this.silence);this.recordStarted=this.context.currentTime;this.state='recording';
      stream.getAudioTracks().forEach(track=>track.addEventListener('ended',()=>{if(this._ownsMic(session)&&!session.stopping)this.stopMicrophone('マイクの接続が終わったため録音を終了しました。').catch(error=>this.emit('error',{message:error.message}));}));this.emit();
    }catch(error){
      const owned=this._ownsMic(session);this.releaseMic(session);
      if(owned){let message=error.message;if(error.name==='NotAllowedError')message='マイクは許可されませんでした。録音は始まっていません。';if(error.name==='NotFoundError')message='使用できるマイクが見つかりませんでした。';if(error.name==='NotReadableError')message='マイクを開けませんでした。他のアプリの使用状況を確認してください。';throw new Error(message);}
    }finally{if(session.id===this.operation&&!this.destroyed){this.micRequested=false;this.emit();}}
  }
  cancelMicrophone(){if(!this.micRequested)return;this._operation();this.micRequested=false;this.releaseMic(this._micSession);this.emit();}
  releaseMic(session=this._micSession){
    if(!session)return;session.finished=true;session.cancel?.();stopTracks(session.stream);if(session.recorder)session.recorder.port.onmessage=null;try{session.input?.disconnect();session.recorder?.disconnect();}catch{}
    if(this._micSession===session){this._micSession=null;this.micStream=null;this.micInput=null;this.recorder=null;}
  }
  async stopMicrophone(message='録音を終えました。再生するまで音は鳴りません。'){
    if(this._finishing)return this._finishing;const session=this._micSession;if(!session?.stream)return;if(!session.recorder){this.cancelMicrophone();return;}
    session.stopping=true;stopTracks(session.stream); // Release the physical device before waiting for the worklet.
    this.state='finishing';this.emit();
    this._finishing=(async()=>{
      let timeout;await new Promise(resolve=>{session.finishResolve=resolve;session.recorder.port.postMessage('finish');timeout=setTimeout(resolve,1200);});clearTimeout(timeout);session.finishResolve=null;
      this.releaseMic(session);if(this.destroyed)return;
      if(!session.frames){this.state=this.buffer?'ready':'empty';this.chunks=[];throw new Error('音声を記録できませんでした。マイクと入力設定を確認してください。');}
      const buffer=this.context.createBuffer(1,session.frames,this.context.sampleRate),data=buffer.getChannelData(0);let pos=0;for(const chunk of session.chunks){data.set(chunk,pos);pos+=chunk.length;}
      session.chunks=[];this.chunks=[];this.recordingBuffer=buffer;this._setBuffer(buffer,'マイク録音 '+new Date().toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}),'recording');this.emit('notice',{message});
    })();
    try{await this._finishing;}catch(error){this.releaseMic(session);if(!this.destroyed){this.state=this.buffer?'ready':'empty';this.chunks=[];}throw error;}finally{this._finishing=null;this.emit();}
  }
  recordingWav(){return this.recordingBuffer?new Blob([encodeWav(this.recordingBuffer)],{type:'audio/wav'}):null;}
  discardRecording(){if(this.kind==='recording')this.clear();this.recordingBuffer=null;this.emit();}
  destroy(){if(this.destroyed)return;this._operation();++this.playOperation;this.destroyed=true;this.micRequested=false;this._micSession?.finishResolve?.();this.releaseMic();this._stopSource();this.context?.close().catch(()=>{});this.buffer=null;this.recordingBuffer=null;this.chunks=[];}
}

