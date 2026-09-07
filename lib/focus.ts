// =============================================================================
// focus — qué es lo más importante que hay que hacer ahora
// =============================================================================
// Es el cerebro del bloque AHORA de `/general`, y la razón por la que esa pantalla
// dejó de ser un espejo de resultados. El contrato lo fijó el dueño (tarea #523) y
// son SEIS CAMPOS obligatorios más el origen:
//
//   1. ACCIÓN             concreta y limitada, vinculada a un objetivo
//   2. RAZÓN              la señal o el cuello que la justifica
//   3. RESULTADO ESPERADO qué indicador debería moverse, y para dónde
//   4. RESPONSABLE        quién actúa, o qué agente puede prepararlo
//   5. PROGRESO           dónde va la cosa
//   6. SIGUIENTE REVISIÓN cuándo MaKo evalúa si funcionó
//   + ORIGEN              de dónde salió. Sin esto es una orden sin fundamento.
//
// SIN `server-only` A PROPÓSITO: no lee nada, recibe lo que la página ya leyó. Con
// eso es testeable, no gasta una sola consulta más, y —lo que importa— el ORDEN DE
// PRIORIDAD queda escrito en un lugar que se puede auditar en vez de repartido en
// la pantalla.
//
// ⚠️ NUNCA DEVUELVE NULL. La regla del dueño sobre la vista Prioridades vale igual
// acá: un tablero que se ve vacío deja de usarse. Cuando no hay nada que empujar, lo
// que corresponde es decir qué falta configurar — no una pantalla en blanco.
//
// ⚠️ Y NUNCA ELIGE UN KPI EN `sin-datos`. «No pude leer la fuente» no es una razón
// para mandar a nadie a trabajar: sería convertir un timeout de Meta en una orden.
// =============================================================================

import type { EstadoKpi, Cadencia } from './objectives-modelo';
import { capacidad } from './mako-capacidades';

export type OrigenFoco = 'kpi' | 'objetivo' | 'alerta' | 'plan' | 'arranque';

export const ORIGEN_LABEL: Record<OrigenFoco, string> = {
  kpi: 'KPI',
  objetivo: 'Objetivo',
  alerta: 'Semáforo',
  plan: 'Plan',
  arranque: 'Configuración',
};

export type Foco = {
  /** 1 — Qué hacer. Imperativa, concreta y acotada. */
  accion: string;
  /** 2 — Por qué esta y no otra. */
  razon: string;
  /** 3 — Qué indicador debería moverse. */
  resultadoEsperado: string;
  /** 4 — Quién actúa. */
  responsable: string;
  /** 5 — Dónde va. Null cuando la acción no tiene avance parcial. */
  progreso: string | null;
  /** 6 — Cuándo se vuelve a mirar. */
  siguienteRevision: string;
  origen: OrigenFoco;
  /**
   * El indice de la alerta que se convirtio en LA accion, o null.
   *
   * ⚠️ EXISTE PARA QUE EL SEMAFORO NO LA REPITA. Medido el 07/09/2026 sobre la
   * pantalla real: el titular y la primera fila del semaforo eran el MISMO texto
   * palabra por palabra —titulo y explicacion— o sea ~40 palabras duplicadas en
   * una pantalla de 304. Se devuelve el indice y no se compara por titulo: dos
   * alertas pueden llamarse igual, y una igualdad de strings se rompe el dia que
   * alguien reescribe el copy en un solo lado.
   */
  alertaIdx: number | null;
  /** El destino REAL donde se ejecuta. Nunca un href a mano cuando hay catálogo. */
  href: string;
  hrefLabel: string;
  nivel: 'rojo' | 'ambar' | 'neutro';
};

// ─────────────────────────────────────────────────────────────────────────────
// Lo que la página le pasa
// ─────────────────────────────────────────────────────────────────────────────

export type KpiParaFoco = {
  id: string;
  nombre: string;
  estado: EstadoKpi;
  cadencia: Cadencia;
  compromiso: number;
  unidad: 'usd' | 'cantidad';
  valor: number | null;
  fuente: 'auto' | 'manual';
  fuenteId: string | null;
  /** El título del objetivo del que cuelga, si cuelga de alguno. */
  objetivoTitulo: string | null;
  orden: number;
};

export type AlertaParaFoco = {
  nivel: 'rojo' | 'ambar' | 'verde';
  titulo: string;
  detalle: string;
  href: string;
  hrefLabel: string;
};

export type TareaParaFoco = {
  titulo: string;
  score: number;
  progreso: number;
  deadline: string | null;
  /** El `hacelo_en` de la tarea: un id de `mako-capacidades`, si lo tiene. */
  haceloEn?: string | null;
};

export type EntradaFoco = {
  kpis: KpiParaFoco[];
  alertas: AlertaParaFoco[];
  tareas: TareaParaFoco[];
  /** Cuántos objetivos activos hay en el Q. Cero cambia el mensaje de arranque. */
  objetivos: number;
  /**
   * El cuello de la fase, si está diagnosticado. Hoy NO se usa para redactar: se
   * deja porque es lo que ordena la PROPUESTA de KPIs (`proponerCandidatos`), y
   * tenerlo acá evita que el día que sirva alguien lo vuelva a leer de la base.
   */
  cuello: string | null;
  hoy: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// De un KPI a un lugar donde se ejecuta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A qué tab manda cada fuente automática.
 *
 * ⚠️ Los destinos salen de `lib/mako-capacidades.ts`, NUNCA de un href escrito acá.
 * Ese catálogo ya arregló dos veces un link que mandaba a una tab con nombre viejo
 * o por una URL de rebote; duplicar las rutas garantiza que la próxima corrección
 * se aplique en un lugar de dos.
 */
const CAPACIDAD_POR_FUENTE: Record<string, string> = {
  inversion_usd: 'ads-publicar',
  agendas: 'crm-lead',
  leads_nuevos: 'metricas',
  cierres: 'crm-lead',
  cash_usd: 'crm-lead',
  sold_usd: 'crm-lead',
  llamadas_analizadas: 'llamadas',
  vsl_plays: 'landing-diagnosticar',
  contenido_publicado: 'copy-ads',
};

function destinoDeKpi(k: KpiParaFoco): { href: string; label: string } {
  // Un KPI manual se resuelve ACÁ MISMO: el número lo carga la persona en el
  // tablero de esta pantalla. Mandarla a otra tab sería mandarla a dar una vuelta.
  if (k.fuente === 'manual') return { href: '/general', label: 'Registrarlo' };
  const cap = capacidad(CAPACIDAD_POR_FUENTE[k.fuenteId ?? ''] ?? '');
  // Sin capacidad conocida se cae al Dashboard, que es donde se ven los números de
  // cualquier fuente. Nunca a una ruta inventada.
  return cap ? { href: cap.ruta, label: cap.tab } : { href: '/marketing', label: 'Dashboard' };
}

const fmt = (n: number, unidad: 'usd' | 'cantidad'): string =>
  unidad === 'usd'
    ? `US$${Math.round(n).toLocaleString('es-MX')}`
    : String(Math.round(n * 100) / 100);

/** «hoy» o «esta semana», y cuándo se vuelve a mirar. */
const CIERRE: Record<Cadencia, { periodo: string; revision: string }> = {
  diaria: { periodo: 'hoy', revision: 'Mañana a primera hora' },
  semanal: { periodo: 'esta semana', revision: 'El lunes, al cerrar la semana' },
};

/**
 * La acción de un KPI, en imperativo y con el número que falta adentro.
 *
 * El copy va en español neutro con «tú» —regla de la casa— y dice CUÁNTO falta, no
 * «mejorá el KPI»: una orden sin cantidad no se puede dar por cumplida.
 */
function accionDeKpi(k: KpiParaFoco): string {
  const falta = Math.max(0, k.compromiso - (k.valor ?? 0));
  const p = CIERRE[k.cadencia].periodo;
  if (k.fuente === 'manual') {
    return `Completa «${k.nombre}» ${p}: faltan ${fmt(falta, k.unidad)} para tu compromiso.`;
  }
  const destino = destinoDeKpi(k);
  return `Ve a ${destino.label} y sube «${k.nombre}» ${fmt(falta, k.unidad)} ${p}.`;
}

/**
 * ⚠️ NO NOMBRA EL CUELLO DE LA FASE, aunque esté diagnosticado y aunque haya
 * tentado escribirlo. Un KPI guardado no registra a qué cuello le pega —eso vive
 * en el CANDIDATO, no en la fila—, así que decir «y es el cuello de tu fase» sería
 * afirmarlo de todos por igual. Un mensaje que sale solo no puede afirmar lo que no
 * verificó, y esta pantalla se lee sin nadie que la revise antes.
 */
function focoDeKpi(k: KpiParaFoco): Foco {
  const destino = destinoDeKpi(k);
  const c = CIERRE[k.cadencia];
  const valorTxt = k.valor === null ? '—' : fmt(k.valor, k.unidad);
  return {
    alertaIdx: null,
    accion: accionDeKpi(k),
    razon: `«${k.nombre}» va ${valorTxt} de ${fmt(k.compromiso, k.unidad)} ${c.periodo}.`,
    resultadoEsperado: k.objetivoTitulo
      ? `Debería mover «${k.objetivoTitulo}» hacia arriba.`
      : `Debería subir «${k.nombre}» hasta ${fmt(k.compromiso, k.unidad)}.`,
    responsable: k.fuente === 'manual' ? 'Tú lo registras' : `Tú, desde ${destino.label}`,
    progreso: `${valorTxt} de ${fmt(k.compromiso, k.unidad)}`,
    siguienteRevision: c.revision,
    origen: 'kpi',
    href: destino.href,
    hrefLabel: destino.label,
    nivel: k.estado === 'rojo' ? 'rojo' : 'ambar',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// La elección
// ─────────────────────────────────────────────────────────────────────────────

/**
 * LA acción prioritaria, con su origen.
 *
 * El orden, y cada escalón tiene su porqué:
 *
 *  1. **Un KPI en rojo.** Es lo único de esta lista sobre lo que se puede actuar
 *     HOY y que además mueve un objetivo. Va primero por eso, no por gravedad.
 *  2. **Una alerta roja del Semáforo.** Una cuota vencida o una cuenta de Meta
 *     frenada no espera al Q: es plata que se está cayendo ahora.
 *  3. **Un KPI en ámbar.** Todavía se puede corregir dentro del período.
 *  4. **La mejor tarea del plan**, que es lo que ya puntúa el Perro Guardián.
 *  5. **Qué falta configurar**, cuando no hay nada de lo anterior.
 *
 * ⚠️ Los `sin-datos` NO participan en ningún escalón. Un KPI cuya fuente no se pudo
 * leer no es un KPI incumplido, y mandarlo arriba convierte un error de red en una
 * orden de trabajo. Se muestran en el tablero, con su motivo, y ahí se quedan.
 */
export function elegirFoco(e: EntradaFoco): Foco {
  const accionables = e.kpis.filter((k) => k.estado === 'rojo' || k.estado === 'ambar');
  const peor = (estado: EstadoKpi) =>
    accionables
      .filter((k) => k.estado === estado)
      .sort((a, b) => {
        // El más lejos de su compromiso primero; a igualdad, el orden del tablero.
        const fa = a.compromiso > 0 ? (a.valor ?? 0) / a.compromiso : 1;
        const fb = b.compromiso > 0 ? (b.valor ?? 0) / b.compromiso : 1;
        return fa !== fb ? fa - fb : a.orden - b.orden;
      })[0];

  const rojo = peor('rojo');
  if (rojo) return focoDeKpi(rojo);

  const idxAlerta = e.alertas.findIndex((a) => a.nivel === 'rojo');
  const alerta = idxAlerta >= 0 ? e.alertas[idxAlerta] : undefined;
  if (alerta) {
    return {
      alertaIdx: idxAlerta,
      accion: alerta.titulo,
      razon: alerta.detalle,
      resultadoEsperado: 'Deja de perder dinero que ya está comprometido.',
      responsable: `Tú, desde ${alerta.hrefLabel}`,
      progreso: null,
      siguienteRevision: 'Mañana, en el resumen diario',
      origen: 'alerta',
      href: alerta.href,
      hrefLabel: alerta.hrefLabel,
      nivel: 'rojo',
    };
  }

  const ambar = peor('ambar');
  if (ambar) return focoDeKpi(ambar);

  const tarea = [...e.tareas].sort((a, b) => b.score - a.score)[0];
  if (tarea) {
    const cap = tarea.haceloEn ? capacidad(tarea.haceloEn) : undefined;
    return {
      alertaIdx: null,
      accion: tarea.titulo,
      razon: 'Es lo más alto que puntuó el Perro Guardián en tu plan, y no hay ningún KPI en rojo.',
      resultadoEsperado: 'Avanza el proyecto que hoy más mueve la aguja.',
      responsable: cap ? `Tú, desde ${cap.tab}` : 'Tú, desde el Plan',
      progreso: `${tarea.progreso}% avanzada`,
      siguienteRevision: tarea.deadline ? `El ${tarea.deadline}` : 'En la retro de la semana',
      origen: 'plan',
      href: cap?.ruta ?? '/plan',
      hrefLabel: cap?.tab ?? 'Plan',
      nivel: 'neutro',
    };
  }

  // ⚠️ El último escalón NO es «no hay nada que hacer»: es qué falta para que esta
  // pantalla pueda contestar la pregunta. Un tablero que se ve vacío deja de usarse,
  // y decir «todo en orden» sobre un negocio del que no se sabe nada es exactamente
  // el verde mentiroso que este rediseño vino a sacar.
  if (e.objetivos === 0) {
    return {
      alertaIdx: null,
      accion: 'Define el objetivo de este trimestre.',
      razon: 'Todavía no hay ninguno cargado, así que no puedo decirte si vas bien ni qué mover primero.',
      resultadoEsperado: 'La pantalla pasa a contestar «¿voy bien?» con un número.',
      responsable: 'Tú, en esta pantalla',
      progreso: null,
      siguienteRevision: 'Apenas lo cargues',
      origen: 'arranque',
      href: '/general',
      hrefLabel: 'Cargar el objetivo',
      nivel: 'neutro',
    };
  }
  if (e.kpis.length === 0) {
    return {
      alertaIdx: null,
      accion: 'Elige los KPIs que mueven tu objetivo.',
      razon: 'Ya tienes el objetivo, pero nada colgando abajo: sin KPIs no hay nada que seguir día a día.',
      resultadoEsperado: 'Cada semana vas a ver qué se cumplió y qué no, sin preguntarle a nadie.',
      responsable: 'MaKo te propone y tú ajustas',
      progreso: null,
      siguienteRevision: 'Apenas los elijas',
      origen: 'arranque',
      href: '/general',
      hrefLabel: 'Elegir KPIs',
      nivel: 'neutro',
    };
  }
  return {
    alertaIdx: null,
    accion: 'Vas al día con todo lo que te comprometiste.',
    razon: 'Ningún KPI en rojo ni en ámbar, y no hay alertas urgentes.',
    resultadoEsperado: 'Buen momento para subir un compromiso o sumar un KPI nuevo.',
    responsable: 'Tú',
    progreso: null,
    siguienteRevision: CIERRE.semanal.revision,
    origen: 'objetivo',
    href: '/plan',
    hrefLabel: 'Plan',
    nivel: 'neutro',
  };
}
