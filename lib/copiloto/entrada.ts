// =============================================================================
// Marketing CoPilot — la entrada (14/11/2026): lo que decide el código, PURO (con test)
// =============================================================================
// La maqueta que Martín le mostró a Julio el 13/11 (min 00:47:17): antes de los dos pasos, una pregunta por pantalla (memoria
// un-paso-por-pantalla):
//   · ¿Por dónde vendes? (Anuncios, Instagram, YouTube; uno o varios)
//   · con anuncios: ¿Qué campañas haces o quieres hacer? y ¿Cuánto quieres invertir por mes?
//   · ¿Cuánto tiempo tienes para crear contenido?
// Se guarda en el perfil del CoPilot (marketing-copilot.perfil, lib/media-buyer/copiloto.ts): `canales`, `campanas`, `presupuestoMes`,
// `tiempo` y `horas`. El tiempo define cuánto se publica por canal (docs/marketing-copilot/analisis/estrategia.md §4), y eso es lo
// que la nevera cuenta para avisar (./nevera.ts).
// =============================================================================

import type { CanalEntrada, IdFunnel, PerfilCopiloto, TiempoEntrada } from '@/lib/media-buyer/copiloto';
import type { RitmoNevera } from './nevera-reglas';

export type PantallaEntrada = 'canales' | 'campanas' | 'presupuesto' | 'tiempo';

export const CANALES_ENTRADA: ReadonlyArray<readonly [CanalEntrada, string]> = [['anuncios', 'Anuncios'], ['instagram', 'Instagram'], ['youtube', 'YouTube']];

/** Las campañas de la maqueta y el funnel de la app que es cada una. */
export const CAMPANAS_ENTRADA: ReadonlyArray<{ id: IdFunnel; t: string; d: string }> = [
  { id: 'mensajes', t: 'Mensajes', d: 'Te escriben por WhatsApp' },
  { id: 'vsl-llamada', t: 'VSL con llamada', d: 'Ven un video y agendan' },
  { id: 'formulario', t: 'Formulario', d: 'Dejan sus datos' },
  { id: 'carrito', t: 'Compra directa', d: 'Compran en tu página' },
];

/** Las opciones de estrategia.md §0.2. */
export const PRESUPUESTOS_ENTRADA: ReadonlyArray<readonly [number, string]> = [[0, 'Nada por ahora'], [300, 'Unos US$300'], [1000, 'Unos US$1.000'], [3000, 'Unos US$3.000'], [5000, 'US$5.000 o más']];

/**
 * Las opciones de estrategia.md §0.1 y lo que sale de cada una (§4), por semana. Los videos de YouTube van al mes en la tabla
 * (0 o 1, 2, 4 y 8): acá, por semana y redondeado hacia arriba (un ritmo de 0 no avisa nunca). Las historias, en secuencias.
 */
export const TIEMPOS_ENTRADA: ReadonlyArray<{ id: TiempoEntrada; t: string; horas: number; ritmo: Required<RitmoNevera> }> = [
  { id: 'a', t: '1 a 2 horas por semana', horas: 2, ritmo: { reel: 2, post: 1, story: 5, video: 1 } },
  { id: 'b', t: '3 a 5 horas por semana', horas: 5, ritmo: { reel: 4, post: 1, story: 4, video: 1 } },
  { id: 'c', t: 'Un día por semana para grabar', horas: 8, ritmo: { reel: 7, post: 2, story: 6, video: 1 } },
  { id: 'd', t: 'Más, o alguien me edita y publica', horas: 16, ritmo: { reel: 14, post: 3, story: 6, video: 2 } },
];

export type RespuestasEntrada = { canales: CanalEntrada[]; campanas: IdFunnel[]; presupuestoMes: number | null; tiempo: TiempoEntrada | null };

/** Las pantallas, en orden: las de anuncios sólo si eligió anuncios. */
export function pantallasEntrada(canales: readonly CanalEntrada[]): PantallaEntrada[] {
  return ['canales', ...(canales.includes('anuncios') ? (['campanas', 'presupuesto'] as const) : []), 'tiempo'];
}

/** ¿Se puede seguir desde esta pantalla? */
export function pantallaLista(p: PantallaEntrada, r: RespuestasEntrada): boolean {
  if (p === 'canales') return r.canales.length > 0;
  if (p === 'campanas') return r.campanas.length > 0;
  if (p === 'presupuesto') return r.presupuestoMes != null;
  return r.tiempo != null;
}

/** La entrada se muestra mientras el perfil no diga por dónde vende. */
export const faltaLaEntrada = (p: PerfilCopiloto): boolean => !p.canales?.length;

/** Lo que ya sabe el perfil, para no preguntar en blanco a quien respondió la charla vieja. */
export function respuestasDesdeElPerfil(p: PerfilCopiloto): RespuestasEntrada {
  const campanas = p.campanas?.length ? [...p.campanas] : p.funnel && CAMPANAS_ENTRADA.some((c) => c.id === p.funnel) ? [p.funnel] : [];
  const canales: CanalEntrada[] = p.canales?.length ? [...p.canales]
    : p.funnel === 'youtube' ? ['youtube'] : p.funnel === 'organico' ? ['instagram'] : campanas.length ? ['anuncios'] : [];
  const tiempo = p.tiempo ?? (p.horas == null ? null : p.horas <= 2 ? 'a' : p.horas <= 5 ? 'b' : p.horas <= 8 ? 'c' : 'd');
  return { canales, campanas, presupuestoMes: p.presupuestoMes ?? null, tiempo };
}

/**
 * El perfil con la entrada respondida. Lo de anuncios se guarda sólo con anuncios elegidos. El `funnel` (lo que usan el Media Buyer y
 * las tareas de la semana) NO se pisa si ya había uno: se completa con la primera campaña, o con YouTube u orgánico si no hay anuncios.
 */
export function perfilConLaEntrada(p: PerfilCopiloto, r: RespuestasEntrada): PerfilCopiloto {
  const canales = CANALES_ENTRADA.map(([k]) => k).filter((k) => r.canales.includes(k));
  if (!canales.length) return p;
  const conAnuncios = canales.includes('anuncios');
  const t = TIEMPOS_ENTRADA.find((x) => x.id === r.tiempo);
  const funnel: IdFunnel | undefined = p.funnel
    ?? (conAnuncios ? r.campanas[0] : undefined) ?? (canales.includes('instagram') ? 'organico' : canales.includes('youtube') ? 'youtube' : undefined);
  return {
    ...p,
    canales,
    ...(conAnuncios && r.campanas.length ? { campanas: CAMPANAS_ENTRADA.map((c) => c.id).filter((id) => r.campanas.includes(id)) } : {}),
    ...(conAnuncios && r.presupuestoMes != null ? { presupuestoMes: r.presupuestoMes } : {}),
    ...(t ? { tiempo: t.id, horas: t.horas } : {}),
    ...(funnel ? { funnel } : {}),
  };
}

/** Cuánto publica por semana según su tiempo, sólo en las redes que eligió (Instagram: reels, carruseles e historias; YouTube: largos). */
export function ritmoDeLaEntrada(p: Pick<PerfilCopiloto, 'tiempo' | 'canales'>): RitmoNevera | null {
  const t = TIEMPOS_ENTRADA.find((x) => x.id === p.tiempo);
  if (!t) return null;
  const cs = p.canales ?? [];
  const r: RitmoNevera = {
    ...(cs.includes('instagram') ? { reel: t.ritmo.reel, post: t.ritmo.post, story: t.ritmo.story } : {}),
    ...(cs.includes('youtube') ? { video: t.ritmo.video } : {}),
  };
  return Object.keys(r).length ? r : null;
}
