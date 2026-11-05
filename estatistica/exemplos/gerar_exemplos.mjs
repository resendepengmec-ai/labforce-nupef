// gerar_exemplos.mjs - gera exemplos.js a partir dos .csv desta pasta (a CSP da pagina bloqueia fetch).
// Uso: node estatistica/exemplos/gerar_exemplos.mjs
import { readFileSync, writeFileSync } from "node:fs";

const ARQUIVOS = { anova: "exemplo_anova_univariado.csv", manova: "exemplo_manova.csv", fatorial: "exemplo_2k_fatorial.csv", ccd: "exemplo_ccd.csv" };

// Exemplos da bibliografia do curso "Planejamento e Otimizacao de Experimentos"
// (Prof. Anselmo E. de Oliveira, PPGQ/IQ-UFG), extraidos das notas de aula.
const ANSELMO = "notas de aula de Planejamento e Otimização de Experimentos, Prof. Anselmo E. de Oliveira (IQ/UFG)";
const BIBLIOGRAFIA = [
  { id: "plasma", tipo: "anova", arquivo: "bibliografia/montgomery_plasma_anova.csv",
    nome: "Corrosão por plasma: taxa × potência de RF (Montgomery)",
    fonte: `MONTGOMERY (2012), p. 66; ${ANSELMO}, aula 4 (ANOVA). Taxa de corrosão em Å/min, 5 réplicas por potência. Esperado: F = 66,80 e todas as médias diferentes no Tukey.` },
  { id: "planta_piloto", tipo: "fatorial", arquivo: "bibliografia/box_planta_piloto_2k.csv",
    nome: "Planta piloto 2³ com réplica: rendimento (Box, Hunter e Hunter)",
    fonte: `BOX; HUNTER; HUNTER (2005), exemplo da planta piloto; ${ANSELMO}, aula 6 (fatoriais). Catalisador codificado: −1 = A, +1 = B. Esperado: T, C e a interação T×K significativas.` },
  { id: "filtracao", tipo: "fatorial", arquivo: "bibliografia/montgomery_filtracao_2k.csv",
    nome: "Taxa de filtração 2⁴ sem réplica (Montgomery)",
    fonte: `MONTGOMERY (2012), p. 257; ${ANSELMO}, aula 6. A temperatura, B pressão, C formaldeído, D agitação, codificados. Sem réplica: o módulo usa o método de Lenth. Esperado: A, C, D, AC e AD ativos.` },
  { id: "rendimento_ccd", tipo: "ccd", arquivo: "bibliografia/montgomery_rendimento_ccd.csv",
    nome: "Rendimento × tempo e temperatura, CCD 2 fatores (Montgomery)",
    fonte: `MONTGOMERY (2012), cap. 11 (superfície de resposta); ${ANSELMO}, aula 9 (RSM). Codificado: x1 = (t − 90)/10 min, x2 = (T − 145)/5 °C. Esperado: ŷ = 87,375 − 1,384x1 + 0,362x2 − 2,144x1² − 3,094x2² − 4,875x1x2.` },
  { id: "alecrim", tipo: "ccd", arquivo: "bibliografia/oliveira_alecrim_ccd.csv",
    nome: "Extração de antioxidantes do alecrim, CCD 3 fatores (Oliveira et al., 2016)",
    fonte: `OLIVEIRA et al. (2016), Food Chemistry 211, p. 465-473, tabela 1; trabalho do Prof. Anselmo indicado no curso. Valores reais (axiais ±1,682 arredondados no artigo). Respostas: teores extraídos (% m/m) de ácido rosmarínico (AR), carnosol (COH), ácido carnósico (AC) e rendimento.` },
];

const ler = (a) => readFileSync(new URL(a, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const exemplos = Object.fromEntries(Object.entries(ARQUIVOS).map(([k, a]) => [k, ler(a)]));
const biblio = BIBLIOGRAFIA.map((e) => ({ ...e, csv: ler(e.arquivo) }));
const js = `// exemplos.js - GERADO por gerar_exemplos.mjs a partir dos .csv desta pasta (a CSP da pagina bloqueia fetch).
// teste_estatistica.js confere que o conteudo e igual ao dos arquivos.
export const ARQUIVOS = ${JSON.stringify(ARQUIVOS)};
export const EXEMPLOS = {
${Object.entries(exemplos).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join("\n")}
};
// exemplos da bibliografia: {id, tipo, nome, fonte, arquivo, csv}
export const BIBLIOGRAFIA = [
${biblio.map((e) => `  ${JSON.stringify(e)},`).join("\n")}
];
`;
writeFileSync(new URL("exemplos.js", import.meta.url), js);
console.log(`exemplos.js: ${Object.keys(exemplos).length} exemplos do módulo + ${biblio.length} da bibliografia`);
