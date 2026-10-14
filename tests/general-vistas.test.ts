// Tests de las VISTAS de /general (13/10/2026). Martín: «Que los usuarios puedan elegir que ver... Hazla
// personalizable», «Que hayan templates de tab general. Y que se puedan crear más de una, e incluso asignarles
// ofertas y/o funnels.» Lo que se prueba es lo PURO (lib/general-vistas-modelo.ts) y el cableado que lo hace verdad:
//
//   · la vista por defecto es la /general de siempre CON «A quién cobrarle» (lo que Martín le prometió a Mauricio);
//   · el saneo de lo guardado no deja una pantalla sin vistas, ni bloques que no existen, ni ids repetidos;
//   · lo que devuelve la IA se revalida contra el catálogo (se SACA lo que no existe, nunca se reemplaza);
//   · una oferta suma los funnels que la venden, y un alcance que no matchea nada NO es «todo el negocio»;
//   · la página dibuja TODOS los bloques del catálogo (un bloque sin su `case` existiría en Personalizar y no se
//     vería nunca);
//   · un bloque que no filtra por funnel lo DICE con «Todo el negocio».
//
// Probado rompiéndolo (13/10/2026), cada rotura contra la base en verde (19 de 19), restaurando de memoria:
//   · `sanearVistas` sin el piso de vistas (`return { vistas }`) → 1 fallo, 18 pases;
//   · `funnelsDelAlcance` mirando sólo `v.funnels` (ignora las ofertas) → 1 fallo, 18 pases;
//   · `deIAVista` reemplazando el bloque desconocido por 'kpis' → 2 fallos, 17 pases;
//   · app/general/page.tsx sin el `case 'funnel'` → 1 fallo, 18 pases;
//   · el «Todo el negocio» apagado (`false ? <TodoElNegocio />`) → 1 fallo, 18 pases.
// Y las dos de la API (14/10/2026, base 21 de 21):
//   · sin persona y con varios admins, elegir al primero → 1 fallo, 20 pases;
//   · un nombre repetido elige al primero (sin pedir el email) → 1 fallo, 20 pases;
//   · una plantilla inexistente cae en silencio a los bloques → 1 fallo, 20 pases (la primera versión del test NO lo
//     cazaba: pedía la plantilla sin bloques, y eso ya era un error por otro motivo).
//
// Correr: npx tsx --test tests/general-vistas.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BLOQUES_GENERAL, BLOQUES_POR_DEFECTO, PLANTILLAS_GENERAL, MAX_VISTAS, esBloqueGeneral,
  sanearVistas, sanearVista, vistaActiva, vistaPorDefecto, vistasIniciales, filtrarPlantillasGeneral,
  vistaDePlantilla, vistaEnBlanco, agregarVista, quitarVista, moverBloque, alternarBloque,
  funnelsDelAlcance, rotuloAlcance, deIAVista, catalogoParaIA, nuevoIdVista, elegirPersonaVista, vistaDesdePedido,
} from '../lib/general-vistas-modelo';

const leer = (rel: string) => readFileSync(resolve(__dirname, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('la vista por defecto es la /general de siempre con «A quién cobrarle» después de los KPIs', () => {
  const v = vistaPorDefecto();
  assert.deepEqual(v.bloques, ['objetivo', 'kpis', 'cobranza', 'semaforo', 'mes', 'pendientes']);
  assert.deepEqual([...BLOQUES_POR_DEFECTO], v.bloques);
  assert.deepEqual(v.funnels, []);
  assert.deepEqual(v.ofertas, []);
});

test('sin vistas vuelve la de por defecto: una /general sin pastillas no tiene por dónde volver', () => {
  assert.deepEqual(sanearVistas({ vistas: [] }), vistasIniciales());
  assert.deepEqual(sanearVistas(null), vistasIniciales());
  assert.deepEqual(sanearVistas({ vistas: [{ id: '' }, 'basura'] }), vistasIniciales());
});

test('el saneo saca bloques que no existen, ids repetidos y respeta el tope', () => {
  const raw = {
    vistas: [
      { id: 'a', nombre: '  Mi   operación  ', emoji: '⚡', bloques: ['cobranza', 'inventado', 'cobranza', 'prioridades'], funnels: [3, '4', 'x', -1, 3], ofertas: [] },
      { id: 'a', nombre: 'repetida', bloques: ['kpis'] },
      ...Array.from({ length: 20 }, (_, i) => ({ id: `v${i}`, nombre: `V${i}`, bloques: ['mes'] })),
    ],
  };
  const s = sanearVistas(raw);
  assert.equal(s.vistas.length, MAX_VISTAS);
  assert.equal(s.vistas[0].nombre, 'Mi operación');
  assert.deepEqual(s.vistas[0].bloques, ['cobranza', 'prioridades']);
  assert.deepEqual(s.vistas[0].funnels, [3, 4]);
  assert.equal(s.vistas.filter((v) => v.id === 'a').length, 1);
});

test('un id con caracteres raros no es una vista (viaja en la URL)', () => {
  assert.equal(sanearVista({ id: '../x', nombre: 'a', bloques: [] }), null);
  assert.equal(sanearVista({ id: 'a b', nombre: 'a', bloques: [] }), null);
  assert.ok(sanearVista({ id: 'v1a2b3', nombre: 'a', bloques: [] }));
});

test('la vista activa es la de ?vista=, o la primera', () => {
  const vs = { vistas: [vistaPorDefecto(), { ...vistaPorDefecto(), id: 'otra', nombre: 'Otra' }] };
  assert.equal(vistaActiva(vs, 'otra').id, 'otra');
  assert.equal(vistaActiva(vs, 'no-existe').id, 'general');
  assert.equal(vistaActiva(vs, null).id, 'general');
});

test('las plantillas sólo usan bloques del catálogo, y hay una para el caso de Mauricio', () => {
  for (const p of PLANTILLAS_GENERAL) {
    assert.ok(p.bloques.length > 0, p.id);
    for (const b of p.bloques) assert.ok(esBloqueGeneral(b), `${p.id}: ${b}`);
    assert.equal(new Set(p.bloques).size, p.bloques.length, `${p.id} repite un bloque`);
  }
  const op = PLANTILLAS_GENERAL.find((p) => p.id === 'operacion');
  assert.ok(op && op.bloques.includes('prioridades') && op.bloques.includes('cobranza'));
});

test('el buscador encuentra por el nombre de un bloque y sin acentos', () => {
  const r = filtrarPlantillasGeneral(PLANTILLAS_GENERAL, 'semaforo');
  assert.ok(r.some((p) => p.id === 'salud'));
  assert.equal(filtrarPlantillasGeneral(PLANTILLAS_GENERAL, '').length, PLANTILLAS_GENERAL.length);
  assert.equal(filtrarPlantillasGeneral(PLANTILLAS_GENERAL, 'zzzz').length, 0);
});

test('crear desde una plantilla o en blanco da un id que no choca', () => {
  let n = 0;
  const azar = () => [0.1, 0.1, 0.2][n++ % 3];
  const primero = nuevoIdVista([], () => 0.1);
  const v = vistaDePlantilla(PLANTILLAS_GENERAL[0], [primero], azar);
  assert.notEqual(v.id, primero);
  assert.deepEqual(vistaEnBlanco(['x']).bloques, []);
});

test('con el tope lleno no se agrega, y la última vista no se borra', () => {
  const llena = { vistas: Array.from({ length: MAX_VISTAS }, (_, i) => ({ ...vistaPorDefecto(), id: `v${i}` })) };
  assert.equal(agregarVista(llena, vistaEnBlanco(['z'])), null);
  const una = vistasIniciales();
  assert.equal(quitarVista(una, 'general').vistas.length, 1);
});

test('mover y alternar bloques', () => {
  assert.deepEqual(moverBloque(['objetivo', 'kpis', 'mes'], 'kpis', -1), ['kpis', 'objetivo', 'mes']);
  assert.deepEqual(moverBloque(['objetivo', 'kpis'], 'objetivo', -1), ['objetivo', 'kpis']);
  assert.deepEqual(alternarBloque(['objetivo'], 'mes'), ['objetivo', 'mes']);
  assert.deepEqual(alternarBloque(['objetivo', 'mes'], 'objetivo'), ['mes']);
});

test('el alcance: sin nada es todo el negocio; una oferta suma los funnels que la venden', () => {
  const ligas = [{ funnel_id: 7, oferta_id: 1 }, { funnel_id: 8, oferta_id: 2 }];
  assert.deepEqual(funnelsDelAlcance({ funnels: [], ofertas: [] }, ligas), { todo: true });
  assert.deepEqual(funnelsDelAlcance({ funnels: [3], ofertas: [1] }, ligas), { todo: false, funnels: [3, 7] });
  assert.deepEqual(funnelsDelAlcance({ funnels: [7], ofertas: [1] }, ligas), { todo: false, funnels: [7] });
});

test('una oferta que ningún funnel vende NO es «todo el negocio»', () => {
  assert.deepEqual(funnelsDelAlcance({ funnels: [], ofertas: [99] }, [{ funnel_id: 7, oferta_id: 1 }]), { todo: false, funnels: [] });
});

test('el rótulo del alcance', () => {
  const nombres = { funnels: new Map([[3, 'Mentoría']]), ofertas: new Map([[1, 'Programa']]) };
  assert.equal(rotuloAlcance({ funnels: [], ofertas: [] }, nombres), 'Todo el negocio');
  assert.equal(rotuloAlcance({ funnels: [3], ofertas: [] }, nombres), 'Mentoría');
  assert.equal(rotuloAlcance({ funnels: [], ofertas: [1] }, nombres), 'Programa');
  assert.equal(rotuloAlcance({ funnels: [3], ofertas: [1] }, nombres), '2 elegidos');
});

test('la IA: lo que no existe se SACA con un aviso, nunca se reemplaza', () => {
  const cat = { funnels: [{ id: 3, nombre: 'Mentoría' }], ofertas: [{ id: 1, nombre: 'Programa' }] };
  const r = deIAVista({ nombre: 'Cobros', emoji: '💵', bloques: ['cobranza', 'ventas_magicas', 'mes'], funnels: [3, 99], ofertas: [5] }, cat);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.vista.bloques, ['cobranza', 'mes']);
  assert.deepEqual(r.vista.funnels, [3]);
  assert.deepEqual(r.vista.ofertas, []);
  assert.equal(r.avisos.length, 3);
});

test('la IA sin un solo bloque válido es un error (se reintenta)', () => {
  const r = deIAVista({ nombre: 'x', bloques: ['nada'] }, { funnels: [], ofertas: [] });
  assert.ok(r.errores.length > 0);
});

test('el catálogo que ve la IA trae TODOS los bloques y los ids del negocio', () => {
  const txt = catalogoParaIA({ funnels: [{ id: 12, nombre: 'Mentoría' }], ofertas: [] });
  for (const b of BLOQUES_GENERAL) assert.ok(txt.includes(`- ${b.id}:`), b.id);
  assert.ok(txt.includes('- 12: Mentoría'));
});

test('la página dibuja cada bloque del catálogo: un bloque sin su case existiría en Personalizar y no se vería', () => {
  const src = sinComentarios(leer('../app/general/page.tsx'));
  const cuerpo = src.slice(src.indexOf('const bloques = vista.bloques.map'), src.indexOf('return (', src.indexOf('const bloques = vista.bloques.map')));
  assert.ok(cuerpo.length > 200, 'no encontré el reparto de bloques');
  for (const b of BLOQUES_GENERAL) assert.match(cuerpo, new RegExp(`case '${b.id}':`), `falta el case '${b.id}'`);
});

test('un bloque que no filtra por funnel dice «Todo el negocio» con un alcance puesto', () => {
  const src = sinComentarios(leer('../app/general/page.tsx'));
  assert.match(src, /!alcance\.todo && !defDeBloque\(b\)\.porFunnel \? <TodoElNegocio \/>/);
  assert.match(src, /Todo el negocio/);
});

test('la API elige de quién es la vista: nombrada, o la única persona admin', () => {
  const ana = { sub: '1', email: 'ana@x.com', nombre: 'Ana Pérez' };
  const beto = { sub: '2', email: 'beto@x.com', nombre: 'Beto' };
  const otraAna = { sub: '3', email: 'ana2@x.com', nombre: 'ana perez' };
  assert.deepEqual(elegirPersonaVista([ana], null), { ok: true, persona: ana });
  assert.equal(elegirPersonaVista([ana, beto], null).ok, false);
  assert.deepEqual(elegirPersonaVista([ana, beto], 'BETO@x.com'), { ok: true, persona: beto });
  assert.deepEqual(elegirPersonaVista([ana, beto], 'ana perez'), { ok: true, persona: ana });
  assert.equal(elegirPersonaVista([ana, otraAna], 'Ana Pérez').ok, false);
  assert.equal(elegirPersonaVista([ana], 'nadie@x.com').ok, false);
});

test('la API arma la vista con una plantilla o con bloques, y saca lo que no existe', () => {
  const cat = { funnels: [{ id: 3, nombre: 'Mentoría' }], ofertas: [] };
  const p = vistaDesdePedido({ plantilla: 'operacion', funnels: ['3', '99'] }, cat);
  assert.deepEqual(p.errores, []);
  assert.deepEqual(p.vista.bloques, ['prioridades', 'cobranza', 'funnel', 'pendientes']);
  assert.equal(p.vista.nombre, 'Operación diaria');
  assert.deepEqual(p.vista.funnels, [3]);
  const b = vistaDesdePedido({ bloques: ['mes', 'nada'], nombre: 'Mi mes' }, cat);
  assert.deepEqual(b.vista.bloques, ['mes']);
  assert.equal(b.vista.nombre, 'Mi mes');
  // Una plantilla que no existe es un error AUNQUE vengan bloques: no se cae en silencio a otra cosa.
  assert.ok(vistaDesdePedido({ plantilla: 'inventada', bloques: ['mes'] }, cat).errores.length > 0);
  assert.ok(vistaDesdePedido({ bloques: [] }, cat).errores.length > 0);
});

test('las vistas se guardan por persona, con versión, y la IA es gratis', () => {
  const store = sinComentarios(leer('../lib/general-vistas.ts'));
  assert.match(store, /general\.vistas\.\$\{sub\}/);
  assert.match(store, /q\.eq\('updated_at', actual\.updated_at\)/);
  const ia = sinComentarios(leer('../lib/general-vistas-ia.ts'));
  assert.doesNotMatch(ia, /chatClaude|anthropic/i);
  assert.match(ia, /deIAVista/);
});
