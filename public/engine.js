const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// Turn amount in steps of 90° clockwise.
const TURN = { L: 3, R: 1, F: 0, U: 2 };

// Each chunk is a 64x64 patch of cells stored as a flat Uint8Array(4096).
const CHUNK_SIZE = 64;
const CHUNK_SHIFT = 6;
const CHUNK_MASK = 63;
const ORIGIN = 1 << 15;

export const ANT_COLORS = [
  '#ff5d5d', '#5d9eff', '#5dff8e', '#ffd55d',
  '#d55dff', '#5dffe6', '#ffa05d', '#a0ff5d',
];

export function packKey(x, y) {
  return (x + ORIGIN) * 0x10000 + (y + ORIGIN);
}

export function sanitizeRule(rule) {
  const cleaned = (rule || '').toUpperCase().replace(/[^LRFU]/g, '');
  return cleaned.length >= 2 ? cleaned : 'RL';
}

export class Ant {
  constructor(x, y, dir, color) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.color = color;
  }
}

export class World {
  constructor(rule = 'RL') {
    this.setRule(rule);
    this.chunks = new Map();
    this.ants = [];
    this.steps = 0;
    this.filledCount = 0;
  }

  setRule(rule) {
    this.rule = sanitizeRule(rule);
    this.numColors = this.rule.length;
  }

  // Reset grid and ants. If rule is given, also switch rule.
  reset(rule) {
    if (rule !== undefined) this.setRule(rule);
    this.chunks = new Map();
    this.ants = [];
    this.steps = 0;
    this.filledCount = 0;
  }

  addAnt(x = 0, y = 0, dir = 0) {
    const color = ANT_COLORS[this.ants.length % ANT_COLORS.length];
    this.ants.push(new Ant(x, y, dir, color));
  }

  clearAnts() {
    this.ants = [];
  }

  getCell(x, y) {
    const chunk = this.chunks.get(packKey(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT));
    if (!chunk) return 0;
    return chunk[(y & CHUNK_MASK) * CHUNK_SIZE + (x & CHUNK_MASK)];
  }

  setCell(x, y, color) {
    const chunkId = packKey(x >> CHUNK_SHIFT, y >> CHUNK_SHIFT);
    let chunk = this.chunks.get(chunkId);
    if (!chunk) {
      if (color === 0) return;
      chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
      this.chunks.set(chunkId, chunk);
    }
    const idx = (y & CHUNK_MASK) * CHUNK_SIZE + (x & CHUNK_MASK);
    const old = chunk[idx];
    if (old === color) return;
    chunk[idx] = color;
    if (old === 0) this.filledCount++;
    else if (color === 0) this.filledCount--;
  }

  // Snapshot synchronous update:
  //   1. read phase: every ant reads cell color and decides its move
  //      based on the current grid (no mutation yet)
  //   2. write phase: apply cell color updates (idempotent — multiple
  //      ants on the same starting cell decide the same new color)
  //   3. move phase: apply ant position + heading updates
  step() {
    if (this.ants.length === 0) return;

    const decisions = new Array(this.ants.length);
    for (let i = 0; i < this.ants.length; i++) {
      const ant = this.ants[i];
      const c = this.getCell(ant.x, ant.y);
      const turnChar = this.rule[c % this.numColors];
      const turnAmount = TURN[turnChar];
      const newDir = (ant.dir + turnAmount) % 4;
      decisions[i] = {
        ant,
        cellX: ant.x,
        cellY: ant.y,
        newColor: (c + 1) % this.numColors,
        newDir,
        newX: ant.x + DX[newDir],
        newY: ant.y + DY[newDir],
      };
    }

    for (const d of decisions) {
      this.setCell(d.cellX, d.cellY, d.newColor);
    }

    for (const d of decisions) {
      d.ant.x = d.newX;
      d.ant.y = d.newY;
      d.ant.dir = d.newDir;
    }

    this.steps++;
  }

  stepN(n) {
    for (let i = 0; i < n; i++) this.step();
  }

  *visibleCells(xMin, xMax, yMin, yMax) {
    const cx0 = xMin >> CHUNK_SHIFT;
    const cx1 = xMax >> CHUNK_SHIFT;
    const cy0 = yMin >> CHUNK_SHIFT;
    const cy1 = yMax >> CHUNK_SHIFT;
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = this.chunks.get(packKey(cx, cy));
        if (!chunk) continue;
        const baseX = cx * CHUNK_SIZE;
        const baseY = cy * CHUNK_SIZE;
        for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) {
          const c = chunk[i];
          if (c === 0) continue;
          const x = baseX + (i & CHUNK_MASK);
          const y = baseY + (i >> CHUNK_SHIFT);
          if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
            yield [x, y, c];
          }
        }
      }
    }
  }
}
