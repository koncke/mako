// =============================================================================
// Hijo de tests/agenda-google-grupo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre los runners REALES de `crear_evento_google` y `proponer_agendar_agenda` con el contexto del grupo de WhatsApp. Google va
// de mentira con `mock.module`: lo que se mira es qué se propone, qué se le pide a Google con el «sí» y qué se dice cuando falta
// la conexión o el permiso. Nada sale a la red. Necesita `--conditions=react-server` y `--experimental-test-module-mocks`.
// =============================================================================

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = join(__dirname, '..');
let permiso = { conectado: true, puedeMover: true, email: 'dueno@negocio.test' };
const eventosGoogle: Array<{ calendario: string; titulo: unknown; fecha: unknown; hora: unknown }> = [];
const reuniones: Array<{ titulo: unknown; emailInvitado: unknown }> = [];

const reales = readFileSync(join(RAIZ, 'lib/google-calendar.ts'), 'utf8');
const nombres = [...reales.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
const sinMock: Record<string, unknown> = {};
for (const n of nombres) sinMock[n] = () => { throw new Error(`google-calendar: ${n} sin mock`); };
const permisoFalso = async () => permiso;
// La MISMA lógica que el módulo real: el test la mira en el .ts (agenda-google-grupo.test.ts), acá sólo se le cambia el permiso.
const agendaFalsa = async () => {
  if (!permiso.conectado) return 'Este negocio no tiene una agenda de Google conectada. Se conecta desde Calendario (o con el link de link_configurar_integracion, servicio google).';
  if (!permiso.puedeMover) return 'La agenda de Google está conectada con permiso de solo lectura: hay que reconectarla en Integraciones para poder agendar o mover.';
  return null;
};
mock.module(pathToFileURL(join(RAIZ, 'lib/google-calendar.ts')).href, {
  namedExports: {
    ...sinMock,
    permisoCalendarioGoogle: permisoFalso,
    agendaParaEscribir: agendaFalsa,
    googleCalendarConectado: async () => permiso.conectado,
    choquesEnAgenda: async () => [],
    eventosDelDia: async () => ({ ok: true, eventos: [] }),
    crearEventoDeReunion: async (p: { titulo: unknown; emailInvitado: unknown }) => { reuniones.push(p); return { ok: true, codigo: 'ok', accion: 'creado' }; },
  },
});
mock.module(pathToFileURL(join(RAIZ, 'lib/calendario-google.ts')).href, {
  namedExports: {
    agendaParaEscribir: agendaFalsa,
    crearEventoGoogle: async (calendario: string, e: { titulo: unknown; fecha: unknown; hora: unknown }) => {
      eventosGoogle.push({ calendario, titulo: e.titulo, fecha: e.fecha, hora: e.hora });
      return { ok: true, id: 'evento-1' };
    },
  },
});

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
globalThis.fetch = (async () => new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch;

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { runnerDe } = await import('../lib/api-mako/runners');
  const ctx = { ws: 13, canal: 'whatsapp', canalKey: 'g@test', alcance: 'ejecutar', rol: 'admin', turnStart: Date.now(), mensajeUsuario: 'x', actor: 'test' };
  type R = {
    preparar: (i: Record<string, unknown>, c: typeof ctx) => Promise<Record<string, unknown>>;
    ejecutar: (p: unknown, c: typeof ctx) => Promise<Record<string, unknown>>;
  };
  const google = runnerDe('crear_evento_google') as unknown as R;
  const agendar = runnerDe('proponer_agendar_agenda') as unknown as R;
  const enWs = <T,>(fn: () => Promise<T>) => runWithWorkspace(13, fn);
  const pedido = { titulo: 'Firma', fecha: '2031-03-14', hora: '09:00', duracionMin: 60 };
  const pedidoAgenda = { titulo: 'Firma', fecha: '2031-03-14', hora: '09:00' };
  const out: Record<string, unknown> = {};

  // Conectado: lo propone y, con el «sí», queda en Google.
  const prep = await enWs(() => google.preparar(pedido, ctx));
  out.googlePrep = prep;
  out.googleEjec = await enWs(() => google.ejecutar(prep.payload, ctx));
  out.googleEventos = [...eventosGoogle];
  const prepA = await enWs(() => agendar.preparar(pedidoAgenda, ctx));
  out.agendarPrep = prepA;
  out.agendarEjec = await enWs(() => agendar.ejecutar(prepA.payload, ctx));
  out.agendarReuniones = [...reuniones];

  // Sin conexión: dice cuál falta y no le pide nada a Google.
  permiso = { conectado: false, puedeMover: false, email: null as unknown as string };
  eventosGoogle.length = 0;
  out.googleSinConexion = await enWs(() => google.preparar(pedido, ctx));
  out.agendarSinConexion = await enWs(() => agendar.preparar(pedidoAgenda, ctx));

  // Con permiso de sólo lectura, lo mismo.
  permiso = { conectado: true, puedeMover: false, email: 'dueno@negocio.test' };
  out.googleSoloLectura = await enWs(() => google.preparar(pedido, ctx));
  out.eventosSinPermiso = [...eventosGoogle];

  process.stdout.write(`@@JSON@@${JSON.stringify(out)}@@FIN@@`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
