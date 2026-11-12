// =============================================================================
// /vsl/email — el Email de MaKo, con la ESTRUCTURA y el DISEÑO de la portada de beehiiv (11/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y, desde el 11/11/2026, también el DISEÑO):
//   https://www.beehiiv.com/  (leída el 11/11/2026 con Chromium)
// El diseño vive en ./disenos/email.tsx y sus valores medidos (getComputedStyle a 1440 y 390) en
// docs/diseno/landings-competencia/email.md. beehiiv sirve dos portadas distintas según la visita; se copió la que tiene
// este orden: hero «NEWSLETTERS. PODCASTS. COMMUNITY. ONE PLATFORM.» → logos de sus clientes → «Everything you need to turn
// attention into growth» (con sus tarjetas por producto: newsletters, podcasts, productos digitales, monetización,
// comunidad, sitios) → «Trusted by names you know» → (sus planes) → citas → «The numbers tell the story» → «Powerful
// integrations» → «Have a question?» → «What are you waiting for?» (el cierre). Por qué ganó:
// docs/competencia/landings-por-funcion.md → «Email marketing».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus logos de clientes, sus citas, sus casos y sus cifras de uso («135K+ publishers») son suyos: no van. La prueba es
//     el caso de Mauricio, en el lugar de «Trusted by names you know».
//   · Tampoco van cifras propias en el lugar de las suyas: lo que Email trae (los disparadores y los segmentos) se cuenta en
//     lib/email-marketing.ts, que no se puede importar fuera del server, y un número escrito a mano se queda viejo.
//   · De sus seis piezas, «crecer» (referidos, recomendaciones, SEO) y «monetizar» (anuncios, suscripciones pagas) MaKo no
//     las tiene: quedan las otras cuatro, en su orden.
//   · De sus tarjetas por producto, MaKo tiene una: las secuencias (el bloque `filas`, que el diseño dibuja como la primera
//     fila de tarjetas, con su gráfico). Podcasts, productos digitales, comunidad y sitios no son de Email. Sus planes con
//     precio no van (ninguna landing de /vsl escribe un precio a mano).
//   · Sus integraciones (Stripe, Zapier, Google Analytics) → de dónde salen los disparadores de las secuencias.
//   · El newsletter de MaKo (app/newsletters) sigue en PRONTO, sólo para el super admin (app/newsletters/puerta.ts): no se
//     promete, y la pregunta lo dice con «todavía no».
//   · Gráficos (app/vsl/_detalle/feature-visuals.ts, slug email): sólo el 0, la secuencia por disparadores. El 1 dice «en la
//     voz de Mauricio» y «tu link de Calendly ya puesto» (el generador deja [LINK DE AGENDA]: app/api/email/generar), el 2
//     muestra un DMARC que MaKo no mira (lib/email-dominio-reglas.ts lee DKIM y SPF) y el 3, un 98 % que nadie midió.
//
// De dónde sale lo que se afirma: app/email/EmailApp.tsx (secuencias, envíos, «Envío real», la prueba, las estadísticas),
// lib/email-marketing.ts (disparadores, segmentos y su conteo, la baja en cada envío), app/api/email/generar (el copy de
// MaKo), lib/email-dominio.ts y lib/resend-dominios.ts (el dominio y su remitente), app/api/webhooks/resend (rebotes y
// quejas), lib/email-freno.ts (cuándo se apaga el envío), app/crm/leads-importar.ts (importar contactos).
//
// LOS TEXTOS DE BEEHIIV, TAL CUAL (12/11/2026, Martín: «hay ciertas cosas que valen la pena copiarlas tal cual»):
//   · «NEWSLETTERS. PODCASTS. COMMUNITY. ONE PLATFORM.» → «Secuencias. Envíos. Tu CRM. Una sola plataforma.» (las tres
//     cosas de MaKo; el newsletter es «todavía no»); «The all-in-one platform helping the world's best newsletters publish,
//     grow and earn» → «La plataforma todo en uno que te ayuda a escribir, enviar y medir tus emails» (crecer y ganar no
//     están medidos);
//   · «Everything you need to turn attention into growth.» / «Publish your best work, grow your audience, unlock new
//     revenue, and understand what's working. beehiiv brings it all together, no digital duct tape required.» (sin
//     «unlock new revenue»; la cinta, «sin parches entre herramientas»);
//   · sus piezas «Create» («…with a fast editor, beautiful templates, and AI that's actually helpful»), «Automate»
//     («…segment subscribers… all without writing a single line of code»), «Integrate» y «Measure» («Keep track of what's
//     working»); «Grow» y «Monetize» no son de MaKo;
//   · «Powerful integrations.», «Have a question?» con sus preguntas «Can I integrate my existing email list from another
//     newsletter platform?», «Can I create a newsletter without prior design experience?» (→ emails), «Can I send SMS
//     messages from beehiiv?», «Can I track the performance of my newsletters?», y el cierre «What are you waiting for?»
//     (en ./disenos/email.tsx).
// =============================================================================

import { FRENO_EMAIL } from '@/lib/email-freno';
import type { LandingCompetencia } from './tipos';

const I = {
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
  ia: ['M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3l5.8 1.9l-5.8 1.9a2 2 0 0 0 -1.3 1.3l-1.9 5.8l-1.9 -5.8a2 2 0 0 0 -1.3 -1.3l-5.8 -1.9l5.8 -1.9a2 2 0 0 0 1.3 -1.3z'],
  rayo: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  segmento: ['M4 4h16v2.172a2 2 0 0 1 -.586 1.414l-4.414 4.414v7l-6 2v-8.5l-4.414 -4.414a2 2 0 0 1 -.586 -1.414v-2.172z'],
  mide: ['M3 13a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M9 9a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M15 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v14a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z', 'M4 20l14 0'],
};

/** Los umbrales del freno del email, como se leen (5, 0.3): salen de lib/email-freno.ts, no se escriben a mano. */
const pct = (x: number) => (x * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export const LANDING_EMAIL: LandingCompetencia = {
  slug: 'email',
  nombre: 'Email',
  icono: I.email,
  referencia: { nombre: 'beehiiv — la plataforma de newsletters', url: 'https://www.beehiiv.com/', leida: '2026-11-11' },
  metaTitle: 'Email de MaKo: secuencias, envíos y tu CRM, en una sola plataforma',
  metaDesc: 'Secuencias de email que salen solas por lo que hizo cada lead en tu embudo y envíos a un segmento de tu CRM, firmados con tu dominio. MaKo escribe cada email en la voz de tu negocio.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Email marketing conectado a tu CRM',
      titulo: 'Secuencias.<br>Envíos.<br>Tu CRM.<br><em>Una sola plataforma.</em>',
      bajada: 'La plataforma todo en uno que te ayuda a escribir, enviar y medir tus emails: <strong>secuencias que salen solas</strong> por lo que hizo cada lead en tu embudo y envíos a un segmento de tu CRM, firmados con tu dominio.',
      puntos: ['MaKo escribe cada email en la voz de tu negocio', 'Sale desde tu dominio, nunca desde el de MaKo'],
      visual: { tipo: 'detalle', slug: 'email' },
    },
    {
      tipo: 'tarjetas',
      fondo: true,
      columnas: 2,
      etiqueta: 'Producto',
      titulo: 'Todo lo que necesitas para convertir la atención en crecimiento',
      bajada: 'Escribe tus mejores emails, mándalos a quien corresponde y entiende qué está funcionando. MaKo lo junta todo, en el mismo lugar donde están tus leads, sin parches entre herramientas.',
      items: [
        { icono: I.ia, titulo: 'Crea', texto: 'Escribe emails que suenan a tu negocio, con una IA que de verdad ayuda: le dices qué quieres y MaKo te devuelve el asunto, la vista previa y el texto, con <strong>un solo llamado a la acción</strong>. Lo revisas antes de usarlo.' },
        { icono: I.rayo, titulo: 'Automatiza', texto: 'Crea secuencias y segmenta a tus leads, sin escribir una sola línea de código. Cada lead entra a la suya por lo que hizo en tu embudo: vio tu VSL sin agendar, no asistió a su llamada, confirmó y no pagó.' },
        { icono: I.segmento, titulo: 'Integra', texto: 'Tus segmentos son tu CRM: envías a una etapa real de tu embudo —no agendaron, no pagaron, tus clientes— o a una etiqueta, y <strong>ves cuántos son</strong> antes de mandar.' },
        { icono: I.mide, titulo: 'Mide', texto: 'Sigue qué está funcionando: cada paso de una secuencia y cada envío muestran sus enviados, su apertura y sus clics. Arriba, tu tasa de apertura y de clic de los últimos 30 días.' },
      ],
    },
    {
      tipo: 'filas',
      titulo: 'Una secuencia para cada momento de tu embudo',
      bajada: 'Eliges la etapa y el disparador, escribes cada paso con su espera y la secuencia sale sola.',
      slug: 'email',
      items: [
        {
          grafico: 0,
          titulo: 'El email que sale solo, cuando el lead hace algo',
          texto: 'Cada lead entra cuando le pasa algo como esto:',
          puntos: ['Dejó el formulario de tu anuncio sin agendar', 'Vio tu VSL y no agendó', 'Agendó y no confirmó, o no asistió a su llamada', 'Confirmó la compra y no pagó', 'Se le puso una etiqueta'],
        },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'logos',
      titulo: 'Integraciones potentes',
      items: [
        { logo: 'meta.png', nombre: 'Tus formularios de Meta' },
        { logo: 'vsl.png', nombre: 'Tu VSL' },
        { logo: 'calendly.png', nombre: 'Tu agenda' },
        { logo: 'llamada.svg', nombre: 'Tus llamadas' },
        { logo: 'pago.svg', nombre: 'Tus pagos' },
      ],
    },
    {
      tipo: 'preguntas',
      titulo: '¿Tienes una pregunta?',
      items: [
        { p: '¿Puedo traer mi lista de email de otra plataforma?', r: 'Sí. Importas tus contactos al CRM desde un archivo CSV y desde ahí entran a tus segmentos y a tus secuencias.' },
        { p: '¿Puedo crear mis emails sin experiencia en diseño?', r: 'No. Cada email es un asunto, una vista previa y el texto. MaKo te lo escribe en la voz de tu negocio y tú lo revisas.' },
        { p: '¿Sale desde mi dominio?', r: 'Sí, y sólo así. Das de alta tu dominio en MaKo, cargas en tu DNS los registros que te muestra (DKIM y SPF), lo verificas y eliges tu remitente. Las respuestas pueden llegar al correo que elijas.' },
        { p: '¿Puedo mandar SMS desde MaKo?', r: 'No: MaKo no manda SMS. Por WhatsApp le escribes a tus leads desde Chats y desde Automations.' },
        { p: '¿Puedo medir el rendimiento de mis emails?', r: 'Sí. Cada paso de una secuencia y cada envío muestran sus enviados, su apertura y sus clics, y arriba ves tus suscriptores activos, tu tasa de apertura y de clic de los últimos 30 días y los emails del mes.' },
        { p: '¿Qué pasa con las bajas y los rebotes?', r: `Cada email lleva su link para darse de baja. Si una dirección rebota o alguien lo marca como spam, MaKo no le vuelve a escribir. Y si de tus últimos ${FRENO_EMAIL.ultimos} envíos rebota el ${pct(FRENO_EMAIL.rebotes)} % o el ${pct(FRENO_EMAIL.quejas)} % lo marca como spam, apaga el envío y te avisa.` },
        { p: '¿Se manda solo apenas lo configuro?', r: 'No. El envío real empieza apagado: pruebas todo sin que salga nada y, antes de cada envío, te mandas una prueba a tu correo. Lo prendes cuando estés listo.' },
        { p: '¿Sirve para un newsletter?', r: 'Todavía no. Hoy el email de MaKo le escribe a tus leads y clientes del CRM: secuencias por etapa y envíos a un segmento.' },
      ],
    },
  ],
};
