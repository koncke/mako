// =============================================================================
// La Ticketera en el teléfono es la de los TICKETS, y la Ticketera dice si el aviso llegó (17/10/2026)
// =============================================================================
// Dos pendientes de «Pendientes B1» (docs/hallazgos-ticketera.md → «Lo que quedó sin hacer»; docs/hallazgos-operaciones.md):
//   A. En el teléfono, la Ticketera del Ops Center seguía siendo el mazo viejo. Ahora `?ticketera=tickets` es la bandeja de
//      los tickets de los usuarios (la de la computadora) y el mazo quedó como «Preguntas de los chats». Lo invisible:
//        · la ruta de escritorio `/admin/operaciones?ticketera=tickets` viaja al teléfono (antes caía en la lista de chats);
//        · «Aprobar» necesita el motor del Centro para firmarle al Cerebro: sin `cerebroDelCentro` quedaba aprobado y sin entregar;
//        · la hoja de la bandeja la tiene que importar la PÁGINA (un import de CSS en el componente rompe los tests con node).
//   B. «La Ticketera no muestra si el aviso llegó»: `avisado_at` (al cliente) y `aviso_estado` (al Cerebro) estaban en la fila y
//      ninguna pantalla los dibujaba. Un aviso que NO salió no deja renglón en el historial, que era lo único visible.
//
// Probado ROMPIÉNDOLO (17/10/2026; base 8 / 0). Una rotura por vez, restaurada y comprobada con `git diff --stat`:
//   · `rutaMovil` sin 'tickets' en la lista de vistas                    → 7 / 1 (A, la ruta)
//   · la página sin `if (ticketera === 'tickets')`                       → 7 / 1 (A, la página)
//   · `TicketsMovil` con `cerebro={null}` en vez de `cerebroDelCentro`   → 7 / 1 (A, el Cerebro)
//   · la página sin importar bandeja.css                                 → 7 / 1 (A, la hoja)
//   · `avisoAlCliente` sin mirar `avisado_at` (siempre «en camino»)       → 7 / 1 (B, el cliente)
//   · el umbral de atraso en 30 horas en vez de 30 minutos               → 6 / 2 (B1 y B2, el atraso)
//   · `entregaAlCerebro` sin el tope de intentos                          → 7 / 1 (B, el Cerebro)
//   · `vistaDelAviso` sin comparar `aviso_de` con `respondida_at`         → 7 / 1 (B, la respuesta cambiada)
//   · el atraso contado desde `updated_at` y no desde el cierre          → 6 / 2 (B1 y B2: tocar la prioridad lo "rejuvenecía")
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaEscritorio, rutaMovil } from '../lib/movil-rutas';
import { AVISO_AL_CLIENTE_ATRASADO_MS, ENTREGA_MAX_INTENTOS, ENTREGA_TOMADO_VENCE_MS, avisoAlCliente, entregaAlCerebro } from '../lib/tickets-aviso';
import { AVISO_MAX_INTENTOS, AVISO_TOMADO_VENCE_MS, vistaDelAviso } from '../lib/decisiones-aviso';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-17T18:00:00Z');
const hace = (ms: number) => new Date(AHORA - ms).toISOString();
const MIN = 60_000;

// ── A. El teléfono ───────────────────────────────────────────────────────────────────────────────────────────────
test('A1: la ruta de escritorio de los tickets viaja al teléfono y vuelve igual', () => {
  assert.equal(rutaMovil('/admin/operaciones?ticketera=tickets'), '/m/operaciones?ticketera=tickets');
  assert.equal(rutaEscritorio('/m/operaciones?ticketera=tickets'), '/admin/operaciones?ticketera=tickets');
  // Lo de antes no se movió: el mazo y la lista, y lo desconocido cae en los chats.
  assert.equal(rutaMovil('/admin/operaciones?ticketera=tarjetas'), '/m/operaciones?ticketera=tarjetas');
  assert.equal(rutaMovil('/admin/operaciones?ticketera=lista'), '/m/operaciones?ticketera=lista');
  assert.equal(rutaMovil('/admin/operaciones?ticketera=otra'), '/m/operaciones');
});

test('A2: la página del teléfono abre la bandeja con `?ticketera=tickets`, después de la guarda, y trae la hoja', () => {
  const pagina = leer('app/m/operaciones/page.tsx');
  const guarda = pagina.indexOf('puedeOperar(admin, plataforma)');
  const tickets = pagina.indexOf("ticketera === 'tickets'");
  assert.ok(guarda > 0 && tickets > guarda, 'la guarda de super admin va antes de los tickets');
  assert.match(pagina.slice(tickets), /<TicketsMovil \{\.\.\.datos\} \/>/, 'la bandeja recibe el motor del Centro entero');
  assert.match(pagina, /import '@\/app\/tickets\/bandeja\/bandeja\.css';/, 'la hoja la importa la página, no el componente');
  assert.doesNotMatch(leer('app/tickets/bandeja/BandejaTickets.tsx'), /import '.*\.css'/, 'un css en el componente rompe los tests con node');
  // El mazo viejo ya no se abre (17/10/2026, 19:31): `tarjetas` y `lista` abren los tickets, y la hoja no lleva su cabecera.
  assert.match(pagina, /ticketera === 'tickets' \|\| ticketera === 'tarjetas' \|\| ticketera === 'lista'/);
  assert.doesNotMatch(pagina, /Preguntas de los chats/);
});

test('A3: «Aprobar» en el teléfono le firma al Cerebro: la bandeja se monta sobre el motor del Centro', () => {
  const src = leer('app/m/operaciones/TicketeraMovil.tsx');
  assert.match(src, /const centro = useCentro\(datos, \(t\) => toast\(t\)\);/);
  assert.match(src, /<BandejaTickets cerebro=\{cerebroDelCentro\(centro\)\} \/>/, 'sin el Cerebro, Aprobar deja el ticket sin entregar');
  // El Centro ofrece la puerta de los tickets, con su número («Preguntas de los chats» se sacó el 17/10/2026 a las 19:31).
  const centro = leer('app/m/operaciones/CentroAppMovil.tsx');
  assert.match(centro, /titulo="Ticketera"[^>]*href="\/m\/operaciones\?ticketera=tickets"/);
  assert.doesNotMatch(centro, /Preguntas de los chats|ticketera=tarjetas/);
  assert.match(centro, /useTicketsPorDecidir\(true\)/, 'el número de la fila es el de los tickets');
});

// ── B. Si el aviso llegó ─────────────────────────────────────────────────────────────────────────────────────────
const cerrado = { estado: 'resuelto', avisado_at: null, decidido_at: null, resuelto_at: hace(5 * MIN), updated_at: hace(5 * MIN) };

test('B1: al cliente: avisado se ve, en camino se ve, y pasado el doble del cron se marca roto', () => {
  assert.equal(avisoAlCliente({ ...cerrado, estado: 'en_curso' }, AHORA), null, 'un ticket abierto no tiene nada que avisar');
  assert.equal(avisoAlCliente({ ...cerrado, estado: 'arreglado' }, AHORA), null, 'arreglado sin desplegar tampoco');
  const ok = avisoAlCliente({ ...cerrado, avisado_at: hace(MIN) }, AHORA);
  assert.deepEqual([ok?.tono, ok?.texto, ok?.desde], ['good', 'Cliente avisado', hace(MIN)]);
  assert.equal(avisoAlCliente(cerrado, AHORA)?.tono, 'warn', 'cerrado hace 5 min: el cron todavía no pasó dos veces');
  const roto = avisoAlCliente({ ...cerrado, resuelto_at: hace(AVISO_AL_CLIENTE_ATRASADO_MS + MIN), updated_at: hace(MIN) }, AHORA);
  assert.equal(roto?.tono, 'bad', 'cerrado hace más de 30 min y sin marca: ningún canal lo deja salir');
  assert.equal(AVISO_AL_CLIENTE_ATRASADO_MS, 30 * MIN, 'el doble de los 15 min del cron (vercel.json)');
  // La pregunta del equipo también se avisa.
  assert.equal(avisoAlCliente({ ...cerrado, estado: 'esperando_cliente' }, AHORA)?.tono, 'warn');
});

test('B2: `updated_at` se mueve al cambiar la prioridad: el atraso se cuenta desde el cierre, no desde el último toque', () => {
  const viejo = { estado: 'rechazado', avisado_at: null, decidido_at: hace(3 * 60 * MIN), resuelto_at: null, updated_at: hace(MIN) };
  assert.equal(avisoAlCliente(viejo, AHORA)?.tono, 'bad', 'rechazado hace 3 h, tocado hace 1 min: sigue sin avisarse');
  const sinFechas = { estado: 'duplicado', avisado_at: null, updated_at: hace(2 * 60 * MIN) };
  assert.equal(avisoAlCliente(sinFechas, AHORA)?.tono, 'bad', 'sin fechas de cierre se usa updated_at');
});

const runner = { despacho: 'runner', estado: 'en_curso', aviso_estado: null, aviso_intentos: 0, aviso_at: null, aviso_motivo: null };

test('B3: al Cerebro: entregado, tomado, sin acuse, no llegó, y el tope de intentos manda a mano', () => {
  assert.equal(entregaAlCerebro({ ...runner, despacho: 'firmado' }, AHORA), null, 'lo firmado por Martín no pasa por el Runner');
  assert.equal(entregaAlCerebro({ ...runner, despacho: null }, AHORA), null);
  assert.equal(entregaAlCerebro({ ...runner, aviso_estado: 'entregado', aviso_at: hace(MIN) }, AHORA)?.texto, 'Entregado al Cerebro');
  assert.equal(entregaAlCerebro(runner, AHORA)?.tono, 'warn', 'sin intento: lo espera un Runner');
  assert.equal(entregaAlCerebro({ ...runner, estado: 'resuelto' }, AHORA), null, 'ya cerrado y sin intento: nada que decir');
  assert.equal(entregaAlCerebro({ ...runner, aviso_estado: 'tomado', aviso_intentos: 1, aviso_at: hace(MIN) }, AHORA)?.tono, 'neutral');
  assert.equal(entregaAlCerebro({ ...runner, aviso_estado: 'tomado', aviso_intentos: 1, aviso_at: hace(ENTREGA_TOMADO_VENCE_MS + MIN) }, AHORA)?.tono, 'warn');
  const falla = entregaAlCerebro({ ...runner, aviso_estado: 'no_entregado', aviso_intentos: 2, aviso_motivo: 'el Cerebro no está abierto' }, AHORA);
  assert.deepEqual([falla?.tono, falla?.texto], ['warn', 'No llegó al Cerebro, se reintenta (2 de 5) — el Cerebro no está abierto']);
  const rendido = entregaAlCerebro({ ...runner, aviso_estado: 'incierto', aviso_intentos: ENTREGA_MAX_INTENTOS }, AHORA);
  assert.equal(rendido?.tono, 'bad');
  assert.match(rendido?.texto ?? '', /mándaselo a mano/);
});

test('B4: el mazo viejo: «llegó» sólo vale para ESA respuesta, y se ve entregado, avisando, sin acuse, no llegó', () => {
  const base = { recogidaAt: null, respondidaAt: hace(10 * MIN), avisoDe: hace(10 * MIN), avisoEstado: 'entregado' as const, avisoAt: hace(9 * MIN), avisoIntentos: 1 };
  assert.equal(vistaDelAviso(base, AHORA).texto, 'Aviso entregado');
  assert.equal(vistaDelAviso({ ...base, recogidaAt: hace(MIN) }, AHORA).texto, 'El chat ya la tiene', 'lo de antes se conserva');
  // Martín cambió la respuesta después del aviso: el estado es de la anterior.
  assert.equal(vistaDelAviso({ ...base, respondidaAt: hace(MIN) }, AHORA).texto, 'Nueva');
  assert.equal(vistaDelAviso({ ...base, avisoDe: null, avisoEstado: null }, AHORA).texto, 'Nueva');
  assert.equal(vistaDelAviso({ ...base, avisoEstado: 'tomado' }, AHORA).texto, 'Avisando…');
  assert.equal(vistaDelAviso({ ...base, avisoEstado: 'tomado', avisoAt: hace(AVISO_TOMADO_VENCE_MS + MIN) }, AHORA).tono, 'warn');
  assert.equal(vistaDelAviso({ ...base, avisoEstado: 'no_entregado' }, AHORA).texto, 'No llegó, reintenta');
  const rendido = vistaDelAviso({ ...base, avisoEstado: 'incierto', avisoIntentos: AVISO_MAX_INTENTOS }, AHORA);
  assert.deepEqual([rendido.tono, rendido.texto], ['bad', 'No llegó (5 intentos)']);
});

test('B5: la bandeja dibuja los dos avisos y marca en la lista el ticket cuyo aviso no salió', () => {
  const src = leer('app/tickets/bandeja/BandejaTickets.tsx');
  assert.match(src, /avisoAlCliente\(t, ahora\)/);
  assert.match(src, /entregaAlCerebro\(t, ahora\)/);
  assert.match(src, /aria-label="Avisos"/);
  // Desde el 22/10 la lista es la TABLA (app/tickets/bandeja/TablaTickets.tsx, tests/ticketera-mazo.test.ts).
  assert.match(leer('app/tickets/bandeja/TablaTickets.tsx'), /avisoAlCliente\(t, ahoraLista\)\?\.tono === 'bad' \? ' · ⚠ sin avisar'/, 'la tabla lo muestra sin abrir el ticket');
  // La columna que hace falta para el tope de «tomado» se lee: sin ella el Cerebro siempre parecería «sin acuse».
  // ⚠️ Se mira columna por columna y NO el texto `aviso_at, arreglado_at` de antes: ese pedía que fueran VECINAS en el select,
  // y el 6/11 meter `cerebro_*` en el medio (para «Entregado al Cerebro» de lo que espera a Martín) lo puso rojo sin que
  // faltara ninguna. Lo que importa es que estén pedidas, no en qué orden.
  const cols = /^const COLS = '([^']+)';$/m.exec(leer('lib/tickets-db.ts'))?.[1] ?? '';
  const pedidas = cols.split(',').map((c) => c.trim());
  for (const c of ['aviso_estado', 'aviso_intentos', 'aviso_motivo', 'aviso_at']) {
    assert.ok(pedidas.includes(c), `COLS no pide ${c}`);
  }
});
