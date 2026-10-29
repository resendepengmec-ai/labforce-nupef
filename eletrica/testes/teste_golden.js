// teste_golden.js - compara a versao web com as saidas de referencia do Scilab v5.3.3
// (testes/golden/*.txt, geradas por testes/golden.sce). Rodar: node testes/teste_golden.js
import { readFileSync, existsSync } from "node:fs";
import { prepararEnsaio, analisarFaixa, PADRAO } from "../js/analise.js";
import { mediaMovelCiclos, rnd } from "../js/nucleo.js";
import { sprintf } from "../js/formato.js";

const dir = new URL(".", import.meta.url).pathname;
const arqs = ["E1R1", "E8R1", "S800", "S1000_instavel", "S2000", "S333"];
const op = { fft: true, ieee519: true, ieee1459: true };
let falhas = 0, linhas = 0, difTexto = 0;

// numeros com tolerancia relativa; textos iguais
function compara(a, b, tolRel) {
  const ta = a.split(/([;\s]+)/), tb = b.split(/([;\s]+)/);
  if (ta.length !== tb.length) return false;
  for (let i = 0; i < ta.length; i++) {
    if (ta[i] === tb[i]) continue;
    const x = Number(ta[i].replace(",", ".")), y = Number(tb[i].replace(",", "."));
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    const dec = (ta[i].split(/[.,]/)[1] || "").length;       // 1 unidade na ultima casa impressa
    if (Math.abs(x - y) > Math.max(tolRel * Math.abs(y), 1.01 * 10 ** -dec)) return false;
  }
  return true;
}

// E1R1 e E8R1 sao ensaios reais: ficam fora do repositorio publico. Para
// valida-los, copie os .txt para testes/dados (o .gitignore impede o commit).
for (const a of arqs) {
  if (!existsSync(`${dir}dados/${a}.txt`) || !existsSync(`${dir}golden/${a}.txt`)) { console.log(`(sem dados/golden de ${a}: comparacao pulada)`); continue; }
  const ref = readFileSync(`${dir}golden/${a}.txt`, "utf8").split(/\r?\n/).filter((l) => l !== "");
  const log = [];
  const E = prepararEnsaio(readFileSync(`${dir}dados/${a}.txt`, "utf8"), a, PADRAO, log);
  const out = [];
  out.push(sprintf("fs %.10g fsBruta %.10g varFs %.6f regra %s", E.fs, E.fsBruta, E.varFs, E.regra).trimEnd());
  const N = E.N, P = E.Pinst;
  out.push(sprintf("Pinst %.8e %.8e %.8e", P[0], P[rnd(N / 2) - 1], P[N - 1]));
  const F = [[rnd(0.1 * N), rnd(0.8 * N)], [rnd(0.5 * N), rnd(0.5 * N) + rnd(2.5 * E.fs)]];
  F.forEach(([c1, c2], j) => {
    const rot = `${a}_f${j + 1}`;
    const R = analisarFaixa(E, c1 - 1, c2 - 1, rot, PADRAO, op, log);
    const { eV, eI } = R;
    out.push(sprintf("fft %s f1 %.8f A1 %.8f %.8f %.8f I1 %.8f %.8f %.8f VI %.6f %.6f %.6f dVb %.6f dVc %.6f k %d",
      rot, R.f1, eV[0].A1, eV[1].A1, eV[2].A1, eI[0].A1, eI[1].A1, eI[2].A1, ...R.defVI, R.defVbVa, R.defVcVa, eV[0].k));
    out.push("519 " + R.linha519);
    out.push(...R.arquivos[rot + "_IEEE519_harmonicos.csv"].map((l) => "H " + l));
    out.push("1459 " + R.linha1459);
    const b = R.r59.blocos[R.r59.blocos.length - 1];
    out.push(sprintf("1459b %d %.6f %.6f %.6f %.6f", R.r59.nB, b.P, b.Se, b.FDv, b.THDeI));
    out.push("dados " + R.linhaDados);
  });
  if (out.length !== ref.length) { console.log(`${a}: ${out.length} linhas, referencia ${ref.length}`); falhas++; }
  for (let i = 0; i < Math.min(out.length, ref.length); i++) {
    linhas++;
    if (out[i] !== ref[i].trimEnd()) difTexto++;
    if (!compara(out[i], ref[i].trimEnd(), 1e-6)) {
      falhas++;
      console.log(`${a} linha ${i + 1}\n  web    : ${out[i]}\n  scilab : ${ref[i]}`);
    }
  }
}
console.log(`teste_golden: ${linhas} linhas comparadas, ${linhas - difTexto} identicas, ${falhas} divergencia(s) acima da tolerancia`);
if (falhas) process.exit(1);
