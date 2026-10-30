// quadro.js - impede que o site seja usado dentro de outra pagina (clickjacking).
// O GitHub Pages nao permite o cabecalho X-Frame-Options e a CSP em <meta> ignora
// frame-ancestors; por isso a protecao e feita aqui. Carregado sem defer, no <head>.
// Se a pagina estiver num quadro, o conteudo e trocado por um link que abre o site
// na janela inteira (o Chrome bloqueia o redirecionamento automatico sem clique).
if (window.top !== window.self) {
  document.documentElement.style.visibility = "hidden";
  document.addEventListener("DOMContentLoaded", function () {
    var a = document.createElement("a");
    a.href = window.location.href; a.target = "_top"; a.rel = "noopener";
    a.textContent = "Abrir o LabForce NUPEF em uma janela própria";
    document.body.replaceChildren(a);
    document.documentElement.style.visibility = "visible";
  });
}
