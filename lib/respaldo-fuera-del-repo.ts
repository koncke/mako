// =============================================================================
// Un respaldo con datos de un cliente se escribe FUERA de cualquier repo de git (20/11/2026)
// =============================================================================
// El primer «Reiniciar onboarding» de verdad (ws 11) dejó su respaldo en la raíz del repo, y git no lo ignoraba: las claves y el
// perfil de una clienta, a un `git add` de quedar en el historial. Una carpeta adentro del repo que «está en el .gitignore» tampoco
// sirve: depende de una línea que alguien puede borrar o escribir mal. Por eso esto NO mira el .gitignore: se niega a escribir en
// cualquier carpeta que tenga un `.git` hacia arriba (un worktree tiene `.git` como archivo, y también cuenta).
//
// La carpeta: la que se pase (`--respaldo=<carpeta>`), o MAKO_RESPALDOS, o C:/dev/respaldos en Windows (~/mako-respaldos en otro
// sistema). Lo usa scripts/reiniciar-onboarding.mts; sirve para cualquier script que respalde filas de un cliente.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const CARPETA_RESPALDOS_WINDOWS = 'C:/dev/respaldos';

/** Dónde van los respaldos: la carpeta que se pasó, MAKO_RESPALDOS, o la de siempre de la máquina. */
export function carpetaDeRespaldos(o: { pasada?: string | null; env?: Record<string, string | undefined>; plataforma?: string; home?: string } = {}): string {
  const elegida = o.pasada || (o.env ?? process.env).MAKO_RESPALDOS;
  if (elegida) return resolve(elegida);
  return (o.plataforma ?? process.platform) === 'win32' ? CARPETA_RESPALDOS_WINDOWS : join(o.home ?? homedir(), 'mako-respaldos');
}

/** El repo de git que contiene `carpeta` (el primer `.git`, carpeta o archivo, hacia arriba), o null si no hay ninguno. */
export function repoQueLaContiene(carpeta: string, existe: (p: string) => boolean = existsSync): string | null {
  for (let d = resolve(carpeta); ; d = dirname(d)) {
    if (existe(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

/** Escribe el respaldo en `carpeta` (la crea), nunca adentro de un repo y nunca encima de otro respaldo. Devuelve la ruta. */
export function escribirRespaldo(carpeta: string, nombre: string, datos: unknown): string {
  const repo = repoQueLaContiene(carpeta);
  if (repo) {
    throw new Error(`el respaldo tiene datos de un cliente y no va adentro de un repo de git (${repo}). Pasa otra carpeta con --respaldo=<carpeta> o MAKO_RESPALDOS.`);
  }
  mkdirSync(carpeta, { recursive: true });
  const archivo = join(carpeta, nombre);
  writeFileSync(archivo, JSON.stringify(datos, null, 2), { flag: 'wx' });
  return archivo;
}
