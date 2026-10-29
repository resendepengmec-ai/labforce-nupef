// teste_unidades.js - testes das funcoes (porte de teste_funcoes.sce + FFT e formatos)
// Rodar: node testes/teste_unidades.js
import { fft } from "../js/fft.js";
import { sprintf } from "../js/formato.js";
import {
  valorRMS, grandezasEletricas, espectroFFT, difFase, mediaMovelCiclos, tempo2indice,
  percentil, ciclosSincronos, arredondaFs, detectaFs, lerArquivoESP32, rnd, definirAviso,
} from "../js/nucleo.js";
import { limitesCorrenteIEEE519, limitesTensaoIEEE519, analiseIEEE519 } from "../js/ieee519.js";
import { analiseIEEE1459 } from "../js/ieee1459.js";
import { criarZip } from "../js/saida.js";

let nOK = 0;
const ok = (c, msg) => { if (!c) throw new Error("FALHOU: " + msg); nOK++; };
const perto = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-300), `${msg}: ${a} != ${b}`);
definirAviso(() => {});

// FFT contra DFT direta (N potencia de 2, primo, composto)
for (const N of [8, 64, 97, 250, 333, 1200]) {
  const x = Float64Array.from({ length: N }, (_, i) => Math.sin(i * 0.37) + 0.3 * Math.cos(i * 1.9) + (i % 7) / 10);
  const X = fft(x);
  let err = 0;
  for (let k = 0; k < N; k++) {
    let r = 0, im = 0;
    for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; r += x[n] * Math.cos(a); im += x[n] * Math.sin(a); }
    err = Math.max(err, Math.hypot(X.re[k] - r, X.im[k] - im));
  }
  ok(err < 1e-9 * N, `FFT N=${N} erro ${err}`);
}

// formatos (msprintf)
ok(sprintf("%.6g", 333.3333333) === "333.333", "%g");
ok(sprintf("%.6g", 250) === "250", "%g inteiro");
ok(sprintf("%5.2f|%6.1f|%04d", 3.14159, -2.25, 7) === " 3.14|  -2.2|0007" || sprintf("%5.2f|%6.1f|%04d", 3.14159, -2.25, 7) === " 3.14|  -2.3|0007", "largura");
ok(sprintf("%g", 10) === "10" && sprintf("%g", 1e-5) === "1e-05", "%g exp");
ok(sprintf("%d %%", 2.5) === "3 %", "%d arredonda");

// valorRMS
perto(valorRMS([3, 4, NaN]), Math.sqrt(12.5), 1e-12, "valorRMS"); ok(Number.isNaN(valorRMS([5])), "valorRMS 1 amostra");

// grandezas: trifasico equilibrado, 311 V pico, 10 A pico, 60 graus
const fs = 250, N = 7500, w = 2 * Math.PI * 60, fi = Math.PI / 3;
const sinal = (A, ph, f = (a) => Math.sin(a)) => Float64Array.from({ length: N }, (_, i) => A * f(w * i / fs + ph));
const V = [0, 1, 2].map((k) => sinal(311, -2 * Math.PI * k / 3)), I = [0, 1, 2].map((k) => sinal(10, -2 * Math.PI * k / 3 - fi));
const g = grandezasEletricas(...V, ...I);
perto(g.Pt, 3 * 311 * 10 / 2 * Math.cos(fi), 1e-3, "Pt"); perto(g.FP, 0.5, 1e-3, "FP"); perto(g.Fi, 60, 1e-3, "Fi");

// espectroFFT: frequencia fora da raia, amplitude, defasagem
const x = Float64Array.from({ length: N }, (_, i) => 311 * Math.sin(2 * Math.PI * 60.023 * i / fs));
const y = Float64Array.from({ length: N }, (_, i) => 10 * Math.sin(2 * Math.PI * 60.023 * i / fs - fi));
const ev = espectroFFT(x, fs, 60), ei = espectroFFT(y, fs, 60, ev.k);
perto(ev.f1, 60.023, 1e-5, "f1"); perto(ev.A1, 311, 1e-3, "A1"); perto(difFase(ev.ph1, ei.ph1), 60, 1e-3, "fase");

// media movel de 30 ciclos anula o ripple de 120 Hz
const p = Float64Array.from({ length: N }, (_, i) => 500 + 300 * Math.cos(2 * w * i / fs));
const pm = mediaMovelCiclos(p, fs, 60, 6);
ok(pm.slice(100, N - 100).every((v) => Math.abs(v - 500) < 1e-9), "media movel");

// indices, percentil, limites
ok([-3, 0, 0.2, 1e9].map((t) => tempo2indice(t, 250, 100)).join() === "0,0,50,99", "tempo2indice");
perto(percentil(Array.from({ length: 100 }, (_, i) => i + 1), 99), 99.01, 1e-9, "percentil");
const L = limitesCorrenteIEEE519([2, 5, 8, 11, 23, 35], 10);
ok(L.limI.join() === "2,4,4,2,0.6,0.3" && L.limTDD === 5, "limites corrente");
ok(limitesTensaoIEEE519(380).limVh === 5 && limitesTensaoIEEE519(380).limTHD === 8, "limites tensao");

// taxas: janelas sincronas e arredondamento
ok(ciclosSincronos(250, 60, 12).Nw === 50 && ciclosSincronos(1e6 / 3000, 60, 12).m === 9, "ciclosSincronos");
for (const [b, fsE] of [[250.4, 250], [799.1, 800], [1002, 1000], [333.1, 1e6 / 3000], [1005.2, 1005], [6401, 6400]]) {
  perto(arredondaFs(b, 0.003).fs, fsE, 1e-9, `arredondaFs ${b}`);
}
// deteccao em sinal sintetico a 800 Hz, rede 60,02 Hz
const s800 = Float64Array.from({ length: 800 * 30 }, (_, i) => Math.sin(2 * Math.PI * 60.02 * i / 800));
const d8 = detectaFs(s800, 60); ok(d8.fs === 800 && d8.varFs < 0.5, "detectaFs 800");

// IEEE 519 a 7680 Hz: uma ordem por grupo, decisao direta
const fs2 = 7680, N2 = 6 * fs2, a2 = (i) => 2 * Math.PI * 60 * i / fs2;
const V2 = [0, 1, 2].map(() => Float64Array.from({ length: N2 }, (_, i) => 311 * Math.sin(a2(i))));
const I2 = [0, 1, 2].map(() => Float64Array.from({ length: N2 }, (_, i) => 2 * Math.SQRT2 * (Math.sin(a2(i)) + 0.04 * Math.sin(5 * a2(i)) + 0.05 * Math.sin(13 * a2(i)))));
const q2 = analiseIEEE519(V2, I2, fs2, 60, 60, 10, NaN);
ok(q2.grupos.length === 49 && q2.stI[3] === "ATENDE" && q2.stI[11] === "EXCEDE", "IEEE 519 7680 Hz");

// IEEE 1459: carga equilibrada, PF = 0,5 e In = 0
const r = analiseIEEE1459(V, I, fs, 60, 60);
perto(r.tot.P, 3 * 311 * 10 / 2 * 0.5, 1e-6, "1459 P"); perto(r.tot.PF, 0.5, 1e-6, "1459 PF");
ok(r.tot.In < 1e-6 && r.tot.FDv < 1e-6, "1459 In e V-/V+");

// leitura: cabecalho de texto, tab, ponto e virgula
const m = lerArquivoESP32("ESP32 ensaio\nVa Vb Vc Ia Ib Ic\n1\t2\t3\t4\t5\t6\r\n7;8;9;10;11;12\n");
ok(m.cols[0].length === 2 && m.cols[5][1] === 12 && m.ignoradas === 2, "leitura");
ok(rnd(-2.5) === -3 && rnd(2.5) === 3, "round do Scilab");

// zip (fallback): assinatura e diretorio central
const z = await criarZip([{ nome: "a/b.txt", dados: new TextEncoder().encode("abc") }]);
const zb = new Uint8Array(await z.arrayBuffer());
ok(zb[0] === 0x50 && zb[1] === 0x4b && zb.length > 100, "zip");

console.log(`teste_unidades: ${nOK} verificacoes OK`);
