"""Generate the recorded voice lines in src/audio/voices/ from src/audio/voiceLines.json.

Uses Piper (https://github.com/rhasspy/piper), an open-source text-to-speech engine, plus ffmpeg
to give each character its own sound. Not needed to build or play the game; only to re-record.

    python3 -m venv .tts && .tts/bin/pip install piper-tts
    # download the voices listed in VOICES below (.onnx and .onnx.json) into a folder, then:
    .tts/bin/python scripts/make-voices.py <voices-folder>

Voice models (from huggingface.co/rhasspy/piper-voices):
  en_GB-northern_english_male-medium  CC BY-SA 4.0
  en_GB-alba-medium                   CC BY 4.0
  en_US-joe-medium                    CC0
"""
import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'audio', 'voices')

# model, piper length scale (higher = slower), ffmpeg filter for the character's sound
VOICES = {
    # warm and a bit slower, a touch deeper: a kind old grandpa
    'ollie': ('en_GB-northern_english_male-medium', 1.12, 'asetrate=22050*0.92,aresample=22050,atempo=1.087'),
    'narrator': ('en_GB-alba-medium', 1.0, 'anull'),
    # big and rumbly, with a little cave echo
    'ember': ('en_US-joe-medium', 1.05, 'asetrate=22050*0.78,aresample=22050,atempo=1.28,aecho=0.8:0.5:45:0.25,bass=g=4'),
    # small and squeaky-cute
    'glimmer': ('en_GB-alba-medium', 0.95, 'asetrate=22050*1.28,aresample=22050,atempo=0.78'),
    # calm and cool, with an icy echo
    'frost': ('en_GB-alba-medium', 1.12, 'asetrate=22050*0.93,aresample=22050,atempo=1.075,aecho=0.8:0.6:110|230:0.35|0.18,highpass=f=140'),
}


def main(models):
    os.makedirs(OUT, exist_ok=True)
    lines = json.load(open(os.path.join(ROOT, 'src', 'audio', 'voiceLines.json')))
    piper = os.path.join(os.path.dirname(sys.executable), 'piper')
    for line_id, line in lines.items():
        model, scale, filt = VOICES[line['voice']]
        with tempfile.TemporaryDirectory() as tmp:
            wav = os.path.join(tmp, 'raw.wav')
            subprocess.run([piper, '-m', os.path.join(models, model + '.onnx'), '-f', wav, '--length-scale', str(scale)],
                           input=line['text'].encode(), check=True, capture_output=True)
            out = os.path.join(OUT, line_id + '.mp3')
            # filter, trim silence at the ends, level, and encode small
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-af',
                            f'{filt},silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1.5',
                            '-ar', '22050', '-ac', '1', '-b:a', '40k', out], check=True)
        print(line_id, os.path.getsize(out))


if __name__ == '__main__':
    main(sys.argv[1])
