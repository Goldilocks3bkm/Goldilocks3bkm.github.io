import {AudioEngine} from './audio-engine.js';
import {Loom,PALETTES} from './loom.js';
import {formatTime,clamp} from './audio-math.js';
const $=id=>document.getElementById(id);
const engine=new AudioEngine();
const loom=new Loom($('loom'),$('anchor-layer'),{onPull:()=>{$('touch-instruction').classList.add('is-used');}});
let busy=false,lastFrame=0,lastUI=0,raf=0,lastBuffer=null;
const paletteNames={dawn:'薄明 / DAWN',amber:'琥珀 / AMBER',tide:'深海 / TIDE'};
const say=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('is-error',error);};
function download(blob,name){if(!blob){say('ファイルを作れませんでした。もう一度お試しください。',true);return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
function stamp(){return new Date().toISOString().slice(0,19).replaceAll(':','-');}
async function task(fn){if(busy)return;busy=true;sync();try{await fn();}catch(error){say(error.message||'処理を完了できませんでした。',true);}finally{busy=false;sync();}}
function waveform(){const bars=engine.peaks||Array(100).fill(.015);const fragment=document.createDocumentFragment();for(const value of bars){const b=document.createElement('b');b.style.height=`${Math.max(1,Math.min(26,value*53))}px`;fragment.append(b);}$('waveform').replaceChildren(fragment);}
function sync(){const recording=engine.state==='recording',finishing=engine.state==='finishing',requesting=engine.micRequested,locked=busy||recording||requesting||finishing,playing=engine.state==='playing';
  $('instrument').classList.toggle('is-busy',busy);$('audio-file').disabled=locked;$('demo').disabled=locked;$('play').disabled=!engine.buffer||locked;$('seek').disabled=!engine.buffer||locked;$('clear-source').disabled=locked;$('clear-source').hidden=!engine.buffer;$('loop').disabled=recording||requesting||finishing;
  $('play').setAttribute('aria-label',playing?'一時停止':'再生');$('play-symbol').innerHTML=playing?'<path d="M7 5h3v14H7zM14 5h3v14h-3z"/>':'<path d="m9 5 10 7-10 7z"/>';
  $('loop').setAttribute('aria-pressed',String(engine.loop));$('track-name').textContent=engine.name;$('track-kind').textContent=({none:'NO SOURCE',file:'LOCAL FILE',demo:'ORIGINAL / 24 SEC',recording:'MIC / PCM WAV'})[engine.kind];$('duration').textContent=formatTime(engine.duration);
  $('microphone').disabled=finishing||(busy&&!requesting&&!recording);$('microphone').classList.toggle('is-recording',recording);$('mic-button-label').textContent=requesting?'許可待ちを取消':finishing?'WAVを仕上げ中':recording?'録音を終える':'マイクで録音';$('microphone').setAttribute('aria-label',requesting?'マイクの許可待ちを取り消す':finishing?'WAV録音を仕上げ中':recording?'録音を終了しマイクを停止':'マイク録音の説明を開く');
  $('mic-indicator').classList.toggle('is-on',recording);$('mic-indicator').replaceChildren();const i=document.createElement('i');$('mic-indicator').append(i,document.createTextNode(recording?'録音中':requesting?'許可待ち':'マイク OFF'));
  $('scene-state').textContent=recording?'いま、ここにある音を織っています':finishing?'マイクを停止しました ・ WAVを仕上げ中':playing?'音を聴いて、糸を織っています':engine.buffer?'糸と音の、静かな待ち合わせ':'静かな糸 ・ 音を待っています';
  $('record-timer').textContent=recording?`${formatTime(engine.recordingTime)} / 05:00 ・ モノラル WAV`:requesting?'ブラウザーの許可を待っています':finishing?'マイクは停止しています':'許可するまで、使いません。';
  $('recording-result').hidden=!engine.recordingBuffer;$('save-recording').disabled=locked;$('discard-recording').disabled=locked;
  if(engine.recordingBuffer)$('recording-detail').textContent=`${formatTime(engine.recordingBuffer.duration)} ・ ${Math.round(engine.recordingBuffer.sampleRate/100)/10} kHz / 16-bit / mono ・ 閉じる前に保存を`;
  if(engine.buffer!==lastBuffer){waveform();lastBuffer=engine.buffer;}
  $('volume-text').textContent=`音量 ${Math.round(engine.volume*100)}%`;
  tickUI();
}
function tickUI(){const current=engine.currentTime,duration=engine.duration;$('elapsed').textContent=formatTime(current);if(document.activeElement!==$('seek'))$('seek').value=duration?Math.round(current/duration*1000):0;$('seek').setAttribute('aria-valuetext',`${formatTime(current)} / ${formatTime(duration)}`);$('seek').parentElement.style.setProperty('--progress',`${duration?current/duration*100:0}%`);if(engine.state==='recording')$('record-timer').textContent=`${formatTime(engine.recordingTime)} / 05:00 ・ モノラル WAV`;for(const name of ['bass','mid','treble'])$(`meter-${name}`).style.transform=`scaleX(${clamp(loom.metrics[name])})`;}
function syncMotion(){const frozen=loom.frozen;$('motion').setAttribute('aria-pressed',String(frozen));$('motion-text').textContent=frozen?'動きを再開':'動きを止める';$('motion-icon').textContent=frozen?'▷':'Ⅱ';$('motion-label').textContent=frozen?'静止中 ・ 音は別に再生できます':'ゆっくり、呼吸中';loom.dirty=true;}
function frame(time){const dt=lastFrame?Math.min((time-lastFrame)/1000,.04):1/60;lastFrame=time;loom.update(dt,engine.metrics());loom.draw();if(time-lastUI>90){tickUI();lastUI=time;}raf=requestAnimationFrame(frame);}
function startFrame(){if(!raf){lastFrame=0;raf=requestAnimationFrame(frame);}}
function stopFrame(){cancelAnimationFrame(raf);raf=0;}
engine.addEventListener('change',sync);engine.addEventListener('error',({detail})=>say(detail.message,true));engine.addEventListener('notice',({detail})=>say(detail.message));
$('audio-file').addEventListener('change',event=>{const file=event.target.files[0];if(file)loadFile(file);event.target.value='';});
function loadFile(file){return task(async()=>{say('音声を、このブラウザーの中でひらいています…');await engine.loadFile(file);say('音をひらきました。再生ボタンで、この糸に重ねられます。');});}
$('demo').addEventListener('click',()=>task(async()=>{await engine.loadDemo();say('ソルのオリジナル音源「糸のための、24秒」。線にふれながら聴いてみてください。');}));
$('play').addEventListener('click',()=>{if(engine.state==='playing'){engine.pause();say('音を一時停止しました。糸には、そのまま触れられます。');}else task(async()=>{await engine.play();say('再生中。結び目をつまむと、音のうねりを手で変えられます。');});});
$('seek').addEventListener('input',()=>{engine.seek(Number($('seek').value)/1000*engine.duration);tickUI();});
$('loop').addEventListener('click',()=>{engine.setLoop(!engine.loop);say(engine.loop?'繰り返し再生をオンにしました。':'繰り返し再生をオフにしました。');});
$('clear-source').addEventListener('click',()=>{engine.clear();say('音を外しました。糸の形は、そのまま残しています。');});
$('volume').addEventListener('input',()=>engine.setVolume(Number($('volume').value)/100));
$('microphone').addEventListener('click',()=>{if(engine.micRequested){engine.cancelMicrophone();say('マイクの開始を取り消しました。後から許可されても、録音を始めず直ちに終了します。');return;}if(engine.state==='recording'){task(()=>engine.stopMicrophone());return;}$('mic-replace-warning').hidden=!engine.recordingBuffer;$('mic-dialog').showModal();});
$('confirm-mic').addEventListener('click',()=>{$('mic-dialog').close();task(async()=>{say('ブラウザーのマイク許可を待っています。取り消すこともできます。');await engine.startMicrophone();if(engine.state==='recording')say('録音中。音は外へ送信せず、スピーカーにも返していません。「録音を終える」で停止します。');});});
$('save-recording').addEventListener('click',()=>{download(engine.recordingWav(),`sol-loom-recording-${stamp()}.wav`);say('WAVの保存を開始しました。ダウンロード先を確認してください。録音はこのタブにも残っています。');});
$('discard-recording').addEventListener('click',()=>{if(confirm('このタブにある録音を破棄しますか？ 保存していない録音は元に戻せません。')){engine.discardRecording();say('録音を破棄しました。');}});
$('pin').addEventListener('click',()=>{loom.pinned=!loom.pinned;$('pin').setAttribute('aria-pressed',String(loom.pinned));loom.dirty=true;say(loom.pinned?'形を留めました。つまんだ変形を残して、音の揺れを重ねられます。':'留めを外しました。糸はゆっくり、元の場所へ戻ります。');});
$('pluck').addEventListener('click',()=>{loom.pluck();$('touch-instruction').classList.add('is-used');});
$('reset-shape').addEventListener('click',()=>{loom.reset();say('糸の形を整えました。音と仕立ては、そのままです。');});
$('motion').addEventListener('click',()=>{loom.frozen=!loom.frozen;syncMotion();say(loom.frozen?'動きを止めました。音の再生・録音は続きます。糸は手で動かせます。':'糸の動きを再開しました。');});
$('snapshot').addEventListener('click',()=>task(async()=>{download(await loom.snapshot(),`sol-loom-${stamp()}.png`);say('糸の景色をPNGで保存します。音声や録音データは含まれません。');}));
for(const key of ['spread','decay','texture']){const input=$(key),group=input.closest('.cord-control'),path=group.querySelector('.cord-path');function update(){const value=Number(input.value),p=path.getPointAtLength(path.getTotalLength()*value/100);for(const bead of group.querySelectorAll('circle')){bead.setAttribute('cx',p.x);bead.setAttribute('cy',p.y);}$(`${key}-output`).innerHTML=`${value}<span>%</span>`;input.setAttribute('aria-valuetext',`${value}%`);loom[key]=value/100;loom.dirty=true;}input.addEventListener('input',update);update();}
for(const button of document.querySelectorAll('[data-palette]'))button.addEventListener('click',()=>{const name=button.dataset.palette;loom.palette=name;loom.dirty=true;$('palette-name').textContent=paletteNames[name];for(const b of document.querySelectorAll('[data-palette]')){const selected=b===button;b.classList.toggle('is-selected',selected);b.setAttribute('aria-pressed',String(selected));}say(`糸の色を「${PALETTES[name].name}」に変えました。`);});
let dragDepth=0;const instrument=$('instrument');instrument.addEventListener('dragenter',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();dragDepth++;instrument.classList.add('is-file-over');}});instrument.addEventListener('dragover',event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.dataTransfer.dropEffect='copy';}});instrument.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;instrument.classList.remove('is-file-over');}});instrument.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;instrument.classList.remove('is-file-over');const file=event.dataTransfer.files[0];if(!file)return;if(engine.micRequested||engine.micStream){say('録音を終えてから、ファイルを選んでください。',true);return;}if(!busy)loadFile(file);});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');reduced.addEventListener('change',event=>{loom.reduced=event.matches;if(event.matches){loom.frozen=true;syncMotion();say('端末の設定に合わせ、動きを止めました。音の再生・録音は別に操作できます。');}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFrame();if(engine.micRequested){engine.cancelMicrophone();say('タブが非表示になったため、マイクの開始を取り消しました。');}if(engine.state==='recording')engine.stopMicrophone('タブが非表示になったため録音を終了し、マイクを停止しました。WAVを保存できます。').catch(error=>say(error.message,true));}else{startFrame();sync();}});
window.addEventListener('pagehide',event=>{stopFrame();if(event.persisted){if(engine.micRequested)engine.cancelMicrophone();if(engine.state==='recording'||engine.state==='finishing')engine.stopMicrophone('ページを離れたため録音を終了し、マイクを停止しました。').catch(error=>say(error.message,true));else engine.pause();}else{engine.destroy();loom.destroy();}});
window.addEventListener('pageshow',event=>{if(event.persisted){loom.resize();sync();startFrame();}});
window.addEventListener('beforeunload',event=>{if(engine.recordingBuffer||['recording','finishing'].includes(engine.state)){event.preventDefault();event.returnValue='';}});
waveform();sync();syncMotion();startFrame();if(loom.reduced)say('端末の設定に合わせ、糸は静止しています。音で試すことも、手で糸を動かすこともできます。');
