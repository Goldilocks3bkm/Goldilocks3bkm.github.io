/** Pure signal helpers. These are aesthetic descriptors, not calibrated measurements. */
export const clamp = (v, lo=0, hi=1) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
export function describeSignal(wave, bins, sampleRate, fftSize=2048) {
  let sum=0; for (const v of wave) sum+=v*v;
  const rms=Math.sqrt(sum/(wave.length||1));
  const hzPerBin=sampleRate/fftSize;
  function band(lo,hi) {
    let energy=0,n=0;
    for(let i=Math.ceil(lo/hzPerBin);i<Math.min(bins.length,Math.ceil(hi/hzPerBin));i++){const a=10**(bins[i]/20);energy+=a*a;n++;}
    return clamp(Math.sqrt(energy/(n||1))*5);
  }
  let weighted=0,total=0;
  for(let i=1;i<bins.length;i++){const a=10**(bins[i]/20);if(Number.isFinite(a)){weighted+=i*hzPerBin*a;total+=a;}}
  return {rms:clamp(rms*3),bass:band(35,180),mid:band(180,2400),treble:band(2400,12000),centroid:total?clamp(weighted/total/8000):0};
}
export function smoothSignal(previous,next,dt,release=.65) {
  const result={};
  for(const key of ['rms','bass','mid','treble','centroid']) {
    const tau=next[key]>previous[key]?.055:release;
    result[key]=previous[key]+(next[key]-previous[key])*(1-Math.exp(-Math.min(dt,.1)/Math.max(.01,tau)));
  }
  return result;
}
export function waveformPeaks(buffer, count=160) {
  const data=buffer.getChannelData(0),result=[];
  for(let i=0;i<count;i++) {
    const start=Math.floor(i*data.length/count),end=Math.max(start+1,Math.floor((i+1)*data.length/count));let peak=0;
    for(let j=start;j<Math.min(end,data.length);j+=Math.max(1,Math.floor((end-start)/40)))peak=Math.max(peak,Math.abs(data[j]));
    result.push(peak);
  }
  return result;
}
export function encodeWav(buffer) {
  const channels=Math.min(2,buffer.numberOfChannels),length=buffer.length,bytes=length*channels*2;
  const array=new ArrayBuffer(44+bytes),view=new DataView(array);
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+bytes,true);write(8,'WAVE');write(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);view.setUint16(32,channels*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes,true);
  const data=Array.from({length:channels},(_,i)=>buffer.getChannelData(i));let p=44;
  for(let i=0;i<length;i++)for(let c=0;c<channels;c++){const sample=data[c][i],v=Number.isFinite(sample)?clamp(sample,-1,1):0;view.setInt16(p,v<0?v*32768:v*32767,true);p+=2;}
  return array;
}
export function makeDemo(context) {
  // Original generative miniature. No sampled or third-party sound.
  const rate=context.sampleRate,duration=24,buffer=context.createBuffer(2,rate*duration,rate);
  const notes=[220,329.6276,440,293.6648,261.6256,391.9954,523.2511,329.6276];
  for(let c=0;c<2;c++) {
    const out=buffer.getChannelData(c);
    for(let i=0;i<out.length;i++) {
      const t=i/rate,beat=Math.floor(t/1.5),local=t%1.5,f=notes[beat%notes.length];
      const env=(1-Math.exp(-local*65))*Math.exp(-local*2.8);
      const pluck=(Math.sin(t*f*Math.PI*2)+.28*Math.sin(t*f*2.003*Math.PI*2)+.08*Math.sin(t*f*4.01*Math.PI*2))*env*.19;
      const bass=Math.sin(t*(beat<8?55:65.4064)*Math.PI*2)*(.6+.4*Math.cos(t*Math.PI/3))*.075;
      const air=(Math.sin(t*659.255*(1+c*.0007)*Math.PI*2)+Math.sin(t*880.1*Math.PI*2))*.016*(.5+.5*Math.sin(t*.7));
      const fade=Math.min(1,t/.4,(duration-t)/1.5);
      out[i]=(pluck+bass+air)*Math.max(0,fade);
    }
  }
  return buffer;
}
export function formatTime(seconds) {const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));return `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;}
