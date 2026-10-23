// =============================================================================
// El feedback de Martín del 22/10/2026 (noche, con capturas del CRM del ws1): el «⋯» de la columna, «Tipo de etapa» y
// «Tus reuniones»
// =============================================================================
// Textual:
//   1. «Ordena las opciones del desplegable de los 3 puntos... Ya no se entienden si son tantas, ponlas en secciones».
//   2. «Tipo de etapa»: «no me gusta ese ícono, eliminalo de todos lados, por otro» y «al apretar o pasar el cursor me
//      debería abrir un segundo desplegable allí mismo para ver el tipo de etapa actual y poder cambiarlo».
//   3. «Tampoco me gustó el pop-up con los bloques azules, rediseñalo... Piensa en un diseño que sea útil, justamente se
//      acerca la reunión que la tarjeta refleje algo al respecto... Y que no tenga "Llamar o WhatsApp"».
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 7 / 0, una rotura por vez y restaurada:
//   · `itemsCrm` sin poner el título de la sección                                              → 6 / 1
//   · la lista sin la raya antes del título de una sección                                      → 6 / 1
//   · «Tipo de etapa» sin el submenú de los tipos                                               → 6 / 1
//   · el ícono `etapa` con las tres columnas de vuelta                                          → 6 / 1
//   · «empieza en N min» desde 15 minutos y no desde 10                                         → 6 / 1
//   · una hora de OTRO día contada como la de la reunión                                        → 6 / 1
//   · «Entrar a la reunión» sin link                                                            → 6 / 1
//   · la tarjeta con «Llamar» de vuelta                                                         → 6 / 1
// Correr: node --import tsx --test tests/crm-feedback-22-10-c.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IconoMenu } from '../app/_ui/iconos-menu';
import { ListaMenuContextual, type ItemMenuContextual } from '../app/_ui/MenuContextual';
import { itemsCrm, opcionesCrm, type ContextoCrm } from '../app/crm/menu-contextual-crm';
import { cadaCuanto, cuantoFalta, diaLocal, instanteDe, lineaDeLaR1, lineaUltimo, puedeEntrar } from '../app/crm/reunion-tarjeta';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));

const COL: ContextoCrm = { sobre: 'columna', mover: true, entrada: false, reunion: true, tipo: true, curso: null, borrable: true };
const DATOS = { etapas: [], equipo: [], etiquetas: null, funnels: [] };

test('1. el menú de la columna va por SECCIONES: Columnas · Leads · Etapa, y «Eliminar etapa» sola al final', () => {
  const items = itemsCrm(opcionesCrm(COL), { ...DATOS, tipoActual: 'reunion' });
  const conTitulo = items.filter((x): x is ItemMenuContextual => !!x && !!x.seccion).map((x) => [x.seccion, x.id]);
  assert.deepEqual(conTitulo, [['Columnas', 'col_izquierda+col_derecha'], ['Leads', 'col_nuevo_lead'], ['Etapa', 'col_renombrar']]);
  // «Eliminar etapa»: la última, en rojo, separada y sin título.
  const ult = items[items.length - 1];
  assert.equal(ult?.id, 'col_eliminar');
  assert.equal(ult?.peligro, true);
  assert.equal(items[items.length - 2], null);
  // Una sección que quedó vacía no deja título: sin flechas, «Columnas» va en «Agregar etapa».
  const sinMover = itemsCrm(opcionesCrm({ ...COL, mover: false }), DATOS).filter((x) => x?.seccion);
  assert.equal(sinMover[0]?.id, 'col_agregar');
  // La pieza dibuja el título con su raya antes (si no es el primero) y el ✓ de lo tildado.
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, { items, onElegir: () => {} }));
  const i1 = html.indexOf('>Leads<');
  assert.ok(i1 > 0, 'no se dibujó el título de la sección');
  assert.match(html.slice(0, i1), /role="separator"[^>]*><\/div><div aria-hidden="true"[^>]*$/, 'sin la raya antes del título');
  assert.ok(html.indexOf('>Columnas<') < html.indexOf('>Leads<') && html.indexOf('>Leads<') < html.indexOf('>Etapa<'));
});

test('2. «Tipo de etapa ›»: los tres tipos ahí mismo, el actual tildado; elegir lo cambia con su «Deshacer»', () => {
  const tipo = itemsCrm(opcionesCrm(COL), { ...DATOS, tipoActual: 'reunion' }).find((x) => x?.id === 'col_tipo');
  assert.deepEqual(tipo?.hijos?.map((h) => [h.id, h.label, h.marcado]), [['etapa', 'Etapa', false], ['reunion', 'Reunión', true], ['nutricion', 'Nutrición', false]]);
  const html = renderToStaticMarkup(createElement(ListaMenuContextual, { items: tipo!.hijos!, padre: 'col_tipo', onElegir: () => {} }));
  assert.match(html, /aria-current="true"[^>]*>[\s\S]*?Reunión[\s\S]*?✓/, 'el tipo actual sin su tilde');
  // Sin saber el tipo, el renglón abre el pop-up de siempre.
  assert.equal(itemsCrm(['col_tipo'], DATOS)[0]?.hijos, undefined);
  // El tablero: la MISMA op del pop-up de etapas, con «Deshacer»; la tercera reunión va al pop-up, con el tipo ya elegido.
  const fn = BOARD.slice(BOARD.indexOf('const cambiarTipoColumna = '), BOARD.indexOf('const copiarDato = '));
  assert.match(fn, /if \(aviso\.includes\(AVISO_SIN_LUGAR\)\) \{ setTipoPedido\(tipo\); setTipoDe\(c\.key\); return; \}/);
  assert.match(fn, /const r = await opEtapa\(\{ op: 'tipo', key: c\.key, tipo \}\);/);
  assert.match(fn, /mostrarAviso\(`«\$\{c\.label\}» es \$\{NOMBRE_TIPO_ETAPA\[tipo\]\}`, \(\) => \{ void opEtapa\(\{ op: 'tipo', key: c\.key, tipo: previo \}\); \}\);/);
  assert.match(BOARD, /inicial=\{tipoPedido \?\? undefined\}/);
  assert.match(sinComentarios(leer('app/crm/TipoEtapaModal.tsx')), /useState<TipoEtapa>\(inicial \?\? actual\)/);
});

test('2. el ícono de la etapa ya no son las columnas del Kanban: es una bandera, en todos lados', () => {
  const svg = renderToStaticMarkup(createElement(IconoMenu, { nombre: 'etapa' }));
  assert.doesNotMatch(svg, /<rect\b/, 'volvieron las tres columnas');
  assert.match(svg, /<path d="M5\.5 20\.5v-17"/, 'el mástil de la bandera');
  // Los que lo usan lo nombran, no lo dibujan: cambia en todos.
  assert.equal((leer('app/_ui/iconos-menu.tsx').match(/width="4\.3"/g) ?? []).length, 0);
});

test('3. cuánto falta: «En 25 min», «Empieza en 5 min», «Empezó hace…», y otro día con su hora', () => {
  const ahora = new Date(2026, 9, 22, 15, 0, 0).getTime();
  const en = (min: number) => ahora + min * 60_000;
  assert.deepEqual(cuantoFalta(en(25), ahora), { texto: 'En 25 min', cerca: 'pronto' });
  assert.deepEqual(cuantoFalta(en(11), ahora), { texto: 'En 11 min', cerca: 'pronto' });
  assert.deepEqual(cuantoFalta(en(10), ahora), { texto: 'Empieza en 10 min', cerca: 'ya' });
  assert.deepEqual(cuantoFalta(en(5), ahora), { texto: 'Empieza en 5 min', cerca: 'ya' });
  assert.deepEqual(cuantoFalta(en(0), ahora), { texto: 'Empieza ahora', cerca: 'ya' });
  assert.deepEqual(cuantoFalta(en(-12), ahora), { texto: 'Empezó hace 12 min', cerca: 'en_curso' });
  assert.equal(cuantoFalta(en(-90), ahora).cerca, 'paso');
  assert.deepEqual(cuantoFalta(en(130), ahora), { texto: 'En 2 h 10 min', cerca: 'hoy' });
  assert.equal(cuantoFalta(en(24 * 60), ahora).texto, 'Mañana a las 15:00');
  // Sin hora: el día que trae la reunión, sin contar.
  assert.deepEqual(cuantoFalta(null, ahora, 'mañana'), { texto: 'Mañana', cerca: 'otro_dia' });
  assert.deepEqual(cuantoFalta(null, ahora, 'pasó'), { texto: 'Ya pasó', cerca: 'paso' });
  // Cerca de la hora se cuenta más seguido: «empieza en 1 min» no puede llegar tarde.
  assert.equal(cadaCuanto(['hoy', 'otro_dia']), 60_000);
  assert.equal(cadaCuanto(['hoy', 'ya']), 15_000);
});

test('3. la hora vale sólo si cae en el día de la reunión, y «Entrar» sólo con link y cerca', () => {
  const at = new Date(2026, 9, 22, 16, 30).toISOString();
  assert.equal(instanteDe(at, '2026-10-22'), Date.parse(at));
  assert.equal(instanteDe(at, '2026-10-24'), null, 'un junta_N_at de otro día (reagendado sin hora) no es la hora');
  assert.equal(instanteDe('basura', '2026-10-22'), null);
  assert.equal(diaLocal(Date.parse(at)), '2026-10-22');
  const ms = Date.parse(at);
  assert.ok(puedeEntrar(ms, 'https://meet.google.com/abc', ms - 15 * 60_000), '15 minutos antes ya se entra');
  assert.ok(!puedeEntrar(ms, 'https://meet.google.com/abc', ms - 16 * 60_000));
  assert.ok(puedeEntrar(ms, 'https://meet.google.com/abc', ms + 59 * 60_000), 'en curso, todavía');
  assert.ok(!puedeEntrar(ms, 'https://meet.google.com/abc', ms + 61 * 60_000));
  assert.ok(!puedeEntrar(ms, null, ms), 'sin link, no hay a dónde entrar');
  assert.ok(!puedeEntrar(null, 'https://meet.google.com/abc', ms), 'sin hora, no se sabe cuándo');
});

test('3. lo útil para entrar: lo último que hizo el lead y lo que quedó de la R1', () => {
  const ahora = Date.parse('2026-10-22T18:00:00Z');
  assert.equal(lineaUltimo({ fecha: '2026-10-22T16:00:00Z', via: 'whatsapp' }, ahora), 'Te escribió por WhatsApp hace 2 h');
  assert.equal(lineaUltimo({ fecha: '2026-10-19T18:00:00Z', via: 'sesion' }, ahora), 'Última llamada hace 3 días');
  assert.equal(lineaUltimo({ fecha: null, via: null }, ahora), null, 'sin contacto no se inventa «sin contacto»');
  assert.equal(lineaDeLaR1({ resumen: 'Quiere escalar a 50k. Le preocupa el precio.', proximoPaso: null }), 'Quiere escalar a 50k.');
  assert.equal(lineaDeLaR1({ resumen: 'x', proximoPaso: 'Mandarle el caso de éxito' }), 'Mandarle el caso de éxito');
  assert.equal(lineaDeLaR1(null), null);
  const lib = sinComentarios(leer('lib/reunion-preparar.ts'));
  assert.match(lib, /\.in\('lead_id', ids\)\.eq\('tipo', 'R1'\)\.eq\('status', 'analizada'\)/, 'la R1 analizada, no cualquier llamada');
  assert.match(lib, /ultimoContactoDeClientes\(ids\)/, 'lo último, con la regla de Clientes (lo que escribió EL LEAD)');
  const accion = sinComentarios(leer('app/crm/reuniones-actions.ts'));
  assert.ok(accion.indexOf('await exigirSesion()') < accion.indexOf('contextoParaReuniones('), 'la sesión, primero');
});

test('3. la tarjeta: sin «Llamar» ni «WhatsApp», la misma en la computadora y en el teléfono, y MaKo sabe la hora', () => {
  const t = sinComentarios(leer('app/crm/TarjetaReunion.tsx'));
  assert.doesNotMatch(t, /Llamar|WhatsApp|tel:|wa\.me/, '«Y que no tenga "Llamar o WhatsApp"»');
  assert.match(t, /\{entrar && r\.url && <ButtonLink href=\{r\.url\} newTab variant="primary" size="sm">Entrar a la reunión<\/ButtonLink>\}/);
  assert.match(t, /<span className="crm-reu__falta" role="timer">/);
  assert.match(t, /ahora=\{montado \? ahora : null\}/, 'la hora se cuenta después de montar (hidratación)');
  const bloques = BOARD.slice(BOARD.indexOf('const bloquesDeReuniones = '), BOARD.indexOf('<main className="crm-hover"'));
  assert.ok(bloques.length > 500, 'no encontré el armado de las reuniones');
  assert.doesNotMatch(bloques, /Llamar|waDe\(|tel:/);
  assert.match(sinComentarios(leer('app/m/crm/TableroCrm.tsx')), /<ReunionesParaPreparar reuniones=\{\[\{/);
  assert.doesNotMatch(sinComentarios(leer('app/m/crm/TableroCrm.tsx')), /TarjetaDestacada/);
  // La hora y el link, desde la base hasta la tarjeta.
  assert.match(sinComentarios(leer('lib/queries.ts')), /at: at \?\? null,\s*url: \(c\.tipo === 'J1' \? lead\.junta_1_url : lead\.junta_2_url\) \?\? null,/);
  assert.match(sinComentarios(leer('app/crm/page.tsx')), /at: j\.at \?\? null,\s*url: j\.url \?\? null,/);
  // MaKo lee lo mismo (la API de MaKo con cada función): la hora, sólo si cae en su día, y el link.
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), /hora: j\.at && new Intl\.DateTimeFormat\('en-CA', \{ timeZone: tz \}\)\.format\(new Date\(j\.at\)\) === j\.fecha \? j\.at : null, link: j\.url \?\? null,/);
});
