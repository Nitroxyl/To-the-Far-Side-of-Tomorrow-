// Santara: independently persisted move ownership, never infer a TM/egg
// unlock simply because a species could learn that move in a video game.
export const MAX_REMEMBERED_MOVES=180;
export const MOVE_SOURCES=Object.freeze(['legacy','level-up','tm','egg','tutor','evolution','gm']);
export function memoryKey(name){
 return String(name||'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}
export function validMoveName(name){
 return typeof name==='string'&&name.trim().length>0&&name.length<=48&&memoryKey(name).length>0;
}
export function uniqueMoves(moves,max=MAX_REMEMBERED_MOVES){
 const result=[],seen=new Set();
 for(const move of Array.isArray(moves)?moves:[]){
  if(!validMoveName(move))continue;
  const id=memoryKey(move);
  if(seen.has(id))continue;
  seen.add(id);result.push(move.trim());
  if(result.length>=max)break;
 }
 return result;
}
export function eligibleLevelMoves(level,levelUpLevels){
 const n=Number(level);
 if(!Number.isInteger(n)||n<1||n>100)return [];
 const entries=Object.entries(levelUpLevels&&typeof levelUpLevels==='object'?levelUpLevels:{});
 return uniqueMoves(entries.filter(([,min])=>Number.isInteger(Number(min))&&Number(min)>=1&&Number(min)<=n).map(([name])=>name));
}
export function mergeMoveMemory(mon,existing=null,grants=[],source='gm',preserve=true){
 const previously=preserve&&existing&&existing.ownerUid===mon.ownerUid
  &&Array.isArray(existing.unlockedMoves)?existing.unlockedMoves:[];
 const current=Array.isArray(mon.moves)?mon.moves:[];
 const combined=uniqueMoves([...previously,...current,...grants]);
 const oldSources=preserve&&existing?.ownerUid===mon.ownerUid&&existing.sources&&typeof existing.sources==='object'&&!Array.isArray(existing.sources)?existing.sources:{};
 const sources={};
 for(const name of combined){
  const key=memoryKey(name);
  if(oldSources[key]&&MOVE_SOURCES.includes(oldSources[key]))sources[key]=oldSources[key];
  else if(current.some(m=>memoryKey(m)===key))sources[key]='legacy';
  else sources[key]=MOVE_SOURCES.includes(source)?source:'gm';
 }
 return {ownerUid:mon.ownerUid,speciesKey:mon.speciesKey,unlockedMoves:combined,sources};
}
export function grantMoveMemory(mon,existing,moves,source='gm'){
 const extra=uniqueMoves(moves);
 if(extra.some(name=>!validMoveName(name)))throw Error('Invalid move name');
 return mergeMoveMemory(mon,existing,extra,source,true);
}
export function removeMoveMemory(mon,existing,name){
 const key=memoryKey(name);
 if(!key)throw Error('Choose a move to revoke.');
 const initial=mergeMoveMemory(mon,existing,[],'gm',true);
 const unlockedMoves=initial.unlockedMoves.filter(x=>memoryKey(x)!==key);
 const sources={...initial.sources};
 delete sources[key];
 const moves=uniqueMoves(mon.moves||[],4).filter(x=>memoryKey(x)!==key);
 return {memory:{...initial,unlockedMoves,sources},moves};
}
export function validEquippedMoves(moves,memory){
 if(!Array.isArray(moves)||moves.length>4)return false;
 if(moves.some(m=>!validMoveName(m)))return false;
 const unique=uniqueMoves(moves,4);
 if(unique.length!==moves.length)return false;
 const allowed=new Set(uniqueMoves(memory?.unlockedMoves).map(memoryKey));
 return moves.every(move=>allowed.has(memoryKey(move)));
}
export function moveSourceName(value){
 return ({legacy:'Previously assigned', 'level-up':'Level-up',tm:'TM taught',egg:'Egg training',tutor:'Tutor',evolution:'Evolution',gm:'GM unlocked'})[value]||'Unlocked';
}
