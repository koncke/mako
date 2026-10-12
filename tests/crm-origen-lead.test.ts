// =============================================================================
// Cada alta estampa DE DÓNDE VINO el lead, y la lista y la ficha lo miran
// =============================================================================
// `createLead` acepta `origen_lead` desde siempre y lo deja NULL, y NINGUNA de las
// cuatro altas se lo pasaba: el alta a mano (/crm/new y el modal del tablero), el
// alta desde el chat de WhatsApp, la importación y el alta de un cliente en Customer
// Success. El propio repo lo tenía anotado como agujero en lib/pipeline.ts
// («origen_lead = NULL es un tacho (alta a mano, import, lead creado desde el
// inbox), no una señal»). Medido el 03/10/2026: 70 leads con la columna vacía, 43 de
// ellos la lista en frío de una clienta.
//
// Y los dos lectores de la lista decidían el canal mirando el id del anuncio y la
// campaña, nunca la columna: `origenLegible` (app/crm/crm-map.ts), que es la que se VE.
// Consecuencia práctica: 1.000 contactos importados en frío y los que llegaron solos
// en la misma bolsa, con la misma etiqueta —«Directo»— afirmando de los 1.000 que
// habían llegado por su cuenta. El primer mensaje en frío le sale a alguien que
// escribió él.
//
// Lo que este archivo fija son las tres mitades del arreglo, porque cada una se
// puede apagar sola sin que nada falle:
//   1. las CUATRO altas estampan (un `createLead` nuevo que no lo haga no rompe nada)
//   2. los valores salen de UN catálogo (app/crm/origen-lead.ts), no de cada call site
//   3. la lista y la ficha cubren los MISMOS ids que el catálogo, cada una con el
//      rótulo de su superficie — si la ficha se queda sin un case, su `default`
//      vuelve a afirmar «llegó solo» sobre alguien que no llegó solo
//
// ⚠️ PROBADO ROMPIÉNDOLO. Con el arreglo puesto: 7 pases, 0 fallos.
//   · se le saca `origen_lead` al createLead de la importación
//       → 2 FALLOS, 5 pases («las cuatro altas estampan…», que nombra el call site, y
//         «los valores salen del catálogo…», que se queda sin valor que leer)
//   · se le saca `origen_lead` al createLead de app/customer-success/actions.ts
//       → 2 FALLOS, 5 pases (los mismos dos, nombrando ese archivo)
//   · se le saca el `case 'carga_manual'` a labelOrigen (OrigenCard.tsx)
//       → 1 FALLO, 6 pases («la ficha tiene un renglón por cada valor…»)
//   · `origenLegible` vuelve a terminar en `return 'Directo'`
//       → 1 FALLO, 6 pases («la lista LEE origen_lead…»)
//   · se agrega un id al catálogo ('feria') sin renglón en la ficha
//       → 1 FALLO, 6 pases (el mismo test que el case borrado: mira los dos lados)
//   · (12/10/2026, duodécima; base 8 / 0) se le saca a la ficha el `case 'instagram'` que entró con
//     Zernio → 1 FALLO, 7 pases («la ficha tiene un renglón por cada valor…»)
//
// ⚠️ Y la primera corrida de este archivo falló por SU PROPIA medición, no por el
// código: el regex que lee el valor de `origen_lead` no cortaba en `}`, así que en el
// alta que escribe el createLead en una línea leía «ORIGEN_LEAD.chat_whatsapp.id }» y
// acusaba a un call site correcto. Ante un guard nuevo que acusa, la primera
// hipótesis es el guard.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ORIGEN_LEAD, SIN_ORIGEN_LISTA, origenLista, type OrigenLeadId } from '../app/crm/origen-lead';
import { CANALES_SOCIALES, NOMBRE_CANAL } from '../lib/canal-social';

const raiz = (p: string) => join(import.meta.dirname, '..', p);
const leer = (p: string) => readFileSync(raiz(p), 'utf8');

/** Sin la prosa: un guard que lee el archivo entero encuentra lo que el archivo dice de sí. */
const soloCodigo = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Cada llamada a `createLead({ … })` de un archivo, con su cuerpo entero.
 *
 * ⚠️ SE BALANCEAN LAS LLAVES en vez de cortar a N caracteres o hasta el primer
 * `});`: el alta manual tiene objetos anidados adentro, así que un corte a ojo
 * devolvería media llamada y el guard contestaría sobre un pedazo. Y se busca
 * `createLead({` y no `createLead(`, porque la segunda forma también matchea
 * `createLeadAction(`, que es una action y no un alta.
 */
function llamadasACreateLead(src: string): string[] {
  const limpio = soloCodigo(src);
  const out: string[] = [];
  const marca = 'createLead({';
  let i = limpio.indexOf(marca);
  while (i >= 0) {
    let prof = 0;
    let j = i + marca.length - 1;
    for (; j < limpio.length; j++) {
      if (limpio[j] === '{') prof++;
      else if (limpio[j] === '}') { prof--; if (prof === 0) break; }
    }
    out.push(limpio.slice(i, j + 1));
    i = limpio.indexOf(marca, j);
  }
  return out;
}

/** Las cuatro altas, por archivo. Son las que crean un lead que nadie escribió solo. */
// La quinta vive en lib/ desde el 06/10/2026: la llaman el botón de la prueba y el
// cron que avisa por WhatsApp, y el alta no puede depender de quién tenga la sesión.
const ALTAS = ['app/crm/actions.ts', 'app/customer-success/actions.ts', 'lib/lead-de-prueba.ts'];

test('las cuatro altas estampan `origen_lead`: ninguna crea un lead sin procedencia', () => {
  let total = 0;
  for (const archivo of ALTAS) {
    const llamadas = llamadasACreateLead(leer(archivo));
    assert.ok(llamadas.length > 0, `no encontré ningún createLead({ en ${archivo}: ¿se renombró?`);
    for (const [n, cuerpo] of llamadas.entries()) {
      const primera = cuerpo.split('\n')[0].trim();
      assert.match(cuerpo, /origen_lead:/,
        `${archivo}, createLead #${n + 1} (${primera}) crea un lead SIN origen_lead: `
        + 'va a nacer indistinguible de uno que llenó un formulario. El valor sale del '
        + 'catálogo de app/crm/origen-lead.ts, no de una cadena escrita en el call site');
      total++;
    }
  }
  // Las cuatro del pedido: alta manual, chat de WhatsApp, importación y Customer
  // Success. Si aparece una quinta, el assert de arriba ya la obliga a estampar; este
  // número está para que agregar un camino de alta sea una decisión y no un descuido.
  // La QUINTA (06/10/2026): el lead PRUEBA del Pixel, que no es un canal de venta
  // —no lo escribió nadie— pero crea una fila en el CRM igual que las otras cuatro,
  // y por eso tiene que estampar de dónde vino. Subir este número es la decisión que
  // el comentario de arriba pide: queda escrito que el camino nuevo se revisó.
  //
  // Probado rompiéndolo el 06/10/2026: sacándole el `origen_lead:` al createLead de
  // `prueba-lead-actions.ts` (hoy en `lib/lead-de-prueba.ts`) quedan 5 pases y 2 fallos (éste y el del catálogo).
  assert.equal(total, 5, `son 5 altas conocidas y encontré ${total}: revisa la nueva`);
});

test('los valores salen del catálogo, no de una cadena en el call site', () => {
  for (const archivo of ALTAS) {
    for (const cuerpo of llamadasACreateLead(leer(archivo))) {
      // El `}` entra en el corte: una de las altas escribe el createLead en UNA línea,
      // así que sin él el valor se lee como «ORIGEN_LEAD.chat_whatsapp.id }» y el guard
      // acusa a un call site correcto. Lo primero que falla en un guard nuevo es su
      // propia medición.
      const valor = cuerpo.match(/origen_lead:\s*([^,\n}]+)/);
      assert.ok(valor, `no pude leer el valor de origen_lead en ${archivo}`);
      assert.match(valor[1].trim(), /^ORIGEN_LEAD\.[a-z_]+\.id$/,
        `${archivo} escribe origen_lead a mano (${valor[1].trim()}): con una cadena por `
        + 'call site, el cuarto camino inventa «manual» donde los otros tres pusieron '
        + '«carga_manual» y el filtro de origen del CRM queda partido en dos opciones '
        + 'que significan lo mismo');
    }
  }
});

test('la ficha tiene un renglón por cada valor del catálogo, y ninguno de más', () => {
  // El `default` de labelOrigen afirmaba «Orgánico / manual», que son dos hechos del
  // negocio sobre una columna de la que no se sabe ninguno. Ya había pasado dos veces
  // (con Cal.com y con 'landing'): una lista de cases que crece cuando alguien se
  // queja es una lista que va a volver a fallar.
  const src = leer('app/crm/lead-view/OrigenCard.tsx');
  const desde = src.indexOf('function labelOrigen');
  assert.ok(desde > 0, 'no encontré labelOrigen: ¿se renombró?');
  const hasta = src.indexOf('\n}', desde);
  const bloque = src.slice(desde, hasta);
  const cases = new Set([...soloCodigo(bloque).matchAll(/case '([a-z_]+)':/g)].map((m) => m[1]));
  const ids = new Set(Object.keys(ORIGEN_LEAD));
  for (const id of ids) {
    assert.ok(cases.has(id),
      `el catálogo tiene '${id}' y la ficha no tiene su case: el default va a decir `
      + '«sin dato de origen» sobre un lead cuyo origen SÍ está guardado');
  }
  for (const c of cases) {
    assert.ok(ids.has(c),
      `labelOrigen tiene un case para '${c}' y el catálogo no lo conoce: o el valor `
      + 'está muerto, o falta en app/crm/origen-lead.ts');
  }
});

test('la lista LEE `origen_lead`: no decide el canal sólo por el anuncio y la campaña', () => {
  // `origin` es el que se VE: lo dibuja la tarjeta del tablero y además arma las
  // opciones del filtro de origen, que se derivan de los valores presentes.
  const src = soloCodigo(leer('app/crm/crm-map.ts'));
  // ⚠️ ACÁ TAMBIÉN SE MIRABA `channelOf`, y se borró el 04/10/2026: su salida
  // (`originChannel`) no la leía NADIE —dos apariciones en todo el repo, la escritura
  // y la declaración del tipo—, así que arreglarla era arreglar algo que no se ve. Un
  // guard sobre una función huérfana da verde sobre una pantalla que miente.
  for (const fn of ['export function origenLegible']) {
    const desde = src.indexOf(fn);
    assert.ok(desde > 0, `no encontré ${fn} en crm-map.ts`);
    const bloque = src.slice(desde, src.indexOf('\n}', desde));
    assert.match(bloque, /origen_lead|origenLista/,
      `${fn} no mira origen_lead: la lista vuelve a poner en la misma bolsa a los `
      + '1.000 contactos de una importación y a los que llegaron solos');
    assert.doesNotMatch(bloque, /return 'Directo'/,
      `${fn} vuelve a afirmar «Directo» como fallback: de una columna vacía no se sabe `
      + 'si la persona llegó sola o si la cargamos nosotros');
  }
});

test('ningún rótulo de fila deja escapar el id crudo, y el vacío no afirma nada', () => {
  // `carga_manual` en una tarjeta es el nombre interno de la cosa, no el nombre de la
  // cosa. El lector de antes hacía `return o ?? 'Directo / orgánico'`, así que el id
  // se le escapaba a la pantalla en cuanto alguien escribiera un valor nuevo.
  assert.equal(origenLista(null), SIN_ORIGEN_LISTA);
  assert.equal(origenLista(''), SIN_ORIGEN_LISTA);
  assert.equal(origenLista('  '), SIN_ORIGEN_LISTA);
  assert.equal(origenLista('un_valor_que_nadie_escribio'), SIN_ORIGEN_LISTA);
  for (const id of Object.keys(ORIGEN_LEAD) as OrigenLeadId[]) {
    const r = origenLista(id);
    assert.notEqual(r, id, `'${id}' se dibuja crudo`);
    assert.ok(r.trim().length > 0, `'${id}' no tiene rótulo`);
  }
  // Y el vacío no dice «Directo» ni «Orgánico»: las dos afirman cómo llegó alguien de
  // quien no se sabe cómo llegó.
  assert.doesNotMatch(SIN_ORIGEN_LISTA, /directo|org[áa]nico/i);
});

test('el rótulo de fila entra en una celda: una lista no es una ficha', () => {
  // La tarjeta del tablero lo dibuja en una línea `nowrap` con elipsis y el filtro lo
  // usa como opción. El rótulo largo —el de la ficha— vive en labelOrigen, que es
  // otra superficie con otro techo.
  for (const [id, def] of Object.entries(ORIGEN_LEAD)) {
    assert.ok(def.lista.length <= 24, `el rótulo de '${id}' mide ${def.lista.length}: no entra en la tarjeta`);
    assert.equal(def.id, id, `la clave '${id}' y su id no coinciden`);
  }
});

// DUODÉCIMA TANDA (12/10/2026). El alta de Zernio (`crearLeadDe`, lib/zernio-entrante.ts) escribe
// `origen_lead: e.canal` —una variable, no una cadena—, así que el barrido de abajo no la veía, y el
// catálogo no conocía 'instagram' ni 'messenger': la tarjeta y el filtro decían «Sin origen» de un lead
// que llegó por Instagram. PROBADO ROMPIÉNDOLO (12/10/2026), restaurando de memoria. Con todo puesto el
// archivo da 7 pass / 1 fail: el de la ficha, hasta que labelOrigen (app/crm/lead-view/OrigenCard.tsx, fuera
// de este paquete) tenga los cases 'instagram' y 'messenger' — probado en memoria: con ellos, 8 / 0.
//   · sin `instagram` en ORIGEN_LEAD           -> 6 / 2 (éste, y el de la ficha)
//   · Messenger rotulado «Facebook»            -> 6 / 2 (éste, y el de la ficha)
test('los canales de Zernio (Instagram y Messenger) son orígenes del catálogo, con su nombre', () => {
  assert.match(soloCodigo(leer('lib/zernio-entrante.ts')), /origen_lead: e\.canal,/,
    'el alta de Zernio dejó de escribir el canal del evento: revisa este test');
  for (const canal of CANALES_SOCIALES) {
    assert.ok(canal in ORIGEN_LEAD, `el alta de Zernio escribe '${canal}' y el catálogo no lo tiene`);
    assert.equal(origenLista(canal), NOMBRE_CANAL[canal]);
  }
});

test('todo valor que el repo ESCRIBE en la columna está en el catálogo', () => {
  // Los cuatro caminos que ya estampaban antes de este cambio están afuera de mi
  // paquete (la ingesta de Meta, el opt-in de la landing, Calendly y Cal.com), así
  // que el catálogo los tiene que conocer igual: si no, la lista y la ficha vuelven a
  // contestar por el default sobre un dato que está bien guardado.
  const fuentes = [
    'lib/leads.ts',
    'app/api/track/optin/route.ts',
    'app/api/webhooks/calcom/route.ts',
    'app/crm/actions.ts',
    'app/customer-success/actions.ts',
  ];
  const escritos = new Set<string>();
  for (const f of fuentes) {
    for (const m of soloCodigo(leer(f)).matchAll(/origen_lead:\s*'([a-z_]+)'/g)) escritos.add(m[1]);
    for (const m of soloCodigo(leer(f)).matchAll(/origen_lead\s*\?\?\s*'([a-z_]+)'/g)) escritos.add(m[1]);
  }
  assert.ok(escritos.size >= 4, `esperaba al menos los 4 valores viejos y leí ${escritos.size}`);
  for (const v of escritos) {
    assert.ok(v in ORIGEN_LEAD,
      `el repo escribe origen_lead '${v}' y el catálogo no lo tiene: la lista lo va a `
      + 'dibujar como «Sin origen» teniendo el dato guardado');
  }
});
