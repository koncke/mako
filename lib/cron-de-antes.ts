// =============================================================================
// cron-de-antes — un CRON «de antes» (un evento del catálogo) pasado a la forma de hoy
// =============================================================================
// Décima tanda, CRON 2 (11/10/2026), pedido literal de Martín: «Sospecho que muchas tarjetas quedaron
// viejas, de versiones anteriores... Siempre que se hacen modificaciones las automatizaciones ya creadas
// deben acompañar eso. Nunca nada debe quedar en una versión vieja...». El diseño entero, con lo medido,
// en docs/diseno-automations-configuraciones.md §4.
//
// LA FORMA DE HOY de lo que decía un evento («dejó el formulario sin agendar», «agendó», «no asistió»):
// el CRON es «Producto › Adquisición › Cualquier etapa» del MISMO embudo, y lo que el evento pedía es una
// CONDITION DE ENTRADA —la primera tarjeta, con «Si no» terminando— armada con filas del catálogo de
// condiciones (lib/condiciones-catalogo.ts). Es lo que la tercera tanda decidió: «Elimina lo de "Eventos"
// todo eso debería ir dentro del editable del CONDICIONAL».
//
// ⚠️ ESTO SÓLO PROPONE: no se escribe en ninguna fila hasta la FASE 1 del motor (§4 del diseño). Con el motor
// de hoy la misma propuesta cambiaría a quién le sale qué, sin un solo error:
//   · `etapas: ['*']` pasa el saneo (`normalizarEtapas` no mira la forma de la clave) y la cohorte de
//     `etapa_actual` lo busca como una etapa más: NO inscribe a NADIE (ninguna etapa se llama «*»).
//   · una CONDITION después del CRON se evalúa DESPUÉS de inscribir, y la inscripción es única por (lead,
//     automatización): quien entra a la etapa antes de agendar queda consumido y, cuando agenda, no vuelve a
//     entrar. Sólo la antigüedad se mira al inscribir (`antiguedadDeEntrada`, lib/flujo-grafo.ts).
//   · las guardas atadas al `trigger_tipo` («la reunión ya pasó», `preparaUnaReunion`) dejarían de valer.
// Por eso el script (scripts/migrar-cron-de-antes.mts) corre en SIMULACRO y su `--aplicar` se niega.
//
// PURO Y SIN `server-only`: lo leen el script y su test (tests/cron-de-antes.test.ts).
// =============================================================================

import { disparadoresDe, esEventoDeAntes, type Disparador, type FilaDisparadores } from './disparadores';
import {
  fijarRaiz, raizSalida, raicesSalida, nuevoId, normalizar, validarGrafo, antiguedadDeEntrada,
  type FilaCondicion, type PasoGrafo,
} from './flujo-grafo';
import { RELLENO_CONTROL } from './nutricion-grafo-motor';
import { abrirFlujo, esFlujoExplicito, type EstrategiaLegada } from './flujo-legado';

/**
 * «Cualquier etapa» del embudo. NO LO ENTIENDE EL MOTOR DE HOY (ver la cabecera): es el valor que la fase 1
 * le tiene que enseñar a la cohorte de `etapa_actual` y a los eventos `lead_nuevo` / `agenda_nueva`.
 */
export const CUALQUIER_ETAPA = '*';

/** Lo que pedía un evento de antes, en filas del catálogo; y lo que NO es 1:1 (se dice en el simulacro). */
export type EntradaDeAntes = { filas: readonly FilaCondicion[]; falta?: string };

const ABIERTO: FilaCondicion = { campo: 'estado_lead', valor: 'abierto' };
const AGENDADO: EntradaDeAntes = {
  filas: [{ campo: 'reunion_en', op: 'menor_igual', valor: 720 }, ABIERTO],
  falta: 'una reunión a más de 30 días queda afuera (el catálogo topea «Próxima reunión» en 720 h); la R2 cuenta como reunión',
};

/**
 * LOS EVENTOS DE ANTES QUE SE USAN EN UNA AUTOMATIZACIÓN VIVA (medido el 11/10/2026: las 6 de las 8 vivas
 * que arrancan por uno usan éstos), con la cohorte de antes que cada uno reemplaza (lib/nutricion.ts,
 * `cohorteDeTrigger`). Los que sólo quedan en archivadas (VSL, R2, post-pago, reactivación, residuo) no
 * tienen mapa: siguen «de antes» en el panel hasta que alguien recupere una.
 */
export const ENTRADA_DE_ANTES: Readonly<Record<string, EntradaDeAntes>> = {
  // `cohorteDeTrigger`: meta_lead_id, sin fecha_agenda, abierto, creado en los últimos 30 días.
  instant_form_sin_agenda: { filas: [{ campo: 'form_sin_agenda' }, ABIERTO, { campo: 'antiguedad', valor: 720 }] },
  // J1 futura sin asistencia registrada, abierto.
  agendado_sin_confirmar: AGENDADO,
  // Las dos mitades de la post-agenda: su unión es `agendado_sin_confirmar`. La partición «¿ya le hablamos?»
  // la hace adentro una CONDITION «Ya le escribiste» (la #213 ya la tiene desde la novena tanda).
  agendado_primer_contacto: AGENDADO,
  agendado_ya_contactado: AGENDADO,
  // No asistió a la J1, abierto, J1 en los últimos 45 días.
  no_show_j1: {
    filas: [{ campo: 'asistio_reunion', no: true }, ABIERTO],
    falta: 'no hay una condición «Última reunión hace menos de 45 días»; «No asistió» mira la R1 y la R2',
  },
};

export type PropuestaCronDeAntes =
  /** No arranca por ningún evento de antes. */
  | { estado: 'nada' }
  /** Arranca por uno, y no hay una forma de hoy que diga lo mismo: queda «de antes» en el panel. */
  | { estado: 'sin_propuesta'; eventos: string[]; motivo: string }
  | {
    estado: 'propuesta'; eventos: string[];
    /** La lista de CRON que quedaría: UNO, «Cualquier etapa» del embudo de la automatización. */
    disparadores: Disparador[];
    /** Los pasos que quedarían: los de hoy TAL CUAL en sus índices, el CRON (si no estaba) y la entrada AL FINAL. */
    pasos: PasoGrafo[];
    /**
     * true = era una LISTA de antes y se convirtió primero, como al abrirla en el lienzo (`abrirFlujo`).
     * Sus índices cambian: sólo vale para una automatización que nadie está recibiendo (las archivadas).
     */
    convertida: boolean;
    entrada: { id: string; filas: FilaCondicion[]; antes: string };
    /** `validarGrafo` sobre lo que quedaría. Vacío = Publicar no lo frenaría. */
    errores: string[];
    /** Lo que no es 1:1 con el evento de antes. */
    falta: string[];
    /** El tope de antigüedad que el motor de HOY miraría al inscribir (`antiguedadDeEntrada`). */
    antiguedad: number | null;
  };

/** Las filas unidas con «y» (como las arma una plantilla: `condicion`, lib/plantillas-automatizaciones.ts). */
const conY = (filas: readonly FilaCondicion[]): FilaCondicion[] => filas.map((f, k) => (k === 0 ? { ...f } : { ...f, union: 'y' as const }));

/**
 * LA PROPUESTA PARA UNA AUTOMATIZACIÓN. `usados`: ids que la historia de la automatización ya vio (el
 * `nodo_actual` y los `hilos` de sus inscripciones): un id reusado haría que una inscripción vieja siguiera por
 * la tarjeta nueva. `rnd`: el sorteo del id (el script pasa uno con semilla, así el simulacro muestra el MISMO
 * id que escribiría la fase 2).
 */
export function propuestaCronDeAntes(
  fila: FilaDisparadores & { pasos?: unknown; estrategia?: unknown },
  o: { usados?: Iterable<string>; rnd?: () => number; idDeClave?: (clave: string) => number | null } = {},
): PropuestaCronDeAntes {
  const lista = disparadoresDe(fila);
  const viejos = lista.filter(esEventoDeAntes);
  if (!viejos.length) return { estado: 'nada' };
  const eventos = viejos.map((d) => d.trigger_tipo);
  const sin = (motivo: string): PropuestaCronDeAntes => ({ estado: 'sin_propuesta', eventos, motivo });
  // Con otro CRON al lado, la entrada lo frenaría también: lo que entra por una etiqueta o un horario
  // tendría que cumplir lo que pedía el evento.
  if (viejos.length !== lista.length) return sin('tiene otros CRON: la entrada los frenaría también');
  const entradas = viejos.map((d) => ENTRADA_DE_ANTES[d.trigger_tipo]);
  if (entradas.some((e) => !e)) return sin(`sin mapa: ${eventos.filter((t) => !ENTRADA_DE_ANTES[t]).join(', ')}`);
  const firma = JSON.stringify(entradas[0].filas);
  if (entradas.some((e) => JSON.stringify(e.filas) !== firma)) return sin('los CRON de antes piden entradas distintas');

  const crudos = Array.isArray(fila.pasos) ? (fila.pasos as PasoGrafo[]) : [];
  // ⚠️ LO DE HOY, CON TODAS SUS FLECHAS ESCRITAS, antes de sumarle nada AL FINAL. Un paso sin `siguiente` sigue
  // por el de abajo del array: con la entrada agregada abajo, el último mensaje pasaba a seguir por la entrada y
  // la entrada por el primero — un círculo. Medido el 11/10/2026 con `--todas`: 24 de 32 archivadas con propuesta
  // daban «la tarjeta o2 vuelve atrás sin ninguna espera en el medio». Un flujo de tarjetas se normaliza (las
  // flechas implícitas pasan a explícitas, sin cambiar nada más); una LISTA de antes se convierte como al abrirla
  // en el lienzo (`abrirFlujo`: las esperas, «Si responde», sin «Ir a»), y eso sí cambia sus índices.
  const abierto = esFlujoExplicito(crudos)
    ? null
    : abrirFlujo(crudos, (fila.estrategia ?? null) as EstrategiaLegada, { rnd: o.rnd, idDeClave: o.idDeClave });
  // Una lista lineal SIN nada de antes (ni esperas, ni «requiere», ni estrategia) sale igual, normalizada.
  const convertida = abierto?.convertida === true;
  const hoy = abierto ? abierto.pasos : normalizar(crudos);
  if (raicesSalida(hoy).length > 1) return sin('el CRON abre hilos en paralelo: la entrada frenaría sólo uno');
  const conRaiz = fijarRaiz(hoy);
  const antes = raizSalida(conRaiz);
  if (!antes) return sin('no tiene tarjetas después del CRON');
  const historia: PasoGrafo[] = [...(o.usados ?? [])].map((id) => ({ id }));
  const id = nuevoId([...conRaiz, ...historia], o.rnd);
  const filas = conY(entradas[0].filas);
  const entrada = {
    ...RELLENO_CONTROL, id, nodo: 'condicion' as const,
    ramas: [{ id: `${id}_si`, modo: 'todas' as const, filas, siguiente: antes }],
    si_no: null,
  } as PasoGrafo;
  // La entrada va AL FINAL del array y el CRON (`inicio`) la apunta: no corre el `paso_actual` de nadie.
  const pasos = [...conRaiz.map((p) => (p.nodo === 'inicio' ? { ...p, siguiente: id } : p)), entrada];
  const primero = viejos[0];
  const disparadores: Disparador[] = [{
    id: primero.id, trigger_tipo: 'etapa_actual', etapa: CUALQUIER_ETAPA, etapas: null,
    // El embudo de la automatización: ausente/null = todos, como lo leía la cohorte de antes (`conAmbito`).
    funnel_id: fila.funnel_id == null || fila.funnel_id === '' ? null : Number(fila.funnel_id),
  }];
  return {
    estado: 'propuesta', eventos, disparadores, pasos, convertida,
    entrada: { id, filas, antes },
    errores: validarGrafo(pasos),
    falta: [...new Set(entradas.map((e) => e.falta).filter((f): f is string => !!f))],
    antiguedad: antiguedadDeEntrada(pasos),
  };
}
