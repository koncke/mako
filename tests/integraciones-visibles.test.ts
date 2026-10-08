// =============================================================================
// Quién ve qué integración — la regla que decidió mal dos veces seguidas
// =============================================================================
// 1º: metí GitHub en el catálogo del cliente. Le habría aparecido a Mauricio un campo
//     para el token del repo de la agencia. Su capa es `completo`, y ahí
//     `categoriasIntegraciones` es null — o sea, TODAS.
// 2º: lo marqué `soloPlataforma` pero filtré por capa PRIMERO. GitHub está en la
//     categoría 'Desarrollo' y la capa del super-admin solo lista Inteligencia, IA
//     Generativa, Agentes, Reuniones y Datos: quedó invisible para TODO el mundo.
//     El dueño lo vio: «aún no veo el github en integraciones de super admin».
//
// Y hay un tercer antecedente en el propio repo: lib/credenciales.ts cuenta que
// GOOGLE_CLIENT_ID/SECRET quedaron como filas zombie «cuando Google figuraba como si
// fuera una credencial de cliente».
//
// Tres veces la misma confusión. Por eso esto tiene test.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { defsVisibles, DEFS_TEST } from '../lib/integraciones-catalogo';
import { CAPAS } from '../lib/capas';

const CAPA_SUPERADMIN = ['Inteligencia', 'IA Generativa', 'Agentes', 'Reuniones', 'Datos'];
const ve = (defs: ReturnType<typeof f>, key: string) => defs.some((d) => d.key === key);
const f = (o: { cats: string[] | null; ocultas?: string[]; esSuper: boolean }) =>
  defsVisibles(DEFS_TEST, { cats: o.cats, ocultas: new Set(o.ocultas ?? []), esSuper: o.esSuper });

test('ERROR 1: un cliente NUNCA ve una credencial de la plataforma', () => {
  // Mauricio: capa `completo` → cats null → ve todas las categorías del negocio.
  const suyas = f({ cats: null, esSuper: false });
  assert.equal(ve(suyas, 'github'), false, 'GitHub NO puede aparecerle a un cliente');
  assert.equal(ve(suyas, 'meta'), true, '…pero sí las suyas');
  assert.equal(ve(suyas, 'fathom'), true);
});

test('ERROR 2: el super-admin SÍ la ve, aunque su capa no liste esa categoría', () => {
  const suyas = f({ cats: CAPA_SUPERADMIN, esSuper: true });
  assert.equal(ve(suyas, 'github'), true, 'la capa NO puede tirar una credencial de plataforma');
  // Y su capa sigue mandando sobre lo que SÍ es del negocio.
  assert.equal(ve(suyas, 'meta'), false, 'Publicidad no está en su capa');
  assert.equal(ve(suyas, 'anthropic'), true, 'Inteligencia sí');
});

test('las ocultas de la capa se respetan igual', () => {
  const suyas = f({ cats: CAPA_SUPERADMIN, ocultas: ['youtube', 'calendly', 'google'], esSuper: true });
  assert.equal(ve(suyas, 'youtube'), false);
  assert.equal(ve(suyas, 'calendly'), false);
  assert.equal(ve(suyas, 'panda'), true, 'Datos sin ocultar sigue visible');
});

test('una credencial de plataforma oculta a mano también desaparece', () => {
  const suyas = f({ cats: null, ocultas: ['github'], esSuper: true });
  assert.equal(ve(suyas, 'github'), false);
});

test('no se duplica ninguna: plataforma y negocio son conjuntos disjuntos', () => {
  const suyas = f({ cats: null, esSuper: true });
  const keys = suyas.map((d) => d.key);
  assert.equal(keys.length, new Set(keys).size, 'hay una integración repetida');
  // ⚠️ Menos las OCULTAS, que no son una preferencia del workspace sino una
  // propiedad de la integración: ni el super-admin puede hacerlas aparecer.
  assert.equal(keys.length, DEFS_TEST.filter((d) => !d.oculto).length, 'el super-admin sin filtro de capa las ve todas menos las ocultas');
});

test('el catálogo declara al menos una de plataforma, y GitHub es una', () => {
  const plataforma = DEFS_TEST.filter((d) => d.soloPlataforma).map((d) => d.key);
  assert.ok(plataforma.includes('github'), 'GitHub tiene que estar marcada soloPlataforma');
});

// =============================================================================
// ERROR 3 (24/08/2026): la regla estaba bien y QUIEN LA LLAMA contestaba otra cosa
// =============================================================================
// Los dos tests de arriba prueban `defsVisibles` con `esSuper` ya calculado, así que
// pasaban en verde mientras la fuga estaba viva: el bug no estaba en la regla, estaba
// en cómo se llenaba ese booleano.
//
// `lib/integraciones.ts` hacía `esSuper = !!(await getSesionAdmin())`, que contesta
// **«¿quien mira es admin?»** — y el super admin SIGUE siendo admin cuando entra al
// workspace de un cliente con `?ws=N`. Medido pidiendo el HTML servido:
//
//     ws=13 (Código Inmobiliario) → «GitHub» ×12, `svc-github`, GITHUB_TOKEN ×2
//     ws=1  (Mauricio)            → lo mismo
//
// La pregunta correcta es por el WORKSPACE: `wsActual === await wsSuperAdmin()`. Es el
// mismo error que AGENTS.md ya tiene escrito —«OWNER_WS no es la plataforma»— en su
// otra mitad: tampoco alcanza con «el que mira es admin».
//
// Estos tests miran el FUENTE porque `getIntegraciones()` es `server-only` y arrastra
// media app: lo que hay que cuidar es de dónde sale el booleano, y eso se lee.
const FUENTE = () =>
  readFileSync(new URL('../lib/integraciones.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('ERROR 3: `esSuper` se deriva del WORKSPACE, no de la sesión', () => {
  const s = FUENTE();
  assert.ok(
    /const esSuper = [^\n]*wsSuperAdmin\(\)/.test(s),
    'esSuper tiene que comparar el workspace actual contra wsSuperAdmin()',
  );
  assert.ok(
    !/const esSuper = [^\n]*getSesionAdmin/.test(s),
    'getSesionAdmin() contesta «¿el usuario es admin?», y el super admin lo sigue siendo ' +
    'dentro del workspace de un cliente: por ahí se filtró GitHub a dos clientes',
  );
  // Fail-closed: sin workspace resuelto, no se muestra. Esconder de más es un renglón
  // que falta; mostrar de más es la credencial de la plataforma en el panel de un cliente.
  assert.ok(
    /wsActual != null && wsActual ===/.test(s),
    'sin workspace resuelto tiene que dar false, no colarse por un null',
  );
});

test('ERROR 3 bis: y NO se confunde la plataforma con OWNER_WS', () => {
  // OWNER_WS (=1) es un CLIENTE —Mauricio—, no la plataforma. Está documentado en
  // AGENTS.md y ya mordió antes. Si alguien "arregla" esto comparando contra OWNER_WS,
  // GitHub vuelve a aparecer justo en el workspace donde apareció la primera vez.
  const s = FUENTE();
  assert.ok(
    !/const esSuper = [^\n]*OWNER_WS/.test(s),
    'OWNER_WS es un cliente, no la plataforma: comparar contra él reabre la fuga',
  );
});

// =============================================================================
// El super-admin ve TODAS las integraciones (08/10/2026)
// =============================================================================
// Su capa escondía Publicidad, Mensajería y las de agenda («no corre anuncios»). Dejó de
// ser cierto: MaKo pauta con su propia cuenta de Meta, y el botón «Conectar con Meta» de la
// app propia se prueba en su workspace — probarlo adentro de un cliente le pisaría su
// conexión. Sin la tarjeta de Meta no había dónde apretarlo. Lo pidió Martín: «vuélvelas a
// poner todo». Este test lee la capa DE VERDAD (no una lista copiada, como los de arriba).
//
// Verificado rompiéndolo: volver a poner la lista de categorías vieja → 1 fallo.
test('la capa SuperAdmin muestra Meta y las que antes escondía', () => {
  const cap = CAPAS.superadmin;
  const suyas = f({ cats: cap.categoriasIntegraciones, ocultas: cap.integracionesOcultas ?? [], esSuper: true });
  for (const key of ['meta', 'calendly', 'google', 'youtube', 'github']) {
    assert.equal(ve(suyas, key), true, `el super-admin no ve «${key}»`);
  }
});
