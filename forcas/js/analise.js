// analise.js - fluxo de um ensaio de forcas, separado da interface:
//   prepararEnsaio : le o arquivo, aplica a calibracao, verifica o tempo
//   analisarFaixa  : estatistica por canal, CSV da faixa e forca teorica
import { lerArquivo, taxaDoTempo, estatistica, corteTeorico } from "./nucleo.js";
import { sprintf, nv } from "../../comum/js/formato.js";

export const VERSAO = "web 2.0.0";
export const CANAIS = [
  { k: "fx", rot: "Fx" }, { k: "fy", rot: "Fy" }, { k: "fz", rot: "Fz" }, { k: "fr", rot: "Fr" },
];
export const ROT = { fx: "Fx", fy: "Fy", fz: "Fz", fr: "Fr" };
export const PADRAO = {
  mapa: ["tempo", "fx", "fy", "fz"], k: { fx: 1, fy: 1, fz: 1 }, duracaoMin: 0.5,
  teorico: { ap: 2, fn: 0.25, vc: 120, kr: 90, g0: 0, kc1: null, mc: 0.25, canal: "fz" },
};

export const CAB_RESUMO = "Faixa;Canal;t_ini[s];t_fim[s];n;fs[Hz];Media[N];RMS[N];Pico[N];DP[N];CV[-];FatorCrista[-];Curtose[-];Assimetria[-];FreqDom[Hz]";
export const CAB_TEORICO = "Faixa;ap[mm];fn[mm/rot];vc[m/min];kr[graus];g0[graus];kc1[N/mm2];mc[-];hm[mm];kc[N/mm2];Fc_teorica[N];Pc[kW];Q[cm3/min];Canal;Fc_medida[N];Diferenca[%]";

export function prepararEnsaio(texto, nome, p, log) {
  const L = lerArquivo(texto, p.mapa, p.k);
  if (L.N < 8) throw new Error("arquivo sem 4 colunas numéricas válidas (revise o mapeamento das colunas).");
  const tx = taxaDoTempo(L.t);
  if (!tx.crescente) throw new Error("a coluna de tempo não é crescente (revise o mapeamento das colunas).");
  log.push("");
  log.push(sprintf("%s: %d amostras | fs = %.6g Hz (pela coluna de tempo) | duracao %.3f s | %d linha(s) de texto ignorada(s)",
    nome, L.N, tx.fs, L.t[L.N - 1] - L.t[0], L.ignoradas));
  if (L.cabecalho) log.push("  cabecalho: " + L.cabecalho);
  if (tx.desvio > 1) log.push(sprintf("AVISO %s: o passo de tempo variou ate %.1f %% do passo medio. Estatisticas validas; frequencia dominante com erro.", nome, tx.desvio));
  return { nome, ...L, fs: tx.fs, desvio: tx.desvio };
}

// c1, c2: indices base 0 inclusivos; op: {teorico: bool}
export function analisarFaixa(E, c1, c2, rotulo, p, op, log) {
  const n = c2 - c1 + 1, fs = E.fs, t0 = E.t[c1], t1 = E.t[c2];
  const est = {};
  for (const { k } of CANAIS) est[k] = estatistica(E.F[k].subarray(c1, c2 + 1), fs);
  const R = { rotulo, c1, c2, t0, t1, tu: t1 - t0, n, est, arquivos: {} };
  log.push("");
  log.push(sprintf("%s | %.3f s a %.3f s (%.3f s, %d amostras) | resolucao espectral %.3f Hz", rotulo, t0, t1, t1 - t0, n, est.fz.df));
  log.push("  canal   media[N]    RMS[N]   pico[N]     DP[N]     CV  crista  curtose  assim.  fdom[Hz]");
  for (const { k, rot } of CANAIS) {
    const s = est[k];
    log.push(sprintf("  %-4s %10.2f %9.2f %9.2f %9.2f %6.3f %7.3f %8.3f %7.3f %9.2f", rot, s.media, s.rms, s.pico, s.dp, s.cv, s.crista, s.curtose, s.assimetria, s.fdom));
  }
  R.linhasResumo = CANAIS.map(({ k, rot }) => {
    const s = est[k];
    return [rotulo, rot, nv(t0, "%.4f"), nv(t1, "%.4f"), String(n), nv(fs, "%.6g"), nv(s.media, "%.3f"), nv(s.rms, "%.3f"),
      nv(s.pico, "%.3f"), nv(s.dp, "%.3f"), nv(s.cv, "%.4f"), nv(s.crista, "%.4f"), nv(s.curtose, "%.4f"), nv(s.assimetria, "%.4f"), nv(s.fdom, "%.3f")].join(";");
  });
  // dados da faixa (forcas ja calibradas)
  const linhas = ["tempo[s];Fx[N];Fy[N];Fz[N];Fr[N]"];
  for (let i = c1; i <= c2; i++) {
    linhas.push([E.t[i], E.F.fx[i], E.F.fy[i], E.F.fz[i], E.F.fr[i]].map((v) => nv(v, "%.6g")).join(";"));
  }
  R.arquivos[`${rotulo}_faixa.csv`] = linhas;
  if (op.teorico) {
    const q = p.teorico, c = corteTeorico(q), med = est[q.canal].media;
    const dif = 100 * (Math.abs(med) - c.Fc) / c.Fc;
    R.teorico = { ...c, medida: med, dif, canal: q.canal };
    log.push(sprintf("  Corte teorico (Sandvik/Kienzle): hm = %.4f mm | kc = %.0f N/mm2 | Fc = %.1f N | Pc = %.3f kW | Q = %.1f cm3/min",
      c.hm, c.kc, c.Fc, c.Pc, c.Q));
    log.push(sprintf("  Fc medida (media |%s|) = %.1f N | diferenca = %+.1f %% da teorica", ROT[q.canal], Math.abs(med), dif));
    R.linhaTeorico = [rotulo, nv(q.ap, "%g"), nv(q.fn, "%g"), nv(q.vc, "%g"), nv(q.kr, "%g"), nv(q.g0, "%g"), nv(q.kc1, "%g"), nv(q.mc, "%g"),
      nv(c.hm, "%.4f"), nv(c.kc, "%.1f"), nv(c.Fc, "%.1f"), nv(c.Pc, "%.4f"), nv(c.Q, "%.2f"), ROT[q.canal], nv(Math.abs(med), "%.1f"), nv(dif, "%.1f")].join(";");
  }
  return R;
}
