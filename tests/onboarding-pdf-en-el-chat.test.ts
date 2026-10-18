// =============================================================================
// «Lo que vendes» se mira EN el chat, del negocio que se está mirando (18/10/2026)
// =============================================================================
// Martín, probando el ws 3 como administrador: «Ver lo que vendes (PDF)» abría /api/offer/pdf?id=10&tipo=lo-que-vendes en
// OTRA pestaña y contestaba {"ok":false,"error":"No encontré esa oferta."}; «ni siquiera debería sacarme de la tab».
// MEDIDO (sólo lectura): la conversación 10 es del ws 3. El link no llevaba el `?ws=`, y para el super admin el workspace
// sale de la pestaña: la ruta la buscaba en otro. Y un `<iframe>` con el PDF no sirve: la app manda X-Frame-Options DENY.
// Ahora las páginas llegan como imágenes (`vista=paginas`, por fetch, que lleva el ?ws=) en un modal del chat, y la
// descarga lleva el `?ws=` a mano.
//
// ROTURAS (18/10/2026, arnés romper-pdf.js del scratchpad; base 3 / 0): vuelve el link a otra pestaña → 2 / 1 · la
// descarga sin el ?ws= → 2 / 1 · la ruta sin las páginas de «lo que vendes» → 2 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { paginasLoQueVendes, apartadosLoQueVendes } from '../lib/lo-que-vendes-pdf';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el PDF se mira en un modal del chat, no en otra pestaña, y la descarga lleva el ?ws=', () => {
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  const i = chat.indexOf('function TarjetaPdf(');
  const tarjeta = chat.slice(i, chat.indexOf('\n}\n', i));
  assert.doesNotMatch(tarjeta, /target="_blank"/, 'el PDF vuelve a sacar de la pestaña');
  assert.match(tarjeta, /<VisorPdf sesionId=\{sesionId\} url=\{conWs\(linkPdfLoQueVende\(sesionId\), ws\)\} onCerrar=/, 'sin el ?ws=, el super admin no encuentra la conversación');
  // 18/10/2026 (punto 6, «mira cómo se bugea la preview del PDF»): el Modal quedaba dentro de la capa del chat, tapado por
  // las respuestas rápidas. El visor va por portal a <body>, encima de la capa (z 100) y debajo de la barra (z 300).
  // Roturas (romper-visor.js; base 3/0): sin el portal → 2/1 · z por debajo de la capa → 2/1 · vuelven las marcas → 2/1.
  const j = chat.indexOf('function VisorPdf(');
  const visor = chat.slice(j, chat.indexOf('\n}\n', j));
  assert.match(visor, /return createPortal\(/, 'el visor vuelve a quedar dentro de la capa del chat');
  assert.match(visor, /<VistaPdf sesionId=\{sesionId\} tipo="lo-que-vendes" \/>/);
  assert.match(visor, /href=\{url\} download/);
  const z = Number(/\.arr-visor \{[^}]*z-index: (\d+);/.exec(chat)?.[1]);
  assert.ok(z > 100 && z < 300, `el visor (z ${z}) tiene que ir encima de la capa (100) y debajo de la barra de inspección (300)`);
});

test('la ruta da las páginas de «lo que vendes», y son las mismas del PDF', () => {
  const ruta = sinComentarios(leer('app/api/offer/pdf/route.ts'));
  const i = ruta.indexOf('if (loQueVendes) {');
  assert.match(ruta.slice(i, i + 900), /if \(vistaPaginas\) return Response\.json\(\{ ok: true, paginas: paginasLoQueVendes\(fila\.piezas, metaLqv\) \}/);
  assert.match(sinComentarios(leer('app/offer/offer-api.ts')), /const base = tipo \? `\/api\/offer\/pdf\?id=\$\{sesionId\}&tipo=\$\{tipo\}` : urlPdf\(sesionId, version\);/);
  const v = (valor: string) => ({ valor, fuente: 'chat' as const, at: '2026-10-18' });
  const paginas = paginasLoQueVendes({ entregables: v('Mentoría de 12 semanas'), precio: v('3 cuotas de USD 500') }, { negocio: 'Consultesis', fecha: new Date('2026-10-18T15:00:00Z') });
  assert.ok(paginas.length >= 1 && paginas.every((p) => p.startsWith('<svg')), 'las páginas no salen como SVG');
  // Sin las marcas de procedencia que copia la IA (captura de Martín del 18/10: «Consultores… [de: chat]»).
  const ap = apartadosLoQueVendes({ cliente: v('Consultores y agencias [de: chat]'), entregables: v('Plan de trabajo [DE: doc]') });
  assert.equal(ap.find((a) => a.pieza === 'cliente')?.texto, 'Consultores y agencias');
  assert.equal(ap.find((a) => a.pieza === 'entregables')?.texto, 'Plan de trabajo');
});

test('el visor de Offer sirve para los dos documentos', () => {
  const vista = sinComentarios(leer('app/offer/VistaPdf.tsx'));
  assert.match(vista, /export function VistaPdf\(\{ sesionId, version = null, tipo \}/);
  assert.match(vista, /paginasPdf\(sesionId, version, tipo\)/);
});
