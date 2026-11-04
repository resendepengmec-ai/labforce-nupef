// conclusoes.js - conclusoes em texto por regras fixas (modelos de frase), sem IA.
// Cada funcao recebe o resultado de uma analise e devolve frases curtas, na voz ativa.
// Quando uma premissa falha, a frase diz qual e o que fazer. Linguagem de causa so onde
// o planejamento permite (fatores controlados no 2^k e no CCD); na ANOVA e na MANOVA,
// "diferem", sem atribuir causa.

// numero com virgula: 4 algarismos significativos, sem notacao exponencial em faixas comuns
export function num(x, alg = 4) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const a = Math.abs(x);
  const s = a >= 1e-3 && a < 1e7 ? Number(x.toPrecision(alg)).toString() : x.toExponential(alg - 1).replace("e", " × 10^");
  return s.replace(".", ",").replace(/^-/, "−");
}
// valor-p: "< 0,0001" ou 4 algarismos significativos sem zeros a direita
// (0,04996 nao vira 0,05, que ficaria do lado errado de alfa = 0,05)
export function fmtP(p) {
  if (!Number.isFinite(p)) return "–";
  if (p < 1e-4) return "< 0,0001";
  return p.toPrecision(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "").replace(".", ",");
}
const pTxt = (p) => (p < 1e-4 ? "p < 0,0001" : `p = ${fmtP(p)}`);
const pct = (x) => `${num(100 * x, 3)} %`;

// umFator: so na ANOVA de um fator ha teste nao parametrico direto (Kruskal-Wallis)
function premissas(sw, lev, alfa, umFator = false) {
  const f = [];
  if (sw && Number.isFinite(sw.p)) {
    if (sw.p < alfa) f.push(`Os resíduos não seguem a distribuição normal (Shapiro–Wilk, ${pTxt(sw.p)}). Transforme a resposta (logaritmo, raiz quadrada ou Box–Cox) e refaça a análise${umFator ? ", ou use o teste não paramétrico de Kruskal–Wallis" : "; confira também pontos atípicos no gráfico de resíduos"}.`);
    else f.push(`Os resíduos são compatíveis com a distribuição normal (Shapiro–Wilk, ${pTxt(sw.p)}).`);
  }
  if (lev && Number.isFinite(lev.p)) {
    if (lev.p < alfa) f.push(`As variâncias dos grupos diferem (Levene com mediana, ${pTxt(lev.p)}). Transforme a resposta ou use a ANOVA de Welch com comparações de Games–Howell.`);
    else f.push(`As variâncias dos grupos são compatíveis (Levene com mediana, ${pTxt(lev.p)}).`);
  }
  return f;
}

export function conclusoesAnova1(r, resposta = "a resposta") {
  const e = r.tabela.entre, f = [];
  if (e.p < r.alfa) f.push(`As médias dos grupos diferem (F = ${num(e.F)}; ${pTxt(e.p)}): pelo menos um grupo tem média diferente dos outros.`);
  else f.push(`Não há evidência de diferença entre as médias dos grupos (F = ${num(e.F)}; ${pTxt(e.p)}).`);
  f.push(`O fator responde por ${pct(r.R2)} da variação de ${resposta} (R² ajustado = ${pct(r.R2aj)}).`);
  if (e.p < r.alfa) {
    const sig = r.tukey.filter((t) => t.signif);
    if (sig.length) for (const t of sig) {
      const [maior, menor] = t.dif > 0 ? [t.a, t.b] : [t.b, t.a];
      f.push(`Tukey: a média de ${maior} supera a de ${menor} em ${num(Math.abs(t.dif))} (IC ${num(100 * (1 - r.alfa), 3)} %: ${num(Math.abs(t.dif) - (t.icSup - t.icInf) / 2)} a ${num(Math.abs(t.dif) + (t.icSup - t.icInf) / 2)}; ${pTxt(t.p)}).`);
    }
    else f.push("O teste F detectou diferença, mas nenhum par difere no teste de Tukey: a diferença está espalhada entre os grupos.");
  }
  return [...f, ...premissas(r.premissas.shapiro, r.premissas.levene, r.alfa, true)];
}

export function conclusoesFatorial(r, resposta = "a resposta") {
  const f = [], nomeDe = (rot) => (rot.length === 1 ? `O fator ${rot} (${r.nomes[r.letras.indexOf(rot)]})` : `A interação ${rot}`);
  const efs = r.efeitos.filter((e) => r.termos.includes(e.rotulo));
  if (r.lenth) f.push(`Sem graus de liberdade para o erro, a significância usa o método de Lenth: ME = ${num(r.lenth.ME)} e SME = ${num(r.lenth.SME)} (PSE = ${num(r.lenth.PSE)}). Efeitos acima do SME são os mais confiáveis.`);
  const sig = efs.filter((e) => e.signif).sort((a, b) => Math.abs(b.efeito) - Math.abs(a.efeito));
  for (const e of sig) {
    const pv = r.lenth ? `Lenth, ${pTxt(e.pLenth)}` : pTxt(e.p);
    if (e.rotulo.length === 1) f.push(`${nomeDe(e.rotulo)} é significativo (${pv}): passar de −1 para +1 ${e.efeito > 0 ? "aumenta" : "diminui"} a média de ${resposta} em ${num(Math.abs(e.efeito))} unidades.`);
    else f.push(`${nomeDe(e.rotulo)} é significativa (${pv}): o efeito de um fator depende do nível do outro (veja o gráfico de interação); interprete os efeitos principais envolvidos com cuidado.`);
  }
  // fator sem efeito principal: separa quem participa de interacao significativa
  const naoSig = efs.filter((e) => !e.signif && e.rotulo.length === 1);
  const nome = (l) => `${l} (${r.nomes[r.letras.indexOf(l)]})`, inter = (l) => sig.filter((e) => e.rotulo.length > 1 && e.rotulo.includes(l)).map((e) => e.rotulo);
  for (const e of naoSig.filter((x) => inter(x.rotulo).length)) f.push(`O fator ${nome(e.rotulo)} não tem efeito principal significativo, mas participa de ${inter(e.rotulo).join(", ")}: seu efeito depende do nível dos outros fatores.`);
  const nao = naoSig.filter((x) => !inter(x.rotulo).length).map((x) => nome(x.rotulo));
  if (nao.length) f.push(`Não há evidência de efeito de ${nao.join(", ")} na faixa ensaiada.`);
  if (!sig.length) f.push("Nenhum efeito é significativo no nível escolhido.");
  if (r.curvatura && Number.isFinite(r.curvatura.p)) {
    if (r.curvatura.p < r.alfa) f.push(`Há curvatura (${pTxt(r.curvatura.p)}): a média nos pontos centrais (${num(r.curvatura.yC)}) difere da média dos vértices (${num(r.curvatura.yF)}). O modelo de 1ª ordem não basta; acrescente pontos axiais (composto central).`);
    else f.push(`Não há evidência de curvatura (${pTxt(r.curvatura.p)}): o modelo de 1ª ordem descreve a região ensaiada.`);
  }
  if (r.erro.gl > 0) f.push(`O modelo responde por ${pct(r.R2)} da variação (R² ajustado = ${pct(r.R2aj)}).`);
  if (r.erro.gl > 2) f.push(...premissas(r.premissas.shapiro, null, r.alfa));
  return f;
}

export function conclusoesCcd(rr, alfa, raio) {
  const f = [], a = rr.anova;
  if (a.regressao.p < alfa) f.push(`${rr.nome}: o modelo quadrático é significativo (F = ${num(a.regressao.F)}; ${pTxt(a.regressao.p)}) e responde por ${pct(rr.R2)} da variação (R² ajustado = ${pct(rr.R2aj)}).`);
  else f.push(`${rr.nome}: o modelo quadrático não é significativo (${pTxt(a.regressao.p)}); a resposta pode não depender dos fatores na região ensaiada.`);
  if (a.faltaAjuste) {
    if (a.faltaAjuste.p < alfa) f.push(`A falta de ajuste é significativa (${pTxt(a.faltaAjuste.p)}): o modelo quadrático não descreve bem os dados. Confira pontos atípicos, transforme a resposta ou use um modelo de ordem maior.`);
    else f.push(`A falta de ajuste não é significativa (${pTxt(a.faltaAjuste.p)}): o modelo quadrático é adequado.`);
  } else f.push("Sem pontos repetidos, não há teste de falta de ajuste: inclua réplicas (pontos centrais) no planejamento.");
  if (rr.R2aj - rr.R2pred > 0.2) f.push(`O R² de predição (${pct(rr.R2pred)}) fica bem abaixo do R² ajustado: o modelo prevê mal ensaios novos. Retire termos não significativos ou confira pontos influentes.`);
  if (rr.anova.residuo.gl > 2) f.push(...premissas(rr.premissas.shapiro, null, alfa));
  const sig = rr.coefs.filter((c) => c.tipo !== "intercepto" && c.signif).map((c) => c.rotulo);
  f.push(sig.length ? `Termos significativos: ${sig.join(", ")}.` : "Nenhum termo isolado é significativo.");
  const e = rr.estacionario;
  if (e.tipo === "indefinido") f.push(e.msg);
  else {
    const onde = e.xs.map((v) => num(v, 3)).join("; "), real = e.xsReal ? ` (unidades reais: ${e.xsReal.map((v) => num(v, 4)).join("; ")})` : "";
    const tipo = { "máximo": "um máximo", "mínimo": "um mínimo", sela: "um ponto de sela" }[e.tipo];
    f.push(`O ponto estacionário é ${tipo}, em x = (${onde})${real}, com resposta prevista de ${num(e.ys)}. Autovalores de B: ${e.autovalores.map((v) => num(v, 3)).join("; ")}.`);
    if (e.tipo === "sela") f.push("No ponto de sela a resposta sobe numa direção e desce em outra: para otimizar, siga a direção do maior autovalor (análise de cumeeira) ou use a otimização com restrição à região.");
    if (!e.dentro) f.push(`O ponto estacionário fica fora da região experimental (distância ${num(e.distancia, 3)} > ${num(raio, 3)}): não extrapole. Faça novos ensaios na direção indicada.`);
  }
  return f;
}

export function conclusoesManova(r) {
  const f = [], w = r.estatisticas.wilks, pi = r.estatisticas.pillai;
  if (w.p < r.alfa) f.push(`Os grupos diferem no conjunto das respostas (Wilks Λ = ${num(w.valor)}; F = ${num(w.F)}; ${pTxt(w.p)}).`);
  else f.push(`Não há evidência de diferença entre os grupos no conjunto das respostas (Wilks Λ = ${num(w.valor)}; ${pTxt(w.p)}).`);
  if ((w.p < r.alfa) !== (pi.p < r.alfa)) f.push(`Wilks e Pillai discordam (Pillai ${pTxt(pi.p)}): prefira Pillai, mais robusto quando as covariâncias dos grupos diferem.`);
  if (w.p < r.alfa || pi.p < r.alfa) {
    const sig = r.univariadas.filter((u) => u.signif).map((u) => u.nome);
    f.push(sig.length ? `Nas ANOVAs protegidas (Bonferroni, α = ${num(r.alfaB, 3)}), diferem: ${sig.join(", ")}.`
      : `Nenhuma resposta isolada difere nas ANOVAs protegidas (Bonferroni, α = ${num(r.alfaB, 3)}): a diferença está na combinação das respostas.`);
  }
  return f;
}

export function conclusoesOtimizacao(o, nomesFatores, paraReal) {
  const f = [], d = o.desejabilidade, real = (x) => (paraReal ? ` (unidades reais: ${paraReal(x).map((v) => num(v, 4)).join("; ")})` : "");
  if (d.D <= 0) f.push("Nenhuma combinação dos fatores atende todos os limites de desejabilidade ao mesmo tempo (D = 0). Reveja os limites inferior e superior das respostas.");
  else f.push(`Pela desejabilidade, a melhor combinação é ${nomesFatores.map((n, i) => `${n} = ${num(d.x[i], 3)}`).join("; ")}${real(d.x)}, com D = ${num(d.D, 3)}; respostas previstas: ${o.nomes.map((n, i) => `${n} = ${num(d.y[i])}`).join("; ")}.`);
  const t = o.topsis;
  if (t) f.push(`Na frente de Pareto (NSGA-II, ${o.pareto.length} soluções), o TOPSIS escolhe ${nomesFatores.map((n, i) => `${n} = ${num(t.x[i], 3)}`).join("; ")}${real(t.x)}: ${o.nomes.map((n, i) => `${n} = ${num(t.y[i])}`).join("; ")}.`);
  f.push(`Os valores previstos valem dentro da região ensaiada. Confirme a combinação escolhida com ensaios. Semente do gerador: ${o.semente}.`);
  return f;
}
