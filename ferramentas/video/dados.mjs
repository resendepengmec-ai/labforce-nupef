import { readFileSync, writeFileSync } from "node:fs";
const R = new URL("../../", import.meta.url).pathname;
const F = await import(R + "forcas/js/analise.js");
const E = await import(R + "eletrica/js/analise.js");
const ds = (a, n) => { const s = Math.max(1, Math.floor(a.length / n)); const o = []; for (let i = 0; i < a.length; i += s) o.push(+a[i].toFixed(2)); return o; };
// forcas
let log = [];
const fe = F.prepararEnsaio(readFileSync(R + "forcas/samples/torneamento_sintetico.txt", "utf8"), "torneamento", F.PADRAO, log);
const p = { ...F.PADRAO, teorico: { ap: 2, fn: 0.25, vc: 120, kr: 90, g0: 0, kc1: 1500, mc: 0.25, canal: "fz" } };
const c1 = 3006, c2 = 9016;
const fr = F.analisarFaixa(fe, c1, c2, "f1", p, { teorico: true }, log);
const forcas = { t0: fe.t[0], t1: fe.t[fe.N - 1], fx: ds(fe.F.fx, 1400), fy: ds(fe.F.fy, 1400), fz: ds(fe.F.fz, 1400),
  faixa: [fe.t[c1], fe.t[c2]], est: { fz: fr.est.fz, fx: fr.est.fx, fy: fr.est.fy }, teo: fr.teorico };
// eletrica
log = [];
const ee = E.prepararEnsaio(readFileSync(R + "eletrica/testes/dados/E1R1.txt", "utf8"), "E1R1", E.PADRAO, log);
const fs = ee.fs, a1 = Math.round(14.32 * fs), b1 = Math.round(51.19 * fs), a2 = Math.round(60.4 * fs), b2 = Math.round(88.05 * fs);
const r1 = E.analisarFaixa(ee, a1, b1, "E1R1_f1", E.PADRAO, { fft: true, ieee519: true, ieee1459: true }, log);
const q = r1.q;
const eletrica = { fs, regra: ee.regra, N: ee.N, dur: (ee.N - 1) / fs, P: ds(ee.Pinst, 1500), faixas: [[a1 / fs, b1 / fs], [a2 / fs, b2 / fs]],
  Pt: r1.g.Pt, FP: r1.g.FP, U: r1.g.Vrms[0], Ief: r1.g.Ief, f1: r1.f1, defVI: r1.defVI,
  grupos: q.hmin.slice(0, 8), Ih: q.Ih.slice(0, 8).map((r) => Math.max(...r)), limMin: q.limImin.slice(0, 8), limMax: q.limImax.slice(0, 8),
  Vh: q.Vh.slice(0, 8).map((r) => Math.max(...r)), limV: q.multV * q.limVh, TDD: q.TDD, THDv: q.THDv, statusV: q.statusV, statusI: q.statusI,
  Se: r1.r59.tot.Se, PF: r1.r59.tot.PF, In: r1.r59.tot.In, S1p: r1.r59.tot.S1p, FDi: r1.r59.tot.FDi };
writeFileSync("dados.js", "window.DADOS = " + JSON.stringify({ forcas, eletrica }) + ";\n");
console.log(JSON.stringify({ fz: forcas.est.fz.media, teo: forcas.teo.Fc, dif: forcas.teo.dif, fdom: forcas.est.fz.fdom, Pt: eletrica.Pt, FP: eletrica.FP, st: [eletrica.statusV, eletrica.statusI], TDD: eletrica.TDD, grupos: eletrica.grupos, Se: eletrica.Se, PF: eletrica.PF, In: eletrica.In }));
