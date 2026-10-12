// =============================================================================
// Offer: elegir un archivo NO lo sube ni lo lee; recién Enviar (con la vista previa de la casa)
// =============================================================================
// Pedido de Martín (11/10/2026): «Intenté subir un documento y saltó ese error. No se si apenas lo subí
// ya lo quiso analizar, eso estaría mal. Solo cuando le doy a ENVIAR debería... Sino, debería salir la
// vista previa del documento que acabo de subir, como lo tiene whatsapp». Hasta ese día `agregarArchivos`
// (app/offer/OfferApp.tsx) subía cada archivo (subir-url + PUT) y lo leía con IA ('leer') en el acto,
// para pintar un ✓ en un chip. Ahora:
//   · elegir (clip o soltar) sólo lo junta en la vista previa (app/whatsapp/_shared/VistaAdjuntos.tsx);
//   · Enviar sube y lee cada uno EN ORDEN (`leerAdjuntos`, app/offer/adjuntos-envio.ts), diciendo en cuál
//     va, y recién con todos leídos sale el 'turno' con los docIds y el texto;
//   · si una lectura falla, NO sale el turno, y al reintentar los ya leídos no se vuelven a leer.
// Lo de la vista en sí (y ChatHilo) lo fija tests/vista-adjuntos.test.ts.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, arnés en el scratchpad que rompe UNA cosa, corre este archivo y
// restaura DE MEMORIA; base 6 pases / 0 fallos). Las 8 roturas, cazadas:
//   O1 releer los ya leídos (`leerAdjuntos` sin la caché)              → 5/1
//   O2 guardar la respuesta de otra conversación (sin `vigente` al final) → 5/1
//   O3 `agregarArchivos` dispara el envío (leería al elegir)            → 5/1
//   O4 el turno sale aunque una lectura falle (sin el `return`)         → 5/1
//   O5 subir al elegir, como antes (`subirArchivo` en agregarArchivos)  → 4/2 (el de elegir y el conteo)
//   O6 vuelve el ✓ de «leído» al chip                                   → 5/1
//   O7 `enviarVista` sin la caché de docs leídos                        → 5/1
//   O8 el chat lee al soltar (`llamarOffer` en ChatOffer)               → 5/1
// Restaurado → 6/0.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { leerAdjuntos } from '../app/offer/adjuntos-envio';
import type { AdjuntoVista } from '../lib/offer-marco';

const RAIZ = join(__dirname, '..');
const leer = (r: string): string => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (AGENTS.md). */
const sinComentarios = (src: string): string => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}
const contar = (src: string, re: RegExp): number => (src.match(re) ?? []).length;

type It = { id: string; file: { name: string } };
const it = (id: string): It => ({ id, file: { name: `${id}.pdf` } });
const doc = (id: string): AdjuntoVista => ({ id: `doc-${id}`, nombre: `${id}.pdf`, via: 'pdf', chars: 100 });

// ── La lectura al enviar, ejecutada ──────────────────────────────────────────

test('leer al enviar: en orden, diciendo en cuál va, y los docs vuelven en el orden de la vista', async () => {
  const leidos = new Map<string, AdjuntoVista>();
  const orden: string[] = [];
  const avisos: string[] = [];
  const r = await leerAdjuntos([it('a'), it('b'), it('c')], leidos, {
    leer: async (x) => { orden.push(x.id); return doc(x.id); },
    alEmpezar: (x, i, total) => avisos.push(`${x.file.name} ${i + 1}/${total}`),
  });
  assert.deepEqual(orden, ['a', 'b', 'c']);
  assert.deepEqual(avisos, ['a.pdf 1/3', 'b.pdf 2/3', 'c.pdf 3/3']);
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.docs.map((d) => d.id), ['doc-a', 'doc-b', 'doc-c']);
  assert.deepEqual([...leidos.keys()], ['a', 'b', 'c']);
});

test('leer al enviar: si una falla, CORTA (no sale el turno) y al reintentar los ya leídos NO se vuelven a leer', async () => {
  const leidos = new Map<string, AdjuntoVista>();
  const primera: string[] = [];
  const r1 = await leerAdjuntos([it('a'), it('b'), it('c')], leidos, {
    leer: async (x) => { primera.push(x.id); if (x.id === 'b') throw new Error('No pude leer ese PDF.'); return doc(x.id); },
  });
  assert.deepEqual(primera, ['a', 'b'], 'después del que falló no se lee nada');
  assert.deepEqual(r1, { ok: false, cortado: false, error: '«b.pdf»: No pude leer ese PDF.', falloId: 'b' });
  assert.deepEqual([...leidos.keys()], ['a'], 'el ya leído queda guardado');
  // Reintento: «a» no se vuelve a leer (cada lectura es un pedido de IA).
  const segunda: string[] = [];
  const avisos: string[] = [];
  const r2 = await leerAdjuntos([it('a'), it('b'), it('c')], leidos, {
    leer: async (x) => { segunda.push(x.id); return doc(x.id); },
    alEmpezar: (x) => avisos.push(x.id),
  });
  assert.deepEqual(segunda, ['b', 'c']);
  assert.deepEqual(avisos, ['b', 'c'], '«Leyendo…» sólo de lo que de verdad se lee');
  assert.ok(r2.ok);
  if (r2.ok) assert.deepEqual(r2.docs.map((d) => d.id), ['doc-a', 'doc-b', 'doc-c'], 'el doc ya leído viaja igual, en su lugar');
});

test('leer al enviar: si la conversación cambió en el medio, corta callado y no guarda nada más', async () => {
  const leidos = new Map<string, AdjuntoVista>();
  let vigente = true;
  const r = await leerAdjuntos([it('a'), it('b')], leidos, {
    leer: async (x) => { if (x.id === 'a') vigente = false; return doc(x.id); },
    vigente: () => vigente,
  });
  assert.deepEqual(r, { ok: false, cortado: true });
  assert.equal(leidos.size, 0, 'la respuesta de otra conversación no se guarda acá');
});

// ── El cableado de la pantalla ───────────────────────────────────────────────

test('Offer: ELEGIR no llama a subir-url ni a leer; sólo junta en la vista previa', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  const elegir = bloque(app, 'const agregarArchivos = (archivos: File[]) =>', 'const quitarArchivo =');
  assert.doesNotMatch(elegir, /subirArchivo|llamarOffer|'leer'|leerAdjuntos|leerUno|enviarVista/, 'elegir un archivo volvió a subirlo o a leerlo');
  assert.match(elegir, /lista\.agregar\(archivos\)/);
  // El chat (clip y soltar) sólo entrega los archivos.
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.doesNotMatch(chat, /subirArchivo|llamarOffer/, 'el chat no sube ni lee nada');
  assert.match(chat, /if \(lista\.length\) onArchivos\(lista\);/);
  assert.match(chat, /if \(!ocupado\) onArchivos\(Array\.from\(e\.dataTransfer\.files\)\);/);
  assert.match(app, /onArchivos=\{agregarArchivos\}/);
  assert.match(app, /vista=\{vistaAdjuntos\}/);
});

test('Offer: subir y leer viven SÓLO en Enviar (leerUno ← leerAdjuntos ← enviarVista), y antes del turno', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  // 'leer' se pide en un solo lugar, y ese lugar sube primero.
  assert.equal(contar(app, /action: 'leer'/g), 1);
  const uno = bloque(app, 'const leerUno = async', 'const enviarVista = async');
  assert.match(uno, /await subirArchivo\(it\.file, mime\)/);
  assert.match(uno, /action: 'leer', sesionId: id, path, nombre: it\.file\.name, mime/);
  // subirArchivo: el de leerUno y el de la nota de voz (`mandar`). Ninguno más.
  assert.equal(contar(app, /subirArchivo\(/g), 2);
  assert.equal(contar(app, /leerUno\(/g), 1, 'leerUno sólo lo llama enviarVista');
  const enviar = bloque(app, 'const enviarVista = async', 'const agregarArchivos =');
  assert.match(enviar, /leer: \(it\) => leerUno\(it, id, s\.funnelId, e\)/);
  assert.match(enviar, /alEmpezar: \(it\) => \{ if \(e === epoca\.current\) setEstadoVista\(`Leyendo «\$\{it\.file\.name\}»…`\); \}/);
  // Si una lectura falla, NO sale el turno: el return va antes de `mandar(`.
  const iFallo = enviar.indexOf('if (!lectura.ok) {');
  const iMandar = enviar.indexOf('await mandar(');
  assert.ok(iFallo > 0 && iMandar > iFallo, 'el turno no puede salir antes de mirar la lectura');
  assert.match(enviar.slice(iFallo, iMandar), /setErrorVista\(lectura\.error\);\s*setFalloId\(lectura\.falloId\);\s*return;/);
  // El turno lleva los docs leídos y el texto; si no sale, la vista vuelve (con los docs ya leídos en el mapa).
  assert.match(enviar, /mandar\(\{ texto: t, docs: lectura\.docs, fuente: cuantosArchivos\(lectura\.docs\.length\) \}\)/);
  assert.match(enviar, /lista\.poner\(\[\.\.\.items,/);
  assert.match(enviar, /leerAdjuntos\(items, docsLeidos\.current,/);
});

test('Offer: lo de la v2 no se pierde (el link del texto, el 502 con la sesión, los topes) y el ✓ de «leído» se fue', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  const mandar = bloque(app, 'const mandar = async', 'const reintentarRespuesta');
  assert.match(mandar, /action: 'leer-link'/, 'el link pegado en el texto se sigue leyendo');
  assert.match(mandar, /if \(err instanceof ErrorOfferApi && err\.sesion\) \{ aplicarSesion\(err\.sesion, e\); return 'salio'; \}/, 'el 502 con la sesión guardada');
  assert.match(mandar, /action: 'turno', sesionId: id, texto: envio\.texto, docIds,/);
  // Los topes del navegador, ANTES de subir: que se pueda leer y 25 MB.
  const topes = bloque(app, 'const TOPES_OFFER = {', '};');
  assert.match(topes, /maxBytes: MAX_ARCHIVO_BYTES/);
  assert.match(topes, /puedeLeerse\(f\.name, f\.type\) \? null : `«\$\{f\.name\}» \$\{porQueNoPuedo\(f\.name\) \|\| 'no se puede leer\.'\}`/);
  // El chip de arriba de la barra y el ✓ de «leído» ya no existen.
  assert.doesNotMatch(sinComentarios(leer('app/offer/ayudas.ts')), /chipDeAdjuntos|AdjuntoEnCurso/);
  assert.doesNotMatch(sinComentarios(leer('app/offer/ChipArchivo.tsx')), /aria-label="Leído"/);
  assert.doesNotMatch(sinComentarios(leer('app/offer/ChatOffer.tsx')), /\bchip=\{/);
});
