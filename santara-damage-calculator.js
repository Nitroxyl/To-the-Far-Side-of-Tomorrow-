import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,getDocs,collection,query,where} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {applyMegaOverlays} from './pokemon-mega-assignments.js';
import {playerVisibleCustomSpecies} from './santara-spoiler-gates.js';
import {computeDamage,titleType} from './santara-damage-core.js?v=v6-20261113-1';

const gm=window.SANTARA_POKEMON_EDITION==='gm',host=document.querySelector('#calc-app');
const chip=document.querySelector('#user-chip'),feedback=document.querySelector('#calc-feedback');
const config=window.SANTARA_FIREBASE_CONFIG,escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canon=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const option=(key,label,selected)=>'<option value="'+escape(key)+'"'+(key===selected?' selected':'')+'>'+escape(label)+'</option>';
const STATS=[['hp','HP'],['atk','Attack'],['def','Defense'],['spa','Sp. Atk'],['spd','Sp. Def'],['spe','Speed']];
const TYPE_NAMES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
let app,auth,store,session,choices=[],byKey=new Map(),moves=[],abilities=[],items=[],natureNames=[],customMoves=[],customAbilities=[],loaded=false;
function msg(text){feedback.textContent=text||'';}
function engine(){return window.calc?.Generations?.get?window.calc:null;}
function signin(){
  host.innerHTML='<section class="panel"><h2>Sign in to calculate battles</h2><p>Use your existing Santara Trainer account to access your Pokémon. The GM edition uses your GM access.</p>'+
    '<form id="damage-login" class="form-grid"><label class="field">Email<input type="email" name="email" required autocomplete="email"></label>'+
    '<label class="field">Password<input type="password" name="password" required autocomplete="current-password"></label>'+
    '<div class="actions"><button class="btn primary" type="submit">Sign in</button><button class="btn" type="button" id="damage-google">Google sign-in</button></div></form></section>';
}
function displayName(p){return (p.nickname?p.nickname+' · ':'')+(p.speciesName||p.name||p.speciesKey||'Pokémon')+' (Lv '+(p.level||50)+')';}
function combineByName(base,overrides){
 const map=new Map();
 for(const record of [...base,...overrides])if(record?.name)map.set(canon(record.name),record);
 return [...map.values()];
}
async function gmContentPresets(){
 if(!gm)return {species:[],megas:[],moves:[],abilities:[]};
 const groups={species:[],megas:[],moves:[],abilities:[]};
 try{
  const mod=await import('./santara-catalog.js');
  for(const group of ['fossils','megas','story','drafts']){
   for(const entry of mod.santaraCatalogEntries(group)){
    const table=entry.collection;
    const type=table==='santara_species_overrides'?'species':
      table==='santara_mega_forms'?'megas':
      table==='santara_custom_moves'?'moves':
      table==='santara_custom_abilities'?'abilities':null;
    if(type)groups[type].push({slug:entry.id,...entry.data});
   }
  }
 }catch(error){console.warn('Optional GM presets unavailable:',error.message)}
 return groups;
}
function gmMegaChoices(gen,megaForms,customSpecies){
 if(!gm)return [];
 return megaForms.filter(form=>form?.name&&form?.baseStats&&form?.baseSpeciesKey).map(form=>{
  const base=gen.species.get(canon(form.baseSpeciesKey));
  const custom=customSpecies.find(c=>canon('custom:'+c.slug)===canon(form.baseSpeciesKey));
  const raw=base?.baseStats;
  const ordinaryStats=raw?{
   hp:raw.hp,attack:raw.atk,defense:raw.def,specialAttack:raw.spa,specialDefense:raw.spd,speed:raw.spe
  }:(custom?.baseStats||form.baseStats);
  const normalTypes=base?.types||custom?.types||form.types;
  const baseAbility=base?.abilities?.[0]||custom?.abilities?.[0]||'';
  const source={
   name:form.name,speciesName:base?.name||custom?.name||form.baseSpeciesKey,
   speciesKey:form.baseSpeciesKey,baseStats:ordinaryStats,types:normalTypes,
   ability:baseAbility,level:50,megaForm:form,megaActive:true,heldItem:''
  };
  return {key:'gmmega:'+form.slug,label:form.name+' · GM preview',kind:'mega',
   source,generation:base?generationOf(form.baseSpeciesKey):null};
 });
}

function makeChoices(gen,records,customSpecies,megaForms=[]){
  const mine=records.map(m=>({key:'r:'+m.id,label:displayName(m),source:m,kind:'registered',generation:generationOf(m.speciesKey)}));
  const customs=customSpecies.map(m=>({key:'c:'+m.slug,label:m.name+' · Santara custom',kind:'custom',generation:null,source:{
    name:m.name,speciesName:m.name,speciesKey:m.slug,baseStats:m.baseStats,types:m.types,abilities:m.abilities,level:50
  }}));
  const official=[...gen.species].filter(m=>m.baseStats&&m.types?.length).map(m=>({
    key:'o:'+m.id,label:m.name,kind:'official',generation:generationOf(m.id),source:{
      name:m.name,speciesName:m.name,speciesKey:m.id,baseStats:{
        hp:m.baseStats.hp,attack:m.baseStats.atk,defense:m.baseStats.def,
        specialAttack:m.baseStats.spa,specialDefense:m.baseStats.spd,speed:m.baseStats.spe
      },types:m.types,ability:m.abilities?.[0]||'',level:50
    }
  }));
  return [...mine,...gmMegaChoices(gen,megaForms,customSpecies),...customs,...official];
}
function generationOf(species) {
  const key=canon(species);
  if(!key)return null;
  for(let n=1;n<=9;n++){
    try{if(engine()?.Generations.get(n).species.get(key))return n}
    catch{continue}
  }
  return null;
}
function matchingChoices(query) {
  const text=String(query||'').trim().toLowerCase();
  if(!text)return choices;
  const gen=text.match(/^(?:gen(?:eration)?\s*|g)([1-9])(?:\s+(.+))?$/);
  const paldea=text.match(/^paldea(?:\s+(.+))?$/);
  const generation=gen?Number(gen[1]):paldea?9:null;
  const needle=(gen?gen[2]:paldea?paldea[1]:text)||'';
  const tokens=needle.trim().split(/\s+/).filter(Boolean).map(canon);
  return choices.filter(item=>{
    if(generation!==null&&item.generation!==generation)return false;
    const haystack=canon([item.label,item.source?.speciesName,item.source?.nickname,item.source?.speciesKey].join(' '));
    return tokens.every(token=>haystack.includes(token));
  });
}
function selectChoices(selected,items=choices){
  let group='',out='';
  for(const item of items) {
    const name=item.kind==='registered'?'Saved Trainer Pokémon':item.kind==='mega'?'GM Mega previews':item.kind==='custom'?'Santara species':'Official Pokémon';
    if(group!==name){if(group)out+='</optgroup>';group=name;out+='<optgroup label="'+escape(name)+'">';}
    out+=option(item.key,item.label,selected);
  }
  return out+(group?'</optgroup>':'');
}
function filterPokemon(side) {
  const search=el(side+'-search'),select=el(side+'-choice'),count=el(side+'-match-count');
  if(!search||!select)return;
  const previous=select.value;
  const matches=matchingChoices(search.value);
  if(!matches.length){
    const current=byKey.get(previous);
    select.innerHTML=current?option(current.key,current.label,current.key):'<option value="">No results</option>';
    count.textContent='No matches. Try another name.';
    return;
  }
  const selected=matches.some(item=>item.key===previous)?previous:matches[0].key;
  select.innerHTML=selectChoices(selected,matches);
  select.value=selected;
  count.textContent=search.value.trim()?matches.length+' matching Pokémon':'Search by name, nickname, or generation.';
  if(selected!==previous){refreshSide(side);runCalculation()}
}
function natureOptions(value){return natureNames.map(x=>option(x,x,value||'Serious')).join('');}
function typeOptions(value){return TYPE_NAMES.map(x=>option(x,x,value)).join('');}
function toggleMarkup(id,label){
  return '<label class="calc-toggle" for="'+id+'"><input id="'+id+'" type="checkbox"><span>'+label+'</span></label>';
}
function sideMarkup(side,title,selected){
  return '<section class="panel calc-combatant"><h2>'+title+'</h2>'+
  '<label class="field calc-pokemon-search" for="'+side+'-search">Search Pokémon<input id="'+side+'-search" type="search" autocomplete="off" aria-controls="'+side+'-choice" placeholder="Name, nickname, or Gen 9"></label>'+
  '<label class="field">Pokémon<select id="'+side+'-choice">'+selectChoices(selected)+'</select></label>'+
  '<p class="calc-match-count" id="'+side+'-match-count" aria-live="polite">Search by name, nickname, or generation.</p>'+
  '<div class="form-grid" style="margin-top:14px">'+
  '<label class="field">Level<input id="'+side+'-level" type="number" min="1" max="100" value="50"></label>'+
  '<label class="field">Nature<select id="'+side+'-nature">'+natureOptions('Serious')+'</select></label>'+
  '<label class="field full">Ability<input id="'+side+'-ability" list="calc-ability-list" placeholder="Ability"></label>'+
  '<label class="field full">Held item<input id="'+side+'-item" list="calc-item-list" placeholder="None"></label>'+
  '<label class="field">HP remaining (%)<input id="'+side+'-hp" type="number" min="1" max="100" value="100"></label>'+
  '<label class="field">Status<select id="'+side+'-status">'+
    ['None','Burned','Paralyzed','Poisoned','Badly poisoned','Asleep','Frozen'].map(x=>option(x,x,'None')).join('')+
  '</select></label>'+
  '<div class="calc-transformations"><span>Battle transformations</span>'+
  '<div class="calc-toggle-grid">'+
  toggleMarkup(side+'-mega','Mega')+
  toggleMarkup(side+'-tera','Tera')+
  toggleMarkup(side+'-dmax','Dynamax')+'</div>'+
  '<label class="field calc-tera-type" id="'+side+'-tera-wrap" hidden>Tera type<select id="'+side+'-teratype">'+typeOptions('Normal')+'</select></label>'+
  '</div></div>'+
  '<details class="calc-advanced"><summary>EVs and stat stages</summary><p class="calc-muted">Every IV is fixed to 31. EVs default to 0 (252 per stat, 510 total).</p>'+
  '<div class="calc-ev">'+STATS.map(([key,label])=>'<label class="field">'+label+' EV<input id="'+side+'-ev-'+key+'" type="number" min="0" max="252" value="0"></label>').join('')+'</div>'+
  '<div class="calc-ev">'+[['atk','Attack'],['def','Defense'],['spa','Sp. Atk'],['spd','Sp. Def']].map(([key,label])=>'<label class="field">'+label+' stage<input id="'+side+'-boost-'+key+'" type="number" min="-6" max="6" value="0"></label>').join('')+'</div></details>'+
  '</section>';
}
function quickMarkup(){
  return '<section class="panel calc-quick"><div class="calc-quick-head"><h2>Attack preview</h2><span class="calc-muted">Standard Pokémon damage</span></div>'+
    '<div class="calc-quick-grid">'+
    '<label class="field calc-field-move">Move<input id="damage-move" list="calc-move-list" placeholder="e.g. Flamethrower" required></label>'+
    '<label class="field">Weather<select id="damage-weather">'+
      (gm?['Auto','Clear','Sun','Rain','Sand','Snow','Calamitous Sun','Royal Tempest']:['Auto','Clear','Sun','Rain','Sand','Snow']).map(x=>option(x,x,'Auto')).join('')+
    '</select></label>'+
    '<label class="field">Battle mode<select id="damage-mode">'+option('Singles','Singles','Doubles')+option('Doubles','Doubles','Doubles')+'</select></label>'+
    '<div class="calc-actions"><button class="btn primary" id="damage-run" type="button">Calculate</button><button class="btn" id="damage-reload" type="button" title="Reload saved Pokémon">↻</button></div>'+
    '</div></section>'+
    '<div id="damage-results" class="calc-sticky-result" role="status" aria-live="polite"></div>';
}
function fieldMarkup(){
  return '<section class="panel calc-options"><details>'+
    '<summary>Advanced battlefield conditions <span class="calc-muted">— Terrain, screens, critical hits and more</span></summary>'+
    '<div class="calc-option-grid">'+
    '<label class="field">Terrain<select id="damage-terrain">'+['','Electric','Grassy','Misty','Psychic'].map(x=>option(x,x||'None','')).join('')+'</select></label>'+
    '<label class="field">Number of hits<input id="damage-hits" type="number" min="0" max="10" value="0"><small class="calc-muted">0 = move default</small></label>'+
    toggleMarkup('damage-crit','Critical hit')+
    toggleMarkup('damage-reflect','Reflect')+
    toggleMarkup('damage-screen','Light Screen')+
    toggleMarkup('damage-veil','Aurora Veil')+
    toggleMarkup('damage-help','Helping Hand')+
    toggleMarkup('damage-exposed','Target is Exposed')+
    toggleMarkup('damage-chorus','Aurora Chorus veil active')+
    toggleMarkup('damage-siege','Siege Battery +1 Sp. Atk earned')+
    toggleMarkup('damage-protect','Defender used Protect')+
    '</div><p class="calc-muted">Check Aurora Chorus veil only while its 5-turn effect is active. The Siege Battery bonus applies after a hit triggers it. Exposed applies to System Override and Glitch Pulse.</p><p class="calc-muted">The calculator previews damage only; accuracy, movement, turn restrictions and residual effects are resolved separately.</p>'+
    '</details></section>';
}
function el(key){return document.getElementById(key);}
function readStr(key){return el(key)?.value||'';}
function readNum(key,fallback=0){const n=Number(readStr(key));return Number.isFinite(n)?n:fallback;}
function readSide(side){
  return {
    level:readNum(side+'-level',50),nature:readStr(side+'-nature'),
    ability:readStr(side+'-ability'),item:readStr(side+'-item'),
    hpPercent:readNum(side+'-hp',100),status:readStr(side+'-status'),
    mega:el(side+'-mega').checked,tera:el(side+'-tera').checked,
    teraType:readStr(side+'-teratype'),dynamax:el(side+'-dmax').checked,
    evs:Object.fromEntries(STATS.map(([key])=>[key,readNum(side+'-ev-'+key)])),
    boosts:Object.fromEntries(['atk','def','spa','spd'].map(key=>[key,readNum(side+'-boost-'+key)]))
  };
}
function sourceFor(side){return byKey.get(readStr(side+'-choice'))?.source;}
function refreshSide(side) {
  const source=sourceFor(side);
  if(!source)return;
  el(side+'-level').value=source.level||50;
  el(side+'-ability').value=(source.megaActive&&source.megaForm?.ability)||source.ability||source.abilities?.[0]||'';
  el(side+'-item').value=source.heldItem||'';
  el(side+'-nature').value=source.nature||'Serious';
  el(side+'-status').value=source.status||'None';
  el(side+'-hp').value=source.currentHp!=null&&source.maxHp?Math.max(1,Math.round(100*source.currentHp/source.maxHp)):100;
  el(side+'-mega').checked=!!source.megaActive;
  el(side+'-mega').disabled=!source.megaForm;
  el(side+'-tera').checked=!!source.teraActive;
  updateTeraVisibility(side);
  el(side+'-teratype').value=titleType(source.teraType||source.types?.[0]||'Normal');
  el(side+'-dmax').checked=!!source.dynamaxTurns;
  for(const [key] of STATS)el(side+'-ev-'+key).value='0';
  for(const key of ['atk','def','spa','spd'])el(side+'-boost-'+key).value='0';
  if(side==='a'){
    const preferred=(source.moves||[]).find(name=>{
      const m=customMoves.find(x=>canon(x.name)===canon(name));
      const standard=engine()?.Generations.get(9).moves.get(canon(name));
      return (m?.power??standard?.basePower??0)>0;
    });
    el('damage-move').value=preferred||'Flamethrower';
  }
}
function showResult(res) {
  const pct=Math.min(100,Math.max(0,res.maxPercent||0));
  const spoilerWeather=!gm&&['Calamitous Sun','Royal Tempest'].includes(res.weather);
  const notices=spoilerWeather?'<div class="calc-note">An exclusive weather effect is active. Ask the GM for its details.</div>':res.notes.map(s=>'<div class="calc-note">'+escape(s)+'</div>').join('');
  const warnings=res.warnings.map(s=>'<div class="calc-warning">'+escape(s)+'</div>').join('');
  const ko=res.koChance===100?'Guaranteed OHKO':res.koChance===0?'No OHKO':res.koChance.toFixed(1)+'% OHKO chance';
  const more=res.warnings.length?' · '+res.warnings.length+' manual check'+(res.warnings.length===1?'':'s'):'';
  el('damage-results').innerHTML='<section class="calc-result">'+
    '<div class="calc-result-main"><div><span class="eyebrow">ESTIMATED DAMAGE</span>'+
    '<div class="calc-result-value">'+res.min+'–'+res.max+' HP</div>'+
    '<div class="calc-result-sub">'+res.minPercent.toFixed(1)+'–'+res.maxPercent.toFixed(1)+'% of target max HP ('+res.defenderHP+')</div>'+
    '</div><div class="calc-result-ko">'+ko+'<div class="calc-result-sub">Current HP: '+res.currentDefHP+'/'+res.defenderHP+'</div></div></div>'+
    '<div class="meter"><span style="width:'+pct.toFixed(2)+'%"></span></div>'+
    '<details class="calc-result-details"><summary>Damage details'+more+'</summary>'+
    '<div class="calc-pills"><span class="chip">'+escape(res.meta.category)+' · '+escape(res.meta.type)+'</span>'+
    '<span class="chip">BP '+escape(res.basePower)+'</span><span class="chip">Accuracy '+escape(res.accuracy??'—')+'</span>'+
    '<span class="chip">'+escape(spoilerWeather?'Exclusive':res.weather)+' weather</span>'+
    '<span class="chip">'+escape(res.meta.hits)+' hit(s)</span></div>'+
    '<p class="calc-muted">The OHKO estimate assumes the attack connects and excludes accuracy and other turn effects.</p>'+
    (!spoilerWeather&&res.fullDescription?'<p class="calc-muted">'+escape(res.fullDescription)+'</p>':'')+
    warnings+notices+'</details></section>';
}
function runCalculation() {
  try{
    const attacker=sourceFor('a'),defender=sourceFor('d');
    const result=computeDamage(engine(),{
      attacker,defender,moveName:readStr('damage-move'),
      attackerSettings:readSide('a'),defenderSettings:readSide('d'),
      customMoves,customAbilities,
      weather:readStr('damage-weather'),terrain:readStr('damage-terrain'),
      gameType:readStr('damage-mode'),reflect:el('damage-reflect').checked,
      lightScreen:el('damage-screen').checked,auroraVeil:el('damage-veil').checked,
      helpingHand:el('damage-help').checked,
      critical:el('damage-crit').checked,hits:readNum('damage-hits'),
      exposed:el('damage-exposed').checked,
      auroraChorusActive:el('damage-chorus').checked,
      siegeBoosted:el('damage-siege').checked,
      protection:el('damage-protect').checked
    });
    showResult(result);msg('');
  }catch(err){msg('Calculation failed: '+(err.message||String(err)));el('damage-results').innerHTML='';console.error('Santara damage calculator',err);}
}
function draw() {
  if(!engine()){host.innerHTML='<section class="panel"><h2>Calculation engine did not load</h2><p>The calculator relies on the pinned @smogon/calc 0.12.0 browser scripts. Check your connection or content blocker, then reload this page.</p></section>';return;}
  const saved=choices.find(x=>x.kind==='registered')?.key;
  const linked=new URLSearchParams(location.search).get('attacker');
  const chosenA=(linked&&byKey.has('r:'+linked)?'r:'+linked:null)||saved||'o:charizard';
  const chosenB=choices.find(x=>x.kind==='registered'&&x.key!==chosenA)?.key||'o:tyranitar';
  const list=(values)=>values.map(x=>'<option value="'+escape(x)+'"></option>').join('');
  host.innerHTML=quickMarkup()+'<div class="calc-grid">'+sideMarkup('a','Attacker',chosenA)+sideMarkup('d','Defender',chosenB)+
    '</div>'+fieldMarkup()+
    '<datalist id="calc-move-list">'+list(moves)+'</datalist><datalist id="calc-ability-list">'+list(abilities)+'</datalist>'+
    '<datalist id="calc-item-list">'+list(items)+'</datalist>';
  refreshSide('a');refreshSide('d');runCalculation();
}
async function reloadData(){
  if(!session)return;
  loaded=false;host.innerHTML='<section class="panel">Loading available Pokémon and custom content…</section>';
  msg('');
  if(!engine()){draw();return;}
  const all=gm?collection(store,'santara_pokemon'):query(collection(store,'santara_pokemon'),where('ownerUid','==',session.uid));
  const mega=gm?collection(store,'santara_pokemon_mega_assignments'):query(collection(store,'santara_pokemon_mega_assignments'),where('ownerUid','==',session.uid));
  try{
    const [p,a,m,ab,c]=await Promise.all([
      getDocs(all),getDocs(mega),getDocs(collection(store,'santara_custom_moves')),
      getDocs(collection(store,'santara_custom_abilities')),getDocs(collection(store,'santara_species_overrides'))
    ]);
    if(!session)return;
    const records=applyMegaOverlays(p.docs.map(d=>({id:d.id,...d.data()})),
      Object.fromEntries(a.docs.map(d=>[d.id,d.data()])));
    const presets=await gmContentPresets();
    const liveMega=gm?await getDocs(collection(store,'santara_mega_forms'))
      .then(snapshot=>snapshot.docs.map(d=>({slug:d.id,...d.data()})))
      .catch(error=>{console.warn('GM Mega preview collection unavailable:',error.message);return [];}):[];
    customMoves=combineByName(presets.moves,m.docs.map(d=>({slug:d.id,...d.data()})));
    customAbilities=combineByName(presets.abilities,ab.docs.map(d=>({slug:d.id,...d.data()})));
    const allCustomSpecies=combineByName(presets.species,c.docs.map(d=>({slug:d.id,...d.data()})));
    const customSpecies=gm?allCustomSpecies:playerVisibleCustomSpecies(allCustomSpecies,records);
    const megaForms=combineByName(presets.megas,liveMega);
    const gen=engine().Generations.get(9);
    choices=makeChoices(gen,records,customSpecies,megaForms);
    byKey=new Map(choices.map(x=>[x.key,x]));
    moves=[...new Set([...customMoves.map(x=>x.name),...[...gen.moves].map(x=>x.name)])].sort((a,b)=>a.localeCompare(b));
    abilities=[...new Set([...customAbilities.map(x=>x.name),...[...gen.abilities].map(x=>x.name)])].sort();
    items=[...gen.items].map(x=>x.name).sort();
    natureNames=[...gen.natures].map(x=>x.name).sort();
    loaded=true;draw();
  }catch(e){host.innerHTML='<section class="panel"><h2>Pokémon records could not load</h2><p>'+escape(e.message||String(e))+'</p><p>Sign into an approved Santara account and verify the published Firebase rules.</p><button class="btn" id="damage-reload">Retry</button></section>';msg('Cannot load calculator data.');}
}
host.addEventListener('click',e=>{
  if(e.target.closest('#damage-run'))runCalculation();
  if(e.target.closest('#damage-reload'))reloadData();
  if(e.target.closest('#damage-google'))signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>msg(e.message));
});
function updateTeraVisibility(side){
  const wrap=el(side+'-tera-wrap'),toggle=el(side+'-tera');
  if(wrap&&toggle)wrap.hidden=!toggle.checked;
}
host.addEventListener('change',e=>{
  if(e.target.id==='a-choice')refreshSide('a');
  if(e.target.id==='d-choice')refreshSide('d');
  if(['a-mega','d-mega'].includes(e.target.id)){
    const side=e.target.id[0],source=sourceFor(side);
    if(source?.megaForm)el(side+'-ability').value=e.target.checked?source.megaForm.ability:source.ability||source.abilities?.[0]||'';
  }
  if(['a-tera','d-tera'].includes(e.target.id))updateTeraVisibility(e.target.id[0]);
  if(e.target.closest('#calc-app')&&el('damage-results'))runCalculation();
});
let inputRecalc=null;
host.addEventListener('input',e=>{
  if(['a-search','d-search'].includes(e.target.id)){filterPokemon(e.target.id[0]);return;}
  if(!e.target.matches('input[type=text],input[type=number],input:not([type]),select'))return;
  if(!el('damage-results'))return;
  clearTimeout(inputRecalc);
  inputRecalc=setTimeout(runCalculation,280);
});
host.addEventListener('submit',async e=>{
  if(e.target.id!=='damage-login')return;
  e.preventDefault();
  try{await signInWithEmailAndPassword(auth,e.target.email.value,e.target.password.value)}
  catch(err){msg(err.message||String(err))}
});
if(!config?.apiKey||!config?.projectId){host.innerHTML='<section class="panel">Firebase configuration is missing. Ask the GM to deploy firebase-config.js.</section>';}
else {
  app=getApps().length?getApp():initializeApp(config);auth=getAuth(app);store=getFirestore(app);
  onAuthStateChanged(auth,u=>{
    session=u;chip.textContent=u?.email||'Not signed in';msg('');
    if(!u){loaded=false;signin();return;}
    if(!gm&&!u.emailVerified){host.innerHTML='<section class="panel">Verify your email and obtain GM approval before loading your team.</section>';return;}
    reloadData();
  });
}
