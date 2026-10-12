// =============================================================================
// El TIPO de una etapa la cambia de BANDA: Etapa/Reunión arriba, Nutrición abajo
// =============================================================================
// Pedido de Martín (12/10/2026, quinto y sexto feedback sobre el editor del funnel): «El desplegable
// de las etapas que dice "Etapa, reunión, nutrición" también lo debería tener los de nutrición... Y
// si se coloca "Etapa" se desplaza automáticamente hacia arriba, y viceversa. Es decir, también si
// arrastro debería cambiar ese desplegable», y «Todos deberían ser lo mismo, sin excepciones».
//
// Una etapa puede vivir en dos lugares, y pasar de banda es mudarla de uno a otro SIN cambiarle la
// CLAVE (la clave es lo que ata a los leads a su columna: mudada, siguen ahí):
//
//   · Una etapa del recorrido → Nutrición:
//       - si es una nutrición DE CATÁLOGO que había subido (p. ej. «Nutrición - No Agenda» elegida
//         como Etapa), sale del pipeline y se le vuelven a prender sus transiciones: vuelve a ser la
//         nutrición que deriva el recorrido, con su nombre;
//       - si no, queda guardada en el pipeline con la marca (`esNutricionPropia`, lib/pipeline.ts).
//   · Una nutrición → Etapa/Reunión:
//       - una propia (marcada) pierde la marca y entra al recorrido;
//       - una de catálogo (derivada) entra al recorrido con su clave, su nombre y su color, y se
//         APAGAN sus transiciones (`idsParaQuitarNutricion`), así no aparece dos veces.
//
// Puro y sin `server-only`: lo usa la action (`editarEtapaAction`, op `tipo`) y se prueba
// ejecutándolo (tests/crm-etapas-banda-12-10.test.ts).
// =============================================================================

import {
  conTerminales, etapaDeCatalogo, esNutricionPropia, generateFunnel, idsParaQuitarNutricion, ordenarNutricion,
  recorridoDe, type Stage,
} from './pipeline';
import { conTipo, puedeTenerTipo, type TipoEtapa } from './etapa-reunion';

/** Lo que una edición de banda toca de `funnels.data`. */
export type EstadoBanda = {
  pipeline: Stage[];
  suppressed: string[];
  labels: Record<string, string>;
  /** El orden de la banda Nutrición (`data.ordenNutricion`). */
  ordenNutricion: string[];
};

export type ResultadoBanda = { ok: true; estado: EstadoBanda } | { ok: false; error: string };

/**
 * Arma el pipeline guardado: el recorrido y, JUSTO ANTES DEL CIERRE, las nutriciones propias. El
 * cierre queda último (es lo que exige `problemasDePipeline`, y lo que espera quien busca «la última»).
 */
export function armarPipeline(recorrido: Stage[], propias: Stage[]): Stage[] {
  const ic = recorrido.findIndex((s) => s.kind === 'cierre');
  return ic < 0 ? [...recorrido, ...propias] : [...recorrido.slice(0, ic), ...propias, ...recorrido.slice(ic)];
}

/**
 * Mete `st` en el RECORRIDO en la posición `at` (la de la lista de etapas del editor), nunca antes
 * de la entrada ni después del cierre. Sin `at`, justo antes del cierre: es lo más cerca de la banda
 * Nutrición, de donde suele venir.
 */
export function insertarEnRecorrido(pipeline: Stage[], st: Stage, at?: number): Stage[] {
  const sin = pipeline.filter((x) => x.key !== st.key);
  const rec = recorridoDe(sin);
  const propias = sin.filter(esNutricionPropia);
  const piso = rec.findIndex((x) => x.kind === 'entrada') + 1;
  const ic = rec.findIndex((x) => x.kind === 'cierre');
  const techo = ic < 0 ? rec.length : ic;
  const pos = at == null || !Number.isFinite(at) ? techo : Math.max(piso, Math.min(Math.trunc(at), techo));
  return armarPipeline([...rec.slice(0, pos), st, ...rec.slice(pos)], propias);
}

/** Las claves de la banda Nutrición en el orden en que se dibujan, para este estado. */
export function ordenDeNutricion(e: EstadoBanda): string[] {
  const stages = ordenarNutricion(generateFunnel(e.pipeline, e.suppressed, e.labels).stages, e.ordenNutricion);
  return stages.filter((s) => s.band === 'nutricion').map((s) => s.key);
}

/** El orden de la banda con `key` en la posición `at` (sin `at`, primera: justo debajo de Ganado). */
export function ordenConClave(e: EstadoBanda, key: string, at?: number): string[] {
  const resto = ordenDeNutricion(e).filter((k) => k !== key);
  const pos = at == null || !Number.isFinite(at) ? 0 : Math.max(0, Math.min(Math.trunc(at), resto.length));
  return [...resto.slice(0, pos), key, ...resto.slice(pos)];
}

/**
 * La etapa `key` con el tipo `tipo`, en la banda que le corresponde y en la posición `at` de su
 * lista de destino (la del recorrido para Etapa/Reunión, la de la banda para Nutrición).
 */
export function cambiarTipo(e: EstadoBanda, key: string, tipo: TipoEtapa, at?: number): ResultadoBanda {
  const enPipeline = e.pipeline.find((s) => s.key === key);

  if (enPipeline) {
    if (!puedeTenerTipo(enPipeline)) return { ok: false, error: 'Esa etapa no lleva tipo.' };
    const eraNutricion = esNutricionPropia(enPipeline);

    if (tipo === 'nutricion') {
      // Ya estaba abajo: sólo cambia de lugar dentro de la banda.
      if (eraNutricion) return { ok: true, estado: { ...e, ordenNutricion: ordenConClave(e, key, at) } };
      const sin = e.pipeline.filter((s) => s.key !== key);
      const cat = etapaDeCatalogo(key);
      // Una nutrición DE CATÁLOGO que había subido vuelve a ser la derivada: se le prenden sus
      // transiciones (las que el recorrido de hoy le da) y conserva el nombre que tenía.
      const ids = cat?.band === 'nutricion' ? idsParaQuitarNutricion(sin, e.labels, key) : [];
      let sig: EstadoBanda;
      if (ids.length) {
        const labels = { ...e.labels };
        if (enPipeline.label && enPipeline.label !== cat?.label) labels[key] = enPipeline.label;
        else delete labels[key];
        sig = { ...e, pipeline: sin, suppressed: e.suppressed.filter((x) => !ids.includes(x)), labels };
      } else {
        sig = { ...e, pipeline: armarPipeline(recorridoDe(sin), [...sin.filter(esNutricionPropia), conTipo(enPipeline, 'nutricion')]) };
      }
      return { ok: true, estado: { ...sig, ordenNutricion: ordenConClave(sig, key, at) } };
    }

    // Etapa o Reunión. Si estaba abajo, sube al recorrido sin la marca.
    if (eraNutricion) return { ok: true, estado: { ...e, pipeline: insertarEnRecorrido(e.pipeline, conTipo(enPipeline, tipo), at) } };
    // Ya estaba en el recorrido: cambia el tipo en su lugar (moverla es `reordenar`).
    return { ok: true, estado: { ...e, pipeline: e.pipeline.map((s) => (s.key === key ? conTipo(s, tipo) : s)) } };
  }

  // No está en el pipeline: tiene que ser una columna de la banda Nutrición de ESTE funnel.
  const columna = generateFunnel(e.pipeline, e.suppressed, e.labels).stages.find((s) => s.key === key && s.band === 'nutricion');
  if (!columna) return { ok: false, error: 'Esa etapa no es de este funnel.' };
  if (tipo === 'nutricion') return { ok: true, estado: at == null ? e : { ...e, ordenNutricion: ordenConClave(e, key, at) } };

  // Una nutrición derivada sube al recorrido: se apagan sus transiciones (si no, aparecería dos
  // veces) y entra con su clave, su nombre y su color.
  const ids = idsParaQuitarNutricion(e.pipeline, e.labels, key);
  if (!ids.length) return { ok: false, error: 'Esa etapa no es de este funnel.' };
  const cat = etapaDeCatalogo(key);
  const labels = { ...e.labels };
  // El nombre pasa a vivir en la etapa: en `labels` le ganaría a cualquier renombre posterior.
  delete labels[key];
  const nueva = conTipo({
    key, label: columna.label, dot: columna.dot ?? cat?.dot ?? '#5B6472', tone: columna.tone ?? cat?.tone ?? 'neutral', kind: 'paso',
  } as Stage, tipo);
  return {
    ok: true,
    estado: {
      ...e,
      pipeline: conTerminales(insertarEnRecorrido(e.pipeline, nueva, at)),
      suppressed: [...new Set([...e.suppressed, ...ids])],
      labels,
    },
  };
}
