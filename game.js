'use strict';
// World units are independent of CSS pixels. Physics runs at a fixed 120 Hz.
const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);
const illustrations={};
const illustrationStates={};
const illustrationFiles={
  cat:'assets/cat-gouache-v1.png',catFeedback:'assets/cat-feedback-v1.png',environment:'assets/woodland-atlas-v1.png',signs:'assets/signs-gouache-v1.png',
  forest:'assets/forest-dawn-v1.jpg',harbor:'assets/harbor-afternoon-v1.jpg',
  harborEnvironment:'assets/harbor-atlas-v1.png',warehouse:'assets/harbor-warehouse-v1.png',
  rooftop:'assets/rooftop-moonlight-v1.jpg',rooftopEnvironment:'assets/rooftop-atlas-v1.png',rooftopLandmarks:'assets/rooftop-landmarks-v1.png',
  slidingEave:'assets/rooftop-sliding-eave-v1.png',
  mill:'assets/mill-night-v1.jpg',millRooms:'assets/mill-rooms-v1.jpg',millHall:'assets/mill-hall-v1.jpg',millAttic:'assets/mill-attic-v1.jpg',millEnvironment:'assets/mill-atlas-v1.png',millBell:'assets/mill-bell-v1.png',
  millApproach:'assets/mill-approach-v1.jpg',millExterior:'assets/mill-exterior-v1.png',millCourtyard:'assets/mill-courtyard-v1.jpg',millHomeward:'assets/mill-homeward-v1.jpg',millAtticRoof:'assets/mill-attic-roof-v1.png',
  forestProps:'assets/forest-props-v1.png',windsock:'assets/harbor-windsock-v1.png'
};
let illustrationLoading=false;
function requiredIllustrations(){
  const chapters=[['forest'],['harbor','harborEnvironment','warehouse'],['millApproach','millExterior','millCourtyard']];
  const routeArt=levelIndex===7?['mill','millRooms','millHall','millAttic','millEnvironment','millBell']:levelIndex===8?['millApproach','millExterior','mill','millEnvironment','millAttic','millCourtyard','millHomeward','millAtticRoof']:chapters[worldIndex()];
  const extras=[];
  if(worldIndex()===0&&(level.saws.length||level.sections.some(s=>s.kind==='shed')))extras.push('forestProps');
  if(worldIndex()===1&&level.sections.some(s=>s.kind==='windmill'))extras.push('windsock');
  return ['cat','catFeedback','environment','signs',...routeArt,...extras];
}
function updateIllustrationStatus(){
  const required=requiredIllustrations(),wasLoading=illustrationLoading;
  illustrationLoading=required.some(key=>illustrationStates[key]==='loading');
  const failed=required.some(key=>illustrationStates[key]==='error');
  $('primary').disabled=illustrationLoading;
  const loadingOverlay=$('artLoading');
  if(loadingOverlay)loadingOverlay.hidden=!illustrationLoading||state==='menu';
  $('assetStatus').hidden=!illustrationLoading&&!failed;
  $('assetStatus').textContent=illustrationLoading?'正在翻开绘本…':failed?'部分插画未载入，仍可继续散步。':'';
  syncAudio();
  if(wasLoading&&!illustrationLoading)clearInput();
}
function loadIllustrations(){
  if(typeof Image==='undefined')return;
  for(const key of requiredIllustrations()){
    if(illustrationStates[key])continue;
    illustrationStates[key]='loading';
    const img=new Image();
    const settled=()=>{
      updateIllustrationStatus();
      if(!illustrationLoading&&requiredIllustrations().includes(key))rebuildBackground();
    };
    img.onload=()=>{illustrations[key]=img;illustrationStates[key]='ready';settled();};
    img.onerror=()=>{illustrationStates[key]='error';settled();};
    img.src=illustrationFiles[key];
  }
  updateIllustrationStatus();
}
let W = 960;
const H = 540, STEP = 1 / 120;
const camera={x:0,y:0,w:640,h:360,groundY:450,snap:true,pixelWidth:960,pixelHeight:540};
function resizeView(){
  const rect=canvas.getBoundingClientRect?.();
  if(!rect?.width||!rect?.height)return;
  camera.cssWidth=rect.width;
  const aspect=rect.width/rect.height;
  camera.w=rect.width<600?370:rect.width<1000?560:640;
  camera.h=Math.min(H,camera.w/aspect);
  // Preserve the visible field in very tall layouts.
  camera.w=camera.h*aspect;
  const ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);
  camera.pixelWidth=canvas.width;camera.pixelHeight=canvas.height;camera.snap=true;
}
function updateCamera(dt){
  if(cat.ground)camera.groundY=cat.y+cat.h;
  const targetX=Math.max(0,Math.min(W-camera.w,cat.x+cat.w/2-camera.w*.4+cat.vx*.1));
  const targetY=Math.max(0,Math.min(H-camera.h,camera.groundY-camera.h*.74));
  const ease=camera.snap?1:1-Math.exp(-dt*8);
  camera.x+=(targetX-camera.x)*ease;camera.y+=(targetY-camera.y)*ease;camera.snap=false;
  // Keep the cat visible during a drop or an unusually narrow viewport.
  camera.y=Math.max(0,Math.min(H-camera.h,Math.max(cat.y+cat.h-camera.h*.92,Math.min(camera.y,cat.y-16))));
}
const SEGMENTS = [
  { name:'慢慢学会出发', hint:'先试着跳过前面的小缺口。轻按小跳，按住大跳。', palette:['#eee6c9','#bacbb0','#7a9d85'],
    boards:[[0,450,180],[215,430,125],[375,405,170],[585,385,115],[735,420,85],[860,365,100],[555,475,165]],
    fragile:[3], crumbleDelay:1.15, check:2, exit:5, rescue:6,
    fish:[[905,323]], thorns:[], saw:null },
  { name:'桥也会打盹', hint:'木桥开始摇晃时就起跳。荆棘上方永远有路。', palette:['#e6dfcf','#b0c3bd','#739b96'],
    boards:[[0,450,170],[220,390,110],[380,330,110],[540,390,125],[712,340,100],[855,285,105]],
    fragile:[1,2,4], check:3, fish:[[265,333],[424,275],[753,285]], thorns:[[610,376,28]], saw:null },
  { name:'果园门口', hint:'红色飞果来回摆动，观察一拍再跳。路还在右边。', palette:['#ead8c9','#c3b7ac','#8d9c8c'],
    boards:[[0,450,170],[222,400,110],[382,352,110],[540,410,125],[714,355,105],[860,300,100]],
    fragile:[2,4], check:3, fish:[[270,340],[431,295],[764,298]], thorns:[[115,436,28]],
    saw:{x:690,y:294,r:12,range:48}, fake:true },
  { name:'石阶午后', hint:'这一段不赶时间。稳稳站好，再跳到下一级。', palette:['#efe6c9','#c9ccb0','#9ba482'],
    boards:[[0,455,170],[205,415,120],[365,355,120],[525,305,145],[710,355,105],[850,300,110]],
    fragile:[],check:3,fish:[[260,373],[582,265]],thorns:[],saw:null },
  { name:'鱼干的诱惑', hint:'鱼干不是通行证。想拿高处那条，可以先到路灯边歇脚。', palette:['#efdec6','#c9bc99','#a3aa80'],
    boards:[[0,450,180],[220,425,130],[390,385,145],[575,425,125],[740,365,100],[880,325,80],[425,285,82]],
    fragile:[],check:2,exit:5,fish:[[258,385],[468,246],[788,325]],thorns:[],saw:null },
  { name:'雨后断桥', hint:'两座旧桥之间有稳固的落脚点。可以在那里重新调整节奏。', palette:['#dce3df','#a9c0b9','#7d9e98'],
    boards:[[0,450,175],[215,405,125],[380,365,150],[575,405,125],[740,355,100],[875,310,85]],
    fragile:[1,3],crumbleDelay:.85,check:2,fish:[[267,365],[624,365]],thorns:[],saw:null },
  { name:'等一颗红果', hint:'路灯旁是安全的。先看红果摆过去，再向右起跳。', palette:['#e5d9ce','#c8b5ac','#9e9f8c'],
    boards:[[0,450,170],[210,405,130],[380,350,145],[570,395,140],[750,340,100],[885,290,75]],
    fragile:[],check:3,fish:[[268,365],[433,310],[795,300]],thorns:[],
    saw:{x:730,y:318,r:13,range:48} },
  { name:'最后一盏灯', hint:'走过旧桥，在路灯边歇一歇。最后一段，用熟悉的节奏回家。', palette:['#e6d5c6','#b3b6a6','#88998c'],
    boards:[[0,450,170],[215,400,125],[380,350,150],[575,395,140],[755,345,100],[885,300,75]],
    fragile:[1,4],crumbleDelay:.9,check:3,fish:[[270,360],[435,310],[807,305]],
    thorns:[[463,336,24]],saw:null }
];
const WORLDS=[
  {name:'林间散步',scene:'forest',color:'#526e55'},
  {name:'潮汐码头',scene:'harbor',color:'#477d94'},
  {name:'月夜旧磨坊',scene:'rooftop',color:'#7775a8'}
];
const NEW_CHAPTERS=[
  {scene:'harbor',palette:['#d6e5e5','#96b5bc','#688e9b'],stages:[
    ['海风初来',[[0,450,180],[220,420,130],[390,385,145],[575,410,130],[745,365,105],[885,320,75]],{wind:35},'蓝色风区只影响空中的你。先从宽平台试一跳。'],
    ['顺风栈道',[[0,450,170],[225,415,125],[400,375,130],[585,405,130],[760,350,100],[890,305,70]],{wind:45},'顺风会多送你一小段。快到平台时松开方向键。'],
    ['逆风灯塔',[[0,450,175],[210,420,135],[385,385,145],[570,415,135],[745,365,105],[880,320,80]],{wind:-35},'逆风中按住跳跃，落脚点会更近一些。'],
    ['停船的午后',[[0,450,180],[215,420,135],[385,380,145],[565,345,140],[745,390,105],[885,345,75]],{},'风暂时停了。这一段不赶时间。'],
    ['软垫试跳',[[0,450,180],[215,425,130],[385,400,155],[580,245,130],[745,305,105],[880,350,80]],{spring:[2]},'蓝色鼓垫站稳后再跳，能跳上更高的栈桥。仍然只用跳跃键。'],
    ['一跳一歇',[[0,450,180],[220,420,130],[390,395,150],[580,235,135],[755,290,100],[885,335,75]],{spring:[2]},'弹性垫需要长按跳跃。高处的桥是稳固的。'],
    ['风中的软垫',[[0,450,175],[215,425,135],[390,400,150],[585,250,130],[750,310,100],[885,355,75]],{spring:[2],wind:28},'先在无风处踏上软垫，再顺风跳往高桥。'],
    ['渡口晚灯',[[0,450,180],[220,420,130],[395,390,145],[580,240,135],[750,300,105],[885,345,75]],{spring:[2],wind:-25},'站稳、按住、起跳。码头的最后一盏灯在右边。']
  ]},
  {scene:'rooftop',palette:['#353e60','#636b88','#9093a7'],stages:[
    ['第一片薄霜',[[0,450,180],[215,420,140],[395,380,145],[580,405,135],[755,355,100],[885,310,75]],{ice:[1]},'浅蓝屋瓦有点滑。松手后仍会前进，试着轻按反方向刹车。'],
    ['滑过天窗',[[0,450,180],[220,415,140],[400,375,140],[580,410,135],[755,360,100],[885,315,75]],{ice:[1,3]},'冰面之间有普通屋瓦，可以在那里停稳。'],
    ['月亮歇脚处',[[0,450,180],[215,415,140],[395,375,145],[580,335,135],[755,385,100],[885,340,75]],{},'月光下没有机关。慢慢走，看看远处的灯。'],
    ['会走路的屋瓦',[[0,450,180],[215,420,140],[395,380,145],[580,410,135],[755,355,100],[885,310,75]],{belts:{1:50}},'箭头屋瓦会带你走。停下来观察，再向前跳。'],
    ['迎着箭头',[[0,450,180],[215,420,140],[395,380,145],[580,410,135],[755,355,100],[885,310,75]],{belts:{1:-45,3:45}},'逆向屋瓦走得慢些，起跳后就不再被它推着走。'],
    ['霜与齿轮',[[0,450,180],[220,415,140],[400,375,140],[580,410,135],[755,360,100],[885,315,75]],{ice:[1],belts:{3:50}},'先在冰面刹稳，再去试箭头屋瓦。两种地面分开走。'],
    ['屋脊小夜曲',[[0,450,175],[215,410,140],[395,365,145],[580,400,135],[755,350,100],[885,305,75]],{ice:[1],fragile:[4],crumbleDelay:1},'路灯之后只剩一块旧瓦。用森林里学过的节奏跳过去。'],
    ['窗里的暖光',[[0,450,180],[215,415,140],[395,375,145],[580,410,135],[755,355,100],[885,310,75]],{ice:[1],belts:{3:-40}},'经过薄霜，歇在路灯边。再越过最后的屋瓦，就到家了。']
  ]}
];
for(const chapter of NEW_CHAPTERS)for(const [name,layout,traits,hint] of chapter.stages){
  SEGMENTS.push({name,hint,scene:chapter.scene,palette:chapter.palette,boards:layout,fragile:[],check:2,
    fish:[[layout[1][0]+55,layout[1][1]-42],[layout[4][0]+45,layout[4][1]-42]],thorns:[],saw:null,...traits});
}
const MERGE_PLAN=[
  ['林间初行',[0,1]],['石阶与果园',[3,4,2]],['晚灯归途',[5,6,7]],
  ['海风栈道',[8,9,10]],['停船与高桥',[11,12,13]],['渡口晚风',[14,15]],
  ['霜夜磨坊',[16,17,18]],['运粮走廊',[19,20]],['阁楼归途',[21,22,23]]
];
// Compose authored encounters into one continuous world. Connector steps always
// have small gaps and descend gradually, keeping the original jump distances.
function mergeLevel(name,sources){
  const first=SEGMENTS[sources[0]],out={name,palette:first.palette,scene:first.scene,hint:first.hint,
    boards:[],traits:[],fish:[],thorns:[],saws:[],winds:[],sections:[],checks:[],route:[],routeNext:{},sources};
  let offset=0;
  for(const source of sources){
    const s=SEGMENTS[source],base=out.boards.length,exit=s.exit??s.boards.length-1;
    out.sections.push({x:offset,name:s.name,hint:s.hint,source,board:base});
    for(let i=0;i<s.boards.length;i++){
      const [x,y,w]=s.boards[i];out.boards.push([x+offset,y,w]);
      out.traits.push({fragile:s.fragile.includes(i),spring:s.spring?.includes(i),ice:s.ice?.includes(i),belt:s.belts?.[i]||0,
        delay:s.crumbleDelay??.65,source,local:i});
    }
    out.route.push(...Array.from({length:exit+1},(_,i)=>base+i));
    if(s.rescue!==undefined)out.routeNext[base+s.rescue]=base+4;
    if(s.boards.length>exit+1&&s.rescue===undefined)out.routeNext[base+exit+1]=base+3;
    out.checks.push(base+s.check);
    if(source!==sources[0])out.checks.push(base);
    out.fish.push(...s.fish.map(([x,y])=>[x+offset,y]));
    out.thorns.push(...s.thorns.map(([x,y,w])=>[x+offset,y,w]));
    if(s.saw)out.saws.push({...s.saw,x:s.saw.x+offset,anchor:(s.saw.x+offset)});
    if(s.wind)out.winds.push({from:offset+320,to:offset+730,speed:s.wind});
    if(source===0)out.rescue=base+s.rescue;
    const end=out.boards[base+exit];
    let edge=end[0]+end[2],y=end[1];
    if(source!==sources[sources.length-1]){
      while(450-y>60){
        y+=55;const index=out.boards.length;
        out.boards.push([edge+35,y,110]);out.traits.push({source:-1});
        out.route.push(index);edge+=145;
      }
      offset=edge+35;
    }else out.exit=base+exit;
  }
  for(let i=0;i<out.route.length-1;i++)out.routeNext[out.route[i]]=out.route[i+1];
  out.width=out.boards[out.exit][0]+out.boards[out.exit][2];
  out.check=out.checks[0];return out;
}
const LEVELS=MERGE_PLAN.map(([name,sources])=>mergeLevel(name,sources));
// A bespoke continuous route replaces the three concatenated encounters in 2-2.
// Collision tops and illustrated deck/crate tops share the same coordinates.
function harborShowcase(){
  const layout=[[0,450,180],[220,425,150],[410,400,250],[700,350,130],
    [870,400,240],[1150,355,130],[1320,390,170],[1540,235,190],
    [1770,260,160],[1970,225,160],[2170,275,210],[2420,330,140],
    [2600,175,160],[2800,230,140],[2980,265,220]];
  const pads=[6,11],route=layout.map((_,i)=>i);
  return {name:'停船与高桥',showcase:true,scene:'harbor',palette:['#dce7e3','#9dbbc0','#7398a3'],
    hint:'沿木栈道登上停泊的帆船，穿过前面的货仓。',sources:[11,12,13],
    boards:layout,traits:layout.map((_,i)=>({source:i<4?11:i<7?12:13,local:i,spring:pads.includes(i)})),
    fish:[[520,355],[1208,311],[1840,218],[2270,233],[2850,188]],
    thorns:[],saws:[],winds:[],checks:[2,6,10,11],check:2,exit:14,finishX:3040,width:3200,
    route,routeNext:Object.fromEntries(route.slice(0,-1).map(i=>[i,i+1])),
    sections:[
      {x:0,name:'停泊的船',hint:'先登上甲板。宽木板和路灯可以让你停稳。',source:'ship',board:0},
      {x:840,name:'货仓小径',hint:'从木箱上绕过去。在蓝色软垫上按住跳跃，登上高桥。',source:'warehouse',board:4},
      {x:1540,name:'海上的高桥',hint:'上来了。沿高处的桥向右走，远处就是灯塔。',source:'bridge',board:7},
      {x:2390,name:'灯塔前的最后一跳',hint:'先在路灯边站稳，再借软垫跳向灯塔。',source:'lighthouse',board:11}
    ]};
}
LEVELS[4]=harborShowcase();
const AUTHORED_ROUTES=[
  {index:0, boards:[[0,450,180],[215,430,125],[375,405,170],[585,385,115],[735,420,85],[860,365,140],[1040,400,220],[1300,355,140],[1480,315,150],[1670,365,220],[1930,345,130],[2100,385,130],[2270,330,150],[2460,285,220]],
    fragile:[3,11],checks:[2,6,9],rescue:[555,475,165],rescueNext:4,
    sections:[[0,'溪边出发','先跳过小缺口，到路灯边歇脚。','tree'],[6,'树荫小径','经过旧桥后，可以在这里停一停。','arch'],[9,'林间旧桥','前面只有一块裂纹板，记得及时起跳。','tree'],[13,'树洞驿站','走到树洞门口，这一段就完成了。','gate']]},
  {index:1,boards:[[0,450,210],[250,415,150],[440,370,180],[660,325,130],[830,365,210],[1080,330,150],[1270,385,160],[1470,350,210],[1720,310,130],[1890,360,160],[2090,330,210],[2340,375,150],[2530,320,150],[2720,280,220]],
    checks:[2,4,7,10],bonus:[[880,265,140],[1060,235,130]],bonusNext:6,saw:{x:2250,y:300,r:12,range:40},
    sections:[[0,'石阶入口','沿石阶向上，果园就在山坡后。','arch'],[4,'果园棚下','沿低处木道走很安全，也可以跳上棚顶找两条鱼干。','shed'],[7,'果树走廊','两条路都到了这里。在宽平台上歇歇脚。','tree'],[10,'果园出口','等红果摆开，再跳向右边的拱门。','gate']]},
  {index:2,boards:[[0,450,200],[240,410,140],[420,375,210],[670,350,140],[850,395,150],[1040,350,160],[1240,310,220],[1500,365,140],[1680,325,160],[1880,370,220],[2140,345,140],[2320,300,150],[2510,350,140],[2690,300,230]],
    fragile:[3,10],checks:[2,6,9],saw:{x:2420,y:245,r:12,range:35},
    sections:[[0,'雨后木道','潮湿的木桥有裂纹，先去路灯边站稳。','tree'],[6,'雨棚歇脚','到这里可以停下，后半段从宽平台起跳。','shed'],[9,'晚灯桥头','过旧桥后留意摆动的红果。','arch'],[13,'森林边界','前方有灯，走进拱门就到了。','gate']]},
  {index:3,boards:[[0,450,210],[250,415,150],[440,375,210],[690,340,160],[890,385,150],[1080,350,220],[1340,310,150],[1530,360,150],[1720,325,220],[1980,370,160],[2180,335,150],[2370,380,200],[2610,330,150],[2800,285,220]],
    checks:[2,5,8,11],winds:[{from:650,to:1040,speed:35},{from:1300,to:1700,speed:40},{from:1970,to:2560,speed:-30}],
    sections:[[0,'风向标码头','走到风向标旁，再试试顺风中的跳跃。','windmill'],[5,'吊架通道','顺风会把你送得更远，接近落点时松开方向。','crane'],[8,'背风歇脚处','在这里停稳，下一段开始是逆风。','shed'],[11,'防波堤','逆风中按住跳跃，沿台阶走向航标。','beacon']]},
  {index:5,boards:[[0,450,210],[250,415,160],[450,380,210],[700,410,140],[880,385,180],[1100,230,180],[1320,270,160],[1520,320,220],[1780,370,150],[1970,330,210],[2220,365,180],[2440,210,170],[2650,260,150],[2840,305,230]],
    spring:[4,10],checks:[2,4,7,10],winds:[{from:1070,to:1490,speed:25},{from:2410,to:2830,speed:-20}],
    sections:[[0,'渡口候船','先走到吊架下，蓝色软垫能送你上高桥。','boat'],[4,'顺风吊架','在软垫上长按跳跃，借顺风登高。','crane'],[7,'中途泊位','宽甲板能让你停稳，调整好再出发。','boat'],[10,'最后的航标','这一跳迎着微风，按住跳跃抵达航标。','beacon']]},
  {index:6,boards:[[0,450,210],[250,420,160],[450,380,220],[710,355,210],[960,400,150],[1150,355,180],[1370,315,220],[1630,365,220],[1890,330,150],[2080,385,210],[2330,340,150],[2520,295,170],[2730,340,220]],
    ice:[3,7],checks:[2,6,9],
    sections:[[0,'磨坊外墙','沿石檐向前，浅蓝色的霜面才会打滑。','wall'],[2,'第一片薄霜','在霜面轻按反方向，停稳再跳。','frost'],[6,'背风石台','两段薄霜之间有干燥石台，可以歇脚。','wall'],[9,'门厅暖灯','走过最后几级石檐，磨坊的门就在前面。','mill-entry']]},
  {index:7,boards:[[0,450,220],[260,425,160],[460,395,240],[740,370,220],[1000,410,180],[1220,375,240],[1500,345,220],[1760,395,190],[1990,360,160],[2190,325,240],[2470,370,230],[2740,335,180],[2960,295,170],[3170,340,240],[3450,300,220]],
    belts:{3:40,6:-35,10:45},checks:[2,5,9,13],
    sections:[[0,'磨坊门厅','沿木廊向前，先到路灯旁看看运粮带。','mill'],[2,'第一台运粮机','浅色帆布会缓缓送你向右，跳上木台就能停稳。','hopper'],[5,'回程检修廊','这一台向左运粮，向右走慢一些，起跳就能离开。','pulley'],[9,'阁楼装粮间','先在木台歇脚，再借最后一台运粮带去阁楼门口。','mill-exit']]},
  {index:8,boards:[[0,450,210],[250,415,160],[450,375,210],[700,350,210],[950,395,160],[1150,350,220],[1410,310,160],[1610,365,180],[1830,330,220],[2090,375,160],[2290,340,160],[2490,295,220],[2750,330,150],[2940,280,240]],
    ice:[3],belts:{6:-35},fragile:[10],checks:[2,5,8,11],
    sections:[[0,'窗外薄霜','沿露天外廊走过薄霜，前面可以穿进阁楼。','frost'],[5,'阁楼检修廊','木台可以停稳。经过向左的帆布带，再走向出口。','mill-entry'],[8,'旧木桥头','出了阁楼有一块裂纹旧木板，及时跳过去。','repair'],[11,'回家的灯','磨坊的声音远了，沿木廊走向暖窗。','home']]}
];
for(const plan of AUTHORED_ROUTES){
  const original=LEVELS[plan.index];
  const route=plan.boards.map((_,i)=>i);
  const layout=plan.boards.map(b=>[...b]);
  const traits=layout.map((_,i)=>({source:plan.index===0&&i<6?0:-1,local:i,
    fragile:plan.fragile?.includes(i),delay:plan.index===0?1.15:.95,
    spring:plan.spring?.includes(i),ice:plan.ice?.includes(i),belt:plan.belts?.[i]||0}));
  const routeNext=Object.fromEntries(route.slice(0,-1).map(i=>[i,i+1]));
  let rescue;
  if(plan.rescue){
    rescue=layout.length;
    layout.push(plan.rescue);
    traits.push({source:-1});
    routeNext[rescue]=plan.rescueNext;
  }
  const fish=plan.sections.slice(1).map(([i])=>[layout[i][0]+layout[i][2]*.65,layout[i][1]-42]);
  if(plan.bonus){
    const bonusStart=layout.length;
    plan.bonus.forEach((board,index)=>{
      layout.push(board);
      traits.push({source:-1,bonus:true});
      routeNext[bonusStart+index]=index<plan.bonus.length-1?bonusStart+index+1:plan.bonusNext;
      fish.push([board[0]+board[2]*.5,board[1]-30]);
    });
  }
  const exit=route.length-1,end=layout[exit];
  LEVELS[plan.index]={...original,refined:true,preview:plan.index===7,boards:layout,traits,route,routeNext,rescue,
    exit,finishX:end[0]+end[2]-55,width:end[0]+end[2],checks:plan.checks,check:plan.checks[0],fish,
    winds:plan.winds||[],saws:plan.saw?[{...plan.saw,anchor:plan.saw.x}]:[],thorns:[],
    hint:plan.sections[0][2],
    sections:plan.sections.map(([i,name,hint,kind],section)=>({x:layout[i][0],board:i,name,hint,kind,source:'refined-'+section}))};
}
function worldIndex(i=levelIndex){return Math.floor(i/3);}
function world(){return WORLDS[worldIndex()];}
let keys = new Set(), levelIndex=0, level, boards, fish, checkpoint=-1, deaths=0, elapsed=0;
let state='menu', time=0, deathDelay=0, buffer=0, coyote=0, jumpHeld=false, accumulator=0, last=0;
let particles=[], shake=0, landing=0, muted=false, audio=null, fakeTriggered=false;
const soundscape=typeof WalkAudio==='function'?new WalkAudio():null;
const millMoment={warned:false,rung:false,age:0};
const millLanding={age:1,x:0,y:0,force:0};
const lampIgnition={board:-1,at:-99};
// Presentation rooms follow the existing route. They never add collision surfaces.
const MILL_ROOMS=[
  {id:'entry',from:0,to:660,col:0,row:0,top:110},
  {id:'hall',from:660,to:2080,col:1,row:0,asset:'millHall',inset:.06,top:-35,window:{x:.528,y:.20,length:360}},
  {id:'attic',from:2080,to:3150,col:0,row:1,asset:'millAttic',inset:.08,top:-30,window:{x:.415,y:.25,length:250}},
  {id:'exit',from:3150,to:3670,col:1,row:1,top:35}
];
const MILL_JOURNEYS={
  6:[
    {id:'outskirts',from:0,to:710,asset:'millApproach',top:-70},
    {id:'frost-wall',from:710,to:1630,asset:'millCourtyard',top:-50},
    {id:'sheltered-arch',from:1630,to:2520,asset:'millCourtyard',mirror:true,top:-60},
    {id:'warm-vestibule',from:2520,to:2950,asset:'millCourtyard',top:20}
  ],
  8:[
    {id:'outer-gallery',from:0,to:1120,asset:'millCourtyard',top:-80},
    {id:'attic-room',from:1120,to:2260,asset:'millAttic',inset:.08,top:-30,inside:true,window:{x:.415,y:.25,length:260}},
    {id:'bridge-home',from:2260,to:3180,asset:'millHomeward',top:-170}
  ]
};
const ATTIC_SHELL={left:1120,right:2260,peakX:1690,eaveY:135,peakY:45,depth:20,entryFloor:350,exitFloor:375};
let atticRoofCanvas=null;
let atticRoofSource=null;
let atticVestibuleLayer=null;
const ATTIC_BLEND=72;
const cat={x:45,y:420,w:23,h:30,vx:0,vy:0,ground:true,face:1};
// Presentation follows the real movement; it never changes the collision body.
const catMotion={stride:0,idle:0,turn:0,brake:0,dust:0,launch:0};
function resetCatMotion(){Object.assign(catMotion,{stride:0,idle:0,turn:0,brake:0,dust:0,launch:0});}
function updateCatMotion(dt,axis,previousVx,previousFace){
  catMotion.turn=Math.max(0,catMotion.turn-dt);
  catMotion.launch=Math.max(0,catMotion.launch-dt);
  if(cat.face!==previousFace)catMotion.turn=.12;
  const speed=Math.abs(cat.vx),braking=cat.ground&&Math.abs(previousVx)>45&&(!axis||axis*previousVx<0);
  const target=braking?Math.min(1,Math.abs(previousVx)/180):0;
  catMotion.brake+=(target-catMotion.brake)*(1-Math.exp(-dt*24));
  if(cat.ground&&speed>12)catMotion.stride+=speed*dt/96;
  catMotion.idle=cat.ground&&speed<12&&!axis?catMotion.idle+dt:0;
  catMotion.dust=Math.max(0,catMotion.dust-dt);
  if(braking&&catMotion.dust===0){
    const ice=worldIndex()===2&&boards[cat.support]?.ice;
    particles.push({x:cat.x+cat.w/2,y:cat.y+cat.h,vx:-previousVx*.08,vy:-12,life:.18,color:ice?'#c7e3ec':'#c9b791',...(ice?{kind:'ice',size:1,rotation:time,spin:4,maxLife:.18}:{})});
    catMotion.dust=.07;
  }
}
let cleared={};
let available=new Set([0,3,6]);
let continueLevel=0,selectedWorld=0;
let records={},runs={},storageAvailable=true;
function fishKey([x,y]){return x+','+y;}
function levelRevision(i){
  const item=LEVELS[i];
  return JSON.stringify([item.boards,item.traits,item.fish,item.checks,item.winds,item.saws]);
}
function resumableRun(i){
  const run=runs[i];
  if(!run||run.revision!==levelRevision(i))return null;
  if(run.checkpoint!==-1&&!LEVELS[i].checks.includes(run.checkpoint))return null;
  if(!Number.isFinite(run.elapsed)||run.elapsed<0||!Number.isInteger(run.deaths)||run.deaths<0)return null;
  if(!Array.isArray(run.fish)||!run.fish.every(n=>Number.isInteger(n)&&n>=0&&n<LEVELS[i].fish.length))return null;
  return run;
}
function rememberRun(){
  if(state!=='play'&&state!=='pause')return;
  runs[levelIndex]={revision:levelRevision(levelIndex),checkpoint,elapsed,deaths,
    fish:fish.flatMap((item,i)=>item.got?[i]:[])};
  continueLevel=levelIndex;
}
function rememberFish(){
  const record=records[levelIndex]||{fish:[]};
  record.fish=[...new Set([...record.fish,...fish.filter(f=>f.got).map(f=>fishKey([f.x,f.y]))])];
  records[levelIndex]=record;
}
function formatTime(seconds){
  const tenths=Math.round(seconds*10);
  return Math.floor(tenths/600)+':'+String(Math.floor(tenths/10)%60).padStart(2,'0')+'.'+tenths%10;
}
function isLevelUnlocked(i){return available.has(i)||!!LEVELS[i]?.showcase||!!LEVELS[i]?.preview;}
let lessonSeen=new Set(), lastFallWasBridge=false;
function teach(id,message){
  if(lessonSeen.has(id))return;
  lessonSeen.add(id);$('hint').textContent=message;notice(message);
}
function exitIndex(){return level.exit??boards.length-1;}
function crumbleDelay(b){return b?.delay??.65;}
const touchPointers=new Map();
function clearInput(){
  keys.clear();jumpHeld=false;buffer=0;touchPointers.clear();
  for(const b of document.querySelectorAll('[data-key]'))b.setAttribute('aria-pressed','false');
}
function clampLevel(value){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(LEVELS.length-1,Math.floor(n))):0;}
function migrateProgress(oldUnlocked,oldCleared,oldContinue){
  const open=new Set([0,3,6]),done={};
  MERGE_PLAN.forEach(([,sources],i)=>{
    if(sources.some(s=>s%8===0||(s<8&&s<=oldUnlocked)||oldCleared[s]||oldCleared[s-1]))open.add(i);
    if(sources.every(s=>oldCleared[s])){done[i]=true;if(i%3<2)open.add(i+1);}
  });
  const current=MERGE_PLAN.findIndex(([,sources])=>sources.includes(Number(oldContinue)));
  return {available:[...open],cleared:done,continueLevel:Math.max(0,current)};
}
try {
  muted=localStorage.getItem('tiny-trouble-muted')==='true';
  const raw=localStorage.getItem('tiny-trouble-long-v1');
  const saved=raw?JSON.parse(raw):migrateProgress(Number(localStorage.getItem('tiny-trouble-level'))||0,
    JSON.parse(localStorage.getItem('tiny-trouble-cleared')||'{}')||{},localStorage.getItem('tiny-trouble-continue')||0);
  if(saved&&Array.isArray(saved.available)){
    for(const i of saved.available)if(Number.isInteger(i)&&i>=0&&i<LEVELS.length)available.add(i);
    if(saved.cleared&&typeof saved.cleared==='object')cleared=saved.cleared;
    continueLevel=clampLevel(saved.continueLevel);if(!isLevelUnlocked(continueLevel))continueLevel=0;
    LEVELS.forEach((item,i)=>{
      const record=saved.records?.[i];
      if(record&&typeof record==='object'){
        const known=new Set(item.fish.map(fishKey));
        records[i]={fish:Array.isArray(record.fish)?[...new Set(record.fish.filter(key=>known.has(key)))]:[]};
        if(Number.isFinite(record.bestTime)&&record.bestTime>=0)records[i].bestTime=record.bestTime;
        if(Number.isInteger(record.bestDeaths)&&record.bestDeaths>=0)records[i].bestDeaths=record.bestDeaths;
      }
      if(isLevelUnlocked(i)&&saved.runs?.[i]){
        runs[i]=saved.runs[i];
        if(!resumableRun(i))delete runs[i];
      }
    });
  }
}catch{storageAvailable=false;}
function save(){
  rememberRun();
  try{
    localStorage.setItem('tiny-trouble-long-v1',JSON.stringify({available:[...available],cleared,continueLevel,records,runs}));
    localStorage.setItem('tiny-trouble-muted',String(muted));
    storageAvailable=true;
  }catch{storageAvailable=false;}
}
function sound(freq=440,duration=.1,type='sine'){
  if(soundscape){soundscape.voice({frequency:freq,end:freq*.8,duration,type,gain:.03});return;}
  if(muted||!audio)return;
  const o=audio.createOscillator(),g=audio.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.65,audio.currentTime+duration);
  g.gain.setValueAtTime(.055,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);
  o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);
}
function syncAudio(){
  if(!soundscape)return;
  const visible=!document.hidden&&$('selectPanel').hidden,ready=!illustrationLoading;
  soundscape.setMuted(muted);
  soundscape.setScene(chapterAtmosphere(),state==='play'&&visible&&ready,
    ['play','clear','complete'].includes(state)&&visible&&ready);
}
function unlockAudio(){
  if(soundscape){syncAudio();soundscape.unlock();return;}
  try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}
}
function cue(name){if(soundscape)soundscape.cue(name);else sound(name==='fall'?130:650,.12);}
function isMillRoom(x){return levelIndex===7||(levelIndex===8&&x>=1120&&x<2260);}
function usesMillDeck(b){return levelIndex===7||(levelIndex===8&&b?.x>=1120&&b.x<2940);}
function chapterAtmosphere(){return isMillRoom(cat.x)?'mill':['forest','harbor','roof'][worldIndex()];}
function surfaceMaterial(b){return b?.ice?'ice':b?.spring?'soft':b?.belt?'canvas':usesMillDeck(b)||worldIndex()===1||b?.fragile?'wood':worldIndex()===2?'tile':'grass';}
function updateMillMoment(dt){
  if(levelIndex!==7)return;
  if(millMoment.rung){millMoment.age+=dt;return;}
  if(cat.x>boards[2].x+75)millMoment.warned=true;
  if(millMoment.warned&&cat.ground&&cat.support===3){
    millMoment.rung=true;millMoment.age=0;cue('bell');
    burst(boards[2].x+100,H-100,'#eee0b9',14);
  }
}
let noticeTimer;
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').classList.remove('visible'),Math.max(3200,Math.min(6500,text.length*120)));}
function panel(title,description,button,overline='猫的第九次散步'){
  $('overlay').hidden=false;$('heading').textContent=title;$('description').textContent=description;
  $('primary').textContent=button;$('overline').textContent=overline;
  $('secondary').hidden=state==='clear'||state==='complete';
  $('secondary').textContent='重新开始本关';
  $('runSummary').hidden=true;
  $('saveNote').hidden=true;
}
function hud(){
  $('chapter').textContent=(worldIndex()+1)+'-'+(levelIndex%3+1)+' / '+world().name;
  $('levelTitle').textContent=level.name;
  $('fish').textContent=fish.filter(f=>f.got).length+' / '+fish.length;
  $('deaths').textContent=deaths;
  $('checkpoint').textContent=checkpoint<0?'◇ 尚未到达路灯':'◆ 路灯 '+level.checks.filter(i=>boards[i].x<=boards[checkpoint].x).length+' / '+level.checks.length;
  if(!lessonSeen.size)$('hint').textContent=level.sections.findLast(section=>cat.x>=section.x)?.hint||level.hint;
}
function spawn(){
  const p=boards[checkpoint<0?0:checkpoint];
  Object.assign(cat,{x:p.x+25,y:p.y-cat.h,vx:0,vy:0,ground:true,face:1});
  cat.support=checkpoint<0?0:checkpoint;
  for(const b of boards)b.crack=-1;
  clearInput();resetCatMotion();coyote=.1;deathDelay=0;landing=0;lastFallWasBridge=false;
  camera.groundY=p.y;camera.snap=true;updateCamera(0);
}
function loadLevel(i,resume=false){
  levelIndex=i;level=LEVELS[i];checkpoint=-1;time=0;fakeTriggered=false;lessonSeen=new Set();
  Object.assign(millMoment,{warned:false,rung:false,age:0});
  millLanding.age=1;
  Object.assign(lampIgnition,{board:-1,at:-99});
  millDeckCache.clear();
  sceneLabelOpacity.clear();
  W=level.width;
  $('app').setAttribute('data-world',world().scene);
  $('app').setAttribute('data-location',i===7?'mill':world().scene);
  boards=level.boards.map(([x,y,w],index)=>({x,y,w,h:18,...level.traits[index],crack:-1}));
  $('hint').textContent=level.hint;
  fish=level.fish.map(([x,y])=>({x,y,got:false}));
  const run=resume?resumableRun(i):null;
  if(run){
    checkpoint=run.checkpoint;elapsed=run.elapsed;deaths=run.deaths;
    for(const index of run.fish)fish[index].got=true;
  }
  particles=[];spawn();hud();rebuildBackground();
}
function start(i=0,resume=false){
  rememberRun();
  elapsed=0;deaths=0;loadLevel(clampLevel(i),resume);continueLevel=levelIndex;
  state='play';save();$('overlay').hidden=true;$('selectPanel').hidden=true;
  canvas.focus({preventScroll:true});unlockAudio();loadIllustrations();
}
function burst(x,y,color,count=12){for(let i=0;i<count;i++)particles.push({x,y,vx:(Math.random()-.5)*150,vy:-Math.random()*120,life:.4+Math.random()*.3,color});}
function millLandingFeedback(b,speed){
  const force=Math.min(1,speed/650),x=Math.max(b.x+4,Math.min(b.x+b.w-4,cat.x+cat.w/2));
  Object.assign(millLanding,{age:0,x,y:b.y,force});
  const kind=b.ice?'ice':b.belt?'flour':surfaceMaterial(b)==='wood'?'wood':'stone';
  const count=kind==='ice'?6:kind==='stone'?5:8;
  // Feedback follows the actual material, without moving the collision surface.
  for(let i=0;i<count;i++){
    const life=.24+Math.random()*.28;
    particles.push({x:x+(Math.random()-.5)*12,y:b.y-1,
      vx:(Math.random()-.5)*75*force,vy:-(12+Math.random()*42)*force,
      life,maxLife:life,kind,size:.7+Math.random()*1.1,
      rotation:Math.random()*Math.PI,spin:(Math.random()-.5)*7,
      color:kind==='ice'?(i%2?'#cce9ef':'#97bfce'):kind==='stone'?(i%2?'#a6b1bc':'#788a9c'):kind==='flour'?'#e8dcc0':i%2?'#aa8053':'#dfbc83'});
  }
}
function die(reason='失足也没关系，马上再来。'){
  if(state!=='play'||deathDelay>0)return;
  deaths++;deathDelay=.42;shake=5;burst(cat.x+12,cat.y+15,'#ca7957',20);cue('fall');hud();notice(reason);save();
}
function finish(){
  if(state!=='play')return;
  rememberFish();
  const record=records[levelIndex];
  const faster=record.bestTime===undefined||elapsed<record.bestTime;
  const fewer=record.bestDeaths===undefined||deaths<record.bestDeaths;
  record.bestTime=Math.min(record.bestTime??Infinity,elapsed);
  record.bestDeaths=Math.min(record.bestDeaths??Infinity,deaths);
  delete runs[levelIndex];
  state=levelIndex===LEVELS.length-1?'complete':'clear';
  cleared[levelIndex]=true;
  if(levelIndex%3<2)available.add(levelIndex+1);
  continueLevel=Math.min(LEVELS.length-1,levelIndex+1);
  save();clearInput();syncAudio();cue('finish');
  panel(state==='complete'?'到家了，猫猫。':levelIndex%3===2?world().name+'，走过了。':'这一页，走过了。',
    state==='complete'?'磨坊的铃声远了，窗里的灯还亮着。':'每一步，都离家更近了。',
    state==='complete'?'再走一遍 →':'下一关：'+LEVELS[levelIndex+1].name+' →',state==='complete'?'散步结束 / 三章回家路':(worldIndex()+1)+'-'+(levelIndex%3+1)+' COMPLETE');
  $('runSummary').replaceChildren();
  for(const [label,value,best] of [
    ['本关用时',formatTime(elapsed),(faster?'新纪录 · ':'最佳 ')+formatTime(record.bestTime)],
    ['本关跌倒',deaths+' 次',(fewer?'新纪录 · ':'最少 ')+record.bestDeaths+' 次'],
    ['本次鱼干',fish.filter(f=>f.got).length+' / '+fish.length,'已找到 '+record.fish.length+' / '+fish.length]
  ]){
    const stat=document.createElement('div');
    for(const [tag,text] of [['small',label],['strong',value],['small',best]]){
      const item=document.createElement(tag);item.textContent=text;stat.appendChild(item);
    }
    $('runSummary').appendChild(stat);
  }
  $('runSummary').hidden=false;
}
function pause(){
  if(state==='play'){
    state='pause';clearInput();save();panel('歇一会儿。','休息好了，再继续向前走。','继续散步 →');
    showSaveNote();
  }else if(state==='pause'){
    state='play';clearInput();$('overlay').hidden=true;canvas.focus({preventScroll:true});unlockAudio();
  }
  syncAudio();
}
function showSaveNote(){
  $('saveNote').textContent=checkpoint<0?'重新打开可从本关起点继续':'重新打开可从第 '+level.checks.filter(i=>i<=checkpoint).length+' 盏路灯继续';
  if(!storageAvailable)$('saveNote').textContent='当前浏览器无法保存，关闭页面会丢失本次进度。';
  $('saveNote').hidden=false;
}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function update(dt){
  if(state!=='play'||illustrationLoading)return;
  elapsed+=dt;time+=dt;shake=Math.max(0,shake-dt*22);landing=Math.max(0,landing-dt*.6);
  millLanding.age=Math.min(1,millLanding.age+dt);
  for(const p of particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=(p.kind==='ember'?-12:p.kind==='flour'?45:260)*dt;p.life-=dt;if(p.spin)p.rotation+=p.spin*dt;}particles=particles.filter(p=>p.life>0);
  if(deathDelay>0){deathDelay-=dt;if(deathDelay<=0)spawn();return;}
  buffer=Math.max(0,buffer-dt);coyote=cat.ground?.10:Math.max(0,coyote-dt);
  const axis=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  const surface=cat.ground?boards[cat.support]:null;
  const previousVx=cat.vx,previousFace=cat.face;
  const target=axis*240, acceleration=cat.ground?(surface?.ice?(axis?650:180):2400):1800;
  cat.vx+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-cat.vx));if(axis)cat.face=axis;
  if(buffer>0&&coyote>0){cat.vy=surface?.spring?-700:-530;cat.ground=false;catMotion.launch=.12;coyote=0;buffer=0;burst(cat.x+12,cat.y+30,surface?.spring?'#83c7d1':'#ddd2b1',7);cue(surface?.spring?'spring':'jump');}
  if(!jumpHeld&&cat.vy<-210)cat.vy=-210;
  cat.vy+=1200*dt;
  const wind=level.winds.find(z=>cat.x>z.from&&cat.x<z.to);
  const drift=cat.ground?(surface?.belt||0):(wind?.speed||0);
  cat.x=Math.max(0,Math.min(W-cat.w,cat.x+(cat.vx+drift)*dt));
  const previousBottom=cat.y+cat.h,fallSpeed=cat.vy;cat.y+=cat.vy*dt;cat.ground=false;
  for(let i=0;i<boards.length;i++){
    const b=boards[i];if(b.crack>=0)b.crack+=dt;if(b.crack>crumbleDelay(b))continue;
    if(cat.x+cat.w>b.x+2&&cat.x<b.x+b.w-2&&previousBottom<=b.y+.5&&cat.y+cat.h>=b.y&&cat.vy>=0){
      cat.y=b.y-cat.h;cat.vy=0;cat.ground=true;cat.support=i;
      if(b.spring)teach('spring','在蓝色软垫上按住跳跃，可以跳得更高。');
      if(b.ice)teach('ice','薄霜会滑。轻按反方向，可以更快停下。');
      if(b.belt)teach('belt',usesMillDeck(b)?'浅色帆布运粮带会带你走，跳到木台就能停稳。':'箭头屋瓦会推着你走，起跳就能离开它。');
      if(fallSpeed>150){landing=Math.min(.075,fallSpeed/800*.075);if(worldIndex()===2)millLandingFeedback(b,fallSpeed);else burst(cat.x+12,b.y,'#e4d5b6',8);if(soundscape)soundscape.surface(surfaceMaterial(b),Math.min(1.5,fallSpeed/450));else sound(180,.045,'triangle');}
      if(b.source===0&&b.local===1)teach('jump','跳得不错。前面的路灯可以歇脚。');
      if(b.fragile&&b.crack<0){
        b.crack=0;lastFallWasBridge=true;cue('crack');
        if(b.source===0)teach('bridge','咔嚓……木板在摇晃，往右跳！');
        else notice('咔嚓……这块木板要塌了！');
      }
      if(level.checks.includes(i)&&(checkpoint<0||b.x>boards[checkpoint].x)){checkpoint=i;cue('lamp');Object.assign(lampIgnition,{board:i,at:time});
        const lamp=lampCenter(b.x+40,b.y);
        for(let spark=0;spark<5;spark++)particles.push({x:lamp.x+(Math.random()-.5)*8,y:lamp.y,vx:(Math.random()-.5)*12,vy:-8-Math.random()*12,life:.45+Math.random()*.35,maxLife:.8,kind:'ember',size:.5+Math.random()*.45,color:'#f6d79b'});
        if(b.source===0)teach('lamp','路灯已点亮。前面的裂纹板，别停太久。');
        else notice('路灯点亮，跌倒后从这里继续。');hud();save();}
      if(levelIndex===0&&i===level.rescue)teach('rescue','接住你了。从右边的小台阶回去就好。');
      if(i===exitIndex()&&cat.x>(level.finishX??b.x+24)){finish();return;}
    }
  }
  updateCatMotion(dt,axis,previousVx,previousFace);
  updateMillMoment(dt);
  if(soundscape&&soundscape.scene!==chapterAtmosphere())syncAudio();
  const machine=isMillRoom(cat.x)?boards.filter(b=>b.belt).reduce((nearest,b)=>{
    const offset=b.x+b.w/2-cat.x,distance=Math.abs(offset);
    return distance<nearest.distance?{distance,pan:offset/400}:nearest;
  },{distance:Infinity,pan:0}):{distance:Infinity,pan:0};
  soundscape?.walk(dt,cat.ground?Math.abs(cat.vx):0,surfaceMaterial(boards[cat.support]),machine);
  const hurt={x:cat.x+4,y:cat.y+4,w:cat.w-8,h:cat.h-5};
  for(const [x,y,w] of level.thorns)if(overlap(hurt,{x:x+3,y:y+3,w:w-6,h:11})){die('荆棘扎脚，跳过去就好。');return;}
  for(const s of level.saws){const sx=swingFruitPosition(s).x;const nx=Math.max(hurt.x,Math.min(sx,hurt.x+hurt.w)),ny=Math.max(hurt.y,Math.min(s.y,hurt.y+hurt.h));if(Math.hypot(sx-nx,s.y-ny)<s.r){die('等飞果离开，再起跳。');return;}}
  for(const f of fish)if(!f.got&&Math.hypot(cat.x+12-f.x,cat.y+15-f.y)<25){f.got=true;rememberFish();save();cue('fish');burst(f.x,f.y,'#c49243',10);hud();}
  const section=level.sections.findLast(s=>cat.x>=s.x);
  if(section&&section!==level.sections[0])teach('section-'+section.source,section.name+' · '+section.hint);
  if(cat.y>H+40)die(lastFallWasBridge?'裂纹板会塌。路灯已记住你，下次及时起跳。':'失足也没关系，马上再来。');
}
// Cached illustration: deterministic ink lines, layered foliage and paper flecks.
const background=document.createElement('canvas');background.width=W;background.height=H;
let bg=background.getContext('2d'), seed=19;
function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function line(c,points,color,width=1){c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function rebuildBackground(){
  const W=960;
  seed=19+levelIndex;const c=bg;c.fillStyle=level.palette[0];c.fillRect(0,0,W,H);
  if(level.scene){drawChapterBackground(c);return;}
  oval(c,734,105,51,51,'#f9efcf');
  // Broad curved hills instead of sharp polygon mountains.
  for(let layer=0;layer<3;layer++){
    c.fillStyle=[level.palette[1],level.palette[2],'#708a70'][layer];c.globalAlpha=layer===2?.34:.58;
    c.beginPath();c.moveTo(0,H);c.lineTo(0,280+layer*75);
    for(let x=0;x<W;x+=160)c.quadraticCurveTo(x+70,190+layer*90+rand()*65,x+160,280+layer*75);
    c.lineTo(W,H);c.closePath();c.fill();
  }c.globalAlpha=1;
  for(let j=0;j<14;j++){
    const x=j*78-25,y=325+rand()*100,h=95+rand()*140;
    c.globalAlpha=.23;line(c,[[x,y+60],[x+6,y-h]],'#5c7363',4);
    for(let k=0;k<6;k++){const yy=y-h+k*28;oval(c,x+(k%2?17:-17),yy,26+k*3,25,'#6a8973');}
  }c.globalAlpha=1;
  // Foreground framing branches keep the central jump path clear.
  for(const x of [14,942]){
    line(c,[[x,540],[x+7,275],[x-9,90],[x+6,-20]],'#6d7054',17);
    line(c,[[x+1,420],[x-2,200],[x+4,0]],'#9c9b71',5);
    for(let j=0;j<8;j++){const y=30+j*24,d=x<100?1:-1;
      line(c,[[x,y+50],[x+d*60,y]],'#6d7054',4);
      oval(c,x+d*(25+j%3*18),y,29,13,['#94a574','#a4af7c','#7e966e'][j%3]);
    }
  }
  for(let i=0;i<12500;i++){c.fillStyle=i%2?'#fff7dc':'#625539';c.globalAlpha=.025+rand()*.05;c.fillRect(rand()*W,rand()*H,rand()*2+.3,.7);}c.globalAlpha=1;
  // Floating seeds and distant ink birds.
  for(let i=0;i<7;i++){const x=170+i*93,y=72+rand()*100;line(c,[[x-5,y],[x,y+3],[x+6,y-1]],'#828778',1);}
}
function paperGrain(c){
  const W=960;
  for(let i=0;i<10000;i++){c.fillStyle=i%2?'#fff5d7':'#1d2a40';c.globalAlpha=.025+rand()*.035;c.fillRect(rand()*W,rand()*H,1.5,.7);}c.globalAlpha=1;
}
function drawChapterBackground(c){
  const W=960;
  if(level.showcase){
    c.fillStyle='#dce7e3';c.fillRect(0,0,W,H);oval(c,755,105,40,40,'#f5edcf');
    c.fillStyle='#b5c9c5';c.beginPath();c.moveTo(0,285);c.quadraticCurveTo(240,175,480,276);c.quadraticCurveTo(720,210,960,283);c.lineTo(960,325);c.lineTo(0,325);c.fill();
    c.fillStyle='#adcbd0';c.fillRect(0,300,W,240);
    for(let i=0;i<85;i++){const x=rand()*W,y=310+rand()*230;line(c,[[x,y],[x+10+rand()*45,y-1]],i%2?'#dbe8e4':'#91b5bf',1);}
    for(let i=0;i<5;i++){const x=130+i*170,y=250+rand()*30;line(c,[[x,y],[x+4,y+2],[x+8,y-1]],'#7f9b9e',1);}
    paperGrain(c);return;
  }
  if(level.scene==='harbor'){
    // Open water, cargo sheds, masts and mooring ropes replace all forest silhouettes.
    c.fillStyle='#b5d0d5';c.fillRect(0,280,W,260);
    oval(c,720,100,42,42,'#f8edcc');
    for(let i=0;i<7;i++){
      const x=i*156-25,y=260+rand()*25;
      c.fillStyle='#799caa';c.fillRect(x,y-70,100,70);
      c.fillStyle='#6d8b99';c.beginPath();c.moveTo(x-8,y-70);c.lineTo(x+50,y-103);c.lineTo(x+108,y-70);c.fill();
      line(c,[[x+120,y],[x+120,y-170],[x+190,y-150],[x+120,y-130]],'#7f9ba4',3);
      for(let j=0;j<3;j++)c.fillRect(x+12+j*25,y-50,12,23);
    }
    for(let i=0;i<55;i++){const x=rand()*W,y=300+rand()*240;line(c,[[x,y],[x+12+rand()*36,y-1]],i%2?'#e3eded':'#91b4bf',1);}
    for(const x of [80,410,790]){
      line(c,[[x,335],[x,190],[x+42,272]],'#6e8792',2);
      c.fillStyle='#e8dfc2';c.beginPath();c.moveTo(x+4,204);c.lineTo(x+38,271);c.lineTo(x+4,271);c.fill();
      c.fillStyle='#688e9b';c.beginPath();c.moveTo(x-24,337);c.lineTo(x+42,337);c.lineTo(x+30,351);c.lineTo(x-10,351);c.fill();
    }
    for(const x of [10,946]){line(c,[[x,540],[x,180]],'#7e8172',13);line(c,[[x,280],[x+15,300],[x-10,318],[x+14,336]],'#d0c3a0',3);}
  }else{
    // Night skyline, tiled roofs, lit windows and chimneys; no recolored trees.
    oval(c,742,85,38,38,'#eee3bd');
    for(let i=0;i<60;i++)oval(c,rand()*W,rand()*260,.7+rand(),.7+rand(),'#d8d9df');
    for(let layer=0;layer<2;layer++)for(let i=0;i<12;i++){
      const x=i*90-20,y=230+layer*100+rand()*55,w=65+rand()*40;
      c.fillStyle=layer?'#515c7a':'#67728e';c.fillRect(x,y,w,H-y);
      c.fillStyle=layer?'#404e6d':'#576780';c.beginPath();c.moveTo(x-7,y);c.lineTo(x+w*.5,y-36);c.lineTo(x+w+8,y);c.fill();
      for(let k=0;k<3;k++)for(let j=0;j<2;j++){
        c.fillStyle=(i+j+k)%3?'#a4a1a3':'#d8ba7f';c.fillRect(x+12+j*27,y+20+k*35,11,16);
      }
      c.fillStyle='#424d68';c.fillRect(x+10,y-35,12,24);
    }
    line(c,[[0,170],[210,200],[440,178],[690,202],[960,161]],'#717991',1.3);
    for(let i=0;i<8;i++)line(c,[[i*135,0],[i*135,40+(i%3)*15]],'#68728e',2);
  }
  paperGrain(c);
}
function drawBoard(b,i){
  if(b.crack>crumbleDelay(b))return;
  if(worldIndex()===2&&(b.x+b.w<camera.x-70||b.x>camera.x+camera.w+70))return;
  const urgency=b.crack<0?0:b.crack/crumbleDelay(b);
  const jitter=urgency>0?Math.sin(time*65)*urgency*2:0;
  ctx.save();ctx.translate(jitter,0);
  if(worldIndex()===0&&illustrations.environment)drawPaintedPlatform(b);
  else if(worldIndex()===1&&illustrations.harborEnvironment)drawPaintedDock(b);
  else if(worldIndex()===2&&b.fragile&&illustrations.millExterior)drawMillExteriorBoard(b);
  else if(usesMillDeck(b)&&illustrations.millEnvironment)drawMillBoard(b);
  else if(worldIndex()===2&&!usesMillDeck(b)&&illustrations.millExterior)drawMillExteriorBoard(b);
  else if(worldIndex()===2&&illustrations.rooftopEnvironment)drawPaintedRoof(b);
  else{
  ctx.fillStyle=b.bonus?'#c99b78':b.ice?'#a6d6e7':worldIndex()===2?'#6e789b':worldIndex()===1?'#a4b8b6':b.fragile?'#b79b75':'#b9b08a';ctx.strokeStyle=worldIndex()===2?'#3c4866':'#68634d';ctx.lineWidth=1.6;
  ctx.beginPath();ctx.moveTo(b.x,b.y+1);ctx.lineTo(b.x+b.w,b.y);ctx.lineTo(b.x+b.w-4,b.y+19);ctx.lineTo(b.x+5,b.y+22);ctx.closePath();ctx.fill();ctx.stroke();
  line(ctx,[[b.x+4,b.y+6],[b.x+b.w-5,b.y+5]],'#eee3bb',3);
  for(let x=b.x+12;x<b.x+b.w-8;x+=22)line(ctx,[[x,b.y+12],[x+13,b.y+11]],'#83785b',.8);
  if(b.fragile)line(ctx,[[b.x+b.w*.55,b.y+1],[b.x+b.w*.47,b.y+9],[b.x+b.w*.6,b.y+14],[b.x+b.w*.52,b.y+21]],'#67503f',1.5);
  else if(worldIndex()===0&&!b.bonus)for(let x=b.x+9;x<b.x+b.w-7;x+=14){line(ctx,[[x,b.y],[x-3,b.y-5],[x+1,b.y-2],[x+4,b.y-7]],'#607654',1);}
  }
  if(b.spring&&!(worldIndex()===1&&illustrations.harborEnvironment)){
    ctx.fillStyle='#83c7d1';ctx.beginPath();ctx.moveTo(b.x+4,b.y);ctx.quadraticCurveTo(b.x+b.w*.5,b.y-13,b.x+b.w-4,b.y);ctx.fill();
    line(ctx,[[b.x+12,b.y+15],[b.x+23,b.y+8],[b.x+34,b.y+15],[b.x+45,b.y+8]],'#527c8c',1.6);
  }
  if(b.ice&&worldIndex()!==2)for(let x=b.x+10;x<b.x+b.w-15;x+=25)line(ctx,[[x,b.y+5],[x+12,b.y+2]],'#e6f5fc',2);
  if(b.belt){
    const direction=Math.sign(b.belt);
    for(const x of [b.x+18,b.x+b.w-18])line(ctx,[[x-direction*3,b.y+11],[x+direction*3,b.y+14],[x-direction*3,b.y+17]],'#dfc793',1);
  }
  if(level.checks.includes(i)){
    const lit=checkpoint>=0&&b.x<=boards[checkpoint].x;
    if(illustrations.environment)drawPaintedLamp(b.x+40,b.y,lit,i);
    else{
    line(ctx,[[b.x+40,b.y],[b.x+40,b.y-64]],'#6c6650',3);
    ctx.fillStyle=lit?'#eed48c':'#b0b2a0';ctx.fillRect(b.x+32,b.y-66,16,22);
    ctx.strokeStyle='#71694d';ctx.strokeRect(b.x+32,b.y-66,16,22);
    if(lit){ctx.globalAlpha=.16;oval(ctx,b.x+40,b.y-55,29,32,'#ffe0a0');ctx.globalAlpha=1;}
    }
  }
  ctx.restore();
}
function drawPaintedPlatform(b){
  const image=illustrations.environment;
  const frame=b.bonus?{x:1024,y:196,h:190,top:20}:b.fragile?{x:512,y:196,h:170,top:20}:{x:0,y:150,h:245,top:94};
  const scale=.2,cap=Math.min(18,b.w/3),y=b.y-frame.top*scale;
  // Separate end caps preserve the painted outline on both short and wide ledges.
  ctx.drawImage(image,frame.x,frame.y,90,frame.h,b.x,y,cap,frame.h*scale);
  ctx.drawImage(image,frame.x+90,frame.y,332,frame.h,b.x+cap,y,b.w-cap*2,frame.h*scale);
  ctx.drawImage(image,frame.x+422,frame.y,90,frame.h,b.x+b.w-cap,y,cap,frame.h*scale);
  if(b.fragile)line(ctx,[[b.x+b.w*.5,b.y+1],[b.x+b.w*.48,b.y+8],[b.x+b.w*.53,b.y+15]],'#62442f',1.5);
}
function lampCenter(x,y){return illustrations.environment?{x:x+14.8,y:y-46.5}:{x,y:y-55};}
function lampStrength(index){
  const age=index===lampIgnition.board?time-lampIgnition.at:10;
  const rise=Math.min(1,Math.max(0,age)/.24);
  return rise*(1+(age<.8?Math.sin(Math.min(1,age/.8)*Math.PI)*.35:0));
}
// Adapted from the reference's separation of emission, surface lighting and bloom.
// A small reusable alpha-masked surface keeps light on the painted art itself.
let millReceiverCanvas=null;
const millDeckCache=new Map();
function millLightSources(){
  if(worldIndex()!==2)return [];
  const sources=[];
  for(const index of level.checks){
    const b=boards[index];
    if(checkpoint<0||b.x>boards[checkpoint].x)continue;
    const center=lampCenter(b.x+40,b.y);
    sources.push({...center,radius:142,power:lampStrength(index),board:index});
  }
  const exit=chapterExitLight();
  sources.push({...exit,power:1,board:exitIndex()});
  return sources;
}
function chapterExitLight(){
  const end=boards[exitIndex()];
  return levelIndex===8?{x:Math.min(level.finishX+12,W-90)-47,y:end.y-80,radius:190}:
    {x:level.finishX+(levelIndex===7?24:12),y:end.y-65,radius:levelIndex===7?200:155};
}
function millLitSurface(w,h,paint,toLocal,material='wood'){
  if(!millReceiverCanvas){
    millReceiverCanvas=document.createElement('canvas');
    millReceiverCanvas.width=1024;millReceiverCanvas.height=256;
  }
  const c=millReceiverCanvas.getContext('2d'),density=4;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,Math.ceil(w*density),Math.ceil(h*density));
  c.save();c.scale(density,density);paint(c);
  c.globalCompositeOperation='source-atop';
  c.fillStyle=material==='fur'?'rgba(36,55,76,.09)':material==='ice'?'rgba(54,89,120,.10)':material==='stone'?'rgba(29,48,73,.15)':'rgba(27,46,67,.23)';
  c.fillRect(0,0,w,h);
  for(const source of millLightSources()){
    const p=toLocal(source),r=source.radius;
    if(p.x+r<0||p.x-r>w||p.y+r<0||p.y-r>h)continue;
    const alpha=Math.min(1.3,source.power)*(material==='fur'?.22:.38);
    const glow=c.createRadialGradient(p.x,p.y,1,p.x,p.y,r);
    glow.addColorStop(0,`rgba(255,210,132,${alpha})`);
    glow.addColorStop(.4,`rgba(248,182,92,${alpha*.65})`);
    glow.addColorStop(1,'rgba(248,182,92,0)');
    c.fillStyle=glow;c.fillRect(0,0,w,h);
  }
  c.restore();
  return millReceiverCanvas;
}
function millCachedSurface(b,h,paint,toLocal,material='wood'){
  const key=checkpoint+':'+lampStrength(lampIgnition.board).toFixed(2)+':'+!!illustrations.environment;
  let cached=millDeckCache.get(b);
  if(!cached){
    const bitmap=document.createElement('canvas');bitmap.width=b.w*4;bitmap.height=h*4;
    cached={bitmap,key:null};millDeckCache.set(b,cached);
  }
  if(cached.key!==key){
    const surface=millLitSurface(b.w,h,paint,toLocal,material);
    const c=cached.bitmap.getContext('2d');c.clearRect(0,0,cached.bitmap.width,cached.bitmap.height);
    c.drawImage(surface,0,0,b.w*4,h*4,0,0,b.w*4,h*4);cached.key=key;
  }
  return cached.bitmap;
}
function drawMillLampBounce(){
  if(worldIndex()!==2)return;
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const source of millLightSources()){
    const r=source.radius;
    if(source.x+r<camera.x||source.x-r>camera.x+camera.w)continue;
    const light=ctx.createRadialGradient(source.x,source.y,4,source.x,source.y,r);
    light.addColorStop(0,`rgba(255,190,99,${.18*source.power})`);
    light.addColorStop(.4,`rgba(239,157,70,${.075*source.power})`);
    light.addColorStop(1,'rgba(239,157,70,0)');
    ctx.fillStyle=light;ctx.fillRect(source.x-r,source.y-r,r*2,r*2);
  }
  ctx.restore();
}
function drawMillCastShadow(){
  if(worldIndex()!==2||deathDelay>0)return;
  const b=catContactSurface();if(!b)return;
  const foot=cat.y+cat.h,center=cat.x+cat.w/2,height=b.y-foot;
  // A shadow can only land on an actual nearby deck, never across a gap.
  const source=millLightSources().filter(s=>s.y<foot-8&&Math.abs(s.x-center)<s.radius)
    .sort((a,b)=>Math.abs(a.x-center)-Math.abs(b.x-center))[0];
  if(!source)return;
  const reach=Math.max(-65,Math.min(65,(center-source.x)*.65));
  const contact=1-Math.max(0,height)/80,power=Math.max(0,1-Math.abs(source.x-center)/source.radius);
  ctx.save();ctx.beginPath();ctx.rect(b.x+1,b.y,b.w-2,12);ctx.clip();
  const shadow=ctx.createLinearGradient(center,b.y,center+reach,b.y+5);
  shadow.addColorStop(0,`rgba(28,29,36,${.32*power*contact*source.power})`);
  shadow.addColorStop(1,'rgba(28,29,36,0)');
  ctx.fillStyle=shadow;
  for(let edge=0;edge<5;edge++){
    ctx.globalAlpha=.2;ctx.beginPath();
    ctx.ellipse(center+reach*.45,b.y+2.5,Math.abs(reach)*.55+8+edge,1.1+edge*.45,0,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}
function drawPaintedLamp(x,y,lit,index){
  ctx.save();
  ctx.drawImage(illustrations.environment,655,540,235,460,x-13,y-72.2,37.6,73.6);
  // Shade only the four glass panes, preserving the original brass frame and crossbars.
  ctx.save();ctx.beginPath();
  const panes=[[[10.5,-50],[14.3,-46.6],[10.7,-43]],[[11.1,-50.6],[18.5,-50.6],[14.8,-47.1]],
    [[19,-50],[19,-43],[15.4,-46.6]],[[11.2,-42.4],[14.8,-46],[18.5,-42.4]]];
  for(const pane of panes){ctx.moveTo(x+pane[0][0],y+pane[0][1]);for(const p of pane.slice(1))ctx.lineTo(x+p[0],y+p[1]);ctx.closePath();}
  ctx.clip();
  const strength=lit?lampStrength(index):0;
  ctx.fillStyle=`rgba(35,43,46,${.94*(1-Math.min(1,strength))})`;
  ctx.fillRect(x+9,y-52,12,12);
  if(lit){
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=.5*Math.min(1.3,strength);
    const core=ctx.createRadialGradient(x+14.8,y-46,0,x+14.8,y-46,6);
    core.addColorStop(0,'#fff5ca');core.addColorStop(.45,'#ffc45f');core.addColorStop(1,'rgba(255,170,61,0)');
    ctx.fillStyle=core;ctx.fillRect(x+9,y-52,12,12);
  }
  ctx.restore();ctx.restore();
}
function drawCheckpointGlow(){
  ctx.save();ctx.globalCompositeOperation='screen';
  for(const index of level.checks){
    const b=boards[index];
    if(checkpoint<0||b.x>boards[checkpoint].x||b.x+110<camera.x||b.x>camera.x+camera.w)continue;
    const lamp=lampCenter(b.x+40,b.y),strength=lampStrength(index);
    const night=worldIndex()===2,alpha=(night?.25:.18)*strength,r=night?49:38;
    const glow=ctx.createRadialGradient(lamp.x,lamp.y,1,lamp.x,lamp.y,r);
    glow.addColorStop(0,`rgba(255,214,136,${alpha})`);
    glow.addColorStop(.28,`rgba(255,192,94,${alpha*.48})`);
    glow.addColorStop(1,'rgba(245,174,74,0)');
    ctx.fillStyle=glow;ctx.fillRect(lamp.x-r,lamp.y-r,r*2,r*2);
    // A soft pool sits on the real deck; clipping prevents light floating over gaps.
    ctx.save();ctx.beginPath();ctx.rect(b.x,b.y-3,b.w,14);ctx.clip();
    ctx.translate(lamp.x,b.y+1);ctx.scale(1,.16);
    const pool=ctx.createRadialGradient(0,0,0,0,0,44);
    pool.addColorStop(0,`rgba(255,203,114,${strength*(night?.34:.22)})`);
    pool.addColorStop(1,'rgba(255,188,89,0)');
    ctx.fillStyle=pool;ctx.fillRect(-44,-44,88,88);ctx.restore();
  }
  ctx.restore();
}
function drawPaintedDock(b){
  const image=illustrations.harborEnvironment;
  const sourceX=b.spring?512:0,sourceY=b.spring?244:180;
  // Use the cushion's stitched front face so its upper edge follows the flat collider.
  const sourceHeight=b.spring?136:205,scale=.2;
  const top=b.spring?2:28,cap=Math.min(18,b.w/3),y=b.y-top*scale;
  ctx.drawImage(image,sourceX,sourceY,90,sourceHeight,b.x,y,cap,sourceHeight*scale);
  ctx.drawImage(image,sourceX+90,sourceY,332,sourceHeight,b.x+cap,y,b.w-cap*2,sourceHeight*scale);
  ctx.drawImage(image,sourceX+422,sourceY,90,sourceHeight,b.x+b.w-cap,y,cap,sourceHeight*scale);
}
function drawMillBoard(b){
  const image=illustrations.millEnvironment,sourceX=b.belt?512:0;
  const y=b.y-1,cap=24,height=34;
  // A complete wooden machine frame remains stationary below the moving canvas.
  if(worldIndex()===2){
    // Timber lighting is static between checkpoint transitions. Cache its painted
    // result; the canvas belt and the cat still animate independently every frame.
    const surface=millCachedSurface(b,height,c=>{
      c.drawImage(image,sourceX,210,120,170,0,0,cap,height);
      c.drawImage(image,sourceX+120,210,272,170,cap,0,b.w-cap*2,height);
      c.drawImage(image,sourceX+392,210,120,170,b.w-cap,0,cap,height);
    },source=>({x:source.x-b.x,y:source.y-y}));
    ctx.drawImage(surface,b.x,y,b.w,height);
  }else{
    ctx.drawImage(image,sourceX,210,120,170,b.x,y,cap,height);
    ctx.drawImage(image,sourceX+120,210,272,170,b.x+cap,y,b.w-cap*2,height);
    ctx.drawImage(image,sourceX+392,210,120,170,b.x+b.w-cap,y,cap,height);
  }
  ctx.save();ctx.globalAlpha=.26;
  line(ctx,[[b.x+4,b.y+.5],[b.x+b.w-4,b.y+.5]],b.belt?'#fff1cd':'#f3d4a5',.8);
  ctx.restore();
  if(worldIndex()===2&&!b.belt&&millLanding.age<.32&&Math.abs(millLanding.y-b.y)<1&&millLanding.x>=b.x&&millLanding.x<=b.x+b.w){
    const t=millLanding.age/.32;
    ctx.save();ctx.globalAlpha=(1-t)*millLanding.force*.32;
    line(ctx,[[Math.max(b.x+4,millLanding.x-12-t*24),b.y+9],[millLanding.x,b.y+10+Math.sin(t*Math.PI*3)*(1-t)],[Math.min(b.x+b.w-4,millLanding.x+12+t*24),b.y+9]],'#f4d7a6',.8);
    ctx.restore();
  }
  if(b.belt){
    const left=b.x+cap,right=b.x+b.w-cap,tile=54.4;
    const offset=((time*b.belt)%tile+tile)%tile;
    ctx.save();ctx.beginPath();ctx.rect(left,y,right-left,6);ctx.clip();
    for(let x=left-tile+offset;x<right;x+=tile)ctx.drawImage(image,sourceX+120,210,272,30,x,y,tile,6);
    ctx.restore();
    // Wooden hubs and their cross spokes show the same direction as surface drift.
    for(const x of [b.x+9,b.x+b.w-9]){
      const angle=time*b.belt*.06,dx=Math.cos(angle)*3,dy=Math.sin(angle)*3;
      line(ctx,[[x-dx,b.y+13-dy],[x+dx,b.y+13+dy]],'#ba945e',1);
    }
  }
}
function drawMillStructure(b){
  const image=illustrations.millEnvironment;
  if(!image)return;
  for(const x of [b.x+24,b.x+b.w-24])ctx.drawImage(image,1160,0,240,512,x-17,b.y+18,34,H-b.y-18);
  if(b.belt){
    const x=b.x+b.w*.5,y=b.y+77;
    ctx.drawImage(image,1160,0,240,512,x-12,b.y+35,24,H-b.y-35);
    ctx.save();ctx.translate(x,y);ctx.rotate(time*b.belt*.018);
    ctx.drawImage(image,512,512,512,512,-27,-27,54,54);ctx.restore();
    line(ctx,[[b.x+9,b.y+13],[x-20,y],[x+20,y],[b.x+b.w-9,b.y+13]],'#9e8156',2);
  }
}
function drawMillLandmarks(){
  if(!illustrations.millEnvironment)return;
  const image=illustrations.millEnvironment;
  ctx.save();ctx.globalAlpha=.66;
  for(const b of boards){
    if(b.x+b.w<camera.x-120||b.x>camera.x+camera.w+120)continue;
    drawMillStructure(b);
  }
  for(const section of level.sections){
    const b=boards[section.board],x=b.x+b.w*.65;
    if(x<camera.x-180||x>camera.x+camera.w+180)continue;
    // The grain hopper belongs to the lower background bay, below the playable deck.
    if(section.kind==='hopper')ctx.drawImage(image,0,512,512,512,b.x+48,H-112,112,112);
  }
  ctx.restore();
  for(const section of level.sections){
    const b=boards[section.board],x=b.x+b.w*.65;
    if(x<camera.x-180||x>camera.x+camera.w+180)continue;
    if(!illustrations.millRooms||section.kind==='hopper'||section.kind==='pulley')sceneLabel(section.name+' →',x,b.y-137,{center:true});
  }
  const end=boards[exitIndex()];
  ctx.drawImage(image,1024,512,512,512,level.finishX-45,end.y-146,153,153);
  drawMillBell();
}
function drawMillBell(){
  const b=boards[3],x=b.x+b.w*.5,y=b.y-99;
  if(x<camera.x-100||x>camera.x+camera.w+100)return;
  const age=millMoment.age,swing=millMoment.rung?Math.sin(age*19)*Math.exp(-age*2.7)*.27:Math.sin(time*1.2)*.012;
  line(ctx,[[x,y-55],[x,y-22]],'#9e825a',1.2);
  ctx.save();ctx.translate(x,y-22);ctx.rotate(swing);
  if(illustrations.millBell)ctx.drawImage(illustrations.millBell,470,60,600,900,-19,0,38,57);
  else{oval(ctx,0,22,10,12,'#b99754');oval(ctx,0,32,13,3,'#d5b16c');}
  ctx.restore();
  if(!millMoment.rung)sceneLabel('嘘，铃铛在打盹…',b.x+10,y-32,{center:true});
  else if(age<2.4)sceneLabel('叮——谁把磨坊叫醒了？',x,y-32,{center:true});
  if(millMoment.rung&&age<1.2){
    ctx.save();ctx.globalAlpha=(1-age/1.2)*.4;
    for(const side of [-1,1])line(ctx,[[x+side*24,y],[x+side*30,y+8],[x+side*24,y+16]],'#f4d895',1);
    ctx.restore();
  }
}
// Each authored room has its own fixed back wall and a small amount of parallax.
function millRoomFrame(room){
  const width=Math.max(810,room.to-room.from+160,(H-room.top)*1.5),center=(room.from+room.to)/2;
  return {x:center-width/2+(camera.x+camera.w/2-center)*.035,y:room.top,w:width,h:width*2/3};
}
function drawMillRooms(){
  const image=illustrations.millRooms;
  if(!image)return false;
  ctx.fillStyle='#566265';ctx.fillRect(camera.x,0,camera.w,H);
  for(const room of MILL_ROOMS){
    const frame=millRoomFrame(room);
    if(room.to<camera.x||room.from>camera.x+camera.w)continue;
    const detail=illustrations[room.asset],source=detail||image;
    const sw=(source.naturalWidth||1536)/(detail?1:2),sh=(source.naturalHeight||1024)/(detail?1:2);
    const inset=detail?(room.inset||0):0;
    ctx.save();ctx.beginPath();ctx.rect(room.from,0,room.to-room.from,H);ctx.clip();
    ctx.drawImage(source,(detail?0:room.col*sw)+sw*inset,detail?0:room.row*sh,sw*(1-inset*2),sh,frame.x,frame.y,frame.w,frame.h);
    ctx.restore();
  }
  return true;
}
// Window light shares the exact back-wall transform, including room parallax.
function drawMillAir(){
  if(levelIndex!==7&&levelIndex!==8)return;
  ctx.save();
  if(levelIndex===8)clipAtticInterior();
  ctx.fillStyle=levelIndex===8||illustrations.millRooms?'rgba(23,36,54,.15)':'rgba(23,36,54,.22)';ctx.fillRect(camera.x,0,camera.w,H);
  const shafts=[];
  if(levelIndex===8||illustrations.millRooms){
    for(const room of levelIndex===8?MILL_JOURNEYS[8]:MILL_ROOMS){
      if(!room.window)continue;
      const frame=millRoomFrame(room);
      const inset=illustrations[room.asset]?(room.inset||0):0;
      shafts.push({x:frame.x+frame.w*(room.window.x-inset)/(1-inset*2),top:frame.y+frame.h*room.window.y,length:room.window.length});
    }
  }else{
  const width=810,offset=camera.x*.18;
  for(let tile=Math.floor(offset/width)-1;tile<=Math.floor((offset+camera.w)/width)+1;tile++){
    shafts.push({x:tile*width+camera.x*.82+(tile%2?395:415),top:64,length:441});
  }
  }
  for(const shaft of shafts){
    const {x,top}=shaft,bottom=top+shaft.length;
    if(x<camera.x-80||x-225>camera.x+camera.w)continue;
    const light=ctx.createLinearGradient(x,top,x-160,bottom);
    light.addColorStop(0,'rgba(193,216,239,.12)');
    light.addColorStop(.48,'rgba(193,216,239,.05)');
    light.addColorStop(1,'rgba(193,216,239,0)');
    ctx.fillStyle=light;ctx.globalAlpha=1/16;
    // Nested translucent ribbons feather the shaft instead of leaving a hard triangle.
    for(let feather=0;feather<16;feather++){
      const width=1-feather*.044;
      ctx.beginPath();ctx.moveTo(x-15*width,top);ctx.lineTo(x+15*width,top);
      ctx.lineTo(x-180+80*width,bottom);ctx.lineTo(x-180-80*width,bottom);ctx.closePath();ctx.fill();
    }
    // Dust stays in the light volume, with gentle drift and no particle spawning.
    for(let i=0;i<32;i++){
      const phase=((i*.6180339+time*.013)%1+1)%1;
      const y=top+phase*(bottom-top),spread=12+phase*68;
      const px=x-phase*182+Math.sin(i*7.31+time*.23)*spread;
      ctx.globalAlpha=Math.sin(phase*Math.PI)*(.18+(i%4)*.065);
      oval(ctx,px,y,.45+i%3*.17,.5+i%3*.19,i%3?'#d4dfe5':'#f9e7bd');
    }
    ctx.globalAlpha=1;
  }
  ctx.restore();
}
function drawMillGrain(){
  if(worldIndex()!==2)return;
  ctx.save();
  for(const b of boards){
    if(!b.belt||b.x+b.w<camera.x-70||b.x>camera.x+camera.w+70)continue;
    const direction=Math.sign(b.belt),edge=direction>0?b.x+b.w-7:b.x+7;
    // Grain rides along the back edge, then trickles into a lower collection bay.
    ctx.globalAlpha=.72;
    for(let i=0;i<15;i++){
      const progress=((i/15+time*b.belt/b.w)%1+1)%1;
      const x=b.x+10+progress*(b.w-20);
      oval(ctx,x,b.y-2-(i%3)*.35,1.15,.55,i%3?'#d8ba78':'#f1d6a0');
    }
    for(let i=0;i<12;i++){
      const p=(time*.7+i/12)%1,x=edge+direction*(p*13)+Math.sin(i*3)*2;
      const y=b.y+3+p*p*83;
      ctx.globalAlpha=(1-p)*.65;
      oval(ctx,x,y,.8,.5,'#e8c98e');
    }
    const trayX=edge+direction*15;
    ctx.globalAlpha=.48;
    oval(ctx,trayX,b.y+90,19,4,'#382b25');
    oval(ctx,trayX,b.y+88,15,2.5,'#ba945c');
    line(ctx,[[trayX-20,b.y+86],[trayX-16,b.y+99],[trayX+16,b.y+99],[trayX+20,b.y+86]],'#997449',2);
    for(let i=0;i<7;i++){
      const p=(time*.14+i*.142857)%1;
      ctx.globalAlpha=(1-p)*.1;
      oval(ctx,trayX+Math.sin(i*9+time*.3)*p*25,b.y+82-p*28,2+p*3,1+p*2,'#eee1c6');
    }
  }
  ctx.restore();
}
function drawMillWarmth(){
  if(worldIndex()!==2)return;
  ctx.save();
  const lamps=[];
  const exit=chapterExitLight();
  lamps.push({x:exit.x,y:exit.y,r:levelIndex===8?110:155,alpha:levelIndex===7?.27:levelIndex===8?.16:.13});
  ctx.globalCompositeOperation='screen';
  for(const lamp of lamps){
    if(lamp.x+lamp.r<camera.x||lamp.x-lamp.r>camera.x+camera.w)continue;
    const glow=ctx.createRadialGradient(lamp.x,lamp.y,3,lamp.x,lamp.y,lamp.r);
    glow.addColorStop(0,`rgba(255,197,105,${lamp.alpha})`);
    glow.addColorStop(.4,`rgba(244,173,82,${lamp.alpha*.4})`);
    glow.addColorStop(1,'rgba(244,173,82,0)');
    ctx.fillStyle=glow;ctx.fillRect(lamp.x-lamp.r,lamp.y-lamp.r,lamp.r*2,lamp.r*2);
  }
  ctx.restore();
}
function drawMillForeground(){
  if(levelIndex!==7)return;
  ctx.save();
  // Near timber passes faster than the back wall. Fade it near the cat.
  const offset=camera.x*1.12;
  const posts=illustrations.millRooms?MILL_ROOMS.slice(1).map(room=>room.from):
    Array.from({length:Math.floor((offset+camera.w)/920)-Math.floor(offset/920)+1},(_,n)=>(n+Math.floor(offset/920))*920+86-camera.x*.12);
  for(const x of posts){
    if(x<camera.x-100||x>camera.x+camera.w+100)continue;
    const nearCat=Math.max(0,1-Math.abs(x-cat.x-cat.w/2)/65);
    if(illustrations.millRooms&&illustrations.millEnvironment){
      ctx.globalAlpha=.85-nearCat*.2;
      ctx.drawImage(illustrations.millEnvironment,1186,45,28,400,x-10,-30,20,H+60);
      ctx.globalAlpha=.28;
      line(ctx,[[x-13,-20],[x-13,H+20]],'#292c30',4);
      continue;
    }
    ctx.globalAlpha=.17-nearCat*.12;
    line(ctx,[[x,-20],[x+3,H+20]],'#342b29',17);
    line(ctx,[[x+5,-20],[x+8,H+20]],'#ae8056',2);
    line(ctx,[[x,80],[x+94,-20]],'#48332b',12);
    for(let notch=0;notch<8;notch++){
      const y=notch*73+24;
      line(ctx,[[x-4,y],[x+4,y+13]],'#977653',.8);
    }
  }
  // Keep the route bright; only the edges receive the cool indoor falloff.
  const shade=ctx.createLinearGradient(0,camera.y,0,camera.y+camera.h);
  shade.addColorStop(0,'rgba(19,26,39,.13)');
  shade.addColorStop(.45,'rgba(19,26,39,0)');
  shade.addColorStop(.78,'rgba(19,26,39,0)');
  shade.addColorStop(1,'rgba(19,26,39,.15)');
  ctx.globalAlpha=1;ctx.fillStyle=shade;ctx.fillRect(camera.x,camera.y,camera.w,camera.h);
  ctx.restore();
}
function drawMillExteriorBoard(b){
  const image=illustrations.millExterior,sourceX=b.fragile?1024:b.ice?0:512;
  const y=b.y-1,cap=20,height=24;
  const surface=millCachedSurface(b,height,c=>{
    c.drawImage(image,sourceX,228,100,120,0,0,cap,height);
    const end=b.w-cap;
    if(b.fragile)c.drawImage(image,sourceX+100,228,312,120,cap,0,b.w-cap*2,height);
    else for(let x=cap;x<end;x+=62.4){
      const width=Math.min(62.4,end-x);
      c.drawImage(image,sourceX+100,228,width/.2,120,x,0,width,height);
    }
    c.drawImage(image,sourceX+412,228,100,120,end,0,cap,height);
  },source=>({x:source.x-b.x,y:source.y-y}),b.ice?'ice':b.fragile?'wood':'stone');
  ctx.drawImage(surface,b.x,y,b.w,height);
  if(b.ice){
    ctx.save();ctx.globalAlpha=.22+.07*Math.sin(time*.8+b.x);
    line(ctx,[[b.x+4,b.y],[b.x+b.w-4,b.y]],'#cbeaf2',.8);
    for(let x=b.x+17;x<b.x+b.w-12;x+=43)line(ctx,[[x,b.y+3],[x+6,b.y+1]],'#e9f6f7',.65);
    ctx.restore();
  }
}
function drawMillPortal(x,y,home=false){
  const image=illustrations.millExterior;if(!image)return;
  if(home)x=Math.min(x,W-90);
  if(home){ctx.save();ctx.globalAlpha=.08;oval(ctx,x,y-53,58,67,'#ffdb8e');ctx.restore();}
  const scale=home?.34:.28;
  ctx.save();ctx.translate(x,y);if(home)ctx.scale(-1,1);
  ctx.drawImage(image,home?1024:512,512,512,512,-256*scale,-490*scale,512*scale,512*scale);ctx.restore();
}
function clipAtticInterior(){
  const s=ATTIC_SHELL;
  ctx.beginPath();ctx.moveTo(s.left,s.eaveY+s.depth);ctx.lineTo(s.peakX,s.peakY+s.depth);
  ctx.lineTo(s.right,s.eaveY+s.depth);ctx.lineTo(s.right,H);ctx.lineTo(s.left,H);ctx.closePath();ctx.clip();
}
function drawAtticShell(){
  const image=illustrations.millExterior;if(levelIndex!==8||!image)return;
  const s=ATTIC_SHELL,overhang=40,left=s.left-overhang,right=s.right+overhang,top=s.peakY-10;
  if(right<camera.x||left>camera.x+camera.w)return;
  const width=right-left,height=s.eaveY-s.peakY+s.depth+20;
  const roof=illustrations.millAtticRoof||null;
  if(!atticRoofCanvas||atticRoofSource!==roof){
    atticRoofCanvas=document.createElement('canvas');atticRoofCanvas.width=width*2;atticRoofCanvas.height=height*2;
    atticRoofSource=roof;
    const c=atticRoofCanvas.getContext('2d');c.scale(2,2);
    c.beginPath();c.moveTo(0,s.eaveY-top);c.lineTo(s.peakX-left,s.peakY-top);
    c.lineTo(width,s.eaveY-top);c.lineTo(width,s.eaveY+s.depth-top);
    c.lineTo(s.peakX-left,s.peakY+s.depth-top);c.lineTo(0,s.eaveY+s.depth-top);c.closePath();c.clip();
    c.fillStyle='#596471';c.fillRect(0,0,width,height);
    // Restrict the painted roof to the sloping section, keeping the loft open below it.
    if(roof)c.drawImage(roof,20,332,1496,240,0,s.peakY-top,width,s.eaveY-s.peakY+s.depth+15);
    if(roof)for(const [ax,ay,bx,by] of [[0,s.eaveY+s.depth-top,s.peakX-left,s.peakY+s.depth-top],[s.peakX-left,s.peakY+s.depth-top,width,s.eaveY+s.depth-top]]){
      c.save();c.translate(ax,ay);c.rotate(Math.atan2(by-ay,bx-ax));
      c.drawImage(roof,80,530,1300,26,0,-6,Math.hypot(bx-ax,by-ay),8);c.restore();
    }
  }
  ctx.save();
  ctx.drawImage(atticRoofCanvas,left,top,width,height);
  // Wall end sections sit above and below the passage, leaving the cat's route open.
  for(const [x,floor,inward] of [[s.left,s.entryFloor,1],[s.right,s.exitFloor,-1]]){
    if(x<camera.x-100||x>camera.x+camera.w+100)continue;
    const wallTop=s.eaveY+s.depth-4,bottom=floor+18,frontLeft=x-16;
    // The seam is a masonry corner tied to roof and foundations, in the back plane.
    // Tile actual painted stone courses rather than stretching a single tall block.
    ctx.save();ctx.beginPath();
    ctx.moveTo(frontLeft,wallTop);ctx.lineTo(x+16,wallTop+3);ctx.lineTo(x+16,H);ctx.lineTo(frontLeft,H);ctx.closePath();ctx.clip();
    for(let y=wallTop;y<H;y+=32)ctx.drawImage(image,205,600,100,100,frontLeft,y,32,33);
    ctx.restore();
    const backX=x+inward*38,faceX=x+inward*16;
    ctx.save();ctx.beginPath();ctx.moveTo(faceX,wallTop+3);ctx.lineTo(backX,wallTop+13);
    ctx.lineTo(backX,H);ctx.lineTo(faceX,H);ctx.closePath();ctx.clip();
    for(let y=wallTop;y<H;y+=32)ctx.drawImage(image,205,700,100,100,Math.min(faceX,backX),y,22,33);
    ctx.fillStyle='rgba(22,33,43,.38)';ctx.fillRect(Math.min(faceX,backX),wallTop,22,H-wallTop);ctx.restore();
    const reveal=ctx.createLinearGradient(backX,0,x+inward*(ATTIC_BLEND+25),0);
    reveal.addColorStop(0,'rgba(18,25,32,.36)');reveal.addColorStop(1,'rgba(18,25,32,0)');
    ctx.fillStyle=reveal;ctx.fillRect(Math.min(backX,x+inward*(ATTIC_BLEND+25)),wallTop+13,ATTIC_BLEND-13,H-wallTop-13);
    ctx.globalAlpha=.18;
    ctx.fillStyle='#142130';ctx.fillRect(x+(inward>0?13:-21),bottom,8,H-bottom);
    ctx.globalAlpha=1;
    if(illustrations.millEnvironment){
      const dx=inward*70,dy=-30;
      ctx.save();ctx.translate(x,s.eaveY+s.depth+4);ctx.rotate(Math.atan2(dy,dx)-Math.PI/2);
      ctx.drawImage(illustrations.millEnvironment,1186,45,28,400,-3.5,0,7,Math.hypot(dx,dy));ctx.restore();
    }
  }
  ctx.restore();
}
function drawMillJourneyLandmarks(){
  const image=illustrations.millExterior;
  if(!image){drawAuthoredLandmarks();return;}
  ctx.save();ctx.globalAlpha=.68;
  for(const b of boards){
    if(b.x+b.w<camera.x-100||b.x>camera.x+camera.w+100)continue;
    if(usesMillDeck(b))drawMillStructure(b);
    else for(const x of [b.x+5,b.x+b.w-41])ctx.drawImage(image,180,520,150,490,x,b.y+12,36,H-b.y-12);
  }
  ctx.restore();
  if(levelIndex===8)drawAtticShell();
  for(const section of level.sections){
    const b=boards[section.board],x=b.x+b.w*.65;
    if(x<camera.x-180||x>camera.x+camera.w+180)continue;
    if(section.kind==='frost'||section.kind==='repair')sceneLabel(section.name+' →',x,b.y-115,{center:true,tone:section.kind==='repair'?'warning':'guide'});
  }
  const end=boards[exitIndex()];
  drawMillPortal(level.finishX+12,end.y,levelIndex===8);
}
function drawPaintedRoof(b){
  if(b.belt&&illustrations.slidingEave){drawSlidingEave(b);return;}
  const image=illustrations.rooftopEnvironment;
  const scale=.18;
  const sourceX=b.ice?512:b.fragile?1024:0;
  const sourceY=180,sourceHeight=230;
  const leftPixels=86,rightPixels=86;
  const leftWidth=leftPixels*scale,rightWidth=rightPixels*scale;
  const centerPixels=512-leftPixels-rightPixels;
  const y=b.y-10*scale;
  ctx.drawImage(image,sourceX,sourceY,leftPixels,sourceHeight,b.x,y,leftWidth,sourceHeight*scale);
  const end=b.x+b.w-rightWidth;
  if(b.fragile){
    ctx.drawImage(image,sourceX+leftPixels,sourceY,centerPixels,sourceHeight,b.x+leftWidth,y,end-b.x-leftWidth,sourceHeight*scale);
  }else{
    // Tile the center at its native scale to retain the shingle proportions.
    for(let x=b.x+leftWidth;x<end;x+=centerPixels*scale){
      const width=Math.min(centerPixels*scale,end-x);
      ctx.drawImage(image,sourceX+leftPixels,sourceY,width/scale,sourceHeight,x,y,width,sourceHeight*scale);
    }
  }
  ctx.drawImage(image,sourceX+512-rightPixels,sourceY,rightPixels,sourceHeight,end,y,rightWidth,sourceHeight*scale);
}
function drawSlidingEave(b){
  const image=illustrations.slidingEave,scale=.12;
  const cap=270*scale,height=330*scale,y=b.y-23*scale;
  const left=b.x+cap,right=b.x+b.w-cap,tileWidth=384*scale;
  const offset=((time*b.belt)%tileWidth+tileWidth)%tileWidth;
  ctx.save();ctx.beginPath();ctx.rect(left,y,right-left,height);ctx.clip();
  for(let x=left-tileWidth+offset;x<right;x+=tileWidth){
    ctx.drawImage(image,480,350,384,330,x,y,tileWidth,height);
  }
  ctx.restore();
  ctx.drawImage(image,0,350,270,330,b.x,y,cap,height);
  ctx.drawImage(image,1266,350,270,330,right,y,cap,height);
  const angle=time*b.belt*.04,dx=Math.cos(angle)*2.7,dy=Math.sin(angle)*2.7;
  for(const x of [b.x+18.6,b.x+b.w-18]){
    line(ctx,[[x-dx,b.y+29-dy],[x+dx,b.y+29+dy]],'#d0ae68',.8);
    line(ctx,[[x+dy,b.y+29-dx],[x-dy,b.y+29+dx]],'#d0ae68',.8);
  }
}
function drawMillJourneyBackdrop(){
  const rooms=MILL_JOURNEYS[levelIndex],fallback=illustrations.millApproach||illustrations.millCourtyard;
  if(!rooms||!fallback)return false;
  ctx.fillStyle='#3c4c68';ctx.fillRect(camera.x,0,camera.w,H);
  if(levelIndex===8){
    // Outdoor sky continues behind the roof, rather than switching to indoor rafters above it.
    const width=Math.max(990,camera.w+(W-camera.w)*.18);
    ctx.drawImage(fallback,camera.x*.82,-110,width,width*2/3);
  }
  const ordered=levelIndex===8?[...rooms.filter(r=>!r.inside),...rooms.filter(r=>r.inside)]:rooms;
  for(const room of ordered){
    const clipFrom=levelIndex===8&&!room.inside&&room.from===ATTIC_SHELL.right?room.from-ATTIC_BLEND:room.from;
    const clipTo=levelIndex===8&&!room.inside&&room.to===ATTIC_SHELL.left?room.to+ATTIC_BLEND:room.to;
    if(clipTo<camera.x||clipFrom>camera.x+camera.w)continue;
    const frame=millRoomFrame(room),image=illustrations[room.asset]||(room.inside?illustrations.mill:null)||fallback;
    const sw=image.naturalWidth||1536,sh=image.naturalHeight||1024,inset=room.inset||0;
    ctx.save();ctx.beginPath();ctx.rect(clipFrom,0,clipTo-clipFrom,H);ctx.clip();
    if(room.inside)clipAtticInterior();
    if(room.mirror){ctx.translate(frame.x+frame.w,0);ctx.scale(-1,1);}
    if(room.inside&&(camera.x<room.from+ATTIC_BLEND||camera.x+camera.w>room.to-ATTIC_BLEND)){
      const layer=atticVestibuleBackground(room,frame,image,sw,sh,inset);
      ctx.drawImage(layer,room.from,0,room.to-room.from,H);
    }else if(room.inside){
      ctx.drawImage(image,sw*inset,0,sw*(1-inset*2),sh,frame.x,frame.y,frame.w,frame.h);
    }else if(levelIndex===8){
      const paint=(from,to,alpha)=>{
        ctx.save();ctx.beginPath();ctx.rect(from,0,to-from,H);ctx.clip();ctx.globalAlpha=alpha;
        ctx.drawImage(image,sw*inset,0,sw*(1-inset*2),sh,frame.x,frame.y,frame.w,frame.h);ctx.restore();
      };
      paint(room.from,room.to,1);
      // Feather only the back-wall extension. The masonry corner and roof remain sharp.
      for(let i=0;i<8;i++){
        const t=(i+.5)/8,smooth=t*t*(3-2*t),step=ATTIC_BLEND/8;
        if(room.to===ATTIC_SHELL.left)paint(room.to+i*step,room.to+(i+1)*step,1-smooth);
        if(room.from===ATTIC_SHELL.right)paint(room.from-ATTIC_BLEND+i*step,room.from-ATTIC_BLEND+(i+1)*step,smooth);
      }
    }else ctx.drawImage(image,sw*inset,0,sw*(1-inset*2),sh,room.mirror?0:frame.x,frame.y,frame.w,frame.h);
    ctx.restore();
  }
  return true;
}
function atticVestibuleBackground(room,frame,image,sw,sh,inset){
  const density=1.5,width=room.to-room.from;
  if(!atticVestibuleLayer){
    atticVestibuleLayer=document.createElement('canvas');
    atticVestibuleLayer.width=width*density;atticVestibuleLayer.height=H*density;
  }
  const c=atticVestibuleLayer.getContext('2d');
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,atticVestibuleLayer.width,atticVestibuleLayer.height);
  c.save();c.scale(density,density);
  c.drawImage(image,sw*inset,0,sw*(1-inset*2),sh,frame.x-room.from,frame.y,frame.w,frame.h);
  c.globalCompositeOperation='destination-in';
  const fade=c.createLinearGradient(0,0,width,0);
  fade.addColorStop(0,'rgba(255,255,255,0)');fade.addColorStop(ATTIC_BLEND/width,'#fff');
  fade.addColorStop(1-ATTIC_BLEND/width,'#fff');fade.addColorStop(1,'rgba(255,255,255,0)');
  c.fillStyle=fade;c.fillRect(0,0,width,H);c.restore();
  return atticVestibuleLayer;
}
function drawMillJourneyFraming(){
  if(levelIndex!==6||!illustrations.millExterior)return;
  ctx.save();ctx.globalAlpha=.6;
  for(const room of MILL_JOURNEYS[6].slice(1)){
    if(room.from<camera.x-30||room.from>camera.x+camera.w+30)continue;
    ctx.drawImage(illustrations.millExterior,205,530,100,475,room.from-14,-20,28,H+40);
  }
  ctx.restore();
}
function drawMillOutdoorAir(){
  if(levelIndex!==6&&levelIndex!==8)return;
  ctx.save();ctx.beginPath();
  if(levelIndex===8){ctx.rect(0,0,1120,H);ctx.rect(2260,0,W-2260,H);}else ctx.rect(0,0,W,H);
  ctx.clip();ctx.fillStyle='rgba(25,42,69,.055)';ctx.fillRect(camera.x,0,camera.w,H);
  // Quiet silver drift belongs outdoors. It never continues through the attic wall.
  for(let tile=Math.floor(camera.x/700);tile<=Math.floor((camera.x+camera.w)/700);tile++){
    for(let i=0;i<20;i++){
      const x=tile*700+((i*97-time*5)%700+700)%700;
      if(isMillRoom(x))continue;
      const y=95+(i*53)%365+Math.sin(time*.23+i)*7;
      ctx.globalAlpha=.10+(i%3)*.045;
      oval(ctx,x,y,.45+(i%2)*.2,.45,'#c7dce7');
    }
  }
  ctx.restore();
}
function drawPaintedBackdrop(){
  if(levelIndex===7&&drawMillRooms())return;
  if((levelIndex===6||levelIndex===8)&&drawMillJourneyBackdrop())return;
  const image=levelIndex===7?illustrations.mill:worldIndex()===2?illustrations.millApproach:[illustrations.forest,illustrations.harbor][worldIndex()];
  if(worldIndex()===2&&levelIndex!==7){
    // One exterior panorama retains the painted proportions across the journey.
    const width=Math.max(990,camera.w+(W-camera.w)*.18);
    ctx.drawImage(image,camera.x*.82,-110,width,width*2/3);
    if(levelIndex===8&&camera.x+camera.w>1120&&camera.x<2260&&illustrations.mill){
      ctx.save();ctx.beginPath();ctx.rect(1120,0,1140,H);ctx.clip();
      drawRepeatingBackdrop(illustrations.mill);ctx.restore();
    }
    return;
  }
  drawRepeatingBackdrop(image);
}
function drawRepeatingBackdrop(image){
  const width=810,offset=camera.x*.18;
  for(let tile=Math.floor(offset/width);tile<=Math.floor((offset+camera.w)/width);tile++){
    const x=tile*width+camera.x*.82;
    ctx.save();
    ctx.translate(tile%2?x+width:x,0);ctx.scale(tile%2?-1:1,1);
    ctx.drawImage(image,0,0,width,H);
    ctx.restore();
  }
}
let sceneLabels=[];
const sceneLabelOpacity=new Map();
function sceneLabel(text,x,y,{tone='guide',center=false,important=false}={}){
  sceneLabels.push({text,x,y,tone,center,important});
}
function drawPaintedSign(x,y,width,height,wood){
  const image=illustrations.signs;
  const top=wood?600:130,sourceHeight=wood?345:335,cap=Math.min(height*.48,width/3);
  // Stretch only the quiet center, retaining the torn edges, leaf and copper nails.
  ctx.drawImage(image,18,top,180,sourceHeight,x,y,cap,height);
  ctx.drawImage(image,198,top,1140,sourceHeight,x+cap,y,width-cap*2,height);
  ctx.drawImage(image,1338,top,180,sourceHeight,x+width-cap,y,cap,height);
}
function drawSceneLabels(dt=1/60){
  // Keep text readable in CSS pixels, independently of the near-follow camera.
  const size=Math.max(10,15*camera.w/(camera.cssWidth||camera.w));
  const padding=size*1.15,height=size*2.15;
  const themes=[['#fff4d8','#34462f','#908263'],['#f3f5e7','#294957','#7f9696'],['#28334b','#fff1d0','#a5b5cd']];
  ctx.save();ctx.font='600 '+size+'px "KaiTi","STKaiti","Kaiti SC","Microsoft YaHei",serif';ctx.textAlign='left';ctx.textBaseline='middle';
  for(const label of sceneLabels.sort((a,b)=>Number(b.important)-Number(a.important))){
    const width=ctx.measureText(label.text).width+padding*2;
    const left=label.center?label.x-width/2:label.x;
    // World anchors stay fixed. Neither the cat nor camera edges can displace a sign.
    const x=Math.max(8,Math.min(left,W-width-8));
    const y=Math.max(8,Math.min(label.y-height,H-height-8));
    if(x+width<camera.x||x>camera.x+camera.w||y+height<camera.y||y>camera.y+camera.h)continue;
    const dx=Math.max(cat.x-14-x-width,x-cat.x-cat.w-14,0);
    const dy=Math.max(cat.y-16-y-height,y-cat.y-cat.h-4,0);
    const proximity=.1+.9*Math.min(1,Math.hypot(dx,dy)/(size*1.8));
    const edge=Math.min(x-camera.x,camera.x+camera.w-x-width,y-camera.y,camera.y+camera.h-y-height);
    const target=proximity*Math.max(0,Math.min(1,(edge+8)/20));
    const key=label.text+'|'+label.x+'|'+label.y;
    const previous=sceneLabelOpacity.get(key)??target;
    const opacity=previous+(target-previous)*(1-Math.exp(-dt*16));
    sceneLabelOpacity.set(key,opacity);
    ctx.globalAlpha=opacity;
    const [paper,ink,border]=label.tone==='warning'?['#fff0d5','#713b29','#b4805d']:themes[worldIndex()];
    if(illustrations.signs)drawPaintedSign(x,y,width,height,label.important);
    else{
      ctx.fillStyle=paper;ctx.strokeStyle=border;ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(x,y,width,height,Math.min(5,size*.4));ctx.fill();ctx.stroke();
    }
    ctx.fillStyle=illustrations.signs?(label.tone==='warning'?'#783d2a':'#403c2d'):ink;
    ctx.fillText(label.text,x+padding,y+height*.51);
  }
  ctx.restore();
}
function drawLessonSigns(){
  if(levelIndex!==0)return;
  // Small world-space prompts stay near the relevant action; no tutorial modal.
  sceneLabel('跳一下 →',157,400,{center:true,important:true});
  sceneLabel('歇歇脚',453,318,{center:true,important:true});
  sceneLabel('有裂纹…',641,340,{tone:'warning',center:true,important:true});
  sceneLabel('小路也能回家 →',635,510,{center:true,important:true});
}
function catPresentation(){
  const speed=Math.abs(cat.vx),walking=cat.ground&&speed>20;
  let sheet='cat',frame=0;
  if(!cat.ground)frame=cat.vy<0?4:5;
  else if(walking)frame=[1,2,3,2][Math.floor(catMotion.stride*4)%4];
  if(cat.ground&&illustrations.catFeedback){
    const idlePhase=catMotion.idle%6.4;
    if(landing>.018){sheet='catFeedback';frame=4;}
    else if(catMotion.brake>.18&&speed>14){sheet='catFeedback';frame=1;}
    else if(levelIndex===7&&millMoment.rung&&millMoment.age<.5){sheet='catFeedback';frame=3;}
    else if(catMotion.turn>.065){sheet='catFeedback';frame=2;}
    else if(!walking&&catMotion.idle>1.8){
      if(idlePhase>2.6&&idlePhase<2.76){sheet='catFeedback';frame=0;}
      else if(idlePhase>4&&idlePhase<4.9){sheet='catFeedback';frame=3;}
      else if(catMotion.idle>6.4){sheet='catFeedback';frame=5;}
    }
  }
  const stretch=!cat.ground?(catMotion.launch/.12)*.025:0;
  const breath=cat.ground&&!walking?Math.sin(catMotion.idle*2.4)*.006:0;
  const turn=catMotion.turn>0?Math.sin(catMotion.turn/.12*Math.PI)*.09:0;
  return {sheet,frame,foot:sheet==='cat'?[451,449,434,448,431,447][frame]:[451,451,450,445,443,444][frame],pivot:295,
    sx:1+landing-stretch-turn,sy:1-landing+stretch+breath,
    lean:cat.ground?cat.vx/240*(catMotion.brake>.18?-.025:.018):0,
    bounce:walking?Math.abs(Math.sin(catMotion.stride*Math.PI*2))*.35:0};
}
function catContactSurface(){
  const center=cat.x+cat.w/2,bottom=cat.y+cat.h;
  return boards.filter(b=>center>b.x+2&&center<b.x+b.w-2&&b.y>=bottom-.5&&b.y-bottom<80&&b.crack<=crumbleDelay(b))
    .sort((a,b)=>a.y-b.y)[0];
}
function drawCatContact(){
  if(deathDelay>0)return;
  const surface=catContactSurface();if(!surface)return;
  const proximity=1-Math.max(0,surface.y-cat.y-cat.h)/80;
  ctx.save();ctx.globalAlpha=.19*proximity;
  oval(ctx,cat.x+cat.w/2+2,surface.y+1,6+proximity*5,1.4,'#42372e');ctx.restore();
}
function drawCat(){
  if(deathDelay>0)return;
  // Rounded kitten silhouette. Artwork is independent of the 23 x 30 hitbox.
  const walking=cat.ground&&Math.abs(cat.vx)>20,cycle=Math.sin(time*20);
  const bounce=walking?Math.abs(cycle)*.65:cat.ground?Math.sin(time*2.5)*.22:0;
  const stretch=!cat.ground&&cat.vy<0?.035:0;
  if(illustrations.cat){
    const pose=catPresentation(),frame=pose.frame,scale=54/512;
    ctx.save();ctx.translate(cat.x+cat.w/2,cat.y+cat.h);
    ctx.rotate(pose.lean);ctx.scale(cat.face*pose.sx,pose.sy);
    if(worldIndex()===2){
      const surface=millLitSurface(54,54,c=>{
        c.drawImage(illustrations[pose.sheet],(frame%3)*512,Math.floor(frame/3)*512,512,512,0,0,54,54);
      },source=>{
        const dx=source.x-cat.x-cat.w/2,dy=source.y-cat.y-cat.h;
        const localX=dx*Math.cos(pose.lean)+dy*Math.sin(pose.lean);
        const localY=-dx*Math.sin(pose.lean)+dy*Math.cos(pose.lean);
        return {x:localX/(cat.face*pose.sx)+pose.pivot*scale,y:localY/pose.sy+pose.foot*scale+pose.bounce};
      },'fur');
      ctx.drawImage(surface,0,0,216,216,-pose.pivot*scale,-pose.foot*scale-pose.bounce,54,54);
    }else ctx.drawImage(illustrations[pose.sheet],(frame%3)*512,Math.floor(frame/3)*512,512,512,-pose.pivot*scale,-pose.foot*scale-pose.bounce,54,54);
    ctx.restore();return;
  }
  ctx.save();ctx.translate(cat.x+11.5,cat.y+30);
  ctx.scale(cat.face*(1+landing-stretch),1-landing+stretch);
  ctx.translate(0,-bounce);ctx.lineCap='round';ctx.lineJoin='round';
  // A soft, curling tail with a cream tip.
  const tail=Math.sin(time*(walking?8:3))*(walking?2:1.2);
  ctx.beginPath();ctx.moveTo(-6,-7);ctx.bezierCurveTo(-17,-5,-19,-15+tail,-14,-17+tail);
  ctx.strokeStyle='#8e6248';ctx.lineWidth=5;ctx.stroke();
  ctx.strokeStyle='#dfa36e';ctx.lineWidth=3.4;ctx.stroke();
  line(ctx,[[-15.7,-15.5+tail],[-14,-17+tail]],'#fff0d1',3);
  // Pear-shaped body and tucked, alternating paws.
  oval(ctx,0,-7.5,7.8,8,'#dba071');ctx.strokeStyle='#967151';ctx.lineWidth=.8;ctx.stroke();
  oval(ctx,1,-6,4.7,5.7,'#fff0d7');
  const step=walking?cycle*1.1:0;
  oval(ctx,-4.6,-1.6+step,3.5,2.2,'#f8e6c7');
  oval(ctx,4.6,-1.6-step,3.5,2.2,'#f8e6c7');
  // Broad cheeks and short rounded ears replace the upright box silhouette.
  ctx.fillStyle='#e6ae78';ctx.beginPath();
  ctx.moveTo(-10,-21);ctx.quadraticCurveTo(-11,-32,-7.5,-30);
  ctx.lineTo(-3.7,-26);ctx.quadraticCurveTo(0,-27.3,4,-26);
  ctx.quadraticCurveTo(10,-33,10.3,-28);ctx.lineTo(10,-21);
  ctx.bezierCurveTo(15,-12,7,-10,0,-10);ctx.bezierCurveTo(-9,-10,-14,-13,-10,-21);
  ctx.closePath();ctx.fill();ctx.strokeStyle='#967151';ctx.lineWidth=.85;ctx.stroke();
  ctx.fillStyle='#d78e83';ctx.beginPath();ctx.moveTo(-8.2,-27.9);ctx.lineTo(-7.9,-23.8);ctx.lineTo(-5.1,-25);ctx.fill();
  ctx.beginPath();ctx.moveTo(8.5,-28);ctx.lineTo(5.7,-25);ctx.lineTo(8.5,-23.9);ctx.fill();
  // Cream muzzle, subtle tabby forehead and rosy cheeks.
  oval(ctx,0,-14.7,8.5,4.5,'#fff0d7');
  line(ctx,[[-2,-25],[-1.4,-22.8]],'#bf8259',1.1);
  line(ctx,[[1.8,-25],[1.2,-22.8]],'#bf8259',1.1);
  oval(ctx,-8,-17,2,1,'#e6a294');oval(ctx,8,-17,2,1,'#e6a294');
  const blink=time%4.6>4.44,look=walking?.6:.2;
  for(const ex of [-4.6,4.6]){
    if(blink)line(ctx,[[ex-1.3,-19],[ex,-18.5],[ex+1.3,-19]],'#574b3e',.9);
    else{
      oval(ctx,ex+look,-19,1.75,2.15,'#51483b');
      oval(ctx,ex+look-.55,-19.8,.6,.7,'#fffae9');
    }
  }
  ctx.fillStyle='#bd827c';ctx.beginPath();ctx.moveTo(-1.4,-16);ctx.quadraticCurveTo(0,-16.8,1.4,-16);ctx.lineTo(0,-14.8);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#977057';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(0,-14.8);ctx.quadraticCurveTo(-1,-13.2,-2.2,-14);ctx.moveTo(0,-14.8);ctx.quadraticCurveTo(1,-13.2,2.2,-14);ctx.stroke();
  line(ctx,[[-8.4,-14.8],[-12.3,-15.4]],'#b18b68',.55);
  line(ctx,[[8.4,-14.8],[12.3,-15.4]],'#b18b68',.55);
  ctx.restore();
}
function drawHarborLandmarks(){
  if(illustrations.harborEnvironment&&illustrations.warehouse){
    drawPaintedHarborShowcase();return;
  }
  // Ship and cargo shed are local landmarks, never repeated with background tiles.
  ctx.fillStyle='#668c98';ctx.beginPath();ctx.moveTo(410,405);ctx.lineTo(660,405);
  ctx.quadraticCurveTo(644,478,605,482);ctx.lineTo(455,482);ctx.quadraticCurveTo(425,464,410,405);ctx.fill();
  line(ctx,[[430,426],[641,426]],'#e0d2ac',3);
  for(const x of [470,515,560,605]){oval(ctx,x,445,7,7,'#d8cfac');oval(ctx,x,445,4,4,'#526f7c');}
  line(ctx,[[525,400],[525,180]],'#7a7964',5);
  ctx.fillStyle='#eee3be';ctx.beginPath();ctx.moveTo(533,195);ctx.lineTo(626,337);ctx.lineTo(533,337);ctx.fill();
  line(ctx,[[525,190],[432,350],[525,350]],'#bfb596',1.4);
  // An open-front warehouse. No opaque facade covers the traversable path.
  ctx.fillStyle='#c6cec0';ctx.fillRect(850,210,650,290);
  ctx.fillStyle='#dbe0cb';ctx.beginPath();ctx.moveTo(830,213);ctx.lineTo(1175,115);ctx.lineTo(1520,213);ctx.fill();
  line(ctx,[[830,213],[1175,115],[1520,213]],'#829689',3);
  for(const x of [865,1490])line(ctx,[[x,216],[x,510]],'#8d9d89',8);
  ctx.fillStyle='#a9b5a0';ctx.fillRect(985,225,125,52);ctx.fillRect(1240,225,125,52);
  ctx.fillStyle='#b8b28d';ctx.fillRect(1150,355,130,75);
  line(ctx,[[1156,360],[1273,424],[1273,360],[1156,424],[1156,360]],'#8b927a',2);
  line(ctx,[[1325,420],[1485,420]],'#899c8b',5);
  // High bridge piers express the climb without inventing collision surfaces.
  for(const i of [7,8,9,10]){
    const b=boards[i];line(ctx,[[b.x+18,b.y+18],[b.x+18,535]],'#8ea5a3',6);
    line(ctx,[[b.x+b.w-18,b.y+18],[b.x+b.w-18,535]],'#8ea5a3',6);
    line(ctx,[[b.x+18,b.y+30],[b.x+b.w-18,510]],'#a3b6af',2);
  }
  // Lighthouse base sits exactly on the real exit platform.
  const towerX=3058,baseY=265;
  ctx.fillStyle='#eee3be';ctx.beginPath();ctx.moveTo(towerX-29,baseY);ctx.lineTo(towerX-19,87);
  ctx.lineTo(towerX+19,87);ctx.lineTo(towerX+29,baseY);ctx.closePath();ctx.fill();
  ctx.fillStyle='#c28c75';ctx.fillRect(towerX-20,120,40,20);ctx.fillRect(towerX-24,188,48,20);
  ctx.fillStyle='#f3d18a';ctx.fillRect(towerX-21,65,42,28);
  ctx.fillStyle='#6a8790';ctx.beginPath();ctx.moveTo(towerX-31,65);ctx.lineTo(towerX,43);ctx.lineTo(towerX+31,65);ctx.fill();
  const shimmer=.08+.03*Math.sin(time*1.5);
  ctx.globalAlpha=shimmer;ctx.fillStyle='#fff0b1';ctx.beginPath();ctx.moveTo(towerX,78);
  ctx.lineTo(towerX-330,10);ctx.lineTo(towerX-330,136);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  for(const [x,y,label] of [[300,375,'登船 →'],[1170,185,'货仓'],[1850,165,'沿高桥去灯塔 →'],[2480,265,'站稳，再跳']])sceneLabel(label,x,y,{center:true,important:true});
}
function drawPaintedWindsock(x,y){
  const direction=Math.sign(level.winds[0]?.speed||1);
  ctx.save();ctx.translate(x,y);ctx.scale(direction,1+Math.sin(time*2)*.025);ctx.rotate(Math.sin(time*2)*.025);
  ctx.drawImage(illustrations.windsock,90,335,1380,400,-5.5,-12.925,75.9,22);ctx.restore();
}
function drawPaintedForestShelter(x,y){
  const scale=.3;
  ctx.drawImage(illustrations.forestProps,700,280,836,744,x-408*scale,y-705*scale,836*scale,744*scale);
}
function swingFruitPosition(s){return {x:s.x+Math.sin(time*1.8)*s.range,y:s.y};}
function drawSwingFruit(s){
  const {x,y}=swingFruitPosition(s),image=illustrations.forestProps;
  if(!image){
    line(ctx,[[s.anchor,0],[x,y]],'#8d8b72',1);oval(ctx,x,y,s.r,s.r,'#b85d4d');
    line(ctx,[[x-3,y-6],[x+1,y-13],[x+7,y-12]],'#718556',2);return;
  }
  const scale=2*s.r/330,dx=x-s.anchor,dy=y-s.r-2,angle=Math.atan2(dx,dy);
  ctx.save();ctx.translate(s.anchor,0);ctx.rotate(-angle);
  ctx.drawImage(image,365,70,38,370,-1.3,0,2.6,Math.hypot(dx,dy));ctx.restore();
  ctx.save();ctx.translate(x,y);ctx.rotate(-angle*.4);
  // The fruit body shares the collision center; its stem and leaves are decorative.
  ctx.drawImage(image,175,530,410,450,-207*scale,-275*scale,410*scale,450*scale);ctx.restore();
}
function drawPaintedHarborObject(kind,x,y,destination=false){
  const image=illustrations.harborEnvironment;
  if(kind==='shed'){
    if(!illustrations.warehouse)return false;
    ctx.drawImage(illustrations.warehouse,x-138,y-175.3,276,184.3);
  }else if(kind==='boat'){
    const scale=.36;
    ctx.drawImage(image,0,480,512,530,x-256*scale,y-405*scale,512*scale,530*scale);
  }else if(kind==='crane'||kind==='windmill'){
    const scale=.36;
    ctx.drawImage(image,512,480,512,530,x-108*scale,y-512*scale,512*scale,530*scale);
    if(kind==='windmill'){
      if(illustrations.windsock)drawPaintedWindsock(x+8,y-180);
      else{
      const wave=Math.sin(time*2)*3;
      ctx.fillStyle='#e3c7a0';ctx.strokeStyle='#7e7159';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x+8,y-163);ctx.quadraticCurveTo(x+34,y-170+wave,x+62,y-160+wave);
      ctx.lineTo(x+56,y-151+wave);ctx.quadraticCurveTo(x+31,y-156+wave,x+8,y-151);ctx.closePath();ctx.fill();ctx.stroke();
      }
    }
  }else if(kind==='beacon'){
    const scale=destination?.45:.39;
    ctx.drawImage(image,1024,480,512,530,x-262*scale,y-495*scale,512*scale,530*scale);
  }else return false;
  return true;
}
function drawPaintedHarborShowcase(){
  const image=illustrations.harborEnvironment;
  // The illustrated hull's deck is aligned to main platform 2.
  const shipScale=250/512;
  ctx.drawImage(image,0,480,512,530,410,400-405*shipScale,250,530*shipScale);
  ctx.drawImage(illustrations.warehouse,830,100,700,420);
  // The crate's top and the high bridge decking share the real collision tops.
  ctx.drawImage(image,1100,86,380,360,1150,355,130,103);
  for(const i of [7,8,9,10]){
    const b=boards[i];
    for(const x of [b.x+18,b.x+b.w-18])ctx.drawImage(image,1120,160,35,210,x-4,b.y+10,8,535-b.y-10);
    line(ctx,[[b.x+18,b.y+30],[b.x+b.w-18,510]],'#9a9277',1.5);
  }
  drawPaintedHarborObject('beacon',3058,265,true);
  ctx.globalAlpha=.06+.025*Math.sin(time*1.5);ctx.fillStyle='#fff0c2';
  ctx.beginPath();ctx.moveTo(3058,87);ctx.lineTo(2728,20);ctx.lineTo(2728,145);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  for(const [x,y,label] of [[300,375,'登船 →'],[1170,185,'货仓'],[1850,165,'沿高桥去灯塔 →'],[2480,265,'站稳，再跳']])sceneLabel(label,x,y,{center:true,important:true});
}
function drawRouteLandmark(kind,x,y,destination=false){
  if(worldIndex()===0&&kind==='shed'&&illustrations.forestProps){drawPaintedForestShelter(x,y);return;}
  if(worldIndex()===2&&illustrations.rooftopEnvironment&&illustrations.rooftopLandmarks){
    drawPaintedRooftopObject(kind,x,y,destination);return;
  }
  if(worldIndex()===1&&illustrations.harborEnvironment&&drawPaintedHarborObject(kind,x,y,destination))return;
  if(worldIndex()===0&&illustrations.environment&&['tree','gate','arch'].includes(kind)){
    const scale=destination?.45:kind==='tree'?.36:.4;
    if(destination){ctx.globalAlpha=.12;oval(ctx,x,y-32,24,37,'#f7d68c');ctx.globalAlpha=1;}
    ctx.drawImage(illustrations.environment,0,512,512,512,x-256*scale,y-464*scale,512*scale,512*scale);
    return;
  }
  ctx.save();ctx.translate(x,y);
  const ink=worldIndex()===2?'#c3bcc1':'#748878';
  ctx.strokeStyle=ink;ctx.lineWidth=1.5;
  if(kind==='tree'||kind==='gate'||kind==='arch'){
    ctx.fillStyle='#9b9f79';ctx.beginPath();ctx.moveTo(-55,0);ctx.lineTo(-48,-95);
    ctx.quadraticCurveTo(0,-135,48,-95);ctx.lineTo(55,0);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle=worldIndex()===2?'#6e7794':'#c6d3ac';
    ctx.beginPath();ctx.moveTo(-29,0);ctx.lineTo(-27,-65);ctx.quadraticCurveTo(0,-99,27,-65);ctx.lineTo(29,0);ctx.fill();
    if(kind==='tree')for(const [lx,ly,rx] of [[-52,-112,44],[0,-145,53],[55,-110,46]])oval(ctx,lx,ly,rx,29,'#8fa77f');
    else line(ctx,[[-61,-95],[0,-125],[61,-95]],'#7b8b6d',5);
  }else if(kind==='shed'||kind==='roof'||kind==='window'||kind==='clock'||kind==='chimney'){
    const night=worldIndex()===2,top=kind==='clock'?-160:-105;
    ctx.fillStyle=night?'#7f88a2':'#c2c7a7';ctx.fillRect(-62,top,124,-top);
    ctx.fillStyle=night?'#626e8d':'#879b88';ctx.beginPath();ctx.moveTo(-75,top);ctx.lineTo(0,top-40);ctx.lineTo(75,top);ctx.fill();
    if(kind==='clock'){
      oval(ctx,0,top+41,27,27,'#e8ddbb');line(ctx,[[0,top+21],[0,top+41],[16,top+48]],'#6e7488',2.5);
    }else{
      ctx.fillStyle='#e7cd91';ctx.fillRect(-36,top+25,25,35);ctx.fillRect(12,top+25,25,35);
      line(ctx,[[-24,top+25],[-24,top+60]],ink,2);line(ctx,[[24,top+25],[24,top+60]],ink,2);
    }
    if(kind==='chimney'||kind==='roof'){
      ctx.fillStyle='#8990a4';ctx.fillRect(30,top-48,20,40);
      line(ctx,[[26,top-48],[54,top-48]],'#b6b5b3',4);
    }
  }else if(kind==='boat'){
    ctx.fillStyle='#6f94a1';ctx.beginPath();ctx.moveTo(-85,12);ctx.lineTo(85,12);ctx.lineTo(55,64);ctx.lineTo(-55,64);ctx.closePath();ctx.fill();
    line(ctx,[[0,0],[0,-145]],'#84927e',4);
    ctx.fillStyle='#eee1b9';ctx.beginPath();ctx.moveTo(5,-135);ctx.lineTo(62,-38);ctx.lineTo(5,-38);ctx.fill();
    for(const lx of [-40,0,40])oval(ctx,lx,32,6,6,'#dccfa8');
  }else if(kind==='crane'||kind==='windmill'){
    line(ctx,[[0,0],[0,-165]],'#7c9298',7);
    if(kind==='crane'){
      line(ctx,[[-48,-162],[92,-162],[0,-127]],'#7c9298',4);
      line(ctx,[[86,-160],[86,-50],[77,-42]],'#9b9d87',2);
    }else{
      oval(ctx,0,-145,7,7,'#d3c89f');
      for(let i=0;i<4;i++){const angle=time*.4+i*Math.PI/2;line(ctx,[[Math.cos(angle)*9,-145+Math.sin(angle)*9],[Math.cos(angle)*49,-145+Math.sin(angle)*49]],'#afc3bd',9);}
      line(ctx,[[4,-95],[65,-95],[55,-100]],'#e1d6af',3);
    }
  }else if(kind==='beacon'){
    ctx.fillStyle='#e4dbbb';ctx.beginPath();ctx.moveTo(-26,0);ctx.lineTo(-15,-155);ctx.lineTo(15,-155);ctx.lineTo(26,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#b98977';ctx.fillRect(-19,-90,38,18);
    ctx.fillStyle='#f2d58f';ctx.fillRect(-21,-175,42,25);
    line(ctx,[[-28,-176],[0,-195],[28,-176]],'#6c8a96',5);
  }
  if(destination){
    ctx.fillStyle=worldIndex()===2?'#e8c98b':'#ebd9ab';ctx.fillRect(-13,-36,26,36);
    line(ctx,[[-13,0],[-13,-36],[13,-36],[13,0]],ink,1.4);oval(ctx,7,-16,1.4,1.4,'#827251');
  }
  ctx.restore();
}
function drawPaintedRooftopObject(kind,x,y,destination){
  if(kind==='roof'){
    ctx.drawImage(illustrations.rooftopEnvironment,1024,600,512,380,x-66.6,y-91.8,133.1,98.8);
  }else if(kind==='chimney'){
    ctx.drawImage(illustrations.rooftopEnvironment,600,520,320,500,x-54.4,y-166.6,108.8,170);
    for(let i=0;i<3;i++){
      ctx.globalAlpha=.07-i*.015;
      oval(ctx,x+Math.sin(time*.6+i)*5,y-171-i*12,6+i*3,5+i*3,'#d3cbdc');
    }
    ctx.globalAlpha=1;
  }else{
    const column=kind==='clock'?0:kind==='arch'?2:1;
    const scale=kind==='clock'?.23:destination?.30:.26;
    ctx.drawImage(illustrations.rooftopLandmarks,column*512,0,512,1024,x-256*scale,y-1000*scale,512*scale,1024*scale);
  }
}
function drawAuthoredLandmarks(){
  for(const section of level.sections){
    const b=boards[section.board],x=b.x+b.w*.65;
    if(x<camera.x-220||x>camera.x+camera.w+220)continue;
    const isEnd=section.board===exitIndex();
    let landmarkX=x;
    if((worldIndex()===0&&illustrations.environment)||(worldIndex()===1&&illustrations.harborEnvironment)||(worldIndex()===2&&illustrations.rooftopLandmarks))landmarkX=b.x+b.w*.5;
    if(isEnd)landmarkX=level.finishX+12;
    if(levelIndex===1&&section.board===4)drawOrchardShelter();
    else drawRouteLandmark(section.kind,landmarkX,b.y,isEnd);
    if(levelIndex!==1||section.board!==4)sceneLabel(section.name+' →',x,b.y-(section.kind==='clock'?170:125),{center:true});
  }
  const end=boards[exitIndex()];
  if(!level.sections.some(s=>s.board===exitIndex()))drawRouteLandmark(level.sections[level.sections.length-1].kind,level.finishX+12,end.y,true);
}
function drawOrchardShelter(){
  // The two warm roof tops are actual optional platforms, with a clear path below.
  for(const b of boards.filter(item=>item.bonus)){
    line(ctx,[[b.x+10,b.y+20],[b.x+10,415]],'#86967a',5);
    line(ctx,[[b.x+b.w-10,b.y+20],[b.x+b.w-10,415]],'#86967a',5);
    line(ctx,[[b.x+10,b.y+38],[b.x+b.w-10,b.y+64]],'#a8af8d',2);
  }
  sceneLabel('↑ 棚顶鱼干 · 可选',886,204,{important:true});
  sceneLabel('安全木道 →',900,425,{important:true});
  sceneLabel('↓ 回到木道',1205,270,{important:true});
}
function draw(dt=1/60){
  sceneLabels=[];
  ctx.setTransform(camera.pixelWidth/camera.w,0,0,camera.pixelHeight/camera.h,0,0);
  ctx.clearRect(0,0,camera.w,camera.h);
  ctx.save();ctx.translate(-camera.x,-camera.y);
  if(levelIndex===7?(illustrations.mill||illustrations.millRooms):worldIndex()===2?(illustrations.millApproach||illustrations.millCourtyard):[illustrations.forest,illustrations.harbor][worldIndex()])drawPaintedBackdrop();
  else for(let tile=Math.floor(camera.x/960);tile<=Math.floor((camera.x+camera.w)/960);tile++)ctx.drawImage(background,tile*960,0);
  if(shake)ctx.translate(Math.sin(time*90)*shake,Math.cos(time*70)*shake*.5);
  drawMillAir();
  drawMillForeground();
  drawMillJourneyFraming();
  drawMillOutdoorAir();
  drawMillLampBounce();
  // Tiny drifting pollen is decorative; collision surfaces stay perfectly stable.
  if(worldIndex()!==2)for(let i=0;i<18;i++)oval(ctx,(i*83+time*5)%W,90+(i*41)%340+Math.sin(time+i)*6,1.3,1.3,'#f7edcb');
  if(level.showcase)drawHarborLandmarks();
  if(levelIndex===7)drawMillLandmarks();
  else if(worldIndex()===2)drawMillJourneyLandmarks();
  else if(level.refined)drawAuthoredLandmarks();
  for(const zone of level.winds){
    ctx.globalAlpha=.5;const direction=Math.sign(zone.speed);
    for(let i=0;i<18;i++){
      const x=zone.from+10+((i*71+direction*time*32)%380+380)%380,y=215+(i%5)*50;
      line(ctx,[[x,y],[x+direction*20,y],[x+direction*15,y-3]],illustrations.harbor?'#668f9c':'#e5f3f3',1.4);
    }ctx.globalAlpha=1;
    sceneLabel(zone.speed>0?'顺风区 →':'← 逆风区',zone.from+20,300,{important:true});
  }
  boards.forEach(drawBoard);
  drawMillGrain();
  drawLessonSigns();
  for(const [x,y,w] of level.thorns){for(let j=0;j<w;j+=10){ctx.fillStyle='#a76050';ctx.beginPath();ctx.moveTo(x+j,y+14);ctx.quadraticCurveTo(x+j+3,y+3,x+j+7,y);ctx.lineTo(x+j+10,y+14);ctx.fill();line(ctx,[[x+j+3,y+12],[x+j+7,y+3]],'#6b493f');}}
  const end=boards[exitIndex()];
  if(level.showcase){
    if(!(illustrations.harborEnvironment&&illustrations.warehouse)){
    ctx.fillStyle='#66838b';ctx.fillRect(3046,230,24,35);ctx.fillStyle='#efd58f';ctx.fillRect(3050,237,16,28);
    }
  }else if(!level.refined){
  ctx.fillStyle='#957b5a';ctx.fillRect(end.x+36,end.y-53,32,53);
  ctx.fillStyle='#674c3f';ctx.beginPath();ctx.moveTo(end.x+28,end.y-51);ctx.lineTo(end.x+52,end.y-76);ctx.lineTo(end.x+76,end.y-51);ctx.fill();
  ctx.fillStyle='#edcc84';ctx.fillRect(end.x+44,end.y-36,17,36);oval(ctx,end.x+57,end.y-17,1.4,1.4,'#69503e');
  }
  if(level.fake){line(ctx,[[565,391],[565,352]],'#7f7356',3);sceneLabel('终点？',565,365,{center:true});}
  for(const s of level.saws)drawSwingFruit(s);
  for(const f of fish)if(!f.got){
    const y=f.y+Math.sin(time*3+f.x)*3;
    if(illustrations.environment)ctx.drawImage(illustrations.environment,1124,693,310,150,f.x-12,y-5.8,24,11.6);
    else{oval(ctx,f.x,y,9,4,'#c2954e');ctx.fillStyle='#c2954e';ctx.beginPath();ctx.moveTo(f.x-7,y);ctx.lineTo(f.x-13,y-5);ctx.lineTo(f.x-13,y+5);ctx.fill();oval(ctx,f.x+5,y-1,1,1,'#66533c');}
  }
  drawCatContact();
  drawMillCastShadow();
  drawSceneLabels(dt);
  drawCat();
  for(const p of particles){
    ctx.globalAlpha=Math.max(0,p.maxLife?p.life/p.maxLife:p.life*1.5);
    if(p.kind==='wood'||p.kind==='ice'||p.kind==='stone'){
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);ctx.fillStyle=p.color;
      ctx.fillRect(-p.size,-.4,p.size*2,.8);ctx.restore();
    }else oval(ctx,p.x,p.y,p.size||2,p.size?p.size*.7:1.5,p.color);
  }ctx.globalAlpha=1;
  drawCheckpointGlow();
  drawMillWarmth();
  ctx.restore();
  $('timer').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(Math.floor(elapsed%60)).padStart(2,'0');
  $('routeProgress').style.width=Math.max(0,Math.min(100,(cat.x+cat.w)/W*100))+'%';
  $('routeMeter').setAttribute('aria-valuenow',String(Math.round(Math.max(0,Math.min(100,(cat.x+cat.w)/W*100)))));
}
function next(){
  if(illustrationLoading)return;
  unlockAudio();
  if(state==='menu')start(continueLevel,true);
  else if(state==='pause')pause();
  else if(state==='clear')start(levelIndex+1,true);
  else if(state==='complete')start(0);
}
function showLevels(chapter=worldIndex()){
  if(state==='play')pause();
  selectedWorld=chapter;
  clearInput();
  $('worldTabs').replaceChildren();
  WORLDS.forEach((item,i)=>{
    const tab=document.createElement('button');tab.textContent=(i+1)+' '+item.name;
    tab.setAttribute('aria-pressed',String(i===selectedWorld));tab.onclick=()=>showLevels(i);$('worldTabs').appendChild(tab);
  });
  $('levelGrid').replaceChildren();
  LEVELS.forEach((item,i)=>{
    if(worldIndex(i)!==selectedWorld)return;
    const button=document.createElement('button');
    button.className='level-choice'+(cleared[i]?' done':'');
    button.disabled=!isLevelUnlocked(i);
    const title=document.createElement('span'),status=document.createElement('small'),progress=document.createElement('small');
    title.textContent=(selectedWorld+1)+'-'+(i%3+1)+' '+item.name;
    status.textContent=!isLevelUnlocked(i)?'未解锁':resumableRun(i)?'继续散步 · 已保存':cleared[i]?'✓ 已走过':item.preview?'磨坊样板 · 可以试玩':'可以出发';
    button.appendChild(title);button.appendChild(status);
    const record=records[i];
    if(isLevelUnlocked(i)){
      progress.className='level-record';
      progress.textContent='鱼干 '+(record?.fish.length||0)+' / '+item.fish.length;
      if(record?.bestTime!==undefined)progress.textContent+=' · 最佳 '+formatTime(record.bestTime);
      if(record?.bestDeaths!==undefined)progress.textContent+=' · 最少 '+record.bestDeaths+' 次';
      button.appendChild(progress);
    }
    button.onclick=()=>{if(isLevelUnlocked(i))start(i,true);};
    $('levelGrid').appendChild(button);
  });
  $('selectPanel').hidden=false;$('closeLevels').focus({preventScroll:true});syncAudio();
}
function down(code,repeat=false){
  if(illustrationLoading&&code!=='Escape')return;
  if(!$('selectPanel').hidden){if(code==='Escape'&&!repeat)$('selectPanel').hidden=true;return;}
  if(['Space','ArrowUp','KeyW'].includes(code)&&!repeat){
    if(state==='menu'){next();return;}if(state==='play'){buffer=.12;jumpHeld=true;unlockAudio();}
  }
  if(code==='Escape'&&!repeat){if(!$('selectPanel').hidden)$('selectPanel').hidden=true;else pause();}
  if(code==='KeyR'&&!repeat&&state==='play')die('重新出发。');
  keys.add(code);
}
function up(code){keys.delete(code);if(['Space','ArrowUp','KeyW'].includes(code))jumpHeld=false;}
window.addEventListener('keydown',e=>{if(e.target.tagName==='BUTTON'&&(e.code==='Space'||e.code==='Enter'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();down(e.code,e.repeat);});
window.addEventListener('keyup',e=>up(e.code));
window.addEventListener('blur',()=>{clearInput();if(state==='play')pause();else soundscape?.setScene('forest',false,false);});
window.addEventListener('orientationchange',()=>{clearInput();if(state==='play')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='play')pause();syncAudio();});
window.addEventListener('pagehide',()=>{clearInput();save();soundscape?.setScene('forest',false,false);});
$('primary').onclick=next;$('secondary').onclick=()=>start(levelIndex);$('pause').onclick=()=>{if(!$('selectPanel').hidden)$('selectPanel').hidden=true;else pause();};
$('levels').onclick=()=>showLevels();
$('closeLevels').onclick=()=>{$('selectPanel').hidden=true;$('levels').focus({preventScroll:true});};
$('sound').onclick=()=>{muted=!muted;syncAudio();unlockAudio();save();updateSound();};
function updateSound(){$('sound').textContent='声音：'+(muted?'关':'开');$('sound').setAttribute('aria-pressed',String(muted));}
$('retry').onclick=()=>{if(state==='play')die('重新出发。');};
function fullscreenLabel(){$('fullscreen').textContent=document.fullscreenElement||$('app').classList.contains('immersive')?'退出全屏 ↙':'全屏 ↗';}
$('fullscreen').onclick=async()=>{
  clearInput();
  if($('app').classList.contains('immersive'))$('app').classList.remove('immersive');
  else try{if(document.fullscreenElement)await document.exitFullscreen();else await $('app').requestFullscreen();}
  catch{$('app').classList.add('immersive');notice('已展开游戏。横屏体验更好。');}
  fullscreenLabel();
};
document.addEventListener('fullscreenchange',fullscreenLabel);
function touchDown(b,id){
  if(state!=='play'||illustrationLoading)return;
  touchPointers.set(id,b);b.setAttribute('aria-pressed','true');down(b.dataset.key);
}
function touchUp(id){
  const b=touchPointers.get(id);if(!b)return;touchPointers.delete(id);
  if(![...touchPointers.values()].some(other=>other.dataset.key===b.dataset.key)){
    up(b.dataset.key);b.setAttribute('aria-pressed','false');
  }
}
function preventGameSelection(e){if(e.cancelable)e.preventDefault();}
function clearGameSelection(){
  const selection=window.getSelection?.();
  if(selection?.rangeCount)selection.removeAllRanges();
}
// Safari can begin selection on surrounding text even when the button itself
// is unselectable. Cancel native selection/drag only inside the game UI.
$('app').addEventListener('selectstart',preventGameSelection);
$('app').addEventListener('dragstart',preventGameSelection);
for(const b of document.querySelectorAll('[data-key]')){
  b.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();clearGameSelection();
    try{b.setPointerCapture(e.pointerId);}catch{/* Window release fallback below. */}
    touchDown(b,e.pointerId);
  });
  // Non-passive touch handlers suppress iOS long-press and native touch drag
  // without preventing scrolling inside the chapter picker.
  b.addEventListener('touchstart',e=>{preventGameSelection(e);clearGameSelection();},{passive:false});
  b.addEventListener('touchmove',preventGameSelection,{passive:false});
  b.addEventListener('contextmenu',preventGameSelection);
  b.addEventListener('dragstart',preventGameSelection);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>touchUp(e.pointerId));
}
window.addEventListener('pointerup',e=>touchUp(e.pointerId));
window.addEventListener('pointercancel',e=>touchUp(e.pointerId));
window.addEventListener('resize',resizeView);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeView).observe(canvas);
function loop(t){const dt=Math.min(.05,(t-last)/1000||0);last=t;accumulator+=dt;while(accumulator>=STEP){update(STEP);accumulator-=STEP;}if(state==='play'||camera.snap)updateCamera(dt);draw(dt);requestAnimationFrame(loop);}
resizeView();
loadLevel(continueLevel,true);updateSound();
$('primary').textContent=resumableRun(continueLevel)?'从'+(checkpoint<0?'起点':'路灯')+'继续 →':continueLevel?'出发 '+(worldIndex()+1)+'-'+(levelIndex%3+1)+' →':'出发吧 →';
$('secondary').textContent='重新开始本关';$('secondary').hidden=!resumableRun(continueLevel);
if(resumableRun(continueLevel))showSaveNote();
requestAnimationFrame(loop);
loadIllustrations();
