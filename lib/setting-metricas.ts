// =============================================================================
// setting-metricas — números de cada jugada (tab /setting)
// =============================================================================
// Agregador PURO (sin IO ni server-only: lo testean los units). El fetch por
// workspace vive en lib/setting-jugadas.ts. Fuentes existentes:
//   nutricion_envios         → enviados por canal + abierto_at/clic_at (webhook Resend)
//   nutricion_inscripciones  → activos / respondió (la pausa) / completados

export type FilaEnvio = { secuencia_id: number | null; canal: string; estado: string; abierto_at: string | null; clic_at: string | null };
export type FilaInsc = { secuencia_id: number | null; estado: string };

export type MetricasJugada = {
  enviadosWa: number;
  enviadosEmail: number;
  respuestas: number;
  abiertos: number;
  clics: number;
  inscriptosActivos: number;
  completados: number;
};

export const METRICAS_CERO: MetricasJugada = {
  enviadosWa: 0, enviadosEmail: 0, respuestas: 0, abiertos: 0, clics: 0, inscriptosActivos: 0, completados: 0,
};

export function agregarMetricas(envios: FilaEnvio[], inscripciones: FilaInsc[]): Map<number, MetricasJugada> {
  const out = new Map<number, MetricasJugada>();
  const de = (id: number): MetricasJugada => {
    let m = out.get(id);
    if (!m) { m = { ...METRICAS_CERO }; out.set(id, m); }
    return m;
  };
  for (const e of envios) {
    if (e.secuencia_id == null) continue;
    const m = de(e.secuencia_id);
    if (e.estado === 'enviado') {
      if (e.canal === 'whatsapp') m.enviadosWa += 1;
      else if (e.canal === 'email') m.enviadosEmail += 1;
    }
    if (e.abierto_at) m.abiertos += 1;
    if (e.clic_at) m.clics += 1;
  }
  for (const i of inscripciones) {
    if (i.secuencia_id == null) continue;
    const m = de(i.secuencia_id);
    if (i.estado === 'activa') m.inscriptosActivos += 1;
    else if (i.estado === 'respondio') m.respuestas += 1;
    else if (i.estado === 'completada') m.completados += 1;
  }
  return out;
}
