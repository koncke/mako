// =============================================================================
// Recrear la suscripción del webhook de Calendly (19/09/2026)
// =============================================================================
// Calendly DESHABILITA una suscripción tras días de entregas fallidas y no deja
// reactivarla: hay que borrarla y crear otra. La de MaKo quedó `disabled` con
// los reintentos empezando el 11/09 13:36 UTC, y desde entonces no entró una
// sola reserva al CRM (6 perdidas al 19/09).
//
// Qué hace, EN ESTE ORDEN (el orden es el arreglo, no un detalle):
//   1. Borra la suscripción vieja PRIMERO. Calendly rechaza con 409 «Hook with
//      this url already exists» si ya hay una con esa URL, aunque esté
//      deshabilitada (medido el 19/09). El hueco es de segundos y la vieja no
//      entregaba nada.
//   2. Genera una signing key nueva (64 hex) y crea la suscripción CON esa key
//      (Calendly acepta `signing_key`), así los dos lados coinciden desde el
//      primer envío. Si la vieja falló por un desajuste de clave, esto lo
//      elimina como causa.
//   3. La guarda en `credenciales` del ws con guardarCredencial(), la misma
//      función que usa /integraciones. NUNCA en .env.local: ese archivo apunta
//      a la Supabase de PRODUCCIÓN y `npm run dev` la copiaría como si fuera
//      la firma. Y al ser propia del ws —ya no la copia de la env de
//      plataforma— cierra de paso la forja cross-tenant que estaba anotada
//      como pendiente en docs/estado-del-arte.md.
//   4. Verifica de punta a punta con un POST FIRMADO cuyo cuerpo SÍ resuelve el
//      workspace (lleva el nombre del event type): 400 `incomplete_payload` = la
//      firma del ws validó, y el route no tocó un solo dato. Un evento inventado
//      NO sirve de prueba: se verifica contra la clave de plataforma. El porqué,
//      en el paso 4 del cuerpo.
//
// Uso (--conditions=react-server neutraliza `server-only` fuera de Next):
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/arreglar-webhook-calendly.ts --dry
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/arreglar-webhook-calendly.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomBytes, createHmac } from 'node:crypto';

config({ path: resolve(process.cwd(), '.env.local') });

import { guardarCredencial, credWs } from '../lib/credenciales';

const API = 'https://api.calendly.com';
const URL_WEBHOOK = 'https://hola-mako.com/api/webhooks/calendly';
const EVENTOS = ['invitee.created', 'invitee.canceled'];
const WS = 1; // Mauricio
const DRY = process.argv.includes('--dry');

const token = process.env.CALENDLY_API_TOKEN;
if (!token) throw new Error('Falta CALENDLY_API_TOKEN en .env.local');
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

async function api(path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, { ...init, headers: { ...H, ...(init?.headers ?? {}) } });
  const txt = await r.text();
  let json: unknown = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* respuesta no-JSON */ }
  return { ok: r.ok, status: r.status, json: json as any, txt };
}

async function main() {
  const me = await api('/users/me');
  if (!me.ok) throw new Error(`users/me ${me.status}: ${me.txt.slice(0, 200)}`);
  const org = me.json.resource.current_organization as string;
  console.log(`cuenta: ${me.json.resource.name} · org ${org.split('/').pop()}`);

  // Estado actual
  const q = new URLSearchParams({ organization: org, scope: 'organization', count: '20' });
  const antes = await api(`/webhook_subscriptions?${q}`);
  const nuestras = (antes.json?.collection ?? []).filter((w: any) => w.callback_url === URL_WEBHOOK);
  console.log(`suscripciones a ${URL_WEBHOOK}: ${nuestras.length}`);
  for (const w of nuestras) console.log(`  - ${w.state} · creada ${w.created_at?.slice(0, 10)} · reintentos desde ${w.retry_started_at ?? '—'}`);

  const claveVieja = await credWs('CALENDLY_WEBHOOK_SIGNING_KEY', WS);
  console.log(`clave guardada en el ws ${WS}: ${claveVieja ? `sí (${claveVieja.length} caracteres)` : 'NO'}`);

  if (DRY) { console.log('\n--dry: no se creó ni borró nada.'); return; }

  // 1) Borrar la vieja PRIMERO: Calendly rechaza con 409 «Hook with this url
  //    already exists» si ya hay una suscripción con esa URL, aunque esté
  //    deshabilitada. Medido el 19/09. El hueco es de segundos y la vieja no
  //    entrega nada desde el 11/09.
  for (const w of nuestras) {
    const del = await api(`/webhook_subscriptions/${w.uri.split('/').pop()}`, { method: 'DELETE' });
    console.log(`✔ vieja (${w.state}) borrada: ${del.status}`);
  }

  // 2) Clave nueva + suscripción nueva con esa clave
  const clave = randomBytes(32).toString('hex');
  const creada = await api('/webhook_subscriptions', {
    method: 'POST',
    body: JSON.stringify({ url: URL_WEBHOOK, events: EVENTOS, organization: org, scope: 'organization', signing_key: clave }),
  });
  if (!creada.ok) throw new Error(`crear ${creada.status}: ${creada.txt.slice(0, 300)}`);
  const nueva = creada.json.resource;
  console.log(`\n✔ suscripción nueva: ${nueva.state} · ${nueva.uri.split('/').pop()} · eventos ${(nueva.events ?? []).join(', ')}`);

  // 3) Guardar la clave donde la lee el route (misma función que /integraciones)
  await guardarCredencial(WS, 'CALENDLY_WEBHOOK_SIGNING_KEY', clave, 'calendly', 'script:arreglar-webhook-calendly');
  const guardada = await credWs('CALENDLY_WEBHOOK_SIGNING_KEY', WS);
  console.log(`✔ clave guardada en credenciales del ws ${WS}: ${guardada === clave ? 'coincide' : '⚠ NO coincide'}`);

  // 4) Verificación de punta a punta.
  //
  // ⚠️ EL CUERPO DE LA PRUEBA TIENE QUE RESOLVER EL WORKSPACE, o no prueba nada.
  // El route resuelve el ws por `scheduled_event.name/event_type/uri` contra
  // webhook_routing ANTES de verificar, y recién entonces elige con qué clave:
  // `keyWs = ws == null ? null : credWs(...)` y `signingKey = keyWs ?? envCred(...)`.
  // O sea que un evento inventado —que no rutea a nadie— se compara contra la
  // clave de PLATAFORMA (la env var de Vercel), NO contra la del ws que este
  // script acaba de guardar: da 401 «Firma no coincide» con el arreglo perfecto.
  // Pasó el 19/09/2026 y costó dar por fallado un arreglo que estaba bien.
  //
  // Por eso el cuerpo lleva el NOMBRE del event type mapeado a este ws y nada
  // más: resuelve ws, valida la firma, y muere en `incomplete_payload` (400)
  // antes de tocar un solo dato.
  const nombreRuteo = (await credWs('CALENDLY_EVENT_TYPE_J1', WS)) ?? '';
  const cuerpo = JSON.stringify({
    event: 'invitee.created',
    payload: { scheduled_event: { name: nombreRuteo } },
  });

  async function firmado(etiqueta: string, conClave: string) {
    const t = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', conClave).update(`${t}.${cuerpo}`).digest('hex');
    const r = await fetch(URL_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Calendly-Webhook-Signature': `t=${t},v1=${firma}` },
      body: cuerpo,
    });
    const txt = await r.text();
    console.log(`  ${etiqueta}: ${r.status} ${txt.slice(0, 120)}`);
    return r.status;
  }

  console.log(`\nprueba firmada (event type «${nombreRuteo}»):`);
  const bien = await firmado('clave del ws  ', clave);
  // Probado rompiéndolo (19/09/2026): con la clave del ws da 400
  // incomplete_payload y con una inventada da 401 «Firma no coincide». Sin este
  // segundo tiro, un 400 por cualquier otro motivo se leería como éxito.
  const mal = await firmado('clave inventada', 'x'.repeat(64));
  console.log(
    bien === 400 && mal === 401
      ? '✔ la firma del ws valida contra producción (y una firma mala se rechaza)'
      : '⚠ revisar: se esperaba 400 con la clave del ws y 401 con la inventada',
  );
}

main().catch((e) => { console.error('ERROR:', e instanceof Error ? e.message : e); process.exit(1); });
