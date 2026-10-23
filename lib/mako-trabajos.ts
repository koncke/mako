// =============================================================================
// mako-trabajos — lo que MaKo terminó mientras la persona estaba en otra tab (22/10/2026)
// =============================================================================
// Martín: «Se debe ejecutar en segundo plano», y si está en otra tab, que le avise cuando termine. El turno del chat de
// Automations sigue aunque la persona se vaya (app/automations/stream-ia.ts); cuando termina y nadie lo está mirando,
// queda anotado ACÁ y sale un evento de `window`. La estrella de cada tab (app/_chat/MakoEnLaTab.tsx, del chat «Ops
// Center») lo escucha y lo pone en su globito; al volver a esa automatización se marca visto.
// Sin servidor y sin React: vive en la pestaña del navegador mientras no se recargue (como el turno que lo produjo).
// =============================================================================

/** El evento de `window` que sale cada vez que cambia la lista (`detail`: la lista entera). */
export const EVENTO_TRABAJO_MAKO = 'mako:trabajo-terminado';

export type TrabajoTerminado = {
  /** La tab donde se pidió («Automations»). */
  tab: string;
  /** Lo que se trabajó («Sprint · apertura»). */
  titulo: string;
  /** Adónde se vuelve para verlo (`/automations?sec=289`). */
  href: string;
  /** false = terminó con un error (MaKo lo dice en el chat). */
  ok: boolean;
  /** Lo que dijo MaKo, corto. */
  texto: string;
  at: number;
};

let sinVer: TrabajoTerminado[] = [];

function avisar(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENTO_TRABAJO_MAKO, { detail: sinVer.slice() }));
}

/** MaKo terminó y nadie lo estaba mirando: queda en la lista (uno por `href`, el último) y sale el evento. */
export function avisarTrabajoTerminado(t: Omit<TrabajoTerminado, 'at'>): void {
  sinVer = [...sinVer.filter((x) => x.href !== t.href), { ...t, texto: t.texto.slice(0, 160), at: Date.now() }];
  avisar();
}

/** Lo que espera a la persona, el más nuevo al final (el globito es `.length`). */
export const trabajosSinVer = (): readonly TrabajoTerminado[] => sinVer.slice();

/** Volvió a verlo: sale de la lista (y el evento, si cambió algo). */
export function marcarTrabajoVisto(href: string): void {
  const antes = sinVer.length;
  sinVer = sinVer.filter((x) => x.href !== href);
  if (sinVer.length !== antes) avisar();
}
