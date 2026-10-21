// =============================================================================
// El rótulo del perfil del negocio en el system de MaKo, con SU nombre (20/10/2026, ola 1, pieza 1.5)
// =============================================================================
// Decía «NEGOCIO DE MARTÍN» en todos los negocios (lib/mako-context.ts y lib/whatsapp-advisor.ts): el modelo de un
// cliente creía que el negocio era de Martín, y el ws1 ni siquiera es de Martín (es de Mauricio). El nombre es el del
// negocio en la plataforma; sin él, sin nombre: nunca uno inventado. Puro: lo prueba tests/chat-contexto-guardias.test.ts.

export function rotuloDelNegocio(nombre: string | null | undefined): string {
  const n = (nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n ? `NEGOCIO «${n}» (perfil del cliente)` : 'EL NEGOCIO (perfil del cliente)';
}
