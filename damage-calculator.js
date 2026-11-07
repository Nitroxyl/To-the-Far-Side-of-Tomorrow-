import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {effectivePokemon,initialUnlocks} from './pokemon-gimmicks.js';
import {applyMegaOverlays} from './pokemon-mega-assignments.js';
import {DAMAGE_TYPES,parseDice,rollDice,calculateDamage} from './pokemon-damage.js';
import {fromPokeApi} from './pokemon-math.js';

const ROOT_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const GM_SITE=window.SANTARA_POKEMON_EDITION==='gm';
const root=document.getElementById('calculator-root');
const feedback=document.getElementById('calc-feedback');
const chip=document.getElementById('calc-user');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nice=x=>String(x||'').replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const fmt=x=>Number.isFinite(x)?Number(x).toLocaleString(undefined,{maximumFractionDigits:2}):'—';
const options=(items,selected)=>items.map(([value,label])=>'<option value="'+esc(value)+'"'+(String(selected)===String(value)?' selected':'')+'>'+esc(label)+'</option>').join('');
const typeOptions=selected=>options(DAMAGE_TYPES.map(x=>[x,nice(x)]),selected);

let app,auth,db,user=null,eligible=false,connected=false,approved=false,gmRole=false;
let stopAuth=null,stopRole=null,stopApproved=null,subscriptions=[];
let rawPokemon=[],megaAssignments={},pokemon=[],customMoves=[],battleRules=null,unlocks={},myUnlocks=initialUnlocks(),ready=false;
let moveCache=new Map(),requestingMove=new Set();
let initialBurnSet=false;
const idFromUrl=new URLSearchParams(window.location.search).get('attacker')||'';
const makeManual=(name)=>({speciesName:name,name,types:['normal'],originalTypes:['normal'],baseStats:{hp:80,attack:80,defense:80,specialAttack:80,specialDefense:80,speed:80},ability:'',heldItem:'',maxHp:100,currentHp:100,level:10});
const state={
 attackerId:idFromUrl,defenderId:'manual',manualAttacker:makeManual('Wild attacker'),manualDefender:makeManual('Wild defender'),
 moveName:'',moveType:'normal',category:'physical',dice:'',diceTouched:false,typeTouched:false,categoryTouched:false,rolledDice:null,
 weather:'none',critical:false,burned:false,otherMultiplier:'1',flatBonus:'0',stabOverride:'',typeOverride:'',rounding:'floor',pb:''
};
const error=message=>{feedback.textContent=message||''};
const resetListeners=()=>{
 for(const fn of subscriptions)fn?.();subscriptions=[];
 stopRole?.();stopApproved?.();stopRole=stopApproved=null;
 rawPokemon=[];megaAssignments={};pokemon=[];customMoves=[];battleRules=null;unlocks={};myUnlocks=initialUnlocks();ready=false;connected=false;eligible=false;approved=false;gmRole=false;initialBurnSet=false;
};
const formElement=()=>document.getElementById('damage-form');

function signedOut(message){
 root.innerHTML='<section class="panel"><h2>'+esc(message)+'</h2><p>Use the same Firebase account you use for your Pokémon collection. This calculator does not create a new Trainer identity.</p><div class="actions"><a class="btn primary" href="./index.html">Open Fieldwork sign-in</a><a class="btn" href="./account-access.html">Account &amp; GM access</a></div></section>';
}
function reconcile(){
 const permitted=(user?.uid===ROOT_UID)||(gmRole)||(GM_SITE?false:approved);
 if(permitted&&!connected){eligible=true;connected=true;connect();return}
 if(!permitted&&connected){for(const fn of subscriptions)fn?.();subscriptions=[];connected=false;ready=false}
 eligible=permitted;
 if(!permitted)signedOut(GM_SITE?'GM authorization required':'Trainer access required');
}
function beginUser(next){
 resetListeners();user=next;state.attackerId=idFromUrl;state.defenderId='manual';state.moveName='';state.dice='';state.diceTouched=false;state.typeTouched=false;state.categoryTouched=false;state.rolledDice=null;state.manualAttacker=makeManual('Wild attacker');state.manualDefender=makeManual('Wild defender');error('');chip.textContent=user?.email||'Not signed in';
 if(!user){signedOut('Sign in to calculate damage');return}
 if(!user.emailVerified&&user.uid!==ROOT_UID){signedOut('Verify your email to use the calculator');return}
 if(user.uid===ROOT_UID){eligible=true;connected=true;connect();return}
 stopRole=onSnapshot(doc(db,'santara_gm_accounts',user.uid),snap=>{
  const role=snap.exists()?snap.data():null;gmRole=role?.enabled===true&&role.email===user.email;reconcile();
 },e=>{gmRole=false;reconcile();error('GM role check: '+e.message)});
 if(!GM_SITE)stopApproved=onSnapshot(doc(db,'santara_player_access',user.uid),snap=>{
  approved=snap.exists()&&snap.data().enabled===true;reconcile();
 },e=>{approved=false;reconcile();error('Trainer approval check: '+e.message)});
}

function connect(){
 root.innerHTML='<section class="panel">Loading your Pokémon and battle rules…</section>';
 const listen=(ref,onData,label)=>{
  subscriptions.push(onSnapshot(ref,onData,e=>error(label+': '+e.message)));
 };
 listen(GM_SITE?collection(db,'santara_pokemon'):query(collection(db,'santara_pokemon'),where('ownerUid','==',user.uid)),snap=>{
  rawPokemon=snap.docs.map(d=>({id:d.id,...d.data()}));updatePokemon();
  ready=true;render();
 },'Pokémon records');
 listen(GM_SITE?collection(db,'santara_pokemon_mega_assignments'):query(collection(db,'santara_pokemon_mega_assignments'),where('ownerUid','==',user.uid)),snap=>{
  megaAssignments=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));
  updatePokemon();if(ready)render();
 },'Mega assignments');
 listen(doc(db,'santara_battle_rules','v5_2'),snap=>{battleRules=snap.exists()?snap.data():null;if(ready)renderResult()},'V5.2 settings');
 listen(collection(db,'santara_custom_moves'),snap=>{
  customMoves=snap.docs.map(d=>({...d.data(),slug:d.id}));
  moveCache=new Map();
  if(ready&&state.moveName){loadMove(state.moveName)}else if(ready)renderResult();
 },'Custom move catalogue');
 listen(GM_SITE?collection(db,'santara_trainer_gimmicks'):doc(db,'santara_trainer_gimmicks',user.uid),snap=>{
  if(GM_SITE)unlocks=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));
  else myUnlocks=snap.exists()?snap.data():initialUnlocks();
  if(ready)render();
 },'Mechanic unlocks');
}
function updatePokemon(){
 pokemon=applyMegaOverlays(rawPokemon,megaAssignments).sort((a,b)=>(a.speciesName||'').localeCompare(b.speciesName||''));
 if(!state.attackerId||(state.attackerId!=='manual'&&!pokemon.some(p=>p.id===state.attackerId)))state.attackerId=pokemon[0]?.id||'manual';
 if(state.defenderId!=='manual'&&!pokemon.some(p=>p.id===state.defenderId))state.defenderId='manual';
 if(!initialBurnSet){state.burned=/^burn/i.test(String(attacker()?.status||''));initialBurnSet=true;}
 if(!state.moveName){
  const first=attacker()?.moves?.[0];
  if(first){state.moveName=first;loadMove(first)}
 }
}
function owned(id){return pokemon.find(p=>p.id===id)||null}
function transform(p){
 if(!p)return null;
 const flags=GM_SITE?(unlocks[p.ownerUid]||initialUnlocks()):myUnlocks;
 return effectivePokemon(p,flags);
}
function attacker(){return state.attackerId==='manual'?state.manualAttacker:transform(owned(state.attackerId))}
function defender(){return state.defenderId==='manual'?state.manualDefender:transform(owned(state.defenderId))}
function moveEntry(name){
 const found=customMoves.find(m=>m.name?.trim().toLowerCase()===String(name||'').trim().toLowerCase());
 return found?{name:found.name,type:found.type,category:String(found.category||'physical').toLowerCase(),power:found.power??null,accuracy:found.accuracy??null,
 dice:found.dice||'',description:found.description||'',custom:true}:null;
}
async function loadMove(name){
 const key=String(name||'').trim().toLowerCase().replace(/\s+/g,'-');
 if(!key)return;
 const custom=moveEntry(name);
 if(custom){moveCache.set(key,custom);applyMoveDetails(name,custom);return}
 if(moveCache.has(key)){applyMoveDetails(name,moveCache.get(key));return}
 if(requestingMove.has(key))return;
 requestingMove.add(key);
 try{
  const resp=await fetch('https://pokeapi.co/api/v2/move/'+encodeURIComponent(key));
  if(!resp.ok)throw Error('Move not available from PokéAPI');
  const m=await resp.json();
  const info={name:nice(m.name),type:m.type?.name||'normal',category:m.damage_class?.name||'physical',
   power:m.power,accuracy:m.accuracy,dice:'',description:'',custom:false};
  moveCache.set(key,info);applyMoveDetails(name,info);
 }catch(e){
  moveCache.set(key,null);
  if(state.moveName===name){error('Move lookup unavailable. Set its type, category and damage dice manually.');renderResult()}
 }finally{requestingMove.delete(key)}
}
function applyMoveDetails(name,info){
 if(state.moveName!==name||!info)return;
 if(!state.typeTouched)state.moveType=info.type||state.moveType;
 if(!state.categoryTouched)state.category=info.category||state.category;
 if(!state.diceTouched)state.dice=String(info.dice||'');
 if(ready)render();
}
function labelledPokemon(mon){
 const display=(mon.nickname||mon.speciesName||'Pokémon')+' · Lv. '+(mon.level||'?');
 return GM_SITE?display+' · '+String(mon.ownerUid||'').slice(0,7):display;
}
function picker(id,chosen,includeManual,label){
 const selections=includeManual?[['manual',label]]:[];
 return options(selections.concat(pokemon.map(m=>[m.id,labelledPokemon(m)])),chosen);
}
function portrait(mon){
 const src=String(mon?.spriteData||'');
 const url=String(mon?.spriteUrl||'');
 const valid=src.startsWith('data:image/webp;base64,')&&src.length<155000?src:/^https:\/\/.+/i.test(url)?url:'';
 return valid?'<img class="calc-portrait" src="'+esc(valid)+'" loading="lazy" alt="">':'<div class="calc-portrait calc-silhouette">◇</div>';
}
function manualFields(side){
 const m=side==='attacker'?state.manualAttacker:state.manualDefender;
 const stats=[['hp','HP'],['attack','Attack'],['defense','Defense'],['specialAttack','Sp. Attack'],['specialDefense','Sp. Defense'],['speed','Speed']];
 const prefix='manual'+(side==='attacker'?'Attacker':'Defender')+'.';
 return '<section class="calc-manual"><div class="toolbar"><h3>Manual '+esc(side)+'</h3><button class="btn small" type="button" data-action="fetch-species" data-side="'+side+'">Fetch species stats</button></div>'+
 '<div class="form-grid">'+
 '<label class="field full">Species (PokéAPI name or custom label)<input name="'+prefix+'speciesName" value="'+esc(m.speciesName)+'" maxlength="85"></label>'+
 '<label class="field">Type 1<select name="'+prefix+'type1">'+typeOptions(m.types?.[0]||'normal')+'</select></label>'+
 '<label class="field">Type 2<select name="'+prefix+'type2">'+options([['','None']].concat(DAMAGE_TYPES.map(t=>[t,nice(t)])),m.types?.[1]||'')+'</select></label>'+
 stats.map(([k,label])=>'<label class="field">'+label+' base stat<input type="number" name="'+prefix+k+'" min="1" max="255" value="'+esc(m.baseStats[k])+'"></label>').join('')+
 '<label class="field">Maximum HP<input type="number" name="'+prefix+'maxHp" min="1" max="100000" value="'+esc(m.maxHp)+'"></label>'+
 '<label class="field">Current HP<input type="number" name="'+prefix+'currentHp" min="0" max="100000" value="'+esc(m.currentHp)+'"></label>'+
 '<label class="field">Ability<input name="'+prefix+'ability" maxlength="80" value="'+esc(m.ability||'')+'"></label>'+
 '<label class="field">Held item<input name="'+prefix+'heldItem" maxlength="80" value="'+esc(m.heldItem||'')+'"></label></div></section>';
}
function field(label,name,value,attrs=''){
 return '<label class="field">'+label+'<input name="'+name+'" value="'+esc(value)+'" '+attrs+'></label>';
}
function check(label,name,checked){
 return '<label class="calc-checkbox"><input type="checkbox" name="'+name+'"'+(checked?' checked':'')+'><span>'+label+'</span></label>';
}
function render(){
 if(!eligible){signedOut('Trainer access required');return}
 if(!ready){root.innerHTML='<section class="panel">Loading Pokémon records…</section>';return}
 const a=attacker(),d=defender(),mon=owned(state.attackerId);
 const suggestions=[...(mon?.moves||[]),...customMoves.map(m=>m.name)].filter((n,i,all)=>all.findIndex(v=>v.toLowerCase()===n.toLowerCase())===i);
 const info=moveCache.get(state.moveName.trim().toLowerCase().replace(/\s+/g,'-'))||moveEntry(state.moveName);
 root.innerHTML='<form id="damage-form">'+
 '<section class="calc-top"><div class="panel"><label class="field">Attacker<select name="attackerId">'+picker('attacker',state.attackerId,true,'Manual / wild attacker')+'</select></label>'+
 (state.attackerId==='manual'?manualFields('attacker'):
 '<div class="calc-pokemon">'+portrait(a)+'<div><b>'+esc(a?.nickname||a?.displayName||a?.speciesName)+'</b><p class="hint">'+esc((a?.types||[]).join(' / '))+' · '+esc(a?.ability||'No ability')+' · '+esc(a?.heldItem||'No held item')+'</p></div></div>')+'</div>'+
 '<div class="calc-vs">VS</div>'+
 '<div class="panel"><label class="field">Defender<select name="defenderId">'+picker('defender',state.defenderId,true,'Manual / wild defender')+'</select></label>'+
 (state.defenderId==='manual'?manualFields('defender'):
 '<div class="calc-pokemon">'+portrait(d)+'<div><b>'+esc(d?.nickname||d?.displayName||d?.speciesName)+'</b><p class="hint">'+esc((d?.types||[]).join(' / '))+' · '+fmt(d?.currentHp)+'/'+fmt(d?.maxHp)+' HP</p></div></div>')+'</div></section>'+
 '<div class="calc-columns">'+
 '<section class="panel"><h2>Move &amp; damage dice</h2>'+
 '<label class="field">Move name<input name="moveName" list="damage-known-moves" maxlength="60" value="'+esc(state.moveName)+'" placeholder="e.g. Flamethrower or Primordial Crush"></label>'+
 '<datalist id="damage-known-moves">'+suggestions.map(n=>'<option value="'+esc(n)+'"></option>').join('')+'</datalist>'+
 '<div class="form-grid calc-subgrid"><label class="field">Type<select name="moveType">'+typeOptions(state.moveType)+'</select></label>'+
 '<label class="field">Category<select name="category">'+options([['physical','Physical'],['special','Special'],['status','Status']],state.category)+'</select></label></div>'+
 '<p class="hint" id="move-meta">'+(info?(esc(info.custom?'Santara custom move':'PokéAPI move')+' · BP '+esc(info.power??'—')+' · Accuracy '+(info.accuracy==null?'—':esc(info.accuracy)+'%')):'Move metadata loads from PokéAPI or custom move definitions.')+'</p>'+
 (info?.description?'<p class="hint">'+esc(info.description)+'</p>':'')+
 field('Move damage dice', 'dice',state.dice,'placeholder="e.g. 3d8, 2d10+2 or fixed 15" autocomplete="off"')+
 '<p class="hint">Official base power does not yet have finalized V5.2 dice scaling. Enter the tabletop dice; saved custom move dice fill automatically.</p>'+
 '<div class="actions"><button class="btn" type="button" data-action="roll">Roll damage dice</button><span class="hint" id="roll-summary"></span></div>'+
 '</section>'+
 '<section class="panel"><h2>Battle modifiers</h2>'+
 '<label class="field">Weather<select name="weather">'+options([['none','None'],['sun','Sun'],['rain','Rain']],state.weather)+'</select></label>'+
 '<div class="calc-checks">'+check('Critical hit (×2)','critical',state.critical)+check('Attacker burned (Physical ×0.5)','burned',state.burned)+'</div>'+
 '<div class="form-grid calc-subgrid">'+
 field('Other multiplier (×)', 'otherMultiplier',state.otherMultiplier,'type="number" step="0.05" min="0" max="100"')+
 field('Extra flat damage', 'flatBonus',state.flatBonus,'type="number" step="1" min="-10000" max="10000"')+
 field('STAB override (optional)', 'stabOverride',state.stabOverride,'type="number" step="0.25" min="0" max="10" placeholder="Auto"')+
 field('Type override (optional)', 'typeOverride',state.typeOverride,'type="number" step="0.25" min="0" max="10" placeholder="Auto"')+
 '<label class="field">Final rounding<select name="rounding">'+options([['floor','Round down'],['nearest','Nearest whole']],state.rounding)+'</select></label>'+
 field('Proficiency bonus (for AC reference)','pb',state.pb,'type="number" min="0" max="20" placeholder="Not specified"')+
 '</div><p class="hint">Life Orb (+2), Choice Band (+3 Physical) and Choice Specs (+3 Special) apply once per move. Other abilities, screens and terrain can be entered as manual modifiers.</p>'+
 '</section></div>'+
 '<section class="panel calc-results"><div class="toolbar"><h2>Damage result</h2><span class="chip">V5.2 · read-only</span></div><div id="damage-result"></div></section>'+
 '<div class="panel"><h3>Calculation scope</h3><p class="hint">Multipliers use the exact V5.2 20-point Attack/Sp. Attack and Defense/Sp. Defense bands saved by the GM. Type effectiveness, STAB (including Tera), weather, critical hits, burn, Life Orb and Choice items are included. The campaign ability Calamitous Sun removes Fire resistances but does not remove immunities. Unsupported abilities, targets, Protect, screens and unusual move effects need a GM adjustment.</p><p class="hint">This calculator does not alter Pokémon HP, consume items, roll accuracy checks or automatically apply status effects. Universal AC is shown for reference only.</p></div>'+
 '</form>';
 renderResult();
}
function valuesFromForm(){
 const form=formElement();if(!form)return;
 for(const field of form.querySelectorAll('input,select')){
  const key=field.name;if(!key)continue;
  if(key.startsWith('manual')){
   const dot=key.indexOf('.'),prefix=key.slice(0,dot),prop=key.slice(dot+1);
   const m=prefix==='manualAttacker'?state.manualAttacker:state.manualDefender;
   if(!m)continue;
   if(['hp','attack','defense','specialAttack','specialDefense','speed'].includes(prop))m.baseStats[prop]=Number(field.value);
   else if(prop==='type1'||prop==='type2'){
    if(prop==='type1')m.types[0]=field.value;
    else m.types[1]=field.value;
    m.types=m.types.filter(Boolean);m.originalTypes=m.types.slice();
   }else if(['currentHp','maxHp'].includes(prop))m[prop]=Number(field.value);
   else m[prop]=field.value;
   continue;
  }
  if(key==='attackerId'||key==='defenderId'||key==='moveName')continue;
  if(key==='critical'||key==='burned')state[key]=field.checked;
  else if(key in state)state[key]=field.value;
 }
}
function renderResult(){
 const target=document.getElementById('damage-result');if(!target)return;
 const rollSummary=document.getElementById('roll-summary');
 if(rollSummary)rollSummary.textContent=state.rolledDice===null?'No dice rolled yet':'Last dice total: '+state.rolledDice;
 const a=attacker(),d=defender();
 if(!a||!d){target.innerHTML='<p class="hint">Choose an attacker and defender.</p>';return}
 if(!state.moveName.trim()){target.innerHTML='<p class="hint">Choose a move, then enter its damage dice to calculate.</p>';return}
 if(state.category!=='status'&&!state.dice.trim()){
  target.innerHTML='<div class="calc-empty">Enter this move’s V5.2 damage dice to calculate. PokéAPI base power alone does not specify the campaign’s tabletop dice.</div>';return;
 }
 try{
  const result=calculateDamage({
   attacker:a,defender:d,move:{name:state.moveName,type:state.moveType,category:state.category},
   dice:state.dice,rolledDice:state.rolledDice,rules:battleRules,weather:state.weather,
   critical:state.critical,burned:state.burned,otherMultiplier:state.otherMultiplier,
   flatBonus:state.flatBonus,stabOverride:state.stabOverride,typeOverride:state.typeOverride,rounding:state.rounding
  });
  if(result.status){target.innerHTML='<div class="calc-empty">'+esc(result.message)+'</div>';return}
  const ac=Number.isInteger(battleRules?.universalAc)?String(battleRules.universalAc):
   state.pb!==''&&Number.isInteger(Number(state.pb))?'11 + '+state.pb+' = '+(11+Number(state.pb)):'11 + PB';
  const koa=result.guaranteedKo?'Guaranteed KO at this HP':result.possibleKo?'Possible KO at this HP':'Not a KO at this HP';
  target.innerHTML='<div class="calc-score"><div><span>Minimum</span><strong>'+fmt(result.min)+'</strong></div>'+
  '<div><span>Average dice estimate</span><strong>'+fmt(result.average)+'</strong></div>'+
  '<div><span>Maximum</span><strong>'+fmt(result.max)+'</strong></div>'+
  (result.rolled!==null?'<div><span>Rolled damage</span><strong>'+fmt(result.rolled)+'</strong></div>':'')+'</div>'+
  '<div class="calc-health"><b>'+esc(koa)+'</b><span>Target HP: '+fmt(result.hp)+'/'+fmt(result.maxHp)+' · Average ≈ '+fmt(result.percentMaxHp)+'% of max HP</span></div>'+
  '<div class="calc-breakdown">'+[
   ['Dice',esc(result.dice.expression)+' (min '+fmt(result.dice.min)+', mean '+fmt(result.dice.average)+', max '+fmt(result.dice.max)+')'],
   ['Offense','Base '+fmt(result.attackStat)+' ('+esc(result.attackBand)+') ×'+fmt(result.offense)],
   ['Defense','Base '+fmt(result.defenseStat)+' ('+esc(result.defenseBand)+') ×'+fmt(result.defense)],
   ['STAB','×'+fmt(result.stab)],
   ['Type matchup','×'+fmt(result.typeMultiplier)+(result.matchup.calamitousSun?' (Calamitous Sun)':'')],
   ['Weather','×'+fmt(result.weatherMultiplier)],
   ['Critical','×'+fmt(result.criticalMultiplier)],
   ['Burn','×'+fmt(result.burnMultiplier)],
   ['Other modifier','×'+fmt(result.otherMultiplier)],
   ['Flat bonuses','+'+fmt(result.flatBonus)],
   ['Final multiplier','×'+fmt(result.totalMultiplier)],
   ['Reference AC',ac],
   ['Rounding',result.roundedBy]
  ].map(([k,v])=>'<div><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div>'+
  (result.itemNote?'<p class="hint">'+esc(result.itemNote)+'</p>':'')+
  (result.typeMultiplier===0?'<p class="flag">Type immunity: final damage is 0, even with flat item bonuses.</p>':'');
 }catch(e){target.innerHTML='<div class="calc-warning">'+esc(e.message||String(e))+'</div>'}
}
function changePokemon(which,value){
 if(which==='attackerId'){
  state.attackerId=value;state.moveName=attacker()?.moves?.[0]||'';
  state.moveType='normal';state.category='physical';state.dice='';state.diceTouched=false;state.typeTouched=false;state.categoryTouched=false;state.rolledDice=null;
  state.burned=/^burn/i.test(String(attacker()?.status||''));
  render();if(state.moveName)loadMove(state.moveName);
 }else{state.defenderId=value;render()}
}
async function fetchManual(side){
 const m=side==='attacker'?state.manualAttacker:state.manualDefender;
 const key=String(m.speciesName||'').trim().toLowerCase().replace(/\s+/g,'-');
 if(!/^[a-z0-9-]+$/.test(key))throw Error('Enter an official PokéAPI species name, such as Garchomp or Venusaur.');
 error('Looking up '+key+'…');
 const resp=await fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(key));
 if(!resp.ok)throw Error('PokéAPI could not find '+key);
 const official=fromPokeApi(await resp.json());
 Object.assign(m,{speciesName:official.speciesName,baseStats:official.baseStats,types:official.types,originalTypes:official.types.slice(),
  ability:official.abilities?.[0]||'',level:m.level});
 error('Official stats loaded for '+official.speciesName+'. Current and maximum HP remain editable.');
 render();
}
root.addEventListener('input',e=>{
 if(!e.target.closest('#damage-form'))return;
 if(['attackerId','defenderId','moveName'].includes(e.target.name))return;
 if(e.target.name==='dice'){state.diceTouched=true;state.rolledDice=null}
 if(e.target.name==='moveType')state.typeTouched=true;
 if(e.target.name==='category')state.categoryTouched=true;
 valuesFromForm();renderResult();
});
root.addEventListener('change',e=>{
 if(!e.target.closest('#damage-form'))return;
 const n=e.target.name;
 if(n==='attackerId'||n==='defenderId'){changePokemon(n,e.target.value);return}
 if(n==='moveName'){
  valuesFromForm();state.moveName=e.target.value;state.moveType='normal';state.category='physical';state.dice='';state.diceTouched=false;state.typeTouched=false;state.categoryTouched=false;state.rolledDice=null;
  render();loadMove(state.moveName);return;
 }
 if(n==='moveType')state.typeTouched=true;
 if(n==='category')state.categoryTouched=true;
 valuesFromForm();renderResult();
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const action=b.dataset.action;
 try{
  if(action==='roll'){
   valuesFromForm();
   state.rolledDice=rollDice(state.dice);
   error('');renderResult();
  }else if(action==='fetch-species'){
   valuesFromForm();b.disabled=true;
   await fetchManual(b.dataset.side);
  }
 }catch(err){error(err.message||String(err))}
 finally{if(b.isConnected)b.disabled=false}
});
root.addEventListener('submit',e=>e.preventDefault());
try{
 const config=window.SANTARA_FIREBASE_CONFIG;
 if(!config?.projectId)throw Error('Firebase configuration is missing.');
 app=getApps().length?getApp():initializeApp(config);auth=getAuth(app);db=getFirestore(app);
 stopAuth=onAuthStateChanged(auth,beginUser,e=>error('Firebase authentication error: '+e.message));
}catch(e){error('Could not initialize Firebase: '+(e.message||e));signedOut('Firebase setup needed')}
