// =============================================================================
// ficha/tipos — el CONTRATO de la pantalla de la ficha por bloques (lo que recibe un bloque)
// =============================================================================
// Pedido de Martín (14/10/2026, 03:06): «Que Pagos sea personalizable... Que replique la edición que
// tenemos en "Dashboard" y "Landing Generator", que sea un constructor por bloques». El diseño es
// docs/diseno-ficha-bloques.md; el motor, lib/ficha/. Esto es lo que comparten el armador
// (./Armador.tsx) y los registros de cada tab (./registro-<tab>.tsx + ./reglas-<tab>.ts).
//
// CÓMO SE ENCHUFA UN BLOQUE (la tanda B2, un frente por tab, sin tocar el armador):
//   1. Las REGLAS, puras, en ./reglas-<tab>.ts: `estaVacio`, `incluye` y `disenos` (ver `ReglasBloque`).
//      Son puras para que un test las EJECUTE (los componentes arrastran server actions y no se pueden
//      importar desde node).
//   2. El COMPONENTE, en ./registro-<tab>.tsx, con las props de `PropsBloque`. Su entrada es
//      `{ Componente, ...REGLAS_<TAB>['<id>'] }`.
//   3. Lo que no viene en `LeadFullData` lo pide el bloque con SU PROPIA server action, en su propio
//      archivo, en un efecto al montarse: el armador sólo monta los bloques PUESTOS, así que nadie paga
//      la lectura de un bloque que no está. Nadie toca `getLeadFullAction`.
//   4. Si escribe algo, avisa con `useRefrescarFicha()` (../ficha-cambio.tsx) o con `ctx.releer()`: es
//      lo que hace que el pop-up se relea y que la cabecera recuente «N sin marcar».
//   5. (16/10/2026) Si la tab va ÉPICA, el bloque recibe `epico: true` y se dibuja en grande (ver `PropsBloque`).
//
// Sólo tipos, sin 'use client' ni `server-only`: lo importan la pantalla, las reglas y los tests.
// =============================================================================

import type { ComponentType } from 'react';
import type { LeadFullData } from '@/app/crm/actions';
import type { Lead } from '@/lib/leads';
import type { Stage } from '@/lib/pipeline';
import type { Ancho, BloqueDef, BloqueId, TabFicha } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import type { RolFicha } from '@/lib/ficha/registro';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';
import type { StepId } from '@/lib/stage-requirements';

/** Lo que el armador sabe del lead que está mostrando. Igual para todos los bloques de la ficha. */
export type CtxFicha = {
  /** TODO lo que trajo `getLeadFullAction` (las dos puertas leen lo mismo). */
  data: LeadFullData;
  lead: Lead;
  /** Las etapas del funnel del lead (`data.stages`). */
  stages: Stage[];
  /** La etapa vigente de la casa (`pipeline_stage` o la derivada). */
  etapa: string;
  /** La fecha de hoy, AAAA-MM-DD (para lo que cuenta días: el «Va bien»). */
  hoy: string;
  rol: RolFicha;
  esAdmin: boolean;
  /** El admin y el closer de ESTE lead (decisión 5: el puntaje de la llamada). */
  verPrivado: boolean;
  /** Releer la ficha: el pop-up vuelve a pedir `getLeadFullAction`; la ruta, `router.refresh()`. */
  releer: () => void;
  /** Aplicar en el acto lo que una acción ya escribió en el lead, y releer el resto. */
  parchear: (patch: Partial<Lead>) => void;
  /**
   * (16/10/2026) Ir a otra pestaña de la ficha por su CLAVE (la de `?tab=`: 'reuniones', 'cobranza', 'insights'…). La
   * siguiente acción del Resumen lleva a donde se resuelve («Ver llamada», «Ver análisis»).
   */
  irATab: (clave: string) => void;
  /**
   * (16/10/2026) «Solucionar» un dato sin marcar desde un bloque: el MISMO camino que la cabecera (va a la tab donde
   * esta ficha dibuja su campo y lo señala; sin ninguna, el asistente). Lo usa «Completar» de la siguiente acción.
   */
  solucionar: (paso: StepId) => void;
};

/** Lo que recibe el componente de un bloque. */
export type PropsBloque = {
  ctx: CtxFicha;
  /** El bloque tal como está puesto en la tab (ancho, diseño, ícono, opciones). */
  puesto: BloquePuesto;
  def: BloqueDef;
  tab: TabFicha;
  /** El título que se dibuja (`tituloDeBloque`): en las reuniones, el nombre de su etapa. */
  titulo: string;
  /** El diseño a dibujar: el puesto, si el bloque lo implementa; si no, el primero que implementa. */
  diseno: string;
  ancho: Ancho;
  /** El ícono elegido para el bloque, o el del catálogo. */
  icono: NombreIconoMenu;
  /** Se está personalizando la ficha (el bloque se ve, pero no se toca: lo cubre su marco). */
  editando: boolean;
  /**
   * LA TAB VA ÉPICA (16/10/2026, Martín: «que se pueda ver "epico" como lo tenemos en general»): pocas cosas, en grande.
   * La grilla ya le da más ancho y más aire (./armar.ts, `spansPorDispositivo`); el bloque decide cómo se agranda por
   * dentro (un número protagonista, sin metadata), como los bloques de General (app/general/bloques/comun.tsx). Es una
   * propiedad de la TAB: la trae su plantilla y la prende o apaga el admin en «Personalizar».
   */
  epico: boolean;
};

/** Las reglas PURAS de un bloque (en ./reglas-<tab>.ts, para que un test las ejecute). */
export type ReglasBloque = {
  /**
   * ¿No hay NADA que dibujar ni que llenar en este lead? El armador lo saltea (mirando) y no deja hueco.
   * Un bloque que se llena ahí (`sinDatos: 'raya'` en el catálogo) se dibuja con «—» y sólo devuelve
   * true cuando no APLICA (el motivo de un lead que no salió). Sin esto, se dibuja siempre.
   */
  estaVacio?: (ctx: CtxFicha, puesto: BloquePuesto) => boolean;
  /**
   * Los bloques del catálogo que este componente YA dibuja adentro (la tarjeta de hoy envuelta entera:
   * `reunion-1` es ReunionesCard, con la R2, la agenda y el setter). Cuentan como cubiertos para los
   * avisos y para «Solucionar», y en la edición se nombran en el marco.
   */
  incluye?: readonly BloqueId[];
  /**
   * Los «datos sin marcar» cuyos CAMPOS dibuja este componente, si no son los del catálogo (`def.avisa`
   * más los de `incluye`). Es lo que mira «Solucionar» para saber a qué tab ir: el banner «Va bien» lleva
   * las fechas en el catálogo y no tiene ningún campo (`cubre: []`).
   */
  cubre?: readonly StepId[];
  /** Los diseños del catálogo que el componente sabe dibujar. Con menos de dos, no se ofrece «Diseño». */
  disenos?: readonly string[];
};

/** Una entrada del registro: el componente y sus reglas. */
export type EntradaRegistro = ReglasBloque & { Componente: ComponentType<PropsBloque> };

/** El registro de una tab: un bloque sin entrada no se dibuja ni se ofrece en «Agregar bloque». */
export type RegistroBloques = Partial<Record<BloqueId, EntradaRegistro>>;
export type ReglasDeTab = Partial<Record<BloqueId, ReglasBloque>>;
