#!/usr/bin/env node
// =============================================================================
// creem-aviso-estado.mts — ¿el aviso de Creem de una cuenta lleva su `?w=`? (SÓLO LECTURA)
// =============================================================================
// Uso:  node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/creem-aviso-estado.mts [ws]
//       (sin `ws` pregunta por el workspace del super admin, que es el que cobra los planes de MaKo)
//
// POR QUÉ (31/10/2026): Martín conectó Creem en producción a las 19:22 UTC con el código viejo y la URL del aviso
// quedó SIN su `?w=`. La ruta `app/api/webhooks/creem/route.ts` saca de ahí el workspace
// (`wsPorIdentificadorEstricto`) y con él el secreto que verifica la firma: sin el parámetro, rechaza TODOS los
// avisos con 401 — y Creem abandona a las 24 h. No hay ningún error a la vista: la cuenta figura «conectada», el
// checkout cobra, y el pago no entra nunca. Esto es la comprobación que faltaba.
//
// `mantenerAvisosCreem` (lib/cobros.ts) lo repara solo en cada vuelta del cron `cobros-reconciliar` (:17 y :47).
// Este script NO escribe: sirve para saber si hace falta y para comprobar que la reparación ocurrió.
//
// ⚠️ `--conditions=react-server` es obligatorio: `lib/cuentas-pago-server.ts` arrastra `server-only`, que tira
// «This module cannot be imported from a Client Component module» sin esa condición.
//
// No imprime la clave ni el secreto: sólo el id del aviso, la URL registrada y el veredicto.
// =============================================================================
import { cuentasDePago, credCreemDe } from '../lib/cuentas-pago-server';
import { wsSuperAdmin } from '../lib/workspace';

const pedido = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const WS = pedido ? Number(pedido) : await wsSuperAdmin();

const cuentas = (await cuentasDePago(WS, 'creem')).filter((c) => c.conectada);
if (!cuentas.length) {
  console.log(`ws ${WS}: ninguna cuenta de Creem conectada`);
  process.exit(0);
}

let roto = 0;
for (const x of cuentas) {
  const cred = await credCreemDe(WS, x.cuenta);
  if (!cred) { console.log(`· ${x.cuenta}: figura conectada pero no se pudieron leer sus credenciales`); roto++; continue; }
  const r = await fetch(`https://api.creem.io/v1/webhooks/${encodeURIComponent(cred.webhookId)}`, { headers: { 'x-api-key': cred.key } });
  const cuerpo = await r.text();
  if (!r.ok) { console.log(`· ${x.cuenta}: Creem contestó ${r.status} al leer el aviso ${cred.webhookId} — ${cuerpo.slice(0, 160)}`); roto++; continue; }
  let url: string | null = null;
  try { url = (JSON.parse(cuerpo) as { url?: string }).url ?? null; } catch { /* lo dice el veredicto */ }
  const ok = !!url && url.endsWith(`?w=${encodeURIComponent(cred.webhookId)}`);
  if (!ok) roto++;
  console.log(`· ${x.cuenta} · aviso ${cred.webhookId}`);
  console.log(`  URL registrada: ${url ?? '(no vino en la respuesta)'}`);
  console.log(`  ${ok ? 'OK — lleva su ?w=, los avisos entran' : 'ROTO — le falta el ?w=, los avisos rebotan con 401'}`);
}
process.exit(roto ? 1 : 0);
