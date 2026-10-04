// =============================================================================
// Calendly: el cliente conecta, no entra nada y no hay ningún error (#174)
// =============================================================================
// «Calendly: el cliente conecta, no entra nada y no hay ningún error» — Martín, el
// 01/10/2026. La causa estaba en tres lugares distintos y el guard que ya existe
// (tests/webhook-ruteo-obligatorio.test.ts) cubre sólo el primero: que el campo que
// escribe la fila de `webhook_routing` no se pueda dejar vacío. Este cubre los otros
// dos, y por eso va en un archivo aparte: un guard que junta todo dice que algo se
// rompió y no cuál, que es lo único que ahorra tiempo.
//
//   1. EL DESCARTE DEJA RASTRO. El webhook cortaba con `{ ok: true, ignored: 'sin
//      workspace' }` y un `console.warn` que a los 60 minutos ya no existe, así que
//      «la reserva no llegó» y «la tiramos nosotros» se veían exactamente igual
//      —mirando la base, mirando los logs y repitiendo la prueba—. Una política puede
//      RECHAZAR; no puede no dejar rastro.
//
//   2. LOS TEXTOS NO MIENTEN. lib/tab-activacion.ts le decía al cliente que la signing
//      key que acababa de pegar «no se lee», y es FALSO: el route la lee con
//      `credWs('CALENDLY_WEBHOOK_SIGNING_KEY', ws)` y sólo cae a la de plataforma si
//      ese workspace no tiene la suya. Y el tutorial del servicio seguía anunciando
//      como opcional el campo que desde el 04/10/2026 es obligatorio. Un texto que le
//      dice a alguien que lo que acaba de cargar no sirve es peor que no decir nada.
//
// Lo que vuelve esto urgente: el «cliente nuevo que conecta su agenda y no ve nada» es
// Martín. En el workspace del super admin no hay ninguna credencial de Calendly ni
// ninguna fila de ruteo (medido en producción el 03/10/2026), y el 17/10 prospecta en
// frío. Conectar su agenda no lo hace este guard; que la pantalla pueda decírselo, sí.
//
// Correr: npx tsx --test tests/calendly-sin-tipos.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ⚠️ SE LEE COMO TEXTO Y NO SE IMPORTA: el route y el catálogo arrastran `server-only`,
// que bajo `npm test` tira. Es la misma razón por la que los otros guards leen fuente.
const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ROUTE = leer('app/api/webhooks/calendly/route.ts');
const TABS = leer('lib/tab-activacion.ts');
const CATALOGO = leer('lib/metodo-catalogo.ts');

/**
 * El trozo de fuente que va de `desde` hasta `hasta`.
 *
 * ⚠️ TODO ESTE ARCHIVO PREGUNTA SOBRE BLOQUES Y NUNCA SOBRE EL ARCHIVO ENTERO. Un
 * `assert.match(FUENTE, /…/)` sobre un módulo de 400 líneas no prueba que la cosa esté
 * donde tiene que estar: prueba que la palabra aparece en algún lado — y en este repo
 * un guard así dio verde sobre cuatro de cinco roturas.
 */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i > 0, `desapareció el ancla «${desde}»: si el código se movió, este guard hay que reescribirlo`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

/**
 * El bloque sin sus líneas de comentario.
 *
 * ⚠️ HACE FALTA, y no es prolijidad: la convención de la casa es explicar en el
 * comentario qué se saca y por qué, así que un guard que pregunte «¿sigue habiendo un
 * email acá?» se acusa a sí mismo con el comentario que dice «sin nombre, sin email y
 * sin teléfono». Ya pasó en este repo con un `doesNotMatch` que fallaba contra su
 * propio comentario.
 */
const sinComentarios = (b: string) => b.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

// ── 1. El descarte deja rastro ────────────────────────────────────────────────

test('la rama sin ruteo ANOTA el descarte en vez de irse con un 200 mudo', () => {
  const rama = sinComentarios(bloque(ROUTE, '  if (ws == null) {', '\n  }'));
  assert.match(rama, /anotarReservaSinRuteo\(/, 'el descarte volvió a ser un 200 sin una sola fila que lo diga');
  assert.match(rama, /console\.warn\(/, 'el log sigue sirviendo para depurar después: se suma a la huella, no la reemplaza');
  // Y el 200 se queda: un 4xx hace que Calendly DESHABILITE la suscripción tras días
  // de entregas fallidas, y no deja reactivarla. Eso cambia un evento descartado por
  // la integración entera caída.
  assert.match(rama, /ok: true/, 'un 4xx acá tira la suscripción entera, no sólo este evento');
});

test('el cuerpo de la respuesta dice que la reserva LLEGÓ y no entró, y dónde se arregla', () => {
  // Es la otra superficie consultable, y no es de adorno: Calendly muestra el cuerpo de
  // la respuesta en su propio registro de entregas. El renglón decía «sin workspace»,
  // que es nuestro vocabulario y no dice qué hacer.
  const rama = sinComentarios(bloque(ROUTE, '  if (ws == null) {', '\n  }'));
  assert.match(rama, /llegó y no entró/, 'el renglón volvió a decir sólo que se ignoró');
  assert.match(rama, /\/integraciones/, 'el mensaje no dice dónde se arregla');
  assert.match(rama, /Tipo de evento de R1/, 'el mensaje no nombra el campo que falta');
});

test('la huella NO lleva datos de la persona que reservó', () => {
  // Lo que se guarda es que PASÓ y por qué, nunca quién: una tabla de eventos no es
  // lugar para el contacto de alguien que el negocio decidió no ingestar, y el motivo
  // del descarte no necesita saberlo.
  const rama = sinComentarios(bloque(ROUTE, '  if (ws == null) {', '\n  }'));
  const huella = sinComentarios(bloque(ROUTE, 'async function anotarReservaSinRuteo(', '\n}'));
  const personales = /\b(email|invitee|telefono|tel[eé]fono|nombre|first_name|last_name|questions_and_answers)\b/;
  assert.doesNotMatch(rama, personales, 'la respuesta del descarte nombra datos de la persona');
  assert.doesNotMatch(huella, personales, 'la huella guarda datos de la persona que reservó');
});

test('la huella vive en el workspace de la PLATAFORMA, y anotar no puede romper el webhook', () => {
  const huella = sinComentarios(bloque(ROUTE, 'async function anotarReservaSinRuteo(', '\n}'));
  // `OWNER_WS` vale 1 y el 1 es Mauricio, un CLIENTE: acá no se sabe de quién es el
  // evento, así que anotarlo en el workspace de alguien sería inventarle un dueño.
  assert.match(huella, /wsSuperAdmin\(\)/, 'la huella dejó de ir al workspace de la plataforma');
  assert.doesNotMatch(huella, /OWNER_WS/, 'OWNER_WS es un cliente: una reserva sin dueño no puede caer en su workspace');
  assert.match(huella, /setSetting\(\s*KEY_SIN_RUTEO/, 'la huella ya no se persiste: queda sólo en los logs');
  // Si anotar tirara, una reserva ignorada se volvería un 500 y Calendly empezaría a
  // reintentar — y eso termina con la suscripción deshabilitada.
  assert.match(huella, /catch \(e\)/, 'anotar el descarte puede tirar y tumbar el webhook');
  assert.match(huella, /TOPE_SIN_RUTEO/, 'la huella creció sin tope: es una huella, no un log');
});

// ── 2. Los textos no mienten ──────────────────────────────────────────────────

/** Lo que el CLIENTE lee de la tab CRM: sólo los valores, nunca los comentarios. */
function textoDeLaTab(campo: 'queFalta' | 'ademas'): string {
  const crm = bloque(TABS, '  crm: {', '\n  },');
  const m = new RegExp(`^\\s*${campo}: '([^']*)',$`, 'm').exec(crm);
  assert.ok(m, `la tab CRM se quedó sin ${campo}`);
  return m[1];
}

test('el aviso de la tab CRM no vuelve a decir que la signing key del cliente no se lee', () => {
  // Medido: app/api/webhooks/calendly/route.ts hace `credWs('CALENDLY_WEBHOOK_SIGNING_
  // KEY', ws)` y sólo cae a la de plataforma cuando ese workspace no tiene la suya. O
  // sea que la propia GANA. El texto viejo afirmaba lo contrario, y de paso le decía
  // que el valor «no lo pones tú».
  for (const campo of ['queFalta', 'ademas'] as const) {
    const t = textoDeLaTab(campo);
    assert.doesNotMatch(t, /no se lee/, `${campo} vuelve a afirmar que la signing key no se lee`);
    assert.doesNotMatch(t, /no la pones t[úu]/, `${campo} vuelve a decirle que no puede cargar su signing key`);
  }
});

test('el aviso de la tab CRM no anuncia como opcional el campo que el formulario exige', () => {
  const ademas = textoDeLaTab('ademas');
  assert.doesNotMatch(ademas, /figuran como opcionales/, 'el tipo de evento de R1 ya no es opcional: el formulario no deja guardar sin él');
  // Y no pide el de R2, que SÍ es opcional de verdad: nombrarlos juntos le pedía un
  // dato que sólo necesita quien agenda la segunda reunión con otro link.
  assert.doesNotMatch(textoDeLaTab('queFalta'), /R2/, 'le vuelve a pedir el tipo de evento de R2, que es opcional');
});

test('el aviso de la tab CRM dice lo único que conectar NO alcanza a dar', () => {
  // Es la razón de existir de `ademas`, y lo que queda cierto después del 04/10: sin el
  // aviso automático de Calendly, una reserva nueva no CREA el contacto. Con el token,
  // MaKo completa las fechas de un lead que ya existe y reserva; no hay cron que
  // ingiera la agenda. Un `ademas` que no dice eso deja a alguien esperando contactos.
  assert.match(textoDeLaTab('ademas'), /aviso autom[áa]tico/, 'el aviso ya no dice que falta el webhook para que una reserva nueva cree el contacto');
});

// ── 3. El tutorial del servicio no se contradice con los campos ───────────────

const BLOQUE_CALENDLY = (() => {
  const i = CATALOGO.indexOf("key: 'calendly',");
  assert.ok(i > 0, 'desapareció el servicio calendly del catálogo');
  const j = CATALOGO.indexOf("\n    key: '", i + 1);
  assert.ok(j > i, 'no encontré dónde empieza el servicio siguiente');
  return CATALOGO.slice(i, j);
})();

/** Los campos del servicio, con su rótulo y si el formulario los deja vacíos. */
function camposCalendly(): Array<{ env: string; label: string; opcional: boolean }> {
  const out = [...BLOQUE_CALENDLY.matchAll(/^ {6}\{ env: '([A-Z0-9_]+)', label: '([^']+)'(.*)$/gm)].map((m) => ({
    env: m[1], label: m[2], opcional: /\bopcional:\s*true/.test(m[3]),
  }));
  assert.ok(out.length >= 4, `esperaba los campos de Calendly y leí ${out.length}: el extractor quedó viejo`);
  return out;
}

/** Los pasos del tutorial del SERVICIO (una línea, un string). */
function pasosCalendly(): string[] {
  const pasos = [...BLOQUE_CALENDLY.matchAll(/^ {8}'((?:[^'\\]|\\.)+)',$/gm)].map((m) => m[1]);
  assert.ok(pasos.length > 10, `esperaba el tutorial de Calendly y leí ${pasos.length} pasos: el extractor quedó viejo`);
  return pasos;
}

test('un paso que dice «opcional» NOMBRA el campo, y ese campo es opcional de verdad', () => {
  // Las dos mitades del texto que mentía. El tutorial decía «Los tres campos que siguen
  // son opcionales» —vago: no nombra ninguno— y «Opcional — "Tipo de evento de R1" y
  // "Tipo de evento de R2"», que anuncia como opcional justo el campo sin el cual el
  // webhook no sabe de quién es la reunión. El `opcional: false` del campo no cubre
  // esto: son dos capas distintas, la bandera y lo que la persona LEE.
  const porLabel = new Map(camposCalendly().map((c) => [c.label, c.opcional]));
  const vagos: string[] = [];
  const mentirosos: string[] = [];
  for (const paso of pasosCalendly()) {
    if (!/opcional/i.test(paso)) continue;
    const nombrados = [...paso.matchAll(/"([^"]{3,40})"/g)].map((m) => m[1]).filter((l) => porLabel.has(l));
    if (!nombrados.length) { vagos.push(paso.slice(0, 90)); continue; }
    for (const l of nombrados) if (!porLabel.get(l)) mentirosos.push(`«${l}» en: ${paso.slice(0, 70)}`);
  }
  assert.deepEqual(mentirosos, [], 'el tutorial anuncia como opcional un campo que el formulario exige');
  assert.deepEqual(vagos, [], 'un paso dice «opcional» sin nombrar de qué campo habla: así se colaba el de R1');
});

test('el tutorial del servicio nombra el campo obligatorio que crea la fila de ruteo', () => {
  // La mitad positiva: el tutorial terminaba en el token diciendo «con eso ya está
  // listo lo obligatorio», y quien lo seguía al pie de la letra quedaba conectado y sin
  // una sola fila de ruteo. El rótulo sale del CATÁLOGO, no escrito a mano: si el campo
  // se renombra, esto sigue preguntando por el campo y no por una cadena vieja.
  const obligatorio = camposCalendly().find((c) => c.env === 'CALENDLY_EVENT_TYPE_J1');
  assert.ok(obligatorio, 'desapareció CALENDLY_EVENT_TYPE_J1 del catálogo');
  assert.equal(obligatorio.opcional, false, 'volvió a ser opcional: lo fija tests/webhook-ruteo-obligatorio.test.ts');
  const lo = pasosCalendly().filter((p) => p.includes(`"${obligatorio.label}"`));
  assert.ok(lo.length > 0, `ningún paso del tutorial nombra «${obligatorio.label}»`);
  assert.ok(lo.some((p) => /obligatorio/i.test(p)), 'el tutorial nombra el campo pero no dice que no se puede dejar vacío');
});

// ── Verificado rompiéndolo (04/10/2026), con los números ──────────────────────
// Un test verde que nunca se vio fallar no prueba nada. Las siete roturas, una por
// corrida, restaurando entre cada una:
//
// · sin romper nada                                                   → 9 pases, 0 fallos
// · quitando la llamada a `anotarReservaSinRuteo` del descarte        → 8 pases, 1 fallo
// · devolviendo el `message` a «Evento ignorado.»                     → 8 pases, 1 fallo
// · metiendo un `nombre:` en la respuesta del descarte                → 8 pases, 1 fallo
// · cambiando `wsSuperAdmin()` por `OWNER_WS` en la huella            → 8 pases, 1 fallo
// · sacándole el tope a la huella (`.slice(0, 99999)`)                → 8 pases, 1 fallo
// · devolviéndole a lib/tab-activacion.ts el aviso viejo              → 6 pases, 3 fallos
// · devolviéndole al tutorial los dos pasos que decían «opcional»     → 7 pases, 2 fallos
//
// ⚠️ LAS DOS ÚLTIMAS SON LAS QUE VALE LA PENA MIRAR, porque caen de a tres y de a dos:
// el aviso viejo decía tres cosas distintas y cada una tiene su capa (que la signing
// key del cliente sí se lee, que el campo de R1 ya no es opcional, y que lo que falta
// después de conectar es el webhook). Juntarlas en un assert habría dicho que algo se
// rompió y no cuál, que es lo único que ahorra tiempo.
//
// ⚠️ Y LA PRIMERA VERSIÓN DE ESTE ARCHIVO SE EQUIVOCÓ MIDIENDO, no en el código: el
// script de roturas reemplazaba una línea por la CADENA VACÍA, así que al restaurar
// buscaba '' y encontraba 27.259 coincidencias — dejó el route roto y las tres roturas
// siguientes midieron un fallo de más. Ante un resultado raro sobre algo recién
// escrito, la primera hipótesis es la medición.
