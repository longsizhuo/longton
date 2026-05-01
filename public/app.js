import { World, sanitizeRule, CHUNK_INFO, DIR_ARROWS, DIR_NAMES } from './engine.js';

const TURN_LABEL = { L: '左转 90°', R: '右转 90°', F: '直走', U: '调头 180°' };

const RULE_PRESETS = [
  { rule: 'RL', desc: '经典 Langton — 10000 步进入高速公路' },
  { rule: 'LLRR', desc: '完美对称的方形生长 ✨' },
  { rule: 'LRRRRRLLR', desc: '增长的方块，像有机体' },
  { rule: 'RRLL', desc: '双向高速' },
  { rule: 'LRRL', desc: '螺旋' },
  { rule: 'LLRRRLRLRLLR', desc: '复杂混沌' },
];

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const world = new World('RL');
world.addAnt(0, 0, 0);

let viewX = 0;
let viewY = 0;
let cellPx = 6;
let running = false;
let stepsPerFrame = 10;
let palette = makePalette(world.numColors);

function makePalette(n) {
  if (n === 2) return [null, '#e6edf3'];
  const out = [null];
  for (let i = 1; i < n; i++) {
    const hue = Math.round(((i - 1) * 360) / (n - 1));
    out.push(`hsl(${hue}, 70%, 65%)`);
  }
  return out;
}

function updateStats() {
  document.getElementById('stat-steps').textContent = world.steps.toLocaleString();
  document.getElementById('stat-ants').textContent = world.ants.length.toString();
  document.getElementById('stat-filled').textContent = world.filledCount.toLocaleString();
  document.getElementById('rule-display').textContent = world.rule;
  const preset = RULE_PRESETS.find(p => p.rule === world.rule);
  document.getElementById('rule-desc').textContent = preset
    ? preset.desc
    : `自定义规则 · ${world.numColors} 种颜色`;
}

function refresh() {
  updateStats();
  draw();
  if (debugVisible) updateDebug();
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

  // Draw cells, batched per color to minimize fillStyle changes.
  const buckets = new Array(palette.length);
  for (let i = 1; i < palette.length; i++) buckets[i] = [];
  for (const [x, y, c] of world.visibleCells(xMin, xMax, yMin, yMax)) {
    const sx = (x - viewX) * cellPx + w / 2;
    const sy = (y - viewY) * cellPx + h / 2;
    buckets[c]?.push(sx, sy);
  }
  for (let c = 1; c < palette.length; c++) {
    const list = buckets[c];
    if (!list || list.length === 0) continue;
    ctx.fillStyle = palette[c];
    for (let i = 0; i < list.length; i += 2) {
      ctx.fillRect(list[i], list[i + 1], cellPx, cellPx);
    }
  }

  // Draw ants on top.
  for (const ant of world.ants) {
    const ax = (ant.x - viewX) * cellPx + w / 2;
    const ay = (ant.y - viewY) * cellPx + h / 2;
    ctx.fillStyle = ant.color;
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
}

function loop() {
  if (running) {
    world.stepN(stepsPerFrame);
    if (world.ants.length > 0) {
      const lead = world.ants[0];
      const rect = canvas.getBoundingClientRect();
      const halfW = rect.width / 2 / cellPx;
      const halfH = rect.height / 2 / cellPx;
      if (Math.abs(lead.x - viewX) > halfW * 0.7 ||
          Math.abs(lead.y - viewY) > halfH * 0.7) {
        viewX = lead.x + 0.5;
        viewY = lead.y + 0.5;
      }
    }
    updateStats();
    draw();
    if (debugVisible) updateDebug();
  }
  requestAnimationFrame(loop);
}

let debugVisible = false;
let debugFrameCounter = 0;
const debugPanel = document.getElementById('debug-panel');
const chunkCanvas = document.getElementById('chunk-canvas');
const chunkCtx = chunkCanvas.getContext('2d');

function highlightSpan(id, text) {
  const el = document.getElementById(id);
  if (el.textContent !== text) el.textContent = text;
}

function updateDebug() {
  // Throttle expensive parts: text every frame is fine, chunk canvas every ~6 frames.
  const info = world.getDebugInfo(0);
  if (!info) return;

  const { ant, cell, next } = info;

  highlightSpan('dbg-x', ant.x);
  highlightSpan('dbg-y', ant.y);
  highlightSpan('dbg-dir', `${DIR_ARROWS[ant.dir]} ${DIR_NAMES[ant.dir]}`);
  highlightSpan('dbg-color', cell.color);
  document.getElementById('dbg-swatch').style.background =
    cell.color === 0 ? 'transparent' : palette[cell.color] || '#444';

  highlightSpan('dbg-rule-idx', cell.color);
  highlightSpan('dbg-rule', world.rule);
  highlightSpan('dbg-action', `${next.ruleChar} (${TURN_LABEL[next.ruleChar]})`);
  highlightSpan('dbg-next-dir', `${DIR_ARROWS[next.dir]} ${DIR_NAMES[next.dir]}`);
  highlightSpan('dbg-next-pos', `(${next.x}, ${next.y})`);
  highlightSpan('dbg-next-color', `${cell.color} → ${next.color}`);

  highlightSpan('dbg-wx', ant.x);
  highlightSpan('dbg-wy', ant.y);
  highlightSpan('dbg-cx', cell.cx);
  highlightSpan('dbg-cy', cell.cy);
  highlightSpan('dbg-lx', cell.lx);
  highlightSpan('dbg-ly', cell.ly);
  highlightSpan('dbg-idx', cell.idx);
  highlightSpan('dbg-idx2', cell.idx);
  highlightSpan('dbg-byte', cell.color);

  const mem = world.memoryStats;
  highlightSpan('dbg-chunks', mem.chunks);
  highlightSpan('dbg-bytes', mem.bytes.toLocaleString());

  if ((debugFrameCounter++ & 7) === 0) {
    drawChunkCanvas(cell.chunk, cell.lx, cell.ly);
  }
}

function drawChunkCanvas(chunk, antLx, antLy) {
  const size = CHUNK_INFO.size;
  const px = chunkCanvas.width / size;
  chunkCtx.fillStyle = '#0d1117';
  chunkCtx.fillRect(0, 0, chunkCanvas.width, chunkCanvas.height);

  if (chunk) {
    for (let i = 0; i < CHUNK_INFO.area; i++) {
      const c = chunk[i];
      if (c === 0) continue;
      const lx = i & CHUNK_INFO.mask;
      const ly = i >> CHUNK_INFO.shift;
      chunkCtx.fillStyle = palette[c] || '#888';
      chunkCtx.fillRect(lx * px, ly * px, px, px);
    }
  }

  chunkCtx.strokeStyle = '#ff5d5d';
  chunkCtx.lineWidth = 2;
  chunkCtx.strokeRect(antLx * px - 1, antLy * px - 1, px + 2, px + 2);
}

function fitToAnt() {
  if (world.ants.length === 0) return;
  const a = world.ants[0];
  viewX = a.x + 0.5;
  viewY = a.y + 0.5;
  draw();
}

function applyRule(rule) {
  const sane = sanitizeRule(rule);
  running = false;
  document.getElementById('btn-play').textContent = '▶ 播放';
  world.reset(sane);
  world.addAnt(0, 0, 0);
  palette = makePalette(world.numColors);
  viewX = 0;
  viewY = 0;
  document.getElementById('rule-input').value = sane;
  refresh();
}

const btnPlay = document.getElementById('btn-play');
btnPlay.addEventListener('click', () => {
  running = !running;
  btnPlay.textContent = running ? '⏸ 暂停' : '▶ 播放';
});
document.getElementById('btn-step').addEventListener('click', () => {
  world.step();
  refresh();
});
document.getElementById('btn-reset').addEventListener('click', () => {
  applyRule(world.rule);
});
document.getElementById('btn-fit').addEventListener('click', fitToAnt);

const btnDebug = document.getElementById('btn-debug');
btnDebug.addEventListener('click', () => {
  debugVisible = !debugVisible;
  debugPanel.hidden = !debugVisible;
  btnDebug.textContent = debugVisible ? '🔍 关闭调试' : '🔍 调试面板';
  if (debugVisible) updateDebug();
});

const ruleInput = document.getElementById('rule-input');
const rulePreset = document.getElementById('rule-preset');
RULE_PRESETS.forEach(p => {
  const opt = document.createElement('option');
  opt.value = p.rule;
  opt.textContent = `${p.rule} — ${p.desc}`;
  rulePreset.appendChild(opt);
});
rulePreset.addEventListener('change', () => {
  if (rulePreset.value) applyRule(rulePreset.value);
});
document.getElementById('btn-apply-rule').addEventListener('click', () => {
  applyRule(ruleInput.value);
});
ruleInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') applyRule(ruleInput.value);
});

document.getElementById('btn-add-ant').addEventListener('click', () => {
  const offset = 30;
  const x = Math.floor((Math.random() - 0.5) * 2 * offset);
  const y = Math.floor((Math.random() - 0.5) * 2 * offset);
  const dir = Math.floor(Math.random() * 4);
  world.addAnt(x, y, dir);
  refresh();
});
document.getElementById('btn-clear-ants').addEventListener('click', () => {
  world.clearAnts();
  world.addAnt(0, 0, 0);
  refresh();
});

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
refresh();
loop();
