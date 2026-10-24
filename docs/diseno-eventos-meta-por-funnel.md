# Qué eventos le manda MaKo a Meta, por funnel y por página (DISEÑO, 24/10/2026)

> **Estado: DISEÑO, sin construir.** Decisión del Cerebro (24/10/2026): el arreglo del Schedule doble va al CRM después del
> lanzamiento, dentro de este diseño. La regla general ya quedó en AGENTS.md («SI LA PÁGINA YA MANDA UN EVENTO DESDE EL
> NAVEGADOR, MAKO NO LO MANDA POR CAPI AL MISMO PÍXEL SIN UN `eventID` COMPARTIDO»).
>
> Escrito por el chat «Landings de MaKo en Web Generator» (claude1) con un agente que diseñó y otro que lo intentó romper
> contra el código, la base, la Graph API y la API de Calendly (workflow `wf_d253310f-574`). Lo refutado ya está corregido.
> Líneas de `d674d633f`. El Purchase de una venta externa tiene su propio diseño: docs/diseno-venta-externa-stripe.md.

**Vive en:** `lib/meta-capi.ts` · `lib/meta-capi-payload.ts` · `app/api/webhooks/calendly/route.ts` ·
`app/api/webhooks/calcom/route.ts` · `lib/landing-analisis.ts` · `lib/landing-conversion.ts` · `lib/landing-config.ts` ·
`lib/editor-landing/html-editable.ts` · `lib/editor-landing/pagina-publica.ts` · `app/vsl/Landing.tsx`

## 0. Lo medido que cambia el diseño (24/10/2026, sólo lectura)

- ⚠️ **«7 reservas contadas dos veces» era el número equivocado.** Medido por hora (`/{pixel}/stats` con
  `event_source` + `host` + `had_pii`) contra la API de Calendly, en el píxel del ws1 (…0571, el mismo del `fbq('init')` de
  multiplicatusresultados.com y del `META_PIXEL_ID`), 30 días: Calendly tuvo **8 reservas** (las 8 con `utm_term`, 0
  reagendas). Las 4 del 28/09 al 02/10 llegaron sólo por el navegador (MaKo no mandó nada: la suscripción del webhook es del
  06/10). Desde el 10/10, **MaKo mandó 7 eventos para 4 reservas** (2, 2, 1, 2: dos en la misma hora en 3 de ellas; causa sin
  medir, lo probable es un reintento de Calendly con el mismo `event_id`) y el navegador vio 3. **El doble real son 3
  reservas** (10/10, 13/10, 15/10); la del 16/10 la vio sólo MaKo (el navegador perdió 1 de 8).
- **Hay otro emisor de servidor que espeja al navegador** en ese píxel (PageView servidor 10.695 contra navegador 8.899; MaKo
  no manda ninguno de los dos): Schedule 30 días = 7 navegador + 7 espejo (con URL, sin datos personales) + 7 MaKo (sin URL,
  con datos personales). Sin medir quién es (¿un gateway de CAPI?) y si comparte el id con el navegador.
- **La página de Mauricio dispara DOS eventos al reservar:** `fbq('track','Schedule')` y `fbq('track','Lead')`, los dos sin
  `eventID`, en su bundle propio (`/assets/index-*.js`). Le pasa a Calendly el visitante de MaKo en `utmTerm` (por eso las 8
  reservas lo traen). El listener no chequea el `origin` del mensaje.
- **Código Inmobiliario (ws13)** dispara `fbq('track','Schedule',{…},{eventID:\`schedule_${uid}\`})` al reservar en Cal.com, a
  su `META_PIXEL_ID` (…1797, compartido con el ws14). MaKo no manda Schedule de Cal.com, así que hoy no se duplica. ⚠️ Su id de
  respaldo lleva `email:nombre` en claro, y el mismo handler manda nombre y email en la URL de /gracias
  (`?name=…&email=…`): el PageView de Meta y `vsl_events.landing_url` reciben datos personales. Avisarles aparte.
- ⚠️ **El ws4 «Cliente de Diseño» tiene el MISMO `META_PIXEL_ID` (…0571) y el mismo token que Mauricio** (y el mismo token de
  Calendly que el ws1): cualquier envío por CAPI desde el ws4 —marcar «calificado» sobre sus leads copiados— cae en el píxel
  real de Mauricio. Hoy tiene 0 leads en 60 días.
- ⚠️ **«MaKo no carga fbq» es falso en las páginas de MaKo:** el Web Generator carga el píxel del sitio
  (`lib/editor-landing/pagina-publica.ts:603-613`) y su script dispara `fbq('track','Schedule')` SIN `eventID`
  (`html-editable.ts:391-396`); hola-mako.com igual (`app/vsl/Landing.tsx:309-318`). Latente: para que pase lo de Mauricio
  harían falta las DOS cosas —el `META_PIXEL_ID` del ws9 y una agenda de Calendly ruteada al ws9— y hoy no hay ninguna
  (`webhook_routing` de calendly sólo tiene al ws1).
- **El Pixel de MaKo no tiene fbq** (0 apariciones en lib/landing-token.ts) y **no pasa `utm_term`**: lo ponen el código de
  Mauricio y el script del Web Generator (`html-editable.ts:376`), no el Pixel.

## 1. Qué evento es cada conversión, quién lo manda hoy y quién debería

| Conversión | Fuente | Evento de Meta | Hoy | Debería |
|---|---|---|---|---|
| agenda | Calendly | Schedule | MaKo, sólo en R1 (calendly/route.ts:609-626), id `schedule:<email>:<inicio>` (:619, email en claro), `website` sin URL (:618). Y el navegador si la página lo dispara | MaKo con `schedule:<uuid del invitado>`, salvo reserva hecha en una página que ya lo manda sin id compartido. Una reagenda (`invitee.created` con `old_invitee`) no manda |
| agenda | Cal.com | Schedule | nadie desde MaKo (calcom/route.ts: 0 llamadas a CAPI); el ws13 desde su página | MaKo con `schedule:<uid>` sólo en BOOKING_CREATED (⚠️ `accionDeTrigger`, lib/calcom.ts:451-453, trata BOOKING_RESCHEDULED como `agenda`: no manda). Con «no sé», no manda (es un evento nuevo) |
| agenda | landing (beacon `agendo`, landing-token.ts:2948-2949, :2982) | — | el Pixel de MaKo no le habla a Meta | nunca desde el beacon: la reserva la confirma el webhook |
| compra | Stripe del negocio / cobro de MaKo | Purchase | nadie | MaKo desde el webhook, `purchase:<pi_|in_>` (docs/diseno-venta-externa-stripe.md §5) |
| compra | landing (clic al checkout) | — | — | no se manda: «fue a pagar» no es comprar |
| compra | CRM «ganado» (venta por llamada) | Purchase | nadie (`capi-cierres-no-reportados` existe sólo en el catálogo, avisos-catalogo.ts:755-758) | MaKo, `system_generated`, `purchase:lead:<id>`, sólo si la venta no entró por una pasarela. Espera el Deshacer, relee y deja la marca en el historial, como «calificado» (#856): si no, marcar Ganado antes de que entre el pago da dos Purchase |
| datos | formulario de Meta / Zernio | Lead | MaKo (meta-leads/route.ts:285-292; zernio-leads.ts:92-100; `lead:<leadgen_id>`) | igual: el navegador no lo ve |
| datos | opt-in de una landing | Lead | nadie (track/optin/route.ts: 0 llamadas a CAPI) | MaKo con el id que nace en el navegador (§2), salvo página que ya lo manda. **Nunca** para el opt-in de una reserva (`origen_captura='agenda'`, :150: esa conversión es el Schedule), ni con el marcador de prueba (`mko_test`), ni en `optin_bloqueado` (:195-214). En el camino de propuesta (duplicado, :463…) se manda al confirmar, con el id del navegador y la hora del opt-in guardados en `datos` |
| registro | opt-in de una landing | CompleteRegistration | nadie | igual que «datos» |
| whatsapp | landing (clic a wa.me) | Contact | nadie | el navegador del negocio: el clic no trae identidad (`hayIdentidad`, meta-capi-payload.ts:83-85). Un mensaje ENTRANTE de Evolution sí trae el teléfono: queda abierto |
| calificado | CRM | SubmitApplication + QualifiedLead | MaKo (leads.ts:1247-1261, `calif:<id>` :1237) | igual |

**El destino es por evento:** hoy `destinoCAPI` (meta-capi-payload.ts:221-225) manda TODO al conjunto de datos de CRM si existe
(latente: ningún ws tiene `META_CRM_DATASET_ID`). Lo que pasa en un sitio (Schedule, Purchase, Lead del opt-in) va al píxel;
al CRM, el Lead de formulario y la calificación. ⚠️ Rompe tests/calificacion-adonde-va.test.ts:34-35 (exige un solo
`destinoYToken`): se ajusta, y `adondeVaLaCalificacion` sigue contestando lo mismo que el envío.

## 2. Cómo se sabe que la página ya lo manda, y qué hace MaKo

**Tres señales, en el orden de `conversionDeLaPagina` (corregido):**
1. **Lo declarado en el paso 2 gana**, como en `conversionDeLaPagina` (lo elegido va sólo detrás de la página de gracias).
2. **Lo medido en Meta**, por píxel: `GET /{pixel}/stats?aggregation=event_source&event=<X>`, con una **ventana corta** (72 h, o
   el último día con BROWSER en ese host), no 30 días: si el cliente saca su fbq, con 30 días MaKo seguiría sin mandar un mes.
   `aggregation=host` dice desde qué página. Va con `META_ACCESS_TOKEN` (con `META_CAPI_TOKEN` Meta contesta «(#100) Missing
   Permission», medido). Molde: `listPixelEvents` (meta-ads-create.ts:890-904). Una vez por día y por evento, guardado dentro
   de `runWithWorkspace` (`setSetting` sin contexto cae al ws1, lib/settings.ts:17). «No pude leer» es null, no 0. /stats cuenta
   lo recibido, no está medido si antes o después del dedup: sirve para verificar la opción A del §3, no la B.
3. **Lo leído en la página (analizador):** dos piezas nuevas, `meta-pixel:<id>` (una por píxel: cada pieza mide hasta 40
   caracteres y hay hasta 20 por página, landing-snapshot.ts:75-81) y `meta-evento:<Nombre>:sin_id|con_id`.
   - El `init` va inline y `sinRuido` (landing-analisis.ts:363-368) borra los scripts: se lee sobre el HTML crudo, como el token
     (:419-422). Los `track` viven en el bundle propio (`bundlesDe`, :449-477, tope de 8 en :465).
   - La regex se ancla en el LITERAL del evento, no en `fbq(`: `'track'` o `'trackSingle'` (con un id de píxel opcional antes)
     seguido del nombre entre comillas (Schedule, Lead, Purchase, CompleteRegistration, Contact, SubmitApplication). Así ve
     `fbq?.(`, los alias minificados (`e('track',…)` tras `const e=window.fbq`) y `trackSingle`. El `eventID` se busca en los
     ~300 caracteres siguientes (el objeto de ws13 es largo). No exige el `)`.
   - Dan «no sé»: GTM, los eventos sin código del Administrador de eventos, las integraciones de la propia agenda, un script
     más allá del 8.º (en hola-mako.com las llamadas están en el 17 y el 18 de 20) y un 403 (el analizador recibe 403 en
     sprint.mauriciobustos.com con su UA `MaKoPixel/1.0`, :498, y 200 con uno de Chrome).
   - ⚠️ **Subir `DETECTORES_VERSION` no calla el aviso «le agregaste algo»:** `desdeDePieza` (landing-analisis.ts:150) da 1 a
     toda pieza que no es de video. Lo que lo calla es `esPiezaQueImporta` (app/api/cron/tracking-vigilante/route.ts:94-95).
   - Se guarda en `landing.snapshot` (landing-snapshot.ts:33), no en `landing.config`.

**Por conversión, no por negocio.** La reserva dice desde qué visitante se hizo SÓLO si la página pasa `utm_term`.
⚠️ «Sin visitante = link directo» es falso (el Pixel de MaKo no lo pasa): sin visitante, se busca un `agendo` del Pixel del
mismo ws en los minutos previos al webhook (vsl_events trae visitante, página y hora); si no aparece, la página es «no sé».

**`quienManda(evento, página, destino)`, pura (corregida):**

| Lo que se sabe del evento X en ESA página | MaKo |
|---|---|
| no lo manda (leído) y Meta sin BROWSER | manda |
| lo manda a OTRO píxel que el destino | manda |
| lo manda al mismo píxel con el id de MaKo (las páginas de MaKo, o un cliente que lo adoptó) | manda con ESE id |
| lo manda al mismo píxel sin id | **no manda**; la ficha dice «Meta ya recibe esta agenda desde tu página» |
| lo manda con un id PROPIO (el `schedule_<uid>` de ws13) | **no manda** |
| leído «no lo manda», pero Meta dice BROWSER>0 en ese host (GTM, script 9.º, alias) | **no manda** |
| «no sé» y Meta ilegible, para el Schedule de Calendly | manda (lo de hoy); el probador dice «no pude ver si tu página ya lo manda» |
| «no sé» y Meta ilegible, para lo que MaKo todavía no manda (Schedule de Cal.com, Lead/CompleteRegistration del opt-in, Purchase) | **no manda** (la regla pide preguntar antes: no se crean dobles nuevos) |

**El eventID compartido, sin que MaKo envuelva fbq:** sale, en las dos puntas, de un dato que las dos ya tienen.
- **Calendly:** el `postMessage` `calendly.event_scheduled` trae `payload.invitee.uri` (según la doc; confirmarlo con una
  reserva) y el webhook trae ese invitado en `payload.uri`, que no está en el tipo (`CalendlyInviteePayload`,
  lib/calendly.ts:86-127; tampoco `old_invitee` ni `rescheduled`). Id: `schedule:<uuidDeUri(...)>` (calendly-error.ts:250).
- **Cal.com:** el `uid` del booking (el navegador lo lee en landing-token.ts:2976, con `'sin-uid'` si no viene; el webhook lo
  tiene en `reserva.uid`).
- ⚠️ **Sin el dato, sin `eventID`:** un id armado en el navegador sólo se pasa si existe `payload.invitee.uri` (o el `uid`). Si
  no, se dispara sin id. Un id constante (`schedule:undefined`, `schedule:sin-uid`) haría que Meta junte TODOS los Schedule del
  navegador de 48 h en uno solo: una pérdida silenciosa.
- **Opt-in:** el id nace en el navegador: el Pixel de MaKo genera `lead:<uuid>` al enviar, lo manda en el body (`mandarOptin`,
  landing-token.ts:3317-3340) y lo expone en `window.MaKo` para la página que lo quiera usar.
- **Envolver `window.fbq` desde el Pixel de MaKo: NO.** La base de Meta hace `if(f.fbq)return;` (pagina-publica.ts:606): un
  envoltorio puesto antes deja la página sin píxel, sin aviso.
- `fbp`/`fbc` no son la llave de dedup de esta casa (la regla pide el id), pero suben el match: el Pixel podría leer `_fbp` y
  `_fbc` y mandarlos con el opt-in y con `agendo` (hoy sólo lee `fbclid` de la URL, landing-token.ts:3288; CAPI manda em, ph,
  lead_id y external_id, meta-capi.ts:211-216).

## 3. El Schedule doble de Mauricio

| Opción | Costo | Riesgo |
|---|---|---|
| **A.** MaKo no manda Schedule de las reservas hechas en multiplicatusresultados.com (`quienManda`: leído `sin_id` y Meta BROWSER>0) | política + webhook; no toca su página | se pierde la reserva que el navegador no ve (1 de 8 en 30 días, la del 16/10) y el email y teléfono del Schedule (el del navegador llega sin datos personales). Se revierte solo |
| **B.** A, y Mauricio le pone a su fbq el `eventID` del invitado; MaKo vuelve a mandar con el mismo id | un cambio de una línea en su página | depende del cliente; con un formato mal escrito vuelve el doble |
| C. Mauricio saca su fbq Schedule y queda sólo CAPI | cambio en su página | se pierde la señal del navegador y la del espejo; si el webhook falla, no queda nada |
| D. Envolver su fbq desde el Pixel de MaKo | — | puede romperle el píxel entero (§2). Descartada |
| E. Mandar el Schedule al conjunto de datos de CRM | — | no arregla nada: es un evento del sitio |
| F. Dejarlo | 0 | Meta ve agendas de más y optimiza sobre eso |

**Recomiendo A primero (no le pide nada al cliente) y B como invitación.** Y antes, el arreglo de nuestro lado: MaKo manda
dos Schedule por reserva en 3 de 4 (lo probable, reintentos de Calendly porque el handler trabaja mucho antes de contestar):
la resolución de la página y el envío van DESPUÉS de contestar (`after()`), no adentro, o la latencia sube y los reintentos
también.

**Texto para Mauricio si acepta B (corregido):** «En el código que escucha `calendly.event_scheduled` (el que hoy llama a
`window.fbq('track','Schedule')` y a `window.fbq('track','Lead')`), con el nombre que tenga el evento en TU código, cambiá sólo
el Schedule: leé `u = evento.data.payload.invitee.uri`; si `u` existe, llamá
`window.fbq('track','Schedule',{},{eventID:'schedule:'+ <el último tramo de u, sin la barra final>})`; si no existe, dejá
`window.fbq('track','Schedule')` como está.» Y dos preguntas: (1) ¿tenés un gateway de CAPI u otra herramienta que copie tus
eventos al servidor? (es el espejo medido); (2) tu página manda también `Lead` en cada reserva: si tus campañas optimizan por
Lead, Lead y Schedule son el mismo acto.

**Verificar B (corregido):** `sendMetaCAPIEvent` no manda `test_event_code` (meta-capi.ts:81-96, :244-247), así que «Probar
eventos» no ve el lado de MaKo. O se agrega `test_event_code` sólo para la reserva de prueba, o se mira a los 2-3 días el
porcentaje deduplicado del Schedule en la vista general del Administrador de eventos. ⚠️ La reserva de prueba entra como real
(lead, aviso al dueño, `lead.agendo`, un Schedule de verdad al píxel de Mauricio): se cancela y se avisa.

## 4. Dónde se configura (lo mínimo)

- **Por negocio y por funnel:** nada nuevo. ⚠️ El funnel da la conversión sólo para `carrito` (compra) y `chat_entrante`
  (whatsapp), en `deEntradas` (landing-conversion.ts:103-111); `agenda_sola` no se ofrece desde el 12/10 (pipeline.ts:848).
  Agenda, datos y registro salen de lo elegido, lo medido o lo que se ve en la página.
- **Por página:** la conversión ya se declara (`landing.config[].conversion`) y decide el evento con un mapa fijo en el código
  (agenda→Schedule, compra→Purchase, datos→Lead, registro→CompleteRegistration, whatsapp→Contact). El nombre no se elige.
- **Qué manda el navegador:** lo DETECTA MaKo (§2). En el paso 2 del Pixel, debajo de «¿Qué hace la gente en esta página?»,
  una línea: «Tu página ya le avisa a Meta cuando alguien agenda (lo vimos en su código): MaKo no lo repite», con «No es así».
  La corrección se guarda en `landing.config[].navegador` = `'no_manda' | 'manda' | 'manda_con_id_mako'` (sin el tercero no se
  puede marcar el paso 8), sólo cuando se corrige, y se agrega en `parsearConfig` (landing-config.ts:140-155) Y en
  `conLanding` (:220-228): en uno solo, la próxima lectura lo borra.

## 5. Los event_id, sin datos personales en claro

Funciones puras en `meta-capi-payload.ts`, junto a `eventIdLeadCrudo` (:183):

| Evento | Formato | De dónde |
|---|---|---|
| Schedule (Calendly) | `schedule:<uuid del invitado>` | `uuidDeUri(payload.uri)`; respaldo `uuidDeUri(scheduled_event.uri)` |
| Schedule (Cal.com) | `schedule:<uid>` | `reserva.uid` |
| Schedule sin ninguno | `schedule:h:<sha256(email minúscula + "|" + inicio), 32 caracteres>` | nunca el email crudo |
| Purchase | `purchase:<pi_…>` (pago único) · `purchase:<in_…>` (suscripción) · `purchase:lead:<id>` (venta del CRM) | una sola vez por primer pago (docs/diseno-venta-externa-stripe.md §5) |
| Lead (opt-in) | `lead:<uuid del navegador>` | el Pixel de MaKo |
| Lead (formulario) / calificado | `lead:<leadgen_id>` / `calif:<id>` | igual que hoy |

**La transición:** un reintento de Calendly de una reserva anterior al despliegue llegaría con el id nuevo y, dentro de las
48 h del dedup de Meta, contaría dos veces: el id viejo se mantiene para las reservas creadas antes del corte.

## 6. Plan de salida, en orden

1. **El id del Schedule sin email:** `eventIdSchedule()` y el `uri` del invitado en `CalendlyInviteePayload`.
   `tests/meta-event-id.test.ts`: sin `@` ni el email; la misma reserva da el mismo id; el uuid del invitado gana al del
   evento; el navegador y el webhook dan el MISMO id; sin uri, sin `eventID` (nunca uno constante).
2. **Contestar antes de mandar:** el Schedule de Calendly en `after()` (corta los reintentos que hoy dan dos por reserva).
3. **La política pura `lib/meta-eventos.ts`** (`EVENTO_DE_CONVERSION`, `quienManda`, el destino por evento).
   `tests/meta-eventos-politica.test.ts`: la matriz del §2 fila por fila; destino CRM y evento de sitio → píxel; el opt-in de
   una reserva no da Lead nunca; una reagenda no manda.
4. **El detector del analizador** (piezas, snapshot, `esPiezaQueImporta`). `tests/landing-analisis-fbq.test.ts`: ve el
   Schedule minificado de Mauricio, el de ws13 con objeto largo y `eventID` → `con_id`, `fbq?.(`, un alias y `trackSingle`, y el
   `init` inline. Una página con sólo GTM da «no sé». Autodelación: el snippet de MaKo analizado solo no produce piezas `meta-*`.
5. **La lectura de Meta**, `navegadorMandaEnPixel(pixel, evento)`, con `META_ACCESS_TOKEN`, ventana corta, una vez por día.
   `tests/meta-pixel-stats.test.ts`: la forma real `data[].data[]{value,count}`; un error de permiso da null, no 0.
6. **El webhook de Calendly** resuelve la página (utm_term o el `agendo` previo), aplica `quienManda` y, si no manda, deja una
   línea en el historial. `tests/calendly-schedule-politica.test.ts` (de fuente): `quienManda` antes de `sendMetaCAPIEvent`; el
   `eventId` no se arma con el email; una reagenda no manda.
7. **Las páginas de MaKo comparten el id:** `SCRIPT_DISENO` (html-editable.ts:391-396) y Landing.tsx:309-318 mandan
   `{eventID:'schedule:'+uuid}` sólo si hay uri. `tests/meta-pixel-mako.test.ts` (ampliado).
8. **El paso 2 y el probador** muestran lo detectado y la corrección. Reescribir `lib/hechos-mako.ts:54` (la IA de MaKo hoy dice
   que pegar el píxel es opcional y que MaKo lo manda todo por CAPI).
9. **El pedido a Mauricio** (§3, B). Cuando la verificación salga bien, `navegador = 'manda_con_id_mako'` y vuelve el envío.
10. **Lo nuevo pasa por `quienManda`, nunca directo a `sendMetaCAPIEvent`** (hoy tiene 4 llamadores: calendly/route.ts:609,
    meta-leads/route.ts:285, zernio-leads.ts:92, leads.ts:1249): el Purchase, el Lead/CompleteRegistration del opt-in, el
    Schedule de Cal.com. Lo cuida un test que cuenta los llamadores.

**Sin medir:** quién es el espejo de servidor del ws1 y si deduplica; por qué MaKo manda dos Schedule por reserva; si
`payload.invitee.uri` llega en el `postMessage` de la versión de Calendly de Mauricio; si Meta le baja la calidad a un
`website` sin `event_source_url` ni `client_user_agent` (calendly/route.ts:618); si el Administrador de anuncios suma un evento
del dataset de CRM y otro del píxel como dos.

**Riesgos aparte, para otros chats:** el ws4 comparte píxel y token con Mauricio (Integraciones: separarlos); la página del ws13
manda nombre y email en la URL de /gracias (avisarle al cliente).
