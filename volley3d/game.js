"use strict";
// ================== JEU : joueurs, balle, pouvoirs, IA d'équipe, HUD, menus ==================
if(cfg.team==null)cfg.team=2;
const HAND=2.25*CH,CHEST=1.1*CH,HITBOX=.9; // HITBOX : marge ajoutée à la zone de contact de la balle // hauteur de la main bras levé / du buste, pieds au sol
let players=[],human=null,ball=null,state='menu',server=null,servingSide=-1,lastWinner=-1,score=[0,0],stateT=0,matchCoins=0,oppExplo='classic',decoys=[],serveIdx={'-1':0,'1':0};
const teamOf=s=>players.filter(p=>p.side===s);
const hasB=(p,n)=>(p.buffs[n]||0)>0,isRole=(p,r)=>p.style.role===r,abs_=p=>p.style.ab||[],lvlBonus=p=>(p.lvl-1)*.3;
const Dif=()=>DIFF[cfg.diff];
const jumpH=p=>(.72+(p.style.jmp+lvlBonus(p))*.1)*(hasB(p,'superjump')?1.45:1);
const jumpV=p=>Math.sqrt(2*GP*jumpH(p));
const speedOf=p=>(4.6+(p.style.spd+lvlBonus(p))*.55)*(hasB(p,'sprint')?1.5:1)*(p.isHuman?1:Dif().spd);
const powOf=p=>(15+(p.style.pow+lvlBonus(p))*2)*(isRole(p,'att')?1.08:1)*(p.isHuman?1:Dif().pow);
const abCd=p=>Math.max(...abs_(p).map(a=>AB[a].cd))*(1-(p.lvl-1)*.06);
const aiHas=(p,l)=>abs_(p).some(a=>l.includes(a));
const labelsEl=document.getElementById('labels'),ftextsEl=document.getElementById('ftexts');

// ---------- Textes flottants (projetés depuis la 3D) ----------
const FT=[];const _v=new THREE.Vector3();
function ftext3(x,y,z,txt,c='#fff',size=30,life=1.2){const el=document.createElement('div');el.className='ft';el.textContent=txt;el.style.color=c;el.style.fontSize=size+'px';ftextsEl.appendChild(el);FT.push({el,x,y,z,life,max:life})}
function updateFT(dt){for(let i=FT.length-1;i>=0;i--){const f=FT[i];f.life-=dt;f.y+=dt*.8;if(f.life<=0){f.el.remove();FT.splice(i,1);continue}
  _v.set(f.x,f.y,f.z).project(camera);f.el.style.display=_v.z>1?'none':'';f.el.style.left=((_v.x+1)/2*innerWidth)+'px';f.el.style.top=((1-_v.y)/2*innerHeight)+'px';f.el.style.opacity=Math.min(1,f.life/f.max*2.5)}}
let bannerT=0;const bannerEl=document.getElementById('banner');
function banner(t,c){bannerEl.textContent=t;bannerEl.style.color=c;bannerEl.style.opacity=1;bannerT=1.8}

// ---------- Joueurs ----------
function homePos(side,i,n){const L=[[[3.2,0]],[[2,-1.6],[4.6,1.6]],[[1.5,0],[4.4,-2.2],[4.4,2.2]]][n-1][i];return{x:side*L[0],z:L[1]}}
function makePlayer(side,styleId,isHuman,idx,n){
  const st=S(styleId),h=homePos(side,idx,n);
  const p={side,isHuman,style:st,idx,home:h,x:h.x,y:0,z:h.z,vx:0,vy:0,vz:0,onGround:true,yaw:side<0?0:Math.PI,
    cd:0,charged:[],buffs:{},frozen:0,noJump:0,dive:0,recover:0,hitCd:0,spikeAnim:0,blind:0,run:0,twin:0,spin:0,
    lvl:st.r==='U'?(isHuman?masteryLvl(st.id):1+(Math.random()*4|0)):1,title:null,
    ctl:{mx:0,mz:0,jumpQ:false,hitBuf:0,setBuf:0,diveQ:false},
    ai:{tx:h.x,tz:h.z,plan:'home',think:rnd(0,.2),serveT:1,roll:-1,doSpike:true,doBlock:false,ex:0,ez:0}};
  p.av=makeAvatar(st,side<0?'#2f7cff':'#ff4d5e',isHuman?'7':String(side<0?2+idx:9+idx));
  p.label=document.createElement('div');p.label.className='plabel'+(isHuman?' me':'');labelsEl.appendChild(p.label);
  return p;
}
function refreshLabel(p){const t=p.title&&p.title!=='none'?TITLES.find(t=>t.id===p.title):null;
  p.label.innerHTML=(t?`<div class="tt">${t.n}</div>`:'')+`<div style="color:${RAR[p.style.r].c}">${p.isHuman?'TOI · ':''}${ROLES[p.style.role].ic} ${p.style.n}${p.lvl>1?' niv.'+p.lvl:''}</div>`}
function clearPlayers(){for(const p of players){disposeAvatar(p.av);p.label.remove()}players=[];human=null}

// ---------- Balle ----------
function newBall(){return{x:0,y:3,z:0,vx:0,vy:0,vz:0,g:G,t:0,fx:null,fxSide:0,touchTeam:0,touches:0,hitId:0,last:null,lastKind:null,skin:save.eq.ball,boost:1,boostSide:0,setFor:null}}
function launchTo(tx,tz,ty,apex){const b=ball;apex=Math.max(apex,b.y+.3,ty+.3);
  const vy0=Math.sqrt(2*b.g*(apex-b.y)),tUp=vy0/b.g,tDn=Math.sqrt(2*(apex-ty)/b.g),T=tUp+tDn;
  b.vy=vy0;b.vx=(tx-b.x)/T;b.vz=(tz-b.z)/T}
function predict(level,maxT=3){const b=ball;let x=b.x,y=b.y,z=b.z,vx=b.vx,vy=b.vy,vz=b.vz;const dt=1/120;
  if(vy<0&&y<=level)return{x,z,t:0};
  for(let t=0;t<maxT;t+=dt){vy-=b.g*dt;x+=vx*dt;y+=vy*dt;z+=vz*dt;if(vy<0&&y<=level)return{x,z,t};if(y<=BR)return{x,z,t,ground:true}}
  return null}
function touch(p,kind){const b=ball,t=p.side;
  if(b.touchTeam!==t){b.touchTeam=t;b.touches=0}
  b.touches++;b.hitId++;b.last=p;b.lastKind=kind;p.hitCd=.22;b.fx=null;b.g=G;b.setFor=null;
  if(b.touches>3){pointTo(-t,'4 TOUCHES !');return false}
  return true}
function setBoost(p,perfect){const b=ball;b.boost=perfect?1.4:isRole(p,'pas')?1.12:1;b.boostSide=p.side;
  if(perfect){ring(b.x,b.y,b.z,'#ffd23d',.2,3,.5,{vertical:true});ftext3(b.x,b.y+.6,b.z,'PASSE PARFAITE','#ffd23d',24,1);SFX.power()}}
function takeCharge(p,a){const i=p.charged.indexOf(a);if(i<0)return false;p.charged.splice(i,1);return true}
function attackerFor(p){const mates=teamOf(p.side).filter(q=>q!==p);if(!mates.length)return p;const h=mates.find(q=>q.isHuman);if(h)return h;return mates.reduce((a,q)=>Math.abs(q.x)<Math.abs(a.x)?q:a)}
function bump(p){
  const b=ball,s=p.side,inc=Math.hypot(b.vx,b.vy,b.vz);
  if(!touch(p,'bump'))return;
  // réception ratée : plus la balle arrive vite, plus c'est probable
  const shankP=clamp((inc-15)/14,0,.85)*(isRole(p,'lib')||hasB(p,'guard')?.35:1)*(p.dive>0?.75:1);
  if(Math.random()<shankP){const back=s*(HL+rnd(.6,2.5));launchTo(back,clamp(p.z+rnd(-3,3),-HW-2,HW+2),BR,rnd(1.6,2.4));ftext3(p.x,p.y+2.6,p.z,'RATÉ !','#ff8080',26,.9);SFX.net();return}
  let err=inc>17?.9:.35;if(isRole(p,'lib')||hasB(p,'guard'))err*=.35;
  if(b.touches>=3)launchTo(-s*rnd(3,HL-.8),rnd(-HW+.8,HW-.8),BR,rnd(4,5.2));
  else if(takeCharge(p,'perfect')){const a=attackerFor(p);b.g=G*.6;launchTo(s*1,clamp(a.z,-HW+.6,HW-.6),2.8,4.6);b.setFor=a;setBoost(p,true)}
  else{// réception : la balle monte haut, pile au-dessus du réceptionneur
    const tx=s*Math.max(.6,Math.abs(p.x+rnd(-err,err)*.25)),tz=clamp(p.z+rnd(-err,err)*.25,-HW-1,HW+1);
    launchTo(tx,tz,2.4,rnd(4.2,4.8));if(b.touches===2)setBoost(p,false)}
  upBurst(b.x,b.y,b.z,10,['#fff'],1,3,1.4,{g:3,life:.35,size:.08});SFX.bump();
}
function setBall(p){
  if(!touch(p,'set'))return;const b=ball,s=p.side;
  if(b.touches>=3)launchTo(-s*rnd(4,HL-.6),rnd(-HW+1,HW-1),BR,rnd(4.5,5.5));
  else{const a=attackerFor(p),perfect=takeCharge(p,'perfect');if(perfect)b.g=G*.6;
    launchTo(s*rnd(.8,1.2),clamp(a.z+rnd(-.3,.3),-HW+.6,HW-.6),2.8,perfect||isRole(p,'pas')?4.7:rnd(4.3,5));b.setFor=a;setBoost(p,perfect)}
  ring(b.x,b.y,b.z,'#fff',.15,2,.3,{vertical:true});SFX.set();
}
function aiAim(p){const s=p.side,opp=teamOf(-s);let best=null,bs=-1;
  for(let i=0;i<8;i++){const x=-s*rnd(1.2,HL-.5),z=rnd(-HW+.5,HW-.5);let m=1e9;for(const o of opp)m=Math.min(m,Math.hypot(o.x-x,o.z-z));if(m>bs){bs=m;best={x,z}}}
  return Math.random()<.3+.6*Dif().spike?best:{x:-s*rnd(1.5,HL-.6),z:rnd(-HW+.6,HW-.6)}}
// Inclinaison : Z (avant) = balle près du filet, S (arrière) = fond de terrain ; la souris garde la gauche/droite.
// Inclinaison dans toutes les directions : avant/arrière = distance, gauche/droite = côté (relatif à la caméra).
function tiltOf(p){let mx=(held('up')?1:0)-(held('down')?1:0)-joy.y*1.5,mz=(held('right')?1:0)-(held('left')?1:0)+joy.x*1.5;
  let wx,wz;if(camMode==='auto'){wx=mx*-p.side;wz=mz*-p.side}else{const cy=Math.cos(camYaw),sy=Math.sin(camYaw);wx=cy*mx-sy*mz;wz=sy*mx+cy*mz}
  const f=clamp(wx*-p.side,-1,1),l=clamp(wz,-1,1);return{f:f>.3?1:f<-.3?-1:0,l:Math.abs(l)>.3?Math.sign(l)*Math.min(1,Math.abs(l)):0}}
function aimFor(p,preview){if(!p.isHuman)return aiAim(p);
  let t;if(aim.valid&&aim.x*p.side<-.3)t={x:clamp(aim.x,-HL+.3,HL-.3),z:clamp(aim.z,-HW+.3,HW-.3)};else t=preview?{x:-p.side*4.2,z:0}:{x:-p.side*rnd(3,5.5),z:rnd(-HW+1,HW-1)};
  const tl=tiltOf(p);t.tilt=tl.f;t.side=tl.l;if(tl.l)t.z=tl.l*(HW-.7);
  if(t.tilt>0)t.x=-p.side*(preview?1.5:rnd(1.1,1.9));else if(t.tilt<0)t.x=-p.side*(preview?HL-.7:rnd(HL-1,HL-.4));
  return t}
function spike(p){
  const b=ball,s=p.side,o=-s;
  const boost=b.boostSide===s?b.boost||1:1;b.boost=1;b.boostSide=0;
  if(!touch(p,'spike'))return;
  let power=powOf(p)*boost,fx=null,fxName=null;
  const ch=p.charged.filter(a=>a!=='perfect'&&a!=='ace');p.charged=p.charged.filter(a=>a==='perfect'||a==='ace');
  let t=aimFor(p);p.spikeAnim=.25;
  if(ch.length===1&&ch[0]==='feint'){launchTo(o*rnd(.6,1.4),clamp(t.z,-HW+.5,HW-.5),BR,NH+.7);b.fx='feint';ftext3(b.x,b.y+.6,b.z,'FEINTE','#9fd3ff',26,.9);SFX.set();return}
  const has=a=>ch.includes(a)&&(fxName=AB[a].n);
  if(has('thunder')){power*=1.7;fx='thunder';flash(.45,'#fff6a8');bolt(b.x,b.y,b.z,b.x+o*rnd(1,2),b.y+rnd(1.5,3),b.z+rnd(-1,1),'#fff6a8',.3);SFX.zap();shake=Math.max(shake,.25)}
  if(has('meteor')){power*=1.6;fx='meteor';flash(.35,'#ff9a3d');shake=Math.max(shake,.28);SFX.boom()}
  if(has('comet')){power*=1.1;fx='comet';t={x:o*rnd(5,HL-.4),z:t.z}}
  if(has('banana')){power*=1.05;fx='banana';t={x:o*rnd(5.5,HL-.3),z:t.z}}
  if(has('ghost')){power*=1.15;fx='ghost';for(const q of teamOf(o))if(!q.isHuman)q.blind=.42}
  if(has('cyclone')){power*=1.35;fx='cyclone';shake=Math.max(shake,.2)}
  if(boost>1.3)fxName=fxName||'Smash parfait';
  let dx=t.x-b.x,dy=BR-b.y,dz=t.z-b.z;
  let redir=false;if(b.x*s>-.2){const t0=-b.x/dx;if(t0>0&&t0<1){const yAt=b.y+dy*t0;if(yAt<NH+.35){const zAt=b.z+dz*t0;dx=-b.x||o*.1;dy=NH+.42-b.y;dz=zAt-b.z;redir=true}}}
  // inclinaison avant : si le smash direct ne passe pas, amorti qui plonge juste derrière le filet
  if(t.tilt>0&&redir){b.g=G*1.7;launchTo(t.x,clamp(t.z,-HW+.5,HW-.5),BR,Math.max(NH+.75,b.y+.3));b.fx=fx;b.fxSide=o;b.t=0;ftext3(b.x,b.y+.8,b.z,(fxName?fxName.toUpperCase()+' · ':'')+'AMORTI !',p.style.col,28,1);SFX.spike();sphereBurst(b.x,b.y,b.z,20,[p.style.col,'#fff'],2,5,{g:2,life:.4});return}
  let roll=dy>=-.05;
  if(!roll){const t1=(BR-b.y)/dy,xl=b.x+dx*t1,zl=b.z+dz*t1;if(xl*o<.3||Math.abs(xl)>HL-.2||Math.abs(zl)>HW-.2)roll=true}
  if(roll){b.g=G*1.6;launchTo(t.tilt?t.x:o*rnd(2,4.5),clamp(t.z,-HW+.6,HW-.6),BR,NH+.9);fxName=fxName||'Roll shot'}
  else{const L=Math.hypot(dx,dy,dz)||1;b.vx=dx/L*power;b.vy=dy/L*power;b.vz=dz/L*power;b.g=fx==='comet'||fx==='banana'?G*.2:t.tilt<0?G*.28:G*.5}
  b.fx=fx;b.fxSide=o;b.t=0;
  if(has('mirage')){fxName=AB.mirage.n;for(let i=0;i<3;i++){const k=rnd(.85,1.1);decoys.push({x:b.x,y:b.y,z:b.z,vx:b.vx*k+rnd(-2,2),vy:b.vy*k+rnd(-1.5,1.5),vz:b.vz*k+rnd(-4,4)})}for(const q of teamOf(o))if(!q.isHuman)q.blind=.3}
  sphereBurst(b.x,b.y,b.z,26,[p.style.col,'#fff'],2,6,{g:2,life:.4});ring(b.x,b.y,b.z,p.style.col,.2,4,.3,{vertical:true});
  shake=Math.max(shake,.12);SFX.spike();
  if(fxName)ftext3(b.x,b.y+.8,b.z,fxName.toUpperCase()+' !',p.style.col,30,1);
}
function block(p){const b=ball;b.touchTeam=p.side;b.touches=0;b.hitId++;b.last=p;b.lastKind='block';p.hitCd=.25;b.fx=null;b.g=G;b.setFor=null;
  b.vx=-b.vx*.5-p.side*1.5;b.vy=-Math.abs(b.vy)*.3-2;b.vz*=.5;if(b.x*p.side>0)b.x=-p.side*(BR+.06);
  ftext3(0,NH+1.4,p.z,'CONTRE !',p.style.col,44,1.1);sphereBurst(b.x,b.y,b.z,40,[p.style.col,'#fff'],2,7,{g:5});shake=Math.max(shake,.2);SFX.block()}
function applyAb(p,a){const d=AB[a],opp=teamOf(-p.side);
  if(d.k==='buff')p.buffs[a]=d.t+(p.lvl-1)*.3;
  else if(d.k==='charge'){if(!p.charged.includes(a))p.charged.push(a)}
  else if(a==='freeze'){const q=opp.reduce((m,q)=>Math.hypot(q.x-ball.x,q.z-ball.z)<Math.hypot(m.x-ball.x,m.z-ball.z)?q:m);q.frozen=1.3;q.dive=0;
    sphereBurst(q.x,q.y+1,q.z,40,['#bff4ff','#fff'],1,4,{shape:1,g:3,life:.8});noise(.4,.4,6000)}
  else if(a==='quake'){for(const q of opp)q.noJump=1.8;shake=Math.max(shake,.3);SFX.boom();for(let i=0;i<80;i++)part({x:-p.side*rnd(.5,HL),y:.05,z:rnd(-HW,HW),vx:rnd(-.5,.5),vy:rnd(3,7),vz:rnd(-.5,.5),g:14,col:pick(['#c9813b','#8a5a2b','#f2d0a0']),size:rnd(.08,.18),life:rnd(.6,1),shape:1,add:false})}
  else if(a==='teleport'){const pr=state==='play'?predict(CHEST):null;if(pr&&pr.x*p.side>0){sphereBurst(p.x,p.y+1,p.z,40,['#5a3d8a','#b066ff','#000'],1,4,{g:0,life:.5});p.x=pr.x;p.z=pr.z;sphereBurst(p.x,p.y+1,p.z,40,['#5a3d8a','#fff','#b066ff'],1,4,{g:0,life:.5});tone(900,.2,'sine',.15,200)}}}
function useAbility(p){
  const list0=abs_(p);if(p.cd>0||!list0.length||(state!=='play'&&state!=='serve'))return;
  let list=list0,name=AB[list0[0]].n;
  if(list0[0]==='twins'){p.twin^=1;list=p.twin?['thunder']:['wall'];name=p.twin?'Mode attaque':'Mode défense'}
  if(list0[0]==='rebirth'){list=['superjump','sprint','guard','meteor'];flash(.4,'#3dffb4');sphereBurst(p.x,p.y+1,p.z,80,['#3dffb4','#ffd23d','#fff'],2,6,{g:-3,life:1})}
  for(const a of list)applyAb(p,a);
  p.cd=abCd(p);SFX.power();
  ring(p.x,.05,p.z,p.style.col,.3,4,.5);upBurst(p.x,p.y+.2,p.z,30,[p.style.col,'#fff'],1,4,.6,{g:-2,life:.7});
  ftext3(p.x,p.y+2.9,p.z,name,p.style.col,24,1)}
function serve(p){const b=ball,s=p.side;b.touchTeam=s;b.touches=0;b.hitId++;b.last=p;b.lastKind='serve';b.fx=null;b.g=G;p.spikeAnim=.25;p.hitCd=.3;
  const t=aimFor(p);t.x=-s*clamp(Math.abs(t.x),2.5,HL-.5);
  if(takeCharge(p,'ace')){b.g=G*2;launchTo(t.x,t.z,BR,NH+1.1);b.fx='thunder';b.fxSide=-s;ftext3(b.x,b.y+.6,b.z,'SERVICE CANON !',p.style.col,28,1);shake=Math.max(shake,.15);SFX.zap()}
  else if(isRole(p,'ser')){b.g=G*1.4;launchTo(t.x,t.z,BR,rnd(3.6,4))}
  else launchTo(t.x,t.z,BR,rnd(4.2,5));
  state='play';SFX.spike();sphereBurst(b.x,b.y,b.z,16,['#fff',p.style.col],1,3,{g:3,life:.4})}

// ---------- Entrées ----------
const keys={},tbtn={},joy={x:0,y:0};const mouse={x:0,y:0,in:false};const aim={x:0,z:0,valid:false};
const K={up:['KeyW','KeyZ','ArrowUp'],down:['KeyS','ArrowDown'],left:['KeyA','KeyQ','ArrowLeft'],right:['KeyD','ArrowRight'],jump:['Space'],hit:['KeyJ'],set:['KeyL'],dive:['KeyK'],ab:['KeyE']};
const held=a=>K[a].some(k=>keys[k]);
addEventListener('keydown',e=>{audioInit();if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();if(e.repeat)return;keys[e.code]=true;
  if(human){if(K.hit.includes(e.code))human.ctl.hitBuf=.16;if(K.set.includes(e.code))human.ctl.setBuf=.16;if(K.jump.includes(e.code))human.ctl.jumpQ=true;if(K.dive.includes(e.code))human.ctl.diveQ=true;if(K.ab.includes(e.code))useAbility(human);
    if(e.code==='ShiftLeft'||e.code==='ShiftRight')toggleLock();if(e.code==='KeyC')resetCam()}
  if(e.code==='Escape')togglePause()});
addEventListener('keyup',e=>{keys[e.code]=false});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false});
const cvs=renderer.domElement;
cvs.addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;mouse.in=true});
cvs.addEventListener('mouseleave',()=>mouse.in=false);
// Clic gauche : smash en l'air / réception au sol (et service). Clic droit : set en l'air ; maintenu + glissé = caméra libre.
cvs.addEventListener('mousedown',e=>{audioInit();if(!human)return;if(e.button===0)human.ctl.hitBuf=.16;if(e.button===2&&!human.onGround)human.ctl.setBuf=.16});
document.addEventListener('mousemove',e=>{if(!human||state==='menu')return;
  if(document.pointerLockElement===cvs){rotCam(e.movementX,e.movementY);return}
  if(e.buttons&2){if(camMode==='auto')initOrbit();rotCam(e.movementX,e.movementY)}});
cvs.addEventListener('wheel',e=>{if(!human||state==='menu')return;e.preventDefault();if(camMode==='auto')initOrbit();camDist=clamp(camDist*(e.deltaY>0?1.12:.89),2.5,16)},{passive:false});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==cvs&&camMode==='lock')camMode='orbit'});
cvs.addEventListener('contextmenu',e=>e.preventDefault());
const isTouch='ontouchstart' in window||navigator.maxTouchPoints>0;
document.querySelectorAll('.tb').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('pointerdown',e=>{e.preventDefault();audioInit();b.classList.add('on');tbtn[k]=true;if(k==='pause')return togglePause();if(!human)return;
    if(k==='hit')human.ctl.hitBuf=.18;if(k==='set')human.ctl.setBuf=.18;if(k==='jump')human.ctl.jumpQ=true;if(k==='dive')human.ctl.diveQ=true;if(k==='ab')useAbility(human)});
  const up=()=>{b.classList.remove('on');tbtn[k]=false};b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up)});
{const J=document.getElementById('joy'),Kn=document.getElementById('joyK');let id=null,ox=0,oy=0;
  J.addEventListener('pointerdown',e=>{id=e.pointerId;const r=J.getBoundingClientRect();ox=r.left+r.width/2;oy=r.top+r.height/2;J.setPointerCapture(id);mv(e)});
  const mv=e=>{if(e.pointerId!==id)return;let dx=(e.clientX-ox)/60,dy=(e.clientY-oy)/60;const l=Math.hypot(dx,dy);if(l>1){dx/=l;dy/=l}joy.x=dx;joy.y=dy;Kn.style.transform=`translate(${dx*48}px,${dy*48}px)`};
  J.addEventListener('pointermove',mv);const end=e=>{if(e.pointerId!==id)return;id=null;joy.x=joy.y=0;Kn.style.transform=''};J.addEventListener('pointerup',end);J.addEventListener('pointercancel',end)}
const ray=new THREE.Raycaster(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),_hit=new THREE.Vector3(),_ndc=new THREE.Vector2();
// ---------- Caméra : auto (suit le joueur), libre (clic droit maintenu), verrouillée (Shift) ----------
let camMode='auto',camYaw=0,camPitch=-.25,camDist=7;const _f=new THREE.Vector3(),_r=new THREE.Vector3(),_hd=new THREE.Vector3();
function initOrbit(){camera.getWorldDirection(_f);camYaw=Math.atan2(_f.z,_f.x);camPitch=clamp(Math.asin(_f.y),-1.2,.5);camDist=clamp(camera.position.distanceTo(_hd.set(human.x,human.y+1.45,human.z)),3,14);camMode='orbit'}
function rotCam(dx,dy){camYaw+=dx*.004;camPitch=clamp(camPitch-dy*.004,-1.25,.55)}
function toggleLock(){if(!human||state==='menu')return;
  if(camMode==='lock'){camMode='orbit';if(document.pointerLockElement)document.exitPointerLock()}
  else{if(camMode==='auto'){camYaw=human.side<0?0:Math.PI;camPitch=-.18;camDist=5.5}camMode='lock';try{const r=cvs.requestPointerLock();if(r&&r.catch)r.catch(()=>{})}catch(e){}}}
function resetCam(){if(document.pointerLockElement)document.exitPointerLock();camMode='auto'}
function updateAim(){aim.valid=false;
  if(camMode==='lock')_ndc.set(0,0);else{if(!mouse.in||isTouch)return;_ndc.set(mouse.x/innerWidth*2-1,-(mouse.y/innerHeight)*2+1)}
  ray.setFromCamera(_ndc,camera);
  if(ray.ray.intersectPlane(plane,_hit)){aim.x=_hit.x;aim.z=_hit.z;aim.valid=Math.abs(_hit.x)<HL+.5&&Math.abs(_hit.z)<HW+.5}}

// ---------- IA d'équipe ----------
const teamPlan={'-1':{},'1':{}};
function computePlan(s){
  const b=ball,team=teamOf(s),r={who:null,plan:'home',tx:0,tz:0,t:null,blocker:null,bz:0,attacker:null};
  if(state!=='play')return r;
  const land=predict(CHEST);
  const eligible=p=>!(team.length>1&&b.last===p&&b.touchTeam===s&&b.lastKind!=='block'&&b.lastKind!=='serve');
  if(land&&land.x*s>.05){
    const mine=b.touchTeam===s&&b.touches>=1&&b.touches<3;const cand=team.filter(eligible);if(!cand.length)return r;
    let best=null;
    if(mine&&(b.touches===2||team.length===1||b.setFor)){
      for(const p of cand){const sp=predict(HAND+jumpH(p)*.92);if(!sp||sp.ground)continue;const ax=sp.x*s;if(ax<.25||ax>HL-.3)continue;
        const tx=sp.x+s*.2,tz=sp.z,tt=Math.hypot(tx-p.x,tz-p.z)/speedOf(p);if(tt>sp.t+.15)continue;
        const sc=tt-(p===b.setFor?1:0);if(!best||sc<best.sc)best={p,sc,tx,tz}}}
    if(best){r.who=best.p;r.plan='attack';r.tx=best.tx;r.tz=best.tz}
    else{let nb=null,nd=1e9;for(const p of cand){const d=Math.hypot(land.x-p.x,land.z-p.z);if(d<nd){nd=d;nb=p}}
      r.who=nb;r.plan=(mine&&b.touches===1&&team.length>1)?'set':'recv';r.tx=land.x+s*.15;r.tz=land.z;r.t=land.t}
  }else if(b.x*s<0&&b.touchTeam===-s){
    for(const q of teamOf(-s))if(Math.abs(q.x)<3.2&&Math.hypot(b.x-q.x,b.z-q.z)<2.5&&(b.y>2||!q.onGround)){r.attacker=q;break}
    if(r.attacker){let bl=null,bd=1e9;for(const p of team){if(p.isHuman)continue;const d=Math.hypot(p.x-s*.45,p.z-r.attacker.z);if(d<bd){bd=d;bl=p}}if(bl&&bd<4.5){r.blocker=bl;r.bz=r.attacker.z}}
  }
  return r}
function moveTo(p,tx,tz){const dx=tx-p.x,dz=tz-p.z,d=Math.hypot(dx,dz);if(d<.12){p.ctl.mx=p.ctl.mz=0;return}const k=Math.min(1,d/.4);p.ctl.mx=dx/d*k;p.ctl.mz=dz/d*k}
function aiControl(p,dt){
  const c=p.ctl,ai=p.ai,b=ball,s=p.side,D=Dif();c.jumpQ=false;c.diveQ=false;
  if(state==='serve'){if(server===p){c.mx=c.mz=0;ai.serveT-=dt;if(ai.serveT<=0){if(aiHas(p,['ace'])&&Math.random()<.6)useAbility(p);c.hitBuf=.2}}else moveTo(p,p.home.x,p.home.z);return}
  if(state!=='play'){c.mx=c.mz=0;return}
  if(p.blind>0){p.blind-=dt;c.mx=c.mz=0;return}
  if(ai.roll!==b.hitId){ai.roll=b.hitId;ai.doSpike=Math.random()<D.spike;ai.doBlock=Math.random()<D.block;ai.ex=rnd(-1,1)*D.err/60;ai.ez=rnd(-1,1)*D.err/60}
  const plan=teamPlan[s];ai.think-=dt;
  if(ai.think<=0){ai.think=D.react;
    if(plan.who===p){ai.plan=plan.plan==='attack'&&!ai.doSpike?'recv':plan.plan;const k=ai.plan==='attack'?.3:.5;ai.tx=plan.tx+ai.ex*k;ai.tz=plan.tz+ai.ez*k;
      if(ai.plan==='recv'&&plan.t!=null&&plan.t<.5&&p.onGround&&Math.hypot(ai.tx-p.x,ai.tz-p.z)>speedOf(p)*plan.t+.6)c.diveQ=true}
    else if(plan.blocker===p&&ai.doBlock){ai.plan='block';ai.tx=s*.45;ai.tz=clamp(plan.bz,-HW,HW)}
    else{ai.plan='home';ai.tx=p.home.x;ai.tz=p.home.z}}
  moveTo(p,ai.tx,ai.tz);
  if(ai.plan==='attack'){
    if(p.onGround){const sp=predict(HAND+jumpH(p)*.92),tUp=jumpV(p)/GP;
      if(sp&&!sp.ground&&sp.t<=tUp+.03&&Math.hypot(p.x-(sp.x+s*.2),p.z-sp.z)<.8){c.jumpQ=true;
        if(p.cd<=0&&aiHas(p,['thunder','comet','ghost','cyclone','feint','superjump','meteor','banana','mirage','twins','rebirth'])&&Math.random()<.55)useAbility(p)}}
    else c.hitBuf=.1}
  if(ai.plan==='set'&&Math.hypot(b.x-p.x,b.z-p.z)<1.6)c.setBuf=.1;
  if(ai.plan==='block'&&p.onGround){const q=plan.attacker;if(q&&!q.onGround&&q.vy<2.5&&Math.abs(p.x-ai.tx)<.7){c.jumpQ=true;if(p.cd<=0&&aiHas(p,['wall','longarm']))useAbility(p)}}
  if(p.cd>0)return;
  if(ai.plan==='recv'&&aiHas(p,['sprint','magnet','guard','teleport','slowmo'])&&Math.hypot(ai.tx-p.x,ai.tz-p.z)>2)useAbility(p);
  else if(b.last===p&&b.lastKind==='spike'&&b.x*s<0&&aiHas(p,['freeze','quake']))useAbility(p);
  else if(b.touchTeam===s&&b.touches===1&&aiHas(p,['perfect'])&&Math.random()<.02)useAbility(p);
}

// ---------- Mise à jour ----------
function updatePlayer(p,dt){
  p.cd=Math.max(0,p.cd-dt);p.hitCd-=dt;p.spikeAnim-=dt;p.ctl.hitBuf-=dt;p.ctl.setBuf-=dt;
  for(const k in p.buffs)p.buffs[k]=Math.max(0,p.buffs[k]-dt);
  const c=p.ctl;
  if(p.isHuman){let mx=(held('up')?1:0)-(held('down')?1:0)-joy.y,mz=(held('right')?1:0)-(held('left')?1:0)+joy.x;const l=Math.hypot(mx,mz);if(l>1){mx/=l;mz/=l}
    if(camMode==='auto'){c.mx=mx*-p.side;c.mz=mz*-p.side}
    else{const cy=Math.cos(camYaw),sy=Math.sin(camYaw);c.mx=cy*mx-sy*mz;c.mz=sy*mx+cy*mz}}
  if(p.noJump>0){p.noJump-=dt;c.jumpQ=false}
  if(p.frozen>0){p.frozen-=dt;p.vx=p.vz=0}
  else if(p.dive>0){p.dive-=dt;const k=Math.pow(.96,dt*60);p.vx*=k;p.vz*=k;if(p.dive<=0)p.recover=.28}
  else if(p.recover>0){p.recover-=dt;p.vx=p.vz=0}
  else{const sp=speedOf(p);if(p.onGround){p.vx=c.mx*sp;p.vz=c.mz*sp} // en l'air : pas de contrôle, on garde l'élan du saut
    if(c.jumpQ&&p.onGround){p.vy=jumpV(p);p.onGround=false;upBurst(p.x,.05,p.z,8,['#f2d0a0'],.5,1.8,1.3,{g:8,life:.4,add:false,size:.07})}
    const ml=Math.hypot(c.mx,c.mz);
    if(c.diveQ&&p.onGround&&ml>.3&&state==='play'){p.dive=.36;const v=Math.max(9,sp*1.7);p.vx=c.mx/ml*v;p.vz=c.mz/ml*v;upBurst(p.x,.05,p.z,12,['#f2d0a0'],.8,2.5,1,{g:8,life:.5,add:false,size:.08})}}
  c.jumpQ=false;c.diveQ=false;
  if(state==='serve'&&server===p){p.x=p.side*(HL+.6);p.vx=0;if(!p.isHuman)p.vz=0}
  p.vy-=GP*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
  if(p.y<=0){if(!p.onGround)upBurst(p.x,.05,p.z,5,['#f2d0a0'],.4,1.4,1.4,{g:8,life:.3,add:false,size:.06});p.y=0;p.vy=0;p.onGround=true}
  if(!pull){const lo=p.side<0?-(HL+3.5):.35,hi=p.side<0?-.35:HL+3.5;p.x=clamp(p.x,lo,hi);p.z=clamp(p.z,-HW-2.5,HW+2.5)}
  const sp2=Math.hypot(p.vx,p.vz);if(p.onGround&&sp2>.5)p.run+=dt*sp2*1.6;
  // orientation : vers la balle
  const tx=(ball&&state!=='menu')?ball.x-p.x:-p.side,tz=(ball&&state!=='menu')?ball.z-p.z:0;const ty=p.isHuman&&camMode==='lock'?-camYaw:Math.atan2(-tz,tx);
  let d=ty-p.yaw;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;p.yaw+=d*Math.min(1,dt*10);
  if(state==='serve'&&server===p&&c.hitBuf>0&&p.hitCd<=0){c.hitBuf=0;serve(p)}
}
function tryHits(p){
  if(state!=='play'||p.hitCd>0||p.frozen>0)return;
  const b=ball,c=p.ctl;
  if(b.x*p.side<-.5)return;
  if(players.length>2&&b.last===p&&b.touchTeam===p.side&&b.lastKind!=='block'&&b.lastKind!=='serve')return;
  const la=hasB(p,'longarm'),f=-p.side;
  const hx=p.x+f*.2,hy=p.y+HAND+(la?.5:0),hz=p.z,dHand=Math.hypot(b.x-hx,b.y-hy,b.z-hz);
  // contre
  const bR=(hasB(p,'wall')?1.4:.6)*(isRole(p,'con')?1.3:1)+(la?.3:0)+HITBOX*.6;
  if(!p.onGround&&Math.abs(p.x)<1.3&&b.touchTeam===-p.side&&b.vx*p.side>0&&Math.abs(b.x)<1.2&&Math.abs(b.z-hz)<bR&&Math.abs(b.y-hy)<bR*.9+BR&&Math.abs(b.x-hx)<.8+HITBOX*.5){block(p);return}
  if(!p.onGround&&c.hitBuf>0&&dHand<(la?1.05:.85)+HITBOX){c.hitBuf=0;spike(p);return}
  if(!p.onGround&&c.setBuf>0&&dHand<(la?1.15:.95)+HITBOX){c.setBuf=0;setBall(p);return} // set en suspension
  const dv=p.dive>0,cx=p.x+(dv?p.vx*.03:0),cz=p.z+(dv?p.vz*.03:0),cy=p.y+(dv?.36:CHEST);
  const grab=c.hitBuf>0&&p.onGround; // clic gauche au sol : réception volontaire, plus loin
  const recR=(dv?.95:.8)+(isRole(p,'lib')?.2:0)+(hasB(p,'guard')?.8:0)+(grab?.5:0)+HITBOX;
  if(Math.hypot(b.x-cx,b.y-cy,b.z-cz)<recR+BR&&(b.vy<2||dv||grab)){if(c.setBuf>0&&p.onGround&&!dv){c.setBuf=0;setBall(p)}else{c.hitBuf=0;bump(p)}}
}
function updateBall(dt){
  const b=ball;b.t+=dt;
  if(state==='serve'){const s=server;b.x=s.x-s.side*.35;b.y=s.y+2*CH+.15+Math.sin(gameTime*4)*.06;b.z=s.z;b.vx=b.vy=b.vz=0;return}
  if(state!=='play'){if(b.y>BR||b.vy>0){b.vy-=G*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt}if(b.y<=BR){b.y=BR;b.vy=Math.abs(b.vy)>.8?-b.vy*.45:0;b.vx*=.97;b.vz*=.97;b.x+=b.vx*dt;b.z+=b.vz*dt}return}
  updateDecoys(dt);
  const sub=4;
  for(let i=0;i<sub;i++){
    let h=dt/sub;
    for(const p of players)if(hasB(p,'slowmo')&&b.x*p.side>0){h*=.5;break}
    let g=b.g;if(b.fx==='comet'&&b.x*b.fxSide>0)g=G*4;
    if(b.fx==='banana'&&b.x*b.fxSide>0)b.vx-=b.fxSide*44*h;
    for(const p of players)if(hasB(p,'magnet')&&b.x*p.side>-.3&&b.touchTeam!==p.side){const dx=p.x-b.x,dz=p.z-b.z,d=Math.hypot(dx,dz)||1;b.vx+=dx/d*12*h;b.vz+=dz/d*12*h}
    b.vy-=g*h;
    if(b.fx==='cyclone')b.vz+=Math.cos(b.t*20)*170*h;
    const px=b.x;b.x+=b.vx*h;b.y+=b.vy*h;b.z+=b.vz*h;
    if(Math.abs(b.z)<HW+.7){
      if(b.y<NH&&(Math.abs(b.x)<BR||px*b.x<0)){const sd=Math.sign(px)||-Math.sign(b.vx)||1;b.x=sd*(BR+.02);b.vx=-b.vx*.25+sd*.4;b.fx=null;SFX.net();upBurst(b.x,b.y,b.z,6,['#fff'],.5,1.5,1.5,{g:4,life:.3,size:.06})}
      else{const dn=Math.hypot(b.x,b.y-NH);if(dn<BR){const nx=b.x/dn,ny=(b.y-NH)/dn,vn=b.vx*nx+b.vy*ny;
        if(vn<0){b.vx-=1.5*vn*nx;b.vy-=1.5*vn*ny;b.vx*=.75;b.vy*=.75;b.vz*=.85;if(Math.abs(b.vx)<.8)b.vx=(Math.random()<.5?-1:1)*rnd(.8,1.6);SFX.net()}
        b.x=nx*(BR+.01);b.y=NH+ny*(BR+.01)}}}
    if(b.y<=BR){b.y=BR;landed();return}
    if(Math.abs(b.x)>HL+16||Math.abs(b.z)>HW+16){pointTo(-(b.touchTeam||1),'DEHORS !',true);return}
  }
  emitTrail();
}
function updateDecoys(dt){for(const d of decoys){d.vy-=G*.5*dt;d.x+=d.vx*dt;d.y+=d.vy*dt;d.z+=d.vz*dt;if(d.y<=BR){d.dead=true;upBurst(d.x,BR,d.z,14,['#c0a8ff','#fff'],1,3,1.2,{g:4,life:.4})}}decoys=decoys.filter(d=>!d.dead)}
function emitTrail(){
  const b=ball,sp=Math.hypot(b.vx,b.vy,b.vz);if(b.fx==='ghost'&&b.x*b.fxSide>0)return;
  const e=o=>part(Object.assign({x:b.x+rnd(-.1,.1),y:b.y+rnd(-.1,.1),z:b.z+rnd(-.1,.1),vx:rnd(-.3,.3),vy:rnd(-.3,.3),vz:rnd(-.3,.3),life:.45,size:rnd(.08,.14)},o));
  if(sp>9)e({col:'#ffffff',size:.12,life:.18,vx:0,vy:0,vz:0});
  switch(b.skin){
    case 'fire':for(let i=0;i<2;i++)e({col:pick(['#ffb020','#ff5a1f','#fff6a8']),vy:rnd(.5,1.5),size:rnd(.12,.24),life:rnd(.3,.55)});break;
    case 'ice':if(Math.random()<.6)e({col:'#fff',shape:2,size:rnd(.1,.18),g:1,life:.8});break;
    case 'galaxy':e({col:pick(['#b066ff','#ff7cf5','#fff','#6b3dff']),shape:2,size:rnd(.08,.16),life:.9,vx:0,vy:0,vz:0});break;
    case 'gold':if(Math.random()<.7)e({col:pick(['#ffd23d','#fff3b0']),shape:2,size:rnd(.08,.16),life:.6});break;
    case 'rainbow':_c.setHSL(gameTime*1.1%1,1,.6);e({col:'#'+_c.getHexString(),size:rnd(.14,.24),vx:0,vy:0,vz:0,life:.5});break;
    case 'neon':e({col:pick(['#22f0ff','#ff3df0']),size:.12,vx:0,vy:0,vz:0,life:.3});break;
    case 'melon':if(sp>12&&Math.random()<.3)e({col:'#ff4d6d',size:.07,g:10,life:.6,add:false});break;
  }
  if(b.fx==='thunder'){e({col:pick(['#ffd23d','#fff6a8']),size:rnd(.14,.26),life:.4});if(Math.random()<.15)bolt(b.x,b.y,b.z,b.x+rnd(-.8,.8),b.y+rnd(-.8,.8),b.z+rnd(-.8,.8),'#fff6a8',.12)}
  if(b.fx==='comet')for(let i=0;i<3;i++)e({col:pick(['#b066ff','#ff7cf5','#fff']),size:rnd(.14,.3),life:.5});
  if(b.fx==='cyclone')e({col:pick(['#ff3d6e','#fff']),size:rnd(.1,.18),vx:rnd(-2,2),vy:rnd(-2,2),vz:rnd(-2,2),life:.4});
  if(b.fx==='feint')e({col:'#9fd3ff',size:.08,life:.4});
  if(b.fx==='meteor')for(let i=0;i<4;i++)e({col:pick(['#ff7a1f','#ffd23d','#ff3d1f','#fff6a8']),size:rnd(.2,.4),vy:rnd(.5,2),life:.55});
  if(b.fx==='banana')e({col:pick(['#5be37a','#fff']),size:.1,life:.4});
}
function landed(){const b=ball,side=Math.sign(b.x)||1;
  if(Math.abs(b.x)>HL+.05||Math.abs(b.z)>HW+.05)pointTo(-(b.touchTeam||side),'DEHORS !',true);else pointTo(-side)}
function pointTo(team,reason,isOut){
  if(state!=='play')return;
  state='point';stateT=2.1;lastWinner=team;const b=ball;
  score[team<0?0:1]++;
  const scorers=teamOf(team),sc=b.last&&b.last.side===team?b.last:scorers[0];
  explode(team<0?save.eq.explo:oppExplo,clamp(b.x,-HL-3,HL+3),clamp(b.z,-HW-3,HW+3),sc.style.col);
  if(b.fx==='meteor'&&!isOut){EXF.classic(b.x,b.z,'#ff7a1f');for(const q of teamOf(-team))q.noJump=1}
  const won=b.last&&b.last.side===team&&!reason;
  const kind=won?{serve:'ACE !',spike:'SMASH GAGNANT !',block:'CONTRE GAGNANT !'}[b.lastKind]:null;
  banner(reason||kind||(team<0?'POINT POUR TON ÉQUIPE !':"POINT POUR L'IA"),team<0?'#5b9bff':'#ff5d6e');
  if(team<0){matchCoins+=15;save.coins+=15;
    if(won&&b.last===human){if(b.lastKind==='serve')save.st.aces++;if(b.lastKind==='spike')save.st.spikes++;if(b.lastKind==='block')save.st.blocks++}
    persist();ftext3(human.x,human.y+3.2,human.z,'+15 🪙','#ffd23d',28,1.4);setTimeout(()=>SFX.coin(),250)}
  for(const p of scorers)if(p.style.r==='V'&&p.lvl<5){p.lvl++;later(.6,()=>{refreshLabel(p);ftext3(p.x,p.y+3,p.z,`ÉVOLUTION niv.${p.lvl} !`,p.style.col,32,1.6);ring(p.x,.05,p.z,p.style.col,.3,6,.8);upBurst(p.x,.2,p.z,60,[p.style.col,'#fff','#ffd23d'],2,6,.8,{g:-2,life:1});SFX.power()})}
  b.fx=null;decoys=[];
  const [a,c]=score;if((a>=cfg.target||c>=cfg.target)&&Math.abs(a-c)>=2)later(1.6,()=>endMatch(a>c));
}
function endMatch(win){
  state='over';let extra='';
  if(win){save.wins++;save.coins+=120;matchCoins+=120;SFX.win();explode('firework',0,0,'#ffd23d');
    if(cfg.diff==='legend')save.st.legendWins++;
    if(human.style.r==='U'){const b0=masteryLvl(human.style.id);save.mastery[human.style.id]=(save.mastery[human.style.id]||0)+1;const b1=masteryLvl(human.style.id);if(b1>b0)extra+=` · ${human.style.n} passe niv. ${b1} !`}}
  else{save.losses++;save.coins+=40;matchCoins+=40;SFX.lose()}
  const rk=cfg.ranked?applyRanked(win):null;
  const nt=checkTitles();if(nt.length)extra+=' · Titre débloqué : '+nt.map(t=>t.n).join(', ');
  persist();
  $('rankRes').innerHTML=rk?rankResultHTML(rk):'';$('bAgain').textContent=cfg.ranked?'Match classé suivant':'Rejouer';
  document.getElementById('overT').textContent=win?'VICTOIRE !':'DÉFAITE';
  document.getElementById('overT').style.filter=win?'':'grayscale(.6)';
  document.getElementById('overS').textContent=`${score[0]} – ${score[1]}  ·  +${matchCoins} 🪙 gagnées${extra}`;
  setTimeout(()=>show('over'),900);
}
function releasePull(x,z){if(!players.length)return;for(const p of players){let dx=p.x-x,dz=p.z-z,d=Math.hypot(dx,dz);if(d<.3){const a=rnd(0,TAU);dx=Math.cos(a);dz=Math.sin(a);d=1}p.vx=dx/d*rnd(6,9);p.vz=dz/d*rnd(6,9);p.vy=rnd(7,10);p.onGround=false;p.dive=.6}}
function applyPull(dt){for(const p of players){
  if(!pull){if(p.spin){p.spin+=dt*12;if(p.onGround)p.spin=0}continue}
  const dx=pull.x-p.x,dy=pull.y-1-p.y,dz=pull.z-p.z,d=Math.hypot(dx,dy,dz)||1,k=1-pull.t/1.35,sp=Math.min(d,(3+9*k)*dt);
  p.x+=dx/d*sp;p.y+=dy/d*sp;p.z+=dz/d*sp;p.vx=p.vy=p.vz=0;p.onGround=false;p.dive=0;p.spin=(p.spin||0)+dt*(6+14*k);
  if(Math.random()<.5)part({x:p.x+rnd(-.3,.3),y:p.y+rnd(0,1.6),z:p.z+rnd(-.3,.3),vx:dx/d*3,vy:dy/d*3,vz:dz/d*3,col:'#b066ff',size:.1,life:.4})}
  if(pull)pull.t-=dt}
function startRally(team){
  state='serve';
  if(team!==servingSide)serveIdx[team]=(serveIdx[team]+1)%teamOf(team).length;
  servingSide=team;const t=teamOf(team);server=t[serveIdx[team]%t.length];
  for(const p of players){p.x=p.home.x;p.z=p.home.z;p.y=0;p.vx=p.vy=p.vz=0;p.onGround=true;p.dive=p.recover=p.frozen=p.noJump=p.blind=0;p.spin=0;p.ctl.hitBuf=0;p.hitCd=.4;p.ai.serveT=rnd(.8,1.3);p.ai.plan='home'}
  server.x=team*(HL+.6);server.z=server.isHuman?0:rnd(-1.5,1.5);
  Object.assign(ball,{fx:null,g:G,touchTeam:team,touches:0,boost:1,boostSide:0,setFor:null,vx:0,vy:0,vz:0,last:null});
  decoys=[];SFX.whistle();
}
function startMatch(){
  clearPlayers();hideAll();
  const n=cfg.team;
  human=makePlayer(-1,save.eq.style,true,0,n);human.title=save.eq.title;players.push(human);
  for(let i=1;i<n;i++){const p=makePlayer(-1,pick(save.styles),false,i,n);p.title=pick(TITLES).id;players.push(p)}
  for(let i=0;i<n;i++){const st=pickOppStyle();const p=makePlayer(1,st.id,false,i,n);p.title=pick(TITLES).id;players.push(p)}
  players.forEach(refreshLabel);
  oppExplo=pick(EXPLOS).id;ball=newBall();ballMesh.material=ballMaterial(ball.skin);
  score=[0,0];matchCoins=0;events=[];pull=null;demoAv&&(demoAv.root.visible=false,demoAv.shadow.visible=false);
  PADD.list.length=PNORM.list.length=0;
  servingSide=Math.random()<.5?-1:1;serveIdx={'-1':0,'1':0};startRally(servingSide);
  document.getElementById('hud').classList.add('on');document.getElementById('touch').classList.toggle('on',isTouch);
  document.getElementById('target').textContent=(cfg.ranked?`🏆 CLASSÉ · ${rankOf(save.ranked.rp).name} · `:'')+`Premier à ${cfg.target} · ${cfg.team} contre ${cfg.team} · ${Dif().n}`;
  const st=human.style;document.getElementById('themN').textContent=`IA · ${teamOf(1).map(p=>p.style.n).join(', ')}`;
  document.getElementById('themA').textContent=teamOf(1).map(p=>RAR[p.style.r].n).join(' · ');
  if(st)document.getElementById('meN').style.color=RAR[st.r].c;
}


// ================== MODE CLASSÉ ==================
// Bronze → Diamant : 3 divisions de 100 PC chacune ; Maître (1500-1800) ; Légende (1800+).
const RANKS=[{n:'Bronze',c:'#d08a52',ic:'🛡️'},{n:'Argent',c:'#cfd8e3',ic:'⚔️'},{n:'Or',c:'#ffd23d',ic:'👑'},{n:'Platine',c:'#5fe0d0',ic:'💠'},{n:'Diamant',c:'#7fb8ff',ic:'💎'},{n:'Maître',c:'#c07cff',ic:'🔮'},{n:'Légende',c:'#ff4f7a',ic:'🔥'}];
save.ranked=Object.assign({rp:0,w:0,l:0,streak:0,best:0},save.ranked||{});
let rankedPrev=null;
function rankOf(rp){
  if(rp>=1800)return{t:6,div:0,idx:16,name:'Légende',into:rp-1800,need:0};
  if(rp>=1500)return{t:5,div:0,idx:15,name:'Maître',into:rp-1500,need:300};
  const t=Math.floor(rp/300),d=Math.floor(rp%300/100);
  return{t,div:3-d,idx:t*3+d,name:RANKS[t].n+' '+['III','II','I'][d],into:rp%100,need:100}}
function badge(r,size){return `<div class="badge" style="--bc:${RANKS[r.t].c};width:${size}px;height:${size*1.12|0}px;font-size:${size*.4|0}px">${RANKS[r.t].ic}${r.div?`<span style="font-size:${size*.2|0}px">${['','I','II','III'][r.div]}</span>`:''}</div>`}
function rankedDiff(rp){
  const L=[DIFF.easy,DIFF.normal,DIFF.hard,DIFF.legend],t=clamp(rp/1800,0,1)*3,i=Math.min(2,Math.floor(t)),f=t-i,o={n:'Classé'};
  for(const k of['spd','react','err','spike','block','pow'])o[k]=L[i][k]+(L[i+1][k]-L[i][k])*f;
  if(rp>1800){const x=Math.min(1,(rp-1800)/1200);o.spd+=.08*x;o.react=Math.max(.02,o.react-.03*x);o.pow+=.08*x}
  return o}
function pickOppStyle(){
  if(!cfg.ranked)return pick(STYLES.filter(s=>s.r!=='C'||Math.random()<.4));
  const pools=[['C','R'],['C','R','L'],['R','L','D'],['L','D','S'],['D','S','U'],['S','U','V'],['S','U','V']];
  return pick(STYLES.filter(s=>pools[rankOf(save.ranked.rp).t].includes(s.r)))}
function startRanked(){
  audioInit();if(!cfg.ranked)rankedPrev={diff:cfg.diff,target:cfg.target};
  cfg.ranked=true;DIFF.ranked=rankedDiff(save.ranked.rp);cfg.diff='ranked';cfg.target=11;startMatch()}
function exitRanked(){if(!cfg.ranked)return;cfg.ranked=false;if(rankedPrev){cfg.diff=rankedPrev.diff;cfg.target=rankedPrev.target}rankedPrev=null}
function applyRanked(win,abandon){
  const R=save.ranked,before=R.rp,rb=rankOf(before);let d;
  if(win){R.w++;R.streak=Math.max(0,R.streak)+1;d=25+Math.min(R.streak-1,5)*3+(score[0]-score[1]>=6?5:0)}
  else{R.l++;R.streak=Math.min(0,R.streak)-1;d=-(14+rb.t*2)-(abandon?10:0)}
  R.rp=Math.max(0,R.rp+d);R.best=Math.max(R.best,R.rp);
  const ra=rankOf(R.rp),promo=ra.idx>rb.idx,demo=ra.idx<rb.idx;let bonus=0;
  if(promo){bonus=150+ra.t*100;save.coins+=bonus;matchCoins+=bonus}
  persist();return{before,after:R.rp,d,promo,demo,bonus,rb,ra}}
function rankResultHTML(k){
  const r=k.ra,pct=r.need?r.into/r.need*100:100,pct0=k.promo||k.demo||!r.need?0:k.rb.into/k.rb.need*100;
  const msg=k.promo?`<div class="rkMsg" style="color:${RANKS[r.t].c}">PROMOTION ! ${r.name} · +${k.bonus} 🪙</div>`:k.demo?`<div class="rkMsg" style="color:#ff8080">Rétrogradé en ${r.name}</div>`:'';
  setTimeout(()=>{const b=document.getElementById('rkResBar');if(b)b.style.width=pct+'%'},1300);
  if(k.promo)setTimeout(()=>{explode(r.t>=5?'blackhole':'rainbow',0,0,RANKS[r.t].c);SFX.win()},1400);
  return `<div class="rkRes">${badge(r,74)}<div style="flex:1"><div style="font-weight:900;font-size:22px;color:${RANKS[r.t].c}">${r.name}</div>
    <div class="rkBarW"><div id="rkResBar" class="rkBar" style="width:${pct0}%;background:${RANKS[r.t].c}"></div></div>
    <div style="font-weight:800;font-size:15px">${k.d>=0?'+':''}${k.d} PC ${r.need?`· ${r.into}/${r.need}`:`· ${k.after} PC`}${save.ranked.streak>1?` · série 🔥${save.ranked.streak}`:''}</div></div></div>${msg}`}
function renderRankBox(){const R=save.ranked,r=rankOf(R.rp);
  $('rankBox').innerHTML=`${badge(r,40)}<div><div style="font-weight:900;color:${RANKS[r.t].c}">${r.name}</div><div class="rkBarW sm"><div class="rkBar" style="width:${r.need?r.into/r.need*100:100}%;background:${RANKS[r.t].c}"></div></div><div style="font-size:12px;opacity:.8">${r.need?`${r.into}/${r.need} PC`:`${R.rp} PC`}</div></div>`}
function renderRanked(){
  const R=save.ranked,r=rankOf(R.rp);
  $('rkTop').innerHTML=`${badge(r,120)}<div><div style="font-size:40px;font-weight:900;font-style:italic;color:${RANKS[r.t].c}">${r.name}</div>
    <div class="rkBarW" style="width:360px"><div class="rkBar" style="width:${r.need?r.into/r.need*100:100}%;background:${RANKS[r.t].c}"></div></div>
    <div style="font-weight:800">${r.need?`${r.into} / ${r.need} PC`:`${R.rp} PC`} · ${R.w} V / ${R.l} D · série ${R.streak>0?'🔥 '+R.streak:R.streak<0?'❄️ '+(-R.streak):'—'} · meilleur rang : ${rankOf(R.best).name}</div>
    <div style="opacity:.8;font-size:14px;margin-top:4px">Adversaires : ${(()=>{const o=rankedDiff(R.rp);return o.spike>.97&&o.react<.08?'redoutables':o.react<.15?'forts':o.react<.25?'solides':'débutants'})()} · victoire ≈ +25 PC (+ bonus de série) · défaite ≈ −${14+r.t*2} PC</div></div>`;
  $('rkLadder').innerHTML=RANKS.map((k,t)=>{const from=t<5?t*300:t===5?1500:1800,cur=r.t===t;
    return `<div class="rkStep${cur?' cur':''}" style="--bc:${k.c}">${badge({t,div:0},44)}<div><b style="color:${k.c}">${k.n}</b><div style="font-size:12px;opacity:.8">${from}+ PC${t<5?' · 3 divisions':''}</div></div></div>`}).join('');
  chips('cTeamR',[[1,'1 vs 1'],[2,'2 vs 2'],[3,'3 vs 3']],'team')}

// ---------- Rendu des joueurs / balle / caméra ----------
function syncPlayer(p,dt){
  const a=p.av;a.root.position.set(p.x,p.y,p.z);a.root.rotation.y=p.yaw;
  const air=!p.onGround,run=p.onGround&&Math.hypot(p.vx,p.vz)>.5?Math.sin(p.run):0;
  a.legs[0].rotation.z=air?.5:run*.7;a.legs[1].rotation.z=air?-.25:-run*.7;
  const near=ball&&Math.hypot(ball.x-p.x,ball.z-p.z)<2.2&&ball.y<2.2&&p.onGround;
  let r0,r1;
  if(p.dive>0){r0=r1=1.7}
  else if(p.spikeAnim>0){const k=p.spikeAnim/.25;r0=.6+2.4*k;r1=2.6}
  else if(air){r0=r1=2.9}
  else if(near){r0=r1=1.15}
  else{r0=.25+run*.5;r1=.25-run*.5}
  a.arms[0].rotation.z+=(r0-a.arms[0].rotation.z)*Math.min(1,dt*20);a.arms[1].rotation.z+=(r1-a.arms[1].rotation.z)*Math.min(1,dt*20);
  const ls=hasB(p,'longarm')?1.7:1;a.arms[0].scale.y=a.arms[1].scale.y=ls;
  const dv=p.dive>0;a.body.rotation.z+=((dv?-1.3:0)-a.body.rotation.z)*Math.min(1,dt*15);a.body.position.y=dv?.3:0;
  a.body.rotation.x=p.spin||0;if(!dv&&p.onGround)a.body.position.y=Math.sin(gameTime*3+p.idx)*.012;a.head.rotation.z=air?.15:0;
  const sc=pull&&p.spin?Math.max(.35,Math.min(1,Math.hypot(pull.x-p.x,pull.y-1-p.y,pull.z-p.z)/3)):1;a.body.scale.setScalar(sc);
  const on=p.charged.length||Object.values(p.buffs).some(v=>v>0)||p.lvl>1;
  a.aura.material.opacity=on?.35+.2*Math.sin(gameTime*10)+(p.lvl-1)*.05:0;
  if(on&&Math.random()<.3)part({x:p.x+rnd(-.4,.4),y:p.y+rnd(0,1.9),z:p.z+rnd(-.4,.4),vy:rnd(1,2.5),col:p.style.col,size:rnd(.06,.12),life:.6});
  a.wall.visible=hasB(p,'wall');a.wall.rotation.y=0;a.guard.visible=hasB(p,'guard');a.ice.visible=p.frozen>0;a.quake.visible=p.noJump>0;
  a.shadow.position.set(p.x,.015,p.z);const k=clamp(1-p.y/4,.3,1);a.shadow.scale.set(k,k,1);
  _v.set(p.x,p.y+2.35*CH+.1,p.z).project(camera);const L=p.label;
  if(_v.z>1){L.style.display='none'}else{L.style.display='';L.style.left=((_v.x+1)/2*innerWidth)+'px';L.style.top=((1-_v.y)/2*innerHeight)+'px'}
}
const _axis=new THREE.Vector3();let camShake=new THREE.Vector3(),camT=new THREE.Vector3(-14,6,0),camL=new THREE.Vector3(0,1,0);
function syncBall(dt){
  const b=ball;ballMesh.position.set(b.x,b.y,b.z);
  const sp=Math.hypot(b.vx,b.vz);if(sp>.05){_axis.set(b.vz,0,-b.vx).normalize();ballMesh.rotateOnWorldAxis(_axis,sp*dt/BR*.8)}
  if(b.skin==='rainbow')ballMesh.material.map.offset.x=(gameTime*.3)%1;
  const ghost=b.fx==='ghost'&&b.x*b.fxSide>0;ballMesh.material.transparent=ghost;ballMesh.material.opacity=ghost?.05+Math.random()*.06:1;
  const gc={thunder:'#ffd23d',meteor:'#ff7a1f',comet:'#b066ff',cyclone:'#ff3d6e',banana:'#5be37a'}[b.fx]||({neon:'#22f0ff',gold:'#ffd23d',fire:'#ff7a1f',galaxy:'#b066ff'}[b.skin]);
  ballGlow.position.copy(ballMesh.position);ballGlow.material.color.set(gc||'#fff');ballGlow.material.opacity=ghost?0:gc?(b.fx?.9:.45):0;ballGlow.scale.setScalar(b.fx?2:1.2);
  ballShadow.position.set(b.x,.012,b.z);const k=clamp(1-b.y/8,.35,1);ballShadow.scale.set(k*.9,k*.9,1);ballShadow.material.opacity=ghost?0:1;
  // repère d'atterrissage
  if(state==='play'&&!ghost){const pr=predict(BR);if(pr){landMark.visible=true;landMark.position.x=pr.x;landMark.position.z=pr.z;const s=1+Math.sin(gameTime*10)*.08;landMark.scale.set(s,s,1);landMark.material.color.set(pr.x*-1>0?'#ffffff':'#ff9a9a')}else landMark.visible=false}else landMark.visible=false;
  // fausses balles
  decoyMeshes.forEach(m=>m.visible=false);decoys.forEach((d,i)=>{const m=decoyMesh(i,b.skin);m.visible=true;m.position.set(d.x,d.y,d.z)});
}
function updateCamera(dt){
  if(human&&state!=='menu'&&camMode!=='auto'){const h=human,cp=Math.cos(camPitch);_f.set(Math.cos(camYaw)*cp,Math.sin(camPitch),Math.sin(camYaw)*cp);_r.set(-Math.sin(camYaw),0,Math.cos(camYaw));
    const sh=camMode==='lock'?.75:0;_hd.set(h.x,h.y+1.45,h.z).addScaledVector(_r,sh);
    camera.position.copy(_hd).addScaledVector(_f,-camDist);if(camera.position.y<.3)camera.position.y=.3;
    camL.copy(_hd).addScaledVector(_f,12);camera.userData.look=camL.clone();
    camShake.set(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(shake);camera.position.add(camShake);camera.lookAt(camL);camera.position.sub(camShake);return}
  if(human&&state!=='menu'){const h=human;camT.set(Math.max(h.x-8.5,-HL-10),5.4+Math.max(0,h.y*.3),h.z*.55);camL.set(h.x+6,1.1,h.z*.3)}
  else{const a=gameTime*.12;camT.set(Math.cos(a)*15-2,6.5,Math.sin(a)*13);camL.set(0,1.2,0)}
  const k=Math.min(1,dt*4);camera.position.lerp(camT,k);
  camShake.set(rnd(-1,1),rnd(-1,1),rnd(-1,1)).multiplyScalar(shake);camera.position.add(camShake);
  camera.userData.look=camera.userData.look||camL.clone();camera.userData.look.lerp(camL,k);camera.lookAt(camera.userData.look);
  camera.position.sub(camShake);
}

// ---------- HUD ----------
const $=id=>document.getElementById(id);
function updateHUD(){
  if(!human)return;
  $('s0').textContent=score[0];$('s1').textContent=score[1];
  for(const [i,s] of [[0,-1],[1,1]]){const el=$('d'+i);const n=state==='play'&&ball.touchTeam===s?ball.touches:0;el.innerHTML='<i class="'+(n>0?'on':'')+'"></i><i class="'+(n>1?'on':'')+'"></i><i class="'+(n>2?'on':'')+'"></i>'}
  const p=human,st=p.style,abl=abs_(p),abN=abl.length?AB[abl[0]].n:'';
  const k=abl.length?1-p.cd/abCd(p):0;$('abRing').style.background=abl.length?`conic-gradient(${st.col} ${k*360}deg,#ffffff22 0)`:'#ffffff18';$('abRing').style.color=k>=1?'#000':'#fff';
  $('meN').textContent=ROLES[st.role].ic+' '+st.n+(p.lvl>1?' niv.'+p.lvl:'');
  const bn=Object.keys(p.buffs).filter(k=>p.buffs[k]>0);
  $('meA').textContent=!abl.length?ROLES[st.role].n+' · pas de pouvoir':p.charged.length?'⚡ '+p.charged.map(a=>AB[a].n).join(' + ')+' chargé':bn.length?bn.map(a=>AB[a].n).join(' + ')+' actif':p.cd>0?`${abN} · ${p.cd.toFixed(1)} s`:`${abN} · PRÊT (E)`;
  $('hint').textContent=state==='serve'&&server===human?(isTouch?'FRAPPE pour servir':camMode==='lock'?'Vise avec le viseur · clic gauche pour servir':'Vise avec la souris · clic gauche pour servir'):'';
  $('cross').style.display=camMode==='lock'?'block':'none';
  $('camInfo').textContent=camMode==='lock'?'🔒 Caméra verrouillée — Shift pour la libérer':camMode==='orbit'?'🎥 Caméra libre — C pour revenir en auto':'';
  if(bannerT>0){bannerT-=1/60;if(bannerT<=0)bannerEl.style.opacity=0}
  const striking=(state==='serve'&&server===human)||(state==='play'&&(!human.onGround||camMode==='lock'||Math.hypot(ball.x-human.x,ball.z-human.z)<3));
  const tp=striking?aimFor(human,true):null;if(tp&&state==='serve')tp.x=-human.side*clamp(Math.abs(tp.x),2.5,HL-.5);
  aimMark.visible=!!(tp&&(tp.tilt||tp.side||aim.valid&&aim.x>.3));
  if(aimMark.visible){aimMark.position.x=tp.x;aimMark.position.z=tp.z;aimMark.material.color.set(tp.tilt>0?'#3dffb4':tp.tilt<0?'#ff9a3d':tp.side?'#7fb8ff':'#ffd23d')}
  if(striking&&tp&&(tp.tilt||tp.side)&&state==='play'&&!human.onGround){const L=camMode==='auto'?tp.side*-human.side:0,sd=tp.side?(camMode==='auto'?(L>0?' · à droite':' · à gauche'):' · sur le côté'):'';$('hint').textContent='Inclinaison : '+(tp.tilt>0?'⬆ près du filet':tp.tilt<0?'⬇ fond du terrain':'↔ distance normale')+sd}
}

// ---------- Démo du menu ----------
let demoAv=null;const demo={x:0,y:3,z:0,vx:2.5,vy:0,vz:1.5};
function refreshDemoAvatar(){if(demoAv)disposeAvatar(demoAv);demoAv=makeAvatar(S(save.eq.style),'#2f7cff','7');demoAv.root.position.set(-2.5,0,0);demoAv.shadow.position.set(-2.5,.015,0)}
function updateDemo(dt){demo.vy-=G*dt;demo.x+=demo.vx*dt;demo.y+=demo.vy*dt;demo.z+=demo.vz*dt;
  if(demo.y<BR){demo.y=BR;demo.vy=rnd(8,10)}if(Math.abs(demo.x)>HL-1){demo.vx*=-1;demo.x=clamp(demo.x,-HL+1,HL-1)}if(Math.abs(demo.z)>HW-1){demo.vz*=-1;demo.z=clamp(demo.z,-HW+1,HW-1)}
  ballMesh.position.set(demo.x,demo.y,demo.z);ballMesh.rotation.x+=dt*3;ballMesh.rotation.z+=dt*2;ballShadow.position.set(demo.x,.012,demo.z);ballGlow.material.opacity=0;landMark.visible=false;aimMark.visible=false;
  if(demoAv){demoAv.root.visible=demoAv.shadow.visible=true;demoAv.root.rotation.y=Math.sin(gameTime*.7)*.6;demoAv.arms[0].rotation.z=.4+Math.sin(gameTime*3)*.2;demoAv.arms[1].rotation.z=2.6+Math.sin(gameTime*4)*.3}}

// ---------- Boucle ----------
let last=performance.now(),acc=0;const STEP=1/120;
function tick(dt){
  gameTime+=dt;crowdHype=Math.max(0,crowdHype-dt);shake=Math.max(0,shake-dt*.8);runEvents();
  if(state==='menu'||!human){updateDemo(dt)}
  else if(state!=='over'||true){
    if(state==='play'){teamPlan['-1']=computePlan(-1);teamPlan['1']=computePlan(1)}
    for(const p of players)if(!p.isHuman)aiControl(p,dt);
    for(const p of players)updatePlayer(p,dt);
    applyPull(dt);
    updateBall(dt);
    for(const p of players)tryHits(p);
    if(state==='point'){stateT-=dt;if(stateT<=0&&!(score.some(s=>s>=cfg.target)&&Math.abs(score[0]-score[1])>=2))startRally(lastWinner)}
  }
  updatePSys(PADD,dt);updatePSys(PNORM,dt);updateFxObjs(dt);
}
function frame(now){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  const paused=$('pause').classList.contains('on');
  if(!paused){acc+=dt;let n=0;while(acc>=STEP&&n<12){acc-=STEP;tick(STEP);n++}if(n>=12)acc=0}
  updateAim();
  if(human)for(const p of players)syncPlayer(p,dt);
  if(ball&&state!=='menu')syncBall(dt);
  updateCrowd(gameTime,Math.min(1,crowdHype));ledTex.offset.x=(gameTime*.05)%1;
  updateCamera(dt);updateFlash(dt);updateFT(dt);updateHUD();
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}

// ---------- Menus ----------
const screens=['home','ranked','titles','styles','explos','balls','help','pause','over'];
function hideAll(){screens.forEach(s=>$(s).classList.remove('on'))}
function show(id){hideAll();$(id).classList.add('on');resetCam();
  if(id==='home'){state='menu';clearPlayers();ball=null;$('hud').classList.remove('on');$('touch').classList.remove('on');ballMesh.material=ballMaterial(save.eq.ball);refreshDemoAvatar();refreshHome();
    decoyMeshes.forEach(m=>m.visible=false);ballMesh.material.opacity=1;ballMesh.material.transparent=false}
  if(id==='home'){exitRanked();renderRankBox();chips('cTeam',[[1,'1 vs 1'],[2,'2 vs 2'],[3,'3 vs 3']],'team')}if(id==='ranked')renderRanked();
  if(id==='styles')renderStyles();if(id==='titles')renderTitles();if(id==='explos')renderExplos();if(id==='balls')renderBalls();refreshCoins()}
function togglePause(){if(!human||state==='menu'||state==='over')return;if($('pause').classList.contains('on'))hideAll();else show('pause')}
function refreshCoins(){document.querySelectorAll('.cv').forEach(e=>e.textContent=save.coins)}
function refreshHome(){refreshCoins();const st=S(save.eq.style);$('eqInfo').innerHTML=
  `Style : <b style="color:${RAR[st.r].c}">${ROLES[st.role].ic} ${st.n}</b> · Explosion : <b>${EXPLOS.find(e=>e.id===save.eq.explo).n}</b> · Balle : <b>${BALLS.find(e=>e.id===save.eq.ball).n}</b> · Titre : <b>${TITLES.find(t=>t.id===save.eq.title).n}</b><br>${save.styles.length}/${STYLES.length} styles · ${save.wins} V / ${save.losses} D`}
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{audioInit();show(b.dataset.go)}));
$('bPlay').onclick=()=>{audioInit();startMatch()};$('bAgain').onclick=()=>cfg.ranked?startRanked():startMatch();$('bResume').onclick=()=>hideAll();$('bQuit').onclick=()=>{if(cfg.ranked&&state!=='over'){applyRanked(false,true);checkTitles()}show('home')};
$('bRanked').onclick=()=>{audioInit();show('ranked')};$('bRankGo').onclick=()=>startRanked();
function chips(id,opts,key){const el=$(id);el.innerHTML='';for(const[v,l]of opts){const c=document.createElement('div');c.className='chip'+(cfg[key]===v?' on':'');c.textContent=l;c.onclick=()=>{cfg[key]=v;chips(id,opts,key)};el.appendChild(c)}}
chips('cTeam',[[1,'1 vs 1'],[2,'2 vs 2'],[3,'3 vs 3']],'team');
if(cfg.gfx==null)cfg.gfx=localStorage.getItem('voltvolley.gfx')||'high';
function gfxChips(){const el=$('cGfx');el.innerHTML='';for(const[v,l]of[['high','Élevés'],['low','Rapides']]){const c=document.createElement('div');c.className='chip'+(cfg.gfx===v?' on':'');c.textContent=l;c.onclick=()=>{cfg.gfx=v;localStorage.setItem('voltvolley.gfx',v);applyQuality(v);gfxChips()};el.appendChild(c)}}
gfxChips();applyQuality(cfg.gfx);
chips('cDiff',Object.entries(DIFF).map(([k,v])=>[k,v.n]),'diff');
chips('cPts',[[7,'7'],[11,'11'],[15,'15']],'target');
function renderStyles(){
  const g=$('gStyles');g.innerHTML='';const tot=Object.values(RAR).reduce((a,r)=>a+r.w,0);
  $('rates').innerHTML=RORDER.map(k=>`<span style="color:${RAR[k].c}">${RAR[k].n} ${(RAR[k].w/tot*100).toFixed(1)} %</span>`).join(' · ');
  for(const rk of RORDER){const list=STYLES.filter(s=>s.r===rk);
    const h=document.createElement('div');h.className='rhead r'+rk;h.style.setProperty('--rc',RAR[rk].c);h.textContent=`${RAR[rk].n} (${list.filter(s=>save.styles.includes(s.id)).length}/${list.length})`;g.appendChild(h);
    for(const st of list){const own=save.styles.includes(st.id);const d=document.createElement('div');
      d.className='card r'+rk+(own?'':' lock')+(save.eq.style===st.id?' eq':'');d.style.setProperty('--rc',RAR[st.r].c);
      const lv=st.r==='U'?`<div class="stats">Maîtrise <b>niv. ${masteryLvl(st.id)}/5</b> (${save.mastery[st.id]||0} victoires)</div>`:'';
      d.innerHTML=`${save.eq.style===st.id?'<div class="tag">ÉQUIPÉ</div>':''}<div class="role">${ROLES[st.role].ic} ${ROLES[st.role].n}</div><div class="swatch" style="background:${st.col}">${own?st.n[0]:'?'}</div><div class="nm">${own?st.n:'???'}</div><div class="rr">${RAR[st.r].n}</div><div class="ds">${own?st.d:'À débloquer au tirage.'}</div><div class="stats">Vit <b>${st.spd}</b> · Saut <b>${st.jmp}</b> · Force <b>${st.pow}</b></div>${lv}`;
      if(own)d.onclick=()=>{save.eq.style=st.id;persist();renderStyles()};g.appendChild(d)}}
}
function rollStyle(){const tot=Object.values(RAR).reduce((a,r)=>a+r.w,0);let x=Math.random()*tot;let rk='C';for(const[k,r]of Object.entries(RAR)){if(x<r.w){rk=k;break}x-=r.w}return pick(STYLES.filter(s=>s.r===rk))}
const rank=r=>RORDER.length-RORDER.indexOf(r);let spinning=false;
function doSpin(n){
  const cost=n===10?1350:150;if(spinning||save.coins<cost)return;audioInit();save.coins-=cost;persist();refreshCoins();spinning=true;
  const card=$('spinCard'),msg=$('spinMsg');msg.textContent='';card.classList.remove('reveal');
  const results=[...Array(n)].map(rollStyle),res=results.reduce((a,b)=>rank(b.r)>rank(a.r)?b:a);let i=0;const N=22;
  const stepf=()=>{const st=i<N?pick(STYLES):res;card.style.setProperty('--rc',RAR[st.r].c);card.className=i<N?'':'r'+st.r;card.innerHTML=`<div class="nm" style="color:${st.col}">${ROLES[st.role].ic} ${st.n}</div><div class="rr">${RAR[st.r].n}</div>`;SFX.tick();
    if(i<N){i++;setTimeout(stepf,30+i*i*.9)}else{card.classList.add('reveal');spinning=false;let news=[],refund=0;
      for(const r of results){if(save.styles.includes(r.id))refund+=50;else{save.styles.push(r.id);news.push(r)}}save.coins+=refund;
      if(news.length)save.eq.style=news.reduce((a,b)=>rank(b.r)>rank(a.r)?b:a).id;
      msg.innerHTML=(news.length?'NOUVEAU : '+news.map(r=>`<span style="color:${RAR[r.r].c}">${r.n}</span>`).join(', '):'Aucun nouveau style…')+(refund?` · doublons +${refund} 🪙`:'');
      const nt=checkTitles();if(nt.length)msg.innerHTML+=' · Titre : '+nt.map(t=>t.n).join(', ');
      persist();refreshCoins();renderStyles();refreshDemoAvatar();
      const fx={V:'nuke',U:'blackhole',S:'rainbow',D:'thunder',L:'firework'}[res.r];if(fx)explode(fx,rnd(-1,1),rnd(-1,1),res.col);else SFX.coin()}};
  stepf()}
$('bSpin').onclick=()=>doSpin(1);$('bSpin10').onclick=()=>doSpin(10);
function shopGrid(gid,list,ownKey,eqKey,extra){
  const g=$(gid);g.innerHTML='';
  for(const it of list){const own=save[ownKey].includes(it.id),eq=save.eq[eqKey]===it.id;const d=document.createElement('div');
    d.className='card'+(eq?' eq':'');d.style.setProperty('--rc',RAR[it.r].c);
    d.innerHTML=`${eq?'<div class="tag">ÉQUIPÉ</div>':''}${extra(it)}<div class="nm">${it.n}</div><div class="rr">${RAR[it.r].n}</div><div class="row" style="gap:6px"></div>`;
    const row=d.querySelector('.row'),b=document.createElement('button');b.className='btn sm '+(own?'green':'');
    b.textContent=own?(eq?'Équipé':'Équiper'):`${it.price} 🪙`;b.disabled=eq||(!own&&save.coins<it.price);
    b.onclick=e=>{e.stopPropagation();if(!own){if(save.coins<it.price)return;save.coins-=it.price;save[ownKey].push(it.id);SFX.coin()}save.eq[eqKey]=it.id;persist();refreshCoins();shopGrid(gid,list,ownKey,eqKey,extra);if(gid==='gBalls')ballMesh.material=ballMaterial(it.id)};
    row.appendChild(b);
    if(gid==='gExplos'){const t=document.createElement('button');t.className='btn sm gray';t.textContent='Tester';t.onclick=e=>{e.stopPropagation();audioInit();explode(it.id,rnd(1.5,4),rnd(-1.5,1.5),S(save.eq.style).col)};row.appendChild(t)}
    g.appendChild(d)}}
function renderExplos(){shopGrid('gExplos',EXPLOS,'explos','explo',it=>`<div class="swatch" style="background:${RAR[it.r].c}33;font-size:30px">${it.ic}</div>`)}
function renderBalls(){shopGrid('gBalls',BALLS,'balls','ball',it=>`<canvas class="bp" data-id="${it.id}" width="80" height="80" style="width:80px;height:80px"></canvas>`)}
function renderTitles(){const g=$('gTitles');g.innerHTML='';checkTitles();
  for(const t of TITLES){const own=save.titles.includes(t.id),eq=save.eq.title===t.id;const d=document.createElement('div');d.className='card'+(eq?' eq':'');
    d.innerHTML=`${eq?'<div class="tag">ÉQUIPÉ</div>':''}<div class="nm" style="font-style:italic">${t.n}</div><div class="ds">${t.ach?(own?'Débloqué !':'🔒 '+t.how):own?'Possédé':'Boutique'}</div><div class="row"></div>`;
    const b=document.createElement('button');b.className='btn sm '+(own?'green':'');b.textContent=own?(eq?'Équipé':'Équiper'):t.ach?'Verrouillé':`${t.price} 🪙`;b.disabled=eq||(!own&&(t.ach||save.coins<t.price));
    b.onclick=()=>{if(!own){save.coins-=t.price;save.titles.push(t.id);SFX.coin()}save.eq.title=t.id;persist();refreshCoins();renderTitles()};d.querySelector('.row').appendChild(b);g.appendChild(d)}}
(function ballPreviews(){const t=performance.now()/1000;if($('balls').classList.contains('on'))document.querySelectorAll('canvas.bp').forEach(c=>{const x=c.getContext('2d');x.clearRect(0,0,80,80);drawBall(x,c.dataset.id,40,40,28,t*2,t)});requestAnimationFrame(ballPreviews)})();

// ---------- Démarrage ----------
$('loading').remove();
show('home');renderRankBox();
requestAnimationFrame(frame);
