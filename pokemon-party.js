import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot,setDoc,addDoc,deleteDoc,writeBatch,updateDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {statKeys,statLabels,validStats,maxHpV4Baseline,combatSummary,fromPokeApi,V52_TIERS} from './pokemon-math.js?v=v52-requests-20261025-2';

const GM_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const GM_SITE=window.SANTARA_POKEMON_EDITION==='gm';
const root=document.getElementById('party-root');
const feedback=document.getElementById('feedback');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]||''));
const safeUrl=v=>/^https:\/\//i.test(String(v||''))?String(v):'';
const safeImageData=v=>typeof v==='string'&&v.length<=150000&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(v)?v:'';
const cap=(s,n)=>String(s??'').trim().slice(0,n);
const option=(value,label,selected)=>`<option value="${esc(value)}"${String(value)===String(selected)?' selected':''}>${esc(label)}</option>`;
const opts=(values,selected)=>values.map(v=>option(v,v,selected)).join('');
const statuses=['None','Burned','Poisoned','Badly poisoned','Paralyzed','Asleep','Frozen'];
const STAT_NAMES=['HP','Atk','Def','SpA','SpD','Spe'];
const apiCache=new Map(),moveCache=new Map();
let app,auth,store,user=null,allowed=false,stopAccess=null,stopPokemon=null,stopApprovals=null,stopCustoms=null,stopRequests=null,stopCards=null,stopMoves=null,stopAbilities=null;
let pokemon=[],trainers=[],trainerCards=[],customs=[],customMoves=[],customAbilities=[],requests=[],battleRules=null,stopRules=null,view='party',chosen='',ownerFilter='',editingId='',draft=null,requestDraft=null,activeRequestId='',returnToAssign=false,collectionReady=false,collectionError='',moveInfo={},busy=false;

document.getElementById('edition-name').textContent=GM_SITE?'GM CONSOLE / TEAM MANAGEMENT':'POKÉDEX / TRAINER COLLECTION';
document.getElementById('page-title').innerHTML=GM_SITE?'Trainer Pokémon<span class="accent">.</span>':'My Pokémon<span class="accent">.</span>';
document.getElementById('page-lead').textContent=GM_SITE?'Assign Pokémon, import official stats, register custom forms and manage party progression.':'Track your active team, storage, HP and battle notes across devices.';
document.getElementById('passport-link').textContent=GM_SITE?'Trainer approvals':'Trainer Cards';
document.getElementById('passport-link').href=GM_SITE?'./index.html?tab=approvals':'./index.html?tab=trainer';

function say(s){feedback.textContent=s||''}
function fail(e){say(e?.message||String(e))}
const TRAINER_FALLBACK='Trainer';
function trainerLabel(uid){
 const card=trainerCards.find(c=>c.uid===uid);
 const name=cap(card?.trainerName,32);
 if(name && name.toLowerCase()!=='new trainer')return name;
 return `${TRAINER_FALLBACK} #${String(uid).slice(0,6)}`;
}
function customMoveByName(name){
 return customMoves.find(x=>x.name.toLowerCase()===String(name||'').trim().toLowerCase());
}
function customAbilityByName(name){
 return customAbilities.find(x=>x.name.toLowerCase()===String(name||'').trim().toLowerCase());
}
function registrationMoves(fd){
 const names=Array.from({length:4},(_,i)=>cap(fd.get('move'+(i+1)),48)).filter(Boolean);
 if(names.some(m=>m.includes(',')))throw Error('Enter only one move in each slot.');
 if(new Set(names.map(m=>m.toLowerCase())).size!==names.length)throw Error('A Pokémon cannot know the same move twice.');
 return names;
}
function moveOptions(mon){
 const names=[...(mon?.knownMoves||[]),...customMoves.map(m=>m.name)];
 const used=new Set();
 return names.filter(name=>{const key=String(name).toLowerCase();if(!key||used.has(key))return false;used.add(key);return true})
   .sort((a,b)=>String(a).localeCompare(String(b))).slice(0,500);
}
function copyAssignmentDraft(){
 const form=document.getElementById('assign-form');if(!form)return;
 const fd=new FormData(form);
 const current=draft||pokemon.find(m=>m.id===editingId)||{};
 draft={...current,speciesName:cap(fd.get('species'),85),
  ownerUid:String(fd.get('ownerUid')||ownerFilter),
  level:Number(fd.get('level'))||5,nickname:cap(fd.get('nickname'),32),
  ability:cap(fd.get('ability'),48),maxHp:Number(fd.get('maxHp'))||current.maxHp||0,
  currentHp:Number(fd.get('currentHp')),slot:Number(fd.get('slot'))||0,
  heldItem:cap(fd.get('heldItem'),80),moves:Array.from({length:4},(_,i)=>cap(fd.get('move'+(i+1)),48)).filter(Boolean),
  origin:cap(fd.get('origin'),150),notes:cap(fd.get('notes'),1000)};
}
function catalogReturn(){
 if(returnToAssign){
  returnToAssign=false;view='assign';render();
 }else clearSelection();
}
function catalogForm(kind){
 const isMove=kind==='move';
 const options=isMove?customMoves:customAbilities;
 return `<section class="panel">
 <div class="toolbar"><h2>${isMove?'Define custom move':'Define custom ability'}</h2><button class="btn" type="button" data-act="catalog-back">← Back</button></div>
 <p>Definitions are reusable across Santara Pokémon and saved to Firestore. Existing Pokémon can select them without changing their base stats.</p>
 <form id="${isMove?'custom-move-form':'custom-ability-form'}" class="form-grid">
 <label class="field full">Name<input name="name" maxlength="48" required placeholder="${isMove?'e.g. Primordial Crush':'e.g. Apex Predator'}" list="registered-names"></label>
 <datalist id="registered-names">${options.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist>
 ${isMove?`<label class="field">Type<select name="type">${['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'].map(t=>option(t,t[0].toUpperCase()+t.slice(1),'dragon')).join('')}</select></label>
 <label class="field">Category<select name="category">${['Physical','Special','Status'].map(t=>option(t,t,'Physical')).join('')}</select></label>
 <label class="field">Base Power (optional)<input name="power" type="number" min="0" max="300" placeholder="e.g. 90"></label>
 <label class="field">Accuracy % (optional)<input name="accuracy" type="number" min="1" max="100" placeholder="Leave empty if it cannot miss"></label>
 <label class="field full">D&D dice or damage notation (optional)<input name="dice" maxlength="120" placeholder="e.g. 4d8, or scaling by level"></label>`:''}
 <label class="field full">${isMove?'Move effects, targeting and range':'Ability effect'}<textarea name="description" minlength="1" maxlength="1000" required placeholder="Describe how the ${isMove?'move':'ability'} works in our tabletop rules."></textarea></label>
 <p class="hint full">Entering an existing custom name replaces that definition; it will also update the description shown on Pokémon sheets using it.</p>
 <div class="actions"><button class="btn primary" type="submit">Save ${isMove?'custom move':'custom ability'}</button></div>
 </form></section>`;
}
async function saveCatalog(form,isMove){
 const fd=new FormData(form),name=cap(fd.get('name'),48),description=cap(fd.get('description'),1000);
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(!/^[a-z0-9-]{2,70}$/.test(slug))throw Error('Choose a name with at least two letters or numbers.');
 if(!description)throw Error('Describe the effect before saving.');
 const coll=isMove?'santara_custom_moves':'santara_custom_abilities';
 const existing=(isMove?customMoves:customAbilities).find(x=>x.slug===slug);
 if(existing&&!confirm('Replace the existing definition of '+existing.name+'?'))return;
 let record={slug,name,description,updatedAt:serverTimestamp()};
 if(isMove){
  const type=String(fd.get('type')||''),category=String(fd.get('category')||'');
  const powerRaw=String(fd.get('power')||'').trim(),accuracyRaw=String(fd.get('accuracy')||'').trim();
  const power=powerRaw===''?null:Number(powerRaw),accuracy=accuracyRaw===''?null:Number(accuracyRaw);
  if(!['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'].includes(type))throw Error('Choose a Pokémon move type.');
  if(!['Physical','Special','Status'].includes(category))throw Error('Choose a move category.');
  if(power!==null&&(!Number.isInteger(power)||power<0||power>300))throw Error('Base Power must be between 0 and 300.');
  if(accuracy!==null&&(!Number.isInteger(accuracy)||accuracy<1||accuracy>100))throw Error('Accuracy must be between 1 and 100.');
  record={...record,type,category,power,accuracy,dice:cap(fd.get('dice'),120)};
 }
 await setDoc(doc(store,coll,slug),record);
 const list=isMove?customMoves:customAbilities;
 const i=list.findIndex(x=>x.slug===slug);
 if(i<0)list.push(record);else list[i]=record;
 say(name+' saved to your custom '+(isMove?'moves':'abilities')+' catalogue.');
 catalogReturn();
}

function gate(message){
 root.innerHTML=`<section class="panel"><h2>${esc(message)}</h2><p>Use the same Firebase account as the Santara Fieldwork website. New players must verify their email and be approved by the GM.</p>
 <form id="party-login" class="form-grid"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><div class="actions"><button class="btn primary" type="submit">Sign in</button><button type="button" class="btn" data-act="google">Sign in with Google</button><a class="btn" href="./index.html">Create account / request access</a></div></form></section>`;
}
function stop(){
 [stopAccess,stopPokemon,stopApprovals,stopCustoms,stopRules,stopRequests,stopCards,stopMoves,stopAbilities].forEach(fn=>fn?.());
 stopAccess=stopPokemon=stopApprovals=stopCustoms=stopRules=stopRequests=stopCards=stopMoves=stopAbilities=null;pokemon=[];trainers=[];trainerCards=[];customs=[];customMoves=[];customAbilities=[];requests=[];battleRules=null;collectionReady=false;collectionError='';allowed=false;
}
function guard(){
 if(!user){gate('Sign in to view your Pokémon');return}
 if(!GM_SITE&&!user.emailVerified){root.innerHTML='<section class="panel"><h2>Verify your email first</h2><p>Return to the Fieldwork page to finish email verification.</p><a href="./index.html">Open Trainer access</a></section>';return}
 if(GM_SITE&&user.uid!==GM_UID){root.innerHTML='<section class="panel"><h2>GM account required</h2><p>This page only accepts the campaign GM account.</p></section>';return}
 if(!allowed){root.innerHTML='<section class="panel"><h2>Waiting for Trainer approval</h2><p>Your account is not approved yet. Open the Fieldwork site to request access.</p><a href="./index.html">Trainer registration</a></section>';return}
 render();
}
function connect(){
 stopRules=onSnapshot(doc(store,'santara_battle_rules','v5_2'),snapshot=>{battleRules=snapshot.exists()?snapshot.data():null;render()},e=>{battleRules=null;console.warn('Optional GM overrides unavailable:',e.message);});
 if(stopPokemon)stopPokemon();
 const col=collection(store,'santara_pokemon');
 stopPokemon=onSnapshot(GM_SITE?col:query(col,where('ownerUid','==',user.uid)),snapshot=>{
   collectionReady=true;collectionError='';pokemon=snapshot.docs.map(d=>({id:d.id,...d.data()}));
   pokemon.sort((a,b)=>(a.slot||99)-(b.slot||99)||String(a.nickname||a.speciesName).localeCompare(String(b.nickname||b.speciesName)));
   if(chosen&&!pokemon.find(m=>m.id===chosen))chosen='';
   render();
 },e=>{collectionReady=false;collectionError=e?.message||String(e);render();say('Pokémon collection: '+collectionError)});
 stopRequests=onSnapshot(GM_SITE?collection(store,'santara_pokemon_requests'):query(collection(store,'santara_pokemon_requests'),where('ownerUid','==',user.uid)),snap=>{requests=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));render()},e=>console.warn('Pokémon requests unavailable:',e.message));
 if(GM_SITE){
   stopApprovals=onSnapshot(collection(store,'santara_player_access'),snapshot=>{
     trainers=snapshot.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.enabled);
     if(!ownerFilter&&trainers.length)ownerFilter=trainers[0].uid;
     render();
   },fail);
   stopCards=onSnapshot(collection(store,'santara_trainer_cards'),snapshot=>{
     trainerCards=snapshot.docs.map(d=>({uid:d.id,...d.data()}));if(view==='party'||view==='storage')render();
   },e=>console.warn('Trainer Card names could not load:',e.message));
 }
 stopMoves=onSnapshot(collection(store,'santara_custom_moves'),snapshot=>{
   customMoves=snapshot.docs.map(d=>({...d.data(),slug:d.id}));for(const m of customMoves){const key=m.name.toLowerCase().trim().replace(/\s+/g,'-');moveCache.delete(key)}if(chosen){lookupMoves(pokemon.find(p=>p.id===chosen)?.moves||[]).then(render)}else if(view==='party'||view==='storage')render();
 },e=>console.warn('Custom moves cannot load:',e.message));
 stopAbilities=onSnapshot(collection(store,'santara_custom_abilities'),snapshot=>{
   customAbilities=snapshot.docs.map(d=>({...d.data(),slug:d.id}));if(view==='party'||view==='storage'||chosen)render();
 },e=>console.warn('Custom abilities cannot load:',e.message));
 stopCustoms=onSnapshot(collection(store,'santara_species_overrides'),snapshot=>{
     customs=snapshot.docs.map(d=>({key:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
     render();
   },e=>console.warn('Custom species catalogue unavailable:',e.message));
}
async function fetchOfficial(name){
 const key=cap(name,70).toLowerCase().replace(/\s+/g,'-');
 if(!/^[a-z0-9-]+$/.test(key))throw Error('Enter a valid Pokémon name, such as riolu or charizard.');
 if(!apiCache.has(key))apiCache.set(key,fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(key)).then(r=>{if(!r.ok)throw Error('PokéAPI could not find '+key);return r.json()}).then(fromPokeApi).catch(e=>{apiCache.delete(key);throw e}));
 return apiCache.get(key);
}
function customFrom(x){
 if(!x||!validStats(x.baseStats))throw Error('Custom species has invalid stats.');
 return {speciesKey:'custom:'+x.slug,speciesName:x.name,baseStats:x.baseStats,types:x.types,abilities:x.abilities,knownMoves:customMoves.map(m=>m.name),spriteUrl:x.spriteUrl||'',spriteData:x.spriteData||'',source:'custom'};
}
async function findSpecies(value){
 const q=cap(value,90);
 const found=customs.find(x=>q.toLowerCase()===x.name.toLowerCase()||q.toLowerCase()===('custom:'+x.slug));
 return found?customFrom(found):fetchOfficial(q);
}
async function lookupMoves(names){
 const list=names.filter(Boolean).slice(0,4);
 await Promise.all(list.map(async name=>{
   const key=name.toLowerCase().trim().replace(/\s+/g,'-');
   const special=customMoveByName(name);
   if(special){
     moveCache.set(key,{type:special.type,category:special.category?.toLowerCase(),power:special.power,accuracy:special.accuracy,description:special.description,dice:special.dice,custom:true});
     return;
   }
   if(moveCache.has(key))return;
   try {
     const r=await fetch('https://pokeapi.co/api/v2/move/'+encodeURIComponent(key));
     if(r.ok){const x=await r.json();moveCache.set(key,{power:x.power,type:x.type?.name,category:x.damage_class?.name,accuracy:x.accuracy});}
     else moveCache.set(key,null);
   }catch{moveCache.set(key,null)}
 }));
 moveInfo=Object.fromEntries(list.map(name=>[name,moveCache.get(name.toLowerCase().trim().replace(/\s+/g,'-'))]));
}
function artwork(m){
 const src=safeImageData(m.spriteData)||safeUrl(m.spriteUrl);
 return src?`<img class="poke-art" src="${esc(src)}" loading="lazy" alt="${esc(m.speciesName)}" onerror="this.style.visibility='hidden'">`:'<span class="poke-art" style="display:grid;place-items:center;font-size:48px">◈</span>';
}
function card(m){
 const max=Math.max(1,m.maxHp||1),pct=Math.max(0,Math.min(100,Math.round((m.currentHp||0)/max*100)));
 const cls=pct<=20?'critical':pct<=50?'low':'';
 return `<button class="poke-card" type="button" data-act="show" data-id="${esc(m.id)}">${artwork(m)}<span class="poke-info">
 <span class="name">${esc(m.nickname||m.speciesName)}</span><span class="sub" style="display:block">Lv. ${Number(m.level)||1} · ${esc((m.types||[]).join(' / '))}</span>
 <span class="hpbar ${cls}"><i style="width:${pct}%"></i></span><span class="sub">${m.currentHp}/${m.maxHp} HP · ${esc(m.status||'None')}</span></span></button>`;
}

function requestForm(){
 const d=requestDraft||{};
 return `<section class="panel"><div class="toolbar"><h2>Request a Pokémon</h2><button class="btn" data-act="back">← Back to Party</button></div>
 <p>Choose a species, check its official stats, and submit it for GM approval. Your GM decides when it joins your party, its level and its moves.</p>
 <form id="request-form" class="form-grid">
 <label class="field full">Pokémon species or custom form
 <input name="species" id="request-species" required maxlength="85" list="request-species-list"
 placeholder="e.g. Riolu, Dreepy or a registered custom Pokémon" value="${esc(d.speciesName||'')}">
 <datalist id="request-species-list">${customs.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist></label>
 <div class="actions"><button type="button" class="btn" data-act="request-lookup">Fetch Pokémon stats</button></div>
 <label class="field">Requested level<input type="number" name="level" required min="1" max="100" value="${d.level||5}"></label>
 <label class="field">Nickname (optional)<input name="nickname" maxlength="32" value="${esc(d.nickname||'')}"></label>
 <label class="field full">Where did you obtain this Pokémon?<textarea name="notes" maxlength="300" placeholder="Mention the quest, location or encounter so the GM can review it.">${esc(d.notes||'')}</textarea></label>
 ${d.baseStats?`<div class="field full"><span class="eyebrow">Species preview · ${esc((d.types||[]).join(' / '))}</span><div class="stats-grid">${statKeys.map((k,i)=>`<div class="stat"><b>${Number(d.baseStats[k])||0}</b><small>${statLabels[i]}</small></div>`).join('')}</div></div>`:''}
 <p class="hint full">Requests are not automatically added to your party. Once the GM accepts one, its stats and artwork will appear in My Pokémon.</p>
 <div class="actions"><button class="btn primary" type="submit" ${d.baseStats?'':'disabled'}>Send request to GM</button></div>
 </form></section>`;
}
function requestsSection(){
 if(GM_SITE){
  const pending=requests.filter(x=>x.status==='pending');
  return `<section class="panel"><div class="toolbar"><h3>Pokémon requests <span class="chip">${pending.length} pending</span></h3></div>
  <p>Review Trainer submissions before adding Pokémon to their collections.</p>
  ${pending.length?pending.map(r=>`<article class="entry"><b>${esc(r.speciesName)}</b> · requested Lv. ${r.level}
  <p class="hint">${esc(trainerLabel(r.ownerUid))}${r.nickname?' · '+esc(r.nickname):''}${r.notes?' — '+esc(r.notes):''}</p>
  <div class="actions"><button class="btn primary small" data-act="review" data-id="${esc(r.id)}">Review & assign</button>
  <button class="btn small danger" data-act="reject" data-id="${esc(r.id)}">Decline</button></div></article>`).join(''):'<p class="hint">No pending Pokémon requests.</p>'}</section>`;
 }
 const recent=requests.filter(x=>x.ownerUid===user?.uid).slice(0,10);
 return `<section class="panel"><div class="toolbar"><h3>Pokémon requests</h3>
 <button class="btn primary" data-act="request">+ Request Pokémon</button></div>
 ${recent.length?recent.map(r=>`<p class="hint"><b>${esc(r.speciesName)}</b> · requested Lv. ${r.level} · ${esc(r.status)}</p>`).join(''):'<p class="hint">Caught or received a new Pokémon? Request it here and your GM can assign it.</p>'}</section>`;
}
async function saveRequest(form){
 if(GM_SITE)throw Error('Use the GM assignment form instead.');
 const f=new FormData(form),speciesName=cap(f.get('species'),85);
 const species=requestDraft;
 if(!species?.baseStats || speciesName.toLowerCase()!==species.speciesName.toLowerCase())
  throw Error('Fetch the selected Pokémon first so its species is verified.');
 const level=Number(f.get('level'));
 if(!Number.isInteger(level)||level<1||level>100)throw Error('Choose a level from 1 to 100.');
 const pending=requests.filter(x=>x.status==='pending');
 if(pending.length>=10)throw Error('You already have ten pending requests. Ask your GM to review them first.');
 await addDoc(collection(store,'santara_pokemon_requests'),{
  ownerUid:user.uid,speciesKey:species.speciesKey,speciesName:species.speciesName,
  level,nickname:cap(f.get('nickname'),32),notes:cap(f.get('notes'),300),
  status:'pending',createdAt:serverTimestamp(),resolvedAt:null
 });
 say(`${species.speciesName} request sent to your GM.`);
 clearSelection();
}
async function reviewRequest(id){
 const request=requests.find(r=>r.id===id&&r.status==='pending');
 if(!request)throw Error('This request has already been handled.');
 if(!trainers.some(t=>t.uid===request.ownerUid))throw Error('The requesting Trainer is no longer approved.');
 ownerFilter=request.ownerUid;
 const species=request.speciesKey.startsWith('custom:')
  ?customFrom(customs.find(x=>'custom:'+x.slug===request.speciesKey))
  :await fetchOfficial(request.speciesKey);
 activeRequestId=request.id;
 editingId='';chosen='';draft={...species,level:request.level,nickname:request.nickname,
  origin:request.notes,maxHp:maxHpV4Baseline(species.baseStats,request.level),
  currentHp:maxHpV4Baseline(species.baseStats,request.level),ownerUid:request.ownerUid};
 view='assign';render();
 say('Check the requested Pokémon, set its party slot and moves, then click Assign to Trainer.');
}
async function rejectRequest(id){
 const r=requests.find(x=>x.id===id&&x.status==='pending');if(!r)return;
 if(!confirm(`Decline ${r.speciesName} request?`))return;
 await updateDoc(doc(store,'santara_pokemon_requests',id),{status:'rejected',resolvedAt:serverTimestamp()});
 say('Pokémon request declined.');
}

function roster(){
 const mine=GM_SITE?pokemon.filter(m=>m.ownerUid===ownerFilter):pokemon;
 const active=mine.filter(m=>Number(m.slot)>=1&&Number(m.slot)<=6).sort((a,b)=>a.slot-b.slot);
 const storage=mine.filter(m=>!Number(m.slot)||Number(m.slot)>6);
 const slots=Array.from({length:6},(_,i)=>active.find(m=>Number(m.slot)===i+1));
 return `<div class="toolbar"><h2>${GM_SITE?'Trainer Party':'Current Party'} <span class="chip">${active.length}/6</span></h2>
 <div class="tabs">${GM_SITE?`<select id="trainer-filter" aria-label="Select Trainer">${option('','Select trainer…',ownerFilter)}${trainers.map(t=>option(t.uid,trainerLabel(t.uid),ownerFilter)).join('')}</select><button class="btn primary" data-act="new">+ Assign Pokémon</button>`:'<button class="btn primary" data-act="request">+ Request Pokémon</button>'}
 <button class="btn ${view==='party'?'primary':''}" data-act="party">Party</button><button class="btn ${view==='storage'?'primary':''}" data-act="storage">Storage (${storage.length})</button></div></div>`;
}
function listView(){
 const mine=GM_SITE?pokemon.filter(m=>m.ownerUid===ownerFilter):pokemon;
 const active=mine.filter(m=>Number(m.slot)>0&&Number(m.slot)<=6),storage=mine.filter(m=>!Number(m.slot)||Number(m.slot)>6);
 const slots=Array.from({length:6},(_,i)=>active.find(m=>Number(m.slot)===i+1));
 return `<div class="panel">${roster()}${view==='party'?`<div class="poke-grid">${slots.map((m,i)=>m?card(m):`<div class="empty">Slot ${i+1}<br>Empty</div>`).join('')}</div>`:
 `<div class="poke-grid">${storage.length?storage.map(card).join(''):'<div class="empty">No Pokémon in storage.</div>'}</div>`}</div>
 ${GM_SITE?`<section class="panel"><h3>Custom Pokémon & forms</h3><p>Create custom species once, then select them when assigning a Pokémon. Official species import from PokéAPI instead.</p><div class="actions"><button class="btn" data-act="custom">+ Register custom species</button><button class="btn" data-act="define-move">+ Custom Move</button><button class="btn" data-act="define-ability">+ Custom Ability</button></div><p class="hint">${customs.length} custom species · ${customMoves.length} custom moves · ${customAbilities.length} custom abilities</p></section><section class="panel"><h3>V5.2 calculations</h3><p>Our V5.2 offense and defense multipliers are already included. You can override the table or set a fixed AC if needed.</p><button class="btn" data-act="rules">Edit battle rules</button><p class="hint">${battleRules?'Custom V5.2 settings loaded.':'Default V5.2 multipliers are active.'}</p></section>`:''}${requestsSection()}`;
}
function detail(m){
 const s=m.baseStats||{},d=combatSummary(m,battleRules);
 const mul=v=>typeof v==='number'?`×${v.toFixed(2)}`:'Pending';
 return `<section class="panel"><div class="toolbar"><button class="btn" data-act="back">← Back</button><div class="actions">${GM_SITE?`<button class="btn" data-act="edit" data-id="${esc(m.id)}">Edit Pokémon</button><button class="btn danger" data-act="delete" data-id="${esc(m.id)}">Release record</button>`:''}</div></div>
 <div class="detail-head">${artwork(m)}<div><span class="eyebrow">${esc(m.source==='custom'?'SANTARA CUSTOM SPECIES':'OFFICIAL POKÉMON')}</span><h2>${esc(m.nickname||m.speciesName)} <span class="chip">Lv. ${m.level}</span></h2><p>${esc(m.speciesName)} · ${esc((m.types||[]).join(' / '))} · ${esc(m.ability||'No ability')}</p><p>Held item: ${esc(m.heldItem||'None')} · ${esc(m.status||'None')}</p>${customAbilityByName(m.ability)?`<p class="hint"><b>${esc(m.ability)}:</b> ${esc(customAbilityByName(m.ability).description)}</p>`:''}</div></div></section>
 <div class="columns"><section class="panel"><h3>Battle Sheet</h3><div class="stats-grid">${statKeys.map((key,i)=>`<div class="stat"><b>${Number(s[key])||0}</b><small>${statLabels[i]}</small></div>`).join('')}</div>
 <p class="hint">20-point brackets — Atk ${esc(d.physicalOffenseBand)}, SpA ${esc(d.specialOffenseBand)}, Def ${esc(d.physicalDefenseBand)}, SpD ${esc(d.specialDefenseBand)}. Speed ${d.effectiveSpeed} before battle modifiers.</p>
 <div class="stats-grid"><div class="stat"><b>${d.universalAC??'11 + PB'}</b><small>Universal AC (V5.2)</small></div><div class="stat"><b>${mul(d.physicalOffenseMultiplier)}</b><small>Physical offense</small></div><div class="stat"><b>${mul(d.specialOffenseMultiplier)}</b><small>Special offense</small></div><div class="stat"><b>${mul(d.physicalDefenseMultiplier)}</b><small>Physical defense</small></div><div class="stat"><b>${mul(d.specialDefenseMultiplier)}</b><small>Special defense</small></div></div>
 <p class="flag">V5.2: damage dice × offense × STAB × type effectiveness × defense. AC = 11 + proficiency bonus; any GM override replaces the displayed AC. Tier multipliers are automatic.</p>
 <div class="move-list">${(m.moves||[]).length?(m.moves||[]).map(name=>{
 const info=moveInfo[name];return `<div class="move"><b>${esc(name)}</b><div class="hint">${info?`${esc(info.type)} · ${esc(info.category)} · BP ${info.power??'—'} · Accuracy ${info.accuracy??'—'}`:'Move details not available'}</div>${info?.dice?`<p class="hint">Damage dice: ${esc(info.dice)}</p>`:''}${info?.description?`<p class="hint">${esc(info.description)}</p>`:''}</div>`;
 }).join(''):'<div class="hint">No moves assigned by the GM yet.</div>'}</div></section>
 <section class="panel"><h3>Battle tracking</h3><form id="track-form" class="form-grid">
 <label class="field">Current HP <span class="hint">Maximum ${m.maxHp}</span><input name="currentHp" type="number" min="0" max="${m.maxHp}" required value="${m.currentHp}"></label>
 <label class="field">Status<select name="status">${statuses.map(s=>option(s,s,m.status||'None')).join('')}</select></label>
 <label class="field">Party slot <span class="hint">Storage = 0</span><select name="slot">${Array.from({length:7},(_,i)=>option(i,i===0?'Storage':`Slot ${i}`,m.slot||0)).join('')}</select></label>
 <label class="field">Nickname<input name="nickname" maxlength="32" value="${esc(m.nickname||'')}"></label>
 <label class="field full">Notes<textarea name="notes" maxlength="1000">${esc(m.notes||'')}</textarea></label>
 <p class="hint full">Where obtained: ${esc(m.origin||'Not recorded')}. ${GM_SITE?'GM and Trainer can update battle tracking.':'Only you and the GM can access this Pokémon record.'}</p>
 <div class="actions"><button class="btn primary" type="submit">Save battle record</button><button class="btn" data-act="heal" type="button">Full heal</button></div>
 </form></section></div>`;
}
function statInputs(data){
 return statKeys.map((k,i)=>`<label class="field">${statLabels[i]} base stat<input name="${k}" type="number" min="1" max="255" required value="${data?.[k]||''}"></label>`).join('');
}
function gmForm(){
 if(!ownerFilter){return '<section class="panel"><h2>Choose a Trainer first</h2><p>Approved Trainer accounts will appear once someone has registered and been approved in the GM console.</p></section>'}
 const existing=pokemon.find(m=>m.id===editingId);
 const d=draft||existing||{};
 const level=Number(d.level)||5;
 const defaultHp=validStats(d.baseStats)?maxHpV4Baseline(d.baseStats,level):'';
 return `<section class="panel"><div class="toolbar"><h2>${existing?'Edit Pokémon':'Assign Pokémon'}</h2><button class="btn" data-act="back">← Cancel</button></div>
 <form id="assign-form" class="form-grid">
 <label class="field full">Species / Form<input id="species-query" name="species" list="species-list" required placeholder="e.g. Riolu, Charizard, custom Mega Charizard Z" value="${esc(d.speciesName||'')}"><datalist id="species-list">${customs.map(x=>`<option value="${esc(x.name)}"></option>`).join('')}</datalist></label>
 <div class="actions"><button class="btn" data-act="lookup" type="button">Fetch stats from PokéAPI / custom list</button><span class="hint" id="species-source">${draft?esc(d.source||''):'Look up a species before saving.'}</span></div>
 <label class="field">Assign to Trainer<select name="ownerUid" required>${trainers.map(t=>option(t.uid,trainerLabel(t.uid),d.ownerUid||ownerFilter)).join('')}</select></label>
 <label class="field">Level<input name="level" type="number" min="1" max="100" required value="${level}"></label>
 <label class="field">Nickname<input name="nickname" maxlength="32" value="${esc(d.nickname||'')}"></label>
 <label class="field">Ability<input name="ability" list="abilities" maxlength="48" value="${esc(d.ability||d.abilities?.[0]||'')}"><datalist id="abilities">${[...(d.abilities||[]),...customAbilities.map(a=>a.name)].map(a=>`<option value="${esc(a)}"></option>`).join('')}</datalist></label>
 <label class="field">Maximum HP<input name="maxHp" data-generated="${defaultHp}" type="number" min="1" max="3000" required value="${d.maxHp||defaultHp}"></label>
 <label class="field">Current HP<input name="currentHp" type="number" min="0" max="3000" required value="${d.currentHp??d.maxHp??defaultHp}"></label>
 <label class="field">Party slot<select name="slot">${Array.from({length:7},(_,i)=>option(i,i===0?'Storage':`Slot ${i}`,d.slot??0)).join('')}</select></label>
 <label class="field">Held item<input name="heldItem" maxlength="80" value="${esc(d.heldItem||'')}"></label>
 <div class="field full"><span class="eyebrow">Four move slots</span><p class="hint">Choose one move per slot. Each field searches the official learnset and your saved custom moves.</p>
 <div class="move-fields">${Array.from({length:4},(_,i)=>`<label class="field">Move ${i+1}<input name="move${i+1}" maxlength="48" list="known-moves" placeholder="Search or type a move" value="${esc((d.moves||[])[i]||'')}"></label>`).join('')}</div>
 <datalist id="known-moves">${moveOptions(d).map(name=>`<option value="${esc(name)}"></option>`).join('')}</datalist>
 <div class="actions"><button type="button" class="btn small" data-act="define-move">+ Define custom move</button><button type="button" class="btn small" data-act="define-ability">+ Define custom ability</button></div></div>
 <label class="field full">Location obtained / history<input name="origin" maxlength="150" value="${esc(d.origin||'')}"></label>
 <label class="field full">Shared notes (visible to Trainer)<textarea name="notes" maxlength="1000">${esc(d.notes||'')}</textarea></label>
 <p class="hint full">Official six base stats, types, abilities and artwork are imported automatically. Default HP is calculated from our older V4 baseline until the finalized V5.2 HP rule is entered; you can override HP above. The obsolete V4 AC is NOT used.</p>
 <div class="actions"><button class="btn primary" type="submit" ${draft||existing?'':'disabled'}>${existing?'Save Pokémon':'Assign to Trainer'}</button></div>
 </form></section>`;
}
function rulesForm(){
 const r=battleRules||{};
 return `<section class="panel"><div class="toolbar"><h2>V5.2 combat configuration</h2><button class="btn" data-act="back">← Cancel</button></div>
 <p>Enter the finalized V5.2 values, rather than the superseded V4 formulas. Multipliers are listed in 20-point intervals starting at 0–19, 20–39, 40–59, and so on. A Pokémon with 200 Sp. Atk uses the 200–249 tier; 250+ is the final tier. The values below are prefilled from our V5.2 table.</p>
 <form id="rules-form" class="form-grid">
 <label class="field">Universal AC<input name="universalAc" type="number" min="1" max="50" placeholder="Enter actual V5.2 value" value="${r.universalAc??''}"></label>
 <label class="field full">Offense multipliers (comma-separated)<textarea name="offenseBands" placeholder="20-point offense tier multipliers">${(r.offenseBands?.length?r.offenseBands:V52_TIERS.map(t=>t.offense)).join(', ')}</textarea></label>
 <label class="field full">Defense multipliers (comma-separated)<textarea name="defenseBands" placeholder="20-point defense tier multipliers">${(r.defenseBands?.length?r.defenseBands:V52_TIERS.map(t=>t.defense)).join(', ')}</textarea></label>
 <p class="hint full">V5.2 defaults are already active for every Pokémon, even before saving. Adjust only if your campaign changes the table. Universal AC = 11 + PB unless you enter a fixed override.</p>
 <div class="actions"><button class="btn primary" type="submit">Save V5.2 combat rules</button></div>
 </form></section>`;
}
async function saveRules(form){
 const f=new FormData(form),raw=String(f.get('universalAc')||'').trim();
 const universalAc=raw?Number(raw):null;
 const parse=k=>{
  const input=String(f.get(k)||'').trim();
  if(!input)return [];
  const numbers=input.split(',').map(x=>Number(x.trim()));
  if(numbers.length>20||numbers.some(x=>!Number.isFinite(x)||x<=0||x>10))throw Error(k+' needs at most 20 positive numeric multipliers (0–10).');
  return numbers;
 };
 if(universalAc!==null&&(!Number.isInteger(universalAc)||universalAc<1||universalAc>50))throw Error('Universal AC must be an integer from 1 to 50.');
 await setDoc(doc(store,'santara_battle_rules','v5_2'),{
  universalAc,offenseBands:parse('offenseBands'),defenseBands:parse('defenseBands'),updatedAt:serverTimestamp()
 });
 say('V5.2 combat tables saved for all approved Trainers.');clearSelection();
}
function customForm(){
 return `<section class="panel"><div class="toolbar"><h2>Register a Santara species or custom form</h2><button class="btn" data-act="back">← Cancel</button></div>
 <form id="custom-form" class="form-grid">
 <label class="field">Species/form name<input required name="name" maxlength="65" placeholder="Mega Charizard Z"></label>
 <label class="field">Types (comma-separated)<input required name="types" maxlength="70" placeholder="Fire, Dragon"></label>
 <div class="field full"><span class="eyebrow">Available abilities</span><div class="move-fields">${Array.from({length:3},(_,i)=>`<label class="field">Ability ${i+1}<input name="speciesAbility${i+1}" list="custom-species-abilities" maxlength="48" placeholder="Official or custom ability"></label>`).join('')}</div>
 <datalist id="custom-species-abilities">${customAbilities.map(a=>`<option value="${esc(a.name)}"></option>`).join('')}</datalist><span class="hint">Define ability effects using the Custom Ability editor on the GM Pokémon home screen.</span></div>
 ${statInputs(null)}
 <label class="field full">Artwork URL (HTTPS, optional)<input name="spriteUrl" type="url" placeholder="https://…"></label>
 <label class="field full">Or upload artwork (PNG/JPG/WebP, compressed to small WebP)<input name="upload" type="file" accept="image/png,image/jpeg,image/webp"></label>
 <p class="hint full">Custom Pokémon are saved once in Firestore, then can be assigned to approved Trainers. Uploads are compressed and limited to 150 KB of encoded data; URLs are an alternative.</p>
 <div class="actions"><button class="btn primary" type="submit">Save custom species</button></div>
 </form></section>`;
}
function render(){
 if(!allowed)return guard();
 const chip=document.getElementById('user-chip');
 chip.textContent=GM_SITE?'GM authenticated':user.email||'Trainer';
 if(view==='assign'){root.innerHTML=gmForm();return}
 if(view==='custom'){root.innerHTML=customForm();return}
 if(view==='custom-move'){root.innerHTML=catalogForm('move');return}
 if(view==='custom-ability'){root.innerHTML=catalogForm('ability');return}
 if(view==='rules'){root.innerHTML=rulesForm();return}
 if(view==='request'){root.innerHTML=requestForm();return}
 if(!collectionReady){root.innerHTML=collectionError?`<section class="panel"><h2>Pokémon collection could not load</h2><p>${esc(collectionError)}</p><p>Firestore has not granted access to the Pokémon collection. The GM must publish the latest <b>firestore.rules</b> from the GM repository in the Firebase Console. Refresh after the rules are live.</p><a class="btn" href="./index.html">Return to Fieldwork</a></section>`:'<section class="panel"><p>Loading Pokémon records…</p></section>';return}
 const mon=pokemon.find(m=>m.id===chosen);
 root.innerHTML=mon?detail(mon):listView();
}
function clearSelection(){chosen='';editingId='';draft=null;requestDraft=null;activeRequestId='';returnToAssign=false;view='party';render()}
async function selectMon(id){
 chosen=id;const m=pokemon.find(x=>x.id===id);
 if(m){moveInfo={};await lookupMoves(m.moves||[]);render()}
}
async function imgToWebp(file) {
 if(!file)return '';
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5000000)throw Error('Choose a PNG, JPEG or WebP image under 5 MB.');
 const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas');
 const scale=Math.min(1,520/Math.max(bitmap.width,bitmap.height));
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();
 let data=canvas.toDataURL('image/webp',0.66);
 if(data.length>150000) {const smaller=document.createElement('canvas');smaller.width=Math.min(canvas.width,300);smaller.height=Math.min(canvas.height,300);smaller.getContext('2d').drawImage(canvas,0,0,smaller.width,smaller.height);data=smaller.toDataURL('image/webp',0.5)}
 if(data.length>150000)throw Error('Image could not be reduced under the 150 KB limit. Try a simpler image.');
 return data;
}
async function saveCustom(form){
 const f=new FormData(form),name=cap(f.get('name'),65);
 const slug=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 if(slug.length<2||slug.length>70)throw Error('Use a valid custom species name.');
 const baseStats=Object.fromEntries(statKeys.map(k=>[k,Number(f.get(k))]));
 if(!validStats(baseStats))throw Error('Every base stat must be a whole number between 1 and 255.');
 const types=cap(f.get('types'),70).split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,2);
 const abilities=Array.from({length:3},(_,i)=>cap(f.get('speciesAbility'+(i+1)),48)).filter(Boolean);
 if(new Set(abilities.map(a=>a.toLowerCase())).size!==abilities.length)throw Error('A species cannot list the same ability twice.');
 if(!types.length)throw Error('At least one type is required.');
 const url=cap(f.get('spriteUrl'),400);
 if(url&&!safeUrl(url))throw Error('Artwork links must use HTTPS.');
 const spriteData=await imgToWebp(f.get('upload')?.size?f.get('upload'):null);
 if(customs.some(x=>x.slug===slug)&&!confirm('Replace this existing custom species template? Existing assigned Pokémon will keep their own saved stats.'))return;
 await setDoc(doc(store,'santara_species_overrides',slug),{slug,name,baseStats,types,abilities,spriteUrl:url,spriteData,updatedAt:serverTimestamp()});
 say(name+' saved to the custom species catalogue.');clearSelection();
}
async function saveAssign(form){
 const f=new FormData(form),existing=pokemon.find(x=>x.id===editingId);
 if(!draft&&!existing)throw Error('Fetch an official or custom species first.');
 const d=draft||existing;
 const ownerUid=String(f.get('ownerUid')||'');
 if(!trainers.some(x=>x.uid===ownerUid))throw Error('Choose an approved Trainer.');
 const level=Number(f.get('level')),slot=Number(f.get('slot'));
 const maxHp=Number(f.get('maxHp')),currentHp=Number(f.get('currentHp'));
 const moves=registrationMoves(f);
 if(!Number.isInteger(level)||level<1||level>100)throw Error('Level must be between 1 and 100.');
 if(!Number.isInteger(slot)||slot<0||slot>6)throw Error('Choose a valid party slot.');
 if(!Number.isInteger(maxHp)||maxHp<1||maxHp>3000||!Number.isInteger(currentHp)||currentHp<0||currentHp>maxHp)throw Error('Current HP must be between 0 and maximum HP.');
 if(moves.length>4||moves.some(x=>x.length>48))throw Error('A Pokémon can have up to four moves, each under 48 characters.');
 if(!validStats(d.baseStats))throw Error('Import the species stats first.');
 const item={
  ownerUid,speciesKey:d.speciesKey,speciesName:d.speciesName,source:d.source,
  baseStats:d.baseStats,types:d.types,abilities:d.abilities||[],spriteUrl:d.spriteUrl||'',spriteData:d.spriteData||'',
  nickname:cap(f.get('nickname'),32),level,ability:cap(f.get('ability'),48),
  maxHp,currentHp,status:existing?.status||'None',slot,heldItem:cap(f.get('heldItem'),80),moves,origin:cap(f.get('origin'),150),notes:cap(f.get('notes'),1000),updatedAt:serverTimestamp()
 };
 // Swap out an occupied party slot in the target Trainer's collection.
 const occupying=pokemon.find(m=>m.ownerUid===ownerUid&&m.id!==existing?.id&&Number(m.slot)===slot&&slot>0);
 const batch=writeBatch(store);
 if(occupying)batch.update(doc(store,'santara_pokemon',occupying.id),{slot:existing?.ownerUid===ownerUid?Number(existing.slot)||0:0,updatedAt:serverTimestamp()});
 if(activeRequestId){batch.update(doc(store,'santara_pokemon_requests',activeRequestId),{status:'approved',resolvedAt:serverTimestamp()});}
 if(existing)batch.set(doc(store,'santara_pokemon',existing.id),item);
 else batch.set(doc(collection(store,'santara_pokemon')),item);
 await batch.commit();
 say('Pokémon saved and synced to the Trainer account.');clearSelection();
}
async function saveTracking(form){
 const mon=pokemon.find(m=>m.id===chosen);
 if(!mon)throw Error('Pokémon is no longer available.');
 const f=new FormData(form),slot=Number(f.get('slot')),hp=Number(f.get('currentHp'));
 if(!Number.isInteger(hp)||hp<0||hp>mon.maxHp)throw Error('HP must be within the Pokémon’s maximum.');
 if(!Number.isInteger(slot)||slot<0||slot>6)throw Error('Invalid slot.');
 const status=String(f.get('status'));
 if(!statuses.includes(status))throw Error('Invalid status.');
 const payload={currentHp:hp,status,slot,nickname:cap(f.get('nickname'),32),notes:cap(f.get('notes'),1000),updatedAt:serverTimestamp()};
 const occupying=pokemon.find(m=>m.id!==mon.id&&m.ownerUid===mon.ownerUid&&Number(m.slot)===slot&&slot>0);
 const batch=writeBatch(store);
 if(occupying)batch.update(doc(store,'santara_pokemon',occupying.id),{slot:Number(mon.slot)||0,updatedAt:serverTimestamp()});
 batch.update(doc(store,'santara_pokemon',mon.id),payload);
 await batch.commit();
 say('Battle record saved.');render();
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b||busy)return;
 const action=b.dataset.act;
 try{
  if(action==='party'||action==='storage'){chosen='';view=action;render()}
  if(action==='show')await selectMon(b.dataset.id);
  if(action==='back')clearSelection();
  if(action==='catalog-back'&&GM_SITE)catalogReturn();
  if((action==='define-move'||action==='define-ability')&&GM_SITE){
    returnToAssign=view==='assign';if(returnToAssign)copyAssignmentDraft();
    view=action==='define-move'?'custom-move':'custom-ability';render();
  }
  if(action==='new'&&GM_SITE){view='assign';draft=null;activeRequestId='';editingId='';chosen='';render()}
  if(action==='request'&&!GM_SITE){requestDraft=null;view='request';chosen='';render()}
  if(action==='request-lookup'&&!GM_SITE){const f=document.getElementById('request-form');const species=await findSpecies(f.elements.species.value);requestDraft={...species,level:Number(f.elements.level.value)||5,nickname:f.elements.nickname.value,notes:f.elements.notes.value};say('Species stats loaded. Submit your request to the GM.');render()}
  if(action==='review'&&GM_SITE){say('Loading requested species…');await reviewRequest(b.dataset.id)}
  if(action==='reject'&&GM_SITE)await rejectRequest(b.dataset.id)
  if(action==='custom'&&GM_SITE){view='custom';chosen='';render()}
  if(action==='rules'&&GM_SITE){view='rules';chosen='';render()}
  if(action==='lookup'&&GM_SITE){
    busy=true;b.disabled=true;say('Fetching species stats…');
    const input=document.getElementById('species-query');
    const species=await findSpecies(input.value);
    draft={...(draft||{}),...species};
    const enteredLevel=Number(document.querySelector('#assign-form [name="level"]')?.value);
    draft.level=Number.isInteger(enteredLevel)&&enteredLevel>=1&&enteredLevel<=100?enteredLevel:5;
    draft.maxHp=maxHpV4Baseline(species.baseStats,draft.level);
    draft.currentHp=draft.maxHp;
    draft.ability=species.abilities?.[0]||'';
    say(`${species.speciesName} imported. Check level, HP, moves and Trainer assignment before saving.`);render();
  }
  if(action==='edit'&&GM_SITE){
   editingId=b.dataset.id;draft={...pokemon.find(x=>x.id===editingId)};
   if(draft.source==='official'){
     try {const official=await fetchOfficial(draft.speciesKey);draft.knownMoves=official.knownMoves;draft.abilities=official.abilities}
     catch(e){console.warn('Official move suggestions are temporarily unavailable:',e.message)}
   }
   view='assign';chosen='';render();
  }
  if(action==='delete'&&GM_SITE){
    const m=pokemon.find(x=>x.id===b.dataset.id);
    if(m&&confirm('Permanently delete the Pokémon record for '+(m.nickname||m.speciesName)+'?')){await deleteDoc(doc(store,'santara_pokemon',m.id));say('Pokémon record removed.');clearSelection()}
  }
  if(action==='heal'){const form=document.getElementById('track-form'),m=pokemon.find(x=>x.id===chosen);if(form&&m)form.elements.currentHp.value=m.maxHp}
  if(action==='google'){await signInWithPopup(auth,new GoogleAuthProvider())}
 }catch(err){fail(err)}finally{busy=false}
});
root.addEventListener('change',e=>{
 if(e.target.name==='name'&&(view==='custom-move'||view==='custom-ability')){
  const record=(view==='custom-move'?customMoves:customAbilities).find(x=>x.name.toLowerCase()===e.target.value.trim().toLowerCase());
  const form=e.target.closest('form');
  if(record&&form){
   for(const key of ['description','type','category','power','accuracy','dice']){
    const field=form.elements[key];if(field)field.value=record[key]??'';
   }
  }
 }
 if(e.target.id==='trainer-filter'){ownerFilter=e.target.value;chosen='';view='party';render()}
 if(e.target.name==='level'&&view==='assign'&&draft?.baseStats){
  const level=Number(e.target.value),form=document.getElementById('assign-form');
  if(Number.isInteger(level)&&level>=1&&level<=100&&form){
   const max=form.elements.maxHp,cur=form.elements.currentHp,old=Number(max.value);
   const newMax=maxHpV4Baseline(draft.baseStats,level);
   if(old===Number(max.dataset.generated)){if(Number(cur.value)===old)cur.value=newMax;max.value=newMax}
   max.dataset.generated=String(newMax);draft.level=level;
  }
 }
});
root.addEventListener('submit',async e=>{
 e.preventDefault();if(busy)return;busy=true;
 const form=e.target,button=form.querySelector('button[type=submit]');
 if(button)button.disabled=true;
 try{
  if(form.id==='party-login'){const f=new FormData(form);await signInWithEmailAndPassword(auth,String(f.get('email')).trim(),String(f.get('password')))}
  if(form.id==='track-form')await saveTracking(form);
  if(form.id==='assign-form'&&GM_SITE)await saveAssign(form);
  if(form.id==='custom-form'&&GM_SITE)await saveCustom(form);
  if(form.id==='custom-move-form'&&GM_SITE)await saveCatalog(form,true);
  if(form.id==='custom-ability-form'&&GM_SITE)await saveCatalog(form,false);
  if(form.id==='request-form'&&!GM_SITE)await saveRequest(form);
  if(form.id==='rules-form'&&GM_SITE)await saveRules(form);
 }catch(err){fail(err)}finally{busy=false;if(button?.isConnected)button.disabled=false}
});

try{
 const config=window.SANTARA_FIREBASE_CONFIG;
 if(!config?.projectId)throw Error('Firebase configuration is missing.');
 app=getApps().length?getApp():initializeApp(config);auth=getAuth(app);store=getFirestore(app);
 onAuthStateChanged(auth,next=>{
   stop();user=next;document.getElementById('user-chip').textContent=next?.email||'Not signed in';
   if(!next)return guard();
   if(GM_SITE){if(next.uid!==GM_UID)return guard();allowed=true;connect();return}
   if(!next.emailVerified)return guard();
   stopAccess=onSnapshot(doc(store,'santara_player_access',next.uid),snapshot=>{
     const wasAllowed=allowed;allowed=snapshot.exists()&&snapshot.data().enabled===true;
     if(allowed&&!wasAllowed)connect();
     else if(!allowed&&wasAllowed){stopPokemon?.();stopPokemon=null;pokemon=[];guard()}
     else guard();
   },e=>{fail(e);guard()});
 },fail);
}catch(e){fail(e);root.innerHTML='<section class="panel"><h2>Firebase unavailable</h2><p>Check the site configuration and connection.</p></section>'}
