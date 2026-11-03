// figuras.js - figuras do modulo de forcas: sinal da faixa e espectro
import { painel, novaFigura, serie, maxF } from "../../comum/js/graficos.js";

export const CORES = { fx: "rgb(0,0,205)", fy: "rgb(0,128,0)", fz: "rgb(220,0,0)", fr: "rgb(60,60,60)" };

// Sinal Fx, Fy, Fz da faixa, com a media de cada canal tracejada
export function figuraSinal(E, R) {
  const { c, ctx } = novaFigura(1200, 520);
  const t = E.t.subarray(R.c1, R.c2 + 1);
  const ys = ["fx", "fy", "fz"].map((k) => E.F[k].subarray(R.c1, R.c2 + 1));
  let mn = Infinity, mx = -Infinity;
  for (const y of ys) for (const v of y) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const d = (mx - mn) || 1;
  painel(ctx, { x: 0, y: 0, w: 1200, h: 520 }, {
    titulo: `${R.rotulo} - forças na faixa (${R.tu.toFixed(2).replace(".", ",")} s)`, xlabel: "t [s]", ylabel: "força [N]",
    xlim: [t[0], t[t.length - 1]], ylim: [mn - 0.05 * d, mx + 0.25 * d],
    series: [
      ...["fx", "fy", "fz"].map((k, i) => ({ x: t, y: ys[i], cor: CORES[k], largura: 1, rotulo: ["Fx [N]", "Fy [N]", "Fz [N]"][i] })),
      ...["fx", "fy", "fz"].map((k) => ({ x: [t[0], t[t.length - 1]], y: [R.est[k].media, R.est[k].media], cor: CORES[k], traco: "--", largura: 1.5 })),
    ],
  });
  return c;
}

// Espectro de amplitude (Hann) de Fx, Fy, Fz na faixa (calculado em analisarFaixa: R.espectro)
export function figuraEspectro(E, R) {
  const { c, ctx } = novaFigura(1200, 520);
  const { f, Y } = R.espectro, Ys = [Y.fx, Y.fy, Y.fz];
  const ymax = maxF(Ys);
  painel(ctx, { x: 0, y: 0, w: 1200, h: 520 }, {
    titulo: `${R.rotulo} - espectro de amplitude (sem a média)`, xlabel: "f [Hz]", ylabel: "amplitude de pico [N]",
    xlim: [f[0], f[f.length - 1]], ylim: [ymax * 1e-5, ymax * 2], logY: true,
    series: Ys.map((y, i) => serie(f, y, i, ["Fx [N]", "Fy [N]", "Fz [N]"][i], { nMarc: 25, desloc: Math.round(i * f.length / 75), largura: 1, cor: CORES[["fx", "fy", "fz"][i]] })),
  });
  return c;
}
