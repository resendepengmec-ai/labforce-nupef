// graficos.js - graficos em <canvas> sem bibliotecas (comum aos modulos): series com cor + marcador
// distintos (mesmos estilos da v5.3.3), barras agrupadas, eixo log, linhas de
// limite e legenda. A mesma figura aparece na tela e vira o PNG gravado.

export const ESTILOS = [
  { cor: "rgb(0,0,205)", marca: "o", tam: 6 }, { cor: "rgb(0,128,0)", marca: "x", tam: 7 },
  { cor: "rgb(220,0,0)", marca: "^", tam: 9 }, { cor: "rgb(190,0,190)", marca: "s", tam: 6 },
  { cor: "rgb(230,120,0)", marca: "d", tam: 8 }, { cor: "rgb(0,0,0)", marca: "v", tam: 9 },
];
const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

// ---- ticks ---------------------------------------------------------------
export function ticksLineares(a, b, n = 6) {
  if (!(b > a)) { const d = Math.abs(a) || 1; a -= d * 0.5; b += d * 0.5; }
  const bruto = (b - a) / n, p = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => (b - a) / s <= n) || 10 * p;
  const t = [];
  for (let v = Math.ceil(a / passo - 1e-9) * passo; v <= b + passo * 1e-9; v += passo) t.push(Math.abs(v) < passo * 1e-9 ? 0 : v);
  return { t, passo };
}
export function fmtTick(v, passo) {
  const dec = Math.max(0, -Math.floor(Math.log10(passo) + 1e-9));
  return v.toFixed(Math.min(dec + (passo / 10 ** Math.floor(Math.log10(passo)) === 2.5 ? 1 : 0), 6)).replace(".", ",");
}

// ---- marcadores ----------------------------------------------------------
export function marcador(ctx, x, y, tipo, tam, cor) {
  const r = tam / 2;
  ctx.save(); ctx.fillStyle = cor; ctx.strokeStyle = cor; ctx.lineWidth = 1.6; ctx.setLineDash([]);
  ctx.beginPath();
  switch (tipo) {
    case "o": ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); break;
    case "x": ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); break;
    case "^": ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r * 0.8); ctx.lineTo(x - r, y + r * 0.8); ctx.closePath(); ctx.fill(); break;
    case "v": ctx.moveTo(x, y + r); ctx.lineTo(x + r, y - r * 0.8); ctx.lineTo(x - r, y - r * 0.8); ctx.closePath(); ctx.fill(); break;
    case "s": ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.fill(); break;
    case "d": ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.fill(); break;
  }
  ctx.restore();
}
const tracos = { "-": [], "--": [9, 6], ":": [2, 4] };

// ---- painel --------------------------------------------------------------
// cfg: {titulo, xlabel, ylabel, xlim:[a,b], ylim:[a,b], logY, xticks:{pos,rot},
//       series:[{x, y, cor, marca, tam, traco, largura, nMarc, rotulo, soMarca}],
//       barras:{x, Y:[[...serie1],[...]], cores, rotulos, larg}, legenda:"ne"|"nw"}
export function painel(ctx, R, cfg) {
  const m = { e: 74, d: 16, s: 34, i: 50 };
  const X0 = R.x + m.e, X1 = R.x + R.w - m.d, Y0 = R.y + m.s, Y1 = R.y + R.h - m.i;
  let [xa, xb] = cfg.xlim, [ya, yb] = cfg.ylim;
  if (!(xb > xa)) xb = xa + 1;
  if (cfg.logY) { ya = Math.log10(ya); yb = Math.log10(yb); }
  if (!(yb > ya)) yb = ya + 1;
  const px = (x) => X0 + (x - xa) / (xb - xa) * (X1 - X0);
  const py = (y) => Y1 - ((cfg.logY ? Math.log10(Math.max(y, 1e-300)) : y) - ya) / (yb - ya) * (Y1 - Y0);
  ctx.save();
  ctx.fillStyle = "#fff"; ctx.fillRect(R.x, R.y, R.w, R.h);
  ctx.font = `13px ${FONTE}`; ctx.fillStyle = "#222"; ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
  // grade e ticks
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  if (cfg.logY) {
    for (let e = Math.ceil(ya); e <= Math.floor(yb); e++) {
      const y = py(10 ** e); ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke();
      ctx.fillText(e >= -3 && e <= 4 ? String(10 ** e).replace(".", ",") : `1e${e}`, X0 - 6, y);
    }
  } else {
    const { t, passo } = ticksLineares(ya, yb, Math.max(3, Math.round((Y1 - Y0) / 55)));
    for (const v of t) { const y = py(v); if (y < Y0 - 1 || y > Y1 + 1) continue;
      ctx.beginPath(); ctx.moveTo(X0, y); ctx.lineTo(X1, y); ctx.stroke(); ctx.fillText(fmtTick(v, passo), X0 - 6, y); }
  }
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  if (cfg.xticks) {
    cfg.xticks.pos.forEach((x, i) => { const X = px(x); ctx.fillText(cfg.xticks.rot[i], X, Y1 + 6); });
  } else {
    const { t, passo } = ticksLineares(xa, xb, Math.max(3, Math.round((X1 - X0) / 90)));
    for (const v of t) { const X = px(v); if (X < X0 - 1 || X > X1 + 1) continue;
      ctx.beginPath(); ctx.moveTo(X, Y0); ctx.lineTo(X, Y1); ctx.stroke(); ctx.fillText(fmtTick(v, passo), X, Y1 + 6); }
  }
  // rotulos
  ctx.fillStyle = "#111"; ctx.font = `600 14px ${FONTE}`; ctx.fillText(cfg.titulo || "", (X0 + X1) / 2, R.y + 8);
  ctx.font = `13px ${FONTE}`; ctx.fillText(cfg.xlabel || "", (X0 + X1) / 2, Y1 + 26);
  ctx.save(); ctx.translate(R.x + 16, (Y0 + Y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textBaseline = "middle";
  ctx.fillText(cfg.ylabel || "", 0, 0); ctx.restore();
  // dados (recortados na area)
  ctx.save(); ctx.beginPath(); ctx.rect(X0, Y0, X1 - X0, Y1 - Y0); ctx.clip();
  const leg = [];
  if (cfg.barras) {
    const B = cfg.barras, ns = B.Y.length, larg = (B.larg || 0.8) / ns;
    B.Y.forEach((serie, s) => {
      ctx.fillStyle = B.cores[s];
      serie.forEach((v, i) => {
        const xc = B.x[i] - (B.larg || 0.8) / 2 + (s + 0.5) * larg;
        const xl = px(xc - larg / 2), xr = px(xc + larg / 2), yv = py(Math.max(v, 0)), y0 = py(0);
        ctx.fillRect(xl, Math.min(yv, y0), Math.max(xr - xl - 1, 1), Math.abs(y0 - yv));
      });
      leg.push({ rotulo: B.rotulos[s], cor: B.cores[s], barra: true });
    });
  }
  for (const S of cfg.series || []) {
    const n = S.y.length;
    ctx.strokeStyle = S.cor; ctx.lineWidth = S.largura || 1.5; ctx.setLineDash(tracos[S.traco || "-"] || []);
    if (!S.soMarca) {
      ctx.beginPath();
      // decima por pixel (min/max) quando ha muitos pontos
      if (n > 4 * (X1 - X0)) {
        let col = -1, mn = 0, mx = 0, primeiro = true;
        const flush = () => { if (col < 0) return; const X = col + 0.5;
          if (primeiro) { ctx.moveTo(X, py(mn)); primeiro = false; } else ctx.lineTo(X, py(mn)); ctx.lineTo(X, py(mx)); };
        for (let i = 0; i < n; i++) {
          const c = Math.floor(px(S.x[i])), v = S.y[i];
          if (c !== col) { flush(); col = c; mn = v; mx = v; } else { if (v < mn) mn = v; if (v > mx) mx = v; }
        }
        flush();
      } else {
        for (let i = 0; i < n; i++) { const X = px(S.x[i]), Y = py(S.y[i]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      }
      ctx.stroke();
    }
    if (S.marca) {
      let idx;
      if (S.nMarc && n > S.nMarc) {
        const k0 = S.desloc || 0; idx = [];
        for (let j = 0; j < S.nMarc; j++) idx.push(Math.round(k0 + j * (n - 1 - k0) / (S.nMarc - 1)));
      } else idx = Array.from({ length: n }, (_, i) => i);
      for (const i of idx) marcador(ctx, px(S.x[i]), py(S.y[i]), S.marca, S.tam || 7, S.cor);
    }
    if (S.rotulo) leg.push(S);
  }
  ctx.restore();
  ctx.setLineDash([]); ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  // legenda
  if (leg.length) {
    ctx.font = `12px ${FONTE}`; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    const lw = Math.max(...leg.map((l) => ctx.measureText(l.rotulo).width)) + 46, lh = 17;
    const lx = cfg.legenda === "nw" ? X0 + 8 : X1 - lw - 8, ly = Y0 + 8;
    ctx.fillStyle = "rgba(255,255,255,0.92)"; ctx.fillRect(lx, ly, lw, leg.length * lh + 8);
    ctx.strokeStyle = "#999"; ctx.strokeRect(lx, ly, lw, leg.length * lh + 8);
    leg.forEach((l, i) => {
      const y = ly + 4 + lh * (i + 0.5);
      if (l.barra) { ctx.fillStyle = l.cor; ctx.fillRect(lx + 8, y - 5, 22, 10); }
      else {
        if (!l.soMarca) { ctx.strokeStyle = l.cor; ctx.lineWidth = l.largura || 1.5; ctx.setLineDash(tracos[l.traco || "-"] || []);
          ctx.beginPath(); ctx.moveTo(lx + 6, y); ctx.lineTo(lx + 32, y); ctx.stroke(); ctx.setLineDash([]); }
        if (l.marca) marcador(ctx, lx + 19, y, l.marca, l.tam || 7, l.cor);
      }
      ctx.fillStyle = "#111"; ctx.fillText(l.rotulo, lx + 40, y);
    });
  }
  ctx.restore();
  return { px, py, X0, X1, Y0, Y1, xa, xb, inv: (X) => xa + (X - X0) / (X1 - X0) * (xb - xa) };
}

export function novaFigura(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h; c.className = "figura";
  const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

export const paraPNG = (c) => new Promise((ok) => c.toBlob(ok, "image/png"));

export const serie = (x, y, k, rotulo, extra = {}) => ({ x, y, cor: ESTILOS[k].cor, marca: ESTILOS[k].marca, tam: ESTILOS[k].tam, rotulo, ...extra });
export const hlin = (x0, x1, v, cor, traco, rotulo) => ({ x: [x0, x1], y: [v, v], cor, traco, largura: 2, rotulo });
export const maxF = (...a) => Math.max(...a.flat(3).filter(Number.isFinite), 1e-6);

// Sinal com as faixas escolhidas (registro da selecao): <ensaio>_faixas.png
// series: [{y, cor, rotulo}] sobre o vetor de tempo t
export function figuraFaixas(t, series, faixas, titulo, rotY, fs) {
  const { c, ctx } = novaFigura(1200, 500);
  let mn = Infinity, mx = -Infinity;
  for (const S of series) for (let i = 0; i < S.y.length; i++) { if (S.y[i] < mn) mn = S.y[i]; if (S.y[i] > mx) mx = S.y[i]; }
  const d = (mx - mn) || Math.abs(mx) || 1;
  const T = painel(ctx, { x: 0, y: 0, w: 1200, h: 500 }, {
    titulo, xlabel: "t [s]", ylabel: rotY, xlim: [t[0], t[t.length - 1]],
    ylim: [mn - 0.05 * d, mx + 0.12 * d], legenda: series.length > 1 ? "ne" : undefined,
    series: series.map((S) => ({ x: t, y: S.y, cor: S.cor, largura: 1, rotulo: series.length > 1 ? S.rotulo : undefined })),
  });
  desenharFaixas(ctx, T, faixas, fs, t[0]);
  return c;
}

export function desenharFaixas(ctx, T, faixas, fs, t0 = 0) {
  ctx.save();
  faixas.forEach((f) => {
    const cor = f.curta ? "rgb(150,150,150)" : ESTILOS[(f.num - 1) % 6].cor;
    const a = T.px(t0 + f.c1 / fs), b = T.px(t0 + f.c2 / fs);
    ctx.fillStyle = cor; ctx.globalAlpha = 0.12; ctx.fillRect(a, T.Y0, b - a, T.Y1 - T.Y0);
    ctx.globalAlpha = 1; ctx.strokeStyle = cor; ctx.lineWidth = 2;
    for (const X of [a, b]) { ctx.beginPath(); ctx.moveTo(X, T.Y0); ctx.lineTo(X, T.Y1); ctx.stroke(); }
    ctx.fillStyle = cor; ctx.font = `600 13px ${FONTE}`; ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`f${f.num}${f.curta ? " (curta)" : ""}`, a + 4, T.Y0 + 4);
  });
  ctx.restore();
}
