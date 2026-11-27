"use strict";
// ================== EFFETS 3D : particules, anneaux, éclairs, explosions ==================
const MAXP=6000;
function makePSys(blending){
  const g=new THREE.BufferGeometry();
  const pos=new Float32Array(MAXP*3),colr=new Float32Array(MAXP*3),size=new Float32Array(MAXP),alpha=new Float32Array(MAXP),shape=new Float32Array(MAXP);
  g.setAttribute('position',new THREE.BufferAttribute(pos,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color',new THREE.BufferAttribute(colr,3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('size',new THREE.BufferAttribute(size,1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('alpha',new THREE.BufferAttribute(alpha,1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('shape',new THREE.BufferAttribute(shape,1).setUsage(THREE.DynamicDrawUsage));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending,uniforms:{uScale:{value:600}},
    vertexShader:`attribute vec3 color;attribute float size,alpha,shape;varying vec3 vC;varying float vA,vS;uniform float uScale;
      void main(){vC=color;vA=alpha;vS=shape;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=max(1.,size*uScale/-mv.z);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`varying vec3 vC;varying float vA,vS;void main(){vec2 p=gl_PointCoord-.5;float d=length(p),a;
      if(vS<.5)a=smoothstep(.5,.15,d);
      else if(vS<1.5)a=step(max(abs(p.x),abs(p.y)),.42);
      else{float s=abs(p.x*p.y);a=clamp(smoothstep(.01,0.,s)*smoothstep(.5,.05,d)+smoothstep(.16,0.,d),0.,1.);}
      if(a<.02)discard;gl_FragColor=vec4(vC,a*vA);}`});
  const pts=new THREE.Points(g,mat);pts.frustumCulled=false;scene.add(pts);
  return {g,pos,colr,size,alpha,shape,mat,list:[]};
}
const PADD=makePSys(THREE.AdditiveBlending),PNORM=makePSys(THREE.NormalBlending);
function onResizeFx(){const s=innerHeight*renderer.getPixelRatio()/(2*Math.tan(camera.fov*Math.PI/360));PADD.mat.uniforms.uScale.value=PNORM.mat.uniforms.uScale.value=s}
onResizeFx();
const _c=new THREE.Color();
// p : {x,y,z,vx,vy,vz,g,drag,life,size,grow,col,shape(0 rond,1 carré,2 étoile),add,type}
function part(o){const p=Object.assign({x:0,y:0,z:0,vx:0,vy:0,vz:0,g:0,drag:1,life:1,size:.1,grow:0,col:'#fff',shape:0,add:true,age:0,floor:false},o);
  p.max=p.life;_c.set(p.col);p.r=_c.r;p.gg=_c.g;p.b=_c.b;const s=p.add?PADD:PNORM;if(s.list.length<MAXP)s.list.push(p);return p}
function sphereBurst(x,y,z,n,cols,s1,s2,o={}){for(let i=0;i<n;i++){const u=rnd(-1,1),a=rnd(0,TAU),r=Math.sqrt(1-u*u),s=rnd(s1,s2);
  let dx=r*Math.cos(a),dy=u,dz=r*Math.sin(a);if(o.up){dy=Math.abs(dy)*o.up+(1-o.up)*dy;}
  part(Object.assign({x,y,z,vx:dx*s,vy:dy*s,vz:dz*s,col:pick(cols),size:rnd(.08,.18),life:rnd(.5,1.1),g:8,drag:.96},o,{up:undefined}))}}
function upBurst(x,y,z,n,cols,s1,s2,spread,o={}){for(let i=0;i<n;i++){const a=rnd(0,TAU),t=rnd(0,spread),s=rnd(s1,s2);
  part(Object.assign({x,y,z,vx:Math.cos(a)*Math.sin(t)*s,vy:Math.cos(t)*s,vz:Math.sin(a)*Math.sin(t)*s,col:pick(cols),size:rnd(.08,.18),life:rnd(.6,1.2),g:12,drag:.97},o))}}
function updatePSys(s,dt){
  const L=s.list;let n=0;
  for(let i=0;i<L.length;i++){const p=L[i];p.life-=dt;p.age+=dt;if(p.life<=0){if(p.onDie)p.onDie(p);continue}
    if(p.type==='orbit'){p.ang+=p.w*dt*(1+3*(1-p.rad/p.r0));p.rad-=p.rs*dt;if(p.rad<.05){continue}p.x=p.cx+Math.cos(p.ang)*p.rad;p.z=p.cz+Math.sin(p.ang)*p.rad;p.y=p.cy+Math.sin(p.ang*2)*p.rad*.15}
    else{const dr=Math.pow(p.drag,dt*60);p.vx*=dr;p.vy*=dr;p.vz*=dr;p.vy-=p.g*dt;
      if(p.type==='flutter'){p.vx+=Math.sin(p.age*4+p.ph)*1.6*dt;p.vz+=Math.cos(p.age*3+p.ph)*1.6*dt}
      if(p.type==='rocket'&&Math.random()<.8)part({x:p.x,y:p.y,z:p.z,vx:rnd(-.3,.3),vy:rnd(-.5,0),vz:rnd(-.3,.3),col:'#ffd08a',size:.06,life:.4});
      p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.floor&&p.y<.03){p.y=.03;p.vy*=-.3;p.vx*=.7;p.vz*=.7}}
    p.size+=p.grow*dt;L[n++]=p;
  }
  L.length=n;
  const m=Math.min(n,MAXP);
  for(let i=0;i<m;i++){const p=L[i],a=Math.max(0,Math.min(1,p.life/p.max));
    s.pos[i*3]=p.x;s.pos[i*3+1]=p.y;s.pos[i*3+2]=p.z;
    if(p.smoke){const t=a;if(t>.55){_c.setHSL((20+30*(t-.55)/.45)/360,1,.5+.15*(t-.55)/.45)}else{const v=.25+.35*t;_c.setRGB(v,v*.92,v*.9)}s.colr[i*3]=_c.r;s.colr[i*3+1]=_c.g;s.colr[i*3+2]=_c.b;s.alpha[i]=Math.min(1,a*1.6)*.85}
    else{s.colr[i*3]=p.r;s.colr[i*3+1]=p.gg;s.colr[i*3+2]=p.b;s.alpha[i]=p.fadeIn?Math.min(1,(p.max-p.life)/p.fadeIn)*a:a}
    s.size[i]=Math.max(.01,p.size*(p.shrink?(.4+.6*a):1));s.shape[i]=p.shape}
  for(const k of['position','color','size','alpha','shape'])s.g.attributes[k].needsUpdate=true;
  s.g.setDrawRange(0,m);
}
// ---- objets géométriques temporaires (anneaux, sphères, cônes) ----
const FXO=[];
function fxObj(mesh,o){mesh.position.set(o.x||0,o.y||0,o.z||0);scene.add(mesh);const f=Object.assign({mesh,life:1,grow:0,age:0,s0:o.size||1,fade:true,op:mesh.material.opacity},o);f.max=f.life;FXO.push(f);return f}
const ringGeo=new THREE.RingGeometry(.92,1,64),sphGeo=new THREE.SphereGeometry(1,24,16),coneGeo=new THREE.ConeGeometry(1,1,6);
function ring(x,y,z,c,size,grow,life,o={}){const m=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o.op||.9,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));
  if(o.vertical)m.userData.bill=true;else m.rotation.x=-Math.PI/2;return fxObj(m,Object.assign({x,y,z,size,grow,life},o))}
function shell(x,y,z,c,size,grow,life,op=.5){const m=new THREE.Mesh(sphGeo,new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:op,depthWrite:false,blending:THREE.AdditiveBlending}));return fxObj(m,{x,y,z,size,grow,life})}
function updateFxObjs(dt){
  for(let i=FXO.length-1;i>=0;i--){const f=FXO[i];f.life-=dt;f.age+=dt;
    if(f.life<=0){scene.remove(f.mesh);f.mesh.material.dispose();FXO.splice(i,1);continue}
    const a=f.life/f.max,s=f.s0+f.grow*f.age;
    if(f.cone){const h=Math.min(1,f.age*4)*f.h;f.mesh.scale.set(f.w,h,f.w);f.mesh.position.y=h/2}else if(f.hole){const k=Math.sin(Math.min(1,f.age/f.max*1.1)*Math.PI*.98+.05);f.mesh.scale.setScalar(f.s0*k)}else f.mesh.scale.setScalar(s);
    if(f.fade)f.mesh.material.opacity=f.op*Math.min(1,a*1.5);
    if(f.mesh.userData.bill)f.mesh.quaternion.copy(camera.quaternion);
    if(f.spin)f.mesh.rotation.z+=f.spin*dt;
  }
}
// ---- éclair : chemin brisé dessiné avec des particules lumineuses ----
function boltPts(a,b,d){if(d<.25)return[a,b];const m=a.clone().lerp(b,.5).add(new THREE.Vector3(rnd(-d,d)*.5,rnd(-d,d)*.2,rnd(-d,d)*.5));return boltPts(a,m,d/2).concat(boltPts(m,b,d/2).slice(1))}
function bolt(x1,y1,z1,x2,y2,z2,c='#fff6a8',life=.4){const pts=boltPts(new THREE.Vector3(x1,y1,z1),new THREE.Vector3(x2,y2,z2),Math.hypot(x2-x1,y2-y1,z2-z1));
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],n=Math.ceil(a.distanceTo(b)/.06);for(let k=0;k<n;k++){const t=k/n;
    part({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t,col:k%3?c:'#ffffff',size:k%3?.16:.09,life:life*rnd(.7,1)})}}}
// ---- flash écran + tremblement ----
const flashEl=document.getElementById('flash');let flashA=0,shake=0,crowdHype=0;
function flash(a=.6,c='#fff'){flashEl.style.background=c;flashA=Math.max(flashA,a)}
function updateFlash(dt){flashA=Math.max(0,flashA-dt*2.4);flashEl.style.opacity=flashA}
// ---- événements différés ----
let events=[],gameTime=0;
function later(t,fn){events.push({t:gameTime+t,fn})}
function runEvents(){for(let i=events.length-1;i>=0;i--)if(events[i].t<=gameTime){const e=events[i];events.splice(i,1);e.fn()}}

// ================== EXPLOSIONS DE POINT (3D) ==================
let pull=null; // trou noir : attire les joueurs
const EXF={
  classic(x,z,c){ring(x,.05,z,c,.3,9,.6);ring(x,.05,z,'#fff',.2,5,.4);upBurst(x,.2,z,90,[c,'#fff','#ffd23d'],4,11,1.1);shell(x,.5,z,c,.3,5,.35,.35);flash(.25);shake=Math.max(shake,.15);SFX.boom()},
  confetti(x,z){for(let i=0;i<220;i++){const a=rnd(0,TAU),t=rnd(0,.9),s=rnd(5,13);part({x,y:.2,z,vx:Math.cos(a)*Math.sin(t)*s,vy:Math.cos(t)*s,vz:Math.sin(a)*Math.sin(t)*s,g:7,drag:.95,col:`hsl(${rnd(0,360)|0},95%,60%)`,size:rnd(.1,.17),life:rnd(2.2,3.4),shape:1,add:false,type:'flutter',ph:rnd(0,9)})}
    for(const sx of[-1,1])later(.12,()=>{for(let i=0;i<90;i++)part({x:sx*(HL+3),y:.5,z:rnd(-HW,HW),vx:-sx*rnd(3,7),vy:rnd(8,13),vz:rnd(-2,2),g:7,drag:.96,col:`hsl(${rnd(0,360)|0},95%,60%)`,size:rnd(.1,.16),life:rnd(2.4,3.2),shape:1,add:false,type:'flutter',ph:rnd(0,9)})});
    ring(x,.05,z,'#fff',.2,7,.4);shake=Math.max(shake,.1);SFX.boom()},
  pixel(x,z){const pal=['#ff004d','#ffa300','#ffec27','#00e436','#29adff','#ff77a8','#ffffff'];
    for(let i=0;i<40;i++){const a=i/40*TAU;part({x,y:.3,z,vx:Math.cos(a)*7,vz:Math.sin(a)*7,drag:.93,col:pal[i%7],size:.32,life:1.2,shape:1})}
    for(let i=0;i<110;i++){const s=Math.round(rnd(2,8))*1.4;part({x:Math.round(x*4)/4,y:.2,z:Math.round(z*4)/4,vx:rnd(-.5,.5)*s,vy:s,vz:rnd(-.5,.5)*s,g:12,col:pick(pal),size:pick([.16,.24,.32]),life:rnd(1,1.8),shape:1})}
    ftext3(x,2.6,z,'+1 UP','#ffec27',46);flash(.2,'#29adff');shake=Math.max(shake,.1);SFX.boom()},
  sakura(x,z){const cols=['#ffc0d9','#ff8fbf','#ffe3ee','#ff6fa8'];
    upBurst(x,.2,z,130,cols,3,9,1.2,{g:1.5,drag:.95,size:rnd(.1,.16),life:3,shape:0,add:false,type:'flutter',ph:0});
    for(let i=0;i<160;i++)part({x:rnd(-HL-2,HL+2),y:rnd(7,12),z:rnd(-HW-2,HW+2),vy:rnd(-1.5,-.7),col:pick(cols),size:rnd(.1,.16),life:rnd(4,6),add:false,type:'flutter',ph:rnd(0,9),fadeIn:.5});
    ring(x,.05,z,'#ff8fbf',.2,6,.8);flash(.15,'#ffc0d9');shake=Math.max(shake,.08);SFX.boom()},
  firework(x,z,c){for(let k=0;k<6;k++)part({type:'rocket',x:x+rnd(-.8,.8),y:.3,z:z+rnd(-.8,.8),vx:rnd(-2.5,2.5),vy:rnd(13,17),vz:rnd(-2.5,2.5),g:9,life:rnd(.65,.95),size:.12,col:'#fff',
      onDie(r){const h=rnd(0,360);sphereBurst(r.x,r.y,r.z,110,[`hsl(${h|0},100%,65%)`,`hsl(${(h+30)%360|0},100%,75%)`,'#fff'],1.5,6,{g:1.8,drag:.965,life:rnd(1.2,1.8),size:.12});shell(r.x,r.y,r.z,`hsl(${h|0},100%,70%)`,.2,6,.3,.3);tone(rnd(80,140),.4,'sine',.25,40);noise(.3,.3,800)}});
    ring(x,.05,z,c,.2,5,.4);upBurst(x,.2,z,40,['#ffd08a','#fff'],3,7,.9);SFX.boom()},
  ice(x,z){const cols=['#bff4ff','#7fe8ff','#ffffff','#5ac8ff'];
    upBurst(x,.2,z,90,cols,4,11,1.3,{g:16,shape:1,size:rnd(.1,.2),floor:true});
    for(let i=0;i<11;i++){const m=new THREE.Mesh(coneGeo,new THREE.MeshStandardMaterial({color:pick(['#bff4ff','#7fe8ff']),transparent:true,opacity:.85,roughness:.1,emissive:col('#5ac8ff'),emissiveIntensity:.4}));
      const a=rnd(0,TAU),d=rnd(.2,2.2);m.rotation.set(rnd(-.35,.35),0,rnd(-.35,.35));fxObj(m,{x:x+Math.cos(a)*d,y:0,z:z+Math.sin(a)*d,cone:true,w:rnd(.15,.35),h:rnd(1,2.6)*(1-d/3),life:1.3})}
    for(let i=0;i<60;i++)part({x:x+rnd(-4,4),y:rnd(.5,5),z:z+rnd(-4,4),vy:rnd(-.6,-.2),col:'#fff',size:rnd(.08,.16),life:rnd(1.5,2.5),shape:2});
    ring(x,.05,z,'#bff4ff',.2,8,.6);flash(.35,'#bff4ff');shake=Math.max(shake,.16);noise(.4,.4,5000);SFX.boom()},
  thunder(x,z,c){for(let i=0;i<7;i++)later(i*.06,()=>{bolt(x+rnd(-6,6),14,z+rnd(-6,6),x+rnd(-.2,.2),0,z+rnd(-.2,.2),i%2?'#fff6a8':'#9fd3ff',.5);flash(.35);SFX.zap()});
    upBurst(x,.2,z,120,['#ffd23d','#fff6a8','#fff'],4,12,1.3);ring(x,.05,z,'#ffd23d',.3,10,.6);shell(x,.4,z,'#fff6a8',.3,6,.3,.5);flash(.7);shake=Math.max(shake,.32);SFX.boom()},
  rainbow(x,z){for(let i=0;i<7;i++)later(i*.06,()=>ring(x,.05+i*.01,z,`hsl(${i*50},100%,60%)`,.2,8,.9));
    for(let i=0;i<180;i++){const a=rnd(0,Math.PI),s=rnd(4,9),side=pick([-1,1]);part({x,y:.2,z,vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:side*rnd(0,2),g:6,drag:.97,col:`hsl(${a/Math.PI*360|0},100%,60%)`,size:rnd(.1,.18),life:rnd(1.2,1.9)})}
    for(let i=0;i<40;i++)part({x:x+rnd(-4,4),y:rnd(.5,5),z:z+rnd(-4,4),col:'#fff',size:rnd(.12,.25),life:rnd(.6,1.2),shape:2});
    flash(.3);shake=Math.max(shake,.14);SFX.boom()},
  blackhole(x,z){const cy=2.2;pull={x,y:cy,z,t:1.35};
    const hole=new THREE.Mesh(sphGeo,new THREE.MeshBasicMaterial({color:'#000000',transparent:true,opacity:1}));fxObj(hole,{x,y:cy,z,size:1,life:1.5,hole:true,fade:false});
    const disk=new THREE.Mesh(new THREE.RingGeometry(1.05,2.1,64),new THREE.MeshBasicMaterial({color:'#b066ff',transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}));disk.rotation.x=-Math.PI/2+.35;fxObj(disk,{x,y:cy,z,size:1,grow:.15,life:1.45,spin:5});
    flash(.5,'#000');
    for(let i=0;i<260;i++){const r0=rnd(2,8);part({type:'orbit',cx:x,cy,cz:z,r0,rad:r0,ang:rnd(0,TAU),w:rnd(2,4),rs:r0/rnd(.9,1.4),col:pick(['#b066ff','#fff','#6b3dff','#ff7cf5']),size:rnd(.06,.14),life:2})}
    tone(200,1.3,'sawtooth',.12,40);
    later(1.35,()=>{pull=null;releasePull(x,z);flash(1);ring(x,.05,z,'#fff',.3,18,.7);ring(x,cy,z,'#b066ff',.3,12,.9,{vertical:true});shell(x,cy,z,'#e0c0ff',.3,10,.5,.6);
      sphereBurst(x,cy,z,220,['#b066ff','#fff','#ff7cf5'],5,16,{g:2,drag:.95});shake=Math.max(shake,.4);SFX.big()})},
  nuke(x,z){flash(1);shake=Math.max(shake,.55);
    const fb=new THREE.Mesh(sphGeo,new THREE.MeshBasicMaterial({color:'#ffd27a',transparent:true,opacity:1,depthWrite:false}));fxObj(fb,{x,y:.5,z,size:.3,grow:5,life:.6});
    ring(x,.06,z,'#ffe6a0',.5,22,.9,{op:1});
    for(let i=0;i<70;i++)part({smoke:true,add:false,x:x+rnd(-.4,.4),y:rnd(0,.6),z:z+rnd(-.4,.4),vx:rnd(-.5,.5),vy:rnd(5,8),vz:rnd(-.5,.5),drag:.96,size:rnd(.6,1.1),grow:.5,life:rnd(1.6,2.4)});
    later(.35,()=>{for(let i=0;i<90;i++){const a=rnd(0,TAU);part({smoke:true,add:false,x:x+Math.cos(a)*rnd(0,1),y:5+rnd(-.4,.4),z:z+Math.sin(a)*rnd(0,1),vx:Math.cos(a)*rnd(1.5,4),vy:rnd(0,1.2),vz:Math.sin(a)*rnd(1.5,4),drag:.95,size:rnd(1,1.7),grow:.45,life:rnd(1.8,2.6)})}});
    upBurst(x,.2,z,110,['#ff9a3d','#ffd23d','#5a4a40'],5,16,1.4,{g:16,floor:true});
    for(let i=0;i<60;i++){const a=rnd(0,TAU);part({smoke:true,add:false,x:x+Math.cos(a)*rnd(0,1),y:.3,z:z+Math.sin(a)*rnd(0,1),vx:Math.cos(a)*rnd(5,10),vy:rnd(0,.8),vz:Math.sin(a)*rnd(5,10),drag:.94,size:rnd(.6,1),grow:.4,life:rnd(1.2,2)})}
    SFX.big()},
};
function explode(id,x,z,c){(EXF[id]||EXF.classic)(x,z,c||'#ffd23d');crowdHype=2.2}
