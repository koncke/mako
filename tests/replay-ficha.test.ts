// =============================================================================
// El reproductor en la ficha: QUÉ dice cuando no hay grabación, y quién lo monta
// =============================================================================
// Lo que se prueba acá son las dos cosas que se rompen solas:
//
//   1. el VACÍO. Seis causas distintas que en pantalla se leen igual, y tres de
//      ellas se arreglan en lugares distintos. Un orden mal puesto manda a repegar
//      el código de la landing a quien tiene la grabación apagada, o afirma que una
//      grabación venció cuando nunca hubo ninguna.
//   2. el CALL SITE. La tarjeta la montan DOS parents (el modal del CRM y la ruta
//      /crm/[id]) y el prop es OPCIONAL: si uno de los dos no lo pasa, el typecheck
//      queda verde y esa pantalla no dibuja nada. Es exactamente el modo de falla
//      que AGENTS.md documenta («repartir trabajo por archivo garantiza salidas
//      huérfanas»).
//
// PROBADO ROMPIÉNDOLO (05/10/2026). Base: 22 pases, 0 fallos. Cada rotura, una por
// una, con un arnés que restaura DE MEMORIA (nunca `git checkout --`: el árbol es
// compartido y eso ya borró trabajo ajeno una vez):
//
//   `!s.activo` evaluado antes de `!s.visitorId` ............ 20 pases · 2 fallos
//   pixel_viejo antes que apagado ........................... 21 · 1
//   `snippetDelLead != null` → `(s.snippetDelLead ?? 0)` ..... 21 · 1
//   `if (s.hayGrabaciones) return null` borrado .............. 21 · 1
//   grabacionVencio con `tieneLead: false` .................. 21 · 1
//   pixel_viejo sin su `donde` .............................. 21 · 1
//   apagado con un link inventado a /integraciones .......... 21 · 1
//   parsearCuerpo sin la rama de `Array.isArray` ............ 21 · 1
//   parsearCuerpo contando lo ilegible como evento .......... 21 · 1
//   textoDelCorte devolviendo null para 'tiempo' ............ 21 · 1
//   `replay={replay}` quitado de LeadSheet.tsx .............. 21 · 1
//   `replay={replay}` quitado de /crm/[id]/page.tsx ......... 21 · 1
//   `anidada` quitado del <Modal> del pop-up ................ 21 · 1
//   la tarjeta dibujando el vacío de `sin_visitor` .......... 21 · 1
//   la tarjeta importando los tipos de '@/lib/replay-leer' .. 21 · 1
//
// ⚠️ El guard del módulo puro falló primero contra SU PROPIO COMENTARIO: buscaba la
// palabra `server-only` en un archivo cuya cabecera explica por qué NO la lleva. Un
// guard que lee el archivo entero encuentra lo que el archivo dice de sí mismo; lo
// que decide es la SENTENCIA (`/^import 'server-only';$/m`).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  REPLAY_DESDE_SNIPPET,
  REPLAY_MINIMO_EVENTOS,
  duracionCorta,
  motivoDelVacio,
  noGrabanTodas,
  parsearCuerpo,
  textoDelCorte,
  textoDelVacio,
  type SenalesDelVacio,
} from '../lib/replay-ficha';
import { REPLAY_RETENCION_DIAS, REPLAY_RETENCION_LEAD_DIAS } from '../lib/replay-contrato';

const AHORA = '2026-10-05T12:00:00.000Z';
const diasAtras = (n: number) => new Date(Date.parse(AHORA) - n * 86_400_000).toISOString();

/** Todo en orden y una visita de ayer: el caso en que de verdad no hay nada. */
const base: SenalesDelVacio = {
  visitorId: 'v-1',
  leyoTodo: true,
  hayGrabaciones: false,
  snippetDelLead: REPLAY_DESDE_SNIPPET,
  ultimaActividadISO: diasAtras(1),
  ahoraISO: AHORA,
  retencionDias: REPLAY_RETENCION_DIAS,
};

// ── El vacío: quién gana a quién ─────────────────────────────────────────────

test('una grabación que existe gana sobre todo lo demás', () => {
  assert.equal(motivoDelVacio({ ...base, hayGrabaciones: true, snippetDelLead: 1 }), null);
});

test('sin visitor_id la respuesta no depende de ninguna consulta', () => {
  // Y gana sobre «no pude leer»: es un hecho permanente, y mandar a reintentar algo
  // que va a contestar lo mismo siempre es el candado sin llave.
  assert.equal(motivoDelVacio({ ...base, visitorId: null }), 'sin_visitor');
  assert.equal(motivoDelVacio({ ...base, visitorId: null, leyoTodo: false }), 'sin_visitor');
});

test('una lectura que falló NO afirma que no hay grabaciones', () => {
  assert.equal(motivoDelVacio({ ...base, leyoTodo: false }), 'no_se_pudo_leer');
});

test('el código viejo se acusa SÓLO cuando se sabe qué versión midió', () => {
  assert.equal(motivoDelVacio({ ...base, snippetDelLead: REPLAY_DESDE_SNIPPET - 1 }), 'pixel_viejo');
  // null es «no se sabe» —un lead de un formulario de Meta no tiene visitas con
  // `sv`— y ahí el código de la página no es el problema.
  assert.equal(motivoDelVacio({ ...base, snippetDelLead: null }), 'sin_grabacion');
  assert.equal(motivoDelVacio({ ...base, snippetDelLead: REPLAY_DESDE_SNIPPET + 3 }), 'sin_grabacion');
});

test('la retención que aplica en la ficha de un LEAD es la larga', () => {
  // A los 100 días la grabación de un visitante anónimo ya no está y la de un lead
  // sí: esto se dibuja en la ficha de un lead, así que `tieneLead` es true.
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: diasAtras(100) }), 'sin_grabacion');
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: diasAtras(REPLAY_RETENCION_LEAD_DIAS + 5) }), 'vencida');
});

test('el código viejo se dice ANTES que el vencimiento', () => {
  // Si la página nunca tuvo el grabador no hubo nada que vencer: decir «ya la
  // borramos» inventaría una grabación que nunca existió.
  assert.equal(
    motivoDelVacio({ ...base, snippetDelLead: 14, ultimaActividadISO: diasAtras(400) }),
    'pixel_viejo',
  );
});

test('una fecha que no se puede leer no vence nada', () => {
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: 'cuando sea' }), 'sin_grabacion');
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: null }), 'sin_grabacion');
});

// ── El copy: una frase, y link sólo donde hay algo que apretar ───────────────

test('cada causa tiene su frase, y ninguna está vacía', () => {
  const causas = ['sin_visitor', 'no_se_pudo_leer', 'pixel_viejo', 'vencida', 'sin_grabacion'] as const;
  const vistas = new Set<string>();
  for (const c of causas) {
    const t = textoDelVacio(c, 30);
    assert.ok(t.que.trim().length > 10, c);
    // Dos causas con la misma frase son dos causas que la pantalla no distingue,
    // que es exactamente el problema que esto viene a resolver.
    assert.ok(!vistas.has(t.que), `frase repetida: ${c}`);
    vistas.add(t.que);
  }
});

// PROBADO ROMPIENDOLO: devolviendo `donde: null` al caso `pixel_viejo` en
// lib/replay-ficha.ts, este test falla.
test('lleva link SOLO el vacío que tiene algo que hacer: el código viejo', () => {
  // Va al Pixel de MaKo, que es donde se arregla. Hasta el 06/10/2026 también lo
  // llevaba «apagada» —al interruptor «Grabar las visitas»—; ese caso ya no existe:
  // la grabación no tiene apagador.
  assert.equal(textoDelVacio('pixel_viejo', 30).donde?.href, '/integraciones?abrir=landing');
  for (const c of ['sin_visitor', 'no_se_pudo_leer', 'vencida', 'sin_grabacion'] as const) {
    assert.equal(textoDelVacio(c, 30).donde, null, c);
  }
});

test('el vacío por retención dice el número de días, no «hace mucho»', () => {
  assert.match(textoDelVacio('vencida', 45).que, /45 días/);
  assert.match(textoDelVacio('vencida', 30).que, /30 días/);
});

test('una grabación cortada por nosotros LO DICE', () => {
  // Sin esto, una grabación que termina en el minuto 10 se lee como que la persona
  // se fue en el minuto 10: una conclusión equivocada servida como dato.
  assert.match(String(textoDelCorte('tiempo')), /10 minutos/);
  assert.ok(String(textoDelCorte('bytes')).length > 10);
  assert.equal(textoDelCorte(null), null);
});

// ── El cuerpo: las dos formas de JSON Lines que el sellador puede escribir ───

test('el cuerpo se lee con un evento por línea Y con un lote por línea', () => {
  const porEvento = '{"type":2,"data":{}}\n{"type":3,"data":{}}';
  assert.equal(parsearCuerpo(porEvento).eventos.length, 2);
  const porLote = '[{"type":2},{"type":3}]\n[{"type":3}]';
  assert.equal(parsearCuerpo(porLote).eventos.length, 3);
});

test('una línea ilegible se CUENTA y no se cuela como evento', () => {
  const r = parsearCuerpo('{"type":2}\n{roto\n\n123\n{"type":3}');
  assert.equal(r.eventos.length, 2);
  // El `{roto` y el `123`: un número es JSON válido y no es un evento.
  assert.equal(r.ilegibles, 2);
});

test('con menos de dos eventos no se puede reproducir', () => {
  // rrweb necesita el snapshot + algo más: con uno dibuja un cuadro negro y un play
  // que no avanza, que se lee como un reproductor roto.
  assert.equal(REPLAY_MINIMO_EVENTOS, 2);
  assert.ok(parsearCuerpo('{"type":2}').eventos.length < REPLAY_MINIMO_EVENTOS);
});

test('la duración se escribe como un reloj', () => {
  assert.equal(duracionCorta(247), '4:07');
  assert.equal(duracionCorta(0), '0:00');
  assert.equal(duracionCorta(-5), '0:00');
});

// ── Los call sites: lo escrito no es lo enchufado ────────────────────────────

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** La LÍNEA donde ese archivo monta la tarjeta. El universo es la invocación, no
 *  el archivo: `replay` aparece también en los comentarios y en el destructuring. */
function invocacion(src: string, comp: string): string {
  const i = src.indexOf(`<${comp} `);
  assert.notEqual(i, -1, `nadie monta <${comp}>`);
  const fin = src.indexOf('/>', i);
  assert.notEqual(fin, -1, `<${comp}> sin cerrar`);
  const bloque = src.slice(i, fin);
  // Si mañana mide 4.000 caracteres, está mirando otra cosa.
  assert.ok(bloque.length < 1200, `el recorte de <${comp}> mide ${bloque.length}`);
  return bloque;
}

test('los DOS parents le pasan las grabaciones a ComportamientoCard', () => {
  // El prop es opcional para no romper a los dos montajes a la vez, así que sin
  // esto una de las dos pantallas queda sin la sección y el typecheck en verde.
  for (const p of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/page.tsx']) {
    assert.match(invocacion(leer(p), 'ComportamientoCard'), /replay=\{replay\}/, p);
  }
});

test('la tarjeta monta la grabación DESPUÉS del recorrido', () => {
  const src = leer('app/crm/lead-view/ComportamientoCard.tsx');
  const recorrido = src.indexOf('<TrackingTimelineCard');
  const grabacion = src.indexOf('<GrabacionCard');
  assert.ok(recorrido > 0 && grabacion > 0);
  // El orden de las secciones lo decidió Martín: lo nuestro primero. (Hasta el
  // 06/10/2026 la grabación iba además ANTES de «Fuera de MaKo», los links a
  // Clarity; esa sección se fue con Clarity entero.)
  assert.ok(recorrido < grabacion, 'la grabación quedó antes del recorrido');
  assert.ok(!src.includes('{externo && ('), 'volvió la sección de lo externo');
});

test('la tarjeta se calla el ÚNICO vacío que la ficha ya explica arriba', () => {
  // Un lead sin `visitor_id` ya tiene su frase en ComportamientoCard. Dibujar una
  // sección más con lo mismo es la ficha mostrando dos veces el mismo vacío — el bug
  // que `TrackingTimelineCard` ya pagó cuando se montaba suelta en los dos lugares.
  assert.match(leer('app/crm/lead-view/GrabacionCard.tsx'), /if \(replay\.vacio === 'sin_visitor'\) return null;/);
});

test('el pop-up de la grabación es una capa ANIDADA de la ficha', () => {
  // Sin `anidada` la ficha se apaga detrás —se lee como que se cerró— y, sin
  // registrarse en la pila, un Escape cierra la grabación Y la ficha entera.
  const src = leer('app/crm/lead-view/GrabacionModal.tsx');
  const i = src.indexOf('<Modal');
  assert.notEqual(i, -1);
  const bloque = src.slice(i, src.indexOf('>', src.indexOf('pie=', i)));
  assert.match(bloque, /\n\s+anidada\n/);
});

test('las pantallas NO importan nada del módulo con server-only', () => {
  // `replay-leer.ts` lee la base y Storage. Un `import type` de ahí en un
  // `'use client'` es el primer paso para que alguien lo convierta en un import de
  // VALOR, que rompe el build en otro archivo y sin nombrar ninguno de los dos.
  for (const p of ['app/crm/lead-view/GrabacionCard.tsx', 'app/crm/lead-view/GrabacionModal.tsx', 'app/crm/lead-view/ComportamientoCard.tsx']) {
    assert.doesNotMatch(leer(p), /from '@\/lib\/replay-leer'/, p);
  }
  assert.match(leer('lib/replay-leer.ts'), /^import 'server-only';$/m);
  // Y el espejo: el módulo de las decisiones NO puede tener server-only, o ninguna
  // pantalla puede importarlo y ningún test puede probarlo.
  // ⚠️ Se busca la SENTENCIA, no la palabra: este repo nombra `server-only` en los
  // comentarios todo el tiempo, y el primer intento de este guard falló contra el
  // comentario que explica por qué el módulo NO lo lleva.
  assert.doesNotMatch(leer('lib/replay-ficha.ts'), /^import 'server-only';$/m);
});

test('el reproductor se carga a pedido y desde una ruta nuestra', () => {
  const src = leer('lib/replay-reproductor.ts');
  // Nada de rrweb puede viajar en el bundle de la app: la pantalla que lo monta se
  // abre una vez por semana y el peso lo paga todo el mundo.
  assert.doesNotMatch(src, /^import .*rrweb/m);
  assert.match(src, /\/replay\/\$\{[^}]+\}\/player\.js/);
  // Y no por un CDN de un tercero: esta pantalla tiene la cookie de sesión del
  // equipo y los datos de los clientes a la vista.
  assert.doesNotMatch(src, /https?:\/\/(cdn|unpkg|jsdelivr)/);
});

test('⚠️ «no graban las visitas» es verdad para CADA página nombrada, no para la más vieja', () => {
  // Revisión del 06/10/2026: el WhatsApp de «quedó viejo» decía «Tus páginas … no graban
  // las visitas» con una en la v21 —que graba— y otra en la v18, porque decidía con la
  // versión más baja de la lista.
  //
  // PROBADO ROMPIÉNDOLO: con `some` en vez de `every` → 1 falla (este test); con la
  // versión desconocida contando como vieja → 1 falla. Restaurado → en verde.
  const r = REPLAY_DESDE_SNIPPET;
  assert.equal(noGrabanTodas([r, r - 3], r - 3), false, 'una página que graba quedó bajo «no graban»');
  assert.equal(noGrabanTodas([r - 1, r - 3], r - 1), true);
  assert.equal(noGrabanTodas([r - 3, null], r - 3), false, 'una versión que no se sabe autorizó a afirmar');
  // Sin páginas nombradas el mensaje es el genérico, y decide la del workspace.
  assert.equal(noGrabanTodas([], r - 1), true);
  assert.equal(noGrabanTodas([], r), false);
});
