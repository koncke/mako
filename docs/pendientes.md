# Lo pendiente — capa del 31/10/2026 (LA MÁS NUEVA, y el registro vivo)

<sub>Lo de abajo (24/10 y 17/10) **puede estar hecho**: esta noche se repartieron seis cosas que ya estaban
terminadas porque nadie las había tachado. **Antes de implementar cualquier punto de este archivo, medílo contra el
código.** Y si hay un pedido POSTERIOR de Martín que lo contradiga, **manda el posterior**.</sub>

<sub>Martín, 31/10: «Intenta que no se te olvide nada de nada… tu eres el encargado de que no se te olvide nada».
Este bloque es ese registro. **Cruza tres fuentes**: `pendientes-30-10.md` (el cierre de la cuenta claude3, con la
llamada de Leila), lo de abajo, y lo que entró o se repartió el 30 y 31/10.</sub>

## ⏰ CON FECHA — esto es lo único que no se puede correr

| Cuándo | Qué | Estado |
|---|---|---|
| **Lunes 2/11, 12 h (hora de Leila)** | Reunión con Leila. Martín le prometió **los errores resueltos antes** (4.3) para que empiece los tutoriales | Carruseles y el horario de automatizaciones: en el tren. **El segundo nombre: recién arrancado** |
| **Jueves 5/11, 17 h** | Reunión con Thiago | Las 3 fallas de Agency: **en el tren** |
| **Black November** (arranca ya) | La campaña de Leila a toda su base | **Bloqueada por el segundo nombre** |

## ALERTAS DEL CLIENTE DE UNA AGENCIA (31/10, ticket #37)

- **Las dos filas de la plataforma (ws 9), ANTES del deploy:** `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --env=C:/dev/mako-api/.env.local --eventos=meta_cuenta_frenada_agencia,meta_cuenta_recuperada_agencia --aplicar`. Sin ellas la alerta de Meta de un cliente de agencia no le sale a nadie. Simulacro del 31/10: crea las dos, prendidas.
- **El texto de la fila viva #261:** dos estados siguen diciendo «Tu cuenta» sin «publicitaria» (`gracia` y `liquidacion`). La plantilla ya está corregida, pero no se copia a una fila que existe. Se edita en Automations de SuperAdmin.
- **El correo del rechazo avisa una pausa que hoy no pasa:** el corte de acceso está apagado (`CORTE_DE_ACCESO_PRENDIDO`, `lib/plan-acceso-reglas.ts`).

## ~~LO QUE FALTA EL DÍA QUE SE CONECTE CREEM (31/10)~~ — CERRADO: Creem rechazó la tienda (5/11/2026)

Creem rechazó la tienda de MaKo el 5/11/2026 y es definitivo (sus términos, §20.6, no reabren a personas conectadas):
lo que esta sección pedía medir con una clave de Creem ya no se va a medir. Las siete trampas siguen en git
(`git show e5036fc58:docs/pendientes.md`) y el mapa del barrido en [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md) →
«El barrido del 31/10», por si la próxima pasarela tiene las mismas. Lo que se sacó de MaKo: [relevo/nube-creem-fuera.md](relevo/nube-creem-fuera.md).

## 🔴 Lo que bloquea una campaña de un cliente — EN MARCHA (CRM, 31/10)

Del `pendientes-30-10.md`, sección 5. Todo esto es de **Leila para Black November**:

- **El segundo nombre** (2.1 · 4.5 · 5.4, **ALTA**). Sus contactos son «[país] Nombre Apellido» («MX Nadia Calderón»),
  así que hoy el saludo sale **«Hola MX»**. Hace falta elegir primer, segundo, tercer nombre o completo. ⚠️ **Si no se
  puede determinar, no se inventa**: mejor sin nombre que «Hola Kun».
- **Segmentar en tres ramas** (5.2): no hicieron la Academia / sí la hicieron / dueños de negocio.
- **Importar su CRM exportado** de la academia (5.3) — no quiere rehacerlo adentro.
- **Variantes de mensaje con arranque gradual** (5.8). La lección del número de Mauricio bloqueado 24 h: ~60 mensajes
  idénticos. Con Automations.
- **Métricas clicables** (5.11 / 2.3): que «respondieron 8» muestre quiénes.
- **Ver el nombre como lo agendó ella o como se llama él** (2.2 / 5.5).
- ⚠️ **La lógica del embudo (5.6) NO es código**: Leila necesita que Martín la ayude a definir condiciones y etiquetas.

## 🟡 En marcha ahora, con dueño (31/10 madrugada)

| Qué | Quién | Estado |
|---|---|---|
| El segundo nombre y Black November | CRM | recién arrancado |
| El WhatsApp en el checkout, junto al nombre y el email | Planes (con Ops Center) | Martín lo pidió el 31/10 y **revierte** mi decisión de pedirlo después de pagar |
| ~~La pasarela **Creem** (tercera pasarela, LatAm y USD)~~ | Martín | **rechazada el 5/11/2026, definitivo**; se pasa a otro proveedor, todavía sin elegir ([creem-retiros.md](creem-retiros.md), [relevo/nube-creem-fuera.md](relevo/nube-creem-fuera.md)) |
| **Competitors Spy**: plan y qué repo copiar | nube | arrancado |
| **El diseño de los dashboards aplicado** (las 8 piezas del Dashboard) | nube | arrancado |
| El tope del chequeo y por qué 1.028 archivos no ejecutaban | nube | **cerrado**, en el tren |
| **El umbral de «Runner vivo» sale de su intervalo real**: hoy `CARTERO_VIVO_MS` es un número suelto en `lib/operaciones-reglas.ts`. El cartero (`scripts/operaciones/cartero.mjs`) tiene que publicar cada cuánto pasa, y MaKo guardarlo en `operaciones_carteros`, con migración. El síntoma ya está curado: la pantalla dice desde cuándo no hay noticias | Runner | **sin empezar**, a propósito: pedido por el Cerebro el 31/10, va cuando se vacíe la cola del tren. Causa en `docs/hallazgos-operaciones.md` |

## 🟢 En el tren, esperando producción (164 commits, `integracion`)

Carruseles (el chat recuerda, pone fotos, arma todas las páginas) · el cartel del Media Buyer que mentía · los datos
personales de 82 personas · el acceso de Agency con dos dueños y la baja que no se podía terminar · el scraper con
aviso y confirmación · el homónimo que impedía comprar · los 6 meses avisando 14 días antes · el clic derecho · el
Video Generator · el 50% del primer mes (apagado hasta que el cobro descuente) · la prueba gratis apagable · Settings ·
la herramienta del push que decía «rojo» cuando no podía chequear.

## ⚪ SIN DUEÑO todavía — lo que falta construir

1. **Knowledge** (el conocimiento de los cursos para toda MaKo, modular como el Second Brain). **El esqueleto está
   construido** y espera en la etiqueta `nube/knowledge-3110` (no es rama: no dispara build). El análisis que acá decía
   «pausado» SÍ existía —21/07, tres decisiones de Martín— en un transcript que un barrido de seguridad borró del repo;
   está resumido en docs/hallazgos-conocimiento.md → «Knowledge: el conocimiento de los cursos para TODA la app».
   **No es una tab nueva**: se ve en Classroom › Methodology (el pedido del 25/10 manda sobre el análisis del 21/07).
   Hay 7 módulos por tema (`lib/knowledge-modulos.ts`), capa del Second Brain, índice en el prompt de todos los chats,
   dos operaciones de la API y la pantalla con cuánto tiene cargado cada uno. **Lo que falta: la CURACIÓN** —destilar
   los cursos en fichas, que Martín decidió hacer afuera de la app por los créditos de IA— y las «plantillas de
   influencers» del pedido del 30/10 (3.2), de las que no hay análisis en ninguna parte y cuyos links scrapeados no
   están en el repo. ⚠️ Una ficha cargada desde la pantalla sale con `fuente: 'manual'` y **no le llega a ningún
   negocio**: la curación escribe `fuente: 'mako'`.
2. **Lead Magnet Generator** y **las tendencias del nicho**. Hay relevamiento, falta el plan.
3. **MaKo toma la iniciativa, completo**: el primer ingreso (bienvenida, cargar la oferta, elegir funnel) y las
   aperturas tab por tab — Offer, Create, CRM, Dashboard, Automations, Web Generator, Calendario, Video, Image,
   Classroom, AI Avatar y Mobile.
4. **Plantillas con estructura y «Ver ejemplo»** en todas las tabs (está sólo en Copywriter), **privadas o públicas, con
   estrellas** (2.5 · 2.6 · 3.7 · 4.8).
5. **Los patrones de email del Gmail** (70 remitentes, ~5.050 emails) usados de verdad en Copywriter, Newsletter,
   recordatorios y WhatsApp.
6. **Video Editor**: la cabecera, Motion, **subtítulos con resaltado y presets por marca** (1.14 · 2.7), **edición
   automática con B-roll tipo Submagic** (2.15 · 4.9) y **clips mágicos tipo Opus Clip** (2.8).
7. **El recorrido visual**: 8 de 22 pantallas miradas, 22 problemas sin repartir, 14 pantallas sin mirar.
8. **Lo de la llamada con Thiago que no existe** (`docs/promesas/2910-llamada-thiago.md`).
9. **Elementos de marketing en las landings** (2.10, «súper importante»): cuenta regresiva, prueba social, escasez.
10. **Carruseles también en Web Generator** (2.14 · 3.9 · 4.10).
11. **Strategy / el Estratega** (3.3): hoy sólo Meta Ads.
12. **Guía de IA por pestaña** (3.6 · 4.17) · **QA automático con Claude** (3.8 · 4.11).
13. **Conectar GPT desde la computadora** (1.12 · 4.13).

(Image sin Gemini, el brand board en el Second Brain (2.9, con los carruseles con la marca completa, 1.3) y «Discutir |
Editar» en los chats de Image y Video (2.12 · 4.12) salieron en `punta/image-marca` el 5/11: docs/relevo/nube-image-marca.md.)

## 🔵 Volvió con fallas — lo retoma quien lo tenga

- **Calendario y Classroom**: 4 fallas en Clientes, una de privacidad. Detrás espera el botón de MaKo que tapa
  contenido en Calendario, Plan, CRM y Dashboard.
- **Newsletter**: cualquier admin entra a la tab y a su API; doble envío en «Enviar ahora»; lo programado sale vencido.
  Hoy sin riesgo porque nadie tiene el email prendido.

## 🟣 Lo que es de Martín (nadie más puede)

- **El secreto del webhook de Mercado Pago** y **el de Creem** (sin eso, un pago aprobado no se asienta).
- **Cada cuánto se actualiza el precio en pesos** (hoy $73.555 y $151.805, al blue del 31/10).
- **Si les avisa a Código Inmobiliario y P2P Consulting** por los datos de sus leads.
- **En qué landing vio los placeholders tapados** (el único de sus 24 puntos que nadie pudo reproducir).
- **Probar un pago real** antes de publicar anuncios.
- **La lógica del embudo de Black November** con Leila.
- **Extraer un grupo** con el scraper en su Chrome, para confirmar la vuelta a MaKo.
- Generar un look real del AI Avatar · mandarle a Thiago la grabación · el clic de la prueba de Zernio · decidir
  LinkedIn · **la política de reembolso** (al apagar la prueba gratis, la ley argentina da 10 días de arrepentimiento).

# Lo que quedó pendiente — capa del 24/10/2026 (la más nueva)

<sub>Abajo sigue la foto del 17/10, que no se tocó. **Esta capa es la que vale hoy**: lo de abajo puede estar hecho.
Los pedidos de Martín del 24/10, textuales, están en [`feedback-24-10.md`](feedback-24-10.md).</sub>

**`main` = `59d228ea1`, verificado en producción el 24/10 ~23:00 ART.**

## Trabado esperando a Martín (nadie puede avanzar sin esto)

| # | Qué | Por qué traba |
|---|---|---|
| M3 | **URGENTE: aplicar a Paddle** (Creem rechazó la tienda el 5/11/2026, definitivo: [creem-retiros.md](creem-retiros.md)) | Sin pasarela no hay cobro en línea: medido el 30/10 en producción, /planes/esencial dice «Todavía no cobramos en línea» y sólo deja dejar los datos. **Stripe no es opción: Argentina no es país habilitado** |
| M5 | **Mauricio:** el redirect del Payment Link con `{CHECKOUT_SESSION_ID}` | Su página de venta ya está restaurada; falta eso |
| M6 | **La foto del buscador de Instagram** (Mauricio y la plataforma): vincular el Instagram de MaKo a su página y sumar `instagram_basic` al token. Y para cuentas personales, decidir si se usa la extensión con la sesión de la persona | Gratis, sólo cuentas de empresa o creador, y anda con la rama `crm-instagram-3010` subida. Lo de las personales es un endpoint no oficial, con MaKo en App Review. Detalle: docs/hallazgos-crm.md, en esa rama |

## Sin hacer, con dueño

| # | Qué | Dónde vive | Origen |
|---|---|---|---|
| ⚠️ A0 | **Un lead borrado se lleva en cascada sus envíos, y quién lo borró no quedó registrado.** Cualquier cosa que le haya pasado a un lead borrado es irreconstruible, y no sabemos quién borra. Es un agujero de trazabilidad, no un bug de automatizaciones: 4.457 filas de historial de leads que ya no existen, y la papelera en 0 en todos los negocios (a los 30 días se purga, y dos caminos no pasan por ella). | `docs/hallazgos-crm.md` (arriba); `lib/leads-papelera.ts`, `lib/leads-unificar.ts:190`, `lib/zernio-entrante.ts:235` | Automations, 30/10 |
| ⚠️ A1 | **Un mensaje de IA más adelante en el flujo puede quedar para aprobar sin que lo diga: el aviso mira sólo el primero.** El aviso al activar vuelve a decir algo que no es exacto, un paso más adentro. | `lib/ritmo-al-activar.ts` (`primeroQuedaParaAprobar`); la regla de todo el flujo ya está en `dejaBorradores`, lib/mensajes-por-aprobar.ts | Automations, 30/10 |
| P2 | **Los 6 pedidos trabados** (le llegaron al Cerebro de la cuenta 2, cerrado): los dos del dictado, CERRADOS (arreglados en 9b5cc7e76); «Sí, y que la criatura vea la hoja» → Automations; ticket #8 (adjuntos del Ops Center) y las opciones que no se tocan en el teléfono → Ops Center; tickets #5 y #6 (MaKo no le contesta a Mauricio) → el Cerebro verifica si la red de plataforma del 24/10 ya lo resuelve | repartidos el 24/10 por la cuenta 5 | 20 puntos, #7 |
| P2 | **Los 6 pedidos trabados** (le llegaron al Cerebro de la cuenta 2, cerrado): los dos del dictado, CERRADOS (arreglados en 9b5cc7e76); «Sí, y que la criatura vea la hoja» → Automations; ticket #8 (adjuntos del Ops Center), arreglado el 25/10 (`enMemoria`, `ERROR_SUBIDA`; causa la más probable, no se vio pasar: si vuelve, el aviso dice cuál de las tres fue); las opciones que no se tocan en el teléfono, CERRADAS el 24/10 (era un AskUserQuestion, docs/hallazgos-operaciones.md); tickets #5 y #6 (MaKo no le contesta a Mauricio) → el Cerebro verifica si la red de plataforma del 24/10 ya lo resuelve | repartidos el 24/10 por la cuenta 5 | 20 puntos, #7 |
| P3 | **Login en el navegador de la app + app de escritorio con todas las tabs + Mac y Linux** | Instalador | 20 puntos, #10 |
| P4 | **El contenido de cada sección de Settings** (Perfil, Seguridad, Notificaciones): rehecho el 25-26/10 con el molde de Linear (docs/relevo/settings.md). Falta mirarlo en producción, con la sesión de Martín | Ops Center | 20 puntos, #9 |
| P5 | **El clic derecho en los 11 chats embebidos y en el lienzo del editor.** Es UNA pieza (`HiloMako`), no once: relevo escrito, sin implementar | Landings | editor web, #2 |
| P6 | **Sacar los datos personales de `vsl_events.landing_url`** (`?name=`/`?email=` en claro) y avisarle a la agencia de Código Inmobiliario. **El código está cerrado (30/10, rama `nube/pii-vsl-events`)**: la entrada pasa por una lista BLANCA (`PARAMS_QUE_SE_GUARDAN`, lib/url-datos-personales.ts) —la lista negra del 24/10 dejaba pasar el `attendeeName` de Cal.com— y lo ya guardado lo limpia la migración `0357_urls_sin_datos_personales.sql`, ensayada en seco contra producción (665 filas cambian, 0 quedan con datos). **Faltan dos cosas, las dos de decisión:** (a) **aplicar la 0357** en producción (la aplica el Cerebro, DESPUÉS del deploy); (b) **avisarle o no a la agencia**: lo decide Martín, con los datos de la medición en docs/hallazgos-landing.md → «El arreglo del 24/10 estaba desplegado y la fuga seguía entrando» | Ventas (apagado) | 6 puntos, #2 |
| P5 | **Responder con clic derecho en Automations** (acordado aparte). Copiar anda en todos (`HiloMako`), el lienzo tiene su menú y las listas su clic derecho; Responder ya está en el resto (`useCitaDelChat`) | Landings | editor web, #2 |
| P6 | **Sacar los datos personales de `vsl_events.landing_url`** (`?name=`/`?email=` en claro) y avisarle a la agencia de Código Inmobiliario | Ventas (apagado) | 6 puntos, #2 |
| P7 | **El cartero como servicio de escritorio** | `docs/diseno-cartero-servicio.md` | 20 puntos, #16 |
| P8 | **El recolector del Second Brain** | `docs/diseno-second-brain-recolector.md` | 20 puntos, #17 |
| P11 | **Verificar que el aviso de «cuenta de anuncios frenada por falta de pago»** llegue al grupo | Avisos | 20 puntos, #4 |
| P17 | **El funnel de lanzamiento no cobra hasta conectar una pasarela real**: `/planes` dice «Quiero…». Falta además un cobro real que mida el 50% en Stripe y `PUT /preapproval` en Mercado Pago, y cargar los precios en pesos | Planes · `lib/primer-mes.ts` · `lib/planes-mako.ts` | [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md), 30/10 |
| P18 | **Dos decisiones de Martín por el 50%**: si Partners sigue pagando el primer mes a precio de lista aunque haya entrado a mitad, y si «lo pagado no se reembolsa» sigue igual sin prueba previa (Ley 24.240, art. 34, 10 días) | Planes · `lib/partners-reglas.ts` · `app/reembolsos/page.tsx` | [hallazgos-planes-y-cobro.md](hallazgos-planes-y-cobro.md), 30/10 |
| P13 | **Los grabadores que faltan (26/10, chat «grabadores»).** Hecho: tl;dv, Fireflies, Zoom y Otter se leen como Fathom (capa `lib/grabadores`); Loom, Read AI y Google Meet tienen tarjeta que dice por qué no se conectan. Falta: **(a)** aplicar la migración `0338_reuniones_de_cualquier_grabador.sql` (con el sí de Martín; el orden con el deploy da igual: sin ella, «Leer igual» y «Volver a analizar» no abren una reunión que no es de Fathom, y Customer Success deja esperando sus sesiones sin gastarles intentos); **(b)** Read AI con su OAuth 2.1 (registro dinámico, token de 10 min que rota): probar si acepta la vuelta a MaKo antes de dibujar el botón; **(c)** Google Meet: pedir el permiso `meetings.space.readonly` (sensible) en la verificación de la app de Google; **(d)** Grain, MeetGeek, Avoma, Granola y Krisp tienen API con clave (medido): tarjeta + lector con el molde de tl;dv; **(e)** medir con una cuenta real de cada uno (la lista de Otter no se pudo medir sin Enterprise; el aviso TranscriptReady de tl;dv no coincide con su ejemplo) | `lib/grabadores/`, `docs/hallazgos-integraciones.md` → «Los grabadores de reuniones» | Martín, 26/10 ~01:50 |
| P12 | **Fathom en MaKo + Closing Script en vivo.** Martín, 25/10: «Depreca Fathom... Replica esa app en MaKo. Si ya tenemos la extensión, la app desktop y todo, estoy seguro que existe un repo o algo que reemplace... Esto nos va a permitir implementar lo que teniamos pensado de "Closing Script" que MaKo te acompañe en tus llamadas de venta, transcriba en tiempo real y te de recomendaciones de closing... (Todo esto de farhom y closing, dejalo anotado para mas tarde, seguro lo haga con otra cuenta)». Grabar y transcribir las llamadas con la extensión o MaKo Desktop (buscar un repo abierto que haga lo de Fathom), y sobre eso el acompañamiento en vivo. Fathom queda hasta que esto ande | sin dueño: lo arranca Martín con otra cuenta | docs/feedback-25-10-tarde.md |
| P14 | **Agency, lo que dejó abierto la re-verificación de plata (en `05d2ded3c`, sin tocar).** MEDIA: una fila de cartera cargada a mano sobre el negocio de Mauricio o sobre un Pro directo deja que la agencia lo pause o lo rebaje (el 29/10 no había ninguna). BAJAS: H5 levanta el corte de más (un plan propio cancelado o devuelto que todavía cubre días); la pausa programada no se actualizó con H5; «Elegir Esencial» sin cobros es de ida y no lo avisa. De antes: el link viejo sin cerrar en `lib/cobros.ts`, la baja con la suscripción ya cancelada en la pasarela, H7 | Agency · `lib/plan-acceso-reglas.ts` · `lib/agencia-plan.ts` · `lib/agencia-baja.ts` · `lib/cobros.ts` | `C:/dev/revisiones/2910-reverificacion-plata-agency-28cc3e2cb.md` |
| P15 | **Las pantallas de Agency preguntan con `agenciaDeCliente` (en `05d2ded3c`):** con dos dueños contesta null, así que el cliente de dos agencias entra al Agency Dashboard. La pregunta correcta es `esClienteDeAgencia`. Hoy ningún cliente tiene dos | Agency · `app/agency/page.tsx` · `app/m/agency/page.tsx` | [hallazgos-agencias.md](hallazgos-agencias.md), 30/10 |

## Sin verificar en pantalla (está en producción, nadie lo miró)

- El primer aviso previo de unos 6 meses gratis va a salir recién 14 días antes de que terminen unos reales: mirarlo en el log del cron (`[cron:aviso-fin-de-prueba] planes a mano: …`).
- «Quieren entrar» (rama `quieren-entrar-3010`), al desplegarse: la bandeja de Customers › Accounts, el cartel arriba de las pestañas, la lista en el teléfono, el mensaje del login a quien rebota, que es lo único que ve esa persona, y la opción «6 meses gratis» del diálogo del plan, lo primero que va a tocar Martín; con eso, la fecha en la ficha de Customers, en Accounts y en «Tu plan», y el título y las tarjetas nuevos de /planes

- El **aviso al activar una automatización** (cuántos, a qué ritmo y entre qué horas), al desplegar: el interruptor, el «⋯» con «Poner goteo» / «Poner horario» y el teléfono; y **el de las ya prendidas sin goteo o sin horario**, en su pantalla, su tarjeta y el teléfono. Probado con tests y con el dato real, no en el navegador (`lib/ritmo-al-activar.ts`). El texto de «queda para aprobar» nunca se leyó con un caso real
- La **barra única del editor web a 1280** (es la de más riesgo: entra título, guardado, Compartir, Publicar y ⋯)
- El **«Creando…»** de los «+» del editor de etapas (se prueba en el **Cliente de Prueba**, nunca en un cliente real)
- El **selector de funnel del teléfono**
- Las **dos columnas** del desplegable de etapas de la ficha
- Que el **403 esté arreglado desde la app desplegada** (se midió que el bloqueo es por UA y no por IP, pero no se
  probó desde los rangos de Vercel)
- El **cartel de los mensajes sin entregar** y el **botón del Uso** como super admin (101eaea96, cuando se despliegue), y su **hoja en el teléfono** (`SheetM`), que el arnés
  no monta. Con los 8 mensajes reales: los tickets #5, #6 y #8 y 5 respuestas. Necesita la sesión de Martín: el Chrome disponible está con la de Leandro
- **Settings en producción, lo que falta:** mirado el 30/10 como super admin, con main `e8b3eb040` (docs/hallazgos-ajustes.md). Falta **«Tu plan»** con un negocio que pague (la plataforma no lo tiene: sólo se vio en el banco), Integraciones y las secciones de negocio en el teléfono, y los arreglos del 30/10, cuando se desplieguen
- **La flecha de la sidebar con la ventana por debajo de 1200 px y en /admin/operaciones.** /crm, /plan y /automations quedaron verificadas en producción el 30/10
- **Una cuenta sin computadora conectada:** «Instalar MaKo» en vez de la caja en Automations, Offer, Web Generator, Dashboard y el «Editar con IA» de una sección; «Probar nuevo diseño» no pide nada
- **Strategy › «Cómo cobrar MaKo»** (/admin/estrategia/cobrar) como super admin, en la app desplegada: si el .md no viajó al deploy, la pantalla dice «No se pudo leer la investigación»

## Rojos en `main` sin dueño — se cerraron todos (30/10/2026)

Ninguno. Los tres que había (`vuelo-mako`, `dashboard-pedidos-chat`, `paso-ia`) estaban VERDES: se arreglaron el 24/10 a las 20:58
y 20:59, 95 minutos después de que se escribiera esta sección, y quedaron acá seis días hasta que se repartieron a dos chats que no
tenían nada que arreglar. Lo que lo caza ahora es `scripts/pendientes-vencidos.mjs` (avisa en cada push, no bloquea).

Los otros dos **ya estaban arreglados cuando se anotaron acá** y se cerraron el 30/10 sin tocar una línea de código:
`tests/vuelo-mako.test.ts` por 85e4cd7db y `tests/dashboard-pedidos-chat.test.ts:129` por 583c29434, los dos el 24/10
a las 20:58 y 20:59 — 95 minutos después de esta lista. Verificados en verde sobre `origin/main` (6/0 y 10/0) y probados
rompiéndolos (5/1 y 9/1): los dos tests tienen dientes. **Antes de tomar un rojo de acá, correlo sobre `origin/main`**
→ `docs/hallazgos-infra.md` → «Dos «rojos en `main` sin dueño» que ya estaban arreglados».
- `tests/vuelo-mako.test.ts` — `app/automations/ChatMako.tsx` perdió la criatura al unificar los chats (`d85c86611`)
- `tests/dashboard-pedidos-chat.test.ts:129` — `PanelEditarMako`

---

# Lo que quedó pendiente (17/10/2026 noche)

Inventario de TODO lo pendiente de las implementaciones de MaKo, pedido por Martín el 17/10. La foto de la mañana (296 puntos, commit 5e77ecebb)
**se concilió a la noche**: se cruzó con los 678 commits del día y con los relevos (docs/relevo/) y hallazgos (docs/hallazgos-*.md) que se tocaron,
y cada punto se marcó como hecho (sale de la lista), a medias (queda con «a medias: falta X») o sigue. Se sumó lo que los relevos anotaron como
«para después del 20/10», los interruptores APAGADOS por la revisión adversarial y los defectos de las revisiones.
**Es una foto con fecha**: antes de tomar un punto, mirá su fuente y el `git log` del archivo. Al cerrar uno, borralo de acá en el mismo commit.

De los 296 de la mañana se cerraron 100 hoy (abajo, para que los revises), 29 quedan a medias y 167 siguen como estaban. Se sumaron 25 nuevos.

**Quedan 221 pendientes.**

14 le fallan hoy a un cliente y 42 son de plata, seguridad o envíos.

82 dependen de vos (una clave, un permiso, una decisión); el resto lo pueden hacer los chats. 4 están en curso ahora (un agente trabajando).

Orden: por impacto (cliente roto > plata y riesgo > traba a Martín > traba a un chat > feature > pulido) y, adentro, lo que se puede hacer ya primero.
«Se puede hacer ya» quiere decir que no espera a nadie: por el corte de consumo del Cerebro (la semanal de la cuenta 4 iba al 79%) casi todo eso arranca recién al renovarse la semana (mar 20/10 16:59), salvo que pases la app a otra cuenta con margen.

## Le falla a un cliente (14)

- **Ads (Mauricio, ws1)** — La cuenta de anuncios «Cuenta 2» está frenada por Meta desde el 15/10 por un saldo impago de 8.743,59 MXN: la campaña 030 está activa y no entrega. _Mauricio no tiene pauta desde hace 9 días; es el 6.º episodio desde agosto_ · chico · **depende de Martín** (que Mauricio pague o cambie el medio de pago) · `docs/hallazgos-ads.md → «Un día sin filas de Meta no es "sin sincronizar"» (24/10)`
- **Avisos** — MaKo dejó de avisarle a Mauricio de su cuenta frenada el 16/10: el techo de 3 avisos por estado se compara con la marca heredada (26). Decidir si un incidente abierto varios días vuelve a avisar (por ejemplo, una vez por día) y separar la cuenta que comparten el ws1 y el ws4. _el cliente no se entera de que no tiene pauta_ · chico · **depende de Martín** · `docs/hallazgos-comunicacion.md → «Una alerta con el techo agotado se calla…» (24/10)`
- **Automations** — **MEDIR en producción el goteo y el reloj de las esperas** que subieron el 24/10/2026 a la tarde (629500245 + cdadbc30f, tren 43c343ebd, deploy Ready ~18:06 ART). Al subirlos no había nada que medir: las 24 inscriptas de «Sprint · apertura» (#289, Mauricio) ya tenían su M1, y lo próximo era lo agendado ANTES del deploy, que no se recalcula (los M2 desde las 21:33 ART del 24/10, cada 12 min: su ritmo no prueba nada). **Cómo:** `node --env-file=<clon>/dashboard-marketing/.env.local --conditions=react-server --import tsx scripts/medir-goteo-tras-deploy.mts` (sólo lectura, todas las automatizaciones con goteo). **Qué tiene que dar:**
  1. la espera que queda después de cada M2 de la #289, agendada a **último mensaje + 48,00 h** exactas, sin minutos de más. Se ve desde la noche del 24/10;
  2. la **mediana** del intervalo entre M1 nuevos, ~11 min y no 22. Antes, el mínimo «cumplía» y lo que delataba el defecto era la mediana;
  3. que tras cada M1 nuevo la espera quede agendada en 1-2 min, no en 11 o 22: «Contestó» ya no toma turno.

  Los puntos 2 y 3 necesitan M1 NUEVOS, es decir, que Mauricio mueva más leads a «Prospección activa». Si algo no da, se revierte sólo esto: la tag es `respaldo/tren-2410-noche`. Al medirlo, borrar este punto y cosechar en docs/hallazgos-chatbot.md. _si el arreglo no hace lo que dice, el segundo mensaje le llega a la gente un día tarde y la campaña sale a la mitad del ritmo_ · chico · se puede hacer ya · `docs/hallazgos-chatbot.md → «Y la espera contaba desde que el motor procesaba la condición…» (24/10); scripts/medir-goteo-tras-deploy.mts`

- **Automations** — El aviso «en 30 min tenés la reunión» al dueño sólo sale con Calendly: con Cal.com (Código Inmobiliario) no llega. _el cliente que agenda por Cal.com se pierde el recordatorio_ · chico · se puede hacer ya · `docs/hallazgos-chatbot.md → Séptima tanda; app/api/cron/reunion-recordatorio/route.ts (recorre sólo 'calendly')`
- **Automations** — Una automatización sin disparador se puede prender y queda callada (le pasó a Brigitte). _el cliente la ve activa y no le escribe a nadie_ · chico · se puede hacer ya · `docs/hallazgos-chatbot.md → «Las automatizaciones de Brigitte (ws15)…» (17/10)`
- **Automations** — El disparador «Un lead escribe por WhatsApp» murió con Chatwoot, y el CRM automático no lee el número de empresa. _la automatización que espera respuesta no arranca y el CRM puede mover a «No responde» a quien sí escribió_ · medio · se puede hacer ya · `docs/relevo/avisos-y-whatsapp.md → 3.8 y decisión 5.5; docs/relevo/seguridad-aislamiento.md §2.5`
- **MaKo en WhatsApp** — Confirmar con un pedido real que el Calendar de Pablo (ws18) ya anda. _el arreglo nunca se probó contra una agenda real_ · chico · se puede hacer ya · `docs/relevo/mako-en-whatsapp.md §3 (el arreglo 8d90f8357 llegó después de su último turno: espera un pedido real)`
- **Ads Manager** — Ver si Código Inmobiliario, Leila y P2P ya pueden publicar anuncios (Meta les rechazaba los creativos) — a medias: falta una corrida en seco (validate_only) sobre la cuenta de cada uno; medido el 17/10: nadie reconectó (ws13 y ws14 con «Joan P2P app», ws11 con «Lidermente_Agent»). _su app de Meta estaba en desarrollo y no se sabe si reconectaron_ · chico · **depende de Martín** · `docs/relevo/ads-manager.md → Medido (17/10)`
- **Avisos** — Brigitte (ws15) no recibe el reporte semanal: no tiene email y los reportes ya no van por WhatsApp. _hay que pedirle un email o elegir otro canal_ · chico · **depende de Martín** · `docs/relevo/avisos-y-whatsapp.md → 1.3 y decisión 5.4`
- **Email** — Poner una key de Resend con acceso total: hoy ningún negocio puede conectar su dominio de email. _el cliente choca con el error al conectar_ · chico · **depende de Martín** · `docs/hallazgos-comunicacion.md → «Tu API key es restringida» (17/10); docs/relevo/chatbot.md`
- **IA** — La cuenta de OpenAI de la plataforma está sin crédito: la memoria de cada negocio y la transcripción de anuncios fallan para todos. _desde el 07/10 MaKo contesta sin lo aprendido; cargar crédito o pasar a un proveedor gratis y reindexar_ · chico · **depende de Martín** · `memory/ia-red-audio-y-openai-sin-credito.md; docs/hallazgos-ia.md → SIN HACER (16/10)`
- **Instagram** — Cargar en producción las claves de Zernio y el secreto de su webhook. _sin eso Instagram y Messenger no andan para quien no tiene key propia_ · chico · **depende de Martín** · `docs/relevo/instagram-afuera-y-curso.md; docs/relevo/chatbot.md; memory/instagram-canal-plan.md`
- **Instagram** — La cuenta de Zernio de Leila está pausada por falta de pago, así que su Instagram y su Messenger no andan. _sus automatizaciones de Instagram no contestan. Hay que avisarle_ · chico · **depende de Martín** · `docs/relevo/chatbot.md → «De las tandas 6.ª y 7.ª» (ws11, error 402)`
- **Landing / Pixel** — Código Inmobiliario, Leila, P2P y el ws4 no graban visitas hasta pegar la línea nueva del Pixel (escribirles o hacerlo nosotros). _sin grabaciones ni mapa de calor; P2P no tiene canal para el aviso_ · chico · **depende de Martín** · `docs/hallazgos-landing.md (14/10); docs/relevo/pixel-clarity-landing.md §4.1; docs/relevo/integraciones.md`
- **MaKo en WhatsApp** — Código Inmobiliario tiene una sola key de IA: si Google se satura, MaKo no contesta; sumar otra key o una red paga de último recurso. _es gasto de IA y lo decidís vos_ · chico · **depende de Martín** · `docs/relevo/mako-en-whatsapp.md §4; memory/ia-red-audio-y-openai-sin-credito.md`
- **Plan / Reuniones** — Cambiar la key de Gemini de Mauricio (Google la bloqueó) y extraer a mano sus reuniones del 8 al 15/10. _sus compromisos de esas reuniones no llegaron al Plan_ · chico · **depende de Martín** · `docs/hallazgos-ia.md → «Quién sigue llamando a la Gemini muerta del ws1»; docs/hallazgos-plan.md (15/10)`
- **Video / Ads** — Montar un anuncio desde el chat: la API sólo lee el montaje, no existe `montar_anuncio_video`. _medido en 366993012; un video pedido por chat no sale armado_ · medio · `docs/hallazgos-video-pipeline.md §14`
- **Video / Ads** — Renderizar un video pedido por chat, en servidor de MaKo y en MaKo Desktop (Martín, 25/10: las dos vías). Hoy el Video Editor exporta sólo en el navegador. _medido en 366993012_ · grande · `docs/hallazgos-video-pipeline.md §14`
- **Video / Ads** — Los dos montajes de septiembre (Mauricio y Leila) quedaron fallidos por vencidos y nadie los volvió a pedir: montarlos de nuevo es decisión de producto. Y el alta en Epidemic Sound. _medido en 366993012_ · chico · **depende de Martín** · `docs/hallazgos-video-pipeline.md §14`

## Plata, seguridad y envíos (42)

- **CRM** — Las cuotas de la ficha (Pagos › Cuotas) de a una, sin «Armar el plan» (el plan uniforme), con el aviso cuando no
  suman la venta: **HECHO, esperando la revisión adversarial. NO está en main.**
  - Está en `c7ff7d7fc` (tag `respaldo/crm-diseno-t17-2410`, rama local `crm-cuotas-espera-revision` en `C:/dev/wt-crm-grupo`),
    encima de main 59d228ea1. **No se reimplementa: se revisa y se sube.** El commit trae el código, el test (5 roturas probadas)
    y la regla en docs/hallazgos-pagos.md.
  - El Cerebro lo dejó para después del lanzamiento del 25/10: toca plata, y la revisión la hizo el mismo chat que lo escribió.
  - _un plan mal armado cobra de más o de menos_ · chico · espera una revisión con agentes (otra cuenta, con RAM) ·
    `docs/feedback-diseno-pendiente.md → «Modelo de cuotas simple en todos lados»`

- **Automations** — Si la base falla, «No reprodujo el VSL» se cumple para todos y la automatización inscribe a todos los leads. _salen mensajes a quien no corresponde_ · chico · se puede hacer ya · `docs/hallazgos-crm.md → _listLeads; docs/hallazgos-chatbot.md (tercera tanda)`
- **Automations** — Los mensajes de una secuencia no tienen candado: el cron y la vía rápida pueden mandar dos veces. _el lead recibe el mismo WhatsApp dos veces_ · medio · se puede hacer ya · `docs/hallazgos-comunicacion.md → El paso ⚡ Acción, SIN HACER`
- **Automations** — Un cambio pedido al chat del lienzo puede reescribir otra tarjeta que nadie nombró y llevarse un link. _sale un mensaje roto a los leads_ · medio · se puede hacer ya · `docs/hallazgos-chatbot.md → «El chat del lienzo editaba cuando le preguntabas» (15/10)`
- **Avisos** — Revisar en la base las automatizaciones viejas (#239 y #240) que citan un texto que el código ya no arma, y los flujos de /mensajes que insisten. _pueden salirle a un cliente mensajes vacíos o repetidos_ · chico · se puede hacer ya · `docs/inventario-nada-por-detras.md → Sin verificar`
- **Cobros / Planes** — Quien deja de pagar sigue entrando: el corte por falta de pago está hecho pero APAGADO (CORTE_DE_ACCESO_PRENDIDO = false) por la revisión adversarial — a medias: falta arreglar 4 defectos (el cron sólo ve cobros con alta_ws y deja afuera al plan nuevo de una cuenta que ya existía; un primer pago DEVUELTO pausa a quien paga; las cuotas de los lugares se leen sin paginar; el tope de 5 y el orden de los pasos) y recién prenderlo. _darse de baja corta el cobro pero no el acceso_ · grande · se puede hacer ya · `docs/relevo/pagos.md → APAGADOS por la revisión adversarial; lib/plan-acceso-reglas.ts`
- **Cobros / Planes** — El corte por plan en la API y el cartel «no está en tu plan» están hechos pero APAGADOS (CORTE_POR_PLAN_PRENDIDO = false) — a medias: falta arreglar que un negocio con capa pm que entra por /inicio a /general ve «No está en tu plan», y prenderlo. _lo que no compró se puede usar por la API_ · grande · se puede hacer ya · `docs/relevo/pagos.md → APAGADOS; lib/api-tab.ts`
- **CRM** — El «Deshacer» del historial ya no pisa lo que cambió otro; el guardado de «Información principal» en CS puede seguir pisando lo de otra persona — a medias: falta mirar el guardado de «Información principal» en CS (no se verificó). _se pierden datos del lead sin aviso_ · chico · se puede hacer ya · `docs/relevo/crm.md §0-Ω15; docs/hallazgos-crm.md`
- **CRM** — El «Deshacer» del tablero de una abierta a Ganado borra el monto y su rastro, «Restaurar» pone la fecha de la venta en hoy y /mako/revisar convierte una lista vacía en null. En curso: un agente rehace el Deshacer con foto antes/después (el d60daf299 no entra: 5 defectos). _se pierde el monto de una venta real y se falsea su fecha_ · medio · se puede hacer ya · `app/crm/actions.ts:2471; app/mako/revisar/[id]/RevisarAccion.tsx:77; docs/relevo/cerebro.md → 21:20 UTC y 22:45`
- **Dashboard** — La hoja por fecha de cierre filtrada por un funnel de agregados pone la venta en la casa y los OKR la ponen en el agregado; un gráfico agrupado por funnel dentro de una hoja filtrada por «Renovación» muestra a esos leads bajo su casa. _una renovación aparece en el funnel equivocado en los reportes de plata_ · medio · se puede hacer ya · `docs/relevo/cerebro.md → 17/10 21:20 UTC (lib/graficos-datos.ts:256); docs/hallazgos-graficos.md`
- **IA / Datos** — El método de la plataforma vive en el negocio de Mauricio (Copywriting, «Buenas prácticas», Levanta Muertos y los guiones de ángulos y estructuras) — a medias: falta mudarlo al negocio de la plataforma (lo cargado a mano por Mauricio ya no se presta a todos). _hoy es la plataforma viviendo dentro de un cliente; el lector del RAG ya sabe leerlo de la plataforma_ · medio · se puede hacer ya · `docs/hallazgos-seguridad.md → El RAG: «manual» no era «método»; docs/relevo/seguridad-aislamiento.md`
- **IA / Datos** — Si la pregunta misma nombra a un cliente, su nombre viaja a la IA gratis; con una pendiente de un lead se corta la charla del grupo; y nada se probó con un workspace sin keys mandando un WhatsApp real. _la IA gratis puede entrenar con datos de clientes_ · chico · se puede hacer ya · `docs/hallazgos-ia.md → Lo que quedó SIN hacer (17/10)`
- **Pagos** — Marcar a mano una cuota cuyo link ya se pagó cuenta la plata dos veces: el arreglo está hecho pero APAGADO (MIRAR_LINK_ANTES_DE_MARCAR = false) — a medias: falta arreglar 2 defectos (una cuota destildada por error en el ws1 queda IMPAGA para siempre, y el paso 1 tiene que exigir que la cuota no esté asentada por ese pago) y prenderlo. _lo cobrado sale inflado_ · chico · se puede hacer ya · `docs/relevo/pagos.md → APAGADOS; lib/pagos.ts, lib/cobros.ts`
- **Pagos** — Mirar en el ws3 la pestaña Pagos, la «Baja del cliente» y la tarjeta del cliente de agencia (leads 2739 y 2740). _está en producción y nadie lo vio_ · chico · se puede hacer ya · `docs/relevo/pagos.md → Lo que sigue 3`
- **Seguridad** — Los 44 lugares que tiraban al negocio de Mauricio lo que no sabían ya están cerrados; siguen cayendo al ws1 el default del resolver sin cookie (de ahí cuelgan los reportes diario y horario), la línea de voz de MaKo y el gasto y saldo de Claude de la agencia — a medias: falta medir qué crons dependen del default del resolver (lib/workspace.ts) y mudar esas tres cosas a la plataforma. _cualquier olvido sigue siendo una fuga de datos de un cliente real; es mudar datos_ · medio · se puede hacer ya · `docs/relevo/seguridad-aislamiento.md → Sigue pendiente; docs/hallazgos-seguridad.md → ?? OWNER_WS`
- **Seguridad** — Comprobar en producción que los mensajes no se cruzan entre clientes (5 de 6 arreglos sin mirar) — a medias: falta mandar un /compartir desde el ws11 y mirar el remitente, y repetir cuando haya corridas del drenador, acuses de grupo y herencia del store (hoy no hay datos de ese camino). Mirado con lecturas el 17/10: los links sin ?ws= del modelo ya salen con él. _los tests leen el código, no lo que pasa de verdad_ · medio · se puede hacer ya · `docs/hallazgos-seguridad.md → Los cruces entre clientes, mirados en producción`
- **Seguridad** — Las acciones del CRM ya cortan sin sesión adentro (85, con un guard que barre todo app/crm) — a medias: falta el mismo barrido en los 'use server' de las otras tabs. _hoy las cubre sólo el proxy_ · medio · se puede hacer ya · `docs/hallazgos-seguridad.md → Las 85 acciones del CRM sin corte propio`
- **Seguridad** — Las fotos de los leads ya tienen nombre al azar y el cron diario muda las 106 viejas — a medias: falta borrar o mudar las fotos HUÉRFANAS del bucket avatars (objetos que ninguna fila nombra). **El script en seco ya está (6/11/2026):** `scripts/avatars-huerfanas.mts` (sin `--borrar` sólo lista; cuenta como nombrado lo de los leads vivos, la papelera y los contactos); falta que el Cerebro lo corra desde la PC y, mirando lo que lista, con `--borrar` y el sí de Martín. _quedan fotos viejas con nombre adivinable_ · medio · se puede hacer ya · `docs/relevo/seguridad-aislamiento.md → Para DESPUÉS DEL 20/10; lib/fotos-contacto.ts`
- **Seguridad** — La URL vieja del webhook del WhatsApp no oficial (con el secreto de la plataforma) vale hasta el 07/11/2026: la línea que no haya mandado nada para entonces se repara con «Reparar espejo». _pasada la fecha el espejo de esa línea muere en silencio (ya pasó el 10/07)_ · chico · se puede hacer ya · `docs/hallazgos-seguridad.md → La firma del webhook del WhatsApp no oficial (CORTE_LEGADO)`
- **Web Generator** — Avisarle al negocio cuando un pago de su landing es rechazado o falla la pasarela. _está decidido y hoy el negocio no se entera_ · chico · se puede hacer ya · `docs/relevo/landing-generator.md → Lo que sigue (15/10) 5; docs/hallazgos-editor-landing.md Tanda 4 y 6`
- **Cobros / Planes** — Que el corte por falta de pago avise a Martín y al cliente cuando pausa a alguien: hoy sólo queda en el log del cron y en el chip «pausado» de /admin. _se pausa a un cliente y nadie se entera; sería un Evento de MaKo del catálogo de avisos_ · chico · depende de otro chat · `docs/relevo/pagos.md → Lo que quedó SIN hacer (corte de consumo, 17/10)`
- **Seguridad** — El mail «tu contraseña cambió» está hecho y en producción — a medias: falta crear su fila desde la plantilla «Tu Contraseña Cambió» en SuperAdmin (ws9): hasta entonces el evento corre y no sale nada (no sale con la mudanza de avisos: es un evento de persona). _si alguien cambia la contraseña de otro, el dueño no se entera_ · chico · depende de otro chat · `docs/relevo/cerebro.md → 21:20 UTC; docs/hallazgos-seguridad.md → «Tu contraseña cambió»`
- **Ads Manager** — Probar contra Meta de verdad, en una campaña tuya en pausa: publicar, cambiar presupuesto y lugares, crear un formulario y subir un video pesado. _todo se probó con Meta simulado y publica con plata real_ · medio · **depende de Martín** · `docs/relevo/ads-manager.md → Lo que NUNCA se probó; docs/hallazgos-ads.md (14/10)`
- **Avisos** — Elegir «Por tiempo» en un mensaje lo agenda al instante: un clic para mirar deja un envío diario vivo. _así le llegó cuatro días al grupo de Leila un lead de otro cliente_ · chico · **depende de Martín** · `docs/relevo/avisos-y-whatsapp.md → 3.7 y decisión 5.1`
- **Avisos** — El reporte semanal guardado de Mauricio tiene los números de julio y texto de prueba «ZZZ». _si alguien lo agenda, le sale a un cliente_ · chico · **depende de Martín** · `docs/relevo/avisos-y-whatsapp.md → 3.4 y decisión 5.2`
- **Comunidad** — Decidir si closers y setters entran a la Comunidad: hoy la abren por URL y pueden fijar y borrar posts ajenos. _la barra la esconde pero la puerta no pregunta el rol_ · chico · **depende de Martín** · `docs/hallazgos-seguridad.md → La Comunidad del equipo (16/10); docs/relevo/mako-mobile.md`
- **CRM** — Decidir si ganar en un funnel agregado cuenta como venta (Revenue, Meta, CS) y cuál es la casa de un opt-in con varios funnels. De esto también depende la invitación al curso al ganar en un segundo producto. _una renovación o segunda venta no existe en los números del negocio_ · grande · **depende de Martín** · `docs/relevo/crm.md §5 punto 1; docs/hallazgos-crm.md (06/10); docs/hallazgos-pagos.md`
- **CRM** — Corregir datos de Leila: la mensualidad de Nadia es el total del contrato y no se sabe si los 444 de Fabi son dólares o pesos. _le infla el MRR un 85%_ · chico · **depende de Martín** · `docs/relevo/crm.md §5 punto 8`
- **Infra** — La máquina de build de Vercel (Enhanced, con elastic) se factura, unos US$0,056 por deploy de 2 minutos; en el repo no dice quién la decidió. Confirmalo en Team Settings → Build and Deployment → Build Machines. _coincide con el día en que los builds morían por memoria (15/10) y puede ser un gasto que nadie eligió_ · chico · **depende de Martín** · `docs/hallazgos-infra.md → Lo que se puede medir del build de Vercel`
- **Integraciones** — Avisarle a Leila que desvincule Whop y borrar las credenciales viejas de Whop (ws1 y ws4). _paga una integración que MaKo ya no usa_ · chico · **depende de Martín** · `docs/relevo/instagram-afuera-y-curso.md §2 y §4 punto 1`
- **Meta** — Mandar la Revisión de la app de Meta (8 permisos, con videos y llamadas reales) cuando aprueben la verificación de proveedor. _Meta restringe la app si no está antes del 7/12; la constancia de monotributo vence el 06/11_ · medio · **depende de Martín** · `memory/meta-oauth-app-review.md → Falta, en orden; docs/relevo/ads-manager.md`
- **Pagos** — Conectar el Mercado Pago de MaKo en el ws9 y cargar el precio en pesos del cliente de agencia. _sin eso no sale ningún link de cobro de agencia (el ws9 tenía 0 claves el 17/10)_ · chico · **depende de Martín** · `docs/relevo/pagos.md → Lo que sigue 1; docs/hallazgos-planes-y-cobro.md`
- **Pagos** — Pasar claves de prueba de Stripe y Mercado Pago para probar un cobro de punta a punta (suscripción con fecha, firmas, contracargos). _nadie cobró nunca contra los proveedores; un contracargo de MP hoy no mueve la cuota_ · medio · **depende de Martín** · `docs/relevo/pagos.md → Lo que está QUIETO; docs/hallazgos-planes-y-cobro.md; memory/pasarela-stripe-mercadopago.md`
- **Pagos** — Decidir si se venden planes de MaKo en México y la garantía del programa grupal. _la guarda de México espera en una rama y la página de reembolsos dice «la que acordamos»_ · chico · **depende de Martín** · `docs/relevo/pagos.md → Lo que está QUIETO (cobrar-mako-en-mexico, garantia-grupal)`
- **Seguridad** — Pasar a Mauricio a sólo lectura en GitHub (decidido el 17/10, falta el clic). _sigue pudiendo escribir en el código que va a producción_ · chico · **depende de Martín** · `docs/relevo/cerebro.md → Ticketera acceso-repo-mauricio, SIN APLICAR`
- **Seguridad** — Apagar el registro abierto de Supabase Auth (decidido, falta el clic). _la app no lo usa y deja una puerta de alta abierta_ · chico · **depende de Martín** · `memory/2fa-decisiones-martin.md punto 6; docs/hallazgos-seguridad.md`
- **Seguridad** — Confirmar la recuperación de contraseña y hacer la prueba del 19/10 con el mail de la automatización prendido. _el 21/10 entran 2FA y contraseña obligatorios; sin recuperación alguien queda afuera_ · chico · **depende de Martín** · `docs/relevo/estrategia-3-cuentas.md → Lo que espera a MARTÍN 1`
- **Seguridad** — Cambiar o restablecer la contraseña no cierra las otras sesiones: faltan tus 5 decisiones del registro de dispositivos. _quien robó una sesión la conserva hasta 30 días_ · grande · **depende de Martín** · `docs/relevo/estrategia-3-cuentas.md → punto 3; docs/hallazgos-seguridad.md; docs/diseno-login-contrasena.md`
- **Seguridad** — Decidir si se rechazan las contraseñas filtradas. _hoy se acepta cualquier contraseña conocida_ · chico · **depende de Martín** · `docs/relevo/estrategia-3-cuentas.md → Lo que espera a MARTÍN 2`
- **Seguridad** — Decidir el captcha en el opt-in de las landings y en el alta. _frena bots pero puede costar conversión_ · medio · **depende de Martín** · `docs/relevo/ciberseguridad.md → punto 2`
- **Seguridad** — Poner Cloudflare delante de MaKo sin romper webhooks ni dominios de clientes. _no hay protección contra DDoS y cambia el DNS de hola-mako.com_ · grande · **depende de Martín** · `docs/relevo/ciberseguridad.md → punto 3`
- **Web Generator** — Medir el cobro con Stripe en una landing con dominio propio, en Chrome y en Safari. _el checkout puede fallar en el dominio del cliente; Safari pide un iPhone o Mac_ · chico · **depende de Martín** · `docs/relevo/landing-generator.md → Lo que sigue (15/10) 1, decisión 8`

## Traba a Martín (11)

- **Ops Center** — En curso (Ops Center 7): los puntos de tu pedido de las 22:45 que tocan el Ops Center: el «+» y la carita alineados, el Completado entero, los íconos, MaKo en WhatsApp fuera de la lista, el aviso de Completado que no salía, el Runner que pide medir solo, el chat que trabaja sin decir «Trabajando…», el Second Brain que no se cierra al tocar un chat, los chats dormidos y el Markdown con links azules. _son cosas que te traban hoy; al llegar se revisa si tocó el cartero y se cierran d8b9023a y 8e3ce267_ · medio · se puede hacer ya · `docs/relevo/cerebro.md → 18/10 ~01:45 UTC`
- **Avisos** — Los avisos mudados a automatizaciones nacieron pausados (cambio de landing, lead de landing, pruebas del Pixel, lead fusionado, puente de Flow, formulario de Meta, y la #280 «Tareas de Reuniones al Plan»): prender los que quieras — a medias: falta que los prendas; la #280 necesita antes una CONDITION que excluya al ws13 (Código Inmobiliario la tenía apagada a mano). _hoy no le llegan a ningún negocio_ · chico · **depende de Martín** · `docs/hallazgos-comunicacion.md → Nada por detrás, lote 3; docs/relevo/cerebro.md → 21:55 UTC`
- **Ops Center** — Prender una vez la apertura de chats en el Runner y probar «Nuevo chat → Abrir»; después se van los «Copiar comando». _hasta entonces sigue el «pegalo en PowerShell»_ · chico · **depende de Martín** · `docs/relevo/centro-operaciones.md → Lo que Martín tiene que hacer`
- **Ops Center** — Mirar en tu Android lo del quinto y sexto Ops Center: la hoja del mensaje, los globos, los emojis, la cabecera con la criatura, el renombre en el lugar y «Trabajando…» desplegado. _se hizo con tests y tipos, ninguna pantalla real_ · chico · **depende de Martín** · `docs/relevo/centro-operaciones.md → PARA EL SÉPTIMO OPS CENTER 1`
- **Pauta de MaKo** — Cuenta publicitaria de MaKo: darte control total, cargar tarjeta y facturación, y el doble factor. _la ventana de anuncios arranca el 1/11 con US$2.000_ · chico · **depende de Martín** · `memory/pautar-mako-cuenta-publicitaria.md; docs/hallazgos-ads.md (08/10); docs/relevo/ads-manager.md`
- **Plan** — Confirmar en /plan/revisar los cierres de tareas que proponen los chats (#890 y los del run 103, entre otros) — a medias: falta confirmar los que quedan (#890 y los de los chats); #850 y las del Dashboard (#857, #858, #859, #860, #862, #872, #876) ya las cerró B5 con su prueba. _hasta que los confirmes, esas tarjetas siguen abiertas en el Plan_ · chico · **depende de Martín** · `docs/relevo/plan-perro-guardian.md → Lo último (17/10); docs/relevo/pagos.md (#890)`
- **Plan** — Confirmar el borrador de 50 tareas del Perro, el feedback de 18 puntos y el reparto de las 42 tareas de las reuniones del 12-13/10. _los chats esperan esas tareas; puede estar viejo_ · chico · **depende de Martín** · `docs/relevo/plan-perro-guardian.md → Lo último (14/10); docs/relevo/lector-reuniones.md; docs/relevo/estrategia-3-cuentas.md`
- **Strategy** — Strategy espera tus decisiones: cargar las ventas de MaKo en su CRM y conectar Calendly, Pixel, anuncios y WhatsApp; la torta del grupal; y si los referidos esperan. _sin datos propios, los números de la ventana de venta son supuestos_ · medio · **depende de Martín** · `docs/propuesta-tabs-strategy.md → Lo que tenés que decidir; docs/relevo/super-admin.md §5 ④`
- **Super admin** — El runway sigue con la foto del 3/10: actualizar capital y fechas, o que mande Strategy. _mirás números de plata de hace dos semanas_ · chico · **depende de Martín** · `docs/relevo/super-admin.md §5 ⑥ (app/admin/runway/datos.ts)`
- **Video Generator** — Medir en vivo el motor nuevo de Flow (sonda, una imagen y un clip, unos 12 créditos) y mirar AI Avatar; después, que Mauricio actualice la extensión. _está en producción sin generar nunca; Video Generator y AI Avatar dependen de eso_ · chico · **depende de Martín** · `docs/hallazgos-generativa.md (17/10); docs/relevo/video-generator.md → Lo que falta; memory/ai-avatar-tab.md`

## Traba a un chat (8)

- **Infra** — Aplicar las migraciones 0314 (borra la columna sin uso de Chatwoot) y 0316 (archivero_origen). _el código anda sin ellas, pero El Archivero no guarda de dónde vino cada documento hasta aplicarla_ · chico · se puede hacer ya · `docs/relevo/cerebro.md → 17/10 21:20 UTC`
- **Ops Center** — La estrella de MaKo como criatura ya parpadea y reacciona (Criatura.tsx) y el Ops Center la usa — a medias: falta que Onboarding la ponga (una línea en app/onboarding/CriaturaMako.tsx) y que Sidebar adopte su criatura. _después es una línea en el onboarding_ · medio · se puede hacer ya · `docs/relevo/onboarding.md; docs/relevo/centro-operaciones.md; commit 257fe05f7`
- **Ops Center** — Avisarle al chat Sidebar que el sexto Ops Center tocó nav.ts (`arribaDe`) para sacar el Second Brain de la barra del super admin. _el chat dueño de nav.ts no lo sabe_ · chico · se puede hacer ya · `docs/relevo/cerebro.md → 17/10 23:30 UTC`
- **Infra** — Decidir los minutos de GitHub Actions: tarjeta con tope, runner propio o nada. Ya bajaron (tests que comparten proceso: de ~50 a ~8 min, y la suite entera aislada sólo una vez por semana, ~11 min) — a medias: falta tu decisión, y medir los minutos reales de los runs nuevos (el workflow semanal se dispara a mano la primera vez y escribe los segundos en el resumen). _iban 835 de 2.000 en dos días; si se acaban no se despliega nada_ · chico · **depende de Martín** · `docs/hallazgos-infra.md → La suite entera y AISLADA; memory/minutos-github-actions.md`
- **Infra** — Conectar Claude in Chrome a la cuenta 4 en tu Chrome. _sin eso los chats de la cuenta 4 no miran producción ni prueban Flow_ · chico · **depende de Martín** · `memory/puente-flow-boq-estado.md → Falta; docs/relevo/crm.md §0-Ω13`
- **Infra** — Elegir dónde corren los chats sin depender de la RAM de la PC: nube con las claves o servidor propio. _la PC se cae con 9 chats; el servidor propio es gasto_ · medio · **depende de Martín** · `memory/chats-en-la-nube.md; docs/relevo/cerebro.md`
- **Mobile** — Probar MaKo Mobile en un teléfono real (el tuyo es Android) y Chats con conversaciones de verdad; el onboarding pendiente del ws3 tapa /m. _sólo se miró en Chrome simulando un teléfono_ · chico · **depende de Martín** · `docs/relevo/mako-mobile.md → Lo que falta (Mobile 1, 2 y 3)`
- **Ops Center** — Abrir los Runners de las cuentas 2 y 3 y darle al token de GitHub acceso al repo nuevo (da 404). _lo que se les manda queda esperando_ · chico · **depende de Martín** · `docs/hallazgos-operaciones.md → Lo que quedó sin hacer (17/10); docs/relevo/centro-operaciones.md`

## Falta construir (90)

- **Chats de MaKo: Responder con clic derecho** — Falta en Automations (acordado aparte). En el resto anda desde el 30/10 con `app/_chat/useCitaDelChat.tsx`. _Martín: «si le doy click derecho, no hace nada»_ · chico · se puede hacer ya · `docs/hallazgos-ui.md`
- **Pagos** — Una venta con el Stripe propio del negocio entra como cobro externo ya pagado, con su Purchase a Meta. Diseñado y verificado contra el código; el Cerebro decidió hacerlo después del lanzamiento (toca el webhook que cobra la suscripción de MaKo). _la primera venta del Sprint de Mauricio se perdería entera_ · grande · se puede hacer ya · `docs/diseno-venta-externa-stripe.md`
- **Ads** — El resto de «qué eventos manda MaKo a Meta»: la lectura de /stats (paso 5), el Lead del opt-in, el Schedule de Cal.com y que todo envío nuevo pase por la política. El Schedule doble ya está arreglado (5b77a50d4). · medio · se puede hacer ya · `docs/diseno-eventos-meta-por-funnel.md`
- **Pixel (Mauricio)** — Elegir «Compra» en la página de venta del Sprint (`sprint.mauriciobustos.com`, ws1; sólo el campo `conversion`, sin aviso al grupo: decisión del Cerebro). La página ya está restaurada. · chico · se puede hacer ya · `docs/hallazgos-landing.md → «La página de venta del Sprint se pisó…» (24/10)`

- **Ads Manager** — Subir un anuncio de imagen desde MaKo (hoy sólo videos). _los anuncios de imagen van por Meta a mano_ · medio · se puede hacer ya · `docs/relevo/ads-manager.md → Lo que quedó SIN hacer (falta «Usar en un anuncio» en el Image Editor: exportar el PNG y subirlo a adimages)`
- **Ads Manager** — El Autopilot de anuncios: faltan el motor, el cron, la pantalla y la API (la base quedó a medias fuera de main). _pediste «implementalo completo»; hay que renumerar la migración_ · grande · se puede hacer ya · `docs/relevo/ads-manager.md → El Autopilot (punto 18)`
- **AI Avatar** — Cablear la voz clonada sobre el video y poner las imágenes de ejemplo de 6 plantillas. _el avatar habla con la voz que genera Flow_ · medio · se puede hacer ya · `docs/hallazgos-ai-avatar.md → Lo que quedó SIN hacer (17/10)`
- **AI Avatar** — Rehacer AI Avatar copiando HeyGen (punto 10 del 17/10: «no crees jamás nada de 0 y tampoco tengas miedo a DEPRECAR»). _pedido tuyo; se puede arrancar antes si pasás la app a una cuenta con margen_ · grande · se puede hacer ya · `docs/relevo/cerebro.md → 18/10 ~01:45 UTC`
- **API de MaKo** — La comunidad (41 operaciones) ya entró a la API de MaKo; el resto (plan con 28 operaciones, crm, curso, video, cs, chatbot, ads, negocio, equipo, landing, email y whatsapp, métricas) sigue a medias fuera de main — a medias: falta integrar cada área con su revisión de seguridad (la de comunidad encontró 4 cosas que los tests daban por verdes). _funcionan en la app pero no por MaKo_ · grande · se puede hacer ya · `docs/relevo/api-mako.md → 14/10 A MEDIAS y § 6.1; rama wip/api-acciones-1410`
- **API de MaKo** — La página de gracias de una landing no tiene API (la pantalla la asigna junto con los productos). _toda feature va a la API_ · chico · se puede hacer ya · `docs/relevo/api-mako.md → Sin hacer de esta tanda`
- **Automations** — Mudar a automatizaciones visibles los avisos que MaKo manda por detrás (regla «MaKo nada por detrás») — a medias: falta mudar las familias cursos y Customer Success, CRM, Plan y objetivos, pagos, reportes por email y mensajes al lead (~25 del lote 3), más `lead-no-confirmo`. Hechas: Pixel y landing, Meta, reuniones, y el lote 2 salvo 4. _regla «MaKo nada por detrás»; las tareas de reunión las toma el chat Plan_ · grande · se puede hacer ya · `docs/inventario-nada-por-detras.md → Hecho (lotes 1 a 3); docs/relevo/chatbot.md`
- **Automations** — Terminar el lote 2: avisos del segundo motor, insistencias y alerta por email cuando se cae la voz de MaKo. _quedan 4 del lote 2_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (17/10 06:45); docs/inventario-nada-por-detras.md`
- **Automations** — Sacar las reglas escondidas del motor: protecciones, la espera «antes de la reunión» y los flujos de antes. _el motor decide cosas sin mostrarlas_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (14/10); docs/diseno-mako-nada-por-detras.md §2.4`
- **Automations** — «Crear con IA» no arma condiciones con varios funnels, AI Step de Instagram ni condiciones sobre datos del evento; «Probar» sigue toda condición por el «Sí». _hay que armarlo a mano_ · medio · se puede hacer ya · `docs/relevo/chatbot.md (17/10 tarde); docs/hallazgos-chatbot.md (14-16/10)`
- **Automations** — Mandar videos redondos de WhatsApp desde las automatizaciones. _lo pediste; Evolution ya lo soporta_ · medio · se puede hacer ya · `docs/relevo/chatbot.md (13/10)`
- **Automations** — Acciones del Dashboard y de las demás tabs en «⚡ Acción» (analizar una hoja, editar un gráfico…). _hoy sólo ofrece CRM, Customer Success y WhatsApp_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (13/10); docs/relevo/dashboard-v4.md → Brief punto 2; lib/editor-acciones.ts`
- **Automations** — Usar lo que devuelve una acción en el paso siguiente, y un aviso de «un número del Dashboard cruzó un umbral». _no existe nada de esto_ · grande · se puede hacer ya · `docs/relevo/dashboard-v4.md → Brief punto 3`
- **Automations** — Grupos de WhatsApp: mandar a uno o varios, condiciones de grupo y «MaKo a todos los grupos». _pedido en cola desde la décima tanda_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (11/10 EN COLA y 13/10)`
- **Automations** — Arrastrar para reordenar tarjetas y mensajes. _lo pidió Mauricio_ · medio · se puede hacer ya · `docs/relevo/chatbot.md (14/10, llamada con Mauricio)`
- **Automations** — La «Reentrada» del disparador en la API de MaKo y en las plantillas. _toda feature nueva va a la API_ · chico · se puede hacer ya · `docs/relevo/chatbot.md (14/10); docs/hallazgos-chatbot.md`
- **Automations** — El AI Step no escucha notas de voz de Instagram y Messenger, y de una imagen sólo ve el pie. _contesta sin saber lo que mandó el lead_ · medio · se puede hacer ya · `docs/hallazgos-chatbot.md → El AI Step en vivo (16/10)`
- **Calendario** — El Calendario no muestra las sesiones de entrega de CS ni los eventos de la comunidad. _la entrega sólo sale de la agenda de Google_ · medio · se puede hacer ya · `docs/relevo/general-y-calendario.md (lib/calendario.ts)`
- **Calendario** — Agendar una llamada para un lead desde el Calendario, e invitar gente, videollamada y repetición. _el CRM ya lo hace y el Calendario no_ · medio · se puede hacer ya · `docs/hallazgos-calendario.md → Lo que quedó SIN hacer`
- **Chats** — La tab Chats con el diseño del chat del Ops Center (punto 9 del 17/10). _pedido tuyo; quedó para después del 20/10_ · grande · se puede hacer ya · `docs/relevo/cerebro.md → 18/10 ~01:45 UTC`
- **Cobros** — Precios en moneda local en el catálogo, para que la API y las automatizaciones armen links de Mercado Pago. _hoy esos links no se arman solos_ · medio · se puede hacer ya · `docs/hallazgos-planes-y-cobro.md → Lo que quedó SIN hacer`
- **Conocimientos** — 99 cursos (unas 8.300 clases) nunca se bajaron al portal. _el portal está incompleto_ · grande · se puede hacer ya · `docs/hallazgos-conocimiento.md`
- **CRM** — «Asignar evento» en las etapas de reunión con Google Calendar. _hoy sólo Calendly y Cal.com_ · medio · se puede hacer ya · `docs/relevo/nube.md → Por dónde seguir 1`
- **CRM** — Ficha por bloques: rehacer Reuniones y Tracking y la tarjeta del lead personalizable en el tablero. _es la tanda que falta de la ficha nueva_ · grande · se puede hacer ya · `docs/relevo/crm.md §0-Ω13 4 y §0-Ω11 1; memory/ficha-por-bloques-decisiones.md`
- **CRM** — Notas del lead como los chats de MaKo: adjuntos, emojis y dictado. _lo pediste el 12/10_ · medio · se puede hacer ya · `memory/crm-feedback-12-10.md → Pendiente`
- **CRM** — Los bloques de la charla del Resumen con acciones (mandar, contestar). _cada una es una puerta nueva a un envío; pide revisión_ · medio · se puede hacer ya · `docs/relevo/crm.md §0-Ω15 Sin hacer`
- **Cursos** — Importar cursos desde Skool o Hotmart (Skool no tiene API de contenido; Hotmart pide las credenciales del productor). _feedback de Fiesta Music_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (13/10, sin dueño)`
- **Dashboard** — El botón «Publicar en Creaciones» en el Dashboard — a medias: falta correr el antes-de-subir y mergear la rama pend-b5-publicar-dash (cc07af5ea): está hecho, con su test, y no está en main. _Automations ya lo tiene_ · chico · se puede hacer ya · `docs/relevo/dashboard.md → Para después del 20/10; docs/relevo/plan-perro-guardian.md`
- **Dashboard** — Rediseño del Dashboard bloque por bloque, en escritorio y teléfono. _el doc dice «no se arrancó»; puede estar en parte hecho_ · grande · se puede hacer ya · `docs/relevo/estrategia-3-cuentas.md → Pedido sin chat; docs/hallazgos-objectives.md`
- **Experiments** — La tasa de cierre como métrica de Experiments · medio · se puede hacer ya · `docs/relevo/offer.md (15/10)`
- **General** — Los bloques de General no siguen los filtros de la hoja. _objetivo, KPIs y pendientes miden siempre el negocio entero_ · medio · se puede hacer ya · `docs/relevo/general-y-calendario.md; docs/hallazgos-objectives.md`
- **Image Editor** — Tandas 2 y 3: el chat MaKo IA con sus operaciones en la API y los pedidos sueltos. _la migración reservada todavía no existe_ · grande · se puede hacer ya · `docs/relevo/video-editor.md (16/10); docs/relevo/nube.md 4; docs/relevo/landing-generator.md → Pedidos sueltos`
- **Image Editor** — Las funciones de Canva que faltan: atajos, texto en formas, dibujo, ajustes de foto, efectos de texto, conectores, gráficos y tablas. _los 8 paquetes están relevados_ · grande · se puede hacer ya · `docs/relevo/image-editor.md → Lo que sigue 2`
- **Image Editor** — Alojar las fuentes en MaKo y sumar marca, versiones, compartir y comentarios. _las fuentes salen de un CDN ajeno_ · grande · se puede hacer ya · `docs/relevo/image-editor.md → Lo que sigue 3`
- **Integraciones** — Una compra de Hotmart no dispara «Pagos» y no hay aviso cuando entra un lead de Hotmart o Skool. _el negocio que vende por Hotmart no se entera_ · chico · se puede hacer ya · `docs/hallazgos-integraciones.md → Hotmart y Skool (14/10)`
- **MaKo** — Unificar los chats de MaKo en un solo modelo (el Dashboard ya tiene su regla: mirando, MaKo asesora y sólo edita quien edita esa hoja). _hoy cada chat de MaKo tiene su propia regla_ · grande · se puede hacer ya · `docs/diseno-chats-de-mako.md; docs/hallazgos-graficos.md`
- **MaKo en WhatsApp** — Que el vigía de los grupos corra solo en el servidor y vea también los fallos que no dejan rastro. Ya hecho: lo que falla en un grupo se registra solo como ticket, sin preguntarle a la persona, y los errores de la app llegan solos a la Ticketera — a medias: falta que el vigía deje de depender de un cron de sesión (cada 15 min, muere con el chat) y que vea los fallos que no dejan fila en mako_doer_conv. _hoy depende de un chat abierto_ · medio · se puede hacer ya · `docs/relevo/mako-en-whatsapp.md → 2 y 3`
- **Mobile** — Pantallas del teléfono que faltan. Ya están Video, Image, AI Avatar, Reels, Stories, Carousels (el método de redacción del super admin se fue: **29/10/2026, Martín: sin ninguna mención**), Configuración del negocio, API, Knowledge, MaKo Messages, AI Models, MaKo Context, Billing y Client Agents — a medias: falta hacer Strategy, Offer Playbook y MaKo WhatsApp (siguen en «En la computadora», sin dueño), MaKo Partners para el super admin, conectar una integración desde el teléfono, y el Video Editor del teléfono con texto, audio, efectos y «Editar con IA». _en More salen como «En la computadora»_ · grande · se puede hacer ya · `docs/relevo/mako-mobile.md → Mobile 1 y Mobile 2, Lo que falta; lib/movil-rutas.ts → EN_CAMINO`
- **Mobile** — Chats del teléfono: adjuntar archivos y notas de voz, notas internas, asignar, mover de etapa y posponer (ya están todos los canales, la bandeja unificada y Cerrar/Reabrir). _en el teléfono sólo se lee y se contesta texto_ · medio · se puede hacer ya · `docs/relevo/mako-mobile.md → 17/10 Lo que falta 2; docs/hallazgos-mobile.md`
- **Mobile** — El Web Generator en el teléfono no tiene crear, Crear con IA, Analizar ni Replicar. _desde el celular sólo se mira_ · medio · se puede hacer ya · `docs/hallazgos-editor-landing.md → Tanda 6 y 7; docs/relevo/landing-generator.md`
- **Mobile** — Cobrar con link desde el teléfono. _muestra el saldo pero no manda el link_ · medio · se puede hacer ya · `docs/hallazgos-pagos.md §4 (app/m/crm/[id]/FichaLead.tsx)`
- **Mobile** — Las hojas propias de la ficha del lead no salen en el teléfono. _lo armado en escritorio no se ve en MaKo Mobile_ · medio · se puede hacer ya · `docs/hallazgos-crm.md → Las tabs como HOJAS (17/10)`
- **Mobile** — El «+» para cargar un lead y el agregar rápido de tareas en el teléfono. _escritorio los tiene; el alta de tareas dispara al Perro_ · medio · se puede hacer ya · `docs/relevo/mako-mobile.md → Mobile 3, Lo que falta 2`
- **Ops Center** — Que un chat maneje el Plan cuando se le pide. Ya hecho: «tráeme las más prioritarias», de sólo lectura (cartero 1.15.7); por decisión de la revisión, un chat NO cierra tareas — a medias: falta el cierre estructurado `cartero.mjs cierre … --tareas 870,872 --prueba <commit>` (el servidor cierra sólo esos números, sólo del proyecto del jefe y sólo si el commit está en main: hoy el token de GitHub da 404), «Cámbiale el nombre» (el Plan no tiene operación para renombrar) y la vista de Destacados. _falta una puerta de la PC al Plan con revisión de seguridad_ · medio · se puede hacer ya · `docs/relevo/centro-operaciones.md → Lo que falta, después del 20/10; docs/hallazgos-operaciones.md`
- **Ops Center** — Abrir con un clic un chat de la cuenta de la app. _hoy sólo con las cuentas de terminal_ · medio · se puede hacer ya · `docs/relevo/centro-operaciones.md → Lo que sigue 2; docs/diseno-nuevo-chat-un-clic.md`
- **Ops Center** — Adjuntar archivos de texto (txt, csv o un log) en la caja del Ops Center. _hoy sólo acepta fotos y PDF_ · chico · se puede hacer ya · `docs/hallazgos-operaciones.md → Lo que quedó sin hacer`
- **Ops Center** — Escribirle desde el Ops Center a un chat que corre en la nube. _hoy se ve en la lista pero no tiene caja_ · medio · se puede hacer ya · `docs/hallazgos-operaciones.md → Lo que quedó sin hacer`
- **Ops Center** — El texto del razonamiento de un chat en «Trabajando…»: hoy se ven los pasos que ya sube la PC. _subir lo que piensa el chat pide revisar antes qué viaja a MaKo (secretos, rutas, datos de clientes)_ · medio · se puede hacer ya · `docs/relevo/centro-operaciones.md → PARA EL SÉPTIMO OPS CENTER 2`
- **Pagos** — Los bloques de Pagos que no se dibujan: confirmación, recordatorios de cobro, excepciones y cliente en CS. _están en las plantillas y se saltean_ · medio · se puede hacer ya · `docs/hallazgos-pagos.md §4`
- **Plan** — Avisar cuando una reunión no se pudo leer. _así se perdieron diez reuniones sin que nadie se entere_ · chico · se puede hacer ya · `docs/hallazgos-plan.md (15/10)`
- **Plan** — El filtro «Responsable» en el tablero del dueño y «Re-priorizar todo» en el teléfono. _lo pedía la SPEC del kanban_ · chico · se puede hacer ya · `docs/hallazgos-plan.md (16/10)`
- **Second Brain** — Las pantallas que faltan: grupo de WhatsApp en la barra, «Lo que hizo», renombrar la criatura, sub-chats del CRM y del lead, chats y creaciones en el grafo. _lo del servidor está y falta la pantalla_ · grande · se puede hacer ya · `docs/relevo/centro-operaciones.md → Cada tanda que falta 2 a 6; docs/relevo/nube.md 3`
- **Second Brain** — «Skills» como skills.sh: se instala con un toque y crea un chat para el equipo. _lo pediste el 16/10; primero va el diseño_ · grande · se puede hacer ya · `docs/relevo/centro-operaciones.md → Second Brain: Skills`
- **Second Brain** — Que MaKo traiga del grafo sólo lo que necesita en cada turno. _menos tokens; la herramienta existe y el turno no la usa_ · medio · se puede hacer ya · `memory/second-brain-grafo-17-10.md; docs/hallazgos-second-brain.md`
- **Second Brain** — En curso (Grafo): el grafo en el teléfono (tocar nodos, apaisado, barra lateral), UN solo grafo con filtros, y los nodos «Negocio» de cada workspace desde lo que MaKo SABE, sin la estructura vieja. _pedido tuyo de las 22:45_ · medio · se puede hacer ya · `docs/relevo/cerebro.md → 18/10 ~01:45 UTC; docs/hallazgos-second-brain.md`
- **Strategy** — La pantalla «¿Qué es MaKo?» con ofertas y precios en columnas, también para clientes. _decidida el 15/10 y no existe_ · medio · se puede hacer ya · `docs/relevo/vender-mako-estrategia.md (15/10); memory/estrategia-ventana-15k.md`
- **SuperAdmin** — Registro de todo lo que hace cada usuario, visible para vos. _lo pediste y nadie lo tomó_ · grande · se puede hacer ya · `docs/relevo/chatbot.md (13/10, sin dueño)`
- **Video Generator** — Si la foto de la cara no está en el proyecto de Flow, que se vuelva a subir sola. _hoy corta con «Tu foto no está en este proyecto de Flow»_ · chico · se puede hacer ya · `docs/relevo/video-generator.md → Lo que falta 4`
- **Web Generator** — Animaciones: efectos al hacer scroll, cinta, carrusel, contador, plantillas animadas y transiciones al presentar. _es la mitad de «las dos cosas» que pediste_ · grande · se puede hacer ya · `docs/relevo/landing-generator.md → Tanda 8, etapas 4, 6 y 9`
- **Web Generator** — Pagar desde una landing con dominio propio termina en hola-mako.com, no vuelve y pierde el anuncio de origen. _la conversión más cara queda sin campaña_ · medio · se puede hacer ya · `docs/hallazgos-editor-landing.md → Tanda 4, revisión`
- **Ads Manager** — Variaciones de gancho para el Autopilot. _depende de que el puente traiga el video de Flow_ · grande · depende de otro chat · `docs/relevo/video-editor.md (14/10)`
- **Automations** — Terminar las plantillas que reemplazan el «CRM automático» (no-show, nutrición vencida) y apagar el motor viejo. _el motor escondido sigue corriendo_ · medio · depende de otro chat · `docs/relevo/crm.md §0-Ω6 y §0-Ω2 (rama crm-bloques-b5 sin integrar)`
- **Web Generator** — Prender el video de fondo de las landings y que una imagen nueva en el hero lo reemplace. _espera a que el Video Generator haga el clip_ · medio · depende de otro chat · `docs/relevo/landing-generator.md → Tanda 8`
- **Google** — La verificación de la app de Google sigue en revisión; detrás esperan Tareas de Google y el correo por Gmail. _los clientes ven «app no verificada» y hay tope de 100 usuarios_ · medio · depende de un proveedor · `docs/hallazgos-calendario.md; docs/hallazgos-integraciones.md; memory/google-cloud-oauth-mako.md`
- **Meta** — Cuando Meta apruebe: «Conectar con Meta» para todos, leads en vivo (hoy cada 10 min), bloquear apps ajenas y tutorial sin app propia. _hoy los clientes conectan con apps de terceros_ · grande · depende de un proveedor · `docs/hallazgos-ads.md; docs/relevo/ads-manager.md → Lo que bloquea de verdad`
- **Ads Manager** — Decidir si un negocio puede tener varias cuentas publicitarias o alcanza con la cartera de agencia. _hacerlo mal borra el rendimiento de la primera cuenta_ · grande · **depende de Martín** · `docs/relevo/ads-manager.md → Decisión 3 (#799)`
- **AI Avatar** — Decidir el precio del guion largo hablado con labios guiados por audio. _es motor pago, donde HeyGen gana_ · grande · **depende de Martín** · `docs/hallazgos-ai-avatar.md → Lo que quedó SIN hacer`
- **API de MaKo** — Documentación pública de la API (hoy pide login) y publicar el plugin. _el integrador de un cliente no puede leerla_ · medio · **depende de Martín** · `docs/relevo/api-mako.md § 6.6 y 6.7`
- **Automations** — Pagar ElevenLabs (US$6 vencidos) y cargar la key de la voz de MaKo. _frena los audios con la voz de MaKo_ · chico · **depende de Martín** · `docs/relevo/chatbot.md (13/10); memory/chatbot-editor-lienzo.md`
- **Automations** — TikTok como canal. _falta una cuenta TikTok Business de prueba_ · grande · **depende de Martín** · `docs/relevo/chatbot.md (14/10, SIGUE 1)`
- **Calendario** — Publicar y programar de verdad en Instagram, Facebook, TikTok y YouTube. _plan aprobado y pausado; hoy el Calendario sólo planea_ · grande · **depende de Martín** · `docs/relevo/instagram-afuera-y-curso.md (plan 13/10); docs/hallazgos-calendario.md`
- **Calendario** — Decidir quién ve el Calendario: hoy sólo el admin y un closer no ve sus llamadas. _hace falta una capa sin la agenda del negocio_ · medio · **depende de Martín** · `docs/relevo/general-y-calendario.md → Lo que espera a Martín`
- **Copywriting** — Copywriting con editor tipo Notion/Mila. _lo dejaste para «luego»_ · grande · **depende de Martín** · `docs/relevo/video-editor.md (12/10)`
- **CRM** — Prender en cada cliente lo que nació apagado: gracias → Ganado, invitar al curso al ganar y WhatsApp de respuestas del formulario de Meta. _existe y no lo usa nadie_ · chico · **depende de Martín** · `docs/relevo/crm.md §5 punto 6`
- **CRM** — Buscar Instagram por nombre (Brave, ~US$5 cada 1.000) y que un @ cuente como contacto. _hoy sólo encuentra por @ exacto y los prospectos no pasan al CRM_ · chico · **depende de Martín** · `docs/relevo/crm.md §0-Ω14; docs/hallazgos-crm.md (#844)`
- **CRM** — Migrar desde otro CRM: falta todo y cuatro decisiones tuyas antes. _el importador sirve para listas, no para mudar un CRM_ · grande · **depende de Martín** · `docs/hallazgos-crm.md → Migrar desde otro CRM (08/10)`
- **Cursos** — Que la próxima llamada del curso se lea de Calendly: falta decidir qué evento de Calendly es la llamada de entrega (crear sesiones solas le avisa a clientes reales). _hoy alguien la carga a mano_ · medio · **depende de Martín** · `docs/relevo/customer-success.md → 0-Ω (17/10)`
- **Email** — Prender la recepción de emails en Resend y que cada negocio cargue su MX. _el código está y no entra ningún mail a Chats_ · chico · **depende de Martín** · `docs/hallazgos-comunicacion.md (17/10); docs/relevo/chatbot.md §6`
- **Image Editor** — Pedirle licencia MIT al autor de Doory, y decidir fotos de Unsplash y el modelo para quitar fondos. _todos ven el crédito de Doory y quitar fondo está apagado_ · chico · **depende de Martín** · `docs/relevo/image-editor.md → Lo que decide Martín`
- **MaKo en WhatsApp** — Decidir si MaKo puede programar un mensaje por privado a un número. _lo pidió Código Inmobiliario y los mensajes salen del número del usuario_ · medio · **depende de Martín** · `docs/relevo/mako-en-whatsapp.md → 4`
- **Meta** — La conversión por API sobre «QualifiedLead» y el dataset de CRM (hay que pedírselo al cliente). _sin ella no se optimiza por lead calificado_ · medio · **depende de Martín** · `docs/hallazgos-ads.md (05/10)`
- **Mobile** — Subir la app a Play Store y App Store: titular, cuentas (US$25 y US$99), una Mac y 15-20 testers. _sólo relevado, sin código_ · grande · **depende de Martín** · `docs/relevo/mako-mobile.md → 14/10 Tiendas`
- **Onboarding** — Decidir si la red de keys gratis cubre todo: ~60 funciones le dicen «conectá tu IA» a un cliente nuevo. _el cliente nuevo choca en Ads Writer, Automations y el chat_ · grande · **depende de Martín** · `docs/hallazgos-onboarding.md → El arranque sin API (15/10)`
- **Onboarding** — Grabar el video tutorial del onboarding (#737). _no es código_ · chico · **depende de Martín** · `docs/relevo/onboarding.md → Ventana del 13/10`
- **Reportes** — El reporte diario y el horario sólo salen para Mauricio: decidir si se abren a los clientes. _los demás los configuran en pantalla y no les llegan_ · medio · **depende de Martín** · `memory/perfil-notificaciones-reportes.md; docs/relevo/seguridad-aislamiento.md §6.2; app/api/cron/reporte-diario/route.ts`
- **Sidebar** — Implementar la sidebar nueva (prototipo publicado, todavía sin tus comentarios) y el prototipo de coherencia (en curso: lo arma un agente): Home y Dashboard unidos en Dashboard, More y perfil como tu referencia A en el teléfono y la computadora, y las tarjetas de CRM, Clients y Plan con la estética de tu referencia B. _pedido tuyo del 17/10; falta que los apruebes_ · grande · **depende de Martín** · `docs/prototipos/sidebar-nueva-1710.md; docs/relevo/cerebro.md → 18/10 ~01:45 UTC`
- **Ventas** — Referidos: construir atribución y comisiones, y mandar el acuerdo y los mensajes (primero Jan, Juanfran y su hermana). _está decidido y no se anunció_ · grande · **depende de Martín** · `docs/relevo/super-admin.md §5 ⑤; docs/referidos.md; docs/relevo/vender-mako-estrategia.md`
- **Video Editor** — Decidir qué es un «formato» de video o imagen para Creaciones, los B-rolls de IA, Lottie y el montador de anuncios. _sin respuesta no se construye_ · chico · **depende de Martín** · `docs/relevo/video-editor.md (14-15/10); docs/hallazgos-creaciones.md`
- **Web Generator** — Generar imágenes con IA por Google Flow dentro del editor. _dijiste «más tarde»; para medirlo hay que pasar tu extensión al ws3_ · grande · **depende de Martín** · `docs/relevo/landing-generator.md → Tanda 4 y 6`
- **Settings** — El contenido de cada sección (Perfil, Seguridad, Notificaciones y las del negocio), rediseñado para que se parezca al teléfono; el molde, el índice y «Instalar la app» con las tres ya salieron (d37983cc2). _lo último del punto 9 de Martín del 24/10: «rediseñes todas esas tabs… coherencia con mobile»_ · medio · se puede hacer ya · `docs/hallazgos-ajustes.md`, rama ops-nota-de-voz-2410 (C:/dev/wt-integraciones)

## Pulido (58)

- **CRM** — Mirar EN PANTALLA, en producción, tres cosas que salieron el 24/10 (main 59d228ea1) y sólo se verificaron con tests y
  en Chrome headless:
  - el «Creando…» de los «+» del editor de etapas (el de arriba de Ganado y los de la banda Nutrición): crear y borrar la
    etapa en el Cliente de Prueba, nunca en un cliente real;
  - el selector de funnel del teléfono (sin tilde, el actual primero y en negrita);
  - las etapas en dos columnas del desplegable de la ficha.
  - Quedó sin mirar porque el navegador integrado no tenía sesión (la entrada es con Google, la hace Martín). Lo demás de la
    lista del CRM sigue en docs/feedback-diseno-pendiente.md («El CRM, medido aparte»). · chico · espera la sesión

- **Web Generator** — Mirar desplegado el editor como Automations: sobre todo que la barra única entre en una pantalla de 1280 con el chat abierto, y el 403 desde Vercel en el Diagnóstico y Offer. La lista entera, paso por paso. _nadie lo vio con clics_ · chico · se puede hacer ya · `docs/diseno-editor-web-como-automations.md → «Cómo se verifica en pantalla»; 7ae16876e`

- **Ads Manager** — Mirar en pantalla el onboarding nuevo del Ads Manager · chico · se puede hacer ya · `docs/relevo/ads-manager.md (#801)`
- **Agente** — Nada reporta desde una instalación real del plugin del agente (la purga de 90 días ya corre: cron diario, sólo lo vencido, con modo seco) — a medias: falta una instalación real que reporte · chico · se puede hacer ya · `docs/hallazgos-agente.md; commit a9b66a3f8`
- **Automations** — «Crear con IA»: probar Groq primero (Gemini tarda). _la espera se siente rota_ · chico · se puede hacer ya · `docs/hallazgos-chatbot.md (#847, 17/10); lib/flujo-ia.ts`
- **Automations** — Cambiar el texto «Eso se hace en CRM» de la burbuja · chico · se puede hacer ya · `docs/relevo/chatbot.md; app/automations/pedidos-chat.ts`
- **Automations** — Publicar desde dos pestañas: gana la última sin avisar · chico · se puede hacer ya · `docs/relevo/chatbot.md §4`
- **Automations** — Mover juntas las tarjetas elegidas con el lazo · medio · se puede hacer ya · `docs/relevo/chatbot.md §4`
- **Automations** — El chip «Sin conectar», Probar y Publicar miran cualquier cuenta de Instagram, no la elegida. _recién falla al enviar_ · chico · se puede hacer ya · `docs/hallazgos-chatbot.md (12/10)`
- **Automations** — Mirar lo nuevo de Automations (varios funnels, crear con IA, recordatorio, campanita, probar en el grupo) y los links sin vista previa en un teléfono · medio · se puede hacer ya · `docs/relevo/chatbot.md (17/10)`
- **Avisos** — El aviso «se cortó tu WhatsApp» no dice qué número, y un aviso apagado queda como «ya avisado». _el registro miente al revisar_ · chico · se puede hacer ya · `docs/relevo/avisos-y-whatsapp.md → 3.3 y 3.6`
- **Avisos** — Sacar del catálogo de avisos los 32 ejemplos que nadie manda. _se muestran avisos que nunca salen_ · chico · se puede hacer ya · `docs/inventario-nada-por-detras.md → «Del catálogo, sin ningún emisor (32)»`
- **Avisos** — La frecuencia con que insiste la alerta de la cuenta publicitaria sigue escrita en el código y no en su automatización. _regla «MaKo nada por detrás»: ese ritmo no se puede editar_ · chico · se puede hacer ya · `docs/inventario-nada-por-detras.md → Hecho, lote 1 (CADENCIA_MIN)`
- **Calendario** — Mirar el Calendario con un Google conectado y el bloque «Prioridades del Plan» · chico · se puede hacer ya · `docs/relevo/general-y-calendario.md`
- **CRM** — Ficha por hojas: ya se relee cuando MaKo la cambia y hay una sola marca para ignorar datos — a medias: falta unificar el desplegable de hojas con MenuHojas (hay que verlo en un navegador) y convertir las filas viejas de pendientes_ignorados con una migración de datos antes de borrar la columna · medio · se puede hacer ya · `docs/relevo/crm.md §0-Ω15 Sin hacer; docs/relevo/crm-pendientes-b1.md b1`
- **CRM** — Medir en producción cuánto tarda en abrir la ficha de un lead (en local 1,3 s) · chico · se puede hacer ya · `docs/relevo/crm.md §0-Ω13 1`
- **CRM** — Mirar el CRM del 16/10 en producción, en un iPad y en el teléfono (ficha por bloques, cabecera, AI Analyst, A revisar) · chico · se puede hacer ya · `docs/relevo/crm.md §0-Ω13; docs/relevo/nube.md 1`
- **Cursos** — Pendientes chicos del curso: ya está la vista previa de «Comentar» — a medias: falta resolver las imágenes huérfanas de un borrador, la portada de un módulo vinculado que se borra y el parpadeo del editor · medio · se puede hacer ya · `docs/relevo/customer-success.md §0 (17/10)`
- **Cursos** — Recorrer el curso en el ws3. El interruptor «Etapa del kanban» ya pregunta a dónde van los clientes al apagarlo (QuitarEtapa, desde el 08/10) — a medias: falta probar ese interruptor y recorrer el curso en la app · chico · se puede hacer ya · `docs/relevo/customer-success.md §0 (17/10)`
- **Cursos** — Reordenar el curso arrastrando con el dedo en tableta y teléfono · medio · se puede hacer ya · `docs/relevo/instagram-afuera-y-curso.md → repaso 13/10`
- **Dashboard** — Mirar Experiments, la red por bloque y los anuncios en póster · chico · se puede hacer ya · `docs/relevo/dashboard.md`
- **Dashboard** — El autoguardado (/api/graficos) sigue aceptando cualquier tablero, también en vista. _la vista escribe legítimamente (crear o archivar una hoja, ajustar una plantilla): hay que separar esas escrituras antes de ponerle la puerta_ · medio · se puede hacer ya · `docs/hallazgos-graficos.md → Lo que quedó SIN hacer (b91fdfc74)`
- **Infra** — Borrar los restos de Chatwoot: ya salieron tres importadores del cascarón y hay una migración que borra la columna sin uso — a medias: falta que nadie importe lib/chatwoot.ts y aplicar la migración 0314 (ver abajo). _código muerto que confunde_ · chico · se puede hacer ya · `commit 8b6a673ca; docs/relevo/seguridad-aislamiento.md §2.5`
- **Infra** — Limpiar las copias de trabajo viejas: de 75 se borraron 26 que cumplían todo — a medias: falta revisar a mano las que quedan: 10 con commits que no están en ninguna rama remota, 5 con cambios sin guardar y 18 con un commit de las últimas 24 h. _antes, mirar que no tengan trabajo sin guardar_ · chico · se puede hacer ya · `docs/hallazgos-infra.md → Limpiar worktrees; docs/relevo/infra-y-build.md § 7.4`
- **Infra** — Medir cuánta memoria usa el build de Vercel. Ya medido leyendo: la máquina pasó a 8 cores y 16 GB y van 80 deploys seguidos en verde — a medias: falta medir el pico de memoria del build (pide un build con --experimental-debug-memory-usage; el log normal no lo imprime). _si se pasa del tope, un push sale verde y no llega a producción_ · chico · se puede hacer ya · `docs/hallazgos-infra.md → Lo que se puede medir del build de Vercel; AGENTS.md`
- **Integraciones** — Ver con clics el formulario nuevo de integraciones · chico · se puede hacer ya · `docs/relevo/integraciones.md`
- **Mobile** — La fila «Redes» del teléfono muestra redes que el admin sacó · chico · se puede hacer ya · `docs/relevo/crm.md §0-Ω10`
- **Mobile** — Offer en el teléfono no deja varias opciones ni muestra el puntaje o la nota del adjunto; Calendario, Curso y Comunidad no marcan el paso del onboarding · chico · se puede hacer ya · `docs/hallazgos-offer.md (16-17/10); docs/relevo/mako-mobile.md`
- **Mobile** — /automations del teléfono tarda 3,7 s hasta DOMContentLoaded, y /mensajes de escritorio siembra su lista con otro store que el que edita su ruta. _pediste que el teléfono ande más rápido_ · medio · se puede hacer ya · `docs/relevo/mako-mobile.md → Mobile 2, Lo que falta 6 y 7; docs/hallazgos-mobile.md`
- **Ops Center** — Los adjuntos que se suben al Ops Center y nunca se mandan quedan para siempre en el Storage. _el Storage tiene 5 GB para toda la plataforma_ · chico · se puede hacer ya · `docs/hallazgos-operaciones.md → Lo que quedó sin hacer (lib/operaciones-adjuntos.ts)`
- **Ops Center** — Borrar el mazo viejo: Mazo.tsx, Tablero.tsx, sus rutas-puerta (/tickets/decisiones, /admin/runway) y sus tests. _ya nadie los dibuja_ · chico · se puede hacer ya · `docs/relevo/centro-operaciones.md → PARA EL SÉPTIMO OPS CENTER 3`
- **Ops Center** — Que SheetM en «medio» deje ver el final de un cuerpo largo (para todas las hojas). _un cuerpo largo se corta_ · chico · se puede hacer ya · `docs/hallazgos-operaciones.md → quinto Ops Center, Sin hacer; app/m/_ui/SheetM.tsx`
- **Plan** — El tablero del cliente muestra las tareas de la Retro y corta en 1.000 · chico · se puede hacer ya · `docs/hallazgos-plan.md (16/10)`
- **Plan** — Probar arrastrando de verdad el tablero, las tablas y el scroll de la ficha del Plan · chico · se puede hacer ya · `docs/relevo/plan-perro-guardian.md; docs/relevo/tareas-llamada-mauricio.md`
- **Plan** — En el tablero de un cliente, «Re-priorizar todo» puede sacar una tarea del proyecto de su reunión · chico · se puede hacer ya · `docs/hallazgos-plan.md → «La reunión con un cliente… (#870)», Sin hacer`
- **Plan / Reuniones** — «Terminó de leer» aunque la lectura quede a medias, y «siguió leyendo y no encontró nada» cuando Fathom no contestó. _el aviso le dice al cliente algo que no pasó_ · chico · se puede hacer ya · `lib/reunion-auto.ts:618; lib/leer-reunion-en-segundo-plano.ts:125; docs/relevo/cerebro.md → 21:20 UTC`
- **Second Brain** — Apagar la ruta vieja del chat de MaKo que ya no tiene pantalla. _superficie de ataque sin uso_ · chico · se puede hacer ya · `docs/hallazgos-second-brain.md → SIN HACER (retirar /api/mako-doer; lo leen tests de otras áreas)`
- **Sidebar** — El menú lateral parpadea al entrar: nace sin rol y se acomoda después · chico · se puede hacer ya · `docs/relevo/onboarding.md → Estado 17/10 ~11:30`
- **Strategy** — Corregir precios viejos: el 1 a 1 dice US$4.000 (es 10.000) y tareas con precios del 20/09. Ya está el referido de 97 en US$130,46 — a medias: falta rehacer el 1 a 1 en US$10.000 (la corrida PROYECCION_24 tiene el 4.000 en cada fila derivada: hay que rehacerla, no cambiar el precio) y las tareas #771, #783 y #840 del Plan · chico · se puede hacer ya · `docs/relevo/vender-mako-estrategia.md; docs/hallazgos-planes-y-cobro.md; app/admin/dev/pricing/modelo.ts`
- **Super admin** — El historial de /admin/dev está congelado al 11/10 · chico · se puede hacer ya · `docs/relevo/super-admin.md §3`
- **UI** — Falta una página propia de «no encontrado». _un 404 se ve como app rota_ · chico · se puede hacer ya · `docs/hallazgos-seguridad.md`
- **Video / Image Editor** — Mirar en Chrome los dos editores (plantillas, transcripción, karaoke, chat) y medir el exportado y el cuelgue de 90 s al agregar texto. _nada se vio andar_ · medio · se puede hacer ya · `docs/relevo/video-editor.md (EN PAUSA); docs/hallazgos-video-editor.md`
- **Video Editor** — Pedir un cambio de video por WhatsApp y aceptarlo en el editor, de punta a punta · medio · se puede hacer ya · `docs/hallazgos-video-editor.md → SIN HACER`
- **Web Generator** — «Mi otro producto»: preguntar en texto libre si no está en el catálogo, y «sacá el video de la web» sin acomodar_bloque_landing (presupuesto del turno) · chico · se puede hacer ya · `docs/relevo/landing-generator.md → Pedidos sueltos 2`
- **Web Generator** — Comentarios del Diagnóstico firmados como MaKo, y renombrar el proyecto del Plan a «Web Generator». _decidido el 15/10_ · chico · se puede hacer ya · `docs/relevo/landing-generator.md → Lo que sigue (15/10) 5`
- **WhatsApp** — Varias líneas por negocio: nunca se probó con un segundo número, y Automations y post-llamada miran sólo la principal. _puede fallar sin aviso el día que un cliente sume otro_ · medio · se puede hacer ya · `docs/relevo/avisos-y-whatsapp.md → 3.2 y 3.5`
- **Automations** — Decidir la tarjeta #845: reescribirla o cerrarla. _la premisa era falsa; lo decide el Cerebro_ · chico · depende de otro chat · `docs/relevo/chatbot.md (17/10)`
- **Automations** — Borrar lo de prueba del negocio de Mauricio: dos mensajes en el chat de MaKo y un proyecto de video · chico · **depende de Martín** · `docs/relevo/chatbot.md (17/10); docs/relevo/video-editor.md`
- **CRM** — La plantilla «Venta con contrato» muestra 9 bloques vacíos: decidir si se apagan sus avisos · chico · **depende de Martín** · `docs/relevo/crm.md §0-Ω14; docs/hallazgos-crm.md (#880)`
- **Cursos** — Avisarle a Mauricio que en su curso la etapa PAS va después de Tablero y Ritmo · chico · **depende de Martín** · `docs/relevo/instagram-afuera-y-curso.md §4 punto 5`
- **Dashboard** — Decidir si se borran las pantallas viejas: pulso de páginas y navegador de guiones · chico · **depende de Martín** · `docs/relevo/dashboard.md → Lo de antes que sigue abierto`
- **General** — Armar la hoja de General de Mauricio con «Operación diaria» y decidir si «A quién cobrarle» sale del Dashboard · chico · **depende de Martín** · `docs/relevo/general-y-calendario.md`
- **Integraciones** — Revisar los tutoriales acortados de Meta, Resend, Cal.com y Fathom. _al acortarlos se cayeron pasos_ · chico · **depende de Martín** · `docs/relevo/integraciones.md → decisión 4`
- **Onboarding** — Probar el onboarding nuevo (chat de Offer, PDF, preguntas, guardia, animación) en el ws3, escritorio y teléfono. _es lo primero que ve cada cliente y nadie lo miró_ · chico · **depende de Martín** · `docs/relevo/onboarding.md (17/10); docs/relevo/offer.md; memory/onboarding-chat-arranque.md`
- **Ops Center** — Renombrar en la app los chats viejos: «Estrategia 3 cuentas» a «Cerebro» y «Cartero» a «Runner» · chico · **depende de Martín** · `docs/relevo/centro-operaciones.md → «Lo que necesita a Martín»; docs/hallazgos-operaciones.md`
- **Plan** — Contestarle a Mauricio la fecha del criterio de compromisos y medirlo con otra reunión. _su pregunta está abierta desde el 9/9_ · chico · **depende de Martín** · `memory/criterio-extraccion-mauricio.md`
- **Velocidad** — La app tarda: funciones y base en regiones distintas, 450 KB de más por página y arranques de 1-3 s. _el primer toque se siente lento_ · medio · **depende de Martín** · `docs/hallazgos-mobile.md (14/10)`
- **Web Generator** — Mirar con clics las animaciones, el cuadro con modos, la ventana del lector y «otra landing para mi otro producto» · chico · **depende de Martín** · `docs/relevo/landing-generator.md → Tanda 7, 8 y Pedidos sueltos`
- **WhatsApp** — Soltar las líneas viejas del número personal y avisar el cambio en los grupos · chico · **depende de Martín** · `memory/numero-mako-y-personal.md`
- **Sidebar** — Mirar en pantalla, tab por tab, que la barra plegada por defecto no rompa nada (salió el 24/10, 5357515d5, sin mirarla: el navegador de la app sin sesión y el Chrome sin conectar). _el rail es el mismo de quien ya la plegaba; a 934 y 1027 px daba 0 desbordes (21/10)_ · chico · espera la sesión en el navegador de la app · `docs/hallazgos-ui.md`

## Se cerraron hoy (100): para que los revises

Esta sección se puede borrar cuando Martín la haya revisado. Cada línea trae el commit o la medición que la cierra.

- **Ads Manager** — MaKo inventa los leads de Meta por anuncio: devuelve un número fijo · 84a6860fc
- **Ads Manager** — Sin negocio elegido, el Ads Manager del super admin opera sobre la cuenta de Mauricio · 6d8a85f46
- **Ads Manager** — La ruta que lee y edita el público de un conjunto no comprueba que sea de la cuenta del negocio · ya comprobaba la cuenta desde el 13/10 (e4fb140b)
- **Ads Manager** — Editar el público de un conjunto (también por la API de MaKo) y crear un pin en el mapa · d50479ce5
- **Ads Manager** — Detalles: avisar si el token vino sin permisos, la barra de lote oscura, el ícono de ojo y la publicación a medias · d4a6eda00 y las decisiones 4, 5 y 6 ya tomadas
- **Ads Manager** — La tabla puede mostrar un presupuesto viejo: escribir en Meta no refresca la caché · 968040fa5
- **API de MaKo** — Un token de sólo lectura igual puede proponer tareas del Plan y leads · 18fb98784
- **API de MaKo** — Crear desde plantilla, duplicar una automatización, copiar un dashboard y configurar el botón de pago no están en la API · 65d96de59 (crear desde plantilla y el botón de pago ya estaban)
- **API de MaKo** — MaKo no puede registrar un pago con moneda, concepto ni método · 65d96de59
- **API de MaKo** — MaKo no puede asignar productos a una landing · 65d96de59
- **API de MaKo** — MaKo no puede sacar a un lead de una secuencia: lo que se inscribe por la API no se puede deshacer · 65d96de59
- **CRM** — MaKo y la ficha usan las etapas del CRM principal aunque el lead viva en otro: MaKo da la etapa equivocada y la ficha pide requisitos que no son · 5c409fbc3
- **CRM** — Medir si algún CRM de webinar viejo pone en la primera columna a leads que ya tienen fecha de webinar · medido por B2: 0 CRM con claves viejas
- **CRM** — Borrar la acción vieja de crear producto: no pide sesión y escribiría en el negocio de Mauricio · cbb21e654
- **CRM** — Mover un lead entre dos etapas abiertas (Facturando → Falta pago) le borra la venta cargada · 72d0eed6c
- **CRM** — Guardar un funnel puede pisar lo que otro admin guardó al mismo tiempo · 5c409fbc3 (compare-and-set)
- **CRM** — El alta de un lead acepta un funnel de otro negocio sin comprobarlo · 72d0eed6c
- **CRM** — Los bloques del Resumen que no se dibujan (charla de WhatsApp, pase a humano, cambios de MaKo y cuatro más) · a6cb8b58d
- **CRM** — Un lead que ya existía y vuelve por una campaña de otro funnel no se suma a ese funnel (#893) · 576a39036 (#893)
- **CRM** — La ficha no guarda quién cambió su configuración ni deja deshacerlo · 2956a2c88
- **CRM** — Los leads de la landing pierden datos: el confirmado desde una propuesta nace sin página de registro y el opt-in repetido pierde la grabación y el fun… · 576a39036, c572c4845
- **CRM** — «Nuevo CRM» se le ofrece a quien no es admin y recién al final le dice que no · 6583e3c7c
- **CRM** — Crear un CRM escribe dos veces: si falla la segunda, queda sin etapas · cbb21e654
- **CRM** — Los dos avisos al borrar una etapa dicen cosas distintas y ninguno es lo que pasa · 63c671bb3
- **CRM** — Los plazos viejos de etapa siguen mandando el aviso del lead quieto y no hay dónde borrarlos · medido por B2: 0 funnels con plazos por etapa
- **CRM / Meta** — El «Calificado» viaja a Meta antes del «Deshacer», y desmarcar y volver a marcar manda dos eventos (#856) · 72d0eed6c (#856)
- **Cursos** — Prender el borrado de videos huérfanos del curso (hoy sólo los cuenta) · 216aeee11
- **Cursos** — Las entregas de los alumnos (voces y caras) no se borran nunca, ni al borrar la clase o el lead · 216aeee11
- **Customer Success** — La pestaña Pagos de Clientes dice «Pagado por completo» en una mensualidad activa y pinta en verde una renovación rechazada; hay que pasarla a bloques… · 4a21adca1 (bloques del CRM; se borra Editar deal y Completar con IA)
- **Customer Success** — Comprobar que las llamadas de entrega se están analizando (al 07/10 la IA de Google daba error) · medido: se analizan todos los días (193); las 10 en error del 05 al 12/10 no se reintentan, gasta crédito
- **Customer Success** — Medir si al ganar en un SEGUNDO producto el cliente recibe la invitación al curso · medido: no sale y hoy no le pasa a nadie; depende de la decisión del funnel agregado, que sigue en la lista
- **Customer Success** — La ficha del cliente no muestra qué cursos le abre su acceso ni deja sacar uno · 618fac1fc
- **Dashboard** — Una hoja filtrada por un funnel de agregados («Renovación») sale vacía, y el filtro se sigue llamando «Producto» · 638f2c877 (queda un residuo de plata, abajo)
- **Dashboard** — Los experimentos de antes y los que crea MaKo por la API no se ven en ninguna pantalla · 638f2c877
- **Dashboard** — La serie semanal del funnel por la API mide sólo el funnel principal · fb6454a83
- **Dashboard** — La conversación de «Editar con MaKo» se pierde al recargar, y el cartel de Claude pausado no dice «Conecta tu Claude» · ee20a02c1
- **IA / Datos** — Datos de leads siguen yendo a la IA gratis: el historial del grupo de WhatsApp y el guion de audio de Automations · 50cc3acc8, a12af2c52 (residuo abajo)
- **Infra** — Correr una vez por semana todos los tests juntos y aislados (decidido) · 1202221fe (semanal-tests.yml)
- **Infra** — Un test de Ads falla o pasa según la carga de la máquina · 39853793b
- **Instagram** — El anuncio de un DM pagado puede duplicar o perder el lead cuando Meta manda dos mensajes juntos · c572c4845
- **Integraciones** — /integraciones dice «Todo en orden» cuando no pudo leer los incidentes · cda40ac1f
- **Integraciones** — La tarjeta de Claude promete Opus y Sonnet y dice «sin esta llave MaKo no piensa» · eafd2a8cb
- **Landing / Pixel** — El aviso «actualizá el Pixel» no se apaga en una landing dada de baja · 3da9e6f42
- **Landing / Pixel** — El pulso, MaKo y el aviso de WhatsApp miden la versión del Pixel distinto que el aviso de adentro · 3da9e6f42
- **Landing / Pixel** — La misma portada aparece como tres páginas por los parámetros de los anuncios · 83fa46f3e
- **Landing / Pixel** — Con www y sin www la misma persona cuenta como dos visitantes · b239dbf49 (Pixel v25, sin repegar)
- **Landing / Pixel** — La prueba del Pixel no avisa cuando la grabación ya quedó guardada · ya avisaba (cron prueba-grabacion)
- **Landing Analyst** — La portada de Mauricio está sin diagnóstico desde el 20/09: las páginas en error no se reintentan solas · 3d7a0bdf5 (reintento diario)
- **Landing Analyst** — «Quitar» una página no dura: el análisis automático la vuelve a analizar · 3d7a0bdf5
- **MaKo** — MaKo esconde el ingreso estimado de un ganado y puede cortar formularios de una ficha larga · no era un bug (regla de la ficha); los formularios ya no se cortan (65d96de59)
- **MaKo** — MaKo no sabe que la ficha y la cobranza traen datos nuevos, y «cambiale el vencimiento a la cuota 3» no le trae las herramientas · 65d96de59
- **MaKo en WhatsApp** — Sin keys propias, MaKo por WhatsApp corta preguntas simples como «¿cuánto vendí este mes?» · B5: 19 lecturas de sólo números ya no cuentan como datos de clientes
- **MaKo en WhatsApp** — El chat de MaKo en la app y el teléfono puede «putear suave»: no tiene el corte de WhatsApp · 1aa6e46e2
- **Offer** — Los números de la propuesta (márgenes, LTV:CAC) los inventa la IA: que los calcule el código o los marque · 30656363e (salen marcados como estimados por MaKo)
- **Offer** — Un PDF de la oferta para mandarle a un prospecto, sin diagnóstico ni campos a completar · d08f523ee
- **Offer** — Ver versiones anteriores de una oferta · 9eec102e4
- **Offer** — El Archivero no suma lo que llega por Offer ni guarda de dónde vino cada documento · 18e106c46 (falta aplicar la migración 0316, abajo)
- **Offer** — La transcripción de un audio se corta a 140 letras en el chat · 3bf3b0387
- **Onboarding** — Pantalla del super admin con de dónde llegó cada cliente · e85063a60
- **Onboarding** — El PDF «Lo que vendes» no se guarda en El Archivero ni en el Second Brain · 905d9e2bf
- **Onboarding** — La lista «Qué hacer ahora» del diagnóstico se pierde al recargar · b948986d6
- **Ops Center** — Lo que mandás desde el Ops Center tarda unos 2 minutos: la espera rápida no consulta nada · e6aafb77f (vigilar; cartero 1.15.x instalado)
- **Ops Center** — Ops Center en el teléfono: el Uso arriba y a mano, sin el aviso repetido del Runner, y repasar la pantalla con el teclado del iPhone · aab915c7e, 5e50843a9
- **Ops Center** — Cerrar un pedido desde Git Bash falla cuando lleva la página a revisar · e6aafb77f
- **Ops Center** — Abrir el cuarto Ops Center: el Cerebro sólo puede en un turno que empiece con un mensaje tuyo · ya corrieron el 4.º, 5.º y 6.º; el 7.º está en curso
- **Ops Center** — Mensajes retenidos por el tope de 10: los «Ya está» de Sidebar, Dashboard, CRM, Onboarding, Plan, Ticketera, Automations e Infra, y dos decisiones; sa… · escribiste directo al Cerebro y el tope se reinició; lo suyo ya salió en producción
- **Ops Center** — Las cuentas en el Uso: nombre editable con email y logo; sacar «Abre su Runner…» y los botones de Runners · 5e50843a9
- **Pagos** — Probar que guardar cuotas y cerrar en Ganado no se traban si falla la lectura de recordatorios · medido por B4: no se traban
- **Pagos** — Cualquiera del equipo puede borrar o cambiar las identidades fiscales del negocio, no sólo el admin · B4: sólo el admin
- **Pagos** — Pantalla para elegir la moneda del negocio · c409ed99d
- **Pagos** — Las lecturas de cobranza («A quién cobrarle», Outstanding) cortan en 1.000 cuotas sin error · d80f7a9b4
- **Pagos** — La próxima renovación se calcula desde el cierre, no desde la fecha de Stripe o Mercado Pago · e90b4f0ec
- **Pagos** — El Dashboard muestra «Pendiente» una cuota dada de baja · 79f324183
- **Plan** — Que «re-puntuar todo» del Perro respete las tareas fijadas a mano · 7dbd0c2e4
- **Plan** — Que el «Ya está» de un chat cierre su tarjeta del Plan, y que MaKo por WhatsApp ofrezca cerrar tareas al «ya lo hice» · 5870ab321 (WhatsApp); lo del chat se descartó: un chat no cierra tareas
- **Plan** — Mover la fecha de una tarea del Plan por WhatsApp · 25e60f43a
- **Plan** — Cerrar la tarea #850: el arreglo ya está en producción · cerrada en el Plan por B5
- **Plan** — Pedirle al Dashboard el archivo con los cierres del run 103 · B5 cerró #850 y las del Dashboard en el Plan
- **Plan / Reuniones** — Una reunión leída a medias no se completa nunca: el cron la saltea porque ya tiene borrador · 638f2c877, e1fc3fe73
- **Plan / Reuniones** — La extracción de una reunión larga muere a los 300 s sin dejar ninguna tarea · 638f2c877 (se lee en varias corridas)
- **Relevos** — El índice de chats y la tabla de relevos quedaron al 10/10: faltan Cerebro, Offer, Web Generator y otros, y mandan al orquestador viejo · 726fb0de8
- **Relevos** — Borrar el volcado de la tanda B del CRM: sus pendientes viejos confunden · f2b9a3dfe
- **Seguridad** — Un test que cace las tablas nuevas que quedan sin aislar por negocio (ya hay una afuera) · eb6092ef1 (y se sumaron 5 tablas que faltaban)
- **Seguridad** — Subir Next a 16.2.11: la versión actual tiene un agujero de denegación de servicio · f89eb6d9f
- **Seguridad** — Poner límite de pedidos a las rutas públicas que escriben o gastan IA (hoy lo tiene 1 de cada 10) · 2f3d1c83e
- **Seguridad** — El WhatsApp no oficial usa un solo secreto para todos los negocios · 01500c2a6 (queda la fecha del 07/11, abajo)
- **Seguridad** — El análisis de una landing sigue redirecciones sin validar el destino, y la API de MaKo lo puede disparar · cb68af09d
- **Seguridad** — Rehacer o borrar el mapa de aislamiento entre clientes (tiene tres meses) · c8e2caa70 (borrado; su checklist vive en hallazgos-seguridad)
- **Ticketera** — En el teléfono, la Ticketera del Ops Center sigue mostrando el mazo viejo y no la bandeja de tickets de los clientes · 66d95c696, a92869c8b
- **Ticketera** — La Ticketera no muestra si el aviso al cliente llegó · 66d95c696
- **Web Generator** — MaKo entiende mal tres pedidos de landing: «quita el botón» lo propone como bajar la web, «quítale el formulario» no puede y «analiza las animaciones»… · 784d51eef
- **Web Generator** — El evaluador de landings dice «nada que señalar» cuando sí hay cosas para mejorar (#863) · 48024bb0a (#863)
- **Web Generator** — En la vista previa de la landing no se puede pausar el video ni hacer scroll con comodidad (#861) · 48024bb0a (#861)
- **Web Generator** — El botón de pago de una landing puede reusar un cobro de prueba después de pasar a claves reales · 31488bf4a
- **Web Generator** — Reclamar un dominio ajeno le bloquea el www al dueño real, y ese bloqueo no vence · 255846332
- **Web Generator** — Las métricas del mapa de calor dentro del diagnóstico de la landing (la otra mitad de #886) · fc10fe89f, 44390ec4f (#886)
- **Web Generator** — Las copias de seguridad que guarda MaKo antes de cada cambio no se borran nunca · fbd8ba1ec
- **Web Generator** — Mostrar en la copia los avisos de Replicar («sin diseño», «imágenes no copiadas») · 7afee991a
- **Web Generator** — Deuda de código: reglas copiadas, la guarda de links viejos y el rótulo de formatos · 9308c84a5, 1baeec050, 46574b596
- **Web Generator** — Dominio propio: la pestaña no explica el www y las raíces conectadas antes del 15/10 no tienen www · 255846332 (el www se suma al verificar, también a las raíces de antes del 15/10)
