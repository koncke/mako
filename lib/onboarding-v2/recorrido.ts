// =============================================================================
// EL RECORRIDO APROBADO: la primera vez en el Ops Center del onboarding V2 (18/11/2026)
// =============================================================================
// Es el `GUION` de la maqueta (C:/dev/artefactos-onboarding/cuerpo.html), con los pasos, el orden y los textos que Martín aprobó:
// el chat del reto, la barra («Tu panel»), el Second Brain (se toca), el grafo, la flecha de volver (se toca) y la Ticketera. Martín,
// 18/11: «antes era mucho mejor, le mostrábamos la sidebar… No tiene sentido mostrarle por primera vez el Funnel Coach», y «el video
// sigue al recorrido, nunca al revés»: el video `recorrido` sólo se usa si sus marcas son ESTOS pasos, en su orden (`sigueLosPasos`,
// lib/tutoriales/videos.ts). Sin video fiel, el recorrido corre con sus tarjetas.
//
// El mapa del Second Brain ya lo ve el dueño del negocio: `veMapa` (app/second-brain/page.tsx) es el rol `admin` DEL NEGOCIO
// (lib/puerta-admin-tab.ts: «getRolWsEfectivo ya da 'admin' a la agencia y al dueño»), y el grafo es el del propio negocio, armado en
// el servidor. Quedan afuera los closers y los setters.
// =============================================================================
import type { TutorialPestana } from '@/lib/tutoriales';
import { RETO_SUB } from '@/lib/reto/dias';

const SECOND_BRAIN = '[data-recorrido="sb-second-brain"]';
const FLECHA = '[data-recorrido="sb-brain-volver"], button.cbg-atras';

export const TUTORIAL_RECORRIDO: TutorialPestana = {
  pestana: 'recorrido',
  nombre: 'MaKo',
  ruta: '/second-brain',
  intro: '¡Hola de nuevo! Te muestro tu MaKo por dentro: dura menos de un minuto.',
  pasos: [
    { sel: '[data-recorrido="sb-reto-chat"]', titulo: 'El reto de 7 días de MaKo', texto: RETO_SUB, sub: 'Y tu reto de 7 días tiene su propio chat: cada día un video para que avances con tu negocio.', lado: 'derecha' },
    { sel: 'aside[data-sidebar]', titulo: 'Tu panel', texto: 'Aquí están todas tus pestañas: tus ventas, tu marketing y todo lo que creas.', sub: 'Y a la izquierda aparece tu panel, con todas las pestañas de MaKo.', lado: 'derecha' },
    { sel: SECOND_BRAIN, titulo: 'Tu Second Brain', texto: 'Es todo lo que MaKo sabe de tu negocio.', sub: 'Toca Second Brain: es todo lo que MaKo sabe de tu negocio.', lado: 'derecha', haz: 'Haz clic en Second Brain', clic: true },
    // Sin el video, el paso abre el Second Brain él mismo (`antes`); con el video, lo abre el clic de la persona en su pausa (o
    // «Siguiente», que hace el mismo clic; si no se tocó, el motor toca el `antes`: 20/11).
    // `haz` en el Second Brain y en la flecha (20/11, OD-10): «Toca Second Brain…» y «Y para volver, la flecha…» no empiezan con
    // «toca aquí», y el motor ponía «Haz clic en lo marcado».
    { sel: '[data-recorrido="sb-grafo"]', titulo: 'Lo que MaKo sabe de ti', texto: 'Por ahora, esto es lo que sé de ti. A medida que te conozco, voy armando tu Second Brain automáticamente.', sub: 'A medida que te conozco, voy armando tu Second Brain automáticamente.', antes: SECOND_BRAIN, soloComputadora: true },
    { sel: FLECHA, titulo: 'Vuelve a tus chats', texto: 'Con la flecha del Second Brain vuelves al Ops Center.', sub: 'Y para volver, la flecha de arriba.', lado: 'derecha', soloComputadora: true, haz: 'Haz clic en la flecha', clic: true },
    { sel: '[data-recorrido="sb-ticketera"]', titulo: 'La Ticketera', texto: '¿Algo falla, o quieres proponer una función nueva? Mándale un audio o un mensaje a MaKo aquí: daremos todo nuestro esfuerzo para resolverlo.', sub: 'Si tienes un problema o quieres proponer algo, escríbele a MaKo en la Ticketera: daremos todo nuestro esfuerzo para resolverlo.', antes: FLECHA, lado: 'derecha' },
  ],
};
