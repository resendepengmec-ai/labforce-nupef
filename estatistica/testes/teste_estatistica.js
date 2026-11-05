// teste_estatistica.js - roda o autoteste do modulo de estatistica no Node
import { readFileSync } from "node:fs";
import { autoteste } from "../js/autoteste.js";
import { ARQUIVOS, EXEMPLOS, BIBLIOGRAFIA } from "../exemplos/exemplos.js";

const r = await autoteste();
// so no Node: exemplos.js (usado pela pagina) igual aos .csv da pasta exemplos
for (const [k, arq] of Object.entries(ARQUIVOS)) {
  // quebras de linha normalizadas: o git no Windows pode trocar LF por CRLF na copia de trabalho
  const lf = (t) => t.replace(/\r\n/g, "\n");
  const csv = readFileSync(new URL(`../exemplos/${arq}`, import.meta.url), "utf8");
  if (lf(csv) !== lf(EXEMPLOS[k])) r.falhas.push(`exemplos.js difere de ${arq}: rode gerar_exemplos.mjs`); else r.nOK++;
}
for (const e of BIBLIOGRAFIA) {
  const csv = readFileSync(new URL(`../exemplos/${e.arquivo}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  if (csv !== e.csv.replace(/\r\n/g, "\n")) r.falhas.push(`exemplos.js difere de ${e.arquivo}: rode gerar_exemplos.mjs`); else r.nOK++;
}
if (r.falhas.length) { console.log("FALHAS:\n  " + r.falhas.join("\n  ")); process.exit(1); }
console.log(`teste_estatistica: ${r.nOK} verificacoes OK`);
