// La regla de «esta sesión ya no vale» (01/11/2026, auditoría de seguridad). Sin `server-only`, a
// propósito: es lo que se prueba (tests/sesiones-revocadas.test.ts).

/**
 * ¿La sesión firmada en `iat` (segundos) quedó cerrada por un corte `desde`?
 * El token guarda segundos y el corte milisegundos: una sesión firmada en el MISMO segundo del corte
 * (la que se le vuelve a dar a quien cambió la contraseña) sigue valiendo. Sin `iat` (un token muy
 * viejo, de antes de que lo firmara) y con corte puesto, no vale: no se puede probar que es posterior.
 */
export function sesionRevocada(iat: number | undefined, desde: string | null | undefined): boolean {
  if (!desde) return false;
  const corte = Date.parse(desde);
  if (!Number.isFinite(corte)) return false;
  if (typeof iat !== 'number') return true;
  return iat < Math.floor(corte / 1000);
}

/** ¿El sub de un token es el id de una fila real de `usuarios`? Lo demás sólo lo firma el dev-login local. */
export function subDeFila(sub: string | undefined | null): boolean {
  return typeof sub === 'string' && /^\d+$/.test(sub);
}
