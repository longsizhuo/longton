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
    refresh();
  }
  requestAnimationFrame(loop);
}

let debugVisible = false;
const debugHandle = document.getElementById('debug-handle');
const bottomDebug = document.getElementById('bottom-debug');
const chunkCanvas = document.getElementById('chunk-canvas');
const chunkCtx = chunkCanvas.getContext('2d');
const tapeCanvas = document.getElementById('tape-canvas');
const tapeCtx = tapeCanvas.getContext('2d');
const ruleVizEl = document.getElementById('rule-viz');
let lastRuleRendered = '';

function highlightSpan(id, text) {
  const el = document.getElementById(id);
  const s = String(text);
  if (el.textContent !== s) el.textContent = s;
}

function updateRuleViz(activeColor) {
  if (lastRuleRendered !== world.rule) {
    ruleVizEl.innerHTML = '';
    for (let i = 0; i < world.rule.length; i++) {
      const box = document.createElement('span');
      box.className = 'rule-box';
      box.textContent = `${i}:${world.rule[i]}`;
      ruleVizEl.appendChild(box);
    }
    lastRuleRendered = world.rule;
  }
  const boxes = ruleVizEl.children;
  for (let i = 0; i < boxes.length; i++) {
    boxes[i].classList.toggle('active', i === activeColor);
  }
}

function updateDebug() {
  const info = world.getDebugInfo(0);
  if (!info) return;

  const { ant, cell, next } = info;

  highlightSpan('tape-x', ant.x);
  highlightSpan('tape-y', ant.y);
  highlightSpan('tape-dir', `${DIR_ARROWS[ant.dir]} ${DIR_NAMES[ant.dir]}`);
  highlightSpan('tape-cx', cell.cx);
  highlightSpan('tape-cy', cell.cy);
  highlightSpan('tape-idx', cell.idx);

  highlightSpan('dbg-color', cell.color);
  document.getElementById('dbg-swatch').style.background =
    cell.color === 0 ? 'transparent' : palette[cell.color] || '#444';

  highlightSpan('dbg-rule-idx', cell.color);
  highlightSpan('dbg-rule', world.rule);
  highlightSpan('dbg-action', `${next.ruleChar} (${TURN_LABEL[next.ruleChar]})`);
  highlightSpan('dbg-next-dir', `${DIR_ARROWS[next.dir]} ${DIR_NAMES[next.dir]}`);
  highlightSpan('dbg-next-pos', `(${next.x}, ${next.y})`);
  highlightSpan('dbg-next-color', `${cell.color} → ${next.color}`);

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

  updateRuleViz(cell.color);
  drawTape(cell.chunk, cell.idx);
  drawChunkCanvas(cell.chunk, cell.lx, cell.ly);
}

// 1D tape view of the chunk currently containing the lead ant.
// Pointer is fixed at center; the strip of bytes scrolls underneath.
// As the ant walks E/W in 2D the pointer slides smoothly; as it walks
// N/S the strip jumps by 64 cells (one row in the tile).
function drawTape(chunk, focusIdx) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = tapeCanvas.clientWidth;
  const cssH = tapeCanvas.clientHeight;
  if (tapeCanvas.width !== cssW * dpr || tapeCanvas.height !== cssH * dpr) {
    tapeCanvas.width = cssW * dpr;
    tapeCanvas.height = cssH * dpr;
    tapeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  tapeCtx.fillStyle = '#0d1117';
  tapeCtx.fillRect(0, 0, cssW, cssH);

  const boxW = 16;
  const boxH = 36;
  const boxY = 22;
  const cellsVisible = Math.floor(cssW / boxW);
  const halfVisible = Math.floor(cellsVisible / 2);
  const startIdx = focusIdx - halfVisible;
  const totalCells = CHUNK_INFO.area;

  for (let i = 0; i < cellsVisible; i++) {
    const idx = startIdx + i;
    const x = i * boxW;
    if (idx < 0 || idx >= totalCells) continue;

    const c = chunk ? chunk[idx] : 0;
    if (c === 0) {
      tapeCtx.fillStyle = '#161b22';
    } else {
      tapeCtx.fillStyle = palette[c] || '#888';
    }
    tapeCtx.fillRect(x + 1, boxY + 1, boxW - 2, boxH - 2);
    tapeCtx.strokeStyle = '#30363d';
    tapeCtx.lineWidth = 1;
    tapeCtx.strokeRect(x + 0.5, boxY + 0.5, boxW - 1, boxH - 1);
  }

  // Pointer (red triangle) above the focal cell at the center.
  const pointerX = halfVisible * boxW + boxW / 2;
  tapeCtx.fillStyle = '#ff5d5d';
  tapeCtx.beginPath();
  tapeCtx.moveTo(pointerX, boxY - 2);
  tapeCtx.lineTo(pointerX - 6, boxY - 12);
  tapeCtx.lineTo(pointerX + 6, boxY - 12);
  tapeCtx.closePath();
  tapeCtx.fill();
  // Highlight the focal cell's box border in red.
  tapeCtx.strokeStyle = '#ff5d5d';
  tapeCtx.lineWidth = 2;
  tapeCtx.strokeRect(halfVisible * boxW + 1, boxY + 1, boxW - 2, boxH - 2);

  // Index labels under the strip.
  tapeCtx.fillStyle = '#8b949e';
  tapeCtx.font = '10px "SF Mono", Menlo, monospace';
  tapeCtx.textAlign = 'center';
  tapeCtx.fillText(String(focusIdx), pointerX, boxY + boxH + 14);
  if (startIdx >= 0) {
    tapeCtx.textAlign = 'left';
    tapeCtx.fillText(String(startIdx), 2, boxY + boxH + 14);
  }
  const endIdx = startIdx + cellsVisible - 1;
  if (endIdx < totalCells) {
    tapeCtx.textAlign = 'right';
    tapeCtx.fillText(String(endIdx), cssW - 2, boxY + boxH + 14);
  }
}

// Draws the 64x64 chunk holding the lead ant. Cells are batched by color
// so we change fillStyle at most (numColors - 1) times per frame.
function drawChunkCanvas(chunk, antLx, antLy) {
  const size = CHUNK_INFO.size;
  const px = chunkCanvas.width / size;
  chunkCtx.fillStyle = '#0d1117';
  chunkCtx.fillRect(0, 0, chunkCanvas.width, chunkCanvas.height);

  if (chunk) {
    for (let c = 1; c < palette.length; c++) {
      let styled = false;
      for (let i = 0; i < CHUNK_INFO.area; i++) {
        if (chunk[i] !== c) continue;
        if (!styled) {
          chunkCtx.fillStyle = palette[c] || '#888';
          styled = true;
        }
        chunkCtx.fillRect((i & CHUNK_INFO.mask) * px, (i >> CHUNK_INFO.shift) * px, px, px);
      }
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
  bottomDebug.hidden = !debugVisible;
  debugHandle.hidden = !debugVisible;
  btnDebug.textContent = debugVisible ? '🔍 关闭调试' : '🔍 调试面板';
  btnDebug.classList.toggle('active', debugVisible);
  resizeCanvas();
  draw();
  if (debugVisible) updateDebug();
});

// Vertical drag handle: resize the bottom debug panel.
let resizing = false;
let resizeStartY = 0;
let resizeStartH = 0;
const MIN_DEBUG_H = 140;
debugHandle.addEventListener('mousedown', (e) => {
  resizing = true;
  resizeStartY = e.clientY;
  resizeStartH = bottomDebug.getBoundingClientRect().height;
  document.body.style.userSelect = 'none';
  e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!resizing) return;
  const dy = resizeStartY - e.clientY;
  const maxH = window.innerHeight - 160;
  const newH = Math.max(MIN_DEBUG_H, Math.min(maxH, resizeStartH + dy));
  document.documentElement.style.setProperty('--debug-h', newH + 'px');
  resizeCanvas();
  draw();
  if (debugVisible) drawTape(world.getDebugInfo(0)?.cell.chunk, world.getDebugInfo(0)?.cell.idx);
});
window.addEventListener('mouseup', () => {
  if (resizing) {
    resizing = false;
    document.body.style.userSelect = '';
  }
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
  if (debugVisible) updateDebug();
});

cellPx = +zoomInput.value;
resizeCanvas();
refresh();
loop();
