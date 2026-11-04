// =============================================================================
// EL GUARDIÁN: toda tab que dibuja el escritorio tiene su lugar en el teléfono
// =============================================================================
// Martín (17/10/2026, desde el Centro de Operaciones): «Implementa completamente MaKo Mobile en todas las tabs, porque
// hay muchas que aun no se pueden acceder». Lo que pasaba: More se armaba con una lista aparte (`SECCIONES_MAS`) y una
// tab de la sidebar sin pantalla del teléfono no aparecía en ningún lado (Image, AI Avatar, todo el menú de la foto), y
// su URL le mostraba al teléfono «Esta pantalla se usa en la computadora» sin que nadie lo hubiera decidido.
//
// Este archivo recorre nav.ts —lo de arriba, las dos familias con sus secciones y desplegables, el menú de la foto, el
// del super admin, las pantallas sin fila y las herramientas— y exige, para CADA key, uno de tres estados
// (lib/movil-rutas.ts):
//   · PANTALLA: `rutaMovil(href)` da una página de app/m que existe (una que no existe es una pantalla ROTA y falla);
//   · SOLO_ESCRITORIO, con el motivo que lee la persona en More;
//   · EN_CAMINO, con el chat que la escribe. Cuenta como PENDIENTE (sale en el diagnóstico), no falla; pero una tab
//     que ya tiene pantalla y sigue anotada SÍ falla: el Cerebro la saca al integrar.
// Y que More tenga un lugar para cada tab que la sidebar le muestra a cada rol (o la barra la tenga).
//
// Las familias del MODO Dev (ADMIN_FAMILIAS) no se recorren: se llega por `dev-entrar`, que es sólo de escritorio.
//
// Verificado ROMPIÉNDOLO (17/10/2026, scratchpad/mobile2/romper_m2.py: cada rotura sobre el archivo real, restaurado de memoria y
// comparado por hash), de a una; base 5 pasan / 0 fallan:
//   · la key `email` renombrada en SOLO_ESCRITORIO                          → 3 / 2 (email sin marca + la marca fantasma)
//   · `crm` anotado en EN_CAMINO (ya tiene pantalla)                         → 4 / 1 (la marca vieja)
//   · una key fantasma («tab-que-no-existe») en SOLO_ESCRITORIO               → 4 / 1 (las marcas)
//   · `masCompleto` sin el menú de la foto                                    → 4 / 1 (More: falta «Configuración del negocio»)
//   · `rutaMovil` de las «pronto» a /m/proximamente (no hay página)           → 2 / 3 (rotas, More y la ida y vuelta)
//   · sin la excepción de MaKo Partners del super admin                       → 4 / 1 (la diferencia es real)
//   · `masCompleto` sin saltear lo que está en la barra por su ruta            → 4 / 1 (General salía otra vez en Operate,
//     visto a 390 px: General es la portada y no tiene key en DESTINOS_MOVIL)
//   · (4/11/2026) `masCompleto` sin `sinLoQueVende`                           → 4 / 1 (More dibuja Partners y Agency al admin
//     de un negocio y al de una agencia)
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_FAMILIAS, ADMIN_NAV, ARRIBA, FAMILIAS, OPS_CENTER, PRONTO, arribaDe, SIN_FILA, SUPERADMIN_MENU, USER_NAV, itemsDe, type NavItem,
} from '../app/_components/nav';
import { resolverTab, puedeVerItem, type VistaNav } from '../lib/nav-visibilidad';
import { tituloDe } from '../lib/titulo-tab';
import {
  EN_CAMINO, SOLO_ESCRITORIO, barraMovil, destinoActivo, masCompleto, rutaEscritorio, rutaInterna, rutaMovil, type FilaMas, type RolMovil,
} from '../lib/movil-rutas';
import { esTabQueVende } from '../lib/tienda';

const RAIZ = join(__dirname, '..');

/** ¿Hay una page.tsx de app para esta ruta /m (con segmentos dinámicos `[x]`)? */
function existePagina(rutaM: string): boolean {
  let dir = join(RAIZ, 'app');
  for (const s of rutaM.split(/[?#]/)[0].split('/').filter(Boolean)) {
    const exacto = join(dir, decodeURIComponent(s));
    if (existsSync(exacto) && statSync(exacto).isDirectory()) { dir = exacto; continue; }
    const dinamico = readdirSync(dir).find((n) => /^\[[^\].]+\]$/.test(n) && statSync(join(dir, n)).isDirectory());
    if (!dinamico) return false;
    dir = join(dir, dinamico);
  }
  return existsSync(join(dir, 'page.tsx'));
}

/** Todo lo que el escritorio dibuja o abre por key, una vez cada key. Una tab unificada cuenta por sus SECCIONES. */
function itemsDelNav(): NavItem[] {
  const dev = new Set(ADMIN_FAMILIAS.flatMap(itemsDe).map((i) => i.key));
  const todos = [
    ...ARRIBA, ...FAMILIAS.flatMap(itemsDe), ...USER_NAV, ...SUPERADMIN_MENU, ...PRONTO, ...SIN_FILA,
    // Las herramientas del super admin (cuelgan de una tab o del menú) y el Ops Center; sin los registros del modo Dev.
    ...ADMIN_NAV.filter((i) => !dev.has(i.key)),
  ];
  const vistas = new Set<string>();
  return todos.filter((i) => (vistas.has(i.key) ? false : (vistas.add(i.key), true)));
}

type Estado = { tipo: 'pantalla'; ruta: string } | { tipo: 'rota'; ruta: string } | { tipo: 'nada' };
function estadoDe(it: NavItem): Estado {
  const ruta = rutaMovil(it.href);
  if (!ruta) return { tipo: 'nada' };
  return existePagina(ruta) ? { tipo: 'pantalla', ruta } : { tipo: 'rota', ruta };
}

test('toda tab que dibuja el escritorio tiene pantalla en el teléfono, o una marca con su motivo', (t) => {
  const items = itemsDelNav();
  // Un piso para saber que el barrido lee nav.ts (eran 51; el 29/10/2026 se fueron las dos herramientas de redacción del
  // super admin y quedaron 49). No es la cuenta exacta: sólo que no se vacíe sin avisar.
  assert.ok(items.length >= 40, `se recorrieron ${items.length} keys: el barrido no está mirando nav.ts`);
  const sinNada: string[] = [];
  const rotas: string[] = [];
  for (const it of items) {
    const e = estadoDe(it);
    if (e.tipo === 'rota') rotas.push(`${it.key}: ${it.href} → ${e.ruta} (no hay page.tsx)`);
    if (e.tipo === 'nada' && !SOLO_ESCRITORIO[it.key] && !EN_CAMINO[it.key]) sinNada.push(`${it.key} (${it.label}, ${it.href})`);
  }
  assert.deepEqual(rotas, [], 'una tab que lleva a una pantalla del teléfono que no existe');
  assert.deepEqual(sinNada, [], 'tabs sin pantalla en el teléfono y sin marca: su pantalla, o SOLO_ESCRITORIO con el motivo, o EN_CAMINO con el chat');
  // Lo pendiente se CUENTA, no falla: el Cerebro lo ve en cada corrida.
  const pendientes = Object.entries(EN_CAMINO).map(([k, quien]) => `${k} (${quien})`);
  t.diagnostic(`en camino: ${pendientes.length} — ${pendientes.join(', ')}`);
});

test('una marca se va con su pantalla: nada anotado como «sólo escritorio» o «en camino» la tiene ya', () => {
  const porKey = new Map(itemsDelNav().map((i) => [i.key, i]));
  const viejas: string[] = [];
  for (const k of [...Object.keys(SOLO_ESCRITORIO), ...Object.keys(EN_CAMINO)]) {
    const it = porKey.get(k);
    if (it && estadoDe(it).tipo === 'pantalla') viejas.push(`${k} → ${rutaMovil(it.href)}`);
  }
  assert.deepEqual(viejas, [], 'ya tienen pantalla en el teléfono: sacalas de SOLO_ESCRITORIO / EN_CAMINO (lib/movil-rutas.ts)');
});

test('las marcas nombran tabs que existen, una sola cada una, y dicen por qué', () => {
  const keys = new Set(itemsDelNav().map((i) => i.key));
  const fantasmas = [...Object.keys(SOLO_ESCRITORIO), ...Object.keys(EN_CAMINO)].filter((k) => !keys.has(k));
  assert.deepEqual(fantasmas, [], 'una marca de una key que nav.ts no tiene');
  for (const k of Object.keys(SOLO_ESCRITORIO)) assert.ok(!EN_CAMINO[k], `${k}: en las dos listas`);
  for (const [k, motivo] of Object.entries(SOLO_ESCRITORIO)) {
    // Lo lee la persona en More: una o dos frases, que terminan, y no un «no disponible».
    assert.ok(motivo.length >= 40 && /\.$/.test(motivo), `${k}: el motivo tiene que decir por qué, en una frase entera`);
    assert.doesNotMatch(motivo, /no disponible/i, `${k}: «no disponible» a secas no es un motivo`);
  }
  for (const [k, quien] of Object.entries(EN_CAMINO)) assert.ok(quien.trim().length > 0, `${k}: ¿quién la escribe?`);
});

/** Las personas que More tiene que cubrir: el super admin, el admin de cada capa, el closer y el setter. */
const PERSONAS: { nombre: string; rol: RolMovil; capa: string; adminShell: boolean }[] = [
  { nombre: 'super admin', rol: 'admin', capa: 'superadmin', adminShell: true },
  { nombre: 'admin de un negocio completo', rol: 'admin', capa: 'completo', adminShell: false },
  { nombre: 'admin de una agencia', rol: 'admin', capa: 'agencia', adminShell: false },
  { nombre: 'admin de la capa pm', rol: 'admin', capa: 'pm', adminShell: false },
  { nombre: 'closer', rol: 'closer', capa: 'completo', adminShell: false },
  { nombre: 'setter', rol: 'setter', capa: 'completo', adminShell: false },
];

/**
 * Lo que la sidebar le muestra a alguien y More NO, a propósito, con su motivo: la puerta del TELÉFONO (requireMovil →
 * puedeVerKey) es más estricta que la sidebar y la página lo sacaría. Una diferencia nueva falla hasta que se anota acá.
 */
const MAS_ESTRICTO_EN_EL_TELEFONO: Record<string, string> = {
  // (Hasta el 4/11/2026: 'super admin|MaKo Partners', porque `puedeVerKey` no sabe del super admin. Desde ese día MaKo
  // Partners no va en ningún teléfono y lo cubre la regla de abajo, `esTabQueVende`.)
};

test('More tiene un lugar para cada tab que la sidebar le muestra a cada persona (o la barra la tiene)', () => {
  const faltan: string[] = [];
  const rotas: string[] = [];
  const repetidas: string[] = [];
  // Lo que existe para vender MaKo a otros (MaKo Partners, Agency Dashboard) NO va en ningún teléfono (4/11/2026, lib/tienda.ts):
  // es la única diferencia con la sidebar que no se cuenta como falta, y si More la dibuja, falla.
  const vende: string[] = [];
  for (const p of PERSONAS) {
    const vista: VistaNav = { adminShell: p.adminShell, rolWs: p.rol ?? '', capa: p.capa };
    // Lo que dibuja la sidebar (Sidebar.tsx): las tabs resueltas, los ítems de los desplegables, el menú de la foto sin
    // «Tu cuenta» (es la primera fila de More) y, para el super admin, el suyo. Lo de arriba lo pone la página.
    const sidebar: NavItem[] = [
      ...FAMILIAS.flatMap((f) => f.bloques.flat().map((it) => resolverTab(it, vista)).filter((it): it is NavItem => it !== null)),
      ...FAMILIAS.flatMap((f) => (f.grupos ?? []).flatMap((g) => g.items.filter((it) => puedeVerItem(it, vista)))),
      ...USER_NAV.filter((it) => it.key !== 'perfil' && !it.soloSeccion && (!it.adminOnly || p.adminShell) && puedeVerItem(it, vista)),
      // Platform › Coming soon (17/10/2026 noche): las «pronto» salieron de la barra al menú de la foto del super admin.
      ...(p.adminShell ? [...SUPERADMIN_MENU, ...PRONTO] : []),
    ];
    const filas: FilaMas[] = masCompleto(p.rol, p.capa, p.adminShell).flatMap((g) => g.filas.flatMap((f) => (f.tipo === 'grupo' ? [f, ...f.filas] : [f])));
    const lugares = barraMovil(p.rol, p.capa);
    const barra = lugares.map((b) => b.href);
    for (const it of sidebar) {
      const enMas = filas.some((f) => f.label === it.label);
      if (esTabQueVende(it.key)) { if (enMas) vende.push(`${p.nombre}: ${it.label}`); continue; }
      const destino = rutaMovil(it.href);
      // «Está en la barra» = un lugar de la barra es el DUEÑO de esa ruta (`destinoActivo`): las hojas del Dashboard
      // (/m/dashboard) son del lugar «Dashboard» desde el 17/10/2026 noche, aunque su raíz sea /m/hoy.
      const activo = destino != null ? destinoActivo(destino.split('?')[0], lugares) : null;
      const enBarra = destino != null && (barra.includes(destino.split('?')[0]) || (activo != null && activo !== 'mas'));
      if (!enMas && !enBarra && !MAS_ESTRICTO_EN_EL_TELEFONO[`${p.nombre}|${it.label}`]) faltan.push(`${p.nombre}: ${it.label}`);
    }
    for (const f of filas) if (f.tipo === 'pantalla' && !existePagina(f.href)) rotas.push(`${p.nombre}: ${f.label} → ${f.href}`);
    // Lo de ARRIBA de la sidebar (nav.ts → arribaDe) también: «Second Brain» está en More de quien lo ve en la barra, y NO está en
    // el del super admin, que lo abre desde adentro del Ops Center (17/10/2026). El Ops Center lo pone la página.
    const arriba = arribaDe(p.adminShell, (it) => puedeVerItem(it, vista));
    // (o subió a la barra a ocupar un hueco: la capa pm, sin CRM ni Chats, lleva Second Brain abajo desde el 17/10/2026 noche)
    const enLaBarra = (it: NavItem) => { const d = rutaMovil(it.href); return d != null && barra.includes(d.split('?')[0]); };
    for (const it of arriba) if (it !== OPS_CENTER && !filas.some((f) => f.label === it.label) && !enLaBarra(it) && !MAS_ESTRICTO_EN_EL_TELEFONO[`${p.nombre}|${it.label}`]) faltan.push(`${p.nombre}: ${it.label} (arriba)`);
    for (const it of ARRIBA) if (it !== OPS_CENTER && !arriba.includes(it) && filas.some((f) => f.label === it.label)) repetidas.push(`${p.nombre}: ${it.label} (la sidebar no lo dibuja)`);
    // Una cosa en un solo lugar, como el «More» de iOS: nada de lo que está en la barra se repite en More, y nada dos veces.
    const etiquetas = filas.map((f) => f.label);
    for (const f of filas) {
      if (f.tipo === 'pantalla' && barra.includes(f.href.split('?')[0])) repetidas.push(`${p.nombre}: ${f.label} (está en la barra)`);
      if (etiquetas.indexOf(f.label) !== etiquetas.lastIndexOf(f.label)) repetidas.push(`${p.nombre}: ${f.label} (dos veces)`);
    }
  }
  assert.deepEqual(faltan, [], 'tabs de la sidebar sin lugar en More ni en la barra');
  assert.deepEqual(vende, [], 'More dibuja una tab que vende MaKo a otros: el teléfono no vende (lib/tienda.ts)');
  assert.deepEqual(rotas, [], 'filas de More que llevan a una pantalla que no existe');
  assert.deepEqual([...new Set(repetidas)], [], 'More repite lo que ya está en la barra o en More');
});

test('las «Coming soon» tienen SU pantalla en el teléfono, ida y vuelta con la URL de escritorio', () => {
  const pronto = itemsDelNav().filter((i) => i.comingSoon);
  assert.ok(pronto.length >= 5, 'no se encontraron tabs «pronto»');
  for (const it of pronto) {
    const m = rutaMovil(it.href);
    assert.equal(m, `/m/pronto/${it.key}`, `${it.key}: ${it.href}`);
    assert.equal(rutaEscritorio(m!), it.href, `${it.key}: no vuelve a su URL de escritorio`);
    assert.equal(rutaInterna(it.href), m, `${it.key}: el shell no sabe que está en su pantalla`);
    // La pestaña se titula como en la computadora (lib/titulo-tab.ts): sin esto era «MaKo» a secas.
    assert.equal(tituloDe(m!), tituloDe(it.href), `${it.key}: el título de la pestaña`);
  }
  // Una key que no es «pronto» no se inventa una URL.
  assert.equal(rutaEscritorio('/m/pronto/crm'), '/m/pronto/crm');
});
