// =============================================================================
// correo-del-ws1-a-la-plataforma — copia la clave de correo de MaKo de la fila del ws1 a la de la plataforma
// =============================================================================
// Uso (el .env.local sale del directorio desde donde se corre; ESCRIBE en esa base, que es PRODUCCIÓN, sólo con
// `--aplicar`):
//   npx tsx --conditions=react-server <este repo>/scripts/correo-del-ws1-a-la-plataforma.mts            ← en seco
//   npx tsx --conditions=react-server <este repo>/scripts/correo-del-ws1-a-la-plataforma.mts --aplicar  ← escribe
//
// Para qué (4/11/2026, Martín: «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako»): desde ese día
// cada negocio manda su email con SU cuenta de Resend, y la de MaKo sólo manda lo que firma MaKo. Hasta ese día la
// `RESEND_API_KEY` de la plataforma vivía en la fila del ws1 —Mauricio, un CLIENTE— y la hidratación la copiaba al entorno.
// El código nuevo la hidrata desde el workspace de la plataforma (lib/credenciales.ts → `esClaveDeCorreoDeLaPlataforma`);
// mientras la plataforma no la tenga, sigue tomándola del ws1 como hasta hoy (y lo grita en el log). Esto la copia.
//
// EL ORDEN, y por qué: se corre ANTES de avisarle a Mauricio que pegue su clave. Si él la pega antes, la fila del ws1 ya
// no es la de MaKo y este script copiaría la de MAURICIO a la plataforma (los avisos de MaKo saldrían por su cuenta).
// Por eso, además de copiar, muestra la evidencia de que la del ws1 es la de MaKo: qué otros negocios tienen el MISMO valor
// («Datos de Mau» copió la de la plataforma al ws4). Sin ninguna copia, se avisa y se decide mirando.
//
// Las reglas, como la de la IA (scripts/ia-del-ws1-a-la-plataforma.mts):
//   · ADITIVO: no borra ni cambia nada del ws1. Mauricio pega la suya encima cuando se le avise.
//   · NO PISA: si la plataforma ya tiene OTRA clave de correo, no se toca y se dice.
//   · IDEMPOTENTE: si la plataforma ya tiene la misma, no hace nada.
//   · Descifra con el AAD del ws1 y `guardarCredencial` vuelve a cifrar con el de la plataforma; después RELEE y compara.
//   · Nunca imprime un valor: sólo nombres de claves, números de workspace y sí/no.
//
// Y MIDE (sólo lectura) qué negocios tienen un dominio cargado sin cuenta de Resend propia: con el código nuevo, sus
// correos dejan de salir hasta que peguen su clave (`SIN_EMAIL_PROPIO`). Es la lista de a quién hay que avisarle.
// =============================================================================
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(process.cwd(), '.env.local'), quiet: true });

const { descifrarSecreto, guardarCredencial, credWsEstricta } = await imp('lib/credenciales.ts');
const { wsSuperAdmin, OWNER_WS } = await imp('lib/workspace.ts');
const { getSupabaseServer } = await imp('lib/supabase.ts');

const APLICAR = process.argv.includes('--aplicar');
const CLAVE = 'RESEND_API_KEY';
const huella = (v: string) => createHash('sha256').update(v.trim()).digest('hex');

/** La clave de correo de cada workspace que la tiene, descifrada (null si no se puede leer). Nunca se imprime. */
async function clavesDeCorreo(): Promise<Map<number, string | null>> {
  const { data, error } = await getSupabaseServer().from('credenciales').select('workspace_id, valor_enc').eq('clave', CLAVE);
  if (error) throw new Error(`no pude leer las credenciales de correo: ${error.message}`);
  const out = new Map<number, string | null>();
  for (const r of (data ?? []) as Array<{ workspace_id: number; valor_enc: string }>) {
    const ws = Number(r.workspace_id);
    out.set(ws, descifrarSecreto(r.valor_enc, ws, CLAVE));
  }
  return out;
}

const plataforma: number = await wsSuperAdmin();
if (plataforma === OWNER_WS) { console.error(`⛔ la plataforma resolvió al ws ${OWNER_WS}: no hay a dónde mover nada.`); process.exit(1); }
const todas = await clavesDeCorreo();
const delWs1 = todas.get(OWNER_WS) ?? null;
const deLaPlataforma = todas.get(plataforma) ?? null;
console.log(`${APLICAR ? 'APLICAR' : 'EN SECO'} · ws${OWNER_WS}: ${delWs1 ? 'tiene' : 'NO tiene'} ${CLAVE} · la plataforma (ws${plataforma}): ${deLaPlataforma ? 'la tiene' : 'NO la tiene'}`);

// La evidencia de que la del ws1 es la de MaKo: otros negocios con el MISMO valor (copias de «Datos de Mau»).
const copias = delWs1 ? [...todas].filter(([ws, v]) => ws !== OWNER_WS && ws !== plataforma && v && huella(v) === huella(delWs1)).map(([ws]) => ws) : [];
if (delWs1) console.log(`  · la del ws${OWNER_WS} está copiada igual en: ${copias.length ? copias.map((w) => `ws${w}`).join(', ') : 'ningún otro negocio (mirar antes de aplicar)'}`);

// Quién se queda sin email con el código nuevo: un dominio cargado y ninguna clave propia (o una que es la de MaKo).
const referencia = deLaPlataforma ?? delWs1;
const { data: dominios, error: errDom } = await getSupabaseServer().from('app_settings').select('workspace_id, value').eq('key', 'resend_domain');
if (errDom) console.error(`  ⛔ no pude leer los dominios cargados: ${errDom.message}`);
else {
  const sinCuenta = ((dominios ?? []) as Array<{ workspace_id: number; value: string | null }>)
    .filter((d) => (d.value ?? '').trim() && Number(d.workspace_id) !== plataforma)
    .filter((d) => {
      const v = todas.get(Number(d.workspace_id));
      return !v || (referencia != null && huella(v) === huella(referencia));
    })
    .map((d) => `ws${d.workspace_id}`);
  console.log(`  · con un dominio cargado y SIN cuenta de Resend propia (sus correos se frenan hasta que peguen su clave): ${sinCuenta.length ? sinCuenta.join(', ') : 'ninguno'}`);
}

if (!delWs1) { console.log(`El ws${OWNER_WS} no tiene ${CLAVE} legible: nada que copiar.`); process.exit(0); }
if (deLaPlataforma) {
  if (huella(deLaPlataforma) === huella(delWs1)) console.log('La plataforma ya tiene la misma: nada que hacer.');
  else console.log(`⚠️ La plataforma ya tiene OTRA ${CLAVE}: no se toca. Si la del ws${OWNER_WS} es la buena, se decide a mano.`);
  process.exit(0);
}
console.log(`  → ${CLAVE} (ws${OWNER_WS}) ⇒ ${CLAVE} (ws${plataforma})`);
if (!APLICAR) { console.log('En seco: no se escribió nada. Con --aplicar se copia.'); process.exit(0); }

await guardarCredencial(plataforma, CLAVE, delWs1, 'email', 'sistema:correo-del-ws1-a-la-plataforma');
const releida = await credWsEstricta(CLAVE, plataforma);
if (releida && huella(releida) === huella(delWs1)) {
  console.log(`  ✓ ${CLAVE} (ws${plataforma}) guardada y releída igual. El ws${OWNER_WS} no se tocó: ya se le puede avisar a Mauricio.`);
  process.exit(0);
}
console.error(`  ⛔ ${CLAVE} (ws${plataforma}): la relectura no coincide`);
process.exit(1);
