#!/usr/bin/env python3
"""カルーセル画像から縦型ショート動画（YouTubeショート・TikTok用）を作る。
使い方: python3 scripts/make-short.py <画像フォルダ(slide-01.png…)> <出力.mp4> [--seed 文字列]
- 1080x1920・30fps。各ページは静止で表示し、本のページをめくる動きで次へ移る（ズームなし）。
- BGMはこのスクリプトがその場で作るオルゴール風の曲（著作権の心配がない自作音源）。seed で曲の雰囲気が少し変わる。
"""
import sys, glob, os, math, subprocess, hashlib, wave
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

W, H, FPS = 1080, 1920, 30
HOLD, FLIP = 2.8, 0.75  # 1ページの表示秒数・めくりの秒数


def compose(path):
    im = Image.open(path).convert("RGB")
    bg = im.resize((1536, 1920)).crop((228, 0, 1308, 1920)).filter(ImageFilter.GaussianBlur(40))
    bg = Image.blend(bg, Image.new("RGB", bg.size, (255, 255, 255)), 0.35)
    bg.paste(im, (0, (H - im.height) // 2))
    return bg


def quad_page(img, t):
    """左端を背にして右端が持ち上がるようにめくれていくページ（t: 0→1）"""
    ang = t * math.pi / 2
    xr = W * math.cos(ang)            # 右端の位置（W→0：左の背に向かってめくれる）
    lift = 0.10 * H * math.sin(t * math.pi)   # 手前に来る分だけ縦に伸びる
    if xr >= 2:
        face = img
        quad_w = max(int(xr), 1)
    else:
        return None, 0
    page = face.transform((W, H), Image.QUAD,
                          data=(0, 0, 0, H, W, H + 0, W, 0), resample=Image.BICUBIC)
    # 右端を xr に寄せ、上下に lift 伸ばした台形に描く
    canvas = Image.new("RGBA", (W, int(H + 2 * lift) + 2), (0, 0, 0, 0))
    src = face.convert("RGBA")
    # 横方向に縮める
    narrow = src.resize((quad_w, H), Image.BICUBIC)
    # 右側ほど縦に伸ばす（列ごとに引き伸ばし）
    arr = np.zeros((canvas.height, quad_w, 4), dtype=np.uint8)
    nar = np.asarray(narrow)
    steps = 24
    for k in range(steps):
        x0 = k * quad_w // steps
        x1 = (k + 1) * quad_w // steps
        if x1 <= x0:
            continue
        f = (x0 + x1) / 2 / quad_w
        hh = int(H + 2 * lift * f)
        strip = Image.fromarray(nar[:, x0:x1]).resize((x1 - x0, hh), Image.BILINEAR)
        top = int(lift - lift * f)
        arr[top:top + hh, x0:x1] = np.asarray(strip)
    page = Image.fromarray(arr, "RGBA")
    # めくれるほど暗く・右端に光
    shade = np.linspace(1.0, 1.0 - 0.35 * math.sin(t * math.pi), quad_w)[None, :, None]
    a = np.asarray(page).astype(np.float32)
    a[:, :, :3] *= shade
    page = Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")
    return page, lift


def flip_frames(cur, nxt, n):
    out = []
    for i in range(n):
        t = (i + 1) / (n + 1)
        t = t * t * (3 - 2 * t)  # なめらかに
        frame = nxt.copy()
        # めくれる側の影を次ページに落とす
        page, lift = quad_page(cur, t)
        if page is not None:
            sh = Image.new("L", (W, H), 0)
            d = ImageDraw.Draw(sh)
            edge = int(page.width)
            d.rectangle([0, 0, edge + 60, H], fill=int(110 * (1 - t)))
            sh = sh.filter(ImageFilter.GaussianBlur(40))
            frame = Image.composite(Image.new("RGB", (W, H), (60, 50, 50)), frame, sh)
            frame.paste(page, (0, -int(lift)), page)
        out.append(frame)
    return out


def music(seconds, seed):
    sr = 44100
    rng = np.random.default_rng(int(hashlib.md5(seed.encode()).hexdigest()[:8], 16))
    keys = [0, 2, 5, 7, -3]                      # 調を少し変える
    base = 261.63 * 2 ** (keys[rng.integers(len(keys))] / 12)
    prog = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]  # I V vi IV
    bpm = 92
    beat = 60 / bpm
    total = int(seconds * sr)
    out = np.zeros(total)

    def bell(freq, dur, amp):
        n = int(dur * sr)
        tt = np.arange(n) / sr
        env = np.exp(-tt * 3.2) * (1 - np.exp(-tt * 200))
        tone = np.sin(2 * np.pi * freq * tt) + 0.35 * np.sin(2 * np.pi * freq * 2 * tt) + 0.12 * np.sin(2 * np.pi * freq * 3.01 * tt)
        return amp * env * tone

    def add(sig, start):
        s = int(start * sr)
        if s >= total:
            return
        e = min(total, s + len(sig))
        out[s:e] += sig[:e - s]

    pattern = [0, 1, 2, 1, 2, 1, 0, 2]
    t = 0.0
    bar = 0
    while t < seconds:
        chord = prog[bar % 4]
        # 低音
        add(bell(base * 2 ** ((chord[0] - 12) / 12), beat * 4, 0.18), t)
        # アルペジオ（8分音符）
        for k, p in enumerate(pattern):
            note = chord[p] + (12 if k in (3, 5) else 0)
            add(bell(base * 2 ** (note / 12), beat * 1.6, 0.10), t + k * beat / 2)
        # たまにきらっと高音
        if rng.random() < 0.6:
            add(bell(base * 4 * 2 ** (chord[rng.integers(3)] / 12), beat * 2, 0.05), t + beat * rng.choice([1.5, 2.5, 3.5]))
        t += beat * 4
        bar += 1
    # 簡単なリバーブ
    for d, g in ((0.11, 0.25), (0.23, 0.15), (0.37, 0.08)):
        k = int(d * sr)
        out[k:] += g * out[:-k]
    fade = int(1.2 * sr)
    out[:int(0.3 * sr)] *= np.linspace(0, 1, int(0.3 * sr))
    out[-fade:] *= np.linspace(1, 0, fade)
    out = out / (np.abs(out).max() + 1e-9) * 0.6
    return (out * 32767).astype(np.int16), sr


def main():
    src, dst = sys.argv[1], sys.argv[2]
    seed = sys.argv[sys.argv.index("--seed") + 1] if "--seed" in sys.argv else src
    files = sorted(glob.glob(os.path.join(src, "slide-*.png")))
    pages = [compose(f) for f in files]
    nflip = int(FLIP * FPS)
    nhold = int(HOLD * FPS)
    seconds = (len(pages) * nhold + (len(pages) - 1) * nflip) / FPS
    wav = dst + ".wav"
    pcm, sr = music(seconds, seed)
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
                          "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", dst], stdin=subprocess.PIPE)
    for i, pg in enumerate(pages):
        raw = pg.tobytes()
        for _ in range(nhold):
            p.stdin.write(raw)
        if i + 1 < len(pages):
            for fr in flip_frames(pg, pages[i + 1], nflip):
                p.stdin.write(fr.convert("RGB").tobytes())
    p.stdin.close()
    p.wait()
    os.remove(wav)
    print(dst, round(seconds, 1), "s")


if __name__ == "__main__":
    main()
