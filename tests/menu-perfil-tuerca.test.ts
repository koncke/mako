// =============================================================================
// El menú de la foto: sólo Settings arriba, con la TUERCA; Platform en UN ítem; y la tuerca en toda la app (25/10/2026)
// =============================================================================
// Martín (25/10, ~12:00), con la captura del menú: «No me gusta para nada que en el desplegable de super admin me aparezcan
// tantas cosas, de ultima engloba todas esas tabs extras en un solo desplegable que a su vez tenga otro desplegable... Y no me
// gusta que en general el desplegable del perfil, antes de "settings" tenga nuevamente mi foto de perfil, que esté solo
// settings. Y revisa el logo de settings de toda la app, siempre debe ser la tuerca, no ese...». Esto fija:
//   1. la tuerca es UNA (`TUERCA`, app/_ui/icono-tuerca.ts): la de la barra y la de «Configurar» en los desplegables;
//   2. todo lo que es Settings (la de la cuenta, la del negocio, en la compu y en el teléfono, y las Configuraciones de una
//      automatización) usa la tuerca, nunca los deslizantes de `config`;
//   3. el menú de la foto: sin la cara arriba, Settings primero, y lo de la plataforma en UN ítem «Platform» que se abre en el
//      mismo menú, con «Coming soon» adentro, que se abre también.
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 3/0): «Configurar» con los deslizantes → 1 rojo (1); Business settings del teléfono con
// `config` → 1 rojo (2); la cara de vuelta en el menú → 1 rojo (3); lo de la plataforma suelto, sin el ítem → 1 rojo (3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { USER_NAV, TODOS_LOS_ITEMS } from '../app/_components/nav';
import { DESTINOS_MOVIL, SECCIONES_MAS } from '../lib/movil-rutas';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. la tuerca es una: la de la barra y la de «Configurar» en los desplegables', () => {
  assert.match(leer('app/_ui/icono-tuerca.ts'), /export const TUERCA = 'M[^']+Z';/);
  const iconos = leer('app/_components/icons.tsx');
  assert.match(iconos, /import \{ TUERCA \} from '\.\.\/_ui\/icono-tuerca';/);
  assert.match(iconos, /tuerca: \(<><path d=\{TUERCA\} \/><circle cx="12" cy="12" r="3" \/><\/>\),/);
  const menu = leer('app/_ui/iconos-menu.tsx');
  assert.match(menu, /configurar: <><path d=\{TUERCA\} \/><circle cx="12" cy="12" r="3" \/><\/>,/, '«Configurar» no es la tuerca');
  assert.match(menu, /import \{ TUERCA \} from '\.\/icono-tuerca';/);
});

function archivos(dir: string, fuera: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '_opencut') archivos(p, fuera); } else if (/\.tsx?$/.test(n)) fuera.push(p);
  }
  return fuera;
}

test('2. todo lo que es Settings usa la tuerca: la cuenta, el negocio, el teléfono y las Configuraciones de una automatización', () => {
  const settings = TODOS_LOS_ITEMS.concat(USER_NAV).filter((i) => /settings/i.test(i.label));
  assert.ok(settings.length >= 2, 'Settings y Business settings');
  for (const i of settings) assert.equal(i.icon, 'tuerca', `«${i.label}» no lleva la tuerca`);
  const delTelefono = [...DESTINOS_MOVIL, ...SECCIONES_MAS].filter((x) => /settings/i.test(x.label));
  assert.ok(delTelefono.length >= 1, 'Business settings del teléfono');
  for (const d of delTelefono) assert.equal(d.icon, 'tuerca', `el teléfono: «${d.label}»`);
  // Ninguna fila que lleva a Settings (o a las Configuraciones) dibuja los deslizantes.
  const malos: string[] = [];
  for (const f of archivos(join(RAIZ, 'app'))) {
    for (const linea of sinComentarios(readFileSync(f, 'utf8')).split('\n')) {
      if (/(icono|name)="config"/.test(linea) && /\/configuraciones|\/perfil\b|Configuraciones|Settings/.test(linea)) malos.push(`${relative(RAIZ, f)}: ${linea.trim().slice(0, 90)}`);
    }
  }
  assert.deepEqual(malos, [], 'Settings con los deslizantes de `config`: va la tuerca');
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /<Icon name="tuerca" size=\{18\} \/>/, 'el botón de Configuraciones de una automatización');
});

test('3. el menú de la foto: sin la cara, Settings primero, y Platform en UN ítem con «Coming soon» adentro', () => {
  assert.equal(USER_NAV[0].key, 'perfil', 'Settings va primero');
  const sb = sinComentarios(leer('app/_components/Sidebar.tsx'));
  const menu = sb.slice(sb.indexOf('<div id="user-menu"'));
  assert.doesNotMatch(menu.slice(0, menu.indexOf('USER_NAV.filter(')), /<img |nombreVisible|avatarVisible/, 'la cara volvió arriba de Settings');
  assert.match(menu, /aria-expanded=\{verPlataforma\} onClick=\{\(\) => setVerPlataforma\(\(v\) => !v\)\}/, 'Platform es un ítem que se abre');
  const abierta = menu.indexOf('{verPlataforma && (');
  assert.ok(abierta > 0, 'lo de la plataforma sólo con Platform abierto');
  assert.ok(menu.indexOf('SUPERADMIN_MENU.map(filaMenu)') > abierta, 'lo de la plataforma suelto en el menú');
  const pronto = menu.indexOf('aria-expanded={verPronto}');
  assert.ok(pronto > abierta && menu.indexOf('{verPronto && ') > pronto, '«Coming soon» adentro de Platform, que se abre también');
  assert.doesNotMatch(menu, />Platform<\/div>/, 'sin el rótulo «PLATFORM» con todo suelto debajo');
});
