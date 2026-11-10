// =============================================================================
// La hoja «Velocidad de llamada» con su DISEÑO PROPIO (la copia de Tend, «Today»): de dónde sale cada número (lib/velocidad-diseno.ts)
// =============================================================================
// Martín, 10/11/2026: «se inventó cosas en lugar de copiar los templates… con urgencia rehacer este dashboard. Y que quede como los
// otros que tenemos». La hoja la dibuja app/dashboard/disenos/HojaVelocidad.tsx con lo que arma `vistaVelocidad` de las piezas de la
// plantilla `velocidad-llamada` (los conjuntos `primer_contacto`, `conversaciones` y `llamadas_grabadas`). Estos tests EJECUTAN esas
// funciones con datos armados aquí (ficticios) y miran lo que sale; dibujan la hoja con los datos de ejemplo de la miniatura; y el
// último mira el cableado.
// Correr: node --import tsx --test tests/dashboard-diseno-velocidad.test.ts
//
// Probado rompiéndolo (10/11/2026), cada rotura sola, con copia del archivo y restaurado por hash; la base en verde antes y después:
// ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Resultado } from '../lib/graficos-agregar';
import { DISENOS_HOJA } from '../lib/graficos-catalogo';
import { PLANTILLAS_OFRECIDAS, VELOCIDAD_LLAMADA, instanciarPlantilla } from '../lib/graficos-plantillas';
import { ROTULO_RESULTADO, SIN_MARCAR } from '../lib/grabar-llamada-reglas';
import {
  CARGA, CHATS, ESPERAN, FILAS_LINEA, TARJETAS, TRAMOS, actividadDe, cargaDe, carrilesDe, chatsDe, corta, diasDe, esperanDe, lineaDe, llamadasDeHoy,
  numerosDe, resumenDe, tramosDe, vistaVelocidad,
} from '../lib/velocidad-diseno';
import { datosVelocidadMuestra } from '../lib/velocidad-diseno-muestra';
import { HojaVelocidad } from '../app/dashboard/disenos/HojaVelocidad';
import { cableadoDelDiseno } from './_diseno-cableado';

const leer = (r: string) => readFileSync(fileURLToPath(new URL(`../${r}`, import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const res = (ids: string[], totales: Array<number | null>, extra: Partial<Resultado> = {}): Resultado =>
  ({ columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...extra }) as Resultado;
type FilaPrueba = { clave: string; valores: Array<number | null>; extra?: Record<string, string | null>; ref?: string };
const filas = (ids: string[], fs: FilaPrueba[], extra: Partial<Resultado> = {}): Resultado =>
  res(ids, ids.map(() => null), { clase: 'categoria', filas: fs.map((f) => ({ clave: f.clave, etiqueta: f.clave, valores: f.valores, ...(f.extra ? { extra: f.extra } : {}), ...(f.ref ? { ref: f.ref } : {}) })), ...extra });
const HOY = '2026-11-10';
const hoja = () => instanciarPlantilla(VELOCIDAD_LLAMADA);
const RESUMEN = ['leads', 'contactados', 'sin_contactar', 'base_1h', 'en_1h', 'mediana_contacto', 'mediana_espera', 'ya_hablaban'];

test('el resumen: los sin contactar a tiempo y los que esperan salen de la base de la primera hora; sin dato, null y nunca 0', () => {
  // 100 leads: 60 contactados, 30 sin contactar, 10 ya hablaban. La base de la primera hora (los que tuvieron una hora entera) es 85:
  // 60 contactados + 25 sin contactar de más de una hora → 5 entraron hace menos de una hora.
  const s = resumenDe(res(RESUMEN, [100, 60, 30, 85, 24, 75, 1300, 10], { anterior: [80, 40, 32, null, null, null, null, null] }));
  assert.deepEqual([s.leads, s.contactados, s.sinContactar, s.esperando, s.aTiempo, s.otros], [100, 60, 30, 25, 5, 10]);
  assert.equal(s.pctSin, 30);
  assert.equal(s.pctSinAntes, 40);
  const vacio = resumenDe(null);
  assert.ok(Object.values(vacio).every((v) => v === null), 'sin la pieza, todo null');
  // Sin el total de leads, los «otros» son los que ya hablaban (la columna propia), no una resta inventada.
  assert.equal(resumenDe(res(['contactados', 'sin_contactar', 'ya_hablaban'], [5, 2, 3])).otros, 3);
});

test('los cuatro números: la píldora de cada uno, y «bueno» sólo cuando lo es', () => {
  const s = resumenDe(res(RESUMEN, [100, 60, 30, 85, 24, 75, 45, 10], { anterior: [80, 40, 32, null, null, null, null, null] }));
  const n = numerosDe(s, 'Últimos 30 días');
  assert.deepEqual(n.map((x) => x.nombre), ['Leads nuevos', 'Esperando contacto', 'Primer contacto', 'Sin contactar, últimos 30 días']);
  assert.deepEqual(n.map((x) => x.texto), ['100', '30', '1 h', '30%']);
  assert.deepEqual(n.map((x) => x.pill), ['60 contactados', 'mediana 45 min', '28% en la primera hora', 'era 40% antes']);
  assert.deepEqual(n.map((x) => x.bueno), [false, true, false, true], 'la espera dentro de la hora y el % que bajó');
  const sin = numerosDe(resumenDe(null), 'Hoy');
  assert.ok(sin.every((x) => x.texto === null && x.pill === null && !x.bueno), 'sin datos, «—» y sin píldora');
});

test('el flujo: los sin contactar se parten en la hora; el número de cada carril es el del resumen, no el de las filas', () => {
  const s = resumenDe(res(RESUMEN, [140, 60, 70, 125, 24, 75, 1300, 10]));
  const recien = filas(['espera'], [
    ...[10, 25, 50].map((m, i) => ({ clave: `Nuevo ${i}`, valores: [m * 60], ref: String(i) })),
    ...Array.from({ length: 47 }, (_, i) => ({ clave: `Espera ${i}`, valores: [(70 + i * 30) * 60], extra: { dia: '09/11', setter: 'Ana', producto: 'Casas' } })),
  ]);
  const c = carrilesDe(s, { recien, contactados: filas(['espera'], [{ clave: 'Uno', valores: [600], extra: { canal: 'WhatsApp' } }]), antes: null });
  assert.deepEqual(c.map((x) => [x.id, x.nombre]), [['entraron', 'Entraron'], ['esperando', 'Esperando'], ['contactados', 'Contactados'], ['otros', 'Sin medir']]);
  assert.deepEqual(c.map((x) => x.n), [5, 65, 60, 10], 'del resumen: 70 sin contactar = 5 a tiempo + 65 esperando');
  assert.deepEqual(c[0].leads.map((l) => l.nombre), ['Nuevo 0', 'Nuevo 1', 'Nuevo 2']);
  assert.equal(c[0].leads[0].ref, '0', 'la tarjeta sabe qué lead abre y a quién se llama');
  // La tabla trae 50 como mucho: el carril dibuja cinco y «+N más» cuenta contra el resumen (65), no contra las 47 filas.
  assert.equal(c[1].leads.length, TARJETAS - 1);
  assert.equal(c[1].mas, 65 - (TARJETAS - 1));
  assert.equal(c[1].leads[0].quien, 'Ana');
  assert.deepEqual([c[2].leads.length, c[2].mas], [1, 59]);
  assert.deepEqual([c[3].leads, c[3].mas], [[], 10], 'sin la pieza, el carril queda vacío con su número');
});

test('WhatsApp: de la espera más corta a la más larga, «Urgente» pasadas 24 h, y sin espera no es un chat que espera', () => {
  const ch = chatsDe(filas(['espera_respuesta', 'sin_responder'], [
    { clave: 'Lejos', valores: [30 * 3600, 1], extra: { etapa: 'Calificado' } },
    { clave: 'Cerca', valores: [300, 0] },
    { clave: 'Respondido', valores: [null, 0] },
    { clave: '(sin dato)', valores: [600, 0] },
  ]))!;
  assert.deepEqual(ch.filas.map((f) => [f.nombre, Math.round(f.minutos), f.urgente, f.etapa]), [['Cerca', 5, false, null], ['Lejos', 1800, true, 'Calificado']]);
  assert.equal(ch.total, 2);
  const muchos = chatsDe(filas(['espera_respuesta'], Array.from({ length: 9 }, (_, i) => ({ clave: `C${i}`, valores: [i * 60] }))))!;
  assert.deepEqual([muchos.filas.length, muchos.total], [CHATS, 9]);
  assert.equal(chatsDe(null), null);
});

test('las llamadas de hoy: una por hora, la fila por quién llama, «contestan» sin contar «No contestó», y la actividad de la más tarde', () => {
  const { agendo, hablo, no_contesto } = ROTULO_RESULTADO;
  const ll = llamadasDeHoy(filas(['llamadas', 'minutos'], [
    { clave: 'Lead A', valores: [2, 20], extra: { autor: 'Ana, Luis', resultado: `${agendo}, ${hablo}`, hora: '09, 15' } },
    { clave: 'Lead B', valores: [1, 4], extra: { autor: 'Ana', resultado: no_contesto, hora: '19' } },
    { clave: 'Lead C', valores: [1, 6], extra: { autor: 'Luis', resultado: SIN_MARCAR, hora: '10' } },
    { clave: 'Sin hora', valores: [1, 3], extra: { autor: 'Luis' } },
  ]))!;
  assert.deepEqual(ll.map((l) => [l.nombre, l.hora, l.quien]), [['Lead A', 9, 'Ana'], ['Lead A', 15, 'Ana'], ['Lead B', 19, 'Ana'], ['Lead C', 10, 'Luis']]);
  const linea = lineaDe(ll)!;
  assert.deepEqual(linea.filas.map((f) => [f.quien, f.llamadas, f.contestaron]), [['Ana', 3, 2], ['Luis', 1, 0]]);
  assert.deepEqual([linea.desde, linea.hasta], [8, 20], 'el día de la copia (8 a 17) se estira hasta la llamada de las 19');
  assert.equal(linea.filas[0].bloques[0].color, 'teal', 'agendó, en el color de la copia');
  const act = actividadDe(ll)!;
  assert.deepEqual(act.map((a) => a.hora), [19, 15, 10, 9]);
  const varios = lineaDe(Array.from({ length: 8 }, (_, i) => ({ lead: `L${i}`, ref: null, nombre: `L${i}`, quien: `P${i}`, resultado: null, hora: 9, minutos: 5 })))!;
  assert.equal(varios.filas.length, FILAS_LINEA);
  assert.deepEqual([llamadasDeHoy(null), lineaDe(null), actividadDe(null)], [null, null, null]);
});

test('cuánto tardaron, día por día, los que más esperan y la carga de cada setter', () => {
  const t = tramosDe(filas(['leads'], [{ clave: 'De 1 a 3 días', valores: [4] }, { clave: 'En la primera hora', valores: [10] }]))!;
  assert.deepEqual(t.filas.map((f) => [f.rotulo, f.valor]), [['En 1 hora', 10], ['1 a 24 h', 0], ['1 a 3 días', 4], ['Más de 3 días', 0]], 'los cuatro, en el orden de la copia');
  assert.equal(t.total, 14);
  assert.equal(TRAMOS.length, 4);
  const d = diasDe(res(['contactados', 'sin_contactar'], [null, null], { clase: 'tiempo', filas: [
    { clave: '2026-11-09', etiqueta: '', valores: [3, 1] }, { clave: '2026-11-08', etiqueta: '', valores: [2, null] }, { clave: '(sin dato)', etiqueta: '', valores: [9, 9] },
  ] }))!;
  assert.deepEqual(d.map((x) => [x.rotulo, x.contactados, x.sinContactar]), [['8 nov', 2, 0], ['9 nov', 3, 1]]);
  const e = esperanDe(filas(['espera'], Array.from({ length: 9 }, (_, i) => ({ clave: `E${i}`, valores: [(9 - i) * 3600] }))))!;
  assert.equal(e.length, ESPERAN);
  assert.equal(corta(e[0].minutos), '9 h');
  const c = cargaDe(filas(['leads', 'contactados', 'sin_contactar', 'mediana_contacto'], [
    { clave: 'Ana', valores: [10, 8, 2, 40] }, { clave: '(sin dato)', valores: [20, 5, 15, null] }, { clave: 'Luis', valores: [0, 0, 0, null] },
  ]))!;
  assert.deepEqual(c.map((x) => [x.nombre, x.leads, x.ancho]), [['Sin setter', 20, 0.25], ['Ana', 10, 0.8]], 'sin setter se nombra, y sin leads no se dibuja');
  assert.ok(c.length <= CARGA);
  assert.deepEqual([tramosDe(null), diasDe(null), esperanDe(null), cargaDe(null)], [null, null, null, null]);
  assert.deepEqual([corta(null), corta(12), corta(130), corta(60 * 50)], [null, '12 min', '2 h', '2 d']);
});

test('la hoja entera con la muestra: las cifras cierran entre tarjetas', () => {
  const h = hoja();
  const v = vistaVelocidad(h, datosVelocidadMuestra(h, HOY), 'Últimos 30 días');
  const r = v.resumen;
  assert.ok(r.leads && r.contactados && r.sinContactar, 'la muestra trae números');
  assert.equal(v.carriles.reduce((a, c) => a + (c.n ?? 0), 0), r.leads, 'los carriles suman los leads');
  assert.equal(v.tramos!.total, r.contactados, 'los tramos suman los contactados');
  assert.equal(v.dias!.reduce((a, d) => a + d.contactados, 0), r.contactados, 'los días suman los contactados');
  assert.equal(v.dias!.reduce((a, d) => a + d.sinContactar, 0), r.sinContactar, 'y los sin contactar');
  assert.equal(v.carga!.reduce((a, c) => a + c.leads, 0), r.leads, 'la carga de cada setter suma los leads');
  assert.equal(v.carga!.reduce((a, c) => a + c.contactados, 0), r.contactados);
  assert.equal(v.carga!.reduce((a, c) => a + c.sinContactar, 0), r.sinContactar);
  assert.ok(v.carriles.every((c) => c.leads.length > 0), 'cada carril con sus tarjetas');
  assert.ok(v.chats!.filas.length > 0 && v.linea!.filas.length > 0 && v.actividad!.length > 0 && v.esperan!.length > 0);
  assert.equal(v.cargando, false);
});

test('sin datos, cada tarjeta queda en «—» y vacía: nada se inventa, y leyendo se sabe', () => {
  const h = hoja();
  const v = vistaVelocidad(h, {}, 'Últimos 30 días');
  assert.ok(v.numeros.every((n) => n.texto === null));
  assert.ok(v.carriles.every((c) => c.n === null && c.leads.length === 0 && c.mas === 0));
  assert.deepEqual([v.chats, v.linea, v.actividad, v.tramos, v.dias, v.esperan, v.carga], [null, null, null, null, null, null, null]);
  const leyendo = vistaVelocidad(h, { [h.diseno!.piezas.resumen]: { resultado: null, cargando: true } }, 'Hoy');
  assert.equal(leyendo.cargando, true);
});

// Lo que la copia NO dice: los textos de Tend en inglés (cada uno se cambió por el de MaKo) y las cosas que se fueron con la hoja de
// antes (la explicación de grabar, «Cada lead nuevo»).
const DE_TEND = ['Patient flow', 'Waiting room', 'In consult', 'Clinicians today', 'Recalls due', 'Clinician load', 'Team activity', 'Reminders', 'Visits', 'Call in', 'New appointment', 'Remind tomorrow', 'Good morning'];
const DE_ANTES = ['Cada lead nuevo', 'MaKo sólo ve las llamadas', 'Cold Calling', 'Toca Grabar llamada'];

test('la hoja dibuja sus diez tarjetas con la muestra, en castellano, y compartida no graba', () => {
  const h = hoja();
  const vista = vistaVelocidad(h, datosVelocidadMuestra(h, HOY), 'Últimos 30 días');
  const props = { hoja: h, vista, saludo: 'Buenos días, Ana', negocio: 'Inmobiliaria del Valle', hoy: HOY, periodo: 'Últimos 30 días', ahora: 11.2 };
  const html = renderToStaticMarkup(createElement(HojaVelocidad, props));
  const texto = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  for (const t of ['Martes 10 de noviembre · Inmobiliaria del Valle', 'Abrir el CRM', 'Grabar llamada', 'Leads nuevos', 'Esperando contacto', 'Flujo de leads', 'Entraron', 'Esperando',
    'Contactados', 'Sin medir', 'WhatsApp', 'Llamadas de hoy', 'Cuánto tardaron', 'Leads por día', 'Los que más esperan', 'Carga por setter', 'Actividad del equipo', 'Llamar']) {
    assert.ok(texto.includes(t), `falta «${t}»`);
  }
  for (const t of [...DE_TEND, ...DE_ANTES]) assert.ok(!texto.includes(t), `quedó «${t}»`);
  assert.equal((html.match(/data-parte="/g) ?? []).length, 10, 'las diez tarjetas, cada una en su <Parte>');
  assert.match(html, /<button type="button" class="vt-btn vt-btn--wa">/, 'mirando, «Grabar llamada» es un botón');
  const compartida = renderToStaticMarkup(createElement(HojaVelocidad, { ...props, compartido: true }));
  assert.doesNotMatch(compartida, /<button[^>]*>(<svg[^>]*>.*?<\/svg>)?(Grabar llamada|Llamar)/, 'en un link compartido no se graba ni se llama');
  assert.doesNotMatch(compartida, /href="\/crm"/, 'ni se abre el CRM (no hay sesión)');
});

test('el cableado: la plantilla trae su diseño con sus diez piezas, se ofrece, el editor la dibuja con VelocidadVivo y graba con la misma grabadora', () => {
  const h = hoja();
  cableadoDelDiseno(h, 'velocidad', 'VelocidadVivo', ['extras={extras?.velocidad ?? null}', 'onCambio={onCambio}']);
  assert.ok((DISENOS_HOJA as readonly string[]).includes('velocidad'));
  assert.ok(PLANTILLAS_OFRECIDAS.some((p) => p.id === 'velocidad-llamada'), 'se ofrece en «Nueva hoja»');
  assert.deepEqual(Object.keys(h.diseno!.piezas).sort(), ['antes', 'carga', 'chats', 'contactados', 'dias', 'esperan', 'hoy', 'recien', 'resumen', 'tramos']);
  const src = leer('app/dashboard/disenos/HojaVelocidad.tsx');
  assert.ok(src.includes("import('@/app/_components/grabar/GrabarEnFrio')"), 'la grabadora es la de la ficha del lead');
  // UNA copia: la hoja no monta tarjetas de otro diseño (lo que hacía la de antes).
  assert.doesNotMatch(src, /from '\.\/Hoja(?!Velocidad)[A-Z]\w*'/, 'no importa otra hoja copiada');
  assert.match(leer('app/dashboard/disenos/DisenoEnMiniatura.tsx'), /velocidad: \(\{ hoja, hoy \}\) => \(/, 'la miniatura de «Nueva hoja» la dibuja');
  assert.match(leer('app/dashboard/page.tsx'), /velocidad: hayDisenoVelocidad \? \{ quien \} : null,/, 'la página le pasa quién mira (el saludo y el negocio)');
});

// ── Roturas (10/11/2026), cada una sola, con copia y verificada por hash. Base 10 / 0; al final 10 / 0:
//   · `aTiempo` = todos los sin contactar (sin restar los que esperan)        -> 7 / 3  «el resumen…», «el flujo…», «la hoja entera…»
//   · el carril «Esperando» con el número de sus filas (null) y no el del resumen -> 8 / 2  «el flujo…», «la hoja entera…»
//   · los chats de la espera más LARGA a la más corta                          -> 9 / 1  «WhatsApp…»
//   · la muestra con un setter menos (la carga no suma los leads)              -> 9 / 1  «la hoja entera…»
//   · `puedeGrabar` sin `!compartido`                                          -> 9 / 1  «la hoja dibuja sus diez tarjetas…»
//   · «Flujo de leads» devuelto a «Patient flow»                               -> 9 / 1  el mismo
//   · el despachador sin el renglón de `velocidad`                             -> 9 / 1  «el cableado…»
