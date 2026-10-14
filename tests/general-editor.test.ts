// =============================================================================
// La tab General es el editor del Dashboard con su propio informe (14/10/2026)
// =============================================================================
// Martín: «Que todo sea personalizable, intenta replicar lo que tenemos en dashboard, solo que claro, aquí no hace falta
// tantos gráficos y tiene otro objetivo la tab... también crea templates... Me imagino una que diga "Bienvenido
// NOMBRE..." Los bloques también deberían ser editables.»
//
// Lo que fija:
//   · Cada pieza de cada plantilla de General sobrevive al saneo con lo que se escribió: un bloque con una pieza que no
//     existe, o un gráfico con una métrica mal escrita, NO da error — el saneo lo tira o lo cambia en silencio y la
//     hoja nace con un hueco o con otro número bajo el título de éste.
//   · Los bloques de General viven en una HOJA: en un pop-up no hay General que dibujar, y el saneo los tira.
//   · El informe con que arranca quien nunca armó el suyo es la General de siempre, con la cabecera arriba.
//   · Las variables de un Texto ({{nombre}}…) se resuelven al dibujar; la que no tiene valor queda CRUDA.
//   · De quién es el informe que pide la API (`elegirPersona`): nunca se elige a ciegas entre dos personas.
//   · «Tu funnel hoy» y «A quién cobrarle» se atan a UN funnel (el pedido del 13/10), y nada más se ata.
//   · Ningún nombre de un cliente real en las plantillas (un ejemplo de pantalla es ficticio por regla).
// Correr: npx tsx --test tests/general-editor.test.ts
//
// PROBADO ROMPIÉNDOLO (14/10/2026; base en verde: 7 pasan, 0 fallan). Una rotura por vez, restaurando de memoria;
// pasan / fallan:
//   · la plantilla Bienvenida con el bloque `prioridade` (una pieza que no existe)          -> 0 / 1: el archivo no
//     carga (`piezaGeneral` devuelve undefined y `bloque()` revienta al importar; el tipo ya lo frena en tsc)
//   · `agenda` en vez de `agendas` en el gráfico «Agendas» de la plantilla Ventas            -> 6 / 1 «cada pieza…»
//   · el saneo sin `ctx.enPopup` (un bloque de General aceptado en un pop-up)                -> 6 / 1 «en un pop-up…»
//   · `informeGeneralInicial` armado con la segunda plantilla en vez de la primera            -> 6 / 1 «el informe…»
//   · `conVariables` borrando la variable sin valor (`: ''` en vez de `: todo`)              -> 6 / 1 «las variables…»
//   · `elegirPersona` quedándose con la primera de dos homónimas (sin el `hay.length > 1`)   -> 6 / 1 «de quién…»
//   · «Clientes de Mauricio» como título de un gráfico de la plantilla Ventas                -> 6 / 1 «ningún nombre…»
// Y el test del funnel por bloque (base 8 / 0), cada rotura -> 7 / 1 «un bloque se ata a un funnel…»: el saneo sin
// `piezaPorFunnel` (los KPIs con funnel), la variante de la cobranza con otra clave, el elemento buscando `piezas[pieza]`,
// `clavePieza` con guion, y la cobranza de un funnel sin poder leer de quién es cada cliente con `error={ null }`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanearElemento, sanearGrafico, type Componente } from '../lib/graficos-catalogo';
import {
  DEFINICIONES_GENERAL, PLANTILLAS_GENERAL, elegirPersona, esPlantillaGeneral, informeGeneralInicial, type PersonaGeneral,
} from '../lib/general-plantillas';
import { PIEZAS_GENERAL, clavePieza, conVariables, esPiezaGeneral, piezaPorFunnel, saludoDeHora } from '../lib/general-piezas';

test('cada pieza de cada plantilla de General sobrevive al saneo con lo que se escribió', () => {
  let bloques = 0, graficos = 0;
  for (const d of DEFINICIONES_GENERAL) {
    const hoja = PLANTILLAS_GENERAL.find((p) => p.id === d.id)!.armar((l) => l) as { componentes: Componente[] };
    assert.equal(hoja.componentes.length, d.piezas.length, `${d.id}: el saneo se comió una pieza`);
    for (const p of d.piezas) {
      const c = hoja.componentes.find((x) => x.id === p.local);
      assert.ok(c, `${d.id}/${p.local}: no está en la hoja (¿un id que no pasa el saneo?)`);
      const el = p.elemento as { tipo: string; general?: { pieza: string } } | undefined;
      if (el) {
        assert.ok(c!.clase === 'elemento' && c!.tipo === el.tipo, `${d.id}/${p.local}: cambió el elemento`);
        if (el.tipo === 'general') {
          assert.ok(esPiezaGeneral(el.general?.pieza), `${d.id}/${p.local}: la pieza «${el.general?.pieza}» no existe`);
          assert.equal(c!.clase === 'elemento' ? c!.general?.pieza : null, el.general!.pieza, `${d.id}/${p.local}: cambió el bloque`);
          bloques++;
        }
        continue;
      }
      if (typeof p.seccion === 'string') continue;
      const { local, controles: _c, ...resto } = p;
      const s = sanearGrafico({ ...resto, id: local });
      assert.ok(s && s.clase === 'grafico', `${d.id}/${local}: no es un gráfico después del saneo (¿conjunto que no existe?)`);
      assert.equal(s!.fuente, resto.fuente, `${d.id}/${local}: cambió el conjunto`);
      assert.equal(s!.tipo, resto.tipo, `${d.id}/${local}: cambió el tipo`);
      assert.deepEqual(s!.metricas, resto.metricas, `${d.id}/${local}: el saneo le cambió las métricas (una no es del conjunto)`);
      if (resto.dimension !== undefined) assert.equal(s!.dimension, resto.dimension, `${d.id}/${local}: cambió la dimensión`);
      if (resto.fecha !== undefined) assert.equal(s!.fecha, resto.fecha, `${d.id}/${local}: cambió la fecha`);
      graficos++;
    }
  }
  assert.ok(bloques >= 25 && graficos >= 8, `revisé ${bloques} bloques y ${graficos} gráficos: el recorrido no está mirando`);
  // Y cada plantilla es de la galería de General (la de su «Nueva hoja»), y ninguna se repite.
  assert.equal(new Set(PLANTILLAS_GENERAL.map((p) => p.id)).size, PLANTILLAS_GENERAL.length);
  for (const p of PLANTILLAS_GENERAL) assert.ok(esPlantillaGeneral(p.id));
  // Todos los bloques que existen los usa al menos una plantilla: uno que ninguna trae se descubre sólo buscándolo.
  const usados = new Set(DEFINICIONES_GENERAL.flatMap((d) => d.piezas.map((p) => (p.elemento as { general?: { pieza: string } } | undefined)?.general?.pieza).filter(Boolean)));
  for (const p of PIEZAS_GENERAL) assert.ok(usados.has(p.id), `el bloque «${p.id}» no está en ninguna plantilla`);
});

test('en un pop-up no hay General que dibujar: el saneo tira el bloque (y el que no dice cuál)', () => {
  const crudo = { id: 'b', tipo: 'general', general: { pieza: 'cobranza' } };
  assert.equal(sanearElemento(crudo)?.general?.pieza, 'cobranza');
  assert.equal(sanearElemento(crudo, { enPopup: true }), null);
  assert.equal(sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'inventada' } }), null);
  assert.equal(sanearElemento({ id: 'b', tipo: 'general' }), null);
});

// El pedido del 13/10 («e incluso asignarles ofertas y/o funnels») vive desde el 14/10 en el bloque: «Tu funnel hoy» y
// «A quién cobrarle» se atan a un funnel. El server arma una variante por funnel con la MISMA clave que busca el
// elemento; con dos claves distintas el bloque dice «Ese funnel ya no está» sobre un funnel vivo.
test('un bloque se ata a un funnel sólo si sabe, y la variante se busca con la misma clave con que se arma', () => {
  assert.deepEqual(sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'funnel', funnel: 12 } })?.general, { pieza: 'funnel', funnel: 12 });
  assert.deepEqual(sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'cobranza', funnel: '7' } })?.general, { pieza: 'cobranza', funnel: 7 });
  assert.deepEqual(sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'kpis', funnel: 12 } })?.general, { pieza: 'kpis' }, 'los KPIs miden el negocio entero');
  for (const malo of [-1, 0, 1.5, 'x', null]) assert.deepEqual(sanearElemento({ id: 'b', tipo: 'general', general: { pieza: 'funnel', funnel: malo } })?.general, { pieza: 'funnel' });
  assert.deepEqual(PIEZAS_GENERAL.filter((p) => piezaPorFunnel(p.id)).map((p) => p.id).sort(), ['cobranza', 'funnel']);
  assert.equal(clavePieza('cobranza', 3), 'cobranza:3');
  assert.equal(clavePieza('cobranza', null), 'cobranza');

  const leer = (r: string) => readFileSync(join(import.meta.dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  const armar = leer('app/general/piezas.tsx');
  for (const p of ['funnel', 'cobranza']) assert.match(armar, new RegExp(`porFunnel\\[clavePieza\\('${p}', f\\.id\\)\\] =`), `no se arma la variante de «${p}» por funnel`);
  assert.match(leer('app/dashboard/ElementoGeneral.tsx'), /piezas\?\.\[clavePieza\(pieza, funnel\)\]/, 'el elemento no busca su variante con clavePieza');
  // Un filtro que no se pudo armar no es «nadie debe»: la cobranza de un funnel sin saber de quién es cada cliente lo dice.
  assert.match(armar, /deQuien == null\s*\n\s*\/\/[^\n]*\n\s*\? <Cobranza filas=\{\[\]\} tz=\{cobranza\.datos\.tz\} error="No pude leer de qué funnel es cada cliente\."/);
});

test('el informe con que arranca es la General de siempre, con la cabecera arriba', () => {
  const t = informeGeneralInicial();
  assert.equal(t.hojas.length, 1);
  const h = t.hojas[0];
  assert.equal(h.plantilla, 'general');
  const arriba = [...h.componentes].sort((a, b) => a.y - b.y || a.x - b.x)[0];
  assert.ok(arriba.clase === 'elemento' && arriba.general?.pieza === 'cabecera', 'la cabecera (el objetivo y la acción del día) no va arriba');
  // Ids fijos: dos lecturas dan lo mismo, así el primer cambio se guarda tal cual.
  assert.deepEqual(informeGeneralInicial(), t);
});

test('las variables de un Texto se resuelven al dibujar; la que no tiene valor queda cruda', () => {
  assert.equal(conVariables('{{saludo}}, {{nombre}}', { saludo: 'Buenos días', nombre: 'Ana' }), 'Buenos días, Ana');
  assert.equal(conVariables('Hola {{ nombre }} de {{negocio}}', { nombre: 'Ana' }), 'Hola Ana de {{negocio}}');
  assert.equal(conVariables('Hola {{nombre}}', null), 'Hola {{nombre}}', 'fuera de General no se toca');
  assert.equal(conVariables('{{nada}}', { nombre: 'Ana' }), '{{nada}}');
  assert.deepEqual([0, 11, 12, 19, 20, 23].map(saludoDeHora), ['Buenos días', 'Buenos días', 'Buenas tardes', 'Buenas tardes', 'Buenas noches', 'Buenas noches']);
  // La Bienvenida saluda por el nombre.
  const bienvenida = DEFINICIONES_GENERAL.find((d) => d.id === 'bienvenida')!;
  assert.ok(bienvenida.piezas.some((p) => (p.elemento as { texto?: string } | undefined)?.texto?.includes('{{nombre}}')));
});

test('de quién es el informe que pide la API: nunca se elige a ciegas', () => {
  const ana: PersonaGeneral = { sub: '1', email: 'ana@x.com', nombre: 'Ana Pérez' };
  const otra: PersonaGeneral = { sub: '2', email: 'ana2@x.com', nombre: 'Ana Pérez' };
  const beto: PersonaGeneral = { sub: '3', email: 'beto@x.com', nombre: 'Beto' };
  assert.deepEqual(elegirPersona([ana], null), { ok: true, persona: ana }, 'una sola admin: es ella');
  assert.equal(elegirPersona([ana, beto], null).ok, false, 'dos admins y nadie nombrado: se pregunta');
  assert.deepEqual(elegirPersona([ana, beto], 'BETO'), { ok: true, persona: beto });
  assert.deepEqual(elegirPersona([ana, otra], 'ana2@x.com'), { ok: true, persona: otra });
  assert.equal(elegirPersona([ana, otra], 'ana perez').ok, false, 'dos homónimas: se pide el email');
  assert.equal(elegirPersona([ana], 'nadie').ok, false);
  assert.equal(elegirPersona([], null).ok, false);
});

test('ningún nombre de un cliente real en las plantillas de General', () => {
  const texto = JSON.stringify([DEFINICIONES_GENERAL, PLANTILLAS_GENERAL.map((p) => [p.nombre, p.linea])]).toLowerCase();
  for (const nombre of ['Mauricio', 'Bustos', 'Leila', 'Brigitte', 'Leandro', 'Ananda', 'Código Inmobiliario', 'Codigo Inmobiliario', 'Vértice', 'Vertice', 'Martín', 'Koncke']) {
    assert.ok(!texto.includes(nombre.toLowerCase()), `una plantilla de General nombra a «${nombre}»`);
  }
});

test('cada bloque declara su grupo del menú y un tamaño que entra en la grilla', () => {
  for (const p of PIEZAS_GENERAL) {
    assert.ok(p.w >= 3 && p.w <= 12 && p.h >= 3, `${p.id}: tamaño fuera de la grilla`);
    assert.ok(p.nombre.length <= 30, `${p.id}: el nombre del menú es una frase`);
  }
});
