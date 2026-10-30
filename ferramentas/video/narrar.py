#!/usr/bin/env python3
"""narrar.py - narracao do video de apresentacao (gratuita) e mixagem com o video.

Le narracao.tsv (inicio em segundos + frase), obtem um audio por frase e posiciona
cada um no seu instante. As legendas do video usam os mesmos tempos.

Motores (escolha com --motor):
  edge      vozes neurais da Microsoft via edge-tts (padrao; precisa de internet)
            pip install edge-tts
  piper     sintese offline, codigo aberto (MIT)
            pip install piper-tts  &&  python -m piper.download_voices pt_BR-faber-medium
  gravacao  sua propria voz: grave narracao/trecho_00.(mp3|wav|m4a) ... trecho_12

Requisito em todos: ffmpeg e ffprobe no PATH.

Exemplos (na raiz do repositorio):
  python ferramentas/video/narrar.py
  python ferramentas/video/narrar.py --voz pt-BR-AntonioNeural --velocidade +5%
  python ferramentas/video/narrar.py --motor piper --modelo pt_BR-faber-medium.onnx
  python ferramentas/video/narrar.py --motor gravacao
Saida: ferramentas/video/apresentacao_narrada.mp4 (confira e copie para assets/apresentacao.mp4)
"""
import argparse, asyncio, shutil, subprocess, sys
from pathlib import Path

DIR = Path(__file__).resolve().parent
RAIZ = DIR.parent.parent
OUT = DIR / "narracao"
VIDEO = RAIZ / "assets" / "apresentacao.mp4"
MAX_ACELERA = 1.20      # acelera ate 20 % um trecho que nao caiba na sua cena


def sh(*cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"ERRO ao executar {cmd[0]}:\n{r.stderr.strip()[-800:]}")
    return r.stdout


def duracao(f):
    return float(sh("ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)))


def roteiro():
    linhas = (DIR / "narracao.tsv").read_text(encoding="utf-8").strip().splitlines()[1:]
    cues = []
    for l in linhas:
        ini, txt = l.split("\t", 1)
        cues.append((float(ini), txt.strip()))
    return cues


def existente(i):
    for ext in ("mp3", "wav", "m4a", "ogg"):
        f = OUT / f"trecho_{i:02d}.{ext}"
        if f.exists() and f.stat().st_size > 0:
            return f
    return None


def gerar_edge(cues, a):
    try:
        import edge_tts
    except ImportError:
        sys.exit("Instale o edge-tts:  pip install edge-tts")

    async def um(txt, f):
        await edge_tts.Communicate(txt, a.voz, rate=a.velocidade).save(str(f))

    for i, (_, txt) in enumerate(cues):
        if existente(i) is None:
            print(f"  gerando trecho {i:02d} (edge-tts, {a.voz})")
            asyncio.run(um(txt, OUT / f"trecho_{i:02d}.mp3"))


def gerar_piper(cues, a):
    if not a.modelo:
        sys.exit("Informe o modelo da voz: --modelo pt_BR-faber-medium.onnx\n"
                 "(baixe com: python -m piper.download_voices pt_BR-faber-medium)")
    for i, (_, txt) in enumerate(cues):
        if existente(i) is None:
            print(f"  gerando trecho {i:02d} (piper)")
            sh(sys.executable, "-m", "piper", "-m", a.modelo, "-f", str(OUT / f"trecho_{i:02d}.wav"), "--", txt)


def main():
    p = argparse.ArgumentParser(description="Narracao do video de apresentacao do LabForce.")
    p.add_argument("--motor", choices=["edge", "piper", "gravacao"], default="edge")
    p.add_argument("--voz", default="pt-BR-FranciscaNeural",
                   help="edge-tts: pt-BR-FranciscaNeural (padrao), pt-BR-AntonioNeural, pt-BR-ThalitaNeural")
    p.add_argument("--velocidade", default="+0%", help="edge-tts: ex. +5%%, -5%%")
    p.add_argument("--modelo", help="piper: arquivo .onnx da voz")
    p.add_argument("--refazer", action="store_true", help="apaga os trechos e gera de novo")
    a = p.parse_args()

    for prog in ("ffmpeg", "ffprobe"):
        if not shutil.which(prog):
            sys.exit(f"{prog} nao encontrado no PATH.")
    if a.refazer and a.motor != "gravacao":
        shutil.rmtree(OUT, ignore_errors=True)
    OUT.mkdir(exist_ok=True)

    cues = roteiro()
    dur_video = duracao(VIDEO)
    if a.motor == "edge":
        gerar_edge(cues, a)
    elif a.motor == "piper":
        gerar_piper(cues, a)
    faltam = [i for i in range(len(cues)) if existente(i) is None]
    if faltam:
        sys.exit("Faltam trechos em " + str(OUT) + ": " + ", ".join(f"trecho_{i:02d}" for i in faltam)
                 + "\nGrave uma frase por arquivo, na ordem de narracao.tsv.")

    # confere se cada trecho cabe na sua cena; acelera um pouco se necessario
    entradas, filtros, rotulos = [], [], []
    print("\ntrecho  inicio  janela  duracao  ajuste")
    for i, (ini, txt) in enumerate(cues):
        f = existente(i)
        fim = cues[i + 1][0] if i + 1 < len(cues) else dur_video
        janela = fim - ini - 0.15
        d = duracao(f)
        fator = 1.0
        if d > janela:
            fator = d / janela
            if fator > MAX_ACELERA:
                print(f"AVISO: trecho {i:02d} tem {d:.2f} s e a cena so {janela:.2f} s. "
                      f"Encurte a frase em narracao.tsv:\n  \"{txt}\"")
                fator = MAX_ACELERA
        print(f"  {i:02d}   {ini:6.1f}  {janela:6.2f}  {d:7.2f}  {'x%.2f' % fator if fator > 1 else '-'}")
        entradas += ["-i", str(f)]
        ms = int(round(ini * 1000))
        acel = f"atempo={fator:.4f}," if fator > 1 else ""
        filtros.append(f"[{i + 1}:a]aresample=48000,aformat=channel_layouts=stereo,{acel}adelay={ms}|{ms}[a{i}]")
        rotulos.append(f"[a{i}]")

    mix = (";".join(filtros) + ";" + "".join(rotulos)
           + f"amix=inputs={len(cues)}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11,apad[a]")
    saida = DIR / "apresentacao_narrada.mp4"
    sh("ffmpeg", "-y", "-v", "error", "-i", str(VIDEO), *entradas, "-filter_complex", mix,
       "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
       "-t", f"{dur_video:.3f}", "-movflags", "+faststart", str(saida))
    print(f"\nPronto: {saida}\nConfira e copie para assets/apresentacao.mp4 (e troque 'Sem áudio' no index.html).")


if __name__ == "__main__":
    main()
