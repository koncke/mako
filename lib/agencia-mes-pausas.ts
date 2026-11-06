// =============================================================================
// agencia-mes-pausas — «Paga para entrar»: pausar y reabrir las cuentas de una agencia según lo que pagó (6/11/2026)
// =============================================================================
// Martín (5/11/2026): «toda cuenta de una agencia con esta modalidad que pasa las 2 semanas sin pagar se suspende, y el día 6
// sin el total del mes se suspenden la agencia y todos sus clientes [...] Pagado, entra solo [...] Un error de la base o de una
// lectura NUNCA suspende. No se tocan sus campañas de Meta.»
//
// QUIÉN va en pausa lo decide lib/agencia-mes-reglas.ts (`quienVaEnPausa`, `pasoDePausa`), puro. Acá se APLICA, con la base
// INYECTADA (`DepsPausas`): así el test corre la misma función con una base que falla y comprueba que no escribe nada.
//
// ⚠️ LA LECTURA VA PRIMERO Y ENTERA. Si `leer` tira (la base no contestó, una lectura salió con error), no se pausa NI se reabre
//    a nadie: se devuelve el error. Nunca se decide con media lectura.
// ⚠️ SÓLO SE TOCA LO DE LA MENSUALIDAD: una cuenta pausada a mano o por otro motivo (la pasarela, la baja de su agencia, otra
//    agencia) no se toca. Pausar es `workspaces.estado = 'pausado'` + el corte `paga-para-entrar` (lib/plan-acceso-reglas.ts):
//    no apaga campañas ni toca nada de Meta.
// ⚠️ PAUSAR ES COMPARE-AND-SET sobre `activo`, y si no se puede guardar el corte se deshace: sin el corte, el pago no la
//    reabriría nunca (el molde es `cortar` de lib/plan-acceso.ts).
//
// Sin `server-only`: lo prueba tests/agencia-mes.test.ts con una base de mentira. La base de verdad la pone lib/agencia-mes.ts.
// =============================================================================

import type { CorteGuardado } from './plan-acceso-reglas';
import { pasoDePausa, quienVaEnPausa, type Causa, type Dia, type EstadoDeCliente, type EstadoDelMes, type PasoDePausa } from './agencia-mes-reglas';

/** Cómo está cada cuenta: pausada o no, y su corte guardado (null = no tiene). */
export type EstadoDeCuenta = { pausada: boolean; corte: CorteGuardado | null };

/** Lo que hace falta leer para decidir. Lo arma `leer`, entero: si algo no se pudo leer, `leer` TIRA. */
export type LecturaParaPausas = {
  agenciaWs: number;
  hoy: Dia;
  meses: EstadoDelMes[];
  clientes: EstadoDeCliente[];
  /** Las cuentas que se miran: la agencia y TODOS los clientes de su cartera (también los de baja, por si quedó un corte). */
  cuentas: Map<number, EstadoDeCuenta>;
};

export type DepsPausas = {
  leer: (agenciaWs: number) => Promise<LecturaParaPausas>;
  /** Pausa (compare-and-set sobre `activo`) y guarda el corte; si no lo puede guardar, la deja activa. false = otro la cambió. */
  pausar: (ws: number, corte: CorteGuardado) => Promise<boolean>;
  /** Guarda el corte como no vigente y la vuelve a `activo` (compare-and-set sobre `pausado`). */
  reabrir: (ws: number, corte: CorteGuardado) => Promise<boolean>;
  guardarCorte: (ws: number, corte: CorteGuardado) => Promise<void>;
};

export type CambioDePausa = { ws: number; paso: PasoDePausa['tipo']; causas: Causa[]; ok: boolean; error?: string };
export type ResultadoPausas =
  | { ok: true; agenciaWs: number; cambios: CambioDePausa[]; enSeco: boolean }
  | { ok: false; agenciaWs: number; error: string; cambios: [] };

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** El corte de la mensualidad de una cuenta, si es de ESTA agencia. Uno de otra agencia, o de otro motivo, cuenta como ajeno. */
function delaMensualidad(c: CorteGuardado | null, agenciaWs: number): { vigente: boolean; causas: Causa[]; perdonadas: Causa[] } | null {
  if (!c || c.motivo !== 'paga-para-entrar' || !c.mensualidad || c.mensualidad.agenciaWs !== agenciaWs) return null;
  return { vigente: c.vigente, causas: c.mensualidad.causas as Causa[], perdonadas: c.mensualidad.perdonadas as Causa[] };
}
const ajeno = (c: CorteGuardado | null, agenciaWs: number): boolean => !!c?.vigente && !delaMensualidad(c, agenciaWs);

/** El corte nuevo de una cuenta. `hasta` es el día en que se pausó (lo lee /cuenta-pausada sólo para los otros motivos). */
function corteNuevo(p: { ws: number; agenciaWs: number; hoy: Dia; ahoraIso: string; causas: Causa[]; perdonadas: Causa[]; vigente: boolean }): CorteGuardado {
  return {
    cobroId: 0, hasta: p.hoy, motivo: 'paga-para-entrar', desde: p.ahoraIso, vigente: p.vigente,
    mensualidad: { agenciaWs: p.agenciaWs, rol: p.ws === p.agenciaWs ? 'agencia' : 'cliente', causas: p.causas, perdonadas: p.perdonadas },
  };
}

/**
 * LA REVISIÓN DE UNA AGENCIA: lee todo, decide quién tiene que estar en «Paga para entrar», y pausa o reabre lo que cambió.
 * `enSeco`: decide y no escribe. Cada cuenta con su `try`: una que falla no le frena el resto, y queda en `cambios` con su error.
 */
export async function revisarPausas(agenciaWs: number, deps: DepsPausas, o: { enSeco?: boolean; ahora?: Date } = {}): Promise<ResultadoPausas> {
  let lectura: LecturaParaPausas;
  try {
    lectura = await deps.leer(agenciaWs);
  } catch (e) {
    // ⚠️ La regla: un error de la base o de una lectura NUNCA suspende (ni reabre: no se sabe qué hay).
    return { ok: false, agenciaWs, error: `No pausé ni reabrí nada: ${msg(e)}`, cambios: [] };
  }
  const quiere = quienVaEnPausa({ agenciaWs, hoy: lectura.hoy, meses: lectura.meses, clientes: lectura.clientes });
  const ahoraIso = (o.ahora ?? new Date()).toISOString();
  const cambios: CambioDePausa[] = [];
  for (const [ws, cuenta] of lectura.cuentas) {
    const causas = quiere.get(ws) ?? [];
    const corte = delaMensualidad(cuenta.corte, agenciaWs);
    const paso = pasoDePausa({ quiere: causas, pausada: cuenta.pausada, corte, otroMotivo: ajeno(cuenta.corte, agenciaWs) });
    if (paso.tipo === 'nada') continue;
    const cambio: CambioDePausa = { ws, paso: paso.tipo, causas: paso.tipo === 'pausar' || paso.tipo === 'actualizar' ? paso.causas : corte?.causas ?? [], ok: true };
    cambios.push(cambio);
    if (o.enSeco) continue;
    try {
      if (paso.tipo === 'pausar') {
        cambio.ok = await deps.pausar(ws, corteNuevo({ ws, agenciaWs, hoy: lectura.hoy, ahoraIso, causas: paso.causas, perdonadas: corte?.perdonadas ?? [], vigente: true }));
        if (!cambio.ok) cambio.error = 'otro la cambió en el medio';
      } else if (paso.tipo === 'reabrir') {
        cambio.ok = await deps.reabrir(ws, corteNuevo({ ws, agenciaWs, hoy: lectura.hoy, ahoraIso, causas: [], perdonadas: [], vigente: false }));
      } else if (paso.tipo === 'actualizar') {
        await deps.guardarCorte(ws, { ...cuenta.corte!, mensualidad: { ...cuenta.corte!.mensualidad!, causas: paso.causas } });
      } else {
        // Alguien la reactivó a mano: se respeta. Esas causas quedan perdonadas; una causa nueva la vuelve a pausar.
        await deps.guardarCorte(ws, { ...cuenta.corte!, vigente: false, mensualidad: { ...cuenta.corte!.mensualidad!, perdonadas: [...new Set([...(corte?.perdonadas ?? []), ...(corte?.causas ?? [])])] } });
      }
    } catch (e) {
      cambio.ok = false;
      cambio.error = msg(e);
    }
  }
  return { ok: true, agenciaWs, cambios, enSeco: !!o.enSeco };
}
