// =============================================================================
// /vsl/closing — Closing, el análisis de tus llamadas de venta, con la ESTRUCTURA y el DISEÑO de la página de AI Call Scoring de Hyperbound
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el diseño):
//   https://www.hyperbound.ai/uses/ai-call-scoring  (leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/closing.tsx, con los valores medidos de la referencia en su cabecera.
// Su orden, que se respeta aquí: el titular en mayúsculas de máquina de escribir, su bajada y el botón → su muro de logos de clientes
// → «Manual call review doesn't scale or improve outcomes» (tres problemas) → «AI call scoring software that closes the loop» (cinco
// filas: texto con su cejilla, su párrafo y tres tildes, y una captura de su producto, alternadas) → sus preguntas → «See AI call
// scoring in action» y sus dos botones → su pie.
//
// POR QUÉ ÉSTA. docs/competencia/landings-por-funcion.md dejó Closing «sin ganadora» el 11/11/2026 (Voicit resultó un generador de
// actas; Fathom, Gong y Hyperbound no abrían desde la nube). Desde la PC abren. La página de Hyperbound es la landing de ESTA función:
// puntuar cada llamada real con una metodología (SPIN entre ellas), el coaching después de cada llamada, lo que se juega antes de la
// próxima, el cruce con los cierres y la conexión con el grabador que ya usas. Las otras: Gong vende una plataforma entera; Fathom es un
// tomador de notas y MaKo se CONECTA con él (no lo reemplaza: app/vsl/_sitio/reemplaza.ts); CloserMood (la que Martín pasó el 28/10)
// es un simulador para practicar llamadas, no el análisis de las de verdad.
//
// Lo que se cambió de la referencia, y por qué:
//   · Su muro de logos de clientes no va (MaKo no inventa clientes): en ese lugar, con su misma grilla, lo que trae cada llamada
//     analizada, contado del código (las 7 dimensiones del análisis y las partes de la ficha de la llamada), como hizo Dashboard con
//     los tableros donde Reportei ponía sus clientes. Su sello de G2 tampoco va.
//   · Sus capturas son de su producto. ⚠️ LO QUE ESCRIBE EL ANÁLISIS NO SE INVENTA (Martín, 12/11 y 13/11/2026: una pantalla se puede
//     montar con su componente real y datos de ejemplo, pero lo que escribió la IA —un puntaje con sus notas y citas, el coaching, las
//     objeciones— tiene que ser algo que MaKo hizo de verdad). Las tres primeras filas mostraban una llamada INVENTADA (la de «Paola
//     Núñez con la closer Ana», un 7.1 con notas, citas, objeciones y coaching que MaKo nunca escribió): van con el recuadro de
//     «falta» (FALTA_ANALISIS, ./FaltaAnimacion.tsx) hasta que haya un análisis REAL del Closing Analyst sobre una llamada de prueba
//     grabada con la Grabadora en el espacio de prueba (docs/relevo/landings-vsl.md). Medido el 16/11/2026 en producción, sólo
//     lectura: el espacio de prueba (ws 3) no tiene ningún análisis, y los del espacio de MaKo (ws 9) son llamadas de venta con
//     prospectos reales, que no se usan. Las fotos descartadas: C:/dev/bancos-portada/banco-closing-landing/descartadas/.
//     La hoja Closing del Dashboard SÍ queda (la fila de los cierres): son números y nombres ficticios de los datos de ejemplo de la
//     hoja (los mismos de su miniatura de «Nueva hoja»), sin una palabra escrita por la IA.
//   · Su tercera fila (practicar con roleplays de IA) MaKo no la tiene: en su lugar, lo que se juega antes de la próxima llamada en MaKo
//     (cada objeción, respondida o no, y el seguimiento por WhatsApp escrito con tu voz: lib/post-llamada.ts).
//   · Sus cifras («100% of calls», «2M+ real sales calls», «fewer than 10%») son suyas: no se dicen.
//   · Su «Book a demo» y su «Try free demo» son el botón de MaKo (./cta.ts); MaKo no tiene una demo: va un solo botón. Y su «See AI
//     call scoring in action» no se traduce: el botón lleva a empezar con un plan, no a ver una demo, y el título dice eso
//     (TITULO_CIERRE_CLOSING).
//   · Su pie es el del sitio (PieGlobal); su barra, la del sitio (BarraGlobal), como en todas las landings.
// Lo que NO se promete: «las dos reuniones» (R1 y R2 salieron de los funnels el 16/11/2026: el análisis las sigue distinguiendo por dentro
// y la landing no las nombra), que MaKo traduzca la transcripción (el ANÁLISIS sale en español, SYSTEM_ANALISIS de lib/closing.ts: «Todo
// en español neutro»; las citas quedan en el idioma de la llamada), ni que mande el seguimiento solo (queda de borrador y lo mandas tú).
// =============================================================================

import { CATALOGO_GRABADORES } from '@/lib/grabadores/catalogo';
import { GRUPOS_DIM } from '@/lib/llamadas-modelo';
import { TABS_SOLO_PRO } from '@/lib/topes-plan';
import type { LandingCompetencia } from './tipos';

/** El análisis de llamadas es SÓLO de MaKo Pro (lib/closing-solo-pro.ts: el candado de la hoja Closing; la fila de /planes «Análisis de
 *  tus llamadas de venta con IA»). Sale del plan, no se escribe: si Closing se abre en Essential, el aviso se va solo. No es una
 *  `FuncionSoloPro` (es una tab), por eso no usa ./solo-pro.ts. */
export const AVISO_PRO_CLOSING = (TABS_SOLO_PRO as readonly string[]).includes('closing-analyst') ? ' Con MaKo Pro.' : '';

/** El mismo aviso entre paréntesis, pegado a la promesa en medio de una frase (el molde de `soloProEntre`, ./solo-pro.ts): lo usan los
 *  pasos de los funnels (app/vsl/_sitio/funnels-datos.ts), donde «MaKo te dice qué mejorar» va junto a lo que sigue abierto. */
export const AVISO_PRO_CLOSING_ENTRE = AVISO_PRO_CLOSING ? ' (Con MaKo Pro)' : '';

/** El título del cierre, arriba del botón: donde Hyperbound dice «See AI call scoring in action» (su demo), MaKo dice lo que hace el
 *  botón, que es empezar con un plan; y con qué plan, mientras el análisis sea de Pro. */
export const TITULO_CIERRE_CLOSING = `Empieza a analizar tus llamadas de venta${AVISO_PRO_CLOSING ? ' con MaKo Pro' : ''}`;

/** Las 7 dimensiones que puntúa el análisis, con su grupo (SYSTEM_ANALISIS y DIM_CANON de lib/closing.ts, que lleva `server-only`: el
 *  test las busca en ese archivo). */
export const DIMENSIONES_CLOSING: readonly { label: string; grupo: 'spin' | 'exec' }[] = [
  { label: 'Situación', grupo: 'spin' }, { label: 'Problema', grupo: 'spin' }, { label: 'Implicación', grupo: 'spin' },
  { label: 'Necesidad / beneficio', grupo: 'spin' }, { label: 'Presentación de la propuesta', grupo: 'exec' },
  { label: 'Manejo de objeciones', grupo: 'exec' }, { label: 'CTA / siguientes pasos', grupo: 'exec' },
];

/** Las partes de la ficha de una llamada, con los rótulos de la app (app/dashboard/entidades/llamada.tsx): el test los busca ahí. */
export const PARTES_FICHA: readonly string[] = ['Resumen del análisis', 'Próximo paso', 'Fortalezas', 'A mejorar', 'Objeciones', 'Coaching', 'Momentos', 'Transcript'];

/** Los rótulos que la app escribe en inglés (la pestaña «Transcript» de la ficha): en la landing van entre comillas, como el NOMBRE
 *  de la pestaña tal cual se ve, no como una palabra de la prosa. */
const EN_INGLES: ReadonlySet<string> = new Set(['Transcript']);
/** Cómo se lee una parte de la ficha en el muro de la landing. */
export const parteEnLaLanding = (p: string): string => (EN_INGLES.has(p) ? `«${p}»` : p);

/**
 * LO QUE ESCRIBE EL ANÁLISIS, mientras no haya uno REAL para mostrar: lo que dice el recuadro de «falta» (./FaltaAnimacion.tsx) en las
 * tres primeras filas de la landing, en la fila de la portada y en la del coaching de /vsl/equipo. Se reemplaza con un análisis real del
 * Closing Analyst sobre una llamada de prueba grabada con la Grabadora en el espacio de prueba (docs/relevo/landings-vsl.md).
 */
export const FALTA_ANALISIS = {
  puntaje: 'Una llamada de prueba analizada de verdad por MaKo: su puntaje de 0 a 10 y sus siete notas, cada una con su frase y su minuto.',
  coaching: 'Lo que hizo bien el closer, lo que tiene que mejorar y el coaching que MaKo escribió después de una llamada de prueba real.',
  objeciones: 'Las objeciones de una llamada de prueba real, respondidas o no, y el próximo paso que dejó MaKo.',
  portada: 'Una llamada de prueba analizada de verdad por MaKo: el puntaje con el método SPIN, sus objeciones y el coaching.',
} as const;

/** Los grabadores que se conectan HOY (lib/grabadores/catalogo.ts): si se suma uno, la landing lo dice sola. */
export const GRABADORES_CLOSING: readonly string[] = Object.values(CATALOGO_GRABADORES).filter((g) => g.conectable).map((g) => g.nombre);

const listaY = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? '');
const grupo = (g: 'spin' | 'exec') => GRUPOS_DIM.find((x) => x.key === g)?.label ?? '';

const I = {
  // «phone-call» de Tabler (MIT), como los demás íconos de las landings.
  llamada: ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2', 'M15 7a2 2 0 0 1 2 2', 'M15 3a6 6 0 0 1 6 6'],
};

export const LANDING_CLOSING: LandingCompetencia = {
  slug: 'closing',
  nombre: 'Closing · análisis de llamadas',
  icono: I.llamada,
  referencia: { nombre: 'Hyperbound · AI Call Scoring', url: 'https://www.hyperbound.ai/uses/ai-call-scoring', leida: '16/11/2026' },
  bloques: [
    {
      tipo: 'hero',
      // Su hero no tiene cejilla ni imagen: el diseño copiado dibuja el titular, la bajada y el botón.
      etiqueta: 'Closing',
      // «AI Call Scoring Software That Ties Training to Revenue»: con su largo (54 letras, dos renglones a 1440 y cuatro a 390).
      titulo: 'Análisis de llamadas con IA: por qué cierras y por qué no',
      // «…scores 100% of real sales calls against custom methodology scorecards, surfaces specific skill gaps, and connects them
      // directly to deal outcomes. Stop guessing what's hurting your win rate.» Sin su «100%».
      bajada: `Cada llamada de venta, transcrita y analizada: MaKo la puntúa con el método SPIN, marca cada objeción y te dice qué decide tus cierres, en español aunque la llamada sea en otro idioma. Deja de adivinar qué te está costando ventas.${AVISO_PRO_CLOSING}`,
      visual: { tipo: 'detalle', slug: 'closing' },
    },
    {
      // Donde va su muro de logos: lo que trae cada llamada analizada (el título no se ve, como su muro, que no lleva).
      tipo: 'tarjetas',
      titulo: 'Lo que trae cada llamada analizada',
      items: [
        ...DIMENSIONES_CLOSING.map((d) => ({ titulo: d.label, texto: grupo(d.grupo) })),
        { titulo: 'Puntaje de 0 a 10', texto: 'La llamada' },
        ...PARTES_FICHA.map((p) => ({ titulo: parteEnLaLanding(p), texto: 'La llamada' })),
      ],
    },
    {
      // «Manual call review doesn't scale or improve outcomes»: sus tres problemas, sin sus cifras.
      tipo: 'tarjetas',
      titulo: 'Escuchar llamadas a mano no escala ni mejora tus cierres',
      items: [
        { titulo: 'Escuchar una grabación entera lleva lo mismo que la llamada: terminas escuchando pocas, y lo que falla en las demás se repite sin que lo veas.', texto: '' },
        { titulo: 'Una transcripción y un resumen no te dicen por qué ese lead no cerró ni qué corregir en la próxima llamada.', texto: '' },
        { titulo: 'Las objeciones que quedaron sin responder se pierden en la grabación, y el seguimiento sale tarde o no sale.', texto: '' },
      ],
    },
    {
      // «AI call scoring software that closes the loop»: sus cinco filas. `meta` es su cejilla y `puntos`, sus tres tildes.
      tipo: 'tarjetas',
      titulo: 'De cada llamada a tu próximo cierre',
      items: [
        {
          meta: 'Todas tus llamadas de venta',
          titulo: 'Cada llamada, puntuada sola',
          texto: 'MaKo puntúa de 0 a 10 cada llamada de venta con el método SPIN (situación, problema, implicación y necesidad) y con tu ejecución (la propuesta, las objeciones y el cierre). Cada nota trae la frase de la llamada y su minuto. Las reuniones internas y las de entrega las separa sola.',
          puntos: [`Las ${DIMENSIONES_CLOSING.length} dimensiones, de 0 a 10`, 'Cada nota, con su cita y su minuto', 'En español, aunque la llamada sea en otro idioma'],
        },
        {
          meta: 'Coaching después de cada llamada',
          titulo: 'Lo que hiciste bien y lo que hay que corregir',
          texto: 'Después de cada llamada, MaKo te deja las fortalezas y lo que hay que mejorar, cada una con la frase que lo prueba, y de 3 a 5 recomendaciones de coaching para la próxima. Sabes qué pasó sin escucharla entera.',
          puntos: ['Fortalezas y puntos a mejorar, con su cita', 'De 3 a 5 recomendaciones de coaching', 'El resumen y el próximo paso con ese lead'],
        },
        {
          meta: 'Antes de la próxima llamada',
          titulo: 'Cada objeción, respondida o no',
          texto: 'MaKo marca cada objeción que puso el lead, con su frase y su minuto, y si la respondiste. Al terminar la llamada te deja escrito el mensaje de seguimiento por WhatsApp, con tu voz: lo revisas y lo mandas con un clic.',
          puntos: ['Cada objeción, con su cita y su minuto', 'Respondida o sin responder', 'El seguimiento por WhatsApp, listo para mandar'],
        },
        {
          meta: 'Tus cierres, medidos',
          titulo: 'Qué decide tus cierres y quién cierra mejor',
          texto: 'La hoja Closing del Dashboard junta todas tus llamadas: tu tasa de cierre y tu score promedio, cómo terminaron, qué hacen distinto las llamadas ganadas y la tasa de cierre de cada closer.',
          puntos: ['Tasa de cierre y score promedio', 'Lo que hacen distinto las llamadas ganadas', 'La tasa de cierre de cada closer'],
        },
        {
          meta: 'Sin cambiar cómo grabas',
          titulo: 'Se conecta con el grabador que ya usas',
          texto: `${listaY(GRABADORES_CLOSING)}: tus llamadas entran solas. Si no usas ninguno, grabas desde la ficha del lead con la grabadora de MaKo. El análisis queda en la ficha de ese lead, en tu CRM.`,
          puntos: [GRABADORES_CLOSING.join(', '), 'La grabadora de MaKo, en la ficha del lead', 'El análisis, en la ficha del lead del CRM'],
        },
      ],
    },
    // Las de la portada (las pone el registro y LandingCompetencia).
    { tipo: 'preguntas', titulo: 'Preguntas frecuentes', items: [] },
  ],
  metaTitle: 'Closing de MaKo: el análisis de tus llamadas de venta con IA y el método SPIN',
  metaDesc: `MaKo puntúa cada llamada de venta con el método SPIN, marca cada objeción, te deja el coaching y el seguimiento por WhatsApp, y te dice qué decide tus cierres. Se conecta con ${listaY(GRABADORES_CLOSING)}.${AVISO_PRO_CLOSING}`,
};
