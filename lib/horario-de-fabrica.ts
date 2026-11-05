// =============================================================================
// horario-de-fabrica — el 9 a 21 de fábrica para las automatizaciones que ya estaban prendidas (puro)
// =============================================================================
// Black November de Leila (5/11/2026). Las automatizaciones nuevas nacen con el horario de fábrica al prenderlas
// (`naceConHorario`, lib/ritmo-al-activar.ts, desde el 31/10/2026); las de antes no tienen ninguno y le escriben a los leads a
// cualquier hora. Esto decide, automatización por automatización, qué hace el script que se lo pone
// (scripts/horario-de-fabrica-prendidas.mts). La regla de a quién le toca es LA MISMA que al prenderla
// (`leTocaPorSusDisparadores`), sin el corte por fecha.
//
// Las tres decisiones, y su porqué:
//   · SIN FRENAR A NADIE DE GOLPE: el negocio que ahora está fuera de 9 a 21 (en su zona) queda para la próxima corrida de día
//     (`esperar`). Puesto de noche, lo que vence ahora se quedaba quieto hasta las 9 sin que nadie lo hubiera pedido.
//   · SIN MANDAR LO ACUMULADO TODO JUNTO: puesto de día no hay nada acumulado. Lo que venza de noche sale al abrir, con el tope por
//     hora de la línea (6 por hora de fábrica), la rampa del número (lib/goteo.ts) y el goteo de cada una: nunca de golpe.
//   · EL NEGOCIO MANDA: con un horario del negocio (los 10 a 20 de Leila) no se pone nada: sus automatizaciones ya lo siguen. Y
//     el 9 a 21 que MaKo le puso al prenderla a una nueva queda MARCADO como de fábrica (`marcar`): así cede ante el del negocio
//     (`horarioDeLaAutomatizacion`, lib/config-automatizacion.ts). Se reconoce porque es idéntico al de fábrica y la
//     automatización nació después del corte; uno elegido igual a mano también cede, y el script lo lista antes de escribir.
// =============================================================================

import { HORARIO_SUGERIDO, dentroDelHorario, type HorarioEnvio } from './horario-envio';
import { DESDE_HORARIO_DE_FABRICA, leTocaPorSusDisparadores } from './ritmo-al-activar';
import { PREFIJO_CLAVE_DIFUSION } from './difusion-reglas';
import type { ConfigAutomatizacion } from './config-automatizacion';

/** Una automatización, como la ve el plan. `triggers`: los de TODOS sus CRON (`vistasPorDisparador`). */
export type AutoParaHorario = {
  id: number; nombre: string; clave: string; activa: boolean; creadaAt: string | null;
  triggers: readonly string[]; config: ConfigAutomatizacion;
};

export type HaceElPlan = 'poner' | 'marcar' | 'esperar' | 'nada';
export type PasoDelPlan = { id: number; nombre: string; hace: HaceElPlan; motivo: string };

/** ¿Es el horario de fábrica, tal cual? (prendido, 9 a 21, los 7 días). */
export function esElDeFabrica(h: HorarioEnvio | null | undefined): boolean {
  if (!h || !h.activo) return false;
  return h.desde === HORARIO_SUGERIDO.desde && h.hasta === HORARIO_SUGERIDO.hasta
    && h.dias.length === HORARIO_SUGERIDO.dias.length && HORARIO_SUGERIDO.dias.every((d) => h.dias.includes(d));
}

/**
 * EL PLAN DE UN NEGOCIO. `delNegocio`: su horario prendido, o null. `zona`: la del negocio (la del horario). `pausadas`: también
 * las apagadas sin archivar (al prenderlas, las de antes del corte no lo reciben).
 */
export function planDeHorarioDeFabrica(o: {
  delNegocio: HorarioEnvio | null; zona: string; ahoraMs: number; autos: readonly AutoParaHorario[]; pausadas?: boolean;
}): PasoDelPlan[] {
  const deDia = dentroDelHorario(o.ahoraMs, o.zona, HORARIO_SUGERIDO);
  return o.autos.map((a): PasoDelPlan => {
    const paso = (hace: HaceElPlan, motivo: string): PasoDelPlan => ({ id: a.id, nombre: a.nombre, hace, motivo });
    if (a.config.horario !== undefined) {
      if (a.config.horarioDeFabrica) return paso('nada', 'ya tiene el de fábrica');
      const creada = a.creadaAt ? Date.parse(a.creadaAt) : NaN;
      if (Number.isFinite(creada) && creada >= DESDE_HORARIO_DE_FABRICA && esElDeFabrica(a.config.horario)) {
        return paso('marcar', 'el 9 a 21 que le puso MaKo al prenderla: queda como de fábrica y sigue el horario del negocio si pone uno');
      }
      return paso('nada', 'tiene su propio horario');
    }
    if (!a.activa && !o.pausadas) return paso('nada', 'está pausada');
    if (a.clave.startsWith(PREFIJO_CLAVE_DIFUSION)) return paso('nada', 'es una difusión: la manda la persona a propósito');
    // Con un horario del negocio, la que contesta al momento también lo sigue: se dice, para que quien lo puso sepa que un DM
    // fuera de ese horario espera a que abra (era así antes de esto, y no se cambia sin que lo pida).
    const no = leTocaPorSusDisparadores({ triggers: a.triggers, horarioPropio: undefined, delNegocio: null });
    if (o.delNegocio) {
      return paso('nada', no?.startsWith('contesta') ? 'sigue el horario del negocio: contesta al momento, y lo que llegue fuera de ese horario espera a que abra' : 'sigue el horario del negocio');
    }
    if (no) return paso('nada', no);
    if (!deDia) return paso('esperar', `ahora es de noche en ${o.zona}: córrelo entre las 9 y las 21 de ahí, para no frenarla de golpe`);
    return paso('poner', 'de 9 a 21, todos los días (de fábrica)');
  });
}

/** El cambio de configuración de cada paso que escribe (`configParaGuardar`); null = no escribe. */
export function cambioDelPaso(p: PasoDelPlan, config: ConfigAutomatizacion): { horario: HorarioEnvio; horarioDeFabrica: true } | null {
  if (p.hace === 'poner') return { horario: HORARIO_SUGERIDO, horarioDeFabrica: true };
  if (p.hace === 'marcar' && config.horario) return { horario: config.horario, horarioDeFabrica: true };
  return null;
}
