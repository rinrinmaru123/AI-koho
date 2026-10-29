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
    """ポップなBGM（自作）：はずむベース・ドラム・明るいシンセのコード＋メロディ"""
    sr = 44100
    rng = np.random.default_rng(int(hashlib.md5(seed.encode()).hexdigest()[:8], 16))
    keys = [0, 2, 5, 7, -3, -1]
    base = 261.63 * 2 ** (keys[rng.integers(len(keys))] / 12)
    progs = [[[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]],   # I V vi IV
             [[5, 9, 12], [7, 11, 14], [4, 7, 11], [9, 12, 16]],  # IV V iii vi
             [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]]   # I vi IV V
    prog = progs[rng.integers(len(progs))]
    bpm = 120 + int(rng.integers(0, 9))
    beat = 60 / bpm
    total = int(seconds * sr) + sr
    out = np.zeros(total)
    tt_cache = {}

    def tvec(dur):
        n = int(dur * sr)
        if n not in tt_cache:
            tt_cache[n] = np.arange(n) / sr
        return tt_cache[n]

    def add(sig, start):
        s = int(start * sr)
        if s >= total or s < 0:
            return
        e = min(total, s + len(sig))
        out[s:e] += sig[:e - s]

    def pluck(freq, dur, amp):  # 明るいシンセ（矩形っぽい倍音）
        tt = tvec(dur)
        env = np.exp(-tt * 6) * (1 - np.exp(-tt * 300))
        ph = 2 * np.pi * freq * tt
        return amp * env * (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph) + 0.12 * np.sin(5 * ph))

    def bass(freq, dur, amp):
        tt = tvec(dur)
        env = np.exp(-tt * 4) * (1 - np.exp(-tt * 400))
        ph = 2 * np.pi * freq * tt
        return amp * env * (np.sin(ph) + 0.3 * np.sin(2 * ph))

    def kick():
        tt = tvec(0.25)
        f = 120 * np.exp(-tt * 18) + 45
        return 0.9 * np.exp(-tt * 14) * np.sin(2 * np.pi * np.cumsum(f) / sr)

    noise = rng.standard_normal(int(0.3 * sr))

    def snare():
        tt = tvec(0.18)
        n = noise[:len(tt)]
        return 0.35 * np.exp(-tt * 22) * n + 0.25 * np.exp(-tt * 30) * np.sin(2 * np.pi * 190 * tt)

    def hat(open_=False):
        tt = tvec(0.12 if open_ else 0.05)
        n = np.diff(np.concatenate([[0], noise[:len(tt)]]))  # 高い音だけ
        return 0.12 * np.exp(-tt * (25 if open_ else 80)) * n

    mel_shape = [2, 1, 0, 1, 2, 2, 1, 0]
    t = 0.0
    bar = 0
    while t < seconds:
        ch = prog[bar % 4]
        root = base * 2 ** ((ch[0] - 24) / 12)
        # ベース（8分ではずむ）
        for k in range(8):
            add(bass(root * (2 if k % 4 == 3 else 1), beat * 0.45, 0.32), t + k * beat / 2)
        # ドラム（最初の1小節はハットだけで入る）
        for k in range(4):
            if bar > 0 or k >= 2:
                if k in (0, 2):
                    add(kick(), t + k * beat)
                if k in (1, 3):
                    add(snare(), t + k * beat)
            for h in range(2):
                add(hat(open_=(h == 1 and k == 3)), t + k * beat + h * beat / 2)
        # コード（裏拍のスタブ）
        for k in range(4):
            for n_ in ch:
                add(pluck(base * 2 ** (n_ / 12), beat * 0.4, 0.06), t + k * beat + beat / 2)
        # メロディ（2小節ごとに少し変える）
        shift = rng.integers(0, 3) if bar % 2 == 0 else 0
        for k, idx in enumerate(mel_shape):
            if rng.random() < 0.8:
                note = ch[(idx + shift) % 3] + 12
                add(pluck(base * 2 ** (note / 12), beat * 0.5, 0.09), t + k * beat / 2)
        t += beat * 4
        bar += 1
    out = out[:int(seconds * sr)]
    fade = int(1.0 * sr)
    out[:int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr))
    out[-fade:] *= np.linspace(1, 0, fade)
    out = np.tanh(out * 1.2)
    out = out / (np.abs(out).max() + 1e-9) * 0.6
    return (out * 32767).astype(np.int16), sr


def music_brand(seconds, seed, brand):
    """ブランドごとのBGM（自作・2026-10-27 本人希望でHaluluとHagurumaを分ける）
    halulu  ：ウクレレ風の弦＋グロッケン、ゆったり跳ねるリズム（ハンドクラップ・シェイカー）。やさしく、かわいい
    haguruma：ピコピコした電子音のアルペジオ＋うねるベース、4つ打ち。ロボットのはぐるんらしく元気に"""
    sr = 44100
    rng = np.random.default_rng(int(hashlib.md5((seed + brand).encode()).hexdigest()[:8], 16))
    total = int(seconds * sr) + sr
    out = np.zeros(total)
    noise = rng.standard_normal(int(0.5 * sr))
    hz = lambda base, n: base * 2 ** (n / 12)

    def add(sig, start):
        st = int(start * sr)
        if st >= total or st < 0:
            return
        e = min(total, st + len(sig)); out[st:e] += sig[:e - st]

    def tv(d):
        return np.arange(int(d * sr)) / sr

    def kick(amp=0.9):
        tt = tv(0.25); f = 120 * np.exp(-tt * 18) + 45
        return amp * np.exp(-tt * 14) * np.sin(2 * np.pi * np.cumsum(f) / sr)

    def clap(amp=0.3):
        tt = tv(0.2); n = noise[:len(tt)]
        env = sum(np.exp(-np.clip(tt - d, 0, None) * 60) * (tt >= d) for d in (0, 0.012, 0.024)) / 3 + np.exp(-tt * 18) * 0.6
        return amp * env * np.diff(np.concatenate([[0], n]))

    def shaker(amp=0.06):
        tt = tv(0.07); n = noise[100:100 + len(tt)]
        return amp * np.sin(np.pi * tt / tt[-1]) * np.diff(np.concatenate([[0], n]))

    if brand == "halulu":
        base = 261.63 * 2 ** ([0, 2, 5, 7][rng.integers(4)] / 12)
        prog = [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]]          # I vi IV V（やさしい定番）
        bpm = 100 + int(rng.integers(0, 6)); beat = 60 / bpm; sw = beat * 0.58   # 跳ねる8分
        def uke(f, d, a):   # ウクレレ風：高い倍音ほど早く消える
            tt = tv(d); env = 1 - np.exp(-tt * 500)
            return a * env * sum((0.9 ** k) * np.exp(-tt * (5 + 6 * k)) * np.sin(2 * np.pi * f * (k + 1) * tt) for k in range(5))
        def glock(f, d, a):
            tt = tv(d); env = np.exp(-tt * 4) * (1 - np.exp(-tt * 300))
            return a * env * (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * f * 2.76 * tt))
        mel = [[2, 1, 0, 1], [2, 2, 1, 0]]
        t, bar = 0.0, 0
        while t < seconds:
            ch = prog[bar % 4]
            # ウクレレのストローク（ジャン・ジャジャ・ジャン）
            for pos in (0, sw, beat * 1.5, beat * 2, beat * 2 + sw, beat * 3.5):
                for j, n_ in enumerate(ch + [ch[0] + 12]):
                    add(uke(hz(base, n_), 0.6, 0.05), t + pos + j * 0.008)
            add(uke(hz(base, ch[0] - 12), beat * 1.8, 0.16), t); add(uke(hz(base, ch[2] - 12), beat * 1.8, 0.12), t + beat * 2)
            if bar > 0:
                add(kick(0.45), t); add(kick(0.35), t + beat * 2 + sw)
                add(clap(0.11), t + beat); add(clap(0.11), t + beat * 3)
            for k in range(4):
                add(shaker(0.022), t + k * beat); add(shaker(0.014), t + k * beat + sw)
            # グロッケンのメロディ
            for k, idx in enumerate(mel[bar % 2]):
                if rng.random() < 0.85:
                    add(glock(hz(base, ch[idx] + 24), beat * 1.2, 0.07), t + k * beat + (sw if k % 2 else 0))
            t += beat * 4; bar += 1
        # ふんわり残響
        for d, g in ((0.09, 0.22), (0.19, 0.12)):
            k = int(d * sr); out[k:] += g * out[:-k]
    else:
        base = 220.0 * 2 ** ([0, 2, 3, 5, 7][rng.integers(5)] / 12)
        prog = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]]            # i VI III VII（前向きな短調）
        bpm = 124 + int(rng.integers(0, 6)); beat = 60 / bpm; s16 = beat / 4
        def sq(f, d, a, dec=10):   # ピコピコの矩形波（倍音を足して作る）
            tt = tv(d); env = np.exp(-tt * dec) * (1 - np.exp(-tt * 800)); ph = 2 * np.pi * f * tt
            return a * env * sum(np.sin((2 * k + 1) * ph) / (2 * k + 1) for k in range(6))
        def saw(f, d, a):
            tt = tv(d); env = np.exp(-tt * 6) * (1 - np.exp(-tt * 600)); ph = 2 * np.pi * f * tt
            return a * env * sum(np.sin(k * ph) / k for k in range(1, 8))
        def blip(f, a):   # ロボットっぽい上昇音
            tt = tv(0.12); ff = f * (1 + 2 * tt / 0.12)
            return a * np.exp(-tt * 20) * np.sign(np.sin(2 * np.pi * np.cumsum(ff) / sr))
        arp = [0, 1, 2, 1, 2, 3, 2, 1]
        t, bar = 0.0, 0
        while t < seconds:
            ch = prog[bar % 4]
            for k in range(4):
                if bar > 0 or k >= 2:
                    add(kick(0.5), t + k * beat)
                add(saw(hz(base, ch[0] - 12), beat * 0.45, 0.14), t + k * beat + beat / 2)   # 裏打ちベース
                if k in (1, 3):
                    add(clap(0.13), t + k * beat)
                add(shaker(0.022), t + k * beat + beat / 2)
            for k in range(16):   # 16分のアルペジオ
                notes = ch + [ch[0] + 12]
                add(sq(hz(base, notes[arp[k % 8]] + 12), s16 * 0.9, 0.10, 18), t + k * s16)
            if bar % 2 == 1:
                add(blip(hz(base, ch[2] + 24), 0.05), t + beat * 3.5)
            # メロディ（2拍ごと）
            for k in range(2):
                if rng.random() < 0.8:
                    add(sq(hz(base, ch[rng.integers(3)] + 24), beat * 1.4, 0.09, 4), t + k * beat * 2)
            t += beat * 4; bar += 1
    out = out[:int(seconds * sr)]
    fade = int(1.0 * sr)
    out[:int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr))
    out[-fade:] *= np.linspace(1, 0, fade)
    out = np.tanh(out * 1.2)
    out = out / (np.abs(out).max() + 1e-9) * 0.6
    return (out * 32767).astype(np.int16), sr


def music_musicbox(seconds, seed):
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


# キャラクターの声（VOICEVOX）。クレジット表記が必要：Halulu「VOICEVOX:春歌ナナ」／Haguruma「VOICEVOX:WhiteCUL」
VOICES = {
    "halulu": dict(model="13.vvm", style=54, speed=0.93, pitch=-0.05, intonation=1.15, name="はるる渋谷歯科"),   # はるみちゃん＝春歌ナナ（本人選定 2026-10-23）
    "haguruma": dict(model="8.vvm", style=24, speed=1.0, pitch=0.0, intonation=1.1, name="はぐるま"),           # はぐるん＝WhiteCUL（たのしい）
}
VV_DIR = os.environ.get("VOICEVOX_DIR", "/home/claude/vv")
ENDCARD = {"halulu": os.path.join(os.path.dirname(__file__), "..", "assets", "halulu-endcard.png"),
           "haguruma": os.path.join(os.path.dirname(__file__), "..", "assets", "haguruma-endcard.png")}  # 本人支給の正式ロゴ（2026-10-24）
ENDCARD_VOICE = {"halulu": os.path.join(os.path.dirname(__file__), "..", "assets", "halulu-endcard-voice.wav")}


# ---------- 最後のロゴに動きをつける（2026-10-27 本人希望「最後のHagurumaやHalulu、動きが欲しい」） ----------
def _layer(img, box, keep=None):
    """白背景のロゴから box(x0,y0,x1,y1) を透明背景で切り出す。keep(r,g,b配列)->bool で残す画素を選べる"""
    a = np.asarray(img.crop(box).convert("RGB")).astype(np.float32)
    al = ((255 - a).max(2) / 255.0).clip(0, 1)
    if keep is not None:
        al = al * keep(a)
    rgb = np.where(al[..., None] > 0.01, (a - 255 * (1 - al[..., None])) / np.maximum(al[..., None], 1e-3), 255).clip(0, 255)
    return Image.fromarray(np.dstack([rgb, al * 255]).astype(np.uint8), "RGBA")


def _back(t):  # 0→1 で少し行き過ぎて戻る
    t = min(max(t, 0.0), 1.0); c = 1.9
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2


def _ease(t):
    t = min(max(t, 0.0), 1.0); return t * t * (3 - 2 * t)


def _put(frame, lay, cx, cy, scale=1.0, rot=0.0, alpha=1.0, anchor=(0.5, 0.5)):
    if scale <= 0.01 or alpha <= 0.01:
        return
    w, h = lay.size
    im = lay.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.BICUBIC) if abs(scale - 1) > 1e-3 else lay
    if rot:
        # anchor を中心に回す：anchor が中心に来るよう余白を足してから回す
        ax, ay = int(im.width * anchor[0]), int(im.height * anchor[1])
        R = int(math.hypot(max(ax, im.width - ax), max(ay, im.height - ay))) + 2
        pad = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0)); pad.paste(im, (R - ax, R - ay))
        im = pad.rotate(rot, resample=Image.BICUBIC); ox, oy = R, R
    else:
        ox, oy = int(im.width * anchor[0]), int(im.height * anchor[1])
    if alpha < 1:
        a = im.getchannel("A").point(lambda v: int(v * alpha)); im = im.copy(); im.putalpha(a)
    frame.paste(im, (int(cx - ox), int(cy - oy)), im)


def endcard_anim(brand, path):
    """最後のロゴの動き。戻り値: f(秒) -> 1080x1920 のRGB画像"""
    src = Image.open(path).convert("RGB").resize((W, H))
    white = Image.new("RGB", (W, H), (255, 255, 255))
    # 音声のクレジットを動画の中にも小さく入れる（2026-10-29：Threadsのキャプションからは外すため）
    try:
        from PIL import ImageFont
        fnt = ImageFont.truetype(os.path.join(os.path.dirname(__file__), "..", "assets", "fonts", "MPLUSRounded1c-Medium.ttf"), 34)
        ImageDraw.Draw(white).text((W // 2, H - 150), CREDIT.get(brand, ""), fill=(150, 150, 150), font=fnt, anchor="mm")
    except Exception:
        pass
    if brand == "haguruma":
        word = _layer(src, (150, 640, 930, 815))
        gx0, gy0, gx1, gy1 = 330, 850, 750, 1272
        gear = _layer(src, (gx0, gy0, gx1, gy1)); cx, cy = 539.5, 1060.5
        yy, xx = np.mgrid[gy0:gy1, gx0:gx1]; rr = np.hypot(xx - cx, yy - cy)
        ga = np.asarray(gear).copy(); outer = ga.copy(); inner = ga.copy()
        outer[..., 3] = np.where(rr > 124, ga[..., 3], 0); inner[..., 3] = np.where(rr <= 124, ga[..., 3], 0)
        outer = Image.fromarray(outer, "RGBA"); inner = Image.fromarray(inner, "RGBA")
        ac = ((cx - gx0) / gear.width, (cy - gy0) / gear.height)
        def f(t):
            fr = white.copy()
            sc = _back(t / 0.55)
            spin = -360 * (1 - _ease(t / 0.7)) - 40 * t   # 回りながら出てきて、そのあともゆっくり回り続ける
            _put(fr, outer, cx, cy, sc, spin, anchor=ac)
            _put(fr, inner, cx, cy, _back((t - 0.15) / 0.5), 0, anchor=ac)
            k = (t - 0.35) / 0.45
            _put(fr, word, 540, 727 - 120 * (1 - _back(k)), 1.0, 0, alpha=_ease(k * 2))
            return fr
        return f
    # halulu
    tag = _layer(src, (180, 470, 900, 560))
    green = lambda a: (a[..., 1] > a[..., 0]).astype(np.float32)   # 枠内は ピンクの歯 と 緑の双葉 だけ
    notgreen = lambda a: (a[..., 0] > a[..., 1] + 4).astype(np.float32)   # ピンク（双葉のふちの薄い色は入れない）
    sx0, sy0, sx1, sy1 = 360, 590, 710, 1145
    sprout = _layer(src, (sx0, sy0, sx1, sy1), green)
    tooth = _layer(src, (sx0, sy0, sx1, sy1), notgreen)
    sa = np.asarray(sprout)[..., 3]; ys, xs = np.where(sa > 40)
    base = (float(np.median(xs[ys > ys.max() - 6])) if len(ys) else 175.0, float(ys.max()) if len(ys) else 200.0)
    ab = (base[0] / sprout.width, base[1] / sprout.height)
    name = _layer(src, (230, 1160, 860, 1320)); kanji = _layer(src, (220, 1325, 870, 1448))
    def f(t):
        fr = white.copy()
        _put(fr, tooth, (sx0 + sx1) / 2, sy1, _back(t / 0.5), 0, anchor=(0.5, 1.0))   # 歯がぽよんと出る
        g = _back((t - 0.3) / 0.45)
        sway = 7 * math.sin((t - 0.3) * 3.2) * _ease((t - 0.6) / 0.4)   # 双葉がのびて、そよそよ揺れる
        _put(fr, sprout, sx0 + base[0], sy0 + base[1], g, sway, anchor=ab)
        k1 = (t - 0.45) / 0.4; _put(fr, name, 545, 1240 + 60 * (1 - _ease(k1)), 1.0, 0, alpha=_ease(k1))
        k2 = (t - 0.6) / 0.4; _put(fr, kanji, 545, 1386 + 60 * (1 - _ease(k2)), 1.0, 0, alpha=_ease(k2))
        k3 = (t - 0.85) / 0.45; _put(fr, tag, 540, 515 - 30 * (1 - _ease(k3)), 1.0, 0, alpha=_ease(k3))
        return fr
    return f


CREDIT = {"halulu": "音声：VOICEVOX:春歌ナナ", "haguruma": "音声：VOICEVOX:WhiteCUL"}


# 読み間違いの直し（本人指定）
READINGS = {"少し": "すこし"}
# 最後の画像ページ（type end）で読む言葉。画像の「歯を、育てよう。」と同じ（本人希望 2026-10-24）
END_LINE = {"halulu": "歯を、育てよう。", "haguruma": "歯科の仕事を、もっと自由に。"}


def plain(s):
    import re
    t = re.sub(r"(?m)\*\*|\{|\}|^~", "", str(s or "")).replace("\n", "")
    for a, b in READINGS.items():
        t = t.replace(a, b)
    return t


def speak(texts, brand):
    """texts: 各ページで話す文（空なら無音）。戻り値: 各ページの音声(int16, 24kHz)のリスト"""
    from voicevox_core.blocking import Onnxruntime, OpenJtalk, Synthesizer, VoiceModelFile
    import io
    v = VOICES[brand]
    ort = Onnxruntime.load_once(filename=glob.glob(os.path.join(VV_DIR, "voicevox_onnxruntime-*/lib/libvoicevox_onnxruntime.so"))[0])
    syn = Synthesizer(ort, OpenJtalk(glob.glob(os.path.join(VV_DIR, "open_jtalk_dic_utf_8-*"))[0]))
    with VoiceModelFile.open(os.path.join(VV_DIR, v["model"])) as m:
        syn.load_voice_model(m)
    out = []
    for t in texts:
        if not t:
            out.append(np.zeros(0, dtype=np.int16)); continue
        q = syn.create_audio_query(t, v["style"])
        q.output_sampling_rate = 24000; q.speed_scale = v["speed"]; q.pitch_scale = v["pitch"]; q.intonation_scale = v["intonation"]
        with wave.open(io.BytesIO(syn.synthesis(q, v["style"]))) as r:
            out.append(np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16))
    return out


def main():
    src, dst = sys.argv[1], sys.argv[2]
    opt = lambda k, d=None: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else d
    seed = opt("--seed", src)
    brand = opt("--voice")            # halulu / haguruma（省略で声なし）
    slides_json = opt("--slides")     # 原稿の slides（読む文に使う）
    read = opt("--read", "heading")   # 中のページで読むもの：heading / say / both
    files = sorted(glob.glob(os.path.join(src, "slide-*.png")))
    pages = [compose(f) for f in files]
    texts = [""] * len(pages)
    if brand and slides_json:
        import json
        slides = json.load(open(slides_json, encoding="utf-8"))
        slides = slides.get("slides", slides) if isinstance(slides, dict) else slides
        for i, s in enumerate(slides[:len(pages)]):
            if s.get("type") == "cover":
                texts[i] = plain(s.get("title"))
            elif s.get("type") == "point":
                # 見出し（例「すき間が狭いならフロス」）を読んでから、キャラのひと言（本人希望 2026-10-24）
                parts = {"heading": [s.get("heading")], "say": [s.get("say")]}.get(read, [s.get("heading"), s.get("say")])
                parts = [plain(p) for p in parts]
                texts[i] = "　".join(p for p in parts if p)
            elif s.get("type") == "end" and brand in END_LINE:
                texts[i] = END_LINE[brand]
            elif s.get("say"):
                texts[i] = plain(s.get("say"))
    anim = None
    if brand and brand in ENDCARD and os.path.exists(ENDCARD[brand]):
        anim = endcard_anim(brand, ENDCARD[brand])
        pages.append(anim(0.0)); texts.append(VOICES[brand]["name"])
    voices = speak(texts, brand) if brand else [np.zeros(0, dtype=np.int16)] * len(pages)
    # 最後のロゴの「はるる渋谷歯科」は本人が用意した録音を使う（2026-10-24 本人指定。24kHz mono wav）
    if brand and ENDCARD_VOICE.get(brand) and os.path.exists(ENDCARD_VOICE[brand]) and brand in ENDCARD:
        with wave.open(ENDCARD_VOICE[brand]) as r:
            voices[-1] = np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16)
    vsr = 24000
    nflip = int(FLIP * FPS)
    holds = [max(int(HOLD * FPS), int((len(v) / vsr + 0.9) * FPS)) for v in voices]
    total_frames = sum(holds) + (len(pages) - 1) * nflip
    seconds = total_frames / FPS
    wav = dst + ".wav"
    pcm, sr = music_brand(seconds, seed, brand) if brand in ("halulu", "haguruma") else music(seconds, seed)
    if brand:
        mix = pcm.astype(np.float32) * 0.3   # 声の下でBGMを小さく
        pos = 0
        for i, v in enumerate(voices):
            if len(v):
                st = int((pos / FPS + 0.35) * sr)
                up = np.interp(np.arange(int(len(v) * sr / vsr)), np.arange(len(v)) * sr / vsr, v.astype(np.float32))
                e = min(len(mix), st + len(up))
                mix[st:e] += up[:e - st] * 1.0
            pos += holds[i] + (nflip if i + 1 < len(pages) else 0)
        mix = mix / (np.abs(mix).max() + 1e-9) * 0.9 * 32767
        pcm = mix.astype(np.int16)
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
    p = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
                          "-i", wav, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "20",
                          "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", dst], stdin=subprocess.PIPE)
    for i, pg in enumerate(pages):
        if anim is not None and i == len(pages) - 1:
            for k in range(holds[i]):
                p.stdin.write(anim(k / FPS).tobytes())
            continue
        raw = pg.tobytes()
        for _ in range(holds[i]):
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
