// tarefa.js - chama a leitura e a analise no Web Worker (trabalho.js), para a pagina
// nao travar com arquivos grandes. Sem Worker (navegador antigo ou falha ao carregar),
// roda as mesmas funcoes aqui mesmo, como antes.
// local: {preparar(args, log), analisar(args, log)} - versao na propria pagina.
// Devolve chamar(tipo, args) -> Promise<{r, log}>; em erro, a excecao traz .log.
export function criarTarefa(modulo, local) {
  let w = null, seq = 0;
  const pend = new Map();
  const rodarLocal = async (tipo, args) => {
    const log = [];
    try { return { r: await local[tipo](args, log), log }; } catch (e) { e.log = log; throw e; }
  };
  const desistir = () => {           // Worker indisponivel: o que estava pendente roda aqui
    w = null;
    for (const p of pend.values()) rodarLocal(p.tipo, p.args).then(p.ok, p.erro);
    pend.clear();
  };
  try {
    w = new Worker(new URL(`./trabalho.js?m=${modulo}`, import.meta.url), { type: "module" });
    w.onmessage = ({ data }) => {
      if (data.indisponivel) return desistir();
      const p = pend.get(data.id); if (!p) return;
      pend.delete(data.id);
      if (data.ok) p.ok({ r: data.r, log: data.log });
      else { const e = new Error(data.erro); e.log = data.log; p.erro(e); }
    };
    w.onerror = (e) => { e.preventDefault(); desistir(); };
  } catch { w = null; }
  return (tipo, args) => {
    if (!w) return rodarLocal(tipo, args);
    return new Promise((ok, erro) => {
      const id = ++seq;
      pend.set(id, { ok, erro, tipo, args });
      w.postMessage({ id, tipo, args });
    });
  };
}
