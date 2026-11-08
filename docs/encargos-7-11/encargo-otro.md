# Encargo: Varios — 59 pendientes (7/11/2026)

**Qué es esto.** La lista depurada de pendientes de MaKo: de 634 anotadas el 6/11 quedaron 232 de
trabajo real (`docs/pendientes-depurados-7-11.md`). Éstos son los de tu área, ordenados por el
criterio de Martín: **cliente roto > plata > traba > features**.

## ⚠️ LEÉ ESTO ANTES DE TOCAR CÓDIGO, porque es lo que más tiempo ahorra

El 7/11 se verificaron los cuatro primeros de la lista **y tres estaban ya resueltos**. El
inventario es una foto del 6/11 y entre el 6 y el 7 entraron 601 commits a main.

**Entonces: por cada ítem, PRIMERO verificá contra el código que el síntoma siga existiendo.** Si ya
no existe, escribilo y pasá al siguiente — eso vale tanto como arreglarlo.

Tres trampas medidas ese día, las tres reales:

1. **Un pendiente que enumera «N puntas atadas» envejece punta por punta, no entero.** En «la cadena
   de pago sale del dominio del cliente», tres de cuatro puntas ya estaban hechas y el título seguía
   igual que el primer día.
2. **Un pendiente anotado muchas veces NO es más urgente: es uno que se contó muchas veces.** El más
   repetido del inventario (4 entradas) describía un recuadro gris que se había sacado el día anterior.
3. **Si dice «el número X está mal, debería ser Y», fijate si X e Y son del mismo período.** Uno decía
   «US$238 está mal, es US$426»: eran noviembre y diciembre, los dos correctos. «Arreglarlo» rompía
   noviembre.

## Cómo se entrega

Una punta por tema: `git push origin HEAD:refs/heads/punta/<nombre>`. Llega sola a `main` con verde
(`.github/workflows/punta.yml`). **`integracion` se retiró el 4/11: un push ahí da rojo a propósito.**
No hace falta esperar a que termine la anterior.

⚠️ **«En main» no es «en producción»:** el deploy lo hace un cron a las 11:05 UTC.

Lo que aprendas va a `docs/hallazgos-<área>.md` **en el mismo commit**, y el índice
`docs/hallazgos.md` se actualiza ahí mismo. Sobre todo **cuando el diagnóstico obvio era el
equivocado**: eso es lo que más tiempo ahorra después.

---

### 1. Knowledge: falta la CURACIÓN de los cursos y las plantillas de influencers

_cliente roto · grande_

El esqueleto está construido y espera en la etiqueta `nube/knowledge-3110` (no es rama: no dispara build): 7 módulos por tema, capa del Second Brain, índice en el prompt de todos los chats, dos operaciones de la API y la pantalla con cuánto tiene cargado cada uno. Falta destilar los cursos en fichas —Martín decidió hacerlo AFUERA de la app por los créditos de IA— y las «plantillas de influencers» del pedido del 30/10, de las que no hay análisis en ninguna parte y cuyos links scrapeados no están en el repo. OJO: una ficha cargada desde la pantalla sale con `fuente: 'manual'` y NO le llega a ningún negocio; la curación escribe `fuente: 'mako'`. Se ve en Classroom › Methodology, no es una tab nueva.

**Dónde:** `lib/knowledge-modulos.ts · etiqueta nube/knowledge-3110 · docs/hallazgos-conocimiento.md → «Knowledge: el conocimiento de los cursos para TODA la app» · docs/pendientes.md:69-79`

### 2. El Web Generator: la cadena de pago sale del dominio del cliente y pierde la atribución

_cliente roto · grande_

Cuatro puntas atadas: 1) servir el paso de pago EN el dominio propio (reescribir el GET /pagar/<id> a app/l/[slug]/pagar/[bloque]); 2) darle a crearCobro una base de retorno del host que sirvió la landing (hoy el 303 y el regreso de Stripe salen de APP_BASE_URL, así que el comprador sale del dominio del cliente y no vuelve); 3) que el Pixel decore los enlaces /pagar/ con utm_*, fbclid y visitor_id y el paso los pase saneados a createLead (hoy el lead de la conversión más cara nace sin atribución); 4) los rechazos del POST no dejan rastro consultable (trampa, Origin, topes, tamaño: a lo sumo un console.warn). Hecho = un pago desde un dominio propio se cobra en ese dominio, con atribución, y sus rechazos se cuentan.

**Dónde:** `C:/dev/wt-puntas/lib/editor-landing/dominios-reglas.ts (decidirHost, conEnlacesDelDominio) · proxy.ts · lib/cobros.ts:62-64 · lib/landing-token.ts · lib/editor-landing/pago-pagina.ts (responderPagoPost) · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:555 y :628`

### 3. Marketing CoPilot: Google Ads y LinkedIn Ads no tienen cifras y el agente sólo da criterio

_plata · mediano_

El documento de anuncios los marca como pendientes (línea 176). Además el perfil no guarda país ni «tiene casos» (se pregunta cada vez) y los montos del bloque del negocio salen «$3,000» mientras el conocimiento escribe «US$3.000». Hecho = los dos canales con cifras citables, el perfil guardando país y casos, y un solo separador.

**Dónde:** `C:/dev/wt-puntas/docs/conocimiento/anuncios-high-ticket.md:176 · lib/media-buyer/copiloto-contexto.ts (negocioDelCopiloto) · lib/media-buyer/copiloto-conocimiento.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-marketing-copilot.md:41`

### 4. Lo que la sesión duplicada del CoPilot dejó sin portar

_plata · mediano_

Dos cosas de la sesión que se descartó: la operación recomendar_estrategia_marketing (propone la estrategia por canal sin pasar por la charla) y reglas de criterio parafraseadas de dos repos MIT (fatiga con frecuencia de 7 días mayor a 3, grave a 4, y CTR 20 % abajo; escalar de a 20 % cada 3 a 5 días; landing con 5 % o más de conversión, si no formulario; un webinar se paga en frío recién cuando anduvo en orgánico). Si alguna se suma, va a REGLAS_DEL_COPILOTO con su licencia en el commit. Hecho = portadas o descartadas con su motivo.

**Dónde:** `C:/dev/wt-puntas/lib/media-buyer/copiloto-contexto.ts (REGLAS_DEL_COPILOTO) · lib/api-mako/areas/ads.def.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-marketing-copilot.md:48`

### 5. Los bloques de General no obedecen los filtros de la hoja, y la plata se escribe en dos formatos

_plata · grande_

Un filtro de período o de campo recorta los gráficos y no los bloques (el objetivo, los KPIs, el semáforo, el mes y los pendientes miden el negocio entero, salen de leerVistaGeneral sin alcance). Y los gráficos del catálogo escriben «US$2.882» con punto mientras los bloques usan fmtUSD, «$18,600» con coma: una hoja muestra los dos. Hecho = los bloques siguen el filtro y hay un solo formateador.

**Dónde:** `C:/dev/wt-puntas/app/general/datos.ts · lib/vista-general.ts (leerVistaGeneral) · lib/format.ts (fmtUSD) · pendiente en C:/dev/wt-puntas/docs/hallazgos-objectives.md:928`

### 6. Nadie poda landing_pago_pedidos y un cobro de prueba puede reusarse con claves reales

_plata · mediano_

Un cron que borre lo terminado de más de unos días (con el techo, como mucho 120 filas por landing y hora). Y medir el form-action con un checkout de Stripe en dominio propio: la política nombra sólo checkout.stripe.com, y si Chrome corta un 302 a pay.sunegocio.com queda una página en blanco con el cobro creado. Hecho = la tabla se poda y el checkout en dominio propio está medido en Chrome y Safari.

**Dónde:** `C:/dev/wt-puntas/supabase/migrations/0276_landing_pago_pedidos.sql · lib/editor-landing/pago-pagina.ts (ORIGENES_CHECKOUT) · lib/editor-landing/pago-pedido.ts (cobroReusable) · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:628`

### 7. Avisarle al negocio un pago rechazado o una pasarela caída

_plata · mediano_

Decidido el 14/10 (plantilla del catálogo, un evento de MaKo como pago_recibido) y no se hizo: toca el motor de avisos que el chat Automations reescribía ese día. El plan está en docs/relevo/landing-generator.md → «Lo que sigue (17/10)». Hecho = un pago rechazado en una landing le llega al dueño en el momento.

**Dónde:** `C:/dev/wt-puntas/lib/disparadores.ts · lib/avisos-catalogo.ts · lib/variables-aviso.ts · lib/plantillas-automatizaciones.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:2177`

### 8. Offer: falta la versión EXTERNA del PDF y el umbral de la alerta de foco sin medir

_plata · mediano_

El PDF de hoy es para el dueño (trae diagnóstico, números y datos «[completar]»): falta una versión para mandarle a un prospecto. Y alertaFoco no está medido contra los productos y ofertas reales de los clientes. Además leer una imagen, un PDF escaneado o un audio puede cobrar en la OpenAI del cliente (archivoATexto usa las cascadas compartidas): cerrarlo es un sinPago en leerDocumentoIA y transcribirAudio. Hecho = el PDF externo existe, el umbral está medido y leer no cobra.

**Dónde:** `C:/dev/wt-puntas/lib/offer-reglas.ts (alertaFoco) · lib/ai-cheap.ts (leerDocumentoIA, transcribirAudio) · app/offer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-offer.md:379`

### 9. Las seis mediciones que MaKo no tiene y dejan vacias las hojas nuevas del Dashboard

_plata · grande_

Las hojas ya estan copiadas y ofreciendose, pero seis numeros no existen en MaKo, asi que nacen vacias: (1) retencion por segundo del video, con hook rate y curva de abandono, para Hooks y para VSL/YouTube; (2) confianza estadistica de un A/B entre dos creativos, para Anuncio ganador; (3) cohortes de permanencia M0-M5, para Curso y CS; (4) motivos de baja contados, para CS; (5) alcance y CTR antes del clic (Marketing hoy arranca en el gasto); (6) tiempo de foco por tarea, para el temporizador de Focus. Ninguna familia lo trajo. Hecho = cada hoja nueva dibuja datos de verdad, o dice que ese dato todavia no se mide en vez de mostrar una hoja en blanco.

**Dónde:** `C:/dev/wt-puntas/docs/templates-dashboard-propuesta.md:238-244 (§7.4) · C:/dev/wt-puntas/docs/relevo/templates-dashboard.md:52-62 punto 3 · C:/dev/wt-puntas/app/dashboard/disenos/`

### 10. Los cursos completos en Conocimientos** · _grande_ · ⛔ **TRABADO — pide Chrome conectado (revisado el 7/11/2026 — `9a617e8aa`)

_traba_


**Dónde:** `scripts/curso-api.mjs · app/conocimientos/catalogo.ts · docs/hallazgos-conocimiento.md:2550,3485-3495 · app/admin/dev/conocimientos/bitacora.ts:41`

### 11. Hook generator (backlog explicito de Martin)** · _mediano_ · ⏸️ **LO APARCÓ MARTÍN, no está trabado (confirmado el 7/11/2026)

_traba_


**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:172-173`

### 12. Conectar Google Drive para que MaKo lea los links que pasan los clientes** · _mediano_ · ⛔ **TRABADO — lo decide Martín, no es una tarea (medido el 7/11/2026)

_traba_


**Dónde:** `lib/google-calendar.ts:37,43,45-54 · lib/api-mako/areas/ads.run.ts:896`

### 13. El Plan: `recurrente` no entra por WhatsApp ni por la API, y juzgarConCriterio es código muerto

_traba · mediano_

La cadena quedó cerrada para la reunión de Fathom, el cron y el archivo subido; los otros dos productores de borradores no preguntan ni mandan el campo, y se cae en el map sin error. También tareasDesdeRespuestas: una tarea que nace del wizard no puede nacer recurrente. Y nadie llama a juzgarConCriterio: el juez del criterio de compromisos está completo y sin consumidor. Hecho = una tarea recurrente se crea por WhatsApp y por la API, y el juez se llama o se borra.

**Dónde:** `C:/dev/wt-puntas/lib/mako-doer-acciones.ts:844 · app/api/agente/plan/route.ts:105 · lib/plan-propuesta.ts (TareaExtra, tareasDesdeRespuestas) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:1269`

### 14. Plantillas: Offer, AI Avatar, Web Generator y Dashboard sin empezar

_feature · grande · ⟳ estaba anotado 2 veces_

Cada una es un enchufe en `lib/creaciones-enchufes.ts` con su `paraPublico`, el `<ModalGuardarPlantilla>` en el «⋯» y `usePlantillasPropias(tipo)` en «Nuevo …», como ya están Copywriter e Image. Aparte, en Offer falta el experto `offer.experto`, «Ver ejemplo» dentro de la conversación, el teléfono, y el bug de `precioDe` con «al mes». En AI Avatar faltan el Director (AV-3), los retratos, pósters y loops (esperan al motor) y la guarda de `crearVideoAction`: usar una plantilla hoy pone el preset y la escena, pero el guion con su estructura no llega al proyecto.

**Dónde:** `C:/dev/wt-puntas/lib/creaciones-enchufes.ts ; app/m/offer/HojasOfferM.tsx ; docs/plantillas-reales/offer.md §3.3 ; docs/relevo/nube-plantillas.md:33-48`

<details><summary>Las otras formas en que estaba escrito</summary>

- Las plantillas propias no funcionan en Video porque el proyecto vive en el navegador
</details>

### 15. Automations: no hay «solo estos dias» del goteo aparte del horario de la automatizacion

_feature · chico_

Del §Sin hacer de automations.md: los dias del goteo son los del horario propio de la automatizacion, y no existe una eleccion de dias aparte. Quien quiere gotear solo de lunes a jueves tiene que achicar el horario entero. Hecho = la configuracion de una automatizacion acepta dias del goteo distintos de su horario.

**Dónde:** `C:/dev/wt-puntas/lib/config-automatizacion.ts · C:/dev/wt-puntas/docs/relevo/automations.md:451-475`

### 16. Automations: al CREAR, el modelo inventa el texto de una tarjeta de audio que la persona graba ella

_feature · chico_

Otro punto del §Sin hacer de automations.md que nadie trajo: en la rama `crear` de `/api/chat-agent/secuencias/ia`, el modelo escribe el texto de una tarjeta de audio que la persona tiene que grabar con su voz, y crear no ofrece «Discutir / Editar» (editar si lo tiene). Hecho = al crear, una tarjeta de audio sale vacia pidiendo la grabacion, y crear ofrece Discutir/Editar como editar.

**Dónde:** `C:/dev/wt-puntas/app/api/chat-agent/secuencias/ia/route.ts (rama `crear`) · C:/dev/wt-puntas/docs/relevo/automations.md:451-475`

### 17. Automations: Publicar y «Probar» exigen una linea conectada aun para el simulador

_feature · chico_

Del §Sin hacer de `docs/relevo/automations.md`, sin leer por ninguna familia: el boton «Probar» es un simulador y no manda nada, pero igual pide una linea de WhatsApp conectada, asi que un negocio que todavia no conecto no puede ni simular su automatizacion. Hecho = «Probar» corre sin linea conectada y solo Publicar la pide.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/automations.md:451-470 · C:/dev/wt-puntas/app/automations/ (`ConectarMedio`, `PanelProbar.tsx`)`

### 18. Objectives: getObjetivoProgreso y tres settings viejos siguen alimentando los reportes

_feature · chico_

Mientras existan hay dos fuentes para «cuál es la meta»: la vieja manda en los reportes por WhatsApp y la nueva en la pantalla. Unificarlo es mover esos dos call-sites a objetivosContextoTexto(). Hecho = una sola fuente de la meta.

**Dónde:** `C:/dev/wt-puntas/lib/reportes.ts:66 y :174 · lib/objectives-fuentes.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-objectives.md:928`

### 19. UI: el MenuContextual quedó fuera del barrel y del catálogo /admin/ui

_feature · chico_

Mudar los :hover/:focus de ESTILOS a app/_ui/ui.css (regla de crecimiento 3 del LEEME, una línea); sumar la pieza al barrel app/_ui/index.ts y al catálogo /admin/ui (regla 5); sumar flechas izquierda/derecha a app/_ui/iconos-menu.tsx (hoy usa las de app/crm/iconos); y decidir si un clic izquierdo afuera cierra sin que el clic siga de largo (el menú nativo de Chrome se lo traga; el nuestro abre la ficha si cae en una tarjeta). Hecho = la pieza en el barrel y el catálogo, con sus estilos en ui.css.

**Dónde:** `C:/dev/wt-puntas/app/_ui/MenuContextual.tsx (ESTILOS) · app/_ui/index.ts · app/_ui/ui.css · app/_ui/iconos-menu.tsx · app/admin/ui/CatalogoUI.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-ui.md:4376`

### 20. Copywriter: grafoParaChat ya está en main y contexto.ts sigue con el GRAFO viejo

_feature · chico_

Cambiar `const GRAFO` en lib/copywriter/contexto.ts para que use grafoParaChat (lib/cerebro-para-chat.ts, c272b97dd). Hecho = el Copywriter arma su contexto con el grafo nuevo.

**Dónde:** `C:/dev/wt-puntas/lib/copywriter/contexto.ts (const GRAFO) · lib/cerebro-para-chat.ts (grafoParaChat) · C:/dev/wt-puntas/docs/plantillas-reales/README.md (tanda 0) · pendiente en C:/dev/wt-puntas/docs/hallazgos-copywriter.md:373`

### 21. IA: dos STT hardcodeados a whisper-1 no pasan por el choke point

_feature · chico_

transcribeMediaBuffer (clases del portal) y transcribeAd (video de cada anuncio de Meta) arman su propio form con model: 'whisper-1' y no llaman a transcribirAudio: quedan clavados en OpenAI. El de ads es el de más volumen (cron y backfill sobre cientos de anuncios). Al migrarlos hay que conservar el tope de 25 MB y response_format: verbose_json (se usa duration para el costo). Hecho = los dos pasan por transcribirAudio y bajan a Groq cuando hay GROQ_API_KEY.

**Dónde:** `C:/dev/wt-puntas/lib/transcribe.ts:171 y :257 · lib/ai-cheap.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ia.md:876`

### 22. El encuadre del grafo del NEGOCIO puede cortar un título pegado al borde

_feature · chico_

En el grafo de un curso se arregló (`ajustar` en Grafo.tsx deja la mitad del título más largo a los costados); en el del negocio no se tocó. Es el mismo arreglo, aplicado al otro modo.

**Dónde:** `C:/dev/wt-puntas/app/second-brain/Grafo.tsx (ajustar) ; docs/relevo/nube-gurus.md:68-71`

### 23. El múltiplo de rendimiento nunca se miró en pantalla

_feature · chico_

No se levantó la app (la nube no tiene base). El chip de la tarjeta de Spy va arriba a la derecha y baja una fila si está «Analizando…» (`.spy-pcard__veces`). Verlo en /competitor-spy y /image-editor. Y medir cuántas piezas reales quedan sin número: con 13 publicaciones por cuenta alcanza para 7 y no para 20, así que hay que contar los chips en producción.

**Dónde:** `C:/dev/wt-puntas/lib/multiplo-rendimiento.ts ; app/competitor-spy/SpyApp.tsx (.spy-pcard__veces) ; docs/relevo/nube-multiplo.md:33-42`

### 24. AGENTS.md quedó viejo: dice que Creem modera lo que genera imagen o video

_feature · chico_

Creem cerró la tienda y `PROVEEDOR_DE_MODERACION` vale `null`: hoy no modera nadie. La regla operativa sigue valiendo (lo que genera pasa por `encolar` con el prompt final en `pedido.prompt`), pero la premisa no. La propuesta de texto exacta ya está escrita en el relevo, lista para pegar. No se tocó porque es la configuración que leen todos los chats.

**Dónde:** `C:/dev/wt-puntas/AGENTS.md (la sección de `encolar`) ; lib/creem-moderacion-reglas.ts ; el texto propuesto en docs/relevo/nube-creem-fuera.md:49-59`

### 25. Los textos de los cuatro paneles de aprobaciones son los esperados, no medidos

_feature · chico_

La tabla de traducción de `lib/vigia-aprobaciones.ts` (`panel.traduccion`) se escribió a ciegas: la nube no ve los paneles. La primera vez que la tarea lea cada uno conviene `--guardar <id> auto "<texto del panel>"`: lo que no esté en la tabla vuelve como «no pude» con el texto literal, y se corrige la tabla. El orden importa: lo negado va antes de lo aprobado, y un test lo cuida.

**Dónde:** `C:/dev/wt-puntas/lib/vigia-aprobaciones.ts (ITEMS[].panel) ; scripts/vigia-paneles.mts ; docs/relevo/nube-approvals.md:58-67`

### 26. MaKo toma la iniciativa: faltan el primer ingreso y las aperturas por tab** · _grande_ · 🟡 **EL CONTEO ESTABA VIEJO (revisado el 7/11/2026 — `5d2d98f7a`)

_feature_


**Dónde:** `lib/aperturas/ (11 archivos) · docs/mako-iniciativa/plan.md:334,387 (T15/T16) · app/ai-avatar/Estudio.tsx · lib/ai-avatar/requisitos.ts → resumenDeRequisitos`

### 27. El Second Brain no toma «absolutamente todos» los datos del cliente** · _grande_ · 🟡 **MEDIDO Y ACOTADO el 7/11/2026 — `87a02320d`

_feature_


**Dónde:** `lib/cerebro-grafo.ts:326 · lib/cerebro-nunca-lee.ts · tests/cerebro-no-lee-secretos.test.ts · docs/hallazgos-second-brain.md · lib/cerebro-para-chat.ts:146`

### 28. Generar anuncios «en cantidad»: 100 en menos de una hora** · _grande_ · ⬜ **CONFIRMADO SIN EMPEZAR, pero ya tiene cimiento (7/11/2026)

_feature_


**Dónde:** `docs/como-venden-otros.md:146 · lib/mako-tokens-reglas.ts · lib/apimart.ts`

### 29. VSL Generator completo (y VSL Analyst)

_feature · grande_

5 entradas en 'cola' en la bitacora y `app/_components/nav.ts:474` con `comingSoon`. Prioridad BAJA segun la medicion.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:165-167 · app/admin/dev/vsl-generator/bitacora.ts:28-32 · app/_components/nav.ts:474`

### 30. Historial de decisiones de Martin en «progreso», con aviso si cambia de opinion

_feature · mediano_

«Se manda como un prompt que el usuario cambio de opinion». Grep sin resultados en `app/admin/operaciones`, `lib/operaciones*` ni `lib/centro*`.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:159-160`

### 31. Focus Tracker (Toggl por BYOK) y Productivity Analyst

_feature · grande_

`git grep` de «Focus Tracker» y «toggl» sin resultados en app, lib ni docs. Puede estar como tarea en la base del /plan.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:162-163`

### 32. Ops Center: ocho restos sin dueno** · _mediano_ · ⚠️ **NINGUNO DICE SU MOTIVO — no se toca a ciegas (revisado el 7/11/2026 — `60e608d44`)

_feature_


**Dónde:** `docs/relevo/pendientes-barrido.md:121-124 · app/api/mako-doer/route.ts · app/mako-doer/page.tsx · lib/operaciones-reglas.ts:119`

### 33. Classroom y cursos armados desde el Segundo Cerebro

_feature · grande_

Que MaKo diga, segun la promesa de valor, que capsulas o modulos necesita el curso y los ordene segun la oferta. Marcado FALTA en la auditoria.

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:153 (3.17) · docs/relevo/pendientes-pc/pendientes-30-10.md:125`

### 34. Arrastrar un bloque en el Copywriter deja su contenido atras

_feature · mediano_


**Dónde:** `app/copywriter/editor/CuerpoNotion.tsx:239-241 · lib/copywriter/seccion-arrastre.ts · tests/copywriter-arrastrar-seccion.test.ts`

### 35. QA con Claude simulando usuarios dentro de MaKo

_feature · mediano_

Martin iba a pedirle a su Claude que simule muchas experiencias de usuario para detectar errores. La auditoria dice «sin script».

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:153 (3.8) · docs/relevo/pendientes-pc/pendientes-30-10.md:107,159`

### 36. Lo que falta repartir de las promesas a la agencia de Thiago

_feature · grande_

Calendario con anuncio y email enlazados (no recordatorio) y reuniones del equipo por persona; «Subir creativos» del Media Buyer aceptando un video ya generado; en Ads, variar el CTA, hooks de video con el avatar y pausar el original cuando una variacion gana; en el CRM, reservas de Google Calendar como etapa. Lo demas (guia de migrar, token, «Usar en un anuncio», «Guardar en MaKo») entro a produccion el 6/11.

**Dónde:** `docs/relevo/pendientes-pc/por-repartir.md:176-186 · docs/promesas/2910-llamada-thiago.md · docs/relevo/cerebro.md:27`

### 37. Compromisos de Mauricio: falta responderle la fecha y medir el criterio

_feature · mediano_

La cadena de extraccion esta construida. Falta responderle la fecha y medirla contra dos reuniones con notas manuales (hay una).

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:197-198 · memory/criterio-extraccion-mauricio.md`

### 38. La iniciativa de MaKo falta en 12 tabs, con la escalera del Ops Center como la primera

_feature · grande_

La tabla completa con qué falta en cada tab está en el relevo. Lo más grande: la escalera del Ops Center (T3) necesita su lector de servidor y «un paso por día» (hoy `lib/aperturas/ops.ts` sólo tiene el paso 3); Dashboard necesita la hoja de General y sacar `BotonMako` (lo miran ocho tests); Offer, Copywriter (mudarlo de `lib/copywriter/iniciativa.ts` a `lib/aperturas/copywriter.ts`), Automations, Web Generator (el Pixel), Video, Classroom, Plan, AI Avatar y Mobile (necesita T3). Y «Ver ejemplo» falta en Video, AI Avatar y Offer, que montan `PantallaCrear`.

**Dónde:** `C:/dev/wt-puntas/lib/aperturas/ ; docs/mako-iniciativa/plan.md §5 y guia.md §6 ; la tabla en docs/relevo/nube-iniciativa.md:30-51`

### 39. Moderar lo publicado y sembrar las plantillas «de MaKo» desde el super admin

_feature · mediano_

Falta una lista de `creaciones` con estado `publicada` de todos los negocios con «Retirar». El server ya lo deja (`retirarCreacion`): se lee con `listarCreaciones` o con una lectura nueva que traiga el negocio de origen SÓLO para el super admin. Y sembrar las plantillas de MaKo es publicarlas desde el workspace de la plataforma con «Guardar como plantilla» → «Toda la comunidad». No se hizo porque el brief prohibía tocar app/admin.

**Dónde:** `C:/dev/wt-puntas/app/admin/ ; lib/creaciones (retirarCreacion, listarCreaciones) ; docs/relevo/nube-plantillas.md:50-60`

### 40. Lo que no se pudo probar de la cuenta de revisión de las tiendas

_feature · mediano_

El script contra la base real (se corrió contra un PostgREST de mentira): faltan el id 900001 en producción, `createLead` con las columnas reales y el funnel por defecto. La entrada de verdad en un teléfono: la app de Play, TestFlight, el aviso a equipo@ y la pantalla de error de una acción cortada. El proxy en Vercel (se probó llamando a `proxy()` con una cookie firmada en un test).

**Dónde:** `C:/dev/wt-puntas/lib/cuenta-revision-reglas.ts ; lib/revision-guarda.ts ; docs/relevo/nube-tiendas.md:97-102`

### 41. El agente del Marketing CoPilot nunca corrió con una IA real

_feature · mediano_

Los tests prueban que al system llega lo correcto (reglas, perfil, veredicto, conocimiento), no lo que contesta. Falta correr las 14 conversaciones de `docs/marketing-copilot/conversaciones.md` en el ws 3 (nunca el ws 1) y los 12 recorridos que dejó el relevo. Aparte: «Esta semana» no tiene checks (son atajos sin estado), el banco no cubre `MediaBuyer.tsx` entero, y los negocios de antes no ven la primera entrada — si Martín quiere que a todos se les ofrezca, hay un botón por poner.

**Dónde:** `C:/dev/wt-puntas/docs/marketing-copilot/conversaciones.md ; lib/media-buyer/copiloto-contexto.ts ; app/api/mako/chat/route.ts ; docs/relevo/nube-marketing-copilot.md:46-57`

### 42. Grabar llamadas: nada se probó de punta a punta ni en un teléfono real

_feature · mediano_

La transcripción y el análisis con una IA de verdad están probados con su lógica pura, no de punta a punta. Sin probar: la subida contra Vercel y Supabase de verdad; un teléfono real, Safari, Firefox ni la app de iPhone (su explicación del micrófono ya nombra las llamadas en Info.plist, y eso entra con el próximo build de Codemagic); y que el `AudioContext` de la mezcla se cree en el clic. Para probarlo en el ws 3 con la migración aplicada: abrir un lead, «Grabar», hablar 4 minutos (para que haya 2 partes), cortar y elegir cómo terminó.

**Dónde:** `C:/dev/wt-puntas/app/_components/grabar/grabadora.ts ; tests/grabar-llamada.test.ts ; docs/relevo/nube-grabar.md:66-77`

### 43. Autopilot rotula «pausar el original» con los textos del ganador: la tarjeta dice una cosa y hace otra

_feature · mediano_

Darle su rótulo propio a la decisión tipo 'pausar'/tactica 'ganador' (hoy dice «Anuncio ganador» y «probar textos nuevos…»), y pintar v.cta (la variación del botón viaja en gancho). Lo rehace el chat Marketing CoPilot porque sumar una táctica rompe el Record<Tactica,…> de mb-modelo.ts. Hecho = la tarjeta dice que pausa el original.

**Dónde:** `C:/dev/wt-puntas/app/ads-manager/Autopilot.tsx · app/ads-manager/mb-modelo.ts · lib/media-buyer/variacion-boton.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ads.md:31`

### 44. El brief entra al grafo por cuatro listas hardcodeadas mientras getSchema() lee el esquema vivo

_feature · mediano_

CAMPOS_NORTE, CAMPOS_OFERTA, CAMPOS_CLIENTE y CAMPOS_MARCA son fijas: se le agrega un campo al brief de un cliente, el cliente lo contesta, el dato alimenta los prompts y no existe en el mapa que dice «todo lo que MaKo sabe de tu negocio». Sin error y sin aviso. Hoy es latente porque ningún workspace tiene esquema propio, pero /onboarding ya tiene addField. Hecho = un campo nuevo del brief aparece en el grafo.

**Dónde:** `C:/dev/wt-puntas/lib/cerebro-grafo.ts (las cuatro constantes) · app/onboarding/ (addField) · pendiente en C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1423`

### 45. No hay ningún test que mire la topología del grafo, y no se puede escribir hoy

_feature · mediano_

lib/cerebro-grafo.ts lleva server-only, así que ningún test lo puede importar: todo lo medido se puede romper en un commit posterior sin una señal roja. La salida ya está probada: mover la parte pura a un módulo sin la marca. Hecho = un test recorre la topología del grafo.

**Dónde:** `C:/dev/wt-puntas/lib/cerebro-grafo.ts (server-only) · pendiente en C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1264`

### 46. Ninguna hoja de las 20 plantillas del Dashboard se vio dibujada con datos reales

_feature · mediano_

Se verificó la composición (qué pieza va dónde, con un script sobre componentesDe), los tests y los tipos; falta mirarlas. Y Closing sigue sin probar contra la base de un cliente: hay que crearlo en el ws3 y el ws1. Hecho = las hojas abiertas con datos de un workspace y lo visto anotado.

**Dónde:** `C:/dev/wt-puntas/app/dashboard/disenos/ · lib/graficos-plantillas.ts (PLANTILLAS_HOJA) · punta dash-closing-producto · pendiente en C:/dev/wt-puntas/docs/hallazgos-templates-dashboard.md:748`

### 47. Seis mediciones que MaKo no tiene, y por eso las hojas no las prometen

_feature · grande_

Retención por SEGUNDO del video (Hooks y VSL van por cuartiles), confianza estadística de un A/B (Anuncio ganador usa la confianza por muestra), cohortes M0–M5 (Curso y CS), motivos de baja contados (CS), el tiempo de foco por tarea (Focus no tiene el temporizador) y las horas que ahorra una automatización. Y «¿Cada cliente va en fecha?» pide una fecha comprometida por etapa de la entrega, que no se guarda. Hecho = cada medición existe o queda escrito que no se promete.

**Dónde:** `C:/dev/wt-puntas/lib/graficos-datos.ts · lib/vsl-retencion.ts · app/customer-success/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-templates-dashboard.md:748`

### 48. Los diseños con animaciones del Web Generator quedaron para la próxima tanda

_feature · grande_

La segunda mitad del punto 8, con las decisiones ya tomadas (ver «Etapas propuestas… y lo que falta decidir»). Y «sacá el video de la web» ya es editar, pero acomodar_bloque_landing no entra en el presupuesto del turno. Hecho = los diseños con animaciones publicados y el pedido por chat llegando con la herramienta correcta.

**Dónde:** `C:/dev/wt-puntas/app/web-generator/editor/ · lib/mako-intencion.ts · lib/api-mako/areas/landing-editor.def.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:1414 y :2177`

### 49. Customer Success: cinco pendientes, incluido un compare-and-set que manda dos mensajes

_feature · grande_

moverClienteDeEtapa sin compare-and-set (si el cliente manda las dos últimas tareas en el mismo segundo desde dos pestañas, sale dos veces el mensaje de la etapa nueva y dos líneas de historial); las actions de app/customer-success/actions.ts preguntan el workspace pero no la CAPA (el requireCapa vive en la página y una server action es un POST que no pasa por ella); la llamada del curso leída de Calendly; importar cursos de Skool o Hotmart; y reordenar el curso con el dedo. Hecho = los cinco cerrados o descartados con su motivo.

**Dónde:** `C:/dev/wt-puntas/lib/cs-mover-etapa.ts (moverClienteDeEtapa) · app/customer-success/actions.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-customer-success.md:3960 y :5665`

### 50. La API de MaKo: nueve pendientes del núcleo, con su archivo

_feature · grande_

Idempotencia de las propuestas genéricas (una ref que bloquee sólo contra una pendiente); distinguir «vacío» de «ausente» en la pantalla genérica; reclamada_at y barrido de pendientes confirmada colgadas (pide columna nueva); actor fuera de resultado; historial_whatsapp y reuniones_lead por /api/agente/consultar (rompe skills instaladas); las tools viejas que devuelven el error en un 200; que la bandeja no deje confirmar a un no-admin lo que no lleva rolMinimo; mover listar_productos/guardar_producto a negocio; y /whatsapp?chat= escrito por código (falta resolver el jid contra el espejo en cada área). Hecho = los nueve cerrados o descartados con su motivo.

**Dónde:** `C:/dev/wt-puntas/lib/api-mako/ejecutar.ts · lib/propuestas.ts · lib/mako-pendientes.ts · lib/api-mako/acciones.ts · lib/agente-consultas.ts · lib/mako-tools.ts · app/mako/ctx-bandeja.ts · lib/mako-doer-in.ts · tabla en C:/dev/wt-puntas/docs/hallazgos-api-mako.md:1069`

### 51. Seguridad: el barrido de server actions sin corte de sesión sólo se hizo en el CRM

_feature · grande_

85 de las 145 server actions de app/crm no miraban la sesión y ahora arrancan con exigirSesion(). Falta el mismo barrido en los 'use server' de las otras tabs. Ojo: leer getUsuarioActual() NO es cortar, así que el guard tiene que aceptar sólo las formas que cortan, en positivo. Y falta el barrido de entrada por URL al resto de las tabs (a /conocimiento se entraba escribiendo la dirección). Hecho = ninguna server action de ninguna tab queda sin corte, con su guard.

**Dónde:** `C:/dev/wt-puntas/lib/sesion-accion.ts (exigirSesion) · tests/crm-acciones-sesion.test.ts (el molde) · los 'use server' del resto de app/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-seguridad.md:2402 y :1329`

### 52. Seguridad: cinco tablas con workspace_id quedan fuera del proxy de inquilino

_feature · mediano_

El inverso del contrato de TENANT_TABLES encontró contra producción avisos_programados, flujo_corridas, insistencias, replay_sesiones y replay_lotes con workspace_id y fuera de TABLAS_DE_INQUILINO: vaciar el Cliente de Prueba las dejaba. Hecho = las cinco dentro del proxy o declaradas en FUERA_DEL_PROXY con su porqué.

**Dónde:** `C:/dev/wt-puntas/lib/tablas-de-inquilino.ts (TABLAS_DE_INQUILINO, FUERA_DEL_PROXY) · lib/workspace.ts (TENANT_TABLES) · tests/tenant-tables-contract.test.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-seguridad.md:2402`

### 53. Integraciones: nada le dice al negocio que sus leads de Meta no llegan por Zernio

_feature · grande_

leadsEnElWebhook(ws) mide si el webhook registrado escucha el evento y ninguna pantalla lo usa (Ads Manager o el modal de Zernio). Y no hay red de seguridad si un evento se pierde: Zernio reintenta 7 veces y descarta, y el poll de Meta usa el token de página propio, que un negocio sólo-Zernio no tiene (existe GET /v1/ads/leads?accountId&since= para un barrido). Además un fallo DESPUÉS del insert deja el lead sin anunciar: el reintento encuentra created: false y nadie dispara el aviso ni las automatizaciones. Hecho = la pantalla avisa, hay barrido y un reintento dispara los avisos.

**Dónde:** `C:/dev/wt-puntas/lib/zernio.ts (leadsEnElWebhook, EVENTO_LEADS) · lib/zernio-lead.ts (cargarLeadDeZernio) · app/api/webhooks/zernio/route.ts · lib/leads.ts (upsertLeadFromMeta) · pendiente en C:/dev/wt-puntas/docs/hallazgos-integraciones.md:1685`

### 54. Copywriter: cinco bajas de la verificación de la mudanza, sin arreglar

_feature · mediano_

crear() borra el documento si el índice «falla» aunque haya llegado, y abre «No existe» (B7); el link compartido de una página cuya madre está en la Papelera sigue editando (falta escondida(paginas, id)) (B6); después de mudar, /copywriter abre una página mudada y no la última del usuario, porque nacen con actualizado = ahora (B3); con el índice casi lleno no entra nada y la marca queda «hecha» con 0 (B4); y un reels.historial con JSON roto se toma como «no hay» (B5). Hecho = las cinco cerradas.

**Dónde:** `C:/dev/wt-puntas/lib/copywriter/server.ts (crear) · app/api/compartido/guion/route.ts · informe en C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-copywriter.md:373`

### 55. UI: el menú contextual no está en Chats, Web Generator, Offer ni en dos listas

_feature · mediano_

Que el «⋯» de Chats y del Web Generator abran ESE menú; que el clic derecho en Integraciones haga lo mismo que el clic (abrirTarjeta: una red social abre Zernio) y no abra la tarjeta suelta; el selector de arriba de Offer es el Dropdown de la casa, así que un clic derecho en sus renglones cambia el desplegable de toda la app (sin hacer); y PanelLandings y PanelPartner no tienen «⋯». Hecho = los cinco lugares con su menú o con la decisión escrita.

**Dónde:** `C:/dev/wt-puntas/app/chats/ChatsApp.tsx · app/web-generator/ · app/integraciones/ · app/web-generator/editor/paneles/PanelLandings.tsx · app/offer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-ui.md:70`

### 56. Pruebas A/B: falta la dimensión «rama» en los gráficos y la primera prueba real

_feature · mediano_

La dimensión «rama» en los gráficos del Dashboard (Métricas la muestra en una franja fija), verla en pantalla, y la primera prueba real en el Cliente de Prueba (la migración ya está aplicada). Además el plan de una prueba de «Agendó» usa la tasa de «Respondió», así que el n del plan queda corto. Y Landings tiene las firmas y el store pero sus medidores no están en MEDIDORES.landing del cron. Hecho = los tres cerrados y una prueba corriendo en el ws3.

**Dónde:** `C:/dev/wt-puntas/lib/pruebas/automatizacion.ts (historiaDe) · lib/pruebas/ (MEDIDORES) · app/dashboard/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-pruebas.md:98`

### 57. El plugin del agente: nada reporta desde una instalación real

_feature · mediano_

Todo lo verificado es contra un servidor de mentira y con los tests; falta un cliente con el hook puesto de verdad. Los nombres de los eventos (UserPromptSubmit, SessionEnd) y los campos del stdin son la parte a confirmar. Y el reporte de sesiones sigue siendo sólo de Claude Code (el hook es un Stop de .claude/settings.json): desde la app de Claude la skill funciona pero no reporta. Hecho = un acta escrita desde una instalación real.

**Dónde:** `C:/dev/wt-puntas/lib/agente-plugin.ts (AGENTE_HOOK_SETTINGS) · lib/agente-consentimiento-texto.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-agente.md:129 y C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1654`

### 58. Plantillas propias: faltan los enchufes de Video, Offer, AI Avatar, Web Generator y Dashboard

_feature · grande_

Más «Tus plantillas» en el teléfono (hoy sólo en la computadora), el ítem en la barra de /creaciones, y en el super admin una vista para moderar lo publicado (retirar ya existe en el server con puedeRetirar) y sembrar las «de MaKo». El detalle está en docs/relevo/nube-plantillas.md. Hecho = las cinco tabs guardan y usan plantillas propias.

**Dónde:** `C:/dev/wt-puntas/app/_crear/ · app/admin/ · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:119`

### 59. `dashboard` tambien sigue sin enchufe en creaciones, no solo `formato_video`

_feature · mediano_

La lista dice que «de los dos tipos sin enchufe queda solo `formato_video`». No: `POR_ENCHUFAR` tiene DOS entradas vivas, `dashboard: 'Graphics'` y `formato_video: 'Video Editor'`. O sea que publicar una hoja del Dashboard como creacion sigue sin enchufe, y su dueno es el chat de Graphics. Hecho = `dashboard` sale de POR_ENCHUFAR y entra a ENCHUFADOS con sus cuatro funciones (`opciones`, `exportar`, `resumir`, `usar`) y el boton «Publicar» en la pantalla del Dashboard.

**Dónde:** `C:/dev/wt-puntas/lib/creaciones-reglas.ts:45 (ENCHUFADOS) y :47-52 (POR_ENCHUFAR) · C:/dev/wt-puntas/lib/creaciones-enchufes.ts:6-14 (los pasos del enchufe)`
