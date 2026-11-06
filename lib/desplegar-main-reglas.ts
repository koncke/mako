// =============================================================================
// desplegar-main-reglas — cuándo vale la pena compilar producción (6/11/2026). Puro: decide con lo que ya se leyó
// =============================================================================
// Martín, por la factura de Vercel: «me interesa que no cobre tanto». Cada compilación de mako cuesta entre US$0,33 y US$0,42, y
// compilar con cada llegada a main llevó la factura de US$40 a US$292: docs/hallazgos-infra.md, «El gasto de Vercel». Desde el
// 6/11, un push a main NO compila (vercel.json, `deploymentEnabled.main: false`): compila el cron /api/cron/desplegar-main, una
// vez por día (11:05 UTC, 08:05 de Argentina) y sólo si hay algo nuevo que salga en la app. Ante la duda compila: un build de más son centavos, y un cambio que no
// llega a producción se lee como «no lo hiciste». Lo urgente sale con scripts/desplegar-ya.mjs.
// =============================================================================

/** ¿Este archivo cambia algo en la app? La misma lista que scripts/vercel-saltar-build.sh (lo cuida tests/desplegar-main.test.ts). */
export function cambioLlegaALaApp(archivo: string): boolean {
  // Estos dos documentos son pantallas de producto (next.config.ts, outputFileTracingIncludes).
  if (archivo === 'docs/estrategia-financiera-mako.md' || archivo === 'docs/offer-marco.md') return true;
  if (/^(docs|tests|\.github|\.claude)\//.test(archivo)) return false;
  return !['AGENTS.md', 'CLAUDE.md', 'README.md'].includes(archivo);
}

/** GitHub corta la lista de archivos de una comparación en 300: con eso no se puede asegurar que sean sólo documentos. */
export const TOPE_ARCHIVOS_GITHUB = 300;

export type Decision = { hacer: 'nada'; motivo: string } | { hacer: 'compilar'; motivo: string };

export function decidirDespliegue(p: {
  /** Ya hay una compilación de producción en curso. */
  enCurso: boolean;
  /** El commit que está en producción. null: no se pudo saber. */
  enProduccion: string | null;
  /** El último commit de main. */
  main: string;
  /** Commits de main que producción todavía no tiene. */
  adelante: number;
  /** Lo que cambió entre los dos. null: no se pudo saber. */
  archivos: readonly string[] | null;
}): Decision {
  if (p.enCurso) return { hacer: 'nada', motivo: 'ya hay una compilación en curso' };
  if (p.enProduccion === p.main) return { hacer: 'nada', motivo: 'producción ya tiene el último commit' };
  if (!p.enProduccion) return { hacer: 'compilar', motivo: 'no se pudo saber qué hay en producción' };
  if (p.archivos === null) return { hacer: 'compilar', motivo: 'no se pudo saber qué cambió' };
  if (p.adelante === 0) return { hacer: 'nada', motivo: 'producción no está atrás de main' };
  if (p.archivos.length >= TOPE_ARCHIVOS_GITHUB) return { hacer: 'compilar', motivo: 'cambiaron demasiados archivos para mirarlos' };
  const deLaApp = p.archivos.filter(cambioLlegaALaApp);
  if (!deLaApp.length) return { hacer: 'nada', motivo: 'sólo cambiaron documentos o tests' };
  return { hacer: 'compilar', motivo: `${deLaApp.length} archivo(s) de la app` };
}
