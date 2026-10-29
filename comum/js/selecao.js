// selecao.js - selecao de faixas de um ensaio (comum aos modulos).
// Duas formas equivalentes de marcar cada limite:
//   - clique no grafico (o clique preenche o proximo limite vazio);
//   - digitacao do tempo [s] na tabela (alternativa por teclado, WCAG 2.5.7).
// Com zoom, os 2 primeiros limites delimitam a regiao de interesse; as faixas
// ficam limitadas a ela. Faixa menor que durMin fica marcada "(curta)" e nao e
// analisada; as demais mantem o numero escolhido.
import { painel, desenharFaixas } from "./graficos.js";

const virg = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "");
const numero = (s) => { const t = String(s).trim().replace(",", "."); return t === "" ? NaN : Number(t); };

export function criarSelecao(el) {
  // el: {canvas, leitura, instrucao, tabela, btDesfazer, btReiniciar, aoMudar}
  let S = null;

  function idx(tt) {                   // amostra mais proxima de tt (t crescente)
    const t = S.t; let a = 0, b = S.N - 1;
    if (tt <= t[0]) return 0;
    if (tt >= t[b]) return b;
    while (b - a > 1) { const m = (a + b) >> 1; if (t[m] <= tt) a = m; else b = m; }
    return tt - t[a] < t[b] - tt ? a : b;
  }

  function vagas() {                   // ordem de preenchimento dos limites
    const v = [];
    if (S.zoom) v.push(["z", 0], ["z", 1]);
    for (let j = 0; j < S.n; j++) v.push(["f" + j, 0], ["f" + j, 1]);
    return v;
  }
  const valor = ([k, p]) => (S.lim[k] ? S.lim[k][p] : null);
  const definir = ([k, p], v) => { if (!S.lim[k]) S.lim[k] = [null, null]; S.lim[k][p] = v; };

  function calcular() {
    const N = S.N;
    let i1 = 0, i2 = N - 1;
    const z = S.lim.z;
    S.zoomFeito = !S.zoom || (z && z[0] !== null && z[1] !== null);
    if (S.zoom && S.zoomFeito) { i1 = idx(Math.min(...z)); i2 = idx(Math.max(...z)); if (i2 - i1 < 2) { i1 = 0; i2 = N - 1; S.zoomFeito = false; } }
    S.i1 = i1; S.i2 = i2;
    S.faixas = [];
    for (let j = 0; j < S.n; j++) {
      const f = S.lim["f" + j];
      if (!f || f[0] === null || f[1] === null) continue;
      const c1 = Math.max(idx(Math.min(...f)), i1), c2 = Math.min(idx(Math.max(...f)), i2);
      S.faixas.push({ c1, c2, num: j + 1, curta: (c2 - c1) / S.fs < S.durMin });
    }
    const prox = vagas().find((v) => valor(v) === null);
    S.prox = prox || null;
    S.pronto = !prox && S.faixas.some((f) => !f.curta);
  }

  function mensagem() {
    const p = S.prox;
    let m;
    if (p && p[0] === "z") m = `Região de interesse: clique no ${p[1] ? "FIM" : "INÍCIO"} da região (ou digite o tempo na tabela).`;
    else if (p) m = `Faixa ${Number(p[0].slice(1)) + 1} de ${S.n}: clique no ${p[1] ? "FIM" : "INÍCIO"} da faixa (ou digite o tempo na tabela).`;
    else m = S.pronto ? "Faixas prontas. Confira a tabela e clique em “Analisar faixas”."
      : "Todas as faixas ficaram menores que a faixa mínima. Altere os tempos ou desfaça.";
    const curtas = S.faixas.filter((f) => f.curta).map((f) => `f${f.num}`);
    if (curtas.length) m += ` ${curtas.join(", ")}: menor que ${virg(S.durMin, 1)} s, não será analisada.`;
    el.instrucao.textContent = m;
  }

  function tabela() {
    const tb = el.tabela; tb.replaceChildren();
    const cab = tb.createTHead().insertRow();
    for (const c of ["", "Início [s]", "Fim [s]", "Duração [s]", "Situação"]) { const th = document.createElement("th"); th.textContent = c; cab.appendChild(th); }
    const corpo = tb.createTBody();
    const linhas = [];
    if (S.zoom) linhas.push(["z", "Região"]);
    for (let j = 0; j < S.n; j++) linhas.push(["f" + j, `f${j + 1}`]);
    for (const [k, rot] of linhas) {
      const tr = corpo.insertRow();
      tr.insertCell().textContent = rot;
      const lim = S.lim[k] || [null, null];
      for (const p of [0, 1]) {
        const td = tr.insertCell(), inp = document.createElement("input");
        inp.inputMode = "decimal"; inp.autocomplete = "off";
        inp.setAttribute("aria-label", `${rot}: ${p ? "fim" : "início"} [s]`);
        inp.value = lim[p] === null ? "" : virg(lim[p], 2);
        inp.addEventListener("change", () => {
          const v = numero(inp.value);
          if (inp.value.trim() === "") { definir([k, p], null); S.hist = S.hist.filter((h) => !(h[0] === k && h[1] === p)); }
          else if (!Number.isFinite(v) || v < S.t[0] || v > S.t[S.N - 1]) { inp.setAttribute("aria-invalid", "true"); el.instrucao.textContent = `${rot}: digite um tempo entre ${virg(S.t[0], 2)} e ${virg(S.t[S.N - 1], 2)} s.`; return; }
          else { definir([k, p], v); S.hist.push([k, p]); }
          atualizar(true);
        });
        td.appendChild(inp);
      }
      const dur = tr.insertCell(), est = tr.insertCell(); est.className = "est";
      if (k === "z") {
        dur.textContent = S.zoomFeito && S.zoom ? virg((S.i2 - S.i1) / S.fs, 2) : "";
        est.textContent = S.zoomFeito && S.zoom ? "delimita as faixas" : "";
      } else {
        const f = S.faixas.find((x) => x.num === Number(k.slice(1)) + 1);
        dur.textContent = f ? virg((f.c2 - f.c1) / S.fs, 2) : "";
        est.textContent = f ? (f.curta ? "curta: não analisada" : "válida") : "";
      }
    }
  }

  function desenhar() {
    const cv = el.canvas, dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { t, i1, i2 } = S;
    let mn = Infinity, mx = -Infinity;
    for (const s of S.series) for (let i = i1; i <= i2; i++) { const v = s.y[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const d = (mx - mn) || Math.abs(mx) || 1;
    S.T = painel(ctx, { x: 0, y: 0, w, h }, {
      titulo: `${S.nome}${S.zoom && S.zoomFeito ? " - região de interesse" : ""}`, xlabel: "t [s]", ylabel: S.rotY,
      xlim: [t[i1], t[i2]], ylim: [mn - 0.05 * d, mx + 0.12 * d], legenda: S.series.length > 1 ? "ne" : undefined,
      series: S.series.map((s) => ({ x: t.subarray(i1, i2 + 1), y: s.y.subarray(i1, i2 + 1), cor: s.cor, largura: 1, rotulo: S.series.length > 1 ? s.rotulo : undefined })),
    });
    const T = S.T;
    desenharFaixas(ctx, T, S.faixas, S.fs, t[0]);
    const linha = (tt, cor, larg = 2, tr = []) => {
      const X = T.px(tt); if (X < T.X0 - 1 || X > T.X1 + 1) return;
      ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.setLineDash(tr);
      ctx.beginPath(); ctx.moveTo(X, T.Y0); ctx.lineTo(X, T.Y1); ctx.stroke(); ctx.restore();
    };
    if (S.zoom && !S.zoomFeito && S.lim.z) for (const v of S.lim.z) if (v !== null) linha(v, "rgb(130,130,130)");
    for (let j = 0; j < S.n; j++) {               // faixa com 1 limite so: linha pendente
      const f = S.lim["f" + j];
      if (f && (f[0] === null) !== (f[1] === null)) linha(f[0] ?? f[1], "rgb(20,20,20)", 2, [6, 3]);
    }
    if (S.hover !== null && S.prox) linha(S.hover, "rgba(0,0,0,0.35)", 1, [4, 4]);
  }

  function atualizar(refazTabela) {
    calcular(); mensagem(); if (refazTabela) tabela(); desenhar();
    el.btDesfazer.disabled = S.hist.length === 0;
    el.aoMudar && el.aoMudar(S.pronto);
  }

  function tempoDoEvento(e) {
    if (!S || !S.T) return null;
    const r = el.canvas.getBoundingClientRect(), X = e.clientX - r.left, T = S.T;
    if (X < T.X0 - 8 || X > T.X1 + 8) return null;
    return Math.min(Math.max(T.inv(X), S.t[S.i1]), S.t[S.i2]);
  }

  el.canvas.addEventListener("pointerdown", (e) => {
    if (!S || !S.prox || e.button !== 0) return;
    const tt = tempoDoEvento(e); if (tt === null) return;
    definir(S.prox, tt); S.hist.push(S.prox); atualizar(true);
  });
  el.canvas.addEventListener("pointermove", (e) => {
    if (!S) return;
    const tt = tempoDoEvento(e); S.hover = tt;
    if (tt === null) el.leitura.textContent = "";
    else {
      const i = idx(tt);
      el.leitura.textContent = `t = ${virg(tt, 2)} s · ` + S.series.map((s) => `${s.rotulo || "y"} = ${virg(s.y[i], 1)}`).join(" · ") + (S.unidade ? ` ${S.unidade}` : "");
    }
    desenhar();
  });
  el.canvas.addEventListener("pointerleave", () => { if (S) { S.hover = null; el.leitura.textContent = ""; desenhar(); } });
  const desfazer = () => { if (S && S.hist.length) { definir(S.hist.pop(), null); atualizar(true); } };
  el.btDesfazer.addEventListener("click", desfazer);
  el.btReiniciar.addEventListener("click", () => { if (S) { S.lim = {}; S.hist = []; atualizar(true); } });
  document.addEventListener("keydown", (e) => {
    if (!S || el.canvas.closest("[hidden]")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); desfazer(); }
  });
  window.addEventListener("resize", () => { if (S) desenhar(); });

  return {
    // cfg: {t, fs, series:[{y, cor, rotulo}], nome, n, zoom, durMin, rotY, unidade}
    iniciar(cfg) {
      S = { ...cfg, N: cfg.t.length, lim: {}, hist: [], hover: null, T: null };
      atualizar(true);
    },
    get estado() { return S ? { pronto: S.pronto, faixas: S.faixas, i1: S.i1, i2: S.i2 } : null; },
    encerrar() { S = null; },
    desenhar() { if (S) desenhar(); },
  };
}
