// figuras.js - figuras da analise eletrica (espectro, IEEE 519, IEEE 1459)
import { painel, novaFigura, ESTILOS, serie, hlin, maxF } from "../../comum/js/graficos.js";

// ---- figuras da analise --------------------------------------------------
export function figuraEspectro(R, fs) {
  const { c, ctx } = novaFigura(1100, 800);
  [["V", R.eV, "amplitude de pico [V]", "Va [V]|Vb [V]|Vc [V]"], ["I", R.eI, "amplitude de pico [A]", "Ia [A]|Ib [A]|Ic [A]"]]
    .forEach(([s, e3, yl, rots], p) => {
      const f = e3[0].f.subarray(1), Y = e3.map((e) => Array.from(e.A.subarray(1), (v) => Math.max(v, 1e-6)));
      const ymax = maxF(Y), ymin = Math.max(Math.min(...Y.flat().filter((v) => v > 0)), ymax * 1e-7);
      painel(ctx, { x: 0, y: p * 400, w: 1100, h: 400 }, {
        titulo: p === 0 ? `${R.rotulo} - espectro das tensões | f1 = ${R.f1.toFixed(3).replace(".", ",")} Hz`
          : `espectro das correntes - acima de ${String(fs / 2).replace(".", ",")} Hz há dobramento`,
        xlabel: "f [Hz]", ylabel: yl, xlim: [f[0], f[f.length - 1]], ylim: [ymin, ymax * 2], logY: true,
        series: Y.map((y, k) => serie(f, y, k, rots.split("|")[k], { nMarc: 25, desloc: Math.round(k * f.length / 75), largura: 1 })),
      });
    });
  return c;
}

export function figuraIEEE519(q, t0) {
  const { c, ctx } = novaFigura(1300, 900);
  const ng = q.grupos.length, x = Array.from({ length: ng }, (_, i) => i + 1), xl = [0.5, ng + 0.5];
  const cores = ESTILOS.slice(0, 3).map((e) => e.cor);
  const tik = { pos: x, rot: q.hmin.map(String) };
  const W = 650, H = 450;
  const colV = (k) => q.Vh.map((r) => r[k]), colI = (k) => q.Ih.map((r) => r[k]);
  painel(ctx, { x: 0, y: 0, w: W, h: H }, {
    titulo: "Tensão: harmônicos (P99 dos valores de 3 s)", xlabel: "menor ordem do grupo (ordens rebatidas: ver CSV)",
    ylabel: "% de V1", xlim: xl, ylim: [0, 1.7 * maxF(q.Vh, q.multV * q.limVh)], xticks: tik,
    barras: { x, Y: [0, 1, 2].map(colV), cores, rotulos: ["Va [% V1]", "Vb [% V1]", "Vc [% V1]"] },
    series: [hlin(...xl, q.multV * q.limVh, "red", "-", "limite 3 s = 1,5x [% V1]"),
      hlin(...xl, q.limVh, "red", "--", "limite 10 min = 1,0x [% V1]"), hlin(...xl, q.LDv, "black", ":", "LD [% V1]")],
  });
  painel(ctx, { x: W, y: 0, w: W, h: H }, {
    titulo: "Corrente: harmônicos (P99 dos valores de 3 s)", xlabel: "menor ordem do grupo (ordens rebatidas: ver CSV)",
    ylabel: "% de IL", xlim: xl, ylim: [0, 1.7 * maxF(q.Ih, q.limImax)], xticks: tik,
    barras: { x, Y: [0, 1, 2].map(colI), cores, rotulos: ["Ia [% IL]", "Ib [% IL]", "Ic [% IL]"] },
    series: [{ x, y: q.limImin, cor: "red", marca: "v", tam: 10, soMarca: true, rotulo: "menor limite do grupo, 2x [% IL]" },
      { x, y: q.limImax, cor: "rgb(190,0,190)", marca: "^", tam: 10, soMarca: true, rotulo: "maior limite do grupo, 2x [% IL]" },
      hlin(...xl, q.LDi, "black", ":", "LD [% IL]")],
  });
  const tb = Array.from({ length: q.nB }, (_, j) => t0 + (j + 0.5) * q.tamB * q.Tw), tl = [t0, t0 + q.nB * q.tamB * q.Tw];
  painel(ctx, { x: 0, y: H, w: W, h: H }, {
    titulo: "THDv por bloco de 3 s", xlabel: "t [s]", ylabel: "THDv [%]", xlim: tl,
    ylim: [0, 1.7 * maxF(q.THDv3, q.multV * q.limTHD)],
    series: [...q.THDv3.map((y, k) => serie(tb, y, k, `THDv ${["Va", "Vb", "Vc"][k]} [%]`)),
      hlin(...tl, q.multV * q.limTHD, "red", "-", "limite 3 s = 1,5x [%]"), hlin(...tl, q.limTHD, "red", "--", "limite 10 min = 1,0x [%]"),
      hlin(...tl, q.LDthd, "black", ":", "LD [%]")],
  });
  painel(ctx, { x: W, y: H, w: W, h: H }, {
    titulo: "TDD por bloco de 3 s", xlabel: "t [s]", ylabel: "TDD [% IL]", xlim: tl,
    ylim: [0, 1.7 * maxF(q.TDD3, q.multI * q.limTDD)],
    series: [...q.TDD3.map((y, k) => serie(tb, y, k, `TDD ${["Ia", "Ib", "Ic"][k]} [% IL]`)),
      hlin(...tl, q.multI * q.limTDD, "red", "-", "limite 3 s = 2x [% IL]"), hlin(...tl, q.limTDD, "red", "--", "limite 10 min = 1,0x [% IL]"),
      hlin(...tl, q.LDtdd, "black", ":", "LD [% IL]")],
  });
  return c;
}

export function figuraIEEE1459(r, t0) {
  const { c, ctx } = novaFigura(1200, 850);
  const tb = r.blocos.map((_, j) => t0 + (j + 0.5) * r.tamB * r.Tw), tl = [t0, t0 + r.nB * r.tamB * r.Tw];
  const pain = [
    ["Potências - blocos de 3 s", "P [W], Q [var], S [VA]", [["P", "P [W]"], ["Q1p", "Q1+ [var]"], ["Se", "Se [VA]"], ["SU1", "SU1 [VA]"]]],
    ["Fatores de potência - blocos de 3 s", "fator de potência [-]", [["PF", "PF = P/Se [-]"], ["PF1p", "PF1+ = P1+/S1+ [-]"]]],
    ["Desequilíbrios - blocos de 3 s", "desequilíbrio [%]", [["FDv", "V-/V+ [%]"], ["V0v", "V0/V+ [%]"], ["FDi", "I-/I+ [%]"]]],
    ["Distorção efetiva - blocos de 3 s", "THD efetiva [%]", [["THDeV", "THDeV [%]"], ["THDeI", "THDeI [%]"]]],
  ];
  pain.forEach(([tit, yl, cs], p) => {
    const Y = cs.map(([campo]) => r.blocos.map((b) => b[campo]));
    painel(ctx, { x: (p % 2) * 600, y: Math.floor(p / 2) * 425, w: 600, h: 425 }, {
      titulo: tit, xlabel: "t [s]", ylabel: yl, xlim: tl, ylim: [0, 1.4 * maxF(Y)],
      series: Y.map((y, k) => serie(tb, y, k, cs[k][1])),
    });
  });
  return c;
}

