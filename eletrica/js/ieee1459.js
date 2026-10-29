// ieee1459.js - grandezas de potencia da IEEE Std 1459-2010, 4 fios
// (porte de potenciasIEEE1459.sci v5.3.3). Tensoes fase-neutro, correntes de
// linha, In = -(ia+ib+ic) CALCULADA. Ver hipoteses no cabecalho do .sci.
import { ciclosSincronos, mapaRaias, dftJanelas, rnd } from "./nucleo.js";
import { sprintf, nv } from "../../comum/js/formato.js";

// complexos como [re, im]
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const cabs2 = (a) => a[0] * a[0] + a[1] * a[1];
const cexp = (t) => [Math.cos(t), Math.sin(t)];

export function analiseIEEE1459(V, I, fs, fRede, f1, atraso = [0, 0, 0, 0, 0, 0]) {
  const r = { ok: false };
  if (atraso.length !== 6) throw new Error("analiseIEEE1459: atraso deve ter 6 valores [Va Vb Vc Ia Ib Ic] em segundos.");
  const { m: mC, Nw } = ciclosSincronos(fs, fRede, 12);
  const nW = Math.floor(V[0].length / Nw);
  if (nW < 1) { r.msg = "faixa menor que 200 ms"; return r; }
  const mp = mapaRaias(fs, f1, Nw);
  const sub = [mp.bF - 1, mp.bF, mp.bF + 1];        // subgrupo da fundamental
  const nRuido = mp.nb - 4;
  const XV = V.map((x) => dftJanelas(x, Nw)), XI = I.map((x) => dftJanelas(x, Nw));
  const nb = mp.nb;
  // sinais por raia: Va Vb Vc, Vab Vbc Vca, Ia Ib Ic, In
  const comb = (cs) => {              // cs: [[coef, D], ...] -> {re, im}
    const re = [], im = [];
    for (let j = 0; j < nW; j++) {
      const a = new Float64Array(nb), b = new Float64Array(nb);
      for (const [c, D] of cs) for (let k = 0; k < nb; k++) { a[k] += c * D.re[j][k]; b[k] += c * D.im[j][k]; }
      re.push(a); im.push(b);
    }
    return { re, im };
  };
  const sinais = [XV[0], XV[1], XV[2],
    comb([[1, XV[0]], [-1, XV[1]]]), comb([[1, XV[1]], [-1, XV[2]]]), comb([[1, XV[2]], [-1, XV[0]]]),
    XI[0], XI[1], XI[2], comb([[-1, XI[0]], [-1, XI[1]], [-1, XI[2]]])];
  const T = [], F = [], R = [];
  for (const X of sinais) {
    const t = new Float64Array(nW), f = new Float64Array(nW), rr = new Float64Array(nW);
    for (let j = 0; j < nW; j++) {
      const re = X.re[j], im = X.im[j];
      let s = 0; for (let k = 0; k < nb; k++) s += re[k] * re[k] + im[k] * im[k];
      t[j] = s;
      f[j] = sub.reduce((u, k) => u + re[k] * re[k] + im[k] * im[k], 0);
      rr[j] = mp.ruidoB.length ? mp.ruidoB.reduce((u, k) => u + re[k] * re[k] + im[k] * im[k], 0) / mp.ruidoB.length : 0;
    }
    T.push(t); F.push(f); R.push(rr);
  }
  // fasores fundamentais (raia central) com correcao de atraso
  const w1 = 2 * Math.PI * f1, bF = mp.bF;
  const Vp = [0, 1, 2].map((k) => { const c = cexp(-w1 * atraso[k]);
    return XV[k].re.map((re, j) => cmul([re[bF], XV[k].im[j][bF]], c)); });
  const Ip = [0, 1, 2].map((k) => { const c = cexp(-w1 * atraso[k + 3]);
    return XI[k].re.map((re, j) => cmul([re[bF], XI[k].im[j][bF]], c)); });
  const a = cexp(2 * Math.PI / 3), a2 = cmul(a, a);
  const seq = [[[1, 0], a, a2], [[1, 0], a2, a], [[1, 0], [1, 0], [1, 0]]];
  const sim = (P) => seq.map((lin) => P[0].map((_, j) => {
    let s = [0, 0];
    for (let k = 0; k < 3; k++) s = cadd(s, cmul(lin[k], P[k][j]));
    return [s[0] / 3, s[1] / 3];
  }));
  const Vs = sim(Vp), Is = sim(Ip);
  const Pw = new Float64Array(nW), P1w = new Float64Array(nW), S1pw = [], S1pmw = new Float64Array(nW);
  for (let j = 0; j < nW; j++) {
    for (let k = 0; k < 3; k++) {
      let s = 0; for (let n = j * Nw; n < (j + 1) * Nw; n++) s += V[k][n] * I[k][n];
      Pw[j] += s / Nw;
      P1w[j] += Vp[k][j][0] * Ip[k][j][0] + Vp[k][j][1] * Ip[k][j][1];   // real(V conj(I))
    }
    const v = Vs[0][j], i = Is[0][j];
    S1pw.push([3 * (v[0] * i[0] + v[1] * i[1]), 3 * (v[1] * i[0] - v[0] * i[1])]);
    S1pmw[j] = 3 * Math.sqrt(cabs2(v)) * Math.sqrt(cabs2(i));
  }
  const dados = { T, F, R, Vs, Is, Pw, P1w, S1pw, S1pmw, nRuido };
  r.tot = agregaIEEE1459(dados, Array.from({ length: nW }, (_, j) => j));
  const nJ3 = rnd(3 * fRede / mC);
  const nB = Math.max(Math.floor(nW / nJ3), 1), tamB = Math.min(nJ3, nW);
  r.blocos = [];
  for (let j = 0; j < nB; j++) r.blocos.push(agregaIEEE1459(dados, Array.from({ length: tamB }, (_, z) => j * tamB + z)));
  Object.assign(r, { nB, tamB, Tw: Nw / fs, nW, atraso, ok: true, msg: "" });
  return r;
}

function agregaIEEE1459(d, idx) {
  const n = idx.length;
  const m = (x) => idx.reduce((s, j) => s + x[j], 0) / n;
  const Rm = d.R.map(m);
  const Fc = d.F.map((f, s) => Math.max(m(f) - 2 * Rm[s], 0));
  const Tc = d.T.map((t, s) => Math.max(m(t) - d.nRuido * Rm[s], Fc[s]));
  const g = {};
  g.Vrms = Tc.slice(0, 3).map(Math.sqrt); g.Vlin = Tc.slice(3, 6).map(Math.sqrt);
  g.Irms = Tc.slice(6, 9).map(Math.sqrt); g.In = Math.sqrt(Tc[9]);
  const sm = (x, i0, i1) => x.slice(i0, i1).reduce((s, z) => s + z, 0);
  g.Ve = Math.sqrt((3 * sm(Tc, 0, 3) + sm(Tc, 3, 6)) / 18);
  g.Ve1 = Math.sqrt((3 * sm(Fc, 0, 3) + sm(Fc, 3, 6)) / 18);
  g.Ie = Math.sqrt(sm(Tc, 6, 10) / 3);
  g.Ie1 = Math.sqrt(sm(Fc, 6, 10) / 3);
  g.VeH = Math.sqrt(Math.max(g.Ve ** 2 - g.Ve1 ** 2, 0));
  g.IeH = Math.sqrt(Math.max(g.Ie ** 2 - g.Ie1 ** 2, 0));
  g.P = m(d.Pw); g.P1 = m(d.P1w); g.PH = g.P - g.P1;
  g.Se = 3 * g.Ve * g.Ie; g.Se1 = 3 * g.Ve1 * g.Ie1;
  g.SeN = Math.sqrt(Math.max(g.Se ** 2 - g.Se1 ** 2, 0));
  g.DeI = 3 * g.Ve1 * g.IeH; g.DeV = 3 * g.VeH * g.Ie1; g.SeH = 3 * g.VeH * g.IeH;
  g.P1p = idx.reduce((s, j) => s + d.S1pw[j][0], 0) / n;
  g.Q1p = idx.reduce((s, j) => s + d.S1pw[j][1], 0) / n;
  g.S1p = m(d.S1pmw);
  g.SU1 = Math.sqrt(Math.max(g.Se1 ** 2 - g.S1p ** 2, 0));
  g.PF = g.P / g.Se; g.PF1p = g.P1p / g.S1p; g.LU = g.SU1 / g.S1p; g.HP = g.SeN / g.Se1;
  g.THDeV = 100 * g.VeH / g.Ve1; g.THDeI = 100 * g.IeH / g.Ie1;
  const rmsS = (S) => S.map((lin) => Math.sqrt(idx.reduce((s, j) => s + cabs2(lin[j]), 0) / n));
  const rA = rmsS(d.Vs), rI = rmsS(d.Is);
  g.Vpos = rA[0]; g.Ipos = rI[0]; g.I0 = rI[2];
  g.FDv = 100 * rA[1] / rA[0]; g.V0v = 100 * rA[2] / rA[0]; g.FDi = 100 * rI[1] / rI[0];
  return g;
}

export function relatorioIEEE1459(r) {
  const g = r.tot, L = [];
  L.push("  IEEE 1459-2010 (4 fios; In = -(ia+ib+ic), calculada; ruido subtraido)");
  L.push(sprintf("  P = %.1f W | Se = %.1f VA | PF = %.3f | Ve = %.1f V | Ie = %.3f A | In = %.3f A",
    g.P, g.Se, g.PF, g.Ve, g.Ie, g.In));
  L.push(sprintf("  P1+ = %.1f W | Q1+ = %.1f var | S1+ = %.1f VA | PF1+ = %.3f | SU1 = %.1f VA | LU = %.3f",
    g.P1p, g.Q1p, g.S1p, g.PF1p, g.SU1, g.LU));
  L.push(sprintf("  V-/V+ = %.2f %% | V0/V+ = %.2f %% | I-/I+ = %.2f %% | I0 = %.3f A", g.FDv, g.V0v, g.FDi, g.I0));
  L.push(sprintf("  THDeV = %.2f %% | THDeI = %.2f %% | SeN = %.1f | DeI = %.1f | DeV = %.1f | SeH = %.1f VA | PH = %.1f W",
    g.THDeV, g.THDeI, g.SeN, g.DeI, g.DeV, g.SeH, g.PH));
  if (r.atraso.some((x) => x !== 0)) {
    L.push("  angulos corrigidos pelo atraso entre canais [us]: " + r.atraso.map((x) => String(rnd(1e6 * x))).join(" "));
  }
  return L;
}

export function cabecalhoIEEE1459() {
  return "Ensaio;P[W];Se[VA];PF;Ve[V];Ie[A];In[A];Se1[VA];P1+[W];Q1+[var];S1+[VA];PF1+;SU1[VA];LU;" +
    "V-/V+[%];V0/V+[%];I-/I+[%];I0[A];THDeV[%];THDeI[%];SeN[VA];DeI[var];DeV[var];SeH[VA];PH[W];HP";
}

export function linhaIEEE1459(r, nome) {
  const g = r.tot;
  const v = [g.P, g.Se, g.PF, g.Ve, g.Ie, g.In, g.Se1, g.P1p, g.Q1p, g.S1p, g.PF1p, g.SU1, g.LU,
    g.FDv, g.V0v, g.FDi, g.I0, g.THDeV, g.THDeI, g.SeN, g.DeI, g.DeV, g.SeH, g.PH, g.HP];
  const f = ["%.1f", "%.1f", "%.3f", "%.1f", "%.3f", "%.3f", "%.1f", "%.1f", "%.1f", "%.1f", "%.3f", "%.1f", "%.3f",
    "%.2f", "%.2f", "%.2f", "%.3f", "%.2f", "%.2f", "%.1f", "%.1f", "%.1f", "%.1f", "%.1f", "%.3f"];
  return [nome, ...v.map((x, k) => nv(x, f[k]))].join(";");
}
