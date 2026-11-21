// =============================================================================
// LA REVISIÓN: IR A CUALQUIER PASO Y RESPUESTAS DE EJEMPLO, COMO EN EL ARTEFACTO (20/11/2026)
// =============================================================================
// Martín, probando en producción: «viste que hay un desplegable en el artefacto que me deja ir avanzando o retrocediendo. Si no, cada vez
// que quiero ver algo que ya pasó, tengo que resetear todo». Y las respuestas de ejemplo de la maqueta, un toque y avanza. Lo decidido
// por el Cerebro: sólo en la revisión (los negocios de prueba, el 3 y el 9; nunca el 11 de Leila ni un cliente) y sólo con alguien de
// MaKo; con el estado REAL (no una maqueta), dejándolo como si se hubiera llegado ahí. Nunca le puede aparecer a un cliente.
//   · lib/onboarding-v2/saltar.ts (puro): los pasos, la puerta, el estado de cada paso y las respuestas de ejemplo (las del escenario A
//     de la maqueta, C:/dev/artefactos-onboarding/cuerpo.html).
//   · lib/onboarding-v2/saltar-server.ts: «Reiniciar onboarding» (lib/reiniciar-onboarding-server.ts, ya probado) y el estado del paso.
//   · /api/admin/saltar-onboarding: la puerta del lado del server; el negocio lo dice el server, nunca el pedido.
//   · el desplegable en la barra del administrador (SaltarAPaso.tsx) y los ejemplos en ChatArranqueV2, sólo si el server dice que sí.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EJEMPLOS_DE_REVISION, PASOS_DE_REVISION, clavesVistasDelReto, ejemploDe, esPasoDeRevision, estadoArranqueHasta, estadoRetoEnDia, puedeVerLaRevision,
} from '../lib/onboarding-v2/saltar';
import { INTERESES_V2, ORIGENES, etapaDeArranqueV2, type HechosArranque } from '../lib/onboarding-arranque';
import { diaAbierto } from '../lib/reto/dias';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const HECHOS = { modo: 'oferta', v2: true, conTelefono: true, terminado: false, nombreCuenta: 'Martín', nombreWorkspace: 'Laland' } as unknown as HechosArranque;

test('1. la puerta: SÓLO alguien de MaKo y SÓLO en los negocios de prueba (3 y 9); nunca Leila (11), un cliente o el dueño', () => {
  assert.equal(puedeVerLaRevision({ ws: 3, admin: true }), true);
  assert.equal(puedeVerLaRevision({ ws: 9, admin: true }), true);
  assert.equal(puedeVerLaRevision({ ws: 11, admin: true }), false, 'Leila es una clienta de verdad');
  assert.equal(puedeVerLaRevision({ ws: 21, admin: true }), false, 'un cliente');
  assert.equal(puedeVerLaRevision({ ws: 1, admin: true }), false, 'el negocio del dueño');
  assert.equal(puedeVerLaRevision({ ws: 3, admin: false }), false, 'el cliente mismo, en el negocio de prueba');
  assert.equal(puedeVerLaRevision({ ws: null, admin: true }), false);
});

test('2. cada paso del onboarding deja el estado REAL en ese paso (lo mira la máquina de verdad, etapaDeArranqueV2)', () => {
  for (const p of ['nombre', 'telefono', 'agendado', 'negocio', 'origen', 'interes', 'cierre'] as const) {
    const e = estadoArranqueHasta(p, { telefonoNumero: '5491155550101' });
    assert.equal(etapaDeArranqueV2(e, HECHOS), p, `«${p}» quedó en otra etapa`);
    assert.equal(e.introVista, true, `${p}: la animación del principio no se repite`);
  }
  // Las respuestas de antes, las de ejemplo de la maqueta (escenario A), y válidas para sus preguntas.
  const cierre = estadoArranqueHasta('cierre', { telefonoNumero: '5491155550101' });
  assert.equal(cierre.nombre, EJEMPLOS_DE_REVISION.nombre);
  assert.equal(cierre.negocio, EJEMPLOS_DE_REVISION.negocio);
  assert.ok((ORIGENES as readonly string[]).includes(cierre.origen ?? ''), 'el origen, una opción de verdad');
  assert.ok(cierre.intereses?.length && cierre.intereses.every((x) => INTERESES_V2.some((o) => o.label === x)), 'los intereses, opciones de verdad');
  // El WhatsApp de antes: el verificado del negocio (sin código nuevo).
  assert.equal(cierre.telefono, 'verificado');
  assert.equal(cierre.telefonoYa, true);
  assert.equal(cierre.telefonoNumero, '5491155550101');
});

test('3. cada día del reto queda ABIERTO en ese día (lo mira diaAbierto, el de verdad), con lo de antes hecho; «¿Qué hacemos ahora?» antes del día 1', () => {
  const ahora = Date.parse('2026-11-20T23:00:00Z');
  for (let n = 1; n <= 7; n++) {
    const e = estadoRetoEnDia(n, ahora);
    assert.equal(diaAbierto(e, ahora), n, `el día ${n} no quedó abierto`);
    assert.ok(e.dia1Desde, `día ${n}: sin «Empezar mi día 1»`);
    // Las tareas de los días de antes, con «Lo hago después»: el día termina igual (R57-F1).
    for (const k of e.despues ?? []) assert.ok(Number(k.split(':')[0]) < n, `día ${n}: una tarea de hoy o de después ya estaba «después»`);
    if (n > 1) assert.ok((e.despues ?? []).some((k) => k.startsWith('1:')), `día ${n}: las del día 1 no quedaron hechas`);
  }
  const antes = estadoRetoEnDia(0, ahora);
  assert.equal(antes.dia1Desde, undefined, '«¿Qué hacemos ahora?» es antes de elegir el día 1');
  assert.equal(diaAbierto(antes, ahora), 1);
  // Lo visto en el navegador, del reto NUEVO (su `inicio`): los videos de los días de antes, no el de hoy.
  const e = estadoRetoEnDia(4, ahora);
  assert.deepEqual(clavesVistasDelReto(e.inicio, 4), [1, 2, 3].flatMap((d) => [`mako.reto.visto.${e.inicio}|video:${d}`, `mako.reto.visto.${e.inicio}|entrada:${d}`]));
});

test('4. los pasos, en su orden (onboarding, llegada, reto); y la respuesta de ejemplo de cada pregunta que se escribe', () => {
  assert.deepEqual(PASOS_DE_REVISION.map((p) => p.id), ['nombre', 'telefono', 'agendado', 'negocio', 'origen', 'interes', 'cierre', 'llegada', 'reto', 'dia-1', 'dia-2', 'dia-3', 'dia-4', 'dia-5', 'dia-6', 'dia-7']);
  assert.equal(esPasoDeRevision('dia-3'), true);
  assert.equal(esPasoDeRevision('dia-8'), false);
  assert.equal(esPasoDeRevision('__proto__'), false);
  assert.equal(ejemploDe('nombre'), EJEMPLOS_DE_REVISION.nombre);
  assert.equal(ejemploDe('negocio'), EJEMPLOS_DE_REVISION.negocio);
  assert.equal(ejemploDe('origen'), null, 'una pregunta con opciones ya se contesta con un toque');
});

test('5. nunca a un cliente: la ruta cierra del lado del server, y la pantalla dibuja el desplegable y los ejemplos sólo si el server dice que sí', () => {
  const r = sinComentarios(fuente('app/api/admin/saltar-onboarding/route.ts'));
  // El negocio lo dice el server (getWorkspaceActual), nunca el cuerpo del pedido; la puerta, en GET y en POST.
  assert.match(r, /const admin = !!\(await getSesionAdmin\(\)\);\n\s*const ws = await getWorkspaceActual\(\);\n\s*if \(!puedeVerLaRevision\(\{ ws, admin \}\)\) return NextResponse\.json\(\{ ok: false, puede: false \}, \{ status: 403 \}\);/);
  assert.equal((r.match(/if \(!puedeVerLaRevision\(\{ ws, admin \}\)\) return/g) ?? []).length, 2, 'la puerta en GET y en POST');
  assert.doesNotMatch(r, /body\.ws|body\.workspace/, 'el negocio no sale del pedido');
  assert.match(r, /if \(!esPasoDeRevision\(body\.paso\)\) return/);
  // El desplegable pregunta al server y no se dibuja sin su sí.
  const s = sinComentarios(fuente('app/_components/SaltarAPaso.tsx'));
  assert.match(s, /if \(!puede\) return null;/);
  assert.match(fuente('app/_components/ImpersonationBanner.tsx'), /<SaltarAPaso \/>/);
  // Los ejemplos: la página los pasa SÓLO con la puerta abierta; el chat sin ellos no dibuja nada.
  const p = sinComentarios(fuente('app/onboarding/page.tsx'));
  assert.match(p, /const adminDeMaKo = !!\(await getSesionAdmin\(\)\.catch\(\(\) => null\)\);/);
  assert.match(p, /<ChatArranqueV2 [^>]*ejemplos=\{puedeVerLaRevision\(\{ ws, admin: adminDeMaKo \}\)\} \/>/);
  // 21/11/2026 (Martín): los ejemplos ya no van adentro del chat sino en «Autocompletar», en la barra; el chat lo ofrece sólo con la puerta.
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(c, /if \(!ejemplos\) return;\n[\s\S]{0,400}ponerAutocompletar\(/);
});

// ⚠️ PROBADO ROMPIÉNDOLO (20/11/2026, base 5/0; al restaurar, 5/0). Cada rotura, de a una, cae:
//   - la puerta con el 11 (o sin mirar `admin`) → 1
//   - un paso del onboarding que deja otra etapa (el «agendado» sin el contacto guardado) → 2
//   - el día N con `adelantado: N - 1` (queda el día anterior abierto) → 3
//   - las claves de lo visto con el día de hoy adentro → 3
//   - la ruta con la puerta sólo en el POST → 5; el desplegable sin esperar el sí del server → 5; los ejemplos sin la puerta → 5
