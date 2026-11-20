// =============================================================================
// EL CLIP DE 10 s QUE EL RETO REGALA EL DÍA 6 — las reglas, sin red ni base (20/11/2026)
// =============================================================================
// Martín, 15/11: «el reto tiene que mostrar AI Avatar: en la prueba le regalamos un clip de 10 segundos para que lo pruebe».
// El 17/11 decidió que el video de los CLIENTES va por ApiMart (Flow es para su contenido), con su Omni
// (`gemini-omni-1.2-flash-ext`, lib/apimart-reglas.ts). El Cerebro, 20/11 (R57-02 de la auditoría del reto):
//   · UN clip por prueba, y queda en su historial de videos;
//   · si ApiMart falla o no hay saldo, se dice claro y no se cobra nada;
//   · lo que costó queda anotado;
//   · sirve también en una prueba de Essential: AI Avatar es de Pro, pero el reto lo abre esa vez sola.
//
// Lo que toca la red y la base vive en ./clip-regalo.ts; acá, lo que se puede probar sin gastar: el estado guardado y cómo
// se lee, la frase, el prompt, y qué le decimos a la persona en cada caso.
//
// ⚠️ UN REGALO NO SE COBRA, PERO SE ANOTA. No pasa por MaKo Tokens (`cobrarMediosMt`): el costo real que devuelve ApiMart
// queda en la tabla de uso (`recordCostoDeMedio`, provider 'apimart'), por negocio. El estimado es la fila «Un clip de 10
// segundos» de los MEDIOS (lib/mako-tokens-costos.ts): US$0,24.
// =============================================================================

import { MODELO_OMNI, MODELOS_VIDEO } from '../apimart-reglas';

/** El setting del negocio con el estado del regalo. Uno por negocio = uno por prueba (una prueba por persona). */
export const CLAVE_CLIP_REGALO = 'reto.clip-regalo';
export const SEGUNDOS_CLIP_REGALO = 10;
/** Lo que entra en 10 s a ritmo natural (Martín: «la duración son las palabras»). */
export const MAX_PALABRAS_CLIP = 25;
/**
 * Cuántas veces se puede pedir. Un pedido que el proveedor RECHAZÓ no cuenta (no arrancó, no costó). Uno que arrancó y
 * después falló sí, porque ApiMart cobra el intento: el segundo es la red para un fallo del proveedor, no un clip más.
 */
export const MAX_INTENTOS_CLIP = 2;
export const FEATURE_CLIP_REGALO = 'reto-clip-regalo';
export const USD_ESTIMADO_CLIP_REGALO = SEGUNDOS_CLIP_REGALO * MODELOS_VIDEO[MODELO_OMNI].usdPorSegundo;

/** Un pedido que quedó a medio camino (el server murió entre reservar y lanzar) no se sabe si arrancó: a los 10 min, a revisar. */
export const PIDIENDO_VENCE_MS = 10 * 60_000;
/** Bajar el video y guardarlo tarda segundos: un «guardando» de más de 5 min es un server que murió en el medio. */
export const GUARDANDO_VENCE_MS = 5 * 60_000;
/** El video de ApiMart vence a las 24 h (`expires_at`): pasado eso ya no se puede bajar. Se corta antes, con margen. */
export const GENERANDO_VENCE_MS = 23 * 60 * 60_000;

// ── El cron que termina los clips que nadie vuelve a mirar (app/api/cron/clip-regalo) ─────────────────────────────────
/** Cada cuánto pasa (lo fija el test contra vercel.json): cada 15 min, en los minutos 4, 19, 34 y 49, fuera de los :00/:15 de los demás crons. */
export const SCHEDULE_CRON_CLIP = '4,19,34,49 * * * *';
/** Hasta dónde mira para atrás: lo que cambió en las últimas 25 h. El clip vence a las 23 h; las 2 h de más, para que el cron
 *  alcance a pasarlo a «revisar» (y avisar) aunque se haya saltado alguna corrida. */
export const VENTANA_CRON_MS = GENERANDO_VENCE_MS + 2 * 60 * 60_000;
/** Cuántos clips mira por corrida, como mucho: cada uno puede bajar un video (hasta 60 s). Lo que sobra, en la corrida siguiente. */
export const MAX_CLIPS_POR_CORRIDA = 20;
/** ¿El cron tiene algo que hacer con este estado? Lo que sigue en curso. Lo colgado lo destraba la misma vuelta (`vencido`). */
export const pendienteParaElCron = (g: EstadoGuardado | null): boolean =>
  g != null && (g.e === 'generando' || g.e === 'guardando' || g.e === 'pidiendo');

/** Lo que se guarda en `CLAVE_CLIP_REGALO`. `intentos` = los que ARRANCARON en el proveedor. */
export type EstadoGuardado =
  | { e: 'pidiendo'; at: string; intentos: number; frase: string }
  | { e: 'generando'; at: string; intentos: number; frase: string; taskId: string; planId: string; imagen: string; imagenId: string; plantillaId: string; deDonde: 'personaje' | 'foto' }
  | { e: 'guardando'; at: string; intentos: number; frase: string; taskId: string; planId: string; imagen: string; imagenId: string; plantillaId: string; deDonde: 'personaje' | 'foto'; desde: string }
  | { e: 'listo'; at: string; intentos: number; planId: string; url: string; usd: number }
  | { e: 'fallo'; at: string; intentos: number; porque: string; sinSaldo?: true }
  | { e: 'revisar'; at: string; intentos: number; porque: string };

/** Lo que ve la tarjeta del día 6. */
export type ClipRegalo =
  | { estado: 'disponible'; segundos: number; maxPalabras: number }
  | { estado: 'generando'; desde: string }
  | { estado: 'listo'; url: string; planId: string }
  | { estado: 'fallo'; texto: string; puedeReintentar: boolean }
  | { estado: 'no-disponible'; texto: string };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const ent = (v: unknown): number => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0);

/** El estado guardado, tolerante: basura → null (y null es «todavía no lo pidió»). */
export function leerEstado(crudo: string | null | undefined): EstadoGuardado | null {
  if (!crudo) return null;
  let o: Record<string, unknown>;
  try { o = JSON.parse(crudo) as Record<string, unknown>; } catch { return null; }
  if (!o || typeof o !== 'object') return null;
  const at = str(o.at), intentos = ent(o.intentos);
  const enCurso = () => ({
    at, intentos, frase: str(o.frase), taskId: str(o.taskId), planId: str(o.planId), imagen: str(o.imagen), imagenId: str(o.imagenId), plantillaId: str(o.plantillaId),
    deDonde: o.deDonde === 'foto' ? 'foto' as const : 'personaje' as const,
  });
  switch (o.e) {
    case 'pidiendo': return { e: 'pidiendo', at, intentos, frase: str(o.frase) };
    case 'generando': { const c = enCurso(); return c.taskId && c.planId ? { e: 'generando', ...c } : null; }
    case 'guardando': { const c = enCurso(); return c.taskId && c.planId ? { e: 'guardando', ...c, desde: str(o.desde) } : null; }
    case 'listo': return str(o.url) ? { e: 'listo', at, intentos, planId: str(o.planId), url: str(o.url), usd: Number(o.usd) || 0 } : null;
    case 'fallo': return { e: 'fallo', at, intentos, porque: str(o.porque), ...(o.sinSaldo === true ? { sinSaldo: true as const } : {}) };
    case 'revisar': return { e: 'revisar', at, intentos, porque: str(o.porque) };
    default: return null;
  }
}

/** ¿Se puede pedir (otra vez)? Sin pedido, o con uno que falló y todavía tiene intento. */
export const sePuedePedir = (g: EstadoGuardado | null): boolean => g == null || (g.e === 'fallo' && g.intentos < MAX_INTENTOS_CLIP);

/**
 * La frase que va a decir el personaje. NO SE CORTA EN SILENCIO (la trampa del 19/11 en el personaje en cubos: un guion
 * recortado sin aviso sale con la frase a medias): si no entra en 10 s, se dice cuánto sobra.
 */
export function fraseDelClip(texto: unknown): { ok: true; frase: string; palabras: number } | { ok: false; error: string } {
  const frase = String(texto ?? '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
  const palabras = frase ? frase.split(' ').length : 0;
  if (palabras < 2) return { ok: false, error: 'Escribe lo que va a decir tu personaje: el gancho de tu guion.' };
  if (palabras > MAX_PALABRAS_CLIP) {
    return { ok: false, error: `En 10 segundos entran hasta ${MAX_PALABRAS_CLIP} palabras y la tuya tiene ${palabras}. Déjala más corta.` };
  }
  if (frase.length > 220) return { ok: false, error: 'La frase es muy larga para 10 segundos. Déjala más corta.' };
  return { ok: true, frase, palabras };
}

/**
 * El prompt del Omni. Calcado del que Martín aprobó el 17/11 (`C:/dev/reel-mentores/omni/omni-clip.mjs`): la frase EXACTA y
 * nada más, de corrido, sin texto en pantalla, y lo demás igual a la imagen. Neutro: puede ser un personaje o su foto, y no
 * sabemos su género. «Boca cerrada al terminar»: el modelo llena el silencio que sobra con una sonrisa muda (hallazgo del
 * 17/11, docs/hallazgos-video-pipeline.md).
 */
export function promptDelClip(frase: string): string {
  return 'Vertical 9:16, one continuous shot, no cuts. The person in the image looks straight at the camera and says, IN SPANISH, '
    + `exactly this and nothing else: «${frase}» `
    + 'They speak the sentence continuously, at a natural, warm and confident pace, in neutral Latin American Spanish, without '
    + 'pausing in the middle. After the last word they close their mouth and keep looking at the camera. Everything else stays '
    + 'exactly as in the image. No on-screen text, no subtitles, no music, no sound effects.';
}

/** El intento siguiente: los rechazos no cuentan, así que se cuenta recién cuando el proveedor ACEPTA. */
export const intentosPrevios = (g: EstadoGuardado | null): number => (g ? g.intentos : 0);

const desde = (iso: string): number => { const t = Date.parse(iso); return Number.isFinite(t) ? t : 0; };

/** ¿Este estado quedó colgado? Devuelve en qué tiene que quedar, o null si sigue vivo. */
export function vencido(g: EstadoGuardado, ahoraMs: number): EstadoGuardado | null {
  if (g.e === 'pidiendo' && ahoraMs - desde(g.at) > PIDIENDO_VENCE_MS) {
    return { e: 'revisar', at: new Date(ahoraMs).toISOString(), intentos: g.intentos, porque: 'El pedido quedó a medio camino: no sé si el clip empezó a generarse.' };
  }
  if (g.e === 'guardando' && ahoraMs - desde(g.desde) > GUARDANDO_VENCE_MS) {
    const { desde: _d, ...resto } = g;
    return { ...resto, e: 'generando' };
  }
  if ((g.e === 'generando' || g.e === 'guardando') && ahoraMs - desde(g.at) > GENERANDO_VENCE_MS) {
    return { e: 'revisar', at: new Date(ahoraMs).toISOString(), intentos: g.intentos, porque: 'El clip no terminó a tiempo y el proveedor ya no lo guarda.' };
  }
  return null;
}

/** Lo que se le dice a la persona. Sin nombres de proveedores: ella no sabe qué es ApiMart. */
export const TEXTOS_CLIP = {
  sinSaldo: 'Ahora MaKo no puede generar videos y ya nos llegó el aviso. No se te cobró nada: vuelve a intentarlo en un rato.',
  rechazado: 'El generador de video no aceptó el pedido. No se te cobró nada: vuelve a intentarlo.',
  fallo: 'No salió tu clip. No se te cobró nada: puedes pedirlo otra vez.',
  falloSinIntento: 'No salió tu clip, y ya se intentó dos veces. Avísanos desde Soporte y lo resolvemos. No se te cobró nada.',
  revisar: 'No sé si tu clip empezó a generarse. Lo revisamos y te avisamos. No se te cobró nada.',
  yaUsado: 'Tu clip de regalo ya está hecho: lo encuentras en tu historial de videos.',
  sinFoto: 'Para tu clip hace falta una foto tuya o tu personaje. Súbela en Video › Tu personaje con IA y vuelve.',
  soloPrueba: 'El clip de regalo es parte del reto de tu prueba.',
} as const;

/** El estado para la tarjeta. `puedePedir` = la puerta dejó pasar (prueba o revisión). */
export function publico(g: EstadoGuardado | null, puedePedir: boolean): ClipRegalo {
  if (!g) return puedePedir ? { estado: 'disponible', segundos: SEGUNDOS_CLIP_REGALO, maxPalabras: MAX_PALABRAS_CLIP } : { estado: 'no-disponible', texto: TEXTOS_CLIP.soloPrueba };
  switch (g.e) {
    case 'pidiendo': return { estado: 'generando', desde: g.at };
    case 'generando': case 'guardando': return { estado: 'generando', desde: g.at };
    case 'listo': return { estado: 'listo', url: g.url, planId: g.planId };
    case 'revisar': return { estado: 'fallo', texto: TEXTOS_CLIP.revisar, puedeReintentar: false };
    case 'fallo': {
      const puede = puedePedir && g.intentos < MAX_INTENTOS_CLIP;
      if (g.sinSaldo) return { estado: 'fallo', texto: TEXTOS_CLIP.sinSaldo, puedeReintentar: puede };
      return { estado: 'fallo', texto: puede ? (g.intentos === 0 ? TEXTOS_CLIP.rechazado : TEXTOS_CLIP.fallo) : TEXTOS_CLIP.falloSinIntento, puedeReintentar: puede };
    }
  }
}
