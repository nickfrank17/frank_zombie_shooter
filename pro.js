// mobile-landscape optimized zombie archery game (v2)
// includes: portrait overlay tip + improved scaling
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---------- virtual game size ----------
const GAME_WIDTH = 900;
const GAME_HEIGHT = 500;

// ---------- portrait overlay ----------
const orientationOverlay = document.createElement('div');
orientationOverlay.style.position = 'fixed';
orientationOverlay.style.top = 0;
orientationOverlay.style.left = 0;
orientationOverlay.style.width = '100%';
orientationOverlay.style.height = '100%';
orientationOverlay.style.background = 'rgba(0,0,0,0.85)';
orientationOverlay.style.display = 'flex';
orientationOverlay.style.justifyContent = 'center';
orientationOverlay.style.alignItems = 'center';
orientationOverlay.style.color = '#00ffcc';
orientationOverlay.style.fontFamily = 'sans-serif';
orientationOverlay.style.fontSize = '1.3rem';
orientationOverlay.style.textAlign = 'center';
orientationOverlay.style.zIndex = '9999';
orientationOverlay.style.padding = '20px';
orientationOverlay.innerHTML = '🔄 Please rotate your device<br>to <b>landscape</b> mode to play.';
document.body.appendChild(orientationOverlay);

// ---------- player ----------
const player = { x: 110, y: GAME_HEIGHT - 110, bodyColor:'#00ffcc', gunColor:'#88ce02', aimAngle:0 };

// ---------- responsive resize & orientation check ----------
function resizeCanvas() {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
        orientationOverlay.style.display = 'flex';
    } else {
        orientationOverlay.style.display = 'none';
    }

    const dpr = window.devicePixelRatio || 1;
    let scaleX = window.innerWidth / GAME_WIDTH;
    let scaleY = window.innerHeight / GAME_HEIGHT;
    let scale = Math.min(scaleX, scaleY);

    // enforce landscape rotation transform
    if (isPortrait) {
        canvas.style.transform = 'rotate(-90deg) translate(-100%, 0)';
        canvas.style.transformOrigin = 'top left';
        scale = window.innerHeight / GAME_WIDTH;
    } else {
        canvas.style.transform = '';
    }

    canvas.width = GAME_WIDTH * dpr;
    canvas.height = GAME_HEIGHT * dpr;
    canvas.style.width = (GAME_WIDTH * scale) + 'px';
    canvas.style.height = (GAME_HEIGHT * scale) + 'px';
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);

    // re-center player in bounds
    player.y = Math.min(Math.max(player.y, 60), GAME_HEIGHT - 40);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

// ---------- coordinate conversion ----------
function clientToGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / GAME_WIDTH;
    const scaleY = rect.height / GAME_HEIGHT;
    const x = (clientX - rect.left) / scaleX;
    const y = (clientY - rect.top) / scaleY;
    return { x, y };
}

// ---------- game state ----------
let arrows = [], zombies = [], powerUps = [], effects = [];
let score = 0, killsSinceBonus = 0, timeLeft = 100;
let running = false, gameEnded = false, lastTime = 0;
let spawnTimer = 0, spawnPowerUpTimer = 0;

// ---------- constants ----------
let ARROW_SPEED = GAME_WIDTH * 1.5;
const ARROW_LENGTH = 34, ARROW_HEAD = 8;
const ZOMBIE_W = 44, ZOMBIE_H = 70;
const ZOMBIE_SPEED_MIN = 0.08 * GAME_WIDTH;
const ZOMBIE_SPEED_MAX = 0.15 * GAME_WIDTH;
const SPAWN_INTERVAL = 1000;

// HUD
const HUD_BOX_W = GAME_WIDTH * 0.2;
const HUD_BOX_H = GAME_HEIGHT * 0.15;

// ---------- joystick & shoot button ----------
const joystick = { baseX:150, baseY:GAME_HEIGHT-120, radius:50, stickX:150, stickY:GAME_HEIGHT-120, active:false };
const shootButton = { x:GAME_WIDTH-120, y:GAME_HEIGHT-120, radius:40 };

// ---------- input (touch + mouse) ----------
canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    for (let i=0; i<e.touches.length; i++) {
        const g = clientToGame(e.touches[i].clientX, e.touches[i].clientY);
        const dxJ = g.x - joystick.baseX, dyJ = g.y - joystick.baseY;
        if (Math.hypot(dxJ, dyJ) < joystick.radius + 30) {
            joystick.active = true;
            joystick.stickX = g.x; joystick.stickY = g.y;
            player.aimAngle = Math.atan2(dyJ, dxJ);
            player.y = Math.min(Math.max(g.y, 60), GAME_HEIGHT - 40);
        }
        const dxB = g.x - shootButton.x, dyB = g.y - shootButton.y;
        if (Math.hypot(dxB, dyB) < shootButton.radius) shootArrow();
    }
}, { passive:false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!joystick.active) return;
    const g = clientToGame(e.touches[0].clientX, e.touches[0].clientY);
    const dx = g.x - joystick.baseX, dy = g.y - joystick.baseY;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const r = Math.min(dist, joystick.radius);
    joystick.stickX = joystick.baseX + Math.cos(angle) * r;
    joystick.stickY = joystick.baseY + Math.sin(angle) * r;
    player.aimAngle = angle;
    player.y = Math.min(Math.max(joystick.baseY + Math.sin(angle) * r, 60), GAME_HEIGHT - 40);
}, { passive:false });

canvas.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
        joystick.active = false;
        joystick.stickX = joystick.baseX;
        joystick.stickY = joystick.baseY;
    }
}, { passive:false });

window.addEventListener('mousemove', e => {
    const g = clientToGame(e.clientX, e.clientY);
    const dx = g.x - player.x;
    const dy = g.y - (player.y - 40);
    player.aimAngle = Math.atan2(dy, dx);
});
canvas.addEventListener('click', e => {
    if (gameEnded) { resetGame(); return; }
    const g = clientToGame(e.clientX, e.clientY);
    const dx = g.x - player.x, dy = g.y - (player.y - 40);
    player.aimAngle = Math.atan2(dy, dx);
    shootArrow();
});
document.addEventListener('keydown', e => {
    if (e.code === 'Space') {
        e.preventDefault();
        if (gameEnded) resetGame(); else shootArrow();
    }
});

// ---------- shooting ----------
function shootArrow() {
    const muzzleX = player.x + 28;
    const muzzleY = player.y - 40;
    const angle = player.aimAngle;
    arrows.push({ x:muzzleX + Math.cos(angle)*10, y:muzzleY + Math.sin(angle)*10, angle, speed:ARROW_SPEED, alive:true });
}

// ---------- zombies ----------
function spawnZombie() {
    const y = Math.random()*(GAME_HEIGHT-160)+80;
    const speed = -(ZOMBIE_SPEED_MIN + Math.random()*(ZOMBIE_SPEED_MAX-ZOMBIE_SPEED_MIN));
    const type = Math.random()<0.3?'big':'small';
    const hp = type==='big'?3:1;
    zombies.push({ x:GAME_WIDTH+50, y, w:ZOMBIE_W, h:ZOMBIE_H, speed, alive:true, hp, maxHp:hp, type });
}

// ---------- collisions ----------
function arrowHitsZombie(a, z) {
    const tipX = a.x + Math.cos(a.angle)*ARROW_LENGTH;
    const tipY = a.y + Math.sin(a.angle)*ARROW_LENGTH;
    return tipX >= z.x - z.w/2 && tipX <= z.x + z.w/2 && tipY >= z.y - z.h/2 && tipY <= z.y + z.h/2;
}

// ---------- effects ----------
function drawEffects() {
    for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        ctx.fillStyle = e.color;
        ctx.font = '20px monospace';
        ctx.fillText(e.text, e.x, e.y);
        e.y += e.dy;
        e.life -= 0.016;
        if (e.life <= 0) effects.splice(i, 1);
    }
}

// ---------- draw helpers ----------
function drawBackground() {
    const g = ctx.createLinearGradient(0,0,0,GAME_HEIGHT);
    g.addColorStop(0,'#071428'); g.addColorStop(0.7,'#081218'); g.addColorStop(1,'#041012');
    ctx.fillStyle=g; ctx.fillRect(0,0,GAME_WIDTH,GAME_HEIGHT);
    ctx.fillStyle='#0b2b12'; ctx.fillRect(0,GAME_HEIGHT-80,GAME_WIDTH,80);
}
function drawStickman() {
    ctx.strokeStyle=player.bodyColor; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(player.x, player.y-90, 12, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(player.x, player.y-78); ctx.lineTo(player.x, player.y-40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(player.x-18, player.y-66); ctx.lineTo(player.x+18, player.y-66); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(player.x, player.y-40); ctx.lineTo(player.x-14, player.y-8);
    ctx.moveTo(player.x, player.y-40); ctx.lineTo(player.x+14, player.y-8); ctx.stroke();
    const gunX=player.x+8, gunY=player.y-64;
    ctx.save(); ctx.translate(gunX,gunY); ctx.rotate(player.aimAngle);
    ctx.fillStyle=player.gunColor; ctx.fillRect(0,-6,44,12);
    ctx.fillStyle='#003300'; ctx.fillRect(34,-3,10,6); ctx.restore();
}
function drawArrow(a) {
    const x=a.x, y=a.y, angle=a.angle;
    ctx.strokeStyle='#ffd166'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(x,y);
    ctx.lineTo(x+Math.cos(angle)*ARROW_LENGTH,y+Math.sin(angle)*ARROW_LENGTH); ctx.stroke();
    ctx.fillStyle='#ffb703'; ctx.beginPath();
    ctx.moveTo(x+Math.cos(angle)*ARROW_LENGTH,y+Math.sin(angle)*ARROW_LENGTH);
    ctx.lineTo(x+Math.cos(angle+0.28)(ARROW_LENGTH-ARROW_HEAD),y+Math.sin(angle+0.28)(ARROW_LENGTH-ARROW_HEAD));
    ctx.lineTo(x+Math.cos(angle-0.28)(ARROW_LENGTH-ARROW_HEAD),y+Math.sin(angle-0.28)(ARROW_LENGTH-ARROW_HEAD));
    ctx.closePath(); ctx.fill();
}
function drawZombie(z) {
    ctx.fillStyle='#6bbf4a'; ctx.fillRect(z.x-z.w/2,z.y-z.h/2,z.w,z.h);
    ctx.fillStyle='#fff'; ctx.fillRect(z.x-10,z.y-30,6,6);
    ctx.fillStyle='#000'; ctx.fillRect(z.x-8,z.y-28,2,2);
    if(z.hp!==undefined){
        const hpW=36,hpPct=Math.max(0,z.hp/z.maxHp);
        ctx.fillStyle='#222'; ctx.fillRect(z.x-hpW/2,z.y-z.h/2-12,hpW,6);
        ctx.fillStyle='#ff385c'; ctx.fillRect(z.x-hpW/2,z.y-z.h/2-12,hpW*hpPct,6);
    }
}

// ---------- game loop ----------
function updateAndRender(now){
    if(!running) return;
    const dt=Math.min(40, now-lastTime);
    lastTime=now;

    spawnTimer+=dt; if(spawnTimer>=SPAWN_INTERVAL){spawnTimer=0; spawnZombie();}
    timeLeft-=dt/1000;
    if(timeLeft<=0){timeLeft=0; endGame('⏰ Time’s up — Tap or SPACE to restart');}

    for(let i=arrows.length-1;i>=0;i--){
        const a=arrows[i];
        a.x += Math.cos(a.angle) * a.speed * (dt / 1000);
        a.y += Math.sin(a.angle) * a.speed * (dt / 1000);
        if(a.x<-50||a.x>GAME_WIDTH+50||a.y<-50||a.y>GAME_HEIGHT+50) arrows.splice(i,1);
    }
    for(let zi=zombies.length-1;zi>=0;zi--){
        const z=zombies[zi];
        z.x+=z.speed*(dt/1000);
        if(z.x< -100) {zombies.splice(zi,1); continue;}
        if(z.x - z.w/2 <= player.x+12){ endGame('💀 Eaten! Tap or SPACE to restart'); return; }
        for(let ai=arrows.length-1;ai>=0;ai--){
            const a=arrows[ai];
            if(arrowHitsZombie(a,z)){
                arrows.splice(ai,1);
                z.hp--;
                if(z.hp<=0){
                    z.alive=false; score++; killsSinceBonus++;
                    effects.push({x:z.x,y:z.y,text:'+1',color:'#00ffcc',life:0.7,dy:-0.5});
                }
                if(killsSinceBonus>=2){ timeLeft+=10; killsSinceBonus=0; effects.push({x:player.x,y:player.y-100,text:'+10s',color:'#ffdd00',life:1,dy:-0.6}); }
                break;
            }
        }
        if(!z.alive) zombies.splice(zi,1);
    }

    drawBackground();
    arrows.forEach(drawArrow);
    zombies.forEach(drawZombie);
    drawStickman();
    drawEffects();

    // joystick
    ctx.save(); ctx.globalAlpha=0.5;
    ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(joystick.baseX,joystick.baseY,joystick.radius,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#aaa'; ctx.beginPath(); ctx.arc(joystick.stickX,joystick.stickY,joystick.radius*0.6,0,Math.PI*2); ctx.fill(); ctx.restore();

    // shoot button
    ctx.save(); ctx.globalAlpha=0.7; ctx.fillStyle='#ff4444';
    ctx.beginPath(); ctx.arc(shootButton.x,shootButton.y,shootButton.radius,0,Math.PI*2); ctx.fill(); ctx.restore();

    // HUD
    ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)';
    ctx.fillRect(18,18,HUD_BOX_W,HUD_BOX_H);
    ctx.fillRect(18, 18, HUD_BOX_W, HUD_BOX_H);
    ctx.fillText('Score: '+score,30,30+HUD_BOX_H*0.2);
    ctx.fillText('Time: '+Math.ceil(timeLeft)+'s',30,30+HUD_BOX_H*0.6);
    ctx.restore();

    if(running) requestAnimationFrame(updateAndRender);
}

// ---------- end & restart ----------
function endGame(msg){
    running=false; gameEnded=true;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,0.6)';
    ctx.fillRect(0,GAME_HEIGHT/2-60,GAME_WIDTH,120);
    ctx.fillStyle='#ffdd88';
    ctx.font='26px sans-serif'; ctx.textAlign='center';
    ctx.fillText(msg,GAME_WIDTH/2,GAME_HEIGHT/2);
    ctx.restore();
}
function resetGame(){
    arrows=[]; zombies=[]; powerUps=[]; effects=[];
    score=0; killsSinceBonus=0; timeLeft=100;
    spawnTimer=0; lastTime=performance.now(); gameEnded=false; running=true;
    player.y=GAME_HEIGHT-110; ARROW_SPEED=GAME_WIDTH*1.5;
    for(let i=0;i<5;i++) spawnZombie();
    requestAnimationFrame(updateAndRender);
}
resetGame();
