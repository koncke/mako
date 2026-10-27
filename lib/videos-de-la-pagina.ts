// =============================================================================
// videos-de-la-pagina — qué videos le pregunta la prueba del Pixel a ESTA página (27/10/2026, MAU-14)
// =============================================================================
// Mauricio: la prueba de su página de GRACIAS le pedía nombrar los videos de la principal. El paso «¿qué es cada video?» se abría si
// faltaba nombrar CUALQUIER video del negocio: los detectados salen de los eventos de todas sus páginas. La prueba de una página
// pregunta sólo por lo de esa página: lo que el análisis encontró en esa dirección y lo detectado que vive ahí. El resto se sigue
// nombrando desde el lápiz de «Tus videos».
//
// Puro (sin React ni server-only): lo usa la pantalla (app/integraciones/ProbarTracking.tsx) y lo prueba
// tests/videos-de-la-pagina.test.ts.
// =============================================================================

/** La misma página: host sin «www.» y camino sin la barra final. Sin consulta ni fragmento (`?utm…`, `#registro`). */
export function mismaPagina(a: string | null | undefined, b: string | null | undefined): boolean {
  const clave = (u: string | null | undefined): string | null => {
    if (!u || !u.trim()) return null;
    try {
      const x = new URL(/^https?:\/\//i.test(u.trim()) ? u.trim() : `https://${u.trim()}`);
      return `${x.hostname.replace(/^www\./, '').toLowerCase()}${x.pathname.replace(/\/+$/, '') || '/'}`;
    } catch { return null; }
  };
  const ka = clave(a);
  return ka != null && ka === clave(b);
}

/**
 * De los videos detectados del negocio, los que viven en la página que se prueba (por su `pagina`). Uno sin página conocida no se
 * pregunta acá: no se sabe si es de ésta.
 */
export function detectadosDeEstaPagina<T extends { pagina: string | null }>(detectados: readonly T[], url: string): T[] {
  return detectados.filter((d) => mismaPagina(d.pagina, url));
}
