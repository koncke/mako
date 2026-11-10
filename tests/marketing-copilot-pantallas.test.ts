// =============================================================================
// Marketing CoPilot — cómo se cablean las pantallas (6/11/2026)
// =============================================================================
// Lo que no se puede probar sin un navegador y sin base se fija leyendo el código: quién ve la primera entrada, quién ve Campañas, y qué
// muestran los Ajustes. Lo de verdad (a 1440 y a 390) está en las capturas de docs/marketing-copilot/ (banco: scripts/banco-copilot/).
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('la primera entrada: quien nunca operó el Media Buyer o tiene la cuenta vacía, igual en la computadora y el teléfono', () => {
  for (const f of ['app/ads-manager/page.tsx', 'app/m/ads/page.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /const nuncaOpero = !guardada\.encendido && !guardada\.ultimaCorrida && dec\.decisiones\.length === 0/, `${f}: la condición cambió`);
    assert.match(src, /const cuentaVacia = guardada\.ultimaCorridaInfo\?\.campanas === 0/, `${f}: una cuenta vacía ve la primera entrada`);
    assert.match(src, /!copilotoListo\(perfil\) && \(nuncaOpero \|\| cuentaVacia\)/, `${f}: la condición cambió`);
    assert.match(src, /<PrimeraEntrada /, f);
    assert.match(src, /conCampanas\(elegido\.id, perfil\.presupuestoMes\)/, `${f}: un funnel sin anuncios no ve Campañas`);
    // La computadora, en dos columnas (MaKo y el panel del funnel, 9/11/2026); el teléfono, con su hoja de MaKo.
    assert.match(src, f === 'app/ads-manager/page.tsx' ? /<EstrategiaCopiloto perfil=\{perfil\} \/>/ : /<SinAnuncios perfil=\{perfil\} \/>/, f);
  }
  // Las dos pantallas del CoPilot en la computadora dibujan el panel del funnel, y la charla lo deja usar (datos, otro funnel, usar).
  const pe = sinComentarios(leer('app/ads-manager/PrimeraEntrada.tsx'));
  assert.match(pe, /<PanelDelFunnel perfil=\{p\} modo="charla"[^>]*onPreguntar=\{preguntarDato\} onFunnel=\{cambiarFunnel\} onUsar=\{usarElFunnel\}/);
  assert.match(sinComentarios(leer('app/ads-manager/PlanDelCopiloto.tsx')), /<PanelDelFunnel perfil=\{perfil\} modo="listo" \/>/);
  // Un DATO se guarda sin mover la charla: por `ir` (el camino de «Volver») escondía la pregunta y lo hablado en el paso (9/11/2026).
  const fijar = pe.slice(pe.indexOf('const fijarDato'), pe.indexOf('const cambiarFunnel'));
  assert.ok(fijar.includes('setP(sig)') && !/\bir\(/.test(fijar), 'fijarDato no pasa por ir');
  // Lo ESCRITO se confirma antes de guardarse (AGENTS.md, «la red es que la persona CONFIRME»); una pastilla ya es el toque.
  assert.match(pe, /Entendí: \$\{valor\}\. ¿Lo anoto\?/);
  // Y al cambiar de funnel el acuse va DESPUÉS del cambio, en el paso nuevo (antes, `ir` lo escondía).
  const cambiar = pe.slice(pe.indexOf('const cambiarFunnel'), pe.indexOf('const usarElFunnel'));
  assert.ok(cambiar.indexOf('ir(sig)') < cambiar.indexOf('nota({ paso: pasoNuevo'), 'el acuse va después de ir');
  assert.match(leer('app/ads-manager/page.tsx'), /sp\.estrategia === '1'/, '«Cambiar mi estrategia» reabre la charla');
  // En el teléfono también (6/11/2026): el link es el mismo (/ads-manager?estrategia=1) y el desvío lo deja viajar.
  const m = sinComentarios(leer('app/m/ads/page.tsx'));
  assert.match(m, /=== '1';/, 'el teléfono lee ?estrategia=1');
  assert.match(m, /if \(reabrir \|\| \(!copilotoListo\(perfil\)/, 'y con él reabre la charla');
});

test('el teléfono le habla al CoPilot, no al chat general: «Pídele algo a MaKo» y «Pregúntale» abren su hoja', () => {
  const src = sinComentarios(leer('app/m/ads/MediaBuyerM.tsx'));
  assert.doesNotMatch(src, /\/m\/mako/, 'el chat general no lleva el desde del CoPilot');
  assert.match(src, /className="aa-orden-m" onClick=\{\(\) => setCopiloto\(/);
  assert.match(src, /onPreguntar=\{\(\) => \{ setAbierta\(null\); setCopiloto\(\{ pedido:/);
  assert.match(src, /<HojaDelCopiloto /);
  const h = sinComentarios(leer('app/m/ads/HojaDelCopiloto.tsx'));
  assert.match(h, /useChatCliente\(\{[^}]*entrarAlCerebro: true[^}]*desde \}\)/, 'la conversación es el Cerebro, como la estrella');
  assert.match(h, /desdeDelCopiloto\(pantalla\)/);
  // Y el Plan en el teléfono con anuncios: la tarjeta de la computadora.
  assert.match(src, /seccionesDelTelefono\(perfil\)/);
  assert.match(src, /<SeccionPlan perfil=\{perfil\} \/>/);
  assert.match(sinComentarios(leer('app/m/ads/page.tsx')), /perfil=\{perfil\} \/>/, 'la página le pasa el perfil');
});

test('al terminar la charla se sale del ?estrategia=1 (si no, la página la mostraría otra vez)', () => {
  const src = sinComentarios(leer('app/ads-manager/PrimeraEntrada.tsx'));
  const sale = src.indexOf('router.replace(window.location.pathname)');
  assert.ok(sale > 0 && sale < src.indexOf('router.refresh()'), 'router.replace antes de router.refresh');
});

test('Campañas: tres columnas por estado y el producto es un filtro; el objetivo recomendado también cuenta', () => {
  const l = sinComentarios(leer('app/ads-manager/Lienzo.tsx'));
  assert.match(l, /<select id="aa-producto"/);
  assert.match(l, /opciones\.length > 0/, 'con un solo producto no se dibuja el desplegable');
  assert.match(l, /COLUMNAS\.map\(/);
  const m = sinComentarios(leer('app/ads-manager/MediaBuyer.tsx'));
  assert.match(m, /objetivo=\{config\.objetivo \?\? objetivoRecomendado\(config\.ultimaCorridaInfo\)\}/);
  assert.match(m, /perfil && funnelElegido\(perfil\) \? VISTAS_CON_PLAN : VISTAS_DE_SIEMPRE/, 'sin funnel elegido, lo de siempre');
});

test('Ajustes: «Tu estrategia» arriba; sin anuncios no se ve nada de la cuenta de Meta; las metas viven con el objetivo', () => {
  const a = sinComentarios(leer('app/ads-manager/Ajustes.tsx'));
  assert.ok(a.indexOf('titulo="Tu estrategia"') < a.indexOf('titulo="Media Buyer"'));
  assert.match(a, /\{!sinCampanas && <>/);
  assert.match(a, /titulo="Objetivo y metas"/);
  assert.doesNotMatch(a, /titulo="Metas del mes"/, 'las metas ya no son un grupo aparte');
  for (const g of ['Topes', 'Dónde y hasta cuándo', 'Cuenta de Meta']) {
    assert.ok(a.indexOf(`titulo="${g}"`) > a.indexOf('{!sinCampanas && <>'), `«${g}» va dentro de lo que se esconde sin anuncios`);
  }
  assert.match(sinComentarios(leer('app/ads-manager/ajustes/page.tsx')), /perfil=\{copilotoListo\(perfil\) \? perfil : null\}/);
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. sacar `router.replace(...)` de PrimeraEntrada                  → rojo «se sale del ?estrategia=1».
//   2. `{!sinCampanas && <>` → `{true && <>` en Ajustes               → rojo «Ajustes».
//   3. el desplegable siempre dibujado (sin `opciones.length > 0`)    → rojo «Campañas».
