// app.js - interface do modulo eletrico: etapas, selecao das faixas, analise e
// gravacao dos resultados na pasta do usuario (ou .zip).
import { PADRAO, CALIBRACOES, CAB_DADOS, VERSAO, prepararEnsaio, analisarFaixa } from "./analise.js";
import { sprintf } from "../../comum/js/formato.js";
import { cabecalhoResumoIEEE519 } from "./ieee519.js";
import { cabecalhoIEEE1459 } from "./ieee1459.js";
import { figuraFaixas, paraPNG } from "../../comum/js/graficos.js";
import { figuraEspectro, figuraIEEE519, figuraIEEE1459 } from "./figuras.js";
import { temPastaDireta, criarDestino, nomeRodada, baixar } from "../../comum/js/saida.js";
import { criarSelecao } from "../../comum/js/selecao.js";
import {
  $, virg, numero, esperar, marcarEtapa, recolher, expandir, mostrar, progresso, ligarArquivos, ligarPasta, chip, tabelaHTML,
} from "../../comum/js/ui.js";

const CANAIS = ["Va", "Vb", "Vc", "Ia", "Ib", "Ic"];
const CHAVE = "pe-config-v1";
const sn = (b) => (b ? "sim" : "nao");

let pasta = null, arquivos = [], cfg = null, rodada = null, ensaio = null;

// ------------------------------------------------------- configuracao -----
function lerSalvo() { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch { return {}; } }
function salvar(c) { try { localStorage.setItem(CHAVE, JSON.stringify(c)); } catch { /* sem armazenamento */ } }

function montarConfig() {
  const s = lerSalvo();
  for (const c of CANAIS) {
    const l = document.createElement("label"); l.textContent = c;
    const inp = document.createElement("input");
    inp.id = "k" + c; inp.inputMode = "decimal"; inp.autocomplete = "off";
    inp.addEventListener("input", () => { $("calPreset").value = "pers"; });
    l.appendChild(inp); $("calCampos").appendChild(l);
  }
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
  const k = nome === "pers" ? (kSalvo || [...PADRAO.kV, ...PADRAO.kI]) : [...CALIBRACOES[nome].kV, ...CALIBRACOES[nome].kI];
  CANAIS.forEach((c, i) => { $("k" + c).value = String(k[i]).replace(".", ","); $("k" + c).removeAttribute("aria-invalid"); });
}

function preencherAvancado(a) {
  $("pRede").value = a.fRede ?? PADRAO.fRede;
  $("pCic").value = a.nCicVis ?? PADRAO.nCicVis;
  $("pDur").value = String(a.duracaoMin ?? PADRAO.duracaoMin).replace(".", ",");
  $("pIsc").value = String(a.IscIL ?? PADRAO.IscIL).replace(".", ",");
  $("pIL").value = a.IL519 === undefined || a.IL519 === null ? "" : String(a.IL519).replace(".", ",");
  $("pAtraso").value = (a.atrasoUs || [0, 0, 0, 0, 0, 0]).join(" ");
}

// erro junto ao campo + resumo no fim do formulario
function marcar(id, msg) {
  const inp = $(id), e = $("e-" + id);
  if (msg) inp.setAttribute("aria-invalid", "true"); else inp.removeAttribute("aria-invalid");
  if (e) e.textContent = msg || "";
  return msg ? [msg] : [];
}

function validarConfig() {
  const erros = [];
  const k = CANAIS.map((c) => {
    const v = numero($("k" + c).value), ok = Number.isFinite(v) && v > 0;
    if (ok) $("k" + c).removeAttribute("aria-invalid"); else { $("k" + c).setAttribute("aria-invalid", "true"); erros.push(`${c}: digite um número maior que zero (ex.: 1,2483).`); }
    return v;
  });
  const fRede = numero($("pRede").value), nCic = numero($("pCic").value), dur = numero($("pDur").value);
  const isc = numero($("pIsc").value), ilTxt = $("pIL").value.trim(), il = ilTxt === "" ? NaN : numero(ilTxt);
  const at = $("pAtraso").value.trim().split(/[\s;]+/).filter(Boolean).map(numero);
  erros.push(...marcar("pRede", fRede > 0 ? "" : "Digite um valor maior que zero."));
  erros.push(...marcar("pCic", Number.isInteger(nCic) && nCic >= 1 ? "" : "Digite um número inteiro de ciclos (1 ou mais)."));
  erros.push(...marcar("pDur", dur >= 0 ? "" : "Digite um valor de 0 s ou mais."));
  erros.push(...marcar("pIsc", isc > 0 ? "" : "Digite um valor maior que zero."));
  erros.push(...marcar("pIL", ilTxt === "" || il > 0 ? "" : "Deixe vazio (automático) ou digite um valor maior que zero."));
  erros.push(...marcar("pAtraso", at.length === 6 && at.every(Number.isFinite) ? "" : "Digite 6 valores em µs (Va Vb Vc Ia Ib Ic)."));
  if (erros.length && [...document.querySelectorAll(".avancado [aria-invalid]")].length) document.querySelector(".avancado").open = true;
  $("erroConfig").textContent = erros.length ? `Corrija ${erros.length} campo(s) marcado(s) em vermelho.` : "";
  if (erros.length) { document.querySelector("#secConfig [aria-invalid]")?.focus(); return null; }
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

function resumoConfig(c) {
  const ops = [c.op.fft && "FFT", c.op.ieee519 && "IEEE 519", c.op.ieee1459 && "IEEE 1459", c.op.graficos && "gráficos"].filter(Boolean);
  const cal = $("calPreset").selectedOptions[0].textContent.replace(/ \(.*/, "");
  return `${cal}; ${c.nFaixas} faixa(s)${c.zoom ? " com zoom" : ""}; ${ops.join(", ") || "só potências básicas"}`;
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
  log.push(sprintf("Potencias_Eletricas %s | %d arquivo(s) | resultados em %s", VERSAO, arquivos.length,
    destino.modo === "pasta" ? `${pasta.name}/${nome}` : `${nome}.zip`));
  log.push("Calibracao [Va Vb Vc Ia Ib Ic]: " + c.k.map(String).join(" "));
  log.push(sprintf("Faixas por ensaio: %d (%s zoom) | FFT: %s | IEEE 519: %s | IEEE 1459: %s | graficos: %s",
    c.nFaixas, c.zoom ? "com" : "sem", sn(c.op.fft), sn(c.op.ieee519), sn(c.op.ieee1459), sn(c.op.graficos)));
  log.push(sprintf("Parametros: rede %g Hz | media movel %d ciclos | faixa minima %g s | Isc/IL %g | IL %s | atraso [us] %s",
    c.p.fRede, c.p.nCicVis, c.p.duracaoMin, c.p.IscIL, Number.isNaN(c.p.IL519) ? "auto" : String(c.p.IL519), c.atrasoUs.join(" ")));
  rodada = { destino, log, i: 0, matPot: [], matQ: [], mat59: [], nomes: [], linhasTab: [], salvoZip: false };
  $("resFaixas").replaceChildren(); $("tabResumo").replaceChildren(); $("btNova").hidden = true;
  $("destinoInfo").textContent = destino.modo === "pasta"
    ? `Gravando em ${pasta.name}/${nome}. Cada ensaio é gravado assim que termina.`
    : `Os arquivos vão para ${nome}.zip, baixado no fim. Não feche esta aba antes disso.`;
  mostrarLog();
  recolher($("secLigacao"), "confirmada"); recolher($("secConfig"), resumoConfig(c));
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
  progresso($("progEnsaio"), "Lendo o arquivo e detectando a taxa de amostragem…");
  await esperar();
  let E;
  try {
    const n0 = R.log.length;
    E = prepararEnsaio(await f.text(), nome, cfg.p, R.log);
    const novas = R.log.slice(n0);
    novas.forEach((l, i) => {
      if (!/AVISO|Aviso/.test(l)) return;
      let txt = l.trim();
      for (let j = i + 1; j < novas.length && /^\s+\S/.test(novas[j]); j++) txt += " " + novas[j].trim();
      const p = document.createElement("p"); p.className = "aviso"; p.textContent = txt; $("avisosEnsaio").appendChild(p);
    });
    if (1.1 * cfg.p.fRede >= E.fs / 2) throw new Error(`fs = ${E.fs.toFixed(1)} Hz é insuficiente para a rede de ${cfg.p.fRede} Hz.`);
  } catch (e) {
    R.log.push(`ERRO ${nome}: ${e.message} Ensaio ignorado.`);
    const p = document.createElement("p"); p.className = "aviso"; p.textContent = `${nome}: ${e.message} O ensaio foi ignorado.`;
    $("resFaixas").appendChild(p);
    mostrarLog(); progresso($("progEnsaio"));
    R.i++; return proximoEnsaio();
  }
  progresso($("progEnsaio"));
  mostrarLog();
  const t = Float64Array.from({ length: E.N }, (_, i) => i / E.fs);
  $("infoEnsaio").textContent = `${E.N.toLocaleString("pt-BR")} amostras · fs = ${sprintf("%.6g", E.fs).replace(".", ",")} Hz` +
    (E.regra ? ` (${E.regra})` : " (estimada, sem valor redondo)") + ` · duração ${virg(t[E.N - 1], 1)} s`;
  ensaio = { E, t, nome };
  sel.iniciar({ t, fs: E.fs, series: [{ y: E.Pinst, cor: "rgb(0,0,205)", rotulo: "P" }], nome, n: cfg.nFaixas, zoom: cfg.zoom,
    durMin: cfg.p.duracaoMin, rotY: rotY(), unidade: "W" });
  $("cvSel").focus({ preventScroll: true });
}

const rotY = () => `P (média móvel ${cfg.p.nCicVis} ciclos) [W]`;

async function analisarEnsaio() {
  const R = rodada, { E, t, nome } = ensaio, D = R.destino, c = cfg;
  const faixas = sel.estado.faixas;
  $("btAnalisar").disabled = true;
  const validas = faixas.filter((f) => !f.curta);
  progresso($("progEnsaio"), "Analisando…"); await esperar();
  try {
    for (const f of faixas.filter((x) => x.curta)) {
      R.log.push("", sprintf("%s faixa %d IGNORADA: %.2f s (minimo %g s).", nome, f.num, (f.c2 - f.c1) / E.fs, c.p.duracaoMin));
    }
    if (c.op.graficos) await D.gravar(`${nome}_faixas.png`, await paraPNG(figuraFaixas(t, [{ y: E.Pinst, cor: "rgb(0,0,205)" }], faixas, `${nome} - faixas analisadas`, rotY(), E.fs)));
    for (const [k, f] of validas.entries()) {
      progresso($("progEnsaio"), `Analisando faixa ${k + 1} de ${validas.length}…`); await esperar();
      const rotulo = c.nFaixas > 1 ? `${nome}_f${f.num}` : nome;
      const r = analisarFaixa(E, f.c1, f.c2, rotulo, c.p, c.op, R.log);
      const figs = [];
      for (const [arq, linhas] of Object.entries(r.arquivos)) await D.gravar(arq, linhas);
      if (c.op.graficos) {
        if (c.op.fft) figs.push([`${rotulo}_espectro.png`, figuraEspectro(r, E.fs)]);
        if (r.q) figs.push([`${rotulo}_IEEE519.png`, figuraIEEE519(r.q, t[f.c1])]);
        if (r.r59) figs.push([`${rotulo}_IEEE1459.png`, figuraIEEE1459(r.r59, t[f.c1])]);
        for (const [arq, cv] of figs) await D.gravar(arq, await paraPNG(cv));
      }
      R.matPot.push(r.linhaDados);
      if (r.linha519) R.matQ.push(r.linha519);
      if (r.linha1459) R.mat59.push(r.linha1459);
      R.nomes.push(rotulo); R.linhasTab.push({ r, fs: E.fs });
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
  progresso($("progEnsaio"));
  mostrarLog(); atualizarTabela();
  sel.encerrar(); ensaio = null; R.i++;
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
    ? `Concluído: ${R.destino.arquivos.size} arquivo(s) gravado(s) em ${pasta.name}/${R.destino.nome}.`
    : `Concluído: ${R.destino.arquivos.size} arquivo(s) em ${R.destino.nome}.zip (baixado).`;
  $("btNova").hidden = false;
  marcarEtapa(6);
  mostrar($("secResultados"));
}

// ---------------------------------------------------------- resultados -----
function mostrarLog() { $("log").textContent = rodada.log.join("\n"); $("log").scrollTop = $("log").scrollHeight; }

function atualizarTabela() {
  if (!rodada.linhasTab.length) { $("tabResumo").replaceChildren(); return; }
  const cab = ["Faixa", "Pt [W]", "U [V]", "Ief [A]", "t [s]", "St [VA]", "FP [-]", "f1 [Hz]", "fs [Hz]"];
  if (cfg.op.ieee519) cab.push("IEEE 519 tensão", "IEEE 519 corrente");
  if (cfg.op.ieee1459) cab.push("Se [VA]", "PF 1459 [-]", "In [A]");
  const linhas = rodada.linhasTab.map(({ r, fs }) => {
    const g = r.g, l = [r.rotulo, virg(g.Pt, 1), virg(g.Vrms[0], 1), virg(g.Ief, 3), virg(r.tu, 2), virg(g.St, 1), virg(g.FP, 3),
      virg(r.f1, 3), sprintf("%.6g", fs).replace(".", ",")];
    if (cfg.op.ieee519) l.push(...(r.q ? [chip(r.q.statusV), chip(r.q.statusI)] : ["-", "-"]));
    if (cfg.op.ieee1459) { const t = r.r59 && r.r59.tot; l.push(t ? virg(t.Se, 1) : "-", t ? virg(t.PF, 3) : "-", t ? virg(t.In, 3) : "-"); }
    return l;
  });
  tabelaHTML($("tabResumo"), cab, linhas);
}

function mostrarFaixa(r, figs) {
  const d = document.createElement("div"); d.className = "faixa";
  const h = document.createElement("h3");
  h.textContent = `${r.rotulo}: ${virg(r.tu, 2)} s, Pt = ${virg(r.g.Pt, 1)} W, FP = ${virg(r.g.FP, 3)}`;
  d.appendChild(h);
  if (cfg.op.fft) {
    const p = document.createElement("p"); p.className = "info";
    p.textContent = `f1 = ${virg(r.f1, 3)} Hz; Vb−Va = ${virg(r.defVbVa, 1)}°; Vc−Va = ${virg(r.defVcVa, 1)}°; V−I = ` + r.defVI.map((x) => virg(x, 1) + "°").join(" / ");
    d.appendChild(p);
  }
  const fg = document.createElement("div"); fg.className = "figuras";
  for (const cv of figs) { cv.setAttribute("role", "img"); cv.setAttribute("aria-label", `Gráfico da faixa ${r.rotulo}`); fg.appendChild(cv); }
  d.appendChild(fg);
  $("resFaixas").appendChild(d);
}

// -------------------------------------------------------------- inicio -----
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
  ligarPasta({ chave: "pasta-eletrica", blocoDireto: $("pastaDireta"), blocoZip: $("pastaZip"), btEscolher: $("btPasta"),
    btLembrada: $("btPastaLembrada"), rotulo: $("pastaAtual"), erro: $("erroArq"), aoDefinir: (h) => { pasta = h; atualizarIniciar(); } });
  atualizarIniciar();
  $("btLigacao").addEventListener("click", () => {
    recolher($("secLigacao"), "confirmada", () => marcarEtapa(1));
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
  $("btZip").addEventListener("click", async () => {
    if (!rodada) return;
    baixar(await rodada.destino.zip(), rodada.destino.nome + ".zip"); rodada.salvoZip = true;
  });
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
