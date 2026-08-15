// =============================================================================
// El webhook de Chatwoot: de qué canal viene, y qué link lleva el aviso
// =============================================================================
// Dos cosas que hasta ahora nadie miraba.
//
// 1) El CANAL. El webhook de Chatwoot es uno para toda la cuenta. Sin filtro, un
//    DM de Instagram o un mail entrante disparan `wa-mensaje-entrante` —el aviso
//    es incondicional— y le llegan al dueño rotulados como WhatsApp, sin teléfono.
//
// 2) El LINK del aviso. Ningún test del repo miraba el TEXTO de un aviso, y el
//    link a la conversación de Chatwoot se arma a mano en un template literal:
//    una ruta escrita a mano es código sin tipo y sin test. Acá se EVALÚA la
//    expresión tal como está en el archivo y se compara la URL resultante, así
//    que cualquier barra que se dé vuelta —o una interpolación que se cancele—
//    falla acá y no en el WhatsApp del dueño.
//
//    ⚠️ La fuente se lee con `readFileSync` a propósito. Es el único canal que
//    devuelve el archivo TAL CUAL: la herramienta de búsqueda del agente
//    reescribe `/` como `\` en las líneas que devuelve, y esa transcripción
//    mangleada ya se reportó una vez como un bug vivo de producción que nunca
//    existió (ver docs/hallazgos-comunicacion.md).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esCanalWhatsapp, esCanalInstagram, CANALES_WHATSAPP } from '../lib/chatwoot-canales';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

/** Saca comentarios, para poder afirmar sobre el CÓDIGO y no sobre la prosa. */
const sinComentarios = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const RUTA = '../app/api/webhooks/chatwoot/route.ts';

test('el link del aviso resuelve a la conversación real de Chatwoot', () => {
  const src = leer(RUTA);

  const m = src.match(/^\s*const link = (.+);\s*$/m);
  assert.ok(m, 'no se encontró la línea que arma el link — ¿se renombró la variable?');

  // Se evalúa la expresión REAL del archivo, con los valores que tendría en vivo.
  const armar = new Function('convId', 'base', 'acc', `return ${m![1]};`) as (
    convId: number | null,
    base: string,
    acc: string,
  ) => string;

  assert.equal(
    armar(1842, 'https://mauricio.up.railway.app', '3'),
    'https://mauricio.up.railway.app/app/accounts/3/conversations/1842',
    'el link dejó de resolver a la conversación: revisá las barras y las interpolaciones',
  );

  // Y tiene que ser una URL de verdad, no un string que se le parece.
  const url = new URL(armar(1842, 'https://mauricio.up.railway.app', '3'));
  assert.equal(url.pathname, '/app/accounts/3/conversations/1842');

  // Sin base no hay link a medias: el guard se cae al camino sin link.
  assert.equal(armar(1842, '', '3'), '', 'sin CHATWOOT_BASE_URL el link tiene que quedar VACÍO');
  assert.equal(armar(null, 'https://x.test', '3'), '', 'sin conversación el link tiene que quedar VACÍO');
});

test('el aviso solo pega el link cuando el link existe', () => {
  const src = leer(RUTA);
  const i = src.indexOf("emitirDelCatalogo('wa-mensaje-entrante'");
  assert.ok(i > 0, 'el aviso de mensaje entrante sigue existiendo');

  const bloque = src.slice(i, i + 400);
  assert.ok(
    /\$\{link \?/.test(bloque),
    'el texto del aviso dejó de guardar el link detrás de su guard: puede salir un renglón vacío o un link roto',
  );
});

test('CABLEADO: el webhook filtra por canal, y filtra en POSITIVO', () => {
  const src = leer(RUTA);

  assert.ok(
    src.includes('esCanalWhatsapp'),
    'se cayó el filtro de canal: un DM de Instagram vuelve a salir rotulado como WhatsApp',
  );
  assert.ok(
    /body\.conversation\?\.channel/.test(src),
    'el canal se lee de conversation.channel — el objeto `inbox` del payload trae solo {id, name}',
  );

  // El filtro va ANTES de tocar datos del lead: si queda después, la nutrición se
  // pausa y el pipeline_stage se reescribe con un mensaje que no era de WhatsApp.
  const iFiltro = src.indexOf('esCanalWhatsapp(canal)');
  const iPausa = src.indexOf('pausarPorRespuesta(');
  assert.ok(iFiltro > 0 && iPausa > 0 && iFiltro < iPausa, 'el filtro de canal quedó DESPUÉS de tocar el lead');

  // En positivo: la lista de lo que NO es WhatsApp se queda vieja sola. Se mide
  // sobre el código, no sobre los comentarios (que sí nombran los otros canales).
  assert.ok(
    !/esCanalInstagram|Channel::Instagram|Channel::Email|Channel::WebWidget/.test(sinComentarios(src)),
    'el filtro se volvió una lista de exclusiones: cada canal nuevo de Chatwoot pasa por el hueco',
  );
});

test('esCanalWhatsapp acepta el canal oficial y NADA más', () => {
  assert.ok(esCanalWhatsapp('Channel::Whatsapp'));

  // El error que estaba vivo en metodo-verificar: comparar en minúsculas contra
  // el nombre de la clase Ruby, que va con W mayúscula.
  assert.ok(!esCanalWhatsapp('whatsapp'), 'la comparación no es por substring en minúsculas');

  for (const otro of ['Channel::Instagram', 'Channel::FacebookPage', 'Channel::Email', 'Channel::WebWidget', 'Channel::Api', 'Channel::Telegram']) {
    assert.ok(!esCanalWhatsapp(otro), `${otro} no es WhatsApp`);
  }
  assert.ok(!esCanalWhatsapp(null) && !esCanalWhatsapp(undefined) && !esCanalWhatsapp(''));
});

test('esCanalInstagram acepta los DOS valores, incluido el inbox legacy', () => {
  // Los inboxes de «Instagram via Facebook Login» emiten Channel::FacebookPage, y
  // el `instagram_id` que los desambigua NO viaja en el webhook. Matchear solo
  // Channel::Instagram pierde los DMs de todo inbox legacy.
  assert.ok(esCanalInstagram('Channel::Instagram'));
  assert.ok(esCanalInstagram('Channel::FacebookPage'), 'se perdió el inbox legacy de Instagram');

  assert.ok(!esCanalInstagram('Channel::Whatsapp'));
  assert.ok(!esCanalInstagram(null));

  // Los dos conjuntos no se pisan: si un canal cae en los dos, el ruteo es ambiguo.
  for (const c of CANALES_WHATSAPP) assert.ok(!esCanalInstagram(c), `${c} está en las dos listas`);
});
