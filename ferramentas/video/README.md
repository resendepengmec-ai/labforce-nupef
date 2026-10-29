# Vídeo de apresentação (assets/apresentacao.mp4)

Animação em canvas, desenhada quadro a quadro com os dados reais dos módulos.

1. `node ferramentas/video/dados.mjs`: gera `dados.js` a partir de `forcas/samples/torneamento_sintetico.txt` e `eletrica/testes/dados/E1R1.txt`. O E1R1 não está no repositório público.
2. Sirva a raiz do repositório (`python -m http.server 8770`) e ajuste a URL em `render.js` para `http://localhost:8770/ferramentas/video/`.
3. `node render.js`: grava 2280 quadros JPEG (Playwright).
4. `ffmpeg -framerate 30 -i quadros/q%05d.jpg -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart apresentacao.mp4`

Paleta das séries validada para daltonismo (skill de visualização de dados): `#3b74e0`, `#1f9e8a` e `#d26a00` sobre `#0f1722`.
