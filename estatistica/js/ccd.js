// ccd.js - planejamento composto central e superficie de resposta de 2a ordem
// (Myers, Montgomery e Anderson-Cook, caps. 6 e 7; Montgomery, cap. 11).
// Para cada resposta: MQO do modelo quadratico completo, coeficientes com EP, t e p;
// ANOVA (regressao, residuo, falta de ajuste, erro puro, total); R2, R2 ajustado e
// R2 de predicao (PRESS); ponto estacionario x_s = -1/2 B^-1 b e autovalores de B.
// Erro puro: TODOS os pontos repetidos do planejamento (nao so os centrais).
import { pfC, ptBilateral, shapiroWilk } from "./distribuicoes.js";
import { inversa, autoSimetrica } from "./algebra.js";

// Matriz do CCD codificada. k <= 4: fatorial completo; k = 5 e 6: meia fracao 2^(k-1)
// (I = ABCDE, resolucao V; I = ABCDEF, resolucao VI). Alfa rotacional = nF^(1/4).
export function ccdMatriz(k, nc = 5, alfaAxial) {
  if (k < 2 || k > 6) throw new Error("o composto central aceita de 2 a 6 fatores.");
  const fracao = k >= 5, nBase = fracao ? k - 1 : k, X = [];
  for (let c = 0; c < 1 << nBase; c++) {
    const x = [...Array(nBase).keys()].map((j) => (c & (1 << j) ? 1 : -1));
    if (fracao) x.push(x.reduce((p, v) => p * v, 1));             // ultimo fator = produto dos outros
    X.push(x);
  }
  const nF = X.length, alfa = alfaAxial ?? nF ** 0.25;
  for (let j = 0; j < k; j++) for (const s of [-1, 1]) { const x = new Array(k).fill(0); x[j] = s * alfa; X.push(x); }
  for (let i = 0; i < nc; i++) X.push(new Array(k).fill(0));
  return { X, alfa, nF, nAxial: 2 * k, nc, fracao: fracao ? `2^(${k}-1), I = ${"ABCDEF".slice(0, k)}` : null };
}

// Termos do modelo quadratico: 1, x1..xk, x1^2..xk^2, xixj (i<j)
export function termosQuadraticos(nomes) {
  const k = nomes.length, t = [{ rotulo: "b0", f: () => 1 }];
  for (let i = 0; i < k; i++) t.push({ rotulo: nomes[i], tipo: "linear", i, f: (x) => x[i] });
  for (let i = 0; i < k; i++) t.push({ rotulo: `${nomes[i]}²`, tipo: "quadratico", i, f: (x) => x[i] * x[i] });
  for (let i = 0; i < k; i++) for (let j = i + 1; j < k; j++) t.push({ rotulo: `${nomes[i]}·${nomes[j]}`, tipo: "interacao", i, j, f: (x) => x[i] * x[j] });
  return t;
}

// X: N x k codificado; Y: N x r (uma coluna por resposta);
// op: {nomes, respostas, alfa, alfaAxial (raio da regiao), niveis: [{baixo, alto}] dos niveis -1/+1}
export function ccd(X, Y, op = {}) {
  const N = X.length, k = X[0].length, alfa = op.alfa ?? 0.05;
  const nomes = op.nomes || [...Array(k).keys()].map((j) => `x${j + 1}`);
  const termos = termosQuadraticos(nomes), p = termos.length;
  if (N < p) throw new Error(`o modelo quadrático com ${k} fatores tem ${p} coeficientes e precisa de pelo menos ${p} ensaios; há ${N}.`);
  const M = X.map((x) => termos.map((t) => t.f(x)));
  const XtX = termos.map((_, a) => termos.map((_, b) => M.reduce((s, l) => s + l[a] * l[b], 0)));
  let XtXi;
  try { XtXi = inversa(XtX); }
  catch (e) { throw new Error(`a matriz X'X é singular: confira se há colunas repetidas ou níveis que não variam (termo ${termos[e.coluna]?.rotulo ?? "?"} não é estimável).`); }
  const h = M.map((l) => l.reduce((s, a, i) => s + a * l.reduce((t, b, j) => t + XtXi[i][j] * b, 0), 0));   // diagonal da matriz chapeu
  // grupos de pontos repetidos (mesmo x) para o erro puro
  const chave = (x) => x.map((v) => Math.round(v * 1e6) / 1e6).join("|"), grupos = new Map();
  X.forEach((x, i) => { const c = chave(x); if (!grupos.has(c)) grupos.set(c, []); grupos.get(c).push(i); });
  const alfaAx = op.alfaAxial ?? Math.max(...X.map((x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0))));
  const niveis = op.niveis;
  const paraReal = (x) => (niveis ? x.map((v, j) => (niveis[j].baixo + niveis[j].alto) / 2 + v * (niveis[j].alto - niveis[j].baixo) / 2) : null);

  const respostas = (op.respostas || Y[0].map((_, r) => `y${r + 1}`)).map((nome, r) => {
    const y = Y.map((l) => l[r]);
    if (y.some((v) => !Number.isFinite(v))) throw new Error(`a resposta "${nome}" tem valor vazio ou não numérico.`);
    const Xty = termos.map((_, a) => M.reduce((s, l, i) => s + l[a] * y[i], 0));
    const b = XtXi.map((l) => l.reduce((s, v, j) => s + v * Xty[j], 0));
    const ajust = M.map((l) => l.reduce((s, v, j) => s + v * b[j], 0)), res = y.map((v, i) => v - ajust[i]);
    const ym = y.reduce((s, v) => s + v, 0) / N;
    const sqT = y.reduce((s, v) => s + (v - ym) ** 2, 0), sqRes = res.reduce((s, e) => s + e * e, 0);
    const glRes = N - p, glReg = p - 1, sqReg = sqT - sqRes, s2 = glRes > 0 ? sqRes / glRes : NaN;
    const coefs = termos.map((t, j) => {
      const ep = Math.sqrt(s2 * XtXi[j][j]), tv = b[j] / ep;
      return { rotulo: t.rotulo, tipo: t.tipo || "intercepto", coef: b[j], ep, t: tv, p: ptBilateral(tv, glRes), signif: ptBilateral(tv, glRes) < alfa };
    });
    let sqEP = 0, glEP = 0;
    for (const idx of grupos.values()) if (idx.length > 1) {
      const m = idx.reduce((s, i) => s + y[i], 0) / idx.length;
      for (const i of idx) sqEP += (y[i] - m) ** 2;
      glEP += idx.length - 1;
    }
    const glLoF = glRes - glEP, sqLoF = sqRes - sqEP;
    const linha = (sq, gl) => ({ sq, gl, qm: gl > 0 ? sq / gl : NaN });
    const anova = { regressao: linha(sqReg, glReg), residuo: linha(sqRes, glRes), total: linha(sqT, N - 1),
      faltaAjuste: glLoF > 0 && glEP > 0 ? linha(sqLoF, glLoF) : null, erroPuro: glEP > 0 ? linha(sqEP, glEP) : null };
    anova.regressao.F = anova.regressao.qm / s2; anova.regressao.p = pfC(anova.regressao.F, glReg, glRes);
    if (anova.faltaAjuste) { const F = anova.faltaAjuste.qm / anova.erroPuro.qm; Object.assign(anova.faltaAjuste, { F, p: pfC(F, glLoF, glEP), signif: pfC(F, glLoF, glEP) < alfa }); }
    const press = res.reduce((s, e, i) => s + (e / (1 - h[i])) ** 2, 0);
    return {
      nome, coefs, anova, R2: sqReg / sqT, R2aj: 1 - (sqRes / glRes) / (sqT / (N - 1)), press, R2pred: 1 - press / sqT,
      s: Math.sqrt(s2), residuos: res, ajustados: ajust, y,
      premissas: { shapiro: glRes > 2 ? shapiroWilk(res) : null },
      estacionario: pontoEstacionario(b, termos, k, alfaAx, paraReal),
      prever: (x) => termos.reduce((s, t, j) => s + t.f(x) * b[j], 0),
    };
  });
  return { k, N, p, nomes, alfa, alfaAxial: alfaAx, termos: termos.map((t) => t.rotulo), alavanca: h, respostas, paraReal };
}

// Forma canonica: y = b0 + x'b + x'Bx; x_s = -1/2 B^-1 b; tipo pelos autovalores de B
function pontoEstacionario(beta, termos, k, raio, paraReal) {
  const bl = new Array(k).fill(0), B = Array.from({ length: k }, () => new Array(k).fill(0));
  termos.forEach((t, j) => {
    if (t.tipo === "linear") bl[t.i] = beta[j];
    else if (t.tipo === "quadratico") B[t.i][t.i] = beta[j];
    else if (t.tipo === "interacao") { B[t.i][t.j] = beta[j] / 2; B[t.j][t.i] = beta[j] / 2; }
  });
  const { valores, vetores } = autoSimetrica(B);
  let xs;
  try { const Bi = inversa(B); xs = Bi.map((l) => -0.5 * l.reduce((s, v, j) => s + v * bl[j], 0)); }
  catch { return { tipo: "indefinido", autovalores: valores, autovetores: vetores, msg: "B é singular: não há ponto estacionário único (cumeeira)." }; }
  const ys = beta[0] + 0.5 * xs.reduce((s, v, j) => s + v * bl[j], 0);
  const tipo = valores.every((v) => v < 0) ? "máximo" : valores.every((v) => v > 0) ? "mínimo" : "sela";
  const dist = Math.sqrt(xs.reduce((s, v) => s + v * v, 0));
  return { xs, ys, tipo, autovalores: valores, autovetores: vetores, distancia: dist, dentro: dist <= raio + 1e-9, xsReal: paraReal(xs) };
}
