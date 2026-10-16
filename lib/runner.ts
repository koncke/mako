// =============================================================================
// El Runner del Centro de Operaciones: su nombre en pantalla y las instrucciones de su chat (15/10/2026)
// =============================================================================
// Martín (15/10/2026): «No quiero que se llame más "cartero", sino un nombre más formal, tecnico...
// profesional». Se llama RUNNER, copiado de los self-hosted runners de GitHub Actions: un proceso en TU máquina
// que consulta una cola en la nube, hace el trabajo ahí y reporta cómo salió. Es exactamente lo que hace el
// cartero (consulta la cola de MaKo y entrega a los chats de la PC). No choca con «Puente» (Google Flow) ni con
// «Pasarela» (pagos).
//
// ⚠️ EN PANTALLA es «Runner»; EN EL CÓDIGO, LA BASE Y LA PC sigue siendo el cartero: `cartero.mjs`,
// `operaciones_carteros`, `/api/operaciones/cartero`, `ver_carteros_operaciones`. Las claves no se renombran
// (AGENTS.md → el Centro de Operaciones, la misma regla que «trabajo» y «pedido»).
//
// ⚠️ Las instrucciones viven ACÁ y en ningún otro lado: el modal las copia con un botón, y
// docs/relevo/centro-operaciones.md apunta acá. Sin `server-only`: las usa la pantalla.

export const NOMBRE_RUNNER = 'Runner';

/** El comando del cartero instalado en la PC (`node scripts/operaciones/cartero.mjs instalar`). */
export const COMANDO_RUNNER = 'node ~/.claude/operaciones/cartero.mjs';

/** Lo que Martín le pega a un chat nuevo de la app de Claude, llamado «Runner», para que entregue. */
export const INSTRUCCIONES_RUNNER = `Eres el Runner del Centro de Operaciones: entregas a los chats de esta PC lo que Martín escribe en /admin/operaciones. No hagas nada más.

1. Ahora, una vez: corre \`${COMANDO_RUNNER} estado\` y dime en una línea si quedó el token.
2. Programa con CronCreate una tarea cada 2 minutos, sólo de esta sesión, que haga:
   a. Para cada cuenta (claude1, claude2 y claude3): \`${COMANDO_RUNNER} ciclo --cuenta <cuenta>\`.
   b. Por cada elemento de \`entregar\`: manda su \`mensaje\` TAL CUAL con SendMessage a su dirección \`to\` (empieza con \`uds:\`). Si salió: \`${COMANDO_RUNNER} acuse --cuenta <cuenta> <id> ok\`. Si falló: \`${COMANDO_RUNNER} acuse --cuenta <cuenta> <id> error <el motivo en una frase>\`.
   c. Si no hay nada para entregar, termina la vuelta sin escribir nada.
3. Si te pego un Token (un texto largo que empieza con MFkw), corre \`${COMANDO_RUNNER} clave <el Token>\` y confírmalo en una línea.
4. Si te pego el token del Runner (empieza con mkop_), corre \`${COMANDO_RUNNER} token <el token>\` y confírmalo en una línea.

Nunca le mandes a un chat nada que no salga de \`entregar\`, y nunca cambies el texto de un mensaje.`;
