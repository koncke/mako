// =============================================================================
// Ops Center 2.1 — lo que le faltaba a Chats: enviar, contestar, agregar al CRM y marcar leído (21/10/2026)
// =============================================================================
// docs/ops-center-principal.md §5, Ola 2, 2.1: «Las operaciones que le faltan a Chats, con confirmación en la tarjeta:
// enviar_borrador_whatsapp, contestar_dm, contestar_email_chat, agregar_contacto_al_crm y marcar_leido_chat». Con la
// D3a (Martín, 21/10/2026): el toque en «Enviar» de la tarjeta ES la aprobación del mensaje al lead. Acá se fija:
//   1. el TURNO REAL: cada pedido llega al turno de la app con su operación (clasificarIntencion → herramientasDelChat,
//      el mismo camino que lib/mako-turno-app.ts, sin modelo);
//   2. la TARJETA: las cinco son `accion` con confirmación `chat` y van por la app (la tarjeta del hilo); nada por HTTP;
//      el botón dice lo que hace («Enviar el WhatsApp»);
//   3. la RED GRATIS no las recibe: son de clientes (área chats) y el turno de WhatsApp que las pide se corta;
//   4. el texto: «sí, dale» no es el mensaje; el canal y la cuenta por donde sale, con su motivo si no se puede;
//   5. las puertas: WhatsApp por la cola de borradores (`enviarBorradorPorSuCanal`: el borrador no se saltea), DM y
//      email por las funciones del compositor de /chats, el alta por el mismo criterio de producto.
//
// PROBADO ROMPIÉNDOLO (21/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · «borrador» fuera de la rueda de `chats` (lib/mako-intencion.ts)                  → 4 / 1
//   · «contést…» fuera de la rueda (con una frase que sólo dice «contéstale»)          → 4 / 1
//   · mandar el borrador con `enviarBorrador` y no por su puerta (saltea la línea)     → 4 / 1
//   · `textoDeEnvio` aceptando «sí, dale» como mensaje                                 → 4 / 1
//   · `identidadParaEnviar` sin mirar si se puede escribir (la ventana de 24 h)        → 4 / 1
//   · `marcar_leido_chat` también por WhatsApp (sin sesión no hay quién leyó)          → 4 / 1
//   · `contestar_dm` reversible                                                        → 4 / 1
//   · `contestar_dm` con `datosDeClientes: false` (la red gratis lo recibiría)          → 4 / 1
//   · el alta con otro origen que «Agregar al CRM» de /chats                           → 4 / 1
//   · el botón de la tarjeta «Proponer el WhatsApp» (tocarlo no diría «Enviar»)         → 4 / 1
// Correr: node --import tsx --test tests/chats-mako-envio.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { areasDelMensaje, type VeredictoIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import type { Vista } from '../lib/api-mako/registro';
import { REGISTRO } from '../lib/api-mako/registro';
import { llevaDatosDeClientes } from '../lib/doer-herramientas';
import { textoDeEnvio, identidadParaEnviar, canalDeDm } from '../lib/chats-envio-reglas';
import type { IdentidadCanal } from '../lib/chats-tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const NUEVAS = ['enviar_borrador_whatsapp', 'contestar_dm', 'contestar_email_chat', 'agregar_contacto_al_crm', 'marcar_leido_chat'] as const;

function nombresDeSiempre(): Array<{ name: string }> {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  const nombres = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], { cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })) as string[];
  return nombres.map((name) => ({ name }));
}
const DE_SIEMPRE = nombresDeSiempre();
const vistaApp: Vista = { canal: 'app', alcance: 'proponer', ws: 9, rol: 'admin', tabs: null };
/**
 * EL VEREDICTO DE LA 1.2. En la app, un verbo de hacer al principio del mensaje manda el turno a `actuar`
 * (lib/mako-intencion-app.ts, rama `mako-wa`, todavía no en main el 21/10/2026). Hasta que llegue, el veredicto se arma
 * ACÁ igual al que da la 1.2, y lo que se prueba es lo de la 2.1: que con ese veredicto el área `chats` (la rueda de
 * lib/mako-intencion.ts) traiga la operación. Cuando la 1.2 esté en main, esto pasa a `clasificarIntencionApp`.
 */
const VEREDICTO_1_2: VeredictoIntencion = { intencion: 'actuar', dudosa: false, porque: 'un verbo de hacer al principio (Ops Center 1.2)' };
const turnoApp = (mensaje: string) => herramientasDelChat({ veredicto: VEREDICTO_1_2, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: vistaApp, hayPendientes: false }).tools.map((x) => x.name);

test('el turno real: cada pedido llega a la app con su operación', () => {
  const casos: Array<[string, typeof NUEVAS[number]]> = [
    ['mándale el borrador a Juan', 'enviar_borrador_whatsapp'],
    ['mándale por WhatsApp a Ana: mañana te llamo a las 10', 'enviar_borrador_whatsapp'],
    ['contéstale el DM a Pedro: gracias por escribirnos', 'contestar_dm'],
    ['contéstale a Pedro por Instagram: gracias por escribirnos', 'contestar_dm'],
    ['respóndele el mail a Laura: te mando la propuesta hoy', 'contestar_email_chat'],
    ['agrega al CRM a la persona de este chat', 'agregar_contacto_al_crm'],
    ['marca como leído el chat de Ana', 'marcar_leido_chat'],
  ];
  for (const [frase, op] of casos) {
    assert.ok(areasDelMensaje(frase).includes('chats'), `«${frase}» no es del área chats (${areasDelMensaje(frase).join(', ')})`);
    const llegan = turnoApp(frase);
    assert.ok(llegan.includes(op), `«${frase}» no trajo ${op} (llegaron: ${llegan.slice(0, 30).join(', ')})`);
  }
});

test('la tarjeta: acciones con confirmación en el chat, por la app y nunca por HTTP; el botón dice lo que hace', () => {
  for (const id of NUEVAS) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d, `${id} no está en el registro`);
    assert.equal(d.area, 'chats', `${id}: área chats`);
    assert.equal(d.tipo, 'accion');
    assert.ok(d.tipo === 'accion' && d.confirmacion === 'chat', `${id}: se confirma tocando la tarjeta del hilo`);
    assert.ok(d.canales.includes('app'), `${id}: va por la app`);
    assert.ok(!d.canales.includes('http'), `${id}: conversaciones de personas no salen por HTTP`);
  }
  const boton = (id: string) => REGISTRO.find((x) => x.id === id)?.titulo;
  assert.equal(boton('enviar_borrador_whatsapp'), 'Enviar el WhatsApp', 'el botón de la tarjeta es el título: tocarlo es «Enviar»');
  assert.equal(boton('contestar_dm'), 'Enviar el mensaje directo');
  assert.equal(boton('contestar_email_chat'), 'Enviar el email');
  const leido = REGISTRO.find((x) => x.id === 'marcar_leido_chat');
  assert.deepEqual(leido?.canales, ['app'], 'el leído es de una persona: sólo con sesión');
  for (const id of ['enviar_borrador_whatsapp', 'contestar_dm', 'contestar_email_chat']) {
    const d = REGISTRO.find((x) => x.id === id);
    assert.ok(d?.tipo === 'accion' && d.reversible === false, `${id}: un mensaje mandado no se desmanda`);
  }
});

test('la red gratis no las recibe: son datos de clientes', () => {
  for (const id of NUEVAS) assert.equal(llevaDatosDeClientes(id), true, `${id} tiene que cortar el turno de la red gratis`);
});

test('el texto: «sí, dale» no es el mensaje; el canal y la cuenta, con su motivo', () => {
  assert.deepEqual(textoDeEnvio('  Hola Ana, ¿te llamo mañana?  ', 'whatsapp'), { texto: 'Hola Ana, ¿te llamo mañana?' });
  for (const nada of ['', 'sí, dale', 'Dale, mándalo', 'ok', '¡Sí! envíalo ya']) {
    const r = textoDeEnvio(nada, 'whatsapp', nada);
    assert.ok('error' in r, `«${nada}» no es el mensaje`);
  }
  assert.ok('texto' in textoDeEnvio('Va mañana a las 10, te espero', 'whatsapp'), 'un mensaje que empieza con «va» es un mensaje');
  assert.ok('error' in textoDeEnvio('x'.repeat(1001), 'instagram'), 'Instagram corta en 1.000: se dice, no se corta');
  const id = (canal: IdentidadCanal['canal'], o: Partial<IdentidadCanal> = {}): IdentidadCanal => ({ canal, cuenta: null, rotulo: canal, destino: null, ref: `${canal}-ref`, telefono: null, ultimaFecha: null, puedeEscribir: true, motivoNoEscribir: null, bloqueado: false, ...o });
  const wa = identidadParaEnviar([id('whatsapp', { cuenta: 'ventas' }), id('whatsapp', { cuenta: 'soporte' })], 'whatsapp', 'soporte');
  assert.ok('identidad' in wa && wa.identidad.cuenta === 'soporte', 'la línea pedida');
  const cerrada = identidadParaEnviar([id('instagram', { puedeEscribir: false, motivoNoEscribir: 'Ventana de 24 h cerrada' })], 'instagram');
  assert.ok('error' in cerrada && /Ventana de 24 h cerrada/.test(cerrada.error), 'si no se puede, el motivo que ve la persona en /chats');
  assert.ok('error' in identidadParaEnviar([id('whatsapp')], 'email'), 'sin email no hay email');
  const dos = canalDeDm([id('instagram'), id('messenger')]);
  assert.ok('error' in dos && dos.faltan?.includes('canal'), 'Instagram Y Messenger: pregunta por cuál');
  assert.deepEqual(canalDeDm([id('messenger')]), { canal: 'messenger' });
});

test('las puertas: el borrador no se saltea, y DM, email y alta por el camino de /chats', () => {
  const run = leer('lib/api-mako/areas/chats.run.ts');
  const cuerpo = (id: string) => run.slice(run.indexOf(`  ${id}: {`), run.indexOf('\n  },\n', run.indexOf(`  ${id}: {`)));
  const wa = cuerpo('enviar_borrador_whatsapp');
  assert.match(wa, /await enviarBorradorPorSuCanal\(id, /, 'la ÚNICA puerta de envío de un borrador');
  assert.doesNotMatch(wa, /enviarYEspejar|enviarBorrador\(/, 'mandar por WhatsApp sin la cola saltearía el borrador (D3a)');
  assert.match(wa, /await crearBorrador\(\{[^\n]*origen: 'mako'/, 'el texto nuevo entra a la cola de borradores');
  assert.match(wa, /textoDeEnvio\(input\.texto, 'whatsapp', ctx\.mensajeUsuario\)/);
  assert.match(cuerpo('contestar_dm'), /await enviarManualSocial\(\{ convId: Number\(payload\.convId\), texto: String\(payload\.texto \?\? ''\), idempotencia:/);
  assert.match(cuerpo('contestar_email_chat'), /await enviarEmailDeChat\(\{/);
  assert.match(cuerpo('contestar_email_chat'), /textoDeEnvio\(input\.texto, 'email', ctx\.mensajeUsuario\)/);
  assert.match(cuerpo('contestar_dm'), /textoDeEnvio\(input\.texto, cd\.canal, ctx\.mensajeUsuario\)/);
  const alta = cuerpo('agregar_contacto_al_crm');
  assert.match(alta, /crearLeadDeConversacionSocial\(Number\(payload\.convId\), funnelId\)/);
  assert.match(alta, /origen_lead: ORIGEN_LEAD\.chat_whatsapp\.id, funnel_id: destino\.casa/, 'el mismo origen y la misma casa que «Agregar al CRM» de /chats');
  assert.match(run, /const d = destinoDelAlta\(await leerFunnels\(\), funnelId\);/, 'el mismo criterio de producto');
  assert.match(cuerpo('marcar_leido_chat'), /const yo = await usuarioDe\(ctx\);[\s\S]*marcarChatLeido\(String\(payload\.clave \?\? ''\), yo\.id\)/, 'el leído de QUIEN confirma');
});
