// legendas.mjs - gera apresentacao.vtt (legendas para YouTube/players) a partir de narracao.tsv.
// Cada legenda vai do seu inicio ate 0,2 s antes da seguinte (a ultima, ate o fim do video).
//   node ferramentas/video/legendas.mjs [duracao_do_video_s]
import { readFileSync, writeFileSync } from "node:fs";
const dir = new URL(".", import.meta.url);
const fim = Number(process.argv[2] || 76);
const linhas = readFileSync(new URL("narracao.tsv", dir), "utf8").trim().split(/\r?\n/).slice(1)
  .map((l) => { const [ini, txt] = l.split("\t"); return { ini: Number(ini), txt: txt.trim() }; });
const hms = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = (ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${ss.toFixed(3).padStart(6, "0")}`; };
const out = ["WEBVTT", "Language: pt-BR", ""];
linhas.forEach((c, i) => {
  const ate = i + 1 < linhas.length ? linhas[i + 1].ini - 0.2 : fim - 0.3;
  out.push(String(i + 1), `${hms(c.ini)} --> ${hms(ate)}`, c.txt, "");
});
writeFileSync(new URL("apresentacao.vtt", dir), out.join("\n"));
console.log(`ferramentas/video/apresentacao.vtt: ${linhas.length} legendas`);
