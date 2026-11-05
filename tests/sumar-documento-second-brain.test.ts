// =============================================================================
// sumar_documento_second_brain — un documento pegado en el chat entra a El Archivero (ticket #44, 3/11/2026)
// =============================================================================
// Una clienta pegó su documento maestro en el chat del Second Brain y MaKo le contestó «no tengo una herramienta que
// escriba ahí». Lo que se fija acá:
//   · el texto que copia el modelo vuelve TAL CUAL (sin las marcas del chat): da el MISMO id que el que el chat ya
//     archivó solo al pegarlo (#884), así que no se guarda dos veces;
//   · un pegado CORTADO por el chat se sabe cortado (al de #44 le faltaba desde el punto 10) y no entra como entero;
//   · lo que manda el modelo para el perfil (un negocio con su Claude en la computadora) entra sólo con claves del perfil;
//   · la operación está en el registro, al final de su área, se confirma en el chat y la nombra el catálogo de funciones
//     con el MISMO nombre que lee la persona en la tarjeta;
//   · sin `campos`, extrae el servidor ADENTRO de D6b (nunca la red gratis para un negocio con su IA).
// Los datos son INVENTADOS (AGENTS.md: nada de datos reales de clientes en tests/).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  documentoDelChat, conPegados, conPegadosHasta, partirPegados, recortarMensaje, pedidoDelMensaje, TOPE_PEGADOS_MENSAJE,
  SIGUE_CORTADO, AVISO_CORTE_PEGADO, AVISO_CORTE_SIN_ARCHIVO,
} from '../lib/chat-pegado';
import { camposDelModelo, idDeContenido } from '../lib/archivero-registro';
import { REGISTRO } from '../lib/api-mako/registro';
import { ENTRADAS } from '../lib/funciones-mako';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';

const leer = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const bytes = (t: string) => new TextEncoder().encode(t);
const ID = 'sumar_documento_second_brain';

const DOC = [
  'Archivo «Plan maestro Estudio Luna.docx»:',
  'ESTUDIO LUNA — ARQUITECTURA DE INTERIORES',
  '',
  '1. IDENTIDAD',
  'Más de 15 años diseñando cocinas y livings en Rosario.',
  '',
  '2. PROPUESTA',
  'Proyecto llave en mano, con presupuesto cerrado y seguimiento semanal de obra.',
  // Sangría y espacios al final, como los trae un .docx: tocarlos cambia el id del documento.
  '    · Relevamiento sin cargo.  ',
  '\t· Entrega en 60 días.',
].join('\n');

test('el documento vuelve TAL CUAL: el mismo id que el que el chat archivó solo al pegarlo (#884)', () => {
  const mensaje = conPegados('te cargo mi documento, incorporalo al second brain', [DOC]);
  const archivadoSolo = partirPegados(mensaje).pegados[0];
  // El modelo lo copia con las marcas o sin ellas: da lo mismo.
  for (const copiado of [`[[texto pegado]]\n${DOC}\n[[/texto pegado]]`, DOC, `\n\n${DOC}\n`]) {
    const r = documentoDelChat(copiado);
    assert.equal(r.texto, archivadoSolo);
    assert.equal(idDeContenido(23, bytes(r.texto)), idDeContenido(23, bytes(archivadoSolo)), 'otro id: se guardaría dos veces');
    assert.equal(r.cortado, false);
    assert.equal(r.nombre, 'Plan maestro Estudio Luna.docx');
  }
  assert.equal(documentoDelChat('Un texto sin cabecera de archivo, de lo que hace el estudio.').nombre, null);
});

test('un pegado que el chat CORTÓ se sabe cortado, con cualquiera de las tres marcas, y la marca no se guarda', () => {
  const largo = `${DOC}\n\n${'3. PROCESO\nRelevamiento, anteproyecto, documentación y dirección de obra.\n'.repeat(400)}`;
  assert.ok(largo.length > TOPE_PEGADOS_MENSAJE);
  const cortes = [
    partirPegados(recortarMensaje(conPegados('súmalo', [largo]), 8000, TOPE_PEGADOS_MENSAJE, true)).pegados[0],
    partirPegados(recortarMensaje(conPegados('súmalo', [largo]), 8000, TOPE_PEGADOS_MENSAJE, false)).pegados[0],
    partirPegados(conPegadosHasta('súmalo', [largo], 6000).mensaje).pegados[0],
  ];
  const marcas = [AVISO_CORTE_PEGADO, AVISO_CORTE_SIN_ARCHIVO, SIGUE_CORTADO];
  cortes.forEach((c, i) => {
    assert.ok(c.includes(marcas[i]), `el chat ya no corta con «${marcas[i]}»: la prueba no prueba nada`);
    const r = documentoDelChat(c);
    assert.equal(r.cortado, true, `con «${marcas[i]}» no se supo que estaba cortado`);
    assert.ok(!r.texto.includes(marcas[i]), 'la línea del corte quedó adentro del documento');
    assert.ok(r.texto.startsWith('Archivo «Plan maestro'));
  });
});

test('con el documento PEGADO se clasifica lo que la persona escribió, y la tarjeta viaja', () => {
  const largo = `${DOC}\n\n${'3. PROCESO\nRelevamiento, anteproyecto, documentación y dirección de obra.\n'.repeat(400)}`;
  const mensaje = recortarMensaje(conPegados('sumá este documento al second brain', [largo]), 8000, TOPE_PEGADOS_MENSAJE, false);
  const texto = pedidoDelMensaje(mensaje);
  assert.equal(texto, 'sumá este documento al second brain');
  // Un mensaje que es SÓLO un pegado se clasifica entero, como siempre.
  assert.equal(pedidoDelMensaje(conPegados('', [DOC])), conPegados('', [DOC]));
  const v = clasificarIntencion(texto, { canal: 'app' });
  assert.equal(v.intencion, 'actuar', `con el documento adentro salía «${clasificarIntencion(mensaje, { canal: 'app' }).intencion}»`);
  const t = herramientasDelChat({ veredicto: v, texto, agendaAbierta: false, deSiempre: [], vista: { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null }, hayPendientes: false });
  assert.ok(t.tools.some((x) => x.name === ID), 'la tarjeta que guarda el documento no viaja');
  // Y el turno de la app clasifica eso mismo (lib/mako-turno-app.ts).
  assert.match(leer('lib/mako-turno-app.ts'), /adjuntos\.length \? textoMemoria : pedidoDelMensaje\(textoPersona\)/);
});

test('lo que manda el modelo para el perfil entra SÓLO con claves del perfil y con valor', () => {
  const validas = new Set(['negocio_nombre', 'oferta_promesa', 'oferta_garantia']);
  const r = camposDelModelo([
    { clave: 'negocio_nombre', valor: '  Estudio Luna ' },
    { clave: 'oferta_promesa', valor: 'x'.repeat(5000) },
    { clave: 'oferta_garantia', valor: '   ' },
    { clave: 'inventada_por_el_modelo', valor: 'algo' },
    { clave: 'mako.archivero.manual', valor: 'pisar lo manual' },
    null, 'basura', { valor: 'sin clave' },
  ], validas);
  assert.deepEqual(Object.keys(r).sort(), ['negocio_nombre', 'oferta_promesa']);
  assert.equal(r.negocio_nombre, 'Estudio Luna');
  assert.equal(r.oferta_promesa.length, 2000);
  // El payload confirmado guarda los campos como objeto: la ejecución pasa por el mismo filtro.
  assert.deepEqual(camposDelModelo({ negocio_nombre: 'Estudio Luna', otra: 'no' }, validas), { negocio_nombre: 'Estudio Luna' });
  assert.deepEqual(camposDelModelo(undefined, validas), {});
});

test('la operación: en el registro, al FINAL de su área, se confirma en el chat y sólo el admin', () => {
  const d = REGISTRO.find((x) => x.id === ID);
  assert.ok(d, 'la operación no está en el registro');
  assert.equal(d.area, 'negocio');
  assert.equal(d.tipo, 'accion');
  assert.equal((d as { confirmacion?: string }).confirmacion, 'chat');
  assert.equal(d.gating?.rolMinimo, 'admin', 'El Archivero es del admin (resolverWsAdmin)');
  assert.equal(d.costo, 'ia');
  const delArea = REGISTRO.filter((x) => x.area === 'negocio');
  // AL FINAL de su área cuando nació (3/11); detrás sólo lo que nació después, que tampoco le gana un empate: los kits de
  // marca (5/11/2026). Si entra algo más acá, va al final de esta lista.
  const despues = ['ver_kits_marca', 'guardar_kit_marca', 'elegir_kit_marca', 'borrar_kit_marca'];
  assert.deepEqual(delArea.slice(-1 - despues.length).map((x) => x.id), [ID, ...despues], 'una operación nueva va AL FINAL de su área (AGENTS.md)');
  assert.doesNotMatch(`${d.id} ${d.titulo}`, /perfil|archivero/i, 'el título repite las palabras del área y le saca lugar a otra');
  assert.ok(d.canales.includes('app') && d.canales.includes('whatsapp'));
  const texto = d.parametros.find((p) => p.nombre === 'texto');
  assert.ok(texto?.obligatorio && (texto.max ?? 0) >= TOPE_PEGADOS_MENSAJE, 'el documento que entra al chat no entra en el parámetro');
  // Lo que se deshace, se deshace por la API.
  assert.ok(REGISTRO.some((x) => x.id === 'borrar_documento_archivero'));
  assert.match(d.descripcion, /borrar_documento_archivero/);
});

test('el catálogo de funciones la nombra como la LEE la persona en la tarjeta', () => {
  const d = REGISTRO.find((x) => x.id === ID)!;
  const sb = ENTRADAS.find((e) => e.keys.includes('second-brain'));
  assert.ok(sb?.hace.some((h) => h.includes(`«${d.titulo}»`)), `lib/funciones-mako.ts no dice «${d.titulo}»: MaKo negaría lo que tiene (#45)`);
});

test('sin campos extrae el servidor ADENTRO de D6b, y con su Claude en la computadora pide los campos antes de proponer', () => {
  const run = leer('lib/api-mako/areas/negocio.run.ts');
  const bloque = run.slice(run.indexOf(`${ID}: {`));
  assert.ok(bloque.length > 0 && run.includes(`${ID}: {`), 'no encuentro el runner');
  assert.match(bloque, /: await conSuIADelNegocio\(ctx\.ws, \(\) => sumarTextoAlArchivero\(ctx\.ws, \{ nombre, texto \}\)\)/);
  const iPide = bloque.indexOf('disponibles: fields };');
  const iPropone = bloque.indexOf('payload: { nombre, texto, campos,');
  assert.ok(iPide > 0 && iPropone > 0, 'falta el pedido de campos o la propuesta con campos');
  assert.ok(iPide < iPropone, 'propone sin los campos del modelo');
  assert.match(bloque, /if \(\(await conQueSeExtrae\(ctx\.ws\)\) === 'servidor'\)/);
  assert.match(bloque, /documentoDelChat\(str\(input, 'texto'\)\)/, 'el texto entra sin limpiar las marcas del chat');

  const ingesta = leer('lib/archivero-ingesta.ts');
  assert.match(ingesta, /if \(!d\.extraido\) await sumarAlPanorama\(\[texto\]\);/, 'el panorama gasta IA del servidor cuando extrajo el modelo');
  assert.match(ingesta, /const ya = documentoYaArchivado\(await listFiles\(\), \{ id, nombre, tamano: contenido\.byteLength \}\);\s*if \(ya\) return/);
  assert.match(ingesta, /conSuIADelNegocio\(ws, async \(negocio\) => \(!negocio\.suIA \|\| \(await puedeArchivarConSuIA\(\)\) === 'si' \? 'servidor' : 'modelo'\)\)/);
});
