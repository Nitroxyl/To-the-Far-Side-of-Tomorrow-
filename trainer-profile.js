// Santara Trainer Passport: current Firebase user owns one personal card.
// Uploaded photos are resized to small WebP data URLs before storage in Firestore.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, collection, query, where, getDoc, onSnapshot, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {publicPartySlots,partySignature} from './pokemon-public-party.js';

const ROOT=document.getElementById('profile-root');
const GM_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const config=window.SANTARA_FIREBASE_CONFIG;
const themes={crimson:['#b8395a','#35142f'],ocean:['#168db9','#112c55'],emerald:['#118e78','#173a34'],violet:['#9163e6','#332263'],amber:['#d68932','#624028'],midnight:['#3d526b','#111b2e'],rose:['#dd7195','#552643'],frost:['#5f9ab7','#26435c']};
const emblems=['🎒','⚔️','✨','🔥','🌊','🌿','⚡','🌙','💎','🐉','🛡️','🧭'];
const types=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const patterns=['plain','grid','diagonal','rings','stars'];
const defaults={trainerName:'New Trainer',trainerClass:'Pokémon Trainer',trainerTitle:'Rookie Researcher',hometown:'Luma Town',partnerPokemon:'My partner',favoriteType:'Normal',theme:'ocean',avatar:'🎒',badgeCount:0,quote:'Every journey begins somewhere.',team:['','','','','',''],customPrimary:'#168db9',customSecondary:'#112c55',pattern:'grid',portraitData:'',bannerData:''};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const correctHex=x=>/^#[0-9a-fA-F]{6}$/.test(x||'');
const validImage=(value,limit)=>typeof value==='string'&&value.length<=limit&&/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(value);
const safeImage=(v,max)=>validImage(v,max)?v:'';
const custom=(p,k)=>correctHex(p[k])?p[k]:themes[p.theme]?.[k==='customPrimary'?0:1]||themes.ocean[0];
const option=(arr,selected)=>arr.map(s=>'<option value="'+esc(s)+'" '+(String(s)===String(selected)?'selected':'')+'>'+esc(s)+'</option>').join('');
const targetFromUrl=new URLSearchParams(location.search).get('uid');
const requestedUid=targetFromUrl && /^[A-Za-z0-9]{10,128}$/.test(targetFromUrl)?targetFromUrl:null;
let auth,store,user=null,profileUid=null,owner=false,canEnter=false,stopAccess=null,stopRole=null,stopCard=null,stopParty=null,stopOwnPokemon=null,dirty=false,currentPane='identity';
let partySlots=Array(6).fill(null),partyReady=false,ownPokemon=[],ownPokemonLoaded=false;
let model={...defaults},original=null,working=false;

function gate(title,text,extra=''){
 ROOT.innerHTML='<section class="panel loading"><span class="eyebrow">TRAINER ACCESS</span><h2>'+esc(title)+'</h2><p>'+esc(text)+'</p>'+extra+'</section>';
}
function errorMessage(e){
 const msg=e?.message||String(e);
 return msg.includes('permission-denied')?'Access denied by Firestore. Check the new Trainer Card rules in Firebase.':msg;
}
function partyArt(s) {
 if(!s)return '';
 const data=validImage(s.artData,150000)?s.artData:'';
 const url=/^https:\/\//i.test(s.artUrl||'')?s.artUrl:'';
 const src=data||url;
 return src?'<img class="party-pokemon-art" src="'+esc(src)+'" loading="lazy" alt="">':'<span class="ball">◉</span>';
}
async function syncMyPublicParty(){
 if(!owner||!user||profileUid!==user.uid)return;
 const slots=publicPartySlots(ownPokemon);
 partySlots=slots;partyReady=true;updatePreview();
 try{
  const ref=doc(store,'santara_public_parties',user.uid),existing=await getDoc(ref);
  if(!existing.exists()||partySignature(existing.data().slots)!==partySignature(slots)){
   await setDoc(ref,{ownerUid:user.uid,slots,updatedAt:serverTimestamp()});
  }
 }catch(err){console.warn('Trainer Card party sync:',err.message)}
}
function subscribeParty(){
 stopParty?.();stopParty=null;stopOwnPokemon?.();stopOwnPokemon=null;
 partySlots=Array(6).fill(null);partyReady=false;ownPokemon=[];ownPokemonLoaded=false;
 stopParty=onSnapshot(doc(store,'santara_public_parties',profileUid),snap=>{
  // For your own card, the authoritative collection takes precedence.
  if(owner && ownPokemonLoaded)return;
  partySlots=snap.exists()&&Array.isArray(snap.data().slots)?snap.data().slots.slice(0,6):Array(6).fill(null);
  while(partySlots.length<6)partySlots.push(null);
  partyReady=true;
  if(owner)updatePreview();else render();
 },err=>{console.warn('Public party unavailable:',err.message);partyReady=true;if(!owner)render();});
 if(owner){
  stopOwnPokemon=onSnapshot(query(collection(store,'santara_pokemon'),where('ownerUid','==',user.uid)),snap=>{
   ownPokemon=snap.docs.map(d=>d.data());ownPokemonLoaded=true;
   syncMyPublicParty();
  },err=>console.warn('My Pokémon unavailable:',err.message));
 }
}
function paintCard(p){
 const primary=correctHex(p.customPrimary)?p.customPrimary:(themes[p.theme]||themes.ocean)[0];
 const secondary=correctHex(p.customSecondary)?p.customSecondary:(themes[p.theme]||themes.ocean)[1];
 const pattern=patterns.includes(p.pattern)?p.pattern:'plain';
 const avatarData=safeImage(p.portraitData,150000);
 const bannerData=safeImage(p.bannerData,260000);
 const badge=Math.max(0,Math.min(8,Number(p.badgeCount)||0));
 const team=partySlots.slice(0,6);
 while(team.length<6)team.push(null);
 return '<article class="passport pattern-'+pattern+'" style="--c1:'+primary+';--c2:'+secondary+';--c3:#c1ffe9">'+
  (bannerData?'<img class="cover" alt="" src="'+bannerData+'">':'')+
  '<div class="shade"></div><div class="passport-inner">'+
  '<div class="id-top"><span>✦ SANTARA REGION / LEAGUE ID</span><span class="diamond">◇</span></div>'+
  '<div class="id-rule"></div><span class="smallcaps">'+esc(p.trainerTitle||'REGIONAL TRAINER')+'</span>'+
  '<div class="identity">'+
  (avatarData?'<img class="portrait" alt="Trainer profile portrait" src="'+avatarData+'">':
    '<div class="portrait emblem-portrait" role="img" aria-label="Trainer emblem">'+(emblems.includes(p.avatar)?p.avatar:'🎒')+'</div>')+
  '<div class="identity-details"><h2>'+esc(p.trainerName||'New Trainer')+'</h2><div class="subtitle">'+esc(p.trainerClass||'Pokémon Trainer')+'</div><div class="smallcaps" style="margin-top:8px">⌖ '+esc(p.hometown||'Santara')+'</div></div></div>'+
  '<div class="meta"><span class="chip">✦ '+esc(p.favoriteType||'Normal')+' type</span><span class="chip">◆ '+badge+' badges</span><span class="chip">Partner: '+esc(p.partnerPokemon||'—')+'</span></div>'+
  '<div class="section-title">REGISTERED PARTY</div><div class="squad">'+team.map((n,i)=>'<div class="squad-unit">'+(n?partyArt(n)+'<span class="squad-name">'+esc(n.name)+'</span><span class="squad-level">Lv. '+Number(n.level||1)+'</span>':'<span class="squad-empty">Slot '+(i+1)+' · Empty</span>')+'</div>').join('')+'</div>'+
  '<div class="card-motto">“'+esc(p.quote||'Every journey begins somewhere.')+'”</div>'+
  '<div class="id-bottom"><span>TRAINER PASSPORT / FIELD RESEARCH</span><span>✦ AUTHORIZED</span></div>'+
  '</div></article>';
}
function htmlEditor(){
 const p=model;
 const val=k=>esc(p[k]??'');
 const team=Array.isArray(p.team)?p.team.slice(0,6):[];
 while(team.length<6)team.push('');
 return '<div class="studio"><section class="preview-wrap"><div class="preview-label"><h2>Live card preview</h2><span>Updates as you customize</span></div><div id="passport-preview">'+paintCard(p)+'</div>'+
 '<p class="preview-helper">Your six party slots now sync from My Pokémon automatically, including Pokémon assigned or moved by your GM. Your colours, portrait and motto are saved separately.</p>'+
 '<a class="linkbtn" href="./index.html?tab=trainer">← Browse Trainer Roster</a></section>'+
 '<section class="panel"><div class="editor-header"><h2>Customize your ID</h2><span class="eyebrow">PERSONAL EDITION</span></div>'+
 '<div class="section-tabs" role="tablist" aria-label="Trainer card editor sections">'+
 [['identity','Identity'],['design','Design & photos'],['team','Team']].map(([id,t])=>'<button type="button" data-pane="'+id+'" class="'+(currentPane===id?'active':'')+'" aria-selected="'+(currentPane===id?'true':'false')+'">'+t+'</button>').join('')+'</div>'+
 '<form id="passport-form">'+
 '<section class="tabpane" data-pane-body="identity" '+(currentPane==='identity'?'':'hidden')+'><div class="form-group">'+
 '<label class="field">Trainer name<input name="trainerName" maxlength="32" required value="'+val('trainerName')+'"></label>'+
 '<label class="field">Trainer class<input name="trainerClass" maxlength="32" required value="'+val('trainerClass')+'"></label>'+
 '<label class="field">Card title<input name="trainerTitle" maxlength="32" value="'+val('trainerTitle')+'"><small>For example: Rising Challenger</small></label>'+
 '<label class="field">Hometown<input name="hometown" maxlength="48" value="'+val('hometown')+'"></label>'+
 '<label class="field">Partner Pokémon<input name="partnerPokemon" maxlength="48" value="'+val('partnerPokemon')+'"></label>'+
 '<label class="field">Favorite type<select name="favoriteType">'+option(types,p.favoriteType)+'</select></label>'+
 '<label class="field">Gym badges<select name="badgeCount">'+option(['0','1','2','3','4','5','6','7','8'],String(p.badgeCount??0))+'</select></label>'+
 '<label class="field">Emblem<select name="avatar">'+option(emblems,p.avatar)+'</select></label>'+
 '<label class="field full">Trainer motto<textarea name="quote" maxlength="180" rows="3">'+val('quote')+'</textarea></label>'+
 '</div></section>'+
 '<section class="tabpane" data-pane-body="design" '+(currentPane==='design'?'':'hidden')+'><div class="form-group">'+
 '<label class="field">Theme preset<select name="theme">'+option(Object.keys(themes),p.theme)+'</select></label>'+
 '<label class="field">Background texture<select name="pattern">'+option(patterns,p.pattern)+'</select></label>'+
 '<label class="field">Primary colour<input type="color" name="customPrimary" value="'+(correctHex(p.customPrimary)?p.customPrimary:'#168db9')+'"></label>'+
 '<label class="field">Secondary colour<input type="color" name="customSecondary" value="'+(correctHex(p.customSecondary)?p.customSecondary:'#112c55')+'"></label>'+
 '</div>'+
 '<div class="media-tools"><h3>Trainer portrait</h3><p class="hint">Upload JPG, PNG or WebP. Cropped square and compressed to WebP, maximum 8 MB source.</p>'+
 '<label class="field">Choose portrait<input type="file" name="portraitUpload" accept="image/jpeg,image/png,image/webp"></label>'+
 '<button class="small-btn" type="button" data-remove-image="portraitData">Remove portrait</button></div>'+
 '<div class="media-tools"><h3>Card background</h3><p class="hint">Upload a scenic background or custom artwork. It will be cropped to a wide banner.</p>'+
 '<label class="field">Choose background<input type="file" name="bannerUpload" accept="image/jpeg,image/png,image/webp"></label>'+
 '<button class="small-btn" type="button" data-remove-image="bannerData">Remove background</button></div>'+
 '</section>'+
 '<section class="tabpane" data-pane-body="team" '+(currentPane==='team'?'':'hidden')+'><h3>My Pokémon — live party</h3><p class="hint">These six slots are read-only here. Manage your party positions, nicknames and Pokémon in My Pokémon; the Trainer Card updates automatically.</p><a class="linkbtn" href="./pokemon-party.html">Open My Pokémon</a></section>'+
 '<div class="savebar"><button class="save" type="submit" '+(working?'disabled':'')+'>'+(working?'Saving…':'Save Trainer Card')+'</button><span id="form-status" class="form-msg" role="status">'+(dirty?'Unsaved changes':'Saved data loads automatically')+'</span></div>'+
 '</form></section></div>';
}
function render(){
 if(!canEnter||!profileUid){return}
 if(!owner){
  ROOT.innerHTML='<section class="read-only"><div class="preview-label"><h2>Trainer record</h2><span>Shared with approved Trainers</span></div>'+paintCard(model)+
  '<a class="linkbtn" href="./index.html?tab=trainer">← Return to Trainer Roster</a></section>';
 }else{
  ROOT.innerHTML=htmlEditor();
  for(const b of ROOT.querySelectorAll('[data-pane]'))b.addEventListener('click',()=>switchPane(b.dataset.pane));
  for(const b of ROOT.querySelectorAll('[data-remove-image]'))b.addEventListener('click',()=>{
    model[b.dataset.removeImage]='';dirty=true;updatePreview();feedback('Image removed from preview. Click Save Trainer Card to publish the change.');
  });
  const form=ROOT.querySelector('#passport-form');
  form.addEventListener('input',e=>{if(e.target.type==='file')return;collect(form,e.target.name);});
  form.addEventListener('change',async e=>{
    if(e.target.name==='portraitUpload'||e.target.name==='bannerUpload'){
      const file=e.target.files?.[0];if(!file)return;
      const key=e.target.name==='portraitUpload'?'portraitData':'bannerData';
      try{
       feedback('Optimizing image…');
       const data=await downsize(file,key==='portraitData'?'portrait':'banner');
       model[key]=data;dirty=true;updatePreview();
       feedback('Image ready. Click Save Trainer Card to publish it.');
      }catch(err){feedback('Image error: '+err.message)}
    } else {collect(form,e.target.name)}
  });
  form.addEventListener('submit',saveCard);
 }
}
function switchPane(next){
 if(!['identity','design','team'].includes(next))return;
 currentPane=next;
 for(const node of ROOT.querySelectorAll('[data-pane-body]'))node.hidden=node.dataset.paneBody!==next;
 for(const btn of ROOT.querySelectorAll('[data-pane]')){
  btn.classList.toggle('active',btn.dataset.pane===next);
  btn.setAttribute('aria-selected',String(btn.dataset.pane===next));
 }
}
function collect(form,key){
 if(!key)return;
 const data=new FormData(form);
 if(key==='theme'){
  const t=String(data.get('theme')||'ocean');
  model.theme=Object.hasOwn(themes,t)?t:'ocean';
  [model.customPrimary,model.customSecondary]=themes[model.theme];
 } else if(/^team[0-5]$/.test(key)){
  const index=Number(key.slice(-1));
  model.team[index]=String(data.get(key)||'').slice(0,32);
 } else if(key==='badgeCount'){
  model.badgeCount=Math.max(0,Math.min(8,Number(data.get(key))||0));
 }else if(Object.hasOwn(model,key)){
  model[key]=String(data.get(key)||'').slice(0,key==='quote'?180:key==='partnerPokemon'||key==='hometown'?48:32);
 }
 if(key==='theme'){
  const primary=form.querySelector('[name=customPrimary]'),secondary=form.querySelector('[name=customSecondary]');
  if(primary)primary.value=model.customPrimary;
  if(secondary)secondary.value=model.customSecondary;
 }
 dirty=true;updatePreview();
 const line=ROOT.querySelector('#form-status');if(line)line.textContent='Unsaved changes';
}
function updatePreview(){const node=document.getElementById('passport-preview');if(node)node.innerHTML=paintCard(model)}
function feedback(message){const line=ROOT.querySelector('#form-status');if(line)line.textContent=message}
async function downsize(file,kind){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Please select a JPG, PNG or WebP image.');
 if(file.size>8*1024*1024)throw new Error('Source image is over 8 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  let w=kind==='portrait'?320:1100,h=kind==='portrait'?360:400;
  const maxLength=kind==='portrait'?130000:230000;
  for(let attempt=0;attempt<8;attempt++){
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const context=canvas.getContext('2d',{alpha:false});if(!context)throw new Error('Canvas is unavailable.');
   context.fillStyle='#0c1e30';context.fillRect(0,0,w,h);
   const scale=Math.max(w/bitmap.width,h/bitmap.height);
   const dw=bitmap.width*scale,dh=bitmap.height*scale;
   context.drawImage(bitmap,(w-dw)/2,(h-dh)/2,dw,dh);
   const result=canvas.toDataURL('image/webp',Math.max(.45,.82-attempt*.065));
   if(!result.startsWith('data:image/webp;base64,'))throw new Error('WebP encoding is unsupported in this browser.');
   if(result.length<=maxLength)return result;
   w=Math.max(kind==='portrait'?180:600,Math.round(w*.83));
   h=Math.max(kind==='portrait'?205:220,Math.round(h*.83));
  }
  throw new Error('Image is too complex to compress. Try another image.');
 }finally{bitmap.close?.()}
}
async function saveCard(e){
 e.preventDefault();
 if(!owner||!canEnter||working)return;
 const form=e.target;if(!form.reportValidity())return;
 for(const key of ['trainerName','trainerClass','trainerTitle','hometown','partnerPokemon','favoriteType','theme','avatar','badgeCount','quote','pattern','customPrimary','customSecondary',...Array.from({length:6},(_,i)=>'team'+i)]){
  // Field may be in a hidden editor pane; FormData still includes it.
  if(!key.startsWith('team'))collectWithoutRedraw(form,key);
 }
 const raw=new FormData(form);
 model.team=partySlots.map(slot=>String(slot?.name||'').slice(0,32));
 if(!model.trainerName.trim()){feedback('Enter a Trainer name.');return}
 const entry={
  ownerUid:user.uid,
  trainerName:model.trainerName.trim().slice(0,32),
  trainerClass:String(model.trainerClass||'').slice(0,32),
  trainerTitle:String(model.trainerTitle||'').slice(0,32),
  hometown:String(model.hometown||'').slice(0,48),
  partnerPokemon:String(model.partnerPokemon||'').slice(0,48),
  favoriteType:types.includes(model.favoriteType)?model.favoriteType:'Normal',
  theme:Object.hasOwn(themes,model.theme)?model.theme:'ocean',
  avatar:emblems.includes(model.avatar)?model.avatar:'🎒',
  badgeCount:Math.max(0,Math.min(8,Math.floor(Number(model.badgeCount)||0))),
  quote:String(model.quote||'').slice(0,180),
  team:model.team,
  pattern:patterns.includes(model.pattern)?model.pattern:'plain',
  customPrimary:correctHex(model.customPrimary)?model.customPrimary:themes.ocean[0],
  customSecondary:correctHex(model.customSecondary)?model.customSecondary:themes.ocean[1],
  portraitData:safeImage(model.portraitData,150000),
  bannerData:safeImage(model.bannerData,260000),
  updatedAt:serverTimestamp()
 };
 if(entry.portraitData.length>150000||entry.bannerData.length>260000){feedback('Image size limit exceeded.');return}
 working=true;const btn=form.querySelector('button[type=submit]');if(btn){btn.disabled=true;btn.textContent='Saving…'}
 feedback('Saving Trainer Card to Firestore…');
 try{
  await setDoc(doc(store,'santara_trainer_cards',user.uid),entry);
  dirty=false;feedback('Trainer Card saved! The party can now view your updated profile.');
 }catch(err){feedback('Save failed: '+errorMessage(err))}
 finally{working=false;if(btn){btn.disabled=false;btn.textContent='Save Trainer Card'}}
}
function collectWithoutRedraw(form,key){
 const raw=new FormData(form),v=raw.get(key);if(v==null)return;
 if(key==='badgeCount')model.badgeCount=Math.max(0,Math.min(8,Number(v)||0));
 else if(key==='theme')model.theme=Object.hasOwn(themes,String(v))?String(v):'ocean';
 else if(Object.hasOwn(model,key))model[key]=String(v).slice(0,key==='quote'?180:48);
}
function subscribe(){
 if(stopCard)stopCard();
 subscribeParty();
 owner=profileUid===user.uid;
 dirty=false;
 gate(owner?'Preparing your Trainer Card':'Loading Trainer record','Fetching the saved profile.');
 stopCard=onSnapshot(doc(store,'santara_trainer_cards',profileUid),snapshot=>{
  if(!dirty){original=snapshot.exists()?snapshot.data():null;model={...defaults,...original,team:Array.isArray(original?.team)?[...original.team.slice(0,6)]:['','','','','','']}}
  render();
 },e=>gate('Could not load Trainer Card',errorMessage(e),'<a class="linkbtn" href="./index.html?tab=trainer">Return to roster</a>'));
}
function enter(){
 canEnter=true;profileUid=requestedUid||user.uid;
 // Keep the access listener active so revocation closes this profile immediately.
 if(!stopCard)subscribe();
}
function authHandler(u){
 if(stopRole){stopRole();stopRole=null}
 stopParty?.();stopParty=null;stopOwnPokemon?.();stopOwnPokemon=null;partySlots=Array(6).fill(null);ownPokemon=[];ownPokemonLoaded=false;partyReady=false;
 if(stopCard){stopCard();stopCard=null}
 if(stopAccess){stopAccess();stopAccess=null}
 canEnter=false;user=u;dirty=false;original=null;
 if(!user){
  gate('Sign in to your Trainer Passport','Use your existing verified Santara account. New players should register through the main Pokédex.',
    '<form id="passport-signin" style="display:grid;gap:12px;max-width:420px">'+
    '<label class="field">Email<input required type="email" name="email" autocomplete="email"></label>'+
    '<label class="field">Password<input required type="password" name="password" autocomplete="current-password"></label>'+
    '<button class="save" type="submit">Sign in</button></form>'+
    '<button class="linkbtn" id="passport-google" type="button">Sign in with Google</button> <a class="linkbtn" href="./index.html">Register / verify through Pokédex</a>'+
    '<p id="signin-status" class="hint"></p>');
  ROOT.querySelector('#passport-signin').addEventListener('submit',async e=>{
   e.preventDefault();const f=new FormData(e.target);
   try{await signInWithEmailAndPassword(auth,String(f.get('email')||''),String(f.get('password')||''))}
   catch(err){const t=ROOT.querySelector('#signin-status');if(t)t.textContent=errorMessage(err)}
  });
  ROOT.querySelector('#passport-google').addEventListener('click',async()=>{
   try{await signInWithPopup(auth,new GoogleAuthProvider())}
   catch(err){const t=ROOT.querySelector('#signin-status');if(t)t.textContent=errorMessage(err)}
  });
  return;
 }
 if(!user.emailVerified){
  gate('Email verification required','Please verify your email before opening Trainer Cards.','<a class="linkbtn" href="./index.html">Return to Pokédex to verify</a>');return;
 }
 if(user.uid===GM_UID){enter();return}
 gate('Checking Trainer access','Looking up your existing Trainer approval or GM role.');
 let gmRole=false,approvedAccess=false;
 const refresh=()=>{
  if(gmRole||approvedAccess){enter();return}
  if(stopCard){stopCard();stopCard=null}
  canEnter=false;
  gate('Waiting for account approval','Your existing account needs Trainer approval or an authorized GM role. No new account is required.',
   '<a class="linkbtn" href="./account-access.html">Check account access and copy UID</a>');
 };
 stopRole=onSnapshot(doc(store,'santara_gm_accounts',user.uid),snap=>{
  const g=snap.exists()?snap.data():null;
  gmRole=g?.enabled===true&&g.email===user.email;
  refresh();
 },e=>{console.warn('GM access lookup:',e.message);gmRole=false;refresh()});
 stopAccess=onSnapshot(doc(store,'santara_player_access',user.uid),snap=>{
  approvedAccess=snap.exists()&&snap.data()?.enabled===true;refresh();
 },e=>gate('Could not check account',errorMessage(e),'<a class="linkbtn" href="./account-access.html">Check account access</a>'));
}
if(!config || Object.values(config).some(v=>typeof v==='string'&&v.includes('PASTE_'))){
 gate('Firebase not configured','The GM needs to configure the Player Pokédex.');
}else{
 try{
  const app=initializeApp(config);
  auth=getAuth(app);store=getFirestore(app);
  onAuthStateChanged(auth,authHandler,e=>gate('Sign-in problem',errorMessage(e)));
 }catch(e){gate('Profile unavailable',errorMessage(e))}
}
