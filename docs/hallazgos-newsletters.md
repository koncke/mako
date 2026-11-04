# Hallazgos — Newsletter

Lo que hay que saber ANTES de tocar el Newsletter (tab `/newsletters`, `lib/newsletter*.ts`). El modelo lo aprobó Martín
el 29/10/2026 («Sí, armalo así»): los suscriptos son un CRM «Newsletter» y las ediciones viven en la tab. La regla que
gobierna el código nuevo está en AGENTS.md → «Una edición del newsletter es un BROADCAST del CRM Newsletter».

## Lo que devolvió la revisión de envíos y privacidad, y por qué (30/10/2026)

**Vive en:** app/newsletters/puerta.ts · `repartirVencidas` (lib/newsletter-reglas.ts) · `procesarBroadcastsProgramados`
(lib/email-marketing.ts) · `destinatariosDeNewsletter` (lib/newsletter.ts) · tests/newsletter-revision-3010.test.ts (15 roturas, 15
rojos). El informe entero: C:/dev/revisiones/2910-revision-privacidad-newsletter-85d2206c9.md.

- **`adminOnly` en nav.ts NO es una puerta: sólo esconde la fila de la barra.** La tab decía «sólo el super admin la ve», y era
  cierto para la barra. El server tenía `requireRolWs([], { nav })`, y `[]` deja pasar al admin de CADA negocio con capa completo o
  agencia, en la tab y en la API. **Regla:** lo que está en PRONTO se cierra en el server (`puertaNewsletter`) y en la API
  (`soloPlataforma`). En el go-live del email se sacan las dos cosas juntas.
- **«Enviar ahora» sobre una programada duplica.** Las dos corridas leen «nadie la recibió» antes de la primera tanda de 100. La API
  ya se negaba; la tab no. Ahora se niega también, y hay que desprogramarla primero. Es la misma pregunta en dos puertas: si se
  agrega una tercera, va la misma guarda.
- **Lo programado con el envío apagado se quemaba al prender.** La más vieja salía con un «este viernes…» de hace un mes, y las
  demás caían en el guard de 20 h: quedaban marcadas como enviadas sin haber salido. Ahora, en el cron: más de 24 h vencida
  vuelve a borrador, y de varias vencidas del mismo CRM sale sólo la última. 24 h porque de noche el cron no corre (va de 13 a 23
  UTC) y una legítima puede esperar hasta 14 h. Los broadcasts comunes no cambiaron: siguen saliendo vencidos, como avisa
  `activar_envio_real_email`.
- **Archivar el CRM no frenaba nada:** `archivarFunnel` apaga `activo` y nada más, y los leads siguen colgados. Ahora el cron cancela
  esas ediciones (`cancelado`: si restauran el CRM, se ven y se pueden volver a programar) y los destinatarios dan vacío.
- **Si no se pueden leer los CRM, las ediciones esperan** a la próxima corrida y los broadcasts comunes siguen. Tirar acá frenaba
  todos los envíos del negocio por un dato que sólo necesitan las ediciones.

**Quedó SIN hacer, antes de sacarlo de PRONTO:**
- M5: el interruptor de una landing convierte en suscriptos a todos los que dejan su email ahí (y si la landing no tenía CRM, los saca
  del tablero de ventas), y el «me dieron permiso» de la importación nada lo exige. Es una decisión de producto: se la pregunta a Martín.
- Las bajas del informe: un escáner de links hace un GET suelto que da de baja, la API ofrece `etapa: 'ganado'` y esa edición nunca se
  crea, y «Enviar ahora» sale sin confirmación y sin el tope de 2.000.
- La carrera de M2 y el envío real no se reprodujeron contra la base: están probados en el código.

*30/10/2026, chat «CRM» (claude1).*

## «Dormido» sin tracking: una edición de la que no llegó ninguna apertura no mide nada (29/10)

**El síntoma que habría aparecido:** a la tercera edición, TODA la lista pasaba a «Dormido».
**La causa:** las aperturas llegan por el webhook de Resend, que valida UN signing secret, el de la cuenta de MaKo
(`lib/resend.ts`, el pendiente F2 de la bitácora del área). Un negocio con su propia key de Resend, o con el webhook sin
configurar, manda igual y no registra ni una apertura: «no abrió» y «no lo pudimos medir» se ven iguales.
**La regla (`etapaPorLectura`, lib/newsletter-reglas.ts):** una edición sin NINGUNA apertura de nadie no cuenta
(`medida: false`). Con una lista de dos personas eso demora un dormido real: es el lado seguro. Tampoco cuentan los
envíos `simulado` (con el envío apagado no salió nada), `saltado` (el guard de 20 h) ni `fallo`; y una sin abrir espera
72 h antes de contar (la gente abre al otro día). El filtro vive en la regla pura, no en la consulta: una sola copia.

## Con el envío apagado, «Enviar ahora» QUEMA la edición (29/10)

`enviarBroadcast` con el flag apagado registra todo `simulado` y marca la edición `enviado`: el guard de re-entrada la
bloquea para siempre y a nadie le llegó. Ya estaba anotado para la API (`lib/api-mako/areas/email.run.ts`); en la tab,
«Enviar ahora» se niega con el envío apagado. Lo que sí anda apagado: la vista previa, la prueba (va SÓLO al email de
quien la pide, no a una dirección escrita) y programar (el cron saltea el negocio y la edición espera; ⚠️ el día que
se prenda, salen juntas todas las programadas vencidas).

## La bienvenida pedía una etiqueta que nadie pone (29/10)

**El diagnóstico obvio era el equivocado:** «falta una automatización de bienvenida». Ya existía en la galería
(«Alguien Se Suscribió», `email-newsletter`), pero arrancaba con una ETIQUETA, y a un suscripto no lo etiqueta nadie: entra
al CRM por la landing, la importación o desde otro CRM. Ahora arranca con la etapa (`pide: 'etapa_venta'`) y la persona
elige «Newsletter › Suscripto». Era la única plantilla con `pide: 'etiqueta'`: esa mecánica sigue (el editor del CRON la
ofrece) y su test quedó sin plantilla.

## «Suscripto» tiene que ser la clave canónica `lead` (29/10)

El opt-in de la landing (`app/api/track/optin/route.ts`) nunca escribe `pipeline_stage`: el lead deriva su etapa
(`deriveStageKey` → `lead`). Con una clave propia (`suscripto`) el tablero lo dibujaba en la primera columna por descarte
y la bienvenida (`etapa_actual` sobre Suscripto) no lo encontraba nunca. Las otras tres (`nl_lee`, `nl_dormido`,
`nl_baja`) son propias a propósito: a ellas sólo se llega moviendo, que es lo que hace la conciliación.

## El CRM se crea SIN producto, y el CRM le agrega etapas solo (29/10)

- `crearCrm` / `crearProductoConFunnel` crean producto + oferta + embudo: el Newsletter aparecía como una oferta más en
  Offer. Con `crearFunnel` solo, igual se ve en el desplegable del CRM y en el CRON de Automations: los dos listan
  FUNNELS (`listarFunnels`, `productosConEtapas`), no productos.
- `generateFunnel` agrega SIEMPRE `ganado` y las tres salidas, y siembra «Nutrición - Manual», «No agendó» desde la etapa
  de entrada y «Reactivación» desde las salidas. Las tres nutriciones se apagan con `APAGADAS_NEWSLETTER`; `ganado` va en
  el pipeline con el nombre «Compró» (renombrarlo es lo único permitido).
- El nombre es único por negocio entre los archivados también (`funnels_nombre_uk`): si «Newsletter» existe y no lo
  creó la tab, se crea «Newsletter 2» en vez de adoptar un CRM con otras etapas.

## Los suscriptos son la CASA y los AGREGADOS (29/10)

Los que vienen de otro CRM no cambian de casa: son una fila de `lead_funnel` con la etapa de ESTE tablero. Leer sólo
`leads.funnel_id` dejaba afuera a todos ellos (la falla de las cohortes de un CRM con agregados). `suscriptosDe` lee las
dos; para un agregado, `leads.estado_lead` es de su casa (una venta perdida) y no lo saca del newsletter.

## Una edición se deriva del segmento, y `newsletter:1%` también trae al 12 (29/10)

No hay columna «es edición»: lo es el broadcast con segmento `newsletter:<funnelId>[:<etapa>]`. El `like` de PostgREST
trae `newsletter:12` al pedir `newsletter:1%`: se filtra después por el segmento parseado. El calendario lee por el
prefijo solo (un negocio tiene un CRM de newsletter).

## Lo que quedó SIN hacer

- **Abrirla a todos los negocios**: la fila sigue en PRONTO (`app/_components/nav.ts`, sólo el super admin). Va con el
  go-live del email (decisión de Martín) y la mueve el chat Sidebar; al sacarla de «Coming soon» la piden
  `tests/funciones-mako.test.ts` y `tests/movil-toda-tab.test.ts`.
- **La plantilla «Newsletter» del Copywriter** la hace el chat del Copywriter (`lib/copywriter/plantillas.ts`). El enganche:
  `escribirEnCopywriterAction` busca `plantillaPorId(cats, 'newsletter')` y, sin ella, usa la de email; lee ASUNTO,
  VISTA PREVIA, CUERPO y BOTON (`edicionDelDoc`).
- **«Agregar a otro funnel» desde el tablero del CRM no pide el permiso** cuando el destino es el Newsletter
  (`app/crm/lead-funnel-actions.ts`); la tab sí lo pide antes de importar o traer. Es del chat del CRM.
- **El formulario de la landing no tiene casilla de consentimiento** (no hay tipo checkbox en
  `lib/editor-landing/especificacion.ts`): dejar el email en una landing del newsletter cuenta como el permiso.
- **Una landing con dominio propio** se asigna desde /integraciones: el interruptor de la tab usa la URL pública del Web
  Generator (`urlPublicaLanding`).
- **La bienvenida no sale en el acto** para quien entra por la landing: el opt-in no llama a `enrolarPorEvento`, así que la
  toma el barrido de la hora.
- **La conciliación lee todos los suscriptos** cada 30 min (cron de broadcasts, sólo con el envío prendido). Alcanza hasta
  unos miles; con listas grandes, conciliar sólo lo que cambió.
- **La migración 0351** (baja por edición y el guion del Copywriter) no está aplicada: la pide el Cerebro a Martín.
