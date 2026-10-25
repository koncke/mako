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
