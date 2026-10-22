"""Brownie Baker art kit generator. Draws every sprite at native pixel size, then adds a 1px outline."""
from PIL import Image
import os, json

OUT = os.path.dirname(os.path.abspath(__file__))
OUTLINE = (26, 15, 10, 255)


def hexc(h, a=255):
    h = h.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(h, f):
    r, g, b, a = hexc(h)
    return '#%02x%02x%02x' % (max(0, min(255, int(r * f))), max(0, min(255, int(g * f))), max(0, min(255, int(b * f))))


class C:
    def __init__(self, w, h):
        self.im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        self.w, self.h = w, h

    def r(self, x, y, w, h, col):
        c = hexc(col) if isinstance(col, str) else col
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if 0 <= xx < self.w and 0 <= yy < self.h:
                    self.im.putpixel((xx, yy), c)
        return self

    def p(self, x, y, col):
        return self.r(x, y, 1, 1, col)

    def pts(self, pts, col):
        for x, y in pts:
            self.p(x, y, col)
        return self

    def grid(self, x0, y0, rows, pal):
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != '.' and ch in pal:
                    self.p(x0 + i, y0 + j, pal[ch])
        return self

    def outline(self, col=OUTLINE):
        src = self.im.copy()
        px = src.load()
        out = self.im.load()
        for y in range(self.h):
            for x in range(self.w):
                if px[x, y][3] == 0:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < self.w and 0 <= ny < self.h and px[nx, ny][3] > 0 and px[nx, ny][:3] != col[:3]:
                            out[x, y] = col
                            break
        return self


# ---------------------------------------------------------------- people
SKINS = {'light': '#f2c9a0', 'tan': '#d9a070', 'brown': '#a8703e', 'dark': '#6e4528', 'rosy': '#e8b48a'}


def person(skin='#f2c9a0', hair='#4a2a1a', shirt='#dfe3ea', pants='#2b2f38', shoes='#3a2418',
           frame='idle', hat=None, hat_col=None, apron=False, long_hair=False, glasses=False,
           tie=None, mood='smile', beard=None, bald=False, tray=False, kid=False):
    W, H = 20, 32
    c = C(W, H)
    ox, oy = 2, 4 + (3 if kid else 0)
    sk_sh = shade(skin, 0.85)
    sh_sh = shade(shirt, 0.82)
    leg_l = 0
    leg_r = 0
    if frame == 'walk1':
        leg_l = -1
    if frame == 'walk2':
        leg_r = -1
    body_h = 6 if kid else 7
    # legs
    ly = oy + 10 + body_h
    leg_len = 3 if kid else 5
    c.r(ox + 3, ly, 3, leg_len + leg_l, pants)
    c.r(ox + 8, ly, 3, leg_len + leg_r, pants)
    c.r(ox + 3, ly + leg_len + leg_l, 3, 1, shoes)
    c.r(ox + 8, ly + leg_len + leg_r, 3, 1, shoes)
    c.r(ox + 5, ly, 1, leg_len + leg_l, shade(pants, 0.8))
    # body
    c.r(ox + 2, oy + 10, 10, body_h, shirt)
    c.r(ox + 10, oy + 10, 2, body_h, sh_sh)
    if tie:
        c.r(ox + 6, oy + 10, 2, body_h - 1, tie)
    if apron:
        c.r(ox + 4, oy + 11, 6, body_h, '#f0e2c8')
        c.r(ox + 4, oy + 11 + body_h - 1, 6, 1, '#d8c6a4')
        c.r(ox + 6, oy + 13, 2, 1, '#8a5a3e')
    # arms
    if frame == 'bake':
        c.r(ox + 1, oy + 5, 1, 6, shirt)
        c.r(ox + 12, oy + 5, 1, 6, sh_sh)
        c.p(ox + 1, oy + 4, skin)
        c.p(ox + 12, oy + 4, skin)
    else:
        c.r(ox + 1, oy + 11, 1, body_h - 2, shirt)
        c.r(ox + 12, oy + 11, 1, body_h - 2, sh_sh)
        c.p(ox + 1, oy + 10 + body_h - 1, skin)
        c.p(ox + 12, oy + 10 + body_h - 1, skin)
    if tray:
        c.r(ox + 10, oy + 13, 7, 1, '#9aa0ad')
        c.r(ox + 11, oy + 12, 2, 1, '#6b3a26')
        c.r(ox + 14, oy + 12, 2, 1, '#6b3a26')
        c.p(ox + 12, oy + 14, skin)
    # head
    c.r(ox + 3, oy + 2, 8, 8, skin)
    c.r(ox + 3, oy + 9, 8, 1, sk_sh)
    c.r(ox + 5, oy + 10, 4, 0, skin)
    # hair
    if bald:
        c.r(ox + 3, oy + 4, 1, 3, hair)
        c.r(ox + 10, oy + 4, 1, 3, hair)
        c.p(ox + 5, oy + 2, shade(skin, 1.12))
    else:
        c.r(ox + 3, oy + 1, 8, 2, hair)
        c.r(ox + 2, oy + 2, 1, 3, hair)
        c.r(ox + 11, oy + 2, 1, 3, hair)
        c.p(ox + 4, oy + 3, hair)
        c.p(ox + 9, oy + 3, hair)
    if long_hair:
        c.r(ox + 2, oy + 2, 1, 8, hair)
        c.r(ox + 11, oy + 2, 1, 8, hair)
    # face
    eye = '#1a1a1a'
    if mood == 'sleep':
        c.r(ox + 4, oy + 6, 2, 1, eye)
        c.r(ox + 8, oy + 6, 2, 1, eye)
    elif mood == 'angry':
        c.p(ox + 4, oy + 4, eye); c.p(ox + 5, oy + 5, eye)
        c.p(ox + 9, oy + 4, eye); c.p(ox + 8, oy + 5, eye)
        c.r(ox + 5, oy + 6, 1, 1, eye); c.r(ox + 8, oy + 6, 1, 1, eye)
    else:
        c.r(ox + 5, oy + 5, 1, 2, eye)
        c.r(ox + 8, oy + 5, 1, 2, eye)
    if glasses:
        c.r(ox + 4, oy + 4, 3, 1, '#1a1a1a'); c.r(ox + 7, oy + 4, 3, 1, '#1a1a1a')
        c.p(ox + 4, oy + 5, '#1a1a1a'); c.p(ox + 9, oy + 5, '#1a1a1a')
    c.p(ox + 4, oy + 7, '#e88a8a')
    c.p(ox + 9, oy + 7, '#e88a8a')
    mc = '#7a2a2a'
    if mood in ('smile', 'sleep'):
        c.r(ox + 6, oy + 8, 2, 1, mc); c.p(ox + 5, oy + 7, mc); c.p(ox + 8, oy + 7, mc)
    elif mood == 'happy':
        c.r(ox + 5, oy + 7, 4, 2, mc); c.r(ox + 6, oy + 8, 2, 1, '#e88a8a')
    elif mood == 'sad':
        c.r(ox + 6, oy + 7, 2, 1, mc); c.p(ox + 5, oy + 8, mc); c.p(ox + 8, oy + 8, mc)
    elif mood == 'angry':
        c.r(ox + 5, oy + 7, 4, 2, '#5a1a1a')
    if beard:
        c.r(ox + 4, oy + 7, 6, 1, beard)
    # hats
    if hat == 'chef':
        c.r(ox + 3, oy - 1, 8, 2, '#f6f6f0')
        c.r(ox + 2, oy - 4, 4, 3, '#f6f6f0')
        c.r(ox + 5, oy - 5, 4, 4, '#f6f6f0')
        c.r(ox + 8, oy - 4, 4, 3, '#f6f6f0')
        c.r(ox + 3, oy + 1, 8, 1, '#d6d6cc')
    elif hat == 'cap':
        c.r(ox + 2, oy, 9, 3, hat_col)
        c.r(ox + 10, oy + 2, 4, 1, shade(hat_col, 0.8))
        c.p(ox + 6, oy + 1, '#f5c04a')
    elif hat == 'beanie':
        c.r(ox + 2, oy - 1, 10, 4, hat_col)
        c.r(ox + 2, oy + 2, 10, 1, shade(hat_col, 0.8))
        c.r(ox + 6, oy - 2, 2, 1, '#f6f6f0')
    elif hat == 'beret':
        c.r(ox + 2, oy, 9, 2, hat_col)
        c.p(ox + 6, oy - 1, hat_col)
    elif hat == 'bow':
        c.r(ox + 9, oy, 3, 2, hat_col)
        c.p(ox + 10, oy + 1, shade(hat_col, 0.7))
    return c.outline()


# ---------------------------------------------------------------- cat
def cat(frame='walk1'):
    c = C(22, 16)
    fur, lt, dk = '#7a4a2a', '#9a6438', '#5a3420'
    if frame == 'sit':
        c.r(5, 6, 9, 7, fur)
        c.r(6, 9, 4, 4, lt)
        c.r(9, 1, 8, 7, fur)
        c.r(9, 0, 2, 2, fur); c.r(15, 0, 2, 2, fur)
        c.p(10, 1, '#e88a8a'); c.p(15, 1, '#e88a8a')
        c.p(11, 4, '#1a1a1a'); c.p(14, 4, '#1a1a1a')
        c.p(11, 3, '#f5c04a'); c.p(14, 3, '#f5c04a')
        c.r(12, 5, 2, 1, '#e88a8a')
        c.r(6, 13, 3, 1, fur); c.r(11, 13, 3, 1, fur)
        c.r(2, 10, 3, 2, fur); c.r(1, 7, 2, 3, fur)
        c.r(10, 7, 6, 1, dk)
    else:
        up = 1 if frame == 'walk2' else 0
        c.r(3, 6, 12, 5, fur)
        c.r(5, 9, 8, 2, lt)
        c.r(4, 6, 2, 1, dk); c.r(8, 6, 2, 1, dk); c.r(12, 6, 2, 1, dk)
        c.r(13, 2, 7, 6, fur)
        c.r(13, 1, 2, 2, fur); c.r(18, 1, 2, 2, fur)
        c.p(14, 2, '#e88a8a'); c.p(18, 2, '#e88a8a')
        c.p(15, 4, '#f5c04a'); c.p(18, 4, '#f5c04a')
        c.p(15, 5, '#1a1a1a'); c.p(18, 5, '#1a1a1a')
        c.r(16, 6, 2, 1, '#e88a8a')
        tail_y = 2 if frame == 'walk1' else 3
        c.r(1, tail_y, 2, 5, fur); c.r(2, 6, 2, 1, fur)
        c.r(4, 11, 2, 3 - up, fur); c.r(12, 11, 2, 3 - up, fur)
        c.r(7, 11, 2, 2 + up, dk); c.r(10, 11, 2, 2 + up, dk)
    return c.outline()


# ---------------------------------------------------------------- brownies
def brownie(kind):
    c = C(20, 18)
    base, top, dark = '#5a3020', '#7a4430', '#3a1c12'
    if kind == 'blondie':
        base, top, dark = '#c98f48', '#e3b56a', '#9a6a30'
    if kind == 'golden':
        base, top, dark = '#d9a020', '#f5c94a', '#a87810'
    # body
    c.r(2, 7, 16, 8, base)
    c.r(2, 13, 16, 2, dark)
    c.r(3, 4, 15, 4, top)
    c.r(2, 5, 1, 3, top)
    c.r(17, 4, 1, 4, shade(top, 1.1))
    # crumbs on side
    c.pts([(4, 9), (8, 11), (12, 8), (15, 10), (6, 12)], dark)
    if kind == 'classic':
        for i in range(4):
            c.pts([(4 + i * 4, 6), (5 + i * 4, 5), (6 + i * 4, 4)], '#2a120a')
        c.pts([(5, 6), (13, 5)], '#a06a50')
    elif kind == 'blondie':
        c.pts([(5, 5), (9, 6), (13, 5), (7, 10), (12, 11), (15, 6)], '#5a3020')
    elif kind == 'mint':
        c.r(3, 3, 15, 3, '#8fe0b0')
        c.r(3, 3, 15, 1, '#b8f0cc')
        c.pts([(5, 4), (9, 3), (12, 4), (15, 3)], '#2a120a')
    elif kind == 'pb':
        c.pts([(4, 5), (5, 5), (6, 6), (7, 6), (8, 5), (10, 5), (11, 6), (12, 6), (13, 5), (15, 5), (16, 6)], '#e0b070')
        c.pts([(6, 10), (7, 10), (11, 9), (12, 9)], '#c98a4a')
    elif kind == 'caramel':
        for i in range(4):
            c.pts([(4 + i * 4, 6), (5 + i * 4, 5), (6 + i * 4, 4)], '#f0a030')
        c.pts([(5, 4), (9, 5), (13, 4), (16, 6), (7, 6)], '#ffffff')
        c.r(3, 7, 1, 3, '#f0a030'); c.r(10, 7, 1, 2, '#f0a030')
    elif kind == 'golden':
        for i in range(4):
            c.pts([(4 + i * 4, 6), (5 + i * 4, 5), (6 + i * 4, 4)], '#fff1b8')
        c.pts([(6, 9), (13, 10)], '#fff8dc')
    elif kind == 'smores':
        c.r(3, 4, 15, 2, '#d9a95a'); c.r(3, 4, 15, 1, '#f0c87a')
        for x in (4, 9, 14):
            c.r(x, 2, 4, 3, '#fbf6ec'); c.p(x + 1, 2, '#e8d6b0')
        c.pts([(6, 6), (12, 6)], '#2a120a')
    elif kind == 'rainbow':
        for i, col in enumerate(['#ff6a6a', '#ffb04a', '#f5e04a', '#6ad08a', '#6aa0ff', '#b07aff']):
            c.r(3 + i * 2 + (1 if i > 3 else 0), 4, 3, 2, col)
        c.pts([(5, 3), (10, 3), (15, 3)], '#ffffff')
    elif kind == 'galaxy':
        c.r(3, 4, 15, 4, '#4a2a7a'); c.r(2, 7, 16, 8, '#2a1a4a'); c.r(2, 13, 16, 2, '#1a0f30')
        c.pts([(5, 5), (11, 4), (15, 6), (8, 10), (13, 11), (4, 12)], '#fff1b8')
        c.pts([(9, 6), (6, 9)], '#8fe0f0'); c.p(14, 9, '#ff9ad0')
    elif kind == 'stale':
        pass
    c.outline()
    if kind == 'golden':
        for (x, y) in [(1, 1), (18, 2), (17, 15)]:
            c.pts([(x, y)], '#fff8dc')
    return c


def stale_brownie():
    c = brownie('classic')
    im = c.im
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and (r, g, b) != OUTLINE[:3]:
                gr = int(0.5 * (r + g + b) / 3 + 0.5 * r * 0.8)
                px[x, y] = (int(gr * 0.95 + 20), int(gr * 0.9 + 15), int(gr * 0.85 + 12), a)
    c.pts([(6, 2), (7, 1)], '#c9d3c0')
    return c


# ---------------------------------------------------------------- small icons
def icon(name):
    c = C(18, 18)
    if name == 'coin':
        c = C(12, 12)
        c.r(2, 1, 8, 10, '#f5c04a'); c.r(1, 2, 10, 8, '#f5c04a')
        c.r(8, 2, 2, 8, '#c99428'); c.r(2, 9, 8, 1, '#c99428')
        c.r(5, 3, 2, 6, '#c99428'); c.p(3, 3, '#fff1b8'); c.p(3, 4, '#fff1b8')
        return c.outline()
    if name in ('star', 'star_half', 'star_empty'):
        c = C(13, 13)
        rows = ['......x......', '.....xxx.....', '.....xxx.....', 'xxxxxxxxxxxxx', '.xxxxxxxxxxx.', '..xxxxxxxxx..',
                '...xxxxxxx...', '...xxxxxxx...', '..xxxx.xxxx..', '..xxx...xxx..', '.xx.......xx.']
        fill = {'star': '#f5c04a', 'star_half': '#f5c04a', 'star_empty': '#5a3a2a'}[name]
        c.grid(0, 1, rows, {'x': fill})
        if name == 'star_half':
            for y in range(13):
                for x in range(7, 13):
                    if c.im.getpixel((x, y))[3]:
                        c.p(x, y, '#5a3a2a')
        if name != 'star_empty':
            c.pts([(6, 4), (5, 5)], '#fff1b8')
        return c.outline()
    if name == 'heart':
        c = C(11, 10)
        c.grid(1, 1, ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'], {'x': '#ff6a8a'})
        c.pts([(2, 2), (2, 3)], '#ffd0dc')
        return c.outline()
    if name == 'pillow':
        c.r(2, 7, 14, 7, '#e6e6ee'); c.r(2, 12, 14, 2, '#c6c6d0')
        c.r(3, 3, 2, 2, '#b33a3a'); c.r(5, 5, 2, 2, '#b33a3a'); c.r(7, 7, 2, 2, '#b33a3a')
        c.r(7, 3, 2, 2, '#b33a3a'); c.r(3, 7, 2, 2, '#b33a3a')
        c.r(11, 2, 4, 1, '#8fb8de'); c.r(13, 3, 1, 1, '#8fb8de'); c.r(11, 4, 4, 1, '#8fb8de')
    elif name == 'coffee':
        c.r(3, 6, 10, 10, '#f0f0ea'); c.r(11, 6, 2, 10, '#c9c9c0')
        c.r(4, 6, 8, 2, '#5a3020')
        c.r(13, 8, 3, 1, '#f0f0ea'); c.r(15, 8, 1, 5, '#f0f0ea'); c.r(13, 12, 3, 1, '#f0f0ea')
        c.r(5, 1, 1, 2, '#c9d3e0'); c.r(6, 3, 1, 2, '#c9d3e0'); c.r(9, 1, 1, 2, '#c9d3e0'); c.r(10, 3, 1, 2, '#c9d3e0')
        c.r(6, 10, 4, 3, '#b33a3a')
    elif name == 'oven':
        c.r(1, 2, 16, 15, '#9aa0ad'); c.r(1, 2, 16, 3, '#c0c4cc')
        c.p(4, 3, '#f5c04a'); c.p(7, 3, '#f5c04a'); c.p(13, 3, '#b33a3a')
        c.r(3, 7, 12, 8, '#3a3d45'); c.r(5, 10, 8, 4, '#ff8a3d'); c.r(7, 9, 4, 2, '#ffc04a')
        c.r(3, 6, 12, 1, '#6a6d75')
    elif name == 'broom':
        c.pts([(14, 1), (13, 2), (12, 3), (11, 4), (10, 5), (9, 6), (8, 7)], '#8a5a2b')
        c.pts([(15, 1), (14, 2), (13, 3), (12, 4), (11, 5), (10, 6), (9, 7)], '#a8743f')
        c.r(3, 8, 7, 3, '#b33a3a')
        c.r(2, 11, 8, 5, '#e3c060'); c.pts([(3, 16), (5, 16), (7, 16), (9, 16)], '#e3c060')
        c.pts([(4, 12), (6, 13), (8, 12)], '#c9a040')
    elif name == 'sign':
        c.r(1, 2, 16, 9, '#5a3d28'); c.r(2, 3, 14, 7, '#3a2a20')
        c.r(4, 5, 2, 3, '#f5c04a'); c.r(7, 5, 2, 3, '#f5c04a'); c.r(10, 5, 1, 3, '#f5c04a'); c.r(12, 5, 2, 3, '#f5c04a')
        c.r(8, 11, 2, 6, '#5a3d28')
    elif name == 'paint':
        c.r(3, 6, 12, 10, '#9aa0ad'); c.r(12, 6, 3, 10, '#7a808d')
        c.r(3, 6, 12, 3, '#d97757'); c.r(5, 9, 2, 3, '#d97757'); c.r(10, 9, 1, 2, '#d97757')
        c.r(2, 2, 1, 4, '#5a5a5a'); c.r(2, 1, 14, 1, '#5a5a5a'); c.r(15, 2, 1, 4, '#5a5a5a')
    elif name == 'case':
        c.r(1, 3, 16, 10, '#c9e0f0'); c.r(1, 3, 16, 1, '#ffffff')
        c.r(3, 6, 3, 2, '#6b3a26'); c.r(7, 6, 3, 2, '#d9a95a'); c.r(11, 6, 3, 2, '#5aa878')
        c.r(3, 10, 3, 2, '#6b3a26'); c.r(7, 10, 3, 2, '#6b3a26'); c.r(11, 10, 3, 2, '#e0a040')
        c.r(1, 13, 16, 3, '#8a5a3e'); c.r(1, 16, 2, 1, '#5a3d28'); c.r(15, 16, 2, 1, '#5a3d28')
        c.p(15, 4, '#ffffff'); c.p(14, 5, '#ffffff')
    elif name == 'table':
        c.r(1, 6, 16, 3, '#a8743f'); c.r(1, 8, 16, 1, '#7a5030')
        c.r(3, 9, 2, 7, '#7a5030'); c.r(13, 9, 2, 7, '#7a5030')
        c.r(6, 3, 6, 3, '#f0e2c8'); c.r(7, 2, 4, 1, '#6b3a26')
    elif name == 'recipe':
        c.r(2, 1, 14, 16, '#f0e2c8'); c.r(13, 1, 3, 3, '#d8c6a4')
        c.r(4, 4, 8, 1, '#8a6a55'); c.r(4, 7, 10, 1, '#8a6a55'); c.r(4, 10, 9, 1, '#8a6a55'); c.r(4, 13, 6, 1, '#8a6a55')
        c.r(11, 11, 4, 4, '#6b3a26')
    elif name == 'clock':
        c.r(3, 2, 12, 14, '#f0f0ea'); c.r(2, 4, 14, 10, '#f0f0ea')
        c.r(8, 4, 2, 6, '#1a1a1a'); c.r(9, 8, 4, 2, '#1a1a1a')
    elif name == 'sun':
        c.r(5, 5, 8, 8, '#f5c04a'); c.r(4, 6, 10, 6, '#f5c04a')
        c.pts([(9, 1), (9, 2), (9, 15), (9, 16), (1, 9), (2, 9), (15, 9), (16, 9), (3, 3), (14, 3), (3, 14), (14, 14)], '#f5c04a')
        c.r(6, 6, 2, 2, '#fff1b8')
    elif name == 'moon':
        c.r(5, 3, 8, 12, '#f0eedc'); c.r(4, 5, 10, 8, '#f0eedc'); c.r(9, 3, 5, 9, (0, 0, 0, 0))
        c.r(8, 4, 3, 1, '#f0eedc')
        c.p(6, 8, '#c9c4a8'); c.p(7, 11, '#c9c4a8')
    # ---- v1.1: worker upgrades
    elif name == 'mitts':
        for x0, y0, tx in ((1, 4, 0), (10, 3, 15)):
            c.r(x0 + 1, y0, 5, 10, '#c24a4a'); c.r(x0, y0 + 2, 7, 7, '#c24a4a')
            c.r(tx, y0 + 4, 2, 3, '#c24a4a')
            c.r(x0, y0 + 9, 7, 3, '#f6e7cf')
            c.p(x0 + 3, y0 + 3, '#ff9ad0'); c.p(x0 + 2, y0 + 5, '#ff9ad0'); c.p(x0 + 4, y0 + 6, '#ff9ad0')
    elif name == 'rollingpin':
        c.r(4, 7, 10, 4, '#d9a95a'); c.r(4, 7, 10, 1, '#f0c87a'); c.r(4, 10, 10, 1, '#b8873a')
        c.r(1, 8, 3, 2, '#8a5a2b'); c.r(14, 8, 3, 2, '#8a5a2b')
        c.pts([(5, 13), (8, 14), (12, 13), (6, 4), (11, 5)], '#ffffff')
    elif name == 'spatula':
        c.r(9, 3, 8, 9, '#f5c04a'); c.r(9, 3, 8, 1, '#fff1b8')
        c.r(11, 5, 1, 5, '#c99428'); c.r(14, 5, 1, 5, '#c99428')
        c.r(6, 8, 3, 2, '#c99428'); c.r(1, 8, 5, 3, '#6b3a26')
        c.pts([(4, 2), (3, 3), (5, 3), (4, 4)], '#fff1b8')
    elif name == 'espresso':
        c.r(5, 9, 8, 6, '#f0f0ea'); c.r(11, 9, 2, 6, '#c9c9c0'); c.r(6, 9, 6, 2, '#3a1c12')
        c.r(13, 10, 2, 1, '#f0f0ea'); c.r(14, 10, 1, 3, '#f0f0ea'); c.r(13, 12, 2, 1, '#f0f0ea')
        c.r(3, 15, 12, 1, '#d6d6cc')
        c.pts([(7, 3), (8, 4), (7, 5), (7, 6), (10, 2), (11, 3), (10, 4), (10, 5)], '#c9d3e0')
    elif name == 'fancymug':
        c.r(3, 6, 10, 10, '#ff9ad0'); c.r(11, 6, 2, 10, '#c25a8a')
        c.r(3, 6, 10, 1, '#f5c04a'); c.r(4, 7, 8, 1, '#5a3020')
        c.r(13, 8, 3, 1, '#f5c04a'); c.r(15, 8, 1, 5, '#f5c04a'); c.r(13, 12, 3, 1, '#f5c04a')
        c.r(5, 10, 2, 2, '#ffffff'); c.r(8, 10, 2, 2, '#ffffff'); c.r(6, 12, 3, 1, '#ffffff'); c.p(7, 13, '#ffffff')
        c.pts([(6, 1), (6, 2), (7, 3), (7, 4), (9, 2), (9, 3), (10, 4)], '#c9d3e0')
    elif name == 'coffeepot':
        c.r(4, 3, 10, 4, '#2a2a2a'); c.r(6, 2, 6, 1, '#2a2a2a')
        c.r(4, 7, 10, 9, '#c9e0f0'); c.r(4, 10, 10, 6, '#5a3020'); c.r(5, 8, 1, 2, '#ffffff')
        c.r(14, 8, 2, 1, '#2a2a2a'); c.r(15, 8, 1, 6, '#2a2a2a'); c.r(14, 13, 2, 1, '#2a2a2a')
        c.r(2, 7, 2, 2, '#2a2a2a'); c.r(4, 16, 10, 1, '#3a3d45')
    elif name == 'whisk':
        c.r(8, 11, 2, 6, '#8a5a2b'); c.r(8, 16, 2, 1, '#5a3a1b')
        c.r(5, 3, 1, 7, '#c0c4cc'); c.r(12, 3, 1, 7, '#c0c4cc'); c.r(6, 1, 6, 1, '#c0c4cc')
        c.p(5, 2, '#c0c4cc'); c.p(12, 2, '#c0c4cc'); c.r(6, 10, 6, 1, '#c0c4cc')
        c.r(8, 2, 1, 8, '#9aa0ad'); c.r(9, 2, 1, 8, '#9aa0ad'); c.p(7, 3, '#ffffff')
    elif name == 'shoes':
        c.r(4, 8, 9, 6, '#c24a4a'); c.r(12, 10, 4, 4, '#c24a4a'); c.r(4, 8, 3, 2, '#9a2a2a')
        c.r(3, 14, 14, 2, '#f6f6f0')
        c.pts([(8, 9), (9, 10), (10, 9), (11, 10)], '#ffffff')
        c.r(0, 9, 3, 1, '#f5c04a'); c.r(1, 11, 2, 1, '#f5c04a'); c.r(0, 13, 2, 1, '#f5c04a')
    elif name == 'trays':
        for y in (7, 14):
            c.r(1, y, 16, 1, '#9aa0ad'); c.r(1, y + 1, 16, 1, '#6a6d75')
            c.r(3, y - 3, 5, 3, '#6b3a26'); c.r(10, y - 3, 5, 3, '#6b3a26')
            c.r(3, y - 3, 5, 1, '#8a5a3e'); c.r(10, y - 3, 5, 1, '#8a5a3e')
    elif name == 'smile':
        c.r(4, 2, 10, 14, '#f5c04a'); c.r(2, 4, 14, 10, '#f5c04a'); c.r(3, 3, 12, 12, '#f5c04a')
        c.r(6, 6, 2, 3, '#1a1a1a'); c.r(10, 6, 2, 3, '#1a1a1a')
        c.pts([(5, 10), (6, 11), (7, 12), (8, 12), (9, 12), (10, 12), (11, 11), (12, 10)], '#7a2a2a')
        c.p(4, 9, '#e88a8a'); c.p(13, 9, '#e88a8a'); c.p(5, 4, '#fff1b8')
    elif name == 'register':
        c.r(1, 9, 16, 7, '#9aa0ad'); c.r(1, 9, 16, 1, '#c0c4cc'); c.r(1, 15, 16, 2, '#6a6d75')
        c.r(4, 2, 10, 6, '#3a3d45'); c.r(5, 3, 8, 3, '#8fe0b0'); c.r(8, 3, 2, 3, '#2a7a2a')
        c.r(8, 8, 2, 1, '#3a3d45')
        for y in (11, 13):
            for x in (3, 6, 9, 12):
                c.r(x, y, 2, 1, '#f6f6f0')
    elif name == 'fire':
        c.r(4, 8, 10, 8, '#ff6a2a'); c.r(6, 4, 6, 8, '#ff8a3d'); c.r(8, 1, 2, 5, '#ffc04a')
        c.r(3, 6, 2, 4, '#ff8a3d'); c.r(13, 5, 2, 5, '#ff8a3d'); c.r(7, 9, 4, 6, '#ffe08a'); c.r(8, 11, 2, 3, '#ffffff')
        c.r(2, 15, 14, 2, '#6b3a26')
    elif name == 'pans':
        c.r(1, 7, 16, 7, '#9aa0ad'); c.r(2, 7, 14, 5, '#6b3a26'); c.r(2, 7, 14, 1, '#8a5a3e')
        c.r(6, 7, 1, 5, '#3a1c12'); c.r(11, 7, 1, 5, '#3a1c12'); c.r(2, 9, 14, 1, '#3a1c12')
        c.r(0, 9, 1, 2, '#6a6d75'); c.r(17, 9, 1, 2, '#6a6d75')
    elif name == 'magicflame':
        c.r(4, 8, 10, 8, '#7a5aff'); c.r(6, 4, 6, 8, '#a06aff'); c.r(8, 1, 2, 5, '#ff9ad0')
        c.r(3, 6, 2, 4, '#5a8aff'); c.r(13, 5, 2, 5, '#5a8aff'); c.r(7, 9, 4, 6, '#8fe0f0'); c.r(8, 11, 2, 3, '#ffffff')
        c.r(2, 15, 14, 2, '#6b3a26'); c.pts([(1, 2), (16, 3), (15, 12)], '#fff1b8')
    elif name == 'bike':
        for cx in (4, 13):
            c.r(cx - 2, 11, 5, 1, '#2a2a2a'); c.r(cx - 2, 17, 5, 1, '#2a2a2a')
            c.r(cx - 3, 12, 1, 5, '#2a2a2a'); c.r(cx + 3, 12, 1, 5, '#2a2a2a'); c.p(cx, 14, '#9aa0ad')
        c.r(4, 14, 5, 1, '#c24a4a'); c.pts([(5, 13), (6, 12), (7, 11)], '#c24a4a')
        c.r(8, 9, 1, 6, '#c24a4a'); c.r(8, 10, 5, 1, '#c24a4a')
        c.pts([(12, 11), (12, 12), (13, 13), (13, 14)], '#c24a4a')
        c.r(6, 8, 4, 1, '#3a2418'); c.r(12, 6, 1, 4, '#3a3a3a'); c.r(11, 6, 3, 1, '#3a3a3a')
        c.r(13, 2, 5, 4, '#a8743f'); c.r(14, 1, 3, 1, '#6b3a26')
    elif name == 'basket':
        c.r(2, 7, 14, 9, '#a8743f'); c.r(2, 7, 14, 1, '#c9945a')
        for x in (4, 8, 12):
            c.r(x, 8, 1, 8, '#7a5030')
        c.r(2, 11, 14, 1, '#7a5030')
        c.r(4, 4, 4, 3, '#6b3a26'); c.r(9, 3, 5, 4, '#6b3a26'); c.r(9, 3, 5, 1, '#8a5a3e')
        c.r(5, 1, 8, 1, '#7a5030'); c.r(4, 2, 1, 5, '#7a5030'); c.r(13, 2, 1, 5, '#7a5030')
    elif name == 'ebike':
        for cx in (4, 13):
            c.r(cx - 2, 11, 5, 1, '#2a2a2a'); c.r(cx - 2, 17, 5, 1, '#2a2a2a')
            c.r(cx - 3, 12, 1, 5, '#2a2a2a'); c.r(cx + 3, 12, 1, 5, '#2a2a2a'); c.p(cx, 14, '#8fe0f0')
        c.r(4, 14, 5, 1, '#3f6fb5'); c.pts([(5, 13), (6, 12), (7, 11)], '#3f6fb5')
        c.r(8, 9, 1, 6, '#3f6fb5'); c.r(8, 10, 5, 1, '#3f6fb5'); c.pts([(12, 11), (12, 12), (13, 13), (13, 14)], '#3f6fb5')
        c.r(5, 11, 3, 2, '#f5c04a'); c.r(6, 8, 4, 1, '#3a2418'); c.r(11, 6, 3, 1, '#3a3a3a'); c.r(12, 7, 1, 3, '#3a3a3a')
        c.pts([(15, 3), (14, 4), (16, 4), (15, 5), (15, 6), (14, 7)], '#f5c04a')
    # ---- v1.1: customer upgrades
    elif name == 'display':
        c.r(3, 2, 12, 1, '#c9e0f0'); c.r(2, 3, 1, 8, '#c9e0f0'); c.r(15, 3, 1, 8, '#c9e0f0')
        c.r(4, 6, 10, 5, '#5a3020'); c.r(4, 6, 10, 2, '#7a4430'); c.pts([(6, 6), (9, 7), (12, 6)], '#2a120a')
        c.r(2, 11, 14, 1, '#ffffff'); c.r(8, 12, 2, 4, '#c9e0f0'); c.r(5, 16, 8, 1, '#c9e0f0')
        c.pts([(13, 4), (4, 4)], '#ffffff')
    elif name == 'samples':
        c.r(2, 12, 14, 2, '#f6f6f0'); c.r(3, 14, 12, 1, '#d6d6cc')
        for x in (3, 7, 11):
            c.r(x, 9, 3, 3, '#6b3a26'); c.r(x, 9, 3, 1, '#8a5a3e'); c.r(x + 1, 5, 1, 4, '#e3c060')
        c.r(10, 2, 7, 3, '#c24a4a'); c.r(11, 3, 5, 1, '#ffffff')
    elif name == 'flyer':
        c.r(3, 2, 12, 15, '#f6e7cf'); c.r(3, 2, 12, 4, '#c25a8a'); c.r(5, 3, 8, 1, '#ff9ad0')
        c.r(6, 8, 6, 4, '#6b3a26'); c.r(6, 8, 6, 1, '#8a5a3e')
        c.r(5, 14, 8, 1, '#8a6a55'); c.r(13, 15, 2, 2, '#d8c6a4'); c.r(8, 0, 2, 2, '#b33a3a')
    elif name == 'news':
        c.r(1, 3, 16, 13, '#e6e2d6'); c.r(2, 4, 14, 2, '#2a2a2a')
        c.r(2, 7, 7, 6, '#9a9a9a'); c.r(3, 9, 5, 3, '#6b3a26'); c.r(3, 9, 5, 1, '#8a5a3e')
        for y in (7, 9, 11, 13):
            c.r(10, y, 6, 1, '#6a6a6a')
        c.r(2, 14, 7, 1, '#6a6a6a')
    elif name == 'line':
        c.r(2, 4, 2, 12, '#f5c04a'); c.r(14, 4, 2, 12, '#f5c04a')
        c.r(1, 3, 4, 2, '#fff1b8'); c.r(13, 3, 4, 2, '#fff1b8'); c.r(1, 16, 4, 1, '#c99428'); c.r(13, 16, 4, 1, '#c99428')
        c.pts([(4, 6), (5, 7), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8), (11, 8), (12, 7), (13, 6)], '#b33a3a')
        c.pts([(5, 8), (6, 9), (7, 9), (8, 9), (9, 9), (10, 9), (11, 9), (12, 8)], '#8a2a2a')
    elif name == 'tipjar':
        c.r(4, 4, 10, 13, '#c9e0f0'); c.r(5, 2, 8, 2, '#a8c0d0')
        c.r(5, 11, 8, 5, '#f5c04a'); c.pts([(6, 12), (9, 13), (11, 11), (7, 15), (12, 14)], '#c99428')
        c.r(5, 6, 8, 4, '#f6e7cf'); c.r(8, 6, 2, 4, '#2a7a2a'); c.r(5, 5, 1, 5, '#ffffff')
    elif name == 'rush':
        c.r(3, 3, 11, 13, '#f0f0ea'); c.r(2, 5, 13, 9, '#f0f0ea')
        c.r(8, 4, 1, 6, '#1a1a1a'); c.r(7, 4, 1, 6, '#1a1a1a'); c.r(6, 9, 4, 1, '#b33a3a')
        c.pts([(16, 0), (15, 1), (16, 1), (14, 2), (15, 2), (15, 3), (16, 3), (15, 4)], '#f5c04a')
    elif name == 'party':
        c.r(2, 7, 14, 9, '#ff9ad0'); c.r(2, 6, 14, 2, '#c25a8a'); c.r(8, 6, 2, 10, '#f5c04a')
        c.r(5, 3, 3, 3, '#f5c04a'); c.r(10, 3, 3, 3, '#f5c04a'); c.r(8, 4, 2, 2, '#c99428')
        c.pts([(4, 10), (13, 12), (5, 14)], '#ffffff')
    elif name == 'tv':
        c.r(1, 4, 16, 11, '#3a3d45'); c.r(3, 6, 10, 7, '#8fc4e8'); c.r(5, 9, 6, 3, '#6b3a26'); c.r(5, 9, 6, 1, '#8a5a3e')
        c.r(14, 6, 2, 2, '#f5c04a'); c.r(14, 10, 2, 1, '#c0c4cc'); c.r(14, 12, 2, 1, '#c0c4cc')
        c.pts([(6, 3), (5, 2), (4, 1), (11, 3), (12, 2), (13, 1)], '#2a2a2a'); c.r(3, 15, 2, 2, '#2a2a2a'); c.r(13, 15, 2, 2, '#2a2a2a')
    # ---- v1.2: new workers, upgrades, fix-ups and the MegaMuffin bar
    elif name == 'truck':
        c.r(1, 5, 11, 8, '#8a5a3e'); c.r(12, 7, 5, 6, '#8a5a3e'); c.r(13, 8, 3, 2, '#8fc4e8')
        c.r(1, 5, 11, 1, '#a8743f'); c.r(3, 7, 7, 4, '#f6e7cf'); c.r(5, 8, 3, 2, '#5a3020')
        c.r(1, 12, 16, 1, '#5a3324')
        for x in (3, 12):
            c.r(x, 13, 3, 3, '#2a2a2a'); c.p(x + 1, 14, '#9aa0ad')
    elif name == 'bigtruck':
        c.r(0, 3, 12, 10, '#5a3324'); c.r(12, 6, 6, 7, '#5a3324'); c.r(13, 7, 4, 3, '#8fc4e8')
        c.r(2, 5, 8, 6, '#f5c04a'); c.r(5, 6, 2, 4, '#5a3324'); c.r(4, 7, 6, 2, '#5a3324')
        for x in (2, 8, 13):
            c.r(x, 13, 3, 3, '#2a2a2a'); c.p(x + 1, 14, '#9aa0ad')
    elif name == 'music':
        c.r(6, 3, 2, 10, '#2a2a2a'); c.r(6, 2, 8, 2, '#2a2a2a'); c.r(12, 3, 2, 8, '#2a2a2a')
        c.r(3, 11, 5, 4, '#2a2a2a'); c.r(9, 9, 5, 4, '#2a2a2a'); c.pts([(4, 12), (10, 10)], '#9aa0ad')
        c.pts([(1, 3), (2, 2), (16, 13), (15, 14)], '#f5c04a')
    elif name == 'oil':
        c.r(3, 8, 10, 8, '#c24a4a'); c.r(3, 8, 10, 1, '#e06a6a'); c.r(5, 5, 4, 3, '#c24a4a')
        c.r(13, 9, 3, 1, '#9aa0ad'); c.r(15, 7, 1, 2, '#9aa0ad'); c.r(6, 11, 4, 2, '#f5c04a')
        c.pts([(16, 10), (16, 12), (16, 14)], '#3a3a3a')
    elif name == 'turbo':
        c.pts([(10, 1), (9, 2), (10, 2), (8, 3), (9, 3), (7, 4), (8, 4), (6, 5), (7, 5), (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6), (11, 6),
               (9, 7), (10, 7), (8, 8), (9, 8), (7, 9), (8, 9), (6, 10), (7, 10), (5, 11), (6, 11), (4, 12), (5, 12)], '#f5c04a')
        c.pts([(10, 1), (7, 4), (5, 6)], '#fff1b8'); c.r(11, 10, 5, 1, '#8fe0f0'); c.r(12, 13, 4, 1, '#8fe0f0'); c.r(1, 2, 3, 1, '#8fe0f0')
    elif name == 'billboard':
        c.r(1, 2, 16, 9, '#f6e7cf'); c.r(1, 2, 16, 2, '#c24a4a')
        c.r(3, 6, 5, 3, '#6b3a26'); c.r(3, 6, 5, 1, '#8a5a3e'); c.r(10, 6, 5, 1, '#8a6a55'); c.r(10, 8, 4, 1, '#8a6a55')
        c.r(4, 11, 2, 6, '#6b4a32'); c.r(12, 11, 2, 6, '#6b4a32')
    elif name == 'blogger':
        c.r(5, 1, 9, 16, '#2a2a2a'); c.r(6, 3, 7, 11, '#8fc4e8'); c.r(8, 15, 3, 1, '#6a6d75')
        c.r(7, 6, 2, 2, '#ff6a8a'); c.r(10, 6, 2, 2, '#ff6a8a'); c.r(7, 8, 5, 1, '#ff6a8a'); c.r(8, 9, 3, 1, '#ff6a8a'); c.p(9, 10, '#ff6a8a')
        c.pts([(1, 4), (2, 3), (16, 11), (15, 12)], '#f5c04a')
    elif name == 'fanclub':
        c.r(3, 1, 12, 12, '#c24a4a'); c.r(2, 3, 14, 8, '#c24a4a'); c.r(5, 13, 3, 4, '#3f6fb5'); c.r(10, 13, 3, 4, '#3f6fb5')
        c.r(6, 4, 2, 2, '#ffffff'); c.r(10, 4, 2, 2, '#ffffff'); c.r(6, 6, 6, 2, '#ffffff'); c.r(7, 8, 4, 1, '#ffffff'); c.r(8, 9, 2, 1, '#ffffff')
    elif name == 'neon':
        c.r(1, 3, 16, 12, '#2a1a2a')
        c.r(3, 5, 2, 8, '#ff9ad0'); c.r(5, 5, 3, 1, '#ff9ad0'); c.r(5, 8, 3, 1, '#ff9ad0'); c.r(5, 12, 3, 1, '#ff9ad0'); c.r(8, 6, 1, 2, '#ff9ad0'); c.r(8, 9, 1, 3, '#ff9ad0')
        c.r(11, 5, 4, 8, '#8fe0f0'); c.r(12, 6, 2, 6, '#2a1a2a'); c.pts([(2, 1), (15, 1)], '#5a5a5a')
    elif name == 'floor':
        for y in range(4):
            for x in range(4):
                c.r(1 + x * 4, 1 + y * 4, 4, 4, '#f6e7cf' if (x + y) % 2 else '#5a3324')
    elif name == 'fountain':
        c.r(3, 14, 12, 3, '#c0c4cc'); c.r(5, 10, 8, 4, '#5a3020'); c.r(4, 9, 10, 1, '#c0c4cc')
        c.r(8, 3, 2, 7, '#c0c4cc'); c.r(6, 6, 6, 1, '#c0c4cc'); c.r(7, 2, 4, 1, '#5a3020')
        c.pts([(6, 7), (5, 8), (11, 7), (12, 8), (7, 3), (10, 3)], '#5a3020'); c.p(13, 12, '#f5c04a')
    elif name == 'frame':
        c.r(1, 1, 16, 16, '#f5c04a'); c.r(3, 3, 12, 12, '#8fa3b8'); c.r(1, 1, 16, 1, '#fff1b8')
        c.r(6, 4, 6, 3, '#e6e6e6'); c.r(6, 6, 6, 5, '#e8b48a'); c.p(7, 8, '#1a1a1a'); c.p(10, 8, '#1a1a1a'); c.r(5, 11, 8, 4, '#b05a8a')
        c.pts([(0, 0), (17, 0), (0, 17), (17, 17)], '#fff1b8')
    elif name == 'backroom':
        c.r(2, 1, 14, 16, '#8a5a3e'); c.r(4, 3, 10, 14, '#3a2418'); c.r(4, 3, 10, 1, '#5a3324')
        c.r(5, 5, 8, 3, '#f6e7cf'); c.r(6, 6, 6, 1, '#b33a3a'); c.p(12, 11, '#f5c04a')
    elif name == 'upstairs':
        for i in range(5):
            c.r(2 + i * 3, 13 - i * 3, 16 - (2 + i * 3), 3, '#a8743f'); c.r(2 + i * 3, 13 - i * 3, 16 - (2 + i * 3), 1, '#c9945a')
        c.r(2, 16, 14, 1, '#6b4a32'); c.pts([(14, 1), (15, 2), (13, 2)], '#f5c04a')
    elif name == 'factory':
        c.r(1, 8, 16, 9, '#8a5a3e'); c.pts([(1, 7), (5, 7), (9, 7), (13, 7)], '#8a5a3e')
        for x in (1, 5, 9):
            c.pts([(x + 1, 6), (x + 2, 5), (x + 3, 4)], '#8a5a3e'); c.r(x + 1, 7, 3, 1, '#8a5a3e')
        c.r(13, 1, 3, 7, '#5a3324'); c.r(3, 11, 3, 3, '#f5c04a'); c.r(8, 11, 3, 3, '#f5c04a'); c.r(13, 12, 3, 5, '#3a2418')
        c.pts([(14, 0), (15, 0)], '#c0c4cc')
    elif name == 'muffin':
        c.r(3, 9, 12, 8, '#ff9ad0')
        for x in (4, 7, 10, 13):
            c.r(x, 9, 1, 8, '#c25a8a')
        c.r(2, 4, 14, 5, '#c98f48'); c.r(4, 2, 10, 2, '#c98f48'); c.r(3, 3, 12, 1, '#e3b56a')
        c.pts([(5, 5), (9, 4), (12, 6), (7, 7)], '#5a3020'); c.r(8, 0, 2, 2, '#c24a4a')
    elif name == 'crown':
        c.r(2, 8, 14, 7, '#f5c04a'); c.r(2, 14, 14, 2, '#c99428')
        c.r(2, 4, 3, 4, '#f5c04a'); c.r(8, 2, 2, 6, '#f5c04a'); c.r(13, 4, 3, 4, '#f5c04a')
        c.r(3, 3, 1, 1, '#fff1b8'); c.r(8, 1, 2, 1, '#fff1b8'); c.r(14, 3, 1, 1, '#fff1b8')
        c.r(5, 10, 2, 2, '#c24a4a'); c.r(8, 10, 2, 2, '#3f6fb5'); c.r(11, 10, 2, 2, '#4a8a4a')
    return c.outline()


def robot(frame=1):
    c = C(20, 32)
    body, dark = '#9aa0ad', '#6a6d75'
    c.r(9, 1, 2, 4, dark); c.r(8, 0, 4, 2, '#c24a4a' if frame == 1 else '#ff6a6a')
    c.r(4, 5, 12, 9, body); c.r(5, 6, 10, 6, '#3a3d45')
    eye = '#8fe0f0'
    if frame == 1:
        c.r(7, 8, 2, 2, eye); c.r(11, 8, 2, 2, eye)
    else:
        c.r(7, 9, 2, 1, eye); c.r(11, 9, 2, 1, eye)
    c.r(8, 11, 4, 1, eye)
    c.r(3, 15, 14, 9, body); c.r(3, 15, 14, 1, '#c0c4cc'); c.r(6, 17, 8, 4, '#f6e7cf'); c.r(8, 18, 4, 2, '#5a3020')
    c.r(1, 16, 2, 7, dark); c.r(17, 16, 2, 7, dark); c.r(0, 22, 3, 2, '#c0c4cc'); c.r(17, 22, 3, 2, '#c0c4cc')
    c.r(5, 24, 10, 3, dark); c.r(3, 27, 14, 4, '#3a3d45')
    for x in (5, 9, 13):
        c.r(x, 28, 2, 2, '#9aa0ad' if (x // 4 + frame) % 2 else '#c0c4cc')
    return c.outline()


# ---------------------------------------------------------------- props
def oven():
    c = C(48, 64)
    for y in range(8, 64):
        for x in range(2, 46):
            row = (y - 8) // 4
            off = 6 if row % 2 else 0
            mortar = (y - 8) % 4 == 3 or ((x - 2 + off) % 12 == 11)
            c.p(x, y, '#7a3a2c' if mortar else '#a0533f')
    c.r(16, 0, 16, 8, '#8a4434'); c.r(14, 0, 20, 2, '#6a3024')
    c.r(10, 22, 28, 22, '#1a0d0a')
    c.r(12, 20, 24, 2, '#1a0d0a'); c.r(14, 18, 20, 2, '#1a0d0a')
    c.r(12, 34, 24, 10, '#ff6a2a'); c.r(16, 30, 16, 6, '#ff8a3d'); c.r(20, 27, 8, 4, '#ffc04a'); c.r(18, 36, 12, 5, '#ffe08a')
    c.r(6, 44, 36, 4, '#5a2e24'); c.r(2, 48, 44, 16, '#5a3024')
    c.r(4, 52, 40, 1, '#3a1c14'); c.r(4, 58, 40, 1, '#3a1c14')
    return c.outline()


def counter():
    c = C(64, 32)
    c.r(0, 0, 64, 4, '#a8743f'); c.r(0, 3, 64, 1, '#7a5030')
    c.r(1, 4, 62, 28, '#6b4a32')
    c.r(5, 8, 24, 20, '#5a3d28'); c.r(35, 8, 24, 20, '#5a3d28')
    c.r(5, 8, 24, 1, '#7a5a42'); c.r(35, 8, 24, 1, '#7a5a42')
    c.r(1, 30, 62, 2, '#3a2a20')
    return c.outline()


def door():
    c = C(32, 64)
    c.r(1, 1, 30, 63, '#6b4a32'); c.r(3, 3, 26, 61, '#5a3d28')
    c.r(6, 6, 20, 18, '#8fc4e8'); c.r(15, 6, 2, 18, '#5a3d28'); c.r(6, 14, 20, 2, '#5a3d28')
    c.p(8, 8, '#ffffff'); c.p(9, 9, '#ffffff')
    c.r(6, 30, 20, 12, '#4a3020'); c.r(6, 46, 20, 14, '#4a3020')
    c.r(25, 38, 3, 3, '#f5c04a')
    c.r(9, 26, 14, 6, '#f6f6f0'); c.r(11, 28, 10, 2, '#2a7a2a')
    return c.outline()


def window_():
    c = C(56, 44)
    c.r(0, 0, 56, 44, '#5a3d28')
    c.r(4, 4, 22, 34, '#8fc4e8'); c.r(30, 4, 22, 34, '#8fc4e8')
    c.r(6, 10, 8, 3, '#ffffff'); c.r(4, 11, 12, 2, '#ffffff'); c.r(36, 16, 10, 2, '#ffffff'); c.r(38, 15, 5, 1, '#ffffff')
    c.r(4, 30, 22, 8, '#c25a8a'); c.r(30, 30, 22, 8, '#c25a8a'); c.r(10, 32, 10, 2, '#ff9ad0')
    c.r(0, 40, 56, 4, '#7a5a42'); c.r(10, 36, 4, 4, '#4a8a4a'); c.r(42, 36, 4, 4, '#4a8a4a'); c.p(11, 35, '#ff6a8a'); c.p(43, 35, '#f5c04a')
    return c.outline()


def lamp(on=True):
    c = C(16, 28)
    c.r(7, 0, 2, 14, '#2a1a10')
    c.r(3, 14, 10, 4, '#3a5a3a'); c.r(2, 17, 12, 2, '#2a4a2a')
    c.r(5, 19, 6, 2, '#ffe08a' if on else '#c9b78a')
    c.outline()
    if on:
        c.pts([(3, 23), (8, 24), (12, 23)], '#fff1b8')
    return c


def portrait():
    c = C(22, 26)
    c.r(0, 0, 22, 26, '#c9a050'); c.r(2, 2, 18, 22, '#8fa3b8')
    c.r(6, 4, 10, 4, '#e6e6e6'); c.r(5, 6, 2, 5, '#e6e6e6'); c.r(15, 6, 2, 5, '#e6e6e6')
    c.r(7, 7, 8, 7, '#e8b48a')
    c.p(8, 9, '#1a1a1a'); c.p(13, 9, '#1a1a1a'); c.r(7, 8, 3, 1, '#5a5a5a'); c.r(12, 8, 3, 1, '#5a5a5a')
    c.r(9, 12, 4, 1, '#b33a3a'); c.p(8, 11, '#e88a8a'); c.p(14, 11, '#e88a8a')
    c.r(5, 15, 12, 9, '#b05a8a'); c.r(9, 15, 4, 2, '#f0e2c8')
    return c.outline()


def chalkboard():
    c = C(44, 28)
    c.r(0, 0, 44, 28, '#8a5a3e'); c.r(2, 2, 40, 24, '#2a332a')
    c.r(6, 6, 20, 2, '#e6e6e6'); c.r(6, 11, 14, 1, '#c9d3c0'); c.r(6, 15, 18, 1, '#c9d3c0')
    c.r(31, 10, 7, 6, '#6b3a26'); c.r(31, 10, 7, 2, '#8a5a3e')
    c.r(30, 19, 4, 2, '#f5c04a'); c.r(35, 19, 4, 2, '#f5c04a')
    return c.outline()


def golden_sparkle():
    c = C(32, 32)
    b = brownie('golden').im
    c.im.paste(b, (6, 7), b)
    for x, y, s in [(3, 4, 2), (26, 3, 3), (27, 25, 2), (4, 26, 2)]:
        c.r(x, y - s, 1, s * 2 + 1, '#fff1b8'); c.r(x - s, y, s * 2 + 1, 1, '#fff1b8')
    return c


# ---------------------------------------------------------------- catalogue
CHAR = []


def add(group, name, img, frames=None):
    CHAR.append((group, name, img if isinstance(img, Image.Image) else img.im))


BAKER = dict(skin=SKINS['light'], hair='#4a2a1a', shirt='#dfe3ea', hat='chef', apron=True)
add('characters', 'baker_idle', person(**BAKER))
add('characters', 'baker_bake', person(frame='bake', mood='happy', **BAKER))
add('characters', 'baker_walk1', person(frame='walk1', **BAKER))
add('characters', 'baker_walk2', person(frame='walk2', **BAKER))
OFFICE = dict(skin=SKINS['light'], hair='#4a2a1a', shirt='#dfe3ea', tie='#4a6fa5')
add('characters', 'you_office', person(**OFFICE))
add('characters', 'you_office_sleep', person(mood='sleep', **OFFICE))
add('characters', 'you_office_sad', person(mood='sad', **OFFICE))
DAVE = dict(skin=SKINS['tan'], hair='#1a1a1a', shirt='#4a8a4a', glasses=True, apron=True)
add('characters', 'dave_walk1', person(frame='walk1', tray=True, **DAVE))
add('characters', 'dave_walk2', person(frame='walk2', tray=True, **DAVE))
LINDA = dict(skin=SKINS['rosy'], hair='#c2702a', shirt='#b05a8a', long_hair=True, apron=True)
add('characters', 'linda_idle', person(**LINDA))
add('characters', 'linda_happy', person(mood='happy', **LINDA))
BOSS = dict(skin='#e3a48a', hair='#3a2a20', shirt='#2b2f38', tie='#b33a3a', bald=True, beard='#3a2a20')
add('characters', 'boss_angry', person(mood='angry', **BOSS))
add('characters', 'boss_walk1', person(frame='walk1', mood='sad', **BOSS))
add('characters', 'boss_happy', person(mood='happy', **BOSS))
add('characters', 'boss_apron', person(mood='happy', apron=True, hat='chef', **BOSS))
add('characters', 'robot1', robot(1))
add('characters', 'robot2', robot(2))
CUST = [
    ('mo', dict(skin=SKINS['brown'], hair='#2a1a10', shirt='#3f6fb5', hat='cap', hat_col='#2b4a80')),
    ('pip', dict(skin=SKINS['light'], hair='#c2702a', shirt='#e0a030', kid=True, hat='beanie', hat_col='#4a8a4a')),
    ('rose', dict(skin=SKINS['rosy'], hair='#d8d8d8', shirt='#b05a8a', long_hair=True)),
    ('gus', dict(skin=SKINS['dark'], hair='#1a1a1a', shirt='#4a8a4a', beard='#1a1a1a')),
    ('jen', dict(skin=SKINS['light'], hair='#6a3a1a', shirt='#c24a4a', long_hair=True, hat='bow', hat_col='#ff9ad0')),
    ('critic', dict(skin=SKINS['tan'], hair='#2a2a2a', shirt='#2a2a2a', hat='beret', hat_col='#8a2a3a', glasses=True)),
]
for nm, kw in CUST:
    add('customers', nm + '_walk1', person(frame='walk1', **kw))
    add('customers', nm + '_walk2', person(frame='walk2', **kw))
    add('customers', nm + '_happy', person(mood='happy', **kw))
    add('customers', nm + '_sad', person(mood='sad', **kw))
add('pets', 'fudge_walk1', cat('walk1'))
add('pets', 'fudge_walk2', cat('walk2'))
add('pets', 'fudge_sit', cat('sit'))
for k in ['classic', 'blondie', 'mint', 'pb', 'caramel', 'golden', 'smores', 'rainbow', 'galaxy']:
    add('brownies', 'brownie_' + k, brownie(k))
add('brownies', 'brownie_stale', stale_brownie())
add('brownies', 'golden_sparkle', golden_sparkle())
for k in ['pillow', 'coffee', 'oven', 'broom', 'sign', 'paint', 'case', 'table', 'recipe', 'clock', 'sun', 'moon',
          'mitts', 'rollingpin', 'spatula', 'espresso', 'fancymug', 'coffeepot', 'whisk', 'shoes', 'trays', 'smile',
          'register', 'fire', 'pans', 'magicflame', 'bike', 'basket', 'ebike',
          'display', 'samples', 'flyer', 'news', 'line', 'tipjar', 'rush', 'party', 'tv',
          'truck', 'bigtruck', 'music', 'oil', 'turbo', 'billboard', 'blogger', 'fanclub', 'neon', 'floor',
          'fountain', 'frame', 'backroom', 'upstairs', 'factory', 'muffin', 'crown']:
    add('icons', 'icon_' + k, icon(k))
for k in ['coin', 'star', 'star_half', 'star_empty', 'heart']:
    add('ui', k, icon(k))
add('props', 'oven', oven())
add('props', 'counter', counter())
add('props', 'door', door())
add('props', 'window', window_())
add('props', 'lamp_on', lamp(True))
add('props', 'lamp_off', lamp(False))
add('props', 'grandma_portrait', portrait())
add('props', 'chalkboard', chalkboard())

if __name__ == '__main__':
    base = os.path.join(OUT, 'brownie-baker-art')
    meta = []
    for group, name, im in CHAR:
        d1 = os.path.join(base, group)
        d4 = os.path.join(base, '_4x', group)
        os.makedirs(d1, exist_ok=True); os.makedirs(d4, exist_ok=True)
        im.save(os.path.join(d1, name + '.png'))
        im.resize((im.width * 4, im.height * 4), Image.NEAREST).save(os.path.join(d4, name + '.png'))
        meta.append({'group': group, 'name': name, 'file': group + '/' + name + '.png', 'w': im.width, 'h': im.height})
    # one packed sprite sheet + atlas for the game
    pad = 2
    rowW = 512
    x = y = rowH = 0
    placed = []
    for m, (_, _, im) in zip(meta, CHAR):
        if x + im.width + pad > rowW:
            x = 0; y += rowH + pad; rowH = 0
        placed.append((m, im, x, y))
        x += im.width + pad; rowH = max(rowH, im.height)
    sheet = Image.new('RGBA', (rowW, y + rowH), (0, 0, 0, 0))
    atlas = {}
    for m, im, xx, yy in placed:
        sheet.paste(im, (xx, yy), im)
        atlas[m['name']] = {'x': xx, 'y': yy, 'w': im.width, 'h': im.height, 'group': m['group']}
    sheet.save(os.path.join(base, 'spritesheet.png'))
    with open(os.path.join(base, 'spritesheet.json'), 'w') as f:
        json.dump({'image': 'spritesheet.png', 'scale': 1, 'frames': atlas, 'animations': {
            'baker_walk': ['baker_walk1', 'baker_walk2'], 'dave_walk': ['dave_walk1', 'dave_walk2'], 'fudge_walk': ['fudge_walk1', 'fudge_walk2'],
            **{n + '_walk': [n + '_walk1', n + '_walk2'] for n, _ in CUST}}}, f, indent=1)
    with open(os.path.join(OUT, 'meta.json'), 'w') as f:
        json.dump(meta, f)
    print(len(meta), 'sprites; sheet', sheet.size)
