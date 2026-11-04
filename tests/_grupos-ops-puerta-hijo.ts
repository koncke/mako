// =============================================================================
// Hijo de tests/grupos-ops-puerta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Quién entra al grupo y qué ve, con las RUTAS REALES (app/api/grupos/**), la puerta real y la copia real. De mentira, lo del arnés. Imprime lo que contestó cada pedido; el padre mira.

import { db, comoPersona, correrDespues, decirResultado, escena, escenaNueva, pedidosDeSesion, pushes, red, sesionDe, storage, usuario, aEvolution, type Sesion } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const NEGOCIO = 7, OTRO = 8, TERCERO = 6, AGENCIA = 13, AGENCIA_REVOCADA = 14, PAUSADO = 20, PLATAFORMA = 9;
const DUENO = usuario(101, 'dueno@siete.test', 'Ana Dueña', NEGOCIO, 'admin');
const CLOSER = usuario(102, 'closer@siete.test', 'Cris Closer', NEGOCIO, 'closer');
const JOAN = usuario(201, 'joan@ocho.test', 'Joan', OTRO, 'admin');
const OTRA = usuario(202, 'otra@ocho.test', 'Otra', OTRO, 'admin');
const AG_ADMIN = usuario(301, 'admin@agencia.test', 'Admin Agencia', AGENCIA, 'admin');
const AG_CLOSER = usuario(302, 'closer@agencia.test', 'Closer Agencia', AGENCIA, 'closer');
const REVOCADA = usuario(350, 'admin@revocada.test', 'Admin Revocada', AGENCIA_REVOCADA, 'admin');
const SUPER = usuario(901, 'martin@mako.test', 'Martín', PLATAFORMA, null, { rol: 'admin' });
const DE_PLATAFORMA = usuario(902, 'empleado@mako.test', 'Empleado', PLATAFORMA, 'admin');
const DEL_PAUSADO = usuario(401, 'dueno@pausado.test', 'Pausado', PAUSADO, 'admin');
const SIN_RELACION = usuario(500, 'nadie@tercero.test', 'Nadie', TERCERO, 'admin');

const mensaje = (id: number, ws: number, extra: Record<string, unknown> = {}) => ({
  id, workspace_id: ws, autor_tipo: 'mako', autor_nombre: 'MaKo', canal: 'app', texto: `mensaje ${id} del ws${ws}`, adjunto: null, responde_a: null, reaccion: null, aviso_tipo: null,
  wa_message_id: null, wa_at: null, cliente_id: null, usuario_id: null, created_at: new Date(Date.UTC(2026, 10, 3, 12, 0, id % 60)).toISOString(), ...extra,
});

async function main() {
  db.workspaces.push(
    { id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: NEGOCIO, capa: 'completo', nombre: 'Siete', estado: 'activo' }, { id: OTRO, capa: 'completo', nombre: 'Ocho', estado: 'activo' },
    { id: TERCERO, capa: 'completo', nombre: 'Seis', estado: 'activo' }, { id: AGENCIA, capa: 'agencia', nombre: 'Agencia', estado: 'activo' }, { id: AGENCIA_REVOCADA, capa: 'agencia', nombre: 'Revocada', estado: 'activo' },
    { id: PAUSADO, capa: 'completo', nombre: 'Pausado', estado: 'pausado' },
  );
  db.app_settings.push({ workspace_id: PAUSADO, key: 'plan.corte_por_pago', value: JSON.stringify({ cobroId: 1, hasta: '2026-01-01', motivo: 'sin-agencia', desde: '2026-01-01T00:00:00.000Z', vigente: true }) });
  db.usuarios.push(DUENO, CLOSER, JOAN, OTRA, AG_ADMIN, AG_CLOSER, REVOCADA, SUPER, DE_PLATAFORMA, DEL_PAUSADO, SIN_RELACION);
  db.agencia_clientes.push({ agencia_ws: AGENCIA, cliente_ws: NEGOCIO, estado: 'aprobado' }, { agencia_ws: AGENCIA_REVOCADA, cliente_ws: NEGOCIO, estado: 'revocado' });
  db.agencias.push({ ws: AGENCIA }, { ws: AGENCIA_REVOCADA });
  // Lo viejo: 5 mensajes del negocio, un archivo de antes, y otro negocio con su archivo.
  storage.set(`grupos/${NEGOCIO}/viejo.pdf`, Buffer.from('%PDF viejo'));
  storage.set(`grupos/${OTRO}/ajeno.pdf`, Buffer.from('%PDF ajeno'));
  for (const id of [1, 2, 3, 4]) db.grupo_mensajes.push(mensaje(id, NEGOCIO));
  db.grupo_mensajes.push(mensaje(5, NEGOCIO, { adjunto: { tipo: 'pdf', path: `grupos/${NEGOCIO}/viejo.pdf`, nombre: 'viejo.pdf', mime: 'application/pdf' } }));
  db.grupo_mensajes.push(mensaje(6, OTRO, { texto: 'secreto del otro negocio', adjunto: { tipo: 'pdf', path: `grupos/${OTRO}/ajeno.pdf`, nombre: 'ajeno.pdf', mime: 'application/pdf' } }));

  const { NextRequest } = await import('next/server');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');
  const miembros = await import('../app/api/grupos/[ws]/miembros/route');
  const leido = await import('../app/api/grupos/[ws]/leido/route');
  const adjunto = await import('../app/api/grupos/[ws]/adjunto/[id]/route');
  const whatsapp = await import('../app/api/grupos/[ws]/whatsapp/route');
  const lista = await import('../app/api/grupos/route');

  type R = { status: number; body: Record<string, any> };
  const leer = async (r: Response): Promise<R> => {
    if (r.status >= 300 && r.status < 400) return { status: r.status, body: { location: r.headers.get('location') } };
    return { status: r.status, body: await r.json().catch(() => ({})) as Record<string, any> };
  };
  const req = (metodo: string, ruta: string, body?: unknown) => new NextRequest(`https://hola-mako.com${ruta}`, { method: metodo, ...(body !== undefined ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}) });
  const como = (u: Record<string, unknown> | null) => (u ? sesionDe(u) : null) as Sesion | null;
  const verHilo = (u: Record<string, unknown> | null, ws: number, q = '') => comoPersona(como(u), async () => leer(await mensajes.GET(req('GET', `/api/grupos/${ws}/mensajes${q}`), { params: Promise.resolve({ ws: String(ws) }) })));
  const escribir = async (u: Record<string, unknown> | null, ws: number, body: Record<string, unknown>) => {
    const r = await comoPersona(como(u), async () => leer(await mensajes.POST(req('POST', `/api/grupos/${ws}/mensajes`, body), { params: Promise.resolve({ ws: String(ws) }) })));
    await correrDespues();
    return r;
  };
  const verMiembros = (u: Record<string, unknown> | null, ws: number) => comoPersona(como(u), async () => leer(await miembros.GET(req('GET', `/api/grupos/${ws}/miembros`), { params: Promise.resolve({ ws: String(ws) }) })));
  const invitar = async (u: Record<string, unknown> | null, ws: number, email: string) => {
    const r = await comoPersona(como(u), async () => leer(await miembros.POST(req('POST', `/api/grupos/${ws}/miembros`, { email }), { params: Promise.resolve({ ws: String(ws) }) })));
    await correrDespues();
    return r;
  };
  const sacar = (u: Record<string, unknown> | null, ws: number, body: Record<string, unknown>) => comoPersona(como(u), async () => leer(await miembros.DELETE(req('DELETE', `/api/grupos/${ws}/miembros`, body), { params: Promise.resolve({ ws: String(ws) }) })));
  const archivo = (u: Record<string, unknown> | null, ws: number, id: number) => comoPersona(como(u), async () => leer(await adjunto.GET(req('GET', `/api/grupos/${ws}/adjunto/${id}`), { params: Promise.resolve({ ws: String(ws), id: String(id) }) })));
  const textos = (r: R) => ((r.body.mensajes ?? []) as Array<{ texto: string; id: number }>).map((m) => m.texto);

  const out: Record<string, unknown> = {};
  escenaNueva();

  // ── 1. La matriz, antes de invitar a nadie ──
  out.matriz = {
    dueno: (await verHilo(DUENO, NEGOCIO)).status,
    closerSinInvitar: (await verHilo(CLOSER, NEGOCIO)).status,
    ajeno: (await verHilo(JOAN, NEGOCIO)).status,
    agenciaAdmin: (await verHilo(AG_ADMIN, NEGOCIO)).status,
    agenciaCloser: (await verHilo(AG_CLOSER, NEGOCIO)).status,
    agenciaRevocada: (await verHilo(REVOCADA, NEGOCIO)).status,
    superAdmin: (await verHilo(SUPER, NEGOCIO)).status,
    pausado: (await verHilo(DEL_PAUSADO, PAUSADO)).status,
    superEnPausado: (await verHilo(SUPER, PAUSADO)).status,
    sinSesion: (await verHilo(null, NEGOCIO)).status,
    sinSubNumerico: await comoPersona({ ...sesionDe(DUENO), sub: 'dev' }, async () => (await mensajes.GET(req('GET', `/api/grupos/${NEGOCIO}/mensajes`), { params: Promise.resolve({ ws: String(NEGOCIO) }) })).status),
    // El ws de la URL es una pregunta: pedir `?ws=` no abre otro negocio.
    ajenoConQueryWs: (await verHilo(JOAN, TERCERO, `?ws=${TERCERO}`)).status,
    wsInvalido: (await comoPersona(como(DUENO), async () => leer(await mensajes.GET(req('GET', '/api/grupos/abc/mensajes'), { params: Promise.resolve({ ws: 'abc' }) })))).status,
  };
  escenaNueva({ fallar: new Set(['agencia_clientes:GET']) });
  out.agenciaQueTira = { agencia: (await verHilo(AG_ADMIN, NEGOCIO)).status, dueno: (await verHilo(DUENO, NEGOCIO)).status };
  escenaNueva({ fallar: new Set(['usuarios:GET']) });
  out.personaQueNoSeLee = (await verHilo(DUENO, NEGOCIO)).status;

  // ── El grupo de la plataforma ──
  escenaNueva();
  db.grupo_mensajes.push(mensaje(90, PLATAFORMA, { texto: 'Respuesta al equipo de otro negocio' }));
  out.plataforma = {
    leerEmpleado: (await verHilo(DE_PLATAFORMA, PLATAFORMA)).status,
    escribirEmpleado: (await escribir(DE_PLATAFORMA, PLATAFORMA, { texto: 'hola' })).status,
    invitarEmpleado: (await invitar(DE_PLATAFORMA, PLATAFORMA, 'joan@ocho.test')).status,
    miembrosEmpleado: (await verMiembros(DE_PLATAFORMA, PLATAFORMA)).status,
    leerGlobal: (await verHilo(SUPER, PLATAFORMA)).status,
    invitarGlobal: (await invitar(SUPER, PLATAFORMA, 'joan@ocho.test')).status,
    listaEmpleado: (await comoPersona(como(DE_PLATAFORMA), async () => leer(await lista.GET()))).body.grupos,
    filasDeInvitados: db.grupo_invitados.filter((f) => f.workspace_id === PLATAFORMA).length,
  };

  // ── 2. Invitar: con cuenta y sin cuenta, la misma respuesta; `usuarios` no se toca ──
  const antesDeUsuarios = JSON.stringify(db.usuarios);
  const conCuenta = await invitar(DUENO, NEGOCIO, 'JOAN@ocho.test');
  const avisosConCuenta = { push: 0, mail: 0 };
  const sinCuenta = await invitar(DUENO, NEGOCIO, 'nadie@nuevo.test');
  out.invitar = {
    conCuenta, sinCuenta, usuariosIgual: JSON.stringify(db.usuarios) === antesDeUsuarios, ...avisosConCuenta,
    fila: db.grupo_invitados.find((f) => f.email === 'joan@ocho.test'),
    filaSinCuenta: db.grupo_invitados.find((f) => f.email === 'nadie@nuevo.test'),
    invalido: (await invitar(DUENO, NEGOCIO, 'no-es-un-email')).status,
  };
  // ── 3. Lo que ve el invitado, desde que entró ──
  const filaPrevia = await verHilo(JOAN, NEGOCIO);
  db.grupo_mensajes.push(mensaje(7, NEGOCIO, { texto: 'lo primero después: mira https://hola-mako.com/crm/55?ws=7 y hola-mako.com/plan' }));
  db.grupo_mensajes.push(mensaje(8, NEGOCIO, { aviso_tipo: 'meta-cuenta-frenada-agencia', texto: 'cuenta frenada de un cliente' }));
  db.grupo_mensajes.push(mensaje(9, NEGOCIO, { texto: 'lo segundo después' }));
  const invitado = await verHilo(JOAN, NEGOCIO);
  const invitadoAntes = await verHilo(JOAN, NEGOCIO, '?antes=7');
  const invitadoDespues = await verHilo(JOAN, NEGOCIO, '?despues=0');
  const duenoVe = await verHilo(DUENO, NEGOCIO);
  const listaInvitado = await comoPersona(como(JOAN), async () => leer(await lista.GET()));
  out.invitado = {
    primeraVez: { status: filaPrevia.status, textos: textos(filaPrevia) },
    textos: textos(invitado), antes: textos(invitadoAntes), despues: textos(invitadoDespues), duenoCuantos: textos(duenoVe).length, duenoTextos: textos(duenoVe),
    entro: db.grupo_mensajes.filter((f) => f.autor_tipo === 'sistema').map((f) => f.texto),
    lista: listaInvitado.body.grupos,
    camposDelMensaje: Object.keys((invitado.body.mensajes as unknown[])[0] as object).sort(),
  };
  // La vista previa de quien recién entró, sin nada nuevo: nada de antes.
  await invitar(DUENO, NEGOCIO, 'otra@ocho.test');
  out.previaRecienEntrada = (await comoPersona(como(OTRA), async () => leer(await lista.GET()))).body.grupos;

  // ── 4. Los miembros, según quién mira ──
  out.miembros = { aInvitado: (await verMiembros(JOAN, NEGOCIO)).body, aDueno: (await verMiembros(DUENO, NEGOCIO)).body };

  // ── 5. Los ids son globales: el archivo y la cita ──
  out.adjunto = {
    otroNegocio: (await archivo(DUENO, NEGOCIO, 6)).status,
    invitadoOtroNegocio: (await archivo(JOAN, NEGOCIO, 6)).status,
    invitadoDeAntes: (await archivo(JOAN, NEGOCIO, 5)).status,
    duenoDeAntes: await archivo(DUENO, NEGOCIO, 5),
    ajenoAlGrupo: (await archivo(SIN_RELACION, NEGOCIO, 5)).status,
    sacadoDeOtro: (await archivo(JOAN, OTRO, 6)).status,
  };
  out.cita = {
    otroNegocio: (await escribir(DUENO, NEGOCIO, { texto: 'mirá esto', respondeA: 6 })).status,
    invitadoDeAntes: (await escribir(JOAN, NEGOCIO, { texto: 'qué dice esto', respondeA: 3 })).status,
    invitadoOtroNegocio: (await escribir(JOAN, NEGOCIO, { texto: 'qué dice esto', respondeA: 6 })).status,
    invitadoVisible: (await escribir(JOAN, NEGOCIO, { texto: 'y esto', respondeA: 9 })).status,
    filasConCitaMala: db.grupo_mensajes.filter((f) => f.responde_a === 6 || f.responde_a === 3).length,
  };

  // ── 6. Sacar ──
  out.sacar = {
    invitadoSacaAOtro: (await sacar(JOAN, NEGOCIO, { email: 'otra@ocho.test' })).status,
    closerSaca: (await sacar(CLOSER, NEGOCIO, { email: 'joan@ocho.test' })).status,
    invitadoInvita: (await invitar(JOAN, NEGOCIO, 'tercero@x.test')).status,
    closerInvita: (await invitar(CLOSER, NEGOCIO, 'tercero@x.test')).status,
    duenoNoSeSale: (await sacar(DUENO, NEGOCIO, { salir: true })).status,
    otraSeSale: (await sacar(OTRA, NEGOCIO, { salir: true })).status,
    otraYaNoVe: (await verHilo(OTRA, NEGOCIO)).status,
    duenoSacaAJoan: (await sacar(DUENO, NEGOCIO, { email: 'joan@ocho.test' })).status,
    joanYaNoVe: (await verHilo(JOAN, NEGOCIO)).status,
    joanYaNoBaja: (await archivo(JOAN, NEGOCIO, 7)).status,
    burbujas: db.grupo_mensajes.filter((f) => f.autor_tipo === 'sistema').map((f) => f.texto),
  };

  // ── 7. `desde_id` no puede fallar abierto ──
  escenaNueva({ fallar: new Set(['grupo_mensajes:GET']) });
  const conLecturaRota = await invitar(DUENO, NEGOCIO, 'desde-roto@x.test');
  out.desdeRoto = { status: conLecturaRota.status, fila: db.grupo_invitados.find((f) => f.email === 'desde-roto@x.test') ?? null };
  escenaNueva();

  // ── 8. El tope de invitados ──
  const yaInvitados = db.grupo_invitados.filter((f) => f.workspace_id === OTRO).length;
  for (let i = 0; i < 30 - yaInvitados; i++) db.grupo_invitados.push({ workspace_id: OTRO, email: `i${i}@x.test`, usuario_id: null, invito_usuario_id: null, desde_id: 0, invitado_at: '2020-01-01T00:00:00.000Z', abrio_at: null, avisado_at: null, salio_at: null });
  out.tope = (await invitar(OTRA, OTRO, 'uno-mas@x.test')).status;

  // ── 9. Avisos de la invitación: uno cada 24 h, también sacando y volviendo a invitar ──
  escenaNueva();
  db.push_suscripciones.push({ id: 7001, usuario_id: 500, endpoint: 'https://fcm.googleapis.com/fcm/send/nadie', p256dh: 'p', auth: 'a', fallos: 0 });
  await invitar(DUENO, NEGOCIO, 'nadie@tercero.test');
  const primero = { push: pushes.length, mail: JSON.stringify(aEvolution()) };
  const mails = () => (red.filter((x) => x.host === 'api.resend.com').length);
  const mailsPrimero = mails();
  await sacar(DUENO, NEGOCIO, { email: 'nadie@tercero.test' });
  await invitar(DUENO, NEGOCIO, 'nadie@tercero.test');
  out.avisoInvitacion = { primero, mailsPrimero, pushesDespues: pushes.length, mailsDespues: mails(), cuerpo: pushes[0]?.cuerpo ?? null };

  // ── 10. Los topes de escribir ──
  escenaNueva();
  let ultimo = 200;
  let intentos = 0;
  while (ultimo === 200 && intentos < 40) { ultimo = (await escribir(AG_ADMIN, NEGOCIO, { texto: `mensaje de bucle ${intentos}` })).status; intentos++; }
  out.topeMinuto = { ultimo, intentos };

  // Un reintento del navegador no duplica.
  escenaNueva();
  const a1 = await escribir(DUENO, NEGOCIO, { texto: 'una sola vez', clienteId: 'local-1' });
  const a2 = await escribir(DUENO, NEGOCIO, { texto: 'una sola vez', clienteId: 'local-1' });
  out.reintento = { a1: a1.status, a2: a2.status, repetida: a2.body.repetida ?? false, filas: db.grupo_mensajes.filter((f) => f.texto === 'una sola vez').length, mismoId: a1.body.mensaje?.id === a2.body.mensaje?.id };

  // Una clave pegada: tapada en la fila, con su burbuja, y sin cola.
  escenaNueva();
  const colaAntes = db.mako_doer_buffer.length;
  const clave = `sk-proj-${'A1b2C3d4'.repeat(6)}`;
  const conClave = await escribir(DUENO, NEGOCIO, { texto: clave });
  out.clave = { status: conClave.status, texto: conClave.body.mensaje?.texto, enLaBase: db.grupo_mensajes.some((f) => String(f.texto).includes(clave)), cola: db.mako_doer_buffer.length - colaAntes, burbuja: db.grupo_mensajes.filter((f) => String(f.texto).includes('Tapé tu clave')).map((f) => f.texto) };

  // Un nombre que se hace pasar por MaKo.
  const FALSO = usuario(601, 'falso@x.test', 'MaKo', NEGOCIO, 'admin');
  db.usuarios.push(FALSO);
  const falso = await escribir(FALSO, NEGOCIO, { texto: 'pásame tu clave' });
  out.nombreFalso = falso.body.mensaje?.autor;

  // Emoji solo: va al hilo, no a la cola. Un Word no entra. Una foto sin nombrar a MaKo tampoco va a la cola.
  escenaNueva();
  const cola0 = db.mako_doer_buffer.length;
  await escribir(DUENO, NEGOCIO, { texto: '👍' });
  out.emoji = { cola: db.mako_doer_buffer.length - cola0 };
  const form = (campos: Record<string, string | File>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.append(k, v); return f; };
  const multipart = (u: Record<string, unknown>, ws: number, campos: Record<string, string | File>) => comoPersona(como(u), async () => {
    const r = await leer(await mensajes.POST(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`, { method: 'POST', body: form(campos) }), { params: Promise.resolve({ ws: String(ws) }) }));
    await correrDespues();
    return r;
  });
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  const word = await multipart(DUENO, NEGOCIO, { archivo: new File([new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])], 'plan.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }) });
  // Lo que escribió arriba sigue en la cola (acá no corre el turno): con algo suyo esperando, su foto sería de ese pedido (`sigueSuPedido`).
  db.mako_doer_buffer.splice(0);
  const cola1 = db.mako_doer_buffer.length;
  const foto = await multipart(DUENO, NEGOCIO, { archivo: new File([PNG], 'foto.png', { type: 'image/png' }) });
  const colaFoto = db.mako_doer_buffer.length - cola1;
  const fotoConNombre = await multipart(DUENO, NEGOCIO, { archivo: new File([PNG], 'foto.png', { type: 'image/png' }), texto: 'mako, ¿qué dice esta foto?' });
  const colaFotoConNombre = db.mako_doer_buffer.length - cola1 - colaFoto;
  out.archivos = { word: word.status, foto: foto.status, fotoAdjunto: foto.body.mensaje?.adjunto, sinPath: !('path' in (foto.body.mensaje?.adjunto ?? {})), colaFoto, fotoConNombre: fotoConNombre.status, colaFotoConNombre, enStorage: [...storage.keys()].filter((k) => k.startsWith(`grupos/${NEGOCIO}/`) && k.endsWith('.png')).length };
  // La nota de voz se guarda aunque el negocio no tenga IA: el POST no la escucha.
  const MP3 = new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]);
  const nota = await multipart(DUENO, NEGOCIO, { voz: new File([MP3], 'nota.mp3', { type: 'audio/mpeg' }), secs: '4' });
  out.nota = { status: nota.status, adjunto: nota.body.mensaje?.adjunto, llamadasAIA: red.filter((x) => x.camino.includes('transcriptions')).length };

  // ── 11. Sondear: ascendente, repitiendo, con el cursor de lo que devuelve el GET ──
  const WS_LARGO = OTRO;
  for (let i = 0; i < 150; i++) db.grupo_mensajes.push(mensaje(10000 + i, WS_LARGO, { texto: `m${i}` }));
  const pag1 = await verHilo(OTRA, WS_LARGO, '?despues=9999');
  const pag2 = await verHilo(OTRA, WS_LARGO, `?despues=${pag1.body.cursor}`);
  const pag3 = await verHilo(OTRA, WS_LARGO, `?despues=${pag2.body.cursor}`);
  out.sondeo = {
    pag1: { cuantos: textos(pag1).length, primero: textos(pag1)[0], hayMas: pag1.body.hayMas, cursor: pag1.body.cursor },
    pag2: { cuantos: textos(pag2).length, primero: textos(pag2)[0], hayMas: pag2.body.hayMas },
    pag3: { cuantos: textos(pag3).length, ultimo: textos(pag3).at(-1), hayMas: pag3.body.hayMas },
  };
  // ── 12. Leído: sube y no baja; el conteo no pierde a MaKo ──
  const marcar = (u: Record<string, unknown>, ws: number, hastaId: number) => comoPersona(como(u), async () => leer(await leido.POST(req('POST', `/api/grupos/${ws}/leido`, { hastaId }), { params: Promise.resolve({ ws: String(ws) }) })));
  await marcar(OTRA, WS_LARGO, 10100);
  await marcar(OTRA, WS_LARGO, 10050);
  const filaLeido = db.grupo_leidos.find((f) => f.workspace_id === WS_LARGO && f.usuario_id === 202);
  const listaLarga = await comoPersona(como(OTRA), async () => leer(await lista.GET()));
  out.leido = { hasta: filaLeido?.hasta_id, noLeidos: (listaLarga.body.grupos as Array<{ ws: number; noLeidos: number }>).find((g) => g.ws === WS_LARGO)?.noLeidos, ajeno: (await marcar(JOAN, WS_LARGO, 1)).status === 200 };

  // ── 13. Lo de antes, de WhatsApp: sólo quien administra, y sin el jid ──
  db.app_settings.push({ workspace_id: NEGOCIO, key: 'mako.grupo_jid', value: 'jid-siete@g.us' });
  db.mako_doer_conv.push({ id: 7700, workspace_id: NEGOCIO, grupo_jid: 'jid-siete@g.us', role: 'user', content: 'lo de antes', created_at: '2026-10-01T00:00:00.000Z' });
  const verWa = (u: Record<string, unknown>) => comoPersona(como(u), async () => leer(await whatsapp.GET(req('GET', `/api/grupos/${NEGOCIO}/whatsapp`), { params: Promise.resolve({ ws: String(NEGOCIO) }) })));
  const cuantasFilas = db.grupo_mensajes.length;
  const waDueno = await verWa(DUENO);
  await invitar(DUENO, NEGOCIO, 'cris@cerrada.test');
  const closerInvitado = usuario(603, 'cris@cerrada.test', 'Cris', NEGOCIO, 'closer');
  db.usuarios.push(closerInvitado);
  await sacar(DUENO, NEGOCIO, { email: 'cris@cerrada.test' });
  await invitar(DUENO, NEGOCIO, 'cris@cerrada.test');
  out.whatsapp = { dueno: waDueno, sinJid: !JSON.stringify(waDueno.body).includes('jid-siete'), invitado: (await verWa(SIN_RELACION)).status, closerInvitado: { hilo: (await verHilo(closerInvitado, NEGOCIO)).status, wa: (await verWa(closerInvitado)).status }, filasNuevas: db.grupo_mensajes.length - cuantasFilas };

  // ── La cuenta creada después: no entra sola, y volver a invitarla la deja entrar SIN sacarla antes (la pantalla dice «invítalo de nuevo») ──
  await invitar(DUENO, NEGOCIO, 'tarde@nuevo.test');
  const TARDE = usuario(604, 'tarde@nuevo.test', 'Tarde', OTRO, 'closer');
  db.usuarios.push(TARDE);
  const tardeSola = (await verHilo(TARDE, NEGOCIO)).status;
  const mayorAlVolver = Math.max(...db.grupo_mensajes.filter((f) => f.workspace_id === NEGOCIO).map((f) => Number(f.id)));
  const reinvitar = await invitar(DUENO, NEGOCIO, 'tarde@nuevo.test');
  const filaTarde = db.grupo_invitados.find((f) => f.workspace_id === NEGOCIO && f.email === 'tarde@nuevo.test');
  out.cuentaDespues = { sola: tardeSola, reinvitar: reinvitar.status, entra: (await verHilo(TARDE, NEGOCIO)).status, usuario: filaTarde?.usuario_id, desdeIgualAlMayor: Number(filaTarde?.desde_id) === mayorAlVolver };
  // Con cuenta y ya adentro, volver a invitar no le corre `desde_id`.
  const desdeAntes = db.grupo_invitados.find((f) => f.workspace_id === NEGOCIO && f.email === 'tarde@nuevo.test')?.desde_id;
  db.grupo_mensajes.push(mensaje(95000, NEGOCIO, { texto: 'uno más' }));
  await invitar(DUENO, NEGOCIO, 'tarde@nuevo.test');
  (out.cuentaDespues as Record<string, unknown>).noCorreDesde = db.grupo_invitados.find((f) => f.workspace_id === NEGOCIO && f.email === 'tarde@nuevo.test')?.desde_id === desdeAntes;

  void pedidosDeSesion; void escena;
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
