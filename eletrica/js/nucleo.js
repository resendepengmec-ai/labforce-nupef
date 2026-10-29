// nucleo.js - funcoes numericas de Potencias_Eletricas (porte de funcoesPotencia.sci v5.3.3)
// Indices em base 0 (no Scilab, base 1). Vetores: Float64Array.
import { fft } from "./fft.js";
import { sprintf } from "./formato.js";

// ---- avisos (equivale ao mprintf do Scilab dentro das funcoes) ------------
let saidaAviso = (s) => console.warn(s);
export function definirAviso(fn) { saidaAviso = fn; }
export function aviso(s) { saidaAviso(s); }

// round() do Scilab: metade para longe do zero (Math.round arredonda -2,5 -> -2)
export function rnd(x) { return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5); }

export function media(x, i0 = 0, i1 = x.length) {
  let s = 0;
  for (let i = i0; i < i1; i++) s += x[i];
  return s / (i1 - i0);
}

// Valor RMS ignorando NaN (Prof. ILDEU, IFG); <= 1 amostra valida -> NaN
export function valorRMS(x) {
  let s = 0, n = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    if (!Number.isNaN(v)) { s += v * v; n++; }
  }
  return n > 1 ? Math.sqrt(s / n) : NaN;
}

// Janela SINCRONA: ciclos da rede, o mais proximo de alvo, com numero inteiro
// de amostras. Empate de distancia: o menor (gsort estavel do Scilab).
export function ciclosSincronos(fs, fRede, alvo) {
  for (let d = 0; d < 4 * alvo; d++) {
    for (const m of [alvo - d, alvo + d]) {
      if (m < 1 || m > 4 * alvo || (d === 0 && m !== alvo)) continue;
      const x = m * fs / fRede;
      if (Math.abs(x - rnd(x)) < 0.01) return { m, Nw: rnd(x) };
      if (d === 0) break;
    }
  }
  const Nw = rnd(alvo * fs / fRede);
  aviso(sprintf("Aviso: sem janela sincrona para fs = %.6g Hz; usadas %d amostras (%.3f ciclos).",
    fs, Nw, Nw * fRede / fs));
  return { m: alvo, Nw };
}

// Media movel CENTRADA em numero inteiro de ciclos da rede (anula o ripple de 2f)
export function mediaMovelCiclos(x, fs, fRede, nCiclos, nPass = 1) {
  const N = x.length;
  let w = ciclosSincronos(fs, fRede, nCiclos).Nw;
  w = Math.max(1, Math.min(w, N));
  const h1 = Math.floor((w - 1) / 2), h2 = w - 1 - h1;
  let y = Float64Array.from(x);
  const cs = new Float64Array(N + 1);
  for (let p = 0; p < nPass; p++) {
    cs[0] = 0;
    for (let i = 0; i < N; i++) cs[i + 1] = cs[i] + y[i];
    const z = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.max(i - h1, 0), b = Math.min(i + h2, N - 1);
      z[i] = (cs[b + 1] - cs[a]) / (b - a + 1);
    }
    y = z;
  }
  return y;
}

// Janela de Hann (denominador N-1, como no Scilab)
function hann(N) {
  const w = new Float64Array(N);
  for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1));
  return w;
}

// Taxa REAL pela frequencia da rede: fsReal = fsNominal*fRede/fAparente
export function estimaFs(v, fsNominal, fRede) {
  const N = v.length, mv = media(v), w = hann(N);
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = (v[i] - mv) * w[i];
  const X = fft(x), L = Math.floor(N / 2);
  const A = new Float64Array(L);
  for (let i = 0; i < L; i++) A[i] = Math.hypot(X.re[i], X.im[i]);
  let k = 1;
  for (let i = 2; i < L; i++) if (A[i] > A[k]) k = i;   // ignora DC; primeiro maximo
  let d = 0;
  if (k > 0 && k < L - 1) d = 0.5 * (A[k - 1] - A[k + 1]) / (A[k - 1] - 2 * A[k] + A[k + 1]);
  const fAparente = (k + d) * fsNominal / N;
  return fsNominal * fRede / fAparente;
}

// Valor redondo mais proximo de fsBruta, do mais redondo ao menos redondo
export function arredondaFs(fsBruta, tol) {
  const escada = [[100, 1], [50, 1], [25, 1], [10, 1], [100, 2], [5, 1], [10, 2], [1, 1]];
  for (const [p, tipo] of escada) {
    let c, r;
    if (tipo === 1) { c = p * rnd(fsBruta / p); r = sprintf("multiplo de %d Hz", p); }
    else { c = 1e6 / (p * rnd(1e6 / fsBruta / p)); r = sprintf("periodo multiplo de %d us", p); }
    if (c > 0 && Math.abs(c - fsBruta) / fsBruta <= tol) return { fs: c, regra: r };
  }
  return { fs: fsBruta, regra: "" };
}

// Detecta fs pela rede, sem lista de taxas. varFs = dispersao em blocos de ~10 s [%]
export function detectaFs(v, fRede, tol = 0.003) {
  const fsBruta = estimaFs(v, 1, fRede);
  const { fs, regra } = arredondaFs(fsBruta, tol);
  const nb = rnd(10 * fsBruta), nBl = Math.floor(v.length / nb);
  let varFs = 0;
  if (nBl >= 2) {
    const fb = [];
    for (let j = 0; j < nBl; j++) fb.push(estimaFs(v.subarray(j * nb, (j + 1) * nb), 1, fRede));
    varFs = 100 * (Math.max(...fb) - Math.min(...fb)) / (fb.reduce((a, b) => a + b, 0) / nBl);
  }
  return { fs, fsBruta, varFs, regra };
}

// Tempo [s] -> indice valido 0..N-1 (t[0] = 0)
export function tempo2indice(tc, fs, N) { return Math.min(Math.max(rnd(tc * fs), 0), N - 1); }

// Grandezas de uma janela (V e A)
export function grandezasEletricas(Va, Vb, Vc, Ia, Ib, Ic) {
  const Vrms = [valorRMS(Va), valorRMS(Vb), valorRMS(Vc)];
  const Irms = [valorRMS(Ia), valorRMS(Ib), valorRMS(Ic)];
  const Ief = Math.sqrt((Irms[0] ** 2 + Irms[1] ** 2 + Irms[2] ** 2) / 3);
  const St = Vrms[0] * Irms[0] + Vrms[1] * Irms[1] + Vrms[2] * Irms[2];
  const Pf = [[Va, Ia], [Vb, Ib], [Vc, Ic]].map(([v, i]) => {
    let s = 0; for (let n = 0; n < v.length; n++) s += v[n] * i[n]; return s / v.length;
  });
  const Pt = Pf[0] + Pf[1] + Pf[2];
  const FP = Pt / St;
  const Fi = Math.acos(Math.min(Math.max(FP, -1), 1)) * 180 / Math.PI;
  return { Vrms, Irms, Ief, St, Pf, Pt, FP, Fi };
}

// Espectro de amplitude (Hann) e fundamental. kRef: raia (base 0) de outro sinal.
export function espectroFFT(xin, fs, fRede, kRef) {
  const N = xin.length;
  if (N < 2 * fs / fRede) throw new Error("espectroFFT: janela menor que 2 ciclos.");
  if (1.1 * fRede >= fs / 2) throw new Error("espectroFFT: fs insuficiente para fRede.");
  const mx = media(xin), w = hann(N);
  let sw = 0, sw2 = 0;
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) { x[i] = (xin[i] - mx) * w[i]; sw += w[i]; sw2 += w[i] * w[i]; }
  const X = fft(x), M = Math.floor(N / 2) + 1;
  const A = new Float64Array(M), f = new Float64Array(M);
  for (let i = 0; i < M; i++) { A[i] = 2 * Math.hypot(X.re[i], X.im[i]) / sw; f[i] = i * fs / N; }
  A[0] /= 2;
  let k = -1;
  for (let i = 0; i < M; i++) {
    if (f[i] > 0.9 * fRede && f[i] < 1.1 * fRede && (k < 0 || A[i] > A[k])) k = i;
  }
  let d = 0;
  if (k > 0 && k < M - 1) {
    if (A[k + 1] >= A[k - 1]) { const a = A[k + 1] / A[k]; d = (2 * a - 1) / (a + 1); }
    else { const a = A[k - 1] / A[k]; d = -(2 * a - 1) / (a + 1); }
  }
  const enbw = N * sw2 / (sw * sw);
  const lim = Math.max(0.5, 3 * fs / N);
  let s = 0;
  for (let i = 0; i < M; i++) if (Math.abs(f[i] - f[k]) <= lim) s += A[i] * A[i];
  const kf = kRef === undefined ? k : kRef;
  return {
    f, A, df: fs / N, f1: (k + d) * fs / N, A1: Math.sqrt(s / enbw), k: kf,
    ph1: Math.atan2(X.im[kf], X.re[kf]) * 180 / Math.PI,
  };
}

// Diferenca de fase em (-180, 180] graus (modulo do Scilab: sinal do dividendo)
export function difFase(a, b) {
  const x = a - b + 540;
  return (x - 360 * Math.trunc(x / 360)) - 180;
}

// DFT de janelas consecutivas de Nw amostras, raias 0..floor(Nw/2), escaladas
// para FASOR RMS: sum |X|^2 = media de x^2. Devolve {re, im}: arrays (uma
// entrada por janela) de Float64Array(nb).
export function dftJanelas(x, Nw) {
  const nW = Math.floor(x.length / Nw), nb = Math.floor(Nw / 2) + 1;
  const esc = new Float64Array(nb).fill(Math.SQRT2 / Nw);
  esc[0] = 1 / Nw;
  if (Nw % 2 === 0) esc[nb - 1] = 1 / Nw;
  const re = [], im = [];
  for (let j = 0; j < nW; j++) {
    const X = fft(x.subarray(j * Nw, (j + 1) * Nw));
    const r = new Float64Array(nb), i = new Float64Array(nb);
    for (let k = 0; k < nb; k++) { r[k] = X.re[k] * esc[k]; i[k] = X.im[k] * esc[k]; }
    re.push(r); im.push(i);
  }
  return { re, im, nW, nb };
}

// Mapa das raias de uma janela de Nw amostras (raias em base 0, como no Scilab)
export function mapaRaias(fs, f1, Nw) {
  const nb = Math.floor(Nw / 2) + 1, df = fs / Nw;
  const h = [], b = [];
  for (let k = 1; k <= 50; k++) {
    const a = f1 * k, rr = a - fs * Math.trunc(a / fs), fd = Math.min(rr, fs - rr);
    h.push(k); b.push(rnd(fd / df));
  }
  const bF = b[0];
  const gb = [...new Set(b.slice(1))].filter((x) => x !== 0 && x !== bF).sort((p, q) => p - q);
  const exc = new Set([...gb, bF - 1, bF, bF + 1]);
  const ruidoB = [];
  for (let k = 1; k <= nb - 2; k++) if (!exc.has(k)) ruidoB.push(k);
  return { nb, df, h, b, bF, gb, ruidoB };
}

// Percentil (interpolacao linear, tipo 7)
export function percentil(x, p) {
  const v = Array.from(x).sort((a, b) => a - b), n = v.length;
  if (n === 0) return NaN;
  const pos = 1 + (n - 1) * p / 100, i = Math.floor(pos), fr = pos - i;
  return i >= n ? v[n - 1] : v[i - 1] + fr * (v[i] - v[i - 1]);
}

// Le o arquivo do ESP32 (como fscanfMat): linhas numericas com >= 6 colunas,
// separadas por espaco, tab, ";" ou ","; linhas de texto do cabecalho ignoradas.
export function lerArquivoESP32(texto) {
  const linhas = texto.split(/\r?\n/);
  const cols = [[], [], [], [], [], []];
  let ignoradas = 0;
  for (const l of linhas) {
    const t = l.trim();
    if (!t) continue;
    const p = t.split(/[\s;,]+/);
    if (p.length < 6) { ignoradas++; continue; }
    const v = p.slice(0, 6).map(Number);
    if (v.some((z) => !Number.isFinite(z))) { ignoradas++; continue; }
    for (let k = 0; k < 6; k++) cols[k].push(v[k]);
  }
  return { cols: cols.map((c) => Float64Array.from(c)), ignoradas };
}
