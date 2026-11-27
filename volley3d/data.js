"use strict";
// Données partagées avec la version 2D : styles, raretés, boutique, sauvegarde, sons.
const TAU=Math.PI*2;
const rnd=(a,b)=>a+Math.random()*(b-a), clamp=(v,a,b)=>v<a?a:v>b?b:v, dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const pick=a=>a[Math.floor(Math.random()*a.length)];

// Rangs de rareté (du plus commun au plus rare)
const RAR={
  C:{n:'Commun',c:'#b8c2cc',w:48},R:{n:'Rare',c:'#4da3ff',w:28},L:{n:'Légendaire',c:'#ffb02e',w:15},
  D:{n:'Divin',c:'#fff3a0',w:6},S:{n:'Secret',c:'#ff3d3d',w:2.2},U:{n:'Ultra',c:'#ff5cf0',w:.6},V:{n:'Évo',c:'#3dffb4',w:.2}};
const RORDER=['V','U','S','D','L','R','C'];
const ROLES={att:{n:'Attaquant',ic:'🔥'},pas:{n:'Passeur',ic:'🎯'},con:{n:'Contreur',ic:'🧱'},lib:{n:'Libéro',ic:'🛡️'},ser:{n:'Serveur',ic:'🚀'},pol:{n:'Polyvalent',ic:'⭐'}};
const AB={
  superjump:{n:'Super saut',cd:12,k:'buff',t:4},sprint:{n:'Turbo',cd:10,k:'buff',t:4},wall:{n:'Muraille',cd:12,k:'buff',t:5},
  magnet:{n:'Aimant',cd:12,k:'buff',t:3},guard:{n:'Garde',cd:11,k:'buff',t:5},slowmo:{n:'Ralenti',cd:14,k:'buff',t:3},longarm:{n:'Bras géants',cd:12,k:'buff',t:5},
  feint:{n:'Feinte',cd:8,k:'charge'},comet:{n:'Comète',cd:10,k:'charge'},thunder:{n:'Smash éclair',cd:12,k:'charge'},
  ghost:{n:'Fantôme',cd:13,k:'charge'},cyclone:{n:'Cyclone',cd:14,k:'charge'},meteor:{n:'Météore',cd:13,k:'charge'},
  banana:{n:'Boomerang',cd:10,k:'charge'},mirage:{n:'Mirage',cd:12,k:'charge'},perfect:{n:'Passe parfaite',cd:9,k:'charge'},ace:{n:'Service canon',cd:10,k:'charge'},
  freeze:{n:'Gel',cd:14,k:'now'},quake:{n:'Séisme',cd:12,k:'now'},teleport:{n:'Éclipse',cd:11,k:'now'},
  twins:{n:'Double visage',cd:9,k:'now'},rebirth:{n:'Renaissance',cd:16,k:'now'},
};
const st_=(id,n,r,role,col,spd,jmp,pow,ab,d)=>({id,n,r,role,col,spd,jmp,pow,ab,d});
const STYLES=[
  // Commun
  st_('rookie','Recrue','C','pol','#9aa7b4',3,3,3,null,'Équilibré, sans pouvoir.'),
  st_('brute','Cogneur','C','att','#c47a4a',2,3,4,null,'Smash plus lourd, un peu lent.'),
  st_('swift','Feu Follet','C','lib','#7bd88f',4,3,2,null,'Très mobile, réception sûre.'),
  st_('brick','Rempart','C','con','#a3876b',2,4,3,null,'Grand et solide au filet.'),
  st_('feather','Plume','C','pas','#e9d7ff',3,3,2,null,'Passes précises.'),
  st_('cannon','Canon','C','ser','#8fa3b8',3,3,4,null,'Service puissant.'),
  // Rare
  st_('spring','Ressort','R','att','#38d6c4',3,4,3,['superjump'],'E : sauts géants pendant 4 s.'),
  st_('turbo','Turbo','R','lib','#4da3ff',4,3,3,['sprint'],'E : vitesse ×1,6 pendant 4 s.'),
  st_('trick','Malin','R','pas','#9fd3ff',3,3,3,['feint'],'E : prochain smash = feinte juste derrière le filet.'),
  st_('magnet','Aimant','R','pol','#ff8f5a',3,3,3,['magnet'],'E : attire la balle vers toi pendant 3 s.'),
  st_('pillar','Pilier','R','con','#7d8cff',2,4,3,['wall'],'E : contre géant pendant 5 s.'),
  // Légendaire
  st_('volt','Foudre','L','att','#ffd23d',4,4,4,['thunder'],'E : prochain smash éclair ×1,7.'),
  st_('frost','Givre','L','pol','#7fe8ff',3,4,4,['freeze'],'E : gèle l\'adversaire 1,3 s.'),
  st_('comet','Comète','L','att','#b066ff',3,4,4,['comet'],'E : prochain smash plonge brutalement après le filet.'),
  st_('titan','Titan','L','con','#8d6bff',2,5,4,['wall','superjump'],'E : contre géant + grand saut.'),
  st_('quake','Sismique','L','att','#c9813b',3,3,5,['quake'],'E : séisme, l\'adversaire ne peut plus sauter 1,8 s.'),
  st_('boomer','Boomerang','L','ser','#5be37a',4,3,4,['banana'],'E : smash qui part loin puis revient court.'),
  st_('maestro_l','Chef d\'orchestre','L','pas','#ffb0d0',3,3,3,['perfect'],'E : passe parfaite, le smash suivant ×1,4.'),
  // Divin
  st_('meteor','Météore','D','att','#ff7a1f',4,5,5,['meteor'],'E : smash météore enflammé ×1,6 qui fait trembler le sol.'),
  st_('eclipse','Éclipse','D','lib','#2b2b55',5,4,3,['teleport'],'E : téléportation sous la balle.'),
  st_('hourglass','Sablier','D','pas','#e8c27a',4,4,3,['slowmo'],'E : la balle ralentit dans ton camp 3 s.'),
  st_('guardian','Gardien','D','lib','#9ef0ff',5,3,3,['guard'],'E : zone de réception géante 5 s.'),
  // Secret
  st_('ghost','Spectre','S','att','#e6e6ff',4,5,4,['ghost'],'E : prochain smash devient invisible.'),
  st_('cyclone','Cyclone','S','att','#ff3d6e',5,4,5,['cyclone'],'E : smash en zigzag ultra puissant.'),
  st_('mirage','Mirage','S','pas','#c0a8ff',4,4,4,['mirage'],'E : smash accompagné de fausses balles.'),
  st_('kraken','Kraken','S','con','#2fb59b',3,4,4,['longarm','magnet'],'E : bras géants + aimant.'),
  st_('twins','Jumeaux','S','pol','#ffa63d',4,4,4,['twins'],'E : alterne mode attaque (smash éclair) et mode défense (muraille).'),
  st_('shadow','Ombre','S','att','#5a3d8a',5,4,4,['teleport','ghost'],'E : téléportation + smash invisible.'),
  st_('bastion','Bastion','S','con','#b0b8c8',2,5,4,['wall','freeze'],'E : muraille + gel de l\'adversaire.'),
  st_('angel','Séraphin','S','lib','#fff6d8',5,5,3,['guard','superjump'],'E : garde géante + grands sauts.'),
  // Ultra (progressent avec la maîtrise)
  st_('supernova','Supernova','U','att','#ff4fd8',4,5,5,['thunder','superjump'],'E : grand saut + smash éclair. Maîtrise jusqu\'au niv. 5.'),
  st_('maestro','Maestro','U','pas','#ffd6f5',5,4,4,['perfect','slowmo'],'E : ralenti + passe parfaite. Maîtrise jusqu\'au niv. 5.'),
  st_('fortress','Forteresse','U','con','#d0d6ff',3,5,4,['wall','quake'],'E : muraille + séisme. Maîtrise jusqu\'au niv. 5.'),
  st_('tempest','Tempête','U','ser','#62b7ff',5,4,5,['cyclone','ace'],'E : service canon + smash cyclone. Maîtrise jusqu\'au niv. 5.'),
  // Évo (évolue pendant le match)
  st_('phoenix','Phénix','V','pol','#3dffb4',4,4,4,['rebirth'],'Évolue à chaque point marqué (niv. 1→5). E : renaissance, tous les bonus + météore.'),
];
const TITLES=[
  {id:'none',n:'Aucun titre',price:0},
  {id:'rookie',n:'🌱 Débutant',price:0},
  {id:'potato',n:'🥔 Patate',price:200},
  {id:'melon',n:'🍉 Pastèque',price:300},
  {id:'choco',n:'🍫 Chocolat chaud',price:400},
  {id:'beach',n:'🏖️ Vibes plage',price:400},
  {id:'angel',n:'😇 Céleste',price:800},
  {id:'demon',n:'😈 Démoniaque',price:800},
  {id:'cursed',n:'🩸 Maudit',price:1000},
  {id:'volcano',n:'🌋 Volcanique',price:1200},
  {id:'winner',n:'🏆 Vainqueur',ach:s=>s.wins>=1,how:'Gagne 1 match'},
  {id:'veteran',n:'🎖️ Vétéran',ach:s=>s.wins>=10,how:'Gagne 10 matchs'},
  {id:'wall',n:'🧱 Roi du filet',ach:s=>s.st.blocks>=10,how:'Marque 10 points sur contre'},
  {id:'smasher',n:'💥 Smasheur fou',ach:s=>s.st.spikes>=25,how:'Marque 25 points sur smash'},
  {id:'acer',n:'🚀 Canonnier',ach:s=>s.st.aces>=5,how:'Réussis 5 aces'},
  {id:'legend',n:'👑 Tueur de légende',ach:s=>s.st.legendWins>=1,how:'Bats l\'IA Légende'},
  {id:'rk_gold',n:'👑 Joueur Or',ach:s=>!!s.ranked&&s.ranked.best>=600,how:'Atteins le rang Or en classé'},
  {id:'rk_diamond',n:'💎 Diamant brut',ach:s=>!!s.ranked&&s.ranked.best>=1200,how:'Atteins le rang Diamant en classé'},
  {id:'rk_legend',n:'🔥 Légende du classé',ach:s=>!!s.ranked&&s.ranked.best>=1800,how:'Atteins le rang Légende en classé'},
  {id:'collector',n:'📚 Collectionneur',ach:s=>s.styles.length>=15,how:'Possède 15 styles'},
];
const EXPLOS=[
  {id:'classic',n:'Classique',r:'C',price:0,ic:'✨'},
  {id:'confetti',n:'Confettis',r:'C',price:150,ic:'🎊'},
  {id:'pixel',n:'Pixel',r:'R',price:300,ic:'👾'},
  {id:'sakura',n:'Sakura',r:'R',price:350,ic:'🌸'},
  {id:'firework',n:"Feu d'artifice",r:'L',price:600,ic:'🎆'},
  {id:'ice',n:'Éclats de glace',r:'L',price:650,ic:'❄️'},
  {id:'thunder',n:'Orage',r:'D',price:1000,ic:'⚡'},
  {id:'rainbow',n:'Arc-en-ciel',r:'D',price:1100,ic:'🌈'},
  {id:'blackhole',n:'Trou noir',r:'S',price:1800,ic:'🕳️'},
  {id:'nuke',n:'Nucléaire',r:'S',price:2000,ic:'☢️'},
];
const BALLS=[
  {id:'classic',n:'Classique',r:'C',price:0},
  {id:'beach',n:'Plage',r:'C',price:120},
  {id:'basket',n:'Orange',r:'C',price:150},
  {id:'melon',n:'Pastèque',r:'R',price:300},
  {id:'eye',n:'Œil',r:'R',price:350},
  {id:'fire',n:'Brasier',r:'L',price:600},
  {id:'ice',n:'Banquise',r:'L',price:600},
  {id:'neon',n:'Néon',r:'D',price:1000},
  {id:'gold',n:'Or massif',r:'D',price:1200},
  {id:'galaxy',n:'Galaxie',r:'S',price:1800},
  {id:'rainbow',n:'Prisme',r:'S',price:1800},
];
const DIFF={
  easy:{n:'Facile',spd:.72,react:.32,err:70,spike:.45,block:.12,pow:.85},
  normal:{n:'Normal',spd:.88,react:.2,err:38,spike:.78,block:.3,pow:1},
  hard:{n:'Difficile',spd:1,react:.11,err:18,spike:.95,block:.55,pow:1.05},
  legend:{n:'Légende',spd:1.12,react:.05,err:6,spike:1,block:.8,pow:1.12},
};
const S=id=>STYLES.find(s=>s.id===id)||STYLES[0];
// ================== SAUVEGARDE ==================
const SKEY='voltvolley.save.v1';
let save=(()=>{try{const s=JSON.parse(localStorage.getItem(SKEY));if(s&&s.styles)return s}catch(e){}return null})()||
  {coins:600,styles:['rookie'],explos:['classic'],balls:['classic'],eq:{style:'rookie',explo:'classic',ball:'classic'},wins:0,losses:0};
save.titles=save.titles||['none','rookie'];save.mastery=save.mastery||{};save.st=Object.assign({blocks:0,spikes:0,aces:0,legendWins:0},save.st||{});
if(save.eq.title==null)save.eq.title='rookie';
save.styles=save.styles.filter(id=>STYLES.some(s=>s.id===id));if(!save.styles.length)save.styles=['rookie'];if(!save.styles.includes(save.eq.style))save.eq.style=save.styles[0];
const persist=()=>localStorage.setItem(SKEY,JSON.stringify(save));
// Maîtrise : les styles Ultra montent de niveau à chaque 2 victoires (niv. 1→5)
const masteryLvl=id=>Math.min(5,1+Math.floor((save.mastery[id]||0)/2));
function checkTitles(){const got=[];for(const t of TITLES)if(t.ach&&!save.titles.includes(t.id)&&t.ach(save)){save.titles.push(t.id);got.push(t)}if(got.length)persist();return got}
const cfg={diff:'normal',target:11};

// ================== AUDIO ==================
let ac=null;
function audioInit(){if(!ac){try{ac=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ac&&ac.state==='suspended')ac.resume()}
function tone(f,d,type='sine',v=.15,f2){if(!ac)return;const t=ac.currentTime,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.001,t+d);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+d)}
function noise(d,v=.3,freq=1200){if(!ac)return;const t=ac.currentTime,n=ac.sampleRate*d,b=ac.createBuffer(1,n,ac.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=freq;g.gain.value=v;s.connect(f).connect(g).connect(ac.destination);s.start(t)}
const SFX={
  bump(){tone(320,.09,'triangle',.25,220)},set(){tone(520,.1,'triangle',.2,700)},
  spike(){noise(.18,.45,3000);tone(160,.2,'sawtooth',.15,60)},net(){tone(110,.15,'square',.12,80)},
  block(){noise(.12,.4,1500);tone(240,.12,'square',.15,120)},power(){tone(300,.35,'sawtooth',.12,1200);tone(600,.35,'sine',.1,1800)},
  boom(){noise(.7,.6,500);tone(90,.6,'sine',.4,30)},big(){noise(1.4,.8,350);tone(60,1.2,'sine',.5,20)},
  coin(){tone(880,.08,'square',.08);setTimeout(()=>tone(1320,.15,'square',.08),70)},tick(){tone(700,.03,'square',.05)},
  zap(){noise(.3,.5,6000);tone(1200,.25,'sawtooth',.1,100)},whistle(){tone(1800,.25,'sine',.12,1600)},
  win(){[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.25,'triangle',.18),i*120))},
  lose(){[400,330,260].forEach((f,i)=>setTimeout(()=>tone(f,.3,'triangle',.15),i*160))}
};

// ================== DESSIN BALLE ==================
const GAL=[...Array(26)].map(()=>[rnd(-1,1),rnd(-1,1),rnd(.5,1.6)]);
function drawBall(c,id,x,y,r,rot,t,alpha=1){
  c.save();c.translate(x,y);c.globalAlpha=alpha;
  if(id==='neon'||id==='gold'||id==='fire'||id==='galaxy'||id==='rainbow'){c.shadowColor={neon:'#22f0ff',gold:'#ffd23d',fire:'#ff7a1f',galaxy:'#b066ff',rainbow:`hsl(${t*200%360},100%,60%)`}[id];c.shadowBlur=22}
  c.beginPath();c.arc(0,0,r,0,TAU);c.fillStyle='#fff';c.fill();c.shadowBlur=0;
  c.save();c.rotate(rot);c.beginPath();c.arc(0,0,r,0,TAU);c.clip();
  const panels=(cols,bg,lw=.36)=>{c.fillStyle=bg;c.fillRect(-r,-r,2*r,2*r);for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);c.strokeStyle=cols[i];c.lineWidth=r*lw;c.beginPath();c.arc(r*1.05,0,r*1.05,Math.PI*.62,Math.PI*1.38);c.stroke();c.restore()}};
  switch(id){
    case 'classic':panels(['#ffd23d','#2a6fdb','#f7f3e8'],'#f7f3e8');c.strokeStyle='#0003';c.lineWidth=1.5;for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3);c.beginPath();c.arc(r*1.05,0,r*1.05-r*.18,Math.PI*.62,Math.PI*1.38);c.stroke();c.restore()}break;
    case 'beach':{const cl=['#ff4757','#fff','#2e86ff','#ffd23d','#2ed573','#fff'];for(let i=0;i<6;i++){c.fillStyle=cl[i];c.beginPath();c.moveTo(0,0);c.arc(0,0,r,i*TAU/6,(i+1)*TAU/6);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc(0,0,r*.22,0,TAU);c.fill();break}
    case 'basket':c.fillStyle='#f0812b';c.fillRect(-r,-r,2*r,2*r);c.strokeStyle='#3a1a08';c.lineWidth=2.2;c.beginPath();c.moveTo(-r,0);c.lineTo(r,0);c.moveTo(0,-r);c.lineTo(0,r);c.stroke();c.beginPath();c.arc(-r*1.2,0,r*.95,-1,1);c.stroke();c.beginPath();c.arc(r*1.2,0,r*.95,Math.PI-1,Math.PI+1);c.stroke();break;
    case 'melon':c.fillStyle='#3fb950';c.fillRect(-r,-r,2*r,2*r);c.fillStyle='#1d6b2a';for(let i=-3;i<=3;i++){c.beginPath();for(let yy=-r;yy<=r;yy+=3)c.lineTo(i*r*.32+Math.sin(yy*.35)*2.5,yy);for(let yy=r;yy>=-r;yy-=3)c.lineTo(i*r*.32+r*.11+Math.sin(yy*.35)*2.5,yy);c.fill()}break;
    case 'eye':c.fillStyle='#fffaf2';c.fillRect(-r,-r,2*r,2*r);c.strokeStyle='#e0303080';c.lineWidth=1.2;for(let i=0;i<7;i++){const a=i/7*TAU;c.beginPath();c.moveTo(Math.cos(a)*r,Math.sin(a)*r);c.quadraticCurveTo(Math.cos(a+.3)*r*.6,Math.sin(a+.3)*r*.6,Math.cos(a)*r*.45,Math.sin(a)*r*.45);c.stroke()}c.fillStyle='#2e9bff';c.beginPath();c.arc(r*.25,0,r*.45,0,TAU);c.fill();c.fillStyle='#111';c.beginPath();c.arc(r*.3,0,r*.22,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(r*.2,-r*.1,r*.08,0,TAU);c.fill();break;
    case 'fire':{const g=c.createRadialGradient(0,0,0,0,0,r);g.addColorStop(0,'#fff6a8');g.addColorStop(.45,'#ffb020');g.addColorStop(1,'#d8280f');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.strokeStyle='#ff5a1f';c.lineWidth=3;for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3+t*2);c.beginPath();c.arc(r*.5,0,r*.5,0,Math.PI*1.3);c.stroke();c.restore()}break}
    case 'ice':{const g=c.createRadialGradient(-r*.3,-r*.3,0,0,0,r);g.addColorStop(0,'#ffffff');g.addColorStop(.6,'#9fe6ff');g.addColorStop(1,'#3a9de0');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.strokeStyle='#ffffffcc';c.lineWidth=1.5;c.beginPath();c.moveTo(-r,-.2*r);c.lineTo(-.3*r,0);c.lineTo(.1*r,-.6*r);c.moveTo(-.3*r,0);c.lineTo(.2*r,.5*r);c.lineTo(r,.3*r);c.moveTo(.2*r,.5*r);c.lineTo(0,r);c.stroke();break}
    case 'neon':c.fillStyle='#0b0b1a';c.fillRect(-r,-r,2*r,2*r);panels(['#22f0ff','#ff3df0','#b4ff3d'],'#0b0b1a',.14);break;
    case 'gold':{const g=c.createLinearGradient(-r,-r,r,r);g.addColorStop(0,'#fff3b0');g.addColorStop(.5,'#ffc21f');g.addColorStop(1,'#a8690a');panels(['#d99a0f','#ffe27a','#c07f0c'],'#ffc21f');c.globalCompositeOperation='overlay';c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.globalCompositeOperation='source-over';break}
    case 'galaxy':{const g=c.createRadialGradient(r*.2,-r*.2,0,0,0,r*1.2);g.addColorStop(0,'#c86bff');g.addColorStop(.5,'#3a1b8a');g.addColorStop(1,'#08051c');c.fillStyle=g;c.fillRect(-r,-r,2*r,2*r);c.fillStyle='#ff7cf555';c.beginPath();c.ellipse(-r*.2,r*.2,r*.8,r*.3,.6,0,TAU);c.fill();c.fillStyle='#fff';for(const s of GAL){c.globalAlpha=alpha*(.5+.5*Math.sin(t*4+s[2]*9));c.fillRect(s[0]*r,s[1]*r,s[2],s[2])}c.globalAlpha=alpha;break}
    case 'rainbow':for(let i=0;i<12;i++){c.fillStyle=`hsl(${i*30+t*160},100%,62%)`;c.beginPath();c.moveTo(0,0);c.arc(0,0,r,i*TAU/12,(i+1)*TAU/12+.02);c.fill()}c.fillStyle='#fff';c.beginPath();c.arc(0,0,r*.25,0,TAU);c.fill();break;
  }
  c.restore();
  const sh=c.createRadialGradient(-r*.4,-r*.45,r*.1,0,0,r);sh.addColorStop(0,'rgba(255,255,255,.55)');sh.addColorStop(.5,'rgba(255,255,255,0)');sh.addColorStop(1,'rgba(0,0,0,.35)');
  c.fillStyle=sh;c.beginPath();c.arc(0,0,r,0,TAU);c.fill();
  c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=1.5;c.stroke();
  c.restore();
}

function unlockAll(){save.styles=STYLES.map(s=>s.id);save.explos=EXPLOS.map(e=>e.id);save.balls=BALLS.map(b=>b.id);save.titles=TITLES.map(t=>t.id);for(const s of STYLES)if(s.r==='U')save.mastery[s.id]=Math.max(save.mastery[s.id]||0,8);save.coins=Math.max(save.coins,99999);save.allGiven=true;persist()}
if(!save.allGiven)unlockAll();
