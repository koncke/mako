// =============================================================================
// editor-landing-temas — temas, la hoja del contenido y los íconos (paquete B)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Lo que estos tests
// cuidan, y por qué cada cosa no se ve si se rompe:
//   · Que cada tema tenga id único, fuentes del catálogo de Google Fonts con un peso
//     que la familia publica (la API css2 contesta 400 a la hoja ENTERA por un peso
//     que no existe: la página cae toda a la fuente de respaldo sin un error), y una
//     paleta de 6 a 12 colores.
//   · Que el texto se lea sobre la tarjeta de CADA tema (contraste ≥ 4.5, calculado
//     acá con su propia fórmula: no se le cree a temas.ts lo que temas.ts calcula).
//   · Que cada var(--gm-*) que lee CSS_CONTENIDO la escriba varsDeTema, la defina la
//     misma hoja o traiga respaldo: un var() inexistente HEREDA, no falla (AGENTS.md).
//   · Que toda variante de «Diseños optimizados», tono, ancho, color y tamaño de doc.ts
//     tenga su forma en la hoja.
//   · Que todo ícono que nombra el catálogo de bloques (y los tonos de los recuadros,
//     que render.ts dibuja por nombre) exista en iconos.ts.
//   · Que un tema propio no pueda colar nada en el `style` de una página pública.
//
// PROBADO ROMPIÉNDOLO (11/10/2026, en memoria, restaurado a mano y sin git): ver al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEMAS, TEMA_DEFAULT_ID, FUENTES, varsDeTema, estiloDeTema, temaPorId, urlFuentes, esOscuro,
  mezclarTema, sanearTemaPropio, varsDeFondoPropio, type Tema,
} from '../lib/editor-landing/temas';
import { CSS_CONTENIDO } from '../lib/editor-landing/css';
import { ICONOS, NOMBRES_ICONO, ICONO_NEUTRO, svgIcono, buscarIconos, existeIcono } from '../lib/editor-landing/iconos';
import { BLOQUES } from '../lib/editor-landing/catalogo-bloques';
import {
  OPTIMIZADOS, TONOS_RECUADRO, ANCHOS_IMAGEN, COLORES_TEMA, TAMANOS_TEXTO, ALTOS_ESPACIADOR,
  ALTOS_HTML_LIBRE, DISENOS_TARJETA, ANCHOS_TARJETA, SUPERPOSICIONES, VARIANTES_BOTON, VARIANTES_PARRAFO,
} from '../lib/editor-landing/doc';
import { CONFIG_DEFAULT } from '../lib/editor-landing/api-tipos';

// ─────────────────────────────────────────────────────────────────────────────
// Contraste, con una implementación PROPIA (WCAG 2.x)
// ─────────────────────────────────────────────────────────────────────────────

const canal = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
function lum(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => canal(parseInt(h.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}
function mezcla(a: string, b: string, p: number): string {
  const ca = [0, 2, 4].map((i) => parseInt(a.slice(1 + i, 3 + i), 16));
  const cb = [0, 2, 4].map((i) => parseInt(b.slice(1 + i, 3 + i), 16));
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * p).toString(16).padStart(2, '0')).join('');
}
/** Los #rrggbb de un relleno (los de 8 dígitos, con alfa, no son un color sobre el que se lea). */
const hexDe = (relleno: string) => (relleno.match(/#[0-9a-fA-F]{6}(?![0-9a-fA-F])/g) ?? []).map((c) => c.toLowerCase());
/** El color sólido de la última capa (los fondos de varias capas terminan en su color base). */
function baseDeFondo(relleno: string): string[] {
  const m = /,\s*(#[0-9a-fA-F]{6})\s*$/.exec(relleno.trim());
  return m ? [m[1].toLowerCase()] : [];
}

/** Sobre qué se lee el texto de la tarjeta: sus paradas, y si es esmerilada, al 75% sobre el fondo de la página. */
function fondosTarjeta(t: Tema): string[] {
  const paradas = hexDe(t.tarjeta.fondo);
  if (t.tarjeta.transparencia !== 'esmerilado') return paradas;
  const detras = [...new Set([...hexDe(t.fondo), ...baseDeFondo(t.fondo)])];
  return paradas.flatMap((c) => detras.map((p) => mezcla(c, p, 0.25)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Temas
// ─────────────────────────────────────────────────────────────────────────────

test('cada tema: id único (el nombre en minúsculas sin espacios), fuentes del catálogo con peso publicado, paleta de 6 a 12', () => {
  const ids = new Set<string>();
  const problemas: string[] = [];
  for (const t of TEMAS) {
    if (ids.has(t.id)) problemas.push(t.id + ': id repetido');
    ids.add(t.id);
    if (t.id !== t.nombre.toLowerCase().replace(/\s+/g, '')) problemas.push(t.id + ': el id no sale del nombre «' + t.nombre + '»');
    for (const rol of ['titulo', 'cuerpo'] as const) {
      const f = t.fuentes[rol];
      const def = FUENTES[f.familia];
      if (!def) problemas.push(t.id + ': la fuente de ' + rol + ' «' + f.familia + '» no está en el catálogo de Google Fonts');
      else if (!def.pesos.includes(f.peso)) problemas.push(t.id + ': «' + f.familia + '» no publica el peso ' + f.peso);
    }
    if (t.paleta.length < 6 || t.paleta.length > 12) problemas.push(t.id + ': paleta de ' + t.paleta.length + ' colores');
    for (const c of t.paleta) if (!/^#[0-9a-f]{6}$/.test(c)) problemas.push(t.id + ': color de paleta inválido ' + c);
    for (const c of [t.colores.texto, t.colores.acento, t.colores.enlace, t.colores.botonTexto]) {
      if (!/^#[0-9a-f]{6}$/.test(c)) problemas.push(t.id + ': color inválido ' + c);
    }
  }
  assert.deepEqual(problemas, []);
});

test('el catálogo trae los 18 temas medidos y entre 10 y 16 «Standard» aproximados de captura; el default existe', () => {
  const medidos = ['Eclipse', 'Ultraviolet', 'Lawn', 'Syntax', 'Torch', 'Circuit', 'Pewter', 'Sapphire', 'Cirrus',
    'Espresso', 'Periwinkle', 'Botanical', 'Primer', 'Mint', 'Canyon', 'Anvil', 'Malachite', 'Terrain'];
  const nombres = TEMAS.filter((t) => !t.aproximado && !t.deMako).map((t) => t.nombre);
  assert.deepEqual(nombres, medidos, 'los medidos, con sus nombres y en el orden de gamma-tokens §4');
  const aprox = TEMAS.filter((t) => t.aproximado).length;
  assert.ok(aprox >= 10 && aprox <= 16, aprox + ' temas aproximados');
  // Los PROPIOS de MaKo (14/10/2026: el diseño «MaKo» de la grilla, copiado de su landing app/vsl): ni
  // medidos ni de captura, al final del catálogo. Pasan todo lo demás de este archivo como cualquier tema.
  assert.deepEqual(TEMAS.filter((t) => t.deMako).map((t) => t.id), ['mako']);
  assert.ok(TEMAS.every((t) => !(t.deMako && t.aproximado)), 'un tema de MaKo no es aproximado');
  assert.equal(TEMAS.at(-1)?.id, 'mako', 'los de MaKo van al final de la galería');
  assert.equal(TEMA_DEFAULT_ID, CONFIG_DEFAULT.tema);
  assert.ok(TEMAS.some((t) => t.id === CONFIG_DEFAULT.tema), 'CONFIG_DEFAULT.tema (' + CONFIG_DEFAULT.tema + ') no está en TEMAS');
});

// Roturas (14/10/2026, en memoria, restauradas y verificadas por hash; base: 19 pasan, 0 fallan): Geist fuera
// de FUENTES → 16 / 3 (éste, «cada tema…» y urlFuentes); el tema MaKo sin `deMako` → 18 / 1 (el catálogo:
// contaba como medido); su texto en #bbbbbb → 18 / 1 (el contraste).
test('el tema MaKo: Geist (la de su landing) está en el catálogo de Google Fonts con los pesos que usa', () => {
  const mako = temaPorId('mako');
  assert.equal(mako.id, 'mako', 'temaPorId(«mako») cae al default');
  assert.deepEqual([mako.fuentes.titulo, mako.fuentes.cuerpo], [{ familia: 'Geist', peso: 600 }, { familia: 'Geist', peso: 400 }]);
  assert.ok(FUENTES.Geist && FUENTES.Geist.tipo === 'sans' && [400, 600].every((p) => FUENTES.Geist.pesos.includes(p)), 'Geist no está en FUENTES');
  assert.match(urlFuentes([mako]), /family=Geist:wght@400;600(;\d+)*&display=swap$/);
  assert.equal(mako.colores.boton, '#2f6fed');
});

test('el texto se lee sobre la tarjeta de cada tema (contraste ≥ 4.5, también esmerilada)', () => {
  const bajos: string[] = [];
  for (const t of TEMAS) {
    const fondos = fondosTarjeta(t);
    assert.ok(fondos.length, t.id + ': no se pudo leer el color de la tarjeta');
    const peor = Math.min(...fondos.map((f) => ratio(t.colores.texto, f)));
    if (peor < 4.5) bajos.push(t.id + ': ' + peor.toFixed(2));
  }
  assert.deepEqual(bajos, [], 'texto ilegible sobre la tarjeta');
});

test('el texto del botón se lee sobre el botón (≥ 3: es texto grande y en negrita)', () => {
  const bajos: string[] = [];
  for (const t of TEMAS) {
    const paradas = hexDe(t.colores.boton);
    const prom = paradas.reduce((acc, c) => acc.map((v, i) => v + parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / paradas.length), [0, 0, 0]);
    const rep = '#' + prom.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    const c = ratio(t.colores.botonTexto, rep);
    if (c < 3) bajos.push(t.id + ': ' + c.toFixed(2));
  }
  assert.deepEqual(bajos, []);
});

test('el grupo claro/oscuro sigue al color de la tarjeta (los filtros del panel no mienten)', () => {
  const mal = TEMAS.filter((t) => {
    const paradas = hexDe(t.tarjeta.fondo);
    const l = paradas.reduce((s, c) => s + lum(c), 0) / paradas.length;
    return (l < 0.2) !== esOscuro(t);
  }).map((t) => t.id);
  assert.deepEqual(mal, []);
});

test('las variables derivadas que se usan como TEXTO también se leen (acento, enlace, paleta legible)', () => {
  const bajos: string[] = [];
  for (const t of TEMAS) {
    const v = varsDeTema(t);
    const fondos = fondosTarjeta(t);
    for (const k of ['--gm-acento-texto', '--gm-enlace', ...Array.from({ length: 6 }, (_, i) => '--gm-paleta-' + (i + 1) + '-legible')]) {
      const peor = Math.min(...fondos.map((f) => ratio(v[k], f)));
      if (peor < 4.5) bajos.push(t.id + ' ' + k + ' ' + v[k] + ': ' + peor.toFixed(2));
    }
  }
  assert.deepEqual(bajos, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// La hoja y las variables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las variables que la HOJA define para sí misma (la grilla de los diseños
 * optimizados y el índice de cada ítem), en una lista EXPLÍCITA.
 *
 * ⚠️ No alcanza con «la hoja la declara en algún lado»: la primera versión de este
 * test aceptaba eso y dio VERDE con --gm-acento-texto borrada de varsDeTema, porque
 * la hoja la re-declara adentro de `[data-fondo="acento"]` — o sea sólo para las
 * secciones de fondo acento; en todas las demás valía nada. Una declaración con
 * alcance no es una definición.
 */
const INTERNAS_DE_LA_HOJA = ['--gm-n', '--gm-cuenta', '--gm-n-rejilla', '--gm-n-pares', '--gm-n-fila', '--gm-n-movil', '--gm-k', '--gm-c', '--gm-c-texto', '--gm-ang'];

test('cada var(--gm-*) de la hoja la escribe varsDeTema para TODOS los temas, es interna de la hoja o trae respaldo', () => {
  const usos = [...CSS_CONTENIDO.matchAll(/var\(\s*(--gm-[a-z0-9-]+)\s*(,)?/g)];
  assert.ok(usos.length > 200, 'no se pudieron leer los var() de la hoja (' + usos.length + ')');
  const sinRespaldo = new Set(usos.filter((m) => !m[2]).map((m) => m[1]));
  const huerfanas: string[] = [];
  for (const nombre of [...new Set(usos.map((m) => m[1]))]) {
    if (INTERNAS_DE_LA_HOJA.includes(nombre) || !sinRespaldo.has(nombre)) continue;
    const faltan = TEMAS.filter((t) => !(nombre in varsDeTema(t))).map((t) => t.id);
    if (faltan.length) huerfanas.push(nombre + ' (falta en ' + faltan.slice(0, 3).join(', ') + (faltan.length > 3 ? '…' : '') + ')');
  }
  assert.deepEqual(huerfanas, [], 'variables que la hoja lee y nadie escribe');
  // Y la lista blanca no envejece: cada interna la declara la hoja con un selector, y la usa.
  for (const n of INTERNAS_DE_LA_HOJA) {
    assert.ok(new RegExp(n + '\\s*:').test(CSS_CONTENIDO), n + ': interna que la hoja ya no declara');
    assert.ok(CSS_CONTENIDO.includes('var(' + n), n + ': interna que la hoja ya no usa');
    assert.ok(TEMAS.every((t) => !(n in varsDeTema(t))), n + ': la escribe el tema, no es interna');
  }
});

test('varsDeTema: sólo variables --gm-*, valores sin comillas dobles ni ángulos, 12 colores de paleta siempre', () => {
  for (const t of TEMAS) {
    const v = varsDeTema(t);
    for (const [k, val] of Object.entries(v)) {
      assert.match(k, /^--gm-[a-z0-9-]+$/, t.id + ': ' + k);
      assert.ok(typeof val === 'string' && val.length > 0 && !/["<>;{}]/.test(val), t.id + ' ' + k + ' = ' + val);
    }
    for (let i = 1; i <= 12; i++) assert.match(v['--gm-paleta-' + i], /^#[0-9a-f]{6}$/, t.id + ' paleta ' + i);
    const s = estiloDeTema(t);
    assert.ok(!/["<>]/.test(s) && s.includes('--gm-texto:' + t.colores.texto), t.id + ': estiloDeTema');
  }
});

test('la hoja dibuja TODAS las variantes y listas cerradas de doc.ts', () => {
  const faltan: string[] = [];
  const pide = (que: string, aguja: string) => { if (!CSS_CONTENIDO.includes(aguja)) faltan.push(que); };
  for (const o of OPTIMIZADOS) pide('variante ' + o.id, 'data-variante="' + o.id + '"');
  for (const t of TONOS_RECUADRO) pide('tono ' + t, '.gm-recuadro[data-tono="' + t + '"]');
  for (const w of ANCHOS_IMAGEN) pide('ancho de imagen ' + w, '.gm-imagen[data-ancho="' + w + '"]');
  for (const c of COLORES_TEMA) pide('color ' + c, 'span[data-color="' + c + '"]');
  for (const t of TAMANOS_TEXTO) pide('tamaño ' + t, 'span[data-tam="' + t + '"]');
  for (const a of ALTOS_ESPACIADOR) pide('espacio ' + a, '.gm-espaciador[data-alto="' + a + '"]');
  for (const a of ALTOS_HTML_LIBRE) pide('alto de HTML ' + a, '.gm-html[data-alto="' + a + '"]');
  for (const d of DISENOS_TARJETA.filter((x) => x !== 'sin')) pide('acento ' + d, '.gm-tarjeta[data-diseno="' + d + '"]');
  for (const a of ANCHOS_TARJETA.filter((x) => x !== 'normal')) pide('ancho ' + a, '.gm-tarjeta[data-ancho="' + a + '"]');
  for (const s of SUPERPOSICIONES.filter((x) => x !== 'ninguna')) pide('superposición ' + s, '[data-superposicion="' + s + '"]');
  for (const b of VARIANTES_BOTON.filter((x) => x !== 'primario')) pide('botón ' + b, '.gm-boton[data-variante="' + b + '"]');
  for (const p of VARIANTES_PARRAFO) pide('párrafo ' + p, 'p[data-variante="' + p + '"]');
  for (const c of ['.gm-columnas', '.gm-tabla', '.gm-desplegable', '.gm-formulario', '.gm-grafico', '.gm-video', '.gm-insertado', '.gm-nav', '.gm-pie', '.gm-marca', '.gm-etiqueta', 'h1.gm-titulo', '@media print', '[data-dispositivo="movil"]', 'gm-entrada 1s cubic-bezier(0.22, 1, 0.36, 1)']) pide(c, c);
  assert.deepEqual(faltan, []);
});

test('la hoja es un string servible: sin backticks, sin ${, sin comillas simples, llaves balanceadas', () => {
  assert.ok(!CSS_CONTENIDO.includes('`'), 'trae un backtick');
  assert.ok(!CSS_CONTENIDO.includes('${'), 'trae un ${');
  assert.ok(!CSS_CONTENIDO.includes("'"), 'trae una comilla simple');
  assert.ok(!/<\/style/i.test(CSS_CONTENIDO), 'trae un </style>');
  let prof = 0;
  for (const c of CSS_CONTENIDO) {
    if (c === '{') prof++;
    else if (c === '}') prof--;
    assert.ok(prof >= 0, 'una llave cierra antes de abrir');
  }
  assert.equal(prof, 0, 'llaves sin cerrar');
});

// ─────────────────────────────────────────────────────────────────────────────
// Temas propios y Google Fonts
// ─────────────────────────────────────────────────────────────────────────────

test('temaPorId: un id desconocido cae al default; un propio mezcla la base con cambios VALIDADOS', () => {
  assert.equal(temaPorId('no-existe').id, TEMA_DEFAULT_ID);
  assert.equal(temaPorId(null).id, TEMA_DEFAULT_ID);
  assert.equal(temaPorId('ws:x', []).id, TEMA_DEFAULT_ID, 'sin propios, un ws: cae al default');

  const propio = {
    id: 'abc', nombre: 'Mi marca', base: 'lawn',
    cambios: {
      colores: { acento: '#ff0066', texto: 'red;}</style><script>alert(1)</script>', titulo: 'linear-gradient(90deg, #111111 0%, #ff0066 100%)' },
      tarjeta: { fondo: '#101010' },
      fuentes: { titulo: { familia: 'Fuente Inventada', peso: 900 }, cuerpo: { familia: 'Lora', peso: 450 } },
      redondez: { boton: 'gigante' },
      fondo: 'url(https://evil.example/x.png)',
    },
  };
  const t = temaPorId('ws:abc', [propio]);
  assert.equal(t.id, 'ws:abc');
  assert.equal(t.nombre, 'Mi marca');
  assert.equal(t.colores.acento, '#ff0066');
  assert.equal(t.colores.titulo, 'linear-gradient(90deg, #111111 0%, #ff0066 100%)');
  assert.equal(t.colores.texto, temaPorId('lawn').colores.texto, 'un texto con un <script> no pasa');
  assert.equal(t.fondo, temaPorId('lawn').fondo, 'una imagen externa no es un fondo de tema');
  assert.equal(t.fuentes.titulo.familia, temaPorId('lawn').fuentes.titulo.familia, 'una familia fuera del catálogo no pasa');
  assert.deepEqual(t.fuentes.cuerpo, { familia: 'Lora', peso: 500 }, 'el peso se lleva al más cercano que la familia publica');
  assert.equal(t.redondez.boton, temaPorId('lawn').redondez.boton);
  assert.equal(t.grupo, 'oscuro', 'una tarjeta oscura pasa el tema al filtro «Oscuro»');
  assert.ok(!/<|script/.test(estiloDeTema(t)));
});

test('sanearTemaPropio descarta lo que no es un tema y deja la base en el catálogo', () => {
  assert.equal(sanearTemaPropio(null), null);
  assert.equal(sanearTemaPropio({ id: '../../x', nombre: 'a', base: 'lawn' }), null);
  const p = sanearTemaPropio({ id: 'ws:k1', nombre: '  <b>Hola</b>  ', base: 'inventado', cambios: { colores: { acento: 'blue' } } });
  assert.deepEqual(p, { id: 'k1', nombre: 'bHola/b', base: TEMA_DEFAULT_ID, cambios: {} });
  // El degradado se RE-ESCRIBE (normalizado), no se copia.
  const m = mezclarTema(temaPorId('pewter'), { fondo: 'LINEAR-GRADIENT( 450deg , #ABCDEF 0% , #000000 )' });
  assert.equal(m.fondo, 'linear-gradient(90deg, #abcdef 0%, #000000)');
});

test('urlFuentes: un link css2 con cada familia de los temas y sólo pesos publicados, en orden', () => {
  const url = urlFuentes(TEMAS);
  assert.match(url, /^https:\/\/fonts\.googleapis\.com\/css2\?family=.+&display=swap$/);
  const familias = new Map<string, number[]>();
  for (const parte of url.split('?')[1].split('&').filter((p) => p.startsWith('family='))) {
    const [nombre, pesos] = parte.slice('family='.length).split(':wght@');
    familias.set(nombre.replace(/\+/g, ' '), pesos.split(';').map(Number));
  }
  for (const t of TEMAS) for (const f of [t.fuentes.titulo, t.fuentes.cuerpo]) {
    const pesos = familias.get(f.familia);
    assert.ok(pesos, t.id + ': falta ' + f.familia);
    assert.ok(pesos!.includes(f.peso), t.id + ': falta el peso ' + f.peso + ' de ' + f.familia);
  }
  for (const [familia, pesos] of familias) {
    assert.deepEqual(pesos, [...pesos].sort((a, b) => a - b), familia + ': pesos fuera de orden');
    for (const p of pesos) assert.ok(FUENTES[familia].pesos.includes(p), familia + ' no publica ' + p);
  }
  assert.equal(urlFuentes([]), '');
});

test('varsDeFondoPropio: sobre un color oscuro propio el texto pasa a claro (y al revés)', () => {
  const claro = temaPorId('pewter');
  const v = varsDeFondoPropio(claro, '#111111');
  assert.ok(ratio(v['--gm-texto'], '#111111') >= 4.5, 'texto ' + v['--gm-texto']);
  const oscuro = temaPorId('eclipse');
  const w = varsDeFondoPropio(oscuro, '#fafafa');
  assert.ok(ratio(w['--gm-texto'], '#fafafa') >= 4.5, 'texto ' + w['--gm-texto']);
  assert.deepEqual(varsDeFondoPropio(claro, 'url(x)'), {}, 'un relleno inválido no escribe nada');
});

// ─────────────────────────────────────────────────────────────────────────────
// Íconos
// ─────────────────────────────────────────────────────────────────────────────

test('todo ícono que nombra el catálogo de bloques existe (y los de los tonos, que render.ts pide por nombre)', () => {
  const faltan = [...new Set([...BLOQUES.map((b) => b.icono), ...TONOS_RECUADRO])].filter((n) => !existeIcono(n));
  assert.deepEqual(faltan, []);
});

test('el subset de Phosphor: ~200-300 íconos, trazos que sólo son comandos de path, etiquetas sin acentos', () => {
  assert.ok(NOMBRES_ICONO.length >= 180 && NOMBRES_ICONO.length <= 320, NOMBRES_ICONO.length + ' íconos');
  for (const n of NOMBRES_ICONO) {
    assert.match(ICONOS[n].d, /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]+$/, n + ': trazo con caracteres raros');
    for (const t of ICONOS[n].tags) assert.match(t, /^[a-z0-9]+$/, n + ': etiqueta «' + t + '»');
  }
});

test('svgIcono nunca devuelve vacío y no deja escapar la clase del atributo', () => {
  const neutro = svgIcono(ICONO_NEUTRO);
  assert.equal(svgIcono('no-existe'), neutro, 'un nombre inexistente dibuja el neutro');
  assert.match(neutro, /^<svg [^>]*viewBox="0 0 256 256"[^>]*><path d="[^"]+"\/><\/svg>$/);
  const s = svgIcono('casa', 20, 'x" onload="alert(1)');
  assert.ok(!/onload="/.test(s) && /width="20"/.test(s), s.slice(0, 160));
  assert.match(svgIcono('casa', -5), /width="24"/);
});

test('buscarIconos: por nombre y por etiqueta, sin acentos, varias palabras', () => {
  assert.equal(buscarIconos('cohete')[0], 'cohete');
  assert.ok(buscarIconos('DÓLAR').includes('dolar'));
  assert.ok(buscarIconos('garantia').includes('escudo'), 'busca por etiqueta');
  assert.equal(buscarIconos('grafico barras')[0], 'grafico-barras');
  assert.equal(buscarIconos('').length, NOMBRES_ICONO.length);
  assert.deepEqual(buscarIconos('zzzz'), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// La rotura (11/10/2026, scratchpad/pkgb/romper.mjs): cada una en memoria, el test
// corrido, el archivo restaurado desde la copia en memoria y verificado por md5.
// Base: 18 pases, 0 fallos.
//  1. varsDeTema sin '--gm-acento-texto' (renombrada a '--gm-acento-txt'): 2 fallos
//     («cada var(--gm-*)…»: «falta en eclipse, ultraviolet, lawn…», y «las variables
//     derivadas… se leen»), 16 pases. ⚠️ Con la primera versión del test de var() (que
//     aceptaba cualquier declaración de la hoja) daba 1 fallo: ver INTERNAS_DE_LA_HOJA.
//  2. Pewter con texto '#bbbbbb': 1 fallo («el texto se lee…»: «pewter: 1.79»), 17 pases.
//  3. iconos.ts con la clave 'texto-h1' renombrada a 'texto-h1x': 1 fallo («todo ícono
//     que nombra el catálogo…»: ['texto-h1']), 17 pases.
//  4. css.ts con 'escalera' renombrada en FILA y en sus reglas: 1 fallo («la hoja
//     dibuja TODAS las variantes…»: ['variante escalera']), 17 pases.
//  5. urlFuentes con los pesos de mayor a menor: 1 fallo («pesos fuera de orden»), 17 pases.
//  6. hexValido aceptando cualquier string: 3 fallos («temaPorId… VALIDADOS»: el
//     <script> llegaba al texto; «sanearTemaPropio…»: acento 'blue'; «varsDeFondoPropio…»:
//     'url(x)' pasaba como relleno), 15 pases.
// ─────────────────────────────────────────────────────────────────────────────
