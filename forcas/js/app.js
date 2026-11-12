// app.js - interface do modulo de forcas: etapas, selecao das faixas, analise e
// gravacao dos resultados na pasta do usuario (ou .zip). Mesmo padrao do modulo eletrico.
import { ROT, PADRAO, CANAIS, CAB_RESUMO, CAB_TEORICO, CAB_COMP, CAB_ATRITO, CAB_FERRAMENTA, linhaFerramenta, temFerramenta, VERSAO, prepararEnsaio, analisarFaixa } from "./analise.js";
import { mapaValido, vcDeDn, COMPONENTES, compValido, areaContato } from "./nucleo.js";
import { DINAMOMETROS, PADRAO_DINAMOMETRO } from "./dinamometros.js";
import { CORES, figuraSinal, figuraEspectro, figuraDistribuicao } from "./figuras.js";
import { sprintf } from "../../comum/js/formato.js";
import { figuraFaixas, paraPNG } from "../../comum/js/graficos.js";
import { temPastaDireta, criarDestino, nomeRodada, baixar, painelGravacao } from "../../comum/js/saida.js";
import { criarSelecao } from "../../comum/js/selecao.js";
import { criarTarefa } from "../../comum/js/tarefa.js";
import {
  $, virg, numero, esperar, marcarEtapa, recolher, expandir, mostrar, progresso, ligarArquivos, ligarPasta, tabelaHTML, nomeUnico, gravarTodos, ligarZoom, lerZoom, textoZoom,
} from "../../comum/js/ui.js";

const CHAVE = "forcas-config-v1";
const ROT_CAMPO = { tempo: "tempo [s]", fx: "Fx [N]", fy: "Fy [N]", fz: "Fz [N]", ignorar: "ignorar" };
const TEO = [["tAp", "ap"], ["tFn", "fn"], ["tVc", "vc"], ["tKc1", "kc1"], ["tMc", "mc"]];
// ferramenta e peca: texto (registro) e numeros; g0 e kr alimentam o atrito e a forca teorica
const FER_TXT = [["fId", "id"], ["fMat", "material"], ["fRev", "revestimento"], ["fPeca", "peca"]];
const FER_NUM = [["fG0", "g0"], ["fKr", "kr"], ["fA0", "a0"], ["fRe", "re"], ["fRb", "rb"], ["fVB", "vb"]];

const ATR = [["aA", "A"], ["aT", "T"], ["aMu0", "mu0"], ["aT0", "T0"], ["aM", "m"], ["aTf", "Tf"]];

let pasta = null, arquivos = [], cfg = null, rodada = null, ensaio = null;

// leitura e analise no Web Worker (a pagina nao trava); sem Worker, aqui mesmo
const tarefa = criarTarefa("forcas", {
  preparar: async (a, log) => prepararEnsaio(await a.arquivo.text(), a.nome, a.p, log),
  analisar: (a, log) => analisarFaixa(ensaio.E, a.c1, a.c2, a.rotulo, a.p, a.op, log),
});
async function chamar(tipo, args) {
  try { const { r, log } = await tarefa(tipo, args); rodada.log.push(...log); return r; }
  catch (e) { rodada.log.push(...(e.log || [])); throw e; }
}

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
  ligarZoom(s);
  if (s.op) { $("opFFT").checked = s.op.fft; $("opGraf").checked = s.op.graficos; $("opTeo").checked = s.op.teorico; }
  const t = { ...PADRAO.teorico, ...(s.teorico || {}) };
  for (const [id, c] of TEO) $(id).value = txt(t[c]);
  // componentes da forca: qual canal mede cada uma (depende da montagem); guardado por processo
  const compSalvo = { ...(s.comp || {}) };
  for (const c of ["a", "b", "p"]) {
    const l = document.createElement("label"), b = document.createElement("b"), d = document.createElement("span"); b.id = "compRot_" + c; d.id = "compNome_" + c;
    const sel = document.createElement("select"); sel.id = "comp_" + c;
    for (const k of ["fx", "fy", "fz"]) sel.add(new Option(`canal ${ROT[k]}`, k));
    sel.addEventListener("change", () => { compSalvo[tipoEnsaio()] = lerComp(); });
    l.append(b, d, sel); $("compCampos").appendChild(l);
  }
  const aplicaComp = (m) => { for (const c of ["a", "b", "p"]) { $("comp_" + c).value = m[c]; $("comp_" + c).removeAttribute("aria-invalid"); } $("e-comp").textContent = ""; };
  $("btCompPadrao").addEventListener("click", () => { const t = tipoEnsaio(); aplicaComp(COMPONENTES[t].padrao); compSalvo[t] = lerComp(); });
  $("pDur").value = txt(s.duracaoMin ?? PADRAO.duracaoMin);
  // ferramenta e peca; configuracao antiga: g0 e kr vinham da forca teorica e do atrito
  const fer = { g0: s.atrito?.g0 ?? s.teorico?.g0 ?? PADRAO.teorico.g0, kr: s.teorico?.kr ?? PADRAO.teorico.kr, ...(s.ferramenta || {}) };
  for (const [id, c] of FER_TXT) $(id).value = fer[c] || "";
  for (const [id, c] of FER_NUM) $(id).value = txt(fer[c]);
  // atrito na face da ferramenta (Puls; Klocke; Lung, 2014)
  const at = { ...PADRAO.atrito, ...(s.atrito || {}) };
  for (const [id, c] of ATR) $(id).value = txt(at[c]);
  if (s.op) $("opAtr").checked = !!s.op.atrito;
  const mostraAtr = () => { $("blocoAtr").hidden = !$("opAtr").checked || $("opAtr").disabled; };
  $("opAtr").addEventListener("change", mostraAtr);
  $("btArea").addEventListener("click", () => {
    const [b1, b2, t, al] = ["aB1", "aB2", "aTe", "aAl"].map((id) => numero($(id).value));
    if (b1 > 0 && b2 > 0 && t > 0 && al > 0 && al < 90) { $("aA").value = txt(Math.round(areaContato(b1, b2, t, al) * 1000) / 1000); marcar("aA", ""); }
    else $("e-aA").textContent = "Digite b1, b2 e t maiores que zero e α entre 0° e 90°.";
  });
  const mostraTeo = () => { $("blocoTeo").hidden = !$("opTeo").checked || $("opTeo").disabled; };
  $("opTeo").addEventListener("change", mostraTeo);
  // tipo de ensaio e dinamometro (etapa 1)
  for (const [k, d] of Object.entries(DINAMOMETROS)) $("modelo").add(new Option(`${d.nome} · ${d.familia}`, k));
  $("modelo").value = DINAMOMETROS[s.modelo] ? s.modelo : PADRAO_DINAMOMETRO;
  const tipo = s.tipo === "fresamento" ? "fresamento" : "torneamento";
  document.querySelector(`input[name="tipo"][value="${tipo}"]`).checked = true;
  const aplicaTipo = () => {
    const t = tipoEnsaio();
    document.querySelectorAll(".montagem[data-tipo]").forEach((el) => { el.hidden = el.dataset.tipo !== t; });
    $("opTeo").disabled = t !== "torneamento";
    $("opTeo").closest("label").title = t === "torneamento" ? "" : "A força de corte teórica deste módulo vale só para torneamento.";
    $("opAtr").disabled = t !== "torneamento";
    $("opAtr").closest("label").title = t === "torneamento" ? "" : "O atrito na face usa Fc e Ff: escolha o tipo de ensaio Torneamento (corte ortogonal).";
    mostraAtr();
    const K = COMPONENTES[t];
    for (const c of ["a", "b", "p"]) { $("compRot_" + c).textContent = K.rot[c]; $("compNome_" + c).textContent = K.nome[c]; }
    aplicaComp(compValido(compSalvo[t]) ? compSalvo[t] : K.padrao);
    $("notaComp").textContent = `Indique qual canal do dinamômetro mede cada componente nesta montagem. A força ativa é Fa = √(${K.rot.a}² + ${K.rot.b}²); a análise calcula também a razão Fa/Fp. Padrão deste processo: ${["a", "b", "p"].map((c) => `${K.rot[c]} → ${ROT[K.padrao[c]]}`).join(", ")}.`;
    mostraTeo(); mostrarFicha();
  };
  document.querySelectorAll('input[name="tipo"]').forEach((r) => r.addEventListener("change", aplicaTipo));
  $("modelo").addEventListener("change", mostrarFicha);
  aplicaTipo();
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
  const comp = lerComp(), okComp = compValido(comp);
  for (const c of ["a", "b", "p"]) { if (okComp) $("comp_" + c).removeAttribute("aria-invalid"); else $("comp_" + c).setAttribute("aria-invalid", "true"); }
  $("e-comp").textContent = okComp ? "" : "Use Fx, Fy e Fz uma vez cada: cada componente em um canal diferente.";
  if (!okComp) erros.push("componentes");
  const teo = { canal: comp.a };        // forca teorica (torneamento): comparada com o canal de Fc
  const opTeo = $("opTeo").checked && !$("opTeo").disabled, usaAtr = $("opAtr").checked && !$("opAtr").disabled;
  const fer = {};
  for (const [id, c] of FER_TXT) fer[c] = $(id).value.trim().slice(0, 80);
  for (const [id, c] of FER_NUM) {
    const vazio = $(id).value.trim() === "", v = vazio ? null : numero($(id).value); fer[c] = v;
    let msg = "";
    if (c === "g0") msg = vazio ? (opTeo || usaAtr ? "Digite o ângulo de saída: ele é usado no atrito e na força teórica." : "") : v > -90 && v < 90 ? "" : "Digite um ângulo entre −90° e 90°.";
    else if (c === "kr") msg = vazio ? (opTeo ? "Digite o ângulo de posição: ele é usado na força teórica." : "") : v > 0 && v <= 180 ? "" : "Digite um ângulo entre 0° e 180°.";
    else if (c === "a0") msg = vazio || (v >= 0 && v < 90) ? "" : "Digite um ângulo entre 0° e 90° ou deixe vazio.";
    else msg = vazio || v >= 0 ? "" : "Digite um valor de 0 ou mais, ou deixe vazio.";
    erros.push(...marcar(id, msg));
  }
  teo.kr = fer.kr; teo.g0 = fer.g0;
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
  const atr = { g0: fer.g0 }, opAtr = usaAtr;
  for (const [id, c] of ATR) {
    const vazio = $(id).value.trim() === "", v = vazio ? null : numero($(id).value); atr[c] = v;
    if (!opAtr) { marcar(id, ""); continue; }
    let msg = "";
    if (c === "g0") msg = Number.isFinite(v) && v > -90 && v < 90 ? "" : "Digite um ângulo entre −90° e 90°.";
    else if (c === "A") msg = vazio || v > 0 ? "" : "Digite uma área maior que zero ou deixe vazio.";
    else if (c === "T") msg = vazio || Number.isFinite(v) ? "" : "Digite a temperatura em °C ou deixe vazio.";
    else if (c === "mu0") msg = v > 0 ? "" : "Digite um valor maior que zero.";
    else if (c === "m") msg = v > 0 ? "" : "Digite um expoente maior que zero.";
    else if (c === "T0") msg = Number.isFinite(v) ? "" : "Digite a temperatura em °C.";
    else if (c === "Tf") msg = Number.isFinite(v) && v > numero($("aT0").value) ? "" : "A temperatura de fusão deve ser maior que T0.";
    erros.push(...marcar(id, msg));
  }
  if (opAtr) for (const d of $("blocoAtr").querySelectorAll("details")) if (d.querySelector("[aria-invalid]")) d.open = true;
  if (document.querySelector(".avancado [aria-invalid]")) document.querySelector(".avancado").open = true;
  $("erroConfig").textContent = erros.length ? `Corrija ${erros.length} campo(s) marcado(s) em vermelho.` : "";
  if (erros.length) { document.querySelector("#secConfig [aria-invalid]")?.focus(); return null; }
  const op = { fft: $("opFFT").checked, graficos: $("opGraf").checked, teorico: opTeo, atrito: opAtr };
  const tipo = tipoEnsaio(), modelo = $("modelo").value;
  if (tipo !== "torneamento") op.teorico = false;
  salvar({ mapa, k, nFaixas: Number($("nFaixas").value), ...lerZoom(), op: { ...op, atrito: $("opAtr").checked }, teorico: teo, atrito: atr, ferramenta: fer, duracaoMin: dur, tipo, modelo, comp: { ...(lerSalvo().comp || {}), [tipo]: comp } });
  return { nFaixas: Number($("nFaixas").value), ...lerZoom(), op, tipo, modelo, p: { mapa, k, duracaoMin: dur, teorico: teo, atrito: atr, ferramenta: fer, modelo, tipo, comp } };
}

function lerComp() { return { a: $("comp_a").value, b: $("comp_b").value, p: $("comp_p").value }; }
function tipoEnsaio() { return document.querySelector('input[name="tipo"]:checked').value; }
function resumoMontagem() {
  return `${tipoEnsaio() === "torneamento" ? "torneamento" : "fresamento, furação ou rosqueamento"}; dinamômetro ${$("modelo").value}`;
}

// Ficha tecnica do dinamometro escolhido (catalogo Kistler, traduzido)
function mostrarFicha() {
  const d = DINAMOMETROS[$("modelo").value]; if (!d) return;
  const fx = (c) => d.faixa[c].map((v) => String(v).replace(".", ",")).join(" … ");
  const fn = d.fn.x === d.fn.y ? `fn(x), fn(y) ≈ ${String(d.fn.x).replace(".", ",")} kHz; fn(z) ≈ ${String(d.fn.z).replace(".", ",")} kHz`
    : `fn(x) ≈ ${String(d.fn.x).replace(".", ",")}; fn(y) ≈ ${String(d.fn.y).replace(".", ",")}; fn(z) ≈ ${String(d.fn.z).replace(".", ",")} kHz`;
  $("fichaTit").textContent = `Dados técnicos do dinamômetro ${d.nome}`;
  const img = $("fotoDina");
  img.src = d.foto; img.alt = `Dinamômetro Kistler ${d.nome}, com os eixos Fx, Fy e Fz${d.nome.startsWith("9272") ? " e o momento Mz" : ""} e as cotas de dimensão.`;
  $("fotoTit").textContent = `Kistler ${d.nome}`;
  $("fotoFam").textContent = d.familia.charAt(0).toUpperCase() + d.familia.slice(1) + ".";
  $("fotoCotas").textContent = `Letras das cotas: ${d.cotas}. Dimensões: ${d.dim}.`;
  tabelaHTML($("fichaTab"), ["Grandeza", "Valor"], [
    ["Faixa de medição Fx [kN]", fx("fx")], ["Faixa de medição Fy [kN]", fx("fy")], ["Faixa de medição Fz [kN]", fx("fz")],
    ["Sensibilidade", d.sens], ["Frequência natural", fn], ["Temperatura de operação", d.temp],
    ["Dimensões", d.dim], ["Massa", d.massa],
    ["Indicado para", d.usos.includes("torneamento") ? "torneamento e usinagem na mesa (fresamento, furação, rosqueamento)" : "usinagem na mesa (fresamento, furação, rosqueamento)"],
  ]);
  const aviso = tipoEnsaio() === "torneamento" && !d.usos.includes("torneamento") ? " ATENÇÃO: este modelo não é indicado para torneamento." : "";
  $("fichaObs").textContent = d.obs + aviso + " Fonte: catálogo Kistler 960-002e (traduzido).";
}

function resumoConfig(c) {
  const k = c.p.k, cal = [k.fx, k.fy, k.fz].every((v) => v === 1) ? "sem calibração (1,0)" : `calibração ${[k.fx, k.fy, k.fz].map((v) => txt(v)).join(" / ")}`;
  const ops = [c.op.fft && "FFT", c.op.graficos && "gráficos", c.op.teorico && "força teórica", c.op.atrito && "atrito na face"].filter(Boolean);
  return `${cal}; ${c.nFaixas} faixa(s)${textoZoom(c)}; ${ops.join(", ") || "só estatística"}`;
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
  log.push(`Ensaio: ${c.tipo === "torneamento" ? "torneamento" : "fresamento, furacao ou rosqueamento"} | dinamometro Kistler ${c.modelo}`);
  log.push(`Colunas: ${c.p.mapa.join(" ")} | calibracao [Fx Fy Fz]: ${[c.p.k.fx, c.p.k.fy, c.p.k.fz].join(" ")}`);
  if (temFerramenta(c.p.ferramenta)) {
    const f = c.p.ferramenta, t = (v) => v || "-", n = (v, u) => (Number.isFinite(v) ? `${String(v).replace(".", ",")} ${u}` : "-");
    log.push(`Ferramenta: ${t(f.id)} | material ${t(f.material)} | revestimento ${t(f.revestimento)} | peca: ${t(f.peca)}`);
    log.push(`  g0 ${n(f.g0, "graus")} | kr ${n(f.kr, "graus")} | a0 ${n(f.a0, "graus")} | raio de ponta ${n(f.re, "mm")} | raio de aresta ${n(f.rb, "um")} | VB ${n(f.vb, "mm")}`);
  }
  log.push(`Componentes (montagem): ${["a", "b", "p"].map((k) => `${COMPONENTES[c.tipo].rot[k]} = ${ROT[c.p.comp[k]]}`).join(" | ")} | Fa = raiz(${COMPONENTES[c.tipo].rot.a}^2 + ${COMPONENTES[c.tipo].rot.b}^2) | atrito: razao Fa/Fp`);
  log.push(sprintf("Faixas por ensaio: %d (%s) | faixa minima %g s | FFT: %s | graficos: %s | forca teorica: %s",
    c.nFaixas, c.zoom ? (c.zoomPorFaixa ? "com zoom em cada faixa" : "com zoom") : "sem zoom", c.p.duracaoMin, c.op.fft ? "sim" : "nao", c.op.graficos ? "sim" : "nao", c.op.teorico ? "sim" : "nao"));
  if (c.op.teorico) {
    const q = c.p.teorico;
    log.push(sprintf("Teorico: ap %g mm | fn %g mm/rot | vc %g m/min | kr %g graus | g0 %g graus | kc1 %g N/mm2 | mc %g | canal %s",
      q.ap, q.fn, q.vc, q.kr, q.g0, q.kc1, q.mc, ROT[q.canal]));
  }
  if (c.op.atrito) {
    const q = c.p.atrito;
    log.push(sprintf("Atrito na face (Puls; Klocke; Lung, 2014): g0 %g graus | area %s | T de contato %s | modelo: mu0 %g, T0 %g C, m %g, fusao %g C",
      q.g0, q.A > 0 ? q.A + " mm2" : "nao informada", Number.isFinite(q.T) ? q.T + " C" : "nao informada", q.mu0, q.T0, q.m, q.Tf));
  }
  rodada = { destino, log, i: 0, resumo: [], teo: [], comp: [], atr: [], nomes: [], usados: new Set(), salvoZip: false };
  // pasta escolhida: os arquivos ja vao para o disco, sem .zip; o painel mostra cada gravacao
  const naPasta = destino.modo === "pasta";
  rodada.painel = naPasta ? painelGravacao($("statusGravacao"), destino, `${pasta.name}/${nome}`) : null;
  if (!naPasta) $("statusGravacao").hidden = true;
  $("btZip").hidden = naPasta; $("destinoInfo").hidden = naPasta;
  $("resFaixas").replaceChildren(); $("btNova").hidden = true;
  $("destinoInfo").textContent = destino.modo === "pasta"
    ? `Gravando em ${pasta.name}/${nome}. Cada ensaio é gravado assim que termina.`
    : `Os arquivos vão para ${nome}.zip, baixado no fim. Não feche esta aba antes disso.`;
  mostrarLog();
  recolher($("secMontagem"), resumoMontagem()); recolher($("secConfig"), resumoConfig(c));
  recolher($("secArquivos"), `${arquivos.length} arquivo(s) → ${destino.modo === "pasta" ? pasta.name : ".zip"}`);
  $("secResultados").hidden = false;
  await proximoEnsaio();
}

async function proximoEnsaio() {
  const R = rodada;
  if (R.i >= arquivos.length) return finalizarRodada();
  const f = arquivos[R.i], nome = nomeUnico(f.name, R.usados, R.log);
  marcarEtapa(4);
  mostrar($("secEnsaio"));
  $("tituloEnsaio").textContent = `4 Faixas · ensaio ${R.i + 1} de ${arquivos.length}: ${nome}`;
  $("infoEnsaio").textContent = ""; $("avisosEnsaio").replaceChildren();
  progresso($("progEnsaio"), "Lendo o arquivo…"); await esperar();
  let E;
  try {
    const n0 = R.log.length;
    E = await chamar("preparar", { arquivo: f, nome, p: cfg.p });
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
  sel.iniciar({ t: E.t, fs: E.fs, nome, n: cfg.nFaixas, zoom: cfg.zoom, zoomPorFaixa: cfg.zoomPorFaixa, durMin: cfg.p.duracaoMin, rotY: "força [N]", unidade: "N",
    series: [{ y: E.F.fx, cor: CORES.fx, rotulo: "Fx" }, { y: E.F.fy, cor: CORES.fy, rotulo: "Fy" }, { y: E.F.fz, cor: CORES.fz, rotulo: "Fz" }] });
  $("cvSel").focus({ preventScroll: true });
}

// analise em curso: os cliques ficam na fila e rodariam no meio dela (Pular pulava tambem o ensaio seguinte)
let ocupado = false;

async function analisarEnsaio() {
  if (ocupado || !ensaio) return;
  ocupado = true;
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
      await D.gravar(`${nome}_faixas.png`, await paraPNG(figuraFaixas(E.t, series, faixas, `${nome} - faixas analisadas`, "força [N]")));
    }
    for (const [k, f] of validas.entries()) {
      progresso($("progEnsaio"), `Analisando faixa ${k + 1} de ${validas.length}…`); await esperar();
      const rotulo = c.nFaixas > 1 ? `${nome}_f${f.num}` : nome;
      const r = await chamar("analisar", { c1: f.c1, c2: f.c2, rotulo, p: c.p, op: c.op });
      for (const [arq, linhas] of Object.entries(r.arquivos)) await D.gravar(arq, linhas);
      const figs = [];
      if (c.op.graficos) {
        figs.push([`${rotulo}_sinal.png`, figuraSinal(E, r)]);
        figs.push([`${rotulo}_distribuicao.png`, figuraDistribuicao(E, r)]);
        if (r.espectro) figs.push([`${rotulo}_espectro.png`, figuraEspectro(E, r)]);
        for (const [arq, cv] of figs) await D.gravar(arq, await paraPNG(cv));
      } else {
        // sem gravar graficos: a distribuicao (e o espectro) aparecem so na tela
        figs.push([null, figuraDistribuicao(E, r)]);
        if (r.espectro) figs.push([null, figuraEspectro(E, r)]);
      }
      R.resumo.push(...r.linhasResumo);
      if (r.linhaTeorico) R.teo.push(r.linhaTeorico);
      if (r.linhaComp) R.comp.push(r.linhaComp);
      if (r.linhaAtrito) R.atr.push(r.linhaAtrito);
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
  sel.encerrar(); ensaio = null; R.i++; ocupado = false;
  await proximoEnsaio();
}

async function gravarResumos() {
  const R = rodada, arqs = [];
  if (R.resumo.length) arqs.push(["forcas_resumo.csv", [CAB_RESUMO, ...R.resumo]]);
  if (R.teo.length) arqs.push(["corte_teorico.csv", [CAB_TEORICO, ...R.teo]]);
  if (R.comp.length) arqs.push(["componentes.csv", [CAB_COMP, ...R.comp]]);
  if (R.atr.length) arqs.push(["atrito.csv", [CAB_ATRITO, ...R.atr]]);
  if (temFerramenta(cfg?.p.ferramenta)) arqs.push(["ferramenta.csv", [CAB_FERRAMENTA, linhaFerramenta(cfg.p.ferramenta)]]);
  await gravarTodos(R, [...arqs, ["relatorio.txt", R.log]]);
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
  if (R.painel) R.painel.concluir();
  $("btNova").hidden = false;
  marcarEtapa(6); mostrar($("secResultados"));
}

function mostrarLog() { $("log").textContent = rodada.log.join("\n"); $("log").scrollTop = $("log").scrollHeight; }

function mostrarFaixa(r, figs) {
  const d = document.createElement("div"); d.className = "faixa";
  const h = document.createElement("h3");
  h.textContent = `${r.rotulo}: ${virg(r.t0, 3)} s a ${virg(r.t1, 3)} s (${virg(r.tu, 3)} s, ${r.n.toLocaleString("pt-BR")} amostras)`;
  d.appendChild(h);
  if (r.comp) {                          // componentes pela montagem, forca ativa e razao Fa/Fp
    const q = r.comp, box = document.createElement("div"); box.className = "comparacao";
    for (const [rot, val] of [...["a", "b", "p"].map((k) => [`${q.rot[k]} (média de ${ROT[q.mapa[k]]}) [N]`, virg(q[k], 1)]),
      [`Fa = √(${q.rot.a}² + ${q.rot.b}²) [N]`, virg(q.fa, 1)], ["Razão Fa/Fp [-] (atrito)", Number.isFinite(q.razao) ? virg(q.razao, 3) : "indefinida (Fp ≈ 0)"]]) {
      const c = document.createElement("div"), s = document.createElement("span"), b = document.createElement("strong");
      s.textContent = rot; b.textContent = val; c.append(s, b); box.appendChild(c);
    }
    d.appendChild(box);
  }
  if (r.atrito) {                        // atrito na face da ferramenta: mu = FT/FN, tensoes e modelo termico
    const q = r.atrito, box = document.createElement("div"), ok = Number.isFinite(q.mu); box.className = "comparacao";
    const it = [[`FT, tangencial (γ0 = ${virg(q.g0, 1)}°) [N]`, virg(q.FT, 1)], ["FN, normal [N]", virg(q.FN, 1)],
      ["μ = FT/FN [-] (aparente)", ok ? virg(q.mu, 3) : "indefinido (FN ≤ 0)"], ["β = arctan μ [°]", ok ? virg(q.beta, 1) : "–"]];
    if (Number.isFinite(q.A)) it.push([`τ = FT/A (A = ${virg(q.A, 3)} mm²) [MPa]`, virg(q.tau, 1)], ["σ = FN/A [MPa]", virg(q.sigma, 1)]);
    if (Number.isFinite(q.T)) it.push([`μ do modelo a ${virg(q.T, 0)} °C [-]`, virg(q.muModelo, 3)]);
    for (const [rot, val] of it) {
      const c = document.createElement("div"), s = document.createElement("span"), b = document.createElement("strong");
      s.textContent = rot; b.textContent = val; c.append(s, b); box.appendChild(c);
    }
    d.appendChild(box);
    if (q.avisos?.length) {
      const ul = document.createElement("ul"); ul.className = "avisos-faixa";
      for (const av of q.avisos) { const li = document.createElement("li"); li.textContent = "Atrito: " + av; ul.appendChild(li); }
      d.appendChild(ul);
    }
  }
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
  btDesfazer: $("btDesfazer"), btReiniciar: $("btReiniciar"), aoMudar: (pronto) => { $("btAnalisar").disabled = !pronto || ocupado; },
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
    recolher($("secMontagem"), resumoMontagem(), () => marcarEtapa(1));
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
    if (!ensaio || ocupado) return;
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
