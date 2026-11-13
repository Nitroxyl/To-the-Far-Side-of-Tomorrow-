import {knownMove,moveProperties,recognizedCustomAbility,setupSpecialEffects,additionalDamageEffects,afterDamageEffects} from './santara-damage-rules.js';
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
export function makeMove(calc,gen,moveName,customMoves=[],attackAbility='',forcedHits=0,critical=false){
  const name=String(moveName||'').trim();
  if(!name)throw Error('Select a damaging move.');
  const custom=customMoveDefinition(name,customMoves);
  const official=gen.moves.get(id(name));
  const preset=knownMove(name);
  if(!official&&!custom&&!preset)throw Error('Move '+name+' is not recognized. Register it in the custom move catalogue first.');
  const attributes=moveProperties(name,custom);
  const bp=Number(attributes.power ?? official?.basePower);
  const category=attributes.category||official?.category;
  const type=titleType(attributes.type||official?.type);
  if(category==='Status')throw Error(name+' is a status move, not a damaging attack.');
  if(!Number.isFinite(bp)||bp<=0)throw Error(name+' has variable or zero Base Power. This move needs a specific power rule before calculating.');
  const overrideRequired=!!(custom||preset);
  const overrides=overrideRequired?{
    name:custom?.name||preset?.name||official?.name,
    type,category,basePower:bp,accuracy:attributes.accuracy??official?.accuracy??100,
    target:attributes.target||official?.target||'normal',
    flags:{...(official?.flags||{}),...attributes.flags},
    ...(attributes.recoil?{recoil:attributes.recoil}:{}),
    ...(attributes.willCrit?{willCrit:true}:{})
  }:undefined;
  const multihit=custom?.multihit||official?.multihit;
  if(overrides&&multihit)overrides.multihit=multihit;
  const maxHits=Array.isArray(multihit)?multihit[1]:typeof multihit==='number'?multihit:1;
  const perfected=id(attackAbility)==='perfectedninjutsu';
  const count=Number(forcedHits)>0?bound(forcedHits,1,10,1):(perfected?maxHits:undefined);
  const move=new calc.Move(gen,official?.name||name,{
    overrides,ability:perfected?'Skill Link':attackAbility,
    hits:count,isCrit:!!critical||!!attributes.willCrit
  });
  if(perfected&&maxHits>1&&!forcedHits)move.hits=maxHits;
  return {move,custom,preset,basePower:bp,accuracy:attributes.accuracy??official?.accuracy??null};
}
function damageRolls(value) {
  if(typeof value==='number')return [value];
  if(!Array.isArray(value))return [0];
  if(typeof value[0]==='number')return value.length<16?[value.reduce((sum,n)=>sum+n,0)]:value;
  // Multi-hit: correlated roll indices; returned min/max remain accurate.
  return Array.from({length:16},(_,i)=>value.reduce((sum,rolls)=>sum+(rolls[i]??rolls[rolls.length-1]??0),0));
}
function safeDescription(result){try{return result.fullDesc();}catch{return '';}}
export function computeDamage(calc,{attacker,defender,moveName,attackerSettings={},defenderSettings={},
  customMoves=[],customAbilities=[],weather='Auto',terrain='',gameType='Singles',
  reflect=false,lightScreen=false,auroraVeil=false,auroraChorusActive=true,
  helpingHand=false,critical=false,hits=0,exposed=false,
  siegeBoosted=false,protection=false}={}){
  if(!calc?.Generations?.get||!calc?.calculate)throw Error('Pokémon damage engine unavailable. Reload when connected.');
  const gen=calc.Generations.get(9);
  const a=makePokemon(calc,gen,attacker,attackerSettings,customAbilities);
  const d=makePokemon(calc,gen,defender,defenderSettings,customAbilities);
  const chosen=makeMove(calc,gen,moveName,customMoves,a.ability,hits,critical);
  const warnings=[...a.warnings,...d.warnings],notes=[];
  for(const [side,p] of [['Attacker',a],['Defender',d]]){
    const abilityId=id(p.ability);
    const official=gen.abilities.get(abilityId);
    if(p.ability&&!official&&!recognizedCustomAbility(p.ability)){
      warnings.push(side+' ability '+p.ability+' is not modeled yet; resolve its effects manually.');
    }
  }
  const state=setupSpecialEffects({
    attacker:a,defender:d,move:chosen.move,weather,exposed,auroraChorusActive,
    siegeBoosted,protection,gameType
  });
  notes.push(...state.notes);
  warnings.push(...state.warnings);
  if(id(a.ability)==='systemoverride'&&exposed)d.ability='';
  const screensBreak=id(moveName)==='schradebreaker';
  const field=new calc.Field({
    weather:state.fieldExtras.weather,terrain:terrain||undefined,gameType,
    isSwordOfRuin:state.fieldExtras.isSwordOfRuin,
    isDarkAura:[a,d].some(p=>id(p.ability)==='darkaura'),
    isFairyAura:[a,d].some(p=>id(p.ability)==='fairyaura'),
    defenderSide:{
      isReflect:reflect&&!screensBreak,
      isLightScreen:lightScreen&&!screensBreak,
      isAuroraVeil:(auroraVeil||state.fieldExtras.isCustomVeil)&&!screensBreak,
      isProtected:state.fieldExtras.isProtected
    },
    attackerSide:{isHelpingHand:helpingHand}
  });
  const effectiveTypes=d.pokemon.teraType?[d.pokemon.teraType]:d.pokemon.types;
  const match=matchup(gen,chosen.move.type,effectiveTypes);
  const extra=additionalDamageEffects({
    attacker:a,defender:d,move:chosen.move,activeWeather:state.activeWeather,
    exposed,match,notes,manual:state.manual
  });
  if(chosen.custom?.description&&
    !chosen.preset?.effect)warnings.push('Move description contains non-damage effects; review the move text after the hit.');
  if(id(moveName)==='nihillight'&&protection)warnings.push('Nihil Light protection bypass is provisional.');
  if((a.form.mega&&attackerSettings.tera)||(d.form.mega&&defenderSettings.tera))
    warnings.push('Mega + Tera combination uses Santara house rules; confirm the intended STAB interaction.');
  // Skybreaker uses Thousand Arrows' official immunity-bypass path while
  // preserving the original Ground move's Base Power, category and flags.
  // The ordinary Move name is retained for all UI and secondary effects.
  let calculationMove=chosen.move;
  if(id(a.ability)==='skybreaker'&&chosen.move.type==='Ground'){
    calculationMove=new calc.Move(gen,'Thousand Arrows',{
      overrides:{name:'Thousand Arrows',type:'Ground',
        basePower:chosen.move.bp,category:chosen.move.category,
        target:chosen.move.target,flags:chosen.move.flags,
        ...(chosen.move.recoil?{recoil:chosen.move.recoil}:{})},
      isCrit:chosen.move.isCrit,hits:chosen.move.hits
    });
  }
  const result=calc.calculate(gen,a.pokemon,d.pokemon,calculationMove,field);
  const rolls=damageRolls(result.damage).map(v=>Math.max(0,Math.floor(v*extra)));
  const min=Math.min(...rolls),max=Math.max(...rolls);
  const defenderHP=d.pokemon.maxHP();
  const currentDefHP=d.pokemon.curHP();
  const koChance=rolls.filter(v=>v>=currentDefHP).length/rolls.length*100;
  const followups=afterDamageEffects({
    attacker:a,defender:d,move:chosen.move,min,max,koChance,manual:state.manual
  });
  notes.push(...followups);
  const accuracy=state.activeWeather==='Royal Tempest'&&
    ['thunder','hurricane'].includes(id(moveName))?100:chosen.accuracy;
  return {
    min,max,rolls,defenderHP,currentDefHP,koChance,
    minPercent:100*min/defenderHP,maxPercent:100*max/defenderHP,
    attackerHP:a.pokemon.maxHP(),attackerStats:a.pokemon.rawStats,
    defenderStats:d.pokemon.rawStats,ability:a.ability,
    basePower:chosen.basePower,accuracy,
    weather:state.activeWeather,notes,warnings,
    fullDescription:extra===1?safeDescription(result):'',
    meta:{type:chosen.move.type,category:chosen.move.category,hits:chosen.move.hits,
      critical:chosen.move.isCrit,spread:chosen.move.target}
  };
}
