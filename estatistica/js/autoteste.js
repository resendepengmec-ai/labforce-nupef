// autoteste.js - verificacao do modulo de estatistica contra as respostas do SciPy e do
// statsmodels (testes/referencias.js, gerado por gerar_referencias.py).
// Roda no navegador (manual, secao 6) e no Node (testes/teste_estatistica.js).
import REF from "../testes/referencias.js";
import * as D from "./distribuicoes.js";
import * as A from "./algebra.js";
import { anova1 } from "./anova1.js";
import { fatorial2k } from "./fatorial2k.js";
import { lerCSV, numeroCSV, colunaNumerica } from "./dados.js";

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

  // ---- ANOVA de um fator (statsmodels / SciPy) --------------------------------
  for (const [caso, E] of Object.entries(REF.anova1)) {
    const r = anova1(E.grupos, E.alfa), m = `ANOVA ${caso}`;
    E.desc.forEach((d, i) => {
      for (const k of ["n", "media", "dp", "mediana", "min", "max", "cv", "icInf", "icSup"]) perto(r.desc[i][k], d[k], `${m} ${d.nome} ${k}`);
    });
    for (const k of ["gl", "sq", "F"]) perto(r.tabela.entre[k], E.entre[k], `${m} entre ${k}`);
    pval(r.tabela.entre.p, E.entre.p, `${m} F`);
    for (const k of ["gl", "sq"]) perto(r.tabela.dentro[k], E.dentro[k], `${m} dentro ${k}`);
    perto(r.R2, E.R2, `${m} R2`); perto(r.R2aj, E.R2aj, `${m} R2 ajustado`);
    E.tukey.forEach((t, i) => {
      const u = r.tukey[i];
      ok(u.a === t.a && u.b === t.b, `${m} Tukey par ${t.a}-${t.b}`);
      perto(u.dif, t.dif, `${m} Tukey ${t.a}-${t.b} diferenca`); pval(u.p, t.p, `${m} Tukey ${t.a}-${t.b}`);
      perto(u.icInf, t.icInf, `${m} Tukey ${t.a}-${t.b} IC inf`); perto(u.icSup, t.icSup, `${m} Tukey ${t.a}-${t.b} IC sup`);
    });
    perto(r.premissas.shapiro.W, E.shapiro.W, `${m} Shapiro W`); pval(r.premissas.shapiro.p, E.shapiro.p, `${m} Shapiro`);
    perto(r.premissas.levene.F, E.levene.F, `${m} Levene F`); pval(r.premissas.levene.p, E.levene.p, `${m} Levene`);
  }

  // ---- fatorial 2^k (OLS do statsmodels; Lenth sobre os efeitos) ---------------
  for (const [caso, E] of Object.entries(REF.fatorial2k)) {
    const r = fatorial2k(E.X, E.y, { alfa: E.alfa, termos: E.termos || undefined }), m = `2^k ${caso}`;
    ok(r.erro.gl === E.glE, `${m} GL do erro: ${r.erro.gl} != ${E.glE}`);
    perto(r.R2, E.R2, `${m} R2`);
    for (const e of E.efeitos) {
      const u = r.efeitos.find((x) => x.rotulo === e.rotulo);
      perto(u.efeito, e.efeito, `${m} efeito ${e.rotulo}`, 1e-9);
      if ("sq" in e) { perto(u.sq, e.sq, `${m} SQ ${e.rotulo}`); perto(u.F, e.F, `${m} F ${e.rotulo}`); pval(u.p, e.p, `${m} ${e.rotulo}`); }
      if ("pLenth" in e) pval(u.pLenth, e.pLenth, `${m} Lenth ${e.rotulo}`);
    }
    if (E.sqE !== undefined) { perto(r.erro.sq, E.sqE, `${m} SQ do erro`); perto(r.R2aj, E.R2aj, `${m} R2 ajustado`); }
    if (E.curvatura) { perto(r.curvatura.sq, E.curvatura.sq, `${m} SQ curvatura`); pval(r.curvatura.p, E.curvatura.p, `${m} curvatura`); }
    if (E.lenth) for (const k of ["PSE", "d", "ME", "SME"]) perto(r.lenth[k], E.lenth[k], `${m} Lenth ${k}`);
  }
  let falta = ""; try { fatorial2k([[-1, -1], [1, -1], [-1, 1]], [1, 2, 3]); } catch (e) { falta = e.message; }
  ok(/falta \(\+,\+\)/.test(falta), `2^k: combinação faltando apontada (${falta})`);
  let desb = ""; try { fatorial2k([[-1, -1], [1, -1], [-1, 1], [1, 1], [1, 1]], [1, 2, 3, 4, 5]); } catch (e) { desb = e.message; }
  ok(/mesmo número de réplicas/.test(desb), "2^k: réplicas desiguais apontadas");

  // ---- leitura de CSV --------------------------------------------------------
  const c1 = lerCSV('﻿fator;y\r\nA;12,5\r\n"B";"1,0e3"\r\n\r\n');
  ok(c1.sep === ";" && c1.colunas.join() === "fator,y" && colunaNumerica(c1, "y").join() === "12.5,1000", "CSV com ; e virgula decimal");
  const c2 = lerCSV('a,b\n"12,5","x""y"\n');
  ok(numeroCSV(c2.linhas[0][0]) === 12.5 && c2.linhas[0][1] === 'x"y', "CSV com , e aspas");
  ok([numeroCSV("12abc"), numeroCSV("1,2,3"), numeroCSV(""), numeroCSV("1.234,5")].every(Number.isNaN), "numero invalido rejeitado");
  let erroLinha = ""; try { colunaNumerica(lerCSV("x;y\n1;2\n3;abc\n"), "y"); } catch (e) { erroLinha = e.message; }
  ok(/linha 3: "abc"/.test(erroLinha), "mensagem aponta a linha do valor invalido");

  return { nOK, falhas };
}
