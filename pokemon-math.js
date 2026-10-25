// Santara battle system V5.2. Damage = dice × offense × STAB × type × defense.
// Universal AC = 11 + proficiency bonus (PB). PB is determined by the campaign,
// not inferred from a Pokemon's 1-100 species level.
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
// Retained only as an editable placeholder; the exact V5.2 HP scale may differ.
export function maxHpV4Baseline(stats,level){
 return 6+3*Number(level)+Math.floor(Number(stats.hp)/2);
}
export function combatSummary(mon,rules=null){
 const s=mon.baseStats||{},off=rules?.offenseBands,def=rules?.defenseBands;
 return {
  hp:mon.maxHp,
  physicalOffenseBand:statBand(s.attack),
  specialOffenseBand:statBand(s.specialAttack),
  physicalDefenseBand:statBand(s.defense),
  specialDefenseBand:statBand(s.specialDefense),
  effectiveSpeed:s.speed,
  universalAC:Number.isInteger(rules?.universalAc)?rules.universalAc:null,
  universalAcFormula:'11 + proficiency bonus',
  physicalOffenseMultiplier:tierMultiplier(s.attack,off,'offense'),
  specialOffenseMultiplier:tierMultiplier(s.specialAttack,off,'offense'),
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
  speciesKey:p.name,speciesName:p.name.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),
  baseStats,types:(p.types||[]).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
  abilities:(p.abilities||[]).map(x=>x.ability.name),
  knownMoves:(p.moves||[]).map(x=>x.move.name),
  spriteUrl:p.sprites?.other?.['official-artwork']?.front_default||p.sprites?.front_default||'',
  spriteData:'',source:'official'
 };
}