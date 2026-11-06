// =============================================================================
// Media Buyer — lo que la pantalla DICE de cada decisión (PURO: lo prueban los tests)
// =============================================================================
// Los nombres de las tácticas van como los llama la referencia (Madgicx: Surf, Stop Loss, Revive, Sunsetting): son
// NOMBRES (regla de la casa: los nombres en inglés), y así quien conoce la herramienta las reconoce. Las frases, en
// español neutro y cortas (memoria texto-de-pantalla-corto).
// =============================================================================

import { cuentaAUsd, esConvertible } from '@/lib/presupuesto-cambio';
import { fmtDinero, fmtNum } from '@/lib/format';
import type { Decision, EstadoDecision, KpiMediaBuyer, MetasDelMes, Tactica, TipoDecision } from '@/lib/media-buyer/tipos';

export const NOMBRE_TACTICA: Record<Tactica, string> = {
  surf: 'Surf',
  sunsetting: 'Sunsetting',
  stop_loss: 'Stop Loss',
  revive: 'Revive',
  calidad: 'Calidad de leads',
  ganador: 'Ganador',
  manual: 'Subida',
  hasta: 'Fecha de fin',
};

export const ICONO_TIPO: Record<TipoDecision, string> = {
  subir_presupuesto: '📈',
  bajar_presupuesto: '📉',
  pausar: '✋',
  activar: '🔄',
  variaciones_texto: '✍️',
  variaciones_hook: '🎬',
  crear_anuncios: '⬆️',
  crear_campana: '🚀',
};

export const NIVEL: Record<Decision['nivel'], string> = { campaign: 'Campaña', adset: 'Conjunto', ad: 'Anuncio' };

/** El tono del titular de la columna del medio: verde lo que gana, rojo lo que pierde, dorado lo que crea MaKo. */
export function tonoDe(d: Pick<Decision, 'tipo' | 'tactica'>): 'bien' | 'mal' | 'cuidado' | 'mako' {
  if (d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook') return 'mako';
  if (d.tipo === 'subir_presupuesto' || d.tipo === 'activar' || d.tipo === 'crear_anuncios' || d.tipo === 'crear_campana') return 'bien';
  if (d.tactica === 'sunsetting' && d.tipo === 'bajar_presupuesto') return 'cuidado';
  // El relevo (táctica Ganador + pausar, lib/media-buyer/motor.ts): se pausa el original PORQUE su variación ya le gana. Es una buena
  // noticia, no una pérdida.
  if (d.tactica === 'ganador' && d.tipo === 'pausar') return 'bien';
  return 'mal';
}

/** El rótulo del botón principal, por lo que hace. */
export function verboLanzar(d: Pick<Decision, 'tipo'>): string {
  switch (d.tipo) {
    case 'subir_presupuesto': return 'Subir';
    case 'bajar_presupuesto': return 'Bajar';
    case 'pausar': return 'Pausar';
    case 'activar': return 'Prender';
    default: return 'Crear anuncios';
  }
}

/** Un monto de la cuenta, como se lee: en dólares si la moneda convierte, si no en la suya. */
export function monto(m: number | null | undefined, moneda: string | null): string {
  if (m == null) return '—';
  if (moneda && esConvertible(moneda)) {
    const usd = cuentaAUsd(m, moneda);
    if (usd != null) return fmtDinero(usd);
  }
  return fmtDinero(m, moneda);
}

/** Qué se hizo, en una línea: lo que va debajo del nombre en «Lo que hizo MaKo» (como «Set budget from $5,132 to $740»). */
export function queSeHizo(d: Pick<Decision, 'tipo' | 'nivel' | 'entidadNombre' | 'antes' | 'despues' | 'moneda' | 'creados'>): string {
  const que = `«${d.entidadNombre}»`;
  switch (d.tipo) {
    case 'subir_presupuesto':
    case 'bajar_presupuesto':
      return `${d.tipo === 'subir_presupuesto' ? 'Subió' : 'Bajó'} ${que} de ${monto(d.antes.presupuesto, d.moneda)} a ${monto(d.despues.presupuesto, d.moneda)}`;
    case 'pausar': return `Pausó ${que}`;
    case 'activar': return `Prendió ${que}`;
    default: return `Creó ${d.creados.length || ''} ${d.creados.length === 1 ? 'anuncio' : 'anuncios'} de ${que}`.replace('  ', ' ');
  }
}

/** «hace 2 h», «hace 3 días». */
export function hace(iso: string | null | undefined, ahora = Date.now()): string {
  if (!iso) return '';
  const ms = Math.max(0, ahora - Date.parse(iso));
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
}

export type Pestana = 'abiertas' | 'hechas' | 'descartadas';

/** En qué pestaña vive cada estado. Lo que falló o frenó un tope sigue ABIERTO: todavía hay algo que decidir. */
export function pestanaDe(e: EstadoDecision): Pestana {
  if (e === 'abierta' || e === 'fallida' || e === 'bloqueada') return 'abiertas';
  if (e === 'aplicada' || e === 'deshecha') return 'hechas';
  return 'descartadas';
}

/** El porcentaje de lo aplicado en 30 días que lanzó el piloto automático (el «Percent of account automation»). */
export function porcentajeAutomatico(ds: Pick<Decision, 'estado' | 'origen'>[]): number {
  const aplicadas = ds.filter((d) => d.estado === 'aplicada' || d.estado === 'deshecha');
  if (!aplicadas.length) return 0;
  return Math.round((aplicadas.filter((d) => d.origen === 'piloto').length / aplicadas.length) * 100);
}

/** El saludo según la hora del navegador. */
export function saludo(hora: number): string {
  if (hora < 12) return 'Buen día';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

// ── La estructura de AdAmigo (25/10/2026, Martín: «Me gusta el de "AdAmigo" implementalo de punta en punta») ──────────
// docs/media-buyer/referencias/adamigo/: cada acción la firma un AGENTE (Strategist, Media Buyer, Creative Designer,
// Protect), se lee como Qué · Por qué · Impacto esperado, muestra el cambio como «$250 → $300/day +20%», y vive en una de
// cuatro pestañas de Autopilot (Today, Scheduled, Implemented, Blocked).

// Los agentes viven en lib/media-buyer/agentes.ts (los usa también la API de MaKo); la pantalla los toma de acá.
export { AGENTE_DE, NOMBRE_AGENTE, TACTICAS_DE, QUE_HACE, estadoDeAgente, cambiarAgente, cambioDeAgente } from '@/lib/media-buyer/agentes';
export type { Agente, EstadoAgente } from '@/lib/media-buyer/agentes';

export type PestanaAA = 'hoy' | 'programadas' | 'implementadas' | 'bloqueadas';

/**
 * La pestaña de Autopilot. «Programadas» son las abiertas de una táctica AUTOMÁTICA: el piloto las lanza en su próxima
 * vuelta. «Bloqueadas» junta lo que frenó un tope o falló (todavía se puede reintentar) con lo descartado o vencido.
 */
export function pestanaAutopilot(d: Pick<Decision, 'estado' | 'tactica'>, automatica: (t: Tactica) => boolean): PestanaAA {
  if (d.estado === 'aplicada' || d.estado === 'deshecha') return 'implementadas';
  if (d.estado === 'abierta') return automatica(d.tactica) ? 'programadas' : 'hoy';
  return 'bloqueadas';
}

const DEL: Record<Decision['nivel'], string> = { campaign: 'de la campaña', adset: 'del conjunto', ad: 'del anuncio' };
const EL: Record<Decision['nivel'], string> = { campaign: 'la campaña', adset: 'el conjunto', ad: 'el anuncio' };

/** El cambio como en AdAmigo («$250 → $300/day +20%»); null si la decisión no cambia un presupuesto ni un interruptor. */
export function cambioDe(d: Pick<Decision, 'antes' | 'despues' | 'moneda'>): { antes: string; despues: string; pct: string | null } | null {
  const a = d.antes.presupuesto;
  const b = d.despues.presupuesto;
  if (a != null && b != null) {
    const pct = a > 0 ? Math.round((b / a - 1) * 100) : null;
    return { antes: monto(a, d.moneda), despues: `${monto(b, d.moneda)}/día`, pct: pct == null ? null : `${pct > 0 ? '+' : ''}${pct}%` };
  }
  if (d.antes.estado && d.despues.estado) {
    const t = (e: string) => (e === 'ACTIVE' ? 'Prendido' : 'Pausado');
    return { antes: t(d.antes.estado), despues: t(d.despues.estado), pct: null };
  }
  return null;
}

/** El «Qué» de la tarjeta: lo que hace y dónde, en una oración (como «Pause the ad set X within the campaign Y»). */
export function queHace(d: Pick<Decision, 'tipo' | 'nivel' | 'entidadNombre' | 'campanaNombre' | 'antes' | 'despues' | 'moneda' | 'variaciones'>): string {
  const donde = d.campanaNombre && d.nivel !== 'campaign' ? ` (campaña «${d.campanaNombre}»)` : '';
  const quien = `«${d.entidadNombre}»${donde}`;
  const n = (d.variaciones ?? []).length;
  switch (d.tipo) {
    case 'subir_presupuesto':
    case 'bajar_presupuesto':
      return `${d.tipo === 'subir_presupuesto' ? 'Subir' : 'Bajar'} el presupuesto diario ${DEL[d.nivel]} ${quien} de ${monto(d.antes.presupuesto, d.moneda)} a ${monto(d.despues.presupuesto, d.moneda)}.`;
    case 'pausar': return `Pausar ${EL[d.nivel]} ${quien}.`;
    case 'activar': return `Prender ${EL[d.nivel]} ${quien}.`;
    case 'variaciones_texto': return `Probar ${n || 'tres'} textos nuevos ${DEL[d.nivel]} ${quien}, como anuncios nuevos en su mismo conjunto.`;
    case 'variaciones_hook': return `Probar ${n || 'tres'} ganchos nuevos del video ${quien}: se filma sólo el gancho.`;
    default: return `Subir anuncios nuevos a ${quien}.`;
  }
}

const RESULTADO: Record<KpiMediaBuyer, string> = { lead: 'leads', agenda: 'agendas', venta: 'ventas' };

/** El «Impacto esperado»: lo que se busca con la acción, en una o dos líneas (no promete números que no salen del dato). */
export function impactoEsperado(d: Pick<Decision, 'tipo' | 'tactica'>, kpi: KpiMediaBuyer): string[] {
  const r = RESULTADO[kpi];
  switch (d.tipo) {
    case 'subir_presupuesto': return [`Más ${r} al costo de hoy`, 'Sin reiniciar el aprendizaje de Meta'];
    case 'bajar_presupuesto': return [`Menos gasto donde cada uno de tus ${r} sale caro`, 'El presupuesto queda para lo que rinde'];
    case 'pausar': return d.tactica === 'calidad'
      ? ['Menos leads que no agendan', 'Más presupuesto para los que sí']
      // El relevo: el original no «gasta sin traer», sólo le ganó su variación.
      : d.tactica === 'ganador'
        ? ['El presupuesto pasa a la variación que ya rinde más', `Más ${r} con lo mismo`]
        : [`Frenar el gasto que no trae ${r}`, 'Ese presupuesto pasa a lo que convierte'];
    case 'activar': return [`Volver a sumar ${r} de un anuncio que resultó bueno`];
    case 'variaciones_texto':
    case 'variaciones_hook': return ['Encontrar el próximo ganador antes de que este se canse', `Más ${r} con el mismo presupuesto`];
    default: return ['Probar creativos nuevos en un conjunto que ya funciona'];
  }
}

// ── HOY como la captura 04 de AdAmigo (25/10/2026 noche) ───────────────────────────────────────────────────────────────
// Martín, al ver la versión con la pantalla Autopilot de AdAmigo: «Una cantidad de botones y texto impresionante... la captura
// que me habias pasado de Adamigo no se parece en nada». La que eligió es la 04 (docs/media-buyer/referencias/otras-apps/
// 04-adamigo-aplicado-y-deshacer.png): una pastilla de MaKo, un ÁRBOL de tarjetas chicas (en MaKo, las ramas son los
// productos del CRM) y un mensaje al pie. Cada tarjeta: el producto, «Meta · la campaña», un rótulo chico, la entidad y el
// cambio con sus números. El porqué va en el mensaje del pie y en el detalle que se abre al tocarla, nunca en la tarjeta.

const NIVEL_MIN: Record<Decision['nivel'], string> = { campaign: 'campaña', adset: 'conjunto', ad: 'anuncio' };
const may = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** El rótulo chico de la tarjeta (el «BEST AD SET» de la 04): qué es esa entidad para esta acción. */
export function rotuloDe(d: Pick<Decision, 'tactica' | 'nivel' | 'tipo'>): string {
  const n = NIVEL_MIN[d.nivel];
  switch (d.tactica) {
    case 'surf': return `Mejor ${n}`;
    case 'sunsetting': return `${may(n)} que se encareció`;
    case 'stop_loss': return 'Gasta sin resultados';
    case 'revive': return 'Volvió a andar';
    case 'calidad': return 'Leads que no agendan';
    // El relevo (Ganador + pausar): la tarjeta es del ORIGINAL que su variación superó (docs/relevo/nube-thiago-anuncios.md).
    case 'ganador': return d.tipo === 'pausar' ? 'Le gana su variación' : d.tipo === 'variaciones_hook' ? 'Video ganador' : 'Anuncio ganador';
    default: return 'Tu regla';
  }
}

/** La línea del cambio: «US$ 30 → US$ 36 / día» con «+20%», «Prendido → Pausado», o «3 textos nuevos». */
export function cambioCorto(d: Pick<Decision, 'tipo' | 'antes' | 'despues' | 'moneda' | 'variaciones' | 'creados'>): { antes: string | null; despues: string; pct: string | null; sube: boolean } {
  const a = d.antes.presupuesto;
  const b = d.despues.presupuesto;
  if (a != null && b != null) {
    const pct = a > 0 ? Math.round((b / a - 1) * 100) : null;
    return { antes: monto(a, d.moneda), despues: `${monto(b, d.moneda)} / día`, pct: pct == null || pct === 0 ? null : `${pct > 0 ? '+' : ''}${pct}%`, sube: (pct ?? 0) > 0 };
  }
  if (d.antes.estado && d.despues.estado) {
    const t = (e: string) => (e === 'ACTIVE' ? 'Prendido' : 'Pausado');
    return { antes: t(d.antes.estado), despues: t(d.despues.estado), pct: null, sube: d.despues.estado === 'ACTIVE' };
  }
  const n = (d.variaciones ?? []).length || d.creados.length || 3;
  const que = d.tipo === 'variaciones_hook' ? (n === 1 ? 'gancho nuevo' : 'ganchos nuevos') : d.tipo === 'variaciones_texto' ? (n === 1 ? 'texto nuevo' : 'textos nuevos') : (n === 1 ? 'anuncio nuevo' : 'anuncios nuevos');
  return { antes: null, despues: `${n} ${que}`, pct: null, sube: true };
}

/** Lo que va en la tarjeta de HOY: lo abierto (también lo frenado, para reintentar) y lo que se aplicó HOY. */
export function deHoy<T extends Pick<Decision, 'estado' | 'aplicadaAt'>>(ds: readonly T[], ahora = Date.now()): T[] {
  const hoy = new Date(ahora).toDateString();
  return ds.filter((d) => d.estado === 'abierta' || d.estado === 'bloqueada' || d.estado === 'fallida'
    || (d.estado === 'aplicada' && !!d.aplicadaAt && new Date(d.aplicadaAt).toDateString() === hoy));
}

export type RamaDeHoy<T> = { producto: string | null; decisiones: T[] };

/** Las ramas del árbol: una por producto del CRM, en el orden en que aparecen; lo sin producto, al final. */
export function ramasDeHoy<T>(ds: readonly T[], productoDe: (d: T) => string | null): RamaDeHoy<T>[] {
  const ramas: RamaDeHoy<T>[] = [];
  for (const d of ds) {
    const p = productoDe(d);
    const r = ramas.find((x) => x.producto === p);
    if (r) r.decisiones.push(d); else ramas.push({ producto: p, decisiones: [d] });
  }
  return [...ramas.filter((r) => r.producto != null), ...ramas.filter((r) => r.producto == null)];
}

/** Las columnas del árbol (la 04 tiene tres): con un solo producto, cada cambio es su propia rama. */
export function columnasDeHoy<T>(ramas: readonly RamaDeHoy<T>[], max = 3): RamaDeHoy<T>[] {
  if (ramas.length !== 1) return ramas.slice();
  const r = ramas[0];
  const cols: RamaDeHoy<T>[] = Array.from({ length: Math.min(max, r.decisiones.length) }, () => ({ producto: r.producto, decisiones: [] }));
  r.decisiones.forEach((d, i) => cols[i % cols.length].decisiones.push(d));
  return cols;
}

const POR_TACTICA: Record<Tactica, (res: string, tipo: TipoDecision) => string> = {
  surf: (res) => `subir lo que trae ${res} más baratos`,
  sunsetting: () => 'bajar lo que se encareció',
  stop_loss: (res) => `pausar lo que gasta sin traer ${res}`,
  revive: () => 'prender lo que volvió a andar',
  calidad: () => 'pausar lo que trae leads que no agendan',
  ganador: (_res, tipo) => (tipo === 'pausar' ? 'pausar el original que ya superó su variación'
    : tipo === 'variaciones_hook' ? 'probar ganchos nuevos de tu video ganador' : 'probar textos nuevos de tu anuncio ganador'),
  manual: () => 'lo que piden tus reglas',
  hasta: () => 'pausar lo que llegó a su fecha de fin',
};

const enLista = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

/** La pastilla de arriba del árbol («AdAmigo · applied to 6 ad accounts»). */
export function pildoraDeHoy(ds: readonly Pick<Decision, 'estado'>[], productos: number): string {
  const abiertas = ds.filter((d) => d.estado !== 'aplicada').length;
  const en = productos > 1 ? ` en ${productos} productos` : '';
  if (abiertas) return `${abiertas} ${abiertas === 1 ? 'cambio' : 'cambios'} para hoy${en}`;
  return `${ds.length === 1 ? 'Aplicado' : `${ds.length} cambios aplicados`}${en}`;
}

/** El mensaje de MaKo al pie (el «Done. I moved 20% of budget...» de la 04): qué propone o qué hizo, y que se deshace. */
export function mensajeDeHoy(ds: readonly Pick<Decision, 'estado' | 'tactica' | 'tipo'>[], kpi: KpiMediaBuyer): string {
  const res = RESULTADO[kpi];
  const abiertas = ds.filter((d) => d.estado !== 'aplicada');
  const de = (xs: readonly Pick<Decision, 'tactica' | 'tipo'>[]) => enLista([...new Set(xs.map((d) => POR_TACTICA[d.tactica](res, d.tipo)))]);
  const cierre = 'Cada cambio queda en Actividad: puedes deshacer cualquiera.';
  if (abiertas.length) return `Hoy te propongo ${de(abiertas)}. ${cierre}`;
  return `Listo: ${de(ds)}. ${cierre}`;
}

// ── CAMPAÑAS como la 04: las ramas son los productos y cada tarjeta, una campaña ──────────────────────────────────────

const UNO_RES: Record<KpiMediaBuyer, string> = { lead: 'lead', agenda: 'agenda', venta: 'venta' };

/** La pastilla de Campañas: «6 campañas en 3 productos». */
export function pildoraDeCampanas(campanas: number, productos: number): string {
  const c = `${campanas} ${campanas === 1 ? 'campaña' : 'campañas'}`;
  return productos > 1 ? `${c} en ${productos} productos` : c;
}

/** El mensaje al pie de Campañas: el producto más barato y el más caro, y qué hacer con lo que no tiene producto. */
export function mensajeDeCampanas(productos: readonly { nombre: string; costo: number | null }[], sinProducto: number, kpi: KpiMediaBuyer, fmt: (n: number) => string): string {
  const res = RESULTADO[kpi];
  const con = productos.filter((p): p is { nombre: string; costo: number } => p.costo != null).sort((a, b) => a.costo - b.costo);
  const partes: string[] = [];
  if (con.length >= 2) partes.push(`«${con[0].nombre}» trae los ${res} más baratos (${fmt(con[0].costo)}) y «${con[con.length - 1].nombre}», los más caros (${fmt(con[con.length - 1].costo)}).`);
  else if (con.length === 1) partes.push(`«${con[0].nombre}»: ${fmt(con[0].costo)} por ${UNO_RES[kpi]} este mes.`);
  if (sinProducto) partes.push(sinProducto === 1 ? 'Una campaña no tiene producto: tócala para asignarle uno.' : `${sinProducto} campañas no tienen producto: tócalas para asignarles uno.`);
  else partes.push('Toca una campaña para ver sus números o cambiarla de producto.');
  return partes.join(' ');
}

/**
 * Los números del mes de Campañas en UNA línea del pie del árbol (27/10/2026): eran tres tarjetas entre la pestaña y el árbol,
 * y la captura 04 no tiene nada entre la caja del chat y la pastilla de MaKo. Gastado · resultados · costo contra el objetivo.
 */
export function lineaDelMes(m: MetasDelMes, kpi: KpiMediaBuyer, objetivo: number | null): { texto: string; tono: 'bien' | 'mal' | null } {
  const fmt = (u: number) => (m.convierte ? fmtDinero(u) : fmtDinero(u, m.moneda));
  const res = kpi === 'venta' ? m.resultados.ventas : kpi === 'agenda' ? m.resultados.agendas : m.resultados.leads;
  const costo = res > 0 ? m.gasto / res : null;
  const partes = [`Este mes: ${fmt(m.gasto)} gastados`, `${fmtNum(res)} ${res === 1 ? UNO_RES[kpi] : RESULTADO[kpi]}`];
  if (costo != null) partes.push(`${fmt(costo)} por ${UNO_RES[kpi]}${objetivo ? ` (tu objetivo: ${fmt(objetivo)})` : ''}`);
  return { texto: partes.join(' · '), tono: costo == null || !objetivo ? null : costo <= objetivo ? 'bien' : 'mal' };
}

// ── Lo que escribe la persona y lo que se lanza en lote (la revisión de tren-l, 26/10/2026) ─────────────────────────────

// El monto como lo escribe una persona vive en lib/media-buyer/monto.ts: lo usan también Ajustes y el arranque.
export { leerMonto } from '@/lib/media-buyer/monto';

/** Una decisión de variaciones (textos o ganchos nuevos): se lanza SÓLO desde su hoja, con los textos a la vista. */
export const esVariacion = (d: Pick<Decision, 'tipo'>): boolean => d.tipo === 'variaciones_texto' || d.tipo === 'variaciones_hook';

/** Lo que «Aplicar los N» puede lanzar sin abrir nada: lo abierto que NO son textos nuevos de la IA. */
export const aplicablesEnLote = <T extends Pick<Decision, 'estado' | 'tipo'>>(ds: readonly T[]): T[] => ds.filter((d) => d.estado === 'abierta' && !esVariacion(d));

/**
 * Lo que la tarjeta lee de «lanzar»: un sí, un no, o «confírmalo» (bajar el presupuesto 80% o más: lib/media-buyer/monto.ts →
 * revisarMontoEditado). Con «confírmalo» no hay aviso ni recarga: la tarjeta pregunta ahí mismo, pegado al botón.
 */
export type ResultadoAplicar = boolean | { confirmar: 'baja'; mensaje: string };
export function resultadoAplicar(r: { ok: boolean; error?: string; confirmar?: string }): ResultadoAplicar {
  if (!r.ok && r.confirmar === 'baja') return { confirmar: 'baja', mensaje: r.error ?? 'Es una baja grande.' };
  return r.ok;
}
