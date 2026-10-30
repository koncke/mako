// =============================================================================
// Un 429 de Zernio es una PAUSA, no una conexión rota (ticket #34, 30/10/2026)
// =============================================================================
// Código Inmobiliario (ws17) pegó su clave de Zernio a las 12:27Z y conectó Facebook a las 12:29Z. A las 12:30:37Z, en /integraciones:
// «Zernio no contestó (429). Vuelve a conectar con Facebook.» Medido en los logs de producción (vercel logs, 12:25-12:33Z): en ese
// minuto la MISMA clave la usaban el sondeo de conectar (12 a 14 pedidos por minuto), dos lecturas del estado de «Anuncios de Meta»,
// dos cargas de /integraciones con el árbol de Meta por Zernio, el cron alerta-critica y una pasada del barrido de leads (12:30:25).
// El tope de Zernio es 60 pedidos por minuto por equipo (docs.zernio.com/rate-limits). Lo que tiene que pasar:
//
//   1. UN 429 TIENE SU MOTIVO (`pausa`) y su texto dice lo que pasó, nunca «vuelve a conectar»: eso reconectaba algo que andaba.
//   2. EL SONDEO DE CONECTAR ESPERA lo que pidió Zernio (`Retry-After`, entre 5 s y 1 min) y no lo cuenta como falla.
//   3. EL ESTADO DE «ANUNCIOS DE META» lo dice y se relee solo después de la espera (hasta 3 veces).
//
// Probado ROMPIÉNDOLO (30/10/2026): ver el pie de este archivo.
//
// Correr: node --import tsx --test tests/zernio-pausa-429.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { errorDeLecturaZernio, esperaDeLaPausa, MENSAJES_DE_MOTIVO, motivoDeRespuesta } from '../lib/zernio-redes';

const RAIZ = join(__dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');

test('un 429 es una pausa con su texto, nunca «vuelve a conectar»; un 5xx sigue siendo «no contestó»', () => {
  const r = motivoDeRespuesta(429, { error: 'Rate limit exceeded. Please retry after 23 seconds.' });
  assert.equal(r.motivo, 'pausa');
  assert.doesNotMatch(MENSAJES_DE_MOTIVO.pausa, /conect/i, 'el texto no puede mandar a reconectar');
  assert.match(MENSAJES_DE_MOTIVO.pausa, /pausa/);
  assert.equal(motivoDeRespuesta(503, null).motivo, 'sin-red');
});

test('la espera: la que pidió Zernio, entre 5 s y 1 minuto; sin dato, 30 s', () => {
  assert.equal(esperaDeLaPausa(23_000), 23_000);
  assert.equal(esperaDeLaPausa(100), 5_000);
  assert.equal(esperaDeLaPausa(10 * 60_000), 60_000);
  assert.equal(esperaDeLaPausa(null), 30_000);
  assert.equal(esperaDeLaPausa(Number.NaN), 30_000);
});

test('el estado de «Anuncios de Meta»: un 429 lo dice y se relee solo; otro error sí manda a reconectar', () => {
  const p = errorDeLecturaZernio(429, 23_000);
  assert.equal(p.reintentarEnMs, 23_000);
  assert.doesNotMatch(p.error, /conect/i);
  assert.match(p.error, /en 23 segundos/);
  const v = errorDeLecturaZernio(401, null);
  assert.equal(v.reintentarEnMs, null);
  assert.match(v.error, /Vuelve a conectar con Facebook/);
  const m = leer('lib/meta-conexion-zernio.ts');
  assert.match(m, /if \(e instanceof ZernioError\) return \{ \.\.\.conPaginas, \.\.\.errorDeLecturaZernio\(e\.status, e\.esperaMs\) \};/);
  assert.doesNotMatch(m, /`Zernio no contestó \(\$\{e\.status\}\)\. Vuelve a conectar con Facebook\.`/, 'el texto viejo, a mano, no vuelve (ni en «Probar»)');
  assert.match(m, /error: e instanceof ZernioError \? errorDeLecturaZernio\(e\.status, e\.esperaMs\)\.error : 'Zernio no contestó\.'/);
  const c = leer('app/integraciones/ConectarMetaZernio.tsx');
  assert.match(c, /reintentarEnMs\?: number \| null;/, 'el tipo local de la pantalla tiene el campo (la trampa del 24/10)');
  assert.match(c, /const t = setTimeout\(\(\) => \{ void leer\(\); \}, reintentarEnMs\);/);
  assert.match(c, /if \(relecturas\.current >= RELECTURAS_TRAS_PAUSA\) return;/);
});

test('el sondeo de conectar: la pausa espera lo que pidió Zernio y no cuenta como falla; la ruta le pasa la espera', () => {
  const s = leer('app/_components/ConectarViaZernio.tsx');
  assert.match(s, /if \(motivo === 'pausa'\) \{\n(\s+\/\/[^\n]*\n)+\s+ultima = Date\.now\(\) \+ esperaDeLaPausa\(j\?\.esperaMs\) - SONDEO_MS;\n\s+\} else \{\n\s+fallosSeguidos = /);
  const r = leer('app/api/zernio/route.ts');
  assert.match(r, /\.\.\.\(m\.motivo === 'pausa' \? \{ esperaMs: m\.esperaMs \} : \{\}\),/);
  const z = leer('lib/zernio-conectar.ts');
  assert.match(z, /new ZernioConectarError\(r\.motivo, r\.texto \?\? undefined, r\.pagoUrl, r\.motivo === 'pausa' \? e\.esperaMs : null\)/);
});

test('Automations: el selector de publicaciones dice la pausa y relee solo; la ruta le pasa la espera', () => {
  const r = leer('app/api/chat-agent/secuencias/route.ts');
  assert.match(r, /if \(e instanceof ZernioError && e\.status === 429\) return Response\.json\(\{ ok: false, \.\.\.errorDeLecturaZernio\(e\.status, e\.esperaMs\) \}/);
  const p = leer('app/automations/EditorDisparadores.tsx');
  assert.match(p, /espera = setTimeout\(\(\) => setVuelta\(\(v\) => v \+ 1\), x\.reintentarEnMs\);/);
  assert.match(p, /if \(relecturas\.current >= RELECTURAS_TRAS_PAUSA\) \{ setLectura\(\{ \.\.\.x, pausa: MENSAJES_DE_MOTIVO\.pausa \}\); return; \}/, 'sin más relecturas no promete «lo vuelvo a leer»');
  assert.match(p, /lista === null \? \(lectura\?\.pausa \?\? 'No pude leer tus publicaciones\.'\) : null;/);
});

test('Calendario: leer las cuentas en pausa lo dice y no ofrece «Conectar»', () => {
  const p = leer('app/calendario/PublicarEnRed.tsx');
  assert.match(p, /cuentas\.motivo === 'pausa' \? MENSAJES_DE_MOTIVO\.pausa : 'No pude leer tus cuentas conectadas\.'/);
  assert.match(p, /\{cuentas\.motivo === 'pausa'\n\s+\? <Button [^\n]*onClick=\{\(\) => void cargar\(\)\}>Probar de nuevo<\/Button>\n\s+: <Button [^\n]*integracion\.abrir\('zernio'\)/);
});

// ── Probado ROMPIÉNDOLO (30/10/2026) ──────────────────────────────────────────
// Corrido junto con tests/zernio-conectar-redes.test.ts: 28 pases y 0 fallos. Rota, una por vez:
//   · un 429 vuelve a ser «no contestó»              → 26 / 2
//   · el texto de la pausa manda a reconectar        → 27 / 1
//   · la espera sin tope                             → 27 / 1
//   · el estado de Meta vuelve al texto viejo        → 27 / 1
//   · la lectura no se relee sola                    → 27 / 1
//   · la pantalla no relee                           → 27 / 1
//   · el sondeo cuenta la pausa como falla           → 27 / 1
//   · la ruta no pasa la espera                      → 27 / 1
//   · el error de conectar pierde la espera          → 27 / 1
//   · «Probar» manda a reconectar                    → 27 / 1

//   Automations y Calendario (30/10/2026; base 6 / 0): la ruta no dice la pausa → 5 / 1 · la pantalla no relee → 5 / 1 · promete
//   releer cuando ya no relee → 5 / 1 · Calendario ofrece Conectar en la pausa → 5 / 1. Las que corren de verdad: en
//   tests/comentario-publicacion.test.ts y tests/calendario-publicar.test.ts.
