// =============================================================================
// El email de avance de un ticket: avisar sin convertirse en spam (2/11/2026)
// =============================================================================
// Joan preguntó por WhatsApp «¿cómo van esos tickets?» y no tenía forma de saberlo. Martín: «crea
// diferentes estados como para ir avisándole al usuario de cómo está avanzando su ticket… y que se
// le envíe por email los avances. Y solamente cuando ya esté 100 % finalizado, ahí sí el mensaje de
// WhatsApp que ya tenemos».
//
// ⚠️ LAS DOS REGLAS QUE ESTE TEST CUIDA, y las dos se rompen en silencio:
//   1. **Sólo hacia adelante.** Un ticket que rebota entre «en curso» y «esperando cliente» no puede
//      mandar un correo por rebote: el tercero va a spam y el cuarto no lo lee nadie.
//   2. **'cerrado' no manda correo.** El cierre ya se avisa por push, por el chat y por WhatsApp
//      (`avisarPendientes`, lib/tickets-cierre.ts). Un correo más sería el cuarto aviso de lo mismo,
//      y Martín pidió que el final siga siendo el WhatsApp que ya existe.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 7 / 0, una rotura por vez y restaurada:
//   · `tocaAvisarAvance` con `i >= j` en vez de `i > j` (reavisa el mismo hito)   → 6 / 1
//   · `tocaAvisarAvance` sin comparar el orden (cualquier cambio avisa)            → 5 / 2
//   · `HITOS_QUE_AVISAN` con 'cerrado' adentro                                     → 6 / 1
//   · `tocaAvisarAvance` que acepta un hito desconocido (sin el `i < 0`)           → 6 / 1
// Correr: node --import tsx --test tests/tickets-avance.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASUNTO_DEL_HITO, HITOS_QUE_AVISAN, cuerpoDelAvance, decidirAvance, hitoPendiente, linkDelTicket, tocaAvisarAvance, type PersonaDelAvance, type TicketDelAvance } from '../lib/tickets-avance';

test('el primer hito siempre avisa: es el que Joan no tuvo', () => {
  assert.equal(tocaAvisarAvance('recibido', null), true);
  assert.equal(tocaAvisarAvance('en_curso', null), true);
});

test('avanzar avisa', () => {
  assert.equal(tocaAvisarAvance('en_curso', 'recibido'), true);
  assert.equal(tocaAvisarAvance('resuelto', 'en_curso'), true);
});

test('el MISMO hito no vuelve a avisar', () => {
  assert.equal(tocaAvisarAvance('en_curso', 'en_curso'), false);
});

test('y volver atrás tampoco: es el correo por rebote', () => {
  // Un ticket que va a «esperando tu respuesta» y vuelve a «en curso» ya avisó ese hito. Sin esta
  // regla, tres rebotes son tres correos iguales.
  assert.equal(tocaAvisarAvance('en_curso', 'tu_respuesta'), false);
  assert.equal(tocaAvisarAvance('recibido', 'resuelto'), false);
});

test('«cerrado» NO manda correo: el final es el WhatsApp que ya existe', () => {
  assert.equal(tocaAvisarAvance('cerrado', 'resuelto'), false);
  assert.equal(tocaAvisarAvance('cerrado', null), false);
  assert.equal(HITOS_QUE_AVISAN.has('cerrado'), false, 'sería el cuarto aviso de lo mismo');
});

test('un hito desconocido en la base no habilita nada', () => {
  // Un valor viejo o escrito a mano: se prefiere no mandar a mandar de más.
  assert.equal(tocaAvisarAvance('en_curso', 'vaya_a_saber' as never), false);
});

test('el correo dice en qué anda y lleva el link, sin jerga', () => {
  const texto = cuerpoDelAvance('en_curso', { id: 43, titulo: 'El botón de pagar no anda' }, 'https://hola-mako.com/');
  assert.match(texto, /Tu ticket #43: El botón de pagar no anda/);
  assert.match(texto, /El equipo lo revisó y ya lo está desarrollando\./);
  // La barra de más de la base no duplica la del link.
  assert.match(texto, /https:\/\/hola-mako\.com\/tickets\?t=43$/);
  assert.equal(ASUNTO_DEL_HITO.en_curso, 'Ya lo estamos desarrollando');
});

test('el link lleva el negocio, como todo link que sale de MaKo', () => {
  assert.equal(linkDelTicket(43, 'https://hola-mako.com/', 30), 'https://hola-mako.com/tickets?t=43&ws=30');
  assert.equal(linkDelTicket(43, 'https://hola-mako.com', null), 'https://hola-mako.com/tickets?t=43');
});

test('a quién le sale: sólo a la persona del negocio que lo levantó y no los apagó (4/11/2026)', () => {
  const t: TicketDelAvance = { id: 1, titulo: 'x', estado: 'nuevo', workspace_id: 30, usuario_id: 2, canal: 'formulario', ref: null, avance_email: null };
  const p: PersonaDelAvance = { id: 2, email: ' P2@Test.com ', workspace_id: 30, estado: 'activo', perfil: {} };
  assert.deepEqual(decidirAvance(t, p, 9), { manda: true, hito: 'recibido', a: 'p2@test.com' });
  const motivo = (tt: Partial<TicketDelAvance>, pp: Partial<PersonaDelAvance> | null = {}) => {
    const d = decidirAvance({ ...t, ...tt }, pp === null ? null : { ...p, ...pp }, 9);
    return d.manda ? 'manda' : d.motivo;
  };
  assert.equal(motivo({ avance_email: 'recibido' }), 'sin_hito');
  assert.equal(motivo({ canal: 'sistema' }), 'automatico');
  assert.equal(motivo({ ref: 'error:abc' }), 'automatico');
  assert.equal(motivo({ workspace_id: 9 }, { workspace_id: 9 }), 'plataforma');
  assert.equal(motivo({}, null), 'sin_persona');
  assert.equal(motivo({ usuario_id: 7 }), 'sin_persona', 'la fila leída tiene que ser la del ticket');
  assert.equal(motivo({}, { workspace_id: 31 }), 'otro_negocio');
  assert.equal(motivo({}, { estado: 'suspendido' }), 'suspendida');
  assert.equal(motivo({}, { email: 'whatsapp:5215511112222' }), 'sin_email');
  assert.equal(motivo({}, { perfil: { ticketsPorEmail: false } }), 'apagado');
  assert.equal(motivo({}, { perfil: { ticketsPorEmail: true } }), 'manda');
});

test('un valor viejo en la columna no habilita nada', () => {
  assert.equal(hitoPendiente({ estado: 'en_curso', avance_email: 'vaya_a_saber' }), null);
  assert.equal(hitoPendiente({ estado: 'rechazado', avance_email: null }), null, 'cerrado no manda correo');
});
