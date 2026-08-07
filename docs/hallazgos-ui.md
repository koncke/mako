# Hallazgos de la UI compartida

Las piezas de `app/_components` y `app/components` las usan **todas** las tabs: un cambio
acá tiene 20+ llamadores. Esto es lo que hay que saber antes de tocar `WizardShell`, la
pila de modales o el progreso de un formulario. **No es un changelog.**

Origen: corridas multi-agente de 08/2026 (wizard del CRM + onboarding). Regla de la
cosecha en `AGENTS.md`.

---

## 1. WizardShell y el progreso

### Dos modos de la misma pieza tienen que contestar igual

**Síntoma:** el wizard pinta **"Último paso (7)"** y justo abajo el botón dice
**"Siguiente →"**.

**Causa:** `WizardShell` acepta el progreso de dos formas —`pasos` + `pasoActual` (el mapa)
o `total` + `idx` (dos números)— y respondían **distinto al mismo estado**. Con la cuenta
en cero y `enUltimo` en `false`, el modo `total` decía "faltan pasos" (bien) y el modo
`pasos` se creía en el final.

**El diagnóstico obvio era el equivocado.** Parecía inalcanzable: en el único llamador del
modo nuevo, el resumen siempre era el último del mapa. Se volvió alcanzable **al migrar el
onboarding**, cuyo mapa son **secciones** y tiene varias pantallas por sección. O sea: el
bug latente lo activa la migración siguiente, no el código que lo contiene. El orden de
las dos tareas importaba y nadie lo había mirado.

**Dónde:** la aritmética se mudó a `app/_components/wizard-progreso.ts` (pura, con tests).

**Regla escrita ahí: `enUltimo` gana en las dos direcciones.** Si dice que es el último, no
hay cola; si dice que no lo es y la cuenta da cero, la que miente es **la cuenta**. Y
cuando una pieza acepta dos formas de recibir lo mismo, la aritmética vive en **una**
función pura que las dos llaman — si no, el segundo modo es el que se queda viejo.

### Los dots mienten si `total` no es confiable

La posición actual siempre es verdad; la **cola solo existe si se puede contar**.
`futuros = -1` (faltan, cantidad desconocida) pinta tres puntitos de 4px, no puntos-paso.
Colapsa cuatro casos: `total` desconocido, `idx >= total`, `enUltimo` con `total` mayor, y
**salto hacia adelante** — si el wizard se saltea pantallas, `total` deja de servir.

Ese estado se marca **en render, no con `useEffect`**: con efecto, el primer frame del
salto sigue mostrando la fila vieja, que es justo la mentira que se quería sacar.

En el modo `pasos` la cuenta es **exacta** mientras el mapa no se mueva; si el mapa cambia
estando a la vista, pasa a "faltan pasos" y se queda ahí (pegajoso). **Los cambios de mapa
mientras la pieza está trabada por `cargando` no cuentan**: ahí el mapa se está armando y
el usuario no pudo leer ninguna promesa. La comparación mira también el `trabado` del
render **anterior**, porque la respuesta que apaga el loader trae el mapa nuevo en el mismo
commit.

### El chrome forkeado es donde vuelven los bugs ya arreglados

El wizard con ramas de verdad (`app/crm/StageMoveDialog.tsx`) tenía su **propia copia** del
header, los puntitos, el footer y el loader — ~60 líneas. Ahí vivía un bug de z-index que
la pieza compartida no tiene, y ahí no llegaba ninguna mejora del progreso.

**Regla:** el marco se importa; lo que se queda en el llamador es el **contenido** y la
**navegación** (qué pasos hay, cuándo se puede avanzar). Si el llamador necesita algo que
el marco no da, se le agrega al marco como modo — con la aritmética compartida, ver arriba.

Detalle de contrato que se descubrió al migrar: el prop `error` es **una línea de texto**.
Una lista de faltantes con un botón "Completar lo que falta →" va como último hijo del
cuerpo, no ahí.

---

## 2. La pila de modales

### Un `zIndex` literal en una pieza que se apila queda debajo del backdrop

**Síntoma:** confirmás, la pantalla **no se mueve** y nada explica por qué. Ni error, ni
spinner, ni cartel.

**Causa:** el loader y el cartel final "Datos actualizados" tenían `zIndex: 100`
hardcodeado, y la pila de modales (`useCapaModal`) arranca en **130**. Estaban pintados,
debajo del backdrop. Dos síntomas idénticos, dos literales distintos, el mismo error.

**Regla:** una pieza que se monta apilada **no elige su z**: lo hereda de la capa
(`capa.z`), o se pinta **dentro** de la tarjeta con `position: absolute` sobre un
contenedor `relative` — así hereda el z que la capa ya le dio. Un número literal en un
overlay es una apuesta contra el orden de montaje.

Del mismo arreglo: la cortina del loader usa `var(--surface)` en una capa propia y no un
`rgba(255,255,255,.78)` fijo, que en tema oscuro era un flash blanco. **Ningún color fijo
en un overlay.**

### El loader tiene que tapar también el header y el footer

Es donde están los botones que no hay que tocar: ✕, Atrás, Siguiente/Confirmar y el click
en el backdrop. Tapar solo el cuerpo deja la salida abierta a mitad de una escritura.

| Trampa | Dónde | Qué hacer |
|---|---|---|
| **`getComputedStyle` con la pane oculta devuelve valores viejos** | UI general | Verificar por el style inline o un `data-*`. |
| **Un componente declarado dentro del render remonta todo** | visto en `app/crm/SelectorHora.tsx` | Generar las filas con una **función que devuelve el elemento**. Como componente anidado, React remontaba las 61 opciones con cada tecla y tiraba el scroll al principio. |

---

## 3. Lo que quedó sin hacer

| Qué | Dónde | Por qué |
|---|---|---|
| **`WizardShell` llama a `useCapaModal` pero nunca engancha `capa.refScroll`** al contenedor que scrollea | `app/_components/WizardShell.tsx` | La restauración de scroll al volver de un modal apilado **no funciona en ningún wizard**. Engancharlo es un cambio de comportamiento para los 24 llamadores: merece su propia pasada. |
| **21 llamadores siguen en el modo `total`/`idx`** | `app/**` | No es deuda por sí sola (ver descartado), pero cada uno que tenga el mapa en la mano y lo aplane a dos números es un `indexOf` duplicado. |

### Descartado a propósito (no volver a "arreglarlo")

- **Migrar `app/chat-bot/SecuenciaWizard.tsx` al modo `pasos`.** Se revisó y **no duplica
  nada**: su `idx` es un índice de estado real, no un `pasos.indexOf(...)` recalculado. Es
  exactamente el caso para el que existe `total`/`idx`. El criterio para migrar es *"¿el
  llamador tiene el mapa y está recalculando la posición?"*, no *"¿existe un mapa?"*.

---

## Cosecha retroactiva (2026-08-07)

Rescatado de los journals de las 261 corridas multi-agente de junio a agosto de 2026:
**134 de 260 nunca habían escrito nada en el repo**. El registro completo de las corridas
está en [corridas-multiagente.md](corridas-multiagente.md).

⚠️ **Es material de segunda mano.** Sale de lo que devolvieron los subagentes en su
momento, no de una relectura del código de hoy. Cada entrada dice de qué corrida y de qué
fecha viene. **Antes de actuar sobre una, verificá contra el código**: varias ya están
arregladas, y donde el rescate lo sabía, lo dice.

### Trampas: el diagnóstico obvio era el equivocado

#### El placeholder del Dropdown no es una opción: por eso no se podía des-asignar un cliente

Síntoma: en /admin no había manera de dejar a un usuario sin workspace. El diagnóstico obvio («el backend no soporta null») era el equivocado — `actualizarUsuario` acepta `workspace_id: null` y la columna es nullable a propósito (mig 0054). La causa real es el `Dropdown` propio: solo emite valores presentes en `options`, y el `placeholder` es texto del botón cuando `value` no matchea, NUNCA un ítem clickeable. Y aunque llegara vacío, `Number('') === 0` pasa el chequeo `typeof body.workspace_id === 'number'` del route y escribiría workspace 0. Regla: si un campo admite «vacío», va como opción explícita `{ value: '', label: '…' }` y el onChange manda `v ? Number(v) : null`.

**Vive en:** app/components/Dropdown.tsx:112,121; app/admin/AdminView.tsx:429-435; app/api/admin/usuarios/route.ts:121 · *2026-07-02 map-admin-clientes*

#### Sin ninguna fuente conectada, /general declara «El negocio está sano»

El semáforo arma `alertas = []` cuando no hay datos y cae al `else` final, que dice «El negocio está sano · Sin focos activos. Buen momento para empujar volumen». La card de pendientes con 0 leads afirma «datos al día — el tablero es confiable». Un cliente que gastó plata en ads y ve luz verde con 0 cierres se lleva un tablero que no sabe de qué habla. Falta el cuarto estado, el gris: «sin datos suficientes para opinar». El sistema para distinguir off de 0 ya existe (`lib/sources.ts`, se usa internamente en /marketing) y el componente que lo mostraría, `SourceStrip`, existe pero está desmontado: ninguna página monta `DashboardHeader`.

**Vive en:** app/general/page.tsx:411-415, :441-442 y :477; lib/sources.ts; app/_components/DashboardHeader.tsx (sin consumidores) · *2026-07-16 · mako-onboarding-solo-meta*

#### En un grid, el eje vertical también necesita minmax(0,1fr)

Ponerle alto fijo a un modal de dos columnas y `overflow:auto` a la columna que scrollea NO alcanza: si el grid no declara `grid-template-rows`, la fila implícita es `auto` con `min-height:auto`, o sea que no deja que los hijos se achiquen por debajo de su contenido — la fila crece, desborda el alto fijo y el `overflow:auto` no hace absolutamente nada. Hay que agregar `grid-template-rows: minmax(0,1fr)` y `height:100%` en el grid (un hijo grid no hereda el alto de un padre `display:block`). Es el mismo truco que ya está en el eje horizontal de `.mk-svc-modal` y que todos olvidan replicar en el vertical. Ojo también con el media query de apilado: al pasar a 1 columna se generan 2 filas implícitas y hay que resetear el `grid-template-rows`.

**Vive en:** app/globals.css:205-208 (.mk-svc-modal) y :214-227; app/integraciones/IntegracionesBoard.tsx:492-493 (ModalShell) · *2026-07-16 · integraciones-modal-v2-investigar*

#### El placeholder animado no cuesta renders: cuesta el NOMBRE del control

La pregunta natural ante un placeholder que se escribe y se borra es «¿cuánto cuesta un setState por letra?». Se midió en navegador real: escribir el atributo placeholder cuesta 1,2 µs, o sea nada. El diagnóstico obvio era el equivocado. El daño real es otro: el algoritmo de nombre accesible cae al placeholder como ÚLTIMO recurso, así que un input sin label toma su nombre del placeholder, y rotarlo cada 3 segundos le cambia el nombre al control cada 3 segundos — rompe el control por voz (el usuario dice «hacé clic en X» y para cuando termina la frase ya es otro) y JAWS/NVDA siguen anunciando el viejo. La regla que queda: animar el placeholder solo es aceptable si el input YA tiene un nombre accesible fijo que no sea el placeholder (label real conectado por htmlFor, como documenta app/_ui/Field.tsx). Dato empírico del mismo barrido: v0, Perplexity, Claude y Linear NO rotan el placeholder — ponen la animación en el titular y los ejemplos como chips clickeables.

**Vive en:** app/_ui/Field.tsx (el label conectado por id) · aplica a cualquier input nuevo de captura (/ideas) · *2026-08-07 · ideas-content-machine*

#### El cuadrado verde liso: un <use> sin su <symbol> no dibuja nada y no avisa

En el onboarding del Chat Agent el ícono de WhatsApp se veía como un cuadrado verde liso. La hipótesis natural era el gradiente o el CSS, y era falsa: el símbolo usa fill="#fff" plano. Lo que pasaba es que nadie montaba <BrandDefs /> en ese árbol, así que el <symbol id="ic-whatsapp"> no existía en el documento, el <use href="#ic-whatsapp"> de SvcIcon no resolvía a nada y lo único pintado era el <span> contenedor con background '#25D366'. El mecanismo no es «gradiente ausente → color plano», es «símbolo ausente → no se dibuja NADA y se ve el fondo del tile». La falla es 100% silenciosa: no hay error de tipos, ni warning de React, ni consola. La regla que quedó: el componente que consume íconos de marca monta sus propios defs en vez de esperar que lo haga el llamador (montarlo dos veces no rompe, el <use> toma el primero); hoy PanelMarketing.tsx ya lo hace.

**Vive en:** app/_components/ServicioVisual.tsx (BrandDefs + SvcIcon) · app/_components/PanelMarketing.tsx · *2026-08-01 · mako-onboarding-copy-y-bugs*

#### router.refresh() no vuelve a correr los efectos de los componentes cliente

El mismo bug de Gemini tenía una segunda causa que el diagnóstico no vio y que hacía insuficiente el parche: aunque la copia funcionara, la pantalla no se enteraba. DatosDeMau se montaba SIN prop `onListo`, y sin ella hace router.refresh(), que re-renderiza server components pero NO remonta componentes cliente ni re-corre sus efectos. La tarjeta del servicio carga su estado en un useEffect con deps [servicioKey] (una vez por montaje), así que seguía vacía, `geminiConectada` seguía false y `puedeAvanzar` dejaba el wizard trabado. La regla: si el dato que cambiaste lo lee un fetch dentro de un useEffect de un componente cliente, refrescar la ruta no alcanza — hay que llamar al recargador explícito o remontar con un `key` que cambie.

**Vive en:** app/_components/DatosDeMau.tsx · app/onboarding/OnboardingWizard.tsx · app/integraciones/ServicioConfigForm.tsx · *2026-08-01 · mako-onboarding-copy-y-bugs*

#### El error normal viene en JSON; el 504 de la plataforma viene en HTML, y ahí revienta el `.json()`

En el paso Archivero del onboarding, el route de preguntas devuelve `{ok:false}` ante un error normal y el cliente lo manejaba bien. Lo que trababa al usuario era el otro camino: la ruta llama a la IA con `maxDuration 60`, y un timeout de plataforma devuelve una página HTML de error, así que `res.json()` LANZA y cae al catch — que solo hacía `setVista('archivos')` sin marcar `huecosRevisados`. Como el guard de «Siguiente» es `if (gaps.length > 0 && !huecosRevisados) return true`, cada click se consumía y el usuario quedaba encerrado en el paso para siempre. Regla: el catch de un `await (await fetch()).json()` dentro de un wizard tiene que ser fail-open (marcar revisado + avisar), porque ahí no estás atrapando el error del backend sino el de la infraestructura.

**Vive en:** app/onboarding/Archivero.tsx:259-262 (ya corregido con fail-open explícito) · *2026-07-29 ~auditoria-archivero-onboarding*

#### Un `<Icon name>` que no existe no rompe: pinta un puntito gris

`Icon` resuelve `PATHS[name] ?? PATHS.dot`, así que un nombre mal escrito no tira error ni warning: se ve un círculo de 3px y nadie se entera. Tampoco acepta color, className ni style — el color se hereda, hay que envolverlo en un `<span style={{color}}>`. Y el hermano de marca, `SvcIcon`, exige que `<BrandDefs />` esté montado una vez en la página (hoy lo montan /integraciones, /onboarding y el board del plan; Configuraciones NO): sin eso el glifo sale vacío, también sin error.

**Vive en:** app/_components/icons.tsx:209 · app/_components/ServicioVisual.tsx (SvcIcon/BrandDefs) · *2026-08-06 · rediseno-notificaciones*

#### Un efecto con deps `[]` que lee `pathname` deja las preferencias en null para toda la sesión

El efecto que carga las prefs in-app tiene `deps: []` pero adentro hace `if (pathname.startsWith('/login') || isPublicLandingPath(pathname)) return;`. Si el provider monta con /login (bookmark, URL tipeada), sale antes del fetch y antes de registrar el listener, y como el root layout no se desmonta en navegaciones soft (verificado contra Next 16.2.6: el router sigue el 307 sin caer a MPA), nunca vuelve a correr. `inAppActivo(null,…)` es fail-open, así que el sonido y los toasts salen aunque estén apagados, y guardar en Configuraciones no cambia nada hasta un F5. Regla: si la guarda de un efecto lee algo, ese algo va en las deps — o derivá un booleano (`enPublico`) y usalo como dep.

**Vive en:** app/_components/NotificationsProvider.tsx:331-344 (y el efecto gemelo de :301) · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

#### En una lista de matchers, el genérico que va primero anula el trabajo de exclusión del específico

`nav.ts` se toma el trabajo explícito de separar 'Clientes' (matchea /admin pero NO /admin/guiones) de 'Guiones' (matchea /admin/guiones). `titulo-tab.ts` arma `TODOS` con `...USER_NAV` ANTES que `...ADMIN_NAV`, y USER_NAV tiene un `starts('/admin')` a secas: `TODOS.find()` corta ahí y las dos pestañas dicen «MaKo - Admin», que es justo lo que el módulo existe para evitar. Verificado ejecutando el módulo real. Segundo filo del mismo archivo: el fallback `desdeLaRuta()` capitaliza el primer segmento sin validar nada, así que un 404 (/crmm, /graficos) pinta «MaKo - Crmm» e inventa una sección que no existe.

**Vive en:** lib/titulo-tab.ts:45-46 y :50 · *2026-08-06 ~auditoria-notificaciones-y-titulo-de-pestana*

#### Un fetch gateado por paso muere cuando el wizard REANUDA en un paso posterior

El ensayo pintaba «Tu nota de voz (no disponible)» con los 3 audios grabados. Causa: la biblioteca de audios se hidrataba solo con `pasoKeyRef.current === 'voz'`, y `cargar()` aterriza en el primer paso NO hecho — con 'voz' ya completo eso es 'ensayo', así que nunca se pasaba por 'voz'. En el recorrido secuencial NO fallaba: el bug aparece solo al retomar, que es lo que hace todo el que no termina de una sentada. Y el fix obvio no alcanzaba: mover la carga al montaje solo convertía la falla determinista en una carrera, porque el escenario se abre UNA sola vez (`msgs.length > 0`) y nadie vuelve a mirar los audios — hizo falta además `if (audios === null) return;` con `audios` en las deps. Antes de gatear un loader por paso, preguntá en qué paso puede montar la pantalla.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:460 (viejo), :467 y :632 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

#### Una URL firmada guardada en el estado se rompe de dos formas opuestas, y ninguna avisa

Dos corridas distintas encontraron los dos extremos del mismo patrón. (a) Congelada: `abrirEscenario` mete la URL firmada dentro de `msgs` y nadie la refresca; subir el TTL de 1 h a 12 h corre el acantilado, no lo saca — pasado el plazo el navegador pinta un reproductor inerte en 0:00. (b) Refrescada de más: la bandeja de empresa re-firma cada media en cada poll de 8 s, así que la URL cambia de identidad, las imágenes se re-descargan y reasignar `src` en `<audio>`/`<video>` RESETEA la reproducción — una nota de voz de más de 8 s es imposible de escuchar. En los dos casos el síntoma es mudo: `ChatHilo` no tiene `onError` en `<audio>`, `<img>` ni `<video>`, así que una URL muerta es indistinguible de un archivo roto. Regla: la URL firmada se resuelve al renderizar (o se mergea por id preservando la anterior), nunca se persiste en estado; y todo medio servido por URL firmada lleva `onError`.

**Vive en:** app/whatsapp/_shared/ChatHilo.tsx:208-212, lib/setting-audios.ts:107, lib/evolution-mensajes.ts:191, app/whatsapp/EmpresaInbox.tsx:64-69 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent + 2026-07-09 ~auditoria-espejo-evolution-inbox*

#### Un `?? lista[0]` para un índice fuera de rango convierte «terminaste» en «volvé a empezar»

`const esc = escenarios[escIdx] ?? escenarios[0]`. Al apretar «Terminar el ensayo», `siguienteEscenario()` deja `escIdx === escenarios.length`, el `??` cae en el escenario 0 y el efecto lo REABRE con semilla nueva, con todos los puntos de progreso apagados y sin cartel de cierre — la única pista de que terminó es que el «Siguiente» del footer se habilitó en silencio. Regla: el fallback de un índice fuera de rango es `null` (y una pantalla de cierre), nunca el primer elemento.

**Vive en:** app/chat-agent/OnboardingChatAgent.tsx:597 y :1237 · *2026-08-02 ~diagnostico-audio-ensayo-chat-agent*

#### `flex:none` + `width:100%` junto a un label `nowrap` desborda siempre, sin importar el ancho

En una fila flex con gap, una barra con `flex:none` y `width:100%` inline se come todo el ancho del contenedor y no puede encogerse; el label hermano tiene `white-space:nowrap`, así que su min-content es el texto entero y tampoco encoge. Barra(100 %) + gap + label excede la fila siempre — es independiente del ancho real de la card. Solo desbordaba el primer paso del embudo (los de 50 % y 24 % dejaban lugar), y el `overflow-x:hidden` de la raíz lo escondía cortando justo el número. Arreglo: la barra va dentro de un track `flex:1; min-width:0` y el label `flex:none`, para que el `width:X%` se mida contra el espacio que sobra.

**Vive en:** app/vsl/estrategia/Estrategia.tsx (.s-fbar-row / .s-fbar / .s-fbar-lbl) · *2026-07-19 ~revision-landing-estrategia-vsl*

#### El componente hermano ya resolvió esto: la bandeja de empresa no copió sus dos guardas

`EmpresaInbox` y `WhatsAppApp` son las dos bandejas de la misma pantalla, y la segunda ya tiene resueltos dos peligros que la primera no. (1) Race: `loadMsgs` hace `setMsgs(j.mensajes)` sin verificar que el chat siga seleccionado — un fetch en vuelo del chat A resuelve después de cambiar al B y pinta los mensajes privados de un lead bajo el nombre de otro; WhatsAppApp lo evita con `if (selIdRef.current === selId)`. (2) Autoscroll: el efecto `[msgs]` fuerza scroll al fondo en cada poll de 8 s (el array es nuevo aunque el contenido sea idéntico), así que leer historial es imposible; WhatsAppApp lo gatea con `stickBottomRef`. Cuando existan dos componentes que hacen lo mismo, la revisión empieza por diffear sus guardas.

**Vive en:** app/whatsapp/EmpresaInbox.tsx:56-71 vs app/whatsapp/page.tsx (WhatsAppApp):447-450 y :501 · *2026-07-09 ~auditoria-espejo-evolution-inbox*

#### Un MediaRecorder pausado no está 'recording': el cleanup lo deja colgado con el micrófono abierto

El cleanup al cambiar de chat solo cancela `if (mediaRecRef.current.state === 'recording')`, pero `pauseRec()` deja el recorder en `'paused'`. Grabar → pausar → cambiar de chat saltea la cancelación: el stream del micrófono no se libera (el indicador del navegador queda prendido), `recording` sigue en true y `startRec()` hace early-return, así que no se puede grabar de nuevo hasta desmontar la página. Y el `onstop` capturó el destino del chat ORIGINAL en el closure, así que si de algún modo se reanuda, el audio se manda al contacto equivocado. La condición correcta es `state !== 'inactive'` (un recorder pausado igual emite `onstop` al llamar `.stop()`).

**Vive en:** app/whatsapp/page.tsx:387 · *2026-06-23 ~auditoria-inbox-whatsapp-chatwoot*

#### Poner una `nota` en un ámbito de Datos de Mau pinta el toast de ÉXITO en rojo

Síntoma: los ámbitos con `nota` (perfil, setting, crm, integraciones, whatsapp) muestran SIEMPRE el aviso en tono error aunque la copia haya salido perfecta. Causa real: el cliente empuja al mismo array `detalle` los errores reales Y los `avisos` informativos que devuelve el server (`avisos.unshift(def.nota)`), y después decide el tono con `tono: detalle.length ? 'error' : 'info'`. Un texto explicativo se cuenta como si fuera una falla. Regla: no mezclar canales — un aviso informativo y un error tienen que viajar en campos distintos, o el tono se decide por el `ok` de cada llamada, nunca por el largo de una lista que acumula las dos cosas. Mientras no se arregle, agregar un ámbito nuevo con `nota` es garantizar que su toast salga rojo.

**Vive en:** app/_components/PanelAgencia.tsx:134-139 · app/_components/DatosDeMau.tsx:68-78 · lib/datos-mau.ts (las 5 entradas con `nota`) · *2026-08-02 ~investigar-onboarding-chat-agent*

#### `marcarPasoTab` pisa la pegajosidad del onboarding: una tab terminada vuelve a «pendiente»

Síntoma: un cliente que ya había cerrado el onboarding de una tab reabre el wizard, toca cualquier paso y queda encerrado otra vez. Causa real: `getEstadoTab` respeta el estado guardado (`parsed.status === 'done' || todo ? 'done' : 'pendiente'`) justamente para que agregar pasos no re-encierre a nadie, pero `marcarPasoTab` recalcula duro contra el catálogo actual y PERSISTE el resultado: si el catálogo ganó un paso obligatorio nuevo, el `done` viejo se pierde para siempre en el primer clic. Regla: si agregás un paso NO opcional a `TAB_ONBOARDINGS`, asumí que todos los workspaces que ya la tenían cerrada vuelven a pendiente — decidilo antes de desplegar, no con clientes adentro. Y no renombres una key existente: el wizard retoma en el primer paso incompleto, así que una key nueva aterriza en ese paso a todo el que ya había terminado.

**Vive en:** lib/tab-onboarding-state.ts:214-236 (getEstadoTab vs marcarPasoTab) · *2026-08-02 ~investigar-onboarding-chat-agent*

#### Una pregunta tipo 'escala' con opciones de texto se contesta con un 3 que no significa nada

Los dos renderers pintan 1..5 pelados cuando tipo==='escala' y DESCARTAN q.opciones (verificado hoy en TareasRecibidasModal.tsx:433). Y no es un mistype raro: el prompt de reuniones ordena «CERRADAS SIEMPRE: cada pregunta con 2-4 opciones concretas» y mete 'escala' en el enum sin definir nunca qué significa, así que {tipo:'escala', opciones:['Landing nueva','Arreglar el checkout']} es la salida ESPERADA. El validador la deja pasar y al Perro le llega «la pregunta → 3». Bug hermano en el mismo renderer: no hay rama para tipo 'texto' ni para tipos con opciones vacías — se pinta el enunciado y CERO controles, solo queda «Saltear». Fix en origen: degradar escala-con-opciones a 'opcion', y filtrar toda pregunta que pida opciones y venga con menos de 2 antes de que llegue a la pantalla.

**Vive en:** app/plan/board/TareasRecibidasModal.tsx:433 · app/plan/revisar/[id]/RevisarPropuesta.tsx · lib/plan-propuesta.ts (limpiarPregunta) · lib/plan-fathom.ts (preguntasDeContexto) · *2026-08-05 · ~fathom-preguntas-lote-whatsapp-forense*

#### Las preferencias en localStorage sangran entre inquilinos: el origin es el mismo

Al impersonar clientes en el mismo navegador, las keys sin namespace muestran datos del anterior: borradores de WhatsApp, el wizard de Nueva Campaña a medio llenar, marcas de leído, drafts del plan y el board v9. Son 12 keys ('mako-wa-drafts', 'mako-wa-empresa-drafts/leido', 'mako-wa-leido', 'mako.nuevaCampana.draft.v2', 'mako.adsTable.cols.*', 'mako_draft_proyecto', 'mako_draft_tarea', 'mako.revisar.*', 'mako_ia_last_seen_at', 'mako-wa-tpl-*', 'mako_plan_v9'). BoardShell ya lo resolvió con dlKey(base)=`${base}_${scope}` — verificado hoy que las suyas están scopeadas y que 'mako-wa-drafts' sigue pelada. Es el patrón a copiar; además, tras cualquier reset de workspace hay que barrer las keys 'mako*' del navegador o la app sigue pareciendo llena.

**Vive en:** app/whatsapp/WhatsAppApp.tsx:280 · app/plan/board/BoardShell.tsx (dlKey, el patrón correcto) · app/ads-manager/NuevaCampanaModal.tsx · *2026-08-01 · mako-cliente-prueba-diagnostico*

#### El progreso de una tarea es DERIVADO de la checklist: generarla pisa el avance a 0

setChecklist recalcula progress = round(hechos/total*100) cada vez que la lista no está vacía. Una tarea 'alta' con 70% puesto a mano y sin checklist califica para el botón «MaKo arma la checklist» (el filtro solo pide checklist.length===0 && progress<100), y al generarla todos los ítems nacen en done:false → el 70% se va a 0 sin aviso. Y el undo es lossy: la entrada de historial 'ia' solo captura la checklist, así que deshacer restaura checklist=[] y deja progress en 0. Regla: si un campo es derivado, cualquier acción que reescriba la fuente tiene que capturar el derivado en el snapshot de undo.

**Vive en:** app/plan/board/useBoard.ts (setChecklist / undoHist) · app/plan/board/BoardShell.tsx (generarChecklist) · *2026-07-19 · ~review-datosmodal-plan-board*

#### El server responde ok:true y descarta en silencio: dos formas de perder datos en el onboarding

(1) El route de fotos salta cualquier archivo >15 MB, acumula el motivo en `warnings` y responde igual `{ ok: true, warnings, ...estado }`; el cliente hace `if (j.ok) setEst(j)` y nunca lee warnings, así que la foto no aparece y no hay ningún mensaje. Encima el filtro del cliente solo mira type.startsWith('image/'), no el tamaño, así que el archivo SÍ se sube. (2) Los routes de entregables y razones hacen `.filter(x => x.nombre)` al guardar: si el usuario selecciona-todo el nombre para reescribirlo y hace blur antes de tipear, el update optimista mantiene la tarjeta un instante y la respuesta del server la borra entera, con su queEs/fomo o su copy y guion. Sin confirmación, sin undo y sin recuperación (el getter reaplica el mismo filtro). Regla: si el server descarta algo, o falla, o el cliente TIENE que pintar el warning.

**Vive en:** app/api/onboarding/persona/route.ts + app/onboarding/PersonaView.tsx · app/api/onboarding/entregable/route.ts + EntregableView.tsx · app/api/onboarding/razones/route.ts + RazonesView.tsx · *2026-07-28 · ~review-onboarding-fabrica-creativos*

#### El placeholder del Dropdown de la casa NO es una opción seleccionable

En app/components/Dropdown.tsx el placeholder se usa solo como label del botón cuando no hay selección; los únicos ítems clickeables salen de `options`. Al migrar un `<select>` nativo que tenía `<option value="">Elegí…</option>`, esa opción de limpiar la selección se pierde: en el picker de plantilla de WhatsApp, una vez elegida una plantilla ya no había forma de volver a «sin plantilla», solo cambiar a otra. Si el select migrado tenía una opción vacía, hay que agregarla explícitamente a `options` o resetear el estado por otro camino.

**Vive en:** app/components/Dropdown.tsx · app/whatsapp/WhatsAppApp.tsx (picker de plantilla) · *2026-07-13 · ~review-commits-funnel-dropdowns*

#### Un callback opcional que nadie pasa es código muerto que el typecheck no ve — y un route handler por fetch no revalida el server component

`ServicioConfigForm` declaraba `onEstado?: (conectada: boolean) => void` y lo invocaba en cada carga y en cada guardado; el único call-site del repo lo montaba sin la prop. Con optional chaining eso es un no-op silencioso: `calcConectada()` se calculaba y el booleano se tiraba, sin error de compilación. El síntoma era que la app se contradecía a sí misma en un solo viewport: la fila decía «✓ Guardada» en verde y, a centímetros, el chip del mismo modal seguía en «Por configurar», el tile ámbar y el contador quieto. El fondo es de Next: el array `integraciones` baja como prop de un server component y el POST va por `fetch` a un route handler — no es Server Action, no vuelve payload RSC, y `force-dynamic`/`revalidate = 0` rigen el render del servidor, no el estado del cliente ya montado. Hace falta un `router.refresh()` explícito (hoy cableado como `onCambio`).

**Vive en:** app/integraciones/ServicioConfigForm.tsx:260-262 y :351 · app/integraciones/IntegracionesBoard.tsx:1107 y :381 · *2026-07-16 · ~auditoria-refactor-integraciones*

#### `.mk-scroll-x` recorta en los DOS ejes: ningún popover `absolute` puede vivir adentro

Síntoma: en /ads-writer tab «Guiones» tocás «Filtrar» y no aparece nada (a lo sumo asoma una scrollbar vertical en la barra); los filtros de ángulo, avatar y fecha quedan inalcanzables para todo usuario, en cualquier ancho. Causa: `.mk-scroll-x` declara solo `overflow-x: auto` y deja `overflow-y` en `visible`; por spec, si un eje es `auto` el otro `visible` computa a `auto`, así que la caja clipea en los dos. Medido en navegador real: `getComputedStyle(scroller).overflowY === 'auto'`, `clientHeight=41px` contra `scrollHeight=308px`, y el popover (`top: calc(100% + 6px)`) arranca 1px debajo del content box: cero píxeles visibles. El `zIndex` no salva nada — el clipping de overflow no se saltea con z-index. `overflow-x: clip` sí preservaría `overflow-y: visible`, pero mata el scroll táctil que es para lo que existe la clase. Regla: cualquier menú dentro de `.mk-scroll-x` (incluido el slot `filtros` de PageHeader) va en portal `fixed` posicionado por `getBoundingClientRect()`, que es exactamente lo que hace `app/components/Dropdown.tsx` y por lo que existe.

**Vive en:** app/_ui/ui.css:445-449 (`.mk-scroll-x`) · app/ads-writer/GuionesGlobal.tsx:156,348-352 · patrón correcto en app/components/Dropdown.tsx:114-133 · *2026-08-06 · ~review-adversarial-content-machine*

#### Dos copias del mismo estado + un guardado que postea el documento ENTERO = borrado silencioso

Síntoma: escribís un guion desde la matriz, se ve bien; después editás o borrás CUALQUIER otro guion desde la galería y el primero desaparece de la base, sin error y sin aviso. Causa: `MatrizView` tiene su propio estado y guarda contra la API sin avisarle al padre, mientras el shell `AdsWriterApp` carga UNA sola vez (`useCallback` con deps `[]`) y sus mutaciones postean el array `celdas` capturado en el closure como la matriz COMPLETA (`action:'guardar'`), y el route hace `setRazones(limpio)` reemplazando todo. La sincronización quedó de una sola dirección (galería→matriz), así que la copia vieja pisa la nueva. Regla: si un endpoint reemplaza el documento entero, ningún componente puede tener una segunda copia del estado sin un canal hijo→padre; y las mutaciones postean desde el updater funcional (`setX(prev => …)`), nunca desde el array del closure. Efecto secundario del mismo bug: el contador de cobertura y «Escribir el próximo guion» siguen viendo la celda como vacía y generan un duplicado.

**Vive en:** app/ads-writer/AdsWriterApp.tsx:49-61,118-127 · app/onboarding/MatrizView.tsx:74,120-124 · app/api/onboarding/razones/route.ts:135-151 · *2026-08-06 · ~review-adversarial-content-machine*

#### Un componente declarado DENTRO del render remonta todo el subárbol en cada tecla

Síntoma: un input dentro de una lista perdía el scroll y el foco con cada tecla y las 61 opciones se volvían a montar enteras — parecía un problema de virtualización o de `key`. Causa: el componente estaba declarado dentro del render del padre, así que React lo trata como un TIPO nuevo en cada pasada y remonta el subárbol completo. Solución: una función que devuelve el elemento, no un componente anidado.

**Vive en:** app/crm/SelectorHora.tsx · *2026-08-07 contexto-mako-md*

#### `nota` y `placeholder` del catálogo de credenciales son texto muerto: el cliente lee «Pendiente» en el input

`ServicioConfigForm` trae `nota` del API y la tipa (l.46) pero no la pinta en ningún lado, y el `placeholder={sem.placeholder}` (l.488) no sale del catálogo: sale de `semaforo()` (l.93), que devuelve 'Pendiente' / 'Opcional' / '••••1234'. O sea que «Con el prefijo act_», «Token de usuario de sistema (no expira). Permisos: ads_read, ads_management, business_management» y las otras notas de metodo-catalogo.ts NUNCA se ven en la pantalla donde se pega la credencial: las pistas de formato solo existen si el cliente abre el '?'. Es el mismo patrón que el matiz honesto de las features de la landing — un campo del catálogo que nadie renderiza — pero acá el costo es que el cliente pega el ad account sin `act_` y el guardado falla.

**Vive en:** dashboard-marketing/app/integraciones/ServicioConfigForm.tsx (nota 46, semaforo 93, placeholder 488) + lib/metodo-catalogo.ts (nota/placeholder por servicio) · *2026-07-31 auditoria-tokens-meta*


### Reglas que quedan

#### El dorado de MaKo no admite texto blanco

Blanco sobre el gradiente `#F2A516 → #E0870A` da 2,06:1 y 2,75:1 — no llega ni al piso de 3:1, y los labels son de 10,5-14 px (uppercase/bold), o sea texto chico que necesita 4,5:1. Verificado recalculando la luminancia. El resto del documento ya usa la solución correcta (ámbar oscuro sobre dorado claro: `#C77E08` sobre `#FBEBCB`, `#9A6207` sobre `#FEF6E4`), así que los badges blancos son el outlier. Oscurecer el gradiente NO alcanza (el extremo claro queda en ~3,3:1): la salida que pasa AA es texto casi negro ámbar (`#3A2604`, ~5,2:1 y ~7:1) manteniendo el dorado brillante.

**Vive en:** app/vsl/estrategia/Estrategia.tsx (.s-tier-ribbon, .s-diff-seg-3, .s-ch-lever .s-ch-id, .s-rung-1 .s-rung-n) · *2026-07-19 ~revision-landing-estrategia-vsl*

#### Un «no volver a mostrar» nunca puede esconder su propia vía de reapertura

El DatosConfirm decía textual «Podés reabrirlo cuando quieras desde el ícono ⚠ del plan», y el botón que lo reabría estaba gateado por `!datosOff` — o sea que desaparecía exactamente cuando el usuario aceptaba apagarlo, dejando la feature de deadlines/checklists inalcanzable para siempre hasta limpiar localStorage. Agravante del mismo caso: el auto-open era agnóstico de vista pero el botón de reapertura solo se renderizaba en kanban, y la vista por defecto es 'prioridades'. La regla: el copy de un diálogo es un contrato; si promete una vía de vuelta, esa vía tiene que existir en TODAS las vistas donde el diálogo puede aparecer.

**Vive en:** app/plan/board/BoardShell.tsx · app/plan/board/DatosModal.tsx · *2026-07-19 · ~review-datosmodal-plan-board*

#### Nada del onboarding puede asumir que los pasos son los de la capa `completo`

El status 'done' del wizard estuvo clavado a `body.step === 'retro'`. Cualquier capa que no termine en retro quedaba `in_progress` para siempre y `guardOnboarding` devolvía al usuario al wizard en loop infinito, aunque lo hubiera terminado. El último paso sale de `pasosDeCapaActual()`, nunca de un literal. Gemelo del mismo subsistema: el escape del onboarding de una tab apuntaba a `router.refresh()`, que re-corre el guard del server y devuelve el mismo wizard — un onboarding de tab se cierra con estado de CLIENTE. Antes de reabrir un onboarding, verificá que tenga salida.

**Vive en:** app/api/onboarding/route.ts · lib/onboarding-state.ts · lib/tab-onboarding-state.ts · *2026-08-07 contexto-mako-md*


### Lo que quedó sin hacer

#### El feed de notificaciones existe en la base y no lo muestra nadie

La tabla `notificaciones` se llena y `/api/notificaciones` responde, pero ningún componente lo consume: el badge del sidebar viene de WhatsApp/Evolution, no de este feed. Y cada reporte que se despacha escribe un link a `/perfil?tab=notificaciones`, una tab que ya no existe. Es el mismo modo de falla que el resto de este lote — se escribe bien y no se lee. Ojo que esto contradice lo que dice la memoria perfil-notificaciones-reportes sobre la campanita in-app: al 2026-07-19 el feed está escrito y no se ve en ninguna pantalla.

**Vive en:** app/api/notificaciones, lib/reportes.ts (link a /perfil?tab=notificaciones) · *2026-07-19 ~landing-24-features-auditoria*

#### La tab Teléfonos de /configuraciones no existe: el panel está escrito y nunca se montó

`app/configuraciones/TelefonosPanel.tsx` no lo importa nadie: `ConfigInnerTabs` solo lista notif · fiscal · equipo. Esto DEROGA lo que dice la memoria [[telefonos-workspace]], que la da por viva junto con Integraciones. En la misma pasada: `/api/admin/mako-grupo` no tiene ningún caller en la UI, y `ConfigInnerTabs` arranca fijo en 'notif' sin leer query params — el link `?tab=notif` que usan todos los avisos funciona por coincidencia con el default, y el día que cambie el default se rompen los 49 avisos a la vez.

**Vive en:** app/configuraciones/TelefonosPanel.tsx · app/configuraciones/ConfigInnerTabs.tsx:18 y :24 · lib/avisos.ts:81 · *2026-08-06 · rediseno-notificaciones*

#### Entregable y Persona funcionan en el hub de onboarding pero son huérfanos del wizard

Los dos tienen su View, su route (GET/POST/DELETE) y aparecen como tabs del hub — pero el hub vive en /onboarding y solo se desbloquea cuando el onboarding está 'done', así que un cliente nuevo, durante el alta bloqueante, nunca los ve. No es un flag apagado: no están cableados. Falta (a) sumarlos al union `PasoOnboarding` de lib/capas.ts, que es la fuente de verdad de qué pasos existen, (b) meterlos en el array `onboarding` de la capa 'completo', (c) actualizar el `type Paso` LOCAL del wizard, que duplica el union y hay que tocar en paralelo, y (d) agregarles rama en el builder de pantallas: sin la rama, aunque estén en el array de la capa no se genera ninguna pantalla y el paso desaparece en silencio. Ojo: el hub NO está en /configuraciones (esa ruta no tiene nada de onboarding).

**Vive en:** lib/capas.ts:24 y :110 · app/onboarding/OnboardingWizard.tsx:48, :243-299, :484-491 · lib/onboarding-state.ts:56-67,82-93 · app/onboarding/OnboardingTabs.tsx:89-100 (el orden canónico) · *2026-07-28 mapear-onboarding-ajustes*

#### WizardShell llama a useCapaModal pero nunca engancha `capa.refScroll`

La pila de modales promete que al cerrar el de arriba el de abajo vuelve con el scroll exactamente donde estaba. En los wizards no funciona en NINGUNO: `WizardShell` usa `useCapaModal` para el z-index y la visibilidad pero no le pasa `capa.refScroll` al contenedor que scrollea. Volvés de un modal apilado y estás arriba de todo. Nota del mismo archivo: el prop `error` es UNA LÍNEA de texto — una lista de faltantes con botón va como último hijo del cuerpo, no ahí.

**Vive en:** app/_components/WizardShell.tsx · app/_components/pila-modales.ts · *2026-08-07 contexto-mako-md*

#### La ficha del lead tiene una TERCERA copia, en /whatsapp, y es de solo lectura

docs/hallazgos-crm.md dice que la ficha vive en dos árboles (el modal `LeadDetail` del CRM y la página `/leads/[id]`). Hay un tercero: `/whatsapp` no reusa ninguno de los dos — tiene su propio pop-up inline (page.tsx 777-881) alimentado por `/api/whatsapp/lead/[id]`, que devuelve un resumen liviano (getLead + getVslEngagement) distinto del `CrmLead`. Resultado: desde el inbox la ficha es SOLO LECTURA y con secciones propias, y su footer manda a `/leads/{id}` para poder editar. El wrapper reusable ya existe y no hace falta tocar `LeadDetail` (que es controlado): `LeadEditModal` se monta solo con `leadId` y ya está probado montado dinámico con ssr:false en app/_components/Desglose.tsx:24.

**Vive en:** dashboard-marketing/app/whatsapp/page.tsx (fichaOpen/abrirFicha 207-210 y 454-469, markup 777-881) + app/api/whatsapp/lead/[id]/route.ts + app/leads/LeadEditModal.tsx · *2026-06-23 wa-inbox-recon*

