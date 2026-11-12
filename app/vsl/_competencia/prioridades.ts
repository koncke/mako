// =============================================================================
// /vsl/prioridades — el Plan (las prioridades, con el Perro Guardián), con la ESTRUCTURA de la portada de Motion (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones y el storytelling; la cara es la de /vsl):
//   https://www.usemotion.com/  (leída el 11/11/2026 con Chromium)
// Su orden, que se respeta acá: (navegación) → hero «Get an unfair advantage by using AI to double productivity» → (confianza y
// cuatro citas) → «Stop using tech from the pre-AI era» → «AI Task Planner» → «AI Project Manager» → «AI Meeting Notetaker» →
// «AI Docs Assistant» → (AI Calendar Assistant) → (AI Workflows Builder) → «AI Business Intelligence» → reseñas → «Why Motion's
// all-in-one platform is better than using 10 separate tools» → integraciones (y seguridad) → cierre (la banda de la llamada
// de /vsl). Por qué ganó: docs/competencia/landings-por-funcion.md → «Plan (prioridades)».
//
// Lo que se cambió de la referencia, y por qué:
//   · La navegación es la cabecera de /vsl. Su «Over 1 million top performers», sus cuatro citas con ahorros en dinero y sus
//     reseñas de G2 son de uso o de antes y después: no van. La prueba es el caso de Mauricio, en el lugar de sus reseñas.
//   · Su «AI Calendar Assistant» arma tu día hora por hora en el calendario: MaKo NO lo hace, así que esa sección no va (lo
//     único cierto, que las fechas del Plan se ven en Calendar, va en «todo en uno»). Su «AI Workflows Builder» (de un SOP a un
//     flujo) no tiene equivalente en el Plan: tampoco va. Su «Do Date ≠ Due Date» y su ETA de cada proyecto, igual.
//   · Su «AI Business Intelligence» es, en MaKo, la hoja Productividad del Dashboard (lib/graficos-plantillas-analysts.ts).
//   · Su «10x cheaper», sus modelos «fully covered» y su SOC 2 no son de MaKo: no se dicen.
// Lo que hace hoy, de lib/funciones-mako.ts (keys: ['todo']) y del código: «Re-priorizar todo» (lib/plan-repriorizar.ts: el
// puntaje, la razón, la fase y los objetivos, lo fijado a mano), la vista Prioridades (app/plan/board/prioridades.ts), las
// columnas (lib/todo-estados.ts), las reuniones (lib/reunion-auto.ts, lib/grabadores/catalogo.ts), los archivos
// (app/plan/board/ImportarModal.tsx), el dictado (app/plan/board/dictado-vivo.ts), las fechas en Calendar (lib/calendario.ts)
// y la API para tu Claude (app/api/agente/plan). Nada de un calendario hora por hora ni de dependencias (son del tablero del dueño).
// =============================================================================

import { MAX_PRIORIDAD } from '@/app/plan/board/types';
import { ESTADOS } from '@/lib/todo-estados';
import { listaDeGrabadores } from '@/lib/grabadores/catalogo';
import type { LandingCompetencia } from './tipos';

const I = {
  plan: ['M3.5 5.5l1.5 1.5l2.5 -2.5', 'M3.5 11.5l1.5 1.5l2.5 -2.5', 'M3.5 17.5l1.5 1.5l2.5 -2.5', 'M11 6l9 0', 'M11 12l9 0', 'M11 18l9 0'],
  tablero: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v6h-4z'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  repite: ['M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4', 'M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4'],
  subir: ['M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2', 'M7 9l5 -5l5 5', 'M12 4l0 12'],
  chat: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  microfono: ['M9 5a3 3 0 0 1 6 0v5a3 3 0 0 1 -6 0z', 'M5 10a7 7 0 0 0 14 0', 'M8 21l8 0', 'M12 17l0 4'],
  avance: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
  quieta: ['M6.5 7h11', 'M6.5 17h11', 'M6 20v-2a6 6 0 1 1 12 0v2a1 1 0 0 1 -1 1h-10a1 1 0 0 1 -1 -1z', 'M6 4v2a6 6 0 1 0 12 0v-2a1 1 0 0 0 -1 -1h-10a1 1 0 0 0 -1 1z'],
  aTiempo: ['M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M9 12l2 2l4 -4'],
  todo: ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
  foco: ['M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M12 12m-5 0a5 5 0 1 0 10 0a5 5 0 1 0 -10 0', 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0'],
  agenda: ['M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2v-12z', 'M16 3v4', 'M8 3v4', 'M4 11h16'],
  telefono: ['M7 6a2 2 0 0 1 2 -2h6a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-6a2 2 0 0 1 -2 -2z', 'M11 17h2'],
};

// Las columnas del tablero, como las dice la pantalla (sin «No cumplen tu criterio», que sólo aparece si hay algo ahí).
const COLUMNAS = ESTADOS.filter((e) => e.key !== 'no_cumple').map((e) => e.label);
const COLUMNAS_TXT = `${COLUMNAS.slice(0, -1).join(', ')} y ${COLUMNAS.at(-1)}`;
const HECHA = ESTADOS.find((e) => e.key === 'hecho')?.label ?? 'Completada';
// Los grabadores que se conectan hoy, del catálogo: «Fathom, tl;dv, Fireflies.ai, Zoom y Otter.ai».
const GRABADORES_TXT = listaDeGrabadores(true);

export const LANDING_PRIORIDADES: LandingCompetencia = {
  slug: 'prioridades',
  nombre: 'Plan',
  icono: I.plan,
  referencia: { nombre: 'Motion — portada', url: 'https://www.usemotion.com/', leida: '2026-11-11' },
  metaTitle: 'Plan de MaKo: tus tareas, ordenadas por lo que mueve tu negocio',
  metaDesc: `MaKo saca las tareas de tus reuniones grabadas, le pone a cada una un puntaje de 1 a 100 con su razón y te muestra las ${MAX_PRIORIDAD} que van primero, en un tablero por estado.`,
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Tu plan de trabajo, priorizado con IA',
      titulo: 'Deja que MaKo ordene tu plan. Tú haz primero lo que importa.',
      bajada: `MaKo saca las tareas de tus reuniones grabadas y, con un toque, le pone a cada una un puntaje de 1 a 100 con su razón. Después te deja <strong>las ${MAX_PRIORIDAD} que van primero</strong>.`,
      puntos: ['Prioridades, Tareas, Proyectos y Recurrentes, en un tablero', 'La prioridad la pone MaKo; la cambias a mano cuando quieras'],
      visual: { tipo: 'detalle', slug: 'prioridades' },
    },
    {
      tipo: 'contraste',
      etiqueta: 'Deja la lista de pendientes de siempre',
      titulo: 'Tu lista de pendientes no sabe qué va primero',
      sin: {
        titulo: 'La lista de siempre',
        texto: 'Listas que no se terminan, fechas que se pasan y lo que se acordó en una reunión, perdido en tus notas. <strong>Todo parece urgente</strong> y terminas eligiendo lo fácil.',
      },
      con: {
        titulo: 'El Plan de MaKo',
        texto: 'Las tareas salen de tus reuniones, MaKo le pone a cada una su puntaje y su razón, y la vista Prioridades te deja sólo lo que va primero.',
      },
    },
    {
      tipo: 'filas',
      titulo: 'MaKo prioriza tus tareas por ti',
      slug: 'prioridades',
      items: [
        {
          grafico: 0,
          titulo: 'Un puntaje de 1 a 100 para cada tarea',
          texto: 'Con «Re-priorizar todo», MaKo puntúa cada tarea contra el resto de tu tablero y te deja la razón. <strong>Corre en segundo plano</strong>: sigues trabajando mientras tanto.',
          puntos: ['A la tarea que no tiene proyecto, le busca uno de los tuyos'],
        },
        { grafico: 2, titulo: `Las ${MAX_PRIORIDAD} que van primero`, texto: 'La vista Prioridades te muestra tu objetivo principal —el proyecto que más pesa y todavía tiene trabajo— y las tareas que hay que hacer ahora. Lo que se repite no les quita lugar.' },
        { grafico: 4, titulo: 'La cambias a mano cuando quieras', texto: 'Le pones el número que quieras desde la tarjeta. <strong>Una prioridad que fijas tú, MaKo no la vuelve a tocar</strong>, hasta que se la devuelvas.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Cada tarea en su proyecto, y cada proyecto a la vista',
      items: [
        { icono: I.tablero, titulo: 'Un tablero por estado', texto: `${COLUMNAS_TXT}. Una tarea que llega al 100 % pasa sola a ${HECHA}.` },
        { icono: I.persona, titulo: 'Por proyecto y por responsable', texto: 'Filtras por proyecto o por quién lo tiene que hacer: lo tuyo, lo de un cliente o lo de un tercero.' },
        { icono: I.repite, titulo: 'Lo que se repite, aparte', texto: 'La junta de los lunes va en Recurrentes: no compite con lo que tiene que terminar.' },
      ],
    },
    {
      tipo: 'pasos',
      titulo: 'Las tareas salen solas de tus reuniones',
      bajada: `Conectas tu grabador —${GRABADORES_TXT}— y MaKo lee cada reunión de tu equipo y con tus clientes.`,
      pasos: [
        { titulo: 'Termina tu reunión', texto: 'La grabación cae en tu grabador y MaKo la lee sola: no tienes que apretar nada.' },
        { titulo: 'Saca los compromisos', texto: 'Separa lo tuyo de lo que le toca a otra persona y marca lo que ya está en tu plan, para no duplicar.' },
        { titulo: 'Confirmas y entran', texto: 'Te avisa por WhatsApp y te deja un borrador. <strong>Nada entra al tablero hasta que lo confirmas.</strong>' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'De tus notas a tareas, sin pasarlas a mano',
      items: [
        { icono: I.subir, titulo: 'Subes tus archivos', texto: 'Notas, un PDF, un Word, una planilla, una foto o un audio: MaKo saca las tareas y las revisas antes de que entren.' },
        { icono: I.chat, titulo: 'Se lo dices a MaKo', texto: 'En el chat o en tu grupo de WhatsApp: «anota que…», y te deja un borrador para confirmar.' },
        { icono: I.microfono, titulo: 'Lo dictas', texto: 'Al crear una tarea la dictas, y el texto aparece mientras hablas.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Sabes cómo va cada proyecto',
      bajada: 'En la hoja Productividad del Dashboard, armada con tu tablero.',
      items: [
        { icono: I.avance, titulo: 'El avance de cada proyecto', texto: 'Cuánto lleva cada proyecto y todo tu tablero, en una pantalla.' },
        { icono: I.quieta, titulo: 'Lo que se estancó', texto: 'Las tareas que nadie mueve hace días, y las de prioridad alta que no tienen fecha.' },
        { icono: I.aTiempo, titulo: 'Lo que terminaste a tiempo', texto: 'De lo que tenía fecha, cuánto cerraste antes de que venciera.' },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Por qué tu plan vive adentro de MaKo',
      columnas: 2,
      items: [
        { icono: I.todo, titulo: 'Todo en un lugar', texto: 'Las tareas llegan de tus reuniones, de tu chat y de tu WhatsApp, sin copiar nada de una app a otra.' },
        { icono: I.foco, titulo: 'Con el contexto de tu negocio', texto: 'MaKo prioriza mirando la fase de tu negocio y tus objetivos, <strong>no sólo la lista</strong>.' },
        { icono: I.agenda, titulo: 'Tus fechas, en tu calendario', texto: 'Las tareas y los proyectos con fecha aparecen en Calendar, y desde ahí abres la tarjeta.' },
        { icono: I.telefono, titulo: 'También en el teléfono', texto: 'Las mismas cuatro vistas en la app del teléfono, para ver qué sigue desde donde estés.' },
      ],
    },
    {
      tipo: 'logos',
      titulo: 'Las tareas de tu plan llegan de',
      items: [
        { logo: 'llamada.svg', nombre: 'Tus reuniones grabadas' },
        { logo: 'whatsapp.png', nombre: 'Tu grupo de MaKo en WhatsApp' },
        { logo: 'claude.png', nombre: 'Tu Claude' },
      ],
    },
  ],
};
