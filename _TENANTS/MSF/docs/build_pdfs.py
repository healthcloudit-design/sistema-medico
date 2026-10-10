"""Genera los PDFs del tenant San Fernando a partir de las fuentes HTML.
Uso: python3 build_pdfs.py ["Destinatario"] [carpeta_de_shots]"""
import base64, io, sys, os
from PIL import Image
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, '..', 'tests', 'shots')
DEST = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else 'Sr. Secretario de Salud, Marcelo Campos'
def b64(path, mime): return f"data:{mime};base64," + base64.b64encode(open(path, 'rb').read()).decode()
def shot(name, h=860):
    im = Image.open(os.path.join(SHOTS, name)).convert('RGB'); im = im.crop((240, 0, 1040, min(h, im.height)))
    im = im.resize((560, int(im.height * 560 / 800))); buf = io.BytesIO(); im.save(buf, 'JPEG', quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
logo = b64(os.path.join(HERE, '..', 'IMAGENES', 'logo.png'), 'image/png')
qr = open(os.path.join(HERE, 'qr.svg')).read().split('?>', 1)[-1]
fill = {'{{LOGO}}': logo, '{{QR}}': qr, '{{DEST}}': DEST, '{{FECHA}}': 'Octubre de 2026'}
if os.path.isdir(SHOTS):
    fill.update({'{{SHOT_HOME}}': shot('01_home.png', 560), '{{SHOT_SERV}}': shot('04_servicios.png', 760), '{{SHOT_OK}}': shot('09_confirmacion.png', 820)})
jobs = [('onepager-fuente.html', 'OnePager - Turnos Salud San Fernando.pdf'),
        ('propuesta-fuente.html', 'Propuesta institucional - Turnos Salud San Fernando.pdf')]
with sync_playwright() as p:
    b = p.chromium.launch()
    for src, out in jobs:
        html = open(os.path.join(HERE, src), encoding='utf-8').read()
        for k, v in fill.items(): html = html.replace(k, v)
        pg = b.new_page()
        pg.route('**/*', lambda r: r.abort() if r.request.url.startswith('http') else r.continue_())
        pg.set_content(html, wait_until='load')
        pg.pdf(path=os.path.join(HERE, out), format='A4', print_background=True, prefer_css_page_size=True)
        print('ok', out)
    b.close()
