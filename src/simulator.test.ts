import test from 'node:test';
import assert from 'node:assert/strict';

// Parity matrix P (6x6)
const P_MATRIX = [
  [1, 1, 0, 1, 0, 0],
  [0, 1, 1, 0, 1, 0],
  [0, 0, 1, 1, 0, 1],
  [1, 0, 0, 1, 1, 0],
  [0, 1, 0, 0, 1, 1],
  [1, 0, 1, 0, 0, 1]
];

// Systematic parity bit calculation
function computeParityBits(u: number[]): number[] {
  const p: number[] = [];
  for (let r = 0; r < 6; r++) {
    let sum = 0;
    for (let c = 0; c < 6; c++) {
      sum ^= (P_MATRIX[r][c] & u[c]);
    }
    p.push(sum);
  }
  return p;
}

// Full H matrix: [P | I_6]
function computeSyndrome(c: number[]): number[] {
  const s: number[] = [];
  for (let r = 0; r < 6; r++) {
    let sum = 0;
    // P part (first 6 columns)
    for (let j = 0; j < 6; j++) {
      sum ^= (P_MATRIX[r][j] & c[j]);
    }
    // I part (identity at column 6 + r)
    sum ^= (1 & c[6 + r]);
    s.push(sum);
  }
  return s;
}

// BPSK symbol mapping
function bpskModulate(bit: number): number {
  return bit === 0 ? 1.0 : -1.0;
}

function bpskDemodulate(sample: number): number {
  return sample >= 0 ? 0 : 1;
}

// Adaptive cluster head scoring
function calculateClusterScore(resEnergy: number, maxEnergy: number, distBS: number, maxDist: number, wE = 0.6): number {
  const normE = Math.min(1.0, resEnergy / maxEnergy);
  const normDist = Math.max(0, 1 - (distBS / maxDist));
  return +(wE * normE + (1 - wE) * normDist).toFixed(3);
}

test('Systematic LDPC parity calculation produces valid codeword satisfying H*c^T = 0', () => {
  const testVectors = [
    [1, 0, 1, 0, 0, 1],
    [0, 1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0]
  ];

  for (const u of testVectors) {
    const p = computeParityBits(u);
    const c = [...u, ...p];
    const syndrome = computeSyndrome(c);
    assert.deepEqual(syndrome, [0, 0, 0, 0, 0, 0], `Syndrome must be all zero for valid codeword: ${c}`);
  }
});

test('Syndrome detects single bit errors in codeword', () => {
  const u = [1, 0, 1, 0, 0, 1];
  const p = computeParityBits(u);
  const c = [...u, ...p];

  // Flip bit at index 2
  const corrupted = [...c];
  corrupted[2] ^= 1;

  const syndrome = computeSyndrome(corrupted);
  assert.equal(syndrome.some(s => s !== 0), true, 'Syndrome must detect error');
});

test('BPSK antipodal modulation and decision threshold', () => {
  assert.equal(bpskModulate(0), 1.0);
  assert.equal(bpskModulate(1), -1.0);
  assert.equal(bpskDemodulate(0.85), 0);
  assert.equal(bpskDemodulate(-0.42), 1);
  assert.equal(bpskDemodulate(0.0), 0);
});

test('Adaptive cluster score properly weights energy and distance', () => {
  const highEnergyClose = calculateClusterScore(1.0, 1.0, 50, 500, 0.6);
  const lowEnergyFar = calculateClusterScore(0.3, 1.0, 450, 500, 0.6);
  assert.ok(highEnergyClose > lowEnergyFar, 'High energy close node must score higher than low energy far node');
});
