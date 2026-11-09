import {initializeApp,getApps,getApp} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js';
import {getAuth,onAuthStateChanged,signInWithEmailAndPassword,signInWithPopup,GoogleAuthProvider} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js';
import {getFirestore,doc,collection,query,where,onSnapshot,getDoc,addDoc,runTransaction,serverTimestamp,updateDoc} from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js';
import {ITEM_CATEGORIES,MAX_BAG_ENTRIES,bagItems,itemDefinition,adjustBag,teachMove,tmUsable,moveId} from './santara-inventory-core.js?v=bag-tm-20261109-1';
import {officialFamilyMoveCatalog,fetchPokeApi,legalMove,customMoveScope} from './pokemon-forms-learnsets.js?v=historical-learnsets-20261109-1';
import {mergeMoveMemory,memoryKey} from './pokemon-move-memory.js?v=move-memory-20261109-1';

const ROOT_UID='ctBLgrVgkLOzUJYTyYgU9IwejYx1';
const GM=window.SANTARA_POKEMON_EDITION==='gm';
const root=document.getElementById('inventory-root'),feedback=document.getElementById('feedback'),chip=document.getElementById('user-chip');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'" :'&#39;'}[c]));
const option=(v,n,selected)=>'<option value="'+esc(v)+'"'+(String(v)===String(selected)?' selected':'')+'>'+esc(n)+'</option>';
const cap=(v,n)=>String(v||'').trim().slice(0,n);
const TYPES={ball:'Poké Balls',medicine:'Medicine',battle:'Battle items',material:'Materials',key:'Key items',evolution:'Evolution items',tm:'Technical Machines',misc:'Miscellaneous'};
const pokemonLabel=mon=>(mon.nickname||mon.speciesName||'Pokémon')+' · Lv '+(mon.level||'?');
let auth,db,user=null,approved=false,owner='',items={},pokemon=[],requests=[],trainers=[],cards=[],customMoves=[];
let activeCategory='all',activeTM='',targetPokemon='',busy=false,unsubBag=null,unsubPokemon=null,unsubRequests=null,unsubTrainers=null,unsubCards=null,unsubMoves=null;
const learnCache=new Map();
function status(message,fail=false){feedback.textContent=message||'';feedback.style.color=fail?'#ffb0ac':'var(--gold)'}
function error(err){status(err?.message||String(err),true)}
function stopListener(fn){if(typeof fn==='function')fn()}
function stopAll(){
 for(const fn of [unsubBag,unsubPokemon,unsubRequests,unsubTrainers,unsubCards,unsubMoves])stopListener(fn);
 unsubBag=unsubPokemon=unsubRequests=unsubTrainers=unsubCards=unsubMoves=null;
 items={};pokemon=[];requests=[];trainers=[];cards=[];customMoves=[];learnCache.clear();
}
function labelFor(uid){
 if(uid===user?.uid&&GM)return 'My GM bag';
 const card=cards.find(c=>c.uid===uid),trainer=trainers.find(t=>t.uid===uid);
 return cap(card?.trainerName,32)||cap(trainer?.email,40)||'Trainer #'+String(uid).slice(0,8);
}
function signInUI(message){
 root.innerHTML='<section class="panel"><h2>'+esc(message)+'</h2><p>Use the same Firebase account as your Pokémon collection.</p>'+
  '<form id="bag-login" class="form-grid"><label class="field">Email<input name="email" type="email" autocomplete="email" required></label>'+
  '<label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label>'+
  '<div class="actions"><button class="btn primary" type="submit">Sign in</button><button class="btn" data-action="google-login" type="button">Google sign-in</button></div></form></section>';
}
function itemCard(item){
 const quantity=Number(item.quantity)||0;
 const badge=TYPES[item.category]||'Miscellaneous';
 const actions=GM
  ?'<div class="actions"><button class="btn small" data-action="adjust" data-id="'+esc(item.id)+'" data-delta="1">+1</button>'+
    '<button class="btn small" data-action="adjust" data-id="'+esc(item.id)+'" data-delta="-1">−1</button>'+
    '<button class="btn small danger" data-action="remove-all" data-id="'+esc(item.id)+'">Remove</button>'+
    (tmUsable(item)?'<button class="btn small primary" data-action="choose-tm" data-id="'+esc(item.id)+'">Teach TM</button>':'')+'</div>'
  :tmUsable(item)?'<div class="actions"><button class="btn small primary" data-action="choose-tm" data-id="'+esc(item.id)+'">Request TM use</button></div>':'';
 return '<article class="bag-item"><div class="bag-head"><div class="bag-name">'+esc(item.name)+'</div>'+
  '<span class="bag-number">× '+quantity+'</span></div>'+
  '<span class="bag-kind">'+esc(badge)+'</span>'+
  (item.description?'<p class="bag-desc">'+esc(item.description)+'</p>':'')+
  (item.category==='tm'?'<p class="bag-desc"><b>Teaches:</b> '+esc(item.moveName)+'</p>':'')+actions+'</article>';
}
function inventoryStats(){
 const values=Object.values(items),all=values.reduce((n,i)=>n+(Number(i.quantity)||0),0);
 const tm=values.filter(x=>x.category==='tm');
 return '<div class="bag-stats"><div class="bag-stat"><strong>'+values.length+'</strong><span>Item varieties</span></div>'+
  '<div class="bag-stat"><strong>'+all+'</strong><span>Total items</span></div>'+
  '<div class="bag-stat"><strong>'+tm.length+'</strong><span>Different TMs</span></div></div>';
}
function grantUI(){
 if(!GM)return '';
 return '<section class="panel"><div class="bag-topline"><h2>Grant items</h2><span class="hint">GM only · changes sync to the selected Trainer</span></div>'+
  '<form id="grant-form" class="form-grid">'+
  '<label class="field">Item category<select name="category" id="grant-category">'+ITEM_CATEGORIES.map(c=>option(c,TYPES[c],'misc')).join('')+'</select></label>'+
  '<label class="field">Quantity to add<input name="quantity" type="number" min="1" max="9999" value="1" required></label>'+
  '<label class="field full">Item name<input name="name" maxlength="75" placeholder="e.g. Potion, Poké Ball, Garchompite"></label>'+
  '<label class="field full" id="tm-move-row" hidden>Move taught by TM<input name="moveName" maxlength="48" placeholder="e.g. Roost or Head Smash"></label>'+
  '<label class="field full">Item notes / use<textarea name="description" maxlength="180" placeholder="Optional tabletop effect, quest use or where it was obtained"></textarea></label>'+
  '<div class="actions"><button class="btn primary" type="submit">Add to Trainer bag</button></div></form>'+
  '<p class="hint">The GM manages quantities. TMs have a move attached and can be consumed through the TM teaching workflow. Ordinary items are tracked manually for now.</p></section>';
}
function tmTeachUI(){
 const tm=items[activeTM];
 if(!tmUsable(tm))return '';
 const mon=pokemon.find(x=>x.id===targetPokemon)||pokemon[0];
 const moveList=(mon?.moves||[]).filter(Boolean);
 const monOptions=pokemon.map(p=>option(p.id,pokemonLabel(p),mon?.id||'')).join('');
 const replacement=option('','Add to an empty move slot', '')+
  moveList.map(m=>option(m,'Forget '+m,'')).join('');
 return '<section class="bag-teach" id="teach-box"><div class="bag-topline"><h3>'+esc(GM?'Teach from TM':'Request TM teaching')+': '+esc(tm.moveName)+'</h3>'+
  '<button class="btn small" data-action="close-teach" type="button">Close</button></div>'+
  '<p class="hint">'+(GM?'The TM and Pokémon move change are saved together.':'The GM will review compatibility, then teach the move and consume one TM on approval.')+'</p>'+
  (pokemon.length?'<form id="teach-form" class="form-grid">'+
   '<label class="field full">Pokémon<select name="pokemonId" id="tm-pokemon">'+monOptions+'</select></label>'+
   '<label class="field full">Move to forget<select name="forgetMove" id="tm-forget">'+replacement+'</select></label>'+
   '<p class="hint full">'+esc(mon?pokemonLabel(mon)+' currently knows: '+(moveList.join(', ')||'no moves'):'')+
    (moveList.length>=4?' · You must choose a move to replace.':' · You may add the TM to an empty slot.')+'</p>'+
   '<div class="actions"><button class="btn primary" type="submit">'+(GM?'Teach and consume 1 TM':'Send teaching request')+'</button></div></form>':
   '<p class="bag-notice">This Trainer has no Pokémon yet. Assign one before teaching a TM.</p>')+'</section>';
}
function requestList(){
 const relevant=(GM?requests.filter(r=>r.status==='pending'):requests).slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
 return '<section class="panel"><h2>'+(GM?'Pending TM teaching requests':'Your TM requests')+'</h2>'+
  '<div class="bag-requests">'+(relevant.length?relevant.map(r=>{
   const mon=pokemon.find(x=>x.id===r.pokemonId);
   return '<article class="bag-request"><div class="bag-head"><strong>'+esc(r.moveName)+'</strong>'+
    '<span class="chip">'+esc(r.status)+'</span></div>'+
    '<p>Trainer: '+esc(GM?labelFor(r.ownerUid):'You')+
    ' · Pokémon: '+esc(mon?pokemonLabel(mon):'ID '+r.pokemonId)+
    ' · '+(r.forgetMove?'Replace '+esc(r.forgetMove):'Add to free slot')+'</p>'+
    (GM?'<div class="actions"><button class="btn small primary" data-action="approve-request" data-id="'+esc(r.id)+'">Approve and teach</button>'+
     '<button class="btn small danger" data-action="reject-request" data-id="'+esc(r.id)+'">Reject</button></div>':'')+
    '</article>';
  }).join(''):'<p class="hint">No '+(GM?'pending':'submitted')+' TM requests.</p>')+'</div></section>';
}
function draw(){
 if(!user||!approved){signInUI(!user?'Sign in to use your Trainer Bag':GM?'GM account required':'Trainer approval required');return}
 const owned=Object.values(items),display=owned.filter(x=>activeCategory==='all'||x.category===activeCategory)
  .sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
 if(activeTM&&!tmUsable(items[activeTM])){activeTM='';targetPokemon=''}
 const trainerSelect=GM?'<label class="field bag-select">Trainer<select id="owner-picker">'+
  [...new Set([user.uid,...trainers.filter(t=>t.enabled).map(t=>t.uid)])].map(uid=>option(uid,labelFor(uid),owner)).join('')+
  '</select></label>':'';
 const categories=['all',...ITEM_CATEGORIES,'requests'];
 const tabs='<div class="bag-filter">'+categories.map(c=>
  '<button class="btn small '+(activeCategory===c?'selected':'')+'" data-action="filter" data-category="'+c+'">'+
  esc(c==='all'?'All items':c==='requests'?'TM requests':TYPES[c])+'</button>').join('')+'</div>';
 root.innerHTML='<div class="bag-topline"><div><h2>'+(GM?esc(labelFor(owner))+' · Inventory':'My Trainer Bag')+'</h2>'+
  '<p class="hint">Items and Pokémon remain separate records. TM consumption is atomic when the GM approves it.</p></div>'+trainerSelect+'</div>'+
  inventoryStats()+tabs+
  (activeCategory==='requests'?requestList():
    '<section class="panel"><div class="bag-topline"><h2>'+esc(activeCategory==='all'?'All items':TYPES[activeCategory])+'</h2>'+
     '<span class="hint">'+display.length+' listed</span></div>'+
     '<div class="bag-grid">'+(display.length?display.map(itemCard).join(''):'<div class="empty">No items in this section yet.</div>')+'</div>'+
     (activeTM?tmTeachUI():'')+'</section>'+grantUI());
}
async function authorize(current){
 if(!current)return false;
 if(GM){
  if(current.uid===ROOT_UID)return true;
  if(!current.emailVerified)return false;
  const docu=await getDoc(doc(db,'santara_gm_accounts',current.uid));
  return docu.exists()&&docu.data().enabled===true&&docu.data().email===current.email;
 }
 if(current.uid===ROOT_UID)return true;
 if(!current.emailVerified)return false;
 const docu=await getDoc(doc(db,'santara_player_access',current.uid));
 return docu.exists()&&docu.data().enabled===true;
}
function watchOwner(){
 stopListener(unsubBag);stopListener(unsubPokemon);
 items={};pokemon=[];activeTM='';targetPokemon='';
 if(!owner)return;
 unsubBag=onSnapshot(doc(db,'santara_trainer_bags',owner),snap=>{
  items=bagItems(snap.exists()?snap.data().items:{});
  draw();
 },e=>{error(Error('Inventory loading failed: '+e.message+'. Publish the Trainer Bag Firestore rules.'));});
 const ref=collection(db,'santara_pokemon');
 unsubPokemon=onSnapshot(query(ref,where('ownerUid','==',owner)),snap=>{
  pokemon=snap.docs.map(d=>({id:d.id,...d.data()}));
  draw();
 },e=>error(Error('Pokémon loading failed: '+e.message)));
 draw();
}
function connect(){
 if(GM){
  unsubTrainers=onSnapshot(collection(db,'santara_player_access'),snap=>{
   trainers=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(t=>t.enabled);
   draw();
  },error);
  unsubCards=onSnapshot(collection(db,'santara_trainer_cards'),snap=>{
   cards=snap.docs.map(d=>({uid:d.id,...d.data()}));draw();
  },error);
 }
 unsubMoves=onSnapshot(collection(db,'santara_custom_moves'),snap=>{
  customMoves=snap.docs.map(d=>({...d.data(),slug:d.id}));
 },e=>console.warn('Custom moves unavailable:',e.message));
 const requestsRef=collection(db,'santara_tm_requests');
 unsubRequests=onSnapshot(GM?requestsRef:query(requestsRef,where('ownerUid','==',user.uid)),snap=>{
  requests=snap.docs.map(d=>({id:d.id,...d.data()}));if(activeCategory==='requests')draw();
 },e=>error(Error('TM requests unavailable: '+e.message)));
 owner=user.uid;watchOwner();
}
async function changeItem(item,delta){
 if(!GM)throw Error('Only the GM can alter item quantities.');
 if(!owner)throw Error('Choose a Trainer first.');
 const ref=doc(db,'santara_trainer_bags',owner);
 await runTransaction(db,async transaction=>{
  const snap=await transaction.get(ref);
  const old=bagItems(snap.exists()?snap.data().items:{});
  const items=adjustBag(old,item,delta);
  transaction.set(ref,{ownerUid:owner,items,updatedAt:serverTimestamp()});
 });
 status((delta>0?'Added ':'Removed ')+Math.abs(delta)+' × '+item.name+' for '+labelFor(owner)+'.');
}
async function learnable(mon,moveName){
 const id=moveId(moveName),key=String(mon.speciesKey||'');
 const cacheId=mon.source+':'+key;
 let known=learnCache.get(cacheId);
 if(!known){
  if(mon.source==='custom'){
   const slug=key.replace(/^custom:/,'');
   const docu=await getDoc(doc(db,'santara_species_overrides',slug));
   if(!docu.exists())throw Error('Custom species learnset is not registered for '+mon.speciesName+'.');
   known={knownMoves:docu.data().knownMoves||[],incomplete:false};
  }else{
   const response=await fetchPokeApi('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(key));
   if(!response.ok)throw Error('PokéAPI could not check TM compatibility for '+mon.speciesName+'.');
   known=await officialFamilyMoveCatalog(await response.json());
  }
  if(!known.incomplete)learnCache.set(cacheId,known);
 }
 const custom=customMoves.find(x=>moveId(x.name||x.slug)===id);
 if(custom&&customMoveScope(custom).requiredMegaSlug)throw Error('Mega-exclusive moves cannot be taught using ordinary TMs.');
 // Official moves require the actual TM/machine learn method, not just
 // level-up or Egg compatibility. Custom species use their GM-curated
 // knownMoves list as the compatibility whitelist until source tags exist.
 const compatible=mon.source==='custom'
  ?legalMove(moveName,{speciesKey:key,knownMoves:known.knownMoves},customMoves,'')
  :Array.isArray(known.tmMoves)&&known.tmMoves.some(m=>memoryKey(m)===id);
 if(!compatible){
  if(known.incomplete)throw Error('Evolution data is temporarily incomplete; retry the compatibility check.');
  throw Error(mon.speciesName+' cannot learn '+moveName+' via TM. Level-up, Egg and tutor methods do not count.');
 }
}
async function teachTm(ownerUid,pokemonId,itemId,forgetMove,requestId=''){
 if(!GM)throw Error('Only the GM can complete TM teaching. Players can submit a request.');
 const bagRef=doc(db,'santara_trainer_bags',ownerUid);
 const monRef=doc(db,'santara_pokemon',pokemonId);
 const requestRef=requestId?doc(db,'santara_tm_requests',requestId):null;
 const memoryRef=doc(db,'santara_pokemon_move_memory',pokemonId);
 // Compatibility is checked outside the Firestore transaction, so retries
 // never repeat network calls. The transaction rechecks owner, species,
 // item, request status, quantity and move slots before changing anything.
 const [bagSnap,monSnap]=await Promise.all([getDoc(bagRef),getDoc(monRef)]);
 if(!bagSnap.exists()||!monSnap.exists())throw Error('The Trainer Bag or Pokémon is no longer available.');
 const item=bagItems(bagSnap.data().items)[itemId],mon=monSnap.data();
 if(!tmUsable(item))throw Error('There is no usable TM in this bag.');
 if(mon.ownerUid!==ownerUid)throw Error('The Pokémon is not owned by this Trainer.');
 await learnable(mon,item.moveName);
 const newMoves=teachMove(mon.moves,item.moveName,forgetMove);
 await runTransaction(db,async tx=>{
  const [bagDocument,pokemonDocument,memoryDocument,requestDocument]=await Promise.all([
   tx.get(bagRef),tx.get(monRef),tx.get(memoryRef),
   requestRef?tx.get(requestRef):Promise.resolve(null)
  ]);
  if(!bagDocument.exists()||!pokemonDocument.exists())throw Error('The inventory or Pokémon changed during teaching.');
  const bag=bagDocument.data(),current=pokemonDocument.data();
  const currentItem=bagItems(bag.items)[itemId];
  if(!tmUsable(currentItem)||currentItem.moveName!==item.moveName)throw Error('TM was used or changed; reload the bag.');
  if(current.ownerUid!==ownerUid||current.speciesKey!==mon.speciesKey)throw Error('The Pokémon species or owner changed; retry.');
  if(requestRef){
   if(!requestDocument?.exists()||requestDocument.data().status!=='pending')throw Error('This TM request has already been resolved.');
   const req=requestDocument.data();
   if(req.ownerUid!==ownerUid||req.pokemonId!==pokemonId||req.itemId!==itemId||req.moveName!==item.moveName||req.forgetMove!==forgetMove)
    throw Error('TM request details do not match the item and Pokémon.');
  }
  const remembered=memoryDocument.exists()?memoryDocument.data():null;
  if(remembered&&(remembered.ownerUid!==ownerUid||remembered.speciesKey!==current.speciesKey))
   throw Error('Move Memory owner/species changed. Ask the GM to resync it.');
  if(remembered?.unlockedMoves?.some(name=>memoryKey(name)===memoryKey(item.moveName)))
   throw Error(item.moveName+' is already remembered. Equip it from Manage Moves instead of consuming another TM.');
  const moves=teachMove(current.moves,item.moveName,forgetMove);
  const memory=mergeMoveMemory(current,remembered,[item.moveName],'tm',true);
  const newItems=adjustBag(bag.items,currentItem,-1);
  tx.update(monRef,{moves,updatedAt:serverTimestamp()});
  tx.set(memoryRef,{...memory,updatedAt:serverTimestamp()});
  tx.set(bagRef,{ownerUid,items:newItems,updatedAt:serverTimestamp()});
  if(requestRef)tx.update(requestRef,{status:'approved',resolvedAt:serverTimestamp()});
 });
 status(item.moveName+' taught and permanently remembered. 1 TM was consumed; later move swaps are free.');
}
async function requestTeaching(pokemonId,itemId,forgetMove){
 if(!approved||!user)throw Error('Sign in as an approved Trainer first.');
 const tm=items[itemId],mon=pokemon.find(p=>p.id===pokemonId);
 if(!tmUsable(tm)||!mon||mon.ownerUid!==user.uid)throw Error('Choose your Pokémon and an available TM.');
 if(requests.some(x=>x.status==='pending'&&x.pokemonId===pokemonId&&x.itemId===itemId))
  throw Error('You already have a pending request for this TM and Pokémon.');
 await learnable(mon,tm.moveName);
 teachMove(mon.moves,tm.moveName,forgetMove);
 await addDoc(collection(db,'santara_tm_requests'),{
  ownerUid:user.uid,pokemonId,itemId,moveName:tm.moveName,forgetMove,
  status:'pending',createdAt:serverTimestamp(),resolvedAt:null
 });
 activeCategory='requests';activeTM='';draw();
 status('Teaching request sent to the GM. The TM will only be consumed when it is approved.');
}
async function rejectRequest(id){
 if(!GM)throw Error('Only the GM can reject TM requests.');
 const r=requests.find(x=>x.id===id);
 if(!r||r.status!=='pending')throw Error('Request not pending.');
 await runTransaction(db,async tx=>{
  const ref=doc(db,'santara_tm_requests',id),snap=await tx.get(ref);
  if(!snap.exists()||snap.data().status!=='pending')throw Error('Request already resolved.');
  tx.update(ref,{status:'rejected',resolvedAt:serverTimestamp()});
 });
 status('TM teaching request rejected. No TM was consumed.');
}
function syncTmForm(){
 const box=document.getElementById('tm-move-row'),form=document.getElementById('grant-form');
 if(!box||!form)return;
 const isTM=form.elements.category.value==='tm';
 box.hidden=!isTM;
 form.elements.moveName.required=isTM;
 form.elements.name.disabled=isTM;
 if(isTM)form.elements.name.value='';
}
root.addEventListener('change',event=>{
 if(event.target.id==='owner-picker'&&GM){owner=event.target.value;watchOwner();}
 if(event.target.id==='grant-category')syncTmForm();
 if(event.target.id==='tm-pokemon'){targetPokemon=event.target.value;draw();}
});
root.addEventListener('click',async event=>{
 const button=event.target.closest('button[data-action]');
 if(!button||busy)return;
 const action=button.dataset.action;
 try{
  if(action==='filter'){activeCategory=button.dataset.category;activeTM='';targetPokemon='';draw();return}
  if(action==='choose-tm'){activeTM=button.dataset.id;targetPokemon=pokemon[0]?.id||'';draw();return}
  if(action==='close-teach'){activeTM='';targetPokemon='';draw();return}
  busy=true;button.disabled=true;
  if(action==='google-login')await signInWithPopup(auth,new GoogleAuthProvider());
  if(action==='adjust'||action==='remove-all'){
   if(!GM)throw Error('Only a GM can change item quantities.');
   const item=items[button.dataset.id];
   if(!item)throw Error('Item is no longer in the bag.');
   const change=action==='remove-all'?-item.quantity:Number(button.dataset.delta);
   if(action==='remove-all'&&!confirm('Remove all '+item.name+' from this bag?'))return;
   await changeItem(item,change);
  }
  if(action==='approve-request'){
   const request=requests.find(x=>x.id===button.dataset.id);
   if(!request)throw Error('Request not found.');
   await teachTm(request.ownerUid,request.pokemonId,request.itemId,request.forgetMove,request.id);
  }
  if(action==='reject-request')await rejectRequest(button.dataset.id);
 }catch(e){error(e)}
 finally{busy=false;if(button.isConnected)button.disabled=false}
});
root.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;busy=true;
 const form=event.target,button=form.querySelector('[type="submit"]');
 if(button)button.disabled=true;
 try{
  if(form.id==='bag-login'){
   const f=new FormData(form);
   await signInWithEmailAndPassword(auth,cap(f.get('email'),320),String(f.get('password')||''));
  }
  if(form.id==='grant-form'){
   if(!GM)throw Error('Only the GM can grant items.');
   const f=new FormData(form);
   const item=itemDefinition({name:f.get('name'),category:f.get('category'),quantity:Number(f.get('quantity')),description:f.get('description'),moveName:f.get('moveName')});
   await changeItem(item,item.quantity);
   form.reset();syncTmForm();
  }
  if(form.id==='teach-form'){
   const f=new FormData(form),pokemonId=String(f.get('pokemonId')||''),forget=String(f.get('forgetMove')||'');
   if(GM)await teachTm(owner,pokemonId,activeTM,forget);
   else await requestTeaching(pokemonId,activeTM,forget);
  }
 }catch(e){error(e)}finally{busy=false;if(button?.isConnected)button.disabled=false}
});
const cfg=window.SANTARA_FIREBASE_CONFIG;
if(!cfg?.projectId){error(Error('Firebase configuration is missing.'));signInUI('Cannot connect to Firebase.')}
else{
 const app=getApps().length?getApp():initializeApp(cfg);
 auth=getAuth(app);db=getFirestore(app);
 onAuthStateChanged(auth,async current=>{
  stopAll();user=current;approved=false;chip.textContent=current?.email||'Not signed in';
  if(!current){signInUI('Sign in to your Trainer Bag');return}
  try{
   approved=await authorize(current);
   if(!approved){signInUI(GM?'GM access is required':'Your Trainer account must be approved');return}
   connect();
  }catch(e){error(e);signInUI('Unable to check Trainer permissions')}
 },error);
}
