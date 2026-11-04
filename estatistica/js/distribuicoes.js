// distribuicoes.js - funcoes especiais e distribuicoes de probabilidade, sem bibliotecas.
//   lnGama (Lanczos), beta incompleta regularizada (fracao continua de Lentz),
//   gama incompleta regularizada (serie / fracao continua);
//   normal (quantil: AS 241, Wichura 1988), t, F e qui-quadrado (CDF, cauda superior, quantil);
//   amplitude studentizada (ptukey/qtukey: Copenhaver e Holland 1988, mesma base do R);
//   Shapiro-Wilk (Royston 1995, AS R94), 3 <= n <= 5000.
// Validadas contra o SciPy (testes/referencias.json).

const LANCZOS = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lnGama(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGama(1 - x);
  x -= 1;
  let a = LANCZOS[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LANCZOS[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ---- beta incompleta regularizada I_x(a, b) -----------------------------------
function fracaoBeta(a, b, x) {           // fracao continua (Lentz modificado)
  const MIN = 1e-300, EPS = 1e-15;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < MIN) d = MIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 1000; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < MIN) d = MIN;
    c = 1 + aa / c; if (Math.abs(c) < MIN) c = MIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < MIN) d = MIN;
    c = 1 + aa / c; if (Math.abs(c) < MIN) c = MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
export function betaReg(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const ln = lnGama(a + b) - lnGama(a) - lnGama(b) + a * Math.log(x) + b * Math.log1p(-x);
  if (x < (a + 1) / (a + b + 2)) return Math.exp(ln) * fracaoBeta(a, b, x) / a;
  return 1 - Math.exp(ln) * fracaoBeta(b, a, 1 - x) / b;
}
// 1 - I_x(a, b) sem cancelamento (cauda superior)
const betaRegC = (x, a, b) => betaReg(1 - x, b, a);

// ---- gama incompleta regularizada P(a, x) e Q(a, x) ----------------------------
function gamaSerie(a, x) {
  let ap = a, soma = 1 / a, del = soma;
  for (let n = 0; n < 2000; n++) { ap += 1; del *= x / ap; soma += del; if (Math.abs(del) < Math.abs(soma) * 1e-16) break; }
  return soma * Math.exp(-x + a * Math.log(x) - lnGama(a));
}
function gamaFracao(a, x) {             // Q(a, x) por fracao continua (Lentz)
  const MIN = 1e-300;
  let b = x + 1 - a, c = 1 / MIN, d = 1 / b, h = d;
  for (let i = 1; i <= 2000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < MIN) d = MIN;
    c = b + an / c; if (Math.abs(c) < MIN) c = MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGama(a)) * h;
}
export function gamaReg(a, x) {          // P(a, x)
  if (x <= 0) return 0;
  return x < a + 1 ? gamaSerie(a, x) : 1 - gamaFracao(a, x);
}
export function gamaRegC(a, x) {         // Q(a, x) = 1 - P(a, x)
  if (x <= 0) return 1;
  return x < a + 1 ? 1 - gamaSerie(a, x) : gamaFracao(a, x);
}

// ---- normal ------------------------------------------------------------------
// erfc(x) = Q(1/2, x^2) para x >= 0: cauda precisa sem cancelamento
function erfc(x) { return x >= 0 ? gamaRegC(0.5, x * x) : 2 - gamaRegC(0.5, x * x); }
export const pnorm = (z) => 0.5 * erfc(-z / Math.SQRT2);
export const pnormC = (z) => 0.5 * erfc(z / Math.SQRT2);   // cauda superior

// Quantil da normal padrao: algoritmo AS 241 (PPND16), Wichura (1988), erro ~1e-16
export function qnorm(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const q = p - 0.5;
  if (Math.abs(q) <= 0.425) {
    const r = 0.180625 - q * q;
    return q * (((((((2509.0809287301226727 * r + 33430.575583588128105) * r + 67265.770927008700853) * r
      + 45921.953931549871457) * r + 13731.693765509461125) * r + 1971.5909503065514427) * r + 133.14166789178437745) * r
      + 3.387132872796366608) / (((((((5226.495278852545925 * r + 28729.085735721942674) * r + 39307.89580009271061) * r
      + 21213.794301586595867) * r + 5394.1960214247511077) * r + 687.1870074920579083) * r + 42.313330701600911252) * r + 1);
  }
  let r = q < 0 ? p : 1 - p;
  r = Math.sqrt(-Math.log(r));
  let v;
  if (r <= 5) {
    r -= 1.6;
    v = (((((((7.7454501427834140764e-4 * r + 0.0227238449892691845833) * r + 0.24178072517745061177) * r
      + 1.27045825245236838258) * r + 3.64784832476320460504) * r + 5.7694972214606914055) * r + 4.6303378461565452959) * r
      + 1.42343711074968357734) / (((((((1.05075007164441684324e-9 * r + 5.475938084995344946e-4) * r + 0.0151986665636164571966) * r
      + 0.14810397642748007459) * r + 0.68976733498510000455) * r + 1.6763848301838038494) * r + 2.05319162663775882187) * r + 1);
  } else {
    r -= 5;
    v = (((((((2.01033439929228813265e-7 * r + 2.71155556874348757815e-5) * r + 0.0012426609473880784386) * r
      + 0.026532189526576123093) * r + 0.29656057182850489123) * r + 1.7848265399172913358) * r + 5.4637849111641143699) * r
      + 6.6579046435011037772) / (((((((2.04426310338993978564e-15 * r + 1.4215117583164458887e-7) * r + 1.8463183175100546818e-5) * r
      + 7.868691311456132591e-4) * r + 0.0148753612908506148525) * r + 0.13692988092273580531) * r + 0.59983220655588793769) * r + 1);
  }
  return q < 0 ? -v : v;
}

// ---- t de Student, F e qui-quadrado -----------------------------------------
export function pt(t, gl) {               // P(T <= t)
  const c = 0.5 * betaReg(gl / (gl + t * t), gl / 2, 0.5);
  return t > 0 ? 1 - c : c;
}
export function ptC(t, gl) { return pt(-t, gl); }                      // P(T > t)
export const ptBilateral = (t, gl) => betaReg(gl / (gl + t * t), gl / 2, 0.5);   // P(|T| > |t|)

export function pf(f, d1, d2) { return f <= 0 ? 0 : betaReg(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2); }
export function pfC(f, d1, d2) { return f <= 0 ? 1 : betaRegC(d1 * f / (d1 * f + d2), d1 / 2, d2 / 2); }   // valor-p do F

export const pchisq = (x, gl) => gamaReg(gl / 2, x / 2);
export const pchisqC = (x, gl) => gamaRegC(gl / 2, x / 2);

// Quantil por bissecao sobre a CDF (monotona): robusto; poucas chamadas por analise
function inverter(cdf, p, lo, hi) {
  if (!(p > 0 && p < 1)) return p <= 0 ? lo : Infinity;
  while (cdf(hi) < p) { lo = hi; hi *= 2; if (hi > 1e300) return Infinity; }
  for (let i = 0; i < 300; i++) {
    const m = 0.5 * (lo + hi);
    if (cdf(m) < p) lo = m; else hi = m;
    if (hi - lo <= 1e-15 * Math.max(1, Math.abs(m))) break;
  }
  return 0.5 * (lo + hi);
}
export function qt(p, gl) {
  if (p === 0.5) return 0;
  if (p < 0.5) return -qt(1 - p, gl);
  return inverter((t) => pt(t, gl), p, 0, 10);
}
export const qf = (p, d1, d2) => inverter((f) => pf(f, d1, d2), p, 0, 10);
export const qchisq = (p, gl) => inverter((x) => pchisq(x, gl), p, 0, Math.max(10, 2 * gl));

// ---- amplitude studentizada (Tukey) ------------------------------------------
// Copenhaver, M. D.; Holland, B. S. (1988). J. Statist. Comput. Simul. 30, 1-15.
// Porte direto do ptukey.c do R. nm: numero de medias; gl: graus de liberdade do erro.
const XLEG = [0.981560634246719250690549090149, 0.904117256370474856678465866119, 0.769902674194304687036893833213,
  0.587317954286617447296702418941, 0.367831498998180193752691536644, 0.125233408511468915472441369464];
const ALEG = [0.047175336386511827194615961485, 0.106939325995318430960254718194, 0.160078328543346226334652529543,
  0.203167426723065921749064455810, 0.233492536538354808760849898925, 0.249147045813402785000562436043];
const XLEGQ = [0.989400934991649932596154173450, 0.944575023073232576077988415535, 0.865631202387831743880467897712,
  0.755404408355003033895101194847, 0.617876244402643748446671764049, 0.458016777657227386342419442984,
  0.281603550779258913230460501460, 0.950125098376374401853193354250e-1];
const ALEGQ = [0.271524594117540948517805724560e-1, 0.622535239386478928628438369944e-1, 0.951585116824927848099251076022e-1,
  0.124628971255533872052476282192, 0.149595988816576732081501730547, 0.169156519395002538189312079030,
  0.182603415044923588866763667969, 0.189450610455068496285396723208];
const RAIZ2PI = Math.sqrt(2 * Math.PI);

function wprob(w, rr, cc) {               // P(amplitude de cc normais < w), rr = 1
  const nleg = 12, ihalf = 6, C1 = -30, C2 = -50, C3 = 60, bb = 8, wlar = 3;
  const qsqz = w * 0.5;
  if (qsqz >= bb) return 1;
  let prW = 2 * pnorm(qsqz) - 1;
  prW = prW >= Math.exp(C2 / cc) ? prW ** cc : 0;
  const wincr = w > wlar ? 2 : 3;
  let blb = qsqz;
  const binc = (bb - qsqz) / wincr;
  let bub = blb + binc, einsum = 0;
  const cc1 = cc - 1;
  for (let wi = 1; wi <= wincr; wi++) {
    let elsum = 0;
    const a = 0.5 * (bub + blb), b = 0.5 * (bub - blb);
    for (let jj = 1; jj <= nleg; jj++) {
      let j, xx;
      if (ihalf < jj) { j = nleg - jj + 1; xx = XLEG[j - 1]; } else { j = jj; xx = -XLEG[j - 1]; }
      const ac = a + b * xx, qexpo = ac * ac;
      if (qexpo > C3) break;
      const rinsum = pnorm(ac) - pnorm(ac - w);
      if (rinsum >= Math.exp(C1 / cc1)) elsum += ALEG[j - 1] * Math.exp(-0.5 * qexpo) * rinsum ** cc1;
    }
    einsum += elsum * (2 * b * cc) / RAIZ2PI;
    blb = bub; bub += binc;
  }
  prW += einsum;
  if (prW <= Math.exp(C1 / rr)) return 0;
  prW = prW ** rr;
  return prW >= 1 ? 1 : prW;
}

export function ptukey(q, nm, gl, rr = 1) {
  if (!(q > 0)) return 0;
  if (!Number.isFinite(q)) return 1;
  if (gl > 25000) return wprob(q, rr, nm);
  const nlegq = 16, ihalfq = 8, eps1 = -30, eps2 = 1e-14;
  const f2 = gl * 0.5, f21 = f2 - 1, ff4 = gl * 0.25;
  const ulen = gl <= 100 ? 1 : gl <= 800 ? 0.5 : gl <= 5000 ? 0.25 : 0.125;
  const f2lf = f2 * Math.log(gl) - gl * Math.LN2 - lnGama(f2) + Math.log(ulen);
  let ans = 0, otsum = 0;
  for (let i = 1; i <= 50; i++) {
    otsum = 0;
    const twa1 = (2 * i - 1) * ulen;
    for (let jj = 1; jj <= nlegq; jj++) {
      let j, t1, u;
      if (ihalfq < jj) { j = jj - ihalfq - 1; u = twa1 + XLEGQ[j] * ulen; t1 = f2lf + f21 * Math.log(u) - u * ff4; }
      else { j = jj - 1; u = twa1 - XLEGQ[j] * ulen; t1 = f2lf + f21 * Math.log(u) - u * ff4; }
      if (t1 >= eps1) otsum += wprob(q * Math.sqrt(u * 0.5), rr, nm) * ALEGQ[j] * Math.exp(t1);
    }
    if (i * ulen >= 1 && otsum <= eps2) break;
    ans += otsum;
  }
  return Math.min(ans, 1);
}
export const ptukeyC = (q, nm, gl) => 1 - ptukey(q, nm, gl);

// Valor inicial de qtukey (R: qinv) e secante
function qinv(p, c, v) {
  const ps = 0.5 - 0.5 * p, yi = Math.sqrt(Math.log(1 / (ps * ps)));
  let t = yi + ((((yi * -0.453642210148e-4 - 0.204231210125) * yi - 0.342242088547) * yi - 1) * yi + 0.322232421088)
    / ((((yi * 0.38560700634e-2 + 0.103537752850) * yi + 0.531103462366) * yi + 0.588581570495) * yi + 0.993484626060e-1);
  if (v < 120) t += (t * t * t + t) / v / 4;
  let q = 0.8832 - 0.2368 * t;
  if (v < 120) q += -1.214 / v + 1.208 * t / v;
  return t * (q * Math.log(c - 1) + 1.4142);
}
export function qtukey(p, nm, gl) {
  let x0 = qinv(p, nm, gl), v0 = ptukey(x0, nm, gl) - p;
  let x1 = v0 > 0 ? Math.max(0, x0 - 1) : x0 + 1, v1 = ptukey(x1, nm, gl) - p;
  for (let it = 0; it < 100; it++) {
    let x = x1 - v1 * (x1 - x0) / (v1 - v0);
    v0 = v1; x0 = x1;
    if (x < 0) x = 0;
    v1 = ptukey(x, nm, gl) - p; x1 = x;
    if (Math.abs(x1 - x0) < 1e-12 * Math.max(1, x1)) return x1;
  }
  return x1;
}

// ---- Shapiro-Wilk (Royston 1995, AS R94) -------------------------------------
const poli = (c, x) => { let r = c[c.length - 1]; for (let i = c.length - 2; i >= 0; i--) r = r * x + c[i]; return r; };

export function shapiroWilk(dados) {
  const x = Array.from(dados).filter(Number.isFinite).sort((a, b) => a - b), n = x.length;
  if (n < 3) return { W: NaN, p: NaN, n, msg: "Shapiro-Wilk precisa de pelo menos 3 valores." };
  if (n > 5000) return { W: NaN, p: NaN, n, msg: "Shapiro-Wilk vale para até 5000 valores." };
  if (x[n - 1] - x[0] < 1e-19 * Math.max(1, Math.abs(x[0]))) return { W: NaN, p: NaN, n, msg: "valores todos iguais" };
  const nn2 = Math.floor(n / 2), a = new Array(nn2);
  if (n === 3) a[0] = Math.SQRT1_2;
  else {
    const an25 = n + 0.25, m = [];
    let summ2 = 0;
    for (let i = 1; i <= nn2; i++) { m.push(qnorm((i - 0.375) / an25)); summ2 += m[i - 1] ** 2; }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2), rsn = 1 / Math.sqrt(n);
    const a1 = poli([0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056], rsn) - m[0] / ssumm2;
    let i1, fac;
    if (n > 5) {
      i1 = 3;
      const a2 = -m[1] / ssumm2 + poli([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2 - 2 * m[1] ** 2) / (1 - 2 * a1 ** 2 - 2 * a2 ** 2));
      a[1] = a2;
    } else {
      i1 = 2;
      fac = Math.sqrt((summ2 - 2 * m[0] ** 2) / (1 - 2 * a1 ** 2));
    }
    a[0] = a1;
    for (let i = i1; i <= nn2; i++) a[i - 1] = -m[i - 1] / fac;
  }
  // W = (soma a_i (x_(n+1-i) - x_(i)))^2 / soma (x - media)^2   (a_i > 0 aqui)
  let num = 0;
  for (let i = 0; i < nn2; i++) num += Math.abs(a[i]) * (x[n - 1 - i] - x[i]);
  let media = 0; for (const v of x) media += v; media /= n;
  let ssq = 0; for (const v of x) ssq += (v - media) ** 2;
  const W = Math.min(num * num / ssq, 1);
  let p;
  if (n === 3) p = Math.max(0, 1.90985931710274 * (Math.asin(Math.sqrt(W)) - 1.04719755119660));
  else {
    let y = Math.log(1 - W), mu, s;
    if (n <= 11) {
      const gama = poli([-2.273, 0.459], n);
      if (y >= gama) return { W, p: 1e-99, n };
      y = -Math.log(gama - y);
      mu = poli([0.544, -0.39978, 0.025054, -6.714e-4], n);
      s = Math.exp(poli([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      const xx = Math.log(n);
      mu = poli([-1.5861, -0.31082, -0.083751, 0.0038915], xx);
      s = Math.exp(poli([-0.4803, -0.082676, 0.0030302], xx));
    }
    p = pnormC((y - mu) / s);
  }
  return { W, p, n };
}
