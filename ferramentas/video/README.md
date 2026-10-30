# Vídeo de apresentação (assets/apresentacao.mp4)

Animação em canvas, desenhada quadro a quadro com os dados reais dos módulos.

1. `node ferramentas/video/dados.mjs`: gera `dados.js` a partir de `forcas/samples/torneamento_sintetico.txt` e `eletrica/testes/dados/E1R1.txt`. O E1R1 não está no repositório público.
2. Sirva a raiz do repositório (`python -m http.server 8770`) e ajuste a URL em `render.cjs` para `http://localhost:8770/ferramentas/video/`.
3. `node render.cjs`: grava 2280 quadros JPEG (Playwright).
4. `ffmpeg -framerate 30 -i quadros/q%05d.jpg -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart apresentacao.mp4`

Paleta das séries validada para daltonismo (skill de visualização de dados): `#3b74e0`, `#1f9e8a` e `#d26a00` sobre `#0f1722`.

## Legendas

As legendas do vídeo são o próprio texto da narração: `anim.js` lê `narracao.tsv` e desenha cada frase na faixa inferior, do seu início até 0,2 s antes da frase seguinte. Para alterar uma legenda, edite o `.tsv` e renderize de novo. `node legendas.mjs` gera também `apresentacao.vtt`, com as mesmas frases e tempos, para publicar o vídeo em outra plataforma (YouTube, por exemplo).

## Narração (opcional, Runway)

`narracao.tsv` tem o texto de cada cena com o instante de início, e cada trecho cabe na sua cena. `narrar.sh` gera os trechos com o TTS da Runway (skill `rw-generate-audio`) e os junta ao vídeo:

```bash
export RUNWAYML_API_SECRET=...   # chave da Runway: só em variável de ambiente
bash ferramentas/video/narrar.sh <pasta da skill rw-generate-audio> Maya
```

O script mostra a duração de cada trecho. Se algum passar do início do trecho seguinte, encurte o texto no `.tsv` e rode de novo; os trechos já gerados são reaproveitados.
