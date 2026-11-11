# Análisis de los anuncios en «Tu negocio»: mensajes, VSL con llamada, formulario, compra directa y la máquina de contenido

> Relevo de los cursos de Knowledge (11/11/2026) para el rediseño de Marketing CoPilot. Pedido de Martín: la pestaña Anuncios no copia la Biblioteca de anuncios; es un ANÁLISIS por tipo de funnel con anuncios, con los puntos que hay que tocar según los cursos y feedback en cada uno. Además, la «máquina de contenido» de anuncios.
> Construye sobre `funnels/mensajes-formulario.md`, `funnels/vsl-llamada.md`, `funnels/compra-directa.md`, los dos `netlab-*` y `funnels-simples.md`. No repite lo de ahí (cuándo sirve cada funnel, preguntas de entrada, cifras de cierre y presupuesto); aquí va lo que MaKo debe REVISAR en lo que la persona ya tiene.
> Fuentes como «curso (slug) · n — título corto»; para THE NET LAB, «programa-meta-ads-the-net-lab · NN». Las cifras son de cada docente, sin auditar, y casi todos venden formación. Los ejemplos de feedback de MaKo van en tú, y sus números son ilustrativos, no datos de una cuenta.

## 0. Qué dato tiene MaKo hoy y qué no (condiciona todo lo demás)

**Sí lo tiene:**
- **Sus anuncios, por la conexión con Meta.** `lib/meta-ads.ts` (`parseInsightsToMetrics`) guarda por anuncio y por día: gasto, impresiones, alcance, frecuencia, clics en enlace, vistas de landing, leads (formulario instantáneo), «agendas» (conversión personalizada), vistas de video a 3 s, thruplay y cuartiles de retención. Además lee en vivo la campaña, el conjunto, el público y los textos (`ver_datos_campana_meta`, `ver_publico_conjunto_meta`, `ver_textos_anuncio_meta`) y la transcripción del anuncio (`ver_transcript_anuncio`).
- **El guion de cada anuncio clasificado:** ángulo, avatar, tipo de gancho y formato (`lib/ads-analyst.ts`, `lib/script-angles.ts`, `lib/script-avatares.ts`).
- **Sus chats de WhatsApp, pero sólo por dos puertas:** (a) el Dashboard cuenta cada vez que alguien escribe, si le respondieron y en cuánto, y **nunca lee el texto**; (b) el Asesor de WhatsApp lee el texto de UNA conversación (hasta 20 turnos de `wa_mensajes`) cuando alguien la abre.
- **Su página:** el copy (`lib/landing-analyst.ts`), las visitas, los clics y la retención del video por minuto (`ver_retencion_video_landing`).

**No lo tiene (y cambia lo que MaKo puede prometer):**
1. **Conversaciones iniciadas ni costo por conversación.** El sincronizador no guarda esa acción de Meta. Para «anuncios a mensajes» la métrica de arriba del funnel no llega: MaKo debe decir «sin dato» o pedirla, nunca estimarla.
2. **Compras ni valor de compra** (ni ROAS ni costo por compra) en la tabla sincronizada. Para «compra directa» el costo por compra real depende de otra fuente (la plataforma de venta o la propia página); hoy sólo hay clics, vistas de landing y lo que mida el Pixel de MaKo.
3. **Análisis del texto de los chats en lote.** No existe «lee mis últimas 200 conversaciones y dime qué preguntan y dónde se caen». Hay las piezas (`wa_mensajes`, el modelo del Asesor) pero no el barrido. Es el trabajo grande de «anuncios a mensajes».
4. **Transcripción del video de la landing.** Se transcribe el anuncio y el reel (`lib/spy-transcripcion.ts`, `lib/transcribe.ts`); no encontré que se aplique al video del VSL. Sin eso el feedback del guion del VSL queda en el copy de la página y en la curva de retención.
5. **La metodología de anuncios en el conocimiento.** `mako_knowledge` tiene el área `ads` prevista y vacía; sólo está sembrado `mensajes` (Levanta Muertos). MaKo no «sabe» hoy lo de este documento.

Regla general: **MaKo juzga contra la oferta y el funnel de la persona**, no contra «buenas prácticas». Y un dato ausente no es cero (regla de `lib/ads-rendimiento.ts` y `lib/vsl-retencion.ts`).

---

## 1. Qué revisa MaKo en cada tipo de funnel

Para cada tipo, abajo van sólo los puntos propios del destino (chat, video con agenda, formulario, página de compra). El anuncio en sí (gancho, ángulo, texto, CTA, públicos, presupuesto, fatiga, métricas) se revisa igual para los cuatro y está en la sección 2.

### 1.1 Anuncios a mensajes

**M1. El anuncio avisa que abre un chat y el destino funciona.**
- *Lee:* el botón y el texto del anuncio, el destino configurado y si llegan mensajes con el gasto que hay (`ver_textos_anuncio_meta`, `ver_datos_campana_meta`).
- *Se juzga:* con gasto y cero mensajes, casi siempre el problema es que el anuncio no persuade; antes se descarta un error técnico (WhatsApp Business mal conectado, número equivocado). Hay que darle más tiempo a una campaña recién prendida con poco gasto. formula-ventas-ilimitadas-2024 · 89 — No me llegan mensajes. El CTA debe pedir la acción concreta («escríbenos ahora»). formula-ventas-ilimitadas-2024 · 38 — Estructura de anuncios de video.
- *Ejemplo:* «Llevas dos días y 12 dólares gastados sin un solo mensaje. Es pronto para apagar: dale más tiempo y más gasto. Mientras tanto, abre el enlace del botón y confirma que cae en tu WhatsApp Business».

**M2. Cuántos mensajes llegan y a qué costo.**
- *Lee:* hoy NO tiene la conversación iniciada (sección 0, punto 1). Lo que sí ve: gasto, clics en enlace y, en Dashboard, los mensajes recibidos por día.
- *Se juzga:* se miran mensajes por día, por semana y por mes, y el costo por conversación; bajar ese costo a la mitad duplica los mensajes con el mismo dinero. formula-ventas-ilimitadas-2024 · 35 — Métricas y seguimiento.
- *Ejemplo:* «No puedo ver cuántas conversaciones te generó cada anuncio. Sí veo que el WhatsApp recibió 41 mensajes esta semana y que gastaste 90 dólares. Si me dices cuántos eran personas nuevas, calculo tu costo por conversación».

**M3. Rapidez de la primera respuesta.**
- *Lee:* Dashboard «Chat Analyst»: mediana, el 10 % más lento (p90) y el porcentaje respondido en menos de 15 minutos, por setter y por día.
- *Se juzga:* un lead se enfría en unos 8 minutos y hay que responder cada mensaje, no sólo el primero (formula-ventas-ilimitadas-2024 · 58 — 7 leyes en WhatsApp); más de 30 minutos ya es demora, y si hay muchos clientes se contrata a alguien (vender-por-fb-e-ig-ads · 172 — Buenas prácticas WhatsApp). La vara de MaKo ya es 15 minutos (`META_MINUTOS`, `lib/chat-diseno.ts`).
- *Ejemplo:* «Tu mediana es 4 minutos, pero tu respuesta más lenta llega a 18 horas. Esos chats lentos son los que se pierden: te escribieron el viernes por la noche y los contestaste el lunes».

**M4. La primera respuesta: persona, pregunta y producto.**
- *Lee:* el texto de la primera respuesta del negocio en cada chat (hoy: sólo con el Asesor, de a una conversación).
- *Se juzga:* se presenta con nombre y pregunta qué necesita (vender-por-fb-e-ig-ads · 171 — Ciclo de ventas en WhatsApp); cada mensaje termina en una pregunta; se contesta lo que preguntó (si pidió un producto, no se manda el catálogo); no se pegan plantillas sin leer. formula-ventas-ilimitadas-2024 · 58.
- *Ejemplo:* «En 9 de tus últimos 10 chats la persona preguntó el precio de un servicio y tu primera respuesta fue el catálogo completo. Contesta el precio del servicio por el que escribió y cierra con una pregunta».

**M5. La charla descubre antes de ofrecer.**
- *Lee:* el desarrollo de los chats que terminaron en compra o agenda frente a los que se cayeron (texto).
- *Se juzga:* por etapas: presentación (necesidad y problema), evaluación (fotos o casos de éxito, autoridad), conversión (pasos claros de pago y entrega, un paso por vez) y recompra. vender-por-fb-e-ig-ads · 171. Si la venta pasa a una llamada, el chat debe cubrir dónde está la persona, dónde quiere llegar y qué se lo impide. bluehacker · 21 — Situación actual, deseada y obstáculo.
- *Ejemplo:* «En los chats donde se cerró, preguntaste qué había intentado antes. En los que se cayeron, pasaste directo al precio. Prueba esa pregunta en todos».

**M6. Seguimiento a quien no compró.**
- *Lee:* los chats cuyo último mensaje es del lead sin contestar (`sin_responder` del Dashboard) o del negocio sin respuesta; el Asesor ya redacta el mensaje.
- *Se juzga:* preguntar a quien no compró qué le disgustó y a quien compró cómo le fue; el momento ideal es justo tras la compra o una queja. vender-por-fb-e-ig-ads · 172. La reactivación sigue Levanta Muertos (reconectar con el contexto, aportar valor, una sola pregunta con salida digna): `lib/mako-knowledge-seed.ts`.
- *Ejemplo:* «Tienes 23 chats donde la última palabra fue tuya hace más de 3 días. Preparé un mensaje distinto para cada uno».

**M7. El cierre no depende de una sola persona.**
- *Lee:* Dashboard «Por setter» (mensajes recibidos y porcentaje respondido en 15 minutos); el cierre por agente sale del CRM.
- *Se juzga:* se mide el cierre de cada agente; una diferencia grande (el ejemplo del curso: 2 % contra 15 a 20 %) es una alarma, y las comisiones por venta mantienen la meta. formula-ventas-ilimitadas-2024 · 35.
- *Ejemplo:* «Ana cierra el 18 % de sus chats y Luis el 3 %. Revisa los chats de Ana: es lo que tienes que copiar».

**M8. Lo que la gente pregunta en el chat alimenta los próximos anuncios.**
- *Lee:* las preguntas y objeciones repetidas en los chats (no existe el barrido: sección 0, punto 3).
- *Se juzga:* entender dolores y motivaciones del cliente por conversación es lo que mejora la venta y revela qué agrega valor (vender-por-fb-e-ig-ads · 172); las objeciones se mapean para armar anuncios que las contesten (programa-meta-ads-the-net-lab · 52); las razones de compra son problemas concretos (anuncio-ganador · 6 — Día 3 · Sala VIP). Son las razones de la sección 3 sacadas del dato real.
- *Ejemplo:* «Cinco personas distintas preguntaron si el servicio sirve sin experiencia previa. Es una razón de compra: haz un anuncio sólo para esa duda».

**Qué se puede reusar del Dashboard.** La hoja «Chat Analyst» (`lib/graficos-plantillas-analysts.ts`, plantilla `CHAT`; dibujo en `app/dashboard/disenos/HojaChat.tsx` con `lib/chat-diseno.ts`) responde «¿cuánto tardamos en contestar?»: mensajes recibidos y chats, respondidos, respondidos en 15 minutos, mediana y p90, esperando, por día, por tipo de mensaje y por setter, más la tasa de respuesta por automatización. Todo sale de la fuente `conversaciones` y `whatsapp` (`lib/graficos-fuentes-extra.ts`). Sirve tal cual para M3, M6 (esperando) y M7. No sirve para M4, M5 y M8: **nunca lee el texto**. Esa hoja tiene al pie una caja de MaKo («Dónde se enfría el chat») que nace sin correr: es el lugar natural donde enchufar el barrido de texto.

### 1.2 Anuncios a VSL con llamada

**V1. El anuncio filtra y promete lo mismo que el video.**
- *Lee:* la transcripción del anuncio y el copy de la página (`ver_transcript_anuncio`, `lib/landing-analyst.ts`).
- *Se juzga:* arriba de la página va un filtro al nicho para que el curioso se vaya (sell-your-knowledge · 59 — Armado de landing); si anuncio, página y video no dicen lo mismo, el costo sube (relevo previo: bluehacker · 231). El guion es la fuente de verdad de la página: lo que el video no dice no va en la página. vsl-landing · 6 — Auditar antes de escribir (método de Martín).
- *Ejemplo:* «Tu anuncio habla de bajar costos de logística y tu video empieza con ventas por internet. La persona siente un cambio de tema. Alinea los dos».

**V2. Los primeros minutos: interrupción, beneficio y promesa creíble.**
- *Lee:* sólo el copy y la retención (falta la transcripción: sección 0, punto 4).
- *Se juzga:* abrir con algo que rompa el patrón y el beneficio deseado, y nombrar un plazo corto para la explicación (bluehacker · 313 — Copywriting de VSL). Empezar por la gran promesa en uno o dos minutos como máximo, ambiciosa pero creíble para ESE público (growing-amg · 64 — Cómo crear un VSL).
- *Ejemplo:* «Tu video tarda casi 3 minutos en decir qué logra tu servicio. En ese punto ya se fue el 40 % de quienes le dieron play. Pasa la promesa al primer minuto».

**V3. La estructura del guion completa.**
- *Lee:* el guion (copy o transcripción) y los bloques de `lib/vsl-estructuras.ts`.
- *Se juzga:* diez pasos en tres partes: promesa, resultados, para quién es, quién eres, nueva oportunidad y mecanismo, uno a tres puntos clave, por qué la competencia no sirve, por qué ahora, requisitos y llamada a la acción (growing-amg · 64). La versión del otro curso añade la empresa con resultado garantizado, la objeción del dinero, la garantía, la justificación lógica del método y una llamada suave con nombre propio (bluehacker · 313). Sirve el que mejor encaje con la oferta; lo que falta, MaKo lo marca.
- *Ejemplo:* «Tu VSL tiene promesa, método y precio, pero no dice para quién NO es ni da una garantía. Sin eso, quien agenda llega con dudas».

**V4. Duración y caída de la gente.**
- *Lee:* la retención del video por minuto (`ver_retencion_video_landing`), con los bloques del guion (`lib/vsl-retencion.ts`, `corteDeSegundo`).
- *Se juzga:* los cursos no coinciden en el largo (sección 5). El criterio de MaKo es el punto donde se cae el espectador y qué bloque empieza ahí, no un largo ideal. Estructura de referencia: introducción de 2 a 5 minutos, contenido de 10 a 45, llamada a la acción de 3 a 10 (growing-amg · 64).
- *Ejemplo:* «El 55 % se queda hasta el minuto 6; después baja de golpe cuando empieza la oferta. Adelanta una prueba antes de esa parte».

**V5. Calificar durísimo: para quién es y para quién no.**
- *Lee:* el guion y las preguntas del formulario de agenda.
- *Se juzga:* decir con claridad el perfil que se busca y el que no, para atraer buenos clientes y dejar ir los malos (growing-amg · 64); el formulario de aplicación por secciones ordena a los candidatos (masteryhaus · 120 — Formulario de aplicación).
- *Ejemplo:* «Tu formulario no pregunta cuánto factura el negocio. Con eso podrías pasar primero a quienes pueden pagar tu servicio».

**V6. Qué pasa después de agendar.**
- *Lee:* si hay página de confirmación con video y el porcentaje de asistencia a llamadas.
- *Se juzga:* una página de preparación con un video más específico ayuda a que la gente asista (sell-your-knowledge · 59). Cifras de asistencia y de cierre: en `funnels/vsl-llamada.md`.
- *Ejemplo:* «Agendan 20 y se presentan 8. Tu página de confirmación no tiene video; agrega uno de 3 minutos con las reglas de la llamada».

**V7. La llamada misma (cuando MaKo tiene la grabación).**
- *Lee:* las llamadas analizadas del Closing Analyst.
- *Se juzga:* no cerrar antes de diagnosticar: situación actual, deseada y brecha; no reaccionar a las respuestas; guiar sin pelear; el guion es una estructura, no un texto (sell-your-knowledge · 75 — Guion de ventas).
- *Ejemplo:* «En tus últimas 6 llamadas diste el precio antes de preguntar qué había intentado antes la persona».

**V8. Más de un VSL.**
- *Lee:* cuántos videos de venta distintos tiene la persona.
- *Se juzga:* un VSL es un activo de ventas; tener varios, y salir con uno a tres por semana, aumenta la exposición (growing-amg · 64). Sin perfeccionismo: se graba con laptop y celular.
- *Ejemplo:* «Tienes un solo video para todo tu tráfico. Graba una segunda versión que hable al otro tipo de cliente».

Reglas de Martín que MaKo puede reusar para juzgar un guion corto (no son de un curso externo): picante en las preguntas, cero repetición, un solo concepto por video, objeciones con entrada directa y sin jerga (`app/conocimientos/curso-vsl.ts`, clase 1). Lo visual de esa clase (fondo blanco, voz de IA, marca de agua) es del video de MaKo, no de un cliente.

### 1.3 Anuncios a formulario

**F1. Con cuánta fricción llega el contacto.**
- *Lee:* si el formulario es el instantáneo de Meta (con o sin pantalla de revisión) o una página propia, y cuántas preguntas tiene (`proponer_crear_formulario_meta` admite hasta 5 propias y «mayor intención»).
- *Se juzga:* el curioso y el comprador se separan por lo que cuesta llegar: un formulario con código de verificación al teléfono o varios pasos filtra mejor que uno que se llena sin pensar (anuncio-ganador · 5 — Día 3 · Reto). Un contacto gratis sin ninguna fricción atrae gente que no compra (anuncio-ganador · 4 — Día 2 · Sala VIP).
- *Ejemplo:* «Tu formulario pide nombre, correo y teléfono, y los tres vienen autocompletados. Activa la pantalla de revisión y verifica el teléfono: tendrás menos contactos, pero con más intención».

**F2. Las preguntas filtran lo que te importa.**
- *Lee:* las preguntas del formulario y las respuestas guardadas en el CRM (`ver_base_formulario_meta`, leads).
- *Se juzga:* separar en secciones; preguntar lo que define si cumple (tipo de negocio, antigüedad, qué vende, ticket); terminar el formulario si no es el tipo de cliente; una pregunta abierta para sacar datos cualitativos (masteryhaus · 120). Las preguntas pueden medir criterio, compromiso y capacidad de inversión (la-universidad-del-closer · 41 — Caso de estudio I, que es de reclutamiento pero sirve de modelo).
- *Ejemplo:* «El 70 % de tus contactos del mes escribió "otro" en el tipo de negocio. Cambia esa pregunta a opciones y manda a otra salida a quien no encaja».

**F3. Cuántos contactos sirven.**
- *Lee:* leads por anuncio, agendas y cierres del CRM (`ver_rendimiento_anuncios`).
- *Se juzga:* la vara de MaKo es 10 resultados por versión para dar una señal por válida y apagar a los 80 dólares sin un lead tras al menos 4 días (`RECON_LEADS_VALIDACION`, `RECON_SPEND_SIN_LEADS_USD`, de la metodología de anuncio-ganador). Lo que cuenta es el contacto calificado, no el barato (relevo previo: vender-por-fb-e-ig-ads · 76).
- *Ejemplo:* «El anuncio B tiene 14 leads a 3 dólares y ninguna agenda. El anuncio A tiene 6 a 9 dólares y 3 agendas. El barato no es el bueno».

**F4. Rapidez del primer contacto.**
- *Lee:* Dashboard «Velocidad de llamada» (`app/dashboard/disenos/HojaVelocidad.tsx`, `lib/velocidad-diseno.ts`): cuánto tardó una persona del negocio en escribir o llamar a cada lead nuevo.
- *Se juzga:* mismo principio que en mensajes: la intención se enfría. Metas y número de intentos: `funnels/mensajes-formulario.md` §2.
- *Ejemplo:* «Tus leads esperan 19 horas de mediana hasta el primer contacto. Los de la mañana de martes siguen sin llamada».

**F5. La promesa del anuncio coincide con lo que pide el formulario.**
- *Lee:* texto del anuncio y título del formulario.
- *Se juzga:* es la misma regla de coherencia del VSL: un cambio de tema genera abandono (relevo previo, bluehacker · 231).
- *Ejemplo:* «El anuncio habla de una consulta gratis y el formulario pide 12 datos. Acorta o cambia la promesa».

### 1.4 Anuncios a compra directa

**C1. La página sigue la promesa del anuncio, con un solo producto.**
- *Lee:* el copy de la página (`lib/landing-analyst.ts`) y el producto que muestra el anuncio.
- *Se juzga:* la página debe mostrar el producto del anuncio y no un catálogo, y tener pocas variaciones; un anuncio apunta a un solo producto (formula-ventas-ilimitadas-2024 · 95 — 12 leyes de una página de venta).
- *Ejemplo:* «Tu anuncio muestra un reloj negro y la página muestra veinte relojes. Manda el anuncio a la página de ese reloj».

**C2. La página está pensada para el celular.**
- *Lee:* la página renderizada.
- *Se juzga:* es la primera ley de ese curso: la gran mayoría de las visitas desde un anuncio llega por celular, y en la primera pantalla deben verse foto, titular, beneficios y urgencia (formula-ventas-ilimitadas-2024 · 95). Diseño móvil primero para todos los anuncios también en programa-meta-ads-the-net-lab · 62.
- *Ejemplo:* «En el celular, tu botón de compra queda debajo de tres pantallas de texto. Súbelo al primer pantallazo».

**C3. Beneficios, dolores, características, urgencia, fotos y envío.**
- *Lee:* las secciones de la página.
- *Se juzga:* cada sección que el curso pide: beneficios y dolores arriba (cómo la característica se vuelve algo valioso), características para dar tranquilidad, urgencia (banner de oferta limitada), fotos y videos de calidad, pago contra entrega y envío gratis desde el principio, botones de compra visibles y numerosos, y un complemento en el momento de pagar (leyes 3 a 7, 10 y 11 de formula-ventas-ilimitadas-2024 · 95; leí esas; no las leyes 8, 9 y 12). Sobre el complemento antes del pago hay contradicción (`funnels/compra-directa.md` §6).
- *Ejemplo:* «Tu página dice los materiales y las medidas, pero no qué cambia en la vida de quien lo compra. Escribe tres beneficios arriba de las características».

**C4. La descripción no es copiada.**
- *Lee:* texto de producto.
- *Se juzga:* no copiar la descripción de la competencia: ver dónde falla y mejorarla con más ángulos de venta; demasiado texto sin patrón visual resta (ecommerce-0-a-17-millones · 16 — Página de producto).
- *Ejemplo:* «Tu descripción es casi igual a la de dos competidores. Usa las dudas de tus compradores como primeras líneas».

**C5. Cuando el anuncio rinde y la página no vende.**
- *Lee:* clics en enlace, vistas de landing (Meta) y visitas y comportamiento del Pixel de MaKo. Las compras reales, hoy no (sección 0, punto 2).
- *Se juzga:* si el clic y el costo por clic están bien y no se compra, el problema es la página, no la campaña (programa-meta-ads-the-net-lab · 87 — Hacks para mejorar tus embudos). El CTR bajo por sí solo no dice que algo falle; hay campañas con CTR muy bajo y compras altas (el ejemplo del mismo curso: 0,32 % de CTR saliente y 345 ventas).
- *Ejemplo:* «De 400 clics, sólo 220 vieron tu página. Antes de tocar el anuncio, revisa la velocidad de carga».

**C6. Los creativos cubren características, beneficios y dolor.**
- *Lee:* el ángulo clasificado de cada anuncio.
- *Se juzga:* tres pilares de los creativos de tienda; un solo beneficio por anuncio; envío gratis, prueba social, packs, cupón de primera compra solo para retargeting, detrás de escena (programa-meta-ads-the-net-lab · 52 — e-Commerce creatividades ganadoras). El anuncio estilo contenido con una persona real habla a la que tiene el mismo problema y suele vender más (ecommerce-0-a-17-millones · 52 — Análisis de un anuncio UGC).
- *Ejemplo:* «Tus 6 anuncios muestran el producto con música. Falta uno donde una persona cuente el problema y otro con tus reseñas».

---

## 2. Los anuncios en sí (iguales para los cuatro tipos)

**A1. Gancho (los 3 primeros segundos).**
- *Lee:* la transcripción, el tipo de gancho clasificado, la vista a 3 s y la retención (`lib/ads-analyst.ts`; vara de MaKo: buen gancho desde 28 % que frena el scroll, `HOOK_MID`).
- *Se juzga:* el gancho decide cuánta gente ve el resto y cuánto cobra Meta; puede ser un dolor, una promesa, una historia, algo visual o una opinión fuerte (formula-ventas-ilimitadas-2024 · 38 y · 47 — Estructura de anuncios de video). El mensaje principal va en los primeros 3 segundos (programa-meta-ads-the-net-lab · 62 — Masterclass Creativos). En TikTok, 1,5 segundos (ecommerce-0-a-17-millones · 49 — Rotación de creativos). Hay quien discrepa: sección 5.
- *Ejemplo:* «Tu anuncio abre con tu logo durante 4 segundos. El 80 % no llega a tu oferta. Empieza por el problema que dices en el segundo 6».

**A2. Ángulo y razón de compra.**
- *Lee:* ángulo y avatar de cada anuncio (`script-angles.ts`, `script-avatares.ts`) y el reparto de la cuenta.
- *Se juzga:* el ángulo es la razón por la que alguien querría el producto, y un producto tiene muchas: se usa una por anuncio (creativos-ugc-realistas · 12 — Las palancas, 12 ángulos de un champú; programa-meta-ads-the-net-lab · 19 — Ángulos publicitarios, 11 ángulos). Quién es la persona y qué dolor toca pesa más que la edición (creativos-ugc-realistas · 12). Producto, oferta y ángulo son niveles distintos: la oferta es el a quién y por qué; el ángulo, cómo se presenta (anuncio-ganador · 3 — Día 2 · Reto).
- *Ejemplo:* «Los 8 anuncios activos usan el mismo ángulo: ahorrar tiempo. Prueba uno por el miedo a perder clientes y otro por el estatus».

**A3. Diversidad real, no variaciones.**
- *Lee:* cuántos ángulos, avatares y formatos distintos corren a la vez.
- *Se juzga:* Meta agrupa como una sola señal los anuncios casi iguales (mismo avatar, mismo deseo, sólo cambia el titular o el color) y gasta en uno solo; cuenta un anuncio como distinto cuando cambia la persona, el problema o la emoción (programa-meta-ads-the-net-lab · 02 — Diversidad creativa y · 01 — El motor IA de Meta Ads).
- *Ejemplo:* «Tienes 12 anuncios, pero 10 son la misma toma con otro titular. Meta los trata como uno solo. Cambia de persona y de problema».

**A4. Nivel de conciencia según el público.**
- *Lee:* el público del conjunto (frío o retargeting) y el texto del anuncio.
- *Se juzga:* a quien no sabe que tiene el problema, ganchos demográficos, listas y humor; a quien sí, testimonios, antes y después y preguntas; a quien conoce la solución, comparativas y mitos; a quien conoce el producto, tres razones, demostración y preguntas frecuentes. Los anuncios de problema consciente son los que más suelen ganar. programa-meta-ads-the-net-lab · 20 — Niveles de consciencia. Una lista de ganchos por nivel: frío con los dos primeros, retargeting con los tres últimos (vender-por-fb-e-ig-ads · 219 — Diversificación creativa).
- *Ejemplo:* «A tu público frío le muestras un 30 % de descuento. Ellos aún no saben que tienen el problema. Prueba un anuncio que lo explique».

**A5. Texto del anuncio.**
- *Lee:* texto principal, título y descripción.
- *Se juzga:* estructura atención, problema, solución, prueba social y acción (bluehacker · 352 — Copywriting para ads). Lo importante va en los primeros 125 caracteres, como el asunto de un correo, y el largo cambia con el nivel de conciencia (programa-meta-ads-the-net-lab · 66 — Estrategias de copywriting). Subtítulos cortos en el video, de alto contraste (formula-ventas-ilimitadas-2024 · 39 — 10 leyes de ads en video).
- *Ejemplo:* «Tus primeras 125 letras presentan tu empresa. Ahí va la pregunta que le duele a tu cliente».

**A6. Formato y ritmo del creativo.**
- *Lee:* el formato y la duración de cada anuncio.
- *Se juzga:* mezcla de voz en off, testimonio, presentador, sólo música y carrusel (formula-ventas-ilimitadas-2024 · 42 y · 51 — Tus primeros 6 anuncios); un cambio de escena cada 3 segundos y sin silencios (formula-ventas-ilimitadas-2024 · 39); texto arriba del creativo que cuenta a quién habla (metolodogia-jads · 72 — Segmentación desde el creativo). Probar video, imagen y carrusel antes que ángulos (bluehacker · 348 — Importancia del testeo).
- *Ejemplo:* «Los 5 anuncios son imágenes. Sube un video corto con una persona real hablando».

**A7. CTA.**
- *Lee:* botón y última frase.
- *Se juzga:* pedir al final la acción exacta del funnel: escribir, registrarse, agendar o comprar (formula-ventas-ilimitadas-2024 · 38). Un CTA suave con nombre propio si se agenda (bluehacker · 313).
- *Ejemplo:* «Tu anuncio termina con "más información". Pon "escríbenos ahora" y el botón de WhatsApp».

**A8. Públicos.**
- *Lee:* el público del conjunto.
- *Se juzga:* la mejor segmentación es el mensaje; público amplio, y los creativos deciden a qué microsegmento se entra (programa-meta-ads-the-net-lab · 02, · 39 — Mejores prácticas; metolodogia-jads · 72). Como mínimo 3 a 5 millones de audiencia y sólo edad y sexo (bluehacker · 348). Excluir compradores sólo si se invierte fuerte y nunca el retargeting (programa-meta-ads-the-net-lab · 03 — Estructura de cuenta 2026). Jan ya no usa intereses (anuncio-ganador · 5).
- *Ejemplo:* «Tu conjunto usa 9 intereses y llega a 400 mil personas. Ábrelo y deja que el mensaje elija».

**A9. Presupuesto y estructura de prueba.**
- *Lee:* presupuesto diario y tipo (ABO o CBO) de cada conjunto.
- *Se juzga:* una campaña de prueba siempre activa, con presupuesto diario; ABO si la marca es nueva, CBO cuando ya hay 3 o 4 conceptos ganadores; cada ángulo en su propio conjunto o Meta le da casi todo a uno (programa-meta-ads-the-net-lab · 03; `lib/calculadora-presupuesto-ads.ts`). Apagar tras una o dos semanas sin gasto relevante o lejos del costo objetivo; con un ciclo corto de compra, 7 días alcanzan (mismo curso).
- *Ejemplo:* «Los tres ángulos están en un mismo conjunto con 15 dólares al día: uno se llevó todo. Sepáralos con 5 dólares cada uno».

**A10. Fatiga.**
- *Lee:* frecuencia y costo por resultado del conjunto. `detectar_fatiga_adsets` marca fatiga con más de 50 dólares en 7 días, frecuencia media sobre 3,5 y costo por formulario 1,5 veces el de 28 días (`lib/queries.ts`, `getFatigaAdsets`). Ojo: usa leads; en mensajes y compra directa no hay con qué calcular el costo.
- *Se juzga:* los rangos de frecuencia de los cursos no coinciden (sección 5). Cuando aparece fatiga no se apaga la campaña: se copia el conjunto con un anuncio nuevo o se llega a otro público (metolodogia-jads · 73 — Fatiga de creativos).
- *Ejemplo:* «Tu conjunto B llegó a frecuencia 4,7 y su costo subió un 60 %. No lo apagues: agrégale un video nuevo».

**A11. Qué métricas se miran.**
- *Lee:* las de la sección 0.
- *Se juzga:* el costo por clic más barato antes que el CTR, y comparar solo creativos con una cantidad parecida de impresiones (mínimo 3.000, recomendado 5.000 cada uno); el CPM esperable en Latinoamérica ronda 3 a 5 dólares (bluehacker · 348). Un CTR bajo no prueba que falle (programa-meta-ads-the-net-lab · 86 y · 87). Jan va más allá (sección 3): el CTR y el hook rate miden consumo, no intención.
- *Ejemplo:* «Comparaste dos anuncios con 900 y 4.800 impresiones. Espera a que ambos pasen de 3.000».

**La métrica de intención de cada funnel** (la que MaKo pone primero, según el criterio de Jan de pedir algo que cueste antes de dar por bueno un anuncio, anuncio-ganador · 5): en formulario, el lead con teléfono verificado; en compra directa, un muro simbólico de 2 a 10 dólares antes del pago; en VSL con llamada, la aplicación con preguntas y la agenda; en mensajes, la propuesta es nuestra y no de Jan: la conversación en que la persona responde una pregunta de calificación.

---

## 3. La máquina de contenido de anuncios

### 3.1 Cuántos creativos probar, y cuántos grabar

| Qué | Rango | Curso y de quién |
|---|---|---|
| Versiones de la oferta para el primer test | **9** (3 «a quién» × 3 «por qué»); con una tercera palanca (cómo explicarlo), **10 a 12** | anuncio-ganador · 2, 3 (Jan Schroeder) |
| No hacer 100 variaciones | **5 a 10** versiones de la oferta | anuncio-ganador · 1 |
| Test barato | **10 anuncios a 7–15 USD, 1 día**; vuelven unos **2 ganadores (20 %)** | anuncio-ganador · 2 |
| Otro formato de test | **10 anuncios, ~5 USD cada uno; 100 a 300 USD en 3–4 días** | anuncio-ganador · 6 |
| Cómo lanzarlos | **En secuencia, no 9 a la vez:** 3 por vez, una sola audiencia con sus 3 razones | anuncio-ganador · 5 |
| Variaciones por producto en la cuenta | **5 a 10**, conceptos distintos | programa-meta-ads-the-net-lab · 02 |
| Lote creativo | **4 a 6** anuncios (óptimo); hasta **15–20 por semana** si la producción lo permite | programa-meta-ads-the-net-lab · 03 |
| Primera campaña | **6** anuncios de formatos mezclados; con anuncios previos o para escalar, **9 a 12** | formula-ventas-ilimitadas-2024 · 42, 51 |
| Lluvia de ideas | **~20** ideas y quedarse con las mejores 6 | formula-ventas-ilimitadas-2024 · 42 |
| Por conjunto | **3 a 6** (menos de 3 es poco, 10–15 es demasiado) | vender-por-fb-e-ig-ads · 129 (Felipe Vergara) |
| Mínimo en el primer test de tienda | **3** creativos; testeo de ~30 euros al día | ecommerce-0-a-17-millones · 41 |
| Un ángulo por anuncio | **12** ángulos de un mismo producto, uno por video | creativos-ugc-realistas · 12 |
| Marca nueva | **5 conceptos** distintos, sin iterar todavía | programa-meta-ads-the-net-lab · 02 |

**Grabar menos de lo que se prueba.** Cambiar sólo los primeros 3 segundos y remezclar toma ya grabada da variantes sin regrabar (ecommerce-0-a-17-millones · 49); cambiar el hook, el texto en pantalla o el ritmo es una iteración, mientras que un concepto nuevo exige otra persona, otro problema y otra emoción (programa-meta-ads-the-net-lab · 02). Con IA, esas variaciones salen en una tarde (anuncio-ganador · 2). Cuenta de MaKo: se graban los **conceptos** (a lo sumo 3 «a quién» × 3 «por qué») y las iteraciones se hacen sobre los que ganan.

**El tope lo pone el presupuesto, no el curso.** `lib/calculadora-presupuesto-ads.ts` (también `calcular_presupuesto_anuncios`) limita a 3 avatares × 3 funcionalidades; cada ángulo necesita 10 resultados para decidir; como mucho la mitad del dinero va al test y la otra mitad a escalar; una ronda dura 7 días. Es el criterio que nació del audio de Martín del 22/10/2026 («no puedo hacer 10 pruebas A/B con 2.000 dólares»).

### 3.2 Cada cuánto renovar

| Señal o ritmo | Qué dice | Curso |
|---|---|---|
| Lote nuevo cada **7 días**, máximo cada **15** | Campaña de testeo siempre activa | programa-meta-ads-the-net-lab · 03 |
| Rotación cada **3 a 4 días** (TikTok); en Facebook un anuncio puede durar años | La inestabilidad se combate rotando | ecommerce-0-a-17-millones · 49 |
| Frecuencia que se acerca a **5** | Duplicar el conjunto y sumar un video nuevo; o duplicar la campaña con otro público | metolodogia-jads · 73 (Juan ADS) |
| Frecuencia a 7 días: **< 3** en público frío, **< 6** en compradores, **< 10** en retargeting caliente | Pasando eso, anuncios o conjuntos nuevos | vender-por-fb-e-ig-ads · 160 — Fatiga de anuncios (Felipe Vergara) |
| Frecuencia **1 a 2** en frío; **2 a 3 o 4 por semana** en templado; **1 por día** en caliente | Según temperatura | programa-meta-ads-the-net-lab · 86 |
| Costo por clic o CPM que sube, frecuencia que crece | Hay que abrir conceptos nuevos | programa-meta-ads-the-net-lab · 02, 65 |
| Un anuncio ganador se agota solo | Por eso la campaña de prueba no se apaga | programa-meta-ads-the-net-lab · 03 |
| El anuncio «se quema» | No es el anuncio, es que esa versión de la oferta el mercado no la quiere: se crea otra versión, no otro gancho | anuncio-ganador · 1 |
| Regla 60 / 40 | De cada lote, 60 % iteraciones del ganador y 40 % conceptos nuevos (hasta 80/20 con más volumen) | programa-meta-ads-the-net-lab · 02 |
| Con un concepto ganador | 80 % del esfuerzo en exprimirlo y 20 % en uno o dos conceptos nuevos | programa-meta-ads-the-net-lab · 02 |
| Código de MaKo | Fatiga: > USD 50 en 7 días, frecuencia > 3,5 y costo por lead 1,5 veces mayor | `lib/queries.ts` · `getFatigaAdsets` |

### 3.3 Cuántos por ángulo y por avatar

- **Un anuncio, una razón.** No se mezclan ángulos en un mismo video (creativos-ugc-realistas · 12). Por ángulo, en el test de Jan, un anuncio por versión; MaKo exige 10 resultados antes de dar una versión por válida.
- **Por avatar:** tres razones. El avatar es una persona distinta, con un dolor distinto (anuncio-ganador · 4 — Día 2 · Sala VIP).
- **Una vez ganador un concepto:** cambiar la estrategia creativa (comparativa, antes y después, tres razones, testimonio, historia, estadística), el formato y el enfoque del mismo problema (programa-meta-ads-the-net-lab · 02).

### 3.4 Cómo salen las razones de compra por avatar de Jan (curso «Anuncio Ganador»)

1. **El disparador.** Anotar cuál es el cliente que más fácil y rápido compra, con el que más se disfruta y que más rentabilidad deja (anuncio-ganador · 4).
2. **Tres «a quién».** Tres audiencias distintas por producto: en el curso, mamás, niñeras y abuelas para un curso de dormir bebés (anuncio-ganador · 5). El producto no se cambia.
3. **Tres «por qué» para cada una.** Un deseo, un dolor y una explicación distinta (anuncio-ganador · 4). Los motivos de compra son en realidad problemas concretos: ir «a la jugular», no a lo genérico (anuncio-ganador · 6).
4. **Cómo sacarlas.** Grabar una nota de voz de unos 10 minutos contando todo sobre el cliente y el producto, o bajar los mejores reels, y pasarlo a Claude para que devuelva razones y ganchos (anuncio-ganador · 6). MaKo ya lo hace con el brief del Archivero.
5. **La explicación.** Funciona cuando es 70 % conocida y 30 % nueva, y apunta al mecanismo con un nombre propio (anuncio-ganador · 6).
6. **Nueve anuncios.** 3 × 3 = 9 versiones; cada una es un anuncio «Recon» (anuncio-ganador · 3).
7. **Lanzar en secuencia y leer dos señales.** Primero la intención (algo que cuesta: un formulario con código, un muro de 2 a 10 dólares); después el ritmo del presupuesto (que gaste un poco más del tope tres días seguidos); sólo entonces escalar (anuncio-ganador · 5).

**De dónde sale la cantidad de anuncios:** de avatares × razones (× formas de explicar), recortada por el presupuesto (3.1). Con las cifras de Jan: 9 versiones y, si hay cuatro formas de explicarlas, unas 12; si el dinero no alcanza para 10 resultados por versión, se lanzan en rondas de 3.

---

## 4. Lo que MaKo ya tiene en el código (rutas)

| Para qué | Qué hay | Dónde |
|---|---|---|
| Asesor de WhatsApp (mensajes) | Lee una conversación (hasta 20 turnos), la etapa y la ventana de 24 h; propone 2 o 3 mensajes y redacta plantillas con Levanta Muertos | `lib/whatsapp-advisor.ts`, `app/whatsapp/WhatsAppAdvisor.tsx`, `lib/setter-conversacion.ts`, `lib/mako-knowledge-seed.ts` |
| Plantilla de Dashboard de mensajes | «Chat Analyst»: recibidos, chats, respondidos, en 15 min, mediana, p90, esperando, por día, por tipo, por setter y por automatización; sin leer texto | `lib/graficos-plantillas-analysts.ts` (`CHAT`), `lib/chat-diseno.ts`, `app/dashboard/disenos/HojaChat.tsx`, fuente `conversaciones` en `lib/graficos-fuentes-extra.ts` |
| Plantilla de formulario | «Velocidad de llamada»: primer contacto de cada lead nuevo | `app/dashboard/disenos/HojaVelocidad.tsx`, `lib/velocidad-diseno.ts` |
| Análisis de anuncios | Guion por anuncio (ángulo, avatar, gancho, formato), hook rate y retención, veredicto y patrones | `lib/ads-analyst.ts`, `lib/ads-analyst-patrones.ts`, `app/ads-analyst/` |
| Panel Recon (método de Jan) | Veredicto por anuncio: explorando, validada, falso positivo, apagar, pausada; intención = 10 leads; ritmo = gasto al 99 % del tope en 3 días | `lib/queries.ts` (`getSenalesRecon`), `lib/config.ts`, `app/anuncio/[adId]/page.tsx` |
| Cuántos ángulos con un presupuesto | Matriz máxima 3 × 3, mínimo para decidir, mitad a testeo | `lib/calculadora-presupuesto-ads.ts` |
| Herramientas de lectura de anuncios | `ver_rendimiento_anuncios`, `listar_guiones_analizados`, `ver_transcript_anuncio`, `ver_textos_anuncio_meta`, `ver_publico_conjunto_meta`, `ver_media_buyer`, `proponer_crear_formulario_meta` | `lib/api-mako/areas/ads.def.ts` |
| Fatiga | `detectar_fatiga_adsets` | `lib/api-mako/areas/metricas.def.ts`, `lib/queries.ts` |
| Ángulos y avatares | Avatares (segmentos), razones (motivaciones, 3 por avatar), matriz, entregable, persona y biblioteca de formatos de creativo | `lib/avatares.ts`, `lib/razones.ts`, `lib/angulos-formatos.ts`, `lib/entregable.ts`, `lib/persona.ts` |
| Landing y VSL | Diagnóstico de la página (copy + comportamiento), retención por minuto, estructuras de guion largo | `lib/landing-analyst.ts`, `lib/vsl-retencion.ts`, `lib/vsl-estructuras.ts`, `app/conocimientos/curso-vsl.ts` |

**Lo que falta y vive en esos archivos** (para no dar por hecho): conversaciones iniciadas y compras en `lib/meta-ads.ts`; barrido de texto de chats en lote sobre `wa_mensajes` y la caja de MaKo de la hoja Chat Analyst; transcripción del video de la landing en `lib/landing-analyst.ts` con `lib/transcribe.ts`; sembrar el área `ads` de `lib/mako-knowledge-seed.ts`; fatiga y Recon basados en leads, que no sirven para mensajes ni compra directa.

---

## 5. Contradicciones entre cursos (y con el código)

1. **El gancho.** Jan cuenta como mentira culpar al gancho o al video: el motor es la oferta y el anuncio sólo la pintura (anuncio-ganador · 1, · 3, y creativos-ugc-realistas · 12 coincide: ángulo y quién pesan más). formula-ventas-ilimitadas-2024 · 38 y · 47 y programa-meta-ads-the-net-lab · 62 dicen que el gancho es de lo más importante. MaKo no debe dar uno solo: primero revisa si el ángulo es nuevo; después el gancho.
2. **Métricas del anuncio.** Jan: hook rate, hold rate, CTR e inicio de pago miden consumo y engañan (anuncio-ganador · 5). El Ads Analyst de MaKo califica el guion con vara de hook (28 %) y retención (10 %) (`lib/ads-analyst-patrones.ts`); bluehacker · 348 manda mirar costo por clic con CTR secundario; programa-meta-ads-the-net-lab · 87 dice que un CTR bajo no prueba nada. Salida: el hook rate sirve para mejorar el creativo; la decisión de escalar se toma con intención y ritmo (Recon).
3. **Cuántos anuncios.** 3 a 6 por conjunto (vender-por-fb-e-ig-ads · 129); 4 a 6 por lote (programa-meta-ads-the-net-lab · 03); 6 y luego 9 a 12 (formula-ventas-ilimitadas-2024 · 42); 9 en secuencia (Jan). Distinto qué cuentan: conjunto, lote, campaña o versión de oferta. MaKo debe hablar de «versiones de la oferta» y «anuncios por conjunto» por separado.
4. **Fatiga.** Frecuencia máxima de 5 (metolodogia-jads · 73); menor de 3 en frío, 6 en compradores y 10 en retargeting caliente (vender-por-fb-e-ig-ads · 160); 1 a 2 en frío (programa-meta-ads-the-net-lab · 86); en la cuenta de MaKo, alerta sobre 3,5 con costo 1,5 veces mayor (`getFatigaAdsets`) y «guiones saturados» desde 2,4 (`lib/ads-analyst-patrones.ts`). Dos umbrales distintos en el mismo código.
5. **Cuánto dura un anuncio.** Rotar cada 3 o 4 días y, en Facebook, uno puede durar años (ecommerce-0-a-17-millones · 49); «inevitablemente se agota» (programa-meta-ads-the-net-lab · 03).
6. **Cuánto subir el presupuesto.** Jan lo llama falso: con un ganador real se pasa de 20 a 200 el mismo día, si hay ritmo (anuncio-ganador · 5). Los demás dan 20 %, 25 % o 35 % por vez (`funnels/compra-directa.md` §5). MaKo no debe afirmar un número: puede usar la señal de ritmo de Recon.
7. **Qué es una «razón» y quién es un «avatar».** Jan, en la clase 4 (Día 2), habla de un deseo, un dolor y una explicación; en la clase 3 (también Día 2) deja abierto que cada rama sea un deseo, una explicación o tres razones distintas. `lib/razones.ts` decidió que la razón es una motivación concreta, no una categoría. Los avatares de Jan son personas (mamá, niñera, abuela); `lib/avatares.ts` los hace segmentos firmográficos para Meta, tras el feedback de Mauricio. Y Jan ya no usa intereses (anuncio-ganador · 5), igual que programa-meta-ads-the-net-lab · 02 («segmenta por el mensaje»): el campo `senalesMeta` de los avatares debe leerse como el mensaje que lo atrae, no como un interés a marcar.
8. **Fricción en el formulario.** Pocas preguntas y filtrar en el seguimiento (relevo previo: vender-por-fb-e-ig-ads · 118) frente a más fricción para separar al curioso (anuncio-ganador · 5) y a un formulario largo por secciones que termina si no encaja (masteryhaus · 120).
9. **Tamaño y mezcla del test creativo.** bluehacker · 348 prueba primero el tipo de creativo y luego el ángulo; programa-meta-ads-the-net-lab · 02 dice que el testeo de una cosa por vez está muerto; ecommerce-0-a-17-millones · 49 remezcla los primeros 3 segundos de lo que ya funciona.
10. **El largo del VSL** y **si se registra antes de verlo**: ya recogidas en `funnels/vsl-llamada.md` §6; aquí se añade que growing-amg · 64 pide uno a tres VSL por semana y los demás hablan de uno.
11. **Mensajes: objetivo de campaña.** Ya en `funnels/mensajes-formulario.md` §1.6; sigue la propuesta de hacer una prueba de dos.

---

## 6. Censo

**Leí 60 clases nuevas** (más los cinco relevos previos, que no recuento). Con contenido completo o por tramos más búsquedas de palabras; **solo el inicio y búsquedas** en las marcadas (i).

- **programa-meta-ads-the-net-lab** (18): 01 (i), 02, 03, 19, 20, 39 (i), 52, 58 (i), 62, 63 (i), 65, 66, 69 (i), 81 (i), 85, 86, 87, 93 (i).
- **anuncio-ganador** (6, Jan Schroeder): 1 a 6, con el resumen de cada una y la transcripción buscada de la 2, la 3 y la 5 (`app/conocimientos/curso.ts`, `public/cono-tx`).
- **formula-ventas-ilimitadas-2024** (10): 35, 38, 39, 42, 47, 51, 58, 66, 89, 95 (de la 95 las leyes 1 a 7, 10 y 11).
- **vender-por-fb-e-ig-ads** (5): 129, 160, 171, 172, 219.
- **ecommerce-0-a-17-millones** (5): 16, 41, 47, 49, 52.
- **bluehacker** (4): 21 (i), 313, 348, 352.
- **metolodogia-jads** (3): 70, 72, 73.
- **creativos-ugc-realistas** (2): 12, 14.
- **sell-your-knowledge** (2): 59 (i), 75 (i).
- **m5-95** (1): 49. **growing-amg** (1): 64. **growing-setters-3-0** (1): 14 (i). **la-universidad-del-closer** (1): 41. **masteryhaus** (1): 120.

**Código leído:** `lib/whatsapp-advisor.ts`, `lib/mako-knowledge-seed.ts`, `lib/setter-conversacion.ts`, `lib/graficos-plantillas-analysts.ts` (CHAT), `lib/chat-diseno.ts`, `lib/graficos-fuentes-extra.ts` (conversaciones), `app/dashboard/disenos/HojaChat.tsx`, `HojaVelocidad.tsx`, `lib/meta-ads.ts`, `lib/ads-analyst.ts`, `lib/ads-analyst-patrones.ts`, `lib/queries.ts` (Recon y fatiga), `lib/config.ts`, `lib/calculadora-presupuesto-ads.ts`, `lib/api-mako/areas/ads.def.ts`, `metricas.def.ts`, `landing.def.ts`, `lib/avatares.ts`, `lib/razones.ts`, `lib/angulos-formatos.ts`, `lib/landing-analyst.ts`, `lib/vsl-retencion.ts`, `lib/vsl-estructuras.ts`, `app/conocimientos/curso-vsl.ts` y la memoria `angulos-venta.md`.

**No abrí, aunque eran de peso:** academia-estratega (el relevo previo dice que repite m5-95; no lo comprobé), ecom-total-2-0, la mayoría de las sesiones semanales de bluehacker (de 70 a 140 KB) y la clase 64 de sell-your-knowledge (embudo a VSL, 41 KB). **Mirados y descartados:** sell-your-knowledge · 75 sirve para la llamada, no para el anuncio; growing-setters-3-0 y bluehacker 19 a 24 son mensajería en frío por mensaje directo: sólo se usó su estructura de conversación como referencia.

**Lagunas:** ningún curso da un rango de costo por conversación ni de costo por lead calificado que no sea de un solo docente; las cifras de test de Jan salen de una sala en vivo y de su propia cuenta, sin auditar.

**Cosecha.** Los hallazgos del código (el sincronizador sin conversaciones ni compras, el Chat Analyst sin texto, el VSL sin transcripción, el conocimiento `ads` vacío, dos umbrales de fatiga) quedan escritos en la sección 0 y la 4 de este documento; no se tocó código.
