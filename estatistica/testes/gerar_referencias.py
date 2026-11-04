"""gerar_referencias.py - respostas de referencia do modulo de estatistica (SciPy/statsmodels).

Gera testes/referencias.json, comparado por teste_estatistica.js (Node) e pelo
autoteste do navegador. Nada aqui e digitado a mao: os dados extras saem de um
gerador com semente fixa e as respostas, do SciPy, statsmodels e numpy.

Uso:  py -m pip install numpy scipy statsmodels
      python estatistica/testes/gerar_referencias.py
"""
import json
import os
import sys

import numpy as np
import scipy
import statsmodels
from scipy import special, stats

AQUI = os.path.dirname(os.path.abspath(__file__))
SEMENTE = 20261104


def distribuicoes():
    r = {}
    r["lnGama"] = [[x, float(special.gammaln(x))] for x in [0.1, 0.5, 1, 1.5, 2.5, 7, 10.3, 50, 171.5]]
    r["betaReg"] = [[x, a, b, float(special.betainc(a, b, x))]
                    for x, a, b in [(0.3, 2, 3), (0.9, 0.5, 0.5), (0.01, 6, 0.5), (0.999, 30, 2), (0.5, 100, 120)]]
    r["gamaReg"] = [[a, x, float(special.gammainc(a, x)), float(special.gammaincc(a, x))]
                    for a, x in [(0.5, 0.1), (1, 2), (3, 0.5), (10, 15), (50, 30), (2.5, 40)]]
    r["pnorm"] = [[z, float(stats.norm.cdf(z)), float(stats.norm.sf(z))] for z in [-8, -3, -1.96, 0, 0.5, 2.5, 6, 9]]
    r["qnorm"] = [[p, float(stats.norm.ppf(p))] for p in [1e-300, 1e-12, 1e-4, 0.025, 0.3, 0.5, 0.8, 0.975, 0.999999]]
    r["pt"] = [[t, gl, float(stats.t.cdf(t, gl)), float(2 * stats.t.sf(abs(t), gl))]
               for t, gl in [(-3, 2), (0.5, 5), (2.1, 12), (4.5, 30), (12, 8), (1.96, 1000)]]
    r["qt"] = [[p, gl, float(stats.t.ppf(p, gl))] for p, gl in [(0.975, 1), (0.975, 4), (0.95, 16), (0.995, 30), (0.025, 7)]]
    r["pfC"] = [[f, d1, d2, float(stats.f.sf(f, d1, d2))]
                for f, d1, d2 in [(0.5, 3, 16), (3.24, 3, 16), (248.5, 3, 16), (1.2, 10, 40), (40, 1, 4), (2, 6, 3)]]
    r["qf"] = [[p, d1, d2, float(stats.f.ppf(p, d1, d2))] for p, d1, d2 in [(0.95, 3, 16), (0.99, 1, 8), (0.95, 10, 40)]]
    r["pchisq"] = [[x, gl, float(stats.chi2.cdf(x, gl)), float(stats.chi2.sf(x, gl))]
                   for x, gl in [(0.5, 1), (3.84, 1), (10, 5), (40, 20), (150, 100)]]
    r["qchisq"] = [[p, gl, float(stats.chi2.ppf(p, gl))] for p, gl in [(0.95, 1), (0.95, 5), (0.01, 10), (0.999, 3)]]
    # amplitude studentizada (Tukey): k medias, gl do erro
    r["ptukey"] = [[q, k, gl, float(stats.studentized_range.cdf(q, k, gl))]
                   for q, k, gl in [(3.77, 3, 12), (2.0, 4, 16), (4.5, 5, 20), (1.0, 2, 5), (6.0, 8, 30), (3.5, 3, 200)]]
    r["qtukey"] = [[p, k, gl, float(stats.studentized_range.ppf(p, k, gl))]
                   for p, k, gl in [(0.95, 3, 12), (0.95, 4, 16), (0.99, 5, 20), (0.95, 2, 5), (0.95, 10, 60)]]
    # Shapiro-Wilk (SciPy usa o mesmo algoritmo AS R94)
    rng = np.random.default_rng(SEMENTE)
    amostras = []
    for n, tipo in [(3, "normal"), (4, "normal"), (5, "uniforme"), (7, "normal"), (11, "exponencial"),
                    (12, "normal"), (20, "uniforme"), (50, "normal"), (200, "exponencial"), (1000, "normal")]:
        x = {"normal": rng.normal(10, 2, n), "uniforme": rng.uniform(0, 1, n), "exponencial": rng.exponential(1, n)}[tipo]
        x = [round(float(v), 6) for v in x]
        W, p = stats.shapiro(x)
        amostras.append({"n": n, "tipo": tipo, "x": x, "W": float(W), "p": float(p)})
    r["shapiro"] = amostras
    return r


def algebra():
    rng = np.random.default_rng(SEMENTE + 1)
    B = rng.normal(0, 1, (5, 5))
    A = B @ B.T + 5 * np.eye(5)                    # simetrica definida positiva
    N = rng.normal(0, 3, (4, 4))                   # geral (nao simetrica)
    val = np.linalg.eigvalsh(A)[::-1]
    return {"A": A.tolist(), "invA": np.linalg.inv(A).tolist(), "detA": float(np.linalg.det(A)),
            "cholA": np.linalg.cholesky(A).tolist(), "autovaloresA": val.tolist(),
            "N": N.tolist(), "invN": np.linalg.inv(N).tolist(), "detN": float(np.linalg.det(N))}


def ler_csv(nome):
    import csv
    with open(os.path.join(AQUI, "..", "exemplos", nome), encoding="utf-8-sig") as arq:
        linhas = list(csv.reader(arq))
    return linhas[0], linhas[1:]


def ref_anova1(grupos, alfa=0.05):
    import pandas as pd
    import statsmodels.formula.api as smf
    from statsmodels.stats.anova import anova_lm
    nomes = list(grupos)
    df = pd.DataFrame([(g, y) for g in nomes for y in grupos[g]], columns=["g", "y"])
    mod = smf.ols("y ~ C(g)", data=df).fit()
    tab = anova_lm(mod, typ=1)
    desc = []
    for g in nomes:
        v = np.array(grupos[g])
        ic = stats.t.interval(1 - alfa, len(v) - 1, loc=v.mean(), scale=stats.sem(v))
        desc.append({"nome": g, "n": len(v), "media": v.mean(), "dp": v.std(ddof=1), "mediana": float(np.median(v)),
                     "min": v.min(), "max": v.max(), "cv": 100 * v.std(ddof=1) / abs(v.mean()), "icInf": ic[0], "icSup": ic[1]})
    th = stats.tukey_hsd(*[grupos[g] for g in nomes])
    ci = th.confidence_interval(1 - alfa)
    tukey = [{"a": nomes[i], "b": nomes[j], "dif": th.statistic[i, j], "p": th.pvalue[i, j],
              "icInf": ci.low[i, j], "icSup": ci.high[i, j]}
             for i in range(len(nomes)) for j in range(i + 1, len(nomes))]
    sw = stats.shapiro(mod.resid)
    lev = stats.levene(*[grupos[g] for g in nomes], center="median")
    r = {"grupos": [{"nome": g, "valores": grupos[g]} for g in nomes], "alfa": alfa, "desc": desc,
         "entre": {"gl": tab.df.iloc[0], "sq": tab.sum_sq.iloc[0], "F": tab.F.iloc[0], "p": tab["PR(>F)"].iloc[0]},
         "dentro": {"gl": tab.df.iloc[1], "sq": tab.sum_sq.iloc[1]},
         "R2": mod.rsquared, "R2aj": mod.rsquared_adj, "tukey": tukey,
         "shapiro": {"W": sw.statistic, "p": sw.pvalue}, "levene": {"F": lev.statistic, "p": lev.pvalue}}
    return json.loads(json.dumps(r, default=float))


def anova1():
    cab, linhas = ler_csv("exemplo_anova_univariado.csv")
    ex = {}
    for g, y in linhas:
        ex.setdefault(g, []).append(float(y))
    rng = np.random.default_rng(SEMENTE + 2)
    desb = {}
    for nome, n, mu in [("T1", 5, 50), ("T2", 8, 53), ("T3", 6, 49), ("T4", 10, 56)]:
        desb[nome] = [round(float(v), 3) for v in rng.normal(mu, 3, n)]
    return {"exemplo": ref_anova1(ex), "desbalanceado": ref_anova1(desb, alfa=0.10)}


LETRAS = "ABCDEFG"


def ref_fat2k(X, y, alfa=0.05, termos=None):
    """OLS do statsmodels com colunas +-1 por efeito e indicador de ponto central."""
    import itertools
    import pandas as pd
    import statsmodels.api as sm
    from statsmodels.stats.anova import anova_lm
    X, y = np.array(X, float), np.array(y, float)
    k = X.shape[1]
    masks = list(range(1, 2 ** k))                      # ordem de Yates
    rot = ["".join(LETRAS[j] for j in range(k) if m >> j & 1) for m in masks]
    cols = {r: np.prod([X[:, j] for j in range(k) if m >> j & 1], axis=0) for m, r in zip(masks, rot)}
    usados = [r for r in rot if termos is None or r in termos]
    centro = np.all(X == 0, axis=1).astype(float)
    df = pd.DataFrame({r: cols[r] for r in usados})
    if centro.any():
        df["ctr"] = centro
    df["y"] = y
    formula = "y ~ " + " + ".join(list(usados) + (["ctr"] if centro.any() else []))
    mod = __import__("statsmodels.formula.api", fromlist=["ols"]).ols(formula, data=df).fit()
    efe = {r: 2 * mod.params[r] for r in usados}
    out = {"X": X.tolist(), "y": y.tolist(), "alfa": alfa, "termos": termos,
           "efeitos": [{"rotulo": r, "efeito": efe[r]} for r in usados],
           "R2": mod.rsquared, "glE": mod.df_resid}
    if mod.df_resid > 0:
        tab = anova_lm(mod, typ=1)
        for e in out["efeitos"]:
            e.update({"sq": tab.sum_sq[e["rotulo"]], "F": tab.F[e["rotulo"]], "p": tab["PR(>F)"][e["rotulo"]]})
        out["sqE"] = tab.sum_sq["Residual"]
        out["R2aj"] = mod.rsquared_adj
        if centro.any():
            out["curvatura"] = {"sq": tab.sum_sq["ctr"], "F": tab.F["ctr"], "p": tab["PR(>F)"]["ctr"]}
    else:                                               # sem erro: Lenth (1989) sobre os efeitos do OLS
        a = np.abs([efe[r] for r in usados])
        m = len(a)
        s0 = 1.5 * np.median(a)
        pse = 1.5 * np.median(a[a < 2.5 * s0])
        d = m / 3
        out["lenth"] = {"PSE": pse, "d": d, "ME": stats.t.ppf(1 - alfa / 2, d) * pse,
                        "SME": stats.t.ppf((1 + (1 - alfa) ** (1 / m)) / 2, d) * pse}
        for e in out["efeitos"]:
            e["pLenth"] = 2 * stats.t.sf(abs(e["efeito"]) / pse, d)
    return json.loads(json.dumps(out, default=float))


def fatorial():
    cab, linhas = ler_csv("exemplo_2k_fatorial.csv")
    X = [[float(v) for v in l[:3]] for l in linhas]
    y = [float(l[3]) for l in linhas]
    rng = np.random.default_rng(SEMENTE + 3)
    # 2^4 sem replica: A = 8, C = -6, AD = 4 (efeitos), ruido DP 1,5
    X4 = [[1 if c >> j & 1 else -1 for j in range(4)] for c in range(16)]
    y4 = [round(60 + 4 * x[0] - 3 * x[2] + 2 * x[0] * x[3] + rng.normal(0, 1.5), 3) for x in X4]
    # 2^2 com 2 replicas e 5 pontos centrais, resposta com curvatura
    Xc, yc = [], []
    for c in range(4):
        x = [1 if c >> j & 1 else -1 for j in range(2)]
        for _ in range(2):
            Xc.append(x)
            yc.append(round(40 + 3 * x[0] + 1.5 * x[1] - 2 * x[0] ** 2 + rng.normal(0, 0.5), 3))
    for _ in range(5):
        Xc.append([0, 0])
        yc.append(round(40 + rng.normal(0, 0.5), 3))
    return {"exemplo": ref_fat2k(X, y), "exemplo_reduzido": ref_fat2k(X, y, termos=["A", "B", "C", "AB"]),
            "sem_replica": ref_fat2k(X4, y4, alfa=0.05), "centrais": ref_fat2k(Xc, yc, alfa=0.05)}


def ref_ccd(X, Y, respostas, alfa=0.05):
    """OLS quadratico completo (statsmodels) por resposta; erro puro de todos os pontos repetidos."""
    import pandas as pd
    import statsmodels.formula.api as smf
    X = np.array(X, float)
    k = X.shape[1]
    nomes = [f"x{j + 1}" for j in range(k)]
    lin = nomes
    quad = [f"I({n} ** 2)" for n in nomes]
    inter = [f"{nomes[i]}:{nomes[j]}" for i in range(k) for j in range(i + 1, k)]
    ordem = ["Intercept"] + lin + quad + inter          # mesma ordem de ccd.js
    out = {"X": X.tolist(), "Y": [list(map(float, l)) for l in Y], "respostas": respostas, "alfa": alfa, "r": []}
    chaves = [tuple(np.round(x, 6)) for x in X]
    for r, nome in enumerate(respostas):
        y = np.array([l[r] for l in Y], float)
        df = pd.DataFrame(X, columns=nomes)
        df["y"] = y
        mod = smf.ols("y ~ " + " + ".join(lin + quad + inter), data=df).fit()
        h = mod.get_influence().hat_matrix_diag
        press = float(np.sum((mod.resid / (1 - h)) ** 2))
        sqT = float(np.sum((y - y.mean()) ** 2))
        sqEP, glEP = 0.0, 0
        for c in set(chaves):
            idx = [i for i, ch in enumerate(chaves) if ch == c]
            if len(idx) > 1:
                sqEP += float(np.sum((y[idx] - y[idx].mean()) ** 2))
                glEP += len(idx) - 1
        glLoF = int(mod.df_resid) - glEP
        sqLoF = mod.ssr - sqEP
        FLoF = (sqLoF / glLoF) / (sqEP / glEP)
        b = np.array([mod.params[n] for n in lin])
        B = np.zeros((k, k))
        for i in range(k):
            B[i, i] = mod.params[quad[i]]
        for i in range(k):
            for j in range(i + 1, k):
                B[i, j] = B[j, i] = mod.params[f"{nomes[i]}:{nomes[j]}"] / 2
        xs = -0.5 * np.linalg.solve(B, b)
        out["r"].append({
            "nome": nome, "coef": [mod.params[t] for t in ordem], "ep": [mod.bse[t] for t in ordem],
            "t": [mod.tvalues[t] for t in ordem], "p": [mod.pvalues[t] for t in ordem],
            "R2": mod.rsquared, "R2aj": mod.rsquared_adj, "F": mod.fvalue, "pF": mod.f_pvalue, "sqRes": mod.ssr,
            "glRes": mod.df_resid, "sqEP": sqEP, "glEP": glEP, "FLoF": FLoF, "pLoF": stats.f.sf(FLoF, glLoF, glEP),
            "press": press, "R2pred": 1 - press / sqT, "xs": xs.tolist(),
            "ys": float(mod.params["Intercept"] + 0.5 * xs @ b), "autovalores": np.linalg.eigvalsh(B)[::-1].tolist()})
    return json.loads(json.dumps(out, default=float))


def ccd():
    cab, linhas = ler_csv("exemplo_ccd.csv")
    X = [[float(v) for v in l[:2]] for l in linhas]
    Y = [[float(v) for v in l[2:]] for l in linhas]
    # CCD k = 3 rotacional (alfa = 8^(1/4)), 6 centrais e um ponto fatorial repetido
    rng = np.random.default_rng(SEMENTE + 4)
    a = 8 ** 0.25
    X3 = [[1 if c >> j & 1 else -1 for j in range(3)] for c in range(8)] + [[1, 1, 1]]
    for j in range(3):
        for s in (-a, a):
            x = [0.0, 0.0, 0.0]
            x[j] = s
            X3.append(x)
    X3 += [[0.0, 0.0, 0.0]] * 6
    Y3 = []
    for x1, x2, x3 in X3:
        y1 = 80 + 2 * x1 + 1.5 * x2 - x3 - 3 * x1 ** 2 - 2 * x2 ** 2 - 1.5 * x3 ** 2 + 0.8 * x1 * x2 + rng.normal(0, 0.6)
        y2 = 20 + x1 - 0.5 * x2 + 2 * x1 ** 2 - 1.5 * x2 ** 2 + 0.5 * x3 ** 2 + x2 * x3 + rng.normal(0, 0.4)
        Y3.append([round(y1, 3), round(y2, 3)])
    return {"exemplo": ref_ccd(X, Y, cab[2:]), "k3": ref_ccd(X3, Y3, ["rendimento", "custo"])}


SECOES = {"distribuicoes": distribuicoes, "algebra": algebra, "anova1": anova1, "fatorial2k": fatorial, "ccd": ccd}

if __name__ == "__main__":
    ref = {"_gerado_por": f"gerar_referencias.py | python {sys.version.split()[0]} | numpy {np.__version__} | "
                          f"scipy {scipy.__version__} | statsmodels {statsmodels.__version__} | semente {SEMENTE}"}
    for nome, f in SECOES.items():
        ref[nome] = f()
    with open(os.path.join(AQUI, "referencias.json"), "w", encoding="utf-8") as arq:
        json.dump(ref, arq, ensure_ascii=False, indent=1)
    # mesma coisa como modulo JS: o autoteste do navegador importa (a CSP bloqueia fetch)
    with open(os.path.join(AQUI, "referencias.js"), "w", encoding="utf-8") as arq:
        arq.write("// gerado por gerar_referencias.py: nao editar\nexport default ")
        json.dump(ref, arq, ensure_ascii=False)
        arq.write(";\n")
    print("referencias.json:", ", ".join(SECOES))
