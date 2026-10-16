// =============================================================================
// guardado-ficha — guardar la ficha del funnel EN COLA, con «Deshacer» (el motor de ./useFichaDelFunnel.ts)
// =============================================================================
// Puro, sin React: el hook le pasa cómo ver y poner la ficha, y las dos server actions. Así la cola, la pila
// del deshacer y lo que se ve cuando algo falla se prueban EJECUTÁNDOLOS (tests/ficha-guardado.test.ts).
//
// Cada cambio (un `CambioFicha`, lib/ficha/config.ts) se ve EN EL ACTO —se aplica acá con el mismo motor
// puro que usa el server (`aplicarCambio`)— y se manda en COLA, uno detrás del otro, a
// `cambiarFichaFunnelAction`, que lo aplica sobre lo de hoy con compare-and-set. Lo que devuelve el server
// es la verdad: si una respuesta llega cuando no queda nada en la cola, la ficha pasa a ser esa.
//
// ⚠️ LA PILA DEL DESHACER ES POR FUNNEL. La ficha que se ve cambia de funnel sin desmontarse cuando cambia la
//    casa del lead (el desplegable del funnel de la cabecera relee la ficha). Con una pila sola, Deshacer
//    mandaba el `antes` del funnel viejo al nuevo y le borraba la ficha a todos sus leads (revisión 16/10/2026).
// ⚠️ DESHACER RESTAURA CON `esperado` (cómo dejó la ficha el cambio que se deshace): restaurar reemplaza la
//    ficha entera, y sin eso pisaba lo que otra persona guardó después. Si no coincide, el motor no restaura
//    (lib/ficha/config.ts) y la pantalla relee.
// ⚠️ MIENTRAS GUARDA, DESHACER NO HACE NADA, como el botón (que está apagado): la pila se llena cuando contesta
//    el server, y el Ctrl+Z de ese momento deshacía el cambio ANTERIOR junto con el que se estaba guardando.
// ⚠️ SI GUARDAR FALLA SE RELEE, Y SI RELEER TAMBIÉN FALLA (sin red, la sesión vencida) LA PANTALLA VUELVE A LO
//    ÚLTIMO QUE DIJO EL SERVER (`confirmada`): nunca se queda mostrando un cambio que no se guardó.
// =============================================================================

import { aplicarCambio, fichaEfectiva, sanearCambio, type CambioFicha, type FichaGuardada } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';

export type RespuestaGuardar = { ok: true; ficha: FichaDelFunnel; antes: FichaGuardada; cambio: boolean } | { ok: false; error: string };
export type RespuestaLeer = { ok: true; ficha: FichaDelFunnel; puedeEditar?: boolean } | { ok: false; error: string };

export const TOPE_DESHACER = 30;

/** Un cambio que se puede deshacer: de qué funnel es, cómo estaba antes y cómo lo dejó. */
type Paso = { funnelId: number; antes: FichaGuardada; despues: FichaGuardada };

/** Lo que la pantalla dibuja del guardado: si está guardando y cuántos «Deshacer» hay en cada funnel. */
export type EstadoGuardado = { guardando: boolean; pasos: Readonly<Record<number, number>> };

export type DepsGuardado = {
  /** La ficha que se ve ahora. */
  verActual: () => FichaDelFunnel | null;
  /** Cambia la ficha que se ve. */
  poner: (f: FichaDelFunnel) => void;
  guardar: (funnelId: number, c: CambioFicha) => Promise<RespuestaGuardar>;
  leer: (funnelId: number) => Promise<RespuestaLeer>;
  onGuardado: (c: CambioFicha) => void;
  onError: (msg: string) => void;
  onEstado: (e: EstadoGuardado) => void;
};

/** El motor de una ficha montada (lo que devuelve `crearGuardado`). */
export type Guardado = ReturnType<typeof crearGuardado>;

export function crearGuardado(d: DepsGuardado) {
  let cola: Promise<void> = Promise.resolve();
  let enCola = 0;
  let pila: Paso[] = [];
  // Lo último que dijo el server de la ficha (o lo que se veía con la cola vacía, que es lo mismo).
  let confirmada: FichaDelFunnel | null = null;

  const avisar = () => {
    const pasos: Record<number, number> = {};
    for (const p of pila) pasos[p.funnelId] = (pasos[p.funnelId] ?? 0) + 1;
    d.onEstado({ guardando: enCola > 0, pasos });
  };

  function cambiar(raw: CambioFicha, como?: { deshacer?: boolean }): void {
    const f = d.verActual();
    if (!f) return;
    const c = sanearCambio(raw);
    if ('error' in c) { d.onError(c.error); return; }
    const r = aplicarCambio(f.guardada, c, f.eleccion.id, f.respaldo);
    if (!r.ok) { d.onError(r.error); return; }
    if (!r.cambio) return;
    // Con la cola vacía, lo que se ve es lo del server: a eso se vuelve si este cambio no se puede guardar.
    if (enCola === 0) confirmada = f;
    d.poner({ ...f, guardada: r.ficha, efectiva: fichaEfectiva(f.eleccion.id, r.ficha, f.respaldo) });
    enCola++;
    avisar();
    const funnelId = f.funnel.id;
    cola = cola.then(async () => {
      try {
        const res = await d.guardar(funnelId, c);
        if (!res.ok) throw new Error(res.error);
        confirmada = res.ficha;
        if (!como?.deshacer && res.cambio) {
          pila = [...pila.slice(-(TOPE_DESHACER - 1)), { funnelId, antes: res.antes, despues: res.ficha.guardada }];
        }
        if (enCola === 1) d.poner(res.ficha);
        d.onGuardado(c);
      } catch (e) {
        d.onError(e instanceof Error && e.message ? e.message : 'No se pudo guardar');
        // La verdad es lo del server: se relee, así la pantalla no dice algo que no quedó guardado. Y si
        // tampoco se puede releer, lo último que dijo el server.
        const v = await d.leer(funnelId).catch(() => null);
        if (v?.ok) { confirmada = v.ficha; d.poner(v.ficha); }
        else if (confirmada && confirmada.funnel.id === funnelId) d.poner(confirmada);
      } finally {
        enCola--;
        avisar();
      }
    });
  }

  function deshacer(): void {
    if (enCola > 0) return;
    const f = d.verActual();
    if (!f) return;
    let i = pila.length - 1;
    while (i >= 0 && pila[i].funnelId !== f.funnel.id) i--;
    if (i < 0) return;
    const p = pila[i];
    pila = [...pila.slice(0, i), ...pila.slice(i + 1)];
    avisar();
    cambiar({ op: 'restaurar', ficha: p.antes, esperado: p.despues }, { deshacer: true });
  }

  return {
    cambiar,
    deshacer,
    /** Para los tests: espera a que la cola se vacíe, con lo que se haya sumado mientras tanto. */
    terminar: async (): Promise<void> => { let c: Promise<void>; do { c = cola; await c; } while (c !== cola); },
  };
}
