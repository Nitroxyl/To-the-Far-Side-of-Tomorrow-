// Santara V5.2 deterministic damage calculator.
// Damage = move dice × attack tier × STAB × matchup × defense tier ×
// optional battle modifiers, rounded ONCE at the end. The saved V5.2 tables
// override published defaults. Official move BP does not imply a damage-dice
// expression until the campaign defines a separate BP-to-dice progression.
import {tierMultiplier,statBand} from './pokemon-math.js';

export const DAMAGE_TYPES=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const CHART={
 normal:{rock:.5,ghost:0,steel:.5},
 fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
 water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},
 electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
 grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
 ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
 fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
 poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},
 ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
 flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},
 psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
 bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
 rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},
 ghost:{normal:0,psychic:2,ghost:2,dark:.5},
 dragon:{dragon:2,steel:.5,fairy:0},
 dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
 steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
 fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
};
const norm=v=>String(v||'').trim().toLowerCase();
const finite=(v,fallback=1)=>v===''||v===null||v===undefined?fallback:Number(v);
const asTypes=types=>[...new Set((Array.isArray(types)?types:[]).map(norm).filter(t=>DAMAGE_TYPES.includes(t)))];

export function parseDice(expression){
 const source=String(expression||'').replace(/\s+/g,'').toLowerCase();
 if(!source || !/^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/.test(source))
  throw Error('Enter damage dice such as 3d8, 2d10+2 or a fixed number like 15.');
 const terms=[],pieces=source.match(/[+-]?(?:\d*d\d+|\d+)/g)||[];
 let min=0,max=0,average=0,count=0;
 for(const piece of pieces){
  const sign=piece.startsWith('-')?-1:1;
  const body=piece.replace(/^[+-]/,'');
  if(body.includes('d')){
   if(sign<0)throw Error('Only flat numbers may be subtracted from the dice expression.');
   const [left,right]=body.split('d'),n=Number(left||1),faces=Number(right);
   if(!Number.isInteger(n)||n<1||n>40||!Number.isInteger(faces)||faces<2||faces>100)
    throw Error('Each die group must use 1–40 dice with 2–100 faces.');
   count+=n;
   if(count>60)throw Error('Use no more than 60 dice total.');
   min+=n;max+=n*faces;average+=n*(faces+1)/2;
   terms.push({kind:'dice',count:n,faces});
  }else{
   const value=Number(body)*sign;
   if(!Number.isSafeInteger(value)||Math.abs(value)>10000)throw Error('Flat dice adjustment is out of range.');
   min+=value;max+=value;average+=value;
   terms.push({kind:'flat',value});
  }
 }
 return {expression:source,terms,min,max,average};
}
export function rollDice(expression,random=Math.random){
 const dice=typeof expression==='string'?parseDice(expression):expression;
 let sum=0;
 for(const term of dice.terms){
  if(term.kind==='flat'){sum+=term.value;continue}
  for(let i=0;i<term.count;i++){
   const v=Number(random());
   if(!Number.isFinite(v)||v<0||v>=1)throw Error('Dice random source must return a number from 0 to less than 1.');
   sum+=Math.floor(v*term.faces)+1;
  }
 }
 return sum;
}
export function typeEffectiveness(moveType,targetTypes,options={}){
 const type=norm(moveType),targets=asTypes(targetTypes);
 const ignoreFireResistance=Boolean(options.calamitousSun)&&type==='fire';
 const factors=targets.map(t=>{
  const original=CHART[type]?.[t]??1;
  return {type:t,original,applied:ignoreFireResistance&&original>0&&original<1?1:original};
 });
 return {multiplier:factors.reduce((a,b)=>a*b.applied,1),factors,calamitousSun:ignoreFireResistance};
}
export function stabMultiplier(attacker,moveType){
 const t=norm(moveType),original=asTypes(attacker?.originalTypes||attacker?.types),tera=attacker?.tera===true;
 const adaptability=norm(attacker?.ability)==='adaptability';
 let result=1;
 if(tera && norm(attacker?.teraType)===t){
  result=original.includes(t)?2:1.5;
 }else if(original.includes(t)){result=1.5}
 if(adaptability&&result===1.5)result=2;
 return result;
}
export function weatherMultiplier(weather,moveType){
 const w=norm(weather),t=norm(moveType);
 if(w==='sun')return t==='fire'?1.5:t==='water'?.5:1;
 if(w==='rain')return t==='water'?1.5:t==='fire'?.5:1;
 return 1;
}
export function heldItemBonus(attacker,category){
 const item=norm(attacker?.heldItem);
 if(item==='life orb')return {flat:2,note:'Life Orb +2 damage; 10% maximum-HP recoil after dealing damage'};
 if(item==='choice band'&&category==='physical')return {flat:3,note:'Choice Band +3 once per physical move'};
 if(item==='choice specs'&&category==='special')return {flat:3,note:'Choice Specs +3 once per special move'};
 return {flat:0,note:''};
}
export function calculateDamage({
 attacker,defender,move,dice,rolledDice=null,rules=null,weather='none',
 critical=false,burned=false,otherMultiplier=1,flatBonus=0,
 stabOverride=null,typeOverride=null,rounding='floor'
}){
 if(!attacker?.baseStats||!defender?.baseStats)throw Error('Choose an attacker and defender with base stats.');
 const category=norm(move?.category),type=norm(move?.type);
 if(!DAMAGE_TYPES.includes(type))throw Error('Choose a valid move type.');
 if(!['physical','special','status'].includes(category))throw Error('Choose Physical, Special or Status.');
 if(category==='status')return {status:true,moveType:type,category,message:'Status move: there is no direct damage roll to calculate.'};
 const parsed=typeof dice==='string'?parseDice(dice):dice;
 if(!parsed?.terms)throw Error('Provide the move damage dice.');
 if(rolledDice!==null&&(!Number.isFinite(Number(rolledDice))||Number(rolledDice)<0))throw Error('Invalid rolled dice total.');
 const attackKey=category==='physical'?'attack':'specialAttack',defenseKey=category==='physical'?'defense':'specialDefense';
 const attackStat=Number(attacker.baseStats[attackKey]),defenseStat=Number(defender.baseStats[defenseKey]);
 if(!Number.isFinite(attackStat)||!Number.isFinite(defenseStat))throw Error('Attacker and defender must have valid offense/defense stats.');
 const off=tierMultiplier(attackStat,rules?.offenseBands,'offense'),def=tierMultiplier(defenseStat,rules?.defenseBands,'defense');
 const matchup=typeEffectiveness(type,defender.types,{calamitousSun:norm(attacker.ability)==='calamitous sun'});
 const numericOverride=(value,description)=>{if(value===null||value===undefined||value==='')return null;
  const n=Number(value);if(!Number.isFinite(n)||n<0||n>10)throw Error(description+' override must be between 0 and 10.');return n;};
 const stab=numericOverride(stabOverride,'STAB')??stabMultiplier(attacker,type);
 const effectiveness=numericOverride(typeOverride,'Type')??matchup.multiplier;
 const w=weatherMultiplier(weather,type),crit=critical?2:1;
 const burn=burned&&category==='physical'&&norm(attacker.ability)!=='guts'?.5:1;
 const other=finite(otherMultiplier),manualFlat=finite(flatBonus,0);
 if(!Number.isFinite(other)||other<0||other>100)throw Error('Other multiplier must be from 0 to 100.');
 if(!Number.isFinite(manualFlat)||manualFlat<-10000||manualFlat>10000)throw Error('Flat bonus must be between -10,000 and 10,000.');
 const item=heldItemBonus(attacker,category);
 const total=off*def*stab*effectiveness*w*crit*burn*other;
 const round=x=>rounding==='nearest'?Math.round(x):Math.floor(x);
 const finish=raw=>(effectiveness===0||total===0)?0:Math.max(0,round(Math.max(0,raw)*total+item.flat+manualFlat));
 const min=finish(parsed.min),max=finish(parsed.max),average=finish(parsed.average);
 const rolled=rolledDice===null?null:finish(Number(rolledDice));
 const hp=Number(defender.currentHp)||0,maxHp=Number(defender.maxHp)||0;
 return {
  status:false,category,moveType:type,moveName:move.name||'',dice:parsed,
  attackStat,defenseStat,attackBand:statBand(attackStat),defenseBand:statBand(defenseStat),
  offense:off,defense:def,stab,typeMultiplier:effectiveness,matchup,weatherMultiplier:w,
  criticalMultiplier:crit,burnMultiplier:burn,otherMultiplier:other,flatBonus:item.flat+manualFlat,
  itemNote:item.note,totalMultiplier:total,min,average,max,rolled,
  hp,maxHp,percentMaxHp:maxHp>0?(average/maxHp)*100:null,
  possibleKo:hp>0&&max>=hp,guaranteedKo:hp>0&&min>=hp,
  roundedBy:rounding==='nearest'?'nearest whole number':'down'
 };
}
