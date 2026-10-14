// =============================================================================
// curso-nombre — cómo se LLAMA un curso: el de su OFERTA, y NUNCA el del producto (el CRM)
// =============================================================================
// Pedido de Martín (13/10/2026), textual: «desvincula lo que hace que se ponga automáticamente el
// nombre de ese CRM al nombre de un curso, porque ahora ya no debería ser así, sino que los cursos
// deberían tener el nombre de una OFERTA». El lado del CRM lo cortó esa sesión: renombrar un embudo
// ya no escribe `productos.nombre` (`renombrarFunnel`, lib/funnels.ts). Acá se decide el nombre.
//
// Y el 14/10/2026, sobre el respaldo que quedaba: «Elimina el nombre del "producto" que hoy en día se
// llama "nuevo CRM", no debe aparecer nunca como nombre del curso». El producto ES el CRM: nace con el
// nombre que se le pone al crear el embudo (`crearProductoConFunnel`, que crea producto, oferta y
// embudo con el mismo nombre), así que su nombre no entra en la regla ni como último recurso:
// `nombreBaseDelCurso` ni siquiera lo RECIBE, para que no se pueda volver a meter sin cambiar la
// firma (y el test). En la base no hay ningún producto llamado así (medido el 14/10): lo que se
// llama «nuevo CRM» es el concepto, no una fila.
//
// El orden:
//   1. el título puesto a mano en el curso (`curso_estilo.titulo`, mig 0214): lo eligió alguien;
//   2. el de su oferta principal (`oferta_productos.rol = 'principal'`), si hay UNA activa;
//   3. ninguno: `null`. Quien dibuja pone su genérico — «Tu programa» para el alumno, «Curso sin
//      nombre» para el equipo, que es además la invitación a ponerle uno.
//
// ⚠️ CON DOS OFERTAS PRINCIPALES DE NOMBRES DISTINTOS NO SE ELIGE: vuelve `null`. Tomar la primera
// sería adivinar («una rama que puede escribir "ambiguo" no termina en [0]», AGENTS.md). Medido el
// 13/10/2026 en prod: 12 productos con UNA principal, 9 con ninguna, ninguno con dos. Una oferta
// inactiva no nombra nada: dejó de venderse.
//
// Puro y sin `server-only`: lo ejecuta tests/curso-nombre.test.ts. Lo lee lib/curso-nombre-datos.ts.

export type OfertaDelCurso = { nombre: string | null; activa?: boolean | null };

/** Lo que ve el ALUMNO de un curso sin nombre (el portal, la vista previa, el mail). */
export const SIN_NOMBRE_ALUMNO = 'Tu programa';
/** Lo que ve el EQUIPO de un curso sin nombre (el editor, la ficha, la comunidad): le falta ponérselo. */
export const SIN_NOMBRE_EQUIPO = 'Curso sin nombre';

const limpio = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();
const comparable = (s: string): string => s.normalize('NFD').replace(new RegExp('[\\u0300-\\u036f]', 'g'), '').toLowerCase();

/** El nombre del curso SIN el título puesto a mano: el de su oferta principal, o `null`. */
export function nombreBaseDelCurso(principales: readonly OfertaDelCurso[]): string | null {
  const nombres = principales.filter((o) => o.activa !== false).map((o) => limpio(o.nombre)).filter(Boolean);
  const distintos = new Set(nombres.map(comparable));
  return nombres.length && distintos.size === 1 ? nombres[0] : null;
}

/** El nombre final: el título puesto a mano, si hay; si no, el de base (o `null`). */
export function nombreDelCurso(titulo: string | null | undefined, base: string | null): string | null {
  return limpio(titulo) || base;
}
