// analise.js - fluxo de um ensaio (porte do laco principal de
// Potencias_Eletricas_v5.3.3_ESP32.sce), separado da interface:
//   prepararEnsaio  : le o arquivo, converte, detecta fs, potencia suavizada
//   analisarFaixa   : grandezas, FFT, IEEE 519 e IEEE 1459 de uma faixa
// Toda saida de texto vai para o array "log" (vira relatorio.txt).
import {
  lerArquivoESP32, media, detectaFs, mediaMovelCiclos, grandezasEletricas,
  espectroFFT, difFase, definirAviso,
} from "./nucleo.js";
import { sprintf, nv } from "./formato.js";
import {
  analiseIEEE519, marcarFsInstavel, relatorioIEEE519, linhaResumoIEEE519,
} from "./ieee519.js";
import { analiseIEEE1459, relatorioIEEE1459, linhaIEEE1459 } from "./ieee1459.js";

export const VERSAO = "web 1.0.0 (metodo v5.3.3)";

// Parametros padrao (os mesmos do .sce v5.3.3)
export const PADRAO = {
  fRede: 60, nCicVis: 30, duracaoMin: 1,
  kV: [1.2483, 1.2492, 1.2803], kI: [1.2434, 1.1984, 1.2213],   // pos. Amarela (In = 17,5 A)
  IscIL: 10, IL519: NaN, atrasoCanal: [0, 0, 0, 0, 0, 0],
  resolAD: 4096, tensaoMcont: 3.3, tensaoPicoPico: 996, cteCorrente: 78.1,
};

export const CALIBRACOES = {
  amarela: { nome: "Posição Amarela (In = 17,5 A)", kV: [1.2483, 1.2492, 1.2803], kI: [1.2434, 1.1984, 1.2213] },
  vermelha: { nome: "Posição Vermelha (In = 10,5 A)", kV: [1.289221, 1.256977, 1.312195], kI: [1.166667, 1.166667, 1.153226] },
};

export const CAB_DADOS = "Ensaio Pt[W] U[V] Ief[A] t[s] St[VA] FP f1[Hz] fs[Hz]";

export function prepararEnsaio(texto, nome, p, log) {
  definirAviso((s) => log.push(s));
  const { cols, ignoradas } = lerArquivoESP32(texto);
  const N = cols[0].length;
  if (N < 10) throw new Error(`${nome}: arquivo sem dados numéricos de 6 colunas.`);
  const cteT = (p.tensaoMcont / p.resolAD) * p.tensaoPicoPico;
  const cteC = (p.tensaoMcont / p.resolAD) * p.cteCorrente;
  const k = [...p.kV.map((x) => x * cteT), ...p.kI.map((x) => x * cteC)];
  const S = cols.map((c, i) => { const m = media(c); return c.map((v) => (v - m) * k[i]); });
  const [Va, Vb, Vc, Ia, Ib, Ic] = S;
  const { fs, fsBruta, varFs, regra } = detectaFs(Va, p.fRede);
  log.push("");
  if (regra !== "") log.push(sprintf("%s: taxa de amostragem = %.6g Hz (estimada pela rede: %.2f Hz; %s)", nome, fs, fsBruta, regra));
  else log.push(sprintf("AVISO %s: taxa de amostragem estimada = %.2f Hz, sem valor redondo a menos de 0,3 %%; usada a estimada.", nome, fs));
  if (varFs > 0.5) {
    log.push(sprintf("AVISO %s: a taxa variou %.2f %% ao longo do ensaio. P, U e I seguem validos;", nome, varFs));
    log.push("      tempos, f1 e harmonicos podem ter erro. Situacao IEEE 519 = FS_INSTAVEL.");
  }
  if (ignoradas > 0) log.push(sprintf("%s: %d linha(s) nao numericas ignoradas.", nome, ignoradas));
  const Pot = new Float64Array(N);
  for (let i = 0; i < N; i++) Pot[i] = Va[i] * Ia[i] + Vb[i] * Ib[i] + Vc[i] * Ic[i];
  const Pinst = mediaMovelCiclos(Pot, fs, p.fRede, p.nCicVis);
  return { nome, N, fs, fsBruta, varFs, regra, V: [Va, Vb, Vc], I: [Ia, Ib, Ic], Pinst };
}

// c1, c2: indices base 0 (inclusivos). op: {fft, ieee519, ieee1459}
export function analisarFaixa(E, c1, c2, rotulo, p, op, log) {
  definirAviso((s) => log.push(s));
  const fs = E.fs, fRede = p.fRede;
  const V = E.V.map((x) => x.subarray(c1, c2 + 1)), I = E.I.map((x) => x.subarray(c1, c2 + 1));
  const tu = (c2 - c1) / fs;
  const g = grandezasEletricas(V[0], V[1], V[2], I[0], I[1], I[2]);
  const eV = [], eI = [];
  for (let k = 0; k < 3; k++) {
    eV.push(espectroFFT(V[k], fs, fRede));
    eI.push(espectroFFT(I[k], fs, fRede, eV[k].k));
  }
  const f1 = (eV[0].f1 + eV[1].f1 + eV[2].f1) / 3;
  const defVbVa = difFase(eV[1].ph1, eV[0].ph1), defVcVa = difFase(eV[2].ph1, eV[0].ph1);
  const defVI = [0, 1, 2].map((k) => difFase(eV[k].ph1, eI[k].ph1));
  const cosFi1 = defVI.map((d) => Math.cos(d * Math.PI / 180));
  const R = { rotulo, c1, c2, tu, g, eV, eI, f1, defVbVa, defVcVa, defVI, cosFi1, arquivos: {} };
  if (op.fft) {
    log.push("");
    log.push(sprintf("%s | f1 = %.3f Hz (resolucao %.3f Hz)", rotulo, f1, eV[0].df));
    log.push(sprintf("  V1 [V rms]  = %6.1f %6.1f %6.1f | Vb-Va = %6.1f  Vc-Va = %6.1f graus",
      eV[0].A1 / Math.SQRT2, eV[1].A1 / Math.SQRT2, eV[2].A1 / Math.SQRT2, defVbVa, defVcVa));
    log.push(sprintf("  I1 [A rms]  = %6.3f %6.3f %6.3f", eI[0].A1 / Math.SQRT2, eI[1].A1 / Math.SQRT2, eI[2].A1 / Math.SQRT2));
    log.push(sprintf("  V-I [graus] = %6.1f %6.1f %6.1f | cos(fi1) = %.3f %.3f %.3f | FP = %.3f",
      ...defVI, ...cosFi1, g.FP));
  }
  if (op.ieee519) {
    const q = analiseIEEE519(V, I, fs, fRede, f1, p.IscIL, p.IL519);
    if (q.ok && E.varFs > 0.5) marcarFsInstavel(q);
    if (q.ok) {
      const rel = relatorioIEEE519(q);
      log.push(...rel.texto);
      R.q = q;
      R.arquivos[rotulo + "_IEEE519_harmonicos.csv"] = rel.csv;
      R.linha519 = linhaResumoIEEE519(q, rotulo, f1);
    } else log.push("  IEEE 519 nao avaliado: " + q.msg);
  }
  if (op.ieee1459) {
    const r = analiseIEEE1459(V, I, fs, fRede, f1, p.atrasoCanal);
    if (r.ok) {
      log.push(...relatorioIEEE1459(r));
      R.r59 = r;
      R.linha1459 = linhaIEEE1459(r, rotulo);
    } else log.push("  IEEE 1459 nao avaliado: " + r.msg);
  }
  const nums = sprintf("%.1f %.1f %.3f %.2f %.1f %.3f %.3f %.6g", g.Pt, g.Vrms[0], g.Ief, tu, g.St, g.FP, f1, fs);
  R.linhaDados = rotulo.replace(/ /g, "_") + " " + nums.replace(/\./g, ",");
  return R;
}

export { nv };
