import {clamp,smoothSignal} from './audio-math.js';
export const PALETTES={
  dawn:{name:'薄明',bg:'#101c27',thread:[[237,207,176],[131,185,184],[211,137,123]],glow:'#b4d0c9'},
  amber:{name:'琥珀',bg:'#241b1c',thread:[[246,203,135],[199,125,102],[193,178,157]],glow:'#edcda2'},
  tide:{name:'深海',bg:'#101e2a',thread:[[167,207,216],[127,150,203],[206,208,183]],glow:'#a7cfd8'}
};
export const ANCHOR_COUNT=5;
export function createAnchors(){return Array.from({length:ANCHOR_COUNT},(_,i)=>({t:(i+1)/6,x:0,y:0,vx:0,vy:0,targetX:0,targetY:0,held:false}));}
export function advanceAnchors(anchors,dt,pinned=false){const d=Math.min(.035,dt);for(const a of anchors){if(a.held)continue;if(pinned){a.vx=0;a.vy=0;continue;}a.vx+=(-a.x*68-a.vx*11)*d;a.vy+=(-a.y*68-a.vy*11)*d;a.x=clamp(a.x+a.vx*d,-.35,.35);a.y=clamp(a.y+a.vy*d,-.45,.45);if(Math.abs(a.x)+Math.abs(a.y)<.00002){a.x=0;a.y=0;}}}
function rgba(color,alpha){return `rgba(${color[0]},${color[1]},${color[2]},${alpha})`;}
export class Loom {
  constructor(canvas,anchorLayer,{onPull=()=>{}}={}) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.layer=anchorLayer;this.anchors=createAnchors();this.phase=0;this.palette='dawn';this.spread=.58;this.decay=.65;this.texture=.48;this.pinned=false;this.frozen=matchMedia('(prefers-reduced-motion: reduce)').matches;this.reduced=this.frozen;this.metrics={rms:0,bass:0,mid:0,treble:0,centroid:0};this.dirty=true;this.onPull=onPull;this.selected=2;this.pointers=new Map();this.buttons=[];this.w=1000;this.h=560;this.lastPositions=[];
    this.anchors.forEach((a,i)=>{const b=document.createElement('button');b.type='button';b.className='thread-anchor';b.setAttribute('aria-label',`糸の結び目 ${i+1}。矢印キーで引っぱる、スペースではじく。`);b.setAttribute('aria-describedby','keyboard-help');b.innerHTML='<span></span>';b.addEventListener('focus',()=>{this.selected=i;this.dirty=true;});b.addEventListener('pointerdown',e=>this.pointerDown(e,i));b.addEventListener('pointermove',e=>this.pointerMove(e));b.addEventListener('pointerup',e=>this.pointerUp(e));b.addEventListener('pointercancel',e=>this.pointerUp(e));b.addEventListener('lostpointercapture',e=>this.pointerUp(e));b.addEventListener('keydown',e=>this.key(e,i));this.layer.append(b);this.buttons.push(b);});
    canvas.addEventListener('pointerdown',e=>this.pointerDown(e));canvas.addEventListener('pointermove',e=>this.pointerMove(e));canvas.addEventListener('pointerup',e=>this.pointerUp(e));canvas.addEventListener('pointercancel',e=>this.pointerUp(e));canvas.addEventListener('lostpointercapture',e=>this.pointerUp(e));
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);this.resize();
  }
  resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.max(1,r.width);this.h=Math.max(1,r.height);const ratio=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*ratio);this.canvas.height=Math.round(this.h*ratio);this.ctx.setTransform(ratio,0,0,ratio,0,0);this.anchors.forEach((_,i)=>this.constrainAnchor(i));this.dirty=true;}
  coords(event){const r=this.canvas.getBoundingClientRect();return{x:event.clientX-r.left,y:event.clientY-r.top};}
  pointerDown(event,index){if(event.button!==0)return;event.preventDefault();const p=this.coords(event);if(index===undefined){let best=Infinity;this.anchors.forEach((a,i)=>{const b=this.position(a.t);const d=Math.hypot(b.x-p.x,b.y-p.y);if(d<best){best=d;index=i;}});}if([...this.pointers.values()].some(v=>v.index===index))return;const a=this.anchors[index];a.held=true;a.vx=0;a.vy=0;const base=this.position(a.t);this.pointers.set(event.pointerId,{index,start:p,original:{x:a.x,y:a.y},base});this.selected=index;event.currentTarget.setPointerCapture(event.pointerId);this.canvas.parentElement.classList.add('is-pulling');this.onPull(index);this.dirty=true;}
  pointerMove(event){const p=this.pointers.get(event.pointerId);if(!p)return;const q=this.coords(event),a=this.anchors[p.index];a.x=clamp(p.original.x+(q.x-p.start.x)/this.w,-.32,.32);a.y=clamp(p.original.y+(q.y-p.start.y)/this.h,-.4,.4);this.constrainAnchor(p.index);this.dirty=true;}
  pointerUp(event){const p=this.pointers.get(event.pointerId);if(!p)return;this.anchors[p.index].held=false;this.pointers.delete(event.pointerId);if(!this.pointers.size)this.canvas.parentElement.classList.remove('is-pulling');this.dirty=true;}
  key(event,index){const a=this.anchors[index],step=event.shiftKey?.045:.014;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();if(event.key==='ArrowLeft')a.x-=step;if(event.key==='ArrowRight')a.x+=step;if(event.key==='ArrowUp')a.y-=step;if(event.key==='ArrowDown')a.y+=step;a.x=clamp(a.x,-.32,.32);a.y=clamp(a.y,-.4,.4);a.vx=0;a.vy=0;this.constrainAnchor(index);this.onPull(index);this.dirty=true;}else if(event.code==='Space'){event.preventDefault();this.pluck(index);}else if(event.key==='Home'){event.preventDefault();a.x=0;a.y=0;a.vx=0;a.vy=0;this.dirty=true;}}
  constrainAnchor(index){const a=this.anchors[index],p=this.position(a.t),marginX=Math.min(22,this.w*.1),marginY=Math.min(65,this.h*.2);a.x=clamp(a.x+(clamp(p.x,marginX,this.w-marginX)-p.x)/this.w,-.32,.32);a.y=clamp(a.y+(clamp(p.y,marginY,this.h-marginY)-p.y)/this.h,-.4,.4);}
  pluck(index=this.selected){const a=this.anchors[index];a.y=clamp(a.y-.12,-.4,.4);a.vy=.35;this.constrainAnchor(index);this.dirty=true;}
  reset(){this.pointers.clear();for(const a of this.anchors){a.x=0;a.y=0;a.vx=0;a.vy=0;a.held=false;}this.canvas.parentElement.classList.remove('is-pulling');this.dirty=true;}
  position(t,line=0,band=0){const w=this.w,h=this.h,e=Math.sin(Math.PI*t),m=this.metrics,p=this.phase;
    const span=.23+this.spread*.77;
    // A continuous open braid: never a collection of isolated equalizer bars.
    let x=w*(.09+.82*t)+Math.sin(t*Math.PI*2+p*.18)*h*.025*e;
    let y=h*.52+Math.sin(t*Math.PI*2+p*.24)*h*.105*e;
    const curl=Math.sin(t*Math.PI*2+p*.11+band*.2)*h*(.17*span+m.bass*.16)*e;
    y+=curl;
    x+=Math.sin(t*Math.PI*4-p*.15)*h*.025*e*span;
    if(line!==0){const twist=Math.sin(t*Math.PI*3+p*.23+band*.33);y+=line*h*.0041*e*(.9+.8*twist)*span;x+=line*h*.0022*Math.cos(t*Math.PI*3+p*.23)*e*span;}
    y+=Math.sin(t*Math.PI*(10+band*2)+p*.6+line*.08)*h*m.mid*.025*e;
    y+=Math.sin(t*Math.PI*51+line*.53+p)*h*m.treble*.007*e;
    // C1 interpolation keeps each knot exactly under its own control: no neighbouring handle can be pushed offstage.
    const u=clamp(t)*6,index=Math.min(5,Math.floor(u)),fraction=u-index,ease=fraction*fraction*(3-2*fraction),left=this.anchors[index-1],right=this.anchors[index];
    x+=w*((left?.x||0)*(1-ease)+(right?.x||0)*ease);y+=h*((left?.y||0)*(1-ease)+(right?.y||0)*ease);
    return{x,y};
  }
  update(dt,signal){this.metrics=smoothSignal(this.metrics,signal,dt,.15+this.decay*1.4);if(!this.frozen){this.phase+=dt*(.5+this.metrics.rms*.65);advanceAnchors(this.anchors,dt,this.pinned);this.anchors.forEach((_,i)=>this.constrainAnchor(i));this.dirty=true;}}
  draw(){if(!this.dirty)return;this.anchors.forEach((_,i)=>this.constrainAnchor(i));this.dirty=false;const c=this.ctx,w=this.w,h=this.h,palette=PALETTES[this.palette],m=this.metrics;c.fillStyle=palette.bg;c.fillRect(0,0,w,h);
    const glow=c.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,w*.49);glow.addColorStop(0,rgba(palette.thread[1],.075+m.rms*.035));glow.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=glow;c.fillRect(0,0,w,h);
    c.strokeStyle=rgba(palette.thread[0],.055);c.lineWidth=.65;const space=44;for(let x=22;x<w;x+=space){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}for(let y=20;y<h;y+=space){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
    // A small, deterministic field of flecks: no image assets, no strobing.
    for(let i=0;i<92;i++){const x=((i*83.21+13)%997)/997*w,y=((i*137.17+31)%601)/601*h;c.fillStyle=rgba(palette.thread[i%3],.06+((i%4)/100));c.fillRect(x,y,.7,.7);}
    const count=47,segments=w<500?100:144;
    for(let i=0;i<count;i++){const line=i-(count-1)/2,band=i%3,col=palette.thread[band];c.beginPath();for(let j=0;j<=segments;j++){const point=this.position(j/segments,line,band);if(j)c.lineTo(point.x,point.y);else c.moveTo(point.x,point.y);}c.strokeStyle=rgba(col,.15+(.11*(1-Math.abs(line)/24))+(m.rms*.14));c.lineWidth=i%9===0?1.05:.55;c.stroke();}
    // Three illuminated travelling fibres, amplitude follows sound rather than loud flashes.
    for(let k=0;k<3;k++){c.beginPath();for(let j=0;j<=segments;j++){const p=this.position(j/segments,(k-1)*7,k);if(j)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}c.lineWidth=1;c.strokeStyle=rgba(palette.thread[k],.67+m.rms*.2);c.stroke();}
    if(this.texture>.01){const count=Math.round(18+this.texture*82),drift=this.phase*.009;for(let i=0;i<count;i++){const t=((i*.6180339887+drift*(i%2?1:-1))%1+1)%1,band=i%3,l=((i*7)%45)-22,p=this.position(t,l,band),size=.5+this.texture*.75+m.treble*1.6;c.beginPath();c.arc(p.x,p.y,size,0,Math.PI*2);c.fillStyle=rgba(palette.thread[band],.19+this.texture*.35+m.treble*.2);c.fill();}}
    // End pins and quiet registration marks frame the woven field.
    for(const t of [0,1]){const p=this.position(t);c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.strokeStyle=rgba(palette.thread[0],.8);c.lineWidth=1;c.stroke();c.beginPath();c.moveTo(p.x,p.y-18);c.lineTo(p.x,p.y-10);c.moveTo(p.x,p.y+10);c.lineTo(p.x,p.y+18);c.strokeStyle=rgba(palette.thread[0],.25);c.stroke();}
    this.anchors.forEach((a,i)=>{const p=this.position(a.t);this.lastPositions[i]=p;this.buttons[i].style.left=`${p.x}px`;this.buttons[i].style.top=`${p.y}px`;this.buttons[i].classList.toggle('is-held',a.held);});
  }
  snapshot(){this.dirty=true;this.draw();return new Promise(resolve=>this.canvas.toBlob(resolve,'image/png'));}
  destroy(){this.resizeObserver.disconnect();}
}
