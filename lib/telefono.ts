// =============================================================================
// telefono — ¿el pedido viene de un teléfono? (la pregunta pura, sin `node:crypto`)
// =============================================================================
// Vivía en lib/mfa-reglas.ts, que importa `node:crypto` y no entra a un componente de navegador. Lo re-exporta para los
// que ya la usaban desde ahí.
//
// ⚠️ Mira el user-agent, que lo escribe el navegador: es una regla de PRODUCTO, no de seguridad.

export function esTelefono(userAgent: string | null | undefined): boolean {
  return /iPhone|iPod|iPad|Android/i.test(String(userAgent ?? ''));
}
