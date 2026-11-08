import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const content=readFileSync(new URL('../santara-inventory-core.js',import.meta.url),'utf8');
const helpers=new Function(content.replace(/^export /gm,'')+
 '\nreturn {ITEM_CATEGORIES,itemDefinition,inventoryId,bagItems,adjustBag,teachMove,tmUsable,moveId};')();
const {ITEM_CATEGORIES,itemDefinition,inventoryId,bagItems,adjustBag,teachMove,tmUsable}=helpers;

test('Inventory categories and TM item IDs do not collide with ordinary items',()=>{
 const tm=itemDefinition({category:'tm',moveName:'Roost',quantity:2});
 const misc=itemDefinition({category:'misc',name:'Roost',quantity:2});
 assert.equal(tm.id,'tm-roost');
 assert.notEqual(tm.id,misc.id);
 assert.ok(ITEM_CATEGORIES.includes('key'));
 assert.equal(tmUsable(tm),true);
});
test('Bag stacks items and rejects negative or excessively large quantities',()=>{
 const item=itemDefinition({category:'medicine',name:'Potion',quantity:4});
 let bag=adjustBag({},item,4);
 assert.equal(bag[item.id].quantity,4);
 bag=adjustBag(bag,item,3);
 assert.equal(bag[item.id].quantity,7);
 bag=adjustBag(bag,item,-7);
 assert.deepEqual(bag,{});
 assert.throws(()=>adjustBag({},item,-1),/Not enough/);
 assert.throws(()=>adjustBag({},item,10000),/Quantity change/);
 assert.throws(()=>adjustBag({},item,0),/Quantity change/);
});
test('TM use fills free slots or replaces an explicitly chosen known move',()=>{
 assert.deepEqual(teachMove(['Brave Bird'],'Roost'),['Brave Bird','Roost']);
 assert.deepEqual(teachMove(['Brave Bird','Quick Attack','Protect','Double Team'],'Roost','Double Team'),
  ['Brave Bird','Quick Attack','Protect','Roost']);
 assert.throws(()=>teachMove(['Brave Bird','Roost'],'Roost'),/already knows/);
 assert.throws(()=>teachMove(['A','B','C','D'],'Roost'),/four slots/);
 assert.throws(()=>teachMove(['A','B','C'],'Roost','Missing'),/no longer known/);
});
test('Inventory app uses an atomic GM teach and a separate player request',()=>{
 const app=readFileSync(new URL('../santara-inventory.js',import.meta.url),'utf8');
 assert.match(app,/const newItems=adjustBag\(bag.items,currentItem,-1\)/);
 assert.match(app,/tx.update\(monRef,\{moves,updatedAt:serverTimestamp\(\)\}\)/);
 assert.match(app,/tx.set\(bagRef,\{ownerUid,items:newItems,updatedAt:serverTimestamp\(\)\}\)/);
 assert.match(app,/tx.update\(requestRef,\{status:'approved',resolvedAt:serverTimestamp\(\)\}\)/);
 assert.match(app,/await learnable\(mon,item.moveName\)/);
 assert.match(app,/await officialFamilyMoveCatalog\(await response.json\(\)\)/);
 assert.match(app,/status:'pending',createdAt:serverTimestamp\(\),resolvedAt:null/);
});
test('GM Firestore rules grant item mutations only to GMs and TM player requests never edit Pokémon',()=>{
 const rulesText=readFileSync(new URL('../firestore.rules',import.meta.url),'utf8');
 const start=rulesText.indexOf('match /santara_trainer_bags/{uid}');
 if(start<0){ // Player repo does not deploy rules; the GM repo remains authoritative.
  const guide=readFileSync(new URL('../TRAINER_INVENTORY_AND_TMS.md',import.meta.url),'utf8');
  assert.match(guide,/GM repo.*firestore.rules/);
  return;
 }
 const bag=rulesText.slice(start,rulesText.indexOf('match /santara_tm_requests/{requestId}',start));
 assert.match(bag,/allow create, update: if gm\(\)/);
 assert.match(bag,/request.auth.uid == uid/);
 const req=rulesText.slice(rulesText.indexOf('match /santara_tm_requests/{requestId}',start));
 assert.match(req,/request.resource.data.ownerUid == request.auth.uid/);
 assert.match(req,/request.resource.data.status == 'pending'/);
 assert.match(req,/allow update: if gm\(\)/);
 assert.match(rulesText,/function gmTmMoveUpdate\(\)/);
});
