// algebra.js - algebra linear densa para matrizes pequenas (planejamentos: ate ~100 x 30).
// Matrizes como arrays de linhas (number[][]). Sem bibliotecas.

export const zeros = (n, m) => Array.from({ length: n }, () => new Array(m).fill(0));
export const identidade = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const transposta = (A) => A[0].map((_, j) => A.map((l) => l[j]));

export function produto(A, B) {
  const n = A.length, m = B[0].length, k = B.length, C = zeros(n, m);
  for (let i = 0; i < n; i++) for (let t = 0; t < k; t++) { const a = A[i][t]; if (a) for (let j = 0; j < m; j++) C[i][j] += a * B[t][j]; }
  return C;
}
export const produtoVetor = (A, v) => A.map((l) => l.reduce((s, a, j) => s + a * v[j], 0));

// Inversa por Gauss-Jordan com pivotamento parcial. Tolerancia RELATIVA ao maior
// elemento (a absoluta do eStat falha com dados em escala real). Singular: lanca
// erro com o indice da coluna sem pivo (o termo do modelo que nao e estimavel).
export function inversa(A) {
  const n = A.length, M = A.map((l, i) => [...l, ...identidade(n)[i]]);
  let escala = 0;
  for (const l of A) for (const v of l) escala = Math.max(escala, Math.abs(v));
  const tol = 1e-12 * (escala || 1);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) <= tol) { const e = new Error(`matriz singular (coluna ${c + 1})`); e.coluna = c; throw e; }
    [M[c], M[p]] = [M[p], M[c]];
    const piv = M[c][c];
    for (let j = 0; j < 2 * n; j++) M[c][j] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f) for (let j = 0; j < 2 * n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((l) => l.slice(n));
}

export function determinante(A) {
  const n = A.length, M = A.map((l) => [...l]);
  let d = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (M[p][c] === 0) return 0;
    if (p !== c) { [M[c], M[p]] = [M[p], M[c]]; d = -d; }
    d *= M[c][c];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let j = c; j < n; j++) M[r][j] -= f * M[c][j]; }
  }
  return d;
}

// Cholesky: A = L L' (A simetrica definida positiva). Lanca erro se nao for.
export function cholesky(A) {
  const n = A.length, L = zeros(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) {
        if (!(s > 1e-14 * Math.abs(A[i][i]))) throw new Error("matriz não é definida positiva (Cholesky)");
        L[i][i] = Math.sqrt(s);
      } else L[i][j] = s / L[j][j];
    }
  }
  return L;
}
// Inversa de triangular inferior
export function inversaTriangInf(L) {
  const n = L.length, X = zeros(n, n);
  for (let i = 0; i < n; i++) {
    X[i][i] = 1 / L[i][i];
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i][k] * X[k][j];
      X[i][j] = s / L[i][i];
    }
  }
  return X;
}

// Autovalores e autovetores de matriz simetrica (Jacobi ciclico). Devolve
// {valores (decrescentes), vetores (colunas na mesma ordem)}.
export function autoSimetrica(A) {
  const n = A.length, a = A.map((l) => [...l]), v = identidade(n);
  for (let varr = 0; varr < 100; varr++) {
    let fora = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) fora += a[i][j] ** 2;
    if (fora < 1e-30) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(a[p][q]) < 1e-300) continue;
      const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {             // A <- J' A J
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const ordem = [...Array(n).keys()].sort((i, j) => a[j][j] - a[i][i]);
  return { valores: ordem.map((i) => a[i][i]), vetores: v.map((l) => ordem.map((i) => l[i])) };
}
