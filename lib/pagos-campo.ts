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
import { normalizarMoneda } from './pasarela-moneda';
import { VENTA_SIN_COBRO, ventaTipoDe, type VentaTipo } from './venta-tipo';

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
export function patchDeVenta(fila: FilaVenta, c: CambioVenta, opts: { hayCobradas: boolean }): Resultado<{
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
 *               su número; es la regla de `savePlanPagos` de siempre.
 */
export type ModoReconciliar = 'porId' | 'lista' | 'slots';

export type MotivoConservada = Proteccion;

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
export function reconciliarCuotas(existentes: readonly CuotaExistente[], deseadas: readonly CuotaDeseada[], modo: ModoReconciliar): PlanDeCuotas {
  const out: PlanDeCuotas = { actualizar: [], insertar: [], borrar: [], conservar: [] };
  const impagas = existentes.filter((q) => !q.pagado && !q.devuelta).slice().sort((a, b) => a.numero - b.numero);
  const pagadasNum = new Set(existentes.filter((q) => q.pagado).map((q) => q.numero));
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
    const porNumero = new Map(impagas.map((q) => [q.numero, q]));
    for (const d of validas) {
      const n = d.numero;
      if (n != null && pagadasNum.has(n)) continue; // la pagada cubre su número
      const q = n != null ? porNumero.get(n) : undefined;
      if (q && libres.has(q.id)) casar(q, d);
      else sinCasar.push(d);
    }
  } else {
    // 'lista': las iguales primero (no cambian de id ni de nada), después por orden.
    const resto: CuotaDeseada[] = [];
    for (const d of validas) {
      const q = impagas.find((x) => libres.has(x.id) && mismaPlata(x.monto_usd, d.monto_usd) && (x.fecha_esperada ?? null) === (d.fecha_esperada ?? null));
      if (q) casar(q, d);
      else resto.push(d);
    }
    // ⚠️ LAS PROTEGIDAS SE CASAN PRIMERO, cada una con una deseada (la de su mismo vencimiento si la hay; si no,
    // la que sigue en orden). Una protegida no se puede borrar, así que si se queda sin deseada se conserva IGUAL
    // y su deseada termina en `insertar`: la misma deuda contada dos veces. Pasaba (revisión del 14/10/2026):
    // con A protegida, B y C de 1000 y [1500, 1500], las libres se llevaban las dos deseadas, A quedaba
    // conservada y el total daba 4000 en vez de 2500. `casar` ya decide qué se le puede cambiar a una protegida
    // (sólo la fecha si lo único que tiene es un link; nada si tiene un recordatorio) y lo dice en `conservar`.
    const protegidas = impagas.filter((q) => libres.has(q.id) && prot(q).length > 0);
    for (const q of protegidas) {
      const i = resto.findIndex((d) => (d.fecha_esperada ?? null) === (q.fecha_esperada ?? null));
      if (i >= 0) casar(q, resto.splice(i, 1)[0]);
    }
    for (const q of protegidas) {
      if (libres.has(q.id) && resto.length) casar(q, resto.shift()!);
    }
    // Después, por orden, sobre las que se pueden cambiar enteras.
    for (const d of resto) {
      const q = impagas.find((x) => libres.has(x.id) && prot(x).length === 0);
      if (q) casar(q, d);
      else sinCasar.push(d);
    }
  }

  // Las impagas que nadie pidió: se borran, salvo las protegidas.
  for (const q of impagas) {
    if (!libres.has(q.id)) continue;
    const p = prot(q);
    if (p.length) out.conservar.push({ id: q.id, numero: q.numero, motivo: p.includes('link') ? 'link' : 'recordatorio' });
    else out.borrar.push({ id: q.id, numero: q.numero, monto_usd: Number(q.monto_usd), fecha_esperada: q.fecha_esperada ?? null });
  }

  // Las nuevas: en 'slots', su número si está libre; si no, después del último que EXISTE (incluidas las que se
  // van a borrar: se insertan antes de borrar, así una falla a mitad de camino deja cuotas de más, no de menos).
  let max = existentes.reduce((m, q) => Math.max(m, q.numero), -1);
  for (const d of sinCasar) {
    let numero: number;
    if (modo === 'slots' && d.numero != null && d.numero >= 0 && !usados.has(d.numero)) numero = d.numero;
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
};

/** «Cuota 3: tiene un link sin pagar»: lo que NO se tocó, dicho para la persona (y para el historial). */
export function avisoDeConservadas(plan: PlanDeCuotas): string | null {
  if (!plan.conservar.length) return null;
  return plan.conservar.map((c) => `${nombreCuota(c.numero)}: ${MOTIVO_CONSERVADA[c.motivo]}`).join(' · ');
}

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
