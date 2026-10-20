// =============================================================================
// aviso-tarjeta — la barra y el aviso de la tarjeta de un cliente (17/10/2026)
// =============================================================================
// La familia de tarjetas del prototipo docs/prototipos/coherencia-1710.html («8 · Clients»): la misma tarjeta del
// lead, más UNA barra de avance y, si hace falta, UN aviso en rojo. Lo que se puede equivocar sin que nada se vea roto
// vive acá, puro, con test (tests/cs-tarjeta-familia.test.ts):
//   · la barra: en qué etapa del servicio está (la 2 de 5), que es lo que el tablero de la entrega existe para mirar;
//   · el aviso, el más urgente primero: «Sin entrar» al curso (invitado y nunca entró, o hace más de 14 días) y
//     «N días sin moverse» de su etapa (`tiempoEnEtapa`, ./en-etapa.ts).
// «Pago fallido» del prototipo NO está: el estado del cobro de cada cliente no viaja al tablero (leerlo es una
// lectura por cliente); queda anotado en docs/hallazgos-crm.md.
// Sin `server-only` ni `'use client'`: lo importan la tarjeta y el test.
// =============================================================================

import type { AvanceTarjeta } from '@/app/_ui/TarjetaKanban';

/** Más de esto sin entrar al curso es un aviso (amarillo); nunca haber entrado, rojo. */
export const DIAS_SIN_ENTRAR = 14;
const DIA_MS = 86_400_000;

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
  ahoraMs: number;
}): AvanceTarjeta {
  const n = Math.max(1, p.etapas);
  const i = Math.max(0, Math.min(n - 1, p.etapa));
  const pct = ((i + 1) / n) * 100;
  const base = [`Etapa ${i + 1} de ${n}`, p.enEtapa?.frase].filter(Boolean).join(' · ');
  const a = p.acceso;
  if (a && a.existe && !a.revocado) {
    if (a.ingresos === 0 && a.invitacionEnviadaAt) return { pct, texto: base, aviso: { texto: 'Sin entrar al curso', tono: 'mal' } };
    const ult = a.ultimoIngresoAt ? Date.parse(a.ultimoIngresoAt) : NaN;
    if (a.ingresos > 0 && Number.isFinite(ult)) {
      const dias = Math.floor((p.ahoraMs - ult) / DIA_MS);
      if (dias > DIAS_SIN_ENTRAR) return { pct, texto: base, aviso: { texto: `Sin entrar · ${dias} d`, tono: 'riesgo' } };
    }
  }
  if (p.enEtapa?.trabado) return { pct, texto: base, aviso: { texto: `${p.enEtapa.frase.replace(/^hace /, '')} sin moverse`, tono: 'mal' } };
  return { pct, texto: base, aviso: null };
}
