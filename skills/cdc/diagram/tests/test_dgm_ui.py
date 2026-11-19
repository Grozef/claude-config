"""Diagramme du skill cdc (cdc.sh draw, kind class) : chaine complete, puis interactions du HTML (Playwright).
Navigateur absent ou Playwright absent : tests sautes et signales, jamais comptes verts.
Lancer : python -m pytest ~/.claude/skills/cdc/diagram/tests -q"""
import os
import shutil
import subprocess

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
CDC = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', 'tools', 'cdc.sh'))
FIX = os.path.join(HERE, 'fixtures', 'class.model.json')


def find_chrome():
    """Meme recherche que lib/chrome.mjs ; CDC_CHROME=none : aucun navigateur (tests sautes, comme le build)."""
    if os.environ.get('CDC_CHROME') == 'none':
        return None
    c = [os.environ.get('CDC_CHROME')]
    for d in ('C:/Program Files', 'C:/Program Files (x86)', os.environ.get('LOCALAPPDATA', '')):
        c += [d + '/Google/Chrome/Application/chrome.exe', d + '/Microsoft/Edge/Application/msedge.exe']
    c += ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
          '/Applications/Chromium.app/Contents/MacOS/Chromium']
    c += [shutil.which(n) for n in ('google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge')]
    return next((p for p in c if p and os.path.isfile(p)), None)


@pytest.fixture(scope='session')
def chrome():
    c = find_chrome()
    if not c:
        pytest.skip('ni Chrome, Edge ni Chromium')
    return c


@pytest.fixture(scope='session')
def classes(chrome, tmp_path_factory):
    bash = shutil.which('bash')
    if not bash:
        pytest.skip('bash introuvable')
    d = tmp_path_factory.mktemp('dgm')
    r = subprocess.run([bash, CDC, 'draw', '--model', FIX, '--out', str(d), '--name', 'CLS'],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    return {'dir': d, 'code': r.returncode, 'log': r.stdout + r.stderr}


@pytest.fixture(scope='session')
def browser(chrome):
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        pytest.skip('Playwright pour Python absent')
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=chrome)
        yield b
        b.close()


@pytest.fixture
def ui(browser, classes):
    assert classes['code'] == 0, classes['log'][-800:]
    ctx = browser.new_context(viewport={'width': 1600, 'height': 1000}, accept_downloads=True)
    pg = ctx.new_page()
    pg.errors, pg.requests = [], []
    pg.on('console', lambda m: pg.errors.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: pg.errors.append(str(e)))
    pg.on('request', lambda r: pg.requests.append(r.url))
    pg.goto((classes['dir'] / 'CLS.html').as_uri())
    pg.wait_for_timeout(300)
    yield pg
    assert pg.errors == [], pg.errors  # CSP : un script bloque produirait une erreur console
    ctx.close()


def test_build_vert_et_livrables(classes):
    assert classes['code'] == 0, classes['log'][-1500:]
    assert '-> OK' in classes['log'] and 'debordements mesures dans Chrome : 0 -> OK' in classes['log']
    png = classes['dir'] / 'CLS.png'
    assert png.exists() and png.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n'


def test_vue_initiale_ajustee(ui):
    assert ui.locator('.dgm .node').count() == 8 and ui.locator('.dgm .rel').count() == 9
    assert ui.eval_on_selector('#stage', 'e => e.style.transform').startswith('translate(')


def test_survol_surligne_les_relations(ui):
    ui.locator('.node[data-node="Inspection"]').hover()
    assert ui.locator('main.focus').count() == 1
    assert ui.locator('.rel.on').count() == 6  # Inspection : 6 relations dans le modele
    ui.mouse.move(5, 990)
    assert ui.locator('main.focus').count() == 0


def test_clic_epingle_et_echap(ui):
    ui.locator('.node[data-node="User"]').click()
    ui.mouse.move(5, 990)
    assert ui.locator('.node.on[data-node="User"]').count() == 1
    ui.keyboard.press('Escape')
    assert ui.locator('main.focus').count() == 0


def test_molette_zoom_et_theme(ui):
    t0 = ui.eval_on_selector('#stage', 'e => e.style.transform')
    ui.mouse.move(800, 500)
    ui.mouse.wheel(0, -400)
    ui.wait_for_timeout(100)
    assert ui.eval_on_selector('#stage', 'e => e.style.transform') != t0
    ui.click('#theme')
    assert ui.evaluate('document.documentElement.dataset.theme') in ('dark', 'light')


def test_export_png(ui):
    with ui.expect_download() as dl:
        ui.click('#png')
    assert dl.value.suggested_filename.endswith('.png')


def test_aucune_requete_externe(ui):
    assert all(u.startswith(('file:', 'blob:', 'data:')) for u in ui.requests), ui.requests
