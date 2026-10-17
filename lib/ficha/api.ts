// =============================================================================
// ficha/api — lo que ve y lo que pide MaKo de la ficha de un CRM (ver_ficha_funnel, cambiar_ficha_funnel)
// =============================================================================
// La API de MaKo habla en las palabras de un modelo («ancho 1/2», «estilo con tema editorial», «plantilla
// auto»); el motor, en CambioFicha (lib/ficha/config.ts). Esta es la traducción, en los dos sentidos, PURA
// para que el test la ejecute (tests/ficha-api.test.ts): los runners de lib/api-mako/areas/crm.run.ts sólo
// leen la ficha y llaman a esto.
// =============================================================================

import type { FichaDelFunnel } from './config-server';
import { sanearCambio, type CambioFicha } from './config';
import { bloqueDef, bloquesDeLaTab, esTabFicha, vaEnTab, NOMBRE_TAB, TABS_FICHA, ANCHOS, DENSIDADES, REDES, FUENTES_RESPUESTA, type Ancho } from './catalogo';
import { plantillaFicha, PLANTILLAS_FICHA } from './plantillas';
import { galeriaDeTab, plantillaTabPorId, plantillasDeTab } from './plantillas-tab';
import { DATOS_AVISABLES } from '../datos-aviso';
import { NOMBRES_ICONO_MENU, type NombreIconoMenu } from '../../app/_ui/iconos-menu';

/**
 * Los valores de `cambio` de la operación: los mismos que declara su def (lib/api-mako/areas/crm.def.ts).
 * ⚠️ SON TODO LO QUE HACE «PERSONALIZAR» EN LA PANTALLA (app/crm/lead-view/ficha/), menos «Deshacer»: el ícono
 *    de un bloque se sumó el 15/10/2026 porque la pantalla lo cambiaba y MaKo no (AGENTS.md, toda feature va a la
 *    API). Deshacer no tiene op: la pantalla guarda el `antes` en memoria y el funnel no tiene historial.
 */
export const CAMBIOS_API = ['poner', 'quitar', 'mover', 'ancho', 'diseno', 'icono', 'opciones', 'aviso', 'estilo', 'densidad', 'plantilla', 'volver', 'nombre', 'epica'] as const;
/**
 * Lo que hace la pantalla y va por OTRA operación de la API, no por cambiar_ficha_funnel: armar una tab con un pedido
 * («¿Qué vas a crear hoy?») pasa por la IA y es `armar_tab_ficha` (lib/api-mako/areas/crm.def.ts).
 */
export const CAMBIO_DE_OTRA_OP: Readonly<Record<string, string>> = { armar: 'armar_tab_ficha' };
/** El ancho como lo dice una persona. */
export const ANCHOS_API = ['1/4', '1/3', '1/2', 'completo'] as const;
/** «El de siempre» en la API: vuelve al ícono del catálogo. */
export const ICONO_DE_SIEMPRE = 'de-siempre';
/** Los íconos que se le pueden poner a un bloque: los del picker de la pantalla (el set, sin el tacho de borrar). */
export const ICONOS_BLOQUE: readonly NombreIconoMenu[] = NOMBRES_ICONO_MENU.filter((x) => x !== 'borrar');

const ANCHO_DE: Readonly<Record<string, Ancho>> = { '1/4': 3, '1/3': 4, '1/2': 6, completo: 12 };
const NOMBRE_ANCHO: Readonly<Record<Ancho, string>> = { 3: '1/4', 4: '1/3', 6: '1/2', 12: 'completo' };
const POR_QUE: Readonly<Record<string, string>> = {
  siempre: 'siempre avisa', 'a-mano': 'lo eligió alguien en este CRM', negocio: 'lo apagó el negocio para todos sus CRM',
  plantilla: 'la plantilla no lo pide', 'de-entrada': 'de entrada',
};

const n = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const s = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const b = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);

/** Del input de la operación al cambio del motor, saneado. Un bloque que no va devuelve los que sí van. */
export function cambioDeInputApi(input: Record<string, unknown>): CambioFicha | { error: string; disponibles?: unknown } {
  const tab = s(input.tab);
  const bloque = s(input.bloque);
  const base = { tab, bloque, ...(n(input.n) ? { n: n(input.n) } : {}) };
  let crudo: Record<string, unknown>;
  switch (s(input.cambio)) {
    case 'poner': crudo = { op: 'poner', ...base, lugar: n(input.lugar), ancho: s(input.ancho) ? ANCHO_DE[s(input.ancho)!] ?? -1 : undefined, diseno: s(input.diseno) }; break;
    case 'quitar': crudo = { op: 'quitar', ...base }; break;
    case 'mover': crudo = { op: 'mover', ...base, lugar: n(input.lugar) }; break;
    case 'ancho': crudo = { op: 'ancho', ...base, ancho: ANCHO_DE[s(input.ancho) ?? ''] }; break;
    case 'diseno': crudo = { op: 'diseno', ...base, diseno: s(input.diseno) }; break;
    case 'icono': {
      const ic = s(input.icono);
      if (!ic) return { error: `Falta el ícono: uno de la lista «iconos» de ver_ficha_funnel, o «${ICONO_DE_SIEMPRE}».` };
      if (ic !== ICONO_DE_SIEMPRE && !(ICONOS_BLOQUE as readonly string[]).includes(ic)) return { error: 'Ese ícono no es del set.', disponibles: ICONOS_BLOQUE };
      crudo = { op: 'icono', ...base, icono: ic === ICONO_DE_SIEMPRE ? null : ic };
      break;
    }
    case 'opciones': {
      // (16/10/2026) Lo que «Personalizar» elige adentro de un bloque (Opciones): las redes de redes-y-web, las fuentes de
      // lo-que-contesto o la pregunta de respuesta-destacada. UN parámetro de texto (`opcion`) y no tres: la def viaja en
      // el turno de WhatsApp. Qué es lo dice el bloque.
      const def = bloque ? bloqueDef(bloque) : undefined;
      const op = s(input.opcion);
      if (!def?.opciones?.length) return { error: 'Ese bloque no tiene opciones: sólo redes-y-web (redes), lo-que-contesto (fuentes) y respuesta-destacada (pregunta).' };
      if (!op) return { error: 'Falta la opcion.' };
      if (def.opciones.includes('pregunta')) { crudo = { op: 'opciones', ...base, opciones: { pregunta: op } }; break; }
      const validos: readonly string[] = def.opciones.includes('redes') ? REDES : FUENTES_RESPUESTA;
      const pide = op.toLowerCase().split(/[\s,;]+/).filter(Boolean);
      if (!pide.length || pide.some((x) => !validos.includes(x))) return { error: 'Hay una que no existe.', disponibles: [...validos] };
      crudo = { op: 'opciones', ...base, opciones: def.opciones.includes('redes') ? { redes: pide } : { fuentes: pide } };
      break;
    }
    case 'aviso': {
      // Sin enum en la def (pesa en el turno de WhatsApp): el id se valida acá, con los que hay.
      if (!DATOS_AVISABLES.some((x) => x.id === s(input.aviso))) return { error: 'Ese dato no existe.', disponibles: DATOS_AVISABLES.map((x) => x.id) };
      crudo = { op: 'aviso', paso: s(input.aviso), avisa: b(input.avisa) };
      break;
    }
    case 'densidad': crudo = { op: 'densidad', densidad: s(input.densidad) }; break;
    case 'plantilla': {
      // Con tab, la plantilla de ESA tab (16/10/2026). Sin enum en la def: los ids salen de ver_ficha_funnel y se
      // validan acá, devolviendo los que hay.
      const pl = s(input.plantilla);
      if (tab) {
        if (!esTabFicha(tab)) return { error: 'Falta la tab: resumen, reuniones, pagos o tracking.' };
        if (pl && pl !== 'auto' && plantillaTabPorId(pl)?.tab !== tab) return { error: `Esa plantilla no es de ${NOMBRE_TAB[tab]}.`, disponibles: plantillasDeTab(tab).map((x) => x.id) };
        crudo = { op: 'plantilla', tab, plantilla: !pl || pl === 'auto' ? null : pl };
        break;
      }
      if (pl && pl !== 'auto' && !PLANTILLAS_FICHA.some((x) => x.id === pl)) return { error: 'Esa plantilla no existe.', disponibles: [...PLANTILLAS_FICHA.map((x) => x.id), 'auto'] };
      crudo = { op: 'plantilla', plantilla: pl === 'auto' ? null : pl };
      break;
    }
    case 'nombre': crudo = { op: 'nombre', tab, nombre: typeof input.nombre === 'string' ? input.nombre : null }; break;
    case 'epica': crudo = { op: 'epica', tab, epica: b(input.epica) }; break;
    case 'volver': crudo = { op: 'volver', ...(tab ? { tab } : {}) }; break;
    case 'estilo': {
      const tema: Record<string, unknown> = {};
      if (s(input.tema)) tema.plantilla = s(input.tema);
      if (s(input.tipografia)) tema.fuente = s(input.tipografia);
      if (input.acento !== undefined) {
        const a = String(input.acento ?? '').trim();
        if (a && a !== 'ninguno' && !/^#[0-9a-f]{6}$/i.test(a)) return { error: 'El acento va en hex, #RRGGBB.' };
        tema.acento = a && a !== 'ninguno' ? a.toLowerCase() : null;
      }
      if (!Object.keys(tema).length) return { error: 'Falta qué cambiar del estilo: tema, acento o tipografia.' };
      crudo = { op: 'tema', tema };
      break;
    }
    default: return { error: 'Falta qué cambiar.' };
  }
  const c = sanearCambio(crudo);
  if (!('error' in c)) return c;
  const def = bloque ? bloqueDef(bloque) : undefined;
  if (bloque && esTabFicha(tab) && (!def || !vaEnTab(def, tab))) {
    return { error: c.error, disponibles: bloquesDeLaTab(tab).map((x) => x.id) };
  }
  return c;
}

/** Lo que ve MaKo de la ficha de un CRM: lo puesto, lo que avisa y por qué, y lo que se puede sumar. */
export function salidaFichaApi(f: Pick<FichaDelFunnel, 'funnel' | 'eleccion' | 'efectiva'>) {
  const ef = f.efectiva;
  const tabs = Object.fromEntries(TABS_FICHA.map((tab) => {
    const puestos = ef.tabs[tab];
    const ya = new Set(puestos.map((p) => p.id));
    const pt = plantillaTabPorId(ef.plantillasTab[tab]);
    return [tab, {
      nombre: ef.nombres[tab],
      ...(ef.nombres[tab] !== NOMBRE_TAB[tab] ? { nombre_de_siempre: NOMBRE_TAB[tab] } : {}),
      epica: ef.epica[tab],
      plantilla: { id: ef.plantillasTab[tab], nombre: pt?.nombre ?? ef.plantillasTab[tab], elegida_por: ef.plantillasTabAMano.includes(tab) ? 'una persona' : 'MaKo' },
      configurada: ef.configuradas.includes(tab),
      sigue_a_la_plantilla: !ef.tocadas.includes(tab),
      bloques: puestos.map((p, i) => {
        const def = bloqueDef(p.id);
        return {
          lugar: i + 1, bloque: p.id, titulo: def?.titulo ?? p.id, ancho: NOMBRE_ANCHO[p.ancho],
          diseno: p.diseno, diseno_nombre: def?.disenos.find((x) => x.id === p.diseno)?.nombre ?? p.diseno,
          ...(p.icono ? { icono: p.icono } : {}), ...(p.opciones ? { opciones: p.opciones } : {}),
          ...(def && def.avisa.length ? { completa: def.avisa } : {}),
        };
      }),
      para_sumar: bloquesDeLaTab(tab).filter((d) => d.varias || !ya.has(d.id)).map((d) => ({
        bloque: d.id, titulo: d.titulo, anchos: d.anchos.map((a) => NOMBRE_ANCHO[a]), disenos: d.disenos.map((x) => x.id),
      })),
      // La galería de la tab, en el orden de la pantalla: «En blanco», las sugeridas (con su porqué) y el resto.
      plantillas: galeriaDeTab(tab, { plantilla: ef.plantilla, porque: ef.plantillaAMano ? undefined : f.eleccion.porque }).map(({ plantilla: x, porque }) => ({
        id: x.id, nombre: x.nombre, de_que_se_trata: x.bajada, bloques: x.bloques.length, ...(x.epico ? { epica: true } : {}), ...(porque ? { sugerida: porque } : {}),
      })),
    }];
  }));
  return {
    crm: { id: f.funnel.id, nombre: f.funnel.nombre, principal: f.funnel.esDefault },
    plantilla: {
      id: ef.plantilla, nombre: plantillaFicha(ef.plantilla).nombre,
      elegida_por: ef.plantillaAMano ? 'una persona' : 'MaKo',
      la_de_mako: { id: f.eleccion.id, nombre: plantillaFicha(f.eleccion.id).nombre, porque: f.eleccion.porque },
    },
    tabs,
    nota: 'Si una tab sale en la ficha lo decide el CRM: Reuniones sólo con una etapa de reunión, Pagos con una venta o un cobro, Tracking con datos de la visita o del anuncio.',
    avisos: ef.avisos.map((a) => ({ dato: a.id, nombre: a.label, avisa: a.avisa, por_que: POR_QUE[a.por] ?? a.por })),
    estilo: { tema: ef.estilo.tema.plantilla, acento: ef.estilo.tema.acento, tipografia: ef.estilo.tema.fuente, densidad: ef.estilo.densidad },
    plantillas: PLANTILLAS_FICHA.map((p) => ({ id: p.id, nombre: p.nombre })),
    densidades: DENSIDADES.map((x) => x.id),
    anchos: ANCHOS.map((a) => NOMBRE_ANCHO[a.id]),
    iconos: [...ICONOS_BLOQUE],
  };
}
