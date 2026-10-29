# ForceLab

## Objetivo

Criar um projeto didatico para estudar e demonstrar conceitos de usinagem relacionados a cavaco, forca de corte e parametros de processo, usando como referencia inicial o material `Analise de Cavaco e Forca.pdf`.

## Problema

Estudantes e profissionais precisam visualizar como variaveis de usinagem influenciam a formacao do cavaco e as forcas envolvidas no corte. O projeto deve transformar esse conteudo em uma experiencia pratica, consultavel e facil de evoluir.

## Publico-alvo

- Estudantes de engenharia, mecanica e areas tecnicas.
- Professores que desejam apoiar aulas com simulacoes simples.
- Pessoas revisando fundamentos de usinagem.

## Escopo inicial

- Organizar os conceitos principais do PDF.
- Criar uma base de conhecimento com definicoes, formulas e exemplos.
- Implementar uma primeira interface para consulta e experimentacao.
- Permitir inserir parametros basicos de corte e visualizar resultados calculados.
- Permitir importar arquivo TXT de medicao com quatro colunas mapeaveis.

## Funcionalidades propostas

### 1. Biblioteca de conceitos

- Formacao de cavaco.
- Tipos de cavaco.
- Angulos da ferramenta.
- Forca de corte.
- Energia e potencia de corte.
- Atrito e deformacao no processo de usinagem.

### 2. Calculadora de forca de corte

Campos iniciais:

- Material.
- Avanco.
- Profundidade de corte.
- Velocidade de corte.
- Espessura do cavaco.
- Largura de corte.

Saidas iniciais:

- Forca estimada de corte.
- Potencia estimada.
- Observacoes sobre o regime de corte.

### 3. Visualizacao didatica

- Esquema da ferramenta, peca e cavaco.
- Indicacao vetorial das forcas principais.
- Destaque dos parametros modificados pelo usuario.

### 4. Area de estudo

- Resumos por topico.
- Formulas comentadas.
- Exemplos resolvidos.
- Glossario tecnico.

### 5. Leitura de arquivo TXT

- Entrada por arquivo `.txt` ou `.csv`.
- Quatro colunas configuraveis pelo usuario.
- Padrao de mapeamento: tempo, Fx, Fy, Fz.
- Previa das primeiras amostras validas.
- Calculo de maximos absolutos por eixo e resultante.
- Janela grafica para selecao de faixa do sinal.
- Estatisticas por faixa: media, RMS, pico maximo, desvio padrao, coeficiente de variacao, fator de crista, curtose, skewness e frequencia dominante.
- Exportacao CSV da faixa selecionada.

## Estrutura sugerida do projeto

```text
forcelab/
  docs/
    PROJECT.md
    NOTES.md
    FORMULAS.md
  src/
    app/
    components/
    data/
    lib/
  public/
    assets/
```

## Decisoes iniciais

- Idioma principal: portugues.
- Foco inicial: aprendizado e demonstracao, nao simulacao industrial de alta precisao.
- Dados e formulas devem informar claramente suas hipoteses.
- A primeira versao deve funcionar localmente.

## Perguntas em aberto

- O projeto sera um site, aplicativo desktop, notebook interativo ou outro formato?
- Quais formulas do PDF serao usadas na primeira calculadora?
- O usuario podera escolher materiais a partir de uma tabela?
- A visualizacao sera 2D simples ou uma cena interativa mais avancada?

## Proximo passo

1. Extrair os principais conceitos e formulas do PDF.
2. Definir a stack do projeto.
3. Criar o esqueleto executavel.
4. Implementar a primeira tela com conteudo e calculadora basica.
