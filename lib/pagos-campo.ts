// =============================================================================
// pagos-campo — la escritura CAMPO POR CAMPO de la tab Pagos: las reglas, puras
// =============================================================================
// Pedido de Martín (14/10/2026, app/admin/dev/crm/bitacora.ts): «edita todo en la misma tab y depreca
// "Editar deal →" en todos lados». El diseño es docs/diseno-ficha-bloques.md §3 Pagos: cada bloque escribe SU
// campo. Hasta acá todo pasaba por «Editar deal» y tenía tres trampas, medidas en el código el 14/10:
//
//   1. `saveDealSectionsAction` REEMPLAZABA los jsonb enteros (deal_fiscal, deal_servicio, promesa,
//      obligaciones). Un bloque que manda un campo borraba los demás (y el documento fiscal subido).
//   2. `saveLeadPlanManual` GANABA el lead en cada guardado y BORRABA E INSERTABA todas las cuotas impagas.
//      Cada guardado le cambiaba el id a cada cuota, y de ese id cuelgan tres cosas que se rompían en silencio:
//        · `cobros.pago_id` (el link que salda ESA cuota),
//        · el corte de la cobranza al pagar (`cerrarCorridasDeCuota` busca `ctx.cuotaId`, lib/flujo-corridas.ts),
//        · el dedup del recordatorio (`cuota:${pago_id}`, lib/cobranza.ts): la cuota «nueva» volvía a entrar.
//   3. Los pagos cargados a mano sólo aceptaban USD (decisión 7: la moneda va por negocio).
//
// Lo que vive acá son las DECISIONES, para que los tests las ejecuten: qué campo existe y cómo se limpia, cómo se
// mergea una sección, cómo se edita una lista de obligaciones sin pisar la de otra pestaña, qué escribe un cambio
// de la venta, cómo se reconcilia una lista de cuotas por id SIN borrar lo que tiene un link o un recordatorio
// corriendo, y cómo se valida un pago en otra moneda. La escritura está en lib/pagos.ts y en
// app/crm/[id]/pagos-campo-actions.ts.
//
// Sin `server-only`: lo importan las actions, la API de MaKo, lib/pagos.ts y los tests.
// =============================================================================

import { centavos } from './pagos-diferencia';
import { formatoMonto, normalizarMoneda } from './pasarela-moneda';
import { VENTA_SIN_COBRO, ventaTipoDe, type VentaTipo } from './venta-tipo';
import { esCuotaDelPlan, esPlataSuelta, mesesDeUnaCobrada, noEsDeuda, sumarMeses } from './cobrado-lead';

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; faltan?: string[] };

const esFecha = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(`${s}T12:00:00Z`));

// ─────────────────────────────────────────────────────────────────────────────
// 1 · Los campos del deal (las tres secciones jsonb y los dos sueltos)
// ─────────────────────────────────────────────────────────────────────────────

export type SeccionDeal = 'fiscal' | 'servicio' | 'promesa';
export const SECCIONES_DEAL: readonly SeccionDeal[] = ['fiscal', 'servicio', 'promesa'];

/** La columna jsonb de cada sección (mig 0060). */
export const COLUMNA_SECCION: Readonly<Record<SeccionDeal, 'deal_fiscal' | 'deal_servicio' | 'deal_promesa'>> = {
  fiscal: 'deal_fiscal', servicio: 'deal_servicio', promesa: 'deal_promesa',
};

/**
 * Los campos que se editan, con el rótulo del historial. ⚠️ `doc_path` y `doc_nombre` NO están: los escribe la
 * subida del documento fiscal (/api/extract-deal-fiscal), y el merge los conserva. Era lo que borraba el reemplazo.
 */
export const CAMPOS_DEAL = {
  fiscal: { razon: 'Razón social', id_fiscal: 'Identificación fiscal', domicilio: 'Domicilio fiscal', correo: 'Correo de facturación' },
  servicio: { que_es: 'Qué es', fecha_inicio: 'Inicio', fecha_termino: 'Término', duracion: 'Duración', frecuencia: 'Frecuencia', modalidad: 'Modalidad', sesiones: 'Sesiones' },
  promesa: { resultado: 'Resultado prometido', garantia: 'Garantía' },
} as const satisfies Record<SeccionDeal, Record<string, string>>;

const NOMBRE_SECCION: Readonly<Record<SeccionDeal, string>> = { fiscal: 'Datos fiscales', servicio: 'Servicio', promesa: 'Promesa' };

/** Los dos del deal que son columnas del lead y no van en un jsonb. */
export const CAMPOS_LEAD_DEAL = {
  fecha_inicio_servicio: 'Inicio del servicio',
  facturado_por_id: 'Facturado por',
} as const;
export type CampoLeadDeal = keyof typeof CAMPOS_LEAD_DEAL;

export const MAX_TEXTO_DEAL = 2000;

export const esSeccionDeal = (s: unknown): s is SeccionDeal => typeof s === 'string' && (SECCIONES_DEAL as readonly string[]).includes(s);
export const esCampoDeal = (seccion: SeccionDeal, campo: unknown): boolean =>
  typeof campo === 'string' && Object.prototype.hasOwnProperty.call(CAMPOS_DEAL[seccion], campo);
export const esCampoLeadDeal = (c: unknown): c is CampoLeadDeal => c === 'fecha_inicio_servicio' || c === 'facturado_por_id';

/** «Datos fiscales · Razón social»: el `campo` de la línea del historial. */
export function rotuloCampoDeal(seccion: SeccionDeal, campo: string): string {
  const r = (CAMPOS_DEAL[seccion] as Record<string, string>)[campo] ?? campo;
  return `${NOMBRE_SECCION[seccion]} · ${r}`;
}

/**
 * El valor de un campo de sección, limpio: texto recortado (vacío = null), las fechas del servicio en
 * YYYY-MM-DD y el correo con su arroba. Lo que no es texto ni null se rechaza (no se guarda «[object Object]»).
 */
export function valorDeCampoDeal(seccion: SeccionDeal, campo: string, valor: unknown): Resultado<{ valor: string | null }> {
  if (!esCampoDeal(seccion, campo)) return { ok: false, error: 'Ese dato no existe en el deal.' };
  if (valor == null) return { ok: true, valor: null };
  if (typeof valor !== 'string' && typeof valor !== 'number') return { ok: false, error: 'Ese valor no es un texto.' };
  const t = String(valor).trim();
  if (!t) return { ok: true, valor: null };
  if (t.length > MAX_TEXTO_DEAL) return { ok: false, error: `Es muy largo (máximo ${MAX_TEXTO_DEAL} caracteres).` };
  if (seccion === 'servicio' && (campo === 'fecha_inicio' || campo === 'fecha_termino') && !esFecha(t)) {
    return { ok: false, error: 'La fecha tiene que ser AAAA-MM-DD.' };
  }
  if (seccion === 'fiscal' && campo === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { ok: false, error: 'Ese correo no es válido.' };
  return { ok: true, valor: t };
}

/**
 * MERGE de un campo dentro de su sección: sólo cambia ese campo y lo demás queda (incluido el documento
 * fiscal). Devuelve el valor de antes para el historial y para Deshacer.
 */
export function fusionarCampo(
  actual: Record<string, unknown> | null | undefined,
  campo: string,
  valor: string | null,
): { seccion: Record<string, unknown>; antes: string | null; cambio: boolean } {
  const previo = actual && typeof actual === 'object' && !Array.isArray(actual) ? actual : {};
  const crudo = previo[campo];
  const antes = crudo == null || crudo === '' ? null : String(crudo);
  return { seccion: { ...previo, [campo]: valor }, antes, cambio: antes !== valor };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 · Obligaciones: renglón por renglón
// ─────────────────────────────────────────────────────────────────────────────

export type ParteObligacion = 'cliente' | 'prestador';
export const esParteObligacion = (p: unknown): p is ParteObligacion => p === 'cliente' || p === 'prestador';
export type Obligaciones = { cliente: string[]; prestador: string[] };

/**
 * ⚠️ `esperado` es el texto del renglón que la pantalla VIO. Sin él, dos pestañas sobre la misma lista editan el
 * renglón equivocado: la otra ya quitó el 2 y el 3 pasó a ser el 2. Si no coincide, no se escribe.
 */
export type CambioObligacion =
  | { accion: 'agregar'; parte: ParteObligacion; texto: string; indice?: number | null }
  | { accion: 'editar'; parte: ParteObligacion; indice: number; texto: string; esperado: string }
  | { accion: 'quitar'; parte: ParteObligacion; indice: number; esperado: string };

export const MAX_OBLIGACIONES = 50;
export const MAX_TEXTO_OBLIGACION = 500;
const ROTULO_PARTE: Readonly<Record<ParteObligacion, string>> = { cliente: 'Obligación del cliente', prestador: 'Obligación del prestador' };
export const rotuloObligacion = (p: ParteObligacion): string => ROTULO_PARTE[p];

const listaLimpia = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : []);

/** Las obligaciones de una fila como listas limpias (lo que no es lista, vacío). */
export function obligacionesDe(v: unknown): Obligaciones {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  return { cliente: listaLimpia(o.cliente), prestador: listaLimpia(o.prestador) };
}

/** Aplica un cambio a la lista, o dice por qué no. Devuelve el cambio que lo DESHACE (vuelve la misma lista). */
export function aplicarObligacion(actual: unknown, c: CambioObligacion): Resultado<{
  obligaciones: Obligaciones; antes: string | null; despues: string | null; deshacer: CambioObligacion;
}> {
  if (!c || !esParteObligacion(c.parte)) return { ok: false, error: 'Falta de quién es la obligación (cliente o prestador).' };
  const o = obligacionesDe(actual);
  const lista = o[c.parte].slice();
  const texto = 'texto' in c ? String(c.texto ?? '').trim() : '';
  if ((c.accion === 'agregar' || c.accion === 'editar') && !texto) return { ok: false, error: 'El renglón está vacío.' };
  if (texto.length > MAX_TEXTO_OBLIGACION) return { ok: false, error: `Es muy largo (máximo ${MAX_TEXTO_OBLIGACION} caracteres).` };
  const con = (l: string[]): Obligaciones => ({ ...o, [c.parte]: l });

  if (c.accion === 'agregar') {
    if (lista.length >= MAX_OBLIGACIONES) return { ok: false, error: `Ya hay ${MAX_OBLIGACIONES} renglones.` };
    const pos = Number.isInteger(c.indice) && (c.indice as number) >= 0 && (c.indice as number) <= lista.length ? (c.indice as number) : lista.length;
    lista.splice(pos, 0, texto);
    return { ok: true, obligaciones: con(lista), antes: null, despues: texto, deshacer: { accion: 'quitar', parte: c.parte, indice: pos, esperado: texto } };
  }
  if (!Number.isInteger(c.indice) || c.indice < 0 || c.indice >= lista.length) return { ok: false, error: 'Ese renglón ya no está. Recarga la ficha.' };
  const visto = String(c.esperado ?? '').trim();
  if (lista[c.indice] !== visto) return { ok: false, error: 'La lista cambió mientras la editabas. Recarga la ficha.' };
  if (c.accion === 'editar') {
    const antes = lista[c.indice];
    lista[c.indice] = texto;
    return { ok: true, obligaciones: con(lista), antes, despues: texto, deshacer: { accion: 'editar', parte: c.parte, indice: c.indice, texto: antes, esperado: texto } };
  }
  if (c.accion === 'quitar') {
    const [antes] = lista.splice(c.indice, 1);
    return { ok: true, obligaciones: con(lista), antes, despues: null, deshacer: { accion: 'agregar', parte: c.parte, texto: antes, indice: c.indice } };
  }
  return { ok: false, error: 'Acción desconocida.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 · La venta: monto, plazo, fecha y tipo, de a uno
// ─────────────────────────────────────────────────────────────────────────────

export type CambioVenta =
  /** Pago único → `monto_cierre_usd`; suscripción → la mensualidad (`suscripcion_monto_usd`). null = vaciar. */
  | { campo: 'monto'; valor: number | null }
  /** Sólo una suscripción: los meses del plazo (null = mes a mes). */
  | { campo: 'plazo'; valor: number | null }
  | { campo: 'fecha'; valor: string | null }
  | { campo: 'tipo'; valor: VentaTipo };

export type FilaVenta = {
  venta_tipo?: string | null;
  monto_cierre_usd?: number | string | null;
  suscripcion_monto_usd?: number | string | null;
  suscripcion_meses?: number | string | null;
  fecha_cierre?: string | null;
};

export const MAX_MONTO_USD = 100_000_000;
const num = (v: unknown): number | null => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Qué escribe un cambio de la venta, sobre la fila LEÍDA del server (no sobre lo que vio la pantalla).
 *
 * `tipoEsperado` es el compare-and-set: el update va con `.eq('venta_tipo', tipoEsperado)` (molde de
 * saveDealSectionsAction, deal-actions.ts). Una pantalla vieja no le cuelga una mensualidad a un pago único que
 * otra pestaña ya cambió. null = el cambio no depende del tipo (la fecha).
 *
 * Los cambios de tipo copian al wizard de Ganado (app/crm/actions.ts, «Venta recurrente / suscripción»):
 *   · a suscripción: el monto de cierre queda NULL (una recurrencia no tiene total: contarlo inflaba el revenue
 *     único, lib/venta-tipo.ts) y la mensualidad queda por cargar (la pide «Datos sin marcar»);
 *   · a pago único: la mensualidad y el plazo se vacían;
 *   · a «sin cobro»: el monto es NULL, nunca 0 (lib/lead-desenlace.ts), y se niega si ya hay cuotas cobradas:
 *     un becado no tiene cobrado, y esconder plata que entró es peor que no marcarlo.
 *   · DESDE «sin cobro» no se sale por acá: la salida es `quitarSinCobroAction` (deal-actions.ts), con su propio
 *     compare-and-set. Quien llama lo hace cuando `usarQuitarSinCobro` viene en true.
 *
 * `deshacer` son los cambios que vuelven la fila a como estaba, en orden.
 */
export function patchDeVenta(fila: FilaVenta, c: CambioVenta, opts: { hayCobradas: boolean; impagas: number }): Resultado<{
  patch: Record<string, unknown>; tipoEsperado: VentaTipo | null; nada: boolean; deshacer: CambioVenta[];
}> | { ok: false; error: string; usarQuitarSinCobro: true } {
  const tipo = ventaTipoDe(fila.venta_tipo);
  const montoCierre = num(fila.monto_cierre_usd);
  const mensualidad = num(fila.suscripcion_monto_usd);
  const meses = num(fila.suscripcion_meses);

  if (c.campo === 'monto') {
    if (tipo === VENTA_SIN_COBRO) return { ok: false, error: 'Un becado no tiene monto. Quita «Sin cobro» primero.' };
    let v: number | null = null;
    if (c.valor != null) {
      const n = Number(c.valor);
      if (!Number.isFinite(n) || n <= 0 || n > MAX_MONTO_USD) return { ok: false, error: 'El monto tiene que ser un número mayor a cero.' };
      v = centavos(n);
    }
    const col = tipo === 'suscripcion' ? 'suscripcion_monto_usd' : 'monto_cierre_usd';
    const antes = tipo === 'suscripcion' ? mensualidad : montoCierre;
    return { ok: true, patch: { [col]: v }, tipoEsperado: tipo, nada: antes === v, deshacer: [{ campo: 'monto', valor: antes }] };
  }
  if (c.campo === 'plazo') {
    if (tipo !== 'suscripcion') return { ok: false, error: 'El plazo es de una suscripción.' };
    let v: number | null = null;
    if (c.valor != null) {
      const n = Number(c.valor);
      if (!Number.isInteger(n) || n < 1 || n > 120) return { ok: false, error: 'El plazo va en meses, de 1 a 120 (vacío = mes a mes).' };
      v = n;
    }
    return { ok: true, patch: { suscripcion_meses: v }, tipoEsperado: 'suscripcion', nada: meses === v, deshacer: [{ campo: 'plazo', valor: meses }] };
  }
  if (c.campo === 'fecha') {
    if (c.valor != null && !esFecha(c.valor)) return { ok: false, error: 'La fecha tiene que ser AAAA-MM-DD.' };
    const antes = fila.fecha_cierre ?? null;
    return { ok: true, patch: { fecha_cierre: c.valor ?? null }, tipoEsperado: null, nada: antes === (c.valor ?? null), deshacer: [{ campo: 'fecha', valor: antes }] };
  }
  if (c.campo === 'tipo') {
    const hacia = ventaTipoDe(c.valor);
    if (c.valor !== hacia) return { ok: false, error: 'Ese tipo de venta no existe.' };
    if (hacia === tipo) return { ok: true, patch: {}, tipoEsperado: tipo, nada: true, deshacer: [] };
    if (tipo === VENTA_SIN_COBRO) {
      if (hacia === 'unico') return { ok: false, error: 'Se sale de «Sin cobro» con «Quitar Sin cobro».', usarQuitarSinCobro: true };
      return { ok: false, error: 'Primero quita «Sin cobro»: después elige el tipo.' };
    }
    // Lo que vuelve a dejarla como estaba: el tipo y, después, la plata que el cambio vació.
    const volver: CambioVenta[] = [{ campo: 'tipo', valor: tipo }];
    if (tipo === 'suscripcion') {
      if (mensualidad != null) volver.push({ campo: 'monto', valor: mensualidad });
      if (meses != null) volver.push({ campo: 'plazo', valor: meses });
    } else if (montoCierre != null) {
      volver.push({ campo: 'monto', valor: montoCierre });
    }
    if (hacia === VENTA_SIN_COBRO) {
      if (opts.hayCobradas) return { ok: false, error: 'Ya tiene pagos cobrados: no puede ser un becado.' };
      // ⚠️ Y TAMPOCO CON CUOTAS SIN COBRAR (revisión del 14/10/2026): quedaban vivas, la cobranza le seguía
      // recordando a un becado y el Outstanding las contaba. Primero se quitan (las protegidas, cortando su
      // recordatorio o su link), después se declara.
      if (opts.impagas > 0) return { ok: false, error: `Tiene ${opts.impagas === 1 ? 'una cuota' : `${opts.impagas} cuotas`} sin cobrar: quítalas antes de pasarlo a «Sin cobro».` };
      // Volver de un becado es «Quitar Sin cobro» (queda en pago único) y, si era suscripción, el tipo otra vez.
      const desdeBecado: CambioVenta[] = [{ campo: 'tipo', valor: 'unico' }, ...(tipo === 'suscripcion' ? volver : volver.slice(1))];
      return {
        ok: true, tipoEsperado: tipo, nada: false, deshacer: desdeBecado,
        patch: { venta_tipo: VENTA_SIN_COBRO, monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null },
      };
    }
    if (hacia === 'suscripcion') {
      return { ok: true, tipoEsperado: tipo, nada: false, deshacer: volver, patch: { venta_tipo: 'suscripcion', monto_cierre_usd: null, suscripcion_monto_usd: null, suscripcion_meses: null } };
    }
    return { ok: true, tipoEsperado: tipo, nada: false, deshacer: volver, patch: { venta_tipo: 'unico', suscripcion_monto_usd: null, suscripcion_meses: null } };
  }
  return { ok: false, error: 'Ese dato no es de la venta.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 · Las cuotas: reconciliar POR ID, sin tocar lo que tiene un link o un recordatorio
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Por qué una cuota impaga no se toca entera:
 *   · 'link'         — tiene un link de pago sin pagar (`cobros.pago_id`, pendiente o rechazado). Su FECHA se
 *                      puede mover (el link cobra igual); el MONTO no (el link cobraría otro) y no se borra (el
 *                      pago entraría como una cuota nueva con ésta todavía debiéndose).
 *   · 'recordatorio' — tiene una corrida de cobranza abierta (`flujo_corridas.ctx.cuotaId`, pendiente). No se
 *                      cambia ni se borra: la corrida lleva el monto y el vencimiento de ESTA cuota en su `ctx`
 *                      (lib/cobranza.ts, `datosEstables`) y seguiría mandándolos; y borrada, el pago ya no la
 *                      corta. Para cambiarla, primero se corta el recordatorio.
 */
export type Proteccion = 'link' | 'recordatorio';

export type CuotaExistente = {
  id: number;
  numero: number;
  monto_usd: number;
  fecha_esperada: string | null;
  pagado: boolean;
  /** Una cuota DEVUELTA (reembolso de la pasarela: impaga, sin vencimiento y con proveedor). No es deuda: no se toca. */
  devuelta?: boolean;
  /** Nació cobrada (un pago suelto, una mensualidad a mano, el cobro de un link sin cuota): no es del plan (`esCuotaDelPlan`). */
  nacio_cobrada?: boolean;
  /** La diferencia de un cobro por menos: tampoco es del plan, no ocupa un lugar en 'slots'. */
  resto_de?: number | null;
  protegida?: readonly Proteccion[];
};

export type CuotaDeseada = { id?: number | null; numero?: number | null; monto_usd: number; fecha_esperada: string | null };

/**
 *   · 'porId' — la lista viene de una pantalla con el id de cada cuota (Editar deal): la que trae id se actualiza,
 *               la que no se inserta, y la impaga que no vino es la que la persona quitó.
 *   · 'lista' — la lista viene SIN ids (el wizard de Ganado, la API `guardar_cuotas`): primero se casan las
 *               iguales (mismo monto y vencimiento), después cada protegida con una deseada (no se pueden borrar,
 *               y sin deseada la deuda se duplicaba) y al final, por orden, las que se pueden cambiar enteras.
 *   · 'slots' — un plan uniforme (inicial = número 0, cuota N = número N): se casa por número. Una pagada cubre
 *               su número; es la regla de `savePlanPagos` de siempre. ⚠️ «Número» es el LUGAR en el plan, no el de la
 *               fila (21/10/2026): ver `lugar` adentro.
 */
export type ModoReconciliar = 'porId' | 'lista' | 'slots';

/** Por qué una cuota no se tocó: su link, su recordatorio, o que apareció DESPUÉS de que la pantalla la cargó. */
export type MotivoConservada = Proteccion | 'nueva';

export type PlanDeCuotas = {
  actualizar: Array<{ id: number; numero: number; monto_usd: number; fecha_esperada: string | null; antes: { monto_usd: number; fecha_esperada: string | null } }>;
  insertar: Array<{ numero: number; monto_usd: number; fecha_esperada: string | null }>;
  borrar: Array<{ id: number; numero: number; monto_usd: number; fecha_esperada: string | null }>;
  /** Las que se quisieron cambiar o quitar y no se tocaron, con el porqué (la pantalla lo dice). */
  conservar: Array<{ id: number; numero: number; motivo: MotivoConservada }>;
};

const mismaPlata = (a: number, b: number) => Math.abs(Number(a) - Number(b)) < 0.005;

/**
 * Decide, sin escribir nada, qué se actualiza por id, qué se inserta y qué se borra. Las cuotas PAGADAS y las
 * DEVUELTAS nunca aparecen en el resultado: son historia. Los números nuevos nunca chocan con uno que existe
 * (el índice único es (lead_id, numero)).
 */
export function reconciliarCuotas(
  existentes: readonly CuotaExistente[],
  deseadas: readonly CuotaDeseada[],
  modo: ModoReconciliar,
  /**
   * `soloNumeros` (sólo en 'slots'): las impagas que entran en juego. Las demás no se casan, no se actualizan y no
   * se borran — es lo que usa un AJUSTE del plan (`diferenciaDePlan`) para no tocar una cuota movida a mano ni una
   * que no es del plan. Los números nuevos igual evitan TODAS las que existen (el índice único es por número).
   */
  opts: {
    soloNumeros?: ReadonlySet<number>;
    /**
     * `vistos` (sólo en 'porId'): los ids de las impagas que la PANTALLA tenía cargadas. Una impaga que no vino en la
     * lista se borra sólo si la pantalla la vio (la persona la quitó); si no la vio —nació después: el resto de un
     * pago parcial, una cuota que agregó MaKo— se conserva y se avisa. Sin `vistos`, lo de siempre.
     */
    vistos?: ReadonlySet<number>;
  } = {},
): PlanDeCuotas {
  const out: PlanDeCuotas = { actualizar: [], insertar: [], borrar: [], conservar: [] };
  // ⚠️ EN 'slots' LA CUOTA N ES LA N-ÉSIMA DEL PLAN, NO LA FILA CON EL NÚMERO N (21/10/2026, revisión de f2ec0c948, alta).
  // Un pago suelto toma un número (`registrarPagoSuelto`: el siguiente), y el plan armado después vive en números
  // corridos: la seña es la #1 y las cuotas, la #0, #2, #3 y #4. Casando por el número de la fila, la seña tapaba la
  // cuota 1 (el plan quedaba US$900 corto) o, sin taparla, cada «Cambiar el plan» de la ficha insertaba una cuota de más
  // y dejaba la última sin tocar: US$1.000 de deuda fantasma por cambio. Las del plan (`esCuotaDelPlan`, la MISMA regla
  // que la plata suelta y `avisoPlanUniforme`: revisión de 7524ec1c9) que no están devueltas, en orden: el inicial (la
  // fila 0) es el lugar 0, y las demás, 1, 2, 3… Ni la seña cobrada por link ni la diferencia de un cobro por menos
  // ocupan un lugar.
  const lugarDe = new Map<number, number>();
  if (modo === 'slots') {
    let k = 0;
    for (const q of existentes.filter((x) => esCuotaDelPlan(x) && !x.devuelta).slice().sort((a, b) => a.numero - b.numero)) {
      lugarDe.set(q.id, q.numero === 0 ? 0 : ++k);
    }
  }
  const lugar = (q: CuotaExistente): number | null => (modo === 'slots' ? (lugarDe.get(q.id) ?? null) : q.numero);
  const impagas = existentes
    .filter((q) => !q.pagado && !q.devuelta && (modo !== 'slots' || (lugar(q) != null && (!opts.soloNumeros || opts.soloNumeros.has(lugar(q) as number)))))
    .slice().sort((a, b) => a.numero - b.numero);
  const pagadasNum = new Set(existentes.filter((q) => q.pagado && lugar(q) != null).map((q) => lugar(q) as number));
  const usados = new Set(existentes.map((q) => q.numero));
  const libres = new Set(impagas.map((q) => q.id));
  const prot = (q: CuotaExistente): readonly Proteccion[] => q.protegida ?? [];
  const validas = deseadas
    .map((d) => ({ ...d, monto_usd: centavos(Number(d.monto_usd)), fecha_esperada: d.fecha_esperada ?? null }))
    .filter((d) => Number.isFinite(d.monto_usd) && d.monto_usd > 0);

  /** Casa una deseada con una existente: actualiza lo que se puede, o la conserva y dice por qué. */
  const casar = (q: CuotaExistente, d: CuotaDeseada) => {
    libres.delete(q.id);
    const cambiaMonto = !mismaPlata(q.monto_usd, d.monto_usd);
    const cambiaFecha = (q.fecha_esperada ?? null) !== (d.fecha_esperada ?? null);
    if (!cambiaMonto && !cambiaFecha) return;
    const p = prot(q);
    if (p.includes('recordatorio')) { out.conservar.push({ id: q.id, numero: q.numero, motivo: 'recordatorio' }); return; }
    if (p.includes('link') && cambiaMonto) { out.conservar.push({ id: q.id, numero: q.numero, motivo: 'link' }); return; }
    out.actualizar.push({ id: q.id, numero: q.numero, monto_usd: d.monto_usd, fecha_esperada: d.fecha_esperada ?? null, antes: { monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada ?? null } });
  };

  const sinCasar: CuotaDeseada[] = [];
  if (modo === 'porId') {
    const porId = new Map(impagas.map((q) => [q.id, q]));
    const pagadasId = new Set(existentes.filter((q) => q.pagado || q.devuelta).map((q) => q.id));
    for (const d of validas) {
      const q = d.id != null ? porId.get(d.id) : undefined;
      if (q && libres.has(q.id)) casar(q, d);
      else if (d.id != null && pagadasId.has(d.id)) continue; // una cobrada que vino en la lista: no se toca
      else sinCasar.push(d);
    }
  } else if (modo === 'slots') {
    const porNumero = new Map(impagas.map((q) => [lugar(q) as number, q]));
    for (const d of validas) {
      const n = d.numero;
      // La pagada cubre su número. En un ajuste (`soloNumeros`), sólo si ese número era del plan: una pagada que no
      // es del plan (el resto de un pago parcial) no reemplaza a la cuota nueva que cae en su número.
      if (n != null && pagadasNum.has(n) && (!opts.soloNumeros || opts.soloNumeros.has(n))) continue;
      const q = n != null ? porNumero.get(n) : undefined;
      if (q && libres.has(q.id)) casar(q, d);
      else sinCasar.push(d);
    }
  } else {
    // ⚠️ LAS PROTEGIDAS SE CASAN PRIMERO, ANTES QUE LAS IGUALES, cada una con UNA deseada: (a) una igual, (b) una
    // de su mismo vencimiento, (c) la que sigue en orden. Una protegida (link sin pagar, recordatorio corriendo) no
    // se puede borrar, así que si se queda sin deseada se conserva IGUAL y la deuda se cuenta dos veces. Pasó dos
    // veces en la revisión del 14/10/2026, y la segunda con el arreglo de la primera puesto:
    //   · con las LIBRES casadas por orden antes que ella: A protegida, B y C de 1000, [1500, 1500] → 4000, no 2500;
    //   · con las IGUALES antes que ella, al ACORTAR el plan: A el 01/11 con link, B el 01/12 y C el 01/01, pedidas
    //     sólo las dos últimas → B y C iguales, A sin deseada → 1500, no 1000.
    // `casar` decide qué se le puede cambiar (sólo la fecha si lo único que tiene es un link; nada si tiene un
    // recordatorio) y lo deja en `conservar` con el porqué.
    const igual = (q: CuotaExistente, d: CuotaDeseada) =>
      mismaPlata(q.monto_usd, d.monto_usd) && (q.fecha_esperada ?? null) === (d.fecha_esperada ?? null);
    const resto: CuotaDeseada[] = validas.slice();
    const protegidas = impagas.filter((q) => prot(q).length > 0);
    const tomar = (q: CuotaExistente, cond: (d: CuotaDeseada) => boolean) => {
      if (!libres.has(q.id)) return;
      const i = resto.findIndex(cond);
      if (i >= 0) casar(q, resto.splice(i, 1)[0]);
    };
    for (const q of protegidas) tomar(q, (d) => igual(q, d));
    for (const q of protegidas) tomar(q, (d) => (d.fecha_esperada ?? null) === (q.fecha_esperada ?? null));
    // (c) prefiere una deseada que NO sea idéntica a una cuota libre: si se lleva la igual de otra, a las dos les
    // cambia la identidad (la protegida toma esa fecha y la libre otra) sin que eso cambie la deuda.
    const igualALibre = (d: CuotaDeseada) => impagas.some((x) => libres.has(x.id) && prot(x).length === 0 && igual(x, d));
    for (const q of protegidas) tomar(q, (d) => !igualALibre(d));
    for (const q of protegidas) tomar(q, () => true);
    // Después las libres: las iguales (no cambian de id ni de nada) y por orden.
    const porOrden: CuotaDeseada[] = [];
    for (const d of resto) {
      const q = impagas.find((x) => libres.has(x.id) && igual(x, d));
      if (q) casar(q, d);
      else porOrden.push(d);
    }
    for (const d of porOrden) {
      const q = impagas.find((x) => libres.has(x.id) && prot(x).length === 0);
      if (q) casar(q, d);
      else sinCasar.push(d);
    }
  }

  // Las impagas que nadie pidió: se borran, salvo las protegidas y —en 'porId'— las que la pantalla no vio.
  for (const q of impagas) {
    if (!libres.has(q.id)) continue;
    if (modo === 'porId' && opts.vistos && !opts.vistos.has(q.id)) { out.conservar.push({ id: q.id, numero: q.numero, motivo: 'nueva' }); continue; }
    const p = prot(q);
    if (p.length) out.conservar.push({ id: q.id, numero: q.numero, motivo: p.includes('link') ? 'link' : 'recordatorio' });
    else out.borrar.push({ id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada ?? null });
  }

  // Las nuevas: en 'slots', su número si está libre; si no, después del último que EXISTE (incluidas las que se
  // van a borrar: se insertan antes de borrar, así una falla a mitad de camino deja cuotas de más, no de menos).
  let max = existentes.reduce((m, q) => Math.max(m, q.numero), -1);
  for (const d of sinCasar) {
    let numero: number;
    // En 'porId', una cuota que VUELVE (el Deshacer de un ajuste del plan) recupera su número si está libre: sin eso
    // el cobro inicial volvía como «Cuota N» y su lugar en el plan quedaba vacío (revisión del 16/10/2026).
    if ((modo === 'slots' || modo === 'porId') && d.numero != null && d.numero >= 0 && !usados.has(d.numero)) numero = d.numero;
    else numero = Math.max(max + 1, 1);
    usados.add(numero);
    max = Math.max(max, numero);
    out.insertar.push({ numero, monto_usd: d.monto_usd, fecha_esperada: d.fecha_esperada ?? null });
  }
  return out;
}

/** «Cuota 3» / «Cobro inicial»: cómo se nombra una cuota en el historial. */
export const nombreCuota = (numero: number): string => (numero === 0 ? 'Cobro inicial' : `Cuota ${numero}`);
const textoCuota = (monto: number, fecha: string | null): string => {
  const f = fecha ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}` : 'sin fecha';
  return `USD ${centavos(monto)} · vence ${f}`;
};

/**
 * Las líneas del HISTORIAL de una reconciliación, una por cuota que cambió (antes → después), para insertarlas
 * en `lead_audit` en un solo insert (comparten el instante: la ficha las agrupa como un movimiento).
 */
export function lineasDeCuotas(plan: PlanDeCuotas): Array<{ campo: string; valor_anterior: string | null; valor_nuevo: string | null }> {
  return [
    ...plan.actualizar.map((u) => ({ campo: nombreCuota(u.numero), valor_anterior: textoCuota(u.antes.monto_usd, u.antes.fecha_esperada), valor_nuevo: textoCuota(u.monto_usd, u.fecha_esperada) })),
    ...plan.insertar.map((i) => ({ campo: nombreCuota(i.numero), valor_anterior: null, valor_nuevo: textoCuota(i.monto_usd, i.fecha_esperada) })),
    ...plan.borrar.map((b) => ({ campo: nombreCuota(b.numero), valor_anterior: textoCuota(b.monto_usd, b.fecha_esperada), valor_nuevo: null })),
  ];
}

const MOTIVO_CONSERVADA: Readonly<Record<MotivoConservada, string>> = {
  link: 'tiene un link sin pagar',
  recordatorio: 'tiene un recordatorio en curso',
  nueva: 'apareció después de abrir la pantalla',
};

/** «Cuota 3: tiene un link sin pagar»: lo que NO se tocó, dicho para la persona (y para el historial). */
export function avisoDeConservadas(plan: PlanDeCuotas): string | null {
  if (!plan.conservar.length) return null;
  return plan.conservar.map((c) => `${nombreCuota(c.numero)}: ${MOTIVO_CONSERVADA[c.motivo]}`).join(' · ');
}

export type CuotaDelAsistente = { monto_usd: number; fecha_esperada: string | null };

/**
 * ⚠️ LAS CUOTAS QUE ESCRIBE EL ASISTENTE DEL CRM (`completeStageMoveAction`, 21/10/2026, revisión adversarial, alta).
 * «Un pago suelto no es un plan» no alcanzaba: una suscripción registrada mes a mes (tres mensualidades sueltas) que se
 * abría desde el tablero para cargar el teléfono recibía 12 cuotas MÁS desde hoy (15 para un plazo de 12), y el cliente
 * que pagó el primer mes suelto y se arrastraba a Ganado tenía la cuota de hoy impaga encima del mes ya cobrado. La regla:
 * - Con un plan (una cuota que no nació cobrada, o una impaga), el asistente NO lo toca: se edita en la tab Pagos.
 * - Una suscripción con meses ya cobrados sueltos: esos meses SON las primeras cuotas (como los cuenta `cobradoDelLead`,
 *   uno por cobrada), y se arman sólo los que faltan del plazo. Las fechas van desde `ancla`, el día del cierre: armado
 *   después del Ganado, un plan desde hoy dejaba al cliente al día en «Falta registrar» del 1 al 20 de cada mes.
 * - Las cuotas de un pago único las escribió la persona y no se puede saber si ya descontó lo cobrado: con un pago previo
 *   no se arman (se arman en la tab Pagos), y se dice.
 * Nunca nace una cuota por un mes ya cobrado. `aviso`: lo que no se hizo, o lo que se descontó, dicho para la persona.
 *
 * ⚠️ LOS MESES COBRADOS SE CUENTAN POR PLATA, NO POR FILAS (21/10/2026, quinta revisión). Contando filas, un adelanto de
 * US$1.500 en una suscripción de US$500 cubría UN mes (se armaban 11 cuotas, dos por meses ya pagados: la ficha sumaba
 * US$7.000 sobre 6.000 y la cobranza le reclamaba a quien pagó) y una seña de US$100 cubría un mes ENTERO (los 400 que
 * faltaban no se cobraban nunca). Ahora cada pago suelto tiene que ser meses enteros, con un 10% de UNA mensualidad de
 * tolerancia (el tipo de cambio de un cobro en otra moneda), y de este cierre (no de más de un mes antes). Si no, no se
 * arma y se dice. Y cuando se descuenta, se dice cuántas se armaron.
 * ⚠️ DE A UN PAGO, NO LA SUMA (revisión de 7524ec1c9, alta): la ficha cuenta cada cobrada por separado
 * (`mesesDeUnaCobrada`), y el asistente igual. Con la suma, seis mensualidades de 490 no eran «meses enteros».
 */
export function planDelAsistente(
  pedidas: CuotaDelAsistente[],
  existentes: ReadonlyArray<FilaPrevia>,
  o: { suscripcion: boolean; ancla: string },
): { cuotas: CuotaDelAsistente[]; yaCobradas: number; aviso: string | null } {
  if (!pedidas.length) return { cuotas: [], yaCobradas: 0, aviso: null };
  const previos = pagosPrevios(existentes);
  if (previos.hayPlan) {
    return { cuotas: [], yaCobradas: 0, aviso: 'Ya tenía un plan de pagos: no se cambió. Se edita en la pestaña Pagos.' };
  }
  if (!o.suscripcion) {
    return previos.sueltos.length
      ? { cuotas: [], yaCobradas: 0, aviso: AVISO_PAGOS_SUELTOS }
      : { cuotas: pedidas, yaCobradas: 0, aviso: null };
  }
  const meses = pedidas.map((c, i) => ({ monto_usd: c.monto_usd, fecha_esperada: sumarMeses(o.ancla, i) }));
  if (!previos.sueltos.length) return { cuotas: meses, yaCobradas: 0, aviso: null };
  const mensualidad = Number(pedidas[0].monto_usd);
  const cobrado = previos.cobradoUsd;
  const desde = sumarMeses(o.ancla, -1);
  if (previos.sueltos.some((q) => (q.fecha_pago ?? q.fecha_esperada ?? o.ancla).slice(0, 10) < desde)) {
    return { cuotas: [], yaCobradas: 0, aviso: 'Ya tenía pagos cobrados de antes del cierre, y no se sabe si son de esta suscripción: el plan no se armó. Se arma en la pestaña Pagos.' };
  }
  const porPago = previos.sueltos.map((q) => mesesDeUnaCobrada(q, mensualidad));
  const k = porPago.reduce((s, m) => s + m.meses, 0);
  if (!porPago.every((m) => m.enteros)) {
    return { cuotas: [], yaCobradas: 0, aviso: `Lo ya cobrado (${formatoMonto(cobrado, 'USD')}) no son meses enteros de ${formatoMonto(mensualidad, 'USD')}: el plan no se armó, para no cobrar de más ni de menos. Se arma en la pestaña Pagos.` };
  }
  const yaCobradas = Math.min(k, meses.length);
  const cuotas = meses.slice(yaCobradas);
  const meses_ = yaCobradas === 1 ? 'el primer mes' : `los primeros ${yaCobradas} meses`;
  return {
    cuotas, yaCobradas,
    aviso: cuotas.length
      ? `Lo ya cobrado (${formatoMonto(cobrado, 'USD')}) cuenta como ${meses_}: se armaron ${cuotas.length} ${cuotas.length === 1 ? 'cuota' : 'cuotas'}.`
      : `Lo ya cobrado (${formatoMonto(cobrado, 'USD')}) cubre todo el plazo: no quedó ninguna cuota por armar.`,
  };
}

/** Lo que dicen las filas de `pagos` de un lead que se leen para decidir un plan (todas opcionales: las da `Pago`). */
export type FilaPrevia = {
  pagado?: boolean | null; nacio_cobrada?: boolean | null; resto_de?: number | null; monto_usd?: number | string | null;
  fecha_pago?: string | null; fecha_esperada?: string | null; proveedor?: string | null; cobro_id?: number | null; baja_at?: string | null;
};

export const AVISO_PAGOS_SUELTOS = 'Ya tenía pagos cobrados: el plan no se armó, para no cobrarlos dos veces. Se arma en la pestaña Pagos.';

/**
 * ⚠️ ¿QUÉ ES UN PLAN Y QUÉ ES PLATA SUELTA? (21/10/2026, quinta revisión). La MISMA regla para el asistente de Ganado
 * (`planDelAsistente`) y para el plan uniforme (`savePlanPagos`: la API `guardar_plan_pagos`).
 * - No cuentan las que no son deuda (`noEsDeuda`): una cuota DEVUELTA por un reembolso o la de un cliente que se dio de
 *   baja. Antes, cualquiera de ellas hacía decir «Ya tenía un plan» de un plan que no existe, y nadie lo armaba.
 * - Un plan es una cuota viva sin cobrar, o una cobrada que es del plan (`esCuotaDelPlan`: también la cobrada por link).
 * - Plata suelta (`esPlataSuelta`): lo cobrado que no es del plan. Un pago suelto, una mensualidad a mano y el cobro de
 *   un link que no saldaba ninguna cuota (los tres nacen con `nacio_cobrada`).
 */
export function pagosPrevios(existentes: ReadonlyArray<FilaPrevia>): { hayPlan: boolean; sueltos: FilaPrevia[]; cobradoUsd: number } {
  const vivas = existentes.filter((q) => !noEsDeuda({
    pagado: !!q.pagado, fecha_esperada: q.fecha_esperada ?? null, proveedor: q.proveedor ?? null, cobro_id: q.cobro_id ?? null, baja_at: q.baja_at ?? null,
  }));
  const sueltos = vivas.filter(esPlataSuelta);
  return {
    hayPlan: vivas.some((q) => !esPlataSuelta(q)),
    sueltos,
    cobradoUsd: centavos(sueltos.reduce((s, q) => s + Number(q.monto_usd ?? 0), 0)),
  };
}

/** El plan uniforme NO se arma encima de plata suelta sin plan (la cuota 1 la tapaba una seña): lo mismo que el asistente. */
export const avisoPlanUniforme = (existentes: ReadonlyArray<FilaPrevia>): string | null => {
  const p = pagosPrevios(existentes);
  return !p.hayPlan && p.sueltos.length ? AVISO_PAGOS_SUELTOS : null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5 · El plan uniforme: inicial, cuota, cantidad y día de pago
// ─────────────────────────────────────────────────────────────────────────────

export type PlanUniforme = {
  cobro_inicial_usd: number | null;
  monto_cuota_usd: number | null;
  total_cuotas: number | null;  // 1..6 (CHECK de la mig 0014)
  dia_de_pago: number | null;   // 1..28 (CHECK de la mig 0014)
};

/** Las cuotas deseadas de un plan. Mismo calendario que `savePlanPagos` de siempre (UTC, día capado en 28). */
export function cuotasDelPlan(plan: PlanUniforme, base: string): CuotaDeseada[] {
  const [y, m] = base.split('-').map(Number);
  const fechaCuota = (meses: number, dia: number) => new Date(Date.UTC(y, m - 1 + meses, dia)).toISOString().slice(0, 10);
  const out: CuotaDeseada[] = [];
  if (plan.cobro_inicial_usd && plan.cobro_inicial_usd > 0) out.push({ numero: 0, monto_usd: centavos(plan.cobro_inicial_usd), fecha_esperada: base });
  const dia = plan.dia_de_pago ?? 1;
  if (plan.monto_cuota_usd && plan.monto_cuota_usd > 0) {
    for (let n = 1; n <= (plan.total_cuotas ?? 0); n++) out.push({ numero: n, monto_usd: centavos(plan.monto_cuota_usd), fecha_esperada: fechaCuota(n, dia) });
  }
  return out;
}

/** Valida y limpia un plan uniforme (lo que llega del navegador o de la API). */
export function validarPlan(p: Partial<Record<keyof PlanUniforme, unknown>>): Resultado<{ plan: PlanUniforme }> {
  const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
  const inicial = n(p.cobro_inicial_usd);
  const cuota = n(p.monto_cuota_usd);
  const cantidad = n(p.total_cuotas);
  const dia = n(p.dia_de_pago);
  if (inicial != null && (!Number.isFinite(inicial) || inicial < 0 || inicial > MAX_MONTO_USD)) return { ok: false, error: 'El cobro inicial tiene que ser un número (0 = sin inicial).', faltan: ['cobro_inicial_usd'] };
  if (cuota != null && (!Number.isFinite(cuota) || cuota <= 0 || cuota > MAX_MONTO_USD)) return { ok: false, error: 'La cuota tiene que ser un número mayor a cero.', faltan: ['monto_cuota_usd'] };
  if (!(inicial && inicial > 0) && cuota == null) return { ok: false, error: 'Falta el cobro inicial o el monto de la cuota.', faltan: ['cobro_inicial_usd', 'monto_cuota_usd'] };
  if (cuota != null && (cantidad == null || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 6)) return { ok: false, error: 'La cantidad de cuotas va de 1 a 6.', faltan: ['total_cuotas'] };
  if (dia != null && (!Number.isInteger(dia) || dia < 1 || dia > 28)) return { ok: false, error: 'El día de pago va del 1 al 28.', faltan: ['dia_de_pago'] };
  return {
    ok: true,
    plan: {
      cobro_inicial_usd: inicial != null && inicial > 0 ? centavos(inicial) : null,
      monto_cuota_usd: cuota != null ? centavos(cuota) : null,
      total_cuotas: cuota != null ? cantidad : null,
      dia_de_pago: dia,
    },
  };
}

const CLAVES_PLAN = ['cobro_inicial_usd', 'monto_cuota_usd', 'total_cuotas', 'dia_de_pago'] as const;

/**
 * El plan que queda al AJUSTAR: lo que vino encima de lo que está en la base, validado.
 *
 * ⚠️ UN AJUSTE TRAE SÓLO LO QUE CAMBIÓ. Un bloque que manda `{ cobro_inicial_usd: 500 }` está diciendo «el inicial
 * pasa a 500», no «el plan es sólo un inicial»: escrito como plan entero, `validarPlan` llenaba con null lo que no
 * vino y la reconciliación por número borraba las cuotas 1 a N (revisión del 14/10/2026). Una clave AUSENTE (o
 * `undefined`) se conserva; una clave en `null` se vacía a propósito.
 *
 * ⚠️ Y SIN DÍA DE PAGO NO HAY CUOTAS. `cuotasDelPlan` cae al día 1 cuando falta, y en un lead cuyas cuotas se
 * cargaron a mano (Editar deal, el wizard) la base no tiene plan: mezclar no completa el día y se inventaría el 1.
 * Se pide, con `faltan`, en vez de inventarlo.
 */
export function ajustarSobre(
  antes: PlanUniforme,
  parcial: Partial<Record<keyof PlanUniforme, unknown>> | null | undefined,
): Resultado<{ plan: PlanUniforme }> {
  const mezcla: Partial<Record<keyof PlanUniforme, unknown>> = { ...antes };
  for (const k of CLAVES_PLAN) {
    if (parcial && Object.prototype.hasOwnProperty.call(parcial, k) && parcial[k] !== undefined) mezcla[k] = parcial[k];
  }
  const v = validarPlan(mezcla);
  if (!v.ok) return v;
  if (v.plan.monto_cuota_usd != null && v.plan.dia_de_pago == null) {
    return { ok: false, error: 'Falta el día de pago de las cuotas (del 1 al 28).', faltan: ['dia_de_pago'] };
  }
  return v;
}

/** ¿No hay plan? (ni inicial ni cuotas): el lead tiene sus cuotas cargadas a mano, o ninguna. */
export const planVacio = (p: PlanUniforme): boolean =>
  !(p.cobro_inicial_usd && p.cobro_inicial_usd > 0) && !(p.monto_cuota_usd && p.monto_cuota_usd > 0 && (p.total_cuotas ?? 0) > 0);

/**
 * Lo que un AJUSTE cambia de verdad: las cuotas del plan nuevo cuyo monto o vencimiento difiere del anterior (o que
 * el anterior no generaba), y los números del plan ANTERIOR que hay que tocar (`tocar`: los que cambian o ya no
 * están). Con `reconciliarCuotas(…, 'slots', { soloNumeros: tocar })`, nada fuera de `tocar` se toca.
 *
 * ⚠️ REIMPONER EL PLAN ENTERO PISA LO QUE SE HIZO A MANO (revisión del 14/10/2026): con 1000 + 3×1000 el día 15,
 * la cuota 2 movida al 20/12 y una cuota 4 de 200 (el resto de un pago parcial), cambiar sólo el inicial devolvía
 * la 2 al 15/12 y BORRABA la 4: 3500 en vez de 3700. Una cuota cuyo número el plan anterior no generaba no es del
 * plan: no se toca, y si el plan nuevo crece hasta ese número, la cuota nueva va en otro.
 */
export function diferenciaDePlan(antes: PlanUniforme, despues: PlanUniforme, base: string): { deseadas: CuotaDeseada[]; tocar: Set<number> } {
  const a = new Map(cuotasDelPlan(antes, base).map((c) => [c.numero as number, c]));
  const d = new Map(cuotasDelPlan(despues, base).map((c) => [c.numero as number, c]));
  const deseadas: CuotaDeseada[] = [];
  const tocar = new Set<number>();
  for (const [n, c] of d) {
    const x = a.get(n);
    if (x && mismaPlata(x.monto_usd, c.monto_usd) && x.fecha_esperada === c.fecha_esperada) continue;
    deseadas.push(c);
    if (x) tocar.add(n);
  }
  for (const n of a.keys()) if (!d.has(n)) tocar.add(n);
  return { deseadas, tocar };
}

/**
 * El plan anterior TAL CUAL, para el Deshacer de un ajuste: cada campo limpio por separado (número en su rango, o
 * null). No pasa por `validarPlan` a propósito: un plan anterior todo en null (las cuotas se habían cargado a mano)
 * no es «un plan inválido», es «no había plan», y descartarlo dejaba escrito el plan que se quería deshacer.
 */
export function planComoEstaba(p: Partial<Record<keyof PlanUniforme, unknown>> | null | undefined): PlanUniforme {
  const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const monto = (v: unknown): number | null => { const x = num(v); return x != null && x > 0 && x <= MAX_MONTO_USD ? centavos(x) : null; };
  const entero = (v: unknown, min: number, max: number): number | null => { const x = num(v); return x != null && Number.isInteger(x) && x >= min && x <= max ? x : null; };
  return {
    cobro_inicial_usd: monto(p?.cobro_inicial_usd),
    monto_cuota_usd: monto(p?.monto_cuota_usd),
    total_cuotas: entero(p?.total_cuotas, 1, 6),
    dia_de_pago: entero(p?.dia_de_pago, 1, 28),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · Un pago cargado a mano: moneda, concepto y método (decisión 7)
// ─────────────────────────────────────────────────────────────────────────────

export const METODOS_PAGO = ['transferencia', 'efectivo', 'tarjeta', 'deposito', 'cheque', 'otro'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];
export const ROTULO_METODO: Readonly<Record<MetodoPago, string>> = {
  transferencia: 'Transferencia', efectivo: 'Efectivo', tarjeta: 'Tarjeta', deposito: 'Depósito', cheque: 'Cheque', otro: 'Otro',
};
export const esMetodoPago = (m: unknown): m is MetodoPago => typeof m === 'string' && (METODOS_PAGO as readonly string[]).includes(m);

/** La moneda con la que un negocio que no configuró nada carga sus pagos: lo que hacía todo el CRM hasta hoy. */
export const MONEDA_POR_DEFECTO = 'USD';

/**
 * El pago a mano en la moneda en que se cobró.
 *
 * ⚠️ `montoUsd` SIEMPRE ES DÓLARES, también cuando se cobró en otra moneda: es el número que suman el Dashboard,
 * el Outstanding y la cobranza (`pagos.monto_usd`). En otra moneda, el valor en dólares lo DECLARA la persona
 * (o es el de la cuota que se salda, `montoUsdPorDefecto`): nunca una tasa inventada (AGENTS.md, la pasarela).
 *
 * ⚠️ Y SIN MONEDA ES DÓLARES, no la del negocio. Las pantallas viejas (Editar deal, el «Marcar pagada» de hoy)
 * mandan USD sin decirlo: leerlas con la moneda del negocio convertiría 500 USD en 500 pesos el día que el negocio
 * configure la suya. La moneda del negocio la pone la PANTALLA como valor inicial (`monedaDelNegocioAction`).
 *
 * Devuelve `moneda`/`montoOriginal` en null cuando no vino una moneda: se guarda como siempre (null = USD).
 */
export function pagoEnMoneda(
  p: { montoUsd?: number | null; moneda?: string | null; montoOriginal?: number | null },
  opts: { montoUsdPorDefecto?: number | null } = {},
): Resultado<{ montoUsd: number; moneda: string | null; montoOriginal: number | null }> {
  const pos = (v: unknown): number | null => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= MAX_MONTO_USD ? centavos(Number(v)) : null);
  const crudaMoneda = p.moneda == null || p.moneda === '' ? null : p.moneda;
  const moneda = crudaMoneda == null ? null : normalizarMoneda(crudaMoneda);
  if (crudaMoneda != null && !moneda) return { ok: false, error: 'Esa moneda no existe (va el código de 3 letras: USD, MXN, ARS…).', faltan: ['moneda'] };
  const usd = pos(p.montoUsd) ?? pos(opts.montoUsdPorDefecto);
  if (moneda == null || moneda === 'USD') {
    const m = pos(p.montoUsd) ?? pos(p.montoOriginal) ?? pos(opts.montoUsdPorDefecto);
    if (m == null) return { ok: false, error: 'El monto tiene que ser mayor a cero.', faltan: ['monto'] };
    return { ok: true, montoUsd: m, moneda, montoOriginal: moneda ? m : null };
  }
  const original = pos(p.montoOriginal);
  if (original == null) return { ok: false, error: `Falta cuánto se cobró en ${moneda}.`, faltan: ['montoOriginal'] };
  if (usd == null) return { ok: false, error: `¿Cuánto es en dólares? Hace falta para tus reportes (se cobró en ${moneda}).`, faltan: ['montoUsd'] };
  return { ok: true, montoUsd: usd, moneda, montoOriginal: original };
}

/** Concepto y método de un pago a mano, limpios (vacío = null; un método desconocido es 'otro'). */
export function etiquetaDePago(p: { concepto?: unknown; metodo?: unknown }): { concepto: string | null; metodo: MetodoPago | null } {
  const c = typeof p.concepto === 'string' ? p.concepto.trim().slice(0, 200) : '';
  const m = p.metodo == null || p.metodo === '' ? null : esMetodoPago(p.metodo) ? p.metodo : 'otro';
  return { concepto: c || null, metodo: m };
}

/**
 * COMO SE COBRÓ, dicho por TEXTO (la API de MaKo: WhatsApp, HTTP, un paso de un flujo). Es la misma regla que la
 * ficha (`pagoEnMoneda` + `etiquetaDePago`) con las trampas de un canal sin pantalla que las ponga a la vista:
 *
 * ⚠️ UN `montoOriginal` SIN `moneda` SE RECHAZA, no se lee como dólares. Era el síntoma de Mauricio: «un pago en
 *    pesos por WhatsApp entra como dólares». El modelo que sólo tenía `montoUsd` ponía los pesos ahí y nadie lo
 *    notaba hasta el Dashboard. Sin `moneda` el monto es en DÓLARES (lo de siempre, `pagoEnMoneda`).
 * ⚠️ En otra moneda `montoUsd` lo DECLARA la persona (o es el de la cuota que se salda, `montoUsdPorDefecto`):
 *    nunca una tasa inventada. Sin él, el error pide los dólares.
 * `montoUsd` vuelve null sólo cuando no hay moneda ni monto (cobrar una cuota tal cual).
 */
export function cobroManualDeEntrada(
  i: { montoUsd?: unknown; moneda?: unknown; montoOriginal?: unknown; concepto?: unknown; metodo?: unknown },
  opts: { montoUsdPorDefecto?: number | null } = {},
): Resultado<{ montoUsd: number | null; moneda: string | null; montoOriginal: number | null; concepto: string | null; metodo: MetodoPago | null }> {
  const positivo = (v: unknown): number | null => (v != null && v !== '' && Number.isFinite(Number(v)) && Number(v) > 0 && Number(v) <= MAX_MONTO_USD ? centavos(Number(v)) : null);
  const etiqueta = etiquetaDePago(i);
  const montoUsd = positivo(i.montoUsd);
  const montoOriginal = positivo(i.montoOriginal);
  const moneda = typeof i.moneda === 'string' ? i.moneda.trim() : '';
  if (!moneda) {
    if (i.montoOriginal != null && i.montoOriginal !== '') {
      return { ok: false, error: 'Falta la moneda en que se cobró «montoOriginal» (USD, MXN, ARS…). Sin moneda el monto es en dólares: usa montoUsd.', faltan: ['moneda'] };
    }
    return { ok: true, montoUsd, moneda: null, montoOriginal: null, ...etiqueta };
  }
  const r = pagoEnMoneda({ montoUsd, moneda, montoOriginal }, opts);
  if (!r.ok) return r;
  return { ok: true, montoUsd: r.montoUsd, moneda: r.moneda, montoOriginal: r.montoOriginal, ...etiqueta };
}

/** «USD 500» o, si se cobró en otra moneda, «MXN 8,600 (USD 500)», con el método y el concepto si vinieron. */
export function textoDelCobro(
  montoUsd: number,
  d: { moneda?: string | null; montoOriginal?: number | null; concepto?: unknown; metodo?: unknown },
): string {
  const enOtra = d.moneda && d.moneda !== 'USD' && d.montoOriginal != null;
  const plata = enOtra ? `${formatoMonto(d.montoOriginal as number, d.moneda as string)} (USD ${montoUsd})` : `USD ${montoUsd}`;
  const e = etiquetaDePago(d);
  return [plata, e.metodo ? ROTULO_METODO[e.metodo] : null, e.concepto].filter(Boolean).join(' · ');
}

/**
 * El aviso de un pago a mano SIN moneda en un negocio cuya moneda NO es dólares. ⚠️ Sin moneda un pago es en dólares
 * (`pagoEnMoneda`): un modelo que oye «me pagó 500 mil» y no pasa `moneda` lo registra en USD sin que nadie lo vea
 * hasta el Dashboard. El aviso va en el RESUMEN que la persona confirma, que es lo único que mira antes del «sí».
 */
export function avisoMonedaPorOmision(monedaDelNegocio: string | null | undefined, dijoMoneda: boolean): string {
  if (dijoMoneda) return '';
  const m = normalizarMoneda(monedaDelNegocio);
  if (!m || m === MONEDA_POR_DEFECTO) return '';
  return ` Queda en dólares (USD) porque no se dijo otra moneda, y la moneda del negocio es ${m}: si se cobró en ${m}, dímelo antes de confirmar.`;
}
