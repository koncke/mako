# Mapa de la IA de MaKo: qué necesita API y qué no

*Mapeo del 16/10/2026, hecho con tres barridos del código.*

Este es el mapa de todas las funciones de MaKo que usan IA. Se armó con tres barridos: lo que corre por horario, lo que dispara algo de afuera y lo que hace el usuario. La regla es simple. **Lo que corre solo, sin nadie mirando, necesita API.** **Lo que el cliente hace conversando, con la pantalla abierta, puede ir a su Claude o ChatGPT.** **Los medios (audio, voz, imagen, video y vectores) siempre van con API**, porque ninguna suscripción de chat los cubre.

## Lo que corre solo (24/7) — necesita API

| Función | Qué la dispara | ¿Responde en vivo? | Área |
|---|---|---|---|
| AI Step: le contesta al lead que escribe por WhatsApp | Llega un mensaje del lead | Sí, en segundos si el caso está en «Sola». Si no, deja un borrador | Automations (AI Step) |
| AI Step: le contesta al lead por Instagram o Messenger | Un DM o una respuesta a una historia de alguien que ya es lead | Sí, si va «Sola». Si no, el texto llega en el aviso al grupo | Automations (AI Step) |
| Calificación automática del lead según la charla | Cada respuesta que redacta el AI Step, hasta que el lead queda calificado | No. Marca al lead como no calificado y avisa | CRM / Automations |
| «Escribe MaKo»: el mensaje de la automatización que la IA redacta para cada lead | Apenas entra el evento (formulario de Meta, agenda, DM, email, cambio de etapa) y el motor, que pasa cada minuto y cada hora | No. Sale solo, pero no le contesta a nadie | Automations |
| MaKo en el grupo de WhatsApp («Hola MaKo»): contesta y actúa | Un mensaje en el grupo del negocio. Lo que se traba se rescata cada minuto | Sí. Lo espera el dueño o su equipo | MaKo en WhatsApp |
| MaKo en el grupo: mira imágenes, PDF y archivos | Llega una imagen o un documento al grupo | Sí | MaKo en WhatsApp |
| Herramientas de la API de MaKo que usan IA por dentro (el conector del Claude o ChatGPT del cliente) | El agente del cliente llama una herramienta, a cualquier hora | Sí. Lo espera su chat | API de MaKo |
| Follow-up post-llamada: deja redactado el WhatsApp para después de la reunión de venta | Fathom avisa que terminó la R1 o la R2 y el lead asistió | No. Queda como borrador para el setter | Closing / Chats WhatsApp |
| Closing Analyst: analiza las llamadas de venta (es la única que paga Claude Sonnet) | Cada hora, con las grabaciones nuevas de Fathom. También después de cada llamada, en la extracción del onboarding y con los botones Sincronizar, Re-analizar y Revisar | No | Closing (Dashboard) |
| Insights de la llamada en la ficha del lead | Cada hora, un lead por negocio, y el botón Analizar llamada | No | CRM / Closing |
| Avisos al dueño que redacta MaKo («Insistir», y «Mensaje al dueño» cuando no tiene texto propio) | Eventos de Calendly, Cal.com, Fathom y los formularios de Meta. Cada 5 minutos se retoma lo que quedó esperando | No | Automations / Mensajes de MaKo |
| Cobranza: recordatorio de la cuota por vencer | Una vez por día, sólo si el flujo tiene un paso sin texto o un «Insistir» | No | CRM › Cobranza |
| Paso «Acción» de una automatización (puede ser cualquiera de las ~180 acciones; no se revisó cuáles usan IA) | El motor llega a una tarjeta de acción, desde cualquier evento u horario | No | Automations |
| Aviso «tu landing dejó de registrar visitas» | Una vez por día | No | Pixel de la landing |
| Landing Analyst: analiza cada página nueva del Pixel | Al guardar la página, cada hora como red de respaldo, y los botones Analizar y Sincronizar | No | Landing Analyst |
| AI Analyst de una hoja del Dashboard | Su horario (se revisa cada 15 minutos) y el botón Analizar ahora | No | Dashboard |
| Conclusiones de MaKo (las cajas de IA del Dashboard) | Su horario (cada 15 minutos) y el botón de refrescar | No | Dashboard |
| Ads Analyst: analiza los guiones de los anuncios | Una vez por día, la extracción del onboarding y los botones Sincronizar y Re-analizar | No | Ads Analyst |
| Lectura de los anuncios de imagen (el texto y la descripción del creativo) | Una vez por día, la extracción del onboarding y el botón Re-generar | No | Ads Analyst / Ads Writer |
| Ordenar el guion de cada anuncio en secciones | Lo mismo que la fila de arriba | No | Ads Analyst / Ads Writer |
| Análisis de las sesiones de entrega con clientes | Cada hora, con las grabaciones de Fathom que son de entrega | No | Customer Success |
| Lector de reuniones del equipo: borrador de tareas para el Plan | Cada hora, con las reuniones nuevas de Fathom. También a mano desde el Plan, con una reunión o con archivos | No. Deja una propuesta y avisa | Plan |
| Perro Guardián: repriorización diaria de los proyectos (interno, sólo SuperAdmin) | Una vez por día | No | Plan |
| Propuesta para cerrar tareas según los commits (interno, sólo SuperAdmin) | Una vez por día | No | Plan |

Hay cuatro medios más que también corren solos: las notas de voz del grupo, la voz clonada del AI Step, la búsqueda en la metodología y la transcripción de los anuncios. Están en la tabla de Medios, marcados como **corre sola**.

**Ojo con estas cuatro cosas:**
- **El AI Step usa sólo las keys del negocio y no tiene la red de respaldo de la plataforma.** Si el negocio no tiene key propia, el lead no recibe respuesta y el aviso dice «No pude dejarte un borrador». Es el primer lugar donde un usuario nuevo sin API se queda sin nada.
- **El AI Step no escucha las notas de voz del lead.** Le llega texto vacío y lo más probable es que caiga en «Otra cosa». De una imagen sólo ve el pie de foto.
- **Que el código diga «Claude» no quiere decir que use Claude.** Sólo el Closing Analyst paga Claude Sonnet. Todo lo demás corre por la cascada barata (Gemini, Groq, OpenRouter, Mistral, OpenAI), con las keys del negocio o con la red de la plataforma.
- **Hay cosas que dependen sólo de OpenAI y no tienen alternativa:** la transcripción y la lectura de los anuncios, la búsqueda en la metodología y mirar los creativos. La búsqueda usa la key de la plataforma. Si OpenAI se queda sin crédito, MaKo contesta igual pero sin la metodología, y nadie se entera.

## Lo que el cliente hace conversando — puede ir a su Claude o ChatGPT

Los chats son los que pasan directo. Los botones y las subidas hoy llaman a la IA del servidor. Para que vayan al Claude del cliente, el pedido tiene que salir de su chat.
**Ojo:** cuando el Claude del cliente usa una herramienta de MaKo que adentro llama a la IA (closing, landing, Perro, dashboard, onboarding, etc.), esa IA la pone el servidor. Por eso está en la tabla 24/7.

### Chats

| Función | Área |
|---|---|
| Chat de MaKo (la tab MaKo y el chat de cada gráfico) | MaKo |
| MaKo Doer: el chat que consulta datos reales | MaKo |
| Leer fotos y PDF adjuntos en los chats | MaKo |
| Chat de MaKo en el teléfono | MaKo Mobile |
| Chat de MaKo al costado del CRM | CRM |
| MaKo Analyst en la ficha del lead | CRM |
| Chat de Offer (conversar y armar la oferta) | Offer |
| MaKo redacta un mensaje del lienzo y el chat de la automatización | Automations |
| Editar con MaKo dentro del editor de landings | Web Generator |
| Chat de MaKo en el Video Editor | Video Editor |
| Asesor de WhatsApp (qué escribirle a un lead) | WhatsApp |
| Perro Guardián: puntuar el plan y debatir fecha, prioridad y proyecto | Plan |

### Botones, subidas y generadores

| Función | Área |
|---|---|
| Análisis del lead (Generar / Regenerar) | CRM |
| Leer el contrato para autollenar el plan de pagos y el Deal Details | CRM |
| Leer el comprobante de pago de una cuota | CRM |
| Leer el documento fiscal del cliente del deal | CRM |
| Importar leads desde un archivo (sólo si no es un CSV o XLSX limpio) | CRM |
| Leer el documento fiscal propio del negocio | Configuraciones |
| Autoasignar los trabajos de la cartera | Customer Success |
| Diagnóstico de fase y propuesta de la oferta (PDF) | Offer |
| Leer los documentos que se suben a Offer | Offer |
| Valorar un guion de anuncio | Ads Writer |
| Generar guiones de anuncio por motivación | Ads Writer |
| MaKo propone o ajusta una campaña | Ads Manager |
| MaKo mira los creativos de la campaña | Ads Manager |
| Renombrar campañas con una plantilla | Ads Manager |
| Crear una automatización con IA («Pídeselo a MaKo») | Automations |
| Leer un archivo o una captura para crear el flujo | Automations |
| Armar los escenarios del AI Step | Automations |
| Sugerir gancho, preguntas y criterio de calificación | Automations |
| Variantes de los mensajes de una secuencia | Automations |
| Aprender cómo escribe el negocio | Automations |
| Separar las conversaciones de clientes de las personales | Automations |
| Guion de una nota de voz en la voz del dueño | Automations |
| Guía de voz del negocio y MaKo escribe la nutrición | Automations |
| Crear una landing con IA | Web Generator |
| Diagnóstico de una landing (propia o de afuera) | Web Generator |
| Aplicar los comentarios del diagnóstico | Web Generator |
| Replicar una landing de afuera en el editor | Web Generator |
| Importar un archivo para armar la landing | Web Generator |
| Planificar el anuncio en video | Video Generator |
| Reescribir una toma del plan | Video Generator |
| Escribir y corregir las escenas | Video Generator |
| Cargar guiones propios | Video Generator |
| Describir la cara de marca a partir de las fotos | Onboarding / Video Generator |
| Generar carruseles, reels y stories | Contenido |
| Buscar por significado en el Second Brain | Second Brain |
| Priorizar las tareas nuevas | Plan |
| Proponer tareas para un proyecto vacío | Plan |
| Optimizar una tarea y crear un proyecto con MaKo | Plan |
| Buscar por significado en el plan | Plan |
| Plan de arranque al cerrar el onboarding | Onboarding / Plan |
| Ideas de experimentos y armar uno desde una hipótesis | Experimentos |
| Cerrar un experimento (veredicto y aprendizaje) | Experimentos |
| Retrospectiva | Experimentos |
| «Pídeselo a MaKo»: armar una hoja del Dashboard o una plantilla | Dashboard |
| El Archivero: leer los documentos del negocio | Onboarding |
| Panorama del negocio, campos y preguntas del Archivero | Onboarding |
| Proponer avatares, formatos, ofertas, productos y entregables | Onboarding |
| Quiz de personalidad de la voz del creador | Onboarding |
| Completar el perfil del negocio desde un documento | Onboarding |
| Validar una plantilla de WhatsApp contra Meta | WhatsApp |
| Escribir un email o un broadcast | Email |

### Ensayos y pruebas

Estos prueban el mismo motor que después corre 24/7. Si se hacen con el Claude del cliente, el ensayo deja de mostrar lo que va a pasar de verdad.

| Función | Área |
|---|---|
| Probar el flujo (simulador) | Automations |
| Ensayo de objeciones del AI Step (MaKo hace de lead) | Automations |
| Ensayo del onboarding del Chatbot (MaKo hace de cliente) | Automations |
| Probar un aviso | Notificaciones |
| Simular un mensaje al MaKo de WhatsApp | Admin (super admin) |

## Medios — siempre con API (ninguna suscripción de chat los cubre)

| Función | Tipo | Área |
|---|---|---|
| Transcripción de los videos de los anuncios. **Corre sola** (una vez por día y en la extracción del onboarding). También se dispara con el botón Re-generar y al subir un video a Meta. Sólo OpenAI, sin alternativa | Audio | Ads Analyst / Ads Writer / Onboarding |
| Escuchar las notas de voz del grupo de MaKo. **Corre sola, en vivo** | Audio | MaKo en WhatsApp |
| Contestarle al lead con una nota de voz, con la voz clonada del negocio. **Corre sola, en vivo.** Usa la key de ElevenLabs del cliente y funciona sólo por WhatsApp | Voz | Automations (AI Step) |
| Búsqueda en la metodología antes de contestar en WhatsApp y en el follow-up post-llamada. **Corre sola, en vivo.** Usa el OpenAI de la plataforma y, si falla, no avisa | Embeddings | MaKo en WhatsApp / Closing |
| Guardar el conocimiento con vectores | Embeddings | Conocimiento (sólo agencia) |
| Dictar en vez de escribir (micrófono) | Audio | Plan / MaKo / CRM / Automations |
| Nota de voz del dueño en Offer | Audio | Offer |
| Biblioteca de notas de voz (se transcriben al subirlas) | Audio | Automations |
| Transcribir una clase para el conocimiento | Audio | Conocimiento (sólo agencia) |
| Escuchar cómo suena una respuesta del AI Step (key del cliente) | Voz | Automations |
| Voz de MaKo para las tarjetas «MaKo en WhatsApp». Usa la key de MaKo. Se genera al editar y el envío no vuelve a llamar a ElevenLabs | Voz | Automations |
| Clonar la voz del dueño | Voz | Automations / Video Generator |
| Escuchar mi voz clonada | Voz | Video Generator |
| Texto a voz del Video Editor (key del cliente) | Voz | Video Editor |
| Generar la imagen de una escena (Google Flow) | Imagen generada | Video Generator |
| Filmar un clip (Google Flow) | Video | Video Generator |

Las dos de Google Flow son la excepción: no usan una API del servidor. Salen de la cuenta de Google del cliente, a través de la extensión, que tiene que estar conectada. Tampoco las cubre ninguna suscripción de chat.

## Los números

- **Corren solas (24/7): 28.** Son 24 de texto o lectura y 4 de medios.
  - 8 le contestan a una persona en vivo (5 de texto y 3 de medios).
  - 2 son internas de MaKo (el Perro diario y el cierre por commits), así que para los clientes quedan 26.
- **Conversando o en el momento: 68.** Son 12 chats, 51 botones y subidas, y 5 ensayos.
- **Medios: 16.** 4 corren solas y ya están sumadas en las 28. Las otras 12 se usan en el momento. 2 de las 16 son de Google Flow y no usan API.
- **Total: 108 funciones** (24 + 68 + 16). Salen de 130 entradas de los tres barridos, con 22 duplicados fusionados.

## Sin revisar a fondo

- **Pasos «Acción» de las automatizaciones.** No se revisó, de las ~180 acciones, cuáles llaman a la IA cuando corren desde una automatización. Pueden correr desde el motor de nutrición, los flujos de avisos, la cobranza y los eventos «pago recibido» y «análisis listo». Las áreas de ads, chatbot, closing, contenido, CRM, dashboard, landing, editor de landings, negocio y video usan IA.
- **Qué modelo asigna /modelos-ia a cada función.** No se miró.
- **Priorizar las tareas que llegan por WhatsApp.** El barrido de acciones dice que corre 24/7, pero ningún barrido 24/7 la listó.
- **Aviso con IA de la retro.** Dos barridos dicen que la retro manda un aviso redactado por IA, pero ninguno lo listó con su disparador.
- **Sesiones de entrega.** Un barrido dice que corren por la cascada gratis y el otro, que van por Gemini sin respaldo. No coinciden.
- **Endpoints del plugin (/api/agente).** No se encontraron llamadas directas a la IA, pero no se siguió cada import.
- **WhatsApp oficial.** Desde que se borró Chatwoot no se encontró ningún webhook entrante vivo que lo use.
- **Puente a Google Flow.** Es una ruta pública y genera en el navegador del cliente. Quedó para el barrido de video.
- **Tabs que todavía no están armadas** (image-generator, vsl-writer, youtube-writer, dm-writer, sales-roleplay, competitor-spy, market-analyst, etc.). No se abrieron una por una. El mapa de imports no les encontró IA.
- **Cursos y alumno.** El mapa de imports no mostró IA. No se abrieron.
- **Image Editor.** El quitar fondo corre en el navegador con un modelo local. No se mapeó.
- **Web Generator.** Las imágenes salen de stock. Las de Google Flow todavía no están conectadas.
- **«Probar conexión» de las keys.** Son pruebas de credenciales, no funciones de IA. No se mapearon.
- **Crons revisados y dejados afuera.** Se revisaron hasta el fondo 25 crons que no llegan a IA: alerta-critica, avisos-programados, avisos-resumen, cobros-reconciliar, crm-automatico, cs-sin-contacto, curso-purga, curso-sesiones, email-broadcasts, flow-abandono, fotos-contacto, insistencias, meta-daily, meta-leads-poll, objectives-vigilante, panda-daily, plan-recurrentes, prueba-grabacion, replay-purga, reporte-diario, reporte-horario, reporte-semanal, reunion-recordatorio, tareas-verificar y youtube-daily. Salen con texto fijo, salvo que disparen un paso «Acción».