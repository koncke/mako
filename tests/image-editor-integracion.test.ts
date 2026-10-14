// =============================================================================
// El Image Editor (Canva sobre Doory) adentro de MaKo: quién lo abre, el crédito y el ?ws=
// =============================================================================
// Cuatro contratos de la integración (14/10/2026), y los cuatro fallan en silencio:
//
//   1. HOY LO ABRE SÓLO EL SUPER ADMIN, por PERSONA. `adminOnly` en el nav sólo esconde
//      la fila: el candado de verdad es el guard de las pages (`acceso.ts`). Sin él, la
//      URL tecleada abre el editor a cualquier admin de un cliente.
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
//   R1 sin `adminOnly` en la entrada image-editor del nav  → 1a: 0/1
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

test('1a: la sección del nav es adminOnly, es la primera de «Image» y la tab apunta ahí', () => {
  const image = FAMILIAS.flatMap((f) => f.bloques.flat()).find((i) => i.key === 'image');
  assert.ok(image, 'no encontré la tab «Image» en el nav');
  assert.equal(image.href, '/image-editor');
  assert.equal(image.secciones?.[0]?.key, 'image-editor', 'el editor tiene que ser la primera sección de «Image»');
  const ie = FAMILIAS.flatMap(itemsDe).find((i) => i.key === 'image-editor');
  assert.ok(ie, 'no encontré la entrada image-editor');
  assert.equal(ie.adminOnly, true, 'el editor es sólo del super admin hasta que Martín lo valide');
  assert.equal(ie.href, '/image-editor');
});

test('1c: en la barra del super admin, Content Machine → «Image» lleva al editor; mirando un cliente no se ve', () => {
  // 14/10/2026, Martín: «No veo la tab en la sidebar principal, debería estar en la sección de Content Machine».
  // Las dos mitades son reglas de él: la tab va en SU barra (capa superadmin), y mirando un cliente con `?ws=` la barra
  // es la del cliente, sin lo que es sólo del super admin (01/08: «tampoco las tabs que… solo en super admin»).
  // PROBADO ROMPIÉNDOLO: image-editor con `comingSoon: true` → la tab lleva a /carousels, 0/1; sin `adminOnly` → el
  // cliente la ve, 0/1.
  const image = FAMILIAS.find((f) => f.key === 'content')?.bloques.flat().find((i) => i.key === 'image');
  assert.ok(image, 'la tab «Image» no está en la familia Content Machine');
  assert.equal(resolverTab(image, { adminShell: true, rolWs: 'admin', capa: 'superadmin' })?.href, '/image-editor', 'en su barra, «Image» tiene que llevar al editor');
  assert.equal(resolverTab(image, { adminShell: false, rolWs: 'admin', capa: 'completo' }), null, 'mirando un cliente, la barra es la del cliente');
});

test('1b: las dos pages llaman al guard por persona, y el guard pregunta getSesionAdmin', () => {
  for (const p of ['app/image-editor/page.tsx', 'app/image-editor/[diseno]/page.tsx']) {
    assert.match(sinLineas(leer(p)), /await requireEditorImagen\(\)/, `${p}: falta el guard requireEditorImagen()`);
  }
  const acceso = sinLineas(leer('app/image-editor/acceso.ts'));
  assert.match(acceso, /getSesionAdmin\(\)/, 'acceso.ts tiene que preguntar por la PERSONA (getSesionAdmin)');
  assert.match(acceso, /nav: 'image-editor'/, 'el guard de toda tab tiene que usar la key exacta del nav');
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
