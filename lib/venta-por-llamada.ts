// =============================================================================
// venta-por-llamada — ¿este negocio vende por llamada agendada, y por qué lo creemos?
// =============================================================================
// Junta las tres fuentes que ya existen y devuelve los MOTIVOS (la regla vive en
// lib/meta-conversiones.ts, que se prueba):
//   · lo que el dueño DECLARÓ en su diagnóstico (`negocio.fase.diagnostico.canal`);
//   · cómo DECLARÓ que entran sus leads (`funnel_config.data.entradas`);
//   · lo que se MIDIÓ en sus landings (`landing.snapshot`, pieza `embed-agenda`).
//
// Cualquiera de las tres que falle cuenta como «no dice nada»: la consecuencia de no
// saber es NO mostrar un aviso, nunca mostrar uno sin sustento.
// =============================================================================

import 'server-only';
import { getDiagnosticoFase } from './fase-store';
import { getFunnel } from './leads';
import { getSetting } from './settings';
import { SNAPSHOT_KEY, parsearSnapshots } from './landing-snapshot';
import { motivosVentaPorLlamada } from './meta-conversiones';

export async function motivosDeVentaPorLlamada(): Promise<string[]> {
  const [diag, funnel, snap] = await Promise.all([
    getDiagnosticoFase().catch(() => null),
    getFunnel().catch(() => null),
    getSetting(SNAPSHOT_KEY).catch(() => null),
  ]);
  return motivosVentaPorLlamada({
    canal: diag?.canal ?? null,
    // `origen !== 'declarado'` deja `entradas` vacío: el default no afirma nada.
    entradas: funnel?.entradas ?? [],
    snapshots: parsearSnapshots(snap),
  });
}
