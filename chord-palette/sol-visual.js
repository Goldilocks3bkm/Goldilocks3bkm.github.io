// A real water sound becomes a light and comes to rest on a sprout.
// Visual-only: never changes the synth or the four original character modes.
export function solPath(progress,startX,startY,width,height){
 const u=Math.max(0,Math.min(1,progress)),ease=u*u*(3-2*u);
 const endX=width*.5,endY=height*.49;
 return {x:startX+(endX-startX)*ease,y:startY+(endY-startY)*ease-Math.sin(u*Math.PI)*height*.18,glow:Math.max(0,Math.min(1,(u-.25)/.45)),alpha:u>.86?Math.max(0,(1-u)/.14):1};
}
export function drawSolWorld(g,w,h,night){
 const x=w*.5,y=h*.76,r=Math.min(w*.21,h*.18);
 g.save();g.strokeStyle=night?'#9ab8be':'#8da9a8';g.fillStyle=night?'#31494e':'#edf0df';g.lineWidth=1.5;g.globalAlpha=.8;
 g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();g.stroke();
 // A soft winding path around the little world.
 g.beginPath();g.moveTo(x-r*.45,y+r*.6);g.bezierCurveTo(x+r*.9,y+r*.1,x-r*.8,y-r*.2,x,y-r);g.stroke();
 const stemTop=h*.49,stemBottom=y-r*.7;
 g.strokeStyle='#739c80';g.fillStyle=night?'#9ac397':'#a9c99b';g.beginPath();g.moveTo(x,stemBottom);g.quadraticCurveTo(x-3,stemTop+8,x,stemTop);g.stroke();
 for(const side of [-1,1]){g.beginPath();g.moveTo(x,stemTop+9);g.quadraticCurveTo(x+side*22,stemTop-12,x+side*27,stemTop+2);g.quadraticCurveTo(x+side*12,stemTop+17,x,stemTop+9);g.fill();g.stroke()}
 g.restore();
}
export function drawSolDrop(g,p,w,h,reduced=false){
 const u=p.age/p.life,q=solPath(u,p.startX,p.startY,w,h);g.save();g.translate(q.x,q.y);g.globalAlpha=q.alpha*.8;g.fillStyle=p.c;g.strokeStyle=p.c;g.lineWidth=1.3;
 if(q.glow<1){g.globalAlpha=q.alpha*(1-q.glow)*.8;g.beginPath();g.moveTo(0,-p.r);g.bezierCurveTo(-p.r,p.r*.15,-p.r*.65,p.r,0,p.r);g.bezierCurveTo(p.r*.65,p.r,p.r,p.r*.15,0,-p.r);g.fill()}
 g.globalAlpha=q.alpha*q.glow;const r=p.r*(.7+q.glow*.4);g.beginPath();g.arc(0,0,r*.45,0,Math.PI*2);g.fill();
 if(!reduced){g.shadowColor=p.c;g.shadowBlur=10*q.glow;g.beginPath();g.moveTo(0,-r*1.5);g.lineTo(0,r*1.5);g.moveTo(-r*1.5,0);g.lineTo(r*1.5,0);g.stroke()}
 g.restore();
}
