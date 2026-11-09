// =============================================================================
// MaKo Mobile — las tabs de CREACIÓN en el teléfono (17/10/2026)
// =============================================================================
// Video Editor, Image Editor, AI Avatar, Reels, Stories y Carousels (lib/movil-creacion.ts y app/m/_creacion). Las
// «Coming soon» son de /m/pronto (Mobile 2, tests/movil-toda-tab.test.ts). Fija lo que se rompe sin un solo error:
//   · la ida y la vuelta de cada ruta de escritorio con su pantalla del teléfono (con su query, las subrutas y las
//     rutas viejas), y lo que se QUEDA en la computadora (el presentador del Image Editor, una subruta inventada);
//   · que la puerta del teléfono sea la de escritorio: la MISMA key de nav.ts que pide cada page de escritorio, una
//     key que exista (`puedeVerKey` dice que no, en silencio, a una que no está), y AI Avatar con su segunda puerta;
//   · la barra de secciones de cada tab: las de escritorio, con la regla del Sidebar (`adminOnly` sólo para el super
//     admin sin mirar a un cliente);
//   · los editores son pantallas de trabajo (sin la barra de abajo desde el HTML del server);
//   · el teléfono no COPIA lo de escritorio: los textos de «Copiar» viven en módulos puros que usan los dos lados;
//   · abrir una pantalla de AI Avatar no gasta nada: ninguna page llama a lo que encola trabajo en Flow.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/romper.py: trece roturas sobre el archivo real, de a una, restaurando
// de memoria y comparando el hash): base 6 pasan / 0 fallan; cada rotura, 5 / 1 en el test que la vigila (anotada
// arriba de cada uno; la línea de creación de `rutaMovil` borrada y la ruta de Copy Method borrada tumban dos, 4 / 2);
// restaurado, 6 / 0.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_NAV, TODOS_LOS_ITEMS } from '../app/_components/nav';
import { RUTAS_CREACION, SECCIONES_CREACION } from '../lib/movil-creacion';
import { SECCIONES_MAS, rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { esTrabajo, cabeceraPorRuta } from '../app/m/_ui/cabecera';
import { seccionesDeTabM } from '../app/m/_ui/SeccionesTabM';
import type { VistaNav } from '../lib/nav-visibilidad';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

// Roto 17/10/2026: la línea de creación de `rutaMovil` borrada (las rutas caían en las «pronto» o en null) → 4/2 (éste
// y el de la puerta); la ruta de Copy Method borrada → 4/2 (éste y el de la barra); `noSub` sin 'presentador' → 5/1; la query de `/ai-avatar/avatares`
// sin `plantilla` → 5/1; `rutaEscritorioCreacion` sin el chequeo de la vuelta (una /m inventada se traducía) → 5/1.
test('ida y vuelta: cada ruta de creación tiene su pantalla y vuelve a ELLA, con lo que escritorio lee de la query', () => {
  const casos: Array<[string, string | null]> = [
    ['/video-editor', '/m/video-editor'],
    ['/video-editor/1a2b-3c', '/m/video-editor/1a2b-3c'],
    ['/video-editor/nuevo?desde=anuncio%3Aabc&ws=3&x=1', '/m/video-editor/nuevo?desde=anuncio%3Aabc'],
    ['/video-editor/nuevo?plantilla=testimonio', '/m/video-editor/nuevo?plantilla=testimonio'],
    ['/image-editor', '/m/image-editor'],
    ['/image-editor/0d6f0b8e-9b1e-4a51-9d3c-2f1d8a7e6b5c', '/m/image-editor/0d6f0b8e-9b1e-4a51-9d3c-2f1d8a7e6b5c'],
    // La ventana del presentador es de escritorio: en el teléfono, la cubierta «se usa en la computadora».
    ['/image-editor/presentador', null],
    ['/ai-avatar?avatar=med_1&plantilla=auto-testimonio', '/m/ai-avatar?avatar=med_1&plantilla=auto-testimonio'],
    ['/ai-avatar/avatares?plantilla=auto-testimonio', '/m/ai-avatar/avatares?plantilla=auto-testimonio'],
    ['/ai-avatar/voces', '/m/ai-avatar/voces'],
    ['/ai-avatar/plantillas', '/m/ai-avatar/plantillas'],
    ['/ai-avatar/inventada', null],
    // Reels y Carousels se retiraron el 29/10/2026: sus rutas de escritorio redirigen y el teléfono no las traduce.
    ['/reels', null], ['/stories', '/m/stories'], ['/carousels', null],
    // El método de redacción del super admin se fue el 29/10/2026 (Martín: «no quiero ninguna mención en todo MaKo»): su
    // ruta redirige al Copywriter y el teléfono no la traduce.
    ['/admin/copywriting', null],
    // Las «Coming soon» de una tab con secciones van a la pantalla «pronto» de Mobile 2, no a una de acá.
    // (Image Generator se retiró el 29/10/2026: ya no es «pronto» de nadie, su ruta redirige a Image.)
    ['/image-generator', null], ['/youtube-writer', '/m/pronto/youtube-writer'],
    // Lo que no es de creación no se toca (y /reelsx no es /reels).
    ['/reelsx', null],
  ];
  for (const [url, movil] of casos) assert.equal(rutaMovil(url), movil, url);
  // La vuelta: la URL que se MUESTRA es la de escritorio, con la query tal cual, y desde ahí se vuelve a la pantalla.
  for (const r of RUTAS_CREACION) {
    const movil = `/m${r.base}`;
    assert.equal(rutaEscritorio(movil), r.base, movil);
    assert.equal(rutaInterna(r.base), movil, r.base);
  }
  assert.equal(rutaEscritorio('/m/video-editor/abc?desde=anuncio%3A1&ws=3'), '/video-editor/abc?desde=anuncio%3A1&ws=3');
  assert.equal(rutaEscritorio('/m/ai-avatar/avatares'), '/ai-avatar/avatares');
  // Una ruta /m que nadie declaró queda como está (404, como antes), nunca se traduce a otra.
  assert.equal(rutaEscritorio('/m/ai-avatar/inventada'), '/m/ai-avatar/inventada');
  assert.equal(rutaEscritorio('/m/image-editor/presentador'), '/m/image-editor/presentador');
});

// Roto 17/10/2026: la fila de Reels con navKey 'reel' (no existe en nav.ts) → 5/1; la page del teléfono de Stories con
// `navKey: 'copywriting'` → 5/1; la page de Avatars sin `requireAiAvatarM()` → 5/1; la de Voices sin su <CabeceraM> → 5/1;
// la de Copy Method sin `getSesionAdmin()` → 5/1.
test('la puerta del teléfono es la de escritorio: la misma key, que existe, y la de AI Avatar', () => {
  // AI Avatar tiene su fila VISIBLE en More desde que es de Pro (29/10/2026), como Video: la cabecera y la puerta salen de ahí.
  const filaAvatar = SECCIONES_MAS.find((x) => x.navKey === 'ai-avatar');
  assert.ok(filaAvatar && !filaAvatar.oculta && filaAvatar.href === '/m/ai-avatar', 'AI Avatar sin su fila de More');
  for (const s of SECCIONES_CREACION) {
    assert.equal(s.oculta, true, `${s.id}: es una fila oculta (lib/movil-creacion.ts dice por qué)`);
    const pagina = `app/m/${s.href.slice('/m/'.length)}/page.tsx`;
    assert.ok(existsSync(join(RAIZ, pagina)), `${pagina} no existe`);
    if (s.superAdmin) {
      // Una herramienta del super admin (ADMIN_NAV), con la puerta de escritorio (hoy ninguna: el método de redacción se fue
      // el 29/10/2026).
      assert.ok(ADMIN_NAV.some((i) => i.key === s.navKey), `${s.id}: la key «${s.navKey}» no es de ADMIN_NAV`);
      assert.ok(leer(pagina).includes('await getSesionAdmin()'), `${pagina}: sin getSesionAdmin(), la puerta de escritorio`);
      continue;
    }
    assert.ok(TODOS_LOS_ITEMS.some((i) => i.key === s.navKey), `${s.id}: la key «${s.navKey}» no está en nav.ts (la puerta se cerraría para todos, sin error)`);
    assert.ok(leer(pagina).includes(`requireMovil({ navKey: '${s.navKey}' })`), `${pagina}: sin requireMovil de su key`);
  }
  // Las pages de escritorio con la pregunta de toda tab piden la MISMA key que su pantalla del teléfono.
  const escritorio: Record<string, string> = {
    stories: 'app/stories/page.tsx',
  };

  for (const [id, archivo] of Object.entries(escritorio)) {
    const s = SECCIONES_MAS.find((x) => x.id === id)!;
    assert.ok(leer(archivo).includes(`requireRolWs([], { nav: '${s.navKey}' })`), `${archivo} ya no pide «${s.navKey}»`);
  }
  // Los dos editores: escritorio los cierra en su acceso.ts con la misma pregunta.
  assert.ok(leer('app/video-editor/acceso.ts').includes("requireRolWs([], { nav: 'video-editor' })"));
  assert.ok(leer('app/image-editor/acceso.ts').includes("requireRolWs([], { nav: 'image-editor' })"));
  for (const p of ['app/m/video-editor/[proyecto]/page.tsx', 'app/m/image-editor/[diseno]/page.tsx']) {
    assert.match(leer(p), /requireMovil\(\{ navKey: '(video|image)-editor' \}\)/, p);
  }
  // AI Avatar: escritorio la cierra con `requireAiAvatar` (la puerta de Pro), y el teléfono con la misma pregunta.
  assert.ok(leer('app/m/ai-avatar/puerta.ts').includes('veAiAvatar()'));
  const avatar: Record<string, string> = {
    // Una sola key desde el 29/10/2026 (AI Avatar sin secciones): las de las secciones ya no están en nav.ts, y una puerta con
    // una key que no existe se cierra para todos sin error.
    'app/m/ai-avatar/page.tsx': 'ai-avatar', 'app/m/ai-avatar/avatares/page.tsx': 'ai-avatar',
    'app/m/ai-avatar/voces/page.tsx': 'ai-avatar', 'app/m/ai-avatar/plantillas/page.tsx': 'ai-avatar',
  };
  for (const [p, key] of Object.entries(avatar)) {
    const src = leer(p);
    assert.ok(src.includes(`requireMovil({ navKey: '${key}' })`), `${p}: sin su key`);
    assert.ok(src.includes('await requireAiAvatarM()'), `${p}: sin la puerta del super admin`);
  }
  // Desde el 29/10/2026 AI Avatar es UNA pantalla (el estudio de Higgsfield), con su fila de More (la cabecera la pone el shell),
  // y las tres secciones de HeyGen redirigen a ella DESPUÉS de su puerta, con `rutaConWs` (un redirect('/m…') pelado no se traduce).
  assert.ok(!leer('app/m/ai-avatar/page.tsx').includes('<CabeceraM'), 'la base dibuja su cabecera Y la del shell (tiene fila)');
  for (const sub of ['avatares', 'voces', 'plantillas']) {
    const src = leer(`app/m/ai-avatar/${sub}/page.tsx`);
    assert.match(src, /redirect\(await rutaConWs\([^;]*\/m\/ai-avatar/, `${sub}: no redirige al estudio`);
    assert.ok(src.indexOf('await requireAiAvatarM()') < src.indexOf('redirect('), `${sub}: redirige antes de la puerta`);
  }
});

const SUPER: VistaNav = { adminShell: true, rolWs: 'admin', capa: 'superadmin' };
const CLIENTE: VistaNav = { adminShell: false, rolWs: 'admin', capa: 'completo' };
const keys = (xs: ReturnType<typeof seccionesDeTabM>) => xs.map((x) => x.id);

// Roto 17/10/2026: con `adminShell` del cliente en true (Reels a la vista de un cliente) → 5/1 (sobre `seccionesDeTabM`,
// que desde la unión con la barra de Mobile 2 vive en app/m/_ui/SeccionesTabM.tsx).
test('la barra de secciones de cada tab: las de escritorio, con la regla del Sidebar, cada una a su pantalla del teléfono', () => {
  // Video e Image SIN barra desde el 29/10/2026 (Martín: «para todas las secciones de "create" no quiero otras tabs»): ni en
  // escritorio ni en el teléfono. Sus ítems son 'video-editor' e 'image-editor', sin secciones (tests/crear-pantalla.test.ts).
  // Copywriting tampoco desde el 29/10/2026 («Copywriter = Notion»): un ítem, key 'copywriter', sin secciones.
  for (const tab of ['video', 'image', 'video-editor', 'image-editor', 'copywriting', 'copywriter']) {
    assert.deepEqual(keys(seccionesDeTabM(tab, SUPER)), [], `${tab}: sin barra de secciones`);
    assert.deepEqual(keys(seccionesDeTabM(tab, CLIENTE)), [], `${tab}: sin barra de secciones`);
  }
  // AI Avatar, UNA pantalla desde el 29/10/2026: sin barra de secciones ni para el super admin.
  assert.deepEqual(keys(seccionesDeTabM('ai-avatar', SUPER)), []);
  assert.deepEqual(keys(seccionesDeTabM('ai-avatar', CLIENTE)), []);
  // Un closer no ve ninguna (son del admin).
  assert.deepEqual(keys(seccionesDeTabM('copywriting', { adminShell: false, rolWs: 'closer', capa: 'completo' })), []);
});

// Roto 17/10/2026: la línea de `esTrabajo` de los editores borrada → 5/1.
test('el editor de un proyecto o de un diseño es pantalla de trabajo; sus inicios no', () => {
  assert.equal(esTrabajo('/m/video-editor/abc'), true);
  assert.equal(esTrabajo('/m/image-editor/abc'), true);
  assert.equal(esTrabajo('/m/video-editor'), false);
  assert.equal(esTrabajo('/m/image-editor'), false);
  assert.equal(cabeceraPorRuta('/m/video-editor/abc').conBarra, false);
  // Los inicios vuelven a More, con el nombre de su pantalla.
  assert.deepEqual(cabeceraPorRuta('/m/image-editor'), { titulo: 'Image Editor', padre: { href: '/m/mas', label: 'More' }, trabajo: false, conBarra: true });
  assert.deepEqual(cabeceraPorRuta('/m/stories').padre, { href: '/m/mas', label: 'More' });
});

// Roto 17/10/2026: StoriesApp.tsx con su `secuenciaATexto` de vuelta adentro → 5/1.
test('el teléfono no copia lo de escritorio: los textos de «Copiar» viven en módulos puros que usan los dos lados', () => {
  const pares: Array<[string, string, string]> = [
    ['app/stories/StoriesApp.tsx', 'app/m/stories/StoriesM.tsx', 'secuenciaATexto'],
  ];
  for (const [escritorio, telefono, fn] of pares) {
    for (const f of [escritorio, telefono]) {
      const src = leer(f);
      assert.ok(src.includes(fn), `${f} no usa ${fn}`);
      assert.ok(!new RegExp(`function ${fn}\\b`).test(src), `${f} tiene su propia copia de ${fn}`);
    }
  }
  // Reels y Carousels se retiraron el 29/10/2026 (redirigen): sus módulos de texto se fueron con sus pantallas.
  for (const m of ['app/stories/texto.ts']) {
    assert.ok(!/^\s*['"]use client['"]/m.test(readFileSync(join(RAIZ, m), 'utf8').slice(0, 400)), `${m} tiene que ser puro`);
  }
});

/** Los archivos .ts/.tsx de una carpeta. */
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(join(RAIZ, dir))) {
    const r = `${dir}/${n}`;
    if (statSync(join(RAIZ, r)).isDirectory()) out.push(...archivos(r));
    else if (/\.tsx?$/.test(n)) out.push(r);
  }
  return out;
}

// Roto 17/10/2026: la page de Avatars llamando a `crearLookAction` al abrir → 5/1.
test('abrir una pantalla de AI Avatar no gasta nada: ninguna page llama a lo que encola trabajo en Flow', () => {
  const pages = archivos('app/m/ai-avatar').filter((f) => f.endsWith('page.tsx'));
  assert.equal(pages.length, 4);
  for (const p of pages) {
    const src = leer(p);
    for (const fn of ['crearLookAction', 'crearVideoAction', 'generarTomaAction', 'filmarTomas', 'borrarLookAction']) {
      assert.ok(!src.includes(fn), `${p} llama a ${fn}: abrir la pantalla no puede encolar ni gastar`);
    }
  }
  // Y lo que filma lo dispara un toque: «Generar video», con su consecuencia pegada arriba.
  const crear = leer('app/m/ai-avatar/EstudioM.tsx');
  assert.ok(crear.includes('Cada toma gasta créditos de tu cuenta de Flow.'));
  assert.match(crear, /onClick=\{\(\) => void generar\(\)\}/);
});

// Roto 17/10/2026: el selector de la fila de abajo del reproductor borrado de app/m/video-editor/video-editor.css → 6/1.
test('el editor de video del teléfono esconde la cabecera y la fila de abajo del reproductor de escritorio, por sus clases', () => {
  // Si el motor les cambia la clase, el teléfono las vuelve a mostrar: el tiempo HH:MM:SS:FF y los cuatro menús no entran
  // en 390 px y se pisan con ▶ (medido 17/10/2026). Este test lo dice antes.
  const css = readFileSync(join(RAIZ, 'app/m/video-editor/video-editor.css'), 'utf8');
  // La fila de abajo cambia de clases según su ancho (30/10/2026): se la elige por su marca, no por una clase.
  const motor: Array<[string, string, string]> = [
    ['app/video-editor/_opencut/preview/components/cabecera.tsx', 'bg-[var(--cc-panel-head)]', '[class~="bg-[var(--cc-panel-head)]"]'],
    ['app/video-editor/_opencut/preview/components/toolbar.tsx', 'data-barra-reproductor=""', '[data-barra-reproductor]'],
  ];
  for (const [archivo, marca, selector] of motor) {
    assert.ok(readFileSync(join(RAIZ, archivo), 'utf8').includes(marca), `${archivo} ya no lleva «${marca}»: el teléfono la mostraría`);
    assert.ok(css.includes(`.m-video-editor-escenario ${selector}`), `video-editor.css no esconde «${selector}»`);
  }
});
