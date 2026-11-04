// otimizacao.js - otimizacao com 2 ou mais respostas (2^k ou CCD).
//  - Desejabilidade de Derringer e Suich (1980): maximizar, minimizar e alvo, com
//    expoentes s e t e pesos de importancia r; D = (prod d_i^r_i)^(1/soma r_i).
//  - NSGA-II (Deb et al. 2002): SBX e mutacao polinomial, ordenacao nao dominada e
//    distancia de aglomeracao; frente de Pareto.
//  - TOPSIS (Hwang e Yoon 1981) para escolher uma solucao da frente.
// Aleatoriedade so por gerador com semente (mulberry32): o relatorio e reproduzivel.
// Regiao de busca: cubo [-1, 1]^k (2^k) ou esfera de raio alfa (CCD), sem extrapolar.

export function mulberry32(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- desejabilidade ----------------------------------------------------------
// obj: {tipo: "max"|"min"|"alvo", L, U, T (alvo), s = 1, t = 1, r = 1}
export function conferirObjetivo(o, nome = "resposta") {
  if (!(o.U > o.L)) throw new Error(`${nome}: o limite superior precisa ser maior que o inferior.`);
  if (o.tipo === "alvo" && !(o.T > o.L && o.T < o.U)) throw new Error(`${nome}: o alvo precisa ficar entre os limites inferior e superior.`);
}
export function desejabilidade(y, o) {
  const { L, U, s = 1, t = 1 } = o;
  if (o.tipo === "max") return y <= L ? 0 : y >= U ? 1 : ((y - L) / (U - L)) ** s;
  if (o.tipo === "min") return y <= L ? 1 : y >= U ? 0 : ((U - y) / (U - L)) ** s;
  if (y < L || y > U) return 0;                                       // alvo
  return y <= o.T ? ((y - L) / (o.T - L)) ** s : ((U - y) / (U - o.T)) ** t;
}
export function desejabilidadeGlobal(ys, objs) {
  let lg = 0, sr = 0;
  for (let i = 0; i < ys.length; i++) {
    const d = desejabilidade(ys[i], objs[i]), r = objs[i].r ?? 1;
    if (d <= 0) return 0;
    lg += r * Math.log(d); sr += r;
  }
  return Math.exp(lg / sr);
}

// ---- regiao ------------------------------------------------------------------
function projetar(x, regiao) {
  if (regiao.tipo === "esfera") {
    const n = Math.hypot(...x);
    return n > regiao.raio ? x.map((v) => v * regiao.raio / n) : x;
  }
  return x.map((v) => Math.min(1, Math.max(-1, v)));
}
const limite = (regiao) => (regiao.tipo === "esfera" ? regiao.raio : 1);
function sorteio(k, regiao, rnd) {
  const lim = limite(regiao);
  for (;;) {
    const x = Array.from({ length: k }, () => (2 * rnd() - 1) * lim);
    if (regiao.tipo !== "esfera" || Math.hypot(...x) <= lim) return x;
  }
}

// Maximiza D: amostras aleatorias + busca de padrao (Hooke-Jeeves) a partir das melhores
export function otimizarDesejabilidade(preditores, objs, k, regiao, semente = 12345) {
  objs.forEach((o, i) => conferirObjetivo(o, `resposta ${i + 1}`));
  const rnd = mulberry32(semente), D = (x) => desejabilidadeGlobal(preditores.map((f) => f(x)), objs);
  const cand = [];
  for (let i = 0; i < 400 * k; i++) { const x = sorteio(k, regiao, rnd); cand.push({ x, D: D(x) }); }
  cand.push({ x: new Array(k).fill(0), D: D(new Array(k).fill(0)) });
  cand.sort((a, b) => b.D - a.D);
  let melhor = cand[0];
  for (const c of cand.slice(0, 8)) {
    let x = c.x, f = c.D, passo = 0.25 * limite(regiao);
    while (passo > 1e-7) {
      let melhorou = false;
      for (let j = 0; j < k; j++) for (const sn of [1, -1]) {
        const z = projetar(x.map((v, i) => (i === j ? v + sn * passo : v)), regiao), fz = D(z);
        if (fz > f + 1e-15) { x = z; f = fz; melhorou = true; }
      }
      if (!melhorou) passo /= 2;
    }
    if (f > melhor.D) melhor = { x, D: f };
  }
  const ys = preditores.map((fn) => fn(melhor.x));
  return { x: melhor.x, D: melhor.D, y: ys, d: ys.map((y, i) => desejabilidade(y, objs[i])), semente };
}

// ---- NSGA-II -------------------------------------------------------------------
const domina = (a, b) => { let melhor = false; for (let i = 0; i < a.length; i++) { if (a[i] > b[i]) return false; if (a[i] < b[i]) melhor = true; } return melhor; };

export function ordenarNaoDominado(F) {
  const n = F.length, S = Array.from({ length: n }, () => []), cnt = new Array(n).fill(0), rank = new Array(n), frentes = [[]];
  for (let p = 0; p < n; p++) {
    for (let q = 0; q < n; q++) { if (domina(F[p], F[q])) S[p].push(q); else if (domina(F[q], F[p])) cnt[p]++; }
    if (cnt[p] === 0) { rank[p] = 0; frentes[0].push(p); }
  }
  for (let i = 0; frentes[i].length; i++) {
    const prox = [];
    for (const p of frentes[i]) for (const q of S[p]) if (--cnt[q] === 0) { rank[q] = i + 1; prox.push(q); }
    frentes.push(prox);
  }
  frentes.pop();
  return { frentes, rank };
}
export function distanciaAglomeracao(F, idx) {
  const d = new Map(idx.map((i) => [i, 0])), m = F[0].length;
  for (let o = 0; o < m; o++) {
    const s = [...idx].sort((a, b) => F[a][o] - F[b][o]), lo = F[s[0]][o], hi = F[s[s.length - 1]][o];
    d.set(s[0], Infinity); d.set(s[s.length - 1], Infinity);
    if (hi > lo) for (let i = 1; i < s.length - 1; i++) d.set(s[i], d.get(s[i]) + (F[s[i + 1]][o] - F[s[i - 1]][o]) / (hi - lo));
  }
  return d;
}

// objetivos(x) -> vetor a MINIMIZAR. op: {pop, geracoes, etaC, etaM, pc, semente}
export function nsga2(objetivos, k, regiao, op = {}) {
  const N = op.pop ?? 100, G = op.geracoes ?? 150, etaC = op.etaC ?? 20, etaM = op.etaM ?? 20, pc = op.pc ?? 0.9, pm = 1 / k;
  const rnd = mulberry32(op.semente ?? 12345), lim = limite(regiao);
  const avaliar = (x) => ({ x, f: objetivos(x) });
  const classificar = (P) => {
    const F = P.map((p) => p.f), { frentes, rank } = ordenarNaoDominado(F);
    const cd = new Array(P.length);
    for (const fr of frentes) for (const [i, v] of distanciaAglomeracao(F, fr)) cd[i] = v;
    P.forEach((p, i) => { p.rank = rank[i]; p.cd = cd[i]; });
    return frentes;
  };
  const torneio = (P) => { const a = P[Math.floor(rnd() * P.length)], b = P[Math.floor(rnd() * P.length)];
    return a.rank < b.rank || (a.rank === b.rank && a.cd > b.cd) ? a : b; };
  const sbx = (a, b) => {
    const c1 = [...a], c2 = [...b];
    if (rnd() > pc) return [c1, c2];
    for (let j = 0; j < k; j++) {
      if (rnd() > 0.5 || Math.abs(a[j] - b[j]) < 1e-14) continue;
      const u = rnd(), beta = u <= 0.5 ? (2 * u) ** (1 / (etaC + 1)) : (1 / (2 * (1 - u))) ** (1 / (etaC + 1));
      c1[j] = 0.5 * ((1 + beta) * a[j] + (1 - beta) * b[j]); c2[j] = 0.5 * ((1 - beta) * a[j] + (1 + beta) * b[j]);
    }
    return [c1, c2];
  };
  const mutar = (x) => x.map((v) => {
    if (rnd() >= pm) return v;
    const u = rnd(), d = u < 0.5 ? (2 * u) ** (1 / (etaM + 1)) - 1 : 1 - (2 * (1 - u)) ** (1 / (etaM + 1));
    return v + d * 2 * lim;
  });
  let P = Array.from({ length: N }, () => avaliar(sorteio(k, regiao, rnd)));
  classificar(P);                                          // populacao inicial ja ranqueada
  for (let g = 0; g < G; g++) {
    const Q = [];
    while (Q.length < N) {
      const [c1, c2] = sbx(torneio(P).x, torneio(P).x);
      Q.push(avaliar(projetar(mutar(c1), regiao)));
      if (Q.length < N) Q.push(avaliar(projetar(mutar(c2), regiao)));
    }
    const R = [...P, ...Q], frentes = classificar(R), prox = [];
    for (const fr of frentes) {
      if (prox.length + fr.length <= N) { for (const i of fr) prox.push(R[i]); continue; }
      const resto = [...fr].sort((a, b) => R[b].cd - R[a].cd);
      for (const i of resto.slice(0, N - prox.length)) prox.push(R[i]);
      break;
    }
    P = prox;
    classificar(P);
  }
  // frente final sem duplicatas
  const vistos = new Set(), frente = [];
  for (const p of P.filter((q) => q.rank === 0)) {
    const ch = p.x.map((v) => v.toFixed(6)).join("|");
    if (!vistos.has(ch)) { vistos.add(ch); frente.push(p); }
  }
  return { frente, semente: op.semente ?? 12345, geracoes: G, pop: N };
}

// ---- TOPSIS -----------------------------------------------------------------
// M: alternativas x criterios; beneficio[j]: true = maior e melhor; pesos (somam 1 depois)
export function topsis(M, beneficio, pesos) {
  const m = M[0].length, sw = pesos.reduce((s, v) => s + v, 0), w = pesos.map((v) => v / sw);
  const norma = Array.from({ length: m }, (_, j) => Math.sqrt(M.reduce((s, l) => s + l[j] ** 2, 0)) || 1);
  const V = M.map((l) => l.map((v, j) => w[j] * v / norma[j]));
  const ideal = [...Array(m).keys()].map((j) => (beneficio[j] ? Math.max : Math.min)(...V.map((l) => l[j])));
  const anti = [...Array(m).keys()].map((j) => (beneficio[j] ? Math.min : Math.max)(...V.map((l) => l[j])));
  const prox = V.map((l) => {
    const dp = Math.sqrt(l.reduce((s, v, j) => s + (v - ideal[j]) ** 2, 0)), dn = Math.sqrt(l.reduce((s, v, j) => s + (v - anti[j]) ** 2, 0));
    return dp + dn > 0 ? dn / (dp + dn) : 0;
  });
  const ordem = [...prox.keys()].sort((a, b) => prox[b] - prox[a] || a - b);   // empate: a primeira
  return { proximidade: prox, ordem, melhor: ordem[0] };
}

// Otimizacao completa: preditores (um por resposta), objetivos, k e regiao
export function otimizar(preditores, objs, nomes, k, regiao, op = {}) {
  const semente = op.semente ?? 12345;
  const desej = otimizarDesejabilidade(preditores, objs, k, regiao, semente);
  const crit = (y, o) => (o.tipo === "max" ? -y : o.tipo === "min" ? y : Math.abs(y - o.T));
  const ns = nsga2((x) => preditores.map((f, i) => crit(f(x), objs[i])), k, regiao, { ...op, semente });
  const ys = ns.frente.map((p) => preditores.map((f) => f(p.x)));
  const M = ys.map((y) => y.map((v, i) => (objs[i].tipo === "alvo" ? Math.abs(v - objs[i].T) : v)));
  const tp = topsis(M, objs.map((o) => o.tipo === "max"), objs.map((o) => o.peso ?? 1));
  const pareto = ns.frente.map((p, i) => ({ x: p.x, y: ys[i], D: desejabilidadeGlobal(ys[i], objs), proximidade: tp.proximidade[i] }));
  return { semente, regiao, nomes, desejabilidade: desej, pareto, topsis: pareto[tp.melhor], nsga: { pop: ns.pop, geracoes: ns.geracoes } };
}
