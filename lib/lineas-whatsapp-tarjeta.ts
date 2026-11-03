// =============================================================================
// lineas-whatsapp-tarjeta — lo que dice la tarjeta de WhatsApp de /integraciones de cada línea (29/10/2026)
// =============================================================================
// Puro (sin `server-only` ni React): lo usa app/integraciones/LineasWhatsApp.tsx y lo prueba tests/whatsapp-tarjeta.test.ts.
// ⚠️ Lo que nadie midió no se pinta de verde: la fila de una línea miente en las dos direcciones (app/api/whatsapp/evolution, GET).
// =============================================================================

/** El estado MEDIDO de una línea (`?linea=` de la ruta), o null mientras se mide. */
export type MedidaLinea = { estado: string; confirmado: boolean } | null;

/** Lo que dice el estado de una línea, en palabras, y su tono. */
export function textoDeEstado(l: { medida: MedidaLinea }): { texto: string; tono: 'good' | 'warn' | 'dim' } {
  const m = l.medida;
  if (!m) return { texto: 'Comprobando…', tono: 'dim' };
  if (m.estado === 'conectado') return m.confirmado ? { texto: 'Conectada', tono: 'good' } : { texto: 'Conectada (sin comprobar)', tono: 'dim' };
  if (m.estado === 'conectando') return { texto: 'Esperando el QR', tono: 'warn' };
  return { texto: 'Desconectada: vuelve a escanear su QR', tono: 'warn' };
}

/** El número como se lee: `+` y los dígitos (sin adivinar el país, la regla de `rotuloLinea`). */
export const numeroLegible = (n: string | null | undefined): string | null => {
  const d = (n ?? '').replace(/\D/g, '');
  return d ? `+${d}` : null;
};
