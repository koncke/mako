# Barrido de pendientes — 6/11/2026 (nube)

Martín, 6/11/2026: «avanza con absolutamente todo el resto de cosas que teníamos pendientes... Revisa todo... no me pidas
permiso». Este archivo es el registro de ese barrido. **Se mantiene al día en cada tanda.**

## Cómo se armó, y lo que NO se midió

- Base: `main` = `4d095e31` (6/11/2026). El clon de la nube es **shallow** (301 commits): `git log` no llega antes del 4/11,
  así que la vigencia se midió contra el CÓDIGO (que exista la función, el flag, el test), no contra la historia.
- Fuentes leídas: `docs/pendientes.md` (entero), los `docs/relevo/*.md` (sus secciones de «falta», «sin hacer», «queda»),
  los «Sin hacer» de `docs/hallazgos-*.md` de las últimas dos semanas y las `PARTES` de `app/admin/dev/*/bitacora.ts`.
- **No medido:** la base de producción (si una migración está aplicada, qué filas hay), lo que vive sólo en la PC de Martín
  (ramas locales, worktrees sin commitear, `C:/dev/revisiones/…`), y de los hallazgos ~45 de ~350 entradas «Sin hacer»
  (las más nuevas). `docs/relevo/chatbot.md` y las partes viejas de `crm.md` se recorrieron por títulos.
- Tipos: **CÓDIGO** (se arregla en el repo sin producción ni decisión), **PROD** (migración, base, claves, mirar producción),
  **MARTÍN** (decisión o acción suya), **OTRO CHAT** (la tab Admin `app/admin`, carruseles, dashboards, Marketing CoPilot,
  Ads Manager, cobro de agencias: no los toca este barrido).
- Orden: cliente roto > plata, seguridad y envíos > lo que traba > features > pulido.

## Hecho en este barrido

| Tanda | Qué | Dónde | Punta |
|---|---|---|---|
| 1 | El aviso «en 30 min tienes la reunión» al dueño ahora también sale con Cal.com (antes sólo Calendly) | app/api/cron/reunion-recordatorio/route.ts | `punta/barrido-envios` |
| 1 | «Apaga el aviso X» por MaKo apaga de verdad (escribía un campo que el envío ya no lee) | lib/api-mako/areas/equipo.run.ts | `punta/barrido-envios` |
| 1 | Si la IA no redacta un aviso, ya no sale el ejemplo de fábrica (reunión inventada, link a un lead ajeno) | lib/plantillas.ts · lib/aviso-sin-ia.ts | `punta/barrido-envios` |
| 1 | Un borrador de WhatsApp cortado por tiempo queda «incierto» y no se manda dos veces | lib/evolution-envio.ts · lib/chats-envio-reglas.ts | `punta/barrido-envios` |

| 2 | Customer Success: el alta de un cliente y la de un alumno frenan por el tope de leads del plan (la API ya lo hacía) | app/customer-success/actions.ts · app/customer-success/curso/invitar-actions.ts | `punta/barrido-envios` |

| 3 | «No reprodujo el VSL» y la cohorte «vio poco el VSL» no se cumplen para todos con la base caída (la lectura del motor es estricta) | lib/leads.ts · lib/nutricion.ts | `punta/barrido-envios` |
| 3 | Cambiar el precio de un producto por MaKo: el título de /mako/revisar dice también el precio de antes, y el producto queda fijo al revisar | lib/producto-precio-texto.ts · lib/api-mako/areas/crm.run.ts · crm.def.ts | `punta/barrido-envios` |
| 4 | Lo que encontró el revisor (ver «Autocrítica») | varios | `punta/barrido-envios` |
| 5 | El aviso de WhatsApp caído dice cuál número se cayó (el webhook lo guarda antes de borrarlo; sin migración) | app/api/webhooks/evolution/route.ts · lib/linea-vigilancia.ts · lib/lineas-vigilante.ts | `punta/barrido-envios` |

**Subido el 6/11/2026** a `punta/barrido-envios` (cabeza `8447634b6`, veredicto en verde: 8143 tests de 815 archivos y el tsc
entero). ⚠️ El hook de pre-push NO estaba instalado en este clon de la nube: las guardas corrieron a mano
(`sh scripts/guardas-push.sh`) antes del veredicto, y el hook quedó instalado después.

| 6 | **Pagos:** la renovación de Stripe (mes 2+) cuyo aviso se perdió entra sola, una vez por día: las de 4 a 14 días con el mismo id que el aviso; las más viejas, un ticket | lib/cobros.ts · lib/cobros-eventos.ts · lib/cobro-sesion-ajena.ts · el cron de cobros | `punta/barrido-envios` (2ª subida) |
| 6 | **MaKo Partners:** una cookie de un código muerto ya no le quita la venta al partner del link de hoy | app/r/[codigo]/route.ts · lib/partners-reglas.ts · lib/partners-programa.ts | ídem |
| 6 | **Automations:** «Responder» con el clic derecho en el chat con MaKo, sin interpretar lo citado como un pedido | app/automations/ChatMako.tsx · ChatMakoVista.tsx | ídem |
| 6 | **Seguridad:** el script en seco de las fotos huérfanas del bucket público `avatars` (lo corre el Cerebro: P16) | scripts/avatars-huerfanas.mts · lib/avatars-huerfanas.ts | ídem |

| 7 | **API de MaKo:** `guardar_landing` marca o desmarca la página de gracias (la pantalla podía, la API no) | lib/api-mako/areas/landing.def.ts · landing.run.ts | `punta/barrido-gracias` |

**La tanda 6 subió el 6/11/2026** a `punta/barrido-plata` (cabeza `868239ebb`, veredicto en verde: 6791 tests de 695 archivos y el
tsc entero). La tanda 5 (`punta/barrido-envios`) ya está en main. ⚠️ El primer intento del push dio 18 rojos de mentira: el hook usa
el Node del shell (22); con el Node 24 en el mismo comando, 92 de 92 en verde (docs/hallazgos-infra.md).

Lo de plata de la tanda 6 pasó una **revisión adversarial de dos vueltas** (un agente que no escribió el código): ver «Autocrítica».

La cosecha: docs/hallazgos-comunicacion.md → «Tres avisos que mentían o se podían duplicar» y docs/hallazgos-chatbot.md →
«"No reprodujo el VSL" se cumplía para TODOS con la base caída».

## Autocrítica (regla del 6/11/2026)

Un lector que no escribió el código revisó las tandas 1 a 3 antes de subirlas. Lo que encontró y se cambió:
- La lista de avisos apagados de MaKo leía la vista del cliente, que viene vacía: un aviso apagado no aparecía nunca. → la de la agencia.
- Prender por WhatsApp un aviso apagado entero revivía su email. → sólo WhatsApp.
- Sin datos del evento, el aviso sin IA volvía a mandar el ejemplo inventado; y «Probar» mostraba la instrucción al modelo. → `''` y
  `muestra`; un ejemplo con variables cuenta como propio.
- El borrador «incierto» no contaba para el tope de 24 h ni el goteo. → lleva `enviado_at` y `enviado_por`.
- El freno de Customer Success miraba `usarLeadId == null` y la lib reusa con `> 0`: un `0` se salteaba el freno. → la misma condición.
- La cohorte del VSL estricta cortaba todas las automatizaciones y los envíos del negocio. → saltea sólo esa automatización.
- El título «2000 → 200» quedaba viejo si se corregía el monto en el formulario, y el producto se podía cambiar. → «200 USD; antes
  2000 USD» (lo de antes no cambia) y el `id` fijo al revisar.

Y la tanda 6 (plata), dos vueltas del mismo revisor. La primera encontró tres cosas, cambiadas antes de subir:
- Una venta externa en pesos nace sin valor en dólares: el CRM no le escribe la cuota y la red la volvía a aplicar cada día
  (reescribiendo el `motivo` del cobro) y abría un ticket falso. → se descarta con `montoUsdDeLaCuota`, el mismo cálculo.
- Con un `.limit` antes del filtro y el mismo orden cada día, las suscripciones más nuevas (las del 2º mes) no se miraban nunca. →
  se leen todas, se filtran antes y se arranca por otra cada día.
- En `/r`, la lectura de los códigos ANTERIORES se tragaba el error: con la base caída, el código viejo de un partner contaba como
  muerto y otro link le pisaba la cookie. → sólo la tabla que falta es «ninguno»; ejecutado con una base de mentira.
- Y de lo «plausible»: el margen de 2 h dejaba que el reintento de Stripe (3 días) volviera a disparar el CRON «Pagos» del lead. →
  4 días (el costo, dicho por el revisor: un cliente con el aviso perdido figura en mora 4-5 días en vez de menos de 1; no le cobran
  dos veces ni lo pausan). Los cobros con el primer pago devuelto, adentro.
La segunda vuelta: «nada importante». Lo que quedó afuera, a propósito, en docs/hallazgos-pagos.md y hallazgos-partners.md (el orden
de los NEGOCIOS en la vuelta del día; una cookie de quien nunca terminó el alta de partner).

Descartado a propósito: frenar el tope DESPUÉS del chequeo de duplicados en Customer Success (hoy un alta en el tope que es un
duplicado recibe el tope y no «usar ese»): el CRM y la API frenan en el mismo orden; cambiar los tres es otra tanda. Y el «Pasar a
Pro» del commit de la tanda 2 no se ve: Customer Success devuelve el texto sin `pasarAPro` y su pantalla no dibuja ese botón.
Sin capturas: los cambios son de texto de avisos y de servidor, no de pantalla.

## Cola de CÓDIGO que hace este barrido (vigente, en orden)

| # | Qué | Archivo | Prio | Estado |
|---|---|---|---|---|
| C1 | El aviso de línea CAÍDA no puede nombrar el número: el webhook y `desconectar()` borran `numero` | app/api/webhooks/evolution/route.ts:176 · lib/evolution.ts | 3 | **HECHO** (tanda 5), sin migración: un setting `wa.linea.ultimo_numero.<línea>` que el webhook escribe antes de borrar |
| C2 | `crearClienteAction` (Customer Success) no frena por el tope del plan; la API sí | app/customer-success/actions.ts | 2 | **HECHO** (tanda 2) |
| C3 | `embeddings` gasta IA sin `recordUsage` (no se ve en el Uso) | lib/embeddings.ts | 4 | medido: `transcribe` ya va por `transcribirAudio`. Embeddings: una fila por vector llenaría la tabla del Uso (miles por ingesta) y entraría en la cuenta de cuota de las keys de Gemini → **decisión** de cómo registrarlo (agregado por día) |
| C4 | `tieneBorradorNutriPendiente` cuenta borradores de automatizaciones pausadas | lib/evolution-envio.ts | 3 | **decisión** (hallazgos-chatbot: «pausar no es archivar»): ¿un borrador de una pausada sigue frenando? → Automations / Martín |
| C5 | La etiqueta en lote corta en 200 sin avisar | app/api/crm/etiquetas/route.ts | 3 | **HECHO** antes (27/10: la barra manda de a tandas, `TANDA_ETIQUETAS_LOTE`) |
| C6 | Pixel de una landing dada de baja: la pastilla «desactualizado» queda para siempre; `snippetDesactualizado` sigue en 3 lectores | lib/landing-token.ts · lib/pixel-estado.ts | 3 | **HECHO** antes: `snippetDesactualizado` delega en `estadoPixel`, que mira las páginas con visitas (`paginasVivas`) |
| C7 | Cookie de un código de partner muerto tapa el link vigente | app/r/[codigo]/route.ts | 4 | **HECHO** (tanda 6, con revisión): era peor de lo anotado, `/r` ponía el código muerto también en `?ref=` y la compra quedaba sin partner |
| C8 | Plan: aviso cuando una reunión no se pudo leer | lib/reunion-auto.ts · lib/reunion-descartadas.ts | 3 | por medir |
| C9 | Una landing confirmada deja el lead sin `pagina_registro` | app/crm/revisar/[id]/propuesta-lead.ts | 3 | **HECHO** antes (propuesta-lead.ts:121 la copia normalizada) |
| C10 | El lead que pierde el compare-and-set de Zernio queda con `meta_ad_id` | lib/zernio-entrante.ts | 3 | **HECHO** antes (`quitarHuerfano` lo borra y le pasa el anuncio al ganador con `.is(null)`). Queda la otra mitad: el primer mensaje del anuncio llega SIN referral → **decisión** de atribución |
| C11 | La etapa de un CRM agregado no se deriva (agendar no lo mueve); los agregados entran por el barrido de la hora, no por evento; «Mover a Ganado» en un agregado no registra la venta | lib/lead-funnel.ts · lib/leads.ts | 3 | **OTRO CHAT (Automations) + MARTÍN**: es el motor y la decisión «ganar en un funnel agregado ¿es venta?» |
| C12 | Página propia de «no encontrado» (no hay `app/not-found.tsx`) | app/not-found.tsx | 5 | por medir |
| C13 | Restos: `TAB_DE_DATO` sin uso, `Lead` sin `suscripcion_cancelada_at`, código muerto de creativos | lib/datos-aviso.ts · lib/leads.ts · lib/creativo-mako-fuentes.ts | 5 | por medir |
| C14 | `'use server'` fuera del CRM sin `exigirSesion()` | app/**/actions.ts | 2 | **medido, sin agujero**: los 60 archivos tienen su puerta (`adminDeWorkspaceActual`, `puerta()`, `veEditorVideo`, `ctxDeBandeja`…); el de comunidad sirve al alumno a propósito |
| C15 | Responder con clic derecho en Automations (`useCitaDelChat`) | app/automations | 3 | **HECHO** (tanda 6) |
| C16 | «Por tiempo» agenda al instante al elegirlo (`CRON_DEFAULT`) | app/agencia/FlujoAviso.tsx | 3 | DUDA: la bitácora lo da como decisión 5.1 de Martín |

## Para OTROS chats (no los toca este barrido)

- **Admin (`app/admin`)**: Runway con foto del 3/10 (`app/admin/runway/datos.ts`); borrar el mazo viejo (`app/tickets/decisiones/Mazo.tsx`,
  `app/admin/runway/Tablero.tsx`); registro de acciones por usuario; historial de `/admin/dev`.
- **Ops Center** (vive en `app/admin/operaciones`): muñecos y «Renombrar» por fila (`munecosDeChats`); chat del grupo en la barra
  (`?grupo=1`, `grupoHilo`); riel «Lo que hizo» (`ListaAvance`, `GET ?hecho=`); retirar `/api/mako-doer`; las funciones del limbo
  sin pantalla (`originalParaReenviar`, `queHacer`); `CARTERO_VIVO_MS` derivado del intervalo real (lib/operaciones-reglas.ts:37,
  pide columna y cartero nuevo); adjuntos sólo foto y PDF; purga de adjuntos que nunca se mandaron.
- **Dashboards**: la hoja por fecha de cierre con funnel agregado (lib/graficos-datos.ts:256); `/api/graficos` acepta cualquier tablero
  en vista; bloques de General que no siguen los filtros; «Publicar en Creaciones»; plantillas de Instagram sobre fuente orgánica.
- **Ads Manager / Media Buyer**: probar contra Meta real (publicar, presupuesto, formulario, video); `lib/meta-ads-create.ts` con token;
  Zernio anuncios (`ZERNIO_ANUNCIOS_PROBADO`); `mb.css` en Ajustes y Automatizaciones; Ads Manager sin entrada en el catálogo de
  onboarding (#801); la tanda C de Zernio (editar público, crear campaña).
- **Cobro de agencias**: el precio en pesos del cliente de agencia y Mercado Pago de MaKo en el ws 9 (`/admin/cobros`).
- **Carruseles / Stories**: prompts de `lib/ig-writer.ts` hardcodeados (skill `add-editable-prompt`); historial en memoria.
- **Automations** (medido en la tanda 7, no tocado: es su galería y su motor):
  - **El aviso al negocio cuando le rechazan un pago** (decidido el 15/10, docs/relevo/landing-generator.md «Lo que sigue» 5): el
    motor ya tiene el CRON «Pagos: Se rechaza un pago» (`alCron(c, 'rechazado')` en `aplicarPagoFallido`, lib/cobros.ts) y el
    evento del lead; falta la PLANTILLA de la galería («Rechazaron un Pago», objetivo `cobrar`, con una tarjeta MaKo en WhatsApp
    al equipo, como `mako-pago`) — y la galería tiene su lista escrita a mano (`LAS_13`, tests/plantillas-automatizaciones.test.ts).
  - **Una automatización sin disparador se prende y queda callada** (Brigitte, docs/hallazgos-chatbot.md 17/10): la fila dice «Elige
    qué la dispara» y `setSecuenciaActiva` la prende igual. Bloquearla puede romper las «manuales» que se inscriben a mano: es
    decisión del chat (frenar al activar, o que la lista diga «Manual: sólo si la mandas a mano»).

## Producción (para el Cerebro, desde la PC) — con el paso exacto

| # | Qué | Paso | Urgencia |
|---|---|---|---|
| P1 | **La URL vieja del webhook de WhatsApp no oficial vence el 7/11** (`CORTE_LEGADO`, lib/evolution-firma.ts:29) | En /whatsapp, «Reparar espejo» en cada línea que siga muda | **mañana** |
| P2 | El limbo del Runner: 6 mensajes, los primeros vencen el 8/11 | Cerrarlos desde el Ops Center | 8/11 |
| P3 | El cron del Runner vence el 11/11 y con él el vigía | Rearmarlo (`CronCreate`) en el chat del Runner antes del 11/11 | 11/11 |
| P4 | Migraciones escritas y sin confirmar aplicadas. **Medido por el Cerebro el 6/11** (docs/relevo/pendientes-pc/pasos-cerebro-6-11.md): de la 0331 en adelante, 48 aplicadas, 0 ausentes y 4 «sin verificar» (0336, 0347, 0348, 0352: recrean algo que ya existía) — o sea 0338, 0341, 0342, 0346, 0351, 0357, 0390, 0394 y 0396 YA están. **Quedan sin medir las de antes:** 0298, 0299, 0302, 0314, 0316, 0330 | `node scripts/verificar-migraciones-aplicadas.mjs` (sólo lee) desde la 0298, y aplicar las ausentes con `node scripts/apply-migration.mjs` en su orden de despliegue (cabecera del `.sql`) | media |
| P5 | Las dos filas de la plataforma (ws 9) para la alerta de Meta de un cliente de agencia | `node --conditions react-server --import tsx scripts/mudanza-avisos-plataforma.mts --env=C:/dev/mako-api/.env.local --eventos=meta_cuenta_frenada_agencia,meta_cuenta_recuperada_agencia --aplicar` | alta |
| P6 | El aviso del tope de Instagram (`social_tope`) | `scripts/mudanza-avisos-plataforma.mts --aplicar --eventos=social_tope` | media |
| P7 | El aviso de tareas al Plan tras una reunión | `scripts/mudanza-avisos-plataforma.mts --eventos=reunion_tareas_al_plan --aplicar` | media |
| P8 | La plantilla «Tu contraseña cambió» en el ws de la plataforma | Mirar la fila en `mako.plantillas.store` del ws 9; si falta, crearla desde Automations de SuperAdmin | media |
| P9 | El texto de la fila viva #261: dos estados dicen «Tu cuenta» sin «publicitaria» (`gracia`, `liquidacion`) | Editarlo en Automations de SuperAdmin | baja |
| P10 | El horario de fábrica para las automatizaciones ya prendidas (Black November) | `scripts/horario-de-fabrica-prendidas.mts` (mirar si ya corrió) | media |
| P11 | Que el número de Leila llegue a 40 por día; si no, `waArranqueDia: 40` | Medir en el ws 11 | media |
| P12 | Medir funciones de `public` ejecutables por la clave pública | `node scripts/medir-funciones-publicas.mjs` | media |
| P13 | Las 10 llamadas de entrega en `error` sin reintento (Customer Success) | Leer `curso_sesiones` en producción y reintentar (cuesta crédito: con el sí de Martín) | baja |
| P14 | El goteo y el reloj de las esperas del 24/10 | `node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/medir-goteo-tras-deploy.mts` | baja |
| P15 | Código Inmobiliario: 21 fallos y 10 borradores de WhatsApp | Leer `errores_app` y `wa_borradores` del ws 13 | **cliente** |
| P16 | Fotos huérfanas del bucket `avatars` (las viejas tienen nombre adivinable) | **El script ya está** (tanda 6): `node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/avatars-huerfanas.mts` (sólo lista); mirando lo que lista, otra vez con `--borrar` y el sí de Martín | baja |
| P17 | Mirar en pantalla lo desplegado sin mirar (Settings, «Quieren entrar», el aviso al activar, la barra del editor web a 1280, el selector de funnel del teléfono…) | Con la sesión de Martín, en producción | baja |

## De MARTÍN (decisión o acción suya)

Plata y cobro: **elegir el proveedor que reemplaza a Creem** (Paddle, M3) · el secreto del webhook de Mercado Pago · probar un pago real · la política de
reembolso (Ley 24.240, 10 días) · si Partners paga el primer mes a precio de lista · el precio en pesos (cada cuánto) · el precio del Acelerador ·
el segundo nivel de Partners · la cuota en pesos declarada a otra tasa · planes en México y garantía grupal · **prender los cortes**
(`CORTE_DE_ACCESO_PRENDIDO`, `CORTE_POR_PLAN_PRENDIDO`, `MIRAR_LINK_ANTES_DE_MARCAR`: están apagados desde la revisión del 17/10 y piden sus arreglos y
una revisión adversarial antes) · si las altas a mano (Esencial) llevan topes.

Seguridad: Mauricio a sólo lectura en GitHub · apagar el registro abierto de Supabase Auth · rotar las claves del Estudio (`.env` publicado) ·
qué hacer al cambiar la contraseña con las otras sesiones · rechazar contraseñas filtradas · captcha en el opt-in y el alta · Cloudflare.

Clientes y datos: avisarle o no a Código Inmobiliario y a P2P por los datos de sus leads (P6 de pendientes.md, la migración 0357) · la lógica del
embudo de Black November con Leila · los datos de dos leads de Leila (mensualidad, monto) · si ganar en un funnel agregado cuenta como venta ·
el reporte semanal guardado de Mauricio con «ZZZ» y números de julio · los avisos mudados a automatizaciones (#280 con su CONDITION) · Brigitte
sin email para el reporte · la key de Resend «Full access» · cargar crédito de OpenAI o pasar a otro proveedor · la key de Gemini de Mauricio
bloqueada · las claves de Zernio en producción · avisarle a Leila que su Zernio está pausado y que desvincule Whop · la cuenta publicitaria de
Mauricio frenada · el número de MaKo nuevo y soltar las líneas viejas.

Meta y Google: la revisión de la app de Meta antes del 7/12 · `MAKO_META_APP_SECRET` · la verificación de Google (`tasks.readonly`,
`meetings.space.readonly`, `GOOGLE_LOGIN_CON_AGENDA`) · la cuenta publicitaria de MaKo (control, tarjeta, doble factor).

Producto: abrir Copywriter a todos · la pregunta de canal del onboarding con su default · el análisis del lead por las keys de la agencia ·
`zernio.cuenta_de_la_plataforma` (cuesta plata) · YouTube en Spy (enmienda III.L) · la rotación de claves de Apify en el alta del CRM · el
`window.opener` del Pixel · el video de fondo de las landings · los grabadores que faltan (Read AI, Meet, Grain…) y deprecar Fathom · ChatGPT en
la PC (`codex login` y medir) · qué evento de Calendly es la llamada de entrega · Avance de Curso con módulos sueltos · el nombre del chat
«Cerebro» · `npm test` dentro del pre-push · el ticket #38 (Fastlane) · las promesas de la llamada con Thiago (`docs/promesas/2910-llamada-thiago.md`).

Mirar con sus ojos: MaKo Mobile en un teléfono real · /planes y /partners · el Ops Center en Android · las capturas de Create · el Video Editor
en Chrome (tanda 5, en pausa por él).

## Ya hecho o viejo (encontrado en el barrido, para tachar)

- A1 de pendientes.md (el aviso al activar mira sólo el primer mensaje): `lib/ritmo-al-activar.ts` ya cuenta el flujo entero con `dejaBorradores`.
- Newsletter «cualquier admin entra a la tab»: `app/newsletters/puerta.ts` exige el super admin sin impersonar.
- Leila 2 (ofrecer incluir a los que ya están al activar): `incluirExistentes` en lib/nutricion.ts.
- `podarLecturasCompartidas` sin cron: existe `app/api/cron/spy-poda/route.ts`.
- Los tickets #36, #40, #41, #42, #44, #45 de `pendientes-0311.md`: en main (ver la evidencia en el relevo de cada uno).
- Pixel: la cookie del visitante con `domain=`, la normalización de `ai`/`ct`/`sfnsn`, el opt-in duplicado con su `visitor_id`.
- El texto «Eso se hace en CRM» de la burbuja de Automations: ya no está.
- `MOVIL_ACTIVO` ya está prendido; el rojo de `partner_codigos_anteriores` ya está en el contrato de tablas; las migraciones duplicadas
  0318/0319 ya son una sola de cada una.
- Todo lo de Creem (nube-creem-revision.md): viejo, Creem rechazó la tienda el 5/11.

## Las ocho DUDAS, cerradas (verificadas el 6/11 contra el código)

| Qué | Veredicto | Quién sigue |
|---|---|---|
| Secuencias sin candado entre el cron y la vía rápida | HECHO: turno por negocio con compare-and-set (lib/motor-turno.ts) | — |
| «No reprodujo el VSL» con la base caída | VIGENTE → **HECHO en la tanda 3** | — |
| El chat del lienzo reescribe una tarjeta no nombrada y le borra el link | VIGENTE: `limpiarTexto` borra todo link que no esté en el pedido, también el que el mensaje YA tenía (lib/flujo-ia.ts) | **OTRO CHAT (Automations)**: es la máquina de IA del lienzo y pide correr su arnés con IA real (`scripts/probar-chats/automations.mts`), que la nube no puede |
| El Deshacer de abierta a Ganado borra el monto | HECHO: repone la foto sin pasar por la regla (lib/deshacer-movimiento.ts) | — |
| La compra a Meta que puede salir dos veces | ACEPTABLE: va con un `eventId` fijo por venta y Meta deduplica | — |
| `reconciliarCobros` y la renovación de Stripe (mes 2+) con el aviso perdido | El cursor NO es bug (los pendientes van del más nuevo). La renovación con el aviso perdido SÍ: ningún cron lista las facturas de una suscripción ya pagada | **HECHO** (tanda 6, sin columna: rota por día) — `renovacionesPerdidasStripe` |
| El 2FA se quita o se regeneran los códigos sin un código fresco | VIGENTE (app/api/perfil/seguridad/route.ts, `quitarFactor`, `generarCodigosRecuperacion`) | **MARTÍN**: qué piden los que no tienen TOTP (WhatsApp, email, llave) |
| Un «sí» suelto con dos pendientes vivas | No confirma las dos («aclara cuál»), pero el modelo elige el id | **MARTÍN**: ¿«la preguntada» es la más reciente? |
| Confirmar un cambio de precio no muestra el de antes | VIGENTE → **HECHO en la tanda 3** | — |
