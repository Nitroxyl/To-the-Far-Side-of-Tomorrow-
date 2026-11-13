// Santara custom combat rules for the standard @smogon/calc engine.
// Source of truth for authored mechanics is santara-catalog.js plus GM definitions.
// This file is loaded by both sites; it contains no secret species names or story lore.
export const NORMALIZED = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const key = NORMALIZED;
export const DAMAGE_RULE_ABILITIES = Object.freeze([
 'apexpredator','kingdomsend','perfectedninjutsu','bastionfurnace','tempestcrown',
 'aurorachorus','moltenedge','systemoverride','siegebattery','rootaccess',
 'swordofruin','skybreaker'
]);
const definitions = [
 ['Infernal Sweep','Fire','Special',95,100,{target:'allAdjacentFoes',effect:'10% chance to burn each target'}],
 ['Schradebreaker','Fire','Special',130,90,{target:'normal',effect:'Removes Reflect, Light Screen and Aurora Veil before damage'}],
 ["Schrade's End",'Fire','Special',180,100,{target:'allAdjacentFoes',effect:'Charge one full round; once per battle'}],
 ['Psycannon','Psychic','Special',120,100,{effect:'User Speed -1 after damage'}],
 ['Aura Lance','Fighting','Special',95,100,{flags:{pulse:1},effect:'Pulse attack'}],
 ['Tar Rend','Poison','Physical',85,100,{flags:{contact:1},effect:'Target Defense -1 after damage'}],
 ['Riptide Bite','Water','Physical',85,100,{flags:{bite:1,contact:1},effect:'30% chance to lower target Defense'}],
 ['Faultline Gore','Ground','Physical',100,100,{flags:{contact:1},recoil:[1,4],effect:'Recoil 25% damage inflicted; boosted by Reckless'}],
 ['Glitch Pulse','Electric','Special',90,100,{flags:{pulse:1},effect:'Damage +20% to an Exposed target (provisional)'}],
 ['Nihil Light','Dragon','Special',200,100,{target:'normal',effect:'Provisional: bypasses positive defensive stages, Fairy immunity and Protect; 2-turn recharge'}],
 ['Razor Tempest','Flying','Physical',75,100,{flags:{slicing:1},effect:'Non-contact slicing attack'}],
 ['Machbreak','Dragon','Special',95,100,{target:'allAdjacentFoes',effect:'Ignores Steel resistance; Fairy immunity remains'}],
 ['Crush Grip','Normal','Physical',70,100,{willCrit:true,effect:'70 BP and always critical (Santara rework)'}],
 ['Ice Hammer','Ice','Physical',100,100,{effect:'100% accuracy (Santara rework)'}]
];
export const SANTARA_DAMAGE_MOVES = Object.freeze(Object.fromEntries(
 definitions.map(([name,type,category,power,accuracy,meta])=>[
   key(name),Object.freeze({name,type,category,power,accuracy,...meta})
 ])
));
export function knownMove(moveName) {return SANTARA_DAMAGE_MOVES[key(moveName)]||null}
export function mergeMoveDefinitions(definitions=[],{includePresets=false}={}) {
 const out=new Map();
 if(includePresets)for(const preset of Object.values(SANTARA_DAMAGE_MOVES)){
   if(['Crush Grip','Ice Hammer'].includes(preset.name))continue; // official moves remain official
   out.set(key(preset.name),{...preset});
 }
 for(const record of definitions||[]){
   if(!record?.name)continue;
   out.set(key(record.name),{...(out.get(key(record.name))||{}),...record});
 }
 return [...out.values()];
}
export function moveProperties(name, custom){
 const preset=knownMove(name);
 const flags={...(preset?.flags||{})};
 if(custom?.flags)Object.assign(flags,custom.flags);
 if(Array.isArray(custom?.traits))for(const trait of custom.traits)flags[key(trait)]=1;
 if(custom?.contact===true)flags.contact=1;
 if(custom?.contact===false)flags.contact=0;
 if(custom?.bite===true)flags.bite=1;
 if(custom?.slicing===true)flags.slicing=1;
 if(custom?.pulse===true)flags.pulse=1;
 return {
   flags, target:custom?.target||preset?.target||'normal',
   recoil:custom?.recoil||preset?.recoil,
   willCrit:custom?.willCrit??preset?.willCrit??false,
   power:Number.isFinite(Number(custom?.power))?Number(custom.power):preset?.power,
   accuracy:custom?.accuracy??preset?.accuracy,
   category:custom?.category??preset?.category,
   type:custom?.type??preset?.type,
   effect:preset?.effect||''
 };
}
export function recognizedCustomAbility(name) {return DAMAGE_RULE_ABILITIES.includes(key(name))}
export function setupSpecialEffects({attacker,defender,move,weather='Auto',exposed=false,
  auroraChorusActive=true,siegeBoosted=false,protection=false,gameType='Singles'}){
 const notes=[],warnings=[],manual=[],a=key(attacker.ability),d=key(defender.ability),n=key(move.name);
 let activeWeather=weather;
 if(weather==='Auto')activeWeather=(a==='kingdomsend'||d==='kingdomsend')?'Calamitous Sun':
  (a==='tempestcrown'||d==='tempestcrown')?'Royal Tempest':'Clear';
 const realWeather=activeWeather==='Calamitous Sun'?'Sun':
  (activeWeather==='Royal Tempest'||activeWeather==='Clear')?'':activeWeather;
 const fieldExtras={
  weather:realWeather||undefined,gameType,
  isSwordOfRuin:a==='swordofruin'&&d!=='swordofruin',
  // A defensive Veil is a battle state. It is not permanently active for every hit.
  isCustomVeil:d==='aurorachorus'&&auroraChorusActive,
  isProtected:protection&&n!=='nihillight'
 };
 if(a==='siegebattery'&&siegeBoosted){
  attacker.pokemon.boosts.spa=Math.min(6,(attacker.pokemon.boosts.spa||0)+1);
  notes.push('Siege Battery: this turn has a +1 Sp. Atk stage from an earlier hit.');
 } else if(a==='siegebattery'){
  manual.push('Siege Battery: enable the trigger option after this Pokémon is hit for the first time in a round. Electro Shot does not need a charge turn.');
 }
 if(d==='siegebattery')manual.push('Siege Battery: if the defender survives its first hit this round, its Sp. Atk rises by 1 stage.');
 if(a==='systemoverride'&&exposed){
  defender.pokemon.ability=undefined;
  defender.ability='';
  defender.pokemon.boosts.spe=Math.max(-6,(defender.pokemon.boosts.spe||0)-1);
  notes.push('System Override: marked target ability suppressed, Speed -1, and Normal/Electric damage +20%.');
 }else if(a==='systemoverride')manual.push('System Override: use Exposed when the chosen marked opponent is active; its Ability will be suppressed and Speed reduced.');
 if(d==='systemoverride')manual.push('System Override on the defender requires its separately marked target; no outgoing mark is inferred.');
 if(a==='rootaccess')manual.push('Root Access: Prankster gives status moves +1 priority. Levitate is accounted for; priority does not modify damage.');
 if(d==='rootaccess')manual.push('Root Access: Levitate immunity is included unless an overriding Ground effect applies.');
 if(d==='aurorachorus'&&auroraChorusActive)notes.push('Aurora Chorus: defensive Aurora Veil active. Turn duration is tracked by the GM.');
 if(d==='aurorachorus'&&!auroraChorusActive)notes.push('Aurora Chorus: Aurora Veil has expired or is inactive.');
 if(a==='aurorachorus')manual.push('Aurora Chorus grants a 5-turn Aurora Veil to its user side when Mega Evolution begins; check defender-side Veil for incoming attacks.');
 if(a==='apexpredator')manual.push('Apex Predator: on knockout, the attacker recovers 25% of its maximum HP.');
 if(a==='bastionfurnace'||d==='bastionfurnace')manual.push('Bastion Furnace: negative Defense/Sp. Def stages are blocked. Above half HP it reduces super-effective hits; otherwise it boosts Fire/Psychic damage.');
 if(a==='tempestcrown'||d==='tempestcrown')manual.push('Tempest Crown: Royal Tempest lasts 5 rounds; Thunder and Hurricane have perfect accuracy while it remains active.');
 if(a==='kingdomsend'||d==='kingdomsend')manual.push("Kingdom's End: Calamitous Sun lasts 5 rounds or until its source leaves the field.");
 if(a==='skybreaker'&&move.type==='Ground'){
  // The defensive Flying immunity is treated as neutral; preserve all other type interactions.
  if(defender.pokemon.types.includes('Flying')){
   const without=defender.pokemon.types.filter(t=>t!=='Flying');
   defender.pokemon.types=without.length?without:['Normal'];
   defender.pokemon.species.types=[...defender.pokemon.types]; // calc.calculate clones from species overrides
   notes.push('Skybreaker: Flying-type Ground immunity bypassed.');
  }
  if(key(defender.ability)==='levitate'||key(defender.ability)==='rootaccess'){
   defender.pokemon.ability=undefined;
   defender.pokemon.species.abilities={0:''};
   defender.ability='';
   notes.push('Skybreaker: Levitate immunity bypassed.');
  }
 }
 if(n==='schradebreaker')notes.push('Schradebreaker: Reflect, Light Screen and Aurora Veil are destroyed before this hit.');
 if(n==='psycannon')manual.push('Psycannon: lower the user Speed stage by 1 after the attack.');
 if(n==='tarrend')manual.push('Tar Rend: lower the target Defense stage by 1 after a successful hit.');
 if(n==='riptidebite')manual.push('Riptide Bite: 30% chance to lower the target Defense stage after a hit.');
 if(n==='faultlinegore')manual.push('Faultline Gore: recoil equals 25% of actual damage inflicted (capped by target current HP).');
 if(n==='infernalsweep')manual.push('Infernal Sweep: 10% burn chance for each target; the cone is resolved on the Santara grid.');
 if(n==='schradesend')manual.push("Schrade's End: charge one full round; usable once per battle. Directional cone and timing are handled by the GM.");
 if(n==='machbreak')notes.push('Machbreak: Steel resistance is treated as neutral; Fairy immunity remains.');
 if(n==='glitchpulse')manual.push('Glitch Pulse is provisional: its Exposed target modifier is only active when the Exposed toggle is on.');
 if(n==='nihillight')warnings.push('Nihil Light is a provisional move. Its immunity/protection bypass and recharge are custom rulings that require GM approval.');
 if(n==='roaroftime')manual.push('Santara Roar of Time: Trick Room starts after this turn concludes; recharge/turn order are handled by the GM.');
 if(n==='crushgrip')notes.push('Santara Crush Grip: 70 BP, guaranteed critical hit.');
 if(n==='icehammer')notes.push('Santara Ice Hammer: 100% accuracy.');
 if(n==='electroshot'&&a==='siegebattery')notes.push('Siege Battery: Electro Shot requires no charge turn.');
 return {activeWeather,fieldExtras,notes,warnings,manual,abilityA:a,abilityD:d,moveId:n};
}
export function additionalDamageEffects({attacker,defender,move,activeWeather='Clear',
  exposed=false,match=1,notes=[],manual=[]}){
 const a=key(attacker.ability),d=key(defender.ability),n=key(move.name);
 let extra=1;
 if(activeWeather==='Calamitous Sun'){
  if(move.type==='Water'){notes.push('Calamitous Sun: Water attacks fail.');return 0;}
  if(move.type==='Fire'&&match>0&&match<1){extra/=match;notes.push("Kingdom's End: Fire resistance is neutralized (immunity remains).");}
 }
 if(activeWeather==='Royal Tempest'&&move.type==='Electric'){extra*=1.3;notes.push('Royal Tempest: Electric damage +30%.');}
 if(a==='moltenedge'&&(move.type==='Fire'||move.flags?.slicing)){
  extra*=1.3;notes.push('Molten Edge: qualifying Fire or slicing move +30% damage.');
 }
 if(a==='bastionfurnace'&&attacker.hpPercent<=50&&['Fire','Psychic'].includes(move.type)){
  extra*=1.3;notes.push('Bastion Furnace: low HP Fire/Psychic +30%.');
 }
 if(d==='bastionfurnace'&&defender.hpPercent>50&&match>1){
  extra*=0.75;notes.push('Bastion Furnace: super-effective damage reduced by 25%.');
 }
 if(a==='apexpredator'&&move.category==='Physical'&&defender.hpPercent<100){
  extra*=1.3;notes.push('Apex Predator: damaged target +30% physical damage.');
 }
 if(a==='systemoverride'&&exposed&&['Normal','Electric'].includes(move.type)){extra*=1.2;}
 if(n==='glitchpulse'&&exposed){extra*=1.2;notes.push('Glitch Pulse: Exposed target +20% damage (provisional).');}
 if(n==='machbreak'&&match>0&&defender.types.includes('Steel')){extra*=2;notes.push('Machbreak: removes Steel Dragon resistance.');}
 if(a==='skybreaker'&&move.type==='Ground'&&!(attacker.pokemon.teraType?attacker.pokemon.teraType==='Ground':attacker.types.includes('Ground'))){
  extra*=1.5;notes.push('Skybreaker: Ground STAB added.');
 }
 return extra;
}
export function afterDamageEffects({attacker,defender,move,min=0,max=0,koChance=0,manual=[]}){
 const out=[],name=key(move.name);
 if(name==='faultlinegore'&&max>0){
  const cap=Math.max(0,defender.pokemon.curHP());
  const recoilFor=v=>Math.floor(Math.min(cap,v)/4);
  out.push('Recoil: '+recoilFor(min)+'–'+recoilFor(max)+' HP (25% inflicted, approximate).');
 }
 if(key(attacker.ability)==='apexpredator'&&koChance>0){
  const heal=Math.floor(attacker.pokemon.maxHP()/4);
  out.push('Apex Predator: recover '+heal+' HP on knockout ('+koChance.toFixed(1)+'% of displayed rolls KO).');
 }
 return [...out,...manual];
}
