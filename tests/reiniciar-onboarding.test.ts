// «Reiniciar onboarding» (20/11/2026; Martín: «resetear al usuario sin que pierda su información… que pueda resetear el onboarding»).
// Lo que se reinicia y lo que queda (lib/reiniciar-onboarding.ts), que el server no toque nada fuera de eso, que el navegador se limpie
// (si no, le devuelve lo visto a la base), el botón de la vista de administrador y el paso del WhatsApp con el número que ya tenía.
// Roto a propósito el 20/11 (cada uno cae): el WhatsApp verificado sumado a lo que se borra (1 y 3), el server leyendo leads (3), la
// guardia borrada con su bloqueo (2), la BAJA perdida (2), el navegador sin limpiar el «dale play» (5), el script aplicando sin mostrar
// antes (3), la ruta sin getSesionAdmin (6), y la tarjeta del WhatsApp sin el número verificado (onboarding-whatsapp-primero, 6).
// Y el respaldo (7): escribiendo adentro de un repo, con un `.git` archivo (worktree) que no cuenta, pisando uno anterior, el script
// escribiendo donde corre, y el .gitignore sin `respaldo-*.json`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  LO_QUE_QUEDA, SETTINGS_QUE_MIRA, SETTINGS_QUE_SE_BORRAN, TABLAS_QUE_TOCA, PREFIJO_TUTORIAL, perfilReiniciado, planDeSettings,
} from '../lib/reiniciar-onboarding';
import { CLAVES_DEL_NAVEGADOR, CLAVE_LIMPIADO, CLAVE_REINICIO, reinicioDelPerfil, scriptDelReinicio } from '../lib/reinicio-en-el-navegador';
import { estadoDeLoGuardado } from '../lib/onboarding-contrato';
import { carpetaDeRespaldos, escribirRespaldo, repoQueLaContiene } from '../lib/respaldo-fuera-del-repo';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. lo que se reinicia: el arranque, el chat «Onboarding», el reto; el estado vuelve a pendiente con el cursor de la importación', () => {
  const extraction = { status: 'done', cursor: 'abc', jobs: { contactos: { status: 'done' } } };
  const filas = [
    { key: 'onboarding.arranque', value: '{"nombre":"Leila","telefono":"verificado"}' },
    { key: 'onboarding.historial', value: '[{"id":"arr-listo"}]' },
    { key: 'onboarding.cerrando', value: '{"at":"x"}' },
    { key: 'reto.estado', value: '{"v":1,"inicio":"2026-11-01T00:00:00Z","hechas":{"1:offer":"x"}}' },
    { key: 'onboarding.state', value: JSON.stringify({ version: 1, status: 'done', step: 'retro', completedAt: '2026-11-02', extraction }) },
  ];
  const plan = planDeSettings(filas);
  const de = (k: string) => plan.find((c) => c.key === k);
  for (const k of SETTINGS_QUE_SE_BORRAN) assert.equal(de(k)?.despues, null, `${k} se borra`);
  const estado = estadoDeLoGuardado(de('onboarding.state')!.despues);
  assert.equal(estado.status, 'pending', 'vuelve al onboarding');
  assert.equal(estado.completedAt ?? null, null);
  assert.equal((estado.extraction as unknown as { cursor?: string }).cursor, 'abc', 'la importación no se repite (gasto de IA)');
});

test('2. lo que queda adentro de lo que se reinicia: el bloqueo por troleo y la BAJA del WhatsApp del reto', () => {
  const conBloqueo = '{"turnos":9,"bloqueo":{"at":"x","motivo":"troleo"}}';
  assert.deepEqual(planDeSettings([{ key: 'onboarding.guardia', value: conBloqueo }]), [], 'con bloqueo, la guardia queda entera');
  assert.equal(planDeSettings([{ key: 'onboarding.guardia', value: '{"turnos":9}' }])[0]?.despues, null, 'sin bloqueo, se borran los contadores');
  const avisos = planDeSettings([{ key: 'reto.avisos', value: '{"v":1,"dia":5,"baja":"2026-11-10T00:00:00Z","cierre":"x"}' }])[0];
  assert.deepEqual(JSON.parse(avisos.despues!), { v: 1, dia: 1, baja: '2026-11-10T00:00:00Z' }, 'de cero, con su BAJA');
  assert.equal(planDeSettings([{ key: 'reto.avisos', value: '{"v":1,"dia":5}' }])[0]?.despues, null);
});

test('3. lo que NUNCA se toca: el WhatsApp verificado y lo que el onboarding dejó como dato (cae si alguien lo suma a la lista)', () => {
  for (const k of SETTINGS_QUE_MIRA) {
    assert.match(k, /^(onboarding|reto)\./, `${k}: sólo estado del onboarding o del reto`);
    assert.ok(!(LO_QUE_QUEDA.settings as readonly string[]).includes(k), `${k} está en lo que queda`);
    assert.ok(!LO_QUE_QUEDA.prefijos.some((p) => k.startsWith(p)), `${k}: los onboardings de cada pestaña quedan`);
  }
  for (const k of ['mako.contacto.verificacion', 'mako.numero_dueno', 'funnel_coach.plan', 'onboarding_v2.offer_coach', 'reto.clip-regalo']) {
    assert.ok((LO_QUE_QUEDA.settings as readonly string[]).includes(k), `${k} queda`);
  }
  // Una clave que no es del reinicio no aparece aunque se la pase.
  assert.deepEqual(planDeSettings([{ key: 'mako.contacto.verificacion', value: '{"verificado":true}' }, { key: 'funnel_coach.plan', value: '{}' }]), []);
  // El server sólo toca `app_settings` (con la lista) y el perfil del dueño: una tabla de datos más, y cae.
  const srv = sinComentarios(leer('lib/reiniciar-onboarding-server.ts'));
  const tablas = [...new Set([...srv.matchAll(/\.from\('([a-z_]+)'\)/g)].map((m) => m[1]))].sort();
  assert.deepEqual(tablas, [...TABLAS_QUE_TOCA].sort(), 'sólo app_settings y usuarios');
  for (const t of LO_QUE_QUEDA.tablas) assert.doesNotMatch(srv, new RegExp(`['"\`]${t}['"\`]`), `${t} ni se nombra`);
  assert.match(srv, /\.from\('app_settings'\)\.select\('key, value, updated_at'\)\.eq\('workspace_id', ws\)\.in\('key', \[\.\.\.SETTINGS_QUE_MIRA\]\)/, 'lee sólo la lista');
  assert.equal((srv.match(/\.from\('app_settings'\)\.(delete|update)\(/g) ?? []).length, 2, 'borra o reescribe sólo lo que planeó');
  assert.match(srv, /\.from\('usuarios'\)\.update\(\{ perfil: perfil\.perfil, updated_at: ahora \}\)\.eq\('id', fila\.id\)/, 'del dueño, sólo el perfil');
  assert.match(srv, /if \(ws === OWNER_WS\) throw/);
  assert.match(srv, /if \(\(await agenciasAprobadasDe\(ws\)\)\.length > 0\) \{/, 'el cliente de una agencia, no: le movería el cobro');
  // El script no escribe por su cuenta: llama a la misma función.
  const script = sinComentarios(leer('scripts/reiniciar-onboarding.mts'));
  assert.doesNotMatch(script, /\.from\(|sql`|postgres/);
  assert.match(script, /await reiniciarOnboarding\(ws, \{ aplicar: false \}\)/, 'en seco primero (de ahí el respaldo)');
});

test('4. el perfil del dueño: sin la marca del V2 ni los tutoriales del V2; lo demás, igual; con la marca del reinicio', () => {
  const antes = { telefono: '5491100000000', cargo: 'Dueña', onboardingV2: '2026-11-19T10:00:00Z', recorridos: { 'tutorial-ops-center': 'x', 'tutorial-crm': 'y', 'guia-image': 'z', 'cs-curso': 'w' } };
  const { perfil, quitados } = perfilReiniciado(antes, '2026-11-20T20:00:00.000Z');
  assert.deepEqual(perfil.recorridos, { 'guia-image': 'z', 'cs-curso': 'w' }, `se van sólo los ${PREFIJO_TUTORIAL}*`);
  assert.equal(perfil.telefono, '5491100000000', 'el teléfono (con eso la reconoce el bot) queda');
  assert.equal(perfil.cargo, 'Dueña');
  assert.ok(!('onboardingV2' in perfil));
  assert.deepEqual(quitados.sort(), ['onboardingV2', 'recorridos.tutorial-crm', 'recorridos.tutorial-ops-center']);
  assert.equal(reinicioDelPerfil(perfil), '2026-11-20T20:00:00.000Z');
  assert.equal(perfil[CLAVE_REINICIO], '2026-11-20T20:00:00.000Z');
  assert.equal(reinicioDelPerfil({}), null);
});

test('5. el navegador se limpia una vez por reinicio, antes de React (si no, le devuelve lo visto a la base)', () => {
  class Almacen {
    m = new Map<string, string>();
    get length() { return this.m.size; }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    getItem(k: string) { return this.m.get(k) ?? null; }
    setItem(k: string, v: string) { this.m.set(k, v); }
    removeItem(k: string) { this.m.delete(k); }
  }
  const ls = new Almacen(); const ss = new Almacen();
  for (const k of ['mako.recorrido.leila@x.com.tutorial-ops-center', 'mako.recorrido.tutorial-crm', 'mk-llegada-mostrada:abc', 'mk-onb-salidos:abc',
    'mk-entrada:offer-coach', 'mk-dale-play:offer-coach', 'mako.reto.vistos', 'mako.recorrido.leila@x.com.guia-image', 'mako.tema', 'mk-crear-plegada:Video']) ls.setItem(k, '1');
  ss.setItem('mako.v2.desde-cero', '1'); ss.setItem('mako.reto.marcada.3', '1'); ss.setItem('mako_entrada_m', '1');
  const correr = (at: string) => new Function('localStorage', 'sessionStorage', scriptDelReinicio(at))(ls, ss);
  correr('2026-11-20T20:00:00.000Z');
  assert.deepEqual([...ls.m.keys()].sort(), [CLAVE_LIMPIADO, 'mako.recorrido.leila@x.com.guia-image', 'mako.tema', 'mk-crear-plegada:Video'].sort());
  assert.deepEqual([...ss.m.keys()], ['mako_entrada_m']);
  // Una sola vez: lo que se vea después de limpiar, queda.
  ls.setItem('mk-entrada:offer-coach', '1');
  correr('2026-11-20T20:00:00.000Z');
  assert.equal(ls.getItem('mk-entrada:offer-coach'), '1');
  // Cada patrón nombra una clave que el código de verdad escribe (si una cambia de nombre, cae).
  const fuentes: Array<[RegExp, string, string]> = [
    [CLAVES_DEL_NAVEGADOR[0], 'lib/recorridos.ts', 'mako.recorrido.'],
    [CLAVES_DEL_NAVEGADOR[1], 'app/second-brain/LlegadaAlReto.tsx', '`mk-llegada-mostrada:'],
    [CLAVES_DEL_NAVEGADOR[2], 'app/onboarding/ChatArranqueV2.tsx', '`mk-onb-salidos:'],
    [CLAVES_DEL_NAVEGADOR[3], 'app/_ui/tutorial/entrada.ts', '`mk-entrada:'],
    [CLAVES_DEL_NAVEGADOR[4], 'app/_ui/tutorial/entrada.ts', '`mk-dale-play:'],
    [CLAVES_DEL_NAVEGADOR[5], 'app/second-brain/reto/ChatDelReto.tsx', "'mako.reto.vistos'"],
    [CLAVES_DEL_NAVEGADOR[6], 'app/_ui/tutorial/desde-cero.ts', "'mako.v2.desde-cero'"],
  ];
  for (const [, archivo, aguja] of fuentes) assert.ok(leer(archivo).includes(aguja), `${archivo} escribe ${aguja}`);
  // El layout: a la persona en SU cuenta, el script arriba de todo; el perfil, leído una vez por pedido.
  const lay = sinComentarios(leer('app/layout.tsx'));
  assert.match(lay, /const reinicio = veV2 && !vista \? await reinicioDelOnboarding\(\) : null;/);
  assert.match(lay, /<body>\n\s*\{reinicio && <script dangerouslySetInnerHTML=\{\{ __html: scriptDelReinicio\(reinicio\) \}\} \/>\}/, 'antes que cualquier otra pieza');
  const sep = sinComentarios(leer('lib/seguir-en-pc.ts'));
  assert.match(sep, /if \(!s\?\.email \|\| \(await estaImpersonando\(\)\.catch\(\(\) => true\)\)\) return null;/, 'mirando otro negocio, nunca (ese navegador es de quien mira)');
  assert.doesNotMatch(leer('lib/reinicio-en-el-navegador.ts'), /^import /m, 'el layout raíz lo importa: sin imports');
});

test('6. el botón, al lado de RESET en la vista de administrador: dice que no borra nada y pide confirmación', () => {
  const barra = sinComentarios(leer('app/_components/ImpersonationBanner.tsx'));
  assert.match(barra, /\{!modoAgencia && \(\n\s*<div [^>]*>\n\s*<PanelAgencia cliente=\{cliente\} \/>\n\s*<ReiniciarOnboarding cliente=\{cliente\} \/>/, 'en cualquier cliente (RESET, sólo en el de prueba)');
  const b = sinComentarios(leer('app/_components/ReiniciarOnboarding.tsx'));
  assert.match(b, /export const TEXTO_REINICIAR = '[^']*No borra nada de lo suyo[^']*Su WhatsApp sigue verificado\.';/);
  assert.match(b, /\{confirmar \? \(/, 'con confirmación');
  // Medido a 1440 y 375 (20/11): escrita en la barra, la confirmación la estiraba a 87 px (la página descuenta 50); y en el Cliente de
  // Prueba a 375, el botón nuevo empujaba «Salir de la vista» fuera de la pantalla.
  assert.match(b, /\{confirmar \? \(\n\s*pos && createPortal\(/, 'la confirmación flota debajo del botón, no estira la barra');
  assert.match(barra, /<span style=\{\{ fontSize: 13\.5, minWidth: 0, flexShrink: 1000,/, 'el texto de la barra se achica primero');
  assert.match(barra, /\{!modoAgencia && \(\n\s*<div style=\{\{[^}]*minWidth: 0, overflowX: 'auto'/, 'las herramientas se deslizan; «Salir» queda a la vista');
  assert.match(b, /body: JSON\.stringify\(\{ aplicar: true \}\)/);
  // Al terminar dice que quedó y lleva al onboarding de ESE negocio (20/11, el Cerebro: «no da ninguna señal y deja la pantalla como
  // estaba»): navegación completa, con el `?ws=` de la pestaña.
  assert.match(b, /setHecho\(true\);\n\s*setTimeout\(\(\) => window\.location\.assign\(conWs\('\/onboarding', ws\)\), \d+\);/);
  assert.match(b, /\{hecho \? `Listo: el onboarding de \$\{cliente\} empieza de cero\.`/, 'lo dice el mismo panel');
  const ruta = sinComentarios(leer('app/api/admin/reiniciar-onboarding/route.ts'));
  assert.match(ruta, /if \(!\(await getSesionAdmin\(\)\)\) return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 403 \}\);/);
  assert.match(ruta, /const ws = await getWorkspaceActual\(\);/, 'el negocio lo dice el server, nunca el pedido');
  assert.match(ruta, /const \{ resultado \} = await reiniciarOnboarding\(ws, \{ aplicar: body\.aplicar === true \}\);/, 'el respaldo no viaja al navegador');
});

test('7. el respaldo va FUERA de cualquier repo (el primero, el de Leila, quedó en la raíz sin que git lo ignorara)', () => {
  // La carpeta: la pasada, MAKO_RESPALDOS, o la de la máquina.
  assert.equal(carpetaDeRespaldos({ env: {}, plataforma: 'win32' }), resolve('C:/dev/respaldos'));
  assert.equal(carpetaDeRespaldos({ env: {}, plataforma: 'linux', home: '/h' }), join('/h', 'mako-respaldos'));
  assert.equal(carpetaDeRespaldos({ env: { MAKO_RESPALDOS: '/r' }, plataforma: 'win32' }), resolve('/r'));
  assert.equal(carpetaDeRespaldos({ pasada: '/p', env: { MAKO_RESPALDOS: '/r' } }), resolve('/p'));

  const base = mkdtempSync(join(tmpdir(), 'respaldo-'));
  try {
    assert.equal(repoQueLaContiene(base), null, 'la carpeta temporal no está en un repo: si lo está, este test no prueba nada');
    // Un worktree tiene `.git` como ARCHIVO: también cuenta.
    mkdirSync(join(base, 'repo'));
    writeFileSync(join(base, 'repo', '.git'), 'gitdir: x');
    const adentro = join(base, 'repo', 'scripts', 'respaldos');
    assert.equal(repoQueLaContiene(adentro), resolve(base, 'repo'));
    assert.throws(() => escribirRespaldo(adentro, 'r.json', { a: 1 }), /no va adentro de un repo de git/);
    assert.equal(existsSync(adentro), false, 'ni crea la carpeta');

    const fuera = join(base, 'respaldos');
    const archivo = escribirRespaldo(fuera, 'r.json', { a: 1 });
    assert.deepEqual(JSON.parse(readFileSync(archivo, 'utf8')), { a: 1 });
    assert.throws(() => escribirRespaldo(fuera, 'r.json', { a: 2 }), /EEXIST/, 'nunca encima de otro respaldo');
  } finally { rmSync(base, { recursive: true, force: true }); }

  // El script escribe con eso, antes de aplicar; y por si otro script repite el error, git ignora `respaldo-*.json`.
  const script = sinComentarios(leer('scripts/reiniciar-onboarding.mts'));
  assert.doesNotMatch(script, /writeFileSync/, 'el respaldo se escribe sólo con escribirRespaldo');
  const respaldo = script.indexOf('escribirRespaldo(respaldoEn,');
  assert.ok(respaldo > 0 && respaldo < script.indexOf('aplicar: true'), 'el respaldo se escribe ANTES de tocar la base');
  assert.match(leer('.gitignore'), /^respaldo-\*\.json$/m);
});
