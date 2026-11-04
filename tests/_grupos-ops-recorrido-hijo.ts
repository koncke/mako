// =============================================================================
// Hijo de tests/grupos-ops-recorrido.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El recorrido de Joan, de punta a punta y con las piezas reales (4/11/2026; Martín: «que ellos puedan invitar a personas etcétera. Eso para mí es
// una de las cosas más importantes»): quien administra abre el grupo → invita por email → al invitado le llega el aviso → abre el link → ve el grupo
// arriba de todo → lee, escribe, le habla a MaKo → le llegan los avisos → sale. Y lo mismo para quien todavía no tiene cuenta: le llega el mail, y al
// ENTRAR por primera vez con ese email ve el grupo. Las rutas, la puerta, la copia, el turno y el login son los reales; lo de afuera, el arnés.
// Cada eslabón deja su dato en `out`; el padre afirma uno por uno.

process.env.MAKO_DOER_VENTANA_MS = '0';
import { db, comoPersona, correrDespues, decirResultado, escena, escenaNueva, pushes, red, sesionDe, usuario, aEvolution, OPENAI_NEGOCIO, PLATAFORMA, type Sesion } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const WS = 10, JOAN_WS = 13;
const JID = '120363000000000010@g.us';
const ANA = usuario(101, 'ana@fiesta.test', 'Ana', WS, 'admin');
const JOAN = usuario(201, 'joan@ajeno.test', 'Joan', JOAN_WS, 'admin');
const JUANFRAN_EMAIL = 'juanfran@ajeno.test';

const mails = () => red.filter((x) => x.host === 'api.resend.com').map((x) => JSON.parse(x.cuerpo || '{}') as { to?: string | string[]; subject?: string; text?: string; html?: string });
const aQuien = (m: { to?: string | string[] }) => (Array.isArray(m.to) ? m.to[0] : m.to) ?? '';

async function main() {
  db.workspaces.push({ id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: 1, capa: 'cliente', nombre: 'Dueño', estado: 'activo' },
    { id: WS, capa: 'cliente', nombre: 'Fiesta', estado: 'activo' }, { id: JOAN_WS, capa: 'cliente', nombre: 'Ajeno', estado: 'activo' });
  db.app_settings.push({ workspace_id: WS, key: 'mako.grupo_jid', value: JID }, { workspace_id: 1, key: 'mako.voz.instancia', value: 'mako_superadmin_x' });
  db.usuarios.push(ANA, JOAN, usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' }));
  db.push_suscripciones.push({ id: 1, usuario_id: 201, endpoint: 'https://fcm.googleapis.com/fcm/send/joan', p256dh: 'p', auth: 'a', fallos: 0 });
  const { cifrarSecreto } = await import('../lib/credenciales');
  db.credenciales.push({ workspace_id: WS, clave: 'OPENAI_API_KEY', valor_enc: cifrarSecreto(OPENAI_NEGOCIO, WS, 'OPENAI_API_KEY'), servicio: 'openai' });

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const miembros = await import('../app/api/grupos/[ws]/miembros/route');
  const lista = await import('../app/api/grupos/route');
  const cron = await import('../app/api/cron/grupo-turno/route');
  const { emitirAviso } = await import('../lib/avisos');
  const { registrarLogin, crearUsuario } = await import('../lib/usuarios');
  const { filasVisibles } = await import('../app/_chat/grupo/pantalla');
  const { decidirDesvio, pedidoMovil } = await import('../lib/movil-desvio');
  escena.cron = (r: Request) => cron.POST(new NextRequest(r.url, { method: r.method, headers: r.headers, body: (r as unknown as { body?: BodyInit }).body, duplex: 'half' } as never));

  type R = { status: number; body: Record<string, any> };
  const leer = async (r: Response): Promise<R> => ({ status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> });
  const req = (metodo: string, ruta: string, body?: unknown) => new NextRequest(`https://hola-mako.com${ruta}`, { method: metodo, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
  const como = (u: Record<string, unknown>) => sesionDe(u) as Sesion;
  const p = (ws: number) => ({ params: Promise.resolve({ ws: String(ws) }) });
  const verLista = (u: Record<string, unknown>) => comoPersona(como(u), async () => leer(await lista.GET()));
  const verHilo = (u: Record<string, unknown>, q = '') => comoPersona(como(u), async () => leer(await mensajes.GET(req('GET', `/api/grupos/${WS}/mensajes${q}`), p(WS))));
  const escribir = async (u: Record<string, unknown>, texto: string) => { const r = await comoPersona(como(u), async () => leer(await mensajes.POST(req('POST', `/api/grupos/${WS}/mensajes`, { texto }), p(WS)))); await correrDespues(); return r; };
  const invitar = async (u: Record<string, unknown>, email: string) => { const r = await comoPersona(como(u), async () => leer(await miembros.POST(req('POST', `/api/grupos/${WS}/miembros`, { email }), p(WS)))); await correrDespues(); return r; };
  const salir = (u: Record<string, unknown>) => comoPersona(como(u), async () => leer(await miembros.DELETE(req('DELETE', `/api/grupos/${WS}/miembros`, { salir: true }), p(WS))));
  const textos = (r: R) => ((r.body.mensajes ?? []) as Array<{ texto: string; autor: { tipo: string } }>).map((m) => `${m.autor.tipo}: ${m.texto}`);
  const out: Record<string, unknown> = {};

  // ── 1. Quien administra abre el grupo ──
  escenaNueva({ clase: JSON.stringify({ clase: 'PREGUNTA', resumen: 'saludo', reenviado: false }), respuesta: 'Hola, Joan.' });
  const listaAna = await verLista(ANA);
  out.abre = { lista: listaAna.status, ws: (listaAna.body.grupos ?? []).map((g: { ws: number }) => g.ws), hilo: (await verHilo(ANA)).status };

  // ── 2. Invita por email; 3. al invitado le llega el aviso, con el link ──
  const mailsAntes = mails().length;
  const invitaJoan = await invitar(ANA, 'JOAN@ajeno.test');
  out.invita = invitaJoan.status;
  const mailJoan = mails().slice(mailsAntes).find((m) => aQuien(m) === JOAN.email);
  const pushJoan = pushes.find((x) => x.endpoint.endsWith('/joan'));
  out.aviso = {
    push: pushJoan ? { titulo: pushJoan.cuerpo.titulo, url: pushJoan.cuerpo.url } : null,
    mail: mailJoan ? { asunto: mailJoan.subject, link: /\/second-brain\?grupo=10/.test(String(mailJoan.html ?? '')) } : null,
  };

  // ── 4. Abre el link: desde el teléfono va a la pantalla del teléfono, con el grupo arriba de todo ──
  const link = `/second-brain?grupo=${WS}`;
  const desvio = decidirDesvio('/second-brain', `?grupo=${WS}`);
  out.link = { desvio, pedido: pedidoMovil({ pathname: '/second-brain', search: `?grupo=${WS}`, metodo: 'GET', telefono: true }) };
  const listaJoan = await verLista(JOAN);
  const gruposJoan = (listaJoan.body.grupos ?? []) as Array<{ ws: number; invitado: boolean; titulo: string }>;
  // La pantalla dibuja los grupos arriba de los chats (tests/grupos-ops-pantalla.test.ts); acá, que éste esté entre los que se ven sin «Ver todos».
  out.lista = { status: listaJoan.status, seVe: filasVisibles(gruposJoan, { todos: false, abierto: null }).visibles.some((g) => g.ws === WS), invitado: gruposJoan.find((g) => g.ws === WS)?.invitado ?? null, link };

  // ── 5. Lee, escribe y le habla a MaKo ──
  const lee = await verHilo(JOAN);
  out.lee = { status: lee.status, textos: textos(lee) };
  const escribe = await escribir(JOAN, 'mako, buenas');
  const tras = await verHilo(JOAN);
  out.escribe = { status: escribe.status, textos: textos(tras), evolution: aEvolution().filter((x) => /send/.test(x)).length };

  // ── 6. Le llegan los avisos ──
  await emitirAviso({ tipo: 'prueba-aviso', titulo: 'Título', texto: 'Entró un lead nuevo: Pedro', ws: WS, estado: { activo: true, wa: true, email: false, frecuenciaMin: 0 } } as never);
  await correrDespues();
  out.avisos = textos(await verHilo(JOAN)).filter((t) => t.includes('Entró un lead nuevo'));

  // ── 7. Sale ──
  out.sale = { status: (await salir(JOAN)).status, despues: (await verHilo(JOAN)).status, enLaLista: ((await verLista(JOAN)).body.grupos ?? []).some((g: { ws: number }) => g.ws === WS) };

  // ── Sin cuenta: el mail, y al ENTRAR por primera vez con ese email, el grupo ──
  const antesSinCuenta = mails().length;
  const sinCuenta = await invitar(ANA, JUANFRAN_EMAIL);
  const mailJuanfran = mails().slice(antesSinCuenta).find((m) => aQuien(m) === JUANFRAN_EMAIL);
  const juanfran = await crearUsuario({ email: JUANFRAN_EMAIL, nombre: 'Juanfran', rol: 'usuario', workspace_id: JOAN_WS, rol_ws: 'admin', estado: 'invitado' });
  const conCuentaSinEntrar = (await verHilo(juanfran as unknown as Record<string, unknown>)).status;
  await registrarLogin(JUANFRAN_EMAIL, { nombre: 'Juanfran' });
  const fila = db.usuarios.find((u) => u.email === JUANFRAN_EMAIL)!;
  const listaJuanfran = await verLista(fila);
  out.sinCuenta = {
    status: sinCuenta.status, mismaRespuesta: JSON.stringify(sinCuenta.body) === JSON.stringify(invitaJoan.body),
    mail: mailJuanfran ? { asunto: mailJuanfran.subject, texto: mailJuanfran.text ?? '', link: /\/second-brain\?grupo=10/.test(String(mailJuanfran.html ?? '')) } : null,
    conCuentaSinEntrar, alEntrar: (await verHilo(fila)).status,
    enLaLista: ((listaJuanfran.body.grupos ?? []) as Array<{ ws: number }>).some((g) => g.ws === WS),
    usuariosCreados: db.usuarios.filter((u) => u.email === JUANFRAN_EMAIL).length,
  };

  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
