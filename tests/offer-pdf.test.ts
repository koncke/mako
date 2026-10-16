// =============================================================================
// offer-pdf — el PDF de Offer se puede LEER de vuelta, con acentos, y no tira
// =============================================================================
// El PDF lo escribe a mano lib/pdf-escritor.ts (sin librería). Lo que se prueba
// acá no es «que devuelva bytes»: es que un lector de verdad (unpdf, el mismo
// pdf.js que usa el producto para leer los PDF que suben los clientes) abra el
// archivo y saque el texto entero. Un offset corrido del xref o un paréntesis sin
// escapar dan un archivo que se ve «bien» en el disco y que un lector no abre.
//
// VERIFICADO ROMPIÉNDOLO (11/10/2026), cada rotura por separado y restaurada desde
// una copia (nunca con git):
//  · sin el escape de paréntesis y barra en `literal` (lib/pdf-escritor.ts):
//    1 fallo («el texto con paréntesis y barra invertida se lee entero»), 7 pases.
//  · cada offset del xref corrido +1 byte: 1 fallo («el xref apunta al byte
//    exacto»), 7 pases. ANTES de existir ese test, esta rotura daba 0 fallos: ver
//    el comentario del test del xref.
//  · el saneador dejando pasar lo que WinAnsi no tiene: 2 fallos (los dos tests
//    de descartes), 6 pases.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pdfDeOferta, nombreArchivoOferta } from '../lib/offer-pdf';
import { textoParaPdf, PdfDoc } from '../lib/pdf-escritor';
import { loQueMeGusto, paraSubirCadaParte, type ConclusionOferta } from '../lib/offer-marco';
import { parseDiagnostico } from '../lib/offer-reglas';
import { diagnosticar, faseDef } from '../lib/fase-diagnostico';

/** El texto de cada página por separado (para ver dónde arranca cada parte). */
async function paginasPdf(bytes: Uint8Array): Promise<string[]> {
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(bytes)), { mergePages: false });
  return Array.isArray(text) ? text : [text];
}

async function leerPdf(bytes: Uint8Array): Promise<{ texto: string; paginas: number }> {
  // pdfjs (dentro de unpdf) usa Math.sumPrecise, que no existe en Node < 22 (mismo
  // polyfill que lib/archivo-a-texto.ts).
  const M = Math as unknown as { sumPrecise?: (a: number[]) => number };
  if (typeof M.sumPrecise !== 'function') M.sumPrecise = (a) => a.reduce((x, y) => x + y, 0);
  const { extractText, getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  return { texto: Array.isArray(text) ? text.join('\n') : text, paginas: totalPages };
}

function ejemplo(): ConclusionOferta {
  return {
    version: 2,
    at: '2026-10-11T12:00:00.000Z',
    modelo: 'gemini/gemini-flash-latest',
    calculo: { total: 58, cuello: 'D3', lista: false, alertas: ['Tienes 6 productos activos para un negocio que factura menos de 3.000 USD al mes.'] },
    diagnostico: {
      tesis: 'La promesa es clara, pero cualquiera podría decir lo mismo: falta el método propio.',
      fuerte: 'Ya hay 12 clientes que pagaron la misma oferta (validación real).',
      dimensiones: [
        { id: 'D1', nota: 7, porque: 'Coaches de nutrición que ya facturan.', mejora: 'Decir para quién no es.' },
        { id: 'D2', nota: 6, porque: 'Promete «bajar 8 kg» sin plazo.', mejora: 'Agregar el plazo.' },
        { id: 'D3', nota: 3, porque: 'Suena igual que la competencia (sin método con nombre).', mejora: 'Nombrar el método.' },
        { id: 'D4', nota: 5, porque: 'Testimonios sin números.', mejora: 'Casos con antes y después.' },
        { id: 'D5', nota: 6, porque: 'Hay ruta, pero no un resultado en la primera semana.', mejora: 'Quick win.' },
        { id: 'D6', nota: 7, porque: 'Grupal, con cupos claros.', mejora: '—' },
        { id: 'D7', nota: 4, porque: 'Cobra por sesión (40 USD).', mejora: 'Precio por resultado.' },
        { id: 'D8', nota: 2, porque: 'No hay razón para decidir hoy.', mejora: 'Cohorte con fecha.' },
        { id: 'D9', nota: 5, porque: 'Dos ofertas a la vez.', mejora: 'Una sola.' },
      ],
      cambios: [
        { titulo: 'Nombrar el método', porque: 'Sin método propio te comparan por precio.', hipotesis: 'Si presento el método «Plato en 3 pasos», sube el cierre de llamadas.' },
        { titulo: 'Cobrar por programa (no por sesión)', porque: 'El precio por hora ancla en commodity.', hipotesis: 'Un programa de 90 días a 1.200 USD cierra igual o mejor que las sesiones sueltas.' },
      ],
    },
    propuesta: {
      nombre: 'Reto Plato Fuerte — 90 días',
      frase: 'Ayudo a mamás que trabajan a bajar 6 kg en 90 días sin dietas de hambre, con el método «Plato en 3 pasos».',
      mensajes: { corto: 'Baja 6 kg sin dietas', largo: 'En 90 días…', entrada: 'Descubre el error del plato…' },
      paraQuien: { perfil: 'Mamás de 30 a 45 años que trabajan.', minimo: 'Pueden invertir en su salud.', noEs: 'Quien busca una pastilla mágica.' },
      problema: { hoy: 'Prueba dietas y rebota.', despues: 'Come rico y baja de peso.', obstaculos: ['Falta de tiempo', 'Ansiedad nocturna'], yaProbo: 'Dietas de moda (keto, ayuno).' },
      mecanismo: { nombres: ['Plato en 3 pasos', 'Método Rebote Cero'], pasos: ['Ordenar el plato', 'Plan de antojos', 'Rutina de 20 minutos'], distinto: 'No prohíbe comidas: cambia el orden.' },
      ruta: [{ fase: 'Semana 1', objetivo: 'Ordenar el plato', hito: 'Primer kilo menos' }],
      incluye: [{ nombre: 'Guía del plato', beneficio: 'Saber qué comer sin contar calorías' }],
      formato: 'Grupal, 12 semanas, llamada semanal (paréntesis de prueba: (incluye chat) y barra \\ invertida).',
      prueba: `${'[completar]'} Casos con números de antes y después.`,
      garantia: { nombre: 'Garantía Plato Lleno', condiciones: 'Si asistes al 80% y no bajas 3 kg…', plazo: '90 días', siNoCumple: 'Seguimos gratis hasta lograrlo.' },
      bonos: [{ nombre: 'Recetario rápido', objecion: 'No tengo tiempo', valor: '[completar]' }],
      inversion: { valorTotal: '3.600 USD', precio: '1.200 USD en 3 pagos', contado: '1.000 USD', plan: '3 pagos de 400 USD', comoDecirlo: 'Son 1.200… (silencio).' },
      urgencia: '[completar] Define una fecha de inicio real o cupos según tu capacidad.',
      escenarios: { mejor: 'Bajas 6 kg y no rebotas.', peor: 'Aprendes a comer y seguimos gratis.' },
      ecuacion: [{ variable: 'tiempo', antes: '6 meses', despues: '90 días → con resultado en la semana 1' }],
      numeros: ['Margen bruto ~80%', 'Ventas necesarias: 8 al mes'],
      validar: ['Vender 5 lugares a precio de camada'],
      siguiente: 'Programa de mantenimiento.',
      completar: ['Casos con números de antes y después', 'El valor del bono «Recetario rápido»', 'Una fecha de inicio o cupos reales'],
    },
  } as ConclusionOferta;
}

test('genera un PDF bien formado (cabecera y fin)', () => {
  const b = pdfDeOferta(ejemplo(), { negocio: 'Nutrición Ñandú', titulo: 'Mi oferta', fecha: new Date('2026-10-11T15:00:00Z') });
  const s = new TextDecoder('latin1').decode(b);
  assert.ok(s.startsWith('%PDF-1.4'), 'no empieza con %PDF');
  assert.ok(s.trimEnd().endsWith('%%EOF'), 'no termina con %%EOF');
});

// ⚠️ LEERLO CON pdf.js NO ALCANZA PARA EL XREF: medido rompiéndolo, con cada offset
// corrido +1 byte unpdf abre el archivo igual (pdf.js reconstruye la tabla
// escaneando) y los siete tests daban verde. Otros lectores (Preview de macOS,
// algunos visores de correo) no reparan. Por eso el xref se valida por separado:
// cada offset tiene que caer EXACTO en el «N 0 obj» de su objeto, y startxref en
// la palabra xref.
test('el xref apunta al byte exacto de cada objeto', () => {
  const b = pdfDeOferta(ejemplo(), { negocio: 'X', titulo: 'Y', fecha: new Date() });
  const s = new TextDecoder('latin1').decode(b);
  const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)?.[1]);
  assert.equal(s.slice(startxref, startxref + 4), 'xref', 'startxref no apunta a la tabla');
  const tabla = s.slice(startxref).split('\n');
  const [, cuantos] = tabla[1].split(' ').map(Number);
  assert.ok(cuantos > 5);
  for (let id = 1; id < cuantos; id++) {
    const off = Number(tabla[2 + id].slice(0, 10));
    assert.equal(s.slice(off, off + `${id} 0 obj`.length), `${id} 0 obj`, `el offset del objeto ${id} está corrido`);
  }
});

test('el PDF se LEE de vuelta: nombre, secciones, acentos, ñ y pie', async () => {
  const b = pdfDeOferta(ejemplo(), { negocio: 'Nutrición Ñandú', titulo: 'Mi oferta', fecha: new Date('2026-10-11T15:00:00Z') });
  const { texto, paginas } = await leerPdf(b);
  assert.ok(paginas >= 1);
  assert.match(texto, /Reto Plato Fuerte/);
  assert.match(texto, /Diagnóstico/);
  assert.match(texto, /La propuesta que te armo/);
  assert.match(texto, /Nutrición Ñandú/, 'los acentos o la ñ no llegaron');
  assert.match(texto, /mamás que trabajan/);
  assert.match(texto, /1 \//, 'falta el pie con el número de página');
});

// v2 (11/10/2026): el diagnóstico de FASE del negocio, que en el chat no se muestra, va al PDF con los
// textos de lib/fase-diagnostico.ts. Sin `fase` (las conclusiones de la v1) la sección no aparece.
// rotura (pdfDeOferta sin llamar a seccionFase): 1 fallo, 8 pases. rotura (la sección con el objetivo de
// OTRA fase: faseDef(d.fase + 1)): 1 fallo, 8 pases.
test('el diagnóstico del negocio entra al PDF: fase, cuello y lo que significa; sin fase no aparece', async () => {
  const c = ejemplo();
  c.fase = diagnosticar([1, 1, 1, 0, 1, 2], 'llamadas');
  const f = faseDef(c.fase.fase);
  const { texto } = await leerPdf(pdfDeOferta(c, { negocio: 'X', titulo: 'Y', fecha: new Date() }));
  const plano = texto.replace(/\s+/g, ' ');
  assert.match(plano, /El diagnóstico de tu negocio/);
  assert.match(plano, new RegExp(`Fase ${f.id} de 5: ${f.nombre}`));
  assert.ok(plano.includes(f.cuelloLabel), 'falta el cuello de botella');
  assert.ok(plano.includes(f.objetivo.slice(0, 40)), 'falta lo que significa la fase');
  assert.ok(plano.includes('Llamada de venta'), 'falta el canal');
  assert.ok(plano.indexOf('El diagnóstico de tu negocio') < plano.indexOf('Diagnóstico de tu oferta'), 'el del negocio va antes que el de la oferta');
  const sinFase = await leerPdf(pdfDeOferta(ejemplo(), { negocio: 'X', titulo: 'Y', fecha: new Date() }));
  assert.doesNotMatch(sinFase.texto, /El diagnóstico de tu negocio/);
});

// Revisión adversarial (11/10/2026): la oferta armada con preguntas del diagnóstico PENDIENTES no omite la
// sección en silencio: la dibuja y dice cuántas faltan. Con la fase, gana la fase.
// rotura (pdfDeOferta sin llamar a seccionFaseFaltante): 1 fallo, 9 pases (base en verde: 10 de 10).
test('con el diagnóstico a medias, el PDF lo dice (contestadas de total) en vez de omitir la sección', async () => {
  const c = ejemplo();
  c.diagnosticoFaltante = { contestadas: 2, total: 6 };
  const plano = (await leerPdf(pdfDeOferta(c, { negocio: 'X', titulo: 'Y', fecha: new Date() }))).texto.replace(/\s+/g, ' ');
  assert.match(plano, /El diagnóstico de tu negocio/);
  assert.match(plano, /contestaste 2 de 6 preguntas/);
  assert.ok(plano.indexOf('El diagnóstico de tu negocio') < plano.indexOf('Diagnóstico de tu oferta'));
  // Con la fase, la fase (lo que falta no aplica).
  c.fase = diagnosticar([1, 1, 1, 0, 1, 2], 'llamadas');
  const conFase = (await leerPdf(pdfDeOferta(c, { negocio: 'X', titulo: 'Y', fecha: new Date() }))).texto.replace(/\s+/g, ' ');
  assert.doesNotMatch(conFase, /contestaste/);
});

test('el texto con paréntesis y barra invertida se lee entero', async () => {
  const b = pdfDeOferta(ejemplo(), { negocio: 'X', titulo: 'Y', fecha: new Date() });
  const { texto } = await leerPdf(b);
  assert.match(texto, /\(incluye chat\)/);
  assert.match(texto, /barra \\ invertida/);
});

test('un texto largo pasa a varias páginas y no tira', async () => {
  const c = ejemplo();
  c.propuesta.numeros = Array.from({ length: 140 }, (_, i) => `Número ${i + 1}: una línea larga para forzar el salto de página con texto que ocupa lugar de verdad.`);
  const b = pdfDeOferta(c, { negocio: 'X', titulo: 'Y', fecha: new Date() });
  const { paginas, texto } = await leerPdf(b);
  assert.ok(paginas >= 3, `esperaba varias páginas, salieron ${paginas}`);
  assert.match(texto, /Número 140/);
});

test('nombreArchivoOferta es ASCII puro y termina en .pdf', () => {
  const n = nombreArchivoOferta('Oferta — Mentoría ñandú', 2);
  assert.match(n, /^[\x20-\x7e]+$/, `no es ASCII: ${n}`);
  assert.ok(n.endsWith('-v2.pdf'));
  assert.equal(nombreArchivoOferta('', 0), 'oferta-oferta-v1.pdf');
});

test('el saneador descarta el emoji y ✦, y los anota; las flechas pasan a un equivalente', () => {
  const r = textoParaPdf('Hola 🚀 MaKo ✦ antes → después «ok» — ñ');
  assert.ok(!r.texto.includes('🚀'));
  assert.ok(!r.texto.includes('✦'));
  assert.ok(r.texto.includes('›'), 'la flecha no se reemplazó');
  assert.ok(r.texto.includes('«ok» — ñ'), 'tocó caracteres que WinAnsi sí tiene');
  assert.deepEqual(r.descartes.sort(), ['✦', '🚀'].sort());
});

test('el documento junta los descartes de todo lo que dibujó', () => {
  const d = new PdfDoc();
  d.texto('uno 😀 dos');
  d.textoRico([{ t: 'tres ★' }]);
  assert.deepEqual(d.descartes.sort(), ['★', '😀'].sort());
});

// «A definir» (12/10/2026): lo que falta para estar lista (tarjeta «lista»), precio y bonos provisionales
// (tarjeta «rehacer»), los avisos de las reglas (tarjeta «reglas-ia») y, AL FINAL y separado de los datos a
// completar, lo que propuso MaKo y los supuestos (tarjeta «supuestos»). Sin esos campos (las conclusiones
// anteriores) no aparece nada de eso.
// rotura (sin la caja del control final): 1 fallo, 10 pases (base en verde: 11 de 11). rotura (sin marcar la sección de bonos como provisional):
// 1 fallo, 10 pases (base en verde: 11 de 11). rotura (sin la sección «Lo que propuso MaKo»): 1 fallo, 10 pases (base en verde: 11 de 11).
test('el PDF: lo que falta para estar lista, lo provisional, los avisos y lo que propuso MaKo al final', async () => {
  const c = ejemplo();
  c.calculo = {
    ...c.calculo,
    controlFinal: [
      { punto: 'dolor', ok: true, porque: 'El problema está claro y la promesa lo ataca.' },
      { punto: 'precio', ok: false, porque: 'Precio y cobro saca 4: el precio no se justifica con el valor del resultado.' },
    ],
  };
  c.provisional = { partes: ['precio', 'bonos'], motivo: 'Cliente ideal saca 3: el precio y los bonos dependen de arreglar eso primero.' };
  c.propuesta = {
    ...c.propuesta,
    avisos: ['El programa dura 84 días según el formato: el marco pide de 90 a 180 días, con un resultado definido.'],
    propuestoPorMako: [{ seccion: 'Inversión', que: 'Precio: 1.200 USD' }, { seccion: 'Método', que: 'Nombres: Plato en 3 pasos' }],
    supuestos: ['Prueba: no lleva la cuenta'],
  };
  const plano = (await leerPdf(pdfDeOferta(c, { negocio: 'X', titulo: 'Y', fecha: new Date() }))).texto.replace(/\s+/g, ' ');
  assert.match(plano, /Para estar lista para vender falta/);
  assert.match(plano, /Precio por valor: Precio y cobro saca 4/);
  assert.doesNotMatch(plano, /Dolor urgente:/, 'sólo los puntos que fallan');
  assert.match(plano, /Precio y bonos provisionales/);
  assert.match(plano, /Bonos \(provisional\)/);
  assert.match(plano, /Inversión \(provisional\)/);
  assert.match(plano, /Revísalo antes de usarla/);
  assert.match(plano, /84 días/);
  assert.match(plano, /Lo que propuso MaKo/);
  assert.match(plano, /Inversión: Precio: 1\.200 USD/);
  assert.match(plano, /Supuestos \(lo que no sabías\)/);
  assert.match(plano, /Prueba: no lleva la cuenta/);
  assert.ok(plano.indexOf('Siguiente escalón') < plano.indexOf('Lo que propuso MaKo'), 'va al final');
  assert.ok(plano.indexOf('datos para completar') < plano.indexOf('Lo que propuso MaKo'), 'separado de los datos a completar');
  const antes = (await leerPdf(pdfDeOferta(ejemplo(), { negocio: 'X', titulo: 'Y', fecha: new Date() }))).texto;
  for (const x of ['Para estar lista', 'provisional', 'Revísalo antes', 'Lo que propuso MaKo']) assert.ok(!antes.includes(x), `una conclusión vieja no trae «${x}»`);
});

// ── El PDF en DOS partes (16/10/2026) ───────────────────────────────────────
// Feedback de Martín en la llamada con Leila (12/10, 00:45:30): «primero te tienen que decir… de tu oferta me gustó
// esto, esto y esto, y esto lo cambiaría y haría tal forma. Y por el otro lado… esta es la propuesta que yo te armo».
// Antes la única separación era un título, la portada ponía el nombre de la oferta NUEVA arriba del puntaje de la de
// HOY, lo bueno era una sola frase y el «cómo subirla» de cada parte no llegaba al PDF.
// PROBADO ROMPIÉNDOLO (16/10/2026, arnés romper-pdf.mjs): base 13/0; cada rotura cae, «1 fallo, 12 pases» (la de la
// portada, 2): la propuesta no abre su página · la portada con el nombre de la oferta nueva · sin la lista de lo que
// me gustó · sin «para subir cada parte» · el puntaje después de la segunda parte · las notas altas no suman · lo que
// me gustó con repetidas · lo que sube, sin ordenar · el parser no saca repetidas · una conclusión vieja queda sin
// fortalezas · la pantalla sigue con una sola frase.
test('dos partes: «Tu oferta hoy» (lo que me gustó, lo que cambiaría y cómo) y, en otra página, «La propuesta que te armo»', async () => {
  const c = ejemplo();
  c.diagnostico.fuertes = ['Tienes casos reales: «12 mamás ya bajaron 5 kilos».', 'Cupos claros por grupo.'];
  const { texto, paginas } = await leerPdf(pdfDeOferta(c, { negocio: 'Nutrición Ñandú', titulo: 'Mi oferta', fecha: new Date() }));
  const plano = texto.replace(/\s+/g, ' ');
  const i1 = plano.indexOf('Tu oferta hoy');
  const i2 = plano.indexOf('La propuesta que te armo');
  assert.ok(i1 > 0 && i2 > i1, 'las dos partes, en orden');
  // La segunda parte ABRE su página: es la primera cosa de la página donde está, y la primera parte no está ahí.
  const porPagina = await paginasPdf(pdfDeOferta(c, { negocio: 'Nutrición Ñandú', titulo: 'Mi oferta', fecha: new Date() }));
  const p2 = porPagina.findIndex((x) => x.includes('La propuesta que te armo'));
  assert.ok(p2 > 0 && paginas >= 2, 'la propuesta no va en otra página');
  const inicio = porPagina[p2].replace(/\s+/g, ' ').trim();
  assert.match(inicio, /^PARTE 2 La propuesta que te armo/, `la segunda parte no abre su página: «${inicio.slice(0, 80)}»`);
  assert.ok(!porPagina[p2].includes('Tu oferta hoy'));
  // La portada no lleva el nombre de la oferta nueva: aparece recién en la segunda parte.
  assert.ok(plano.indexOf('Reto Plato Fuerte') > i2, 'el nombre de la oferta nueva quedó arriba, con la de hoy');
  assert.match(plano.slice(0, i1), /La oferta de Nutrición Ñandú/);
  assert.ok(plano.indexOf('PUNTAJE') > i1 && plano.indexOf('PUNTAJE') < i2, 'el puntaje es de la oferta de hoy');
  // Lo que me gustó: la lista entera, en la primera parte.
  const iG = plano.indexOf('Lo que me gustó');
  assert.ok(iG > i1 && iG < i2);
  assert.ok(plano.includes('12 mamás ya bajaron 5 kilos') && plano.includes('Cupos claros por grupo.'));
  // Lo que cambiaría y CÓMO: los cambios y, parte por parte, lo que sube cada nota floja (la de la pantalla).
  const iC = plano.indexOf('Lo que cambiaría, y cómo');
  assert.ok(iC > iG && iC < i2);
  assert.ok(plano.indexOf('Para subir cada parte') > iC && plano.indexOf('Para subir cada parte') < i2);
  assert.ok(plano.includes('Diferenciación (3/10): Nombrar el método.'), 'falta la mejora de la nota más floja');
  assert.ok(plano.indexOf('Diferenciación (3/10)') < plano.indexOf('Precio y cobro (4/10)'), 'de la más baja a la más alta');
});

test('lo que me gustó y lo que sube cada parte salen de lo que ya dejó el diagnóstico (sin IA nueva)', () => {
  const c = ejemplo();
  // Una conclusión de antes (sin `fuertes`) usa `fuerte`; las notas altas suman su porqué; sin repetidas.
  const gusto = loQueMeGusto(c);
  assert.equal(gusto[0], 'Ya hay 12 clientes que pagaron la misma oferta (validación real).');
  assert.ok(gusto.includes('Cliente ideal: Coaches de nutrición que ya facturan.'), JSON.stringify(gusto));
  assert.ok(!gusto.some((g) => g.startsWith('Promesa')), 'una nota de 6 no es algo que ya hace bien');
  c.diagnostico.fuertes = ['A', 'A', 'B'];
  assert.deepEqual(loQueMeGusto({ ...c, diagnostico: { ...c.diagnostico, dimensiones: [] } }), ['A', 'B']);
  // Lo que sube: sólo las de 5 o menos, de la más baja a la más alta, con su mejora.
  const subir = paraSubirCadaParte(ejemplo());
  assert.deepEqual(subir.map((s) => s.nota), [2, 3, 4, 5]);
  assert.equal(subir[0].mejora, 'Cohorte con fecha.');
  // El parser: hasta 3 fortalezas, sin repetidas; `fuerte` sigue siendo la primera.
  const d = parseDiagnostico({ ...c.diagnostico, fuerte: '', fuertes: ['uno', 'uno', 'dos', 'tres', 'cuatro'] });
  assert.ok(d);
  assert.deepEqual(d.fuertes, ['uno', 'dos', 'tres']);
  assert.equal(d.fuerte, 'uno');
  const viejo = parseDiagnostico({ ...c.diagnostico, fuertes: undefined });
  assert.deepEqual(viejo?.fuertes, ['Ya hay 12 clientes que pagaron la misma oferta (validación real).']);
  // Y la pantalla también muestra la lista (con el rótulo de siempre, que lo lee MaKo Mobile).
  const pantalla = readFileSync(join(import.meta.dirname, '..', 'app/offer/Conclusion.tsx'), 'utf8');
  assert.match(pantalla, /\{d\.fuertes!\.map\(\(f, i\) => <li key=\{i\}><T v=\{f\} \/><\/li>\)\}/);
});
