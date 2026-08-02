// =============================================================================
// setting-metricas — números de cada secuencia de mensajes (tab /setting)
// =============================================================================
// Agregador PURO (sin IO ni server-only: lo testean los units). El fetch por
// workspace vive en lib/setting-secuencias.ts. Fuentes existentes:
//   nutricion_envios         → enviados por canal + abierto_at/clic_at (webhook Resend)
//   nutricion_inscripciones  → activos / respondió (la pausa) / completados

export type FilaEnvio = { secuencia_id: number | null; canal: string; estado: string; abierto_at: string | null; clic_at: string | null; created_at?: string | null };
export type FilaInsc = { secuencia_id: number | null; estado: string; updated_at?: string | null };

export type MetricasSecuencia = {
  enviadosWa: number;
  enviadosEmail: number;
  respuestas: number;
  abiertos: number;
  clics: number;
  inscriptosActivos: number;
  completados: number;
};

export const METRICAS_CERO: MetricasSecuencia = {
  enviadosWa: 0, enviadosEmail: 0, respuestas: 0, abiertos: 0, clics: 0, inscriptosActivos: 0, completados: 0,
};

export function agregarMetricas(envios: FilaEnvio[], inscripciones: FilaInsc[]): Map<number, MetricasSecuencia> {
  const out = new Map<number, MetricasSecuencia>();
  const de = (id: number): MetricasSecuencia => {
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

// ── Serie diaria (para el gráfico del Dashboard) ─────────────────────────────

export type PuntoSerie = { dia: string; enviadosWa: number; enviadosEmail: number; respuestas: number; abiertos: number };

/**
 * Serie de los últimos `dias` días terminando en `hoyISO` (YYYY-MM-DD, puro y
 * testeable): envíos reales por canal (created_at), aperturas (abierto_at) y
 * respuestas (updated_at de la inscripción cuando quedó 'respondio' — la fecha
 * de la pausa, aproximación honesta sin tabla nueva).
 */
export function serieDiaria(envios: FilaEnvio[], inscripciones: FilaInsc[], hoyISO: string, dias = 30): PuntoSerie[] {
  const buckets = new Map<string, PuntoSerie>();
  const hoy = Date.parse(`${hoyISO.slice(0, 10)}T00:00:00Z`);
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(hoy - i * 86400 * 1000).toISOString().slice(0, 10);
    buckets.set(dia, { dia, enviadosWa: 0, enviadosEmail: 0, respuestas: 0, abiertos: 0 });
  }
  const en = (fecha: string | null | undefined): PuntoSerie | undefined =>
    fecha ? buckets.get(fecha.slice(0, 10)) : undefined;
  for (const e of envios) {
    if (e.estado === 'enviado') {
      const b = en(e.created_at);
      if (b) { if (e.canal === 'whatsapp') b.enviadosWa += 1; else if (e.canal === 'email') b.enviadosEmail += 1; }
    }
    const ba = en(e.abierto_at);
    if (ba) ba.abiertos += 1;
  }
  for (const i of inscripciones) {
    if (i.estado !== 'respondio') continue;
    const b = en(i.updated_at);
    if (b) b.respuestas += 1;
  }
  return [...buckets.values()];
}
