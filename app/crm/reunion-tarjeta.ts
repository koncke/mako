// =============================================================================
// La tarjeta de una reunión que viene: cuánto falta, qué dice y cuándo se entra (22/10/2026)
// =============================================================================
// Martín, 22/10/2026, sobre el pop-up de «Tus reuniones»: «Tampoco me gustó el pop-up con los bloques azules, rediseñalo...
// Piensa en un diseño que sea útil, justamente se acerca la reunión que la tarjeta refleje algo al respecto... Y que no tenga
// "Llamar o WhatsApp"». La tarjeta es para PREPARAR la reunión (app/crm/TarjetaReunion.tsx): cuánto falta, que cambia solo,
// la hora y quién es, y lo útil para entrar a la llamada. Al acercarse la hora se nota: «empieza en 5 min» y «Entrar».
// Puro y sin React: lo prueba tests/crm-feedback-22-10-c.test.ts.
//
// ⚠️ LA HORA ES LA DEL NAVEGADOR DE QUIEN MIRA (como el hilo de MaKo): el instante es uno solo, y «en 25 min» vale en
//    cualquier zona. ⚠️ Y SÓLO SI CAE EN EL DÍA DE LA REUNIÓN: `junta_N_at` puede ser de otro día (un reagendado que cambió la
//    fecha sin hora: lib/crm-movil.ts mira lo mismo). Ahí se dice el día y no se cuenta nada.
// =============================================================================

/** Qué tan cerca está: decide cómo se ve la tarjeta y qué botón lleva. */
export type Cercania = 'otro_dia' | 'hoy' | 'pronto' | 'ya' | 'en_curso' | 'paso';

const MIN = 60_000;
/** Menos de esto, «pronto»: la tarjeta se marca. */
export const PRONTO_MIN = 60;
/** Menos de esto, «empieza en N min»: la tarjeta pide atención y ofrece entrar. */
export const YA_MIN = 10;
/** Hasta cuánto después de empezar sigue «en curso» (la misma hora de gracia del resto del CRM). */
export const EN_CURSO_MIN = 60;
/** Desde cuánto antes se ofrece «Entrar a la reunión» (con su link). */
export const ENTRAR_ANTES_MIN = 15;

/** El día local (AAAA-MM-DD) de un instante, en la zona de quien mira. */
export const diaLocal = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** El instante de la reunión, sólo si cae en su día (`fecha`, AAAA-MM-DD). Sin `fecha`, el que venga. */
export function instanteDe(at: string | null | undefined, fecha: string | null | undefined): number | null {
  const ms = at ? Date.parse(at) : NaN;
  if (!Number.isFinite(ms)) return null;
  if (fecha && diaLocal(ms) !== fecha) return null;
  return ms;
}

export const horaCorta = (ms: number): string =>
  new Date(ms).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** «hoy», «mañana», «el 24/10»: el día de un instante contra el de ahora. */
function diaRelativo(ms: number, ahoraMs: number): string {
  const hoy = diaLocal(ahoraMs);
  const dia = diaLocal(ms);
  if (dia === hoy) return 'hoy';
  if (dia === diaLocal(ahoraMs + 24 * 60 * MIN)) return 'mañana';
  return `el ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

/** Cuánto falta, en palabras y con su cercanía. Sin instante, el día que trae la reunión («hoy», «mañana», «pasó»). */
export function cuantoFalta(ms: number | null, ahoraMs: number, diaSinHora = 'hoy'): { texto: string; cerca: Cercania } {
  if (ms == null) {
    if (/pas[oó]/i.test(diaSinHora)) return { texto: 'Ya pasó', cerca: 'paso' };
    return { texto: diaSinHora === 'hoy' ? 'Hoy' : diaSinHora === 'mañana' ? 'Mañana' : diaSinHora, cerca: diaSinHora === 'hoy' ? 'hoy' : 'otro_dia' };
  }
  const min = Math.round((ms - ahoraMs) / MIN);
  if (min < -EN_CURSO_MIN) return { texto: `Fue a las ${horaCorta(ms)}`, cerca: 'paso' };
  if (min < 0) return { texto: `Empezó hace ${-min} min`, cerca: 'en_curso' };
  if (min === 0) return { texto: 'Empieza ahora', cerca: 'ya' };
  if (min <= YA_MIN) return { texto: `Empieza en ${min} min`, cerca: 'ya' };
  if (min < PRONTO_MIN) return { texto: `En ${min} min`, cerca: 'pronto' };
  const dia = diaRelativo(ms, ahoraMs);
  if (dia !== 'hoy') return { texto: `${dia === 'mañana' ? 'Mañana' : dia[0].toUpperCase() + dia.slice(1)} a las ${horaCorta(ms)}`, cerca: 'otro_dia' };
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return { texto: resto ? `En ${h} h ${resto} min` : `En ${h} h`, cerca: 'hoy' };
}

/** «Entrar a la reunión»: con su link, desde un rato antes hasta que deja de estar en curso. */
export const puedeEntrar = (ms: number | null, url: string | null | undefined, ahoraMs: number): boolean =>
  !!url?.trim() && ms != null && ms - ahoraMs <= ENTRAR_ANTES_MIN * MIN && ahoraMs - ms <= EN_CURSO_MIN * MIN;

/** Cada cuánto se vuelve a contar: de a minuto lejos, de a 15 s cuando falta poco (el «empieza en 1 min» no puede llegar tarde). */
export const cadaCuanto = (cercas: readonly Cercania[]): number => (cercas.some((c) => c === 'ya' || c === 'pronto') ? 15_000 : 60_000);

/** «hace 2 h», «hace 3 días»: lo último que pasó con el lead. */
export function haceCuanto(iso: string, ahoraMs: number): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const min = Math.max(0, Math.round((ahoraMs - ms) / MIN));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Lo último que hizo EL LEAD (lo que le mandamos no cuenta, como en Clientes: lib/cs-contacto.ts). */
export function lineaUltimo(u: { fecha: string | null; via: 'sesion' | 'whatsapp' | null } | null, ahoraMs: number): string | null {
  if (!u?.fecha || !u.via) return null;
  const hace = haceCuanto(u.fecha, ahoraMs);
  if (!hace) return null;
  return u.via === 'whatsapp' ? `Te escribió por WhatsApp ${hace}` : `Última llamada ${hace}`;
}

/** Lo de la R1 en una línea: el próximo paso que quedó, o la primera frase del resumen. */
export function lineaDeLaR1(r1: { resumen: string | null; proximoPaso: string | null } | null): string | null {
  if (!r1) return null;
  const paso = r1.proximoPaso?.trim();
  if (paso) return paso;
  const resumen = r1.resumen?.trim();
  if (!resumen) return null;
  const primera = /^[\s\S]*?[.!?](?=\s|$)/.exec(resumen)?.[0] ?? resumen;
  return primera.length > 180 ? `${primera.slice(0, 177).trimEnd()}…` : primera;
}
