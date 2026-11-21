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
import { SETTINGS_DE_LOS_COACHES, TABLAS_DE_LOS_CHATS, WS_SE_VACIAN_LOS_CHATS, seVacianLosChats } from '../lib/reset-chats-prueba-reglas';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. qué se vacía: los mensajes, los chats y la conversación de Offer; y el estado de los coaches. El grupo de avisos, no', () => {
  assert.deepEqual([...TABLAS_DE_LOS_CHATS], ['chart_chats', 'chart_sessions', 'offer_sesiones', 'image_editor_chats', 'video_editor_chats'], 'los mensajes antes que los chats, y los de los editores');
  // Cada tabla de la que la lista lateral junta chats de editores, adentro (21/11, producción: quedaba «Image Editor»).
  const indice = fuente('lib/chat-mako-indice.ts');
  for (const t of [...indice.matchAll(/tabla: '([a-z_]+_chats)'/g)].map((m) => m[1])) assert.ok((TABLAS_DE_LOS_CHATS as readonly string[]).includes(t), `RESET no vacía ${t}`);
  // Y lo que no pudo borrar se DICE (antes la ruta contestaba ok y el botón no miraba los avisos).
  assert.match(sinComentarios(fuente('app/_components/ReiniciarOnboarding.tsx')), /if \(j\.chats\?\.avisos\?\.length\)/);
  assert.deepEqual([...SETTINGS_DE_LOS_COACHES], ['onboarding_v2.offer_coach', 'funnel_coach.plan']);
  assert.ok(!TABLAS_DE_LOS_CHATS.some((t) => t.startsWith('grupo_')), 'el grupo de avisos queda');
});

// URGENTE (21/11, el Cerebro): el ws 9 es de la revisión pero es el espacio de MARTÍN (su Ops Center con los chats de Claude, su Second
// Brain, sus leads), y el 11 es Leila, una clienta. El borrado completo, sólo en una lista CERRADA escrita en el código.
test('0. el borrado completo NUNCA en el ws 9 (Martín) ni en el 11 (Leila): sólo en la lista cerrada, 3 y 4', () => {
  assert.deepEqual([...WS_SE_VACIAN_LOS_CHATS], [3, 4]);
  for (const ws of [9, 11, 1, 21, null, undefined]) assert.equal(seVacianLosChats(ws), false, `ws ${ws}`);
  assert.equal(seVacianLosChats(3), true);
  const s = sinComentarios(fuente('lib/reset-chats-prueba.ts'));
  assert.doesNotMatch(s, /esClienteDePrueba|puedeVerLaRevision|WS_PRUEBA_COMO_CLIENTE/, 'ninguna lista que otro amplíe');
  const r = sinComentarios(fuente('app/api/admin/reiniciar-onboarding/route.ts'));
  assert.doesNotMatch(r, /esClienteDePrueba\(ws\)\) chats|puedeVerLaRevision/, 'la ruta, con la lista cerrada');
});

test('2. sólo en un espacio de PRUEBA, y siempre por el workspace', () => {
  const s = sinComentarios(fuente('lib/reset-chats-prueba.ts'));
  assert.match(s, /if \(!seVacianLosChats\(ws\)\) throw new Error\(/, 'tira fuera de la lista cerrada (el cinturón que vale)');
  assert.match(s, /\.from\(t\)\.delete\(\{ count: 'exact' \}\)\.eq\('workspace_id', ws\)/, 'cada borrado, con el workspace a mano');
  assert.match(s, /getSupabaseServer\(\)/, 'crudo, con el .eq a mano (getTenantDb mira el workspace del pedido, no el destino)');
  const r = sinComentarios(fuente('app/api/admin/reiniciar-onboarding/route.ts'));
  assert.match(r, /if \(body\.aplicar === true && seVacianLosChats\(ws\)\) chats = await vaciarChatsDePrueba\(ws\);/, 'la ruta lo hace sólo en la lista cerrada');
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
