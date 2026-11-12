// figuras.js - figuras do modulo de forcas: sinal da faixa, distribuicao (assimetria e curtose) e espectro
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

// ---- distribuicao dos valores na faixa: histograma, normal de referencia, assimetria e curtose ----
// Histograma em densidade (area = 1), com classes pela regra de Freedman-Diaconis (10 a 60 classes).
// Devolve {x: centros, d: densidade, w: largura da classe, min, max}.
export function histograma(y) {
  const n = y.length, s = Float64Array.from(y).sort(), mn = s[0], mx = s[n - 1];
  if (!(mx > mn)) return { x: [mn], d: [1], w: 1, min: mn - 0.5, max: mn + 0.5 };
  const q = (p) => { const i = p * (n - 1), a = Math.floor(i); return s[a] + (s[Math.min(a + 1, n - 1)] - s[a]) * (i - a); };
  const iqr = q(0.75) - q(0.25), hFD = 2 * iqr * Math.cbrt(1 / n);
  const nb = Math.min(60, Math.max(10, hFD > 0 ? Math.ceil((mx - mn) / hFD) : 30)), w = (mx - mn) / nb;
  const cont = new Float64Array(nb);
  for (const v of s) cont[Math.min(nb - 1, Math.floor((v - mn) / w))]++;
  return { x: Array.from({ length: nb }, (_, i) => mn + (i + 0.5) * w), d: Array.from(cont, (c) => c / (n * w)), w, min: mn, max: mx };
}
// Leitura curta dos dois indices (curtose de Pearson: normal = 3)
export function leituraForma(assim, curt) {
  const a = Math.abs(assim) < 0.5 ? "simétrica" : assim > 0 ? "cauda à direita (assimetria positiva)" : "cauda à esquerda (assimetria negativa)";
  const k = curt < 2.5 ? "achatada (platicúrtica)" : curt > 3.5 ? "picos e caudas longas (leptocúrtica)" : "pico próximo da normal (mesocúrtica)";
  return { a, k };
}
const rgba = (cor, al) => cor.replace("rgb(", "rgba(").replace(")", `,${al})`);
const vg = (v, d) => v.toFixed(d).replace(".", ",").replace("-", "−");

// 4 paineis (Fx, Fy, Fz, Fr): histograma da forca na faixa, curva normal com a mesma media e DP,
// linha da media e caixa com assimetria e curtose
export function figuraDistribuicao(E, R) {
  const W = 1200, H = 860, { c, ctx } = novaFigura(W, H);
  ctx.fillStyle = "#111"; ctx.font = "600 15px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(`${R.rotulo} - distribuição das forças na faixa (assimetria e curtose)`, W / 2, 16);
  [["fx", "Fx"], ["fy", "Fy"], ["fz", "Fz"], ["fr", "Fr"]].forEach(([k, rot], i) => {
    const y = E.F[k].subarray(R.c1, R.c2 + 1), s = R.est[k], h = histograma(y), mu = s.media, dp = s.dp;
    const xa = Math.min(h.min, dp > 0 ? mu - 3.5 * dp : h.min), xb = Math.max(h.max, dp > 0 ? mu + 3.5 * dp : h.max);
    const nx = 240, xs = Array.from({ length: nx }, (_, j) => xa + (xb - xa) * j / (nx - 1));
    const pdf = dp > 0 ? xs.map((x) => Math.exp(-0.5 * ((x - mu) / dp) ** 2) / (dp * Math.sqrt(2 * Math.PI))) : xs.map(() => 0);
    const ymax = Math.max(...h.d, ...pdf) * 1.3 || 1;
    const Rp = { x: (i % 2) * (W / 2), y: 30 + Math.floor(i / 2) * ((H - 30) / 2), w: W / 2, h: (H - 30) / 2 };
    const T = painel(ctx, Rp, {
      titulo: rot, xlabel: `${rot} [N]`, ylabel: "densidade [1/N]", xlim: [xa, xb], ylim: [0, ymax], legenda: "ne",
      barras: { x: h.x, Y: [h.d], cores: [rgba(CORES[k], 0.45)], rotulos: ["dados da faixa"], larg: h.w },
      series: [
        { x: xs, y: pdf, cor: "rgb(30,30,30)", largura: 2, traco: "--", rotulo: "normal (mesma média e DP)" },
        { x: [mu, mu], y: [0, ymax], cor: CORES[k], largura: 1.5, rotulo: `média = ${vg(mu, 1)} N` },
      ],
    });
    const L = leituraForma(s.assimetria, s.curtose);
    const linhas = [`assimetria = ${vg(s.assimetria, 3)}  (normal: 0)`, `  ${L.a}`, `curtose = ${vg(s.curtose, 3)}  (normal: 3)`, `  ${L.k}`];
    ctx.save(); ctx.font = "12px system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const bw = Math.max(...linhas.map((l) => ctx.measureText(l).width)) + 16, bx = T.X0 + 8, by = T.Y0 + 8;
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(bx, by, bw, linhas.length * 16 + 8);
    ctx.strokeStyle = "#999"; ctx.strokeRect(bx, by, bw, linhas.length * 16 + 8);
    ctx.fillStyle = "#111"; linhas.forEach((l, j) => ctx.fillText(l, bx + 8, by + 12 + j * 16));
    ctx.restore();
  });
  return c;
}
