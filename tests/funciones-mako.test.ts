// =============================================================================
// El catálogo de las funciones de MaKo (lib/funciones-mako.ts) no se queda viejo (28/10/2026)
// =============================================================================
// Martín: «que el Second Brain de SuperAdmin tenga conocimiento de todas las funcionalidades». El catálogo es lo que un
// chat lee para saber qué hace cada función; si una tab nueva no suma su entrada, MaKo la niega. Lo que fija:
//   1. cada key VIVA del nav (no «pronto») es de exactamente una función, y ninguna función nombra una key que no existe;
//   2. lo derivado sale del nav: nombre, ruta, familia y quién la ve;
//   3. las conexiones apuntan a otra función, el área de obra existe y las fuentes están en el repo;
//   4. lo que reemplaza cada una es lo que dice AGENTS.md («se nombra por su fuente»), y lo que Chats no hace es lo de
//      docs/diseno-chats.md;
//   5. ES LA FUENTE: cada capacidad (lib/mako-capacidades.ts) cae en una función y su tab es el nombre de esa función, sin
//      nombres a mano; `listar_capacidades_mako` devuelve las funciones del negocio.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENTRADAS, funcionDeKey, funcionDeRuta, funcionesMako } from '../lib/funciones-mako';
import { CAPACIDADES } from '../lib/mako-capacidades';
import { FAMILIAS, TODOS_LOS_ITEMS, USER_NAV } from '../app/_components/nav';
import { AREAS } from '../app/admin/dev/areas';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** La barra (con lo que dejó de ser fila) y el menú de la foto. */
const ITEMS = [...TODOS_LOS_ITEMS, ...USER_NAV];

test('1. cada key viva del nav es de exactamente una función, y ninguna función nombra una key que no existe', () => {
  const vivas = ITEMS.filter((i) => !i.comingSoon).map((i) => i.key);
  const pronto = new Set(ITEMS.filter((i) => i.comingSoon).map((i) => i.key));
  const todas = new Set(ITEMS.map((i) => i.key));
  for (const k of vivas) {
    const de = ENTRADAS.filter((e) => e.keys.includes(k));
    assert.equal(de.length, 1, `la key «${k}» del nav es de ${de.length} funciones: súmala a lib/funciones-mako.ts (o sácala de la que sobra)`);
  }
  for (const e of ENTRADAS) {
    for (const k of e.keys) {
      assert.ok(todas.has(k), `«${k}» no es una key del nav`);
      assert.ok(!pronto.has(k), `«${k}» está «pronto» en el nav: una función que no existe no va en el catálogo`);
    }
  }
});

test('2. el nombre, la ruta, la familia y quién la ve salen del nav', () => {
  // La tab que agrupa TODAS las keys de una función como sus secciones (AI Avatar) le da el nombre; si no, su primer ítem.
  const tabs = FAMILIAS.flatMap((fa) => [...fa.bloques.flat(), ...(fa.grupos ?? []).flatMap((g) => g.items)]).filter((i) => i.secciones?.length);
  for (const f of funcionesMako()) {
    const item = tabs.find((t) => t.secciones!.every((s) => f.keys.includes(s.key))) ?? ITEMS.find((i) => i.key === f.key)!;
    assert.equal(f.nombre, item.label);
    assert.equal(f.ruta, item.href);
    assert.ok(f.familia, `«${f.key}» sin familia`);
  }
  assert.equal(funcionDeKey('whatsapp')?.key, 'chats', 'WhatsApp se configura desde Chats');
  assert.equal(funcionDeKey('landing-writer')?.nombre, 'Web Generator');
  assert.equal(funcionDeKey('chats')?.familia, 'Today');
  // AI Avatar es de Pro desde el 29/10/2026 (ya no `adminOnly`): la ven los negocios, con el candado de su plan.
  assert.equal(funcionDeKey('ai-avatar')?.soloSuperAdmin, false);
  // AI Avatar sin secciones desde el 29/10/2026 (el estudio de Higgsfield): la función se llama como la tab.
  assert.deepEqual([funcionDeKey('ai-avatar')?.nombre, funcionDeKey('ai-avatar')?.ruta], ['AI Avatar', '/ai-avatar']);
  // Video sin secciones desde el 29/10/2026 (tests/crear-pantalla.test.ts): la función se llama como la tab.
  assert.equal(funcionDeKey('video-editor')?.nombre, 'Video', 'una tab sin secciones se llama como la tab');
  assert.equal(funcionDeKey('partners')?.noEnPlataforma, true);
  assert.equal(funcionDeKey('crm')?.soloSuperAdmin, false);
  assert.equal(funcionDeKey('integraciones')?.familia, 'Settings');
  // La función de una ruta: la que se enciende en la barra al llegar.
  assert.equal(funcionDeRuta('/whatsapp')?.key, 'chats');
  assert.equal(funcionDeRuta('/general')?.key, 'graphics', '/general es la hoja Focus del Dashboard');
  assert.equal(funcionDeRuta('/dashboard?hoja=closing')?.key, 'graphics');
  assert.equal(funcionDeRuta('/integraciones')?.familia, 'Settings');
});

test('3. las conexiones apuntan a otra función, el área de obra existe, las fuentes están y nada va vacío', () => {
  const slugs = new Set(AREAS.map((a) => a.slug));
  for (const f of funcionesMako()) {
    assert.ok(f.que.trim().length > 40 && f.que.length <= 400, `«${f.key}»: el «que» va en dos o tres frases`);
    assert.ok(f.hace.length >= 1, `«${f.key}» no dice qué hace`);
    assert.ok(f.alias.length >= 1 && f.alias.every((a) => a === a.toLowerCase() && a.trim()), `«${f.key}»: los alias van en minúscula`);
    for (const c of f.conecta ?? []) {
      assert.ok(funcionDeKey(c.a), `«${f.key}» se conecta con «${c.a}», que no es una función`);
      assert.notEqual(funcionDeKey(c.a)?.key, f.key, `«${f.key}» se conecta consigo misma`);
      assert.ok(c.motivo.trim(), 'una conexión sin motivo no se dibuja');
    }
    if (f.slugDev) assert.ok(slugs.has(f.slugDev), `«${f.key}»: el área «${f.slugDev}» no está en app/admin/dev/areas.ts`);
    for (const fu of f.fuentes) assert.ok(existsSync(join(RAIZ, fu)), `«${f.key}»: la fuente ${fu} no está en el repo`);
  }
});

test('4. lo que reemplaza cada una es lo de AGENTS.md, y lo que Chats no hace es lo de su diseño', () => {
  const agents = readFileSync(join(RAIZ, 'AGENTS.md'), 'utf8').replace(/\s+/g, ' ');
  for (const [key, app, frase] of [
    ['video-editor', 'CapCut', 'el Video Editor es CapCut'], ['image-editor', 'Canva', 'el Image Editor es Canva'],
    ['landing-writer', 'Gamma', 'Web Generator es Gamma'], ['graphics', 'Looker Studio', 'el Dashboard es Looker Studio'],
    ['chats', 'respond.io', 'los Chats son respond.io'],
  ] as const) {
    assert.ok(agents.includes(frase), `AGENTS.md ya no dice «${frase}»: revisar el catálogo`);
    assert.equal(funcionDeKey(key)?.reemplaza, app, `«${key}» no dice que reemplaza a ${app}`);
  }
  const chats = funcionDeKey('chats')!;
  const noHace = (chats.noHace ?? []).join(' · ').toLowerCase();
  for (const x of ['llamadas', 'traducir', 'unir contactos', 'todavía no']) assert.ok(noHace.includes(x), `Chats no dice que no hace «${x}»`);
  assert.equal(chats.estado, 'parcial', 'Chats todavía no hace todo lo de respond.io: el estado es honesto');
});

test('5. es la fuente: cada capacidad cae en una función y su tab es el nombre de ésa; listar_capacidades_mako trae las funciones', () => {
  for (const c of CAPACIDADES) {
    assert.ok(c.funcion, `la capacidad «${c.id}» (${c.ruta}) no cae en ninguna función del catálogo`);
    assert.equal(c.tab, funcionDeKey(c.funcion!)!.nombre, `la capacidad «${c.id}» nombra una tab que no es la de su función`);
    // El primer paso nombra la tab del botón («Ir a Chats →» y «Entra a Email» se contradecían: la verificación de 0c80dd3ce).
    assert.ok(c.como[0].toLowerCase().includes(c.tab.toLowerCase()), `«${c.id}»: el botón dice «${c.tab}» y el primer paso «${c.como[0]}»`);
  }
  const fuenteCap = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-capacidades.ts'), 'utf8'));
  assert.doesNotMatch(fuenteCap, /\btab: '/, 'una capacidad volvió a escribir su tab a mano');
  const run = sinComentarios(readFileSync(join(RAIZ, 'lib/api-mako/areas/mako.run.ts'), 'utf8'));
  const listar = run.slice(run.indexOf('listar_capacidades_mako: {'), run.indexOf('listar_chats_mako: {'));
  assert.match(listar, /const funciones = id \? \[\] : funcionesMako\(\)\s*\.filter\(\(f\) => \(!f\.soloSuperAdmin \|\| vista\.plataforma\) && !\(f\.noEnPlataforma && vista\.plataforma\) && disponible\(f\.ruta\)\)/, 'la herramienta no lee el catálogo (o no filtra por el plan y por la plataforma)');
  assert.match(listar, /no_hace: f\.noHace/, 'la herramienta no dice lo que una función no hace');
});

test('6. listar_capacidades_mako por negocio y por rol: lo del super admin sólo en la plataforma, el menú de la foto en todo plan', () => {
  // El runner REAL con la capa de mentira (tests/_capacidades-hijo.ts): la verificación de 0c80dd3ce lo reprodujo así.
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests/_capacidades-hijo.ts')], { cwd: RAIZ, encoding: 'utf8', timeout: 120_000 });
  const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, { funciones: string[]; capacidades: string[] }> & { error?: string };
  assert.ok(!R.error, String(R.error));
  const SOLO_SA = funcionesMako().filter((f) => f.soloSuperAdmin).map((f) => f.nombre);
  // (Reels se fue el 29/10/2026: su guion es una plantilla del Copywriter.)
  // ⚠️ Competitor Spy SALIÓ de esta lista el 2/11/2026: dejó de ser sólo del super admin. Martín:
  //    «todos los usuarios no pueden ver la nueva tab y eso ya debería estar disponible... no tiene
  //    sentido que uno analice a Alex Hormozi y luego otro vuelva a analizar al mismo». Mirar y
  //    agregar: cualquiera del negocio; borrar sigue siendo del administrador
  //    (`soloAdmin` en app/competitor-spy/actions.ts).
  // Lead Magnet entró el 5/11/2026: es de la plataforma hasta que Martín lo abra (app/lead-magnet-generator/puerta.ts).
  assert.deepEqual(SOLO_SA.sort(), ['Admin', 'Lead Magnet', 'Stories']);
  // El dueño de un negocio cliente (plan completo, agencia o pm) nunca recibe lo que sólo ve el super admin.
  for (const k of ['11:admin', '12:admin', '13:admin', '11:miembro']) {
    for (const n of SOLO_SA) assert.ok(!R[k].funciones.includes(n), `${k} recibió «${n}», que sólo ve el super admin`);
  }
  // La plataforma sí, y sin MaKo Partners (que no va en la plataforma); un cliente admin sí tiene Partners.
  assert.ok(R['9:admin'].funciones.includes('AI Avatar'));
  assert.ok(!R['9:admin'].funciones.includes('MaKo Partners'), 'la plataforma recibió MaKo Partners');
  assert.ok(R['11:admin'].funciones.includes('MaKo Partners'));
  // El menú de la foto no depende del plan: con la capa pm, Settings y conectar siguen.
  assert.ok(R['13:admin'].funciones.includes('Settings') && R['13:admin'].capacidades.includes('conectar'), 'un plan acotado perdió Settings');
  assert.ok(R['13:admin'].funciones.length < R['11:admin'].funciones.length, 'el plan pm recibe lo mismo que el completo');
  // Un miembro: «Report a problem» sí, sumar gente al equipo (Business settings, del admin) no.
  assert.ok(R['11:miembro'].funciones.includes('Report a problem'));
  assert.ok(!R['11:miembro'].capacidades.includes('equipo'), 'un miembro recibió «sumar gente al equipo»');
});

// ── Probado rompiéndolo (28/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. Chats sin la key `email`                                            → rojo el 1.
//   2. una key «pronto» (`thumbnails`) en una función                       → rojo el 1.
//   3. una conexión a una key que no existe                                 → rojo el 3.
//   4. el Video Editor «reemplaza a Premiere»                              → rojo el 4.
//   5. Chats sin «Llamadas de voz» en lo que no hace                       → rojo el 4.
//  12. Settings sin la key `integraciones`                                   → rojo el 1 y el 2.
//  13. la tab de una capacidad con la key y no el nombre de su función        → rojo el 5.
//  14. `listar_capacidades_mako` sin lo que una función no hace               → rojo el 5.
//  15. las funciones de la herramienta sin el filtro del plan                  → rojo el 5.
//  (28/10, la verificación de 0c80dd3ce) V1. lo del super admin a cualquier dueño, V2. Partners en la plataforma, V3. el menú
//  de la foto según el plan, V4. el menú con su primer ítem y no el de menos roles → rojo el 6 (V1 y V2, también el 5);
//  V9. AI Avatar como «Create video» → rojo el 2; V10. «Entra a Email» con el botón «Chats» → rojo el 5.
