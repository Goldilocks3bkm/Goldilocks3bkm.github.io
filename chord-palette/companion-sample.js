import {drawSolWorld,drawSolDrop} from './sol-visual.js';
// Pure normalized motion data: native renderers can reuse the same timing and seed.
// No audio, note events, randomness, or storage is touched by this demonstration.
export function sampleParticles(time, count=6){
 return Array.from({length:count},(_,i)=>{const progress=((time/3600+i/count)%1+1)%1;return {u:progress,x:.2+(i%3)*.3+Math.sin(progress*Math.PI*2+i)*.055,y:.84-progress*.65,r:5+i%3*2,angle:i*.7+progress*.5,colorIndex:i*2%12};});
}
export function drawCompanionSample(canvas,character,colors,time,night){
 const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;if(!w||!h)return;
 const d=Math.min(globalThis.devicePixelRatio||1,2),cw=Math.round(w*d),ch=Math.round(h*d);
 if(canvas.width!==cw||canvas.height!==ch){canvas.width=cw;canvas.height=ch;}
 const g=canvas.getContext('2d');g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);
 if(character==='sol')drawSolWorld(g,w,h,night);
 for(const p of sampleParticles(time)){
  const color=colors[p.colorIndex];
  if(character==='sol'){drawSolDrop(g,{age:p.u,life:1,startX:w*p.x,startY:h*.34,r:p.r,c:color},w,h,time===0);continue;}
  g.save();g.translate(w*p.x,h*p.y);g.rotate(p.angle);g.fillStyle=color;g.strokeStyle=color;g.lineWidth=1.5;g.globalAlpha=.75*Math.sin(p.u*Math.PI);
  const r=p.r;
  if(character==='alice'){
   for(let k=0;k<5;k++){g.save();g.rotate(k*Math.PI*2/5);g.beginPath();g.ellipse(0,-r*.65,r*.42,r*.62,0,0,Math.PI*2);g.fill();g.restore();}
   g.fillStyle=night?'#eee0b2':'#e0bc72';g.beginPath();g.arc(0,0,r*.24,0,Math.PI*2);g.fill();
  }else if(character==='minar'){
   g.beginPath();for(let k=0;k<24;k++){const a=k*Math.PI/12,s=k%3===1?r*.72:r;g.lineTo(Math.cos(a)*s,Math.sin(a)*s)}g.closePath();g.stroke();g.beginPath();g.arc(0,0,r*.3,0,Math.PI*2);g.stroke();
  }else if(character==='teal'){
   g.beginPath();g.moveTo(0,r);g.quadraticCurveTo(-r,-r*.5,0,-r*1.5);g.quadraticCurveTo(r,-r*.5,0,r);g.fill();g.beginPath();g.moveTo(0,r*1.5);g.lineTo(0,-r);g.stroke();
  }else{
   g.beginPath();g.moveTo(0,-r);g.lineTo(r*.7,0);g.lineTo(0,r);g.lineTo(-r*.7,0);g.closePath();g.stroke();g.beginPath();g.moveTo(-r*.7,0);g.lineTo(r*.7,0);g.stroke();
  }g.restore();
 }
}
