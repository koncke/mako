// =============================================================================
// Hijo de tests/respuesta-al-equipo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La entrada REAL del grupo (`manejarEntranteDoer`, lib/mako-doer-in.ts) con el caso de Leila (ws11, 28/10/2026) y lo que
// encontró la verificación de 5b7a1917d, contra un PostgREST de mentira. Los mensajes van en la forma REAL de Evolution v2
// (`message.conversation` y el `contextInfo` en el nivel de arriba). Lo que sale a Evolution se ANOTA y contesta 200.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

// El turno NO espera el reloj: la ventana de silencio de verdad (8-20 s por escena, y acá son varias) hacía que este
// archivo tardara MINUTOS y el vigía de tandas de tests-afectados matara la tanda entera con 99 — ver
// lib/mako-doer-buffer.ts, «EL RELOJ DE LA VENTANA». El lote se junta igual: ya está en la cola cuando el turno espera.
process.env.MAKO_DOER_VENTANA_MS = '0';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

const JID = '120363000000000011@g.us';
const SA = '120363000000000099@g.us';
const WS = 11;
const LINEA = 'mako_superadmin_x';
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'mako_doer_buffer', 'mako_doer_lock', 'mako_doer_conv', 'mako_doer_enviados', 'anthropic_usage', 'errores_app', 'tickets', 'tickets_eventos', 'mako_acciones_pendientes'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
  unicos: [{ tabla: 'mako_doer_buffer', columnas: ['grupo_jid', 'wa_message_id'], donde: (f) => f.wa_message_id !== '', nombre: 'ux_doer_buffer_msg' }],
});
const red: Array<{ camino: string; cuerpo: string }> = [];
let fallaAvisadas = false;
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    // La lectura del registro de re-entregas que falla (la verificación de c358fd0c4): la respuesta no se pierde.
    if (fallaAvisadas && (init.method ?? 'GET') === 'GET' && u.pathname.endsWith('/app_settings') && u.search.includes('mako.equipo.respuestas')) {
      return new Response(JSON.stringify({ message: 'se cayó la base' }), { status: 503, headers: { 'content-type': 'application/json' } });
    }
    return pg.responder(u, init);
  }
  red.push({ camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  return new Response(JSON.stringify({ key: { id: `env-${red.length}` } }), { status: 200, headers: { 'content-type': 'application/json' } });
}) as typeof fetch;

const LEILA = '5215500000000@s.whatsapp.net';
const SOFI = '5215500000001@s.whatsapp.net';
const RESPUESTA = 'Nadia es su proporcional en mxn son 6 meses de 12000 y luego a 10000';

async function main() {
  const { FIRMA_DESARROLLADOR } = await import('../lib/aviso-arreglo-reglas');
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: WS, capa: 'cliente', nombre: 'Leila' }, { id: 1, capa: 'cliente', nombre: 'Dueño' });
  pg.db.app_settings.push(
    { workspace_id: WS, key: 'mako.grupo_jid', value: JID },
    { workspace_id: 1, key: 'mako.voz.instancia', value: LINEA },
    { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: SA },
  );
  const { manejarEntranteDoer } = await import('../lib/mako-doer-in');
  const out: Record<string, unknown> = {};
  const cola = () => pg.db.mako_doer_buffer.map((f) => String(f.wa_message_id));
  const reacciones = () => red.filter((x) => x.camino.includes('/message/sendReaction/')).length;
  const alSuperAdmin = () => red.filter((x) => x.camino.includes('/message/sendText/') && x.cuerpo.includes(SA)).length;
  const equipo = (id: string, texto: string) => manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id, fromMe: true }, message: { conversation: `${FIRMA_DESARROLLADOR}\n${texto}` } } as never);
  // La forma REAL de Evolution v2: `conversation` y el contextInfo (la cita) en el nivel de arriba.
  const de = (quien: string, nombre: string, id: string, texto: string, cita?: { stanzaId: string; quotedMessage: Record<string, unknown> }) =>
    manejarEntranteDoer(LINEA, { key: { remoteJid: JID, id, participant: quien }, message: { conversation: texto }, ...(cita ? { contextInfo: { ...cita, participant: LINEA } } : {}), pushName: nombre } as never);
  const paso = async (k: string, f: () => Promise<unknown>) => {
    red.splice(0);
    const antes = cola().length;
    const r = await f();
    // El 👍 sale SIN esperar (lib/mako-doer-in.ts: `reaccion`): se deja que termine antes de contar, o cae en el paso siguiente.
    // Desde el 4/11/2026 cada escritura mira primero el freno de la línea (lib/linea-freno.ts), y eso lo corría un poco.
    await new Promise((res) => setTimeout(res, 30));
    out[k] = { r, entro: cola().length > antes, reacciones: reacciones(), superAdmin: alSuperAdmin() };
  };

  // 1. La pregunta del equipo, a Leila.
  await equipo('EQ-1', 'Leila, para cargar el plan de Nadia: ¿cuántas quincenas eran y en qué moneda?');
  // 2. OTRA persona escribe otra cosa: es para MaKo.
  await paso('otraPersona', () => de(SOFI, 'Sofi', 'SO-1', 'Nadia arranca el lunes'));
  // 3. Leila contesta sin citar: al equipo. La ventana se cierra.
  await paso('respuesta', () => de(LEILA, 'Leila', 'LE-1', RESPUESTA));
  // 4. La re-entrega del mismo mensaje: nada (ni otro aviso, ni a MaKo).
  await paso('reentrega', () => de(LEILA, 'Leila', 'LE-1', RESPUESTA));
  // 5. Lo siguiente de Leila, con la ventana cerrada: para MaKo.
  await paso('despues', () => de(LEILA, 'Leila', 'LE-2', 'y Nadia arranca el lunes'));
  // 6. Leila CITA la pregunta del equipo (forma v2, arriba): al equipo.
  await paso('citada', () => de(LEILA, 'Leila', 'LE-3', 'Perfecto, eso mismo. Avísenme cuando esté', { stanzaId: 'EQ-1', quotedMessage: { conversation: `${FIRMA_DESARROLLADOR}\n¿cuántas quincenas eran?` } }));
  // 7. Otra pregunta, y la respuesta que ADEMÁS pide algo: a los dos.
  await equipo('EQ-2', 'Leila, ¿la moneda es MXN?');
  await paso('mezclada', () => de(LEILA, 'Leila', 'LE-4', 'Son 6 quincenas en mxn. Y pásame el resumen de cobros de la semana'));
  // 8. Un aviso del equipo sin pregunta, con un link que trae «?»: no abre ninguna ventana.
  await equipo('EQ-3', 'Ya está: conecta Meta con Zernio desde https://hola-mako.com/integraciones?abrir=zernio&ws=11');
  await paso('link', () => de(LEILA, 'Leila', 'LE-5', 'Si contacte Eli'));
  // 9. El payload de Leandro con una pregunta del equipo viva: cita un AUDIO (no al equipo), es para MaKo.
  await equipo('EQ-4', 'Leila, ¿nos confirmás si el flujo es el de pruebafm?');
  await paso('audioCitado', () => de(LEILA, 'Leila', 'LE-6', 'No me respondiste lo de este audio', { stanzaId: 'AUD-1', quotedMessage: { audioMessage: { seconds: 94 } } }));
  // 10. Un «gracias» con la pregunta todavía abierta: es un acuse (👍, sin turno), no una respuesta al equipo.
  await paso('gracias', () => de(LEILA, 'Leila', 'LE-7', 'gracias'));
  // 10a. Un «dale» con la pregunta todavía abierta: ES la respuesta al equipo, no un acuse (la verificación de c358fd0c4).
  await paso('dale', () => de(LEILA, 'Leila', 'LE-7b', 'dale'));
  // 10b. El aviso de ARREGLO cita el título del ticket, que es una pregunta (la verificación de c358fd0c4): no abre la ventana.
  //      Con la pregunta a Leila (EQ-4) todavía viva, lo que escribe OTRA persona es para MaKo.
  await equipo('EQ-5', 'Listo: lo de «¿Se pueden responder comentarios como ManyChat?» ya quedó. Pruébalo y me cuentas.');
  await paso('avisoArreglo', () => de(SOFI, 'Sofi', 'SO-2', 'Tal cual como lo hace manychat'));
  // 10c. Otra pregunta, y la respuesta con el registro de re-entregas que no se puede leer: el aviso sale igual.
  await equipo('EQ-6', 'Leila, ¿la cuota es en pesos?');
  fallaAvisadas = true;
  await paso('sinRegistro', () => de(LEILA, 'Leila', 'LE-7c', 'sí, en pesos mexicanos'));
  fallaAvisadas = false;
  // 10d. La ALTA 2 (la verificación de c358fd0c4): el equipo le pregunta a Leila y ella, sin citar, le PIDE algo a MaKo (sus textos
  //      reales del 26/10). Es para MaKo (👍 y a la cola, sin aviso al equipo) y la pregunta sigue abierta: su respuesta de verdad,
  //      después, va al equipo.
  await equipo('EQ-7', 'Leila, para cargar el plan de Nadia: ¿cuántas quincenas eran y en qué moneda?');
  await paso('pedido', () => de(LEILA, 'Leila', 'LE-9', 'Quiero saber porque Nadya Calderon no aparece para agregarla'));
  await paso('queja', () => de(LEILA, 'Leila', 'LE-10', 'aquí no me deja editar que son 423, no 4235'));
  await paso('anota', () => de(LEILA, 'Leila', 'LE-11', 'Ah y otra cosa, anotá que Nadia arranca el lunes'));
  await paso('respuestaDespues', () => de(LEILA, 'Leila', 'LE-12', RESPUESTA));
  // 11. De control: MaKo habló DESPUÉS de la pregunta; un mensaje sin nombrarla es para MaKo.
  pg.db.mako_doer_conv.push({ id: ++n, workspace_id: WS, grupo_jid: JID, role: 'assistant', content: 'Hoy entraron 4 leads.', created_at: new Date(Date.now() + 1000).toISOString() });
  await paso('makoHablo', () => de(LEILA, 'Leila', 'LE-8', 'es el de pruebafm, sí'));
  const anillo = pg.db.app_settings.find((x) => x.workspace_id === WS && x.key === 'mako.equipo.grupo');
  out.anillo = anillo ? (JSON.parse(String(anillo.value)) as Array<{ id?: string; respondida?: boolean; para?: unknown }>).map((d) => ({ id: d.id, respondida: !!d.respondida, para: d.para ?? null })) : [];
  process.stdout.write(`@@EQUIPO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@EQUIPO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
