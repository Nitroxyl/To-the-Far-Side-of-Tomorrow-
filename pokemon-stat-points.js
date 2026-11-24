// Santara's Pokémon Champions-inspired stat training.
// The GM awards trainer-wide Training Points (TP). Each Pokémon separately
// allocates up to min(TP, 66) Stat Points (SP), maximum 32 per stat.
// Each 3 trainer TP unlocks one Pokémon level starting from level 15.
export const SP_STATS=Object.freeze(['hp','atk','def','spa','spd','spe']);
export const SP_LABELS=Object.freeze({hp:'HP',atk:'Attack',def:'Defense',spa:'Sp. Atk',spd:'Sp. Def',spe:'Speed'});
export const SP_TOTAL_CAP=66,SP_STAT_CAP=32,TP_LEVEL_STEP=3,TP_START_LEVEL=15,TP_MAX=255;
export function zeroStatPoints(){return {hp:0,atk:0,def:0,spa:0,spd:0,spe:0};}
export function trainingPoints(value){
 const n=Number(value);
 return Number.isInteger(n)&&n>=0&&n<=TP_MAX?n:0;
}
export function unlockedSp(tp){return Math.min(SP_TOTAL_CAP,trainingPoints(tp));}
export function unlockedLevel(tp){return Math.min(100,TP_START_LEVEL+Math.floor(trainingPoints(tp)/TP_LEVEL_STEP));}
export function parseStatPoints(value){
 const ret=zeroStatPoints();
 if(value&&typeof value==='object'&&!Array.isArray(value))
   for(const stat of SP_STATS)if(Number.isInteger(value[stat])&&value[stat]>=0&&value[stat]<=SP_STAT_CAP)ret[stat]=value[stat];
 return ret;
}
export function spentSp(value){
 const alloc=parseStatPoints(value);
 return SP_STATS.reduce((total,stat)=>total+alloc[stat],0);
}
export function validateStatPoints(value,budget=SP_TOTAL_CAP){
 if(!value||typeof value!=='object'||Array.isArray(value))return 'Stat Point allocation is missing.';
 if(Object.keys(value).sort().join('|')!==[...SP_STATS].sort().join('|'))return 'Provide exactly six Pokémon stats.';
 for(const stat of SP_STATS){
  if(!Number.isInteger(value[stat])||value[stat]<0||value[stat]>SP_STAT_CAP)
   return SP_LABELS[stat]+' must have 0–32 SP.';
 }
 if(spentSp(value)>Math.min(SP_TOTAL_CAP,Math.max(0,Number(budget)||0)))
   return 'Allocated SP exceeds this Trainer’s unlocked SP budget.';
 return '';
}
// Champions EV equivalence for the existing standard Gen 9 damage engine:
// 1 SP = 4 EVs; each subsequent SP adds 8 EVs (32 SP = 252 EVs).
export function spToEv(sp){
 const n=Number(sp)||0;
 return Number.isInteger(n)&&n>0?Math.min(252,8*n-4):0;
}
export function spToEvs(points){
 const a=parseStatPoints(points);
 return Object.fromEntries(SP_STATS.map(stat=>[stat,spToEv(a[stat])]));
}
export function hpForTraining(baseHP,level,hpSP=0){
 const hp=Number(baseHP),lvl=Number(level);
 if(!Number.isInteger(hp)||hp<1||hp>255||!Number.isInteger(lvl)||lvl<1||lvl>100)
   throw Error('Valid base HP and Pokémon level (1–100) are required.');
 if(hp===1)return 1;
 const allocated=Number(hpSP);
 if(!Number.isInteger(allocated)||allocated<0||allocated>SP_STAT_CAP)
   throw Error('HP SP must be between 0 and 32.');
 return Math.floor(((2*hp+31+Math.floor(spToEv(allocated)/4))*lvl)/100)+lvl+10;
}
