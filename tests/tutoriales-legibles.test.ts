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
// Lo segundo es estructural y por eso tiene test: el componente hace
// `ayuda={c.ayuda ?? servicio.tutorial}`, así que un campo SIN entrada en
// AYUDA_CAMPO abre el tutorial entero del servicio. Con un solo campo eso está
// bien —el tutorial ES la ayuda de ese campo—; con dos o más, todos abren lo
// mismo y el "?" deja de contestar la pregunta que se hizo el que lo tocó.
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
  const VERBOS = /\b(pega|copia|toca|entra|marca|activa|guarda|escribe|elige|abre|entra|entra)\b/gi;
  const largos: string[] = [];
  for (const m of ZONA_SERVICIOS.matchAll(/^ {6}'((?:[^'\\]|\\.){40,})',$/gm)) {
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

test('el copy de cara al cliente está en español neutro', () => {
  // El catálogo se escribe entre varias manos y siempre se cuela algo. Estas son
  // las cinco que se escaparon en la reescritura del 25/08/2026.
  //
  // ⚠️ Solo formas INEQUÍVOCAS de voseo: la primera versión de este chequeo incluía
  // `entra` y `toca` —que son el imperativo de TÚ, justo lo que queremos— y gritó
  // sobre 134 textos correctos. Un chequeo que grita sobre texto sano se apaga.
  const literales = [...ZONA_SERVICIOS.matchAll(/^ {4,8}'((?:[^'\\]|\\.){25,})',?$/gm)].map((m) => m[1]);
  assert.ok(literales.length > 300, `solo se leyeron ${literales.length} textos: el extractor quedó viejo`);

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

test('todo tutorial abre diciendo PARA QUÉ SIRVE, no cómo se hace', () => {
  // Es la regla 4 y la que más cambia si alguien va a seguir el tutorial o lo va a
  // cerrar: el primer paso tiene que contestar «¿esto para qué me sirve a mí?».
  const sinPorQue: string[] = [];
  for (const m of ZONA_AYUDA.matchAll(/^ {2}([A-Z0-9_]+):\s*\{\s*\n\s*pasos: \[\s*\n\s*'([^']{20,})/gm)) {
    if (!/^Para qué sirve/i.test(m[2])) sinPorQue.push(`${m[1]}: «${m[2].slice(0, 60)}…»`);
  }
  assert.deepEqual(
    sinPorQue, [],
    `estas ayudas de campo empiezan por el mecanismo en vez del resultado:\n${sinPorQue.join('\n')}`,
  );
});
