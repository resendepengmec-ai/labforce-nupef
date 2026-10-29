// manual.js - comportamento das paginas de manual: botao de impressao e
// verificacao (autoteste do modulo) executada no proprio navegador.
const bt = document.getElementById("btVerificar"), res = document.getElementById("resVerificar");
const imp = document.getElementById("btImprimir");
if (imp) imp.addEventListener("click", () => window.print());
if (bt && res) {
  bt.addEventListener("click", async () => {
    bt.disabled = true; res.className = "res"; res.textContent = "Executando a verificação…";
    await new Promise((ok) => setTimeout(ok, 30));
    const t0 = performance.now();
    try {
      const { autoteste } = await import(new URL(bt.dataset.modulo, document.baseURI).href);
      const r = await autoteste();
      const s = ((performance.now() - t0) / 1000).toFixed(1).replace(".", ",");
      if (r.falhas.length) { res.className = "res falha"; res.textContent = `FALHA: ${r.falhas.length} verificação(ões) com erro (${r.nOK} OK, ${s} s):\n- ${r.falhas.join("\n- ")}`; }
      else { res.className = "res ok"; res.textContent = `${bt.dataset.nome}: ${r.nOK} verificações OK (${s} s).`; }
    } catch (e) { res.className = "res falha"; res.textContent = "FALHA: a verificação parou com erro: " + e.message; }
    bt.disabled = false;
  });
}
