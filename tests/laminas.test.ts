// =============================================================================
// Las portadas DISEÑADAS de un módulo (item 5 del curso tipo Skool, 07/10/2026)
// =============================================================================
// Pedido de Martín: «Las portadas de 01 . Bienvenida que están diseñadas por nosotros, deberían
// aparecer también en la selección de portadas… se debería poder editar el texto que aparece debajo
// del número… varios diseños… que se pueda editar los colores y el texto. Ten cuidado de poner un
// límite de caracteres, para que no rompan el diseño de la portada.»
//
// Lo que se EJECUTA: el saneo y la ida y vuelta del valor `lam:` (lib/laminas.ts), que el saneo del
// curso lo acepte donde se dibuja (lib/curso-estilo.ts), cada diseño dibujado con el texto MÁS LARGO
// permitido y vacío, el contraste del texto con colores elegidos a propósito mal, y los ids de dos
// láminas en la misma página. Lo que se LEE del fuente: que el selector sin `disenos` siga siendo el
// de siempre.
//
// ── Roturas (07/10/2026) ─────────────────────────────────────────────────────
// Corridas con este archivo y tests/curso-estilo.test.ts juntos: sanos, 42 pass / 0 fail. Rompiendo
// UNA cosa por vez sobre el archivo real (restaurado de memoria y comprobado con md5; nunca con git):
//   · el diseño leído de un objeto común («constructor» existe)          → 40 / 2
//   · el texto sin tope · sin encodeURIComponent                          → 41 / 1 · 40 / 2
//   · los controles borrados antes de volver espacio el salto             → 41 / 1
//   · la portada del CURSO aceptando láminas · tapaDe sin la lámina       → 41 / 1 cada una
//   · tintaSobre sin el respaldo de negro/blanco puros                    → 40 / 2
//   · sin partir las palabras larguísimas (comun.tsx)                     → 41 / 1
//   · el cuaderno sin partir las del texto elegido                        → 41 / 1
//   · el id de la lámina sin la `instancia`                               → 41 / 1
//   · el cuaderno hasheando sólo n + título (el choque que había)         → 39 / 3
//   · un diseño del catálogo sin su dibujo                                → 40 / 2
//   · la nota con tres renglones (el peor texto baja a 10,1)              → 41 / 1
//   · la pizarra con la tiza blanca fija (no mira el pizarrón)            → 41 / 1
//   · el kraft dibujando con otro reparto que el que exporta              → 41 / 1
//   · el cuaderno de siempre guardado como copia y no como null           → 41 / 1
//   · el selector con la pestaña Diseños aunque no le pasen `disenos`     → 41 / 1
// La interacción del selector (pestañas, elegir, tipear con espera, el contador, «Usar el nombre»,
// «Sin portada» ganándole a lo pendiente, lo pendiente mandado al cerrar) se probó aparte en Chrome
// con un arnés armado con esbuild, fuera de Next: 21 de 21.
//
// ── Revisión adversarial (08/10/2026) ───────────────────────────────────────
// Lo que la primera versión dejaba pasar en VERDE, y cómo cae ahora (este archivo solo: 21 tests antes
// de la revisión, 24 después, sanos 24 / 0; cada rotura sobre el archivo real, restaurada de memoria
// y comparada por md5):
//   · la pizarra pintando el texto con la tiza CLARA fija: daba VERDE (el assert buscaba la tinta en
//     CUALQUIER `fill`, y el rótulo la tiene). Ahora mira el `<g>` del texto             → 23 / 1
//   · sin `\p{Cs}` en el saneo: un `lam:` con medio emoji hacía TIRAR a `sanearAjuste`     → 23 / 1
//   · las mayúsculas con `toLocaleUpperCase` pelado (la ß se vuelve SS: 30 letras → 60)    → 22 / 2
//   · `conChipDeNumero` siempre en true (el chip tapa el rótulo del póster) · la nota sin chip → 23 / 1 cada una
//   · «Sin portada» sin avisarle a la pestaña · el botón diciendo «del módulo»             → 23 / 1 cada una
// El arnés de Chrome (fuera del repo) midió, con el selector REAL: «Sin portada» sobre una portada
// vacía y con texto esperando mandaba `null` y DESPUÉS la lámina (ganaba lo tipeado); hoy manda sólo
// `null`. Y un campo con medio emoji desmontaba el selector entero («URI malformed»); hoy guarda el
// texto sin la mitad suelta.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DISENOS_LAMINA, DISENO_DEFAULT, disenoLamina, esLamina, hexLamina, leerLamina, sanearLamina, textoLamina,
  valorDeLamina, type ValorLamina,
} from '../lib/laminas';
import { ACENTOS, ACENTO_DEFAULT, armarEstilo, contraste, sanearAjuste, tapaDe } from '../lib/curso-estilo';
import {
  DISENOS_DIBUJADOS, LAMINAS, Lamina, coloresDeLamina, conChipDeNumero, esLaminaDeSiempre, valorElegido,
} from '../app/_cursos/laminas/index';
import { CLARO, MEDIR, mayusculas, repartoDe, textoDeLamina, tintaSobre } from '../app/_cursos/laminas/comun';
import { brochaLegible } from '../app/_cursos/laminas/cuaderno';
import { LIMA_BROCHA, LIMA_STICKER, PortadaModulo, TINTA, TIT_FS_PISO, h32 } from '../app/conocimientos/PortadaModulo';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const dibujar = (p: Parameters<typeof Lamina>[0]) => renderToStaticMarkup(createElement(Lamina, p));
const ids = (html: string) => [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const PICSUM = 'https://picsum.photos/id/10/800/450';

// ── El saneo ─────────────────────────────────────────────────────────────────

test('leer: un diseño que no es del catálogo no es una lámina, ni siquiera los nombres del prototipo', () => {
  for (const d of ['inventado', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', 'CUADERNO']) {
    assert.equal(leerLamina(`lam:${d}:DCF35F:D5F240:`), null, `«${d}» pasó como diseño`);
    assert.equal(disenoLamina(d), null);
  }
  assert.equal(leerLamina(null), null);
  assert.equal(leerLamina(42), null);
  assert.equal(leerLamina('grad:menta'), null);
  assert.equal(leerLamina(PICSUM), null);
  assert.equal(leerLamina('lam:cuaderno:DCF35F:D5F240'), null, 'sin el campo del texto');
});

test('leer: los colores son seis cifras hex sin «#»; cualquier otra cosa no es una lámina', () => {
  for (const [a, b] of [['GGGGGG', 'D5F240'], ['#DCF35F', 'D5F240'], ['DCF', 'D5F240'], ['DCF35F', ''], ['DCF35F0', 'D5F240'], ['red', 'blue']]) {
    assert.equal(leerLamina(`lam:pizarra:${a}:${b}:Hola`), null, `${a}/${b} pasó`);
  }
  // En minúsculas sí, y vuelve en la forma canónica.
  assert.deepEqual(leerLamina('lam:pizarra:2e4a3b:f4d35e:Hola'), { diseno: 'pizarra', a: '#2E4A3B', b: '#F4D35E', texto: 'Hola' });
  assert.equal(hexLamina('abc'), '#AABBCC');
  assert.equal(hexLamina('#12345'), null);
});

test('leer: el texto puede traer «:» (crudo o codificado), un % roto no es una lámina, y vacío es el nombre', () => {
  assert.equal(leerLamina('lam:nota:FFE66D:E4572E:Paso 1: hola: chau')?.texto, 'Paso 1: hola: chau');
  assert.equal(leerLamina('lam:nota:FFE66D:E4572E:Paso%201%3A%20hola')?.texto, 'Paso 1: hola');
  assert.equal(leerLamina('lam:nota:FFE66D:E4572E:100%'), null, 'un % sin sus dos cifras');
  assert.equal(leerLamina('lam:nota:FFE66D:E4572E:')?.texto, '');
  assert.equal(leerLamina(`lam:nota:FFE66D:E4572E:${'x'.repeat(2000)}`), null, 'un valor absurdo de largo ni se lee');
});

test('el texto: UNA línea, sin pictogramas ni controles, y el tope del diseño contado en caracteres', () => {
  const nota = disenoLamina('nota')!;
  assert.equal(textoLamina('  Hola\n\tmundo  ', 30), 'Hola mundo', 'el salto de línea es un espacio, no se pega');
  assert.equal(textoLamina('\u{1F4CA} Métricas\u200D', 30), 'Métricas');
  const largo = leerLamina(`lam:nota:FFE66D:E4572E:${encodeURIComponent('ñ'.repeat(80))}`)!;
  assert.equal(Array.from(largo.texto).length, nota.tope, 'uno largo se RECORTA al tope, no se rechaza (una fila vieja se sigue dibujando)');
  // NFD: la tilde suelta no cuenta como un carácter más.
  assert.equal(textoLamina('Ñandú'.normalize('NFD'), 5), 'Ñandú');
  assert.equal(sanearLamina({ diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: 'x'.repeat(99) })!.texto.length, nota.tope);
});

test('un surrogate suelto (medio emoji pegado) no hace tirar ni al saneo del server ni al selector', () => {
  // `encodeURIComponent` TIRA con un surrogate suelto («URI malformed»), y `valorDeLamina` promete
  // no fallar nunca: lo llaman `sanearAjuste` en el server y el efecto del selector que arma lo
  // pendiente (que, al tirar, desmontaba el árbol entero). Se arma con `fromCharCode` a propósito.
  const medio = String.fromCharCode(0xd83d);
  assert.equal(sanearAjuste({ tipo: 'portada-etapa', etapa: 'bienvenida' }, `lam:nota:FFE66D:E4572E:Hola${medio}`), 'lam:nota:FFE66D:E4572E:Hola');
  assert.equal(valorDeLamina({ diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: `a${medio}b` }), 'lam:nota:FFE66D:E4572E:ab');
  assert.equal(textoLamina(`x${String.fromCharCode(0xdc00)}`, 30), 'x');
  assert.equal(valorElegido({ diseno: 'cuaderno', a: '#FFFFFF', b: '#D5F240', texto: medio }, null), 'lam:cuaderno:FFFFFF:D5F240:');
});

// ── La ida y la vuelta ───────────────────────────────────────────────────────

test('ida y vuelta: lo que se guarda se lee igual, y el string es canónico', () => {
  const casos: ValorLamina[] = [
    { diseno: 'cuaderno', a: '#DCF35F', b: '#D5F240', texto: '' },
    { diseno: 'pizarra', a: '#2e4a3b', b: '#f4d35e', texto: 'Paso 1: 100% #listo ¿ya?' },
    { diseno: 'plano', a: '#1D4E89', b: '#FFD166', texto: 'Año ñandú / «comillas» & más' },
    { diseno: 'entrada', a: '#000', b: '#fff', texto: '  dos   espacios  ' },
  ];
  for (const l of casos) {
    const v = valorDeLamina(l);
    assert.ok(esLamina(v) && v.split(':').length === 5, `${v}: el texto codificado no trae «:»`);
    assert.deepEqual(leerLamina(v), sanearLamina(l), v);
    assert.equal(valorDeLamina(leerLamina(v)!), v, 'leer y volver a escribir da el MISMO string');
  }
  // valorDeLamina no falla nunca: lo arma la pantalla.
  assert.equal(valorDeLamina({ diseno: 'inventado', a: 'rojo', b: '', texto: 'x' }), 'lam:cuaderno:DCF35F:D5F240:x');
  assert.equal(valorDeLamina({ diseno: 'nota', a: 'zzz', b: '#123', texto: '' }), 'lam:nota:FFE66D:112233:');
});

test('el curso guarda y lee láminas en las portadas de etapa y de clase, y en la del curso NO', () => {
  const v = 'lam:pizarra:2e4a3b:F4D35E:Paso 1: hola';
  const canon = 'lam:pizarra:2E4A3B:F4D35E:Paso%201%3A%20hola';
  assert.equal(sanearAjuste({ tipo: 'portada-etapa', etapa: 'bienvenida' }, v), canon);
  assert.equal(sanearAjuste({ tipo: 'portada-clase', clase: 7 }, v), canon);
  assert.equal(sanearAjuste({ tipo: 'portada' }, v), null, 'la portada del curso no tiene número: nada dibujaría la lámina');
  assert.equal(sanearAjuste({ tipo: 'portada-etapa', etapa: 'bienvenida' }, 'lam:constructor:2E4A3B:F4D35E:'), null);
  // Lo de siempre sigue andando por el mismo camino.
  assert.equal(sanearAjuste({ tipo: 'portada-etapa', etapa: 'bienvenida' }, 'grad:menta'), 'grad:menta');
  assert.equal(sanearAjuste({ tipo: 'portada-clase', clase: 7 }, PICSUM), PICSUM);
  const e = armarEstilo([
    { clave: 'portada:etapa:bienvenida', valor: v },
    { clave: 'portada:clase:3', valor: 'lam:nota:FFE66D:E4572E:' },
    { clave: 'portada:etapa:otra', valor: 'lam:inventado:FFE66D:E4572E:' },
    { clave: 'portada', valor: v },
  ]);
  assert.equal(e.portadasEtapa.bienvenida, canon);
  assert.equal(e.portadasClase[3], 'lam:nota:FFE66D:E4572E:');
  assert.equal(e.portadasEtapa.otra, undefined, 'una fila con un diseño que ya no existe vuelve al default');
  assert.equal(e.portada, null);
});

test('tapaDe reconoce una lámina y la entrega para dibujar (ni foto ni degradado)', () => {
  assert.deepEqual(tapaDe('lam:nota:FFE66D:E4572E:Hola'), { lamina: { diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: 'Hola' } });
  assert.deepEqual(tapaDe('lam:nota:FFE66D:E4572E:'), { lamina: { diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: '' } });
  assert.deepEqual(tapaDe('lam:inventado:FFE66D:E4572E:'), {}, 'una lámina rota no es una foto ni un degradado: es nada');
  assert.deepEqual(tapaDe(PICSUM), { tapa: PICSUM });
  assert.ok(tapaDe('grad:menta').fondo?.startsWith('linear-gradient('));
});

// ── El catálogo ──────────────────────────────────────────────────────────────

test('el catálogo: al menos seis diseños, cada uno con su dibujo, y el cuaderno es el default con los limas medidos', () => {
  const ids_ = DISENOS_LAMINA.map((d) => d.id);
  assert.ok(ids_.length >= 6, `hay ${ids_.length} diseños`);
  assert.equal(new Set(ids_).size, ids_.length);
  assert.deepEqual([...DISENOS_DIBUJADOS].sort(), [...ids_].sort(), 'un diseño sin dibujo (o un dibujo sin fila) no se puede elegir');
  assert.deepEqual(LAMINAS.map((d) => d.id), ids_, 'el selector los ofrece en el orden del catálogo');
  assert.equal(DISENO_DEFAULT, 'cuaderno');
  for (const d of DISENOS_LAMINA) {
    assert.match(d.id, /^[a-z]+$/);
    assert.equal(hexLamina(d.a), d.a);
    assert.equal(hexLamina(d.b), d.b);
    assert.ok(d.tope >= 24 && d.tope <= 40, `${d.id}: tope ${d.tope}`);
    assert.ok(d.colorA && d.colorB && Array.from(d.colorA).length <= 12, `${d.id}: rótulos de color`);
  }
  const cuaderno = disenoLamina('cuaderno')!;
  assert.equal(cuaderno.a, LIMA_BROCHA, 'la copia del lima del brochazo es la de PortadaModulo');
  assert.equal(cuaderno.b, LIMA_STICKER);
});

test('el cuaderno nace con el acento del curso, y «cuaderno + acento + sin texto» se guarda como null (la de siempre)', () => {
  assert.deepEqual(coloresDeLamina('cuaderno', null), { a: LIMA_BROCHA, b: LIMA_STICKER });
  assert.deepEqual(coloresDeLamina('cuaderno', ACENTO_DEFAULT), { a: LIMA_BROCHA, b: LIMA_STICKER });
  const c = coloresDeLamina('cuaderno', '#FFD43B');
  assert.equal(c.b, '#FFD43B');
  assert.deepEqual(coloresDeLamina('pizarra', '#FFD43B'), { a: '#2E4A3B', b: '#F4D35E' }, 'el acento sólo pinta el cuaderno');
  assert.equal(valorElegido({ diseno: 'cuaderno', ...c, texto: '' }, '#FFD43B'), null);
  assert.equal(esLaminaDeSiempre({ diseno: 'cuaderno', ...c, texto: '' }, '#FFD43B'), true);
  assert.match(valorElegido({ diseno: 'cuaderno', ...c, texto: 'Hola' }, '#FFD43B') ?? '', /^lam:cuaderno:/);
  assert.match(valorElegido({ diseno: 'cuaderno', a: '#FFFFFF', b: c.b, texto: '' }, '#FFD43B') ?? '', /^lam:cuaderno:FFFFFF:/);
  assert.match(valorElegido({ diseno: 'nota', a: '#FFE66D', b: '#E4572E', texto: '' }, '#FFD43B') ?? '', /^lam:nota:/);
});

// ── El dibujo ────────────────────────────────────────────────────────────────

/** Los textos más largos que el tope deja escribir, de las formas que más ocupan. */
function textosLargos(tope: number): string[] {
  const out = [
    'M'.repeat(tope), 'W'.repeat(tope), 'Á'.repeat(tope),
    'Construye tu oferta irresistible paso a paso con ejemplos reales del mercado'.slice(0, tope),
    'Supercalifragilisticoespialidoso y algo más todavía'.slice(0, tope),
    // Las que CRECEN al pasar a mayúsculas (la ß da SS, la ligadura de fi da FI): el tope se cuenta
    // sobre lo escrito, y en los diseños en mayúsculas el doble de letras bajaba el texto a 6,7.
    'ß'.repeat(tope), String.fromCharCode(0xfb01).repeat(tope),
  ];
  // Palabras de k letras anchas: el peor reparto posible es alguna de éstas.
  for (let k = 1; k <= tope; k++) {
    let s = '';
    while (Array.from(s).length < tope) s += (s ? ' ' : '') + 'M'.repeat(k);
    out.push(Array.from(s).slice(0, tope).join('').trim());
  }
  return out.map((t) => textoLamina(t, tope));
}

test('cada diseño se dibuja sin tirar: con el texto más largo permitido, vacío, sin nombre y con números raros', () => {
  for (const d of DISENOS_LAMINA) {
    for (const [texto, nombre] of [['', 'Bienvenida'], ['', ''], ['', 'Módulo 7 - Una etapa con un nombre larguísimo que no entra'], [textosLargos(d.tope)[0], 'x'], [textosLargos(d.tope)[3], 'x']]) {
      for (const n of [0, 1, 7, 99, 104, Number.NaN]) {
        const html = dibujar({ diseno: d.id, n, rotulo: 'Módulo', texto, nombre, a: d.a, b: d.b });
        assert.match(html, /^<svg[^>]*class="ugc-lamina"[^>]*aria-hidden="true"/, `${d.id}: la lámina es un svg decorativo con el enganche del revelado`);
        assert.match(html, /preserveAspectRatio="xMidYMid slice"/);
        assert.ok(!html.includes('NaN') && !html.includes('undefined'), `${d.id} n=${n}: «NaN» o «undefined» en el dibujo`);
        // Todo url(#…) apunta a un id de ESTA lámina.
        for (const m of html.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids(html).includes(m[1]), `${d.id}: url(#${m[1]}) sin su id`);
      }
    }
  }
});

test('el texto NO rompe el diseño: con el tope, todo texto entra en su caja sin bajar del piso de lectura', () => {
  for (const d of LAMINAS) {
    if (!d.ajuste) continue; // el cuaderno, abajo
    const { caja, opciones } = d.ajuste;
    const medir = opciones.medir ?? MEDIR.archivo;
    for (const t of textosLargos(d.tope)) {
      const r = repartoDe(t, d.ajuste);
      const que = `${d.id} «${t}» → ${r.lineas.join(' / ')} @ ${r.fs.toFixed(1)}`;
      assert.ok(r.fs >= opciones.fsPiso, `${que}: bajó del piso ${opciones.fsPiso}`);
      assert.ok(r.lineas.length <= opciones.maxLineas, `${que}: más renglones que ${opciones.maxLineas}`);
      assert.ok(r.alto <= caja.alto + 0.01, `${que}: el bloque mide ${r.alto.toFixed(1)} y la caja ${caja.alto}`);
      for (const l of r.lineas) assert.ok(medir(l) * r.fs <= caja.ancho, `${que}: «${l}» se sale de la caja`);
      // Y el dibujo usa ESTE reparto (no otro escrito a mano): el cuerpo que se calculó es el que se pinta.
      const html = dibujar({ diseno: d.id, n: 3, rotulo: 'Módulo', texto: t, nombre: 'x', a: d.a, b: d.b });
      assert.ok(html.includes(`font-size="${Math.round(r.fs * 100) / 100}"`), `${d.id}: el dibujo no usa el reparto calculado`);
    }
  }
});

/**
 * ⚠️ EL PISO DEL CUADERNO CON CUATRO RENGLONES ES 13, NO `TIT_FS_PISO` (15). Su cadena de restas
 *    (PortadaModulo.tsx) le da al título a lo sumo 51 unidades de alto, y cuatro renglones ahí son
 *    13,04: es el mismo mínimo que el cuaderno midió sobre los 374 títulos reales («cuerpo del
 *    título 13,0 / 20,3 / 34,0»). Con tres renglones o menos sí garantiza 15. Lo que este test
 *    impide es lo de antes de partir las palabras: un texto de 36 letras sin espacios quedaba en 3.
 */
const PISO_CUADERNO_4 = 13;

test('el cuaderno con el texto más largo permitido no baja de su piso (las palabras larguísimas se parten)', () => {
  const tope = disenoLamina('cuaderno')!.tope;
  for (const t of textosLargos(tope)) {
    const html = dibujar({ diseno: 'cuaderno', n: 3, rotulo: 'Módulo', texto: t, nombre: 'x', a: LIMA_BROCHA, b: LIMA_STICKER });
    const fs = Number(/font-weight="900" font-size="([\d.]+)"/.exec(html)?.[1]);
    const renglones = (html.match(/<text x="178" y=/g) ?? []).length;
    assert.ok(fs >= (renglones >= 4 ? PISO_CUADERNO_4 : TIT_FS_PISO), `cuaderno «${t}»: ${renglones} renglones a ${fs}`);
  }
});

test('el nombre del módulo, cuando no hay texto: limpio y recortado al tope con «…»', () => {
  assert.equal(textoDeLamina('', 'Módulo 7 - Estrategia de contenido', 34), 'Estrategia de contenido');
  const t = textoDeLamina('', 'Construye tu oferta irresistible paso a paso con ejemplos', 30);
  assert.ok(Array.from(t).length <= 30 && t.endsWith('\u2026') && !t.includes('  '), t);
  assert.equal(textoDeLamina('Mi texto', 'Bienvenida', 30), 'Mi texto', 'el texto elegido gana');
  assert.equal(textoDeLamina('', '', 30), '');
});

/** Colores elegidos para que el texto se pierda: oscuros, claros, grises medios, saturados. */
const COLORES_MALOS = ['#000000', '#FFFFFF', '#777777', '#808080', '#767676', '#0B1F4D', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#16150F', '#FBFAF4', '#5A5A5A', '#949494', ...ACENTOS.map((x) => x.hex)];

test('el texto se lee (contraste ≥ 4,5) con cualquier color que se elija, y el dibujo lo pinta con ESA tinta', () => {
  for (const d of LAMINAS) {
    for (const a of [d.a, ...COLORES_MALOS]) {
      for (const b of [d.b, a, '#000000', '#FFFFFF']) {
        const { tinta, fondo } = d.tintaDelTexto(a, b);
        const c = contraste(tinta, fondo);
        assert.ok(c >= 4.5, `${d.id} A=${a} B=${b}: ${tinta} sobre ${fondo} da ${c.toFixed(2)}`);
      }
      const html = dibujar({ diseno: d.id, n: 4, rotulo: 'Módulo', texto: 'Texto de prueba', nombre: 'x', a, b: d.b });
      const { tinta } = d.tintaDelTexto(a, d.b);
      assert.equal(tintaDelTextoDibujado(html, d.id), tinta, `${d.id} A=${a}: el texto no se pinta con ${tinta}`);
    }
  }
});

/**
 * El color con el que se pinta EL TEXTO de una lámina: el `<g>` de `Renglones` (el único que va
 * adentro de un `<svg>` anidado) o, en el cuaderno, el `<g>` del título de PortadaModulo.
 *
 * ⚠️ NO alcanza con que la tinta aparezca en ALGÚN `fill` del dibujo, que es lo que miraba la
 *    primera versión: el rótulo, el «Nº» o las barras del código usan la misma tinta, así que una
 *    pizarra con el texto pintado de tiza clara FIJA (invisible sobre un pizarrón blanco) daba verde.
 *    Medido en la revisión del 08/10/2026.
 */
function tintaDelTextoDibujado(html: string, diseno: string): string | null {
  const re = diseno === 'cuaderno'
    ? /<g fill="([^"]+)" font-weight="900" font-size=/
    : /<svg x="[^"]*" y="[^"]*" width="[^"]*" height="[^"]*" viewBox="[^"]*"><g fill="([^"]+)"/;
  return re.exec(html)?.[1] ?? null;
}

test('las mayúsculas no le cambian el largo al texto (el tope del diseño se contó antes)', () => {
  assert.equal(mayusculas('año ß ok'), 'AÑO ß OK', 'la ß se queda: en mayúsculas serían dos letras');
  assert.equal(Array.from(mayusculas(String.fromCharCode(0xfb01).repeat(5))).length, 5);
  for (const d of LAMINAS) {
    if (!d.ajuste?.mayus) continue;
    const t = textoLamina('ß'.repeat(80), d.tope);
    const r = repartoDe(t, d.ajuste);
    // Sin los guiones que agrega partir una palabra que no entra (la de 80 «ß» se parte).
    assert.equal(Array.from(r.lineas.join('').split('-').join('')).length, d.tope, `${d.id}: el texto creció al pasar a mayúsculas`);
    assert.ok(r.fs >= d.ajuste.opciones.fsPiso, `${d.id}: «${t}» bajó a ${r.fs.toFixed(2)} (piso ${d.ajuste.opciones.fsPiso})`);
  }
});

test('el chip del número de la tarjeta va sólo donde la lámina deja libre la esquina (cuaderno y nota)', () => {
  assert.equal(conChipDeNumero(null), true);
  assert.equal(conChipDeNumero(undefined), true);
  assert.equal(conChipDeNumero({ diseno: 'cuaderno' }), true, 'el chip va sobre el espiral, como siempre');
  assert.equal(conChipDeNumero({ diseno: 'nota' }), true, 'el chip va sobre el corcho');
  assert.equal(conChipDeNumero({ diseno: 'inventado' }), true, 'un diseño roto se dibuja como cuaderno: lleva su chip');
  // Medido dibujándolas como la tarjeta, con el chip encima (captura en Chrome a 280 px): el póster y
  // el kraft perdían la «M» de «MÓDULO», la pizarra la punta del número, la entrada su franja.
  for (const id of ['pizarra', 'kraft', 'plano', 'poster', 'entrada']) {
    assert.equal(conChipDeNumero({ diseno: id }), false, `${id}: el chip le tapa la esquina de arriba a la izquierda`);
  }
});

test('tintaSobre llega a 4,5 sobre CUALQUIER fondo (barrido de grises y de colores)', () => {
  const fondos: string[] = [];
  for (let v = 0; v <= 255; v += 3) fondos.push(`#${v.toString(16).padStart(2, '0').repeat(3).toUpperCase()}`);
  for (let i = 0; i < 400; i++) fondos.push(`#${((h32(`c${i}`) & 0xffffff) >>> 0).toString(16).padStart(6, '0').toUpperCase()}`);
  for (const f of fondos) assert.ok(contraste(tintaSobre(f), f) >= 4.5, `sobre ${f}: ${contraste(tintaSobre(f), f).toFixed(2)}`);
  assert.equal(tintaSobre('#2E4A3B'), CLARO, 'sobre el pizarrón de default, tiza clara');
  assert.equal(tintaSobre('#FFE66D'), TINTA, 'sobre la nota de default, tinta');
  // El resaltador del cuaderno se aclara hasta que la tinta se lea (y el lima de siempre no se toca).
  assert.equal(brochaLegible(LIMA_BROCHA), LIMA_BROCHA);
  assert.notEqual(brochaLegible('#0B1F4D'), '#0B1F4D');
});

// ── Los ids ──────────────────────────────────────────────────────────────────

test('los ids: dos láminas del mismo número y texto pero de otro diseño o colores no comparten ninguno', () => {
  const base = { n: 1, rotulo: 'Módulo', texto: '', nombre: 'Bienvenida' };
  const html = DISENOS_LAMINA.map((d) => dibujar({ ...base, diseno: d.id, a: d.a, b: d.b }));
  const conColores = DISENOS_LAMINA.map((d) => dibujar({ ...base, diseno: d.id, a: '#123456', b: '#654321' }));
  const todos = [...html, ...conColores].flatMap(ids);
  assert.ok(todos.length >= 6, `hay ${todos.length} ids (el cuaderno, la pizarra y el plano llevan defs)`);
  assert.equal(new Set(todos).size, todos.length, 'dos láminas distintas comparten un id');
});

test('los ids: dos láminas IDÉNTICAS se separan con `instancia` (la tarjeta y su miniatura en el selector)', () => {
  for (const d of DISENOS_LAMINA) {
    const p = { diseno: d.id, n: 2, rotulo: 'Etapa', texto: 'Hola', nombre: 'x', a: d.a, b: d.b };
    const uno = dibujar(p);
    const otro = dibujar({ ...p, instancia: 'pp-x' });
    if (!ids(uno).length) continue;
    assert.equal(ids(uno).filter((i) => ids(otro).includes(i)).length, 0, `${d.id}: la miniatura repite el id de la tarjeta`);
    // Sin `instancia`, dos idénticas comparten el id… y el dibujo entero: la colisión no se puede ver.
    assert.equal(dibujar(p), uno);
  }
});

test('el cuaderno: con un texto elegido no comparte la máscara con el de siempre del mismo módulo; sin props propias, el id de siempre', () => {
  const deSiempre = renderToStaticMarkup(createElement(PortadaModulo, { n: 1, titulo: 'Bienvenida' }));
  assert.deepEqual(ids(deSiempre), [`pm${h32('1\u0000Bienvenida').toString(36)}`], 'Conocimientos no cambia: el id de siempre');
  assert.match(deSiempre, /fill:var\(--lamina-brocha, #DCF35F\)/, 'sin colores propios, sigue al acento del curso');
  const conTexto = renderToStaticMarkup(createElement(PortadaModulo, { n: 1, titulo: 'Bienvenida', texto: 'Arranque' }));
  assert.notDeepEqual(ids(conTexto), ids(deSiempre), 'otro reparto, otra máscara: no pueden compartir el id');
  assert.match(conTexto, />Arranque</);
  const conColor = renderToStaticMarkup(createElement(PortadaModulo, { n: 1, titulo: 'Bienvenida', brocha: '#FFFFFF', sticker: '#000000' }));
  assert.notDeepEqual(ids(conColor), ids(deSiempre));
  assert.match(conColor, /fill:#FFFFFF/);
  // El texto elegido va TAL CUAL: «Paso 1» no pasa por la limpieza de títulos (que lo dejaría vacío).
  assert.match(renderToStaticMarkup(createElement(PortadaModulo, { n: 1, titulo: 'x', texto: 'Paso 1' })), />Paso 1</);
});

// ── El selector ──────────────────────────────────────────────────────────────

test('el selector: sin `disenos` es el de siempre, y la pestaña se carga perezosa (el tablero no baja los dibujos)', () => {
  const src = sinComentarios(leer('app/_components/PortadaPicker.tsx'));
  assert.match(src, /const pestanas: Pestana\[\] = disenos \? \['disenos', 'galeria', 'subir'\] : \['galeria', 'subir'\];/);
  assert.match(src, /pest === 'disenos' && disenos &&/);
  assert.match(src, /lazy\(\(\) => import\('@\/app\/_cursos\/laminas\/SelectorLaminas'\)/);
  assert.doesNotMatch(src, /from '@\/app\/_cursos\/laminas(\/index)?'/, 'un import estático metería los dibujos en el bundle del tablero');
  const sel = sinComentarios(leer('app/_cursos/laminas/SelectorLaminas.tsx'));
  assert.match(sel, /valorElegido\(/, 'el cuaderno de siempre se guarda como null');
  assert.match(sel, /maxLength=\{d\.tope\}/, 'el campo tiene el tope del diseño');
  assert.match(sel, /instancia=\{`pp-\$\{x\.id\}`\}/, 'la miniatura no comparte ids con la tarjeta de atrás');
  // «Sin portada» se le AVISA a la pestaña (no se deduce de `valor`: sobre una portada vacía, `null`
  // sobre `null` no cambia nada y lo tipeado se guardaba igual medio segundo después).
  assert.match(src, /setQuitadas\(\(q\) => q \+ 1\); onElegir\(null\);/, '«Sin portada» no cuenta');
  assert.match(src, /<SelectorLaminas [^>]*quitadas=\{quitadas\}/, 'la pestaña no se entera de «Sin portada»');
  assert.match(sel, /if \(visto !== valor \|\| vistas !== quitadas\)/, 'la pestaña no descarta lo tipeado con «Sin portada»');
  // Es también el selector de la portada de una CLASE: el botón no puede prometer «el nombre del módulo».
  assert.doesNotMatch(sel, /nombre del módulo/);
});

test('los dibujos sirven del server: sin hooks, sin `use client`, sin azar ni reloj', () => {
  for (const f of ['comun', 'cuaderno', 'pizarra', 'nota', 'kraft', 'plano', 'poster', 'entrada', 'index']) {
    const src = sinComentarios(leer(`app/_cursos/laminas/${f}.tsx`));
    assert.doesNotMatch(src, /'use client'|\buse(State|Effect|Ref|Memo|Id|Callback)\(|Math\.random\(|Date\.now\(|new Date\(/, `${f}.tsx`);
  }
});

test('el código de las láminas no tiene caracteres de 3 bytes ni INVISIBLES crudos (van escapados)', () => {
  // Los de 3 bytes, por la regla de CursoUgc.tsx (un reemplazo los volvió rombos). Los invisibles
  // —un guion blando, un ZWJ, un NUL— por AGENTS.md: ripgrep declara el archivo binario y la búsqueda
  // contesta vacío. Pasó al escribir estos archivos (07/10/2026): la herramienta de escritura dejó
  // crudos el U+00AD (guion blando) de comun.tsx y el U+200D (ZWJ) de lib/laminas.ts, que en el editor
  // no se ven. Los escribe como escape un script; acá se nombran por su código, nunca con el escape.
  const archivos = ['comun', 'cuaderno', 'pizarra', 'nota', 'kraft', 'plano', 'poster', 'entrada', 'index', 'SelectorLaminas']
    .map((f) => `app/_cursos/laminas/${f}.tsx`).concat('lib/laminas.ts');
  for (const f of archivos) {
    const crudo = leer(f);
    const invisibles = [...crudo].filter((c) => {
      const n = c.codePointAt(0)!;
      return (n < 32 && n !== 10 && n !== 9) || n === 0xad || (n >= 0x200b && n <= 0x200f) || n === 0x2060;
    });
    assert.deepEqual(invisibles.map((c) => c.codePointAt(0)!.toString(16)), [], `${f}: invisibles crudos`);
    const malos = [...sinComentarios(crudo)].filter((c) => Buffer.byteLength(c, 'utf8') >= 3);
    assert.deepEqual(malos, [], `${f}: caracteres de 3 bytes ${[...new Set(malos)].join(' ')}`);
  }
});
