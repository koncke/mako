// =============================================================================
// El Image Editor (Canva sobre Doory) adentro de MaKo: quién lo abre, el crédito y el ?ws=
// =============================================================================
// Cuatro contratos de la integración (14/10/2026), y los cuatro fallan en silencio:
//
//   1. LO ABRE CUALQUIERA QUE TENGA LA TAB (desde el 15/10/2026, «Que Image aparezca en
//      todos los workspace»): la fila se ve en todos los workspaces y el guard de las pages
//      (`acceso.ts`) es la pregunta de toda tab, rol y capa. Si se abre una sin la otra, o
//      el cliente no la encuentra, o la ve y rebota.
//   2. EL CRÉDITO DE DOORY SE MUESTRA. El motor es Doory (Attribution Assurance License):
//      cada apertura del editor tiene que mostrar el nombre del autor, su identificación
//      y la URL, y el LICENSE viaja con el código. Sacar el cartel sin permiso escrito
//      del autor es incumplir la licencia (docs/editor-imagen/repos/doory.md §1).
//   3. NADIE EN EL EDITOR NAVEGA SIN EL `?ws=`: ni `next/link` ni el router de Next a
//      pelo en los archivos de MaKo del editor (el motor de Doory no navega).
//   4. EL MOTOR ES CLIENTE POR SU ÚNICA PUERTA: ningún módulo del server importa de
//      `_doory/` (entra sólo por ImageEditorCliente, 'use client' y sin SSR).
//
// Correr: node --import tsx --test tests/image-editor-integracion.test.ts
// PROBADO ROMPIÉNDOLO (14/10/2026, de a una y restaurando; corrido con --test-name-pattern):
//   R1 (14/10, cuando era sólo del super admin) sin `adminOnly` → 1a: 0/1. Desde el 15/10 ver 1a y 1c.
//   R2 PantallaEditor sin `<CreditoDoory />`               → 2:  0/1
//   R3 un `import NextLink from 'next/link'` en Inicio.tsx  → 3:  0/1
// Restaurado: 5/0.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, itemsDe } from '../app/_components/nav';
import { resolverTab } from '../lib/nav-visibilidad';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinLineas = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '');
const esCliente = (s: string) => /^\s*['"]use client['"]/m.test(s.slice(0, 400));

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  for (const nombre of readdirSync(join(RAIZ, dir))) {
    const ruta = join(dir, nombre);
    if (statSync(join(RAIZ, ruta)).isDirectory()) out.push(...archivosDe(ruta));
    else if (/\.tsx?$/.test(nombre)) out.push(ruta.replace(/\\/g, '/'));
  }
  return out;
}

test('1a: la sección del nav es la primera de «Image», la tab apunta ahí y ninguna sección de Image es adminOnly', () => {
  const image = FAMILIAS.flatMap((f) => f.bloques.flat()).find((i) => i.key === 'image');
  assert.ok(image, 'no encontré la tab «Image» en el nav');
  assert.equal(image.href, '/image-editor');
  assert.equal(image.secciones?.[0]?.key, 'image-editor', 'el editor tiene que ser la primera sección de «Image»');
  const ie = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'image-editor');
  assert.ok(ie, 'no encontré la entrada image-editor');
  assert.equal(ie.href, '/image-editor');
  // 15/10/2026, Martín: «Que Image aparezca en todos los workspace». Las que todavía no están siguen con su «pronto».
  // PROBADO ROMPIÉNDOLO: con `adminOnly: true` en image-editor, 0/1.
  for (const s of image.secciones ?? []) assert.ok(!s.adminOnly, `${s.key} no puede ser adminOnly: Image se ve en todos los workspaces`);
  const pronto = (image.secciones ?? []).filter((s) => s.comingSoon).map((s) => s.key).sort();
  assert.deepEqual(pronto, ['image-generator', 'thumbnails'], 'Image Generator y Thumbnails siguen diciendo que todavía no están');
});

test('1c: Content Machine → «Image» lleva al editor en la barra del super admin, mirando un cliente y en la del cliente', () => {
  // 14/10/2026, Martín: «No veo la tab en la sidebar principal»; 15/10: «Que Image aparezca en todos los workspace».
  // Medido en el DOM de la Sidebar real ese día: antes, la fila sólo estaba para el super admin en su cuenta; mirando un
  // cliente con `?ws=` y para un admin de cliente no estaba (y con Content Machine plegada no está para nadie).
  // PROBADO ROMPIÉNDOLO: image-editor con `comingSoon: true` → la tab lleva a /carousels, 0/1.
  const image = FAMILIAS.find((f) => f.key === 'content')?.bloques.flat().find((i) => i.key === 'image');
  assert.ok(image, 'la tab «Image» no está en la familia Content Machine');
  assert.equal(resolverTab(image, { adminShell: true, rolWs: 'admin', capa: 'superadmin' })?.href, '/image-editor', 'en su barra, «Image» tiene que llevar al editor');
  assert.equal(resolverTab(image, { adminShell: false, rolWs: 'admin', capa: 'completo' })?.href, '/image-editor', 'mirando un cliente o como admin de un cliente, también');
  assert.equal(resolverTab(image, { adminShell: false, rolWs: 'admin', capa: 'agencia' })?.href, '/image-editor', 'una agencia, también');
  assert.equal(resolverTab(image, { adminShell: false, rolWs: 'closer', capa: 'completo' }), null, 'un closer no (como el Video Editor)');
  assert.equal(resolverTab(image, { adminShell: false, rolWs: 'admin', capa: 'pm' }), null, 'la capa pm no tiene Content Machine');
});

test('1b: las pages llaman al guard, y el guard es la pregunta de toda tab (rol del workspace y capa)', () => {
  for (const p of ['app/image-editor/page.tsx', 'app/image-editor/[diseno]/page.tsx', 'app/image-editor/presentador/page.tsx']) {
    assert.match(sinLineas(leer(p)), /await requireEditorImagen\(\)/, `${p}: falta el guard requireEditorImagen()`);
  }
  const acceso = sinLineas(leer('app/image-editor/acceso.ts'));
  assert.doesNotMatch(acceso, /getSesionAdmin\(\)/, 'desde el 15/10 el editor no es sólo del super admin');
  assert.match(acceso, /requireRolWs\(\[\], \{ nav: 'image-editor' \}\)/, 'el guard de toda tab, con la key exacta del nav');
  // La pregunta sin redirigir vive en lib/ (la API no puede arrastrar `next/navigation`) y la página la reexporta.
  assert.match(acceso, /export \{ veEditorImagen \} from '@\/lib\/image-editor\/acceso'/, 'la página reexporta la pregunta de lib/');
  assert.match(sinLineas(leer('lib/image-editor/acceso.ts')), /tabEnCapa\('image-editor'/, 'la API pregunta lo mismo: la tab en la capa');
});

test('2: el crédito de Doory se dibuja en el editor y la licencia viaja con el código', () => {
  const credito = leer('app/image-editor/editor/CreditoDoory.tsx');
  assert.match(credito, /Siam/);
  assert.match(credito, /Creator and maintainer of Doory/);
  assert.match(credito, /https:\/\/github\.com\/shaongitbd\/doory/);
  assert.match(sinLineas(leer('app/image-editor/editor/PantallaEditor.tsx')), /<CreditoDoory \/>/, 'PantallaEditor no monta el crédito');
  for (const f of ['LICENSE-DOORY', 'NOTICE-DOORY', 'COMMIT-DOORY']) {
    assert.ok(existsSync(join(RAIZ, 'app/image-editor/_doory', f)), `falta _doory/${f}`);
  }
});

test('3: los archivos de MaKo del editor no navegan sin el ?ws=', () => {
  const propios = archivosDe('app/image-editor').filter((f) => !f.startsWith('app/image-editor/_doory/'));
  const malos: string[] = [];
  for (const f of propios) {
    const src = sinLineas(leer(f));
    if (/from ['"]next\/link['"]/.test(src)) malos.push(`${f}: next/link (usar @/app/_ui/Link)`);
    if (/import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from ['"]next\/navigation['"]/.test(src)) malos.push(`${f}: useRouter de next/navigation (usar el de @/app/_ui/Link)`);
  }
  assert.deepEqual(malos, [], `Navegaciones que dejan al super admin en otra cuenta:\n  ${malos.join('\n  ')}`);
});

test('4: ningún módulo del server importa del motor de Doory', () => {
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
  const MOTOR = 'app/image-editor/_doory/';
  // Los módulos sin directiva que SÓLO se cargan desde un cliente del editor (no son server).
  const PUERTA = new Set(['app/image-editor/espacio.ts', 'app/image-editor/mako/servicios.ts', 'app/image-editor/ruta.ts']);
  const malos: string[] = [];
  for (const f of [...archivosDe('app'), ...archivosDe('lib')]) {
    if (f.startsWith(MOTOR) || PUERTA.has(f)) continue;
    const src = leer(f);
    if (esCliente(src)) continue;
    const limpio = sinLineas(src).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of limpio.matchAll(/import\s+(?!type\s)(?:[^;]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
      if (`${resolver(f, m[1])}/`.startsWith(MOTOR)) malos.push(`${f} ← ${m[1]}`);
    }
  }
  assert.deepEqual(malos, [], `módulos del server que importan del motor:\n  ${malos.join('\n  ')}`);
  // Y la PUERTA sólo la abren clientes del editor.
  for (const f of archivosDe('app')) {
    if (f.startsWith('app/image-editor/')) continue;
    const src = sinLineas(leer(f));
    for (const p of PUERTA) {
      const sinExt = p.replace(/\.ts$/, '');
      assert.ok(!src.includes(`@/${sinExt}'`) && !src.includes(`@/${sinExt}"`), `${f} importa ${p}, que carga el motor: sólo desde el editor`);
    }
  }
});

// «Presentar con notas» abre una SEGUNDA ventana. En Doory era `presenter-view.html` (otra página de su build de Vite);
// en MaKo no existía y el botón abría un 404 (14/10/2026). Probado rompiéndolo: con la URL vieja en channel.ts, 0/1.
test('5: la vista del presentador abre una ruta que existe, y sin la cáscara de MaKo', async () => {
  const canal = sinLineas(leer('app/image-editor/_doory/editor/presenter/channel.ts'));
  const m = canal.match(/export function presenterViewUrl[\s\S]*?new URL\('([^']+)'/);
  assert.ok(m, 'presenterViewUrl tiene que armar la URL con una ruta fija');
  const ruta = m[1];
  assert.ok(existsSync(join(RAIZ, 'app', ruta, 'page.tsx')), `${ruta} no tiene page.tsx: el botón abriría un 404`);
  const { esVistaSinChrome } = await import('../app/_components/PublicRouteGate');
  assert.equal(esVistaSinChrome(ruta), true, `${ruta} tiene que ir sin la barra lateral (es una ventana chica)`);
});
