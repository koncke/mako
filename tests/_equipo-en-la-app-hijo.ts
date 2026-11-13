// =============================================================================
// Hijo de tests/equipo-en-la-app.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El equipo de MaKo escribe en el grupo de la APP de un cliente: el POST real con la sesión del super admin, y lo de después de responder. El arnés es tests/_grupos-ops-arnes.ts.

process.env.MAKO_DOER_VENTANA_MS = '0';
import { db, comoPersona, correrDespues, decirResultado, escena, escenaNueva, alModelo, pushes, sesionDe, usuario, OPENAI_NEGOCIO, PLATAFORMA } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10;
const JID = '120363000000000010@g.us', JID_SUPER = '120363000000000009@g.us';
const ANA = usuario(101, 'ana@fiesta.test', 'Ana', WS, 'admin');
const MARTIN = usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' });
const clase = (c: string) => JSON.stringify({ clase: c, resumen: 'lo que pide', reenviado: false });

function limpiar() {
  for (const t of ['grupo_mensajes', 'mako_doer_conv', 'mako_doer_buffer', 'mako_doer_lock', 'mako_acciones_pendientes', 'tickets', 'insistencias']) db[t].splice(0);
  db.app_settings = db.app_settings.filter((f) => !String(f.key).startsWith('mako.doer.') && f.key !== 'mako.equipo.grupo');
}

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' }, { id: WS, capa: 'cliente', nombre: 'Fiesta', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.superadmin.grupo_jid', value: JID_SUPER }, { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' });
  db.usuarios.push(ANA, MARTIN);
  db.push_suscripciones.push({ id: 1, usuario_id: 101, endpoint: 'https://fcm.googleapis.com/fcm/send/ana', p256dh: 'p', auth: 'a', fallos: 0 });
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' });

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const cron = await import('../app/api/cron/grupo-turno/route');
  escena.cron = (req: Request) => cron.POST(new NextRequest(req.url, { method: req.method, headers: req.headers, body: (req as unknown as { body?: BodyInit }).body, duplex: 'half' } as never));

  const postear = async (u: Record<string, unknown>, ws: number, body: Record<string, unknown>) => {
    const r = await comoPersona(sesionDe(u), async () => {
      const x = await mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ ws: String(ws) }) });
      return { status: x.status, body: await x.json() as Record<string, any> };
    });
    await correrDespues();
    return r;
  };
  const leer = (u: Record<string, unknown>, ws: number) => comoPersona(sesionDe(u), async () => {
    const x = await mensajes.GET(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`), { params: Promise.resolve({ ws: String(ws) }) });
    return await x.json() as Record<string, any>;
  });
  const filas = (ws: number) => db.grupo_mensajes.filter((f) => f.workspace_id === ws).map((f) => ({ autor: f.autor_tipo, nombre: f.autor_nombre, usuario: f.usuario_id, texto: f.texto }));
  const anillo = (ws: number) => JSON.parse(String(db.app_settings.find((f) => f.workspace_id === ws && f.key === 'mako.equipo.grupo')?.value ?? '[]')) as Array<{ texto: string; id?: string }>;
  const out: Record<string, unknown> = {};

  // 1. Martín, por soporte, en el grupo de un cliente: firma el equipo, no despierta a MaKo, queda en el anillo y le suena a Ana.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'No debería salir.' });
  const r1 = await postear(MARTIN, WS, { texto: 'Ana, ya quedó arreglado el formulario: pruébalo y me dices.', clienteId: 'c-equipo-1' });
  out.equipo = {
    status: r1.status, mensaje: r1.body.mensaje?.autor, filas: filas(WS), cola: db.mako_doer_buffer.length, modelo: alModelo().length,
    anillo: anillo(WS), pushes: pushes.map((p) => p.endpoint),
  };
  // 2. El reintento del navegador con el mismo clienteId: la misma fila.
  const r2 = await postear(MARTIN, WS, { texto: 'Ana, ya quedó arreglado el formulario: pruébalo y me dices.', clienteId: 'c-equipo-1' });
  out.reintento = { repetida: r2.body.repetida === true, filas: filas(WS).length };
  // 3. Lo que ve Ana.
  out.loQueVeAna = ((await leer(ANA, WS)).mensajes as Array<{ autor: { tipo: string; nombre: string; propio: boolean } }>).map((m) => m.autor);

  // 4. El control: Ana en su grupo sigue siendo una persona y va a la cola.
  limpiar(); escenaNueva({ clase: clase('PREGUNTA'), respuesta: 'Hoy entraron 3.' });
  await postear(ANA, WS, { texto: 'mako, ¿cuántos leads entraron hoy?' });
  out.ana = { filas: filas(WS).map((f) => f.autor), cola: db.mako_doer_buffer.map((f) => f.estado) };

  // 5. El control: en el grupo de la PLATAFORMA, Martín le habla a MaKo como siempre.
  limpiar(); escenaNueva({ clase: clase('CHARLA') });
  await postear(MARTIN, PLATAFORMA, { texto: 'mako, buenas' });
  out.plataforma = { filas: filas(PLATAFORMA).map((f) => f.autor), cola: db.mako_doer_buffer.length };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
