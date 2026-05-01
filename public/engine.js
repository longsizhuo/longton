const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

// Each chunk is a 64x64 patch of cells stored as a flat Uint8Array(4096).
// 64 is a power of two (2^6), so we can use bit ops instead of /, %.
//   x >> 6  ≡ Math.floor(x / 64)   (works for negatives via two's complement)
//   x & 63  ≡ ((x % 64) + 64) % 64
const CHUNK_SIZE = 64;
const CHUNK_SHIFT = 6;
const CHUNK_MASK = 63;

const ORIGIN = 1 << 15;

export function packKey(x, y) {
  return (x + ORIGIN) * 0x10000 + (y + ORIGIN);
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
    this.chunks = new Map();   // chunkId -> Uint8Array(CHUNK_SIZE * CHUNK_SIZE)
    this.x = 0;
    this.y = 0;
    this.dir = 0;
    this.steps = 0;
    this.blackCount = 0;
  }

  step() {
    const cx = this.x >> CHUNK_SHIFT;
    const cy = this.y >> CHUNK_SHIFT;
    const idx = (this.y & CHUNK_MASK) * CHUNK_SIZE + (this.x & CHUNK_MASK);
    const chunkId = packKey(cx, cy);

    let chunk = this.chunks.get(chunkId);
    if (chunk && chunk[idx]) {
      this.dir = (this.dir + 3) % 4;
      chunk[idx] = 0;
      this.blackCount--;
    } else {
      this.dir = (this.dir + 1) % 4;
      if (!chunk) {
        chunk = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
        this.chunks.set(chunkId, chunk);
      }
      chunk[idx] = 1;
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

  // Iterate only the black cells that lie inside the given viewport rect.
  // Visits at most (cx1-cx0+1) * (cy1-cy0+1) chunks, regardless of total
  // black cell count anywhere else on the plane.
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
          if (!chunk[i]) continue;
          const x = baseX + (i & CHUNK_MASK);
          const y = baseY + (i >> CHUNK_SHIFT);
          if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
            yield [x, y];
          }
        }
      }
    }
  }
}
