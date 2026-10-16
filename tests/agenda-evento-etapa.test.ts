// =============================================================================
// El evento de agenda VINCULADO a una etapa de reunión: quién cae dónde (16/10/2026)
// =============================================================================
// Pedido de Martín: «que una etapa catalogada como "reunion" se pueda vincular a un evento de
// calendly o cal, para que sepa que leads deben caer allí cuando se agendan y no caer en otra etapa u
// otro funnel», con un test de que un agendado de OTRO evento no cae ahí.
//
// Lo que fija, EJECUTANDO las funciones (lib/agenda-evento-etapa.ts, puras):
//   1. el agendado del evento vinculado cae en ESA etapa de ESE funnel, con la R que dice la etapa;
//   2. el de OTRO evento no cae ahí ni en ese funnel — tampoco si se llama igual que el vinculado;
//   3. un evento vinculado en el negocio A no rutea a nada del negocio B;
//   4. sin vínculos, la decisión es la de antes (J1/J2, y sin destino: el funnel principal);
//   5. la R2 sigue sin crear leads, con vínculo o sin él;
//   6. un vínculo que dejó de valer (etapa borrada, ya no es reunión, funnel archivado, tercera
//      reunión) no rutea: vuelve a lo de antes;
//   7. la reserva no hace retroceder a nadie ni saca a nadie de una terminal;
//   8. lo que el índice de webhooks tiene que conservar al desvincular o al quitar la R2;
//   9. que en Cal.com el nombre del tipo de evento sale de `eventTitle` (no del título de la reserva);
//  10. y que los DOS webhooks pasan por estas funciones (el lugar, leído del fuente).
//
// PROBADO ROMPIÉNDOLO (16/10/2026), una rotura por vez, restaurando de memoria, con 20/20 en verde
// antes y después (21/21 con el de Cal.com, sumado después; la primera corrida dio 0 fallas con el
// filtro de workspace del VÍNCULO sacado: el del embudo lo tapaba. Se sumó la fila de A que nombra un
// embudo de B, y ahí sí falla):
//   · `normalizarReserva` leyendo `title` otra vez                     → 1 falla  (el nombre en Cal.com)
//   · `rutaDeEvento` sin el filtro de workspace del vínculo           → 1 falla  (negocio A → B)
//   · `rutaDeEvento` sin el filtro de workspace del embudo            → 1 falla  (negocio A → B)
//   · `rutaDeEvento` comparando también contra el NOMBRE del vínculo  → 1 falla  (otro evento que se llama igual)
//   · `rutaDeEvento` sin mirar el proveedor                           → 1 falla
//   · `rutaDeEvento` sin validar la etapa (cualquier etapa es R1)     → 2 fallas (vínculo que dejó de valer, tercera)
//   · `rutaDeEvento` desempatando (devuelve la primera)               → 1 falla  (ambiguo)
//   · `decidirReserva` con `puedeCrearLead: true` siempre             → 2 fallas (sin vínculos, la R2 crea)
//   · `decidirReserva` con la R de J1/J2 aunque haya ruta             → 2 fallas
//   · `moverAlReservar` sin el corte de las terminales                → 1 falla
//   · `moverAlReservar` sin el «no retrocede»                         → 1 falla
//   · `identificadoresNecesarios` sin las credenciales                → 1 falla
//   · el webhook de Calendly creando con `tipoJunta !== 'j2'`         → 1 falla  (el lugar)
//   · el webhook de Cal.com sin `alCrear`                             → 1 falla  (el lugar)
//   · `eliminarCredencial` sin volver a reclamar                      → 1 falla  (el lugar)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  rutaDeEvento, decidirReserva, moverAlReservar, problemaDeVinculo, reunionDeEtapa, identificadoresNecesarios,
  mismoIdentificador, faltaLaTabla, type VinculoEvento, type FunnelDelNegocio, type RutaDeReserva,
} from '../lib/agenda-evento-etapa';
import { eventTypesDeRespuestaCalcom, normalizarReserva, clasificarJuntaCalcom } from '../lib/calcom';
import { DEFAULT_PIPELINE } from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

// ── El mundo de prueba: dos negocios ──────────────────────────────────────────
const A = 13;
const B = 21;
const URI = (x: string) => `https://api.calendly.com/event_types/${x}`;

/** Un embudo propio con DOS reuniones y claves que no son las de siempre. */
const MENTORIA = [
  { key: 'lead', label: 'Lead entrante', kind: 'entrada' },
  { key: 'discovery', label: 'Llamada de descubrimiento', kind: 'reunion' },
  { key: 'propuesta', label: 'Propuesta', kind: 'paso' },
  { key: 'cierre-call', label: 'Llamada de cierre', kind: 'reunion' },
  { key: 'demo-extra', label: 'Demo extra', kind: 'reunion' },
  { key: 'ganado', label: 'Ganado', kind: 'cierre' },
];

const funnelsA: FunnelDelNegocio[] = [
  { id: 10, workspaceId: A, pipeline: DEFAULT_PIPELINE },   // el principal: 'agenda' y 'agendaj2'
  { id: 20, workspaceId: A, pipeline: MENTORIA },
];
const funnelsB: FunnelDelNegocio[] = [
  { id: 30, workspaceId: B, pipeline: DEFAULT_PIPELINE },
  { id: 40, workspaceId: B, pipeline: MENTORIA },
];

const vinculosA: VinculoEvento[] = [
  { workspaceId: A, proveedor: 'calendly', identificador: URI('DISCO'), nombre: 'Discovery', funnelId: 20, etapa: 'discovery' },
  { workspaceId: A, proveedor: 'calendly', identificador: URI('CIERRE'), nombre: 'Cierre', funnelId: 20, etapa: 'cierre-call' },
  { workspaceId: A, proveedor: 'calcom', identificador: '777', nombre: 'Llamada', funnelId: 10, etapa: 'agenda' },
];

/** Lo que manda Calendly: event_type, name y la uri de ESTA reserva. */
const reservaCalendly = (eventType: string, name: string) => [eventType, name, 'https://api.calendly.com/scheduled_events/RESERVA-1'];

const ruta = (ws: number, proveedor: 'calendly' | 'calcom', candidatos: string[], vinculos = vinculosA, funnels: FunnelDelNegocio[] = [...funnelsA, ...funnelsB]) =>
  rutaDeEvento({ ws, proveedor, candidatos, vinculos, funnels });

// ── 1 y 2: quién cae y quién no ───────────────────────────────────────────────

test('el agendado del evento VINCULADO cae en esa etapa de ese funnel, con la R que dice la etapa', () => {
  assert.deepEqual(ruta(A, 'calendly', reservaCalendly(URI('DISCO'), 'Discovery')),
    { funnelId: 20, etapa: 'discovery', reunion: 'R1', identificador: URI('DISCO') });
  // La segunda reunión del embudo es la R2, aunque nadie la haya cargado como J2.
  assert.deepEqual(ruta(A, 'calendly', reservaCalendly(URI('CIERRE'), 'Cierre')),
    { funnelId: 20, etapa: 'cierre-call', reunion: 'R2', identificador: URI('CIERRE') });
  // Cal.com rutea por el id del event type.
  assert.deepEqual(ruta(A, 'calcom', ['777', 'llamada-30', '30 min con Ana']),
    { funnelId: 10, etapa: 'agenda', reunion: 'R1', identificador: '777' });
  // Espacios y mayúsculas no cambian el evento (como en webhook_routing).
  assert.equal(ruta(A, 'calendly', [`  ${URI('disco')} `])?.etapa, 'discovery');
});

test('un agendado de OTRO evento NO cae en la etapa vinculada ni en ese funnel', () => {
  const otro = ruta(A, 'calendly', reservaCalendly(URI('OTRO'), 'Llamada general'));
  assert.equal(otro, null, 'otro evento no rutea: sigue el camino de antes');
  const d = decidirReserva(otro, 'j1');
  assert.equal(d.destino, null, 'sin destino: el lead nace en el funnel principal, como antes');
});

test('otro evento que se LLAMA igual que el vinculado tampoco cae ahí: se compara el identificador', () => {
  // Dos event types pueden llamarse «Discovery» (uno por cada closer). El nombre no es el evento.
  assert.equal(ruta(A, 'calendly', reservaCalendly(URI('OTRO-DISCO'), 'Discovery')), null);
});

test('el mismo identificador en el OTRO proveedor no rutea (Calendly y Cal.com no comparten nombres)', () => {
  assert.equal(ruta(A, 'calcom', [URI('DISCO')]), null);
  assert.equal(ruta(A, 'calendly', ['777']), null);
});

// ── 3: negocio A, negocio B ───────────────────────────────────────────────────

test('un evento vinculado en el negocio A no rutea a nada del negocio B', () => {
  assert.equal(ruta(B, 'calendly', reservaCalendly(URI('DISCO'), 'Discovery')), null, 'los vínculos de A no valen para B');
  // Un vínculo «de B» que apunta a un embudo de A (una fila mal escrita, una FK no mira de quién es): tampoco.
  const cruzado: VinculoEvento[] = [{ workspaceId: B, proveedor: 'calendly', identificador: URI('X'), nombre: 'X', funnelId: 20, etapa: 'discovery' }];
  assert.equal(ruta(B, 'calendly', [URI('X')], cruzado), null, 'el embudo 20 es de A');
  // Y al revés: una fila de A que nombra un embudo de B. Cada filtro cubre una fila mal escrita distinta.
  const deAaB: VinculoEvento[] = [{ workspaceId: A, proveedor: 'calendly', identificador: URI('X'), nombre: 'X', funnelId: 40, etapa: 'discovery' }];
  assert.equal(ruta(B, 'calendly', [URI('X')], deAaB), null, 'el vínculo es de A aunque el embudo sea de B');
  // Y el de B con su propio embudo, sí.
  const deB: VinculoEvento[] = [{ workspaceId: B, proveedor: 'calendly', identificador: URI('X'), nombre: 'X', funnelId: 40, etapa: 'discovery' }];
  assert.equal(ruta(B, 'calendly', [URI('X')], deB)?.funnelId, 40);
});

// ── 4 y 5: sin vínculos es lo de antes; la R2 no crea ─────────────────────────

test('sin vínculos, la decisión es EXACTAMENTE la de antes', () => {
  assert.equal(ruta(A, 'calendly', reservaCalendly(URI('DISCO'), 'Discovery'), []), null, 'sin filas no hay ruta');
  assert.deepEqual(decidirReserva(null, 'j1'), { reunion: 'R1', puedeCrearLead: true, destino: null });
  assert.deepEqual(decidirReserva(null, 'desconocido'), { reunion: 'R1', puedeCrearLead: true, destino: null }, 'un evento desconocido se trata como R1, como siempre');
  assert.deepEqual(decidirReserva(null, 'j2'), { reunion: 'R2', puedeCrearLead: false, destino: null });
});

test('la R2 sigue sin crear leads, con vínculo o sin él', () => {
  const r2: RutaDeReserva = { funnelId: 20, etapa: 'cierre-call', reunion: 'R2', identificador: URI('CIERRE') };
  assert.equal(decidirReserva(null, 'j2').puedeCrearLead, false);
  assert.equal(decidirReserva(r2, 'j1').puedeCrearLead, false, 'aunque J1 lo llame R1, la etapa dice R2');
  assert.equal(decidirReserva(r2, 'desconocido').puedeCrearLead, false);
  assert.equal(decidirReserva(r2, 'j1').reunion, 'R2');
});

test('con vínculo, la R y el destino los dice la ETAPA, no J1/J2', () => {
  const r1: RutaDeReserva = { funnelId: 20, etapa: 'discovery', reunion: 'R1', identificador: URI('DISCO') };
  assert.deepEqual(decidirReserva(r1, 'j2'), { reunion: 'R1', puedeCrearLead: true, destino: { funnelId: 20, etapa: 'discovery' } });
});

// ── 6: el vínculo que dejó de valer ───────────────────────────────────────────

test('un vínculo que dejó de valer no rutea (y la reserva vuelve a lo de antes)', () => {
  const vDisco = [vinculosA[0]];
  const sinLaEtapa: FunnelDelNegocio[] = [{ id: 20, workspaceId: A, pipeline: MENTORIA.filter((s) => s.key !== 'discovery') }];
  assert.equal(ruta(A, 'calendly', [URI('DISCO')], vDisco, sinLaEtapa), null, 'la etapa se borró');
  const yaNoEsReunion: FunnelDelNegocio[] = [{ id: 20, workspaceId: A, pipeline: MENTORIA.map((s) => (s.key === 'discovery' ? { ...s, kind: 'paso' } : s)) }];
  assert.equal(ruta(A, 'calendly', [URI('DISCO')], vDisco, yaNoEsReunion), null, 'la etapa pasó a ser un paso');
  assert.equal(ruta(A, 'calendly', [URI('DISCO')], vDisco, funnelsA.filter((f) => f.id !== 20)), null, 'el funnel se archivó (no está entre los activos)');
});

test('la TERCERA reunión no tiene dónde guardar la fecha: ni se vincula ni rutea', () => {
  assert.equal(reunionDeEtapa(MENTORIA, 'demo-extra'), null);
  assert.match(problemaDeVinculo(MENTORIA, 'demo-extra') ?? '', /tercera reunión/);
  const v: VinculoEvento[] = [{ workspaceId: A, proveedor: 'calendly', identificador: URI('DEMO'), nombre: 'Demo', funnelId: 20, etapa: 'demo-extra' }];
  assert.equal(ruta(A, 'calendly', [URI('DEMO')], v), null);
});

test('qué etapa se puede vincular: sólo una reunión, que exista, R1 o R2', () => {
  assert.equal(problemaDeVinculo(MENTORIA, 'discovery'), null);
  assert.equal(problemaDeVinculo(MENTORIA, 'cierre-call'), null);
  assert.match(problemaDeVinculo(MENTORIA, 'propuesta') ?? '', /Reunión/);
  assert.match(problemaDeVinculo(MENTORIA, 'lead') ?? '', /Reunión/);
  assert.match(problemaDeVinculo(MENTORIA, 'no-existe') ?? '', /no está/);
  assert.equal(reunionDeEtapa(DEFAULT_PIPELINE, 'agenda'), 'R1');
  assert.equal(reunionDeEtapa(DEFAULT_PIPELINE, 'agendaj2'), 'R2');
  assert.equal(reunionDeEtapa([], 'agenda'), null, 'un embudo vacío no cae al de por defecto');
});

test('dos vínculos que calzan con la misma reserva y dicen lugares distintos: no se adivina', () => {
  const dobles: VinculoEvento[] = [
    vinculosA[0],
    { workspaceId: A, proveedor: 'calendly', identificador: 'Discovery', nombre: 'Discovery', funnelId: 20, etapa: 'cierre-call' },
  ];
  assert.equal(ruta(A, 'calendly', reservaCalendly(URI('DISCO'), 'Discovery'), dobles), null);
});

// ── 7: la reserva no hace retroceder a nadie ──────────────────────────────────

test('moverAlReservar: entra, avanza o sale de una nutrición; nunca retrocede ni sale de una terminal', () => {
  assert.equal(moverAlReservar(MENTORIA, 'lead', 'discovery'), true, 'de la entrada a su R1');
  assert.equal(moverAlReservar(MENTORIA, null, 'discovery'), true, 'recién llega');
  assert.equal(moverAlReservar(MENTORIA, 'noshow_r1', 'discovery'), true, 'de una nutrición (no está en el recorrido) a la reunión');
  assert.equal(moverAlReservar(MENTORIA, 'agenda', 'discovery'), true, 'una etapa que este embudo no tiene');
  assert.equal(moverAlReservar(MENTORIA, 'discovery', 'discovery'), false, 'ya está');
  assert.equal(moverAlReservar(MENTORIA, 'cierre-call', 'discovery'), false, 'está en la R2 y reserva la R1 otra vez: no retrocede');
  assert.equal(moverAlReservar(MENTORIA, 'ganado', 'discovery'), false, 'un ganado se queda en Ganado');
  assert.equal(moverAlReservar(MENTORIA, 'perdido', 'discovery'), false);
  assert.equal(moverAlReservar(MENTORIA, 'lead', 'discovery', 'perdido'), false, 'la tarjeta en la entrada pero el lead perdido: no se lo reabre');
  assert.equal(moverAlReservar(MENTORIA, 'lead', 'discovery', 'abierto'), true);
});

// ── 8: el índice de webhooks ──────────────────────────────────────────────────

test('lo que el índice de webhooks tiene que conservar: las credenciales R1/R2 y los vinculados, sin duplicar', () => {
  const necesarios = identificadoresNecesarios({
    proveedor: 'calendly',
    creds: ['Discovery', null, '  '],
    vinculos: [...vinculosA, { proveedor: 'calendly', identificador: 'discovery' }],
  });
  assert.deepEqual(necesarios, ['Discovery', URI('DISCO'), URI('CIERRE')], 'la R1 por nombre, los dos vinculados de Calendly; no el de Cal.com ni el repetido');
  // Desvincular un evento que es también la R1 de Integraciones NO lo suelta.
  assert.ok(identificadoresNecesarios({ proveedor: 'calendly', creds: [URI('DISCO')], vinculos: [] }).some((x) => mismoIdentificador(x, URI('DISCO'))));
});

test('la tabla que falta (la mig 0293 sin aplicar) se distingue de cualquier otro error', () => {
  assert.equal(faltaLaTabla({ code: 'PGRST205' }), true);
  assert.equal(faltaLaTabla({ code: '42P01' }), true);
  assert.equal(faltaLaTabla({ code: '57014' }), false, 'un timeout NO es «no hay vínculos»');
  assert.equal(faltaLaTabla(null), false);
});

test('Cal.com: los tipos de evento se leen en las dos formas de la respuesta', () => {
  const nueva = { status: 'success', data: [{ id: 777, title: 'Llamada', slug: 'llamada-30', lengthInMinutes: 30 }, { title: 'sin id' }] };
  assert.deepEqual(eventTypesDeRespuestaCalcom(nueva), [{ id: '777', slug: 'llamada-30', nombre: 'Llamada', duracionMin: 30 }]);
  const vieja = { data: { eventTypeGroups: [{ eventTypes: [{ id: 5, title: 'Demo', slug: 'demo', length: 45 }] }, { eventTypes: [{ id: 5, title: 'Demo repetida' }] }] } };
  assert.deepEqual(eventTypesDeRespuestaCalcom(vieja), [{ id: '5', slug: 'demo', nombre: 'Demo', duracionMin: 45 }]);
  assert.deepEqual(eventTypesDeRespuestaCalcom(null), []);
});

test('Cal.com: el NOMBRE del tipo de evento sale de eventTitle, no del título de la reserva', () => {
  // El ejemplo de BOOKING_CREATED de la doc de webhooks de Cal.com: title «Strategy Session between Organizer and
  // Guest», eventTitle «Strategy Session». Con `title`, un tipo de evento cargado por su nombre no calzaba nunca.
  const r = normalizarReserva({
    uid: 'bk_1', title: 'Llamada de auditoría between Ana and Juan', eventTitle: 'Llamada de auditoría',
    eventTypeId: 4242, eventTypeSlug: 'llamada-de-auditoria', attendees: [{ name: 'Juan', email: 'juan@x.com' }],
  })!;
  assert.equal(r.eventType.nombre, 'Llamada de auditoría');
  assert.equal(clasificarJuntaCalcom(r.eventType, { j1: 'Llamada de auditoría' }), 'j1', 'cargado por su nombre, como ofrece la ayuda');
  assert.equal(normalizarReserva({ uid: 'bk_2', title: 'Viejo', attendees: [] })!.eventType.nombre, 'Viejo', 'sin eventTitle, lo de antes');
});

// ── 9: el lugar — los dos webhooks pasan por acá ──────────────────────────────

test('EL LUGAR: el webhook de Calendly decide con decidirReserva y sólo la R1 crea', () => {
  const src = sinComentarios(leer('app/api/webhooks/calendly/route.ts'));
  assert.match(src, /const vinculada = await rutaDeReserva\('calendly', candidatosWs, ws\);/);
  assert.match(src, /const decision = decidirReserva\(vinculada\.ruta, clasificarJunta\(payload\.scheduled_event, cfgJuntas\)\);\s*if \(!decision\.puedeCrearLead\) \{/);
  assert.match(src, /\}, \{ alCrear: vinculada\.alCrear \}\);/, 'el lead nuevo nace en el embudo del evento');
  assert.equal((src.match(/ubicarReservaVinculada\(lead, vinculada, 'Calendly'\)/g) ?? []).length, 2, 'la R1 que ya existía y la R2');
  assert.doesNotMatch(src, /tipoJunta === 'j2'/, 'la R ya no sale sólo de J1/J2');
});

test('EL LUGAR: el webhook de Cal.com decide con la MISMA función', () => {
  const src = sinComentarios(leer('app/api/webhooks/calcom/route.ts'));
  assert.match(src, /const vinculada = await rutaDeReserva\('calcom', candidatos, ws\);/);
  assert.match(src, /const decision = decidirReserva\(vinculada\.ruta, tipo\);/);
  assert.match(src, /if \(!decision\.puedeCrearLead\) \{/);
  assert.match(src, /\}, \{ alCrear: vinculada\.alCrear \}\);/);
  assert.equal((src.match(/ubicarReservaVinculada\(lead, vinculada, 'Cal\.com'\)/g) ?? []).length, 2);
});

test('EL LUGAR: quitar una credencial de la agenda vuelve a reclamar lo que se sigue usando', () => {
  const src = sinComentarios(leer('lib/credenciales.ts'));
  const i = src.indexOf('export async function eliminarCredencial(');
  assert.ok(i > 0);
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  assert.match(cuerpo, /await borrarRoutingDeWs\(ROUTING_CREDS\[clave\], ws\);[\s\S]*await reclamarRuteoDeAgenda\(ROUTING_CREDS\[clave\], ws\);/);
});

test('EL LUGAR: la tabla nueva está acotada por workspace (TENANT_TABLES y TABLAS_DE_INQUILINO)', () => {
  assert.match(leer('lib/workspace.ts'), /^\s*'agenda_evento_etapa',$/m);
  assert.match(leer('lib/tablas-de-inquilino.ts'), /^\s*'agenda_evento_etapa',$/m);
  const sql = leer('supabase/migrations/0293_agenda_evento_etapa.sql');
  assert.match(sql, /create unique index if not exists agenda_evento_etapa_uk on agenda_evento_etapa \(workspace_id, proveedor, identificador\)/, 'UN evento, UN lugar');
  assert.match(sql, /revoke all on agenda_evento_etapa from anon, authenticated;/);
  assert.doesNotMatch(sql, /workspace_id\s+bigint not null default 1/, 'sin default al ws1: es un cliente');
});
