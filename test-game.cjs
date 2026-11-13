// Run the real game logic with a minimal DOM, without replacing its physics.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function boot(stored={},withImages=false,withAudio=true){
const pen=new Proxy({}, {get:(target,key)=>target[key]??(key==='measureText'?text=>({width:[...text].length*8}):key==='createLinearGradient'||key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{})});
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
let testStop=-1;
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
  if(index===testStop)return route;
  if(index===exitIndex()){
    keys.add('ArrowRight');
    for(let n=0;n<600&&state==='play';n++)update(STEP);
    return state==='clear'||state==='complete'?route:null;
  }
  const nextIndex=testTargets[index]??level.routeNext[index];
  const saved=snapshot(),b=boards[index],target=boards[nextIndex];
  // Adjacent gallery decks and lower paths should be walked, not forced into jumps.
  if(target.y>=b.y&&target.x-b.x-b.w<=80){
    keys.add('ArrowRight');
    for(let n=0;n<600&&!deathDelay;n++){
      if(cat.x>target.x+target.w-48)keys.delete('ArrowRight');
      update(STEP);
      if(state==='clear'||state==='complete')return [...route,'walk'];
      if(cat.ground&&cat.support===nextIndex){
        const result=solve(nextIndex,[...route,'walk']);if(result)return result;break;
      }
      if(cat.ground&&cat.support!==index)break;
    }
    restore(saved);
  }
  // Launch positions cover early jumps over thorns and late jumps across gaps.
  for(let launch=Math.max(b.x+5,cat.x);launch<=b.x+b.w-12;launch+=8){
    restore(saved);let failed=false;
    keys.add('ArrowRight');
    for(let n=0;cat.x<launch&&n<600;n++){update(STEP);if(deathDelay>0||!cat.ground){failed=true;break;}}
    if(failed)continue;
    buffer=.12;jumpHeld=true;let airborne=false;
    for(let n=0;n<160;n++){
      if(cat.x>target.x+target.w-48)keys.delete('ArrowRight');
      update(STEP);if(deathDelay>0)break;
      if(!cat.ground)airborne=true;
      if(state==='clear'||state==='complete')return [...route,Math.round(launch)];
      if(airborne&&cat.ground){
        if(cat.support===nextIndex){
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
  assert.ok(run('cat.support===exitIndex()&&cat.x>(level.finishX??boards[exitIndex()].x+24)'),'Only the authored final exit can finish');
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
assert.ok(run('cat.vx')>195);run("keys.add('ArrowLeft');for(let i=0;i<110;i++)update(STEP)");
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
  assert.ok(run('level.sections.length>=4'),'Each route has authored teaching and rest sections');
  assert.ok(run('level.checks.every(i=>!boards[i].fragile&&!boards[i].ice&&!boards[i].belt)'),
    'Lamps provide stable places to restart');
  assert.ok(run('level.checks.every(i=>level.route.includes(i))'),'Every lamp is on the main route');
}
run('start(0)');
assert.equal(run('boards.slice(0,6).filter(b=>b.fragile||b.spring||b.ice||b.belt).length'),1,
  'Opening teaches only the single collapsing bridge');
assert.equal(run('boards.filter(b=>b.fragile).length'),1,'The whole first level teaches one collapsing bridge');
for(const [index,from,to] of [[0,4,6],[0,9,13],[1,4,6],[2,4,6]]){
  run(`start(${index});checkpoint=${from};spawn();keys.add('ArrowRight');var calmAirborne=false;
    for(let n=0;n<900&&cat.x<boards[${to}].x+boards[${to}].w-65;n++){update(STEP);if(!cat.ground)calmAirborne=true;}
    keys.clear();`);
  assert.equal(run('cat.support'),to,'Each designed rest stretch can be walked to its end');
  assert.equal(run('calmAirborne||deaths>0'),false,'Rest stretches contain no surprise jumps or timed danger');
  if(index===1)assert.equal(run('fish[3].got||fish[4].got'),false,'The lower orchard route bypasses the optional roof rewards');
}
run('start(1);checkpoint=4;spawn();testTargets={4:level.route.length};testStop=level.route.length');
assert.ok(run('solve(4)'),'The first optional roof is reachable from the fork lamp');
run("keys.add('ArrowRight');for(let n=0;n<120&&cat.x<fish[3].x-12;n++)update(STEP);keys.clear()");
assert.equal(run('fish[3].got'),true,'The first roof reward can be collected after a real approach jump');
run('testTargets={};testStop=level.route.length+1');
assert.ok(run('solve(level.route.length)'),'The second roof follows a playable jump from the first reward');
run("keys.add('ArrowRight');for(let n=0;n<120&&cat.x<fish[4].x-12;n++)update(STEP);keys.clear()");
assert.equal(run('fish[4].got'),true,'The second roof reward is collectible while continuing forward');
run('testStop=-1');
assert.ok(run('solve(level.route.length+1)'),'The upper orchard route rejoins the main path and reaches the exit');
for(const phase of [0,.6,1.2,1.8]){
  run(`start(1);checkpoint=10;spawn();time=${phase};keys.add('ArrowRight');
    for(let n=0;n<180&&cat.x<boards[10].x+boards[10].w-25;n++)update(STEP);
    buffer=.12;jumpHeld=false;var tookOff=false;
    for(let n=0;n<120&&!deathDelay;n++){update(STEP);if(!cat.ground)tookOff=true;if(tookOff&&cat.ground)break;}`);
  assert.equal(run('cat.support'),11,'A deliberate small jump passes below the first red fruit at several phases');
  assert.equal(run('deaths'),0);
}
run('start(2)');
assert.ok(run('level.saws.every(s=>s.x+s.range+s.r<boards[9].x-100)'),'The fruit encounter ends before the final bridge lamp');
run('testTargets={}');
run('notice("上一关留下的提示");start(0)');
assert.equal(run("$('notice').textContent"),'','Changing levels clears stale instructions from the previous route');
// The mill offers real recovery and a choice that can be played from one lamp.
for(const shortJump of [false,true]){
  run(`start(7);checkpoint=3;spawn();keys.add('ArrowRight');${shortJump?'buffer=.12;jumpHeld=false;':''}
    for(let n=0;n<360&&cat.support!==level.recovery.catchDeck&&!deathDelay;n++)update(STEP);
    keys.clear();`);
  assert.equal(run('cat.support'),run('level.recovery.catchDeck'),'A walk-off or early short jump is caught below the first conveyor');
  assert.equal(run('deaths'),0,'The first conveyor teaches without charging a death for this mistake');
  assert.ok(run('solve(level.recovery.catchDeck)'),'The lower repair steps return to a complete route');
}
run('start(7);checkpoint=5;spawn();testStop=9');
assert.ok(run('solve(5)'),'The lower choice reaches the shared lamp');
assert.equal(run('fish[0].got'),false,'The main route does not require the high-shelf reward');
assert.equal(run('checkpoint'),9);
run('start(7);checkpoint=5;spawn();testTargets={5:level.choice.upper[0]};testStop=level.choice.upper[1]');
assert.ok(run('solve(5)'),'The optional upper conveyor and fish shelf are reachable from the fork lamp');
assert.equal(run('cat.support'),run('level.choice.upper[1]'));
run("keys.add('ArrowRight');for(let n=0;n<90&&cat.x<fish[0].x-12;n++)update(STEP);keys.clear()");
assert.equal(run('fish[0].got'),true,'The high shelf reward can be collected while standing on its real deck');
run('pause()');
const choiceReload=boot({'tiny-trouble-long-v1':context.localStorage.getItem('tiny-trouble-long-v1')});
assert.equal(choiceReload.run('checkpoint'),5,'Reloading from the optional shelf returns to the fork lamp');
assert.equal(choiceReload.run('fish[0].got'),true,'Reloading keeps the optional fish already earned');
run('pause()');
run('testTargets={};testStop=-1');
assert.ok(run('solve(level.choice.upper[1])'),'The reward route safely rejoins the main path and reaches the exit');
run('start(7);checkpoint=11;spawn();keys.add("ArrowRight");for(let n=0;n<700&&state==="play";n++)update(STEP)');
assert.equal(run('state'),'clear','After the final long jump, the warm gallery can be walked to the exit');
assert.equal(run('deaths'),0);
assert.equal(run('cat.vx'),0,'The cat settles at the warm exit rather than freezing in a running pose');
run('start(7);canvas.getBoundingClientRect=()=>({width:844,height:300});resizeView();checkpoint=3;spawn();updateCamera(0)');
assert.ok(run('camera.y+camera.h>boards[level.recovery.catchDeck].y+10'),'The first conveyor shows its lower safety deck before takeoff');
run('checkpoint=5;spawn();updateCamera(0)');
assert.ok(run('boards[level.choice.upper[0]].y>camera.y+30&&boards[level.choice.lower[0]].y<camera.y+camera.h-30'),'The fork reveals both vertical choices in a phone view');
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
assert.equal(painted.imageRequests.length,21,'Each illustration is loaded once across all chapters');
painted.run('const nightImages=[];ctx.drawImage=(...args)=>nightImages.push(args);camera.x=0;drawPaintedBackdrop();camera.x=W-camera.w;drawPaintedBackdrop()');
assert.ok(painted.run('nightImages.some(args=>args[0]===illustrations.millCourtyard)&&nightImages.some(args=>args[0]===illustrations.millHomeward)'),'The final journey moves from the mill courtyard to the homeward valley');
assert.equal(painted.run('nightImages.every(args=>Math.abs((args.length===5?args[3]/args[4]:args[7]/args[8])-1.5)<.001)'),true,'The painted exterior retains its proportions');
assert.equal(painted.run('nightImages.every(args=>{const y=args.length===5?args[2]:args[6],h=args.length===5?args[4]:args[8];return y<=0&&y+h>=H})'),true,'Raised scenery still covers the full vertical world');
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
assert.equal(switching.imageRequests.length,8,'Returning to a chapter uses the loaded assets');
const moonStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:6})},true);
assert.equal(moonStart.imageRequests.length,7,'The approach loads shared art and three exterior images');
assert.ok(moonStart.imageRequests.every(img=>!img.url.includes('forest')&&!img.url.includes('harbor')));
assert.ok(moonStart.imageRequests.every(img=>!img.url.includes('rooftop')&&!img.url.includes('sliding-eave')),'The approach no longer loads the old city roof assets');
const attic=boot({},true);
for(const img of attic.imageRequests)img.onload();
attic.run('start(8)');
for(const img of attic.imageRequests.slice(5))img.onload();
assert.equal(attic.imageRequests.length,13,'The final journey reuses the attic and courtyard art and loads its homeward exterior and cutaway roof');
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
attic.run('const journeyDraws=[];ctx.drawImage=(...args)=>journeyDraws.push(args);camera.x=boards[6].x;drawBoard(boards[6],6);camera.x=boards[10].x;drawBoard(boards[10],10)');
assert.equal(attic.run('journeyDraws.some(args=>args[0]===illustrations.millEnvironment&&args[1]===512)'),true,'The conveyor uses a real canvas machine');
assert.equal(attic.run('journeyDraws.some(args=>args[0]===illustrations.millExterior&&args[1]===1024)'),true,'The old beam uses the cracked wood art');
const millStart=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6],continueLevel:7})},true);
assert.equal(millStart.imageRequests.length,10,'The mill loads only shared art and its six indoor assets');
assert.ok(millStart.imageRequests.every(img=>!img.url.includes('rooftop')&&!img.url.includes('harbor')));
for(const img of millStart.imageRequests)img.onload();
millStart.run('next();checkpoint=8;spawn();const startMillX=cat.x;update(STEP)');
assert.ok(millStart.run('cat.x<startMillX'),'The return conveyor carries a standing cat left');
millStart.run('cat.ground=false;cat.y-=90;const jumpMillX=cat.x;update(STEP)');
assert.equal(millStart.run('cat.x'),millStart.run('jumpMillX'),'A jump leaves the return conveyor');
const roomFailure=boot({},true);
for(const img of roomFailure.imageRequests)img.onload();
roomFailure.run('start(7)');
for(const img of roomFailure.imageRequests.slice(5)){
  if(/mill-(rooms|hall|attic)-v1/.test(img.url))img.onerror();else img.onload();
}
assert.equal(roomFailure.run('illustrationLoading'),false,'Failed room art does not hold the loading screen open');
assert.doesNotThrow(()=>roomFailure.run('draw();checkpoint=9;spawn();draw()'),'The original mill remains a usable fallback at later lamps');
assert.equal(roomFailure.run('state'),'play','Room art failures preserve gameplay');
const journeyFailure=boot({},true);
for(const img of journeyFailure.imageRequests)img.onload();
journeyFailure.run('start(8)');
for(const img of journeyFailure.imageRequests.slice(5)){
  if(/mill-(courtyard|homeward|attic(?:-roof)?)-v1/.test(img.url))img.onerror();else img.onload();
}
assert.equal(journeyFailure.run('illustrationLoading'),false,'New exterior art can fail without trapping the player in loading');
assert.doesNotThrow(()=>journeyFailure.run('draw();checkpoint=5;spawn();draw();checkpoint=11;spawn();draw()'),'Both sides of the attic retain original-art fallbacks');
assert.equal(journeyFailure.run('state'),'play');
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
const millPolish=boot();
for(const [index,support,kind,count] of [[6,0,'stone',5],[6,3,'ice',6],[8,10,'wood',8]]){
  millPolish.run(`start(${index});checkpoint=${support};spawn();particles=[];cat.ground=false;cat.y=boards[${support}].y-cat.h-2;cat.vy=300;update(STEP)`);
  assert.equal(millPolish.run(`particles.filter(p=>p.kind==='${kind}').length`),count,'Third-chapter landing feedback follows the actual material');
  assert.equal(millPolish.run('cat.y+cat.h'),millPolish.run(`boards[${support}].y`),'Lighting and material effects preserve collision contact');
}
millPolish.run('start(7);checkpoint=2;spawn();particles=[];const polishRevision=levelRevision(7);cat.ground=false;cat.y=boards[2].y-cat.h-2;cat.vy=300;update(STEP)');
assert.equal(millPolish.run('particles.filter(p=>p.kind==="wood").length'),8,'A real timber landing releases a small bounded burst');
assert.equal(millPolish.run('cat.y+cat.h'),millPolish.run('boards[2].y'),'Landing effects preserve the real contact surface');
millPolish.run('const frozenPolish=JSON.stringify({time,millLanding,particles});pause();update(1);draw()');
assert.equal(millPolish.run('JSON.stringify({time,millLanding,particles})'),millPolish.run('frozenPolish'),'Pause and rendering do not advance or spawn effects');
millPolish.run('pause();for(let n=0;n<120;n++)update(STEP)');
assert.equal(millPolish.run('particles.filter(p=>p.kind).length'),0,'Landing fragments expire');
assert.equal(millPolish.run('levelRevision(7)'),millPolish.run('polishRevision'),'The sample preserves saved route compatibility');
millPolish.run('checkpoint=3;spawn();particles=[];cat.ground=false;cat.y=boards[3].y-cat.h-2;cat.vy=300;update(STEP)');
assert.equal(millPolish.run('particles.filter(p=>p.kind==="flour").length'),8,'Canvas landing uses soft dust instead of timber fragments');
millPolish.run('start(7);checkpoint=2;spawn();checkpoint=-1;particles=[];update(STEP)');
assert.equal(millPolish.run('lampIgnition.board'),2,'An actual checkpoint landing starts the lamp transition');
assert.equal(millPolish.run('particles.filter(p=>p.kind==="ember").length'),5,'Checkpoint ignition uses a small ember burst');
assert.equal(millPolish.run('lampStrength(2)'),0,'A newly activated lamp starts its short warm-up');
millPolish.run('for(let n=0;n<30;n++)update(STEP)');
assert.ok(millPolish.run('lampStrength(2)')>1,'The lamp briefly brightens after warming up');
millPolish.run('const pausedLamp=lampStrength(2);pause();update(1)');
assert.equal(millPolish.run('lampStrength(2)'),millPolish.run('pausedLamp'),'Pause freezes checkpoint ignition');
millPolish.run('start(7,true)');
assert.equal(millPolish.run('lampIgnition.board'),-1,'Restoring a checkpoint does not replay ignition');
oldPage.context.document.getElementById=id=>id==='artLoading'?null:oldLookup(id);
assert.doesNotThrow(()=>{for(const img of oldPage.imageRequests)img.onload();oldPage.run('start(6)')},'A cached older page can load the updated game script');
const missingArt=boot({},true);
for(const img of missingArt.imageRequests)img.onerror();
missingArt.run('next();draw()');
assert.equal(missingArt.run('state'),'play','Failed images retain a playable fallback');
assert.equal(missingArt.run("$('assetStatus').hidden"),false);
const gates=boot();
gates.run(`
function reachGate(index,from,kind,disabled,marginList){
  const raw=LEVELS[index].boards[from];
  const margins=marginList||[];
  if(!marginList)for(let m=8;m<raw[2]-28;m+=6)margins.push(m);
  for(const margin of margins){
    start(index);checkpoint=from;spawn();
    if(disabled){
      if(kind==='wind')level={...level,winds:[]};
      if(kind==='ice')boards[from].ice=false;
      if(kind==='belt')boards[from].belt=0;
    }
    const source=boards[from],target=boards[from+1],launch=source.x+source.w-margin;
    keys.add('ArrowRight');
    for(let n=0;cat.x<launch&&n<600&&cat.ground;n++)update(STEP);
    if(!cat.ground||deathDelay)continue;
    buffer=.12;jumpHeld=true;let airborne=false;
    for(let n=0;n<180;n++){
      if(cat.x>target.x+target.w-48)keys.delete('ArrowRight');
      update(STEP);if(deathDelay)break;
      if(!cat.ground)airborne=true;
      if(airborne&&cat.ground){if(cat.support===from+1)return true;break;}
    }
  }
  return false;
}
`);
for(const index of [3,5,6,7,8]){
  const challenges=JSON.parse(gates.run(`JSON.stringify(LEVELS[${index}].mechanicGates)`));
  for(const gate of challenges){
    assert.equal(gates.run(`reachGate(${index},${gate.from},'${gate.kind}',false)`),true,'The intended mechanic can clear its long gap');
    assert.equal(gates.run(`reachGate(${index},${gate.from},'${gate.kind}',true)`),false,'Disabling '+gate.kind+' must make its long gap unreachable');
    for(const margin of [8,24,40,56])assert.equal(gates.run(`reachGate(${index},${gate.from},'${gate.kind}',false,[${margin}])`),true,'Long jumps allow several early launch positions, not a single edge frame');
    gates.run(`start(${index});checkpoint=${gate.from};spawn();cat.x=boards[${gate.from}].x+boards[${gate.from}].w-24;canvas.getBoundingClientRect=()=>({width:844,height:300});resizeView();updateCamera(0)`);
    assert.ok(gates.run(`camera.x+camera.w>boards[${gate.to}].x+35`),'The landing front is visible before a long jump on mobile');
    console.log('Mechanic gate '+(index+1)+'/'+gate.from+': '+gate.kind+' required');
  }
}
const oldMechanics=JSON.parse(gates.run('JSON.stringify(mechanicLegacy.get(7))'));
const migrated=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6,7,8],cleared:{7:true},continueLevel:7,
  records:{7:{fish:[oldMechanics.fish[1].join(',')],bestTime:60,bestDeaths:0}},
  runs:{7:{revision:oldMechanics.revision,checkpoint:5,elapsed:42,deaths:1,fish:[1]}}})});
assert.equal(migrated.run('checkpoint'),5,'An old lamp resumes at the corresponding new route section');
assert.equal(migrated.run('elapsed'),42);assert.equal(migrated.run('fish[1].got'),true);
assert.equal(migrated.run('records[7].fish[0]'),migrated.run('fishKey(LEVELS[7].fish[1])'),'Collected fish migrate by route identity');
assert.equal(migrated.run('records[7].bestTime'),undefined,'Different route lengths cannot share a best-time record');
assert.equal(migrated.run('isLevelUnlocked(8)'),true,'Existing unlocks survive the mechanic redesign');
const publishedMill=oldMechanics.versions[0];
const millReload=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,3,6,7,8],continueLevel:7,
  records:{7:{revision:publishedMill.revision,fish:publishedMill.fish.map(f=>f.join(',')),bestTime:55}},
  runs:{7:{revision:publishedMill.revision,checkpoint:9,elapsed:38,deaths:2,fish:[0,2]}}})});
assert.equal(millReload.run('checkpoint'),9,'The immediately preceding published mill layout resumes at its matching lamp');
assert.equal(millReload.run('elapsed'),38);assert.equal(millReload.run('deaths'),2);
assert.equal(millReload.run('fish[0].got&&fish[2].got'),true);
assert.equal(millReload.run('records[7].fish.length'),3,'All previous collections map to the new shelf and gallery rewards');
assert.equal(millReload.run('records[7].bestTime'),undefined);
for(const [index,lamp] of [[0,6],[1,7],[2,9]]){
  const old=JSON.parse(gates.run(`JSON.stringify(mechanicLegacy.get(${index}))`));
  const last=old.fish.length-1;
  const restored=boot({'tiny-trouble-long-v1':JSON.stringify({available:[0,1,2,3,6],continueLevel:index,
    records:{[index]:{revision:old.revision,fish:old.fish.map(f=>f.join(',')),bestTime:60},4:{fish:[],bestTime:11}},
    runs:{[index]:{revision:old.revision,checkpoint:lamp,elapsed:23.4,deaths:2,fish:[last]}}})});
  assert.equal(restored.run('checkpoint'),lamp,'An old forest lamp maps to its corresponding new rest stage');
  assert.equal(restored.run('elapsed'),23.4);assert.equal(restored.run('deaths'),2);
  assert.equal(restored.run(`fish[${last}].got`),true);
  assert.equal(restored.run(`records[${index}].fish.length`),old.fish.length,'All old forest fish collections retain their identity');
  assert.equal(restored.run(`records[${index}].bestTime`),undefined);
  assert.equal(restored.run('records[4].bestTime'),11,'Unchanged harbor records survive a forest update');
}
console.log('PASS: 9 routes, every lamp, forest rest walks and roof rewards, red-fruit small jumps, mill branches, eight mechanic jumps, old saves and mobile lifecycle');

