import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const imported=source=>import('data:text/javascript;charset=utf-8,'+encodeURIComponent(source));
const moveSource=readFileSync(new URL('../pokemon-move-metadata.js',import.meta.url),'utf8');
const mathSource=readFileSync(new URL('../pokemon-math.js',import.meta.url),'utf8');
const {classifyMove,classificationLabels,MOVE_TARGETS,MOVE_TRAITS}=await imported(moveSource);
const {movementSquares,movementFeet,combatSummary}=await imported(mathSource);

test('Bitter Blade is Physical, Contact, Slicing; Rock Slide is an opposing spread',()=>{
 const b=classifyMove('Bitter Blade');
 assert.equal(b.category,'Physical');
 assert.equal(b.contact,true);
 assert.ok(b.traits.includes('slicing'));
 assert.equal(b.target,'normal');
 assert.equal(b.range,'1 square (contact)');
 assert.ok(classificationLabels(b).includes('Slicing'));
 const r=classifyMove('Rock Slide');
 assert.equal(r.category,'Physical');
 assert.equal(r.contact,false);
 assert.equal(r.target,'allAdjacentFoes');
 assert.match(r.range,/2-square radius/);
});
test('Official special, status, and extra trait flags are preserved',()=>{
 const shadow=classifyMove('Shadow Ball');
 assert.equal(shadow.category,'Special');
 assert.equal(shadow.contact,false);
 assert.equal(shadow.range,'8 squares');
 const quake=classifyMove('Earthquake');
 assert.equal(quake.target,'allAdjacent');
 assert.match(quake.range,/3-square radius/);
 const protect=classifyMove('Protect');
 assert.equal(protect.category,'Status');
 assert.equal(protect.target,'self');
 assert.equal(protect.range,'Self');
 const quick=classifyMove('Quick Attack');
 assert.equal(quick.priority,1);
 assert.ok(classificationLabels(quick).includes('Priority +1'));
});
test('Custom move classification overrides an identically named official move',()=>{
 const c=classifyMove('Bitter Blade',{category:'Special',target:'allAdjacent',contact:false,traits:['sound','pulse']});
 assert.equal(c.category,'Special');
 assert.equal(c.contact,false);
 assert.deepEqual(c.traits,['sound','pulse']);
 assert.equal(c.target,'allAdjacent');
 assert.equal(c.source,'custom');
});
test('Undefined custom properties stay unknown instead of silently being labelled non-contact',()=>{
 const c=classifyMove('Schrade’s End',{category:'Special',description:'Unspecified range'});
 assert.equal(c.contact,null);
 assert.equal(c.target,'');
 assert.ok(classificationLabels(c).includes('Contact not set'));
 assert.ok(classificationLabels(c).includes('GM to specify'));
});
test('All official move metadata entries have category, contact, targeting, and range',()=>{
 const content=moveSource.match(/const DATA=(\{[^;]*\});/);
 assert.ok(content,'local catalogue should be embedded without requiring another network lookup');
 const table=JSON.parse(content[1]);
 assert.ok(Object.keys(table).length>=950);
 for(const key of Object.keys(table)){
  const move=classifyMove(key);
  assert.equal(move.known,true,key);
  assert.ok(['Physical','Special','Status'].includes(move.category),key);
  assert.equal(typeof move.contact,'boolean',key);
  assert.ok(MOVE_TARGETS.includes(move.target),key);
  assert.ok(move.range,key);
 }
});
test('Pokémon base Speed converts into bounded 5-foot movement squares',()=>{
 for(const [speed,squares] of [[1,4],[29,4],[30,5],[59,5],[60,6],[90,7],[120,8],[142,8],[151,9],[180,10],[210,11],[240,12],[255,12]]){
  assert.equal(movementSquares(speed),squares);
  assert.equal(movementFeet(speed),squares*5);
 }
});
test('Combat sheet movement uses transformed effective Speed without modifying HP/level math',()=>{
 const baseStats={hp:78,attack:63,defense:72,specialAttack:200,specialDefense:70,speed:151};
 const output=combatSummary({level:80,maxHp:160,baseStats});
 assert.equal(output.movementSquares,9);
 assert.equal(output.movementFeet,45);
 assert.equal(output.dndLevel,16);
});
test('The UI displays tags and grid movement on both editions',()=>{
 const party=readFileSync(new URL('../pokemon-party.js',import.meta.url),'utf8');
 assert.match(party,/classificationLabels\(cls\)/);
 assert.match(party,/classifyMove\(name,special/);
 assert.match(party,/d\.movementSquares/);
 assert.match(party,/class="move-class"/);
});
