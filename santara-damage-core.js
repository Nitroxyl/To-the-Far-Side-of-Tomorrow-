// Santara V6 damage adapter. Read-only: never modifies a saved Pokemon.
// Underlying cartridge rules: @smogon/calc 0.12.0 (Generation 9).
export const STAT_IDS = ['hp','atk','def','spa','spd','spe'];
export const PERFECT_IVS = Object.freeze({hp:31,atk:31,def:31,spa:31,spd:31,spe:31});
export const NO_EVS = Object.freeze({hp:0,atk:0,def:0,spa:0,spd:0,spe:0});
const STAT_MAP = {hp:'hp',attack:'atk',defense:'def',specialAttack:'spa',specialDefense:'spd',speed:'spe'};
const knownTypes = new Set(['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy']);
const id = value => String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const nice = value => String(value||'').trim().replace(/\b[a-z]/g,c=>c.toUpperCase());
const bound = (value,min,max,fallback) => Number.isFinite(Number(value))?Math.max(min,Math.min(max,Math.trunc(Number(value)))):fallback;
export const titleType = type => nice(type);
export function statTable(base) {
  if(!base)return null;
  const out={};
  for(const [original,target] of Object.entries(STAT_MAP)) {
    const value=Number(base[original]);
    if(!Number.isFinite(value)||value<1||value>255)return null;
    out[target]=Math.round(value);
  }
  return out;
}
export function legalEvs(input={}) {
  const evs={};
  for(const s of STAT_IDS)evs[s]=bound(input[s],0,252,0);
  if(Object.values(evs).reduce((sum,v)=>sum+v,0)>510)throw Error('Total EVs cannot exceed 510.');
  return evs;
}
export function statusId(value) {
  return ({Burned:'brn',Paralyzed:'par',Poisoned:'psn','Badly poisoned':'tox',Asleep:'slp',Frozen:'frz',brn:'brn',par:'par',psn:'psn',tox:'tox',slp:'slp',frz:'frz'})[value]||'';
}
export function effectiveForm(source,previewMega=false) {
  if(!source)return null;
  const form=source.megaForm && (previewMega || source.megaActive) ? source.megaForm:null;
  return {...source,
    name:form?.name || source.speciesName || source.name || source.speciesKey,
    baseStats:form?.baseStats || source.baseStats,
    types:form?.types || source.types || [],
    ability:form?.ability || source.ability || source.abilities?.[0] || '',
    mega:!!form
  };
}
export function matchup(gen,attackingType,defendingTypes) {
  const data=gen.types.get(id(attackingType));
  return (defendingTypes||[]).reduce((n,t)=>n*(data?.effectiveness?.[titleType(t)]??1),1);
}
function isCustomAbility(ability,definitions) {
  return (definitions||[]).some(x=>id(x.name)===id(ability));
}
function customMoveDefinition(move,definitions) {
  return (definitions||[]).find(x=>id(x.name)===id(move))||null;
}
function validatedTypes(types) {
  const list=(types||[]).map(titleType).filter(t=>knownTypes.has(t));
  if(!list.length||list.length>2)throw Error('Species needs one or two valid Pokémon types.');
  return list;
}
export function makePokemon(calc,gen,source,settings={},customAbilities=[]) {
  const form=effectiveForm(source,settings.mega);
  if(!form)throw Error('Choose both an attacker and a defender.');
  const name=String(form.name||'').trim();
  const official=gen.species.get(id(source.speciesKey||name))||gen.species.get(id(name));
  const baseStats=statTable(form.baseStats)||official?.baseStats;
  if(!baseStats)throw Error('Missing stats for '+name+'. Select a known species or registered custom Pokémon.');
  const types=validatedTypes(form.types?.length?form.types:official?.types);
  const ability=String(settings.ability ?? form.ability ?? official?.abilities?.[0] ?? '').trim();
  const isCustom=isCustomAbility(ability,customAbilities);
  const warnings=[];
  // The calculator recognizes official abilities. Custom effects are handled below.
  let engineAbility=ability;
  if(id(ability)==='perfectedninjutsu')engineAbility='Technician';
  if(id(ability)==='rootaccess')engineAbility='Levitate';
  if(isCustom && !gen.abilities.get(id(engineAbility)) && !['perfectedninjutsu','rootaccess'].includes(id(ability)))engineAbility='';
  const level=bound(settings.level ?? source.level,1,100,50);
  const rawItem=String(settings.item ?? source.heldItem ?? '').trim();
  const item=gen.items.get(id(rawItem))?.name || '';
  if(rawItem&&!item && !/ite|crystal/i.test(rawItem))warnings.push('Custom item '+rawItem+' has no encoded damage effect.');
  const options={
    name,level,
    gender:'M',
    nature:settings.nature || 'Serious',
    ivs:{...PERFECT_IVS},
    evs:legalEvs(settings.evs),
    boosts:{...NO_EVS,...settings.boosts},
    ability:engineAbility||undefined,
    item,
    teraType:settings.tera ? titleType(settings.teraType||source.teraType||types[0]) : undefined,
    status:statusId(settings.status ?? source.status),
    overrides:{
      name,baseStats,types,weightkg:official?.weightkg||100,
      abilities:{0:engineAbility||ability||''}
    },
    isDynamaxed:!!settings.dynamax
  };
  const poke=new calc.Pokemon(gen,official?.name||name,options);
  const hpPercent=bound(settings.hpPercent,1,100,100);
  poke.originalCurHP=Math.max(1,Math.ceil(poke.rawStats.hp*hpPercent/100));
  if(id(ability)==='bastionfurnace'){
    poke.boosts.def=Math.max(0,poke.boosts.def||0);
    poke.boosts.spd=Math.max(0,poke.boosts.spd||0);
  }
  return {pokemon:poke,name,ability,isCustom,types,hpPercent,warnings,form};
}
export function makeMove(calc,gen,moveName,customMoves=[],attackAbility='',forcedHits=0,critical=false) {
  const name=String(moveName||'').trim();
  if(!name)throw Error('Select a damaging move.');
  const custom=customMoveDefinition(name,customMoves);
  const official=gen.moves.get(id(name));
  if(!official&&!custom)throw Error('Move '+name+' is not recognized. Register it in the custom move catalogue first.');
  const info=custom||official;
  if(info.category==='Status')throw Error(name+' is a status move, not a damaging attack.');
  const bp=Number(custom?.power ?? official?.basePower);
  if(!Number.isFinite(bp)||bp<=0)throw Error(name+' has variable or zero Base Power. This move needs a specific power rule before calculating.');
  const overrides=custom?{
    name:custom.name,type:titleType(custom.type),
    category:custom.category,basePower:bp,
    accuracy:custom.accuracy??100,
    target:custom.target||(['infernalsweep','schradesend'].includes(id(custom.name))?'allAdjacentFoes':'normal'),priority:0,
    flags:{contact:custom.contact?1:0, ...Object.fromEntries((custom.traits||[]).map(trait=>[trait,1]))}
  }:undefined;
  const multihit=official?.multihit;
  const maxHits=Array.isArray(multihit)?multihit[1]:typeof multihit==='number'?multihit:1;
  const perfected=id(attackAbility)==='perfectedninjutsu';
  const count=Number(forcedHits)>0?bound(forcedHits,1,10,1):(perfected?maxHits:undefined);
  const move=new calc.Move(gen,official?.name||name,{
    overrides,ability:perfected?'Technician':attackAbility,
    hits:count,isCrit:!!critical
  });
  // Skill Link + Technician combination: the calculator gets max hits while
  // treating the attacker's effective ability as Technician, preserving its BP rules.
  if(perfected && maxHits>1 && !forcedHits)move.hits=maxHits;
  return {move,custom,basePower:bp,accuracy:custom?.accuracy??official?.accuracy??null};
}
function damageRolls(value) {
  if(typeof value==='number')return [value];
  if(!Array.isArray(value))return [0];
  if(typeof value[0]==='number')return value;
  // Multi-hit: correlated roll indices; returned min/max remain accurate.
  return Array.from({length:16},(_,i)=>value.reduce((sum,rolls)=>sum+(rolls[i]??rolls[rolls.length-1]??0),0));
}
function safeDescription(result){try{return result.fullDesc();}catch{return '';}}
export function computeDamage(calc,{attacker,defender,moveName,attackerSettings={},defenderSettings={},
  customMoves=[],customAbilities=[],weather='Auto',terrain='',gameType='Singles',
  reflect=false,lightScreen=false,auroraVeil=false,helpingHand=false,critical=false,hits=0,
  exposed=false}={}) {
  if(!calc?.Generations?.get||!calc?.calculate)throw Error('Pokémon damage engine unavailable. Reload when connected.');
  const gen=calc.Generations.get(9);
  const a=makePokemon(calc,gen,attacker,attackerSettings,customAbilities);
  const d=makePokemon(calc,gen,defender,defenderSettings,customAbilities);
  const chosen=makeMove(calc,gen,moveName,customMoves,a.ability,hits,critical);
  const warnings=[...a.warnings,...d.warnings],notes=[];
  if(a.isCustom && !['perfectedninjutsu','rootaccess','kingdomsend','tempestcrown','moltenedge','bastionfurnace','apexpredator','swordofruin','aurorachorus'].includes(id(a.ability)))warnings.push('Attacker ability '+a.ability+' is not modeled.');
  if(d.isCustom && !['perfectedninjutsu','rootaccess','kingdomsend','tempestcrown','moltenedge','bastionfurnace','apexpredator','swordofruin','aurorachorus'].includes(id(d.ability)))warnings.push('Defender ability '+d.ability+' is not modeled.');
  let activeWeather=weather;
  if(weather==='Auto'){
    activeWeather=([a,d].some(p=>id(p.ability)==='kingdomsend'))?'Calamitous Sun':
      ([a,d].some(p=>id(p.ability)==='tempestcrown'))?'Royal Tempest':'Clear';
  }
  const standardWeather=activeWeather==='Calamitous Sun'?'Sun':
    activeWeather==='Royal Tempest'?'':activeWeather==='Clear'?'':activeWeather;
  const field=new calc.Field({
    weather:standardWeather||undefined,terrain:terrain||undefined,gameType,
    isSwordOfRuin:id(a.ability)==='swordofruin'&&id(d.ability)!=='swordofruin',
    attackerSide:{isHelpingHand:helpingHand},
    defenderSide:{isReflect:reflect&&id(moveName)!=='schradebreaker',isLightScreen:lightScreen&&id(moveName)!=='schradebreaker',
      isAuroraVeil:(auroraVeil||id(d.ability)==='aurorachorus')&&id(moveName)!=='schradebreaker'}
  });
  if(chosen.custom?.description?.match(/charge|turn to charge/i))warnings.push('Charge-turn restrictions are not simulated; this result is the damaging turn only.');
  if(chosen.custom?.description)warnings.push('Custom move secondary effects, recoil and once-per-battle restrictions are resolved at the table; this result is damage only.');
  if(id(moveName)==='psycannon')notes.push('Psycannon: apply the user’s Speed drop after the attack.');
  if(id(moveName)==='schradebreaker'&&(reflect||lightScreen||auroraVeil))notes.push('Schradebreaker destroys screens before damage.');
  const match=matchup(gen,chosen.move.type,d.pokemon.teraType?[d.pokemon.teraType]:d.pokemon.types);
  let extra=1;
  if(activeWeather==='Calamitous Sun'){
    if(chosen.move.type==='Water'){extra=0;notes.push('Calamitous Sun blocks Water attacks.');}
    if(chosen.move.type==='Fire'&&match>0&&match<1){extra*=1/match;notes.push('Kingdom’s End neutralizes Fire resistances.');}
  }
  if(activeWeather==='Royal Tempest'&&chosen.move.type==='Electric'){extra*=1.3;notes.push('Royal Tempest: Electric damage ×1.3.');}
  if(id(a.ability)==='moltenedge'&&(chosen.move.type==='Fire'||!!chosen.move.flags?.slicing)){
    extra*=1.3;notes.push('Molten Edge: damage ×1.3.');}
  if(id(a.ability)==='bastionfurnace'&&a.hpPercent<=50&&['Fire','Psychic'].includes(chosen.move.type)){
    extra*=1.3;notes.push('Bastion Furnace: low-HP damage ×1.3.');}
  if(id(d.ability)==='bastionfurnace'&&d.hpPercent>50&&match>1){
    extra*=0.75;notes.push('Bastion Furnace: super-effective damage ×0.75.');}
  if(id(a.ability)==='apexpredator'&&chosen.move.category==='Physical'&&d.hpPercent<100){
    extra*=1.3;notes.push('Apex Predator: injured target physical damage ×1.3.');}
  if(exposed&&['Normal','Electric'].includes(chosen.move.type)){
    extra*=1.2;notes.push('Exposed: Normal/Electric damage ×1.2 (provisional).');}
  if(id(a.ability)==='perfectedninjutsu')notes.push('Perfected Ninjutsu: Technician damage and maximum multi-hit count.');
  if(activeWeather==='Calamitous Sun'||activeWeather==='Royal Tempest'||extra!==1)notes.push('Custom multipliers apply after cartridge damage rolls; game-internal rounding may differ by 1 HP.');
  if(a.form.mega&&attackerSettings.tera)warnings.push('Mega + Tera is a Santara combination; official mechanics may not cover every interaction.');
  const result=calc.calculate(gen,a.pokemon,d.pokemon,chosen.move,field);
  let rolls=damageRolls(result.damage).map(v=>Math.max(0,Math.floor(v*extra)));
  const min=Math.min(...rolls),max=Math.max(...rolls);
  const defenderHP=d.pokemon.maxHP();
  const currentDefHP=d.pokemon.curHP();
  const koChance=rolls.filter(v=>v>=currentDefHP).length/rolls.length*100;
  return {
    min,max,rolls,defenderHP,currentDefHP,koChance,
    minPercent:100*min/defenderHP,maxPercent:100*max/defenderHP,
    attackerHP:a.pokemon.maxHP(),attackerStats:a.pokemon.rawStats,
    defenderStats:d.pokemon.rawStats,ability:a.ability,
    basePower:chosen.basePower,accuracy:chosen.accuracy,
    weather:activeWeather,notes,warnings,
    fullDescription:extra===1?safeDescription(result):'',
    meta:{type:chosen.move.type,category:chosen.move.category,hits:chosen.move.hits}
  };
}
