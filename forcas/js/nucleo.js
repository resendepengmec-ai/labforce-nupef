// nucleo.js - funcoes numericas do modulo de forcas (sem interface).
// Leitura do TXT (inclui DynoWare: metadados, tab, virgula decimal), fatores de
// calibracao, taxa de amostragem pela coluna de tempo, estatistica por canal e
// forca de corte teorica (torneamento; formulas da Sandvik Coromant/Kienzle).
import { fft } from "../../comum/js/fft.js";

export const CAMPOS = ["tempo", "fx", "fy", "fz", "ignorar"];

export function numeroLocal(v) {
  const s = String(v).trim();
  if (s === "") return null;   // campo vazio invalida a linha (Number("") daria 0)
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

// Separa uma linha: tab > ponto e virgula > espacos > virgula (como o ForceLab)
export function separarLinha(linha) {
  const t = linha.trim();
  if (!t) return [];
  if (t.includes("\t")) return t.split("\t").map((x) => x.trim());   // um tab = uma coluna: campo vazio nao desloca as outras
  if (t.includes(";")) return t.split(";").map((x) => x.trim());
  if (/,\s/.test(t)) return t.split(/\s*,\s*/);                     // "0.0, 1.5, 2" (numpy delimiter=", ")
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

// Componentes da forca de usinagem: quais canais (Fx, Fy, Fz) medem cada componente depende
// da montagem do dinamometro e do processo. Duas componentes ficam no plano de trabalho
// (a e b: formam a forca ativa Fa) e uma e a passiva (p).
//   torneamento: a = Fc (corte), b = Ff (avanco), p = Fp (passiva)
//   fresamento, furacao e rosqueamento (dinamometro estacionario): a = FfN (normal ao
//   avanco), b = Ff (avanco), p = Fp (passiva, axial)
// padrao: convencao DynoWare no torneamento e a da figura Kistler no fresamento.
export const COMPONENTES = {
  torneamento: { rot: { a: "Fc", b: "Ff", p: "Fp" }, nome: { a: "força de corte", b: "força de avanço", p: "força passiva" }, padrao: { a: "fz", b: "fx", p: "fy" } },
  fresamento: { rot: { a: "FfN", b: "Ff", p: "Fp" }, nome: { a: "força normal ao avanço", b: "força de avanço", p: "força passiva (axial)" }, padrao: { a: "fx", b: "fy", p: "fz" } },
};
export const compValido = (c) => !!c && ["fx", "fy", "fz"].every((k) => [c.a, c.b, c.p].filter((v) => v === k).length === 1);

// Componentes na faixa [c1, c2] (indices inclusivos), com o mapa comp = {a, b, p} -> canal:
//   a, b, p : medias com sinal [N]
//   fa      : media da forca ativa, Fa(t) = raiz(a(t)^2 + b(t)^2)   [N]
//   razao   : Fa / |Fp| [-] (indicador de atrito pedido pelo NUPEF); NaN se |Fp| ~ 0
export function componentes(F, c1, c2, comp) {
  const A = F[comp.a], B = F[comp.b], Pp = F[comp.p], n = c2 - c1 + 1;
  let sa = 0, sb = 0, sp = 0, sfa = 0;
  for (let i = c1; i <= c2; i++) { sa += A[i]; sb += B[i]; sp += Pp[i]; sfa += Math.hypot(A[i], B[i]); }
  const a = sa / n, b = sb / n, p = sp / n, fa = sfa / n;
  return { a, b, p, fa, razao: Math.abs(p) > 1e-9 * Math.max(fa, 1) ? fa / Math.abs(p) : NaN };
}

// ---- atrito na face da ferramenta (Puls; Klocke; Lung, Wear 310, 2014, p. 63-71) -------------
// Coeficiente de atrito aparente: forca tangencial / forca normal na face da ferramenta, pela
// transformacao geometrica das forcas medidas (analise de Merchant, corte ortogonal):
//   FT = Fc . sen(g0) + Ff . cos(g0)        tangencial (atrito)   [N]
//   FN = Fc . cos(g0) - Ff . sen(g0)        normal                [N]
//   mu = FT / FN [-]                        beta = arctan(mu) [graus]
// Fc, Ff: modulos das medias; g0: angulo de saida [graus]. O ensaio de atrito do artigo (plano
// inclinado de alfa em relacao a velocidade, sem cavaco) e o caso g0 = alfa - 90 graus.
// Limites (artigo, secao 1.2): despreza a forca de sulcamento no raio da aresta e o desgaste
// de flanco, e trata mu como constante na interface; mu varia com velocidade e temperatura.
export function atritoMerchant(Fc, Ff, g0) {
  // FT em modulo: com o angulo de saida muito negativo do ensaio de atrito (g0 = alfa - 90), o metal
  // escoa no sentido da velocidade e nao "sobe" a face como o cavaco; o sinal de Merchant inverte,
  // mas a forca tangencial e a mesma (Puls et al., 2014: mu = FT/FN positivo)
  const g = g0 * Math.PI / 180, FT = Math.abs(Fc * Math.sin(g) + Ff * Math.cos(g)), FN = Fc * Math.cos(g) - Ff * Math.sin(g);
  const mu = FN > 1e-9 * Math.max(Math.abs(FT), 1) ? FT / FN : NaN;
  return { FT, FN, mu, beta: Math.atan(mu) * 180 / Math.PI };
}
// Area de contato do ensaio de atrito (eq. 1 do artigo; trapezio): A = (b1 + b2) . t / (2 . sen alfa)
// b1, b2: largura da peca antes e depois da deformacao [mm]; t: profundidade de engajamento [mm]
export const areaContato = (b1, b2, t, alfa) => (b1 + b2) * t / (2 * Math.sin(alfa * Math.PI / 180));
// Modelo de atrito dependente da temperatura (eq. 2 do artigo; amolecimento termico, termo
// analogo ao de Johnson-Cook): mu = mu0 . [1 - ((T - T0)/(Tf - T0))^m] para T > T0; mu0 abaixo de
// T0; 0 na fusao. Calibrado no artigo, por elementos finitos, para AISI 1045 com metal duro
// WC-6Co sem revestimento: mu0 = 0,7; T0 = 600 graus C; m = 0,35; Tf = 1773 K (1500 graus C).
export const ATRITO_TERMICO = { mu0: 0.7, T0: 600, m: 0.35, Tf: 1500 };
export function muTermico(T, q = ATRITO_TERMICO) {
  if (!(T > q.T0)) return q.mu0;
  if (T >= q.Tf) return 0;
  return q.mu0 * (1 - ((T - q.T0) / (q.Tf - q.T0)) ** q.m);
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
// A: |X| das raias 0..N/2 (o espectro da figura sai daqui, sem outra FFT).
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
  if (!(A[k] > 0)) return { f: NaN, df: fs / N, A };
  let d = 0;
  if (k > 0 && k < M - 1) {
    if (A[k + 1] >= A[k - 1]) { const a = A[k + 1] / A[k]; d = (2 * a - 1) / (a + 1); }
    else { const a = A[k - 1] / A[k]; d = -(2 * a - 1) / (a + 1); }
  }
  return { f: (k + d) * fs / N, df: fs / N, A };
}

// Estatistica de um canal (populacional). Curtose de Pearson (normal = 3).
// aoEspectro(A): opcional, recebe o |X| da FFT da frequencia dominante.
export function estatistica(x, fs, aoEspectro) {
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
  if (aoEspectro && fd.A) aoEspectro(fd.A);
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
