// dinamometros.js - dinamometros estacionarios Kistler de 3 componentes (Fx, Fy, Fz).
// Dados tecnicos traduzidos do catalogo Kistler "Analyzing and optimizing cutting
// processes" (960-002e-02.26). Valores aproximados (≈) como no catalogo.
// foto: figura do catalogo (eixos e cotas originais); cotas: legenda das letras em pt-BR.
// faixa: faixa de medicao [kN] por canal {min, max}; fn: frequencia natural [kHz].
export const DINAMOMETROS = {
  "9257B": {
    foto: "img/dinamometros/9257B.webp", cotas: "L comprimento, W largura, H altura",
    nome: "9257B", familia: "multicomponente, placa 100×170 mm, até 10 kN",
    usos: ["torneamento", "fresamento"], faixa: { fx: [-5, 5], fy: [-5, 5], fz: [-5, 10] },
    sens: "Fx, Fy ≈ −7,5 pC/N; Fz ≈ −3,7 pC/N", fn: { x: 2.3, y: 2.3, z: 3.5 },
    temp: "0 … 70 °C", dim: "170 × 100 × 60 mm", massa: "7,3 kg",
    obs: "Dinamômetro de uso geral. Fixação na mesa por flanges laterais com furos oblongos. Para torneamento: porta-ferramenta Tipo 9403.",
  },
  "9129AA": {
    foto: "img/dinamometros/9129AA.webp", cotas: "L comprimento, W largura, H altura",
    nome: "9129AA (MidiDyn)", familia: "multicomponente, placa 90×105 mm, até 10 kN",
    usos: ["torneamento", "fresamento"], faixa: { fx: [-10, 10], fy: [-10, 10], fz: [-10, 10] },
    sens: "Fx, Fz ≈ −8 pC/N; Fy ≈ −4,1 pC/N", fn: { x: 3.5, y: 4.5, z: 3.5 },
    temp: "0 … 70 °C", dim: "90 × 105 × 32 mm", massa: "3,2 kg",
    obs: "Sistema modular com adaptadores de máquina e porta-ferramentas. Com adaptador e ferramenta de tornear, a faixa e a frequência natural diminuem (Fx, Fz até 5 kN; Fy até 8 kN; fn ≈ 1,5 a 2,5 kHz).",
  },
  "9119AA2": {
    foto: "img/dinamometros/9119AA2.webp", cotas: "L comprimento, W largura, H altura",
    nome: "9119AA2 (MiniDyn)", familia: "multicomponente, até 4 kN",
    usos: ["torneamento", "fresamento"], faixa: { fx: [-4, 4], fy: [-4, 4], fz: [-4, 4] },
    sens: "Fx, Fz ≈ −26 pC/N; Fy ≈ −13 pC/N", fn: { x: 4.3, y: 4.6, z: 4.4 },
    temp: "−20 … 70 °C", dim: "superfície de fixação 55 × 80 × 26 mm", massa: "1,35 kg",
    obs: "Menores dimensões de montagem. Com adaptador e ferramenta de tornear: Fx, Fz até 2 kN; Fy até 3 kN; fn ≈ 1,25 a 2,5 kHz.",
  },
  "9109AA": {
    foto: "img/dinamometros/9109AA.webp", cotas: "S largura total, D placa de cobertura, H altura",
    nome: "9109AA (MicroDyn)", familia: "multicomponente, placa 30×30 mm, até 500 N",
    usos: ["fresamento"], faixa: { fx: [-0.5, 0.5], fy: [-0.5, 0.5], fz: [-0.5, 0.5] },
    sens: "Fx, Fy ≈ −12,5 pC/N; Fz ≈ −20 pC/N", fn: { x: 15, y: 15, z: 15 },
    temp: "−20 … 70 °C", dim: "30 × 100 × 26 mm", massa: "1,04 kg",
    obs: "Para microusinagem. Frequência natural acima de 15 kHz (sem massa adicional).",
  },
  "9139AA": {
    foto: "img/dinamometros/9139AA.webp", cotas: "L comprimento, W largura, H altura",
    nome: "9139AA (MaxiDyn)", familia: "multicomponente, placa 140×190 mm, até 30 kN",
    usos: ["fresamento"], faixa: { fx: [-30, 30], fy: [-30, 30], fz: [-30, 30] },
    sens: "Fx, Fz ≈ −8,2 pC/N; Fy ≈ −4,2 pC/N", fn: { x: 2.9, y: 2.9, z: 3.0 },
    temp: "−20 … 70 °C", dim: "140 × 190 × 58 mm", massa: "≈ 12,9 kg",
    obs: "Compacto e robusto, para usinagem pesada.",
  },
  "9255C": {
    foto: "img/dinamometros/9255C.webp", cotas: "L comprimento, W largura, H altura",
    nome: "9255C", familia: "multicomponente, placa 260×260 mm, até 60 kN",
    usos: ["fresamento"], faixa: { fx: [-30, 30], fy: [-30, 30], fz: [-10, 60] },
    sens: "Fx, Fy ≈ −7,9 pC/N; Fz ≈ −3,9 pC/N", fn: { x: 2.2, y: 2.2, z: 3.3 },
    temp: "−20 … 70 °C", dim: "260 × 260 × 95 mm", massa: "52 kg",
    obs: "Maior faixa de força da linha. Para usinagem pesada.",
  },
  "9272": {
    foto: "img/dinamometros/9272.webp", cotas: "D diâmetro externo, d furo central, H altura",
    nome: "9272", familia: "4 componentes (Fx, Fy, Fz, Mz), para furação",
    usos: ["fresamento"], faixa: { fx: [-5, 5], fy: [-5, 5], fz: [-5, 20] },
    sens: "Fx, Fy ≈ −7,8 pC/N; Fz ≈ −3,5 pC/N; Mz ≈ −160 pC/N·m", fn: { x: 3.1, y: 3.1, z: 6.3 },
    temp: "0 … 70 °C", dim: "ø100 × ø15 × 70 mm", massa: "4,2 kg",
    obs: "Único estacionário que mede o momento Mz (−200 … 200 N·m) diretamente. Este módulo lê só Fx, Fy e Fz.",
  },
};
export const PADRAO_DINAMOMETRO = "9257B";

// Verifica se algum canal passou de 90 % da faixa de medicao do modelo.
// pico: {fx, fy, fz} maximo valor com sinal; devolve lista de avisos (texto).
export function verificarFaixa(modelo, minimos, maximos) {
  const d = DINAMOMETROS[modelo];
  if (!d) return [];
  const av = [];
  for (const c of ["fx", "fy", "fz"]) {
    const [a, b] = d.faixa[c].map((v) => v * 1000);       // kN -> N
    const lim = 0.9;
    if (maximos[c] > lim * b || minimos[c] < lim * a) {
      av.push(`${c === "fx" ? "Fx" : c === "fy" ? "Fy" : "Fz"} chegou a ${Math.round(maximos[c] > lim * b ? maximos[c] : minimos[c])} N, acima de 90 % da faixa do ${d.nome} (${a} … ${b} N)`);
    }
  }
  return av;
}
