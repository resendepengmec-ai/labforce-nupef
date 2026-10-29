// fft.js - FFT complexa para QUALQUER N (equivalente a fft() do Scilab).
// N potencia de 2: radix-2 iterativo. Outros N: algoritmo de Bluestein
// (chirp-z) sobre uma FFT radix-2 de tamanho >= 2N-1.
// Planos (twiddles, chirp) ficam em cache por N: janelas de mesmo tamanho
// (IEEE 519/1459) reaproveitam o plano.
// Convencao: X[k] = sum_n x[n] exp(-2 pi i k n / N)  (sem escala), como o Scilab.

const cachePlanos = new Map();

function ehPot2(n) { return n > 0 && (n & (n - 1)) === 0; }

function planoRadix2(n) {
  const nivel = Math.log2(n) | 0;
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0, x = i;
    for (let b = 0; b < nivel; b++) { r = (r << 1) | (x & 1); x >>= 1; }
    rev[i] = r >>> 0;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos(2 * Math.PI * i / n);
    sin[i] = Math.sin(2 * Math.PI * i / n);
  }
  return { tipo: "r2", n, rev, cos, sin };
}

// FFT radix-2 in-place (re, im). inversa = true -> expoente +i (sem escala).
function radix2(p, re, im, inversa) {
  const n = p.n, rev = p.rev, cs = p.cos, sn = p.sin;
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  const sg = inversa ? 1 : -1;
  for (let tam = 2; tam <= n; tam <<= 1) {
    const meio = tam >> 1, passo = n / tam;
    for (let i = 0; i < n; i += tam) {
      for (let j = 0, k = 0; j < meio; j++, k += passo) {
        const wr = cs[k], wi = sg * sn[k];
        const a = i + j, b = a + meio;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}

function planoBluestein(n) {
  let m = 1;
  while (m < 2 * n - 1) m <<= 1;
  const p2 = obterPlano(m);
  // chirp w[k] = exp(-i pi k^2 / n); k^2 mod 2n evita perda de precisao
  const wr = new Float64Array(n), wi = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const k2 = (k * k) % (2 * n);
    const ang = Math.PI * k2 / n;
    wr[k] = Math.cos(ang); wi[k] = -Math.sin(ang);
  }
  // B = FFT de conj(w) estendido simetricamente
  const br = new Float64Array(m), bi = new Float64Array(m);
  br[0] = wr[0]; bi[0] = -wi[0];
  for (let k = 1; k < n; k++) {
    br[k] = br[m - k] = wr[k];
    bi[k] = bi[m - k] = -wi[k];
  }
  radix2(p2, br, bi, false);
  return { tipo: "bl", n, m, p2, wr, wi, br, bi };
}

function obterPlano(n) {
  let p = cachePlanos.get(n);
  if (!p) {
    p = ehPot2(n) ? planoRadix2(n) : planoBluestein(n);
    cachePlanos.set(n, p);
  }
  return p;
}

// x: Float64Array real (ou {re, im}). Devolve {re, im} de tamanho N.
export function fft(x, xi) {
  const n = x.length;
  const p = obterPlano(n);
  if (p.tipo === "r2") {
    const re = Float64Array.from(x);
    const im = xi ? Float64Array.from(xi) : new Float64Array(n);
    radix2(p, re, im, false);
    return { re, im };
  }
  const m = p.m, ar = new Float64Array(m), ai = new Float64Array(m);
  for (let k = 0; k < n; k++) {
    const a = x[k], b = xi ? xi[k] : 0;
    ar[k] = a * p.wr[k] - b * p.wi[k];
    ai[k] = a * p.wi[k] + b * p.wr[k];
  }
  radix2(p.p2, ar, ai, false);
  for (let k = 0; k < m; k++) {
    const r = ar[k] * p.br[k] - ai[k] * p.bi[k];
    const i = ar[k] * p.bi[k] + ai[k] * p.br[k];
    ar[k] = r; ai[k] = i;
  }
  radix2(p.p2, ar, ai, true);
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    const r = ar[k] / m, i = ai[k] / m;
    re[k] = r * p.wr[k] - i * p.wi[k];
    im[k] = r * p.wi[k] + i * p.wr[k];
  }
  return { re, im };
}

export function limparCacheFFT() { cachePlanos.clear(); }
