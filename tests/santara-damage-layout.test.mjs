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
