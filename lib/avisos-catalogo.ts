// =============================================================================
// avisos-catalogo — la biblioteca de VOZ de MaKo para los avisos al dueño
// =============================================================================
// Catálogo exhaustivo de TODO lo que MaKo le puede decir al dueño por WhatsApp:
// reportes, avisos, acciones sugeridas y preguntas. Cada entrada trae un ejemplo
// con datos de muestra (sirve de plantilla + de demo). Es DATA PURA (sin
// server-only ni imports de server) para poder usarse desde la app y desde
// scripts de prueba. La detección real vive en el código (barata/determinística);
// la IA solo redacta la voz — este catálogo es el molde de esa voz.
//
// Derivado del mapa multiagente (workflow mako-avisos-discovery, 131 casos → ~48).

export type CategoriaAviso = 'reporte' | 'aviso' | 'accion' | 'pregunta';
/**
 * @deprecated Es el Semáforo escrito con OTRAS palabras: donde el canónico dice
 * `ambar` y `gris`, éste dice `amarillo` y `na`. El tipo bueno es `Semaforo` de
 * lib/mako-gramatica.ts.
 *
 * No se renombra todavía porque estos valores están ESCRITOS en las ~48 filas
 * de CATALOGO_AVISOS de abajo, y cambiarlos es una migración aparte. Para leer
 * uno y pintarlo, pasalo por `normalizarSemaforo()`: acepta las dos escrituras.
 */
export type SemaforoAviso = 'verde' | 'amarillo' | 'rojo' | 'na';
export type PrioridadAviso = 'alta' | 'media' | 'baja';
export type EstadoImplementacion = 'si' | 'parcial' | 'no';

export type AvisoCatalogo = {
  /** slug estable; sirve de `tipo` en el feed y de key de dedup. */
  id: string;
  titulo: string;
  categoria: CategoriaAviso;
  prioridad: PrioridadAviso;
  semaforo: SemaforoAviso;
  /** true si MaKo espera un sí/no (acción) o una respuesta del dueño. */
  requiereRespuesta: boolean;
  /** estado de la LÓGICA que dispara este aviso (no del mensaje). */
  yaImplementado: EstadoImplementacion;
  /** disparador (evento/cron/umbral) que lo genera. */
  disparador: string;
  /** ejemplo con datos de muestra, en la voz de MaKo (rioplatense). */
  ejemplo: string;
};

// Emojis por categoría (para agrupar visualmente en la demo).
export const EMOJI_CATEGORIA: Record<CategoriaAviso, string> = {
  reporte: '📊', aviso: '🔔', accion: '⚡', pregunta: '❓',
};

export const CATALOGO_AVISOS: AvisoCatalogo[] = [
  // ── REPORTES (digest por cron) ─────────────────────────────────────────────
  {
    id: 'reporte-diario', titulo: 'Reporte diario matutino', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron diario a la mañana temprano (hora local del workspace): semáforo + ads de ayer + wins + pendientes.',
    ejemplo: `📊 *Reporte del día* — 14/07\n\n🟢 *Cuenta Meta:* activa · saldo $120 · gastado $8.300 MXN\n*Ads (ayer):* $95 · 14 leads · CPL $6,8 · CTR 1,9%\n*Wins:* 3/10 cierres · cash $4.200 del mes\n*Pendientes:* 2 datos sin marcar · 0 cuotas vencidas\n\nArrancá el día con esto. — MaKo`,
  },
  {
    id: 'reporte-horario', titulo: 'Reporte horario "lo urgente" (8–21h)', categoria: 'reporte',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron cada hora; solo despacha si hay algo urgente.',
    ejemplo: `⏰ *Lo urgente* — 14/07\n\n🔴 Cuenta Meta: saldo impago, entrega frenada.\n💸 2 cuotas vencidas — $3.400 por cobrar.\n📉 3 conjuntos con fatiga.\n\nOjo con esto apenas puedas. — MaKo`,
  },
  {
    id: 'reporte-semanal', titulo: 'Reporte semanal (lunes)', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron los lunes a la mañana (hora local del workspace): ads, cierres, CAC, cash, ritmo a la meta.',
    ejemplo: `🗓️ *Reporte semanal* — 07/07 al 13/07\n\n*Ads:* $640 · 92 leads · CPL $6,9 · 4 cierres · CAC $160\n*Cash de la semana:* $12.800\n*Objetivo:* 8/12 cierres · ~6 semanas para la meta\n\nVenís bien. — MaKo`,
  },
  {
    id: 'cierre-mes', titulo: 'Cierre de mes', categoria: 'reporte',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Cron mensual (falta crear) el día 1.',
    ejemplo: `📅 *Cierre de junio*\n\nCash: $48.200 (+18% vs mayo)\nCierres: 11/10 ✅ · CAC $175\nMejor anuncio: "Carrusel resultados" (CPL $4,1)\nPeor: "Reel precio" (CPL $19, para apagar)\n\n¿Te armo el plan de julio? — MaKo`,
  },

  // ── CUENTA / SALUD DE META (semáforo) ──────────────────────────────────────
  {
    id: 'meta-cuenta-frenada', titulo: 'Cuenta Meta deshabilitada / entrega frenada', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'computeAccountHealth() pasa a rojo (diff contra meta_health_history).',
    ejemplo: `🔴 *Pará un segundo.* Tu cuenta de Meta quedó *deshabilitada por saldo impago* y dejó de entregar. Ningún anuncio está corriendo ahora.\n\nRegularizá el pago en el Business Manager y avisame cuando esté para verificar. — MaKo`,
  },
  {
    id: 'meta-cuenta-riesgo', titulo: 'Cuenta Meta en revisión de riesgo (ámbar)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'account_status ∈ {7,8,9}.',
    ejemplo: `🟡 Ojo: tu cuenta de Meta entró en *revisión de riesgo*. Todavía entrega, pero no toques nada raro estos días (no subas presupuestos de golpe ni cambies muchos anuncios). Te aviso si escala a rojo. — MaKo`,
  },
  {
    id: 'meta-cuenta-recuperada', titulo: 'Cuenta Meta recuperada (volvió a verde)', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Severidad pasa de rojo/ámbar a verde (transición).',
    ejemplo: `🟢 Listo, tu cuenta de Meta volvió a *activa* y ya está entregando de nuevo. Se resolvió el tema del pago. Todo en orden. — MaKo`,
  },
  {
    id: 'meta-saldo-agotarse', titulo: 'Saldo por agotarse / problema de pago', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Proyección balance ÷ gasto-por-hora < horas restantes del día.',
    ejemplo: `🟡 Tu saldo en Meta está en *$3 USD*. Al ritmo de hoy se agota antes de la noche y se corta la entrega a mitad de campaña.\n\nCargá saldo o revisá el método de pago para no perder el envión. — MaKo`,
  },
  {
    id: 'meta-token-vencido', titulo: 'Token de Meta vencido (integración caída)', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'graphGet() code 190 → MetaHealthTokenError.',
    ejemplo: `🔴 *Se venció tu token de Meta*. Dejé de poder leer tus campañas y el semáforo quedó ciego. Reconectá la integración en /configuraciones para que todo vuelva a funcionar. — MaKo`,
  },
  {
    id: 'meta-anuncio-rechazado', titulo: 'Anuncio rechazado por políticas de Meta', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'effective_status = DISAPPROVED / WITH_ISSUES.',
    ejemplo: `🔴 Meta *rechazó* el anuncio "Testimonio Ana - v3" por política de contenido. No está entregando.\n\nEditá el creativo o el copy y mandalo de nuevo a revisión. ¿Querés que te diga qué suele disparar este rechazo? — MaKo`,
  },
  {
    id: 'meta-anuncio-espera-aprobacion', titulo: 'Meta retuvo el anuncio esperando tu aprobación', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'issues_info con error_code 2446984 ("peer approval") tras publicar desde MaKo. OJO: NO es rechazo de políticas — es un control de identidad y Meta NO lo deja aprobar por API.',
    ejemplo: `🟡 Publiqué *2 anuncios* en "029. Capta Dueños B2B" pero *Meta los retuvo*: por seguridad pide que un admin de la cuenta los apruebe a mano antes de que empiecen a correr.\n\nNo lo puedo hacer yo — Meta no lo permite por API. Son 30 segundos:\n\n👉 https://adsmanager.facebook.com/adsmanager/manage/ads?act=123&selected_ad_ids=456\n\nEntrás, tocás *Revisar y publicar* y confirmás. Si no, quedan sin entregar. — MaKo`,
  },

  // ── ACCIONES SOBRE ADS (sugerencia + "¿lo hago?") ──────────────────────────
  {
    id: 'ad-fatiga', titulo: 'Conjunto con fatiga → pausar y rotar creativo', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'parcial',
    disparador: 'getFatigaAdsets (spend7d>$50, freq7d>3.5, CPL7d>1.5×CPL28d).',
    ejemplo: `📉 El conjunto "Retargeting 30d" está *fatigado*: frecuencia 4,8 y el CPL subió 40% en 5 días. La gente ya lo vio de más.\n\nTe recomiendo *pausarlo y rotar creativo*. ¿Lo pauso yo? — MaKo`,
  },
  {
    id: 'ad-cpl-disparado', titulo: 'CPL disparado en un anuncio → apagar', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'CPL de un ad > 3× promedio 7d del workspace, ≥2 días.',
    ejemplo: `🔴 El anuncio "Reel gancho precio" viene con un *CPL de $22* — el triple de tu promedio ($7). Está quemando plata sin traer leads buenos.\n\nTe sugiero *apagarlo*. ¿Lo hago? — MaKo`,
  },
  {
    id: 'ad-ganador-escalar', titulo: 'Anuncio ganador → escalar presupuesto', categoria: 'accion',
    prioridad: 'media', semaforo: 'verde', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Ad/adset con CPL muy por debajo del promedio y volumen sostenido.',
    ejemplo: `🟢 Tu caballo ganador: "Carrusel resultados" trae leads a *$4,2* (muy por debajo del promedio) y con volumen.\n\nTe propongo *subirle el presupuesto 20%* para exprimirlo mientras rinde. ¿Le doy? — MaKo`,
  },
  {
    id: 'ad-gastan-sin-leads', titulo: 'Anuncios que gastan sin traer leads → apagar en lote', categoria: 'accion',
    prioridad: 'media', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Varios ads con spend > $80 USD y 0 leads en 7d.',
    ejemplo: `🧹 Encontré *4 anuncios* que gastan sin traer un solo lead en 7 días ($85 tirados). Te los puedo *pausar todos de una*. ¿Le doy? Te paso la lista antes si querés revisar. — MaKo`,
  },
  {
    id: 'ad-gasto-anomalo', titulo: 'Gasto diario anómalo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Gasto del día > 1.5× promedio diario 14d.',
    ejemplo: `🟡 Ojo con el gasto: llevás *$180 hoy* y tu promedio diario es $95. Algo se disparó (¿subiste un presupuesto sin querer?). Revisalo antes de que siga corriendo así toda la noche. — MaKo`,
  },
  {
    id: 'ad-aprendizaje-limitado', titulo: 'Conjunto en aprendizaje limitado', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'learning_stage_info.status = LEARNING_LIMITED.',
    ejemplo: `🟡 El conjunto "Frío intereses" quedó en *aprendizaje limitado*: no junta suficientes conversiones para que Meta optimice bien.\n\nOpciones: subir presupuesto, juntar conjuntos o ampliar público. ¿Te armo las 3 con números? — MaKo`,
  },
  {
    id: 'ad-cuenta-verde-sin-ads', titulo: 'Cuenta verde pero sin anuncios entregando', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Cuenta activa pero 0 ads con effective_status=ACTIVE.',
    ejemplo: `🔴 Che, tu cuenta está verde pero *no tenés ningún anuncio entregando* — todo está en pausa. Si no fue a propósito, estás perdiendo el día entero de leads. ¿Reactivo algo? — MaKo`,
  },
  {
    id: 'tracking-apagado', titulo: 'La landing dejó de mandar datos', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'si',
    // Nace de un caso real: el tracking del VSL estuvo MUERTO 18 días
    // (2026-07-15 → 08-03) con anuncios corriendo y 235 leads entrando a ritmo
    // normal. Ninguna señal de negocio lo detectó, porque los leads seguían
    // llegando por otras vías — lo que se perdió fue la atribución.
    // Falla en silencio por diseño ajeno: el beacon hace fetch().catch(){} y el
    // receptor responde 200 aunque descarte. Este cron es la ÚNICA señal.
    disparador: 'Cron diario: un workspace con landing_token acuñado no registra visitas hace más de 48h.',
    ejemplo: `🔴 Tu landing *dejó de mandarme datos* hace 3 días. Los anuncios siguen corriendo, así que no lo vas a notar en los leads: lo que se pierde es saber de dónde vienen. Suele ser que el código de la landing quedó apuntando a una dirección vieja. — MaKo`,
  },
  {
    id: 'leads-caida', titulo: 'Caída de leads vs promedio del día', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Leads acumulados a esta hora muy por debajo del baseline horario.',
    ejemplo: `🟡 Van *3 leads hoy* y a esta hora solés tener 9. La entrada de leads bajó fuerte. Puede ser saldo, un anuncio caído o el día. Lo estoy mirando y te confirmo la causa. — MaKo`,
  },
  {
    id: 'capi-cierres-no-reportados', titulo: 'Cierres no reportados a Meta (CAPI)', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Ventas cerradas en el CRM sin evento Purchase enviado a Meta.',
    ejemplo: `🟡 Cerraste 2 ventas esta semana pero Meta *no recibió el evento de compra* (CAPI). Sin eso el algoritmo optimiza a ciegas y te consigue peores leads. ¿Activo el envío de conversiones para que aprenda de tus cierres? — MaKo`,
  },

  // ── REUNIONES / CRM ────────────────────────────────────────────────────────
  {
    id: 'reunion-recordatorio', titulo: 'Recordatorio de reunión próxima', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron reunion-recordatorio (cada 10 min): junta_1_at/junta_2_at a menos de 30 minutos, con el lead abierto y la asistencia sin marcar. Una marca por reunión evita repetirlo.',
    ejemplo: `⏰ En 30 min tenés la *R2* con *Francisco Ramos* (Dental Ramos).

De la charla anterior quedó sin resolver: “Lo tengo que ver con mi socio”
Y habías quedado en: mandarle la propuesta con las dos opciones de plazo

👉 Mirá el resumen del lead:
https://tu-app/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-agenda-dia', titulo: 'Agenda del día (juntas de hoy)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Cron matutino: reuniones del día desde junta_at.',
    ejemplo: `🗓️ *Tu día*: 3 reuniones.\n10:00 R1 Ana López\n12:30 R2 BG Trucking\n16:00 R1 Sergio Esquer\nTodas con link cargado. — MaKo`,
  },
  {
    id: 'reunion-nuevo-agendado', titulo: 'Nuevo lead que agendó reunión', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Webhook Calendly invitee.created.',
    // Decía «la ficha ya quedó armada en el CRM» y no daba el link: mandaba a
    // buscarla a mano justo cuando el dato recién llegó y es más fácil de mirar.
    ejemplo: `🎯 *Nuevo agendado*: Juan Pérez reservó una *R1 para el jueves 16 a las 11:00*. Vino del anuncio "VSL testimonios".

👉 Mirá el resumen del lead:
https://tu-app/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-cancelada', titulo: 'Reunión cancelada/reagendada → reacomodar', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'si',
    disparador: 'Webhook Calendly invitee.canceled.',
    ejemplo: `🔄 *Se canceló* la R1 con Mariela Gómez que era para el jueves 16 a las 11:00 y todavía no reagendó.

Si conseguís otro horario, decime *«reagendale la R1 a Mariela Gómez»* y te busco los huecos libres.

👉 Mirá el resumen del lead:
https://tu-app/crm/482/resumen

— MaKo`,
  },
  {
    id: 'reunion-ocurrio-fathom', titulo: 'Reunión ocurrió / grabación lista (Fathom)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    // ⚠️ Sale DESPUÉS del Closing Analyst, no cuando cae el webhook. Antes era una
    // 'pregunta' («¿te paso el resumen y las objeciones acá?») disparada en el
    // instante del webhook: en ese momento el análisis todavía no había corrido,
    // así que no había resumen que pasar, y la respuesta del dueño no la escuchaba
    // nadie. El link reemplaza la pregunta — ver app/api/webhooks/fathom/route.ts.
    disparador: 'Webhook Fathom, dentro del after(): cuando el Closing Analyst terminó de analizar la llamada y MaKo dejó el follow-up como borrador.',
    ejemplo: `✅ Terminó la *R1 con Sergio Esquer* (42 min).

*Avanza a propuesta*
Quedaron 2 objeciones sin resolver.
Próximo paso: mandarle el caso de éxito de logística y confirmar la R2

👉 Mirá el resumen de la llamada:
https://tu-app/crm/482/resumen

Y te dejé el mensaje de seguimiento escrito y listo para mandarle, en /whatsapp.

— MaKo`,
  },
  {
    id: 'reunion-compromisos-tareas', titulo: 'Compromisos de la reunión → cargar tareas', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'parcial',
    disparador: 'plan-fathom extrae action items del transcript (G3).',
    ejemplo: `📝 De la reunión con BG Trucking saqué *3 compromisos tuyos*:\n1. Enviar propuesta antes del viernes\n2. Mandar caso de éxito de logística\n3. Agendar R2\n\n¿Los cargo como tareas en tu tablero? — MaKo`,
  },
  {
    id: 'reunion-tareas-al-plan', titulo: 'Reunión de equipo nueva → tareas esperando confirmación', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Cron fathom-plan: caen grabaciones nuevas de reuniones de EQUIPO, MaKo las lee y deja los borradores pendientes en el plan. UN aviso por corrida, no uno por reunión.',
    ejemplo: `📝 Leí tus *3 reuniones* nuevas:\n\n• *Sync semanal* — mié 28 jul · 15:30\n   4 tareas tuyas · 3 de otros\n• *Mau <> Martín* — mié 28 jul · 18:00\n   3 tareas tuyas · 4 de otros\n• *Revisión de ads* — jue 29 jul · 10:15\n   4 tareas tuyas · 3 de otros\n\nEn total *11 tareas tuyas* (y 10 de los demás, para repartir), todas esperándote en la misma pantalla:\nhttps://tu-app/plan\n\nEntrás una vez, revisás todo junto y con un toque quedan cargadas. — MaKo`,
  },
  {
    id: 'tareas-autocompletadas', titulo: 'MaKo cerró tareas que ya estaban hechas', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'si',
    disparador: 'Corrida diaria de señales (cron tareas-verificar) + al abrir /plan. UN aviso por día por workspace, agrupando todas las que cerró — nunca uno por tarea.',
    ejemplo: `✅ Cerré *3 tareas* de tu plan que ya estaban hechas:

• *Conectar WhatsApp* — tu número ya está vinculado
• *Conectar Fathom* — ya está conectado
• *Cargar el funnel* — ya está cargado en MaKo

Si alguna no está lista, abrila y reabrila: no la vuelvo a tocar.
https://tu-app/plan — MaKo`,
  },
  {
    id: 'reunion-no-show', titulo: 'No-show → sugerir seguimiento', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'junta_at pasada sin grabación Fathom ni asistencia marcada.',
    ejemplo: `🔴 *No-show*: Ana López no se presentó a la R1 de las 10:00. Le puedo mandar un WhatsApp para reagendar antes de que se enfríe.\n\n¿Te escribo el borrador? — MaKo`,
  },

  // ── LEADS / WHATSAPP / NUTRICIÓN ───────────────────────────────────────────
  {
    id: 'lead-formulario-meta', titulo: 'Lead entrante por formulario de Meta', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Webhook meta-leads: lead de Lead Ads sin agendar.',
    ejemplo: `📥 Entró un lead por formulario de Meta: *Carla Méndez*, campaña "Lead Magnet PDF". Todavía no agendó.\n\n¿Le disparo la nutrición de bienvenida por WhatsApp? — MaKo`,
  },
  {
    id: 'wa-mensaje-entrante', titulo: 'Mensaje de WhatsApp entrante (al dueño)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'Webhook Chatwoot: mensaje entrante (detectar por dirección).',
    ejemplo: `💬 *Mensaje nuevo* de Carla (+52 686 399…): "Hola, ¿sigue disponible la promo?". Lleva 12 min sin respuesta. — MaKo`,
  },
  {
    id: 'wa-desconectado', titulo: 'WhatsApp de empresa desconectado', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Sesión Evolution o inbox Chatwoot caído / QR expirado.',
    ejemplo: `🔴 *Se cayó tu WhatsApp no oficial* (el número por QR). Dejó de recibir y mandar hace 15 min — los leads que escriben ahora no llegan a nadie. Reconectá escaneando el QR de nuevo. — MaKo`,
  },
  {
    id: 'wa-sin-responder', titulo: 'Conversaciones sin responder hace X horas', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Chatwoot: conversaciones con último entrante sin respuesta > umbral.',
    ejemplo: `🟡 *3 conversaciones sin responder* hace más de 2 horas. La más caliente: Juan, que preguntó precio. Cada hora que pasa baja la chance de cierre.\n\n¿Te dejo borradores de respuesta para que apruebes? — MaKo`,
  },
  {
    id: 'plantilla-estado', titulo: 'Plantilla aprobada/rechazada por Meta', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'Poll de estado de plantillas de WhatsApp.',
    ejemplo: `✅ Meta *aprobó* tu plantilla "nutricion_bienvenida". Ya la podés usar para abrir conversación fuera de la ventana de 24h. — MaKo`,
  },
  {
    id: 'nutricion-agotada', titulo: 'Nutrición agotada → lead frío', categoria: 'pregunta',
    prioridad: 'baja', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Lead completó todos los toques sin responder/agendar.',
    ejemplo: `🟡 Carla terminó la secuencia de nutrición (5 toques) sin responder ni agendar. La marco como *fría*, salvo que quieras un último intento manual con un mensaje distinto. ¿La dejo o le doy una más? — MaKo`,
  },
  {
    id: 'nutricion-frenada', titulo: 'Nutrición frenada por error técnico', categoria: 'aviso',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Cola de nutrición con mensajes sin salir (token/ventana).',
    ejemplo: `🔴 La nutrición se *frenó sola*: 8 mensajes quedaron en cola sin salir (parece que expiró el token de WhatsApp). Nadie está recibiendo follow-up ahora. Revisá la conexión en /configuraciones. — MaKo`,
  },

  // ── COBRANZA / CASH ────────────────────────────────────────────────────────
  {
    id: 'cuota-vencida', titulo: 'Cuota vencida → cobrar', categoria: 'accion',
    prioridad: 'alta', semaforo: 'rojo', requiereRespuesta: true, yaImplementado: 'parcial',
    disparador: 'getCuotasPendientes.vencidas.',
    ejemplo: `💸 *Cobranza*: la cuota 2 de Vértice venció hace 3 días — *$1.700 sin cobrar*. Conviene mandarle el recordatorio hoy antes de que se estire más.\n\n¿Te escribo el mensaje de cobro? — MaKo`,
  },
  {
    id: 'cuota-por-vencer', titulo: 'Cuota por vencer (recordatorio proactivo)', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Cuota con vencimiento en 24–48h.',
    ejemplo: `🟡 Mañana vence la cuota 3 de Dental Ramos ($1.500). Avisale hoy y te ahorrás perseguirlo después. ¿Preparo el recordatorio? — MaKo`,
  },
  {
    id: 'pago-recibido', titulo: 'Pago recibido / cash collected', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Se registra un pago (cierre o cuota cobrada).',
    ejemplo: `💰 *Entró plata*: pago de Aspro por *$2.300*. Cash del mes: $14.600 — vas 68% de la meta. Bien ahí. — MaKo`,
  },
  {
    id: 'cierre-venta', titulo: 'Cierre de venta nuevo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Motor CRM marca un lead como ganado.',
    ejemplo: `🎉 *Cierre nuevo*: BG Trucking firmó por *$4.500*. Van 4 cierres este mes, te falta 1 para la meta. Fenómeno. — MaKo`,
  },

  // ── METAS / RETRO / INSIGHTS ───────────────────────────────────────────────
  {
    id: 'retro-lista', titulo: 'Retro semanal lista (con PDF)', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'si',
    disparador: 'retro-pipeline genera la retro de la semana.',
    ejemplo: `🪞 Tu *Retro de la semana* está lista: qué funcionó, qué no y 3 focos para la que viene. Te la mando en PDF acá mismo 👇\n\n¿O preferís que te la resuma en un mensaje? — MaKo`,
  },
  {
    id: 'objetivo-en-riesgo', titulo: 'Objetivo/meta en riesgo por ritmo', categoria: 'accion',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'getObjetivoProgreso.semanas_estimadas > objetivo temporal.',
    ejemplo: `🟡 Al ritmo actual llegás a la meta de cierres en *~9 semanas*, y tu objetivo era 6. Estás corto. ¿Armamos un plan para acelerar (más presupuesto en el ganador o más R1 por semana)? — MaKo`,
  },
  {
    id: 'meta-alcanzada', titulo: 'Meta alcanzada (celebración)', categoria: 'aviso',
    prioridad: 'baja', semaforo: 'verde', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Cierres o cash del período cruzan la meta.',
    ejemplo: `🏆 *¡Meta cumplida!* Llegaste a los 10 cierres del mes con $23.000 de cash, y 4 días antes de tiempo. Tremendo. ¿Subimos la vara para el mes que viene? — MaKo`,
  },
  {
    id: 'sugerir-experimento', titulo: 'Sugerir nuevo experimento', categoria: 'accion',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'MaKo detecta un patrón (ángulo/creativo/público) que amerita un test.',
    ejemplo: `🧪 Mirando tus datos, tus mejores leads vienen del ángulo "tiempo", no "precio". Te propongo un *A/B de creativos* con ese gancho la semana que viene. ¿Lo arranco? — MaKo`,
  },
  {
    id: 'closing-objecion', titulo: 'Closing Analyst: objeción recurrente', categoria: 'pregunta',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'lib/closing detecta patrón de objeciones en las llamadas.',
    ejemplo: `🎧 Analicé tus últimas 6 llamadas de venta. La objeción que más te frena es *"lo tengo que consultar con mi socio"* (4 de 6). Te preparé una forma de adelantarte a eso en la R1. ¿Te la paso? — MaKo`,
  },
  {
    id: 'script-ganador', titulo: 'Ads Analyst: guion ganador por retención', categoria: 'accion',
    prioridad: 'baja', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'lib/ads-analyst cruza retención por cuartiles con guiones.',
    ejemplo: `📽️ De tus video ads, el que mejor retiene es "Historia cliente": 62% llega al segundo 30. El gancho de precio pierde al 40% en los primeros 5 seg. Conviene *clonar la estructura del ganador*. ¿Armamos un guion nuevo con ese molde? — MaKo`,
  },

  // ── OPERACIÓN / SALUD DEL SISTEMA ──────────────────────────────────────────
  {
    id: 'datos-sin-marcar', titulo: 'Datos sin marcar en el CRM', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'parcial',
    disparador: 'getPendientesDeMarcar ≥ umbral (configurable).',
    ejemplo: `📝 Tenés *7 datos sin marcar* en el CRM (reuniones sin resultado, leads sin calificar). Cinco minutos ahora te ordenan las métricas de la semana. ¿Te paso la lista para resolverlos rápido? — MaKo`,
  },
  {
    id: 'cron-ingesta-fallo', titulo: 'Cron de ingesta falló', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Un cron de ingesta (meta/panda/youtube-daily) falla tras reintentos.',
    ejemplo: `🔴 La *ingesta de Meta de anoche falló* (2 intentos). Tus números de hoy pueden estar desactualizados. Ya reintenté; si vuelve a fallar te aviso de nuevo. — MaKo`,
  },
  {
    id: 'saldo-ia-bajo', titulo: 'Saldo de IA de MaKo bajo', categoria: 'aviso',
    prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'Saldo prepago de IA bajo (se lleva manual).',
    ejemplo: `🟡 Tu *saldo de IA* de MaKo está en $4. Cuando se agote dejo de poder generar reportes, nutrición y análisis. Recargá cuando puedas para no cortar el servicio. — MaKo`,
  },
  {
    id: 'accion-confirmada', titulo: 'Confirmación tras ejecutar una acción aprobada', categoria: 'aviso',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: false, yaImplementado: 'no',
    disparador: 'El dueño respondió "sí" a una acción y MaKo la ejecutó.',
    ejemplo: `✅ Hecho. Pausé el conjunto "Retargeting 30d" y quedó registrado. Si el CPL no mejora en 48h te aviso para rotar creativo. — MaKo`,
  },

  // ── DRIVE (el caso que pediste arrancar) ───────────────────────────────────
  {
    id: 'ads-grabaste', titulo: 'Recordatorio: ¿grabaste los anuncios pedidos?', categoria: 'pregunta',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'Tarea "grabar anuncios" creada y vencida sin material subido.',
    ejemplo: `🎬 ¿Ya grabaste los *3 anuncios nuevos* que quedamos la semana pasada? Cuando los tengas, pasame el *link de la carpeta de Drive* y los tomo de ahí directo: te armo la campaña *en pausa* para que solo revises y publiques. — MaKo`,
  },
  {
    id: 'drive-campana-armada', titulo: 'Campaña armada desde Drive (en pausa)', categoria: 'accion',
    prioridad: 'media', semaforo: 'na', requiereRespuesta: true, yaImplementado: 'no',
    disparador: 'MaKo tomó los creativos de la carpeta de Drive y armó la estructura.',
    ejemplo: `📦 Tomé los *4 creativos* de tu carpeta de Drive y te armé una campaña *"Julio - Testimonios"* con 2 conjuntos, toda *en PAUSA*. Revisala en /ads-manager: si te gusta, la publicás vos. ¿Querés que te resuma cómo quedó? — MaKo`,
  },
];

/** Agrupa el catálogo por categoría, respetando el orden de aparición. */
export function catalogoPorCategoria(): Record<CategoriaAviso, AvisoCatalogo[]> {
  const out: Record<CategoriaAviso, AvisoCatalogo[]> = { reporte: [], aviso: [], accion: [], pregunta: [] };
  for (const a of CATALOGO_AVISOS) out[a.categoria].push(a);
  return out;
}
