// =============================================================================
// guion-secciones — partir un texto por sus SUBTÍTULOS en MAYÚSCULA (un módulo PURO)
// =============================================================================
// El parser de app/components/SeccionCard.tsx, mudado acá el 16/10/2026 para que el teléfono
// (app/m/copywriting) lo use sin llevarse el componente: SeccionCard es 'use client', y lo que una
// pantalla de /m reusa de escritorio no puede vivir en un módulo de cliente (AGENTS.md, «MaKo
// Mobile (/m)»). SeccionCard lo RE-EXPORTA: los siete importadores de allá no cambian, y no hay una
// segunda copia (tests/m-copywriting.test.ts falla si vuelve a tener la suya).
//
// Las etiquetas (GANCHO, HISTORIA, CTA…) son CONTRATO con el prompt que escribe los guiones
// (lib/guion-estructuras.ts): «la app las usa para separar el guion en tarjetas».
// =============================================================================

export type Seccion = { titulo: string; texto: string };

/** true si la línea es un SUBTÍTULO (toda mayúscula, corta, con al menos una letra). */
export function esSubtitulo(l: string, maxLen = 48): boolean {
  return l.length > 0 && l.length <= maxLen && l === l.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(l) && !/[a-záéíóúñ]/.test(l);
}

/**
 * Parte un texto con subtítulos en MAYÚSCULA (cada uno en su propia línea) en
 * secciones {titulo, texto}. Lo que aparece ANTES del primer subtítulo (si hay)
 * cae en una sección con `tituloSinSub` (p.ej. "Panorama general") — o se
 * descarta si no se pasa (útil cuando el prompt garantiza que TODO viene con
 * subtítulo, como el guion GANCHO/HISTORIA/CTA).
 */
export function parsearSecciones(text: string, tituloSinSub?: string, maxLenSub = 48): Seccion[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: Seccion[] = [];
  let actual: Seccion | null = null;
  for (const raw of lines) {
    const l = raw.trim().replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
    if (!l || l === '---') continue;
    if (esSubtitulo(l, maxLenSub)) {
      actual = { titulo: l.replace(/[:：]$/, ''), texto: '' };
      out.push(actual);
    } else {
      const limpio = l.replace(/^[-•·]\s*/, '');
      if (!actual) {
        if (!tituloSinSub) continue;
        actual = { titulo: tituloSinSub, texto: '' };
        out.push(actual);
      }
      actual.texto = actual.texto ? `${actual.texto}\n${limpio}` : limpio;
    }
  }
  return out;
}
