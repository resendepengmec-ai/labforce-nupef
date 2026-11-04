// autoteste.js - verificacao do modulo de estatistica contra as respostas do SciPy e do
// statsmodels (testes/referencias.js, gerado por gerar_referencias.py).
// Roda no navegador (manual, secao 6) e no Node (testes/teste_estatistica.js).
import REF from "../testes/referencias.js";
import * as D from "./distribuicoes.js";
import * as A from "./algebra.js";
import { anova1 } from "./anova1.js";
import { fatorial2k } from "./fatorial2k.js";
import { ccd, ccdMatriz } from "./ccd.js";
import { manova } from "./manova.js";
import * as Op from "./otimizacao.js";
import * as C from "./conclusoes.js";
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

  // ---- composto central (OLS quadratico do statsmodels) ------------------------
  for (const [caso, E] of Object.entries(REF.ccd)) {
    const r = ccd(E.X, E.Y, { respostas: E.respostas, alfa: E.alfa });
    E.r.forEach((e, ir) => {
      const u = r.respostas[ir], m = `CCD ${caso} ${e.nome}`;
      u.coefs.forEach((c, j) => {
        perto(c.coef, e.coef[j], `${m} coef ${c.rotulo}`, 1e-8); perto(c.ep, e.ep[j], `${m} EP ${c.rotulo}`);
        perto(c.t, e.t[j], `${m} t ${c.rotulo}`, 1e-6); pval(c.p, e.p[j], `${m} ${c.rotulo}`);
      });
      perto(u.R2, e.R2, `${m} R2`); perto(u.R2aj, e.R2aj, `${m} R2 ajustado`); perto(u.R2pred, e.R2pred, `${m} R2 predicao`);
      perto(u.press, e.press, `${m} PRESS`); perto(u.anova.residuo.sq, e.sqRes, `${m} SQ residuo`);
      perto(u.anova.regressao.F, e.F, `${m} F regressao`); pval(u.anova.regressao.p, e.pF, `${m} regressao`);
      perto(u.anova.erroPuro.sq, e.sqEP, `${m} SQ erro puro`); ok(u.anova.erroPuro.gl === e.glEP, `${m} GL erro puro`);
      perto(u.anova.faltaAjuste.F, e.FLoF, `${m} F falta de ajuste`); pval(u.anova.faltaAjuste.p, e.pLoF, `${m} falta de ajuste`);
      u.estacionario.xs.forEach((v, j) => perto(v, e.xs[j], `${m} x_s ${j + 1}`, 1e-8));
      perto(u.estacionario.ys, e.ys, `${m} y no ponto estacionario`, 1e-9);
      u.estacionario.autovalores.forEach((v, j) => perto(v, e.autovalores[j], `${m} autovalor ${j + 1}`, 1e-8));
    });
  }
  // matriz do CCD: k = 2..4 completo; k = 5 e 6 meia fracao com alfa = nF^(1/4)
  for (const [k, nF, alf] of [[2, 4, Math.SQRT2], [3, 8, 8 ** 0.25], [4, 16, 2], [5, 16, 2], [6, 32, 32 ** 0.25]]) {
    const d = ccdMatriz(k, 5);
    ok(d.nF === nF && d.X.length === nF + 2 * k + 5 && Math.abs(d.alfa - alf) < 1e-12, `CCD k = ${k}: ${nF} fatoriais, alfa ${alf.toFixed(4)}`);
  }
  {
    const d = ccdMatriz(5, 0), F = d.X.slice(0, 16);     // resolucao V: efeitos principais e interacoes de 2 nao confundidos
    let ortog = true;
    const cols = [];
    for (let i = 0; i < 5; i++) cols.push(F.map((x) => x[i]));
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) cols.push(F.map((x) => x[i] * x[j]));
    for (let a = 0; a < cols.length; a++) for (let b = a + 1; b < cols.length; b++) if (cols[a].reduce((s, v, n) => s + v * cols[b][n], 0) !== 0) ortog = false;
    ok(ortog, "CCD k = 5: meia fração de resolução V (15 colunas ortogonais)");
  }
  {  // unidades reais: -1/+1 = niveis informados (ex.: 60-80 graus C e 1-3 bar)
    const E = REF.ccd.exemplo, r = ccd(E.X, E.Y, { niveis: [{ baixo: 60, alto: 80 }, { baixo: 1, alto: 3 }] });
    const xs = r.respostas[0].estacionario.xs, xr = r.respostas[0].estacionario.xsReal;
    ok(Math.abs(xr[0] - (70 + 10 * xs[0])) < 1e-9 && Math.abs(xr[1] - (2 + xs[1])) < 1e-9, "CCD: ponto estacionário em unidades reais");
  }
  let msgSing = ""; try { ccd([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], [[1], [2], [3], [4], [5], [6], [7]]); } catch (e) { msgSing = e.message; }
  ok(/X'X é singular/.test(msgSing), "CCD: X'X singular com mensagem");

  // ---- MANOVA de um fator (statsmodels MANOVA.mv_test) ------------------------
  for (const [caso, E] of Object.entries(REF.manova)) {
    const r = manova(E.grupos, E.respostas, E.alfa), m = `MANOVA ${caso}`;
    for (const [k, e] of Object.entries(E.estatisticas)) {
      const u = r.estatisticas[k];
      perto(u.valor, e.valor, `${m} ${k} valor`); perto(u.F, e.F, `${m} ${k} F`);
      perto(u.df1, e.df1, `${m} ${k} GL1`); perto(u.df2, e.df2, `${m} ${k} GL2`); pval(u.p, e.p, `${m} ${k}`);
    }
    E.univariadas.forEach((e, j) => { perto(r.univariadas[j].F, e.F, `${m} ANOVA ${E.respostas[j]} F`); pval(r.univariadas[j].p, e.p, `${m} ANOVA ${E.respostas[j]}`); });
    ok(Math.abs(r.alfaB - E.alfa / E.respostas.length) < 1e-15, `${m} Bonferroni alfa/p`);
  }

  // ---- otimizacao ---------------------------------------------------------------
  {
    const O = REF.otimizacao;
    O.desejabilidade.forEach((c, i) => {
      c.d.forEach((v, j) => perto(Op.desejabilidade(c.y[j], O.objetivos[j]), v, `desejabilidade caso ${i + 1} resposta ${j + 1}`, 1e-12));
      perto(Op.desejabilidadeGlobal(c.y, O.objetivos), c.D, `D global caso ${i + 1}`, 1e-12);
    });
    const t = Op.topsis(O.topsis.M, O.topsis.beneficio, O.topsis.pesos);
    t.proximidade.forEach((v, i) => perto(v, O.topsis.proximidade[i], `TOPSIS proximidade ${i + 1}`, 1e-12));
    // alvo nao da mais NaN (eStat)
    ok(Op.desejabilidade(5, { tipo: "alvo", L: 0, U: 10, T: 5 }) === 1 && Op.desejabilidade(2.5, { tipo: "alvo", L: 0, U: 10, T: 5 }) === 0.5, "desejabilidade alvo (eStat dava NaN)");
    // desejabilidade: maximo conhecido de y = 10 - (x1 - 0,3)^2 - (x2 + 0,2)^2
    const r = Op.otimizarDesejabilidade([(x) => 10 - (x[0] - 0.3) ** 2 - (x[1] + 0.2) ** 2], [{ tipo: "max", L: 0, U: 10 }], 2, { tipo: "cubo" }, 7);
    ok(Math.abs(r.x[0] - 0.3) < 1e-4 && Math.abs(r.x[1] + 0.2) < 1e-4 && r.D > 0.99999, `desejabilidade acha o máximo (${r.x.map((v) => v.toFixed(5))})`);
    // NSGA-II: f1 = x^2, f2 = (x-1)^2 -> frente em [0, 1]; mesma semente, mesmo resultado
    const ns = Op.nsga2((x) => [x[0] ** 2, (x[0] - 1) ** 2], 1, { tipo: "cubo" }, { pop: 60, geracoes: 60, semente: 42 });
    const xs = ns.frente.map((p) => p.x[0]);
    // frente aproximada: pontos a menos de 0,01 do conjunto de Pareto exato [0, 1]
    ok(xs.length >= 40 && xs.every((v) => v >= -0.01 && v <= 1.01) && Math.min(...xs) < 0.02 && Math.max(...xs) > 0.98, `NSGA-II: frente cobre [0, 1] (${xs.length} pontos)`);
    const F = ns.frente.map((p) => p.f);
    ok(F.every((a) => !F.some((b) => b[0] <= a[0] && b[1] <= a[1] && (b[0] < a[0] || b[1] < a[1]))), "NSGA-II: frente sem pontos dominados");
    const ns2 = Op.nsga2((x) => [x[0] ** 2, (x[0] - 1) ** 2], 1, { tipo: "cubo" }, { pop: 60, geracoes: 60, semente: 42 });
    ok(JSON.stringify(ns2.frente.map((p) => p.x)) === JSON.stringify(ns.frente.map((p) => p.x)), "NSGA-II: mesma semente, mesmo resultado");
    // regiao esferica do CCD respeitada
    const esf = Op.nsga2((x) => [-x[0], -x[1]], 2, { tipo: "esfera", raio: Math.SQRT2 }, { pop: 40, geracoes: 30, semente: 3 });
    ok(esf.frente.every((p) => Math.hypot(...p.x) <= Math.SQRT2 + 1e-9), "NSGA-II: busca dentro da esfera de raio alfa");
    let msg = ""; try { Op.conferirObjetivo({ tipo: "alvo", L: 0, U: 10, T: 12 }, "Ra"); } catch (e) { msg = e.message; }
    ok(/Ra: o alvo precisa ficar entre/.test(msg), "objetivo inválido apontado");
  }

  // ---- conclusoes em texto (regras) ---------------------------------------------
  {
    ok([C.fmtP(0.04996), C.fmtP(0.003), C.fmtP(0.41), C.fmtP(0.00002), C.fmtP(1)].join("|") === "0,04996|0,003|0,41|< 0,0001|1", `valor-p formatado (${[C.fmtP(0.04996), C.fmtP(0.003), C.fmtP(0.41), C.fmtP(0.00002), C.fmtP(1)].join("|")})`);
    ok(C.num(4.2) === "4,2" && C.num(-1234.567) === "−1235" && C.num(0.0012346) === "0,001235", `número com vírgula decimal (${C.num(4.2)} ${C.num(-1234.567)} ${C.num(0.0012346)})`);
    const fe = C.conclusoesFatorial(fatorial2k(REF.fatorial2k.exemplo.X, REF.fatorial2k.exemplo.y));
    ok(fe.some((s) => /O fator B \(B\) não tem efeito principal significativo, mas participa de AB, BC/.test(s)), "conclusões 2^k: fator só em interações");
    const limpo = (fr, m) => ok(fr.length > 0 && fr.every((s) => !/NaN|undefined|Infinity|\[object/.test(s)), `${m}: texto sem NaN/undefined (${fr.find((s) => /NaN|undefined|Infinity/.test(s)) || ""})`);
    const a = C.conclusoesAnova1(anova1(REF.anova1.exemplo.grupos), "o resultado");
    limpo(a, "conclusões ANOVA"); ok(/As médias dos grupos diferem/.test(a[0]) && a.some((s) => /^Tukey: a média de D supera a de A/.test(s)), "conclusões ANOVA: F e Tukey");
    const fs = C.conclusoesFatorial(fatorial2k(REF.fatorial2k.sem_replica.X, REF.fatorial2k.sem_replica.y));
    limpo(fs, "conclusões 2^k sem réplica"); ok(/método de Lenth/.test(fs[0]) && fs.some((s) => /^O fator A \(A\) é significativo .*aumenta/.test(s)), "conclusões 2^k: Lenth e efeito de A");
    const fc = C.conclusoesFatorial(fatorial2k(REF.fatorial2k.centrais.X, REF.fatorial2k.centrais.y));
    limpo(fc, "conclusões 2^k com centrais"); ok(fc.some((s) => /^Há curvatura/.test(s)), "conclusões 2^k: curvatura detectada");
    const cc = ccd(REF.ccd.k3.X, REF.ccd.k3.Y, { respostas: REF.ccd.k3.respostas });
    const t1 = C.conclusoesCcd(cc.respostas[0], 0.05, cc.alfaAxial), t2 = C.conclusoesCcd(cc.respostas[1], 0.05, cc.alfaAxial);
    limpo([...t1, ...t2], "conclusões CCD");
    ok(t1.some((s) => /é um máximo/.test(s)) && t2.some((s) => /ponto de sela/.test(s)), "conclusões CCD: máximo (rendimento) e sela (custo)");
    ok(t1.some((s) => /falta de ajuste/i.test(s)), "conclusões CCD: falta de ajuste comentada");
    const mv = C.conclusoesManova(manova(REF.manova.g3r2.grupos, REF.manova.g3r2.respostas));
    limpo(mv, "conclusões MANOVA");
    const ot = Op.otimizar([cc.respostas[0].prever, cc.respostas[1].prever], [{ tipo: "max", L: 70, U: 85 }, { tipo: "min", L: 15, U: 30 }],
      ["rendimento", "custo"], 3, { tipo: "esfera", raio: cc.alfaAxial }, { pop: 40, geracoes: 30, semente: 9 });
    const to = C.conclusoesOtimizacao(ot, ["x1", "x2", "x3"]);
    limpo(to, "conclusões otimização"); ok(/Semente do gerador: 9/.test(to[to.length - 1]), "conclusões otimização: semente registrada");
  }

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
