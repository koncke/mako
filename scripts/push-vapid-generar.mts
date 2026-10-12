// =============================================================================
// push-vapid-generar — genera UNA vez el par VAPID de los Web Push de MaKo Mobile
// =============================================================================
// Uso (desde la raíz del repo; ESCRIBE en la base de .env.local, que es PRODUCCIÓN):
//   npx tsx --conditions=react-server scripts/push-vapid-generar.mts
//
// Qué hace, en orden, y por qué así:
//   1. Si ya hay un par LEGIBLE en `credenciales` del workspace de plataforma → no toca nada.
//   2. Si hay una FILA pero no se puede descifrar (otro CREDENCIALES_SECRET) → ABORTA. Pisarla
//      dejaría todas las suscripciones firmadas con una clave que ya no existe; el arreglo es
//      correr esto con el secreto correcto, no regenerar.
//   3. Si no hay fila → genera con `webpush.generateVAPIDKeys()`, cifra con el MISMO
//      `cifrarSecreto(valor, ws, clave)` que lee `credWsEstricta`, e INSERTA SI NO EXISTE
//      (`upsert` con `ignoreDuplicates`: ON CONFLICT DO NOTHING). NUNCA `guardarCredencial`,
//      que hace un upsert que PISA: dos corridas a la vez partirían el par.
//   4. RELEE con `credWsEstricta` y comprueba el round-trip: que lo que quedó en la base es
//      un par válido y que firma (un JWT VAPID de prueba). Si lo que quedó es de OTRA corrida
//      que ganó la carrera, se usa ése: el que manda es la base.
//
// El par va en UNA fila (JSON {publicKey, privateKey}) para que nunca quede partido. Vive en
// el workspace de PLATAFORMA (`wsSuperAdmin()`), nunca en el ws1 (`OWNER_WS` es un cliente).
// =============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const webpushMod = await import('web-push');
const webpush = (webpushMod.default ?? webpushMod) as typeof import('web-push');
const { credWsEstricta, cifrarSecreto, auditarCredencial } = await imp('lib/credenciales.ts');
const { wsSuperAdmin } = await imp('lib/workspace.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');
const { CLAVE_VAPID } = await imp('lib/push.ts');

type Par = { publicKey: string; privateKey: string };
const parValido = (v: unknown): v is Par => !!v && typeof v === 'object'
  && typeof (v as Par).publicKey === 'string' && (v as Par).publicKey.length > 40
  && typeof (v as Par).privateKey === 'string' && (v as Par).privateKey.length > 20;

/** Prueba que el par FIRMA: arma los headers VAPID de un envío a un endpoint de FCM. */
function firma(par: Par): boolean {
  try {
    const h = webpush.getVapidHeaders('https://fcm.googleapis.com', 'mailto:equipo@hola-mako.com', par.publicKey, par.privateKey, 'aes128gcm');
    return typeof h.Authorization === 'string' && h.Authorization.startsWith('vapid t=');
  } catch {
    return false;
  }
}

async function leer(ws: number): Promise<Par | null> {
  const crudo = await credWsEstricta(CLAVE_VAPID, ws);
  if (!crudo) return null;
  try { const o = JSON.parse(crudo); return parValido(o) ? o : null; } catch { return null; }
}

const ws: number = await wsSuperAdmin();
console.log(`workspace de plataforma: ${ws}`);

const ya = await leer(ws);
if (ya) {
  console.log(`✓ ${CLAVE_VAPID} ya existe y se lee (pública: ${ya.publicKey.slice(0, 12)}…, ${ya.publicKey.length} caracteres). No se toca. Firma: ${firma(ya) ? 'sí' : 'NO'}`);
  process.exit(firma(ya) ? 0 : 1);
}

const db = getSupabaseServer();
const { data: fila, error: errFila } = await db.from('credenciales').select('clave').eq('workspace_id', ws).eq('clave', CLAVE_VAPID).maybeSingle();
if (errFila) { console.error(`⛔ no pude mirar la fila: ${errFila.message}`); process.exit(1); }
if (fila) {
  console.error(`⛔ HAY una fila ${CLAVE_VAPID} en el ws ${ws} y NO se puede leer (otro CREDENCIALES_SECRET, o JSON roto). NO se regenera: pisarla invalida todas las suscripciones. Correr con el secreto que la cifró.`);
  process.exit(1);
}

const par = webpush.generateVAPIDKeys();
const valor = JSON.stringify({ publicKey: par.publicKey, privateKey: par.privateKey });
const { error: errIns } = await db.from('credenciales').upsert(
  { workspace_id: ws, clave: CLAVE_VAPID, valor_enc: cifrarSecreto(valor, ws, CLAVE_VAPID), servicio: 'web-push', updated_by: 'sistema:push', updated_at: new Date().toISOString() },
  { onConflict: 'workspace_id,clave', ignoreDuplicates: true },
);
if (errIns) { console.error(`⛔ no pude insertar: ${errIns.message}`); process.exit(1); }
await auditarCredencial(ws, CLAVE_VAPID, 'guardar', 'sistema:push');

const releido = await leer(ws);
if (!releido) { console.error('⛔ RELECTURA FALLÓ: la fila no se lee después de insertarla.'); process.exit(1); }
const esElMio = releido.publicKey === par.publicKey && releido.privateKey === par.privateKey;
console.log(`${esElMio ? '✓ generado e insertado' : '⚠ otra corrida ganó la carrera: queda la suya'} — pública ${releido.publicKey.slice(0, 12)}… (${releido.publicKey.length} caracteres), round-trip ${esElMio ? 'idéntico' : 'de la otra corrida'}, firma: ${firma(releido) ? 'sí' : 'NO'}`);
process.exit(firma(releido) ? 0 : 1);
