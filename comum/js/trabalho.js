// trabalho.js - Web Worker comum aos modulos: le o arquivo e analisa as faixas fora
// da pagina, para a interface nao travar. Uso: trabalho.js?m=forcas | ?m=eletrica.
// Guarda o ensaio atual (preparar) para as faixas seguintes (analisar).
const m = new URL(self.location.href).searchParams.get("m");
const carregando = import(m === "forcas" ? "../../forcas/js/analise.js" : "../../eletrica/js/analise.js");
let E = null;

// registrado ja, antes do import terminar: mensagens que chegam antes nao se perdem
self.onmessage = async ({ data: { id, tipo, args } }) => {
  let A;
  try { A = await carregando; } catch { self.postMessage({ id, indisponivel: true }); return; }
  const log = [];
  try {
    const r = tipo === "preparar" ? (E = A.prepararEnsaio(await args.arquivo.text(), args.nome, args.p, log))
      : A.analisarFaixa(E, args.c1, args.c2, args.rotulo, args.p, args.op, log);
    self.postMessage({ id, ok: true, r, log });
  } catch (e) {
    self.postMessage({ id, ok: false, erro: e.message, log });
  }
};
