// =============================================================================
// /vsl/ads — Marketing CoPilot (el media buyer con IA y tu estrategia), con la ESTRUCTURA de la portada de Master Ads
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el DISEÑO):
//   https://masterads.ai/  (leída el 11/11/2026 con Chromium)
// El diseño copiado vive en ./disenos/ads.tsx; los valores medidos (Space Grotesk e IBM Plex Sans, la escala, los verdes que
// pasan al azul de MaKo, las cajas), en docs/diseno/landings-competencia/ads.md.
// Su orden, que se respeta acá: hero «Marketing digital simple.» con una frase de ejemplo → «¿Con qué arrancamos?» (cuatro
// accesos y el botón) → «Inteligencia artificial, atención humana.» → «"Master, lo de siempre": 5 piezas claves» → «"Te pido
// un cafecito y un reporte por favor"» → «Agente desde WhatsApp: pregúntale a tu negocio» → «Se conecta con» → «Pensado para
// el día a día de las pymes» → (el cierre con su precio). Por qué ganó: docs/competencia/landings-por-funcion.md →
// «Marketing CoPilot / Media Buyer con IA». Casi no tiene pruebas ni testimonios: esta landing tampoco lleva el caso.
//
// Lo que se cambió de la referencia, y por qué:
//   · «Atención humana»: Master Ads pone especialistas; MaKo no los tiene en esta tab. Lo que sostiene el mismo relato (la IA
//     no hace nada a tus espaldas) es que MaKo PROPONE con su porqué y tú apruebas, con tus topes y su deshacer.
//   · Su precio en el cierre: ninguna landing de /vsl escribe un precio a mano (el cierre es la llamada).
// Lo que hace hoy: la tab se llama Marketing CoPilot desde el 6/11/2026 (app/_components/nav.ts, key 'ads-manager'); la
// charla de la primera entrada, los funnels y los referentes salen de lib/media-buyer/copiloto.ts y lib/asesores/catalogo.ts;
// las secciones, de `seccionesDe` (mismo archivo); las columnas de Campañas, de lib/media-buyer/campanas-grupos.ts; lo que se
// pide por WhatsApp, de lib/api-mako/areas/ads.def.ts (ver_estado_meta, listar_campanas_meta, ver_media_buyer y
// lanzar_decision_media_buyer, que se confirma en una pantalla). Los gráficos, de la landing anterior de esta ruta.
//
// LOS TEXTOS DE MASTER ADS, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»; y
// sobre «tú apruebas»: «no tiene sentido eso ahí»):
//   · «Marketing digital simple.», «“Master, que las campañas de la empresa mejoren”.» → «“MaKo, que las campañas de mi
//     negocio mejoren”.», «Pídele lo que quieras y nuestra IA te va a ayudar a crear y optimizar campañas que
//     traccionen.» (→ MaKo, + «medidas contra lo que vendiste»), «¿Con qué arrancamos?»;
//   · «Inteligencia artificial, atención humana.» IGUAL (lo humano de MaKo es la llamada y el soporte que arregla y avisa
//     en el grupo: lib/aviso-arreglo.ts), con su «Te mostramos cómo obtener lo mejor de la IA… y juntos lo ajustamos a las
//     necesidades de tu empresa» (→ negocio). Sale «Inteligencia artificial que propone. Tú decides.»;
//   · «“Master, lo de siempre”.» / «5 piezas claves para manejar tu marketing digital sin depender de terceros.», con
//     «Optimiza con nuestra IA» en «Hoy» (sin «tú los apruebas»);
//   · «“Te pido un cafecito y un reporte por favor”.» / «Reportes profesionales en segundos.» (sin «en segundos»);
//   · «Agente desde WhatsApp», «Pregúntale a tu negocio como le preguntarías a un especialista.», «Escribe tu pregunta como
//     si le hablaras a una persona. Master Ads responde con tus propios datos» (→ MaKo, sin «en segundos»), su
//     «¿Qué me recomiendas cambiar?», «Se conecta con»;
//   · «Pensado para el día a día de las pymes.» (→ de tu negocio), «Sin curva de aprendizaje» / «Si sabes usar WhatsApp,
//     sabes usar Master Ads.» (→ MaKo), «Resultados a la vista» / «Un solo panel te dice qué está funcionando y qué no.»;
//     su «Creces a tu ritmo» no va (en su lugar, los funnels con y sin anuncios de lib/media-buyer/copiloto.ts).
// =============================================================================

import { ASESORES } from '@/lib/asesores/catalogo';
import { FUNNELS } from '@/lib/media-buyer/copiloto';
import type { LandingCompetencia } from './tipos';

const I = {
  copiloto: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  embudo: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  persona: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  columnas: ['M4 4h4v16h-4z', 'M10 4h4v10h-4z', 'M16 4h4v7h-4z'],
  chat: ['M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1'],
  lista: ['M9 6l11 0', 'M9 12l11 0', 'M9 18l11 0', 'M5 6l0 .01', 'M5 12l0 .01', 'M5 18l0 .01'],
  tope: ['M12 3l8 4.5v9l-8 4.5l-8 -4.5v-9l8 -4.5', 'M12 12l8 -4.5', 'M12 12v9', 'M12 12l-8 -4.5'],
  deshacer: ['M9 14l-4 -4l4 -4', 'M5 10h11a4 4 0 1 1 0 8h-1'],
  sol: ['M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 12h1m8 -9v1m8 8h1m-9 8v1m-6.4 -15.4l.7 .7m12.1 -.7l-.7 .7m0 11.4l.7 .7m-12.1 -.7l-.7 .7'],
  plan: ['M9 5h-2a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-12a2 2 0 0 0 -2 -2h-2', 'M9 12l2 2l4 -4'],
  biblioteca: ['M4 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M14 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z'],
  ajustes: ['M10.325 4.317c.426 -1.756 2.924 -1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543 -.94 3.31 .826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756 .426 1.756 2.924 0 3.35a1.724 1.724 0 0 0 -1.066 2.573c.94 1.543 -.826 3.31 -2.37 2.37a1.724 1.724 0 0 0 -2.572 1.065c-.426 1.756 -2.924 1.756 -3.35 0a1.724 1.724 0 0 0 -2.573 -1.066c-1.543 .94 -3.31 -.826 -2.37 -2.37a1.724 1.724 0 0 0 -1.065 -2.572c-1.756 -.426 -1.756 -2.924 0 -3.35a1.724 1.724 0 0 0 1.066 -2.573c-.94 -1.543 .826 -3.31 2.37 -2.37c1 .608 2.296 .07 2.572 -1.065z', 'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0'],
  llamada: ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'],
  carrito: ['M6 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0', 'M17 17h-11v-14h-2', 'M6 5l14 1l-1 7h-13'],
  organico: ['M4 4m0 4a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4z', 'M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0', 'M16.5 7.5l0 .01'],
};

/** Los nombres de los funnels que cumplen `si`, en una frase: «Anuncios a mensajes, webinar y email a tu lista». */
function nombres(si: (f: (typeof FUNNELS)[number]) => boolean): string {
  const n = FUNNELS.filter(si).map((f, i) => (i === 0 ? f.nombre : f.nombre.replace(/^[A-ZÁÉÍÓÚ](?=[a-záéíóúñ]+(?:\s|$))/, (c) => c.toLowerCase())));
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n.join('');
}

export const LANDING_ADS: LandingCompetencia = {
  slug: 'ads',
  nombre: 'Marketing CoPilot',
  icono: I.copiloto,
  referencia: { nombre: 'Master Ads — marketing digital simple', url: 'https://masterads.ai/', leida: '2026-11-11' },
  metaTitle: 'Marketing CoPilot de MaKo: marketing digital simple',
  metaDesc: 'Pídele lo que quieras y MaKo te va a ayudar a crear y optimizar campañas que traccionen, medidas contra lo que vendiste: tu funnel, tu estrategia y cada día lo que conviene subir, pausar o probar.',
  bloques: [
    {
      tipo: 'hero',
      // Como en Master Ads: la etiqueta dice qué es, el titular es lo que la persona le pide (entre comillas inglesas, como
      // los titulares de la referencia), y la bajada lo que pasa.
      etiqueta: 'Marketing digital simple.',
      titulo: '“MaKo, que las campañas de mi negocio mejoren”.',
      bajada: 'Pídele lo que quieras y MaKo te va a ayudar a crear y optimizar campañas que traccionen, <strong>medidas contra lo que vendiste</strong>.',
      visual: { tipo: 'propio', slug: 'ads' },
    },
    {
      tipo: 'tarjetas',
      titulo: '¿Con qué arrancamos?',
      columnas: 2,
      cta: true,
      items: [
        // Cortos: en la referencia son los botones de una caja de chat.
        { icono: I.embudo, titulo: 'Elige tu funnel', texto: `Uno de ${FUNNELS.length}, con o sin anuncios, según tu ticket, tu presupuesto y tu equipo.` },
        { icono: I.persona, titulo: 'Sigue a un referente', texto: `El método de uno de ${ASESORES.length} referentes del marketing. Ninguno participa en MaKo.` },
        { icono: I.columnas, titulo: 'Mira tus campañas', texto: 'En tres columnas: <strong>Funcionan, En prueba y Para revisar</strong>.' },
        { icono: I.chat, titulo: 'Pídeselo a MaKo', texto: 'Le escribes lo que quieres y te contesta con tu estrategia en la mano.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      titulo: 'Inteligencia artificial, atención humana.',
      bajada: 'Agenda tu llamada: te mostramos cómo obtener lo mejor de la IA en tu marketing y juntos lo ajustamos a las necesidades de tu negocio.',
      items: [
        { icono: I.llamada, titulo: 'Una llamada para empezar.', texto: 'Te mostramos MaKo con tus propios números y lo dejamos andando en tu negocio.' },
        { icono: I.chat, titulo: 'Personas detrás de MaKo.', texto: 'Si algo no anda, lo reportas desde la app y el equipo de MaKo lo arregla y <strong>te avisa en tu grupo de WhatsApp</strong>.' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: '“MaKo, lo de siempre”.',
      bajada: '5 piezas clave para manejar tu marketing digital sin depender de terceros.',
      items: [
        { icono: I.sol, titulo: 'Hoy', texto: 'Optimiza con MaKo: las decisiones del día sobre tus anuncios de Meta, cada una con qué cambia, por qué y los números que la dispararon.' },
        { icono: I.plan, titulo: 'Plan', texto: 'Tu funnel paso a paso, con lo que hay que hacer esta semana y dónde se hace en MaKo.' },
        { icono: I.columnas, titulo: 'Campañas', texto: 'Lo que funciona, lo que está en prueba y lo que hay que mirar hoy.' },
        { icono: I.biblioteca, titulo: 'Biblioteca', texto: 'Tus mejores anuncios, para pedirle variaciones a MaKo o subir creativos nuevos.' },
        { icono: I.ajustes, titulo: 'Ajustes', texto: 'Tu estrategia, tu objetivo y tus metas del mes, y tus topes: cuánto puede subir un presupuesto y un interruptor que lo frena todo.' },
      ],
    },
    {
      tipo: 'filas',
      titulo: '“Te pido un cafecito y un reporte, por favor”.',
      bajada: 'Reportes profesionales: lo que vendió cada anuncio, al lado de lo que gastaste.',
      slug: 'ads',
      items: [
        { grafico: 0, titulo: 'Tus anuncios, con lo que cerraron', texto: 'Los leads de cada anuncio que <strong>agendaron y cerraron</strong> en tu CRM, al lado de lo que gastaste en Meta.' },
        { grafico: 2, titulo: 'Cada día, una mirada a tu cuenta', texto: 'MaKo mira tu cuenta una vez por día, decide qué proponer y te lo explica, con el antes y el después de cada cambio y un botón para volver atrás.' },
      ],
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      etiqueta: 'Agente desde WhatsApp',
      titulo: 'Pregúntale a tu negocio como le preguntarías a un especialista.',
      bajada: 'Escribe tu pregunta como si le hablaras a una persona. MaKo responde con tus propios datos, en tu grupo de WhatsApp.',
      items: [
        { icono: I.chat, titulo: '«¿Qué campañas tengo activas?»', texto: 'El estado en vivo de tu cuenta de Meta: cada campaña con su estado y su presupuesto del día.' },
        { icono: I.lista, titulo: '«¿Cuánto gasté este mes?»', texto: 'Lo gastado en cada campaña en los últimos 30 días, en la moneda de tu cuenta.' },
        { icono: I.sol, titulo: '«¿Qué me recomiendas cambiar?»', texto: 'Las decisiones abiertas con su porqué. Para lanzar una, la confirmas en una pantalla de MaKo.' },
      ],
    },
    {
      tipo: 'logos',
      titulo: 'Se conecta con',
      items: [
        { logo: 'meta.png', nombre: 'Meta Ads' },
        { logo: 'whatsapp.png', nombre: 'WhatsApp' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
      ],
    },
    {
      tipo: 'tarjetas',
      titulo: 'Pensado para el día a día de tu negocio.',
      items: [
        { icono: I.chat, titulo: 'Sin curva de aprendizaje', texto: 'Si sabes usar WhatsApp, sabes usar MaKo: le escribes como a una persona.' },
        { icono: I.columnas, titulo: 'Resultados a la vista', texto: 'Un solo panel te dice qué está funcionando y qué no: Funcionan, En prueba y Para revisar.' },
        { icono: I.llamada, titulo: 'Con o sin anuncios', texto: `Si vendes con llamada (${nombres((f) => f.conLlamada)}), sin llamada o sin anuncios, tu funnel tiene su plan.` },
      ],
    },
  ],
};
