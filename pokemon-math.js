// Santara Combat V5.3. The V5.2 stat offense/defense tiers remain unchanged.
// Damage = dice × offense × level × STAB × type effectiveness × defense.
// Every five Pokémon levels correspond to one D&D level (maximum 20).
export const statKeys=['hp','attack','defense','specialAttack','specialDefense','speed'];
export const statLabels=['HP','Attack','Defense','Sp. Attack','Sp. Defense','Speed'];
// The final two tiers are deliberately wider than 20 points.
export const V52_TIERS=Object.freeze([
 {min:0,max:19,offense:0.6,defense:1.7},
 {min:20,max:39,offense:0.8,defense:1.3},
 {min:40,max:59,offense:1.0,defense:1.05},
 {min:60,max:79,offense:1.2,defense:0.9},
 {min:80,max:99,offense:1.4,defense:0.75},
 {min:100,max:119,offense:1.6,defense:0.65},
 {min:120,max:139,offense:1.8,defense:0.55},
 {min:140,max:159,offense:2.0,defense:0.5},
 {min:160,max:179,offense:2.2,defense:0.45},
 {min:180,max:199,offense:2.4,defense:0.4},
 {min:200,max:249,offense:2.75,defense:0.35},
 {min:250,max:Infinity,offense:3.25,defense:0.3}
]);
export function validStats(stats){
 return statKeys.every(k=>Number.isInteger(Number(stats?.[k]))&&Number(stats[k])>=1&&Number(stats[k])<=255);
}
export function statTier(v){return V52_TIERS.find(t=>Number(v)>=t.min&&Number(v)<=t.max)||V52_TIERS[0]}
export function statBand(v){const t=statTier(v);return t.max===Infinity?`${t.min}+`:`${t.min}–${t.max}`;}
export function tierMultiplier(v,bands=null,kind='offense'){
 const tier=statTier(v),index=V52_TIERS.indexOf(tier);
 // Optional GM override; missing positions use the published V5.2 defaults.
 return Array.isArray(bands)&&typeof bands[index]==='number'&&
 Number.isFinite(bands[index])&&bands[index]>0?bands[index]:tier[kind];
}
// V5.3: D&D progression is calculated from the saved Pokémon level.
// A full step only occurs every five Pokémon levels, but damage/HP grow
// smoothly every individual level, avoiding five-level power plateaus.
function boundedLevel(level){
 const number=Number(level);
 return Number.isFinite(number)?Math.min(100,Math.max(1,number)):1;
}
export function dndLevel(level){return Math.ceil(boundedLevel(level)/5);}
export function proficiencyBonus(level){return 2+Math.floor((dndLevel(level)-1)/4);}
export function levelDamageMultiplier(level){return 1+boundedLevel(level)/100;}
// Santara grid: one square is 5 feet. The species' *effective* Speed
// determines movement; move/ability speed changes can alter that input.
export function movementSquares(speed){
 const value=Number(speed);
 return Math.min(12,Math.max(4,4+Math.floor((Number.isFinite(value)?Math.max(0,value):0)/30)));
}
export function movementFeet(speed){return 5*movementSquares(speed);}
export function maxHpV53(stats,level){
 const hp=Number(stats?.hp);
 if(!Number.isInteger(hp)||hp<1||hp>255)throw Error('A valid Pokémon base HP is required to calculate V5.3 HP.');
 return Math.floor(8+(4+Math.floor(hp/15))*(1+(boundedLevel(level)-1)/5));
}
// Apply the difference in maximum HP, preserving the damage already taken.
// A fainted Pokémon stays fainted rather than reviving on a level-up.
export function hpAfterMaxChange(currentHp,oldMax,newMax){
 const previous=Number(oldMax),next=Number(newMax),current=Number(currentHp);
 if(!Number.isInteger(next)||next<1||next>3000)throw Error('New maximum HP must be 1–3000.');
 if(!Number.isFinite(previous)||previous<1) return Math.max(0,Math.min(next,Number.isFinite(current)?current:next));
 if(!Number.isFinite(current)||current<=0)return 0;
 return Math.max(0,Math.min(next,Math.round(current+next-previous)));
}

// Legacy V4 formula retained for migration comparisons, not new assignments.

export function maxHpV4Baseline(stats,level){
 return 6+3*Number(level)+Math.floor(Number(stats.hp)/2);
}
export function combatSummary(mon,rules=null){
 const s=mon.baseStats||{},off=rules?.offenseBands,def=rules?.defenseBands;
 const level=dndLevel(mon.level),pb=proficiencyBonus(mon.level);
 const levelMultiplier=levelDamageMultiplier(mon.level);
 const physicalOffense=tierMultiplier(s.attack,off,'offense');
 const specialOffense=tierMultiplier(s.specialAttack,off,'offense');
 const acOverride=Number.isInteger(rules?.universalAc)?rules.universalAc:null;
 return {
  hp:mon.maxHp,
  pokemonLevel:boundedLevel(mon.level),
  dndLevel:level,
  proficiencyBonus:pb,
  levelDamageMultiplier:levelMultiplier,
  suggestedMaxHp:validStats(s)?maxHpV53(s,mon.level):null,
  physicalOffenseBand:statBand(s.attack),
  specialOffenseBand:statBand(s.specialAttack),
  physicalDefenseBand:statBand(s.defense),
  specialDefenseBand:statBand(s.specialDefense),
  effectiveSpeed:s.speed,
  movementSquares:movementSquares(s.speed),
  movementFeet:movementFeet(s.speed),
  universalAC:acOverride??(11+pb),
  acOverridden:acOverride!==null,
  universalAcFormula:'11 + proficiency bonus',
  physicalOffenseMultiplier:physicalOffense,
  specialOffenseMultiplier:specialOffense,
  levelledPhysicalOffenseMultiplier:physicalOffense*levelMultiplier,
  levelledSpecialOffenseMultiplier:specialOffense*levelMultiplier,
  physicalDefenseMultiplier:tierMultiplier(s.defense,def,'defense'),
  specialDefenseMultiplier:tierMultiplier(s.specialDefense,def,'defense')
 };
}
export function fromPokeApi(p){
 const s=Object.fromEntries((p.stats||[]).map(x=>[x.stat.name,x.base_stat]));
 const baseStats={hp:s.hp,attack:s.attack,defense:s.defense,
  specialAttack:s['special-attack'],specialDefense:s['special-defense'],speed:s.speed};
 if(!validStats(baseStats))throw Error('PokéAPI returned incomplete base stats.');
 return {
  speciesKey:p.name,parentSpeciesKey:p.species?.name||p.name,speciesName:p.name.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),
  baseStats,types:(p.types||[]).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
  abilities:(p.abilities||[]).map(x=>x.ability.name),
  knownMoves:(p.moves||[]).map(x=>x.move.name),
  spriteUrl:p.sprites?.other?.['official-artwork']?.front_default||p.sprites?.front_default||'',
  spriteData:'',source:'official'
 };
}