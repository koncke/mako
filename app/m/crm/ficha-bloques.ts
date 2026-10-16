// =============================================================================
// /m/crm — QUÉ MUESTRA LA FICHA DEL TELÉFONO y en qué orden: la ficha del funnel, DESTILADA (puro)
// =============================================================================
// Pedido del 15/10/2026 (frente celular de la ficha por bloques): debajo del encabezado, la ficha del
// teléfono sigue la ELECCIÓN y el ORDEN de bloques de la ficha del funnel del lead (`fichaEfectiva`,
// lib/ficha/config.ts), con sólo los bloques que tienen versión de teléfono. Es la regla de MaKo Mobile
// (AGENTS.md, «EL TELÉFONO DESTILA EL ESCRITORIO»): no se rediseña, se destila.
//
// ⚠️ EL TELÉFONO NO TIENE EDITOR (§3 de docs/diseno-ficha-bloques.md: «Ficha del celular… no tienen editor
//    propio. Más adelante pueden leer el orden de la plantilla»). La ficha se arma en «Personalizar», en la
//    computadora, como en HubSpot, donde la vista del registro de la app del celular se configura desde la
//    computadora (documentación oficial, knowledge.hubspot.com, «Customize record previews»).
// ⚠️ LAS TABS DE ESCRITORIO VAN UNA DEBAJO DE LA OTRA, en su orden (Resumen, Tracking, Reuniones, Pagos, el de
//    FichaPorBloques), y sólo las que ESTE lead ve en escritorio: «Lo que salió de la llamada» vive en
//    Reuniones, y el teléfono la muestra sólo si el funnel tiene una etapa de reunión. Una pieza va una vez,
//    donde aparece primero.
// ⚠️ UN BLOQUE QUE SE CALLA SIN DATOS (`sinDatos: 'se-calla'` del catálogo) tampoco se dibuja en el teléfono;
//    uno con raya (`contacto`, `notas`) se dibuja siempre, como en escritorio.
//
// Puro, sin React ni server-only: lo leen el server (./datos.ts), la ficha (./[id]/FichaLead.tsx) y
// tests/m-ficha-bloques.test.ts.
// =============================================================================

import { bloqueDef, REDES, type BloqueId, type TabFicha } from '@/lib/ficha/catalogo';
import { SEXOS } from '@/lib/resumen-ficha';
import { COMO_ENTRO, entradaSocialGuardada } from '@/lib/canal-social';
import { usuarioInstagram } from '@/app/crm/campo-inline';
import { diasEntre, ingresoNoAplica, paginaLegible, textoDias, tiempoEnEtapa, usd, ETAPAS_SIN_RELOJ } from '@/app/crm/lead-view/ficha/resumen/logica';

/**
 * Las piezas que el teléfono sabe dibujar. Cada una es la versión de teléfono de UN bloque de escritorio.
 * 16/10/2026 (el Resumen nativo): cada bloque nuevo del Resumen tiene la suya, en UNA fila que se lee (el teléfono no
 * edita esos datos: «Pagos, historial y campos · En la computadora»).
 */
export type PiezaFicha = 'proxima' | 'contacto' | 'llego-por' | 'contesto' | 'llamada' | 'notas' | 'saldo' | PiezaResumen;

/** Las filas del Resumen nativo (`resumenDelTelefono`). */
export type PiezaResumen = 'siguiente' | 'equipo' | 'calificado' | 'ingreso' | 'en-etapa' | 'motivo' | 'plazo' | 'redes' | 'pagina' | 'entrada' | 'direccion' | 'sexo';

/**
 * EL BLOQUE DE ESCRITORIO → SU VERSIÓN DE TELÉFONO. Un bloque que no está aquí no tiene versión de teléfono y
 * no se dibuja (lo que se ve en el teléfono sale de lo que ya tenía la ficha v2: docs/prototipos/mako-mobile-v2.html).
 */
export const PIEZA_DE_BLOQUE: Readonly<Partial<Record<BloqueId, PiezaFicha>>> = {
  'proxima-reunion': 'proxima',
  contacto: 'contacto',
  'lo-que-contesto': 'contesto',
  origen: 'llego-por',
  notas: 'notas',
  'lo-que-salio-de-la-llamada': 'llamada',
  // El estado de cuenta (16/10/2026, la tab Pagos en bloques): lo que debe o «Al día», en una fila. El teléfono no
  // cobra: destila (`saldoDelTelefono`).
  cobrado: 'saldo',
  // El Resumen nativo (16/10/2026): una fila por bloque (`resumenDelTelefono`).
  'siguiente-accion': 'siguiente',
  'setter-y-closer': 'equipo',
  calificacion: 'calificado',
  'ingreso-estimado': 'ingreso',
  'tiempo-en-etapa': 'en-etapa',
  'motivo-de-salida': 'motivo',
  'plazo-nutricion': 'plazo',
  'redes-y-web': 'redes',
  'pagina-de-registro': 'pagina',
  'publicacion-de-entrada': 'entrada',
  direccion: 'direccion',
  sexo: 'sexo',
};

/** El orden de las tabs de la ficha de escritorio (FichaPorBloques: Tracking, Reuniones y Pagos, en ese orden). */
export const ORDEN_TABS_ESCRITORIO: readonly TabFicha[] = ['resumen', 'tracking', 'reuniones', 'pagos'];

/** Una pieza de la ficha del teléfono, con el bloque de escritorio del que sale. */
export type PiezaPuesta = { pieza: PiezaFicha; bloque: BloqueId };

/**
 * Las tabs que ESTE lead ve en escritorio, en lo que le importa al teléfono. Pagos entra sólo con un DEAL
 * (`tieneDeal`, lib/muestra-pagos.ts): su única pieza es el estado de cuenta, que sin deal se calla. La parte de la
 * pasarela de la tab (cobrar con link) no tiene versión de teléfono, así que no se lee la pasarela para esto.
 */
export function tabsQueVe(o: { verTracking: boolean; verReuniones: boolean; verPagos?: boolean }): TabFicha[] {
  return ['resumen', ...(o.verTracking ? ['tracking' as const] : []), ...(o.verReuniones ? ['reuniones' as const] : []), ...(o.verPagos ? ['pagos' as const] : [])];
}

/**
 * LAS PIEZAS DEL TELÉFONO, EN ORDEN: las tabs que el lead ve, una debajo de la otra, y en cada una los
 * bloques de la ficha del funnel que tienen versión de teléfono. Una pieza va una sola vez.
 */
export function piezasDelTelefono(tabs: Readonly<Record<TabFicha, ReadonlyArray<{ id: BloqueId }>>>, ve: readonly TabFicha[]): PiezaPuesta[] {
  const out: PiezaPuesta[] = [];
  for (const tab of ORDEN_TABS_ESCRITORIO) {
    if (!ve.includes(tab)) continue;
    for (const b of tabs[tab] ?? []) {
      const pieza = PIEZA_DE_BLOQUE[b.id];
      if (pieza && !out.some((x) => x.pieza === pieza)) out.push({ pieza, bloque: b.id });
    }
  }
  return out;
}

/** Lo que el teléfono tiene de este lead para saber si una pieza tiene algo que mostrar. */
export type ConQueDibujar = {
  proxima: string | null;
  llegoPor: string | null;
  respuestas: number;
  llamada: boolean;
  /** El estado de cuenta en una línea (`saldoDelTelefono`); null = nada que contar. */
  saldo?: SaldoTelefono | null;
  /** Las filas del Resumen nativo (`resumenDelTelefono`); una en null no se dibuja. */
  resumen?: ResumenTelefono | null;
};

/**
 * LAS FILAS DEL RESUMEN en el teléfono: el texto de cada una, o null cuando el bloque de escritorio se callaría (la
 * MISMA regla: el motivo sólo si salió, el plazo sólo en la nutrición manual, el ingreso no en un ganado, la siguiente
 * acción sólo si hay una). Lo que en escritorio se dibuja con «—» para llenarlo (el equipo, la calificación) acá dice
 * «Sin setter» o «Sin marcar»: se lee, y se llena en la computadora.
 */
export type ResumenTelefono = Partial<Record<PiezaResumen, string | null>>;

/** Lo que el teléfono sabe del lead para sus filas del Resumen (las columnas de `leads` que lee la ficha). */
export type LeadParaResumen = {
  estado_lead?: string | null; setter?: string | null; closer?: string | null; calificado?: boolean | null;
  ingreso_estimado?: number | null; motivo_perdida?: string | null; nutricion_manual_deadline?: string | null;
  web?: string | null; instagram?: string | null; youtube?: string | null; linkedin?: string | null;
  pagina_registro?: string | null; entrada_social?: unknown; direccion?: string | null; sexo?: string | null;
};

/** Las filas del Resumen de un lead. Pura: la arma el server (./datos.ts) y la ejecuta el test. */
export function resumenDelTelefono(l: LeadParaResumen, o: {
  etapa: string | null; hoy: string; ahoraMs: number;
  /** La siguiente acción del teléfono, ya armada (`siguienteAccion`, ./reglas.ts). */
  siguiente?: { titulo: string; detalle: string | null } | null;
  /** Desde cuándo está en su etapa y el plazo (la lectura de escritorio, `tiempoEnEtapaAction`). */
  enEtapa?: { desde: string | null; plazo: number | null } | null;
}): ResumenTelefono {
  const salio = l.estado_lead === 'perdido' || l.estado_lead === 'descalificado';
  const t = o.enEtapa && !(o.etapa && ETAPAS_SIN_RELOJ.includes(o.etapa)) ? tiempoEnEtapa(o.enEtapa.desde, o.enEtapa.plazo, o.ahoraMs) : null;
  const d = l.nutricion_manual_deadline ? diasEntre(o.hoy, l.nutricion_manual_deadline) : null;
  const ig = usuarioInstagram(l.instagram);
  const redes = REDES.map((r) => (r === 'instagram' ? (ig ? `@${ig}` : null) : paginaLegible(l[r]))).filter((x): x is string => !!x);
  const entrada = entradaSocialGuardada(l.entrada_social);
  return {
    siguiente: o.siguiente ? o.siguiente.titulo : null,
    equipo: `${l.setter?.trim() || 'Sin setter'} · ${l.closer?.trim() || 'sin closer'}`,
    calificado: l.calificado === true ? 'Calificado' : l.calificado === false ? 'No calificado' : 'Sin marcar',
    ingreso: ingresoNoAplica(l.estado_lead) ? null : l.ingreso_estimado != null ? usd(l.ingreso_estimado) : 'Sin estimar',
    'en-etapa': t ? (t.dias === 0 ? 'Hoy' : textoDias(t.dias)) + (t.plazo ? ` de ${t.plazo}` : '') : null,
    motivo: salio ? (l.motivo_perdida?.trim() || 'Sin motivo') : null,
    plazo: o.etapa === 'manual' ? (d == null ? 'Sin plazo' : d === 0 ? 'Vence hoy' : d > 0 ? `Faltan ${textoDias(d)}` : `Venció hace ${textoDias(-d)}`) : null,
    redes: redes.length ? redes.join(' · ') : null,
    pagina: paginaLegible(l.pagina_registro),
    entrada: entrada ? `${COMO_ENTRO[entrada.como]}${entrada.texto ? `: «${entrada.texto}»` : ''}` : null,
    direccion: l.direccion?.trim() || 'Sin dirección',
    sexo: SEXOS.find((x) => x.id === l.sexo)?.label ?? 'Sin dato',
  };
}

/** Las piezas del Resumen nativo: se callan cuando no aplican, aunque en escritorio su bloque sea de los de «—». */
const DEL_RESUMEN: ReadonlySet<PiezaFicha> = new Set<PiezaFicha>(['siguiente', 'equipo', 'calificado', 'ingreso', 'en-etapa', 'motivo', 'plazo', 'redes', 'pagina', 'entrada', 'direccion', 'sexo']);

/** El estado de cuenta, destilado a una fila: «Debe $500 · Cuota 2 venció el 02/10». */
export type SaldoTelefono = { texto: string; tono: 'verde' | 'ambar' | 'rojo' | 'gris' };

/** De `estadoDeCuenta` (lib/pagos-vistazo.ts) a la fila del teléfono. Sin estado, no hay fila. */
export function saldoDelTelefono(e: { titular: string; detalle: string | null; tono: SaldoTelefono['tono'] } | null): SaldoTelefono | null {
  return e ? { texto: e.detalle ? `${e.titular} · ${e.detalle}` : e.titular, tono: e.tono } : null;
}

/** ¿La pieza no tiene nada para este lead? `contacto` y `notas` siempre tienen (el teléfono, «Nota por voz»). */
export function piezaVacia(p: PiezaFicha, d: ConQueDibujar): boolean {
  switch (p) {
    case 'proxima': return !d.proxima;
    case 'llego-por': return !d.llegoPor;
    case 'contesto': return d.respuestas === 0;
    case 'llamada': return !d.llamada;
    case 'saldo': return !d.saldo;
    case 'contacto':
    case 'notas': return false;
    default: return !d.resumen?.[p];
  }
}

/** Las piezas que se dibujan: las vacías de un bloque que se calla sin datos, no (la regla del catálogo). */
export function piezasQueSeDibujan(piezas: readonly PiezaPuesta[], d: ConQueDibujar): PiezaPuesta[] {
  return piezas.filter((p) => !((bloqueDef(p.bloque)?.sinDatos === 'se-calla' || DEL_RESUMEN.has(p.pieza)) && piezaVacia(p.pieza, d)));
}

/**
 * Cómo se agrupan en pantalla: las filas seguidas van en una lista, y las notas son su propia sección. Arriba
 * de todo va SIEMPRE «Datos», con la fila de la etapa primero: la etapa es del encabezado, que no se
 * personaliza. Si la ficha empieza por las notas, «Datos» queda sólo con la etapa y las notas van debajo.
 */
export type GrupoFicha = { tipo: 'filas'; piezas: PiezaFicha[]; primero: boolean } | { tipo: 'notas' };

export function gruposDeLaFicha(piezas: readonly PiezaFicha[]): GrupoFicha[] {
  const out: GrupoFicha[] = [{ tipo: 'filas', piezas: [], primero: true }];
  for (const p of piezas) {
    if (p === 'notas') { out.push({ tipo: 'notas' }); continue; }
    const ultimo = out[out.length - 1];
    if (ultimo.tipo === 'filas') ultimo.piezas.push(p);
    else out.push({ tipo: 'filas', piezas: [p], primero: false });
  }
  return out;
}
