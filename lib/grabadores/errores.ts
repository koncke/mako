// =============================================================================
// grabadores/errores — los fallos de un grabador que quien lee tiene que DISTINGUIR (puro)
// =============================================================================
// «El grabador no contestó» no es «la reunión no tiene contenido» (16/10/2026, `extraerTareasDeReunion`): tratado como
// vacío, una reunión leída en el minuto en que el grabador tosía quedaba cerrada para siempre como «sin compromisos».
// Era `FathomSinRespuestaError`; ahora vale para todos (lib/fathom-api.ts la extiende, así su `instanceof` sigue igual).
// =============================================================================

/** El grabador NO CONTESTÓ (429, 5xx o la red, después de los reintentos): pasajero, se reintenta. */
export class GrabadorSinRespuestaError extends Error {
  constructor(public readonly grabador: string, mensaje: string) {
    super(mensaje);
    this.name = 'GrabadorSinRespuestaError';
  }
}

/** El negocio no tiene ese grabador conectado (o le falta una clave): no es un fallo del grabador. */
export class GrabadorSinConectarError extends Error {
  constructor(public readonly grabador: string, mensaje: string) {
    super(mensaje);
    this.name = 'GrabadorSinConectarError';
  }
}

/** De una clave numérica no se puede volver a la reunión (la de un grabador que no es Fathom, sin su fila). */
export class ReunionSinRefError extends Error {
  constructor(public readonly clave: number) {
    super(`No sé de qué grabador es la reunión ${clave}: falta la tabla grabador_reuniones (migración de los grabadores) o la reunión no se listó nunca.`);
    this.name = 'ReunionSinRefError';
  }
}
