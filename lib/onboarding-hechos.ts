// =============================================================================
// onboarding-hechos — lo que dice la BASE de un paso del onboarding, antes de cerrarlo desde afuera
// =============================================================================
// La mitad que lee de lib/onboarding-pasos-api.ts (la decisión es pura y vive allá, con test). La usan las dos
// operaciones de la API de MaKo que escriben un onboarding: cerrar_paso_onboarding y marcar_paso_onboarding_tab.
//
// ⚠️ CADA PASO SE COMPRUEBA CON EL CRITERIO DE SU PANTALLA O CON UNO MÁS ESTRICTO, nunca con uno más flojo:
//   · el arranque: lo que escribe o exige el chat de arranque (`cierreDePasos`, `hechosDelArranque`).
//   · la tab: el `onListo` de cada vista del wizard (EntregableView, AvataresView, PersonaView, PersonalidadView,
//     MatrizView) y lo que guarda cada action del Video Generator.
// Si el criterio de una pantalla cambia, cambia acá: el test (tests/api-negocio-onboarding.test.ts) mira las dos.
// Más estrictos A PROPÓSITO (revisión del 23/10/2026): `contexto` exige la guía de voz escrita (la pantalla lo marca sin
// ella), `carousels_contexto` y `stories_contexto` exigen que el perfil diga a qué se dedica el negocio (la pantalla sólo
// lo muestra) y `cg_angulos` cuenta las celdas de un avatar que existe. Desde afuera nadie está mirando la pantalla: se
// exige el dato. Quien lo hizo en pantalla sin el dato recibe «todavía no está», que es el lado seguro.
//
// ⚠️ «NO PUDE LEER» CAE DEL LADO SEGURO. Varias lecturas de abajo son tolerantes (una lectura caída devuelve vacío):
// para MARCAR un paso eso se lee «todavía no está», que rechaza en vez de afirmar. Las que deciden el arranque (el
// perfil y la fase) se leen estrictas: con la base caída, la propuesta no se arma.
//
// ⚠️ LOS PASOS QUE SALIERON DEL ARRANQUE (archivero, entregable, avatares, persona, personalidad, angulos, gemini,
// retro) NO se comprueban: ninguna capa los pide hoy y se mudaron a su tab. Devuelven `sinDato`, así un paso viejo no
// se cierra por la API con un criterio que nadie mira.
// =============================================================================

import 'server-only';
import type { CapaDef, PasoOnboarding } from './capas';
import type { HechoDePaso } from './onboarding-pasos-api';
import { MIN_FOTOS_PERSONA } from './persona-reglas';
import { getSettingEstricto } from './settings';
import { ANSWERS_KEY } from './onboarding';
import { listProductos } from './productos';
import { getDiagnosticoFaseEstricto } from './fase-store';
import { faseDef } from './fase-diagnostico';
import { getEstadoVerificacionContacto } from './mako-grupo';
import { getContactoReportes } from './perfil';
import { integracionConectada } from './credenciales';
import { getEntregables } from './entregable';
import { getAvatares } from './avatares';
import { getPersona } from './persona';
import { getPersonalidad } from './personalidad-store';
import { personalidadCompleta, PERSONALIDAD_PREGUNTAS } from './personalidad';
import { getRazones } from './razones';
import { getVozCliente } from '@/app/video-generator/voz-cliente';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * «Tu negocio»: a qué se dedica (`negocio_que_hace`), que es lo que el chat de arranque escribe siempre en el perfil
 * (de lo que contó o de la frase de su oferta: `briefDesdeArranque`). Lectura ESTRICTA: un perfil que no se pudo leer
 * no es un perfil vacío, y un JSON roto tampoco.
 */
async function negocioCargado(): Promise<HechoDePaso> {
  const raw = await getSettingEstricto(ANSWERS_KEY);
  let answers: Record<string, unknown> = {};
  if (raw) {
    try { answers = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error('El perfil del negocio no es legible: no se cierra nada sobre él.'); }
  }
  const queHace = typeof answers.negocio_que_hace === 'string' ? answers.negocio_que_hace.trim() : '';
  return queHace
    ? { cumplido: true, que: `el perfil dice a qué se dedica: «${queHace.slice(0, 80)}»` }
    : { cumplido: false, falta: 'el perfil no dice a qué se dedica el negocio. Se completa con guardar_campo_perfil (negocio_que_hace).' };
}

async function faseGuardada(): Promise<HechoDePaso> {
  const d = await getDiagnosticoFaseEstricto();
  return d
    ? { cumplido: true, que: `el diagnóstico está guardado: Fase ${faseDef(d.fase).id}` }
    : { cumplido: false, falta: 'el negocio nunca hizo el diagnóstico de fase. Se guarda con guardar_diagnostico_fase.' };
}

/** Teléfono verificado = el GUARDADO es el mismo que se verificó por WhatsApp (el criterio del arranque y del wizard). */
async function telefonoVerificado(ws: number): Promise<HechoDePaso> {
  const [verif, contacto] = await Promise.all([getEstadoVerificacionContacto(ws), getContactoReportes()]);
  const guardado = contacto.telefono.replace(/\D/g, '');
  return verif.verificado && guardado && verif.telefono === guardado
    ? { cumplido: true, que: 'el teléfono de los reportes está verificado' }
    : { cumplido: false, falta: 'el teléfono de los reportes no está verificado (se verifica en Perfil con el código de WhatsApp).' };
}

const SALIO_DEL_ARRANQUE: HechoDePaso = { sinDato: 'ya no es un paso del arranque: se configura en su tab.' };

/**
 * Lo que dice la base de un paso del ARRANQUE. El `satisfies` obliga a decidir cada paso de `PASOS_ONBOARDING`:
 * uno nuevo sin su comprobación no compila (sin eso, cerraría por la API con un criterio que nadie escribió).
 */
export async function hechoDePasoOnboarding(paso: PasoOnboarding, ws: number, capa: CapaDef): Promise<HechoDePaso> {
  const comprobar = {
    negocio: negocioCargado,
    fase: faseGuardada,
    productos: async (): Promise<HechoDePaso> => {
      const n = (await listProductos()).length; // tira si la base no contesta
      return n
        ? { cumplido: true, que: `${plural(n, 'producto cargado', 'productos cargados')} en el catálogo` }
        : { cumplido: false, falta: 'el catálogo no tiene ningún producto. Se arma con sugerir_productos o en el CRM.' };
    },
    // «Tu plan de arranque» no deja un dato propio: es el cierre del modo 'plan' del chat, que lo marca hecho junto con
    // el negocio y la fase (`cierreDePasos`). Lo que lo hace cierto son esos dos, y eso se exige.
    plan: async (): Promise<HechoDePaso> => {
      const [n, f] = await Promise.all([negocioCargado(), faseGuardada()]);
      if ('cumplido' in n && !n.cumplido) return n;
      if ('cumplido' in f && !f.cumplido) return f;
      return { cumplido: true, que: 'el perfil y el diagnóstico de fase están cargados' };
    },
    tabs: () => telefonoVerificado(ws),
    // TODAS las que pide su capa, no sólo Meta (el mismo criterio que lib/onboarding-pendientes.ts).
    integraciones: async (): Promise<HechoDePaso> => {
      const req = capa.integracionesRequeridas;
      if (!req.length) return { cumplido: true, que: 'este plan no pide conectar ninguna cuenta' };
      const faltan = (await Promise.all(req.map(async (k) => ((await integracionConectada(k, ws)) ? null : k)))).filter(Boolean);
      return faltan.length
        ? { cumplido: false, falta: `falta conectar ${faltan.join(', ')} en Integraciones.` }
        : { cumplido: true, que: `${req.join(', ')} conectado${req.length === 1 ? '' : 's'}` };
    },
    archivero: async () => SALIO_DEL_ARRANQUE,
    entregable: async () => SALIO_DEL_ARRANQUE,
    avatares: async () => SALIO_DEL_ARRANQUE,
    persona: async () => SALIO_DEL_ARRANQUE,
    personalidad: async () => SALIO_DEL_ARRANQUE,
    angulos: async () => SALIO_DEL_ARRANQUE,
    gemini: async () => SALIO_DEL_ARRANQUE,
    retro: async () => SALIO_DEL_ARRANQUE,
  } satisfies Record<PasoOnboarding, () => Promise<HechoDePaso>>;
  return comprobar[paso]();
}

/**
 * Lo que dice la base de un paso de TAB de los que la API puede marcar (`PASOS_TAB_POR_API`). El criterio de cada uno
 * es el de su pantalla o uno más estricto (ver la cabecera); uno que no está acá vuelve `sinDato` y no se marca.
 */
export async function hechoDePasoTab(paso: string): Promise<HechoDePaso> {
  switch (paso) {
    case 'cg_entregable': {
      const n = (await getEntregables()).length;
      return n ? { cumplido: true, que: plural(n, 'lead magnet cargado', 'lead magnets cargados') } : { cumplido: false, falta: 'no hay ningún lead magnet (se generan con generar_lead_magnets).' };
    }
    case 'cg_avatares': {
      const n = (await getAvatares()).length;
      return n ? { cumplido: true, que: plural(n, 'avatar cargado', 'avatares cargados') } : { cumplido: false, falta: 'no hay ningún avatar (se generan con generar_avatares).' };
    }
    case 'cg_persona': {
      // El `onListo` de PersonaView: al menos MIN_FOTOS_PERSONA fotos Y la descripción escrita.
      const p = await getPersona();
      if (p.fotos.length < MIN_FOTOS_PERSONA) return { cumplido: false, falta: `la cara de la marca tiene ${p.fotos.length} de ${MIN_FOTOS_PERSONA} fotos (se suben en la tab Ads Writer).` };
      if (!p.descripcion.trim()) return { cumplido: false, falta: 'falta la descripción física de la cara de la marca (guardar_descripcion_cara_de_marca).' };
      return { cumplido: true, que: `${plural(p.fotos.length, 'foto', 'fotos')} y la descripción física` };
    }
    case 'cg_personalidad': {
      const p = await getPersonalidad();
      const n = Object.keys(p.respuestas).length;
      return personalidadCompleta(p)
        ? { cumplido: true, que: 'el quiz de voz está completo' }
        : { cumplido: false, falta: `el quiz de voz tiene ${n} de ${PERSONALIDAD_PREGUNTAS.length} respuestas (responder_pregunta_personalidad).` };
    }
    case 'cg_angulos': {
      // Lo que DIBUJA la Matriz: las celdas de un avatar que existe (borrar un avatar no borra sus razones).
      const [razones, avatares] = await Promise.all([getRazones(), getAvatares()]);
      const ids = new Set(avatares.map((a) => a.id));
      const n = razones.filter((r) => ids.has(r.avatarId)).length;
      return n ? { cumplido: true, que: `la matriz tiene ${plural(n, 'anuncio planteado', 'anuncios planteados')}` } : { cumplido: false, falta: 'la matriz de anuncios está vacía (se arma en la tab Ads Writer).' };
    }
    case 'vg_cara': {
      const n = (await getPersona()).fotos.length;
      return n ? { cumplido: true, que: plural(n, 'foto cargada', 'fotos cargadas') } : { cumplido: false, falta: 'no hay ninguna foto de la persona (se suben en la tab Video Generator).' };
    }
    case 'vg_acento': {
      const v = await getVozCliente();
      return v.acento ? { cumplido: true, que: `el acento está guardado (${v.acento})` } : { cumplido: false, falta: 'todavía no eligió cómo habla (se elige en la tab Video Generator).' };
    }
    case 'contexto': {
      // «Tu forma de escribir» del Automations: la guía de voz escrita (la misma lectura estricta que usa la tab).
      const { hayVozGuiaEstricto } = await import('./nutricion-generator');
      return (await hayVozGuiaEstricto())
        ? { cumplido: true, que: 'la guía de voz está escrita' }
        : { cumplido: false, falta: 'la guía de voz no está escrita (se arma en Automations, al prender «Lo adapta MaKo»).' };
    }
    case 'carousels_contexto':
    case 'stories_contexto':
      // «Contexto del negocio»: el wizard muestra lo que MaKo sabe del negocio. Sin perfil no hay nada que dar por visto.
      return negocioCargado();
    default:
      return { sinDato: 'no es un paso que se pueda comprobar desde aquí.' };
  }
}
