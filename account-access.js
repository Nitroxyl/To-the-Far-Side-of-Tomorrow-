import {initializeApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider,signOut,reload,getIdToken,sendEmailVerification} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,doc,collection,onSnapshot,setDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';

const ROOT_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const content=document.getElementById('account-content'),feedback=document.getElementById('account-feedback');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const config=window.SANTARA_FIREBASE_CONFIG;
let auth,db,user=null,access=null,request=null,gmRecord=null,requests=[],admins=[],unsubs=[];
const say=s=>{feedback.textContent=s||''};
function stop(){unsubs.forEach(f=>f?.());unsubs=[];access=request=gmRecord=null;requests=[];admins=[]}
function authorizedGm(){return user?.uid===ROOT_UID||Boolean(user?.emailVerified&&gmRecord?.enabled===true&&gmRecord?.email===user.email)}
function rootGm(){return user?.uid===ROOT_UID}
function login(){
 content.innerHTML='<section class="panel"><h2>Sign in with your existing account</h2><p>No new registration is necessary. Signing in will reveal the Firebase UID tied to this login.</p>'+
 '<form id="identity-login" class="form-grid"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label>'+
 '<label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label>'+
 '<div class="actions"><button class="btn primary" type="submit">Sign in</button><button type="button" class="btn" data-act="google">Sign in with Google</button></div></form></section>';
}
function adminArea(){
 if(!rootGm())return '';
 const pending=requests.filter(x=>!admins.some(a=>a.uid===x.uid&&a.enabled));
 return '<section class="panel"><h2>Root GM — Account approvals</h2><p>Only the founding GM identity can grant GM permissions. A candidate must first sign in with their existing email, verify it, and create an access request. This binds their email to their Firebase UID.</p>'+
 '<h3>Account requests</h3>'+(pending.length?pending.map(r=>'<div class="entry"><b>'+esc(r.email)+'</b><p class="hint">UID: <code>'+esc(r.uid)+'</code></p>'+
 '<div class="actions"><button class="btn" data-act="approve" data-uid="'+esc(r.uid)+'">Approve Trainer</button>'+
 '<button class="btn primary" data-act="grant" data-uid="'+esc(r.uid)+'">Grant GM access</button></div></div>').join(''):'<p class="hint">No unassigned access requests.</p>')+
 '<h3>Additional GM accounts</h3>'+(admins.length?admins.map(a=>'<div class="entry"><b>'+esc(a.email)+'</b> <span class="hint">'+(a.enabled?'Enabled':'Disabled')+'</span><p class="hint">UID: <code>'+esc(a.uid)+'</code></p>'+
 '<button class="btn danger small" data-act="revoke" data-uid="'+esc(a.uid)+'">Revoke GM access</button></div>').join(''):'<p class="hint">No additional GM accounts registered.</p>')+'</section>';
}
function render(){
 if(!user){login();return}
 const verified=user.emailVerified||rootGm();
 const isGm=authorizedGm();
 content.innerHTML='<section class="panel"><div class="toolbar"><h2>Current Firebase identity</h2><button class="btn" data-act="logout">Sign out</button></div>'+
 '<p>Email: <b>'+esc(user.email||'No email linked')+'</b></p>'+
 '<p>Account UID: <code id="account-uid">'+esc(user.uid)+'</code> <button class="btn small" data-act="copy">Copy UID</button></p>'+
 '<p>Email verification: <b>'+(user.emailVerified?'Verified':'Not verified')+'</b> · Trainer access: <b>'+(isGm?'GM override':access?.enabled?'Approved':'Not approved')+
 '</b> · GM privileges: <b>'+(isGm?(rootGm()?'Founding GM':'Delegated GM'):'Not granted')+'</b></p>'+
 (!verified?'<p>You must verify your existing email before requesting Trainer or GM access.</p><div class="actions"><button class="btn primary" data-act="verify">I have verified my email</button><button class="btn" data-act="resend">Resend verification email</button></div>':
 !isGm&&!access?.enabled?'<p>Your existing account can request Trainer approval without being recreated. To receive GM privileges, the founding GM must approve this same UID.</p><button class="btn primary" data-act="request" '+(request?'disabled':'')+'>'+(request?'Access request submitted':'Request access with this account')+'</button>':
 '<p>Your existing account can access the Pokémon collection using its current UID. You can keep using this login.</p>')+
 (verified&&!isGm&&access?.enabled&&!request?'<div class="actions"><button class="btn" data-act="request">Register UID for optional GM access</button></div>':'')+
 '<div class="actions"><a class="btn" href="./pokemon-party.html">Open Pokémon Manager</a><a class="btn" href="./index.html">Open Fieldwork</a></div></section>'+adminArea();
}
function listenCurrent(){
 const uid=user.uid;
 if(!user.emailVerified&&!rootGm()){render();return}
 for(const [path,cb] of [
  ['santara_player_access',data=>{access=data;render()}],
  ['santara_access_requests',data=>{request=data;render()}],
  ['santara_gm_accounts',data=>{gmRecord=data;render()}]
 ]){
  unsubs.push(onSnapshot(doc(db,path,uid),snap=>cb(snap.exists()?snap.data():null),
   err=>say('Could not read '+path+': '+err.message)));
 }
 if(rootGm()){
  unsubs.push(onSnapshot(collection(db,'santara_access_requests'),snap=>{
   requests=snap.docs.map(d=>({uid:d.id,...d.data()}));render();
  },err=>say('Could not list requests: '+err.message)));
  unsubs.push(onSnapshot(collection(db,'santara_gm_accounts'),snap=>{
   admins=snap.docs.map(d=>({uid:d.id,...d.data()}));render();
  },err=>say('Could not list GM accounts: '+err.message)));
 }
 render();
}
async function action(act,uid){
 if(act==='google'){await signInWithPopup(auth,new GoogleAuthProvider());return}
 if(act==='logout'){await signOut(auth);return}
 if(!user)throw Error('Sign in first.');
 if(act==='copy'){
  if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(user.uid);
  else throw Error('Clipboard unavailable. Select and copy your UID above.');
  say('Account UID copied.');return;
 }
 if(act==='verify'){await reload(user);await getIdToken(user,true);user=auth.currentUser;stop();listenCurrent();return}
 if(act==='resend'){await sendEmailVerification(user);say('Check your existing email for its verification link.');return}
 if(act==='request'){
  if(!user.emailVerified)throw Error('Verify your email first.');
  await setDoc(doc(db,'santara_access_requests',user.uid),{email:user.email,createdAt:serverTimestamp()});
  say('Your existing account UID has been submitted to the founding GM.');return;
 }
 if(['approve','grant','revoke'].includes(act)){
  if(!rootGm())throw Error('Only the founding GM can manage privileged accounts.');
  const r=requests.find(x=>x.uid===uid);
  if(act!=='revoke'&&!r)throw Error('The account must submit a verified access request first.');
  if(act==='approve'){
   await setDoc(doc(db,'santara_player_access',uid),{email:r.email,enabled:true,approvedAt:serverTimestamp()});
   say('Trainer access approved for '+r.email+'.');return;
  }
  if(act==='grant'){
   if(!confirm('Grant full GM permissions to '+r.email+'? The account will be able to edit or publish campaign records.'))return;
   await setDoc(doc(db,'santara_gm_accounts',uid),{email:r.email,enabled:true,grantedAt:serverTimestamp()});
   say('GM role granted to '+r.email+'.');return;
  }
  const record=admins.find(x=>x.uid===uid);
  if(!record||!confirm('Revoke GM access for '+record.email+'?'))return;
  await deleteDoc(doc(db,'santara_gm_accounts',uid));
  say('GM role revoked.');return;
 }
 throw Error('Unknown action.');
}
content.addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b)return;
 try{b.disabled=true;await action(b.dataset.act,b.dataset.uid); }catch(err){say(err.message||String(err))}finally{if(b.isConnected)b.disabled=false}
});
content.addEventListener('submit',async e=>{
 if(e.target.id!=='identity-login')return;
 e.preventDefault();const f=new FormData(e.target);
 try{await signInWithEmailAndPassword(auth,String(f.get('email')||'').trim(),String(f.get('password')||''))}
 catch(err){say(err.message||String(err))}
});
try{
 if(!config?.projectId)throw Error('Firebase configuration missing.');
 const app=initializeApp(config);auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,u=>{stop();user=u;listenCurrent()},err=>say(err.message));
}catch(err){say('Firebase initialization failed: '+err.message);login()}
