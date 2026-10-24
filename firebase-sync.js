// Santara player accounts, approval gate, live research and custom Trainer Cards.
// Player-facing code intentionally never contains unpublished GM campaign data.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut, sendEmailVerification, sendPasswordResetEmail, reload, getIdToken } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import { getFirestore, doc, collection, onSnapshot, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const config = window.SANTARA_FIREBASE_CONFIG;
const bridge = window.SantaraBridge;
const GM_UID = 'ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const configured = config && ['apiKey','authDomain','projectId','appId'].every(k => typeof config[k] === 'string' && !config[k].includes('PASTE_') && config[k].length > 4);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const THEMES = {
  crimson:['#b8395a','#35142f'], ocean:['#168db9','#112c55'], emerald:['#118e78','#173a34'],
  violet:['#9163e6','#332263'], amber:['#d68932','#624028'], midnight:['#3d526b','#111b2e'],
  rose:['#dd7195','#552643'], frost:['#5f9ab7','#26435c']
};
const ICONS = ['🎒','⚔️','✨','🔥','🌊','🌿','⚡','🌙','💎','🐉','🛡️','🧭'];
const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const DEFAULT = {trainerName:'New Trainer',trainerClass:'Pokémon Trainer',hometown:'Luma Town',partnerPokemon:'My partner',favoriteType:'Normal',theme:'ocean',avatar:'🎒',badgeCount:0,quote:'Every journey begins somewhere.'};
const overlay=document.createElement('div');
overlay.id='santara-access-overlay';
overlay.style.cssText='position:fixed;inset:0;z-index:40;background:rgba(7,14,23,.96);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;color:#eaf5f7;font:14px/1.5 system-ui,sans-serif';
overlay.innerHTML='<div id="santara-access-content" role="dialog" aria-modal="true" aria-label="Trainer access" style="background:#142432;border:1px solid #437d82;border-radius:20px;padding:25px;width:min(470px,100%);box-shadow:0 25px 70px #0009"></div>';
document.body.append(overlay);
const cloud=document.createElement('aside');
cloud.id='santara-cloud-panel';
cloud.style.cssText='position:fixed;z-index:5;bottom:13px;right:13px;max-width:340px;background:#142735;color:#bce0d7;border:1px solid #507f82;border-radius:12px;padding:10px 13px;font:12px/1.5 system-ui,sans-serif';
cloud.setAttribute('role','status');
document.body.append(cloud);
const status=msg=>{cloud.textContent='☁ Santara · '+msg};
const accessBody=()=>overlay.querySelector('#santara-access-content');
const btn=(label,action)=>'<button type="button" data-auth-action="'+action+'" style="background:#226b69;color:white;border:1px solid #74b6ab;border-radius:8px;padding:9px 12px;cursor:pointer;margin:4px 5px 3px 0">'+label+'</button>';
const gate=(title,body)=>{overlay.hidden=false;overlay.style.display='flex';accessBody().innerHTML='<div style="font-size:11px;color:#8adacc;letter-spacing:2px;font-weight:800">SANTARA · TRAINER ACCESS</div><h2 style="margin:8px 0 13px;font-size:25px">'+esc(title)+'</h2>'+body};
const warn=message=>{const el=overlay.querySelector('#access-message');if(el)el.textContent=message};
let app=null,auth=null,store=null,currentUser=null,approved=false,pending=false;
let stopAccess=null,stopRequest=null,stopPublished=null,stopMyCard=null,stopRoster=null;
let ownCard=null,roster=[],formSaving=false,connectedUser='';
const clearListeners=()=>{
  for(const fn of [stopAccess,stopRequest,stopPublished,stopMyCard,stopRoster])if(fn)fn();
  stopAccess=stopRequest=stopPublished=stopMyCard=stopRoster=null;
  connectedUser='';approved=false;ownCard=null;roster=[];
};
function showLogin(){
  gate('Welcome, Trainer', '<p style="color:#b7cbd1">Sign in, or create an account with your email. New players must verify their email and receive GM approval.</p>'+
    '<form id="trainer-auth-form" style="display:grid;gap:11px"><label>Email<input required type="email" name="email" autocomplete="email" placeholder="trainer@example.com" style="display:block;width:100%;background:#1d3442;border:1px solid #527582;border-radius:8px;color:white;padding:11px"></label>'+
    '<label>Password<input required type="password" name="password" minlength="6" autocomplete="current-password" style="display:block;width:100%;background:#1d3442;border:1px solid #527582;border-radius:8px;color:white;padding:11px"></label>'+
    '<div>'+btn('Sign in','login')+btn('Create account','register')+'</div></form>'+
    '<div>'+btn('Continue with Google','google')+btn('Reset password','reset')+'</div><p id="access-message" role="status" style="color:#e7c58b"></p>');
  status('Sign in to unlock fieldwork');
}
function showUnverified(){
  gate('Verify your email','<p style="color:#b7cbd1">A verification link has been sent to <strong>'+esc(currentUser?.email)+'</strong>. Open the email, follow its link, then return here.</p>'+
    '<div>'+btn("I've verified my email",'check')+btn('Resend verification','resend')+btn('Sign out','logout')+'</div><p id="access-message" role="status" style="color:#e7c58b"></p>');
  status('Email verification required');
}
function showAwaiting(){
  gate('Awaiting GM approval','<p style="color:#b7cbd1">Your email is verified: <strong>'+esc(currentUser?.email)+'</strong>. '+(pending?'Your access request has been sent. The GM must approve your account.':'Request access so the GM can approve your account.')+'</p>'+
  '<div>'+(pending?'':btn('Request Trainer access','request'))+btn('Sign out','logout')+'</div><p id="access-message" role="status" style="color:#e7c58b"></p>');
  status('Waiting for GM approval');
}
function showAccess(){
  overlay.hidden=true;overlay.style.display='none';
  status('Verified Trainer · Live sync active');
}
async function verifyRefresh(){
  if(!auth.currentUser)return;
  await reload(auth.currentUser);
  await getIdToken(auth.currentUser,true);
  currentUser=auth.currentUser;
  if(currentUser.emailVerified) await checkAccount(currentUser);
  else showUnverified();
}
async function checkAccount(user){
  clearListeners();currentUser=user; pending=false;
  if(!user){showLogin();return}
  if(!user.emailVerified){showUnverified();return}
  if(user.uid===GM_UID){approved=true;activate();return}
  showAwaiting();
  const requestRef=doc(store,'santara_access_requests',user.uid);
  const accessRef=doc(store,'santara_player_access',user.uid);
  stopRequest=onSnapshot(requestRef,snap=>{pending=snap.exists();if(!approved)showAwaiting()},e=>warn(e.message));
  stopAccess=onSnapshot(accessRef,snap=>{
    const isApproved=snap.exists()&&snap.data().enabled===true;
    if(isApproved){approved=true;activate()}
    else{if(approved){stopConnected();approved=false;}showAwaiting()}
  },e=>warn(e.message));
}
function stopConnected(){
  for(const fn of [stopPublished,stopMyCard,stopRoster])if(fn)fn();
  stopPublished=stopMyCard=stopRoster=null;connectedUser='';ownCard=null;roster=[];
}
function activate(){
  showAccess();
  if(connectedUser===currentUser.uid)return;
  stopConnected();connectedUser=currentUser.uid;
  stopPublished=onSnapshot(doc(store,'santara_publication','current'),snap=>{
    if(!snap.exists()){status('Verified · Awaiting first GM publication');return}
    const bundle=snap.data()?.bundle;
    if(bundle?.kind!=='santaraPublished'||!['sites','requests','sightings'].every(k=>Array.isArray(bundle[k]))){status('Invalid fieldwork publication');return}
    try{bridge.applyPublication(bundle);status('Fieldwork synced · Trainer verified');}
    catch(e){status('Import error: '+e.message)}
  },e=>status('Live sync error: '+e.message));
  stopMyCard=onSnapshot(doc(store,'santara_trainer_cards',currentUser.uid),snap=>{
    ownCard=snap.exists()?snap.data():null;window.SantaraTrainer?.render?.();
  },e=>status('Card sync error: '+e.message));
  stopRoster=onSnapshot(collection(store,'santara_trainer_cards'),snap=>{
    roster=snap.docs.map(d=>({uid:d.id,...d.data()}));window.SantaraTrainer?.render?.();
  },e=>status('Roster error: '+e.message));
}
async function act(action){
  try{
    warn('');
    const form=overlay.querySelector('#trainer-auth-form');
    const email=form?.querySelector('[name=email]')?.value?.trim();
    const password=form?.querySelector('[name=password]')?.value;
    if(action==='login'||action==='register'){
      if(!form?.reportValidity())return;
      if(action==='login')await signInWithEmailAndPassword(auth,email,password);
      else{const result=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(result.user);warn('Verification email sent.')}
    }else if(action==='google')await signInWithPopup(auth,new GoogleAuthProvider());
    else if(action==='reset'){if(!email)throw Error('Enter your email above before resetting your password.');await sendPasswordResetEmail(auth,email);warn('If the address is registered, check its inbox for reset instructions.')}
    else if(action==='resend'){await sendEmailVerification(auth.currentUser);warn('Verification email sent again.')}
    else if(action==='check')await verifyRefresh();
    else if(action==='logout')await signOut(auth);
    else if(action==='request'){
      await setDoc(doc(store,'santara_access_requests',currentUser.uid),{email:currentUser.email,createdAt:serverTimestamp()});
      pending=true;showAwaiting();
    }
  }catch(e){warn(e.message||String(e))}
}
overlay.addEventListener('click',e=>{const b=e.target.closest('[data-auth-action]');if(b)act(b.dataset.authAction)});
overlay.addEventListener('submit',e=>e.preventDefault());

function palette(value){return THEMES[value]||THEMES.ocean}
function formatCard(data,compact=false){
  const p={...DEFAULT,...data},[primary,secondary]=palette(p.theme);
  const themeName=Object.hasOwn(THEMES,p.theme)?p.theme:'ocean';
  return '<article class="trainer-preview" style="--card-primary:'+primary+';--card-secondary:'+secondary+'">'+
   '<div class="trainer-eyebrow">SANTARA · OFFICIAL TRAINER CARD</div>'+
   '<div class="trainer-row"><div class="trainer-avatar">'+(ICONS.includes(p.avatar)?p.avatar:'🎒')+'</div>'+
   '<div><div class="trainer-name">'+esc(p.trainerName)+'</div><div>'+esc(p.trainerClass)+'</div><div class="trainer-helper" style="color:#fff">From '+esc(p.hometown)+'</div></div></div>'+
   '<div style="margin-top:19px"><span class="trainer-chip">Partner: '+esc(p.partnerPokemon)+'</span><span class="trainer-chip">'+esc(p.favoriteType)+' specialist</span><span class="trainer-chip">'+Number(p.badgeCount||0)+' badges</span></div>'+
   (compact?'':'<p class="trainer-quote">“'+esc(p.quote)+'”</p>')+
   '<div class="trainer-eyebrow" style="margin-top:17px">THE '+esc(themeName.toUpperCase())+' EDITION</div></article>';
}
function choices(items,value){
 return items.map(item=>'<option value="'+esc(item)+'" '+(item===value?'selected':'')+'>'+esc(item)+'</option>').join('')
}
async function saveTrainer(form){
 if(!approved||!currentUser)return;
 if(formSaving)return;
 formSaving=true;
 const fd=new FormData(form);
 const string=(k,max)=>String(fd.get(k)||'').trim().slice(0,max);
 const theme=string('theme',20),avatar=string('avatar',6),favoriteType=string('favoriteType',30);
 const card={
   ownerUid:currentUser.uid,trainerName:string('trainerName',32),trainerClass:string('trainerClass',32),
   hometown:string('hometown',48),partnerPokemon:string('partnerPokemon',48),
   favoriteType:TYPES.includes(favoriteType)?favoriteType:'Normal',
   theme:Object.hasOwn(THEMES,theme)?theme:'ocean',
   avatar:ICONS.includes(avatar)?avatar:'🎒',
   badgeCount:Math.max(0,Math.min(8,Number(fd.get('badgeCount'))||0)),
   quote:string('quote',180),updatedAt:serverTimestamp()
 };
 const feedback=form.querySelector('#trainer-feedback');
 try{await setDoc(doc(store,'santara_trainer_cards',currentUser.uid),card);if(feedback)feedback.textContent='Trainer Card saved and shared with approved Trainers.'}
 catch(e){if(feedback)feedback.textContent='Could not save: '+e.message}
 finally{formSaving=false}
}
window.SantaraTrainer={
 render(){
  const root=document.getElementById('trainer-card-root');
  if(!root)return;
  if(!approved||!currentUser){
    root.innerHTML='<div class="trainer-alert">Sign in, verify your email and receive GM approval to create a Trainer Card.</div>';
    return;
  }
  const p={...DEFAULT,...ownCard};
  const editor='<section class="trainer-form"><h2 class="trainer-title">Customize your Trainer Card</h2><p class="trainer-helper">Your own card is editable; other Trainers can view it after you save.</p>'+
  '<form id="trainer-profile-form"><div class="trainer-formgrid">'+
  '<label>Trainer name<input required maxlength="32" name="trainerName" value="'+esc(p.trainerName)+'"></label>'+
  '<label>Trainer class<input required maxlength="32" name="trainerClass" value="'+esc(p.trainerClass)+'"></label>'+
  '<label>Hometown<input maxlength="48" name="hometown" value="'+esc(p.hometown)+'"></label>'+
  '<label>Partner Pokémon<input maxlength="48" name="partnerPokemon" value="'+esc(p.partnerPokemon)+'"></label>'+
  '<label>Favourite type<select name="favoriteType">'+choices(TYPES,p.favoriteType)+'</select></label>'+
  '<label>Card colour<select name="theme">'+choices(Object.keys(THEMES),p.theme)+'</select></label>'+
  '<label>Trainer emblem<select name="avatar">'+choices(ICONS,p.avatar)+'</select></label>'+
  '<label>Gym badges<select name="badgeCount">'+choices(['0','1','2','3','4','5','6','7','8'],String(p.badgeCount))+'</select></label>'+
  '<label class="wide">Trainer motto<textarea maxlength="180" rows="3" name="quote">'+esc(p.quote)+'</textarea></label>'+
  '</div><button class="btn primary" type="submit" style="margin-top:16px">Save Trainer Card</button> <span id="trainer-feedback" class="trainer-helper" role="status"></span></form></section>';
  root.innerHTML='<section class="hero"><div class="eyebrow">TRAINER IDENTITY</div><h2>Your Trainer Card</h2><p>Choose your colours, show off your partner, and build your identity in the Santara League.</p></section>'+
  '<div class="trainer-shell"><div id="trainer-live-preview">'+formatCard(p)+'</div>'+editor+'</div>'+
  '<section style="margin-top:30px"><h2 class="trainer-title">Trainer Roster</h2><p class="trainer-helper">Cards shared by other approved Trainers.</p><div class="trainer-roster">'+(roster.length?roster.map(card=>formatCard(card,true)).join(''):'<p class="trainer-helper">Nobody has published a Trainer Card yet.</p>')+'</div></section>';
  const form=root.querySelector('#trainer-profile-form');
  const redraw=()=>{
    const fd=new FormData(form);
    const preview={...p};
    for(const k of ['trainerName','trainerClass','hometown','partnerPokemon','favoriteType','theme','avatar','quote','badgeCount'])preview[k]=fd.get(k)||'';
    root.querySelector('#trainer-live-preview').innerHTML=formatCard(preview);
  };
  form.addEventListener('input',redraw);
  form.addEventListener('change',redraw);
  form.addEventListener('submit',e=>{e.preventDefault();saveTrainer(form)});
 }
};
if(!bridge||bridge.mode!=='player'){gate('Configuration error','<p>Player journal bridge is missing.</p>')}
else if(!configured){gate('Firebase is not configured','<p>Ask your GM to configure Firebase before signing in.</p>')}
else{
 try{
  app=initializeApp(config);
  store=getFirestore(app);auth=getAuth(app);
  onAuthStateChanged(auth,user=>{checkAccount(user).catch(e=>gate('Access error','<p>'+esc(e.message)+'</p>'))},
    e=>gate('Authentication error','<p>'+esc(e.message)+'</p>'));
 }catch(e){gate('Startup error','<p>'+esc(e.message)+'</p>')}
}
