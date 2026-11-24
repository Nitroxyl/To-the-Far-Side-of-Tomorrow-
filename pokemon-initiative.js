// Santara field-encounter initiative reference.
// Normal trainer battles still follow move priority and cartridge effective Speed.
// Field initiative: d20 + floor(effective Speed / 10).
// Derived from the saved level, form, Nature, SP, held item and paralysis.
// Temporary effects (Speed stages, Tailwind, Trick Room) are preview-only.
import {NATURE_EFFECTS,natureName} from './pokemon-natures.js';
import {parseStatPoints,spToEv} from './pokemon-stat-points.js';

const halfSpeedItems=new Set([
 'ironball','machobrace','poweranklet','powerband','powerbelt',
 'powerbracer','powerlens','powerweight'
]);
const slug=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
const integer=value=>Number.isInteger(Number(value))?Number(value):null;

export function speedNatureMultiplier(nature){
 const effects=NATURE_EFFECTS[natureName(nature)]||[];
 return effects[0]==='Spe'?1.1:effects[1]==='Spe'?0.9:1;
}
export function speedStat(mon){
 const base=integer(mon?.baseStats?.speed),level=integer(mon?.level);
 if(base===null||base<1||base>255||level===null||level<1||level>100)return null;
 const training=parseStatPoints(mon?.statPoints);
 const ev=spToEv(training.spe);
 const raw=Math.floor(((2*base+31+Math.floor(ev/4))*level)/100)+5;
 return Math.max(1,Math.floor(raw*speedNatureMultiplier(mon?.nature)));
}
export function fieldInitiative(mon,{stages=0,tailwind=false,trickRoom=false,paralyzed=null}={}){
 const statSpeed=speedStat(mon);
 if(statSpeed===null)return null;
 const stage=integer(stages);
 if(stage===null||stage< -6||stage>6)throw Error('Speed stage must be between -6 and +6.');
 const stageRatio=stage>=0?(2+stage)/2:2/(2-stage);
 const key=slug(mon?.heldItem);
 const itemFactor=key==='choicescarf'?1.5:halfSpeedItems.has(key)?0.5:1;
 const affectedByParalysis=paralyzed===null
   ? slug(mon?.status)==='paralyzed' :Boolean(paralyzed);
 // Pokémon stat stages, held items, and field effects change effective Speed;
 // Trick Room changes ordering, but not the effective Speed or d20 bonus.
 const stageSpeed=Math.max(1,Math.floor(statSpeed*stageRatio));
 const itemSpeed=Math.max(1,Math.floor(stageSpeed*itemFactor));
 const statusSpeed=affectedByParalysis?Math.max(1,Math.floor(itemSpeed/2)):itemSpeed;
 const effectiveSpeed=tailwind?statusSpeed*2:statusSpeed;
 return {
  baseSpeed:Number(mon.baseStats.speed),statSpeed,effectiveSpeed,
  bonus:Math.floor(effectiveSpeed/10),stages:stage,
  speedSp:parseStatPoints(mon.statPoints).spe,
  nature:natureName(mon.nature),heldItem:mon.heldItem||'',
  itemFactor,paralyzed:affectedByParalysis,tailwind:!!tailwind,
  trickRoom:!!trickRoom,
  speedOrdering:trickRoom?'Slower Pokémon move first within each priority bracket.':'Faster Pokémon move first within each priority bracket.'
 };
}
export function initiativeText(result){
 return result?'+'+result.bonus:'—';
}
