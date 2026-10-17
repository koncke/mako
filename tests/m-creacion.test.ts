// =============================================================================
// MaKo Mobile — las tabs de CREACIÓN en el teléfono (17/10/2026)
// =============================================================================
// Video Editor, Image Editor, AI Avatar, Reels, Stories, Carousels y las «pronto» (lib/movil-creacion.ts y
// app/m/_creacion). Fija lo que se rompe sin un solo error:
//   · la ida y la vuelta de cada ruta de escritorio con su pantalla del teléfono (con su query, las subrutas y las
//     rutas viejas), y lo que se QUEDA en la computadora (el presentador del Image Editor, una subruta inventada);
//   · que la puerta del teléfono sea la de escritorio: la MISMA key de nav.ts que pide cada page de escritorio, una
//     key que exista (`puedeVerKey` dice que no, en silencio, a una que no está), y AI Avatar con su segunda puerta;
//   · la barra de secciones de cada tab: las de escritorio, con la regla del Sidebar (`adminOnly` sólo para el super
//     admin sin mirar a un cliente), y sin la que no tiene pantalla en el teléfono (Copy Method);
//   · los editores son pantallas de trabajo (sin la barra de abajo desde el HTML del server);
//   · el teléfono no COPIA lo de escritorio: los textos de «Copiar» viven en módulos puros que usan los dos lados;
//   · abrir una pantalla de AI Avatar no gasta nada: ninguna page llama a lo que encola trabajo en Flow.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/romper.py: doce roturas sobre el archivo real, de a una, restaurando
// de memoria y comparando el hash): base 6 pasan / 0 fallan; cada rotura, 5 / 1 en el test que la vigila (anotada
// arriba de cada uno); restaurado, 6 / 0.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TODOS_LOS_ITEMS } from '../app/_components/nav';
import { RUTAS_CREACION, SECCIONES_CREACION } from '../lib/movil-creacion';
import { SECCIONES_MAS, rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { esTrabajo, cabeceraPorRuta } from '../app/m/_ui/cabecera';
import { seccionesTabM } from '../app/m/_creacion/secciones';
import type { VistaNav } from '../lib/nav-visibilidad';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

// Roto 17/10/2026: una ruta de alias borrada (era `/vsl-writer`, hoy de las «pronto») → 5/1; `noSub` sin 'presentador' → 5/1; la query de `/ai-avatar/avatares`
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
    ['/reels', '/m/reels'], ['/stories', '/m/stories'], ['/carousels', '/m/carousels'],
    // Las «Coming soon» de una tab con secciones van a la pantalla «pronto» de Mobile 2, no a una de acá.
    ['/image-generator', '/m/pronto/image-generator'], ['/youtube-writer', '/m/pronto/youtube-writer'],
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
// `navKey: 'copywriting'` → 5/1; la page de Avatars sin `requireAiAvatarM()` → 5/1.
test('la puerta del teléfono es la de escritorio: la misma key, que existe, y AI Avatar sólo para el super admin', () => {
  // AI Avatar NO tiene fila (lib/movil-creacion.ts: una fila oculta le borraría su fila en More, `masCompleto`).
  assert.ok(!SECCIONES_MAS.some((x) => x.navKey.startsWith('ai-avatar')), 'AI Avatar no va en SECCIONES_MAS');
  for (const s of SECCIONES_CREACION) {
    assert.ok(TODOS_LOS_ITEMS.some((i) => i.key === s.navKey), `${s.id}: la key «${s.navKey}» no está en nav.ts (la puerta se cerraría para todos, sin error)`);
    assert.equal(s.oculta, true, `${s.id}: es una fila oculta (lib/movil-creacion.ts dice por qué)`);
    const pagina = `app/m/${s.href.slice('/m/'.length)}/page.tsx`;
    assert.ok(existsSync(join(RAIZ, pagina)), `${pagina} no existe`);
    assert.ok(leer(pagina).includes(`requireMovil({ navKey: '${s.navKey}' })`), `${pagina}: sin requireMovil de su key`);
  }
  // Las pages de escritorio con la pregunta de toda tab piden la MISMA key que su pantalla del teléfono.
  const escritorio: Record<string, string> = {
    reels: 'app/reels/page.tsx', stories: 'app/stories/page.tsx', carousels: 'app/carousels/page.tsx',
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
  // AI Avatar: escritorio la cierra con `requireAiAvatar` (sólo el super admin), y el teléfono con la misma pregunta.
  assert.ok(leer('app/m/ai-avatar/puerta.ts').includes('veAiAvatar()'));
  const avatar: Record<string, string> = {
    'app/m/ai-avatar/page.tsx': 'ai-avatar-crear', 'app/m/ai-avatar/avatares/page.tsx': 'ai-avatar-avatares',
    'app/m/ai-avatar/voces/page.tsx': 'ai-avatar-voces', 'app/m/ai-avatar/plantillas/page.tsx': 'ai-avatar-plantillas',
  };
  for (const [p, key] of Object.entries(avatar)) {
    const src = leer(p);
    assert.ok(src.includes(`requireMovil({ navKey: '${key}' })`), `${p}: sin su key`);
    assert.ok(src.includes('await requireAiAvatarM()'), `${p}: sin la puerta del super admin`);
    assert.ok(src.includes("<CabeceraM titulo=\"AI Avatar\" padre={{ href: RUTA_MAS, label: 'More' }} />"), `${p}: sin su cabecera (no tiene fila)`);
  }
});

const SUPER: VistaNav = { adminShell: true, rolWs: 'admin', capa: 'superadmin' };
const CLIENTE: VistaNav = { adminShell: false, rolWs: 'admin', capa: 'completo' };
const keys = (xs: ReturnType<typeof seccionesTabM>) => xs.map((x) => x.key);

// Roto 17/10/2026: `seccionesTabM` sin filtrar por `rutaMovil` (Copy Method en la barra) → 5/1; con `adminShell` del
// cliente en true (Reels a la vista de un cliente) → 5/1.
test('la barra de secciones de cada tab: las de escritorio, con la regla del Sidebar, y sólo con pantalla en el teléfono', () => {
  assert.deepEqual(keys(seccionesTabM('video', SUPER)), ['video-editor', 'video-generator', 'reels']);
  assert.deepEqual(keys(seccionesTabM('video', CLIENTE)), ['video-editor', 'video-generator']);
  assert.deepEqual(seccionesTabM('video', CLIENTE).map((s) => [s.label, s.href]), [['Editor', '/m/video-editor'], ['Create with AI', '/m/video']]);
  // Image: Image Generator y Thumbnails están en la barra de un cliente, con su «pronto», como en escritorio.
  assert.deepEqual(seccionesTabM('image', CLIENTE).map((s) => [s.key, s.pronto]), [
    ['image-editor', false], ['image-generator', true], ['thumbnails', true], ['carousels', false],
  ]);
  // Copywriting: Copy Method es una herramienta del super admin sin pantalla en el teléfono; a un cliente le queda
  // sólo Ads Writer (y con una sección la barra no se dibuja).
  assert.deepEqual(keys(seccionesTabM('copywriting', SUPER)), ['ideas', 'ads-writer', 'youtube-writer', 'stories']);
  assert.deepEqual(keys(seccionesTabM('copywriting', CLIENTE)), ['ads-writer']);
  assert.deepEqual(keys(seccionesTabM('ai-avatar', SUPER)), ['ai-avatar-crear', 'ai-avatar-avatares', 'ai-avatar-voces', 'ai-avatar-plantillas']);
  assert.deepEqual(keys(seccionesTabM('ai-avatar', CLIENTE)), []);
  // Un closer no ve ninguna (son del admin).
  assert.deepEqual(keys(seccionesTabM('video', { adminShell: false, rolWs: 'closer', capa: 'completo' })), []);
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
  assert.deepEqual(cabeceraPorRuta('/m/reels').padre, { href: '/m/mas', label: 'More' });
});

// Roto 17/10/2026: StoriesApp.tsx con su `secuenciaATexto` de vuelta adentro → 5/1.
test('el teléfono no copia lo de escritorio: los textos de «Copiar» viven en módulos puros que usan los dos lados', () => {
  const pares: Array<[string, string, string]> = [
    ['app/stories/StoriesApp.tsx', 'app/m/stories/StoriesM.tsx', 'secuenciaATexto'],
    ['app/carousels/CarouselsApp.tsx', 'app/m/carousels/CarouselsM.tsx', 'carruselATexto'],
    ['app/reels/ReelsApp.tsx', 'app/m/reels/ReelsM.tsx', 'guionATexto'],
  ];
  for (const [escritorio, telefono, fn] of pares) {
    for (const f of [escritorio, telefono]) {
      const src = leer(f);
      assert.ok(src.includes(fn), `${f} no usa ${fn}`);
      assert.ok(!new RegExp(`function ${fn}\\b`).test(src), `${f} tiene su propia copia de ${fn}`);
    }
  }
  for (const m of ['app/stories/texto.ts', 'app/carousels/pieza.ts', 'app/reels/reel-pedido.ts']) {
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
    for (const fn of ['crearLookAction', 'crearVideoAction', 'generarTomaAction', 'filmarTomas', 'sumarVozAction']) {
      assert.ok(!src.includes(fn), `${p} llama a ${fn}: abrir la pantalla no puede encolar ni gastar`);
    }
  }
  // Y lo que filma lo dispara un toque: «Generar video», con su consecuencia pegada arriba.
  const crear = leer('app/m/ai-avatar/CrearVideoM.tsx');
  assert.ok(crear.includes('Cada toma gasta créditos de tu cuenta de Flow.'));
  assert.match(crear, /onClick=\{\(\) => void generar\(\)\}/);
});
