# Forças de usinagem (LabForce NUPEF)

Análise de sinais de dinamômetro (Fx, Fy, Fz) no navegador. É o mesmo padrão do módulo de grandezas elétricas: etapas, seleção de faixas, gravação direta na pasta (Chrome/Edge) ou em `.zip`. Nenhum dado é enviado para servidor.

- **Manual técnico:** [`manual.html`](manual.html), com 14 seções e redação ASD-STE100 em português. Inclui a verificação no navegador.
- **Entrada:** TXT/CSV com 4 colunas mapeáveis (tempo, Fx, Fy, Fz). Aceita DynoWare: metadados, tab e vírgula decimal.
- **Calibração:** fator por canal (padrão 1,0). Um fator negativo inverte o sentido.
- **Componentes da força:** o operador indica qual canal (Fx, Fy, Fz) mede Fc, Ff e Fp (torneamento) ou FfN, Ff e Fp (fresamento, furação e rosqueamento), conforme a montagem. A análise calcula a força ativa Fa e a razão Fa/Fp (indicador de atrito).
- **Atrito na face da ferramenta (opcional):** μ = FT/FN pela transformação geométrica de Fc e Ff com o ângulo de saída, tensões médias de contato e modelo de atrito com a temperatura, conforme Puls, Klocke e Lung (Wear, v. 310, 2014, DOI 10.1016/j.wear.2013.12.020).
- **Saídas:**
  - `forcas_resumo.csv`;
  - `<faixa>_faixa.csv`;
  - `componentes.csv`;
  - `atrito.csv` (opcional);
  - `corte_teorico.csv` (opcional);
  - PNGs `_faixas`, `_sinal` e `_espectro`;
  - `relatorio.txt`.
- **Força de corte teórica (opcional, torneamento):** modelo da Sandvik Coromant/Kienzle, `kc = kc1·hm^-mc·(1−γ0/100)` e `Fc = kc·ap·fn`. Referência: https://www.sandvik.coromant.com/pt-pt/knowledge/machining-formulas-definitions

## Mudanças em relação ao ForceLab (protótipo)

- **Frequência dominante:** agora é FFT com janela de Hann sobre a faixa inteira. O protótipo reamostrava para no máximo 512 pontos sem filtro, o que dava frequência errada (aliasing) em sinais longos.
- **Calculadora `Fc = kc·ap·f`:** foi substituída pela força teórica de Kienzle, comparada com a força medida.
- **Seleção:** várias faixas por ensaio e vários ensaios por rodada, com resultados gravados em pasta.

`docs/` guarda as notas do protótipo. O manual técnico substitui `docs/FORMULAS.md`.

## Testes

`npm test` na raiz roda `testes/teste_forcas.js`, com 31 verificações.
