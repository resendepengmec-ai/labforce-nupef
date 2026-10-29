// saida.js - gravacao dos resultados no computador do usuario, sem servidor.
//  - Chrome/Edge (File System Access API): o usuario escolhe a pasta uma vez;
//    o acesso fica lembrado neste navegador (IndexedDB) e cada rodada cria
//    resultados_AAAAMMDD_hhmmss dentro dela. Cada arquivo e gravado assim que
//    fica pronto (um erro no ensaio seguinte nao perde os anteriores).
//  - Outros navegadores: os mesmos arquivos vao para um .zip baixado ao final
//    de cada ensaio e da rodada.
// Nada sai do computador: nao ha envio de dados para a rede.

export const temPastaDireta = typeof window !== "undefined" && "showDirectoryPicker" in window;

// ---- IndexedDB: lembrar a pasta escolhida -------------------------------
function bd() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open("labforce-nupef", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("cfg");
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function bdGet(chave) {
  try {
    const db = await bd();
    return await new Promise((ok) => {
      const r = db.transaction("cfg").objectStore("cfg").get(chave);
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(undefined);
    });
  } catch { return undefined; }
}
async function bdSet(chave, valor) {
  try {
    const db = await bd();
    await new Promise((ok) => {
      const t = db.transaction("cfg", "readwrite"); t.objectStore("cfg").put(valor, chave);
      t.oncomplete = ok; t.onerror = ok;
    });
  } catch { /* sem IndexedDB: so nao lembra a pasta */ }
}

// Pasta lembrada (sem pedir permissao ainda): devolve o handle ou null
export async function pastaLembrada(chave = "pasta") {
  if (!temPastaDireta) return null;
  const h = await bdGet(chave);
  return h && typeof h.queryPermission === "function" ? h : null;
}

// Pede (ou confirma) permissao de escrita; precisa de um clique do usuario
export async function garantirPermissao(h) {
  const o = { mode: "readwrite" };
  if ((await h.queryPermission(o)) === "granted") return true;
  return (await h.requestPermission(o)) === "granted";
}

export async function escolherPasta(chave = "pasta") {
  const h = await window.showDirectoryPicker({ id: chave.replace(/[^a-z0-9_-]/gi, "-"), mode: "readwrite", startIn: "documents" });
  await bdSet(chave, h);
  return h;
}

export function nomeRodada(d = new Date()) {
  const z = (n) => String(n).padStart(2, "0");
  return `resultados_${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`;
}

// Converte o conteudo para bytes: texto (array de linhas -> CRLF), Blob ou bytes
export async function paraBytes(c) {
  if (c instanceof Uint8Array) return c;
  if (typeof Blob !== "undefined" && c instanceof Blob) return new Uint8Array(await c.arrayBuffer());
  const txt = Array.isArray(c) ? c.join("\r\n") + "\r\n" : String(c);
  return new TextEncoder().encode(txt);
}

// Destino de uma rodada: grava arquivos na subpasta (modo pasta) ou guarda para o zip
export async function criarDestino(pastaRaiz, nome) {
  const arquivos = new Map();              // copia em memoria (zip e reenvio)
  let sub = null;
  if (pastaRaiz) sub = await pastaRaiz.getDirectoryHandle(nome, { create: true });
  return {
    nome,
    modo: sub ? "pasta" : "zip",
    arquivos,
    async gravar(arq, conteudo) {
      const bytes = await paraBytes(conteudo);
      arquivos.set(arq, bytes);
      if (sub) {
        const fh = await sub.getFileHandle(arq, { create: true });
        const w = await fh.createWritable();
        await w.write(bytes); await w.close();
      }
    },
    async zip(filtro) {
      const lista = [...arquivos].filter(([n]) => !filtro || filtro(n)).map(([n, d]) => ({ nome: `${nome}/${n}`, dados: d }));
      return criarZip(lista);
    },
  };
}

export function baixar(blob, nome) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}

// ---- ZIP sem compressao (STORE), sem dependencias ------------------------
const tabelaCRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b) {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = tabelaCRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export async function criarZip(arquivos) {
  const enc = new TextEncoder(), partes = [], central = [];
  let pos = 0;
  const d = new Date();
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const { nome, dados } of arquivos) {
    const n = enc.encode(nome), crc = crc32(dados), tam = dados.length;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
    lh.setUint16(8, 0, true); lh.setUint16(10, hora, true); lh.setUint16(12, data, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, tam, true); lh.setUint32(22, tam, true);
    lh.setUint16(26, n.length, true); lh.setUint16(28, 0, true);
    partes.push(new Uint8Array(lh.buffer), n, dados);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, hora, true);
    ch.setUint16(14, data, true); ch.setUint32(16, crc, true); ch.setUint32(20, tam, true);
    ch.setUint32(24, tam, true); ch.setUint16(28, n.length, true);
    ch.setUint32(42, pos, true);
    central.push(new Uint8Array(ch.buffer), n);
    pos += 30 + n.length + tam;
  }
  const tamC = central.reduce((s, p) => s + p.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true); fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true); fim.setUint32(12, tamC, true); fim.setUint32(16, pos, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)], { type: "application/zip" });
}
