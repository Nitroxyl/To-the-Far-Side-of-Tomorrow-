// Santara battle action effects — no damage calculation.
// A profile can describe a move, an ability trigger, or an explicit GM preset.
// Every application has a preview and requires a deliberate confirmation.
export const STAGE_KEYS=['attack','defense','specialAttack','specialDefense','speed','accuracy','evasion'];
export const CONDITIONS=['None','Burned','Poisoned','Badly poisoned','Paralyzed','Asleep','Frozen'];
export const TRIGGERS=['manual','on_enter','turn_start','turn_end','on_hit','on_ko'];
export const EFFECT_KINDS=['status','heal','fixed_damage','stage'];
export const RECIPIENTS=['self','target'];
const clean=v=>String(v??'').trim();
export const actionSlug=v=>clean(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
const int=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
export function blankCombatState(ownerUid,turn=1){
 return {ownerUid,turn,stages:{attack:0,defense:0,specialAttack:0,specialDefense:0,speed:0,accuracy:0,evasion:0},moveRecords:[]};
}
export function validateActionProfile(profile){
 const problems=[];
 if(!['move','ability'].includes(profile?.kind))problems.push('Select Move or Ability');
 if(!clean(profile?.name)||clean(profile.name).length>48)problems.push('Name must be 1–48 characters');
 if(!TRIGGERS.includes(profile?.trigger))problems.push('Choose a valid trigger');
 if(!['self','ally','opponent'].includes(profile?.target))problems.push('Choose a valid target');
 if(!int(profile?.priority,-7,7))problems.push('Priority must be -7 to +7');
 if(!int(profile?.range,0,30))problems.push('Grid range must be 0–30 squares');
 if(!int(profile?.cooldown,0,10))problems.push('Cooldown must be 0–10 turns');
 if(!int(profile?.maxUses,0,40))problems.push('Maximum uses must be 0–40 (0 means unlimited)');
 if(!Array.isArray(profile?.effects)||profile.effects.length>4)problems.push('Up to four effects are allowed');
 for(const [i,e] of (Array.isArray(profile?.effects)?profile.effects:[]).entries()){
  if(!EFFECT_KINDS.includes(e.kind))problems.push('Effect '+(i+1)+' has an unknown kind');
  if(!RECIPIENTS.includes(e.recipient))problems.push('Effect '+(i+1)+' has an invalid recipient');
  if(!int(e.chance,1,100))problems.push('Effect '+(i+1)+' chance must be 1–100');
  if(!int(e.amount,-3000,3000))problems.push('Effect '+(i+1)+' amount must be an integer');
  if(!CONDITIONS.includes(e.status))problems.push('Effect '+(i+1)+' status is invalid');
  if(!STAGE_KEYS.includes(e.stat))problems.push('Effect '+(i+1)+' stat is invalid');
  if(e.kind==='stage'&&!int(e.amount,-6,6))problems.push('Stat stages must be between -6 and +6');
  if((e.kind==='heal'||e.kind==='fixed_damage')&&(e.amount<0||e.amount>3000))problems.push('Fixed HP effects must be 0–3000');
 }
 return problems;
}
export function normalizeProfile(profile) {
 const result={
  kind:profile?.kind==='ability'?'ability':'move',name:clean(profile?.name).slice(0,48),
  trigger:TRIGGERS.includes(profile?.trigger)?profile.trigger:'manual',
  target:['self','ally','opponent'].includes(profile?.target)?profile.target:'self',
  priority:Number(profile?.priority??0),range:Number(profile?.range??0),
  cooldown:Number(profile?.cooldown??0),maxUses:Number(profile?.maxUses??0),
  effects:(profile?.effects||[]).map(e=>({
   kind:e.kind,recipient:e.recipient,chance:Number(e.chance??100),
   amount:Number(e.amount??0),status:e.status||'None',stat:e.stat||'attack'
  }))
 };
 const problems=validateActionProfile(result);
 if(problems.length)throw Error(problems.join('; '));
 return result;
}
export function combatProfileKey(profile){
 return (profile.kind==='ability'?'ability-':'move-')+actionSlug(profile.name);
}
export function statusAfterEffects({actor,target,actorState,targetState,profile,random=Math.random}){
 const p=normalizeProfile(profile);
 const clone=x=>JSON.parse(JSON.stringify(x));
 const a=clone(actor),t=target===actor?a:clone(target);
 const aState=clone(actorState||blankCombatState(actor.ownerUid));
 const tState=t===a?aState:clone(targetState||blankCombatState(target.ownerUid));
 const turn=Number(aState.turn)||1;
 const key=combatProfileKey(p);
 const records=Array.isArray(aState.moveRecords)?aState.moveRecords:[];
 const previous=records.find(r=>r.key===key)||{key,uses:0,nextTurn:1};
 if(p.kind==='move'&&p.maxUses>0&&previous.uses>=p.maxUses)
  throw Error(p.name+' has exhausted its available uses.');
 if(turn<(previous.nextTurn||1))throw Error(p.name+' is on cooldown until turn '+previous.nextTurn+'.');
 const steps=[];
 for(const eff of p.effects){
  const hit=Number(random());
  if(!Number.isFinite(hit)||hit<0||hit>=1)throw Error('Invalid probability result.');
  const applied=hit<eff.chance/100;
  const mon=eff.recipient==='self'?a:t;
  const st=eff.recipient==='self'?aState:tState;
  const label=(mon.nickname||mon.speciesName||'Pokémon');
  if(!applied){steps.push({applied:false,description:label+' resisted the secondary effect ('+eff.chance+'% chance).'});continue}
  if(eff.kind==='status'){
   mon.status=eff.status;
   steps.push({applied:true,description:label+' status → '+eff.status});
  }else if(eff.kind==='heal'){
   const before=Number(mon.currentHp)||0,maximum=Number(mon.maxHp)||1;
   mon.currentHp=Math.min(maximum,before+eff.amount);
   steps.push({applied:true,description:label+' recovered '+(mon.currentHp-before)+' HP'});
  }else if(eff.kind==='fixed_damage'){
   const before=Number(mon.currentHp)||0;
   mon.currentHp=Math.max(0,before-eff.amount);
   steps.push({applied:true,description:label+' took '+(before-mon.currentHp)+' fixed HP loss (not move damage)'});
  }else if(eff.kind==='stage'){
   const before=Number(st.stages[eff.stat]||0);
   st.stages[eff.stat]=Math.max(-6,Math.min(6,before+eff.amount));
   steps.push({applied:true,description:label+' '+eff.stat+' stage '+before+' → '+st.stages[eff.stat]});
  }
 }
 const next={key,uses:previous.uses+(p.kind==='move'?1:0),nextTurn:turn+p.cooldown+1};
 aState.moveRecords=records.filter(r=>r.key!==key).concat(next).slice(-24);
 return {actor:a,target:t,actorState:aState,targetState:tState,steps,turn,profile:p};
}
export function advanceCombatTurn(current){
 const state=JSON.parse(JSON.stringify(current));
 state.turn=Math.min(10000,Math.max(1,Number(state.turn)||1)+1);
 return state;
}
export const DEFAULT_PROFILES=[
 {kind:'move',name:'Thunder Wave',trigger:'manual',target:'opponent',priority:0,range:8,cooldown:0,maxUses:0,effects:[{kind:'status',recipient:'target',chance:100,amount:0,status:'Paralyzed',stat:'attack'}]},
 {kind:'move',name:'Will-O-Wisp',trigger:'manual',target:'opponent',priority:0,range:8,cooldown:0,maxUses:0,effects:[{kind:'status',recipient:'target',chance:100,amount:0,status:'Burned',stat:'attack'}]},
 {kind:'move',name:'Toxic',trigger:'manual',target:'opponent',priority:0,range:8,cooldown:0,maxUses:0,effects:[{kind:'status',recipient:'target',chance:100,amount:0,status:'Badly poisoned',stat:'attack'}]},
 {kind:'move',name:'Spore',trigger:'manual',target:'opponent',priority:0,range:3,cooldown:0,maxUses:0,effects:[{kind:'status',recipient:'target',chance:100,amount:0,status:'Asleep',stat:'attack'}]},
 {kind:'move',name:'Swords Dance',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:2,status:'None',stat:'attack'}]},
 {kind:'move',name:'Nasty Plot',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:2,status:'None',stat:'specialAttack'}]},
 {kind:'move',name:'Dragon Dance',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'attack'},{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'speed'}]},
 {kind:'move',name:'Calm Mind',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'specialAttack'},{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'specialDefense'}]},
 {kind:'move',name:'Iron Defense',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:2,status:'None',stat:'defense'}]},
 {kind:'move',name:'Recover',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'heal',recipient:'self',chance:100,amount:40,status:'None',stat:'attack'}]},
 {kind:'ability',name:'Intimidate',trigger:'on_enter',target:'opponent',priority:0,range:8,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'target',chance:100,amount:-1,status:'None',stat:'attack'}]},
 {kind:'ability',name:'Speed Boost',trigger:'turn_end',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'speed'}]},
 {kind:'ability',name:'Moxie',trigger:'on_ko',target:'self',priority:0,range:0,cooldown:0,maxUses:0,effects:[{kind:'stage',recipient:'self',chance:100,amount:1,status:'None',stat:'attack'}]}
];
export function resolveProfile(kind,name,saved=[]){
 const key=actionSlug(name);
 return saved.find(p=>p.kind===kind&&actionSlug(p.name)===key)
  ||DEFAULT_PROFILES.find(p=>p.kind===kind&&actionSlug(p.name)===key)||null;
}
