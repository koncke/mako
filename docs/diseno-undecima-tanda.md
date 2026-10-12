# Undécima tanda de Automations: diseño

> Escrito el 11/10/2026 por el arquitecto de la corrida `wf_b4e3948d-3dc`, sobre siete relevos medidos ese
> día (~17:50 UTC, sólo lectura) y verificado contra el código de `HEAD` = `31ccf832`. El pedido literal de
> Martín (13 puntos + las cuatro decisiones de la décima) está en `app/admin/dev/chatbot/bitacora.ts`.
> Reemplaza, donde se contradicen, a `docs/diseno-ai-step-v2.md` (§1, §2.4, §3, §8, §10-A/C/D),
> `docs/diseno-automations-galeria-v2.md` (§3: el catálogo) y `docs/diseno-mako-en-whatsapp-unificado.md`
> (la sección «MaKo en WhatsApp» de la barra y el «＋ Nuevo mensaje»).
>
> **Revisado el mismo día (~20:25 UTC) en el worktree `C:/dev/wt-undecima`** (rama `undecima`, HEAD `dd293c86`:
> origin/main con el CRON «Pagos» de la pasarela, `67b7695d` + `eb514e3c` + `1e85eb62`). Lo que eso cambió está en
> §1.8 a §1.11; el resto se volvió a contrastar con el código del worktree y sigue valiendo. Re-medido a las
> 20:22 UTC (transacción read only, `scratchpad/wf-undecima/arquitecto/vivas-pago.mts`): las mismas 10 filas vivas
> con los mismos `updated_at`, ninguna fila (ni archivada) del CRON «Pagos» ni del evento «Entra un pago», y 0 cobros.

## 0. La regla que gobierna todo

Martín lo pidió varias veces y con enojo: **NUNCA una versión vieja ni nada inventado.** Un flujo se arma con
las piezas que existen hoy en el lienzo:

- **CRON** = una etapa del embudo.
- **CONDITION** con las filas del catálogo (`condicionPorId`), varias filas y varias ramas en UNA tarjeta.
- **DELAY**: por tiempo, o «N antes de la reunión».
- **WhatsApp**, **Email**, Instagram y Messenger.
- **«MaKo en WhatsApp»**: el aviso al grupo del negocio.
- **AI Step**: uno por objetivo.

Lo que queda prohibido en prod, en la galería, en «Crear con IA» y en la API:

- un CRON con la marca «(de antes)»;
- un dato que no se puede citar ni rastrear (`{{mensaje_mako}}`);
- dos CONDITION pegadas, o CONDITION → DELAY → CONDITION;
- una opción que el editor de hoy no ofrece;
- un flujo partido por pedazos de una misma categoría.

Lo que hay en prod se REHACE con esas piezas. Lo que sobra se archiva, nunca se borra («cerrar no es borrar»).

Texto de pantalla: corto («Poco texto quiero»), en «tú» neutro. Lo visual lo mira Martín; los revisores gastan
sólo en motor, datos, envíos y lo que cobra plata.

## 1. Lo que se corrigió de los relevos (medido por el arquitecto)

Esto va a la cosecha (`docs/hallazgos-chatbot.md`). Los relevos se contrastaron entre sí y contra el código; lo
que no se cita acá se verificó y está bien.

1. **La lista `disparadores` le GANA a la columna, no al revés.** El relevo de flujos dijo que en #238 «manda la
   columna (entrega_actual)». `vistasPorDisparador` (`lib/disparadores.ts:728` en el worktree) usa
   `sec.disparadores?.length ? sec.disparadores : disparadoresDe(sec)`.
   - La lista de #238 dice `etapa_actual@lead`, funnel 1. Prendida, mandaría «¡Felicidades por completar la
     clase!» a cada lead de «Lead entrante».
   - Está pausada. Hay que dejar la lista coherente con lo que Martín configuró. Es una decisión (§9).
2. **Los leads de Meta del ws1 SÍ pasan por «Lead entrante».** El relevo midió «0 leads en `lead` hoy» y eso
   preocupaba: el CRON nuevo de la Bienvenida apunta ahí. La causa es la regla T2 de `lib/crm-auto-plan.ts:235-262`:
   - pasa a `nutri` (a mano) a quien no agendó, recién a los 2 días de llegar;
   - el ws1 no tiene leads nuevos desde el 06/10, y los tres de ese día (2574, 2575, 2590) ya están en `nutri`.
   - El barrido de la hora los alcanza con días de margen. La Bienvenida en «Lead entrante» funciona.
3. **Reservar no limpia la etapa puesta a mano, y eso no es raro.**
   - La misma T2 deja en `nutri` (a mano) a todo lead que no agendó en 2 días, y después a `reactivacion`.
   - Si después reserva, sigue ahí (`pipelineStageOf` devuelve el override; nada lo limpia salvo
     `lib/leads.ts:1428`).
   - Medido (`scratchpad/wf-undecima/arquitecto/tarde.mts`): en 90 días, 4 de 54 leads del ws1 con R1
     reservaron 2 días o más después de entrar.
   - Hoy les llegan el aviso, la preparación y los recordatorios, porque #213, #228 y #239 no miran la etapa.
   - Con el CRON en «Agenda R1» dejarían de llegarles. Por eso **M6 deja de ser opcional** (§4).
4. **Dos relevos se contradecían sobre la tarjeta «MaKo en WhatsApp».**
   - Flujos: «el link y el teléfono los agrega el aviso».
   - Plantillas: «deduplica por lead + tarjeta».
   - MaKo-WA: la tarjeta con `partes` sale TAL CUAL, sin envoltorio y sin dedup.
   - **Gana MaKo-WA**: lo que se ve en la tarjeta es lo que llega. Toda tarjeta nueva lleva los datos a la vista
     (`{{nombre_completo}}`, `{{lead_telefono}}`, `{{link_lead}}`).
5. **«La reunión del dato» y «la de la espera» tienen que ser la misma función, y no puede ser la regla laxa.**
   - `reunionFuturaMs` acepta una fecha sin hora: la ancla a las 12:00 de México.
   - En el ws1 hay 74 leads con fecha y sin hora: les saldría un «1 h antes» a las 11:00 de una hora que nadie
     cargó.
   - Además cuenta como futura una reunión CANCELADA (`junta_X_at` puesta y `fecha_junta_X` en null).
   - Se define `proximaReunion(l, ahora, { estricta })` (§5). El ancla del DELAY «antes de la reunión» y los
     datos «Próxima reunión» usan la estricta, que es la regla del emisor de hoy: hora puesta, fecha que
     coincide, sin asistencia marcada.
6. **«Prepara una reunión» no puede colgar sólo del hilo de recordatorios.**
   - El relevo propuso decidirlo por «tiene un DELAY antes de la reunión».
   - Pero el flujo de ws13 (sólo el aviso) no lo tiene, y perdería el reuso al reagendar: hoy #240 avisa cada
     reserva.
   - Se decide también por el TIPO de la etapa del CRON: `agenda` y `agendaj2` son de tipo `reunion`
     (`PIPELINE_KIND`, `lib/pipeline.ts:391`).
7. **`{{mensaje_mako}}` y el emisor del recordatorio no se pueden borrar en el mismo deploy.**
   - Mientras #228, #239 y #240 sigan vivas (entre el deploy y el script), el código desplegado tiene que
     seguir resolviéndolas.
   - Se OCULTAN (no se ofrecen; Publicar las rechaza) y se borran en un commit de limpieza DESPUÉS de
     `--aplicar` (§8.7).
8. **El CRON «Pagos» trajo un QUINTO Evento de MaKo con `{{mensaje_mako}}`.** `pago_recibido` → aviso
   `pago-recibido` (`textoDelCodigo`), plantilla `mako-pago` = `{{mensaje_mako}}`. Lo emite `avisarPagoRecibido`
   (`lib/cobros.ts`) con un texto armado: quién pagó, cuánto, por qué pasarela, el concepto, si es renovación o
   prueba y, en una venta de MaKo, cómo quedó el alta.
   - El punto 4 vale también acá. El emisor pasa además `datos` atómicos, por el mismo camino que la cobranza
     (`emitirDelCatalogo(…, { datos })`): `pago_monto`, `pago_concepto`, `pago_pasarela`, `pago_tipo`,
     `pago_modo` y `pago_alta` (§5). La regla de AGENTS.md «Un cobro pasa por `lib/cobros.ts`» no cambia: sólo
     cambia lo que el aviso lleva.
   - `mako-pago` conserva su id y se reescribe con esos datos (§7).
   - El resto del CRON «Pagos» se integra sin tocarse: `TRIGGER_PAGO`, `EVENTOS_PAGO`, la clase `pagos` (7º botón,
     grilla 4+3), `esClaseDeEventos`, 'pago' en `EventoNutricion` y `TRIGGERS_POR_EVENTO`, `EstadoCanales.pagos`,
     `enrolarPorPago` (`lib/pago-entrante.ts`). M1 cambia sólo la rama 'agenda_nueva' de `enrolarPorEvento`.
   - Medido: 0 filas del CRON «Pagos» o del evento `pago_recibido` (ni archivadas) y 0 cobros. Si al aplicar
     aparece una, el script de flujos la reescribe en el lugar con la plantilla nueva (§8.5).
9. **`TRIGGERS_DEL_EMISOR` incluye `TRIGGER_AVISO_MAKO`** (`lib/disparadores.ts:88`). La limpieza decía «borrar
   `TRIGGERS_DEL_EMISOR`»: eso apagaría los Eventos de MaKo que se quedan (cobranza, charla y pago). Se saca SÓLO
   `TRIGGER_RECORDATORIO` de ese conjunto (§8.7).
10. **La migración es la 0257** (o la siguiente libre al commitear): en el worktree está `0255_cobros_pasarela.sql`
    y en el clon `0256_offer_funnel.sql` de Offer. Se mira `ls supabase/migrations` en los dos.
11. **Ocultar `{{mensaje_mako}}` del «{ }» va en la ola 3, no en la 1.** Lo fijan tests que también fijan la barra
    y la galería (`tests/automations-mako-en-whatsapp.test.ts`, test 5; `tests/aviso-evento.test.ts`), y va con el
    paquete que rehace las plantillas que hoy lo usan. La función pura que Publicar usará para rechazarlo
    (`problemasDeTokens`) nace en la ola 1; se enchufa en la 3. Hasta la limpieza, el motor lo sigue RESOLVIENDO.

## 2. Los 13 puntos y las tres decisiones (qué queda)

### Punto 1 · Configuraciones sin filetes
- Los tres filetes sueltos salen de reglas compartidas: el borde de la cabecera del Modal, el borde propio de
  `Tabs` (17 px debajo del subrayado azul por el padding del cuerpo) y el `border-top` del segundo hijo del
  cuerpo.
- La cura usa lo que ya existe:
  - `sinFiletes` en el Modal;
  - UN solo hijo en el cuerpo, que envuelve `Tabs` y los dos paneles montados;
  - una prop nueva y opcional `sinLinea` en `app/_ui/Tabs.tsx`.
- Medido en una réplica: queda sólo el subrayado azul de la pestaña activa.
- Los dos separadores internos de «Límites» (adentro de la tarjeta) se quedan (§9).

### Punto 2 · El CRON de la Bienvenida
- Fuera «Dejó el formulario sin agendar (de antes)».
- #198 queda así: CRON «Lead entrante» → UNA CONDITION con «Llegó hace menos de 72 h» y «No agendó» → audio #1.
  Tabla en §3.

### Punto 3 · Nada de CONDITION → DELAY → CONDITION
- #198 pierde el DELAY de 1 h y la segunda CONDITION.
- La galería tenía los mismos patrones (`bienvenida-sin-agenda`: CONDITION → DELAY → CONDITION; `agendo-preparar`:
  CONDITION → CONDITION). Se rehace (punto 10).
- Queda una función pura, `problemasDeForma(pasos)` en `lib/flujo-forma.ts`. La usan los tests de la galería,
  «Crear con IA» y el script de prod.

### Punto 4 · Fuera `{{mensaje_mako}}`
- No es un dato: es el aviso entero que armaba el código del emisor. Lo usan el webhook de agenda
  (`lead_agendo`), la charla (`lead_contesta`), los 30 min antes de la reunión (`reunion_pronto`) y, desde el CRON
  «Pagos», la pasarela (`pago_recibido`).
- El catálogo deja de ofrecerlo y Publicar lo rechaza.
- Cada aviso pasa a una tarjeta «MaKo en WhatsApp» con datos citables: los de siempre, más «Próxima reunión»,
  «Lo que contestó al agendar», «Lo que escribió» (la charla) y los del pago.
- Mientras exista una fila viva que lo use, el motor lo sigue resolviendo (compatibilidad de lectura); se borra
  después del script (§8.7).

### Punto 5 · «Renombrar» en el «⋯»
- Va segundo, después de Activar/Pausar, con el ícono `renombrar` del set.
- Se edita en la fila: Enter o blur guardan, Escape cancela, sin cambio no escribe; optimista, con vuelta atrás.
- Escribe por la puerta que ya existe (`POST /api/chat-agent/secuencias`, `action:'nombre'`), que pasa a
  contestar 404 si no actualizó ninguna fila.
- El título del lienzo se re-siembra al dibujar cuando cambia la prop. Sin eso, un blur reescribe el nombre
  viejo.

### Punto 6 · El «{ }» del recordatorio y las tarjetas viejas
- El editor dejaba 5 datos porque el recordatorio era un emisor aparte con su catálogo de 5 claves.
- Ese catálogo se va del editor: un WhatsApp de un flujo ve el árbol entero (50 datos al lead) más la sub-rama
  «Próxima reunión».
- Todos los flujos se rehacen (§3).

### Punto 7 · Datos azules y clickeables AL EDITAR
- Pieza nueva `app/_components/CampoConDatos.tsx`: un espejo detrás del `<textarea>`/`<input>` que pinta cada
  token en `var(--primary-strong)`; en `var(--bad)` el que ese mensaje no puede resolver.
- Al hacer clic en un token: se selecciona y se abre el «{ }» con ESE dato marcado; elegir otro lo reemplaza
  ahí mismo.
- En el cuerpo rico del email, una decoración de ProseMirror. El valor guardado sigue siendo texto plano.

### Punto 8 · Un solo flujo «Un Lead Agendó Llamada»
#213 se rehace en el lugar y absorbe #228 (recordatorios) y #239 (aviso al equipo). Hay 3 caminos desde el CRON
«Agenda R1»:

1. la preparación de hoy;
2. el aviso «Nuevo agendado» («MaKo en WhatsApp»);
3. los recordatorios: «1 día / 1 h / 15 min antes de la reunión» → WhatsApp.

Para que el motor lo corra igual o mejor que el emisor de hoy hacen falta M1-M6 (§4).

### Punto 9 · Una sola barra
- Fuera la división «Chatbot / MaKo en WhatsApp», la palabra «Chatbot» y «＋ Nuevo mensaje». Una lista, en el
  orden del server; filtran los filtros que ya existen.
- «Configuraciones» y «Tutorial» pasan a un Dropdown de la casa: botón cuadrado de 38 px con el ícono `config`,
  ANTES del buscador.
- El recorrido pierde sus pasos «MaKo en WhatsApp» y «Configuraciones». El último pasa a «Configuraciones y
  tutorial · Están siempre en este menú.».

### Punto 10 · Plantillas: una por categoría
Son 13 plantillas, en orden de embudo:

| # | id | Plantilla | CRON |
|---|---|---|---|
| 1 | `lead-entro` | Un Lead Entró | etapa |
| 2 | `lead-agendo` | **Un Lead Agendó Llamada** | etapa |
| 3 | `lead-no-asistio` | Un Lead No Asistió | etapa |
| 4 | `lead-tuvo-reunion` | Un Lead Tuvo la Reunión | etapa |
| 5 | `lead-confirmo-compra` | Un Lead Confirmó la Compra | etapa |
| 6 | `cliente-empezo` | Un Cliente Empezó | etapa de entrega |
| 7 | `mako-cobranza` | Una Cuota Venció | Evento de MaKo `cuota_vencida` |
| 8 | `mako-pago` | Entró un Pago | Evento de MaKo `pago_recibido` |
| 9 | `mako-charla` | Un Lead Te Escribió | Evento de MaKo `lead_contesta` |
| 10 | `instagram-te-escribieron` | Te Escribieron por Instagram | Instagram, 5 eventos |
| 11 | `messenger-te-escribieron` | Te Escribieron por Messenger | Messenger, 4 eventos |
| 12 | `email-recibido` | Te Escribieron por Email | Recibes un email |
| 13 | `email-newsletter` | Alguien Se Suscribió | newsletter |

- Cada una lleva UN AI Step con objetivo (salvo las de Evento de MaKo, Instagram, Messenger y Email, donde el AI
  Step no corre) y la tarjeta «MaKo en WhatsApp» donde el equipo tiene que actuar.
- De las 29 de hoy (las 28 de la décima más `mako-pago` del CRON «Pagos»), conservan su id `mako-cobranza`,
  `mako-pago`, `mako-charla` y `email-newsletter`. Las otras 25 quedan como un mapa de reemplazos (id viejo → nuevo,
  o «retirada»):

  | Viejo | Nuevo |
  |---|---|
  | `bienvenida-sin-agenda`, `ultimo-intento` | `lead-entro` |
  | `recordatorio-reunion`, `agendo-preparar`, `agendo-confirmar`, `email-recordatorio-reunion`, `mako-agendado`, `mako-reunion` | `lead-agendo` |
  | `no-asistio` | `lead-no-asistio` |
  | `seguimiento-reunion`, `reactivar-sin-cierre` | `lead-tuvo-reunion` |
  | `pago-pendiente` | `lead-confirmo-compra` |
  | `cliente-bienvenida`, `pedir-testimonio` | `cliente-empezo` |
  | `ig-comentario-dm`, `ig-historia-dm`, `ig-bienvenida-dm`, `ig-ref-dm`, `ig-en-vivo-dm` | `instagram-te-escribieron` |
  | `ms-bienvenida`, `ms-qr`, `ms-ref`, `ms-comentario` | `messenger-te-escribieron` |
  | `email-respuesta-auto` | `email-recibido` |
  | `felicitacion-clase` | retirada |

- Crear con un id viejo contesta 400 y nombra la nueva; nunca crea otra cosa en silencio.
- `felicitacion-clase` se retira: «cada vez que avanza» es falso con el unique de inscripciones.
- El CRON «Pagos» no tiene plantilla propia (no la tenía antes de esta tanda). Una «Un Pago No Pasó» queda como
  decisión (§9, 34).

### Punto 11 · Un AI Step por objetivo
- UNA tarjeta con objetivo y escenarios adentro: hasta 10 más «Lo demás». El tope es uno por medio en cada
  automatización.
- El motor ya junta varias tarjetas en una (`expandirPasoIA`). Lo que cambia es lo que se guarda (la forma
  compacta), lo que se ofrece y lo que se valida.
- `juntarPasosIA` reemplaza a `separarPasosIA` como la puerta para lo viejo: al abrir, al guardar y en la API.

### Punto 12 · Casi sin campos de texto
- El único texto libre es el objetivo (con dictar o grabar) y su «✦ Armar».
- Los escenarios no son campos: salen de «✦ Armar», del catálogo `ESCENARIOS_TIPICOS` (el mismo que usa la
  galería) o de «✦ Otro con MaKo».
- «Responde con» es un desplegable: Texto o Audio, y con Audio la voz.
- El ensayo conserva su texto, porque ahí contesta la persona.

### Punto 13 · «Libertad»
- Un desplegable por escenario: Sólo te avisa / Para aprobar / Sola. «Lo demás» ofrece las dos primeras.
- «Hasta» se va: siempre es el objetivo. «Te aviso cada vez» se va.
- «Para aprobar» siempre avisa al grupo; «Sola» no avisa; el aviso se DERIVA de la libertad.
- Sin títulos ni textos de ayuda.
- Las opciones que `libertadesPermitidas` no deja (plata → nunca Sola) van deshabilitadas.

### Decisión 2 de la décima · El editor de «MaKo en WhatsApp» = el de WhatsApp
- La tarjeta sigue siendo la acción `avisar_al_equipo`, con un CAMPO nuevo: `params.partes`, la misma lista que
  el WhatsApp. Ofrece archivos de la biblioteca, varios mensajes, pausas y ✦ (redacta para el EQUIPO).
- Audio: SÓLO la «Voz de MaKo». No se graba con el micrófono ni se usan los audios del negocio: sería suplantar
  al dueño.
  - Es la voz de ElevenLabs «David», `id7LQ3n0ft94moeTT1ER` (voz compartida de la biblioteca), con los ajustes
    del VSL.
  - Se genera al tocar ➤, se cachea por texto y la paga la plataforma con la env nueva `MAKO_ELEVENLABS_API_KEY`.
- Una tarjeta con `partes` sale TAL CUAL: sin «🟡 título», sin «— MaKo», sin rótulo y sin dedup de 12 h. El
  reclamo del motor ya impide el doble envío.
- Si el WhatsApp no salió, es un fallo visible (hoy queda como «Le avisé»).

### Decisión 3 de la décima · Nadie manda email con el remitente de MaKo
- El corte pasa a POSITIVO: un mail del NEGOCIO sale sólo con un remitente que pasa `remitenteDelNegocio`. Hay
  dos vías:
  - un dominio reclamado y verificado por ESE workspace (el de MaKo, sólo la plataforma);
  - su propia cuenta de Resend con su key.
- Lo que habla MaKo sale con `from: REMITENTE_MAKO` y SIEMPRE por la key de la plataforma. Hoy, dentro de ws10 o
  ws11, salía por la cuenta del cliente y Resend lo rechazaba.
- Una escritura en prod: `resend_from` del ws1 → `''`.

### Decisión 4 de la décima · La zona del negocio
- Un solo default (`America/Tijuana`): se elimina `ZONA_SIN_CONFIGURAR` (Ciudad de México).
- Una sola función para el motor y las pantallas: `zonaDelNegocio`. `tzDeWorkspace` pasa a ser una lectura pura.
- La detección va por el navegador de los ADMINS propios del negocio, en producción. Nunca la del super admin con
  `?ws=`, ni la de una agencia, un setter o un closer, ni un `next dev`. La IP sólo llena un vacío.
- La primera detección gana; sólo una persona la cambia.
- Backfill:
  - ws1 y ws4 → Tijuana; ws11 → Cancún; los tres desde Meta.
  - ws13 se canoniza a `America/Argentina/Buenos_Aires`.
  - Lo que ya estaba guardado pasa a origen 'legado'.
- Hoy el ws1 manda en hora de CDMX: el envío #22 salió a las 08:00 de Tijuana, antes de su horario de 9 a 21.

## 3. Los flujos de producción: ANTES y DESPUÉS (tarjeta por tarjeta)

Medido el 11/10/2026 a las 17:50 UTC y otra vez a las 20:22 UTC (igual). Son 83 automatizaciones, 10 sin
archivar. Ids viejos en su índice; los nuevos al final. Sólo el script del último paquete escribe, en SIMULACRO por
defecto (§8).

Los `updated_at` que el script usa para el compare-and-set (se vuelven a leer al aplicar): #198
`2026-10-11T15:20:50.165Z`, #213 `2026-10-11T15:20:50.413Z` (y `disparadores_rev` 1), #228
`2026-10-10T17:26:28.167Z`, #238 `2026-10-11T06:32:14.213Z`, #239 `2026-10-11T15:17:01.910Z`, #209
`2026-10-08T15:20:02.947Z`, #210 `2026-10-08T15:20:03.656Z`, #223 `2026-10-10T14:29:32.513Z`, #224
`2026-10-10T16:09:00.574Z`, #240 `2026-10-11T15:17:04.451Z`. Una fila viva que no esté en esta tabla FRENA el script,
salvo una de un Evento de MaKo con `{{mensaje_mako}}` (p. ej. una «Aviso de pago recibido» creada después del
relevo), que se reescribe en el lugar con la plantilla nueva de su evento.

### ws1 · Mauricio Bustos (cliente)

**#198 «Bienvenida — dejó sus datos y no agendó» · PRENDIDA → se rehace en el lugar, PRENDIDA**

| | ANTES | DESPUÉS |
|---|---|---|
| CRON | «Dejó el formulario sin agendar (de antes)» (`instant_form_sin_agenda`) | Producto › Adquisición › Funnel principal › **Lead entrante** (`etapa_actual` `lead`, funnel 1) |
| [0] n2199q6 | CONDITION «Llegó hace menos de 72 h» → nv8c28e | CONDITION «Llegó hace menos de 72 h» **y** «No agendó» → o0 · Si no: termina |
| [1] nv8c28e | DELAY 1 h → nz7zsf8 | *se va* |
| [2] nz7zsf8 | CONDITION «Agendó» (sí: termina) · Si no → o0 | *se va* |
| o0 | Audio #1 «Te dejo aquí el video: https://confirmar.lovable.app» · sale solo | igual |
| n1b5m7i | AI Step (tarjeta v2) · caso «Cualquier respuesta» → Sólo te avisa · sin objetivo | AI Step · objetivo «Que cuente a qué se dedica su negocio y agende una llamada» · sin escenarios · Lo demás: Sólo te avisa |
| Nombre | — | «Un Lead Entró» (recomendado, §9; se puede volver con «Renombrar») |

- Borrador (no vigente) y posiciones: en null.
- `antiguedadDeEntrada` = 72: el tope al inscribir se conserva.
- Inscripción 199 (lead 2590, 'respondio', paso_actual 1, sin nodo_actual): no se toca. Es inerte, porque el
  motor no levanta las 'respondio' sin carril.
- Al sacar dos tarjetas del medio, sus índices se corren. Por eso no conservan el índice; no hay otra
  inscripción viva.

**#213 «Agendó una reunión» · PRENDIDA → «Un Lead Agendó Llamada», en el lugar, PRENDIDA**

| | ANTES | DESPUÉS |
|---|---|---|
| CRON | 2 CRON «(de antes)»: `agendado_primer_contacto` y `agendado_ya_contactado` | **Agenda R1** (`etapa_actual` `agenda`, funnel 1). Se va el d2 |
| inicio | — | `entrada` (nuevo, al final): principal → nvlvg08 · en paralelo → u11aviso y u11e1440 |
| [0] nvlvg08 | DELAY 1 h → n2jl2v4 | igual (camino 1) |
| [1] o0 | Audio #7 «Te dejo el video para que llegues con contexto…» · sale solo → nh92v3h | igual |
| [2] nh92v3h | DELAY 24 h → o1 | igual |
| [3] o1 | WhatsApp redactado por MaKo, 3 variantes «¿alcanzaste a ver el video?…» → n4z5uil | igual |
| [4] n4z5uil | DELAY 12 h → ne9jyr0 | igual |
| [5] ne9jyr0 | «MaKo en WhatsApp» (forma de antes: título «no confirmó la reunión» + «Agendó y no confirmó. Conviene que le marques tú.») | «MaKo en WhatsApp» con `partes`: «Agendó y no confirmó: {{nombre_completo}}. Conviene que le marques tú.⏎📱 {{lead_telefono}}⏎👉 {{link_lead}}» |
| [6] nb7dt1y | AI Step, 1 caso: «Confirma o ya vio el video» (Sola) | **El único AI Step** · objetivo «Que llegue a su reunión confirmada y sin hablar de cifras» · escenarios VERBATIM: Confirma o ya vio el video (Sola) · Pregunta el precio (Para aprobar) · Pregunta por la reunión (Para aprobar) · Quiere cambiar el día (Sola) · Lo demás: Sólo te avisa |
| [7] n2jl2v4 | CONDITION «Ya le escribiste» → n136j5s · Si no → o0 | igual |
| [8] n136j5s | Audio #5 → nh92v3h | igual |
| [9] nyiufgy | AI Step, 1 caso «Pregunta el precio» (Para aprobar) | *plegado en nb7dt1y* |
| [10] nofi37o | AI Step, 1 caso «Pregunta por la reunión» (Para aprobar) | *plegado en nb7dt1y* |
| [11] njodb7o | AI Step, 1 caso «Quiere cambiar el día» (Sola) | *plegado en nb7dt1y* |
| u11aviso | — | «MaKo en WhatsApp» (camino 2): ver el texto del aviso, abajo |
| u11e1440 → u11t1440 | — | DELAY «1 día antes de la reunión» → WhatsApp (sale solo): «Hola {{nombre}}, te recuerdo tu reunión {{reunion_cuando}} a las {{reunion_hora}}.⏎Para entrar: {{reunion_link}}» |
| u11e60 → u11t60 | — | DELAY «1 h antes» → WhatsApp: «Hola {{nombre}}, tu reunión empieza {{reunion_faltan}}, a las {{reunion_hora}}.⏎Para entrar: {{reunion_link}}» |
| u11e15 → u11t15 | — | DELAY «15 min antes» → WhatsApp: «Hola {{nombre}}, empezamos {{reunion_faltan}}.⏎Entra aquí: {{reunion_link}}» |

- Los tres AI Step que se pliegan están en los índices 9-11, al final del array: ningún índice se corre.
- Borrador (no vigente) y posiciones: en null.

Texto del aviso «Nuevo agendado» (u11aviso, una parte de texto). Cada renglón cuyo dato no tenga valor se va
entero (regla del renglón opcional):

```
🎯 *Nuevo agendado*: {{nombre_completo}} reservó su {{reunion_cual}} para {{reunion_cuando}} a las {{reunion_hora}}.
Vino del anuncio "{{lead_utm_campaign}}".
📱 {{lead_telefono}}
✉️ {{lead_email}}
{{lead_respuestas_agenda}}

👉 {{link_lead}}
```

**#228 «Recordatorio de la reunión» · PRENDIDA (emisor aparte)**
- ANTES: «1 día / 1 h / 15 min antes» → tres WhatsApp con `{{cuando}} {{hora}} {{faltan}} {{link}}`.
- DESPUÉS: **ARCHIVADA** en la misma corrida (activa false, `archivada_at`). Vive en el camino 3 de #213.

**#239 «Aviso de nuevo agendado» · PRENDIDA (Evento de MaKo `lead_agendo`)**
- ANTES: una «MaKo en WhatsApp» con `{{mensaje_mako}}`.
- DESPUÉS: **ARCHIVADA**. Vive en el camino 2 de #213.

**#238 «Felicitación por pasar la clase» · PAUSADA**
- ANTES: Email «¡Felicidades por completar la clase!» → poner la etiqueta 2.
- DESPUÉS: tarjetas sin cambios. Su lista de CRON se hace coherente (decisión en §9) y sigue pausada.
- Su email no saldría: el ws1 no tiene dominio propio (decisión 3).

**Inscripciones del ws1 con reunión por delante:**
- 201 (lead 2593, R1 13/10 17:00 UTC, hoy 'no_responde') y 202 (lead 2636, R1 20/10 17:00 UTC, hoy
  'completada').
- Se re-arman SÓLO en el camino 3: estado 'activa' y `hilos` = [u11e1440] con el `proximoDe` del motor, por
  compare-and-set. El desenlace ya registrado no se toca.
- Las marcas compartidas `mako.recordatorio-lead.*` (M3) evitan repetir un toque que #228 ya mandó.
- El primer toque real de #228 es el de 2593, el 12/10 a las 17:00 UTC. Si el script corre después, ese ya
  salió y la marca lo protege.

### ws13 · Código Inmobiliario (cliente)

| Fila | ANTES | DESPUÉS |
|---|---|---|
| #240 «Aviso de nuevo agendado» · PRENDIDA | Evento de MaKo `lead_agendo` → «MaKo en WhatsApp» `{{mensaje_mako}}` | **ARCHIVADA** |
| #223 «Agendó: confirmación de auditoría» · PAUSADA, 0 inscripciones (nunca corrió) | CRON «(de antes)» `agendado_sin_confirmar` · inicio con 2 caminos: [tiene teléfono] → WhatsApp de confirmación; [tiene email] → Email de confirmación → «1 día antes» → Email · «Si responde» clásico (4 casos + otra cosa) | **ARCHIVADA** (decisión, §9) |
| #224 «No asistió: reagendar auditoría» · PAUSADA | CRON «(de antes)» `no_show_j1` · WhatsApp → DELAY 2 días → CONDITION → Email · «Si responde» clásico | **ARCHIVADA**: ws13 no tiene etapa de no-show |
| **NUEVA «Un Lead Agendó Llamada»** · PRENDIDA | — | CRON **«Pre R1»** (`etapa_actual` `agenda`, funnel 6) → «MaKo en WhatsApp» «Nuevo agendado», mismo texto que el ws1 |

- Al crearla, el script pre-siembra una inscripción 'completada' con `reunion_at` para cada lead que ya está en
  «Pre R1»: hoy 9 (2589, 2596, 2597, 2603, 2620, 2624, 2633, 2640, 2643; se vuelve a medir al aplicar).
- Sin eso, el barrido de la hora le manda al grupo del cliente 9 «Nuevo agendado» viejos.
- El reuso al reagendar (M2, por el tipo de la etapa) mantiene «un aviso por reserva», como hoy.

### ws4 · Cliente de Diseño (pausadas, en el lugar)

| Fila | ANTES | DESPUÉS |
|---|---|---|
| #209 «Bienvenida — dejó sus datos y no agendó» → «Un Lead Entró» | CRON «(de antes)» `instant_form_sin_agenda` → DELAY 1 h → Audio #27 (para aprobar) | CRON «Lead entrante» (funnel 5) → CONDITION «Llegó hace menos de 30 días» y «No agendó» → Audio #27 (para aprobar) |
| #210 «Agendó — confirmación y preparación» → «Un Lead Agendó Llamada» | CRON «(de antes)» `agendado_sin_confirmar` → CONDITION «Ya le escribiste» → DELAY 1 h → Audio #26 · Si no → DELAY 1 h → Audio #25 | CRON «Agenda R1» (funnel 5) → DELAY 1 h → CONDITION «Ya le escribiste» → Audio #26 · Si no → Audio #25 |

Los 30 días (720 h) de #209 son el equivalente de `ENTRADA_DE_ANTES` (`lib/cron-de-antes.ts`).

### Lo que no se toca en datos
- `app_settings` del recordatorio viejo (`chatbot.recordatorio_reunion`, ws1 y ws11 `activo:false`).
- El store de `chatbot-aviso-equipo`: nadie lo apagó.
- Las `RESEND_API_KEY` del ws1 y del ws4.

## 4. El motor: lo que tiene que aprender antes de mover los datos

Sin esto, «Un Lead Agendó Llamada» manda PEOR que #213 + #228 + #239.

- **M1 · Entrar al instante a la etapa derivada.**
  - `enrolarPorEvento(lead, 'agenda_nueva')` también inscribe en las vistas `etapa_actual` cuya etapa es la
    efectiva del lead (`pipelineStageOf`) en su funnel, por el mismo camino que el evento 'etapa'
    (`secuenciasDeEtapa` + `unaPorSecuencia`). Lo llaman Calendly y Cal.com.
  - **M1-b** (recomendado): lo mismo cuando `updateLead` cambia la etapa DERIVADA (`lib/leads.ts:1052-1057`), por
    ejemplo una fecha cargada a mano o la asistencia.
  - `lead_nuevo` no se toca: la Bienvenida queda con el barrido de la hora (0-60 min).
- **M2 · «Prepara una reunión» por la FORMA del flujo.** Función pura `preparaReunion(sec)` en
  `lib/nutricion-familias.ts`. Vale si se cumple alguna:
  - el trigger es de la familia `agendado_*` o `TRIGGER_AGENDA_SIN_CONFIRMAR`;
  - algún disparador `etapa_actual` es de una etapa de tipo `reunion`;
  - hay un DELAY «antes de la reunión».

  Reemplaza a `preparaUnaReunion(trigger)` en todos sus usos (`lib/nutricion.ts`, `lib/nutricion-desenlace.ts`;
  `preparaUnaReunion` queda exportada como la parte «por trigger» de la regla):
  - `reunion_at` al inscribir;
  - el reuso al reagendar (Martín, 06/10: «también con reunión nueva»);
  - «la reunión ya pasó»;
  - el corte de la charla del AI Step después de la reunión.
- **M3 · El carril del recordatorio.** Aplica a toda tarjeta (mensaje o «MaKo en WhatsApp») que cuelga de un
  DELAY «antes de la reunión» (`minutosAntesDeReunion != null`). Reglas del emisor de hoy, con un helper puro en
  `lib/nutricion-grafo-motor.ts`:
  - (a) ancla en `proximaReunion(…, {estricta:true})`;
  - (b) si se pasó más de `TOLERANCIA_MIN` (12 min), no sale: se anota «omitido» y sigue;
  - (c) reclama la MISMA marca `claveToque(lead, R1|R2, inicioIso, min)` con `cambiarSettingSi` y marca
    «enviado:» después;
  - (d) no pasa por el anti-ban (`frenadoPorAntiBan`);
  - (e) no cuenta para los topes;
  - (f) fuera del horario de envío, `procesarEnvios` corre SÓLO el carril y las tarjetas «MaKo en WhatsApp»
    (decisión, §9);
  - (g) con reunión futura pero sin hora, se cierra ESE hilo, no la inscripción;
  - (h) una reunión cancelada (fecha en null) no cuenta.
- **M4 · Una respuesta no apaga el carril.**
  - `pausarPorRespuesta` sigue marcando 'respondio', pero deja vivos los hilos del carril y su
    `proximo_envio_at`.
  - `inscripcionesVencidas` también levanta las 'respondio' con un hilo del carril vencido, y `procesarEnvios`
    sólo avanza esos hilos.
  - El resto (el «no confirmó», el «¿alcanzaste a ver el video?») se sigue cortando, como hoy.
- **M5 · Datos «Próxima reunión»** (`reunion_cuando`, `reunion_hora`, `reunion_faltan`, `reunion_link`,
  `reunion_cual`) y «Lo que contestó al agendar». Salen de la MISMA `proximaReunion` estricta. Ver §5.
- **M6 · Reservar limpia la etapa de «no agendó» puesta a mano.**
  - Aplica cuando una reserva de R1 (webhook de Calendly o Cal.com) llega a un lead cuyo override es una etapa
    de «no tiene reunión»: `lead`, `nutri`, `reactivacion` o `noshow_r1`.
  - El override se limpia y la etapa se deriva a «Agenda R1».
  - Son las transiciones «Agenda tardío» y «Reagenda R1» que el embudo ya declara (`lib/pipeline.ts:143,142`).
  - Queda auditado (campo 'Etapa', autor 'MaKo') y dispara M1.

## 5. Datos (catálogo, resolvedor y validación)

- **El catálogo es UNO** (`lib/variables-aviso.ts`). Lo que se ofrece sale de `datosOfrecidos(contexto)`, el
  MISMO contexto con el que el motor resuelve y Publicar valida.
- **«Próxima reunión»** (grupo «Reuniones», alcance lead, ambos destinos):

  | Dato | Ejemplo | Sale de |
  |---|---|---|
  | `reunion_cuando` | «mañana» | `cuandoEs` |
  | `reunion_hora` | «10:00 a. m.» | `horaDe`; sólo con hora |
  | `reunion_faltan` | «en 1 hora» | `faltanTexto`, calculado AL MANDAR |
  | `reunion_link` | — | el link de esa reunión |
  | `reunion_cual` | «1ª reunión» | — |

  Todas salen de `proximaReunion(l, ahoraMs, {estricta:true})` (en `lib/nutricion-reinscripcion.ts`).
  `reunionFuturaMs` delega en la laxa, que además deja de contar las canceladas.
- **`lead_respuestas_agenda`** «Lo que contestó al agendar»: la última fila de `lead_respuestas`, un renglón por
  respuesta. Es lo único del aviso de Cal.com que no se podía citar.
- **`lead_escribio`** «Lo que escribió»: alcance nuevo 'escrito' (`ContextoDatos.conEscrito`), sólo para
  `lead_contesta`. Lo pasan sus emisores en `datos` (`lib/chat-agent-handoff.ts` y los de `lib/nutricion.ts`).
- **Los datos del pago** (grupo «Pagos», alcance nuevo 'pago', `ContextoDatos.conPago`, sólo `pago_recibido`, al
  equipo). Los pasa `avisarPagoRecibido` (`lib/cobros.ts`) en `datos`, por código y nunca por un modelo (es plata):

  | Dato | Ejemplo | Sale de |
  |---|---|---|
  | `pago_monto` | «US$ 2.300» | `formatoMonto(monto, moneda)` del pago (la renovación trae el suyo) |
  | `pago_concepto` | «Mentoría» | `cobro.concepto` |
  | `pago_pasarela` | «Stripe» | `NOMBRE_PASARELA[cobro.proveedor]` |
  | `pago_tipo` | «Primer pago» / «Renovación» | `renovacion` |
  | `pago_modo` | «Prueba» o vacío | `cobro.modo === 'prueba'`; vacío en un pago real (su renglón se va) |
  | `pago_alta` | «Cuenta creada» / «Ya tenía cuenta» / «El alta falló» | `lineaDelAlta`, sólo en una venta de MaKo; vacío fuera |

- Cada alcance es UNA rama en positivo de `alcanzaPara` (como 'cuota'): un alcance nuevo no se cuela en otro evento.
- **`mensaje_mako`**: oculto y nunca ofrecido (desde la ola 3, §1.11). Se resuelve sólo para filas vivas que lo
  tengan, hasta la limpieza (§8.7).
- **Una forma de hora**: «10:00 a. m.» también en `lead_hora_r1/r2` y en `hora`. Ninguna fila viva los usa.
- **Renglón opcional** (`sinRenglonesVacios`): un renglón que nombra un dato DEL CATÁLOGO sin valor se va
  entero. Lo desconocido queda crudo y Publicar no lo deja pasar.
  - Sin esta regla, 52 de 55 recordatorios del ws1 saldrían con el link crudo.
  - El HTML del email no se recorta (queda anotado).
- **`textoConDatos`** = `aplicarVariables(sinRenglonesVacios(t, vars), vars)`. Lo usan todos los envíos del
  motor, el aviso al equipo, los eventos y «Probar».
- **Publicar valida los tokens de TODA tarjeta.** `problemasDeTokens(pasos, trigger, subtipo)` usa
  `contextoDeTarjeta`:
  - mensaje al lead no oficial, email o social = lead + conLead;
  - mensaje oficial = los 4 de siempre;
  - «MaKo en WhatsApp» en un flujo de lead = equipo + conLead;
  - fila de evento = los datos del evento.

  El motivo es corto: «No existe: {{x}}». Lo llaman `setSecuenciaPasos` (la API hereda) y `frenoDelFlujo`. El
  ✦ escribe con el mismo árbol.
- **La zona** de toda hora citada es `zonaDelNegocio(ws)`, sin importar el destino.

## 6. AI Step (modelo, editor e IA)

- **Nodo** (`paso_ia: true`): `objetivo` (≤300, obligatorio para Publicar), `audio?: {voz}` (sólo WhatsApp),
  `ejemplos?` (≤6).
- **Caso** (escenario): `id`, `titulo`, `cuando`, `responder`, `sola`, `no_contesta`, `cualquiera`.
  - En los TIPOS quedan como `@deprecated` (los lee `juntarPasosIA`): `objetivo`, `audio`, `ejemplos`, `hasta` y
    `avisar` del caso; `instrucciones` y `otra_aviso` del nodo.
  - El saneo deja de escribirlos.
- **Libertad** (`lib/ai-step-libertad.ts`, puro):
  - `libertadDeCaso`;
  - `camposDeLibertad`: la única que escribe `sola`/`no_contesta`;
  - `libertadesPermitidas`: sin Sola si habla de plata o es «Lo demás»; sin responder, sólo «avisa»;
  - `avisaElCaso`: la libertad no es 'sola'.
- **`juntarPasosIA`** (puro, idempotente): junta por medio los AI Step no sueltos en el primero del array.
  - Conserva ids y orden.
  - Sube al nodo objetivo, audio y ejemplos; si no coinciden, van a `conflictos`.
  - Pliega `instrucciones` en cada responder y saca un `cualquiera` que sólo avisa.
  - Devuelve `{pasos, cambio, conflictos, perdidos}`.
- **Validación al publicar:**
  - falta el objetivo;
  - más de 10 escenarios;
  - dos «Lo demás»;
  - un escenario sin nombre o sin «cuándo»;
  - nombres repetidos (el clasificador elige por posición);
  - audio fuera de WhatsApp;
  - más de un AI Step por medio.
  - Se va «tiene más de un caso».
- **Editor** (`EditorPasoIA.tsx`, reescrito), 4 pasos con uno abierto a la vez:
  1. **Objetivo**: textarea + dictar/grabar + «✦ Armar».
  2. **Escenarios**: por fila, nombre + Dropdown de libertad con íconos + `BotonBorrar`; la última fila es
     «Lo demás»; abajo, «＋ Escenario» (catálogo con buscador + «✦ Otro con MaKo»).
  3. **Responde con**: Texto/Audio + voz.
  4. **Ensayar**.
  - Se van «Hasta», «Te aviso cada vez», los textos de ayuda y «＋ Otro AI Step».
- **IA:**
  - `ai-step-armar`: contrato `{escenarios:[{titulo,cuando,responder,libertad}], lo_demas}` y `repararArmado`.
  - `ai-step-ensayo`: las objeciones salen del AI Step entero, y «Responde MaKo» clasifica igual que «Probar».
  - «Crear con IA» suma `objetivo` a la tarjeta `si_responde` y pliega a UN AI Step.
- **API:**
  - `fichaPasoIA` devuelve objetivo, medio, audio, ejemplos y escenarios con su libertad.
  - `agregar_escenario_secuencia` y `resolver_handoff` suman un escenario ADENTRO del AI Step
    (`agregarCasoAlGrafo`).

## 7. Plantillas (la galería)

El catálogo de 13 está en el punto 10. Contrato de cada plantilla:

- `problemasDeForma` vacío y `problemasDeTokens` vacío.
- UN AI Step con objetivo y 2 o más escenarios del catálogo `ESCENARIOS_TIPICOS`.
- Las tarjetas «MaKo en WhatsApp» con `partes` y los datos a la vista.
- Equivalencias de la libertad vieja: sola+avisa → «Para aprobar»; revisar → «Para aprobar»; sólo aviso →
  «Sólo te avisa».
- Cada camino pregunta su canal en la condición de entrada: un email a quien no tiene email cancela la
  inscripción entera.
- Detalle de «Un Lead Agendó Llamada»: tres caminos.
  1. Recordatorios y equipo:
     - [Próxima reunión ≤ 720 h · Tiene WhatsApp] → MaKo «Nuevo agendado»;
     - «24 h antes» → WhatsApp;
     - «1 h antes» → WhatsApp;
     - «30 min antes» → MaKo «Reunión en 30 min»;
     - «15 min antes» → WhatsApp.
  2. Confirmar:
     - [≤720 h · Tiene WhatsApp · Ya le escribiste] / [≤720 h · Tiene WhatsApp] → WhatsApp;
     - DELAY 1 día → [≤720 h] → MaKo «No confirmó».
  3. Email: [≤720 h · Tiene email] → Email «Tu reunión quedó agendada» → «24 h antes» → Email.
  - AI Step «Que llegue a la reunión».
  - Los textos usan los datos «Próxima reunión».
- Fuera de la galería y del selector del CRON: la plantilla `recordatorio-reunion` (el CRON del emisor) y los
  eventos de MaKo `lead_agendo` y `reunion_pronto`. Los hace «Un Lead Agendó Llamada». Quedan `cuota_vencida`,
  `lead_contesta` y `pago_recibido`.
  - Los dos que se van siguen en `EVENTOS_MAKO` con una marca `retirado` (no se ofrecen) hasta la limpieza: sin
    ellos, `eventoDeFila` devolvería null para #239/#240 entre el deploy y el script.
- Las tres de Evento de MaKo, con datos citables:
  - `mako-charla`: «💬 {{nombre_completo}} te escribió y no le contesté.⏎«{{lead_escribio}}»⏎👉 {{link_lead}}».
  - `mako-pago`: «💰 *Entró un pago*: {{nombre_completo}} pagó *{{pago_monto}}* por {{pago_pasarela}}
    ({{pago_concepto}}).⏎{{pago_tipo}} · {{pago_modo}}⏎{{pago_alta}}⏎👉 {{link_lead}}» (el texto final lo ajusta el
    paquete; los datos son éstos).
  - `mako-cobranza`: la de hoy (ya usa datos de la cuota).
- API: `listar_plantillas_automatizaciones` (lectura) y `crear_automatizacion_desde_plantilla` (confirmación
  'chat', admin, sin 'http').

## 8. Orden de despliegue y de datos

1. **Decisiones de Martín** (§9). Lo que tenga un default recomendado se implementa con ese default y se puede
   dar vuelta.
2. **Antes o junto con el deploy:**
   - Migración `0257_setting_audios_voz_mako.sql` (o la siguiente libre: `ls supabase/migrations` en el worktree Y
     en el clon; la 0255 es de la pasarela y la 0256 de Offer): el CHECK de `setting_audios.origen` suma
     'voz_mako'. Se aplica con `scripts/apply-migration.mjs`. Su cabecera dice el orden: ANTES o JUNTO con el
     deploy.
   - Sin ella, generar la voz falla ruidoso con 23514; y SÍ se cobra: el insert va después del TTS
     (≤700 caracteres por intento; `crearAudio` borra el binario subido). Por eso va antes o junto con el deploy.
   - No hay otra migración: zona, email, AI Step, pagos y flujos usan columnas que ya existen.
3. **Secretos** (Martín): pagar la factura abierta de ElevenLabs (US$6; la cuenta está `past_due`) y cargar
   `MAKO_ELEVENLABS_API_KEY` en Vercel Production y en `.env.local`.
   - Sin esto, «Generar la voz de MaKo» falla con su motivo y sin reintentar. Todo lo demás anda.
4. **Commit y push** del código de las cuatro olas, desde el worktree (`git push origin undecima:main` tras
   rebasear). Después del commit, el cierre regenera `docs/api-mako.md` y `tests/api-mako-http.snapshot.txt`
   (`node --import tsx scripts/generar-api-doc.mjs`). Verificar `vercel ls` → Ready: pushear no es desplegar.
5. **Scripts de datos.** Todos corren primero en SIMULACRO; leen con service role filtrando `workspace_id`;
   dejan un respaldo releído y comparado en `backups/`; escriben con compare-and-set sobre `updated_at` y jsonb
   como objeto.
   1. `scripts/zona-negocio-backfill.mts`: compatible con el código viejo y el nuevo, así que podría ir antes.
      Se recomienda después del OK. Respaldo `backups/zona-negocio-<ISO>.json`.
   2. `scripts/undecima-email-remitente.mts`: `resend_from` del ws1 → `''`. Respaldo
      `backups/undecima-email-remitente-<ts>.json`.
   3. `scripts/voz-mako-agregar.mts`: agrega «David» a la cuenta de la plataforma. Es API externa, gratis, y va
      después del pago.
   4. **`scripts/undecima-flujos.mts`, el último.**
      - El simulacro imprime cada flujo antes y después en palabras, y qué pasa con cada inscripción viva.
      - Con `--aplicar`: respaldo `backups/undecima-flujos-<ts>.json` (filas, inscripciones y marcas), releído.
      - Orden en el ws1: medir → #213 → re-armar 201/202 → archivar #228 y #239 (misma corrida) → #198 → #238.
      - Después ws13 (fila nueva + pre-siembra → archivar #240, #223, #224), ws4 (#209, #210 pausadas), toda fila
        viva de un Evento de MaKo con `{{mensaje_mako}}` que no esté en §3 (se reescribe con la plantilla nueva de su
        evento), y releer y comprobar.
      - `--restaurar=<respaldo>` vuelve atrás desde el respaldo, también en simulacro por defecto.
6. **Volver atrás:**
   - restaurar el respaldo: `archivada_at` null en #228/#239/#240 y los `pasos` viejos. El emisor y el webhook
     los vuelven a leer en el acto;
   - las marcas compartidas evitan el doble envío;
   - volver a un deploy anterior DESPUÉS de aplicar es destructivo: el código viejo no conoce
     objetivo/audio/ejemplos del nodo, el primer guardado los borra y el lienzo viejo parte el AI Step.
7. **Limpieza (commit aparte, DESPUÉS de `--aplicar` y con la medición «0 filas vivas» que los usen):**
   - borrar la compatibilidad de `{{mensaje_mako}}`: la inyección en `emitirTarjetaDelEvento` (`lib/flujos.ts`),
     `CLAVE_MENSAJE_MAKO`, el alcance 'mensaje', `conMensaje`, el `texto` que los emisores siguen pasando por
     compatibilidad (webhooks de agenda, charla, `avisarPagoRecibido`), y los subtipos `lead_agendo`/`reunion_pronto`
     de `SubtipoMako` y `EVENTOS_MAKO`;
   - borrar el emisor del recordatorio: `lib/reunion-recordatorio.ts` y su cron (`vercel.json`,
     `app/api/cron/reunion-recordatorio/route.ts`), `VARIABLES`, `textoDelToque`, `problemaDelTexto`, lo que quede
     de `lib/recordatorio-automatizacion.ts` (`DATOS_RECORDATORIO`, `EJEMPLOS_RECORDATORIO`, `TRIGGER_RECORDATORIO`),
     la rama del recordatorio en `FlujoLienzo.tsx` (`EditorMensaje`), `PanelProbar.tsx` y `MakoRedacta.tsx`,
     `esRecordatorio`/`frenoDelRecordatorio` en `SecuenciaPerfil.tsx`, y `TRIGGER_RECORDATORIO` de
     `TRIGGERS_DEL_EMISOR` — **sólo ése: `TRIGGER_AVISO_MAKO` se queda** (§1.9). Las marcas
     `mako.recordatorio-lead.*` y `claveToque` se quedan: las usa el carril del motor (M3);
   - la fila de feed duplicada de `reunion-nuevo-agendado` del webhook (decisión).

### Paquetes y olas (dueño de archivo: dos paquetes de la misma ola nunca tocan el mismo archivo)

Un archivo aparece en UNA fila por ola. Los tests van con su archivo dueño (lista exacta en cada encargo).

| Ola | Paquete | Qué | Archivos que son SUYOS en esa ola |
|---|---|---|---|
| 1 | `w1-aistep-modelo` | modelo del AI Step, `juntarPasosIA`, libertad, catálogo de escenarios, la tarjeta | `lib/flujo-grafo.ts`, `lib/ai-step-libertad.ts`*, `lib/ai-step-escenarios.ts`*, `lib/nutricion-grafo-motor.ts` (saneo del AI Step), `lib/flujo-conversacion.ts`, `lib/flujo-edicion.ts`, `lib/flujo-legado.ts`, `lib/paso-ia-convertir.ts`, `lib/lienzo-grafo.ts`, `lib/ai-step-voz.ts`, `lib/ai-step-migrar.ts`, `scripts/ai-step-v2.mts`, `lib/plantillas-automatizaciones.ts` (sólo `aiStep`), `app/automations/FlujoLienzo.tsx` (sólo el montaje del AI Step), `app/automations/EditorPasoIA.tsx` (sólo la tarjeta y «＋ Otro») |
| 1 | `w1-datos-catalogo` | catálogo, «Próxima reunión», respuestas, pago, «Lo que escribió», renglón opcional, `problemasDeTokens` (puro), `proximaReunion` | `lib/variables-aviso.ts`, `lib/variables-del-lead.ts`, `lib/variables-resolver.ts`, `lib/nutricion-reinscripcion.ts`, `lib/curso-mensajes-texto.ts`, `lib/recordatorio-lead.ts`, `lib/respuestas-agenda.ts`*, `lib/calcom.ts`, `lib/tokens-del-flujo.ts`*, `lib/aviso-evento.ts`, `lib/disparadores.ts`, `lib/cobros.ts` (sólo el aviso), `lib/chat-agent-handoff.ts` |
| 1 | `w1-zona` | zona única, detección, backfill | `lib/zona-negocio-reglas.ts`*, `lib/timezone.ts`, `app/_components/ZonaDelNegocio.tsx`*, `app/_components/zona-actions.ts`*, `app/layout.tsx`, `app/configuraciones/horario-actions.ts`, `app/configuraciones/HorarioEnvioPanel.tsx`, `lib/api-mako/areas/equipo.{run,def}.ts`, `lib/api-mako/areas/contenido.helpers.ts`, `lib/api-mako/areas/email.helpers.ts`, `lib/avisos-programados.ts`, `lib/lineas-vigilante.ts`, `lib/reunion-auto.ts`, `lib/acento-workspace.ts`, `scripts/zona-negocio-backfill.mts`* |
| 1 | `w1-email` | remitente positivo, key de la plataforma, UI de email | `lib/email-remitente.ts`, `lib/resend.ts`, `lib/resend-remitente.ts`, `lib/email-marketing.ts`, `lib/prueba-paso.ts`, `lib/integraciones.ts`, `lib/credenciales.ts`, `lib/medios-automatizacion.ts`, `lib/disparadores-canales.ts`, `lib/api-mako/areas/email.run.ts`, `app/api/{email/dominio,compartir,integraciones/credencial,metodo,onboarding}/route.ts`, `app/automations/EditorEmailGmail.tsx`, `app/automations/PanelProbar.tsx`, `scripts/undecima-email-remitente.mts`* |
| 1 | `w1-mako-envio` | tarjeta «MaKo en WhatsApp» por partes, envío al grupo, Voz de MaKo, mig 0257 | `lib/mako-tarjeta.ts`*, `lib/mako-tarjeta-envio.ts`*, `lib/voz-mako-reglas.ts`*, `lib/voz-mako.ts`*, `app/api/automations/voz-mako/route.ts`*, `supabase/migrations/0257_setting_audios_voz_mako.sql`*, `scripts/voz-mako-agregar.mts`*, `lib/api-mako/areas/chatbot.{def,run}.ts`, `lib/avisos.ts`, `lib/mako-grupo.ts`, `lib/mako-chat.ts`, `lib/elevenlabs.ts`, `lib/setting-audios.ts`, `lib/mensaje-partes.ts` |
| 1 | `w1-lista-ui` | filetes, barra unida, menú, Renombrar | `app/_ui/Tabs.tsx`, `app/automations/{ConfiguracionesBoton,SimuladorWhatsApp,ChatAgentApp,SecuenciaPerfil,RecorridoAutomations}.tsx`, `app/automations/recorrido-automations.ts`, `lib/setting-estrategia.ts`, `lib/setting-secuencias.ts`, `app/api/chat-agent/secuencias/route.ts` |
| 2 | `w2-motor-reuniones` | M1, M1-b, M2, M3, M4, M6 | `lib/nutricion.ts`, `lib/nutricion-familias.ts`, `lib/nutricion-grafo-motor.ts`, `lib/nutricion-reinscripcion.ts`, `lib/nutricion-desenlace.ts`, `lib/nutricion-etapa.ts`, `lib/leads.ts`, `lib/recordatorio-lead.ts`, `app/api/webhooks/{calendly,calcom}/route.ts` |
| 2 | `w2-aistep-editor` | editor del AI Step, armar, ensayo, «Crear con IA», API del AI Step, DTO | `app/automations/{EditorPasoIA,ModalEnsayoAIStep,ChatAgentApp}.tsx`, `app/automations/recorrido-automations.ts`, `lib/ai-step-armar.ts`, `lib/ai-step-ensayo.ts`, `app/api/automations/ai-step/{armar,ensayo}/route.ts`, `lib/flujo-ia.ts`, `lib/paso-ia-convertir.ts`, `lib/prompt-registry.ts`, `lib/setting-simulador.ts`, `lib/api-mako/areas/chatbot.{def,run}.ts` |
| 2 | `w2-mako-editor` | editor de la tarjeta MaKo = el de WhatsApp, ✦ para el equipo, partes en el evento | `app/automations/{FlujoLienzo,EditorMensajeWhatsApp,MakoRedacta}.tsx`, `lib/mako-redacta.ts`, `app/api/chat-agent/redactar/route.ts`, `lib/flujo-conversacion.ts`, `lib/flujo-edicion.ts`, `lib/aviso-evento.ts`, `lib/flujos.ts`, `lib/flujos-tipos.ts`, `lib/mako-tarjeta.ts` |
| 3 | `w3-motor-integracion` | el motor adopta AI Step, datos, zona y email; Publicar valida datos | `lib/nutricion.ts`, `lib/nutricion-grafo-motor.ts`, `lib/variables-resolver.ts`, `app/api/cron/nutricion-tick/route.ts`, `lib/flujo-conversacion.ts`, `lib/setting-estrategia.ts`, `lib/flujos.ts` |
| 3 | `w3-datos-editores` | `CampoConDatos`, el «{ }» con el dato elegido, «Probar» con los datos nuevos | `app/_components/CampoConDatos.tsx`*, `app/_components/SelectorDatos.tsx`, `app/whatsapp/_shared/ComposerWhatsApp.tsx`, `app/automations/{EditorMensajeWhatsApp,FlujoLienzo,EditorMensajeSocial,EditorEmailGmail,PanelProbar}.tsx`, `app/agencia/FlujoAviso.tsx`, `app/_ui/EditorRico.tsx`, `lib/simulador-grafo.ts` |
| 3 | `w3-plantillas` | las 13 plantillas, `problemasDeForma`, «Crear con IA», API de plantillas, ocultar `{{mensaje_mako}}` | `lib/plantillas-automatizaciones.ts`, `lib/plantilla-crear.ts`, `lib/flujo-forma.ts`*, `lib/ai-step-objetivos.ts`, `app/automations/{GaleriaPlantillas,ChatAgentApp}.tsx`, `lib/flujo-ia.ts`, `lib/prompt-registry.ts`, `lib/api-mako/areas/chatbot.{def,run}.ts`, `lib/disparadores.ts`, `lib/variables-aviso.ts`, `lib/avisos-catalogo.ts` |
| 4 | `w4-flujos-prod` | el script que rehace prod, scripts viejos neutralizados, alias muertos | `lib/undecima-flujos-plan.ts`*, `scripts/undecima-flujos.mts`*, `scripts/{mudanza-nuevo-agendado,novena-tanda-ws1,migrar-cron-de-antes}.mts`, y los llamadores de los alias `@deprecated` |

`*` = archivo nuevo.

Reglas de la transición entre olas:
- Un paquete deja el árbol compilando (`node scripts/typecheck-lock.mjs`). Si cambia una interfaz que consume un
  archivo que no es suyo, deja el nombre viejo como `@deprecated` y avisa; el alias lo borra `w4-flujos-prod`. El
  caso grande: `separarPasosIA` pasa a ser un alias de `juntarPasosIA` en la ola 1, así `lib/nutricion.ts` y
  `SecuenciaPerfil.tsx` juntan desde ya sin tocarse.
- Si un cambio rompe un test de otro paquete de la misma ola, no se edita: se anota (test, aserción, porqué) y lo
  arregla el cierre de la ola, que corre el typecheck y los tests tocados por la ola.
- Nadie regenera `docs/api-mako.md` ni el snapshot: lo hace el cierre después del commit (el `--check` compara
  contra HEAD). Ninguna operación nueva lleva `'http'`.
- Nadie escribe `docs/hallazgos-*`, `AGENTS.md` ni la bitácora: cada paquete devuelve sus hallazgos y el cierre
  cosecha.

## 9. Decisiones que Martín puede dar vuelta

Cada una va con la recomendada primero y cómo se da vuelta.

**Flujos**

1. **Rehacer en el lugar** #198 y #213 (mismo id) y archivar #228/#239/#240/#223/#224. Alternativa: filas
   nuevas, archivando todo lo viejo.
2. **Nombres.** #213 → «Un Lead Agendó Llamada» (pedido). Recomendado, por consistencia con las plantillas:
   #198 → «Un Lead Entró», #209 → «Un Lead Entró» y #210 → «Un Lead Agendó Llamada». Se dan vuelta con
   «Renombrar».
3. **CRON sólo en «Agenda R1»**, como #213 hoy. Alternativa: sumar «Agenda R2» (la R2 hoy la cubren el emisor y
   #239; en 60 días el ws1 tuvo 1 lead en R2).
4. **M6:** reservar una R1 limpia la etapa de «no agendó» puesta a mano. Sin esto, ~7 % de las agendas del ws1
   (4 de 54 en 90 días) no entran al flujo. Alternativa: no limpiar y aceptar la pérdida.
5. **M1-b:** una reunión cargada a mano en la ficha también inscribe al instante. Alternativa: esperar al barrido
   de la hora.
6. **El carril de recordatorios**, como el emisor de hoy:
   - sale fuera del horario de envío, no cuenta para los topes y no lo frena el anti-ban;
   - tolera 12 min;
   - sigue aunque el lead conteste.

   Alternativa: que una respuesta apague los recordatorios, o que el horario los frene.
7. **«MaKo en WhatsApp» al equipo sale también fuera del horario de envío**, como hoy el aviso del webhook.
   Alternativa: esperar a la apertura (a las 9:00).
8. **Leads 2593 y 2636:** re-armar sólo los recordatorios y archivar #228 ya. Alternativa: dejar #228 prendida
   hasta el 20/10.
9. **ws13:** fila nueva «Un Lead Agendó Llamada» PRENDIDA con sólo el aviso, que es lo único que corre hoy; #223
   y #224 se archivan. Alternativa: rehacer #223 completa (confirmación por WhatsApp, emails, AI Step) y elegir:
   - prendida: sus leads empiezan a recibir mensajes;
   - pausada: el equipo pierde el aviso.
10. **ws4:** #209 y #210 rehechas y pausadas. Alternativa: archivarlas.
11. **#238:** su lista de CRON (lo que lee el motor) dice «Lead entrante» y la columna dice «Entrega del producto
    13». Recomendado: dejar la de Entrega, que coincide con el nombre, y seguir pausada. Alternativa: archivarla.
12. **Bienvenida sin DELAY:** el barrido de la hora da 0-60 min de margen. Alternativa: M1 también para
    `lead_nuevo`.

**AI Step**

13. Objetivos: #213 «Que llegue a su reunión confirmada y sin hablar de cifras»; #198 «Que cuente a qué se dedica
    su negocio y agende una llamada». Cambian lo que redacta MaKo en los 4 escenarios de #213.
14. **Libertad por escenario**: un desplegable en cada fila. Alternativa: uno solo para todo el AI Step, que
    cambia #213.
15. **«Para aprobar» avisa siempre al grupo**; «Sola» no avisa. Con esto, «Pregunta el precio» y «Pregunta por la
    reunión» de #213 empiezan a avisar.
16. Un AI Step por medio, hasta 10 escenarios; «Lo demás» nunca «Sola».
17. Las guías de un escenario no se editan a mano: salen de ✦, del catálogo o del ensayo.

**MaKo en WhatsApp**

18. La tarjeta con `partes` sale TAL CUAL: sin título, sin «— MaKo», sin rótulo, sin dedup de 12 h.
19. Texto del aviso «Nuevo agendado» (§3); se pierde la firma «— MaKo».
20. **Voz de MaKo:**
    - es «David» con los ajustes del VSL, y la paga la plataforma;
    - tope de 5.000 caracteres por negocio y por mes (≈US$0,50);
    - un audio no lleva datos ni links: van en un texto aparte.
21. El push «Reunión agendada» de MaKo Mobile deja de aplicar al aviso, que pasa a ser `chatbot-aviso-equipo`.
    Hay que coordinarlo con esa sesión.

**Email**

22. La plataforma sólo manda a SUS leads con el dominio de MaKo si lo reclama en /email (hoy no).
23. La invitación a un curso de un negocio sin dominio propio sigue firmada por MaKo: es un acceso al portal.
24. `sendEmail` también se niega con el sandbox: un mail de negocio sin remitente propio no sale.

**Zona**

25. Default único Tijuana.
26. La detección va por el navegador de los admins del negocio, y la primera gana.
27. Backfill: ws1 y ws4 Tijuana, ws11 Cancún, ws13 canonizado.

**Datos y pantalla**

28. Una sola forma de hora («10:00 a. m.»).
29. Un dato sin valor borra su renglón.
30. Publicar valida los datos de TODA tarjeta.
31. El dato se ve azul con un espejo, como el token `{{clave}}`, no como un chip con su rótulo: el rótulo
    descuadra el cursor.
32. **Plantillas:**
    - las 13 de §2 punto 10 (las 12 de antes más «Entró un Pago», que ya existía como `mako-pago`);
    - `felicitacion-clase` se retira;
    - del selector del CRON salen «Un lead agenda» y «Falta media hora»;
    - opcional (no se implementa sin su sí): preseleccionar la etapa por su tipo.
33. **Barra lateral:**
    - el menú es un botón cuadrado con ícono, antes del buscador;
    - el recorrido pierde dos pasos;
    - los 2 separadores internos de «Límites» se quedan.

**Pagos (lo que trajo el CRON «Pagos»)**

34. **Sin plantilla del CRON «Pagos»** en esta tanda, como lo dejó la sesión de la pasarela. Opcional (no se
    implementa sin su sí): «Un Pago No Pasó» = CRON «Pagos» › «Se rechaza un pago» → WhatsApp al lead con
    `{{link_pago}}` + «MaKo en WhatsApp» «Pago rechazado». Ojo: «Se aprueba un pago» corre UNA vez por lead (unique),
    así que una bienvenida al pagar no sirve para las renovaciones; el aviso de cada pago lo da el evento.
35. **«Entró un Pago» sigue siendo un Evento de MaKo** (`pago_recibido`), no una tarjeta dentro de un flujo del CRON
    «Pagos»: el evento sale con CADA pago (también las renovaciones) y un flujo del CRON, una vez por lead.
36. **Los datos del pago** (§5): monto, concepto, pasarela, tipo (primer pago / renovación), modo (prueba) y el alta
    de MaKo. El texto de la plantilla los cita; se pierde la firma «— MaKo», como en el resto.

## 10. Lo que queda SIN HACER (con su archivo)

- La limpieza post-`--aplicar` (§8.7).
- El HTML del email no aplica la regla del renglón opcional (`lib/variables-aviso.ts`, `sinRenglonesVacios`).
- El AI Step de Instagram y Messenger (§6 de la v2).
- Las zonas de protocolo siguen en Tijuana o en −06:00: `isoToFechaTijuana`, `parseFechaJunta`,
  `TZ_FECHA_AGENDA`, `crm-auto` y los reportes del dueño.
  - Para el ws13, una reunión entre las 00:00 y las 02:59 de Buenos Aires queda con la fecha del día anterior.
- `RESEND_API_KEY` de la plataforma vive en la fila de credenciales del ws1. Habría que pasarla a
  `NO_MIGRAR_A_WS` (`lib/credenciales.ts`).
- El refresh token de Google Calendar del ws1 contesta `invalid_grant`.
- No medido: que Evolution 2.3.7 mande un mp3 por `sendWhatsAppAudio` a un @g.us. La primera prueba va en el
  ws3, nunca en el ws1.
- No medido: que la cuenta de la plataforma pueda hablar con «David» (cuesta caracteres).
- EN COLA, después de esta tanda (`docs/relevo/chatbot.md`): Automations configura y consume el Dashboard (un Evento
  de MaKo «El AI Analyst terminó», las acciones del Dashboard en ⚡ Acción). Nace con la regla de esta tanda: datos
  atómicos citables, nunca un texto armado por el código (`lib/disparadores.ts`, `lib/avisos-catalogo.ts`,
  `lib/plantillas-automatizaciones.ts`).
- `scripts/ai-step-unico.mts` (el que el relevo de AI Step proponía para juntar lo guardado) NO se hace: medido, sólo
  #198 y #213 tienen AI Step y las reescribe el script de flujos; todo lo demás lo junta `juntarPasosIA` al abrir y
  al guardar.
