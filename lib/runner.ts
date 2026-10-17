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

/**
 * Cómo se abre el Runner de una cuenta en la terminal: la función del perfil de PowerShell (`claude2` pone
 * CLAUDE_CONFIG_DIR en ~/.claude-martin) con su nombre ya puesto (`-n`, medido en `claude --help` el 16/10/2026).
 *
 * ⚠️ UN RUNNER POR CARPETA DE CONFIG (16/10/2026). Martín pasó las tres cuentas a la terminal, cada una en su
 * carpeta, y SendMessage sólo llega a las sesiones de la carpeta del que manda (medido: «ENOINBOX: no-key»). Un Runner
 * en la app (o en `claude1`, que comparte ~/.claude) no le llega a la terminal de la cuenta 2: cada cuenta abierta en
 * la terminal necesita el suyo. El reparto lo hace cartero.mjs (1.4.0); acá sólo cambia el «cómo se abre».
 */
/** Lo que le suma al Runner su barra de estado, que es la que mide el Uso de la cuenta (cartero.mjs `uso`, lib/centro-uso.ts):
 *  un archivo de ajustes que escribe `cartero.mjs instalar`, pasado con `--settings` (sólo esa sesión: la configuración de
 *  Martín no se toca). `$HOME` lo expande PowerShell. */
export const AJUSTES_RUNNER = '$HOME\\.claude\\operaciones\\runner-settings.json';
export const COMANDO_TERMINAL = (cuenta: string) => `${cuenta} -n ${NOMBRE_RUNNER} --settings ${AJUSTES_RUNNER}`;
/**
 * El comando que abre un chat NUEVO en la terminal de una cuenta, ya con su nombre (`-n`): lo arma «Nuevo chat» del Centro
 * (app/admin/operaciones/NuevoChat.tsx) y Martín lo pega en PowerShell. El nombre va entre comillas simples, con la
 * comilla doblada (así lo lee PowerShell: nada adentro se expande).
 */
export const comandoNuevoChat = (cuenta: string, nombre: string) => `${cuenta} -n '${nombre.trim().replace(/'/g, "''")}'`;
/** Las cuentas de terminal del perfil de PowerShell de Martín (claude1, claude2 y claude3). */
export const CUENTAS_TERMINAL = ['claude1', 'claude2', 'claude3'] as const;
/**
 * ¿La cuenta tiene su función en el `$PROFILE`? Sólo a ésas se les ofrece un comando de PowerShell. La 4 corre sólo en
 * la app (17/10/2026): el panel de Uso le ofreció `claude4 -n Runner` a Martín y PowerShell contestó «not recognized».
 * A una cuenta de la app se le dice que abra su Runner en la app, sin comando.
 */
export const tieneTerminal = (cuenta: string): boolean => (CUENTAS_TERMINAL as readonly string[]).includes(cuenta);

/** Lo que Martín le pega al Runner de cada cuenta (`claude2 -n Runner` en PowerShell), para que entregue. */
export const INSTRUCCIONES_RUNNER = `Eres el Runner del Centro de Operaciones: entregas a los chats de esta PC lo que Martín escribe en /admin/operaciones. No hagas nada más.

1. Ahora, una vez: corre \`${COMANDO_RUNNER} estado\` y dime en una línea en qué carpeta corres, por qué cuentas das la vuelta y si quedó el token.
2. Programa con CronCreate una tarea cada 2 minutos, sólo de esta sesión, que haga:
   0. Sólo si tienes la herramienta list_sessions (el Runner de la app; si aparece como diferida, cárgala con ToolSearch): corre list_sessions y anota los chats de la nube, los que su sessionId NO empieza con local_, en UN comando: \`${COMANDO_RUNNER} nube <sessionId> "<título>" <sessionId> "<título>" …\` (sin ninguno, \`${COMANDO_RUNNER} nube\` solo). Si no la tienes, sáltalo.
   a. \`${COMANDO_RUNNER} ciclo\` (da la vuelta por las cuentas de tu carpeta).
   b. Por cada elemento de \`entregar\`: si trae \`modelo\` o \`esfuerzo\`, ANTES cámbiale eso al chat \`sesion\` con set_session_model (el modelo es la familia: opus, sonnet o haiku; si la app no acepta ese nombre, usa el id de esa familia que te lista) y set_session_effort; si no se puede, sigue igual. Después manda su \`mensaje\` TAL CUAL con SendMessage a su dirección \`to\` (empieza con \`uds:\`). Si salió: \`${COMANDO_RUNNER} acuse <id> ok\`. Si falló: \`${COMANDO_RUNNER} acuse <id> error <el motivo en una frase>\`.
   c. Si no hay nada para entregar, termina la vuelta sin escribir nada.
3. Si te pego un Token (un texto largo que empieza con MFkw), corre \`${COMANDO_RUNNER} clave <el Token>\` y confírmalo en una línea.
4. Si te pego el token del Runner (empieza con mkop_), corre \`${COMANDO_RUNNER} token <el token>\` y confírmalo en una línea.

Nunca le mandes a un chat nada que no salga de \`entregar\`, y nunca cambies el texto de un mensaje.`;
