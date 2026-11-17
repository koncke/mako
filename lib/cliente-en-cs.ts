// =============================================================================
// cliente-en-cs — lo que dibuja el bloque «Cliente en CS» de la tab Pagos (puro)
// =============================================================================
// docs/diseno-ficha-bloques.md, fila `cliente-en-cs`: «En un ganado: estado del cliente, etapa de entrega y desde
// cuándo, acceso al curso y su cuenta de MaKo. Si está de baja con cuotas impagas, avisa que se le siguen cobrando.
// Cierra con «Abrir en Customer Success».» Es de SÓLO LECTURA: cada dato ya tiene su único escritor en Customer
// Success (la etapa, `moverClienteDeEtapa` en lib/cs-mover-etapa.ts; el estado, la ficha de CS; el acceso, FichaCurso).
//
// Sin 'use client' ni 'server-only' a propósito: lo lee la action (app/crm/lead-view/ficha/pagos/cliente-en-cs-actions.ts,
// que arma `ClienteEnCsLeido`), lo dibuja el componente (./cliente-en-cs.tsx de esa carpeta) y un test lo EJECUTA
// (tests/ficha-cliente-en-cs.test.ts). Aquí no se lee ni se escribe nada.
//
// ⚠️ LO QUE NO SE PUDO LEER SE DICE, NUNCA UN DEFAULT. Cada parte viaja como `Lectura`: `{ ok: false }` es «no pude
//    leerlo», y es otra cosa que el dato vacío. Sin esto, «no pude leer el acceso» se dibujaba igual que «sin acceso»
//    (`accesoDe` devuelve null cuando nunca se le dio, y tira cuando la base no contesta).
// ⚠️ LA BAJA NO CORTA LA COBRANZA, y por eso existe el aviso: `getCuotasPendientes` (lib/pagos.ts) y
//    `disparosDeCobranza` (lib/cobranza.ts) no miran `cs_clientes.estado`. Lo que sí la corta es «Baja del cliente» en
//    Cuotas (lib/pagos-baja.ts): deja la cuota sin vencimiento. Por eso «se le sigue cobrando» es EXACTAMENTE lo que lee
//    la cobranza: impaga y con `fecha_esperada` (`cuotasQueSeSiguenCobrando`). Una de baja o devuelta no tiene fecha.
// ⚠️ LA ETAPA ES LA DEL KANBAN: sin fila en `cliente_entrega`, la PRIMERA (y sin reloj: nadie la movió, `tiempoEnEtapa`
//    da null); con una fila que nombra una etapa borrada, ninguna (se dice, no se le inventa la primera). Es la regla de
//    `repartirEnEtapas` (lib/servicio-etapas.ts) y de `avanceDeCurso` (lib/curso-resumen.ts).
// ⚠️ UN VIDEO «SIN MEDIR» NO ES 0%: `pctVisto` null con videos de Drive o Loom dice «Videos sin medir» (lib/curso.ts,
//    `vistoDeEtapa`).
// =============================================================================

import type { Tono } from './cobrado-lead';
import { mailDeAccesoNoSalio } from './cobros-reglas';
import { fechaEnPalabras } from './date-utils';
import { usd } from './pagos-vistazo';
import { RUTA_CLIENTES } from './clients-rutas';
import { PARAM_CLIENTE } from '../app/plan/board/filtro-cliente';
import { tiempoEnEtapa } from '../app/customer-success/en-etapa';

// ── Lo leído (lo arma la action) ─────────────────────────────────────────────

/** Una lectura que puede fallar: `{ ok: false }` = no se pudo leer (no es «no hay»). */
export type Lectura<T> = { ok: true; dato: T } | { ok: false };

export const ESTADOS_CS = ['activo', 'graduado', 'baja', 'pausado'] as const;
/** `cs_clientes.estado` (mig 0129). Sin fila = 'activo' (`estadoGuardadoDe`, lib/api-mako/areas/cs.helpers.ts). */
export type EstadoCs = (typeof ESTADOS_CS)[number];
export const esEstadoCs = (x: unknown): x is EstadoCs => typeof x === 'string' && (ESTADOS_CS as readonly string[]).includes(x);

export type EstadoLeido = { estado: EstadoCs; motivo: string | null; desde: string | null };

/** Una etapa de la entrega de un producto: la clave estable y su rótulo. */
export type EtapaLeida = { key: string; label: string };

/** El avance del curso en la etapa actual (`avanceDeCurso`, lib/curso-resumen.ts). */
export type CursoLeido = {
  /** % visto sobre los videos MEDIBLES de su etapa. null = no hay ninguno medible (no es 0). */
  pctVisto: number | null;
  videosSinMedir: number;
  tareasEnviadas: number;
  tareas: number;
  /** La regla que lo mueve: envió todas las obligatorias. null = sin etapa actual. */
  etapaCompleta: boolean | null;
};

/** En qué etapa de la entrega de UN producto está el cliente. */
export type EntregaLeida = {
  productoId: number;
  /** El nombre del producto; null si no se pudo leer (se dibuja «Entrega» a secas). */
  producto: string | null;
  /** La etapa ESCRITA en `cliente_entrega`; null = sin fila (está en la primera). */
  etapaGuardada: string | null;
  /** `cliente_entrega.etapa_desde`: desde cuándo está en esa etapa. null sin fila. */
  etapaDesde: string | null;
  /** Las etapas del producto (lectura ESTRICTA, `entregaDeProductoEstricta`). null = no se pudieron leer. */
  etapas: readonly EtapaLeida[] | null;
  /** El curso de ese producto. `dato: null` = el producto no tiene curso. */
  curso: Lectura<CursoLeido | null>;
};

/** El acceso al portal del curso (`accesoDe`, lib/curso-datos.ts): sólo lo que el bloque dice. */
export type AccesoLeidoCs = {
  revocado: boolean; ingresos: number; ultimoIngresoAt: string | null; invitacionEnviadaAt: string | null; linkEnviadoAt: string | null;
};

/** `cobros.alta_estado` (lib/cobros-tipos.ts, `EstadoAlta`). */
export type EstadoAltaCs = 'pendiente' | 'hecha' | 'ya_tenia_cuenta' | 'error';
export const esEstadoAltaCs = (x: unknown): x is EstadoAltaCs => x === 'pendiente' || x === 'hecha' || x === 'ya_tenia_cuenta' || x === 'error';
/** El alta automática de un cobro de un plan de MaKo (lib/cobros.ts, `altaSiCorresponde`). */
export type AltaLeida = { estado: EstadoAltaCs | null; motivo: string | null; creadoAt: string | null };
/** Su cuenta de MaKo: el workspace que se le abrió (`leads.cliente_ws`, mig 0175) y las altas de sus cobros. */
export type CuentaLeida = { clienteWs: number | null; altas: readonly AltaLeida[] };

export type ClienteEnCsLeido = {
  leadId: number;
  /** Sólo un ganado es un cliente de Customer Success. */
  ganado: boolean;
  /** La cuenta tiene la tab Clients (la capa `customer-success`). Sin ella el bloque no tiene nada que decir. */
  conClients: boolean;
  estado: Lectura<EstadoLeido>;
  entregas: Lectura<readonly EntregaLeida[]>;
  /** `dato: null` = nunca se le dio el acceso. */
  acceso: Lectura<AccesoLeidoCs | null>;
  cuenta: Lectura<CuentaLeida>;
};

/** Lo mínimo de una cuota para el aviso (las filas de `ctx.data.pagos`). */
export type CuotaParaAviso = { pagado: boolean; fecha_esperada: string | null; monto_usd: number | string | null };

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

/** El tono de lib/cobrado-lead.ts: el componente lo pasa por `TONO_UI` (./pagos/piezas.tsx). */
export type TonoCs = Tono;
export type ParteCs = 'estado' | 'entrega' | 'curso' | 'acceso' | 'cuenta';

/** Un renglón del diseño «tarjeta»; su `corto` es el chip del diseño «chips». */
export type RenglonCs = { clave: string; parte: ParteCs; rotulo: string; texto: string; detalle: string | null; corto: string; tono: TonoCs };

/** Un paso de «Listo para entregar». `no-se` = no se pudo leer. */
export type PasoCs = { clave: string; texto: string; hecho: 'si' | 'no' | 'no-se'; detalle: string | null };

export type VistaClienteEnCs = {
  /** El chip de la derecha del título: el estado en Customer Success. */
  estado: { texto: string; tono: TonoCs };
  /** Lo que va en grande cuando la tab va épica: la etapa del primer producto, o el estado. */
  titular: { texto: string; detalle: string | null; tono: TonoCs };
  renglones: RenglonCs[];
  chips: Array<{ clave: string; texto: string; tono: TonoCs }>;
  pasos: PasoCs[];
  /** Cuántos pasos están hechos. */
  listos: number;
  /** «Se dio de baja, pero se le siguen cobrando…». null = no hay nada que avisar. */
  aviso: string | null;
  /** Lo que no se pudo leer, en palabras («el acceso al curso»). */
  noLeido: string[];
  /** La ficha del cliente en Customer Success (Classroom › Clients, `?cliente=`). */
  href: string;
};

export const DISENOS_CLIENTE_EN_CS = ['chips', 'checklist', 'tarjeta'] as const;

const NO_SE = 'No se pudo leer';
/** El motivo de la baja lo escribe una persona: largo no entra en un renglón. */
const TOPE_MOTIVO = 120;
const recortar = (s: string, n = TOPE_MOTIVO): string => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Los rótulos del estado, NEUTROS EN GÉNERO (regla de la casa): «Se graduó», no «Graduado»; «En pausa», no «Pausado».
 * El estado es del cliente, y quien lee no sabe si es un cliente o una clienta.
 */
const ESTADO: Readonly<Record<EstadoCs, { texto: string; tono: TonoCs }>> = {
  activo: { texto: 'En el programa', tono: 'verde' },
  pausado: { texto: 'En pausa', tono: 'ambar' },
  baja: { texto: 'Se dio de baja', tono: 'rojo' },
  graduado: { texto: 'Se graduó', tono: 'gris' },
};

/** ¿El bloque no aplica a este lead? Sólo un ganado es cliente: es lo que usa su `estaVacio`. */
export const sinClienteEnCs = (lead: { estado_lead?: string | null }): boolean => lead.estado_lead !== 'ganado';

/** La ficha del cliente en Customer Success. El `?ws=` del super admin lo pega el `Link` de app/_ui. */
export const hrefClienteEnCs = (leadId: number): string => `${RUTA_CLIENTES}?${PARAM_CLIENTE}=${leadId}`;

/**
 * Las cuotas que la cobranza le sigue recordando: impagas y CON vencimiento. Es la misma condición que
 * `getCuotasPendientes` (lib/pagos.ts: `pagado = false` y `fecha_esperada` no nula). Una cuota dada de baja o devuelta
 * queda sin fecha, así que no entra.
 */
export const cuotasQueSeSiguenCobrando = <Q extends CuotaParaAviso>(cuotas: readonly Q[]): Q[] =>
  cuotas.filter((q) => !q.pagado && !!q.fecha_esperada);

const fecha = (iso: string | null | undefined, hoy: string): string | null => (iso ? fechaEnPalabras(iso.slice(0, 10), hoy) : null);
const juntar = (...xs: Array<string | null | undefined>): string | null => xs.filter(Boolean).join(' · ') || null;

/** Del cobro con un plan de MaKo, el alta que cuenta: la más avanzada y, empatadas, la más nueva. */
const RANGO_ALTA: Readonly<Record<EstadoAltaCs, number>> = { hecha: 4, ya_tenia_cuenta: 3, pendiente: 2, error: 1 };
export function altaQueCuenta(altas: readonly AltaLeida[]): (AltaLeida & { estado: EstadoAltaCs }) | null {
  const vivas = altas.filter((a): a is AltaLeida & { estado: EstadoAltaCs } => a.estado != null);
  vivas.sort((a, b) => RANGO_ALTA[b.estado] - RANGO_ALTA[a.estado] || String(b.creadoAt ?? '').localeCompare(String(a.creadoAt ?? '')));
  return vivas[0] ?? null;
}

type Pieza = { renglon: RenglonCs | null; paso: PasoCs['hecho'] };

/** El renglón de la entrega de UN producto, y si cuenta como «está en la entrega». */
function piezaDeEntrega(e: EntregaLeida, varias: boolean, ahora: number): Pieza {
  const rotulo = varias && e.producto ? `Entrega · ${e.producto}` : 'Entrega';
  const clave = `entrega-${e.productoId}`;
  const base = { clave, parte: 'entrega' as const, rotulo };
  // Sin las etapas no hay rótulo que decir: la clave suelta («hito1») es un código, no un nombre.
  if (!e.etapas) return { renglon: { ...base, texto: `${NO_SE} la etapa`, detalle: null, corto: `${NO_SE} la etapa`, tono: 'gris' }, paso: 'no-se' };
  const guardada = (e.etapaGuardada ?? '').trim();
  if (!guardada) {
    const primera = e.etapas[0];
    if (!primera) return { renglon: null, paso: 'no' };
    // Sin fila está en la PRIMERA (la regla del kanban) y su reloj no arrancó: no se inventa un «entró hace».
    return { renglon: { ...base, texto: primera.label, detalle: 'Sin movimientos todavía', corto: primera.label, tono: 'gris' }, paso: 'si' };
  }
  const etapa = e.etapas.find((x) => x.key === guardada);
  // Una fila que nombra una etapa que el catálogo ya no tiene: no se dibuja en ninguna columna del kanban.
  if (!etapa) return { renglon: { ...base, texto: 'Su etapa ya no existe', detalle: 'Se corrige en Customer Success', corto: 'Etapa borrada', tono: 'ambar' }, paso: 'no' };
  const t = tiempoEnEtapa(e.etapaDesde, ahora);
  const detalle = t ? `entró ${t.frase}` : null;
  // El mismo «trabado» que el kanban (21 días): en ámbar.
  return { renglon: { ...base, texto: etapa.label, detalle, corto: juntar(etapa.label, detalle) ?? etapa.label, tono: t?.trabado ? 'ambar' : 'gris' }, paso: 'si' };
}

/** El renglón del curso de UN producto. null = el producto no tiene curso, o no hay nada medido que decir. */
function renglonDeCurso(e: EntregaLeida, varias: boolean): RenglonCs | null {
  const rotulo = varias && e.producto ? `Curso · ${e.producto}` : 'Curso';
  const base = { clave: `curso-${e.productoId}`, parte: 'curso' as const, rotulo };
  if (!e.curso.ok) return { ...base, texto: `${NO_SE} el avance`, detalle: null, corto: `${NO_SE} el avance del curso`, tono: 'gris' };
  const c = e.curso.dato;
  if (!c) return null;
  const visto = c.pctVisto != null ? `${c.pctVisto}% visto` : c.videosSinMedir > 0 ? 'Videos sin medir' : null;
  const tareas = c.tareas > 0 ? `${c.tareasEnviadas} de ${c.tareas} ${c.tareas === 1 ? 'tarea' : 'tareas'}` : null;
  const texto = juntar(visto, tareas);
  if (!texto) return null;
  const sinMedir = c.pctVisto != null && c.videosSinMedir > 0
    ? `y ${c.videosSinMedir} ${c.videosSinMedir === 1 ? 'video' : 'videos'} sin medir`
    : null;
  return { ...base, texto, detalle: sinMedir ?? (c.etapaCompleta ? 'Completó su etapa' : null), corto: texto, tono: c.etapaCompleta ? 'verde' : 'gris' };
}

/** El acceso al portal del curso. */
function piezaDeAcceso(a: Lectura<AccesoLeidoCs | null>, hoy: string): Pieza & { renglon: RenglonCs } {
  const base = { clave: 'acceso', parte: 'acceso' as const, rotulo: 'Acceso al curso' };
  if (!a.ok) return { renglon: { ...base, texto: NO_SE, detalle: null, corto: `${NO_SE} el acceso al curso`, tono: 'gris' }, paso: 'no-se' };
  const x = a.dato;
  if (!x) return { renglon: { ...base, texto: 'Sin acceso todavía', detalle: null, corto: 'Sin acceso al curso', tono: 'ambar' }, paso: 'no' };
  if (x.revocado) return { renglon: { ...base, texto: 'Acceso cortado', detalle: null, corto: 'Acceso al curso cortado', tono: 'ambar' }, paso: 'no' };
  if (x.ingresos > 0) {
    const texto = `Entró ${x.ingresos} ${x.ingresos === 1 ? 'vez' : 'veces'}`;
    const ultima = fecha(x.ultimoIngresoAt, hoy);
    return { renglon: { ...base, texto, detalle: ultima ? `la última, el ${ultima}` : null, corto: `${texto} al curso`, tono: 'verde' }, paso: 'si' };
  }
  // «Tiene fila» no es «lo invitaron» (mig 0206): lo dice la fecha del mail o la del link por WhatsApp.
  const invitado = fecha(x.invitacionEnviadaAt, hoy);
  const link = fecha(x.linkEnviadoAt, hoy);
  const detalle = invitado ? `Invitación enviada el ${invitado}` : link ? `Link enviado el ${link}` : null;
  return { renglon: { ...base, texto: 'Todavía no entra', detalle, corto: 'No entró al curso todavía', tono: 'ambar' }, paso: 'si' };
}

/** Su cuenta de MaKo. `renglon: null` = no aplica (no compró un plan de MaKo ni se le abrió una cuenta). */
function piezaDeCuenta(c: Lectura<CuentaLeida>): Pieza {
  const base = { clave: 'cuenta', parte: 'cuenta' as const, rotulo: 'Cuenta de MaKo' };
  if (!c.ok) return { renglon: { ...base, texto: NO_SE, detalle: null, corto: `${NO_SE} la cuenta de MaKo`, tono: 'gris' }, paso: 'no-se' };
  const alta = altaQueCuenta(c.dato.altas);
  if (alta?.estado === 'hecha') {
    // ⚠️ «Le llegó el acceso» SÓLO si el mail salió (lib/cobros.ts): con el mail caído el alta queda 'hecha' igual.
    return mailDeAccesoNoSalio(alta.motivo)
      ? { renglon: { ...base, texto: 'Creada', detalle: 'El mail de acceso no salió: pásale el acceso a mano.', corto: 'Cuenta de MaKo sin mail de acceso', tono: 'ambar' }, paso: 'si' }
      : { renglon: { ...base, texto: 'Creada', detalle: null, corto: 'Cuenta de MaKo creada', tono: 'verde' }, paso: 'si' };
  }
  if (alta?.estado === 'ya_tenia_cuenta') {
    return { renglon: { ...base, texto: 'Ya tenía una cuenta', detalle: alta.motivo ? recortar(alta.motivo) : 'El plan no se cambió solo.', corto: 'Ya tenía cuenta de MaKo', tono: 'ambar' }, paso: 'si' };
  }
  if (alta?.estado === 'pendiente') return { renglon: { ...base, texto: 'Creándose', detalle: null, corto: 'Creando su cuenta de MaKo', tono: 'gris' }, paso: 'no' };
  if (alta?.estado === 'error') {
    return { renglon: { ...base, texto: 'El alta falló', detalle: alta.motivo ? recortar(alta.motivo) : null, corto: 'Falló el alta en MaKo', tono: 'rojo' }, paso: 'no' };
  }
  if (c.dato.clienteWs != null) return { renglon: { ...base, texto: 'Tiene cuenta', detalle: null, corto: 'Tiene cuenta de MaKo', tono: 'verde' }, paso: 'si' };
  return { renglon: null, paso: 'no' };
}

/**
 * Lo que dibuja el bloque. null = no hay nada que decir: no es un ganado, la cuenta no tiene Clients, o es un cliente
 * en el programa, sin entrega, sin acceso ni cuenta de MaKo y sin nada que avisar (todo leído).
 */
export function vistaClienteEnCs(p: {
  leido: ClienteEnCsLeido;
  /** Las cuotas de la ficha (`ctx.data.pagos`, y las de sus CRM agregados). */
  cuotas: readonly CuotaParaAviso[];
  /** Una suscripción no se da de baja en Cuotas: se cancela (lib/pagos-baja.ts). */
  esSuscripcion: boolean;
  /** El día del negocio, AAAA-MM-DD (`ctx.hoy`). */
  hoy: string;
  /** Ahora en ms: para «entró hace 3 días». Es un parámetro para que el test no dependa del reloj. */
  ahora: number;
}): VistaClienteEnCs | null {
  const { leido, hoy, ahora } = p;
  if (!leido.ganado || !leido.conClients) return null;

  const renglones: RenglonCs[] = [];
  const pasos: PasoCs[] = [];
  const noLeido: string[] = [];

  // ── El estado en Customer Success ──
  const st = leido.estado;
  const estado = st.ok ? ESTADO[st.dato.estado] : { texto: `${NO_SE} el estado`, tono: 'gris' as const };
  if (st.ok) {
    const desde = st.dato.estado !== 'activo' ? fecha(st.dato.desde, hoy) : null;
    const detalle = juntar(desde ? `desde el ${desde}` : null, st.dato.motivo?.trim() ? recortar(st.dato.motivo.trim()) : null);
    renglones.push({ clave: 'estado', parte: 'estado', rotulo: 'Estado', texto: estado.texto, detalle, corto: estado.texto, tono: estado.tono });
    pasos.push({ clave: 'estado', texto: 'Sigue en el programa', hecho: st.dato.estado === 'activo' ? 'si' : 'no', detalle: st.dato.estado === 'activo' ? null : estado.texto });
  } else {
    noLeido.push('el estado');
    renglones.push({ clave: 'estado', parte: 'estado', rotulo: 'Estado', texto: NO_SE, detalle: null, corto: estado.texto, tono: 'gris' });
    pasos.push({ clave: 'estado', texto: 'Sigue en el programa', hecho: 'no-se', detalle: null });
  }

  // ── La entrega y el curso, producto por producto ──
  let hayCurso = false;
  if (leido.entregas.ok) {
    const lista = leido.entregas.dato;
    const varias = lista.length > 1;
    const hechos: Array<PasoCs['hecho']> = [];
    let primera: RenglonCs | null = null;
    // Producto por producto, la entrega y debajo su curso: con dos servicios, cada curso queda junto a su etapa.
    for (const e of lista) {
      const x = piezaDeEntrega(e, varias, ahora);
      hechos.push(x.paso);
      if (x.renglon) { renglones.push(x.renglon); if (!primera) primera = x.renglon; }
      if (!e.etapas && !noLeido.includes('la etapa')) noLeido.push('la etapa');
      if (!e.curso.ok || e.curso.dato) hayCurso = true;
      if (!e.curso.ok && !noLeido.includes('el avance del curso')) noLeido.push('el avance del curso');
      const c = renglonDeCurso(e, varias);
      if (c) renglones.push(c);
    }
    // «Está en la entrega» si alguna etapa se sabe; «no se sabe» si ninguna se sabe y alguna no se pudo leer.
    const hecho = hechos.includes('si') ? 'si' : hechos.includes('no-se') ? 'no-se' : 'no';
    pasos.push({ clave: 'entrega', texto: 'Está en la entrega', hecho, detalle: hecho === 'si' && primera ? primera.texto : null });
  } else {
    noLeido.push('la entrega');
    renglones.push({ clave: 'entrega', parte: 'entrega', rotulo: 'Entrega', texto: NO_SE, detalle: null, corto: `${NO_SE} la entrega`, tono: 'gris' });
    pasos.push({ clave: 'entrega', texto: 'Está en la entrega', hecho: 'no-se', detalle: null });
  }

  // ── El acceso al curso: sólo si hay un curso, o si ya tiene uno, o si no se sabe si hay ──
  const conAcceso = leido.acceso.ok && leido.acceso.dato != null;
  const mostrarAcceso = hayCurso || conAcceso || !leido.entregas.ok;
  if (mostrarAcceso) {
    const a = piezaDeAcceso(leido.acceso, hoy);
    renglones.push(a.renglon);
    pasos.push({ clave: 'acceso', texto: 'Tiene acceso al curso', hecho: a.paso, detalle: a.paso === 'no' ? a.renglon.texto : null });
    if (!leido.acceso.ok) noLeido.push('el acceso al curso');
  }

  // ── Su cuenta de MaKo: sólo si aplica (o si no se pudo leer) ──
  const cuenta = piezaDeCuenta(leido.cuenta);
  if (cuenta.renglon) {
    renglones.push(cuenta.renglon);
    pasos.push({ clave: 'cuenta', texto: 'Tiene su cuenta de MaKo', hecho: cuenta.paso, detalle: cuenta.paso === 'no' ? cuenta.renglon.texto : null });
    if (!leido.cuenta.ok) noLeido.push('la cuenta de MaKo');
  }

  // ── El aviso: de baja, con cuotas que la cobranza le sigue recordando ──
  let aviso: string | null = null;
  if (st.ok && st.dato.estado === 'baja') {
    const siguen = cuotasQueSeSiguenCobrando(p.cuotas);
    if (siguen.length) {
      const total = siguen.reduce((s, q) => s + (Number.isFinite(Number(q.monto_usd)) ? Number(q.monto_usd) : 0), 0);
      const cuantas = siguen.length === 1 ? '1 cuota' : `${siguen.length} cuotas`;
      aviso = `Se dio de baja, pero se le siguen cobrando ${cuantas} (${usd(total)}). `
        + (p.esSuscripcion ? 'Para cortarlo, cancela la suscripción.' : 'Para cortarlo, «Baja del cliente» en Cuotas.');
    }
  }

  // Nada que decir: en el programa, sin entrega, sin acceso, sin cuenta y sin aviso (y todo leído).
  const soloEstado = renglones.length === 1 && renglones[0].parte === 'estado';
  if (soloEstado && st.ok && st.dato.estado === 'activo' && !aviso) return null;

  // Lo que no se pudo leer no va en grande: el titular cae al estado.
  const entregaPrimera = renglones.find((r) => r.parte === 'entrega' && !r.texto.startsWith(NO_SE)) ?? null;
  const titular = entregaPrimera
    ? { texto: entregaPrimera.texto, detalle: entregaPrimera.detalle, tono: entregaPrimera.tono }
    : { texto: estado.texto, detalle: null, tono: estado.tono };

  return {
    estado,
    titular,
    renglones,
    // El estado ya va en el chip de la derecha del título: los chips son lo demás.
    chips: renglones.filter((r) => r.parte !== 'estado').map((r) => ({ clave: r.clave, texto: r.corto, tono: r.tono })),
    pasos,
    listos: pasos.filter((x) => x.hecho === 'si').length,
    aviso,
    noLeido,
    href: hrefClienteEnCs(leido.leadId),
  };
}
