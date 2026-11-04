// autoteste.js - verificacao do modulo de estatistica contra as respostas do SciPy e do
// statsmodels (testes/referencias.js, gerado por gerar_referencias.py).
// Roda no navegador (manual, secao 6) e no Node (testes/teste_estatistica.js).
import REF from "../testes/referencias.js";
import * as D from "./distribuicoes.js";
import * as A from "./algebra.js";

export async function autoteste() {
  let nOK = 0;
  const falhas = [];
  const ok = (c, msg) => { if (c) nOK++; else falhas.push(msg); };
  // tolerancia relativa 1e-6 (valores-p: 1e-4 absoluto)
  // piso absoluto de 1e-14: valores de referencia exatamente 0 (ex.: lnGama(1))
  const perto = (a, b, msg, tol = 1e-6) => ok(Math.abs(a - b) <= Math.max(tol * Math.abs(b), 1e-14), `${msg}: ${a} != ${b}`);
  const pval = (a, b, msg) => ok(Math.abs(a - b) <= 1e-4, `${msg} (valor-p): ${a} != ${b}`);
  const matriz = (X, Y, msg, tol = 1e-9) => {
    let e = 0, m = 0;
    X.forEach((l, i) => l.forEach((v, j) => { e = Math.max(e, Math.abs(v - Y[i][j])); m = Math.max(m, Math.abs(Y[i][j])); }));
    ok(e <= tol * m, `${msg}: erro ${e}`);
  };

  // ---- distribuicoes -----------------------------------------------------
  const R = REF.distribuicoes;
  for (const [x, v] of R.lnGama) perto(D.lnGama(x), v, `lnGama(${x})`, 1e-12);
  for (const [x, a, b, v] of R.betaReg) perto(D.betaReg(x, a, b), v, `betaReg(${x}; ${a}; ${b})`, 1e-10);
  for (const [a, x, p, q] of R.gamaReg) { perto(D.gamaReg(a, x), p, `P(${a}; ${x})`, 1e-10); perto(D.gamaRegC(a, x), q, `Q(${a}; ${x})`, 1e-10); }
  for (const [z, p, q] of R.pnorm) { perto(D.pnorm(z), p, `pnorm(${z})`, 1e-10); perto(D.pnormC(z), q, `pnormC(${z})`, 1e-10); }
  for (const [p, z] of R.qnorm) perto(D.qnorm(p), z, `qnorm(${p})`, 1e-12);
  for (const [t, gl, p, p2] of R.pt) { perto(D.pt(t, gl), p, `pt(${t}; ${gl})`, 1e-10); perto(D.ptBilateral(t, gl), p2, `p bilateral t(${t}; ${gl})`, 1e-10); }
  for (const [p, gl, t] of R.qt) perto(D.qt(p, gl), t, `qt(${p}; ${gl})`, 1e-9);
  for (const [f, d1, d2, p] of R.pfC) perto(D.pfC(f, d1, d2), p, `pfC(${f}; ${d1}; ${d2})`, 1e-9);
  for (const [p, d1, d2, f] of R.qf) perto(D.qf(p, d1, d2), f, `qf(${p}; ${d1}; ${d2})`, 1e-9);
  for (const [x, gl, p, q] of R.pchisq) { perto(D.pchisq(x, gl), p, `pchisq(${x}; ${gl})`, 1e-10); perto(D.pchisqC(x, gl), q, `pchisqC(${x}; ${gl})`, 1e-10); }
  for (const [p, gl, x] of R.qchisq) perto(D.qchisq(p, gl), x, `qchisq(${p}; ${gl})`, 1e-9);
  for (const [q, k, gl, p] of R.ptukey) pval(D.ptukey(q, k, gl), p, `ptukey(${q}; ${k}; ${gl})`);
  for (const [p, k, gl, q] of R.qtukey) perto(D.qtukey(p, k, gl), q, `qtukey(${p}; ${k}; ${gl})`);
  for (const s of R.shapiro) {
    const r = D.shapiroWilk(s.x);
    perto(r.W, s.W, `Shapiro-Wilk W (n = ${s.n}, ${s.tipo})`); pval(r.p, s.p, `Shapiro-Wilk (n = ${s.n}, ${s.tipo})`);
  }

  // ---- algebra -----------------------------------------------------------
  const G = REF.algebra;
  matriz(A.inversa(G.A), G.invA, "inversa (simetrica)"); matriz(A.inversa(G.N), G.invN, "inversa (geral)");
  perto(A.determinante(G.A), G.detA, "determinante (simetrica)", 1e-10); perto(A.determinante(G.N), G.detN, "determinante (geral)", 1e-10);
  matriz(A.cholesky(G.A), G.cholA, "Cholesky");
  const au = A.autoSimetrica(G.A);
  au.valores.forEach((v, i) => perto(v, G.autovaloresA[i], `autovalor ${i + 1}`, 1e-10));
  const Av = A.produto(G.A, au.vetores), VL = au.vetores.map((l) => l.map((v, j) => v * au.valores[j]));
  matriz(Av, VL, "A v = lambda v");
  matriz(A.produto(A.cholesky(G.A), A.transposta(A.cholesky(G.A))), G.A, "L L' = A");
  let singular = false;
  try { A.inversa([[1, 2], [2, 4]]); } catch (e) { singular = e.coluna === 1; }
  ok(singular, "inversa: matriz singular detectada (coluna 2)");

  return { nOK, falhas };
}
