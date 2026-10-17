// =============================================================================
// Offer: cada número del diagnóstico dice de dónde sale, o no aparece (tarjeta #888, 17/10/2026)
// =============================================================================
// Revisión de MaKo con Código Inmobiliario (16/10/2026, Fathom 193666833, 01:48:49). Martín, leyendo el diagnóstico:
// «no, 43, ¿de dónde sacó ese número?». Era «Cierras el 43% de todas las llamadas»: 9 cierres del período sobre 21
// asistencias del período (ws13, últimos 90 días), y 4 de esas 9 ventas nunca pasaron por una llamada. De los 21 que
// asistieron compraron 6; de los 13 calificados, 6. La IA lo repitió en un cambio («Cierras el 43% de las llamadas
// asistidas») y en la mejora de Precio y cobro. Lo de acá fija:
//   1. el embudo en cuentas de la MISMA gente, y cada aviso con su fuente («tu CRM, del 19/07 al 16/10»);
//   2. lo que escribe la IA, cifra por cifra: la del dueño queda, la del sistema lleva su fuente, la inventada saca
//      la frase (y en una propuesta, sólo si la afirma sobre el negocio de hoy);
//   3. lo ya guardado (la conversación 8 del ws13) se muestra sin los avisos de entonces ni las frases que los repiten;
//   4. el puntaje dice de dónde sale, en la pantalla y en el PDF.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (17/10/2026, arnés romper-888.mjs en el scratchpad de la sesión: rompe UNA cosa,
// corre este archivo y restaura DE MEMORIA). La base en verde (5 de 5); 15 roturas, las 15 cazadas; los números, al
// lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DIMENSION_IDS, FUENTE_PUNTAJE, type ConclusionOferta, type DiagnosticoOferta, type NotaDimension, type PiezasSabidas } from '../lib/offer-marco';
import {
  FUENTE_CRM, FUENTE_MARGEN, alertasEmbudo, alertasPrecio, cifrasConFuente, cifrasConPorcentaje, cifrasDelNegocio, conclusionParaMostrar, conclusionVisible,
  diagnosticoConFuentes, embudoDeAnalisis, embudoParaPrompt, textoConFuentes,
  type EmbudoOffer, type FuentesDeCifras,
} from '../lib/offer-reglas';
import { pdfDeOferta } from '../lib/offer-pdf';

const AT = '2026-10-16T22:48:59.561Z';
const pieza = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });

/** El análisis del ws13 del 16/10/2026 (medido en prod, sólo lectura): lo que de él usa Offer. */
const ANALISIS_WS13 = {
  periodo: { desde: '2026-07-19', hasta: '2026-10-16' },
  serie: [
    { agendas_creadas: 28, j1_noshow: 12, j1_sin_marcar: 6 },
    { agendas_creadas: 32, j1_noshow: 10, j1_sin_marcar: 7 },
  ],
  calificacion: { asistieron: 21, calificados: 13, sin_marcar: 2, compraron: 6, compraron_calificados: 6 },
};

/** Las piezas de esa conversación que tienen cifras. */
const PIEZAS_WS13: PiezasSabidas = {
  precio: pieza('1.900 USD (Plan Implementación 3 meses) o 8.000 USD (Plan Anual)'),
  costo: pieza('Menos de 200 USD por cliente en entregables y herramientas'),
  prueba: pieza('Entre 4 y 10 clientes ya pagaron y lograron un promedio de 3 a 5 captaciones extra por mes.'),
  garantia: pieza('100 leads calificados en 120 días'),
  cobro: pieza('50% al iniciar y 50% a los 45 días'),
};

// rotura (`embudoDeAnalisis` con las ventas del período, 9, y no las de esa gente): 3 fallos, 2 pases.
// rotura (`cierreDelEmbudo` sin preferir a los calificados): 1 fallo, 4 pases.
// rotura (la asistencia sobre las agendas en vez de las llamadas marcadas): 2 fallos, 3 pases.
test('1 · el embudo del ws13 en cuentas de la misma gente: nunca «43%», y cada aviso dice de dónde sale', () => {
  const e = embudoDeAnalisis(ANALISIS_WS13);
  assert.ok(e, 'el análisis del ws13 arma el embudo');
  assert.deepEqual(e.llamadas, { asistieron: 21, noAsistieron: 22, sinMarcar: 13 });
  const avisos = [...alertasEmbudo(e), ...alertasPrecio({ cobro: 50, embudo: e })];
  for (const a of avisos) assert.doesNotMatch(a, /\b43\s?%/, `el 43% del período no vuelve: ${a}`);
  assert.deepEqual(alertasEmbudo(e), [
    'De 43 primeras llamadas con la asistencia marcada (tu CRM, del 19/07 al 16/10; 13 sin marcar no cuentan), vinieron 21: el 49%. Lo sano es de 60% a 80%: las ventas se cortan antes de la llamada; antes de cambiar la oferta, revisa cómo se confirman las agendas.',
  ]);
  assert.deepEqual(alertasPrecio({ cobro: null, embudo: e }), [
    'De las 13 personas calificadas que asistieron a la primera llamada (tu CRM, del 19/07 al 16/10), compraron 6: el 46%. Más de 30% es señal de que hay margen para subir el precio.',
  ]);
  // El prompt lee las MISMAS cuentas, con la fuente.
  const md = embudoParaPrompt(e);
  assert.match(md, /^Fuente: tu CRM, del 19\/07 al 16\/10\./);
  assert.match(md, /Compraron 6 de las 21 que asistieron \(6 de las 13 calificadas\)/);
  assert.doesNotMatch(md, /43\s?%/);
  // Un análisis de antes (sin las compras de esa gente) no arma un embudo: no hay de dónde afirmar un cierre.
  assert.equal(embudoDeAnalisis({ ...ANALISIS_WS13, calificacion: { asistieron: 21, calificados: 13, sin_marcar: 2 } }), null);
  assert.equal(embudoParaPrompt(null), '');
});

/** Un pedazo de la transcripción que el dueño del ws13 subió como documento: sus horas no son cifras del negocio. */
const TRANSCRIPCION = '0:04:37 Cristian Garcia Cabral: ¿Qué haces?\n0:04:43 Cristian Garcia Cabral: Vos me sorprendiste con un equipo completo.\n0:26:43 Joan Dowd: Un minuto. 0:36:12 Joan: dale, el 16/10 te escribo.';

const FUENTES_WS13 = (): FuentesDeCifras => {
  const e = embudoDeAnalisis(ANALISIS_WS13) as EmbudoOffer;
  const avisos = [...alertasEmbudo(e), ...alertasPrecio({ cobro: 50, embudo: e })];
  return {
    delNegocio: cifrasConPorcentaje([...Object.values(PIEZAS_WS13).map((p) => p?.valor), 'Entre 4 y 10 clientes', 'Menos de 200 USD por cliente', TRANSCRIPCION]),
    conFuente: cifrasConFuente(e, PIEZAS_WS13),
    deLosAvisos: cifrasConPorcentaje(avisos),
  };
};

// rotura (`textoConFuentes` sin sacar la frase con una cifra sin fuente): 2 fallos, 3 pases.
// rotura (sin la fuente al lado de la cifra del CRM): 1 fallo, 4 pases.
// rotura (`medicionesDe` revisando también los números chicos): 1 fallo, 4 pases (cae «1 a 1» y «5 filtros»).
// rotura (un porcentaje y un conteo con la misma clave: «43 llamadas» le daba fuente a «43%»): 3 fallos, 2 pases.
// rotura (las horas de un documento contadas como cifras del dueño): 1 fallo, 4 pases.
// rotura (un número del dueño dándole fuente a un porcentaje): 3 fallos, 2 pases.
test('2 · lo que escribe la IA: la cifra del dueño queda, la del sistema lleva su fuente, la inventada saca la frase', () => {
  const f = FUENTES_WS13();
  // El dueño: queda tal cual.
  assert.equal(textoConFuentes('«1.900 USD (Plan Implementación 3 meses)» con un 50% de cobro al iniciar.', f), '«1.900 USD (Plan Implementación 3 meses)» con un 50% de cobro al iniciar.');
  // El sistema: la fuente al lado, una sola vez por texto.
  assert.equal(
    textoConFuentes('Cierras el 46% de las llamadas calificadas, lo que da margen. Y el 46% es alto.', f),
    'Cierras el 46% (según tu CRM) de las llamadas calificadas, lo que da margen. Y el 46% es alto.',
  );
  assert.equal(textoConFuentes('Según tu CRM, asiste el 49% de las llamadas.', f), 'Según tu CRM, asiste el 49% de las llamadas.', 'si la frase ya lo dice, no se repite');
  // Inventada: el 43% del período, un LTV:CAC de nadie. La frase sale; las otras quedan.
  assert.equal(textoConFuentes('Cierras el 43% de las llamadas asistidas. La garantía es fuerte.', f), 'La garantía es fuerte.');
  assert.equal(textoConFuentes('El LTV supera 12 veces el costo.', f), '');
  // La estructura y las escalas no son datos: quedan.
  const estructura = 'Mentoría 1 a 1 con 5 filtros, en la Fase 1 (D7 saca 8 de 10), soporte 24/7 y resultados en 90 días.';
  assert.equal(textoConFuentes(estructura, f), estructura);
  // Una propuesta con su número queda; si AFIRMA un dato de hoy sin fuente, sale.
  assert.equal(textoConFuentes('Si elevas el plan a 2.490 USD, entonces mejorará la caja.', f, { propuesta: true }), 'Si elevas el plan a 2.490 USD, entonces mejorará la caja.');
  assert.equal(textoConFuentes('Dado que cierras el 43% de las llamadas, evalúa subir el ticket hacia los 2.500 USD.', f, { propuesta: true }), '');
  // Las horas y las fechas de un documento no son cifras del dueño (la transcripción del ws13 traía «0:04:43»), y un
  // número suyo no le da fuente a un porcentaje.
  assert.equal(f.delNegocio.has('43'), false);
  assert.equal(f.delNegocio.has('36'), false);
  assert.equal(f.delNegocio.has('50%'), true, 'el 50% del cobro sí lo dijo');
  assert.equal(cifrasConPorcentaje(['cerramos 30 por ciento']).has('30%'), true);
  assert.equal(cifrasDelNegocio([TRANSCRIPCION]).has('43'), false, 'tampoco para la propuesta');
  // El margen lo calcula el sistema con el precio y el costo del dueño.
  // (el precio de la pieza es el monto más alto, 8.000 USD, y el costo el primero, 200 USD: 98%)
  assert.equal(f.conFuente.get('98%'), FUENTE_MARGEN);
  assert.equal(f.conFuente.get('46%'), FUENTE_CRM);
  // «43 llamadas marcadas» es del CRM; «43%» no: un conteo no le da fuente a un porcentaje (el choque del ws13).
  assert.equal(f.conFuente.get('43'), FUENTE_CRM);
  assert.equal(f.conFuente.get('43%'), undefined);
});

const nota = (id: NotaDimension['id'], porque: string, mejora = ''): NotaDimension => ({ id, nota: 7, porque, mejora });

/** El diagnóstico que la IA le dejó al ws13 (conversación 8), con los textos que traían el 43 y el 36. */
function diagnosticoWs13(): DiagnosticoOferta {
  return {
    tesis: 'El embudo se corta drásticamente en la asistencia (solo asiste el 36% de los agendados); antes de culpar a la oferta, hay que arreglar los recordatorios.',
    fuerte: '«Entre 4 y 10 clientes ya pagaron la oferta»',
    fuertes: ['«Entre 4 y 10 clientes ya pagaron la oferta»'],
    dimensiones: DIMENSION_IDS.map((id) => (id === 'D7'
      ? nota('D7', '«1.900 USD (Plan Implementación 3 meses) o 8.000 USD (Plan Anual)» con un 50% de cobro al iniciar.', 'Dado que cierras el 43% de las llamadas, evalúa subir gradualmente el ticket de entrada hacia los 2.500 USD.')
      : nota(id, '«Entre 4 y 10 clientes ya pagaron»', 'Suma casos con nombre y apellido.'))),
    cambios: [
      { titulo: 'Automatizar la confirmación de agendas', porque: 'El show rate es de solo el 36%, lo que desperdicia más de la mitad de las reservas.', hipotesis: 'Si implementas recordatorios, entonces el show rate subirá por encima del 60%.' },
      { titulo: 'Incorporar urgencia real', porque: 'La oferta tiene ingreso abierto permanente.', hipotesis: 'Si limitas los cupos mensuales a 5 clientes, entonces aumentará la tasa de cierre.' },
      { titulo: 'Ajustar el precio de entrada al alza', porque: 'Cierras el 43% de las llamadas asistidas, lo que indica una alta demanda y margen claro para capturar más valor.', hipotesis: 'Si elevas el plan de 3 meses de 1.900 USD a 2.490 USD, entonces mejorarás la caja.' },
    ],
  };
}

// rotura (`diagnosticoConFuentes` leyendo la hipótesis como un dato y no como propuesta): 1 fallo, 4 pases (se cae la
// del 2.490 USD).
test('3 · un diagnóstico nuevo con los textos del ws13: ni el 43 ni el 36 quedan sin fuente, y lo propuesto se lee', () => {
  const d = diagnosticoConFuentes(diagnosticoWs13(), FUENTES_WS13());
  const todo = JSON.stringify(d);
  assert.doesNotMatch(todo, /\b43\s?%/, 'el 43% no tiene fuente');
  assert.doesNotMatch(todo, /\b36\s?%/, 'el 36% de las agendas tampoco (las llamadas marcadas dan 49%)');
  assert.equal(d.tesis, '', 'la tesis entera era la frase del 36%');
  assert.equal(d.cambios[2].porque, '');
  assert.equal(d.cambios[2].hipotesis, 'Si elevas el plan de 3 meses de 1.900 USD a 2.490 USD, entonces mejorarás la caja.');
  assert.equal(d.dimensiones.find((x) => x.id === 'D7')?.mejora, '');
  assert.equal(d.dimensiones.find((x) => x.id === 'D7')?.porque, '«1.900 USD (Plan Implementación 3 meses) o 8.000 USD (Plan Anual)» con un 50% de cobro al iniciar.');
  assert.equal(d.cambios[0].hipotesis, 'Si implementas recordatorios, entonces el show rate subirá por encima del 60%.', 'el 60% es del marco, y lo trae el aviso');
});

/** La conclusión GUARDADA del ws13 (sin `cifrasConFuente`), con sus avisos de entonces. */
function guardadaWs13(): ConclusionOferta {
  return {
    version: 1, at: AT, modelo: 'IA gratis del negocio',
    calculo: {
      total: 71, cuello: 'D8', lista: false,
      alertas: [
        'Tienes 3 productos activos y tu negocio factura menos de $10.000 al mes: en la fase 1 conviene empujar una sola oferta hasta tener un anuncio ganador.',
        'Asiste el 36% de los que agendan: por debajo de 60% (lo sano es de 60% a 80%). Las ventas se cortan antes de la llamada: antes de cambiar la oferta, revisa cómo se confirman las agendas.',
        'Cierras el 43% de todas las llamadas, y de las calificadas más: más de 30% es señal de que hay margen para subir el precio.',
      ],
    },
    diagnostico: diagnosticoWs13(),
    propuesta: {} as ConclusionOferta['propuesta'],
  };
}

// rotura (`conclusionParaMostrar` sin sacar los avisos viejos del embudo): 2 fallos, 3 pases (cae también el PDF).
// rotura (sin sacar las frases que los repiten): 2 fallos, 3 pases.
// rotura (la vista sin `conclusionVisible`): 1 fallo, 4 pases.
test('4 · lo ya guardado del ws13 se muestra sin el 43 ni el 36, sin tocar lo marcado ni lo que dijo el dueño', () => {
  const c = guardadaWs13();
  const v = conclusionParaMostrar(c, () => new Set());
  assert.deepEqual(v.calculo.alertas, [c.calculo.alertas[0]], 'queda el de foco; los dos del embudo de entonces no');
  const todo = JSON.stringify(v.diagnostico);
  assert.doesNotMatch(todo, /\b43\s?%/);
  assert.doesNotMatch(todo, /\b36\s?%/);
  assert.equal(v.diagnostico.cambios[2].hipotesis, c.diagnostico.cambios[2].hipotesis, 'lo que no repite el número queda');
  assert.equal(c.calculo.alertas.length, 3, 'no muta lo guardado');
  // Si el dueño dijo «43%», es suyo: la frase queda.
  const suyo = conclusionParaMostrar(c, () => new Set(['43%']));
  assert.match(JSON.stringify(suyo.diagnostico), /Cierras el 43% de las llamadas asistidas/);
  // Una conclusión con la marca nueva no se toca.
  const nueva = { ...c, calculo: { ...c.calculo, cifrasConFuente: true } };
  assert.equal(conclusionParaMostrar(nueva, () => new Set()), nueva);
  // `conclusionVisible` arma lo del dueño con la conversación: un «43%» suyo cuenta; las horas de su documento, no.
  const conMensaje = conclusionVisible(c, { piezas: {}, mensajes: [{ de: 'yo', texto: 'cerramos el 43% más o menos' }], documentos: [] });
  assert.match(JSON.stringify(conMensaje.diagnostico), /43%/);
  const conHoras = conclusionVisible(c, { piezas: {}, mensajes: [], documentos: [{ texto: TRANSCRIPCION }] });
  assert.doesNotMatch(JSON.stringify(conHoras.diagnostico), /\b43\s?%/, 'la transcripción con «0:04:43» no vuelve suyo el 43%');
  // Los tres lectores de lo guardado (la vista, que usan la pantalla, MaKo Mobile y la API de MaKo, y el PDF) pasan por ahí.
  const sesiones = readFileSync(new URL('../lib/offer-sesiones.ts', import.meta.url), 'utf8');
  assert.match(sesiones, /conclusion: f\.conclusiones\.length \? conclusionVisible\(f\.conclusiones\[f\.conclusiones\.length - 1\], f\) : null,/);
  const pdf = readFileSync(new URL('../app/api/offer/pdf/route.ts', import.meta.url), 'utf8');
  assert.match(pdf, /const conclusion = guardada \? conclusionVisible\(guardada, fila\) : null;/);
});

// rotura (el PDF sin la fuente del puntaje): 1 fallo, 4 pases. rotura (la pantalla sin ella): 1 fallo, 4 pases.
test('5 · el puntaje dice de dónde sale, en la pantalla y en el PDF', async () => {
  const pantalla = readFileSync(new URL('../app/offer/Conclusion.tsx', import.meta.url), 'utf8');
  const heroe = pantalla.slice(pantalla.indexOf('function Heroe('), pantalla.indexOf('// ── Las acciones'));
  assert.match(heroe, /<Anillo total=\{conclusion\.calculo\.total\} \/>\s*\{\/\*[^]*?\*\/\}\s*<span[^>]*>\{FUENTE_PUNTAJE\}<\/span>/);
  const c = conclusionParaMostrar(guardadaWs13(), () => new Set());
  const p: ConclusionOferta['propuesta'] = {
    nombre: 'Sistema', frase: 'Frase', mensajes: { corto: '', largo: '', entrada: '' }, paraQuien: { perfil: '', minimo: '', noEs: '' },
    problema: { hoy: '', despues: '', obstaculos: [], yaProbo: '' }, mecanismo: { nombres: [], pasos: [], distinto: '' }, ruta: [], incluye: [],
    formato: '', prueba: '', garantia: { nombre: '', condiciones: '', plazo: '', siNoCumple: '' }, bonos: [], inversion: { precio: '', contado: '', plan: '', valorTotal: '', comoDecirlo: '' },
    urgencia: '', escenarios: { mejor: '', peor: '' }, ecuacion: [], numeros: [], validar: [], siguiente: '', completar: [],
  } as unknown as ConclusionOferta['propuesta'];
  const bytes = pdfDeOferta({ ...c, propuesta: p }, { negocio: 'Código Inmobiliario', titulo: 'x', fecha: new Date(AT) });
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
  const texto = (Array.isArray(text) ? text.join('\n') : text).replace(/\s+/g, ' ');
  assert.ok(texto.includes(FUENTE_PUNTAJE), 'el PDF dice de dónde sale el puntaje');
  assert.doesNotMatch(texto, /\b43\s?%/, 'y el PDF de lo guardado no trae el 43%');
});
