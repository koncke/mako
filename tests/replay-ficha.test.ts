// =============================================================================
// El reproductor en la ficha: QUÉ dice cuando no hay grabación, y quién lo monta
// =============================================================================
// Lo que se prueba acá son las dos cosas que se rompen solas:
//
//   1. el VACÍO. Siete causas distintas que en pantalla se leen igual, y sólo una
//      se arregla (repegar el código). Un orden mal puesto manda a repegar a quien
//      ya está al día, o afirma que una grabación venció cuando nunca hubo ninguna.
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
// (Los casos `apagado` y `sin_grabacion` ya no existen: el primero se fue el 06/10
// con el apagador, el segundo el 08/10, partido en `antes_del_grabador`,
// `sin_visitas` y `no_quedo`.) (Y el de `anidada` tampoco: el 14/10 la grabación dejó de
// ser un pop-up y se ve en línea; el test que lo reemplaza dice por qué.)
//
// PROBADO ROMPIÉNDOLO OTRA VEZ (08/10/2026), con el mismo arnés. Base: 34 pases, 0
// fallos; 17 roturas y las 17 caen. Cada una está anotada en su test.
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
  REPLAY_DESDE_ISO,
  REPLAY_DESDE_SNIPPET,
  REPLAY_MINIMO_EVENTOS,
  duracionCorta,
  motivoDelVacio,
  noGrabanTodas,
  paginaGrabaHoy,
  parsearCuerpo,
  textoDelCorte,
  textoDelVacio,
  tieneFoto,
  ultimaVisita,
  visitaSinGrabador,
  type ReplayVacio,
  type SenalesDelVacio,
  type VisitaDelLead,
} from '../lib/replay-ficha';
import { REPLAY_RETENCION_DIAS, REPLAY_RETENCION_LEAD_DIAS } from '../lib/replay-contrato';

const AHORA = '2026-10-08T12:00:00.000Z';
const diasAtras = (n: number) => new Date(Date.parse(AHORA) - n * 86_400_000).toISOString();

/** Una visita que PUDO grabarse: Pixel con grabador, después del 05/10/2026. */
const visitaQueGraba: VisitaDelLead = { iso: diasAtras(1), sv: REPLAY_DESDE_SNIPPET + 1, url: 'https://pagina.com/' };
/** Una visita con un Pixel sin grabador. */
const visitaVieja: VisitaDelLead = { iso: diasAtras(9), sv: 14, url: 'https://pagina.com/' };

/** Todo en orden y una visita de ayer que podía grabarse: el caso en que de verdad no quedó nada. */
const base: SenalesDelVacio = {
  visitorId: 'v-1',
  leyoTodo: true,
  hayGrabaciones: false,
  visitas: [visitaQueGraba],
  suPaginaGrabaHoy: true,
  ultimaActividadISO: diasAtras(1),
  ahoraISO: AHORA,
  retencionDias: REPLAY_RETENCION_DIAS,
};

const TODAS: ReplayVacio[] = ['sin_visitor', 'no_se_pudo_leer', 'sin_visitas', 'antes_del_grabador', 'pixel_viejo', 'vencida', 'no_quedo'];

// ── El vacío: quién gana a quién ─────────────────────────────────────────────

test('una grabación que existe gana sobre todo lo demás', () => {
  assert.equal(motivoDelVacio({ ...base, hayGrabaciones: true, visitas: [visitaVieja], suPaginaGrabaHoy: false }), null);
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

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 pases · 0 fallos:
//   el `sin_visitas` movido DESPUÉS del de código viejo ......... 33 · 1 (éste:
//     `[].every(...)` es true, y un lead sin visitas pasaba a «es de antes»)
//   `(s.visitas ?? []).length === 0` (null contado como []) ...... 33 · 1 (éste)
test('sin visitas es su PROPIO caso, y sólo cuando la lectura contestó', () => {
  assert.equal(motivoDelVacio({ ...base, visitas: [] }), 'sin_visitas');
  // Sin visitas no hay nada que vencer: gana sobre la retención.
  assert.equal(motivoDelVacio({ ...base, visitas: [], ultimaActividadISO: diasAtras(400) }), 'sin_visitas');
  // `null` es «no pude leer las visitas»: no autoriza a decir que no hay ninguna.
  assert.equal(motivoDelVacio({ ...base, visitas: null }), 'no_quedo');
});

// ⚠️ EL CASO DE MARTÍN (08/10/2026), con los datos medidos en producción ese día:
// el lead #2593 de ws1 tiene UNA visita, el 01/10 03:14 UTC (30/09 en Tijuana), con
// el Pixel v14, y la página hoy está en la v22. La ficha decía «no volvió a entrar, o
// su visita duró menos de 10 segundos» sobre una visita de 4 minutos.
//
// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `paginaGrabaHoy` con la URL cruda en vez de `clavePagina` ... 32 · 2 (éste y
//     el de la clave: sin el mapa decide el negocio, y con negocio '18' da false)
//   la fecha formateada en UTC en vez de la zona del negocio .... 32 · 2 (éste y
//     el de la fecha: sale «01/10»)
//   el respaldo del negocio evaluado antes que el mapa .......... 32 · 2
test('⚠️ el #2593: visita v14 del 30/09, su página hoy en la v22 → «es de antes», sin link', () => {
  const url = 'https://multiplicatusresultados.com/?utm_source=facebook&utm_medium=paid_social&fbclid=IwZXh0bgNhZW0';
  const visitas: VisitaDelLead[] = [{ iso: '2026-10-01T03:14:44.556054+00:00', sv: 14, url }];
  const mapa = { 'multiplicatusresultados.com': { v: 22, t: '2026-10-06T17:31:59.636Z' } };
  // Con el negocio en '18' se ve que decide la PÁGINA, no el respaldo.
  const graba = paginaGrabaHoy(mapa, url, '18');
  assert.equal(graba, true);
  const motivo = motivoDelVacio({ ...base, visitas, suPaginaGrabaHoy: graba, ultimaActividadISO: '2026-10-01T03:18:03Z' });
  assert.equal(motivo, 'antes_del_grabador');
  const t = textoDelVacio(motivo!, 30, { iso: visitas[0].iso!, varias: false }, 'America/Tijuana');
  assert.equal(t.que, 'Su visita es del 30/09, antes de que MaKo grabara tu página.');
  assert.equal(t.donde, null, 'no hay nada que arreglar: su página ya graba');
});

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `s.suPaginaGrabaHoy === false` → `!s.suPaginaGrabaHoy` ........ 33 · 1 (éste:
//     «no se sabe» mandaba a repegar)
test('el código viejo lleva link SÓLO si la página SIGUE vieja', () => {
  const viejas = { ...base, visitas: [visitaVieja] };
  assert.equal(motivoDelVacio({ ...viejas, suPaginaGrabaHoy: false }), 'pixel_viejo');
  assert.equal(motivoDelVacio({ ...viejas, suPaginaGrabaHoy: true }), 'antes_del_grabador');
  // No saber qué versión tiene hoy la página no autoriza a mandar a repegarla.
  assert.equal(motivoDelVacio({ ...viejas, suPaginaGrabaHoy: null }), 'antes_del_grabador');
});

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `s.visitas.every(visitaSinGrabador)` → `.some(...)` ......... 33 · 1 (éste)
test('UNA visita que pudo grabarse alcanza para no culpar al código', () => {
  // Con una visita grabable, una grabación pudo existir: «fue antes del grabador»
  // sería falso para esa.
  assert.equal(motivoDelVacio({ ...base, visitas: [visitaQueGraba, visitaVieja], suPaginaGrabaHoy: false }), 'no_quedo');
  assert.equal(motivoDelVacio({ ...base, visitas: [visitaVieja, visitaQueGraba], suPaginaGrabaHoy: false }), 'no_quedo');
});

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `sv` null contado como 0 en `visitaSinGrabador` .............. 33 · 1 (éste)
//   sin la rama de la fecha (null = no se sabe, siempre) .......... 33 · 1 (éste)
test('un `sv` null NO es la versión 0: decide la FECHA, que sí se sabe', () => {
  // Medido el 08/10/2026: todas las visitas con `sv` null son del 15/08 o anteriores.
  assert.equal(visitaSinGrabador({ iso: '2026-08-14T21:59:53Z', sv: null, url: null }), true);
  // Después del grabador, un null no se sabe y no acusa a nadie.
  assert.equal(visitaSinGrabador({ iso: diasAtras(1), sv: null, url: null }), false);
  assert.equal(visitaSinGrabador({ iso: null, sv: null, url: null }), false);
  assert.equal(visitaSinGrabador({ iso: 'cuando sea', sv: null, url: null }), false);
  // Y un `sv` conocido manda sobre la fecha.
  assert.equal(visitaSinGrabador({ iso: diasAtras(1), sv: 18, url: null }), true);
  assert.equal(visitaSinGrabador({ iso: diasAtras(1), sv: REPLAY_DESDE_SNIPPET, url: null }), false);
  // El borde es el commit del grabador.
  assert.ok(Date.parse(REPLAY_DESDE_ISO) > Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(motivoDelVacio({ ...base, visitas: [{ iso: diasAtras(1), sv: null, url: null }] }), 'no_quedo');
});

test('la retención que aplica en la ficha de un LEAD es la larga', () => {
  // A los 100 días la grabación de un visitante anónimo ya no está y la de un lead
  // sí: esto se dibuja en la ficha de un lead, así que `tieneLead` es true.
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: diasAtras(100) }), 'no_quedo');
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: diasAtras(REPLAY_RETENCION_LEAD_DIAS + 5) }), 'vencida');
});

test('el código viejo se dice ANTES que el vencimiento', () => {
  // Si la página nunca tuvo el grabador no hubo nada que vencer: decir «ya la
  // borramos» inventaría una grabación que nunca existió.
  const vieja = { iso: diasAtras(400), sv: 14, url: null };
  assert.equal(motivoDelVacio({ ...base, visitas: [vieja], suPaginaGrabaHoy: false, ultimaActividadISO: diasAtras(400) }), 'pixel_viejo');
  assert.equal(motivoDelVacio({ ...base, visitas: [vieja], suPaginaGrabaHoy: true, ultimaActividadISO: diasAtras(400) }), 'antes_del_grabador');
});

test('una fecha que no se puede leer no vence nada', () => {
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: 'cuando sea' }), 'no_quedo');
  assert.equal(motivoDelVacio({ ...base, ultimaActividadISO: null }), 'no_quedo');
});

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   el respaldo del negocio evaluado ANTES que el mapa ........... 32 · 2 (éste y
//     el #2593: la versión del negocio volvía a tapar la de la página)
//   `clavePagina` cambiado por la URL cruda ....................... 32 · 2
test('la página se busca con la MISMA clave que el beacon, y el mapa manda sobre el negocio', () => {
  const mapa = { 'pagina.com/curso': { v: 22, t: '' }, 'vieja.com': { v: 18, t: '' } };
  // www., barra final, query y hash: la clave es la de `clavePagina`.
  assert.equal(paginaGrabaHoy(mapa, 'https://www.pagina.com/curso/?utm_source=fb#x', '15'), true);
  assert.equal(paginaGrabaHoy(mapa, 'http://vieja.com/', '22'), false, 'el negocio en la 22 tapó una página en la 18');
  // Fuera del mapa decide el negocio (el respaldo de `veredictoPixel`).
  assert.equal(paginaGrabaHoy(mapa, 'https://otra.com/', '22'), true);
  assert.equal(paginaGrabaHoy(mapa, 'https://otra.com/', '15'), false);
  assert.equal(paginaGrabaHoy(mapa, null, '21'), true);
  // Sin ningún dato no se sabe.
  assert.equal(paginaGrabaHoy({}, 'https://otra.com/', null), null);
  assert.equal(paginaGrabaHoy({}, 'https://otra.com/', ''), null);
});

test('la última visita es la de fecha más nueva, venga en el orden que venga', () => {
  const a = { iso: '2026-09-01T00:00:00Z', sv: 14, url: 'a' };
  const b = { iso: '2026-09-30T00:00:00Z', sv: 14, url: 'b' };
  assert.equal(ultimaVisita([a, b])?.url, 'b');
  assert.equal(ultimaVisita([b, a])?.url, 'b');
  assert.equal(ultimaVisita([{ iso: null, sv: 1, url: 'x' }, a])?.url, 'a');
  assert.equal(ultimaVisita([]), null);
});

// ── El copy: una frase, y link sólo donde hay algo que apretar ───────────────

test('cada causa tiene su frase, y ninguna está vacía', () => {
  const vistas = new Set<string>();
  for (const c of TODAS) {
    const t = textoDelVacio(c, 30, { iso: '2026-09-30T20:00:00Z', varias: false }, 'America/Tijuana');
    assert.ok(t.que.trim().length > 10, c);
    // Dos causas con la misma frase son dos causas que la pantalla no distingue,
    // que es exactamente el problema que esto viene a resolver.
    assert.ok(!vistas.has(t.que), `frase repetida: ${c}`);
    vistas.add(t.que);
  }
});

// PROBADO ROMPIÉNDOLO (08/10/2026): con la frase vieja de vuelta en `no_quedo`
// («…o su visita duró menos de 10 segundos») → 33 · 1 (éste).
test('⚠️ ninguna frase afirma cuánto duró la visita: la ficha no lo mide', () => {
  for (const c of TODAS) {
    const t = textoDelVacio(c, 30, { iso: '2026-09-30T20:00:00Z', varias: true }, 'America/Tijuana');
    assert.doesNotMatch(t.que, /segundo|minuto|duró|no volvió/i, c);
  }
});

// PROBADO ROMPIENDOLO: devolviendo `donde: null` al caso `pixel_viejo` en
// lib/replay-ficha.ts, este test falla (08/10/2026: 33 · 1).
test('lleva link SOLO el vacío que tiene algo que hacer: el código viejo', () => {
  // Va al Pixel de MaKo, que es donde se arregla. Hasta el 06/10/2026 también lo
  // llevaba «apagada» —al interruptor «Grabar las visitas»—; ese caso ya no existe:
  // la grabación no tiene apagador.
  assert.equal(textoDelVacio('pixel_viejo', 30).donde?.href, '/integraciones?abrir=landing');
  for (const c of TODAS.filter((x) => x !== 'pixel_viejo')) {
    assert.equal(textoDelVacio(c, 30, { iso: '2026-09-30T20:00:00Z', varias: false }).donde, null, c);
  }
});

test('«es de antes» escribe la fecha en la zona del negocio, y sin fecha no inventa una', () => {
  const v = { iso: '2026-10-01T03:14:44Z', varias: true };
  assert.equal(textoDelVacio('antes_del_grabador', 30, v, 'America/Tijuana').que, 'Su última visita es del 30/09, antes de que MaKo grabara tu página.');
  assert.match(textoDelVacio('antes_del_grabador', 30, v, 'UTC').que, /del 01\/10,/);
  // Sin zona, la de la casa (la misma del primer render de `useTzWorkspace`).
  assert.match(textoDelVacio('antes_del_grabador', 30, v).que, /del 30\/09,/);
  assert.equal(textoDelVacio('antes_del_grabador', 30, null).que, 'Su visita es anterior a que MaKo grabara tu página.');
  assert.equal(textoDelVacio('antes_del_grabador', 30, { iso: 'nunca', varias: false }).que, 'Su visita es anterior a que MaKo grabara tu página.');
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

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `tieneFoto` devolviendo `eventos.length > 0` .................. 33 · 1 (éste)
//   la línea `if (!tieneFoto(eventos))` borrada del modal ........ 33 · 1 (el del
//     modal, más abajo)
test('sin la FOTO de la página (rrweb type 2) no hay qué reproducir', () => {
  // Medido el 08/10/2026: 7 de 28 sesiones selladas de ws1 y las 2 del #2611
  // arrancan con un type 3 —cambios sobre una foto que no llegó—.
  assert.equal(tieneFoto(parsearCuerpo('[{"type":4},{"type":3},{"type":3}]').eventos), false);
  assert.equal(tieneFoto(parsearCuerpo('[{"type":4},{"type":2},{"type":3}]').eventos), true);
  assert.equal(tieneFoto(['2', null, { type: '2' }]), false);
  assert.equal(tieneFoto([]), false);
});

test('la duración se escribe como un reloj', () => {
  assert.equal(duracionCorta(247), '4:07');
  assert.equal(duracionCorta(0), '0:00');
  assert.equal(duracionCorta(-5), '0:00');
});

// ── Los call sites: lo escrito no es lo enchufado ────────────────────────────

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** El código sin comentarios: un guard que lee comentarios encuentra lo que el
 *  archivo dice de sí mismo, no lo que hace. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

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

/** El cuerpo de `replayDeLead`, sin comentarios. */
function bloqueReplayDeLead(): string {
  const src = sinComentarios(leer('lib/replay-leer.ts'));
  const i = src.indexOf('export async function replayDeLead(');
  assert.notEqual(i, -1, 'no está replayDeLead');
  const fin = src.indexOf('\nexport ', i + 10);
  const bloque = src.slice(i, fin === -1 ? undefined : fin);
  // Si el recorte se come el archivo entero, está mirando otra cosa.
  assert.ok(bloque.length > 400 && bloque.length < 6000, `el recorte de replayDeLead mide ${bloque.length}`);
  return bloque;
}

// PROBADO ROMPIÉNDOLO (08/10/2026), base 34 · 0:
//   `? r.sv : null` → `? r.sv : 0` en replay-leer.ts ............... 33 · 1 (éste)
//   `sv: Math.max(r.sv, Number(negocio))` (el máximo de vuelta) .... 33 · 1 (éste)
//   `visitas,` quitado de la llamada a motivoDelVacio .............. 33 · 1 (éste;
//     el typecheck queda VERDE porque `senales` ya trae `visitas: null`)
test('⚠️ replayDeLead NO vuelve a mezclar la versión del negocio con la de la visita', () => {
  // Hasta el 08/10/2026: `Math.max(svLead, svWs)`. El setting del negocio (el último
  // evento, de cualquier página) tapaba el Pixel viejo de la visita y la ficha del
  // #2593 decía «duró menos de 10 segundos».
  const b = bloqueReplayDeLead();
  // Todo `Math.max` del bloque es un piso en 0 (segundos, eventos), nunca el máximo
  // entre dos versiones.
  for (const m of b.matchAll(/Math\.max\(([^,)]*)/g)) {
    assert.equal(m[1].trim(), '0', `un Math.max que no es un piso: ${m[0]}`);
  }
  // Y un `sv` null no se vuelve 0: es «no se sabe».
  assert.doesNotMatch(b, /r\.sv\s*:\s*0\b|\.sv\s*\?\?\s*0\b|\.sv\)?\s*\|\|\s*0\b/);
  // La regla vive en el módulo puro: las visitas, enteras, le llegan a motivoDelVacio.
  assert.match(b, /motivoDelVacio\(\{[^}]*\bvisitas,[^}]*\}\)/);
});

// PROBADO ROMPIÉNDOLO (08/10/2026): `replay.visita` quitado de GrabacionCard → 33 · 1
// (éste; el typecheck queda VERDE porque el parámetro es opcional).
test('las DOS puertas que escriben el vacío le pasan la visita (si no, la fecha no sale)', () => {
  // La ficha y la API de MaKo (`ver_grabaciones_lead`) dicen la MISMA frase. Sin la
  // visita, «es de antes» sale sin fecha y en silencio.
  assert.match(sinComentarios(leer('app/crm/lead-view/GrabacionCard.tsx')), /textoDelVacio\(replay\.vacio, replay\.retencionDias, replay\.visita, tz\)/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/landing.run.ts')), /textoDelVacio\(r\.vacio, r\.retencionDias, r\.visita,/);
});

test('la grabación mira la FOTO antes de bajar el reproductor', () => {
  const src = sinComentarios(leer('app/crm/lead-view/GrabacionModal.tsx'));
  const foto = src.indexOf('if (!tieneFoto(eventos))');
  const repro = src.indexOf('await cargarReproductor()');
  assert.ok(foto > 0, 'la grabación no mira la foto');
  assert.ok(repro > 0);
  assert.ok(foto < repro, 'el reproductor se baja antes de saber si hay foto');
  assert.match(src, /fase\.k === 'sin_foto' &&/);
});

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

// ⚠️ CAMBIADO A PROPÓSITO EL 14/10/2026. Hasta ese día este test fijaba lo contrario: que la
// grabación era un pop-up `<Modal anidada>` sobre la ficha. Martín, ese día: «No hagas un
// desplegable de eso, que viva dentro de la sección "Grabación de su visita" en tracking».
//
// PROBADO ROMPIÉNDOLO (14/10/2026), base 34 · 0, una rotura por vez:
//   `<GrabacionEnLinea …>` movido después del `</section>` .......... 33 · 1 (éste)
//   el estado de la tarjeta como lista (`useState<string[]>`) ....... 33 · 1 (éste)
//   `createPortal(` de vuelta en el reproductor ..................... 33 · 1 (éste)
//   la X con un «×» en vez del ícono `cerrar` ....................... 33 · 1 (éste)
//   la ruta de la hoja sin `player.css` ............................. 33 · 1 (el de la carga a pedido)
test('la grabación vive EN LÍNEA en «Grabación de su visita», una a la vez, y no en un pop-up', () => {
  const rep = sinComentarios(leer('app/crm/lead-view/GrabacionModal.tsx'));
  assert.doesNotMatch(rep, /<Modal\b|createPortal\(|useCapaModal\(/, 'volvió el pop-up');
  assert.match(rep, /export function GrabacionEnLinea\(/);

  const card = sinComentarios(leer('app/crm/lead-view/GrabacionCard.tsx'));
  const sec = card.indexOf('<section');
  const fin = card.indexOf('</section>', sec);
  const fila = card.indexOf('<Fila ', sec);
  const repro = card.indexOf('<GrabacionEnLinea ', sec);
  assert.ok(sec > 0 && fin > sec, 'no encontré la sección');
  assert.ok(fila > sec && repro > fila && repro < fin, 'el reproductor no va adentro de la sección, debajo de su fila');
  // Debajo de LA fila elegida, con su propia `key`: abrir otra es otro reproductor desde cero.
  assert.match(card.slice(fila, fin), /\{abierta === s\.id && s\.lista && <GrabacionEnLinea key=\{s\.id\} sesion=\{s\} \/>\}/);
  // UNA a la vez: el estado es un id, no una lista, y tocar la abierta la pliega.
  assert.match(card, /useState<string \| null>\(null\)/);
  assert.match(card, /setAbierta\(\(a\) => \(a === s\.id \? null : s\.id\)\)/);
  // La X es de la casa: el ícono `cerrar` del set del menú.
  assert.match(card, /<IconoMenu nombre="cerrar"/);
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
  // Y su hoja, de la misma carpeta: sin ella se ve roto (14/10/2026). Lo que hace con ella lo
  // prueban, cargándola, tests/grabacion-montaje.test.ts.
  assert.match(src, /\/replay\/\$\{[^}]+\}\/player\.css/);
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
