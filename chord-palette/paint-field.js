import {soundFromColor} from './paint-tone.js';
export const basePaints=[{name:'ばら',color:'#ec369c'},{name:'はちみつ',color:'#f4d52c'},{name:'そら',color:'#21c7df'},{name:'くも',color:'#ffffff'},{name:'かげ',color:'#20232a'}];
export const PAINT_LIMIT=180;
export const initialPaint=[{color:'#f4d52c',x:.38,y:.48,radius:.17,amount:1},{color:'#21c7df',x:.58,y:.53,radius:.17,amount:1}];
export const validPaint=p=>Array.isArray(p)&&p.length<=PAINT_LIMIT&&p.every(d=>/^#[0-9a-f]{6}$/i.test(d.color)&&['x','y','radius','amount'].every(k=>Number.isFinite(d[k]))&&d.x>=0&&d.x<=1&&d.y>=0&&d.y<=1&&d.radius>=.02&&d.radius<=.5&&d.amount>0&&d.amount<=3);
export function addPaint(p,d){return validPaint(p)&&validPaint([d])?[...p.map(x=>({...x})),{...d}].slice(-PAINT_LIMIT):p.map(x=>({...x}))}
export function samplePaint(p,x,y){let total=0,logs=[0,0,0];for(const d of p){const dx=x-d.x,dy=y-d.y,r=d.radius*(1+.08*Math.sin(x*53+y*37));const q=(dx*dx+dy*dy)/(r*r);if(q>=1)continue;const a=d.amount*(1-q)**2;total+=a;for(let c=0;c<3;c++)logs[c]+=a*Math.log(Math.max(.008,parseInt(d.color.slice(1+c*2,3+c*2),16)/255));}const rgb=logs.map(v=>total?Math.round(255*Math.exp(v/total)):255);return {color:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),coverage:Math.min(1,total*3)}}
export function notePoint(index,p=initialPaint){const i=Math.max(0,Math.floor(index||0)),d=p[i%p.length];if(!d)return{x:.5,y:.5};const a=i*2.399963,r=d.radius*.55*Math.sqrt(((i*.618+.3)%1));return{x:Math.max(0,Math.min(1,d.x+Math.cos(a)*r)),y:Math.max(0,Math.min(1,d.y+Math.sin(a)*r))}}
export const soundAt=(p,point)=>soundFromColor(samplePaint(p,point.x,point.y).color);
