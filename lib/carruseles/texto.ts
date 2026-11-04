// =============================================================================
// carruseles/texto — leer el texto de un carrusel: normalizarlo y ver qué pide al final
// =============================================================================
// Aparte de ./explorar.ts y ./referencia.ts porque los dos lo usan y uno importa del otro: el explorador calcula el CIERRE
// de cada carrusel con el texto ENTERO (al navegador viaja cortado a 320 caracteres y la llamada a la acción suele ir al
// final), y «Hacer el mío» lo toma de ahí. Así la pantalla y el server dicen lo mismo. Puro y sin dependencias.
// =============================================================================

/** Para buscar y comparar: sin tildes, en minúsculas y con un espacio entre palabras. */
export const plano = (t: string): string => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const CIERRES = ['guardar', 'compartir', 'comentar', 'mensaje', 'seguir', 'link'] as const;
export type Cierre = (typeof CIERRES)[number];
export const esCierre = (v: unknown): v is Cierre => typeof v === 'string' && (CIERRES as readonly string[]).includes(v);

/**
 * Lo que pide al final, leído de su texto: la ÚLTIMA pista que aparece gana (el cierre va al final). null = no se ve.
 * Las formas son las de un pie de Instagram en español (tú, usted y las de Argentina, que también escriben así), más las
 * tres en inglés que se ven pegadas («save this», «link in bio»).
 */
export function cierreDeTexto(texto: string | null | undefined): Cierre | null {
  const t = plano(texto ?? '');
  if (!t) return null;
  const reglas: Array<[Cierre, RegExp]> = [
    ['guardar', /\bguard(?:a|alo|ala|en|enlo|ar|ame)\b|\bsave (?:this|it)\b|\bguardatelo\b/g],
    ['compartir', /\bcompart(?:e|elo|ela|ir|irlo|anlo)\b|\benviaselo\b|\bmandaselo\b|\bshare\b/g],
    ['comentar', /\bcoment(?:a|ame|en|ar|alo)\b|\ben (?:los )?comentarios\b|\bcomment\b/g],
    ['mensaje', /\bescrib(?:eme|enos|ir)\b|\bpor (?:dm|mensaje|md|inbox)\b|\bdm\b/g],
    ['seguir', /\bsigueme\b|\bsiguenos\b|\bfollow\b/g],
    ['link', /\blink (?:en|de) (?:la |mi )?bio\b|\blink in bio\b|\benlace en (?:la |mi )?bio\b/g],
  ];
  let mejor: { cierre: Cierre; donde: number } | null = null;
  for (const [cierre, re] of reglas) {
    for (const m of t.matchAll(re)) {
      const donde = m.index ?? 0;
      if (!mejor || donde > mejor.donde) mejor = { cierre, donde };
    }
  }
  return mejor?.cierre ?? null;
}
