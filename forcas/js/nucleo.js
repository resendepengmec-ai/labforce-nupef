// nucleo.js - funcoes numericas do modulo de forcas (sem interface).
// Leitura do TXT (inclui DynoWare: metadados, tab, virgula decimal), fatores de
// calibracao, taxa de amostragem pela coluna de tempo, estatistica por canal e
// forca de corte teorica (torneamento; formulas da Sandvik Coromant/Kienzle).
import { fft } from "../../comum/js/fft.js";

export const CAMPOS = ["tempo", "fx", "fy", "fz", "ignorar"];

export function numeroLocal(v) {
  const n = Number(String(v).trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Separa uma linha: tab > ponto e virgula > espacos > virgula (como o ForceLab)
export function separarLinha(linha) {
  const t = linha.trim();
  if (!t) return [];
  if (t.includes("\t")) return t.split(/\t+/).map((x) => x.trim());
  if (t.includes(";")) return t.split(";").map((x) => x.trim());
  if (/\s+/.test(t)) return t.split(/\s+/);
  if (t.includes(",")) return t.split(",").map((x) => x.trim());
  return [t];
}

// mapa: 4 campos (tempo, fx, fy, fz ou ignorar) na ordem das colunas
// k: fatores de calibracao {fx, fy, fz} (multiplicam o sinal; padrao 1)
export function lerArquivo(texto, mapa, k = { fx: 1, fy: 1, fz: 1 }) {
  const col = { tempo: [], fx: [], fy: [], fz: [] };
  let ignoradas = 0, cabecalho = "";
  for (const linha of texto.split(/\r?\n/)) {
    const p = separarLinha(linha);
    if (!p.length) continue;
    const v = p.length >= 4 ? p.slice(0, 4).map(numeroLocal) : null;
    if (!v || v.some((x) => x === null)) {
      if (p.length) { ignoradas++; if (/[a-z]/i.test(linha)) cabecalho = linha.trim(); }
      continue;
    }
    const r = {};
    mapa.forEach((c, i) => { if (c !== "ignorar") r[c] = v[i]; });
    if (!["tempo", "fx", "fy", "fz"].every((c) => Number.isFinite(r[c]))) { ignoradas++; continue; }
    col.tempo.push(r.tempo); col.fx.push(r.fx * k.fx); col.fy.push(r.fy * k.fy); col.fz.push(r.fz * k.fz);
  }
  const t = Float64Array.from(col.tempo), fx = Float64Array.from(col.fx), fy = Float64Array.from(col.fy), fz = Float64Array.from(col.fz);
  const fr = new Float64Array(t.length);
  for (let i = 0; i < t.length; i++) fr[i] = Math.sqrt(fx[i] ** 2 + fy[i] ** 2 + fz[i] ** 2);
  return { t, F: { fx, fy, fz, fr }, N: t.length, ignoradas, cabecalho };
}

export function mapaValido(mapa) {
  return ["tempo", "fx", "fy", "fz"].every((c) => mapa.filter((m) => m === c).length === 1);
}

// Taxa de amostragem pela coluna de tempo e regularidade do passo
export function taxaDoTempo(t) {
  const N = t.length;
  if (N < 2) return { fs: 0, dt: 0, desvio: 0, crescente: false };
  const dt = (t[N - 1] - t[0]) / (N - 1);
  let maxDesv = 0, crescente = true;
  for (let i = 1; i < N; i++) {
    const d = t[i] - t[i - 1];
    if (d <= 0) crescente = false;
    maxDesv = Math.max(maxDesv, Math.abs(d - dt));
  }
  return { fs: dt > 0 ? 1 / dt : 0, dt, desvio: dt > 0 ? 100 * maxDesv / dt : 0, crescente };
}

// Frequencia dominante: FFT (janela de Hann) do sinal sem a media, maior raia
// fora do DC, com interpolacao exata para Hann. Resolucao = fs/N.
export function freqDominante(x, fs) {
  const N = x.length;
  if (N < 8 || !(fs > 0)) return { f: NaN, df: NaN };
  let m = 0; for (let i = 0; i < N; i++) m += x[i]; m /= N;
  const y = new Float64Array(N);
  for (let i = 0; i < N; i++) y[i] = (x[i] - m) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  const X = fft(y), M = Math.floor(N / 2) + 1, A = new Float64Array(M);
  for (let i = 0; i < M; i++) A[i] = Math.hypot(X.re[i], X.im[i]);
  let k = 2;                                   // raias 0 e 1 carregam o DC da janela
  for (let i = 3; i < M; i++) if (A[i] > A[k]) k = i;
  if (!(A[k] > 0)) return { f: NaN, df: fs / N };
  let d = 0;
  if (k > 0 && k < M - 1) {
    if (A[k + 1] >= A[k - 1]) { const a = A[k + 1] / A[k]; d = (2 * a - 1) / (a + 1); }
    else { const a = A[k - 1] / A[k]; d = -(2 * a - 1) / (a + 1); }
  }
  return { f: (k + d) * fs / N, df: fs / N };
}

// Estatistica de um canal (populacional). Curtose de Pearson (normal = 3).
export function estatistica(x, fs) {
  const n = x.length;
  if (!n) return null;
  let s = 0, s2 = 0, pico = 0;
  for (let i = 0; i < n; i++) { s += x[i]; s2 += x[i] * x[i]; pico = Math.max(pico, Math.abs(x[i])); }
  const media = s / n, rms = Math.sqrt(s2 / n);
  let m2 = 0, m3 = 0, m4 = 0;
  for (let i = 0; i < n; i++) { const d = x[i] - media; m2 += d * d; m3 += d ** 3; m4 += d ** 4; }
  m2 /= n; m3 /= n; m4 /= n;
  const dp = Math.sqrt(m2);
  const fd = freqDominante(x, fs);
  return {
    media, rms, pico, dp,
    cv: media === 0 ? NaN : Math.abs(dp / media),
    crista: rms === 0 ? NaN : pico / rms,
    assimetria: dp === 0 ? 0 : m3 / dp ** 3,
    curtose: dp === 0 ? 0 : m4 / dp ** 4,
    fdom: fd.f, df: fd.df, n,
  };
}

// Forca de corte teorica no torneamento (Sandvik Coromant; modelo de Kienzle):
//   hm = fn . sen(kr)                         [mm]
//   kc = kc1 . hm^(-mc) . (1 - g0/100)        [N/mm2]
//   Fc = kc . ap . fn                         [N]
//   Pc = vc . ap . fn . kc / (60 . 10^3)      [kW]
//   Q  = vc . ap . fn                         [cm3/min]
// p: {ap [mm], fn [mm/rot], vc [m/min], kr [graus], g0 [graus], kc1 [N/mm2], mc [-]}
export function corteTeorico(p) {
  const hm = p.fn * Math.sin(p.kr * Math.PI / 180);
  const kc = p.kc1 * hm ** (-p.mc) * (1 - p.g0 / 100);
  const Fc = kc * p.ap * p.fn;
  return { hm, kc, Fc, Pc: p.vc * p.ap * p.fn * kc / 60e3, Q: p.vc * p.ap * p.fn };
}

// vc a partir do diametro D [mm] e da rotacao n [rpm]
export const vcDeDn = (D, n) => Math.PI * D * n / 1000;
