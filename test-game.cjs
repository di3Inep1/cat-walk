// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function boot(stored={},withImages=false){
const pen=new Proxy({}, {get:(target,key)=>target[key]??(key==='measureText'?text=>({width:[...text].length*8}):()=>{})});
const elements=new Map(),handlers=new Map(),windowHandlers=new Map();
let elementSequence=0;
function element(id){if(!elements.has(id))elements.set(id,{hidden:id==='selectPanel',textContent:'',style:{},children:[],appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]},classList:{add(){},remove(){}},setAttribute(){},focus(){},getContext:()=>pen,addEventListener(type,fn){handlers.set(id+':'+type,fn)}});return elements.get(id);}
const controls=['ArrowLeft','ArrowRight','Space'].map(key=>Object.assign(element('control-'+key),{dataset:{key},setPointerCapture(){throw new Error('Capture unavailable')}}));
const selection={cleared:false},documentHandlers=new Map();
const context=vm.createContext({document:{getElementById:element,createElement:type=>element(type+(++elementSequence)),querySelectorAll:()=>controls,addEventListener(type,fn){documentHandlers.set(type,fn)}},window:{addEventListener(type,fn){windowHandlers.set(type,fn)},getSelection:()=>({rangeCount:1,removeAllRanges(){selection.cleared=true}})},localStorage:{getItem:key=>stored[key]??null,setItem(key,value){stored[key]=value}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,console});
const imageRequests=[];
if(withImages)context.Image=class {set src(value){this.url=value;imageRequests.push(this)}};
vm.runInContext(fs.readFileSync('game.js','utf8'),context);
const run=code=>vm.runInContext(code,context);
return {context,run,handlers,windowHandlers,documentHandlers,selection,stored,imageRequests};
}
const {context,run,handlers,windowHandlers,selection}=boot();
// Find an actual continuous route using walking and held jumps, no teleporting.
run(`
function snapshot(){return JSON.stringify({cat,boards,fish,checkpoint,time,state,deathDelay,deaths,elapsed,records,runs});}
let testTargets={};
function restore(text){const s=JSON.parse(text);Object.assign(cat,s.cat);boards=s.boards;fish=s.fish;checkpoint=s.checkpoint;time=s.time;state=s.state;deathDelay=s.deathDelay;deaths=s.deaths;elapsed=s.elapsed;records=s.records;runs=s.runs;keys.clear();buffer=0;coyote=.1;jumpHeld=false;}
function solve(index,route=[]){
  const saved=snapshot();
  for(const wait of [0,30,60,90,120,180,240]){
    restore(saved);
    if(wait&&boards[index].fragile)break;
    for(let n=0;n<wait&&!deathDelay;n++)update(STEP);
    if(deathDelay)continue;
    const result=solveAttempt(index,route);if(result)return result;
  }
  restore(saved);return null;
}
function solveAttempt(index,route=[]){
  if(index===exitIndex()){
    keys.add('ArrowRight');
    for(let n=0;n<90&&state==='play';n++)update(STEP);
    return state==='clear'||state==='complete'?route:null;
  }
  const nextIndex=testTargets[index]??level.routeNext[index];
  const saved=snapshot(),b=boards[index],target=boards[nextIndex];
  // Launch positions cover early jumps over thorns and late jumps across gaps.
  for(let launch=Math.max(b.x+5,cat.x);launch<=b.x+b.w-12;launch+=8){
    restore(saved);let failed=false;
    keys.add('ArrowRight');
    for(let n=0;cat.x<launch&&n<150;n++){update(STEP);if(deathDelay>0||!cat.ground){failed=true;break;}}
    if(failed)continue;
    buffer=.12;jumpHeld=true;let airborne=false;
    for(let n=0;n<160;n++){
      if(cat.x>target.x+target.w-48)keys.delete('ArrowRight');
      update(STEP);if(deathDelay>0)break;
      if(!cat.ground)airborne=true;
      if(state==='clear'||state==='complete')return [...route,Math.round(launch)];
      if(airborne&&cat.ground){
        if(Math.abs(cat.y+cat.h-target.y)<.1&&cat.x>=target.x-15){
          const result=solve(nextIndex,[...route,Math.round(launch)]);if(result)return result;
        }break;
      }
    }
  }
  restore(saved);return null;
}
`);

for(let i=0;i<run('LEVELS.length');i++){
  run(`start(${i})`);
  assert.ok(run('W')>1900,'Level must be physically longer, not just renamed');
  assert.ok(run('solve(0)'),'No continuous route in long level '+(i+1));
  assert.equal(run('state'),i===8?'complete':'clear');
  assert.ok(run('cat.x>W-120'),'Only the final end of the long map can finish');
  console.log('Long level '+(i+1)+': '+run('level.width')+' px, '+run('level.route.length')+' main platforms');
  const checks=JSON.parse(run('JSON.stringify(level.checks)'));
  for(const index of checks){
    run(`start(${i});checkpoint=${index};spawn()`);
    assert.ok(run('solve(checkpoint)'),'No checkpoint route: '+i+'/'+index);
  }
}
run('available=new Set([0,3,6]);cleared={};start(0);showLevels()');
assert.equal(run("$('levelGrid').children.length"),3);
assert.equal(run("$('levelGrid').children[1].disabled"),true);
run("$('levelGrid').children[1].onclick()");
assert.equal(run('levelIndex'),0);
run("$('selectPanel').hidden=true;pause();finish()");assert.equal(run('isLevelUnlocked(1)'),true);
assert.equal(run('isLevelUnlocked(4)'),true,'Featured showcase is directly playable');
assert.equal(run('isLevelUnlocked(5)'),false,'Showcase does not unlock its follow-up until completion');
assert.equal(run('isLevelUnlocked(7)'),true,'The mill sample can be played directly');
assert.equal(run('isLevelUnlocked(8)'),false,'Preview access does not unlock the final level');
run('runs={};start(2);elapsed=40;finish();next()');assert.equal(run('levelIndex'),3);assert.equal(run('elapsed'),0);
run('start(5);finish();next()');assert.equal(run('levelIndex'),6);
const migration=run('migrateProgress(7,{8:true,9:true,10:true,16:true},17)');
assert.ok(migration.available.includes(0)&&migration.available.includes(1)&&migration.available.includes(2));
assert.equal(migration.cleared[3],true);assert.equal(migration.continueLevel,6);
assert.ok(!migration.available.includes(7),'Partial first section does not unlock a later long level');
assert.ok(run('migrateProgress(0,{18:true},19).available.includes(7)'),'Old later-stage access is retained');
assert.equal(run('migrateProgress(0,{},0).cleared[0]'),undefined,'Do not invent completion');
assert.equal(run('clampLevel(999)'),8);
run('start(4);checkpoint=boards.findIndex(b=>b.spring);spawn();buffer=.12;jumpHeld=true;update(STEP)');
assert.ok(run('cat.vy')<-680,'Spring boost remains valid after offset');
run('start(6);checkpoint=boards.findIndex(b=>b.ice);spawn();cat.vx=200;update(STEP)');
assert.ok(run('cat.vx')>195);run("keys.add('ArrowLeft');for(let i=0;i<40;i++)update(STEP)");
assert.ok(run('cat.vx')<0,'Ice brakes');
run('start(7);checkpoint=boards.findIndex(b=>b.belt>0);spawn();const beltX=cat.x;update(STEP)');
assert.ok(run('cat.x>beltX'));
run('cat.ground=false;cat.vx=0;cat.y-=100;const airborneX=cat.x;update(STEP)');
assert.equal(run('cat.x===airborneX'),true);
run('start(3);cat.x=level.winds[1].from+20;cat.y=300;cat.ground=false;cat.vx=0;const windX=cat.x;update(STEP)');
assert.ok(run('cat.x>windX'),'Wind follows relocated zones');
run('start(0);cat.x=620;cat.y=355;cat.vx=0;cat.vy=0;cat.ground=true;for(let i=0;i<210;i++)update(STEP)');
assert.equal(run('deaths'),0);assert.equal(run('cat.y+cat.h'),475);
assert.ok(run('solve(level.rescue)'),'Rescue path must lead to the long-level exit');
run('start(0);checkpoint=level.checks[2];spawn();const checkpointX=cat.x;die();for(let i=0;i<60;i++)update(STEP)');
assert.equal(run('cat.x'),run('checkpointX'),'Death returns to latest internal lamp');
run('pause()');const frozen=run('cat.x');run("keys.add('ArrowRight');update(1)");
assert.equal(run('cat.x'),frozen);run('pause()');
run(`
start(0);
const rightButton={dataset:{key:'ArrowRight'},setAttribute(){}};
const jumpButton={dataset:{key:'Space'},setAttribute(){}};
touchDown(rightButton,1);touchDown(jumpButton,2);update(STEP);
`);
assert.ok(run('cat.vx>0&&cat.vy<0'));run('touchUp(2)');
assert.equal(run("keys.has('ArrowRight')"),true);run('touchUp(1)');
assert.equal(run("keys.has('ArrowRight')"),false);
for(const [width,height] of [[1140,641],[844,300],[350,263]]){
  run(`canvas.getBoundingClientRect=()=>({width:${width},height:${height}});resizeView()`);
  for(let levelNumber=0;levelNumber<9;levelNumber++){
    run(`start(${levelNumber})`);
    for(const index of JSON.parse(run('JSON.stringify(level.route)'))){
      run(`checkpoint=${index};spawn();for(let i=0;i<30;i++)updateCamera(STEP)`);
      assert.ok(run('camera.x>=0&&camera.x+camera.w<=W+.01'));
      assert.ok(run('cat.x>=camera.x&&cat.x+cat.w<=camera.x+camera.w'));
      run('cat.ground=false;cat.y-=boards[cat.support].spring?200:116;updateCamera(STEP)');
      assert.ok(run('cat.y>=camera.y'),'High jump remains visible');
    }
  }
}
assert.equal(run('LEVELS.filter(item=>item.refined).length'),8);
for(let i=0;i<9;i++){
  run(`start(${i})`);
  assert.equal(run('level.sections.length'),4,'Each route has four authored sections');
  assert.ok(run('level.checks.every(i=>!boards[i].fragile&&!boards[i].ice&&!boards[i].belt)'),
    'Lamps provide stable places to restart');
  assert.ok(run('level.checks.every(i=>level.route.includes(i))'),'Every lamp is on the main route');
}
run('start(0)');
assert.equal(run('boards.slice(0,6).filter(b=>b.fragile||b.spring||b.ice||b.belt).length'),1,
  'Opening teaches only the single collapsing bridge');
run('start(1);testTargets={4:level.route.length}');
assert.ok(run('solve(0)'),'Optional orchard detour rejoins a continuous route to the exit');
run("start(1);checkpoint=level.route.length;spawn();keys.add('ArrowRight');for(let i=0;i<20;i++)update(STEP);keys.clear()");
assert.equal(run('fish[fish.length-2].got'),true,'Optional orchard fish can be collected');
assert.ok(run('solve(level.route.length)'),'Collecting the bonus leaves a route back to the exit');
run("start(1);checkpoint=level.route.length+1;spawn();keys.add('ArrowRight');for(let i=0;i<20;i++)update(STEP);keys.clear()");
assert.equal(run('fish[fish.length-1].got'),true,'The second roof reward is collectible');
assert.ok(run('solve(level.route.length+1)'),'The upper route rejoins the main path');
run('testTargets={}');
for(let i=0;i<9;i++)run(`start(${i});draw()`);
run('start(4)');
assert.equal(run('level.showcase'),true);
assert.equal(run('level.sections.length'),4);
assert.equal(run('boards.filter(b=>b.spring).length'),2);
assert.ok(run('level.checks.includes(6)&&level.checks.includes(11)'),'Both high jumps have a nearby checkpoint');
for(const i of [6,11]){
  run(`checkpoint=${i};spawn();buffer=.12;jumpHeld=true;for(let n=0;n<45;n++)update(STEP)`);
  assert.ok(run(`cat.y+cat.h<boards[${i+1}].y`),'High bridge is reachable from pad');
}
run('start(0)');
let nativePrevented=false;
const finger={pointerId:55,pointerType:'touch',button:0,cancelable:true,preventDefault(){nativePrevented=true;}};
handlers.get('control-ArrowRight:pointerdown')(finger);
assert.equal(nativePrevented,true);assert.equal(selection.cleared,true);
assert.equal(run("keys.has('ArrowRight')"),true,'Capture failure must not break input');
windowHandlers.get('pointerup')(finger);
assert.equal(run("keys.has('ArrowRight')"),false,'Release outside button clears input');
for(const key of ['app:selectstart','app:dragstart','control-ArrowRight:touchstart','control-ArrowRight:touchmove','control-ArrowRight:contextmenu']){
  nativePrevented=false;handlers.get(key)(finger);assert.equal(nativePrevented,true,key+' cancels native gesture');
}
const stored={};context.localStorage.setItem=(key,value)=>{stored[key]=value;};
run("state='menu';available=new Set([0,1,3,6]);cleared={0:true};continueLevel=1;save()");
assert.equal(JSON.parse(stored['tiny-trouble-long-v1']).continueLevel,1);
assert.ok(!('tiny-trouble-cleared' in stored),'Legacy progress must not be overwritten');
// Reload the entire game to exercise browser persistence through the normal entry points.
const session=boot();
session.run(`start(1);available.add(1);
cat.x=boards[2].x+25;cat.y=boards[2].y-cat.h-1;cat.vy=60;cat.ground=false;
for(let n=0;n<5;n++)update(STEP);`);
assert.equal(session.run('checkpoint'),2,'Landing on a lamp saves it');
session.run('cat.x=fish[0].x-12;cat.y=fish[0].y-15;cat.vy=0;update(STEP);elapsed=37.2;deaths=2;pause()');
const reload=boot(session.stored);
assert.equal(reload.run('checkpoint'),2);
assert.equal(reload.run('state'),'menu');
reload.run('next()');
assert.equal(reload.run('cat.support'),2);
assert.equal(reload.run('elapsed'),37.2);
assert.equal(reload.run('deaths'),2);
assert.equal(reload.run('fish[0].got'),true);
assert.equal(reload.run('keys.size'),0);
assert.equal(reload.run('jumpHeld'),false);
reload.run('start(3);start(1,true)');
assert.equal(reload.run('checkpoint'),2,'Switching chapters preserves the previous run');
reload.run('finish()');
assert.equal(reload.run('records[1].bestTime'),37.2);
assert.equal(reload.run('records[1].bestDeaths'),2);
assert.equal(reload.run('resumableRun(1)'),null,'Completion removes the suspended run');
reload.run('start(1);elapsed=50;deaths=0;fish[1].got=true;finish()');
assert.equal(reload.run('records[1].bestTime'),37.2,'Slower run keeps the best time');
assert.equal(reload.run('records[1].bestDeaths'),0,'Least falls is an independent record');
assert.equal(reload.run('records[1].fish.length'),2,'Collections accumulate across runs');
reload.run('start(1);elapsed=20;deaths=3;finish();finish()');
assert.equal(reload.run('records[1].bestTime'),20);
assert.equal(reload.run('records[1].bestDeaths'),0);
reload.run('start(4);checkpoint=6;elapsed=10;save();pause();');
reload.run("$('secondary').onclick()");
assert.equal(reload.run('levelIndex'),4,'Restart acts on the current level');
assert.equal(reload.run('checkpoint'),-1);
assert.equal(reload.run('elapsed'),0);
reload.run("touchDown({dataset:{key:'ArrowRight'},setAttribute(){}},8);touchDown({dataset:{key:'Space'},setAttribute(){}},9)");
reload.context.document.hidden=true;
reload.documentHandlers.get('visibilitychange')();
assert.equal(reload.run('state'),'pause');
assert.equal(reload.run('keys.size+touchPointers.size'),0,'Backgrounding releases every finger');
reload.run('pause();elapsed=22');
reload.windowHandlers.get('pagehide')();
assert.equal(boot(reload.stored).run('elapsed'),22,'Page exit saves the latest counters');
const bad=JSON.parse(reload.stored['tiny-trouble-long-v1']);
bad.runs[4].checkpoint=999;
const invalid=boot({'tiny-trouble-long-v1':JSON.stringify(bad)});
assert.equal(invalid.run('checkpoint'),-1,'Invalid checkpoints fall back to the start');
assert.equal(invalid.run('records[1].bestTime'),20,'Bad run data does not destroy records');
bad.runs[4].checkpoint=6;bad.runs[4].revision='old layout';
assert.equal(boot({'tiny-trouble-long-v1':JSON.stringify(bad)}).run('checkpoint'),-1);
const old=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,1,3,6],cleared:{0:true},continueLevel:1})});
assert.equal(old.run('continueLevel'),1);
assert.equal(old.run('cleared[0]'),true);
assert.equal(old.run('Object.keys(records).length'),0,'Old clears do not invent scores');
assert.equal(boot({'tiny-trouble-long-v1':'broken json'}).run('levelIndex'),0);
// Passing through a sign changes its opacity, never its world position.
const labels=boot();
labels.run(`start(6);camera.x=0;camera.y=0;camera.w=640;camera.h=360;camera.cssWidth=640;
sceneLabels=[];sceneLabel('第二段屋脊 →',160,220,{important:true});
const labelDraws=[];ctx.fillText=(text,x,y)=>labelDraws.push({text,x,y,alpha:ctx.globalAlpha});
cat.x=20;cat.y=300;drawSceneLabels();`);
const fixedLabel=JSON.parse(labels.run('JSON.stringify(labelDraws.at(-1))'));
labels.run('cat.x=170;cat.y=190;for(let n=0;n<15;n++)drawSceneLabels()');
assert.ok(labels.run('labelDraws.at(-1).alpha')<.15,'The sign fades when the cat crosses it');
labels.run('cat.x=20;cat.y=300;for(let n=0;n<15;n++)drawSceneLabels()');
assert.ok(labels.run('labelDraws.at(-1).alpha')>.95,'The sign returns after the cat leaves');
labels.run('camera.x=60;camera.y=12;drawSceneLabels()');
for(const label of JSON.parse(labels.run('JSON.stringify(labelDraws)'))){
  assert.equal(label.x,fixedLabel.x,'Neither jumping nor the camera can push the sign sideways');
  assert.equal(label.y,fixedLabel.y,'Neither jumping nor the camera can push the sign upwards');
}
labels.run('start(6)');
assert.equal(labels.run('sceneLabelOpacity.size'),0,'Restart clears the previous sign fade');
const blocked=boot();
blocked.context.localStorage.setItem=()=>{throw new Error('Storage blocked')};
blocked.run('start(0);pause()');
assert.equal(blocked.run("$('saveNote').textContent.includes('无法保存')"),true);
const painted=boot({},true);
assert.equal(painted.run("$('primary').disabled"),true);
painted.run('next()');
assert.equal(painted.run('state'),'menu','The menu waits for illustrations');
assert.equal(painted.imageRequests.length,4,'Startup loads only shared art and the current chapter');
painted.imageRequests[0].onload();painted.imageRequests[1].onload();
assert.equal(painted.run('illustrationLoading'),true);
for(const img of painted.imageRequests.slice(2))img.onload();
assert.equal(painted.run("$('primary').disabled"),false);
painted.run('next()');
assert.equal(painted.run('state'),'play');
for(let i=0;i<9;i++){
  const previous=painted.imageRequests.length;
  painted.run(`start(${i})`);
  for(const img of painted.imageRequests.slice(previous))img.onload();
  painted.run('draw();cat.vx=240;time=1;draw();cat.ground=false;cat.vy=-400;draw();cat.vy=200;draw()');
}
assert.equal(painted.imageRequests.length,13,'Each illustration is loaded once across all chapters');
painted.run('const nightImages=[];ctx.drawImage=(...args)=>nightImages.push(args);camera.x=0;drawPaintedBackdrop();camera.x=W-camera.w;drawPaintedBackdrop()');
assert.equal(painted.run('nightImages.length'),2,'A single moon panorama is drawn at either map edge');
assert.equal(painted.run('nightImages.every(args=>Math.abs(args[3]/args[4]-1.5)<.001)'),true,'The moon retains its round shape');
const switching=boot({},true);
for(const img of switching.imageRequests)img.onload();
switching.run('start(6);update(1);down("ArrowRight");touchDown({dataset:{key:"Space"},setAttribute(){}},1)');
assert.equal(switching.run('elapsed'),0,'Loading time is excluded from the run');
assert.equal(switching.run('keys.size+touchPointers.size'),0,'Loading cannot leave movement held');
assert.equal(switching.run("$('artLoading').hidden"),false);
switching.run('start(0)');
assert.equal(switching.run('illustrationLoading'),false,'A cached chapter is immediately playable');
for(const img of switching.imageRequests.slice(4))img.onload();
assert.equal(switching.run('levelIndex'),0,'Late images cannot switch the current chapter');
assert.equal(switching.run('illustrationLoading'),false);
switching.run('start(6)');
assert.equal(switching.imageRequests.length,8,'Returning to a chapter uses the loaded assets');
const moonStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:6})},true);
assert.equal(moonStart.imageRequests.length,7,'Direct rooftop entry loads shared art and its four images');
assert.ok(moonStart.imageRequests.every(img=>!img.url.includes('forest')&&!img.url.includes('harbor')));
const millStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:7})},true);
assert.equal(millStart.imageRequests.length,5,'The mill loads only shared art and two indoor assets');
assert.ok(millStart.imageRequests.every(img=>!img.url.includes('rooftop')&&!img.url.includes('harbor')));
for(const img of millStart.imageRequests)img.onload();
millStart.run('next();checkpoint=6;spawn();const startMillX=cat.x;update(STEP)');
assert.ok(millStart.run('cat.x<startMillX'),'The return conveyor carries a standing cat left');
millStart.run('cat.ground=false;cat.y-=90;const jumpMillX=cat.x;update(STEP)');
assert.equal(millStart.run('cat.x'),millStart.run('jumpMillX'),'A jump leaves the return conveyor');
const oldPage=boot({},true),oldLookup=oldPage.context.document.getElementById;
oldPage.context.document.getElementById=id=>id==='artLoading'?null:oldLookup(id);
assert.doesNotThrow(()=>{for(const img of oldPage.imageRequests)img.onload();oldPage.run('start(6)')},'A cached older page can load the updated game script');
const missingArt=boot({},true);
for(const img of missingArt.imageRequests)img.onerror();
missingArt.run('next();draw()');
assert.equal(missingArt.run('state'),'play','Failed images retain a playable fallback');
assert.equal(missingArt.run("$('assetStatus').hidden"),false);
console.log('PASS: 9 routes, every lamp, orchard detour, camera, reload/resume, per-level records, legacy saves and mobile lifecycle');

