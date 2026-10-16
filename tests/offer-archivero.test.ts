// =============================================================================
// Offer → El Archivero: cada archivo del chat queda también en El Archivero, sin frenar ni ensuciar la charla
// =============================================================================
// Decisión de Martín (Ticketera, 15/10/2026 05:32, ref `offer-archivero`), textual: «¿El Archivero del chat
// guarda el archivo y paga una extracción por documento? → A · Sí». Hasta ese día 'leer' (app/api/offer/
// route.ts) leía el documento y BORRABA el binario en su `finally`; El Archivero no se enteraba.
//
// Lo PURO se EJECUTA (lib/archivero-registro.ts, lib/offer-reglas.ts, app/offer/ayudas.ts): el id de
// contenido, el «sin pisar» comparado contra el recálculo DE VERDAD (`computeEffective`), qué lectura va al
// Archivero, la anotación en la conversación y lo que dice el chip. El CABLEADO se lee del fuente, porque
// lib/archivero.ts y la ruta son `server-only` (comentarios fuera y saltos a LF antes de buscar).
//
// PROBADO ROMPIÉNDOLO (15/10/2026): 30 roturas, las 30 cazadas; la tabla con los números, al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answersConDocumento, binarioHuerfano, computeEffective, destinoOcupado, documentoYaArchivado, idDeContenido,
  origenDelWs, pathEnArchivero, TOPE_HUERFANO_MS, type ArchivoConCampos,
} from '../lib/archivero-registro';
import { pathSubidoValido } from '../lib/archivero-bajada';
import {
  adjuntoDe, conArchivero, motivoArchivoOffer, sanearArchiveroDoc, sanearDocumentos, sanearMensajes, seArchivaDesdeOffer,
  type DocumentoGuardado, type MensajeGuardado,
} from '../lib/offer-reglas';
import { notaDelAdjunto } from '../app/offer/ayudas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bytes = (s: string) => new TextEncoder().encode(s);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** El cuerpo de una función de primer nivel, hasta la próxima. */
function funcion(src: string, nombre: string): string {
  const i = src.indexOf(`function ${nombre}(`);
  assert.ok(i >= 0, `no está ${nombre}`);
  const cortes = ['\nasync function ', '\nfunction ', '\nexport async function ', '\nexport function ', '\nexport type ', '\nconst ', '\ntype ']
    .map((c) => src.indexOf(c, i + 10)).filter((x) => x > 0);
  return src.slice(i, cortes.length ? Math.min(...cortes) : undefined);
}

// ── Lo puro del Archivero ────────────────────────────────────────────────────

test('el id sale del CONTENIDO: el mismo archivo da el mismo id (no se paga dos veces), otro negocio u otro archivo no, y el path es el del Archivero', () => {
  const a = idDeContenido(5, bytes('oferta v1'));
  assert.equal(a, idDeContenido(5, bytes('oferta v1')), 'el mismo archivo mandado dos veces tiene que dar el mismo id');
  assert.notEqual(a, idDeContenido(6, bytes('oferta v1')), 'la clave es (workspace, id): el mismo PDF en otro negocio no puede chocar');
  assert.notEqual(a, idDeContenido(5, bytes('oferta v2')));
  assert.match(a, UUID);
  // El binario queda donde y como los sube la pantalla del Archivero: `<ws>/<uuid>`, lo que acepta su guarda.
  assert.equal(pathEnArchivero(5, a), `5/${a}`);
  assert.ok(pathSubidoValido(5, a, pathEnArchivero(5, a)));
});

test('el origen tiene que ser un binario de una pantalla de ESTE workspace; un path ajeno o con `..` no se toca', () => {
  const u = '0b5c9a2e-1f3d-4c7a-9e21-3b4d5e6f7a8b';
  assert.ok(origenDelWs(5, `5/offer/${u}`));
  for (const malo of [`7/offer/${u}`, `5/../7/offer/${u}`, `5/${u}`, `5/offer/${u}/x`, `5//offer/${u}`, `15/offer/${u}`]) {
    assert.equal(origenDelWs(5, malo), false, malo);
  }
  assert.equal(origenDelWs(0, `0/offer/${u}`), false);
});

test('«sin pisar»: sumar un documento da lo MISMO que recalcular con él al final, y no toca lo del wizard', () => {
  const files: ArchivoConCampos[] = [
    { id: 'a', nombre: 'avatar.pdf', campos: { avatar_quien: 'Coaches', oferta_promesa: 'Vieja promesa' } },
    { id: 'b', nombre: 'oferta.docx', campos: { oferta_precio: '2000', avatar_dolor: 'No escala' } },
  ];
  const manual = { oferta_precio: '2500' };
  // Lo que el wizard guardó por la otra puerta vive en las answers y NO sale de computeEffective.
  const previas: Record<string, string> = { negocio_objetivo: 'Duplicar', marca_tono: 'Cercano', ...computeEffective(files, manual).answers };
  const nuevo: ArchivoConCampos = { id: 'c', nombre: 'chat.pdf', campos: { oferta_promesa: 'Nueva promesa', oferta_precio: '1800', negocio_que_hace: 'Mentorías', avatar_quien: '   ' } };
  const { siguiente, aportadas } = answersConDocumento(previas, manual, nuevo.campos);
  const recalculado: Record<string, string> = { negocio_objetivo: 'Duplicar', marca_tono: 'Cercano', ...computeEffective([...files, nuevo], manual).answers };
  assert.deepEqual(siguiente, recalculado);
  // Lo manual gana (no se escribe el precio del documento) y un valor vacío no es un aporte.
  assert.deepEqual(aportadas.sort(), ['negocio_que_hace', 'oferta_promesa']);
  assert.equal(siguiente.oferta_precio, '2500');
  assert.equal(siguiente.avatar_quien, 'Coaches');
  assert.equal(previas.oferta_promesa, 'Vieja promesa', 'no muta lo que recibe');
});

test('¿ya está en El Archivero? por el id de contenido, o subido por su pantalla con el mismo nombre y los mismos bytes', () => {
  const files = [
    { id: 'x1', nombre: 'precios.pdf', mime: 'application/pdf', tamano: 1234 },
    { id: 'w1', nombre: 'Mi web', mime: 'text/html', tamano: 900 },
  ];
  assert.equal(documentoYaArchivado([...files, { id: 'c1', nombre: 'otro', mime: null, tamano: 1 }], { id: 'c1', nombre: 'nada', tamano: 5 }), 'c1');
  assert.equal(documentoYaArchivado(files, { id: 'nuevo', nombre: ' precios.pdf ', tamano: 1234 }), 'x1');
  assert.equal(documentoYaArchivado(files, { id: 'nuevo', nombre: 'precios.pdf', tamano: 1235 }), null, 'otro tamaño es otro archivo');
  assert.equal(documentoYaArchivado(files, { id: 'nuevo', nombre: 'Mi web', tamano: 900 }), null, 'una web pegada guarda caracteres, no bytes');
  assert.equal(documentoYaArchivado(files, { id: 'nuevo', nombre: 'precios.pdf', tamano: 0 }), null);
});

test('un destino ocupado: «ya existe» se reconoce, y sólo es basura si es más viejo que lo que dura un registro', () => {
  assert.ok(destinoOcupado({ message: 'The resource already exists' }));
  assert.ok(destinoOcupado({ statusCode: '409', error: 'Duplicate', message: 'x' }));
  assert.equal(destinoOcupado({ message: 'Object not found', statusCode: '404' }), false);
  assert.equal(destinoOcupado(null), false);
  const ahora = Date.parse('2026-10-15T12:00:00Z');
  assert.ok(binarioHuerfano({ createdAt: new Date(ahora - TOPE_HUERFANO_MS - 1000).toISOString() }, ahora));
  assert.equal(binarioHuerfano({ createdAt: new Date(ahora - 60_000).toISOString() }, ahora), false, 'uno reciente puede ser otro envío guardándose');
  assert.equal(binarioHuerfano({}, ahora), false, 'sin fecha no se puede probar que sea basura');
  assert.equal(binarioHuerfano(null, ahora), false);
});

// ── Lo puro de Offer ─────────────────────────────────────────────────────────

test('qué va al Archivero: los ARCHIVOS del negocio, no un audio subido como documento ni la página de un link', () => {
  for (const via of ['texto', 'docx', 'pdf', 'pdf-vision', 'imagen', 'planilla', 'diapositivas', 'opendocument']) assert.ok(seArchivaDesdeOffer(via), via);
  for (const via of ['audio', 'web', 'no-soportado', '']) assert.equal(seArchivaDesdeOffer(via), false, via);
  assert.match(motivoArchivoOffer('precios.pdf'), /^Offer → El Archivero: extraer campos de «precios\.pdf»$/);
});

const doc = (id: string, extra: Partial<DocumentoGuardado> = {}): DocumentoGuardado => ({ id, nombre: `${id}.pdf`, via: 'pdf', texto: `texto ${id}`, chars: 7, at: '2026-10-15T10:00:00Z', ...extra });

test('el resultado se anota en el documento Y en los adjuntos que lo llevan; nada más se toca', () => {
  const d1 = doc('d1');
  const d2 = doc('d2');
  const m1: MensajeGuardado = { id: 'm1', de: 'yo', texto: 'mira', at: 'x', adjuntos: [adjuntoDe(d1), adjuntoDe(d2)] };
  const m2: MensajeGuardado = { id: 'm2', de: 'mako', texto: 'ok', at: 'y' };
  const fallo = { ok: false as const, motivo: 'la IA no pudo leerlo ahora' };
  const r = conArchivero({ documentos: [d1, d2], mensajes: [m1, m2] }, 'd1', fallo);
  assert.ok(r && r.mensajes);
  assert.deepEqual(r.documentos[0].archivero, fallo);
  assert.equal(r.documentos[0].texto, 'texto d1');
  assert.equal(r.documentos[1], d2, 'el otro documento queda igual');
  assert.deepEqual(r.mensajes[0].adjuntos?.[0].archivero, fallo);
  assert.equal(r.mensajes[0].adjuntos?.[1].archivero, undefined);
  assert.equal(r.mensajes[1], m2);
  // Antes del mensaje (el registro terminó antes que el turno): sólo el documento, y el turno lo copia.
  const antes = conArchivero({ documentos: [d1], mensajes: [m2] }, 'd1', { ok: true, id: 'abc' });
  assert.deepEqual(antes, { documentos: [{ ...d1, archivero: { ok: true, id: 'abc' } }] });
  assert.equal(adjuntoDe(antes!.documentos[0]).archivero?.ok, true);
  // Un documento que ya no está (otra conversación, o la borraron): nada que escribir.
  assert.equal(conArchivero({ documentos: [d2], mensajes: [] }, 'd1', fallo), null);
});

test('lo anotado SOBREVIVE a la próxima escritura: los saneos de la base lo conservan, y la basura no pasa', () => {
  const conFallo = doc('d1', { archivero: { ok: false, motivo: 'falló el almacenamiento de MaKo' } });
  const conOk = doc('d2', { archivero: { ok: true, id: 'abc', aviso: 'quedó en El Archivero, pero no pude sumarlo a tu perfil' } });
  const ida = JSON.parse(JSON.stringify([conFallo, conOk]));
  assert.deepEqual(sanearDocumentos(ida), [conFallo, conOk]);
  const m = JSON.parse(JSON.stringify([{ id: 'm1', de: 'yo', texto: 'a', at: 'x', adjuntos: [adjuntoDe(conFallo)] }]));
  assert.deepEqual(sanearMensajes(m)[0].adjuntos?.[0].archivero, conFallo.archivero);
  for (const basura of [{ ok: true }, { ok: false }, { ok: 'si', id: 'x' }, 'ok', 3, null]) assert.equal(sanearArchiveroDoc(basura), undefined, JSON.stringify(basura));
});

test('el chip: dice por qué NO quedó en El Archivero (junto al aviso de la lectura); que sí quedó no se escribe', () => {
  assert.equal(notaDelAdjunto({}), '');
  assert.equal(notaDelAdjunto({ archivero: { ok: true, id: 'abc' } }), '');
  assert.equal(notaDelAdjunto({ archivero: { ok: false, motivo: 'la IA no pudo leerlo ahora' } }), 'No quedó en El Archivero: la IA no pudo leerlo ahora.');
  assert.equal(notaDelAdjunto({ aviso: 'Leí sólo el principio.', archivero: { ok: false, motivo: 'x' } }), 'Leí sólo el principio. No quedó en El Archivero: x.');
  assert.equal(notaDelAdjunto({ archivero: { ok: true, id: 'a', aviso: 'quedó en El Archivero, pero no pude sumarlo a tu perfil' } }), 'Ojo: quedó en El Archivero, pero no pude sumarlo a tu perfil.');
  // Y la burbuja del mensaje la usa: sin esto, el porqué queda guardado y no se ve.
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  const adj = chat.slice(chat.indexOf('function Adjuntos('), chat.indexOf('function Adjuntos(') + 600);
  assert.match(adj, /const nota = notaDelAdjunto\(a\);/);
  assert.match(adj, /estado=\{nota \? 'aviso' : 'listo'\} nota=\{nota \|\| undefined\}/);
});

// ── El cableado (fuentes server-only) ────────────────────────────────────────

const RUTA = sinComentarios(leer('app/api/offer/route.ts'));
const ARCH = sinComentarios(leer('lib/archivero.ts'));

test("la ruta: 'leer' entrega el binario al Archivero SÓLO con el documento ya en la conversación; si no, lo borra como antes", () => {
  const l = funcion(RUTA, 'leer');
  const valida = l.indexOf('if (!esPathDeOffer(ws, path))');
  const guarda = l.indexOf('await guardarDocumento(body, doc)');
  const condicion = l.indexOf('if (sesionId != null && seArchivaDesdeOffer(lectura.via)) {');
  const entrega = l.indexOf('entregado = true;');
  const archiva = l.indexOf('await archivarDespues(ws, { sesionId, docId: doc.id, origen: path, contenido, nombre, mime: file.type, texto, inicio });');
  const fin = l.indexOf('} finally {');
  const borra = l.indexOf('if (!entregado) {');
  assert.ok(valida > 0 && guarda > valida && condicion > guarda && entrega > condicion && archiva > entrega && fin > archiva && borra > fin,
    `valida ${valida} · guarda ${guarda} · condición ${condicion} · entrega ${entrega} · archiva ${archiva} · finally ${fin} · borra ${borra}`);
  assert.match(l.slice(borra), /storage\.remove\(\[path\]\)/);
  assert.equal([...l.matchAll(/entregado = true/g)].length, 1, 'un solo lugar entrega el binario');
  // Un documento que la conversación no aceptó (el CAS se rindió) no tiene sesión: no se archiva.
  assert.match(funcion(RUTA, 'guardarDocumento'), /if \(e instanceof ConflictoCAS\) return \{ res: no\(409,[^\n]*sesionId: null \};/);
  // La lectura del chat es la de siempre: el registro NO lee otra vez el archivo.
  assert.match(l, /archivoATexto\(file, \{ feature: 'offer', motivo:/);
});

test('la ruta: el registro va POR DETRÁS (after), en el workspace del admin, con su plazo y el motivo de Offer; el resultado al chip', () => {
  const a = funcion(RUTA, 'archivarDespues');
  assert.match(RUTA, /import \{ after, type NextRequest \} from 'next\/server';/);
  assert.match(a, /const trabajo = \(\) => runWithWorkspace\(ws, async \(\) => \{/);
  assert.match(a, /registrarDocumentoSinPisar\(ws, \{/);
  assert.match(a, /motivo: motivoArchivoOffer\(p\.nombre\), hastaMs: p\.inicio \+ PLAZO_ARCHIVERO_MS,/);
  assert.match(a, /after\(trabajo\);/);
  assert.ok(a.indexOf('after(trabajo)') < a.lastIndexOf('await trabajo()'), 'en línea sólo si after no está');
  assert.match(a, /await anotarArchivero\(p\.sesionId, p\.docId,/);
  assert.match(funcion(RUTA, 'anotarArchivero'), /await actualizarSesion\(sesionId, \(f\) => conArchivero\(f, docId, estado\)\);/);
  assert.match(RUTA, /const PLAZO_ARCHIVERO_MS = 240_000;/);
  // El ws es el del gate de la tab, nunca uno del navegador.
  assert.match(RUTA, /const ws = await adminDeWorkspaceActual\(\);/);
  // Un solo lugar registra: ni el link, ni el turno, ni el reintento.
  assert.equal([...RUTA.matchAll(/registrarDocumentoSinPisar\(/g)].length, 1);
  assert.equal([...RUTA.matchAll(/archivarDespues\(/g)].length, 2, 'la definición y la llamada de leer');
  for (const f of ['leerLink', 'turno', 'reintentarTurno', 'responder']) assert.doesNotMatch(funcion(RUTA, f), /archivar|registrarDocumento/, f);
});

test('lib/archivero.ts: una extracción por documento, DESPUÉS de mirar si ya está y de ganar el lugar; sin recalcular ni regenerar el panorama', () => {
  const r = funcion(ARCH, 'registrarDocumentoSinPisar');
  const origen = r.indexOf('if (!origenDelWs(ws, d.origen))');
  const ya = r.indexOf('documentoYaArchivado(await listFiles()');
  const lugar = r.indexOf('await reclamarLugar(d.origen, destino)');
  const extrae = r.indexOf('await extraerDeArchivo(d.texto, await camposParaExtraer(), 24000, { motivo: d.motivo, hastaMs: d.hastaMs })');
  const estrictas = r.indexOf('mapaParaEscribir(MANUAL_KEY), mapaParaEscribir(ANSWERS_KEY)');
  const inserta = r.indexOf('await insertFile(ws, {');
  const suma = r.indexOf('answersConDocumento(previas, manual, ex.campos)');
  assert.ok(origen > 0 && ya > origen && lugar > ya && extrae > lugar && estrictas > extrae && inserta > estrictas && suma > inserta,
    `origen ${origen} · ya ${ya} · lugar ${lugar} · extrae ${extrae} · estrictas ${estrictas} · inserta ${inserta} · suma ${suma}`);
  assert.equal([...r.matchAll(/extraerDeArchivo\(/g)].length, 1, 'una extracción por documento: la que aprobó Martín');
  assert.doesNotMatch(r, /buildEstado|generarPanorama|persistirBrief/, 'ni recalcula el brief ni paga un panorama');
  assert.match(r, /if \(aportadas\.length\) \{\n\s*try \{ await saveAnswers\(siguiente\); \}/);
  // Dueño del binario: lo que no llega a tener fila se borra, y un fallo nunca deja el origen suelto.
  assert.match(r, /\} finally \{\n\s*if \(!conFila\) await borrarBinario\(destino\);\n\s*\}/);
  assert.match(r, /\} catch \(e\) \{\n\s*await soltarOrigen\(\);/);
  assert.match(r, /storage_path: destino/);
  // Mover no pisa: un destino ocupado sólo se reemplaza si es basura vieja.
  const rl = funcion(ARCH, 'reclamarLugar');
  assert.match(rl, /const r = await storage\.move\(origen, destino\);/);
  assert.ok(rl.indexOf('binarioHuerfano(info, Date.now())') < rl.indexOf('await borrarBinario(destino)'));
  // El recálculo existe UNA vez (lib/archivero-registro.ts) y se re-exporta.
  assert.match(ARCH, /export \{ computeEffective, type FuenteCampo \};/);
  assert.doesNotMatch(ARCH, /export function computeEffective/);
});

test('el gasto: la extracción sigue anotada como «El Archivero» por default y la de Offer lleva su motivo', () => {
  const ON = sinComentarios(leer('lib/onboarding.ts'));
  const ex = funcion(ON, 'extraerDeArchivo');
  assert.match(ex, /feature: opts\.feature \|\| 'El Archivero', motivo: opts\.motivo \|\| 'Extraer campos de un documento del negocio'/);
  assert.match(ex, /\.\.\.\(opts\.hastaMs \? \{ hastaMs: opts\.hastaMs \} : \{\}\)/);
  assert.match(ON, /export const ANSWERS_KEY = 'mako\.onboarding\.answers';/);
  // Lo que la tab promete ya no dice que nada paga.
  const nota = leer('lib/model-catalogo.ts').split('\n').find((l) => l.includes("feature: 'offer'")) ?? '';
  assert.match(nota, /la conversación, el diagnóstico y la oferta nunca pagan/);
  assert.match(nota, /cada ARCHIVO que el dueño manda en el chat queda también en El Archivero con UNA extracción/);
});

// ── Las roturas (arnés romper-offer-archivero.py en el scratchpad de la sesión, restaura DE MEMORIA) ──
// 15/10/2026. La base en verde: 13 pases, 0 fallos. Cada rotura rompe UNA cosa y corre este archivo:
//   R1  el id sin el workspace en la huella                      → 1 fallo, 12 pases
//   R2  el id al azar                                            → 1 / 12
//   R3  el origen aceptado con startsWith (pasa `5/../7/…`)       → 1 / 12
//   R4  el documento pisa lo editado a mano                      → 1 / 12
//   R5  recalcular desde cero (se lleva lo del wizard)           → 1 / 12
//   R6  una web pegada cuenta como el mismo archivo              → 1 / 12
//   R7  un destino sin fecha se da por huérfano                  → 1 / 12
//   R8  un audio subido como documento también va al Archivero   → 1 / 12
//   R9  la anotación no llega a los adjuntos del mensaje         → 1 / 12
//   R10 sanearDocumentos pierde el estado                        → 1 / 12
//   R11 sanearAdjuntos pierde el estado                          → 1 / 12
//   R12 adjuntoDe no copia el estado                             → 2 / 11
//   R13 el chip habla también cuando sí quedó                    → 1 / 12
//   R14 la burbuja ignora la nota del Archivero                  → 1 / 12
//   R15 el finally de 'leer' borra SIEMPRE, como antes           → 1 / 12
//   R16 se archiva aunque la conversación no aceptó el documento → 1 / 12
//   R17 la página de un link también se archiva                  → 1 / 12
//   R18 en línea, sin after (el chat espera la extracción)       → 1 / 12
//   R19 sin runWithWorkspace por detrás                          → 1 / 12
//   R20 la extracción sin plazo                                  → 1 / 12
//   R21 el resultado no se anota en la conversación              → 1 / 12
//   R22 recalcular el brief con buildEstado(true)                → 1 / 12
//   R23 extraer ANTES de ganar el lugar (dos envíos, dos pagos)  → 1 / 12
//   R24 paga también el panorama                                 → 1 / 12
//   R25 el binario sin fila queda suelto                         → 1 / 12
//   R26 no se mira si ya estaba (paga dos veces)                 → 1 / 12
//   R27 un origen ajeno se acepta                                → 1 / 12
//   R28 el motivo de Offer no llega al Saldo de IA               → 1 / 12
//   R29 la nota del catálogo vuelve a prometer que nada paga     → 1 / 12
//   R30 una segunda copia de computeEffective en lib/archivero.ts → 1 / 12
// 30 de 30 cazadas. Restaurado → 13 pases, 0 fallos.
