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
import { readFileSync } from 'node:fs';
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
  // El onboarding ya lo tenía; el modal de destinatarios pedía el número con un
  // input pelado y un placeholder, delegando la lada en el usuario. Un número sin
  // código de país no existe en WhatsApp, así que no se puede sumar a un grupo.
  for (const ruta of ['../app/perfil/DestinatariosModal.tsx', '../app/onboarding/OnboardingWizard.tsx']) {
    assert.ok(leer(ruta).includes('TelefonoConPais'),
      `${ruta} dejó de usar el campo compartido: vuelve a depender de que el usuario escriba la lada`);
  }
  // Y el wizard no volvió a tener su propio separador.
  assert.ok(!/function splitTelefono/.test(leer('../app/onboarding/OnboardingWizard.tsx')),
    'volvió la copia local de splitTelefono: es la que se queda vieja');
});

test('El menú del país se portalea DENTRO del modal, o se abre por detrás', () => {
  // El menú del Dropdown va a document.body con zIndex 1000 y el modal está en
  // 3000: sin `portalTo` el desplegable existe pero no se ve, que desde afuera
  // es idéntico a un selector roto.
  const src = leer('../app/perfil/DestinatariosModal.tsx');
  assert.match(src, /portalTo=\{panel\}/, 'el Dropdown de país perdió su portalTo: el menú queda detrás del modal');
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
  const modal = leer('../app/perfil/DestinatariosModal.tsx');
  assert.ok(modal.includes('noAgregados'), 'el modal no muestra a quién no se pudo sumar al grupo');
});

test('Ningún camino del modal rechaza sin decir por qué', () => {
  const src = leer('../app/perfil/DestinatariosModal.tsx');
  // «Agregar» ya no se apaga: contesta siempre, y cuando no puede explica.
  assert.ok(!/onClick=\{agregar\} disabled=/.test(src),
    'el botón Agregar volvió a deshabilitarse: un botón gris que no explica es igual a uno roto');
  // «Guardar» solo se apaga mientras guarda.
  assert.ok(/onClick=\{guardar\} disabled=\{busy\}/.test(src),
    'Guardar volvió a apagarse por `!dirty`: ese era el camino mudo que reportó el cliente');
  // Y lo escrito sin tocar «Agregar» no se tira.
  assert.ok(src.includes('onBorrador'),
    'el modal volvió a perder lo tipeado y no agregado al guardar');
});
