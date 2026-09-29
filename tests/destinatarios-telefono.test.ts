// =============================================================================
// Sumar a alguien al grupo de MaKo: que no se pueda fallar EN SILENCIO
// =============================================================================
// El 21/8/2026 un cliente reportó: «no puedo agregar a nadie al grupo; le doy a
// enviar y no pasa nada, ni siquiera un mensaje de error». Tenía razón en las dos
// mitades — no se podía, y no se enteraba.
//
// Lo que se midió ese día contra la API real de WhatsApp:
//
//   · 542233550684 → exists:true    ·    2233550684 → exists:false
//     (el MISMO teléfono sin el código de país, sencillamente, no existe)
//
//   · agregar un número inexistente devuelve **HTTP 200** con el fallo adentro:
//     { "updateParticipants": [ { "status": "403", … } ] }
//     El código miraba `r.ok` → informaba éxito. No había error que mostrar
//     porque el sistema creía que había funcionado.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { splitTelefono, unirTelefono, DIAL_DEFAULT, PAISES } from '../lib/paises';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El separador de lada trabaja sobre DÍGITOS: así se guardan los números', () => {
  // La copia que vivía suelta en el wizard comparaba con el «+» puesto, y todo
  // lo que este repo guarda son dígitos pelados: no matcheaba nunca.
  assert.deepEqual(splitTelefono('542233550684'), { lada: '+54', resto: '2233550684' });
  assert.deepEqual(splitTelefono('+54 223 355-0684'), { lada: '+54', resto: '2233550684' });
  // La lada más LARGA gana: si no, «+1» se come a «+1809».
  assert.deepEqual(splitTelefono('18095551234'), { lada: '+1809', resto: '5551234' });
  // Sin número, el país por default y nada más.
  assert.deepEqual(splitTelefono(''), { lada: DIAL_DEFAULT, resto: '' });
});

test('Unir es la contracara exacta de separar', () => {
  for (const n of ['542233550684', '5215512345678', '18095551234', '34600123456']) {
    const { lada, resto } = splitTelefono(n);
    assert.equal(unirTelefono(lada, resto), n, `no vuelve a armar ${n}`);
  }
});

test('Toda lada del catálogo empieza con + y sigue con dígitos', () => {
  // splitTelefono usa `dial.slice(1)` para comparar contra dígitos: si una lada
  // entrara sin el «+», recortaría un dígito de verdad y partiría mal el número.
  for (const p of PAISES) {
    assert.match(p.dial, /^\+\d+$/, `la lada de ${p.nombre} no tiene la forma +NNN: ${p.dial}`);
  }
});

test('El teléfono se pide con selector de país en LOS DOS lados', () => {
  // El onboarding ya lo tenía; el editor de destinatarios pedía el número con un
  // input pelado y un placeholder, delegando la lada en el usuario. Un número sin
  // código de país no existe en WhatsApp, así que no se puede sumar a un grupo.
  for (const ruta of ['../app/perfil/DestinatariosLista.tsx', '../app/onboarding/OnboardingWizard.tsx']) {
    assert.ok(leer(ruta).includes('TelefonoConPais'),
      `${ruta} dejó de usar el campo compartido: vuelve a depender de que el usuario escriba la lada`);
  }
  // Y el wizard no volvió a tener su propio separador.
  assert.ok(!/function splitTelefono/.test(leer('../app/onboarding/OnboardingWizard.tsx')),
    'volvió la copia local de splitTelefono: es la que se queda vieja');
});

test('El editor de destinatarios está MONTADO, y hay UNO solo', () => {
  // Reemplaza al test del `portalTo` del modal, que se retiró el 29/09/2026 con su
  // sujeto: los destinatarios se editan en la página, un canal a la vez. El menú de
  // ladas ya no puede quedar detrás de nada (no hay overlay encima), así que el
  // riesgo cambió de lugar: lo que ahora se puede perder es el CALL SITE — un
  // editor escrito y no montado deja la pantalla sin ninguna forma de agregar a
  // nadie, que es el mismo síntoma que reportó el cliente en 2026.
  //
  // Probado rompiéndolo: con el montaje renombrado -> 10 pasan / 1 falla («no hay
  // dónde agregar un número»); con un DestinatariosModal.tsx vacío de vuelta -> 10 / 1
  // («es un segundo editor del mismo dato»). Restaurado: 11 / 0.
  const panel = leer('../app/perfil/NotificacionesPanel.tsx');
  assert.match(panel, /<DestinatariosCanal\b/,
    'el panel de notificaciones dejó de montar el editor de destinatarios: no hay dónde agregar un número');

  // Y no vuelven a ser dos: con dos editores del mismo dato, el que nadie abre es
  // el que se queda viejo (y sus tests siguen en verde mirándolo).
  const perfil = readdirSync(new URL('../app/perfil/', import.meta.url));
  assert.ok(!perfil.includes('DestinatariosModal.tsx'),
    'volvió el modal de destinatarios: es un segundo editor del mismo dato');
});

test('Agregar al grupo mira el BODY, no el HTTP 200', () => {
  const src = leer('../lib/mako-grupo.ts');
  assert.ok(src.includes('updateParticipants'),
    'agregarParticipanteGrupo volvió a confiar en r.ok: Evolution contesta 200 con el fallo adentro');
  assert.ok(/leerResultadoParticipante\(r\.body\)/.test(src),
    'se perdió la lectura del resultado por participante');
  // Y pregunta si el número existe antes de intentar, que es lo que permite
  // decir POR QUÉ en vez de un error genérico.
  assert.ok(src.includes('numeroTieneWhatsApp'), 'ya no se chequea que el número exista en WhatsApp');
  // ⚠️ Pero NO puede rechazar cuando la consulta falló: «no pude averiguarlo» no
  // es «no existe». Es la regla de AGENTS.md aplicada a este chequeo.
  assert.ok(/chequeo\.consultado && !chequeo\.existe/.test(src),
    'rechaza sin distinguir «no existe» de «no pude preguntar»: una caída nuestra dejaría afuera a gente real');
});

test('Sumar al grupo ya no se falla en silencio', () => {
  const src = leer('../lib/notif-destinatarios.ts');
  assert.ok(!/agregarParticipanteGrupo\([^)]*\)\.catch\(\(\) => \{\}\)/.test(src),
    'volvió el `.catch(() => {})`: el fallo de sumar al grupo se traga otra vez');
  assert.ok(src.includes('noAgregados'),
    'el resultado dejó de informar a quién no pudo sumar al grupo');

  // Y la pantalla lo MUESTRA: un dato que solo viaja en el JSON es un dato que
  // el usuario no ve, que es el bug original con otra cara.
  const pantalla = leer('../app/perfil/DestinatariosCanal.tsx');
  assert.ok(pantalla.includes('noAgregados'), 'la pantalla no muestra a quién no se pudo sumar al grupo');
});

test('Ningún camino del editor rechaza sin decir por qué', () => {
  // ⚠️ ESTE TEST SE MUDÓ CON LA PIEZA QUE GUARDABA. El «Guardar» se retiró el
  // 29/09/2026 («que el botón de Guardar no exista, para eso sólo un check al final
  // del input»), así que sus dos assertions —que sólo se apagara mientras guarda, y
  // que el borrador no se perdiera AL GUARDAR— quedaron sin sujeto. Dejarlas mirando
  // un botón que ya no existe es un test en verde sobre código que nadie puede
  // tocar; borrarlas sin más es perder la guarda del camino mudo que las originó.
  // Lo que se conserva es la PREGUNTA, contra lo que hoy ocupa su lugar.
  //
  // Probado rompiendolo: con un disabled en el tilde -> 10 pasan / 1 falla ('el boton
  // de agregar volvio a deshabilitarse'); renombrando 'pendiente' -> 10 / 1 ('el tilde
  // dejo de avisar que hay algo escrito sin confirmar'). Restaurado: 11 / 0.
  const lista = leer('../app/perfil/DestinatariosLista.tsx');
  const canal = leer('../app/perfil/DestinatariosCanal.tsx');

  // 1. El tilde contesta SIEMPRE: un botón gris que no explica es igual a uno roto.
  assert.ok(!/onClick=\{agregar\}[^>]*disabled/.test(lista),
    'el botón de agregar volvió a deshabilitarse: ése es el camino mudo que reportó el cliente');
  assert.ok(/setMotivo\(/.test(lista), 'se perdió el motivo: rechazar sin decir por qué es el bug original');

  // 2. Y se PINTA cuando hay algo escrito sin confirmar. Es lo único que queda del
  //    riesgo que cubría el borrador: sin «Guardar», nadie te recuerda que lo
  //    tipeado todavía no entró.
  assert.ok(/const pendiente = /.test(lista),
    'el tilde dejó de avisar que hay algo escrito sin confirmar');
  assert.ok(/background: pendiente \?/.test(lista),
    'el tilde ya no cambia de estado con lo pendiente: vuelve «lo escribí y creí que quedó»');

  // 3. Y el resultado del guardado se dice, incluido el que falla solo.
  assert.ok(/setError\(/.test(canal) && /Guardado/.test(canal),
    'el editor dejó de decir si guardó o no');
});

test('Se ACTÚA con la forma del número que WhatsApp reconoce, no con la tipeada', () => {
  // Medido el 24/8/2026: las tres formas del mismo teléfono resuelven al mismo
  // jid en `whatsappNumbers`, que normaliza…
  //     5402233550684 ┐
  //      542233550684 ├→ 5492233550684@s.whatsapp.net  (exists: true)
  //     5492233550684 ┘
  // …y `updateParticipant` NO normaliza: con el crudo `5402233550684` contesta
  // HTTP 400. Se verificaba con una forma y se actuaba con otra — el mismo bug
  // que el prefijo `act_` de Meta, en otro proveedor.
  const src = leer('../lib/mako-grupo.ts');
  assert.ok(/canonico/.test(src), 'numeroTieneWhatsApp dejó de devolver la forma canónica del número');
  assert.ok(/const num = chequeo\.canonico \?\? crudo/.test(src),
    'el alta volvió a usar el número tipeado en vez del que WhatsApp reconoce');

  // Y se GUARDA la canónica: un dato que entra torcido sale torcido en toda
  // pantalla que lo lea después (el cliente veía «+54 02233550684»).
  const dest = leer('../lib/notif-destinatarios.ts');
  assert.ok(/numeroTieneWhatsApp\(t\)/.test(dest),
    'setDestinatarios volvió a guardar el número crudo');
  // ⚠️ Pero si no se pudo consultar, se conserva lo que escribió la persona: una
  // caída de Evolution no puede perder el número de nadie.
  assert.ok(/c\?\.consultado && c\.existe && c\.canonico \? c\.canonico : t/.test(dest),
    'la canonicalización dejó de ser fail-safe: una caída borraría números');
});

test('No se afirma un envío que no ocurrió', () => {
  const src = leer('../lib/mako-grupo.ts');
  // El `add_request` que viene adentro del 403 de updateParticipant NO es un
  // envío: es un token que WhatsApp ofrece. Se leyó como si lo fuera y la
  // pantalla llegó a decirle a un cliente «le llegó una invitación» sin que MaKo
  // hubiera mandado nada. El dueño lo cazó: «dice que MaKo le envió algo, y no
  // envió nada».
  // Solo el VALOR del 403, no la prosa de alrededor (el comentario de al lado
  // explica justamente por qué ahí no se habla de invitaciones).
  const msg403 = /^\s*'403':\s*'([^']*)'/m.exec(src)?.[1] ?? '';
  assert.ok(msg403, 'no se pudo leer el mensaje del estado 403');
  assert.ok(!/invitaci/i.test(msg403),
    `el 403 volvió a afirmar un envío que no hizo: «${msg403}»`);

  // La invitación se manda por su propio endpoint, y recién entonces se cuenta.
  assert.ok(src.includes('/group/sendInvite/'), 'no existe el envío real de la invitación');
  assert.ok(/envio\.ok\s*\n?\s*\?/.test(src) || /envio\.ok$/m.test(src),
    'el mensaje de la invitación no depende de que el envío haya salido');
});

test('Cuando WhatsApp no deja agregar, la app ofrece el link del grupo', () => {
  // La pregunta del dueño: «no entiendo cómo podemos crear grupos con personas
  // pero luego no podemos invitar a nuevas». El link SIEMPRE funciona, así que
  // que no se pueda agregar directo no puede dejar a nadie trabado.
  const src = leer('../lib/mako-grupo.ts');
  assert.ok(src.includes('/group/inviteCode/'), 'se perdió el link de invitación del grupo');

  const pantalla = leer('../app/perfil/DestinatariosCanal.tsx');
  assert.ok(pantalla.includes('linkGrupo'), 'la pantalla no ofrece el link para pasarlo a mano');
  assert.ok(/clipboard\.writeText/.test(pantalla), 'el link no se puede copiar');
});
