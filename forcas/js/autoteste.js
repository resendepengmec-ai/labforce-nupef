// autoteste.js - verificacao do modulo de forcas com sinais de resposta conhecida.
// Roda no navegador (manual, secao 6) e no Node (testes/teste_forcas.js).
import { lerArquivo, taxaDoTempo, estatistica, freqDominante, corteTeorico, vcDeDn, mapaValido, componentes, compValido, COMPONENTES, atritoMerchant, areaContato, muTermico, ATRITO_TERMICO } from "./nucleo.js";
import { prepararEnsaio, analisarFaixa, PADRAO, avisosAtrito, linhaFerramenta, temFerramenta, textoCSV, CAB_FERRAMENTA } from "./analise.js";
import { fft } from "../../comum/js/fft.js";
import { maxF, minPos } from "../../comum/js/graficos.js";
import { histograma, leituraForma } from "./figuras.js";
import { nv, nv6g } from "../../comum/js/formato.js";
import { nomeUnico } from "../../comum/js/ui.js";
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
  // campo vazio invalida a linha (nao vira 0 N nem desloca as colunas); ", " separa colunas
  const m4 = ["tempo", "fx", "fy", "fz"];
  const L3 = lerArquivo("0,000;10;;30\n0,001\t10\t\t30\t99\n0,002;1;2;3\n", m4);
  ok(L3.N === 1 && L3.ignoradas === 2 && L3.F.fz[0] === 3, "campo vazio: linha ignorada");
  const L4 = lerArquivo("0.000, 1.5, 2, 3\n0.001, 1.5, 2, 4\n", m4);
  ok(L4.N === 2 && L4.F.fx[0] === 1.5 && L4.F.fz[1] === 4, "CSV com virgula e espaco");

  // maximo do grafico com espectro longo: Math.max(...v) estourava a pilha acima de ~100 mil valores
  const grande = [0, 1, 2].map((k) => Float64Array.from({ length: 200000 }, (_, i) => (i === 123456 ? 7 + k : 1)));
  ok(maxF(grande) === 9 && minPos(grande) === 1 && maxF([[NaN, Infinity, -2]]) === 1e-6, "maxF/minPos com 600 mil valores");

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

  // distribuicao: histograma com area 1 e leitura de assimetria/curtose em formas conhecidas
  let sem = 12345; const rnd = () => ((sem = (sem * 1103515245 + 12345) % 2147483648) + 0.5) / 2147483648;
  const gauss = Float64Array.from({ length: 20000 }, () => Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd()) * 10 + 500);
  const expo = Float64Array.from({ length: 20000 }, () => -50 * Math.log(rnd()));
  for (const [nome, y] of [["normal", gauss], ["exponencial", expo], ["senoide", s]]) {
    const h = histograma(y), area = h.d.reduce((a, d) => a + d * h.w, 0);
    perto(area, 1, 1e-9, `histograma ${nome}: área 1`);
    ok(h.x.length >= 10 && h.x.length <= 60, `histograma ${nome}: 10 a 60 classes (${h.x.length})`);
  }
  const eg = estatistica(gauss, 1000), ee = estatistica(expo, 1000);
  ok(/simétrica/.test(leituraForma(eg.assimetria, eg.curtose).a) && /mesocúrtica/.test(leituraForma(eg.assimetria, eg.curtose).k), "normal: simétrica e mesocúrtica");
  ok(/direita/.test(leituraForma(ee.assimetria, ee.curtose).a) && /leptocúrtica/.test(leituraForma(ee.assimetria, ee.curtose).k), "exponencial: cauda à direita e leptocúrtica");
  ok(/platicúrtica/.test(leituraForma(e.assimetria, e.curtose).k), "senoide: platicúrtica");
  ok(histograma(c).d.length === 1, "histograma de sinal constante: 1 classe");

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
  // componentes pela montagem: padrao do torneamento (Fc = Fz, Ff = Fx, Fp = Fy); Fa/Fp
  perto(R.comp.a, 800, 1e-3, "componentes: Fc = Fz media 800 N"); perto(R.comp.b, 300, 1e-3, "componentes: Ff = Fx media 300 N"); perto(R.comp.p, 150, 1e-9, "componentes: Fp = Fy 150 N");
  ok(R.comp.fa > Math.hypot(800, 300) - 0.5 && R.comp.fa < Math.hypot(800, 300) + 0.5, "componentes: Fa ~ raiz(Fc2 + Ff2)");
  perto(R.comp.razao, R.comp.fa / 150, 1e-12, "componentes: razao Fa/Fp");
  ok(R.linhaComp.split(";").length === 13 && R.linhaComp.startsWith("SINT;torneamento;Fc;Fz;"), "componentes: linha do CSV");
  // outra montagem: Fc no canal Fx, Ff em Fy, Fp em Fz; fresamento usa FfN/Ff/Fp
  const Rm = analisarFaixa(E, 1500, 4499, "SINT", { ...p, comp: { a: "fx", b: "fy", p: "fz" } }, {}, []);
  perto(Rm.comp.a, 300, 1e-3, "componentes: mapa trocado, Fc = Fx"); perto(Rm.comp.p, 800, 1e-3, "componentes: mapa trocado, Fp = Fz");
  const Rfz = analisarFaixa(E, 1500, 4499, "SINT", { ...p, tipo: "fresamento", comp: undefined }, {}, []);
  ok(Rfz.comp.rot.a === "FfN" && Rfz.comp.mapa.p === "fz", "componentes: fresamento, padrao FfN = Fx, Ff = Fy, Fp = Fz");
  ok(compValido(COMPONENTES.torneamento.padrao) && !compValido({ a: "fx", b: "fx", p: "fz" }) && !compValido(null), "componentes: mapa precisa usar Fx, Fy e Fz uma vez cada");
  ok(Number.isNaN(componentes({ fx: [3, 3], fy: [4, 4], fz: [0, 0] }, 0, 1, { a: "fx", b: "fy", p: "fz" }).razao), "componentes: Fp nula, razao indefinida");
  perto(componentes({ fx: [3, 3], fy: [4, 4], fz: [-2, -2] }, 0, 1, { a: "fx", b: "fy", p: "fz" }).razao, 2.5, 1e-12, "componentes: Fa 5 N e Fp −2 N, razao 2,5 (modulo de Fp)");
  // atrito na face (Puls; Klocke; Lung, 2014): mu = FT/FN pela transformacao geometrica
  { const a0 = atritoMerchant(800, 300, 0); perto(a0.mu, 0.375, 1e-12, "atrito: g0 = 0, mu = Ff/Fc"); perto(a0.beta, Math.atan(0.375) * 180 / Math.PI, 1e-12, "atrito: beta = arctan(mu)");
    const a6 = atritoMerchant(800, 300, 6), tg = Math.tan(6 * Math.PI / 180); perto(a6.mu, (300 + 800 * tg) / (800 - 300 * tg), 1e-12, "atrito: mu = (Ff + Fc tan g0)/(Fc - Ff tan g0)");
    perto(Math.hypot(a6.FT, a6.FN), Math.hypot(800, 300), 1e-9, "atrito: FT e FN conservam a resultante");
    // ensaio de atrito do artigo: plano inclinado de alfa = 10 graus -> g0 = -80 graus; FN = Fz cos(alfa) + Fy sen(alfa)
    const al = 10 * Math.PI / 180, ae = atritoMerchant(2000, 8000, -80); perto(ae.FN, 8000 * Math.cos(al) + 2000 * Math.sin(al), 1e-9, "atrito: ensaio com alfa 10 graus, FN"); perto(Math.abs(ae.FT), Math.abs(8000 * Math.sin(al) - 2000 * Math.cos(al)), 1e-9, "atrito: ensaio com alfa 10 graus, FT");
    ok(Number.isNaN(atritoMerchant(100, 800, 45).mu), "atrito: FN <= 0, mu indefinido");
    perto(areaContato(1.5, 3, 1, 10), 4.5 / (2 * Math.sin(al)), 1e-12, "atrito: area de contato (eq. 1)");
    perto(muTermico(400), 0.7, 1e-12, "atrito termico: mu0 abaixo de T0"); perto(muTermico(600), 0.7, 1e-12, "atrito termico: mu0 em T0"); perto(muTermico(1500), 0, 1e-12, "atrito termico: zero na fusao");
    perto(muTermico(1050), 0.7 * (1 - 0.5 ** 0.35), 1e-12, "atrito termico: eq. 2 a meio caminho"); ok(muTermico(900) > muTermico(1200) && ATRITO_TERMICO.Tf === 1500, "atrito termico: mu cai com a temperatura");
    const Ra = analisarFaixa(E, 1500, 4499, "SINT", { ...p, atrito: { g0: 0, A: 4, T: 1050 } }, { atrito: true }, []);
    perto(Ra.atrito.mu, Ra.comp.b / Ra.comp.a, 1e-12, "atrito: na faixa, mu = Ff/Fc com g0 = 0"); perto(Ra.atrito.tau, Ra.atrito.FT / 4, 1e-12, "atrito: tensao tangencial media");
    ok(Ra.linhaAtrito.split(";").length === 17 && !analisarFaixa(E, 1500, 4499, "SINT", { ...p, tipo: "fresamento" }, { atrito: true }, []).atrito, "atrito: linha do CSV; nao se aplica ao fresamento"); }
  // ferramenta: registro em CSV e avisos do atrito
  { const fer = { id: "CNMG 120408", material: "metal duro; H13A", revestimento: "=TiN", peca: "AISI 1045", g0: -6, kr: 95, a0: 6, re: 0.8, rb: 30, vb: 0.1 };
    ok(linhaFerramenta(fer) === "CNMG 120408;metal duro, H13A;'=TiN;AISI 1045;-6;95;6;0,8;30;0,1" && linhaFerramenta(fer).split(";").length === CAB_FERRAMENTA.split(";").length, "ferramenta: linha do CSV (sem ; no texto, formula neutralizada)");
    ok(textoCSV("-x") === "'-x" && textoCSV(" a\nb ") === "a, b" && textoCSV(null) === "", "ferramenta: texto livre seguro no CSV");
    ok(temFerramenta(fer) && !temFerramenta({ id: " ", g0: null }) && !temFerramenta(undefined), "ferramenta: so grava quando ha algum campo");
    const q0 = { ...PADRAO.atrito, T: 900 };
    ok(avisosAtrito(fer, q0, { fn: 0.25 }).length === 5 && avisosAtrito({ kr: 90 }, PADRAO.atrito, null).length === 0 && avisosAtrito(undefined, PADRAO.atrito, null).length === 0, "atrito: avisos pela ferramenta (kr, raio de ponta, VB, raio de aresta, modelo padrao)");
    ok(avisosAtrito({}, { ...q0, mu0: 0.5 }, null).length === 0, "atrito: modelo com parametros proprios nao gera aviso");
    const Rv = analisarFaixa(E, 1500, 4499, "SINT", { ...p, ferramenta: fer, atrito: { g0: -6 } }, { atrito: true }, []);
    ok(Rv.atrito.avisos.length === 4 && Rv.atrito.g0 === -6, "atrito: avisos chegam ao resultado da faixa"); }
  // espectro calculado na analise (roda no Web Worker): pico de Fz em 80 Hz
  const Rf = analisarFaixa(E, 1500, 4499, "SINT", p, { fft: true }, []);
  const Y = Rf.espectro.Y.fz; let kmax = 0; for (let i = 1; i < Y.length; i++) if (Y[i] > Y[kmax]) kmax = i;
  perto(Rf.espectro.f[kmax], 80, 0.01, "espectro: pico de Fz em 80 Hz");

  // nv6g rapido = nv(v, "%.6g") (CSV da faixa), inclusive nos limites da notacao exponencial
  const vals = [0, -0, 1e-4, 9.99999e-5, 999999.4, 999999.6, 1e6, -123.4565, 0.1 + 0.2, NaN, Infinity];
  for (let i = 0; i < 200000; i++) vals.push((Math.random() - 0.5) * 10 ** (Math.random() * 14 - 6));
  ok(vals.every((v) => nv6g(v) === nv(v, "%.6g")), "nv6g igual a nv %.6g em 200 mil valores");

  // nomes repetidos na rodada: ensaio1.txt e ensaio1.csv nao se sobrescrevem
  const usados = new Set(), lg = [];
  ok(["ensaio1.txt", "ensaio1.csv", "ensaio1.dat", "outro.txt"].map((a) => nomeUnico(a, usados, lg)).join() === "ensaio1,ensaio1_2,ensaio1_3,outro" && lg.length === 4, "nomes repetidos ganham _2, _3");

  // dinamometro: padrao 9257B; aviso de faixa acima de 90 %
  ok(PADRAO_DINAMOMETRO === "9257B" && DINAMOMETROS["9257B"].faixa.fz[1] === 10, "dinamometro padrao 9257B (Fz ate 10 kN)");
  ok(verificarFaixa("9257B", { fx: -10, fy: -10, fz: -10 }, { fx: 300, fy: 150, fz: 800 }).length === 0, "faixa: 800 N sem aviso");
  ok(verificarFaixa("9257B", { fx: -10, fy: -10, fz: -10 }, { fx: 4600, fy: 150, fz: 800 }).length === 1, "faixa: Fx 4600 N (> 90 % de 5 kN) com aviso");
  const log2 = []; prepararEnsaio(lin.join("\n"), "S2", { ...PADRAO, modelo: "9109AA" }, log2);
  ok(log2.some((l) => /AVISO S2: Fz/.test(l)), "faixa: 800 N no 9109AA (500 N) gera aviso no relatorio");

  return { nOK, falhas };
}
