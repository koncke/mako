// =============================================================================
// La apertura del Dashboard: la hoja en blanco (PURO; 5/11/2026)
// =============================================================================
// docs/mako-iniciativa/plan.md §4 («Dashboard / General · estrella»), T10. Con el informe EN BLANCO (el centro ya dibuja
// «¿Qué vas a crear hoy?» con las plantillas), la estrella pregunta un HECHO, «¿Qué número miras primero cada lunes?», y cada
// respuesta crea la plantilla que lo muestra, con `instanciarPlantilla` y SIN IA (la misma hoja que el botón de la galería):
//   · «Lo cobrado» → Comercial (lo vendido contra el período anterior);
//   · «Los leads» → Marketing (lo invertido, los leads y lo que cuesta cada uno);
//   · «Las llamadas» → Closing.
// El plan nombra también «Lo invertido en anuncios»: con el «Ahora no» obligatorio no entran cinco botones (MAX_BOTONES), y la
// hoja de Marketing es la misma de «Los leads».
//
// Sólo con la estrella abierta (ni `corto`: serían dos selectores en una pantalla), sólo a quien puede guardar, y sólo en el
// Dashboard: la hoja «Focus» (General) no tiene todavía su respuesta por plantilla (docs/relevo/nube-iniciativa.md).
// =============================================================================

import type { Apertura, Respuestas, Superficie } from './reglas';

export type HechosDashboard = { enBlanco: boolean; puedeGuardar: boolean };

export const ACCIONES_DASHBOARD = ['cobrado', 'leads', 'llamadas'] as const;
export type AccionDashboard = (typeof ACCIONES_DASHBOARD)[number];

/** La plantilla de la galería que abre cada respuesta (ids de lib/graficos-plantillas*.ts, todas OFRECIDAS hoy). */
export const PLANTILLA_DE: Readonly<Record<AccionDashboard, string>> = { cobrado: 'comercial', leads: 'marketing', llamadas: 'closing' };

export const ID_PRIMERO = 'dashboard:primero';

export function aperturaDashboard(h: HechosDashboard, _r: Respuestas): Apertura<AccionDashboard> | null {
  if (!h.enBlanco || !h.puedeGuardar) return null;
  return {
    id: ID_PRIMERO, alcance: 'negocio',
    texto: '¿Qué número miras primero cada lunes?',
    botones: [
      { tipo: 'hacer', rotulo: 'Lo cobrado', accion: 'cobrado' },
      { tipo: 'hacer', rotulo: 'Los leads', accion: 'leads' },
      { tipo: 'hacer', rotulo: 'Las llamadas', accion: 'llamadas' },
      { tipo: 'callar', rotulo: 'Ahora no' },
    ],
  };
}

export const SUPERFICIE_DASHBOARD: Superficie<HechosDashboard, AccionDashboard> = { id: 'dashboard', acciones: ACCIONES_DASHBOARD, apertura: aperturaDashboard };

export const CATALOGO: readonly { id: string; cuando: string }[] = [
  { id: ID_PRIMERO, cuando: 'El informe en blanco, a quien puede guardarlo.' },
];

export const EJEMPLOS: readonly { nombre: string; h: HechosDashboard; r: Respuestas; espera: string | null; primerPaso?: true }[] = [
  { nombre: 'el informe en blanco', h: { enBlanco: true, puedeGuardar: true }, r: {}, espera: ID_PRIMERO, primerPaso: true },
  { nombre: 'con hojas', h: { enBlanco: false, puedeGuardar: true }, r: {}, espera: null },
  { nombre: 'quien sólo mira', h: { enBlanco: true, puedeGuardar: false }, r: {}, espera: null },
];
