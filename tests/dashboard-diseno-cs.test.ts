// =============================================================================
// La hoja CS Analyst con su DISEÑO PROPIO (la copia de Mender): de dónde sale cada número (lib/cs-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco» y «Después seguí con la segunda hoja, de a
// una». La hoja la dibuja app/dashboard/disenos/HojaCs.tsx con lo que arma `vistaCs` de las piezas de la hoja. Estos tests
// EJECUTAN esas funciones con datos armados acá (ficticios) y miran lo que sale; sólo el último lee el fuente (el cableado).
//
// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes: ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Resultado } from '../lib/graficos-agregar';
import { anilloDe, carrilesDe, fraseCs, iconoDe, medidoresDe, pasaFiltro, textoContacto, vistaCs, type TarjetaCs } from '../lib/cs-diseno';
import { datosCsMuestra, ETAPAS_MUESTRA } from '../lib/cs-diseno-muestra';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_HOJA, PLANTILLAS_OFRECIDAS, instanciarPlantilla } from '../lib/graficos-plantillas';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
const cat = (ids: string[], filas: Array<[string, ...number[]]>, extra: Partial<Resultado> = {}): Resultado =>
  res(ids, [], { clase: 'categoria', filas: filas.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })), ...extra });
const texto = (t: Array<{ s: string }>) => t.map((x) => x.s).join('');
const nombres = (ts: TarjetaCs[]) => ts.map((t) => t.nombre);

test('la frase: cuántos piden atención, cuánto deben y cuántas sesiones', () => {
  assert.equal(texto(fraseCs(3, 19, 1240, 22)), '3 de tus 19 clientes piden atención. Deben US$1,240 vencidos. Tuvieron 22 sesiones en el período.');
  assert.equal(texto(fraseCs(1, 5, 0, 1)), '1 de tus 5 clientes pide atención. Tuvieron 1 sesión en el período.');
  assert.equal(texto(fraseCs(0, 8, null, null)), 'Ninguno de tus 8 clientes pide atención.');
  assert.equal(texto(fraseCs(0, 0, 0, 0)), 'Todavía no tienes clientes en tu cartera.');
  assert.deepEqual(fraseCs(2, null, 100, 3), [], 'sin la cartera no hay frase');
});

test('los carriles: una etapa por carril en el orden del SERVICIO, y cada cliente con su señal, su contacto y lo que debe', () => {
  // Los carriles: cada cliente con su etapa en el cruce (columnas de la que más tiene a la que menos, como el agregador).
  const carriles = res(['clientes'], [4], {
    clase: 'categoria',
    filas: ['Ana Ruiz', 'Beto Gil', 'Caro Paz', 'Dani Sol'].map((n, i) => ({ clave: n, etiqueta: n, valores: [1], ref: String(10 + i) })),
    cruce: { claves: ['Arranque', 'Bienvenida'], celdas: [[0, 1], [1, 0], [1, 0], [1, 1]] },
  });
  const etapas = cat(['clientes'], [['Arranque', 3], ['Bienvenida', 2]]);
  const tabla = res(['atencion', 'deuda_vencida_usd', 'sesiones'], [1, 300, 4], {
    clase: 'categoria',
    filas: [
      { clave: 'Ana Ruiz', etiqueta: 'Ana Ruiz', ref: '10', valores: [1, 0, 0], extra: { senal: 'Atención', tramo_contacto: 'Nunca', estado: 'Activo', producto: 'Mentoría' } },
      { clave: 'Beto Gil', etiqueta: 'Beto Gil', ref: '11', valores: [0, 300, 2], extra: { senal: 'Bien', tramo_contacto: '0-7 días', estado: 'Activo', producto: 'Mentoría' } },
      // Caro Paz no está en la tabla (la tabla trae los primeros 50): su tarjeta va sin señal, no se le inventa una.
      { clave: 'Dani Sol', etiqueta: 'Dani Sol', ref: '13', valores: [0, 0, 2], extra: { senal: 'Bien', tramo_contacto: '15-30 días', estado: 'Activo', producto: 'Grupal' } },
    ],
  });
  const v = carrilesDe(carriles, etapas, tabla, ['Bienvenida', 'Arranque', 'Cierre']);
  assert.deepEqual(v.carriles.map((c) => [c.etapa, c.n]), [['Bienvenida', 2], ['Arranque', 3]], 'en el orden del servicio y sin la etapa vacía');
  // Dani está en los dos servicios: va en los dos carriles (el cruce). Arriba, lo que pide atención y lo que hace tiempo que no habla.
  assert.deepEqual(nombres(v.carriles[0].tarjetas), ['Ana Ruiz', 'Dani Sol']);
  assert.deepEqual(nombres(v.carriles[1].tarjetas), ['Dani Sol', 'Beto Gil', 'Caro Paz']);
  const ana = v.carriles[0].tarjetas[0], beto = v.carriles[1].tarjetas[1], caro = v.carriles[1].tarjetas[2];
  assert.deepEqual([ana.atencion, ana.contacto, ana.producto, ana.iniciales], [true, 'Nunca', 'Mentoría', 'AR'], 'con dos servicios, la tarjeta dice cuál');
  assert.equal(beto.deuda, 300);
  assert.deepEqual([caro.senal, caro.contacto, caro.atencion], [null, null, false]);
  // Sin el orden del catálogo, el de la pieza de las etapas (nunca se inventa uno).
  assert.deepEqual(carrilesDe(carriles, etapas, tabla, null).carriles.map((c) => c.etapa), ['Arranque', 'Bienvenida']);
  // Con un solo servicio, el producto dice lo mismo en cada tarjeta: no va.
  const unServicio = res(tabla.columnas.map((c) => c.id), tabla.totales, { ...tabla, filas: tabla.filas.map((f) => ({ ...f, extra: { ...f.extra, producto: 'Mentoría' } })) });
  assert.ok(carrilesDe(carriles, etapas, unServicio, null).carriles.every((c) => c.tarjetas.every((t) => t.producto == null)));
  // Lo que quedó fuera de la pieza (los primeros 50) se cuenta, y «Otros» no es un cliente.
  const conOtros = { ...carriles, fuera: 7, filas: [...carriles.filas, { clave: 'Otros', etiqueta: 'Otros', valores: [7] }], cruce: { ...carriles.cruce!, celdas: [...carriles.cruce!.celdas, [4, 3]] } };
  const o = carrilesDe(conOtros, etapas, tabla, null);
  assert.equal(o.fuera, 7);
  assert.ok(o.carriles.every((c) => c.tarjetas.every((t) => t.nombre !== 'Otros')));
});

test('las pestañas filtran, y la tarjeta dice el contacto y su ícono', () => {
  const t = (o: Partial<TarjetaCs>): TarjetaCs => ({ clave: 'x', nombre: 'x', iniciales: 'X', tono: 'a', producto: null, contacto: null, senal: null, estado: null, deuda: null, atencion: false, ...o });
  const pide = t({ atencion: true, senal: 'Atención', contacto: 'Más de 30 días' }), bien = t({ senal: 'Bien', contacto: '0-7 días' });
  assert.deepEqual(['todos', 'atencion', 'bien', 'sin-hablar'].map((f) => [pasaFiltro(pide, f as never), pasaFiltro(bien, f as never)]), [[true, true], [true, false], [false, true], [true, false]]);
  assert.equal(pasaFiltro(t({ senal: 'Sin datos' }), 'bien'), false, '«Al día» es la señal Bien, no «no pide atención»: sin datos no es al día');
  assert.equal(textoContacto('8-14 días'), 'habló hace 8-14 días');
  assert.equal(textoContacto('Más de 30 días'), 'habló hace más de 30 días');
  assert.equal(textoContacto('Nunca'), 'nunca habló');
  assert.equal(textoContacto('(sin dato)'), null);
  assert.deepEqual([iconoDe(pide), iconoDe(bien), iconoDe(t({ senal: 'Bien', contacto: '15-30 días' })), iconoDe(t({}))], ['reloj', 'tilde', 'reloj', null]);
});

test('el anillo: los tres motivos con más clientes y «Lo demás»; la señal, con sus colores', () => {
  const m = anilloDe(cat(['clientes'], [['Silencio', 2], ['Cuota vencida', 5], ['Nunca hablaron', 3], ['Sin contestar', 1], ['Otros', 1]]), 'motivo')!;
  assert.equal(m.total, 12);
  assert.deepEqual(m.tramos.map((x) => [x.nombre, x.n]), [['Cuota vencida', 5], ['Nunca hablaron', 3], ['Silencio', 2], ['Lo demás', 2]]);
  assert.deepEqual(m.tramos.map((x) => x.clave), ['Cuota vencida', 'Nunca hablaron', 'Silencio', null], '«Lo demás» junta varias: no abre ninguna');
  assert.deepEqual(m.tramos.map((x) => Math.round(x.barra * 100)), [100, 60, 40, 40], 'la barra es contra el más grande, como Mender');
  assert.equal(Math.round(m.tramos[0].pct), 42);
  const s = anilloDe(cat(['clientes'], [['Atención', 2], ['Bien', 6], ['(sin dato)', 1]]), 'senal')!;
  assert.deepEqual(s.tramos.map((x) => [x.nombre, x.tono]), [['Atención', 'var(--coral)'], ['Bien', 'var(--emerald)'], ['Sin señal', 'var(--ink-4)']]);
  assert.deepEqual(anilloDe(cat(['clientes'], []), 'motivo'), { total: 0, tramos: [] }, 'nadie pide atención no es «no pude leer»');
  assert.equal(anilloDe(null, 'motivo'), null);
});

test('los medidores: hablaron hace poco, sin pedir atención y siguen contigo', () => {
  const contacto = cat(['clientes'], [['0-7 días', 6], ['8-14 días', 2], ['15-30 días', 1], ['Más de 30 días', 0], ['Nunca', 1]]);
  const [c, a, s] = medidoresDe(contacto, 3, 10, 1);
  assert.deepEqual([c.pct, c.tono], [80, 'var(--emerald)'], 'los de 0 a 14 días sobre todos');
  assert.deepEqual([a.pct, a.sub, a.tono], [70, '3 piden atención', 'var(--amber)']);
  assert.deepEqual([s.pct, s.sub], [90, '1 se dio de baja']);
  const sin = medidoresDe(null, null, 10, null);
  assert.deepEqual(sin.map((x) => x.pct), [null, null, null], 'lo que no se pudo leer es null, nunca un cero');
  assert.equal(medidoresDe(contacto, 0, 10, 0)[1].sub, 'nadie pide atención');
  assert.equal(medidoresDe(contacto, 0, 0, 0)[2].pct, null, 'sin clientes no hay porcentaje');
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'cs-analyst')!);
  assert.equal(h.diseno?.id, 'cs');
  const v = vistaCs(h, datosCsMuestra(h), ETAPAS_MUESTRA);
  assert.deepEqual(v.cartera.carriles.map((c) => c.etapa), [...ETAPAS_MUESTRA]);
  const enCarriles = v.cartera.carriles.reduce((a, c) => a + c.tarjetas.length, 0);
  assert.equal(enCarriles, v.cartera.carriles.reduce((a, c) => a + (c.n ?? 0), 0), 'cada etapa cuenta lo que tiene su carril');
  const pide = v.cartera.carriles.flatMap((c) => c.tarjetas).filter((t) => t.atencion).length;
  assert.match(texto(v.frase), new RegExp(`^${pide} de tus ${enCarriles} clientes piden atención\\.`));
  assert.equal(v.motivos?.total, pide, 'el anillo de los motivos cuenta a los que piden atención');
  assert.equal(v.senal?.total, enCarriles);
  assert.deepEqual(Object.keys(v.problemas), []);
});

test('lo que no se pudo leer se dice en su bloque, sin inventar', () => {
  const h = instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'cs-analyst')!);
  const datos = datosCsMuestra(h);
  datos[h.diseno!.piezas.carriles] = { error: 'caída' };
  datos[h.diseno!.piezas.motivos] = { error: 'caída' };
  const v = vistaCs(h, datos, null);
  assert.deepEqual(Object.keys(v.problemas).sort(), ['anillo', 'cartera']);
  assert.ok(v.cartera.carriles.every((c) => !c.tarjetas.length), 'sin la pieza de los carriles no hay tarjetas');
});

test('el cableado: el diseño se ofrece, se dibuja mirando y la página le pasa el orden de las etapas', () => {
  assert.ok((DISENOS_HOJA as readonly string[]).includes('cs'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'cs-analyst'));
  const editor = leer('app/dashboard/EditorInforme.tsx');
  assert.ok(editor.includes("hoja.diseno?.id === 'cs' && !enGrilla && !editando && !dueno"));
  assert.ok(editor.includes('extras={disenos?.cs ?? null}'));
  const pagina = leer('app/dashboard/page.tsx');
  assert.ok(pagina.includes('cs: hayDisenoCs ? { quien, etapas } : null'));
  assert.ok(pagina.includes("const etapasCs = hayDisenoCs ? etapasDeLaEntregaEnOrden() : Promise.resolve(null);"));
  assert.ok(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx').includes('vistaCs(hoja, datosCsMuestra(hoja), ETAPAS_MUESTRA)'));
});

// Probado rompiéndolo (4/11/2026), cada rotura sola y la base en verde antes y después (10 de 10):
//   · los carriles sin el orden del servicio: 1 fallo, 7 pases;
//   · un cliente de dos servicios en un solo carril: 1 fallo, 7 pases;
//   · una señal inventada para quien no está en la tabla: 1 fallo, 7 pases;
//   · «Otros» como un cliente: 1 fallo, 7 pases;
//   · el producto en cada tarjeta con un solo servicio: 1 fallo, 7 pases;
//   · el anillo sin «Lo demás»: 1 fallo, 7 pases;
//   · la barra contra el total y no contra el más grande: 1 fallo, 7 pases;
//   · un medidor que no se pudo leer como 0: 1 fallo, 7 pases;
//   · «hablaron hace poco» sólo con la última semana: 1 fallo, 7 pases;
//   · «Al día» como todo lo que no pide atención: 1 fallo, 7 pases (la primera vez pasó en verde: faltaba una tarjeta «Sin datos»).
