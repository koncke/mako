// =============================================================================
// aviso-tarjeta — la barra y el aviso de la tarjeta de un cliente (17/10/2026)
// =============================================================================
// La familia de tarjetas del prototipo docs/prototipos/coherencia-1710.html («8 · Clients»): la misma tarjeta del
// lead, más UNA barra de avance y, si hace falta, UN aviso en rojo. Lo que se puede equivocar sin que nada se vea roto
// vive acá, puro, con test (tests/cs-tarjeta-familia.test.ts):
//   · la barra: en qué etapa del servicio está (la 2 de 5), que es lo que el tablero de la entrega existe para mirar;
//   · el aviso, el más urgente primero: «Pago rechazado», «Sin entrar al curso» (invitado y nunca entró), «Cuota
//     vencida», «Sin entrar · N d» (hace más de 14 días) y «N días sin moverse» de su etapa (`tiempoEnEtapa`,
//     ./en-etapa.ts). La plata va primero: un pago rechazado le gana a todo.
// «PAGO FALLIDO» DEL PROTOTIPO (20/10/2026, docs/pedidos-crm.md B2): antes no estaba porque el cobro se leía de a un
// cliente. Ahora viaja al tablero en UNA lectura para toda la cartera (./cobro-tarjeta.ts) y `cobroDelCliente` decide.
// Sin `server-only` ni `'use client'`: lo importan la tarjeta y el test.
// =============================================================================

import type { AvanceTarjeta } from '@/app/_ui/TarjetaKanban';
import { esRenovacionFallida } from '@/lib/cobrado-lead';

/** Más de esto sin entrar al curso es un aviso (amarillo); nunca haber entrado, rojo. */
export const DIAS_SIN_ENTRAR = 14;
const DIA_MS = 86_400_000;

/** El cobro de un cliente para la tarjeta. null = al día, o no se pudo leer (y entonces no se avisa nada). */
export type CobroTarjeta = 'rechazado' | 'vencida' | null;

/** Un cobro de la pasarela como lo lee la tarjeta (`cobros`, mig 0255). */
export type CobroParaTarjeta = {
  estado: string | null; created_at: string | null; updated_at?: string | null; pagado_at?: string | null;
  tipo?: string | null; suscripcion_estado?: string | null; motivo?: string | null;
  /** El concepto: ata el evento del rechazo a ESTE cobro (`logLeadEvent` escribe «<concepto>: <motivo>»). */
  concepto?: string | null;
};

/**
 * El cobro de UN cliente con lo que trae la lectura de la cartera: sus cobros de la pasarela (`cobros`) y sus cuotas
 * del plan sin pagar (`pagos`). Rechazado gana: pide hacer algo ya (otra tarjeta, otro link).
 *   · «Rechazado» = el último RECHAZO no tiene un pago bueno DESPUÉS (si pagó con otra tarjeta, ya no avisa). Cada uno
 *     cuenta por cuándo PASÓ: el rechazo por `updated_at` (un link nace «pendiente» y pasa a «fallido» al intentarse:
 *     `created_at` es cuándo se creó el link) y el pago por `pagado_at`. Con `created_at`, un pago de la cuota 1 hecho
 *     después de CREAR el link de la cuota 2 tapaba el rechazo de la 2 (revisión del 21/10/2026).
 *   · Y la RENOVACIÓN rechazada de una suscripción activa: el cobro queda «pagado» con el motivo (`aplicarPagoFallido`,
 *     lib/cobros.ts) y no crea cuota. La MISMA regla que la ficha (`esRenovacionFallida`, lib/cobrado-lead.ts).
 *   · «Vencida» = una cuota sin pagar con la fecha pasada.
 */
export function cobroDelCliente(
  cobros: ReadonlyArray<CobroParaTarjeta>,
  cuotasSinPagar: ReadonlyArray<{ fecha_esperada: string | null }>,
  hoy: string,
  /**
   * CUÁNDO SE RECHAZÓ, del dato que SÓLO escribe el rechazo: el evento «Pago rechazado» del historial del lead
   * (`aplicarPagoFallido` → `logLeadEvent`, lib/cobros.ts). ⚠️ `updated_at` no sirve (segunda revisión del 21/10/2026):
   * abrir un link vencido le crea otra sesión y lo toca, y un rechazo viejo pasaba a tapar un pago posterior. Sin
   * eventos (un historial que no se pudo escribir), cuenta cuándo se creó el link: puede callar un rechazo, nunca
   * inventarlo.
   */
  rechazos?: ReadonlyArray<{ valor: string | null; created_at: string }>,
): CobroTarjeta {
  if (cobros.some((c) => c.tipo === 'suscripcion' && c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada' && esRenovacionFallida(c.motivo))) return 'rechazado';
  const fallidos = cobros.filter((c) => c.estado === 'fallido');
  // Cada fallido con SU evento («<concepto>: …»): el de un link que después se anuló o se reembolsó no cuenta, porque
  // ese cobro ya no está fallido (tercera revisión del 21/10/2026). El evento se corta en 300 (lib/cobros.ts): el prefijo
  // también. Sin evento propio, cuándo se creó el link.
  const cuandoFallo = (f: CobroParaTarjeta): string => {
    const suyos = f.concepto ? (rechazos ?? []).filter((e) => (e.valor ?? '').startsWith(`${f.concepto}: `.slice(0, 300))).map((e) => e.created_at) : [];
    return [...suyos].sort().at(-1) ?? String(f.created_at ?? '');
  };
  const rechazo = fallidos.map(cuandoFallo).filter(Boolean).sort().at(-1);
  const pagadoAt = (c: CobroParaTarjeta): string => String(c.pagado_at ?? c.created_at ?? '');
  if (fallidos.length && rechazo && !cobros.some((c) => c.estado === 'pagado' && pagadoAt(c) > rechazo)) return 'rechazado';
  if (cuotasSinPagar.some((q) => q.fecha_esperada && q.fecha_esperada.slice(0, 10) < hoy)) return 'vencida';
  return null;
}

/** Lo que se sabe del curso de un cliente (`AccesoInvitacion`, recortado a lo que mira el aviso). */
export type AccesoParaAviso = { existe: boolean; revocado: boolean; ingresos: number; ultimoIngresoAt: string | null; invitacionEnviadaAt?: string | null } | null;

/**
 * La barra y el aviso de la tarjeta. `etapa` es su posición en las columnas del servicio (0 = la primera);
 * `enEtapa` lo de `tiempoEnEtapa` («hace 3 días», y si está trabado).
 */
export function avanceDeCliente(p: {
  etapa: number;
  etapas: number;
  enEtapa: { frase: string; trabado: boolean } | null;
  acceso?: AccesoParaAviso;
  /** Su cobro (`cobroDelCliente`). */
  cobro?: CobroTarjeta;
  ahoraMs: number;
}): AvanceTarjeta {
  const n = Math.max(1, p.etapas);
  const i = Math.max(0, Math.min(n - 1, p.etapa));
  const pct = ((i + 1) / n) * 100;
  const base = [`Etapa ${i + 1} de ${n}`, p.enEtapa?.frase].filter(Boolean).join(' · ');
  const aviso = (texto: string, tono: 'mal' | 'riesgo') => ({ pct, texto: base, aviso: { texto, tono } });
  if (p.cobro === 'rechazado') return aviso('Pago rechazado', 'mal');
  const a = p.acceso;
  const curso = !!a && a.existe && !a.revocado;
  if (curso && a.ingresos === 0 && a.invitacionEnviadaAt) return aviso('Sin entrar al curso', 'mal');
  if (p.cobro === 'vencida') return aviso('Cuota vencida', 'riesgo');
  if (curso) {
    const ult = a.ultimoIngresoAt ? Date.parse(a.ultimoIngresoAt) : NaN;
    if (a.ingresos > 0 && Number.isFinite(ult)) {
      const dias = Math.floor((p.ahoraMs - ult) / DIA_MS);
      if (dias > DIAS_SIN_ENTRAR) return { pct, texto: base, aviso: { texto: `Sin entrar · ${dias} d`, tono: 'riesgo' } };
    }
  }
  if (p.enEtapa?.trabado) return { pct, texto: base, aviso: { texto: `${p.enEtapa.frase.replace(/^hace /, '')} sin moverse`, tono: 'mal' } };
  return { pct, texto: base, aviso: null };
}
