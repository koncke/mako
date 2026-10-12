# Automations: Configuraciones, medios sin conectar, remitente propio y CRON de antes — diseño (11/10/2026)

Décima tanda, puntos GENERAL 4 y 6, EMAIL 1 y CRON 2 (pedido literal en `app/admin/dev/chatbot/bitacora.ts`, último hito).
Todo lo «medido» salió de producción el 11/10/2026 con transacciones `read only`; no se escribió nada.

## 0. Lo medido (los 11 workspaces de la base)

- **Automatizaciones vivas: 8.** ws1: #198 Bienvenida (activa), #213 Agendó (activa), #228 Recordatorio (activa, CRON del emisor), #238
  (pausada, email). ws4: #209 y #210 (pausadas). ws13: #223 y #224 (pausadas). Archivadas: 73.
- **Las 8 vivas ya son flujos de tarjetas**: 0 campos de la lista de antes (`delay_horas`, `requiere`, `ancla`), 0 «Ir a», 0 errores de
  `validarGrafo`. Lo viejo que queda en ellas es el **CRON**: 6 de las 8 arrancan por un evento que el panel ya no ofrece
  (`instant_form_sin_agenda` ×2, `agendado_sin_confirmar` ×2, `agendado_primer_contacto` + `agendado_ya_contactado` en #213, `no_show_j1`).
- **Archivadas**: 53 con CRON de antes y 58 todavía en forma de LISTA (56 con `delay_horas`, 28 con `template_wa`, 12 con
  `requiere: respondio`, 2 con «Ir a»).
- **Envíos**: en 60 días sólo el ws1 mandó por nutrición; su máximo fue **6 WhatsApp en un día** (el tope es 40). Respuestas «solas» de
  MaKo (`enviado_por = 'mako-auto'`): **0 en toda la historia**.
- **Horario de oficina**: sólo el ws1 lo tiene prendido (9 a 21, todos los días). **Remitente**: el ws1 tiene `resend_from =
  «MaKo <equipo@hola-mako.com>»`; ws10 y ws11 tienen `RESEND_FROM` propio (credencial). **WhatsApp**: conectados ws1 y ws11; ws9 y ws10
  `conectando` sin número; ws13 `desconectado` desde el 18/08; ws4 sin línea. **Zernio**: ws11 (profile, `webhook_ok` false) y ws13 (key sin profile).

## 1. GENERAL 4 — el botón «Configuraciones»

### Inventario de los números cableados

| Límite (hoy) | Dónde | Configurable | Rango |
|---|---|---|---|
| WhatsApp por día y negocio: **40** en 24 h móviles (env `NUTRICION_MAX_POR_DIA`) | `lib/nutricion.ts:370`, usado en `:3232` | Sí | 1–150 |
| WhatsApp por hora de reloj: **6** (env `NUTRICION_MAX_POR_CORRIDA`) | `lib/nutricion.ts:371`, `:3234`, `:3257`, `:3419`, `enviosEnLaHora` `:2321` | Sí | 1–30 |
| A la misma persona por WhatsApp: **uno cada 20 h** (el freno de la prospección en frío) | `lib/nutricion.ts:378`, `leadsConEnvioReciente` `:2428-2499`, `frenadoPorAntiBan` `lib/nutricion-grafo-motor.ts:679` | Sí | 3–72 h |
| Con reunión en ≤ **48 h**, el freno baja a **3 h** (cadencia de preparación) | `lib/nutricion.ts:383-384`, `:2442` | No | — |
| Email por día y negocio: **100** (env `NUTRICION_MAX_EMAIL_POR_DIA`) | `lib/nutricion.ts:377`, `:3242` | Sí | 1–500 |
| A la misma persona por email: **uno cada 20 h** (mismo `HS_MIN_ENTRE_MSGS`) | `lib/nutricion.ts:2433`, `:2467-2472` | Sí | 1–168 h |
| MaKo contesta sola: **3** por persona en 24 h | `lib/setter-conversacion.ts:177`, `:223`; cuenta en `lib/nutricion.ts:4874-4886` | Sí | 0–10 (0 = siempre borrador) |
| MaKo contesta sola sólo de **9 a 21** (hora entera, zona `tzActual`) | `lib/setter-conversacion.ts:179`, `:224` | Sí (ver abajo) | el horario de oficina |
| La charla con el lead sigue abierta **7 días** | `lib/setter-conversacion.ts:231`, `:290` | Sí | 1–30 días |
| Residuo (+45 días sin cerrar): **10/día, 1/hora** | `lib/nutricion-residuo.ts:47`, `:66`, `:84` | No | — |
| Ventanas de los eventos de antes: 30, 45, 90, 365 días; VSL 50 % | `lib/nutricion.ts:360-362`, `:1042`, `:1069`, `:1223`, `:1232` | No | — |
| «Escribiendo…» `min(1500 + 45·largo, 9000)` ms ±20 % | `lib/evolution.ts:825` | No | — |
| Instagram/Messenger: 24 h del último mensaje, 7 días para un comentario | `lib/canal-social.ts:84` (`decidirSalida`) | No | — |
| Horario de envío (opcional, apagado por defecto) | `lib/horario-envio.ts:27`, `:44`; motor `lib/nutricion.ts:3227-3231` | Ya lo es | medias horas |

### Dónde se guarda y cómo lo lee el motor

- **`app_settings`, clave `mako.limites_envio`**, por workspace y sin herencia (`lib/settings.ts` no hereda), igual que `mako.horario_envio`.
  JSON: `{ wa: { dia, hora, personaHoras }, email: { dia, personaHoras }, mako: { solasPor24h, diasCharla } }`. **Un campo ausente = el
  de fábrica**: sumar uno mañana no pide migración y nadie queda con un valor que no eligió.
- **De fábrica = lo de hoy**: el env si está puesto, si no la constante. Módulo puro sin imports `lib/limites-envio.ts` (molde:
  `lib/horario-envio.ts`): `sanearLimites`, `limitesParaGuardar` (rechaza fuera de rango; nunca recorta en silencio) y `limitesVigentes`.
- **El motor lo lee UNA vez por corrida, ESTRICTO** (`getSettingEstricto`). «No pude leer» no es «de fábrica»: la corrida no manda y
  sale con `saltado: 'limites-ilegibles'`, como el horario (`lib/nutricion.ts:3229`). Reemplaza las constantes en `:3232`, `:3234`,
  `:3242`, `:3257`, `:3419` y pasa `personaHoras` a `leadsConEnvioReciente`.
- **El setter**: `puedeContestarSolo` (pura) recibe el tope y el horario por parámetro; su call site (`lib/nutricion.ts:4874`) los lee.
  El horario de «contesta sola» pasa a ser **el de oficina si está prendido, y 9 a 21 si no**: hoy da lo mismo en los 11 (el único
  prendido es 9–21 todos los días), y deja de haber dos horarios que el dueño no sabe que existen.
- ⚠️ **El tope es por NEGOCIO, no por NÚMERO** (`enviosUltimas24h` cuenta el canal entero). Con dos líneas, las dos comparten 40. Se
  deja así (no cambia nada de lo de hoy) y queda anotado.

### La pantalla

- **«Configuraciones»** (tuerca + rótulo) reemplaza al botón del horario donde hoy se monta `HorarioLista`
  (`app/automations/ChatAgentApp.tsx:693` y `:716`). Abre un `Modal` (`app/_ui/Modal`, con `useCerrarEstable`: AGENTS.md, el foco que se
  pierde por tecla) con dos pestañas (`Tabs`): **Horario** y **Límites**.
- **Horario** = `HorarioEnvioPanel` tal cual (`app/configuraciones/HorarioEnvioPanel.tsx`, ya embebible con `onGuardado`/`onSucio`).
- **Límites** = `LimitesEnvioPanel` nuevo: tres bloques con número + flechas (WhatsApp, Email, MaKo contesta sola), rótulos de 1-3
  palabras («Por día», «Por hora», «Misma persona»), una línea de uso («Hoy: 6 de 40») y «Restaurar». Sólo admin; el setter lo ve sin editar.
- Acciones: `app/configuraciones/limites-actions.ts` (`'use server'`: **sólo funciones async exportadas**; la constante va en el módulo puro).

## 2. GENERAL 6 — una automatización que usa un medio sin conectar

### Qué es «conectado», por medio (una función: `estadoMedios()`)

| Medio | Conectado = | Hoy lo mira |
|---|---|---|
| WhatsApp | la línea de la automatización (`instance_name`; null = la de por default) con `estado = 'conectado'` y número | nadie, para un paso |
| Instagram / Messenger (un paso que MANDA) | Zernio configurado y una cuenta de ESA plataforma (`cuentasConectadas`, `lib/zernio.ts:215`) | el editor del paso (`/api/zernio`) |
| Instagram / Messenger (un CRON que ESCUCHA) | la página de Facebook (+ su Instagram) | `estadoCanalesDisparo` |
| Email | key de Resend + remitente que no es el sandbox **ni de MaKo** (§3) | `emailConectado`, `lib/resend.ts:71` |

`estadoMedios()` se suma en `lib/disparadores-canales.ts` (su cabecera ya lo pide: «esta función es el lugar donde se suma»). Lo que usa
cada automatización lo dice una función pura nueva, `mediosQueUsa(pasos, instance_name)` + `faltantes(usa, estado)` en
`lib/medios-automatizacion.ts` (sin `server-only`, con test). **`conectado: null` («no pude comprobarlo») avisa y NO frena**: conectar no
lo arregla (AGENTS.md, «una guarda bloquea sólo lo que se arregla haciendo lo que ella pide»).

### Dónde se dice y dónde frena

- **La tarjeta**: el nodo WHATSAPP / EMAIL / INSTAGRAM / MESSENGER lleva un chip «Sin conectar» (y el CRON de un canal, lo mismo). Sale de
  `GET /api/chat-agent/secuencias?canales=1`, que pasa a devolver `estadoMedios()`. ⚠️ Esa lectura se cachea por visita
  (`canalesDeLaVisita`, `app/automations/EditorDisparadores.tsx:256`): conectar algo tiene que vaciarla o el chip sigue.
- **Probar**: con el medio sin conectar, «Probar en WhatsApp/Email» pasa a «Conectar» (abre lo de abajo). La animación sigue corriendo.
- **Publicar** (`PATCH /api/whatsapp/secuencias` con `pasos`, `app/automations/SecuenciaPerfil.tsx:584`) contesta 409 «Conecta tu
  WhatsApp». **Activar** frena en `validarActivacion` (`lib/nutricion.ts:516`), que corre adentro de `setSecuenciaActiva`: por ahí
  pasan todos los que prenden (la pantalla, /email y MaKo, `lib/mako-doer-acciones.ts:155`). **No** va en `setSecuenciaPasos`: la galería, duplicar y los scripts tienen que poder
  crear un borrador sin el medio (guardar no es publicar).

### Conectar ahí mismo: las piezas que ya existen

`VincularEmisor` (`app/automations/PanelProbar.tsx:575`) ya hace la mitad. Se muda a `app/automations/ConectarMedio.tsx` y lo montan
la tarjeta, Probar, el 409 de Publicar y el CRON:
- **WhatsApp**: `EvolutionConnect` con `nueva inline` (`app/whatsapp/EvolutionConnect.tsx:51`): el QR en el modal.
- **Email**: `VincularRemitente` (`app/automations/EditorEmailGmail.tsx:299`), que carga `DominioSetup` (`app/email/EmailApp.tsx:758`).
- **Instagram/Messenger**: el OAuth de Zernio (`POST /api/zernio`, `conectar`) en una **ventana emergente** + sondeo de `estado` hasta
  que aparezca la cuenta. Hoy `EditorMensajeSocial.tsx:129` navega afuera y vuelve a /automations: eso es salirse de la pestaña.
- **El CRON**: los dos links «Conectar» a /integraciones y /email (`EditorDisparadores.tsx:291-295`) pasan al mismo modal.

Medido hoy: ws4 (#209, #210) no tiene línea; ws13 (#223, #224) tiene la línea caída desde el 18/08 y no tiene remitente; el ws1 queda
«sin email» por §3 (#238, pausada). Las cuatro pausadas: Activar las frenaría.

## 3. EMAIL 1 — no se manda con un remitente de MaKo

- **El predicado**, puro: `esRemitenteDeMako(r, dominioMako)` en `lib/email-remitente.ts` (el dominio de `EMAIL_MAKO`,
  `lib/app-url.ts:85`, o un subdominio). Precedente: `dominioMako` en `lib/curso-invitar-canales.ts`.
- **Al conectar**: `/api/email/dominio` rechaza ese dominio en `crear` (`route.ts:122-128`) y en `remitente` (`:144-160`).
- **Al ofrecer**: `remitenteDelPaso` y `remitentesVinculados` (`lib/email-remitente.ts:105`, `:121`) no lo devuelven nunca.
- **Al mandar (el choke point)**: `sendEmail` SIN `from` (`lib/resend.ts:125`) se niega si el remitente resuelto es de MaKo («Conecta
  tu email»). Los mails de la plataforma pasan `from: REMITENTE_MAKO` explícito y no cambian. ⚠️ `lib/reunion-destinatarios.ts:222`
  manda «Tus tareas de la reunión» SIN `from`: es un mail de MaKo y tiene que pasar `REMITENTE_MAKO` antes de prender la guarda.
- **`emailConectado()`** da false con un remitente de MaKo, y `getEmailFrom()` deja de usar `credWs('RESEND_FROM')` para esto: al ws1
  (`OWNER_WS`, un cliente) le devuelve el `RESEND_FROM` del env de la plataforma (AGENTS.md); va `credDelCliente`.
- **Dato**: borrar `resend_from` del ws1. Consecuencia: sus pasos de email no salen hasta que Mauricio conecte su dominio (hoy: #238
  pausada y 0 emails de nutrición en 30 días). Las invitaciones al curso del ws1 ya van por el camino de MaKo y no cambian.

## 4. CRON 2 — «Nunca nada debe quedar en una versión vieja»

**Por qué el paso 2 sale sin desplegable**: un CRON de un evento de antes es `claseDeDisparador = 'otro'` (`lib/disparadores.ts:465`);
`ElegirClase` no marca ninguna de las seis (`EditorDisparadores.tsx:231`) y `EditorDeClase` lo dibuja como texto con «←»
(`:607-608`). Martín sacó los eventos del CRON en la tercera tanda: «Elimina lo de "Eventos" todo eso debería ir dentro del editable del
CONDICIONAL». El destino es ése: **CRON = Producto › Adquisición › etapa; el evento = una CONDITION**.

**El equivalente, y por qué hoy cambiaría a quién le sale qué.** Cada evento en uso tiene sus filas en el catálogo
(`lib/condiciones-catalogo.ts`): `instant_form_sin_agenda` = «Dejó el formulario sin agendar» + «Estado: abierto» + «Llegó hace menos
de 720 h»; los `agendado_*` = «Próxima reunión en ≤ 720 h» + «abierto» (la partición «ya le hablamos» ya es la CONDITION de #213);
`no_show_j1` = «No asistió a la reunión» + «abierto». **Medido sobre los leads de hoy, el predicado coincide en las 6** (#198: 76 y
76; #213: 2 y 2; #223: 8 y 8; las demás, 0 y 0). Pero hay cuatro cosas que el modelo de hoy no tiene:

1. **Una CONDITION después del CRON se evalúa DESPUÉS de inscribir**, y la inscripción es única por (lead, automatización)
   (`supabase/migrations/0034_nutricion.sql:37`). Un lead que entra a una etapa antes de agendar queda consumido y, cuando agenda, **no
   vuelve a entrar** (#213, #210, #223). Sólo la antigüedad se mira al inscribir (`antiguedadDeEntrada`, `lib/flujo-grafo.ts:1476`).
2. **El momento**: `lead_nuevo` y `agenda_nueva` inscriben al instante (`app/api/webhooks/meta-leads/route.ts:328`, `calcom/route.ts:281`,
   `calendly/route.ts:617`); `etapa_actual` sólo con un movimiento EXPLÍCITO (`lib/leads.ts:2902`) o en el barrido de cada hora. La
   Bienvenida llegaría hasta una hora tarde.
3. **Guardas atadas al `trigger_tipo`**: «la reunión ya pasó» (`preparaUnaReunion`, `lib/nutricion-familias.ts:55`), la familia
   post-agenda y la reinscripción al reagendar (#789).
4. **Huecos**: no hay «reunión hace menos de 45 días» (`no_show_j1`), y el catálogo topea «próxima reunión» en 720 h.

### El diseño, en tres fases

- **Fase 0 — el panel (ya, sin tocar datos).** Un evento de antes se dibuja como **Producto** marcado y su desplegable trae las etapas
  + el evento puesto, marcado «(de antes)» (AGENTS.md: el valor actual entra a las opciones). Elegir una etapa lo reemplaza. No se
  ofrece a las nuevas. Archivos: `lib/disparadores.ts` (`claseDeDisparador`), `lib/flujo-conversacion.ts` (`pasosDisparo`, `:1770`),
  `app/automations/EditorDisparadores.tsx` (sale la rama de `:607`).
- **Fase 1 — el motor aprende lo que falta.** (a) El valor **«Cualquier etapa»** del embudo (`etapas: ['*']`). (b) **La condición de
  entrada**: la PRIMERA tarjeta, si es una CONDITION con «Si no» terminando, se evalúa ENTERA al inscribir (generaliza
  `antiguedadDeEntrada`): si no se cumple, no se crea la fila y el lead sigue elegible. (c) `lead_nuevo` y `agenda_nueva` también miran
  las de «Cualquier etapa» con entrada (`TRIGGERS_POR_EVENTO`, `lib/nutricion.ts:1772`). (d) `preparaUnaReunion` y la reinscripción
  miran también «la entrada pide una reunión». (e) Una fila «Última reunión hace menos de N días». Cada una con su test de equivalencia.
- **Fase 2 — los datos.** El script convierte: CRON → «Cualquier etapa» del mismo embudo; entrada → tarjeta NUEVA al final del array
  (no corre el `paso_actual` de nadie) apuntada por el CRON; compare-and-set sobre `updated_at` (molde `scripts/novena-tanda-ws1.mts`).
  No escribe una fila si el simulacro mide una sola diferencia. Las 58 listas archivadas pasan por `abrirFlujo` (nadie las recibe: cero
  cambio). Las 26 archivadas con eventos sin mapa (R2, post-pago, reactivación, residuo) quedan «de antes» (fase 0) hasta que alguien
  las recupere.

### El simulacro

`cfg-migrar-cron-simulacro.mts` (scratchpad de la sesión; se muda a `scripts/migrar-cron-de-antes.mts` con la fase 2). Transacción
`read only`; usa las funciones puras del producto (`disparadoresDe`, `fijarRaiz`, `validarGrafo`, `cumpleRama`, `hechosDeLead`,
`catalogoDeLead`) y compara contra la cohorte de antes TRANSCRIPTA con su línea. Salida de hoy: 6 vivas con propuesta, `validarGrafo`
sin errores en las 6, predicado idéntico en las 6; con `--todas`, 59 con CRON de antes, 33 con propuesta. **Probado rompiéndolo**:
sin la fila de antigüedad, #198 da 524 «sólo la nueva»; con la reunión topeada en 24 h, #213 da 2 y #223 da 8 «sólo la de antes».

## 5. Decisiones que tomé (Martín las puede dar vuelta)

1. Los rangos y que el 3 h / 48 h de preparación, el residuo y las ventanas de los eventos NO se configuran.
2. «Contesta sola» usa el horario de oficina si está prendido.
3. «No pude comprobar» un medio avisa y no frena Publicar ni Activar.
4. La migración del CRON espera a la fase 1: hoy cambiaría a quién le sale qué. Mientras tanto, la fase 0.
5. Borrar el remitente de MaKo del ws1 (sus emails no salen hasta que conecte el suyo).

## 6. Archivos por parte

- **§1**: `lib/limites-envio.ts` (nuevo, puro) · `app/configuraciones/limites-actions.ts` (nuevo) · `app/automations/LimitesEnvioPanel.tsx`
  y `ConfiguracionesBoton.tsx` (nuevos) · `app/automations/ChatAgentApp.tsx` · `lib/nutricion.ts` · `lib/setter-conversacion.ts` · test nuevo.
- **§2**: `lib/medios-automatizacion.ts` (nuevo, puro) · `lib/disparadores-canales.ts` · `app/api/chat-agent/secuencias/route.ts` ·
  `app/api/whatsapp/secuencias/route.ts` · `lib/nutricion.ts` (`validarActivacion`) · `app/automations/ConectarMedio.tsx` (nuevo, desde
  `PanelProbar.tsx`) · `FlujoLienzo.tsx` · `PanelProbar.tsx` · `EditorMensajeSocial.tsx` · `EditorDisparadores.tsx`.
- **§3**: `lib/email-remitente.ts` · `lib/resend.ts` · `app/api/email/dominio/route.ts` · `lib/reunion-destinatarios.ts` · dato del ws1.
- **§4**: fase 0 `lib/disparadores.ts`, `lib/flujo-conversacion.ts`, `EditorDisparadores.tsx`; fase 1 `lib/flujo-grafo.ts`, `lib/nutricion.ts`,
  `lib/nutricion-familias.ts`, `lib/condiciones-catalogo.ts`; fase 2 `scripts/migrar-cron-de-antes.mts`.

## 7. Trampas que salieron midiendo

- **postgres.js devuelve `date` como `Date`**: `String(fecha).slice(0, 10)` da «Tue Aug 11» y contra «2026-10-11» compara true siempre.
  La primera corrida del simulacro acusó 12 leads «sólo con la regla de antes» que no existían. Se lee como supabase-js (`types`).
- **El panel de CRON y el paso que manda miran conexiones distintas** para Instagram/Messenger: la página de Meta (que lleguen eventos)
  y Zernio (que salga). Un negocio puede tener una sin la otra.
- **Un remitente de MaKo no lo guardó nadie a propósito**: es la herencia de `OWNER_WS` (setting del ws1 y `RESEND_FROM` del env).
