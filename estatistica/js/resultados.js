// resultados.js - do CSV ao resultado, sem DOM (testavel no Node).
// executar(cfg) le as colunas conforme os papeis, roda a analise escolhida e devolve
// secoes com conclusoes, tabelas (celulas tipadas) e especificacoes de graficos, mais
// o texto do relatorio. A tela (app.js) so desenha; a gravacao usa csvTabela/relatorio.
import { colunaNumerica, numeroCSV } from "./dados.js";
import { anova1 } from "./anova1.js";
import { manova } from "./manova.js";
import { fatorial2k, preditorFatorial } from "./fatorial2k.js";
import { ccd } from "./ccd.js";
import { otimizar, conferirObjetivo } from "./otimizacao.js";
import { qnorm } from "./distribuicoes.js";
import * as C from "./conclusoes.js";

export const VERSAO = "web 1.1.0";
export const TIPOS = { anova: "ANOVA de um fator", manova: "MANOVA de um fator", fatorial: "Fatorial 2^k", ccd: "Composto central (superfície de resposta)" };

// ---- celulas tipadas: tela (num com 4 algarismos) e CSV (precisao total) ------
export const N = (v, alg = 4) => ({ t: "n", v, alg });
export const P = (v) => ({ t: "p", v });
export const G = (v) => ({ t: "g", v });
export const T = (v) => ({ t: "s", v: String(v) });
export const S = (v) => ({ t: "sig", v: !!v });
export const celTela = (c) => (c.t === "n" ? C.num(c.v, c.alg) : c.t === "p" ? C.fmtP(c.v) : c.t === "g" ? (Number.isFinite(c.v) ? String(Math.round(c.v)) : "–")
  : c.t === "sig" ? (c.v ? "significativo" : "não significativo") : c.v);
const csvNum = (v) => (Number.isFinite(v) ? String(Number(v.toPrecision(10))).replace(".", ",") : "");
export const celCSV = (c) => (c.t === "n" || c.t === "p" ? csvNum(c.v) : c.t === "g" ? (Number.isFinite(c.v) ? String(Math.round(c.v)) : "")
  : c.t === "sig" ? (c.v ? "sim" : "não") : c.v.includes(";") ? `"${c.v.replace(/"/g, '""')}"` : c.v);
export const csvTabela = (t) => [t.cab.map((h) => T(h)).map(celCSV).join(";"), ...t.linhas.map((l) => l.map(celCSV).join(";"))];
export function textoTabela(t) {
  const L = [t.cab, ...t.linhas.map((l) => l.map(celTela))], w = t.cab.map((_, j) => Math.max(...L.map((l) => String(l[j]).length)));
  return L.map((l, i) => l.map((v, j) => (j === 0 ? String(v).padEnd(w[j]) : String(v).padStart(w[j]))).join("  ") + (i === 0 ? "\n" + w.map((x) => "-".repeat(x)).join("  ") : ""));
}
const arq = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

// residuos: x ajustados e Q-Q normal (todas as analises)
function figurasResiduos(id, titulo, ajustados, residuos) {
  const n = residuos.length, ord = residuos.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
  const qq = ord.map(([r], i) => ({ z: qnorm((i + 1 - 0.375) / (n + 0.25)), r }));   // posicoes de Blom
  return [
    { id: `${id}_residuos`, tipo: "residuos", titulo: `${titulo}: resíduos × valores ajustados`, pontos: ajustados.map((a, i) => ({ x: a, y: residuos[i] })) },
    { id: `${id}_qq`, tipo: "qq", titulo: `${titulo}: Q–Q normal dos resíduos`, pontos: qq.map((p) => ({ x: p.z, y: p.r })) },
  ];
}

// nome da grandeza e unidade informados na revisao: usados nos titulos e eixos dos graficos
// (as tabelas e o relatorio continuam com o nome da coluna, igual ao arquivo de dados)
let nomeDe = (c) => c, eixoDe = (c) => c;

// ---- ANOVA de um fator --------------------------------------------------------
function secaoAnova(r, resp, un) {
  const id = arq(`anova_${resp}`), u = un ? ` [${un}]` : "";
  const desc = { id: `${id}_descritivas`, titulo: "Estatística descritiva por grupo", cab: ["Grupo", "n", `Média${u}`, `DP${u}`, `Mediana${u}`, `Mín.${u}`, `Máx.${u}`, "CV [%]", `IC ${C.num(100 * (1 - r.alfa), 3)} % inf.`, "IC sup."],
    linhas: r.desc.map((d) => [T(d.nome), G(d.n), N(d.media), N(d.dp), N(d.mediana), N(d.min), N(d.max), N(d.cv, 3), N(d.icInf), N(d.icSup)]) };
  const t = r.tabela;
  const tab = { id: `${id}_anova`, titulo: "Tabela ANOVA", cab: ["Fonte", "GL", "SQ", "QM", "F", "Valor-p", "Situação"],
    linhas: [[T("Entre grupos"), G(t.entre.gl), N(t.entre.sq), N(t.entre.qm), N(t.entre.F), P(t.entre.p), S(t.entre.p < r.alfa)],
      [T("Dentro (erro)"), G(t.dentro.gl), N(t.dentro.sq), N(t.dentro.qm), T(""), T(""), T("")], [T("Total"), G(t.total.gl), N(t.total.sq), T(""), T(""), T(""), T("")]] };
  const tk = { id: `${id}_tukey`, titulo: `Tukey-Kramer (q crítico = ${C.num(r.qcrit)})`, cab: ["Comparação", "Diferença", "EP", "q", "Valor-p", "IC inf.", "IC sup.", "Situação"],
    linhas: r.tukey.map((k) => [T(`${k.a} − ${k.b}`), N(k.dif), N(k.ep), N(k.q), P(k.p), N(k.icInf), N(k.icSup), S(k.signif)]) };
  const pr = r.premissas;
  const prem = { id: `${id}_premissas`, titulo: "Premissas", cab: ["Teste", "Estatística", "Valor-p", "Situação"],
    linhas: [[T("Shapiro–Wilk (resíduos)"), N(pr.shapiro.W), P(pr.shapiro.p), T(pr.shapiro.p < r.alfa ? "rejeita a normalidade" : "compatível")],
      [T("Levene com mediana"), N(pr.levene.F), P(pr.levene.p), T(pr.levene.p < r.alfa ? "variâncias diferentes" : "compatível")]] };
  return {
    titulo: `ANOVA: ${resp}`, conclusoes: C.conclusoesAnova1(r, resp), tabelas: [desc, tab, tk, prem],
    resumo: [`R² = ${C.num(100 * r.R2, 3)} %`, `R² ajustado = ${C.num(100 * r.R2aj, 3)} %`],
    figuras: [{ id: `${id}_medias`, tipo: "ic", titulo: `${nomeDe(resp)}: médias com IC ${C.num(100 * (1 - r.alfa), 3)} %`, rotY: eixoDe(resp),
      itens: r.desc.map((d) => ({ rotulo: d.nome, y: d.media, inf: d.icInf, sup: d.icSup })) }, ...figurasResiduos(id, nomeDe(resp), r.ajustados, r.residuos)],
  };
}

// ---- MANOVA ---------------------------------------------------------------------
function secaoManova(r) {
  const est = { id: "manova_estatisticas", titulo: "Estatísticas multivariadas", cab: ["Estatística", "Valor", "F", "GL1", "GL2", "Valor-p", "Situação"],
    linhas: Object.values(r.estatisticas).map((e) => [T(e.nome + (e.limiteSuperior ? " ¹" : "")), N(e.valor), N(e.F), N(e.df1, 4), N(e.df2, 4), P(e.p), S(e.signif)]) };
  const uni = { id: "manova_univariadas", titulo: `ANOVAs univariadas protegidas (Bonferroni, α = ${C.num(r.alfaB, 3)})`, cab: ["Resposta", "F", "GL1", "GL2", "Valor-p", "Situação"],
    linhas: r.univariadas.map((u) => [T(u.nome), N(u.F), G(u.gl1), G(u.gl2), P(u.p), S(u.signif)]) };
  const med = { id: "manova_medias", titulo: "Médias por grupo", cab: ["Grupo", "n", ...r.univariadas.map((u) => u.nome)],
    linhas: r.medias.map((m) => [T(m.nome), G(m.n), ...m.media.map((v) => N(v))]) };
  return { titulo: "MANOVA", conclusoes: C.conclusoesManova(r), tabelas: [est, uni, med],
    notas: ["¹ Roy: o F é um limite superior; o valor-p é um limite inferior."],
    figuras: r.univariadas.slice(0, 4).map((u, j) => ({ id: arq(`manova_medias_${u.nome}`), tipo: "ic0", titulo: `${nomeDe(u.nome)}: médias por grupo`, rotY: eixoDe(u.nome),
      itens: r.medias.map((m) => ({ rotulo: m.nome, y: m.media[j] })) })) };
}

// ---- fatorial 2^k ---------------------------------------------------------------
function secaoFatorial(r, resp, unResp = "", unF = [], niveis = []) {
  // graficos de efeitos: eixo x codificado ou em niveis reais (botao na tela), rotulos
  // "grandeza [unidade]" e o mesmo eixo y nos efeitos principais e nas interacoes
  const fx = Object.fromEntries(r.nomes.map((nm, j) => [nm, { rot: eixoDe(nm), nome: nomeDe(nm), un: unF[j] || "", niv: niveis[j] && Number.isFinite(niveis[j].baixo) ? niveis[j] : null }]));
  const valsEf = [...r.principais.flatMap((i) => [i.baixo, i.alto]), ...r.interacoes.slice(0, 6).flatMap((i) => [i.mm, i.mp, i.pm, i.pp])];
  const efY = { rotY: eixoDe(resp), ylimEf: [Math.min(...valsEf), Math.max(...valsEf)], fatores: fx, eixoX: "codificado" };
  const id = arq(`fatorial_${resp}`), leg = r.letras.split("").map((l, j) => `${l} = ${r.nomes[j]}`).join("; ");
  const efs = r.efeitos.filter((e) => r.termos.includes(e.rotulo));
  const cabE = r.lenth ? ["Termo", "Efeito", "Coeficiente", "SQ", "t de Lenth", "Valor-p (Lenth)", "Situação"] : ["Termo", "Efeito", "Coeficiente", "SQ", "F", "Valor-p", "Situação"];
  const linE = efs.map((e) => [T(e.rotulo), N(e.efeito), N(e.coef), N(e.sq), N(r.lenth ? e.tLenth : e.F), P(r.lenth ? e.pLenth : e.p), S(e.signif)]);
  const tabs = [{ id: `${id}_efeitos`, titulo: `Efeitos (${leg})`, cab: cabE, linhas: linE }];
  if (r.erro.gl > 0) {
    const linhas = efs.map((e) => [T(e.rotulo), G(1), N(e.sq), N(e.sq), N(e.F), P(e.p), S(e.signif)]);
    if (r.curvatura) linhas.push([T("Curvatura"), G(1), N(r.curvatura.sq), N(r.curvatura.sq), N(r.curvatura.F), P(r.curvatura.p), S(r.curvatura.signif)]);
    linhas.push([T("Erro"), G(r.erro.gl), N(r.erro.sq), N(r.erro.qm), T(""), T(""), T("")], [T("Total"), G(r.total.gl), N(r.total.sq), T(""), T(""), T(""), T("")]);
    tabs.push({ id: `${id}_anova`, titulo: "Tabela ANOVA", cab: ["Fonte", "GL", "SQ", "QM", "F", "Valor-p", "Situação"], linhas });
  }
  if (r.lenth) tabs.push({ id: `${id}_lenth`, titulo: "Método de Lenth (sem réplica)", cab: ["PSE", "GL (m/3)", "ME", "SME"],
    linhas: [[N(r.lenth.PSE), N(r.lenth.d, 3), N(r.lenth.ME), N(r.lenth.SME)]] });
  const lim = r.lenth ? [{ v: r.lenth.ME, rot: "ME" }, { v: r.lenth.SME, rot: "SME" }] : [{ v: r.tCrit, rot: `t crítico (α = ${C.num(r.alfa, 3)})` }];
  const figs = [
    { id: `${id}_pareto`, tipo: "pareto", titulo: `${nomeDe(resp)}: Pareto dos efeitos${r.lenth ? "" : " padronizados (|t|)"}`, rotX: r.lenth ? "|efeito|" : "|t|",
      itens: efs.map((e) => ({ rotulo: e.rotulo, v: Math.abs(r.lenth ? e.efeito : e.t), sig: e.signif })), limites: lim },
    { id: `${id}_meionormal`, tipo: "meioNormal", titulo: `${nomeDe(resp)}: gráfico meio-normal dos efeitos`, pontos: r.meioNormal.map((p) => ({ x: p.abs, y: p.z, rotulo: p.rotulo })) },
    { id: `${id}_principais`, tipo: "principais", titulo: `${nomeDe(resp)}: efeitos principais`, ...efY, itens: r.principais },
  ];
  if (r.interacoes.length) figs.push({ id: `${id}_interacoes`, tipo: "interacoes", titulo: `${nomeDe(resp)}: interações de 2 fatores`, ...efY, itens: r.interacoes.slice(0, 6) });
  if (r.erro.gl > 0) figs.push(...figurasResiduos(id, nomeDe(resp), r.ajustados, r.residuos));
  return { titulo: `Fatorial 2${"⁰¹²³⁴⁵⁶⁷⁸⁹"[r.k]}: ${resp}`, conclusoes: C.conclusoesFatorial(r, resp), tabelas: tabs, figuras: figs,
    resumo: [`${r.nF} corridas fatoriais (${r.n} réplica${r.n > 1 ? "s" : ""})`, `${r.nc} ponto(s) central(is)`, r.erro.gl > 0 ? `R² = ${C.num(100 * r.R2, 3)} %` : "sem graus de liberdade para o erro"] };
}

// ---- composto central -----------------------------------------------------------
function secaoCcd(c, rr, j, niveis, unidades) {
  const id = arq(`ccd_${rr.nome}`), a = rr.anova;
  const coef = { id: `${id}_coeficientes`, titulo: "Coeficientes do modelo (codificado)", cab: ["Termo", "Coeficiente", "EP", "t", "Valor-p", "Situação"],
    linhas: rr.coefs.map((k) => [T(k.rotulo), N(k.coef), N(k.ep), N(k.t), P(k.p), k.tipo === "intercepto" ? T("") : S(k.signif)]) };
  const lin = (nome, l, teste) => [T(nome), G(l.gl), N(l.sq), N(l.qm), teste ? N(l.F) : T(""), teste ? P(l.p) : T(""), teste ? S(l.p < c.alfa) : T("")];
  const linhas = [lin("Regressão", a.regressao, true), lin("Resíduo", a.residuo)];
  if (a.faltaAjuste) linhas.push(lin("  Falta de ajuste", a.faltaAjuste, true), lin("  Erro puro", a.erroPuro));
  linhas.push(lin("Total", a.total));
  const anova = { id: `${id}_anova`, titulo: "Tabela ANOVA", cab: ["Fonte", "GL", "SQ", "QM", "F", "Valor-p", "Situação"], linhas };
  const aj = { id: `${id}_ajuste`, titulo: "Qualidade do ajuste", cab: ["R² [%]", "R² ajustado [%]", "R² de predição [%]", "PRESS", "s"],
    linhas: [[N(100 * rr.R2, 4), N(100 * rr.R2aj, 4), N(100 * rr.R2pred, 4), N(rr.press), N(rr.s)]] };
  const e = rr.estacionario, tabs = [coef, anova, aj];
  if (e.tipo !== "indefinido") {
    tabs.push({ id: `${id}_estacionario`, titulo: `Ponto estacionário: ${e.tipo}${e.dentro ? "" : " (fora da região ensaiada)"}`, cab: ["Fator", "Codificado", ...(e.xsReal ? ["Real"] : [])],
      linhas: [...c.nomes.map((n, i) => [T(n + (unidades[i] ? ` [${unidades[i]}]` : "")), N(e.xs[i]), ...(e.xsReal ? [N(e.xsReal[i], 5)] : [])]),
        [T("Resposta prevista"), N(e.ys), ...(e.xsReal ? [T("")] : [])]] });
    tabs.push({ id: `${id}_autovalores`, titulo: "Autovalores de B (forma canônica)", cab: ["Autovalor", "Valor"], linhas: e.autovalores.map((v, i) => [T(`λ${i + 1}`), N(v)]) });
  }
  const figs = [];
  if (c.k >= 2) {
    // superficie de resposta em 2 fatores (par = os 2 primeiros; a tela deixa trocar), demais no centro
    // ou no ponto estacionario se dentro da regiao. A tela mostra em 3D e em curvas de nivel e grava
    // as duas figuras: <id>_superficie3d.png e <id>_contorno.png.
    const fixo = e.tipo !== "indefinido" && e.dentro ? e.xs : new Array(c.k).fill(0);
    figs.push({ id: `${id}_contorno`, idSup: `${id}_superficie3d`, tipo: "contorno", titulo: `${nomeDe(rr.nome)}: superfície de resposta`,
      resposta: nomeDe(rr.nome), nomes: c.nomes.map(nomeDe), k: c.k, par: [0, 1], raio: c.alfaAxial, prever: rr.prever, fixo, X: c.X, obs: rr.y,
      estac: e.tipo !== "indefinido" ? { xs: e.xs, rotulo: e.tipo } : null,
      // eixos dos fatores: codificado ou na grandeza real (botao na tela), como nos graficos de efeitos
      eixoX: "codificado", fatores: c.nomes.map((_, i) => ({ un: unidades[i] || "", niv: niveis[i] && Number.isFinite(niveis[i].baixo) && Number.isFinite(niveis[i].alto) ? niveis[i] : null })) });
  }
  figs.push(...figurasResiduos(id, nomeDe(rr.nome), rr.ajustados, rr.residuos));
  return { titulo: `Superfície de resposta: ${rr.nome}`, conclusoes: C.conclusoesCcd(rr, c.alfa, c.alfaAxial), tabelas: tabs, figuras: figs,
    resumo: [`${c.N} ensaios, ${c.k} fatores, α axial = ${C.num(c.alfaAxial, 4)}`] };
}

// ---- otimizacao -----------------------------------------------------------------
function secaoOtimizacao(o, nomesF, paraReal, unidades) {
  const real = (x) => (paraReal ? paraReal(x) : null);
  const cabX = nomesF.map((n, i) => n + (unidades[i] ? ` [${unidades[i]}]` : ""));
  const lin = (rot, s) => { const xr = real(s.x); return [T(rot), ...s.x.map((v, i) => (xr ? N(xr[i], 5) : N(v))), ...s.y.map((v) => N(v)), N(s.D, 3)]; };
  const d = o.desejabilidade, cab = ["Solução", ...cabX.map((c) => c + (paraReal ? "" : " (cod.)")), ...o.nomes, "D"];
  const t1 = { id: "otimizacao_escolhas", titulo: "Melhores combinações", cab, linhas: [lin("Desejabilidade máxima", d), lin("TOPSIS na frente de Pareto", { ...o.topsis, D: o.topsis.D })] };
  const ord = [...o.pareto].sort((a, b) => b.proximidade - a.proximidade);
  const t2 = { id: "otimizacao_pareto", titulo: `Frente de Pareto (NSGA-II: população ${o.nsga.pop}, ${o.nsga.geracoes} gerações, semente ${o.semente})`,
    cab: [...cab.slice(1), "Proximidade TOPSIS"], linhas: ord.map((s) => lin("", s).slice(1).concat([N(s.proximidade, 4)])) };
  const figs = [{ id: "otimizacao_pareto", tipo: "frente", titulo: `Frente de Pareto: ${nomeDe(o.nomes[0])} × ${nomeDe(o.nomes[1])}`, rotX: eixoDe(o.nomes[0]), rotY: eixoDe(o.nomes[1]),
    pontos: o.pareto.map((s) => ({ x: s.y[0], y: s.y[1] })), destaque: [{ x: o.topsis.y[0], y: o.topsis.y[1], rotulo: "TOPSIS" }, { x: d.y[0], y: d.y[1], rotulo: "desejabilidade" }] }];
  return { titulo: "Otimização com várias respostas", conclusoes: C.conclusoesOtimizacao(o, nomesF, paraReal), tabelas: [t1, t2], figuras: figs };
}

// ---- execucao --------------------------------------------------------------------
// cfg: {tipo, tab, papeis: {col: "fator"|"resposta"|"ignorar"}, unidades: {col}, niveis: {col: {baixo, alto}},
//       alfa, termos (2^k), objetivos: {resp: {tipo, L, U, T, s, t, r, peso}}, semente, nomeArquivo}
export function executar(cfg) {
  const { tab, tipo } = cfg, alfa = cfg.alfa ?? 0.05;
  const cols = (papel) => tab.colunas.filter((c) => cfg.papeis[c] === papel);
  const fatores = cols("fator"), respostas = cols("resposta"), un = (c) => cfg.unidades?.[c] || "";
  nomeDe = (c) => String(cfg.nomes?.[c] || "").trim() || c;
  eixoDe = (c) => nomeDe(c) + (un(c) ? ` [${un(c)}]` : "");
  const secoes = [];
  const exige = (cond, msg) => { if (!cond) throw new Error(msg); };
  if (tipo === "anova" || tipo === "manova") {
    exige(fatores.length === 1, "escolha exatamente 1 coluna como fator (os grupos).");
    exige(respostas.length >= (tipo === "manova" ? 2 : 1), tipo === "manova" ? "a MANOVA precisa de pelo menos 2 respostas." : "escolha pelo menos 1 resposta.");
    const jf = tab.colunas.indexOf(fatores[0]), Y = respostas.map((c) => colunaNumerica(tab, c)), ordem = [];
    const grupoDe = new Map();
    tab.linhas.forEach((l, i) => { const g = l[jf]; if (!grupoDe.has(g)) { grupoDe.set(g, []); ordem.push(g); } grupoDe.get(g).push(i); });
    if (tipo === "anova") for (const [k, resp] of respostas.entries()) {
      const r = anova1(ordem.map((g) => ({ nome: g, valores: grupoDe.get(g).map((i) => Y[k][i]) })), alfa);
      secoes.push(secaoAnova(r, resp, un(resp)));
    } else {
      const r = manova(ordem.map((g) => ({ nome: g, Y: grupoDe.get(g).map((i) => Y.map((y) => y[i])) })), respostas, alfa);
      secoes.push(secaoManova(r));
    }
    return finalizar(cfg, secoes, { fatores, respostas });
  }
  // 2^k e CCD: fatores numericos, codificados por niveis (baixo/alto = -1/+1)
  exige(fatores.length >= 2, "escolha pelo menos 2 fatores (colunas de entrada).");
  exige(respostas.length >= 1, "escolha pelo menos 1 resposta.");
  const niveis = fatores.map((c) => cfg.niveis?.[c]);
  const temNiveis = niveis.every((n) => n && Number.isFinite(n.baixo) && Number.isFinite(n.alto));
  niveis.forEach((n, i) => { if (n && !(n.alto > n.baixo)) throw new Error(`${fatores[i]}: o nível alto (+1) precisa ser maior que o baixo (−1).`); });
  const Xr = fatores.map((c) => colunaNumerica(tab, c));
  const X = tab.linhas.map((_, i) => fatores.map((c, j) => (niveis[j]?.baixo !== undefined && Number.isFinite(niveis[j].baixo)
    ? (Xr[j][i] - (niveis[j].alto + niveis[j].baixo) / 2) / ((niveis[j].alto - niveis[j].baixo) / 2) : Xr[j][i])).map((v) => Math.round(v * 1e9) / 1e9));
  const Ys = respostas.map((c) => colunaNumerica(tab, c));
  const paraReal = temNiveis ? (x) => x.map((v, j) => (niveis[j].alto + niveis[j].baixo) / 2 + v * (niveis[j].alto - niveis[j].baixo) / 2) : null;
  const unF = fatores.map(un);
  let preditores, regiao;
  if (tipo === "fatorial") {
    // aponta a coluna, o valor original e os niveis usados quando um ponto nao cai em −1, 0 ou +1
    X.forEach((x, i) => {
      if (x.every((v) => v === 0) || x.every((v) => v === -1 || v === 1)) return;
      const j = x.findIndex((v) => v !== -1 && v !== 1 && !(v === 0 && x.every((z) => z === 0)));
      const nv = niveis[j], val = C.num(Xr[j][i], 6), orig = `a linha ${i + 1} tem ${fatores[j]} = ${val}`;
      throw new Error(nv && Number.isFinite(nv.baixo)
        ? `${orig}, que não é o nível −1 (${C.num(nv.baixo, 6)}) nem o +1 (${C.num(nv.alto, 6)}) informados na revisão. Confira os níveis dessa coluna (o fatorial só aceita os dois níveis e o ponto central).`
        : `${orig}, fora de −1, 0 e +1. Se a coluna está em unidades reais, informe os níveis −1 e +1 dela na revisão.`);
    });
    const rs =respostas.map((resp, k) => fatorial2k(X, Ys[k], { nomes: fatores, alfa, termos: cfg.termos }));
    rs.forEach((r, k) => secoes.push(secaoFatorial(r, respostas[k], un(respostas[k]), unF, niveis)));
    preditores = rs.map(preditorFatorial); regiao = { tipo: "cubo" };
  } else {
    const c = ccd(X, tab.linhas.map((_, i) => Ys.map((y) => y[i])), { nomes: fatores, respostas, alfa, niveis: temNiveis ? niveis : undefined });
    c.X = X;
    c.respostas.forEach((rr, j) => secoes.push(secaoCcd(c, rr, j, niveis, unF)));
    preditores = c.respostas.map((rr) => rr.prever); regiao = { tipo: "esfera", raio: c.alfaAxial };
  }
  const ativos = respostas.map((r, i) => i).filter((i) => (cfg.objetivos?.[respostas[i]]?.tipo ?? "ignorar") !== "ignorar");
  if (ativos.length >= 2) {
    const objs = ativos.map((i) => { const o = cfg.objetivos[respostas[i]]; conferirObjetivo(o, respostas[i]); return o; });
    const o = otimizar(ativos.map((i) => preditores[i]), objs, ativos.map((i) => respostas[i]), fatores.length, regiao, { semente: cfg.semente ?? 12345 });
    secoes.push(secaoOtimizacao(o, fatores, paraReal, unF));
  }
  return finalizar(cfg, secoes, { fatores, respostas });
}

function finalizar(cfg, secoes, papeis) {
  const agora = cfg.data || new Date();
  const z = (n) => String(n).padStart(2, "0");
  const log = [`Planejamento de experimentos (LabForce NUPEF) ${VERSAO}`,
    `Data: ${agora.getFullYear()}-${z(agora.getMonth() + 1)}-${z(agora.getDate())} ${z(agora.getHours())}:${z(agora.getMinutes())}`,
    `Análise: ${TIPOS[cfg.tipo]} | dados: ${cfg.nomeArquivo || "digitados"} (${cfg.tab.linhas.length} linhas)`,
    `Fatores: ${papeis.fatores.join(", ")} | respostas: ${papeis.respostas.join(", ")} | α = ${C.num(cfg.alfa ?? 0.05, 3)}`];
  if (cfg.tipo === "fatorial" && cfg.termos) log.push(`Modelo reduzido: ${cfg.termos.join(", ")}`);
  if (secoes.some((s) => s.titulo.startsWith("Otimização"))) log.push(`Semente do gerador (NSGA-II e busca da desejabilidade): ${cfg.semente ?? 12345}`);
  log.push("Cálculos no navegador, por métodos convencionais (sem IA).");
  for (const s of secoes) {
    log.push("", "=".repeat(78), s.titulo, "=".repeat(78));
    if (s.resumo) log.push(s.resumo.join(" | "));
    log.push("", "Conclusões:", ...s.conclusoes.map((c) => "- " + c));
    for (const t of s.tabelas) log.push("", t.titulo, ...textoTabela(t));
    if (s.notas) log.push("", ...s.notas);
  }
  return { secoes, log, papeis };
}

// ---- sugestoes para a revisao (papeis e niveis) ---------------------------------
export function sugerirPapeis(tab, tipo) {
  const num = (c) => tab.linhas.every((l) => Number.isFinite(numeroCSV(l[tab.colunas.indexOf(c)])));
  const p = {};
  if (tipo === "anova" || tipo === "manova") {
    const fat = tab.colunas.find((c) => !num(c)) || tab.colunas[0];
    for (const c of tab.colunas) p[c] = c === fat ? "fator" : num(c) ? "resposta" : "ignorar";
  } else {
    // entradas: colunas com poucos niveis distintos; respostas: o resto
    for (const c of tab.colunas) {
      if (!num(c)) { p[c] = "ignorar"; continue; }
      const dist = new Set(colunaNumerica(tab, c)).size;
      p[c] = dist <= (tipo === "ccd" ? 5 : 3) ? "fator" : "resposta";
    }
  }
  return p;
}
// Niveis -1/+1 sugeridos para uma coluna de fator. Codificada (so -1, 0, +1 e axiais): nulo.
export function sugerirNiveis(valores, tipo) {
  const d = [...new Set(valores)].sort((a, b) => a - b);
  if (d.every((v) => Math.abs(v) <= 3) && d.includes(-1) && d.includes(1)) return null;
  if (d.length === 2 || d.length === 3) return { baixo: d[0], alto: d[d.length - 1] };
  if (tipo === "ccd" && d.length === 5) return { baixo: d[1], alto: d[3] };
  return { baixo: NaN, alto: NaN };
}
