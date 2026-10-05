"""Genera la landing autocontenida (escudo embebido). Uso: python3 build_landing.py"""
import base64, os
H = os.path.dirname(os.path.abspath(__file__))
TURNOS = 'https://platform.praxisoperativa.com/agenda/salud-jose-c-paz'
logo = 'data:image/png;base64,' + base64.b64encode(open(os.path.join(H, '..', 'logo-escudo-josecpaz.png'), 'rb').read()).decode()
s = open(os.path.join(H, 'landing-fuente.html'), encoding='utf-8').read().replace('{{LOGO}}', logo).replace('{{TURNOS}}', TURNOS)
assert '{{' not in s
open(os.path.join(H, 'index.html'), 'w', encoding='utf-8').write(s)
print('ok', len(s))
