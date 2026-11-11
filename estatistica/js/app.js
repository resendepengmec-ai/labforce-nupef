// app.js - interface do modulo de planejamento de experimentos: tipo de analise, dados
// (arquivo, colagem, exemplo ou matriz gerada), revisao dos papeis das colunas, analise e
// resultados com gravacao na pasta do usuario (ou .zip). Os calculos ficam em resultados.js.
import { lerCSV, colunaNumerica, numeroCSV } from "./dados.js";
import { executar, sugerirPapeis, sugerirNiveis, csvTabela, celTela, TIPOS, VERSAO } from "./resultados.js";
import { rotuloEfeito } from "./fatorial2k.js";
import { ccdMatriz } from "./ccd.js";
import { desenharFigura } from "./figuras.js";
import { EXEMPLOS, ARQUIVOS, BIBLIOGRAFIA } from "../exemplos/exemplos.js";
import { paraPNG } from "../../comum/js/graficos.js";
import { temPastaDireta, criarDestino, nomeRodada, baixar, painelGravacao } from "../../comum/js/saida.js";
import { $, numero, esperar, marcarEtapa, recolher, expandir, mostrar, progresso, ligarArquivos, ligarPasta, chip, tabelaHTML } from "../../comum/js/ui.js";

let pasta = null, tipo = "anova", tab = null, nomeArquivo = "", ultimo = null;
const ROT_PAPEL = { fator: "entrada (fator)", resposta: "saída (resposta)", ignorar: "ignorar" };

// ---------------------------------------------------------------- 1. tipo -----
function escolherTipo() {
  tipo = document.querySelector('input[name="tipo"]:checked').value;
  recolher($("secTipo"), TIPOS[tipo], () => { marcarEtapa(1); ["secDados", "secRevisar", "secAnalise", "secResultados"].forEach((s) => { $(s).hidden = true; }); });
  $("blocoGerar").hidden = !(tipo === "fatorial" || tipo === "ccd");
  prepararGerar();
  prepararExemplos();
  if (tab) mostrarResumoDados();
  marcarEtapa(2); mostrar($("secDados"));
}

// ---------------------------------------------------------------- 2. dados -----
function carregarTexto(texto, nome) {
  $("erroDados").textContent = "";
  try { tab = lerCSV(texto); nomeArquivo = nome; mostrarResumoDados(); }
  catch (e) { tab = null; $("erroDados").textContent = `Não foi possível ler os dados: ${e.message}`; $("resumoDados").textContent = ""; }
  $("btDados").disabled = !tab;
}
function mostrarResumoDados() {
  $("resumoDados").textContent = `${nomeArquivo || "Dados digitados"}: ${tab.linhas.length} linhas e ${tab.colunas.length} colunas (${tab.colunas.join(", ")}).`;
}

// exemplo sintetico do modulo + exemplos da bibliografia do mesmo tipo de analise
function prepararExemplos() {
  const sel = $("selExemplo"); sel.replaceChildren();
  sel.add(new Option(`Exemplo do módulo (${ARQUIVOS[tipo]})`, ""));
  const lista = BIBLIOGRAFIA.filter((e) => e.tipo === tipo);
  if (lista.length) {
    const g = document.createElement("optgroup"); g.label = "Bibliografia (notas de aula, Prof. Anselmo/UFG)";
    for (const e of lista) g.append(new Option(e.nome, e.id));
    sel.append(g);
  }
  mostrarFonteExemplo();
}
function mostrarFonteExemplo() {
  const e = BIBLIOGRAFIA.find((x) => x.id === $("selExemplo").value);
  $("notaExemplo").textContent = e ? `Fonte: ${e.fonte}`
    : BIBLIOGRAFIA.some((x) => x.tipo === tipo) ? "Exemplo sintético do módulo. A lista também traz exemplos da bibliografia, com a fonte." : "Exemplo sintético do módulo.";
}
function carregarExemplo() {
  const e = BIBLIOGRAFIA.find((x) => x.id === $("selExemplo").value);
  const csv = e ? e.csv : EXEMPLOS[tipo], nome = e ? e.arquivo.split("/").pop() : ARQUIVOS[tipo];
  $("txtDados").value = csv; carregarTexto(csv, nome);
}

function prepararGerar() {
  const max = tipo === "ccd" ? 6 : 7, k = $("gK");
  k.replaceChildren(); for (let i = 2; i <= max; i++) k.add(new Option(String(i), String(i)));
  $("rotRep").hidden = tipo === "ccd";
  $("gCen").value = tipo === "ccd" ? "5" : "0";
  $("notaGerar").textContent = tipo === "ccd"
    ? "Composto central rotacional: 2^k pontos fatoriais (meia fração 2^(k−1) com 5 ou 6 fatores), 2k pontos axiais em ±α e os pontos centrais. Os fatores ficam codificados; informe os níveis reais na revisão."
    : "Ordem padrão de Yates (A muda a cada linha). As réplicas repetem o bloco inteiro. Os fatores ficam codificados em −1 e +1; informe os níveis reais na revisão.";
  $("tabGerar").replaceChildren(); $("btUsarMatriz").hidden = true;
}
function gerarMatriz() {
  const k = Number($("gK").value), rep = Math.round(numero($("gRep").value)), nc = Math.round(numero($("gCen").value)), nr = Math.round(numero($("gResp").value));
  if (!(nr >= 1 && nr <= 6) || !(nc >= 0 && nc <= 20) || (tipo === "fatorial" && !(rep >= 1 && rep <= 10))) {
    $("erroDados").textContent = "Gere a matriz com 1 a 10 réplicas, 0 a 20 pontos centrais e 1 a 6 respostas."; return;
  }
  $("erroDados").textContent = "";
  let X;
  if (tipo === "ccd") X = ccdMatriz(k, nc).X;
  else {
    X = [];
    for (let r = 0; r < rep; r++) for (let c = 0; c < 1 << k; c++) X.push([...Array(k).keys()].map((j) => (c & (1 << j) ? 1 : -1)));
    for (let i = 0; i < nc; i++) X.push(new Array(k).fill(0));
  }
  const nomesF = [...Array(k).keys()].map((j) => (tipo === "ccd" ? `x${j + 1}` : "ABCDEFG"[j]));
  const nomesY = [...Array(nr).keys()].map((j) => `y${j + 1}`);
  const t = $("tabGerar"); t.replaceChildren();
  const h = t.createTHead().insertRow();
  for (const c of ["Ensaio", ...nomesF, ...nomesY]) { const th = document.createElement("th"); th.textContent = c; th.scope = "col"; h.appendChild(th); }
  const b = t.createTBody();
  X.forEach((x, i) => {
    const tr = b.insertRow();
    tr.insertCell().textContent = String(i + 1);
    for (const v of x) tr.insertCell().textContent = String(Number(v.toFixed(4))).replace(".", ",");
    for (const y of nomesY) { const inp = document.createElement("input"); inp.inputMode = "decimal"; inp.setAttribute("aria-label", `Ensaio ${i + 1}, ${y}`); tr.insertCell().appendChild(inp); }
  });
  t.dataset.fatores = nomesF.join("|"); t.dataset.respostas = nomesY.join("|");
  $("btUsarMatriz").hidden = false;
}
function usarMatriz() {
  const t = $("tabGerar"), nf = t.dataset.fatores.split("|"), ny = t.dataset.respostas.split("|"), linhas = [[...nf, ...ny].join(";")];
  for (const [i, tr] of [...t.tBodies[0].rows].entries()) {
    const cel = [...tr.cells].slice(1), x = cel.slice(0, nf.length).map((c) => c.textContent);
    const y = cel.slice(nf.length).map((c) => c.firstChild.value.trim());
    const vazio = y.findIndex((v) => !Number.isFinite(numeroCSV(v)));
    if (vazio >= 0) { $("erroDados").textContent = `Preencha a resposta ${ny[vazio]} do ensaio ${i + 1} com um número.`; cel[nf.length + vazio].firstChild.focus(); return; }
    linhas.push([...x, ...y].join(";"));
  }
  carregarTexto(linhas.join("\n"), "matriz gerada");
}

// ------------------------------------------------------------- 3. revisar -----
function montarRevisao() {
  const sug = sugerirPapeis(tab, tipo), comNiveis = tipo === "fatorial" || tipo === "ccd";
  $("notaPapeis").textContent = tipo === "anova" || tipo === "manova"
    ? `Marque 1 coluna como fator (os grupos) e ${tipo === "manova" ? "2 ou mais" : "1 ou mais"} como resposta.`
    : "Marque os fatores (entradas) e as respostas (saídas). Se os fatores estiverem em unidades reais, informe os níveis −1 e +1 (baixo e alto); se já estiverem codificados, deixe em branco.";
  const cab = ["Coluna", "Nome da grandeza", "Papel", "Unidade", ...(comNiveis ? ["Nível −1 (baixo)", "Nível +1 (alto)"] : [])];
  const t = $("tabPapeis"); t.replaceChildren();
  const h = t.createTHead().insertRow();
  for (const c of cab) { const th = document.createElement("th"); th.textContent = c; th.scope = "col"; h.appendChild(th); }
  const b = t.createTBody();
  tab.colunas.forEach((c, j) => {
    const tr = b.insertRow(); tr.dataset.coluna = c;
    tr.insertCell().textContent = c;
    // nome usado nos titulos e eixos dos graficos ("grandeza [unidade]"); vazio = nome da coluna
    const nm = document.createElement("input"); nm.className = "nome"; nm.setAttribute("aria-label", `Nome da grandeza de ${c}`); nm.placeholder = c;
    tr.insertCell().appendChild(nm);
    const sel = document.createElement("select"); sel.className = "papel"; sel.setAttribute("aria-label", `Papel de ${c}`);
    for (const p of ["fator", "resposta", "ignorar"]) sel.add(new Option(ROT_PAPEL[p], p));
    sel.value = sug[c]; sel.addEventListener("change", atualizarRevisao); tr.insertCell().appendChild(sel);
    const u = document.createElement("input"); u.className = "unid"; u.setAttribute("aria-label", `Unidade de ${c}`); u.placeholder = "ex.: °C";
    tr.insertCell().appendChild(u);
    if (comNiveis) {
      let nv = null;
      try { nv = sugerirNiveis(colunaNumerica(tab, c), tipo); } catch { /* coluna nao numerica */ }
      for (const k of ["baixo", "alto"]) {
        const inp = document.createElement("input"); inp.className = `nivel ${k}`; inp.inputMode = "decimal";
        inp.setAttribute("aria-label", `${c}: nível ${k === "baixo" ? "−1" : "+1"}`);
        inp.value = nv && Number.isFinite(nv[k]) ? String(nv[k]).replace(".", ",") : "";
        tr.insertCell().appendChild(inp);
      }
    }
  });
  $("blocoTermos").hidden = tipo !== "fatorial";
  atualizarRevisao();
}
const papeis = () => Object.fromEntries([...$("tabPapeis").tBodies[0].rows].map((tr) => [tr.dataset.coluna, tr.querySelector("select.papel").value]));
const colunasDe = (p) => Object.entries(papeis()).filter(([, v]) => v === p).map(([c]) => c);

function atualizarRevisao() {
  for (const tr of $("tabPapeis").tBodies[0].rows) {
    const ehFator = tr.querySelector("select.papel").value === "fator";
    tr.querySelectorAll("input.nivel").forEach((i) => { i.disabled = !ehFator; });
  }
  if (tipo === "fatorial") {
    const k = colunasDe("fator").length, box = $("termos"), antes = new Set([...box.querySelectorAll("input:not(:checked)")].map((i) => i.value));
    box.replaceChildren();
    if (k >= 2 && k <= 7) for (let m = 1; m < 1 << k; m++) {
      const r = rotuloEfeito(m, k), l = document.createElement("label"); l.className = "chk";
      const inp = document.createElement("input"); inp.type = "checkbox"; inp.value = r; inp.checked = !antes.has(r);
      l.append(inp, ` ${r}`); box.appendChild(l);
    }
  }
  const resp = colunasDe("resposta"), otim = (tipo === "fatorial" || tipo === "ccd") && resp.length >= 2;
  $("blocoObjetivos").hidden = !otim; $("rotSemente").hidden = !otim;
  if (otim) montarObjetivos(resp);
}
function montarObjetivos(resp) {
  const t = $("tabObjetivos"), velhos = Object.fromEntries([...(t.tBodies[0]?.rows || [])].map((tr) => [tr.dataset.resp, tr]));
  t.replaceChildren();
  const h = t.createTHead().insertRow();
  for (const c of ["Resposta", "Objetivo", "L (inferior)", "U (superior)", "Alvo T", "s", "t", "Importância", "Peso TOPSIS"]) { const th = document.createElement("th"); th.textContent = c; th.scope = "col"; h.appendChild(th); }
  const b = t.createTBody();
  for (const r of resp) {
    if (velhos[r]) { b.appendChild(velhos[r]); continue; }
    let y = [];
    try { y = colunaNumerica(tab, r); } catch { /* validado na analise */ }
    const mn = y.length ? Math.min(...y) : 0, mx = y.length ? Math.max(...y) : 1, md = (mn + mx) / 2;
    const tr = b.insertRow(); tr.dataset.resp = r;
    tr.insertCell().textContent = r;
    const sel = document.createElement("select"); sel.className = "obj"; sel.setAttribute("aria-label", `Objetivo de ${r}`);
    for (const [v, txt] of [["max", "maximizar"], ["min", "minimizar"], ["alvo", "atingir o alvo"], ["ignorar", "não otimizar"]]) sel.add(new Option(txt, v));
    tr.insertCell().appendChild(sel);
    for (const [k, v] of [["L", mn], ["U", mx], ["T", md], ["s", 1], ["t", 1], ["r", 1], ["peso", 1]]) {
      const inp = document.createElement("input"); inp.inputMode = "decimal"; inp.dataset.k = k; inp.setAttribute("aria-label", `${r}: ${k}`);
      inp.value = String(Number(v.toPrecision(6))).replace(".", ","); tr.insertCell().appendChild(inp);
    }
  }
}

function lerRevisao() {
  const erros = [], alfa = numero($("alfa").value);
  if (!(alfa > 0 && alfa < 0.5)) erros.push("α deve ficar entre 0 e 0,5 (ex.: 0,05).");
  const unidades = {}, niveis = {}, nomes = {};
  for (const tr of $("tabPapeis").tBodies[0].rows) {
    const c = tr.dataset.coluna; unidades[c] = tr.querySelector("input.unid").value.trim();
    nomes[c] = tr.querySelector("input.nome").value.trim() || c;
    const b = tr.querySelector("input.nivel.baixo"), a = tr.querySelector("input.nivel.alto");
    if (b && !b.disabled && (b.value.trim() || a.value.trim())) {
      const nb = numero(b.value), na = numero(a.value);
      if (!(Number.isFinite(nb) && Number.isFinite(na) && na > nb)) erros.push(`${c}: informe os dois níveis, com o +1 maior que o −1 (ou deixe ambos em branco se a coluna já estiver codificada).`);
      else niveis[c] = { baixo: nb, alto: na };
    }
  }
  let termos;
  if (tipo === "fatorial") {
    const marc = [...$("termos").querySelectorAll("input")];
    if (marc.length && !marc.some((i) => i.checked)) erros.push("Marque pelo menos 1 termo do modelo.");
    if (marc.some((i) => !i.checked)) termos = marc.filter((i) => i.checked).map((i) => i.value);
  }
  const objetivos = {};
  let semente = 12345;
  if (!$("blocoObjetivos").hidden && $("tabObjetivos").tBodies[0]) {
    for (const tr of $("tabObjetivos").tBodies[0].rows) {
      const o = { tipo: tr.querySelector("select.obj").value };
      for (const inp of tr.querySelectorAll("input")) o[inp.dataset.k] = numero(inp.value);
      if (o.tipo !== "ignorar" && ["L", "U", "s", "t", "r", "peso"].some((k) => !(Number.isFinite(o[k]) && (k === "L" || k === "U" || o[k] > 0)))) erros.push(`${tr.dataset.resp}: preencha L e U, e s, t, importância e peso maiores que zero.`);
      objetivos[tr.dataset.resp] = o;
    }
    semente = Math.round(numero($("semente").value));
    if (!(semente >= 0 && semente < 2 ** 32)) erros.push("A semente deve ser um inteiro entre 0 e 4294967295.");
  }
  $("erroRevisar").textContent = erros.join(" ");
  return erros.length ? null : { tipo, tab, nomeArquivo, papeis: papeis(), unidades, nomes, niveis, alfa, termos, objetivos, semente };
}

// ------------------------------------------------------------ 4. analisar -----
async function analisar() {
  const cfg = lerRevisao(); if (!cfg) return;
  recolher($("secRevisar"), `α = ${String(cfg.alfa).replace(".", ",")}`, () => { marcarEtapa(3); $("secAnalise").hidden = true; $("secResultados").hidden = true; });
  marcarEtapa(4); mostrar($("secAnalise"));
  $("erroAnalise").textContent = ""; $("btVoltarRevisar").hidden = true;
  progresso($("progAnalise"), "Calculando…"); await esperar();
  try {
    ultimo = executar(cfg);
  } catch (e) {
    progresso($("progAnalise"));
    $("erroAnalise").textContent = `Não foi possível analisar: ${e.message}`; $("btVoltarRevisar").hidden = false;
    console.error(e); return;
  }
  progresso($("progAnalise"), "Desenhando gráficos e gravando os resultados…"); await esperar();
  const figuras = mostrarResultados(ultimo);
  await gravar(ultimo, figuras);
  progresso($("progAnalise"));
  recolher($("secAnalise"), "concluída");
  marcarEtapa(6); mostrar($("secResultados"));
}

// ---------------------------------------------------------- 5. resultados -----
function celulaTela(c) { if (c.t !== "sig") return celTela(c); const s = chip(c.v ? "SIG" : "NS"); s.textContent = celTela(c); return s; }
function mostrarResultados(res) {
  const raiz = $("resultado"); raiz.replaceChildren();
  const figuras = [];
  for (const s of res.secoes) {
    const d = document.createElement("section"); d.className = "analise";
    const h = document.createElement("h3"); h.textContent = s.titulo; d.appendChild(h);
    if (s.resumo) { const p = document.createElement("p"); p.className = "info"; p.textContent = s.resumo.join(" · "); d.appendChild(p); }
    const ul = document.createElement("ul"); ul.className = "conclusoes";
    for (const c of s.conclusoes) { const li = document.createElement("li"); li.textContent = c; ul.appendChild(li); }
    d.appendChild(ul);
    for (const t of s.tabelas) {
      const b = document.createElement("div"); b.className = "bloco-tab";
      const h4 = document.createElement("h4"); h4.textContent = t.titulo;
      const w = document.createElement("div"); w.className = "tabela-rolar";
      const tb = document.createElement("table"); tb.className = "tabela";
      tabelaHTML(tb, t.cab, t.linhas.map((l) => l.map(celulaTela)));
      w.appendChild(tb); b.append(h4, w); d.appendChild(b);
    }
    for (const n of s.notas || []) { const p = document.createElement("p"); p.className = "nota"; p.textContent = n; d.appendChild(p); }
    const efeitos = [];                 // graficos de efeitos (principais e interacoes) desta secao
    for (const f of s.figuras || []) {
      const fig = desenharFigura(f);
      if (!fig) continue;
      if (f.eixoX && !efeitos.length) d.appendChild(barraEixoEfeitos(f, efeitos));
      const b = document.createElement("figure"); b.className = "bloco-fig";
      b.appendChild(fig.canvas);
      if (f.eixoX) efeitos.push({ spec: f, bloco: b, reg: null });
      if (fig.tabela) {
        const det = document.createElement("details"), sm = document.createElement("summary"); sm.textContent = "Ver os números do gráfico";
        const w = document.createElement("div"); w.className = "tabela-rolar"; const tb = document.createElement("table"); tb.className = "tabela";
        tabelaHTML(tb, fig.tabela.cab, fig.tabela.linhas.map((l) => l.map(celulaTela)));
        w.appendChild(tb); det.append(sm, w); b.appendChild(det);
      }
      const reg = { id: f.id, canvas: fig.canvas };
      if (f.eixoX) efeitos[efeitos.length - 1].reg = reg;
      d.appendChild(b); figuras.push(reg);
    }
    raiz.appendChild(d);
  }
  $("log").textContent = res.log.join("\n");
  return figuras;
}

// Botao dos graficos de efeitos: eixo x codificado (−1/+1) ou nos niveis reais informados
// na revisao. Redesenha os graficos da secao e regrava os PNG no destino.
function barraEixoEfeitos(spec, efeitos) {
  const temNiveis = Object.values(spec.fatores || {}).some((f) => f.niv);
  const barra = document.createElement("div"); barra.className = "eixo-efeitos";
  const rot = document.createElement("span"); rot.textContent = "Eixo x dos gráficos de efeitos:";
  const grupo = document.createElement("div"); grupo.className = "alterna"; grupo.setAttribute("role", "group"); grupo.setAttribute("aria-label", "Eixo x dos gráficos de efeitos");
  const bts = [["codificado", "Codificado (−1 / +1)"], ["real", "Níveis reais"]].map(([modo, txt]) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "sec"; b.textContent = txt; b.dataset.modo = modo;
    b.setAttribute("aria-pressed", String(spec.eixoX === modo));
    if (modo === "real" && !temNiveis) { b.disabled = true; b.title = "Informe os níveis −1 e +1 dos fatores na revisão"; }
    b.addEventListener("click", async () => {
      bts.forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      for (const e of efeitos) {
        e.spec.eixoX = modo;
        const nova = desenharFigura(e.spec);
        e.bloco.replaceChild(nova.canvas, e.reg.canvas); e.reg.canvas = nova.canvas;
        if (destino) { try { await destino.gravar(`${e.reg.id}.png`, await paraPNG(nova.canvas)); } catch (err) { console.error(err); } }
      }
      painelGrav?.concluir();
    });
    return b;
  });
  grupo.append(...bts); barra.append(rot, grupo);
  if (!temNiveis) { const p = document.createElement("span"); p.className = "nota"; p.textContent = "Para ver os níveis reais, informe os níveis −1 e +1 dos fatores na revisão."; barra.appendChild(p); }
  return barra;
}

let destino = null, painelGrav = null;
async function gravar(res, figuras) {
  destino = null; painelGrav = null;
  try { destino = await criarDestino(pasta, nomeRodada()); }
  catch (e) { $("destinoInfo").textContent = `Não foi possível criar a pasta de resultados (${e.message}). Use "Baixar tudo em .zip".`; destino = await criarDestino(null, nomeRodada()); }
  // pasta escolhida: os arquivos ja vao para o disco, sem .zip; o painel mostra cada gravacao (igual ao modulo eletrico)
  const naPasta = destino.modo === "pasta";
  painelGrav = naPasta ? painelGravacao($("statusGravacao"), destino, `${pasta.name}/${destino.nome}`, "Tabelas, gráficos e relatório desta análise.") : null;
  if (!naPasta) $("statusGravacao").hidden = true;
  $("btZip").hidden = naPasta; $("destinoInfo").hidden = naPasta;
  const falhas = [], arqs = [];
  for (const s of res.secoes) for (const t of s.tabelas) arqs.push([`${t.id}.csv`, csvTabela(t)]);
  for (const f of figuras) arqs.push([`${f.id}.png`, () => paraPNG(f.canvas)]);
  arqs.push(["relatorio.txt", res.log]);
  for (const [nome, c] of arqs) {
    try { await destino.gravar(nome, typeof c === "function" ? await c() : c); } catch (e) { falhas.push(`${nome} (${e.message})`); }
  }
  const n = destino.arquivos.size;
  $("destinoInfo").textContent = (destino.modo === "pasta" ? `${n} arquivo(s) gravado(s) em ${pasta.name}/${destino.nome}.` : `${n} arquivo(s) prontos para baixar em ${destino.nome}.zip.`)
    + (falhas.length ? ` ERRO ao gravar: ${falhas.join(", ")}. Se o arquivo estiver aberto (ex.: no Excel), feche-o e analise de novo.` : "");
  painelGrav?.concluir();
}

// --------------------------------------------------------------- inicio -----
function iniciar() {
  $("versao").textContent = `Versão ${VERSAO}.`;
  if (!temPastaDireta) { $("avisoNavegador").textContent = "Este navegador não grava direto em pasta: os resultados ficam num .zip para baixar. Chrome ou Edge no computador gravam direto na pasta escolhida."; $("avisoNavegador").hidden = false; }
  marcarEtapa(1);
  $("btTipo").addEventListener("click", escolherTipo);
  ligarArquivos($("soltar"), $("arquivos"), $("listaArq"), async (a) => { if (a.length) carregarTexto(await a[0].text(), a[0].name); });
  ligarPasta({ chave: "pasta-estatistica", blocoDireto: $("pastaDireta"), blocoZip: $("pastaZip"), btEscolher: $("btPasta"),
    btLembrada: $("btPastaLembrada"), rotulo: $("pastaAtual"), erro: $("erroDados"), aoDefinir: (h) => { pasta = h; } });
  $("btExemplo").addEventListener("click", carregarExemplo);
  $("selExemplo").addEventListener("change", mostrarFonteExemplo);
  $("btColar").addEventListener("click", () => carregarTexto($("txtDados").value, "dados colados"));
  $("btGerar").addEventListener("click", gerarMatriz);
  $("btUsarMatriz").addEventListener("click", usarMatriz);
  $("btDados").addEventListener("click", () => {
    if (!tab) return;
    recolher($("secDados"), `${nomeArquivo}: ${tab.linhas.length} linhas`, () => { marcarEtapa(2); ["secRevisar", "secAnalise", "secResultados"].forEach((s) => { $(s).hidden = true; }); });
    expandir($("secRevisar")); montarRevisao(); marcarEtapa(3); mostrar($("secRevisar"));   // expandir antes: ele reexibe todos os blocos
  });
  $("btTodosTermos").addEventListener("click", () => $("termos").querySelectorAll("input").forEach((i) => { i.checked = true; }));
  $("btAnalisar").addEventListener("click", analisar);
  $("btVoltarRevisar").addEventListener("click", () => { expandir($("secRevisar")); marcarEtapa(3); mostrar($("secRevisar")); });
  $("btZip").addEventListener("click", async () => { if (destino) baixar(await destino.zip(), destino.nome + ".zip"); });
  $("btNova").addEventListener("click", () => {
    ["secDados", "secRevisar", "secAnalise", "secResultados"].forEach((s) => { $(s).hidden = true; expandir($(s)); });
    expandir($("secTipo")); marcarEtapa(1); mostrar($("secTipo"));
  });
}

iniciar();
