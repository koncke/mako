// =============================================================================
// La tab Clients: las sub-tabs, las rutas nuevas, y las viejas que redirigen (17/10/2026)
// =============================================================================
// Martín: «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes" y que la tab en la
// sidebar se llame "Clients"… Como lo tiene Skool, con una tab más de "Classroom"». El diseño, en
// docs/diseno-clients.md. Lo que fija este archivo:
//   1. las sub-tabs, su orden y sus rutas (lib/clients-rutas.ts);
//   2. qué viaja de la URL al cambiar de sub-tab y de programa;
//   3. las rutas viejas: cada page.tsx viejo SÓLO redirige, con la query, y la tabla de a dónde;
//   4. cada ruta nueva monta LA pantalla de siempre (una pantalla, dos URLs, nunca dos copias);
//   5. nadie vuelve a ENLAZAR una ruta vieja desde el código (lo que queda, en una lista que sólo se achica);
//   6. la comunidad del equipo: la piel del curso, la pestaña de la URL, sin su propia fila de pestañas.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola, contra este archivo:
//   · `rutaNuevaDeVieja` sin la rama de `?vista=avance`                 → 1 fallo (3)
//   · `hrefSeccion` deja viajar `cliente`                               → 1 fallo (2)
//   · un `href="/customer-success/curso"` nuevo en un componente        → 1 fallo (5)
//   · ComunidadEquipo vuelve a dibujar sus pestañas (sin `sinPestanas`) → 1 fallo (6)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  SECCIONES_CLIENTS, SECCIONES_COMUNIDAD, PESTANA_DE_SECCION, esSeccionComunidad, seccionDePestana, seccionDeRuta,
  esVistaPrevia, hrefSeccion, hrefConPrograma, rutaNuevaDeVieja, queryDeSearchParams,
} from '../lib/clients-rutas';

const RAIZ = join(import.meta.dirname, '..');
const crudo = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: las líneas PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(crudo(rel));

// ── 1. Las sub-tabs ───────────────────────────────────────────────────────────────

test('las sub-tabs: Clients adelante y después las de un grupo de Skool, en su orden, en inglés', () => {
  assert.deepEqual(SECCIONES_CLIENTS.map((s) => s.label), ['Clients', 'Community', 'Classroom', 'Calendar', 'Members', 'Leaderboards', 'About']);
  assert.deepEqual(SECCIONES_CLIENTS.map((s) => s.href), [
    '/clients', '/clients/community', '/clients/classroom', '/clients/calendar', '/clients/members', '/clients/leaderboards', '/clients/about',
  ]);
  // Las cinco de la comunidad son una página y cada una es una pestaña de app/_comunidad/Comunidad.tsx.
  assert.deepEqual([...SECCIONES_COMUNIDAD], ['community', 'calendar', 'members', 'leaderboards', 'about']);
  for (const s of SECCIONES_COMUNIDAD) assert.equal(seccionDePestana(PESTANA_DE_SECCION[s]), s, s);
  assert.equal(esSeccionComunidad('classroom'), false);
  assert.equal(esSeccionComunidad('clients'), false);
});

test('la sub-tab sale del pathname; la vista previa es de Classroom y se reconoce aparte', () => {
  assert.equal(seccionDeRuta('/clients'), 'clients');
  assert.equal(seccionDeRuta('/clients/'), 'clients');
  assert.equal(seccionDeRuta('/clients?producto=3'), 'clients');
  assert.equal(seccionDeRuta('/clients/members'), 'members');
  assert.equal(seccionDeRuta('/clients/classroom/preview'), 'classroom');
  assert.equal(esVistaPrevia('/clients/classroom/preview'), true);
  assert.equal(esVistaPrevia('/clients/classroom'), false);
  assert.equal(seccionDeRuta('/clients/otra'), null);
  assert.equal(seccionDeRuta('/clientsx'), null);
  assert.equal(seccionDeRuta('/customer-success'), null);
  assert.equal(seccionDeRuta(null), null);
});

// ── 2. Lo que viaja ───────────────────────────────────────────────────────────────

test('cambiar de sub-tab conserva el programa y el workspace, y nada que sea de UNA pantalla', () => {
  assert.equal(hrefSeccion('members', '?producto=3&ws=13&cliente=21&post=9&vista=avance'), '/clients/members?producto=3&ws=13');
  assert.equal(hrefSeccion('clients', ''), '/clients');
  assert.equal(hrefSeccion('classroom', new URLSearchParams('ws=13')), '/clients/classroom?ws=13');
});

test('cambiar de programa cambia `producto`, conserva el resto y suelta lo que es de un programa', () => {
  assert.equal(hrefConPrograma('/clients/members', '?ws=13&producto=3&post=9', 5), '/clients/members?ws=13&producto=5');
  assert.equal(hrefConPrograma('/clients/', '?cliente=21&vista=avance', 5), '/clients?vista=avance&producto=5');
});

// ── 3. Las rutas viejas ───────────────────────────────────────────────────────────

test('cada ruta vieja va a la nueva, con su query entera', () => {
  const casos: Array<[string, string, string | null]> = [
    ['/customer-success', '', '/clients'],
    ['/customer-success', '?cliente=21&ws=13', '/clients?cliente=21&ws=13'],
    ['/customer-success/', 'vista=avance&producto=3', '/clients?vista=avance&producto=3'],
    ['/customer-success/curso', '?producto=3', '/clients/classroom?producto=3'],
    // El Avance se fue del Curso a Clientes (07/10/2026): el link viejo cae en la vista Avance.
    ['/customer-success/curso', '?vista=avance&producto=3', '/clients?vista=avance&producto=3'],
    ['/customer-success/curso/vista', '?producto=3', '/clients/classroom/preview?producto=3'],
    ['/customer-success/comunidad', '?post=12&ws=3', '/clients/community?post=12&ws=3'],
    ['/customer-success/otra', '', null],
    ['/clients', '', null],
  ];
  for (const [p, q, esperado] of casos) assert.equal(rutaNuevaDeVieja(p, q), esperado, `${p}${q}`);
  assert.equal(queryDeSearchParams({ a: '1', b: ['2', '3'], c: undefined }), 'a=1&b=2&b=3');
});

test('cada page.tsx viejo SÓLO redirige: nombra su ruta y no monta nada', () => {
  const viejas: Array<[string, string]> = [
    ['app/customer-success/page.tsx', '/customer-success'],
    ['app/customer-success/curso/page.tsx', '/customer-success/curso'],
    ['app/customer-success/curso/vista/page.tsx', '/customer-success/curso/vista'],
    ['app/customer-success/comunidad/page.tsx', '/customer-success/comunidad'],
  ];
  for (const [archivo, ruta] of viejas) {
    const src = leer(archivo);
    assert.ok(src.includes(`return aClients('${ruta}', searchParams);`), `${archivo} no redirige con su ruta`);
    assert.doesNotMatch(src, /Pantalla|\breturn\s*</, `${archivo} volvió a montar una pantalla: serían dos copias`);
  }
  const helper = leer('app/customer-success/a-clients.ts');
  assert.match(helper, /redirect\(await rutaConWs\(rutaNuevaDeVieja\(rutaVieja, q\) \?\? RUTA_CLIENTS\)\)/, 'el salto pierde el ?ws= o la query');
  assert.doesNotMatch(helper, /permanentRedirect/, 'un 308 lo guarda el navegador para siempre');
});

// ── 4. Las rutas nuevas montan LA pantalla ────────────────────────────────────────

test('cada ruta nueva monta la pantalla de siempre, y la comunidad es UNA página con 404 para lo demás', () => {
  assert.match(leer('app/clients/page.tsx'), /import \{ PantallaClientes \} from '@\/app\/customer-success\/pantalla';[\s\S]*export default PantallaClientes;/);
  assert.match(leer('app/clients/classroom/page.tsx'), /export default PantallaClassroom;/);
  assert.match(leer('app/clients/classroom/preview/page.tsx'), /export default PantallaVistaAlumno;/);
  const seccion = leer('app/clients/[seccion]/page.tsx');
  assert.match(seccion, /if \(!esSeccionComunidad\(seccion\)\) notFound\(\);/);
  assert.match(seccion, /<PantallaComunidad searchParams=\{searchParams\} \/>/);
  // Las pantallas siguen pidiendo la capa de Customer Success (la key es contrato: lib/capas.ts).
  for (const p of ['app/customer-success/pantalla.tsx', 'app/customer-success/curso/pantalla.tsx', 'app/customer-success/comunidad/pantalla.tsx', 'app/customer-success/curso/vista/pantalla.tsx']) {
    assert.ok(leer(p).includes("await requireCapa('customer-success');"), `${p} perdió su guard`);
    assert.doesNotMatch(leer(p), /export default|export const (dynamic|metadata|revalidate)/, `${p} es una pantalla, no una ruta`);
  }
  // Una ruta propia de Clients es una carpeta: le gana al segmento dinámico.
  assert.ok(existsSync(join(RAIZ, 'app', 'clients', 'classroom', 'page.tsx')));
});

// ── 5. Nadie vuelve a enlazar una ruta vieja ──────────────────────────────────────

/**
 * Los archivos que TODAVÍA nombran una ruta vieja en el código (no en un comentario), con su motivo. ⚠️ La lista sólo
 * se ACHICA: un archivo que ya no la nombra hace fallar el test (si no, queda el permiso escrito para una vuelta).
 */
const QUEDAN: Record<string, string> = {
  'app/customer-success/page.tsx': 'la ruta vieja: redirige',
  'app/customer-success/curso/page.tsx': 'la ruta vieja: redirige',
  'app/customer-success/curso/vista/page.tsx': 'la ruta vieja: redirige',
  'app/customer-success/comunidad/page.tsx': 'la ruta vieja: redirige',
  'lib/clients-rutas.ts': 'la tabla de a dónde va cada ruta vieja',
  'lib/movil-rutas.ts': 'el teléfono lleva los links viejos ya mandados directo a su pantalla',
  // De OTROS chats (sus archivos): siguen andando por el redirect, y se mudan con su dueño.
  'app/_components/nav.ts': 'la barra: la ordena el chat Sidebar',
  'app/_components/Sidebar.tsx': '«Regresar a Clientes» del modo dev: chat Sidebar',
  'app/_components/ImpersonationBanner.tsx': 'la salida de la vista de agencia: se muda a /partners',
  'app/api/auth/me/route.ts': 'la salida de la vista de agencia: se muda a /partners',
  'lib/movil-guard.ts': 'la salida de la vista de agencia: se muda a /partners',
  'lib/agencia-cartera.ts': 'la salida de la vista de agencia: se muda a /partners',
  'app/admin/runway/datos.ts': 'un link de ejemplo del panel de Runway (super admin)',
  'app/crm/[id]/deal-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'app/crm/[id]/pagos-campo-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'app/crm/lead-cabecera-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'app/crm/lead-view/ficha/pagos/cuotas-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'app/crm/lead-view/ficha/pagos/documento-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'app/crm/notas-actions.ts': 'revalidatePath del CRM (chat CRM)',
  'lib/curso-mensajes.ts': 'links de los avisos del curso: Automations lo está tocando (lote 2), se muda después',
};

test('ninguna línea de código nueva enlaza /customer-success: las que quedan están en la lista, con su motivo', () => {
  // `git grep` (nativo) trae los candidatos de los archivos EN GIT; recién sobre ésos se sacan los comentarios. Leer
  // los ~3000 archivos de app/ y lib/ desde node tardaba un minuto en esta PC. ⚠️ Lista el ÍNDICE: un archivo nuevo
  // sin `git add` no se revisa (AGENTS.md).
  let candidatos: string[] = [];
  try {
    candidatos = execFileSync('git', ['grep', '-l', '-E', "['\"`]/customer-success", '--', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
      .split('\n').filter((f) => /\.(ts|tsx)$/.test(f) && !f.startsWith('app/admin/dev/'));
  } catch { candidatos = []; }   // sin coincidencias, git grep sale con 1
  assert.ok(candidatos.length > 0, 'git grep no encontró ni las rutas viejas que redirigen: el guard no está mirando');
  // Una CADENA que arranca con la ruta (no la palabra en un comentario, ni un import de la carpeta).
  const patron = /['"`]\/customer-success(?:[/?'"`#]|$)/;
  const nombran = new Set<string>();
  for (const f of candidatos) {
    let src: string;
    try { src = leer(f); } catch { continue; }
    if (patron.test(src)) nombran.add(f.replace(/\\/g, '/'));
  }
  const nuevos = [...nombran].filter((f) => !(f in QUEDAN));
  assert.deepEqual(nuevos, [], 'estos archivos enlazan una ruta vieja: van a /clients (lib/clients-rutas.ts)');
  const viejos = Object.keys(QUEDAN).filter((f) => !nombran.has(f));
  assert.deepEqual(viejos, [], 'estos ya no nombran la ruta vieja: sacalos de QUEDAN');
});

// ── 6. La comunidad del equipo adentro de Clients ─────────────────────────────────

test('la comunidad del equipo: la piel del curso, la pestaña de la URL y sin su propia fila de pestañas', () => {
  const equipo = leer('app/customer-success/comunidad/ComunidadEquipo.tsx');
  assert.match(equipo, /<Comunidad key=\{productoId\}[\s\S]*?pestana=\{pestana\} onPestana=\{irA\} sinPestanas \/>/);
  assert.doesNotMatch(equipo, /piel="app"/, 'la comunidad del equipo va con la piel del curso');
  assert.match(equipo, /window\.history\.pushState\(null, '', hrefSeccion\(seccionDePestana\(p\), window\.location\.search\)\)/);
  assert.doesNotMatch(equipo, /router\.replace\(/, 'el programa lo cambia la cabecera de Clients, no la comunidad');
  const comunidad = leer('app/_comunidad/Comunidad.tsx');
  assert.match(comunidad, /piel = 'papel'/, 'el default es la piel del curso');
  assert.match(comunidad, /const raiz = `cmu cmu--\$\{tema\} cmu--\$\{piel\}`;/);
  assert.match(comunidad, /const pestana = pestanaControlada \?\? pestanaLocal;/);
  assert.match(comunidad, /\{!sinPestanas && PESTANAS\.map/);
  // Las reglas de la piel dicen la PIEL, no quién mira.
  const css = crudo('app/_comunidad/estilos.ts').split('export const CSS_COMUNIDAD')[1];
  assert.doesNotMatch(css, /\.cmu--alumno|\.cmu--equipo/);
  assert.match(css, /\.cmu--papel\{[\s\S]*?font-family: var\(--ugc-fuente,/);
});

test('la cabecera: entre pestañas de la comunidad no navega, y la vista previa va sin cabecera', () => {
  const shell = leer('app/clients/ClientsShell.tsx');
  assert.match(shell, /if \(!esSeccionComunidad\(seccion\) \|\| !esSeccionComunidad\(id\)\) return;\s*e\.preventDefault\(\);\s*if \(id !== seccion\) window\.history\.pushState\(null, '', destino\);/);
  assert.match(shell, /if \(esVistaPrevia\(pathname\) \|\| !seccion\) return <>\{children\}<\/>;/);
  // Personalizar escribe EL MISMO ajuste del curso (uno por programa), no uno propio.
  assert.match(shell, /guardarEstiloCursoAction\(programa\.id, ajuste, valor\)/);
  // El Classroom va embebido: el alto lo da la cabecera (un flex), nunca la ventana.
  assert.match(shell, /const alto = seccion === 'classroom';/);
  assert.match(leer('app/customer-success/curso/CursoApp.tsx'), /<CursoUgc[\s\S]*?modo="embebido"/);
});
