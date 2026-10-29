// app.js - interface: etapas de configuracao, selecao das faixas no grafico,
// analise e gravacao dos resultados na pasta do usuario (ou .zip).
import { PADRAO, CALIBRACOES, CAB_DADOS, VERSAO, prepararEnsaio, analisarFaixa } from "./analise.js";
import { tempo2indice } from "./nucleo.js";
import { sprintf } from "./formato.js";
import { cabecalhoResumoIEEE519 } from "./ieee519.js";
import { cabecalhoIEEE1459 } from "./ieee1459.js";
import {
  painel, desenharFaixas, figuraEspectro, figuraIEEE519, figuraIEEE1459, figuraFaixas, paraPNG,
} from "./graficos.js";
import {
  temPastaDireta, pastaLembrada, garantirPermissao, escolherPasta, criarDestino, nomeRodada, baixar,
} from "./saida.js";

const $ = (id) => document.getElementById(id);
const CANAIS = ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"];
const CHAVE = "pe-config-v1";
const sn = (b) => (b ? "sim" : "nao");
const virg = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "-");
const esperar = () => new Promise((ok) => setTimeout(ok, 30));

// ---------------------------------------------------------------- estado --
let pasta = null;          // FileSystemDirectoryHandle
let arquivos = [];         // File[]
let cfg = null;            // configuracao validada
let rodada = null;         // dados da rodada em andamento
let sel = null;            // selecao das faixas do ensaio atual

// ------------------------------------------------------- configuracao -----
function lerSalvo() {
  try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; }
}
function salvar(c) {
  try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento: segue */ }
}

function montarConfig() {
  const s = lerSalvo();
  const cal = $("calCampos");
  CANAIS.forEach((c, i) => {
    const l = document.createElement("label");
    l.textContent = c;
    const inp = document.createElement("input");
    inp.id = "k" + c; inp.inputMode = "decimal"; inp.autocomplete = "off";
    inp.addEventListener("input", () => { $("calPreset").value = "pers"; });
    l.appendChild(inp); cal.appendChild(l);
  });
  for (let n = 1; n <= 8; n++) $("nFaixas").add(new Option(String(n), String(n)));
  aplicarPreset(s.preset || "amarela", s.k);
  $("calPreset").addEventListener("change", (e) => aplicarPreset(e.target.value));
  $("nFaixas").value = String(s.nFaixas || 1);
  $("zoom").checked = !!s.zoom;
  if (s.op) { $("opFFT").checked = s.op.fft; $("op519").checked = s.op.ieee519; $("op1459").checked = s.op.ieee1459; $("opGraf").checked = s.op.graficos; }
  preencherAvancado(s.av || {});
  $("btPadrao").addEventListener("click", () => preencherAvancado({}));
}

function aplicarPreset(nome, kSalvo) {
  $("calPreset").value = nome;
  let k;
  if (nome === "pers") k = kSalvo || [...PADRAO.kV, ...PADRAO.kI];
  else k = [...CALIBRACOES[nome].kV, ...CALIBRACOES[nome].kI];
  CANAIS.forEach((c, i) => { $("k" + c).value = String(k[i]).replace(".", ","); $("k" + c).classList.remove("invalido"); });
}

function preencherAvancado(a) {
  $("pRede").value = a.fRede ?? PADRAO.fRede;
  $("pCic").value = a.nCicVis ?? PADRAO.nCicVis;
  $("pDur").value = String(a.duracaoMin ?? PADRAO.duracaoMin).replace(".", ",");
  $("pIsc").value = String(a.IscIL ?? PADRAO.IscIL).replace(".", ",");
  $("pIL").value = a.IL519 === undefined || a.IL519 === null ? "" : String(a.IL519).replace(".", ",");
  $("pAtraso").value = (a.atrasoUs || [0, 0, 0, 0, 0, 0]).join(" ");
}

const num = (s) => { const t = String(s).trim().replace(",", "."); return t === "" ? NaN : Number(t); };

function validarConfig() {
  const erros = [];
  const k = CANAIS.map((c) => {
    const inp = $("k" + c), v = num(inp.value);
    const ok = Number.isFinite(v) && v > 0;
    inp.classList.toggle("invalido", !ok);
    if (!ok) erros.push(`${c}: digite um número maior que zero (ex.: 1,2483).`);
    return v;
  });
  const fRede = num($("pRede").value), nCic = num($("pCic").value), dur = num($("pDur").value);
  const isc = num($("pIsc").value), ilTxt = $("pIL").value.trim(), il = ilTxt === "" ? NaN : num(ilTxt);
  const at = $("pAtraso").value.trim().split(/[\s;]+/).filter(Boolean).map(num);
  if (!(fRede > 0)) erros.push("Frequência da rede: valor maior que zero.");
  if (!(Number.isInteger(nCic) && nCic >= 1)) erros.push("Média móvel: número inteiro de ciclos (≥ 1).");
  if (!(dur >= 0)) erros.push("Faixa mínima: valor ≥ 0 s.");
  if (!(isc > 0)) erros.push("Isc/IL: valor maior que zero.");
  if (ilTxt !== "" && !(il > 0)) erros.push("IL: vazio (automático) ou valor maior que zero.");
  if (at.length !== 6 || at.some((v) => !Number.isFinite(v))) erros.push("Atraso: 6 valores em µs (Va Vb Vc Ia Ib Ic).");
  $("erroConfig").textContent = erros.join(" ");
  if (erros.length) return null;
  const op = { fft: $("opFFT").checked, ieee519: $("op519").checked, ieee1459: $("op1459").checked, graficos: $("opGraf").checked };
  const av = { fRede, nCicVis: nCic, duracaoMin: dur, IscIL: isc, IL519: ilTxt === "" ? null : il, atrasoUs: at };
  salvar({ preset: $("calPreset").value, k, nFaixas: Number($("nFaixas").value), zoom: $("zoom").checked, op, av });
  return {
    k, nFaixas: Number($("nFaixas").value), zoom: $("zoom").checked, op,
    p: { ...PADRAO, kV: k.slice(0, 3), kI: k.slice(3), fRede, nCicVis: nCic, duracaoMin: dur, IscIL: isc,
      IL519: Number.isNaN(il) ? NaN : il, atrasoCanal: at.map((u) => u * 1e-6) },
    atrasoUs: at,
  };
}

// ------------------------------------------------------ pasta e arquivos --
async function prepararPasta() {
  if (!temPastaDireta) { $("pastaDireta").hidden = true; $("pastaZip").hidden = false; return; }
  const h = await pastaLembrada();
  if (h) {
    const b = $("btPastaLembrada");
    b.textContent = `Usar a pasta “${h.name}”`; b.hidden = false;
    b.onclick = async () => {
      try { if (await garantirPermissao(h)) definirPasta(h); else $("erroArq").textContent = "Permissão de escrita negada para essa pasta."; }
      catch (e) { $("erroArq").textContent = "Não foi possível acessar a pasta: " + e.message; }
    };
  }
  $("btPasta").addEventListener("click", async () => {
    try { definirPasta(await escolherPasta()); }
    catch (e) { if (e.name !== "AbortError") $("erroArq").textContent = "Não foi possível usar a pasta: " + e.message; }
  });
}
function definirPasta(h) {
  pasta = h; $("pastaAtual").textContent = `Resultados em: ${h.name}/resultados_…`;
  $("btPastaLembrada").hidden = true; $("erroArq").textContent = ""; atualizarIniciar();
}

function definirArquivos(lista) {
  arquivos = [...lista].filter((f) => f.size > 0).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  const ul = $("listaArq"); ul.replaceChildren();
  for (const f of arquivos) {
    const li = document.createElement("li");
    const a = document.createElement("span"); a.textContent = f.name;
    const b = document.createElement("span"); b.textContent = `${(f.size / 1024).toFixed(0)} kB`;
    li.append(a, b); ul.appendChild(li);
  }
  atualizarIniciar();
}
function atualizarIniciar() { $("btIniciar").disabled = !(arquivos.length && (pasta || !temPastaDireta)); }

function prepararArquivos() {
  $("arquivos").addEventListener("change", (e) => definirArquivos(e.target.files));
  const z = $("soltar");
  z.addEventListener("dragover", (e) => { e.preventDefault(); z.classList.add("sobre"); });
  z.addEventListener("dragleave", () => z.classList.remove("sobre"));
  z.addEventListener("drop", (e) => { e.preventDefault(); z.classList.remove("sobre"); definirArquivos(e.dataTransfer.files); });
}

// -------------------------------------------------------------- rodada -----
async function iniciarRodada() {
  $("btIniciar").disabled = true;
  const nome = nomeRodada();
  let destino;
  try { destino = await criarDestino(pasta, nome); }
  catch (e) { $("erroArq").textContent = "Não foi possível criar a pasta de resultados: " + e.message; atualizarIniciar(); return; }
  const log = [];
  const c = cfg;
  log.push(sprintf("Potencias_Eletricas %s | %d arquivo(s) | resultados em %s", VERSAO, arquivos.length,
    destino.modo === "pasta" ? `${pasta.name}/${nome}` : `${nome}.zip`));
  log.push("Calibracao [Va Vb Vc Ia Ib Ic]: " + c.k.map(String).join(" "));
  log.push(sprintf("Faixas por ensaio: %d (%s zoom) | FFT: %s | IEEE 519: %s | IEEE 1459: %s | graficos: %s",
    c.nFaixas, c.zoom ? "com" : "sem", sn(c.op.fft), sn(c.op.ieee519), sn(c.op.ieee1459), sn(c.op.graficos)));
  log.push(sprintf("Parametros: rede %g Hz | media movel %d ciclos | faixa minima %g s | Isc/IL %g | IL %s | atraso [us] %s",
    c.p.fRede, c.p.nCicVis, c.p.duracaoMin, c.p.IscIL, Number.isNaN(c.p.IL519) ? "auto" : String(c.p.IL519), c.atrasoUs.join(" ")));
  rodada = { destino, log, i: 0, matPot: [], matQ: [], mat59: [], nomes: [], linhasTab: [], salvoZip: false };
  $("secResultados").hidden = false; $("resFaixas").replaceChildren(); $("tabResumo").replaceChildren();
  $("btNova").hidden = true;
  $("destinoInfo").textContent = destino.modo === "pasta"
    ? `Gravando em ${pasta.name}/${nome} (cada ensaio é gravado assim que termina).`
    : `Os arquivos vão para ${nome}.zip, baixado ao final. Não feche esta aba antes disso.`;
  mostrarLog();
  for (const s of ["secLigacao", "secConfig", "secArquivos"]) $(s).hidden = true;
  await proximoEnsaio();
}

async function proximoEnsaio() {
  const R = rodada;
  if (R.i >= arquivos.length) return finalizarRodada();
  const f = arquivos[R.i];
  const nome = f.name.replace(/\.[^.]*$/, "");
  $("secEnsaio").hidden = false;
  $("tituloEnsaio").textContent = `Ensaio ${R.i + 1} de ${arquivos.length}: ${nome}`;
  $("infoEnsaio").textContent = "Lendo o arquivo e detectando a taxa de amostragem…";
  $("avisosEnsaio").replaceChildren();
  document.body.classList.add("ocupado"); await esperar();
  let E;
  try {
    const n0 = R.log.length;
    E = prepararEnsaio(await f.text(), nome, cfg.p, R.log);
    const novas = R.log.slice(n0);
    novas.forEach((l, i) => {
      if (!/AVISO|Aviso/.test(l)) return;
      let txt = l.trim();
      for (let j = i + 1; j < novas.length && /^\s+\S/.test(novas[j]); j++) txt += " " + novas[j].trim();
      avisoEnsaio(txt);
    });
    if (1.1 * cfg.p.fRede >= E.fs / 2) throw new Error(`fs = ${E.fs.toFixed(1)} Hz é insuficiente para a rede de ${cfg.p.fRede} Hz.`);
  } catch (e) {
    R.log.push(`ERRO ${nome}: ${e.message} Ensaio ignorado.`);
    mostrarLog(); document.body.classList.remove("ocupado");
    R.i++; return proximoEnsaio();
  }
  document.body.classList.remove("ocupado");
  mostrarLog();
  const t = Float64Array.from({ length: E.N }, (_, i) => i / E.fs);
  $("infoEnsaio").textContent = `${E.N.toLocaleString("pt-BR")} amostras · fs = ${sprintf("%.6g", E.fs).replace(".", ",")} Hz` +
    (E.regra ? ` (${E.regra})` : " (estimada, sem valor redondo)") + ` · duração ${virg(t[E.N - 1], 1)} s`;
  iniciarSelecao(E, t, nome);
}

function avisoEnsaio(txt) {
  const p = document.createElement("p"); p.className = "aviso"; p.textContent = txt; $("avisosEnsaio").appendChild(p);
}

// -------------------------------------------------- selecao das faixas -----
const rotY = () => `P (média móvel ${cfg.p.nCicVis} ciclos) [W]`;

function iniciarSelecao(E, t, nome) {
  sel = { E, t, nome, cliques: [], T: null, hover: null };
  recalcularSelecao(); desenharSelecao();
  $("secEnsaio").scrollIntoView({ block: "start" });
  $("cvSel").focus({ preventScroll: true });
}

// Reproduz a sequencia de cliques: zoom (2), depois 2 por faixa
function recalcularSelecao() {
  const { E, cliques } = sel, N = E.N, fs = E.fs;
  let i1 = 0, i2 = N - 1, k = 0;
  sel.zoomFeito = !cfg.zoom;
  if (cfg.zoom && cliques.length >= 2) {
    const a = Math.min(cliques[0], cliques[1]), b = Math.max(cliques[0], cliques[1]);
    i1 = tempo2indice(a, fs, N); i2 = tempo2indice(b, fs, N); k = 2; sel.zoomFeito = true;
  }
  sel.i1 = i1; sel.i2 = i2;
  sel.faixas = [];
  for (; k + 1 < cliques.length && sel.faixas.length < cfg.nFaixas; k += 2) {
    const a = Math.min(cliques[k], cliques[k + 1]), b = Math.max(cliques[k], cliques[k + 1]);
    const c1 = Math.max(tempo2indice(a, fs, N), i1), c2 = Math.min(tempo2indice(b, fs, N), i2);
    const num = sel.faixas.length + 1;
    sel.faixas.push({ c1, c2, num, curta: (c2 - c1) / fs < cfg.p.duracaoMin });
  }
  sel.pendente = cliques.length > k ? cliques[k] : null;
  const fim = sel.faixas.length === cfg.nFaixas;
  sel.fim = fim;
  const validas = sel.faixas.filter((f) => !f.curta).length;
  let msg;
  if (!sel.zoomFeito) msg = sel.pendente === null ? "Zoom: clique no INÍCIO da região de interesse." : "Zoom: clique no FIM da região de interesse.";
  else if (!fim) {
    const j = sel.faixas.length + 1;
    msg = `Faixa ${j} de ${cfg.nFaixas}: clique no ${sel.pendente === null ? "INÍCIO" : "FIM"} da faixa.`;
  } else msg = validas ? `Faixas prontas (${validas} válida${validas > 1 ? "s" : ""}). Confira e clique em “Analisar faixas”.`
    : "Todas as faixas ficaram menores que a faixa mínima. Desfaça e selecione de novo.";
  const curtas = sel.faixas.filter((f) => f.curta).map((f) => `f${f.num}`);
  if (curtas.length) msg += ` Faixa(s) ${curtas.join(", ")} menor(es) que ${virg(cfg.p.duracaoMin, 1)} s: será(ão) ignorada(s).`;
  $("instrucao").textContent = msg;
  $("btAnalisar").disabled = !(fim && validas);
  $("btDesfazer").disabled = cliques.length === 0;
}

function desenharSelecao() {
  const cv = $("cvSel"), dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { E, t, i1, i2 } = sel, P = E.Pinst;
  let mn = Infinity, mx = -Infinity;
  for (let i = i1; i <= i2; i++) { if (P[i] < mn) mn = P[i]; if (P[i] > mx) mx = P[i]; }
  const d = (mx - mn) || Math.abs(mx) || 1;
  sel.T = painel(ctx, { x: 0, y: 0, w, h }, {
    titulo: `${sel.nome}${sel.zoomFeito && cfg.zoom ? " - região de interesse" : ""}`, xlabel: "t [s]", ylabel: rotY(),
    xlim: [t[i1], t[i2]], ylim: [mn - 0.05 * d, mx + 0.12 * d],
    series: [{ x: t.subarray(i1, i2 + 1), y: P.subarray(i1, i2 + 1), cor: "rgb(0,0,205)", largura: 1 }],
  });
  const T = sel.T;
  desenharFaixas(ctx, T, sel.faixas, E.fs);
  const linha = (tt, cor, larg = 2, tr = []) => {
    const X = T.px(tt); if (X < T.X0 - 1 || X > T.X1 + 1) return;
    ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.setLineDash(tr);
    ctx.beginPath(); ctx.moveTo(X, T.Y0); ctx.lineTo(X, T.Y1); ctx.stroke(); ctx.restore();
  };
  if (sel.pendente !== null) linha(sel.pendente, sel.zoomFeito ? "rgb(220,0,0)" : "rgb(150,150,150)");
  if (sel.hover !== null && !sel.fim) linha(sel.hover, "rgba(0,0,0,0.35)", 1, [4, 4]);
}

function tempoDoEvento(e) {
  const T = sel.T; if (!T) return null;
  const r = $("cvSel").getBoundingClientRect(), X = e.clientX - r.left;
  if (X < T.X0 - 8 || X > T.X1 + 8) return null;
  return Math.min(Math.max(T.inv(X), sel.t[sel.i1]), sel.t[sel.i2]);
}

function prepararSelecao() {
  const cv = $("cvSel");
  cv.addEventListener("pointerdown", (e) => {
    if (!sel || sel.fim || e.button !== 0) return;
    const tt = tempoDoEvento(e); if (tt === null) return;
    sel.cliques.push(tt); recalcularSelecao(); desenharSelecao();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!sel) return;
    const tt = tempoDoEvento(e); sel.hover = tt;
    if (tt === null) { $("leitura").textContent = ""; }
    else {
      const i = tempo2indice(tt, sel.E.fs, sel.E.N);
      $("leitura").textContent = `t = ${virg(tt, 2)} s · P = ${virg(sel.E.Pinst[i], 1)} W`;
    }
    desenharSelecao();
  });
  cv.addEventListener("pointerleave", () => { if (sel) { sel.hover = null; $("leitura").textContent = ""; desenharSelecao(); } });
  const desfazer = () => { if (sel && sel.cliques.length) { sel.cliques.pop(); recalcularSelecao(); desenharSelecao(); } };
  $("btDesfazer").addEventListener("click", desfazer);
  document.addEventListener("keydown", (e) => {
    if (!sel || $("secEnsaio").hidden) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); desfazer(); }
  });
  $("btReiniciar").addEventListener("click", () => { if (sel) { sel.cliques = []; recalcularSelecao(); desenharSelecao(); } });
  $("btPular").addEventListener("click", () => {
    if (!sel) return;
    rodada.log.push("", `${sel.nome}: ensaio pulado pelo usuario.`); mostrarLog();
    sel = null; rodada.i++; proximoEnsaio();
  });
  $("btAnalisar").addEventListener("click", analisarEnsaio);
  window.addEventListener("resize", () => { if (sel && !$("secEnsaio").hidden) desenharSelecao(); });
}

// ------------------------------------------------------------ analise -----
async function analisarEnsaio() {
  const R = rodada, S = sel, E = S.E, D = R.destino, c = cfg;
  $("btAnalisar").disabled = true;
  $("instrucao").textContent = "Analisando…";
  document.body.classList.add("ocupado"); await esperar();
  try {
    for (const f of S.faixas.filter((x) => x.curta)) {
      R.log.push("", sprintf("%s faixa %d IGNORADA: %.2f s (minimo %g s).", S.nome, f.num, (f.c2 - f.c1) / E.fs, c.p.duracaoMin));
    }
    const validas = S.faixas.filter((f) => !f.curta);
    if (c.op.graficos) await D.gravar(`${S.nome}_faixas.png`, await paraPNG(figuraFaixas(E, S.t, S.faixas, S.nome, rotY())));
    for (const f of validas) {
      const rotulo = c.nFaixas > 1 ? `${S.nome}_f${f.num}` : S.nome;
      const r = analisarFaixa(E, f.c1, f.c2, rotulo, c.p, c.op, R.log);
      const figs = [];
      for (const [arq, linhas] of Object.entries(r.arquivos)) await D.gravar(arq, linhas);
      if (c.op.graficos) {
        if (c.op.fft) figs.push([`${rotulo}_espectro.png`, figuraEspectro(r, E.fs)]);
        if (r.q) figs.push([`${rotulo}_IEEE519.png`, figuraIEEE519(r.q, S.t[f.c1])]);
        if (r.r59) figs.push([`${rotulo}_IEEE1459.png`, figuraIEEE1459(r.r59, S.t[f.c1])]);
        for (const [arq, cv] of figs) await D.gravar(arq, await paraPNG(cv));
      }
      R.matPot.push(r.linhaDados);
      if (r.linha519) R.matQ.push(r.linha519);
      if (r.linha1459) R.mat59.push(r.linha1459);
      R.nomes.push(rotulo);
      R.linhasTab.push({ r, fs: E.fs });
      mostrarFaixa(r, E, figs.map((x) => x[1]));
      await gravarResumos();
    }
  } catch (e) {
    R.log.push(`ERRO ${S.nome}: ${e.message}`);
    console.error(e);
  }
  await gravarResumos();
  document.body.classList.remove("ocupado");
  mostrarLog(); atualizarTabela();
  sel = null; R.i++;
  await proximoEnsaio();
}

async function gravarResumos() {
  const R = rodada, D = R.destino;
  if (R.matPot.length) await D.gravar("dados_obtidos.csv", [CAB_DADOS, ...R.matPot]);
  if (R.matQ.length) await D.gravar("ieee519_resumo.csv", [cabecalhoResumoIEEE519(), ...R.matQ]);
  if (R.mat59.length) await D.gravar("ieee1459_resumo.csv", [cabecalhoIEEE1459(), ...R.mat59]);
  await D.gravar("relatorio.txt", R.log);
}

async function finalizarRodada() {
  const R = rodada;
  $("secEnsaio").hidden = true;
  R.log.push("", sprintf("Faixas analisadas: %d (em %d arquivo(s)). Resultados em:", R.nomes.length, arquivos.length),
    "  " + (R.destino.modo === "pasta" ? `${pasta.name}/${R.destino.nome}` : `${R.destino.nome}.zip`), ...R.nomes.map((n) => "  " + n));
  await gravarResumos();
  mostrarLog(); atualizarTabela();
  if (R.destino.modo === "zip") { baixar(await R.destino.zip(), R.destino.nome + ".zip"); R.salvoZip = true; }
  $("destinoInfo").textContent = R.destino.modo === "pasta"
    ? `Concluído. ${R.destino.arquivos.size} arquivo(s) gravado(s) em ${pasta.name}/${R.destino.nome}.`
    : `Concluído. ${R.destino.arquivos.size} arquivo(s) em ${R.destino.nome}.zip (baixado).`;
  $("btNova").hidden = false;
  $("secResultados").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------- resultados -----
function mostrarLog() { $("log").textContent = rodada.log.join("\n"); $("log").scrollTop = $("log").scrollHeight; }

function chip(st) {
  const s = document.createElement("span"); s.className = "st st-" + st; s.textContent = st; return s;
}

function atualizarTabela() {
  const tab = $("tabResumo"); tab.replaceChildren();
  if (!rodada.linhasTab.length) return;
  const cab = ["Ensaio", "Pt [W]", "U [V]", "Ief [A]", "t [s]", "St [VA]", "FP [-]", "f1 [Hz]", "fs [Hz]"];
  if (cfg.op.ieee519) cab.push("519 tensão", "519 corrente");
  if (cfg.op.ieee1459) cab.push("Se [VA]", "PF 1459 [-]", "In [A]");
  const tr = tab.createTHead().insertRow();
  for (const c of cab) { const th = document.createElement("th"); th.textContent = c; tr.appendChild(th); }
  const tb = tab.createTBody();
  for (const { r, fs } of rodada.linhasTab) {
    const g = r.g, row = tb.insertRow();
    const cel = [r.rotulo, virg(g.Pt, 1), virg(g.Vrms[0], 1), virg(g.Ief, 3), virg(r.tu, 2), virg(g.St, 1), virg(g.FP, 3),
      virg(r.f1, 3), sprintf("%.6g", fs).replace(".", ",")];
    for (const v of cel) row.insertCell().textContent = v;
    if (cfg.op.ieee519) {
      if (r.q) { row.insertCell().appendChild(chip(r.q.statusV)); row.insertCell().appendChild(chip(r.q.statusI)); }
      else { row.insertCell().textContent = "-"; row.insertCell().textContent = "-"; }
    }
    if (cfg.op.ieee1459) {
      const t = r.r59 && r.r59.tot;
      row.insertCell().textContent = t ? virg(t.Se, 1) : "-";
      row.insertCell().textContent = t ? virg(t.PF, 3) : "-";
      row.insertCell().textContent = t ? virg(t.In, 3) : "-";
    }
  }
}

function mostrarFaixa(r, E, figs) {
  const d = document.createElement("div"); d.className = "faixa";
  const h = document.createElement("h3");
  h.textContent = `${r.rotulo} · ${virg(r.tu, 2)} s · Pt = ${virg(r.g.Pt, 1)} W · FP = ${virg(r.g.FP, 3)}`;
  d.appendChild(h);
  if (cfg.op.fft) {
    const p = document.createElement("p"); p.className = "info";
    p.textContent = `f1 = ${virg(r.f1, 3)} Hz · Vb−Va = ${virg(r.defVbVa, 1)}° · Vc−Va = ${virg(r.defVcVa, 1)}° · V−I = ` +
      r.defVI.map((x) => virg(x, 1) + "°").join(" / ");
    d.appendChild(p);
  }
  const fg = document.createElement("div"); fg.className = "figuras";
  for (const cv of figs) fg.appendChild(cv);
  d.appendChild(fg);
  $("resFaixas").appendChild(d);
}

// -------------------------------------------------------------- inicio -----
function iniciar() {
  $("versao").textContent = `Versão ${VERSAO}.`;
  if (!temPastaDireta) {
    const a = $("avisoNavegador");
    a.textContent = "Navegador sem gravação direta em pasta: os resultados serão baixados em .zip. Chrome ou Edge no computador gravam direto na pasta escolhida.";
    a.hidden = false;
  }
  montarConfig(); prepararArquivos(); prepararSelecao(); prepararPasta();
  $("btLigacao").addEventListener("click", () => {
    $("btLigacao").disabled = true; $("btLigacao").textContent = "Ligação confirmada";
    $("secConfig").hidden = false; $("secConfig").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("btConfig").addEventListener("click", () => {
    const c = validarConfig(); if (!c) return;
    cfg = c; $("secArquivos").hidden = false; $("secArquivos").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("btIniciar").addEventListener("click", () => {
    const c = validarConfig();
    if (!c) { $("erroArq").textContent = "Corrija a configuração (etapa 2)."; return; }
    cfg = c; iniciarRodada();
  });
  $("btZip").addEventListener("click", async () => {
    if (!rodada) return;
    baixar(await rodada.destino.zip(), rodada.destino.nome + ".zip"); rodada.salvoZip = true;
  });
  $("btNova").addEventListener("click", () => {
    rodada = null; arquivos = []; $("listaArq").replaceChildren(); $("arquivos").value = "";
    $("secResultados").hidden = true; $("secArquivos").hidden = false; $("secConfig").hidden = false; $("secLigacao").hidden = false;
    atualizarIniciar(); window.scrollTo({ top: 0, behavior: "smooth" });
  });
  window.addEventListener("beforeunload", (e) => {
    if (rodada && rodada.destino.modo === "zip" && !rodada.salvoZip && rodada.destino.arquivos.size) { e.preventDefault(); e.returnValue = ""; }
  });
}

iniciar();
