// =============================================================================
// Offer: el Sprint de Mauricio — los números son de SU funnel, lo que vende se nombra y no hay «Zoom» que nadie dijo
// =============================================================================
// Llamada Mau <> Martín del 22/10/2026 (Fathom 195129619). Mauricio analizó en la tab Offer su oferta nueva, el
// «Sprint» (USD 270, taller en vivo de 3 días), y el diagnóstico dijo tres cosas falsas. Medido en su conversación
// (ws1, offer_sesiones id 18, sólo lectura):
//   O1 (01:42:50) «cuello de botella crítico en la conversión de llamadas (solo 2 ventas de 24 asistentes)» y el aviso
//      «De las 13 personas calificadas… compraron 2: el 15%». Eran del CRM ENTERO del ws1 (los 1.169 leads tienen
//      `funnel_id` NULL: son del funnel default). El Sprint (funnel 44) nació ese día y no tiene ninguno.
//   O2 (01:44:37) «Tienes 6 ofertas activas en MaKo». Las 6 filas activas de `ofertas` incluían 3 de prueba (dos con su
//      funnel archivado, una sin funnel). Vende 3.
//   O3 (01:43:55) «Tres sesiones en vivo de 2 horas por Zoom». Zoom lo sugirió MaKo en una opción; Mauricio eligió otra.
// Lo de acá fija los tres con esos datos.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-sprint.mjs en el scratchpad de la sesión: rompe UNA
// cosa, corre este archivo y restaura DE MEMORIA). La base en verde (12 de 12); 25 roturas, las 25 cazadas; los números,
// al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PiezasSabidas } from '../lib/offer-marco';
import {
  alertaFoco, alertaMargen, alertaSinDatos, alertasEmbudo, avisosAntesDelDiagnostico, cifrasConFuente, cifrasConPorcentaje, diagnosticoConFuentes,
  embudoDeAnalisis, embudoParaPrompt, embudoSinDatos, loQueVendeEnMako,
} from '../lib/offer-reglas';
import { conversacionSinHerramientasAjenas, herramientasDichas, sinHerramientasAjenas } from '../lib/offer-hechos';
import type { DiagnosticoOferta } from '../lib/offer-marco';

const AT = '2026-10-22T04:50:40.215Z';
const chat = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

/** Lo que devuelve `embudoDeFunnel` para el funnel 44 («Sprint 3 días»): ningún lead. */
const FUNNEL_SPRINT_VACIO = {
  periodo: { desde: '2026-07-25', hasta: '2026-10-22' },
  serie: [{ agendas_creadas: 0, j1_noshow: 0, j1_sin_marcar: 0 }],
  calificacion: { asistieron: 0, calificados: 0, sin_marcar: 0, compraron: 0, compraron_calificados: 0 },
};
/** Lo que el diagnóstico del 22/10 leyó: el ws1 entero (13 calificadas que asistieron, 2 compraron). */
const WS1_ENTERO = {
  periodo: { desde: '2026-07-25', hasta: '2026-10-21' },
  serie: [{ agendas_creadas: 40, j1_noshow: 9, j1_sin_marcar: 4 }],
  calificacion: { asistieron: 24, calificados: 13, sin_marcar: 6, compraron: 2, compraron_calificados: 2 },
};

/** Las piezas de Mauricio que mueven los avisos (textuales de la conversación 18). */
const PIEZAS_SPRINT: PiezasSabidas = {
  ventas: chat('0: aún no se ha lanzado ni promocionado'),
  precio: chat('Pago único de $270 USD vía Stripe'),
  otras: chat('2: mentoría grupal y programa principal Negocio que Escala (parte de la escalera del Sprint)'),
  formato: chat('Tres sesiones en vivo de 2 horas por Zoom, acceso a grabaciones, ejercicios y plantillas editables'),
};

// ── O1: los números salen del funnel de ESTA oferta, y una oferta sin datos lo dice ─────────────────────────────

// rotura (embudoSinDatos siempre false): 2 fallos. rotura (embudoParaPrompt sin la rama «sin datos»): 1 fallo.
// rotura (alertaSinDatos sin el caso del funnel vacío): 2 fallos.
test('O1 · el funnel del Sprint sin leads: el embudo lo dice, no da números, y el aviso nombra la oferta', () => {
  const e = embudoDeAnalisis(FUNNEL_SPRINT_VACIO, 'Sprint 3 días');
  assert.ok(e, 'unas cuentas en cero son un embudo válido');
  assert.equal(embudoSinDatos(e), true);
  const prompt = embudoParaPrompt(e);
  assert.match(prompt, /funnel «Sprint 3 días»/);
  assert.match(prompt, /NO tiene agendas, llamadas ni ventas/);
  assert.doesNotMatch(prompt, /Compraron|asistieron \d/, 'sin cuentas que la IA pueda repetir');
  const aviso = alertaSinDatos({ embudo: e, ventas: PIEZAS_SPRINT.ventas?.valor });
  assert.match(aviso ?? '', /^«Sprint 3 días» todavía no tiene agendas, llamadas ni ventas en tu CRM \(del 25\/07 al 22\/10\), y me dijiste que nadie la compró todavía: es una oferta sin datos de venta\./);
});

// rotura (el aviso «sin datos» fuera de avisosAntesDelDiagnostico): 1 fallo.
test('O1 · con el funnel del Sprint, los avisos no traen las 13 calificadas ni las 2 ventas del negocio entero', () => {
  const e = embudoDeAnalisis(FUNNEL_SPRINT_VACIO, 'Sprint 3 días');
  const { otras } = avisosAntesDelDiagnostico({ foco: { productosActivos: 0, ofertasActivas: 0, bandaFacturacion: 1 }, piezas: PIEZAS_SPRINT, embudo: e });
  assert.ok(otras.some((a) => a.startsWith('«Sprint 3 días» todavía no tiene')), otras.join(' | '));
  assert.ok(!otras.some((a) => /13 personas|compraron 2|24/.test(a)), otras.join(' | '));
  // El mismo aviso sin embudo, sólo con lo que dijo el dueño.
  assert.match(alertaSinDatos({ embudo: null, ventas: 'ninguna, aun no he lanzado' }) ?? '', /^Me dijiste que nadie compró esta oferta todavía/);
  assert.equal(alertaSinDatos({ embudo: null, ventas: '12 clientes' }), null);
});

// rotura (el embudo de un funnel sin el nombre en la fuente): 2 fallos.
// rotura (embudoSinDatos sin exigir funnel: el negocio entero en cero también «sin datos de la oferta»): 1 fallo.
test('O1 · cada número dice de qué funnel es; y un negocio entero sin datos no es «una oferta sin datos»', () => {
  const e = embudoDeAnalisis(WS1_ENTERO, 'Negocio que ESCALA');
  assert.match(alertasEmbudo(e).join(' '), /tu CRM, funnel «Negocio que ESCALA», del 25\/07 al 21\/10/);
  assert.equal(embudoSinDatos(embudoDeAnalisis(FUNNEL_SPRINT_VACIO, null)), false);
});

// rotura (la cifra sin fuente pasa en diagnosticoConFuentes): 1 fallo.
test('O1 · la tesis del 22/10 con el embudo del funnel: «2 ventas de 24 asistentes» ya no tiene fuente y no se muestra', () => {
  const e = embudoDeAnalisis(FUNNEL_SPRINT_VACIO, 'Sprint 3 días');
  const tesis = 'El embudo muestra un cuello de botella crítico en la conversión de llamadas (solo 2 ventas de 24 asistentes), por lo que antes de ajustar la oferta de entrada de $270 USD se debe revisar el proceso de cierre.';
  const diag: DiagnosticoOferta = {
    dimensiones: [], tesis, fuerte: '', fuertes: [],
    cambios: [{ titulo: 'Revisar el cierre', porque: 'De 24 asistentes a las llamadas solo compraron 2.', hipotesis: 'Si ajustas el guion, entonces la tasa de cierre sube.' }],
  };
  const out = diagnosticoConFuentes(diag, {
    delNegocio: cifrasConPorcentaje(['Pago único de $270 USD vía Stripe', 'ninguna, aun no he lanzado o promocionado', 'mas de 30']),
    conFuente: cifrasConFuente(e, PIEZAS_SPRINT),
    deLosAvisos: cifrasConPorcentaje([]),
  });
  assert.doesNotMatch(`${out.tesis} ${out.cambios.map((c) => c.porque).join(' ')}`, /24 asistentes/);
});

// rotura (costoDe sin mirar si es un presupuesto de anuncios): 1 fallo.
test('O1 · el presupuesto de anuncios no es el costo por cliente: sin «margen 0%» para el Sprint', () => {
  // La pieza tal como la anotó la IA, y lo que dijo Mauricio («invertir $3,000 usd en publicidad en Meta»).
  const precio = chat('Pago único de $270 USD vía Stripe');
  assert.equal(alertaMargen({ precio, costo: chat('Inversión en anuncios en Meta de $3,000 USD y tiempo del dueño para la sesión de consultoría individual de seguimiento') }), null);
  assert.equal(alertaMargen({ precio, costo: chat('Tenemos pensado invertir $3,000 usd en publicidad en Meta') }), null);
  // Con un costo POR CLIENTE, el aviso sigue (aunque nombre los anuncios).
  assert.match(alertaMargen({ precio, costo: chat('Unos 200 USD por participante entre anuncios y materiales') }) ?? '', /200 USD.*26%/);
});

// rotura (contextoOffer pide el análisis del negocio también con funnel): 1 fallo.
// rotura (embudoDeFunnel sin el filtro del funnel): 1 fallo. rotura (el default leído con su id en vez de NULL): 1 fallo.
test('O1 · cableado: con funnel, el embudo sale de embudoDeFunnel (sus leads); el default son los de funnel_id NULL', () => {
  const ctx = leer('lib/offer-contexto.ts');
  assert.match(ctx, /!conFunnel \? analisisNegocio\(/, 'el negocio entero, sólo sin funnel');
  assert.match(ctx, /embudoDeFunnel\(\{ funnelId: f\.esDefault \? null : f\.id, idDefault,/);
  assert.match(ctx, /if \(!f\) return null;/, 'un funnel que ya no está no cae al negocio entero');
  const an = leer('lib/analisis-negocio.ts');
  const cuerpo = an.slice(an.indexOf('export async function embudoDeFunnel'), an.indexOf('export async function embudoDeFunnel') + 4_000);
  assert.match(cuerpo, /q\.eq\('funnel_id', opts\.funnelId\)/);
  assert.match(cuerpo, /q\.is\('funnel_id', null\)/);
  assert.match(cuerpo, /funnel_id\.is\.null,funnel_id\.eq\.\$\{idDefault\}/);
});

// ── O2: lo que vende, contado por funnel activo y nombrado ─────────────────────────────────────────────────────

/** El ws1 al 22/10/2026 (medido): `leerFunnels` ya trae sólo los ACTIVOS (el 13 y el 14 están archivados). */
const WS1 = {
  funnels: [{ id: 1, nombre: 'Negocio que ESCALA' }, { id: 29, nombre: 'Renovación' }, { id: 44, nombre: 'Sprint 3 días' }],
  ligas: [
    { funnel_id: 1, oferta_id: 1, es_principal: true }, { funnel_id: 13, oferta_id: 3, es_principal: true },
    { funnel_id: 14, oferta_id: 4, es_principal: true }, { funnel_id: 29, oferta_id: 15, es_principal: true },
    { funnel_id: 44, oferta_id: 24, es_principal: false }, { funnel_id: 44, oferta_id: 23, es_principal: true },
  ],
  ofertas: [
    { id: 1, nombre: 'Negocio que Escala', activa: true }, { id: 3, nombre: 'Sistema DOS', activa: true },
    { id: 4, nombre: 'Prueba 2', activa: true }, { id: 6, nombre: 'Prueba 3', activa: true },
    { id: 15, nombre: 'Renovación', activa: true }, { id: 23, nombre: 'Sprint 3 días', activa: true },
    { id: 24, nombre: 'Sprint de Diseño para la Ejecución Empresarial', activa: true },
  ],
  ligasProducto: [{ oferta_id: 1, producto_id: 1 }, { oferta_id: 3, producto_id: 12 }, { oferta_id: 15, producto_id: 42 }, { oferta_id: 23, producto_id: 54 }],
  productos: [{ id: 1 }, { id: 12 }, { id: 13 }, { id: 42 }, { id: 54 }],
};

// rotura (contar `ofertas.activa` sin mirar el funnel): 2 fallos. rotura (contar ofertas en vez de funnels): 2 fallos.
// rotura (nombrar por el funnel en vez de por su oferta principal): 2 fallos.
test('O2 · el ws1 vende 3 (Negocio que Escala, Renovación y Sprint 3 días), no 6', () => {
  const v = loQueVendeEnMako(WS1);
  assert.ok(v);
  assert.deepEqual(v.nombres, ['Negocio que Escala', 'Renovación', 'Sprint 3 días']);
  assert.deepEqual([...v.ofertaIds].sort((a, b) => a - b), [1, 15, 23, 24]);
  assert.equal(v.productos, 3);
  assert.equal(loQueVendeEnMako({ ...WS1, ligas: null }), null, 'sin las ligas no se sabe');
});

// rotura (alertaFoco sin los nombres): 1 fallo. rotura (con un empate gana lo declarado): 1 fallo.
test('O2 · el aviso de foco nombra lo que cuenta; lo que dijo el dueño ya no dice «que no están cargadas en MaKo»', () => {
  const v = loQueVendeEnMako(WS1);
  const aviso = alertaFoco({ productosActivos: v?.productos ?? 0, ofertasActivas: v?.nombres.length ?? 0, bandaFacturacion: 1, otrasDeclaradas: 2, nombres: v?.nombres });
  assert.equal(aviso, 'Tienes 3 ofertas activas en tus funnels de MaKo («Negocio que Escala», «Renovación» y «Sprint 3 días»), y según tu diagnóstico de fase facturas menos de $10.000 al mes: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.');
  assert.match(alertaFoco({ productosActivos: 1, ofertasActivas: 1, bandaFacturacion: 1, otrasDeclaradas: 3 }) ?? '', /^Vendes 4 ofertas, según me dijiste, y/);
});

// rotura (el foco del contexto vuelve a contar `listaOfertas.length`): 1 fallo.
test('O2 · cableado: el foco y el bloque de ofertas del contexto salen de loQueVendeEnMako', () => {
  const ctx = leer('lib/offer-contexto.ts');
  assert.match(ctx, /foco: \{ productosActivos: vende\?\.productos \?\? 0, ofertasActivas: vende\?\.nombres\.length \?\? 0,/);
  assert.doesNotMatch(ctx, /TODAS LAS OFERTAS ACTIVAS DEL NEGOCIO \(\$\{listaOfertas\.length\}\)/);
});

// ── O3: lo que MaKo sugirió y el dueño no eligió no es un hecho ─────────────────────────────────────────────────

const CONVERSACION_18 = {
  mensajes: [
    { de: 'mako', texto: 'Para terminar de estructurar el «Sprint 3 días»: ¿es 100% en vivo por Zoom con las sesiones de dos horas, o incluye algún otro acompañamiento grabado?' },
    { de: 'yo', texto: 'En vivo más acceso a grabaciones y plantillas' },
    { de: 'yo', texto: 'Pago único de $270 USD vía Stripe' },
  ],
  documentos: [{ texto: 'Sprint de Ejecución Empresarial. Tres días en vivo: Dirección, Ejecución y Accountability.' }],
  piezas: PIEZAS_SPRINT,
  conclusiones: [{
    diagnostico: { dimensiones: [{ id: 'D6', nota: 7, porque: 'El formato de 3 sesiones en vivo por Zoom con grabaciones y plantillas es perfectamente escalable.', mejora: '' }] },
    propuesta: {
      formato: 'Tres sesiones 100% en vivo de 2 horas por Zoom los días 18, 19 y 20 de noviembre de 2026, con acceso a grabaciones.',
      incluye: [{ nombre: 'Sesiones en vivo', beneficio: 'Tres sesiones en vivo de 2 horas cada una impartidas por Mauricio Ejemplo vía Zoom.' }],
      inversion: { precio: '$270 USD, pago único vía Stripe' },
    },
  }],
  borrador: null,
};

// rotura (aFila sin conversacionSinHerramientasAjenas): 1 fallo. rotura (las piezas de la IA no se limpian): 1 fallo.
// rotura (la propuesta no se limpia a fondo): 1 fallo. rotura (los mensajes de MaKo cuentan como dichos): 1 fallo.
test('O3 · «por Zoom» sale de la pieza, el diagnóstico y la propuesta; Stripe queda (lo eligió él); la pregunta de MaKo, intacta', () => {
  const f = conversacionSinHerramientasAjenas(CONVERSACION_18);
  assert.equal(f.piezas.formato?.valor, 'Tres sesiones en vivo de 2 horas, acceso a grabaciones, ejercicios y plantillas editables');
  assert.equal(f.piezas.precio?.valor, 'Pago único de $270 USD vía Stripe');
  const c = f.conclusiones[0] as unknown as typeof CONVERSACION_18.conclusiones[0];
  assert.equal(c.diagnostico.dimensiones[0].porque, 'El formato de 3 sesiones en vivo con grabaciones y plantillas es perfectamente escalable.');
  assert.equal(c.propuesta.formato, 'Tres sesiones 100% en vivo de 2 horas los días 18, 19 y 20 de noviembre de 2026, con acceso a grabaciones.');
  assert.equal(c.propuesta.incluye[0].beneficio, 'Tres sesiones en vivo de 2 horas cada una impartidas por Mauricio Ejemplo.');
  assert.equal(c.propuesta.inversion.precio, '$270 USD, pago único vía Stripe');
  assert.match(f.mensajes[0].texto, /por Zoom/, 'lo que MaKo preguntó es historia');
  assert.ok(!JSON.stringify(f).replace(f.mensajes[0].texto, '').includes('Zoom'));
  assert.match(leer('lib/offer-sesiones.ts'), /return conversacionSinHerramientasAjenas\(\{/);
});

// rotura (un nombre alternativo no cuenta como dicho): 1 fallo. rotura (las piezas 'negocio' no cuentan como dichas): 1 fallo.
test('O3 · lo que sí dijo el negocio queda: «Meet» vale por «Google Meet», y lo cargado en MaKo cuenta', () => {
  const dichas = herramientasDichas(['Las clases son por Meet']);
  assert.equal(sinHerramientasAjenas('Clases en vivo por Google Meet y soporte por WhatsApp.', dichas), 'Clases en vivo por Google Meet y soporte.');
  const f = conversacionSinHerramientasAjenas({
    ...CONVERSACION_18,
    piezas: { ...PIEZAS_SPRINT, entregables: { valor: 'Acceso a la comunidad en Skool', fuente: 'negocio', at: AT } },
    conclusiones: [{ diagnostico: { tesis: 'La comunidad de Skool sostiene la entrega.' }, propuesta: {} }],
  });
  assert.equal((f.conclusiones[0].diagnostico as { tesis: string }).tesis, 'La comunidad de Skool sostiene la entrega.');
});

// rotura (sin la regla del turno): 1 fallo. rotura (sin la del diagnóstico): 1 fallo.
test('O1 · O3 · los prompts: no anotar lo que MaKo sugirió, ni culpar a un embudo que no es de esta oferta', () => {
  const ia = leer('lib/offer-ia.ts');
  assert.match(ia, /nunca lo que TÚ sugeriste en una pregunta o en una opción que no eligió/);
  assert.match(ia, /Los datos del embudo son SÓLO los del funnel de esta oferta/);
});
