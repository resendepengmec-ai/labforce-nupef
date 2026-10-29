# ForceLab

ForceLab e um prototipo didatico para estudar cavaco, forca de corte e parametros de usinagem.

## Como executar

Opcao simples:

1. Abra `index.html` no navegador.

Opcao com servidor local em PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serve.ps1 -Root . -Port 4173
```

Depois acesse:

```text
http://127.0.0.1:4173/
```

## O que existe agora

- Leitura de arquivo TXT/CSV com quatro colunas.
- Mapeamento manual das colunas, por padrao `tempo`, `Fx`, `Fy`, `Fz`.
- Resumo das forcas maximas por eixo e da resultante.
- Previa das primeiras amostras validas do arquivo importado.
- Janela grafica para selecionar uma faixa do sinal.
- Calculo de media, RMS, pico maximo, desvio padrao, coeficiente de variacao, fator de crista, curtose, skewness e frequencia dominante.
- Exportacao CSV da faixa selecionada.
- Calculadora de forca principal de corte mantida no codigo, mas escondida temporariamente na interface.
- Documentacao inicial em `docs/`.

## Arquivos principais

- `index.html`: tela principal.
- `src/parser.js`: leitura e interpretacao do TXT.
- `src/styles.css`: estilos da interface.
- `src/app.js`: logica da calculadora.
- `samples/forcas.txt`: arquivo de exemplo.
- `docs/PROJECT.md`: visao do projeto.
- `docs/FORMULAS.md`: formulas iniciais.
- `docs/NOTES.md`: notas conceituais.

## Observacao

Os calculos atuais usam um modelo simplificado. Os valores devem ser validados contra o PDF de referencia antes de serem tratados como resultado academico formal.

## Formato do TXT

O arquivo pode conter cabecalho. Linhas sem quatro valores numericos sao ignoradas automaticamente.

As quatro colunas numericas podem ser separadas por tabulacao, espaco ou ponto e virgula. Numeros com virgula decimal sao aceitos, por exemplo `10,5`.

Padrao esperado:

```text
Ensaio de forca - exemplo
tempo(s) Fx(N) Fy(N) Fz(N)
0,00	10,5	3,2	18,1
0,01	11,0	3,4	19,0
```

O mapeamento das colunas e feito na tela. O padrao e `tempo`, `Fx`, `Fy`, `Fz`.

Arquivos exportados pelo DynoWare com metadados no inicio, cabecalho `Time Ff (Fx) Fp (Fy) Fc (Fz)`, colunas por tabulacao e decimais com virgula sao aceitos. O arquivo `E1.3.txt` foi validado com 50001 amostras.

## Analise de faixa

Depois de importar o TXT, use `Analisar faixa` para abrir o grafico. Arraste sobre o sinal para selecionar o intervalo desejado. A tabela estatistica, o grafico e o CSV exportado passam a considerar apenas a faixa selecionada. Clique na faixa destacada ou no botao `Baixar CSV` para exportar.
