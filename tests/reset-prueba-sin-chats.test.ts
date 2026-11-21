// =============================================================================
// RESET EN UN ESPACIO DE PRUEBA: COMO UNA CUENTA RECIÉN CREADA (21/11/2026, Martín en producción, por el Cerebro: puntos 7 y 9)
// =============================================================================
// «no entiendo por qué en el cliente de prueba hay un chat que dice Image Editor… si le di a reset y comenzamos de cero», y Offer Coach
// con mensajes de «Ayer». En los espacios de PRUEBA (3 y 9) RESET borra todos los chats (los sueltos y el historial de los coaches); los
// fijos del recorrido vuelven solos como nuevos (se crean al entrar), y el grupo de avisos vive en sus propias tablas (no se toca). En un
// cliente real, RESET sigue sin tocar nada de lo suyo.
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_DE_LOS_COACHES, TABLAS_DE_LOS_CHATS } from '../lib/reset-chats-prueba-reglas';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. qué se vacía: los mensajes, los chats y la conversación de Offer; y el estado de los coaches. El grupo de avisos, no', () => {
  assert.deepEqual([...TABLAS_DE_LOS_CHATS], ['chart_chats', 'chart_sessions', 'offer_sesiones'], 'los mensajes antes que los chats');
  assert.deepEqual([...SETTINGS_DE_LOS_COACHES], ['onboarding_v2.offer_coach', 'funnel_coach.plan']);
  assert.ok(!TABLAS_DE_LOS_CHATS.some((t) => t.startsWith('grupo_')), 'el grupo de avisos queda');
});

test('2. sólo en un espacio de PRUEBA, y siempre por el workspace', () => {
  const s = sinComentarios(fuente('lib/reset-chats-prueba.ts'));
  assert.match(s, /if \(!esClienteDePrueba\(ws\)\) throw new Error\(/, 'tira fuera de un negocio de prueba (el cinturón que vale)');
  assert.match(s, /\.from\(t\)\.delete\(\{ count: 'exact' \}\)\.eq\('workspace_id', ws\)/, 'cada borrado, con el workspace a mano');
  assert.match(s, /getSupabaseServer\(\)/, 'crudo, con el .eq a mano (getTenantDb mira el workspace del pedido, no el destino)');
  const r = sinComentarios(fuente('app/api/admin/reiniciar-onboarding/route.ts'));
  assert.match(r, /if \(body\.aplicar === true && esClienteDePrueba\(ws\)\) chats = await vaciarChatsDePrueba\(ws\);/, 'la ruta lo hace sólo en uno de prueba');
});

test('3. el botón lo dice: en uno de prueba «borra todo», en un cliente real «no borra nada de lo suyo»', () => {
  const b = sinComentarios(fuente('app/_components/ReiniciarOnboarding.tsx'));
  assert.match(b, /export const TEXTO_RESET_PRUEBA = 'Borra todo y empieza el onboarding de cero[^']*';/);
  assert.match(b, /dePrueba \? TEXTO_RESET_PRUEBA : TEXTO_REINICIAR/);
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026): sin el cinturón de prueba → 2; la ruta vaciando también en un cliente real → 2; el texto de siempre en
// el de prueba → 3.
// ─────────────────────────────────────────────────────────────────────────────
