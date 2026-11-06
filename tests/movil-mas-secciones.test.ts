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
//
// El Second Brain es el chat con MaKo (16/10/2026, etapa 2 de docs/diseno-mako-ai-native.md, tanda 3). Roto de a
// uno sobre los ocho tests del teléfono que lo miran (movil-rutas, movil-mas-secciones, movil-shell,
// movil-mismas-rutas, m-second-brain, puerta-admin-tab, mako-doer-plazo, m-mako-chat), base 76 / 0:
//   · `gruposMas` sin sacar la fila de abajo cuando se ve la de Analyze      → 74 / 2
//   · la fila de abajo a /m/mako (dos rutas para un chat)                     → 72 / 4
//   · el Mapa (/m/second-brain/mapa) con la key 'mako'                        → 75 / 1
//   · `esTrabajo` sin /m/second-brain                                         → 74 / 2
//   · `rutaMovil` sin mirar `?panel=mapa`                                     → 74 / 2
//   · `rutaEscritorio` del Mapa sin `panel=mapa`                              → 74 / 2
//   · el chat con la key 'second-brain' (deja afuera a closer y setter)       → 73 / 3
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS, MAKO_NAV, type NavItem } from '../app/_components/nav';
import { CAPAS, tabEnCapa, type CapaId } from '../lib/capas';
import {
  DESTINOS_MOVIL, EN_CAMINO, FAMILIAS_MAS, QUERY_DE_SECCION, RUTA_MAS, SECCIONES_MAS, SOLO_ESCRITORIO, barraMovil, gruposMas, puedeVerKey,
  rutaEscritorio, rutaInterna, rutaMovil, seccionesMasVisibles, tituloSeccion, type DefSeccionMas, type IdSeccionMas,
  type RolMovil,
} from '../lib/movil-rutas';
import { cabeceraPorRuta, nivel } from '../app/m/_ui/cabecera';
import { tituloDe } from '../lib/titulo-tab';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

/** Las siete del 15/10/2026. Desde el 17/10/2026 el Mapa (`second-brain`) y Experiments están OCULTAS: sus páginas siguen,
 *  pero no son filas (salieron de la sidebar de escritorio). */
const SIETE: IdSeccionMas[] = ['calendario', 'second-brain', 'experimentos', 'offer', 'copywriting', 'curso', 'comunidad'];
/** Las que siguen siendo filas, en el orden de More. */
const SIETE_FILAS: IdSeccionMas[] = ['calendario', 'offer', 'copywriting'];
const seccion = (id: IdSeccionMas) => SECCIONES_MAS.find((s) => s.id === id)!;
/** Las claves de una sección, leídas con el tipo de la lib: después del `assert.deepEqual` de abajo, TS
 *  achica QUERY_DE_SECCION al literal de la tabla (deepEqual es un `asserts`), y QUERY_DE_SECCION[s.id] ya
 *  no compila para las secciones sin query (TS7053). Una función de módulo no hereda ese achique. */
const queryDe = (id: IdSeccionMas): readonly string[] => QUERY_DE_SECCION[id] ?? [];

/**
 * La fila que la sidebar DIBUJA para una key: el ítem, o la tab unificada que la tiene de sección (Video, Copywriting,
 * Clients). `seccion` es la sección cuando la key es de una: Clients se dibuja como UNA fila en escritorio y en el teléfono
 * son tres (Clients, Course, Community), cada una con el nombre de su sección. Lo de ARRIBA (Second Brain, 17/10/2026)
 * va antes que las familias.
 */
function filaDeSidebar(key: string): { familia: string | null; orden: number; item: NavItem; seccion?: NavItem } | null {
  const m = MAKO_NAV.findIndex((t) => t.key === key);
  if (m >= 0) return { familia: null, orden: -100 + m, item: MAKO_NAV[m] };
  for (const [i, f] of FAMILIAS.entries()) {
    const tabs = [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)];
    const j = tabs.findIndex((t) => t.key === key || (t.secciones ?? []).some((x) => x.key === key));
    if (j < 0) continue;
    const k = (tabs[j].secciones ?? []).findIndex((x) => x.key === key);
    return { familia: f.sinRotulo ? null : f.label, orden: i * 100 + j + Math.max(k, 0) / 10, item: tabs[j], seccion: k >= 0 ? tabs[j].secciones![k] : undefined };
  }
  return null;
}

test('las siete nuevas: su ruta del teléfono, la de escritorio, la key que las gatea y su familia', () => {
  assert.deepEqual(SIETE.map((id) => { const s = seccion(id); return [s.id, s.href, rutaEscritorio(s.href), s.navKey, s.familia]; }), [
    ['calendario', '/m/calendario', '/calendario', 'calendario', 'sales'],
    ['second-brain', '/m/second-brain', '/second-brain', 'second-brain', null],
    ['experimentos', '/m/experimentos', '/experimentos', 'experimentos', null],
    ['offer', '/m/offer', '/offer', 'offer', 'marketing'],
    // Copywriting ES el Copywriter desde el 29/10/2026 (una pantalla, sin tabs internas): su key es la de la pantalla.
    ['copywriting', '/m/copywriter', '/copywriter', 'copywriter', 'create'],
    // Desde el 17/10/2026 la URL de escritorio es la de la tab Clients (docs/diseno-clients.md).
    // Classroom y Community son sub-tabs de Clients desde el 17/10/2026: filas ocultas (sus pantallas siguen).
    ['curso', '/m/curso', '/classroom', 'cs-curso', null],
    ['comunidad', '/m/comunidad', '/classroom/community', 'cs-comunidad', null],
  ]);
});

test('cada fila de More es la de la sidebar: el nombre, el ícono, la familia y el orden', () => {
  // Las de arriba (familia null) van primero en More aunque estén al final de la lista: el orden se mide en el resto.
  // Las OCULTAS no son filas: no se comparan.
  let anterior = -1;
  for (const s of SECCIONES_MAS.filter((x) => !x.oculta)) {
    const fila = filaDeSidebar(s.navKey);
    assert.ok(fila, `${s.id}: la key «${s.navKey}» no es de ninguna fila de la sidebar`);
    const familia = FAMILIAS_MAS.find((f) => f.id === s.familia)?.label ?? null;
    assert.equal(familia, fila.familia, `${s.id}: en More va en «${familia}» y en la sidebar en «${fila.familia}»`);
    // Clients: en el teléfono cada sección es su fila, con el nombre y el ícono de la sección.
    const deLaSidebar = fila.item.key === 'clients' && fila.seccion ? fila.seccion : fila.item;
    // (Las hojas del Dashboard dijeron «Dashboard sheets» del 17 al 24/10/2026; desde que hay UN solo Dashboard en More, la
    // fila que sale dice lo que dice la sidebar, como todas.)
    assert.equal(s.label, deLaSidebar.label, `${s.id}: la fila no dice lo que dice la sidebar`);
    assert.equal(s.icon, deLaSidebar.icon, `${s.id}: el ícono no es el de la sidebar`);
    if (s.familia === null) continue;
    assert.ok(fila.orden > anterior, `${s.id}: fuera del orden de la sidebar`);
    anterior = fila.orden;
  }
  // Y lo que la sidebar le muestra a un cliente (sin lo «pronto» ni lo del super admin) está en la barra, en
  // More, o acá con su motivo. Una tab nueva de la sidebar no se olvida en silencio.
  // Desde el 17/10/2026 una tab sin sección del teléfono tiene su marca en lib/movil-rutas.ts (SOLO_ESCRITORIO o
  // EN_CAMINO)) y More la muestra «En la computadora»; lo fija tests/movil-toda-tab.test.ts.
  const FUERA: Record<string, string> = { general: 'es General, la del medio de la barra' };
  const marcada = (keys: string[]) => keys.some((k) => SOLO_ESCRITORIO[k] || EN_CAMINO[k]);
  const visible = (t: NavItem) => !t.adminOnly && !t.comingSoon;
  for (const f of FAMILIAS) {
    for (const t of [...f.bloques.flat(), ...(f.grupos ?? []).flatMap((g) => g.items)]) {
      if (!visible(t) || (t.secciones && !t.secciones.some(visible))) continue;
      const keys = [t.key, ...(t.secciones ?? []).map((x) => x.key)];
      const esta = DESTINOS_MOVIL.some((d) => d.navKey && keys.includes(d.navKey)) || SECCIONES_MAS.some((s) => keys.includes(s.navKey));
      assert.ok(esta || FUERA[t.key] || marcada(keys), `«${t.label}» (${f.label}) está en la sidebar y no en el teléfono, sin un motivo en FUERA`);
      assert.ok(!(esta && FUERA[t.key]), `«${t.label}» está en el teléfono y también en FUERA`);
    }
  }
});

test('quién ve qué en More: rol × capa, con la regla de la sidebar (puedeVerKey) y nada más', () => {
  const ve = (rol: RolMovil, capa: CapaId) => seccionesMasVisibles(rol, capa).map((s) => s.id).filter((id) => SIETE.includes(id));
  // Las siete son de admin en nav.ts (sin rolesWs), como sus páginas de escritorio; las dos ocultas no son filas.
  assert.deepEqual(ve('admin', 'completo'), SIETE_FILAS);
  assert.deepEqual(ve('admin', 'agencia'), SIETE_FILAS);
  // La capa superadmin tiene `userNavKeys: null`, y `tabEnCapa` une los dos menús: dice que sí a todo, como en
  // la sidebar del super admin en su workspace (tests/curso-admin.test.ts explica por qué no es un bug).
  assert.deepEqual(ve('admin', 'superadmin'), SIETE_FILAS);
  // La capa pm: Plan, MaKo, Dashboard y Calendario (lib/capas.ts). De las siete, sólo Calendario.
  assert.deepEqual(ve('admin', 'pm'), ['calendario']);
  // Desde el 6/11/2026 el closer y el setter ven Calendario (sólo sus «Llamadas», app/calendario/page.tsx) donde su capa lo
  // tiene; las otras seis siguen siendo del admin. Sin rol, nada.
  for (const capa of Object.keys(CAPAS) as CapaId[]) {
    const conCalendario = ve('admin', capa).includes('calendario') ? ['calendario'] : [];
    for (const rol of ['closer', 'setter'] as const) assert.deepEqual(ve(rol, capa), conCalendario, `${rol} en ${capa}`);
    assert.deepEqual(ve(null, capa), [], `sin rol en ${capa}`);
  }
  // More entero del admin de un cliente completo: una caja por familia. Second Brain (el Ops Center) iba arriba sin título
  // hasta el 20/10/2026, cuando pasó al lugar del medio de la barra: More no lo repite.
  assert.deepEqual(gruposMas('admin', 'completo').map((g) => [g.titulo, g.secciones.map((s) => s.id)]), [
    // 17/10/2026 noche, la sidebar del prototipo: lo diario (las hojas del Dashboard; Plan y Chats están en la barra), y
    // Sales · Marketing · Create. Clients es UNA fila; MaKo Partners sólo para una agencia.
    // 04/11/2026: el Dashboard volvió a la barra (donde estaba Plan) y Plan es la fila de lo diario.
    ['Today', ['plan']],
    ['Sales', ['calendario', 'automations', 'cs']],
    ['Marketing', ['offer', 'ads']],
    // Image (la copia de Canva) entró el 17/10/2026, debajo de Video, como en la sidebar (tests/m-creacion.test.ts).
    // AI Avatar, de Pro desde el 29/10/2026: fila de Create, debajo de Copywriting, como en la sidebar.
    ['Create', ['video', 'image', 'copywriting', 'ai-avatar', 'landing']],
  ]);
  // El admin de la capa pm no ve CRM ni Chats: suben las dos primeras de More que ve, en el orden de la sidebar (desde el
  // 20/10/2026 el Ops Center es el lugar del medio y el Dashboard dejó la barra, así que suben sus hojas y Calendar).
  // 04/11/2026: con el Dashboard fijo en la barra (su hoja), suben Plan y Calendar.
  assert.deepEqual(barraMovil('admin', 'pm').map((b) => b.id), ['plan', 'calendario', 'mako', 'dashboard', 'mas']);
  assert.deepEqual(gruposMas('admin', 'pm').map((g) => g.secciones.map((s) => s.id)), []);
  // El closer y el setter: More no les ofrece ninguna de las siete (y el Ops Center lo tienen en la barra).
  // Desde el 6/11/2026, Calendar (sólo sus «Llamadas»).
  assert.deepEqual(gruposMas('closer', 'completo').map((g) => g.secciones.map((s) => s.id)), [['plan'], ['calendario']]);
  assert.deepEqual(gruposMas('setter', 'completo').map((g) => g.secciones.map((s) => s.id)), [['plan'], ['calendario', 'automations']]);
});

test('el teléfono deja entrar donde deja entrar la página de escritorio (mismo gating)', () => {
  // Las cinco que en escritorio son `requireRolWs([], { nav })`: sólo admin, y la capa de ESA key.
  const conRol: Partial<Record<IdSeccionMas, string>> = {
    'second-brain': 'app/second-brain/page.tsx',
    experimentos: 'app/experimentos/page.tsx', offer: 'app/offer/page.tsx', copywriting: 'app/copywriter/page.tsx',
  };
  for (const [id, archivo] of Object.entries(conRol) as [IdSeccionMas, string][]) {
    const s = seccion(id);
    // El Second Brain de escritorio es el CHAT con MaKo desde el 16/10/2026 (entra más gente): lo que es del admin de la
    // tab es el MAPA, que es lo que muestra la sección del teléfono, y se corta con la puerta de sus rutas.
    const guarda = id === 'second-brain' ? `esAdminDeTab('${s.navKey}')` : `requireRolWs([], { nav: '${s.navKey}' })`;
    assert.ok(leer(archivo).includes(guarda), `${archivo} ya no se gatea con «${s.navKey}»`);
    assert.equal(filaDeSidebar(s.navKey)?.item.rolesWs, undefined, `${s.navKey}: la sidebar se la da a otro rol y la página no`);
  }
  // Calendario (6/11/2026): el closer y el setter entran a sus «Llamadas». La página, la sidebar y el teléfono, lo mismo.
  assert.ok(leer('app/calendario/page.tsx').includes("requireRolWs(['closer', 'setter'], { nav: 'calendario' })"), 'app/calendario/page.tsx cambió de puerta');
  assert.deepEqual(filaDeSidebar('calendario')?.item.rolesWs, ['closer', 'setter'], 'calendario: la sidebar y la página tienen que dejar entrar a los mismos');
  // Curso y Comunidad piden en escritorio la capa de Customer Success (`requireCapa`), y la sidebar, sólo el admin.
  for (const id of ['curso', 'comunidad'] as const) {
    const s = seccion(id);
    assert.ok(leer(`app/customer-success/${id}/pantalla.tsx`).includes("requireCapa('customer-success')"), `${id}: cambió el guard de escritorio`);
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
    calendario: ['vista', 'fecha', 'persona'],
    'second-brain': ['area', 'vista', 'grupo'],
    experimentos: ['tab', 'desde', 'hasta', 'cierres', 'presupuesto', 'hipotesis'],
    offer: ['oferta', 'funnel', 'sesion'],
    copywriting: ['nuevo'],
    // La API de MaKo (17/10/2026): docs · tokens · registro, en los dos lados.
    'api-mako': ['tab'],
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
    // Su chat es el lugar del medio de la barra desde el 20/10/2026: una raíz, sin «volver», con la barra abajo.
    if (id === 'second-brain') {
      assert.deepEqual(cabeceraPorRuta(s.href), { titulo: 'Ops Center', padre: null, trabajo: true, conBarra: true }, s.href);
      assert.equal(tituloDe(s.href), 'MaKo - Ops Center', s.href);
      continue;
    }
    // Offer es, en escritorio, un chat con MaKo por funnel; en el v3, la pantalla del chat (sin título
    // grande, el composer en la franja del pulgar): como el chat de MaKo, sin la barra de abajo.
    assert.deepEqual(cabeceraPorRuta(s.href), t(tituloSeccion(s), id === 'offer'), s.href);
    assert.equal(nivel(s.href), 1, s.href);
    assert.equal(tituloDe(s.href), `MaKo - ${tituloSeccion(s)}`, s.href);
  }
  // Copywriting: desde el 29/10/2026 la fila abre el Copywriter, y la pantalla se llama como la fila; una página vuelve a él.
  assert.equal(seccion('copywriting').label, 'Copywriting');
  assert.equal(cabeceraPorRuta('/m/copywriter').titulo, 'Copywriting');
  assert.deepEqual(cabeceraPorRuta('/m/copywriter/gabc12345').padre, { href: '/m/copywriter', label: 'Copywriting' });
  // Los nombres en inglés desde el 17/10/2026 (Course, Community, Calendar), como en la sidebar.
  assert.deepEqual(cabeceraPorRuta('/m/curso/7').padre, { href: '/m/curso', label: 'Classroom' });
  // Curso y Comunidad no son Clientes: el prefijo va con barra.
  assert.equal(cabeceraPorRuta('/m/curso').titulo, 'Classroom');
  assert.equal(cabeceraPorRuta('/m/comunidad').titulo, 'Community');
  // La sección que sube a la barra (Calendar, en la capa pm) es una raíz: sin volver.
  assert.deepEqual(cabeceraPorRuta('/m/calendario', barraMovil('admin', 'pm')), { titulo: 'Calendar', padre: null, trabajo: false, conBarra: true });
});

test('cada sección de More TIENE su página, con el guard de SU key', () => {
  // ⚠️ Falla hasta que lleguen las páginas (ver la cabecera de este archivo): una fila de More sin página
  // es un 404 en More, en la barra del rol que la sube y en la URL de escritorio de esa tab en un teléfono.
  const faltan: string[] = [];
  for (const s of SECCIONES_MAS) {
    const archivo = `app/m/${s.href.slice('/m/'.length)}/page.tsx`;
    if (!existsSync(join(RAIZ, archivo))) { faltan.push(`${archivo} (no existe)`); continue; }
    // El Second Brain es el CHAT con MaKo desde el 16/10/2026 (entra con la key 'mako', como la fila de abajo): lo que es
    // del admin de la tab es su Mapa, que vive en su propia página con la key 'second-brain'.
    // Las del SUPER ADMIN (17/10/2026) se cuidan como su página de escritorio, con `getSesionAdmin()`: su key no está en
    // TODOS_LOS_ITEMS, y `requireMovil({ navKey })` les cerraría la puerta a todos.
    if (s.superAdmin) {
      if (!leer(archivo).includes('await getSesionAdmin()')) faltan.push(`${archivo} (sin getSesionAdmin(), la puerta de escritorio)`);
      continue;
    }
    const [pagina, key] = s.id === 'second-brain' ? [archivo, 'mako'] : [archivo, s.navKey];
    // Con opciones de la misma puerta, también (`onboarding: false` en «Reportar problema», como su `gateOnboarding: false`).
    if (!new RegExp(String.raw`requireMovil\(\{ navKey: '${key}'(, [^}]*)? \}\)`).test(leer(pagina))) faltan.push(`${pagina} (sin requireMovil({ navKey: '${key}' }))`);
    if (s.id === 'second-brain' && !leer('app/m/second-brain/mapa/page.tsx').includes(`requireMovil({ navKey: '${s.navKey}' })`)) {
      faltan.push(`app/m/second-brain/mapa/page.tsx (sin requireMovil({ navKey: '${s.navKey}' }))`);
    }
  }
  assert.deepEqual(faltan, []);
});
