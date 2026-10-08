// =============================================================================
// curso-resumen — el avance del curso de un cliente, como se lo cuenta MaKo (puro)
// =============================================================================
// Sin 'server-only' a propósito: lo arma el runner de `ver_avance_curso_cs`
// (lib/api-mako/areas/cs.run.ts) y un test lo EJECUTA con datos falsos
// (tests/curso-resumen.test.ts). Acá no se lee ni se escribe nada.
//
// Pedido: que MaKo conteste por WhatsApp o por la app «¿cómo va Fulano con el curso?». Las
// lecturas ya existían (lib/curso-datos.ts) y las reglas también (lib/curso.ts); lo que faltaba
// era la operación en el registro de la API.
//
// ⚠️ LOS NÚMEROS SALEN DE LAS MISMAS FUNCIONES QUE LAS PANTALLAS: `conteoDeEtapa` (lo que mueve
// al cliente: las OBLIGATORIAS enviadas), `vistoDeEtapa` (el % sobre los videos MEDIBLES) y
// `pendientesDe`. Con una cuenta propia, MaKo diría «le faltan 3» sobre una ficha que dice 2.
//
// ⚠️ LA ETAPA ES LA DEL KANBAN: sin fila, la PRIMERA; con fila, la suya; con una fila que nombra
// una etapa que el catálogo ya no tiene, ninguna — se dice cuál era (`etapa_huerfana`) en vez
// de inventarle la primera. Es la regla de `repartirEnEtapas` (lib/servicio-etapas.ts).

import { conteoDeEtapa, vistoDeEtapa, pendientesDe, type Clase, type EstadoTarea } from './curso';

/** Cuántos títulos pendientes viajan; el total va aparte (`pendientes_total`). */
export const TOPE_PENDIENTES_MAKO = 10;

export type EtapaRef = { key: string; label: string };

export type AvanceDeCurso = {
  /** `null` = sin etapas en la entrega, o su fila nombra una etapa borrada (ver `etapa_huerfana`). */
  etapa_actual: { clave: string; nombre: string } | null;
  /** La etapa que tiene ESCRITA y que el catálogo ya no tiene. `null` = no es el caso. */
  etapa_huerfana: string | null;
  /** La regla que lo MUEVE: envió todas las obligatorias. `null` = no hay etapa actual. */
  etapa_completa: boolean | null;
  tareas_de_la_etapa: { enviadas: number; total: number; obligatorias: number; obligatorias_enviadas: number } | null;
  /** Los títulos que le faltan de SU etapa, hasta `TOPE_PENDIENTES_MAKO`. */
  pendientes: string[];
  pendientes_total: number;
  /** `pct_visto` null = la etapa no tiene videos que se puedan medir (no es 0). */
  videos_de_la_etapa: { pct_visto: number | null; medibles: number; sin_medir: number } | null;
  /** Una fila por etapa de la entrega, en su orden. */
  etapas: Array<{ clave: string; nombre: string; tareas_enviadas: number; tareas: number; completa: boolean }>;
  /**
   * Los módulos SUELTOS del curso (D1, 08/10/2026): no son etapas del kanban y no mueven a nadie, pero
   * el alumno los ve y los cursa. Sin esto MaKo los contaba en `clases_sin_etapa` («no las ve nadie»).
   */
  modulos_sueltos: Array<{ clave: string; nombre: string; tareas_enviadas: number; tareas: number }>;
  clases: number;
  /** Clases que cuelgan de una etapa (o un módulo) que ya no existe (no las ve nadie). */
  clases_sin_etapa: number;
};

/**
 * El avance de UN cliente en el curso de UN producto.
 *
 * `etapaGuardada` es la etapa ESCRITA en `cliente_entrega` para ese producto; `null` = no tiene
 * fila, o sea que está en la primera.
 */
export function avanceDeCurso(p: {
  etapas: readonly EtapaRef[];
  clases: readonly Clase[];
  etapaGuardada: string | null;
  estadoDe: (claseId: number) => EstadoTarea | undefined;
  pctDe: (claseId: number) => number | undefined;
  /** Los módulos sueltos del curso (`derivarModulos`, los no vinculados). Ausente = no tiene. */
  sueltos?: readonly EtapaRef[];
}): AvanceDeCurso {
  const claves = p.etapas.map((e) => e.key);
  const guardada = (p.etapaGuardada ?? '').trim();
  const huerfana = guardada && !claves.includes(guardada) ? guardada : null;
  const clave = huerfana ? null : (guardada || claves[0] || null);
  const ref = clave ? p.etapas.find((e) => e.key === clave) ?? null : null;

  const deEtapa = (k: string) => p.clases.filter((c) => c.etapa === k);
  const actuales = clave ? deEtapa(clave) : [];
  const conteo = clave ? conteoDeEtapa(actuales, p.estadoDe) : null;
  const pendientes = clave ? pendientesDe(actuales, p.estadoDe).map((c) => c.titulo) : [];
  const visto = clave ? vistoDeEtapa(actuales, p.pctDe) : null;

  return {
    etapa_actual: ref ? { clave: ref.key, nombre: ref.label } : null,
    etapa_huerfana: huerfana,
    etapa_completa: conteo ? conteo.completa : null,
    tareas_de_la_etapa: conteo
      ? { enviadas: conteo.enviadas, total: conteo.tareas, obligatorias: conteo.obligatorias, obligatorias_enviadas: conteo.obligatoriasEnviadas }
      : null,
    pendientes: pendientes.slice(0, TOPE_PENDIENTES_MAKO),
    pendientes_total: pendientes.length,
    videos_de_la_etapa: visto ? { pct_visto: visto.pct, medibles: visto.medibles, sin_medir: visto.sinMedir } : null,
    etapas: p.etapas.map((e) => {
      const k = conteoDeEtapa(deEtapa(e.key), p.estadoDe);
      return { clave: e.key, nombre: e.label, tareas_enviadas: k.enviadas, tareas: k.tareas, completa: k.completa };
    }),
    modulos_sueltos: (p.sueltos ?? []).map((m) => {
      const k = conteoDeEtapa(deEtapa(m.key), p.estadoDe);
      return { clave: m.key, nombre: m.label, tareas_enviadas: k.enviadas, tareas: k.tareas };
    }),
    clases: p.clases.length,
    clases_sin_etapa: p.clases.filter((c) => !claves.includes(c.etapa) && !(p.sueltos ?? []).some((m) => m.key === c.etapa)).length,
  };
}

/** Lo mínimo del acceso al portal que hace falta para contarlo (`EstadoAcceso`, lib/curso-datos.ts). */
export type AccesoLeido = {
  revocado: boolean; ingresos: number; ultimoIngresoAt: string | null; invitacionEnviadaAt: string | null;
};

/**
 * El acceso del cliente a su portal, en palabras del modelo.
 *
 * ⚠️ «Sin link» y «no se pudo leer» son dos cosas: `null` acá es «nunca se le dio el acceso»;
 * quien llama dice aparte si la lectura falló. Y `invitado_por_mail: false` NO es «no tiene el
 * link»: se le puede haber mandado por WhatsApp desde la ficha.
 */
export function accesoParaMako(a: AccesoLeido | null): {
  estado: 'sin-link' | 'activo' | 'cortado'; ingresos: number; ultimo_ingreso: string | null;
  invitado_por_mail: boolean; invitado_el: string | null;
} {
  if (!a) return { estado: 'sin-link', ingresos: 0, ultimo_ingreso: null, invitado_por_mail: false, invitado_el: null };
  return {
    estado: a.revocado ? 'cortado' : 'activo',
    ingresos: a.ingresos,
    ultimo_ingreso: a.ultimoIngresoAt,
    invitado_por_mail: a.invitacionEnviadaAt != null,
    invitado_el: a.invitacionEnviadaAt,
  };
}

/**
 * Lo que el modelo tiene que leer junto con los números. Viaja con cada lectura: es la única
 * defensa contra un 0 leído como un hecho (el mismo criterio que `NOTAS_CARTERA`).
 */
export const NOTAS_CURSO: readonly string[] = [
  'La etapa es la de la ENTREGA del servicio (las columnas del kanban de Customer Success). Un cliente que nadie movió está en la PRIMERA etapa: no es «sin etapa».',
  'etapa_completa es la regla que mueve al cliente de etapa: envió TODAS las tareas obligatorias. Una etapa sin obligatorias no se completa sola: la mueve el equipo a mano.',
  'pct_visto null = la etapa no tiene videos que se puedan medir. No es 0.',
  'Los videos de Drive o Loom cuentan en sin_medir: esas plataformas no dicen cuánto se reprodujo. Nunca digas que no los vio.',
  'acceso.estado «sin-link» = todavía no se le generó el acceso al portal. invitado_por_mail false no quiere decir que no tenga el link: se le puede haber mandado por WhatsApp.',
  'acceso null = no se pudo leer. No es «nunca entró».',
  'etapa_huerfana = la etapa guardada del cliente ya no existe en la entrega (alguien borró esa columna): hay que moverlo a mano.',
  'modulos_sueltos = módulos del curso que NO son etapas del kanban: el alumno los ve y los cursa, pero completarlos no lo mueve de etapa.',
  'Esta lectura no crea el acceso ni le manda nada al cliente. El link se manda desde su ficha en Customer Success.',
];
