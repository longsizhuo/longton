import { LangtonsAnt } from './engine.js';

const PHASE_LABELS = {
  simple: { name: '混沌阶段 · 简单期', desc: '前 ~100 步：对称、有规律' },
  chaotic: { name: '伪随机阶段', desc: '看起来杂乱无章，没有可见模式' },
  highway: { name: '高速公路阶段 🚗', desc: '涌现：每 104 步重复，向左下无限延伸' },
};

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const ant = new LangtonsAnt();
let viewX = 0;
let viewY = 0;
let cellPx = 6;
let running = false;
let stepsPerFrame = 10;

function updateStats() {
  document.getElementById('stat-steps').textContent = ant.steps.toLocaleString();
  document.getElementById('stat-black').textContent = ant.blackCount.toLocaleString();
  const label = PHASE_LABELS[ant.phase];
  document.getElementById('phase-name').textContent = label.name;
  document.getElementById('phase-desc').textContent = label.desc;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function draw() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, w, h);

  const halfW = w / 2 / cellPx;
  const halfH = h / 2 / cellPx;
  const xMin = Math.floor(viewX - halfW) - 1;
  const xMax = Math.ceil(viewX + halfW) + 1;
  const yMin = Math.floor(viewY - halfH) - 1;
  const yMax = Math.ceil(viewY + halfH) + 1;

  if (cellPx >= 6) {
    ctx.strokeStyle = '#161b22';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = xMin; x <= xMax; x++) {
      const sx = (x - viewX) * cellPx + w / 2;
      ctx.moveTo(sx, 0); ctx.lineTo(sx, h);
    }
    for (let y = yMin; y <= yMax; y++) {
      const sy = (y - viewY) * cellPx + h / 2;
      ctx.moveTo(0, sy); ctx.lineTo(w, sy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = '#e6edf3';
  for (const [x, y] of ant.visibleCells(xMin, xMax, yMin, yMax)) {
    const sx = (x - viewX) * cellPx + w / 2;
    const sy = (y - viewY) * cellPx + h / 2;
    ctx.fillRect(sx, sy, cellPx, cellPx);
  }

  const ax = (ant.x - viewX) * cellPx + w / 2;
  const ay = (ant.y - viewY) * cellPx + h / 2;
  ctx.fillStyle = '#ff5d5d';
  ctx.fillRect(ax, ay, cellPx, cellPx);

  if (cellPx >= 4) {
    const cx = ax + cellPx / 2;
    const cy = ay + cellPx / 2;
    const r = cellPx * 0.35;
    const angle = ant.dir * Math.PI / 2 - Math.PI / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
    ctx.lineTo(cx + Math.cos(angle + 2.4) * r * 0.6, cy + Math.sin(angle + 2.4) * r * 0.6);
    ctx.lineTo(cx + Math.cos(angle - 2.4) * r * 0.6, cy + Math.sin(angle - 2.4) * r * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

function loop() {
  if (running) {
    ant.stepN(stepsPerFrame);
    const rect = canvas.getBoundingClientRect();
    const halfW = rect.width / 2 / cellPx;
    const halfH = rect.height / 2 / cellPx;
    if (Math.abs(ant.x - viewX) > halfW * 0.7 ||
        Math.abs(ant.y - viewY) > halfH * 0.7) {
      viewX = ant.x + 0.5;
      viewY = ant.y + 0.5;
    }
    updateStats();
    draw();
  }
  requestAnimationFrame(loop);
}

function fitToAnt() {
  viewX = ant.x + 0.5;
  viewY = ant.y + 0.5;
  draw();
}

const btnPlay = document.getElementById('btn-play');
btnPlay.addEventListener('click', () => {
  running = !running;
  btnPlay.textContent = running ? '⏸ 暂停' : '▶ 播放';
});
document.getElementById('btn-step').addEventListener('click', () => {
  ant.step();
  updateStats();
  draw();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  running = false;
  btnPlay.textContent = '▶ 播放';
  ant.reset();
  viewX = 0;
  viewY = 0;
  updateStats();
  draw();
});
document.getElementById('btn-fit').addEventListener('click', fitToAnt);

const speedInput = document.getElementById('speed');
const speedVal = document.getElementById('speed-val');
speedInput.addEventListener('input', () => {
  stepsPerFrame = +speedInput.value;
  speedVal.textContent = stepsPerFrame;
});

const zoomInput = document.getElementById('zoom');
const zoomVal = document.getElementById('zoom-val');
zoomInput.addEventListener('input', () => {
  cellPx = +zoomInput.value;
  zoomVal.textContent = cellPx;
  draw();
});

let dragging = false;
let dragStart = null;
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  dragStart = { x: e.clientX, y: e.clientY, vx: viewX, vy: viewY };
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = (e.clientX - dragStart.x) / cellPx;
  const dy = (e.clientY - dragStart.y) / cellPx;
  viewX = dragStart.vx - dx;
  viewY = dragStart.vy - dy;
  draw();
});
window.addEventListener('mouseup', () => { dragging = false; });

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -1 : 1;
  const next = Math.max(1, Math.min(20, cellPx + delta));
  if (next !== cellPx) {
    cellPx = next;
    zoomInput.value = cellPx;
    zoomVal.textContent = cellPx;
    draw();
  }
}, { passive: false });

window.addEventListener('resize', () => {
  resizeCanvas();
  draw();
});

cellPx = +zoomInput.value;
resizeCanvas();
updateStats();
draw();
loop();
