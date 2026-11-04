// Los carruseles de MaKo por tipo y «Hacer el mío» (lib/carruseles/tipos.ts, documento.ts y referencia.ts). Corre el código.
//
// Probado rompiéndolo (4/11/2026), base 12/0 (scratchpad romper2.py, cada rotura sola y restaurada desde memoria):
//   · `laminasDelTipo` sin el tope del tipo → 3 rojos (un carrusel de 40 láminas no existe);
//   · `cierreDeTexto` quedándose con la PRIMERA pista → 1 rojo (el cierre va al final);
//   · la barra de progreso con el ancho entero en todas → 1 rojo; la flecha también en la última → 1 rojo;
//   · «Hacer el mío» leyendo el cierre del texto cortado → 1; el explorador sin calcular el cierre → 1;
//   · el plan ignorando el tipo que eligió la persona → 1; adivinando uno cuando no encaja ninguno → 1;
//   · las tarjetas por tipo sin «Ver ejemplo» → 1;
//   · un renombre local sin efecto (`pedidas` → `pedidas2`) → 12/0, verde.
// «Nunca sus palabras» lo cuida además el TIPO: `Estructura` no tiene el texto de la referencia, así que `laminasDesde`
// no tiene cómo copiarlo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDS_TIPO_CARRUSEL, TIPOS_CARRUSEL, laminasDelTipo, tipoCarrusel, tipoDeFormato } from '../lib/carruseles/tipos';
import { ALTO_CARRUSEL, ANCHO_CARRUSEL, documentoDeCarrusel, esOscuro, inicialesDe } from '../lib/carruseles/documento';
import { cierreDeTexto, estructuraDe, frasesDe, laminasDesde, notasDe, planDeReferencia } from '../lib/carruseles/referencia';
import { carruselesDe } from '../lib/carruseles/explorar';
import { GRUPO_CARRUSELES, PLANTILLAS_NUEVO_DISENO, plantillaNueva } from '../app/image-editor/plantillas-crear';
import { resumirDoc, srcsLocales, textosDe, TOPE_DOC_BYTES } from '../lib/image-editor/reglas';
import { FORMATOS } from '../lib/spy-detalle';
import { marcasDeVoseo } from '../lib/voseo';
import { REALES } from './_reales';

let n = 0;
const id = () => `id-${++n}`;
const marca = { nombre: 'Panadería Sol', usuario: 'panaderiasol' };

test('cada tipo arma su estructura con el número de láminas que pide, dentro de su rango', () => {
  assert.deepEqual(TIPOS_CARRUSEL.map((t) => t.id), [...IDS_TIPO_CARRUSEL]);
  for (const t of TIPOS_CARRUSEL) {
    for (let k = t.laminas.min; k <= t.laminas.max; k += 1) {
      const ls = t.estructura(k);
      assert.equal(ls.length, k, `${t.id} con ${k} láminas`);
      assert.equal(ls[0].rol, 'portada', `${t.id}: la primera es la portada`);
      assert.equal(ls[ls.length - 1].rol, 'cierre', `${t.id}: la última es la acción`);
    }
    assert.equal(laminasDelTipo(t, 40), t.laminas.max);
    assert.equal(laminasDelTipo(t, 1), t.laminas.min);
    assert.equal(laminasDelTipo(t, 'x'), t.laminas.def);
    assert.ok(t.ejemplo.laminas.length >= t.laminas.min && t.ejemplo.laminas.length <= t.laminas.max, `${t.id}: el ejemplo respeta el rango`);
  }
});

test('el documento tiene la forma de un diseño del editor: 1080 × 1350, una página por lámina, sin nada local', () => {
  const t = tipoCarrusel('lista')!;
  const doc = documentoDeCarrusel({ laminas: t.estructura(7), estilo: t.estilo, marca, nuevoId: id });
  assert.deepEqual(resumirDoc(doc), { ancho: ANCHO_CARRUSEL, alto: ALTO_CARRUSEL, paginas: 7 });
  assert.deepEqual(srcsLocales(doc), []);
  assert.ok(JSON.stringify(doc).length < TOPE_DOC_BYTES);
  const textos = textosDe(doc);
  assert.ok(textos[0].textos.includes('Panadería Sol'), 'la cabecera lleva el nombre del negocio');
  assert.ok(textos[0].textos.includes('@panaderiasol'));
  assert.ok(textos[0].textos.includes('PS'), 'y sus iniciales');
});

test('la barra de progreso crece lámina a lámina y la flecha no va en la última', () => {
  const t = tipoCarrusel('mito')!;
  const doc = documentoDeCarrusel({ laminas: t.estructura(5), estilo: t.estilo, marca: { nombre: 'Sol', usuario: null }, nuevoId: id }) as { pages: Array<{ objects: Array<Record<string, unknown>> }> };
  const barras = doc.pages.map((p) => p.objects.find((o) => o.name === 'Barra de progreso')!.width as number);
  assert.deepEqual(barras, [216, 432, 648, 864, 1080]);
  const flechas = doc.pages.map((p) => p.objects.some((o) => o.name === 'Flecha'));
  assert.deepEqual(flechas, [true, true, true, true, false]);
  assert.ok(!doc.pages[0].objects.some((o) => o.name === 'Cabecera: usuario'), 'sin @ no se inventa uno');
});

test('el formato que Spy le leyó a una publicación lleva a un tipo; lo que no encaja se pregunta', () => {
  assert.equal(tipoDeFormato('lista'), 'lista');
  assert.equal(tipoDeFormato('antes-despues'), 'antes-despues');
  assert.equal(tipoDeFormato('storytime'), 'historia');
  assert.equal(tipoDeFormato('otro'), null);
  assert.equal(tipoDeFormato(''), null);
  for (const t of TIPOS_CARRUSEL) for (const f of t.formatos) assert.ok(FORMATOS.some((x) => x.value === f), `${t.id}: «${f}» no es un formato de Spy`);
  const usados = TIPOS_CARRUSEL.flatMap((t) => t.formatos);
  assert.equal(new Set(usados).size, usados.length, 'un formato va a un solo tipo');
});

test('el cierre se lee del texto, y gana la ÚLTIMA pista (el cierre va al final)', () => {
  assert.equal(cierreDeTexto('Te cuento mi caso. Comenta si te pasó. Guárdalo para después.'), 'guardar');
  assert.equal(cierreDeTexto('Guárdalo. Y escríbeme GUIA por mensaje.'), 'mensaje');
  assert.equal(cierreDeTexto('Envíaselo a tu socio'), 'compartir');
  assert.equal(cierreDeTexto('Link en la bio'), 'link');
  assert.equal(cierreDeTexto('Hoy hablamos de precios'), null);
  assert.equal(cierreDeTexto(null), null);
});

const referencia = {
  formato: 'lista' as const, laminas: 9, tipoGancho: 'pregunta',
  texto: '¿Tu menú espanta clientes? 5 errores que cometen los cafés. Guárdalo para tu próxima carta.',
  creador: { nombre: 'Café Brasa', usuario: 'cafebrasa', foto: null }, url: 'https://www.instagram.com/p/EJEMPLO/',
};

test('«Hacer el mío» toma la ESTRUCTURA: tipo, láminas, con qué abre y qué pide al final, y lo dice en frases', () => {
  const e = estructuraDe(referencia);
  assert.deepEqual({ tipo: e.tipo, laminas: e.laminas, gancho: e.gancho, cierre: e.cierre, de: e.de }, { tipo: 'lista', laminas: 9, gancho: 'pregunta', cierre: 'guardar', de: '@cafebrasa' });
  assert.deepEqual(frasesDe(e), ['Lista o tips', '9 láminas', 'abre con una pregunta', 'cierra pidiendo que lo guarden']);
  assert.match(notasDe(e), /@cafebrasa/);
  const sinNada = estructuraDe({ ...referencia, formato: '' as const, laminas: null, tipoGancho: null, texto: null });
  assert.deepEqual(frasesDe(sinNada), ['Sin un tipo claro', 'Láminas: no se sabe']);
});

test('nunca sus palabras: las láminas nuevas son guías, ajustadas a su gancho y a su cierre', () => {
  const e = estructuraDe(referencia);
  const ls = laminasDesde(e, 'lista');
  assert.equal(ls.length, 9);
  const todo = ls.map((l) => `${l.titulo} ${l.cuerpo}`).join(' ').toLowerCase();
  for (const suya of ['menú', 'espanta', 'cafés', 'carta']) assert.ok(!todo.includes(suya), `se copió «${suya}» de la referencia`);
  assert.match(ls[0].cuerpo, /pregunta/);
  assert.equal(ls[ls.length - 1].titulo, 'Pide que lo guarden');
  assert.equal(laminasDesde(e, 'lista', 40).length, tipoCarrusel('lista')!.laminas.max, 'lo que se elige respeta el rango del tipo');
});

test('los ejemplos son de negocios ficticios y en español con tú (sin voseo ni gente real)', () => {
  for (const t of TIPOS_CARRUSEL) {
    const textos = [t.nombre, t.cuando, ...t.estructura(t.laminas.def).flatMap((l) => [l.titulo, l.cuerpo]), t.ejemplo.negocio, ...t.ejemplo.laminas.flatMap((l) => [l.titulo, l.cuerpo])].join('\n');
    assert.deepEqual(marcasDeVoseo(textos), [], `${t.id}: voseo`);
    for (const real of REALES) assert.ok(!textos.toLowerCase().includes(real.toLowerCase()), `${t.id}: nombra a «${real}», que es real`);
  }
});

test('las iniciales y la tinta sobre el acento', () => {
  assert.equal(inicialesDe('Cierre Consultivo'), 'CC');
  assert.equal(inicialesDe('sol'), 'S');
  assert.equal(inicialesDe('  '), '·');
  assert.equal(esOscuro('#0F172A'), true);
  assert.equal(esOscuro('#F2B01E'), false);
});

test('«Hacer el mío» elige el tipo: el que se pidió, si no el que se entendió; sin ninguno, lo pregunta', () => {
  const e = estructuraDe(referencia);
  const entendido = planDeReferencia(e);
  assert.ok(!('error' in entendido));
  assert.deepEqual([entendido.tipo.id, entendido.laminas], ['lista', 9]);
  const pedido = planDeReferencia(e, 'historia', 40);
  assert.ok(!('error' in pedido));
  assert.deepEqual([pedido.tipo.id, pedido.laminas], ['historia', tipoCarrusel('historia')!.laminas.max], 'las láminas, dentro del rango del tipo elegido');
  const inventado = planDeReferencia(e, 'meme');
  assert.ok(!('error' in inventado) && inventado.tipo.id === 'lista', 'un tipo que no existe no se usa: queda el entendido');
  const sinTipo = planDeReferencia(estructuraDe({ ...referencia, formato: '' as const }));
  assert.ok('error' in sinTipo && /@cafebrasa/.test(sinTipo.error), 'sin tipo no se adivina: se pide');
});

test('el cierre se lee del texto ENTERO en el explorador (al navegador viaja cortado) y «Hacer el mío» usa ese', () => {
  const largo = `${'Una idea más para tu negocio. '.repeat(20)}Escríbeme GUIA por mensaje y te la mando.`;
  const [c] = carruselesDe([{
    id: 7, competidor_id: 1, canal: 'instagram', tipo: 'publicacion', url: null, texto: largo, analisis: { formato: 'lista', tipoGancho: 'promesa' },
    vistas: null, megusta: 10, comentarios: 1, publicada_en: null, visto_primera_vez: '2026-11-01T00:00:00Z', dejo_de_verse_en: null, miniatura: null,
  }], [{ id: 1, nombre: 'Café Brasa', instagram: 'cafebrasa' }]);
  assert.equal(c.cierre, 'mensaje');
  assert.equal(c.tipoGancho, 'promesa');
  const cortado = { ...c, texto: largo.slice(0, 320) };
  assert.equal(cierreDeTexto(cortado.texto), null, 'cortado, el texto ya no dice qué pide');
  assert.equal(estructuraDe(cortado).cierre, 'mensaje', 'la confirmación dice lo mismo que va a crear el server');
});

test('«Nuevo diseño» abre con los carruseles por tipo: su sección, «Ver ejemplo» y la estructura del tipo', () => {
  const porTipo = PLANTILLAS_NUEVO_DISENO.filter((p) => p.carrusel);
  assert.deepEqual(porTipo.map((p) => p.carrusel), [...IDS_TIPO_CARRUSEL]);
  assert.deepEqual(PLANTILLAS_NUEVO_DISENO.slice(0, porTipo.length), porTipo, 'van primero');
  for (const p of porTipo) {
    const t = tipoCarrusel(p.carrusel!)!;
    assert.equal(p.grupo, GRUPO_CARRUSELES);
    assert.equal(p.verEjemplo, true, `${p.id}: el ejemplo se ve aparte`);
    assert.deepEqual([p.ancho, p.alto, p.paginas], [ANCHO_CARRUSEL, ALTO_CARRUSEL, t.laminas.def]);
    assert.equal(p.tituloDiseno, `Carrusel · ${t.nombre}`);
    assert.equal(plantillaNueva(p.id), p);
  }
  assert.ok(PLANTILLAS_NUEVO_DISENO.filter((p) => !p.carrusel).every((p) => !p.verEjemplo && !p.grupo), 'las demás se ven como antes');
});
