// =============================================================================
// El onboarding sin el análisis de Offer: pregunta qué vende y lo deja ordenado en un PDF
// =============================================================================
// Martín (16/10/2026 a la tarde, docs/feedback-16-10-crm-onboarding-second-brain.md → Onboarding): «Sería bueno
// que la funcionalidad de "OFFER" no esté en el onboarding, sino que ya luego del onboarding el usuario pueda ir a
// analizar su oferta allí... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo que
// vende el usuario. Y eso le sirve a MaKo para crear las cosas que necesite...».
//
// Lo que fija:
//   1. la conversación del onboarding pregunta SÓLO lo que vende (`PIEZAS_DEL_ARRANQUE`), con su propio prompt
//      (sin el marco del análisis, sin diagnóstico de fase, sin «Armar mi oferta»), y la tab sigue igual;
//   2. el servidor sólo la usa con `origen: 'arranque'` Y el onboarding pendiente, y nunca ofrece armar;
//   3. la pantalla ya no arma la oferta por detrás;
//   4. el PDF «Lo que vendes»: las palabras del dueño en orden, sin puntaje ni propuesta, servido por la ruta del
//      PDF de Offer con su mismo gate;
//   5. el cierre deja el producto con lo que vende aunque no haya oferta armada.
// Las etapas y los mensajes del arranque están en tests/onboarding-arranque.test.ts.
//
// Correr: npx tsx --test tests/onboarding-lo-que-vende.test.ts
//
// PROBADO ROMPIÉNDOLO el 17/10/2026 (arnés romper-lo-que-vende.mjs en el scratchpad, restaura de memoria), junto con
// tests/onboarding-arranque.test.ts. Base: 31 pasan, 0 fallan (pasa/falla):
//   - el onboarding vuelve a preguntar «ventas»                     → 29/2
//   - lo que falta vuelve a ser la lista entera de piezas           → 30/1
//   - el prompt del onboarding vuelve a llevar el marco             → 30/1
//   - el servidor usa el modo del onboarding sin mirar si sigue     → 30/1
//   - la fase vuelve a preguntarse adentro de la conversación       → 30/1
//   - se ofrece «Armar mi oferta» en el onboarding                  → 30/1
//   - el reintento del turno sin `origen`                           → 30/1
//   - vuelve el riel (con su «Armar mi oferta»)                     → 30/1
//   - el PDF trata «sin dato: …» como un dato                       → 30/1
//   - el PDF de lo que vende pide una oferta armada                 → 30/1
//   - el cierre exige la oferta armada para dejar el producto       → 30/1
//   - los hechos miden las piezas MÍNIMAS (las del análisis)        → 30/1
//   - el arranque se saltea el diagnóstico de fase                  → 29/2
//   - falta el mensaje con el PDF                                   → 29/2

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PIEZAS_DEL_ARRANQUE, PIEZAS_MINIMAS, faltanDelArranque, type PiezasSabidas } from '../lib/offer-marco';
import { guiaDelArranque, faltanDelArranqueParaPrompt, mensajeDeMako, OPCION_ARMAR } from '../lib/offer-reglas';
import { apartadosLoQueVendes, pdfDeLoQueVendes, nombreArchivoLoQueVendes } from '../lib/lo-que-vendes-pdf';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const funcion = (src: string, nombre: string) => {
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `no encuentro ${nombre}`);
  return src.slice(i, src.indexOf('\n}\n', i));
};
const v = (valor: string) => ({ valor, fuente: 'chat' as const, at: '2026-10-17' });

async function textoPdf(bytes: Uint8Array): Promise<string> {
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: true });
  return Array.isArray(text) ? text.join('\n') : text;
}

test('lo que pregunta el onboarding: qué es, para quién, qué resuelve, qué logra y cuánto cuesta; nada del análisis', () => {
  assert.deepEqual([...PIEZAS_DEL_ARRANQUE].sort(), ['cliente', 'entregables', 'precio', 'problema', 'resultado']);
  for (const k of PIEZAS_DEL_ARRANQUE) assert.ok(PIEZAS_MINIMAS.includes(k), `${k} no es mínima: la tab la volvería a pedir`);
  for (const k of ['ventas', 'prueba', 'valor', 'costo', 'escalera', 'otras'] as const) {
    assert.ok(!PIEZAS_DEL_ARRANQUE.includes(k), `el onboarding volvió a preguntar «${k}», que es del análisis`);
  }
  assert.deepEqual(faltanDelArranque({}), [...PIEZAS_DEL_ARRANQUE]);
  // «sin dato» cuenta como contestada: la persona ya dijo que no lo sabe.
  const todas: PiezasSabidas = Object.fromEntries(PIEZAS_DEL_ARRANQUE.map((k) => [k, v(k === 'precio' ? 'sin dato: no lo tiene definido' : 'algo')]));
  assert.deepEqual(faltanDelArranque(todas), []);
  // La guía y lo que falta, sólo de esas piezas.
  const guia = guiaDelArranque();
  assert.equal(guia.split('\n').length, PIEZAS_DEL_ARRANQUE.length);
  assert.doesNotMatch(guia, /\[(ventas|prueba|garantia|otras|valor|costo)\]/);
  assert.doesNotMatch(faltanDelArranqueParaPrompt({ entregables: v('Mentoría') }), /entregables|garantia|ventas/);
  assert.match(faltanDelArranqueParaPrompt(todas), /ya sabes lo que vende/);
});

test('el prompt del onboarding: sin el marco del análisis, sin diagnóstico, sin armar; y sólo cuando la pantalla lo pide', () => {
  const IA = leer('lib/offer-ia.ts');
  const i = IA.indexOf('export const OFFER_ARRANQUE_SYSTEM_TEMPLATE = `');
  assert.ok(i > 0, 'falta el prompt del onboarding');
  const tpl = IA.slice(i, IA.indexOf('`;', i));
  assert.doesNotMatch(tpl, /\{\{marco\}\}/, 'el onboarding volvió a llevar el marco (la rúbrica del análisis)');
  assert.match(tpl, /NO analizas su oferta/);
  assert.match(tpl, /"diagnostico": null y "diagnostico_respuesta": null, siempre/);
  assert.doesNotMatch(tpl, /Armar mi oferta/);
  const turno = sinComentarios(funcion(IA, 'turnoOffer'));
  assert.match(turno, /p\.arranque\s*\?\s*await renderPrompt\('offer\.arranque\.system', OFFER_ARRANQUE_SYSTEM_TEMPLATE,/);
  assert.match(turno, /faltan: p\.arranque \? faltanDelArranqueParaPrompt\(p\.piezas\) : b\.faltan/);
});

test('la ruta de Offer: el turno del onboarding sólo con `origen: arranque` y el onboarding pendiente, sin fase y sin «Armar»', () => {
  const RUTA = sinComentarios(leer('app/api/offer/route.ts'));
  const del = funcion(RUTA, 'delArranque');
  assert.match(del, /body\.origen === 'arranque' && \(await onboardingPendiente\(\)\.catch\(\(\) => false\)\)/);
  const resp = funcion(RUTA, 'responder');
  assert.match(resp, /const plan: PlanDiagnostico = p\.arranque\s*\?\s*\{ modo: 'no' \}/, 'el onboarding volvió a preguntar la fase adentro de la conversación');
  assert.match(resp, /const puede = !p\.arranque && faltanMinimas\(piezas\)\.length === 0;/, 'el onboarding ofrece «Armar mi oferta»');
  assert.match(resp, /voz: ctx\.voz, arranque: p\.arranque,/);
  // Los dos caminos del turno (el mensaje y el reintento) lo pasan.
  assert.equal((RUTA.match(/arranque: await delArranque\(body\)/g) ?? []).length, 2);
  // Y la pantalla lo pide en los dos.
  const APP = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.equal((APP.match(/\.\.\.\(arranque \? \{ origen: 'arranque' \} : \{\}\)/g) ?? []).length, 2);
  assert.doesNotMatch(APP, /arranque\?\.armar\b/, 'la pantalla volvió a armar la oferta por detrás');
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /conRiel: false,/, 'volvió el riel con su «Armar mi oferta»');
});

test('sin «puede concluir», el mensaje de MaKo no ofrece armar aunque el modelo lo haya puesto', () => {
  const m = mensajeDeMako({
    turno: { respuesta: 'Listo, ya entendí lo que vendes.', opciones: [OPCION_ARMAR], piezas: {}, listo: true, diagnostico: null, diagnosticoRespuesta: null },
    plan: { modo: 'no' }, piezas: {}, puedeConcluir: false, id: 'x', at: '2026-10-17',
  });
  assert.ok(!(m.opciones ?? []).includes(OPCION_ARMAR), 'el onboarding ofreció «Armar mi oferta»');
});

test('el PDF «Lo que vendes»: las palabras del dueño en orden, lo que falta dicho, y nada del análisis', async () => {
  const piezas: PiezasSabidas = {
    precio: v('USD 1.500 en dos pagos'),
    entregables: v('Una mentoría de 12 semanas, 1 a 1'),
    cliente: v('Dueños de clínicas dentales'),
    problema: v('sin dato: no sabe decirlo'),
    garantia: v('Si no agenda 10 pacientes, sigue gratis'),
  };
  const ap = apartadosLoQueVendes(piezas);
  // Primero las del onboarding en su orden (aunque falten), después lo que contó de más.
  assert.deepEqual(ap.map((a) => a.pieza), ['entregables', 'cliente', 'problema', 'resultado', 'precio', 'garantia']);
  assert.equal(ap.find((a) => a.pieza === 'problema')?.sinDato, true);
  assert.equal(ap.find((a) => a.pieza === 'problema')?.texto, 'no sabe decirlo');
  assert.equal(ap.find((a) => a.pieza === 'resultado')?.sinDato, true);
  const txt = await textoPdf(pdfDeLoQueVendes(piezas, { negocio: 'Clínica Sonrisa', fecha: new Date('2026-10-17T12:00:00Z') }));
  assert.match(txt, /Lo que vende Clínica Sonrisa/);
  for (const frase of ['Una mentoría de 12 semanas, 1 a 1', 'Dueños de clínicas dentales', 'USD 1.500 en dos pagos', 'Si no agenda 10 pacientes, sigue gratis']) {
    assert.ok(txt.includes(frase), `el PDF perdió «${frase}»`);
  }
  assert.match(txt, /Todavía no me lo contaste/);
  assert.doesNotMatch(txt, /PUNTAJE|\/100|La propuesta que te armo|Lista para vender/, 'el PDF del onboarding trae el análisis');
  assert.equal(nombreArchivoLoQueVendes('Clínica Sonrisa'), 'lo-que-vende-clinica-sonrisa.pdf');
  assert.equal(nombreArchivoLoQueVendes(''), 'lo-que-vendes.pdf');
});

test('la ruta del PDF: el de lo que vende va con el mismo gate y no pide una oferta armada', () => {
  const ruta = sinComentarios(leer('app/api/offer/pdf/route.ts'));
  const iGate = ruta.indexOf('await adminDeWorkspaceActual()');
  const iTipo = ruta.indexOf("if (loQueVendes) {");
  const iConclusion = ruta.indexOf('if (!fila.conclusiones.length)');
  assert.ok(iGate > 0 && iTipo > iGate && iConclusion > iTipo, 'el PDF de lo que vende quedó detrás del «todavía no tiene conclusión», o antes del gate');
  assert.match(ruta, /pdfDeLoQueVendes\(fila\.piezas,/);
});

test('el cierre: el producto sale de lo que vende aunque no haya oferta armada, y la oferta sólo si la hay', () => {
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(server, /loQueVende: !!sesion && faltanDelArranque\(sesion\.piezas\)\.length === 0,/);
  const i = server.indexOf('export async function cerrarArranque');
  const cerrar = server.slice(i, server.indexOf('export function tipoValido', i));
  assert.match(cerrar, /if \(h\.modo === 'oferta' && piezas && e\.sesionId\) \{/, 'sin oferta armada, el cierre no deja el producto');
  assert.match(cerrar, /if \(propuesta\) await guardarComoOferta\(e\.sesionId\);/, 'el cierre intenta guardar una oferta que no se armó');
});
