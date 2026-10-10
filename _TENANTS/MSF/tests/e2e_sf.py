"""E2E frontend (Playwright headless, red de Supabase MOCKEADA) — tenant salud-san-fernando.
Flujo: home -> centro -> especialidad con orden -> gate -> sin orden -> cabecera -> fecha/hora -> datos -> confirmación.
Incluye test de foco (tipear char por char en buscador y teléfono sin perder el cursor) y 0 errores de consola.
Uso: SF_DIST_DIR=tests/srv python3 e2e_sf.py
"""
import json, os, re, sys, threading, http.server, socketserver
from urllib.parse import urlparse, parse_qs, unquote
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
SRV = os.environ.get('SF_DIST_DIR', os.path.join(HERE, 'srv'))  # carpeta con /agenda/ = salida de vite build
SHOTS = os.path.join(HERE, 'shots'); os.makedirs(SHOTS, exist_ok=True)
PORT = 4188
ORG_ID = 'c72846ab-d346-465e-9b2b-10c02fb1cd5d'

# ── Servidor estático con fallback SPA bajo /agenda/ ──────────────────────────
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=SRV, **k)
    def log_message(self, *a): pass
    def do_GET(self):
        p = urlparse(self.path).path
        if p.startswith('/agenda') and not os.path.exists(os.path.join(SRV, p.lstrip('/'))) or p.rstrip('/') == '/agenda':
            self.path = '/agenda/index.html'
        return super().do_GET()
socketserver.TCPServer.allow_reuse_address = True
httpd = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=httpd.serve_forever, daemon=True).start()

# ── Fixtures (estructura real del tenant, datos de prueba) ────────────────────
ORG = {"id": ORG_ID, "name": "Salud San Fernando", "slug": "salud-san-fernando", "logo_url": "/agenda/msf_logo.png",
       "phone": "0800 888 5566", "address": "Municipio de San Fernando, Buenos Aires",
       "timezone": "America/Argentina/Buenos_Aires", "active": True, "feature_mp": False, "feature_hc": True,
       "tenant_type": "general", "primary_color": "#3F7D1E", "booking_headline": "Turnos en los Centros de Salud Municipales",
       "booking_weeks": 1, "email": None}
LOCS = [
    {"id": "loc-carcagno", "name": "Centro de Salud 31 Dr. Carcagno", "address": "Entre Ríos y Carlos Casares, San Fernando", "phone": "11 2732 8618"},
    {"id": "loc-villajardin", "name": "Centro de Salud Villa Jardín", "address": "Guatemala 3069, San Fernando", "phone": "11 2732 8590"},
    {"id": "loc-rehab", "name": "Centro de Rehabilitación y Kinesiología", "address": "Besares 2172, San Fernando", "phone": "11 7109 5732"},
]
SVCS = [("Clínica Médica", 20, False), ("Pediatría", 20, False), ("Ginecología", 20, False),
        ("Obstetricia", 20, False), ("Odontología General", 30, False), ("Nutrición", 20, True)]
def svc(i, n, d, o):
    return {"id": f"svc-{i}", "organization_id": ORG_ID, "name": n, "duration_minutes": d, "active": True, "color": "#3F7D1E",
            "capacity": 1, "waitlist_limit": 0, "requiere_atencion_completa": True, "last_start_overrides": None,
            "requiere_orden": o, "block_duration_minutes": None, "resource_group": None, "display_duration_minutes": None, "price": None}
SERVICES = {f"svc-{i}": svc(i, *s) for i, s in enumerate(SVCS)}
PROFS = []
for i, (n, d, o) in enumerate(SVCS):
    for k in (1, 2):
        PROFS.append({"id": f"prof-{i}-{k}", "organization_id": ORG_ID, "location_id": "loc-carcagno", "full_name": f"Consultorio {k} — {n}",
                      "specialty": n, "active": True, "concurrent_capacity": 1,
                      "professional_services": [{"services": SERVICES[f"svc-{i}"]}]})

calls = {"rpc": []}

def first_busy_iso(qs):
    # Turno ocupado a las 08:20 del día consultado (para ver un horario tachado)
    m = re.search(r'gte\.(\d{4}-\d{2}-\d{2})', unquote(qs.get('starts_at', [''])[0]))
    if not m: return []
    day = m.group(1)
    return [{"id": "busy-1", "starts_at": f"{day}T08:20:00-03:00", "ends_at": f"{day}T08:40:00-03:00",
             "service_id": "svc-0", "status": "confirmado", "services": {"requiere_atencion_completa": True, "resource_group": None}}]

def handle(route, request):
    u = urlparse(request.url); qs = parse_qs(u.query)
    single = 'vnd.pgrst.object' in (request.headers.get('accept') or '')
    path = u.path
    def ok(body, status=200):
        route.fulfill(status=status, content_type='application/json', body=json.dumps(body),
                      headers={"access-control-allow-origin": "*", "content-range": "0-0/*"})
    if request.method == 'OPTIONS':
        return route.fulfill(status=200, headers={"access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*"})
    if '/rest/v1/rpc/reservar_turno' in path:
        calls["rpc"].append(json.loads(request.post_data or '{}'))
        return ok({"id": "3f2a9c10-1b2c-4d5e-8f90-0123456789ab", "status": "confirmado"})
    if '/rest/v1/rpc/' in path:
        return ok(None)
    table = path.rsplit('/', 1)[-1]
    if table == 'organizations':
        return ok(ORG if single else [ORG])
    if table == 'locations':
        return ok(LOCS)
    if table == 'professionals':
        if single:
            return ok({"concurrent_capacity": 1})
        loc = qs.get('location_id', ['eq.'])[0].split('.', 1)[1]
        return ok([p for p in PROFS if p["location_id"] == loc])
    if table == 'schedules':
        rows = [{"id": f"s{d}", "professional_id": "x", "day_of_week": d, "start_time": "08:00:00", "end_time": "16:00:00",
                 "active": True, "interval_minutes": 20} for d in range(1, 6)]
        dow = qs.get('day_of_week')
        if dow: rows = [r for r in rows if str(r["day_of_week"]) == dow[0].split('.', 1)[1]]
        return ok(rows)
    if table in ('availability_blocks', 'availability_openings', 'professional_services'):
        return ok([])
    if table == 'appointments':
        return ok(first_busy_iso(qs))
    if table == 'services':
        sid = qs.get('id', ['eq.'])[0].split('.', 1)[1]
        s = SERVICES.get(sid, list(SERVICES.values())[0])
        return ok(s if single else [s])
    return ok([] if not single else {})

errors = []
def shot(page, name): page.screenshot(path=os.path.join(SHOTS, name), full_page=True)

def type_keep_focus(page, selector, text, label):
    el = page.locator(selector)
    el.click()
    for ch in text:
        page.keyboard.type(ch)
        same = page.evaluate("(sel) => document.activeElement === document.querySelector(sel)", selector)
        if not same:
            raise AssertionError(f"FOCO PERDIDO en {label} al tipear '{ch}'")
    val = el.input_value()
    assert val == text, f"{label}: valor '{val}' != '{text}'"
    print(f"  ✓ foco OK en {label} ({len(text)} chars, valor intacto)")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale='es-AR', timezone_id='America/Argentina/Buenos_Aires')
    page = ctx.new_page()
    page.on('console', lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append(f"pageerror: {e}"))
    page.route(re.compile(r'https://xuwkxelrcglstvisbcnk\.supabase\.co/.*'), handle)
    # Google Fonts: el sandbox no tiene salida; se mockea con CSS vacío (red 100% mockeada)
    ctx.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r, q: r.fulfill(status=200, content_type='text/css', body=''))

    page.goto(f'http://127.0.0.1:{PORT}/agenda/salud-san-fernando', wait_until='networkidle')
    page.get_by_text('Sacá tu turno en tu Centro de Salud').wait_for()
    assert page.get_by_text('Municipio de San Fernando · Secretaría de Salud Pública').is_visible()
    # color de acento aplicado al botón principal
    bg = page.get_by_role('button', name=re.compile('Pedir un turno')).evaluate("e => getComputedStyle(e).backgroundColor")
    assert bg == 'rgb(63, 125, 30)', f"acento inesperado: {bg}"
    print("  ✓ home con tema San Fernando (#3F7D1E)")
    shot(page, '01_home.png')

    page.get_by_role('button', name=re.compile('Pedir un turno')).click()
    page.get_by_text('Elegí tu Centro de Salud').wait_for()
    shot(page, '02_centros.png')
    type_keep_focus(page, 'input[placeholder^="Buscar por nombre"]', 'carcagno', 'buscador de centros')
    page.wait_for_timeout(200)
    shot(page, '03_busqueda.png')
    page.get_by_role('button', name=re.compile('Dr. Carcagno')).click()

    page.get_by_text('Atención primaria — acceso directo').wait_for()
    assert page.get_by_text('Requiere orden médica').count() >= 1
    print("  ✓ servicios del centro (primaria directa + Nutrición con orden)")
    shot(page, '04_servicios.png')
    page.get_by_role('button', name=re.compile('Nutrición')).click()

    page.get_by_text('¿Tenés la orden de tu médico de cabecera').wait_for()
    shot(page, '05_gate_orden.png')
    page.get_by_role('button', name=re.compile('No tengo la orden')).click()

    page.get_by_text('Para este turno necesitás una orden').wait_for()
    shot(page, '06_sin_orden.png')
    page.get_by_role('button', name='Sacar turno con mi médico de cabecera').click()

    page.get_by_text('Elegí día y horario').wait_for()
    assert page.get_by_text('Clínica Médica').first.is_visible()
    page.locator('button:has-text(":")').first.wait_for()
    # Si el primer día es hoy y ya pasaron todos los horarios, pasar al siguiente día hábil
    day_btns = page.locator('button.min-w-\\[62px\\]')
    for i in range(day_btns.count()):
        if i > 0:
            day_btns.nth(i).click(); page.wait_for_timeout(400)
        page.locator('button:has-text("08:00")').wait_for()
        if page.locator('button:has-text("09:00")').is_enabled():
            break
    # 08:20 debe verse tachado (ocupado)
    busy = page.locator('button:has-text("08:20")')
    assert busy.is_disabled(), "08:20 debería estar ocupado"
    print("  ✓ disponibilidad: 08:20 ocupado (tachado), 09:00 libre")
    page.locator('button:has-text("09:00")').click()
    shot(page, '07_fecha_hora.png')
    page.get_by_role('button', name=re.compile('Continuar')).click()

    page.get_by_text('Completá tus datos').wait_for()
    page.locator('input[placeholder="Ej: María González"]').fill('Vecino de Prueba')
    page.locator('input[placeholder="Sin puntos"]').fill('30123456')
    type_keep_focus(page, 'input[type="tel"]', '11 5555 1234', 'teléfono')
    shot(page, '08_datos.png')
    page.get_by_role('button', name='Confirmar turno').click()

    page.get_by_text('¡Tu turno está confirmado!').wait_for()
    code = page.locator('text=/SF-\\d{5}/').first.inner_text()
    print(f"  ✓ confirmación con código {code}")
    shot(page, '09_confirmacion.png')

    assert len(calls["rpc"]) == 1, calls
    r = calls["rpc"][0]
    assert r["p_professional_id"].startswith('prof-0-') and r["p_service_id"] == 'svc-0', r
    assert r["p_patient_dni"] == '30123456' and r["p_patient_phone"] == '11 5555 1234', r
    print(f"  ✓ RPC reservar_turno llamada con médico de cabecera (Clínica Médica) a las {r['p_starts_at']}")

    # Deep link desde la landing: ?centro=<clave> abre directo ese centro (sin home ni listado)
    dl = ctx.new_page()
    dl.on('pageerror', lambda e: errors.append(f"pageerror(deeplink): {e}"))
    dl.on('console', lambda m: errors.append(f"console.error(deeplink): {m.text}") if m.type == 'error' else None)
    dl.route(re.compile(r'https://xuwkxelrcglstvisbcnk\.supabase\.co/.*'), handle)
    dl.goto(f'http://127.0.0.1:{PORT}/agenda/salud-san-fernando?centro=centro-de-salud-31-dr-carcagno', wait_until='networkidle')
    dl.get_by_text('Atención primaria — acceso directo').wait_for()
    assert dl.locator('h1', has_text='Dr. Carcagno').is_visible()
    assert dl.get_by_text('Sacá tu turno en tu Centro de Salud').count() == 0, "no debería pasar por la home"
    dl.screenshot(path=os.path.join(SHOTS, '11_deeplink_centro.png'), full_page=True)
    print("  ✓ deep link ?centro=centro-de-salud-31-dr-carcagno abre directo las atenciones de Carcagno")
    dl.get_by_role('button', name=re.compile('Cambiar de centro')).click()
    dl.get_by_text('Elegí tu Centro de Salud').wait_for()
    print("  ✓ 'Cambiar de centro' vuelve al listado")
    dl.goto(f'http://127.0.0.1:{PORT}/agenda/salud-san-fernando?centro=no-existe', wait_until='networkidle')
    dl.get_by_text('Elegí tu Centro de Salud').wait_for()
    print("  ✓ clave inexistente cae en el listado de centros (fallback)")
    dl.close()

    # Mobile: misma home en 375px, sin scroll horizontal
    m = b.new_context(viewport={"width": 375, "height": 812}, is_mobile=True)
    m.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r, q: r.fulfill(status=200, content_type='text/css', body=''))
    mp = m.new_page(); mp.route(re.compile(r'https://xuwkxelrcglstvisbcnk\.supabase\.co/.*'), handle)
    mp.on('console', lambda x: errors.append(f"console.error(mobile): {x.text}") if x.type == 'error' else None)
    mp.on('pageerror', lambda e: errors.append(f"pageerror(mobile): {e}"))
    mp.goto(f'http://127.0.0.1:{PORT}/agenda/salud-san-fernando', wait_until='networkidle')
    mp.get_by_text('Sacá tu turno').wait_for()
    sw = mp.evaluate("document.documentElement.scrollWidth"); assert sw <= 375, f"scroll horizontal: {sw}"
    mp.screenshot(path=os.path.join(SHOTS, '10_mobile_home.png'), full_page=True)
    print("  ✓ mobile 375px sin scroll horizontal")
    b.close()

httpd.shutdown()
print("Errores de consola:", len(errors))
for e in errors: print("  ", e)
sys.exit(1 if errors else 0)
