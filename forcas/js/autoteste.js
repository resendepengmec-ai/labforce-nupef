// autoteste.js - verificacao do modulo de forcas com sinais de resposta conhecida.
// Roda no navegador (manual, secao 6) e no Node (testes/teste_forcas.js).
import { lerArquivo, taxaDoTempo, estatistica, freqDominante, corteTeorico, vcDeDn, mapaValido } from "./nucleo.js";
import { prepararEnsaio, analisarFaixa, PADRAO } from "./analise.js";
import { fft } from "../../comum/js/fft.js";
import { DINAMOMETROS, verificarFaixa, PADRAO_DINAMOMETRO } from "./dinamometros.js";

export async function autoteste() {
  let nOK = 0;
  const falhas = [];
  const ok = (c, msg) => { if (c) nOK++; else falhas.push(msg); };
  const perto = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol * Math.max(Math.abs(b), 1e-12), `${msg}: ${a} != ${b}`);

  // FFT de N qualquer contra DFT direta
  for (const N of [64, 97, 1000]) {
    const x = Float64Array.from({ length: N }, (_, i) => Math.sin(i * 0.37) + (i % 5) / 7);
    const X = fft(x); let err = 0;
    for (let k = 0; k < N; k++) { let r = 0, im = 0;
      for (let n = 0; n < N; n++) { const a = -2 * Math.PI * k * n / N; r += x[n] * Math.cos(a); im += x[n] * Math.sin(a); }
      err = Math.max(err, Math.hypot(X.re[k] - r, X.im[k] - im)); }
    ok(err < 1e-9 * N, `FFT N=${N}`);
  }

  // leitura DynoWare: metadados, tab, virgula decimal; calibracao multiplica o sinal
  const txt = "DynoWare\nSample rate: 1000 Hz\nTime\tFf (Fx)\tFp (Fy)\tFc (Fz)\n0,000\t10,5\t3,2\t18,1\n0,001\t11,0\t-3,4\t19,0\n0,002\t9,5\t3,0\t17,0\n";
  const L = lerArquivo(txt, ["tempo", "fx", "fy", "fz"], { fx: 2, fy: 1, fz: 0.5 });
  ok(L.N === 3 && L.ignoradas === 3, "leitura: 3 amostras e 3 linhas de texto");
  ok(L.F.fx[0] === 21 && L.F.fy[1] === -3.4 && L.F.fz[2] === 8.5, "calibracao: fator multiplica o canal");
  perto(L.F.fr[0], Math.hypot(21, 3.2, 9.05), 1e-12, "Fr = raiz da soma dos quadrados");
  const L2 = lerArquivo("1;2;3;4\n5;6;7;8\n", ["fz", "tempo", "ignorar", "fx"].concat([]), { fx: 1, fy: 1, fz: 1 });
  ok(L2.N === 0, "mapa sem Fy: nenhuma amostra");
  ok(mapaValido(["tempo", "fx", "fy", "fz"]) && !mapaValido(["tempo", "fx", "fx", "fz"]), "mapa valido");

  // taxa pela coluna de tempo
  const t = Float64Array.from({ length: 1001 }, (_, i) => 0.5 + i / 2000);
  const tx = taxaDoTempo(t);
  perto(tx.fs, 2000, 1e-9, "fs pela coluna de tempo"); ok(tx.crescente && tx.desvio < 1e-6, "passo regular");

  // estatistica de senoide: media 0, RMS A/raiz2, crista raiz2, curtose 1,5, assimetria 0
  const fs = 1000, N = 4000, A = 10;
  const s = Float64Array.from({ length: N }, (_, i) => A * Math.sin(2 * Math.PI * 50 * i / fs));
  const e = estatistica(s, fs);
  ok(Math.abs(e.media) < 1e-9, "senoide: media 0");
  perto(e.rms, A / Math.SQRT2, 1e-9, "senoide: RMS");
  perto(e.crista, Math.SQRT2, 1e-6, "senoide: fator de crista");
  perto(e.curtose, 1.5, 1e-6, "senoide: curtose 1,5");
  ok(Math.abs(e.assimetria) < 1e-6, "senoide: assimetria 0");
  perto(e.fdom, 50, 1e-4, "senoide: frequencia dominante 50 Hz");
  // frequencia fora da raia e sinal com media alta (corte): 123,4 Hz
  const s2 = Float64Array.from({ length: 3000 }, (_, i) => 800 + 40 * Math.sin(2 * Math.PI * 123.4 * i / 2000));
  perto(freqDominante(s2, 2000).f, 123.4, 2e-3, "frequencia dominante entre raias");
  const c = Float64Array.from({ length: 100 }, () => 5), ec = estatistica(c, 1000);
  ok(ec.dp === 0 && ec.cv === 0 && ec.curtose === 0, "sinal constante: DP 0");

  // forca teorica (Sandvik/Kienzle): ap 2, fn 0,25, kr 90, g0 0, kc1 1500, mc 0,25, vc 200
  const q = corteTeorico({ ap: 2, fn: 0.25, vc: 200, kr: 90, g0: 0, kc1: 1500, mc: 0.25 });
  perto(q.hm, 0.25, 1e-12, "hm = fn sen kr");
  perto(q.kc, 1500 * 0.25 ** -0.25, 1e-12, "kc = kc1 hm^-mc");
  perto(q.Fc, q.kc * 0.5, 1e-12, "Fc = kc ap fn");
  perto(q.Pc, q.Fc * 200 / 60000, 1e-12, "Pc = Fc vc / 60000");
  perto(q.Q, 100, 1e-12, "Q = vc ap fn");
  perto(corteTeorico({ ap: 1, fn: 0.2, vc: 1, kr: 45, g0: 10, kc1: 1000, mc: 0.2 }).kc, 1000 * (0.2 * Math.SQRT1_2) ** -0.2 * 0.9, 1e-12, "kc com kr 45 e g0 10");
  perto(vcDeDn(50, 1000), 157.0796, 1e-6, "vc = pi D n / 1000");

  // fluxo completo: arquivo sintetico, faixa de corte, Fz media = 800 N
  const lin = ["Time\tFf (Fx)\tFp (Fy)\tFc (Fz)"];
  for (let i = 0; i < 6000; i++) {
    const tt = i / 1000, en = tt >= 1 && tt < 5 ? 1 : 0;
    lin.push([tt, en * (300 + 15 * Math.sin(2 * Math.PI * 80 * tt)), en * 150, en * (800 + 40 * Math.sin(2 * Math.PI * 80 * tt))].map((v) => v.toFixed(4).replace(".", ",")).join("\t"));
  }
  const log = [], E = prepararEnsaio(lin.join("\n"), "SINT", { ...PADRAO, k: { fx: 1, fy: 1, fz: 1 } }, log);
  perto(E.fs, 1000, 1e-9, "ensaio: fs 1000 Hz");
  const p = { ...PADRAO, teorico: { ap: 2, fn: 0.25, vc: 200, kr: 90, g0: 0, kc1: 1131.37, mc: 0.25, canal: "fz" } };
  const R = analisarFaixa(E, 1500, 4499, "SINT", p, { teorico: true }, log);
  perto(R.est.fz.media, 800, 1e-3, "ensaio: Fz media 800 N");
  perto(R.est.fz.fdom, 80, 1e-3, "ensaio: frequencia dominante 80 Hz");
  ok(R.linhasResumo.length === 4 && R.arquivos["SINT_faixa.csv"].length === 3001, "ensaio: CSV da faixa e resumo");
  perto(R.teorico.Fc, 800, 1e-3, "ensaio: Fc teorica 800 N (kc1 escolhido)");
  ok(Math.abs(R.teorico.dif) < 0.01, "ensaio: diferenca medida x teorica ~ 0");

  // dinamometro: padrao 9257B; aviso de faixa acima de 90 %
  ok(PADRAO_DINAMOMETRO === "9257B" && DINAMOMETROS["9257B"].faixa.fz[1] === 10, "dinamometro padrao 9257B (Fz ate 10 kN)");
  ok(verificarFaixa("9257B", { fx: -10, fy: -10, fz: -10 }, { fx: 300, fy: 150, fz: 800 }).length === 0, "faixa: 800 N sem aviso");
  ok(verificarFaixa("9257B", { fx: -10, fy: -10, fz: -10 }, { fx: 4600, fy: 150, fz: 800 }).length === 1, "faixa: Fx 4600 N (> 90 % de 5 kN) com aviso");
  const log2 = []; prepararEnsaio(lin.join("\n"), "S2", { ...PADRAO, modelo: "9109AA" }, log2);
  ok(log2.some((l) => /AVISO S2: Fz/.test(l)), "faixa: 800 N no 9109AA (500 N) gera aviso no relatorio");

  return { nOK, falhas };
}
