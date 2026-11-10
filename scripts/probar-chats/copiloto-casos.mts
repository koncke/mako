// =============================================================================
// Los casos de la batería del Marketing CoPilot (9/11/2026) — los corre ./copiloto.mts
// =============================================================================
// Seis negocios inventados (los que pidió el Cerebro: infoproductor con anuncios, coach por orgánico, YouTube, email,
// inmobiliaria, e-commerce) y el de MaKo, que corre con `--negocio=real` sobre lo que el ws 9 tiene de verdad. Cada uno pide
// pasar de un funnel a otro en los turnos del guion; los demás los contesta la persona (Gemini) con su `ficha` y nada más.
// La ficha tiene MÁS de lo que la persona dice sola: lo que MaKo no pregunta, no aparece. Eso es lo que se mide.
// =============================================================================

export type CasoCopiloto = {
  id: string;
  /** Quién escribe, para la persona simulada. */
  quien: string;
  /** Todo lo que la persona sabe de su negocio (contesta con esto y nada más). */
  ficha: string;
  apertura: string;
  /** Los turnos que escribe el guion (el 1 es la apertura). */
  guion: Record<number, string>;
  turnos: number;
  /** Con qué perfil del CoPilot arranca (vacío = escribió en el chat sin hacer la primera entrada). */
  perfil?: Record<string, unknown>;
  /** Lo que el negocio cargó en MaKo (con `--negocio=caso` reemplaza al del ws 9). */
  negocio: { perfil: string; fase: string; objetivos: string; cerebro: string; ofertas?: unknown[] };
  /** Lo que devuelve una lectura de la cuenta (ver_media_buyer y demás) en este negocio; sin esto, «sin datos». */
  lecturas?: Record<string, unknown>;
};

export const CASOS: CasoCopiloto[] = [
  {
    id: 'infoproductor',
    quien: 'Lucía, que vende un curso online de fotografía de producto',
    ficha: `- Vendes «Foto que Vende», un programa online de 6 semanas de fotografía de producto con el celular, para emprendedoras. Precio: US$497 (hay cuotas).
- Vendes hace 8 meses, sólo por Instagram orgánico y mensajes directos: 31 alumnas en total, unas 4 por mes.
- Tienes 4.200 seguidores en Instagram. Publicas 3 reels por semana cuando puedes.
- Tienes 12 alumnas con resultados que puedes mostrar (antes y después de sus fotos, 5 con testimonio en video).
- Para anuncios puedes poner unos US$600 por mes. Nunca hiciste anuncios.
- Los mensajes los contestas tú misma; no tienes equipo. Te incomoda hacer llamadas de venta, prefieres vender por chat.
- Estás en Argentina; tus alumnas son de toda LATAM.
- No tienes lista de email. Tienes una landing simple con el botón a WhatsApp.
- Tu meta: llegar a 15 alumnas por mes.`,
    apertura: 'Hola! Quiero empezar a hacer anuncios para vender mi curso. ¿Qué me recomendás?',
    guion: {
      5: '¿Y si en vez de anuncios me enfoco en orgánico? Me da miedo quemar plata.',
      7: '¿Y una lista de email? ¿Me sirve para esto?',
      8: 'Dale. ¿Qué hago esta semana, concretamente?',
    },
    turnos: 8,
    negocio: {
      perfil: 'Negocio — Nombre: Foto que Vende · Rubro: educación online (fotografía de producto)\nOferta — Programa online de 6 semanas de fotografía de producto con el celular para emprendedoras · Precio: US$497 · Garantía: 7 días',
      fase: 'Validación: ya vende (unas 4 ventas por mes) sin anuncios; busca un canal que escale.',
      objetivos: '',
      cerebro: '',
    },
  },
  {
    id: 'coach',
    quien: 'Diego, coach de liderazgo para gerentes',
    ficha: `- Eres coach de liderazgo para gerentes de mandos medios. Programa 1 a 1 de 3 meses: 1.800 euros.
- Tus clientes llegan por referidos y algo de LinkedIn (2.300 contactos). En Instagram tienes 900 seguidores y casi no publicas.
- Tienes 4 horas por semana para hacer contenido, no más. Te sientes cómodo escribiendo y hablando a cámara, no editando.
- NO quieres pagar anuncios por ahora (cero presupuesto). Si te insisten, podrías poner 300 euros al mes.
- Las llamadas de venta las haces tú. Cierras 1 de cada 3 llamadas.
- Estás en España (Madrid). Tus clientes son de España.
- Hoy consigues 1 o 2 clientes por mes. Quieres 4 por mes.
- Tienes 6 casos de clientes con resultados (ascensos, equipos que mejoraron), 3 con testimonio escrito.`,
    apertura: 'Quiero conseguir clientes con contenido orgánico, no quiero pagar anuncios. ¿Cómo lo armo?',
    guion: {
      5: '¿Y si pruebo con anuncios igual? Podría poner 300 euros al mes.',
      7: '¿Y LinkedIn? Mis clientes están ahí, no en Instagram.',
      8: 'Ok. ¿Cuál sería el plan para este mes?',
    },
    turnos: 8,
    negocio: {
      perfil: 'Negocio — Nombre: Diego Liderazgo · Rubro: coaching ejecutivo\nOferta — Programa 1 a 1 de 3 meses de liderazgo para gerentes · Precio: 1.800 € · Garantía: —',
      fase: 'Tracción: vende por referidos (1-2 clientes por mes); quiere un canal propio.',
      objetivos: '',
      cerebro: '',
    },
  },
  {
    id: 'youtube',
    quien: 'Martina, nutricionista deportiva online',
    ficha: `- Eres nutricionista deportiva. Atiendes online: plan mensual con seguimiento por WhatsApp a US$120 por mes. Tus pacientes se quedan en promedio 5 meses.
- Tienes 38 pacientes activos. Quieres llegar a 80.
- Tienes 2.500 seguidores en Instagram. En YouTube subiste 2 videos hace un año (300 vistas en total).
- Tienes 6 horas por semana para contenido. Grabas bien a cámara; editar te cuesta.
- No tienes presupuesto para anuncios ahora (quizás US$150 por mes más adelante).
- Los mensajes de WhatsApp los contestas tú. No haces llamadas de venta: la gente pregunta por WhatsApp y le pasas el link de pago.
- Estás en México. Tus pacientes son de México y algo de Colombia.
- Tienes casos de pacientes (corredores que bajaron sus tiempos, gente que bajó grasa), con permiso para mostrar 8.`,
    apertura: 'Quiero arrancar un canal de YouTube para conseguir pacientes. ¿Qué estrategia me armás?',
    guion: {
      5: '¿Y si en vez de videos largos hago shorts y reels? ¿Es lo mismo?',
      7: '¿Conviene sumar un lead magnet, tipo una guía de comidas para corredores?',
      8: '¿Qué grabo esta semana?',
    },
    turnos: 8,
    negocio: {
      perfil: 'Negocio — Nombre: Martina Nutrición Deportiva · Rubro: salud (nutrición online)\nOferta — Plan mensual de nutrición deportiva con seguimiento por WhatsApp · Precio: US$120 por mes',
      fase: 'Tracción: 38 pacientes activos, todos por recomendación e Instagram.',
      objetivos: '',
      cerebro: '',
    },
  },
  {
    id: 'email',
    quien: 'Pablo, consultor de finanzas personales',
    ficha: `- Vendes una mentoría grupal de 8 semanas de finanzas personales e inversión: US$900.
- Tienes una lista de 3.200 emails de un ebook gratis que regalaste hace un año. No le escribiste nunca más. Cuando le escribiste, abría un 25%.
- Tienes 15.000 seguidores en Instagram.
- Puedes poner US$400 por mes en anuncios.
- Tienes una asistente que hace las llamadas de venta (agenda y cierra); cierra 1 de cada 4.
- Usas Mailchimp (plan gratis).
- Estás en Colombia; tus clientes son de Colombia, México y Perú.
- Vendes unas 6 mentorías por cohorte, una cohorte cada 2 meses. Quieres 20 por cohorte.
- Tienes 9 casos de alumnos (deudas pagadas, primeras inversiones) con testimonio.`,
    apertura: 'Tengo una lista de 3.000 mails que no uso. Quiero armar un funnel de email para vender mi mentoría. ¿Cómo sería?',
    guion: {
      5: '¿Y si mejor hago un webinar?',
      7: '¿Y si le meto anuncios a un lead magnet para que crezca la lista?',
      8: 'Bajámelo a pasos para estas dos semanas.',
    },
    turnos: 8,
    negocio: {
      perfil: 'Negocio — Nombre: Pablo Finanzas · Rubro: educación financiera\nOferta — Mentoría grupal de 8 semanas de finanzas personales e inversión · Precio: US$900',
      fase: 'Tracción: 6 ventas por cohorte, una cohorte cada 2 meses.',
      objetivos: '',
      cerebro: '',
    },
  },
  {
    id: 'inmobiliaria',
    quien: 'Carolina, dueña de una inmobiliaria en Córdoba',
    ficha: `- Tienes una inmobiliaria en Córdoba (Argentina). Vendes departamentos en pozo de dos desarrolladoras. Por venta te queda una comisión de unos US$3.000.
- Desde que alguien consulta hasta que compra pasan 2 o 3 meses.
- Tienes 2 asesores que llaman a los interesados.
- Gastas US$1.000 por mes en anuncios de Facebook e Instagram con formulario. Te llegan unos 180 leads por mes; contesta el teléfono 1 de cada 4, y de esos visita el showroom 1 de cada 6. Vendes 1 o 2 departamentos por mes.
- También publicas en Zonaprop (portal) y de ahí salen leads mejores, pero pocos.
- El formulario de Facebook sólo pide nombre y teléfono.
- No tienes videos de los proyectos; sí renders y planos. La obra de uno ya está en el piso 6.
- Quieres vender 4 departamentos por mes.`,
    apertura: 'Hacemos anuncios en Facebook con formulario pero los leads son malísimos, no contestan. ¿Qué cambiarías?',
    guion: {
      5: '¿Y Google Ads? La gente busca «departamentos en pozo Córdoba».',
      7: '¿Y si hacemos orgánico en Instagram con recorridos de obra?',
      8: '¿Qué hacemos el lunes?',
    },
    turnos: 8,
    perfil: { entrada: 'funnel', funnel: 'formulario', ticket: 3000, presupuestoMes: 1000, llamadas: 'equipo', aceptado: true },
    negocio: {
      perfil: 'Negocio — Nombre: Altos de Córdoba Propiedades · Rubro: inmobiliaria (venta de departamentos en pozo)\nOferta — Departamentos en pozo de 1 y 2 dormitorios en Nueva Córdoba, con financiación en cuotas',
      fase: 'Escala: vende 1-2 por mes con anuncios de formulario; los leads no contestan.',
      objetivos: 'Vender 4 departamentos por mes este trimestre (hoy 1-2).',
      cerebro: '',
    },
    lecturas: {
      ver_media_buyer: { ok: true, cuenta: 'Altos de Córdoba (Meta)', ultimos30dias: { gasto: 1000, leads: 182, costoPorLead: 5.49, campanas: [{ nombre: 'Formulario · Pozo Nueva Córdoba', objetivo: 'Clientes potenciales (formulario instantáneo)', gasto: 1000, leads: 182, ctr: '1,9 %', frecuencia: 2.4 }] }, notas: 'Formulario de mayor volumen, con 2 campos (nombre y teléfono).' },
    },
  },
  {
    id: 'ecommerce',
    quien: 'Sofía, dueña de una tienda online de cosmética natural',
    ficha: `- Tienes una tienda online (Shopify) de cosmética natural: cremas, sérums, jabones. Ticket promedio: US$45. Margen bruto: 60%.
- Haces unos 40 pedidos por mes. El 30% de tus clientas vuelve a comprar dentro de 2 meses.
- Puedes poner US$1.500 por mes en anuncios. Hoy pones US$300 en «promocionar publicación» de Instagram y no sabes si funciona.
- Nadie toma llamadas: se compra directo en la web.
- Tienes 8.000 seguidores en Instagram y una lista de 1.100 emails de clientas (Shopify Email), a la que casi no escribes.
- Estás en Chile y envías sólo a Chile.
- No tienes el píxel de Meta bien instalado (no sabes si está).
- Quieres llegar a 150 pedidos por mes.`,
    apertura: 'Tengo una tienda online de cosmética y quiero escalar con anuncios. ¿Qué funnel me conviene?',
    guion: {
      5: '¿Y si hago contenido con influencers en vez de anuncios?',
      7: '¿El email marketing sirve para que vuelvan a comprar?',
      8: '¿Qué hago primero?',
    },
    turnos: 8,
    negocio: {
      perfil: 'Negocio — Nombre: Raíz Cosmética Natural · Rubro: e-commerce (cosmética natural)\nOferta — Cremas, sérums y jabones naturales con envío a todo Chile · Ticket promedio: US$45',
      fase: 'Tracción: 40 pedidos por mes, casi todo por Instagram.',
      objetivos: '',
      cerebro: '',
    },
  },
  {
    id: 'mako',
    quien: 'Martín, el dueño de MaKo (el software de marketing para negocios de servicios high ticket)',
    ficha: `- Eres el dueño de MaKo, un software de marketing con IA para dueños de negocios de servicios que venden high ticket (coaches, consultores, agencias) en LATAM.
- Lo vendes con un VSL y una llamada de venta. Las llamadas las tomas tú.
- Puedes poner unos US$1.000 por mes en anuncios.
- Si MaKo te pregunta precios, clientes o métricas que deberían estar en tu cuenta, dile que los mire en tu cuenta («eso está en MaKo, fijate»).`,
    apertura: 'Quiero conseguir más clientes para MaKo con anuncios. ¿Qué funnel me armás?',
    guion: {
      5: '¿Y si además arranco un canal de YouTube?',
      7: '¿Y un email a los leads que ya tengo en el CRM?',
      8: 'Ok, ¿por dónde empiezo esta semana?',
    },
    turnos: 8,
    negocio: { perfil: '', fase: '', objetivos: '', cerebro: '' },
  },
];
