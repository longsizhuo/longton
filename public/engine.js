const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// Coord offset to keep packed keys non-negative.
// World is bounded to [-32768, 32767] on each axis (plenty for any sane run).
const ORIGIN = 1 << 15;

// Pack 2D coords into one integer — avoids per-step string allocation
// that the old "x,y" key form caused.
export function packKey(x, y) {
  return (x + ORIGIN) * 0x10000 + (y + ORIGIN);
}

export function unpackKey(k) {
  return [Math.floor(k / 0x10000) - ORIGIN, (k % 0x10000) - ORIGIN];
}

export const PHASE_BOUNDS = {
  simple: 100,
  chaotic: 10000,
};

export class LangtonsAnt {
  constructor() {
    this.reset();
  }

  reset() {
    this.cells = new Set();
    this.x = 0;
    this.y = 0;
    this.dir = 0;
    this.steps = 0;
  }

  get blackCount() {
    return this.cells.size;
  }

  step() {
    const k = packKey(this.x, this.y);
    if (this.cells.has(k)) {
      this.dir = (this.dir + 3) % 4;
      this.cells.delete(k);
    } else {
      this.dir = (this.dir + 1) % 4;
      this.cells.add(k);
    }
    this.x += DX[this.dir];
    this.y += DY[this.dir];
    this.steps++;
  }

  stepN(n) {
    for (let i = 0; i < n; i++) this.step();
  }

  get phase() {
    if (this.steps < PHASE_BOUNDS.simple) return 'simple';
    if (this.steps < PHASE_BOUNDS.chaotic) return 'chaotic';
    return 'highway';
  }
}
