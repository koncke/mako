// =============================================================================
// /vsl/calendario — el Calendario de contenido de MaKo (Calendar y el «Esta semana» del Marketing CoPilot), con la ESTRUCTURA y el
// DISEÑO de la página del planificador de Metricool
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el diseño):
//   https://metricool.com/es/planificador/  (leída el 16/11/2026 con el navegador del panel, a 1440 y a 390 px)
// El diseño copiado vive en ./disenos/calendario.tsx, con los valores medidos de la referencia en su cabecera.
// Su orden, que se respeta aquí: el titular enorme y centrado, su bajada, el botón y su renglón chico, la captura grande del planificador
// con una publicación flotando encima y «Publica sin límites en todas tus redes…» con su tira de logos → «Posts, stories, reels…
// demasiadas tareas. Pero… La clave no es trabajar más, sino planificar mejor», con su dibujo al costado → su muro de logos de clientes
// («Ellos ya programan con Metricool») → «Más que un calendario», con sus tres pestañas de funciones → «Planifica sin caos, publica sin
// estrés» (01 a 05: lo demás de su suite) → sus testimonios.
//
// POR QUÉ ÉSTA. Calendario de contenido no tenía ganadora en docs/competencia/landings-por-funcion.md. Metricool es el planificador de
// redes más usado en español (España y LATAM) y ésta es la landing de ESTA función: planificar la semana, programar cada formato en cada
// red y que salga a su hora. Las otras: Later y Buffer (en inglés, para equipos de redes de marcas) y Canva (su calendario es una pieza
// de su editor, no la página de la función).
//
// Lo que se cambió de la referencia, y por qué:
//   · Su captura y su publicación flotante son pantallas REALES de MaKo: la vista Semana del Calendario (app/calendario/CalendarioApp.tsx)
//     y el modal de una publicación con «Publicar en la red» (PublicarEnRed), con UNA semana de ejemplo de nombres ficticios (banco
//     C:/dev/bancos-portada/banco-calendario-landing, fotos.mjs). Su dibujo de «planificar mejor» es «Esta semana» del Marketing CoPilot,
//     y sus tareas salen de tareasDeLaSemana (lib/media-buyer/copiloto.ts) para un funnel orgánico: no se escriben a mano.
//   · Su tira de logos son las redes donde el Calendario publica HOY (REDES_PUBLICAR, lib/calendario-publicar-reglas.ts), con los logos
//     de la app (SvcIcon de app/_components/ServicioVisual.tsx). Su «sin límites» no se dice: no se midió un tope.
//   · Publicar pide CONECTAR cada red, una vez, con la clave del propio negocio y sin respaldo de la plataforma (lib/zernio-conectar.ts):
//     donde la landing promete que algo sale solo, dice «Conectas tus redes una vez» (la bajada, la tira, «En tus redes» y el texto de
//     Google), sin nombrar al proveedor.
//   · Su muro de clientes («Más de 4 millones…») no va: MaKo no inventa clientes. Sus testimonios son el caso de Mauricio.
//   · Sus funciones que MaKo no tiene (hashtags, Adobe Express, el feed previo, el primer comentario, UTMs, CSV, aprobaciones) no van: en sus
//     tres pestañas van las del Calendario que sí existen, cada una del código.
//   · Su 01-05 (analítica, competidores, bandeja, anuncios y su app) son las funciones de MaKo que hacen eso, cada una con su landing.
//   · Su «piloto automático» no se dice (es el piloto de Instagram y YouTube, de Pro, que se vende en /vsl/ads); su «Gratis para toda la
//     vida» es el renglón del cierre de MaKo (TEXTO_CIERRE). Su botón es el de MaKo (./cta.ts); su barra y su pie, los del sitio.
// =============================================================================

import { REDES_PUBLICAR, ROTULO_RED, formatosDeRed } from '@/lib/calendario-publicar-reglas';
import { ROTULO_FORMATO, type FormatoPublicacion } from '@/lib/calendario-modelo';
import { tareasDeLaSemana, type PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import type { LandingCompetencia } from './tipos';

const listaY = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? '');

/** Las redes donde el Calendario publica hoy, con su nombre (Instagram, Facebook, TikTok, YouTube, LinkedIn, X, Threads, Google Business). */
export const REDES_CALENDARIO: readonly string[] = REDES_PUBLICAR.map((r) => ROTULO_RED[r]);

/** Cómo se dice cada formato en plural (lo que no está acá va con su rótulo de la app, ROTULO_FORMATO). */
const PLURAL: Partial<Record<FormatoPublicacion, string>> = { reel: 'reels', story: 'stories', post: 'posts', video: 'videos' };
const ORDEN: readonly FormatoPublicacion[] = ['reel', 'story', 'post', 'video'];
/** Los formatos que se publican, sin repetir y en plural (reels, stories, posts y videos), contados de lo que acepta cada red. */
export const FORMATOS_CALENDARIO: readonly string[] = [...new Set(REDES_PUBLICAR.flatMap((r) => formatosDeRed(r)))]
  .sort((a, b) => (ORDEN.indexOf(a) + 99) % 99 - (ORDEN.indexOf(b) + 99) % 99)
  .map((f) => PLURAL[f] ?? ROTULO_FORMATO[f].toLowerCase());

/** El funnel orgánico de cuatro piezas por semana del ejemplo (el mismo del banco): «Esta semana» sale de él. */
export const PERFIL_EJEMPLO: PerfilCopiloto = { entrada: 'funnel', funnel: 'organico', objetivo: 'mixto', ritmo: 4, aceptado: true };
/** Lo que el Marketing CoPilot pone en «Esta semana» para ese funnel: cada tarea con su botón a la pantalla donde se hace. */
export const SEMANA_EJEMPLO = tareasDeLaSemana(PERFIL_EJEMPLO);

const minus = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const I = {
  // «calendar-check» de Tabler (MIT), como los demás íconos de las landings.
  calendario: ['M11.5 21h-5.5a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6', 'M16 3v4', 'M8 3v4', 'M4 11h16', 'M15 19l2 2l4 -4'],
};

export const LANDING_CALENDARIO: LandingCompetencia = {
  slug: 'calendario',
  nombre: 'Calendario de contenido',
  icono: I.calendario,
  referencia: { nombre: 'Metricool · Planificador', url: 'https://metricool.com/es/planificador/', leida: '16/11/2026' },
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Calendario de contenido',
      // «El planificador inteligente que pone tus redes en piloto automático»: con su largo, sin su «piloto automático».
      titulo: 'El calendario que publica tu semana de contenido',
      // «Convierte la gestión de tus redes en un proceso fluido, eficiente y sin esfuerzo.»
      bajada: 'Conectas tus redes una vez. Después planificas la semana, la programas entera y cada publicación sale sola, a su hora.',
      // «Publica sin límites en todas tus redes: stories, reels, vídeos, carruseles y más», sobre la tira de logos.
      puntos: [`Con tus cuentas conectadas, publica en ${listaY(REDES_CALENDARIO)}: ${listaY(FORMATOS_CALENDARIO)}.`],
      visual: { tipo: 'detalle', slug: 'calendario' },
    },
    {
      // «Posts, stories, reels, vídeos, carruseles… Son demasiados formatos, demasiadas redes y demasiadas tareas. Pero… La clave no es
      // trabajar más, sino planificar mejor». `sin` es su renglón; el titular, su frase grande; `con`, lo que dice el dibujo de al lado
      // («Esta semana» del Marketing CoPilot).
      tipo: 'contraste',
      titulo: 'La clave no es publicar más, sino planificar mejor',
      sin: { titulo: 'Reels, carruseles, stories, videos…', texto: 'Son demasiados formatos, demasiadas redes y demasiadas cosas para hacer el mismo día. Pero…' },
      con: { titulo: 'Esta semana', texto: `El Marketing CoPilot te dice qué publicar esta semana: ${listaY(SEMANA_EJEMPLO.slice(0, -1).map((t) => minus(t.titulo)))}, y dónde se hace cada uno.` },
    },
    {
      // «Más que un calendario» y sus tres pestañas («Crea más rápido», «Consigue mayor alcance», «Agiliza procesos»): cada pestaña es un
      // item y sus funciones, `puntos` («TÍTULO|texto»).
      tipo: 'tarjetas',
      titulo: 'Más que un calendario',
      bajada: 'El Calendario de MaKo planifica, programa y publica tu contenido, junto con tus llamadas, tus entregas y tu Plan.',
      items: [
        {
          titulo: 'Crea más rápido', texto: '',
          puntos: [
            'Qué publicar esta semana|El Marketing CoPilot te arma la semana y te lleva a la pantalla donde se hace cada pieza.',
            'De Create al Calendario|Desde el editor de video, el de imágenes o Copywriting, «Publicar» la manda al Calendario.',
            // Lo que la API de MaKo deja hacer en el Calendario (lib/api-mako/areas/calendario.def.ts): agendar un evento
            // (`crear_evento_calendario`) y programar las publicaciones (`programar_publicacion`). Mover uno, no: no hay operación.
            'Pídeselo a MaKo|Con la estrella de MaKo le pides que agende algo en tu Calendario o que programe tus publicaciones.',
          ],
        },
        {
          titulo: 'Llega a más gente', texto: '',
          puntos: [
            `En tus redes|Conectas una vez tus cuentas de ${listaY(REDES_CALENDARIO)}.`,
            `Cada formato|${mayus(listaY(FORMATOS_CALENDARIO))}, según lo que publica cada red.`,
            'A su hora|Eliges el día y la hora: lo programado sale aunque tengas un mal día.',
          ],
        },
        {
          titulo: 'Ahorra tiempo', texto: '',
          puntos: [
            'Programar en serie|Las publicaciones listas de la semana se programan de una vez.',
            'Se repite sola|Una publicación que se repite cada día, cada semana o cada mes nace y se programa sola.',
            'Todo en una semana|Publicaciones, deadlines del Plan, llamadas de venta y entregas, cada uno con su color.',
            'Tu Google Calendar, adentro|Si lo conectas, ves tus eventos de Google junto a lo de MaKo, y lo que cambias se guarda en Google.',
            'Arrastra para mover|Una publicación cambia de día o de hora arrastrándola.',
          ],
        },
      ],
    },
    {
      // «Planifica sin caos, publica sin estrés»: su 01-05 (lo demás de su suite) son las funciones de MaKo que hacen eso.
      tipo: 'pasos',
      titulo: 'Tu semana, sin caos y sin estrés',
      bajada: 'El Calendario va más allá de programar: lo que publicas se mide, se compara y se contesta desde la misma app.',
      pasos: [
        { titulo: 'Mira cómo rinde tu Instagram en su hoja del <a href="/vsl/dashboard">Dashboard</a>.', texto: '' },
        { titulo: 'Mira qué publica tu competencia con <a href="/vsl/competitor-spy">Competitor Spy</a>.', texto: '' },
        { titulo: 'Contesta tus mensajes de WhatsApp, Instagram y Messenger desde <a href="/vsl/whatsapp">Chats</a>.', texto: '' },
        { titulo: 'Arma y mide tus anuncios de Meta con el <a href="/vsl/ads">Marketing CoPilot</a>.', texto: '' },
        { titulo: 'Todo esto desde tu computadora o <a href="/app">la app de tu teléfono</a>.', texto: '' },
      ],
    },
    // Sus testimonios («Un oasis en medio del tsunami digital»): el caso de Mauricio.
    { tipo: 'caso' },
  ],
  metaTitle: 'Calendario de contenido de MaKo: planifica tu semana y publica a su hora',
  metaDesc: `Conectas tus redes y el Calendario de MaKo programa tus reels, stories, videos y posts en ${listaY(REDES_CALENDARIO)}, y el Marketing CoPilot te dice qué publicar esta semana.`,
};
