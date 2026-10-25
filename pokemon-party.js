import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot,setDoc,addDoc,deleteDoc,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {statKeys,statLabels,validStats,maxHpV4Baseline,combatSummary,fromPokeApi} from './pokemon-math.js';

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
let app,auth,store,user=null,allowed=false,stopAccess=null,stopPokemon=null,stopApprovals=null,stopCustoms=null;
let pokemon=[],trainers=[],customs=[],battleRules=null,stopRules=null,view='party',chosen='',ownerFilter='',editingId='',draft=null,moveInfo={},busy=false;

document.getElementById('edition-name').textContent=GM_SITE?'GM CONSOLE / TEAM MANAGEMENT':'POKÉDEX / TRAINER COLLECTION';
document.getElementById('page-title').innerHTML=GM_SITE?'Trainer Pokémon<span class="accent">.</span>':'My Pokémon<span class="accent">.</span>';
document.getElementById('page-lead').textContent=GM_SITE?'Assign Pokémon, import official stats, register custom forms and manage party progression.':'Track your active team, storage, HP and battle notes across devices.';
document.getElementById('passport-link').textContent=GM_SITE?'Trainer approvals':'Trainer Cards';
document.getElementById('passport-link').href=GM_SITE?'./index.html?tab=approvals':'./index.html?tab=trainer';

function say(s){feedback.textContent=s||''}
function fail(e){say(e?.message||String(e))}
function gate(message){
 root.innerHTML=`<section class="panel"><h2>${esc(message)}</h2><p>Use the same Firebase account as the Santara Fieldwork website. New players must verify their email and be approved by the GM.</p>
 <form id="party-login" class="form-grid"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label><label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label><div class="actions"><button class="btn primary" type="submit">Sign in</button><button type="button" class="btn" data-act="google">Sign in with Google</button><a class="btn" href="./index.html">Create account / request access</a></div></form></section>`;
}
function stop(){
 [stopAccess,stopPokemon,stopApprovals,stopCustoms,stopRules].forEach(fn=>fn?.());
 stopAccess=stopPokemon=stopApprovals=stopCustoms=stopRules=null;pokemon=[];trainers=[];customs=[];battleRules=null;allowed=false;
}
function guard(){
 if(!user){gate('Sign in to view your Pokémon');return}
 if(!GM_SITE&&!user.emailVerified){root.innerHTML='<section class="panel"><h2>Verify your email first</h2><p>Return to the Fieldwork page to finish email verification.</p><a href="./index.html">Open Trainer access</a></section>';return}
 if(GM_SITE&&user.uid!==GM_UID){root.innerHTML='<section class="panel"><h2>GM account required</h2><p>This page only accepts the campaign GM account.</p></section>';return}
 if(!allowed){root.innerHTML='<section class="panel"><h2>Waiting for Trainer approval</h2><p>Your account is not approved yet. Open the Fieldwork site to request access.</p><a href="./index.html">Trainer registration</a></section>';return}
 render();
}
function connect(){
 stopRules=onSnapshot(doc(store,'santara_battle_rules','v5_2'),snapshot=>{battleRules=snapshot.exists()?snapshot.data():null;render()},e=>say('Combat settings: '+e.message));
 if(stopPokemon)stopPokemon();
 const col=collection(store,'santara_pokemon');
 stopPokemon=onSnapshot(GM_SITE?col:query(col,where('ownerUid','==',user.uid)),snapshot=>{
   pokemon=snapshot.docs.map(d=>({id:d.id,...d.data()}));
   pokemon.sort((a,b)=>(a.slot||99)-(b.slot||99)||String(a.nickname||a.speciesName).localeCompare(String(b.nickname||b.speciesName)));
   if(chosen&&!pokemon.find(m=>m.id===chosen))chosen='';
   render();
 },e=>fail(e));
 if(GM_SITE){
   stopApprovals=onSnapshot(collection(store,'santara_player_access'),snapshot=>{
     trainers=snapshot.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.enabled);
     if(!ownerFilter&&trainers.length)ownerFilter=trainers[0].uid;
     render();
   },fail);
   stopCustoms=onSnapshot(collection(store,'santara_species_overrides'),snapshot=>{
     customs=snapshot.docs.map(d=>({key:d.id,...d.data()})).sort((a,b)=>a.name.localeCompare(b.name));
     render();
   },fail);
 }
}
async function fetchOfficial(name){
 const key=cap(name,70).toLowerCase().replace(/\s+/g,'-');
 if(!/^[a-z0-9-]+$/.test(key))throw Error('Enter a valid Pokémon name, such as riolu or charizard.');
 if(!apiCache.has(key))apiCache.set(key,fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(key)).then(r=>{if(!r.ok)throw Error('PokéAPI could not find '+key);return r.json()}).then(fromPokeApi).catch(e=>{apiCache.delete(key);throw e}));
 return apiCache.get(key);
}
function customFrom(x){
 if(!x||!validStats(x.baseStats))throw Error('Custom species has invalid stats.');
 return {speciesKey:'custom:'+x.slug,speciesName:x.name,baseStats:x.baseStats,types:x.types,abilities:x.abilities,knownMoves:[],spriteUrl:x.spriteUrl||'',spriteData:x.spriteData||'',source:'custom'};
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
function roster(){
 const mine=GM_SITE?pokemon.filter(m=>m.ownerUid===ownerFilter):pokemon;
 const active=mine.filter(m=>Number(m.slot)>=1&&Number(m.slot)<=6).sort((a,b)=>a.slot-b.slot);
 const storage=mine.filter(m=>!Number(m.slot)||Number(m.slot)>6);
 const slots=Array.from({length:6},(_,i)=>active.find(m=>Number(m.slot)===i+1));
 return `<div class="toolbar"><h2>${GM_SITE?'Trainer Party':'Current Party'} <span class="chip">${active.length}/6</span></h2>
 <div class="tabs">${GM_SITE?`<select id="trainer-filter" aria-label="Select Trainer">${option('','Select trainer…',ownerFilter)}${trainers.map(t=>option(t.uid,t.email||t.uid,ownerFilter)).join('')}</select><button class="btn primary" data-act="new">+ Assign Pokémon</button>`:''}
 <button class="btn ${view==='party'?'primary':''}" data-act="party">Party</button><button class="btn ${view==='storage'?'primary':''}" data-act="storage">Storage (${storage.length})</button></div></div>`;
}
function listView(){
 const mine=GM_SITE?pokemon.filter(m=>m.ownerUid===ownerFilter):pokemon;
 const active=mine.filter(m=>Number(m.slot)>0&&Number(m.slot)<=6),storage=mine.filter(m=>!Number(m.slot)||Number(m.slot)>6);
 const slots=Array.from({length:6},(_,i)=>active.find(m=>Number(m.slot)===i+1));
 return `<div class="panel">${roster()}${view==='party'?`<div class="poke-grid">${slots.map((m,i)=>m?card(m):`<div class="empty">Slot ${i+1}<br>Empty</div>`).join('')}</div>`:
 `<div class="poke-grid">${storage.length?storage.map(card).join(''):'<div class="empty">No Pokémon in storage.</div>'}</div>`}</div>
 ${GM_SITE?`<section class="panel"><h3>Custom Pokémon & forms</h3><p>Create custom species once, then select them when assigning a Pokémon. Official species import from PokéAPI instead.</p><div class="actions"><button class="btn" data-act="custom">+ Register custom species</button></div><p class="hint">${customs.length} custom species registered: ${esc(customs.map(x=>x.name).join(', ')||'none')}</p></section>`:''}`;
}
function detail(m){
 const s=m.baseStats||{},d=combatSummary(m,battleRules);
 const mul=v=>typeof v==='number'?`×${v.toFixed(2)}`:'Pending';
 return `<section class="panel"><div class="toolbar"><button class="btn" data-act="back">← Back</button><div class="actions">${GM_SITE?`<button class="btn" data-act="edit" data-id="${esc(m.id)}">Edit Pokémon</button><button class="btn danger" data-act="delete" data-id="${esc(m.id)}">Release record</button>`:''}</div></div>
 <div class="detail-head">${artwork(m)}<div><span class="eyebrow">${esc(m.source==='custom'?'SANTARA CUSTOM SPECIES':'OFFICIAL POKÉMON')}</span><h2>${esc(m.nickname||m.speciesName)} <span class="chip">Lv. ${m.level}</span></h2><p>${esc(m.speciesName)} · ${esc((m.types||[]).join(' / '))} · ${esc(m.ability||'No ability')}</p><p>Held item: ${esc(m.heldItem||'None')} · ${esc(m.status||'None')}</p></div></div></section>
 <div class="columns"><section class="panel"><h3>Battle Sheet</h3><div class="stats-grid">${statKeys.map((key,i)=>`<div class="stat"><b>${Number(s[key])||0}</b><small>${statLabels[i]}</small></div>`).join('')}</div>
 <p class="hint">20-point brackets — Atk ${esc(d.physicalOffenseBand)}, SpA ${esc(d.specialOffenseBand)}, Def ${esc(d.physicalDefenseBand)}, SpD ${esc(d.specialDefenseBand)}. Speed ${d.effectiveSpeed} before battle modifiers.</p>
 <div class="stats-grid"><div class="stat"><b>${d.universalAC??'—'}</b><small>Universal AC (V5.2)</small></div><div class="stat"><b>${mul(d.physicalOffenseMultiplier)}</b><small>Physical offense</small></div><div class="stat"><b>${mul(d.specialOffenseMultiplier)}</b><small>Special offense</small></div><div class="stat"><b>${mul(d.physicalDefenseMultiplier)}</b><small>Physical defense</small></div><div class="stat"><b>${mul(d.specialDefenseMultiplier)}</b><small>Special defense</small></div></div>
 <p class="flag">${battleRules?'Uses GM-entered V5.2 rules. Unfilled tiers show Pending.':'GM has not configured the exact V5.2 modifiers. No obsolete V4 AC is used.'}</p>
 <div class="move-list">${(m.moves||[]).length?(m.moves||[]).map(name=>{
 const info=moveInfo[name];return `<div class="move"><b>${esc(name)}</b><div class="hint">${info?`${esc(info.type)} · ${esc(info.category)} · BP ${info.power??'—'} · Accuracy ${info.accuracy??'—'}`:'Move details not available'}</div></div>`;
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
 <label class="field">Assign to Trainer<select name="ownerUid" required>${trainers.map(t=>option(t.uid,t.email||t.uid,d.ownerUid||ownerFilter)).join('')}</select></label>
 <label class="field">Level<input name="level" type="number" min="1" max="100" required value="${level}"></label>
 <label class="field">Nickname<input name="nickname" maxlength="32" value="${esc(d.nickname||'')}"></label>
 <label class="field">Ability<input name="ability" list="abilities" maxlength="48" value="${esc(d.ability||d.abilities?.[0]||'')}"><datalist id="abilities">${(d.abilities||[]).map(a=>`<option value="${esc(a)}">`).join('')}</datalist></label>
 <label class="field">Maximum HP<input name="maxHp" data-generated="${defaultHp}" type="number" min="1" max="3000" required value="${d.maxHp||defaultHp}"></label>
 <label class="field">Current HP<input name="currentHp" type="number" min="0" max="3000" required value="${d.currentHp??d.maxHp??defaultHp}"></label>
 <label class="field">Party slot<select name="slot">${Array.from({length:7},(_,i)=>option(i,i===0?'Storage':`Slot ${i}`,d.slot??0)).join('')}</select></label>
 <label class="field">Held item<input name="heldItem" maxlength="80" value="${esc(d.heldItem||'')}"></label>
 <label class="field full">Four moves (comma-separated)<input name="moves" maxlength="240" placeholder="Quick Attack, Force Palm, Endure, Feint" value="${esc((d.moves||[]).join(', '))}" list="known-moves"><datalist id="known-moves">${(d.knownMoves||[]).slice(0,120).map(a=>`<option value="${esc(a)}"></option>`).join('')}</datalist></label>
 <label class="field full">Location obtained / history<input name="origin" maxlength="150" value="${esc(d.origin||'')}"></label>
 <label class="field full">GM notes / details<textarea name="notes" maxlength="1000">${esc(d.notes||'')}</textarea></label>
 <p class="hint full">Official six base stats, types, abilities and artwork are imported automatically. Default HP is calculated from our older V4 baseline until the finalized V5.2 HP rule is entered; you can override HP above. The obsolete V4 AC is NOT used.</p>
 <div class="actions"><button class="btn primary" type="submit" ${draft||existing?'':'disabled'}>${existing?'Save Pokémon':'Assign to Trainer'}</button></div>
 </form></section>`;
}
function rulesForm(){
 const r=battleRules||{};
 return `<section class="panel"><div class="toolbar"><h2>V5.2 combat configuration</h2><button class="btn" data-act="back">← Cancel</button></div>
 <p>Enter the finalized V5.2 values, rather than the superseded V4 formulas. Multipliers are listed in 20-point intervals starting at 0–19, 20–39, 40–59, and so on. A Pokémon with 200 Sp. Atk reads the 200–219 value (the 11th entry).</p>
 <form id="rules-form" class="form-grid">
 <label class="field">Universal AC<input name="universalAc" type="number" min="1" max="50" placeholder="Enter actual V5.2 value" value="${r.universalAc??''}"></label>
 <label class="field full">Offense multipliers (comma-separated)<textarea name="offenseBands" placeholder="20-point offense tier multipliers">${(r.offenseBands||[]).join(', ')}</textarea></label>
 <label class="field full">Defense multipliers (comma-separated)<textarea name="defenseBands" placeholder="20-point defense tier multipliers">${(r.defenseBands||[]).join(', ')}</textarea></label>
 <p class="hint full">Leave a field blank if its exact values have not been finalized. Unconfigured modifiers will display Pending, and players still see the original species base stats.</p>
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
 <label class="field full">Abilities (comma-separated)<input name="abilities" maxlength="140" placeholder="Kingdom's End"></label>
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
 if(view==='rules'){root.innerHTML=rulesForm();return}
 const mon=pokemon.find(m=>m.id===chosen);
 root.innerHTML=mon?detail(mon):listView();
}
function clearSelection(){chosen='';editingId='';draft=null;view='party';render()}
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
 const abilities=cap(f.get('abilities'),140).split(',').map(x=>x.trim()).filter(Boolean).slice(0,3);
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
 const moves=cap(f.get('moves'),240).split(',').map(x=>x.trim()).filter(Boolean);
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
  if(action==='new'&&GM_SITE){view='assign';draft=null;editingId='';chosen='';render()}
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
  if(action==='edit'&&GM_SITE){editingId=b.dataset.id;draft={...pokemon.find(x=>x.id===editingId)};view='assign';chosen='';render()}
  if(action==='delete'&&GM_SITE){
    const m=pokemon.find(x=>x.id===b.dataset.id);
    if(m&&confirm('Permanently delete the Pokémon record for '+(m.nickname||m.speciesName)+'?')){await deleteDoc(doc(store,'santara_pokemon',m.id));say('Pokémon record removed.');clearSelection()}
  }
  if(action==='heal'){const form=document.getElementById('track-form'),m=pokemon.find(x=>x.id===chosen);if(form&&m)form.elements.currentHp.value=m.maxHp}
  if(action==='google'){await signInWithPopup(auth,new GoogleAuthProvider())}
 }catch(err){fail(err)}finally{busy=false}
});
root.addEventListener('change',e=>{
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
