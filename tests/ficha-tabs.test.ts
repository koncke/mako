// =============================================================================
// La ficha personalizable POR TAB: plantillas de cada tab, nombres, vista épica y la API de MaKo
// =============================================================================
// Martín, 16/10/2026: «Sobre todo que sea PERSONALIZABLE, como tenemos en dashboard o general cada tab... que hayan
// templates para "resumen", "tracking" y todas las tabs... Que se pueda cambiar el nombre de las tabs internas...
// que se pueda ver "epico"». El motor es lib/ficha/plantillas-tab.ts y lib/ficha/config.ts; la API, lib/ficha/api.ts
// y lib/api-mako/areas/crm.*. Se prueba EJECUTANDO la ficha que se dibuja, los cambios y la traducción de la API.
//
// Correr: node --import tsx --test tests/ficha-tabs.test.ts
//
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 11/0), cada rotura restaurada de memoria antes de la siguiente:
//   · la de entrada de una tab elegida por la ÉPICA y no por la del tipo (un funnel sin tocar cambia)      → 7 / 4
//   · `derivadas` sin juntar los tipos con la misma lista (Tracking con dos «Llamada» iguales)          → 9 / 2
//   · elegir la plantilla de una tab sin borrar la lista tocada de ESA tab                               → 10 / 1
//   · `normalizar` borrando la plantilla de tab elegida cuando es la de entrada (la sugerida no queda)   → 9 / 2
//   · el nombre de una tab sin tope (25 caracteres pasan)                                                → 10 / 1
//   · dos tabs con el mismo nombre                                                                        → 10 / 1
//   · «volver» de una tab borrando también su plantilla elegida                                           → 10 / 1
//   · la plantilla de toda la ficha borrando los nombres de las tabs                                      → 10 / 1
//   · `armar` sin dejar la tab configurada (MaKo arma lo mismo que la plantilla)                          → 10 / 1
//   · la API sin `nombre` en la traducción                                                                → 10 / 1
//   · armar_tab_ficha declarada antes de las heredadas del CRM                                            → 10 / 1
// ⚠️ Lo que NO fija: el tope de `sugeridasDeTab` (MAX_SUGERIDAS). Hoy cada tab tiene UNA sugerida por tipo, así que
//    sacarle el tope no cambia nada que se pueda medir; cuando Pagos sume varias para un tipo, sumar el caso aquí.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  aplicarCambio, fichaEfectiva, listaDeEntrada, normalizar, sanearCambio, sanearFicha, sanearNombreTab, describirCambio,
  RESPALDO_VACIO, TOPE_NOMBRE_TAB, type FichaGuardada,
} from '../lib/ficha/config';
import { IDS_PLANTILLA, PLANTILLAS_FICHA, listaDePlantilla, plantillaFicha } from '../lib/ficha/plantillas';
import {
  bloquesDePlantillaTab, galeriaDeTab, plantillaTabDeEntrada, plantillaTabPorId, plantillasDeTab, sugeridasDeTab,
} from '../lib/ficha/plantillas-tab';
import { PLANTILLAS_TAB_PAGOS } from '../lib/ficha/plantillas-pagos';
import { MAX_SUGERIDAS } from '../lib/plantillas-sugeridas';
import { bloqueDef, vaEnTab, NOMBRE_TAB, TABS_FICHA } from '../lib/ficha/catalogo';
import { cambioDeInputApi, salidaFichaApi, CAMBIOS_API } from '../lib/ficha/api';
import { aToolDef, porId } from '../lib/api-mako/registro';
import { DEFS as DEFS_CRM } from '../lib/api-mako/areas/crm.def';
import { RUTAS_REST } from '../lib/api-mako/rest';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ids = (l: ReadonlyArray<{ id: string }>) => l.map((b) => b.id);
const ok = (r: ReturnType<typeof aplicarCambio>) => { assert.ok(r.ok, r.ok ? '' : r.error); return r as Extract<typeof r, { ok: true }>; };
const R = RESPALDO_VACIO;

test('cada galería: «En blanco» primera, ids únicos, bloques de su tab, y una épica en las tabs que arma el marco', () => {
  const vistos = new Set<string>();
  for (const tab of TABS_FICHA) {
    const g = plantillasDeTab(tab);
    assert.equal(g[0].id, `${tab}-en-blanco`, `${tab}: «En blanco» va primera siempre`);
    assert.deepEqual(g[0].bloques, []);
    for (const p of g) {
      assert.equal(p.tab, tab);
      assert.ok(!vistos.has(p.id), `«${p.id}» está dos veces`);
      vistos.add(p.id);
      assert.ok(p.nombre.length <= 22 && p.bajada.length > 0, `«${p.id}»: el nombre se dibuja en la tarjeta (corto) y la bajada va en el title`);
      for (const b of p.bloques) assert.ok(bloqueDef(b.id) && vaEnTab(bloqueDef(b.id)!, tab), `«${p.id}»: ${b.id} no va en ${tab}`);
      assert.deepEqual(bloquesDePlantillaTab(p), p.bloques, `«${p.id}» trae un bloque que no va`);
    }
    // Pagos trae las suyas (lib/ficha/plantillas-pagos.ts, del chat Pagos): la épica de Pagos es de ellos.
    if (tab !== 'pagos' || PLANTILLAS_TAB_PAGOS.length) assert.ok(g.some((p) => p.epico), `${tab} sin una plantilla épica`);
  }
});

test('LA DE ENTRADA ES LA QUE YA SE VEÍA: un funnel que nadie tocó se dibuja igual que antes, tab por tab', () => {
  for (const p of PLANTILLAS_FICHA) {
    const f = fichaEfectiva(p.id, {}, R);
    for (const tab of TABS_FICHA) {
      if (tab === 'pagos' && PLANTILLAS_TAB_PAGOS.length) continue; // las de Pagos cambian Pagos a propósito
      assert.deepEqual(f.tabs[tab], listaDeEntrada(p, tab, R), `${p.id} · ${tab}: cambió lo que ve un funnel sin tocar`);
      assert.deepEqual(ids(plantillaTabDeEntrada(tab, p.id).bloques), [...listaDePlantilla(p, tab)]);
    }
    assert.deepEqual(f.configuradas, [], 'nadie configuró nada: la galería se abre en todas');
    assert.deepEqual(f.nombres, { resumen: 'Resumen', reuniones: 'Reuniones', pagos: 'Pagos', tracking: 'Tracking' });
    assert.deepEqual(Object.values(f.epica), [false, false, false, false]);
  }
  // Dos tipos con la misma lista son UNA plantilla, sugerida para los dos (Tracking de las dos de llamada).
  const llamada = plantillasDeTab('tracking').filter((x) => x.sugeridaPara?.includes('dos-reuniones') || x.sugeridaPara?.includes('una-llamada'));
  assert.equal(llamada.length, 1);
  assert.equal(llamada[0].nombre, 'Llamada');
});

test('«Sugerido»: la de entrada primero, nunca la épica, y como mucho las de la regla de la casa', () => {
  for (const tab of TABS_FICHA) {
    for (const tipo of IDS_PLANTILLA) {
      const s = sugeridasDeTab(tab, { plantilla: tipo });
      assert.ok(s.length >= 1 && s.length <= MAX_SUGERIDAS);
      assert.equal(s[0], plantillaTabDeEntrada(tab, tipo).id);
      assert.ok(!s.some((id) => plantillaTabPorId(id)?.epico && !plantillaTabPorId(id)?.sugeridaPara?.includes(tipo)), 'la épica se elige, no se sugiere');
      const g = galeriaDeTab(tab, { plantilla: tipo, porque: 'Tiene 2 etapas de reunión.' });
      assert.equal(g[0].plantilla.id, `${tab}-en-blanco`);
      assert.equal(g[0].porque, null, '«En blanco» no se sugiere');
      assert.deepEqual(g.slice(1, 1 + s.length).map((x) => x.plantilla.id), s, 'las sugeridas van después de «En blanco»');
      assert.ok(g.slice(1, 1 + s.length).every((x) => x.porque === 'Tiene 2 etapas de reunión.'));
      assert.ok(g.slice(1 + s.length).every((x) => x.porque === null));
      assert.equal(g.length, plantillasDeTab(tab).length, 'la galería no pierde ni repite plantillas');
    }
  }
});

test('elegir una plantilla para una tab reemplaza SÓLO esa tab, no toca los avisos, y queda elegida aunque sea la sugerida', () => {
  const tocada = ok(aplicarCambio({}, { op: 'quitar', tab: 'resumen', bloque: 'notas' }, 'dos-reuniones', R)).ficha;
  const conTracking = ok(aplicarCambio(tocada, { op: 'quitar', tab: 'tracking', bloque: 'visitas' }, 'dos-reuniones', R)).ficha;
  const epica = ok(aplicarCambio(conTracking, { op: 'plantilla', tab: 'resumen', plantilla: 'resumen-epica' }, 'dos-reuniones', R));
  const f = fichaEfectiva('dos-reuniones', epica.ficha, R);
  assert.deepEqual(ids(f.tabs.resumen), ['siguiente-accion', 'contacto', 'proxima-reunion', 'tiempo-en-etapa', 'notas'], 'la tab tocada se reemplaza');
  assert.equal(f.tabs.resumen.find((b) => b.id === 'contacto')!.diseno, 'botonera', 'con el diseño que trae la plantilla');
  assert.ok(!ids(f.tabs.tracking).includes('visitas'), 'la otra tab tocada sigue como estaba');
  assert.equal(f.epica.resumen, true, 'la épica trae la vista épica');
  assert.deepEqual(f.apagados, fichaEfectiva('dos-reuniones', {}, R).apagados, 'una plantilla de tab no cambia los avisos');
  assert.ok(f.configuradas.includes('resumen') && f.plantillasTabAMano.includes('resumen'));

  // «Usar la sugerida» es elegir: se guarda aunque sea la de entrada (si no, la galería se abriría otra vez).
  const sugerida = ok(aplicarCambio({}, { op: 'plantilla', tab: 'pagos', plantilla: plantillaTabDeEntrada('pagos', 'carrito').id }, 'carrito', R));
  assert.ok(sugerida.cambio);
  assert.deepEqual(sugerida.ficha, { plantillasTab: { pagos: plantillaTabDeEntrada('pagos', 'carrito').id } });
  assert.deepEqual(fichaEfectiva('carrito', sugerida.ficha, R).configuradas, ['pagos']);
  assert.equal(ok(aplicarCambio(sugerida.ficha, { op: 'plantilla', tab: 'pagos', plantilla: plantillaTabDeEntrada('pagos', 'carrito').id }, 'carrito', R)).cambio, false, 'elegirla otra vez no escribe nada');
  // «En blanco»: el contacto del Resumen no se va (no se puede quitar).
  assert.deepEqual(ids(fichaEfectiva('landing', ok(aplicarCambio({}, { op: 'plantilla', tab: 'resumen', plantilla: 'resumen-en-blanco' }, 'landing', R)).ficha, R).tabs.resumen), ['contacto']);
  // El respaldo del negocio vale también con una plantilla de tab elegida (Instagram apagado).
  const sinIg = fichaEfectiva('dos-reuniones', { plantillasTab: { resumen: 'resumen-respaldo' } }, { resumen: { instagram: false }, apagados: [] });
  assert.deepEqual(sinIg.tabs.resumen.find((b) => b.id === 'redes-y-web')?.opciones?.redes, ['web']);
  // Una plantilla de otra tab no entra.
  assert.ok('error' in sanearCambio({ op: 'plantilla', tab: 'pagos', plantilla: 'resumen-epica' }));
  assert.match(describirCambio({ op: 'plantilla', tab: 'resumen', plantilla: 'resumen-epica' }), /Épica.*Resumen/);
});

test('el nombre de una tab: corto, saneado, sin repetir otro, y «el de siempre» no se guarda', () => {
  assert.equal(sanearNombreTab('  Cobranza   y   cuotas '), 'Cobranza y cuotas');
  assert.equal(sanearNombreTab('x'.repeat(40))!.length, TOPE_NOMBRE_TAB);
  assert.equal(TOPE_NOMBRE_TAB, 24);
  assert.equal(sanearNombreTab('   '), null);
  assert.equal(sanearNombreTab('a\u0000b'), 'a b');
  const r = ok(aplicarCambio({}, { op: 'nombre', tab: 'pagos', nombre: 'Cobranza' }, 'una-llamada', R));
  assert.deepEqual(r.ficha, { nombres: { pagos: 'Cobranza' } });
  const f = fichaEfectiva('una-llamada', r.ficha, R);
  assert.equal(f.nombres.pagos, 'Cobranza');
  assert.ok(f.configuradas.includes('pagos'), 'ponerle nombre es configurarla');
  assert.equal(aplicarCambio(r.ficha, { op: 'nombre', tab: 'tracking', nombre: 'cobranza' }, 'una-llamada', R).ok, false, 'dos tabs con el mismo nombre');
  assert.equal(aplicarCambio({}, { op: 'nombre', tab: 'tracking', nombre: 'Resumen' }, 'una-llamada', R).ok, false);
  assert.deepEqual(ok(aplicarCambio(r.ficha, { op: 'nombre', tab: 'pagos', nombre: null }, 'una-llamada', R)).ficha, {}, 'sin nombre, el de siempre');
  assert.deepEqual(normalizar({ nombres: { pagos: 'Pagos' } }, 'una-llamada', R), {}, 'el nombre de siempre no se guarda');
  const s = sanearCambio({ op: 'nombre', tab: 'pagos', nombre: '  Cobro  ' });
  assert.deepEqual(s, { op: 'nombre', tab: 'pagos', nombre: 'Cobro' });
});

test('la épica: se guarda sólo si difiere de la de su plantilla', () => {
  const r = ok(aplicarCambio({}, { op: 'epica', tab: 'tracking', epica: true }, 'landing', R));
  assert.deepEqual(r.ficha, { epica: { tracking: true } });
  assert.equal(fichaEfectiva('landing', r.ficha, R).epica.tracking, true);
  // Con la épica elegida, apagarla SÍ se guarda (difiere de la plantilla) y prenderla no.
  const conEpica: FichaGuardada = { plantillasTab: { tracking: 'tracking-epica' } };
  assert.deepEqual(normalizar({ ...conEpica, epica: { tracking: true } }, 'landing', R), conEpica);
  assert.deepEqual(ok(aplicarCambio(conEpica, { op: 'epica', tab: 'tracking', epica: false }, 'landing', R)).ficha, { ...conEpica, epica: { tracking: false } });
});

test('volver y la plantilla de toda la ficha: qué se va y qué queda', () => {
  const g: FichaGuardada = {
    plantillasTab: { resumen: 'resumen-epica' }, nombres: { resumen: 'Hoy', pagos: 'Cobranza' }, epica: { resumen: false },
    tabs: { resumen: [{ id: 'contacto', ancho: 12, diseno: 'grilla' }] }, estilo: { densidad: 'amplia' },
  };
  const tab = ok(aplicarCambio(g, { op: 'volver', tab: 'resumen' }, 'carrito', R)).ficha;
  assert.deepEqual(tab, { plantillasTab: { resumen: 'resumen-epica' }, nombres: { pagos: 'Cobranza' }, estilo: { densidad: 'amplia' } },
    'volver una tab: su lista, su nombre y su épica se van; la plantilla elegida para la tab queda');
  const todo = ok(aplicarCambio(g, { op: 'volver' }, 'carrito', R)).ficha;
  assert.deepEqual(todo, { estilo: { densidad: 'amplia' } }, 'volver toda la ficha: sólo queda el estilo');
  const otra = ok(aplicarCambio(g, { op: 'plantilla', plantilla: 'landing' }, 'carrito', R)).ficha;
  assert.deepEqual(otra, { plantilla: 'landing', nombres: { resumen: 'Hoy', pagos: 'Cobranza' }, estilo: { densidad: 'amplia' } },
    'otra plantilla para toda la ficha arranca de cero las tabs; los nombres y el estilo quedan');
});

test('lo que armó MaKo: la lista y la épica en UN cambio, y la tab queda configurada aunque sea igual a la plantilla', () => {
  const misma = listaDeEntrada(plantillaFicha('carrito'), 'tracking', R);
  const r = ok(aplicarCambio({}, { op: 'armar', tab: 'tracking', bloques: misma, epica: false }, 'carrito', R));
  assert.ok(r.cambio);
  assert.ok(fichaEfectiva('carrito', r.ficha, R).configuradas.includes('tracking'), 'armada por MaKo, la galería no vuelve a abrirse');
  const epica = ok(aplicarCambio({}, { op: 'armar', tab: 'resumen', bloques: [{ id: 'notas', ancho: 12, diseno: 'ultima' }], epica: true }, 'carrito', R));
  const f = fichaEfectiva('carrito', epica.ficha, R);
  assert.deepEqual(ids(f.tabs.resumen), ['contacto', 'notas']);
  assert.equal(f.epica.resumen, true);
  assert.deepEqual(sanearCambio({ op: 'armar', tab: 'tracking', bloques: [{ id: 'cuotas' }, { id: 'visitas' }], epica: 'si' }),
    { op: 'armar', tab: 'tracking', bloques: [{ id: 'visitas', ancho: 4, diseno: 'numeros' }], epica: false }, 'lo que llega de afuera se sanea');
});

test('el saneo de lo nuevo: una plantilla de tab que no existe o es de otra tab, un nombre vacío, una épica que no es sí/no', () => {
  const g = sanearFicha({
    plantillasTab: { resumen: 'resumen-epica', pagos: 'resumen-epica', tracking: 'no-existe', inventada: 'x' },
    nombres: { resumen: '  Hoy ', pagos: '   ', tracking: 7 }, epica: { reuniones: true, pagos: 'si' },
  });
  assert.deepEqual(g, { plantillasTab: { resumen: 'resumen-epica' }, nombres: { resumen: 'Hoy' }, epica: { reuniones: true } });
});

test('la API de MaKo: renombrar, elegir la plantilla de una tab, la épica, y ver la galería de cada tab', () => {
  assert.ok((CAMBIOS_API as readonly string[]).includes('nombre') && (CAMBIOS_API as readonly string[]).includes('epica'));
  assert.deepEqual(cambioDeInputApi({ cambio: 'nombre', tab: 'pagos', nombre: 'Cobranza' }), { op: 'nombre', tab: 'pagos', nombre: 'Cobranza' });
  assert.deepEqual(cambioDeInputApi({ cambio: 'nombre', tab: 'pagos', nombre: '' }), { op: 'nombre', tab: 'pagos', nombre: null });
  assert.deepEqual(cambioDeInputApi({ cambio: 'epica', tab: 'resumen', epica: true }), { op: 'epica', tab: 'resumen', epica: true });
  assert.ok('error' in cambioDeInputApi({ cambio: 'epica', tab: 'resumen' }), 'una épica sin sí ni no');
  assert.deepEqual(cambioDeInputApi({ cambio: 'plantilla', tab: 'resumen', plantilla: 'resumen-epica' }), { op: 'plantilla', tab: 'resumen', plantilla: 'resumen-epica' });
  assert.deepEqual(cambioDeInputApi({ cambio: 'plantilla', tab: 'resumen', plantilla: 'auto' }), { op: 'plantilla', tab: 'resumen', plantilla: null });

  const efectiva = fichaEfectiva('dos-reuniones', { nombres: { pagos: 'Cobranza' }, plantillasTab: { resumen: 'resumen-epica' } }, R);
  const v = salidaFichaApi({ funnel: { id: 3, nombre: 'Llamadas', esDefault: true }, eleccion: { id: 'dos-reuniones', porque: 'Tiene 2 etapas de reunión.' }, efectiva });
  const t = v.tabs as Record<string, { nombre: string; nombre_de_siempre?: string; epica: boolean; plantilla: { id: string; elegida_por: string }; configurada: boolean; plantillas: Array<{ id: string; sugerida?: string }> }>;
  assert.equal(t.pagos.nombre, 'Cobranza');
  assert.equal(t.pagos.nombre_de_siempre, 'Pagos');
  assert.deepEqual(t.resumen.plantilla, { id: 'resumen-epica', nombre: 'Épica', elegida_por: 'una persona' });
  assert.equal(t.resumen.epica, true);
  assert.equal(t.tracking.configurada, false);
  assert.equal(t.resumen.plantillas[0].id, 'resumen-en-blanco');
  assert.deepEqual(t.resumen.plantillas[1], { ...t.resumen.plantillas[1], id: 'resumen-dos-reuniones', sugerida: 'Tiene 2 etapas de reunión.' }, 'la sugerida, con su porqué, después de «En blanco»');
});

test('armar_tab_ficha: del admin, se confirma por chat, va al final del CRM (el presupuesto de WhatsApp) y tiene su URL', () => {
  const d = porId('armar_tab_ficha')!;
  assert.ok(d && d.tipo === 'accion' && d.confirmacion === 'chat');
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.equal(d.costo, 'ia');
  assert.equal(d.lenta, true);
  assert.equal(DEFS_CRM[DEFS_CRM.length - 1].id, 'armar_tab_ficha', 'declarada antes, le quita lugar a las heredadas en un turno que no la nombra');
  assert.ok(JSON.stringify(aToolDef(d)).length <= 900, 'pesa en el turno de WhatsApp');
  assert.ok(RUTAS_REST.some(([m, r, op]) => m === 'POST' && r === '/crm/ficha/tabs' && op === 'armar_tab_ficha'));
  // El runner arma ANTES de proponer, ensaya el cambio sobre la ficha de hoy y guarda con el motor de siempre.
  const run = leer('lib/api-mako/areas/crm.run.ts');
  const cuerpo = run.slice(run.indexOf('armar_tab_ficha: {'), run.indexOf('// ── Acciones heredadas', run.indexOf('armar_tab_ficha: {')));
  assert.match(cuerpo, /await generarTabIA\(pedido, tab,/);
  assert.match(cuerpo, /const r = aplicarCambio\(f\.guardada, c, f\.eleccion\.id, f\.respaldo\);/);
  assert.match(cuerpo, /await cambiarFichaDeFunnel\(Number\(payload\.embudoId\), c\)/);
});
