// =============================================================================
// Replicar POR PARTES: diseño, estructura, ángulos y texto, y la estructura que no pierde secciones (28/10/2026)
// =============================================================================
// Martín (28/10/2026): «una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los
// ángulos de comunicación, los copies». Lo que fija:
//   1. la estructura de una página leída: se corta en su NIVEL DE SECCIÓN, lo de adentro queda como subtítulo y nunca
//      se pierde un renglón (antes: 20 secciones como mucho y las demás afuera, sin aviso: 100ads.ai perdía 13);
//   2. el molde y la fidelidad: lo que se cuenta de cada sección, en la original y en la réplica;
//   3. las partes: sus dependencias (el texto trae la estructura y los ángulos), el pedido viejo, la copia idéntica;
//   4. lo que lee la IA: la instrucción (reglas primero, con tope), la receta de cada combinación;
//   5. los ángulos: el saneo de lo que devuelve el modelo, y su prompt registrado en /configuraciones;
//   6. los enchufes del server: la ruta, replicar(), la lectura y el esquema importado.
// Correr: node --import tsx --test tests/web-generator-replicar-partes.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  esquemaDeReplica, fidelidadDeEstructura, juntarHasta, moldeDeEsquema, moldeDeSeccion, nivelDeSeccion, resumenDeMolde, textoDeMolde,
} from '../lib/editor-landing/replicar-estructura';
import {
  PARTES_ADAPTAR, PARTES_INICIALES, PARTES_TODAS, TOPE_INSTRUCCION, alternarParte, formatoConPartes, instruccionDePartes,
  nombreDeCopia, partesDePedido, recetaDePartes,
} from '../lib/editor-landing/replicar-partes';
import { ANGULOS_SYSTEM_TEMPLATE, ANGULOS_USER_TEMPLATE, sanearAngulos, seccionesParaAngulos, textoDeAngulos } from '../lib/editor-landing/replicar-angulos';
import { MAX_SECCIONES, quitarPruebaDeLaOriginal, slotsDe, tarjetaDesdeEsquema } from '../lib/editor-landing/ia-reglas';
import { configDeReplica } from '../lib/editor-landing/replicar-reglas';

const RAIZ = join(__dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

/** Una página como la de 100ads.ai, con la forma que la lee el extractor: 1 h1, 12 h2 y 20 h3 (33 títulos). */
function paginaLarga(): string {
  const r: string[] = ['Anuncios para productos digitales', '# 100 anuncios en lo que dura un café.', 'Con tu marca. Listos para testear.', '[BOTÓN] Quiero mi acceso'];
  for (let s = 1; s <= 12; s++) {
    r.push(`## Sección ${s}`, `Párrafo de la sección ${s} con varias palabras adentro.`);
    const tarjetas = s <= 8 ? (s % 2 === 0 ? 3 : 2) : 0;
    for (let t = 1; t <= tarjetas; t++) r.push(`### Tarjeta ${s}.${t}`, `• Viñeta ${s}.${t}`);
  }
  return r.join('\n');
}
const renglones = (t: string) => t.split('\n').filter((l) => l.trim()).length;
const renglonesDe = (e: { secciones: { titulo: string; puntos: string[] }[] }) => e.secciones.reduce((n, s) => n + 1 + s.puntos.length, 0);

// PROBADO ROMPIÉNDOLO (28/10/2026, base 9 / 0, una rotura por vez y restaurado por sha256):
//   R1 esquemaDeReplica vuelve a `esquemaConservado` ............ 6 / 3 (1, 1b, 2)
//   R2 el respaldo sin el subtítulo `###` ......................... 7 / 2 (1c, 2)
//   R3 el texto sin traer la estructura y los ángulos ............. 8 / 1 (3)
//   R4 los datos antes de las reglas en la instrucción ............ 8 / 1 (4)
//   R5 sin el filtro de números de sección en sanearAngulos ....... 8 / 1 (5)
//   R6 el registro del prompt con otra variable ................... 8 / 1 (5b)
//   R7 la ruta sin `partes`, `tema` y `angulos` ................... 8 / 1 (6)
test('1. la estructura: se corta en el nivel de sección, lo de adentro queda como subtítulo y no se pierde nada', () => {
  const texto = paginaLarga();
  const h3 = texto.split('\n').filter((l) => l.startsWith('### ')).length;
  assert.ok(1 + 12 + h3 > MAX_SECCIONES, 'la página de prueba pasa el tope si se corta en cada título');
  const e = esquemaDeReplica(texto, 'x');
  assert.equal(e.secciones.length, 13, 'el h1 y los 12 h2');
  // Los renglones: el antetítulo de antes del h1 va adentro de la primera sección, nada se tira.
  assert.equal(renglonesDe(e), renglones(texto));
  assert.equal(e.secciones[0].titulo, '100 anuncios en lo que dura un café.');
  assert.equal(e.secciones[0].puntos[0], 'Anuncios para productos digitales');
  assert.deepEqual(e.secciones[2].puntos, ['Párrafo de la sección 2 con varias palabras adentro.', '### Tarjeta 2.1', '• Viñeta 2.1', '### Tarjeta 2.2', '• Viñeta 2.2', '### Tarjeta 2.3', '• Viñeta 2.3']);
  assert.equal(e.secciones[12].titulo, 'Sección 12', 'la última sección llega');
});

test('1b. el nivel de sección y el tope: si sobran, se juntan las vecinas más chicas, sin tirar texto', () => {
  assert.equal(nivelDeSeccion(['# a', '## b', '## c', '### d']), 2, 'un h1 solo es el hero, y una tarjeta no se suelta aunque sean pocas');
  assert.equal(nivelDeSeccion(['# a', '# b', '# c', '## d', '## e', '## f']), 2, 'h1 en tres bloques: baja a h2');
  assert.equal(nivelDeSeccion(['## a', '## b', '## c', '## d', '### e', '### f']), 2, 'cuatro secciones ya alcanzan: las tarjetas quedan adentro');
  assert.equal(nivelDeSeccion(['texto sin títulos', '# uno']), null);
  // 30 secciones en su nivel: quedan MAX_SECCIONES, con todos los renglones.
  const muchas = Array.from({ length: 30 }, (_, i) => `## S${i + 1}\nTexto ${'x '.repeat(i % 5 === 0 ? 40 : 2)}`).join('\n');
  const e = esquemaDeReplica(muchas, 'x');
  assert.equal(e.secciones.length, MAX_SECCIONES);
  assert.equal(renglonesDe(e), renglones(muchas));
  const j = juntarHasta([{ titulo: 'A', puntos: ['uno dos tres cuatro'] }, { titulo: 'B', puntos: ['b'] }, { titulo: 'C', puntos: ['c'] }], 2);
  assert.deepEqual(j, [{ titulo: 'A', puntos: ['uno dos tres cuatro'] }, { titulo: 'B', puntos: ['b', '### C', 'c'] }], 'se juntan las dos más chicas');
  // Lo pegado por la persona con cortes `---` sigue como siempre.
  assert.equal(esquemaDeReplica('Uno\ntexto\n---\nDos\ntexto', 'x').secciones.length, 2);
});

test('1c. el respaldo sin IA dibuja el subtítulo `###` como título, no como texto', () => {
  const t = tarjetaDesdeEsquema({ titulo: 'Beneficios', puntos: ['### Rápido', 'En minutos.', '### Barato', 'Sin agencia.'] }, false);
  const tipos = (t.content ?? []).map((n) => `${n.type}${n.type === 'heading' ? (n.attrs as { level?: number }).level : ''}`);
  assert.deepEqual(tipos, ['heading2', 'heading3', 'paragraph', 'heading3', 'paragraph']);
  assert.doesNotMatch(JSON.stringify(t), /###/);
});

test('2. el molde de cada sección y la fidelidad de una réplica', () => {
  const m = moldeDeSeccion({ titulo: 'Planes', puntos: ['### Pro', 'Para crecer.', '• Uno', '• Dos', '[BOTÓN] Comprar → https://x.com', '[DESPLEGABLE] ¿Cancelo? → Sí'] });
  assert.deepEqual({ ...m, titulo: '' }, { titulo: '', subtitulos: 1, parrafos: 1, vinetas: 2, botones: 1, desplegables: 1, palabras: 9 });
  assert.equal(resumenDeMolde(m), '1 subtítulo · 1 párrafo · 2 viñetas · 1 botón · 1 pregunta desplegable');
  const e = esquemaDeReplica(paginaLarga(), 'x');
  const moldes = moldeDeEsquema(e);
  assert.match(textoDeMolde(moldes), /^1\. «100 anuncios en lo que dura un café\.»: 2 párrafos · 1 botón \(~/);
  assert.ok(textoDeMolde(moldes, 200).length <= 260, 'con tope, y dice cuántas faltan');
  // La réplica armada desde el mismo esquema tiene la misma estructura.
  const copia = e.secciones.map((s, i) => tarjetaDesdeEsquema(s, i === 0));
  const f = fidelidadDeEstructura(moldes, copia);
  assert.equal(f.secciones.copia, f.secciones.original);
  assert.equal(f.titulos.copia, f.titulos.original);
  assert.equal(f.botones.copia, f.botones.original);
  assert.equal(f.seccionesParejas, e.secciones.length);
  // Una réplica con la mitad de las secciones lo muestra.
  assert.equal(fidelidadDeEstructura(moldes, copia.slice(0, 6)).secciones.copia, 6);
});

test('3. las partes: el texto trae la estructura y los ángulos, nunca quedan las cuatro apagadas', () => {
  assert.deepEqual(PARTES_INICIALES, { diseno: false, estructura: true, angulos: true, texto: false }, 'el caso de Martín');
  const conTexto = alternarParte({ diseno: false, estructura: false, angulos: false, texto: false } as never, 'texto');
  assert.deepEqual(conTexto, { diseno: false, estructura: true, angulos: true, texto: true });
  assert.deepEqual(alternarParte(conTexto, 'estructura'), { diseno: false, estructura: false, angulos: true, texto: false });
  assert.deepEqual(alternarParte(PARTES_TODAS, 'angulos'), { diseno: true, estructura: true, angulos: false, texto: false });
  const sola = { diseno: false, estructura: true, angulos: false, texto: false };
  assert.deepEqual(alternarParte(sola, 'estructura'), sola, 'apagar la última no hace nada');
  // El pedido: sin `partes`, lo de siempre; con `partes`, lo que dice (lista, objeto o texto).
  assert.deepEqual(partesDePedido(undefined), PARTES_TODAS);
  assert.deepEqual(partesDePedido(undefined, true), PARTES_ADAPTAR);
  assert.deepEqual(partesDePedido(['estructura', 'ángulos']), PARTES_INICIALES);
  assert.deepEqual(partesDePedido('diseño, texto'), PARTES_TODAS);
  assert.deepEqual(partesDePedido({ estructura: true, angulos: true }), PARTES_INICIALES);
  assert.equal(partesDePedido([]), null);
  assert.equal(partesDePedido(['marca']), null);
  // La copia idéntica es TODO.
  assert.equal(formatoConPartes('web', PARTES_TODAS), true);
  assert.equal(formatoConPartes('web', PARTES_ADAPTAR), false);
  assert.equal(formatoConPartes('landing', PARTES_INICIALES), true);
  assert.equal(nombreDeCopia(PARTES_TODAS, 'otra.com', 'Su título'), 'Su título');
  assert.equal(nombreDeCopia(PARTES_ADAPTAR, 'otra.com', 'Su título'), 'Adaptada de otra.com');
  assert.equal(nombreDeCopia(PARTES_INICIALES, 'otra.com', 'Su título'), 'Basada en otra.com');
});

test('4. la instrucción: reglas primero, datos al final, con tope; y la receta de cada combinación', () => {
  assert.equal(instruccionDePartes(PARTES_TODAS), null, 'con el texto literal no se escribe nada');
  const i = instruccionDePartes(PARTES_INICIALES, { molde: '1. «Hero»: 2 párrafos', angulos: 'Promesa: más ventas' })!;
  assert.match(i, /ESTRUCTURA \(se toma\)/);
  assert.match(i, /ÁNGULOS \(se toman\): en cada sección, el mismo ángulo/);
  assert.match(i, /no copies frases de la referencia/);
  assert.match(i, /ni su marca, ni sus nombres, ni sus testimonios, ni sus cifras/);
  assert.ok(i.indexOf('TEXTO (no se toma)') < i.indexOf('MOLDE de la referencia'), 'las reglas antes que los datos');
  assert.match(instruccionDePartes({ diseno: true, estructura: true, angulos: false, texto: false })!, /ÁNGULOS \(no se toman\): de la referencia usa SOLO la forma/);
  assert.match(instruccionDePartes({ diseno: false, estructura: false, angulos: true, texto: false })!, /ESTRUCTURA \(no se toma\)/);
  // Con el molde y los ángulos más largos, entra en el tope de ia.ts y la regla de no copiar sigue.
  const larga = instruccionDePartes(PARTES_INICIALES, { molde: 'm'.repeat(1_600), angulos: 'a'.repeat(1_600) })!;
  assert.ok(larga.length <= TOPE_INSTRUCCION, `${larga.length} > ${TOPE_INSTRUCCION}`);
  assert.match(larga, /no copies frases/);
  // La receta: el caso de Martín conserva el esquema de la página y escribe las secciones de nuevo.
  const base = configDeReplica('landing', 'https://otra.com').params!;
  const r = recetaDePartes('landing', base, PARTES_INICIALES, { esquema: 'E', secciones: 'S' });
  assert.equal(r.esquema, 'pagina');
  assert.equal(r.paramsEsquema.modoTexto, 'conservar');
  assert.equal(r.paramsSecciones.modoTexto, 'generar');
  assert.equal(r.paramsSecciones.instrucciones, 'S');
  assert.equal(r.paramsSecciones.fuenteImagenes, 'marcadores', 'nunca fotos de stock');
  assert.equal(r.copiaDiseno, false);
  const sinEstructura = recetaDePartes('landing', base, { diseno: true, estructura: false, angulos: true, texto: false }, { esquema: 'E', secciones: 'S' });
  assert.equal(sinEstructura.esquema, 'generar');
  assert.equal(sinEstructura.paramsEsquema.instrucciones, 'E');
  const tal = recetaDePartes('landing', base, PARTES_TODAS);
  assert.equal(tal.paramsSecciones.modoTexto, 'conservar');
  assert.equal(tal.copiaDiseno, true);
  const pres = recetaDePartes('presentacion', configDeReplica('presentacion', 'https://otra.com').params!, PARTES_INICIALES, { esquema: 'E', secciones: 'S' });
  assert.equal(pres.paramsEsquema.modoTexto, 'generar');
  assert.equal(pres.paramsEsquema.formato, 'presentacion');
});

test('5. los ángulos: el saneo de la salida del modelo y su texto para la réplica', () => {
  assert.equal(sanearAngulos(null), null);
  assert.equal(sanearAngulos({ tono: 'cercano' }), null, 'sin promesa ni dolores no es una lectura');
  const a = sanearAngulos({
    promesa: '  100 anuncios en lo que dura un café  ', dolores: ['El anuncio se quema', '', 7, ...Array(10).fill('otro')],
    forma_de_venta: 'Compra directa con garantía', pruebaSocial: ['Testimonios en video'],
    secciones: [{ n: 2, tipo: 'Prueba', angulo: 'Casos por rubro' }, { n: 1, tipo: 'hero', angulo: 'Velocidad' }, { n: 1, tipo: 'x' }, { n: 99, tipo: 'cierre' }, { n: 3, tipo: 'nada' }],
  }, 5)!;
  assert.equal(a.promesa, '100 anuncios en lo que dura un café');
  assert.equal(a.dolores.length, 6);
  assert.equal(a.formaDeVenta, 'Compra directa con garantía', 'acepta el nombre con guion bajo');
  assert.deepEqual(a.secciones, [{ n: 1, tipo: 'hero', angulo: 'Velocidad' }, { n: 2, tipo: 'prueba', angulo: 'Casos por rubro' }, { n: 3, tipo: 'otro', angulo: '' }]);
  const esq = { titulo: 'x', secciones: [{ titulo: 'Portada', puntos: [] }, { titulo: 'Casos', puntos: [] }, { titulo: 'Cierre', puntos: [] }] };
  const sin = textoDeAngulos(a);
  assert.match(sin, /Promesa: 100 anuncios/);
  assert.doesNotMatch(sin, /Ángulo de cada sección/);
  assert.match(textoDeAngulos(a, { esquema: esq, porSeccion: true }), /2\. «Casos» Prueba social: Casos por rubro/);
  assert.ok(textoDeAngulos(a, { tope: 50 }).length <= 50);
  // Lo que se le manda: cada sección con su parte del tope (las del final también llegan).
  const largo = { titulo: 'x', secciones: Array.from({ length: 10 }, (_, k) => ({ titulo: `S${k + 1}`, puntos: ['p '.repeat(2_000)] })) };
  const enviado = seccionesParaAngulos(largo, 6_000);
  assert.match(enviado, /=== SECCIÓN 10: S10 ===/);
  assert.ok(enviado.length < 6_500);
});

test('5b. el prompt de los ángulos está en el registro con SU key, SU default y exactamente SUS slots', () => {
  const reg = fuente('lib/prompt-registry.ts');
  assert.match(reg, /from '\.\/editor-landing\/replicar-angulos';/);
  for (const [key, alias, tpl] of [
    ['landing_editor.angulos.system', 'LANDING_EDITOR_ANGULOS_SYSTEM', ANGULOS_SYSTEM_TEMPLATE],
    ['landing_editor.angulos.user', 'LANDING_EDITOR_ANGULOS_USER', ANGULOS_USER_TEMPLATE],
  ] as const) {
    const i = reg.indexOf(`key: '${key}'`);
    assert.ok(i > 0, `falta ${key}`);
    const fila = reg.slice(i, reg.indexOf('context:', i));
    assert.match(fila, new RegExp(`default: ${alias},`));
    assert.deepEqual([...fila.matchAll(/v\('(\w+)'/g)].map((m) => m[1]).sort(), slotsDe(tpl).sort());
  }
  const lectura = fuente('lib/editor-landing/replicar-lectura.ts');
  assert.match(lectura, /system: \{ key: 'landing_editor\.angulos\.system', tpl: ANGULOS_SYSTEM_TEMPLATE \}/);
  assert.match(lectura, /user: \{ key: 'landing_editor\.angulos\.user', tpl: ANGULOS_USER_TEMPLATE \}/);
  assert.match(lectura, /renderPrompt\(PROMPTS_ANGULOS\.system\.key, PROMPTS_ANGULOS\.system\.tpl, \{ tipos: /);
  assert.match(lectura, /renderPrompt\(PROMPTS_ANGULOS\.user\.key, PROMPTS_ANGULOS\.user\.tpl, \{\s*pagina: [^,]+,\s*contenido: contenidoNoConfiable\(/);
  assert.match(lectura, /feature: FEATURE_GENERAR/, 'la IA del negocio, la misma de crear');
});

test('4b. la réplica escrita de nuevo no se queda con las citas ni las cifras de la original (en código, no en el prompt)', () => {
  const original = 'Literalmente despegó mi facturación, despegó mi negocio. +3.000 marcas que pasaron por 100ads. 3 pasos simples.';
  const item = (valor: string, texto: string) => ({ type: 'optimizadoItem', attrs: { valor }, content: [{ type: 'paragraph', content: [{ type: 'text', text: texto }] }] });
  const t = {
    type: 'tarjeta', content: [
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Literalmente despegó mi facturación, despegó mi negocio.' }] }] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: '[Testimonio real de un cliente tuyo]' }] }] },
      { type: 'optimizado', attrs: { variante: 'numeros-grandes' }, content: [item('+3.000', 'marcas'), item('3', 'pasos'), item('[00]%', 'clientes')] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Literalmente despegó mi facturación, despegó mi negocio y el de cientos.' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Tu equipo agenda más reuniones con la misma inversión en anuncios.' }] },
    ],
  };
  const r = quitarPruebaDeLaOriginal(t as never, original);
  assert.equal(r.quitados, 2, 'la cita textual y el +3.000');
  assert.equal(r.copiadas, 1, 'la frase igual a la original se cuenta, la nueva no');
  const json = JSON.stringify(r.tarjeta);
  assert.doesNotMatch(json, /"text":"Literalmente despegó mi facturación, despegó mi negocio\."/);
  assert.match(json, /\[Testimonio real de un cliente tuyo\]/, 'el marcador honesto se queda');
  assert.match(json, /"valor":"3"/, '«3 pasos» no es una cifra de nadie');
  assert.match(json, /"valor":"\[00\]%"/);
  assert.match(fuente('lib/editor-landing/replicar.ts'), /const f = quitarPruebaDeLaOriginal\(t, original\);/);
});

test('6. los enchufes: la ruta, replicar(), la lectura y el esquema importado', () => {
  const ruta = fuente('app/api/landing-generator/replicar/route.ts');
  assert.match(ruta, /partes: body\.partes, tema: body\.tema, angulos: body\.angulos/);
  const leer = fuente('app/api/landing-generator/replicar/leer/route.ts');
  assert.match(leer, /if \(rol !== 'admin'\) return falla\(403/);
  assert.match(leer, /tabEnCapa\('landing-writer'/);
  assert.match(leer, /leerParaReplicar\(\{ url: body\.url, lectura: body\.lectura, texto: body\.texto \}\)/);
  const rep = fuente('lib/editor-landing/replicar.ts');
  assert.match(rep, /const partes = partesDePedido\(p\.partes, p\.adaptar === true\);/);
  assert.match(rep, /if \(!formatoConPartes\(formato, partes\)\) return falla\(ERROR_WEB_PARCIAL, 400, 'landing'\);/);
  assert.match(rep, /!partes\.diseno \? Promise\.resolve\(null\)/, 'sin el diseño no se lee el estilo de la original');
  assert.match(rep, /partes\.diseno \? await temaParaLaCopia\(estilo, url\)/);
  assert.match(rep, /pedirEsquema\(\{ modo: 'generar', prompt: PEDIDO_SIN_ESTRUCTURA, params \}\)/);
  assert.match(rep, /crearLanding\(nombreDeCopia\(partes, hostDe\(url\), esq\.titulo\), contenido, config\)/);
  const ia = fuente('lib/editor-landing/ia.ts');
  assert.match(ia, /p\.modo === 'importar' \? esquemaDeReplica\(texto, tituloFallback\) : esquemaConservado\(texto, tituloFallback\)/);
});
