// =============================================================================
// Hijo de tests/baja-cuenta.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, sobre el PostgREST de mentira, `pedirBajaDe`, `ejecutarBajaDePersona`, `cancelarBaja`, `cerrarBajasDelNegocio` y `eliminarWorkspace`.
// Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const PLATAFORMA = 9, NEGOCIO = 30, DE_DOS = 31, PRUEBA = 3, A_BORRAR = 40, OTRO = 50, PAUSADO = 51, ULTIMO = 52, MAIL = 53, CON_AVISO = 54;

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let ids = 1000;
  const pg = crearPostgrest({
    tablas: ['app_settings', 'workspaces', 'usuarios', 'bajas_cuenta', 'cobros', 'credenciales', 'agencia_clientes', 'leads', 'evolution_instancias'],
    defaults: (tabla: string, f: Fila) => (tabla === 'bajas_cuenta' ? { id: ids++, estado: 'pendiente', prueba: false, ...f } : { ...f }),
    unicos: [{ tabla: 'bajas_cuenta', columnas: ['usuario_id'], donde: (f: Fila) => f.estado === 'pendiente', nombre: 'bajas_cuenta_una_pendiente_uk' }],
  });
  const db = pg.db as Record<string, Fila[]>;
  const correos: Array<{ to: string; asunto: string; cuerpo: string }> = [];
  const borradosStorage: string[] = [];
  let resendCaido = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    const body = typeof init.body === 'string' ? JSON.parse(init.body) as Fila : null;
    if (u.host === 'supa.test' && u.pathname.startsWith('/storage/')) {
      const m = /\/storage\/v1\/object\/list\/([^/]+)/.exec(u.pathname);
      if (m) {
        const prefijo = String(body?.prefix ?? '');
        const offset = Number(body?.offset ?? 0);
        return json(200, offset === 0 && m[1] === 'archivero' && prefijo === String(A_BORRAR) ? [{ id: 'x', name: 'contrato.pdf' }] : []);
      }
      if (init.method === 'DELETE') { borradosStorage.push(...((body?.prefixes as string[]) ?? []).map((p) => `${u.pathname.split('/').pop()}:${p}`)); return json(200, []); }
      return json(200, []);
    }
    if (u.host === 'supa.test') return pg.responder(u, init);
    if (u.host === 'api.resend.com') {
      if (resendCaido) return json(500, { message: 'caído' });
      const para = body?.to;
      correos.push({ to: Array.isArray(para) ? String(para[0]) : String(para), asunto: String(body?.subject ?? ''), cuerpo: String(body?.text ?? body?.html ?? '') });
      return json(200, { id: 'mail' });
    }
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';

  const negocio = (id: number, nombre: string, capa = 'completo') => ({ id, nombre, capa, estado: 'activo' });
  db.workspaces.push(negocio(PLATAFORMA, 'MaKo', 'superadmin'), negocio(NEGOCIO, 'Estudio Luna'), negocio(DE_DOS, 'De Dos'), negocio(PRUEBA, 'Cliente de Prueba'), negocio(A_BORRAR, 'Se Va'), negocio(OTRO, 'Otro'), negocio(PAUSADO, 'Pausado'), negocio(ULTIMO, 'Ultimo'), negocio(MAIL, 'Mail'), negocio(CON_AVISO, 'Con Aviso'));
  const persona = (id: number, ws: number | null, rol_ws: string | null, rol = 'usuario') => ({ id, email: `p${id}@test.com`, nombre: `P${id}`, rol, rol_ws, workspace_id: ws, estado: 'activo' });
  db.usuarios.push(
    persona(1, PLATAFORMA, null, 'admin'), persona(2, NEGOCIO, 'admin'), persona(3, NEGOCIO, 'closer'),
    persona(4, DE_DOS, 'admin'), persona(5, DE_DOS, 'admin'), persona(6, PRUEBA, 'admin'), persona(7, A_BORRAR, 'admin'), persona(8, PRUEBA, 'closer'), persona(9, PLATAFORMA, 'admin'), persona(11, OTRO, 'admin'), persona(12, PAUSADO, 'admin'), persona(13, ULTIMO, 'admin'), persona(14, MAIL, 'closer'), persona(15, CON_AVISO, 'admin'),
  );

  const { pedirBajaDe, ejecutarBajaDePersona, cancelarBaja, cerrarBajasDelNegocio, bajasPendientes, terminarBaja } = await imp('lib/baja-cuenta.ts');
  const { eliminarWorkspace } = await imp('lib/eliminar-workspace.ts');
  const usuario = (id: number) => db.usuarios.find((u) => u.id === id);
  const ws = (id: number) => db.workspaces.find((w) => w.id === id);
  const baja = (usuarioId: number) => db.bajas_cuenta.find((b) => b.usuario_id === usuarioId);
  const R: Record<string, unknown> = {};

  // El super admin y quien mira a otro no pueden.
  R.superAdmin = await pedirBajaDe(1, false);
  R.mirando = await pedirBajaDe(3, true);
  R.sinFila = await pedirBajaDe(null, false);
  R.filasDespuesDeLosNo = db.bajas_cuenta.length;

  // Un closer: sólo él.
  R.closer = await pedirBajaDe(3, false);
  R.closerEstado = usuario(3)?.estado;
  R.negocioTrasCloser = ws(NEGOCIO)?.estado;
  R.dueñoTrasCloser = usuario(2)?.estado;

  // El segundo toque no repite nada (ni mails).
  const mailsAntes = correos.length;
  R.closerOtraVez = await pedirBajaDe(3, false);
  R.mailsDelSegundoToque = correos.length - mailsAntes;
  R.filasDelCloser = db.bajas_cuenta.filter((b) => b.usuario_id === 3).length;

  // El último admin: el negocio entero (el closer pendiente no cuenta: no es admin).
  R.dueño = await pedirBajaDe(2, false);
  R.dueñoEstado = usuario(2)?.estado;
  R.negocioPausado = ws(NEGOCIO)?.estado;
  R.filaDueño = { ...baja(2) };

  // Con otro admin adentro, sólo la persona: el negocio sigue.
  R.deDos = await pedirBajaDe(4, false);
  R.deDosNegocio = ws(DE_DOS)?.estado;
  // Y el otro admin, ya último admin vivo: ahora sí, el negocio.
  R.deDosUltimo = await pedirBajaDe(5, false);

  // Alguien del equipo de MaKo, admin de la plataforma sin ser super admin: se va él, y la plataforma sigue.
  R.plataforma = await pedirBajaDe(9, false);
  R.plataformaEstado = ws(PLATAFORMA)?.estado;

  // El negocio de prueba: se anota y no apaga nada (el revisor de la tienda puede tocarlo).
  R.prueba = await pedirBajaDe(6, false);
  R.pruebaEstado = usuario(6)?.estado;
  R.pruebaNegocio = ws(PRUEBA)?.estado;
  R.filaPrueba = { ...baja(6) };
  R.pruebaEjecutar = await ejecutarBajaDePersona(Number(baja(6)?.id), 'super@test.com');
  R.pendientes = (await bajasPendientes()).map((b: { usuario_id: number }) => b.usuario_id);

  // Ejecutar a una persona: se borra, le llega el mail, y la fila queda sin sus datos.
  const mailsAntesDe = correos.length;
  R.ejecutarCloser = await ejecutarBajaDePersona(Number(baja(3)?.id), 'super@test.com');
  R.closerBorrado = usuario(3) === undefined;
  R.mailFinal = correos.slice(mailsAntesDe);
  R.filaCloserCerrada = { ...baja(3) };
  R.negocioNoSeEjecutaAca = await ejecutarBajaDePersona(Number(baja(2)?.id), 'super@test.com');
  R.dueñoSigue = usuario(2) !== undefined;

  // Cancelar: vuelve a entrar, y el negocio se despausa.
  R.cancelar = await cancelarBaja(Number(baja(2)?.id), 'super@test.com');
  R.dueñoTrasCancelar = usuario(2)?.estado;
  R.negocioTrasCancelar = ws(NEGOCIO)?.estado;

  // Lo que la persona leyó no es lo que quedó: si no coincide, no se ejecuta.
  R.alcanceViejo = await pedirBajaDe(11, false, 'persona');
  R.tras409 = { pendientes: db.bajas_cuenta.filter((b) => b.usuario_id === 11).length, estado: usuario(11)?.estado, negocio: ws(OTRO)?.estado };
  // Cancelar no despausa lo que estaba pausado por otro motivo, ni activa a quien estaba suspendido antes.
  ws(PAUSADO)!.estado = 'pausado';
  await pedirBajaDe(12, false);
  R.yaPausado = { fila: { ...baja(12) } };
  R.cancelarYaPausado = await cancelarBaja(Number(baja(12)?.id), 'super@test.com');
  R.sigueePausado = ws(PAUSADO)?.estado;
  R.vuelveLaPersona = usuario(12)?.estado;
  // El último admin no se borra suelto: se borra el negocio.
  R.ultimoAdminFila = await pedirBajaDe(13, false, null);
  db.bajas_cuenta.find((b) => b.usuario_id === 13)!.alcance = 'persona';
  R.ultimoAdmin = await ejecutarBajaDePersona(Number(baja(13)?.id), 'super@test.com');
  // Si un mail no sale, el correo se queda y se dice.
  await pedirBajaDe(14, false);
  resendCaido = true;
  R.conMailCaido = await ejecutarBajaDePersona(Number(baja(14)?.id), 'super@test.com');
  resendCaido = false;
  R.filaMailCaido = { ...baja(14) };
  // Con algo que quedó, no se le dice «con todos sus datos»: sigue abierto, y se termina a mano.
  await pedirBajaDe(15, false);
  const mailsConAviso = correos.length;
  await cerrarBajasDelNegocio(CON_AVISO, 'super@test.com', ['wa-media: no pude listar']);
  R.conAviso = { fila: { ...baja(15) }, mails: correos.length - mailsConAviso };
  R.terminarExiste = await terminarBaja(Number(baja(15)?.id), 'super@test.com');
  db.workspaces.splice(db.workspaces.findIndex((w) => w.id === CON_AVISO), 1);
  R.terminar = await terminarBaja(Number(baja(15)?.id), 'super@test.com');
  R.terminada = { ...baja(15) };

  // Borrar un negocio de verdad se lleva sus archivos y cierra su pedido con el mail.
  await pedirBajaDe(7, false);
  const mailsAntesDeBorrar = correos.length;
  const borrado = await eliminarWorkspace(A_BORRAR, 'Se Va', PLATAFORMA);
  await cerrarBajasDelNegocio(A_BORRAR, 'super@test.com');
  R.borrado = { ok: borrado.ok, error: borrado.error };
  R.borradosStorage = borradosStorage;
  R.mailAlBorrar = correos.slice(mailsAntesDeBorrar);
  R.filaBorrado = baja(7);
  R.correos = correos.map((c) => ({ to: c.to, asunto: c.asunto }));

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
