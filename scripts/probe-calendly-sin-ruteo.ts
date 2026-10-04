/**
 * «Calendly: el cliente conecta, no entra nada y no hay ningún error» — tarjeta #174, y
 * Leila lo vio en vivo el 01/10 (00:50:03). Martín sospechó que era el Calendly de
 * Mauricio; la causa es otra y está escrita en el propio webhook.
 *
 * `app/api/webhooks/calendly/route.ts` resuelve el workspace por el EVENT TYPE contra
 * `webhook_routing`, y es fail-CLOSED a propósito (sin mapeo no toca datos, para que el
 * Schedule de un cliente no caiga en el CRM del dueño). Pero los dos campos que crean ese
 * mapeo —`CALENDLY_EVENT_TYPE_J1` y `_J2`— están declarados **OPCIONALES** en
 * `lib/metodo-catalogo.ts`, y el único obligatorio es el token.
 *
 * O sea: conectar Calendly "bien" (sólo el token) deja al cliente sin una sola fila de
 * ruteo, y todos sus webhooks se ignoran sin un error. Esto lo cuenta. SOLO LECTURA.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { getSupabaseServer } from '../lib/supabase';

async function main() {
  const sb = getSupabaseServer();

  const { data: creds, error: eC } = await sb.from('credenciales')
    .select('workspace_id, clave, valor_enc')
    .in('clave', ['CALENDLY_API_TOKEN', 'CALENDLY_EVENT_TYPE_J1', 'CALENDLY_EVENT_TYPE_J2', 'CALENDLY_WEBHOOK_SIGNING_KEY']);
  if (eC) throw new Error('credenciales: ' + eC.message);

  const { data: rut, error: eR } = await sb.from('webhook_routing')
    .select('workspace_id, servicio, identificador').eq('servicio', 'calendly');
  if (eR) throw new Error('webhook_routing: ' + eR.message);

  const real = (v: unknown) => typeof v === 'string' && v.trim() !== '' && !v.trim().startsWith('PENDING');

  const porWs = new Map<number, Set<string>>();
  for (const c of (creds ?? []) as Array<Record<string, unknown>>) {
    if (!real(c.valor_enc)) continue;
    const w = Number(c.workspace_id);
    porWs.set(w, new Set([...(porWs.get(w) ?? []), String(c.clave)]));
  }
  const conRuteo = new Map<number, number>();
  for (const r of (rut ?? []) as Array<Record<string, unknown>>) {
    const w = Number(r.workspace_id);
    conRuteo.set(w, (conRuteo.get(w) ?? 0) + 1);
  }

  console.log('ws · token · J1 · J2 · signing · filas de ruteo · veredicto');
  let rotos = 0;
  const todos = new Set<number>([...porWs.keys(), ...conRuteo.keys()]);
  for (const w of [...todos].sort((a, b) => a - b)) {
    const s = porWs.get(w) ?? new Set<string>();
    const tok = s.has('CALENDLY_API_TOKEN');
    const j1 = s.has('CALENDLY_EVENT_TYPE_J1');
    const j2 = s.has('CALENDLY_EVENT_TYPE_J2');
    const sig = s.has('CALENDLY_WEBHOOK_SIGNING_KEY');
    const filas = conRuteo.get(w) ?? 0;
    // Conectó (tiene token) y no tiene por dónde entrar: sus webhooks se ignoran.
    const roto = tok && filas === 0;
    if (roto) rotos++;
    console.log(
      `${String(w).padStart(3)} ·   ${tok ? 'sí' : '· '}   · ${j1 ? 'sí' : '· '} · ${j2 ? 'sí' : '· '} ·   ${sig ? 'sí' : '· '}   ·      ${String(filas).padStart(2)}       · `
      + (roto ? '⛔ CONECTÓ Y SE IGNORA TODO' : tok ? 'ok' : 'no conectó'),
    );
  }
  const conectados = [...todos].filter((w) => (porWs.get(w) ?? new Set()).has('CALENDLY_API_TOKEN')).length;
  console.log(`\n═══ ${rotos} de ${conectados} workspaces con Calendly conectado no tienen NINGUNA fila de ruteo: su webhook se ignora sin error ═══`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
