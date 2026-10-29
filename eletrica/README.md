# Grandezas elétricas (LabForce NUPEF)

Manual técnico de uso: [`manual.html`](manual.html) (14 seções, ASD-STE100 em português, com verificação no navegador).

Análise de ensaios de potência elétrica em máquinas-ferramenta. A aquisição é feita com ESP32, em sistema trifásico a 4 fios (3F+N), e a análise roda **no navegador**. É o porte da rotina Scilab `Potencias_Eletricas v5.3.3` (IFG Câmpus Goiânia). O método e os resultados são os mesmos.

- **Sem servidor e sem nuvem.** O processamento é todo local. A página não envia dados pela rede: a CSP tem `connect-src 'none'`.
- **Sem dependências e sem build.** HTML, CSS e JS puro (módulos ES). É publicado como está no GitHub Pages.
- **Resultados gravados direto na pasta escolhida** (Chrome/Edge). Nos outros navegadores, os resultados saem num `.zip`.

## Uso

1. **Ligação 3F+N.** Conferir o esquemático e confirmar.
2. **Configuração:**
   - calibração por canal (Amarela, Vermelha ou personalizada);
   - número de faixas por ensaio, com ou sem zoom;
   - grandezas a calcular (FFT, IEEE 519, IEEE 1459, gráficos);
   - parâmetros avançados: rede, média móvel, faixa mínima, Isc/IL, IL e atraso entre canais.

   A configuração fica lembrada neste navegador.
3. **Pasta e arquivos:**
   - escolher a pasta de resultados uma vez (o navegador lembra);
   - escolher ou arrastar os `.txt` do ESP32. São 6 colunas, `Va Vb Vc Ia Ib Ic`, em contagens do ADC; as linhas de texto do cabeçalho são ignoradas.
4. **Faixas.** Em cada ensaio, clicar no gráfico da potência suavizada: início e fim de cada faixa. Com zoom, os 2 primeiros cliques delimitam a região. `Ctrl+Z` desfaz o último clique.
5. **Resultados.** Ficam na pasta `resultados_AAAAMMDD_hhmmss`. Cada ensaio é gravado assim que termina.

A taxa de amostragem é detectada em cada ensaio pela frequência da rede e arredondada para o valor ajustado no firmware, com aviso `FS_INSTAVEL` se variar mais de 0,5 %. Não há parâmetro para isso.

### Arquivos gerados (mesmos nomes da v5.3.3)

| Arquivo | Conteúdo |
|---|---|
| `dados_obtidos.csv` | Pt, U, Ief, t, St, FP, f1, fs por faixa (separador espaço, vírgula decimal) |
| `ieee519_resumo.csv`, `<faixa>_IEEE519_harmonicos.csv` | THDv, TDD, harmônicos por grupo, limites, LD, situação |
| `ieee1459_resumo.csv` | P, Se, PF, Ve, Ie, In, S1+, PF1+, SU1, desequilíbrios, THDe, SeN... |
| `relatorio.txt` | Tudo o que a rotina reporta (parâmetros, fs, avisos, resultados) |
| `<faixa>_espectro.png`, `_IEEE519.png`, `_IEEE1459.png` | Gráficos (opcional) |
| `<ensaio>_faixas.png` | **Novo:** registro das faixas selecionadas no sinal |

## Navegadores

| Navegador | Gravação |
|---|---|
| Chrome, Edge (desktop) | Direto na pasta escolhida (File System Access API) |
| Firefox, Safari, celular | Download de `resultados_….zip` no fim da rodada (e pelo botão “Baixar tudo em .zip”) |

## Validação

A versão web foi comparada com o Scilab v5.3.3 nos mesmos arquivos e nas mesmas faixas:

- ensaios reais E1R1 e E8R1;
- ensaios sintéticos a 800, 1000 (taxa instável), 2000 e 333,33 Hz.

Das saídas comparadas, **402 linhas de 402 saíram idênticas**: CSVs, harmônicos e IEEE 1459, incluindo os blocos de 3 s.

```
npm test        # na raiz do repositório; node >= 18, sem instalar nada
```

- `testes/teste_unidades.js`: FFT para qualquer N contra a DFT direta, formatos, limites, 519/1459 sintéticos, leitura e zip.
- `testes/teste_golden.js`: comparação com `testes/golden/*.txt` (os ensaios reais E1R1/E8R1 e as referências deles não estão no repositório público; copie-os para `testes/dados` e `testes/golden` para incluí-los). Para regenerar a referência, rode `testes/golden.sce` no Scilab 2024.

## Estrutura

```
index.html          interface (5 etapas)
css/estilo.css
js/nucleo.js        funcoesPotencia.sci (RMS, média móvel, fs, FFT, DFT por janela, mapa de raias)
js/ieee519.js       qualidadeIEEE519.sci
js/ieee1459.js      potenciasIEEE1459.sci
js/analise.js       laço principal do .sce (ensaio -> faixas -> linhas de CSV e relatório)
js/figuras.js       figuras da análise (espectro, IEEE 519, IEEE 1459)
js/autoteste.js     verificação (manual, seção 6)
../comum/js/        FFT, gráficos, seleção de faixas, gravação em pasta/zip, interface comum
js/app.js           interface
img/                esquemático 3F+N e ícone
testes/             testes, dados e referência do Scilab
```

## Publicação (GitHub Pages)

Publicada junto com a página inicial (ver README da raiz). Endereço: `/eletrica/`.

## Limitações

- **IEEE 519 e 1459 são indicativos.** A medição é no quadro da máquina, não no PCC. Os limites e as hipóteses estão nos cabeçalhos de `js/ieee519.js` e `js/ieee1459.js`.
- **A corrente de neutro In é calculada, não medida.** Confira com alicate amperímetro.
- **O processamento roda na thread principal.** Ensaios muito longos (por exemplo, 6 kHz × 10 min) deixam a página ocupada por alguns segundos.
