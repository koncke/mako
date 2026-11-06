// =============================================================================
// Chats más simple, con el chat de MaKo de molde (24/10/2026) — docs/diseno-chats.md §8
// =============================================================================
// Martín, por el Cerebro, cinco pedidos que son una sola pregunta (cómo se ve y se usa Chats):
//   1. «En SuperAdmin no deben haber 3 tabs allí... que simplemente pueda cambiar entre mi número y el de MaKo y ver entre
//      los chats los grupos»;
//   2. «Cuando quiero conectar un WhatsApp, mira que salta el diseño de la tab vieja... solo debería saltar el QR»;
//   3. «Faltan los Email aquí, para conectarlo»;
//   4. «Mira como se ve toda la tab vieja de WhatsApp por detrás... Y también el modal que salta con mucho texto»;
//   5. «simplifiques la interfaz de chats... muchos botones... me gustaría que se parezca más al chat de MaKo».
// Lo que esto fija es la DECISIÓN de cada uno, no el dibujo: que no vuelva la columna de la Bandeja, la cabecera de siete
// controles, el «Agregar al CRM» repetido, la tab vieja detrás de un modal, la pregunta de sincronizar repetida, lo que
// borra mezclado con lo de todos los días, ni la barra de tres tabs del super admin.
//
// Probado rompiéndolo (24/10/2026, con la base en 0 fallos):
//   · PanelContacto con su rail otra vez (sin el `if (!abierto) return null`)   → 1 fallo (1);
//   · el botón «Agregar al CRM» de vuelta en el panel del contacto              → 1 fallo (3);
//   · la cabecera con el split de etapa (`rio-split-b`)                         → 1 fallo (2);
//   · «Conectar un canal» sin Email                                              → 1 fallo (4);
//   · «Borrar el historial» como botón del cuerpo y no del pie                    → 1 fallo (5);
//   · «MaKo WhatsApp» otra vez en las secciones de Chats                         → 1 fallo (7);
//   · el grupo de un número del negocio escribible (sin `!grupo`)                → 1 fallo (8).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { FAMILIAS } from '../app/_components/nav';
import { LINEA_CANAL_MAKO, parsearClave } from '../lib/chats-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El fuente sin comentarios: un comentario que nombra el patrón no puede hacer pasar el test. */
const sinComentarios = (src: string) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const fuente = (rel: string) => sinComentarios(leer(rel));

test('1. dos columnas: la Bandeja son chips arriba de la lista, y el contacto arranca cerrado y sin rail', () => {
  assert.ok(!existsSync(join(RAIZ, 'app/chats/PanelBandejas.tsx')), 'volvió la columna de la Bandeja');
  const app = fuente('app/chats/ChatsApp.tsx');
  assert.doesNotMatch(app, /<PanelBandejas\b|bandejaAbierta/, 'ChatsApp volvió a montar la Bandeja');
  // Los filtros van ADENTRO de la lista (su cabecera), no como otra columna.
  assert.match(app, /filtros=\{\(\s*<FiltrosChats\b/, 'los filtros no van en la cabecera de la lista');
  const filtros = fuente('app/chats/FiltrosChats.tsx');
  // Cuatro desde el 27/10/2026: «Funnel» entre Canales y Etapa, y sólo con dos o más funnels (Mauricio: el Sprint).
  assert.equal((filtros.match(/<Dropdown\b/g) ?? []).length, 4, 'son los chips Todos, Canales, Funnel y Etapa');
  assert.match(filtros, /\{funnels\.length > 1 && \(\s*<Dropdown/, 'el chip «Funnel» aparece con un solo funnel');
  // El contacto: cerrado salvo que la persona lo haya dejado abierto (clave nueva: la vieja lo abría solo).
  assert.match(app, /setDrawerAbierto\(leerLocal\(st, ws, 'contacto'\) === '1'\)/, 'el contacto no arranca cerrado');
  assert.doesNotMatch(app, /ANCHO_DRAWER|'drawer'/, 'volvió a abrirse solo en pantallas anchas');
  const panel = fuente('app/chats/PanelContacto.tsx');
  // Cerrado (o sin chat elegido: recorrido visual del 30/10/2026, CH2, tests/recorrido-chats.test.ts) no ocupa nada.
  assert.match(panel, /if \(!abierto(?: \|\| !chat)?\) return null;/, 'cerrado, el panel tiene que no ocupar nada');
  assert.doesNotMatch(panel, /rio-rail/, 'volvió el rail de 44 px');
  // Y se abre tocando el nombre (no con un botón más en la cabecera).
  const ventana = fuente('app/chats/VentanaChat.tsx');
  assert.match(ventana, /className="rio-cab-contacto"[^>]*\n?[^>]*aria-expanded=\{drawerAbierto\} onClick=\{onToggleDrawer\}/, 'el nombre no abre el contacto');
  assert.doesNotMatch(ventana, /Ico n="panel"/, 'volvió el botón del panel a la cabecera');
});

test('2. la cabecera del chat: el nombre, la etapa, Cerrar con su flechita (posponer, con nota) y «⋯» (lo del CRM)', () => {
  const v = fuente('app/chats/VentanaChat.tsx');
  const cab = v.slice(v.indexOf('<header className="rio-cab rio-cab-v">'), v.indexOf('</header>'));
  assert.ok(cab.length > 500, 'no encontré la cabecera');
  assert.doesNotMatch(cab, /rio-split-b|rio-asignado\b/, 'volvió el split de etapa o el asignado suelto');
  // Lo que se toca de un vistazo: el estado (Cerrar / Reanudar / Reabrir) y el «⋯».
  assert.match(cab, /onClick=\{\(\) => void cambiarEstado\('cerrar'\)\}/);
  assert.match(cab, /aria-label="Más acciones"/);
  // Asignar, «Agregar al CRM en», posponer y la nota de cierre son vistas, con su ‹ para volver: las dos primeras al «⋯»,
  // posponer a la flechita de «Cerrar» (27/10/2026, Martín: el «⋯» «no debería decir nada de "Cerrar" o posponer»).
  for (const vista of ['asignar', 'agregar', 'posponer', 'cerrar', 'cierre']) {
    assert.match(cab, new RegExp(`\\{menu === '${vista}' && `), `«${vista}» no es una vista`);
  }
  assert.equal((cab.match(/className="rio-menu-volver" onClick=\{\(\) => setMenu\('mas'\)\}/g) ?? []).length, 2, 'Asignar y Agregar sin su ‹ volver');
  assert.match(cab, /className="rio-menu-volver" onClick=\{\(\) => setMenu\('cierre'\)\}/, 'Posponer no vuelve a la flechita de Cerrar');
  const mas = cab.slice(cab.indexOf("{menu === 'mas' && ("), cab.indexOf("{menu === 'asignar' && ("));
  assert.ok(mas.length > 100, 'no encontré el «⋯»');
  assert.doesNotMatch(mas, /setMenu\('posponer'\)|setMenu\('cerrar'\)|Cerrar con nota/, 'el «⋯» volvió a ofrecer cerrar o posponer');
  assert.match(mas, /sePuedeAgregar\(chat\)/, 'el «⋯» no ofrece «Agregar al CRM»');
  // Abajo del nombre, de quién es (el asignado salió de la cabecera).
  assert.match(v, /chat\.asignado \? `Asignada a \$\{chat\.asignado\}` : 'Sin asignar'/);
});

test('3. el BOTÓN «Agregar al CRM» está en UN lugar (la cabecera); los «⋯» lo ofrecen como opción (27/10/2026)', () => {
  const conBoton = readdirSync(join(RAIZ, 'app/chats')).filter((f) => f.endsWith('.tsx'))
    .filter((f) => /<BotonAgregarAlCrm\b/.test(fuente(`app/chats/${f}`)));
  assert.deepEqual(conBoton, ['VentanaChat.tsx'], 'el botón de alta apareció en otra pieza de Chats');
  const v = fuente('app/chats/VentanaChat.tsx');
  assert.equal((v.match(/\{botonAlta\}/g) ?? []).length, 1, 'la ventana dibuja el alta más de una vez');
  // Martín (27/10/2026): en el «⋯» «deberían haber otras opciones, entre esas, la de agregar al CRM». El de la cabecera y el
  // de cada fila de la lista, por el MISMO alta (app/chats/agregar-al-crm.ts).
  assert.match(v, /'Agregar al CRM'\}/, 'el «⋯» de la cabecera no ofrece el alta');
  const lista = fuente('app/chats/ListaChats.tsx');
  assert.match(lista, /label: 'Agregar al CRM'/, 'el «⋯» de la fila no ofrece el alta');
  assert.doesNotMatch(lista, /tipo: 'cerrar'|tipo: 'posponer'|opcionesPosponer/, 'el «⋯» de la fila volvió a cerrar o posponer');
  assert.match(fuente('app/chats/ChatsApp.tsx'), /await agregarChatAlCrm\(c, a\.funnelId\)/, 'la fila no usa el alta compartida');
  // Un grupo no se agrega: sin identidad que dé de alta, no hay botón.
  assert.match(v, /\) : waIdent \|\| socialIdent \? \(\s*<div className="rio-alta-crm">\{botonAlta\}<\/div>\s*\) : null\}/);
  const comp = fuente('app/chats/Composer.tsx');
  assert.doesNotMatch(comp, /agregarAlCrm/, 'el comentario volvió a traer su propio alta');
});

test('4. conectar un canal es UNA pieza, sobre Chats: WhatsApp sólo el QR, Email el remitente del negocio', () => {
  const c = fuente('app/chats/ConectarCanal.tsx');
  for (const canal of ['whatsapp', 'instagram', 'messenger', 'email']) {
    assert.match(c, new RegExp(`\\{ canal: '${canal}', nombre: '`), `«Conectar un canal» no ofrece ${canal}`);
  }
  // El MISMO modal de cada medio que usa Automations (dos modales para lo mismo dejan de decir lo mismo).
  assert.match(c, /import \{ ConectarMedio \} from '@\/app\/automations\/ConectarMedio';/);
  assert.match(c, /<ConectarMedio medio="whatsapp"/);
  assert.match(c, /<ConectarMedio medio="email"/);
  assert.doesNotMatch(c, /router\.push|href="\/(whatsapp|email)"/, 'conectar volvió a llevar a otra tab');
  // El estado vacío y el chip «Canales» usan la pieza; un link `?conectar=` la abre (lo que manda /whatsapp sin número).
  const app = fuente('app/chats/ChatsApp.tsx');
  assert.match(app, /\{esAdmin && <BotonesCanales onElegir=\{conectarUno\} \/>\}/);
  assert.match(app, /const conectarLink = sp\.get\('conectar'\);/);
  // Recién conectado un WhatsApp, la pregunta de sincronizar (una sola vez, en el modal de administrar).
  assert.match(app, /setAdministrar\(\{ linea: nombre, [^}]*recien: true \}\)/);
});

test('5. administrar un número: corto, sincronizar se pregunta una vez, y lo que borra va abajo en texto', () => {
  const a = fuente('app/chats/AdministrarWhatsApp.tsx');
  // Conectado no se explica cómo vincular: ya está vinculado.
  const conectado = a.slice(a.indexOf("const espejoRoto"));
  assert.ok(conectado.length > 500, 'no encontré la vista del número conectado');
  assert.doesNotMatch(conectado, /Dispositivos vinculados|Vincular dispositivo/, 'el número conectado vuelve a explicar cómo vincularse');
  // La pregunta de sincronizar: sólo recién conectado, en su propia pantalla.
  assert.match(a, /const \[preguntar, setPreguntar\] = useState\(recien\);/);
  assert.match(a, /if \(preguntar\) \{/);
  assert.match(a, /¿Traes las conversaciones que ya tienes en este número\?/);
  assert.equal((a.match(/¿Traes/g) ?? []).length, 1, 'la pregunta de sincronizar aparece más de una vez');
  // Lo que borra: en el PIE, en texto, y con confirmación.
  const pie = conectado.slice(conectado.indexOf('pie={('), conectado.indexOf('{confirmNode}'));
  assert.match(pie, /className="rio-adm-peligro" onClick=\{\(\) => void borrarHistorial\(\)\}/, '«Borrar el historial» no está en el pie');
  assert.match(pie, /className="rio-adm-peligro" onClick=\{\(\) => void desconectar\(\)\}/, '«Desconectar» no está en el pie');
  const cuerpo = conectado.slice(conectado.indexOf('{confirmNode}'));
  assert.doesNotMatch(cuerpo, /borrarHistorial\(\)|desconectar\(\)/, 'lo que borra volvió al cuerpo, entre lo de todos los días');
  for (const f of ['borrarHistorial', 'desconectar']) {
    assert.match(a, new RegExp(`async function ${f}\\(\\) \\{\\n\\s+if \\(!\\(await confirm\\(`), `${f} no pregunta antes`);
  }
  // El «Chatbot: ON/OFF» de la tab vieja vive acá (y lo cambia sólo quien puede: 403 = no se dibuja).
  assert.match(a, /label="Las automatizaciones envían"/);
});

test('6. /whatsapp ya no dibuja la tab vieja: lleva a Chats con sus links, y el wizard termina en Chats', () => {
  const page = fuente('app/whatsapp/page.tsx');
  assert.doesNotMatch(page, /<WhatsAppApp\b|<EmpresaInbox\b/);
  assert.match(page, /const PASAN = \['c', 'lead', 'linea', 'chat', 'n'\] as const;/, 'los links de un chat se pierden');
  assert.match(page, /q\.set\('conectar', 'whatsapp'\)/, 'sin número, no abre el QR');
  assert.match(page, /if \(uno\('stab'\) === 'plantillas'\) redirect\(await rutaConWs\(`\/automations\?stab=plantillas/);
  assert.match(page, /redirect\(await rutaConWs\(query \? `\/chats\?\$\{query\}` : '\/chats'\)\)/, 'pierde el ?ws= o no va a Chats');
  // Lo que sólo tenía la tab vieja, en Chats: los ocultos (con «Mostrar»), borrar un chat y la alarma del número caído.
  assert.match(fuente('app/chats/ListaOcultos.tsx'), /action: 'unhide'/);
  assert.match(fuente('app/chats/VentanaChat.tsx'), /action: 'clear-chat'/);
  assert.match(fuente('app/chats/ChatsApp.tsx'), /está desconectado\.`\}<\/span>/);
});

test('7. el super admin: una sola pantalla (sin barra de tres tabs) y el número de MaKo como una línea más', () => {
  const chats = FAMILIAS.flatMap((f) => f.bloques.flat()).find((t) => t.key === 'bandeja');
  assert.ok(chats, 'no encontré la tab Chats');
  assert.deepEqual((chats.secciones ?? []).map((s) => s.key), ['chats'], 'Chats volvió a tener secciones (la barra de tabs)');
  assert.equal(chats.match('/agencia'), true, '/agencia sigue marcando Chats en la barra');
  // La clave de un grupo de MaKo es FIJA (la instancia de la voz se muda) y pasa por el parser de siempre.
  assert.equal(LINEA_CANAL_MAKO, 'canal_mako');
  assert.deepEqual(parsearClave(`wa:${LINEA_CANAL_MAKO}:120363000000000099@g.us`), { tipo: 'whatsapp', linea: LINEA_CANAL_MAKO, id: '120363000000000099@g.us' });
  // Sólo el super admin EN SU BARRA: mirando a un cliente, Chats es el de ese cliente.
  const lib = fuente('lib/chats.ts');
  assert.match(lib, /async function veCanalMaKo\(\): Promise<boolean> \{\s*if \(!canalConfigurado\(\) \|\| !\(await getSesionAdmin\(\)\)\) return false;\s*return !\(await estaImpersonando\(\)\);/);
  assert.match(lib, /if \(p\.tipo === 'whatsapp' && p\.linea === LINEA_CANAL_MAKO\) return hiloDelCanalMaKo\(clave, p\.id, yo\);/);
  assert.match(lib, /async function hiloDelCanalMaKo[\s\S]{0,200}if \(!\(await veCanalMaKo\(\)\)\) return vacio;/, 'el hilo de un grupo de MaKo se lee sin ser el super admin');
  // Escribirle sale por el canal de MaKo, en escritorio y en el teléfono.
  assert.match(fuente('app/chats/Composer.tsx'), /'\/api\/admin\/mako-chats', \{ jid: i\.ref, texto: t \}/);
  assert.match(fuente('app/m/chats/[clave]/ComposerChatsM.tsx'), /if \(esCanalMaKo\(ident\)\) \{\s*j = await postJson<Respuesta>\('\/api\/admin\/mako-chats'/);
  // Su panel (QR, cambiar número) se abre desde «Administrar» del chip, sobre Chats.
  assert.match(fuente('app/chats/ChatsApp.tsx'), /if \(l\.linea === LINEA_CANAL_MAKO\) \{ setCanalMaKo\(true\); return; \}/);
});

test('8. un grupo de un número del negocio se sigue leyendo sin contestar; el de MaKo sí se escribe', () => {
  const lib = fuente('lib/chats.ts');
  assert.match(lib, /const puede = !c\.bloqueado && !grupo;/, 'un grupo del negocio volvió a ser escribible (el envío saca «el número» del jid)');
  assert.match(lib, /return \{ \.\.\.f, identidad: \{ \.\.\.f\.identidad, puedeEscribir: true, motivoNoEscribir: null \} \};/);
});

test('9. la caja es la del chat de MaKo, con lo de Chats en sus ranuras', () => {
  const c = fuente('app/chats/Composer.tsx');
  assert.match(c, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.doesNotMatch(c, /<textarea\b|EmojiPicker|useGrabacionVoz/, 'la caja de Chats volvió a armar lo suyo');
  // La nota de voz sólo en WhatsApp; en los demás (y en el comentario) el micrófono dicta.
  assert.match(c, /voz=\{!enComentario && esWa && !motivo \? \{ onAudio:/);
  // MaKo sugiere al final de la fila y nunca envía (tests/chats-ventana.test.ts lo fija en detalle).
  assert.match(c, /alFinal=\{!enComentario \? \(\s*<button type="button" className="rio-mako"/);
  // Soltar un archivo sobre la conversación entra como adjunto (la zona es la pantalla).
  assert.match(fuente('app/chats/VentanaChat.tsx'), /onDrop=\{\(e\) => alSoltar\(e, adjuntosRef\.current\)\}/);
});
