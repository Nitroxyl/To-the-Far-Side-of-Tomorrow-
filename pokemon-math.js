// Santara Pokémon calculations: V5.2 replaced the old defense-based AC.
 // Exact V5.2 multipliers are not recorded here, so never invent values.
export const statKeys = ['hp','attack','defense','specialAttack','specialDefense','speed'];
export const statLabels = ['HP','Attack','Defense','Sp. Attack','Sp. Defense','Speed'];
export function validStats(input) {
  return statKeys.every(k=>Number.isInteger(Number(input?.[k])) && Number(input[k])>=1 && Number(input[k])<=255);
}
export function maxHpV4Baseline(stats,level) {
  return 6+3*Number(level)+Math.floor(Number(stats.hp)/2);
}
export function statBand(value) {
  const start = Math.floor(Math.max(0,Number(value)||0)/20)*20;
  return `${start}–${start+19}`;
}
export function combatSummary(mon) {
  const stats=mon.baseStats||{};
  return {
    hp:mon.maxHp,
    physicalOffenseBand:statBand(stats.attack),
    specialOffenseBand:statBand(stats.specialAttack),
    physicalDefenseBand:statBand(stats.defense),
    specialDefenseBand:statBand(stats.specialDefense),
    effectiveSpeed:stats.speed,
    universalAC:null // V5.2 exact value has not been supplied. Never use superseded V4 AC.
  };
}
export function fromPokeApi(p) {
  const s=Object.fromEntries((p.stats||[]).map(x=>[x.stat.name,x.base_stat]));
  const baseStats={hp:s.hp,attack:s.attack,defense:s.defense,specialAttack:s['special-attack'],specialDefense:s['special-defense'],speed:s.speed};
  if(!validStats(baseStats))throw new Error('PokéAPI returned incomplete base stats.');
  return {
    speciesKey:p.name, speciesName:p.name.split('-').map(x=>x[0].toUpperCase()+x.slice(1)).join(' '),
    baseStats,types:(p.types||[]).sort((a,b)=>a.slot-b.slot).map(x=>x.type.name),
    abilities:(p.abilities||[]).map(x=>x.ability.name),
    knownMoves:(p.moves||[]).map(x=>x.move.name),
    spriteUrl:p.sprites?.other?.['official-artwork']?.front_default||p.sprites?.front_default||'',
    spriteData:'',source:'official'
  };
}
