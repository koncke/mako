// =============================================================================
// graficos-tablero — dónde vive el tablero de «Mis gráficos» de cada persona
// =============================================================================
// Es POR PERSONA Y POR WORKSPACE, a propósito: el super admin mira a cada cliente con `?ws=N`
// y la agencia ws13 mira a sus clientes. Guardado por workspace, armar un gráfico mirando a
// otro le cambiaría la vista al dueño de esa cuenta. Por eso la clave lleva el usuario y el
// setting vive en el workspace de la pestaña (`setSetting` lo resuelve con
// `getWorkspaceActual`, que ya respeta el `?ws=`).
//
// `app_settings` no hereda entre workspaces (lib/settings.ts lee sólo el de la pestaña), así
// que un tablero no se le aparece a nadie más.
//
// ⚠️ «No pude leer» NO es «no armó ninguno»: con la lectura caída se dibuja el inicial pero
// NO se deja guardar, o el primer cambio pisaría el tablero que la persona ya tenía.

import 'server-only';
import { getUsuarioActual } from './auth';
import { getSettingEstricto, setSetting } from './settings';
import { sanearTablero, type Tablero } from './graficos-catalogo';
import { tableroInicial } from './graficos-plantillas';

const clave = (sub: string) => `graficos.tablero.${sub}`;

export type LecturaTablero =
  | { estado: 'propio'; tablero: Tablero }
  | { estado: 'inicial'; tablero: Tablero }
  | { estado: 'error'; tablero: Tablero };

export async function leerTablero(): Promise<LecturaTablero> {
  const s = await getUsuarioActual();
  if (!s) return { estado: 'error', tablero: tableroInicial() };
  try {
    const raw = await getSettingEstricto(clave(s.sub));
    if (raw == null) return { estado: 'inicial', tablero: tableroInicial() };
    const t = sanearTablero(JSON.parse(raw));
    return t ? { estado: 'propio', tablero: t } : { estado: 'inicial', tablero: tableroInicial() };
  } catch (e) {
    console.error(`[graficos] no pude leer el tablero: ${e instanceof Error ? e.message : String(e)}`);
    return { estado: 'error', tablero: tableroInicial() };
  }
}

/** Guarda el tablero ya saneado. Devuelve lo que quedó guardado. */
export async function guardarTablero(raw: unknown): Promise<Tablero> {
  const s = await getUsuarioActual();
  if (!s) throw new Error('Sin sesión');
  const t = sanearTablero(raw);
  if (!t) throw new Error('Tablero inválido');
  await setSetting(clave(s.sub), JSON.stringify(t));
  return t;
}
