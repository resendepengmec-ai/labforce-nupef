// anova1.js - ANOVA de um fator (grupos de tamanhos iguais ou diferentes).
// Descritivas por grupo com IC por t, tabela ANOVA com valor-p, R2 e R2 ajustado,
// comparacoes de Tukey-Kramer e premissas: Shapiro-Wilk nos residuos e Levene
// centrado na mediana (Brown-Forsythe). Referencia: Montgomery, cap. 3.
import { pfC, qt, ptukeyC, qtukey, shapiroWilk } from "./distribuicoes.js";

const soma = (v) => v.reduce((s, x) => s + x, 0);
export const media = (v) => soma(v) / v.length;
export function mediana(v) {
  const s = [...v].sort((a, b) => a - b), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
export function desvio(v) {               // desvio padrao amostral (n - 1)
  const m = media(v);
  return Math.sqrt(soma(v.map((x) => (x - m) ** 2)) / (v.length - 1));
}

// SQ, GL, QM, F e p de um fator (usado tambem pelo Levene e pela MANOVA)
export function tabelaUmFator(grupos) {
  const todos = grupos.flat(), N = todos.length, a = grupos.length, mg = media(todos);
  let sqE = 0, sqTr = 0;
  for (const g of grupos) { const m = media(g); sqTr += g.length * (m - mg) ** 2; for (const x of g) sqE += (x - m) ** 2; }
  const glTr = a - 1, glE = N - a, qmTr = sqTr / glTr, qmE = sqE / glE, F = qmTr / qmE;
  return {
    entre: { gl: glTr, sq: sqTr, qm: qmTr, F, p: pfC(F, glTr, glE) },
    dentro: { gl: glE, sq: sqE, qm: qmE },
    total: { gl: N - 1, sq: sqTr + sqE },
  };
}

// grupos: [{nome, valores: number[]}]; alfa: nivel de significancia (padrao 0,05)
export function anova1(grupos, alfa = 0.05) {
  if (grupos.length < 2) throw new Error("a ANOVA precisa de pelo menos 2 grupos.");
  const curtos = grupos.filter((g) => g.valores.length < 2).map((g) => g.nome);
  if (curtos.length) throw new Error(`cada grupo precisa de pelo menos 2 valores; confira: ${curtos.join(", ")}.`);
  const vals = grupos.map((g) => g.valores), N = vals.flat().length, a = grupos.length;
  if (N - a < 1) throw new Error("sem graus de liberdade para o erro.");
  const desc = grupos.map(({ nome, valores: v }) => {
    const n = v.length, m = media(v), dp = desvio(v), meia = qt(1 - alfa / 2, n - 1) * dp / Math.sqrt(n);
    return { nome, n, media: m, dp, mediana: mediana(v), min: Math.min(...v), max: Math.max(...v),
      cv: 100 * dp / Math.abs(m), icInf: m - meia, icSup: m + meia };
  });
  const tab = tabelaUmFator(vals);
  const R2 = tab.entre.sq / tab.total.sq, R2aj = 1 - tab.dentro.qm / (tab.total.sq / tab.total.gl);
  // Tukey-Kramer: EP da diferenca com n de cada grupo (vale para grupos desbalanceados)
  const qcrit = qtukey(1 - alfa, a, tab.dentro.gl), tukey = [];
  for (let i = 0; i < a; i++) for (let j = i + 1; j < a; j++) {
    const dif = desc[i].media - desc[j].media;
    const ep = Math.sqrt(tab.dentro.qm / 2 * (1 / desc[i].n + 1 / desc[j].n)), q = Math.abs(dif) / ep;
    const p = ptukeyC(q, a, tab.dentro.gl);
    tukey.push({ a: desc[i].nome, b: desc[j].nome, dif, ep, q, p, icInf: dif - qcrit * ep, icSup: dif + qcrit * ep, signif: p < alfa });
  }
  // residuos (y - media do grupo) e premissas
  const residuos = [], ajustados = [];
  vals.forEach((v, i) => v.forEach((x) => { residuos.push(x - desc[i].media); ajustados.push(desc[i].media); }));
  const shapiro = shapiroWilk(residuos);
  const lev = tabelaUmFator(vals.map((v) => { const md = mediana(v); return v.map((x) => Math.abs(x - md)); })).entre;
  return {
    alfa, N, a, desc, tabela: tab, R2, R2aj, qcrit, tukey, residuos, ajustados,
    premissas: { shapiro, levene: { F: lev.F, p: lev.p, gl1: lev.gl, gl2: N - a } },
  };
}
