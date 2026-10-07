// =============================================================================
// Cambiar el número de MaKo sin dejarla muda, y sin hablar con el número de un cliente
// =============================================================================
// Pedido de Martín (07/10/2026): «Tengo un nuevo número que va a ser el número de MaKo …
// Quiero que los grupos de WhatsApp actuales y futuros sean con el nuevo número de MaKo».
//
// Lo que había hasta ese día, medido en el código:
//   · «Desconectar» la línea de MaKo devolvía la voz a `mako_ws1` — la línea de Mauricio, un
//     CLIENTE. MaKo pasaba a hablarles a todos los grupos desde el WhatsApp de un cliente.
//   · Sumar un número a un grupo contaba como hecho todo lo que Evolution contestara
//     (`{ ok: r != null }`), y Evolution contesta HTTP 200 con el fallo adentro.
//   · El número nuevo entraba a los grupos sin admin, así que después no podía sumar a nadie.
//
// Probado rompiéndolo (07/10/2026), una rotura por vez y restaurando desde memoria: el 403
// contado como éxito, el teléfono fuera del id, desconectar cayendo a mako_ws1, la acción sin
// leer el status, la mudanza sin promote, los grupos leídos tolerantes, mudarse con grupos
// fallados, la voz mudada antes que los grupos, tu número en el workspace de la pestaña y el
// webhook escuchando la línea nueva. Las DIEZ dieron 7 pasan / 1 falla. Restaurado: 8 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerResultados, leerResultadoParticipante, esAdminEn } from '../lib/participantes-grupo';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md): todo guard de «esto
// NO está» se acusaría a sí mismo con los comentarios que explican por qué se fue.
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
/** El cuerpo de una función: desde su firma hasta la próxima declaración de primer nivel. */
const bloque = (src: string, firma: string) => {
  const ini = src.indexOf(firma);
  assert.ok(ini >= 0, `no encontré ${firma}`);
  const resto = src.slice(ini + firma.length);
  const fin = resto.search(/\n(export |async function |function |const |type )/);
  return src.slice(ini, ini + firma.length + (fin < 0 ? resto.length : fin));
};

// ── El resultado POR participante ────────────────────────────────────────────

test('un 403 adentro del 200 es un fallo, con su motivo en castellano', () => {
  // La forma medida el 21/8/2026 contra Evolution.
  const body = { updateParticipants: [{ status: '403', jid: '5215512345678@s.whatsapp.net', content: {} }] };
  const [r] = leerResultados(body, ['5215512345678']);
  assert.equal(r.ok, false);
  assert.match(r.error ?? '', /restringido quién puede sumarlo/);
  assert.equal(leerResultadoParticipante(body).ok, false);
});

test('200 y 409 son éxito; el número que no vino en la respuesta queda sin saber', () => {
  const body = { updateParticipants: [
    { status: '200', jid: '5215512345678@s.whatsapp.net' },
    { status: '409', jid: '5491122334455:12@s.whatsapp.net' },   // con sufijo de dispositivo
  ] };
  const r = leerResultados(body, ['5215512345678', '5491122334455', '5210000000000']);
  assert.deepEqual(r.map((x) => x.ok), [true, true, null]);
  // Sin lista no se afirma un fallo: Evolution contestó 200 (es el contrato del alta del dueño).
  assert.equal(leerResultadoParticipante({}).ok, true);
});

test('«es admin» se lee del grupo, también con el teléfono fuera del id', () => {
  const parts = [
    { id: '5215512345678@s.whatsapp.net', admin: 'admin' },
    { id: '5491122334455@s.whatsapp.net', admin: null },
    { id: '1234567890@lid', phoneNumber: '5213300000000@s.whatsapp.net', admin: 'superadmin' },
  ];
  assert.deepEqual(esAdminEn(parts, '5215512345678'), { esta: true, admin: true });
  assert.deepEqual(esAdminEn(parts, '5491122334455'), { esta: true, admin: false });
  assert.deepEqual(esAdminEn(parts, '5213300000000'), { esta: true, admin: true });
  assert.deepEqual(esAdminEn(parts, '5219999999999'), { esta: false, admin: false });
  assert.deepEqual(esAdminEn(parts, ''), { esta: false, admin: false });
});

// ── Las guardas del cableado ─────────────────────────────────────────────────

test('la línea de MaKo nunca cae a la de un cliente', () => {
  const canal = sinComentarios(leer('../lib/mako-canal.ts'));
  assert.ok(!/INSTANCIA_VOZ_DEFAULT|mako_ws1/.test(canal),
    'lib/mako-canal.ts volvió a nombrar la línea por default (mako_ws1, un cliente): desconectar a MaKo la hacía hablar con el WhatsApp de Mauricio');
});

test('sumar a un grupo LEE el resultado de cada participante', () => {
  const chat = sinComentarios(leer('../lib/mako-chat.ts'));
  const acc = bloque(chat, 'async function accionParticipantes(');
  assert.match(acc, /leerResultados\(r, nums\)/,
    'accionParticipantes dejó de leer el status de cada participante: vuelve el «Número agregado ✓» sobre un número que no entró');
  assert.ok(!/ok:\s*r\s*!=\s*null/.test(acc), 'accionParticipantes volvió a contar «Evolution contestó» como éxito');
  // Y la mudanza decide con lo que QUEDÓ en el grupo, no con lo que contestó el pedido.
  const sumar = bloque(chat, 'export async function sumarComoAdmin(');
  assert.match(sumar, /'promote'/, 'el número nuevo entra sin admin: después no puede sumar a nadie');
  assert.match(sumar, /esAdminEn\(despues\.participantes, numero\)/, 'la mudanza no relee el grupo para comprobar que quedó admin');
  // Y lee los grupos ESTRICTO: «no pude leerlos» no puede valer «no hay ninguno».
  const todos = bloque(chat, 'export async function sumarATodosLosGrupos(');
  assert.match(todos, /gruposDeMaKoEstricto\(\)/, 'la mudanza lee los grupos con la lectura que traga el error');
});

test('MaKo se muda DESPUÉS de quedar admin, y no sola si algún grupo falló', () => {
  const canal = sinComentarios(leer('../lib/mako-canal.ts'));
  const pasar = bloque(canal, 'export async function pasarMaKoANumeroNuevo(');
  const iSumar = pasar.indexOf('sumarATodosLosGrupos(numero');
  const iCanal = pasar.indexOf('cambiarSettingSi(KEY_CANAL_INSTANCIA');
  const iVoz = pasar.indexOf('setInstanciaVoz(nueva)');
  assert.ok(iSumar > 0 && iCanal > iSumar && iVoz > iCanal,
    'la voz se muda antes de dejar al número nuevo admin en los grupos: MaKo queda muda donde no entró');
  assert.match(pasar, /r\.ok < r\.grupos && !opts\.forzar/,
    'con un grupo fallado la mudanza sigue sola: quien aprieta no ve dónde MaKo deja de hablar');
  assert.match(pasar, /r\.grupos === 0 && !opts\.forzar/,
    'cero grupos se lee como «listo»: es una lectura que no vio nada');
});

test('tu número va a TU negocio, nunca al de la pestaña', () => {
  const canal = sinComentarios(leer('../lib/mako-canal.ts'));
  for (const firma of ['export async function estadoNumeroPersonal(', 'export async function vincularNumeroPersonal(']) {
    assert.match(bloque(canal, firma), /runWithWorkspace\(await wsSuperAdmin\(\)/,
      `${firma} corre con el workspace de la pestaña: tu número personal podía quedar en el negocio de un cliente`);
  }
});

test('la línea nueva no escucha hasta que es la de MaKo', () => {
  // El webhook sólo reconoce las líneas VIGENTES (canal y voz). Si sumara la pendiente, sus
  // mensajes de grupo llegarían dos veces al doer mientras se vincula.
  const hook = sinComentarios(leer('../app/api/webhooks/evolution/route.ts'));
  const ws = bloque(hook, 'async function wsDeInstancia(');
  assert.match(ws, /Promise\.all\(\[instanciaCanal\(\), instanciaVoz\(\{ estricto: true \}\)\]\)/);
  assert.ok(!/pendiente/i.test(ws), 'el webhook escucha la línea nueva antes de que sea la de MaKo');
});
