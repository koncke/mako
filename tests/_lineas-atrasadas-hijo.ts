// =============================================================================
// Hijo de tests/lineas-atrasadas.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `vigilarDemoraDeLaLinea` REAL (lib/canal-vigilante.ts) con las tandas medidas la noche del 11/11/2026 en `wa_mensajes`: ws21
// (Florencia Carballo) recibió a las 21:52 lo mandado el 10/11 14:28; ws20 (Sergio Arriata) a las 22:26 lo del 10/11 16:25; ws22
// (Patricia Contreras) a las 22:25 lo del 10/11 20:55. ws19 al día, con un volcado del importador (un mes atrás, `raw.id`) y un
// evento viejo; ws10 al día con UNA persona que escribió sin señal; ws18 recién vinculada (lo encolado llega viejo). Evolution, Resend
// y la base son de mentira; lo que sale a la red se ANOTA.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-de-32-caracteres-o-mas-para-el-test';
process.env.EVOLUTION_BASE_URL = 'http://evolution.test';
process.env.EVOLUTION_API_KEY = 'evo-de-prueba';
process.env.RESEND_API_KEY = 're_de_prueba';
process.env.NEXT_PUBLIC_APP_URL = 'https://hola-mako.com';

let n = 100_000;
const pg = crearPostgrest({
  tablas: ['app_settings', 'workspaces', 'credenciales', 'notificaciones', 'evolution_instancias', 'notif_destinatarios', 'usuarios', 'workspace_miembros', 'wa_mensajes', 'mako_doer_buffer'],
  defaults: (_t, f) => ({ id: ++n, created_at: new Date().toISOString(), ...f }),
});
const vinculos: Record<string, { createdAt: string; disconnectionAt: string | null }> = {
  mako_ws10: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
  mako_ws18: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: '2026-11-11T22:30:00.000Z' }, // re-vinculada hace 10 min
  mako_ws19: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
  mako_ws20: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
  mako_ws21: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
  mako_ws22: { createdAt: '2026-10-19T11:57:08.000Z', disconnectionAt: null },
};
const red: Array<{ host: string; camino: string; cuerpo: string }> = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push({ host: u.host, camino: u.pathname, cuerpo: typeof init.body === 'string' ? init.body : '' });
  const r = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (u.host === 'evolution.test' && u.pathname.includes('/instance/fetchInstances')) return r(200, Object.entries(vinculos).map(([name, v]) => ({ name, connectionStatus: 'open', ...v })));
  if (u.host === 'evolution.test') return r(200, {});
  if (u.host === 'api.resend.com') return r(200, { id: `mail-${red.length}` });
  return r(500, { error: 'red de mentira' });
}) as typeof fetch;

const ISO = (ms: number) => new Date(ms).toISOString();
/** `cuantos` mensajes entrantes de una línea: llegaron a partir de `llego`, mandados a partir de `mandado`, uno por minuto. */
const tanda = (inst: string, ws: number, llego: string, mandado: string, cuantos: number, extra: Record<string, unknown> = {}) => {
  for (let i = 0; i < cuantos; i++) {
    pg.db.wa_mensajes.push({ id: ++n, instance_name: inst, workspace_id: ws, from_me: false, tipo: 'text', importado: null, created_at: ISO(Date.parse(llego) + i * 2000), wa_timestamp: ISO(Date.parse(mandado) + i * 60_000), ...extra });
  }
};

async function main() {
  pg.db.workspaces.push({ id: 9, capa: 'superadmin', nombre: 'MaKo' }, { id: 1, capa: 'cliente', nombre: 'Dueño' },
    { id: 10, capa: 'cliente', nombre: 'Leila' }, { id: 18, capa: 'cliente', nombre: 'Negocio 18' }, { id: 19, capa: 'cliente', nombre: 'Negocio 19' },
    { id: 20, capa: 'cliente', nombre: 'Sergio Arriata' }, { id: 21, capa: 'cliente', nombre: 'Florencia Carballo' }, { id: 22, capa: 'cliente', nombre: 'Patricia Contreras' });
  // Las tandas medidas.
  tanda('mako_ws21', 21, '2026-11-11T21:52:00Z', '2026-11-10T14:28:00Z', 6);
  tanda('mako_ws20', 20, '2026-11-11T22:26:38Z', '2026-11-10T16:25:00Z', 6);
  tanda('mako_ws22', 22, '2026-11-11T22:25:47Z', '2026-11-10T20:55:00Z', 5);
  // ws19 al día, con lo que trae el importador (un mes atrás, con el `id` de Evolution) y un evento viejo.
  tanda('mako_ws19', 19, '2026-11-11T22:00:00Z', '2026-11-11T21:59:57Z', 8);
  tanda('mako_ws19', 19, '2026-11-11T22:10:00Z', '2026-10-11T10:00:00Z', 30, { importado: 'cmh8k2x0a00ab' });
  tanda('mako_ws19', 19, '2026-11-11T22:11:00Z', '2026-11-09T10:00:00Z', 4, { tipo: 'evento' });
  // ws10 al día; una persona escribió sin señal y llegó 3 h tarde.
  tanda('mako_ws10', 10, '2026-11-11T21:00:00Z', '2026-11-11T20:59:58Z', 3);
  tanda('mako_ws10', 10, '2026-11-11T21:30:00Z', '2026-11-11T18:30:00Z', 1);
  // ws18 recién re-vinculada (22:30): lo que WhatsApp tenía encolado entra a las 22:35 con un día de atraso.
  tanda('mako_ws18', 18, '2026-11-11T22:35:00Z', '2026-11-10T22:00:00Z', 5);
  // Salientes viejos (no cuentan: son de la empresa).
  tanda('mako_ws21', 21, '2026-11-11T22:00:00Z', '2026-11-09T10:00:00Z', 5, { from_me: true });

  const { vigilarDemoraDeLaLinea } = await import('../lib/canal-vigilante');
  const out: Record<string, unknown> = {};
  let vistas = 0;
  const corrida = async (k: string, iso: string) => {
    red.splice(0);
    const r = await vigilarDemoraDeLaLinea(Date.parse(iso));
    const nuevas = pg.db.notificaciones.slice(vistas);
    vistas = pg.db.notificaciones.length;
    out[k] = {
      lineas: r.lineas,
      mails: red.filter((x) => x.host === 'api.resend.com').map((x) => { const b = JSON.parse(x.cuerpo || '{}') as { subject?: string; text?: string }; return { asunto: b.subject ?? '', cuerpo: b.text ?? '' }; }),
      whatsapp: red.filter((x) => x.camino.includes('/message/send')).length,
      campanita: nuevas.map((f) => ({ titulo: String(f.titulo), severidad: f.severidad, entidad: f.entity_id, ws: f.workspace_id })),
      marcas: JSON.parse(String(pg.db.app_settings.find((s) => s.key === 'mako.lineas.atrasadas')?.value || '{}')),
    };
  };
  await corrida('primera', '2026-11-11T22:40:00Z');
  await corrida('diezMin', '2026-11-11T22:50:00Z');
  // 3 h después lo de antes ya salió de la ventana; ws21 recibe al día (medida sana), ws20 y ws22 no reciben nada (no se miden).
  tanda('mako_ws21', 21, '2026-11-12T01:30:00Z', '2026-11-12T01:29:57Z', 4);
  await corrida('ws21Volvio', '2026-11-12T02:00:00Z');
  process.stdout.write(`@@ATRASO@@${JSON.stringify(out)}\n`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@ATRASO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}\n`); process.exit(0); });
