// =============================================================================
// Los seis beneficios de ser partner de MaKo (18/11/2026): los textos aprobados por el Cerebro, para el carrusel
// =============================================================================
// Aparte de LandingPartners.tsx porque también los usa el artefacto (que monta el carrusel en el navegador) y no tiene que
// cargar la landing entera. El 30% sale de la constante (./numeros.ts).
// =============================================================================

import { PORCENTAJE_DIRECTO } from './numeros';

/**
 * «¿POR QUÉ SER PARTNER DE MaKo TE CONVIENE?» (18/11/2026, Martín por el Cerebro: «que se sepa el valor para el partner… ¿qué le
 * evita que sea fácil de usar? Le evita que le estén preguntando todo el tiempo»). La sección importante de la página: el
 * beneficio PARA EL PARTNER, no para el negocio. Sólo lo que existe: el onboarding y los tutoriales, el grupo de WhatsApp de cada
 * negocio con el equipo, las funciones del sitio y el material de lib/partners-recursos.ts (el PDF de venta y los mensajes para
 * copiar; los audios y videos todavía no están grabados y no se nombran). Sin números inventados («en vez de diez» no va).
 * Íconos de Tabler (MIT).
 */
export type Beneficio = { titulo: string; texto: string; icono: readonly string[] };

export const BENEFICIOS: readonly Beneficio[] = [
  { titulo: 'Todo en una sola app', texto: 'CRM, WhatsApp, automatizaciones, anuncios e IA juntos. Dejan de pagar varias herramientas y no quieren volver atrás.',
    icono: ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M14 17h6', 'M17 14v6'] },
  { titulo: 'Ingresos que duran', texto: `Un negocio que lo tiene todo en MaKo no se va. Y tu ${PORCENTAJE_DIRECTO} sigue entrando, mes tras mes.`,
    icono: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'] },
  { titulo: 'Fácil de usar', texto: 'Lo aprenden solos con el onboarding y los tutoriales. Nadie te escribe para preguntarte cómo se usa.',
    icono: ['M3 12l3 0', 'M12 3l0 3', 'M7.8 7.8l-2.2 -2.2', 'M16.2 7.8l2.2 -2.2', 'M7.8 16.2l-2.2 2.2', 'M12 12l9 3l-4 2l-2 4l-3 -9'] },
  { titulo: 'Soporte prioritario', texto: 'Si algo les pasa, les respondemos nosotros en su grupo de WhatsApp. Tú sólo cobras.',
    icono: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'] },
  // «cobrando por transferencia…» decía que el NEGOCIO cobra así con MaKo, y eso no está: lo que es verdad es que MaKo se paga así.
  { titulo: 'Hecha para Latinoamérica', texto: 'Pensada para cómo se vende en Latinoamérica: por WhatsApp y en español. Y se paga con Mercado Pago, en pesos.',
    icono: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'] },
  // «No te dejamos solo» no es neutro en género (memoria «textos neutros»): «Nunca vendes sin ayuda».
  { titulo: 'Te ayudamos a vender', texto: 'Nunca vendes sin ayuda: material listo con tu link, te ayudamos con tus anuncios y respondemos las dudas de tus contactos antes de que compren.',
    icono: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'] },
];
