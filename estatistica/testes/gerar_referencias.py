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


SECOES = {"distribuicoes": distribuicoes, "algebra": algebra}

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
