// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function boot(stored={},withImages=false,withAudio=true){
const pen=new Proxy({}, {get:(target,key)=>target[key]??(key==='measureText'?text=>({width:[...text].length*8}):()=>{})});
const elements=new Map(),handlers=new Map(),windowHandlers=new Map();
let elementSequence=0;
function element(id){if(!elements.has(id))elements.set(id,{hidden:id==='selectPanel',textContent:'',style:{},children:[],appendChild(child){this.children.push(child)},replaceChildren(){this.children=[]},classList:{add(){},remove(){}},setAttribute(){},focus(){},getContext:()=>pen,addEventListener(type,fn){handlers.set(id+':'+type,fn)}});return elements.get(id);}
const controls=['ArrowLeft','ArrowRight','Space'].map(key=>Object.assign(element('control-'+key),{dataset:{key},setPointerCapture(){throw new Error('Capture unavailable')}}));
const selection={cleared:false},documentHandlers=new Map();
const context=vm.createContext({document:{getElementById:element,createElement:type=>element(type+(++elementSequence)),querySelectorAll:()=>controls,addEventListener(type,fn){documentHandlers.set(type,fn)}},window:{addEventListener(type,fn){windowHandlers.set(type,fn)},getSelection:()=>({rangeCount:1,removeAllRanges(){selection.cleared=true}})},localStorage:{getItem:key=>stored[key]??null,setItem(key,value){stored[key]=value}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Math,console});
const imageRequests=[];
if(withImages)context.Image=class {set src(value){this.url=value;imageRequests.push(this)}};
if(withAudio)vm.runInContext(fs.readFileSync('audio.js','utf8'),context);
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
assert.equal(painted.imageRequests.length,5,'Startup loads only shared art and the current chapter');
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
assert.equal(painted.run('nightImages.length'),2,'The exterior uses one panorama at either map edge');
assert.equal(painted.run('nightImages.every(args=>Math.abs(args[3]/args[4]-1.5)<.001)'),true,'The painted exterior retains its proportions');
assert.equal(painted.run('nightImages.every(args=>args[2]<=0&&args[2]+args[4]>=H)'),true,'Raised scenery still covers the full vertical world');
const switching=boot({},true);
for(const img of switching.imageRequests)img.onload();
switching.run('start(6);update(1);down("ArrowRight");touchDown({dataset:{key:"Space"},setAttribute(){}},1)');
assert.equal(switching.run('elapsed'),0,'Loading time is excluded from the run');
assert.equal(switching.run('keys.size+touchPointers.size'),0,'Loading cannot leave movement held');
assert.equal(switching.run("$('artLoading').hidden"),false);
switching.run('start(0)');
assert.equal(switching.run('illustrationLoading'),false,'A cached chapter is immediately playable');
for(const img of switching.imageRequests.slice(5))img.onload();
assert.equal(switching.run('levelIndex'),0,'Late images cannot switch the current chapter');
assert.equal(switching.run('illustrationLoading'),false);
switching.run('start(6)');
assert.equal(switching.imageRequests.length,7,'Returning to a chapter uses the loaded assets');
const moonStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:6})},true);
assert.equal(moonStart.imageRequests.length,6,'The approach loads shared art and two exterior images');
assert.ok(moonStart.imageRequests.every(img=>!img.url.includes('forest')&&!img.url.includes('harbor')));
assert.ok(moonStart.imageRequests.every(img=>!img.url.includes('rooftop')&&!img.url.includes('sliding-eave')),'The approach no longer loads the old city roof assets');
const attic=boot({},true);
for(const img of attic.imageRequests)img.onload();
attic.run('start(8)');
for(const img of attic.imageRequests.slice(5))img.onload();
assert.equal(attic.imageRequests.length,9,'The final journey reuses mill art and loads its exterior');
assert.equal(attic.run('boards.filter(b=>b.ice).every(b=>!isMillRoom(b.x)&&!isMillRoom(b.x+b.w))'),true,'Frost only appears outdoors');
assert.equal(attic.run('boards.filter(b=>b.belt).every(b=>isMillRoom(b.x)&&isMillRoom(b.x+b.w))'),true,'Every conveyor fits completely inside the mill room');
attic.run('checkpoint=5;spawn();update(STEP)');
assert.equal(attic.run('soundscape.scene'),'mill','Crossing inside switches to the mill ambience');
assert.equal(attic.run('surfaceMaterial(boards[5])'),'wood');
attic.run('lessonSeen.clear();hud()');
assert.equal(attic.run("$('hint').textContent"),attic.run('level.sections[1].hint'),'A resumed checkpoint describes its current room');
attic.run('checkpoint=11;spawn();update(STEP)');
assert.equal(attic.run('soundscape.scene'),'roof','Leaving the room restores the outdoor ambience');
assert.equal(attic.run('surfaceMaterial(boards[10])'),'wood','The cracked bridge is an old wooden beam');
attic.run('const journeyDraws=[];ctx.drawImage=(...args)=>journeyDraws.push(args);drawBoard(boards[6],6);drawBoard(boards[10],10)');
assert.equal(attic.run('journeyDraws.some(args=>args[0]===illustrations.millEnvironment&&args[1]===512)'),true,'The conveyor uses a real canvas machine');
assert.equal(attic.run('journeyDraws.some(args=>args[0]===illustrations.millExterior&&args[1]===1024)'),true,'The old beam uses the cracked wood art');
const millStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:7})},true);
assert.equal(millStart.imageRequests.length,7,'The mill loads only shared art and its three indoor assets');
assert.ok(millStart.imageRequests.every(img=>!img.url.includes('rooftop')&&!img.url.includes('harbor')));
for(const img of millStart.imageRequests)img.onload();
millStart.run('next();checkpoint=6;spawn();const startMillX=cat.x;update(STEP)');
assert.ok(millStart.run('cat.x<startMillX'),'The return conveyor carries a standing cat left');
millStart.run('cat.ground=false;cat.y-=90;const jumpMillX=cat.x;update(STEP)');
assert.equal(millStart.run('cat.x'),millStart.run('jumpMillX'),'A jump leaves the return conveyor');
const oldPage=boot({},true,false),oldLookup=oldPage.context.document.getElementById;
const audioLifecycle=boot();
audioLifecycle.run("start(7);state='clear';syncAudio()");
assert.equal(audioLifecycle.run('soundscape.effectsAllowed'),true,'The result screen can play its finish cue');
audioLifecycle.context.document.hidden=true;
audioLifecycle.documentHandlers.get('visibilitychange')();
assert.equal(audioLifecycle.run('soundscape.effectsAllowed'),false,'Backgrounding also silences a result-screen cue');
audioLifecycle.context.document.hidden=false;
audioLifecycle.run('start(7);showLevels()');
assert.equal(audioLifecycle.run('soundscape.active||soundscape.effectsAllowed'),false,'The chapter picker is quiet');
audioLifecycle.run("$('selectPanel').hidden=true;pause()");
assert.equal(audioLifecycle.run('soundscape.active'),true,'A gesture resumes the mill soundscape');
audioLifecycle.windowHandlers.get('pagehide')();
assert.equal(audioLifecycle.run('soundscape.active||soundscape.effectsAllowed'),false,'Leaving the page stops every sound bus');
// Animation and grounding must describe the real body without moving it.
const feedback=boot({},true);
for(const img of feedback.imageRequests)img.onload();
feedback.run('start(7)');
for(const img of feedback.imageRequests.slice(5))img.onload();
feedback.run('checkpoint=2;spawn();const bodyBefore=JSON.stringify(cat);catMotion.idle=2.68;drawCat()');
assert.equal(feedback.run('JSON.stringify(cat)'),feedback.run('bodyBefore'),'Rendering cannot shift the hitbox');
assert.equal(feedback.run('catPresentation().sheet'), 'catFeedback');
assert.equal(feedback.run('catPresentation().frame'),0,'A settled cat blinks');
feedback.run('down("ArrowRight");for(let i=0;i<10;i++)update(STEP)');
assert.equal(feedback.run('catMotion.idle'),0,'Movement immediately cancels idle poses');
feedback.run('up("ArrowRight");update(STEP);update(STEP)');
assert.equal(feedback.run('catPresentation().frame'),1,'Releasing movement produces a braking pose');
feedback.run('checkpoint=2;spawn();buffer=.12;jumpHeld=true;update(STEP)');
assert.ok(feedback.run('cat.vy<-500&&!cat.ground'),'New launch visuals must not delay a jump');
feedback.run('checkpoint=2;spawn()');
assert.equal(feedback.run('catContactSurface().y'),feedback.run('boards[2].y'));
feedback.run('cat.x=boards[2].x+boards[2].w+4');
assert.equal(feedback.run('catContactSurface()'),undefined,'A gap cannot cast a false landing shadow');
feedback.run('checkpoint=2;spawn();boards[2].crack=2');
assert.equal(feedback.run('catContactSurface()'),undefined,'A vanished bridge cannot cast a landing shadow');
feedback.run('start(7);checkpoint=2;spawn();cat.x=boards[2].x+100;const momentStartX=cat.x;update(STEP)');
assert.equal(feedback.run('millMoment.warned'),true,'The bell has an approach cue before the first conveyor');
assert.equal(feedback.run('millMoment.rung'),false);
feedback.run('checkpoint=3;spawn();update(STEP)');
assert.equal(feedback.run('millMoment.rung'),true);
assert.equal(feedback.run('deaths'),0,'The bell is a harmless surprise');
const momentAge=feedback.run('millMoment.age');
feedback.run('pause();update(1)');
assert.equal(feedback.run('millMoment.age'),momentAge,'Pause freezes the bell animation');
feedback.run('pause();spawn();update(STEP)');
assert.ok(feedback.run('millMoment.rung&&millMoment.age>0'),'Respawning does not repeat the bell surprise');
feedback.run('start(7)');
assert.equal(feedback.run('millMoment.rung'),false,'A deliberate restart can replay the moment');
feedback.run('camera.w=370;camera.h=277.5;camera.cssWidth=352;checkpoint=2;spawn();cat.x=boards[2].x+150;camera.snap=true;updateCamera(0);sceneLabels=[];const bellText=[];ctx.fillText=(text,x,y)=>bellText.push({text,alpha:ctx.globalAlpha});drawMillBell();drawSceneLabels()');
assert.ok(feedback.run('bellText.find(item=>item.text.includes("打盹")).alpha>.9'),'The approach cue is fully readable in a phone viewport');
feedback.run('checkpoint=3;spawn();cat.x=boards[3].x+70;millMoment.rung=true;millMoment.age=.25;camera.snap=true;updateCamera(0);sceneLabels=[];drawMillBell();drawSceneLabels()');
assert.ok(feedback.run('bellText.find(item=>item.text.includes("叫醒")).alpha>.9'),'The payoff stays inside the phone viewport too');
feedback.run('start(7);checkpoint=2;spawn();const millDraws=[];ctx.drawImage=(...args)=>millDraws.push({args,alpha:ctx.globalAlpha});drawMillLandmarks()');
const hopperDraw=feedback.run('millDraws.find(d=>d.args[1]===0&&d.args[2]===512)');
assert.ok(hopperDraw.args[6]>feedback.run('boards[2].y')+25,'The decorative hopper remains below the playable deck');
assert.ok(hopperDraw.alpha<.7,'Lower machinery belongs to the quieter background');
oldPage.context.document.getElementById=id=>id==='artLoading'?null:oldLookup(id);
assert.doesNotThrow(()=>{for(const img of oldPage.imageRequests)img.onload();oldPage.run('start(6)')},'A cached older page can load the updated game script');
const missingArt=boot({},true);
for(const img of missingArt.imageRequests)img.onerror();
missingArt.run('next();draw()');
assert.equal(missingArt.run('state'),'play','Failed images retain a playable fallback');
assert.equal(missingArt.run("$('assetStatus').hidden"),false);
console.log('PASS: 9 routes, every lamp, orchard detour, camera, reload/resume, per-level records, legacy saves and mobile lifecycle');

