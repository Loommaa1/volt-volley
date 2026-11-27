"use strict";
// ================== MONDE 3D : arène, terrain, filet, joueurs, balle ==================
// Repère : x = longueur du terrain (filet en x=0, ton équipe en x<0), y = hauteur, z = largeur.
const HL=7, HW=4, CH=.8, NH=1.95, BR=0.19, G=15, GP=26; // CH : échelle des personnages

const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;renderer.physicallyCorrectLights=false;
document.getElementById('stage').appendChild(renderer.domElement);
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(55,16/9,.1,400);
scene.fog=new THREE.Fog('#3a1a55',45,140);

const col=c=>new THREE.Color(c);
function canvasTex(w,h,draw,repeat){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping}return t}
const glowTex=canvasTex(128,128,(c,w)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,w)});
const shadowTex=canvasTex(128,128,(c,w)=>{const g=c.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(0,0,0,.55)');g.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=g;c.fillRect(0,0,w,w)});

// ---------- Ciel ----------
{
  const sky=new THREE.Mesh(new THREE.SphereGeometry(200,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
    uniforms:{},vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 vP;void main(){float h=vP.y;
      vec3 top=vec3(.08,.05,.23),mid=vec3(.29,.11,.43),hor=vec3(1.,.36,.48),low=vec3(1.,.70,.42);
      vec3 c=h>.25?mix(mid,top,smoothstep(.25,.8,h)):h>.02?mix(hor,mid,smoothstep(.02,.25,h)):mix(low,hor,smoothstep(-.1,.02,h));
      float st=step(.9975,fract(sin(dot(floor(vP*300.),vec3(12.9,78.2,37.7)))*43758.5))*smoothstep(.3,.6,h);
      gl_FragColor=vec4(c+st,1.);}`}));
  scene.add(sky);
  const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:'#ffd9a0',transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending}));
  sun.position.set(120,12,-30);sun.scale.set(70,70,1);scene.add(sun);
}

// ---------- Lumières ----------
{const envScene=new THREE.Scene();const sk=scene.children.find(o=>o.isMesh&&o.geometry.type==='SphereGeometry');if(sk)envScene.add(sk.clone());
  for(const [x,z] of [[-12,-12],[12,-12],[-12,12],[12,12]]){const l=new THREE.Mesh(new THREE.BoxGeometry(5,2,1),new THREE.MeshBasicMaterial({color:new THREE.Color(6,5.6,4.6)}));l.position.set(x,16,z);l.lookAt(0,0,0);envScene.add(l)}
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshBasicMaterial({color:'#c8844a'}));fl.rotation.x=-Math.PI/2;envScene.add(fl);
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(envScene,.03).texture;pm.dispose()}
scene.add(new THREE.HemisphereLight('#a9b8ff','#5a2a3a',.5));
const sunL=new THREE.DirectionalLight('#ffe2c0',1.15);sunL.position.set(-9,20,9);sunL.castShadow=true;
sunL.shadow.mapSize.set(2048,2048);Object.assign(sunL.shadow.camera,{left:-14,right:14,top:12,bottom:-12,near:1,far:60});sunL.shadow.bias=-.0005;
scene.add(sunL);
const rimL=new THREE.DirectionalLight('#ff7cc8',.45);rimL.position.set(14,8,-12);scene.add(rimL);

// ---------- Sol et terrain ----------
{
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:'#2a1840',roughness:.9}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.01;floor.receiveShadow=true;scene.add(floor);
  const MX=2.5,MZ=2.2,CW=2*HL+2*MX,CD=2*HW+2*MZ;
  const tex=canvasTex(2048,1366,(c,w,h)=>{
    const sx=w/CW,sz=h/CD,X=x=>(x+CW/2)*sx,Z=z=>(z+CD/2)*sz;
    c.fillStyle='#d8914a';c.fillRect(0,0,w,h);
    c.fillStyle='#f2b462';c.fillRect(X(-HL),Z(-HW),2*HL*sx,2*HW*sz);
    c.fillStyle='rgba(58,111,255,.18)';c.fillRect(X(-HL),Z(-HW),HL*sx,2*HW*sz);
    c.fillStyle='rgba(255,61,94,.18)';c.fillRect(X(0),Z(-HW),HL*sx,2*HW*sz);
    c.strokeStyle='rgba(0,0,0,.08)';c.lineWidth=2;for(let y=0;y<h;y+=18){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
    for(let i=0;i<260;i++){c.fillStyle=`rgba(0,0,0,${Math.random()*.05})`;c.fillRect(Math.random()*w,Math.floor(Math.random()*h/18)*18,Math.random()*160+40,18)}
    c.strokeStyle='#fff';c.lineWidth=7;c.strokeRect(X(-HL),Z(-HW),2*HL*sx,2*HW*sz);
    c.beginPath();c.moveTo(X(0),Z(-HW));c.lineTo(X(0),Z(HW));c.stroke();
    c.lineWidth=5;c.strokeStyle='rgba(255,255,255,.85)';for(const a of[-2.3,2.3]){c.beginPath();c.moveTo(X(a),Z(-HW));c.lineTo(X(a),Z(HW));c.stroke()}
    c.font='900 italic 70px "Segoe UI",sans-serif';c.textAlign='center';c.fillStyle='rgba(255,255,255,.22)';
    c.save();c.translate(X(-HL/2),Z(0));c.rotate(-Math.PI/2);c.fillText('VOLT',0,25);c.restore();
    c.save();c.translate(X(HL/2),Z(0));c.rotate(Math.PI/2);c.fillText('VOLLEY',0,25);c.restore();
  });
  const court=new THREE.Mesh(new THREE.PlaneGeometry(CW,CD),new THREE.MeshPhysicalMaterial({map:tex,roughness:.42,metalness:0,clearcoat:.7,clearcoatRoughness:.18,envMapIntensity:.9}));
  court.rotation.x=-Math.PI/2;court.receiveShadow=true;scene.add(court);
}

// ---------- Panneaux LED ----------
const ledTex=canvasTex(1024,64,(c,w,h)=>{const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'#ff3d6e');g.addColorStop(.5,'#9b5cff');g.addColorStop(1,'#ff3d6e');c.fillStyle=g;c.fillRect(0,0,w,h);
  c.font='900 italic 40px "Segoe UI",sans-serif';c.fillStyle='#fff';c.textAlign='center';for(let x=128;x<w;x+=256)c.fillText(x%512===128?'VOLT VOLLEY':'⚡ ARENA ⚡',x,46)},true);
{
  const mat=new THREE.MeshBasicMaterial({map:ledTex});
  const mk=(w,x,z,ry)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,.8,.12),[null,null,null,null,mat,mat].map(m=>m||new THREE.MeshStandardMaterial({color:'#1a1030'})));m.position.set(x,.4,z);m.rotation.y=ry;scene.add(m)};
  mk(2*HL+6,0,-(HW+3),0);mk(2*HL+6,0,HW+3,Math.PI);mk(2*HW+6,HL+4.2,0,-Math.PI/2);mk(2*HW+6,-(HL+4.2),0,Math.PI/2);
  ledTex.repeat.set(2,1);
}

// ---------- Tribunes et public ----------
const crowd=[];let crowdBody,crowdHead;
{
  const standMat=new THREE.MeshStandardMaterial({color:'#24164c',roughness:.9});
  const rows=7,spots=[];
  const addStand=(cx,cz,len,ry)=>{const g=new THREE.Group();g.position.set(cx,0,cz);g.rotation.y=ry;
    for(let r=0;r<rows;r++){const step=new THREE.Mesh(new THREE.BoxGeometry(len,.55,1),standMat);step.position.set(0,.3+r*.55,-r*1-.5);step.receiveShadow=true;g.add(step);
      for(let x=-len/2+.4;x<len/2-.3;x+=rnd(.55,.75))spots.push({g,x:x+rnd(-.1,.1),y:.58+r*.55+.0,z:-r*1-.5+rnd(-.1,.1)})}
    scene.add(g);g.updateMatrixWorld()};
  addStand(0,-(HW+4.2),2*HL+10,0);addStand(0,HW+4.2,2*HL+10,Math.PI);addStand(HL+5.6,0,2*HW+12,-Math.PI/2);
  crowdBody=new THREE.InstancedMesh(new THREE.BoxGeometry(.42,.6,.32),new THREE.MeshStandardMaterial({roughness:.8}),spots.length);
  crowdHead=new THREE.InstancedMesh(new THREE.SphereGeometry(.15,10,8),new THREE.MeshStandardMaterial({color:'#f2c29b',roughness:.8}),spots.length);
  const v=new THREE.Vector3();
  spots.forEach((s,i)=>{v.set(s.x,s.y,s.z);s.g.localToWorld(v);crowd.push({x:v.x,y:v.y,z:v.z,ph:rnd(0,TAU),arm:Math.random()<.4});crowdBody.setColorAt(i,col(`hsl(${rnd(0,360)|0},70%,${rnd(45,65)|0}%)`))});
  crowdBody.instanceColor.needsUpdate=true;scene.add(crowdBody,crowdHead);
}
const _m=new THREE.Matrix4();
function updateCrowd(t,hype){
  crowd.forEach((p,i)=>{const j=hype>0?Math.abs(Math.sin(t*12+p.ph))*.35*hype:Math.sin(t*2+p.ph)*.03;
    _m.makeTranslation(p.x,p.y+.3+j,p.z);crowdBody.setMatrixAt(i,_m);_m.makeTranslation(p.x,p.y+.75+j,p.z);crowdHead.setMatrixAt(i,_m)});
  crowdBody.instanceMatrix.needsUpdate=crowdHead.instanceMatrix.needsUpdate=true;
}

// ---------- Projecteurs ----------
for(const [x,z] of [[-HL-3,-HW-6],[HL+3,-HW-6],[-HL-3,HW+6],[HL+3,HW+6]]){
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.12,.18,13,8),new THREE.MeshStandardMaterial({color:'#2a1d4a'}));pole.position.set(x,6.5,z);scene.add(pole);
  const head=new THREE.Mesh(new THREE.BoxGeometry(1.6,.8,.3),new THREE.MeshBasicMaterial({color:'#fff8d0'}));head.position.set(x,13,z);head.lookAt(0,0,0);scene.add(head);
  const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:'#fff4c8',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.7}));gl.position.set(x,13,z);gl.scale.set(7,7,1);scene.add(gl);
}

const beams=[];
{const beamTex=canvasTex(4,128,(c)=>{const g=c.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.75,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,1)');c.fillStyle=g;c.fillRect(0,0,4,128)});
  for(const [x,z] of [[-HL-3,-HW-6],[HL+3,-HW-6],[-HL-3,HW+6],[HL+3,HW+6]]){const tgt=new THREE.Vector3(x*.35,0,z*.35),top=new THREE.Vector3(x,13,z),len=top.distanceTo(tgt);
    const b=new THREE.Mesh(new THREE.CylinderGeometry(.5,3.2,len,24,1,true),new THREE.MeshBasicMaterial({color:'#fff1c8',alphaMap:beamTex,transparent:true,opacity:.11,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,fog:false}));
    b.position.copy(top).lerp(tgt,.5);b.lookAt(tgt);b.rotateX(Math.PI/2);scene.add(b);beams.push(b)}}
{const cloudTex=canvasTex(256,128,(c)=>{for(let i=0;i<14;i++){const x=rnd(40,216),y=rnd(50,90),r=rnd(25,50),g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(255,220,235,.55)');g.addColorStop(1,'rgba(255,220,235,0)');c.fillStyle=g;c.fillRect(0,0,256,128)}});
  for(let i=0;i<12;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,fog:false,opacity:rnd(.35,.7),color:pick(['#ffd0e0','#ffb8c8','#d8c0ff'])}));
    const a=rnd(0,TAU),d=rnd(110,150);s.position.set(Math.cos(a)*d,rnd(22,50),Math.sin(a)*d);s.scale.set(rnd(40,70),rnd(16,24),1);scene.add(s)}}
// ---------- Filet ----------
{
  const postMat=new THREE.MeshStandardMaterial({color:'#e8e8f0',metalness:.4,roughness:.4});
  for(const z of[-(HW+.7),HW+.7]){const p=new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,NH+.3,12),postMat);p.position.set(0,(NH+.3)/2,z);p.castShadow=true;scene.add(p)}
  const netTex=canvasTex(512,64,(c,w,h)=>{c.strokeStyle='rgba(20,20,30,.9)';c.lineWidth=2;for(let x=0;x<=w;x+=8){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}for(let y=0;y<=h;y+=8){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}});
  const net=new THREE.Mesh(new THREE.PlaneGeometry(2*HW+1.4,1),new THREE.MeshBasicMaterial({map:netTex,transparent:true,side:THREE.DoubleSide,depthWrite:false}));
  net.rotation.y=Math.PI/2;net.position.set(0,NH-.5,0);scene.add(net);
  const band=new THREE.Mesh(new THREE.BoxGeometry(.05,.08,2*HW+1.4),new THREE.MeshStandardMaterial({color:'#fff'}));band.position.set(0,NH-.04,0);scene.add(band);
  const band2=band.clone();band2.position.y=NH-1;band2.scale.y=.5;scene.add(band2);
  for(const z of[-HW,HW]){const a=new THREE.Mesh(new THREE.CylinderGeometry(.015,.015,.9,6),new THREE.MeshBasicMaterial({map:canvasTex(8,64,(c)=>{for(let i=0;i<8;i++){c.fillStyle=i%2?'#fff':'#ff3d6e';c.fillRect(0,i*8,8,8)}})}));a.position.set(0,NH+.35,z);scene.add(a)}
}

// ---------- Textures des balles ----------
function ballTexture(id){
  return canvasTex(512,256,(c,w,h)=>{
    const wave=(y0,amp,ph,fill)=>{c.beginPath();c.moveTo(0,0);for(let x=0;x<=w;x+=8)c.lineTo(x,y0+Math.sin(x/w*TAU*3+ph)*amp);c.lineTo(w,0);c.closePath();c.fillStyle=fill;c.fill()};
    switch(id){
      case 'classic':{c.fillStyle='#f7f3e8';c.fillRect(0,0,w,h);const cols=['#ffd23d','#2a6fdb'];for(let i=0;i<6;i++){c.save();c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.18+i*.12)+Math.sin(x/w*TAU*3)*14);for(let x=w;x>=0;x-=8)c.lineTo(x,h*(.28+i*.12)+Math.sin(x/w*TAU*3)*14);c.fillStyle=i%3===2?'#f7f3e8':cols[i%2];c.fill();c.restore()}
        c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=2;for(let i=0;i<7;i++){c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.18+i*.12)+Math.sin(x/w*TAU*3)*14);c.stroke()}break}
      case 'beach':{const cl=['#ff4757','#fff','#2e86ff','#ffd23d','#2ed573','#fff'];for(let i=0;i<6;i++){c.fillStyle=cl[i];c.fillRect(i*w/6,0,w/6+1,h)}c.fillStyle='#fff';c.fillRect(0,0,w,14);c.fillRect(0,h-14,w,14);break}
      case 'basket':{c.fillStyle='#f0812b';c.fillRect(0,0,w,h);for(let i=0;i<3000;i++){c.fillStyle='rgba(0,0,0,.08)';c.fillRect(Math.random()*w,Math.random()*h,2,2)}c.strokeStyle='#2a1206';c.lineWidth=5;c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);for(const x of[0,w/4,w/2,3*w/4]){c.moveTo(x,0);c.lineTo(x,h)}c.stroke();c.beginPath();for(let x=0;x<=w;x+=6)c.lineTo(x,h/2+Math.sin(x/w*TAU*2)*h*.32);c.stroke();break}
      case 'melon':{c.fillStyle='#3fb950';c.fillRect(0,0,w,h);c.fillStyle='#1d6b2a';for(let i=0;i<10;i++){c.beginPath();for(let y=0;y<=h;y+=4)c.lineTo(i*w/10+Math.sin(y*.12+i)*7,y);for(let y=h;y>=0;y-=4)c.lineTo(i*w/10+20+Math.sin(y*.12+i)*7,y);c.fill()}break}
      case 'eye':{c.fillStyle='#fffaf2';c.fillRect(0,0,w,h);c.strokeStyle='rgba(220,40,40,.5)';c.lineWidth=2;for(let i=0;i<30;i++){c.beginPath();let x=Math.random()*w,y=Math.random()*h;c.moveTo(x,y);for(let k=0;k<5;k++){x+=rnd(-20,20);y+=rnd(-20,20);c.lineTo(x,y)}c.stroke()}
        c.fillStyle='#2e9bff';c.beginPath();c.ellipse(w*.75,h/2,50,62,0,0,TAU);c.fill();c.fillStyle='#111';c.beginPath();c.ellipse(w*.75,h/2,24,30,0,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(w*.75-10,h/2-14,7,0,TAU);c.fill();break}
      case 'fire':{for(let y=0;y<h;y+=4)for(let x=0;x<w;x+=4){const n=Math.sin(x*.05+Math.sin(y*.07)*2)+Math.sin(y*.09+x*.02);c.fillStyle=`hsl(${20+n*12},100%,${50+n*12}%)`;c.fillRect(x,y,4,4)}break}
      case 'ice':{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#ffffff');g.addColorStop(.5,'#9fe6ff');g.addColorStop(1,'#3a9de0');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=2;for(let i=0;i<14;i++){c.beginPath();let x=Math.random()*w,y=Math.random()*h;c.moveTo(x,y);for(let k=0;k<4;k++){x+=rnd(-50,50);y+=rnd(-30,30);c.lineTo(x,y)}c.stroke()}break}
      case 'neon':{c.fillStyle='#0b0b1a';c.fillRect(0,0,w,h);const cl=['#22f0ff','#ff3df0','#b4ff3d'];c.lineWidth=7;for(let i=0;i<6;i++){c.strokeStyle=cl[i%3];c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.15+i*.14)+Math.sin(x/w*TAU*3+i)*12);c.stroke()}break}
      case 'gold':{const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,'#fff3b0');g.addColorStop(.5,'#ffc21f');g.addColorStop(1,'#a8690a');c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle='#b07a08';c.lineWidth=3;for(let i=0;i<7;i++){c.beginPath();for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.18+i*.12)+Math.sin(x/w*TAU*3)*14);c.stroke()}break}
      case 'galaxy':{const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#08051c');g.addColorStop(.5,'#3a1b8a');g.addColorStop(1,'#08051c');c.fillStyle=g;c.fillRect(0,0,w,h);for(let i=0;i<6;i++){const gg=c.createRadialGradient(rnd(0,w),rnd(0,h),0,rnd(0,w),rnd(0,h),120);gg.addColorStop(0,'rgba(255,124,245,.35)');gg.addColorStop(1,'rgba(255,124,245,0)');c.fillStyle=gg;c.fillRect(0,0,w,h)}c.fillStyle='#fff';for(let i=0;i<220;i++){const s=rnd(1,3);c.fillRect(rnd(0,w),rnd(0,h),s,s)}break}
      case 'rainbow':{for(let i=0;i<12;i++){c.fillStyle=`hsl(${i*30},100%,62%)`;c.fillRect(i*w/12,0,w/12+1,h)}break}
    }
  },true);
}
const ballMats={};
function ballMaterial(id){
  if(ballMats[id])return ballMats[id];
  const map=ballTexture(id);const o={map,roughness:.5,metalness:0};
  if(id==='neon'||id==='galaxy'||id==='fire'||id==='rainbow'){o.emissive=col('#ffffff');o.emissiveMap=map;o.emissiveIntensity=id==='fire'?.9:.7}
  if(id==='gold'){o.metalness=.6;o.roughness=.28;o.emissive=col('#5a3a00');o.emissiveIntensity=.6}
  if(id==='ice'){o.roughness=.15;o.emissive=col('#1a4a6a');o.emissiveIntensity=.3}
  o.clearcoat=.6;o.clearcoatRoughness=.25;return ballMats[id]=new THREE.MeshPhysicalMaterial(o);
}
const ballMesh=new THREE.Mesh(new THREE.SphereGeometry(BR,40,30),ballMaterial('classic'));ballMesh.castShadow=true;scene.add(ballMesh);
const ballGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));ballGlow.scale.set(1.4,1.4,1);scene.add(ballGlow);
const ballShadow=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));ballShadow.rotation.x=-Math.PI/2;scene.add(ballShadow);
const landMark=new THREE.Mesh(new THREE.RingGeometry(.32,.4,40),new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.6,depthWrite:false}));landMark.rotation.x=-Math.PI/2;landMark.position.y=.02;scene.add(landMark);
const aimMark=new THREE.Mesh(new THREE.RingGeometry(.35,.45,40),new THREE.MeshBasicMaterial({color:'#ffd23d',transparent:true,opacity:.8,depthWrite:false}));aimMark.rotation.x=-Math.PI/2;aimMark.position.y=.025;scene.add(aimMark);
const decoyMeshes=[];
function decoyMesh(i,id){while(decoyMeshes.length<=i){const m=new THREE.Mesh(ballMesh.geometry,ballMaterial(id).clone());m.material.transparent=true;m.material.opacity=.85;scene.add(m);decoyMeshes.push(m)}decoyMeshes[i].material.map=ballMaterial(id).map;return decoyMeshes[i]}

// ---------- Personnages ----------
// Les modèles sont dessinés pour ~1,95 m puis réduits par CH (taille de jeu).
const SKIN='#f2c29b';
const matCache={};
function mat(c,o={}){const k=c+JSON.stringify(o);if(!matCache[k])matCache[k]=new THREE.MeshStandardMaterial(Object.assign({color:c,roughness:.6},o));return matCache[k]}
function mesh(g,m,shadow=true){const x=new THREE.Mesh(g,m);x.castShadow=shadow;return x}
function capsule(r,l,c,o){return mesh(new THREE.CapsuleGeometry(r,l,6,14),typeof c==='string'?mat(c,o):c)}
function makeAvatar(style,teamCol,num){
  const root=new THREE.Group(),body=new THREE.Group();root.add(body);
  const dark='#'+col(teamCol).multiplyScalar(.55).getHexString();
  const skinM=mat(SKIN,{roughness:.55}),hairM=mat(style.col,{roughness:.35,emissive:col(style.col),emissiveIntensity:.18});
  const clothM=mat(teamCol,{roughness:.75}),darkM=mat(dark,{roughness:.8}),whiteM=mat('#f4f4f8',{roughness:.5});
  // jambes : cuisse + tibia, genouillère, chaussette, chaussure avec semelle colorée
  const legs=[];
  for(const s of[-1,1]){const hip=new THREE.Group();hip.position.set(0,.95,s*.12);
    const thigh=capsule(.095,.28,skinM);thigh.position.y=-.2;hip.add(thigh);
    const shin=capsule(.08,.3,skinM);shin.position.y=-.56;hip.add(shin);
    const pad=mesh(new THREE.CylinderGeometry(.1,.1,.11,14),mat('#1d1830',{roughness:.9}));pad.position.y=-.4;hip.add(pad);
    const sock=mesh(new THREE.CylinderGeometry(.082,.08,.16,12),whiteM);sock.position.y=-.73;hip.add(sock);
    const shoe=capsule(.075,.16,mat('#ffffff',{roughness:.4}));shoe.rotation.z=Math.PI/2;shoe.position.set(.06,-.86,0);hip.add(shoe);
    const sole=mesh(new THREE.BoxGeometry(.3,.035,.15),mat(style.col,{roughness:.5}));sole.position.set(.06,-.93,0);hip.add(sole);
    body.add(hip);legs.push(hip)}
  // short avec bande
  const shorts=mesh(new THREE.CylinderGeometry(.22,.25,.3,16),darkM);shorts.position.y=.98;body.add(shorts);
  for(const s of[-1,1]){const st=mesh(new THREE.BoxGeometry(.06,.28,.02),mat(style.col));st.position.set(0,.98,s*.245);body.add(st)}
  // maillot avec numéro devant et dans le dos
  const jersey=canvasTex(256,256,(c)=>{c.fillStyle=teamCol;c.fillRect(0,0,256,256);const g=c.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(0,0,0,.18)');c.fillStyle=g;c.fillRect(0,0,256,256);
    c.fillStyle=style.col;c.fillRect(0,0,256,22);c.fillRect(0,232,256,10);c.fillStyle='rgba(255,255,255,.25)';for(let i=0;i<4;i++)c.fillRect(i*64+30,40,4,180);
    c.font='900 92px "Segoe UI",sans-serif';c.textAlign='center';c.fillStyle='#fff';c.strokeStyle=dark;c.lineWidth=6;for(const x of[64,192]){c.strokeText(num,x,170);c.fillText(num,x,170)}});
  const torso=mesh(new THREE.CapsuleGeometry(.235,.34,6,16),new THREE.MeshStandardMaterial({map:jersey,roughness:.75}));torso.position.y=1.33;torso.scale.set(.9,1,1.08);body.add(torso);
  const collar=mesh(new THREE.TorusGeometry(.1,.025,8,20),mat(style.col));collar.rotation.x=Math.PI/2;collar.position.y=1.6;body.add(collar);
  const neck=capsule(.06,.06,skinM);neck.position.y=1.62;body.add(neck);
  // tête : visage, oreilles, yeux, sourcils, bouche, cheveux
  const head=new THREE.Group();head.position.y=1.8;body.add(head);
  const skull=mesh(new THREE.SphereGeometry(.18,28,22),skinM);skull.scale.set(1,1.05,.95);head.add(skull);
  for(const s of[-1,1]){const ear=mesh(new THREE.SphereGeometry(.04,10,8),skinM,false);ear.position.set(0,-.01,s*.17);ear.scale.set(.6,1,.5);head.add(ear);
    const ew=mesh(new THREE.SphereGeometry(.034,12,10),mat('#ffffff',{roughness:.2}),false);ew.position.set(.15,.015,s*.062);ew.scale.set(.5,1.1,1);head.add(ew);
    const pu=mesh(new THREE.SphereGeometry(.02,10,8),mat('#1b1030',{roughness:.2}),false);pu.position.set(.168,.012,s*.06);head.add(pu);
    const hl=mesh(new THREE.SphereGeometry(.007,6,6),new THREE.MeshBasicMaterial({color:'#ffffff'}),false);hl.position.set(.182,.024,s*.055);head.add(hl);
    const brow=mesh(new THREE.BoxGeometry(.015,.014,.055),hairM,false);brow.position.set(.16,.07,s*.062);brow.rotation.x=s*.25;head.add(brow)}
  const nose=mesh(new THREE.SphereGeometry(.018,8,6),skinM,false);nose.position.set(.18,-.02,0);head.add(nose);
  const mouth=mesh(new THREE.TorusGeometry(.03,.007,6,12,Math.PI),mat('#7a2e2e'),false);mouth.position.set(.165,-.07,0);mouth.rotation.set(0,Math.PI/2,Math.PI);head.add(mouth);
  const cap=mesh(new THREE.SphereGeometry(.192,20,12,0,TAU,0,Math.PI*.55),hairM);cap.position.set(-.015,.025,0);cap.rotation.z=.28;head.add(cap);
  const back=mesh(new THREE.SphereGeometry(.17,16,12),hairM);back.position.set(-.07,.02,0);back.scale.set(.8,.95,1.05);head.add(back);
  for(let i=0;i<11;i++){const a=-1.35+i*.27,sp=mesh(new THREE.ConeGeometry(.055+Math.random()*.02,.2+Math.random()*.1,7),hairM);
    sp.position.set(-.03+Math.sin(i*1.7)*.04,.16+Math.random()*.03,Math.sin(a)*.14);sp.rotation.set(Math.sin(a)*.6,0,.55+Math.random()*.4);head.add(sp)}
  for(let i=0;i<3;i++){const f=mesh(new THREE.ConeGeometry(.04,.13,6),hairM);f.position.set(.12,.12,(i-1)*.07);f.rotation.z=-1.9;head.add(f)} // mèches avant
  const bandM=mesh(new THREE.TorusGeometry(.183,.022,8,28),whiteM);bandM.rotation.x=Math.PI/2;bandM.position.y=.065;head.add(bandM);
  // bras : manche, avant-bras, poignet, main
  const arms=[];
  for(const s of[-1,1]){const sh=new THREE.Group();sh.position.set(0,1.52,s*.3);
    const sleeve=mesh(new THREE.SphereGeometry(.105,14,12),clothM);sleeve.scale.set(1,1.2,1);sh.add(sleeve);
    const up=capsule(.065,.22,skinM);up.position.y=-.2;sh.add(up);
    const fore=capsule(.058,.22,skinM);fore.position.y=-.43;sh.add(fore);
    const wb=mesh(new THREE.CylinderGeometry(.066,.066,.06,12),mat(style.col));wb.position.y=-.52;sh.add(wb);
    const hand=mesh(new THREE.SphereGeometry(.068,12,10),skinM);hand.position.y=-.6;hand.scale.set(.8,1,1);sh.add(hand);
    body.add(sh);arms.push(sh)}
  // effets : aura, mur, garde, glace, séisme
  const aura=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,color:style.col,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));aura.position.y=1.1;aura.scale.set(3,3.4,1);root.add(aura);
  const wall=new THREE.Mesh(new THREE.BoxGeometry(.25,1.6,1.6),new THREE.MeshBasicMaterial({color:style.col,transparent:true,opacity:.28,depthWrite:false}));wall.position.set(.3,3,0);wall.visible=false;root.add(wall);
  const guard=new THREE.Mesh(new THREE.RingGeometry(1.2,1.32,48),new THREE.MeshBasicMaterial({color:style.col,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide}));guard.rotation.x=-Math.PI/2;guard.position.y=.03;guard.visible=false;root.add(guard);
  const ice=new THREE.Mesh(new THREE.BoxGeometry(.9,2.3,.9),new THREE.MeshPhysicalMaterial({color:'#bff4ff',transparent:true,opacity:.55,roughness:.05,clearcoat:1,emissive:col('#5ac8ff'),emissiveIntensity:.3}));ice.position.y=1.15;ice.visible=false;root.add(ice);
  const quake=new THREE.Mesh(new THREE.RingGeometry(.5,.75,24),new THREE.MeshBasicMaterial({color:'#c9813b',transparent:true,opacity:.8,depthWrite:false}));quake.rotation.x=-Math.PI/2;quake.position.y=.03;quake.visible=false;root.add(quake);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.1*CH,1.1*CH),new THREE.MeshBasicMaterial({map:shadowTex,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;scene.add(shadow);
  root.scale.setScalar(CH);scene.add(root);
  return {root,body,legs,arms,head,aura,wall,guard,ice,quake,shadow};
}
function disposeAvatar(a){scene.remove(a.root);scene.remove(a.shadow)}

function applyQuality(q){renderer.setPixelRatio(q==='low'?1:Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=q!=='low';sunL.castShadow=q!=='low';
  beams.forEach(b=>b.visible=q!=='low');scene.traverse(o=>{if(o.material)o.material.needsUpdate=true});resize()}
function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<1?78:w/h<1.4?64:55;camera.updateProjectionMatrix();if(typeof onResizeFx==='function')onResizeFx()}
addEventListener('resize',resize);resize();
