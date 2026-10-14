// =============================================================================
// api-mako/tokens-creador — un token detallado vale mientras quien lo creó siga siendo admin
// =============================================================================
// Como GitHub (decisión de Martín del 08/10/2026, «copiá la API de GitHub tal cual»): un
// fine-grained token es de una PERSONA, y cuando esa persona deja la organización el token
// deja de tener acceso a ella. Acá el token es del workspace y guarda `creadoPor` (el email
// de quien lo acuñó en /api-mako), que hasta el 13/10/2026 sólo se escribía y se dibujaba:
// un admin que sacaban del negocio se iba con tokens que seguían escribiendo.
//
// La regla, en POSITIVO (igual que la puerta de /api-mako, app/api-mako/actions.ts, que exige
// rol de workspace admin): el creador sigue teniendo acceso si
//   · existe y no está suspendido, y
//   · es admin global de MaKo, o
//   · es admin (rol_ws admin o sin rol_ws, que es admin) DE ESTE workspace, o
//   · es admin de una agencia con este workspace APROBADO en su cartera (la vista de agencia
//     también deja acuñar tokens: la puerta mira el workspace que se está viendo).
//
// Un token SIN creador (`creadoPor` vacío) no se puede revisar y sigue valiendo: sólo lo
// acuña una sesión sin email (la de desarrollo o la de emergencia). Medido el 13/10/2026: el
// único token detallado de producción tiene creador, y es admin de su workspace.
//
// SIN `server-only`: el juicio es puro y lo prueba tests/api-mako-tokens-creador.test.ts. La
// lectura de la base vive en tokens.ts.
// =============================================================================

import { puedeEntrar, type FilaCartera } from '@/lib/agencia-cartera';

/** Lo que hace falta saber de quien creó el token (una fila de `usuarios`). */
export type CreadorLeido = {
  rol: string;
  rol_ws: string | null;
  workspace_id: number | null;
  estado: string;
} | null;

/** ¿El creador de un token de `ws` sigue pudiendo administrar ese workspace? */
export function creadorConAcceso(ws: number, u: CreadorLeido, cartera: readonly FilaCartera[] = []): boolean {
  if (!u || u.estado === 'suspendido') return false;
  if (u.rol === 'admin') return true;
  if ((u.rol_ws ?? 'admin') !== 'admin') return false;
  if (u.workspace_id === ws) return true;
  return puedeEntrar(u.workspace_id, ws, cartera);
}

/** El texto del 401 cuando el token dejó de valer por su creador. */
export function mensajeSinCreador(nombre: string): string {
  return `El token «${nombre}» dejó de valer: quien lo creó ya no administra este negocio. Que un admin cree otro en MaKo → API → Tokens.`;
}
