// =============================================================================
// Media Buyer — el STOP LOSS DEL DÍA (PURO: lo prueban los tests)
// =============================================================================
// Martín a la agencia de Thiago, 29/10/2026 [29:15]: «optimiza la campaña solito, vos no hacés nada». La corrida mira la
// cuenta UNA vez por día (14:30 UTC) con el día de ayer cerrado: un anuncio que se dispara a la mañana quema el día entero
// antes de que alguien lo vea. El vigía (vigia.ts) mira el día de HOY cada dos horas y pausa lo que se está quemando: el
// «Stop Loss» de Madgicx y Revealbot («spend today > X and results today = 0 → pause»), con la vara de MaKo.
//
// LOS NÚMEROS (los cambia una persona en código, con el porqué):
//   · Gastó HOY `gastoVeces` × el objetivo (el mismo umbral del Stop Loss de la táctica, 2 por defecto) sin un solo resultado
//     de hoy (ni en Meta ni en el CRM). En un día es una señal más fuerte que en siete: el umbral no se baja.
//   · ⚠️ NO se pausa un anuncio que viene rindiendo: con resultados en los 7 días anteriores a un costo dentro del objetivo,
//     una mañana mala es ruido (la atribución de Meta llega tarde, y un lead de formulario puede tardar en entrar).
//   · No se toca lo que MaKo cambió en las últimas 24 h (lo que Revive prendió hoy no se vuelve a pausar el mismo día).
//   · Una pausa por anuncio y por día (la clave lleva el día del NEGOCIO). Mañana, si el Stop Loss de siempre o Revive ven
//     otra cosa, lo dicen ellos.
// La táctica es `stop_loss`: su estado manda (apagada no mira nada; propone deja la decisión; automática la lanza).
// =============================================================================

import { NOMBRE_RESULTADO, STOP_GASTO_MIN, UN_DIA_MS, resultados, type DecisionPrevia, type NodoMB, type SenalMB } from './motor';
import type { TacticasResueltas } from './tacticas';
import type { KpiMediaBuyer, Propuesta } from './tipos';

export type EntradaDelDia = {
  ahora: number;
  /** El día de HOY del negocio (la clave y el texto). */
  hoy: string;
  kpi: KpiMediaBuyer;
  objetivo: number | null;
  arbol: NodoMB[];
  /** Lo de hoy por anuncio (Meta hasta ahora + los leads que entraron hoy al CRM). */
  delDia: SenalMB[];
  /** Los 7 días que terminan ayer, para no pausar lo que viene rindiendo. */
  semana: SenalMB[];
  historial: DecisionPrevia[];
  tacticas?: TacticasResueltas;
  fmt: (unidad: number) => string;
};

export const claveDelDia = (adId: string, hoy: string): string => `stop_loss_hoy:ad:${adId}:${hoy}`;

/** Los anuncios PRENDIDOS de verdad (su interruptor y los de arriba; un padre que no vino es «no»). */
function prendidos(arbol: readonly NodoMB[]): NodoMB[] {
  const porId = new Map(arbol.map((n) => [n.id, n] as const));
  const ok = (n: NodoMB): boolean => {
    let x: NodoMB | undefined = n;
    while (x) { if (x.configurado !== 'ACTIVE') return false; if (!x.parentId) return true; x = porId.get(x.parentId); }
    return false;
  };
  return arbol.filter((n) => n.nivel === 'ad' && ok(n));
}

export function stopLossDelDia(e: EntradaDelDia): Propuesta[] {
  const t = e.tacticas?.stop_loss;
  if (e.objetivo == null || e.objetivo <= 0 || t?.estado === 'apagada') return [];
  const obj = e.objetivo;
  const gastoVeces = t?.p.gastoVeces ?? STOP_GASTO_MIN;
  const nom = NOMBRE_RESULTADO[e.kpi];
  const porId = new Map(e.arbol.map((n) => [n.id, n] as const));
  const campanaDe = (n: NodoMB): NodoMB | null => {
    let x: NodoMB | undefined = n;
    while (x && x.nivel !== 'campaign') x = x.parentId ? porId.get(x.parentId) : undefined;
    return x ?? null;
  };
  const out: Propuesta[] = [];
  for (const ad of prendidos(e.arbol)) {
    const camp = campanaDe(ad);
    if (t?.campanas && !(camp && t.campanas.has(camp.id))) continue;
    // Lo que MaKo tocó en las últimas 24 h (el anuncio, su conjunto o su campaña) se deja tranquilo.
    const ids = new Set([ad.id, ad.parentId, camp?.id].filter(Boolean) as string[]);
    if (e.historial.some((d) => ids.has(d.entidadId) && d.estado === 'aplicada' && d.aplicadaAt && e.ahora - Date.parse(d.aplicadaAt) < UN_DIA_MS)) continue;
    const hoy = e.delDia.find((s) => s.adId === ad.id);
    if (!hoy || resultados(hoy, e.kpi) > 0 || hoy.gasto < obj * gastoVeces) continue;
    const sem = e.semana.find((s) => s.adId === ad.id);
    const r7 = sem ? resultados(sem, e.kpi) : 0;
    if (sem && r7 > 0 && sem.gasto / r7 <= obj) continue; // viene rindiendo: una mañana mala no lo apaga
    out.push({
      clave: claveDelDia(ad.id, e.hoy), tipo: 'pausar', tactica: 'stop_loss', nivel: 'ad',
      entidadId: ad.id, entidadNombre: ad.nombre, campanaNombre: camp?.nombre ?? null,
      titulo: `Pausar «${ad.nombre}»: hoy gastó sin traer ${nom.varios}`,
      titular: `Hoy lleva ${e.fmt(hoy.gasto)} sin ${nom.unSolo} ${nom.uno}`,
      porque: [
        `En lo que va del día gastó ${e.fmt(hoy.gasto)}: ${Math.round((hoy.gasto / obj) * 10) / 10} veces lo que te cuesta ${nom.un} ${nom.uno}, y no trajo ${nom.ninguno}.`,
        r7 > 0 ? `En la semana anterior cada ${nom.uno} salió más caro que tu objetivo.` : `En la semana anterior tampoco trajo ${nom.varios}.`,
        'MaKo lo mira cada dos horas para que un anuncio que se dispara no queme el día entero. Si después llegan resultados, Revive lo vuelve a prender.',
      ],
      numeros: [
        { condicion: 'Gasto de hoy', valor: e.fmt(hoy.gasto), porQue: `Más de ${gastoVeces} veces tu objetivo (${e.fmt(obj)})` },
        { condicion: `${nom.varios[0].toUpperCase()}${nom.varios.slice(1)} de hoy`, valor: '0', porQue: 'Ni uno, ni en Meta ni en tu CRM' },
        { condicion: `${nom.costo}, semana anterior`, valor: sem && r7 > 0 ? e.fmt(sem.gasto / r7) : `sin ${nom.varios}`, porQue: 'No venía rindiendo' },
      ],
      antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' },
    });
  }
  return out;
}
