// =============================================================================
// Hijo de tests/chat-app-hilo.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// EL CASO: una entrevista del Marketing CoPilot de ayer a la noche, larga (unos 15.000 tokens, el doble de lo que entra entero), con
// el ticket y el presupuesto dichos al principio y una lectura de cobros al final. Hoy a la mañana la persona vuelve: «Buenas,
// retomemos: ¿con cuánto arranco los anuncios?». Lo que corre de verdad: `conversacionDelTurno` (lib/conversacion.ts) con el adaptador
// de la app, y `resumirConversacion` (lib/conversacion-resumen.ts) con su candado y su compare-and-set contra un PostgREST de mentira.
// El modelo del resumen es de mentira: escribe lo que le piden que quede (un modelo que cumple) o se olvida de un monto (uno que no).
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';
for (const k of ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GROQ_API_KEY']) delete process.env[k];

const WS = 3;
let n = 0;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
  candado: true,
});
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host);
  return new Response('{}', { status: 404 });
}) as typeof fetch;

const AYER = Date.parse('2026-11-11T22:00:00Z'); // 19:00 en Argentina
const HOY = Date.parse('2026-11-12T15:00:00Z'); // 12:00 en Argentina, más de 15 h después del último mensaje
const relleno = (tema: string, palabras: number) => `${tema}. ${Array.from({ length: palabras }, (_, i) => ['el', 'anuncio', 'de', 'prueba', 'mide', 'el', 'costo', 'por', 'conversación'][i % 9]).join(' ')}.`;
const COPILOT = '[desde: Marketing CoPilot]\n';
type Fila = { id: number; role: 'user' | 'assistant'; content: string; created_at: string; bloques?: unknown };
const filas: Fila[] = [];
const decir = (role: 'user' | 'assistant', content: string, bloques?: unknown) => {
  filas.push({ id: filas.length + 1, role, content: role === 'user' ? `${COPILOT}${content}` : content, created_at: new Date(AYER + filas.length * 3 * 60_000).toISOString(), ...(bloques ? { bloques } : {}) });
};
// La apertura del CoPilot y lo que la persona dijo al principio: lo que el corte de 12 mensajes perdía.
decir('assistant', '¿Cuánto te deja una venta, en dólares?');
decir('user', 'Unos US$1.500 por cliente, es una mentoría de tres meses para Nico Sellers y gente como él.');
decir('assistant', '¿Y cuánto puedes invertir en anuncios por mes, para arrancar?');
decir('user', 'US$300 al mes, no más. Vendo por WhatsApp, con llamada.');
// La charla larga del medio: la estrategia, pieza por pieza.
for (let i = 0; i < 22; i++) decir(i % 2 ? 'user' : 'assistant', i % 2 ? `Ok, sigamos con la ${i}` : relleno(`Parte ${i} de la estrategia para la mentoría`, 900));
// Al final, MaKo leyó los cobros (lo que leyó vuelve en la historia: «Lo que leí»).
decir('user', '¿Y cuánto me entró este mes?');
decir('assistant', 'Este mes te entraron dos pagos.', [{ k: 'leido', texto: 'ver_cobros: 81 «Nico Sellers», 82 «Ana Gómez» — total del mes US$3.000' }]);

const BUENO = async ({ user }: { user: string }) => {
  // Un modelo que cumple: escribe lo que el pedido dice que tiene que quedar.
  const montos = /- Montos: (.*)/.exec(user)?.[1] ?? '';
  const nombres = /- Nombres: (.*)/.exec(user)?.[1] ?? '';
  return JSON.stringify({ resumen: `Entrevista del CoPilot para una mentoría de tres meses. Montos dichos: ${montos}. Nombres: ${nombres}. Vende por WhatsApp con llamada.` });
};
const SIN_MONTO = async () => JSON.stringify({ resumen: 'Entrevista del CoPilot para una mentoría. Vende por WhatsApp.' });

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { conversacionDelTurno } = await import('../lib/conversacion');
  const { resumirConversacion, KEY_CANDADO_RESUMEN } = await import('../lib/conversacion-resumen');
  const { KEY_RESUMEN, leerResumen } = await import('../lib/conversacion-resumen-reglas');
  const { claveDeLaApp, entradasDeLaApp, historialDeTurnos } = await import('../lib/chat-app-hilo');
  const { historialParaModelo } = await import('../lib/mako-turno-app-reglas');
  pg.db.workspaces.push({ id: WS, capa: 'cliente', nombre: 'Prueba', estado: 'activo' });
  const clave = claveDeLaApp(77, 'Marketing CoPilot');
  const entradas = entradasDeLaApp(filas);
  const fila = (k: string) => pg.db.app_settings.find((f) => f.workspace_id === WS && f.key === k) ?? null;
  const out: Record<string, unknown> = { clave };

  await runWithWorkspace(WS, async () => {
    // ── Ayer a la noche, después del último mensaje: lo que no entra se resume (lo que corre en `after()`) ──
    const ayer = await conversacionDelTurno({ canal: 'app', ws: WS, clave, entradas, ventanaMs: null, conResumen: true, ahoraMs: AYER + 90 * 60_000 });
    out.ayer = { turnos: ayer?.turnos.length ?? 0, porResumir: ayer?.porResumir.length ?? 0, primeroPorResumir: ayer?.porResumir[0]?.id ?? null };
    // Otra corrida tiene el candado (fresco): ésta no paga un segundo resumen.
    pg.db.app_settings.push({ workspace_id: WS, key: KEY_CANDADO_RESUMEN(clave), value: JSON.stringify({ at: AYER + 89 * 60_000 }) });
    out.conCandado = (await resumirConversacion({ clave, porResumir: ayer!.porResumir, pedir: BUENO, ahoraMs: AYER + 90 * 60_000 })).r;
    // El modelo que se olvida de un monto: no se guarda nada (y el candado vencido de antes se toma y se suelta).
    out.sinMonto = await resumirConversacion({ clave, porResumir: ayer!.porResumir, pedir: SIN_MONTO, ahoraMs: AYER + 100 * 60_000 });
    out.trasSinMonto = { resumen: fila(KEY_RESUMEN(clave)) != null, candado: fila(KEY_CANDADO_RESUMEN(clave)) != null };
    // El que cumple: queda guardado y el candado se suelta.
    let pedido = '';
    out.bueno = (await resumirConversacion({ clave, porResumir: ayer!.porResumir, pedir: async (p) => { pedido = p.user; return BUENO(p); }, tz: 'America/Argentina/Buenos_Aires', ahoraMs: AYER + 101 * 60_000 })).r;
    const guardado = leerResumen(String(fila(KEY_RESUMEN(clave))?.value ?? ''));
    out.guardado = guardado ? { texto: guardado.texto, hastaId: guardado.hastaId } : null;
    out.candadoSuelto = fila(KEY_CANDADO_RESUMEN(clave)) == null;
    out.pedidoTieneElTicket = /- Montos: .*US\$1\.500/.test(pedido);
    // Dos a la vez sobre lo ya resumido: no hay nada que resumir.
    out.otraVez = (await resumirConversacion({ clave, porResumir: ayer!.porResumir, pedir: BUENO, ahoraMs: AYER + 102 * 60_000 })).r;

    // ── Hoy a la mañana: «Buenas, retomemos» ──
    const hoy = await conversacionDelTurno({ canal: 'app', ws: WS, clave, entradas, ventanaMs: null, conResumen: true, ahoraMs: HOY });
    const historial = historialDeTurnos(hoy?.turnos ?? []);
    const enteros = (hoy?.turnos ?? []).map((t) => t.content).join('\n');
    out.hoy = {
      resumen: hoy?.resumen ?? null, turnos: historial.length, primerRol: historial[0]?.role ?? null,
      conLoLeido: /\[Lo que leí: ver_cobros: 81 «Nico Sellers».*US\$3\.000\]/.test(enteros),
      porResumir: hoy?.porResumir.length ?? 0,
      // El ticket: en el resumen o entero, pero en algún lado.
      sabeElTicket: /US\$1\.500/.test(`${hoy?.resumen ?? ''}\n${enteros}`),
    };
    // Lo de antes, para comparar: la ventana de 14 h de los grupos no deja nada de anoche, y los 12 mensajes no tienen el ticket.
    const conVentana = await conversacionDelTurno({ canal: 'app', ws: WS, clave, entradas, ahoraMs: HOY });
    out.conLaVentanaDeLosGrupos = conVentana?.turnos.length ?? 0;
    out.losDoceDeAntes = /US\$1\.500/.test(historialParaModelo(filas.map(({ role, content }) => ({ role, content })), 12).map((m) => m.content).join('\n'));
  });
  out.red = red;
  process.stdout.write(`@@CONV@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@CONV@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
