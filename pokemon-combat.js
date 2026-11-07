import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,collection,doc,query,where,onSnapshot,setDoc,deleteDoc,writeBatch,serverTimestamp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {initialUnlocks,effectivePokemon} from './pokemon-gimmicks.js';
import {applyMegaOverlays} from './pokemon-mega-assignments.js';
import {STAGE_KEYS,CONDITIONS,TRIGGERS,EFFECT_KINDS,RECIPIENTS,DEFAULT_PROFILES,blankCombatState,normalizeProfile,combatProfileKey,resolveProfile,statusAfterEffects,advanceCombatTurn,actionSlug} from './pokemon-action-automation.js';

const GM_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1',GM_SITE=window.SANTARA_POKEMON_EDITION==='gm';
const root=document.getElementById('combat-root'),feedback=document.getElementById('combat-feedback'),chip=document.getElementById('combat-user');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={attack:'Attack',defense:'Defense',specialAttack:'Sp. Attack',specialDefense:'Sp. Defense',speed:'Speed',accuracy:'Accuracy',evasion:'Evasion'};
const title=v=>String(v||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const opt=(value,label,selected)=>'<option value="'+esc(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+esc(label)+'</option>';
const select=(list,selected)=>list.map(x=>opt(x[0],x[1],selected)).join('');
const field=(label,name,value,extra='')=>'<label class="field">'+esc(label)+'<input name="'+name+'" value="'+esc(value??'')+'" '+extra+'></label>';
let app,auth,store,user=null,allowed=false,connected=false,role=false,approved=false;
let stopAuth=null,stopRole=null,stopApproval=null,subs=[];
let raw=[],megaAssignments={},roster=[],combat={},profiles=[],unlocks={},playerUnlocks=initialUnlocks();
const queryId=new URLSearchParams(window.location.search).get('actor')||'';
const view={actorId:queryId,targetId:'',kind:'move',name:'',editing:false,editingName:'',editingKind:'move',notice:'',busy:false};
const say=msg=>{feedback.textContent=msg||''};
function clearSubscriptions(){
 for(const stop of subs)stop?.();subs=[];
 stopRole?.();stopApproval?.();stopRole=stopApproval=null;
 allowed=false;connected=false;approved=false;role=false;raw=[];roster=[];megaAssignments={};combat={};profiles=[];unlocks={};
}
function loginScreen(message){
 root.innerHTML='<section class="panel"><h2>'+esc(message)+'</h2><p>Use your existing approved Pokémon account. The calculator and Trainer ID are not required.</p><div class="actions"><a class="btn primary" href="./index.html">Sign in to Fieldwork</a><a class="btn" href="./account-access.html">Check account access</a></div></section>';
}
function authorize(){
 const granted=user?.uid===GM_UID||role||(!GM_SITE&&approved);
 if(granted&&!connected){connected=true;allowed=true;connect();return}
 if(!granted&&connected){for(const stop of subs)stop?.();subs=[];connected=false}
 allowed=granted;
 if(!granted)loginScreen(GM_SITE?'GM access required':'Trainer access required');
}
function onUser(next){
 clearSubscriptions();user=next;chip.textContent=next?.email||'Not signed in';say('');
 if(!next){loginScreen('Sign in to use battle automation');return}
 if(!next.emailVerified&&next.uid!==GM_UID){loginScreen('Verify your email first');return}
 if(next.uid===GM_UID){allowed=true;connected=true;connect();return}
 stopRole=onSnapshot(doc(store,'santara_gm_accounts',next.uid),snap=>{
  const data=snap.exists()?snap.data():null;
  role=data?.enabled===true&&data.email===next.email;
  authorize();
 },err=>{role=false;authorize();say('GM role check: '+err.message)});
 if(!GM_SITE){
  stopApproval=onSnapshot(doc(store,'santara_player_access',next.uid),snap=>{
   approved=snap.exists()&&snap.data().enabled===true;authorize();
  },err=>{approved=false;authorize();say('Trainer access: '+err.message)});
 }
}
function listen(ref,callback,label){
 subs.push(onSnapshot(ref,callback,err=>say(label+': '+err.message)));
}
function connect(){
 root.innerHTML='<section class="panel">Loading Pokémon and automation profiles…</section>';
 const own=path=>GM_SITE?collection(store,path):query(collection(store,path),where('ownerUid','==',user.uid));
 listen(own('santara_pokemon'),snap=>{
  raw=snap.docs.map(d=>({id:d.id,...d.data()}));
  refreshRoster();
 },'Pokémon roster');
 listen(own('santara_pokemon_mega_assignments'),snap=>{
  megaAssignments=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));refreshRoster();
 },'Mega forms');
 listen(own('santara_combat_state'),snap=>{
  combat=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));
  render();
 },'Live combat states');
 listen(collection(store,'santara_combat_profiles'),snap=>{
  profiles=snap.docs.map(d=>({id:d.id,...d.data()}));
  render();
 },'Action profiles');
 listen(GM_SITE?collection(store,'santara_trainer_gimmicks'):doc(store,'santara_trainer_gimmicks',user.uid),snap=>{
  if(GM_SITE)unlocks=Object.fromEntries(snap.docs.map(d=>[d.id,d.data()]));
  else playerUnlocks=snap.exists()?snap.data():initialUnlocks();
  render();
 },'Gimmick unlocks');
}
function refreshRoster(){
 roster=applyMegaOverlays(raw,megaAssignments).sort((a,b)=>String(a.nickname||a.speciesName).localeCompare(String(b.nickname||b.speciesName)));
 if(view.actorId!=='manual'&&!roster.some(m=>m.id===view.actorId))view.actorId=roster[0]?.id||'';
 if(!roster.some(m=>m.id===view.targetId))view.targetId=view.actorId;
 const actor=currentActor();
 if(actor){
  const display=shown(actor),known=(view.kind==='ability'?[display.ability]:actor.moves||[]).filter(Boolean);
  if(!known.includes(view.name))view.name=known[0]||'';
 }
 render();
}
function currentActor(){return roster.find(m=>m.id===view.actorId)}
function currentTarget(){return roster.find(m=>m.id===view.targetId)}
function shown(m){return effectivePokemon(m,GM_SITE?(unlocks[m.ownerUid]||initialUnlocks()):playerUnlocks)}
function abilityName(m){return shown(m)?.ability||''}
function currentProfile(){return resolveProfile(view.kind,view.name,profiles)}
function battleState(m){return combat[m.id]||blankCombatState(m.ownerUid)}
function readable(m){return (m.nickname||m.speciesName||'Pokémon')+' · Lv '+(m.level||'?')+(GM_SITE?' · '+String(m.ownerUid||'').slice(0,7):'')}
function art(m){
 const p=shown(m),src=String(p.spriteData||''),link=String(p.spriteUrl||'');
 const url=src.startsWith('data:image/webp;base64,')&&src.length<=150000?src:link.startsWith('https://')?link:'';
 return url?'<img src="'+esc(url)+'" alt="" loading="lazy">':'<span class="art-empty">◇</span>';
}
function stateHtml(m){
 if(!m)return '<p class="hint">No Pokémon selected.</p>';
 const st=battleState(m);
 return '<p class="combat-note">Turn <b>'+st.turn+'</b> · HP '+m.currentHp+'/'+m.maxHp+' · '+esc(m.status||'None')+'</p>'+
 '<div class="combat-stage-grid">'+STAGE_KEYS.map(k=>'<div><b>'+((st.stages?.[k]||0)>0?'+':'')+Number(st.stages?.[k]||0)+'</b><small>'+names[k]+'</small></div>').join('')+'</div>'+
 (st.moveRecords?.length?'<div class="combat-tables">'+st.moveRecords.slice(-5).map(r=>
  '<div class="combat-record"><span>'+esc(r.key)+'</span><span>'+Number(r.uses||0)+' uses · ready turn '+Number(r.nextTurn||1)+'</span></div>').join('')+'</div>':'<p class="hint">No tracked move uses yet.</p>');
}
function actionOptions(actor){
 return (view.kind==='move'?(actor.moves||[]):[abilityName(actor)]).filter(Boolean).map(n=>[n,n]);
}
function effectSummary(p){
 if(!p)return '<p class="combat-warning">No automation profile exists for this action. The GM can create one; no effect will be guessed from a move name or description.</p>';
 const effectNames=p.effects.map(e=>{
  const target=e.recipient==='self'?'user':'chosen target';
  const effect=e.kind==='status'?'status → '+e.status:e.kind==='stage'?names[e.stat]+' '+(e.amount>=0?'+':'')+e.amount+' stages':e.kind==='heal'?'heal '+e.amount+' HP':'lose '+e.amount+' fixed HP';
  return '<li>'+esc(target+' · '+effect+' · '+e.chance+'% chance')+'</li>';
 });
 return '<p class="combat-profile-meta">Trigger: '+esc(title(p.trigger))+' · Priority '+p.priority+' · Grid range '+p.range+' squares · Cooldown '+p.cooldown+' turn(s) · '+(p.maxUses?'Max '+p.maxUses+' uses':'Unlimited uses')+'</p>'+
 (effectNames.length?'<ul>'+effectNames.join('')+'</ul>':'<p class="hint">Tracks usage/cooldown without modifying HP or status.</p>');
}
function effectRow(e,i){
 const obj=e||{kind:'status',recipient:'target',chance:100,amount:0,status:'Paralyzed',stat:'attack'};
 const kinds=[['status','Set status'],['heal','Heal fixed HP'],['fixed_damage','Fixed HP loss (not damage roll)'],['stage','Modify stat stage']];
 return '<div class="combat-effect"><label class="field">Effect '+(i+1)+'<select name="effect'+i+'kind">'+select(kinds,obj.kind)+'</select></label>'+
 '<label class="field">Recipient<select name="effect'+i+'recipient">'+select(RECIPIENTS.map(x=>[x,title(x)]),obj.recipient)+'</select></label>'+
 field('Chance (%)','effect'+i+'chance',obj.chance,'type="number" min="1" max="100"')+
 field('Amount / stages','effect'+i+'amount',obj.amount,'type="number" min="-3000" max="3000"')+
 '<label class="field">Status<select name="effect'+i+'status">'+select(CONDITIONS.map(x=>[x,x]),obj.status)+'</select></label>'+
 '<label class="field">Stage stat<select name="effect'+i+'stat">'+select(STAGE_KEYS.map(k=>[k,names[k]]),obj.stat)+'</select></label></div>';
}
function profileEditor(){
 if(!GM_SITE||!view.editing)return '';
 const known=currentProfile();
 const active=known&&known.kind===view.kind&&known.name===view.name?known:null;
 const p=active||{name:view.name||'',kind:view.kind,trigger:view.kind==='move'?'manual':'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[]};
 const rows=Array.from({length:4},(_,i)=>effectRow(p.effects[i],i));
 return '<section class="panel combat-editor"><div class="toolbar"><h3>GM: Configure automation profile</h3><button class="btn" type="button" data-act="cancel-edit">Close editor</button></div>'+
 '<p class="combat-note">These profiles work for official and custom moves/abilities. Custom moves still keep their existing descriptions and dice; this editor only defines automatic battle effects.</p>'+
 '<form id="profile-form" class="form-grid">'+
 field('Action name','name',p.name,'maxlength="48" required')+
 '<label class="field">Kind<select name="kind">'+select([['move','Move'],['ability','Ability']],p.kind)+'</select></label>'+
 '<label class="field">Trigger<select name="trigger">'+select(TRIGGERS.map(x=>[x,title(x)]),p.trigger)+'</select></label>'+
 '<label class="field">Target category<select name="target">'+select([['self','Self'],['ally','Ally'],['opponent','Opponent']],p.target)+'</select></label>'+
 field('Priority','priority',p.priority,'type="number" min="-7" max="7"')+
 field('Grid range (squares)','range',p.range,'type="number" min="0" max="30"')+
 field('Cooldown (turns)','cooldown',p.cooldown,'type="number" min="0" max="10"')+
 field('Max uses (0 = unlimited)','maxUses',p.maxUses,'type="number" min="0" max="40"')+
 '<p class="hint full">Unused effect rows should be set to “None” using the checkbox below.</p>'+
 rows.map((row,i)=>'<div class="full">'+
 '<label class="combat-checkbox"><input type="checkbox" name="effect'+i+'enabled"'+(i<p.effects.length?' checked':'')+'> Enable effect '+(i+1)+'</label>'+row+'</div>').join('')+
 '<div class="actions full"><button class="btn primary" type="submit">Save automation profile</button>'+
 (profiles.some(x=>x.kind===p.kind&&x.name?.toLowerCase()===p.name.toLowerCase())?'<button class="btn danger" type="button" data-act="delete-profile">Delete saved override</button>':'')+'</div></form></section>';
}
function render(){
 if(!allowed)return;
 if(!roster.length){root.innerHTML='<section class="panel"><h2>No Pokémon available</h2><p>Register Pokémon in My Pokémon first; this automation tool uses the existing roster.</p><a class="btn" href="./pokemon-party.html">Open Pokémon Manager</a></section>';return}
 const actor=currentActor(),target=currentTarget()||actor,profile=currentProfile();
 const moves=actionOptions(actor),record=battleState(actor).moveRecords.find(r=>r.key===(profile?combatProfileKey(profile):''));
 const used=record?.uses||0,next=record?.nextTurn||1,turn=battleState(actor).turn;
 const locked=Boolean(profile&&(profile.kind==='move'&&profile.maxUses&&used>=profile.maxUses||turn<next));
 const enemyNotAllowed=!GM_SITE&&profile?.target==='opponent';
 const targetMon=profile?.target==='self'?actor:target;
 root.innerHTML='<section class="combat-grid"><div class="panel">'+
 '<h2>Choose Pokémon &amp; action</h2>'+
 '<label class="field">Acting Pokémon<select id="actor-id">'+select(roster.map(m=>[m.id,readable(m)]),view.actorId)+'</select></label>'+
 '<div class="combat-unit">'+art(actor)+'<div><strong>'+esc(shown(actor).displayName||actor.speciesName)+'</strong><p>Ability: '+esc(abilityName(actor)||'None')+' · Held: '+esc(actor.heldItem||'None')+'</p><p>HP '+actor.currentHp+'/'+actor.maxHp+'</p></div></div>'+
 '<label class="field">Action kind<select id="kind">'+select([['move','Move'],['ability','Ability trigger']],view.kind)+'</select></label>'+
 '<label class="field">'+(view.kind==='move'?'Known move':'Current ability')+'<select id="action-name">'+select(moves,view.name)+'</select></label>'+
 (view.kind==='ability'&&profile?'<p class="combat-note">Trigger event: '+esc(title(profile.trigger))+'. Apply it when that event occurs; the app does not infer an event from dialogue.</p>':'')+
 (profile?.target!=='self'?'<label class="field">Effect target<select id="target-id">'+select(roster.map(m=>[m.id,readable(m)]),view.targetId)+'</select></label>':'<p class="hint">This action targets the user.</p>')+
 '<div class="combat-result"><h3>Automation preview</h3>'+
 (profile?'<span class="combat-badge">'+(profiles.some(x=>x.kind===profile.kind&&x.name===profile.name)?'GM-configured':'Built-in template')+'</span>':'')+
 effectSummary(profile)+
 (locked?'<p class="combat-warning">Unavailable: '+(used>=profile?.maxUses&&profile?.maxUses?'uses exhausted':'cooldown until turn '+next)+'</p>':'')+
 (enemyNotAllowed?'<p class="combat-warning">Enemy-target effects must be applied by the GM. Players can automate effects on their own Pokémon only.</p>':'')+
 '<div class="combat-toolbar">'+(profile?'<button class="btn primary" data-act="apply" '+(locked||enemyNotAllowed||view.busy?'disabled':'')+' type="button">Apply action effects</button>':'<button class="btn" disabled>No configured effects</button>')+
 (GM_SITE?'<button class="btn" data-act="configure" type="button">Configure action</button>':'')+'</div></div>'+
 '<p class="combat-note">Move damage, accuracy rolls, target distance and situational immunities remain GM adjudications. Only listed status, HP and stage effects are automated.</p>'+
 '</div><div class="panel"><div class="toolbar"><h2>Battle state</h2><div class="combat-toolbar"><button class="btn" data-act="next-turn" type="button">Next turn</button><button class="btn" data-act="reset-state" type="button">Reset stages/uses</button></div></div>'+
 '<h3>'+esc(actor.nickname||actor.speciesName)+' (actor)</h3>'+stateHtml(actor)+
 (targetMon?.id!==actor.id?'<h3>'+esc(targetMon.nickname||targetMon.speciesName)+' (target)</h3>'+stateHtml(targetMon):'')+
 '</div></section>'+profileEditor();
}
function choose(id){
 if(id==='actor-id'){
  const actor=currentActor();view.name=(view.kind==='move'?actor?.moves?.[0]:abilityName(actor))||'';
  view.targetId=actor?.id||'';view.editing=false;
 }
 if(id==='kind'){
  const actor=currentActor();view.name=(view.kind==='move'?actor?.moves?.[0]:abilityName(actor))||'';
  view.editing=false;
 }
 render();
}
async function apply(){
 if(view.busy)throw Error('An action is already saving.');
 const actor=currentActor(),p=currentProfile();
 if(!actor||!p)throw Error('Choose an action with a profile.');
 if(view.kind==='move'&&!(actor.moves||[]).some(x=>x.toLowerCase()===view.name.toLowerCase()))throw Error('Move is not assigned to this Pokémon.');
 if(view.kind==='ability'&&abilityName(actor).toLowerCase()!==view.name.toLowerCase())throw Error('Only the Pokémon’s current ability can trigger.');
 if(!GM_SITE&&p.target==='opponent')throw Error('Enemy effects require GM approval.');
 const target=p.target==='self'?actor:currentTarget();
 if(!target)throw Error('Choose the effect target.');
 if(!GM_SITE&&(target.ownerUid!==user.uid||actor.ownerUid!==user.uid))throw Error('Only the GM may edit another trainer’s Pokémon.');
 if(!confirm('Apply '+p.name+' ('+title(p.trigger)+') to '+(target.nickname||target.speciesName)+'? This will save HP, status and stage changes.'))return;
 const result=statusAfterEffects({actor,target,actorState:battleState(actor),targetState:battleState(target),profile:p});
 const batch=writeBatch(store);
 const stateData=(mon,st)=>({
  ownerUid:mon.ownerUid,turn:st.turn,stages:st.stages,moveRecords:st.moveRecords,updatedAt:serverTimestamp()
 });
 batch.set(doc(store,'santara_combat_state',actor.id),stateData(actor,result.actorState));
 if(target.id!==actor.id&&result.steps.some(x=>x.applied&&x.description.includes('stage '))){
  batch.set(doc(store,'santara_combat_state',target.id),stateData(target,result.targetState));
 }
 for(const [mon,next] of target.id===actor.id?[[actor,result.actor]]:[[actor,result.actor],[target,result.target]]){
  const patch={};
  if(Number(next.currentHp)!==Number(mon.currentHp))patch.currentHp=next.currentHp;
  if(next.status!==mon.status)patch.status=next.status;
  if(Object.keys(patch).length){
   patch.updatedAt=serverTimestamp();
   batch.update(doc(store,'santara_pokemon',mon.id),patch);
  }
 }
 view.busy=true;
 try{
  await batch.commit();
  say(p.name+' applied · '+result.steps.map(x=>x.description).join(' | ')+(result.steps.length?'':' · Usage recorded.'));
 }catch(e){
  if(e?.code==='permission-denied')throw Error('Firebase denied this action. Publish the new GM Firestore rules (combat profiles/state and narrow HP/status updates). '+e.message);
  throw e;
 }finally{view.busy=false}
}
async function nextTurn(){
 const actor=currentActor();
 if(!actor)throw Error('Select a Pokémon.');
 const current=battleState(actor),next=advanceCombatTurn(current);
 await setDoc(doc(store,'santara_combat_state',actor.id),{
  ownerUid:actor.ownerUid,turn:next.turn,stages:next.stages,moveRecords:next.moveRecords,updatedAt:serverTimestamp()
 });
 say('Turn advanced to '+next.turn+'. Ability triggers such as Speed Boost can now be applied with the Ability action.');
}
async function resetState(){
 const actor=currentActor();if(!actor)throw Error('Select a Pokémon.');
 if(!confirm('Reset '+(actor.nickname||actor.speciesName)+' stat stages, move uses and turn counter? HP and status will NOT reset.'))return;
 await deleteDoc(doc(store,'santara_combat_state',actor.id));
 say('Stat stages, use counts and turn counter reset. HP and status are unchanged.');
}
function captureProfile(form){
 const fd=new FormData(form);
 const prof={
  name:String(fd.get('name')||'').trim(),kind:String(fd.get('kind')||'move'),
  trigger:String(fd.get('trigger')||'manual'),target:String(fd.get('target')||'self'),
  priority:Number(fd.get('priority')),range:Number(fd.get('range')),
  cooldown:Number(fd.get('cooldown')),maxUses:Number(fd.get('maxUses')),effects:[]
 };
 for(let i=0;i<4;i++){
  if(fd.get('effect'+i+'enabled')!=='on')continue;
  prof.effects.push({
   kind:String(fd.get('effect'+i+'kind')||'status'),
   recipient:String(fd.get('effect'+i+'recipient')||'target'),
   chance:Number(fd.get('effect'+i+'chance')),amount:Number(fd.get('effect'+i+'amount')),
   status:String(fd.get('effect'+i+'status')||'None'),stat:String(fd.get('effect'+i+'stat')||'attack')
  });
 }
 return normalizeProfile(prof);
}
async function saveProfile(form){
 if(!GM_SITE)throw Error('Only GMs can define actions.');
 const p=captureProfile(form);
 if(p.kind!==view.kind||actionSlug(p.name)!==actionSlug(view.name))throw Error('To define a different move/ability, select it on the Pokémon sheet first.');
 const id=combatProfileKey(p);
 await setDoc(doc(store,'santara_combat_profiles',id),{...p,updatedAt:serverTimestamp()});
 view.editing=false;say('Automation profile for '+p.name+' saved.');render();
}
async function deleteProfile(){
 if(!GM_SITE)throw Error('GM access required.');
 const p=currentProfile();if(!p||!profiles.some(x=>x.id===combatProfileKey(p)))return;
 if(!confirm('Delete the saved automation override for '+p.name+'? A built-in default, if available, will be used again.'))return;
 await deleteDoc(doc(store,'santara_combat_profiles',combatProfileKey(p)));
 view.editing=false;say('Saved profile deleted.');render();
}
root.addEventListener('change',e=>{
 if(e.target.id==='actor-id'){view.actorId=e.target.value;choose('actor-id')}
 if(e.target.id==='kind'){view.kind=e.target.value;choose('kind')}
 if(e.target.id==='action-name'){view.name=e.target.value;view.editing=false;render()}
 if(e.target.id==='target-id'){view.targetId=e.target.value;render()}
});
root.addEventListener('submit',async e=>{
 if(e.target.id!=='profile-form')return;
 e.preventDefault();
 try{await saveProfile(e.target)}catch(err){say('Unable to save profile: '+(err.message||err))}
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('[data-act]');if(!b)return;
 if(view.busy)return;
 const action=b.dataset.act;
 try{
  b.disabled=true;
  if(action==='apply')await apply();
  if(action==='next-turn')await nextTurn();
  if(action==='reset-state')await resetState();
  if(action==='configure'){view.editing=true;render()}
  if(action==='cancel-edit'){view.editing=false;render()}
  if(action==='delete-profile')await deleteProfile();
 }catch(err){say('Action failed: '+(err.message||err))}
 finally{if(b.isConnected)b.disabled=false}
});
try{
 if(!window.SANTARA_FIREBASE_CONFIG?.projectId)throw Error('Firebase configuration is not available.');
 app=getApps().length?getApp():initializeApp(window.SANTARA_FIREBASE_CONFIG);
 auth=getAuth(app);store=getFirestore(app);
 stopAuth=onAuthStateChanged(auth,onUser,err=>say('Authentication failed: '+err.message));
}catch(err){say('Setup failed: '+(err.message||err));loginScreen('Firebase setup needed')}
