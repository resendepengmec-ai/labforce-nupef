# Formulas iniciais

Este documento registra as formulas que podem alimentar a primeira versao do ForceLab. Elas devem ser tratadas como modelo didatico inicial e validadas contra o PDF de referencia antes de uso academico formal.

## Area da secao de corte

Para operacoes simples de torneamento:

```text
A = ap * f
```

Onde:

- `A`: area da secao de corte nao deformada, em mm2.
- `ap`: profundidade de corte, em mm.
- `f`: avanco, em mm/rot.

## Forca principal de corte

Modelo simplificado usando pressao especifica de corte:

```text
Fc = kc * A
```

Onde:

- `Fc`: forca principal de corte, em N.
- `kc`: pressao especifica de corte, em N/mm2.
- `A`: area da secao de corte, em mm2.

## Potencia de corte

Com `Fc` em N e `Vc` em m/min:

```text
Pc = Fc * Vc / 60000
```

Onde:

- `Pc`: potencia de corte, em kW.
- `Fc`: forca principal de corte, em N.
- `Vc`: velocidade de corte, em m/min.

## Taxa de remocao de material

Modelo simplificado para torneamento:

```text
Q = Vc * ap * f
```

Onde:

- `Q`: taxa aproximada de remocao, em mm3/min, quando `Vc` e convertido para mm/min.
- `Vc`: velocidade de corte.
- `ap`: profundidade de corte.
- `f`: avanco.

Na aplicacao, a conversao usada deve ser:

```text
Q = (Vc * 1000) * ap * f
```

## Relacao de espessura do cavaco

```text
rc = h / hc
```

Onde:

- `rc`: razao de corte.
- `h`: espessura nao deformada do cavaco.
- `hc`: espessura deformada do cavaco.

## Angulo de cisalhamento

Estimativa geometrica:

```text
tan(phi) = (rc * cos(gamma)) / (1 - rc * sin(gamma))
```

Onde:

- `phi`: angulo de cisalhamento.
- `rc`: razao de corte.
- `gamma`: angulo de saida da ferramenta.

## Modelo de Merchant

Estimativa classica:

```text
phi = 45 + gamma / 2 - beta / 2
```

Onde:

- `phi`: angulo de cisalhamento, em graus.
- `gamma`: angulo de saida, em graus.
- `beta`: angulo de atrito, em graus.

## Valores iniciais de kc para demonstracao

| Material | kc inicial |
| --- | ---: |
| Aluminio | 700 N/mm2 |
| Aco baixo carbono | 1800 N/mm2 |
| Aco medio carbono | 2200 N/mm2 |
| Ferro fundido | 1500 N/mm2 |
| Bronze | 1000 N/mm2 |

Esses valores sao aproximacoes didaticas. A versao final deve permitir editar `kc` e registrar a fonte de cada valor.

