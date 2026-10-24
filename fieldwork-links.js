/* Santara Fieldwork: bidirectional linked field records & spoiler-aware Pokémon artwork. */
(() => {
'use strict';
const app = window.SantaraFieldworkBridge;
if(!app)return;
const gm=app.mode==='gm';
const imageCache=new Map();
const artworkApi='https://pokeapi.co/api/v2/pokemon/';
const knownSiteHints={
 'S-001':['LC-001'], 'S-002':['LC-002'], 'S-003':['LC-003'],
 'S-004':['LC-005'], 'S-005':['LC-004'],
 'S-006':['KA-001'], 'S-007':['KA-002'], 'S-008':['CI-002'],
 'S-009':['CO-001'], 'S-010':['RI-002'],
 'S-013':['CO-002']
};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parseIds=v=>Array.isArray(v)?v.map(x=>String(x).trim()).filter(Boolean):String(v||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean);
const ref=o=>String(o?.sourceId||o?.id||'');
const id=o=>String(o?.id||o?.session||'');
const arrays=()=>{
 const db=app.getDb();
 return {sites:db.sites||[],quests:(gm?db.quests:db.requests)||[],wildlife:(gm?db.wildlife:db.sightings)||[],sessions:db.sessions||[]};
};
const hasLabel=v=>Boolean(String(v||'').trim());
const normalized=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const safeUrl=v=>{
 try{const u=new URL(String(v||''));return u.protocol==='https:'&&u.hostname.length>3&&u.username===''&&u.password===''&&u.href.length<=500?u.href:''}catch{return ''}
};
const exposedPokemon=name=>{
 const x=String(name||'').trim();
 return x.length>1&&!/(unknown|unidentified|mysterious|unseen|fire-type|water-type|silhouette|clawed pok[eé]mon|strange pok[eé]mon)/i.test(x);
};
const lookupName=name=>{
 if(!exposedPokemon(name))return '';
 const input=String(name).trim().replace(/\s*\((?:alpha|boss)\)\s*/ig,'').replace(/^alpha\s+/i,'').replace(/\s+alpha$/i,'');
 const aliases={'nidoran♀':'nidoran-f','nidoran♂':'nidoran-m','mr. mime':'mr-mime','mime jr.':'mime-jr','type: null':'type-null','farfetch’d':'farfetchd','farfetch\'d':'farfetchd','sirfetch’d':'sirfetchd','sirfetch\'d':'sirfetchd','flabébé':'flabebe'};
 const basic=input.toLowerCase().trim();
 if(aliases[basic])return aliases[basic];
 return basic.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[.:'’]/g,'').replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
};
function promiseImage(key){
 if(imageCache.has(key))return imageCache.get(key);
 const req=fetch(artworkApi+encodeURIComponent(key)+'/',{mode:'cors'})
  .then(r=>r.ok?r.json():null)
  .then(p=>p?.sprites?.other?.['official-artwork']?.front_default||p?.sprites?.other?.home?.front_default||p?.sprites?.front_default||'')
  .catch(()=> '');
 imageCache.set(key,req);
 return req;
}
function paintArtwork(root=document){
 for(const img of root.querySelectorAll('img[data-fieldwork-pokemon]')){
  const rawName=img.dataset.fieldworkPokemon||'';
  const custom=safeUrl(img.dataset.fieldworkArtwork||'');
  const key=lookupName(rawName);
  const holder=img.closest('.fw-artwork');
  const present=url=>{
   if(!img.isConnected)return;
   if(!url){img.hidden=true;holder?.classList.add('fw-empty');return}
   img.onerror=()=>{img.hidden=true;holder?.classList.add('fw-empty')};
   img.onload=()=>{img.hidden=false;holder?.classList.remove('fw-empty')};
   img.src=url;
  };
  if(custom && exposedPokemon(rawName)){present(custom);continue}
  if(!key){present('');continue}
  promiseImage(key).then(present);
 }
}
function qSites(q){return parseIds(q.relatedSites||q.linked)}
function wSites(w){
 if(w.relatedSites!==undefined||w.linkedSites!==undefined)return parseIds(w.relatedSites!==undefined?w.relatedSites:w.linkedSites);
 const seeded=knownSiteHints[ref(w)];
 if(seeded)return seeded;
 const {sites}=arrays();
 const habitat=normalized(w.habitat||w.where||'');
 if(!habitat)return [];
 return sites.filter(s=>{const n=normalized(s.name);return n.length>=6&&(habitat.includes(n)||n.includes(habitat))}).map(ref);
}
function sessionSites(s){
 const own=parseIds(s.linkedSites||s.relatedSites);
 if(own.length)return own;
 const where=normalized(s.where);
 if(!where)return [];
 return arrays().sites.filter(v=>{
  const n=normalized(v.name),code=normalized(ref(v));
  return (n.length>=6&&where.includes(n))||(code&&where.includes(code));
 }).map(ref);
}
function relatedSitesFor(type,object){
 if(type==='quests'||type==='requests')return qSites(object);
 if(type==='wildlife'||type==='sightings')return wSites(object);
 if(type==='sessions')return sessionSites(object);
 return [];
}
function connected(type,record){
 const {sites,quests,wildlife,sessions}=arrays();
 const siteRefs=type==='sites'?[ref(record)]:relatedSitesFor(type,record);
 const matches=siteRefs.length?new Set(siteRefs):new Set();
 const siteRelated=sites.filter(s=>matches.has(ref(s)) && !(type==='sites'&&ref(record)===ref(s)));
 const allQuest=quests.filter(q=>{
  if(type==='sites')return qSites(q).includes(ref(record));
  if(type==='quests'||type==='requests')return false;
  return qSites(q).some(x=>matches.has(x));
 });
 const allWild=wildlife.filter(w=>{
  if(type==='sites')return wSites(w).includes(ref(record));
  if(type==='wildlife'||type==='sightings')return false;
  return wSites(w).some(x=>matches.has(x));
 });
 const allSessions=sessions.filter(s=>{
  if(type==='sessions')return false;
  return sessionSites(s).some(x=>matches.has(x));
 });
 return {sites:siteRelated,quests:allQuest,wildlife:allWild,sessions:allSessions};
}
function isRelated(siteId,kind,item){return (kind==='quest'?qSites(item):wSites(item)).includes(siteId)}
function choiceList(name,items,picked){
 return '<div class="fw-checkboxes">'+items.map(x=>
  '<label class="fw-relcheck"><input type="checkbox" name="'+esc(name)+'" value="'+esc(ref(x))+'" '+(picked.includes(ref(x))?'checked':'')+'><span><strong>'+esc(x.name||x.pokemon||x.id)+'</strong><small>'+esc(ref(x))+'</small></span></label>'
 ).join('')+'</div>';
}
function relationEditor(type,rec){
 if(!gm || !['sites','quests','wildlife','sessions'].includes(type))return '';
 const {sites,quests,wildlife}=arrays();
 let content='';
 if(type==='sites'){
  const site=ref(rec);
  content='<details class="fw-links-edit"><summary>Related requests ('+quests.filter(q=>isRelated(site,'quest',q)).length+')</summary>'+
   choiceList('fw_rel_quest',quests,quests.filter(q=>isRelated(site,'quest',q)).map(ref))+'</details>'+
   '<details class="fw-links-edit"><summary>Local Pokémon ('+wildlife.filter(w=>isRelated(site,'wild',w)).length+')</summary>'+
   choiceList('fw_rel_wild',wildlife,wildlife.filter(w=>isRelated(site,'wild',w)).map(ref))+'</details>';
 }else{
  const sitesPicked=relatedSitesFor(type,rec);
  content='<details class="fw-links-edit" open><summary>Linked locations ('+sitesPicked.length+')</summary>'+
  choiceList('fw_rel_site',sites,sitesPicked)+'</details>';
 }
 return '<div class="fw-rel-editor"><div class="fw-relation-heading">FIELDWORK CONNECTIONS</div><p>These links appear in the connected field records. Expand a group to change associations.</p>'+content+'</div>';
}
function saveRelations(type,record,form){
 if(!gm)return;
 const data=new FormData(form);
 const read=name=>data.getAll(name).map(String).filter(Boolean);
 const {quests,wildlife}=arrays();
 if(type==='sites'){
  const site=ref(record),wantedQuests=new Set(read('fw_rel_quest')),wantedWild=new Set(read('fw_rel_wild'));
  for(const q of quests){
   const current=new Set(qSites(q));current.delete(site);
   if(wantedQuests.has(ref(q)))current.add(site);
   q.linked=[...current].join('; ');
  }
  for(const w of wildlife){
   const current=new Set(wSites(w));current.delete(site);
   if(wantedWild.has(ref(w)))current.add(site);
   w.linkedSites=[...current].join('; ');
  }
 }else if(type==='quests'){record.linked=read('fw_rel_site').join('; ')}
 else if(type==='wildlife'){record.linkedSites=read('fw_rel_site').join('; ')}
 else if(type==='sessions'){record.linkedSites=read('fw_rel_site').join('; ')}
}
function safeBundle(bundle){
 if(!gm)return bundle;
 const {sites,quests,wildlife}=arrays();
 const visibleS=new Set(bundle.sites.map(ref)),visibleQ=new Set(bundle.requests.map(ref)),visibleW=new Set(bundle.sightings.map(ref));
 for(const s of bundle.sites){
  const k=ref(s);
  s.relatedQuests=quests.filter(q=>visibleQ.has(ref(q))&&qSites(q).includes(k)).map(ref);
  s.relatedWildlife=wildlife.filter(w=>visibleW.has(ref(w))&&wSites(w).includes(k)).map(ref);
 }
 for(const q of bundle.requests){
  const matching=quests.find(r=>ref(r)===ref(q));
  q.relatedSites=matching?qSites(matching).filter(x=>visibleS.has(x)):[];
 }
 for(const w of bundle.sightings){
  const matching=wildlife.find(r=>ref(r)===ref(w));
  w.relatedSites=matching?wSites(matching).filter(x=>visibleS.has(x)):[];
  const custom=safeUrl(matching?.artworkUrl);
  if(custom&&exposedPokemon(w.pokemon))w.artworkUrl=custom;
 }
 return bundle;
}
// Player record links are already filtered by the GM publisher. Existing seed entries
// have a small visible reference set even before the first new cloud publication.
function qSitesPlayerFallback(q){
 if(q.relatedSites!==undefined)return parseIds(q.relatedSites);
 return {'Q-001':['LC-002','LC-003'] }[ref(q)]||[];
}
function wSitesPlayerFallback(w){
 if(w.relatedSites!==undefined)return parseIds(w.relatedSites);
 return {'S-002':['LC-002'],'S-003':['LC-003'],'S-004':['LC-005'],'S-005':['LC-004']}[ref(w)]||[];
}
function getLinksFor(type,record){
 if(gm)return connected(type,record);
 // Never guess undisclosed locations from Pokémon names: only use public reference IDs.
 const db=app.getDb(),sites=db.sites||[],quests=db.requests||[],wildlife=db.sightings||[],sessions=db.sessions||[];
 const links=q=>qSitesPlayerFallback(q),wolves=w=>wSitesPlayerFallback(w);
 const refs=type==='sites'?[ref(record)]:type==='requests'?links(record):type==='sightings'?wolves(record):type==='sessions'?sessionSites(record):[];
 const match=new Set(refs),foundS=sites.filter(v=>match.has(ref(v))&&!(type==='sites'&&ref(v)===ref(record)));
 const foundQ=quests.filter(v=>type==='sites'?links(v).includes(ref(record)):type!=='requests'&&links(v).some(x=>match.has(x)));
 const foundW=wildlife.filter(v=>type==='sites'?wolves(v).includes(ref(record)):type!=='sightings'&&wolves(v).some(x=>match.has(x)));
 const foundSessions=sessions.filter(v=>type!=='sessions'&&sessionSites(v).some(x=>match.has(x)));
 return {sites:foundS,quests:foundQ,wildlife:foundW,sessions:foundSessions};
}
const labels={sites:'Locations',quests:'Research requests',wildlife:'Pokémon sightings',sessions:'Session visits'};
const types={sites:'sites',quests:gm?'quests':'requests',wildlife:gm?'wildlife':'sightings',sessions:'sessions'};
function group(type,items){
 const label=labels[type];
 if(!items.length)return '<div class="fw-rel-none">No linked '+label.toLowerCase()+' yet.</div>';
 return '<div class="fw-rel-items">'+items.map(o=>{
  const title=type==='sessions'?'Session '+o.session:(o.name||o.pokemon||o.id);
  const subtitle=type==='sessions'?o.where:(o.stage||o.status||o.region||o.where||'');
  const sourceId=type==='sessions'?String(o.session):id(o);
  return '<button type="button" data-fw-detail="'+esc(types[type])+'" data-fw-id="'+esc(sourceId)+'" class="fw-related-item">'+
   (type==='wildlife'?artMarkup(o.pokemon,o.artworkUrl):'<span class="fw-refmark">↗</span>')+
   '<span><strong>'+esc(title)+'</strong><small>'+esc(subtitle)+'</small></span></button>';
 }).join('')+'</div>';
}
function artMarkup(name,url){
 const imageURL=safeUrl(url);
 return '<span class="fw-artwork fw-empty"><span class="fw-art-fallback">◇</span><img loading="lazy" hidden alt="Artwork: '+esc(name||'Pokémon')+'" data-fieldwork-pokemon="'+esc(name||'')+'" data-fieldwork-artwork="'+esc(imageURL)+'"></span>';
}
function closeModal(){document.querySelector('#fw-info-modal')?.remove()}
function viewDetail(type,identifier){
 const {sites,quests,wildlife,sessions}=arrays();
 const collection=type==='sites'?sites:type==='sessions'?sessions:type==='quests'||type==='requests'?quests:wildlife;
 const obj=collection.find(o=>id(o)===String(identifier));
 if(!obj)return;
 const title=type==='sessions'?'Session '+obj.session:(obj.name||obj.pokemon||obj.id);
 const linked=getLinksFor(type,obj);
 const key=type==='quests'||type==='requests'?'quests':type==='wildlife'||type==='sightings'?'wildlife':type;
 const headline=(type==='sites'?(gm?obj.clue:obj.found):key==='quests'?(gm?obj.hook:obj.known):key==='wildlife'?obj.behavior:type==='sessions'?(gm?obj.what:obj.found):'');
 const note=gm?(obj.gmTruth||obj.notes||''):(obj.notes||'');
 const info='<div class="fw-detail-meta">'+[obj.stage,obj.status,obj.region,obj.where,obj.kind].filter(Boolean).map(v=>'<span>'+esc(v)+'</span>').join('')+'</div>';
 const art=key==='wildlife'?artMarkup(obj.pokemon,obj.artworkUrl):'';
 closeModal();
 const overlay=document.createElement('div');overlay.id='fw-info-modal';overlay.className='fw-overlay';
 overlay.innerHTML='<div class="fw-dialog" role="dialog" aria-modal="true" aria-label="Fieldwork details"><div class="fw-dialog-top"><div><div class="fw-eyebrow">SANTARA FIELDWORK / '+esc(key.toUpperCase())+'</div><h2>'+esc(title)+'</h2><small>'+esc(ref(obj)||obj.session)+'</small></div><button type="button" data-fw-close aria-label="Close details">✕</button></div>'+
  '<div class="fw-info-body">'+
  '<div class="fw-summary">'+art+'<div class="fw-summary-text">'+info+(headline?'<p>'+esc(headline)+'</p>':'')+(note?'<p class="fw-private-note">'+esc(note)+'</p>':'')+'</div></div>'+
  '<h3 class="fw-section-label">Connected records</h3>'+
  '<div class="fw-related-grid">'+
  (key==='sites'?['quests','wildlife','sessions']:key==='sessions'?['sites']:key==='quests'?['sites','wildlife','sessions']:['sites','quests','sessions']).map(k=>'<section class="fw-rel-group"><h4>'+labels[k]+'</h4>'+group(k,linked[k])+'</section>').join('')+
  '</div></div><div class="fw-detail-actions"><button type="button" data-fw-edit="'+esc(type)+'" data-fw-id="'+esc(identifier)+'">View / edit this record</button><button type="button" data-fw-close>Close</button></div></div>';
 document.body.append(overlay);paintArtwork(overlay);
 overlay.addEventListener('click',e=>{if(e.target===overlay)closeModal()});
}
function afterRender(){paintArtwork(document.getElementById('app')||document)}
document.addEventListener('click',e=>{
 const detail=e.target.closest('[data-fw-detail]');
 if(detail){e.preventDefault();viewDetail(detail.dataset.fwDetail,detail.dataset.fwId);return}
 if(e.target.closest('[data-fw-close]')){closeModal();return}
 const edit=e.target.closest('[data-fw-edit]');
 if(edit){closeModal();app.editRecord(edit.dataset.fwEdit,edit.dataset.fwId)}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
window.SantaraFieldworkExtra={relationEditor,saveRelations,safeBundle,artMarkup,afterRender,viewDetail};
app.refresh();
})();
