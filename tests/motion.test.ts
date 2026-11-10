// =============================================================================
// El motor de motion graphics (lib/motion): una escena, dos dibujantes que dicen lo mismo
// =============================================================================
// Pedido de Martín (26/10/2026): motion graphics en la web y en el editor, con las skills de iart-ai. Lo que se puede
// romper sin que se vea en una pantalla:
//   · que el lienzo (Video Editor) y el CSS (landing) dejen de contar la MISMA coreografía: otra curva, otro t0, otro
//     cuadro de partida, un pedazo de más o de menos;
//   · que una plantilla ponga algo fuera del cuadro o del área segura, o que un clip no empiece/termine vacío;
//   · que el saneo recorte un texto en silencio, invente un número o deje pasar un color con CSS adentro;
//   · que un número rebote (un dato no se pasa de su valor) o que algo lata para siempre (WCAG 2.2.2).
//
// Correr: node --import tsx --test tests/motion.test.ts
//
// PROBADO ROMPIÉNDOLO (10/11/2026, base 14/0, Node 24, cada rotura restaurada de memoria):
//   · `numero` de la cifra con paso 1 (el bug del 26/10)                         -> 13/1 (cifra)
//   · la cifra muestra sólo «decimales» (sin `decimalesAMostrar`)                 -> 13/1 (cifra)
//   · `decimalesDe` siempre 0                                                     -> 13/1 (cifra)
//   · `alPaso` sin el `toFixed` (1,15 queda 1.1500000000000001)                   -> 13/1 (cifra)
//   · lo ESTRICTO redondea en silencio (`if (false && …)`)                        -> 13/1 (cifra)
//   · lo estricto INVERTIDO (rechaza lo de la persona, redondea lo de la IA)      -> 13/1 (cifra)
//   · `recorteBase` sin el `inset(0 0% 0 0)` escrito en un barrido                -> 13/1 (HTML ↔ lienzo); este test se
//     escribió el 26/10 con la guardia de RAM cerrada y no se había corrido: corre y caza
//   · `formatearNumero` con punto decimal                                         -> 11/3 (barras, cifra, HTML)
//   · sin efecto: renombrar la local `redondo`                                    -> 14/0
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CURVAS, aplicarCurva, cssDeCurva, type Curva } from '../lib/motion/curvas';
import { readFileSync } from 'node:fs';
import { armarEscena, altoTexto, anchoEm, desbordeDelCuadro, finDeEntrada, formatearNumero, fragmentosDeTexto, instanteQueDibuja, pedazos, RITMOS, contraste } from '../lib/motion/escena';
import { validarCampoDelPanel } from '../lib/motion/panel';
import { leerNumero, numeroParaMostrar } from '../lib/motion/numeros';
import { DESDE, entrada, escalaLatido, estadoPedazo, inicioPedazo } from '../lib/motion/evaluar';
import { CSS_MOTION, KEYFRAMES_ENTRADA, KEYFRAMES_SALIDA, nombreEntrada, nombreSalida } from '../lib/motion/css';
import { arbolDeEscena, type NodoHtml } from '../lib/motion/html';
import { dibujarEscena } from '../lib/motion/canvas';
import { PLANTILLAS, camposDe, datosDeBarras, leerDatosDeBarras, normalizarMotion, topeDuro, validarCampoMotion, valoresPorDefecto } from '../lib/motion/plantillas';
import { EFECTOS, PLANTILLAS_MOTION, TONOS_MOTION, type Capa, type CapaCifra, type CapaTexto, type Escena, type IdPlantilla } from '../lib/motion/tipos';
import { htmlDeArbol, type NodoArbol } from '../lib/editor-landing/grafico-svg';

const ASPECTOS = [16 / 9, 9 / 16, 1];

/** Los textos más largos que acepta cada plantilla (AGENTS.md: un layout se prueba con el valor MÁS LARGO). */
function valoresLargos(p: IdPlantilla): Record<string, string | number | boolean> {
  const v = valoresPorDefecto(p);
  const frase = 'Palabras reales de un negocio que vende servicios online y quiere crecer rápido este año';
  for (const c of camposDe(p)) {
    if (c.tipo !== 'texto' || c.clave === 'datos' || c.max <= 10) continue;
    let s = '';
    while (s.length < c.max) s += (s ? ' ' : '') + frase;
    v[c.clave] = s.slice(0, c.max).trim();
  }
  return v;
}

const escenas = function* () {
  for (const p of PLANTILLAS_MOTION)
    for (const a of ASPECTOS)
      for (const tono of TONOS_MOTION)
        for (const largo of [false, true]) {
          const valores = { ...(largo ? valoresLargos(p) : valoresPorDefecto(p)), tono };
          yield { p, a, tono, largo, video: armarEscena({ plantilla: p, valores }, { aspecto: a, video: true }), web: armarEscena({ plantilla: p, valores }, { aspecto: a }) };
        }
};

// ─────────────────────────────────────────────────────────────────────────────
// Las curvas: el lienzo evalúa lo mismo que escribe el CSS
// ─────────────────────────────────────────────────────────────────────────────

test('curvas: el CSS lleva los cuatro números de la curva, y la curva va de 0 a 1', () => {
  for (const c of Object.keys(CURVAS) as Curva[]) {
    const [a, b, d, e] = CURVAS[c];
    assert.equal(cssDeCurva(c), `cubic-bezier(${a}, ${b}, ${d}, ${e})`);
    assert.equal(aplicarCurva(c, 0), 0);
    assert.equal(aplicarCurva(c, 1), 1);
    assert.equal(aplicarCurva(c, -0.5), 0, 'fuera de rango se pega al borde (no extrapola)');
    assert.equal(aplicarCurva(c, 7), 1);
  }
  // easeOutExpo a mitad de camino ya recorrió casi todo; cubicInOut, la mitad exacta.
  assert.ok(aplicarCurva('salida', 0.5) > 0.9);
  assert.ok(Math.abs(aplicarCurva('suave', 0.5) - 0.5) < 1e-4);
  // El rebote se pasa de 1 en el medio; las demás de entrada nunca.
  assert.ok([0.5, 0.6, 0.7].some((p) => aplicarCurva('rebote', p) > 1.01));
  for (const c of ['salida', 'quinta', 'cubica', 'cuarta', 'estandar'] as Curva[])
    for (let p = 0; p <= 1; p += 0.05) assert.ok(aplicarCurva(c, p) <= 1 + 1e-9, `${c} no rebota`);
});

// ─────────────────────────────────────────────────────────────────────────────
// El saneo: rechaza con motivo, nunca recorta ni inventa
// ─────────────────────────────────────────────────────────────────────────────

test('normalizarMotion: lo bueno pasa, lo malo se descarta con su motivo y queda el valor por defecto', () => {
  const ok = normalizarMotion({ plantilla: 'cifra', valores: { numero: 3200, etiqueta: 'alumnos', colorAcento: '#FF0000', tono: 'energico' } });
  assert.deepEqual(ok.descartes, []);
  assert.equal(ok.spec.valores.numero, 3200);
  assert.equal(ok.spec.valores.colorAcento, '#ff0000');

  const malo = normalizarMotion({
    plantilla: 'cifra',
    valores: { numero: 'muchos', etiqueta: 'x'.repeat(61), colorAcento: 'red;background:url(x)', tono: 'loco', inventado: 1 },
  });
  assert.equal(malo.spec.valores.numero, PLANTILLAS.cifra.campos.find((c) => c.clave === 'numero')!.porDefecto);
  assert.equal(malo.spec.valores.etiqueta, 'clientes felices', 'un texto largo NO se recorta: se rechaza');
  assert.equal(malo.spec.valores.colorAcento, '#ffc24b', 'un color con CSS adentro no pasa');
  assert.equal(malo.spec.valores.tono, 'corporativo');
  assert.equal(malo.descartes.length, 5);
  assert.ok(malo.descartes.some((d) => /Número: no es un número/.test(d)));
  assert.ok(malo.descartes.some((d) => /inventado: no es un campo/.test(d)));

  const sinPlantilla = normalizarMotion({ plantilla: 'explosion' });
  assert.equal(sinPlantilla.spec.plantilla, 'titular');
  assert.ok(sinPlantilla.descartes[0].includes('no existe'));

  const vacio = normalizarMotion({ plantilla: 'tercio', valores: { nombre: '   ' } });
  assert.equal(vacio.spec.valores.nombre, 'Ana Pérez', 'un obligatorio vacío se rechaza');
  assert.ok(vacio.descartes.some((d) => d.includes('no puede quedar vacío')));

  // Lo que la persona escribe a mano no se rechaza por largo (el motor achica la letra); un disparate, sí.
  const aMano = normalizarMotion({ plantilla: 'cifra', valores: { etiqueta: 'x'.repeat(100) } }, { estricto: false });
  assert.equal((aMano.spec.valores.etiqueta as string).length, 100);
  const disparate = normalizarMotion({ plantilla: 'cifra', valores: { etiqueta: 'x'.repeat(5000) } }, { estricto: false });
  assert.equal(disparate.spec.valores.etiqueta, 'clientes felices');
});

test('datos de barras: «Etiqueta: valor» con miles y decimales en castellano', () => {
  assert.deepEqual(datosDeBarras('Enero: 1.250\nFebrero = 3,5; Marzo: 12'), [
    { etiqueta: 'Enero', valor: 1250 },
    { etiqueta: 'Febrero', valor: 3.5 },
    { etiqueta: 'Marzo', valor: 12 },
  ]);
  assert.deepEqual(datosDeBarras('sin número\n: 4'), []);
  // Para DIBUJAR no se corta nada en silencio: lo que no entra lo frena antes `leerDatosDeBarras` (más abajo).
  assert.equal(datosDeBarras(Array.from({ length: 9 }, (_, i) => `D${i}: ${i}`).join('\n')).length, 9);
  assert.equal(datosDeBarras('Un mes con un nombre larguísimo: 4')[0].etiqueta, 'Un mes con un nombre larguísimo');
  assert.equal(formatearNumero(1250, 0), '1.250');
  assert.equal(formatearNumero(-3.456, 2), '-3,46');
  assert.equal(formatearNumero(1234567.5, 1), '1.234.567,5');
});

/** Lo que DIBUJA una cifra (los dígitos que ruedan y lo fijo, en orden) y lo que lee un lector de pantalla. */
function cifraDibujada(valores: Record<string, string | number | boolean>, op: { estricto?: boolean } = {}) {
  const { spec } = normalizarMotion({ plantilla: 'cifra', valores: { prefijo: '', etiqueta: 'de calificación', ...valores } }, op);
  const e = armarEscena(spec, { aspecto: 16 / 9, video: true });
  const c = e.capas.find((x): x is CapaCifra => x.k === 'cifra')!;
  return { dibujo: c.partes.map((p) => ('d' in p ? String(p.d) : p.s)).join(''), texto: e.texto };
}

test('cifra: un número con decimales se muestra como se pidió, con coma decimal (4,5 nunca pasa a 5)', () => {
  // El bug del 26/10: el campo tenía paso 1 y `normalizarMotion` redondeaba antes de que `decimales` dijera nada.
  const n = normalizarMotion({ plantilla: 'cifra', valores: { numero: 4.5, etiqueta: 'de calificación' } });
  assert.deepEqual(n.descartes, []);
  assert.equal(n.spec.valores.numero, 4.5);
  assert.equal(cifraDibujada({ numero: 4.5 }).dibujo, '4,5', 'con «decimales» en 0 (el de fábrica) se ve el decimal');
  assert.ok(cifraDibujada({ numero: 4.5 }).texto.startsWith('4,5'), 'y el lector de pantalla lee lo mismo');
  assert.equal(normalizarMotion({ plantilla: 'cifra', valores: { numero: '4,5' } }).spec.valores.numero, 4.5, 'un texto con coma (la API)');
  // «decimales» es el MÍNIMO que se muestra, nunca un redondeo.
  assert.equal(cifraDibujada({ numero: 4.5, decimales: 2 }).dibujo, '4,50');
  assert.equal(cifraDibujada({ numero: 12, decimales: 1 }).dibujo, '12,0');
  assert.equal(cifraDibujada({ numero: 1250 }).dibujo, '1.250');
  assert.equal(cifraDibujada({ numero: -3.14 }).dibujo, '-3,14');
  // Sin el error de la coma flotante: 1,15 queda 1,15 (Math.round(1.15 / 0.01) * 0.01 da 1.1500000000000001).
  assert.equal(normalizarMotion({ plantilla: 'cifra', valores: { numero: 1.15 } }).spec.valores.numero, 1.15);
  assert.equal(cifraDibujada({ numero: 1.15 }).dibujo, '1,15');
  // Lo de la IA o la API que no entra en el paso se RECHAZA con su motivo; lo de la persona en el panel se lleva al paso.
  const tres = normalizarMotion({ plantilla: 'cifra', valores: { numero: 4.567 } });
  assert.equal(tres.spec.valores.numero, 1250, 'se queda el de fábrica: no se redondea en silencio');
  assert.match(tres.descartes[0], /^Número: 4,567 no va de a 0,01$/);
  assert.equal(normalizarMotion({ plantilla: 'cifra', valores: { numero: 4.567 } }, { estricto: false }).spec.valores.numero, 4.57);
  // Las estrellas van de a media: 4,3 no se vuelve 4,5 (sería una calificación que nadie dio).
  assert.match(normalizarMotion({ plantilla: 'testimonio', valores: { estrellas: 4.3 } }).descartes[0], /Estrellas.*: 4,3 no va de a 0,5/);
  assert.equal(normalizarMotion({ plantilla: 'testimonio', valores: { estrellas: 4.5 } }).spec.valores.estrellas, 4.5);
});

// ─────────────────────────────────────────────────────────────────────────────
// Las escenas: dentro del cuadro, del área segura, y el clip empieza y termina vacío
// ─────────────────────────────────────────────────────────────────────────────

function caja(c: Capa, a: number): { x0: number; y0: number; x1: number; y1: number } {
  if (c.k === 'caja') return { x0: c.x, y0: c.y, x1: c.x + c.w, y1: c.y + c.h };
  if (c.k === 'forma') return { x0: c.cx - c.r, y0: c.cy - c.r * a, x1: c.cx + c.r, y1: c.cy + c.r * a };
  const lineas = c.k === 'texto' ? c.lineas.length : 1;
  return { x0: c.x, y0: c.y, x1: c.x + c.ancho, y1: c.y + lineas * c.tam * c.interlineado * a };
}

test('escena: toda capa queda dentro del cuadro y del área segura, en las tres proporciones y con los textos más largos', () => {
  let revisadas = 0;
  for (const { p, a, largo, video } of escenas()) {
    for (const c of video.capas) {
      const b = caja(c, a);
      const donde = `${p} ${a.toFixed(2)} ${largo ? 'largo' : 'corto'} ${c.id}`;
      assert.ok(b.x0 >= 0.04 - 1e-9 && b.x1 <= 0.96 + 1e-9, `${donde}: x ${b.x0.toFixed(3)}–${b.x1.toFixed(3)}`);
      assert.ok(b.y0 >= 0.04 - 1e-9 && b.y1 <= 0.97 + 1e-9, `${donde}: y ${b.y0.toFixed(3)}–${b.y1.toFixed(3)}`);
      if (c.k === 'texto') {
        // Ninguna línea más ancha que su caja (con la estimación que comparten el lienzo y el CSS).
        for (const l of c.lineas) assert.ok(anchoEm(l, c.familia, c.peso, c.mayus, c.tracking) * c.tam <= c.ancho * 1.02 + 1e-9, `${donde}: «${l}» no entra`);
      }
      revisadas++;
    }
  }
  assert.ok(revisadas > 500, `revisó ${revisadas} capas`);
});

/** ¿Algo se ve en t? (alguna capa con algún pedazo visible). */
function seVe(e: Escena, t: number): boolean {
  return e.capas.some((c) => Array.from({ length: pedazos(c) }, (_, i) => estadoPedazo(c, i, t)).some((s) => s.alfa > 0.01 && s.escala > 0.01 && s.escalaX > 0.01 && s.escalaY > 0.01 && s.corteDer < 0.99 && Math.abs(s.dyAlto) < 1.05));
}

test('escena de video: el primer cuadro y el último están vacíos; en el medio se ve todo', () => {
  for (const { p, a, tono, video } of escenas()) {
    const donde = `${p} ${a.toFixed(2)} ${tono}`;
    assert.equal(seVe(video, 0), false, `${donde}: el cuadro 0 tiene que estar vacío`);
    // Un tercio inferior (sin fondo, sobre el video) espera el LEAD de lower-thirds (0,2 s) vacío.
    if (PLANTILLAS[p].sinFondo) assert.equal(seVe(video, 150), false, `${donde}: los primeros cuadros, vacíos`);
    assert.equal(seVe(video, video.durMs), false, `${donde}: el último cuadro tiene que estar vacío`);
    const todoAdentro = Math.max(...video.capas.map(finDeEntrada));
    assert.ok(todoAdentro < video.durMs - 400, `${donde}: entra todo (${todoAdentro} ms) antes de salir (${video.durMs} ms)`);
    if (p !== 'palabras') {
      // Todo entró y nada salió todavía: cada pedazo, en su estado final.
      const t = todoAdentro + 50;
      for (const c of video.capas)
        for (let i = 0; i < pedazos(c); i++) {
          const s = estadoPedazo(c, i, t);
          assert.ok(Math.abs(s.alfa - 1) < 1e-6 && Math.abs(s.dyAlto) < 1e-6 && Math.abs(s.escala - 1) < 1e-3, `${donde} ${c.id}[${i}] quieto en ${t}`);
        }
    }
  }
});

test('escena de landing: no sale; el estado final queda; una frase sola de «palabras» también se queda', () => {
  for (const { p, a, web } of escenas()) {
    for (const c of web.capas) {
      if (p === 'palabras' && c.id !== web.capas[web.capas.length - 1].id) assert.ok(c.sale, 'las frases que no son la última se van');
      else assert.equal(c.sale, undefined, `${p} ${a} ${c.id}: la landing no sale`);
    }
    assert.ok(seVe(web, web.durMs + 10_000), `${p}: el bloque terminado se ve`);
  }
});

test('ritmos: un número no rebota y lo que late para (WCAG 2.2.2: menos de 5 s)', () => {
  for (const { p, video } of escenas()) {
    for (const c of video.capas) {
      if (c.k === 'cifra' || c.id.startsWith('barra') || c.id.startsWith('valor')) assert.notEqual(c.entra.curva, 'rebote', `${p} ${c.id}`);
      if (c.latido) {
        assert.ok(c.latido.periodo * c.latido.veces <= 5000, `${p} ${c.id}: late ${c.latido.periodo * c.latido.veces} ms`);
        assert.equal(escalaLatido(c.latido, c.latido.t0 + c.latido.periodo * c.latido.veces + 1), 1);
        assert.ok(escalaLatido(c.latido, c.latido.t0 + c.latido.periodo / 2) > 1.03);
      }
    }
  }
  // Los tonos serios no rebotan ni en un botón.
  for (const t of ['premium', 'corporativo'] as const) assert.notEqual(RITMOS[t].pop, 'rebote');
});

test('kinetic typography: un grupo de palabras o letras entra en ~800 ms como mucho (o el tope de su plantilla)', () => {
  for (const { p, video } of escenas()) {
    for (const c of video.capas) {
      if (c.k !== 'texto' || c.partir === 'linea') continue;
      const n = pedazos(c);
      const total = (n - 1) * c.entra.paso + c.entra.dur;
      assert.ok(total <= 1000 + 1, `${p} ${c.id}: ${n} pedazos tardan ${total} ms`);
    }
  }
});

test('colores: el texto de un botón o un sello se lee sobre el acento (contraste ≥ 4,5)', () => {
  for (const acento of ['#ffc24b', '#2563eb', '#16a34a', '#111111', '#f5f5f5', '#e11d48']) {
    const e = armarEscena({ plantilla: 'cierre', valores: { colorAcento: acento } }, { aspecto: 16 / 9 });
    const label = e.capas.find((c) => c.id === 'boton-texto') as CapaTexto;
    assert.ok(contraste(label.color, acento) >= 4.5, `${acento} → ${label.color}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// El CSS y el lienzo cuentan lo mismo
// ─────────────────────────────────────────────────────────────────────────────

function nodos(n: NodoHtml, out: Array<{ tag: string; attrs: Record<string, string | undefined>; texto: string }> = []) {
  const [tag, ...resto] = n;
  const attrs = resto[0] && typeof resto[0] === 'object' && !Array.isArray(resto[0]) ? (resto[0] as Record<string, string | undefined>) : {};
  const hijos = resto.filter((h) => h !== attrs);
  out.push({ tag, attrs, texto: hijos.filter((h): h is string => typeof h === 'string').join('') });
  for (const h of hijos) if (Array.isArray(h)) nodos(h as NodoHtml, out);
  return out;
}
const variable = (style: string | undefined, k: string) => new RegExp(`--${k}:([^;]+);`).exec(style ?? '')?.[1];

test('HTML ↔ lienzo: cada pedazo animado del HTML lleva el efecto, el inicio, la duración y la curva del lienzo', () => {
  let cruzados = 0;
  for (const { p, a, video, web } of escenas()) {
    for (const e of [video, web]) {
      const todos = nodos(arbolDeEscena(e));
      for (const c of e.capas) {
        const capa = todos.findIndex((n) => n.attrs['data-capa'] === c.id);
        assert.ok(capa >= 0, `${p} ${c.id}: está en el HTML`);
        // Los pedazos de esta capa: los `.mo-a` que siguen hasta la próxima capa.
        const siguiente = todos.findIndex((n, i) => i > capa && n.attrs['data-capa'] !== undefined);
        const animados = todos.slice(capa + 1, siguiente < 0 ? undefined : siguiente).filter((n) => /\bmo-a\b/.test(n.attrs.class ?? ''));
        assert.equal(animados.length, pedazos(c), `${p} ${a.toFixed(2)} ${c.id}: ${animados.length} pedazos en el HTML, ${pedazos(c)} en el lienzo`);
        animados.forEach((n, i) => {
          const st = n.attrs.style;
          const ef = c.k === 'cifra' ? ('d' in c.partes[i] ? 'rodar' : 'aparecer') : c.entra.efecto;
          assert.equal(variable(st, 'mo-e'), nombreEntrada(ef));
          assert.equal(variable(st, 'mo-d'), `${inicioPedazo(c.entra, i)}ms`);
          assert.equal(variable(st, 'mo-dur'), `${c.entra.dur}ms`);
          assert.equal(variable(st, 'mo-ease'), cssDeCurva(c.entra.curva));
          // CSS no interpola `clip-path` de `inset(…)` a «nada»: un barrido sin su recorte natural escrito salta de golpe.
          if (c.entra.efecto === 'barrido' || c.sale?.efecto === 'barrido') assert.match(st ?? '', /clip-path:inset\(0 [\d.]+% 0 0\);/, `${p} ${c.id}: el barrido lleva su recorte natural`);
          if (c.sale) {
            assert.equal(variable(st, 'mo-sd'), `${inicioPedazo(c.sale, i)}ms`);
            assert.equal(variable(st, 'mo-sease'), cssDeCurva(c.sale.curva));
          } else assert.equal(variable(st, 'mo-s'), undefined);
          cruzados++;
        });
      }
    }
  }
  assert.ok(cruzados > 2000, `cruzó ${cruzados} pedazos`);
});

test('HTML ↔ lienzo: el cuadro 0 de cada @keyframes es el estado del lienzo con avance 0', () => {
  const num = (s: string, re: RegExp) => Number(re.exec(s)?.[1]);
  for (const ef of EFECTOS) {
    assert.match(CSS_MOTION, new RegExp(`@keyframes ${nombreEntrada(ef)} \\{ from \\{`));
    assert.match(CSS_MOTION, new RegExp(`@keyframes ${nombreSalida(ef)} \\{ to \\{`));
    const s = entrada(ef, 0);
    const k = KEYFRAMES_ENTRADA[ef];
    if (/opacity: 0/.test(k)) assert.equal(s.alfa, 0, `${ef}: opacidad`);
    else assert.equal(s.alfa, 1, `${ef}: no se apaga`);
    if (/translateY\(([-\d.]+)%\)/.test(k) && ef !== 'rodar') assert.equal(num(k, /translateY\(([-\d.]+)%\)/) / 100, s.dyAlto, `${ef}: máscara`);
    if (/translateY\(([-\d.]+)em\)/.test(k)) assert.equal(num(k, /translateY\(([-\d.]+)em\)/), s.dyEm, `${ef}: corrimiento`);
    if (/scale\(([-\d.]+)\)/.test(k)) assert.equal(num(k, /scale\(([-\d.]+)\)/), s.escala, `${ef}: escala`);
    if (/rotate\(([-\d.]+)deg\)/.test(k)) assert.equal(num(k, /rotate\(([-\d.]+)deg\)/), s.rot, `${ef}: giro`);
    if (/blur\(([-\d.]+)em\)/.test(k)) assert.equal(num(k, /blur\(([-\d.]+)em\)/), s.blurEm, `${ef}: desenfoque`);
    if (/scaleX\(0\)/.test(k)) assert.equal(s.escalaX, 0);
    if (/scaleY\(0\)/.test(k)) assert.equal(s.escalaY, 0);
    if (/inset\(0 100%/.test(k)) assert.equal(s.corteDer, 1);
    assert.ok(KEYFRAMES_SALIDA[ef], `${ef}: tiene salida`);
  }
  assert.equal(DESDE.subirAlto, 1.1, 'la máscara arranca en 110 %: con 100 % el descendente asoma');
});

test('HTML: el bloque es una imagen con su texto entero, los pedazos no se leen, y nada sale sin escapar', () => {
  const e = armarEscena({ plantilla: 'testimonio', valores: { cita: '<script>alert(1)</script> "Gracias"', nombre: 'Ana & Co', estrellas: 4.5 } }, { aspecto: 1 });
  const html = htmlDeArbol(arbolDeEscena(e) as unknown as NodoArbol);
  assert.match(html, /^<div class="gm-motion" role="img" aria-label="/);
  assert.ok(html.includes('4,5 de 5 estrellas'), 'las estrellas se leen como número');
  assert.ok(!html.includes('<script>'), 'el texto de la persona sale escapado');
  assert.ok(html.includes('&lt;script&gt;'));
  const capas = nodos(arbolDeEscena(e)).filter((n) => n.attrs['data-capa']);
  assert.ok(capas.length > 0 && capas.every((n) => n.attrs['aria-hidden'] === 'true'));
  // Las estrellas llenas van recortadas a 4,5 / 5 = 90 %.
  assert.ok(/clip-path:inset\(0 10%/.test(html));
});

// ─────────────────────────────────────────────────────────────────────────────
// El lienzo: dibuja lo que dice la escena (con un contexto que anota)
// ─────────────────────────────────────────────────────────────────────────────

function ctxAnotador() {
  const textos: string[] = [];
  const anotar = () => {};
  const ctx = new Proxy({ textos, filter: 'none', letterSpacing: '0px', font: '', globalAlpha: 1 } as Record<string, unknown>, {
    get(obj, k: string) {
      if (k in obj) return obj[k];
      if (k === 'measureText') return (s: string) => ({ width: s.length * 10 });
      if (k === 'fillText') return (s: string) => { if ((obj.globalAlpha as number) > 0.01) textos.push(s); };
      return anotar;
    },
    set(obj, k: string, v) { obj[k] = v; return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, textos };
}

test('lienzo: en el medio dibuja cada texto de la escena; en el cuadro 0 y en el último, ninguno', () => {
  for (const p of PLANTILLAS_MOTION) {
    const e = armarEscena({ plantilla: p, valores: valoresPorDefecto(p) }, { aspecto: 16 / 9, video: true });
    const medio = ctxAnotador();
    const t = Math.max(...e.capas.map(finDeEntrada)) + 20;
    dibujarEscena(medio.ctx, e, t, 1920, 1080);
    const dibujado = medio.textos.join(' ');
    const ultimaFrase = p === 'palabras' ? e.capas.filter((c) => c.k === 'texto').slice(-1) : e.capas;
    for (const c of ultimaFrase) {
      if (c.k !== 'texto' || c.id.startsWith('estrellas')) continue;
      for (const f of fragmentosDeTexto(c.lineas, c.partir)) {
        const txt = c.mayus ? f.texto.toLocaleUpperCase('es') : f.texto;
        assert.ok(dibujado.includes(txt), `${p} ${c.id}: dibuja «${txt}»`);
      }
    }
    for (const t0 of [0, e.durMs]) {
      const vacio = ctxAnotador();
      dibujarEscena(vacio.ctx, e, t0, 1920, 1080);
      assert.deepEqual(vacio.textos, [], `${p}: nada en ${t0}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// La revisión adversarial del 10/11/2026: un solo lector de números, el panel que valida, el render sin ejemplos
// ─────────────────────────────────────────────────────────────────────────────

test('R1 números: UN lector para la cifra, las barras, el chat, la API y el panel («1.250» y «1,250» son 1250)', () => {
  const panel = (s: string) => { const r = leerNumero(s, { estricto: false }); return r.ok ? r.n : r.motivo; };
  // El separador con EXACTAMENTE 3 cifras detrás es de miles; con 1, 2 o 4+, la coma decimal.
  assert.equal(panel('1.250'), 1250);
  assert.equal(panel('1,250'), 1250);
  assert.equal(panel('1.234.567'), 1234567);
  assert.equal(panel('4,5'), 4.5);
  assert.equal(panel('4.5'), 4.5);
  assert.equal(panel('3,14'), 3.14);
  assert.equal(panel('0,250'), 0.25, 'un 0 solo antes del separador no es de miles');
  assert.equal(panel('1234,567'), 1234.567, 'con 4 cifras antes no puede ser de miles');
  assert.equal(panel('1.234,5'), 1234.5);
  assert.equal(panel('1,234.5'), 1234.5);
  assert.equal(panel('-3'), -3);
  assert.equal(panel('+12'), 12);
  for (const malo of ['', ' ', '1e3', '0x10', '1 250', 'Infinity', '12.34.567', '1.2.3', '1,,5', '1.', ',5', '1.234,5,6', '30%'])
    assert.equal(panel(malo), 'no es un número', `«${malo}»`);
  // Estricto (la IA, la API): lo ambiguo se rechaza y el motivo dice las dos lecturas y qué escribir.
  const amb = leerNumero('1.250');
  assert.ok(!amb.ok && amb.ambiguo);
  assert.equal(!amb.ok && amb.motivo, '«1.250» puede ser 1250 o 1,25: escribe 1250 (sin separador) o 1,25');
  const neg = leerNumero('-1,250');
  assert.equal(!neg.ok && neg.motivo, '«-1,250» puede ser -1250 o -1,25: escribe -1250 (sin separador) o -1,25');
  assert.deepEqual(leerNumero('1.234,5'), { ok: true, n: 1234.5 }, 'con los dos separadores no hay ambigüedad');
  assert.deepEqual(leerNumero('4,5'), { ok: true, n: 4.5 });
  assert.deepEqual(leerNumero(1250), { ok: true, n: 1250 }, 'un número de un JSON no es ambiguo');
  // El saneo usa el mismo lector: «1.250» del panel es 1250 y la cifra dibuja «1.250», nunca «1,25».
  const delPanel = normalizarMotion({ plantilla: 'cifra', valores: { numero: '1.250' } }, { estricto: false });
  assert.equal(delPanel.spec.valores.numero, 1250);
  assert.equal(cifraDibujada({ numero: '1.250' }, { estricto: false }).dibujo, '1.250');
  assert.match(normalizarMotion({ plantilla: 'cifra', valores: { numero: '1,250' } }).descartes[0], /^Número: «1,250» puede ser 1250 o 1,25/);
  // Y lo que el panel MUESTRA se vuelve a leer a sí mismo (lo de la caja es lo que dibuja el video).
  for (const n of [0, 4.5, 12, 1250, 1234.5, 1234567.89, -3.14, 999_999_999, -0.5, 0.05])
    assert.equal(panel(numeroParaMostrar(n)), n, `${n} → «${numeroParaMostrar(n)}» → ${n}`);
  assert.equal(numeroParaMostrar(4.5), '4,5', 'el panel muestra la coma, como el video');
});

test('R2 barras: «Etiqueta: valor» de 1 a 6, cada línea legible; lo que no entra se rechaza con su motivo', () => {
  const motivo = (s: string, estricto = true) => { const r = leerDatosDeBarras(s, { estricto }); return r.ok ? 'ok' : r.motivo; };
  assert.equal(motivo('Enero: 30%\nFebrero: 45%'), 'el valor de «Enero» tiene que ser sólo un número (un «%» o un «$» va en Unidad)');
  assert.equal(motivo('Enero: $1.200'), 'el valor de «Enero» tiene que ser sólo un número (un «%» o un «$» va en Unidad)');
  assert.equal(motivo('Enero: 120, Febrero: 180'), '«Enero: 120, Febrero: 180» tiene más de un dato: va uno por línea');
  assert.equal(motivo('Enero 120'), '«Enero 120» no tiene «:» (escribe «Etiqueta: valor», uno por línea)');
  assert.equal(motivo(': 4'), '«: 4» no tiene etiqueta antes de «:»');
  assert.equal(motivo(Array.from({ length: 7 }, (_, i) => `D${i}: ${i}`).join('\n')), 'tiene 7 datos y el tope es 6');
  assert.equal(motivo('Un mes con un nombre larguísimo: 4'), 'la etiqueta «Un mes con un nombre larguísimo» tiene 31 caracteres y el tope es 24');
  assert.match(motivo('Ventas: 1.250'), /^en «Ventas», «1\.250» puede ser 1250 o 1,25/, 'estricto: lo ambiguo, con su motivo');
  assert.equal(motivo('Ventas: 1.250', false), 'ok', 'el panel lo lee como 1250');
  assert.equal(motivo('Enero: 120\nFebrero = 3,5; Marzo: -2'), 'ok');
  // El saneo estricto (el chat, la API) y el del panel los rechazan con el rótulo corto.
  assert.deepEqual(normalizarMotion({ plantilla: 'barras', valores: { datos: 'Enero: 30%' } }).descartes,
    ['Datos: el valor de «Enero» tiene que ser sólo un número (un «%» o un «$» va en Unidad)']);
  const r = validarCampoMotion('barras', 'datos', 'Enero: 120, Febrero: 180');
  assert.ok(!r.ok && /tiene más de un dato/.test(r.motivo));
  // Un dato con decimales se dibuja con los suyos (3,14 nunca «3,1»).
  const e = armarEscena({ plantilla: 'barras', valores: { datos: 'A: 3,14\nB: 2' } }, { aspecto: 16 / 9 });
  assert.deepEqual(e.capas.filter((c): c is CapaTexto => c.k === 'texto' && c.id.startsWith('valor')).map((c) => c.lineas.join(' ')), ['3,14', '2,00']);
});

test('R3 render: un obligatorio vacío deja su capa vacía, nunca el texto de EJEMPLO; lo largo y el color con alfa se dibujan', () => {
  for (const [p, campo, ejemplo] of [
    ['tercio', 'nombre', 'Ana Pérez'], ['testimonio', 'cita', 'duplicamos'], ['testimonio', 'nombre', 'Juan Gómez'], ['cifra', 'etiqueta', 'clientes felices'],
    ['titular', 'titulo', 'Vende más'], ['barras', 'datos', 'Enero'], ['oferta', 'descuento', '-50%'], ['cierre', 'boton', 'Probar gratis'],
  ] as const) {
    const e = armarEscena({ plantilla: p, valores: { ...valoresPorDefecto(p), [campo]: '' } }, { aspecto: 16 / 9, video: true });
    assert.ok(!e.texto.includes(ejemplo), `${p}.${campo} vacío: «${e.texto}» no lleva el ejemplo «${ejemplo}»`);
  }
  // Más largo que el tope duro del panel: se dibuja lo que hay (el panel no lo deja guardar), no el ejemplo.
  const largo = 'María Fernanda González de la Torre y Asociados '.repeat(6).trim();
  assert.ok(largo.length > topeDuro(32));
  assert.ok(armarEscena({ plantilla: 'tercio', valores: { nombre: largo } }, { aspecto: 16 / 9, video: true }).texto.startsWith('María Fernanda'));
  // Un color con transparencia que quedó guardado se dibuja con su color, sin la transparencia (no el de fábrica).
  assert.equal(armarEscena({ plantilla: 'titular', valores: { colorFondo: '#FF000080' } }, { aspecto: 1 }).fondo, '#ff0000');
  // Lo estricto y el panel lo siguen rechazando, con su motivo.
  assert.deepEqual(validarCampoMotion('titular', 'colorFondo', '#ff000080'), { ok: false, motivo: 'Fondo: «#ff000080» no es un color #RRGGBB' });
  assert.deepEqual(validarCampoMotion('tercio', 'nombre', '  '), { ok: false, motivo: 'Nombre: no puede quedar vacío' });
  assert.deepEqual(validarCampoMotion('tercio', 'nombre', 'x'.repeat(topeDuro(32) + 1)), { ok: false, motivo: `Nombre: tiene ${topeDuro(32) + 1} caracteres y el tope es ${topeDuro(32)}` });
  assert.deepEqual(validarCampoMotion('cifra', 'numero', '1.250'), { ok: true, valor: 1250 });
  assert.deepEqual(validarCampoMotion('testimonio', 'estrellas', '4,3'), { ok: true, valor: 4.5 }, 'el panel lleva al paso');
  assert.deepEqual(validarCampoMotion('cifra', 'numero', 'muchos'), { ok: false, motivo: 'Número: no es un número' });
});

test('R4 duración: la escena dura lo que el clip (sin el tope de 60 s) y queda quieta hasta la salida', () => {
  const e = armarEscena({ plantilla: 'tercio', valores: { nombre: 'Ana' } }, { aspecto: 16 / 9, video: true, durMs: 120_000 });
  assert.equal(e.durMs, 120_000);
  for (const t of [5_000, 59_700, 61_000, 100_000, 118_000]) assert.ok(seVe(e, t), `a los ${t} ms se ve`);
  assert.equal(seVe(e, 120_000), false, 'el último cuadro, vacío');
  assert.equal(armarEscena({ plantilla: 'tercio' }, { aspecto: 1, video: true, durMs: Number.NaN }).durMs, PLANTILLAS.tercio.duracionMs, 'sin una duración que sirva, la de la plantilla');
});

const BOTON_LARGO = 'Agenda hoy mismo tu llamada gratis de diagnóstico con todo nuestro equipo comercial y te contamos cómo crecer este año con todo';
const DESCUENTO_LARGO = '-50% de descuento en todo el plan anual, sólo por hoy y sólo para los primeros cien clientes que se inscriban antes de las doce de la noche';

test('R5 cajas de una línea: si el texto escrito a mano se parte, la caja crece con él', () => {
  const dentro = (txt: CapaTexto, y0: number, y1: number, a: number) => txt.y >= y0 - 1e-6 && txt.y + altoTexto(txt, a) <= y1 + 1e-6;
  for (const a of ASPECTOS) {
    const t = armarEscena({ plantilla: 'tercio', valores: { nombre: 'María Fernanda González de la Torre Ruiz y Asociados', rol: 'Directora comercial regional para Latinoamérica y el Caribe' } }, { aspecto: a, video: true });
    const nombre = t.capas.find((c) => c.id === 'nombre') as CapaTexto;
    const panel = t.capas.find((c) => c.id === 'panel') as Extract<Capa, { k: 'caja' }>;
    const rol = t.capas.find((c) => c.id === 'rol') as CapaTexto;
    const tab = t.capas.find((c) => c.id === 'pestana') as Extract<Capa, { k: 'caja' }>;
    assert.ok(dentro(nombre, panel.y, panel.y + panel.h, a), `${a.toFixed(2)}: el nombre (${nombre.lineas.length} líneas) entra en su panel`);
    assert.ok(dentro(rol, tab.y, tab.y + tab.h, a), `${a.toFixed(2)}: el cargo (${rol.lineas.length} líneas) entra en su pestaña`);
    const c = armarEscena({ plantilla: 'cierre', valores: { boton: BOTON_LARGO } }, { aspecto: a, video: true });
    const label = c.capas.find((x) => x.id === 'boton-texto') as CapaTexto;
    const boton = c.capas.find((x) => x.id === 'boton') as Extract<Capa, { k: 'caja' }>;
    assert.ok(dentro(label, boton.y, boton.y + boton.h, a), `${a.toFixed(2)}: el botón (${label.lineas.length} líneas) entra en su píldora`);
    const o = armarEscena({ plantilla: 'oferta', valores: { descuento: DESCUENTO_LARGO } }, { aspecto: a, video: true });
    const desc = o.capas.find((x) => x.id === 'descuento') as CapaTexto;
    const sello = o.capas.find((x) => x.id === 'sello') as Extract<Capa, { k: 'forma' }>;
    assert.ok(dentro(desc, sello.cy - sello.r * a * 0.8, sello.cy + sello.r * a * 0.8, a), `${a.toFixed(2)}: el descuento (${desc.lineas.length} líneas) entra en su sello`);
  }
  // Las de esta prueba se parten de verdad en vertical, y en más líneas de las que entran en la caja de una (si no, no
  // prueban nada: la caja de una línea tiene aire para dos en la píldora y en el sello).
  const lineas = (p: IdPlantilla, campo: string, s: string, id: string) =>
    (armarEscena({ plantilla: p, valores: { [campo]: s } }, { aspecto: 9 / 16, video: true }).capas.find((c) => c.id === id) as CapaTexto).lineas.length;
  assert.ok(lineas('tercio', 'nombre', 'María Fernanda González de la Torre Ruiz y Asociados', 'nombre') > 1);
  assert.ok(lineas('cierre', 'boton', BOTON_LARGO, 'boton-texto') >= 3);
  assert.ok(lineas('oferta', 'descuento', DESCUENTO_LARGO, 'descuento') >= 3);
});

test('R6 cifra: un «+» delante de un negativo no se dibuja «+-3»', () => {
  assert.equal(cifraDibujada({ prefijo: '+', numero: -3 }).dibujo, '-3');
  assert.equal(cifraDibujada({ prefijo: '+', numero: 3 }).dibujo, '+3');
  assert.equal(cifraDibujada({ prefijo: '$', numero: -3 }).dibujo, '$-3', 'otro prefijo se queda');
});

test('R7 la curva de WebKit lleva su aviso de licencia (BSD, Copyright (C) 2008 Apple Inc.)', () => {
  const aviso = readFileSync(new URL('../lib/motion/LICENSE-WEBKIT', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  assert.ok(aviso.split('\n').some((l) => l.trim() === 'Copyright (C) 2008 Apple Inc. All rights reserved.'));
  assert.match(aviso, /1\. Redistributions of source code must retain the above copyright\n {3}notice, this list of conditions and the following disclaimer\./);
  assert.match(aviso, /2\. Redistributions in binary form must reproduce the above copyright/);
  assert.match(aviso, /EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE\./);
  assert.doesNotMatch(aviso, /<html|404: Not Found/i);
  assert.match(readFileSync(new URL('../lib/motion/curvas.ts', import.meta.url), 'utf8'), /\.\/LICENSE-WEBKIT/, 'curvas.ts lo nombra');
});

test('R8 tramo quieto: en el medio todos los cuadros dibujan lo mismo, y el instante que dibuja es uno', () => {
  for (const p of PLANTILLAS_MOTION) {
    const e = armarEscena({ plantilla: p, valores: valoresPorDefecto(p) }, { aspecto: 16 / 9, video: true, durMs: 20_000 });
    const entro = Math.max(...e.capas.map(finDeEntrada), ...e.capas.flatMap((c) => (c.latido ? [c.latido.t0 + c.latido.periodo * c.latido.veces] : [])));
    const sale = Math.min(...e.capas.flatMap((c) => (c.sale ? [c.sale.t0] : [])));
    if (p === 'palabras') {
      // Las frases entran y salen a lo largo del clip: tiene más de un tramo quieto, y adentro de cada uno el instante es uno.
      assert.ok(e.capas.length > 1);
    } else {
      assert.ok(sale - entro > 5_000, `${p}: un tramo quieto largo`);
      const a = entro + 100, b = sale - 100;
      assert.equal(instanteQueDibuja(e, a), instanteQueDibuja(e, b), `${p}: el mismo instante de ${a} a ${b}`);
      const dibujo = (t: number) => { const x = ctxAnotador(); dibujarEscena(x.ctx, e, t, 1920, 1080); return x.textos.join('|'); };
      assert.equal(dibujo(instanteQueDibuja(e, b)), dibujo(b), `${p}: lo que dibuja el instante es lo que dibuja el cuadro`);
    }
    // Mientras algo se mueve, cada cuadro es el suyo: también mientras late un botón (después de entrar todo).
    for (const c of e.capas) if (c.latido) {
      const tl = c.latido.t0 + c.latido.periodo / 4;
      assert.equal(instanteQueDibuja(e, tl), tl, `${p} ${c.id}: latiendo, el instante es el cuadro`);
    }
    const t = e.capas[0].entra.t0 + 1;
    assert.equal(instanteQueDibuja(e, t), t, `${p}: entrando, el instante es el cuadro`);
    const saliendo = Math.min(...e.capas.flatMap((c) => (c.sale ? [c.sale.t0] : []))) + 10;
    assert.equal(instanteQueDibuja(e, saliendo), saliendo, `${p}: saliendo, también`);
    // Y cuando todo se fue, el último cuadro es uno solo (vacío).
    assert.equal(instanteQueDibuja(e, e.durMs - 5), instanteQueDibuja(e, e.durMs), `${p}: ya salió todo`);
  }
  // Antes de que entre nada, el cuadro 0 (el tercio inferior espera su LEAD de 0,2 s vacío).
  const ter = armarEscena({ plantilla: 'tercio', valores: valoresPorDefecto('tercio') }, { aspecto: 16 / 9, video: true });
  assert.equal(instanteQueDibuja(ter, 150), 0);
});

test('R9 panel: un texto que, aun con la letra más chica, saca la escena del cuadro no se guarda', () => {
  const v = valoresPorDefecto('oferta');
  const largo = 'Descuento enorme '.repeat(13).trim();
  assert.ok(largo.length <= topeDuro(10), 'está dentro del tope duro: lo frena el cuadro, no el largo');
  for (const a of [1, 16 / 9]) {
    assert.ok(desbordeDelCuadro(armarEscena({ plantilla: 'oferta', valores: { ...v, descuento: largo } }, { aspecto: a, video: true })) > 0.01, 'se sale de verdad');
    const r = validarCampoDelPanel('oferta', 'descuento', largo, { valores: v, aspecto: a });
    assert.deepEqual(r, { ok: false, motivo: `Descuento: es muy largo para el cuadro aun con la letra más chica; acórtalo (tiene ${largo.length} caracteres)` });
  }
  // Lo que entra pasa, y sin proporción (no se sabe el cuadro) sólo se valida el valor.
  assert.deepEqual(validarCampoDelPanel('oferta', 'descuento', '-50% hoy', { valores: v, aspecto: 1 }), { ok: true, valor: '-50% hoy' });
  assert.deepEqual(validarCampoDelPanel('oferta', 'descuento', largo, { valores: v }), { ok: true, valor: largo });
  // Lo que no vale se rechaza antes, con su motivo.
  assert.deepEqual(validarCampoDelPanel('oferta', 'descuento', ' ', { valores: v, aspecto: 1 }), { ok: false, motivo: 'Descuento: no puede quedar vacío' });
  // Y si ya se salía por OTRO campo, achicar éste no se frena (no se sale MÁS).
  const yaSeSale = { ...v, descuento: largo };
  assert.equal(validarCampoDelPanel('oferta', 'boton', 'Ok', { valores: yaSeSale, aspecto: 1 }).ok, true);
  // Las plantillas con sus textos de ejemplo entran todas.
  for (const p of PLANTILLAS_MOTION) for (const a of ASPECTOS) assert.equal(desbordeDelCuadro(armarEscena({ plantilla: p, valores: valoresPorDefecto(p) }, { aspecto: a, video: true })), 0, `${p} ${a}`);
});

// PROBADO ROMPIÉNDOLO (10/11/2026, la revisión adversarial; base 23/0, Node 24, cada rotura restaurada de memoria):
//   · `leerNumero` con 3 cifras = decimal (el `replace(',', '.')` de antes)          -> 19/4 (R1, R2, R3, barras)
//   · lo ambiguo NO se rechaza en estricto                                           -> 21/2 (R1, R2)
//   · `numeroParaMostrar` con punto decimal (el «4.5» del panel)                     -> 22/1 (R1)
//   · `leerDatosDeBarras` sin el tope de 6 / sin el de la etiqueta / sin «más de un dato» -> 22/1 cada una (R2)
//   · las barras con 1 decimal fijo (`decimales` de antes)                          -> 22/1 (R2)
//   · `armarEscena` con `estricto: false` en vez de `dibujo` (vuelve el ejemplo)      -> 22/1 (R3)
//   · el color con alfa sin recortar en el dibujo                                    -> 22/1 (R3)
//   · la escena con el tope de 60 s                                                  -> 22/1 (R4)
//   · el panel del tercio / la píldora con el alto de UNA línea                     -> 22/1 cada una (R5)
//   · el sello sin crecer con sus líneas                                             -> 21/2 (R5, R9)
//   · el «+» con un negativo                                                         -> 22/1 (R6)
//   · curvas.ts sin nombrar ./LICENSE-WEBKIT                                         -> 22/1 (R7)
//   · `instanteQueDibuja` devuelve siempre t / ignora los latidos                     -> 22/1 cada una (R8)
//   · `validarCampoDelPanel` sin medir el cuadro / sin comparar con lo de antes      -> 22/1 cada una (R9)
//   · sin efecto: renombrar la local `quieto` de `instanteQueDibuja`                  -> 23/0
