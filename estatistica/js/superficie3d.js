// superficie3d.js - superficie de resposta em 3D, em <canvas> e sem bibliotecas (funciona sem
// internet e o PNG gravado e exatamente o que esta na tela). Projecao ortografica com giro
// (azimute) e inclinacao (elevacao); as faces sao pintadas de tras para a frente.
//  - cor = resposta prevista, no mesmo matiz unico das curvas de nivel (com sombra leve);
//  - no piso: curvas de nivel, regiao ensaiada (circulo de raio alfa) e ensaios;
//  - com 2 fatores, os valores observados aparecem ligados a superficie por uma haste.
// blocoSuperficie(spec, op) monta o bloco da tela: botoes 3D / curvas de nivel, giro por
// arrasto, botoes ou setas do teclado, vista padrao e escolha do par de fatores.
import { ticksLineares, fmtTick } from "../../comum/js/graficos.js";
import { num } from "./conclusoes.js";
import { figura, valorEixo, fatia, grade, isolinha, rampa, coresFaixas, escalaCores, desenharFigura, ligarDica, texto, PALETA, TINTA, NIV } from "./figuras.js";

const W = 1000, H = 680, M = 44, ZA = 0.62;          // malha M x M; meia altura do eixo z
const VISTA = { az: 35, el: 28 }, EL_MIN = 8, EL_MAX = 85;
const GRADE = "#d3dad6", PAREDE = "#f7f9f8", PISO = "#f1f4f3", CINZA = "#5e6a64";

// Desenha a superficie na vista {az, el} (graus). Devolve os vertices na tela (para a dica).
export function desenhar3D(ctx, spec, vista) {
  const F = fatia(spec), G = grade(F, M), { lo, hi, r } = G, m = M + 1;
  const az = vista.az * Math.PI / 180, el = vista.el * Math.PI / 180, ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
  // escala: a caixa inteira cabe na figura em qualquer vista
  const S = Math.min(215, 250 / (ZA * ce + (Math.abs(sa) + Math.abs(ca)) * se)), cx = 455, cy = 362;
  // a superficie ocupa os 60 % de cima da caixa: sobra espaco para ver as curvas de nivel no piso
  const zn = (z) => (-1 + 2 * (0.4 + 0.6 * (z - lo) / (hi - lo))) * ZA;
  // (x, y em -1..1, z normalizado) -> tela; prof: quanto maior, mais longe do observador
  const P = (x, y, z) => { const xr = x * ca - y * sa, yr = x * sa + y * ca; return [cx + S * xr, cy - S * (z * ce + yr * se), yr]; };
  const linha = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
  const poli = (pts, cor) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fillStyle = cor; ctx.fill(); };

  ctx.save(); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  texto(ctx, `${spec.resposta}: superfície de resposta (${F.par})`, cx, 20, { alinha: "center", peso: 600, tam: 14 });

  // ---- caixa: piso e as duas paredes do fundo, com grade ----
  const xw = sa >= 0 ? 1 : -1, yw = ca >= 0 ? 1 : -1;         // paredes mais distantes: x = xw e y = yw
  const tz = ticksLineares(lo, hi, 5);
  const tzv = tz.t.filter((v) => v >= lo - 1e-9 * (hi - lo) && v <= hi + 1e-9 * (hi - lo));
  poli([P(-1, -1, -ZA), P(1, -1, -ZA), P(1, 1, -ZA), P(-1, 1, -ZA)], PISO);
  poli([P(xw, -1, -ZA), P(xw, 1, -ZA), P(xw, 1, ZA), P(xw, -1, ZA)], PAREDE);
  poli([P(-1, yw, -ZA), P(1, yw, -ZA), P(1, yw, ZA), P(-1, yw, ZA)], PAREDE);
  ctx.strokeStyle = GRADE; ctx.lineWidth = 1;
  for (const k of F.ex.ticks) { const t = k.pos / r; linha(P(t, -1, -ZA), P(t, 1, -ZA)); linha(P(t, yw, -ZA), P(t, yw, ZA)); }     // piso e parede
  for (const k of F.ey.ticks) { const t = k.pos / r; linha(P(-1, t, -ZA), P(1, t, -ZA)); linha(P(xw, t, -ZA), P(xw, t, ZA)); }
  for (const v of tzv) { const z = zn(v); linha(P(xw, -1, z), P(xw, 1, z)); linha(P(-1, yw, z), P(1, yw, z)); }
  ctx.strokeStyle = "#8b9590";
  for (const [a, b] of [[P(-1, -1, -ZA), P(1, -1, -ZA)], [P(1, -1, -ZA), P(1, 1, -ZA)], [P(1, 1, -ZA), P(-1, 1, -ZA)], [P(-1, 1, -ZA), P(-1, -1, -ZA)],
    [P(xw, yw, -ZA), P(xw, yw, ZA)], [P(xw, -yw, -ZA), P(xw, -yw, ZA)], [P(-xw, yw, -ZA), P(-xw, yw, ZA)],
    [P(xw, -yw, ZA), P(xw, yw, ZA)], [P(-xw, yw, ZA), P(xw, yw, ZA)]]) linha(a, b);

  // ---- piso: curvas de nivel, regiao ensaiada e ensaios ----
  const cores = coresFaixas(), G2 = grade(F, 90), passo = (hi - lo) / NIV;
  ctx.lineWidth = 1.4; ctx.lineCap = "round";
  for (let k = 1; k < NIV; k++) {
    ctx.strokeStyle = cores[Math.max(k, 2)]; ctx.beginPath();
    for (const s of isolinha(G2, lo + k * passo)) { const a = P(s[0] / r, s[1] / r, -ZA), b = P(s[2] / r, s[3] / r, -ZA); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    ctx.stroke();
  }
  ctx.strokeStyle = CINZA; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath();
  for (let i = 0; i <= 96; i++) { const t = i / 96 * 2 * Math.PI, p = P(spec.raio / r * Math.cos(t), spec.raio / r * Math.sin(t), -ZA); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
  ctx.stroke(); ctx.setLineDash([]);
  const bola = (p, raio, cor, borda) => { ctx.beginPath(); ctx.arc(p[0], p[1], raio, 0, 2 * Math.PI); ctx.fillStyle = cor; ctx.fill(); ctx.strokeStyle = borda; ctx.lineWidth = 1.5; ctx.stroke(); };
  for (const e of F.ensaios) bola(P(e.x / r, e.y / r, -ZA), 3.2, "#fff", TINTA);

  // ---- superficie (faces) e pontos, de tras para a frente ----
  const V = new Array(m * m), alvos = [];
  for (let a = 0; a < m; a++) for (let b = 0; b < m; b++) {
    const p = P(-1 + 2 * a / M, -1 + 2 * b / M, zn(G.Z[a * m + b])); V[a * m + b] = p;
    alvos.push({ x: p[0], y: p[1], u: G.u(a), v: G.u(b), z: G.Z[a * m + b] });
  }
  const itens = [];
  // luz fixa em relacao ao observador (de cima, pela esquerda): realca o relevo sem trocar o matiz
  const L = [-0.42, -0.36, 0.83];
  for (let a = 0; a < M; a++) for (let b = 0; b < M; b++) {
    const z00 = G.Z[a * m + b], z10 = G.Z[(a + 1) * m + b], z11 = G.Z[(a + 1) * m + b + 1], z01 = G.Z[a * m + b + 1], zm = (z00 + z10 + z11 + z01) / 4;
    const dx = (zn(z10) + zn(z11) - zn(z00) - zn(z01)) / 2 / (2 / M), dy = (zn(z01) + zn(z11) - zn(z00) - zn(z10)) / 2 / (2 / M);
    const nn = Math.hypot(dx, dy, 1), nx = (-dx * ca + dy * sa) / nn, ny = (-dx * sa - dy * ca) / nn, nz = 1 / nn;   // normal no referencial do observador
    const luz = 0.84 + 0.16 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const cor = rampa((zm - lo) / (hi - lo)).map((c) => Math.round(c * luz));
    const xc = -1 + 2 * (a + 0.5) / M, yc = -1 + 2 * (b + 0.5) / M;
    itens.push({ prof: xc * sa + yc * ca, q: [V[a * m + b], V[(a + 1) * m + b], V[(a + 1) * m + b + 1], V[a * m + b + 1]], cor: `rgb(${cor.join(",")})` });
  }
  const dentro = (p) => Math.abs(p.x) <= r && Math.abs(p.y) <= r;
  const prof = (p) => (p.x * sa + p.y * ca) / r - 1e-3;
  let temObs = false;
  for (const e of F.ensaios) if (Number.isFinite(e.z) && dentro(e)) { temObs = true; itens.push({ prof: prof(e), obs: e }); }
  const est = F.ponto && dentro(F.ponto) ? F.ponto : null;
  if (est) itens.push({ prof: -Infinity, est });        // por ultimo: o ponto estacionario fica sempre visivel
  itens.sort((a, b) => b.prof - a.prof);
  for (const it of itens) {
    if (it.q) {
      poli(it.q, it.cor); ctx.strokeStyle = "rgba(13,54,107,.28)"; ctx.lineWidth = 0.6; ctx.stroke();
    } else if (it.obs) {
      const e = it.obs, zs = F.f(e.x, e.y), zo = Math.min(hi, Math.max(lo, e.z)), a = P(e.x / r, e.y / r, zn(zs)), b = P(e.x / r, e.y / r, zn(zo));
      ctx.strokeStyle = TINTA; ctx.lineWidth = 1.2; linha(a, b); bola(b, 4.2, PALETA[3], TINTA);
      alvos.push({ x: b[0], y: b[1], obs: e, zs });
    } else {
      const e = it.est, z = F.f(e.x, e.y), a = P(e.x / r, e.y / r, -ZA), b = P(e.x / r, e.y / r, zn(Math.min(hi, Math.max(lo, z))));
      ctx.strokeStyle = PALETA[1]; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); linha(a, b); ctx.setLineDash([]);
      ctx.fillStyle = PALETA[1]; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(b[0], b[1] - 9); ctx.lineTo(b[0] + 9, b[1]); ctx.lineTo(b[0], b[1] + 9); ctx.lineTo(b[0] - 9, b[1]); ctx.closePath(); ctx.fill(); ctx.stroke();
      alvos.push({ x: b[0], y: b[1], est: e, z });
    }
  }

  // ---- eixos: marcas e rotulos nas arestas da frente; eixo z na aresta lateral esquerda ----
  const fora = (p, q, d) => { const n = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1; return [p[0] + (p[0] - q[0]) / n * d, p[1] + (p[1] - q[1]) / n * d]; };
  ctx.strokeStyle = "#8b9590"; ctx.lineWidth = 1;
  const marca = (p, q, rot) => { let e = fora(p, q, 6); linha(p, e); e = fora(p, q, 18); texto(ctx, rot, e[0], e[1], { alinha: "center", tam: 12 }); };
  for (const k of F.ex.ticks) marca(P(k.pos / r, -yw, -ZA), P(k.pos / r, 0, -ZA), k.rot);
  for (const k of F.ey.ticks) marca(P(-xw, k.pos / r, -ZA), P(0, k.pos / r, -ZA), k.rot);
  // titulo do eixo: para fora da aresta, alinhado pelo lado de fora para nao cair sobre as marcas
  const titulo = (p, q, rot) => {
    const e = fora(p, q, 38), dx = (p[0] - q[0]) / (Math.hypot(p[0] - q[0], p[1] - q[1]) || 1);
    texto(ctx, rot, e[0], e[1] + (Math.abs(dx) > 0.3 ? 0 : 6), { alinha: dx > 0.3 ? "left" : dx < -0.3 ? "right" : "center" });
  };
  titulo(P(0, -yw, -ZA), P(0, 0, -ZA), F.ex.rot);
  titulo(P(-xw, 0, -ZA), P(0, 0, -ZA), F.ey.rot);
  const cz = [[xw, -yw], [-xw, yw]].sort((a, b) => P(a[0], a[1], 0)[0] - P(b[0], b[1], 0)[0])[0];
  // vista quase de cima: o eixo z encurta; pula rotulos para nao empilhar
  const salto = Math.max(1, Math.ceil(14 / ((zn(tz.passo) - zn(0)) * S * ce || 1e-9)));
  tzv.forEach((v, i) => { const p = P(cz[0], cz[1], zn(v)); linha(p, [p[0] - 6, p[1]]); if (i % salto === 0) texto(ctx, fmtTick(v, tz.passo), p[0] - 10, p[1], { alinha: "right", tam: 12 }); });
  const pz = P(cz[0], cz[1], 0);
  ctx.save(); ctx.translate(Math.max(16, pz[0] - 62), pz[1]); ctx.rotate(-Math.PI / 2); texto(ctx, "resposta prevista", 0, 0, { alinha: "center" }); ctx.restore();

  // ---- escala de cores e legenda dos simbolos ----
  escalaCores(ctx, W - 108, 150, 380, lo, hi, "resposta prevista");
  const leg = [["ensaio", "ensaios (no piso)"], ...(temObs ? [["obs", "valor observado"]] : []), ...(est ? [["est", `ponto estacionário (${est.rotulo})`]] : []), ["reg", "região ensaiada"]];
  leg.forEach(([tipo, rot], i) => {
    const x = 26, y = H - 22 - (leg.length - 1 - i) * 19;
    if (tipo === "ensaio") bola([x, y], 3.2, "#fff", TINTA);
    else if (tipo === "obs") bola([x, y], 4.2, PALETA[3], TINTA);
    else if (tipo === "est") { ctx.fillStyle = PALETA[1]; ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill(); }
    else { ctx.strokeStyle = CINZA; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); linha([x - 8, y], [x + 8, y]); ctx.setLineDash([]); }
    texto(ctx, rot, x + 16, y, { tam: 12 });
  });
  ctx.restore();
  return { alvos, F };
}

// ---- bloco da tela ---------------------------------------------------------------
function botao(txt, rotulo, acao) {
  const b = document.createElement("button"); b.type = "button"; b.className = "sec"; b.textContent = txt;
  if (rotulo) { b.setAttribute("aria-label", rotulo); b.title = rotulo; }
  b.addEventListener("click", acao); return b;
}
// spec: especificacao da figura "contorno" (resultados.js); op.detalhes(tabela) -> elemento com
// a tabela dos numeros; op.aoMudar(regs) e chamado quando a figura muda (para regravar os PNG).
// Devolve {el, regs: [{id, canvas}]}: superficie 3D e curvas de nivel, as duas gravadas.
export function blocoSuperficie(spec, op = {}) {
  const el = document.createElement("figure"); el.className = "bloco-fig bloco-sup";
  const { c: c3, ctx } = figura(W, H), vista = { ...VISTA };
  c3.classList.add("gira"); c3.tabIndex = 0; c3.setAttribute("role", "img");
  let fig2 = desenharFigura(spec), cena = null, modo = "3d", det = null, quadro = 0, aviso = 0;
  const reg3 = { id: spec.idSup, canvas: c3 }, reg2 = { id: spec.id, canvas: fig2.canvas };
  const pintar = () => {
    quadro = 0; cena = desenhar3D(ctx, spec, vista);
    c3.setAttribute("aria-label", `${spec.resposta}: superfície de resposta em 3D (${cena.F.par}); giro ${Math.round(vista.az)}°, inclinação ${Math.round(vista.el)}°. Use as setas do teclado para girar.`);
  };
  const pedir = () => { if (!quadro) quadro = requestAnimationFrame(pintar); };
  const avisar = (regs, ja) => { clearTimeout(aviso); aviso = setTimeout(() => op.aoMudar?.(regs), ja ? 0 : 700); };   // regrava o PNG quando o giro para
  const girar = (daz, del) => {
    vista.az = ((vista.az + daz) % 360 + 360) % 360; vista.el = Math.min(EL_MAX, Math.max(EL_MIN, vista.el + del));
    pedir(); avisar([reg3]);
  };
  ligarDica(c3, (x, y) => {
    if (!cena || arrasto) return null;
    // primeiro os simbolos (observado, ponto estacionario); depois o no da malha mais proximo
    let d = 14, a = cena.alvos.find((p) => (p.obs || p.est) && Math.hypot(p.x - x, p.y - y) < 10) || null;
    if (!a) for (const p of cena.alvos) { const dd = Math.hypot(p.x - x, p.y - y); if (dd < d) { d = dd; a = p; } }
    if (!a) return null;
    const F = cena.F;
    const xy = (x, y, sep) => `${valorEixo(F.ex, F.rotX, x)}${sep}${valorEixo(F.ey, F.rotY, y)}`;
    if (a.obs) return `ensaio: ${xy(a.obs.x, a.obs.y, ", ")}\nobservado = ${num(a.obs.z)}\nprevisto = ${num(a.zs)}`;
    if (a.est) return `ponto estacionário (${a.est.rotulo})\n${xy(a.est.x, a.est.y, ", ")}\nprevisto = ${num(a.z)}`;
    return `${xy(a.u, a.v, "\n")}\nprevisto = ${num(a.z)}`;
  });
  // giro por arrasto (mouse, caneta ou toque; no toque o arrasto vertical continua rolando a pagina)
  let arrasto = null;
  c3.addEventListener("pointerdown", (e) => { arrasto = { x: e.clientX, y: e.clientY }; c3.setPointerCapture(e.pointerId); c3.classList.add("girando"); });
  c3.addEventListener("pointermove", (e) => {
    if (!arrasto) return;
    const k = 360 / (c3.getBoundingClientRect().width || 1);      // uma largura de figura = uma volta
    girar((e.clientX - arrasto.x) * k * 0.6, (e.clientY - arrasto.y) * k * 0.35); arrasto = { x: e.clientX, y: e.clientY };
  });
  const soltar = () => { arrasto = null; c3.classList.remove("girando"); };
  c3.addEventListener("pointerup", soltar); c3.addEventListener("pointercancel", soltar);
  c3.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[e.key];
    if (d) { e.preventDefault(); girar(d[0], d[1]); }
  });

  // barra de botoes
  const barra = document.createElement("div"); barra.className = "barra-fig";
  const alterna = document.createElement("div"); alterna.className = "alterna"; alterna.setAttribute("role", "group"); alterna.setAttribute("aria-label", "Tipo de gráfico da superfície");
  const giro = document.createElement("div"); giro.className = "giro"; giro.setAttribute("role", "group"); giro.setAttribute("aria-label", "Girar a superfície");
  const nota = document.createElement("span"); nota.className = "nota";
  const mostrarModo = (novo) => {
    modo = novo; c3.hidden = modo !== "3d"; reg2.canvas.hidden = modo === "3d"; giro.hidden = modo !== "3d";
    b3.setAttribute("aria-pressed", String(modo === "3d")); b2.setAttribute("aria-pressed", String(modo !== "3d"));
    nota.textContent = modo === "3d" ? "Arraste o gráfico para girar (ou use os botões e as setas do teclado). Passe o mouse para ler os valores."
      : "Passe o mouse sobre o gráfico para ler o valor previsto em cada ponto.";
  };
  const b3 = botao("Superfície 3D", "", () => mostrarModo("3d")), b2 = botao("Curvas de nível (2D)", "", () => mostrarModo("2d"));
  alterna.append(b3, b2);
  giro.append(botao("◀", "Girar para a esquerda", () => girar(-15, 0)), botao("▶", "Girar para a direita", () => girar(15, 0)),
    botao("▲", "Inclinar: ver mais de cima", () => girar(0, 10)), botao("▼", "Inclinar: ver mais de lado", () => girar(0, -10)),
    botao("Vista padrão", "", () => { vista.az = VISTA.az; vista.el = VISTA.el; girar(0, 0); }));
  // spec mudou (par de fatores ou eixos): redesenha as duas figuras e regrava os PNG
  const refazer = () => {
    const nova = desenharFigura(spec); nova.canvas.hidden = modo === "3d";
    el.replaceChild(nova.canvas, reg2.canvas); reg2.canvas = nova.canvas; fig2 = nova;
    if (det) { const d = op.detalhes(nova.tabela); el.replaceChild(d, det); det = d; }
    pintar(); avisar([reg3, reg2], true);
  };
  // eixos dos fatores: codificado ou na grandeza real (mesmo botao dos graficos de efeitos)
  const temNiveis = (spec.fatores || []).some((f) => f.niv);
  const eixos = document.createElement("div"); eixos.className = "alterna"; eixos.setAttribute("role", "group"); eixos.setAttribute("aria-label", "Eixos dos fatores");
  const bEixo = [["codificado", "Codificado (−1 / +1)"], ["real", "Níveis reais"]].map(([m, txt]) => {
    const b = botao(txt, "", () => { spec.eixoX = m; bEixo.forEach((o) => o.setAttribute("aria-pressed", String(o === b))); refazer(); });
    b.setAttribute("aria-pressed", String(spec.eixoX === m));
    if (m === "real" && !temNiveis) { b.disabled = true; b.title = "Informe os níveis −1 e +1 dos fatores na revisão"; }
    return b;
  });
  eixos.append(...bEixo);
  barra.append(alterna, eixos, giro);
  if (spec.k > 2) {                     // escolha do par de fatores dos eixos (os demais ficam fixos)
    const lab = document.createElement("label"); lab.className = "par"; lab.append("Fatores nos eixos: ");
    const sel = document.createElement("select");
    for (let i = 0; i < spec.k; i++) for (let j = i + 1; j < spec.k; j++) { const o = document.createElement("option"); o.value = `${i},${j}`; o.textContent = `${spec.nomes[i]} × ${spec.nomes[j]}`; sel.appendChild(o); }
    sel.addEventListener("change", () => { spec.par = sel.value.split(",").map(Number); refazer(); });
    lab.appendChild(sel); barra.appendChild(lab);
  }
  el.append(barra, nota, c3, fig2.canvas);
  if (op.detalhes && fig2.tabela) { det = op.detalhes(fig2.tabela); el.appendChild(det); }
  pintar(); mostrarModo("3d");
  return { el, regs: [reg3, reg2] };
}
