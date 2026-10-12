// =============================================================================
// Los tutoriales, como los lee un cliente que no sabe qué es un webhook
// =============================================================================
// Dos quejas del dueño, el 25/08/2026:
//
//   «se tiene que entender FÁCIL, imaginate que esas personas NO saben lo que es
//    "Marcar los eventos" o "Cargar un secret"»
//   «la guía de cada cosa aparece siempre el mismo» (el "?" de todos los campos
//    abría el mismo texto)
//
// Y una tercera, el 12/10/2026, de la prueba con un cliente (Fiesta Music): «los
// tutoriales para conectar APIs están muy largos». Eran 55 tutoriales con 648 pasos (el
// de Meta, 29) y notas de 393 caracteres; quedaron 54 con 250. Desde ese día un tutorial
// son 3 a 5 pasos de UNA línea (120 caracteres o menos), condensados de los de antes,
// nunca con un paso nuevo.
//
// Lo segundo es estructural y por eso tiene test: el componente hace
// `ayuda={c.ayuda ?? servicio.tutorial}`, así que un campo SIN entrada en
// AYUDA_CAMPO abre el tutorial entero del servicio. Con un solo campo eso está
// bien —el tutorial ES la ayuda de ese campo—; con dos o más, todos abren lo
// mismo y el "?" deja de contestar la pregunta que se hizo el que lo tocó.
//
// ⚠️ EL GUARD DE LOS VERBOS ESTUVO CIEGO (medido el 12/10/2026): buscaba los pasos a 6
// espacios, los pasos están a 8, y AYUDA_CAMPO no la miraba nadie. Leía 0 líneas y pasaba
// en verde. Corregido el extractor, sobre el catálogo de antes de acortarlo marcaba 6
// pasos de Meta con 3 o 4 verbos (2 del tutorial del servicio y 4 de sus ayudas de campo).
// Un extractor que puede leer cero tiene que fallar al leer cero: por eso cada extractor
// de abajo exige un piso.
//
// PROBADO ROMPIÉNDOLO (12/10/2026, restaurando entre cada una; base 6 pases / 0 fallos):
//   · el catálogo de ANTES de acortarlo (lib/metodo-catalogo.ts de e58ff6c9)  → 4 fallos, 2 pases
//     (verbos: los 6 pasos de Meta; 3 a 5: los 55 tutoriales; notas: 41 de más de 120 y 3 «ojo»
//      de 4 ítems; para qué: los 19 servicios lo repetían. Voseo y varios campos, limpios);
//   · un paso de Groq con 4 verbos («Entra, toca, copia y pega…»)              → 1 fallo, 5 pases;
//   · un sexto paso en el tutorial de Stripe                                   → 1 fallo, 5 pases;
//   · un paso de Zernio partido en dos literales con `+`                       → 1 fallo, 5 pases;
//   · la nota de Groq a 121 caracteres                                         → 1 fallo, 5 pases;
//   · el «Para qué sirve» de vuelta como primer paso del tutorial de Stripe    → 1 fallo, 5 pases;
//   · el extractor de verbos de vuelta a 6 espacios (lee 0: falla su piso)     → 1 fallo, 5 pases.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const FUENTE = readFileSync(new URL('../lib/metodo-catalogo.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ZONA_SERVICIOS = FUENTE.slice(FUENTE.indexOf('SERVICIOS_METODO'), FUENTE.indexOf('export const serviciosPara'));
const ZONA_AYUDA = FUENTE.slice(FUENTE.indexOf('AYUDA_CAMPO'), FUENTE.indexOf('export function ayudaDeCampo'));
const CON_AYUDA = new Set([...ZONA_AYUDA.matchAll(/^ {2}([A-Z0-9_]+):\s*\{/gm)].map((m) => m[1]));

/** Los servicios con sus campos, en orden de aparición. */
function servicios(): Array<{ key: string; campos: string[] }> {
  const out: Array<{ key: string; campos: string[] }> = [];
  for (const m of ZONA_SERVICIOS.matchAll(/key: '([a-z0-9_-]+)',|\{ env: '([A-Z0-9_]+)'/g)) {
    if (m[1]) out.push({ key: m[1], campos: [] });
    else if (out.length) out[out.length - 1].campos.push(m[2]);
  }
  return out;
}

/**
 * Los arreglos `pasos: [ … ]` de los dos bloques: el tutorial de cada servicio y la ayuda de cada campo.
 * Cada renglón de adentro es un paso (un literal entero) o un comentario; lo que no es ninguna de las dos
 * cosas se devuelve aparte, porque es un paso partido en dos renglones.
 */
function tutoriales(): Array<{ donde: string; pasos: string[]; partidos: string[] }> {
  const out: Array<{ donde: string; pasos: string[]; partidos: string[] }> = [];
  for (const [zona, nombre, cabeza] of [
    [ZONA_SERVICIOS, 'servicio', /key: '([a-z0-9_-]+)',/g],
    [ZONA_AYUDA, 'campo', /^ {2}([A-Z0-9_]+):\s*\{/gm],
  ] as const) {
    const dueños = [...zona.matchAll(cabeza)].map((m) => ({ i: m.index, k: m[1] }));
    for (const m of zona.matchAll(/\bpasos: \[\n([\s\S]*?)\n\s*\],/g)) {
      const dueño = dueños.filter((d) => d.i < m.index).pop()?.k ?? '?';
      const pasos: string[] = [];
      const partidos: string[] = [];
      for (const l of m[1].split('\n')) {
        if (/^\s*(\/\/.*)?$/.test(l)) continue;
        const p = /^\s*'((?:[^'\\]|\\.)*)',?$/.exec(l);
        if (p) pasos.push(p[1]); else partidos.push(l.trim().slice(0, 80));
      }
      out.push({ donde: `${nombre} ${dueño}`, pasos, partidos });
    }
  }
  return out;
}

/**
 * El largo que se mide: una lista de nombres técnicos al final, después de «:», no cuenta
 * (los 8 permisos de Meta se copian de a uno; partirlos en otro paso no lo hace más corto).
 */
const largo = (p: string) => p.replace(/:\s*[a-z0-9_]+(?:,\s*[a-z0-9_]+)+\.?$/, ':').length;
const TOPE = 120;

test('un servicio con VARIOS campos no puede abrir el mismo texto en todos', () => {
  const repetidos = servicios()
    .filter((s) => s.campos.length > 1 && s.campos.every((e) => !CON_AYUDA.has(e)))
    .map((s) => `${s.key} (${s.campos.length} campos)`);
  assert.deepEqual(
    repetidos, [],
    `en estos servicios el "?" de todos los campos abre el MISMO tutorial: ${repetidos.join(', ')}. ` +
    'La ayuda del servicio contesta «cómo conecto esto»; la del campo, «qué pongo aquí». ' +
    'Con dos campos y una sola ayuda, uno de los dos está contestando otra cosa.',
  );
});

test('cada paso hace UNA cosa, no tres', () => {
  // El paso que detonó el pedido: «Pega la dirección de arriba, marca los eventos y
  // carga un secret». Tres acciones en una frase. La señal barata y sin falsos
  // positivos es contar los VERBOS DE ACCIÓN en imperativo dentro de un mismo paso.
  const VERBOS = /\b(pega|copia|toca|entra|marca|activa|guarda|escribe|elige|abre)\b/gi;
  // A 8 espacios: los pasos de un tutorial de servicio, los de una ayuda de campo y los
  // «ojo» del recuadro amarillo. A 6 leía 0 líneas (ver arriba).
  const leidos = [...ZONA_SERVICIOS.matchAll(/^ {8}'((?:[^'\\]|\\.){40,})',$/gm), ...ZONA_AYUDA.matchAll(/^ {8}'((?:[^'\\]|\\.){40,})',$/gm)];
  assert.ok(leidos.length > 50, `solo se leyeron ${leidos.length} pasos: el extractor quedó viejo (estuvo en 0)`);
  const largos: string[] = [];
  for (const m of leidos) {
    const paso = m[1];
    // Los verbos que están DENTRO de una explicación entre comillas o después de
    // dos puntos no cuentan: ahí se está describiendo, no pidiendo.
    const pedido = paso.split(/[:(]/)[0];
    const n = (pedido.match(VERBOS) ?? []).length;
    if (n >= 3) largos.push(paso.slice(0, 110));
  }
  assert.deepEqual(
    largos, [],
    `estos pasos piden tres o más acciones en una sola frase:\n${largos.join('\n')}\n` +
    'Cada uno tiene que ser un paso.',
  );
});

test('un tutorial son 3 a 5 pasos de una línea', () => {
  // «Los tutoriales para conectar APIs están muy largos» (12/10/2026). Vale para los
  // DOS bloques: el tutorial del servicio y la ayuda de cada campo. Acortar es
  // condensar los pasos de hoy, que nombran pantallas reales: nunca sumar uno.
  const todos = tutoriales();
  assert.ok(todos.length > 40, `solo se leyeron ${todos.length} tutoriales: el extractor quedó viejo`);
  const malos: string[] = [];
  for (const t of todos) {
    if (t.partidos.length) malos.push(`${t.donde}: un paso partido en varios renglones («${t.partidos[0]}»)`);
    if (t.pasos.length < 3 || t.pasos.length > 5) malos.push(`${t.donde}: ${t.pasos.length} pasos`);
    for (const p of t.pasos) if (largo(p) > TOPE) malos.push(`${t.donde}: ${largo(p)} caracteres en «${p.slice(0, 60)}…»`);
  }
  assert.deepEqual(malos, [], `tutoriales fuera de formato (3 a 5 pasos, de ${TOPE} caracteres o menos):\n${malos.slice(0, 15).join('\n')}`);
});

test('una nota de campo y un «ojo» del recuadro amarillo caben en una línea', () => {
  // La nota se dibuja ARRIBA de los pasos (PasosAyuda, ServicioConfigForm.tsx): una nota de
  // 393 caracteres tapaba el tutorial que venía a acortar. El «ojo» es lo que rompe el paso
  // externo en silencio: dos cosas, no un párrafo por cada casilla.
  const notas = [...FUENTE.matchAll(/\bnota: ?'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
  assert.ok(notas.length > 30, `solo se leyeron ${notas.length} notas: el extractor quedó viejo`);
  const malos = notas.filter((n) => n.length > TOPE).map((n) => `nota de ${n.length}: «${n.slice(0, 60)}…»`);
  const ojos = [...ZONA_SERVICIOS.matchAll(/\bojo: \[\n([\s\S]*?)\n\s*\],/g)].map((m) => [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]));
  assert.ok(ojos.length >= 3, `solo se leyeron ${ojos.length} «ojo»: el extractor quedó viejo`);
  for (const o of ojos) {
    if (o.length > 2) malos.push(`un «ojo» de ${o.length} ítems: «${o[0].slice(0, 50)}…»`);
    for (const x of o) if (x.length > TOPE) malos.push(`un «ojo» de ${x.length}: «${x.slice(0, 60)}…»`);
  }
  assert.deepEqual(malos, [], `texto de más:\n${malos.slice(0, 12).join('\n')}`);
});

test('el copy de cara al cliente está en español neutro', () => {
  // El catálogo se escribe entre varias manos y siempre se cuela algo. Estas son
  // las cinco que se escaparon en la reescritura del 25/08/2026.
  //
  // ⚠️ Solo formas INEQUÍVOCAS de voseo: la primera versión de este chequeo incluía
  // `entra` y `toca` —que son el imperativo de TÚ, justo lo que queremos— y gritó
  // sobre 134 textos correctos. Un chequeo que grita sobre texto sano se apaga.
  //
  // Lee los pasos de los DOS bloques y las notas (antes, sólo los servicios).
  const literales = [
    ...[ZONA_SERVICIOS, ZONA_AYUDA].flatMap((z) => [...z.matchAll(/^ {4,8}'((?:[^'\\]|\\.){25,})',?$/gm)].map((m) => m[1])),
    ...[...FUENTE.matchAll(/\bnota: ?'((?:[^'\\]|\\.){25,})'/g)].map((m) => m[1]),
  ];
  // ⚠️ El umbral es un piso contra un EXTRACTOR roto, no un conteo del catálogo. Estuvo en
  // 300 y en 250; el 12/10/2026 los tutoriales se acortaron a 3-5 pasos y el catálogo bajó
  // de ~600 renglones de copy a ~300. 50 sigue muy por encima de lo que lee un extractor
  // roto (cero, o un puñado) y deja margen para acortar todavía más sin tocar este número.
  assert.ok(literales.length > 50, `solo se leyeron ${literales.length} textos: el extractor quedó viejo`);

  const PROHIBIDO: Array<[RegExp, string]> = [
    [/\b(pegá|copiá|tocá|entrá|mirá|andá|dejalo|marcalo|pegalo|pegala|copiala|guardalo|buscala|creala|ponele|tenés|querés|podés)\b/, 'voseo'],
    [/\bac[áa]\b/, '«acá» — va «aquí», o mejor: nombrar el campo'],
    [/->/, 'flecha ASCII — va →'],
    [/\b(mako|MAKO|Mako)\b/, 'la marca va «MaKo»'],
    [/\b(nos avisa|te pedimos|traemos|lo usamos)\b/, 'primera persona'],
    [/no hace falta que entiendas/, 'condescendencia'],
  ];
  const malos: string[] = [];
  for (const t of literales) {
    for (const [re, que] of PROHIBIDO) {
      const m = re.exec(t);
      if (m) malos.push(`[${que}] …${t.slice(Math.max(0, m.index - 30), m.index + 30)}…`);
    }
  }
  assert.deepEqual(malos, [], `copy fuera de la voz de la casa:\n${malos.slice(0, 12).join('\n')}`);
});

test('toda ayuda de campo abre diciendo PARA QUÉ SIRVE, y el tutorial del servicio no lo repite', () => {
  // Es la regla 4 y la que más cambia si alguien va a seguir el tutorial o lo va a
  // cerrar: el primer paso tiene que contestar «¿esto para qué me sirve a mí?».
  // En el tutorial del SERVICIO eso ya lo dice `paraQue` (arriba del tutorial en
  // /metodo, MetodoWizard.tsx, y en las slides de /integraciones): repetirlo es un paso de más.
  const sinPorQue: string[] = [];
  for (const m of ZONA_AYUDA.matchAll(/^ {2}([A-Z0-9_]+):\s*\{\s*\n\s*pasos: \[\s*\n\s*'([^']{20,})/gm)) {
    if (!/^Para qué sirve/i.test(m[2])) sinPorQue.push(`${m[1]}: «${m[2].slice(0, 60)}…»`);
  }
  assert.deepEqual(
    sinPorQue, [],
    `estas ayudas de campo empiezan por el mecanismo en vez del resultado:\n${sinPorQue.join('\n')}`,
  );
  const repiten = tutoriales().filter((t) => t.donde.startsWith('servicio ') && /^Para qué sirve/i.test(t.pasos[0] ?? '')).map((t) => t.donde);
  assert.deepEqual(repiten, [], `estos tutoriales de servicio repiten el «Para qué sirve» de paraQue: ${repiten.join(', ')}`);
});
