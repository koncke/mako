// =============================================================================
// voz-mako-agregar — agrega «David» (la Voz de MaKo de los VSL) a la cuenta de ElevenLabs de la PLATAFORMA
// =============================================================================
// La Voz de MaKo (lib/voz-mako-reglas.ts, `VOZ_MAKO`) es «David», una voz COMPARTIDA de la biblioteca de
// ElevenLabs: medido el 11/10/2026, NO está en la cuenta de la plataforma. Este script la agrega con la key de
// la Voz de MaKo (`MAKO_ELEVENLABS_API_KEY`, la env nueva a propósito: lib/voz-mako.ts explica por qué no es
// la de siempre). Es API externa y gratis: agregar una voz compartida no cobra caracteres. NO genera audio.
//
//   npx tsx scripts/voz-mako-agregar.mts --env=<ruta del .env.local>            → SIMULACRO (default): sólo lee
//   npx tsx scripts/voz-mako-agregar.mts --env=<ruta del .env.local> --aplicar  → la agrega si falta
//
// Qué hace, en orden:
//   1. lee la key (nunca la imprime); sin ella, lo dice y no hace nada;
//   2. GET /v1/user/subscription: si la cuenta debe una factura (past_due, unpaid…), FRENA: ElevenLabs deja
//      escribir metadatos con la cuenta impaga y no deja generar (medido el 22/08/2026, lib/elevenlabs.ts), así
//      que agregarla sin pagar daría un verde falso. Un 401 por permiso (`user_read`) no frena: se avisa;
//   3. GET /v1/voices/<id>: 200 = ya está, no hay nada que hacer; 404 = falta;
//   4. con --aplicar y 404: POST /v1/voices/add/<dueño público>/<id> { new_name: 'Voz de MaKo' } y se RELEE
//      (GET /v1/voices/<id> tiene que dar 200). Si ElevenLabs le diera otro id, lo dice: hay que cambiar
//      `VOZ_MAKO.voiceId`.
//
// ⚠️ VA DESPUÉS DEL PAGO (docs/diseno-undecima-tanda.md §8.3 y §8.5.3): hoy la cuenta está past_due (US$6).
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
const rutaEnv = arg('env') ?? '.env.local';
config({ path: rutaEnv, quiet: true });

const { VOZ_MAKO, DUENO_PUBLICO_VOZ_MAKO, ENV_VOZ_MAKO } = await import('../lib/voz-mako-reglas');
const { clasificarEleven } = await import('../lib/elevenlabs-fallo');

const API = 'https://api.elevenlabs.io/v1';
const IMPAGAS = new Set(['past_due', 'unpaid', 'incomplete', 'incomplete_expired', 'canceled']);

console.log(`voz-mako-agregar · ${aplicar ? 'APLICAR' : 'SIMULACRO'} · ${new Date().toISOString()}`);
console.log(`voz: ${VOZ_MAKO.voiceId} (dueño público ${DUENO_PUBLICO_VOZ_MAKO.slice(0, 8)}…)`);

const key = (process.env[ENV_VOZ_MAKO] ?? '').trim();
if (!key) {
  console.log(`✗ falta ${ENV_VOZ_MAKO} en ${rutaEnv}: no se lee nada ni se agrega nada.`);
  console.log('  Primero: pagar la factura abierta de ElevenLabs y cargar la env en Vercel Production y en .env.local.');
  process.exit(2);
}

async function pedir(ruta: string, init: RequestInit = {}): Promise<{ status: number; texto: string }> {
  const r = await fetch(`${API}${ruta}`, {
    ...init,
    headers: { 'xi-api-key': key, accept: 'application/json', ...(init.headers as Record<string, string> | undefined) },
    signal: AbortSignal.timeout(30_000),
  });
  return { status: r.status, texto: await r.text() };
}
const json = (t: string): Record<string, unknown> => { try { return JSON.parse(t) as Record<string, unknown>; } catch { return {}; } };

// 2. La cuenta.
const sub = await pedir('/user/subscription');
if (sub.status === 200) {
  const s = json(sub.texto);
  console.log(`cuenta: plan ${String(s.tier ?? '?')} · estado ${String(s.status ?? '?')} · caracteres ${String(s.character_count ?? '?')}/${String(s.character_limit ?? '?')}`);
  if (IMPAGAS.has(String(s.status ?? ''))) {
    console.log(`✗ la cuenta está «${String(s.status)}»: hasta pagar, ElevenLabs no deja generar. No se agrega nada.`);
    process.exit(1);
  }
} else {
  const c = clasificarEleven(sub.status, sub.texto);
  if (c.motivo === 'impago') { console.log(`✗ ElevenLabs dice que hay un pago pendiente: ${c.error}`); process.exit(1); }
  console.log(`· no se pudo leer la suscripción (${sub.status}, ${c.motivo}): ${c.error}`);
}

// 3. ¿Ya está?
const antes = await pedir(`/voices/${encodeURIComponent(VOZ_MAKO.voiceId)}`);
if (antes.status === 200) {
  console.log(`✓ la voz ya está en la cuenta: «${String(json(antes.texto).name ?? '')}». Nada que hacer.`);
  process.exit(0);
}
if (antes.status !== 404) {
  const c = clasificarEleven(antes.status, antes.texto);
  console.log(`✗ no se pudo mirar la voz (${antes.status}, ${c.motivo}): ${c.error}`);
  process.exit(1);
}
console.log('· la voz NO está en la cuenta (404).');

if (!aplicar) {
  console.log(`SIMULACRO: con --aplicar haría POST /v1/voices/add/${DUENO_PUBLICO_VOZ_MAKO.slice(0, 8)}…/${VOZ_MAKO.voiceId} { new_name: 'Voz de MaKo' } y releería.`);
  process.exit(0);
}

// 4. Agregarla y releer.
const add = await pedir(`/voices/add/${encodeURIComponent(DUENO_PUBLICO_VOZ_MAKO)}/${encodeURIComponent(VOZ_MAKO.voiceId)}`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ new_name: 'Voz de MaKo' }),
});
if (add.status < 200 || add.status >= 300) {
  const c = clasificarEleven(add.status, add.texto);
  console.log(`✗ ElevenLabs no la agregó (${add.status}, ${c.motivo}): ${c.error}`);
  process.exit(1);
}
const nuevoId = String(json(add.texto).voice_id ?? '');
if (nuevoId && nuevoId !== VOZ_MAKO.voiceId) {
  console.log(`⚠ ElevenLabs la agregó con OTRO id (${nuevoId}): hay que cambiar VOZ_MAKO.voiceId en lib/voz-mako-reglas.ts.`);
}
const despues = await pedir(`/voices/${encodeURIComponent(nuevoId || VOZ_MAKO.voiceId)}`);
if (despues.status !== 200) {
  console.log(`✗ la agregó (${add.status}) pero al releer da ${despues.status}: no está confirmada.`);
  process.exit(1);
}
console.log(`✓ agregada y releída: «${String(json(despues.texto).name ?? '')}» (${nuevoId || VOZ_MAKO.voiceId}).`);
