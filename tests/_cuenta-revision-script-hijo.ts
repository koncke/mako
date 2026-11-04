// =============================================================================
// Hijo de tests/cuenta-revision.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre scripts/tiendas-cuenta-revision.mts DE VERDAD, tres y cuatro veces, sobre el PostgREST de mentira y con una carpeta temporal
// para la contraseña. Lo que mira: qué queda en la base y en la carpeta, qué sale por la consola, y que frene cuando tiene que frenar.
// Necesita `--conditions=react-server`.
// =============================================================================

import { pathToFileURL } from 'node:url';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const RAIZ = new URL('..', import.meta.url);
const ruta = (p: string) => new URL(p, RAIZ).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const imp = (p: string) => import(pathToFileURL(ruta(p)).href);
type Fila = Record<string, unknown>;

class Salida extends Error { constructor(readonly codigo: number) { super(`exit ${codigo}`); } }

async function main() {
  const { crearPostgrest } = await imp('tests/_postgrest-de-mentira.ts');
  const { WS_REVISION, CUENTA_DE_REVISION } = await imp('lib/cuenta-revision-reglas.ts');
  let ids = 5000;
  const pg = crearPostgrest({
    tablas: ['app_settings', 'workspaces', 'usuarios', 'credenciales', 'evolution_instancias', 'agencia_clientes', 'usuario_contrasena', 'usuario_mfa',
      'usuario_passkeys', 'ia_pc_dispositivos', 'push_suscripciones', 'leads', 'funnels', 'productos', 'curso_clases', 'pipeline_stages', 'lead_funnel'],
    defaults: (_t: string, f: Fila) => ({ id: ids++, created_at: new Date().toISOString(), ...f }),
  });
  const db = pg.db as Record<string, Fila[]>;
  let fallarLimpieza = false;
  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : (entrada as Request).url);
    // La limpieza que falla (paso 6 de abajo): borrar sus passkeys contesta un 500, como una base que no contesta.
    if (u.host === 'supa.test' && fallarLimpieza && u.pathname.endsWith('/usuario_passkeys') && (init.method ?? 'GET').toUpperCase() === 'DELETE') {
      return new Response(JSON.stringify({ message: 'la base no contesta' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
    if (u.host === 'supa.test') return pg.responder(u, init);
    return new Response(JSON.stringify({ error: `red de mentira: ${u.host}` }), { status: 500 });
  }) as typeof fetch;
  Object.assign(process.env, {
    NEXT_PUBLIC_SUPABASE_URL: 'http://supa.test', SUPABASE_URL: 'http://supa.test', SUPABASE_SERVICE_ROLE_KEY: 'service-role-de-prueba',
    CREDENCIALES_SECRET: 'secreto-de-prueba-para-cifrar-las-credenciales-R', APP_BASE_URL: 'https://mako.test', AUTH_SECRET: 'secreto-de-firma-de-prueba-script',
  });
  db.workspaces.push({ id: 9, nombre: 'MaKo', capa: 'superadmin', estado: 'activo' });

  const carpeta = mkdtempSync(join(tmpdir(), 'mako-revision-'));
  const consola: string[] = [];
  const log = console.log, err = console.error, warn = console.warn;
  const salirReal = process.exit;
  let vuelta = 0;
  /** Corre el script como lo corre el Cerebro: con sus argumentos; `process.exit` vuelve un código en vez de matar al hijo. */
  const correr = (...extra: string[]) => correrScript('tiendas-cuenta-revision.mts', '--carpeta', carpeta, ...extra);
  const correrScript = async (script: string, ...extra: string[]): Promise<number> => {
    process.argv = [process.argv[0], script, ...extra];
    console.log = console.error = console.warn = (...a: unknown[]) => { consola.push(a.map(String).join(' ')); };
    process.exit = ((c?: number) => { throw new Salida(c ?? 0); }) as typeof process.exit;
    try {
      await import(`${pathToFileURL(ruta(`scripts/${script}`)).href}?vuelta=${++vuelta}`);
      return 0;
    } catch (e) {
      if (e instanceof Salida) return e.codigo;
      consola.push(`EXCEPCIÓN: ${e instanceof Error ? e.message : String(e)}`);
      return 99;
    } finally {
      console.log = log; console.error = err; console.warn = warn; process.exit = salirReal;
    }
  };
  const archivos = () => readdirSync(carpeta).sort();
  const contrasenaDe = (f: string) => { try { return /Contraseña: (\S+)/.exec(readFileSync(join(carpeta, f), 'utf8'))?.[1] ?? null; } catch { return null; } };
  const R: Record<string, unknown> = {};

  // 1. La primera vez: crea su negocio con ESE número, la persona closer, la contraseña en un archivo y los leads de ejemplo.
  R.primera = await correr();
  const u = db.usuarios.find((x) => x.email === CUENTA_DE_REVISION.email);
  R.negocio = db.workspaces.find((w) => w.id === WS_REVISION) ? WS_REVISION : null;
  R.persona = u ? { ws: u.workspace_id, rol: u.rol, rolWs: u.rol_ws, estado: u.estado } : null;
  R.archivos1 = archivos();
  const primera = contrasenaDe(archivos()[0] ?? 'x');
  R.conContrasena = !!primera && db.usuario_contrasena.some((c) => c.usuario_id === u?.id);
  R.leads = db.leads.filter((l) => l.workspace_id === WS_REVISION).map((l) => String(l.email));

  // 2. Otra vez sin --rotar: frena, y la contraseña que tienen Play y Apple sigue igual.
  const hashAntes = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash;
  R.segundaSinRotar = await correr();
  R.mismaContrasena = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash === hashAntes;
  R.archivos2 = archivos();

  // 3. Con --rotar: un archivo NUEVO (el viejo queda como estaba), y se va lo que sobreviviría a la rotación.
  db.ia_pc_dispositivos.push({ id: 1, workspace_id: WS_REVISION, persona: CUENTA_DE_REVISION.email, revocado_at: null });
  db.push_suscripciones.push({ id: 1, usuario_id: u?.id, endpoint: 'https://push.test/1' });
  db.usuario_mfa.push({ id: 1, usuario_id: u?.id, tipo: 'totp' });
  R.rotar = await correr('--rotar');
  R.archivos3 = archivos();
  R.archivoViejoIntacto = contrasenaDe('cuenta-revision.txt') === primera;
  const nuevo = archivos().find((f) => f !== 'cuenta-revision.txt');
  R.contrasenaNueva = !!nuevo && !!contrasenaDe(nuevo) && contrasenaDe(nuevo) !== primera;
  R.pcRevocada = db.ia_pc_dispositivos[0].revocado_at != null;
  R.avisosDelTelefono = db.push_suscripciones.length;
  R.segundoFactor = db.usuario_mfa.length;
  R.leadsDespues = db.leads.filter((l) => l.workspace_id === WS_REVISION).length;

  // 4. Con algo de verdad adentro (una credencial), frena antes de tocar la contraseña.
  db.credenciales.push({ id: 1, workspace_id: WS_REVISION, clave: 'RESEND_API_KEY', valor: 'x' });
  const hashRotado = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash;
  R.conCredencial = await correr('--rotar');
  R.noTocoLaContrasena = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash === hashRotado;
  db.credenciales.length = 0;
  db.productos.push({ id: 1, workspace_id: WS_REVISION, nombre: 'Curso de Mau' });
  R.conProducto = await correr('--rotar');
  db.productos.length = 0;
  db.leads.push({ id: 99, workspace_id: WS_REVISION, nombre: 'Una persona real', email: 'real@cliente.com' });
  R.conLeadDeVerdad = await correr('--rotar');
  R.archivosAlFinal = archivos().length;

  // 6. Si no puede sacar lo que sobreviviría a la rotación, termina con ERROR y sin tocar la contraseña ni dejar un archivo nuevo.
  db.leads.splice(db.leads.findIndex((l) => l.id === 99), 1);
  fallarLimpieza = true;
  const hashAntesDeFallar = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash;
  const archivosAntesDeFallar = archivos().length;
  R.limpiezaFallida = await correr('--rotar');
  R.limpiezaNoTocoLaContrasena = db.usuario_contrasena.find((c) => c.usuario_id === u?.id)?.hash === hashAntesDeFallar;
  R.limpiezaSinArchivoNuevo = archivos().length === archivosAntesDeFallar;
  fallarLimpieza = false;

  // 7. Revertir (scripts/tiendas-cuenta-revision-revertir.mts). Sin elegir, nada; --corte la suspende y no borra nada.
  const revertir = (...extra: string[]) => correrScript('tiendas-cuenta-revision-revertir.mts', ...extra);
  R.revertirSinElegir = await revertir();
  R.corte = await revertir('--corte');
  R.cortada = { estado: db.usuarios.find((x) => x.id === u?.id)?.estado ?? null, negocio: db.workspaces.some((w) => w.id === WS_REVISION) };
  // --total frena con alguien más adentro, o con un negocio que se llama distinto, sin borrar nada.
  db.usuarios.push({ id: 6001, email: 'otra@persona.test', nombre: 'Otra', rol: 'usuario', rol_ws: 'closer', workspace_id: WS_REVISION, estado: 'activo' });
  R.totalConOtraPersona = await revertir('--total');
  db.usuarios.splice(db.usuarios.findIndex((x) => x.id === 6001), 1);
  const ws = db.workspaces.find((w) => w.id === WS_REVISION)!;
  ws.nombre = 'Un negocio de verdad';
  R.totalConOtroNombre = await revertir('--total');
  ws.nombre = 'Negocio de demostración';
  R.nadaBorradoAntes = { negocio: db.workspaces.some((w) => w.id === WS_REVISION), persona: db.usuarios.some((x) => x.id === u?.id) };
  // Y --total de verdad: la persona y el negocio, fuera.
  R.total = await revertir('--total');
  R.despuesDelTotal = { negocio: db.workspaces.some((w) => w.id === WS_REVISION), persona: db.usuarios.some((x) => x.id === u?.id), leads: db.leads.filter((l) => l.workspace_id === WS_REVISION).length };
  R.totalOtraVez = await revertir('--total');

  // 5. La contraseña nunca sale por la consola.
  const todas = archivos().map(contrasenaDe).filter(Boolean) as string[];
  R.contrasenaEnLaConsola = consola.some((l) => todas.some((c) => l.includes(c)));
  R.consola = consola.filter((l) => /⛔|✓/.test(l)).map((l) => l.slice(0, 120));
  rmSync(carpeta, { recursive: true, force: true });
  console.log(`@@RESULTADO@@${JSON.stringify(R)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
