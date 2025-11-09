

// pro.js - Final version: stickman shooter, aimed arrows, infinite zombies, HUD, timer & restart
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---------- canvas sizing & scaling ----------
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(innerWidth * dpr);
  canvas.height = Math.floor(innerHeight * dpr);
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  // clamp player y if needed
  player.y = Math.min(Math.max(player.y, 60), innerHeight - 40);
});

// ---------- game state ----------
let arrows = [];    // {x,y,angle,speed,alive}
let zombies = [];   // {x,y,w,h,speed,alive}
let score = 0;
let killsSinceBonus = 0;
let timeLeft = 100; // seconds
let running = false;
let gameEnded = false;
let lastTime = 0;

// ---------- player (stickman on left) ----------
const player = {
  x: 110,
  y: innerHeight - 110,
  bodyColor: '#00ffcc',
  gunColor: '#88ce02',
  aimAngle: 0
};

// set initial player y responsive
player.y = innerHeight - 110;

// ---------- tuning ----------
const ARROW_SPEED = 1200; // px/sec
const ARROW_LENGTH = 34;
const ARROW_HEAD = 8;
const ZOMBIE_W = 44;
const ZOMBIE_H = 70;
const ZOMBIE_SPEED_MIN = 40;  // px/sec
const ZOMBIE_SPEED_MAX = 80;  // px/sec
const SPAWN_INTERVAL = 900;   // ms target between spawns (we use timer)
const HUD_BOX_W = 180;
const HUD_BOX_H = 74;

// ---------- spawn control ----------
let spawnTimer = 0;
function spawnZombie() {
  const y = Math.random() * (innerHeight - 220) + 110;
  const speed = -(ZOMBIE_SPEED_MIN + Math.random() * (ZOMBIE_SPEED_MAX - ZOMBIE_SPEED_MIN)); // leftwards negative
  zombies.push({
    x: innerWidth + 40,
    y,
    w: ZOMBIE_W,
    h: ZOMBIE_H,
    speed,
    alive: true
  });
}

// ensure a few on start
for (let i = 0; i < 5; i++) spawnZombie();

// ---------- input (aim & shoot) ----------
let pointerY = player.y;
let pointerX = player.x + 200; // initial aim right
function updateAimFromPointer(px, py) {
  pointerX = px; pointerY = py;
  const dx = px - player.x;
  const dy = py - (player.y - 40); // aim from approx gun muzzle
  player.aimAngle = Math.atan2(dy, dx);
}

// mouse
window.addEventListener('mousemove', e => {
  updateAimFromPointer(e.clientX, e.clientY);
});
canvas.addEventListener('click', e => {
  if (gameEnded) { resetGame(); return; }
  updateAimFromPointer(e.clientX, e.clientY);
  shootArrow();
});

// touch (mobile) - aim & tap to shoot / restart
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  updateAimFromPointer(t.clientX, t.clientY);
  if (gameEnded) { resetGame(); return; }
  shootArrow();
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const t = e.touches[0];
  if (!t) return;
  updateAimFromPointer(t.clientX, t.clientY);
}, { passive: false });

// spacebar for shoot or restart
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    e.preventDefault();
    if (gameEnded) resetGame();
    else shootArrow();
  }
});

// ---------- shooting ----------
function shootArrow() {
  const muzzleX = player.x + 28;
  const muzzleY = player.y - 40; // approximate muzzle
  const angle = player.aimAngle;
  arrows.push({
    x: muzzleX + Math.cos(angle) * 10,
    y: muzzleY + Math.sin(angle) * 10,
    angle,
    speed: ARROW_SPEED,
    alive: true
  });
}

// ---------- drawing helpers ----------
function drawBackground() {
  // sky gradient
  const g = ctx.createLinearGradient(0, 0, 0, innerHeight);
  g.addColorStop(0, '#071428'); // dark sky
  g.addColorStop(0.7, '#081218');
  g.addColorStop(1, '#041012'); // near ground
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, innerWidth, innerHeight);

  // ground strip
  ctx.fillStyle = '#0b2b12';
  ctx.fillRect(0, innerHeight - 80, innerWidth, 80);
}

function drawStickmanAndGun() {
  // head
  ctx.strokeStyle = player.bodyColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(player.x, player.y - 90, 12, 0, Math.PI * 2);
  ctx.stroke();

  // body
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 78);
  ctx.lineTo(player.x, player.y - 40);
  ctx.stroke();

  // arms
  ctx.beginPath();
  ctx.moveTo(player.x - 18, player.y - 66);
  ctx.lineTo(player.x + 18, player.y - 66);
  ctx.stroke();

  // legs
  ctx.beginPath();
  ctx.moveTo(player.x, player.y - 40);
  ctx.lineTo(player.x - 14, player.y - 8);
  ctx.moveTo(player.x, player.y - 40);
  ctx.lineTo(player.x + 14, player.y - 8);
  ctx.stroke();

  // gun (rectangle rotated toward aim)
  const gunX = player.x + 8;
  const gunY = player.y - 64;
  ctx.save();
  ctx.translate(gunX, gunY);
  ctx.rotate(player.aimAngle);
  ctx.fillStyle = player.gunColor;
  ctx.fillRect(0, -6, 44, 12); // gun body
  ctx.fillStyle = '#003300';
  ctx.fillRect(34, -3, 10, 6); // muzzle
  ctx.restore();
}

function drawArrow(arrow) {
  const x = arrow.x;
  const y = arrow.y;
  const a = arrow.angle;
  const len = ARROW_LENGTH;

  // shaft
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  ctx.stroke();

  // head
  ctx.fillStyle = '#ffb703';
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
  ctx.lineTo(x + Math.cos(a + 0.28) * (len - ARROW_HEAD), y + Math.sin(a + 0.28) * (len - ARROW_HEAD));
  ctx.lineTo(x + Math.cos(a - 0.28) * (len - ARROW_HEAD), y + Math.sin(a - 0.28) * (len - ARROW_HEAD));
  ctx.closePath();
  ctx.fill();
}

// zombie draw
function drawZombie(z) {
  ctx.fillStyle = '#6bbf4a';
  ctx.fillRect(z.x - z.w/2, z.y - z.h/2, z.w, z.h);
  // simple eye
  ctx.fillStyle = '#fff';
  ctx.fillRect(z.x - 10, z.y - 30, 6, 6);
  ctx.fillStyle = '#000';
  ctx.fillRect(z.x - 8, z.y - 28, 2, 2);

  // hp indicator (simple)
  if (z.hp !== undefined) {
    const hpW = 36;
    const hpPct = Math.max(0, z.hp / z.maxHp);
    ctx.fillStyle = '#222';
    ctx.fillRect(z.x - hpW/2, z.y - z.h/2 - 12, hpW, 6);
    ctx.fillStyle = '#ff385c';
    ctx.fillRect(z.x - hpW/2, z.y - z.h/2 - 12, hpW * hpPct, 6);
  }
}

// ---------- collision ----------
function arrowHitsZombie(arrow, z) {
  // approximate arrow tip point for collision
  const tipX = arrow.x + Math.cos(arrow.angle) * ARROW_LENGTH;
  const tipY = arrow.y + Math.sin(arrow.angle) * ARROW_LENGTH;
  // zombie box
  const zx = z.x - z.w/2;
  const zy = z.y - z.h/2;
  return tipX >= zx && tipX <= zx + z.w && tipY >= zy && tipY <= zy + z.h;
}

// ---------- update loop ----------
function updateAndRender(now) {
  if (!running) return;
  const dt = Math.min(40, now - lastTime); // cap dt ~40ms to avoid big jumps
  lastTime = now;

  // spawn timer (frame-independent)
  spawnTimer += dt;
  if (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    spawnZombie();
  }

  // update time
  timeLeft -= dt / 1000;
  if (timeLeft <= 0) {
    timeLeft = 0;
    endGame('⏰ Time’s up — Tap or press SPACE to restart');
  }

  // move arrows
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.x += Math.cos(a.angle) * a.speed * (dt / 1000);
    a.y += Math.sin(a.angle) * a.speed * (dt / 1000);
    // remove off-screen
    if (a.x < -50 || a.x > innerWidth + 50 || a.y < -50 || a.y > innerHeight + 50) {
      arrows.splice(i, 1);
    }
  }

  // move zombies and collisions
  for (let zi = zombies.length - 1; zi >= 0; zi--) {
    const z = zombies[zi];
    if (!z.alive) { zombies.splice(zi, 1); continue; }
    z.x += z.speed * (dt / 1000);

    // check reach player -> game over
    if (z.x - z.w/2 <= player.x + 12) {
      endGame('💀 Eaten! Tap or press SPACE to restart');
      return;
    }

    // arrows collision
    for (let ai = arrows.length - 1; ai >= 0; ai--) {
      const a = arrows[ai];
      if (arrowHitsZombie(a, z)) {
        // hit
        arrows.splice(ai, 1);
        // if zombie has hp (multi-hit) else kill
        if (z.hp !== undefined) {
          z.hp -= 1;
          if (z.hp <= 0) {
            z.alive = false;
            score++;
            killsSinceBonus++;
          }
        } else {
          z.alive = false;
          score++;
          killsSinceBonus++;
        }
        // bonus time every 2 kills
        if (killsSinceBonus >= 2) {
          timeLeft += 10; // +10s
          killsSinceBonus = 0;
        }
        break; // stop checking arrows for this zombie
      }
    }

    // if zombie offscreen to left anyway, remove and spawn replacement
    if (z.x < -100) {
      zombies.splice(zi, 1);
    }
  }

  // ensure there are always zombies: keep a baseline of 5 active
  if (zombies.length < 5) {
    spawnZombie();
  }

  // ---------- render ----------
  // background & ground
  drawBackground();

  // draw arrows
  arrows.forEach(a => drawArrow(a));

  // draw zombies
  zombies.forEach(z => drawZombie(z));

  // draw player (stickman + gun)
  drawStickmanAndGun();

  // HUD (top-left)
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(18, 18, HUD_BOX_W, HUD_BOX_H);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillStyle = '#00ffcc';
  ctx.fillText('Score: ' + score, 34, 46);
  ctx.fillText('Time: ' + Math.max(0, Math.ceil(timeLeft)) + 's', 34, 70);
  ctx.restore();

  if (running) requestAnimationFrame(updateAndRender);
}

// ---------- end / restart ----------
function endGame(message) {
  running = false;
  gameEnded = true;
  // show simple overlay text on canvas center
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, innerHeight/2 - 60, innerWidth, 120);
  ctx.fillStyle = '#ffdd88';
  ctx.font = '26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, innerWidth/2, innerHeight/2);
  ctx.textAlign = 'start';
  ctx.restore();
}

// allow restart
function resetGame() {
  arrows.length = 0;
  zombies.length = 0;
  score = 0;
  killsSinceBonus = 0;
  timeLeft = 100;
  spawnTimer = 0;
  lastTime = performance.now();
  gameEnded = false;
  running = true;
  // reposition player y in case of resize
  player.y = innerHeight - 110;
  // pre-spawn some zombies
  for (let i = 0; i < 5; i++) spawnZombie();
  requestAnimationFrame(updateAndRender);
}

// ---------- start ----------
resetGame();

// Helpful console note
console.log('Game started. Aim with mouse/touch. Tap/click or press Space to shoot. Tap/Space to restart after timeout.');