// selecao.js - selecao de faixas de um ensaio (comum aos modulos).
// Duas formas equivalentes de marcar cada limite:
//   - clique no grafico (o clique preenche o proximo limite vazio);
//   - digitacao do tempo [s] na tabela (alternativa por teclado, WCAG 2.5.7).
// Com zoom, os 2 primeiros limites delimitam a regiao de interesse; as faixas
// ficam limitadas a ela. Com zoom em cada faixa (zoomPorFaixa), cada faixa tem a
// sua regiao: a tela volta ao sinal completo depois de cada faixa, o usuario
// delimita a proxima regiao e marca a faixa dentro dela.
// Faixa menor que durMin fica marcada "(curta)" e nao e analisada; as demais
// mantem o numero escolhido.
import { painel, desenharFaixas } from "./graficos.js";
import { virg, numero } from "./ui.js";

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

  // chave da regiao de interesse da faixa j: uma so ("z") ou uma por faixa ("z0", "z1"...)
  const chaveZoom = (j) => (S.zoomPorFaixa ? "z" + j : "z");
  function vagas() {                   // ordem de preenchimento dos limites
    const v = [];
    if (S.zoom && !S.zoomPorFaixa) v.push(["z", 0], ["z", 1]);
    for (let j = 0; j < S.n; j++) {
      if (S.zoom && S.zoomPorFaixa) v.push(["z" + j, 0], ["z" + j, 1]);
      v.push(["f" + j, 0], ["f" + j, 1]);
    }
    return v;
  }
  const valor = ([k, p]) => (S.lim[k] ? S.lim[k][p] : null);
  const definir = ([k, p], v) => { if (!S.lim[k]) S.lim[k] = [null, null]; S.lim[k][p] = v; };
  // [i1, i2] de uma regiao completa (e com pelo menos 3 amostras), ou null
  function regiao(k) {
    const z = S.lim[k];
    if (!z || z[0] === null || z[1] === null) return null;
    const a = idx(Math.min(...z)), b = idx(Math.max(...z));
    return b - a < 2 ? null : [a, b];
  }

  function calcular() {
    const N = S.N, inteiro = [0, N - 1];
    S.faixas = [];
    for (let j = 0; j < S.n; j++) {
      const f = S.lim["f" + j];
      if (!f || f[0] === null || f[1] === null) continue;
      const [r1, r2] = (S.zoom && regiao(chaveZoom(j))) || inteiro;
      const c1 = Math.max(idx(Math.min(...f)), r1), c2 = Math.min(idx(Math.max(...f)), r2);
      S.faixas.push({ c1, c2, num: j + 1, curta: S.t[c2] - S.t[c1] < S.durMin });
    }
    const prox = vagas().find((v) => valor(v) === null);
    S.prox = prox || null;
    S.pronto = !prox && S.faixas.some((f) => !f.curta);
    // vista: zoom unico fica na regiao; zoom por faixa so enquanto se marca a faixa dela
    // (depois volta ao sinal completo para delimitar a proxima regiao)
    let vista = null;
    if (S.zoom && !S.zoomPorFaixa) vista = regiao("z");
    else if (S.zoom && prox && prox[0][0] === "f") vista = regiao(chaveZoom(Number(prox[0].slice(1))));
    S.zoomFeito = !!vista;
    S.vistaFaixa = S.zoomPorFaixa && vista ? Number(prox[0].slice(1)) + 1 : null;
    [S.i1, S.i2] = vista || inteiro;
  }

  function mensagem() {
    const p = S.prox;
    let m;
    if (p && p[0][0] === "z" && S.zoomPorFaixa) m = `Região de interesse da faixa ${Number(p[0].slice(1)) + 1} de ${S.n}: clique no ${p[1] ? "FIM" : "INÍCIO"} da região (ou digite o tempo na tabela).`;
    else if (p && p[0] === "z") m = `Região de interesse: clique no ${p[1] ? "FIM" : "INÍCIO"} da região (ou digite o tempo na tabela).`;
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
    if (S.zoom && !S.zoomPorFaixa) linhas.push(["z", "Região"]);
    for (let j = 0; j < S.n; j++) {
      if (S.zoom && S.zoomPorFaixa) linhas.push(["z" + j, `Região f${j + 1}`]);
      linhas.push(["f" + j, `f${j + 1}`]);
    }
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
      if (k[0] === "z") {
        const r = regiao(k);
        dur.textContent = r ? virg(S.t[r[1]] - S.t[r[0]], 2) : "";
        est.textContent = r ? (k === "z" ? "delimita as faixas" : `delimita a faixa f${Number(k.slice(1)) + 1}`) : "";
      } else {
        const f = S.faixas.find((x) => x.num === Number(k.slice(1)) + 1);
        dur.textContent = f ? virg(S.t[f.c2] - S.t[f.c1], 2) : "";
        est.textContent = f ? (f.curta ? "curta: não analisada" : "válida") : "";
      }
    }
  }

  // soCursor: so o mouse mexeu. O grafico (milhoes de pontos) fica guardado em S.base e
  // so a linha do cursor e redesenhada; antes cada movimento percorria todas as amostras.
  function desenhar(soCursor = false) {
    const cv = el.canvas, dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    const ctx = cv.getContext("2d");
    const linha = (tt, cor, larg = 2, tr = []) => {
      const T = S.T, X = T.px(tt); if (X < T.X0 - 1 || X > T.X1 + 1) return;
      ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.setLineDash(tr);
      ctx.beginPath(); ctx.moveTo(X, T.Y0); ctx.lineTo(X, T.Y1); ctx.stroke(); ctx.restore();
    };
    const cursor = () => { if (S.hover !== null && S.prox) linha(S.hover, "rgba(0,0,0,0.35)", 1, [4, 4]); };
    if (soCursor && S.base && S.base.width === cv.width && S.base.height === cv.height) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(S.base, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); cursor();
      return;
    }
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { t, i1, i2 } = S;
    let mn = Infinity, mx = -Infinity;
    for (const s of S.series) for (let i = i1; i <= i2; i++) { const v = s.y[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    const d = (mx - mn) || Math.abs(mx) || 1;
    S.T = painel(ctx, { x: 0, y: 0, w, h }, {
      titulo: `${S.nome}${S.zoomFeito ? ` - região de interesse${S.vistaFaixa ? ` da faixa f${S.vistaFaixa}` : ""}` : ""}`, xlabel: "t [s]", ylabel: S.rotY,
      xlim: [t[i1], t[i2]], ylim: [mn - 0.05 * d, mx + 0.12 * d], legenda: S.series.length > 1 ? "ne" : undefined,
      series: S.series.map((s) => ({ x: t.subarray(i1, i2 + 1), y: s.y.subarray(i1, i2 + 1), cor: s.cor, largura: 1, rotulo: S.series.length > 1 ? s.rotulo : undefined })),
    });
    desenharFaixas(ctx, S.T, S.faixas, t);
    // regiao sendo delimitada (um limite ja marcado): linha cinza
    if (S.prox && S.prox[0][0] === "z" && S.lim[S.prox[0]]) for (const v of S.lim[S.prox[0]]) if (v !== null) linha(v, "rgb(130,130,130)");
    for (let j = 0; j < S.n; j++) {               // faixa com 1 limite so: linha pendente
      const f = S.lim["f" + j];
      if (f && (f[0] === null) !== (f[1] === null)) linha(f[0] ?? f[1], "rgb(20,20,20)", 2, [6, 3]);
    }
    if (!S.base) S.base = document.createElement("canvas");
    S.base.width = cv.width; S.base.height = cv.height; S.base.getContext("2d").drawImage(cv, 0, 0);
    cursor();
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
    desenhar(true);
  });
  el.canvas.addEventListener("pointerleave", () => { if (S) { S.hover = null; el.leitura.textContent = ""; desenhar(true); } });
  const desfazer = () => { if (S && S.hist.length) { definir(S.hist.pop(), null); atualizar(true); } };
  el.btDesfazer.addEventListener("click", desfazer);
  el.btReiniciar.addEventListener("click", () => { if (S) { S.lim = {}; S.hist = []; atualizar(true); } });
  document.addEventListener("keydown", (e) => {
    if (!S || el.canvas.closest("[hidden]")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); desfazer(); }
  });
  window.addEventListener("resize", () => { if (S) desenhar(); });

  return {
    // cfg: {t, fs, series:[{y, cor, rotulo}], nome, n, zoom, zoomPorFaixa, durMin, rotY, unidade}
    iniciar(cfg) {
      S = { ...cfg, N: cfg.t.length, lim: {}, hist: [], hover: null, T: null };
      atualizar(true);
    },
    get estado() { return S ? { pronto: S.pronto, faixas: S.faixas, i1: S.i1, i2: S.i2 } : null; },
    // limpa a tela: com a leitura no Worker a pagina segue ativa enquanto o proximo arquivo
    // carrega, e a tabela antiga nao pode aceitar tempos de um ensaio que ja acabou
    encerrar() {
      S = null;
      el.tabela.replaceChildren(); el.instrucao.textContent = ""; el.leitura.textContent = "";
      const cv = el.canvas; cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
      el.btDesfazer.disabled = true; el.aoMudar && el.aoMudar(false);
    },
    desenhar() { if (S) desenhar(); },
  };
}
