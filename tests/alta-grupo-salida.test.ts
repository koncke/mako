// CUANDO WHATSAPP NO DEJA QUE MaKo SUME A ALGUIEN AL GRUPO: QUÉ SE OFRECE (19/11/2026, Sellers).
//
// Joan (la agencia de Sellers) guardó un segundo teléfono en Notificaciones a las 20:19 UTC. El alta llegó a WhatsApp (el tope de la
// línea se reclamó a las 20:19:28) y no entró: su WhatsApp sólo deja que lo agreguen sus contactos (el 403), y la pantalla daba una
// sola salida, «pásale tú el link». Martín hizo admin del grupo a Joan y Joan lo sumó desde su teléfono a las 20:50, porque Joan SÍ es
// contacto de esa persona. Esa es la salida que faltaba: el número principal del negocio lo suma desde su WhatsApp, y si no es admin,
// MaKo lo hace admin con un clic. Y si MaKo misma no es admin del grupo, se dice eso en vez de prometer un link que no puede sacar.
// docs/hallazgos-comunicacion.md.
//
// PROBADO ROMPIÉNDOLO (19/11/2026), cada rotura por separado y vuelta atrás:
//   A1 `salidaSinAlta` ofrece la salida también con un 404               → falla «sólo con el 403»
//   A2 `salidaSinAlta` ofrece que se sume a sí mismo                     → falla «sólo con el 403»
//   A3 `makoEsAdminDe` da «no es admin» cuando no encuentra a MaKo       → falla «MaKo admin: sí, no y no sé»
//   A4 `sumarAlGrupo` sin la lectura del grupo antes del alta            → falla «el alta lee el grupo antes»
//   A5 `hacerAdminParaSumar` acepta cualquier número                      → falla «hacer admin: sólo el principal»
//   A6 la ruta sin exigir el `ws` de la pantalla                          → falla «la ruta y las pantallas»
//   A7 la pantalla de escritorio sin el botón                             → falla «la ruta y las pantallas»
//   A8 el 400 entero vuelve a decir «Evolution 400» (sin leer el cuerpo)   → falla «el 400 de Joan»
//   A9 el 400 entero sin la salida a mano                                  → falla «el 400 de Joan»
//
// ⚠️ CORREGIDO EL MISMO DÍA: el cartel de Joan decía «No se pudo hablar con WhatsApp (Evolution 400)». No fue el 403 de privacidad
// adentro de un 200: WhatsApp rechazó el pedido ENTERO, y el texto se tiraba. Ahora se guarda (`mako.grupo.alta.rechazo` y el log) y
// el cartel dice la causa en palabras y las salidas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { salidaSinAlta, textoDeSalida, makoEsAdminDe, causaDelRechazo, MAKO_NO_ES_ADMIN, type ParticipanteCrudo } from '../lib/participantes-grupo';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

// El grupo de Sellers como lo devolvió `findGroupInfos` el 19/11 a las 20:5x UTC, con los números cambiados (mismo largo y forma).
const VOZ = '5491100002605';
const PRINCIPAL = '5492200000684';
const NUEVO = '5492900006633';
const GRUPO_AHORA: ParticipanteCrudo[] = [
  { id: '178984239251523@lid', phoneNumber: `${NUEVO}@s.whatsapp.net`, admin: null },
  { id: '23090364952705@lid', phoneNumber: `${PRINCIPAL}@s.whatsapp.net`, admin: 'admin' },
  { id: '190885979492389@lid', phoneNumber: `${VOZ}@s.whatsapp.net`, admin: 'superadmin' },
];
// A las 20:19, antes de que Martín lo hiciera admin y de que Joan lo sumara.
const GRUPO_ANTES: ParticipanteCrudo[] = [
  { id: '23090364952705@lid', phoneNumber: `${PRINCIPAL}@s.whatsapp.net`, admin: null },
  { id: '190885979492389@lid', phoneNumber: `${VOZ}@s.whatsapp.net`, admin: 'superadmin' },
];

function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre: ${hasta}`);
  return src.slice(i, j);
}

test('la escena de Sellers: a las 20:19 se ofrecía hacer admin a Joan; ahora, que lo sume él', () => {
  const quien = (g: ParticipanteCrudo[]) => {
    const p = g.find((x) => String(x.phoneNumber).startsWith(PRINCIPAL));
    return { numero: PRINCIPAL, esta: !!p, esAdmin: p?.admin === 'admin' || p?.admin === 'superadmin' };
  };
  assert.deepEqual(salidaSinAlta('403', `${NUEVO}@s.whatsapp.net`, quien(GRUPO_ANTES)), { hacerAdmin: PRINCIPAL },
    'a las 20:19 el principal estaba sin ser admin: la salida era hacerlo admin');
  assert.deepEqual(salidaSinAlta('403', NUEVO, quien(GRUPO_AHORA)), { yaPuedeSumar: PRINCIPAL });
  assert.equal(makoEsAdminDe(GRUPO_ANTES, VOZ), true, 'MaKo (la voz) es superadmin del grupo de Sellers: no era eso');
});

test('sólo con el 403, nunca a sí mismo ni a alguien que no está', () => {
  const admin = { numero: PRINCIPAL, esta: true, esAdmin: true };
  for (const st of ['404', '401', '408', '200', '409', undefined]) assert.deepEqual(salidaSinAlta(st, NUEVO, admin), {}, `status ${st}`);
  assert.deepEqual(salidaSinAlta('403', NUEVO, null), {});
  assert.deepEqual(salidaSinAlta('403', NUEVO, { ...admin, esta: false }), {}, 'el principal no está en el grupo: no puede sumar ni ser admin');
  assert.deepEqual(salidaSinAlta('403', `${PRINCIPAL}@s.whatsapp.net`, admin), {}, 'no se le ofrece que se sume a sí mismo');
  assert.deepEqual(salidaSinAlta('403', NUEVO, { ...admin, numero: '' }), {});
});

test('la frase de la salida, para el chat de MaKo y la lista de quién no entró', () => {
  const leer = (t: string) => `…${t.slice(-4)}`;
  assert.equal(textoDeSalida({ yaPuedeSumar: PRINCIPAL }, leer), 'O que lo sume …0684 desde su WhatsApp: es admin del grupo.');
  assert.match(textoDeSalida({ hacerAdmin: PRINCIPAL }, leer), /…0684 desde su WhatsApp: MaKo puede hacerlo admin/);
  assert.equal(textoDeSalida({}), '');
});

test('MaKo admin: sí, no y no sé', () => {
  assert.equal(makoEsAdminDe(GRUPO_AHORA, VOZ), true);
  assert.equal(makoEsAdminDe([{ phoneNumber: `${VOZ}@s.whatsapp.net`, admin: null }], VOZ), false);
  assert.equal(makoEsAdminDe([{ id: '190885979492389@lid', admin: 'superadmin' }], VOZ), null,
    'MaKo sólo como @lid: no se sabe, y no se frena un alta por eso');
  assert.equal(makoEsAdminDe(GRUPO_AHORA, null), null);
  assert.match(MAKO_NO_ES_ADMIN, /no es admin de este grupo/);
});

test('el alta lee el grupo antes, frena sólo si MaKo NO es admin, y suma la salida al motivo', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const alta = bloque(src, 'async function sumarAlGrupo(', '// ── El equipo de la agencia');
  const lectura = alta.indexOf('await grupoParaAlta(jid)');
  assert.ok(lectura >= 0 && lectura < alta.indexOf('/group/updateParticipant/'), 'el grupo se lee ANTES de pedir el alta');
  assert.match(alta, /if \(grupo\?\.makoEsAdmin === false\) return \{ ok: false, error: MAKO_NO_ES_ADMIN, link: null \};/);
  assert.match(alta, /salidaSinAlta\(res\.status, destino, grupo \? await quienSumaEn\(ws, grupo\.participantes\) : null\)/);
  assert.match(alta, /error: otra \? `\$\{base\} \$\{otra\}` : base/);
  assert.match(alta, /salida,/, 'la salida viaja en el resultado (la pantalla dibuja el botón)');
});

test('hacer admin: sólo el principal, con MaKo admin, y el veredicto sale de releer el grupo', () => {
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const h = bloque(src, 'export async function hacerAdminParaSumar(', '\n}\n');
  assert.match(h, /if \(!principal \|\| soloDigitos\(numero\) !== principal\) return \{ ok: false/);
  assert.match(h, /if \(g\.makoEsAdmin === false\) return \{ ok: false, error: MAKO_NO_ES_ADMIN \};/);
  assert.match(h, /if \(!antes\.esta\) return \{ ok: false/);
  assert.match(h, /action: 'promote', participants: \[jidCanonico\(principal\)\]/);
  assert.match(h, /esAdminEn\(d\.participantes, principal\)\.admin\) return \{ ok: true \}/, 'releer el grupo, no creerle al pedido');
  assert.match(h, /altasEnGrupos\(\)/, 'el freno de emergencia de los grupos también frena esto');
});

test('la ruta y las pantallas: la acción exige el negocio de la pantalla, y las dos pantallas la ofrecen', () => {
  const ruta = fuenteSinComentarios('app/api/perfil/destinatarios/route.ts');
  const post = bloque(ruta, 'export async function POST(', 'const wsRow = await getWorkspace(ws);');
  assert.ok(post.indexOf('soloAdmin()') < post.indexOf("body.accion === 'hacer-admin'"), 'sólo el admin del negocio (o su agencia)');
  assert.match(post, /if \(body\.accion === 'hacer-admin'\) \{\s*if \(typeof body\.ws !== 'number'\) return/);
  assert.match(post, /hacerAdminParaSumar\(ws, String\(body\.telefono \?\? ''\)\)/);
  const dest = fuenteSinComentarios('lib/notif-destinatarios.ts');
  assert.match(dest, /salidaGrupo = r\.salida;/);
  assert.match(dest, /salidaGrupo,\s*\};/);
  const pc = fuenteSinComentarios('app/perfil/DestinatariosCanal.tsx');
  assert.match(pc, /setSalida\(\(j\.salidaGrupo/);
  assert.match(pc, /accion: 'hacer-admin', telefono/);
  assert.match(pc, /\{salida\?\.hacerAdmin && \(/);
  assert.match(pc, /\{salida\?\.yaPuedeSumar && \(/);
  const cel = fuenteSinComentarios('app/m/configuraciones/notificaciones/NotificacionesNegocioM.tsx');
  assert.match(cel, /salida: j\.salidaGrupo \?\? null/);
  assert.match(cel, /accion: 'hacer-admin', telefono: tel/);
});

test('el 400 de Joan: la causa en palabras, nunca «Evolution», y la salida a mano', () => {
  const cuerpo = (msg: string) => ({ status: 400, error: 'Bad Request', response: { message: ['Error updating participants', msg] } });
  for (const [msg, tipo] of [
    ['Error: rate-overlimit', 'tope'], ['Error: not-authorized', 'no-admin'], ['Error: Timed Out', 'tiempo'],
    ['Error: Connection Closed', 'sin-conexion'], ['Error: item-not-found', 'no-encontrado'], ['Error: bad-request', 'otro'],
  ] as const) {
    const c = causaDelRechazo(400, cuerpo(msg));
    assert.equal(c.tipo, tipo, msg);
    assert.doesNotMatch(c.motivo, /evolution|400/i, 'el cartel no nombra a Evolution ni el código');
  }
  assert.equal(causaDelRechazo(400, cuerpo('Error: not-authorized')).ofreceSalida, false, 'si MaKo no es admin, lo dice el motivo');
  assert.equal(causaDelRechazo(400, 'texto suelto').tipo, 'otro');
  assert.deepEqual(salidaSinAlta('rechazo', NUEVO, { numero: PRINCIPAL, esta: true, esAdmin: false }), { hacerAdmin: PRINCIPAL });
  const src = fuenteSinComentarios('lib/mako-grupo.ts');
  const alta = bloque(src, 'async function sumarAlGrupo(', '// ── El equipo de la agencia');
  const rechazo = bloque(alta, 'if (!r.ok) {', 'const res = leerResultadoParticipante(r.body);');
  assert.doesNotMatch(rechazo, /Evolution ${r.status}/, 'volvió «Evolution 400» a secas');
  assert.match(rechazo, /setSetting(KEY_RECHAZO_ALTA, /, 'lo que contestó WhatsApp queda guardado');
  assert.match(rechazo, /causaDelRechazo(r.status, r.body)/);
  assert.match(rechazo, /salidaSinAlta('rechazo', destino,/);
  assert.match(rechazo, /link, salida, error:/);
});
