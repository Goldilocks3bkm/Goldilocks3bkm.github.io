export const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
export const defaultColors=['#eb8c91','#edae83','#dfc76e','#b8c886','#8bb89d','#85c4bb','#8abbd8','#9aace0','#b3a0d4','#cb9fc6','#dc9fb6','#dfaaa0'];
// Native FWT ChordDetector templates and priority order (personal-use source).
const patterns=[['',[0,4,7],10],['m',[0,3,7],11],['5',[0,7],12],['dim',[0,3,6],18],['aug',[0,4,8],18],['sus2',[0,2,7],20],['sus4',[0,5,7],20],['maj7',[0,4,7,11],30],['7',[0,4,7,10],31],['m7',[0,3,7,10],32],['mmaj7',[0,3,7,11],38],['m7b5',[0,3,6,10],36],['dim7',[0,3,6,9],37],['6',[0,4,7,9],42],['m6',[0,3,7,9],43],['add9',[0,2,4,7],44],['madd9',[0,2,3,7],45],['9',[0,2,4,7,10],52],['m9',[0,2,3,7,10],53],['maj9',[0,2,4,7,11],54]];
export function noteName(n){return names[((n%12)+12)%12]+(Math.floor(n/12)-1)}
export function detectChord(notes){
 const ordered=[...new Set(notes)].sort((a,b)=>a-b);if(!ordered.length)return {name:'—',detail:'鍵盤を押してみよう'};
 const pcs=[...new Set(ordered.map(n=>((n%12)+12)%12))].sort((a,b)=>a-b);if(pcs.length===1)return {name:names[pcs[0]],detail:'単音'};
 const bass=((ordered[0]%12)+12)%12;let best=null,bestScore=Infinity;
 for(const root of pcs){for(const [suffix,intervals,priority] of patterns){
  if(intervals.length!==pcs.length||!intervals.every(i=>pcs.includes((root+i)%12)))continue;
  const score=priority*100+(bass===root?-25:12)+(root!==pcs[0]?4:0);
  if(score<bestScore){bestScore=score;best={name:names[root]+suffix+(bass!==root?'/'+names[bass]:''),detail:bass===root?'コード':'転回形'};}
 }}
 if(best)return best;
 return {name:pcs.map(n=>names[n]).join(' · '),detail:'この組み合わせはコード候補未判定'};
}
export function validColors(value){return Array.isArray(value)&&value.length===12&&value.every(c=>/^#[0-9a-f]{6}$/i.test(c))}
