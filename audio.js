'use strict';
// Original procedural foley: no downloads, decoding, or autoplay before a gesture.
class WalkAudio {
  constructor(makeContext=()=>new (window.AudioContext||window.webkitAudioContext)()){
    this.makeContext=makeContext;this.context=null;this.muted=false;
    this.scene='forest';this.active=false;this.effectsAllowed=false;
    this.voices=new Set();this.ambient=null;this.distance=0;this.machineClock=0;this.modClock=0;
  }
  unlock(){
    if(this.muted)return;
    try{
      if(!this.context){
        const c=this.context=this.makeContext();
        this.master=c.createGain();this.master.gain.value=.5;this.master.connect(c.destination);
        this.effects=c.createGain();this.effects.connect(this.master);
        this.noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);
        const data=this.noise.getChannelData(0);let seed=371;
        for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;data[i]=seed/2147483648-1;}
      }
      this.context.resume().then(()=>this.reconcile()).catch(()=>{});
      this.reconcile();
    }catch{/* A device without Web Audio still has the full visual game. */}
  }
  setMuted(value){this.muted=!!value;this.reconcile();}
  setScene(scene,active,effectsAllowed=active){
    if(this.scene!==scene){this.stopAmbient();this.distance=0;this.machineClock=0;}
    this.scene=scene;this.active=!!active;this.effectsAllowed=!!effectsAllowed;this.reconcile();
  }
  reconcile(){
    const c=this.context;if(!c||!this.master)return;
    const audible=!this.muted&&this.effectsAllowed;
    this.master.gain.setTargetAtTime(audible?.5:0,c.currentTime,.018);
    if(!audible){this.stopVoices();this.distance=0;}
    if(this.active&&!this.muted&&c.state==='running'){
      if(!this.ambient)this.startAmbient();
    }else this.stopAmbient();
  }
  stopVoices(){
    for(const v of [...this.voices]){try{v.source.stop();}catch{}v.cleanup();}
  }
  stopAmbient(){
    const a=this.ambient;if(!a)return;this.ambient=null;
    for(const source of a.sources){try{source.stop();}catch{}source.disconnect();}
    for(const node of a.nodes)node.disconnect();
  }
  startAmbient(){
    const c=this.context,source=c.createBufferSource(),filter=c.createBiquadFilter(),gain=c.createGain();
    const settings={forest:[550,.012],harbor:[850,.022],roof:[440,.014],mill:[680,.011]}[this.scene];
    source.buffer=this.noise;source.loop=true;filter.type='lowpass';filter.frequency.value=settings[0];
    gain.gain.value=settings[1];source.connect(filter);filter.connect(gain);gain.connect(this.master);source.start();
    const sources=[source],nodes=[filter,gain];
    if(this.scene==='mill'){
      const hum=c.createOscillator(),humGain=c.createGain();hum.type='sine';hum.frequency.value=56;
      humGain.gain.value=.012;hum.connect(humGain);humGain.connect(this.master);hum.start();sources.push(hum);nodes.push(humGain);
    }
    this.ambient={sources,nodes,gain,base:settings[1]};
  }
  voice({frequency=220,end=frequency,duration=.1,gain=.03,type='sine',noise=false,filter=1200,delay=0,pan=0}={}){
    const c=this.context;if(!c||c.state!=='running'||this.muted||!this.effectsAllowed||this.voices.size>=24)return;
    const source=noise?c.createBufferSource():c.createOscillator(),envelope=c.createGain();
    const shaping=c.createBiquadFilter(),start=c.currentTime+delay;
    if(noise){source.buffer=this.noise;shaping.type='bandpass';shaping.frequency.value=filter;shaping.Q.value=.65;}
    else{source.type=type;source.frequency.setValueAtTime(frequency,start);source.frequency.exponentialRampToValueAtTime(Math.max(20,end),start+duration);shaping.type='lowpass';shaping.frequency.value=3500;}
    envelope.gain.setValueAtTime(.0001,start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),start+.006);
    envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
    source.connect(shaping);shaping.connect(envelope);
    const panner=c.createStereoPanner?.();
    if(panner){panner.pan.value=Math.max(-.65,Math.min(.65,pan));envelope.connect(panner);panner.connect(this.effects);}
    else envelope.connect(this.effects);
    const v={source,cleanup:()=>{source.disconnect();shaping.disconnect();envelope.disconnect();panner?.disconnect();this.voices.delete(v);}};
    this.voices.add(v);source.onended=v.cleanup;
    if(noise)source.start(start,(c.currentTime*.137)%1.5);else source.start(start);
    source.stop(start+duration+.01);
  }
  surface(material,weight=1){
    const body={grass:[1450,160,.025],wood:[700,125,.035],tile:[2200,620,.023],ice:[3200,980,.014],canvas:[1100,95,.022],soft:[500,90,.018]}[material]||[700,125,.03];
    const strength=Math.min(1.7,Math.max(.4,weight));
    this.voice({noise:true,filter:body[0],gain:body[2]*strength,duration:material==='ice'?.09:.055});
    this.voice({frequency:body[1],end:body[1]*.74,gain:.017*strength,duration:.065,type:material==='tile'?'sine':'triangle'});
  }
  cue(name){
    const notes={jump:[420,500],spring:[330,660],fish:[880,1174],lamp:[523,659,784],finish:[523,659,784,1046],fall:[170,105],crack:[110,75],bell:[784,1568]}[name];
    if(!notes)return;
    notes.forEach((frequency,i)=>this.voice({frequency,end:frequency*.995,duration:name==='bell'?.8:.14,gain:name==='bell'?(i?.012:.035):.028,delay:i*(name==='bell'?0:.065)}));
    if(name==='crack')this.voice({noise:true,filter:850,gain:.06,duration:.15});
  }
  walk(dt,speed,material,machine={distance:Infinity,pan:0}){
    if(!this.active||this.muted||!this.context||this.context.state!=='running'){this.distance=0;return;}
    if(speed>18){this.distance+=speed*dt;if(this.distance>=43){this.distance%=43;this.surface(material,.7);}}
    else this.distance=0;
    this.modClock-=dt;
    if(this.ambient&&this.modClock<=0){this.modClock=.25;this.ambient.gain.gain.setTargetAtTime(this.ambient.base*(.82+.18*Math.sin(this.context.currentTime*.5)),this.context.currentTime,.3);}
    this.machineClock-=dt;
    if(this.scene==='mill'&&machine.distance<430&&this.machineClock<=0){
      this.machineClock=.62;
      this.voice({frequency:72,end:48,gain:.014*(1-machine.distance/500),duration:.12,type:'triangle',pan:machine.pan});
      this.voice({noise:true,filter:500,gain:.014*(1-machine.distance/500),duration:.045,pan:machine.pan});
    }
  }
}
