// Direction vectors: 0=N, 1=E, 2=S, 3=W
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

export const PHASE_BOUNDS = {
  simple: 100,
  chaotic: 10000,
};

export class LangtonsAnt {
  constructor() {
    this.reset();
  }

  reset() {
    this.cells = new Map();
    this.x = 0;
    this.y = 0;
    this.dir = 0;
    this.steps = 0;
    this.blackCount = 0;
  }

  step() {
    const k = this.x + ',' + this.y;
    const isBlack = this.cells.get(k) === 1;
    if (isBlack) {
      this.dir = (this.dir + 3) % 4;
      this.cells.delete(k);
      this.blackCount--;
    } else {
      this.dir = (this.dir + 1) % 4;
      this.cells.set(k, 1);
      this.blackCount++;
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
