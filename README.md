# LabForce NUPEF

Análise de ensaios de usinagem no navegador, do NUPEF (Laboratório de Usinagem, IFG Câmpus Goiânia, em colaboração com a UFG). Os arquivos de ensaio são lidos e processados localmente: não há servidor nem envio de dados.

| Página | Pasta | Conteúdo |
|---|---|---|
| Início | `/` | Escolha entre as duas análises |
| Análise de forças de usinagem | [`forcas/`](forcas/README.md) | ForceLab: sinais do dinamômetro (Fx, Fy, Fz), faixa, estatística, CSV |
| Análise de grandezas elétricas | [`eletrica/`](eletrica/README.md) | Potências, FFT, IEEE 519-2022 e IEEE 1459-2010 (aquisição ESP32 3F+N; método da rotina Scilab v5.3.3) |

## Executar localmente

Os módulos JS precisam de servidor HTTP (não abrem por `file://`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\serve.ps1 -Root . -Port 4173
```

ou `python -m http.server 4173`, e acesse `http://127.0.0.1:4173/`.

## Testes

```
npm test     # Node >= 18, sem dependências
```

Os ensaios reais (`eletrica/testes/dados/E*.txt`) ficam fora do repositório, que é público. Sem eles, a comparação com o Scilab roda só nos ensaios sintéticos.

## Publicação

GitHub Pages: Settings → Pages → *Deploy from a branch* → `main` / `(root)`. Não há build.
