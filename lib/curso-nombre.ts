// =============================================================================
// curso-nombre — cómo se LLAMA un curso: el de su OFERTA, no el del CRM
// =============================================================================
// Pedido de Martín (13/10/2026), textual: «desvincula lo que hace que se ponga automáticamente el
// nombre de ese CRM al nombre de un curso, porque ahora ya no debería ser así, sino que los cursos
// deberían tener el nombre de una OFERTA». El lado del CRM lo cortó esa sesión: renombrar un embudo
// ya no escribe `productos.nombre` (`renombrarFunnel`, lib/funnels.ts). Acá se decide el nombre.
//
// El orden, de más a menos decidido:
//   1. el título puesto a mano en el curso (`curso_estilo.titulo`, mig 0214): lo eligió alguien;
//   2. el de su oferta principal (`oferta_productos.rol = 'principal'`): lo que se vende es la oferta;
//   3. el del producto, que es lo que había antes.
//
// ⚠️ CON DOS OFERTAS PRINCIPALES DE NOMBRES DISTINTOS NO SE ELIGE: vuelve el del producto. Tomar la
// primera sería adivinar («una rama que puede escribir "ambiguo" no termina en [0]», AGENTS.md).
// Medido el 13/10/2026 en prod: 12 productos con UNA principal, 9 con ninguna, ninguno con dos.
// Y una oferta inactiva no nombra nada: dejó de venderse.
//
// Puro y sin `server-only`: lo ejecuta tests/curso-nombre.test.ts. Lo lee lib/curso-nombre-datos.ts.

export type OfertaDelCurso = { nombre: string | null; activa?: boolean | null };

const limpio = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
const comparable = (s: string): string => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();

/** El nombre del curso SIN el título puesto a mano: el de su oferta principal, o el del producto. */
export function nombreBaseDelCurso(producto: string | null | undefined, principales: readonly OfertaDelCurso[]): string {
  const nombres = principales.filter((o) => o.activa !== false).map((o) => limpio(o.nombre)).filter(Boolean);
  const distintos = new Set(nombres.map(comparable));
  if (nombres.length && distintos.size === 1) return nombres[0];
  return limpio(producto) || 'Tu programa';
}

/** El nombre que se dibuja: el título puesto a mano, si hay; si no, el de base. */
export function nombreDelCurso(titulo: string | null | undefined, base: string): string {
  return limpio(titulo) || base;
}
