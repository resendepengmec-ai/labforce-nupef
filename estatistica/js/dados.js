// dados.js - leitura de CSV/TXT e montagem dos dados de cada analise.
// Separador ";", "," ou tab (detectado no cabecalho); virgula decimal aceita; aspas
// ("12,5" e "a""b"); BOM e linhas vazias ignorados. Numero so quando o texto inteiro e
// numero: "12abc" e "1,2,3" sao rejeitados (o eStat aceitava como 12 e 1,2).

const NUMERO = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/;
export function numeroCSV(s) {
  const t = String(s ?? "").trim();
  return NUMERO.test(t) ? Number(t.replace(",", ".")) : NaN;
}

function dividir(linha, sep) {
  const campos = [];
  let atual = "", aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { campos.push(atual.trim()); atual = ""; }
    else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

// Devolve {colunas: [nomes], linhas: [[texto]], sep}. Erros com o que corrigir.
export function lerCSV(texto) {
  const linhas = String(texto).replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (linhas.length < 2) throw new Error("o arquivo precisa de um cabeçalho e pelo menos uma linha de dados.");
  const cab = linhas[0];
  const sep = cab.includes(";") ? ";" : cab.includes("\t") ? "\t" : ",";
  const colunas = dividir(cab, sep).map((c, i) => c || `coluna ${i + 1}`);
  const repetidas = colunas.filter((c, i) => colunas.indexOf(c) !== i);
  if (repetidas.length) throw new Error(`nomes de coluna repetidos no cabeçalho: ${[...new Set(repetidas)].join(", ")}.`);
  const dados = linhas.slice(1).map((l, i) => {
    const c = dividir(l, sep);
    if (c.length !== colunas.length) throw new Error(`a linha ${i + 2} tem ${c.length} campo(s); o cabeçalho tem ${colunas.length}. Confira o separador (${sep === "\t" ? "tab" : sep}).`);
    return c;
  });
  return { colunas, linhas: dados, sep };
}

// Coluna como numeros; lanca erro apontando a primeira celula invalida
export function colunaNumerica(tab, nome) {
  const j = tab.colunas.indexOf(nome);
  if (j < 0) throw new Error(`coluna "${nome}" não encontrada.`);
  return tab.linhas.map((l, i) => {
    const v = numeroCSV(l[j]);
    if (!Number.isFinite(v)) throw new Error(`a coluna "${nome}" tem um valor não numérico na linha ${i + 2}: "${l[j]}".`);
    return v;
  });
}
export const ehNumerica = (tab, nome) => { const j = tab.colunas.indexOf(nome); return tab.linhas.every((l) => Number.isFinite(numeroCSV(l[j]))); };

// Grupos da ANOVA: [{nome, valores}] na ordem em que aparecem
export function gruposDe(tab, colFator, colResp) {
  const jf = tab.colunas.indexOf(colFator), y = colunaNumerica(tab, colResp), mapa = new Map();
  tab.linhas.forEach((l, i) => { const g = l[jf]; if (!mapa.has(g)) mapa.set(g, []); mapa.get(g).push(y[i]); });
  return [...mapa].map(([nome, valores]) => ({ nome, valores }));
}
