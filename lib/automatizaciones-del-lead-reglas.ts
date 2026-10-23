// =============================================================================
// automatizaciones-del-lead-reglas — lo puro de «en qué automatizaciones está un lead» y de «Frenar» (lo prueban sus tests)
// =============================================================================
// La lectura y la escritura viven en lib/automatizaciones-del-lead.ts (server-only); acá lo que se arma con lo leído.
// =============================================================================
import { indiceActual } from './nutricion-grafo-motor';
import { nombreDeTarjeta } from './flujo-conversacion';
import { idDe, claseDe, type PasoGrafo } from './flujo-grafo';
import type { FrenoDelEnvio } from './por-que-no-sale';

export type EnAutomatizacion = {
  secuenciaId: number;
  nombre: string;
  /** false = la automatización está PAUSADA: el lead quedó congelado en su paso y no le sale nada hasta que se active. */
  automatizacionActiva: boolean;
  estado: 'activa' | 'respondio';
  /** La tarjeta en la que está, como la nombra el lienzo («WHATSAPP: Hola {{nombre}}, soy…»). null = no se pudo ubicar. */
  paso: { numero: number; titulo: string } | null;
  proximoEnvioAt: string | null;
  link: string;
  /**
   * POR QUÉ NO LE SALE (todavía), en palabras (23/10/2026, P0 de #289: el motor cortaba por el horario sin decirlo):
   * «No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale hoy 9:00.». null = nada lo frena.
   */
  frenado?: FrenoDelEnvio | null;
};

/** Las inscripciones que siguen vivas: corriendo, o frenadas porque contestó. */
export const ESTADOS_VIVOS = ['activa', 'respondio'] as const;

export type FilaInscripcion = { lead_id: number; secuencia_id: number; estado: string; paso_actual: number | null; nodo_actual: string | null; proximo_envio_at: string | null };
export type FilaAutomatizacion = { id: number; nombre: string | null; activa: boolean | null; archivada_at: string | null; pasos: unknown; instance_name?: string | null };

/** El canal del MENSAJE que le toca (null = una acción, una condición, una espera, o no se pudo ubicar). */
export function canalDelPaso(p: PasoGrafo | undefined): string | null {
  return p && claseDe(p) === 'mensaje' && typeof p.canal === 'string' ? p.canal : null;
}

/** Lo que `frenoDe` sabe de cada fila (lo arma lib/automatizaciones-del-lead.ts con el contexto del negocio). */
export type FrenoDeFila = (f: FilaInscripcion, s: FilaAutomatizacion, canal: string | null) => FrenoDelEnvio | null;

/** Lo leído → lo de cada lead. Sin las archivadas ni las inscripciones que ya no corren. */
export function enAutomatizacionesDe(filas: readonly FilaInscripcion[], secs: readonly FilaAutomatizacion[], frenoDe?: FrenoDeFila): Map<number, EnAutomatizacion[]> {
  const porId = new Map(secs.filter((s) => s.archivada_at == null).map((s) => [Number(s.id), s]));
  const out = new Map<number, EnAutomatizacion[]>();
  for (const f of filas) {
    if (!(ESTADOS_VIVOS as readonly string[]).includes(f.estado)) continue;
    const s = porId.get(Number(f.secuencia_id));
    if (!s) continue;
    const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as PasoGrafo[];
    const i = pasos.length ? indiceActual(pasos, { paso_actual: f.paso_actual ?? 0, nodo_actual: f.nodo_actual }) : -1;
    const lista = out.get(Number(f.lead_id)) ?? [];
    lista.push({
      secuenciaId: Number(s.id), nombre: s.nombre?.trim() || `Automatización #${s.id}`, automatizacionActiva: s.activa === true,
      estado: f.estado as EnAutomatizacion['estado'], paso: i >= 0 ? { numero: i + 1, titulo: nombreDeTarjeta(pasos, idDe(pasos[i], i)) } : null,
      proximoEnvioAt: f.proximo_envio_at, link: `/automations?sec=${s.id}`,
      ...(frenoDe ? { frenado: frenoDe(f, s, canalDelPaso(i >= 0 ? pasos[i] : undefined)) } : {}),
    });
    out.set(Number(f.lead_id), lista);
  }
  return out;
}

/** Lo que dice «Frenar automatización» sobre varios leads tildados (la barra de lote del CRM). */
export function textoDeFrenarLote(o: { pedidos: number; frenados: number; nombre: string | null }): string {
  const leads = (n: number) => (n === 1 ? '1 lead' : `${n} leads`);
  const donde = o.nombre ? ` en «${o.nombre}»` : ' de sus automatizaciones';
  const ya = o.pedidos - o.frenados;
  if (!o.frenados) return o.pedidos === 1 ? `Ese lead ya no estaba corriendo${donde}.` : `Ninguno estaba corriendo${donde}.`;
  return `Frené a ${leads(o.frenados)}${donde}: no les sale nada más.${ya > 0 ? ` ${ya === 1 ? '1 ya no estaba corriendo' : `${ya} ya no estaban corriendo`}.` : ''}`;
}

/** Lo que dice «Frenar»: el resultado de `sacarDeSecuencia` (lib/nutricion-salida-manual.ts), para la persona. */
export function textoDeFrenar(r:
  | { sale: true; secuencia: { nombre: string }; lead: { nombre: string } }
  | { sale: false; porque: string; secuencia: { nombre: string } | null; lead: { nombre: string } | null },
): { ok: true; resumen: string } | { ok: false; error: string } {
  if (r.sale) return { ok: true, resumen: `Frené a ${r.lead.nombre} en «${r.secuencia.nombre}»: no le sale nada más.` };
  const quien = r.lead?.nombre ?? 'ese lead';
  const donde = r.secuencia ? `«${r.secuencia.nombre}»` : 'esa automatización';
  const por: Record<string, string> = {
    secuencia_no_existe: 'Esa automatización no existe en este negocio.',
    lead_no_existe: 'Ese lead no existe en este negocio.',
    carrera: `${quien} cambió de paso en ${donde} mientras lo frenaba: prueba de nuevo.`,
  };
  return { ok: false, error: por[r.porque] ?? `${quien} ya no estaba corriendo en ${donde}.` };
}
