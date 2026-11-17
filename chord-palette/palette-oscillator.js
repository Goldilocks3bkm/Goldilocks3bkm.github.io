// Provisional sound-colour experiment, not a universal colour/sound correspondence.
// Pure functions and stable parameter units make the mapping portable to native DSP.
export const pigments=[
 {id:'rose',name:'ばら',color:'#e6a0af',wave:'sine',cutoff:850,attack:.035,release:.85,vibrato:0,rate:1.2},
 {id:'honey',name:'はちみつ',color:'#e8c878',wave:'sawtooth',cutoff:4800,attack:.008,release:.18,vibrato:2,rate:4.5},
 {id:'sky',name:'そら',color:'#8ebdd5',wave:'triangle',cutoff:1900,attack:.48,release:1.6,vibrato:15,rate:2.4}
];
export function normalizeMix(values){const safe=pigments.map((_,i)=>Number.isFinite(+values[i])?Math.max(0,+values[i]):0),sum=safe.reduce((a,b)=>a+b,0);return sum?safe.map(v=>v/sum):[1,0,0]}
export function mixAt(x,y){
 // Equilateral-ish triangle: rose top, honey lower-left, sky lower-right.
 const rose=1-(y-.12)/.76,sky=((x-.5)+.4*(1-rose))/.8,honey=1-rose-sky;
 return normalizeMix([rose,honey,sky]);
}
export function soundFromMix(values){const weights=normalizeMix(values),sum=key=>pigments.reduce((v,p,i)=>v+p[key]*weights[i],0);const rgb=[1,3,5].map(k=>Math.round(pigments.reduce((v,p,i)=>v+parseInt(p.color.slice(k,k+2),16)*weights[i],0)));return {weights,color:'#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join(''),cutoff:Math.exp(pigments.reduce((v,p,i)=>v+Math.log(p.cutoff)*weights[i],0)),attack:sum('attack'),release:sum('release'),vibrato:sum('vibrato'),rate:sum('rate')}}
export const initialMix=[.5,.2,.3];
export function validMix(v){return Array.isArray(v)&&v.length===3&&v.every(x=>Number.isFinite(x)&&x>=0)&&v.some(x=>x>0)}
export function createPaletteVoice(ctx,master,n,settings){
 const envelope=ctx.createGain(),filter=ctx.createBiquadFilter();filter.type='lowpass';filter.Q.value=.7;filter.connect(envelope);envelope.connect(master);
 const oscillators=pigments.map(p=>{const osc=ctx.createOscillator(),gain=ctx.createGain();gain.gain.value=0;osc.type=p.wave;osc.frequency.value=440*2**((n-69)/12);osc.connect(gain);gain.connect(filter);return {osc,gain}});
 const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.type='sine';lfo.connect(depth);for(const {osc} of oscillators)depth.connect(osc.detune);
 let released=false;
 const update=next=>{settings=next;const t=ctx.currentTime;for(let i=0;i<3;i++)oscillators[i].gain.gain.setTargetAtTime(settings.weights[i],t,.035);filter.frequency.setTargetAtTime(settings.cutoff,t,.035);filter.Q.setTargetAtTime(settings.q??.7,t,.035);lfo.frequency.setTargetAtTime(settings.rate,t,.035);depth.gain.setTargetAtTime(settings.vibrato,t,.035)};
 // Initial values are ready before the oscillators start. Only changes to a
 // sounding voice need smoothing; ramping from zero here delays every note.
 for(let i=0;i<3;i++)oscillators[i].gain.gain.setValueAtTime(settings.weights[i],ctx.currentTime);
 filter.frequency.setValueAtTime(settings.cutoff,ctx.currentTime);filter.Q.setValueAtTime(settings.q??.7,ctx.currentTime);
 lfo.frequency.setValueAtTime(settings.rate,ctx.currentTime);depth.gain.setValueAtTime(settings.vibrato,ctx.currentTime);
 envelope.gain.setValueAtTime(0,ctx.currentTime);envelope.gain.linearRampToValueAtTime(.13,ctx.currentTime+settings.attack);envelope.gain.linearRampToValueAtTime(.13*(settings.sustain??1),ctx.currentTime+settings.attack+(settings.decay??0));oscillators.forEach(v=>v.osc.start());lfo.start();
 return {update,stop(){if(released)return;released=true;const t=ctx.currentTime,release=settings.release;if(envelope.gain.cancelAndHoldAtTime)envelope.gain.cancelAndHoldAtTime(t);else{envelope.gain.cancelScheduledValues(t);envelope.gain.setValueAtTime(envelope.gain.value,t)}envelope.gain.setTargetAtTime(0,t,Math.max(.02,release/4));const end=t+release+.1;for(const {osc} of oscillators)osc.stop(end);lfo.stop(end);lfo.onended=()=>{for(const {osc,gain} of oscillators){osc.disconnect();gain.disconnect()}lfo.disconnect();depth.disconnect();filter.disconnect();envelope.disconnect()}}};
}
