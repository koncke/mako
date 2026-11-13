// =============================================================================
// El flujo nuevo de Copywriting (13/11/2026, la maqueta que aprobó el Cerebro; el relevo de «escribe casi que cualquier cosa»)
// =============================================================================
// 1) La portada abre en «De tu tema», con el idioma del negocio primero y el inglés después y marcado.
// 2) Al replicar, MaKo pregunta ANTES de escribir: para qué oferta, lo que le falta (y lo guarda en la oferta) y, si el tema no
//    tiene que ver, cómo usarlo. 3) Después escribe la pieza entera, sin «Aceptar», con el original transcrito al lado.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idiomaDe, temaDeTexto, temaRelacionado } from '../lib/copywriter/tema';
import { conTemaYIdioma, esDeTuTema, MINIMO_PARA_ABRIR_EN_TEMA, textoDelNegocio } from '../lib/copywriter/portada-tema';
import { claveDeConsulta, consultaDeTanda, filtrarOutliersCopy, primeraTandaCopy, type OutlierCopy, type PortadaCopy } from '../lib/copywriter/outliers';
import {
  AL_NEGOCIO, EN_OFFER, LLEVAR_TEMA, SEGUIR_SIN, SOLO_ESTRUCTURA, faltaPorPreguntar, pasoDeReplica, pedidoDeReplica, responderReplica,
  type PreparacionCorta, type RespuestasIniciativa,
} from '../lib/copywriter/iniciativa';
import { datoDeOferta, esCampoQueFalta } from '../lib/copywriter/oferta-elegida';
import { sinTranscripcion, TRANSCRITO } from '../app/copywriter/transcribir-original';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

const outlier = (id: string, gancho: string, texto: string, extra: Partial<OutlierCopy> = {}): OutlierCopy => ({
  id, fuente: id.startsWith('spy:') ? 'spy' : 'biblioteca', formato: 'reel', creador: { nombre: 'x', usuario: 'x', foto: null, competidorId: null },
  url: `https://www.instagram.com/p/${id.replace(':', '')}/`, miniatura: null, gancho, texto, deDonde: 'pie', multiplo: null,
  vistas: null, megusta: null, comentarios: null, publicada: null, ...extra,
});

test('el tema de un texto, por sus palabras: el de bíceps es fitness; el de WhatsApp, negocios; con poco, no se adivina', () => {
  assert.equal(temaDeTexto('7 ejercicios que no te puedes saltar si quieres brazos grandes')?.id, 'fitness');
  assert.equal(temaDeTexto('Si tu WhatsApp no vende, no es el anuncio: es lo que pasa después del clic con el lead')?.id, 'negocios');
  assert.equal(temaDeTexto('How to scale your agency to 100k without chasing clients')?.id, 'negocios');
  assert.equal(temaDeTexto('I paired eight fonts for eight feelings: typography that sells')?.id, 'diseno');
  assert.equal(temaDeTexto('Hoy fue un gran día'), null, 'sin palabras de ningún tema');
  assert.equal(temaDeTexto('Maratón'), null, 'una sola palabra no alcanza');
  // Vecinos: a un negocio de ventas le sirve la IA y el diseño, no el gimnasio.
  assert.equal(temaRelacionado('negocios', 'tecnologia'), true);
  assert.equal(temaRelacionado('negocios', 'fitness'), false);
  // El negocio de MaKo, con sus ofertas vacías (sólo los nombres): igual se sabe que es de ventas.
  assert.equal(temaDeTexto(textoDelNegocio({ ofertas: [{ nombre: 'WhatsApp Ads Funnel' }, { nombre: 'MaKo Acelerador' }] }))?.id, 'negocios');
});

test('el idioma: el inglés se reconoce por sus palabras chicas; lo dudoso no se marca', () => {
  assert.equal(idiomaDe('I paired eight fonts for eight feelings and this is what happened'), 'en');
  assert.equal(idiomaDe('Si tu WhatsApp no vende, no es el anuncio: es lo que pasa después'), 'es');
  assert.equal(idiomaDe('WhatsApp Ads Funnel'), null);
});

test('la portada: el inglés va DESPUÉS, cada uno marcado con su tema, y abre en «De tu tema» si hay bastante', () => {
  const xs = [
    outlier('biblioteca:1', 'I paired eight fonts for eight feelings', 'and this is the typography I use in every design for my brand'),
    outlier('spy:2', 'Si tu WhatsApp no vende', 'no es el anuncio, es lo que pasa después del clic con cada lead y cada cliente'),
    outlier('spy:3', '7 ejercicios para bíceps', 'que no te puedes saltar si quieres brazos grandes en el gym'),
    outlier('spy:4', 'Hoy fue un gran día', 'y lo cuento aquí con todo lo que pasó en la semana'),
  ];
  const p = conTemaYIdioma({ outliers: xs, caidas: [] }, { id: 'negocios', nombre: 'negocios, marketing y ventas' });
  assert.deepEqual(p.outliers.map((o) => o.id), ['spy:2', 'spy:3', 'spy:4', 'biblioteca:1'], 'el de inglés al final, el resto en su orden');
  const de = Object.fromEntries(p.outliers.map((o) => [o.id, o.deTuTema]));
  assert.deepEqual(de, { 'spy:2': true, 'spy:3': false, 'spy:4': true, 'biblioteca:1': true });
  assert.equal(p.tema?.total, 3);
  assert.equal(p.tema?.abre, 3 >= MINIMO_PARA_ABRIR_EN_TEMA);
  // Sin tema claro: de una cuenta que el negocio sigue en Spy, sí (es su nicho); de la biblioteca, no.
  assert.equal(esDeTuTema({ tema: null, fuente: 'spy' }, { id: 'negocios', nombre: '' }), true);
  assert.equal(esDeTuTema({ tema: null, fuente: 'biblioteca' }, { id: 'negocios', nombre: '' }), false);
  // El filtro y la clave de la consulta.
  assert.deepEqual(filtrarOutliersCopy(p.outliers, { formato: null, q: '', tema: true }).map((o) => o.id), ['spy:2', 'spy:4', 'biblioteca:1']);
  assert.equal(claveDeConsulta({ formato: null, q: '', tema: true }, 'outlier'), 'tema|todos|outlier|');
  assert.equal(claveDeConsulta({ formato: null, q: '' }, 'outlier'), 'todos|outlier|', 'sin tema, la clave de siempre');
  assert.deepEqual(consultaDeTanda({ tema: true }).filtros, { formato: null, q: '', tema: true });
  assert.deepEqual(consultaDeTanda({}).filtros, { formato: null, q: '' });
});

test('la primera tanda de la página es la de «De tu tema» cuando abre ahí', () => {
  const muchos = Array.from({ length: MINIMO_PARA_ABRIR_EN_TEMA + 2 }, (_, i) => outlier(`spy:${i + 1}`, `Cómo vender ${i}`, 'más a tus clientes con un buen anuncio y un lead'));
  const conGym = [...muchos, outlier('spy:99', 'Rutina de bíceps', 'ejercicios para brazos en el gym')];
  const p: PortadaCopy = conTemaYIdioma({ outliers: conGym, caidas: [] }, { id: 'negocios', nombre: 'negocios' });
  assert.equal(p.tema?.abre, true);
  const t = primeraTandaCopy(p);
  assert.equal(t.total, conGym.length, 'el total es el de TODA la portada');
  assert.ok(!t.outliers.some((o) => o.id === 'spy:99'), 'la primera tanda es la del tema');
  assert.equal(t.tema?.total, muchos.length);
});

const prep = (falta: string[], relacionado = true): PreparacionCorta => ({
  tema: { original: relacionado ? null : { nombre: 'fitness y deporte' }, negocio: { nombre: 'negocios, marketing y ventas' }, relacionado },
  ofertas: [{ id: 7, nombre: 'WhatsApp Ads Funnel', falta }, { id: 8, nombre: 'MaKo Acelerador', falta: [] }],
});

test('MaKo pregunta ANTES de escribir: la oferta, lo que le falta (de a uno) y cómo usar un tema que no tiene que ver', () => {
  const p = prep(['para quién', 'precio'], false);
  let r: RespuestasIniciativa = {};
  const oferta = pasoDeReplica(p, r)!;
  assert.equal(oferta.pregunta, '¿Para qué oferta lo escribo?');
  assert.deepEqual(oferta.opciones.map((o) => o.texto), ['WhatsApp Ads Funnel', 'MaKo Acelerador', 'Para mi negocio en general']);
  r = responderReplica(oferta, 'oferta:7', r);
  const quien = pasoDeReplica(p, r)!;
  assert.equal(quien.pregunta, 'A «WhatsApp Ads Funnel» le faltan datos para escribir sin inventar. ¿Para quién es? (a quién le vendes)');
  assert.equal(quien.libre, true);
  assert.deepEqual(quien.opciones.map((o) => o.valor), [SEGUIR_SIN, EN_OFFER]);
  r = responderReplica(quien, 'Coaches y consultores', r);
  const precio = pasoDeReplica(p, r)!;
  assert.equal(precio.pregunta, '¿Cuánto cuesta?', 'la segunda, sin la presentación');
  r = responderReplica(precio, 'US$ 497', r);
  assert.deepEqual(faltaPorPreguntar(p, r), []);
  const tema = pasoDeReplica(p, r)!;
  assert.equal(tema.pregunta, 'El original habla de fitness y deporte, que no tiene que ver con lo tuyo (negocios, marketing y ventas). ¿Cómo lo uso?');
  r = responderReplica(tema, SOLO_ESTRUCTURA, r);
  assert.equal(pasoDeReplica(p, r), null, 'ya se puede escribir');
  const pedido = pedidoDeReplica(r, p.ofertas, 'fitness y deporte').texto;
  assert.match(pedido, /^Replícalo entero con mi oferta «WhatsApp Ads Funnel»: su estructura, su tipo de gancho y su ritmo\./);
  assert.match(pedido, /De la oferta: para quién: Coaches y consultores; precio: US\$ 497\./, 'por si guardarlo en la oferta falló');
  assert.match(pedido, /El original habla de fitness y deporte: toma sólo su tipo de gancho y su estructura/);
  assert.match(pedidoDeReplica({ ...r, tema: LLEVAR_TEMA }, p.ofertas, null).texto, /El original habla de otra cosa: lleva su idea a mi negocio/);
});

test('sin preguntas de más: una oferta completa no pide datos, «Seguir sin eso» cierra todos, y del tema del negocio no pregunta', () => {
  const p = prep(['para quién', 'qué promete', 'precio']);
  const completa = responderReplica(pasoDeReplica(p, {})!, 'oferta:8', {});
  assert.equal(pasoDeReplica(p, completa), null);
  const r = responderReplica(pasoDeReplica(p, {})!, 'oferta:7', {});
  const sinEso = responderReplica(pasoDeReplica(p, r)!, SEGUIR_SIN, r);
  assert.equal(pasoDeReplica(p, sinEso), null);
  assert.equal(pedidoDeReplica(sinEso, p.ofertas).texto, 'Replícalo entero con mi oferta «WhatsApp Ads Funnel»: su estructura, su tipo de gancho y su ritmo.');
  // Para el negocio en general: sin datos de oferta que preguntar.
  assert.equal(pasoDeReplica(p, { oferta: AL_NEGOCIO }), null);
  // Sin ofertas: no pregunta por la oferta.
  assert.equal(pasoDeReplica({ ...p, ofertas: [] }, {}), null);
});

test('lo contestado del precio se guarda como número SÓLO si es un número; si no, como nota', () => {
  assert.deepEqual(datoDeOferta('precio', 'US$ 497'), { precio_usd: 497 });
  assert.deepEqual(datoDeOferta('precio', '1.500'), { precio_usd: 1500 });
  assert.deepEqual(datoDeOferta('precio', '2000 dólares'), { precio_usd: 2000 });
  assert.deepEqual(datoDeOferta('precio', '2 pagos de 500'), { precio_nota: '2 pagos de 500' });
  assert.deepEqual(datoDeOferta('para quién', '  Coaches   y consultores '), { para_quien: 'Coaches y consultores' });
  assert.equal(esCampoQueFalta('precio'), true);
  assert.equal(esCampoQueFalta('garantía'), false);
  // ⚠️ Se guarda con la oferta ENTERA: `upsertOferta` pone null en lo que no viene.
  const srv = leer('lib/copywriter/replica-servidor.ts');
  assert.ok(srv.includes('const input: OfertaInput = { ...actual, ...datoDeOferta(campo, valor) };'));
});

test('un video que no se pudo transcribir LO DICE (la clave de Apify da 401): MaKo no sabe lo que se dice', () => {
  assert.equal(sinTranscripcion('No pude traer el video de Instagram.', 'reel'),
    'No pude traer el video de Instagram, así que no sé lo que se dice: lo escribo con el texto de su publicación y tomo sólo su gancho y su estructura.');
  assert.equal(sinTranscripcion('hace falta tu Gemini conectado'),
    'No pude transcribir el video (hace falta tu Gemini conectado), así que no sé lo que se dice: lo escribo con su título y su descripción y tomo sólo su gancho y su estructura.');
  assert.equal(TRANSCRITO, 'Transcribí el video: lo ves en «Original», al lado de tu página.');
});

test('el original va AL LADO: una columna en la computadora y la pestaña «Original» en el teléfono', () => {
  const editor = leer('app/copywriter/editor/EditorGuion.tsx');
  assert.ok(editor.includes('{!compartido && !movil && !plantilla && props.outlier ? <OriginalAlLado outlier={props.outlier} /> : null}'));
  const m = leer('app/m/copywriter/GuionM.tsx');
  assert.ok(m.includes("...(guion.doc.props.outlier ? [{ id: 'original' as const, label: 'Original' }] : []),"));
  assert.ok(m.includes('<OriginalAlLado outlier={guion.doc.props.outlier} telefono />'));
  // Cuando MaKo lo transcribe, la columna lo vuelve a leer.
  assert.ok(leer('app/copywriter/PanelMaKo.tsx').includes('if (t.ok) avisarOriginalNuevo(outlier);'));
});
