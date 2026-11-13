// gerar_ilustracao.mjs - grava img/atrito-modelo.svg (figura estatica do manual) com os valores
// padrao do modelo de atrito (AISI 1045 com WC-6Co) e T = 900 graus C de exemplo.
// Uso: node forcas/testes/gerar_ilustracao.mjs
import { writeFileSync } from "node:fs";
import { svgModeloAtrito } from "../js/ilustracao.js";
import { ATRITO_TERMICO } from "../js/nucleo.js";
writeFileSync(new URL("../img/atrito-modelo.svg", import.meta.url), svgModeloAtrito(ATRITO_TERMICO, 900) + "\n");
console.log("img/atrito-modelo.svg gravado");
