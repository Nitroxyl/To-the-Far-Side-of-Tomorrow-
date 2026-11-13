import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {JSDOM} from 'jsdom';
import {readTrainerUnlocks,unlockedWeather,SPECIAL_WEATHER} from '../santara-player-unlocks.js';
import {SANTARA_MEGA_PREVIEWS,eligibleMegaForms,requiredStoneFor,matchesMegaStone,megaStoneNames,isStoryMega} from '../santara-calculator-megas.js';
import {suggestedMegaStone} from '../pokemon-mega-stones.js';
import {makePokemon} from '../santara-damage-core.js';
const require=createRequire(import.meta.url),calc=require('@smogon/calc'),gen=calc.Generations.get(9);
const ceru=SANTARA_MEGA_PREVIEWS.find(m=>m.name==='Mega Ceruledge');
const charizardZ=SANTARA_MEGA_PREVIEWS.find(m=>m.name==='Mega Charizard Z');
const ceruSource={
 id:'ceru',speciesName:'Ceruledge',speciesKey:'ceruledge',
 name:'Ceruledge',baseStats:{hp:75,attack:125,defense:80,specialAttack:60,specialDefense:100,speed:85},
 types:['Fire','Ghost'],ability:'Flash Fire',level:9,heldItem:'',moves:['Bitter Blade']
};
const result={min:8,max:12,minPercent:8,maxPercent:12,defenderHP:100,currentDefHP:100,
 koChance:0,notes:[],warnings:[],meta:{category:'Physical',type:'Fire',hits:1},
 basePower:90,accuracy:100,weather:'Clear',fullDescription:''};

test('Ceruledgite is the required stone for Mega Ceruledge',()=>{
 assert.ok(ceru);
 assert.equal(suggestedMegaStone(ceruSource,ceru),'Ceruledgite');
 assert.equal(requiredStoneFor(ceruSource,ceru),'Ceruledgite');
 assert.ok(megaStoneNames([ceru]).includes('Ceruledgite'));
 assert.equal(matchesMegaStone('ceruledgite','Ceruledgite'),true);
 assert.equal(matchesMegaStone('None','Ceruledgite'),false);
 assert.equal(suggestedMegaStone({speciesKey:'porygon-z'},
  SANTARA_MEGA_PREVIEWS.find(m=>m.name==='Mega Porygon-Z')),'Porygon-Zite');
});
test('Mega gimmick grants ordinary species preview but not secret Z Megas',()=>{
 assert.equal(eligibleMegaForms(ceruSource,SANTARA_MEGA_PREVIEWS,{unlocks:{mega:false}}).length,0);
 assert.deepEqual(eligibleMegaForms(ceruSource,SANTARA_MEGA_PREVIEWS,
  {unlocks:{mega:true}}).map(m=>m.name),['Mega Ceruledge']);
 const normal=eligibleMegaForms({speciesKey:'charizard'},SANTARA_MEGA_PREVIEWS,
  {unlocks:{mega:true}}).map(m=>m.name);
 assert.ok(normal.includes('Mega Charizard X'));
 assert.ok(!normal.includes('Mega Charizard Z'));
 const unlocked=eligibleMegaForms({speciesKey:'charizard'},SANTARA_MEGA_PREVIEWS,
  {unlocks:{mega:true,megaFormUnlocks:[charizardZ.slug]}}).map(m=>m.name);
 assert.ok(unlocked.includes('Mega Charizard Z'));
 assert.equal(isStoryMega(charizardZ),true);
 assert.equal(isStoryMega(SANTARA_MEGA_PREVIEWS.find(m=>m.name==='Mega Porygon-Z')),false);
});
test('assigned Mega snapshots use exact GM stone requirements, even legacy names',()=>{
 const assigned={...ceruSource,megaForm:ceru,megaRequiredStone:'Ceruledgeite'};
 assert.equal(requiredStoneFor(assigned,ceru),'Ceruledgeite');
 assert.deepEqual(eligibleMegaForms(assigned,[],{unlocks:{mega:true}}).map(m=>m.slug),[ceru.slug]);
 assert.equal(matchesMegaStone('Ceruledgeite',requiredStoneFor(assigned,ceru)),true);
});
test('damage engine actually uses custom Mega stats and validates held stone',()=>{
 const normal=makePokemon(calc,gen,ceruSource,{level:9},[]);
 const evolved=makePokemon(calc,gen,{...ceruSource,megaForm:ceru,megaRequiredStone:'Ceruledgite'},
  {level:9,mega:true,item:'Ceruledgite',ability:'Sharpness'},[]);
 assert.equal(evolved.form.mega,true);
 assert.equal(evolved.ability,'Sharpness');
 assert.ok(evolved.pokemon.rawStats.atk>normal.pokemon.rawStats.atk);
 assert.throws(()=>makePokemon(calc,gen,{...ceruSource,megaForm:ceru,megaRequiredStone:'Ceruledgite'},
  {level:9,mega:true,item:'Oran Berry',ability:'Sharpness'},[]),/requires Ceruledgite/);
});
test('Player can Mega Evolve selected base Ceruledge in the calculator',()=>{
 const dom=new JSDOM('<!doctype html><html><body><span id="user-chip"></span><p id="calc-feedback"></p><div id="calc-app"></div></body></html>',{url:'https://example.org/damage-calculator.html'});
 dom.window.SANTARA_POKEMON_EDITION='player';dom.window.calc=calc;
 let lastAttacker=null,calls=0;
 const context=createContext({
  window:dom.window,document:dom.window.document,location:dom.window.location,
  URLSearchParams,console,Map,Set,encodeURIComponent,setTimeout,clearTimeout,
  readTrainerUnlocks,unlockedWeather,SPECIAL_WEATHER,
  SANTARA_MEGA_PREVIEWS,eligibleMegaForms,requiredStoneFor,matchesMegaStone,megaStoneNames,isStoryMega,
  computeDamage:(engine,args)=>{lastAttacker=args.attacker;calls++;return result;},
  titleType:v=>v.charAt(0).toUpperCase()+v.slice(1)
 });
 const js=readFileSync(new URL('../santara-damage-calculator.js',import.meta.url),'utf8')
  .replace(/^import[^\n]*\n/gm,'');
 runInContext(js,context,{timeout:5000});
 const isGmBundle=js.includes("const playerProgression={mega:true");
 const statement=(isGmBundle?"":"playerProgression=readTrainerUnlocks({mega:true});")+
 "choices="+JSON.stringify([
  {key:'r:ceru',kind:'registered',label:'Ceruledge (Lv 9)',source:ceruSource},
  {key:'r:kingler',kind:'registered',label:'Kingler (Lv 30)',source:{
   ...ceruSource,id:'kingler',speciesName:'Kingler',speciesKey:'kingler',name:'Kingler',level:30,types:['Water'],ability:'Hyper Cutter'
  }}
 ])+";byKey=new Map(choices.map(x=>[x.key,x]));megaForms="+JSON.stringify(SANTARA_MEGA_PREVIEWS)+
 ";items=['Ceruledgite'];moves=['Bitter Blade'];natureNames=['Serious'];abilities=[];draw();";
 runInContext(statement,context,{timeout:5000});
 const d=dom.window.document;
 assert.equal(d.querySelector('#a-mega-wrap').hidden,false);
 assert.ok([...d.querySelector('#a-mega-form').options].some(x=>x.textContent==='Mega Ceruledge'));
 assert.equal(d.querySelector('#a-mega').disabled,true,'holding no stone cannot Mega');
 assert.match(d.querySelector('#a-mega-hint').textContent,/Ceruledgite/);
 assert.ok(d.querySelector('#calc-item-list option[value="Ceruledgite"]'));
 d.querySelector('#a-mega-stone').click();
 assert.equal(d.querySelector('#a-item').value,'Ceruledgite');
 assert.equal(d.querySelector('#a-mega').disabled,false);
 assert.equal(d.querySelector('#a-mega').checked,true);
 assert.equal(d.querySelector('#a-ability').value,'Sharpness');
 assert.equal(lastAttacker.speciesName,'Ceruledge');
 assert.equal(lastAttacker.megaForm.name,'Mega Ceruledge');
 assert.equal(lastAttacker.megaRequiredStone,'Ceruledgite');
 assert.ok(calls>=2);
 d.querySelector('#a-mega').click();
 assert.equal(d.querySelector('#a-ability').value,'Flash Fire');
 assert.equal(lastAttacker.megaActive,false);
 assert.equal(lastAttacker.megaForm,null);
});
