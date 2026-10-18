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
import { paginasLoQueVendes } from '../lib/lo-que-vendes-pdf';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el PDF se mira en un modal del chat, no en otra pestaña, y la descarga lleva el ?ws=', () => {
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  const i = chat.indexOf('function TarjetaPdf(');
  const tarjeta = chat.slice(i, chat.indexOf('\n}\n', i));
  assert.doesNotMatch(tarjeta, /target="_blank"/, 'el PDF vuelve a sacar de la pestaña');
  assert.match(tarjeta, /<Modal titulo="Lo que vendes"[\s\S]*<VistaPdf sesionId=\{sesionId\} tipo="lo-que-vendes" \/>/);
  assert.match(tarjeta, /href=\{conWs\(linkPdfLoQueVende\(sesionId\), ws\)\} download/, 'sin el ?ws=, el super admin no encuentra la conversación');
});

test('la ruta da las páginas de «lo que vendes», y son las mismas del PDF', () => {
  const ruta = sinComentarios(leer('app/api/offer/pdf/route.ts'));
  const i = ruta.indexOf('if (loQueVendes) {');
  assert.match(ruta.slice(i, i + 900), /if \(vistaPaginas\) return Response\.json\(\{ ok: true, paginas: paginasLoQueVendes\(fila\.piezas, metaLqv\) \}/);
  assert.match(sinComentarios(leer('app/offer/offer-api.ts')), /const base = tipo \? `\/api\/offer\/pdf\?id=\$\{sesionId\}&tipo=\$\{tipo\}` : urlPdf\(sesionId, version\);/);
  const v = (valor: string) => ({ valor, fuente: 'chat' as const, at: '2026-10-18' });
  const paginas = paginasLoQueVendes({ entregables: v('Mentoría de 12 semanas'), precio: v('3 cuotas de USD 500') }, { negocio: 'Consultesis', fecha: new Date('2026-10-18T15:00:00Z') });
  assert.ok(paginas.length >= 1 && paginas.every((p) => p.startsWith('<svg')), 'las páginas no salen como SVG');
});

test('el visor de Offer sirve para los dos documentos', () => {
  const vista = sinComentarios(leer('app/offer/VistaPdf.tsx'));
  assert.match(vista, /export function VistaPdf\(\{ sesionId, version = null, tipo \}/);
  assert.match(vista, /paginasPdf\(sesionId, version, tipo\)/);
});
