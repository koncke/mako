# Ficha del lead por bloques

> Documento de diseño, 14/10/2026. Lo lee Martín para decidir y lo usa quien implemente el constructor de la ficha. Las líneas «Para implementar» son para el equipo: si vas por el producto, puedes saltártelas.

## 1. En corto

La ficha del lead se arma con **bloques, como el Dashboard**: se agregan, se sacan y se ordenan, y cada uno elige su ancho (¼, ⅓, ½ o completo) y su diseño.
Se personalizan cuatro tabs: **Resumen, Pagos, Reuniones y Tracking**. La cabecera, MaKo Analyst y el Historial quedan fijos.
Todo se **edita en el lugar**, sin pasar por «Editar deal» ni por otra pantalla, y cada cambio queda en el historial con Deshacer.
Cada funnel arranca con la **plantilla de su tipo** (dos reuniones, una llamada, evento, formulario de Meta, landing, te escriben, prospección o carrito). MaKo la elige sola con lo que el funnel ya tiene, sin preguntarte nada, y lo que el negocio ya eligió queda de respaldo.
Un bloque sin datos se calla: el lead nuevo ve poco y el ganado ve su cobro. Los avisos de «datos sin marcar» siguen a la plantilla, así que un carrito no pide contrato.
El panel lateral y la página de la ficha muestran exactamente lo mismo.
En el mismo panel donde se arma, el **estilo de la ficha**: tipografía, tamaño de las tarjetas y colores, como pediste el 13/10, más el ícono de cada bloque. Es el tema del Dashboard, con sus colores dentro de la paleta del modo claro y el oscuro, así nunca queda ilegible.

**Lo que necesito que decidas**

1. ¿La ficha y sus avisos de «datos sin marcar» pasan a guardarse por funnel, con lo que el negocio ya eligió como respaldo? (Recomiendo que sí: ws1, ws11, ws15 y ws17 tienen funnels de tipos distintos, y un funnel de carrito no puede pedir contrato.)
2. ¿Vuelve la conversación a la ficha de escritorio (WhatsApp, DM de Instagram y el mensaje listo para mandar) como bloques del Resumen y no como tab, aunque la tab Chat se sacó a propósito?
3. ¿Se puede contestar un DM de Instagram desde la ficha, ya que MaKo sabe mandarlo pero hoy ese envío no está abierto para la ficha?
4. ¿La tab Tracking sale también cuando sabemos que el lead visitó la página o de qué anuncio vino, aunque su funnel no tenga una campaña de Meta asignada, o sigue la regla que pediste el 12/10?
5. ¿El puntaje y las recomendaciones de la llamada los ve el closer o sólo el admin? (Hasta que lo decidas, no entran en ninguna plantilla.)
6. ¿La ficha del CRM le muestra a un ganado lo de Customer Success (estado, entrega y curso, sólo para ver, con «Abrir en CS»), y la ficha de CS pasa a usar estos mismos bloques con una plantilla fija de cliente?
7. ¿La moneda se guarda por negocio o por oferta, si hoy sólo los pagos de la pasarela traen la moneda original y ws1 y ws11 venden en MXN?

---

## 2. Tipos de CRM en «Nuevo CRM»

Hoy «Nuevo CRM» pregunta tres cosas: el nombre, **cómo lo vendes** (de ahí salen las etapas) y **cómo te llega la gente** (hasta tres entradas). La ficha no necesita un tipo nuevo para elegir su plantilla: la saca de las etapas de reunión y de la entrada (ver la sección 4). Por eso los tipos que faltan se arman **combinando un canal y una entrada que ya existen**, con las etapas renombradas, y no hace falta un canal nuevo. Las etapas de los que faltan son una propuesta.

| Tipo | Hoy | Etapas | Cómo entra la gente | Plantilla de ficha |
|---|---|---|---|---|
| Llamada con dos reuniones (high-ticket) | Existe en el editor del funnel, pero «Nuevo CRM» no la ofrece | Lead entrante → Agenda R1 → Agenda R2 → Facturando → Ganado | Formulario, landing o VSL, o agendan solos | Llamada con R1 y R2 |
| Llamada de venta | Sí | Lead entrante → Agenda R1 → Ganado | Formulario, landing o VSL, o agendan solos | Una llamada |
| Conversaciones por chat | Sí | Lead entrante → Conversación abierta → Facturando → Ganado | Te escriben (WhatsApp, DM, comentario) o tú les escribes | Te escriben; si tú les escribes, Prospección |
| Carrito / checkout | Sí | Lead entrante → Facturando → Ganado | Compran en el carrito | Carrito |
| Webinar | Sí | Registro (landing) → Grupo WhatsApp → Webinar → Oferta / Checkout → Ganado | Llenan un formulario | Evento |
| Sesión presencial | Sí | Lead entrante → Conversación abierta → 1ª sesión sin costo → Facturando → Ganado | Te escriben o tú les escribes | Evento |
| Anuncio con formulario de Meta (incluye inmobiliaria) | La entrada existe («Anuncios a formulario» en el editor del funnel); «Nuevo CRM» no la ofrece | Lead entrante → Conversación abierta → Facturando → Ganado | Dejan sus datos en el anuncio | Formulario de Meta |
| DM funnel (comentan una palabra clave) | **Falta.** Conversaciones + Te escriben | Lead entrante (comentó) → Conversación abierta → Facturando → Ganado | Comentario en una publicación, un Reel o un en vivo | Te escriben |
| Orgánico de Instagram | **Falta.** Conversaciones + Te escriben | Igual que el DM funnel; si cierra en llamada, suma Agenda R1 | DM desde el perfil o las historias, o el link de la bio | Te escriben; con llamada, Una llamada; por el link de la bio, Landing con opt-in |
| LinkedIn | **Falta.** Llamada de venta + Tú les escribes | Lead entrante → Conversación abierta → Agenda R1 → Ganado | Tú les escribes | Una llamada; si cierra por chat, Prospección |
| YouTube | **Falta.** Llamada de venta + Llenan un formulario | Lead entrante → Agenda R1 → Ganado | El link de la descripción, a un formulario o a la agenda | Una llamada; sin llamada, Landing con opt-in |
| Recurso gratis (lead magnet) | **Falta.** Conversaciones + Llenan un formulario | Lead entrante (pidió el recurso) → Conversación abierta → Facturando → Ganado | Llenan un formulario para recibirlo | Landing con opt-in |

**Para implementar.** «Nuevo CRM» vive en `NuevoProductoModal` (app/crm/CrmToolbar.tsx:858-976): canal de `CANALES` (lib/fase-diagnostico.ts:365-371) → `TEMPLATE_POR_CANAL` (lib/pipeline.ts:1250-1256), y entradas de `ENTRADAS_OFRECIDAS` (lib/pipeline.ts:836). `highticket` está en `FUNNEL_TEMPLATES` (lib/pipeline.ts:1141-1146) y ningún canal la siembra. Un tipo nuevo es un preset de canal + entrada + etapas renombradas, no un `CanalId` nuevo (`CanalId` es `Record` en `ENCUENTRO_POR_CANAL`, `TEMPLATE_POR_CANAL` y `VOLUMEN_POR_CANAL`). Las etapas usan las claves canónicas renombradas (`lead`, `agenda`, `agendaj2`, `facturando`, `ganado`, y `conversando`, a la que sólo se llega a mano), como hace `presencial` (lib/pipeline.ts:1193-1219): una clave nueva queda fuera de `deriveStageKey` y el lead cae a la primera etapa, la falla de la plantilla `vsl`. En `vsl`, la etapa `grupo` no sabe quién está en el grupo.

---

## 3. Catálogo de bloques

**Cómo se lee.**
- **Tamaños:** ¼, ⅓, ½ o completo, sobre la misma grilla de 12 columnas del Dashboard. El alto lo da el contenido.
- **Diseños:** formas de dibujar el mismo dato. Se cambian desde el bloque.
- **Avisa si falta:** qué «dato sin marcar» se completa en ese bloque.
- **Existe hoy:** Sí; A medias (el dato existe y la ficha no lo muestra, o falta una parte); No.
- Un bloque de sólo lectura sin datos no se dibuja. Uno editable se dibuja con «—» para que lo llenen.
- Cada bloque aparece una vez, en su tab principal. Si también se puede poner en otra, lo dice debajo del nombre.

**Lo que no se personaliza.**
- **Cabecera:** nombre, etiquetas, funnel con su etapa y «N sin marcar». Es la identidad del lead y va fija. Lo único que cambia es que «N sin marcar» lee los avisos de la plantilla.
- **MaKo Analyst:** es un chat. El diagnóstico que hoy está plegado ahí sale como el bloque `diagnostico-mako`, y la tab queda sólo con el chat.
- **Historial:** es el registro con Deshacer más el Recorrido. Si se recortara, dejaría de servir como registro. Suma un filtro «Plata».
- **Ficha del celular y resumen antes de la llamada:** no tienen editor propio. Más adelante pueden leer el orden de la plantilla.
- **No se crea una tab «Seguimiento»:** sus bloques van al Resumen (decisión 2).

**Para implementar.** Un solo armador para las dos puertas, que hoy repiten el armado a mano (LeadSheet.tsx:368-436 y app/crm/[id]/page.tsx:198-346), y «N sin marcar» calculado una sola vez (hoy da distinto: app/crm/actions.ts:318-320 contra page.tsx:168-171). Grilla `COLS = 12` (lib/graficos-catalogo.ts:1209), sin alto fijo. MaKo Analyst: `GeneratedInsightCard` sale de AnalystDelLead.tsx:42-63. Historial: el filtro «Plata» va dentro de `AuditHistory`. Móvil: app/m/crm/[id]/FichaLead.tsx; resumen: /crm/[id]/resumen; ninguno reusa lead-view.

### Resumen

Es la tab que abren todos y la única que existe en todos los funnels. Recibe lo que hoy queda escondido detrás de tabs que no siempre salen: de dónde vino, el setter y el closer, y lo que contestó al agendar.

| Bloque | Qué muestra | Se edita ahí | Tamaños | Diseños | Avisa si falta | Existe hoy |
|---|---|---|---|---|---|---|
| `siguiente-accion` | Una frase con su botón, con lo primero que haya: próxima reunión, próximo paso de la llamada, datos sin marcar, seguimiento sin mandar, ventana de Instagram por cerrar, pase a humano sin resolver o link sin pagar. Sin nada, no se dibuja. | No (se calcula); el botón lleva a donde se resuelve | ½ · completo | banner arriba · fila · chip | — | A medias: sólo en el celular, sin los tres casos de redes y cobro |
| `pase-a-humano` | Cuándo y por qué MaKo le pasó la charla a una persona, y si ya se resolvió. Va arriba hasta que se resuelva. | «Resuelto» (esa acción no existe todavía) | ½ · completo | banner · fila con el motivo | — | A medias: el dato existe y la ficha no lo lee |
| `posibles-duplicados` | Otras fichas con el mismo teléfono, email o nombre. Sin ninguna, no se dibuja. | Sólo abrir la otra (unirlas no existe) | completo | banner · lista | — | A medias: hoy sólo se ve al dar de alta |
| `cambios-de-mako` | Lo que un canal o el CRM automático quiere escribir en este lead, a la espera de que alguien lo confirme. Sin nada, no se dibuja. | Confirmar o descartar | ½ · completo | tarjeta por cambio · renglón | — | A medias: hoy se revisa en /mako/revisar, no lead por lead |
| `contacto`<br>también en CS · Resumen | Empresa, teléfono con su país y email, con WhatsApp, Gmail y copiar. No se puede quitar. Se va la fila Nombre, que repite la cabecera. | Sí, todo | ½ · completo | grilla · renglón · botonera grande Llamar · WhatsApp · Email | Teléfono y empresa (nunca frenan) | Sí |
| `redes-y-web` | Web, Instagram, YouTube y LinkedIn, cada uno con su botón. Dentro del bloque eliges cuáles van. | Sí | ¼ · ⅓ · ½ | chips con ícono · filas con el link · red destacada | No (pide un aviso nuevo) | Sí; el lead que entra por Instagram nace sin su @ |
| `direccion` | La dirección, con «Ver en Google Maps». | Sí | ⅓ · ½ | fila · tarjeta con el mapa | — | Sí (apagado por defecto) |
| `sexo` | Mujer, Hombre u Otro. | Sí | ¼ · ⅓ | chip · fila | — | Sí |
| `setter-y-closer` | Quién le escribe y quién le vende. Si la grabación detectó un closer, lo sugiere. | Sí | ¼ · ⅓ · ½ | dos cajas · chips con foto · renglón | Setter y closer | A medias: hoy vive en Reuniones y no se ve sin etapa de reunión |
| `proxima-reunion` | La próxima reunión o evento con el nombre de su etapa (en un webinar dice «Webinar»): día y hora del negocio, cuenta regresiva y «Entrar». En un evento, el lugar. Pasada la hora y sin asistencia, cambia solo a «¿Vino?». Incluye el «Va bien». | Reagendar; pasada la hora, la asistencia | ⅓ · ½ · completo | dos tiempos, automático · número grande · renglón · banner «Va bien» | Fechas y asistencias (las asistencias nunca se apagan) | A medias: la hora y el link están guardados y no se dibujan |
| `calificacion` | Calificado, No calificado o Sin marcar, y si eso le llega a Meta. | Sí; se bloquea si consta que no vino a la R1 | ¼ · ⅓ | tres botones · chip · fila | Calificado | Sí; se saca el chip repetido de la R1 |
| `ingreso-estimado`<br>también en Pagos | Lo que se cree que vale el lead mientras está abierto, en USD. No es una venta: en un ganado se oculta. | Sí | ¼ · ⅓ | número grande · fila | — | Sí; MaKo no lo ve por su API |
| `tiempo-en-etapa` | «N días en <etapa>» contra el plazo que le pusiste a la etapa, en rojo si se pasó. Sin plazo, sólo los días. | No: la etapa se mueve en la cabecera | ¼ · ⅓ | chip con semáforo · barra contra el plazo · número grande | — | A medias: se calcula y no se dibuja |
| `motivo-de-salida` | Por qué se perdió o se descalificó. Sólo si salió, y se dibuja aunque esté vacío. | Sí | ⅓ · ½ · completo | texto · chips y texto | Motivo | Sí |
| `plazo-nutricion` | Hasta cuándo se lo sigue a mano. Sólo en la etapa de nutrición manual. | Sí (no se puede vaciar) | ¼ · ⅓ | fecha · cuenta regresiva | — (sin plazo, marca en rojo) | Sí |
| `lo-que-contesto` | Pregunta → respuesta de cada fuente: formulario de Meta, opt-in de la landing y agenda (Calendly o Cal.com). Cada fuente se calla si está vacía. Junta lo que hoy está en tres lugares. | No (lo escribió el lead); eliges fuentes y orden | ½ · completo | lista · tabla · una línea · tarjetas · plegado por fuente | — | A medias: las de la agenda están plegadas en Reuniones |
| `respuesta-destacada` | UNA respuesta en grande con la pregunta como título: «Presupuesto: USD 120.000», «Zona: Palermo». Se pueden poner varias. | Eliges la pregunta | ¼ · ⅓ · ½ | grande · chip · fila | — | No (las respuestas existen; fijar una es nuevo) |
| `origen`<br>también en Tracking | Canal de entrada, fuente, de dónde vino el clic y Campaña › Conjunto › Anuncio con «Abrir en Ads Manager». En redes, también cómo entró (comentario, historia, DM, anuncio). | No | ⅓ · ½ · completo | una línea · migas · chip | — | Sí, pero sólo en Tracking, que no siempre sale |
| `pagina-de-registro`<br>también en Tracking | La página donde dejó sus datos y cuándo. | No | ⅓ · ½ | una línea con el link · fila con la fecha | — | A medias: se sabe y no se guarda en el lead |
| `publicacion-de-entrada`<br>también en Tracking | La publicación o el Reel donde comentó, cuándo, la palabra clave y si ya le contestaste por privado. | No | ⅓ · ½ | una línea · miniatura y comentario | — | A medias: sólo el último comentario; la palabra clave se pierde |
| `charla-whatsapp` | Los últimos mensajes, quién escribió y hace cuánto. | Escribir y mandar | ½ · completo | último mensaje · últimos 3 · hilo | — | A medias: sólo en el celular |
| `charla-dm` | El @usuario, si la ventana de 24 h sigue abierta y cuánto le queda, y los últimos mensajes. | Contestar (decisión 3) | ½ · completo | ventana y último mensaje · hilo · chip «Ventana: 3 h» | — | A medias: el dato existe y nadie lo lee |
| `mensaje-listo`<br>también en Reuniones | El mensaje que MaKo dejó escrito y nadie mandó: seguimiento de la llamada, de la nutrición o uno manual. | Editar y mandar | ½ · completo | tarjeta con «Mandar» · renglón · sólo el de la llamada | — | A medias: hoy se manda desde WhatsApp |
| `automatizaciones-en-curso` | En qué automatización está, en qué paso, cuándo sale lo próximo y si se pausó porque respondió. Las de cobranza van en Pagos. | No (sacarlo o pausarlo no existe) | ½ · completo | lista · una línea · línea de tiempo | — | A medias |
| `lo-que-le-mandamos` | Todo lo que se le mandó por cualquier canal: si salió, si lo abrió, hizo clic o respondió, y si se dio de baja de los emails. El contador son los «toques». | No (el «+1 toque» a mano es nuevo) | ¼ · ⅓ · ½ · completo | contador de toques · línea de tiempo · por canal · sólo emails | — | A medias: los datos existen, el contador no |
| `notas`<br>también en CS · Resumen | Caja para escribir (adjunto, emojis, dictado) y la lista con autor y fecha. Son las mismas que ve Customer Success. | Crear, editar y borrar | ½ · completo | caja y lista · últimas 3 · la última | — | Sí |

**Para implementar.**
- Respaldo: los 10 interruptores de `CAMPOS_RESUMEN` (lib/resumen-ficha.ts:24-35) y el setting `crm.resumen.campos` (lib/resumen-ficha-config.ts:15).
- `siguiente-accion`: `siguienteAccion` (app/m/crm/reglas.ts:194-205). Casos nuevos con `ig_conversaciones.ventana_expira_at`, `chat_agent_handoffs.resuelto_at` y `cobros.estado`.
- `pase-a-humano`: `chat_agent_handoffs` (mensaje, motivo, escenario, resuelto_at). No aplica a Instagram, que no tiene AI Step (lib/plantillas-automatizaciones.ts:521-522).
- `posibles-duplicados`: `duplicadosDeLead` (lib/leads.ts:731) y la op `duplicados_lead` (lib/api-mako/areas/crm.def.ts:230).
- `cambios-de-mako`: `propuestas` (mig 0128; op `propuestas_lead_pendientes`, crm.def.ts:241), `mako_confirmaciones` (mig 0068), `resolverConfirmacionAction` (app/crm/mako-confirm-actions.ts:71).
- `contacto`: `InfoPrincipalCard` (app/crm/lead-view/InfoPrincipalCard.tsx:183-373); `saveLeadMetaAction` (app/crm/actions.ts:2280) → `saveLeadMeta` (lib/leads.ts:3067). StepIds `telefono` y `empresa` son higiene (lib/stage-requirements.ts:265-270); el email no es StepId. Te escriben, Carrito y Formulario de Meta apagan `empresa`.
- `redes-y-web`: Instagram con `InstagramEditable` → `guardarCampoLeadAction` (app/crm/actions.ts:2307); el resto con `saveLeadMetaAction`, que recorta a 300 (lib/leads.ts:3085). Migs 0194, 0258 y 0274. Hueco: `createLead` no recibe el usuario de Instagram (lib/zernio-entrante.ts:94, 168-175). Reemplaza 4 interruptores (lib/resumen-ficha.ts:25-29).
- `direccion`: `leads.direccion` (mig 0274). Meta no la llena (lib/meta-leads-campos.ts:49-54). `sexo`: `SexoEditable`, `esSexo` (lib/resumen-ficha.ts:59-64); ningún cliente medido lo usa.
- `setter-y-closer`: `PersonaEditable` (app/crm/lead-view/CampoEditable.tsx:416), hoy en ReunionesCard.tsx:238-244. El setter se exige en toda etapa que no sea `lead` (lib/stage-requirements.ts:267). `TAB_DE_DATO` (lib/datos-aviso.ts:131) pasa a apuntar a `resumen`.
- `proxima-reunion`: `junta_1_at`/`junta_2_at` (mig 0070) y `junta_1_url`/`junta_2_url` (mig 0204, faltan en el tipo `Lead`). `proximaReunionDe` (lib/lead-resumen.ts:121, sin exportar). El banner es `nutricionPositivaDe` (LeadSheet.tsx:243-252, page.tsx:213-218); el evento sale de `parseEvento` (lib/pipeline.ts:891-904). `reagendarReunionAction` (app/crm/actions.ts:2157). StepIds `fechaJ1`, `fechaJ2`, `asistenciaR1`, `asistenciaR2`; las asistencias están en `NO_IGNORABLES` (lib/datos-aviso.ts:28). La asistencia se repite a propósito con `reunion-1`/`reunion-2`.
- `calificacion`: `CalificacionCard` (app/crm/lead-view/CalificacionCard.tsx:46-83); `TriEditable` → `updateLead`, que dispara CAPI; `calificadoSeDescarta` (lib/calificado-reunion.ts:37). Sacar el chip de ReunionesCard.tsx:171.
- `ingreso-estimado`: `leads.ingreso_estimado` (mig 0258), `MontoEditable` (CampoEditable.tsx:489). Falta en `ficha_lead` (lib/mako-tools.ts:58-69). Las plantillas lo ponen sólo en el Resumen.
- `tiempo-en-etapa`: lib/lead-quieto.ts (`lead_funnel.etapa_desde`, líneas `Etapa` de `lead_audit`, `funnels.data.umbrales.porEtapa`).
- `motivo-de-salida` y `plazo-nutricion`: MotivoYPlazoCard.tsx:42-52 y 62-80. StepId `motivo`; el plazo no es StepId.
- `lo-que-contesto`: `RespuestasFormulario` (app/crm/lead-view/RespuestasFormulario.tsx:26-45, se calla en :31). Fuentes: `meta_field_data` (Meta lo borra a los 90 días), `optin_respuestas`, `lead_respuestas` (agenda) y las 6 columnas `respuesta_*` como respaldo de la R1 (lib/lead-resumen.ts:104-111). Una línea: `resumenRespuestas` (lib/meta-leads-campos.ts:222). No avisa `r2Respuestas` (lib/stage-requirements.ts:255-263). Las preguntas fijadas en `respuesta-destacada` no se repiten.
- `respuesta-destacada`: el motor ya busca en las respuestas (`respuesta_contiene`, lib/condiciones-catalogo.ts:460). No viene en ninguna plantilla.
- `origen`: `OrigenCard` (app/crm/lead-view/OrigenCard.tsx:97-162), `origen_lead` (app/crm/origen-lead.ts:28-77). El referrer se lee (lib/leads.ts:2496-2508) y no se dibuja. El subtipo social y el anuncio de un DM pagado no se guardan (lib/zernio-entrante.ts:172-174).
- `pagina-de-registro`: `paginaOptin` (app/api/track/optin/route.ts:166) no llega a `createLead` (:351-373). Mientras tanto, `landing_visits.landing_url` por `visitor_id`.
- `publicacion-de-entrada`: `ig_conversaciones.comentario_post_id`, `comentario_at`, `comentario_respondido_at` (mig 0242), pisados por el upsert de `filaDe` (lib/zernio-entrante.ts:90-107). El texto llega en lib/canal-social.ts:483 y se tira.
- `charla-whatsapp`: `hiloWhatsApp` (lib/crm-movil.ts:281); envío por `POST /api/whatsapp/evolution/mensajes`. La tab Chat se sacó en app/crm/[id]/page.tsx:200-208. Necesita línea de Evolution y teléfono.
- `charla-dm`: `ig_conversaciones` (username, ventana_expira_at; migs 0136 y 0242) e `ig_mensajes`, que nadie lee en app/crm ni en lib/crm-movil.ts. La plantilla «Te Escribieron por Instagram» manda `{{link_lead}}` a esta ficha (lib/plantillas-automatizaciones.ts:524-534).
- `mensaje-listo`: `wa_borradores` (mig 0074; origen nutricion, mako, manual o post_llamada; lib/post-llamada.ts) e `ig_mensajes` en estado `borrador`. Hoy sólo en /crm/[id]/resumen y el celular (lib/lead-resumen.ts:165-168).
- `automatizaciones-en-curso`: op `inscripciones_lead` (lib/api-mako/areas/chatbot.def.ts:190). `flujo_corridas` guarda el lead sólo en `ctx` (mig 0186) y las insistencias (mig 0180) no se leen.
- `lo-que-le-mandamos`: `wa_mensajes` (from_me), `ig_mensajes` (saliente), `nutricion_envios` (abierto_at, clic_at, respondio_at), `email_broadcast_envios`, `email_entrantes`; op `historial_email_lead` (lib/api-mako/areas/email.def.ts:133). Las condiciones son sí/no (lib/condiciones-catalogo.ts:610-611). `leads.email_opt_out` falta en el tipo `Lead`.
- `notas`: `NotasCard` (app/crm/lead-view/NotasCard.tsx:95-348); `addLeadNoteAction` (app/crm/actions.ts:2499); editar y borrar en app/crm/notas-actions.ts:95, 131.

### Reuniones

La tab sigue saliendo sólo si el funnel tiene una etapa de reunión. Cada bloque toma su título del nombre de la etapa y nunca dice «Reunión 1». Sale de aquí lo que no es una reunión: setter y closer van al Resumen, «Dijo que sí» a Pagos, las respuestas de la agenda a `lo-que-contesto` y el chip de calificado a `calificacion`.

| Bloque | Qué muestra | Se edita ahí | Tamaños | Diseños | Avisa si falta | Existe hoy |
|---|---|---|---|---|---|---|
| `reunion-1` | El primer encuentro con el nombre de su etapa («Agenda R1», «Webinar», «1ª sesión sin costo»): cuándo agendó, día y hora, link para entrar, si asistió, la grabación (sólo si el encuentro se graba) y links extra. En un evento, el lugar y la hora del funnel. | Fechas, asistencia (no sin fecha) y grabación; reagendar | ½ · completo | tarjeta completa · renglón · evento | Fecha, asistencia y grabación de la R1 | Sí; la hora y el link, a medias |
| `reunion-2` | Lo mismo para la R2, sin agendamiento. Sólo si hubo R2. | Igual que la R1 | ½ · completo | tarjeta completa · renglón | Fecha, asistencia y grabación de la R2 | Sí. Hay dos lugares: no se puede prometer una tercera |
| `agendar-reunion`<br>también en Resumen | Los horarios libres para la próxima reunión, o el botón para mandar el link de agenda. | Reservar ahí, o mandar el link | ⅓ · ½ | botón y horarios · chips de días · sólo «Mandar link» | — | A medias: sólo la R2, con Calendly y si tiene email; la R1 sólo en el celular |
| `lo-que-salio-de-la-llamada`<br>también en Resumen | Por cada llamada analizada: cómo terminó, el resumen, objeciones abiertas y respondidas, momentos, próximo paso y «Ver la llamada». | Volver a analizarla | ½ · completo | por reunión · sólo objeciones abiertas · sólo el próximo paso | — | Sí |
| `diagnostico-mako`<br>también en Resumen | Dolor, situación, señales de compra, objeciones, riesgos, próxima acción y preguntas para la próxima llamada. | Generar o regenerar | ½ · completo | tarjeta con secciones · sólo las preguntas · sólo riesgos y objeciones | — | A medias: hoy plegado en MaKo Analyst; sale de ahí |
| `ciclo-de-venta` | Agendó → R1 → R2 → dijo que sí → primer pago, con los días entre cada paso. En lo orgánico, «agendó a los N días de entrar». | No: cada fecha se edita en su bloque | ½ · completo | línea con días · número grande · cajas | — | A medias: las fechas existen, el cálculo no |
| `cohorte` | Madura, Madurando o Reciente, con «N días desde la R1». | No | ¼ | chip · número grande | — | Sí; pasa del Resumen a aquí |
| `coaching-de-la-llamada` | Puntaje de 0 a 10, dimensiones de la venta, fortalezas, qué mejorar y recomendaciones al closer. | No (se corrige en Closing) | ¼ · ⅓ · ½ | puntaje grande · barras por dimensión · recomendaciones | — | A medias: se trae y nadie lo dibuja; fuera de las plantillas (decisión 5) |

**Para implementar.**
- Webinar y presencial usan el lugar de la R1 (lib/funnel-etapas.ts:65-68). La tab sale con `tieneEtapaDeReunion` (lib/etapa-reunion.ts:132), que también elige la plantilla: la tab y la plantilla nunca se contradicen.
- `reunion-1` y `reunion-2`: `BloqueReunion` (app/crm/lead-view/ReunionesCard.tsx:42-116, montado en 149-175 y 176-188); `tuvoR2` (:132); `seGraba` (lib/pipeline.ts:1118). `FechaEditable` (fecha_agenda, fecha_junta_1/2), `TriEditable` (asistio_j1/j2), `EnlaceFathomEditable` → `guardarCampoLeadAction`. StepIds `fechaJ1`/`fechaJ2`, `asistenciaR1`/`asistenciaR2`, `fathomR1`/`fathomR2`.
- Salen de `ReunionesCard`: setter y closer (:238-244), `fecha_confirmacion` (:248-256), el chip de calificado (:171) y las respuestas de Calendly.
- `agendar-reunion`: `AgendarR2` (app/crm/lead-view/AgendarR2.tsx, exige email en :129); `huecosR2Action` y `reservarR2Action` (app/crm/agendar-r2-actions.ts:101, 126); `linkDeAgendaAction` (app/crm/actions.ts:3609). El celular agenda la R1 (app/m/crm/[id]/FichaLead.tsx:41-42).
- `lo-que-salio-de-la-llamada`: `InsightsLlamadaCard` (se calla en :84-97); `analizarLlamadaLeadAction` (app/crm/insights-actions.ts:29).
- `diagnostico-mako`: `GeneratedInsightCard` (app/crm/lead-view/GeneratedInsightCard.tsx:45-313); `generateLeadInsightAction` (app/crm/insights-actions.ts:14). Necesita una llamada analizada y no lee el WhatsApp (lib/lead-insights.ts:262-263).
- `ciclo-de-venta`: `created_at`, `fecha_agenda`, `fecha_junta_1/2`, `fecha_confirmacion` y `fecha_primer_pago` derivada (lib/pagos.ts:395). `cohorte`: `cohorteDeLead` (lib/leads.ts:2102).
- `coaching-de-la-llamada`: `getLeadInsights` ya trae score y dims (app/crm/actions.ts:188); strengths, weaknesses y recs están en `closing_analyses`.

### Tracking

En landing, lead magnet y carrito, el comportamiento es la prueba de intención. Se personaliza poco. El origen pasa al Resumen, así deja de esconderse detrás de la regla de la campaña de Meta (decisión 4). Sin visitas registradas, cada bloque se calla, y se termina el «No hay forma de reconstruirlo» dicho dos veces.

| Bloque | Qué muestra | Se edita ahí | Tamaños | Diseños | Avisa si falta | Existe hoy |
|---|---|---|---|---|---|---|
| `visitas`<br>también en Resumen | Cuántas veces visitó, en cuántos días distintos, la primera y la última vez, y el país, la región y la ciudad de la última. | No | ¼ · ⅓ · ½ | tres números · renglón «3 visitas · Monterrey, MX» · chip con la ciudad | — | A medias: la ubicación está guardada y no se lee |
| `video-visto`<br>también en Resumen | Por cada video: cuántas veces le dio play y hasta qué % llegó. | Sólo el nombre de los videos | ⅓ · ½ · completo | número grande con barra · tres cajitas · lista por video | — | Sí |
| `actividad-en-pagina` | Evento por evento: entró, tocó un botón (con su texto), bajó hasta el %, le dio play, retención, salida. | No | ½ · completo | línea de tiempo · sólo clics (¿tocó «Comprar»?) · por visita | — | Sí; salió, volvió, cerró y agendó se guardan y no se ven |
| `grabacion-de-visita` | Las sesiones grabadas de su visita, con «Ver la grabación», o por qué no hay. | No | ½ · completo | lista · sólo la última | — | Sí |
| `anuncio-de-origen`<br>también en Resumen | Lo que dice el video del anuncio que lo trajo, para saber qué promesa vio antes de dejar sus datos. | No | ½ · completo | 3 líneas y «ver entero» · texto completo | — | A medias: se guarda y sólo lo usa el diagnóstico |

**Para implementar.**
- La regla de hoy para que salga la tab: lib/tracking-ficha.ts:24-37 (pedida el 12/10, :4-5).
- `visitas`: `getVisitasLandingMap` (lib/leads.ts:3254), dentro de `ComportamientoCard`; ubicación en `landing_visits.pais`, `region`, `ciudad` (mig 0262). Necesita `visitor_id`.
- `video-visto`: `getVslEngagement` (lib/leads.ts:2273), en ComportamientoCard.tsx:122-292.
- `actividad-en-pagina`: `TrackingTimelineCard` (app/crm/lead-view/TrackingTimelineCard.tsx:68-139), tope de 40 eventos; los no dibujados en lib/leads.ts:2512-2535. Hoy repite el vacío de `ComportamientoCard`.
- `grabacion-de-visita`: `GrabacionCard` (app/crm/lead-view/GrabacionCard.tsx:79-116, ya se calla en :89).
- `anuncio-de-origen`: `ad_transcripts`, que el diagnóstico busca por `meta_ad_id` (lib/lead-insights.ts:371-378). El bloque lo busca con `adIdDeLead`, que también mira `utm_content`.

### Pagos

Hoy es una sola tarjeta fija que mezcla todo, y un ganado sin cargar dibuja unas 15 cajas con «—». No hacen falta plantillas de «antes» y «después» ni una por modelo de cobro: cada bloque decide solo si se dibuja, con la misma regla de hoy (si hay venta) y con el tipo de venta. La mensualidad aparece sólo en una suscripción y las cuotas sólo con plan. «Editar deal →» se va de todos lados en esta misma tanda, al cierre: primero cada bloque escribe su propio campo, porque hoy guardar el deal reemplaza sus datos enteros.

| Bloque | Qué muestra | Se edita ahí | Tamaños | Diseños | Avisa si falta | Existe hoy |
|---|---|---|---|---|---|---|
| `oferta` | La oferta asignada con su ticket y su modelo. La tarjeta suma la promesa, lo que incluye, la garantía, los bonos y la urgencia. | Asignar o crear; el contenido se edita en Offer | ⅓ · ½ · completo | desplegable con ticket · tarjeta de la oferta · renglón | — | Sí el desplegable; la tarjeta, a medias |
| `links-de-pago`<br>también en CS · Pagos | «Cobrar con link» y cada cobro de Stripe o Mercado Pago con su estado: pendiente, pagado, rechazado, reembolsado o anulado. | Crear, copiar y anular; devolver y cancelar, sólo el admin. Sin pasarela, «Conectar» sin salir de la tab | ½ · completo | botón y lista · sólo el pendiente más nuevo · chips | — | Sí. Ojo: una renovación rechazada se pinta en verde |
| `confirmacion-de-pago` | Cuándo dijo que compra y cuántos días van sin el primer pago, con «Cobrar con link» al lado. | La fecha | ¼ · ⅓ | caja con la fecha · alerta «confirmó hace N días y no pagó» | — | A medias: hoy está en Reuniones; la alerta es nueva |
| `venta` | Monto (o la mensualidad), fecha y tipo: Pago único, Suscripción o Becado. Un ganado por la página de gracias lo dice: «sin monto». | Campo por campo (nuevo) | ⅓ · ½ | tres cajas · renglón · número grande | Monto | A medias: hoy se edita sólo en «Editar deal» |
| `cobrado`<br>también en Resumen y CS | «$X cobrado de $Y», el %, lo pendiente y el semáforo; en una mensualidad activa, «Al día · próxima el …». Moneda original donde exista. En un becado no se dibuja. | No: sale de las cuotas. El chip del Resumen lleva a Pagos | ¼ · ⅓ · ½ · completo | número grande con barra · chip de semáforo · anillo | — | Sí, con una corrección: una mensualidad activa no está «Pagada por completo» |
| `cuotas`<br>también en CS · Pagos | El plan cuota por cuota (inicial, cobradas, por vencer y vencidas) con el comprobante y deshacer; arriba, inicial, cuota, cantidad y día de pago. Sin cuotas, arma el plan y dice si cuadra con el cierre. | Marcar pagada, deshacer y registrar otro pago; nuevo: editar una cuota, armar el plan y cobrar una cuota con link | ½ · completo | tabla · lista con chips · sólo la próxima · calendario | Plan y comprobante | A medias. Ojo: guardar el plan hoy rompe la cobranza |
| `suscripcion`<br>también en CS · Pagos | La mensualidad, el plazo (o «mes a mes»), activa o cancelada, el fin del plazo, las cobradas y si falló la última renovación. Sólo en una suscripción. | Mensualidad y plazo; cancelar, sólo el admin; registrar una cobrada a mano | ⅓ · ½ | número grande «$800/mes · activa» · tarjeta con el estado · línea de meses | Monto | A medias: el estado vive sólo en la pasarela |
| `recordatorios-de-cobro`<br>también en CS · Pagos | Qué recordatorio de cuota está corriendo y cuándo sale: «MaKo le recuerda la cuota 3 · jueves». Se corta solo al marcar el pago. | Cortarlo (pausar la cobranza no existe) | ⅓ · ½ | renglón · lista por cuota | — | A medias: no hay forma barata de leerlo por lead |
| `contrato`<br>también en CS · Pagos | El contrato firmado, con Ver y Descargar. | Subir, reemplazar y «Leer con IA», que llena sólo lo vacío | ⅓ · ½ | franja con botones · vista previa | — | A medias: subir y leer, sólo en «Editar deal» |
| `datos-fiscales`<br>también en CS · Pagos | Facturado por, razón social, identificación fiscal, domicilio, correo de facturación (si falta, el del lead) y el documento fiscal. | Campo por campo; subir el documento con lectura por IA | ½ · completo | grilla · lista compacta | Datos y documento fiscal | A medias |
| `servicio-vendido`<br>también en CS · Resumen | Qué es, inicio, término, duración, frecuencia, modalidad y sesiones, más el inicio cargado a mano. | Campo por campo | ½ · completo | grilla · renglón «16 semanas · 1 por semana · online» | Servicio | A medias |
| `promesa-y-garantia`<br>también en CS · Resumen | El resultado prometido y la garantía de este cliente. Comparada, al lado de la garantía de la oferta. | Los dos textos | ⅓ · ½ | dos cajas · cita destacada · comparada con la oferta | Promesa | A medias |
| `obligaciones`<br>también en CS · Resumen | Qué tiene que hacer el cliente y qué el prestador. | Agregar, editar y quitar renglones | ½ · completo | dos listas · tabla | Obligaciones | A medias |
| `excepciones` | Cerró sin R1 o sin R2, reunión sin grabar, sin documento fiscal o sin comprobantes, R2 agendada por fuera con su motivo. Sin ninguna, no se dibuja. | Quitarlas (nuevo) | ⅓ · ½ | chips · lista con el motivo | — | A medias: guardadas y no se ven |
| `cliente-en-cs` | En un ganado: estado del cliente, etapa de entrega y desde cuándo, acceso al curso y su cuenta de MaKo. Si está de baja con cuotas impagas, avisa que se le siguen cobrando. Cierra con «Abrir en Customer Success». | No: todo se edita en CS | ⅓ · ½ · completo | chips «Arranque · entró ayer · 40%» · checklist «listo para entregar» · tarjeta | — | A medias: hoy sólo se ve en CS (decisión 6) |

**Para implementar.**
- Hoy: `OfertaDelLead` + `DealDetailsCard` (app/crm/[id]/page.tsx:311). Cada bloque decide con `tieneDeal`/`muestraPagos` (lib/muestra-pagos.ts:37-42) y `venta_tipo`. A un lead sin compra le quedan la oferta y los links, como hoy (:41-42).
- Escritura por campo: `saveDealSectionsAction` (app/crm/[id]/deal-actions.ts:146) reemplaza los jsonb enteros (`deal_fiscal`, `deal_servicio`, promesa, obligaciones: :156-159). Cada bloque necesita su escritura que mergee, deje el diff en el historial y haga compare-and-set sobre `venta_tipo`. Recién entonces se van «Editar deal →» (LeadSheet.tsx:304) y `?edit=1`.
- `oferta`: `OfertaDelLead` (app/crm/lead-view/OfertaDelLead.tsx:35-131); `asignarOfertaLeadAction` y `crearOfertaDesdeLeadAction` (app/crm/oferta-lead-actions.ts:50, 63); tabla `ofertas` (migs 0169 y 0272).
- `links-de-pago`: CobrarConLink.tsx y CobrosDelLead.tsx (DealDetailsCard.tsx:494-506); acciones en app/crm/[id]/cobros-actions.ts:225-300. Trampa: una renovación rechazada queda en `cobros.motivo` de un cobro que sigue «Pagado» (lib/cobros.ts:594-597).
- `confirmacion-de-pago`: `fecha_confirmacion` (mig 0004). No es StepId. La alerta compara con `fecha_primer_pago` (lib/pagos.ts:395).
- `venta`: lectura en DealDetailsCard.tsx:542-574; el tipo sólo se cambia en el asistente; para salir de becado, `quitarSinCobroAction` (deal-actions.ts:211). La página de gracias gana sin monto (lib/landing-gracias.ts:17-20). StepId `monto`.
- `cobrado`: DealDetailsCard.tsx:348-359 y 542-574; corregir :358-359. Leer con `montoDeTarjeta`/`suscripcionDeFila` (lib/venta-tipo.ts), nunca con `monto_cierre_usd` pelado: en ws11 infló el MRR un 85% (docs/hallazgos-crm.md:7387-7416). Total: `sincronizarTotalCobrado` (lib/pagos.ts:395).
- `cuotas`: lista en DealDetailsCard.tsx:614-664. Marcar pagada a mano `marcarPagoManualAction` (deal-actions.ts:326), deshacer `marcarPagoAction` (app/crm/actions.ts:1175), otro pago `registrarPagoSueltoAction` (deal-actions.ts:348). Nuevo: `editarCuota(pagoId, {monto, fecha})` por id; armar el plan con `savePlanPagos` (lib/pagos.ts:123); cobrar una cuota: `crearCobro` ya acepta `pagoId` (lib/cobros.ts:202, 267) y `crearCobroAction` lo bloquea a propósito (cobros-actions.ts:220-224). **Trampa:** `saveCuotasAction` (deal-actions.ts:253) pasa por `saveLeadPlanManual`, que gana el lead en cada guardado (lib/pagos.ts:224) y borra e inserta todas las impagas (:247-263); eso rompe `cobros.pago_id`, el corte de la cobranza por `ctx.cuotaId` (lib/flujo-corridas.ts:188-201) y el dedup `cuota:${pago_id}` (lib/cobranza.ts:110-114). `cobro_inicial_usd`, `monto_cuota_usd`, `total_cuotas` y `dia_de_pago` se guardan y no se ven. StepIds `plan` y `comprobante`.
- `suscripcion`: compare-and-set (deal-actions.ts:169-178); `cancelarSuscripcionAction` (cobros-actions.ts:300). El estado vive en `cobros.suscripcion_estado`: al cancelar, el lead sólo cambia `suscripcion_meses` (lib/cobros.ts:634-646); la manual no tiene «cancelada». Cada renovación es otra fila de `pagos` (`esRenovacion`, lib/cobros-reglas.ts:53). El StepId `monto` se cumple con `suscripcion_monto_usd` (lib/stage-requirements.ts:243).
- `recordatorios-de-cobro`: `flujo_corridas` lleva `leadId` y `cuotaId` en `ctx` (lib/flujos.ts:42-45; app/api/cron/cobranza/route.ts:76, 93); `marcarPago` las corta (lib/pagos.ts:304-316). Sin columna `lead_id` (mig 0186).
- `contrato`: ver y descargar en DealDetailsCard.tsx:599-611; leer con `/api/extract-contract`. Reemplaza al «✦ Completar con IA», un link relativo que sólo anda en /crm/[id] (DealDetailsCard.tsx:524). No hay StepId.
- `datos-fiscales`: lectura en DealDetailsCard.tsx:702-758; mergear `deal_fiscal` (deal-actions.ts:156); documento con `/api/extract-deal-fiscal`; «Facturado por» con `identidades_fiscales` (deal-actions.ts:62). StepIds `dealFiscal` y `dealFiscalDoc`.
- `servicio-vendido`: DealDetailsCard.tsx:761-788, `deal_servicio` + `fecha_inicio_servicio` (deal-actions.ts:157); es la base del reloj del programa (lib/cs-contrato.ts). StepId `dealServicio`.
- `promesa-y-garantia`: DealDetailsCard.tsx:791-804 (deal-actions.ts:158), contra `ofertas.garantia`. StepId `dealPromesa`. `obligaciones`: DealDetailsCard.tsx:807-826 (deal-actions.ts:159). StepId `dealObligaciones`.
- `excepciones`: `sin_r1`, `sin_r2`, `fathom_omitido` (mig 0064); `deal_fiscal_doc_omitido`, `comprobante_omitido`, `r2_agenda_externa_motivo` (mig 0069). Hoy se declaran en `completeStageMoveAction` (app/crm/actions.ts:652).
- `cliente-en-cs`: `cs_clientes` (mig 0129), `cliente_entrega` (mig 0188), `curso_accesos`, `curso_progreso`, `cobros.alta_estado` (lib/cobros.ts:535-580). Escritor único en CS: `moverClienteDeEtapa` (lib/cs-mover-etapa.ts:152) y `FichaCurso`. **Trampa:** la baja no corta la cobranza: `getCuotasPendientes` (lib/pagos.ts:785-790) y `disparosDeCobranza` (lib/cobranza.ts:107-116) no miran `cs_clientes.estado`.

### Customer Success

La ficha de CS usa los mismos bloques con una plantilla fija «cliente», que no se personaliza en la v1 y no hereda la del CRM: si la heredara, le mostraría bloques de captación a alguien que ya compró. Queda sujeta a la decisión 6. Además de los bloques compartidos (`contacto`, `notas`, `cobrado`, `cuotas`, `suscripcion`, `links-de-pago`, `recordatorios-de-cobro`, `contrato`, `datos-fiscales`, `servicio-vendido`, `promesa-y-garantia`, `obligaciones`), tiene dos propios:

| Bloque | Qué muestra | Se edita ahí | Tamaños | Diseños | Avisa si falta | Existe hoy |
|---|---|---|---|---|---|---|
| `senal-de-atencion` | La señal de hoy: cuota vencida, sin contestar, silencio, contrato vencido, sin contrato o al día. «No lo sé» se dice distinto de «bien». | No: lleva al bloque que lo resuelve | ¼ · ⅓ · completo | chip · banner | — | Sí (en la cartera de CS) |
| `reloj-del-programa` | «Semana 6 de 16», con el arranque, el término y de dónde sale cada uno (contrato o ficha). Avisa si el programa ya terminó. Sin contrato, «—», nunca un número inventado. | No: se corrige en `servicio-vendido` | ¼ · ⅓ | barra de semanas · número grande | — | Sí (en CS) |

**Para implementar.** CS · Resumen hoy monta `InfoPrincipalCard` sin `resumen` (InfoPrincipalCard.tsx:260-261; app/customer-success/FichaPestanas.tsx:51-63). CS · Pagos monta el mismo `DealDetailsCard` sin oferta (FichaPestanas.tsx:81-85): con el armador, la herencia queda explícita y una cuota vencida se ve igual en las dos fichas. `senal-de-atencion`: lib/cs-senal.ts. `reloj-del-programa`: lib/cs-contrato.ts.

---

## 4. Plantillas por tipo de funnel

**Cómo se elige, sin preguntarte nada.** Se cuentan las etapas de reunión del funnel, con la misma regla que decide si sale la tab Reuniones:
1. Con **dos** → *Llamada con R1 y R2*.
2. Con **una** y un evento de fecha fija (webinar o sesión presencial) → *Evento*. Con una y sin evento → *Una llamada*.
3. Con **ninguna**, decide cómo entra la gente: carrito → *Carrito*; te escriben → *Te escriben*; tú les escribes → *Prospección*; formulario de Meta → *Formulario de Meta*; landing → *Landing con opt-in*.
4. Si nada aplica → *Respaldo* (la ficha de hoy, en bloques).

**Reglas que valen para todas.**
- Sólo se guarda lo que alguien cambió, así que un bloque nuevo del catálogo les llega a todos sin migrar nada.
- Si una plantilla no pone el bloque de un aviso, ese aviso nace apagado en ese funnel. Sacar un bloque a mano no apaga su aviso: «Completar» abre el asistente, como hoy. Las asistencias nunca se apagan.
- Si una plantilla no trae lista para una tab que igual sale (Tracking con una campaña de Meta asignada, por ejemplo), esa tab usa la lista del respaldo.

**Para implementar.** Reuniones: `tieneEtapaDeReunion` (lib/etapa-reunion.ts:132). Evento: `fechaFijaDelEvento(canalEfectivo(...))` (lib/pipeline.ts:1129; lib/fase-diagnostico.ts:390). Entrada: `tipoDeFunnel` (lib/pipeline.ts:863) y el canal `carrito`. No usar `funnels.canal` pelado: estaba en NULL en producción (docs/hallazgos-crm.md:164). Sólo lo cambiado, como `seVe` (lib/resumen-ficha.ts:12-15). Asistencias: `NO_IGNORABLES` (lib/datos-aviso.ts:28).

### Respaldo: sin plantilla

- **Resumen:** `proxima-reunion` → `contacto` → `redes-y-web` → `ingreso-estimado` → `calificacion` → `lo-que-contesto` → `origen` → `setter-y-closer` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** `reunion-1` → `reunion-2` → `agendar-reunion` → `lo-que-salio-de-la-llamada` → `cohorte`
- **Pagos:** `oferta` → `links-de-pago` → `confirmacion-de-pago` → `cobrado` → `venta` → `cuotas` → `suscripcion` → `contrato` → `datos-fiscales` → `servicio-vendido` → `promesa-y-garantia` → `obligaciones`
- **Tracking:** `visitas` → `video-visto` → `actividad-en-pagina` → `grabacion-de-visita`

Es lo de hoy pasado a bloques, sin perder nada. Suma al Resumen el origen y el setter y closer, que hoy quedan escondidos. El «Va bien» entra en la próxima reunión, la cohorte pasa a Reuniones y «Dijo que sí» a Pagos. Los avisos quedan como hoy.

### Llamada con R1 y R2 (high-ticket: VSL o formulario → agenda → R1 → R2 → cierre)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `cambios-de-mako` → `proxima-reunion` → `contacto` → `lo-que-contesto` → `video-visto` → `calificacion` → `setter-y-closer` → `tiempo-en-etapa` → `ingreso-estimado` → `cobrado` → `charla-whatsapp` → `origen` → `redes-y-web` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** `reunion-1` → `reunion-2` → `lo-que-salio-de-la-llamada` → `agendar-reunion` → `mensaje-listo` → `diagnostico-mako` → `cohorte` → `ciclo-de-venta`
- **Pagos:** `oferta` → `links-de-pago` → `confirmacion-de-pago` → `venta` → `cobrado` → `cuotas` → `suscripcion` → `recordatorios-de-cobro` → `contrato` → `datos-fiscales` → `servicio-vendido` → `promesa-y-garantia` → `obligaciones` → `excepciones` → `cliente-en-cs`
- **Tracking:** `visitas` → `anuncio-de-origen` → `actividad-en-pagina` → `grabacion-de-visita`

El Resumen es lo que el closer lee 30 segundos antes de entrar (cuándo, cuánto del VSL vio y qué contestó), lo que el setter necesita para contactarlo y lo que el dueño ve que se cae. En Reuniones, cada reunión al lado de lo que salió de ella, para preparar la R2 mirando la R1. En Pagos, con el lead abierto se ven la oferta, los links y «Dijo que sí»; con la venta aparece el resto. Todos los avisos del deal quedan prendidos: es el funnel para el que se diseñó el modelo (ws1). `charla-whatsapp` depende de la decisión 2.

### Una llamada (VSL o landing → agenda → R1 → cierre)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `proxima-reunion` → `contacto` → `lo-que-contesto` → `video-visto` → `calificacion` → `setter-y-closer` → `ingreso-estimado` → `cobrado` → `charla-whatsapp` → `origen` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** `reunion-1` → `lo-que-salio-de-la-llamada` → `agendar-reunion` → `mensaje-listo` → `diagnostico-mako` → `ciclo-de-venta`
- **Pagos:** `oferta` → `links-de-pago` → `confirmacion-de-pago` → `venta` → `cobrado` → `cuotas` → `suscripcion` → `contrato` → `datos-fiscales` → `servicio-vendido` → `promesa-y-garantia` → `obligaciones` → `cliente-en-cs`
- **Tracking:** la misma de *Llamada con R1 y R2*.

Es la que hoy siembra «Nuevo CRM» con «Llamada de venta». Con una sola llamada, la ficha gira alrededor de ella: si no vino, reagendar; si vino, mandar el seguimiento. El closer suele cerrar ahí mismo y mandar el link en vivo, por eso la oferta y los links van arriba. Ganado pide servicio, promesa, obligaciones y datos fiscales en todo funnel, así que sus bloques quedan puestos para que cada aviso tenga dónde completarse.

### Evento: webinar o sesión presencial (una etapa de reunión con fecha fija)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `proxima-reunion` → `contacto` → `charla-whatsapp` → `lo-que-contesto` → `lo-que-le-mandamos` → `automatizaciones-en-curso` → `setter-y-closer` → `tiempo-en-etapa` → `cobrado` → `origen` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** `reunion-1` → `ciclo-de-venta`
- **Pagos:** `suscripcion` → `cobrado` → `links-de-pago` → `cuotas` → `venta` → `oferta` → `recordatorios-de-cobro` → `cliente-en-cs`
- **Tracking:** sin lista propia.
- **Avisos que nacen apagados:** datos y documento fiscal, servicio, promesa y obligaciones (contrato tampoco va). Se suman con un toque.

Si se anotó, cuándo es el evento (con su lugar y hora), si le llegan los recordatorios y cuántos toques lleva. Es el caso de ws11: lista en frío por WhatsApp → 1ª sesión sin costo → mensualidad. La asistencia se marca a mano en el lugar de la R1, sin R2 ni grabación. En Pagos manda la mensualidad: 5 de las 9 suscripciones de ws11 se dibujaban en $0. No medí si ws11 usa contrato o datos fiscales.

### Formulario de Meta sin reunión (incluye inmobiliaria: ws15 y ws17)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `contacto` → `lo-que-contesto` → `calificacion` → `origen` → `charla-whatsapp` → `automatizaciones-en-curso` → `tiempo-en-etapa` → `setter-y-closer` → `ingreso-estimado` → `proxima-reunion` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** no sale (no hay etapa de reunión).
- **Pagos:** `oferta` → `links-de-pago` → `venta` → `cobrado`
- **Tracking:** `anuncio-de-origen` → `visitas` → `actividad-en-pagina`
- **Avisos que nacen apagados:** empresa, plan, servicio, promesa, obligaciones y datos fiscales.

Pesa lo que contestó y de qué anuncio vino. «¿Era calificado?» va arriba porque es lo único que aprende Meta, y «Sin moverse» porque decide la velocidad de contacto. La próxima reunión se calla salvo que reserve por Cal.com. Sin landing casi nunca hay visitas, así que en Tracking el anuncio es casi todo. Las cuotas quedan fuera porque cargar una reserva gana el lead. Una inmobiliaria suma `respuesta-destacada` (Zona, Presupuesto) con un toque: no es otra entrada, así que no tiene plantilla propia.

### Landing con opt-in sin reunión (incluye recurso gratis y el link de la bio o de YouTube)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `contacto` → `lo-que-contesto` → `pagina-de-registro` → `origen` → `proxima-reunion` → `charla-whatsapp` → `automatizaciones-en-curso` → `lo-que-le-mandamos` → `tiempo-en-etapa` → `calificacion` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** no sale.
- **Pagos:** `oferta` → `links-de-pago` → `venta` → `cobrado` → `cuotas` → `suscripcion`
- **Tracking:** `visitas` → `video-visto` → `actividad-en-pagina` → `grabacion-de-visita` → `anuncio-de-origen`
- **Avisos que nacen apagados:** servicio, promesa, obligaciones y datos fiscales.

Lo que completó, en qué página y si le llegó la nutrición le dicen al equipo cómo abrir la charla, aunque el funnel no tenga campaña de Meta. La próxima reunión cubre la landing con Cal.com sin etapa de reunión (ws13), donde hoy lo que contestó al reservar no se ve en ninguna tab. El recurso gratis no tiene registro por lead: mientras tanto, `lo-que-le-mandamos` muestra el envío. Es el funnel con más datos de comportamiento.

### Te escriben: WhatsApp, Instagram o Messenger (incluye el DM funnel)

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `charla-dm` → `charla-whatsapp` → `pase-a-humano` → `mensaje-listo` → `contacto` → `publicacion-de-entrada` → `origen` → `setter-y-closer` → `tiempo-en-etapa` → `automatizaciones-en-curso` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** no sale.
- **Pagos:** `oferta` → `links-de-pago` → `confirmacion-de-pago` → `venta` → `cobrado` → `suscripcion`
- **Tracking:** sin lista propia.
- **Avisos que nacen apagados:** calificado, empresa, plan, contrato y datos fiscales. El teléfono sigue avisando, porque pedirlo es parte de la charla.

La venta es la charla: sin ver la ventana de 24 h ni el pase a humano, el equipo contesta tarde. La publicación dice qué contenido trajo al lead. Se cobra con un link en medio de la charla, después del «sí, te pago».

### Prospección: tú les escribes (WhatsApp, Instagram o LinkedIn) y cierras por chat

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `contacto` → `redes-y-web` → `lo-que-le-mandamos` → `charla-whatsapp` → `charla-dm` → `tiempo-en-etapa` → `setter-y-closer` → `ingreso-estimado` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** no sale.
- **Pagos:** `oferta` → `links-de-pago` → `confirmacion-de-pago` → `venta` → `cobrado` → `suscripcion` → `cuotas`
- **Tracking:** sin lista propia.
- **Avisos que nacen apagados:** contrato y datos fiscales (el B2B de LinkedIn los suma con un toque).

Los toques y el tiempo sin moverse dicen a quién insistir. Las redes son la identidad del lead frío: LinkedIn va en el diseño «red destacada», elegido a mano. Si la prospección cierra en una sesión presencial, manda la etapa de reunión y gana *Evento*.

### Carrito / venta directa

- **Resumen:** `siguiente-accion` → `posibles-duplicados` → `contacto` → `cobrado` → `origen` → `lo-que-contesto` → `charla-whatsapp` → `notas` → `motivo-de-salida` → `plazo-nutricion`
- **Reuniones:** no sale.
- **Pagos:** `links-de-pago` → `venta` → `cobrado` → `suscripcion` → `oferta` → `cliente-en-cs`
- **Tracking:** `video-visto` → `actividad-en-pagina` → `grabacion-de-visita` → `visitas` → `anuncio-de-origen`
- **Avisos que nacen apagados:** setter, calificado, empresa, plan, servicio, promesa, obligaciones, datos y documento fiscal. El comprobante sólo se pide en un pago a mano.

Sin llamada, la pregunta es si compró y cuánto, y el chip de cobrado responde sin cambiar de tab. `venta` dice «sin monto» cuando la página de gracias lo ganó sin probar la compra. `cliente-en-cs` muestra si ya tiene su acceso al curso. Cuando no hay prueba de compra, el Tracking es la mejor señal: la actividad en «sólo clics» dice si tocó «Comprar» y no pagó.

### Cliente en Customer Success (plantilla fija, cualquier funnel)

- **CS · Resumen:** `senal-de-atencion` → `reloj-del-programa` → `contacto` → `cobrado` → `servicio-vendido` → `promesa-y-garantia` → `obligaciones` → `notas`
- **CS · Pagos:** `cobrado` → `cuotas` → `suscripcion` → `links-de-pago` → `recordatorios-de-cobro` → `contrato` → `datos-fiscales`

Al entregar, lo primero es si hay que mirarlo hoy, en qué semana va y qué se le prometió, que hoy está enterrado en Pagos. Servicio, promesa y obligaciones viven en el Resumen y no en Pagos, así no se repiten. CS le cobra a alguien que ya compró: sin oferta ni «Dijo que sí», con la cobranza arriba. Sujeta a la decisión 6.

---

## 5. Datos nuevos y descartes

### Datos que hacen falta

| Dato | Para | Cómo |
|---|---|---|
| La configuración de la ficha por funnel: por tab, la lista de bloque, ancho, diseño, ícono y aviso, y el tema de toda la ficha | todos | En `funnels.data.ficha`, sólo lo cambiado. El tema es el `TemaHoja` del Dashboard (lib/graficos-temas.ts:24: plantilla, acento y tipografía, con `sanearTema` y `varsDeTema`), no uno nuevo. Lo cambiado se guarda como `seVe` (lib/resumen-ficha.ts:12-15, 51-56). Respaldo: `crm.resumen.campos` y `crm.datos_aviso.apagados` (lib/datos-aviso-config.ts:23). Saneo y catálogo copian lib/general-vistas-modelo.ts (`BLOQUES_GENERAL` :32, `PLANTILLAS`). Con su op en la API de MaKo para leerla y cambiarla. |
| Lo que muestran los bloques, en la lectura de la ficha que usa MaKo | `redes-y-web`, `ingreso-estimado`, `lo-que-contesto`, `oferta`, `suscripcion` | `resumenLead` (lib/mako-tools.ts:58-69) no devuelve web, redes, ingreso estimado, opt-in, oferta ni tipo de venta, y usa `pipeline_stage` crudo en vez de `etapaVigenteDe`. Si no, MaKo dice «no hay» sobre lo que el equipo sí ve. |
| El @ de Instagram en el lead que entra por Instagram o Messenger | `redes-y-web`, `charla-dm` | Pasar `e.usuario` a `createLead` (lib/zernio-entrante.ts:168-175) y completar los viejos desde `ig_conversaciones.username` (:94). |
| La primera entrada social: cómo entró, el post, la palabra clave, el ref y el anuncio | `origen`, `publicacion-de-entrada` | Guardarla una vez al crear el lead (hoy `filaDe` pisa, lib/zernio-entrante.ts:90-107; el texto, lib/canal-social.ts:483, y el ref, :388 y 461, se tiran). El anuncio de un DM pagado va a `meta_ad_id` (:172-174). Una línea en `lead_audit` para el Recorrido: hoy Zernio no llama a `logLeadEvent`. |
| La página donde se registró | `pagina-de-registro` | Pasar `paginaOptin` (app/api/track/optin/route.ts:166) a `createLead` (:351-373); los viejos, por `landing_visits.landing_url`. |
| El lead consultable en las corridas de automatizaciones | `automatizaciones-en-curso`, `recordatorios-de-cobro` | Una columna o un índice sobre `ctx->>'leadId'` en `flujo_corridas` (mig 0186; lib/flujos.ts:42-45). |
| Estado de la suscripción y próxima renovación en un solo lugar | `suscripcion`, `cobrado` | Leer `cobros.suscripcion_estado` y el último rechazo (lib/cobros.ts:594-597, 634-646); guardar la próxima renovación que manda la pasarela; un «cancelada» propio para la manual. |
| Moneda original, concepto y método en el pago cargado a mano | `cuotas`, `cobrado` | `registrarPagoSueltoAction` y `marcarPagoManualAction` (deal-actions.ts:326, 348) sólo aceptan USD; `pagos.moneda` y `monto_original` los llena sólo la pasarela (mig 0255:117-118); `pagos.proveedor` admite sólo stripe o mercadopago (:115). Depende de la decisión 7. |
| Monto y producto de una compra fuera de la pasarela de MaKo | `venta`, `cobrado` | La página de gracias gana sin monto (lib/landing-gracias.ts:17-20) y no hay ingesta de Hotmart o Shopify. Mientras tanto, «sin monto» y ofrece cargarlo. |
| Un aviso de contacto para Instagram, email, LinkedIn y dirección | `redes-y-web`, `contacto`, `direccion` | Un StepId de higiene nuevo, que nunca frena mover (como setter, empresa y teléfono, lib/stage-requirements.ts:265-270), con la etapa desde la que se pide. Hoy son 21 y ninguno es de redes (lib/datos-aviso.ts:128-136). |
| Pasar respuestas del formulario de Meta a la ficha (ciudad → dirección, sexo) | `direccion`, `sexo` | Sumar el mapeo a lib/meta-leads-campos.ts:49-54, o una acción «Pasar a su ficha» en `lo-que-contesto`. |
| Campos propios del negocio por lead (zona, presupuesto, comprar o rentar, tipo de propiedad) | `respuesta-destacada` | No hay ninguna tabla de campos personalizados. Nacerían con la respuesta del formulario y con su aviso de higiene. |
| Un toque cargado a mano (LinkedIn, una llamada) | `lo-que-le-mandamos` | Un evento «Toque» con su canal en `lead_audit`, que el contador suma a los mensajes salientes y a los envíos. |
| Qué recurso gratis se le mandó y si lo abrió | un bloque futuro | Hoy el link viaja dentro del texto (lib/api-mako/areas/chatbot.def.ts:549; lib/variables-aviso.ts:360-361), y `lead_magnets` no tiene `funnel_id` (mig 0169:145-148). |
| Confirmó que viene (contestó el recordatorio) | `proxima-reunion` | Una marca al contestar el recordatorio, o a mano. Hoy sólo existe la asistencia, que se marca después. |
| Quién está en el grupo de WhatsApp del lanzamiento | `reunion-1` (diseño evento) | No hay tabla de grupos. La etapa `grupo` de la plantilla `vsl` (lib/pipeline.ts:1159-1170) no sabe quién está, y usa claves que el cálculo de etapa no conoce. |

### Lo que se descartó

- **Bloques que se juntaron con otro.** «La llamada» que cambia sola: repetía seis bloques, y la idea de que la ficha sepa la hora entra en `proxima-reunion`. «Su Instagram»: está en `redes-y-web` y `charla-dm`. «Llamar · WhatsApp · Agendar»: es la botonera de `contacto` más `agendar-reunion`. «Próxima cuota», «Armar el plan», «Registrar un pago», «Renovaciones», «Comprobantes» y «Estado del pago»: son diseños, estados vacíos o acciones de `cuotas`, `suscripcion` y `cobrado`. «Devoluciones»: ya está en `links-de-pago`. «Compra en la página»: es el «sin monto» de `venta`. «Emails» y «Toques»: diseños de `lo-que-le-mandamos`. «Listo para entregar», «Estado del cliente», «Entrega», «Curso» y «Cuenta de MaKo»: se juntan en `cliente-en-cs`, de sólo lectura, porque cada uno ya tiene su único escritor en CS.
- **Bloques que repetían algo fijo.** «Falta marcar» y «Le falta al deal»: repiten el «N sin marcar» de la cabecera; la regla de avisos de la plantilla y el asistente cubren lo que proponían. «Sus funnels» y «Etiquetas»: ya están en la cabecera. «Recorrido» y «Movimientos de plata»: viven en el Historial, que suma el filtro «Plata».
- **Bloques sin dato hoy.** «Comisión»: setter y closer son texto libre, no hay a quién atribuirla. «Por producto»: los pagos no tienen producto y no hay ningún cliente medido con upsell. «Dato suelto» genérico: no hay campos propios por lead. «¿Confirmó que viene?», «Grupo del lanzamiento», «Su recurso gratis» y «Lo que busca»: van a datos nuevos.
- **Datos en dos lugares.** Las respuestas de la agenda dentro de la reunión y el chip de calificado en la R1: cada dato queda en un solo bloque. `excepciones` va una sola vez, en Pagos, porque explica por qué a la venta le falta algo. `lo-que-contesto` no avisa por las respuestas de la R2: ese paso ya no se pide.
- **Vistas y plantillas que no van.** Tres Resúmenes por rol (setter, closer, dueño): triplican lo que hay que mantener y en un negocio chico el dueño es el closer; si se quieren, van como filtro de rol por bloque. Plantillas propias de inmobiliaria, lead magnet, DM funnel y LinkedIn: caen en la plantilla de su entrada. Plantilla de Pagos por modelo de cobro: cada bloque ya se dibuja solo según el tipo de venta. Tipos nuevos de CRM para elegir la plantilla: la plantilla sale de lo que el funnel ya tiene (sección 2).
- **Tabs.** Tab «Seguimiento»: la tab Chat se sacó a propósito; sus bloques van al Resumen. Renombrar Tracking a «Origen»: el origen pasa al Resumen y lo que queda es comportamiento.
- **El orden de «Editar deal →».** No se saca antes de que cada bloque de Pagos escriba su campo, porque hoy guardar reemplaza los datos del deal enteros y guardar las cuotas gana el lead y reemplaza las impagas. Se saca al cierre de la misma tanda, con `?edit=1` y «Completar con IA».
- **Para después.** Sugerencias de MaKo según los datos del funnel (fijar «Presupuesto» si la mayoría lo contestó): piden contar datos por funnel, que no existe. «Red destacada» elegida sola según la plataforma: no hay un dato de plataforma por funnel.
- **Diseño.** Una grilla de alto fijo como la del Dashboard: los bloques sólo tienen ancho y el alto lo da el contenido. Tipografía y colores por bloque: van para toda la ficha, en el tema, porque bloque por bloque la ficha deja de leerse como una sola.
