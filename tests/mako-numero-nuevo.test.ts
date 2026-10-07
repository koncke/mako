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
// Y la segunda tanda (07/10/2026, tarde), después de la primera mudanza real, que dijo «0 de 6»:
// sin la forma que deja Evolution, sin la fila única, la acción con números crudos, el alta de la
// mudanza sin jid, el dueño con número crudo, el corte con la voz muerta y sin leer el grupo con
// la línea nueva. Las SIETE dieron 10 / 1 (la primera, 11 / 0 hasta que se agregó el caso de dos
// números: con uno solo la fila única la tapaba). Restaurado: 11 / 0.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerResultados, leerResultadoParticipante, esAdminEn, jidCanonico } from '../lib/participantes-grupo';

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

test('el 403 se encuentra aunque Evolution le haya borrado el 9 al número', () => {
  // Medido el 07/10/2026 sumando la línea nueva de MaKo (549…2605) al grupo SuperAdmin: Evolution
  // 2.3.7 la mandó como 541…2605 y contestó así. Con la búsqueda exacta este 403 quedaba «no se
  // sabe», la acción lo contaba como éxito y la mudanza dijo «no quedó adentro» en los 6 grupos.
  const ar = { updateParticipants: [{ status: '403', jid: '541125052605@s.whatsapp.net', content: { attrs: { addressable: 'false' } } }] };
  const [r] = leerResultados(ar, ['5491125052605']);
  assert.equal(r.ok, false, 'el 403 sobre el número sin el 9 volvió a quedar «sin saber»');
  // Y lo mismo con el 1 de México, que es la otra mitad de la regla de Evolution.
  const mx = { updateParticipants: [{ status: '403', jid: '525512345678@s.whatsapp.net' }] };
  assert.equal(leerResultados(mx, ['5215512345678'])[0].ok, false);
  // Con DOS números la fila única no aplica: cada una se tiene que encontrar por su forma.
  const dos = { updateParticipants: [
    { status: '200', jid: '525512345678@s.whatsapp.net' },
    { status: '403', jid: '541125052605@s.whatsapp.net' },
  ] };
  assert.deepEqual(leerResultados(dos, ['5491125052605', '5215512345678']).map((x) => x.ok), [false, true],
    'con dos números, el que Evolution reescribió no se encuentra');
  // Con UN número y UNA fila, la fila es la suya aunque venga con otra cara.
  const lid = { updateParticipants: [{ status: '200', jid: '104850000004969@lid' }] };
  assert.equal(leerResultados(lid, ['5491125052605'])[0].ok, true);
});

test('el número que dio WhatsApp viaja como jid completo, que Evolution no toca', () => {
  assert.equal(jidCanonico('+54 9 11 2505-2605'), '5491125052605@s.whatsapp.net');
  const chat = sinComentarios(leer('../lib/mako-chat.ts'));
  assert.match(bloque(chat, 'async function accionParticipantes('), /opts\.canonicos \? nums\.map\(jidCanonico\) : nums/,
    'la acción volvió a mandar los números crudos: Evolution le borra el 9 a uno argentino');
  const sumar = bloque(chat, 'export async function sumarComoAdmin(');
  assert.match(sumar, /'add', desde, \{ canonicos: true \}/, 'la mudanza suma el número nuevo sin el jid completo');
  assert.match(sumar, /'promote', desde, \{ canonicos: true \}/, 'la mudanza promueve el número nuevo sin el jid completo');
  // Y el alta del dueño de un cliente, que pasa por el mismo filtro de Evolution.
  const grupo = sinComentarios(leer('../lib/mako-grupo.ts'));
  assert.match(grupo, /const destino = chequeo\.canonico \? jidCanonico\(chequeo\.canonico\) : num;/);
  assert.match(grupo, /participants: \[destino\]/, 'el alta del dueño volvió a mandar el número crudo');
  assert.match(grupo, /enviarInvitacionGrupo\(ws, destino\)/, 'la invitación del dueño volvió a mandar el número crudo');
});

test('con la línea vieja muerta, la mudanza COMPRUEBA con la nueva en vez de cortar', () => {
  const canal = sinComentarios(leer('../lib/mako-canal.ts'));
  const pasar = bloque(canal, 'export async function pasarMaKoANumeroNuevo(');
  assert.match(pasar, /sumarATodosLosGrupos\(numero, \{ desde: vozViva \? voz : null, nueva \}\)/,
    'con la voz muerta la mudanza no mira los grupos: no hay forma de saber cuáles ya sumaste a mano');
  assert.ok(!/if \(!vozViva && !opts\.forzar\)/.test(pasar), 'volvió el corte que no dejaba hacer nada con la voz muerta');
  const sumar = bloque(sinComentarios(leer('../lib/mako-chat.ts')), 'export async function sumarComoAdmin(');
  assert.match(sumar, /await grupoDesde\(jid, nueva\)/, 'sin la línea vieja, el grupo ya no se lee con la nueva');
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
