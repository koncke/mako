// =============================================================================
// Media Buyer — el guion de un HOOK nuevo sobre el cuerpo de un video ganador (PURO: lo prueban los tests)
// =============================================================================
// El contrato de un guion en MaKo son los rótulos en su propia línea (GANCHO / HISTORIA / CTA): la pantalla lo corta en
// tarjetas por ellos y el planificador de tomas sabe qué parte es el gancho (app/video-generator/cargar-guiones-action.ts).
// El cuerpo es lo que dice el video ganador DESPUÉS de su primera frase (su gancho viejo). Sin transcripción, el guion es
// sólo el gancho: se filma igual y se monta sobre el video.
// =============================================================================

/** La primera frase de un texto (hasta el primer punto, signo de cierre o salto de línea). */
export function primeraFrase(texto: string): string {
  const m = /^[\s\S]*?[.!?…](?=\s|$)|^[^\n]+/.exec(texto.trim());
  return (m?.[0] ?? '').trim();
}

export function guionDeHook(gancho: string, transcripcion: string | null): string {
  const g = gancho.trim();
  const t = (transcripcion ?? '').replace(/\s+/g, ' ').trim();
  const cuerpo = t ? t.slice(primeraFrase(t).length).trim() : '';
  return cuerpo ? `GANCHO\n${g}\n\nHISTORIA\n${cuerpo}` : `GANCHO\n${g}`;
}

/** La celda del Video Generator donde el Media Buyer deja los hooks nuevos (hooks-video.ts la escribe). */
export const CELDA_HOOKS = 'media-buyer-hooks';

/**
 * El gancho de un guion de hook: lo de la sección GANCHO, sin el cuerpo. Es lo que dice el AVATAR en una toma (8 s): el cuerpo
 * ya está probado en el video ganador y no se vuelve a filmar. Un guion sin el rótulo es todo gancho.
 */
export function ganchoDeGuion(texto: string): string {
  const t = texto.replace(/\r\n/g, '\n').trim();
  const m = /^GANCHO\s*\n([\s\S]*?)(?:\n\s*\n[A-ZÁÉÍÓÚÑ ]{3,}\s*\n|$)/.exec(t);
  return (m ? m[1] : t).trim();
}

/** Un hook del Media Buyer listo para filmar con el avatar en AI Avatar (lo que muestra la pantalla). */
export type HookParaAvatar = { id: string; gancho: string; de: string };

/**
 * Los hooks del Media Buyer que todavía no se filmaron (estado borrador), del más nuevo al más viejo, para que AI Avatar los
 * ofrezca como «lo que dice tu avatar» (lo prometido a Thiago: hooks de video con el avatar). Sin la celda, ninguno.
 */
export function hooksParaAvatar(celdas: ReadonlyArray<{ id: string; guiones?: ReadonlyArray<{ id: string; texto: string; anguloNombre?: string; estado?: string; creadoEn?: number }> }>, tope = 8): HookParaAvatar[] {
  const celda = celdas.find((c) => c.id === CELDA_HOOKS);
  return [...(celda?.guiones ?? [])]
    .filter((g) => (g.estado ?? 'borrador') === 'borrador' && g.texto.trim())
    .sort((a, b) => (b.creadoEn ?? 0) - (a.creadoEn ?? 0))
    .map((g) => ({ id: g.id, gancho: ganchoDeGuion(g.texto), de: (g.anguloNombre ?? '').replace(/^Hook nuevo de /, '').trim() }))
    .filter((h) => h.gancho)
    .slice(0, tope);
}
