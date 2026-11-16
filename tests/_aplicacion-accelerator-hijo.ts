// =============================================================================
// Hijo de tests/aplicacion-accelerator.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La aplicación a MaKo Accelerator ENTERA, sobre un PostgREST de mentira: corren REALES `POST /api/accelerator/aplicar` y
// `aplicarAlAccelerator` (lib/aplicacion-accelerator-servidor.ts: el lead, su historial, «Quieren entrar»), y lo que se le
// manda a Martín se arma con el render de verdad de un correo (lib/email-html.ts). Sólo el envío del correo y el workspace van de
// mentira. Es lo que en producción no se puede probar sin dejar un lead y un correo de verdad.
// Necesita `--conditions=react-server` y `--experimental-test-module-mocks`. Imprime el resultado como JSON.

import { mock } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearPostgrest } from './_postgrest-de-mentira';

const RAIZ = join(import.meta.dirname, '..');
process.env.SUPABASE_URL = 'https://supa.test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'clave-de-prueba';
process.env.SUPABASE_SERVICE_KEY = 'clave-de-prueba';

const pg = crearPostgrest({
  tablas: ['pedidos_ingreso', 'usuarios', 'leads', 'lead_audit', 'app_settings', 'workspaces', 'credenciales', 'funnels', 'cobros', 'agencia_clientes', 'agencia_altas'],
  defaults: (tabla, f) => {
    const n = (pg.db[tabla]?.length ?? 0) + 1;
    return {
      id: n, ...(tabla === 'pedidos_ingreso' ? { intentos: 1, estado: 'pendiente' } : {}),
      // Como la base (mig 0026, `DEFAULT now()`): el reenvío de la misma aplicación se busca en las últimas 24 h.
      ...(tabla === 'lead_audit' ? { created_at: new Date().toISOString() } : {}), ...f,
    };
  },
});
const db = pg.db;
db.workspaces = [{ id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' }];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') {
    // El PostgREST de mentira no entiende `ilike`: `leadDelComprador` busca el correo exacto, sin comodines.
    const correo = u.searchParams.get('email');
    if (correo?.startsWith('ilike.')) u.searchParams.set('email', `eq.${correo.slice(6)}`);
    // Los parecidos de `createLead` buscan el teléfono con `ilike.%<dígitos>`: como `like`, que sí entiende.
    const tel = u.searchParams.get('telefono_normalizado');
    if (tel?.startsWith('ilike.')) u.searchParams.set('telefono_normalizado', `like.${tel.slice(6)}`);
    return pg.responder(u, init);
  }
  throw new Error(`fetch sin mock: ${u.href}`);
}) as typeof fetch;

/** Todo lo que el módulo exporta, de mentira; arriba, lo que este arnés necesita. Un nombre que falta no carga el módulo. */
function stub(rel: string, propios: Record<string, unknown>): void {
  const src = readFileSync(join(RAIZ, rel), 'utf8');
  const nombres = [...src.matchAll(/^export (?:async )?(?:function\*? |const |let )(\w+)/gm)].map((m) => m[1]);
  const namedExports: Record<string, unknown> = {};
  for (const n of nombres) namedExports[n] = () => { throw new Error(`${rel}: ${n} sin mock`); };
  mock.module(pathToFileURL(join(RAIZ, rel)).href, { namedExports: { ...namedExports, ...propios } });
}

type Correo = { to: string; tag: string; asunto: string; preheader: string; cuerpo: string; idempotencyKey?: string };
const correos: Correo[] = [];
/** Cada vez que la ruta PIDE un correo (salga o no), con su clave. */
const pedidosDeCorreo: Array<{ to: string; clave: string | null }> = [];
/** Las claves que Resend ya mandó (24 h): con la misma, contesta lo de antes y no manda otro. */
const yaMandadas = new Set<string>();
// 'cuelga' = el Resend colgado del hallazgo 5: con la clave, el envío corta a los 15 s (lib/resend.ts) y no salió.
let correo: 'sale' | 'tira' | 'no-sale' | 'cuelga' = 'sale';
stub('lib/invitaciones.ts', {
  avisarDePlataforma: async (m: Correo) => {
    pedidosDeCorreo.push({ to: m.to, clave: m.idempotencyKey ?? null });
    // Sin la clave, un Resend colgado no tiene tiempo máximo y se come la ruta entera (revisión del 16/11/2026, hallazgo 5).
    if (!m.idempotencyKey) throw new Error('el correo de la aplicación salió sin idempotencyKey');
    if (correo === 'tira') throw new Error('Resend no contestó');
    if (correo === 'no-sale') return { enviado: false, error: 'remitente de prueba' };
    if (correo === 'cuelga') return { enviado: false, error: 'The operation was aborted due to timeout' };
    if (yaMandadas.has(m.idempotencyKey)) return { enviado: true };
    yaMandadas.add(m.idempotencyKey);
    correos.push(m);
    return { enviado: true };
  },
});
// El aviso en la app cuando el correo no sale (la bandeja y el push): de mentira, para contarlo.
const avisosEnLaApp: Array<{ ws: number; texto: string; tipo?: string; titulo?: string }> = [];
stub('lib/aviso-en-la-app.ts', {
  avisoSoloEnLaApp: async (ws: number, texto: string, o: { tipo?: string; titulo?: string } = {}) => { avisosEnLaApp.push({ ws, texto, ...o }); return true; },
});
// Lo que la ruta escribe en el log (la trampa tiene que dejar rastro).
const avisosDelLog: string[] = [];
const warnDeVerdad = console.warn.bind(console);
console.warn = (...a: unknown[]) => { avisosDelLog.push(a.map(String).join(' ')); void warnDeVerdad; };
// Si la ruta (o lo que llama) leyera la sesión, esto lo cuenta: no tiene que pasar nunca.
let lecturasDeSesion = 0;
stub('lib/auth.ts', {
  getSesionAdmin: async () => { lecturasDeSesion++; return null; },
  getUsuarioActual: async () => { lecturasDeSesion++; return null; },
});

const LLENA = {
  nombre: 'Ana', apellido: 'Pérez', whatsapp: '+54 9 11 5555-0101', email: 'Ana@EstudioAna.com',
  cuenta: 2, negocio: 'Estudio Ana', rubro: 0, instagram: 'https://www.instagram.com/ana.coach/', youtube: '@anacoach', antiguedad: 3, clientes: 2, ticket: 2, audiencia: 1,
  facturacion: 1, equipo: 1, implementa: 0, situacion: 0, canal: [0, 2], tecnologia: 1,
  queHaces: 'Acompaño a coaches de salud a armar su programa grupal.\n\nY lo venden por encima de US$ 2.000.',
  meta: 'Llegar a US$ 20.000 por mes con el programa grupal.',
  // Lo que escribe cualquiera en un formulario público, y va a un correo.
  obstaculo: 'Me frena <script>alert(1)</script> y <img src=x onerror=alert(2)> todo lo demás.',
  porQue: 'Porque ya validé la oferta con 14 clientes y ejecuto rápido.',
  horas: 1, inversion: 1, decision: 0, empezar: 0, compromiso: true,
};

async function main() {
  const { getSupabaseServer } = await import('../lib/supabase');
  stub('lib/workspace.ts', {
    runWithWorkspace: async (_ws: number, f: () => unknown) => f(),
    getTenantDb: async () => getSupabaseServer(),
    getWorkspaceActual: async () => 9,
    wsSuperAdmin: async () => 9,
    getWorkspace: async () => db.workspaces[0],
  });
  const { POST } = await import('../app/api/accelerator/aplicar/route');
  const { NextRequest } = await import('next/server');
  const { renderEmailHtml } = await import('../lib/email-html');
  const { TEXTO_NO_SE_GUARDO } = await import('../lib/aplicacion-accelerator-servidor');

  let ip = 0;
  const aplicar = async (body: unknown, o: { origin?: string | null; ip?: string; crudo?: string; largo?: string } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': o.ip ?? `10.0.0.${++ip}` };
    if (o.origin !== null) headers.origin = o.origin ?? 'https://hola-mako.com';
    if (o.largo) headers['content-length'] = o.largo;
    const r = await POST(new NextRequest('https://hola-mako.com/api/accelerator/aplicar', { method: 'POST', headers, body: o.crudo ?? JSON.stringify(body) }));
    return { status: r.status, body: await r.json() };
  };
  const filas = () => ({ leads: db.leads.length, audit: db.lead_audit.length, pedidos: db.pedidos_ingreso.length, correos: correos.length });
  const out: Record<string, unknown> = {};

  // ── Califica: el lead, su historial, «Quieren entrar» y el correo ──
  out.califica = await aplicar({ respuestas: LLENA, web: '', origen: { landing: 'accelerator', utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR123', otra: 'x' } });
  out.lead = db.leads.map((l) => ({ nombre: l.nombre, email: l.email, telefono: l.telefono, origen_lead: l.origen_lead, utm_source: l.utm_source, utm_campaign: l.utm_campaign, fbclid: l.fbclid }));
  out.historial = db.lead_audit.map((a) => ({ lead: a.lead_id, campo: a.campo, valor: a.valor_nuevo, autor: a.autor }));
  out.pedido = db.pedidos_ingreso.map((f) => ({ email: f.email, nombre: f.nombre, origen: f.origen, detalle: f.detalle, whatsapp: f.whatsapp, lead_id: f.lead_id }));
  out.correo = correos[0] ?? null;
  out.claveDelCorreo = pedidosDeCorreo[0]?.clave ?? null;
  out.html = correos[0] ? renderEmailHtml({ subject: correos[0].asunto, bodyText: correos[0].cuerpo, preheader: correos[0].preheader, fromName: 'MaKo' }) : '';

  // ── No califica (factura menos de US$ 5.000): llega igual, y el correo lo dice ──
  out.noCalifica = await aplicar({ respuestas: { ...LLENA, email: 'beto@ejemplo.com', nombre: 'Beto', facturacion: 0 }, web: '' });
  out.correoNoCalifica = correos[1] ? { asunto: correos[1].asunto, preheader: correos[1].preheader, cuerpo: correos[1].cuerpo } : null;

  // ── La misma aplicación otra vez (la respuesta se perdió y volvió a tocar «Enviar»): no se guarda ni se avisa dos veces ──
  const antesDeRepetir = filas();
  // Desde el mismo navegador: la misma campaña (el formulario la guarda con el borrador), así que el MISMO correo y la misma clave.
  out.repetida = await aplicar({ respuestas: LLENA, web: '', origen: { landing: 'accelerator', utm_source: 'fb', utm_campaign: 'acc-nov', fbclid: 'IwAR123', otra: 'x' } });
  out.repetidaDeja = filas();
  out.repetidaAntes = antesDeRepetir;
  // El reenvío vuelve a PEDIR el correo, con la MISMA clave: si la primera vez salió, Resend no manda otro (hallazgo 5).
  out.repetidaPideElCorreo = pedidosDeCorreo.filter((x) => x.clave === out.claveDelCorreo).length;
  out.pedidoDeAna = db.pedidos_ingreso.filter((f) => f.email === 'ana@estudioana.com').map((f) => f.intentos);
  // La misma persona, con una respuesta corregida: ésa SÍ llega (es la versión nueva), y en su ficha ya existente, sin verificar.
  out.corregida = await aplicar({ respuestas: { ...LLENA, porQue: 'Porque ya validé la oferta con 15 clientes, no 14.' }, web: '' });
  out.historialDeAna = db.lead_audit.filter((a) => a.lead_id === 1 && a.campo === 'Aplicación').map((a) => String(a.valor_nuevo).slice(0, 60));
  out.correosTrasCorregir = filas().correos - antesDeRepetir.correos;

  // ── La trampa llena: no guarda nada, pero deja rastro en el log y le llega a Martín como «Posible bot» ──
  const antesTrampa = filas();
  const logAntes = avisosDelLog.length;
  out.trampa = await aplicar({ respuestas: { ...LLENA, email: 'bot@ejemplo.com' }, web: 'https://spam.example' });
  out.trampaDeja = { ...filas(), antes: antesTrampa };
  out.trampaCorreo = correos.length > antesTrampa.correos ? { asunto: correos[correos.length - 1].asunto, cuerpo: correos[correos.length - 1].cuerpo } : null;
  out.trampaLog = avisosDelLog.slice(logAntes);
  // Con la trampa llena y una aplicación que no vale: nada (ni correo), y el log lo dice.
  const antesTrampaMal = filas();
  const logAntesMal = avisosDelLog.length;
  out.trampaMal = await aplicar({ respuestas: { ...LLENA, email: 'bot2@ejemplo.com', facturacion: 9 }, web: 'x' });
  out.trampaMalDeja = JSON.stringify(filas()) === JSON.stringify(antesTrampaMal);
  out.trampaMalLog = avisosDelLog.slice(logAntesMal);

  // ── Lo que NO entra, y no deja nada ──
  const antes = filas();
  out.otroSitio = await aplicar({ respuestas: { ...LLENA, email: 'ajeno@ejemplo.com' } }, { origin: 'https://sitio-ajeno.com' });
  out.sinOrigin = await aplicar({ respuestas: { ...LLENA, email: 'sin@ejemplo.com' } }, { origin: null });
  out.whatsappMal = await aplicar({ respuestas: { ...LLENA, email: 'wa@ejemplo.com', whatsapp: '12345' } });
  // Un número local, sin código de país (México): antes se guardaba +5512345678, de Brasil.
  out.whatsappLocal = await aplicar({ respuestas: { ...LLENA, email: 'mx@ejemplo.com', whatsapp: '55 1234 5678' } });
  out.indiceFuera = await aplicar({ respuestas: { ...LLENA, email: 'idx@ejemplo.com', facturacion: 9 } });
  out.muyLargaCampo = await aplicar({ respuestas: { ...LLENA, email: 'largo@ejemplo.com', meta: 'a'.repeat(2001) } });
  out.cuerpoDeclaradoGrande = await aplicar({ respuestas: LLENA }, { largo: String(70 * 1024) });
  out.cuerpoGrande = await aplicar(null, { crudo: JSON.stringify({ respuestas: LLENA, relleno: 'x'.repeat(70 * 1024) }) });
  out.noEsJson = await aplicar(null, { crudo: '{"respuestas": ' });
  out.nadaNuevo = JSON.stringify(filas()) === JSON.stringify(antes);

  // ── La ficha de OTRA persona (vino de un opt-in, sin teléfono): alguien aplica con ese email y SU número. Nada se escribe en ella ──
  db.leads.push({ id: 70, nombre: 'Laura Gómez', email: 'laura@clinica.com', telefono: null, telefono_normalizado: null });
  out.fichaAjena = await aplicar({ respuestas: { ...LLENA, email: 'laura@clinica.com', nombre: 'Otro', apellido: 'Tipo', whatsapp: '+52 1 55 9999 8888' }, web: '' });
  const laura = db.leads.find((l) => l.id === 70)!;
  out.laura = { nombre: laura.nombre, telefono: laura.telefono ?? null, norm: laura.telefono_normalizado ?? null };
  out.historialDeLaura = db.lead_audit.filter((a) => a.lead_id === 70).map((a) => ({ campo: a.campo, valor: String(a.valor_nuevo), autor: a.autor }));

  // ── El mismo número que una ficha de un grupo (sin email): la aplicación va a esa ficha, y el email NO se le escribe ──
  db.leads.push({ id: 80, nombre: 'Juan (grupo)', email: null, telefono: '+5491144443333', telefono_normalizado: '5491144443333' });
  out.mismoNumero = await aplicar({ respuestas: { ...LLENA, email: 'otra@persona.com', nombre: 'Otra', apellido: 'Persona', whatsapp: '+54 9 11 4444 3333' }, web: '' });
  const juan = db.leads.find((l) => l.id === 80)!;
  out.juan = { nombre: juan.nombre, email: juan.email ?? null };
  out.historialDeJuan = db.lead_audit.filter((a) => a.lead_id === 80).map((a) => ({ campo: a.campo, valor: String(a.valor_nuevo) }));

  // ── «Quieren entrar»: una fila que Google ya verificó; alguien aplica con ese email, otro nombre y otro número. Sólo suma el intento ──
  db.pedidos_ingreso.push({ id: 500, email: 'marta@empresa.com', nombre: 'Marta Verificada', origen: 'google', correo_verificado: true, detalle: null, whatsapp: null, lead_id: null, intentos: 1, estado: 'pendiente', primer_at: 'x', ultimo_at: 'x' });
  out.martaAplica = await aplicar({ respuestas: { ...LLENA, email: 'marta@empresa.com', nombre: 'Impostor', apellido: 'Xu', whatsapp: '+1 305 555 0000' }, web: '' });
  const marta = db.pedidos_ingreso.find((f) => f.id === 500)!;
  out.marta = { nombre: marta.nombre, whatsapp: marta.whatsapp, origen: marta.origen, correo_verificado: marta.correo_verificado, detalle: marta.detalle, lead_id: marta.lead_id, intentos: marta.intentos };
  out.filasDeMarta = db.pedidos_ingreso.filter((f) => f.email === 'marta@empresa.com').length;

  // ── Topes: por email (4 por hora, desde IPs distintas) y por IP (10 por hora) ──
  const porEmail = [];
  for (let i = 0; i < 5; i++) porEmail.push((await aplicar({ respuestas: { ...LLENA, email: 'insiste@ejemplo.com' } })).status);
  out.porEmail = porEmail;
  const porIp = [];
  for (let i = 0; i < 11; i++) porIp.push((await aplicar({ respuestas: { ...LLENA, email: `ip${i}@ejemplo.com` }, web: 'bot' }, { ip: '203.0.113.9' })).status);
  out.porIp = porIp;

  // ── EL RESEND COLGADO (hallazgo 5 de la revisión): la aplicación queda en la ficha, el correo no sale (cortó a los 15 s) y la
  //    persona reenvía. Antes `yaLlego` contestaba «ok» sin volver a mandarlo, y a Martín no le llegaba nunca. ──
  correo = 'cuelga';
  const colgadoAntes = { correos: correos.length, avisos: avisosEnLaApp.length };
  const COLGADA = { ...LLENA, email: 'colgada@ejemplo.com', nombre: 'Cora' };
  out.colgadaPrimera = await aplicar({ respuestas: COLGADA, web: '' });
  out.colgadaAvisoEnLaApp = avisosEnLaApp.length - colgadoAntes.avisos;
  correo = 'sale';
  out.colgadaReenvio = await aplicar({ respuestas: COLGADA, web: '' });
  out.colgadaCorreos = correos.slice(colgadoAntes.correos).filter((c) => c.cuerpo.includes('colgada@ejemplo.com')).length;
  out.colgadaAplicaciones = db.lead_audit.filter((a) => a.campo === 'Aplicación' && String(a.valor_nuevo).includes('Cora')).length;
  const clavesColgada = pedidosDeCorreo.filter((x, i) => i >= pedidosDeCorreo.length - 2).map((x) => x.clave);
  out.colgadaMismaClave = clavesColgada.length === 2 && clavesColgada[0] === clavesColgada[1];

  // ── Nunca se pierde ──
  correo = 'tira';
  const avisosAntes = avisosEnLaApp.length;
  out.conElCorreoCaido = await aplicar({ respuestas: { ...LLENA, email: 'sin-correo@ejemplo.com' } });
  out.leadSinCorreo = db.leads.some((l) => l.email === 'sin-correo@ejemplo.com');
  out.avisoSinCorreo = avisosEnLaApp.slice(avisosAntes);
  correo = 'sale';
  pg.faltan.add('leads');
  const correosAntes = correos.length;
  const avisosAntesBase = avisosEnLaApp.length;
  out.conLaBaseCaida = await aplicar({ respuestas: { ...LLENA, email: 'sin-base@ejemplo.com' } });
  out.correoSinBase = correos.slice(correosAntes).map((c) => c.cuerpo);
  out.avisoConLaBaseCaida = avisosEnLaApp.length - avisosAntesBase;
  correo = 'no-sale';
  const avisosAntesTodo = avisosEnLaApp.length;
  out.conTodoCaido = await aplicar({ respuestas: { ...LLENA, email: 'nada@ejemplo.com' } });
  out.avisoConTodoCaido = avisosEnLaApp.slice(avisosAntesTodo);
  out.textoNoSeGuardo = TEXTO_NO_SE_GUARDO;
  pg.faltan.delete('leads');
  correo = 'sale';

  out.lecturasDeSesion = lecturasDeSesion;
  process.stdout.write(`@@RESULTADO@@${JSON.stringify(out)}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
