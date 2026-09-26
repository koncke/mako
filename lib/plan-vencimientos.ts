// =============================================================================
// plan-vencimientos — qué proyectos deben fecha, y cómo se dice en UN mensaje
// =============================================================================
// SIN `server-only` A PROPÓSITO, y sin importar nada del server. Es la regla de la casa:
// la condición que dispara un aviso y el texto que sale viven donde un test los pueda
// importar. Lo que lee la base y manda el WhatsApp está al lado, en `plan-avisos.ts`.
// =============================================================================

/** Cuántos días antes empieza a avisar que algo se viene. */
export const VENTANA_DIAS = 5;

/**
 * ISO `YYYY-MM-DD` → día absoluto.
 *
 * Sin `new Date(iso)`: un `YYYY-MM-DD` pelado se interpreta como UTC medianoche, así que
 * al oeste de Greenwich la fecha se corre un día entero. Un deadline corrido un día es
 * exactamente el error que no se ve.
 */
export const soloDia = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
};

export type ProyectoConFecha = { nombre: string; deadline: string; abiertas: number;
  /**
   * Cuántas de sus tareas SE REPITEN para siempre (mig 0163). Opcional: `0` es la respuesta
   * correcta para cualquier llamador que no las distinga.
   *
   * ⚠️ NO SE SUMAN A `abiertas`, Y TAMPOCO SE IGNORAN — el cruce es el que decide si este
   * aviso miente. «Cliente: X — 3 tareas abiertas» donde las 3 son la reunión semanal es un
   * aviso falso; pero si se las resta y nada más, ese mismo proyecto pasa a `abiertas === 0`
   * y DEJA DE AVISAR su vencimiento, que es peor: un proyecto activo con la fecha encima
   * desaparece del único mensaje que la persigue. Por eso viajan aparte.
   */
  recurrentes?: number };
type Fila = { nombre: string; dias: number; abiertas: number; recurrentes: number };
export type ResumenVencimientos = {
  atrasados: Fila[];
  porVencer: Fila[];
};

/**
 * Cuáles deben fecha hoy.
 *
 * ⚠️ Solo cuenta lo que está VIVO: un proyecto sin NADA abierto está terminado en los
 * hechos, y perseguirlo por una fecha vieja es ruido — que es la mitad del problema que
 * este aviso viene a no empeorar. «Vivo» incluye a las tareas que se repiten: un cliente al
 * que se le atiende todas las semanas no está terminado, y si su fecha ya pasó es
 * exactamente lo que hay que decir (o la fecha sobra, o falta trabajo con fin adentro).
 */
export function clasificarVencimientos(proyectos: ProyectoConFecha[], hoyISO: string): ResumenVencimientos {
  const hoy = soloDia(hoyISO);
  const out: ResumenVencimientos = { atrasados: [], porVencer: [] };
  for (const p of proyectos) {
    const recurrentes = p.recurrentes ?? 0;
    if (!p.deadline || (p.abiertas === 0 && recurrentes === 0)) continue;
    const dias = soloDia(p.deadline) - hoy;
    if (dias < 0) out.atrasados.push({ nombre: p.nombre, dias: -dias, abiertas: p.abiertas, recurrentes });
    else if (dias <= VENTANA_DIAS) out.porVencer.push({ nombre: p.nombre, dias, abiertas: p.abiertas, recurrentes });
  }
  out.atrasados.sort((a, b) => b.dias - a.dias);
  out.porVencer.sort((a, b) => a.dias - b.dias);
  return out;
}

/**
 * Qué arrastra un proyecto, en tres palabras.
 *
 * ⚠️ «0 tareas abiertas» ES UNA MENTIRA Y HABÍA QUE EVITARLA A PROPÓSITO. Desde que las
 * recurrentes no cuentan como trabajo abierto (mig 0163), un proyecto que sólo tiene la
 * reunión semanal llega acá con `abiertas: 0` — y el renglón habría dicho que se venció y
 * que no hay nada adentro, o sea que nadie sabría si hay algo que hacer. Lo que hay que
 * decir es lo contrario: está en marcha, pero no queda nada CON FIN, así que o la fecha
 * sobra o falta cargar el trabajo real.
 */
const carga = (p: Fila): string => {
  if (p.abiertas > 0) return `${p.abiertas} ${p.abiertas === 1 ? 'tarea abierta' : 'tareas abiertas'}`;
  return `sin trabajo con fin, sólo ${p.recurrentes} que se ${p.recurrentes === 1 ? 'repite' : 'repiten'}`;
};

/** El mensaje, en la voz de MaKo. Función pura para poder mirarla sin mandar nada. */
export function textoVencimientos(r: ResumenVencimientos): { titulo: string; texto: string } | null {
  const nAtr = r.atrasados.length;
  const nPor = r.porVencer.length;
  if (!nAtr && !nPor) return null;
  const lineas: string[] = [];
  if (nAtr) {
    lineas.push(`⏰ *${nAtr} ${nAtr === 1 ? 'proyecto atrasado' : 'proyectos atrasados'}*`);
    // Cinco y «y N más»: un WhatsApp con 30 renglones no se lee, y el tablero está a un click.
    for (const p of r.atrasados.slice(0, 5)) lineas.push(`• ${p.nombre} — ${p.dias} ${p.dias === 1 ? 'día' : 'días'}, ${carga(p)}`);
    if (nAtr > 5) lineas.push(`• …y ${nAtr - 5} más`);
  }
  if (nPor) {
    if (lineas.length) lineas.push('');
    lineas.push(`🗓️ *${nPor === 1 ? 'Vence' : 'Vencen'} esta semana*`);
    for (const p of r.porVencer.slice(0, 5)) lineas.push(`• ${p.nombre} — ${p.dias === 0 ? 'hoy' : p.dias === 1 ? 'mañana' : `en ${p.dias} días`}, ${carga(p)}`);
    if (nPor > 5) lineas.push(`• …y ${nPor - 5} más`);
  }
  lineas.push('');
  lineas.push('Si una fecha ya no va, cámbiala en el plan y listo. — MaKo');
  const titulo = nAtr
    ? `${nAtr} ${nAtr === 1 ? 'proyecto atrasado' : 'proyectos atrasados'}${nPor ? ` y ${nPor} por vencer` : ''}`
    : `${nPor} ${nPor === 1 ? 'proyecto vence' : 'proyectos vencen'} esta semana`;
  return { titulo, texto: lineas.join('\n') };
}

/**
 * La HUELLA del aviso, y acá está la diferencia entre avisar y hostigar.
 *
 * Si incluyera los días de atraso tal cual, cambiaría SOLA todas las mañanas (61 → 62 →
 * 63) y el mismo aviso saldría todos los días — que es exactamente lo que él reportó de
 * los otros («son demasiadas»). Los atrasados entran por TRAMO: vuelve a sonar cuando el
 * atraso empeora de verdad, o cuando cambia la lista. Los que están por vencer sí van con
 * el día, porque «vence mañana» no es la misma noticia que «vence en 4».
 */
export function huellaVencimientos(r: ResumenVencimientos): string {
  const tramo = (d: number) => (d <= 3 ? 'pocos' : d <= 7 ? 'semana' : d <= 30 ? 'mes' : 'meses');
  return [
    ...r.atrasados.map((p) => `A:${p.nombre}:${tramo(p.dias)}`),
    ...r.porVencer.map((p) => `V:${p.nombre}:${p.dias}`),
  ].join('|');
}
