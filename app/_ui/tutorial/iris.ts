// =============================================================================
// EL VELO DEL MOTOR ENTRA CON EL BARRIDO DEL SOL Y LA LUNA (20/11/2026, OD-F2)
// =============================================================================
// Lo acordado (memoria onboarding-16-11-decisiones.md; la maqueta, cuerpo.html `iris()`): «el velo entra como el barrido del modo
// oscuro»: un círculo claro que se cierra hacia lo que se marca, en 720 ms, con la curva del barrido (cubic-bezier(.65, 0, .35, 1)).
// El motor (./MotorTutorial.tsx) oscurece con la sombra de 200vmax del hueco, que aparecía de golpe. Ahora, al APARECER el hueco de
// una marca nueva, el hueco se recorta con un `clip-path`: la pantalla entera menos un círculo centrado en él, que se achica hasta 0.
// El clip-path (a diferencia de una máscara) no recorta al borde del elemento: la sombra de afuera se ve donde el camino la deja.
// El arranque del onboarding (app/onboarding/ChatArranqueV2.tsx, OA-13) hace el mismo barrido con una máscara.
// Las cuentas (las prueba tests/tutorial-iris.test.ts sin navegador) y `barrer`, que las anima sobre un hueco: lo usan el motor y la
// entrada de los videos de los chats (./EntradaEscribiendo.tsx, V5).
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

/**
 * Anima el barrido sobre `nodo` (un hueco cuya sombra es el velo): desde la esquina más lejana hasta 0, en MS_IRIS. Devuelve con qué
 * cortarlo (lo deja sin recorte). `alTerminar` corre al final y al cortarlo. Quien llama decide si toca (`tocaIris`).
 */
export function barrer(nodo: HTMLElement, alTerminar?: () => void): () => void {
  const recorte = (r: number) => {
    const c = nodo.getBoundingClientRect();
    nodo.style.clipPath = recorteIris({ x: c.left, y: c.top, ancho: c.width, alto: c.height }, { ancho: window.innerWidth, alto: window.innerHeight }, r);
  };
  const c0 = nodo.getBoundingClientRect();
  const r0 = radioInicial(c0.left + c0.width / 2, c0.top + c0.height / 2, window.innerWidth, window.innerHeight);
  const t0 = performance.now();
  let raf = 0;
  const listo = () => { nodo.style.clipPath = ''; alTerminar?.(); };
  const cuadro = (ahora: number) => {
    const ms = ahora - t0;
    if (ms >= MS_IRIS) { raf = 0; listo(); return; }
    recorte(radioA(ms, r0));
    raf = requestAnimationFrame(cuadro);
  };
  recorte(r0);   // el primer cuadro, ya recortado: nunca un destello de la pantalla entera oscura
  raf = requestAnimationFrame(cuadro);
  return () => { if (raf) cancelAnimationFrame(raf); listo(); };
}
