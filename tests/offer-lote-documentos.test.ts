// =============================================================================
// Offer: muchos documentos los lee el servidor, y MaKo avisa cuando termina (O9, llamada con Mauricio del 22/10/2026)
// =============================================================================
// Mauricio (Fathom 195129619, 39:44): «mientras analiza muchos documentos, que diga "los analizo y te aviso cuando
// termine"», que deje seguir usando la app y que avise al terminar. Medido en su conversación (ws1, id 18): mandó 5
// archivos de una vez, la lectura (04:05-04:08) y el turno (106 s) lo tuvieron esperando más de 4 minutos con la
// pantalla en «Leyendo…». Lo de acá fija el contrato: con 3 o más archivos la pantalla los sube y manda `leer-lote`; el
// servidor anota «estoy leyendo», los lee por detrás con la MISMA lectura de uno por uno, manda el turno y recién
// después saca el aviso (así la pantalla relee hasta que llega la respuesta), y deja la notificación en la campanita.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-o9.mjs en el scratchpad de la sesión: rompe UNA cosa,
// corre este archivo y restaura). La base en verde (8 de 8); 13 roturas, las 13 cazadas; los números, al lado de cada test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  LECTURA_VENCE_MS, TEXTO_LECTURA_CORTADA, conversacionParaPrompt, leyendoParaVista, mensajeLeyendo, resumenDelLote, sanearMensajes,
} from '../lib/offer-reglas';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const funcion = (src: string, nombre: string) => {
  const i = src.search(new RegExp(`(?:async )?function ${nombre}\\b`));
  return i < 0 ? '' : src.slice(i, src.indexOf('\n}\n', i) + 2);
};
const AT = '2026-10-22T04:05:00.000Z';
const NOMBRES = ['Guion VSL Sprint de Ejecución Empresarial.pdf', 'favicon.ico', 'gracias.html', 'index.html', 'index.html'];

// rotura (sanearMensajes sin `leyendo`): 1 fallo.
test('el «estoy leyendo»: dice cuántos y cuáles, promete el aviso, y sobrevive a la base', () => {
  const m = mensajeLeyendo({ id: 'm1', at: AT, nombres: NOMBRES, texto: 'Este es el video de VSL dentro del landing:', intento: 'i1' });
  assert.equal(m.texto, 'Estoy leyendo tus 5 documentos («Guion VSL Sprint de Ejecución Empresarial.pdf», «favicon.ico», «gracias.html», «index.html» y 1 más). Te aviso cuando termine: mientras, puedes seguir usando MaKo.');
  const [vuelta] = sanearMensajes(JSON.parse(JSON.stringify([m])));
  assert.deepEqual(vuelta.leyendo, { nombres: NOMBRES, desde: AT, intento: 'i1', texto: 'Este es el video de VSL dentro del landing:' });
});

// rotura (leyendoParaVista sin el vencimiento): 1 fallo.
test('la vista: en curso mientras no pasen 15 minutos; después, cortada (se puede volver a mandar)', () => {
  const m = mensajeLeyendo({ id: 'm1', at: AT, nombres: NOMBRES, texto: '', intento: 'i1' });
  const t0 = Date.parse(AT);
  assert.deepEqual(leyendoParaVista([m], t0 + 60_000), { nombres: NOMBRES, vencido: false });
  assert.deepEqual(leyendoParaVista([m], t0 + LECTURA_VENCE_MS + 1), { nombres: NOMBRES, vencido: true });
  assert.equal(leyendoParaVista([{}], t0), null);
  // Y un «estoy leyendo» cortado deja de prometer el aviso.
  assert.match(leer('lib/offer-sesiones.ts'), /m\.leyendo && leyendoParaVista\(\[m\], Date\.now\(\)\)\?\.vencido\s*\? \(\(\{ leyendo: _l, \.\.\.resto \}\) => \(\{ \.\.\.resto, texto: TEXTO_LECTURA_CORTADA \}\)\)\(m\) : m/);
  assert.match(TEXTO_LECTURA_CORTADA, /Vuelve a mandarlos/);
});

// rotura (el «estoy leyendo» viaja al prompt): 1 fallo.
test('el «estoy leyendo» no viaja al modelo: es de la pantalla, no de la conversación', () => {
  const m = mensajeLeyendo({ id: 'm1', at: AT, nombres: NOMBRES, texto: '', intento: 'i1' });
  const p = conversacionParaPrompt([{ de: 'yo', texto: 'Hola' }, m, { de: 'yo', texto: 'Aquí van' }]);
  assert.doesNotMatch(p, /Estoy leyendo/);
  assert.doesNotMatch(p, /Se omiten/);
});

// rotura (el resumen no dice cuáles fallaron): 1 fallo.
test('lo que no se pudo leer queda dicho; si se leyó todo, nada', () => {
  assert.equal(resumenDelLote({ total: 5, leidos: 5, errores: [] }), null);
  assert.equal(resumenDelLote({ total: 5, leidos: 4, errores: ['«favicon.ico» (MaKo no sabe leer «favicon.ico»)'] }),
    'Leí 4 de tus 5 documentos. No pude con: «favicon.ico» (MaKo no sabe leer «favicon.ico»). Si los necesitas, mándalos de nuevo.');
  assert.match(resumenDelLote({ total: 2, leidos: 0, errores: ['«a.pdf» (x)', '«b.pdf» (y)'] }) ?? '', /^No pude leer tus documentos: «a\.pdf» \(x\) · «b\.pdf» \(y\)\./);
});

// rotura (leer-lote sin after: lee en el pedido): 1 fallo. rotura (el aviso se saca ANTES del turno): 1 fallo.
// rotura (sin la campanita): 1 fallo. rotura (cada archivo por otra lectura que no es `leer`): 1 fallo.
test('la ruta: leer-lote contesta al toque y lee por detrás con `leer`; el turno va antes de sacar el aviso; y la campanita', () => {
  const ruta = leer('app/api/offer/route.ts');
  assert.match(ruta, /case 'leer-lote':\n\s*return await leerLote\(ws, body\);/);
  const lote = funcion(ruta, 'leerLote');
  assert.match(lote, /mensajeLeyendo\(\{ id: randomUUID\(\), at, nombres: archivos\.map\(\(a\) => a\.nombre\), texto, intento \}\)/);
  assert.match(lote, /try \{ after\(trabajo\); \} catch \{ void trabajo\(\); \}/);
  assert.match(lote, /if \(archivos\.some\(\(a\) => !esPathDeOffer\(ws, a\.path\)\)\) return no\(400,/);
  const detras = funcion(ruta, 'leerLotePorDetras');
  assert.match(detras, /const res = await leer\(ws, \{ sesionId, path: a\.path, nombre: a\.nombre, mime: a\.mime \}, Date\.now\(\)\);/);
  const iTurno = detras.indexOf('await turno(ws, { sesionId, texto, docIds, delLote: intento }');
  const iSacar = detras.indexOf('f.mensajes.findIndex((m) => m.leyendo?.intento === intento)');
  assert.ok(iTurno > 0 && iSacar > iTurno, 'el turno, y DESPUÉS se saca el «estoy leyendo»');
  assert.match(detras, /await crearNotificacion\(\{\s*ws, tipo: 'offer_documentos_leidos'/);
  assert.match(detras, /link: `\/offer\?sesion=\$\{sesionId\}`/);
});

// rotura (turno sin el freno): 1 fallo.
test('mientras lee, el único turno que entra es el del lote', () => {
  const t = funcion(leer('app/api/offer/route.ts'), 'turno');
  assert.match(t, /if \(leyendo && !leyendoParaVista\(antes\.mensajes, Date\.now\(\)\)\?\.vencido && body\.delLote !== leyendo\.intento\) \{\n\s*return no\(409, 'Todavía estoy leyendo tus documentos\./);
});

// rotura (la pantalla nunca manda el lote): 1 fallo. rotura (se puede mandar mientras lee): 1 fallo.
// rotura (no relee mientras lee): 1 fallo.
test('la pantalla: con 3 o más sin leer manda el lote, no deja mandar en esa conversación mientras lee, y relee', () => {
  const app = leer('app/offer/OfferApp.tsx');
  assert.match(app, /const UMBRAL_LOTE = 3;/);
  assert.match(app, /if \(items\.filter\(\(it\) => !docsLeidos\.current\.has\(it\.id\)\)\.length >= UMBRAL_LOTE\) \{ await enviarLote\(items, id, e\); return; \}/);
  assert.match(app, /\{ action: 'leer-lote', sesionId: id, archivos: subidos, docIds, texto: t \}/);
  assert.match(app, /const puedeMandar = !!sesion && !respondiendo && !leyendo && !leyendoDocs && /);
  assert.match(app, /const idSesionArmando = armadoCorre \|\| leyendoDocs \? /);
});

// rotura (subir-url rechaza el .zip): 1 fallo.
test('el .zip pasa también por subir-url (el 415 lo frenaba antes de subirlo)', () => {
  assert.match(leer('app/api/offer/route.ts'), /if \(!puedeLeerse\(nombre, mime\) && !esZip\(nombre, mime\)\) return no\(415,/);
});
