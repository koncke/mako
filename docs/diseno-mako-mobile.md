# MaKo Mobile — diseño e implementación

<sub>Pedido de Martín (11/10/2026), textual: «Implementa completamente MaKo Mobile... Apalancate de
diseños de otras apps e incluso de skills de skill.sh». La tarjeta del plan que lo define (#131 del
seed, `app/plan/PlanBoard.tsx:67`): «el cliente ve lo suyo desde el celular. NO todas las pestañas
van a mobile, y las que van se re-adaptan 100% (no se encoge el desktop)… Terminado cuando el
dueño/closer abre el celu, ve su Hoy, responde a MaKo por voz y aprueba una acción, sin necesitar
la compu». Y la #521: el caso de Mauricio de agendar DURANTE una llamada desde el teléfono.</sub>

## Las decisiones (y por qué)

| Decisión | Elegido | Por qué |
|---|---|---|
| PWA o nativa | **PWA** | Una sola base, se instala, y cubre lo que la tarjeta pedía de la nativa: Web Push (iOS 16.4+ instalada), cámara (`<input capture>`) y voz (`SpeechRecognition` / `MediaRecorder`). Una nativa exige cuentas de tienda y otra base de código. |
| Dónde vive | **Un árbol propio `/m/*`** con su layout | La regla de oro de la tarjeta: re-adaptar, no encoger. El layout raíz no se puede esquivar (no hay route groups), así que `/m` entra en `esVistaSinChrome` y dibuja su propio cromo. |
| Home | **`/m/hoy`**; `/m` sólo reparte | Next redirige `/m/` → `/m`, y un scope `'/m/'` no cubre `/m`. |
| Nombres | **Today · Inbox · MaKo · CRM · Plan** | Regla de la casa: los NOMBRES en inglés; el copy en español neutro con tú (sin voseo). |
| Quién ve qué | La barra se filtra con **la misma regla del Sidebar** (`rolesWs` de `nav.ts` + `tabEnCapa`) vía `lib/movil-rutas.ts` | Una cosa, un lugar: nada de una segunda tabla de permisos. Today e Inbox los ve todo el mundo y se COMPONEN por rol. |
| Today por rol | Admin-cliente: el Pulso (lámpara, la acción del día, el objetivo, KPIs, alertas) + reuniones de hoy + prioridades. Closer/setter: reuniones de hoy + leads que esperan decisión + prioridades. Capa pm y superadmin (Martín, ws9): prioridades del plan + vencimientos + lo que espera aprobación. | `/general` no lo ven closer, setter ni las capas pm/superadmin. |
| Inbox | **Es la campanita**: «Para decidir» (aprobaciones de MaKo, confirmaciones del CRM automático, contactos y borradores del plan para revisar) + «Avisos» (el feed de los avisos que salieron). Sin campana en el header. | Dos controles para la misma pregunta parten la respuesta. |
| Onboarding pendiente | Pantalla propia `/m/configurar`: una frase + «Abrir la configuración» (el wizard de escritorio) | La regla: sin `done` no se entra a los datos. El wizard nunca se verificó a 390 px. |
| Entrada | `/inicio` manda a `/m` a los TELÉFONOS (UA, `userAgentFromString`), salvo la cookie `mako_vista=escritorio` (12 h, la pone «Versión completa») | `/inicio` es la puerta única (login, «Entrar», `denegarRol`). El proxy no se toca: es el choke point de seguridad. |
| Manifest | `id: '/'`, `scope: '/'`, `start_url: '/inicio'` | `start_url: '/'` abría la LANDING de venta a la persona logueada. Sin `id`, cambiar `start_url` crea «otra app» para Chrome. Una instalación de escritorio sigue en escritorio. |
| Service worker | `public/sw.js`, scope `'/'`, **sin handler `fetch`** | Un caché offline puede servir el HTML de una cuenta a otra en el mismo teléfono (hay admins impersonando). Sólo push + click. |
| Push: a quién | Preferencia **por PERSONA** (`usuarios.perfil.notifPush`), suscripciones atadas al **usuario** (`push_suscripciones.usuario_id`), nunca al workspace de la pestaña | Un super admin mirando un cliente no tiene que recibir los avisos de ese cliente. |
| Push: qué | Los avisos que ya salen por `emitirAviso` (después del interruptor, del espaciado y de la cola del resumen) + «MaKo te pide confirmar» (al crear una pendiente) + «MaKo dejó algo para revisar» (propuesta nueva). Default: activo para admin; closer/setter lo prenden ellos. | El choke point existe; engancharlo antes del interruptor pushearía avisos apagados. |
| Claves VAPID | Una credencial `WEB_PUSH_VAPID` (JSON con las dos) cifrada en `credenciales` del workspace de PLATAFORMA (`wsSuperAdmin()`), generada UNA vez por script | `envCred` resuelve contra el ws1 (un cliente). Generarla perezosa con dos instancias frías parte el par. |
| Feed de avisos | Tabla `notificaciones` CON `workspace_id` (la 0048 nunca se aplicó y no lo tenía) y leído por persona (marca de agua en `usuarios.perfil.notifVistoHasta`) | Hoy `crearNotificacion` escribe al vacío y se traga el error. |
| Chat con MaKo | El doer CON datos reales y que **propone acciones** (el «turno compartido»), con la aprobación como tarjeta en el hilo que confirma por el MISMO camino (`confirmarPendiente`, `gatingOk` otra vez al confirmar). Voz: dictado en vivo (tocar) o nota de voz (mantener) → transcripción. Fotos y PDF por route handler multipart. | Es el criterio de terminado: «responde a MaKo por voz y aprueba una acción». El chat de la app hoy sólo lee (decisión escrita: hasta que exista el turno compartido). |
| CRM | Today del CRM (reuniones con HORA, decisiones pendientes) + buscador en el server + ficha en LECTURA con: Llamar, WhatsApp (el hilo de la línea del negocio, leer y responder), Agendar (sheet), Nota por voz, Mover de etapa (sólo las que no piden wizard, con Deshacer). | Lo demás (pagos, tracking, historial, kanban, wizard) queda en escritorio con «Abrir en la computadora». |
| Plan | Hoy / Esta semana / Prioridades (la MISMA función que el tablero de escritorio, extraída) + marcar hecha con Deshacer | Hoy hay dos definiciones de «Prioridades»; el móvil no puede ser la tercera. |
| Claro/oscuro | El contenido sigue la preferencia que ya existe (`mako.modo` o el sistema). El cromo (header y barra) es `--sidebar` en los dos modos. | `statusBarStyle: black-translucent` pinta reloj y batería en blanco: el header tiene que ser oscuro siempre. Impeccable: el modo se elige por la escena (en la calle, al sol), no por categoría. |

## Lo que se queda en escritorio

Ads Manager, editor de funnel, Retro, analistas, tablas de analítica, el Dashboard, Automations,
configuración de objetivos y KPIs, el kanban del CRM, pagos y cuotas, tracking, historial completo,
importar/exportar, editar campos del lead, el wizard de etapas, el formulario genérico de
`/mako/revisar/[id]` para parámetros `object/object[]`, la tabla editable de `/crm/revisar/[id]` y
el wizard de `/plan/revisar/[id]`. En el teléfono, a lo sumo una fila que dice qué es y un link
honesto «Abrir en la computadora» (`<a>` a la ruta de escritorio con el `?ws=`).

## El shell (`app/m/`)

- `app/m/layout.tsx` (server): exporta su `viewport` (`viewportFit: 'cover'`, `themeColor` = el hex de
  `--sidebar`), resuelve UNA vez rol, capa, impersonación y salida, y dibuja: header fijo oscuro
  (44 + `env(safe-area-inset-top)`), contenido con el scroll del DOCUMENTO, barra inferior fija oscura
  (56 + `env(safe-area-inset-bottom)`), capa de toasts y de sheets. `html[data-m]`.
- Cada `page.tsx` de `/m` llama a su guard (`lib/movil-guard.ts`): los layouts no se re-ejecutan al
  navegar. El guard reusa `requireSesion`, `tabEnCapa`, `getRolWsEfectivo` y `onboardingPendiente`,
  pero redirige a destinos `/m` con `rutaConWs` (los de `lib/tab-access.ts` mandan a escritorio).
- Viendo un cliente (super admin o agencia): el nombre del cliente en el header y la salida en
  `/m/cuenta` (reusa la lógica de `salir()` de `ImpersonationBanner`, sin `PanelAgencia`).
- Primitivas propias en `app/m/_ui/` (las de `app/_ui` que sirven se reusan tal cual: `Button` md/lg,
  `Badge`, `Status`, `Estados`, `Mako`). No se usan en `/m`: `Pagina` (88 px de padding), `Modal`
  (diálogo de 600 px), `Tooltip`, `Eyebrow`, `.mk-btn--sm` (36 px).
- Tokens nuevos, UNA vez en `globals.css`: `--ease-out` `cubic-bezier(.23,1,.32,1)`, `--ease-in-out`
  `cubic-bezier(.77,0,.175,1)`, `--ease-drawer` `cubic-bezier(.32,.72,0,1)`, `--dur-press` 120ms,
  `--dur-pop` 180ms, `--dur-sheet` 320ms, `--dur-sheet-out` 220ms, `--m-header` 44px, `--m-tabbar`
  56px, `--m-gutter` 16px, `--scrim`. Y un bloque `[data-m]` que fuerza la escala tipográfica móvil
  aunque el ancho pase de 820 px.

La spec visual completa (medidas, estados, motion, vetos) está en la sección «Spec» de abajo.

## Las cinco formas de navegar, en /m

`Link` y `useRouter` de `@/app/_ui/Link` · los fetch a `/api` salen solos con el `?ws=` (WsFetch) ·
`redirect()` con `rutaConWs` · `window.location` con `conWs(destino, useWs())` · un link que SALE (un
push) con `linkApp(rutaMovilOHome(href), ws)`. Nunca se lee `?ws=` de la URL para decidir de quién son
los datos.

## Spec (resumen operativo)

**Principio**: «distill, don't shrink». Un paso por pantalla, cosas grandes, el test del segundo.
Una acción primaria por pantalla, abajo, en la zona del pulgar.

**Tipografía** (los tokens móviles): héroe 26/600 con el número ADENTRO de la frase («Te esperan 2
aprobaciones y 3 llamadas»), sección 20/600, título de fila 16.5/600, base 16/500, secundario
14.5 `--dim`, metadata 13 `--dim`, números `tabular-nums`.

**Filas**: `.mk-fila`, min-height 64, padding 14×16, filete con inset 16, feedback en `:active` con
`--velo-hover` (nunca hover sin `@media (hover:hover) and (pointer:fine)`). Tarjetas SÓLO para la
decisión que bloquea arriba de Today y para «Siguiente acción» en la ficha. Nunca una pila de
tarjetas iguales ni tarjetas anidadas.

**Swipe**: una acción por lado y SIEMPRE con botón equivalente visible. Derecha = completar
(reversible, con Deshacer). Nunca se aprueba por swipe algo que bloquea, nunca se borra por swipe.
Histéresis 10 px, bloqueo de eje `|dx| > 1.5·|dy|`, umbral 35% o v > 0,11 px/ms.

**Sheets**: grabber 36×5, radio 18 arriba, scrim, snaps medio (55dvh) y alto, arrastre 1:1 desde el
grabber/cabecera o con el cuerpo en scrollTop 0, cierre por velocidad, `overscroll-behavior: contain`,
botón Cerrar visible, back de Android = cerrar (`?sheet=` en la URL). Nunca apilados (uno encima
REEMPLAZA) ni como página. Abre 320 ms `--ease-drawer`, cierra 220 ms.

**Aprobación**: pill «Aprobación pendiente» (el único naranja de la pantalla), la consecuencia en
prosa con el número; al tocar, sheet alto que MUESTRA todo (lo que bloquea no linkea) y en el pie la
advertencia PEGADA arriba del botón primario que nombra acción + objeto («Enviar 340 mensajes»), y
debajo la salida («No enviar»). Nunca «Sí / No / Aceptar / Cancelar / Descartar» a secas. Nunca se
aprueba desde la notificación push: la notificación sólo abre.

**Chat**: composer abajo con [+] [campo 1-5 líneas] [mic | enviar]; mic: tocar = dictado en vivo al
campo (editable), mantener = nota de voz (deslizar a la izquierda cancela, hacia arriba bloquea) que se
transcribe y se manda con la transcripción visible. Mientras MaKo trabaja: el rótulo de `GRAMATICA`
(nunca «escribiendo…») y la barra-borde viva. Una propuesta aparece en el hilo como fila de decisión
que abre el sheet de aprobación.

**Agendar en una llamada**: sheet alto, chips de día que envuelven (Hoy · Mañana · +2 · +3 · Otro
día), grilla de 3 columnas con los horarios libres leídos por CÓDIGO (la agenda no pasa por IA),
botón «Agendar jue 16, 10:00» con la consecuencia pegada («Le llega la invitación a {nombre}»).

**Estados**: skeleton con la forma de la fila (aparece a los 300 ms); vacío de UNA frase que
distingue primer uso / sin resultados / sin permiso / falla; error que dice de quién fue y qué hacer;
offline: cinta de 36 px «Sin conexión · datos de las 10:42», lo que escribe se deshabilita con el
motivo, una aprobación NUNCA se encola offline. «Actualizado 10:42» arriba de cada lista viva.
Pull-to-refresh propio en Today, Inbox, CRM y Plan; y refresco solo al volver al frente si pasaron
más de 60 s.

**Motion**: press `scale(.97)` 120 ms; cambiar de pestaña SIN animación; navegar adelante fade +
translateX(24px) 220 ms; volver instantáneo; toasts con transitions (no keyframes); sólo transform y
opacity; nunca `transition: all`, nunca ease-in, nunca `scale(0)`; cada animación entrega su variante
`prefers-reduced-motion` (crossfade 150 ms).

**Háptica**: `lib/haptico.ts` (patrón de web-haptics: Android `navigator.vibrate`; iOS 18+ click
sincrónico a un `<input type=checkbox switch>` oculto; si no, nada). Sólo: aprobar/agendar OK
(success), error, cruzar el umbral de un swipe o del pull (light), empezar a grabar (medium). Nunca en
cada tap.

**Toasts**: 3-4 palabras («Completada», «Agendada», «Nota guardada») + Deshacer si es reversible,
`bottom: calc(56px + env(safe-area-inset-bottom) + 12px)`.

**Vetos** (de impeccable craft-floor, la casa y las skills): nada de kicker/eyebrow, pila de
tarjetas iguales, número gigante + label, gradientes, glassmorphism, blur decorativo, «magia», casino
negro+dorado, borde de color lateral, mono como disfraz, emojis como íconos, scroll horizontal en
navegación, más de 5 destinos, FAB, sheets apilados, modales que se abren solos, permiso de
notificaciones al cargar, `maximum-scale`/`user-scalable=no`, `100vh`, `env()` sin `viewport-fit`,
header claro bajo `black-translucent`, hex nuevos (sólo `var(--token)`), ids o jerga en pantalla.

## Piezas y dónde viven

| Pieza | Archivos |
|---|---|
| Destinos, quién ve qué, mapa escritorio → móvil | `lib/movil-rutas.ts` (puro) |
| Guard de cada página | `lib/movil-guard.ts` |
| Shell, barra, header, primitivas | `app/m/layout.tsx`, `app/m/_ui/*`, `app/m/m.css` |
| Detección de teléfono | `lib/movil-dispositivo.ts` (puro) |
| Service worker | `public/sw.js` |
| Push (VAPID, suscripciones, envío) | `lib/push.ts`, `app/api/push/*`, `supabase/migrations/*_push_suscripciones.sql`, `scripts/push-vapid-generar.mts` |
| Feed de avisos | `lib/notificaciones.ts`, `supabase/migrations/*_notificaciones_ws.sql` |
| Today | `lib/vista-general.ts` (lo comparte `/general`), `lib/hoy-movil.ts`, `app/m/hoy/` |
| Plan | `app/plan/board/prioridades.ts` (lo comparte el tablero), `lib/plan-hoy.ts`, `app/m/plan/` |
| Chat con MaKo | `lib/mako-turno-app.ts`, `app/api/m/mako/route.ts`, `app/m/mako/` |
| Inbox | `lib/inbox-movil.ts`, `app/m/inbox/` |
| CRM | `lib/crm-movil.ts`, `app/m/crm/` |
| Cuenta (avisos, instalar, tema, salida) | `app/m/cuenta/`, `app/m/configurar/` |
