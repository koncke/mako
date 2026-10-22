// «Discutir» y «Editar» en el chat de MaKo de una automatización, y la charla que viaja (22/10/2026)
// =============================================================================
// La llamada con Mauricio (02:05-02:10): pegaron los mensajes y MaKo contestó en vez de armarlos; a «hazlo como te lo
// indiqué» contestó «indícame qué cambios…» (el prompt de editar no veía la charla). Martín: «como Lovable, un botón de
// discutir y otro de editar»; Mauricio: «que obedezca».
// Medido en seco el 22/10 (scratchpad, editar-en-seco.mts, con el flujo #289 del ws1 y la cascada gratis): con la
// charla y «Editar», «hazlo como te lo indique» cambió 1 tarjeta y agregó la otra con el texto TAL CUAL ({Nombre} →
// {{nombre}}).
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  intencionDe, vaAExplicar, bloqueDeLaCharla, extrasDelUser, REGLAS_EDITAR, REGLAS_DISCUTIR, ERROR_EDITAR_SIN_CAMBIOS, MENSAJES_DE_LA_CHARLA,
  LO_QUE_NO_ES_TARJETA, errorDeRespuestaEnEditar, charlaConTextos, esPreguntaDirecta, traeTextosPegados, REGLAS_PEGADO,
} from '../lib/flujo-ia-intencion';
import { cuerpoIA } from '../app/automations/stream-ia';

test('sólo «discutir» y «editar» valen; lo demás es «sin elegir»', () => {
  assert.equal(intencionDe('discutir'), 'discutir');
  assert.equal(intencionDe('editar'), 'editar');
  for (const x of [undefined, null, '', 'Editar', 'otra', 1]) assert.equal(intencionDe(x), null);
});

test('Discutir va siempre a explicar; Editar nunca; sin elegir, lo de antes; contestar una pregunta de MaKo, edita', () => {
  assert.equal(vaAExplicar('discutir', false, false), true, 'aunque suene a pedido');
  assert.equal(vaAExplicar('editar', false, true), false, 'aunque suene a pregunta («quiero que estos sean los mensajes»)');
  assert.equal(vaAExplicar(null, false, true), true);
  assert.equal(vaAExplicar(null, false, false), false);
  assert.equal(vaAExplicar('discutir', true, true), false, 'una respuesta a la pregunta de MaKo sigue el pedido');
});

test('la charla viaja: los últimos mensajes, con quién los dijo', () => {
  const hist = [
    { de: 'yo', texto: 'quiero que estos sean los mensajes: «Hola {Nombre}»' },
    { de: 'mako', texto: 'Habría que editarlos o añadir nuevas tarjetas.' },
    { de: 'sistema', texto: 'no cuenta' },
  ];
  const b = bloqueDeLaCharla(hist)!;
  assert.match(b, /^LO ÚLTIMO DE ESTA CHARLA/);
  assert.match(b, /- El dueño: quiero que estos sean los mensajes: «Hola \{Nombre\}»/);
  assert.match(b, /- MaKo: Habría que editarlos/);
  assert.doesNotMatch(b, /no cuenta/);
  assert.equal(bloqueDeLaCharla([]), null);
  const muchos = Array.from({ length: 20 }, (_, i) => ({ de: 'yo', texto: `m${i}` }));
  assert.equal(bloqueDeLaCharla(muchos)!.split('\n').length - 1, MENSAJES_DE_LA_CHARLA);
});

test('a cada intención, sus reglas; sin elegir, sólo la charla', () => {
  const h = [{ de: 'yo', texto: 'hola' }];
  assert.ok(extrasDelUser('editar', h).includes(REGLAS_EDITAR));
  assert.ok(extrasDelUser('discutir', h).includes(REGLAS_DISCUTIR));
  // Y siempre, lo que no se arma con tarjetas (22/10/2026, la prueba de los chats del Cerebro).
  assert.deepEqual(extrasDelUser(null, h), [bloqueDeLaCharla(h), LO_QUE_NO_ES_TARJETA]);
  assert.match(LO_QUE_NO_ES_TARJETA, /Configuraciones › Horario/);
  assert.match(LO_QUE_NO_ES_TARJETA, /Goteo de sus WhatsApp/);
  assert.match(LO_QUE_NO_ES_TARJETA, /Misma persona/);
  assert.match(REGLAS_EDITAR, /no agregues esperas que no pidió/);
  assert.match(REGLAS_EDITAR, /TAL CUAL/);
  assert.match(REGLAS_EDITAR, /«\{Nombre\}».*es \{\{nombre\}\}/);
  assert.match(REGLAS_EDITAR, /NO se inventa/);
});

test('el cliente manda la intención', () => {
  assert.equal(cuerpoIA({ pedido: 'x', modo: 'editar', intencion: 'discutir' }).intencion, 'discutir');
  assert.equal('intencion' in cuerpoIA({ pedido: 'x', modo: 'crear' }), false);
});

// ── El cableado en la ruta y en el chat ─────────────────────────────────────────────────────────────────────────
const ruta = readFileSync(join(__dirname, '..', 'app/api/chat-agent/secuencias/ia/route.ts'), 'utf8').replace(/\r\n/g, '\n');
const chat = readFileSync(join(__dirname, '..', 'app/automations/ChatMako.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('la ruta: la intención decide explicar o editar, la charla va en los dos, y en Editar contestar es un error', () => {
  assert.match(ruta, /const intencion = intencionDe\(body\.intencion\);/);
  assert.match(ruta, /const extras = extrasDelUser\(intencion, historial\);\n\s+if \(vaAExplicar\(intencion, respuestas\.length > 0, esConsulta\(pedido\), esPreguntaDirecta\(pedido\)\)\) \{/);
  assert.match(ruta, /const user = \[userDeExplicar\(\{[^\n]+\}\), \.\.\.extras\]\.join\('\\n\\n'\);/);
  assert.match(ruta, /const user = \[userDeEditar\(ctx, \{ perfil, voz, pedido: pedidoEditar \}, base\), \.\.\.extras\]\.join\('\\n\\n'\);/);
  assert.match(ruta, /const errorRespuesta = r\.respuesta && intencion === 'editar' \? errorDeRespuestaEnEditar\(pedido, r\.respuesta, \{ esPregunta: esConsulta\(pedido\), charlaConTextos: charlaConTextos\(historial\) \}\) : null;\n\s+if \(errorRespuesta\) return \{ r, errores: \[errorRespuesta\] \};/);
  assert.ok(ERROR_EDITAR_SIN_CAMBIOS.length > 20);
  // En Editar, una pregunta DIRECTA va a explicar (22/10/2026: «¿A cuántos les va a llegar?» en editar decía «Configuraciones»).
  assert.equal(vaAExplicar('editar', false, true, true), true);
  assert.equal(vaAExplicar('editar', false, true, false), false, '«que no le mande nada» (esConsulta) no basta');
  assert.equal(esPreguntaDirecta('¿A cuántos les va a llegar?'), true);
  assert.equal(esPreguntaDirecta('Quiero que estos sean los mensajes:\n1. ¿Sigues al frente?'), false);
  assert.equal(esPreguntaDirecta('si no la tiene, que no le mande nada'), false);
});

// 22/10/2026 (la prueba de los chats del Cerebro: mau-pega-secuencia y emojis-saltos): AL CREAR, con textos pegados, van tal cual,
// con las esperas que escribió y sin las de la regla 3. Crear no tiene «Discutir / Editar».
// rotura (crear sin `REGLAS_PEGADO`) → 1 rojo (éste).
test('al crear con textos pegados, el pedido lleva sus reglas; sin pegar, no', () => {
  const core = readFileSync(join(__dirname, '..', 'lib/flujo-ia-crear-core.ts'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(core, /const user = \[userDeCrear\([^\n]+\), \.\.\.\(traeTextosPegados\(o\.pedido\) \? \[REGLAS_PEGADO\] : \[\]\)\]\.join\('\\n\\n'\);/);
  assert.match(REGLAS_PEGADO, /\(esperar 1 día\)/);
  assert.match(REGLAS_PEGADO, /no pongas un "esperar"/);
  assert.match(REGLAS_PEGADO, /«\{Nombre\}» es \{\{nombre\}\}/);
});

// 22/10/2026, las corridas del arnés del Cerebro: en 4de3fe769 Editar rechazaba TODA respuesta («que no salgan todos juntos» o
// «cambiá el mensaje» terminaban en «No cambió nada»), y con el bloque de Configuraciones el modelo inventó «Configuraciones ›
// Acciones». Lo que no vale: contestar a textos pegados (o con los textos en la charla), a una orden, o un lugar que no existe.
// roturas (siempre el error: lo de 4de3fe769; sin `traeTextosPegados`; sin mirar el lugar) → 1 rojo cada una (éste).
test('en Editar vale aclarar, decir dónde se configura (un lugar real) o que no se puede; no a textos pegados ni a una orden', () => {
  const pegado = 'Quiero que estos sean los mensajes:\n1. Hola {Nombre}, soy Mauricio Bustos. ¿Sigues al frente de tu empresa?\n2. ¿Te puedo hacer una pregunta rápida?';
  const sin = { esPregunta: false, charlaConTextos: false };
  assert.equal(traeTextosPegados(pegado), true);
  assert.equal(traeTextosPegados('Agregá este texto: «Hola {Nombre}, me quedan 3 lugares para el Sprint»'), true);
  assert.equal(traeTextosPegados('¿Qué hace esta automatización?'), false);
  assert.equal(traeTextosPegados('Que arranque en la etapa Prospección activa del CRM «Sprint 3 días»'), false);
  // Lo de la llamada: a textos pegados no se contesta, aunque traigan «?».
  assert.equal(errorDeRespuestaEnEditar(pegado, 'Habría que editarlos o añadir nuevas tarjetas.', { ...sin, esPregunta: true }), ERROR_EDITAR_SIN_CAMBIOS);
  assert.equal(errorDeRespuestaEnEditar(pegado, 'Eso va en Configuraciones › Límites.', sin), ERROR_EDITAR_SIN_CAMBIOS);
  // Una pregunta sobre el flujo, sí.
  assert.equal(errorDeRespuestaEnEditar('¿Qué hace esta automatización?', 'Le escribe a quien entra a Prospección activa.', { ...sin, esPregunta: true }), null);
  // Lo que se configura fuera de las tarjetas, sí, aunque sea una orden; un lugar que NO existe, no (y el error lo dice).
  assert.equal(errorDeRespuestaEnEditar('que no salgan todos juntos, esperá 5 minutos', 'Eso se configura en Configuraciones › Límites, «Goteo de sus WhatsApp».', sin), null);
  assert.match(String(errorDeRespuestaEnEditar('que lo llame por teléfono', 'Configura la llamada en Configuraciones › Acciones de la automatización.', sin)), /«Configuraciones › Acciones» no existe/);
  // Lo que no se puede, sí; pero no «pídemelo» ni «habría que».
  assert.equal(errorDeRespuestaEnEditar('que lo llame por teléfono', 'No se puede: MaKo no hace llamadas, sólo escribe.', sin), null);
  assert.equal(errorDeRespuestaEnEditar('cambiá el segundo mensaje', 'No puedo modificarlo, pídemelo en el chat.', sin), ERROR_EDITAR_SIN_CAMBIOS);
  // Aclarar un pedido ambiguo, sí; pero no «¿qué cambios?» con los textos ya en la charla (el «Hazlo como te lo indiqué»).
  assert.equal(errorDeRespuestaEnEditar('cambiá el mensaje', '¿Cuál de los tres mensajes y qué le cambio?', sin), null);
  assert.equal(errorDeRespuestaEnEditar('Hazlo como te lo indiqué', '¿Podrías detallarme qué cambios quieres?', { ...sin, charlaConTextos: true }), ERROR_EDITAR_SIN_CAMBIOS);
  assert.equal(charlaConTextos([{ de: 'yo', texto: pegado }, { de: 'mako', texto: 'Habría que…' }]), true);
  assert.equal(charlaConTextos([{ de: 'yo', texto: '¿Qué hace?' }]), false);
  // Una orden sin nada de eso: se cambia el flujo.
  assert.equal(errorDeRespuestaEnEditar('Borrá el segundo mensaje', 'Listo, lo tengo en cuenta.', sin), ERROR_EDITAR_SIN_CAMBIOS);
});

test('el chat: Discutir / Editar encima de la barra (no al crear), arranca en Editar y viaja en el pedido de editar', () => {
  assert.match(chat, /useState<IntencionChat>\('editar'\)/);
  assert.match(chat, /\.\.\.\(modo === 'editar' \? \{ intencion \} : \{\}\),/);
  assert.match(chat, /: crea \? errorMako\n\s+: <>\{errorMako\}<SelectorIntencion valor=\{intencion\}/);
});

// ── Las roturas (7 tests; sin romper nada: 7 pases, 0 fallos) ──────────────────────────────────────────────────────
// 1. `vaAExplicar` sin el caso Editar (lo de antes: «quiero que estos sean los mensajes» iba a explicar): 1 fallo / 6 pases.
// 2. `extrasDelUser` sin la charla (lo de antes: «hazlo como te lo indiqué» sin contexto): 1 fallo / 6 pases.
// 3. La ruta sin el error de Editar (el modelo contesta y no cambia nada): 1 fallo / 6 pases.
// 4. La ruta editando sin `extras`: 1 fallo / 6 pases.
// 5. El chat sin mandar la intención: 1 fallo / 6 pases.

// ── A5: «esta etapa no existe» se leyó como un cache viejo, y era una etapa que ese CRM no tiene ───────────────────
// Medido en el chat guardado de #289 (ws1): el aviso fue «Saqué «Mover de etapa»: esa etapa no existe», por «Contactado»,
// que el CRM «Sprint 3 días» no tiene; el catálogo SÍ traía «Prospección activa» recién creada. No era cache.
test('A5: sacar un «Mover de etapa» dice CUÁL etapa y de QUÉ CRM', () => {
  const ia = readFileSync(join(__dirname, '..', 'lib/flujo-ia.ts'), 'utf8');
  assert.match(ia, /return \{ quitar: `Saqué «\$\{def\.titulo\}»: \$\{str\(datos\.etapa\) \? `«\$\{str\(datos\.etapa\)\}»` : 'esa etapa'\} no es una etapa de \$\{en \? `«\$\{en\.nombre\}»` : 'ese CRM'\}` \};/);
  assert.doesNotMatch(ia, /return \{ quitar: `Saqué «\$\{def\.titulo\}»: esa etapa no existe` \};/);
});
// 6. (A5) El aviso de antes («esa etapa no existe», sin cuál ni de qué CRM): 1 fallo / 7 pases.
