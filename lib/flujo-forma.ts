// =============================================================================
// flujo-forma — ¿el flujo está armado con las piezas de HOY? (puro)
// =============================================================================
// Undécima tanda (11/10/2026). Martín, punto 3: «En ese mismo flujo hay 2 conditions uno al lado del otro, cuando
// justamente tenemos la opción de en una misma tarjeta de condition poner más de 1... Y lo peor es que en el medio de
// los conditions hay un delay de 1 hora, eso no tiene sentido... no quiero NADA fuera de lo que ya configuramos». Y el
// punto 4: «{{Mensaje de MaKo}}, ese dato NO existe... No es trackeable». La regla, pedida varias veces y con enojo:
// NUNCA una versión vieja ni nada inventado (docs/diseno-undecima-tanda.md §0).
//
// `problemasDeForma(pasos, crones)` dice lo que un flujo trae FUERA de lo de hoy, tarjeta por tarjeta:
//   · dos CONDITION pegadas (van en UNA tarjeta, con varias filas o varias ramas);
//   · CONDITION → DELAY → CONDITION (esperar para volver a preguntar sin haber hecho nada en el medio);
//   · `{{mensaje_mako}}` (el aviso entero que armaba el código, pegado en un token);
//   · un CRON «(de antes)» (`esEventoDeAntes`: un evento del catálogo viejo en vez de una etapa);
//   · más de un AI Step por medio (uno por objetivo: los casos son escenarios adentro);
//   · un dato del EQUIPO en un mensaje al LEAD (el link a la ficha, la campaña: saldrían crudos o filtrarían algo).
//
// Lo usan: la galería (tests/plantillas-automatizaciones.test.ts: las 13 sin un solo problema), «Crear con IA»
// (lib/flujo-ia.ts: lo que el modelo arma así se dice en los avisos) y el script que rehace prod (ola 4).
//
// ⚠️ PURO, SIN `server-only`: lo leen el lienzo, el server y los tests.
// =============================================================================

import {
  claseDe, idDe, puertosDe, indicePorId, esPasoIA, medioDe, padresDe, nodoPorId, leerPuertoParalelo, ROTULO_MEDIO,
  type PasoGrafo, type MedioAIStep,
} from './flujo-grafo';
import { esEventoDeAntes, type Disparador } from './disparadores';
import { tokensDe, datoDe, CLAVE_MENSAJE_MAKO } from './variables-aviso';
import { textosDeTarjeta } from './tokens-del-flujo';

/** Qué regla rompe (estable: la leen los tests y el script). */
export type ReglaForma =
  | 'condicion_pegada'
  | 'condicion_espera_condicion'
  | 'mensaje_mako'
  | 'cron_de_antes'
  | 'ai_step_de_mas'
  | 'dato_de_equipo';

// ── Lo que habla de la reunión ────────────────────────────────────────────────────

/** ¿Es un dato de «Próxima reunión» (`{{reunion_cuando}}`, `{{reunion_link}}`…)? Un mensaje que lo cita habla de un MOMENTO. */
export const esDatoDeReunion = (key: string): boolean => datoDe(key)?.fuente === 'proxima';

/**
 * ¿LO QUE SALE EN `id` VUELVE A MIRAR LA REUNIÓN? Sube por TODOS los padres (una tarjeta puede tener varios): cada
 * camino tiene que cruzar una espera «antes de la reunión» (la ancla el motor en la próxima reunión) o la rama de una
 * condición «Próxima reunión en» que lleva hasta acá. Una espera por TIEMPO corta el camino: después de esperar hay que
 * volver a preguntar (AGENTS.md, «Un mensaje que habla de un MOMENTO se re-pregunta al salir»).
 */
export function miraLaReunion(pasos: readonly PasoGrafo[], id: string, vistos: Set<string> = new Set()): boolean {
  if (vistos.has(id)) return true;
  vistos.add(id);
  const padres = padresDe(pasos, id);
  if (!padres.length) return false;
  return padres.every((pa) => {
    const p = nodoPorId(pasos, pa.id);
    if (!p) return false;
    const c = claseDe(p);
    if (c === 'condicion') {
      const rama = pa.puerto.startsWith('par') ? leerPuertoParalelo(pa.puerto)?.resultado ?? null : pa.puerto;
      const r = (p.ramas ?? []).find((x) => x.id === rama);
      if (r?.filas.some((f) => f.campo === 'reunion_en' && !f.no)) return true;
    }
    if (c === 'esperar') return p.espera?.modo === 'antes_reunion';
    if (c === 'inicio') return false;
    return miraLaReunion(pasos, pa.id, vistos);
  });
}

/** Los mensajes (y avisos) que citan un dato de la reunión SIN volver a mirarla (`miraLaReunion`). */
export function datosDeReunionSinMirarla(pasos: readonly PasoGrafo[]): string[] {
  const out: string[] = [];
  pasos.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const c = claseDe(p);
    if (c !== 'mensaje' && c !== 'accion') return;
    const id = idDe(p, i);
    const cita = textosDeTarjeta(p).some((t) => tokensDe(t).some((x) => esDatoDeReunion(x.key)));
    if (cita && !miraLaReunion(pasos, id)) out.push(id);
  });
  return out;
}

/** `{{mensaje_mako}}` como lo lee el motor: sin mayúsculas y con espacios adentro de las llaves. */
const RE_MENSAJE_MAKO = new RegExp(`\\{\\{\\s*${CLAVE_MENSAJE_MAKO}\\s*\\}\\}`, 'i');

/** Un problema: qué regla, qué tarjeta abrir (null = el CRON) y por qué, corto. */
export type ProblemaDeForma = { regla: ReglaForma; tarjeta: string | null; motivo: string };

/** Los motivos, cortos y en tú («Poco texto quiero»). */
export const MOTIVO_FORMA = {
  condicionPegada: 'Dos CONDITION seguidas: van en una sola.',
  condicionEsperaCondicion: 'CONDITION, DELAY y otra CONDITION: entre las dos va un mensaje.',
  cronDeAntes: 'El CRON es de antes: elige una etapa.',
  aiStepDeMas: (medio: MedioAIStep) => `Más de un AI Step de ${ROTULO_MEDIO[medio]}: va uno por objetivo.`,
  mensajeMako: `No existe: {{${CLAVE_MENSAJE_MAKO}}}`,
  datoDeEquipo: (tokens: readonly string[]) => `Es del equipo: ${tokens.join(', ')}`,
} as const;

/**
 * Las CONDITION a las que se llega desde la salida `destino`, pasando SÓLO por esperas (ninguna = pegada). `esperas`
 * dice si en el camino hubo alguna. Una espera con flechas en paralelo sigue por todas.
 */
function condicionesDetras(pasos: readonly PasoGrafo[], destino: string | null): Array<{ id: string; esperas: boolean }> {
  const out: Array<{ id: string; esperas: boolean }> = [];
  const vistos = new Set<string>();
  const ir = (id: string | null, esperas: boolean) => {
    if (!id || vistos.has(id)) return;
    vistos.add(id);
    const i = indicePorId(pasos, id);
    if (i < 0) return;
    const c = claseDe(pasos[i]);
    if (c === 'condicion') { out.push({ id, esperas }); return; }
    if (c !== 'esperar') return;
    for (const pt of puertosDe(pasos, i)) ir(pt.destino, true);
  };
  ir(destino, false);
  return out;
}

/**
 * LO QUE EL FLUJO TRAE FUERA DE LO DE HOY. Vacío = está armado con las piezas de hoy. `crones`: la lista de CRON de la
 * fila (sin pasar, no se mira el CRON).
 */
export function problemasDeForma(
  pasos: readonly PasoGrafo[],
  crones: ReadonlyArray<Pick<Disparador, 'trigger_tipo' | 'cron'>> = [],
): ProblemaDeForma[] {
  const out: ProblemaDeForma[] = [];
  const poner = (p: ProblemaDeForma) => {
    if (!out.some((x) => x.regla === p.regla && x.tarjeta === p.tarjeta)) out.push(p);
  };

  if (crones.some((d) => esEventoDeAntes(d))) poner({ regla: 'cron_de_antes', tarjeta: null, motivo: MOTIVO_FORMA.cronDeAntes });

  const iasPorMedio = new Map<MedioAIStep, number>();
  pasos.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const id = idDe(p, i);
    const c = claseDe(p);

    // ── Dos CONDITION pegadas, o con sólo esperas en el medio ──
    if (c === 'condicion') {
      for (const pt of puertosDe(pasos, i)) {
        for (const d of condicionesDetras(pasos, pt.destino)) {
          poner(d.esperas
            ? { regla: 'condicion_espera_condicion', tarjeta: d.id, motivo: MOTIVO_FORMA.condicionEsperaCondicion }
            : { regla: 'condicion_pegada', tarjeta: d.id, motivo: MOTIVO_FORMA.condicionPegada });
        }
      }
    }

    // ── Más de un AI Step por medio (el segundo es el que sobra) ──
    if (esPasoIA(p)) {
      const m = medioDe(p);
      const n = (iasPorMedio.get(m) ?? 0) + 1;
      iasPorMedio.set(m, n);
      if (n > 1) poner({ regla: 'ai_step_de_mas', tarjeta: id, motivo: MOTIVO_FORMA.aiStepDeMas(m) });
    }

    // ── Los datos: `{{mensaje_mako}}` en cualquier tarjeta; uno del equipo en un mensaje al lead ──
    const textos = textosDeTarjeta(p);
    const claves = textos.flatMap((t) => tokensDe(t).map((x) => x.key));
    // Con espacios adentro también: el motor lo resuelve igual (`aplicarVariables` acepta `{{ clave }}`).
    if (claves.includes(CLAVE_MENSAJE_MAKO) || textos.some((t) => RE_MENSAJE_MAKO.test(t))) poner({ regla: 'mensaje_mako', tarjeta: id, motivo: MOTIVO_FORMA.mensajeMako });
    if (c === 'mensaje') {
      const delEquipo = [...new Set(claves.filter((k) => datoDe(k)?.soloPara === 'equipo'))];
      if (delEquipo.length) poner({ regla: 'dato_de_equipo', tarjeta: id, motivo: MOTIVO_FORMA.datoDeEquipo(delEquipo.map((k) => `{{${k}}}`)) });
    }
  });
  return out;
}
