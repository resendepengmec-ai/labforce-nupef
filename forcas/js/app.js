// app.js - interface do modulo de forcas: etapas, selecao das faixas, analise e
// gravacao dos resultados na pasta do usuario (ou .zip). Mesmo padrao do modulo eletrico.
import { ROT, PADRAO, CANAIS, CAB_RESUMO, CAB_TEORICO, VERSAO, prepararEnsaio, analisarFaixa } from "./analise.js";
import { mapaValido, vcDeDn } from "./nucleo.js";
import { CORES, figuraSinal, figuraEspectro } from "./figuras.js";
import { sprintf } from "../../comum/js/formato.js";
import { figuraFaixas, paraPNG } from "../../comum/js/graficos.js";
import { temPastaDireta, criarDestino, nomeRodada, baixar } from "../../comum/js/saida.js";
import { criarSelecao } from "../../comum/js/selecao.js";
import {
  $, virg, numero, esperar, marcarEtapa, recolher, expandir, mostrar, progresso, ligarArquivos, ligarPasta, tabelaHTML,
} from "../../comum/js/ui.js";

const CHAVE = "forcas-config-v1";
const ROT_CAMPO = { tempo: "tempo [s]", fx: "Fx [N]", fy: "Fy [N]", fz: "Fz [N]", ignorar: "ignorar" };
const TEO = [["tAp", "ap"], ["tFn", "fn"], ["tVc", "vc"], ["tKr", "kr"], ["tG0", "g0"], ["tKc1", "kc1"], ["tMc", "mc"]];

let pasta = null, arquivos = [], cfg = null, rodada = null, ensaio = null;

function lerSalvo() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; } }
function salvar(c) { try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento */ } }
const txt = (v) => (v === null || v === undefined || Number.isNaN(v) ? "" : String(v).replace(".", ","));

function montarConfig() {
  const s = lerSalvo();
  const mapa = s.mapa || PADRAO.mapa;
  for (let i = 0; i < 4; i++) {
    const l = document.createElement("label"); l.textContent = `Coluna ${i + 1}`;
    const sel = document.createElement("select"); sel.id = "col" + i;
    for (const c of ["tempo", "fx", "fy", "fz", "ignorar"]) sel.add(new Option(ROT_CAMPO[c], c));
    sel.value = mapa[i]; l.appendChild(sel); $("colunas").appendChild(l);
  }
  const k = s.k || PADRAO.k;
  for (const c of ["fx", "fy", "fz"]) {
    const l = document.createElement("label"); l.textContent = c === "fx" ? "Fx" : c === "fy" ? "Fy" : "Fz";
    const inp = document.createElement("input"); inp.id = "k" + c; inp.inputMode = "decimal"; inp.autocomplete = "off";
    inp.value = Number.isInteger(k[c]) ? k[c].toFixed(1).replace(".", ",") : txt(k[c]); l.appendChild(inp); $("calCampos").appendChild(l);
  }
  $("btCal1").addEventListener("click", () => { for (const c of ["fx", "fy", "fz"]) { $("k" + c).value = "1,0"; $("k" + c).removeAttribute("aria-invalid"); } });
  for (let n = 1; n <= 8; n++) $("nFaixas").add(new Option(String(n), String(n)));
  $("nFaixas").value = String(s.nFaixas || 1);
  $("zoom").checked = !!s.zoom;
  if (s.op) { $("opFFT").checked = s.op.fft; $("opGraf").checked = s.op.graficos; $("opTeo").checked = s.op.teorico; }
  const t = { ...PADRAO.teorico, ...(s.teorico || {}) };
  for (const [id, c] of TEO) $(id).value = txt(t[c]);
  $("tCanal").value = t.canal;
  $("pDur").value = txt(s.duracaoMin ?? PADRAO.duracaoMin);
  const mostraTeo = () => { $("blocoTeo").hidden = !$("opTeo").checked; };
  $("opTeo").addEventListener("change", mostraTeo); mostraTeo();
  $("btVc").addEventListener("click", () => {
    const D = numero($("tD").value), n = numero($("tN").value);
    if (D > 0 && n > 0) { $("tVc").value = txt(Math.round(vcDeDn(D, n) * 100) / 100); $("tVc").removeAttribute("aria-invalid"); $("e-tVc").textContent = ""; }
    else $("e-tVc").textContent = "Digite D e n maiores que zero.";
  });
}

function marcar(id, msg) {
  const inp = $(id), e = $("e-" + id);
  if (msg) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
  if (e) e.textContent = msg || "";
  return msg ? [msg] : [];
}

function validarConfig() {
  const erros = [];
  const mapa = [0, 1, 2, 3].map((i) => $("col" + i).value);
  const okMapa = mapaValido(mapa);
  [0, 1, 2, 3].forEach((i) => { if (okMapa) $("col" + i).removeAttribute("aria-invalid"); else $("col" + i).setAttribute("aria-invalid", "true"); });
  $("e-colunas").textContent = okMapa ? "" : "Escolha tempo, Fx, Fy e Fz uma vez cada.";
  if (!okMapa) erros.push("colunas");
  const k = {};
  for (const c of ["fx", "fy", "fz"]) {
    const v = numero($("k" + c).value), ok = Number.isFinite(v) && v !== 0;
    if (ok) $("k" + c).removeAttribute("aria-invalid"); else { $("k" + c).setAttribute("aria-invalid", "true"); erros.push(c); }
    k[c] = v;
  }
  const dur = numero($("pDur").value);
  erros.push(...marcar("pDur", dur >= 0 ? "" : "Digite um valor de 0 s ou mais."));
  const teo = { canal: $("tCanal").value };
  const opTeo = $("opTeo").checked;
  for (const [id, c] of TEO) {
    const v = numero($(id).value); teo[c] = v;
    if (!opTeo) { marcar(id, ""); continue; }
    let msg = "";
    if (c === "g0") msg = Number.isFinite(v) && v > -90 && v < 90 ? "" : "Digite um ângulo entre −90° e 90°.";
    else if (c === "kr") msg = v > 0 && v <= 180 ? "" : "Digite um ângulo entre 0° e 180°.";
    else if (c === "mc") msg = v >= 0 && v < 1 ? "" : "Digite um valor entre 0 e 1 (típico 0,2 a 0,3).";
    else if (c === "kc1") msg = v > 0 ? "" : "Digite o kc1 do material (catálogo).";
    else msg = v > 0 ? "" : "Digite um valor maior que zero.";
    erros.push(...marcar(id, msg));
  }
  if (document.querySelector(".avancado [aria-invalid]")) document.querySelector(".avancado").open = true;
  $("erroConfig").textContent = erros.length ? `Corrija ${erros.length} campo(s) marcado(s) em vermelho.` : "";
  if (erros.length) { document.querySelector("#secConfig [aria-invalid]")?.focus(); return null; }
  const op = { fft: $("opFFT").checked, graficos: $("opGraf").checked, teorico: opTeo };
  salvar({ mapa, k, nFaixas: Number($("nFaixas").value), zoom: $("zoom").checked, op, teorico: teo, duracaoMin: dur });
  return { nFaixas: Number($("nFaixas").value), zoom: $("zoom").checked, op, p: { mapa, k, duracaoMin: dur, teorico: teo } };
}

function resumoConfig(c) {
  const k = c.p.k, cal = [k.fx, k.fy, k.fz].every((v) => v === 1) ? "sem calibração (1,0)" : `calibração ${[k.fx, k.fy, k.fz].map((v) => txt(v)).join(" / ")}`;
  const ops = [c.op.fft && "FFT", c.op.graficos && "gráficos", c.op.teorico && "força teórica"].filter(Boolean);
  return `${cal}; ${c.nFaixas} faixa(s)${c.zoom ? " com zoom" : ""}; ${ops.join(", ") || "só estatística"}`;
}

function atualizarIniciar() {
  const falta = [];
  if (!arquivos.length) falta.push("escolha os arquivos");
  if (temPastaDireta && !pasta) falta.push("escolha a pasta de resultados");
  $("btIniciar").disabled = falta.length > 0;
  $("faltaIniciar").textContent = falta.length ? `Para iniciar: ${falta.join(" e ")}.` : "";
}

// -------------------------------------------------------------- rodada -----
async function iniciarRodada() {
  $("btIniciar").disabled = true;
  const nome = nomeRodada();
  let destino;
  try { destino = await criarDestino(pasta, nome); }
  catch (e) { $("erroArq").textContent = "Não foi possível criar a pasta de resultados: " + e.message; atualizarIniciar(); return; }
  const c = cfg, log = [];
  log.push(sprintf("Forcas de usinagem (LabForce NUPEF) %s | %d arquivo(s) | resultados em %s", VERSAO, arquivos.length,
    destino.modo === "pasta" ? `${pasta.name}/${nome}` : `${nome}.zip`));
  log.push(`Colunas: ${c.p.mapa.join(" ")} | calibracao [Fx Fy Fz]: ${[c.p.k.fx, c.p.k.fy, c.p.k.fz].join(" ")}`);
  log.push(sprintf("Faixas por ensaio: %d (%s zoom) | faixa minima %g s | FFT: %s | graficos: %s | forca teorica: %s",
    c.nFaixas, c.zoom ? "com" : "sem", c.p.duracaoMin, c.op.fft ? "sim" : "nao", c.op.graficos ? "sim" : "nao", c.op.teorico ? "sim" : "nao"));
  if (c.op.teorico) {
    const q = c.p.teorico;
    log.push(sprintf("Teorico: ap %g mm | fn %g mm/rot | vc %g m/min | kr %g graus | g0 %g graus | kc1 %g N/mm2 | mc %g | canal %s",
      q.ap, q.fn, q.vc, q.kr, q.g0, q.kc1, q.mc, ROT[q.canal]));
  }
  rodada = { destino, log, i: 0, resumo: [], teo: [], nomes: [], salvoZip: false };
  $("resFaixas").replaceChildren(); $("btNova").hidden = true;
  $("destinoInfo").textContent = destino.modo === "pasta"
    ? `Gravando em ${pasta.name}/${nome}. Cada ensaio é gravado assim que termina.`
    : `Os arquivos vão para ${nome}.zip, baixado no fim. Não feche esta aba antes disso.`;
  mostrarLog();
  recolher($("secMontagem"), "conferida"); recolher($("secConfig"), resumoConfig(c));
  recolher($("secArquivos"), `${arquivos.length} arquivo(s) → ${destino.modo === "pasta" ? pasta.name : ".zip"}`);
  $("secResultados").hidden = false;
  await proximoEnsaio();
}

async function proximoEnsaio() {
  const R = rodada;
  if (R.i >= arquivos.length) return finalizarRodada();
  const f = arquivos[R.i], nome = f.name.replace(/\.[^.]*$/, "");
  marcarEtapa(4);
  mostrar($("secEnsaio"));
  $("tituloEnsaio").textContent = `4 Faixas · ensaio ${R.i + 1} de ${arquivos.length}: ${nome}`;
  $("infoEnsaio").textContent = ""; $("avisosEnsaio").replaceChildren();
  progresso($("progEnsaio"), "Lendo o arquivo…"); await esperar();
  let E;
  try {
    const n0 = R.log.length;
    E = prepararEnsaio(await f.text(), nome, cfg.p, R.log);
    for (const l of R.log.slice(n0)) if (/AVISO/.test(l)) { const p = document.createElement("p"); p.className = "aviso"; p.textContent = l.trim(); $("avisosEnsaio").appendChild(p); }
  } catch (e) {
    R.log.push(`ERRO ${nome}: ${e.message} Ensaio ignorado.`);
    const p = document.createElement("p"); p.className = "aviso"; p.textContent = `${nome}: ${e.message} O ensaio foi ignorado.`;
    $("resFaixas").appendChild(p);
    mostrarLog(); progresso($("progEnsaio"));
    R.i++; return proximoEnsaio();
  }
  progresso($("progEnsaio")); mostrarLog();
  $("infoEnsaio").textContent = `${E.N.toLocaleString("pt-BR")} amostras · fs = ${sprintf("%.6g", E.fs).replace(".", ",")} Hz (pela coluna de tempo) · ${virg(E.t[0], 2)} s a ${virg(E.t[E.N - 1], 2)} s`;
  ensaio = { E, nome };
  sel.iniciar({ t: E.t, fs: E.fs, nome, n: cfg.nFaixas, zoom: cfg.zoom, durMin: cfg.p.duracaoMin, rotY: "força [N]", unidade: "N",
    series: [{ y: E.F.fx, cor: CORES.fx, rotulo: "Fx" }, { y: E.F.fy, cor: CORES.fy, rotulo: "Fy" }, { y: E.F.fz, cor: CORES.fz, rotulo: "Fz" }] });
  $("cvSel").focus({ preventScroll: true });
}

async function analisarEnsaio() {
  const R = rodada, { E, nome } = ensaio, D = R.destino, c = cfg;
  const faixas = sel.estado.faixas, validas = faixas.filter((f) => !f.curta);
  $("btAnalisar").disabled = true;
  progresso($("progEnsaio"), "Analisando…"); await esperar();
  try {
    for (const f of faixas.filter((x) => x.curta)) {
      R.log.push("", sprintf("%s faixa %d IGNORADA: %.3f s (minimo %g s).", nome, f.num, E.t[f.c2] - E.t[f.c1], c.p.duracaoMin));
    }
    if (c.op.graficos) {
      const series = ["fx", "fy", "fz"].map((k) => ({ y: E.F[k], cor: CORES[k], rotulo: k === "fx" ? "Fx [N]" : k === "fy" ? "Fy [N]" : "Fz [N]" }));
      await D.gravar(`${nome}_faixas.png`, await paraPNG(figuraFaixas(E.t, series, faixas, `${nome} - faixas analisadas`, "força [N]", E.fs)));
    }
    for (const [k, f] of validas.entries()) {
      progresso($("progEnsaio"), `Analisando faixa ${k + 1} de ${validas.length}…`); await esperar();
      const rotulo = c.nFaixas > 1 ? `${nome}_f${f.num}` : nome;
      const r = analisarFaixa(E, f.c1, f.c2, rotulo, c.p, c.op, R.log);
      for (const [arq, linhas] of Object.entries(r.arquivos)) await D.gravar(arq, linhas);
      const figs = [];
      if (c.op.graficos) {
        figs.push([`${rotulo}_sinal.png`, figuraSinal(E, r)]);
        if (c.op.fft) figs.push([`${rotulo}_espectro.png`, figuraEspectro(E, r)]);
        for (const [arq, cv] of figs) await D.gravar(arq, await paraPNG(cv));
      } else if (c.op.fft) figs.push([null, figuraEspectro(E, r)]);
      R.resumo.push(...r.linhasResumo);
      if (r.linhaTeorico) R.teo.push(r.linhaTeorico);
      R.nomes.push(rotulo);
      mostrarFaixa(r, figs.map((x) => x[1]));
      await gravarResumos();
    }
  } catch (e) {
    R.log.push(`ERRO ${nome}: ${e.message}`);
    const p = document.createElement("p"); p.className = "aviso"; p.textContent = `${nome}: erro na análise (${e.message}). As faixas anteriores ficaram gravadas.`;
    $("resFaixas").appendChild(p);
    console.error(e);
  }
  await gravarResumos();
  progresso($("progEnsaio")); mostrarLog();
  sel.encerrar(); ensaio = null; R.i++;
  await proximoEnsaio();
}

async function gravarResumos() {
  const R = rodada, D = R.destino;
  if (R.resumo.length) await D.gravar("forcas_resumo.csv", [CAB_RESUMO, ...R.resumo]);
  if (R.teo.length) await D.gravar("corte_teorico.csv", [CAB_TEORICO, ...R.teo]);
  await D.gravar("relatorio.txt", R.log);
}

async function finalizarRodada() {
  const R = rodada;
  $("secEnsaio").hidden = true;
  R.log.push("", sprintf("Faixas analisadas: %d (em %d arquivo(s)). Resultados em:", R.nomes.length, arquivos.length),
    "  " + (R.destino.modo === "pasta" ? `${pasta.name}/${R.destino.nome}` : `${R.destino.nome}.zip`), ...R.nomes.map((n) => "  " + n));
  await gravarResumos(); mostrarLog();
  if (R.destino.modo === "zip") { baixar(await R.destino.zip(), R.destino.nome + ".zip"); R.salvoZip = true; }
  $("destinoInfo").textContent = R.destino.modo === "pasta"
    ? `Concluído: ${R.destino.arquivos.size} arquivo(s) gravado(s) em ${pasta.name}/${R.destino.nome}.`
    : `Concluído: ${R.destino.arquivos.size} arquivo(s) em ${R.destino.nome}.zip (baixado).`;
  $("btNova").hidden = false;
  marcarEtapa(6); mostrar($("secResultados"));
}

function mostrarLog() { $("log").textContent = rodada.log.join("\n"); $("log").scrollTop = $("log").scrollHeight; }

function mostrarFaixa(r, figs) {
  const d = document.createElement("div"); d.className = "faixa";
  const h = document.createElement("h3");
  h.textContent = `${r.rotulo}: ${virg(r.t0, 3)} s a ${virg(r.t1, 3)} s (${virg(r.tu, 3)} s, ${r.n.toLocaleString("pt-BR")} amostras)`;
  d.appendChild(h);
  if (r.teorico) {
    const q = r.teorico, box = document.createElement("div"); box.className = "comparacao";
    for (const [rot, val] of [["Fc teórica [N]", virg(q.Fc, 1)], [`Fc medida, média |${ROT[q.canal]}| [N]`, virg(Math.abs(q.medida), 1)],
      ["Diferença [%]", (q.dif >= 0 ? "+" : "") + virg(q.dif, 1)], ["kc [N/mm²]", virg(q.kc, 0)], ["Pc [kW]", virg(q.Pc, 3)], ["Q [cm³/min]", virg(q.Q, 1)]]) {
      const c = document.createElement("div"), s = document.createElement("span"), b = document.createElement("strong");
      s.textContent = rot; b.textContent = val; c.append(s, b); box.appendChild(c);
    }
    d.appendChild(box);
  }
  const tw = document.createElement("div"); tw.className = "tabela-rolar";
  const tab = document.createElement("table"); tab.className = "tabela";
  tabelaHTML(tab, ["Canal", "Média [N]", "RMS [N]", "Pico [N]", "DP [N]", "CV [-]", "Fator de crista [-]", "Curtose [-]", "Assimetria [-]", "Freq. dominante [Hz]"],
    CANAIS.map(({ k, rot }) => { const s = r.est[k]; return [rot, virg(s.media, 2), virg(s.rms, 2), virg(s.pico, 2), virg(s.dp, 2), virg(s.cv, 3), virg(s.crista, 3), virg(s.curtose, 3), virg(s.assimetria, 3), virg(s.fdom, 2)]; }));
  tw.appendChild(tab); d.appendChild(tw);
  const fg = document.createElement("div"); fg.className = "figuras";
  for (const cv of figs) { cv.setAttribute("role", "img"); cv.setAttribute("aria-label", `Gráfico da faixa ${r.rotulo}`); fg.appendChild(cv); }
  d.appendChild(fg);
  $("resFaixas").appendChild(d);
}

const sel = criarSelecao({
  canvas: $("cvSel"), leitura: $("leitura"), instrucao: $("instrucao"), tabela: $("tabFaixas"),
  btDesfazer: $("btDesfazer"), btReiniciar: $("btReiniciar"), aoMudar: (pronto) => { $("btAnalisar").disabled = !pronto; },
});

function iniciar() {
  $("versao").textContent = `Versão ${VERSAO}.`;
  if (!temPastaDireta) {
    $("avisoNavegador").textContent = "Este navegador não grava direto em pasta: os resultados serão baixados em .zip. Chrome ou Edge no computador gravam direto na pasta escolhida.";
    $("avisoNavegador").hidden = false;
  }
  marcarEtapa(1);
  montarConfig();
  ligarArquivos($("soltar"), $("arquivos"), $("listaArq"), (a) => { arquivos = a; atualizarIniciar(); });
  ligarPasta({ chave: "pasta-forcas", blocoDireto: $("pastaDireta"), blocoZip: $("pastaZip"), btEscolher: $("btPasta"),
    btLembrada: $("btPastaLembrada"), rotulo: $("pastaAtual"), erro: $("erroArq"), aoDefinir: (h) => { pasta = h; atualizarIniciar(); } });
  atualizarIniciar();
  $("btMontagem").addEventListener("click", () => {
    recolher($("secMontagem"), "conferida", () => marcarEtapa(1));
    marcarEtapa(2); mostrar($("secConfig"));
  });
  $("btConfig").addEventListener("click", () => {
    const c = validarConfig(); if (!c) return;
    cfg = c; recolher($("secConfig"), resumoConfig(c), () => marcarEtapa(2));
    marcarEtapa(3); mostrar($("secArquivos"));
  });
  $("btIniciar").addEventListener("click", () => {
    if (!$("secConfig").classList.contains("concluido")) { $("erroArq").textContent = "Confirme a configuração (etapa 2) antes de iniciar."; return; }
    iniciarRodada();
  });
  $("btAnalisar").addEventListener("click", analisarEnsaio);
  $("btPular").addEventListener("click", () => {
    if (!ensaio) return;
    rodada.log.push("", `${ensaio.nome}: ensaio pulado pelo usuario.`); mostrarLog();
    sel.encerrar(); ensaio = null; rodada.i++; proximoEnsaio();
  });
  $("btZip").addEventListener("click", async () => { if (rodada) { baixar(await rodada.destino.zip(), rodada.destino.nome + ".zip"); rodada.salvoZip = true; } });
  $("btNova").addEventListener("click", () => {
    rodada = null; arquivos = []; $("listaArq").replaceChildren(); $("arquivos").value = "";
    $("secResultados").hidden = true;
    expandir($("secArquivos")); expandir($("secConfig"));
    recolher($("secConfig"), resumoConfig(cfg), () => marcarEtapa(2));
    marcarEtapa(3); atualizarIniciar(); mostrar($("secArquivos"));
  });
  window.addEventListener("beforeunload", (e) => {
    if (rodada && rodada.destino.modo === "zip" && !rodada.salvoZip && rodada.destino.arquivos.size) { e.preventDefault(); e.returnValue = ""; }
  });
}

iniciar();
