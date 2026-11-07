import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../pokemon-action-automation.js',import.meta.url),'utf8');
const {
 blankCombatState,normalizeProfile,resolveProfile,statusAfterEffects,
 advanceCombatTurn,combatProfileKey,DEFAULT_PROFILES
}=await import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const actor={id:'riolu',ownerUid:'owner-user-1234',speciesName:'Riolu',status:'None',maxHp:100,currentHp:90};
const target={id:'tyranitar',ownerUid:'enemy-user-5678',speciesName:'Tyranitar',status:'None',maxHp:120,currentHp:105};
const initial=()=>blankCombatState(actor.ownerUid);

test('built-in Thunder Wave status applies only after user triggers it',()=>{
 const p=resolveProfile('move','Thunder Wave');
 assert.equal(p.effects[0].status,'Paralyzed');
 const output=statusAfterEffects({actor,target,actorState:initial(),targetState:blankCombatState(target.ownerUid),profile:p,random:()=>.2});
 assert.equal(output.target.status,'Paralyzed');
 assert.equal(output.actor.status,'None');
 assert.equal(output.actorState.moveRecords[0].uses,1);
 assert.equal(target.status,'None');
});
test('Intimidate lowers target attack stage without overwriting its other stats',()=>{
 const p=resolveProfile('ability','Intimidate');
 const out=statusAfterEffects({actor,target,actorState:initial(),targetState:blankCombatState(target.ownerUid),profile:p});
 assert.equal(out.targetState.stages.attack,-1);
 assert.equal(out.target.baseStats,undefined);
 assert.equal(out.actorState.moveRecords[0].uses,0);
});
test('Dragon Dance raises two stats and stages clamp at ±6',()=>{
 const p=resolveProfile('move','Dragon Dance');
 const st=initial();st.stages.attack=6;st.stages.speed=5;
 const out=statusAfterEffects({actor,target:actor,actorState:st,targetState:st,profile:p});
 assert.equal(out.actorState.stages.attack,6);
 assert.equal(out.actorState.stages.speed,6);
});
test('turn and use limits prevent repeated action use',()=>{
 const p=normalizeProfile({kind:'move',name:'Limited Pulse',trigger:'manual',target:'self',priority:1,range:3,cooldown:1,maxUses:2,
  effects:[]});
 const first=statusAfterEffects({actor,target:actor,actorState:initial(),profile:p});
 assert.throws(()=>statusAfterEffects({actor,target:actor,actorState:first.actorState,profile:p}),/cooldown/);
 const turn3=advanceCombatTurn(advanceCombatTurn(first.actorState));
 const second=statusAfterEffects({actor,target:actor,actorState:turn3,profile:p});
 const turn5=advanceCombatTurn(advanceCombatTurn(second.actorState));
 assert.throws(()=>statusAfterEffects({actor,target:actor,actorState:turn5,profile:p}),/exhausted/);
});
test('fixed healing and HP loss preserve bounds, separate from damage rolls',()=>{
 const profile=normalizeProfile({kind:'move',name:'Restorative Pulse',trigger:'manual',target:'self',priority:0,range:0,cooldown:0,maxUses:0,
  effects:[{kind:'heal',recipient:'self',chance:100,amount:1000,status:'None',stat:'attack'}]});
 const out=statusAfterEffects({actor,target:actor,actorState:initial(),profile});
 assert.equal(out.actor.currentHp,100);
 const loss={...profile,name:'Doom Toll',effects:[{kind:'fixed_damage',recipient:'target',chance:100,amount:2000,status:'None',stat:'attack'}]};
 const injured=statusAfterEffects({actor,target,actorState:initial(),targetState:blankCombatState(target.ownerUid),profile:loss});
 assert.equal(injured.target.currentHp,0);
});
test('failed secondary effects do not change status',()=>{
 const p=normalizeProfile({kind:'move',name:'Sting',trigger:'manual',target:'opponent',priority:0,range:3,cooldown:0,maxUses:0,
  effects:[{kind:'status',recipient:'target',chance:20,amount:0,status:'Poisoned',stat:'attack'}]});
 const out=statusAfterEffects({actor,target,actorState:initial(),targetState:blankCombatState(target.ownerUid),profile:p,random:()=>.9});
 assert.equal(out.target.status,'None');
 assert.equal(out.steps[0].applied,false);
});
test('GM saved profiles take priority over built-in templates',()=>{
 const custom={...resolveProfile('move','Thunder Wave'),effects:[],cooldown:3};
 assert.equal(resolveProfile('move','Thunder Wave',[custom]).cooldown,3);
 assert.equal(combatProfileKey(custom),'move-thunder-wave');
 assert.ok(DEFAULT_PROFILES.some(x=>x.kind==='ability'));
});
test('profile input rejects invalid shapes and effects',()=>{
 assert.throws(()=>normalizeProfile({kind:'move',name:'Bad Move',effects:[{kind:'heal',recipient:'self',chance:101,amount:2,status:'None',stat:'attack'}]}),/chance/);
 assert.throws(()=>normalizeProfile({kind:'move',name:'Bad Move',effects:[{kind:'stage',recipient:'self',chance:100,amount:9,status:'None',stat:'attack'}]}),/Stat stages/);
});
