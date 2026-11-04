// fatorial2k.js - planejamento fatorial 2^k completo (Montgomery, caps. 6 e 7).
// Fatores codificados -1/+1 (0 = ponto central). Efeitos e SQ pelos contrastes de Yates;
// ANOVA com F e p quando ha erro (replicas, pontos centrais ou termos fora do modelo);
// sem erro, metodo de Lenth (1989): PSE, ME e SME. Pontos centrais: teste de curvatura.
// Modelo reduzido: os termos nao escolhidos vao para o erro.
import { pfC, qt, ptBilateral, qnorm, shapiroWilk } from "./distribuicoes.js";

const LETRAS = "ABCDEFGHJK";
export const rotuloEfeito = (mask, k) => [...Array(k).keys()].filter((j) => mask & (1 << j)).map((j) => LETRAS[j]).join("");
const sinalDe = (mask, x) => { let s = 1; for (let j = 0; mask >> j; j++) if (mask & (1 << j)) s *= x[j]; return s; };
const sinalTxt = (c, k) => "(" + [...Array(k).keys()].map((j) => (c & (1 << j) ? "+" : "−")).join(",") + ")";

// X: linhas com os k fatores codificados; y: respostas; op: {nomes, alfa, termos: [rotulos]}
export function fatorial2k(X, y, op = {}) {
  const N = y.length, k = X[0].length, alfa = op.alfa ?? 0.05;
  if (k < 2 || k > 7) throw new Error("o fatorial 2^k aceita de 2 a 7 fatores.");
  const nomes = op.nomes || [...LETRAS.slice(0, k)];
  const nC = 1 << k, combos = Array.from({ length: nC }, () => []), centros = [];
  X.forEach((x, i) => {
    if (x.every((v) => v === 0)) { centros.push(y[i]); return; }
    if (!x.every((v) => v === -1 || v === 1)) throw new Error(`a linha ${i + 1} tem nível fora de −1, 0 e +1 (${x.join("; ")}). Codifique os fatores ou informe os níveis reais.`);
    combos[x.reduce((c, v, j) => c | (v === 1 ? 1 << j : 0), 0)].push(y[i]);
  });
  const faltam = combos.map((c, i) => (c.length ? null : sinalTxt(i, k))).filter(Boolean);
  if (faltam.length) throw new Error(`o planejamento 2^${k} precisa de ${nC} combinações; ${faltam.length === 1 ? "falta" : "faltam"} ${faltam.join(", ")}.`);
  const n = combos[0].length;
  if (combos.some((c) => c.length !== n)) throw new Error(`as combinações precisam do mesmo número de réplicas; há combinações com ${[...new Set(combos.map((c) => c.length))].join(" e ")}.`);
  const nF = n * nC, nc = centros.length;
  const mediaC = combos.map((c) => c.reduce((s, v) => s + v, 0) / n);
  const yF = mediaC.reduce((s, v) => s + v, 0) / nC;               // media das corridas fatoriais
  const yC = nc ? centros.reduce((s, v) => s + v, 0) / nc : NaN;
  const xCombo = (c) => [...Array(k).keys()].map((j) => (c & (1 << j) ? 1 : -1));

  // efeitos (ordem de Yates): contraste com as somas das combinacoes
  const efeitos = [];
  for (let mask = 1; mask < nC; mask++) {
    let contraste = 0;
    for (let c = 0; c < nC; c++) contraste += sinalDe(mask, xCombo(c)) * mediaC[c] * n;
    efeitos.push({ rotulo: rotuloEfeito(mask, k), mascara: mask, efeito: contraste / (n * nC / 2), coef: contraste / (n * nC), sq: contraste ** 2 / (n * nC) });
  }
  const todos = efeitos.map((e) => e.rotulo);
  const termos = op.termos ? todos.filter((r) => op.termos.includes(r)) : todos;
  const noModelo = (e) => termos.includes(e.rotulo);

  // valores ajustados e residuos do modelo (centros: media dos centros = termo de curvatura)
  const ajustados = [], residuos = [];
  X.forEach((x, i) => {
    let yh;
    if (x.every((v) => v === 0)) yh = yC;
    else { yh = yF; for (const e of efeitos) if (noModelo(e)) yh += e.coef * sinalDe(e.mascara, x); }
    ajustados.push(yh); residuos.push(y[i] - yh);
  });
  const mediaG = y.reduce((s, v) => s + v, 0) / N;
  const sqT = y.reduce((s, v) => s + (v - mediaG) ** 2, 0);
  const sqE = residuos.reduce((s, r) => s + r * r, 0);
  const glE = N - 1 - termos.length - (nc ? 1 : 0);
  const curvatura = nc ? { sq: nF * nc * (yF - yC) ** 2 / (nF + nc), gl: 1, yF, yC } : null;
  const qmE = glE > 0 ? sqE / glE : NaN;

  // teste de cada efeito: F e p com erro; sem erro, Lenth
  let lenth = null;
  if (glE > 0) {
    const ep = 2 * Math.sqrt(qmE / nF);
    for (const e of efeitos) if (noModelo(e)) {
      e.F = e.sq / qmE; e.p = pfC(e.F, 1, glE); e.t = e.efeito / ep; e.signif = e.p < alfa;
    }
    if (curvatura) { curvatura.F = curvatura.sq / qmE; curvatura.p = pfC(curvatura.F, 1, glE); curvatura.signif = curvatura.p < alfa; }
  } else lenth = metodoLenth(efeitos.filter(noModelo), alfa);

  // grafico meio-normal dos efeitos: |efeito| ordenado x quantil meio-normal
  const ord = efeitos.filter(noModelo).sort((a, b) => Math.abs(a.efeito) - Math.abs(b.efeito)), m = ord.length;
  const meioNormal = ord.map((e, i) => ({ rotulo: e.rotulo, abs: Math.abs(e.efeito), z: qnorm(0.5 + 0.5 * (i + 0.5) / m) }));
  // medias nos niveis (efeitos principais) e nas 4 combinacoes de cada par (interacoes)
  const mediaNivel = (j, s) => { let a = 0, c = 0; for (let i = 0; i < nC; i++) if (xCombo(i)[j] === s) { a += mediaC[i]; c++; } return a / c; };
  const principais = nomes.map((nome, j) => ({ nome, letra: LETRAS[j], baixo: mediaNivel(j, -1), alto: mediaNivel(j, 1) }));
  const interacoes = [];
  for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
    const md = (sa, sb) => { let s = 0, c = 0; for (let i = 0; i < nC; i++) { const x = xCombo(i); if (x[a] === sa && x[b] === sb) { s += mediaC[i]; c++; } } return s / c; };
    interacoes.push({ rotulo: LETRAS[a] + LETRAS[b], a: nomes[a], b: nomes[b], mm: md(-1, -1), mp: md(-1, 1), pm: md(1, -1), pp: md(1, 1) });
  }
  const sqModelo = efeitos.filter(noModelo).reduce((s, e) => s + e.sq, 0) + (curvatura ? curvatura.sq : 0);
  return {
    k, nomes, letras: LETRAS.slice(0, k), n, nF, nc, N, alfa, termos, efeitos, curvatura, lenth,
    erro: { gl: glE, sq: sqE, qm: qmE }, total: { gl: N - 1, sq: sqT },
    R2: sqModelo / sqT, R2aj: glE > 0 ? 1 - qmE / (sqT / (N - 1)) : NaN,
    tCrit: glE > 0 ? qt(1 - alfa / 2, glE) : NaN,
    media: yF, residuos, ajustados, meioNormal, principais, interacoes,
    premissas: { shapiro: glE > 2 ? shapiroWilk(residuos) : null },
  };
}

// Lenth (1989): s0 = 1,5 mediana|c|; PSE = 1,5 mediana{|c| : |c| < 2,5 s0}; d = m/3;
// ME = t(1-alfa/2; d) PSE; SME = t(gama; d) PSE, gama = (1 + (1-alfa)^(1/m))/2.
export function metodoLenth(efeitos, alfa = 0.05) {
  const abs = efeitos.map((e) => Math.abs(e.efeito)), m = abs.length;
  const med = (v) => { const s = [...v].sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const s0 = 1.5 * med(abs), PSE = 1.5 * med(abs.filter((a) => a < 2.5 * s0)), d = m / 3;
  const ME = qt(1 - alfa / 2, d) * PSE, SME = qt((1 + (1 - alfa) ** (1 / m)) / 2, d) * PSE;
  for (const e of efeitos) {
    e.tLenth = e.efeito / PSE; e.pLenth = ptBilateral(e.tLenth, d);
    e.signif = Math.abs(e.efeito) > ME; e.signifSME = Math.abs(e.efeito) > SME;
  }
  return { s0, PSE, d, ME, SME };
}
