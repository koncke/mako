// =============================================================================
// EL VELO DEL MOTOR ENTRA CON EL BARRIDO DEL SOL Y LA LUNA (20/11/2026, OD-F2)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones.md; la maqueta, cuerpo.html `iris()`): «el velo entra como el barrido del modo
// oscuro»: un círculo claro que se cierra hacia lo que se marca, en 720 ms, con la curva del barrido (cubic-bezier(.65, 0, .35, 1)).
// El motor (./MotorTutorial.tsx) oscurece con la sombra de 200vmax del hueco, que aparecía de golpe. Ahora, al APARECER el hueco de
// una marca nueva, el hueco se recorta con un `clip-path`: la pantalla entera menos un círculo centrado en él, que se achica hasta 0.
// El clip-path (a diferencia de una máscara) no recorta al borde del elemento: la sombra de afuera se ve donde el camino la deja.
// El arranque del onboarding (app/onboarding/ChatArranqueV2.tsx, OA-13) hace el mismo barrido con una máscara.
// Aquí, sólo las cuentas (las prueba tests/tutorial-iris.test.ts sin navegador).
// =============================================================================

/** Lo que dura el barrido: el del modo oscuro y el de la maqueta. */
export const MS_IRIS = 720;

/** cubic-bezier(.65, 0, .35, 1), la curva del barrido (la de la maqueta: easeInOutCubic). */
export function suave(k: number): number {
  const t = Math.min(1, Math.max(0, k));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** El radio que arranca tapando nada: del centro del hueco a la esquina más lejana de la pantalla. */
export function radioInicial(cx: number, cy: number, ancho: number, alto: number): number {
  return Math.hypot(Math.max(cx, ancho - cx), Math.max(cy, alto - cy));
}

/** El radio del círculo claro a los `ms` del arranque: de `r0` a 0. */
export function radioA(ms: number, r0: number): number {
  return Math.max(0, r0 * (1 - suave(ms / MS_IRIS)));
}

type Rect = { x: number; y: number; ancho: number; alto: number };
const n = (v: number) => Math.round(v * 10) / 10;

/**
 * El `clip-path` del hueco: la pantalla entera MENOS un círculo de radio `r` centrado en el hueco (evenodd), en coordenadas del
 * propio hueco (su esquina de arriba a la izquierda es el 0,0). `hueco` y la pantalla, en px de la ventana.
 */
export function recorteIris(hueco: Rect, ventana: { ancho: number; alto: number }, r: number): string {
  const x0 = -hueco.x, y0 = -hueco.y, x1 = ventana.ancho - hueco.x, y1 = ventana.alto - hueco.y;
  const cx = hueco.ancho / 2, cy = hueco.alto / 2;
  return `path(evenodd, "M${n(x0)} ${n(y0)}H${n(x1)}V${n(y1)}H${n(x0)}Z M${n(cx - r)} ${n(cy)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0Z")`;
}

/**
 * ¿Barrido? Sólo cuando el hueco APARECE (no había) y es de una marca que todavía no barrió: el mismo lugar que se vuelve a medir, o
 * que parpadea un cuadro, no barre de nuevo. Sin barrido para quien pidió menos movimiento.
 */
export function tocaIris(o: { habia: boolean; hay: boolean; clave: string | null; barrida: string | null; menosMovimiento: boolean }): boolean {
  return o.hay && !o.habia && o.clave != null && o.clave !== o.barrida && !o.menosMovimiento;
}
