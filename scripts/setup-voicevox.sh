#!/bin/sh
# キャラクターの声（VOICEVOX）を /home/claude/vv に用意する。make-short.py の --voice で使う。
# 声：Halulu はるみちゃん＝春歌ナナ（13.vvm）／Haguruma はぐるん＝WhiteCUL（8.vvm）
set -e
D=${VOICEVOX_DIR:-/home/claude/vv}; mkdir -p "$D"; cd "$D"
G=https://github.com
[ -f voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl ] || curl -sL -o voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl $G/VOICEVOX/voicevox_core/releases/download/0.17.1/voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl
pip install --break-system-packages -q voicevox_core-0.17.1-cp310-abi3-manylinux_2_34_x86_64.whl
[ -d voicevox_onnxruntime-linux-x64-1.17.3 ] || { curl -sL $G/VOICEVOX/onnxruntime-builder/releases/download/voicevox_onnxruntime-1.17.3/voicevox_onnxruntime-linux-x64-1.17.3.tgz | tar xz; }
[ -d open_jtalk_dic_utf_8-1.11 ] || { curl -sL $G/r9y9/open_jtalk/releases/download/v1.11.1/open_jtalk_dic_utf_8-1.11.tar.gz | tar xz; }
for m in 8 13; do [ -f $m.vvm ] || curl -sL -o $m.vvm $G/VOICEVOX/voicevox_vvm/releases/download/0.17.0/$m.vvm; done
echo "VOICEVOX ready in $D"
