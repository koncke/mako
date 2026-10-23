// =============================================================================
// medir-rendimiento — cuánto tarda, en el server, cada lectura de las pantallas grandes. SOLO LEE.
//   NODE_OPTIONS="--conditions=react-server" node --import tsx scripts/medir-rendimiento.mts <ws> [pantalla]
// Cada pieza se mide sola (en serie, para que no se pisen) y después el GET entero como lo arma la ruta.
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getWorkspace } from '../lib/workspace';

const WS = Number(process.argv[2] || 1);
const PANTALLA = process.argv[3] || 'automations';

async function t<T>(nombre: string, fn: () => Promise<T>): Promise<T | undefined> {
  const t0 = performance.now();
  try {
    const r = await fn();
    console.log(`  ${String(Math.round(performance.now() - t0)).padStart(6)} ms  ${nombre}`);
    return r;
  } catch (e) {
    console.log(`  ${String(Math.round(performance.now() - t0)).padStart(6)} ms  ${nombre}  ✗ ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    return undefined;
  }
}

async function automations() {
  const ss = await import('../lib/setting-secuencias');
  const { getFunnelDefault } = await import('../lib/funnels');
  const { getEntregables } = await import('../lib/entregable');
  const { getInstanciaRow, motivoCaida } = await import('../lib/evolution');
  const { tzActual } = await import('../lib/timezone');
  const { handoffsPendientes } = await import('../lib/chat-agent-handoff');
  const { envioWhatsappHabilitadoEstricto } = await import('../lib/envio-flags');
  await t('calentar (getTenantDb)', async () => (await import('../lib/workspace')).getTenantDb());
  await t('getSettingData', () => ss.getSettingData());
  await t('getFunnelDefault', () => getFunnelDefault());
  await t('getEntregables', () => getEntregables());
  await t('getWorkspace', () => getWorkspace(WS));
  const inst = await t('getInstanciaRow', () => getInstanciaRow());
  console.log(`          instancia: ${inst ? `${inst.estado}` : inst}`);
  if (inst && inst.estado !== 'conectado') await t('motivoCaida (Evolution, tope 4 s)', () => motivoCaida(inst.instance_name, 4000));
  await t('productosConEtapas', () => ss.productosConEtapas());
  await t('tzActual', () => tzActual());
  await t('handoffsPendientes', () => handoffsPendientes());
  await t('envioWhatsappHabilitadoEstricto', () => envioWhatsappHabilitadoEstricto());
}

async function crm() {
  const { listLeadsDeFunnel } = await import('../lib/leads');
  const filas = await t('listLeadsDeFunnel(null) — el tablero entero', () => listLeadsDeFunnel(null));
  console.log(`          ${filas?.length ?? '?'} leads`);
}

async function centro() {
  const { leerPushes } = await import('../lib/progreso');
  await t('leerPushes (API de Vercel, tope 8 s)', () => leerPushes());
  await t('leerPushes, otra vez', () => leerPushes());
}

const PANTALLAS: Record<string, () => Promise<void>> = { automations, crm, centro };

async function main() {
  console.log(`ws${WS} · ${PANTALLA}`);
  await runWithWorkspace(WS, () => PANTALLAS[PANTALLA]());
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
