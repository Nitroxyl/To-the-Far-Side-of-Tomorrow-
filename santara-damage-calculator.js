import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,getDocs,collection,query,where} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {applyMegaOverlays} from './pokemon-mega-assignments.js';
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
function makeChoices(gen,records,customSpecies){
  const mine=records.map(m=>({key:'r:'+m.id,label:displayName(m),source:m,kind:'registered'}));
  const customs=customSpecies.map(m=>({key:'c:'+m.slug,label:m.name+' · Santara custom',kind:'custom',source:{
    name:m.name,speciesName:m.name,speciesKey:m.slug,baseStats:m.baseStats,types:m.types,abilities:m.abilities,level:50
  }}));
  const official=[...gen.species].filter(m=>m.baseStats&&m.types?.length).map(m=>({
    key:'o:'+m.id,label:m.name,kind:'official',source:{
      name:m.name,speciesName:m.name,speciesKey:m.id,baseStats:{
        hp:m.baseStats.hp,attack:m.baseStats.atk,defense:m.baseStats.def,
        specialAttack:m.baseStats.spa,specialDefense:m.baseStats.spd,speed:m.baseStats.spe
      },types:m.types,ability:m.abilities?.[0]||'',level:50
    }
  }));
  return [...mine,...customs,...official];
}
function selectChoices(selected){
  let group='',out='';
  for(const item of choices) {
    const name=item.kind==='registered'?'Saved Trainer Pokémon':item.kind==='custom'?'Santara species':'Official Pokémon';
    if(group!==name){if(group)out+='</optgroup>';group=name;out+='<optgroup label="'+escape(name)+'">';}
    out+=option(item.key,item.label,selected);
  }
  return out+'</optgroup>';
}
function natureOptions(value){return natureNames.map(x=>option(x,x,value||'Serious')).join('');}
function typeOptions(value){return TYPE_NAMES.map(x=>option(x,x,value)).join('');}
function sideMarkup(side,title,selected){
  return '<section class="panel"><h2>'+title+'</h2>'+
  '<label class="field">Pokémon<select id="'+side+'-choice">'+selectChoices(selected)+'</select></label>'+
  '<div class="form-grid" style="margin-top:15px">'+
  '<label class="field">Level<input id="'+side+'-level" type="number" min="1" max="100" value="50"></label>'+
  '<label class="field">Nature<select id="'+side+'-nature">'+natureOptions('Serious')+'</select></label>'+
  '<label class="field full">Ability<input id="'+side+'-ability" list="calc-ability-list" placeholder="Ability"></label>'+
  '<label class="field full">Held item<input id="'+side+'-item" list="calc-item-list" placeholder="None"></label>'+
  '<label class="field">HP remaining (%)<input id="'+side+'-hp" type="number" min="1" max="100" value="100"></label>'+
  '<label class="field">Status<select id="'+side+'-status">'+
  ['None','Burned','Paralyzed','Poisoned','Badly poisoned','Asleep','Frozen'].map(x=>option(x,x,'None')).join('')+'</select></label>'+
  '<label class="field full"><input id="'+side+'-mega" type="checkbox"> Preview assigned Mega Evolution</label>'+
  '<label class="field"><input id="'+side+'-tera" type="checkbox"> Terastallized</label>'+
  '<label class="field">Tera type<select id="'+side+'-teratype">'+typeOptions('Normal')+'</select></label>'+
  '<label class="field full"><input id="'+side+'-dmax" type="checkbox"> Dynamaxed (HP preview)</label></div>'+
  '<details class="calc-advanced"><summary>EVs and stat stages</summary><p class="calc-muted">Every IV is internally fixed to 31. EVs start at 0, with normal 252-per-stat and 510-total limits.</p>'+
  '<div class="calc-ev">'+STATS.map(([key,label])=>'<label class="field">'+label+' EV<input id="'+side+'-ev-'+key+'" type="number" min="0" max="252" value="0"></label>').join('')+'</div>'+
  '<div class="calc-ev">'+[['atk','Attack'],['def','Defense'],['spa','Sp. Atk'],['spd','Sp. Def']].map(([key,label])=>'<label class="field">'+label+' stage<input id="'+side+'-boost-'+key+'" type="number" min="-6" max="6" value="0"></label>').join('')+'</div></details>'+
  '</section>';
}
function fieldMarkup() {
  return '<section class="panel"><h2>Move and battlefield</h2><div class="form-grid">'+
  '<label class="field full">Move<input id="damage-move" list="calc-move-list" placeholder="Flamethrower" required></label>'+
  '<label class="field">Battle mode<select id="damage-mode">'+option('Singles','Singles','Doubles')+option('Doubles','Doubles','Doubles')+'</select></label>'+
  '<label class="field">Weather<select id="damage-weather">'+
  ['Auto','Clear','Sun','Rain','Sand','Snow','Calamitous Sun','Royal Tempest'].map(x=>option(x,x,'Auto')).join('')+'</select></label>'+
  '<label class="field">Terrain<select id="damage-terrain">'+
  ['','Electric','Grassy','Misty','Psychic'].map(x=>option(x,x||'None','')).join('')+'</select></label>'+
  '<label class="field">Number of hits<input id="damage-hits" type="number" min="0" max="10" value="0"><small class="calc-muted">0 = move default</small></label>'+
  '<label class="field full"><input id="damage-crit" type="checkbox"> Critical hit</label>'+
  '<label class="field"><input id="damage-reflect" type="checkbox"> Defender Reflect</label>'+
  '<label class="field"><input id="damage-screen" type="checkbox"> Defender Light Screen</label>'+
  '<label class="field"><input id="damage-veil" type="checkbox"> Defender Aurora Veil</label>'+
  '<label class="field"><input id="damage-help" type="checkbox"> Attacker Helping Hand</label>'+
  '<label class="field full"><input id="damage-exposed" type="checkbox"> Defender Exposed (System Override)</label>'+
  '</div><div class="calc-actions" style="margin-top:20px"><button class="btn primary" id="damage-run" type="button">Calculate damage</button><button class="btn" id="damage-reload" type="button">Reload Pokémon</button></div>'+
  '<p class="calc-muted">Uses Pokémon generation 9 damage, with Santara overrides where implemented. Move accuracy, positioning, switching and residual turns are resolved separately during play.</p>'+
  '</section>';
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
  el(side+'-ability').value=source.ability||source.abilities?.[0]||'';
  el(side+'-item').value=source.heldItem||'';
  el(side+'-nature').value=source.nature||'Serious';
  el(side+'-status').value=source.status||'None';
  el(side+'-hp').value=source.currentHp!=null&&source.maxHp?Math.max(1,Math.round(100*source.currentHp/source.maxHp)):100;
  el(side+'-mega').checked=!!source.megaActive;
  el(side+'-mega').disabled=!source.megaForm;
  el(side+'-tera').checked=!!source.teraActive;
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
  const pct=res.maxPercent>0?Math.min(100,res.maxPercent):0;
  const notices=res.notes.map(s=>'<div class="calc-note">'+escape(s)+'</div>').join('');
  const warnings=res.warnings.map(s=>'<div class="calc-warning">'+escape(s)+'</div>').join('');
  const ko=res.koChance===100?'Guaranteed OHKO at current HP':res.koChance===0?'No single-hit OHKO':res.koChance.toFixed(1)+'% single-hit KO chance (sampled rolls)';
  el('damage-results').innerHTML='<section class="calc-result" aria-live="polite">'+
    '<span class="eyebrow">DAMAGE RANGE</span><p><strong>'+res.min+'–'+res.max+' HP</strong></p>'+
    '<p><b>'+res.minPercent.toFixed(1)+'–'+res.maxPercent.toFixed(1)+'%</b> of '+res.defenderHP+' max HP · '+ko+'</p>'+
    '<div class="meter"><span style="width:'+pct.toFixed(2)+'%"></span></div>'+
    '<div class="calc-pills"><span class="chip">'+escape(res.meta.category)+' · '+escape(res.meta.type)+'</span>'+
    '<span class="chip">BP '+escape(res.basePower)+'</span><span class="chip">Accuracy '+escape(res.accuracy??'—')+'</span>'+
    '<span class="chip">'+escape(res.weather)+' weather</span>'+
    '<span class="chip">'+escape(res.meta.hits)+' hit(s)</span>'+
    '<span class="chip">HP now '+res.currentDefHP+'/'+res.defenderHP+'</span></div>'+
    '<p class="calc-muted">Cartridge-style random damage rolls. A hit is assumed; accuracy and the chance of landing it are not included in KO chance.</p>'+
    (res.fullDescription?'<p class="calc-muted">'+escape(res.fullDescription)+'</p>':'')+
    warnings+notices+'</section>';
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
      exposed:el('damage-exposed').checked
    });
    showResult(result);msg('');
  }catch(err){msg('Calculation failed: '+(err.message||String(err)));el('damage-results').innerHTML='';console.error('Santara damage calculator',err);}
}
function draw() {
  if(!engine()){host.innerHTML='<section class="panel"><h2>Calculation engine did not load</h2><p>The calculator relies on the pinned @smogon/calc 0.12.0 browser scripts. Check your connection or content blocker, then reload this page.</p></section>';return;}
  const saved=choices.find(x=>x.kind==='registered')?.key;
  const chosenA=saved||'o:charizard';
  const chosenB=choices.find(x=>x.kind==='registered'&&x.key!==saved)?.key||'o:tyranitar';
  const list=(values)=>values.map(x=>'<option value="'+escape(x)+'"></option>').join('');
  host.innerHTML='<div class="calc-grid">'+sideMarkup('a','Attacker',chosenA)+sideMarkup('d','Defender',chosenB)+
    '</div><div style="height:18px"></div>'+fieldMarkup()+'<div id="damage-results" style="margin-top:18px"></div>'+
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
    customMoves=m.docs.map(d=>({slug:d.id,...d.data()}));
    customAbilities=ab.docs.map(d=>({slug:d.id,...d.data()}));
    const customSpecies=c.docs.map(d=>({slug:d.id,...d.data()}));
    const gen=engine().Generations.get(9);
    choices=makeChoices(gen,records,customSpecies);
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
host.addEventListener('change',e=>{
  if(e.target.id==='a-choice')refreshSide('a');
  if(e.target.id==='d-choice')refreshSide('d');
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
