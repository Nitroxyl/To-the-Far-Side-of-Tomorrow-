import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {JSDOM} from 'jsdom';

test('calculator controls, transformation toggles and summary stay accessible',()=>{
 const dom=new JSDOM('<!doctype html><html><body><span id="user-chip"></span><p id="calc-feedback"></p><div id="calc-app"></div></body></html>',{url:'https://example.org/damage-calculator.html'});
 const root=dom.window;
 root.SANTARA_POKEMON_EDITION='gm';
 root.calc={Generations:{get:()=>({moves:{get:()=>({basePower:90})}})}};
 const result={min:20,max:30,minPercent:15.4,maxPercent:23.1,defenderHP:130,currentDefHP:130,
  koChance:0,notes:[],warnings:[],meta:{category:'Special',type:'Fire',hits:1},basePower:90,accuracy:100,weather:'Clear',fullDescription:''};
 let calls=0;
 const context=createContext({window:root,document:root.document,location:root.location,URLSearchParams,
   console,Map,Set,encodeURIComponent,setTimeout,clearTimeout,
   computeDamage:()=>{calls++;return result;},titleType:v=>v.charAt(0).toUpperCase()+v.slice(1)});
 const source=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8')
  .replace(/^import[^\n]*\n/gm,'');
 runInContext(source,context,{timeout:5000});
 runInContext("choices=[{key:'r:a',kind:'registered',source:{id:'a',speciesName:'Charcadet',speciesKey:'charcadet',level:15,types:['Fire'],ability:'Flash Fire',moves:['Flamethrower']}},{key:'r:b',kind:'registered',source:{id:'b',speciesName:'Kingler',speciesKey:'kingler',level:40,types:['Water'],ability:'Hyper Cutter'}}]; byKey=new Map(choices.map(x=>[x.key,x])); moves=['Flamethrower']; natureNames=['Serious']; abilities=[]; items=[];draw();",context,{timeout:5000});
 const doc=root.document,preview=doc.querySelector('#damage-results'),grid=doc.querySelector('.calc-grid');
 assert.ok(preview,'damage results are present');
 assert.ok(grid,'attacker and defender grid exists');
 assert.ok(preview.compareDocumentPosition(grid)&root.Node.DOCUMENT_POSITION_FOLLOWING,'result must be above combatant cards');
 assert.equal(doc.querySelectorAll('.calc-toggle-grid').length,2);
 for(const side of ['a','d']){
  const group=doc.querySelector('#'+side+'-mega').closest('.calc-toggle-grid');
  assert.equal(group.querySelectorAll('input[type=checkbox]').length,3);
  assert.ok(group.querySelector('label[for="'+side+'-mega"]'));
  assert.ok(group.querySelector('label[for="'+side+'-tera"]'));
  assert.ok(group.querySelector('label[for="'+side+'-dmax"]'));
  assert.equal(doc.querySelector('#'+side+'-tera-wrap').hidden,true);
 }
 assert.match(preview.textContent,/20–30 HP/);
 assert.ok(calls>=1);
 const mega=doc.querySelector('#a-mega');
 assert.equal(mega.disabled,true,'unassigned Mega must stay disabled');
 doc.querySelector('#a-tera').click();
 assert.equal(doc.querySelector('#a-tera-wrap').hidden,false,'Tera type is shown only when needed');
 assert.ok(calls>=2,'changes should update the result automatically');
 assert.equal(doc.querySelector('.calc-options details').open,false,'advanced battlefield settings start collapsed');
 assert.ok(doc.querySelector('.calc-quick input#damage-move'),'move selector stays at the top');
});
test('calculator CSS makes damage results sticky and checkbox labels horizontal',()=>{
 const html=readFileSync(new URL('../damage-calculator.html',import.meta.url),'utf8');
 assert.match(html,/\.calc-sticky-result\s*\{[^}]*position:sticky;/);
 assert.match(html,/\.calc-toggle\s*\{[^}]*flex-direction:row;/);
 assert.match(html,/\.calc-toggle input\[type=checkbox\]\s*\{[^}]*width:17px;/);
 assert.match(html,/@media\(max-width:800px\)/);
});

test('unreleased weather is selectable only in the GM edition',()=>{
 const js=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');
 function runEdition(edition) {
  const dom=new JSDOM('<!doctype html><html><body><span id="user-chip"></span><p id="calc-feedback"></p><div id="calc-app"></div></body></html>',{url:'https://example.org/damage-calculator.html'});
  dom.window.SANTARA_POKEMON_EDITION=edition;
  const context=createContext({window:dom.window,document:dom.window.document,location:dom.window.location,URLSearchParams,
    console,Map,Set,encodeURIComponent,setTimeout,clearTimeout});
  runInContext(js,context,{timeout:5000});
  const html=runInContext('quickMarkup()',context,{timeout:1000});
  dom.window.document.querySelector('#calc-app').innerHTML=html;
  return {dom,context,labels:[...dom.window.document.querySelector('#damage-weather').options].map(x=>x.value)};
 }
 const gm=runEdition('gm');
 const player=runEdition('player');
 for(const expected of ['Auto','Clear','Sun','Rain','Sand','Snow']){
  assert.ok(gm.labels.includes(expected));
  assert.ok(player.labels.includes(expected));
 }
 for(const secret of ['Calamitous Sun','Royal Tempest']){
  assert.ok(gm.labels.includes(secret),'GM should have access to '+secret);
  assert.ok(!player.labels.includes(secret),'Players must not see '+secret);
 }
 // The core still calculates special weather if activated by an ability; the player
 // receives its damage result without seeing the unreleased name or rules text.
 const result={min:25,max:34,minPercent:20,maxPercent:27,defenderHP:125,currentDefHP:125,koChance:0,
   notes:['Calamitous Sun blocks Water attacks.'],warnings:[],meta:{category:'Special',type:'Fire',hits:1},
   basePower:95,accuracy:100,weather:'Calamitous Sun',fullDescription:'Kingdom’s End'};
 runInContext('showResult('+JSON.stringify(result)+')',player.context);
 const text=player.dom.window.document.querySelector('#damage-results').textContent;
 assert.ok(!text.includes('Calamitous Sun'));
 assert.ok(!text.includes('Kingdom'));
 assert.match(text,/Exclusive weather/);
 runInContext('showResult('+JSON.stringify(result)+')',gm.context);
 assert.match(gm.dom.window.document.querySelector('#damage-results').textContent,/Calamitous Sun/);
});

test('Pokémon search filters by name and generation without scrolling',()=>{
 const dom=new JSDOM('<!doctype html><html><body><span id="user-chip"></span><p id="calc-feedback"></p><div id="calc-app"></div></body></html>',{url:'https://example.org/damage-calculator.html'});
 const root=dom.window;root.SANTARA_POKEMON_EDITION='player';
 root.calc={Generations:{get:()=>({moves:{get:()=>({basePower:90})}})}};
 let calculations=0;
 const result={min:12,max:18,minPercent:10,maxPercent:15,defenderHP:120,currentDefHP:120,
   koChance:0,notes:[],warnings:[],meta:{category:'Special',type:'Fire',hits:1},basePower:90,
   accuracy:100,weather:'Clear',fullDescription:''};
 const context=createContext({window:root,document:root.document,location:root.location,
   URLSearchParams,console,Map,Set,encodeURIComponent,setTimeout,clearTimeout,
   computeDamage:()=>{calculations++;return result;},
   titleType:v=>v.charAt(0).toUpperCase()+v.slice(1)});
 const src=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8')
   .replace(/^import[^\n]*\n/gm,'');
 runInContext(src,context,{timeout:5000});
 runInContext("choices=["+
 "{key:'r:charcadet',kind:'registered',label:'Sparky · Charcadet (Lv 15)',generation:9,source:{id:'charcadet',speciesName:'Charcadet',speciesKey:'charcadet',nickname:'Sparky',level:15,types:['Fire'],ability:'Flash Fire',moves:['Flamethrower']}},"+
 "{key:'r:kingler',kind:'registered',label:'Kingler (Lv 40)',generation:1,source:{id:'kingler',speciesName:'Kingler',speciesKey:'kingler',level:40,types:['Water'],ability:'Hyper Cutter'}},"+
 "{key:'o:ceruledge',kind:'official',label:'Ceruledge',generation:9,source:{name:'Ceruledge',speciesName:'Ceruledge',speciesKey:'ceruledge',level:50,types:['Fire','Ghost'],ability:'Flash Fire'}},"+
 "{key:'o:charizard',kind:'official',label:'Charizard',generation:1,source:{name:'Charizard',speciesName:'Charizard',speciesKey:'charizard',level:50,types:['Fire','Flying'],ability:'Blaze'}}"+
 "];byKey=new Map(choices.map(x=>[x.key,x]));moves=['Flamethrower'];natureNames=['Serious'];abilities=[];items=[];draw();",context,{timeout:5000});
 const search=root.document.querySelector('#a-search'),select=root.document.querySelector('#a-choice');
 assert.ok(root.document.querySelector('#d-search'),'defender should have its own search');
 assert.equal(select.options.length,4);
 search.value='ceru';
 search.dispatchEvent(new root.Event('input',{bubbles:true}));
 assert.equal(select.options.length,1);
 assert.equal(select.value,'o:ceruledge');
 assert.equal(root.document.querySelector('#a-level').value,'50');
 assert.ok(calculations>=2,'changing a matched Pokémon recalculates damage');
 search.value='gen 9';
 search.dispatchEvent(new root.Event('input',{bubbles:true}));
 assert.deepEqual([...select.options].map(x=>x.value),['r:charcadet','o:ceruledge']);
 search.value='Sparky';
 search.dispatchEvent(new root.Event('input',{bubbles:true}));
 assert.deepEqual([...select.options].map(x=>x.value),['r:charcadet']);
 search.value='doesnotexist';
 search.dispatchEvent(new root.Event('input',{bubbles:true}));
 assert.match(root.document.querySelector('#a-match-count').textContent,/No matches/);
 assert.equal(select.value,'r:charcadet','an unmatched query must not wipe the current selection');
 search.value='';
 search.dispatchEvent(new root.Event('input',{bubbles:true}));
 assert.equal(select.options.length,4);
 assert.equal(select.value,'r:charcadet');
});
