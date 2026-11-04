// manova.js - MANOVA de um fator (Rencher e Christensen, Methods of Multivariate
// Analysis, cap. 6). H (entre grupos) e E (dentro); autovalores de E^-1 H pelo
// problema simetrico equivalente L^-1 H L^-T, com E = L L' (Cholesky).
// Estatisticas de Wilks (F de Rao), Pillai, Hotelling-Lawley (F de McKeon) e Roy
// (limite superior), com as aproximacoes da documentacao do SAS/STAT (as mesmas do
// statsmodels). Depois, ANOVAs univariadas protegidas com alfa/p (Bonferroni).
import { pfC } from "./distribuicoes.js";
import { cholesky, inversaTriangInf, produto, transposta, autoSimetrica } from "./algebra.js";
import { tabelaUmFator } from "./anova1.js";

// grupos: [{nome, Y: number[][] (linhas = observacoes, colunas = respostas)}]
export function manova(grupos, respostas, alfa = 0.05) {
  const a = grupos.length, p = respostas.length;
  if (a < 2) throw new Error("a MANOVA precisa de pelo menos 2 grupos.");
  if (p < 2) throw new Error("a MANOVA precisa de pelo menos 2 respostas; com 1, use a ANOVA.");
  const todos = grupos.flatMap((g) => g.Y), N = todos.length, ve = N - a, vh = a - 1;
  if (ve < p) throw new Error(`a MANOVA precisa de N − grupos ≥ respostas (${N} − ${a} < ${p}): faltam observações.`);
  const mediaDe = (Y) => respostas.map((_, j) => Y.reduce((s, l) => s + l[j], 0) / Y.length);
  const mg = mediaDe(todos);
  const H = respostas.map(() => new Array(p).fill(0)), E = respostas.map(() => new Array(p).fill(0));
  const medias = grupos.map((g) => {
    const m = mediaDe(g.Y);
    for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
      H[i][j] += g.Y.length * (m[i] - mg[i]) * (m[j] - mg[j]);
      for (const l of g.Y) E[i][j] += (l[i] - m[i]) * (l[j] - m[j]);
    }
    return { nome: g.nome, n: g.Y.length, media: m };
  });
  let Li;
  try { Li = inversaTriangInf(cholesky(E)); }
  catch { throw new Error("a matriz E não é definida positiva: há respostas que são combinação linear de outras (ou que não variam dentro dos grupos)."); }
  const lam = autoSimetrica(produto(produto(Li, H), transposta(Li))).valores.map((v) => Math.max(v, 0)).filter((v) => v > 1e-12);
  const s = Math.min(p, vh), m = (Math.abs(p - vh) - 1) / 2, n = (ve - p - 1) / 2;
  const est = {};
  // Wilks: Lambda = prod 1/(1+lambda); F de Rao
  {
    const L = lam.reduce((pr, l) => pr / (1 + l), 1);
    const t = p * p + vh * vh - 5 > 0 ? Math.sqrt((p * p * vh * vh - 4) / (p * p + vh * vh - 5)) : 1;
    const df1 = p * vh, df2 = (ve - (p - vh + 1) / 2) * t - (p * vh - 2) / 2, Lt = L ** (1 / t);
    const F = (1 - Lt) / Lt * df2 / df1;
    est.wilks = { nome: "Wilks (Λ)", valor: L, F, df1, df2, p: pfC(F, df1, df2) };
  }
  // Pillai: V = soma lambda/(1+lambda)
  {
    const V = lam.reduce((sm, l) => sm + l / (1 + l), 0), df1 = s * (2 * m + s + 1), df2 = s * (2 * n + s + 1);
    const F = df2 / df1 * V / (s - V);
    est.pillai = { nome: "Pillai (V)", valor: V, F, df1, df2, p: pfC(F, df1, df2) };
  }
  // Hotelling-Lawley: U = soma lambda; F de McKeon (n > 0)
  {
    const U = lam.reduce((sm, l) => sm + l, 0);
    let df1, df2, F;
    if (n > 0) {
      const b = (p + 2 * n) * (vh + 2 * n) / 2 / (2 * n + 1) / (n - 1);
      df1 = p * vh; df2 = 4 + (p * vh + 2) / (b - 1);
      const c = (df2 - 2) / 2 / n;
      F = df2 / df1 * U / c;
    } else { df1 = s * (2 * m + s + 1); df2 = s * (s * n + 1); F = df2 / df1 / s * U; }
    est.hotelling = { nome: "Hotelling-Lawley (U)", valor: U, F, df1, df2, p: pfC(F, df1, df2) };
  }
  // Roy: maior raiz; F e limite superior (p-valor e limite inferior)
  {
    const th = lam.length ? lam[0] : 0, r = Math.max(p, vh), df1 = r, df2 = ve - r + vh, F = df2 / df1 * th;
    est.roy = { nome: "Roy (θ)", valor: th, F, df1, df2, p: pfC(F, df1, df2), limiteSuperior: true };
  }
  for (const e of Object.values(est)) e.signif = e.p < alfa;
  // ANOVAs univariadas protegidas (Bonferroni: alfa/p)
  const alfaB = alfa / p;
  const univariadas = respostas.map((nome, j) => {
    const t = tabelaUmFator(grupos.map((g) => g.Y.map((l) => l[j])));
    return { nome, F: t.entre.F, p: t.entre.p, gl1: t.entre.gl, gl2: t.dentro.gl, sq: t.entre.sq, sqE: t.dentro.sq, signif: t.entre.p < alfaB };
  });
  return { a, p, N, ve, vh, alfa, alfaB, H, E, autovalores: lam, medias, estatisticas: est, univariadas };
}
