// =============================================================================
// El Resumen nativo, VERIFICADO: nada de lo que la ficha de antes mostraba se perdió, y «Deshacer» no pisa a otro
// =============================================================================
// La verificación de la tanda 1 de la ficha v2 (16/10/2026, rama crm-ficha-v2). Martín: «Los datos de los leads de
// todos los workspace se van a guardar, solo que van a ser completamente diferente las tabs». Lo que se encontró:
//   1. EL CONTACTO DE ANTES (InfoPrincipalCard) traía ADENTRO la web, Instagram y el ingreso estimado (los de fábrica
//      de `crm.resumen.campos`, que ningún negocio cambió: medido en producción el 16/10, 0 filas). El Resumen nativo
//      los partió en sus bloques (`redes-y-web`, `ingreso-estimado`) y cinco plantillas de entrada no los pusieron:
//      Evento, Formulario de Meta (sin redes), Landing, Te escriben y Carrito. Medido el 16/10: el ws 11 (tres funnels
//      de evento) tiene 3 leads con ingreso y 1 con Instagram que hoy se ven y al desplegar dejaban de verse.
//   2. DE DÓNDE VINO, en «Una línea» (la de entrada de Evento, Landing, Te escriben y «Para llamarlo»), decía el canal y
//      el anuncio y se callaba la campaña y el conjunto, que OrigenCard mostraba siempre («UN camino y no tres datos»).
//   3. «DESHACER» DE UN CAMPO escribía el valor de antes A CIEGAS: si en los 5 segundos del aviso otra persona (u otro
//      camino: un webhook, el motor) cambió ese campo, lo pisaba. Ahora el Deshacer manda lo que él escribió y el
//      server no deshace si hoy dice otra cosa (el mismo `esperado` que el Deshacer de la ficha del funnel).
//   4. Cómo se ven: la fila de propiedad decide rótulo arriba o al lado por SU ancho (no por la ventana), y los tres
//      botones de la calificación reparten el ancho por su texto («No calificado» se cortaba en ⅓ a 1440).
//   5. El motivo de salida entra como TEXTO en las plantillas (los chips son del wizard de la etapa: decisión del 12/10).
//
// Correr: node --import tsx --test tests/ficha-resumen-lo-de-antes.test.ts
//
// ⚠️ ROJO PRIMERO: escrito antes que el arreglo, dio 0 / 5 (las cinco por lo que dicen, no por un import).
// ⚠️ VERIFICADO ROMPIÉNDOLO (16/10/2026, base 5/0), cada rotura restaurada de memoria antes de la siguiente:
//   · «Antes del evento» sin «Redes y web»                                        → 4 / 1
//   · «Su registro» (Landing) sin el ingreso estimado                               → 4 / 1
//   · `lineaDeOrigen` sin la campaña ni el conjunto                                 → 4 / 1
//   · «Una línea» que vuelve a dibujar sólo el anuncio                              → 4 / 1
//   · las fechas comparadas con la hora (la columna vuelve con hora)                → 4 / 1
//   · el monto comparado como texto («15000.00» contra 15000)                       → 4 / 1
//   · el link de Fathom sin mirar de qué reunión es                                 → 4 / 1
//   · el contacto sin cortar a 300 como el guardado                                 → 4 / 1
//   · `useGuardarCampo` que deshace a ciegas                                        → 4 / 1
//   · `useGuardarMeta` que deshace a ciegas                                         → 4 / 1
//   · el server que deshace sin comparar                                            → 4 / 1
//   · el contacto: escribe y DESPUÉS compara                                        → 4 / 1
//   · la fila de propiedad que decide por la ventana (rótulo fijo al 30%)            → 4 / 1
//   · los tres botones de la calificación en partes iguales                         → 4 / 1
//   · «Antes de la llamada» con los chips del motivo de entrada                     → 4 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IDS_PLANTILLA } from '../lib/ficha/plantillas';
import { fichaEfectiva, RESPALDO_VACIO } from '../lib/ficha/config';
import { CAMPOS_RESUMEN } from '../lib/resumen-ficha';
import { PLANTILLAS_TAB_RESUMEN } from '../lib/ficha/plantillas-resumen';
import { REGLAS_RESUMEN } from '../app/crm/lead-view/ficha/reglas-resumen';
import { origenDelLead, lineaDeOrigen } from '../app/crm/lead-view/ficha/resumen/logica';
import {
  mismoDatoDeContacto, mismoValorDeCampo, valorGuardadoDeCampo, CAMPOS_CONTACTO,
} from '../app/crm/campo-inline';
import { etiquetaEsR2 } from '../lib/insights-llamada-reparto';
import { CSS_RESUMEN } from '../app/crm/lead-view/ficha/resumen/estilo';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

test('lo que el contacto de antes mostraba de fábrica sigue en el Resumen de entrada de los nueve tipos', () => {
  // Los datos de `crm.resumen.campos` prendidos de fábrica, y el bloque que hoy los dibuja.
  const deFabrica = CAMPOS_RESUMEN.filter((c) => c.grupo === 'Datos' && c.porDefecto).map((c) => c.id);
  assert.deepEqual([...deFabrica].sort(), ['cohorte', 'ingreso', 'instagram', 'web'], 'si cambia lo de fábrica, este test se revisa');
  assert.ok((REGLAS_RESUMEN.contacto.incluye as readonly string[]).includes('cohorte'), 'la cohorte sigue adentro del contacto');
  for (const tipo of IDS_PLANTILLA) {
    const l = fichaEfectiva(tipo, {}, RESPALDO_VACIO).tabs.resumen;
    const redes = l.find((b) => b.id === 'redes-y-web');
    assert.ok(redes, `«${tipo}»: la web y el Instagram dejaron de verse (no hay «Redes y web»)`);
    assert.deepEqual(redes!.opciones?.redes, ['web', 'instagram'], `«${tipo}»: las redes son las que el negocio ve`);
    assert.ok(l.some((b) => b.id === 'ingreso-estimado'), `«${tipo}»: el ingreso estimado dejó de verse`);
    assert.ok(l.some((b) => b.id === 'contacto'), `«${tipo}»: sin contacto`);
  }
  // Lo que un negocio apagó sigue apagado (el respaldo manda en lo que nadie tocó).
  const sinIngreso = fichaEfectiva('evento', {}, { resumen: { ingreso: false, web: false, instagram: false }, apagados: [] }).tabs.resumen;
  assert.ok(!sinIngreso.some((b) => b.id === 'ingreso-estimado' || b.id === 'redes-y-web'));
});

test('de dónde vino, en una línea: el canal, la fuente y el camino entero del anuncio', () => {
  const o = origenDelLead({ origen_lead: 'landing', utm_source: 'ig', meta_campaign_name: 'Verano', meta_adset_name: 'Dueños MX', meta_ad_name: 'Video 2' }, {})!;
  assert.deepEqual(lineaDeOrigen(o), ['Instagram', 'Verano › Dueños MX › Video 2']);
  assert.deepEqual(lineaDeOrigen(origenDelLead({ origen_lead: 'carga_manual' }, {})!), [], 'sin fuente ni anuncio, sólo el canal');
  const src = sinComentarios(leer('app/crm/lead-view/ficha/resumen/origen.tsx'));
  const linea = src.slice(src.indexOf("if (diseno === 'linea' && !epico)"), src.indexOf('return (\n    <Bloque titulo={titulo} epico={epico} derecha={ads}>'));
  assert.match(linea, /lineaDeOrigen\(o\)/, '«Una línea» dibuja la línea entera, no sólo el anuncio');
});

test('«Deshacer» de un campo: compara lo que hay HOY con lo que él escribió, con la normalización del guardado', () => {
  // El escenario: Ana pone a Martín de setter; en los 5 s del aviso Pedro lo cambia; el Deshacer de Ana no lo pisa.
  assert.equal(mismoValorDeCampo('setter', 'Pedro', 'Martín'), false);
  assert.equal(mismoValorDeCampo('setter', ' Martín ', 'Martín'), true);
  assert.equal(mismoValorDeCampo('calificado', null, true), false);
  assert.equal(mismoValorDeCampo('calificado', true, true), true);
  // Las fechas: la columna puede volver con hora; el monto, como texto de la base.
  assert.equal(mismoValorDeCampo('fecha_junta_1', '2026-10-16T00:00:00+00:00', '2026-10-16'), true);
  assert.equal(mismoValorDeCampo('fecha_junta_1', '2026-10-17', '2026-10-16'), false);
  assert.equal(mismoValorDeCampo('ingreso_estimado', '15000.00', 15000), true);
  assert.equal(mismoValorDeCampo('ingreso_estimado', null, 15000), false);
  assert.equal(mismoValorDeCampo('motivo_perdida', '', null), true, 'vacío y sin dato son lo mismo');
  // Lo que hay hoy: la columna, o el link de SU reunión en `fathom_links`.
  assert.equal(valorGuardadoDeCampo('setter', { setter: 'Ana' }, etiquetaEsR2), 'Ana');
  const links = { fathom_links: [{ label: 'Reunión 1', url: 'https://fathom.video/1' }, { label: 'Reunión 2', url: 'https://fathom.video/2' }] };
  assert.equal(valorGuardadoDeCampo('fathom_r2', links, etiquetaEsR2), 'https://fathom.video/2');
  assert.equal(valorGuardadoDeCampo('fathom_r1', links, etiquetaEsR2), 'https://fathom.video/1');
  assert.equal(valorGuardadoDeCampo('fathom_r1', {}, etiquetaEsR2), null);
  // Los datos de contacto (`saveLeadMeta`): recorta y corta a 300 los de texto largo, como al guardar.
  assert.deepEqual([...CAMPOS_CONTACTO].sort(), ['direccion', 'email', 'empresa', 'linkedin', 'sexo', 'telefono', 'web', 'youtube']);
  assert.equal(mismoDatoDeContacto('email', 'otra@x.com', 'ana@x.com'), false);
  assert.equal(mismoDatoDeContacto('email', null, ''), true);
  assert.equal(mismoDatoDeContacto('direccion', 'x'.repeat(300), ` ${'x'.repeat(400)}`), true);
});

test('CABLEADO del Deshacer: los dos guardados del Resumen deshacen con lo que escribieron, y el server corta antes', () => {
  const campo = sinComentarios(leer('app/crm/lead-view/CampoEditable.tsx'));
  assert.match(campo, /deshacerCampoLeadAction\(leadId, campo, antes, nuevo\)/, 'useGuardarCampo deshace a ciegas');
  const piezas = sinComentarios(leer('app/crm/lead-view/ficha/resumen/piezas.tsx'));
  assert.match(piezas, /deshacerContactoLeadAction\(leadId, campo, antes, nuevo\)/, 'useGuardarMeta deshace a ciegas');
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  for (const [nombre, compara, escribe] of [
    ['deshacerCampoLeadAction', 'mismoValorDeCampo(', 'guardarCampoLeadAction('],
    ['deshacerContactoLeadAction', 'mismoDatoDeContacto(', 'saveLeadMetaAction('],
  ] as const) {
    const i = acc.indexOf(`export async function ${nombre}(`);
    assert.ok(i > 0, `falta ${nombre}`);
    const cuerpo = acc.slice(i, acc.indexOf('\nexport ', i + 10));
    const orden = ['getUsuarioActual(', 'getLead(', compara, escribe].map((x) => cuerpo.indexOf(x));
    assert.ok(orden.every((x) => x > 0), `${nombre}: le falta un paso (${orden.join(', ')})`);
    assert.deepEqual([...orden].sort((a, b) => a - b), orden, `${nombre}: sesión → leer → comparar → escribir, en ese orden`);
  }
});

test('cómo se ven: la fila de propiedad decide por SU ancho, y los tres botones reparten por su texto', () => {
  // Rótulo arriba cuando la FILA es angosta (un bloque de ½ en la tablet), no cuando la VENTANA lo es.
  assert.match(CSS_RESUMEN, /\.fr-k \{[^}]*flex: 0 1 calc\(\(\d+px - 100%\) \* 999\)/);
  assert.match(CSS_RESUMEN, /\.fr-prop \{[^}]*display: flex; flex-wrap: wrap;/);
  assert.match(CSS_RESUMEN, /\.fr-seg--llena > button \{[^}]*flex: 1 1 auto;/);
  // El motivo de salida se CORRIGE como texto; los chips son del wizard de la etapa (decisión del 12/10/2026).
  for (const p of PLANTILLAS_TAB_RESUMEN) {
    const m = p.bloques.find((b) => b.id === 'motivo-de-salida');
    if (m) assert.notEqual(m.diseno, 'chips', `«${p.id}» pone los chips del motivo de entrada`);
  }
});
