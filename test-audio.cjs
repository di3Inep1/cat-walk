const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const scope=vm.createContext({window:{},Math,Float32Array});
vm.runInContext(fs.readFileSync('audio.js','utf8'),scope);
const WalkAudio=vm.runInContext('WalkAudio',scope);
class Param{
  value=0;
  setValueAtTime(v){this.value=v;}
  exponentialRampToValueAtTime(v){this.value=v;}
  setTargetAtTime(v){this.value=v;}
}
class FakeContext{
  state='suspended';currentTime=0;sampleRate=8000;nodes=[];destination={};resumes=0;
  node(kind){
    const c=this,n={kind,connections:[],gain:new Param(),frequency:new Param(),Q:new Param(),pan:new Param(),
      connect(target){this.connections.push(target);},disconnect(){this.connections=[];},
      start(at=0){this.started=at;},stop(at){if(at===undefined){this.stopped=true;this.onended?.();}else this.ends=at;}};
    c.nodes.push(n);return n;
  }
  createGain(){return this.node('gain');}
  createBiquadFilter(){return this.node('filter');}
  createStereoPanner(){return this.node('panner');}
  createOscillator(){return this.node('oscillator');}
  createBufferSource(){return this.node('buffer');}
  createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}
  advance(dt){this.currentTime+=dt;for(const n of this.nodes)if(!n.stopped&&n.ends<=this.currentTime){n.stopped=true;n.onended?.();}}
}
let creations=0;
const context=new FakeContext(),engine=new WalkAudio(()=>{creations++;return context;});
engine.setScene('mill',true);
assert.equal(creations,0,'Opening the page never creates or plays audio');
engine.setMuted(true);engine.unlock();
assert.equal(creations,0,'A muted start does not request audio');
engine.setMuted(false);engine.unlock();
assert.equal(creations,1);
assert.equal(engine.ambient.sources.length,2,'The mill has a quiet filtered bed and a low motor tone');
const ambient=engine.ambient;
for(let i=0;i<60;i++)engine.setScene('mill',true);
assert.equal(engine.ambient,ambient,'Repeated status updates reuse the same ambience');
engine.setScene('harbor',true);
assert.ok(ambient.sources.every(n=>n.stopped&&n.connections.length===0),'Changing chapters releases the old loops');
assert.equal(engine.ambient.sources.length,1);
const materials=new Set();
for(const material of ['grass','wood','tile','ice','canvas','soft']){
  engine.surface(material);
  materials.add(context.nodes.filter(n=>n.kind==='filter'&&n.type==='bandpass').at(-1).frequency.value);
  context.advance(.3);
}
assert.equal(materials.size,6,'Each walking surface has a distinct noise spectrum');
assert.equal(engine.voices.size,0,'Finished effects disconnect themselves');
for(let i=0;i<42;i++)engine.walk(1/120,120,'wood');
assert.equal(engine.voices.size,0,'Footsteps follow distance rather than the render frame rate');
engine.walk(1/120,120,'wood');
assert.equal(engine.voices.size,2,'A footstep has a soft transient and a material body');
context.advance(.3);
for(let i=0;i<120;i++)engine.walk(1/120,0,'wood');
assert.equal(engine.voices.size,0,'An airborne or stationary cat cannot leave ghost footsteps');
engine.cue('bell');assert.equal(engine.voices.size,2);
engine.setScene('harbor',false,false);
assert.equal(engine.ambient,null);
assert.equal(engine.voices.size,0,'Pause cancels effect tails as well as ambience');
assert.equal(engine.master.gain.value,0);
engine.setScene('forest',true);engine.cue('jump');engine.setMuted(true);
assert.equal(engine.master.gain.value,0);
assert.equal(engine.ambient,null);
assert.equal(engine.voices.size,0);
const count=context.nodes.length;
engine.cue('fish');engine.walk(1,240,'wood');
assert.equal(context.nodes.length,count,'Muted gameplay allocates no new audio sources');
engine.setMuted(false);engine.unlock();
assert.equal(creations,1,'Unmuting reuses the context after a user gesture');
assert.ok(engine.ambient);
for(let i=0;i<100;i++)engine.cue('bell');
assert.equal(engine.voices.size,24,'Concurrent effects are bounded');
engine.setScene('forest',false,false);
assert.equal(engine.voices.size,0);
const unavailable=new WalkAudio(()=>{throw new Error('No audio device');});
assert.doesNotThrow(()=>{unavailable.setScene('mill',true);unavailable.unlock();unavailable.surface('wood');unavailable.cue('fish');});
console.log('PASS: gesture-only audio, material foley, distance cadence, pause/mute, chapter cleanup, bounded voices and unavailable devices');
