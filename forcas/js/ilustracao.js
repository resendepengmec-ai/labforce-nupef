// ilustracao.js - grafico do modelo de atrito com a temperatura (Puls; Klocke; Lung, 2014, eq. 2)
// svgModeloAtrito(q, T) -> texto SVG: curva mu(T) com mu0, T0 e T de fusao marcados e, se T for um
// numero, o ponto mu(T). So recebe numeros (q, T): o texto pode ir para innerHTML sem risco.
// Usado na etapa 2 (atualiza ao digitar) e para gerar img/atrito-modelo.svg do manual.
import { muTermico } from "./nucleo.js";

const TINTA = "#17201c", CINZA = "#5e6a64", GRADE = "#e3e7e4", AZUL = "#2a78d6";
const fmt = (v, d) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",") : "–");

export function svgModeloAtrito(q, T) {
  const W = 520, H = 280, X0 = 64, X1 = W - 20, Y0 = 30, Y1 = H - 52;
  const ok = q.mu0 > 0 && q.Tf > q.T0 && q.m > 0;
  const tmax = Math.max(ok ? q.Tf * 1.08 : 1600, Number.isFinite(T) ? T * 1.05 : 0), ymax = ok ? q.mu0 * 1.2 : 1;
  const px = (t) => X0 + (t / tmax) * (X1 - X0), py = (m) => Y1 - (m / ymax) * (Y1 - Y0);
  const o = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" font-size="13" fill="${TINTA}" role="img" aria-label="Modelo de atrito com a temperatura: μ constante até T0 e caindo até zero na fusão">`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    `<text x="${(X0 + X1) / 2}" y="18" text-anchor="middle" font-weight="600">Modelo de atrito com a temperatura (Puls et al., 2014, eq. 2)</text>`];
  // grade e eixos
  const passoT = tmax > 1200 ? 250 : 200, passoM = ymax > 0.6 ? 0.2 : 0.1;
  for (let t = 0; t <= tmax; t += passoT) o.push(`<line x1="${px(t)}" y1="${Y0}" x2="${px(t)}" y2="${Y1}" stroke="${GRADE}"/><text x="${px(t)}" y="${Y1 + 17}" text-anchor="middle" font-size="12" fill="${CINZA}">${t}</text>`);
  for (let m = 0; m <= ymax + 1e-9; m += passoM) o.push(`<line x1="${X0}" y1="${py(m)}" x2="${X1}" y2="${py(m)}" stroke="${GRADE}"/><text x="${X0 - 8}" y="${py(m) + 4}" text-anchor="end" font-size="12" fill="${CINZA}">${fmt(m, 1)}</text>`);
  o.push(`<line x1="${X0}" y1="${Y1}" x2="${X1}" y2="${Y1}" stroke="${CINZA}"/><line x1="${X0}" y1="${Y0}" x2="${X0}" y2="${Y1}" stroke="${CINZA}"/>`,
    `<text x="${(X0 + X1) / 2}" y="${H - 14}" text-anchor="middle">T: temperatura de contato [°C]</text>`,
    `<text x="16" y="${(Y0 + Y1) / 2}" text-anchor="middle" transform="rotate(-90 16 ${(Y0 + Y1) / 2})">μ [-]</text>`);
  if (!ok) {
    o.push(`<text x="${(X0 + X1) / 2}" y="${(Y0 + Y1) / 2}" text-anchor="middle" fill="${CINZA}">Preencha μ0 &gt; 0, m &gt; 0 e T de fusão maior que T0.</text></svg>`);
    return o.join("");
  }
  // referencias: T0 e fusao (tracejadas) e mu0
  o.push(`<line x1="${px(q.T0)}" y1="${Y0}" x2="${px(q.T0)}" y2="${Y1}" stroke="${CINZA}" stroke-dasharray="5 4"/>`,
    `<text x="${px(q.T0) + 4}" y="${Y0 + 12}" font-size="12" fill="${CINZA}">T0 = ${fmt(q.T0, 0)} °C</text>`,
    `<line x1="${px(q.Tf)}" y1="${Y0}" x2="${px(q.Tf)}" y2="${Y1}" stroke="${CINZA}" stroke-dasharray="5 4"/>`,
    `<text x="${px(q.Tf) - 4}" y="${Y0 + 12}" text-anchor="end" font-size="12" fill="${CINZA}">fusão = ${fmt(q.Tf, 0)} °C</text>`,
    `<text x="${X0 + 6}" y="${py(q.mu0) - 8}" font-size="12">μ0 = ${fmt(q.mu0, 2)}</text>`);
  // curva (2 px)
  const pts = [];
  for (let i = 0; i <= 300; i++) { const t = (tmax * i) / 300; pts.push(`${px(t).toFixed(1)},${py(muTermico(t, q)).toFixed(1)}`); }
  o.push(`<polyline points="${pts.join(" ")}" fill="none" stroke="${AZUL}" stroke-width="2" stroke-linejoin="round"/>`,
    `<text x="${(px(q.T0) + px(q.Tf)) / 2 + 10}" y="${py(muTermico((q.T0 + q.Tf) / 2, q)) - 10}" font-size="12">m = ${fmt(q.m, 2)}</text>`);
  // ponto da temperatura informada
  if (Number.isFinite(T)) {
    const mu = muTermico(T, q), x = px(T), y = py(mu), dir = x > (X0 + X1) / 2 ? -1 : 1;
    o.push(`<circle cx="${x}" cy="${y}" r="5" fill="${AZUL}" stroke="#ffffff" stroke-width="2"><title>T = ${fmt(T, 0)} °C: μ = ${fmt(mu, 3)}</title></circle>`,
      `<text x="${x + dir * 9}" y="${y + 18}" text-anchor="${dir > 0 ? "start" : "end"}" font-size="12" font-weight="600">μ(${fmt(T, 0)} °C) = ${fmt(mu, 3)}</text>`);
  }
  o.push("</svg>");
  return o.join("");
}
