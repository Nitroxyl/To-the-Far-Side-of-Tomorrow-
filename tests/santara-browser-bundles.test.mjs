import test from 'node:test';
import assert from 'node:assert/strict';
import {createContext,runInContext} from 'node:vm';

test('pinned browser CDN scripts expose a working calc global',async()=>{
  const scope={console};
  scope.window=scope;
  scope.self=scope;
  scope.globalThis=scope;
  const context=createContext(scope);
  const urls=[
    'https://cdn.jsdelivr.net/npm/@smogon/calc@0.12.0/dist/data/production.min.js',
    'https://cdn.jsdelivr.net/npm/@smogon/calc@0.12.0/dist/production.min.js'
  ];
  for(const url of urls){
    const response=await fetch(url,{signal:AbortSignal.timeout(25000)});
    assert.ok(response.ok,url+' returned HTTP '+response.status);
    const script=await response.text();
    assert.ok(script.length>1000,url+' returned an unexpectedly empty bundle');
    runInContext(script,context,{timeout:30000,filename:url});
  }
  assert.equal(typeof scope.calc?.calculate,'function');
  assert.equal(typeof scope.calc?.Pokemon,'function');
  assert.equal(typeof scope.calc?.Move,'function');
  assert.equal(typeof scope.calc?.Generations?.get,'function');
  const gen=scope.calc.Generations.get(9);
  const result=scope.calc.calculate(gen,
    new scope.calc.Pokemon(gen,'Charizard',{level:50}),
    new scope.calc.Pokemon(gen,'Scizor',{level:50}),
    new scope.calc.Move(gen,'Flamethrower'));
  assert.ok(result.range()[0]>0);
});
