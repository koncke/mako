// =============================================================================
// agente-constantes — lo que la PANTALLA necesita saber del agente, y nada más
// =============================================================================
// `app/_components/TutorialAgente.tsx` es 'use client' y mostraba la ruta del
// archivo del token importándola de lib/agente-skill.ts. Ese import de un VALOR
// mete el generador entero de la skill en el bundle del navegador — y el día que
// la skill importe el registro de la API, meterían cientos de descripciones (el
// mismo bug de metodo-catalogo, 145 KB en tres 'use client'). Las constantes que
// la UI necesita viven acá, en un módulo que no importa nada.
// =============================================================================

/** Dónde guarda el usuario su token cuando la skill es GENÉRICA. Es el mismo archivo
 *  que lee el hook de telemetría (lib/agente-plugin.ts), a propósito: un solo lugar
 *  donde vive la credencial en la máquina del cliente. */
export const AGENTE_TOKEN_ARCHIVO = '~/.mako-token';
