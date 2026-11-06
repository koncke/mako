// =============================================================================
// Hijo de tests/tickets-avance-email.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corren REALES, sobre el PostgREST de mentira y un Resend de mentira: `avisarAvancesPorEmail` (lib/tickets-avance-email.ts),
// la ruta de baja (app/api/email/unsubscribe/tickets/route.ts) y el cron de tickets (app/api/cron/tickets/route.ts).
// Necesita `--conditions=react-server`. Nada sale a la red: lo que no es la base ni Resend se anota en `red`.
// =============================================================================

import { pathToFileURL } from 'node:url';

const RAIZ = new URL('..', import.meta.url);
const imp = (p: string) => import(pathToFileURL(new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1')).href);
type Fila = Record<string, unknown>;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const PLATAFORMA = 9, NEGOCIO = 30, OTRO = 31;
/** Las rutas las pasa el test (`CORRE`, tests/tickets-avance-email.test.ts): son las que corren acá. */
const CORRE = JSON.parse(process.env.CORRE ?? '{}') as { vuelta: string; baja: string; cron: string };

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  let evId = 1;
  const pg = crearPostgrest({
    tablas: ['app_settings', 'workspaces', 'usuarios', 'credenciales', 'tickets', 'ticket_eventos', 'correo_bajas'],
    defaults: (tabla: string, f: Fila) => (tabla === 'ticket_eventos' ? { id: evId++, at: new Date().toISOString(), ...f } : { ...f }),
    orCompleto: true,
  });
  const db = pg.db as Record<string, Fila[]>;
  const correos: Array<{ to: string; asunto: string; texto: string; html: string; headers: Record<string, string>; from: string }> = [];
  const red: string[] = [];
  let resendCaido = false;

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    if (u.host === 'supa.test') return pg.responder(u, init);
    if (u.host === 'api.resend.com') {
      if (resendCaido) return json(500, { message: 'Resend caído' });
      const b = JSON.parse(String(init.body)) as Fila;
      const para = b.to;
      correos.push({
        to: Array.isArray(para) ? String(para[0]) : String(para), asunto: String(b.subject ?? ''), texto: String(b.text ?? ''),
        html: String(b.html ?? ''), headers: (b.headers ?? {}) as Record<string, string>, from: String(b.from ?? ''),
      });
      return json(200, { id: `mail-${correos.length}` });
    }
    red.push(u.host);
    return json(500, { error: `red de mentira: ${u.host}` });
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
  process.env.CREDENCIALES_SECRET = 'secreto-de-prueba-para-cifrar-las-credenciales-R';
  process.env.APP_BASE_URL = 'https://mako.test';
  process.env.AUTH_SECRET = 'secreto-de-firma-de-prueba';
  process.env.RESEND_API_KEY = 're_prueba';
  process.env.CRON_SECRET = 'cron-de-prueba';

  db.workspaces.push(
    { id: PLATAFORMA, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' },
    { id: NEGOCIO, nombre: 'Estudio Luna', capa: 'completo', estado: 'activo' },
    { id: OTRO, nombre: 'Otro', capa: 'completo', estado: 'activo' },
  );
  const persona = (id: number, ws: number, extra: Fila = {}) => ({ id, email: `p${id}@test.com`, nombre: `P${id}`, rol: 'usuario', rol_ws: 'admin', workspace_id: ws, estado: 'activo', perfil: { timezone: 'America/Mexico_City' }, ...extra });
  db.usuarios.push(
    persona(2, NEGOCIO),
    persona(3, NEGOCIO, { perfil: { ticketsPorEmail: false } }), // apagó los correos
    persona(4, PLATAFORMA),
    persona(5, NEGOCIO, { estado: 'suspendido' }),
    persona(6, OTRO), // de otro negocio (una agencia o el super admin mirando el cliente)
    persona(7, NEGOCIO, { email: 'whatsapp:5215511112222' }),
    // La MISMA dirección que la 2, en otro negocio: el caso de quien trabaja en su cuenta y en la de un cliente de su
    // agencia. `usuarios(email)` no es único (0053). Es el que probaba el agujero de la baja por cuenta.
    persona(9, NEGOCIO, { email: 'dos@test.com' }),
    persona(10, OTRO, { email: 'dos@test.com' }),
  );

  const ahora = Date.now();
  const hace = (h: number) => new Date(ahora - h * 3_600_000).toISOString();
  const ticket = (id: number, f: Fila): Fila => ({
    id, workspace_id: NEGOCIO, usuario_id: 2, usuario_email: 'p2@test.com', titulo: `Ticket ${id}`, estado: 'nuevo', canal: 'formulario',
    ref: null, avance_email: null, created_at: hace(1), updated_at: hace(1), ...f,
  });
  db.tickets.push(
    ticket(101, {}),                                                        // nuevo → «Recibimos tu ticket»
    ticket(102, { estado: 'en_curso', avance_email: 'recibido' }),          // avanza → «Ya lo estamos desarrollando»
    ticket(103, { estado: 'en_curso', avance_email: 'tu_respuesta' }),      // rebote: no
    ticket(104, { usuario_id: 3 }),                                         // apagó: no
    ticket(105, { canal: 'sistema' }),                                      // lo abrió el sistema: no
    ticket(106, { canal: 'chat_app', ref: 'np:abc' }),                      // automático por la persona: no
    ticket(107, { workspace_id: PLATAFORMA, usuario_id: 4 }),               // la plataforma: no
    ticket(108, { usuario_id: 5 }),                                         // suspendida: no
    ticket(109, { usuario_id: 6 }),                                         // de otro negocio: no
    ticket(110, { estado: 'resuelto', avance_email: 'en_curso', updated_at: hace(72) }), // viejo: no
    ticket(111, { estado: 'rechazado' }),                                   // cerrado: no
    ticket(112, { usuario_id: null, usuario_email: 'whatsapp:5215500000000' }), // sin cuenta: no
    ticket(113, { estado: 'resuelto', avance_email: 'en_curso', avisado_at: hace(0.5) }), // → «Tu ticket está resuelto»
    ticket(115, { usuario_id: 7 }),                                         // su email no es un email: no
  );
  const tk = (id: number) => db.tickets.find((t) => t.id === id)!;
  const R: Record<string, unknown> = {};

  const { avisarAvancesPorEmail } = await imp(CORRE.vuelta);
  const { linkBajaTickets, tokenBajaTickets, unsubscribeToken } = await imp('lib/resend.ts');

  // ── 1. Una vuelta: los tres que tocan, nada más ──────────────────────────────────────────────────────────────────────
  R.vuelta1 = await avisarAvancesPorEmail(ahora);
  R.correos1 = correos.map((c) => ({ to: c.to, asunto: c.asunto, from: c.from }));
  R.marcas1 = Object.fromEntries([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 115].map((id) => [id, tk(id).avance_email ?? null]));
  const c101 = correos.find((c) => c.asunto.includes('#101'))!;
  R.correo101 = { texto: c101.texto, html: c101.html, headers: c101.headers };
  R.bajaDe2 = linkBajaTickets(2);
  R.notas1 = db.ticket_eventos.map((e) => ({ id: e.ticket_id, texto: e.texto }));
  R.updatedSinTocar = tk(101).updated_at === hace(1);

  // ── 2. Otra vuelta enseguida: ni uno más ─────────────────────────────────────────────────────────────────────────────
  const antes2 = correos.length;
  R.vuelta2 = await avisarAvancesPorEmail(ahora);
  R.correos2 = correos.length - antes2;

  // ── 3. Dos vueltas A LA VEZ sobre un ticket nuevo: un solo correo ────────────────────────────────────────────────────
  db.tickets.push(ticket(120, {}));
  const antes3 = correos.length;
  await Promise.all([avisarAvancesPorEmail(ahora), avisarAvancesPorEmail(ahora)]);
  R.correos3 = correos.slice(antes3).map((c) => c.asunto);

  // ── 4. Resend falla: queda anotado y NO se repite (marcar antes de mandar) ───────────────────────────────────────────
  db.tickets.push(ticket(121, {}));
  resendCaido = true;
  R.vuelta4 = await avisarAvancesPorEmail(ahora);
  resendCaido = false;
  const antes4 = correos.length;
  R.vuelta4b = await avisarAvancesPorEmail(ahora);
  R.correos4b = correos.length - antes4;
  R.nota121 = db.ticket_eventos.filter((e) => e.ticket_id === 121).map((e) => e.texto);
  R.marca121 = tk(121).avance_email;

  // ── 5. La baja: GET no apaga, POST sí, y respeta el resto del perfil ─────────────────────────────────────────────────
  const { GET, POST } = await imp(CORRE.baja);
  const pedido = (url: string, metodo = 'GET', cuerpo?: string, tipo = 'application/x-www-form-urlencoded') =>
    new Request(url, { method: metodo, ...(cuerpo !== undefined ? { body: cuerpo, headers: { 'content-type': tipo } } : {}) });
  const url2 = String(R.bajaDe2);
  const g = await GET(pedido(url2));
  R.getStatus = g.status;
  R.getHtml = await g.text();
  R.perfilTrasGet = { ...(db.usuarios.find((u) => u.id === 2)!.perfil as Fila) };
  const p = await POST(pedido(url2, 'POST', 'accion=apagar'));
  R.postStatus = p.status;
  R.postHtml = await p.text();
  R.perfilTrasPost = { ...(db.usuarios.find((u) => u.id === 2)!.perfil as Fila) };
  // Apagado: un ticket nuevo suyo ya no manda nada.
  db.tickets.push(ticket(122, {}));
  const antes5 = correos.length;
  R.vuelta5 = await avisarAvancesPorEmail(ahora);
  R.correos5 = correos.length - antes5;
  // Volver a recibirlos.
  const pr = await POST(pedido(url2, 'POST', 'accion=prender'));
  R.prenderStatus = pr.status;
  R.perfilTrasPrender = { ...(db.usuarios.find((u) => u.id === 2)!.perfil as Fila) };
  // El «Cancelar suscripción» de Gmail (RFC 8058).
  const uno = await POST(pedido(url2, 'POST', 'List-Unsubscribe=One-Click'));
  R.unToque = { status: uno.status, body: await uno.json() };
  R.perfilTrasUnToque = { ...(db.usuarios.find((u) => u.id === 2)!.perfil as Fila) };
  // El mismo botón escribe la baja por DIRECCIÓN (mig 0410): las dos capas, en el mismo camino.
  R.bajasDeP2 = db.correo_bajas.filter((b) => b.email === 'p2@test.com').map((b) => ({ tipo: b.tipo, por: b.por }));
  // Firmas que no sirven: la de otra persona, la de la baja de un lead, una inventada.
  const conFirma = (u: number, t: string) => `https://mako.test/api/email/unsubscribe/tickets?u=${u}&t=${t}`;
  R.firmaAjena = (await POST(pedido(conFirma(3, tokenBajaTickets(2)), 'POST', 'accion=prender'))).status;
  R.firmaDeLead = (await GET(pedido(conFirma(2, unsubscribeToken(2))))).status;
  R.firmaInventada = (await GET(pedido(conFirma(2, '0'.repeat(32))))).status;
  R.perfil3 = { ...(db.usuarios.find((u) => u.id === 3)!.perfil as Fila) };

  // ── 5b. La baja es de la DIRECCIÓN, no de la cuenta (mig 0410) ───────────────────────────────────────────────────────
  // El agujero que arregla: la 9 y la 10 son la MISMA dirección en dos negocios (`usuarios(email)` no es único, 0053). Es
  // el caso de quien trabaja en su cuenta y en la de un cliente de su agencia. Con la baja guardada sólo en el perfil de
  // una fila, la otra le seguía escribiendo a la misma persona.
  // ⚠️ Va con un par de cuentas PROPIO y no toca a la 2: lo de arriba deja su perfil apagado a propósito, y el paso 7
  // cuenta con eso.
  const bajaDe9 = String(linkBajaTickets(9));
  db.tickets.push(ticket(140, { workspace_id: OTRO, usuario_id: 10, usuario_email: 'dos@test.com' }));
  const antes5b = correos.length;
  await avisarAvancesPorEmail(ahora);
  R.correos5bAntes = correos.slice(antes5b).map((c) => c.asunto);

  // Pide la baja desde el correo de la 9, y se prueba sobre un ticket de la OTRA cuenta (la 10).
  await POST(pedido(bajaDe9, 'POST', 'accion=apagar'));
  const bajasDeDos = () => db.correo_bajas.filter((b) => b.email === 'dos@test.com');
  R.bajasTrasApagar = bajasDeDos().map((b) => ({ email: b.email, tipo: b.tipo, por: b.por }));
  db.tickets.push(ticket(141, { workspace_id: OTRO, usuario_id: 10, usuario_email: 'dos@test.com' }));
  const antes5c = correos.length;
  R.vuelta5b = await avisarAvancesPorEmail(ahora);
  R.correos5b = correos.slice(antes5c).map((c) => c.asunto);

  // Y el caso que SÓLO la tabla puede frenar: una cuenta NUEVA con esa misma dirección, creada DESPUÉS de la baja. Su
  // perfil nace limpio (nadie le copió la marca), así que si la decisión mirara sólo el perfil, le escribiría.
  db.usuarios.push(persona(11, OTRO, { email: 'dos@test.com' }));
  db.tickets.push(ticket(144, { workspace_id: OTRO, usuario_id: 11, usuario_email: 'dos@test.com' }));
  const antes5bn = correos.length;
  R.vuelta5bNueva = await avisarAvancesPorEmail(ahora);
  R.correos5bNueva = correos.slice(antes5bn).map((c) => c.asunto);
  R.perfil11 = { ...(db.usuarios.find((u) => u.id === 11)!.perfil as Fila) };

  // Apretarlo dos veces no apila filas (`unique (email, tipo)` + upsert).
  await POST(pedido(bajaDe9, 'POST', 'accion=apagar'));
  R.bajasDosVeces = bajasDeDos().length;

  // «Volver a recibirlos» borra la fila: la baja se levanta para TODAS sus cuentas.
  await POST(pedido(bajaDe9, 'POST', 'accion=prender'));
  R.bajasTrasPrender = bajasDeDos().length;
  db.tickets.push(ticket(142, { workspace_id: OTRO, usuario_id: 10, usuario_email: 'dos@test.com' }));
  const antes5d = correos.length;
  await avisarAvancesPorEmail(ahora);
  R.correos5d = correos.slice(antes5d).map((c) => c.asunto);

  // Sin la 0410 no se manda NADA y lo dice: no se sabe quién pidió la baja, y escribirle a quien la pidió es peor que un
  // correo de menos. ⚠️ `faltan` y NO borrar la tabla del mock: una tabla que el mock no conoce contesta 200 y una lista
  // vacía, que es justo lo que un código que falla ABIERTO necesita para pasar el test.
  db.tickets.push(ticket(143, { usuario_id: 9, usuario_email: 'dos@test.com' }));
  pg.faltan.add('correo_bajas');
  const antes5e = correos.length;
  R.vuelta5sinTabla = await avisarAvancesPorEmail(ahora);
  R.correos5sinTabla = correos.length - antes5e;
  R.marca143sinTabla = tk(143).avance_email ?? null;
  pg.faltan.delete('correo_bajas');
  // Y con la tabla de vuelta, ese correo sale: el hito no se había reclamado.
  const antes5f = correos.length;
  await avisarAvancesPorEmail(ahora);
  R.correos5f = correos.slice(antes5f).map((c) => c.asunto);

  // ── 6. El cron de tickets la corre ───────────────────────────────────────────────────────────────────────────────────
  // ⚠️ VOLVER A PRENDERLOS SON DOS LUGARES desde la 0410: borrar la clave del perfil ya no alcanza, porque la baja por
  // DIRECCIÓN que dejó el One-Click de arriba vale para todas sus cuentas. Es el arreglo funcionando: con sólo esta
  // línea, el cron (abajo) no manda nada.
  (db.usuarios.find((u) => u.id === 2)!.perfil as Fila).ticketsPorEmail = undefined;
  delete (db.usuarios.find((u) => u.id === 2)!.perfil as Fila).ticketsPorEmail;
  db.correo_bajas = db.correo_bajas.filter((b) => b.email !== 'p2@test.com');
  db.tickets.push(ticket(130, {}));
  const { GET: cron } = await imp(CORRE.cron);
  const antes6 = correos.length;
  const rc = await cron(new Request('https://mako.test/api/cron/tickets', { headers: { authorization: 'Bearer cron-de-prueba' } }));
  R.cron = { status: rc.status, body: await rc.json() };
  R.correosCron = correos.slice(antes6).map((c) => c.asunto);

  R.red = red;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? `${e.message}\n${e.stack}` : String(e) })}`); });
