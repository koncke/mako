// =============================================================================
// Cron: las pruebas A/B se leen UNA vez por día — vercel.json: `15 6 * * *`
// =============================================================================
// docs/diseno-pruebas-ab.md (decisión 16: un solo cron diario para todas las superficies). A las 6:15 UTC (3:15 en
// Argentina) el día de ayer ya cerró: las ventanas terminan ayer. Vence las propuestas de más de 72 h y, por cada prueba
// corriendo, mide, juzga, guarda los números del día y corta o concluye (lib/pruebas/corrida.ts). El juez es código y
// tiene horizonte fijo: correr el cron dos veces el mismo día no decide dos veces (las lecturas son por fecha y concluir
// reclama la prueba).
//
// LOS MEDIDORES, por superficie y por métrica, los pone cada una: Automations («respondio», «agendo», «pago»:
// lib/pruebas/medidores-automatizacion.ts) y Landings («clic_conversion», «optin», «play_manual»). Sin medidor, la lectura
// de esa prueba queda fallida y no decide nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrPruebas, type Medidores } from '@/lib/pruebas/corrida';
import { MEDIDORES_AUTOMATIZACION } from '@/lib/pruebas/medidores-automatizacion';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Los medidores de cada superficie, por clave de métrica. Landings suma los de la landing (`landing`, `portada_mako`). */
const MEDIDORES: Medidores = {
  automatizacion: MEDIDORES_AUTOMATIZACION,
};

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const r = await correrPruebas(MEDIDORES, { techoMs: (maxDuration - 60) * 1000 });
  return Response.json({ ok: true, ...r });
}
