// =============================================================================
// More: cada fila es la de la sidebar, quién ve cada una, y que cada una TENGA su pantalla
// =============================================================================
// Pedido de Martín (14/10/2026): «Implementá TODAS las tabs que construimos, todo», con la regla del
// v3: «en el celular todo se ve SIMILAR al escritorio, pero con menos texto y menos cosas». El
// 15/10/2026 More sumó las siete que el prototipo ya dibujaba (Calendario, Second Brain, Experiments,
// Offer, Copywriting, Curso y Comunidad). Lo que fija este archivo, sin una tabla de permisos aparte:
//   · cada fila de More es la de la SIDEBAR: el mismo nombre, el mismo ícono, la misma familia y el
//     mismo orden (y una tab nueva de la sidebar que no entra en More tiene que decir por qué);
//   · quién ve cada una: `puedeVerKey` (rolesWs de nav.ts + capa), igual que la sidebar y que el guard
//     de su página de escritorio;
//   · la ida y vuelta de cada sección con su query, aunque su página todavía no exista;
//   · la cabecera (vuelve a More; Offer es de trabajo) y el título de la pestaña;
//   · ⚠️ que cada sección TENGA su app/m/<carpeta>/page.tsx con `requireMovil({ navKey })` de SU key.
//     Una fila sin página es una fila de More que da 404, un hueco de la barra que da 404 y, con
//     MOVIL_ACTIVO prendido, la URL de escritorio de esa tab dando 404 en todos los teléfonos.
//
// ⚠️ AL ESCRIBIRSE (15/10/2026) EL ÚLTIMO FALLA A PROPÓSITO: las siete páginas las escriben otros
// agentes en paralelo y se commitean juntas con este mapa. Si se commitea el mapa sin ellas, este test
// es el que lo dice (AGENTS.md: «la página de una sección mapeada sale en el MISMO deploy que el mapa»).
//
// Verificado ROMPIÉNDOLO (15/10/2026, scratchpad/romper.py: cada rotura sobre el archivo real y
// restaurado por hash), de a una; base 6 pasan / 1 falla (el de las páginas, que nombra las siete):
//   · Second Brain después de Dashboard en SECCIONES_MAS              → 4 / 3 (+ la sidebar, quién ve)
//   · la navKey de Copywriting 'copywriting' (la de la tab unificada) → 3 / 4 (+ las siete, quién ve, gating)
//   · `QUERY_DE_SECCION.comunidad` sin 'post'                         → 5 / 2 (+ ida y vuelta)
//   · `rutaEscritorio` sin la fila de /m/second-brain                 → 4 / 3 (+ las siete, ida y vuelta)
//   · Curso mapeado después del `dentro(p, '/customer-success')`      → 5 / 2 (+ ida y vuelta)
//   · `esTrabajo` sin /m/offer                                        → 5 / 2 (+ cabecera)
//   · la cabecera con `seccion.label` en vez de `tituloSeccion`       → 5 / 2 (+ cabecera)
// ⚠️ La primera versión de la ida y vuelta recorría QUERY_DE_SECCION y nada más: borrar 'post' daba 6 / 1,
// porque el lazo dejaba de preguntar por él. Por eso la tabla está escrita a mano en el test.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, MAKO_NAV, type NavItem } from '../app/_components/nav';
import { CAPAS, tabEnCapa, type CapaId } from '../lib/capas';
import {
  DESTINOS_MOVIL, FAMILIAS_MAS, QUERY_DE_SECCION, RUTA_MAS, SECCIONES_MAS, barraMovil, gruposMas, puedeVerKey,
  rutaEscritorio, rutaInterna, rutaMovil, seccionesMasVisibles, tituloSeccion, type DefSeccionMas, type IdSeccionMas,
  type RolMovil,
} from '../lib/movil-rutas';
import { cabeceraPorRuta, nivel } from '../app/m/_ui/cabecera';
import { tituloDe } from '../lib/titulo-tab';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

/** Las siete del 15/10/2026, en el orden de More. */
const SIETE: IdSeccionMas[] = ['calendario', 'second-brain', 'experimentos', 'offer', 'copywriting', 'curso', 'comunidad'];
const seccion = (id: IdSeccionMas) => SECCIONES_MAS.find((s) => s.id === id)!;
/** Las claves de una sección, leídas con el tipo de la lib: después del `assert.deepEqual` de abajo, TS
 *  achica QUERY_DE_SECCION al literal de la tabla (deepEqual es un `asserts`), y QUERY_DE_SECCION[s.id] ya
 *  no compila para las secciones sin query (TS7053). Una función de módulo no hereda ese achique. */
const queryDe = (id: IdSeccionMas): readonly string[] => QUERY_DE_SECCION[id] ?? [];

/** La fila que la sidebar DIBUJA para una key: el ítem, o la tab unificada que la tiene de sección (Video, Copywriting). */
function filaDeSidebar(key: string): { familia: string | null; orden: number; item: NavItem } | null {
  for (const [i, f] of FAMILIAS.entries()) {
    const tabs = [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)];
    const j = tabs.findIndex((t) => t.key === key || (t.secciones ?? []).some((x) => x.key === key));
    if (j >= 0) return { familia: f.label, orden: i * 100 + j, item: tabs[j] };
  }
  const m = MAKO_NAV.findIndex((t) => t.key === key);
  return m >= 0 ? { familia: null, orden: FAMILIAS.length * 100 + m, item: MAKO_NAV[m] } : null;
}

test('las siete nuevas: su ruta del teléfono, la de escritorio, la key que las gatea y su familia', () => {
  assert.deepEqual(SIETE.map((id) => { const s = seccion(id); return [s.id, s.href, rutaEscritorio(s.href), s.navKey, s.familia]; }), [
    ['calendario', '/m/calendario', '/calendario', 'calendario', 'operate'],
    ['second-brain', '/m/second-brain', '/second-brain', 'second-brain', 'analyze'],
    ['experimentos', '/m/experimentos', '/experimentos', 'experimentos', 'analyze'],
    ['offer', '/m/offer', '/offer', 'offer', 'sales'],
    // La tab unificada Copywriting abre su sección Ads Writer, y es esa key la que gatea (requireRolWs de /ads-writer).
    ['copywriting', '/m/copywriting', '/ads-writer', 'ads-writer', 'content'],
    ['curso', '/m/curso', '/customer-success/curso', 'cs-curso', 'customer'],
    ['comunidad', '/m/comunidad', '/customer-success/comunidad', 'cs-comunidad', 'customer'],
  ]);
});

test('cada fila de More es la de la sidebar: el nombre, el ícono, la familia y el orden', () => {
  let anterior = -1;
  for (const s of SECCIONES_MAS) {
    const fila = filaDeSidebar(s.navKey);
    assert.ok(fila, `${s.id}: la key «${s.navKey}» no es de ninguna fila de la sidebar`);
    const familia = FAMILIAS_MAS.find((f) => f.id === s.familia)?.label ?? null;
    assert.equal(familia, fila.familia, `${s.id}: en More va en «${familia}» y en la sidebar en «${fila.familia}»`);
    assert.equal(s.label, fila.item.label, `${s.id}: la fila no dice lo que dice la sidebar`);
    assert.equal(s.icon, fila.item.icon, `${s.id}: el ícono no es el de la sidebar`);
    assert.ok(fila.orden > anterior, `${s.id}: fuera del orden de la sidebar`);
    anterior = fila.orden;
  }
  // Y lo que la sidebar le muestra a un cliente (sin lo «pronto» ni lo del super admin) está en la barra, en
  // More, o acá con su motivo. Una tab nueva de la sidebar no se olvida en silencio.
  const FUERA: Record<string, string> = {
    general: 'es General, la del medio de la barra',
    whatsapp: 'entra en Chats (la bandeja unificada)',
    email: 'entra en Chats (la bandeja unificada)',
    image: 'Image (la copia de Canva) no entró en la tanda del 15/10/2026: si va al teléfono, es una fila de More',
  };
  const visible = (t: NavItem) => !t.adminOnly && !t.comingSoon;
  for (const f of FAMILIAS) {
    for (const t of [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]) {
      if (!visible(t) || (t.secciones && !t.secciones.some(visible))) continue;
      const keys = [t.key, ...(t.secciones ?? []).map((x) => x.key)];
      const esta = DESTINOS_MOVIL.some((d) => d.navKey && keys.includes(d.navKey)) || SECCIONES_MAS.some((s) => keys.includes(s.navKey));
      assert.ok(esta || FUERA[t.key], `«${t.label}» (${f.label}) está en la sidebar y no en el teléfono, sin un motivo en FUERA`);
      assert.ok(!(esta && FUERA[t.key]), `«${t.label}» está en el teléfono y también en FUERA`);
    }
  }
});

test('quién ve qué en More: rol × capa, con la regla de la sidebar (puedeVerKey) y nada más', () => {
  const ve = (rol: RolMovil, capa: CapaId) => seccionesMasVisibles(rol, capa).map((s) => s.id).filter((id) => SIETE.includes(id));
  // Las siete son de admin en nav.ts (sin rolesWs), como sus páginas de escritorio.
  assert.deepEqual(ve('admin', 'completo'), SIETE);
  assert.deepEqual(ve('admin', 'agencia'), SIETE);
  // La capa superadmin tiene `userNavKeys: null`, y `tabEnCapa` une los dos menús: dice que sí a todo, como en
  // la sidebar del super admin en su workspace (tests/curso-admin.test.ts explica por qué no es un bug).
  assert.deepEqual(ve('admin', 'superadmin'), SIETE);
  // La capa pm: Plan, MaKo, Dashboard y Calendario (lib/capas.ts). De las siete, sólo Calendario.
  assert.deepEqual(ve('admin', 'pm'), ['calendario']);
  for (const capa of Object.keys(CAPAS) as CapaId[]) {
    for (const rol of ['closer', 'setter', null] as const) assert.deepEqual(ve(rol, capa), [], `${rol} en ${capa}`);
  }
  // More entero del admin de un cliente completo: una caja por familia, en su orden, y MaKo al final.
  assert.deepEqual(gruposMas('admin', 'completo').map((g) => [g.titulo, g.secciones.map((s) => s.id)]), [
    ['Operate', ['calendario', 'ads']],
    ['Analyze', ['second-brain', 'dashboard', 'experimentos']],
    ['Sales Machine', ['offer', 'landing', 'automations']],
    ['Content Machine', ['video', 'copywriting']],
    ['Customer Success', ['cs', 'curso', 'comunidad']],
    [null, ['mako']],
  ]);
  // El admin de la capa pm no ve CRM ni Chats: suben las dos primeras de More que ve, en el orden de la
  // sidebar (Calendario y Dashboard), y en More le queda MaKo.
  assert.deepEqual(barraMovil('admin', 'pm').map((b) => b.id), ['calendario', 'dashboard', 'hoy', 'plan', 'mas']);
  assert.deepEqual(gruposMas('admin', 'pm').map((g) => g.secciones.map((s) => s.id)), [['mako']]);
  // El closer y el setter no cambian: More no les ofrece ninguna de las siete.
  assert.deepEqual(gruposMas('closer', 'completo').map((g) => g.secciones.map((s) => s.id)), [['dashboard'], ['mako']]);
  assert.deepEqual(gruposMas('setter', 'completo').map((g) => g.secciones.map((s) => s.id)), [['dashboard'], ['automations'], ['mako']]);
});

test('el teléfono deja entrar donde deja entrar la página de escritorio (mismo gating)', () => {
  // Las cinco que en escritorio son `requireRolWs([], { nav })`: sólo admin, y la capa de ESA key.
  const conRol: Partial<Record<IdSeccionMas, string>> = {
    calendario: 'app/calendario/page.tsx', 'second-brain': 'app/second-brain/page.tsx',
    experimentos: 'app/experimentos/page.tsx', offer: 'app/offer/page.tsx', copywriting: 'app/ads-writer/page.tsx',
  };
  for (const [id, archivo] of Object.entries(conRol) as [IdSeccionMas, string][]) {
    const s = seccion(id);
    // El Second Brain de escritorio es el CHAT con MaKo desde el 16/10/2026 (entra más gente): lo que es del admin de la
    // tab es el MAPA, que es lo que muestra la sección del teléfono, y se corta con la puerta de sus rutas.
    const guarda = id === 'second-brain' ? `esAdminDeTab('${s.navKey}')` : `requireRolWs([], { nav: '${s.navKey}' })`;
    assert.ok(leer(archivo).includes(guarda), `${archivo} ya no se gatea con «${s.navKey}»`);
    assert.equal(filaDeSidebar(s.navKey)?.item.rolesWs, undefined, `${s.navKey}: la sidebar se la da a otro rol y la página no`);
  }
  // Curso y Comunidad piden en escritorio la capa de Customer Success (`requireCapa`), y la sidebar, sólo el admin.
  for (const id of ['curso', 'comunidad'] as const) {
    const s = seccion(id);
    assert.ok(leer(`app/customer-success/${id}/page.tsx`).includes("requireCapa('customer-success')"), `${id}: cambió el guard de escritorio`);
    for (const capa of Object.keys(CAPAS) as CapaId[]) {
      assert.equal(puedeVerKey(s.navKey, 'admin', capa), tabEnCapa('customer-success', capa), `${id} en la capa ${capa}`);
    }
  }
});

test('la ida y vuelta de cada sección, con su query, aunque su página todavía no exista', () => {
  // Lo que cada página de ESCRITORIO lee de la query, escrito acá a mano (el lazo de abajo lo recorre, y
  // sin esta tabla una clave borrada de QUERY_DE_SECCION dejaría de probarse sola). Un link real de cada una:
  // rutaSeccion('persona') → /second-brain?area=voz&vista=persona; la ficha → /customer-success/comunidad?post=N.
  assert.deepEqual(QUERY_DE_SECCION, {
    calendario: ['vista', 'fecha'],
    'second-brain': ['area', 'vista'],
    experimentos: ['tab', 'desde', 'hasta', 'cierres', 'presupuesto', 'hipotesis'],
    offer: ['oferta', 'funnel'],
    copywriting: ['tab'],
    curso: ['producto'],
    comunidad: ['producto', 'post'],
  });
  for (const s of SECCIONES_MAS) {
    const url = rutaEscritorio(s.href);
    assert.ok(!/^\/m(\/|$|\?)/.test(url), `${s.href} → ${url}: no tiene fila en rutaEscritorio`);
    assert.equal(rutaInterna(url), s.href, `${s.href} → ${url} → no vuelve`);
    assert.equal(rutaMovil(url), s.href, `${s.href} → ${url}`);
    // Lo que su pantalla de escritorio lee viaja en los dos sentidos; el `?ws=` nunca vuelve en el link.
    for (const k of queryDe(s.id)) {
      const ida = rutaEscritorio(`${s.href}?${k}=x1&ws=3`);
      assert.equal(ida, `${url}?${k}=x1&ws=3`, `${s.id}: ${k}`);
      assert.equal(rutaMovil(ida), `${s.href}?${k}=x1`, `${s.id}: ${k} no vuelve`);
    }
  }
});

test('la cabecera de cada sección vuelve a More, con el nombre de la pantalla; Offer es de trabajo', () => {
  const t = (titulo: string, trabajo = false) => ({ titulo, padre: { href: RUTA_MAS, label: 'More' }, trabajo, conBarra: !trabajo });
  for (const id of SIETE) {
    const s: DefSeccionMas = seccion(id);
    // Offer es, en escritorio, un chat con MaKo por funnel; en el v3, la pantalla del chat (sin título
    // grande, el composer en la franja del pulgar): como /m/mako, sin la barra de abajo.
    assert.deepEqual(cabeceraPorRuta(s.href), t(tituloSeccion(s), id === 'offer'), s.href);
    assert.equal(nivel(s.href), 1, s.href);
    assert.equal(tituloDe(s.href), `MaKo - ${tituloSeccion(s)}`, s.href);
  }
  // Copywriting: la fila dice «Copywriting» (la sidebar) y la pantalla «Ads Writer» (lo que abre, como
  // la pestaña de /ads-writer en la computadora); su subpantalla vuelve a «Ads Writer».
  assert.equal(seccion('copywriting').label, 'Copywriting');
  assert.equal(cabeceraPorRuta('/m/copywriting').titulo, 'Ads Writer');
  assert.equal(tituloDe('/ads-writer'), tituloDe('/m/copywriting'), 'la pestaña dice lo mismo en los dos lados');
  assert.deepEqual(cabeceraPorRuta('/m/copywriting/guion-1').padre, { href: '/m/copywriting', label: 'Ads Writer' });
  assert.deepEqual(cabeceraPorRuta('/m/curso/7').padre, { href: '/m/curso', label: 'Curso' });
  // Curso y Comunidad no son Clientes: el prefijo va con barra.
  assert.equal(cabeceraPorRuta('/m/curso').titulo, 'Curso');
  assert.equal(cabeceraPorRuta('/m/comunidad').titulo, 'Comunidad');
  // La sección que sube a la barra (Calendario, en la capa pm) es una raíz: sin volver.
  assert.deepEqual(cabeceraPorRuta('/m/calendario', barraMovil('admin', 'pm')), { titulo: 'Calendario', padre: null, trabajo: false, conBarra: true });
});

test('cada sección de More TIENE su página, con el guard de SU key', () => {
  // ⚠️ Falla hasta que lleguen las páginas (ver la cabecera de este archivo): una fila de More sin página
  // es un 404 en More, en la barra del rol que la sube y en la URL de escritorio de esa tab en un teléfono.
  const faltan: string[] = [];
  for (const s of SECCIONES_MAS) {
    const archivo = `app/m/${s.href.slice('/m/'.length)}/page.tsx`;
    if (!existsSync(join(RAIZ, archivo))) { faltan.push(`${archivo} (no existe)`); continue; }
    if (!leer(archivo).includes(`requireMovil({ navKey: '${s.navKey}' })`)) faltan.push(`${archivo} (sin requireMovil({ navKey: '${s.navKey}' }))`);
  }
  assert.deepEqual(faltan, []);
});
