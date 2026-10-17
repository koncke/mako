// =============================================================================
// «Movela al viernes» → «la tarea»: MaKo le cambia la fecha a una tarea del Plan por WhatsApp (17/10/2026)
// =============================================================================
// docs/relevo/integraciones.md, decisión 1 (tomada con criterio, sin Martín): `cambiar_fecha_tarea_plan` no existía en main
// (en wip/api-acciones-0910 era sólo HTTP) y por WhatsApp MaKo contestaba que no podía (`SIN_FECHA_DE_TAREA`). Ahora es una
// acción de chat con todos los canales: queda pendiente y una persona la confirma con un «sí». Lo que viaja con el turno lo
// fija tests/agenda-whatsapp.test.ts (ese test ya pedía la herramienta el día que viajara por este canal).
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026), una rotura por vez y vuelta atrás:
//   1. `validarFechaLimite` sin rechazar el pasado ................................... 1 fallo
//   2. `validarFechaLimite` sin rechazar un 31 de febrero ........................... 1 fallo
//   3. la operación sólo por HTTP otra vez ............................................ 1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarFechaLimite } from '../lib/plan-fecha-limite';
import { porId } from '../lib/api-mako/registro';

test('la fecha límite: YYYY-MM-DD, que exista y de hoy en adelante (el día del negocio)', () => {
  assert.equal(validarFechaLimite('2026-10-24', '2026-10-17'), null);
  assert.equal(validarFechaLimite('2026-10-17', '2026-10-17'), null, 'hoy vale');
  assert.match(validarFechaLimite('2025-10-24', '2026-10-17') ?? '', /ya pasó/, 'el año pasado que a veces devuelve el modelo');
  assert.match(validarFechaLimite('2026-02-31', '2026-01-01') ?? '', /no es una fecha que exista/);
  assert.match(validarFechaLimite('24/10/2026', '2026-10-17') ?? '', /YYYY-MM-DD/);
});

test('es una acción de CHAT (una persona la confirma) y viaja por WhatsApp', () => {
  const d = porId('cambiar_fecha_tarea_plan');
  assert.ok(d && d.tipo === 'accion', 'no existe la operación');
  assert.equal(d.tipo === 'accion' ? d.confirmacion : null, 'chat');
  assert.ok(d.canales.includes('whatsapp'), 'sólo por HTTP: por WhatsApp MaKo sigue diciendo que no puede');
  assert.ok(d.parametros?.some((p) => p.nombre === 'quitar'), 'no se puede dejar sin fecha');
});
