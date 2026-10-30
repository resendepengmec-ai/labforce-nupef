# Vídeo de apresentação (assets/apresentacao.mp4)

Animação em canvas, desenhada quadro a quadro com os dados reais dos módulos.

1. `node ferramentas/video/dados.mjs`: gera `dados.js` a partir de `forcas/samples/torneamento_sintetico.txt` e `eletrica/testes/dados/E1R1.txt`. O E1R1 não está no repositório público.
2. Sirva a raiz do repositório (`python -m http.server 8770`) e ajuste a URL em `render.cjs` para `http://localhost:8770/ferramentas/video/`.
3. `node render.cjs`: grava 2280 quadros JPEG (Playwright).
4. `ffmpeg -framerate 30 -i quadros/q%05d.jpg -c:v libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart apresentacao.mp4`

Paleta das séries validada para daltonismo (skill de visualização de dados): `#3b74e0`, `#1f9e8a` e `#d26a00` sobre `#0f1722`.

## Legendas

As legendas do vídeo são o próprio texto da narração: `anim.js` lê `narracao.tsv` e desenha cada frase na faixa inferior, do seu início até 0,2 s antes da frase seguinte. Para alterar uma legenda, edite o `.tsv` e renderize de novo. `node legendas.mjs` gera também `apresentacao.vtt`, com as mesmas frases e tempos, para publicar o vídeo em outra plataforma (YouTube, por exemplo).

## Narração (gratuita)

`narrar.py` gera um áudio por frase de `narracao.tsv`, coloca cada um no seu instante (os mesmos das legendas), normaliza o volume e junta ao vídeo. Requisitos: Python 3 e ffmpeg no PATH.

| Motor | Instalação | Comando |
|---|---|---|
| edge-tts (padrão, vozes neurais, precisa de internet) | `pip install edge-tts` | `python ferramentas/video/narrar.py` |
| Piper (offline, código aberto) | `pip install piper-tts` e `python -m piper.download_voices pt_BR-faber-medium` | `python ferramentas/video/narrar.py --motor piper --modelo pt_BR-faber-medium.onnx` |
| Sua voz | grave `ferramentas/video/narracao/trecho_00.mp3` … `trecho_12.mp3`, uma frase por arquivo | `python ferramentas/video/narrar.py --motor gravacao` |

Vozes do edge-tts: `pt-BR-FranciscaNeural` (padrão), `pt-BR-AntonioNeural`, `pt-BR-ThalitaNeural`; troque com `--voz` e ajuste o ritmo com `--velocidade +5%`. O edge-tts usa o serviço de leitura em voz alta do Edge de forma não oficial: é gratuito, mas sem garantia de continuidade.

O script mostra a duração de cada trecho e a janela da sua cena. Um trecho que passe da janela é acelerado até 20 %; acima disso, encurte a frase no `.tsv` e rode de novo com `--refazer` (os trechos já gerados são reaproveitados sem essa opção). O resultado é `apresentacao_narrada.mp4`: confira, copie para `assets/apresentacao.mp4` e troque "Sem áudio" no texto da seção do vídeo em `index.html`.
