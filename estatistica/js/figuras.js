// figuras.js - graficos do modulo de estatistica (canvas -> PNG), com a mesma base de
// comum/js/graficos.js (painel: eixos, grade e legenda). Regras:
//  - paleta categorica fixa, nesta ordem: #2a78d6, #eb6834, #1baf7a, #eda100 (validada para
//    daltonismo); aqua e amarelo tem pouco contraste no fundo claro: vao com rotulo direto
//    ou tabela; dispersao com no maximo 3 series;
//  - curvas de nivel e superficie 3D: um so matiz, de #cde2fb (claro) a #0d366b (escuro);
//  - todas as figuras em alta resolucao (ESCALA), com a mesma fonte, tinta e grade;
//  - linhas de 2 px, marcadores de 8 px, texto na cor da tinta; um eixo y por grafico;
//  - dica ao passar o mouse com o valor exato e tabela com os mesmos numeros (acessibilidade).
// desenharFigura(spec) -> {canvas, tabela: {cab, linhas de celulas}}.
import { painel, novaFigura, ticksLineares, fmtTick } from "../../comum/js/graficos.js";
import { num } from "./conclusoes.js";

export const PALETA = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
export const TINTA = "#17201c", CINZA = "#5e6a64", FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const W = 1000, H = 520;
// Padrao de qualidade: toda figura e desenhada em unidades logicas (largura 1000) e gravada com
// ESCALA pixels por unidade: PNG de 3000 px de largura (300 dpi em 10 pol.), nitido tambem em
// telas de alta densidade. Em telas estreitas (celular) usa 2 para poupar memoria.
export const ESCALA = globalThis.matchMedia?.("(max-width: 860px)").matches ? 2 : 3;
export const figura = (w, h) => novaFigura(w, h, ESCALA);
const n = (v, a = 4) => ({ t: "n", v, alg: a }), s = (v) => ({ t: "s", v: String(v) });
const faixa = (vals, folga = 0.08) => {
  let a = Math.min(...vals), b = Math.max(...vals);
  if (!(b > a)) { const d = Math.abs(a) || 1; a -= d * 0.5; b += d * 0.5; }
  const m = (b - a) * folga; return [a - m, b + m];
};
const ponto = (x, y, cor, rotulo, extra = {}) => ({ x: [x], y: [y], cor, marca: "o", tam: 8, soMarca: true, rotulo, ...extra });

// ---- dica (tooltip) ----------------------------------------------------------
let dica = null;
export function ligarDica(c, alvos) {
  // alvos: [{x, y (pixels da figura), texto}] ou funcao (x, y) -> texto
  const mostrar = (e) => {
    const r = c.getBoundingClientRect(), sx = (Number(c.dataset.larg) || c.width) / r.width, sy = sx;   // unidades do desenho por px da tela
    const x = (e.clientX - r.left) * sx, y = (e.clientY - r.top) * sy;
    let texto = null;
    if (typeof alvos === "function") texto = alvos(x, y);
    else { let d = 18 * sx; for (const a of alvos) { const dd = Math.hypot(a.x - x, a.y - y); if (dd < d) { d = dd; texto = a.texto; } } }
    if (!texto) { if (dica) dica.hidden = true; return; }
    if (!dica) { dica = document.createElement("div"); dica.className = "dica"; dica.setAttribute("role", "status"); document.body.appendChild(dica); }
    dica.textContent = texto; dica.hidden = false;
    const larg = dica.offsetWidth;
    dica.style.left = `${Math.min(e.clientX + 14, innerWidth - larg - 8)}px`; dica.style.top = `${e.clientY + 14}px`;
  };
  c.addEventListener("pointermove", mostrar);
  c.addEventListener("pointerleave", () => { if (dica) dica.hidden = true; });
}
export function texto(ctx, t, x, y, { alinha = "left", base = "middle", tam = 13, peso = 400, cor = TINTA, fundo = false } = {}) {
  ctx.save(); ctx.font = `${peso} ${tam}px ${FONTE}`; ctx.textAlign = alinha; ctx.textBaseline = base;
  if (fundo) {                       // rotulo direto sobre dados: caixa branca para nao se misturar aos pontos
    const w = ctx.measureText(t).width, x0 = alinha === "center" ? x - w / 2 : alinha === "right" ? x - w : x;
    ctx.fillStyle = "rgba(255,255,255,.92)"; ctx.fillRect(x0 - 4, y - tam / 2 - 3, w + 8, tam + 6);
  }
  ctx.fillStyle = cor; ctx.fillText(t, x, y); ctx.restore();
}
function linhaH(ctx, T, v, cor, traco = [6, 4], larg = 1.5) {
  const y = T.py(v); ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.setLineDash(traco); ctx.beginPath(); ctx.moveTo(T.X0, y); ctx.lineTo(T.X1, y); ctx.stroke(); ctx.restore();
}
function linhaV(ctx, T, v, cor, traco = [6, 4], larg = 1.5) {
  const x = T.px(v); ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.setLineDash(traco); ctx.beginPath(); ctx.moveTo(x, T.Y0); ctx.lineTo(x, T.Y1); ctx.stroke(); ctx.restore();
}

// ---- medias com IC (ANOVA) e medias por grupo (MANOVA) ----------------------
function figIC(spec, comIC) {
  const { c, ctx } = figura(W, H), it = spec.itens, k = it.length;
  const vals = it.flatMap((i) => (comIC ? [i.inf, i.sup] : [i.y]));
  const T = painel(ctx, { x: 0, y: 0, w: W, h: H }, {
    titulo: spec.titulo, xlabel: "grupo", ylabel: spec.rotY, xlim: [0.4, k + 0.6], ylim: faixa(vals, 0.12),
    xticks: { pos: it.map((_, i) => i + 1), rot: it.map((i) => i.rotulo) },
    series: [{ x: it.map((_, i) => i + 1), y: it.map((i) => i.y), cor: PALETA[0], marca: "o", tam: 9, soMarca: true }],
  });
  ctx.save(); ctx.strokeStyle = PALETA[0]; ctx.lineWidth = 2;
  if (comIC) it.forEach((i, j) => {
    const x = T.px(j + 1), a = T.py(i.inf), b = T.py(i.sup);
    ctx.beginPath(); ctx.moveTo(x, a); ctx.lineTo(x, b); ctx.moveTo(x - 8, a); ctx.lineTo(x + 8, a); ctx.moveTo(x - 8, b); ctx.lineTo(x + 8, b); ctx.stroke();
  });
  ctx.restore();
  ligarDica(c, it.map((i, j) => ({ x: T.px(j + 1), y: T.py(i.y), texto: `${i.rotulo}\nmédia = ${num(i.y)}${comIC ? `\nIC: ${num(i.inf)} a ${num(i.sup)}` : ""}` })));
  return { canvas: c, tabela: { cab: ["Grupo", "Média", ...(comIC ? ["IC inf.", "IC sup."] : [])], linhas: it.map((i) => [s(i.rotulo), n(i.y), ...(comIC ? [n(i.inf), n(i.sup)] : [])]) } };
}

// ---- dispersao generica: residuos, Q-Q, meio-normal, frente de Pareto --------
function figDispersao(spec, { xlabel, ylabel, ref, rotular, destaque }) {
  const { c, ctx } = figura(W, H), P = spec.pontos;
  const extra = destaque || [];
  const T = painel(ctx, { x: 0, y: 0, w: W, h: H }, {
    titulo: spec.titulo, xlabel, ylabel, xlim: faixa([...P.map((p) => p.x), ...extra.map((p) => p.x)]), ylim: faixa([...P.map((p) => p.y), ...extra.map((p) => p.y)], 0.12),
    legenda: extra.length ? "ne" : undefined,
    series: [{ x: P.map((p) => p.x), y: P.map((p) => p.y), cor: PALETA[0], marca: "o", tam: 8, soMarca: true, rotulo: extra.length ? "frente de Pareto" : undefined },
      ...extra.map((p, i) => ponto(p.x, p.y, PALETA[i + 1], p.rotulo, { marca: i ? "s" : "^", tam: 12 }))],
  });
  if (ref) ref(ctx, T);
  if (rotular) for (const p of P) if (p.rotulo) texto(ctx, p.rotulo, T.px(p.x) + 9, T.py(p.y) - 8, { tam: 12, peso: 600 });
  extra.forEach((p, i) => texto(ctx, p.rotulo, T.px(p.x) + (i ? -14 : 14), T.py(p.y) + (i ? -18 : 18), { tam: 12, peso: 600, fundo: true, alinha: i ? "right" : "left" }));   // rotulo direto
  ligarDica(c, [...P, ...extra].map((p) => ({ x: T.px(p.x), y: T.py(p.y), texto: `${p.rotulo ? p.rotulo + "\n" : ""}${xlabel} = ${num(p.x)}\n${ylabel} = ${num(p.y)}` })));
  return { c, T };
}
function figResiduos(spec) {
  const { c } = figDispersao(spec, { xlabel: "valor ajustado", ylabel: "resíduo", ref: (ctx, T) => linhaH(ctx, T, 0, CINZA) });
  return { canvas: c, tabela: { cab: ["Ajustado", "Resíduo"], linhas: spec.pontos.map((p) => [n(p.x), n(p.y)]) } };
}
function figQQ(spec) {
  const P = spec.pontos, ys = P.map((p) => p.y).sort((a, b) => a - b), zs = P.map((p) => p.x);
  const q = (v, f) => { const i = f * (v.length - 1), a = Math.floor(i); return v[a] + (i - a) * ((v[a + 1] ?? v[a]) - v[a]); };
  const zq = [...zs].sort((a, b) => a - b), incl = (q(ys, 0.75) - q(ys, 0.25)) / ((q(zq, 0.75) - q(zq, 0.25)) || 1), corte = q(ys, 0.25) - incl * q(zq, 0.25);
  const { c } = figDispersao(spec, { xlabel: "quantil normal", ylabel: "resíduo", ref: (ctx, T) => {
    ctx.save(); ctx.beginPath(); ctx.rect(T.X0, T.Y0, T.X1 - T.X0, T.Y1 - T.Y0); ctx.clip();     // reta dentro do quadro
    ctx.strokeStyle = CINZA; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(T.px(T.xa), T.py(corte + incl * T.xa)); ctx.lineTo(T.px(T.xb), T.py(corte + incl * T.xb)); ctx.stroke(); ctx.restore();
  } });
  return { canvas: c, tabela: { cab: ["Quantil normal", "Resíduo"], linhas: P.map((p) => [n(p.x), n(p.y)]) } };
}
function figMeioNormal(spec) {
  const { c } = figDispersao(spec, { xlabel: "|efeito|", ylabel: "quantil meio-normal", rotular: true });
  return { canvas: c, tabela: { cab: ["Termo", "|Efeito|", "Quantil"], linhas: spec.pontos.map((p) => [s(p.rotulo), n(p.x), n(p.y)]) } };
}
function figFrente(spec) {
  const { c } = figDispersao(spec, { xlabel: spec.rotX, ylabel: spec.rotY, destaque: spec.destaque });
  return { canvas: c, tabela: { cab: [spec.rotX, spec.rotY], linhas: [...spec.pontos.map((p) => [n(p.x), n(p.y)]), ...spec.destaque.map((p) => [n(p.x), n(p.y)])] } };
}

// ---- Pareto dos efeitos: barras horizontais ordenadas + linha critica --------
function figPareto(spec) {
  const it = [...spec.itens].sort((a, b) => b.v - a.v), m = it.length;
  const alt = Math.max(H, 90 + 34 * m), { c, ctx } = figura(W, alt);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, alt);
  const X0 = 90, X1 = W - 30, Y0 = 46, Y1 = alt - 56, xm = Math.max(...it.map((i) => i.v), ...spec.limites.map((l) => l.v)) * 1.12 || 1;
  const px = (v) => X0 + v / xm * (X1 - X0), bh = (Y1 - Y0) / m;
  texto(ctx, spec.titulo, (X0 + X1) / 2, 20, { alinha: "center", peso: 600, tam: 14 });
  ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
  const passo = 10 ** Math.floor(Math.log10(xm / 5)) * ([1, 2, 5].find((f) => xm / (10 ** Math.floor(Math.log10(xm / 5)) * f) <= 7) || 10);
  for (let v = 0; v <= xm; v += passo) { const x = px(v); ctx.beginPath(); ctx.moveTo(x, Y0); ctx.lineTo(x, Y1); ctx.stroke(); texto(ctx, num(v, 3), x, Y1 + 14, { alinha: "center", tam: 12 }); }
  texto(ctx, spec.rotX, (X0 + X1) / 2, Y1 + 38, { alinha: "center" });
  const alvos = [], xLim = spec.limites.map((l) => px(l.v));
  it.forEach((i, j) => {
    const y = Y0 + j * bh + bh * 0.18, h = bh * 0.64;
    ctx.fillStyle = PALETA[0]; ctx.fillRect(X0, y, px(i.v) - X0, h);
    texto(ctx, i.rotulo, X0 - 10, y + h / 2, { alinha: "right", peso: 600 });
    // valor da barra: depois da ponta, ou depois da linha critica se ela estiver no caminho
    let xr = px(i.v) + 6;
    for (const xl of xLim) if (xl >= xr - 4 && xl <= xr + 44) xr = xl + 6;
    texto(ctx, num(i.v, 3), xr, y + h / 2, { tam: 12, cor: CINZA });
    alvos.push({ x: px(i.v), y: y + h / 2, texto: `${i.rotulo}: ${spec.rotX} = ${num(i.v)}\n${i.sig ? "significativo" : "não significativo"}` });
  });
  spec.limites.forEach((l, j) => {
    const x = px(l.v); ctx.save(); ctx.strokeStyle = TINTA; ctx.lineWidth = 2; ctx.setLineDash(j ? [2, 4] : [8, 5]);
    ctx.beginPath(); ctx.moveTo(x, Y0 - 6); ctx.lineTo(x, Y1); ctx.stroke(); ctx.restore();
    texto(ctx, `${l.rot} = ${num(l.v, 3)}`, x + 4, Y0 - 12 + j * 14, { tam: 12, peso: 600 });
  });
  ctx.strokeStyle = "#555"; ctx.setLineDash([]); ctx.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
  ligarDica(c, alvos);
  return { canvas: c, tabela: { cab: ["Termo", spec.rotX, "Situação"], linhas: it.map((i) => [s(i.rotulo), n(i.v), { t: "sig", v: i.sig }]) } };
}

// ---- efeitos principais e interacoes: paineis lado a lado, mesmo eixo y ------
function paineis(spec, itens, desenho) {
  const k = itens.length, col = Math.min(k, 4), lin = Math.ceil(k / col), hp = 330, { c, ctx } = figura(W, 40 + hp * lin);
  texto(ctx, spec.titulo, W / 2, 18, { alinha: "center", peso: 600, tam: 14 });
  // ylimEf: min e max de todas as medias dos graficos de efeitos da resposta (principais e
  // interacoes), para que todos fiquem na mesma escala; folga pequena so para nao cortar o marcador
  const vals = itens.flatMap((i) => desenho.vals(i)), yl = faixa(spec.ylimEf || vals, spec.ylimEf ? 0.05 : 0.15), alvos = [];
  itens.forEach((it, i) => {
    const R = { x: (i % col) * (W / col), y: 34 + Math.floor(i / col) * hp, w: W / col, h: hp };
    const T = painel(ctx, R, { titulo: desenho.titulo(it), xlabel: desenho.xlabel(it), ylabel: i % col === 0 ? spec.rotY : "", xlim: [-1.4, 1.4], ylim: yl,
      xticks: desenho.xticks(it), series: desenho.series(it), legenda: desenho.legenda?.(it) });
    for (const a of desenho.alvos(it)) alvos.push({ x: T.px(a.x), y: T.py(a.y), texto: a.texto });
  });
  ligarDica(c, alvos);
  return c;
}
// eixo x dos efeitos: "codificado" (−1/+1) ou "real" (niveis informados na revisao).
// Fator sem niveis informados fica codificado mesmo no modo real.
function eixoFator(spec, nome) {
  const f = spec.fatores?.[nome] || {}, real = spec.eixoX === "real" && f.niv;
  const nivel = (v) => (real ? num(v < 0 ? f.niv.baixo : f.niv.alto, 4) : v < 0 ? "−1" : "+1");
  const comUn = (v) => (real && f.un ? `${nivel(v)} ${f.un}` : nivel(v));
  return { nome: f.nome || nome, rot: f.rot || nome, ticks: { pos: [-1, 1], rot: [nivel(-1), nivel(1)] }, nivel, comUn };
}
function figPrincipais(spec) {
  const c = paineis(spec, spec.itens, {
    vals: (i) => [i.baixo, i.alto], titulo: (i) => `${i.letra}: ${eixoFator(spec, i.nome).nome}`, xlabel: (i) => eixoFator(spec, i.nome).rot, xticks: (i) => eixoFator(spec, i.nome).ticks,
    series: (i) => [{ x: [-1, 1], y: [i.baixo, i.alto], cor: PALETA[0], marca: "o", tam: 8, largura: 2 }],
    alvos: (i) => { const e = eixoFator(spec, i.nome); return [{ x: -1, y: i.baixo, texto: `${e.nome} = ${e.comUn(-1)}\nmédia = ${num(i.baixo)}` }, { x: 1, y: i.alto, texto: `${e.nome} = ${e.comUn(1)}\nmédia = ${num(i.alto)}` }]; },
  });
  return { canvas: c, tabela: { cab: ["Fator", "Média em −1", "Média em +1", "Efeito"], linhas: spec.itens.map((i) => [s(`${i.letra}: ${i.nome}`), n(i.baixo), n(i.alto), n(i.alto - i.baixo)]) } };
}
function figInteracoes(spec) {
  const c = paineis(spec, spec.itens, {
    vals: (i) => [i.mm, i.mp, i.pm, i.pp], titulo: (i) => `${i.rotulo}: ${eixoFator(spec, i.a).nome} × ${eixoFator(spec, i.b).nome}`, xlabel: (i) => eixoFator(spec, i.a).rot, xticks: (i) => eixoFator(spec, i.a).ticks, legenda: () => "nw",
    series: (i) => { const b = eixoFator(spec, i.b); return [{ x: [-1, 1], y: [i.mm, i.pm], cor: PALETA[0], marca: "o", tam: 8, largura: 2, rotulo: `${b.nome} = ${b.comUn(-1)}` },
      { x: [-1, 1], y: [i.mp, i.pp], cor: PALETA[1], marca: "s", tam: 8, largura: 2, traco: "--", rotulo: `${b.nome} = ${b.comUn(1)}` }]; },
    alvos: (i) => { const a = eixoFator(spec, i.a), b = eixoFator(spec, i.b);
      return [[-1, -1, i.mm], [-1, 1, i.mp], [1, -1, i.pm], [1, 1, i.pp]].map(([x, z, y]) => ({ x, y, texto: `${a.nome} = ${a.comUn(x)}, ${b.nome} = ${b.comUn(z)}\nmédia = ${num(y)}` })); },
  });
  return { canvas: c, tabela: { cab: ["Interação", "(−,−)", "(−,+)", "(+,−)", "(+,+)"], linhas: spec.itens.map((i) => [s(`${i.a} × ${i.b}`), n(i.mm), n(i.mp), n(i.pm), n(i.pp)]) } };
}

// ---- superficie de resposta (RSM): fatia em 2 fatores, grade, isolinhas e curvas de nivel
export const NIV = 8, RAMPA = ["#cde2fb", "#0d366b"];
const hex = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
export function rampa(t) {              // [r, g, b] do matiz unico, t em 0..1
  const A = hex(RAMPA[0]), B = hex(RAMPA[1]), u = Math.min(1, Math.max(0, t));
  return A.map((v, i) => Math.round(v + (B[i] - v) * u));
}
const mistura = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(",")})`; };
export const coresFaixas = () => [...Array(NIV).keys()].map((k) => mistura(RAMPA[0], RAMPA[1], k / (NIV - 1)));

// Fatia do modelo nos fatores spec.par = [i, j]; os demais ficam em spec.fixo.
// spec: {resposta, nomes, k, raio, prever, fixo, estac: {xs, rotulo} | null, X, obs, par}
export function fatia(spec) {
  const [i, j] = spec.par || [0, 1], k = spec.k, r = spec.raio * 1.05;
  const f = (u, v) => { const x = spec.fixo.slice(); x[i] = u; x[j] = v; return spec.prever(x); };
  const par = `${spec.nomes[i]} × ${spec.nomes[j]}${k > 2 ? "; demais fatores fixos" : ""}`;
  return { i, j, r, f, par, rotX: spec.nomes[i], rotY: spec.nomes[j], ex: eixoSup(spec, i, r), ey: eixoSup(spec, j, r),
    ponto: spec.estac ? { x: spec.estac.xs[i], y: spec.estac.xs[j], rotulo: spec.estac.rotulo } : null,
    // com 2 fatores todo ensaio esta na fatia: leva a resposta observada (z) para o grafico 3D
    ensaios: spec.X.map((x, n) => ({ x: x[i], y: x[j], z: k === 2 && spec.obs ? spec.obs[n] : undefined })) };
}
// Eixo de um fator da superficie: codificado, ou na grandeza real (spec.eixoX = "real" e niveis
// −1/+1 informados na revisao). O desenho continua em coordenadas codificadas; mudam as marcas
// (valores redondos na grandeza real), o rotulo do eixo e os valores da dica.
// Devolve {rot, ticks: [{pos (codificado), rot}], val(codificado) -> valor mostrado, un}.
export function eixoSup(spec, idx, r) {
  const f = spec.fatores?.[idx], real = spec.eixoX === "real" && f?.niv, nome = spec.nomes[idx];
  const c = real ? (f.niv.alto + f.niv.baixo) / 2 : 0, h = real ? (f.niv.alto - f.niv.baixo) / 2 : 1;
  const { t, passo } = ticksLineares(c - h * r, c + h * r, 7);
  return { rot: real ? `${nome}${f.un ? ` [${f.un}]` : " (nível real)"}` : `${nome} (codificado)`, un: real ? f.un : "", val: (v) => c + h * v,
    ticks: t.filter((v) => Math.abs((v - c) / h) <= r * 1.0001).map((v) => ({ pos: (v - c) / h, rot: fmtTick(v, passo) })) };
}
// texto "fator = valor [un]" para a dica, no eixo escolhido
export const valorEixo = (e, nome, v) => `${nome} = ${num(e.val(v), 4)}${e.un ? ` ${e.un}` : ""}`;
// Valores do modelo em uma grade (NG+1) x (NG+1) sobre [-r, r]^2: Z[a * (NG + 1) + b] = f(u_a, v_b)
export function grade(F, NG) {
  const m = NG + 1, Z = new Float64Array(m * m); let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
    const z = F.f(-F.r + 2 * F.r * a / NG, -F.r + 2 * F.r * b / NG); Z[a * m + b] = z; if (z < lo) lo = z; if (z > hi) hi = z;
  }
  if (!(hi > lo)) { const d = Math.abs(lo) || 1; lo -= d / 2; hi += d / 2; }
  return { Z, NG, lo, hi, r: F.r, u: (a) => -F.r + 2 * F.r * a / NG };
}
// Isolinha do nivel c (quadrados em marcha, interpolacao linear): segmentos [u1, v1, u2, v2]
export function isolinha(G, c) {
  const { Z, NG } = G, m = NG + 1, seg = [];
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) {
    const q = [Z[a * m + b], Z[(a + 1) * m + b], Z[(a + 1) * m + b + 1], Z[a * m + b + 1]];
    const P = [[a, b], [a + 1, b], [a + 1, b + 1], [a, b + 1]], pts = [];
    for (let e = 0; e < 4; e++) {
      const z0 = q[e], z1 = q[(e + 1) % 4];
      if ((z0 < c) !== (z1 < c)) { const t = (c - z0) / (z1 - z0), A = P[e], B = P[(e + 1) % 4]; pts.push(G.u(A[0] + t * (B[0] - A[0])), G.u(A[1] + t * (B[1] - A[1]))); }
    }
    for (let e = 0; e + 3 < pts.length; e += 4) seg.push([pts[e], pts[e + 1], pts[e + 2], pts[e + 3]]);
  }
  return seg;
}
// Escala de cores a direita (a mesma nas curvas de nivel e na superficie 3D)
export function escalaCores(ctx, LX, LY, LH, lo, hi, rotulo) {
  const cores = coresFaixas(), bh = LH / NIV, passo = (hi - lo) / NIV;
  cores.forEach((cor, k) => { ctx.fillStyle = cor; ctx.fillRect(LX, LY + LH - (k + 1) * bh, 22, bh + 0.4); });
  ctx.strokeStyle = "#555"; ctx.lineWidth = 1; ctx.strokeRect(LX, LY, 22, LH);
  for (let k = 0; k <= NIV; k++) texto(ctx, num(lo + k * passo, 3), LX + 28, LY + LH - k * bh, { tam: 12 });
  texto(ctx, rotulo, LX - 6, LY - 14, { tam: 12, peso: 600 });
}

const WS = 1000, HS = 680;              // tamanho unico das figuras de superficie (2D e 3D)
function figContorno(spec) {
  const { c, ctx } = figura(WS, HS), F = fatia(spec), r = F.r, G = grade(F, 200), NG = G.NG, m = NG + 1;
  const { lo, hi } = G, passo = (hi - lo) / NIV, cores = coresFaixas();
  const nivel = (v) => Math.min(NIV - 1, Math.max(0, Math.floor((v - lo) / passo)));
  const lado = HS - 84, R = { x: 110, y: 0, w: lado + 90, h: HS };      // area de plotagem quadrada
  const T = painel(ctx, R, { titulo: `${spec.resposta}: curvas de nível (${F.par})`, xlabel: F.ex.rot, ylabel: F.ey.rot, xlim: [-r, r], ylim: [-r, r], series: [],
    xticks: { pos: F.ex.ticks.map((t) => t.pos), rot: F.ex.ticks.map((t) => t.rot) }, yticks: { pos: F.ey.ticks.map((t) => t.pos), rot: F.ey.ticks.map((t) => t.rot) } });
  ctx.save(); ctx.beginPath(); ctx.rect(T.X0, T.Y0, T.X1 - T.X0, T.Y1 - T.Y0); ctx.clip();
  const cw = (T.X1 - T.X0) / NG, ch = (T.Y1 - T.Y0) / NG;
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) {
    const z = (G.Z[a * m + b] + G.Z[(a + 1) * m + b] + G.Z[(a + 1) * m + b + 1] + G.Z[a * m + b + 1]) / 4;
    ctx.fillStyle = cores[nivel(z)]; ctx.fillRect(T.X0 + a * cw, T.Y1 - (b + 1) * ch, cw + 0.4, ch + 0.4);
  }
  // isolinhas entre as faixas: borda nitida em qualquer resolucao
  ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.beginPath();
  for (let k = 1; k < NIV; k++) for (const s of isolinha(G, lo + k * passo)) { ctx.moveTo(T.px(s[0]), T.py(s[1])); ctx.lineTo(T.px(s[2]), T.py(s[3])); }
  ctx.stroke();
  // regiao ensaiada (circulo de raio alfa) e ensaios
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
  ctx.beginPath(); ctx.arc(T.px(0), T.py(0), (T.px(spec.raio) - T.px(0)), 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
  for (const e of F.ensaios) { ctx.fillStyle = "#ffffff"; ctx.strokeStyle = TINTA; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(T.px(e.x), T.py(e.y), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
  if (F.ponto && Math.abs(F.ponto.x) <= r && Math.abs(F.ponto.y) <= r) {
    const x = T.px(F.ponto.x), y = T.py(F.ponto.y);
    ctx.fillStyle = PALETA[1]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore(); ctx.save();
    const rot = `ponto estacionário (${F.ponto.rotulo})`; ctx.font = `600 13px ${FONTE}`;
    const lx = Math.min(x + 14, T.X1 - ctx.measureText(rot).width - 6);
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(lx - 4, y - 24, ctx.measureText(rot).width + 8, 18);
    texto(ctx, rot, lx, y - 15, { peso: 600 });
  }
  ctx.restore();
  escalaCores(ctx, T.X1 + 34, T.Y0 + 30, T.Y1 - T.Y0 - 30, lo, hi, "resposta prevista");   // abaixo da linha do titulo
  ligarDica(c, (x, y) => {
    if (x < T.X0 || x > T.X1 || y < T.Y0 || y > T.Y1) return null;
    const u = T.inv(x), v = r - (y - T.Y0) / (T.Y1 - T.Y0) * 2 * r;
    return `${valorEixo(F.ex, F.rotX, u)}\n${valorEixo(F.ey, F.rotY, v)}\nprevisto = ${num(F.f(u, v))}`;
  });
  const linhas = [...Array(NIV).keys()].map((k) => [s(`faixa ${k + 1}`), n(lo + k * passo), n(lo + (k + 1) * passo)]);
  if (F.ponto) linhas.push([s(`ponto estacionário (${F.ponto.rotulo})`), n(F.ponto.x), n(F.ponto.y)]);
  return { canvas: c, tabela: { cab: ["Item", "De / codificado 1", "Até / codificado 2"], linhas } };
}

const TIPOS = { ic: (s) => figIC(s, true), ic0: (s) => figIC(s, false), residuos: figResiduos, qq: figQQ, meioNormal: figMeioNormal,
  frente: figFrente, pareto: figPareto, principais: figPrincipais, interacoes: figInteracoes, contorno: figContorno };
export function desenharFigura(spec) {
  const f = TIPOS[spec.tipo]; if (!f) return null;
  const r = f(spec); r.canvas.setAttribute("role", "img"); r.canvas.setAttribute("aria-label", spec.titulo);
  return r;
}
