// anim.js - video de apresentacao do LabForce NUPEF (1920x1080, quadro a quadro)
// desenhar(t) e deterministico: o Playwright chama para cada quadro.
const W = 1920, H = 1080;
const cv = document.getElementById("c"), ctx = cv.getContext("2d");
const D = window.DADOS;
const logo = new Image(); logo.src = "../../assets/logo-ifg-goiania.png";
const logoN = new Image(); logoN.src = "../../assets/logo-nupef.png";   // 200 x 192
let CUES = [];   // legendas = texto da narracao (narracao.tsv)
const C = {
  fundo: "#0f1722", fundo2: "#16212f", tinta: "#eef3f6", cinza: "#9fb0bd", linha: "#2a3a4b",
  forca: "#4fb3a5", elet: "#5aa5f0", ifg: "#3f9e3c", verm: "#e0453a",
  s1: "#3b74e0", s2: "#1f9e8a", s3: "#d26a00",       // paleta validada (CVD) para 3 series
};
const F = "Inter, 'DejaVu Sans', sans-serif";
export const DURACAO = 76;

// ---- utilitarios ------------------------------------------------------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const ease = (x) => { x = cl(x); return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const prog = (t, a, b) => ease((t - a) / (b - a));
const fade = (t, a, b, dur = 0.6) => cl((t - a) / dur) * cl((b - t) / dur);
const virg = (x, d) => x.toFixed(d).replace(".", ",");
function texto(s, x, y, { tam = 40, peso = 400, cor = C.tinta, al = "left", base = "alphabetic", alfa = 1, larg } = {}) {
  ctx.save(); ctx.globalAlpha *= alfa; ctx.font = `${peso} ${tam}px ${F}`; ctx.fillStyle = cor; ctx.textAlign = al; ctx.textBaseline = base;
  if (larg) quebra(s, x, y, larg, tam * 1.3); else ctx.fillText(s, x, y); ctx.restore();
}
function quebra(s, x, y, larg, lh) {
  let linha = "", yy = y;
  for (const p of s.split(" ")) {
    const t = linha ? linha + " " + p : p;
    if (ctx.measureText(t).width > larg && linha) { ctx.fillText(linha, x, yy); linha = p; yy += lh; } else linha = t;
  }
  ctx.fillText(linha, x, yy);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
function seta(x1, y1, x2, y2, cor, larg = 6, p = 1) {
  const x = x1 + (x2 - x1) * p, y = y1 + (y2 - y1) * p, a = Math.atan2(y - y1, x - x1);
  if (p <= 0.01) return;
  ctx.save(); ctx.strokeStyle = cor; ctx.fillStyle = cor; ctx.lineWidth = larg; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x - 14 * Math.cos(a), y - 14 * Math.sin(a)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 26 * Math.cos(a - 0.45), y - 26 * Math.sin(a - 0.45));
  ctx.lineTo(x - 26 * Math.cos(a + 0.45), y - 26 * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill(); ctx.restore();
}
// cabecalho fixo de cena: modulo + passo
function rotulo(mod, cor, passo, alfa) {
  ctx.save(); ctx.globalAlpha = alfa;
  rr(110, 70, 14, 46, 4); ctx.fillStyle = cor; ctx.fill();
  texto(mod, 142, 104, { tam: 34, peso: 700, cor });
  if (passo) texto(passo, 142, 150, { tam: 44, peso: 600 });
  ctx.restore();
}
function legenda(s, alfa) {          // legenda inferior = texto da narracao
  if (alfa <= 0) return;
  ctx.save(); ctx.globalAlpha = alfa; ctx.font = `500 36px ${F}`;
  const max = 1560, pal = s.split(" "), lin = [""];
  for (const w of pal) { const t = lin[lin.length - 1] ? lin[lin.length - 1] + " " + w : w; if (ctx.measureText(t).width > max && lin[lin.length - 1]) lin.push(w); else lin[lin.length - 1] = t; }
  const w = Math.max(...lin.map((l) => ctx.measureText(l).width)) + 72, h = 30 + 48 * lin.length, y = H - 56 - h;
  rr(W / 2 - w / 2, y, w, h, 28); ctx.fillStyle = "rgba(8,13,20,.86)"; ctx.fill();
  ctx.fillStyle = C.tinta; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  lin.forEach((l, i) => ctx.fillText(l, W / 2, y + 15 + 24 + 48 * i));
  ctx.restore();
}
function legendaNarracao(t) {
  CUES.forEach((c, i) => { const fim = i + 1 < CUES.length ? CUES[i + 1].ini - 0.2 : DURACAO - 0.4; if (t >= c.ini - 0.3 && t <= fim + 0.3) legenda(c.txt, fade(t, c.ini - 0.25, fim + 0.25, 0.25)); });
}
// grafico de linhas simples (eixos discretos)
function grafico(R, series, { xlim, ylim, p = 1, faixas = [], rotY = "", rotX = "t [s]", ticksY = [], marca } = {}) {
  const { x, y, w, h } = R, px = (v) => x + (v - xlim[0]) / (xlim[1] - xlim[0]) * w, py = (v) => y + h - (v - ylim[0]) / (ylim[1] - ylim[0]) * h;
  ctx.save();
  ctx.strokeStyle = C.linha; ctx.lineWidth = 1.5;
  for (const v of ticksY) { ctx.beginPath(); ctx.moveTo(x, py(v)); ctx.lineTo(x + w, py(v)); ctx.stroke(); texto(String(v), x - 16, py(v), { tam: 24, cor: C.cinza, al: "right", base: "middle" }); }
  ctx.strokeStyle = C.cinza; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke();
  texto(rotY, x, y - 22, { tam: 26, cor: C.cinza }); texto(rotX, x + w, y + h + 44, { tam: 26, cor: C.cinza, al: "right" });
  for (const fx of faixas) {
    const a = px(fx.a), b = a + (px(fx.b) - a) * (fx.p ?? 1);
    ctx.fillStyle = fx.cor + "33"; ctx.fillRect(a, y, b - a, h);
    ctx.strokeStyle = fx.cor; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(a, y + h); ctx.stroke();
    if ((fx.p ?? 1) >= 1) { ctx.beginPath(); ctx.moveTo(b, y); ctx.lineTo(b, y + h); ctx.stroke(); }
    texto(fx.rot, a + 12, y + 36, { tam: 28, peso: 700, cor: fx.cor });
  }
  ctx.beginPath(); ctx.rect(x, y - 4, w * p + 2, h + 8); ctx.clip();
  for (const s of series) {
    ctx.strokeStyle = s.cor; ctx.lineWidth = s.larg || 2.5; ctx.lineJoin = "round"; ctx.beginPath();
    const n = s.y.length;
    for (let i = 0; i < n; i++) { const X = px(xlim[0] + (xlim[1] - xlim[0]) * i / (n - 1)), Y = py(s.y[i]); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    ctx.stroke();
  }
  ctx.restore();
  // rotulos diretos no fim das series (identidade nao so por cor)
  if (p >= 0.98) for (const s of series) if (s.rot) {
    if (s.rx !== undefined) { const i = Math.round(s.rx * (s.y.length - 1)); texto(s.rot, px(xlim[0] + (xlim[1] - xlim[0]) * s.rx), py(s.y[i]) - 22 + (s.dy || 0), { tam: 30, peso: 700, cor: s.cor, al: "center" }); }
    else texto(s.rot, x + w + 14, py(s.y[s.y.length - 1] ?? 0) + (s.dy || 0), { tam: 28, peso: 700, cor: s.cor, base: "middle" });
  }
  if (marca) { const X = px(marca); ctx.save(); ctx.strokeStyle = C.tinta; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X, y); ctx.lineTo(X, y + h); ctx.stroke(); ctx.restore(); }
  return { px, py };
}
function cartao(x, y, w, h, rot, val, unid, cor, alfa, sub) {
  if (alfa <= 0) return;
  ctx.save(); ctx.globalAlpha = alfa; ctx.translate(0, (1 - alfa) * 30);
  rr(x, y, w, h, 18); ctx.fillStyle = C.fundo2; ctx.fill(); ctx.strokeStyle = C.linha; ctx.lineWidth = 2; ctx.stroke();
  rr(x, y, 10, h, 5); ctx.fillStyle = cor; ctx.fill();
  texto(rot, x + 34, y + 54, { tam: 28, cor: C.cinza });
  texto(val, x + 34, y + 124, { tam: 60, peso: 700 });
  ctx.font = `700 60px ${F}`; const wv = ctx.measureText(val).width;
  texto(unid, x + 44 + wv, y + 124, { tam: 30, cor: C.cinza });
  if (sub) texto(sub, x + 34, y + 168, { tam: 24, cor: C.cinza });
  ctx.restore();
}
function chip(x, y, s, cor, alfa) {
  ctx.save(); ctx.globalAlpha = alfa; ctx.font = `700 30px ${F}`; const w = ctx.measureText(s).width + 44;
  rr(x, y, w, 56, 28); ctx.fillStyle = cor + "2e"; ctx.fill(); ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = cor; ctx.textBaseline = "middle"; ctx.fillText(s, x + 22, y + 29); ctx.restore(); return w;
}

// ---- cenas ------------------------------------------------------------
function cenaAbertura(t) {                // 0 - 6 s
  const a = fade(t, 0, 6.2, 0.8);
  ctx.save(); ctx.globalAlpha = a;
  const lh = 300, lw = lh * 258 / 360, nh = 300, nw = nh * 200 / 192, p = prog(t, 0.2, 1.4), y0 = 150 + (1 - p) * 30, gap = 60;
  const xi = W / 2 - gap / 2 - lw - 26, xn = W / 2 + gap / 2;
  rr(xi - 26, y0 - 26, lw + 52, lh + 52, 22); ctx.fillStyle = "#fff"; ctx.fill();
  if (logo.complete) ctx.drawImage(logo, xi, y0, lw, lh);
  rr(xn - 26 + 26, y0 - 26, nw + 52, nh + 52, 22); ctx.fill();
  if (logoN.complete) ctx.drawImage(logoN, xn + 26, y0, nw, nh);
  texto("LabForce NUPEF", W / 2, 620, { tam: 104, peso: 800, al: "center", alfa: prog(t, 0.8, 2) });
  texto("Análise de experimentos de usinagem e processos de fabricação", W / 2, 700, { tam: 46, cor: C.cinza, al: "center", alfa: prog(t, 1.4, 2.6) });
  texto("Núcleo de Pesquisa em Fabricação · IFG Câmpus Goiânia", W / 2, 770, { tam: 34, cor: C.cinza, al: "center", alfa: prog(t, 2, 3.2) });
  // traco animado (sinal) sob o titulo
  ctx.strokeStyle = C.forca; ctx.lineWidth = 4; ctx.beginPath();
  const q = prog(t, 2.4, 5);
  for (let i = 0; i <= 300 * q; i++) { const X = 560 + i * 2.66, Y = 860 + 26 * Math.sin(i / 300 * Math.PI * 8) * Math.sin(i / 300 * Math.PI); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
  ctx.stroke(); ctx.restore();
}

function cenaDois(t) {                    // 6 - 11 s
  const a = fade(t, 6, 11.2, 0.6); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  texto("Dois sinais, duas análises", W / 2, 190, { tam: 70, peso: 700, al: "center" });
  const lado = (x0, cor, tit, sub, gerar, d) => {
    const p = prog(t, 6.6 + d, 9 + d);
    rr(x0, 300, 760, 520, 26); ctx.fillStyle = C.fundo2; ctx.fill(); ctx.strokeStyle = cor; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(x0 + 50, 330, 660 * p, 300); ctx.clip(); gerar(x0 + 50, 480); ctx.restore();
    texto(tit, x0 + 50, 700, { tam: 48, peso: 700, cor });
    texto(sub, x0 + 50, 760, { tam: 32, cor: C.cinza });
  };
  lado(160, C.forca, "Forças de usinagem", "Dinamômetro: Fx, Fy, Fz", (x, y) => {
    [[C.s3, 120], [C.s1, 60], [C.s2, 28]].forEach(([cor, amp]) => {
      ctx.strokeStyle = cor; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 660; i += 3) { const u = i / 660, e = u < 0.15 ? 0 : u < 0.22 ? (u - 0.15) / 0.07 : u < 0.85 ? 1 : Math.max(0, 1 - (u - 0.85) / 0.06);
        const Y = y + 90 - e * (amp + 5 * Math.sin(i * 0.9)); i ? ctx.lineTo(x + i, Y) : ctx.moveTo(x + i, Y); }
      ctx.stroke();
    });
  }, 0);
  lado(1000, C.elet, "Grandezas elétricas", "ESP32 trifásico 3F+N", (x, y) => {
    [C.s1, C.s2, C.s3].forEach((cor, k) => {
      ctx.strokeStyle = cor; ctx.lineWidth = 4; ctx.beginPath();
      for (let i = 0; i <= 660; i += 3) { const Y = y - 10 + 100 * Math.sin(i / 660 * Math.PI * 6 - k * 2 * Math.PI / 3); i ? ctx.lineTo(x + i, Y) : ctx.moveTo(x + i, Y); }
      ctx.stroke();
    });
  }, 0.4);
  ctx.restore();
}

function cenaForcas(t) {                  // 11 - 37 s
  const a = fade(t, 11, 37.2, 0.6); if (a <= 0) return;
  const f = D.forcas;
  ctx.save(); ctx.globalAlpha = a;
  // (1) montagem: 11 - 16.5
  const m = fade(t, 11, 16.6, 0.5);
  if (m > 0) {
    rotulo("FORÇAS DE USINAGEM", C.forca, "Montagem do dinamômetro", m);
    ctx.save(); ctx.globalAlpha *= m;
    const gx = 420, gy = 560;
    rr(gx - 300, gy - 120, 620, 170, 30); ctx.fillStyle = "#8696a3"; ctx.fill();          // peca
    ctx.beginPath(); ctx.ellipse(gx - 300, gy - 35, 34, 85, 0, 0, 7); ctx.fillStyle = "#6b7a86"; ctx.fill();
    const ang = t * 6; ctx.strokeStyle = "#c9d4dc"; ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) { const yy = gy - 35 + 70 * Math.sin(ang + k * 2.1); ctx.beginPath(); ctx.moveTo(gx - 290, yy); ctx.lineTo(gx + 300, yy); ctx.globalAlpha = m * 0.25; ctx.stroke(); }
    ctx.globalAlpha = m;
    ctx.beginPath(); ctx.moveTo(gx + 300, gy + 50); ctx.lineTo(gx + 420, gy + 50); ctx.lineTo(gx + 460, gy + 260); ctx.lineTo(gx + 340, gy + 260); ctx.closePath(); ctx.fillStyle = "#b8c4cc"; ctx.fill();
    rr(gx + 280, gy + 260, 240, 64, 10); ctx.fillStyle = "#26333f"; ctx.fill();
    texto("dinamômetro", gx + 400, gy + 302, { tam: 28, cor: C.tinta, al: "center" });
    const o = [gx + 300, gy + 50];
    seta(o[0], o[1], o[0], o[1] + 230, C.s3, 8, prog(t, 12, 13));
    seta(o[0], o[1], o[0] - 260, o[1], C.s1, 8, prog(t, 12.6, 13.6));
    seta(o[0], o[1], o[0] + 150, o[1] - 150, C.s2, 8, prog(t, 13.2, 14.2));
    texto("Fz = Fc  força de corte", 1080, 470, { tam: 40, peso: 700, cor: C.s3, alfa: prog(t, 12.4, 13.2) });
    texto("Fx = Ff  força de avanço", 1080, 550, { tam: 40, peso: 700, cor: C.s1, alfa: prog(t, 13, 13.8) });
    texto("Fy = Fp  força passiva", 1080, 630, { tam: 40, peso: 700, cor: C.s2, alfa: prog(t, 13.6, 14.4) });
    texto("Amplificador zerado antes do corte", 1080, 740, { tam: 32, cor: C.cinza, alfa: prog(t, 14.2, 15) });
    ctx.restore();
  }
  // (2) sinal + (3) faixa: 16.5 - 28.5
  const s = fade(t, 16.5, 28.6, 0.5);
  if (s > 0) {
    rotulo("FORÇAS DE USINAGEM", C.forca, t < 22.5 ? "Sinal do dinamômetro" : "Faixa de corte estável", s);
    ctx.save(); ctx.globalAlpha *= s;
    const pa = prog(t, 16.8, 20.5), pf = prog(t, 23.2, 25.4);
    const fx = t > 22.8 ? [{ a: f.faixa[0], b: f.faixa[1], p: pf, cor: C.forca, rot: "f1" }] : [];
    grafico({ x: 200, y: 260, w: 1440, h: 560 }, [
      { y: f.fz, cor: C.s3, rot: "Fz", rx: 0.72, dy: -30 }, { y: f.fx, cor: C.s1, rot: "Fx", rx: 0.72, dy: -18 }, { y: f.fy, cor: C.s2, rot: "Fy", rx: 0.72, dy: -12 },
    ], { xlim: [f.t0, f.t1], ylim: [-60, 950], p: pa, faixas: fx, rotY: "força [N]", ticksY: [0, 200, 400, 600, 800] });
    if (t > 20.5 && t < 22.8) {
      ctx.save(); ctx.globalAlpha = s * fade(t, 20.5, 22.8, 0.3);
      rr(1180, 400, 430, 120, 16); ctx.fillStyle = C.fundo2; ctx.fill(); ctx.strokeStyle = C.forca; ctx.lineWidth = 2; ctx.stroke();
      texto("Fator de calibração", 1210, 450, { tam: 30, peso: 600 }); texto("por canal · padrão 1,0", 1210, 494, { tam: 28, cor: C.cinza }); ctx.restore();
    }
    // cursor clicando
    if (t > 22.8 && t < 26) {
      const X = 200 + (f.faixa[0] + (f.faixa[1] - f.faixa[0]) * pf - f.t0) / (f.t1 - f.t0) * 1440;
      ctx.fillStyle = C.tinta; ctx.beginPath(); ctx.moveTo(X, 700); ctx.lineTo(X + 22, 754); ctx.lineTo(X + 8, 750); ctx.lineTo(X, 770); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // (4) estatistica + teorico: 28.5 - 37
  const e = fade(t, 28.5, 37.2, 0.5);
  if (e > 0) {
    rotulo("FORÇAS DE USINAGEM", C.forca, "Resultados da faixa", e);
    const z = f.est.fz, k = (x0) => prog(t, x0, x0 + 0.6);
    cartao(150, 230, 520, 200, "Fz média", virg(z.media * cl((t - 28.8) / 1.2), 1), "N", C.s3, e * k(28.8));
    cartao(700, 230, 520, 200, "Coeficiente de variação", virg(100 * z.cv, 1), "%", C.s3, e * k(29.2));
    cartao(1250, 230, 520, 200, "Frequência dominante", virg(z.fdom, 1), "Hz", C.s3, e * k(29.6), "espectro FFT da faixa");
    // barras teorica x medida
    const pb = prog(t, 31.2, 33.4), te = f.teo, maxv = 1200, x0 = 420, y0 = 520, wmax = 1100;
    ctx.save(); ctx.globalAlpha = e * prog(t, 30.8, 31.4);
    texto("Força de corte teórica × medida", 150, 500, { tam: 40, peso: 700 });
    texto("Fc = kc · ap · fn   (Sandvik Coromant / Kienzle)", 150, 548, { tam: 30, cor: C.cinza });
    [["Teórica", te.Fc, C.cinza], ["Medida (Fz)", Math.abs(te.medida), C.s3]].forEach(([r, v, cor], i) => {
      const y = 600 + i * 110;
      texto(r, x0 - 30, y + 46, { tam: 32, al: "right", cor: C.tinta });
      rr(x0, y + 8, Math.max(8, wmax * v / maxv * pb), 64, 6); ctx.fillStyle = cor; ctx.fill();
      texto(virg(v * pb, 1) + " N", x0 + wmax * v / maxv * pb + 20, y + 52, { tam: 34, peso: 700 });
    });
    chip(x0, 830, `diferença ${virg(te.dif, 1)} %`, C.forca, cl((t - 33.4) / 0.6));
    ctx.restore();
  }
  ctx.restore();
}

function cenaEletrica(t) {                // 37 - 65 s
  const a = fade(t, 37, 65.2, 0.6); if (a <= 0) return;
  const d = D.eletrica;
  ctx.save(); ctx.globalAlpha = a;
  // (1) ligacao: 37 - 42.5
  const l = fade(t, 37, 42.6, 0.5);
  if (l > 0) {
    rotulo("GRANDEZAS ELÉTRICAS", C.elet, "Ligação 3F+N", l);
    ctx.save(); ctx.globalAlpha *= l;
    const ys = [400, 500, 600], cs = [C.s1, C.s2, C.s3], nm = ["A", "B", "C"];
    ctx.setLineDash([18, 12]); ctx.strokeStyle = C.cinza; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(240, 300); ctx.lineTo(1680, 300); ctx.stroke(); ctx.setLineDash([]);
    texto("N", 200, 312, { tam: 40, peso: 700, cor: C.cinza });
    ys.forEach((y, k) => {
      const p = prog(t, 37.4 + k * 0.3, 38.6 + k * 0.3);
      ctx.strokeStyle = cs[k]; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(240, y); ctx.lineTo(240 + 1440 * p, y); ctx.stroke();
      texto(nm[k], 200, y + 14, { tam: 40, peso: 700, cor: cs[k] });
      const q = prog(t, 38.8 + k * 0.3, 39.4 + k * 0.3);
      ctx.save(); ctx.globalAlpha *= q; ctx.lineWidth = 6; ctx.strokeStyle = C.tinta; ctx.beginPath(); ctx.ellipse(520 + k * 170, y, 34, 58, 0, 0, 7); ctx.stroke();
      seta(560 + k * 170, y - 70, 640 + k * 170, y - 70, C.tinta, 4, 1);
      texto("I" + nm[k].toLowerCase(), 470 + k * 170, y - 64, { tam: 30, peso: 700, cor: cs[k], al: "right" });
      ctx.beginPath(); ctx.arc(1180 + k * 160, y, 14, 0, 7); ctx.fillStyle = C.fundo; ctx.fill(); ctx.strokeStyle = cs[k]; ctx.lineWidth = 5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(1180 + k * 160, y + 14); ctx.lineTo(1180 + k * 160, 760); ctx.stroke();
      texto("V" + nm[k].toLowerCase(), 1180 + k * 160, y - 30, { tam: 30, peso: 700, cor: cs[k], al: "center" });
      ctx.restore();
    });
    ctx.save(); ctx.globalAlpha *= prog(t, 39.8, 40.6);
    rr(420, 740, 1140, 110, 18); ctx.fillStyle = "#1d2a38"; ctx.fill(); ctx.strokeStyle = C.elet; ctx.lineWidth = 2; ctx.stroke();
    texto("Aquisição ESP32 · 6 canais · ADC 12 bits", 990, 808, { tam: 36, peso: 600, al: "center" });
    ctx.restore();
    texto("rede → carga (torno)", 1680, 250, { tam: 30, cor: C.cinza, al: "right" });
    ctx.restore();
  }
  // (2) taxa + P(t) + faixas: 42.5 - 52.5
  const s = fade(t, 42.5, 52.6, 0.5);
  if (s > 0) {
    rotulo("GRANDEZAS ELÉTRICAS", C.elet, t < 46.5 ? "Taxa de amostragem detectada" : "Potência no tempo e faixas", s);
    ctx.save(); ctx.globalAlpha *= s;
    if (t < 46.6) {
      const p = prog(t, 42.8, 45);
      grafico({ x: 200, y: 300, w: 1050, h: 420 }, [0, 1, 2].map((k) => ({
        y: Array.from({ length: 400 }, (_, i) => 311 * Math.sin(i / 400 * Math.PI * 2 * 6 - k * 2 * Math.PI / 3)), cor: [C.s1, C.s2, C.s3][k] })),
        { xlim: [0, 0.1], ylim: [-360, 360], p, rotY: "tensão [V]", rotX: "t [s]", ticksY: [-300, 0, 300] });
      ctx.save(); ctx.globalAlpha *= prog(t, 44.6, 45.4);
      rr(1340, 330, 470, 200, 18); ctx.fillStyle = C.fundo2; ctx.fill(); ctx.strokeStyle = C.elet; ctx.lineWidth = 3; ctx.stroke();
      texto("fs detectada pela rede", 1370, 386, { tam: 30, cor: C.cinza });
      texto(`${d.fs} Hz`, 1370, 460, { tam: 64, peso: 800, cor: C.elet });
      texto(d.regra, 1370, 506, { tam: 26, cor: C.cinza }); ctx.restore();
      [["Va", C.s1], ["Vb", C.s2], ["Vc", C.s3]].forEach(([r, c], i) => texto(r, 1370 + i * 110, 610, { tam: 32, peso: 700, cor: c, alfa: p }));
    } else {
      const p = prog(t, 46.8, 49), pf1 = prog(t, 49.3, 50.4), pf2 = prog(t, 50.6, 51.7);
      const fx = [];
      if (t > 49.2) fx.push({ a: d.faixas[0][0], b: d.faixas[0][1], p: pf1, cor: C.s1, rot: "f1" });
      if (t > 50.5) fx.push({ a: d.faixas[1][0], b: d.faixas[1][1], p: pf2, cor: C.s2, rot: "f2" });
      grafico({ x: 200, y: 260, w: 1440, h: 560 }, [{ y: d.P, cor: C.elet, larg: 3 }],
        { xlim: [0, d.dur], ylim: [340, 560], p, faixas: fx, rotY: "P, média móvel de 30 ciclos [W]", ticksY: [350, 400, 450, 500, 550] });
    }
    ctx.restore();
  }
  // (3) resultados: 52.5 - 65
  const r = fade(t, 52.5, 65.2, 0.5);
  if (r > 0) {
    rotulo("GRANDEZAS ELÉTRICAS", C.elet, t < 58.5 ? "Potências da faixa" : "Qualidade de energia", r);
    if (t < 58.6) {
      const k = (x0) => r * fade(t, x0, 58.6, 0.5);
      cartao(150, 240, 520, 200, "Potência ativa P", virg(d.Pt * cl((t - 52.8) / 1.2), 1), "W", C.elet, k(52.8));
      cartao(700, 240, 520, 200, "Fator de potência", virg(d.FP, 3), "", C.elet, k(53.2), "convencional, P/St");
      cartao(1250, 240, 520, 200, "Frequência da rede", virg(d.f1, 3), "Hz", C.elet, k(53.6));
      cartao(150, 480, 520, 200, "Se (IEEE 1459)", virg(d.Se, 1), "VA", C.s2, k(54.4));
      cartao(700, 480, 520, 200, "PF (IEEE 1459)", virg(d.PF, 3), "", C.s2, k(54.8), "4 fios, P/Se");
      cartao(1250, 480, 520, 200, "Corrente de neutro", virg(d.In, 3), "A", C.s2, k(55.2), "calculada: −(ia+ib+ic)");
    } else {
      ctx.save(); ctx.globalAlpha *= r * fade(t, 58.5, 65.2, 0.5);
      const pb = prog(t, 58.9, 60.8), x0 = 180, y0 = 760, bw = 100, gap = 40, hmax = 420, vmax = 10;
      texto("Harmônicos de corrente [% IL] por grupo (P99 de 3 s) · IEEE 519-2022", 150, 250, { tam: 32, cor: C.cinza });
      d.grupos.forEach((g, i) => {
        const x = x0 + i * (bw + gap), v = d.Ih[i], hb = hmax * v / vmax * pb;
        rr(x, y0 - hb, bw, Math.max(hb, 1), 6); ctx.fillStyle = C.elet; ctx.fill();
        texto(virg(v, 1), x + bw / 2, y0 - hb - 14, { tam: 26, peso: 600, al: "center", alfa: pb });
        texto(String(g), x + bw / 2, y0 + 40, { tam: 28, cor: C.cinza, al: "center" });
        ctx.fillStyle = C.verm; ctx.beginPath(); const yl = y0 - hmax * d.limMax[i] / vmax; ctx.moveTo(x + 6, yl); ctx.lineTo(x + bw - 6, yl); ctx.lineWidth = 5; ctx.strokeStyle = C.verm; ctx.globalAlpha = r * pb; ctx.stroke(); ctx.globalAlpha = r;
      });
      ctx.strokeStyle = C.cinza; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0 - 20, y0); ctx.lineTo(x0 + 8 * (bw + gap) - gap + 20, y0); ctx.stroke();
      texto("menor ordem do grupo", x0, y0 + 84, { tam: 26, cor: C.cinza });
      ctx.strokeStyle = C.verm; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(1420, 330); ctx.lineTo(1480, 330); ctx.stroke();
      texto("maior limite do grupo", 1495, 340, { tam: 26, cor: C.cinza });
      const pc = cl((t - 61) / 0.6);
      texto(`TDD ${virg(Math.max(...d.TDD), 1)} %  ·  THDv ${virg(Math.max(...d.THDv), 1)} %`, 1420, 440, { tam: 32, peso: 600, alfa: pc });
      chip(1420, 480, `Tensão: ${d.statusV}`, "#3fbf6a", pc);
      chip(1420, 560, `Corrente: ${d.statusI}`, "#e0a530", cl((t - 61.4) / 0.6));
      texto("a 250 Hz as ordens se rebatem:", 1420, 680, { tam: 26, cor: C.cinza, alfa: cl((t - 62) / 0.6) });
      texto("resultado indicativo, por grupo", 1420, 716, { tam: 26, cor: C.cinza, alfa: cl((t - 62) / 0.6) });
      ctx.restore();
    }
  }
  ctx.restore();
}

function cenaFluxo(t) {                   // 65 - 76 s
  const a = fade(t, 65, 77, 0.6); if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  texto("O mesmo fluxo nos dois módulos", W / 2, 190, { tam: 64, peso: 700, al: "center" });
  const passos = ["Montagem ou ligação", "Configuração", "Arquivos", "Faixas", "Resultados"];
  const x0 = 250, dx = 355, y = 400;
  ctx.strokeStyle = C.linha; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + dx * 4 * prog(t, 65.4, 67.4), y); ctx.stroke();
  passos.forEach((p, i) => {
    const q = prog(t, 65.6 + i * 0.35, 66.2 + i * 0.35), x = x0 + i * dx;
    ctx.save(); ctx.globalAlpha *= q;
    ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fillStyle = i === 4 ? C.forca : C.fundo2; ctx.fill(); ctx.strokeStyle = i < 2 ? C.elet : C.forca; ctx.lineWidth = 5; ctx.stroke();
    texto(String(i + 1), x, y + 2, { tam: 44, peso: 800, al: "center", base: "middle" });
    texto(p, x, y + 100, { tam: 32, peso: 600, al: "center" }); ctx.restore();
  });
  const b = prog(t, 68, 69);
  ctx.save(); ctx.globalAlpha *= b;
  texto("Resultados gravados na sua pasta: CSV · PNG · relatório", W / 2, 640, { tam: 40, al: "center" });
  texto("Nenhum dado de ensaio sai do computador · manual técnico em cada módulo", W / 2, 700, { tam: 34, cor: C.cinza, al: "center" });
  ctx.restore();
  const c = prog(t, 69.6, 70.8);
  ctx.save(); ctx.globalAlpha *= c;
  rr(W / 2 - 560, 780, 1120, 120, 60); ctx.fillStyle = C.fundo2; ctx.fill(); ctx.strokeStyle = C.forca; ctx.lineWidth = 3; ctx.stroke();
  texto("resendepengmec-ai.github.io/labforce-nupef", W / 2, 856, { tam: 46, peso: 700, al: "center", cor: C.forca });
  const lw = 92, lh = lw * 360 / 258;
  rr(W - 210, 900 - lh + 30, lw + 24, lh + 24, 12); ctx.fillStyle = "#fff"; ctx.fill();
  if (logo.complete) ctx.drawImage(logo, W - 198, 900 - lh + 42, lw, lh);
  const nh2 = lh, nw2 = nh2 * 200 / 192;
  rr(W - 210 - nw2 - 44, 900 - lh + 30, nw2 + 24, nh2 + 24, 12); ctx.fillStyle = "#fff"; ctx.fill();
  if (logoN.complete) ctx.drawImage(logoN, W - 198 - nw2 - 44, 900 - lh + 42, nw2, nh2);
  ctx.restore(); ctx.restore();
}

export function desenhar(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  ctx.fillStyle = C.fundo; ctx.fillRect(0, 0, W, H);
  // barra de progresso discreta
  ctx.fillStyle = C.linha; ctx.fillRect(0, H - 8, W, 8);
  ctx.fillStyle = t < 37 ? C.forca : t < 65 ? C.elet : C.forca; ctx.fillRect(0, H - 8, W * t / DURACAO, 8);
  if (t < 6.4) cenaAbertura(t);
  if (t > 5.8 && t < 11.4) cenaDois(t);
  if (t > 10.8 && t < 37.4) cenaForcas(t);
  if (t > 36.8 && t < 65.4) cenaEletrica(t);
  if (t > 64.8) cenaFluxo(t);
  legendaNarracao(t);
}
window.desenhar = desenhar; window.DURACAO = DURACAO;
const carregada = (im) => new Promise((ok) => { if (im.complete) ok(); else im.onload = ok; });
window.pronto = Promise.all([carregada(logo), carregada(logoN), document.fonts.load(`700 40px Inter`),
  fetch("narracao.tsv").then((r) => r.text()).then((tx) => { CUES = tx.trim().split(/\r?\n/).slice(1).map((l) => { const [a, b] = l.split("\t"); return { ini: +a, txt: b.trim() }; }); })]);
