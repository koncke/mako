// =============================================================================
// /vsl/email — el Email de MaKo, con la ESTRUCTURA y el DISEÑO de la portada de beehiiv (11/11/2026; relevo fiel el 14/11/2026)
// =============================================================================
// REFERENCIA COPIADA ENTERA (el orden de secciones, el storytelling y el DISEÑO, con lo que se mueve):
//   https://www.beehiiv.com/  (leída el 11/11/2026 y otra vez el 14/11/2026 con Chromium, video del scroll, hovers y su CSS)
// El diseño vive en ./disenos/email.tsx y sus valores medidos en docs/diseno/landings-competencia/email.md (el relevo con capturas,
// en la carpeta de notas de la sesión, referencias-landings/email/). Su orden: hero «NEWSLETTERS. PODCASTS. COMMUNITY. ONE
// PLATFORM.» con sus dos imágenes que se funden → logos de sus clientes → «Everything you need to turn attention into growth» con
// sus seis tarjetas por producto, que se dan vuelta con el «+» → «Trusted by names you know» → (sus planes) → citas → «The numbers
// tell the story» → «Powerful integrations» → «Have a question?» → «What are you waiting for?». Por qué ganó:
// docs/competencia/landings-por-funcion.md → «Email marketing».
//
// Lo que se cambió de la referencia, y por qué:
//   · Sus logos de clientes, sus citas, sus casos y sus cifras de uso («135K+ publishers») son suyos: no van. La prueba es el caso de
//     Mauricio, en el lugar de «Trusted by names you know» y de su cita. Tampoco van cifras propias en el lugar de las suyas.
//   · Sus seis tarjetas son sus productos (newsletters, podcasts, productos digitales, monetización, comunidad, sitios). Aquí son
//     las seis partes de Email de MaKo, cada una con la PANTALLA REAL en el lugar de su captura (banco
//     C:/dev/bancos-portada/banco-email-landing) y, en la cara de atrás, lo que tiene (`meta` es su frase de atrás y `puntos`, sus
//     seis recuadros, «Título: texto»). Crecer (referidos, recomendaciones, SEO) y monetizar (su red de anuncios, suscripciones
//     pagas) MaKo no los tiene: no se dibujan. Sus planes con precio no van (ninguna landing de /vsl escribe un precio a mano).
//   · El titular del hero no es el suyo traducido desde el 14/11/2026 (la revisión de títulos que cumplen lo que promete el sitio).
//   · Sus integraciones (Stripe, Zapier, Google Analytics) → de dónde salen los disparadores de las secuencias.
//   · El newsletter de MaKo (app/newsletters) sigue en PRONTO, sólo para el super admin (app/newsletters/puerta.ts): no se promete.
//   · Las preguntas son las de la portada (el registro las pone): las de aquí quedan como respaldo.
//
// De dónde sale lo que se afirma: app/email/EmailApp.tsx (secuencias, envíos, «Envío real», la prueba, las cifras por paso y por envío,
// el dominio en tres pasos y su chequeo cada 10 s), lib/email-marketing.ts (los disparadores TRIGGERS, los segmentos SEGMENTOS y
// segmentosDisponibles —etiquetas y etapas del CRM—, los KPI de getEmailKpis), app/api/email/generar (el asunto, la vista previa,
// un solo llamado a la acción, las variables, el marcador si falta el link), app/_components/VozGuia.tsx (la voz del negocio),
// lib/email-dominio.ts (el «responder a» del negocio), lib/envio-flags.ts (el envío real apagado para cada negocio nuevo),
// app/api/webhooks/resend (rebote y spam dan de baja), lib/email-freno.ts (cuándo se apaga), app/crm/leads-importar.ts (importar).
// Los nombres de los disparadores y de los segmentos se copiaron tal cual el 14/11/2026: el test «Email: …» los busca en
// lib/email-marketing.ts.
// =============================================================================

import { FRENO_EMAIL } from '@/lib/email-freno';
import type { LandingCompetencia } from './tipos';

const I = {
  email: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10z', 'M3 7l9 6l9 -6'],
};

/** Los umbrales del freno del email, como se leen (300, 10, 0,3): salen de lib/email-freno.ts, no se escriben a mano. */
const pct = (x: number) => (x * 100).toLocaleString('es-MX', { maximumFractionDigits: 1 });

export const LANDING_EMAIL: LandingCompetencia = {
  slug: 'email',
  nombre: 'Email',
  icono: I.email,
  referencia: { nombre: 'beehiiv — la plataforma de newsletters', url: 'https://www.beehiiv.com/', leida: '2026-11-14' },
  metaTitle: 'Email de MaKo: secuencias, envíos y tu CRM, en una sola plataforma',
  metaDesc: 'Secuencias de email que salen solas por lo que hizo cada lead en tu embudo y envíos a un segmento de tu CRM, firmados con tu dominio. MaKo escribe cada email en la voz de tu negocio.',
  bloques: [
    {
      tipo: 'hero',
      etiqueta: 'Email marketing conectado a tu CRM',
      titulo: 'Tus emails,<br>escritos y enviados<br><em>desde tu CRM.</em>',
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
      // En el orden de sus filas: la primera de 2 a 1, la segunda de 1 a 2, la tercera de 2 a 1.
      items: [
        {
          titulo: 'Secuencias',
          texto: 'Emails que salen solos por lo que hizo cada lead en tu embudo.',
          meta: 'Eliges la etapa y el disparador, escribes cada email con su espera y la secuencia sale sola, lead por lead.',
          puntos: [
            'Dejó el formulario sin agendar: dejó sus datos en tu anuncio y no eligió horario.',
            'Vio el VSL sin agendar: miró tu video y no agendó.',
            'Agendó pero no confirmó: tiene su llamada y no la confirmó.',
            'No asistió a R1: no llegó a su primera llamada.',
            'Confirmó pero no pagó: dijo que sí y falta el primer pago.',
            'Se le puso una etiqueta: una etiqueta de tu CRM la dispara.',
          ],
        },
        {
          titulo: 'Envíos',
          texto: 'Un email a un segmento de tu CRM, cuando tú decides.',
          meta: 'Eliges a quién le llega, ves cuántos tienen email y lo mandas ahora o lo programas.',
          puntos: [
            'Todos los activos: leads abiertos o ganados con email.',
            'No agendaron: abiertos que nunca agendaron.',
            'No pagaron: confirmaron, pero sin primer pago.',
            'No show: no asistieron a la Reunión 1.',
            'Clientes (ganados): los leads ganados.',
            'Una etiqueta o una etapa: los de tu CRM con esa etiqueta o en esa etapa.',
          ],
        },
        {
          titulo: 'Escribe con MaKo',
          texto: 'El asunto, la vista previa y el texto, en la voz de tu negocio.',
          meta: 'Le dices qué quieres y MaKo lo escribe con el perfil de tu negocio y la voz que aprendió de él. Tú lo revisas.',
          puntos: [
            'Tu voz: el trato y el tono salen de tu marca, no de un molde.',
            'Asunto y vista previa: un asunto corto y una línea que no lo repite.',
            'Un solo llamado a la acción: de 2 a 5 párrafos cortos, en texto plano.',
            'Con su nombre: {nombre} y {empresa} se llenan con los de cada lead.',
            'Sin links inventados: si falta tu link de agenda, deja el lugar marcado.',
            'Lo revisas antes: queda en el editor y no sale nada hasta que lo guardas.',
          ],
        },
        {
          titulo: 'Tu dominio',
          texto: 'Sale con tu nombre y tu dominio, nunca con el de MaKo.',
          meta: 'Lo das de alta una vez: cargas los registros en tu DNS, lo verificas y eliges quién firma.',
          puntos: [
            'Tu dominio: lo escribes y MaKo te da los registros.',
            'DKIM y SPF: los copias tal cual en el panel de tu dominio.',
            'Verificado: MaKo lo vuelve a mirar solo cada 10 segundos.',
            'Tu remitente: el nombre y la dirección que ven tus leads.',
            'Las respuestas: llegan al correo que elijas.',
            'Tu cuenta de Resend: cada negocio manda con la suya.',
          ],
        },
        {
          titulo: 'Mide',
          texto: 'Enviados, aperturas y clics de cada email.',
          meta: 'Cada paso de una secuencia y cada envío muestran lo suyo, y arriba ves cómo va todo tu email.',
          puntos: [
            'Por paso: enviados, apertura y clic de cada email de la secuencia.',
            'Por envío: a cuántos les llegó, la apertura y el clic.',
            'Tasa de apertura: la de tus últimos 30 días.',
            'Tasa de clic: la de tus últimos 30 días.',
            'Suscriptores activos: tus leads con email que no se dieron de baja.',
            'Emails del mes: todo lo que salió este mes.',
          ],
        },
        {
          titulo: 'Cuida tu envío',
          texto: 'Pruebas, bajas y rebotes, y un freno que apaga el envío.',
          meta: 'Nada sale de verdad hasta que prendes el envío real, y MaKo cuida tu dominio mientras mandas.',
          puntos: [
            'Envío real apagado: pruebas todo sin que salga nada, y lo prendes tú.',
            'Una prueba a tu correo: te mandas el envío antes de mandarlo.',
            'Ves cuántos son: antes de mandar, a cuántos leads les llega.',
            'La baja en cada email: quien se da de baja no vuelve a recibir.',
            'Rebotes y spam: a esa dirección no se le vuelve a escribir.',
            `El freno: si de tus últimos ${FRENO_EMAIL.ultimos} envíos rebota el ${pct(FRENO_EMAIL.rebotes)} % o el ${pct(FRENO_EMAIL.quejas)} % lo marca como spam, se apaga y te avisa.`,
          ],
        },
      ],
    },
    { tipo: 'caso' },
    {
      tipo: 'logos',
      titulo: 'Se conecta con tus apps',
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
        { p: '¿Sale desde mi dominio?', r: 'Sí, y sólo así. Das de alta tu dominio en MaKo, cargas en tu DNS los registros que te muestra (DKIM y SPF), lo verificas y eliges tu remitente. Las respuestas pueden llegar al correo que elijas.' },
        { p: '¿Puedo mandar SMS desde MaKo?', r: 'No: MaKo no manda SMS. Por WhatsApp le escribes a tus leads desde Chats y desde Automations.' },
        { p: '¿Qué pasa con las bajas y los rebotes?', r: `Cada email lleva su link para darse de baja. Si una dirección rebota o alguien lo marca como spam, MaKo no le vuelve a escribir. Y si de tus últimos ${FRENO_EMAIL.ultimos} envíos rebota el ${pct(FRENO_EMAIL.rebotes)} % o el ${pct(FRENO_EMAIL.quejas)} % lo marca como spam, apaga el envío y te avisa.` },
        { p: '¿Sirve para un newsletter?', r: 'Todavía no. Hoy el email de MaKo le escribe a tus leads y clientes del CRM: secuencias por etapa y envíos a un segmento.' },
      ],
    },
  ],
};
