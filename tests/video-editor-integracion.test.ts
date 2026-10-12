// =============================================================================
// El Video Editor adentro de MaKo: quién lo abre, cómo llega un anuncio y el ?ws=
// =============================================================================
// Cuatro contratos de la integración (paquete L, 11/10/2026), y los cuatro fallan en
// silencio si se rompen:
//
//   1. HOY LO ABRE SÓLO EL SUPER ADMIN. Martín lo valida antes de que lo vea un
//      cliente. Hay tres candados y hacen falta los tres: `adminOnly` en el nav (que
//      el Sidebar sólo respetaba en el menú de la foto: en una familia no escondía
//      nada), el guard de las pages (`acceso.ts`), que es el de verdad — el filtro
//      del Sidebar es cosmético y la URL tecleada entra igual —, y el mismo guard en
//      cada ruta de /api/video-editor (la page no cierra la API).
//   2. «EDITAR EN EL EDITOR» MANDA UNA REF, NUNCA UNA URL. El bucket `video-clips`
//      es público y su ruta no lleva el workspace: una url que viniera del
//      navegador abriría el anuncio de otro cliente. La page la deriva en el server.
//   3. NADIE EN EL EDITOR NAVEGA SIN EL `?ws=`. Un `router.push` pelado no falla:
//      deja al super admin mirando OTRA cuenta. El barrido es sobre el árbol ENTERO
//      de app/video-editor, leído del disco (no `git ls-files`: los archivos nuevos
//      de las tandas en curso todavía no están en el índice y se escaparían).
//   4. EL MOTOR ES CLIENTE POR SU ÚNICA PUERTA. tests/frontera-use-client.test.ts lo
//      exceptúa (sus módulos no llevan 'use client' y daban 12 falsos positivos); la
//      excepción vale mientras ningún módulo del server importe del motor.
//
// Correr: node --import tsx --test tests/video-editor-integracion.test.ts
// PROBADO ROMPIÉNDOLO (11/10/2026, de a una y restaurando):
//   R1 sin `adminOnly` en la entrada del nav                        → 5/1 (de 6)
//   R2 `puedeVer` del Sidebar sin la línea de `adminOnly`             → 5/1 (de 6)
//   R3 [proyecto]/page.tsx con `requireRolWs` en vez del guard        → 5/1 (de 6)
//   R4 un `import Link from 'next/link'` en un archivo del editor     → 5/1 (de 6)
//   R5 `anuncio:../x` aceptado (el regex del id sin acotar)           → 5/1 (de 6)
//   R6 page.tsx del inicio importando `EditorCore` del motor          → 6/1 (de 7)
//   R7 /api/video-editor/tts sin `veEditorVideo()`                    → 7/1 (de 8)
// Restaurado: 8/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FAMILIAS } from '../app/_components/nav';
import { leerRefDesde, refDesdeTexto, rutaEditarEnEditor } from '../app/video-editor/desde/desde';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinLineas = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '');

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const ruta = join(dir, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) out.push(...archivosDe(ruta));
    else if (/\.tsx?$/.test(nombre)) out.push(ruta.replace(/\\/g, '/'));
  }
  return out;
}

test('1a: la tab del nav es adminOnly (y su key sigue siendo la del guard)', () => {
  const items = FAMILIAS.flatMap((f) => [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]);
  const ve = items.find((i) => i.key === 'video-editor');
  assert.ok(ve, 'desapareció la entrada video-editor del nav: la key es contrato con la base (capas, onboarding)');
  assert.equal(ve.href, '/video-editor');
  assert.equal(ve.adminOnly, true, 'el Video Editor se ve sólo como super admin hasta que Martín lo valide');
});

test('1b: el Sidebar respeta adminOnly en las tabs de producto, no sólo en el menú de la foto', () => {
  const sb = sinLineas(leer('app/_components/Sidebar.tsx'));
  assert.match(
    sb,
    // Desde el 12/10 la condición es `adminShell` (super admin SIN impersonar, de main):
    // lo `adminOnly` se ve en el workspace propio, y por eso `video-editor` está en la capa
    // `superadmin` (lib/capas.ts).
    /const puedeVer = \(it: NavItem\) =>\s*\(!it\.adminOnly \|\| (?:rol === 'admin'|adminShell)\)/,
    '`puedeVer` dejó de mirar adminOnly: el Video Editor aparecería en la barra de cualquier cliente',
  );
});

test('1c: las dos pages del editor pasan por el guard del super admin, no por el de toda tab', () => {
  for (const r of ['app/video-editor/page.tsx', 'app/video-editor/[proyecto]/page.tsx']) {
    const src = sinLineas(leer(r));
    assert.match(src, /^\s*await requireEditorVideo\(\);/m, `${r}: sin el guard, la URL tecleada abre el editor a cualquiera`);
    assert.doesNotMatch(src, /requireRolWs\(/, `${r}: requireRolWs solo deja entrar a todo admin-cliente`);
  }
  const acceso = sinLineas(leer('app/video-editor/acceso.ts'));
  assert.match(acceso, /return \(await getSesionAdmin\(\)\) != null;/, 'la pregunta es por la PERSONA (el super admin), también mirando un cliente');
  // El rebote lleva el ?ws=: uno pelado deja a quien rebota en su propia cuenta.
  assert.match(acceso, /redirect\(await rutaConWs\(homeDeCapa\(await getCapaActual\(\)\)\)\)/);
  assert.match(acceso, /await requireRolWs\(\[\], \{ nav: 'video-editor' \}\)/, 'después del candado, lo de toda tab (capa, rol, onboarding)');
  // Y el botón de Video Generator se ofrece con la MISMA pregunta.
  const vg = sinLineas(leer('app/video-generator/page.tsx'));
  assert.match(vg, /veEditorVideo\(\)/);
  assert.match(vg, /<EditorVideoDisponible si=\{editorVideo\}>/);
});

test('2a: la ref del `?desde=` nombra el video; una url o un id con barras no es una ref', () => {
  assert.deepEqual(leerRefDesde('montaje:12'), { origen: 'creativo', ref: { origen: 'montaje', id: 12 } });
  assert.deepEqual(leerRefDesde('anuncio:anuncio-1'), { origen: 'anuncio', id: 'anuncio-1' });
  assert.equal(leerRefDesde('toma:abc-123:2:op_9')?.origen, 'creativo');
  for (const malo of [
    'https://otro.tld/video.mp4',
    '/anuncios/anuncio-1.mp4',
    'anuncio:../x',
    'anuncio:a/b',
    'montaje:abc',
    'montaje:0',
    `anuncio:${'a'.repeat(65)}`,
    '',
  ]) {
    assert.equal(leerRefDesde(malo), null, `«${malo}» no puede ser una ref`);
  }
  // Ida y vuelta: lo que el botón arma es lo que la page lee.
  for (const ref of ['montaje:12', 'anuncio:anuncio-1', 'toma:abc-123:2:op_9']) {
    const r = leerRefDesde(ref);
    assert.ok(r);
    assert.equal(refDesdeTexto(r), ref);
    const url = new URL(rutaEditarEnEditor(ref), 'https://x');
    assert.equal(url.pathname, '/video-editor/nuevo');
    assert.equal(url.searchParams.get('desde'), ref);
  }
});

test('2b: la page lee SÓLO `desde` y la url la arma el server; el cliente no recibe otra cosa', () => {
  const page = sinLineas(leer('app/video-editor/[proyecto]/page.tsx'));
  assert.match(page, /searchParams: Promise<\{ desde\?: string \| string\[\] \}>/, 'la page no lee otro parámetro');
  assert.match(page, /await resolverDesde\(desde\)/);
  const resolver = sinLineas(leer('app/video-editor/desde/resolver.ts'));
  assert.match(resolver, /^import 'server-only';/m);
  assert.match(resolver, /resolverCreativoMako\(r\.ref\)/, 'el MISMO resolvedor que Ads Manager');
  // «No pude leer» no es «no existe».
  assert.match(resolver, /catch \(e\) \{[\s\S]*?return \{ estado: 'error' \};/);
  // El botón: Link de la casa (lleva el ?ws=) y ref, nunca url.
  const boton = sinLineas(leer('app/video-generator/editor-video.tsx'));
  assert.match(boton, /<ButtonLink href=\{rutaEditarEnEditor\(refVideo\)\}/);
  assert.match(sinLineas(leer('app/video-generator/PasoMontaje.tsx')), /<BotonEditarEnEditor refVideo=\{`montaje:\$\{estado\.id\}`\}/);
});

test('3: nada en app/video-editor navega sin el `?ws=`', () => {
  const archivos = archivosDe('app/video-editor');
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas distintas.
  assert.ok(archivos.length > 400, `se leyeron ${archivos.length} archivos del editor: el barrido no está corriendo`);
  const hallazgos: string[] = [];
  const REGLAS: Array<[RegExp, string]> = [
    [/from\s*['"]next\/link['"]/, 'el Link de Next pierde el ?ws= (va app/_ui/Link)'],
    [/import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*['"]next\/navigation['"]/, 'el useRouter de Next pierde el ?ws= (va el de app/_ui/Link)'],
    [/<a\s[^>]*\bhref=\{?["'`]\//, 'un <a href> interno crudo pierde el ?ws='],
    [/window\.location\.(href\s*=|assign\(|replace\()\s*["'`]\//, 'un window.location pelado pierde el ?ws= (va conWs)'],
    [/\bredirect\(\s*["'`]\//, 'un redirect pelado del server pierde el ?ws= (va rutaConWs)'],
  ];
  for (const r of archivos) {
    const src = sinLineas(leer(r));
    for (const [re, porque] of REGLAS) if (re.test(src)) hallazgos.push(`${relative('.', r)}: ${porque}`);
  }
  assert.deepEqual(hallazgos, [], `Navegaciones que dejan al super admin en otra cuenta:\n  ${hallazgos.join('\n  ')}`);
});

test('4: el motor es cliente por su ÚNICA puerta: ningún módulo del server importa un valor suyo', () => {
  // tests/frontera-use-client.test.ts exceptúa al motor (sus módulos no llevan
  // 'use client' y daban falsos positivos). La excepción vale MIENTRAS el motor entre
  // sólo por VideoEditorCliente ('use client', dynamic sin SSR). Esto vigila esa puerta.
  const frontera = leer('tests/frontera-use-client.test.ts');
  const lista = /const CLIENTE_POR_FRONTERA = \[([^\]]*)\]/.exec(frontera)?.[1];
  assert.ok(lista, 'no encontré CLIENTE_POR_FRONTERA en tests/frontera-use-client.test.ts');
  const exentas = [...lista.matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(exentas.length > 0);
  for (const d of exentas) {
    assert.ok(d.startsWith('app/video-editor/'), `«${d}»: este guard sólo vigila la puerta del Video Editor; otra carpeta exenta necesita su propio guard`);
  }
  const esCliente = (s: string) => /^\s*['"]use client['"]/m.test(s.slice(0, 400));
  const resolver = (desde: string, spec: string): string => {
    if (spec.startsWith('@/')) return spec.slice(2);
    if (!spec.startsWith('.')) return spec;
    const dir = desde.split('/').slice(0, -1);
    for (const p of spec.split('/')) {
      if (p === '..') dir.pop();
      else if (p !== '.') dir.push(p);
    }
    return dir.join('/');
  };
  const malos: string[] = [];
  for (const f of [...archivosDe('app'), ...archivosDe('lib')]) {
    if (exentas.some((d) => f.startsWith(d))) continue;
    const src = leer(f);
    if (esCliente(src)) continue;
    const limpio = sinLineas(src).replace(/\/\*[\s\S]*?\*\//g, '');
    // `import type` viaja gratis; un import de efecto (`import '…'`) también ejecuta el módulo.
    for (const m of limpio.matchAll(/import\s+(?!type\s)(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      const destino = resolver(f, m[1]);
      if (exentas.some((d) => `${destino}/`.startsWith(d) || destino.startsWith(d))) malos.push(`${f} ← ${m[1]}`);
    }
  }
  assert.deepEqual(malos, [], `módulos del server que importan del motor (rompe la excepción de frontera-use-client):\n  ${malos.join('\n  ')}`);
});

test('1d: las rutas /api/video-editor/* tienen el MISMO candado que las pages', () => {
  // El guard de la page cierra la pantalla, no la API: un admin-cliente que llame a
  // la ruta a mano entraría igual. Mientras el editor sea sólo del super admin, cada
  // ruta suya pregunta lo mismo (404: a quien no le toca, no existe).
  let rutas: string[] = [];
  try { rutas = archivosDe('app/api/video-editor').filter((r) => /\/route\.ts$/.test(r)); } catch { rutas = []; }
  for (const r of rutas) {
    assert.match(sinLineas(leer(r)), /await veEditorVideo\(\)/, `${r}: la ruta no pregunta veEditorVideo() (app/video-editor/acceso.ts)`);
  }
});
