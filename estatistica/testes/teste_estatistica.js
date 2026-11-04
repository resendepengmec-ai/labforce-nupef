// teste_estatistica.js - roda o autoteste do modulo de estatistica no Node
import { autoteste } from "../js/autoteste.js";
const r = await autoteste();
if (r.falhas.length) { console.log("FALHAS:\n  " + r.falhas.join("\n  ")); process.exit(1); }
console.log(`teste_estatistica: ${r.nOK} verificacoes OK`);
