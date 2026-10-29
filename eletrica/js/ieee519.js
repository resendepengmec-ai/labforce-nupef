// ieee519.js - harmonicos e limites da IEEE Std 519-2022 (porte de qualidadeIEEE519.sci v5.3.3)
// Mesma metodologia (ver cabecalho do .sci): janelas sincronas de ~12 ciclos,
// blocos de 3 s, P99 x 1,5 (V) / 2,0 (I), grupos de ordens rebatidas,
// ruido subtraido apos a agregacao, LD. Resultado INDICATIVO (medido no quadro).
import { ciclosSincronos, mapaRaias, dftJanelas, percentil, rnd } from "./nucleo.js";
import { sprintf, nv } from "./formato.js";

export function limitesTensaoIEEE519(Vlinha) {
  if (Vlinha <= 1e3) return { limVh: 5.0, limTHD: 8.0 };
  if (Vlinha <= 69e3) return { limVh: 3.0, limTHD: 5.0 };
  if (Vlinha <= 161e3) return { limVh: 1.5, limTHD: 2.5 };
  return { limVh: 1.0, limTHD: 1.5 };
}

// Tabela 2 (120 V a 69 kV). Pares h <= 6 -> 50 % do limite.
export function limitesCorrenteIEEE519(h, IscIL) {
  const tab = [[4.0, 2.0, 1.5, 0.6, 0.3, 5.0], [7.0, 3.5, 2.5, 1.0, 0.5, 8.0],
    [10.0, 4.5, 4.0, 1.5, 0.7, 12.0], [12.0, 5.5, 5.0, 2.0, 1.0, 15.0],
    [15.0, 7.0, 6.0, 2.5, 1.4, 20.0]];
  const r = [20, 50, 100, 1000].filter((x) => IscIL >= x).length;
  const limI = h.map((hh) => {
    const fx = [11, 17, 23, 35].filter((x) => hh >= x).length;
    let L = tab[r][fx];
    if (hh % 2 === 0 && hh <= 6) L *= 0.5;
    return L;
  });
  return { limI, limTDD: tab[r][5] };
}

export function situacaoLimite(x, LD, Lmin, Lmax) {
  const xe = Math.sqrt(Math.max(x * x - LD * LD, 0));
  if (x <= Lmin) return "ATENDE";
  if (xe > Lmax) return "EXCEDE";
  if (x <= Lmax) return "INCONCL_ORDEM";
  return "INCONCL_RUIDO";
}

export function situacaoGeral(st) {
  if (st.includes("EXCEDE")) return "EXCEDE";
  if (st.every((s) => s === "ATENDE")) return "ATENDE";
  return "INCONCLUSIVO";
}

const mediaIdx = (x, i0, n) => { let s = 0; for (let i = i0; i < i0 + n; i++) s += x[i]; return s / n; };

// V, I: arrays de 3 Float64Array (V fase-neutro e A). IL = NaN -> maior I1 de 3 s.
export function analiseIEEE519(V, I, fs, fRede, f1, IscIL, IL) {
  const q = { ok: false };
  const { m: mC, Nw } = ciclosSincronos(fs, fRede, 12);
  const nW = Math.floor(V[0].length / Nw);
  if (nW < 1) { q.msg = "faixa menor que 200 ms"; return q; }
  const mp = mapaRaias(fs, f1, Nw);
  const { df, h, b, bF, ruidoB } = mp;
  // grupos de ordens por raia, em ordem crescente da menor ordem
  let grupos = mp.gb.map((g) => ({ bin: g, ordens: h.filter((hh, i) => b[i] === g && hh >= 2) }));
  grupos.forEach((g) => { g.hmin = Math.min(...g.ordens); });
  grupos = grupos.map((g, i) => ({ ...g, i })).sort((p, r) => p.hmin - r.hmin || p.i - r.i);
  const gb = grupos.map((g) => g.bin), ng = gb.length;
  const naoMed = h.filter((hh, i) => hh >= 2 && (b[i] === 0 || b[i] === bF));
  const nJ3 = rnd(3 * fRede / mC);
  let nB = Math.floor(nW / nJ3), tamB;
  q.blocoCurto = nB < 1;
  if (nB < 1) { nB = 1; tamB = nW; } else tamB = nJ3;

  const proc = (X) => {        // X: 3 sinais -> G[k][g][j], F1[k][j], Rb[k]
    const G = [], F1 = [], Rb = [];
    for (let k = 0; k < 3; k++) {
      const D = dftJanelas(X[k], Nw);
      const P = D.re.map((re, j) => { const im = D.im[j]; const p = new Float64Array(re.length);
        for (let z = 0; z < re.length; z++) p[z] = re[z] * re[z] + im[z] * im[z]; return p; });
      const pr = P.map((p) => (ruidoB.length ? ruidoB.reduce((s, z) => s + p[z], 0) / ruidoB.length : 0));
      const Gk = gb.map(() => new Float64Array(nB)), Fk = new Float64Array(nB);
      for (let j = 0; j < nB; j++) {
        const j0 = j * tamB;
        const prm = mediaIdx(pr, j0, tamB);
        for (let g = 0; g < ng; g++) {
          let s = 0; for (let jj = j0; jj < j0 + tamB; jj++) s += P[jj][gb[g]];
          Gk[g][j] = Math.sqrt(Math.max(s / tamB - prm, 0));
        }
        let s = 0; for (let jj = j0; jj < j0 + tamB; jj++) s += P[jj][bF];
        Fk[j] = Math.sqrt(s / tamB);
      }
      G.push(Gk); F1.push(Fk);
      Rb.push(Math.sqrt(pr.reduce((s, z) => s + z, 0) / pr.length));
    }
    return { G, F1, Rb };
  };
  const rv = proc(V), ri = proc(I);
  q.Vg = rv.G; q.V1 = rv.F1; q.ruidoV = rv.Rb;
  q.Ig = ri.G; q.I1 = ri.F1; q.ruidoI = ri.Rb;

  q.ILauto = Number.isNaN(IL);
  if (q.ILauto) IL = Math.max(...q.I1.map((a) => Math.max(...a)));
  q.IL = IL; q.IscIL = IscIL;
  const mediaV1 = q.V1.reduce((s, a) => s + a.reduce((u, z) => u + z, 0), 0) / (3 * nB);
  q.Vlinha = Math.sqrt(3) * mediaV1;
  const { limVh, limTHD } = limitesTensaoIEEE519(q.Vlinha);
  const { limI, limTDD } = limitesCorrenteIEEE519(h, IscIL);
  Object.assign(q, { limVh, limTHD, limTDD, multV: 1.5, multI: 2.0 });
  q.grupos = grupos.map((g) => g.ordens); q.hmin = grupos.map((g) => g.hmin);
  q.binHz = gb.map((g) => g * df); q.naoMed = naoMed;
  Object.assign(q, { nB, nW, Tw: Nw / fs, tamB });

  q.Vh = gb.map(() => [0, 0, 0]); q.Ih = gb.map(() => [0, 0, 0]);
  q.THDv = [0, 0, 0]; q.TDD = [0, 0, 0]; q.THDi = [0, 0, 0];
  q.THDv3 = [[], [], []]; q.TDD3 = [[], [], []];
  for (let k = 0; k < 3; k++) {
    const V1 = q.V1[k], I1 = q.I1[k];
    for (let g = 0; g < ng; g++) {
      q.Vh[g][k] = percentil(Array.from(q.Vg[k][g], (v, j) => 100 * v / V1[j]), 99);
      q.Ih[g][k] = percentil(Array.from(q.Ig[k][g], (v) => 100 * v / IL), 99);
    }
    const Hi = [], Hv = [];
    for (let j = 0; j < nB; j++) {
      let si = 0, sv = 0;
      for (let g = 0; g < ng; g++) { si += q.Ig[k][g][j] ** 2; sv += q.Vg[k][g][j] ** 2; }
      Hi.push(Math.sqrt(si)); Hv.push(Math.sqrt(sv));
    }
    q.THDv3[k] = Hv.map((v, j) => 100 * v / V1[j]);
    q.TDD3[k] = Hi.map((v) => 100 * v / IL);
    q.THDv[k] = percentil(q.THDv3[k], 99);
    q.TDD[k] = percentil(q.TDD3[k], 99);
    q.THDi[k] = percentil(Hi.map((v, j) => 100 * v / I1[j]), 99);
  }
  const kLD = Math.sqrt(3 / Math.sqrt(tamB));
  q.LDv = 100 * kLD * Math.max(...q.ruidoV) / mediaV1;
  q.LDi = 100 * kLD * Math.max(...q.ruidoI) / IL;
  const kT = Math.sqrt(3 * Math.sqrt(ng) / Math.sqrt(tamB));
  q.LDthd = 100 * kT * Math.max(...q.ruidoV) / mediaV1;
  q.LDtdd = 100 * kT * Math.max(...q.ruidoI) / IL;
  q.limImin = []; q.limImax = []; q.stV = []; q.stI = [];
  for (let g = 0; g < ng; g++) {
    const L = q.grupos[g].map((hh) => limI[hh - 1]);
    q.limImin.push(q.multI * Math.min(...L)); q.limImax.push(q.multI * Math.max(...L));
    q.stV.push(situacaoLimite(Math.max(...q.Vh[g]), q.LDv, q.multV * limVh, q.multV * limVh));
    q.stI.push(situacaoLimite(Math.max(...q.Ih[g]), q.LDi, q.limImin[g], q.limImax[g]));
  }
  q.stTHDv = situacaoLimite(Math.max(...q.THDv), q.LDthd, q.multV * limTHD, q.multV * limTHD);
  q.stTDD = situacaoLimite(Math.max(...q.TDD), q.LDtdd, q.multI * limTDD, q.multI * limTDD);
  q.statusV = situacaoGeral([...q.stV, q.stTHDv]);
  q.statusI = situacaoGeral([...q.stI, q.stTDD]);
  q.ok = true; q.msg = "";
  return q;
}

// Situacao forcada quando a taxa de amostragem variou no ensaio
export function marcarFsInstavel(q) {
  const s = "FS_INSTAVEL";
  q.stTHDv = s; q.stTDD = s; q.statusV = s; q.statusI = s;
  q.stV = q.stV.map(() => s); q.stI = q.stI.map(() => s);
}

const rotulosGrupos = (q) => q.grupos.map((g) => g.join("/"));
const ternario = (c, a, b) => (c ? a : b);

// Texto do relatorio (console) e CSV por grupo: <ensaio>_IEEE519_harmonicos.csv
export function relatorioIEEE519(q) {
  const L = [];
  L.push(sprintf("  IEEE 519-2022 (indicativo; %d valores de 3 s; Vlinha = %.0f V; Isc/IL = %g; IL = %.2f A%s)",
    q.nB, q.Vlinha, q.IscIL, q.IL, ternario(q.ILauto, " [auto]", "")));
  if (q.blocoCurto) L.push(sprintf("  AVISO: faixa < 3 s; usado 1 bloco de %d janelas.", q.tamB));
  L.push(sprintf("  THDv [%%] = %5.2f %5.2f %5.2f  (lim P99 3 s = %.1f)  %s", ...q.THDv, q.multV * q.limTHD, q.stTHDv));
  L.push(sprintf("  TDD  [%%] = %5.2f %5.2f %5.2f  (lim P99 3 s = %.1f)  %s | THDi = %5.2f %5.2f %5.2f",
    ...q.TDD, q.multI * q.limTDD, q.stTDD, ...q.THDi));
  const nm = q.naoMed.length ? q.naoMed.join(",") : "nenhuma";
  L.push(sprintf("  LD: harmonico I = %.2f %% de IL, TDD = %.2f %% | ordens nao mensuraveis: %s", q.LDi, q.LDtdd, nm));
  L.push(sprintf("  Situacao: tensao %s | corrente %s", q.statusV, q.statusI));
  const rot = rotulosGrupos(q);
  const cab = "raia[Hz];ordens;Va[%];Vb[%];Vc[%];limV_P99[%];situacaoV;Ia[%IL];Ib[%IL];Ic[%IL];limI_min[%IL];limI_max[%IL];LD_I[%IL];situacaoI";
  const lin = rot.map((r, g) => [nv(q.binHz[g], "%.0f"), r,
    nv(q.Vh[g][0], "%.2f"), nv(q.Vh[g][1], "%.2f"), nv(q.Vh[g][2], "%.2f"),
    nv(q.multV * q.limVh, "%.1f"), q.stV[g],
    nv(q.Ih[g][0], "%.2f"), nv(q.Ih[g][1], "%.2f"), nv(q.Ih[g][2], "%.2f"),
    nv(q.limImin[g], "%.1f"), nv(q.limImax[g], "%.1f"), nv(q.LDi, "%.2f"), q.stI[g]].join(";"));
  return { texto: L, csv: [cab, ...lin] };
}

export function cabecalhoResumoIEEE519() {
  return "Ensaio;f1[Hz];n_3s;THDv_a[%];THDv_b[%];THDv_c[%];limTHDv_P99[%];situacao_THDv;" +
    "TDD_a[%];TDD_b[%];TDD_c[%];limTDD_P99[%];situacao_TDD;THDi_a[%];THDi_b[%];THDi_c[%];" +
    "IL[A];Isc/IL;LD_I[%IL];LD_TDD[%IL];situacao_tensao;situacao_corrente";
}

export function linhaResumoIEEE519(q, nome, f1) {
  return [nome, nv(f1, "%.3f"), String(q.nB),
    nv(q.THDv[0], "%.2f"), nv(q.THDv[1], "%.2f"), nv(q.THDv[2], "%.2f"),
    nv(q.multV * q.limTHD, "%.1f"), q.stTHDv,
    nv(q.TDD[0], "%.2f"), nv(q.TDD[1], "%.2f"), nv(q.TDD[2], "%.2f"),
    nv(q.multI * q.limTDD, "%.1f"), q.stTDD,
    nv(q.THDi[0], "%.2f"), nv(q.THDi[1], "%.2f"), nv(q.THDi[2], "%.2f"),
    nv(q.IL, "%.3f"), nv(q.IscIL, "%g"), nv(q.LDi, "%.2f"), nv(q.LDtdd, "%.2f"),
    q.statusV, q.statusI].join(";");
}
