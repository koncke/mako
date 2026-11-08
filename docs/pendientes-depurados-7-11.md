# Los pendientes, depurados — 7/11/2026

> ## ⚠️ VERIFICADOS 12, SOBRABAN 11
>
> Al 7/11 por la noche se verificaron los primeros seis; el 8/11, seis más. **Once de los doce ya**
> **estaban resueltos o listos**, casi todos el **6/11** — el mismo día en que se tomó el inventario.
>
> | Pendiente | Resultado |
> |---|---|
> | La lámina con una persona queda como un recuadro (×4) | ✅ el recuadro se sacó el 6/11 |
> | La cadena de pago sale del dominio del cliente | ✅ 3 de sus 4 puntas, hechas |
> | `porCobrar` le pone a Código 4/12 por US$238 | ✅ los dos números eran correctos, de meses distintos |
> | Apify: la tarjeta dice «Sin conectar» (×2) | ✅ arreglado el 6/11 (`conUnaAlcanza`) |
> | Tickets abiertos sin cerrar: #38, #39, #43, #58 | ⏳ abierto, y se le armó un vigía |
> | El primer cobro real a Código Inmobiliario | ✅ **8/11: verificado de punta a punta, sale solo mañana** |
> | Terminar el cobro de agencias (0402/0403, Giselle, mensualidad, «Paga para entrar») | ✅ **8/11: los cuatro pasos, hechos** |
> | La cadena de pago del Web Generator | 🔵 **8/11: 0 clientes con dominio propio — mal clasificado** |
> | La ficha cuenta «hoy» en UTC | ✅ **arreglado el 20/10**, en las dos pantallas |
>
> ### El cobro del 9/11, medido el 8/11 eslabón por eslabón
>
> Siete cosas tenían que estar bien para que mañana salga el primer cobro real, y **están las siete**:
> migraciones 0402 y 0403 aplicadas en producción · el código en main **y desplegado** (el último
> deploy, 7/11 20:16 UTC, incluye el arreglo del 6/11) · la fecha de Giselle corregida al 2026-10-28 ·
> la mensualidad del 13 prendida el 6/11 · Pablo (ws18) y Patricia (ws22) en «Paga para entrar», con
> la cuenta pausada y la persona activa · el cron registrado `7 14 * * *` · y el grupo de WhatsApp de
> Código existe. **La corrida en seco contra la base real, puesta en la fecha de mañana, devuelve
> exactamente «Entrada de Giselle Belanti: US$ 37,60».** El 11/11 daría US$ 72,07 y el 13/11 la de
> Marcela, US$ 34,47.
>
> ⚠️ Lo que NO prueba: que WhatsApp entregue. Eso se vio aparte, mandando un mensaje real al grupo de
> Leandro el 8/11, que salió con id de WhatsApp.
>
> **Lo que esto significa para el número de arriba:** de las 232 «de trabajo real», una parte grande
> ya no existe. Con esta muestra el piso está bastante más abajo de los 150-200 que estimé. **Verificar
> antes de tocar no es un paso previo al trabajo: en esta lista ES el trabajo.**


**Pedido de Martín, 7/11:** «depurá con criterio las 600 y pico de tareas. Estoy seguro que hay
duplicados, otras que no sirven, otras que ya se resolvieron. Quedate con lo más importante».

Tenía razón. El inventario del 6/11 decía **634 pendientes**; de trabajo real hay **232**.

| | |
|---|---:|
| Anotadas el 6/11 | 634 |
| Temas distintos (juntando las repetidas) | **533** |
| → **trabajo real** | **232** |
| → te esperan a vos (decisión, plata, un trámite) | 229 |
| → de octubre, verificar antes de tocar | 61 |
| → ya hechas | 11 |

La versión navegable: https://claude.ai/artifact/2MnMGyV8oyXjbYz2W8NQXs

## Cómo se depuró, para poder discutirlo

1. **Las repetidas se juntaron por lo que DICEN, no por cómo están escritas.** Se compara el
   conjunto de palabras del título y del «qué falta», más los archivos que nombran (Jaccard).
   Se fundieron **101**. El caso extremo: «una persona en una lámina que no es el cliente queda
   como un recuadro» estaba anotado **cuatro veces**, con cuatro títulos distintos.
2. **Lo que el inventario ponía en «esperan a Martín» o «trabados» salió de la lista de trabajo.**
   No es que no importe: es que **no es una tarea, es una decisión**, y mezclarlas hacía que la
   lista pareciera el doble de larga de lo que es.
3. **Lo ordenado por el criterio de Martín** (cliente roto > plata > traba > features), leyendo el
   síntoma que describe cada una.

⚠️ **Dos trampas que me comí al hacerlo, y quedan escritas porque el próximo se las come igual:**

- **68 falsos «ya no existe».** Muchos pendientes nombran su archivo con la ruta del worktree
  (`dev/wt-puntas/lib/x.ts`), no la del repo. Comprobar esa ruta contra `git ls-tree` da «no
  existe» para TODAS, y se lee como «68 pendientes vencidos». Hay que normalizar el prefijo primero.
- **«El archivo existe» no es «está hecho».** Un pendiente que dice «falta la curación de los
  cursos» no se resuelve porque `lib/knowledge-modulos.ts` exista. Esa comprobación automática
  no sirve: hay que leer el código de cada uno.

**Lo que quedó SIN hacer:** verificar una por una si ya se resolvieron. Necesita leer el código de
cada pendiente y la PC no tuvo RAM para repartirlo en agentes (1,67 GB de los 3 que pide la
guardia). De las 232 seguramente sobren más.

## Un cliente lo está sufriendo (4)

- **Las fotos de personas que no son el cliente quedan como un recuadro con su guía**
  - ⚠️ **VERIFICADO el 7/11: el recuadro YA NO EXISTE.** Se sacó el 6/11, por un pedido textual de Martín mirando el
    resultado. En `documentoDeReplica` (`lib/carruseles/replica.ts:363`) lo único que se dibuja donde el original tiene una
    persona es la foto del cliente, y **no hay rama `else`**: sin foto del cliente la lámina queda en tipografía y color.
    Los `Tu foto` que quedan en `replica-servidor.ts` son el NOMBRE del archivo, y uno ya sale de AI Avatar.
  - **Lo que queda es una DECISIÓN, no trabajo:** hoy, donde el original muestra una persona, va la cara del cliente, así que
    en un carrusel con dos personas distintas el cliente aparece dos veces. Generar una segunda persona con IA de imagen es
    plata por lámina y lo decide Martín. Ver docs/hallazgos-carruseles.md. · _Carruseles, grande_ · ⟳ estaba anotado 4 veces
  - Cuando el ejemplo tiene una persona que no es el cliente, «Editar» deja un recuadro con una guía en vez de una imagen. El paso siguiente es generarla con la IA de imagen del avatar del cliente (Flow). Hecho = la lámina sale con una persona generada y no con un recuadro.
  - Dónde: `lib/carruseles/replica.ts y lib/carruseles/documento.ts (`documentoDeReplica`); docs/hallazgos-carruseles.md:218-219`
- ✅ **VERIFICADO 8/11 — SALE SOLO MAÑANA.** La corrida en seco contra la base real, puesta en el 9/11 14:07 UTC, devuelve «Entrada de Giselle Belanti: US$ 37,60». Los siete eslabones, medidos: ver el encabezado. **El primer envío real del cobro a Código Inmobiliario: Pablo vence el 9/11 14:07 UTC** · _Cobros y planes, chico_ · ⟳ estaba anotado 3 veces
  - Mirar que el cron salga de verdad (nunca se envió): Giselle US$37,60 el 9/11 14:07 UTC, Pablo máximo el 9/11, Marcela el 13/11. Al llegar el comprobante, devolver el acceso a los usuarios 15 y 19; sin pago el 11/11 suspender a Giselle (13, 25, 26) y el 13/11 a Marcela (27, 28). Hecho = el envío salió y el acceso quedó 
  - Dónde: `docs/relevo/nube-agencia-cobro.md · docs/relevo/cerebro.md:57,115-120 · tareas programadas codigo-diferencial-pablo-9-11, -giselle-12-11, -marcela-14-11`
- **Knowledge: falta la CURACIÓN de los cursos y las plantillas de influencers** · _Varios, grande_
  - El esqueleto está construido y espera en la etiqueta `nube/knowledge-3110` (no es rama: no dispara build): 7 módulos por tema, capa del Second Brain, índice en el prompt de todos los chats, dos operaciones de la API y la pantalla con cuánto tiene cargado cada uno. Falta destilar los cursos en fichas —Martín decidió hac
  - Dónde: `lib/knowledge-modulos.ts · etiqueta nube/knowledge-3110 · docs/hallazgos-conocimiento.md → «Knowledge: el conocimiento de los cursos para TODA la app» · docs/pendientes.md:69-79`
- 🔵 **8/11: MEDIDO — NO hay ningún cliente sufriéndolo, y conviene sacarlo de esta sección.** En producción hay **73 landings y CERO con dominio propio** (`landing_docs.dominio` nulo en todas). Y el comprador no ve ningún 404: `linkDelCobro` arma **siempre** `APP_BASE_URL/pagar/<token>` (lib/cobros.ts:91), o sea hola-mako.com, que existe y funciona. Lo real es más chico de lo que decía el título: **el comprador sale del dominio del cliente justo al pagar**, que es un problema de marca y de atribución, no de cobro roto. ⚠️ **La trampa sigue armada para el día que alguien conecte un dominio:** cambiar sólo la base de retorno al dominio del cliente manda al comprador a una ruta que `decidirHost` contesta `no-existe`, **con el cobro ya creado**. Primero la ruta, después la base.
- **El Web Generator: la cadena de pago sale del dominio del cliente y pierde la atribución**
  - ⚠️ **VERIFICADO el 7/11: de las cuatro puntas, DOS ya están hechas y una casi.** Servir el pago en el dominio propio
    está (`SUBRUTA_PAGO` + `decidirHost`), contar los rechazos está (`anotarRechazoDePago`, mig 0282), y la
    atribución viaja en inputs saneados (falta `visitor_id`). **Queda UNA: la base de retorno.** Y no es cambiar
    `linkDelCobro`: `decidirHost` no tiene caso para `/pagar/<token>`, así que en un dominio propio esa ruta da
    404 hoy — cambiar sólo la base manda al comprador a una página que no existe CON EL COBRO YA CREADO.
    Ver docs/hallazgos-editor-landing.md. · _Varios, grande_
  - Cuatro puntas atadas: 1) servir el paso de pago EN el dominio propio (reescribir el GET /pagar/<id> a app/l/[slug]/pagar/[bloque]); 2) darle a crearCobro una base de retorno del host que sirvió la landing (hoy el 303 y el regreso de Stripe salen de APP_BASE_URL, así que el comprador sale del dominio del cliente y no vu
  - Dónde: `C:/dev/wt-puntas/lib/editor-landing/dominios-reglas.ts (decidirHost, conEnlacesDelDominio) · proxy.ts · lib/cobros.ts:62-64 · lib/landing-token.ts · lib/editor-landing/pago-pagina.ts (responderPagoPost) · pendiente en C:`

## Toca la plata (37)

- **Sin probar en Admin: «Cargar pago», devolver y eliminar con datos reales** · _SuperAdmin, chico_ · ⟳ estaba anotado 2 veces
  - El Cerebro lo dejó anotado como «sin probar». La 0408 ya está aplicada, así que «Cargar pago» debería registrar el pago en el CRM; hasta que se pruebe, no se sabe.
  - Dónde: `C:/dev/wt-puntas/app/admin/ ; docs/relevo/cerebro.md:31`
- **Con la clave 1 de Apify quitada y la 2 puesta, Spy anda y la tarjeta dice «Sin conectar»**
  - ✅ **VERIFICADO el 7/11: YA ESTÁ ARREGLADO, y es del 6/11** — el mismo día del barrido. `integracionConectada`
    (`lib/credenciales.ts`) ahora mide con `conUnaAlcanza` del catálogo: si ninguna requerida está, cuenta los campos
    SECRETOS y alcanza con cualquiera. El comentario del código describe este caso textual («el cliente que borraba la 1
    y dejaba la 2 veía Sin conectar con la integración andando»), y `apify-instagram` tiene `conUnaAlcanza: true`
    (`lib/metodo-catalogo.ts:886`). **Nada que hacer.** · _Infraestructura, chico_ · ⟳ estaba anotado 2 veces
  - `integracionConectada` mira solo los campos NO opcionales del servicio, y de Apify el unico obligatorio es `APIFY_INSTAGRAM_TOKEN` (la clave 1); las extra son `opcional`. Asi que un negocio que borro la 1 y dejo la 2 ve la tarjeta desconectada aunque Spy este leyendo perfectamente con la 2. Hecho = el estado de la tarj
  - Dónde: `C:/dev/wt-puntas/lib/credenciales.ts:285-307 (integracionConectada) — OJO: el relevo dice `lib/integraciones.ts`, pero la funcion vive en credenciales.ts; el catalogo de las claves extra en C:/dev/wt-puntas/lib/metodo-ca`
- **Admin: Runway con la foto del 3/10, el mazo viejo sin borrar y el historial congelado** · _SuperAdmin, mediano_ · ⟳ estaba anotado 2 veces
  - Actualizar capital y fechas del runway (o que mande Strategy); borrar Mazo.tsx, Tablero.tsx y sus rutas-puerta (/tickets/decisiones, /admin/runway) con sus tests, que ya nadie dibuja; el registro de todo lo que hace cada usuario, que Martín pidió y nadie tomó; el historial de /admin/dev congelado al 11/10. Y el arreglo
  - Dónde: `app/admin/runway/datos.ts · app/tickets/decisiones/Mazo.tsx · app/admin/runway/Tablero.tsx · docs/relevo/pendientes-barrido.md §«Para OTROS chats» → Admin · docs/relevo/cerebro.md:85`
- **Tickets abiertos sin cerrar ni contestar: #38, #39, #43, #58** · _Tickets, chico_
  - #38 (Fastlane): sólo se hizo la investigación (docs/funnel-coach.md §9, 2a31f80c5); antes de cerrar, ver si el «link de Fastlane» del reparto es el mismo pedido. #39 (Brigitte, ws 15): 8f19b1229 arregló la alarma, no la causa; leer `errores_app` de ese ticket antes de mandar la respuesta, y no se sabe si ese negocio ti
  - Dónde: `docs/relevo/pendientes-0311.md §«Tickets a cerrar y avisar» (con los textos ya redactados) · docs/relevo/cerebro.md:152 · scripts/tickets.ts`
- ✅ **YA ESTABA HECHO (verificado el 8/11).** Las DOS pantallas que nombra usan `hoyEnTz(useTzWorkspace())`: la ficha (`FichaPorBloques.tsx:151`) y la de Customer Success (`PagosCliente.tsx:74`). El arreglo es del **20/10/2026** y está comentado en el código con el síntoma exacto. El hook arranca en Tijuana y después trae la zona del negocio: nunca cuenta en UTC. **La ficha cuenta «hoy» en UTC: de 18 a 24 h de México una cuota que vence hoy sale vencida** · _Cobros y planes, chico_
  - Sumar la zona del negocio a LeadFullData en getLeadFullAction y usar hoyEnTz en las dos pantallas. Hecho = la ficha, General y lo que dice MaKo coinciden sobre qué cuota está vencida.
  - Dónde: `C:/dev/wt-puntas/app/crm/lead-view/ficha/FichaPorBloques.tsx:135 · app/customer-success/PagosCliente.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:379`
- **Mirar /agency?ws=13 y decidir las tres tareas programadas `codigo-diferencial-*`** · _Cobros y planes, chico_
  - Comprobar la tarjeta de diciembre en US$332 proyectado, «Entradas por pagar» con Pablo y Patricia, y «En pausa: Pablo · Patricia». Y decidir si las tres tareas programadas (9/11, 12/11 y 14/11, que avisan y no escriben) quedan o se apagan.
  - Dónde: `C:/dev/wt-puntas/app/agency/Mensualidad.tsx ; pasos 7 y 8 de docs/relevo/nube-agencia-cobro.md:67-70`
- **`porCobrar` le pone a Codigo 4/12 por US$238 y lo real es 5/12 por US$426**
  - ⚠️ **DIAGNOSTICADO el 7/11 y está mal enunciado: los dos números son CORRECTOS y de meses distintos.** 238 es
    noviembre y 426 es diciembre; 4/12 es el fin de la entrada de Pablo. Lo fija tests/agencia-cobro.test.ts con esas
    cifras. La causa real: **«Por cobrar» no sabe que existe la mensualidad de una agencia** — lib/admin-ingresos-reglas.ts
    nombra «agencia» UNA sola vez, y el ciclo del 5 al 5 lo calcula otro motor (lib/agencia-mes.ts). No es un arreglo chico:
    es juntar dos motores, y sumarlos mal duplicaría la plata esperada. Ver docs/hallazgos-agencias.md. · _Cobros y planes, chico_
  - Arreglo chico en la vista de ingresos. Se le paso al chat de la copia de Admin, sin confirmar. Ojo: NO registrar de nuevo los pagos ya cargados.
  - Dónde: `docs/relevo/cerebro.md:85 (vistaDeIngresos)`
- ✅ **YA ESTABA HECHO (verificado el 8/11).** La plantilla existe desde el 6/11 (`pago-rechazado`, «Le Rechazaron el Pago», objetivo `cobrar`, en `lib/plantillas-automatizaciones.ts:627`) **y está sumada a la lista del test** (`LAS_13`). Las dos mitades del pendiente, hechas. **Falta la plantilla «Rechazaron un Pago» en la galeria de Automations** · _Chat de MaKo, chico_
  - El motor ya tiene el CRON («Pagos: Se rechaza un pago», `alCron(c,'rechazado')`) y el evento del lead; falta la plantilla con objetivo `cobrar` y una tarjeta MaKo al equipo, y sumarla a la lista escrita a mano `LAS_13`.
  - Dónde: `docs/relevo/pendientes-barrido.md:134-136 · lib/cobros.ts · tests/plantillas-automatizaciones.test.ts`
- ✅ **YA NO MIENTE (verificado el 8/11).** El comentario se reescribió ENTERO el 6/11, cuando se borraron las 10 plantillas de Doory por licencia. Las dos frases falsas que denunciaba el pendiente ya no existen, y el texto de hoy explica además por qué no vuelve a entrar una plantilla ajena. **El comentario de cabecera de las plantillas miente dos veces** · _Editor de imágenes, chico_
  - En plantillas.ts, el comentario de cabecera dice «el credito ya se muestra» (falso: Martin lo saco el 29/10) y «el TEXTO del lienzo sigue en ingles porque la miniatura lo muestra asi» (falso desde el 14/10: b9a7dae2f lo paso a espanol y redibujo las miniaturas; bold-sale-announcement.json dice «FIN DE TEMPORADA»). Ese 
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/plantillas.ts:4-13 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:553-557 · docs/plantillas-reales/image.md 5.1`
- **Nadie miró por qué `laminas` cortó «al techo» con US$0,54 de un tope de US$1,50** · _Carruseles, chico_
  - Diagnosticar el corte: la corrida del 6/11 se detuvo diciendo «al techo» habiendo gastado US$0,54 de un tope pedido de US$1,50. Sospecha a verificar: el techo efectivo se recalcula contra el crédito libre (`techoConCredito` menos la reserva de US$2), no contra lo pedido, y cada tanda de 40 lleva su propio techo de 1,5×
  - Dónde: `scripts/carruseles-biblioteca.mts:490 (`B.techoConCredito(techoPedido, c0, B.RESERVA_CREDITO_USD)`) y 495 (`const DE_A = 40`); docs/relevo/cerebro.md:19`
- **Sin probar: que la lectura de la oferta hable en tercera persona con un negocio real** · _Competitors Spy, chico_
  - El diagnóstico de Offer sobre la web del competidor usa `bloqueOfertaDeOtro` para hablar de él en tercera persona, con la IA del negocio y sin crédito de la plataforma (`soloDelNegocio`). Nunca corrió contra un modelo real ni contra una web de verdad.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-spy.md:62 ; /api/competitor-spy/oferta`
- **Aplicar la migración 0401 (movimientos de suscripción) en producción** · _Infraestructura, chico_
  - Correr supabase/migrations/0401_suscripcion_movimientos.sql con scripts/apply-migration.mjs. Hecho = la ficha de suscripción muestra los movimientos mes a mes sin el aviso de columna faltante.
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/0401_suscripcion_movimientos.sql · pendiente anotado en C:/dev/wt-puntas/docs/hallazgos-pagos.md:1799`
- **Marketing CoPilot: Google Ads y LinkedIn Ads no tienen cifras y el agente sólo da criterio** · _Varios, mediano_
  - El documento de anuncios los marca como pendientes (línea 176). Además el perfil no guarda país ni «tiene casos» (se pregunta cada vez) y los montos del bloque del negocio salen «$3,000» mientras el conocimiento escribe «US$3.000». Hecho = los dos canales con cifras citables, el perfil guardando país y casos, y un solo
  - Dónde: `C:/dev/wt-puntas/docs/conocimiento/anuncios-high-ticket.md:176 · lib/media-buyer/copiloto-contexto.ts (negocioDelCopiloto) · lib/media-buyer/copiloto-conocimiento.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-marketi`
- **Lo que la sesión duplicada del CoPilot dejó sin portar** · _Varios, mediano_
  - Dos cosas de la sesión que se descartó: la operación recomendar_estrategia_marketing (propone la estrategia por canal sin pasar por la charla) y reglas de criterio parafraseadas de dos repos MIT (fatiga con frecuencia de 7 días mayor a 3, grave a 4, y CTR 20 % abajo; escalar de a 20 % cada 3 a 5 días; landing con 5 % o
  - Dónde: `C:/dev/wt-puntas/lib/media-buyer/copiloto-contexto.ts (REGLAS_DEL_COPILOTO) · lib/api-mako/areas/ads.def.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-marketing-copilot.md:48`
- **Los bloques de General no obedecen los filtros de la hoja, y la plata se escribe en dos formatos** · _Varios, grande_
  - Un filtro de período o de campo recorta los gráficos y no los bloques (el objetivo, los KPIs, el semáforo, el mes y los pendientes miden el negocio entero, salen de leerVistaGeneral sin alcance). Y los gráficos del catálogo escriben «US$2.882» con punto mientras los bloques usan fmtUSD, «$18,600» con coma: una hoja mue
  - Dónde: `C:/dev/wt-puntas/app/general/datos.ts · lib/vista-general.ts (leerVistaGeneral) · lib/format.ts (fmtUSD) · pendiente en C:/dev/wt-puntas/docs/hallazgos-objectives.md:928`
- **Nadie poda landing_pago_pedidos y un cobro de prueba puede reusarse con claves reales** · _Varios, mediano_
  - Un cron que borre lo terminado de más de unos días (con el techo, como mucho 120 filas por landing y hora). Y medir el form-action con un checkout de Stripe en dominio propio: la política nombra sólo checkout.stripe.com, y si Chrome corta un 302 a pay.sunegocio.com queda una página en blanco con el cobro creado. Hecho 
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/0276_landing_pago_pedidos.sql · lib/editor-landing/pago-pagina.ts (ORIGENES_CHECKOUT) · lib/editor-landing/pago-pedido.ts (cobroReusable) · pendiente en C:/dev/wt-puntas/docs/hallazgo`
- **Avisarle al negocio un pago rechazado o una pasarela caída** · _Varios, mediano_
  - Decidido el 14/10 (plantilla del catálogo, un evento de MaKo como pago_recibido) y no se hizo: toca el motor de avisos que el chat Automations reescribía ese día. El plan está en docs/relevo/landing-generator.md → «Lo que sigue (17/10)». Hecho = un pago rechazado en una landing le llega al dueño en el momento.
  - Dónde: `C:/dev/wt-puntas/lib/disparadores.ts · lib/avisos-catalogo.ts · lib/variables-aviso.ts · lib/plantillas-automatizaciones.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:2177`
- **Offer: falta la versión EXTERNA del PDF y el umbral de la alerta de foco sin medir** · _Varios, mediano_
  - El PDF de hoy es para el dueño (trae diagnóstico, números y datos «[completar]»): falta una versión para mandarle a un prospecto. Y alertaFoco no está medido contra los productos y ofertas reales de los clientes. Además leer una imagen, un PDF escaneado o un audio puede cobrar en la OpenAI del cliente (archivoATexto us
  - Dónde: `C:/dev/wt-puntas/lib/offer-reglas.ts (alertaFoco) · lib/ai-cheap.ts (leerDocumentoIA, transcribirAudio) · app/offer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-offer.md:379`
- **Las seis mediciones que MaKo no tiene y dejan vacias las hojas nuevas del Dashboard** · _Varios, grande_
  - Las hojas ya estan copiadas y ofreciendose, pero seis numeros no existen en MaKo, asi que nacen vacias: (1) retencion por segundo del video, con hook rate y curva de abandono, para Hooks y para VSL/YouTube; (2) confianza estadistica de un A/B entre dos creativos, para Anuncio ganador; (3) cohortes de permanencia M0-M5,
  - Dónde: `C:/dev/wt-puntas/docs/templates-dashboard-propuesta.md:238-244 (§7.4) · C:/dev/wt-puntas/docs/relevo/templates-dashboard.md:52-62 punto 3 · C:/dev/wt-puntas/app/dashboard/disenos/`
- **Techos de 1000 filas sin paginar: diez lecturas que truncan con un 200** · _Infraestructura, grande_
  - Pasar a leerTodo/leerPorPaginas (con orden único) las que siguen abiertas: closing_analyses entera (428 en ws9), plan_tareas del board del super admin (643/1000), experimento_tareas (212), vsl_events/landing_visits por visitante (612 en ws13), leads y pagos del embudo y la cobranza, cashUsd/soldUsd, bloqueados y oculto
  - Dónde: `C:/dev/wt-puntas/app/crm/insights-actions.ts:56 · lib/plan-board.ts:101,180,302,405,583,656,735,906 · lib/plan-proyecto-vacio.ts:53,107 · app/admin/dev/roadmap.ts:142 · lib/todo.ts:184,192,373,453 · lib/leads.ts:367,1482`
- **El indice docs/hallazgos.md quedo a MEDIO consolidar: 194 filas para 109 areas, no «dos de Carruseles»** · _Infraestructura, mediano_
  - La lista trajo esto como «dos filas de Carruseles». Es mucho mas grande: el propio documento declara la regla en su linea 15 («**Una fila por area** (6/11/2026)») y cuenta que ese dia eran 362 filas para 76 areas. Hoy quedan 194 filas de tabla para 109 rotulos de area y solo 53 documentos distintos: Competitors Spy tie
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos.md:15 (la regla) y toda la tabla desde :18; las dos de Carruseles son :45 y :48`
- **Traer una pieza nueva por su link no existe como comando del script oficial** · _Carruseles, mediano_
  - La receta medida (por link, 244 de 245 a ~US$0,0025; por perfil, US$4,71 y 1 de 245) sólo está implementada dentro del comando `laminas`, que lee las láminas de piezas YA guardadas. Para SUMAR un carrusel que Martín pase por link no hay comando: vivía en una copia temporal, ya borrada. Hecho = un comando que acepte una
  - Dónde: `scripts/carruseles-biblioteca.mts:505 (el único uso de `directUrls`, dentro de `laminas`); docs/hallazgos-carruseles.md:74-80 y :211`
- **Reemplazar `_doory/` de a poco para que la licencia deje de aplicar** · _Editor de imágenes, grande_
  - Martin saco el credito visible de Doory el 29/10 a su riesgo, pero la Attribution Assurance License sigue aplicando mientras quede codigo suyo, y «in whole or part, with or without modification»: un archivo adaptado alcanza. Hoy `_doory/` son 444 archivos y ~39 mil lineas. El orden medido esta en la tabla: 1) editor/ch
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:45-63 (la tabla con el orden) · C:/dev/wt-puntas/app/image-editor/_doory/ · C:/dev/wt-puntas/app/image-editor/_doory/LICENSE-DOORY`
- 🟡 **8/11: DOS de las seis, medidas.** El grupo de MaKo de Código existe (`mako.grupo_jid` del 13), y la línea de WhatsApp entrega (probado mandando un mensaje real al grupo de Leandro el 8/11). Faltan las otras cuatro: un comprobante real de Binance, un PDF de comprobante, jsPDF en el bundle y el comprobante que llega por el grupo de la APP. **Nada del cobro de agencias está verificado contra la base ni producción** · _Cobros y planes, mediano_
  - Seis cosas sin medir: un comprobante real de Binance leído; la lectura de un PDF de comprobante (WhatsApp lo guarda como documento, sólo se probó foto); jsPDF dentro del bundle de Next con este PDF; que el grupo de MaKo de Código exista (`mako.grupo_jid` del 13); un comprobante que llega por el grupo de la APP no se le
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-agencia-cobro.md:100-108 ; lib/agencia-mes-comprobante.ts ; lib/agencia-mes-pdf.ts`
- **La suscripción mes a mes no existe en el teléfono** · _Cobros y planes, mediano_
  - En /m la ficha dibuja el estado de cuenta viejo, no el bloque «Mes a mes». Además quedaron sin hacer: el prorrateo del diferencial (hoy lo calcula Martín y se registra como ajuste), una suscripción cobrada por la pasarela (su monto sale del lead, no del cobro) y cambiar el medio de un pago cobrado (sin botón ni operaci
  - Dónde: `C:/dev/wt-puntas/app/m/ (ficha del lead) ; lib/cobros.ts ; docs/relevo/nube-suscripciones.md:98-104`
- ✅ **HECHO, verificado el 8/11: los cuatro pasos están.** 0402 y 0403 aplicadas; Giselle (ws17) con `cobra_desde` 2026-10-28; la mensualidad del 13 prendida el 6/11 (desde 2026-12, entradas desde 2026-11-06, Binance); Pablo (ws18) y Patricia (ws22) en «Paga para entrar» con la cuenta pausada y la persona activa. **Terminar el cobro de agencias: 0402/0403, fecha de Giselle, mensualidad del 13 y tres «Paga para entrar»** · _Cobros y planes, mediano_
  - Seguir el orden de docs/relevo/nube-agencia-cobro.md: aplicar la 0402 (si falta) y la 0403, corregir la fecha de Giselle (17) al 2026-10-28, prender la mensualidad del 13 desde 2026-12 y pasar a 19, 22 y 15 a «Paga para entrar». Hecho = la pantalla de cartera muestra las mensualidades correctas con la cartera real.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-agencia-cobro.md · supabase/migrations/ (0402, 0403) · lib/agencia-cobro.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:74`
- **anularCobro cierra el link viejo con mejor esfuerzo: un link anulado puede seguir cobrable** · _Cobros y planes, mediano_
  - Que anularCobro devuelva si la pasarela cerró el link, y que quien lo rehace no deje dos links vivos (hoy la plata puede entrar y el pago no quedar anotado por el índice). Hecho = anular un link falla ruidosamente si la pasarela no lo cerró.
  - Dónde: `C:/dev/wt-puntas/lib/cobros.ts:1318 (anularCobro → cerrarLinkEnLaPasarela) · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:299 y :487`
- **Cuatro bloques del catálogo de Pagos no tienen componente y se saltean** · _Cobros y planes, grande_
  - Escribir confirmacion-de-pago, recordatorios-de-cobro, excepciones y cliente-en-cs. Para los recordatorios hace falta primero la columna lead_id (mig 0186). Hecho = los cuatro se dibujan cuando la plantilla los pide.
  - Dónde: `C:/dev/wt-puntas/app/crm/lead-view/ficha/reglas-pagos.ts · app/crm/lead-view/ficha/pagos/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:379`
- **Medir con claves de PRUEBA lo que nunca se probó de Stripe y Mercado Pago** · _Cobros y planes, mediano_
  - Probar: si una rk_ restringida lee GET /v1/account; si la notification_url de MP llega firmada; si MP respeta el vencimiento de una preferencia anulada con el checkout abierto; en qué estado queda una suscripción de MP al llegar su end_date; el PUT del monto de un preapproval; hosted_invoice_url con la suscripción past
  - Dónde: `C:/dev/wt-puntas/lib/cobros-conexion.ts · lib/pasarela-plan-api.ts · lib/mercadopago-api.ts · app/api/webhooks/mercadopago/route.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-planes-y-cobro.md:1367 y :1567`
- **Los 66 pagos de la base tienen `moneda` en null: los USDT de Codigo se cuentan como dolares sin rastro** · _Cobros y planes, mediano_
  - Medido el 5/11: la tabla `pagos` entera son 66 filas (49 pagadas) y las 66 tienen `moneda` y `monto_original` en null. Los pagos manuales de Codigo entraron por Binance en USDT y quedan tratados como dolares sin que nada lo diga. Ademas `metodo` esta en null en 57 de 66, y el pago de Juanfran figura `transferencia` cua
  - Dónde: `C:/dev/wt-puntas/docs/relevo/suscripciones-medicion.md §1 · C:/dev/wt-puntas/docs/relevo/admin-medicion.md §1 · C:/dev/wt-puntas/lib/pagos.ts · C:/dev/wt-puntas/app/crm/lead-view/ficha/pagos/`
- **El botón «Editar» de la ficha no se pudo sacar y de él cuelgan siete cosas sin otro lugar** · _CRM, grande_
  - Darle al DealDetailsCard su propio modo de edición dentro de la pestaña Pagos, y recién entonces mudar motivo de pérdida, deadline de nutrición manual, fecha de agendamiento, links de Fathom R1/R2, «Borrar lead» y la confirmación con el diff a lugares donde se lean. Hecho = el botón se puede borrar sin perder la edició
  - Dónde: `C:/dev/wt-puntas/app/crm/[id]/DealDetailsCard.tsx (799 líneas, prop `editing`) · app/crm/[id]/EditLeadForm.tsx · app/crm/LeadSheet.tsx:211 y :327 · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:7709`
- **/crm/prospectos no tiene pantalla en MaKo Mobile, y buscar/pasar al CRM no está en la API** · _CRM, mediano_
  - Página de prospectos en /m, y las escrituras de la API (buscar cuesta plata, pasar escribe en lote: piden pantalla propia). Hecho = en un teléfono se abre prospectos sin la cubierta de «se usa en la computadora».
  - Dónde: `C:/dev/wt-puntas/app/m/crm/ · lib/api-mako/areas/crm.def.ts (listar_prospectos, busquedas_prospeccion) · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:10031`
- **El encargo de la suscripcion en la ficha del lead y la vista de edicion (5/11) tampoco lo tomo nadie** · _CRM, grande_
  - `docs/relevo/suscripciones-ficha-encargo.md` y su medicion (`suscripciones-medicion.md`, 110 lineas) no aparecen en ningun item de la lista. Lo pedido: que la ficha aguante una mensualidad que CAMBIA mes a mes (el caso real de Codigo Inmobiliario: 146 en octubre, 238 en noviembre en dos pagos) y una «vista de edicion» 
  - Dónde: `C:/dev/wt-puntas/docs/relevo/suscripciones-ficha-encargo.md · C:/dev/wt-puntas/docs/relevo/suscripciones-medicion.md · C:/dev/wt-puntas/app/crm/lead-view/ficha/pagos/bloques-cobro.tsx:54,497,756`
- **El Ops Center: etapa 2 (la cuota) y etapa 3 (el señalador) sin empezar** · _SuperAdmin, grande_
  - Las dos etapas del Centro de Operaciones quedaron escritas y sin hacer. Hecho = la cuota se ve y el señalador funciona.
  - Dónde: `C:/dev/wt-puntas/app/admin/operaciones/ · C:/dev/wt-puntas/docs/relevo/centro-operaciones.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-operaciones.md:2340`
- **Customers: seis pendientes de la ficha de un negocio** · _SuperAdmin, grande_
  - El MRR mes a mes de verdad (hoy se dibuja lo cobrado; el histórico pide una foto por día que nadie guarda); las fichas de agencia con sus clientes adentro; administrar desde el teléfono; pasar onboardingsHechos y leadsDe a leerPorPaginas (con más de 1000 negocios la primera corta en silencio); Activity por negocio dent
  - Dónde: `C:/dev/wt-puntas/lib/clientes-plataforma.ts · app/admin/ · app/api/agencia/entrar · pendiente en C:/dev/wt-puntas/docs/hallazgos-customers.md:255`
- **El encargo de rehacer la tab Customers como «Admin» (5/11) no lo tomo nadie y ninguna familia lo leyo** · _SuperAdmin, grande_
  - `docs/relevo/admin-encargo.md` es un encargo completo del Cerebro, escrito el 5/11 para una sesion de la nube, y no figura en ninguno de los items que trajeron las siete familias. Pide seis bloques: Actividad (quien se conecta y quien dejo de entrar), Uso por tab y por negocio, Errores y tickets, Ingresos (total por cl
  - Dónde: `C:/dev/wt-puntas/docs/relevo/admin-encargo.md · C:/dev/wt-puntas/docs/relevo/admin-medicion.md · C:/dev/wt-puntas/app/customers/ · C:/dev/wt-puntas/app/_components/nav.ts:225 (SECCIONES_ADMIN)`
- **La tab de Admin le muestra a Martin «Lo que entro este mes · US$0» y un texto que es falso** · _SuperAdmin, mediano_
  - Medido el 5/11 contra produccion: `lib/clientes-plataforma.ts` calcula el MRR solo con filas de `cobros` que tengan `alta_ws` o `cliente_ws` y esten `activa`; las 2 filas que hay no cumplen ninguna de las dos, asi que MRR = 0 y «pagan» = 0. El numero grande que se ve es el del mes en curso, no el cobrado ni el MRR. Y e
  - Dónde: `C:/dev/wt-puntas/lib/clientes-plataforma.ts (`cobrosDeLugares`, `factura`, `cuotasDeLaPlataforma`) · C:/dev/wt-puntas/app/customers/ (CustomersApp, bloque «Plata») · C:/dev/wt-puntas/docs/relevo/admin-medicion.md §1`

## Traba otra cosa (18)

- **La URL vieja del webhook del WhatsApp no oficial vence MAÑANA (7/11)** · _Infraestructura, chico_ · ⟳ estaba anotado 2 veces
  - Entrar a /whatsapp y tocar «Reparar espejo» en cada línea que siga muda. Hecho = ninguna línea queda sobre la URL legada. Pasada la fecha, el espejo de esa línea muere en silencio (ya pasó el 10/07).
  - Dónde: `lib/evolution-firma.ts:29 (CORTE_LEGADO) · docs/relevo/pendientes-barrido.md P1 · docs/pendientes.md:267`
- **El anuncio programado (la mitad que falta de la promesa 5a)** · _CRM, grande_ · ⟳ estaba anotado 2 veces
  - Hoy una campaña nace EN PAUSA (`proponer_crear_campana`) y no hay «fecha de inicio». El camino recomendado: enlazar el evento Anuncio a una campaña en pausa del Media Buyer y, a la hora del evento, un cron la prende por `lanzar` (zona, fecha de fin, topes), con la misma revisión adversarial de todo lo que gasta. La alt
  - Dónde: `C:/dev/wt-puntas/lib/media-buyer/ejecutar.ts (lanzar) ; docs/relevo/nube-thiago-migrar.md:51-55`
- **La subida de una foto del chat no tiene plazo** · _Editor de imágenes, chico_
  - El XHR va sin `timeout` (copiado de app/customer-success/curso/): con la red trabada, «corriendo» espera a que el navegador se rinda y la persona no sabe que paso. HECHO cuando la subida tenga plazo y, al vencerse, lo diga en «No se aplica» sin tirar el pedido.
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:736 · el `useAdjuntosDelChat` del chat de Image · C:/dev/wt-puntas/app/customer-success/curso/ (de donde se copio)`
- **El hook `pre-push` del clon del Runner es viejo: dice «rama integracion» y no corre el filtro chico** · _Infraestructura, chico_
  - Anotado en el relevo del Runner y en ninguno de los items de la lista. Un pre-push viejo no corre el filtro chico, asi que ese clon puede empujar algo que el pre-push nuevo habria frenado. Se reinstala con lo escrito en `docs/relevo/nube-metodologia.md`. Hecho = el hook de ese clon corre el filtro chico y no nombra una
  - Dónde: `C:/dev/wt-puntas/docs/relevo/runner.md:37-48 (§Sin hacer) · C:/dev/wt-puntas/docs/relevo/nube-metodologia.md (como se instala)`
- **`lib/centro-limbo.ts` quedo con cuatro funciones sin ninguna pantalla que las llame** · _Infraestructura, chico_
  - Verificado con grep: `chatsParaMandarle` no tiene mas uso que su propia definicion, y `originalParaReenviar` solo aparece en su definicion y en un documento de bitacora; `queHacer` y `textoDelCartel` existen en otros modulos pero no para el limbo. `descartarDelLimboAction` esta declarada en `app/admin/operaciones/accio
  - Dónde: `C:/dev/wt-puntas/lib/centro-limbo.ts (`originalParaReenviar`, `queHacer`, `chatsParaMandarle`, `textoDelCartel`) · C:/dev/wt-puntas/app/admin/operaciones/acciones.ts (`descartarDelLimboAction`) · C:/dev/wt-puntas/docs/re`
- **Si el cron del Runner vence el 11/11, el vigia se apaga y la guardia no lo mira** · _Infraestructura, chico_
  - El relevo del Runner lo deja escrito: si el cron vence sin rearmarse, la medicion sigue por `medirYa` de la guardia, pero el vigia se apaga y nada avisa. La lista trae el «rearmar el cron antes del 11/11» (que solo puede pedir Martin), pero no esto, que es codigo y no depende de el: que la guardia chequee si el cron ex
  - Dónde: `C:/dev/wt-puntas/docs/relevo/runner.md:37-40 (§Sin hacer, primer punto)`
- **`punta.yml` no frena el correo noreply@anthropic.com y Vercel bloquea esos deploys** · _Infraestructura, chico_
  - La nube viene firmando con `noreply@anthropic.com` y Vercel bloquea esos deploys. Las puntas de rescate se firmaron a mano con el correo del equipo, pero la mezcla de `punta/spy-busqueda` entró a main con `noreply` (9202c22d2). Falta que `punta.yml` frene ese correo como frena `[bot]`. Lo decide Integración.
  - Dónde: `C:/dev/wt-puntas/.github/workflows/punta.yml ; docs/relevo/nube-ramas.md:33-35`
- **Los cursos completos en Conocimientos** · _grande_ · ⛔ **TRABADO — pide Chrome conectado (revisado el 7/11/2026 — `9a617e8aa`)** · _Varios_
  - Dónde: `scripts/curso-api.mjs · app/conocimientos/catalogo.ts · docs/hallazgos-conocimiento.md:2550,3485-3495 · app/admin/dev/conocimientos/bitacora.ts:41`
- **Hook generator (backlog explicito de Martin)** · _mediano_ · ⏸️ **LO APARCÓ MARTÍN, no está trabado (confirmado el 7/11/2026)** · _Varios_
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:172-173`
- **Conectar Google Drive para que MaKo lea los links que pasan los clientes** · _mediano_ · ⛔ **TRABADO — lo decide Martín, no es una tarea (medido el 7/11/2026)** · _Varios_
  - Dónde: `lib/google-calendar.ts:37,43,45-54 · lib/api-mako/areas/ads.run.ts:896`
- **El Plan: `recurrente` no entra por WhatsApp ni por la API, y juzgarConCriterio es código muerto** · _Varios, mediano_
  - La cadena quedó cerrada para la reunión de Fathom, el cron y el archivo subido; los otros dos productores de borradores no preguntan ni mandan el campo, y se cae en el map sin error. También tareasDesdeRespuestas: una tarea que nace del wizard no puede nacer recurrente. Y nadie llama a juzgarConCriterio: el juez del cr
  - Dónde: `C:/dev/wt-puntas/lib/mako-doer-acciones.ts:844 · app/api/agente/plan/route.ts:105 · lib/plan-propuesta.ts (TareaExtra, tareasDesdeRespuestas) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:1269`
- **Volver a analizar con IA las piezas ya analizadas para que tomen los 19 formatos del catálogo** · _Competitors Spy, mediano_
  - Los 19 formatos del catálogo ya están y la IA recibe qué es cada uno, pero lo ya analizado no se vuelve a mandar solo: queda con el formato viejo. Falta decidir y correr una repasada. Lo mismo bloquea «los formatos nuevos del catálogo en el análisis de piezas», que el relevo marca pendiente.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-spy.md:79-80 ; spy_piezas.analisis (el formato va dentro del mismo jsonb)`
- **Lo que entre de ahora en más a la biblioteca no pasa por ninguna curaduría** · _Carruseles, mediano_
  - Una lectura nueva (`leer`) queda visible sin que nadie la mire, y ya se midió que el filtro automático no alcanza: el modelo barato se pasó de estricto (35 de 388 escondidos volvieron) y el filtro gratis `(laminas ?? 0) >= 3 && parece_contenido === true` tiraba 457 piezas por falta de dato, de las cuales 363 servían. H
  - Dónde: `lib/carruseles/biblioteca-servidor.ts:87 (`dejo_de_verse_en`), scripts/carruseles-biblioteca.mts (comando `leer`); docs/hallazgos-carruseles.md:210`
- **1.213 carruseles de 1.470 siguen sin tipo** · _Carruseles, mediano_
  - `reclasificar` ya bajó de 1.253 a 1.213 leyendo el texto (portugués, alemán e inglés). Bajar de ahí necesita las láminas bajadas y leerlas con visión — o sea depende del item de las 111 láminas. Hecho = un número de «sin tipo» que no se mueva al correr `reclasificar` y el filtro de tipo con cobertura real.
  - Dónde: `C:/dev/wt-puntas/scripts/carruseles-biblioteca.mts (reclasificar) ; docs/relevo/nube-carruseles-rediseno.md:122-129`
- **Tanda 5: lo de Canva que Doory no trae** · _Editor de imágenes, grande_
  - Notas adhesivas, dibujo y tablas (drawers/ToolsPanel.tsx), copiar estilo, lineas en codo y curva, texto alternativo, descargar la seleccion, bloquear y ocultar pagina, «Ir a la pagina». Los 8 paquetes estan en orden en el relevamiento. HECHO cuando cada paquete tenga su fila marcada en ese documento.
  - Dónde: `C:/dev/wt-puntas/docs/editor-imagen/relevamiento-canva-funciones.md (los 8 paquetes) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:454-455 · C:/dev/wt-puntas/docs/relevo/image-editor.md:61`
- **Las 10 plantillas de Doory salieron de «Nuevo diseno» pero NO se borraron** · _Editor de imágenes, mediano_
  - Siguen en el panel «Diseno» del editor y en la API (`plantillas`). El plan pide borrarlas con sus JSON y sus WebP. Toca el panel del editor, la API y TRES tests, y dos se rompen a proposito (el 1 de plantillas-crear, «primero lo en blanco», y el 5, la lista literal PLANTILLAS_NUEVO_DISENO): se reescriben con el cambio,
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/plantillas/ · public/cv/plantillas/ · tests/api-mako-imagen, tests/plantillas-sugeridas-editores, tests/_bloques-tarjeta-hijo · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md:70-73`
- **Brand board (PDF) en el Segundo Cerebro y varios kits de marca** · _Editor de imágenes, grande_
  - Que MaKo pida el brand board en el onboarding, lo guarde en el Second Brain y lo ofrezca al entrar a cualquier editor («lo hacemos con tu turquesa?»), soportando varios kits (el de ella y el de sus clientes). Sin esto fallan los carruseles.
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:44 (2.9) · app/second-brain/ · app/onboarding/ · lib/image-editor/chat/ia.ts · lib/editor-video/chat-catalogo.ts`
- **faltantesParaMover decide con hoyEnTijuana() fijo: bloquea o destraba a MaKo un día antes o después** · _CRM, mediano_
  - Pasar el gating a la zona del workspace (no es display: decide si una reunión «ya pasó» y si se exige asistencia o Fathom). Hecho = para un workspace en Madrid el borde del día es el suyo.
  - Dónde: `C:/dev/wt-puntas/lib/leads.ts:1570 · lib/date-utils.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ia.md:1971`

## Lo que falta construir (173)

- **La poda de los 30 dias de Thumbnails es a mano y nadie la automatizo** · _Thumbnails, chico_ · ⟳ estaba anotado 4 veces
  - Sin la enmienda III.L, lo que se guarda de la YouTube Data API (titulos, vistas) vence a los 30 dias: la pantalla no muestra lo leido hace mas (`vigente`) y hay que borrarlo (`podar`). El documento lo deja como «cada mes: `leer` de nuevo y `podar --de-verdad`», y no hay cron ni tarea programada que lo llame. HECHO cuan
  - Dónde: `C:/dev/wt-puntas/docs/carruseles/thumbnails.md:86 · C:/dev/wt-puntas/lib/spy-reglas.ts:313 (metricasVencidas) · C:/dev/wt-puntas/lib/thumbnails/explorar.ts`
- **Los anuncios en video ya guardados siguen apareciendo hasta la próxima lectura de Spy** · _Carruseles, chico_ · ⟳ estaba anotado 3 veces
  - El código nuevo ya guarda `medio` para los anuncios (`displayFormat` de Apify) y el explorador no muestra ni cuenta un video, pero lo que YA está guardado no tiene `medio`, y si su miniatura ya se copió a nuestro bucket se perdió la única pista (la carpeta de cuadros de video del CDN de Meta, `/t15.`). Se corrige solo 
  - Dónde: `lib/carruseles/anuncios.ts (`esAnuncioEnVideo`), lib/spy-todo-reglas.ts y lib/spy-medio.ts (`medioDeAnuncio`), lib/spy.ts (`guardarMedios`); docs/relevo/nube-carruseles-rediseno.md:205-206`
- **Revisar a mano `punta/carruseles-thumbnails`, que entró a main sin que nadie lo mire** · _Carruseles, mediano_ · ⟳ estaba anotado 3 veces
  - El commit 25fbdc8a1 (ya en main, HEAD a11e7540f) trae el feedback de producción del 6/11 tarde: portada de Image, el CTA fuera, variedad por cuenta, anuncios sin video, flechas en el teléfono, el arreglo de «Editar» y la tab Thumbnails. Nadie lo revisó contra los pedidos de Martín con las capturas. Hecho = una pasada p
  - Dónde: `docs/relevo/cerebro.md:13; docs/carruseles/capturas-2026-11-06/ (13 capturas, 1440 y 390, claro y oscuro)`
- **Los prompts de carruseles y stories están incrustados en el código y el historial vive en memoria** · _Carruseles, mediano_ · ⟳ estaba anotado 3 veces
  - `lib/ig-writer.ts` tiene los prompts hardcodeados (deberían pasar por el patrón de prompt editable, skill `add-editable-prompt`) y el historial del chat vive en memoria, así que se pierde. Hecho = los prompts se editan sin desplegar y el historial sobrevive a recargar la página.
  - Dónde: `lib/ig-writer.ts; docs/relevo/pendientes-barrido.md:131`
- **Código Inmobiliario: 21 fallos y 10 borradores de WhatsApp sin investigar** · _CRM, chico_ · ⟳ estaba anotado 2 veces
  - El relevo de `crm-bajas-3010` lo deja escrito y dice «puede ser error nuestro». Hay que leer `errores_app` y `wa_borradores` del ws 13 y decir qué pasó. Es de un cliente que paga.
  - Dónde: `docs/relevo/pendientes-barrido.md P15 · docs/relevo/pendientes-0311.md §3 («Código Inmobiliario, sin ticket») · errores_app y wa_borradores del ws 13`
- **Nada avisa al super admin cuando pasa el día 5 sin el «Pagado» de una agencia** · _Cobros y planes, chico_ · ⟳ estaba anotado 2 veces
  - Un aviso (push o grupo) al super admin pasado el día 5; hoy sólo se ve entrando a la pantalla o con ver_mensualidades_agencias. Hecho = el 6 llega el aviso con las agencias que no pagaron.
  - Dónde: `C:/dev/wt-puntas/lib/agencia-cobro.ts · lib/api-mako/areas/ (ver_mensualidades_agencias) · pendiente en C:/dev/wt-puntas/docs/hallazgos-agencias.md:74`
- **«Editar» de carruseles nunca se probó con la IA real** · _Carruseles, chico_ · ⟳ estaba anotado 2 veces
  - Correr `scripts/carruseles-probar-editar.mts --ws 3 --sin-laminas` y también con un carrusel CON láminas, y comprobar en producción el diseño que falló (/image-editor/b31f62ec-5727-4ac7-bde7-2bb141bf0727). Hecho = el texto es del negocio, las letras son las del editor, no hay recuadros grises y no vuelve «Tu IA no cont
  - Dónde: `scripts/carruseles-probar-editar.mts · lib/carruseles/replica-servidor.ts (`replicarEjemplo`) · docs/relevo/nube-carruseles-rediseno.md:193 paso 1 · docs/relevo/cerebro.md:19`
- **El guion de videos de YouTube nunca se pidió de verdad: las 7 pruebas dieron 503** · _Competitors Spy, chico_ · ⟳ estaba anotado 2 veces
  - Transcribir un video real con el Gemini del negocio y medir el costo por minuto (`usageMetadata`), que queda en `anthropic_usage` con feature='spy'. Hecho = un guion completo en pantalla y un renglón de costo medido. Hoy no hay ni un pedido real.
  - Dónde: `C:/dev/wt-puntas/lib/spy-transcripcion-servidor.ts (tramoDeYoutube) ; lib/ai-cheap.ts (modelosSttGemini) ; docs/relevo/nube-spy.md:83`
- **Seis migraciones anteriores a la 0331 nunca se midieron** · _Infraestructura, chico_ · ⟳ estaba anotado 2 veces
  - De la 0331 en adelante están medidas: 48 aplicadas, 0 ausentes, 4 «sin verificar» (0336, 0347, 0348, 0352, que sólo recrean algo que ya existía). Quedan sin medir 0298, 0299, 0302, 0314, 0316 y 0330. Correr `node scripts/verificar-migraciones-aplicadas.mjs` (sólo lee) desde la 0298 y aplicar las ausentes en su orden de
  - Dónde: `scripts/verificar-migraciones-aplicadas.mjs · docs/relevo/pendientes-barrido.md P4 · docs/relevo/pendientes-pc/pasos-cerebro-6-11.md §Conteos`
- **El limbo del Runner: 6 mensajes, los primeros vencen el 8/11** · _Infraestructura, chico_ · ⟳ estaba anotado 2 veces
  - Cerrarlos desde el Ops Center antes del 8/11. Hecho = el limbo en 0.
  - Dónde: `docs/relevo/pendientes-barrido.md P2 · app/admin/operaciones`
- **Plantillas: Offer, AI Avatar, Web Generator y Dashboard sin empezar** · _Varios, grande_ · ⟳ estaba anotado 2 veces
  - Cada una es un enchufe en `lib/creaciones-enchufes.ts` con su `paraPublico`, el `<ModalGuardarPlantilla>` en el «⋯» y `usePlantillasPropias(tipo)` en «Nuevo …», como ya están Copywriter e Image. Aparte, en Offer falta el experto `offer.experto`, «Ver ejemplo» dentro de la conversación, el teléfono, y el bug de `precioD
  - Dónde: `C:/dev/wt-puntas/lib/creaciones-enchufes.ts ; app/m/offer/HojasOfferM.tsx ; docs/plantillas-reales/offer.md §3.3 ; docs/relevo/nube-plantillas.md:33-48`
- **Spy no tiene pantalla de telefono** · _Competitors Spy, grande_ · ⟳ estaba anotado 2 veces
  - No existe `app/m/competitor-spy/page.tsx` (lo verifique: la carpeta no esta) y `market-an` sigue anotada en `EN_CAMINO`, asi que en More se ve como «En la computadora». El diseno esta decidido (diseno-competitors-spy.md §8: un bloque por pantalla plegados, galeria a una columna, filtros en una hoja que sube). Lo que NO
  - Dónde: `C:/dev/wt-puntas/lib/movil-rutas.ts:507-519 (EN_CAMINO, 'market-an'); falta crear C:/dev/wt-puntas/app/m/competitor-spy/page.tsx; el componente a montar: C:/dev/wt-puntas/app/competitor-spy/GraficoSpy.tsx`
- **1.213 de 1.470 carruseles siguen sin tipo: el problema es el clasificador, no el comando** · _Carruseles, mediano_ · ⟳ estaba anotado 2 veces
  - Es trabajo de CÓDIGO, no un script: `reclasificar` en seco ya dio «1.253 → 1.253», 0 cambios, así que correrlo con --de-verdad no sirve. El 85 % sigue sin tipo y muchos son textos en portugués, alemán e inglés; quedan 512 piezas con `parece_contenido` nulo. Hecho = el clasificador reconoce otros idiomas y el porcentaje
  - Dónde: `lib/carruseles/biblioteca.ts (función `reclasificacion`) · docs/relevo/pendientes-pc/pasos-cerebro-6-11.md §A3`
- **«Editar» con una IA real nunca se probó, y el arreglo está en main pero no en producción** · _Carruseles, mediano_ · ⟳ estaba anotado 2 veces
  - El arreglo de «Tu IA no contestó ahora» YA está en main (`chatCheapCascade` con 8.000 tokens de salida en lugar de `chatCheap` con 512, la portada bajada con `fetchSeguro`, y el camino de guías mostrando sus láminas). Falta: (1) que entre a producción — el deploy del 11:08 UTC fue ANTES de este commit, y producción com
  - Dónde: `lib/carruseles/replica-servidor.ts:221-242 (el arreglo), lib/carruseles/replica.ts:457 (`avisoSinIA`) y :481 (`vuelveASinVer`); scripts/carruseles-probar-editar.mts`
- **Carruseles: de la marca del negocio sólo se aplican texto, tipografía y fondo** · _Carruseles, mediano_ · ⟳ estaba anotado 2 veces
  - El chat de Imagen sólo recibe persona y núcleo MaKo, sin colores ni logo, así que la marca no se aplica entera (pedido de Leila del 30/10, medido A MEDIAS el 5/11). Falta pasar colores, logo y fuentes al prompt. Hecho = un carrusel generado sale con los colores y el logo del brand board del negocio, no sólo con su fond
  - Dónde: `lib/landing-writer.ts:153 (lo que hoy recibe el chat), lib/image-editor/chat/ia.ts y lib/image-editor/chat/prompts.ts (donde hay que pasarlo); docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:43`
- **El carrusel 4:5 sólo se puede hacer en Imagen, no en el Web Generator** · _Carruseles, mediano_ · ⟳ estaba anotado 2 veces
  - Pedido de Leila repetido tres veces (2.14, 3.9, 4.10): que el carrusel 4:5 se pueda armar también en el Web Generator, porque en Gamma le sale «mucho más rápido» que emulando Canva. Existe en Imagen. Hecho = el Web Generator ofrece el formato 4:5 con las plantillas de carrusel.
  - Dónde: `app/web-generator (donde hay que ofrecerlo), lib/carruseles/ y app/image-editor/carruseles/ (lo que ya existe); docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:66`
- **«Tus plantillas» de Image no esta en el telefono** · _Editor de imágenes, mediano_ · ⟳ estaba anotado 2 veces
  - La pantalla del telefono usa la lista de MaKo y no monta `usePlantillasPropias`, asi que las plantillas propias y «De la comunidad» solo se ven en la computadora. Lo mismo «Hacer el mio» y «Ver ejemplo» de carruseles: en el telefono se crea con la plantilla, sin el dialogo. HECHO cuando en /m/image-editor se vean «Tus 
  - Dónde: `C:/dev/wt-puntas/app/m/image-editor/InicioImagenM.tsx · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md:41 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:798-800`
- **La iniciativa de Image (T12): falta la sugerida de la familia, el slug y la guia de la pestania** · _Editor de imágenes, mediano_ · ⟳ estaba anotado 2 veces
  - La apertura con el diseno en blanco («Donde lo vas a publicar?» -> historia 1080x1920, carrusel 1080x1350, anuncio 1080x1080) esta hecha y probada. Faltan tres: (a) «la sugerida de esa familia» como cuarta respuesta, que llega con las plantillas reales; (b) guardar el slug de la plantilla elegida; (c) la GUIA de la pes
  - Dónde: `C:/dev/wt-puntas/lib/aperturas/image.ts · C:/dev/wt-puntas/app/image-editor/mako/chat/PanelMakoIA.tsx · tests/iniciativa-image.test.ts · C:/dev/wt-puntas/docs/relevo/nube-iniciativa.md:46 · docs/mako-iniciativa/guia.md §`
- **A5: el aviso con el total de la agencia del 1 al 5 no existe** · _Cobros y planes, mediano_ · ⟳ estaba anotado 2 veces
  - No hay consolidacion mensual de agencia. Hace falta un cron del dia 1 que sume los clientes de la agencia y avise. Prometido a Juanfran y Joan.
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:84 · lib/agencia-cobro.ts · app/api/cron/`
- **Faltan los hitos en las bitácoras de /admin/dev de varias áreas** · _SuperAdmin, chico_
  - Dashboards, Carruseles y Recorrido visual no escribieron su hito porque el brief prohibía tocar app/admin. Los commits y el pedido textual de Martín están en cada relevo, listos para pegar. El Copywriter además no es un área de /admin/dev (ningún `vive[]` declara app/copywriter) y Offer no tiene bitácora.
  - Dónde: `C:/dev/wt-puntas/app/admin/dev/dashboard/bitacora.ts ; app/admin/dev/admin/bitacora.ts ; docs/relevo/nube-dashboards.md:49-50 ; docs/relevo/nube-recorrido-visual.md:81-83`
- **Tres arreglos del recorrido visual en Admin que ningún chat tocó** · _SuperAdmin, chico_
  - SB1: la caja dice «Escribe a Chat nuevo» (app/admin/operaciones/Conversacion.tsx:250 y PiezasCliente.tsx:179). CU1 y CU2: las cuentas de prueba cuentan como clientes, y «Nuevos en 30 días» y «Para mirar» tienen alcances distintos sin decirlo. Quedaron fuera porque el brief decía «No toques Admin».
  - Dónde: `C:/dev/wt-puntas/app/admin/operaciones/Conversacion.tsx:250 ; app/admin/operaciones/PiezasCliente.tsx:179 ; lib/clientes-plataforma.ts:164 ; lib/customers-vista.ts:74,78`
- **Avisarle al jefe «Sidebar» que /admin pliega la barra de MaKo** · _SuperAdmin, chico_
  - /admin pliega la barra como el Ops Center (`pliegaLaBarra` con `SECCIONES_ADMIN`, exportada de app/_components/nav.ts). No cambia las familias ni el menú, pero el jefe Sidebar tiene que saberlo.
  - Dónde: `C:/dev/wt-puntas/app/_components/nav.ts (SECCIONES_ADMIN, pliegaLaBarra) ; docs/relevo/nube-admin-polar.md:131-132`
- **El agente del Marketing CoPilot nunca se probo con IA real** · _SuperAdmin, chico_
  - Hay 14 conversaciones escritas para probarlo. Hecho = las 14 corridas con IA real y su resultado anotado.
  - Dónde: `docs/marketing-copilot/conversaciones.md · docs/relevo/cerebro.md:31`
- **Recalibrar los subtítulos para Anton (MAX_CHARS, CUERPO, Y venían de Segoe UI Black)** · _Editor de video, chico_
  - Anton es más angosta: si esos números salieron de mirar cuadros, los renglones quedan cortos. Sin verificar, y la sesión que los eligió ya cerró. Hecho = un render con Anton mirado cuadro a cuadro y los tres números ajustados.
  - Dónde: `C:/dev/wt-puntas/scripts/montar-anuncio-vertical.sh (MAX_CHARS=18, CUERPO=52, Y=950) · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:956`
- **La curva de retencion por video no se puede ver** · _Editor de video, chico_
  - `curvaRetencion` acepta `videoId` y nadie se lo pasa. Pedido: «que todos los videos se puedan medir».
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:206-207 · app/admin/dev/vsl-tracking/bitacora.ts:34`
- **Probar «Editar» de una miniatura con una IA real** · _Thumbnails, chico_
  - Después de cargar la biblioteca, correr `carruseles-probar-editar.mts --ws 3 --que thumbnail --id <id>`. Hecho = se abre un diseño de 1280×720 en el Image Editor con texto del negocio, no del ejemplo. Nunca se probó: la nube no tiene claves.
  - Dónde: `C:/dev/wt-puntas/scripts/carruseles-probar-editar.mts ; lib/carruseles/replica-servidor.ts (replicarEjemplo con que:'thumbnail')`
- **El rubro de un canal lo pone la búsqueda, no un clasificador** · _Thumbnails, chico_
  - Un canal de ventas que hace un video de marketing queda en ventas. Es una limitación conocida, no un bug. Hecho = o se clasifica el video (pasada de IA, como el «tema» de carruseles) o queda documentado que el rubro es del canal y no del video.
  - Dónde: `lib/thumbnails/carga.ts; docs/carruseles/thumbnails.md:94`
- **«Hacerlo» del chat de MaKo en el CRM puede duplicar entre instancias** · _CRM, chico_
  - Reclamar con cambiarSettingSi en la base antes de calcular; hoy el candado EN_CURSO vive en memoria. Hecho = dos pestañas apretando «Hacerlo» crean una sola vez.
  - Dónde: `C:/dev/wt-puntas/lib/sugerencias-crm-server.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:1306`
- **Una nota dictada desde el teléfono se recorta a 4000 caracteres en silencio** · _CRM, chico_
  - Rechazar con TOPE_NOTA y decirlo en el toast, en vez de cortar antes de llamar al alta (el rechazo del escritorio nunca la ve). Hecho = una nota más larga que el tope da error visible y no se guarda cortada.
  - Dónde: `C:/dev/wt-puntas/app/m/crm/acciones.ts:80 (notaLeadAction, slice(0,4000)) · app/crm/notas-reglas.ts (TOPE_NOTA) · pendiente en C:/dev/wt-puntas/docs/hallazgos-mobile.md:1507`
- **saveFunnelAction no valida rol** · _CRM, chico_
  - Sumarle el corte de rol como las demás server actions del CRM. Hecho = un closer no puede guardar el funnel.
  - Dónde: `C:/dev/wt-puntas/app/crm/actions.ts:1771 · pendiente en C:/dev/wt-puntas/docs/hallazgos-comunicacion.md:4316`
- **El kanban del cliente sigue mostrando las tareas de la Retro y de los experimentos** · _CRM, chico_
  - Filtrar en listTareas como ya lo hace «Re-priorizar todo» con esDelPlanCliente. La SPEC lo pedía y ninguna tanda lo hizo. Hecho = el tablero del cliente no muestra tareas de Retro ni de experimentos.
  - Dónde: `C:/dev/wt-puntas/lib/todo.ts (listTareas) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:2701`
- **«Guardar en MaKo» de la extensión nunca se vio en una página real** · _CRM, chico_
  - Probar en el Chrome de Martín con un perfil de Instagram y uno de LinkedIn: que el botón aparezca, que el nombre salga bien (sale del título y de las etiquetas «og:»; si no, el campo queda vacío y se escribe a mano) y que el lead nazca con su foto. Después, publicar la 0.77.0.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-thiago-anuncios.md:54-58 ; el manifest de la extensión`
- **La carrera de `emitir_recibo` nunca se probo** · _Cobros y planes, chico_
  - Probarla con dos conexiones (`begin; select emitir_recibo(...); rollback;`). No se corrio porque escribe aunque se deshaga y el encargo era solo lectura.
  - Dónde: `docs/relevo/pendientes-pc/pasos-cerebro-6-11.md:87`
- **El store de mensajes del ws9 es el default de todos los clientes** · _Chat de MaKo, chico_
  - Que leerPar no caiga al par del ws9 para un negocio sin el suyo. Hecho = un negocio sin plantillas propias no lee las de MaKo.
  - Dónde: `C:/dev/wt-puntas/lib/plantillas.ts (leerPar) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:4037`
- **El reporte semanal no sale por WhatsApp desde que se borró Chatwoot** · _Chat de MaKo, chico_
  - Volver a enchufar despacharReporte al canal vigente. Hecho = el reporte semanal llega al grupo del negocio.
  - Dónde: `C:/dev/wt-puntas/lib/notify.ts (despacharReporte) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:4037`
- **Un email del lead no pausa la automatización que le está escribiendo** · _Chat de MaKo, chico_
  - Una línea con origen: 'email' en recibirEmailEntrante que llame a pausarPorRespuesta. Hecho = contestar por email pausa la secuencia igual que contestar por WhatsApp.
  - Dónde: `C:/dev/wt-puntas/lib/email-entrante.ts (recibirEmailEntrante) · lib/nutricion.ts (pausarPorRespuesta) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:3272`
- **Crear la fila de «Tareas de Reuniones al Plan» después del deploy** · _Chat de MaKo, chico_
  - Correr `scripts/mudanza-avisos-plataforma.mts --eventos=reunion_tareas_al_plan --aplicar` DESPUÉS del deploy que trae la tanda. Nace pausada, con la exclusión del negocio 13. Prenderla es decisión de SuperAdmin, mirando el texto. El Cerebro anotó «No corrí ninguno».
  - Dónde: `C:/dev/wt-puntas/scripts/mudanza-avisos-plataforma.mts ; lib/plantillas-automatizaciones.ts ; docs/relevo/nube-nada-por-detras.md:25-29 ; docs/relevo/cerebro.md:14`
- **«Ignorar» del Ops Center nunca se vio en el teléfono de Martín** · _Chat de MaKo, chico_
  - La 0394 ya está aplicada, así que las decisiones de la Ticketera también se ignoran. Falta mirarlo en el Ops Center de verdad, en su teléfono. Y si Martín quiere, «Ignorar todas las viejas» de un toque: no se hizo porque no lo pidió.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-ops-ignorar.md:51-56 ; app/admin/operaciones/`
- **Black November de Leila: dos cosas sin verificar antes del lanzamiento** · _Chat de MaKo, chico_
  - (1) Si el número de Leila ya llega a sus 40 envíos por día: si no venía llegando a su tope, el día del lanzamiento arranca en 20 y llega a 40 al día siguiente. Para lanzar con 40 desde el primer día, `cambiar_limites_envio` con `waArranqueDia: 40`. (2) Una landing publicada en producción con los tres bloques (cuenta re
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-black-november.md:96-104 ; lib/limites-envio ; lib/editor-landing/`
- **Mauricio (ws1) no tiene un solo mensaje en su grupo desde el 4/10** · _Chat de MaKo, chico_
  - Es el cliente mas activo y puede ser que no escriba o que la entrada este rota (los ws 9, 18 y 22 tampoco tienen filas desde el 22/10). Si esta rota, se perdieron todos sus pedidos. Hecho = saber cual de las dos es.
  - Dónde: `docs/relevo/pedidos-perdidos-2810.md:40,218,282 (mako_doer_buffer / mako_doer_conv)`
- **El aviso por la linea secundaria cuando se cae la principal** · _Chat de MaKo, chico_
  - Hoy el aviso sale por mail y nunca se probo con una caida real. El webhook ya guarda cual numero se cayo (tanda 5 del barrido).
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:111-113 · docs/hallazgos-comunicacion.md:368 · lib/lineas-vigilante.ts`
- **Las plantillas del editor de imagen: borrar las 10 de Doory y las preguntas al crear** · _Editor de imágenes, chico_
  - Borrar las 10 plantillas de Doory del editor y de la API, las fotos de muestra del ejemplo, y las preguntas al crear (detalle en docs/relevo/nube-plantillas.md). Hecho = la galería de Image no muestra las de Doory y crear no pregunta.
  - Dónde: `C:/dev/wt-puntas/app/image-editor/ · lib/api-mako/areas/ (imagen) · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:125`
- **La visión de `leerDocumentoIA` no pasa por `sinGemini`** · _Editor de imágenes, chico_
  - Image ya corre sin Gemini (`deSuIA`, `fallback: []`), pero leer una IMAGEN del manual de marca sigue usando el Gemini del negocio si es lo único que tiene. Queda como inconsistencia declarada (D6b).
  - Dónde: `C:/dev/wt-puntas/lib/ai-cheap.ts (sinGemini) ; lib/marca/leer-manual.ts ; docs/relevo/nube-image-marca.md:61-62`
- **«MaKo pide la marca cuando falta» quedó como un link, no como apertura** · _Editor de imágenes, chico_
  - Es un link en el saludo del chat de Image, no una apertura de `lib/aperturas/` (el chat de Image no monta `AperturaMako`). Si se quiere el formato de apertura, es trabajo del chat que lleva las aperturas.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-image-marca.md:58-59 ; lib/aperturas/ ; app/image-editor/mako/chat/`
- **`contenidoNoConfiable` no neutraliza una etiqueta de cierre con espacio** · _Editor de imágenes, chico_
  - `</etiqueta >` (con espacio antes del >) pasa sin neutralizar. Lo usan TODOS los prompts de MaKo, no solo el chat de Image; en este chat el texto es de la misma persona, asi que aca el riesgo es bajo, pero vive en una funcion compartida. HECHO cuando el test cubra la variante con espacio y pase.
  - Dónde: `C:/dev/wt-puntas/lib/prompt-render-pure.ts (contenidoNoConfiable) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:696`
- **Tres trampas chicas del motor y del CSS que quedaron anotadas sin arreglar** · _Editor de imágenes, chico_
  - (a) `ui/Menu` no tiene el prop `overModal` y no se da vuelta hacia arriba: abierto desde la barra inferior tapa su propio boton (la lista del zoom lo esquiva con Popover placement="top"). (b) En un enlace de solo lectura, una pagina angosta pierde el tamano. (c) Los 30 tamanos de Canva menos usados y «Tamano personaliz
  - Dónde: `C:/dev/wt-puntas/app/image-editor/_doory/editor/ui/Menu.tsx · _doory/editor/dialogs/resizeSizes.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:180-182, 541-542, 697`
- **El plano del editor (diseno-editor-imagen.md) describe cosas que ya no existen** · _Editor de imágenes, chico_
  - Todavia habla de `inicio/`, de Proyectos, de Noto Sans y del violeta de Canva (reglas 2 y 9), y nada de eso es asi desde el 29/10 (los --cv-* son los tokens de MaKo, la tab monta app/_crear/PantallaCrear.tsx y Noto Sans entra como hoja de Google desde el navegador). Un plano que miente ya hizo repetir el error del text
  - Dónde: `C:/dev/wt-puntas/docs/diseno-editor-imagen.md (reglas 2 y 9) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:539-542`
- **Los motivos de «No se aplica» estan escritos para el programador** · _Editor de imágenes, chico_
  - Los descartes que ve la persona dicen cosas como «estilo no es algo de...». Tienen que decir, en el idioma de un dueno de negocio, que no se pudo y por que. HECHO cuando ningun motivo visible nombre un campo del JSON.
  - Dónde: `C:/dev/wt-puntas/lib/image-editor/chat/catalogo.ts (validarOperacion, los motivos) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:700`
- **Dos propuestas pendientes del chat duplican las paginas** · _Editor de imágenes, chico_
  - Pedir de nuevo no cierra la propuesta anterior: aceptar las dos duplica las paginas. Hoy pide dos clics y sale el aviso «Cambiaste el diseno», pero el agujero esta. HECHO cuando un pedido nuevo cierre o invalide la propuesta anterior, probado aceptando las dos.
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/chat/acciones.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:695`
- **«Cambiar nombre» de un diseno usa window.prompt** · _Editor de imágenes, chico_
  - Sigue siendo el cuadro del navegador. Tiene que editarse EN EL LUGAR, como el Web Generator. Lo mismo «Nombre de la busqueda» del explorador de carruseles (ExplorarCarruseles.tsx:213). HECHO cuando renombrar sea un campo en la tarjeta y no un prompt del navegador.
  - Dónde: `C:/dev/wt-puntas/app/image-editor/ImageEditorCliente.tsx:115 · C:/dev/wt-puntas/app/image-editor/carruseles/ExplorarCarruseles.tsx:213 · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:540`
- **Borrar `_doory/editor/collab`: la co-edicion esta apagada** · _Editor de imágenes, chico_
  - 18 archivos y 4.396 lineas de co-edicion que no corren (decision 6 de docs/diseno-editor-imagen.md). Borrarlo no es reemplazarlo: es el trozo mas barato de sacar de encima de la licencia. HECHO cuando la carpeta no exista, el typecheck acotado de app/image-editor este limpio y el editor abra y guarde igual.
  - Dónde: `C:/dev/wt-puntas/app/image-editor/_doory/editor/collab/ · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:60`
- **Sobra el parámetro `largo` en la API y en los links viejos** · _Carruseles, chico_
  - La pantalla usa el deslizador de láminas, pero `largo` (2 a 4, 5 a 7, 8+) sigue en la API y en los links viejos. Limpiarlo o dejarlo documentado como compatibilidad. Lo declara la propia autocrítica del rediseño.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-carruseles-rediseno.md:116 ; lib/api-mako/areas/imagen (buscar_carruseles)`
- **El índice docs/hallazgos.md tiene DOS filas de Carruseles apuntando al mismo documento** · _Carruseles, chico_
  - Las líneas 45 y 48 son las dos «Carruseles → hallazgos-carruseles.md» con resúmenes distintos y solapados. Hecho = una sola fila, con el resumen integrado, en el mismo commit que el próximo cambio del documento.
  - Dónde: `docs/hallazgos.md:45 y docs/hallazgos.md:48`
- **El parámetro `largo` sobra: la pantalla usa el deslizador de láminas y él sigue en la API** · _Carruseles, chico_
  - `largo` (cortos 2-4, medios 5-7, 8+) sigue viviendo en el filtro, en la URL y en la API de MaKo aunque la pantalla usa el deslizador de láminas de dos puntas. Hecho = o se saca de la API y del parseo de URL dejando sólo el deslizador, o se documenta que queda por los links viejos. Es limpieza, no urgencia.
  - Dónde: `lib/carruseles/explorar.ts:190, :244-247, :341, :446, :472, :562; lib/carruseles/opciones.ts (`LARGOS_CARRUSEL`); docs/relevo/nube-carruseles-rediseno.md:116`
- **Las medidas finas de la referencia de Top Carousels sin ajustar contra un monitor real** · _Carruseles, chico_
  - Los valores gruesos ya se ajustaron con las capturas (4 columnas en 1440, modal en dos partes, filtros con deslizadores de dos puntas, colores del múltiplo). Faltan los finos: medidas exactas de tarjeta, tipografías y espaciados, comparando la pantalla contra las capturas en un monitor real. Hecho = una pasada lado a l
  - Dónde: `docs/carruseles/referencia-top-carousels/LEEME.md; app/image-editor/carruseles/ExplorarCarruseles.tsx; docs/hallazgos-carruseles.md:209`
- **Los 32 temas de hashtag siguen prendidos sin decidir si conviene apagarlos** · _Carruseles, chico_
  - Traen de todo (los temas de arranque son #marketingdigital, #emprendimiento, #marcapersonal, #ventasonline, #coachdenegocios, #negociosdigitales, #agenciademarketing, #copywriting, #infoproductos, #consultoria, y se sumaron hasta 32). Decidir si se apagan los que traen ruido: se apagan desde el panel de la plataforma (
  - Dónde: `docs/hallazgos-carruseles.md:213; scripts/carruseles-biblioteca.mts:553 (`case 'tema'`)`
- **Correr `reclasificar --de-verdad` con el clasificador nuevo (1.253 → 1.213 sin tipo)** · _Carruseles, chico_
  - El pulido del 6/11 amplió el clasificador a portugués, alemán e inglés y mueve 40 piezas, pero el `--de-verdad` no se corrió después de que eso entrara a main. Correr primero en seco y confirmar que dice «Carruseles sin tipo: 1253 → 1213», y después: `node --env-file=.env.local --conditions=react-server --import tsx sc
  - Dónde: `scripts/carruseles-biblioteca.mts:543 (`case 'reclasificar'`); lib/carruseles/clasificar.ts; docs/relevo/nube-carruseles-rediseno.md:122-129`
- **Sin probar: el guion de un reel (que el actor devuelva `videoUrl` con `directUrls`)** · _Competitors Spy, chico_
  - El guion de un reel se pide solo al abrir el detalle: Apify trae su video fresco (UNA publicación con la clave de Spy, tope de 40 por día) y lo escucha la IA del negocio. Falta comprobar que el actor devuelve `videoUrl` con `directUrls` de UN reel y que la IA de un negocio escucha ese mp4.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-spy.md:63 ; lib/spy-transcripcion-servidor.ts`
- **Sin probar: el acortador `linktw.in/pywydg` de verdad en «Sus páginas»** · _Competitors Spy, chico_
  - Correr los dos curl que dejó la nube para saber si redirige por HTTP, por JavaScript/refresh, o si es una página de «continuar» con botón (en ese caso queda «Abrir», sin marco). Desde la nube no se llega.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-spy.md:121-131 (los comandos, textuales)`
- **Medir en producción la velocidad de la ficha con Den Borg** · _Competitors Spy, chico_
  - En la vista de prueba bajó de 3,9 s a 3,2 s hasta el gráfico (2.369 → 1.664 elementos), pero la vista de prueba NO tiene el CDN de Meta. Repetir la medición en producción con Den Borg. Método y números en docs/hallazgos-competitors-spy.md.
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos-competitors-spy.md ; docs/relevo/nube-spy.md:77`
- **Medir en la base el YouTube de Leila (ws 9), que la nube dejo pedido** · _Competitors Spy, chico_
  - La nube dejo la consulta escrita para que la corra el Cerebro contra produccion. Hecho = la medicion corrida y anotada en el relevo.
  - Dónde: `docs/relevo/nube-spy.md:99 · (consultas en el mismo archivo, ~:191-205)`
- **Los formatos nuevos del catalogo todavia no entran en el analisis de piezas** · _Competitors Spy, chico_
  - El tipo de funnel con citas y la oferta arriba ya estan; el relevo deja explicito que los formatos nuevos del catalogo en el analisis de piezas quedan pendientes.
  - Dónde: `docs/relevo/nube-spy.md:79`
- **Los competidores duplicados que ya estan en la base no se arreglan solos** · _Competitors Spy, chico_
  - El arreglo del alta impide los NUEVOS duplicados, no limpia los viejos: «sofiacontreras» vs «Sofia Contreras», «hormozi» vs «@AlexHormozi» vs «acquisition.com». Hay que borrarlos a mano desde el tacho de la tarjeta, y solo puede el administrador del negocio. ATENCION: `acquisition.com` no se va a juntar con Hormozi nun
  - Dónde: `C:/dev/wt-puntas/app/competitor-spy/SpyApp.tsx:760 (el tacho de la tarjeta), :1989 (la confirmacion); C:/dev/wt-puntas/app/competitor-spy/actions.ts:43-54 (soloAdmin), :216 (quitarCompetidorAction)`
- **El chip de pais de la barra: la columna existe y nadie la escribe** · _Competitors Spy, chico_
  - `spy_competidores.pais` se LEE (`adLibraryCubreComercial(pais)` para saber si la Ad Library de ese pais cubre lo comercial, y `busquedaDeSusAnuncios` lo recibe) pero grep de escrituras (`pais:`) no encuentra NINGUNA en todo Spy: siempre llega null. Hecho = el chip en la barra que lo setea, o deducirlo del perfil, y que
  - Dónde: `C:/dev/wt-puntas/lib/spy.ts:93,164 (la columna en el select); C:/dev/wt-puntas/lib/spy-reglas.ts:353 (adLibraryCubreComercial); C:/dev/wt-puntas/lib/spy-funnel.ts:399,404; la barra en C:/dev/wt-puntas/app/competitor-spy/`
- **Nadie vigila la cola de caricaturas: si se atasca, no se ve en ninguna pantalla** · _Competitors Spy, chico_
  - `masVieja` (desde cuando espera la pendiente mas vieja) solo sale por el JSON del script; grep -rn masVieja no encuentra ninguna pantalla ni ruta que lo lea. Y no hay cron: la cola es 100% a mano. Consecuencia: una cola parada (Canva desconectado, nadie corre el script) es invisible. Hecho = el super admin ve la cola y
  - Dónde: `C:/dev/wt-puntas/lib/spy-caricatura-cola.ts:84 (type Cola), C:/dev/wt-puntas/lib/spy-caricatura-reglas.ts:209-254`
- **Nadie miró si la caché compartida ahorra algo** · _Competitors Spy, chico_
  - Leer `spy_lecturas_canal.ahorros`. Si queda en cero, nadie mira a los mismos competidores y la tabla no se ganó el lugar: es la única medida de si el ítem 13 sirvió. Hecho = el número escrito en el relevo, con fecha.
  - Dónde: `lib/spy-compartido-db.ts (`anotarAhorro`) · docs/pendientes-martin.md:1005-1007`
- **Medir el competidor 13 del ws 11, que quedó en 12 piezas** · _Competitors Spy, chico_
  - Lo pidió la sesión de la nube expresamente al Cerebro, porque desde la nube no se ve la base. Hecho = saber por qué quedó corto y si la traída larga lo completa.
  - Dónde: `docs/relevo/nube-spy.md:191 → «Qué medir en la base de producción»`
- **Las 343 operaciones aprobadas de la API de MaKo viven en un worktree sin pushear y se pierden si alguien lo limpia** · _Infraestructura, chico_
  - `docs/api-acciones-relevo.json` NO esta en main (ls falla). Esta solo en `C:/dev/mako-api`, rama `wip/api-acciones-0910`, commit bf5d86f73 del 9/10, que `git merge-base --is-ancestor` dice que NO es ancestro de HEAD. Ahi estan las 343 operaciones aprobadas de la corrida de 20 areas (83 llegaron a tener codigo, 260 qued
  - Dónde: `C:/dev/mako-api (rama wip/api-acciones-0910, bf5d86f73) · C:/dev/mako-api2 (wip/api-acciones-1410, b85971b9b) · C:/dev/wt-puntas/docs/relevo/api-mako.md:160-200`
- **Tres scripts dejan perfiles de Chrome en Temp y nada poda tsx-marti (1 GB por día)** · _Infraestructura, chico_
  - Un borrado en finally para los mkdtempSync de mako-cdp-, y decidir una tarea semanal que vacíe tsx-marti. Hecho = correr los scripts no deja carpetas y el disco no crece solo.
  - Dónde: `C:/dev/wt-puntas/scripts/mirar-consola.mjs:25 · scripts/mirar-pantalla.mjs:55 · scripts/onboarding-vg-recorrer.mjs:25 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:9288`
- **Aplicar la 0372: sin ella el grupo del Ops Center da «No pude abrir el grupo»** · _Infraestructura, chico_
  - Aplicar la 0372. Hecho = el grupo del negocio abre en el Ops Center sin ese cartel.
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/ (la 0372) · app/_chat/grupo/HiloDelGrupo.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:120`
- **Aplicar la 0394: «Ignorar» una decisión de la Ticketera no hace nada** · _Infraestructura, chico_
  - Aplicar la 0394 (columna ignorada_at). Hoy el botón contesta «Todavía no se puede». Hecho = ignorar una decisión de la Ticketera la saca del bloque del Ops Center.
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/ (la 0394) · lib/admin-decisiones.ts (ignorarDecision) · app/admin/operaciones/PreguntasDelChat.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-operaciones.md:3847`
- **Aplicar la migración 0407 (plantillas propias)** · _Infraestructura, chico_
  - Aplicar la 0407 y confirmar su número antes (hay números repetidos en el directorio). Hecho = «Guardar como plantilla» persiste una plantilla propia.
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/ (la 0407) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:127`
- **Aplicar la migración 0406 (email del Calendario enlazado a un broadcast)** · _Infraestructura, chico_
  - Aplicar la 0406 antes o junto con el deploy. Hecho = enlazar un Email del Calendario a un broadcast de Email Marketing guarda el enlace y moverlo reprograma el envío.
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/ (la 0406) · lib/calendario-email.ts · app/calendario/EnlazarEmail.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-calendario.md:40`
- **Los modelos de Gemini escritos a mano siguen repartidos en varios archivos** · _Infraestructura, chico_
  - Juntarlos en una constante. Son todos alias `-latest` (no envejecen como un id con versión, pero viven en varios lugares): lib/ai-cheap.ts (MODELOS_RESPALDO y cuatro usos más), lib/model-catalogo.ts:100, lib/offer-ia.ts:75, lib/transcribe-plataforma.ts:113, y tres scripts. Es trabajo de la capa de IA (Infra), no de Spy
  - Dónde: `C:/dev/wt-puntas/lib/ai-cheap.ts ; lib/model-catalogo.ts:100 ; lib/offer-ia.ts:75 ; lib/transcribe-plataforma.ts:113 ; lista en docs/relevo/nube-spy.md:246-259`
- **Tres cosas de la metodología de subida quedaron sin medir** · _Infraestructura, chico_
  - (1) Si `repository_dispatch` (vercel.deployment.*) llega a `despues-del-deploy.yml` y si `github.silent` lo corta — el vigía da rojo si en 48 h hubo commits en main y no llegó ninguno. (2) El firewall de Vercel con el runner de GitHub: la prueba de humo puede dar rojo por un 403 y no por una caída. (3) El filtro en la 
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-metodologia.md:89-99 ; .github/workflows/despues-del-deploy.yml`
- **La migración 0396 sigue sin aplicar y va DESPUÉS del deploy** · _Infraestructura, chico_
  - Aplicar `0396_wa_mensajes_automatico.sql` (suma `automatico` a wa_mensajes) y después comprobar que el primer WhatsApp automático queda con `automatico = true`. Va después del deploy a propósito: antes, la versión vieja dejaría automáticos como si los hubiera escrito una persona, y eso rompe la métrica de primer contac
  - Dónde: `C:/dev/wt-puntas/supabase/migrations/0396_wa_mensajes_automatico.sql ; lib/primer-contacto.ts ; docs/relevo/cerebro.md:21 y :80`
- **Dos textos de avisos de la plataforma sin corregir (P8, P9)** · _Infraestructura, chico_
  - Mirar si existe la plantilla «Tu contraseña cambio» en `mako.plantillas.store` del ws 9 y crearla si falta; y corregir la fila viva #261, donde `gracia` y `liquidacion` dicen «Tu cuenta» sin «publicitaria».
  - Dónde: `docs/relevo/pendientes-barrido.md:152-153`
- **La tarjeta de Apify le dice al cliente «un tope de 40 lecturas por dia» y el tope real de Spy es 150** · _Infraestructura, chico_
  - La nota del campo `APIFY_INSTAGRAM_TOKEN` quedo con el numero viejo: el tope de Spy con la clave del negocio subio de 40 a 150 el 4/11 (`TOPE_LECTURAS_SPY_POR_DIA`), y 40 es otro cupo (`APIFY_TOPE_POR_DIA`, el del buscador del alta del CRM). Es texto que el cliente lee y que subestima lo que puede gastar. Hecho = la no
  - Dónde: `C:/dev/wt-puntas/lib/metodo-catalogo.ts:854 vs C:/dev/wt-puntas/lib/instagram-perfil.ts:236 (APIFY_TOPE_POR_DIA = 40) y :246 (TOPE_LECTURAS_SPY_POR_DIA = 150), :253 (TOPE_BUSQUEDAS_SPY_POR_DIA = 60)`
- **Automations: no hay «solo estos dias» del goteo aparte del horario de la automatizacion** · _Varios, chico_
  - Del §Sin hacer de automations.md: los dias del goteo son los del horario propio de la automatizacion, y no existe una eleccion de dias aparte. Quien quiere gotear solo de lunes a jueves tiene que achicar el horario entero. Hecho = la configuracion de una automatizacion acepta dias del goteo distintos de su horario.
  - Dónde: `C:/dev/wt-puntas/lib/config-automatizacion.ts · C:/dev/wt-puntas/docs/relevo/automations.md:451-475`
- **Automations: al CREAR, el modelo inventa el texto de una tarjeta de audio que la persona graba ella** · _Varios, chico_
  - Otro punto del §Sin hacer de automations.md que nadie trajo: en la rama `crear` de `/api/chat-agent/secuencias/ia`, el modelo escribe el texto de una tarjeta de audio que la persona tiene que grabar con su voz, y crear no ofrece «Discutir / Editar» (editar si lo tiene). Hecho = al crear, una tarjeta de audio sale vacia
  - Dónde: `C:/dev/wt-puntas/app/api/chat-agent/secuencias/ia/route.ts (rama `crear`) · C:/dev/wt-puntas/docs/relevo/automations.md:451-475`
- **Automations: Publicar y «Probar» exigen una linea conectada aun para el simulador** · _Varios, chico_
  - Del §Sin hacer de `docs/relevo/automations.md`, sin leer por ninguna familia: el boton «Probar» es un simulador y no manda nada, pero igual pide una linea de WhatsApp conectada, asi que un negocio que todavia no conecto no puede ni simular su automatizacion. Hecho = «Probar» corre sin linea conectada y solo Publicar la
  - Dónde: `C:/dev/wt-puntas/docs/relevo/automations.md:451-470 · C:/dev/wt-puntas/app/automations/ (`ConectarMedio`, `PanelProbar.tsx`)`
- **Objectives: getObjetivoProgreso y tres settings viejos siguen alimentando los reportes** · _Varios, chico_
  - Mientras existan hay dos fuentes para «cuál es la meta»: la vieja manda en los reportes por WhatsApp y la nueva en la pantalla. Unificarlo es mover esos dos call-sites a objetivosContextoTexto(). Hecho = una sola fuente de la meta.
  - Dónde: `C:/dev/wt-puntas/lib/reportes.ts:66 y :174 · lib/objectives-fuentes.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-objectives.md:928`
- **UI: el MenuContextual quedó fuera del barrel y del catálogo /admin/ui** · _Varios, chico_
  - Mudar los :hover/:focus de ESTILOS a app/_ui/ui.css (regla de crecimiento 3 del LEEME, una línea); sumar la pieza al barrel app/_ui/index.ts y al catálogo /admin/ui (regla 5); sumar flechas izquierda/derecha a app/_ui/iconos-menu.tsx (hoy usa las de app/crm/iconos); y decidir si un clic izquierdo afuera cierra sin que 
  - Dónde: `C:/dev/wt-puntas/app/_ui/MenuContextual.tsx (ESTILOS) · app/_ui/index.ts · app/_ui/ui.css · app/_ui/iconos-menu.tsx · app/admin/ui/CatalogoUI.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-ui.md:4376`
- **Copywriter: grafoParaChat ya está en main y contexto.ts sigue con el GRAFO viejo** · _Varios, chico_
  - Cambiar `const GRAFO` en lib/copywriter/contexto.ts para que use grafoParaChat (lib/cerebro-para-chat.ts, c272b97dd). Hecho = el Copywriter arma su contexto con el grafo nuevo.
  - Dónde: `C:/dev/wt-puntas/lib/copywriter/contexto.ts (const GRAFO) · lib/cerebro-para-chat.ts (grafoParaChat) · C:/dev/wt-puntas/docs/plantillas-reales/README.md (tanda 0) · pendiente en C:/dev/wt-puntas/docs/hallazgos-copywriter`
- **IA: dos STT hardcodeados a whisper-1 no pasan por el choke point** · _Varios, chico_
  - transcribeMediaBuffer (clases del portal) y transcribeAd (video de cada anuncio de Meta) arman su propio form con model: 'whisper-1' y no llaman a transcribirAudio: quedan clavados en OpenAI. El de ads es el de más volumen (cron y backfill sobre cientos de anuncios). Al migrarlos hay que conservar el tope de 25 MB y re
  - Dónde: `C:/dev/wt-puntas/lib/transcribe.ts:171 y :257 · lib/ai-cheap.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ia.md:876`
- **El encuadre del grafo del NEGOCIO puede cortar un título pegado al borde** · _Varios, chico_
  - En el grafo de un curso se arregló (`ajustar` en Grafo.tsx deja la mitad del título más largo a los costados); en el del negocio no se tocó. Es el mismo arreglo, aplicado al otro modo.
  - Dónde: `C:/dev/wt-puntas/app/second-brain/Grafo.tsx (ajustar) ; docs/relevo/nube-gurus.md:68-71`
- **El múltiplo de rendimiento nunca se miró en pantalla** · _Varios, chico_
  - No se levantó la app (la nube no tiene base). El chip de la tarjeta de Spy va arriba a la derecha y baja una fila si está «Analizando…» (`.spy-pcard__veces`). Verlo en /competitor-spy y /image-editor. Y medir cuántas piezas reales quedan sin número: con 13 publicaciones por cuenta alcanza para 7 y no para 20, así que h
  - Dónde: `C:/dev/wt-puntas/lib/multiplo-rendimiento.ts ; app/competitor-spy/SpyApp.tsx (.spy-pcard__veces) ; docs/relevo/nube-multiplo.md:33-42`
- **AGENTS.md quedó viejo: dice que Creem modera lo que genera imagen o video** · _Varios, chico_
  - Creem cerró la tienda y `PROVEEDOR_DE_MODERACION` vale `null`: hoy no modera nadie. La regla operativa sigue valiendo (lo que genera pasa por `encolar` con el prompt final en `pedido.prompt`), pero la premisa no. La propuesta de texto exacta ya está escrita en el relevo, lista para pegar. No se tocó porque es la config
  - Dónde: `C:/dev/wt-puntas/AGENTS.md (la sección de `encolar`) ; lib/creem-moderacion-reglas.ts ; el texto propuesto en docs/relevo/nube-creem-fuera.md:49-59`
- **Los textos de los cuatro paneles de aprobaciones son los esperados, no medidos** · _Varios, chico_
  - La tabla de traducción de `lib/vigia-aprobaciones.ts` (`panel.traduccion`) se escribió a ciegas: la nube no ve los paneles. La primera vez que la tarea lea cada uno conviene `--guardar <id> auto "<texto del panel>"`: lo que no esté en la tabla vuelve como «no pude» con el texto literal, y se corrige la tabla. El orden 
  - Dónde: `C:/dev/wt-puntas/lib/vigia-aprobaciones.ts (ITEMS[].panel) ; scripts/vigia-paneles.mts ; docs/relevo/nube-approvals.md:58-67`
- **MaKo toma la iniciativa: faltan el primer ingreso y las aperturas por tab** · _grande_ · 🟡 **EL CONTEO ESTABA VIEJO (revisado el 7/11/2026 — `5d2d98f7a`)** · _Varios_
  - Dónde: `lib/aperturas/ (11 archivos) · docs/mako-iniciativa/plan.md:334,387 (T15/T16) · app/ai-avatar/Estudio.tsx · lib/ai-avatar/requisitos.ts → resumenDeRequisitos`
- **El Second Brain no toma «absolutamente todos» los datos del cliente** · _grande_ · 🟡 **MEDIDO Y ACOTADO el 7/11/2026 — `87a02320d`** · _Varios_
  - Dónde: `lib/cerebro-grafo.ts:326 · lib/cerebro-nunca-lee.ts · tests/cerebro-no-lee-secretos.test.ts · docs/hallazgos-second-brain.md · lib/cerebro-para-chat.ts:146`
- **Generar anuncios «en cantidad»: 100 en menos de una hora** · _grande_ · ⬜ **CONFIRMADO SIN EMPEZAR, pero ya tiene cimiento (7/11/2026)** · _Varios_
  - Dónde: `docs/como-venden-otros.md:146 · lib/mako-tokens-reglas.ts · lib/apimart.ts`
- **VSL Generator completo (y VSL Analyst)** · _Varios, grande_
  - 5 entradas en 'cola' en la bitacora y `app/_components/nav.ts:474` con `comingSoon`. Prioridad BAJA segun la medicion.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:165-167 · app/admin/dev/vsl-generator/bitacora.ts:28-32 · app/_components/nav.ts:474`
- **Historial de decisiones de Martin en «progreso», con aviso si cambia de opinion** · _Varios, mediano_
  - «Se manda como un prompt que el usuario cambio de opinion». Grep sin resultados en `app/admin/operaciones`, `lib/operaciones*` ni `lib/centro*`.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:159-160`
- **Focus Tracker (Toggl por BYOK) y Productivity Analyst** · _Varios, grande_
  - `git grep` de «Focus Tracker» y «toggl» sin resultados en app, lib ni docs. Puede estar como tarea en la base del /plan.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:162-163`
- **Ops Center: ocho restos sin dueno** · _mediano_ · ⚠️ **NINGUNO DICE SU MOTIVO — no se toca a ciegas (revisado el 7/11/2026 — `60e608d44`)** · _Varios_
  - Dónde: `docs/relevo/pendientes-barrido.md:121-124 · app/api/mako-doer/route.ts · app/mako-doer/page.tsx · lib/operaciones-reglas.ts:119`
- **Classroom y cursos armados desde el Segundo Cerebro** · _Varios, grande_
  - Que MaKo diga, segun la promesa de valor, que capsulas o modulos necesita el curso y los ordene segun la oferta. Marcado FALTA en la auditoria.
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:153 (3.17) · docs/relevo/pendientes-pc/pendientes-30-10.md:125`
- **Arrastrar un bloque en el Copywriter deja su contenido atras** · _Varios, mediano_
  - Dónde: `app/copywriter/editor/CuerpoNotion.tsx:239-241 · lib/copywriter/seccion-arrastre.ts · tests/copywriter-arrastrar-seccion.test.ts`
- **QA con Claude simulando usuarios dentro de MaKo** · _Varios, mediano_
  - Martin iba a pedirle a su Claude que simule muchas experiencias de usuario para detectar errores. La auditoria dice «sin script».
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:153 (3.8) · docs/relevo/pendientes-pc/pendientes-30-10.md:107,159`
- **Lo que falta repartir de las promesas a la agencia de Thiago** · _Varios, grande_
  - Calendario con anuncio y email enlazados (no recordatorio) y reuniones del equipo por persona; «Subir creativos» del Media Buyer aceptando un video ya generado; en Ads, variar el CTA, hooks de video con el avatar y pausar el original cuando una variacion gana; en el CRM, reservas de Google Calendar como etapa. Lo demas
  - Dónde: `docs/relevo/pendientes-pc/por-repartir.md:176-186 · docs/promesas/2910-llamada-thiago.md · docs/relevo/cerebro.md:27`
- **Compromisos de Mauricio: falta responderle la fecha y medir el criterio** · _Varios, mediano_
  - La cadena de extraccion esta construida. Falta responderle la fecha y medirla contra dos reuniones con notas manuales (hay una).
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:197-198 · memory/criterio-extraccion-mauricio.md`
- **La iniciativa de MaKo falta en 12 tabs, con la escalera del Ops Center como la primera** · _Varios, grande_
  - La tabla completa con qué falta en cada tab está en el relevo. Lo más grande: la escalera del Ops Center (T3) necesita su lector de servidor y «un paso por día» (hoy `lib/aperturas/ops.ts` sólo tiene el paso 3); Dashboard necesita la hoja de General y sacar `BotonMako` (lo miran ocho tests); Offer, Copywriter (mudarlo 
  - Dónde: `C:/dev/wt-puntas/lib/aperturas/ ; docs/mako-iniciativa/plan.md §5 y guia.md §6 ; la tabla en docs/relevo/nube-iniciativa.md:30-51`
- **Moderar lo publicado y sembrar las plantillas «de MaKo» desde el super admin** · _Varios, mediano_
  - Falta una lista de `creaciones` con estado `publicada` de todos los negocios con «Retirar». El server ya lo deja (`retirarCreacion`): se lee con `listarCreaciones` o con una lectura nueva que traiga el negocio de origen SÓLO para el super admin. Y sembrar las plantillas de MaKo es publicarlas desde el workspace de la p
  - Dónde: `C:/dev/wt-puntas/app/admin/ ; lib/creaciones (retirarCreacion, listarCreaciones) ; docs/relevo/nube-plantillas.md:50-60`
- **Lo que no se pudo probar de la cuenta de revisión de las tiendas** · _Varios, mediano_
  - El script contra la base real (se corrió contra un PostgREST de mentira): faltan el id 900001 en producción, `createLead` con las columnas reales y el funnel por defecto. La entrada de verdad en un teléfono: la app de Play, TestFlight, el aviso a equipo@ y la pantalla de error de una acción cortada. El proxy en Vercel 
  - Dónde: `C:/dev/wt-puntas/lib/cuenta-revision-reglas.ts ; lib/revision-guarda.ts ; docs/relevo/nube-tiendas.md:97-102`
- **El agente del Marketing CoPilot nunca corrió con una IA real** · _Varios, mediano_
  - Los tests prueban que al system llega lo correcto (reglas, perfil, veredicto, conocimiento), no lo que contesta. Falta correr las 14 conversaciones de `docs/marketing-copilot/conversaciones.md` en el ws 3 (nunca el ws 1) y los 12 recorridos que dejó el relevo. Aparte: «Esta semana» no tiene checks (son atajos sin estad
  - Dónde: `C:/dev/wt-puntas/docs/marketing-copilot/conversaciones.md ; lib/media-buyer/copiloto-contexto.ts ; app/api/mako/chat/route.ts ; docs/relevo/nube-marketing-copilot.md:46-57`
- **Grabar llamadas: nada se probó de punta a punta ni en un teléfono real** · _Varios, mediano_
  - La transcripción y el análisis con una IA de verdad están probados con su lógica pura, no de punta a punta. Sin probar: la subida contra Vercel y Supabase de verdad; un teléfono real, Safari, Firefox ni la app de iPhone (su explicación del micrófono ya nombra las llamadas en Info.plist, y eso entra con el próximo build
  - Dónde: `C:/dev/wt-puntas/app/_components/grabar/grabadora.ts ; tests/grabar-llamada.test.ts ; docs/relevo/nube-grabar.md:66-77`
- **Autopilot rotula «pausar el original» con los textos del ganador: la tarjeta dice una cosa y hace otra** · _Varios, mediano_
  - Darle su rótulo propio a la decisión tipo 'pausar'/tactica 'ganador' (hoy dice «Anuncio ganador» y «probar textos nuevos…»), y pintar v.cta (la variación del botón viaja en gancho). Lo rehace el chat Marketing CoPilot porque sumar una táctica rompe el Record<Tactica,…> de mb-modelo.ts. Hecho = la tarjeta dice que pausa
  - Dónde: `C:/dev/wt-puntas/app/ads-manager/Autopilot.tsx · app/ads-manager/mb-modelo.ts · lib/media-buyer/variacion-boton.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-ads.md:31`
- **El brief entra al grafo por cuatro listas hardcodeadas mientras getSchema() lee el esquema vivo** · _Varios, mediano_
  - CAMPOS_NORTE, CAMPOS_OFERTA, CAMPOS_CLIENTE y CAMPOS_MARCA son fijas: se le agrega un campo al brief de un cliente, el cliente lo contesta, el dato alimenta los prompts y no existe en el mapa que dice «todo lo que MaKo sabe de tu negocio». Sin error y sin aviso. Hoy es latente porque ningún workspace tiene esquema prop
  - Dónde: `C:/dev/wt-puntas/lib/cerebro-grafo.ts (las cuatro constantes) · app/onboarding/ (addField) · pendiente en C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1423`
- **No hay ningún test que mire la topología del grafo, y no se puede escribir hoy** · _Varios, mediano_
  - lib/cerebro-grafo.ts lleva server-only, así que ningún test lo puede importar: todo lo medido se puede romper en un commit posterior sin una señal roja. La salida ya está probada: mover la parte pura a un módulo sin la marca. Hecho = un test recorre la topología del grafo.
  - Dónde: `C:/dev/wt-puntas/lib/cerebro-grafo.ts (server-only) · pendiente en C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1264`
- **Ninguna hoja de las 20 plantillas del Dashboard se vio dibujada con datos reales** · _Varios, mediano_
  - Se verificó la composición (qué pieza va dónde, con un script sobre componentesDe), los tests y los tipos; falta mirarlas. Y Closing sigue sin probar contra la base de un cliente: hay que crearlo en el ws3 y el ws1. Hecho = las hojas abiertas con datos de un workspace y lo visto anotado.
  - Dónde: `C:/dev/wt-puntas/app/dashboard/disenos/ · lib/graficos-plantillas.ts (PLANTILLAS_HOJA) · punta dash-closing-producto · pendiente en C:/dev/wt-puntas/docs/hallazgos-templates-dashboard.md:748`
- **Seis mediciones que MaKo no tiene, y por eso las hojas no las prometen** · _Varios, grande_
  - Retención por SEGUNDO del video (Hooks y VSL van por cuartiles), confianza estadística de un A/B (Anuncio ganador usa la confianza por muestra), cohortes M0–M5 (Curso y CS), motivos de baja contados (CS), el tiempo de foco por tarea (Focus no tiene el temporizador) y las horas que ahorra una automatización. Y «¿Cada cl
  - Dónde: `C:/dev/wt-puntas/lib/graficos-datos.ts · lib/vsl-retencion.ts · app/customer-success/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-templates-dashboard.md:748`
- **Los diseños con animaciones del Web Generator quedaron para la próxima tanda** · _Varios, grande_
  - La segunda mitad del punto 8, con las decisiones ya tomadas (ver «Etapas propuestas… y lo que falta decidir»). Y «sacá el video de la web» ya es editar, pero acomodar_bloque_landing no entra en el presupuesto del turno. Hecho = los diseños con animaciones publicados y el pedido por chat llegando con la herramienta corr
  - Dónde: `C:/dev/wt-puntas/app/web-generator/editor/ · lib/mako-intencion.ts · lib/api-mako/areas/landing-editor.def.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-editor-landing.md:1414 y :2177`
- **Customer Success: cinco pendientes, incluido un compare-and-set que manda dos mensajes** · _Varios, grande_
  - moverClienteDeEtapa sin compare-and-set (si el cliente manda las dos últimas tareas en el mismo segundo desde dos pestañas, sale dos veces el mensaje de la etapa nueva y dos líneas de historial); las actions de app/customer-success/actions.ts preguntan el workspace pero no la CAPA (el requireCapa vive en la página y un
  - Dónde: `C:/dev/wt-puntas/lib/cs-mover-etapa.ts (moverClienteDeEtapa) · app/customer-success/actions.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-customer-success.md:3960 y :5665`
- **La API de MaKo: nueve pendientes del núcleo, con su archivo** · _Varios, grande_
  - Idempotencia de las propuestas genéricas (una ref que bloquee sólo contra una pendiente); distinguir «vacío» de «ausente» en la pantalla genérica; reclamada_at y barrido de pendientes confirmada colgadas (pide columna nueva); actor fuera de resultado; historial_whatsapp y reuniones_lead por /api/agente/consultar (rompe
  - Dónde: `C:/dev/wt-puntas/lib/api-mako/ejecutar.ts · lib/propuestas.ts · lib/mako-pendientes.ts · lib/api-mako/acciones.ts · lib/agente-consultas.ts · lib/mako-tools.ts · app/mako/ctx-bandeja.ts · lib/mako-doer-in.ts · tabla en C`
- **Seguridad: el barrido de server actions sin corte de sesión sólo se hizo en el CRM** · _Varios, grande_
  - 85 de las 145 server actions de app/crm no miraban la sesión y ahora arrancan con exigirSesion(). Falta el mismo barrido en los 'use server' de las otras tabs. Ojo: leer getUsuarioActual() NO es cortar, así que el guard tiene que aceptar sólo las formas que cortan, en positivo. Y falta el barrido de entrada por URL al 
  - Dónde: `C:/dev/wt-puntas/lib/sesion-accion.ts (exigirSesion) · tests/crm-acciones-sesion.test.ts (el molde) · los 'use server' del resto de app/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-seguridad.md:2402 y :1329`
- **Seguridad: cinco tablas con workspace_id quedan fuera del proxy de inquilino** · _Varios, mediano_
  - El inverso del contrato de TENANT_TABLES encontró contra producción avisos_programados, flujo_corridas, insistencias, replay_sesiones y replay_lotes con workspace_id y fuera de TABLAS_DE_INQUILINO: vaciar el Cliente de Prueba las dejaba. Hecho = las cinco dentro del proxy o declaradas en FUERA_DEL_PROXY con su porqué.
  - Dónde: `C:/dev/wt-puntas/lib/tablas-de-inquilino.ts (TABLAS_DE_INQUILINO, FUERA_DEL_PROXY) · lib/workspace.ts (TENANT_TABLES) · tests/tenant-tables-contract.test.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-seguridad.md:240`
- **Integraciones: nada le dice al negocio que sus leads de Meta no llegan por Zernio** · _Varios, grande_
  - leadsEnElWebhook(ws) mide si el webhook registrado escucha el evento y ninguna pantalla lo usa (Ads Manager o el modal de Zernio). Y no hay red de seguridad si un evento se pierde: Zernio reintenta 7 veces y descarta, y el poll de Meta usa el token de página propio, que un negocio sólo-Zernio no tiene (existe GET /v1/a
  - Dónde: `C:/dev/wt-puntas/lib/zernio.ts (leadsEnElWebhook, EVENTO_LEADS) · lib/zernio-lead.ts (cargarLeadDeZernio) · app/api/webhooks/zernio/route.ts · lib/leads.ts (upsertLeadFromMeta) · pendiente en C:/dev/wt-puntas/docs/hallaz`
- **Copywriter: cinco bajas de la verificación de la mudanza, sin arreglar** · _Varios, mediano_
  - crear() borra el documento si el índice «falla» aunque haya llegado, y abre «No existe» (B7); el link compartido de una página cuya madre está en la Papelera sigue editando (falta escondida(paginas, id)) (B6); después de mudar, /copywriter abre una página mudada y no la última del usuario, porque nacen con actualizado 
  - Dónde: `C:/dev/wt-puntas/lib/copywriter/server.ts (crear) · app/api/compartido/guion/route.ts · informe en C:/dev/revisiones/2910-verificacion-mudanza-copywriter.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-copywriter.md:37`
- **UI: el menú contextual no está en Chats, Web Generator, Offer ni en dos listas** · _Varios, mediano_
  - Que el «⋯» de Chats y del Web Generator abran ESE menú; que el clic derecho en Integraciones haga lo mismo que el clic (abrirTarjeta: una red social abre Zernio) y no abra la tarjeta suelta; el selector de arriba de Offer es el Dropdown de la casa, así que un clic derecho en sus renglones cambia el desplegable de toda 
  - Dónde: `C:/dev/wt-puntas/app/chats/ChatsApp.tsx · app/web-generator/ · app/integraciones/ · app/web-generator/editor/paneles/PanelLandings.tsx · app/offer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-ui.md:70`
- **Pruebas A/B: falta la dimensión «rama» en los gráficos y la primera prueba real** · _Varios, mediano_
  - La dimensión «rama» en los gráficos del Dashboard (Métricas la muestra en una franja fija), verla en pantalla, y la primera prueba real en el Cliente de Prueba (la migración ya está aplicada). Además el plan de una prueba de «Agendó» usa la tasa de «Respondió», así que el n del plan queda corto. Y Landings tiene las fi
  - Dónde: `C:/dev/wt-puntas/lib/pruebas/automatizacion.ts (historiaDe) · lib/pruebas/ (MEDIDORES) · app/dashboard/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-pruebas.md:98`
- **El plugin del agente: nada reporta desde una instalación real** · _Varios, mediano_
  - Todo lo verificado es contra un servidor de mentira y con los tests; falta un cliente con el hook puesto de verdad. Los nombres de los eventos (UserPromptSubmit, SessionEnd) y los campos del stdin son la parte a confirmar. Y el reporte de sesiones sigue siendo sólo de Claude Code (el hook es un Stop de .claude/settings
  - Dónde: `C:/dev/wt-puntas/lib/agente-plugin.ts (AGENTE_HOOK_SETTINGS) · lib/agente-consentimiento-texto.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-agente.md:129 y C:/dev/wt-puntas/docs/hallazgos-second-brain.md:1654`
- **Plantillas propias: faltan los enchufes de Video, Offer, AI Avatar, Web Generator y Dashboard** · _Varios, grande_
  - Más «Tus plantillas» en el teléfono (hoy sólo en la computadora), el ítem en la barra de /creaciones, y en el super admin una vista para moderar lo publicado (retirar ya existe en el server con puedeRetirar) y sembrar las «de MaKo». El detalle está en docs/relevo/nube-plantillas.md. Hecho = las cinco tabs guardan y usa
  - Dónde: `C:/dev/wt-puntas/app/_crear/ · app/admin/ · C:/dev/wt-puntas/docs/relevo/nube-plantillas.md · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:119`
- **`dashboard` tambien sigue sin enchufe en creaciones, no solo `formato_video`** · _Varios, mediano_
  - La lista dice que «de los dos tipos sin enchufe queda solo `formato_video`». No: `POR_ENCHUFAR` tiene DOS entradas vivas, `dashboard: 'Graphics'` y `formato_video: 'Video Editor'`. O sea que publicar una hoja del Dashboard como creacion sigue sin enchufe, y su dueno es el chat de Graphics. Hecho = `dashboard` sale de P
  - Dónde: `C:/dev/wt-puntas/lib/creaciones-reglas.ts:45 (ENCHUFADOS) y :47-52 (POR_ENCHUFAR) · C:/dev/wt-puntas/lib/creaciones-enchufes.ts:6-14 (los pasos del enchufe)`
- **La réplica editable quedó sin ver con la base** · _Infraestructura, mediano_
  - Abrir las copias #68 y #69 en el editor y ver si los dos ❌ se fueron; mirar las capturas 1440/390; correr el chat de punta a punta en #70–#72; y mandar las copias #68–#72 a la papelera al cerrar. Los 24 commits ya están en main (33d6a73f1).
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos-editor-landing.md («La réplica editable») ; docs/relevo/nube-ramas.md:31-32`
- **Las primitivas de fecha siguen ancladas a Tijuana en ~60 call-sites** · _Infraestructura, grande_
  - hoyEnTijuana, ayerEnTijuana, lunesActualEnTijuana y primerDiaDelMesEnTijuana deciden bordes de día que definen cohortes y disparos (no es display): pasarlas a la zona del workspace, escritura y lectura juntas. Hecho = un workspace en otra zona cuenta sus días.
  - Dónde: `C:/dev/wt-puntas/lib/date-utils.ts · anotado en lib/timezone.ts:47 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:4396`
- **No hay auditoría de borrados, y dos buckets no se limpian por prefijo** · _Infraestructura, mediano_
  - 1) Registro de quién borró un cliente y cuándo (las filas de agencia_clientes y agencia_altas cascadean, así que se lleva el registro de que la agencia lo pidió y el super admin lo firmó, contra lo que dicen las migs 0175 y 0178). 2) video-clips y ads-creatives guardan bajo video-generator/<planId>/ y nueva/, no bajo <
  - Dónde: `C:/dev/wt-puntas/lib/reset-workspace.ts · supabase/migrations/0175, 0178 · pendiente en C:/dev/wt-puntas/docs/hallazgos-infra.md:7096`
- **La guarda de cobertura de server actions de la API de MaKo no esta en main: 174 acciones sin declarar y nada que las cace** · _Infraestructura, mediano_
  - `scripts/api-cobertura.mjs` y `lib/api-mako/cobertura.ts` NO existen en el arbol (lo verifique con ls); viven solo en la rama cantera `wip/api-acciones-1410`, que el Cerebro decidio el 23/10 no mergear nunca. Sin la guarda, cada server action nueva puede nacer sin su operacion en la API y nadie se entera: la auditoria 
  - Dónde: `C:/dev/wt-puntas/docs/relevo/api-mako.md:7-12 (la decision y el inventario) · C:/dev/cerebro-herramientas/auditoria-api-mako-23-10.md (las 174) · faltan C:/dev/wt-puntas/scripts/api-cobertura.mjs y C:/dev/wt-puntas/lib/a`
- **Nadie paso por los 39 pendientes vivos de docs/estado-del-arte.md, y el documento esta en parte vencido** · _Infraestructura, mediano_
  - `docs/estado-del-arte.md` tiene una seccion «Pendientes vivos» con 39 items priorizados por riesgo, marcados [FRAGIL] (se pierde o empeora si nadie lo toca) y [ESPERA]. Ninguna de las siete familias lo leyo. Verifique tres contra el codigo y YA ESTAN CERRADOS (las vistas de cohortes con `security_invoker`, mig 0231; `d
  - Dónde: `C:/dev/wt-puntas/docs/estado-del-arte.md:165-230 (§Pendientes vivos)`
- **Competitors Spy no tiene pantalla propia en el teléfono** · _Competitors Spy, grande_
  - Está `EN_CAMINO` en lib/movil-rutas.ts desde antes del pedido: un teléfono ve la cubierta «se usa en la computadora». Lo nuevo (gráfico, detalle, «Copiar estructura») ya se probó a 390 px en Chromium y entra sin scroll de costado con hasta 90 miniaturas. Cuando se escriba la pantalla, montar `GraficoSpy` tal cual.
  - Dónde: `C:/dev/wt-puntas/lib/movil-rutas.ts (EN_CAMINO) ; app/m/ ; docs/relevo/nube-spy.md:213-218`
- **Series y duplicados sin marcar: varias partes del mismo carrusel ocupan la grilla** · _Carruseles, mediano_
  - Por ejemplo las partes de «you can find anything on the internet», o muchas de meal prep de una misma cuenta. El reparto por variedad (máximo 2 de la misma cuenta por tramo de 12) no resuelve el duplicado de CONTENIDO. Hecho = una serie se muestra una vez, con sus partes adentro, o se marca y se esconde la repetida.
  - Dónde: `lib/carruseles/variedad.ts (`conVariedad`), lib/carruseles/explorar.ts (`filtrarCarruseles`); docs/hallazgos-carruseles.md:214`
- **Tanda 4: alojar las fuentes nosotros en vez de jsDelivr** · _Editor de imágenes, mediano_
  - Hoy las 499 variantes salen de jsDelivr. Un archivo frio tardo 12,6 s y el motor corta la carga a los 8 s (`LOAD_TIMEOUT_MS`): la primera vez el texto puede caer a la fuente del sistema SIN error, y el chat ya pierde texto por fuentes que el editor no tiene. Alojarlas saca el problema de raiz. Regla que queda: nada de 
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/fuentes.ts · C:/dev/wt-puntas/app/image-editor/_doory/editor/engine/fonts.ts (LOAD_TIMEOUT_MS) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:216-225 y 375-390`
- **El adaptador del editor tiene marca, stock, versiones, compartir y comentarios en `null`** · _Editor de imágenes, grande_
  - Cinco servicios del editor devuelven null y piden tablas propias. Ojo: la marca del negocio (kits en app_settings, 5/11) entro por el PROMPT del chat de Image, no por este hueco: el panel «Marca» del editor sigue vacio. HECHO cuando cada uno tenga su tabla y su pantalla, o cuando el documento diga cual se descarta y po
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/adaptadorNube.ts:147-151 (brand, stock, versions, sharing, comments) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:461`
- **Del armazon de Canva faltan siete detalles** · _Editor de imágenes, mediano_
  - La vista rapida al pasar el mouse por el riel y la pestania «Estilos» de Diseno (chrome/RielCanva.tsx); la mini-barra pegada a la seleccion (falta la posicion en pantalla del objeto); las marcas de la regla con la posicion del elemento (workspace/Rulers.tsx); el «...» por mosaico de la cuadricula (workspace/PageGrid.ts
  - Dónde: `C:/dev/wt-puntas/app/image-editor/_doory/editor/chrome/RielCanva.tsx · workspace/Rulers.tsx · workspace/PageGrid.tsx · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:456-459`
- **Un SVG subido se guarda como PNG y se pierde el vector** · _Editor de imágenes, mediano_
  - El bucket de Supabase no acepta SVG ni AVIF (un SVG es un documento activo bajo su dominio), asi que el adaptador los dibuja a PNG antes de subir. Canva conserva el SVG vectorial. Para conservarlo hay que sanearlo en el server y servirlo desde un origen SIN cookies. HECHO cuando un SVG subido se agrande sin pixelarse y
  - Dónde: `C:/dev/wt-puntas/app/image-editor/mako/nube.ts (aRaster) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:344-345 y 462-463`
- **Lo que el chat del editor todavia no sabe hacer** · _Editor de imágenes, grande_
  - La lista literal que la IA declara imposible: agregar iconos o graficos de la biblioteca; poner una foto que no este en «fotos»; generar imagenes con IA; quitar el fondo; recortar o cambiar el encuadre; filtros y ajustes de foto; degradados; animaciones; agrupar y desagrupar; cambiar el tamano del diseno (Redimensionar
  - Dónde: `C:/dev/wt-puntas/lib/image-editor/chat/catalogo.ts:96-97 (NO_SE_PUEDE_CHAT_IMAGEN) · app/image-editor/mako/chat/acciones.ts · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:445-446`
- **El chat de Image en la API de MaKo: las tandas 2 y 3 nunca se hicieron** · _Editor de imágenes, grande_
  - Tanda 2: las operaciones del chat que PROPONEN, con su tabla de propuestas. Tanda 3: «entender el pedido», o sea /api/mako/pedidos con `tab: 'imagen'` ANTES de la IA, como ya lo hace el Video Editor (app/video-editor/_opencut/chat/pedidos.ts). Los objetos del area `imagen` ya estan en el server. Se dejaron para despues
  - Dónde: `C:/dev/wt-puntas/lib/api-mako/areas/imagen.run.ts · C:/dev/wt-puntas/app/video-editor/_opencut/chat/pedidos.ts (el molde) · C:/dev/wt-puntas/docs/hallazgos-editor-imagen.md:442-444`
- **Los botones Discutir / Editar no estan en el chat de Imagen ni en el de Video** · _Editor de imágenes, mediano_
  - `SelectorIntencion` esta en Automations, Copywriter y Web Generator. Sumarlo a los dos chats de edicion y que `lib/image-editor/chat/ia.ts` respete «Discutir» (hoy edita siempre).
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:50 · app/image-editor/mako/chat/PanelMakoIA.tsx · app/video-editor/_opencut/chat/PanelChat.tsx`
- **TikTok en Automations: solo esta la fase 0** · _Chat de MaKo, mediano_
  - Falta el disparador (el boton de TikTok al lado del de IG en el CRON). El disenio limita a contestar, con tope de 10 mensajes en 48 h.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:185-186 · lib/nutricion.ts:155 · docs/diseno-tiktok-linkedin.md`
- **El ramp-up gradual no se aplica al tope diario de WhatsApp de las secuencias** · _Chat de MaKo, mediano_
  - `topeConRampa` solo rampa el email; el `wa.dia` de las secuencias es fijo. Aplicar `arranqueDia` y `arranqueSube` tambien a `limites.wa`. Es la leccion del bloqueo de 24 h del numero de Mauricio.
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:40 (5.8) · lib/goteo-db.ts:42 · lib/limites-envio.ts`
- **Cinco cosas del anti-ban de WhatsApp sin probar con la línea de verdad** · _Chat de MaKo, mediano_
  - (1) Que el mensaje del `wa.me` llegue al webhook por la voz `mako_ws9` con el número de quien lo manda — si llega como `@lid` sin `remoteJidAlt` ni `senderPn`, no se confirma. (2) Que Martín vea esos mensajes en su WhatsApp personal y le parezca bien. (3) Qué devuelve Evolution 2.3.7 para un 463 y un «rate-overlimit» a
  - Dónde: `C:/dev/wt-puntas/lib/linea-freno.ts ; lib/mako-salida-reglas.ts ; docs/relevo/nube-whatsapp.md:32-41`
- **El diseño de los grupos de la app nunca se vio con sesión** · _Chat de MaKo, grande_
  - `punta/grupos-diseno` (quiénes están debajo del nombre, Invitar y Participantes a la derecha, el modal sin saltos, la cita de MaKo y el 👍 sobre el borde) se miró con capturas en Chromium, no en la app con sesión. Y queda la lista de hallazgos-ops-center: la sesión real de un invitado (y si Joan y Juanfran comparten fi
  - Dónde: `C:/dev/wt-puntas/docs/hallazgos-ops-center.md (las dos listas «Lo que quedó sin hacer», 3 y 4/11) ; docs/relevo/nube-grupos.md:85-99`
- **Nada del email salió nunca a un buzón real** · _Chat de MaKo, mediano_
  - Resend fue siempre de mentira. Sin medir: que Resend prenda de verdad el seguimiento con el PATCH y que los emails lleguen con el píxel y los links envueltos; el valor real de `bounce.type` en un rebote (el código acepta Permanent, hard y hardbounce; si Resend manda otra cosa, el rebote no cuenta para el freno); la ram
  - Dónde: `C:/dev/wt-puntas/lib/resend-dominios.ts ; tests/resend-clave-admin.test.ts ; docs/relevo/nube-email.md:172-199`
- **Una respuesta por Instagram no pausa la salida, y el motor contesta siempre por WhatsApp** · _Chat de MaKo, mediano_
  - Que pausarPorRespuesta conteste por el canal donde le escribieron. Hecho = responder por Instagram pausa y la respuesta sale por Instagram.
  - Dónde: `C:/dev/wt-puntas/lib/nutricion.ts (pausarPorRespuesta) · lib/zernio-entrante.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:2578`
- **El paso «esperar» de los avisos sigue sin drenador** · _Chat de MaKo, mediano_
  - El paso existe, la UI lo ofrece y corta la ejecución: nadie lo reanuda. Hecho = un aviso con «esperar» sale al vencer la espera.
  - Dónde: `C:/dev/wt-puntas/lib/flujo-aviso.ts · app/agencia/FlujoAviso.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-comunicacion.md:7097`
- **El clon de configuración se lleva la línea POR MENSAJE y no copia los disparadores** · _Chat de MaKo, mediano_
  - Sumar `linea` a la lista que se vacía al clonar (con su aviso) y copiar `disparadores` de nutricion_secuencias. Hoy en el destino elegirLinea la rechaza y ese mensaje no sale, sin caer a la de default; y una automatización con varios CRON llega con uno. Hecho = clonar una configuración deja la automatización mandando p
  - Dónde: `C:/dev/wt-puntas/lib/clonar-config.ts (secuenciaParaElDestino, TABLAS) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:2783 y :3272`
- **~~Cinco prompts con la identidad de Mauricio hardcodeada para todos los workspaces~~** · _Chat de MaKo_
  - Dónde: `lib/closing.ts:141 (RE_SERVICIO_EXPLICITO) · cosechado en docs/hallazgos-closing.md`
- **A6: no hay reloj fijo de 14 dias por cliente de agencia** · _Cobros y planes, mediano_
  - Hoy el mes corre desde que el cliente termina el onboarding. Hace falta `inicio_at = alta + 14 dias` y que el cron de renovaciones lo respete.
  - Dónde: `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:85 · lib/agencia-cobro-reglas.ts:10 · lib/agencia-cobro.ts`
- **Los carteles de tope le dicen «Pasa a MaKo Pro» al cliente de una agencia** · _Cobros y planes, mediano_
  - Usar `clienteDeAgencia` de /api/auth/me para esconder el link y cambiar el texto a «pídele a tu agencia que te pase a Pro», en las siete pantallas que lo dibujan. Hecho = un cliente de agencia no ve ningún «Pasar a Pro».
  - Dónde: `C:/dev/wt-puntas/app/crm/PasarAPro.tsx · app/crm/TraerDeGrupoWA.tsx · app/whatsapp/EvolutionConnect.tsx · app/equipo/EquipoView.tsx · app/m/configuraciones/equipo/EquipoM.tsx · app/web-generator/editor/dialogos/DialogoPu`
- **El prorrateo del diferencial de agencias lo calcula Martín a mano** · _Cobros y planes, mediano_
  - Automatizar el prorrateo de los días hasta el próximo 5 por cada cliente nuevo (hoy se registra como ajuste). Hecho = el diferencial sale calculado sin que nadie lo cargue.
  - Dónde: `C:/dev/wt-puntas/lib/agencia-cobro.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-pagos.md:1799 y C:/dev/wt-puntas/docs/hallazgos-agencias.md:517`
- **La busqueda avanzada del CRM, como la del plan** · _CRM, mediano_
  - ID, acentos y orden libre ya estan. Faltan elegir campos, la busqueda con IA y la flechita: el `Buscador` sigue siendo un input simple. Martin lo marco como «te lo pedi».
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:178-180 · app/crm/CrmToolbar.tsx:351-362 · lib/buscar-texto.ts`
- **Onboarding para inmobiliarias (sin closer, sin R1/R2)** · _CRM, mediano_
  - Sin resultados para «inmobil» ni «closer» en `lib/onboarding*` ni `app/onboarding`. Ademas, que nada pida R1/R2 si el negocio no las usa (sacar el «Tipo de evento de R1» obligatorio al conectar Calendly).
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:182-183 · lib/onboarding-crm.ts:1-12 · docs/relevo/pedidos-perdidos-2810.md:86 · lib/calendly-aviso-reglas.ts`
- **Los paneles cuentan a un lead migrado el día que se migró** · _CRM, mediano_
  - Migrar 5.000 contactos pinta 5.000 «leads nuevos» ese día. Ya se guarda `fecha_original`: contarlo en su fecha es usar `coalesce(fecha_original, created_at)` en los lectores de leads por período.
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-thiago-migrar.md:46-47 ; los lectores de leads por período`
- **La iniciativa de MaKo en el CRM está sin hacer** · _CRM, mediano_
  - Falta la apertura del funnel sin declarar (necesita el canal y el diagnóstico en la estrella, y `declararEntradasAction`), la guía de la ficha del lead (`recorrido-ficha.ts`, `Senalar`), y `/crm?nuevo=1` («Ver los 12») que tampoco existe.
  - Dónde: `C:/dev/wt-puntas/lib/aperturas/ ; docs/mako-iniciativa/plan.md §5 ; docs/relevo/nube-iniciativa.md:38`
- **El evento «Calificado» a Meta no es idempotente para lo mandado antes del 17/10** · _CRM, mediano_
  - Hacer idempotente el envío a Meta (hoy un lead marcado antes del 17/10 no tiene la línea del historial y volver a marcarlo pasadas las 48 h del dedup de Meta cuenta dos veces). Hecho = volver a marcar un calificado viejo no manda un segundo evento.
  - Dónde: `C:/dev/wt-puntas/lib/leads.ts:922-946 · lib/meta-capi.ts:33 · lib/calificado-reunion.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:7821`
- **El onboarding del CRM: la mitad existe y falta la PUERTA, con tres huecos medidos** · _CRM, grande_
  - 1) Declarar un onboarding con prefijo crm_ en TAB_ONBOARDINGS (sin pantalla que lo complete deja a todos afuera del CRM, que es la primera tab de todos los roles). 2) Que cambiar «cómo vendo» después mueva el funnel (hoy la siembra corre una sola vez y funnels.canal está NULL en los 11 funnels de producción). 3) Montar
  - Dónde: `C:/dev/wt-puntas/lib/tab-onboarding-catalogo.ts · lib/fase-diagnostico.ts (CANALES) · lib/pipeline.ts (FUNNEL_TEMPLATES, templateDeCanal) · app/funnel/EntradasCard.tsx · app/api/onboarding/route.ts · pendiente en C:/dev/`
- **El filtro «Responsable» no existe en el tablero del dueño** · _CRM, mediano_
  - Migración aditiva para plan_tareas.responsable_tipo y alguien que lo escriba, más el filtro en el tablero. Hecho = se puede filtrar el tablero del dueño por responsable.
  - Dónde: `C:/dev/wt-puntas/app/plan/board/ · supabase/migrations/ (plan_tareas.responsable_tipo) · pendiente en C:/dev/wt-puntas/docs/hallazgos-plan.md:2701`
- **El inbox de WhatsApp tiene su funnel hardcodeado en cuatro copias y es ciego a funnel_config** · _CRM, grande_
  - Que las cuatro lecturas usen el funnel configurado. Hoy todos los leads de un cliente que vende por chat quedan en «Abierto» para siempre, y ese label es lo único que recibe whatsapp-advisor. Hecho = el inbox muestra las etapas reales del funnel del negocio.
  - Dónde: `C:/dev/wt-puntas/lib/wa-etapas.ts:48 · app/api/whatsapp/conversations/route.ts:29 · lib/meta-rules.ts:78 · app/whatsapp/WhatsAppApp.tsx:227 · lib/whatsapp-advisor.ts:175 · pendiente en C:/dev/wt-puntas/docs/hallazgos-com`
- **Las clases 2 y 4 de las sugerencias de MaKo en el CRM no se hicieron** · _CRM, grande_
  - Gestos repetidos (clase 2), «llega algo nuevo» (clase 4), «Perdidos hace 60 a 90 días» y «la etapa donde se cae la mitad». docs/sugerencias-mako-crm.md:4 todavía dice «Nada de esto existe todavía». Hecho = las cuatro sugerencias aparecen y se pueden callar.
  - Dónde: `C:/dev/wt-puntas/lib/sugerencias-crm.ts · C:/dev/wt-puntas/docs/sugerencias-mako-crm.md:4 · pendiente en C:/dev/wt-puntas/docs/hallazgos-crm.md:1306`
- **Las diez caras nuevas de gurús tienen los `grandes/` agrandados, no el original** · _Thumbnails, mediano_
  - Los grandes/ de los diez últimos son los 200×200 de Canva escalados a 600 con bicúbica (los catorce primeros son los 1264 reducidos): en la tarjeta de Spy se ven blandos. Para rehacerlos hay que exportar el original desde Canva (un diseño con la imagen y export-design); los ids de media de los diez están anotados. Hech
  - Dónde: `C:/dev/wt-puntas/public/asesores/grandes/ · lib/asesores/catalogo.ts · ids y procedimiento en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:467`
- **La miniatura dibujada de las plantillas de Video sigue sin hacerse** · _Thumbnails, mediano_
  - De los enchufes de «plantillas propias», Video espera al editor: los 6 templates nuevos, retirar dos, los clips de Pexels y la miniatura dibujada. Hecho = una plantilla de Video muestra su miniatura en la galería.
  - Dónde: `C:/dev/wt-puntas/app/video-generator/ · lib/plantillas-propias/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-plantillas.md:122`
- **Muapi como segundo motor de video** · _Editor de video, grande_
  - Hay disenio escrito (`459bd7c0f`) y `git grep -i muapi` no da nada en `lib/` ni `app/`. Hecho = un video generado por Muapi como alternativa a Flow.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:147-149 · docs/diseno-ai-avatar-estudios.md:53`
- **El «Creador de formatos» que pidio Martin** · _Editor de video, mediano_
  - `app/video-generator/formatos-datos.ts` existe y nadie lo importa. Falta la pantalla y el flujo.
  - Dónde: `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:155-157 · app/video-generator/formatos-datos.ts · docs/hallazgos-generativa.md:4622`
- **Nada del Video Editor (subtítulos, B-roll y clips) se miró en un navegador** · _Editor de video, mediano_
  - La nube no corre el editor (necesita WebGPU y el WASM). Falta: palabras clave (subtítulos automáticos con el interruptor, el panel, guardar un preset y verlo en Plantillas «De tu marca»); B-roll (`probar-broll-ia.mts --ws 3`, conectar Pexels, «Proponer», borde punteado, Dejar/Sacar y Ctrl+Z); clips (`probar-clips-ia.mt
  - Dónde: `C:/dev/wt-puntas/scripts/probar-broll-ia.mts y scripts/probar-clips-ia.mts ; docs/relevo/nube-video-clips.md:37-48`
- **Los 6 templates nuevos de Video no entraron** · _Editor de video, mediano_
  - Sumar los 6 templates nuevos, retirar `gancho-escrito` y `oferta-glitch`, sumar los clips de Pexels y la miniatura dibujada (`MiniaturaPlantilla`). Lo que no entró está listado en la cabecera del archivo de ejemplos. Es trabajo del chat de Video.
  - Dónde: `C:/dev/wt-puntas/lib/editor-video/plantillas-ejemplos.ts (la cabecera) ; docs/relevo/nube-plantillas.md:43-46`
- **Montar un anuncio desde el chat y renderizar en servidor no existen** · _Editor de video, grande_
  - Lo que pidió Martín el 25/10 y no se construyó: (1) la operación montar_anuncio_video (la API sólo lee, con ver_montaje_anuncio); (2) editar un video pedido por chat y que salga renderizado (el Video Editor exporta sólo en el navegador, no hay render en servidor ni en MaKo Desktop). Martín quiere las dos vías, «también
  - Dónde: `C:/dev/wt-puntas/lib/api-mako/areas/video.def.ts · app/video-editor/_opencut/services/renderer/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:1304`
- **El worker usa la duración de la PRIMERA toma para todas y la pantalla afirma «no una palabra»** · _Editor de video, mediano_
  - Pasarle segundosPorToma entero al script y que plan-cortes-anuncio tope cada toma con la suya; medir segundosAntes del audio real o rotularlo estimado; e invocar el verificador de palabras (verificar-corte-anuncio.mjs está en el Dockerfile y no lo llama nadie, así que palabrasPerdidas no llega nunca). Hecho = una toma 
  - Dónde: `C:/dev/wt-puntas/worker/montar-cola.mjs:126-132 · scripts/plan-cortes-anuncio.mjs:78 · app/video-generator/PasoMontaje.tsx:144-152 · app/api/montaje/worker/route.ts:43 · scripts/verificar-corte-anuncio.mjs · pendiente en`
- **El Video Editor no tiene Deshacer, no reordena tomas y no tiene música** · _Editor de video, grande_
  - Ctrl+Z (una pila de planes en un useRef, con las operaciones puras ya en editor-cortes.ts); el arrastre para mover un tramo de lugar (el plan ya lo soporta: es un array ordenado); y la música, esperando Epidemic Sound Connect (una fila en PISTAS y anda). Hecho = los tres andan en el editor.
  - Dónde: `C:/dev/wt-puntas/app/video-editor/_opencut/ · lib/editor-cortes.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-video-pipeline.md:1139`
- **Cada video de avatar empuja anuncios viejos afuera del historial (tope de 10)** · _Editor de video, mediano_
  - Los videos de avatar son un plan del historial del Video Generator, con MAX_HISTORIAL = 10: hacer muchos saca anuncios viejos con el único puntero a sus clips (los LOOKS no tienen ese problema, viven en ai-avatar.looks). Hecho = los videos de avatar no comparten el tope con los anuncios.
  - Dónde: `C:/dev/wt-puntas/app/ai-avatar/actions.ts (crearVideoAction) · app/video-editor/avatar/actions.ts · app/video-generator/video-datos.ts (MAX_HISTORIAL) · pendiente en C:/dev/wt-puntas/docs/hallazgos-ai-avatar.md:280`
- **Lo que hace cada persona no se dibuja en la ficha de su negocio (Customers)** · _SuperAdmin, mediano_
  - `vistaDeActividad` ya trae la actividad por negocio; falta pintarla en la ficha. Y queda la opción de Usage como pestaña aparte (hoy vive dentro de Activity, copiado de PostHog): si Martín la quiere aparte, son las mismas cuentas en otra pestaña.
  - Dónde: `C:/dev/wt-puntas/lib/admin-actividad (vistaDeActividad) ; app/admin/ ; docs/relevo/nube-admin.md:80-86`
- **Ops Center: nada se miró en la app de verdad, con la sesión de Martín** · _SuperAdmin, mediano_
  - Falta la sesión de un invitado real (requireMovil; Joan y Juanfran: si comparten fila en usuarios no se puede invitar a los dos), el push tocado en un Android, y el ?ws= de WsFetch contra las rutas del grupo. Hecho = recorrido con la sesión real y lo visto anotado.
  - Dónde: `C:/dev/wt-puntas/app/_chat/grupo/HiloDelGrupo.tsx · app/admin/operaciones/ · pendiente en C:/dev/wt-puntas/docs/hallazgos-ops-center.md:120`
- **Tickets abiertos sin cerrar: #38 (Fastlane), #39 y #43** · _Tickets, mediano_
  - Figuran abiertos en el relevo del 4/11 y ninguno aparece cerrado despues. El #38 esta ademas en la lista de decisiones de producto de Martin.
  - Dónde: `docs/relevo/cerebro.md:152 · docs/relevo/pendientes-barrido.md:188`
- **Los tickets sin cuenta no tienen dónde guardar «no me escribas»** · _Tickets, mediano_
  - Un ticket que entra por WhatsApp sin perfil, o de un alumno de un curso, no tiene dónde anotar la baja de los correos. Si hace falta, se necesita una tabla de bajas por email, o sea una migración. Quedó afuera a propósito. Aparte: falta una casilla en Notificaciones para prender y apagar los correos de avance (hoy sólo
  - Dónde: `C:/dev/wt-puntas/docs/relevo/nube-tickets.md:33-38 ; lib/tickets`
- **La foto de quien levanta un ticket puede ser CUALQUIER https** · _Tickets, mediano_
  - avatarUrl se guarda sin filtro, así que un cliente que pone una URL suya se entera de cuándo Martín abre la Ticketera (y su IP). Arreglarlo es aceptar sólo el storage propio y Google, para toda la app. Hecho = una foto de perfil externa se rechaza.
  - Dónde: `C:/dev/wt-puntas/lib/perfil.ts (setPerfil, avatarUrl) · lib/tickets-db.ts (aFila) · pendiente en C:/dev/wt-puntas/docs/hallazgos-ticketera.md:642`

## Las que te esperan a vos (229) — no son tareas

No las puede destrabar nadie más: hay que decidir, pagar, firmar o cargar una clave.

- **Las fotos huérfanas del bucket público `avatars` siguen ahí** · _Varios_ — El `--borrar` pide el sí de Martín
- **Las 10 llamadas de entrega en `error` nunca se reintentaron** · _Varios_ — Cuesta crédito de IA: pide el sí de Martín
- **Las fuentes de pedidos que NADIE leyo (lo mas grande que falta)** · _Varios_ — Varias viven solo en la PC o en side-session-notes; el WhatsApp personal pide su telefono
- **Plan: filtros agrupados en 4 desplegables y el popup de tareas creadas** · _Varios_ — C8 espera que P7 (`mudanza-avisos-plataforma --eventos=reunion_tareas_al_plan`) este aplicado
- **Verificar en pantalla las varias claves de Apify y el cuerpo real del «sin crédito»** · _Varios_ — Hace falta levantar la app y una clave con credito.
- **Las caricaturas de los 10 gurus del Ops Center** · _Varios_ — Sin Canva conectado en la cuenta del Runner la pendiente espera sin error
- **Diez gurús tienen la ficha escrita y esperan sólo su caricatura** · _Varios_ — Las caricaturas se hacen con Canva desde la PC y la nube no tiene Canva. Si Martín ya las hizo, están en Canva o en su PC, no en el repo.
- **La revisión de la app de Meta antes del 7/12, y la verificación de Google** · _Varios_ — El video y las cuentas son suyos; Google depende del proveedor
- **Tiendas: Play en borrador, Apple en el build 2 y el certificado de Windows sin comprar** · _Varios_ — Son compras y sesiones suyas: cuentas de tienda, DSA, 12 testers, certificado
- **Decisiones de Martín sueltas que frenan código escrito** · _Varios_ — Cada una tiene código escrito o medido esperando atrás
- **Cosas de clientes que esperan que Martín les escriba o cargue una clave** · _Varios_ — Son claves, avisos y pagos de terceros: un asistente no puede
- **2FA por correo y varias formas activas; y que piden los que no tienen TOTP** · _Varios_ — Falta que Martin diga que se pide a quien no tiene TOTP
- **Replicar landings tal cual y borrar las replicas que salieron mal** · _Varios_ — Borrar en produccion pide el si de Martin
- **C3: `embeddings` gasta IA sin `recordUsage` y no se ve en el Uso** · _Varios_ — Decision de como se registra el gasto
- **C10 (la otra mitad): el primer mensaje del anuncio llega sin referral** · _Varios_ — Decision de atribucion
- **Ads Manager y Media Buyer: probarlo contra Meta real** · _Varios_ — El clic de la prueba de anuncios por Zernio y la cuenta publicitaria son de Martin
- **Otros grabadores de reuniones y deprecar Fathom** · _Varios_ — Deprecar Fathom y elegir los grabadores es decision suya
- **Probar en el negocio de prueba (ws 3) las siete puntas nuevas** · _Varios_ — Pide su sesion en el ws3
- **P17: mirar en pantalla lo desplegado que nadie miro** · _Varios_ — Todo pide su sesion y su telefono
- **Decisiones de producto abiertas que frenan trabajo** · _Varios_ — Son todas decisiones suyas
- **Meta y Google: la revision de la app vence y faltan pasos suyos** · _Varios_ — El video, el secreto y los paneles son suyos
- **Avisarle a Codigo Inmobiliario y a P2P por los datos de sus leads** · _Varios_ — Borrar datos de produccion y avisarle al cliente lo decide Martin
- **Datos de clientes que esperan una decision o un aviso** · _Varios_ — Cada uno pide su si o su clave
- **La app de escritorio como MaKo entero (pedido duplicado tres veces)** · _Varios_ — Falta la decision Tauri o Electron y si D6b se extiende o se corrige la venta
- **Scraper con los DMs de Instagram y perfiles nuevos (Google Maps, LinkedIn)** · _Varios_ — La fuente de datos (paga) la elige Martin
- **Replica a otro servidor si se cae uno, y correr los chats en la nube** · _Varios_ — Es infraestructura paga: lo decide Martin
- **ChatGPT por suscripcion en la PC del cliente: probarlo de punta a punta** · _Varios_ — Pide su `codex login` y la cuenta de ChatGPT de prueba
- **Codigo de verificacion por email y la garantia de devolucion** · _Varios_ — La garantia la define Martin
- **MaKo reta a quien tiene varias ofertas a proposito** · _Varios_ — Cambiarlo toca el metodo: lo decide Martin
- **Acciones de produccion o disco pendientes, que no son codigo** · _Varios_ — Todas piden su confirmacion
- **Ganar en un segundo producto no dispara la invitacion al curso** · _Varios_ — Decision del CRM
- **El email de Mauricio: falta su clave de Resend y el envío real sigue apagado** · _Chat de MaKo_ — El aviso a Mauricio lo da Martin
- **Siete decisiones del recorrido visual esperan a Martín** · _Varios_ — Las siete son decisiones de producto o de diseño; dos (U3 y la difusión) además necesitan hablar con el jefe Sidebar y con Leila.
- **Dashboards: tres mediciones y dos decisiones abiertas** · _Varios_ — Los tonos y el borrado de PIEZAS_GENERAL los decide Martín: borrar le saca opciones a quien los usa.
- **El revisor de las tiendas no puede probar la IA sin una decisión de plata de Martín** · _Varios_ — Es gasto de IA de la plataforma para una cuenta que no es un cliente: lo decide Martín.
- **Cuatro decisiones abiertas del Lead Magnet Generator** · _Varios_ — Las cuatro son decisiones de producto; la 2 cambiaría el ritmo de todas las landings de todos los negocios.
- **El tiempo al aire de la hoja Closing: decidir de dónde sale el dato** · _Varios_ — Hay que elegir entre una estimación de los turnos y el dato medido del grabador: cambia qué se le promete al cliente.
- **Dos chats figuran «waiting on a human» y sólo Martín los destraba** · _Varios_ — Los dos chats están en «waiting on a human»: no avanzan sin que Martín los destrabe.
- **La extensión: la tienda sigue en la 0.74.3 y lo de la 0.74.4 y 0.74.5 no llega a nadie** · _Varios_ — La autorización de la credencial de la tienda es de Martín.
- **Publicar anuncios por Zernio sigue detrás de ZERNIO_ANUNCIOS_PROBADO en false** · _Varios_ — La prueba de publicación es de Martín (publica en una cuenta real y gasta).
- **Las TAREAS de Google en el Calendario esperan la aprobación de la verificación** · _Varios_ — Decisión de Martín del 14/10: después de la aprobación de la verificación, que se mira en la consola o en martinkoncke@gmail.com.
- **El Second Brain: el grafo deja el 56-67 % del lienzo vacío y las etiquetas se pisan** · _Varios_ — El layout elíptico es decisión del dueño porque le cambia el mapa a todos los clientes; el local graph no, pero el documento los presenta como alternativas.
- **Diez llamadas de entrega quedaron en `error` sin reintento por falta de crédito de Anthropic** · _Varios_ — Reintentar gasta crédito: lo decide Martín (la regla de la casa es no reintentar por default).
- **La poda fina del tablero ítem por ítem no se hizo: se reordenó** · _Varios_ — Las tres contradicciones y el número de Seguridad los decide Martín: hacer la poda por cuenta propia sería inventarla.
- **MaKo Mobile: ninguna pantalla v2 se miró en un navegador ni en un teléfono** · _Varios_ — Prender el desvío afecta a todos los clientes con celular y medir en los dos teléfonos necesita los dispositivos de Martín.
- **El plugin público de la API se regeneró y nunca se publicó** · _Varios_ — Publicar el repo público se hace a mano, desde la cuenta de Martín.
- **/api/agente/plan y /lead (POST) no miran el alcance del token** · _Varios_ — La decisión D de Martín fue mantener /api/agente tal cual.
- **IA: el modelo gratis de OpenRouter por default está muerto para TODAS las features** · _Varios_ — La key de Gemini bloqueada por Google la decide Martín, según el propio documento.
- **La agenda de MaKo (calendly.com/koncke/asesoria) NO entra al CRM del ws9** · _Varios_ — Hay que crear la suscripción de webhook en la cuenta de Calendly koncke: es de Martín.
- **Newsletter: la fila sigue en PRONTO y seis cosas más sin hacer** · _Varios_ — Abrirla a todos va con el go-live del email, que es decisión de Martín.
- **Recomendaciones: los UMBRALES son razonados, no medidos, y no hay capturas** · _Varios_ — Los permisos de lectura de producción los habilita Martín.
- **normalizarUrl sigue con lista negra y es lo más grande que queda abierto en el Pixel** · _Varios_ — Además queda abierto avisarle a la agencia de los datos personales que estuvieron en las URLs (Código Inmobiliario ws13 y P2P Consulting ws14): lo decide Martín
- **La direccion de las 4 primeras hojas del Dashboard sigue sin confirmar, y 4 hojas no tienen referencia** · _Varios_ — Es su criterio sobre el diseno de las 4 primeras: sin eso no conviene seguir copiando.
- **Creaciones y estrellas: `formato_video` sin enchufe, el boton «Publicar» y la tab** · _Varios_ — `formato_video` espera que Martin diga si «un formato» es un anuncio del historial. La tab en la barra tambien espera su respuesta.
- **El recorrido visual: faltan 14 de 22 pantallas y 22 hallazgos sin repartir** · _Varios_ — Necesita Chrome y una sesion
- **Pixel: un VSL POR PAGINA (marcar el nuevo desmarca el viejo)** · _Varios_ — El worktree vive solo en la PC
- **Asistente por WhatsApp con la agenda del dia y «Agendar llamada» en el primer hueco** · _Varios_ — El canal de WhatsApp saliente de MaKo se esta cortando
- **Investigar «Grockbot» y leer el archivo «Feedback Chatbot.txt»** · _Varios_ — El archivo «Feedback Chatbot.txt» esta anotado como no legible
- **El superadmin no puede ver su propia credencial (el ojito)** · _Varios_ — Decidido como seguridad: no se reabre
- **La migración 0390 (llamadas grabadas) no figura como aplicada** · _Varios_ — No está en la tabla de migraciones aplicadas del Cerebro (que lista 0394, 0397, 0398, 0401, 0402, 0403 y 0404 a 0409), pero el relevo que la pide es del 4/11 y 
- **Cuatro pedidos del wizard de campaña y la vista de públicos sin cerrar** · _Varios_ — Pedidos de junio y julio de 2026; sólo el tope por tipo de público está medido (16/09).
- **Conocimiento: 785 clases pierden su sección y un curso regenerado tiraría 242 clases** · _Varios_ — Barrido del 29/08/2026; no pude confirmar cuáles se cerraron después.
- **Conocimiento: no existe el paso de extraer audio antes de transcribir, ni ingesta por lote** · _Varios_ — Entrada de 2026-08-11; no pude confirmar si el paso se escribió.
- **El Plan: exportar no funciona e importar un .md deja el modal pensando para siempre** · _Varios_ — Pedidos del 05-06/08/2026; no pude confirmar si se arreglaron.
- **El Plan: el Perro se re-ejecuta y re-prioriza en cada refresh, y no participa de la Retro** · _Varios_ — Reportes de julio de 2026 (el Perro) y 2026-09-16 (medir); no pude confirmarlos.
- **Seguridad: decir en cada pedido de API que el método es BYOK** · _Varios_ — Pedido del 2026-07-15; no pude confirmar si los textos ya lo dicen.
- **IA: los números del saldo no cierran en Claude, Gemini y Groq** · _Varios_ — Reportes de julio de 2026 sin cerrar en el documento; no pude confirmarlos contra producción desde este árbol.
- **Objectives: cinco configuraciones de la app siguen eligiendo UN solo funnel** · _Varios_ — docs/hallazgos-graficos.md:1614 dice que el filtro «Producto» de los LEADS se arregló el 17/10/2026; el documento de objectives sigue dándolo por abierto.
- **Web Generator: lo fijo/pegajoso y replicar de nuevo las paginas #68-#72** · _Varios_ — El pedido es del 29/10 y parte de lo que lista ya entro con c3c6849bc: hay que medir cuanto queda antes de arrancar.
- **Falta medir el ahorro de Vercel en el panel** · _Infraestructura_ — Pide la sesión de Martín en el navegador de la app
- **El respaldo que transcribe YouTube puede estar cortando guiones y nadie lo midio** · _Infraestructura_ — Hace falta que salgan pedidos reales (las 7 pruebas desde la PC dieron 503).
- **El cron del Runner vence el 11/11 y con él el vigía** · _Infraestructura_ — El Runner se niega a armar el cron a pedido de otro chat; lo tiene que pedir Martín en el chat Runner
- **Cinco filas de avisos de la plataforma escritas y sin crear en producción** · _SuperAdmin_ — Antes de prender `reunion_tareas_al_plan` hay que excluir al ws13 (pedidos-otras-cuentas-6-11.md:103)
- **`punta/marketing-copilot` (361c64223) no llegó a main y su chat está trabado** · _Infraestructura_ — El chat «Marketing CoPilot» figura «waiting on a human» desde antes de las 05:45 UTC del 6/11 y no subió nada
- **El Barrido de pendientes quedó quieto con su lista priorizada sin tomar** · _Infraestructura_ — Hace falta abrir un chat nuevo; el anterior no reacciona
- **Publicar la extensión: la tienda sirve la 0.74.3 y el repo tiene la 0.77.0** · _Infraestructura_ — El consentimiento OAuth y el panel son de la cuenta de Google de Martín: un asistente no puede hacerlo
- **Las claves del vigía de aprobaciones no están cargadas** · _Infraestructura_ — Son claves que sólo Martín puede pegar
- **Rotar las claves pegadas en 7 chats viejos y las ocho del Estudio publicadas en GitHub** · _Infraestructura_ — Hace falta que Martín o Leandro confirmen o roten
- **Mas claves de Apify no suben los topes por dia de Spy, y una clave nueva tarda hasta un minuto** · _Infraestructura_ — Si los topes escalan con la cantidad de claves es plata del negocio: lo decide Martin.
- **La firma del instalador de Windows: SSL.com pide iniciar sesion** · _Infraestructura_ — Su sesion y su compra; guardado «para mas adelante» en el relevo del 6/11
- **Rotar las claves que quedaron pegadas en texto plano en 7 chats viejos** · _Infraestructura_ — Rotar claves es suyo
- **Railway a US$40/mes: decidir si se queda** · _Infraestructura_ — Decision de Martin (plata) y falta el dato del servidor propio
- **Proteccion contra DDoS: captcha y Cloudflare** · _Infraestructura_ — Es compra y decision suya
- **Decisiones de seguridad abiertas (GitHub, Supabase Auth, claves del Estudio)** · _Infraestructura_ — Todas son decisiones o accesos suyos
- **Instalar el servicio del Runner (cartero)** · _Infraestructura_ — Es su PC y su permiso
- **La migración 0346 (MaKo sin conexión) espera el sí de Martín desde el 28/10** · _Infraestructura_ — Necesita el sí explícito de Martín en el chat: toca la base de producción.
- **Publicar la portada con los valores de Fitlo y el documento #32 de la landing** · _Infraestructura_ — Aplicarlos publica la portada de MaKo en producción: lo decide Martín.
- **Aplicar la 0357 (limpiar URLs con datos personales de landing) DESPUÉS del deploy** · _Infraestructura_ — El documento dice que la aplica el Cerebro y va después del deploy; nadie confirmó que ese deploy salió.
- **Aplicar la 0351 (baja por edición del newsletter y guion del Copywriter)** · _Infraestructura_ — Esperaba el OK de Martín según el propio documento.
- **El token de GitHub de la plataforma da 404 desde la transferencia del repo** · _Infraestructura_ — Hay que darle permiso al token: lo hace Martín.
- **23 archivos de tests están rojos en main por un import ESM** · _Infraestructura_ — La medición es del 4/11 y desde entonces entraron muchas puntas en verde. Hay que volver a correrlos para saber si siguen rojos.
- **Tres lecturas devuelven VACÍO cuando fallan: mienten «no hay»** · _Infraestructura_ — docs/hallazgos-chatbot.md:30 dice que «No reprodujo el VSL» con la base caída se cerró el 6/11/2026 en el barrido de pendientes; las otras dos lecturas no se co
- **TABLAS_RESET y TENANT_TABLES se separan solas y nada avisa** · _Infraestructura_ — Entrada de 2026-08-05; docs/hallazgos-infra.md:7096 dice que completar TABLAS_RESET ya se hizo y cambió el alcance del reset. Los dos se contradicen.
- **Cuatro pendientes abiertos de /integraciones reportados por el dueño** · _Infraestructura_ — Reportes de julio y agosto de 2026; no pude confirmar cuáles siguen.
- **Ruta propia (deep link) para cada entidad que hoy vive en sub-tabs** · _Infraestructura_ — Pedido del 2026-07-15 repetido en tres documentos; no pude confirmar cuánto se hizo.
- **El TOAST de `wa_mensajes.raw` crece ~200 MB por mes y el disco de Supabase no baja** · _Infraestructura_ — La medicion es anterior al 1/11 y no pude confirmarla sin la base: hay que volver a medir antes de tocar nada.
- **Las marcas de dedup de avisos se acumulan ~3.600 filas por ano y por negocio, y hay avisos sin `dedupKey`** · _Infraestructura_ — Medicion anterior al 1/11: hay que volver a contar las filas antes de decidir el barrido.
- **Lo de Apify contra el servicio de verdad, que nunca corrio: anuncios, traida larga y credito agotado** · _Competitors Spy_ — Hay que correrlo desde la PC con una clave de Apify con credito; la nube no llega a Apify.
- **El diseno (HTML) de una pagina capturada no se guarda: falta un bucket privado, o sea una migracion** · _Competitors Spy_ — Falta asignar el número de migración
- **El tope de 50 publicaciones por vuelta sigue en pie (#12)** · _Competitors Spy_ — Para la mitad de Meta, espera la credencial de Business Discovery. Por Apify se puede subir ya.
- **La caricatura de un competidor que NO es referente nunca se genero ni una vez** · _Competitors Spy_ — Lo corre el Runner en la PC, con la base de produccion y Canva conectado.
- **Dos mediciones en la base que quedaron pedidas y nadie corrio** · _Competitors Spy_ — Hace falta la base de produccion desde la PC.
- **Casi nada de las vueltas 2 a 5 se vio en pantalla en produccion** · _Competitors Spy_ — Hace falta levantar la app o mirar produccion; varias sesiones de la nube no pudieron.
- **La cola de caricaturas: los dos scripts nunca corrieron contra la base real** · _Competitors Spy_ — Sin Canva conectado en la cuenta de Claude del Runner no se anota nada: la pendiente espera sin error y sin aviso
- **La extensión 0.76.0 («Capturar» en Sus páginas) sigue sin publicarse** · _Competitors Spy_ — El panel de la tienda pide re-verificar la sesion de Google en el Chrome aparte (scripts/cdp-tienda.mjs); solo Martin
- **Ver Spy en pantalla con competidores reales (Sugeridos, «Sus paginas», chips)** · _Competitors Spy_ — Pide su sesion en el navegador; desde la nube no se llega a Beacons
- **Unir CAMPOS_PERFIL_PIEZAS con CAMPOS_PERFIL** · _Competitors Spy_ — Depende de la credencial de Business Discovery del item anterior.
- **«Tag Manager puede cargar mas» no dice como verlo** · _Competitors Spy_ — Hasta que la tienda sirva una version con «Guardar en Spy», decirle al cliente que toque el icono es mandarlo a algo que no tiene.
- **La captura con la extension nunca se probo en un navegador de verdad ni se escribio en produccion** · _Competitors Spy_ — Necesita Chrome con la extension cargada y una persona que pase la barrera; y para que lo haga un cliente, la extension publicada.
- **La enmienda III.L de YouTube sin firmar: el múltiplo y el VPH devuelven null en Spy y en Thumbnails** · _Competitors Spy_ — Es un trámite de la cuenta de Google de Martín, no código
- **Business Discovery sigue sin credencial: ni se puede probar el juego ancho de campos ni subir el tope por Meta** · _Competitors Spy_ — Hace falta una credencial de Instagram de la plataforma; sin eso no hay nada que medir
- **Un negocio SIN su Gemini no ve el guion de un video de YouTube** · _Competitors Spy_ — Contradice una regla escrita a propósito: sólo Martín la levanta
- **La extension 0.77.0 no esta publicada: la tienda sirve 0.74.3, asi que «Capturar» no existe para ningun cliente** · _Competitors Spy_ — La publicacion en la Chrome Web Store es de Martin/el Cerebro, y despues Google tarda en aprobar.
- **El multiplo de YouTube espera el tramite: la enmienda III.L** · _Thumbnails_ — Es un tramite con YouTube, de Martin o del Cerebro; tarda dias y la constante es una sola linea.
- **YouTube en Spy: la enmienda III.L** · _Competitors Spy_ — Decision legal de Martin
- **El cron de snapshots (la historia diaria, Etapa 2) no existe** · _Competitors Spy_ — El documento que lo pide es del 31/10 (anterior al 1/11). Despues entro el cron `spy-todo` (4/11), que avanza la traida larga cada hora: hay que decidir si eso 
- **«Seguir a este» desde una pieza** · _Competitors Spy_ — Viene del relevamiento del 31/10 (anterior al 1/11) y la ficha se rediseno entera despues: puede haber quedado descartado y no haberse tachado. Hay que pregunta
- **La galeria publica de plantillas y las tendencias del nicho (Etapa 5)** · _Competitors Spy_ — Depende del cron de snapshots. Documento anterior al 1/11: no pude confirmar que siga en el plan de Martin.
- **La galeria de anuncios con riel de filtros (lo que se copia de athm793/meta-ads-scraper)** · _Competitors Spy_ — Documento del 31/10. Despues (3-4/11) los anuncios entraron a Contenido con su filtro y su múltiplo: puede que ya alcance.
- **El rediseno del modal de «nuevo competidor» (#8): parece hecho, nadie lo confirmo con Martin** · _Competitors Spy_ — Lo cierra Martin mirandolo. El pendiente que lo reclama es del 2/11, anterior al rediseno del 4/11.
- **Los 598 carruseles escondidos no los confirmó nadie, y el deshacer vive fuera del repo** · _Carruseles_ — Martín tiene que mirar la curaduría: él pidió «solo carruseles que le sirvan a dueños de negocio» y se escondió el 43 % de la biblioteca con un modelo barato.
- **El «tema» (finanzas, salud, marketing…) no se clasifica, así que falta ese filtro de la referencia** · _Carruseles_ — Es gasto de IA por pieza: lo decide Martín.
- **El tipo de 1.213 carruseles sigue vacío y sólo las láminas lo dirían** · _Carruseles_ — Depende de las láminas, que están trabadas por el crédito de Apify.
- **Sumar más cuentas a la biblioteca, también las de los referentes del Ops Center** · _Carruseles_ — Gasta credito de Apify (ver el item de laminas)
- **Faltan las láminas de 1.275 carruseles y la corrida corta por crédito de Apify** · _Carruseles_ — En Apify quedan US$1,99-2,21 y la reserva de Spy es de US$2: hace falta otra clave de Apify cargada en Spy del negocio de la plataforma (ws 9). La clave sdae… t
- **Curar la biblioteca de Thumbnails después de cargarla** · _Thumbnails_ — La clave de Apify de Spy del negocio de la plataforma (ws 9) tiene US$2,21 libres y la reserva de Spy es de US$2: queda US$0,21 y la corrida corta enseguida. Ha
- **1 de los 245 links de Top Carousels sin leer y 26 creadores de la lista sin leer** · _Carruseles_ — Mismo crédito de Apify que las láminas: con US$0,21 libres por encima de la reserva no hay con qué leer.
- **Faltan 111 carruseles sin láminas y el script cortó «al techo» con US$0,54 de 1,50 sin explicar por qué** · _Carruseles_ — La reserva de Spy es de US$2 y en la clave principal de Apify quedaban US$1,99: el comando no arranca. Hace falta otra clave de Apify en Spy del negocio de la p
- **Salud, nutrición, café y déficit de atención quedaron a la vista por la duda** · _Carruseles_ — Es una decisión suya de criterio, no de código.
- **Una biblioteca de anuncios para TODOS los negocios necesita cuenta paga y permiso de reventa** · _Carruseles_ — Es una compra y un permiso de reventa: sólo Martín.
- **Probar en pantalla los 9 pasos de carruseles de Image en el ws 3, con la sesión de Martín** · _Carruseles_ — Pide su sesión en el navegador: está en la lista «SÓLO MARTÍN» del relevo de la PC.
- **Las capturas de Top Carousels nunca llegaron: la pantalla se copió de la descripción del pedido** · _Carruseles_ — La nube no abre el sitio y Top Carousels no se raspa (sus terminos pueden cerrar la cuenta): las capturas las saca Martin
- **Llevar un carrusel al Web Generator «como presentación» no funciona y sigue sin diagnosticar** · _Carruseles_ — No se entiende de que pantalla hablaba (llamada del 30/10)
- **Quitar fondo esta APAGADO: falta alojar el modelo y prenderlo** · _Editor de imágenes_ — Martin tiene que decidir si se aloja un modelo (es la pregunta «un modelo para quitar fondo de objetos» que quedo abierta el 14/10 y nunca se contesto).
- **Las plantillas reales de Image abren con marcos vacios «Tu foto»** · _Editor de imágenes_ — Las 5 fotos de muestra no estan elegidas y nadie las eligio a mano todavia (docs/plantillas-reales/README.md:396).
- **Las fotos desde el chat nunca se vieron en el editor completo con la IA de verdad** · _Editor de imágenes_ — Gasta IA del negocio de prueba; el ws3 no tiene IA conectada, hay que usar el ws9.
- **La marca del negocio en Image: nadie la vio en un navegador ni con un manual real** · _Editor de imágenes_ — Pide una sesion de Martin en produccion y un manual de marca de verdad. Martin lo revisa el.
- **Verificar en produccion el editor angosto (barra fijada + chat) y el telefono** · _Editor de imágenes_ — Hay que esperar el deploy de Vercel en Ready y entrar con una sesion que no sea de un cliente.
- **Quedan 56 defaults con Gemini en el catálogo de modelos** · _Editor de imágenes_ — Si el «sin Gemini» alcanza a los otros 56 defaults, lo define Martin
- **Decisiones de Martín del Image Editor: Doory, Unsplash y quitar fondos** · _Editor de imágenes_ — Es licencia y gasto: lo decide Martín
- **El typecheck completo del pre-push ya paga el port de Doory** · _Editor de imágenes_ — Es una decision de infra que Martin tiene que tomar: hoy el sintoma de que falta heap es un exit SIN errores impresos, que se confunde con un fallo de tipos.
- **Escribirle a Siam (autor de Doory) pidiendo licencia MIT** · _Editor de imágenes_ — Lo decide y lo manda Martin (o se lo autoriza a un chat).
- **Fotos de stock en el editor: Unsplash quedo prohibido y no hay reemplazo decidido** · _Editor de imágenes_ — Martin tiene que elegir la fuente de fotos (y si se paga una key).
- **Mirar en pantalla «Image» en todos los workspaces y el cartel «MaKo no pudo leerla»** · _Editor de imágenes_ — Pide su sesion en produccion
- **«Generar imagen con IA» por Google Flow en el editor de landing** · _Editor de imágenes_ — Martín eligió el camino (parchear la extensión) pero la medición previa en el Cliente de Prueba no se hizo.
- **El relevamiento de funciones de Canva se escribio sin navegar Canva, y quedo una pestania abierta** · _Editor de imágenes_ — Lo de la pestania es en la cuenta de Canva de Martin.
- **La pantalla de Imagen se rompe con la sidebar y el chat abiertos a la vez** · _Editor de imágenes_ — Leila dijo que puede depender de la pantalla de cada computadora; pide mirarlo
- **Que el Image Editor reemplace a Canva (stock, plantillas de carrusel, Image Generator)** · _Editor de imágenes_ — Decision D7f de Martin (las caras del elenco en Image)
- **«MaKo toma la iniciativa»: faltan las aperturas y los recorridos de casi todas las tabs** · _Chat de MaKo_ — El orden de las tabs que faltan lo decide Martín (figura en la lista de decisiones del 6/11)
- **El chat del lienzo reescribe una tarjeta no nombrada y le borra el link** · _Chat de MaKo_ — El arnes con IA real no se puede correr desde la nube: va desde la PC
- **El aviso por WhatsApp cuando un proveedor cambia algo, con cron diario** · _Chat de MaKo_ — El canal hay que redefinirlo: el WhatsApp saliente de MaKo se esta cortando
- **El barrido de horario de fábrica a los demás negocios no se corrió** · _CRM_ — Hay que esperar el horario diurno de cada negocio
- **P11: medir si el numero de Leila llega a 40 envios por dia** · _Chat de MaKo_ — No se puede separar hasta que haya filas con `automatico` cargado
- **AU4: ChatMako de Automations tiene que pasar a CajaChat + HiloMako y la estrella CONVIVE, no reemplaza** · _Chat de MaKo_ — Espera que AU2 este en main.
- **Cuando IA16 entre a main hay que sacar cuatro ramas de `sinIAPropia` que ya no pueden pasar** · _Chat de MaKo_ — Espera que IA16 este en main (estaba retenido hasta que el ws1 conectara su IA).
- **«Nada por detras»: quedan envios fuera de las automatizaciones** · _Chat de MaKo_ — El chat «Nada por detras» figura «waiting on a human»; y antes de prender `reunion_tareas_al_plan` hay que excluir al ws13
- **El horario de 10 a 20 no se barrió a los demás negocios** · _Chat de MaKo_ — Se corre de día en México (hay que esperar la ventana horaria para no frenar a nadie de golpe ni mandar lo acumulado junto).
- **MaKo está muda en 8 de 14 grupos de WhatsApp** · _Chat de MaKo_ — Hay que rehacer los grupos con su teléfono
- **Corte de grupos de WhatsApp y que MaKo nunca escriba primero** · _Chat de MaKo_ — Prender el bot o cortar los grupos no se hace sin su si
- **Brigitte (ws15): devolverle la espera de 1 h y el recordatorio en «Un Lead Entro 2»** · _Chat de MaKo_ — Pide su si para escribir en produccion, y el email de Brigitte lo tiene Martin o Joan
- **La agencia de Joan no entra sola a los grupos de WhatsApp de sus clientes nuevos** · _Chat de MaKo_ — Prenderla es decision de Martin (riesgo de ban)
- **C4: un borrador de una automatizacion PAUSADA sigue frenando el envio** · _Chat de MaKo_ — Decision del chat de Automations o de Martin
- **Una automatizacion sin disparador se prende y queda callada** · _Chat de MaKo_ — Es una decision de comportamiento
- **LinkedIn en Chats y en Automations: decidir el camino** · _Chat de MaKo_ — Decision de Martin, pendiente desde el 29/10
- **Acciones de Calendly para crear o editar eventos** · _Chat de MaKo_ — Decide Martin si se cierra como imposible
- **La logica del embudo de Black November con Leila** · _Chat de MaKo_ — Es trabajo entre Martin y Leila
- **Dos decisiones abiertas del anti-ban de WhatsApp** · _Chat de MaKo_ — Cambiar las reglas de las líneas de los clientes les cambia la prospección: no se toca sin su sí.
- **Las secuencias de los clientes están creadas EN PAUSA y nadie las activó** · _Chat de MaKo_ — Activar manda mensajes a clientes reales: lo firma Martín.
- **Un negocio que sólo usa Instagram no inscribe a nadie por cohorte** · _Chat de MaKo_ — El documento dice que decidir si esa rama inscribe es de Martín.
- **Un paso de un canal apagado se marca 'omitido', AVANZA y la inscripción es una-vez-en-la-vida** · _Chat de MaKo_ — Es una decisión de semántica de producto; el documento la deja abierta.
- **No llega ningún email de verdad: falta prender «Receiving» en Resend y el MX** · _Chat de MaKo_ — El documento dice «Lo decide Martín» (toca la configuración del dominio).
- **equipo@hola-mako.com probablemente NO recibe, y tres textos mandan ahí** · _Chat de MaKo_ — Es un trámite en el panel del registrador: lo hace Martín.
- **El aviso de 30 minutos al dueño sólo corre con Calendly: el ws13 (Cal.com) no lo recibe** · _Chat de MaKo_ — Extenderlo manda avisos nuevos a clientes reales.
- **Ocho audios de Martin y de Leandro sin transcribir** · _Chat de MaKo_ — Los archivos viven en la PC (~/.claude/operaciones/adjuntos y el buffer): la nube no los ve
- **La nota de voz nativa de WhatsApp necesita un encoder OGG/OPUS del lado del cliente** · _Chat de MaKo_ — Entrada de 2026-06-23; no pude confirmar si sigue abierto después del cambio de canal a Evolution.
- **Los PDF no se previsualizan y «Ocultar contacto» no oculta nada** · _Chat de MaKo_ — Reportes de julio de 2026; no pude confirmar contra el código si siguen.
- **Falta el chat del cobro de agencia completo: el PDF por WhatsApp, el diferencial y las suspensiones** · _Cobros y planes_ — Hay que arrancar un chat nuevo en un turno de Martín: un turno automático no puede crear chats en la app
- **La plantilla y el registro de recibos en SuperAdmin** · _Cobros y planes_ — Lo tiene que arrancar un turno de Martín: desde un turno automático la app no deja crear el chat
- **El cron `agencia-mensualidad?dry=1` nunca se corrio en seco** · _Cobros y planes_ — Lo tiene que correr quien tenga el CRON_SECRET
- **Tres bajas y una media del cobro de agencias viven en una rama y no se pueden tocar desde main** · _Cobros y planes_ — El código vive en la rama agency-thiago-2910 y no está en main.
- **Elegir el proveedor de cobro que reemplaza a Creem** · _Cobros y planes_ — Es la decisión de Martín, y sin pasarela no hay cobro en línea
- **Nada prueba que equipo@hola-mako.com reciba, y ahí llega la respuesta de Whop** · _Cobros y planes_ — El panel de Porkbun y el Gmail son de Martín
- **Los tres cortes de plata siguen apagados desde la revisión del 17/10** · _Cobros y planes_ — Toca plata y pide el sí de Martín más una revisión adversarial con otra cuenta
- **El secreto del webhook de Mercado Pago y un pago real de prueba** · _Cobros y planes_ — Son claves y una compra real: sólo Martín
- **Stripe en modo real y precios en EUR (cobrarle a la agencia de Thiago en Espania)** · _Cobros y planes_ — Es su clave y el precio en euros es plata: lo decide y lo carga Martin
- **La cuota en pesos cobrada entera con dolares declarados a otra tasa** · _Cobros y planes_ — Es una decision de plata de Martin
- **El precio en pesos sigue fijo al dolar blue del 31/10** · _Cobros y planes_ — Dos chats figuran «waiting on a human»: solo Martin los destraba
- **Martin tiene que cargar su usuario de Binance en /admin/cobros** · _Cobros y planes_ — Es su dato
- **Mercado Pago de MaKo en el ws 9 y el precio en pesos del cliente de agencia** · _Cobros y planes_ — El secreto del webhook y el pago real son suyos
- **Los cortes siguen apagados desde la revision del 17/10** · _Cobros y planes_ — Prenderlos corta el acceso a clientes: lo decide Martin
- **Decisiones de plata abiertas (Partners, reembolso, Acelerador, Mexico)** · _Cobros y planes_ — Son todas decisiones de precio
- **Los planes en ARS y MXN no tienen precio local, así que Mercado Pago no se ofrece en /planes** · _Cobros y planes_ — Es un dato de precio: lo define Martín.
- **Cliente de agencia: MaKo (ws9) no tiene Mercado Pago conectado ni precio en pesos** · _Cobros y planes_ — Hay que conectar una cuenta real de pasarela: es de Martín.
- **Newsletter: M1 y las tres fallas de envio** · _Cobros y planes_ — Hoy sin riesgo: ningun negocio tiene el email prendido
- **Cargar los recibos 0001 y 0002 y probar la carrera de `emitir_recibo`** · _Cobros y planes_ — El relevo es del 5/11 y la 0397 ya está aplicada; no hay registro de que la carga de 0001/0002 se haya corrido ni de que no. Hay que mirar Billing › Recibos ant
- **Prender el corte de acceso por falta de pago (CORTE_DE_ACCESO_PRENDIDO) con la 0330 aplicada** · _Cobros y planes_ — Entrada del 23/10/2026; no pude confirmar si se prendió después del 1/11.
- **La baja del plan corta la PLATA pero no el ACCESO** · _Cobros y planes_ — Entrada del 04/10/2026; una fila posterior de la misma tabla dice que el estado de suscripción por workspace sí se hizo el 17/10, así que puede estar resuelto e
- **La tab Pagos de Customer Success sigue montando DealDetailsCard** · _Cobros y planes_ — Otra entrada del 17/10 (docs/hallazgos-customer-success.md:5665) dice que la tab Pagos de CS ya pasó a bloques y que DealDetailsCard se borró: los dos documento
- **`wa_mensajes.automatico`: 76 filas quedaron como «persona» y pueden contaminar el primer contacto de Código** · _SuperAdmin_ — Depende de saber la hora exacta del deploy, que no se ve desde la PC
- **Black November de Leila: el segundo nombre y las cinco piezas que lo bloquean** · _CRM_ — La lógica del embudo (5.6) NO es código: Leila necesita que Martín la ayude a definir condiciones y etiquetas
- **Decidir si ganar en un funnel agregado cuenta como venta** · _CRM_ — Es la decisión de producto de Martín; sin eso el motor no se puede escribir
- **El alta del CRM usa solo la clave 1 de Apify: si se agota, deja de leer el @ mientras Spy sigue** · _CRM_ — Es plata del negocio y contradice el brief original: lo decide Martin.
- **C11: la etapa de un CRM agregado no se deriva y «Mover a Ganado» no registra la venta** · _CRM_ — La decision «ganar en un funnel agregado es venta» es de Martin
- **Plan de pagos quincenal de Nadia (lead 2605, ticket #13)** · _CRM_ — El ticket #13 esta en `esperando_decision`: aprobarlo o cerrarlo escribe en produccion
- **El tutorial de LinkedIn para importar el Connections.csv no se escribió** · _CRM_ — Hay que decidir si LinkedIn entra como canal del CRM antes de escribir el tutorial.
- **Los ganados y perdidos del CRM anterior vuelven como descartados** · _CRM_ — Dos decisiones de producto: la fecha de cierre y si entran a Customer Success.
- **El `case 'funnel'` del onboarding existe y nadie lo llama: el funnel no se siembra con el canal elegido** · _CRM_ — Documento anterior al 1/11: confirme que el `case` existe, no que siga sin caller (hay que buscar quien lo invoca antes de escribir).
- **Cargar la biblioteca de Thumbnails desde la PC: descubrir y leer (la migracion 0409 ya esta aplicada)** · _Thumbnails_ — Solo se puede desde la PC: la nube no llega a la YouTube Data API ni a la base. `descubrir` gasta del balde de search.list, que son 100 llamadas por dia para TO
- **«De tus cuentas» en Thumbnails: dos documentos del mismo dia se contradicen** · _Thumbnails_ — Decisión de producto, no de código.
- **«Editar» contestaba «Tu IA no contesto ahora» en produccion: falta comprobar el arreglo** · _Thumbnails_ — Hay que mirarlo en produccion con una sesion que no sea de un cliente.
- **Probar en pantalla la pestania Thumbnails y el «Editar» que dejo la nube** · _Thumbnails_ — Depende de que primero este cargada la biblioteca
- **La foto de Ximena Fukuda es una toma de escenario y su parecido es el más flojo** · _Thumbnails_ — El nombre no se puede confirmar desde el repo: se confirma con él o con su sitio.
- **Tres operaciones del chat llegan al Video Editor por primera vez y pueden romper** · _Editor de video_ — El codigo vive en app/video-editor: es del chat de Video, aunque el hallazgo salio del de Image.
- **Nada del Video Editor se miró en un navegador, y la rama no se pudo pushear** · _Editor de video_ — La PC de 16 GB no levanta el dev server del editor con otros chats compilando, y el typecheck bloqueó el push de la rama video-editor.
- **Motion sigue suspendido a proposito y su rama sin subir** · _Editor de video_ — Suspendido por decision; se retoma cuando Martin lo diga
- **Terminar de copiar CapCut: faltan 40 de 158 funciones y la musica de biblioteca** · _Editor de video_ — La licencia de musica de cada cliente la decide Martin (D7g)
- **La generacion de video de punta a punta nunca se probo en vivo** · _Editor de video_ — Hace falta que Martin genere un look real en el ws3 (destraba tambien /planes y la tarjeta de la landing)
- **El worker del montaje quedó muerto: sin contenedor y sin probar de punta a punta** · _Editor de video_ — Provisionar el contenedor necesita la cuenta de Martín, y borrar o conservar es una decisión suya.
- **AI Avatar: la voz clonada existe sólo en scripts/ y convertirVoz no tiene llamador** · _Editor de video_ — El motor de retrato + audio es gasto de medios de la plataforma: es una decisión de precio de Martín.
- **AI Avatar se abrió a los tres planes sin probarlo de punta a punta con un look real** · _Editor de video_ — Pide Chrome con la extensión, sesión de Google Flow con una cuenta que paga créditos y una foto: lo hace Martín.
- **Subtitulos, B-roll, clips y presets: entraron a produccion el 6/11 y nadie los vio** · _Editor de video_ — La tanda 5 del Video Editor en Chrome esta «en pausa por el»
- **Los subtitulos siguen sin habilitar: `timestamp_granularities` no esta en lib/transcribe.ts** · _Editor de video_ — El pedido viene de un documento anterior al 1/11; la ausencia del parametro si la confirme, pero no que siga siendo lo que Martin quiere.
- **Mirar en pantalla todo lo que se desplegó sin que nadie lo vea** · _SuperAdmin_ — Pide su sesión: la entrada es con Google y el navegador de la app pide el segundo paso
- **Decidir con Martín la pestaña «Tablero» de la ficha de cliente en Admin** · _SuperAdmin_ — Es una decisión de producto sobre qué muestra esa pestaña.
- **Abrir el Runner en cada cuenta y pegar el Token de cada dispositivo** · _SuperAdmin_ — Lo hace Martín en su terminal; además la opción C (un hook con asyncRewake) necesita su OK porque es configuración.
- **Ticket #58: agendar el pago de la segunda cuota de Giselle Belanti para el 19/12** · _Tickets_ — Espera el arreglo del eco (`punta/doer-eco-dos-lineas`)
- **Los tickets #50, #51, #52 y #53 están en manos de otro agente** · _Tickets_ — Están asignados a otro agente y el chat de tickets tiene orden de no tocarlos hasta que el Cerebro los pase.
- **#43: la decisión de Martín y el camino cross-tenant para cargar un documento al cerebro de un cliente** · _Tickets_ — Toca el aislamiento entre negocios: no se escribe sin la decisión
- **Verificar los correos de avance en producción y que nadie reciba de más** · _Tickets_ — El commit dbc64bdd7 dice que la 0364 está aplicada, pero no está en la tabla de migraciones del Cerebro y nadie lo midió.

## De octubre, verificar antes de tocar (61)

- Elementos de marketing en las landings: cuenta regresiva, prueba social, escasez · _Varios_
- Mobile: las pantallas que siguen diciendo «En la computadora» · _Varios_
- Web Generator: dibujar a 1440 escalado y lo FIJO del menu, que quedaron sin hacer · _Varios_
- Posible cruce de datos entre workspaces en el video generator · _Varios_
- La vista previa del PDF en el chat de MaKo saca de la tab · _Varios_
- Nombres y fotos de los contactos de Evolution en el onboarding del Chat Agent · _Varios_
- C16: «Por tiempo» agenda al instante al elegirlo · _Varios_
- Zernio, tanda C de la deprecacion del token · _Varios_
- Los 14 pedidos de Ads Manager y Marketing CoPilot anotados sin repartir · _Varios_
- Dashboards: cinco restos anotados para otro chat · _Varios_
- Tutoriales y recorridos por tab (promesa a Teo) · _Varios_
- Sacar a un alumno del producto y de todos los cursos · _Varios_
- Que todo lo que MaKo arma por prompt se vea construyendose, en toda la app · _Varios_
- Las iniciales con emoji rompen pantallas (React #418) en otras tabs · _Varios_
- Quitar «Cliente de Diseno», que comparte pixel y tokens con Mauricio · _Varios_
- Onboarding para todos los nichos que no deje avanzar sin el setup · _Varios_
- Landing principal #32 con la frase nueva, como borrador sin publicar · _Varios_
- Landing que hace pruebas A/B sola · _Varios_
- Revision completa de la API de MaKo: faltan acciones · _Varios_
- El Ops Center elige modelo y esfuerzo por fase, con el consumo medido · _Varios_
- Que MaKo corrija o recuerde un dato del perfil desde el chat · _Varios_
- Usar los ganadores de Ads Analyst y etiquetar anuncios externos al generar guiones · _Varios_
- Restos del Copywriter que quedaron al archivar el chat · _Varios_
- Migrar la landing de Mauricio de Lovable a Vercel · _Varios_
- Branding MaKo: animaciones crudas aparte y preview de PNG · _Varios_
- `tipos-respaldo-push.mjs` espera RAM con el lock de tipos ya tomado · _Infraestructura_
- Revision de eficiencia de toda la app y prueba de carga · _Infraestructura_
- Las piezas de Spy sin el multiplo de rendimiento («3,7x») · _Competitors Spy_
- La tanda del 4/11 de Martin en Spy, sin confirmar en pantalla · _Competitors Spy_
- Las cuentas que el negocio sigue SÓLO para carruseles siguen entrando por Competitors Spy · _Carruseles_
- Los pedidos de carruseles del 5 y 6/11 de Martin, sin confirmar uno por uno · _Carruseles_
- Image Editor: las funciones de Canva que faltan y las fuentes en un CDN ajeno · _Editor de imágenes_
- `fflate` local quedo en 0.4.9 y el package.json pide ^0.8.3 · _Editor de imágenes_
- CR1 del recorrido visual: dos documentos del 6/11 no coinciden sobre las miniaturas en blanco de Image · _Editor de imágenes_
- Plantillas propias en Video e Imagen, y compartirlas con la comunidad · _Editor de imágenes_
- El Image Editor guarda solo una miniatura del diseno, no la imagen · _Editor de imágenes_
- El chat de MaKo dentro de las tabs de Video e Imagen (pedido del 27/10) · _Editor de imágenes_
- El eco de MaKo con dos líneas en un grupo, y el diseño de grupos tipo WhatsApp · _Chat de MaKo_
- Joan pidio dos cosas en su grupo y nadie le contesto · _Chat de MaKo_
- MaKo mando al grupo de Codigo un link con un dominio inventado · _Chat de MaKo_
- El vigia de MaKo en todos los grupos: vencio el 27/10 y no consta recreado · _Chat de MaKo_
- Un lead borrado se lleva en cascada sus envíos y no queda quién lo borró · _CRM_
- A1 de Codigo: la metrica de tiempo de respuesta de leads (primer contacto) · _CRM_
- El opt-in con lead duplicado pierde el `visitor_id` · _CRM_
- El scrapeo de grupos cae en un funnel por defecto · _CRM_
- Lead Fabi Pedraza: los datos fiscales no se pueden cargar y falta adjuntar la constancia · _CRM_
- Los 61 de 341 pedidos de disenio del CRM sin implementar · _CRM_
- Chats en el telefono: el super admin no puede cambiar entre su numero y el de MaKo · _CRM_
- Migrar lo que Leila paga aparte (GoHighLevel por API, Skool) · _CRM_
- Paso 3 del Video Editor (la cabecera) quedo trabado · _Editor de video_
- Los proyectos del Video Editor viven en el navegador y no hay tope por plan · _Editor de video_
- Editar un video pedido por chat, renderizando en un servidor de MaKo · _Editor de video_
- Ticket #15: el Video Editor no importa un mp4 de Leila · _Editor de video_
- La ruta /offer sigue existiendo, y Martín pidió que no exista · _SuperAdmin_
- El clic en un coach no abre nada sin conversación previa · _SuperAdmin_
- Los pedidos viejos de la pestania Clientes y el semaforo de Admin · _SuperAdmin_
- #46 de Leila: MaKo niega cambiar el precio de su oferta y sí puede proponerlo · _Tickets_
- Los tickets #47 y #48 nunca se leyeron · _Tickets_
- Medir el tiempo de cada ticket, con alerta a las 24 h · _Tickets_
- Tickets sin cierre registrado: #11, #12, #21 y #22 · _Tickets_
- Ticket #57 / Funnel Coach: `punta/ticket-57` choco al llevarlo a main · _Tickets_

## Ya hechas (11)

- Falta la página propia de «no encontrado»** · _chico_ · ✅ **HECHO el 7/11/2026 — `0d3cbb056` — el inventario ya lo marca hecho
- Mediciones de produccion sin correr (P12, P13, P14, P16) — el inventario ya lo marca hecho
- Los items f11, f18, f19, f22, f30 y f34 de la llamada con Leandro, sin repartir** · _mediano_ · 🟡 **DOS YA ESTABAN HECHOS (verificado el 7/11/2026 — `9b90b89d4`) — el inventario ya lo marca hecho
- El indice de hallazgos tiene filas duplicadas** · _chico_ · ✅ **YA ESTABA HECHO (verificado el 7/11/2026 — `8cd255a3c`) — el inventario ya lo marca hecho
- Cuenta regresiva, pops de prueba social y escasez en las landings** · _mediano_ · ✅ **YA ESTABA HECHO (verificado el 7/11/2026 — `9a617e8aa`) — el inventario ya lo marca hecho
- El logo real de Meet (y los logos dibujados a mano)** · _chico_ · ✅ **HECHO el 7/11/2026 — `d607c3951` — el inventario ya lo marca hecho
- Los patrones de email nunca se comprobaron en uso** · _mediano_ · ✅ **COMPROBADO el 7/11/2026 — `60e608d44` · LA RESPUESTA ES QUE NO SE USAN — el inventario ya lo marca hecho
- High ticket: medir si los cursos cubren anuncios para servicios caros** · _mediano_ · ✅ **YA ESTABA HECHO (verificado el 7/11/2026 — `bb8127eb2`) — el inventario ya lo marca hecho
- La alarma de minutos de GitHub Actions es falsa y da rojo todos los días — un commit del 6-7/11 dice casi lo mismo: «Revisada 2 de 5: la alarma de minutos de GitHub da rojo todos los dias y es falsa»
- Lo capturado con la extension no alimenta la lectura de su oferta — un commit del 6-7/11 dice casi lo mismo: «Una pagina capturada con la extension alimenta la lectura de su oferta»
- Siete pendientes de la Ticketera, con su archivo — un commit del 6-7/11 dice casi lo mismo: «Ticketera: la bandeja dice «Entregado al Cerebro» también de un ticket que espera a Martín»

