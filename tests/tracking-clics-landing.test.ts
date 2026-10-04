// =============================================================================
// Los clics de la landing LLEGAN a la ficha del lead, y dicen QUÉ se clickeó
// =============================================================================
// Los clics estaban guardados desde la mig 0133 (`vsl_events.detalle` = el href o
// el texto del botón) y el lector los TIRABA: `getTrackingEvents` descartaba todo
// lo que no fuera play ni evento de video, con su porqué bien escrito —no
// disfrazar un evento de página de retención— y una nota que decía «el día que la
// tarjeta tenga un renglón propio para ellos, se agregan con su tipo». Ese día es
// este. O sea que no faltaba capturar nada: faltaba dejarlos pasar.
//
// Acá se prueban las dos mitades, y las dos EJECUTANDO:
//   · el LECTOR, con un Supabase de mentira, para que un clic real salga por la
//     salida de `getTrackingEvents` con su `detalle` intacto y los eventos de
//     página (salio/volvio/cierre) sigan afuera;
//   · la DECISIÓN del renglón (`textoDeClic`), que es la que se rompe sola: vive
//     de un prefijo y de un separador dentro de un string libre que escribe el
//     snippet del Pixel.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE, 04/10/2026. Con el código bueno: 6 de 6.
// Las SEIS roturas, una por una (siempre 6 tests en total):
//   · sacar `!esClick` de la guarda del lector (lib/leads.ts), o sea volver al
//     `continue` de antes                                      → 2 fallos / 4 pases
//   · pasar `detalle: null` en el push del clic (el campo viaja
//     en el tipo y no se enchufa: el caso del call site muerto) → 1 fallo  / 5 pases
//   · sacar `detalle` del `.select()` de vsl_events             → 1 fallo  / 5 pases
//   · en `textoDeClic`, quedarse con el DESTINO en vez del
//     texto del botón (`que: corto` siempre)                    → 2 fallos / 4 pases
//   · en `textoDeClic`, cortar con `lastIndexOf(' — ')` en vez
//     de `indexOf` (un botón con guion largo adentro)           → 1 fallo  / 5 pases
//   · buscar el prefijo como `'boton: '` CON el espacio         → 1 fallo  / 5 pases
// Restaurado: 6 de 6. Cada rotura se escribió con un script que se niega a tocar
// el archivo si el ancla no aparece exactamente una vez y que relee el disco para
// confirmar que la línea rota quedó puesta — una rotura que no toca el código no
// prueba nada, y esta casa ya pagó un `perl` que no matcheó y dio verde.
//
// ⚠️ La última de esas seis NO era un ensayo: el test la ENCONTRÓ. El snippet manda
// `'boton: ' + texto`, así que un botón sin texto (un ícono) llega como `boton: `
// pelado — y el `.trim()` de `textoDeClic` se come ese espacio. Con el prefijo
// escrito `'boton: '` ese caso no matchea, se va por el camino del link y el
// renglón sale «Hizo clic en boton:». El `esDeW` del snippet ya documenta que ese
// detalle vacío existe en producción.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { textoDeClic, destinoCorto } from '../app/crm/lead-view/clic-detalle';

// ── El Supabase de mentira ──────────────────────────────────────────────────
// `lib/leads.ts` es `server-only` (tira al importarse fuera de un Server
// Component) y pide su cliente a `./workspace`, que abre cookies y red. Se
// neutralizan los dos en el cargador de módulos: es el mismo truco que ya usa
// tests/mover-etapa-validacion.test.ts, estirado al cliente de la base.
//
// Las filas se sirven POR TABLA y se declaran en cada test. El `select` se
// guarda para poder afirmar que el lector pide la columna `detalle`: sin eso,
// PostgREST no la devuelve y el dato llega `undefined` sin un solo error.
type Fila = Record<string, unknown>;
const FILAS: Record<string, Fila[]> = {};
const SELECTS: Record<string, string> = {};

type Consulta = {
  select: (cols: string) => Consulta;
  eq: (...a: unknown[]) => Consulta;
  order: (...a: unknown[]) => Consulta;
  limit: (n: number) => Promise<{ data: Fila[]; error: null }>;
};

function tabla(nombre: string): Consulta {
  const q: Consulta = {
    select: (cols: string) => { SELECTS[nombre] = cols; return q; },
    eq: () => q,
    order: () => q,
    limit: (n: number) => Promise.resolve({ data: (FILAS[nombre] ?? []).slice(0, n), error: null }),
  };
  return q;
}

const workspaceFalso = {
  __esModule: true,
  getTenantDb: async () => ({ from: (t: string) => tabla(t) }),
  getWorkspaceActual: async () => 1,
  runWithWorkspace: (_ws: unknown, fn: () => unknown) => fn(),
  rutaConWs: async (href: string) => href,
  wsSuperAdmin: async () => 1,
  OWNER_WS: 1,
};

type Cargador = (pedido: string, padre: unknown, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const cargarOriginal = M._load;
M._load = ((pedido: string, padre: unknown, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  if (pedido === './workspace' || pedido === '@/lib/workspace') return workspaceFalso;
  return Reflect.apply(cargarOriginal, Module, [pedido, padre, esMain]);
}) as Cargador;

const leads = () => import('../lib/leads');

/** Las filas tal como las devuelve `vsl_events`, con los campos que el lector pide. */
const ev = (p: Partial<Fila> & { created_at: string; tipo_evento: string | null }): Fila => ({
  porcentaje: null, event: null, video_id: null, vsl_titulo: null, detalle: null, ...p,
});

function sembrar(visitas: Fila[], eventos: Fila[]) {
  for (const k of Object.keys(FILAS)) delete FILAS[k];
  for (const k of Object.keys(SELECTS)) delete SELECTS[k];
  FILAS.landing_visits = visitas;
  FILAS.vsl_events = eventos;
}

// ── EL LECTOR ───────────────────────────────────────────────────────────────

test('un clic llega a la salida del lector, con QUÉ se clickeó adentro', async () => {
  const { getTrackingEvents } = await leads();
  sembrar(
    [{ created_at: '2026-10-01T12:00:00.000Z', landing_url: 'https://ej.com/vsl', referrer: null }],
    [ev({
      created_at: '2026-10-01T12:03:00.000Z', tipo_evento: 'click',
      detalle: 'https://wa.me/5215512345678 — Confirmar por WhatsApp',
    })],
  );

  const out = await getTrackingEvents('vis-1');
  const clic = out.find((e) => e.tipo === 'click');
  assert.ok(clic, `el clic no salió del lector; tipos: ${out.map((e) => e.tipo).join(', ') || '(ninguno)'}`);
  assert.equal(clic.detalle, 'https://wa.me/5215512345678 — Confirmar por WhatsApp',
    'el clic salió sin su `detalle`: la tarjeta sólo podría decir que hubo un clic');
  // Y sigue siendo un merge cronológico: el clic es posterior a la visita.
  assert.deepEqual(out.map((e) => e.tipo), ['click', 'pageview'], 'el orden es descendente por fecha');
});

test('el lector pide la columna `detalle` a la base', async () => {
  // Sin ella PostgREST no la devuelve, el campo llega `undefined` y la ficha dice
  // «Hizo clic en la landing» para siempre. No falla nada: contesta de menos.
  const { getTrackingEvents } = await leads();
  sembrar([], [ev({ created_at: '2026-10-01T12:00:00.000Z', tipo_evento: 'click', detalle: 'boton: X' })]);
  await getTrackingEvents('vis-1');
  assert.match(SELECTS.vsl_events ?? '', /\bdetalle\b/,
    'getTrackingEvents dejó de pedir `detalle`: el dato existe en la base y no viaja');
});

test('lo que NO tiene renglón sigue afuera, y el clic no finge ser video', async () => {
  // El tiempo en la PÁGINA (salio/volvio/cierre) y el `agendo` siguen descartados
  // a propósito: sin renglón propio caerían en 'retencion', que la tarjeta escribe
  // como «Siguió mirando el VSL» sobre un lead del que nunca llegó un play.
  const { getTrackingEvents } = await leads();
  sembrar([], [
    ev({ created_at: '2026-10-01T12:05:00.000Z', tipo_evento: 'cierre', segundos: 90 }),
    ev({ created_at: '2026-10-01T12:04:00.000Z', tipo_evento: 'volvio', segundos: 60 }),
    ev({ created_at: '2026-10-01T12:03:00.000Z', tipo_evento: 'salio', segundos: 30 }),
    ev({ created_at: '2026-10-01T12:02:00.000Z', tipo_evento: 'agendo', detalle: 'calendly' }),
    ev({ created_at: '2026-10-01T12:01:00.000Z', tipo_evento: 'click', detalle: 'ancla #registro — Quiero mi diagnóstico', porcentaje: 0 }),
  ]);

  const out = await getTrackingEvents('vis-1');
  assert.deepEqual(out.map((e) => e.tipo), ['click'],
    'entró un evento de página a la línea de tiempo: se va a leer como «siguió mirando el VSL»');
  // Un clic no mide avance de video. Si llegara un 0 en la columna, la tarjeta
  // escribiría «Llegó al 0% del VSL»: la misma mezcla de unidades que `avanceDe`
  // ya tuvo que cortar (segundos de página convertidos en % de video).
  assert.equal(out[0].porcentaje, null, 'un clic no puede traer porcentaje');
  assert.equal(out[0].video_id, null);
  assert.equal(out[0].vsl_titulo, null);
});

// ── EL RENGLÓN ──────────────────────────────────────────────────────────────

test('el renglón dice la frase que la persona leyó, y el destino va al lado', () => {
  // Los tres formatos que escribe el snippet (lib/landing-token.ts, bloque CLICKS).
  const link = textoDeClic('https://wa.me/5215512345678 — Confirmar por WhatsApp');
  assert.equal(link.que, 'Hizo clic en «Confirmar por WhatsApp»');
  assert.equal(link.adonde, 'wa.me/5215512345678');

  const ancla = textoDeClic('ancla #registro — Quiero mi diagnóstico');
  assert.equal(ancla.que, 'Hizo clic en «Quiero mi diagnóstico»');
  assert.equal(ancla.adonde, '#registro');

  // Sin href el snippet manda `boton: <texto>` y no hay destino que mostrar.
  const boton = textoDeClic('boton: Agendar ahora');
  assert.equal(boton.que, 'Hizo clic en «Agendar ahora»');
  assert.equal(boton.adonde, null);

  // Un renglón de una lista es una frase de ~110 caracteres: el snippet topea el
  // texto del botón en 80, así que el techo real es 99. Si alguien sube ese tope,
  // este assert lo caza antes que la pantalla.
  const largo = textoDeClic('boton: ' + 'a'.repeat(80));
  assert.ok(largo.que.length <= 110, `el renglón se fue a ${largo.que.length} caracteres`);
});

test('un texto de botón con guion largo adentro viaja ENTERO', () => {
  // El separador es la PRIMERA aparición de ` — `, porque el destino va primero y
  // ni una URL ni un `ancla #x` pueden tener espacios. Cortando por la última, el
  // botón «Agendar — es gratis» se leería como el link `…/x — Agendar`.
  const r = textoDeClic('https://ej.com/agenda — Agendar — es gratis');
  assert.equal(r.que, 'Hizo clic en «Agendar — es gratis»');
  assert.equal(r.adonde, 'ej.com/agenda');
});

test('lo que no se puede leer se muestra crudo, nunca se inventa', () => {
  // Sin detalle (eventos anteriores a la mig 0133) hubo un clic y no sabemos en qué.
  assert.equal(textoDeClic(null).que, 'Hizo clic en la landing');
  assert.equal(textoDeClic('   ').que, 'Hizo clic en la landing');
  // El snippet puede mandar `boton: ` vacío: un botón sin texto, un ícono.
  assert.equal(textoDeClic('boton: ').que, 'Hizo clic en un botón');
  // Un href que no es una URL absoluta se muestra tal cual en vez de esconderse.
  assert.equal(textoDeClic('/gracias').que, 'Hizo clic en /gracias');
  // `tel:` y `mailto:` no tienen host: el pathname ES el dato.
  assert.equal(destinoCorto('tel:+5215512345678'), '+5215512345678');
  assert.equal(destinoCorto('mailto:hola@ej.com'), 'hola@ej.com');
  // Y la barra final no cuenta como ruta.
  assert.equal(destinoCorto('https://ej.com/'), 'ej.com');
});
