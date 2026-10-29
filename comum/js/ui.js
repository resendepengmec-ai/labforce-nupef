// ui.js - pecas de interface comuns aos modulos: etapas, secoes recolhidas,
// progresso, lista de arquivos e pasta de resultados.
import { temPastaDireta, pastaLembrada, garantirPermissao, escolherPasta } from "./saida.js";

export const $ = (id) => document.getElementById(id);
export const virg = (x, d) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",") : "-");
export const numero = (s) => { const t = String(s).trim().replace(",", "."); return t === "" ? NaN : Number(t); };
export const esperar = () => new Promise((ok) => setTimeout(ok, 30));

// Etapas: n = etapa atual (1..5); anteriores = feitas
export function marcarEtapa(n) {
  document.querySelectorAll(".etapas li").forEach((li, i) => {
    li.dataset.estado = i + 1 < n ? "feito" : i + 1 === n ? "atual" : "";
    if (i + 1 === n) li.setAttribute("aria-current", "step"); else li.removeAttribute("aria-current");
  });
}

// Recolhe uma secao concluida: mostra so o titulo + resumo e o botao "Alterar"
export function recolher(sec, resumo, aoAlterar) {
  if (!sec.classList.contains("concluido")) {
    for (const filho of sec.children) {
      if (filho.tagName === "H2") continue;
      if (filho.hidden) filho.dataset.oculto = "1"; else delete filho.dataset.oculto;
      filho.hidden = true;
    }
  }
  sec.classList.add("concluido");
  const h2 = sec.querySelector("h2");
  let r = h2.querySelector(".resumo");
  if (!r) { r = document.createElement("span"); r.className = "resumo"; h2.appendChild(r); }
  r.textContent = resumo ? `· ${resumo}` : "";
  let b = h2.querySelector("button.lnk");
  if (aoAlterar) {
    if (!b) { b = document.createElement("button"); b.type = "button"; b.className = "lnk"; b.textContent = "Alterar"; h2.appendChild(b); }
    b.hidden = false; b.onclick = () => { expandir(sec); aoAlterar(); };
  } else if (b) b.hidden = true;
}
export function expandir(sec) {
  sec.classList.remove("concluido");
  for (const filho of sec.children) if (!filho.dataset.oculto) filho.hidden = false;
  const h2 = sec.querySelector("h2"), r = h2.querySelector(".resumo"), b = h2.querySelector("button.lnk");
  if (r) r.textContent = ""; if (b) b.hidden = true;
}
export function mostrar(sec, rolar = true) {
  sec.hidden = false;
  if (rolar) sec.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

// Progresso visivel e anunciado (aria-live)
export function progresso(el, texto) {
  if (texto) { el.textContent = texto; el.hidden = false; document.body.classList.add("ocupado"); }
  else { el.hidden = true; el.textContent = ""; document.body.classList.remove("ocupado"); }
}

// Zona de soltar + input de arquivos; cb(lista ordenada)
export function ligarArquivos(zona, input, listaEl, cb) {
  const definir = (fl) => {
    const arqs = [...fl].filter((f) => f.size > 0).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
    listaEl.replaceChildren();
    for (const f of arqs) {
      const li = document.createElement("li");
      const a = document.createElement("span"); a.textContent = f.name;
      const b = document.createElement("span"); b.textContent = `${Math.max(1, Math.round(f.size / 1024))} kB`;
      li.append(a, b); listaEl.appendChild(li);
    }
    cb(arqs);
  };
  input.addEventListener("change", (e) => definir(e.target.files));
  zona.addEventListener("dragover", (e) => { e.preventDefault(); zona.classList.add("sobre"); });
  zona.addEventListener("dragleave", () => zona.classList.remove("sobre"));
  zona.addEventListener("drop", (e) => { e.preventDefault(); zona.classList.remove("sobre"); definir(e.dataTransfer.files); });
  return () => { input.value = ""; listaEl.replaceChildren(); cb([]); };
}

// Pasta de resultados: botoes "Escolher pasta" e "Usar a pasta X" (lembrada)
export async function ligarPasta({ chave, blocoDireto, blocoZip, btEscolher, btLembrada, rotulo, erro, aoDefinir }) {
  if (!temPastaDireta) { blocoDireto.hidden = true; blocoZip.hidden = false; return; }
  const definir = (h) => { rotulo.textContent = `Resultados em: ${h.name}/resultados_…`; btLembrada.hidden = true; erro.textContent = ""; aoDefinir(h); };
  const h = await pastaLembrada(chave);
  if (h) {
    btLembrada.textContent = `Usar a pasta “${h.name}”`; btLembrada.hidden = false;
    btLembrada.onclick = async () => {
      try { if (await garantirPermissao(h)) definir(h); else erro.textContent = "Permissão de escrita negada para essa pasta. Escolha outra pasta."; }
      catch (e) { erro.textContent = "Não foi possível acessar a pasta lembrada. Escolha a pasta de novo. (" + e.message + ")"; }
    };
  }
  btEscolher.addEventListener("click", async () => {
    try { definir(await escolherPasta(chave)); }
    catch (e) { if (e.name !== "AbortError") erro.textContent = "Não foi possível usar a pasta: " + e.message; }
  });
}

export function chip(st) { const s = document.createElement("span"); s.className = "st st-" + st; s.textContent = st; return s; }

export function tabelaHTML(tab, cab, linhas) {
  tab.replaceChildren();
  const tr = tab.createTHead().insertRow();
  for (const c of cab) { const th = document.createElement("th"); th.textContent = c; th.scope = "col"; tr.appendChild(th); }
  const tb = tab.createTBody();
  for (const l of linhas) {
    const row = tb.insertRow();
    for (const v of l) { const td = row.insertCell(); if (v instanceof Node) td.appendChild(v); else td.textContent = v; }
  }
}
