// =============================================================================
// #846: el CRON sólo dispara — el número es de cada WhatsApp y la reentrada va en su panel (17/10/2026)
// =============================================================================
// Martín en la revisión con Joan (Fathom 863534246, 20:10): «la parte de reentrada y número no debería configurarse en
// el cron, debería configurarse en el WhatsApp». El NÚMERO ya era de cada mensaje (la cabecera del panel,
// `CabeceraWhatsApp`; el motor: `lineaDelPaso(paso) ?? sec.instance_name`): el del CRON era el de toda la automatización
// repetido, y se fue. La REENTRADA es de toda la automatización: va debajo de cada WhatsApp, rotulada así, y en un flujo
// sin ningún WhatsApp se queda en el CRON (sin ella, un flujo de emails no tendría dónde elegirla).
//
// PROBADO ROMPIÉNDOLO (17/10/2026, arnés `romper.py` + `roturas-846.json`; base 2 / 0). Pasan / fallan:
//   N1 el CRON vuelve a mostrar la reentrada aunque haya WhatsApp                           → 1 / 1
//   N2 FlujoLienzo no le pasa `pieWhatsApp` al editor                                        → 1 / 1
//   N3 el editor del mensaje no lo dibuja                                                    → 1 / 1
//
// Correr: node --import tsx --test tests/cron-solo-disparo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string): string => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ⚠️ 23/10/2026 (Martín por el Cerebro: «SACÁ el desplegable "Una sola vez / otra vez que es reunión": para eso tenemos
// CONDITION»): la reentrada ya no se elige en pantalla, ni en el CRON ni debajo de cada WhatsApp.
test('el panel del CRON ya no tiene el número ni la reentrada', () => {
  const perfil = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
  assert.doesNotMatch(perfil, /Número de WhatsApp por el que sale esta automatización/, 'volvió el «Número» de toda la automatización al CRON');
  assert.doesNotMatch(perfil, /controlReentrada|guardarReentrada|data-reentrada/, 'volvió la reentrada a la pantalla');
});

test('debajo de cada WhatsApp ya no hay reentrada', () => {
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.doesNotMatch(lienzo, /data-pie-whatsapp/);
});
