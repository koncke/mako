// =============================================================================
// _salir-cuando-salio — escribir una línea grande a stdout y salir SIN cortarla
// =============================================================================
// ⚠️ POR QUÉ EXISTE, medido el 31/10/2026 y es la clase de bug más cara que hay: EN LINUX, ESCRIBIR A UN PIPE ES
// ASÍNCRONO. Un hijo que hace
//
//     process.stdout.write(linea);   // ~180 KB
//     process.exit(0);               // ← mata el proceso antes de que el pipe se vacíe
//
// entrega la línea CORTADA. En Windows stdout a un pipe es SÍNCRONO y sale entera, así que el test es VERDE en la PC
// y ROJO en el runner — la peor combinación para encontrarlo. Y el síntoma no se parece a la causa: el padre hace
// `JSON.parse` y lo que se ve es `SyntaxError: Unterminated string in JSON at position 178637`, que manda a buscar un
// problema de serialización inexistente.
//
// LA PISTA QUE LO DELATA: la posición del corte es SIEMPRE LA MISMA (178637 en las dos corridas de Actions). Un corte
// por `maxBuffer` cortaría cerca de 1.048.576; uno por el pipe corta donde se llenó el buffer del pipe, que es estable.
// Si ves un JSON cortado siempre en el mismo byte, es esto, no el tamaño del buffer.
//
// ⚠️ Y NO SE ARREGLA SACANDO EL `process.exit(0)`: está ahí porque algunos hijos dejan algo vivo y sin él no terminan
// nunca. Lo que hay que hacer es esperar a que la escritura DRENE, que es lo que hace el callback de `write`.
// =============================================================================

/**
 * Escribe la línea y recién entonces sale. El callback de `write` corre cuando el dato ya salió del proceso.
 * @param linea lo que el padre va a parsear (con su `\n` al final)
 * @param codigo con qué salir (0 salvo que el hijo quiera marcar un fallo)
 */
export function decirYSalir(linea: string, codigo = 0): never {
  process.stdout.write(linea, () => process.exit(codigo));
  // Red por si el callback no llega (stdout cerrado): no deja al hijo colgado para siempre.
  setTimeout(() => process.exit(codigo), 10_000).unref();
  return undefined as never;
}
