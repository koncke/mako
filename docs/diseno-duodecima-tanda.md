# Duodécima tanda de Automations: diseño

> Escrito el 12/10/2026 por el arquitecto de la corrida `wf_ec999673-272`, en el worktree `C:/dev/wt-undecima` (rama
> `undecima`, HEAD `e58ff6c9`). Se basa en cuatro relevos medidos en prod ese día (~03:00-05:30 UTC, sólo lectura) y se
> contrastó con el código del worktree. El pedido literal de Martín (la prueba con Fiesta Music, ws10) está en el último
> hito de `app/admin/dev/chatbot/bitacora.ts`.
>
> **Re-medido a las 05:33 UTC** (`scratchpad/wf-duodecima/arquitecto/ws10-estado.mjs`):
> - ws10 #243 «Entrega de Lead Magnet por Instagram» está ARCHIVADA desde las 02:56:56.
> - #244 y #245 están pausadas; #242 está en blanco.
> - Hay 0 inscripciones en esas automatizaciones y 0 claves `automatizacion.chat:*`.
>
> No hay datos que aplicar: §6.

## 0. Las reglas que gobiernan

- **Nada inventado.** La IA ve, y puede devolver, SÓLO lo que la pantalla ofrece hoy. Eso sale de las MISMAS funciones
  que usan el editor y el motor (el desplegable del CRON, `seccionesDeCondiciones`, `MENU_MAS`). El código vuelve a
  validar todo, y lo que no existe se saca con un aviso corto. Nunca se reemplaza «por lo más parecido».
- **Nunca fricción.** MaKo pregunta sólo si falta un dato DECISIVO, con 2 a 4 opciones del catálogo, más «Otra cosa» y
  «Elige tú». Como mucho, 2 rondas.
- Texto de pantalla corto y en «tú» neutro. Lo visual lo mira Martín.
- Sin migración: todo entra en el esquema de hoy (el chat va en `app_settings`, ver §2.5).

## 1. Lo que corrigió la medición (va a la cosecha)

1. **El diagnóstico obvio era el equivocado: las etapas de Entrega SÍ le llegan al modelo**, y en vivo
   (`productosConEtapas`, lib/setting-secuencias.ts:323, sin caché). Lo que NO le llega:
   - las clases de CRON que se sumaron después (`CLASES_DISPARADOR`, lib/disparadores.ts:130): Instagram, Messenger,
     Email, Pagos, «se agrega / se quita etiqueta»;
   - las condiciones según el ámbito.

   En ws10 hay DOS «Onboarding»: el producto 39 «Fiesta Music» y el 10 «Service Delivery & Ops». Ninguno tiene fila en
   `producto_entrega`, así que los dos usan las etapas de fábrica. Lo que falta es una PREGUNTA de producto, no más
   opciones.
2. **El canal lo pierde el CÓDIGO, no el modelo.** `nodoDe` (lib/flujo-ia.ts:782) convierte en WhatsApp todo lo que no
   sea email, sin ningún aviso. Además `PasoIA.canal` sólo admite `'whatsapp' | 'email'` (:268), y el system dice
   «Armas AUTOMATIZACIONES de WhatsApp y email».
3. **#243 y #245 los escribió gemini-flash-lite**, el respaldo que entra después de un 429 de gemini-flash. No fue
   Groq: `pasada` (lib/flujo-ia-crear.ts:189) llama a la cascada sin `sinRespaldoDeModelo`. Además el `motivo` es
   siempre el de crear, también cuando se edita.
4. **La IA escribe sólo las columnas viejas del CRON** (`setTriggerSecuencia`): la lista `disparadores` de la mig 0241
   queda en NULL (#243 y #245). La pantalla y la API guardan con `guardarDisparadores`.
5. **«Pagó» con un CRON de entrega.** Tres causas:
   - Las FILAS escritas a mano del system (pago, agendo, antigüedad, reunión) son todas de adquisición.
   - `filaDe` y `filaDelCatalogo` nunca llaman a `seOfrece(def, ámbito)`.
   - El desplegable real, con entrega, no ofrece «Pagó» (medido: 28 condiciones con adquisición y 16 con entrega).

   Las «cuotas» no las pidió nadie: las dibuja la fila «Pagó» («Cuota [Cualquiera]», EditorCondicion.tsx:452). Y
   «Ya procesamos tu pago en Stripe» es una herramienta inventada.
6. **«Esa tarjeta no puede abrir otro camino a la vez»: editar sólo AGREGA** (`deIAEdicion`). Ante «cambia WhatsApp
   por Instagram», la edición colgó en paralelo una COPIA por WhatsApp (el `"instagram"` del modelo pasó por `nodoDe`).
7. **El ✦ y el título miden lo mismo (44/44)** por código, y hay un test que lo fija. Lo que se ve «más grande» es el
   bloque negro macizo al lado de tarjetas claras. Con una tarjeta abierta, el clic sólo alterna `editandoIA`, y la
   barra está en `display: none` (SecuenciaPerfil.tsx:881): no pasa nada visible.
8. **El aviso de Probar existe (décima tanda), pero no se ve**:
   - El primer POST tarda ~14 s (medido en ws10: es el «escribiendo…» de Evolution).
   - El aviso dura 3,2 s.
   - Vive DENTRO del panel (z 3), debajo de la barra de MaKo y de Publicar.
   - Se pierde al cerrar Probar o al tocar ↻.
9. **El CRON y la tarjeta usan dos verdades distintas para «Instagram conectado».** El CRON mira la página de
   Facebook (Graph). La tarjeta, Probar y Publicar miran Zernio, que es por donde llegan de verdad los eventos. ws10,
   11 y 13 tienen Zernio con `webhook_ok=false` y nunca recibieron un evento.
10. **«Te sigue» existe en Zernio** (`GET /v1/accounts/{id}/follow-status/{igsid}`), pero Meta sólo contesta por quien
    YA ESCRIBIÓ por DM. Para quien sólo comentó, la respuesta es «no sé».
11. **Operate → General.**
    - El link de la marca tiene `padding-bottom: 20px` y se estira a todo el ancho (Sidebar.tsx:119). Los 20 px entre
      el logo y el rótulo OPERATE son link a /general.
    - Además, `.mk-seccion` va sin `nowrap`: durante la animación de 200 ms los rótulos de dos palabras bajan de
      renglón y la barra salta 16 a 32 px.
12. **El guard de los tutoriales estaba ciego.** tests/tutoriales-legibles.test.ts:55 busca 6 espacios y los pasos
    están a 8: lee 0 líneas.

## 2. Punto por punto

### 2.1 «Le dije Instagram y lo hizo por WhatsApp» (y la palabra «reel»)
- `PasoIA.canal` admite `instagram | messenger`. `nodoDe` respeta el canal, con texto ≤ `TOPE_TEXTO_SOCIAL` (1000) y
  link, sin audio, sin archivo y sin IA. El system ofrece los cuatro canales de `MENU_MAS`.
- **El canal del pedido** lo decide `canalDelPedido(pedido)` (pura, en lib/flujo-ia.ts). Gana la palabra FUERTE:
  - `reel|instagram|\big\b|story|stories` → instagram;
  - `messenger|facebook` → messenger;
  - `whats|wsp|wpp` → whatsapp;
  - `email|correo|mail` → email.

  Si no hay ninguna, `null` (el default de siempre).
- **`validarIA`**, segunda capa y con error para el reintento:
  - con el canal social pedido (o elegido), ningún mensaje AL LEAD por WhatsApp (el aviso al equipo por «MaKo en
    WhatsApp» sí vale);
  - un mensaje social sólo con un CRON de ese mismo canal (una etapa o una etiqueta no abren la ventana de Meta);
  - nunca debajo de un «Si responde»;
  - ninguna espera de más de 24 h antes de un DM (`esperaAntesDe` contra `VENTANA_META_MS`).
- **Un flujo social no lleva «Si responde» ni AI Step.** El AI Step contesta por WhatsApp (lib/nutricion.ts:5002 y
  :5131 llaman a `asistirRespuesta` sin `medio`). Se sacan con el aviso «Saqué el Si responde: por Instagram todavía
  no contesta».
- `PALABRAS_PLANTILLA` suma `instagram-te-escribieron` y `messenger-te-escribieron`.

### 2.2 El CRON: «es un cliente entrante, no un lead entrante», y las opciones nuevas
- `opcionesCronIA` (pura, en lib/disparadores.ts) arma lo que ve el modelo con lo mismo que el desplegable:
  - `kanbansDe`, las etiquetas, «se agrega / se quita etiqueta», y los `eventosOfrecidos` de Instagram, Messenger,
    Email y Pagos, sin los «apagado»;
  - cada canal entra SÓLO si está conectado (`estadoCanalesDisparo`);
  - Recurrente queda afuera, porque pide un horario.

  Los valores están en §3.1. El prompt sigue con las claves `d1…` en un bloque compacto, sin el tope silencioso de 80.
- **Se guarda por la misma puerta que la pantalla.** `disparadorDeValorIA(valor) → Disparador[]` y
  `guardarDisparadores`, así la lista de la 0241 deja de quedar en NULL.
- **«Cliente entrante», «cliente nuevo» y «llega a onboarding» son de ENTREGA.** Si el pedido nombra una etapa de
  entrega que existe y el modelo eligió una etapa de venta, el código corrige con un aviso. Si esa etapa está en 2 o
  más productos, pregunta el producto (§2.4).
- **Modelo**: `sinRespaldoDeModelo: true`, así que después del 429 de gemini-flash pasa a Groq y no a flash-lite.
  Editar lleva su propio `motivo`.

### 2.3 Condiciones: nada que no esté en el desplegable («Pagó», «cuotas»)
- El ámbito sale de resolver el CRON PRIMERO (`deIA` lo mueve arriba):
  - CRON de entrega → `entrega`; cualquier otro → `adquisicion`;
  - sin CRON, sólo las condiciones que se ofrecen en LOS DOS ámbitos.
- Las condiciones válidas son los ids de `seccionesDeCondiciones(ámbito, catálogo)`, con el MISMO catálogo que arma
  el editor. Hoy `catalogosDe` vive en EditorCondicion.tsx; pasa a una lib pura que usan los dos.
- `filaDe` y `filaDelCatalogo` sacan lo que no está, con el aviso «Saqué «Pagó»: no está en tus condiciones».
  `validarIA` lo vuelve a mirar.
- Las condiciones de lista (etapa de entrega, estado del cliente, origen…) dejan de tirarse siempre: se resuelven por
  NOMBRE EXACTO contra `opcionesDe(catálogo, cat)`, y si no coinciden se van. Así una automatización de entrega
  puede usar «Está en la etapa de entrega».
- Del system se van las FILAS escritas a mano (queda sólo la forma). El user lleva los ids por ámbito.
- **Herramientas inventadas.** Un texto que nombra una herramienta (Stripe, Mercado Pago, PayPal, Hotmart, Calendly,
  Cal.com, Zoom, Google Meet…) que no aparece ni en el perfil ni en el pedido es un error para el reintento. Se
  compara sin tildes ni mayúsculas.

### 2.4 Preguntas con opciones (el molde de Claude)
- **Antes del modelo**, `preguntaAntes(pedido, ctx, respuestas)` (pura, en lib/flujo-ia-preguntas.ts). Pregunta SÓLO
  en estos casos:
  - **canal**: el pedido no nombra ninguno, hay 2 o más conectados entre WhatsApp, Instagram y Messenger, y el pedido
    trae una señal social débil (`comenta|publicaci|post|seguid|dm|mensaje directo|historia`). Sin esa señal, va
    por WhatsApp sin preguntar.
  - **producto**: el pedido nombra una etapa que existe en 2 o más productos y no nombra el producto (el «Onboarding»
    del ws10).
  - **evento de Instagram o Messenger**: el canal es social y el pedido no dice qué hace la persona. Las opciones son
    las 3 primeras de `EVENTOS_*` que no están apagadas.
- **Del modelo**: puede devolver `{"pregunta":{"sobre":"cron"|"condicion","texto":"…","opciones":["d3","d7"]}}` en
  vez del flujo, sólo si le falta un dato decisivo. `preguntaDeIA` resuelve las claves con los rótulos del catálogo.
  Con menos de 2 opciones válidas, o con 2 rondas ya contestadas, es un error para el reintento («no preguntes:
  elige tú»).
- **Las respuestas las impone el CÓDIGO:**
  - canal → `ctx.canalElegido`, que hace cumplir `validarIA`;
  - producto → se filtran las opciones del CRON a ese producto;
  - evento o CRON → se fuerza el disparador;
  - condición, «Otra cosa» → van como texto al final del pedido, y el catálogo igual la valida;
  - «Elige tú» → no impone nada.
- Textos: «¿Por dónde le escribo?», «¿De qué producto?», «¿Qué hace la persona?». Los rótulos de las opciones salen
  siempre del catálogo.
- **API de MaKo (WhatsApp)**: `preparar` corre `preguntaAntes`. Si hay una pregunta, devuelve `{error, faltan}` con
  las opciones numeradas para que el doer la haga en el grupo. El input acepta `canal`, `producto` y `evento`.

### 2.5 Un chat por automatización, abierto al entrar
- **Se guarda en `app_settings`, SIN migración.**
  - Clave `automatizacion.chat:<secuenciaId>` (va por workspace) y valor `{v:1, mensajes}`, con tope de 60.
  - Se escribe con `cambiarSettingSi` (compare-and-set, 3 vueltas) y SIEMPRE dentro de `runWithWorkspace`
    (`getSetting` cae al ws 1 si falta el contexto).
  - Una automatización ARCHIVADA conserva su chat. El único borrado real es el legado de email-marketing, y una clave
    huérfana no molesta.
- **Quién escribe:**
  - la ruta: el pedido o la respuesta al empezar, y la pregunta o el resumen de MaKo (armado por CÓDIGO: «Cambié 3 ·
    saqué 1 · agregué 2», más los avisos) al terminar, o el error;
  - `crearConIA`, al nacer la fila: vuelca el historial de la galería, que antes de crear vive en el cliente y viaja
    entero en cada turno;
  - la API, con `via: 'whatsapp'`.
- **Quién lee:** `GET /api/chat-agent/secuencias/ia?secuenciaId=`, sólo admin.
- **La UI: un solo `ChatMako.tsx`** para la galería y para el lienzo. Reemplaza la caja de «Pídeselo a MaKo» y la
  barra «Pídele un cambio».
  - Muestra el hilo yo/MaKo, la pregunta como tarjeta con 2 a 4 botones, «Otra cosa» y «Elige tú», y el composer con
    `BotonDictar` y ➤.
  - Muestra las fases reales y los avisos en el último mensaje de MaKo.
- **Abierto al entrar:**
  - `alCrearConIA` → `setAbrirSec({id, mako: true})`;
  - `?sec=<id>&mako=1`, que es también el link de la API;
  - el ✦ abre el chat y cierra la tarjeta abierta (§2.7).

  Al abrirse, va al último mensaje.

### 2.6 Editar: cambiar, quitar y volver a poner
- **Formato:** `{"cambiar":[{"id":"<id real>", …campos}], "quitar":["<id>"], "agregar":[…como hoy], "disparador":"d7"|["d3","d4"]|null}`.
  Los ids reales ya van en EL FLUJO ACTUAL (`aIA`). Sigue aceptando el formato viejo (sólo `agregar`), por si se
  guarda un override de prompt (hoy hay 0).
- **Se aplica en este orden:**
  1. **quitar**, con `borrarNodo` (el mismo del lienzo). Una condición o un AI Step se llevan lo que cuelga, con el
     aviso de cuántas tarjetas se fueron.
  2. **cambiar** CONSERVA el id. Es un parche por clase con los MISMOS resolvers de `nodoDe`: se mezcla la tarjeta de
     hoy con lo que cambia y pasa por `nodoDe`.
     - mensaje: canal, texto, asunto, vista previa, link, audio, archivo e IA;
     - espera: horas, días y antes de la reunión;
     - condición: filas por rama, conservando los ids de rama y los destinos;
     - etiqueta, acción y objetivo del AI Step.

     Cambiar de clase es quitar y agregar en el mismo puerto.
  3. **agregar**, como hoy, que puede usar los puertos que dejó libres el quitar.
- **Validación:** `validarIA` sobre lo cambiado y lo agregado, más `erroresNuevos` y las reglas del canal social. Si
  no cambia nada, es un error.
- **«Cambia WhatsApp por Instagram»** cambia el canal de cada mensaje AL LEAD. Si el CRON no es de Instagram, además
  pregunta «¿Cambio qué la dispara?» con las opciones del catálogo y «Déjalo así», porque con un CRON de etapa el DM
  no sale. En editar, la regla «un mensaje social sólo con un CRON de su canal» es esa PREGUNTA, no un error. Si el
  canal no está conectado (no hay opciones), queda el aviso «Conecta Instagram en el CRON». El «Si responde» y el AI
  Step salen con su aviso (§2.1).
- **El CRON no va al borrador:** se guarda recién cuando la persona toca una opción, por la misma acción del CRON
  (`action:'disparadores'`). Las tarjetas sí van al borrador, con Publicar de por medio, igual que un cambio a mano
  (los leads parados en una tarjeta quitada los maneja Publicar, como hoy).
- Renombrar NO entra en esta tanda.

### 2.7 El botón ✦ del título
- Una sola función, `abrirMako()`. Si hay una tarjeta abierta, la CIERRA (`foco` admite `id: null`) y abre el chat.
  Si no, alterna el chat. Nunca deja una tarjeta abierta con el clic sin efecto.
- **Aspecto:** se queda el recuadro de 44 (el del título y Probar), pero con la cara de `tarjetaChrome` (superficie
  clara, borde de 1 px, la misma sombra) y el logo de MaKo de 32 adentro. Encendido, el aro dorado de hoy.

### 2.8 El aviso de Probar
- `PanelProbar` avisa por `onEnviado(texto)` cuando vuelve OK el primer envío real, SIN el gate de recorrido: el
  mensaje salió de verdad. El `<Toast>` vive en `SimuladorWhatsApp`, fuera de la capa z 3, así que sobrevive a cerrar
  Probar y queda encima de la barra de MaKo y de Publicar.
- Si la misma prueba sigue viva, además deja la píldora «Enviado · revisa tu WhatsApp» en el hilo, CON el gate de
  recorrido.
- Instagram y Messenger siguen sin aviso, porque no mandan nada de verdad.

### 2.9 El filtro de canales de la lista
- Va con la fuente del motor: `CanalEnvio = Medio`, y el canal de un mensaje es `canalAGuardar(p.canal, p.tipo)`.
- El AI Step cuenta su «MaKo contesta» por su medio.
- Las opciones se arman recorriendo `MEDIOS` (WhatsApp, Email, Instagram, Messenger), después la línea, y después «A
  clientes» y «Al WhatsApp de MaKo». Los íconos sociales salen de `logoSocialSvg`.
- Un medio nuevo aparece solo en el filtro.

### 2.10 Condiciones de Instagram
Todas con ámbito `ambos`:
- En «Información del lead»: **Tiene Instagram / Sin Instagram** y **Tiene Messenger / Sin Messenger**. Quiere decir
  que tenemos una conversación con él por ese canal.
- Sección nueva «Instagram y Messenger»:
  - **Se le puede escribir por Instagram (y por Messenger)**. Usa `decidirSalida(...).via !== null`, la MISMA función
    con la que el motor decide si el DM sale.
  - **Te sigue en Instagram**. Se consulta en vivo a Zernio, sólo por quien escribió. El resto es `null` («no sé»),
    que no se cumple ni negado.
- La condición «Origen» suma Instagram y Messenger, los valores que ya escribe `createLead`.
- Fuentes nuevas `social` y `sigue`, con su `pide()` en `hechosDelCatalogo`. Una falla pasajera TIRA, como toda lectura
  del motor, y la inscripción queda para la próxima corrida.
- NO se ofrecen `followerCount` ni `isVerified`: la doc de Zernio no los define.

### 2.11 Conectar Zernio sin cambiar de tab
- **Una sola verdad de «conectado».** `estadoCanalesDisparo` toma Instagram y Messenger de `estadoMedios` (Zernio),
  no de la página de Facebook.
- **El CRON abre el MISMO modal que la tarjeta.** En los eventos de Instagram y Messenger, «Conectar» deja de abrir
  /integraciones y abre `ConectarMedio`: el OAuth en una ventana emergente y la consulta periódica.
- **Sin key, o con key mala, se resuelve ahí mismo.** Con «Falta conectar Zernio», o con un 401, aparece el campo «API
  key de Zernio». Con un 402, «Tu cuenta de Zernio está pausada», con su link de pago.
- **Publicar y Activar** con una tarjeta o un CRON social (ola 2):
  - miran también el CRON: hoy un CRON de Instagram con tarjetas de WhatsApp se publica sin Instagram;
  - aseguran el webhook de Zernio.

### 2.12 Sin onboarding en la tab
- **Sale la puerta del QR** (ChatAgentApp.tsx:566-593 y `abreEnQR`). Al entrar se ve el lienzo y el recorrido, también
  con 0 automatizaciones: se va el cartel «Todavía no hay automatizaciones» y la lista vacía tiene «＋ Nueva».
- **El QR salta solo al crear una tarjeta que lo necesita.** Lo decide `medioAConectarAlCrear`, con la MISMA regla que
  el chip «Sin conectar» y el freno de Publicar, y abre el modal del chip. Salta una vez por visita y por medio, y
  nunca con «no se pudo leer».
- **El aviso rojo** «todavía no vinculaste tu WhatsApp» abre `ConectarMedio` en vez de mandar a /whatsapp.

### 2.13 Operate → General (fuera de Automations)
- La marca queda con un padding de abajo de 2 px, `marginBottom: 18` y `alignSelf`, así el link mide lo que mide el
  logo.
- `.mk-seccion` lleva `whiteSpace: 'nowrap'`.
- Sin cambio visual, y sin bloquear clics.

### 2.14 Tutoriales de conexión cortos (fuera de Automations)
- Todo `tutorial.pasos` y toda `AYUDA_CAMPO[*].pasos` van de 3 a 5 pasos, de una línea y de 120 caracteres o menos. Una
  lista técnica después de «:» no cuenta para el largo.
- El tutorial de servicio pierde el paso «Para qué sirve», porque ya lo dice `paraQue`.
- La ayuda de un campo empieza con «Para qué sirve: …».
- Las trampas que rompen la conexión quedan DENTRO del paso: «se ve UNA vez», «Nunca», `rk_live_`, `APP_USR-`.
- Las notas también van a 120 caracteres o menos, y `pasoExterno.ojo` a 2 ítems.
- Hay un borrador validado de Stripe, Mercado Pago, Meta, Zernio y las keys de IA en
  `scratchpad/wf-duodecima/relevo-fuera/tutoriales-cortos-borrador.json`.

## 3. Contratos entre paquetes (exactos: los paquetes de una ola trabajan en paralelo)

### 3.1 Valores del CRON para la IA (`DisparadorIA.value`)
- **Los de hoy:** `venta:<funnelId>:<etapa>[,<etapa>]`, `entrega:<productoId>:<etapa>[,<etapa>]` y `etiqueta:<id>`.
- **Nuevos:**
  - `instagram:<subtipo>` (comentario|historia|dm|en_vivo|ref);
  - `messenger:<subtipo>` (comentario|dm|ref|qr);
  - `email_recibido:recibido`;
  - `pago:<subtipo>` (aprobado|rechazado|reembolsado|suscripcion_cancelada);
  - `etiqueta_agregada` y `etiqueta_quitada`.
- **Rótulos:** las secciones nuevas se titulan «Instagram», «Messenger», «Email», «Pagos» y «Etiqueta». El rótulo es el
  `label` de `EVENTOS_*`. Pasan por `disparadoresParaIA`, que no cambia.
- **Lo que se lee del valor:** el producto sale del valor (`entrega:<productoId>` / `venta:<funnelId>`), y el canal y
  el ámbito, de su prefijo (`entrega:` → entrega; el resto → adquisición). Nadie agrega campos a `DisparadorIA`.
- **`disparadorDeValorIA(valor: string, id = 'd1'): Disparador[]`**, puro, en lib/disparadores.ts:
  - `venta`, `entrega` y `etiqueta` usan `pedidoDisparo` y `conDisparo`;
  - los sociales y pagos, `{trigger_tipo, subtipo}`;
  - las etiquetas agregada y quitada, `{trigger_tipo}`;
  - un valor que no entiende devuelve `[]`.

### 3.2 `CtxIA` (lib/flujo-ia.ts): campos nuevos, todos opcionales
- `catalogoCondicion?: CatalogosCondicion` — el mismo que arma el editor. Lo llena `armarContexto`. Ausente = `{}`
  (sólo las condiciones sin catálogo).
- `canalElegido?: CanalIA`, con `type CanalIA = 'whatsapp' | 'email' | 'instagram' | 'messenger'` exportado. Lo pone
  la respuesta a una pregunta (ola 2).
- `perfil?: string` — el texto del perfil, para el chequeo de herramientas. Lo pone el core.

### 3.3 lib/automatizacion-chat.ts (nuevo, puro; lo crea la ola 1)
```ts
export type SobrePregunta = 'canal' | 'producto' | 'evento' | 'cron' | 'condicion';
export type OpcionPregunta = { valor: string; label: string; detalle?: string };
export type PreguntaMako = { id: string; sobre: SobrePregunta; texto: string; opciones: OpcionPregunta[]; otra: true };
/** valor null = «Elige tú»; texto = «Otra cosa». */
export type RespuestaMako = { preguntaId: string; sobre: SobrePregunta; valor: string | null; texto?: string };
export type MensajeChatMako = {
  id: string; de: 'yo' | 'mako'; texto: string; at: string; via: 'app' | 'whatsapp';
  pregunta?: PreguntaMako; respuesta?: RespuestaMako;
  cambios?: { cambiadas: number; quitadas: number; agregadas: number }; avisos?: string[];
};
export type ChatAutomatizacion = { v: 1; mensajes: MensajeChatMako[] };
export const TOPE_CHAT = 60;
export const TOPE_RONDAS = 2;
export const claveChat = (secuenciaId: number) => `automatizacion.chat:${secuenciaId}`;
export function sanearChat(raw: unknown): ChatAutomatizacion;          // nunca tira; descarta lo malformado
export function agregarMensajes(c: ChatAutomatizacion, nuevos: MensajeChatMako[]): ChatAutomatizacion; // dedupe por id, tope
export type EventoPreguntaIA = { t: 'pregunta'; pregunta: PreguntaMako; mensaje: MensajeChatMako };
export type ExtrasEdicionIA = {
  resumen: string; cambiadas: string[]; quitadas: string[];
  disparadores?: Disparador[] | null;   // CRON a guardar por action 'disparadores'; ausente = no lo toca
  pregunta?: PreguntaMako;               // p. ej. «¿Cambio qué la dispara?»
};
```
lib/automatizacion-chat-db.ts (server-only): `leerChat(ws, secuenciaId)` y `agregarAlChat(ws, secuenciaId, nuevos)`.
Las dos van con `runWithWorkspace(ws)` y `cambiarSettingSi`, con 3 vueltas.

### 3.4 La ruta `/api/chat-agent/secuencias/ia` (la hace la ola 2; la UI la consume)
- **POST** `{ pedido, modo: 'crear'|'editar', secuenciaId?, pasos?, respuestas?: RespuestaMako[], historial?: MensajeChatMako[] }`.
- **Eventos del stream:** los de hoy, más `EventoPreguntaIA`. Después de una pregunta el stream termina, y no se
  escribe nada salvo el chat, si la fila ya existe.
- **`listo` de editar** suma `ExtrasEdicionIA`.
- **Editar con la respuesta del CRON** (`respuestas` con `sobre:'cron'` y `valor`: el valor del desplegable) no llama
  al modelo. Devuelve `listo` con `pasos: base`, `cambiadas: []` y `disparadores: disparadorDeValorIA(valor)`. La
  opción «Déjalo así» lleva `valor: 'igual'` y no toca nada (`disparadores` ausente).
- **GET** `?secuenciaId=` devuelve `{ ok: true, mensajes: MensajeChatMako[] }`; si no es admin, 403.

### 3.5 lib/flujo-ia.ts en la ola 2 (lo hace el paquete de editar como PRIMER paso)
- `ResultadoEdicion` suma `cambiadas: string[]`, `quitadas: string[]`, `resumen: string`, `pregunta?: PreguntaMako` y
  `disparador?: string | null`. Este último es el VALOR del desplegable que pidió el modelo; ausente = no lo toca. La
  ruta lo convierte en `disparadores` con `disparadorDeValorIA`: flujo-ia.ts no importa lib/disparadores.ts.
- `ListoIA` suma `Partial<ExtrasEdicionIA>`, que es lo que viaja en el stream.
- Se exportan:
  - `erroresEdicion(base, r, ctx): string[]`, que reemplaza el `traducir` en línea de la ruta e incluye «no cambió
    nada»;
  - `resumenEdicion(r): string`, que arma «Cambié 3 · saqué 1 · agregué 2» por código.

### 3.6 Abrir el chat
- `AbrirSecuencia = { id: number; mako?: true }`.
- `?mako=1` junto a `?sec=`.
- SecuenciaPerfil recibe `makoAlAbrir?: boolean` y expone `abrirMako()` (el ✦, ola 1).

## 4. Paquetes y olas

Hay 7 paquetes en la ola 1, 4 en la ola 2 y 1 en la ola 3, que es la cosecha.

**Regla de dueño:**
- Cada paquete edita SÓLO sus archivos, incluidos los tests de su lista.
- Si falla un test que no es suyo, o hay un error de typecheck en un archivo ajeno, NO lo toca: lo anota en
  `scratchpad/wf-duodecima/cosecha/<id>.md` y lo resuelve la ola 3.
- Todo paquete deja ahí mismo lo aprendido: síntoma, causa, dónde vive, la regla, el diagnóstico equivocado si lo
  hubo, y lo que quedó sin hacer con su archivo.

| Ola | Paquete | Dueño de |
|---|---|---|
| 1 | `ia-crear` | lib/flujo-ia.ts, lib/flujo-ia-crear-core.ts, lib/prompt-registry.ts, tests crear-ia-*, flujo-ia, flujo-ia-arreglos, flujo-ia-crear, flujo-ia-ruta |
| 1 | `ia-contexto-chat` | lib/flujo-ia-crear.ts, lib/disparadores.ts, lib/condiciones-catalogos.ts (nuevo), lib/condiciones-catalogo-datos.ts (nuevo), app/api/chat-agent/condiciones/route.ts, app/automations/EditorCondicion.tsx, lib/automatizacion-chat.ts y -db.ts (nuevos), tests nuevos |
| 1 | `ig-condiciones` | lib/condiciones-catalogo.ts, lib/nutricion.ts, lib/zernio.ts, lib/canal-social.ts, lib/canal-zernio.ts, app/crm/origen-lead.ts, tests de condiciones |
| 1 | `ig-conectar-filtro` | lib/disparadores-canales.ts, EditorDisparadores.tsx, ConectarMedio.tsx, EditorMensajeSocial.tsx, app/api/zernio/route.ts, lib/chatbot-lista-filtro.ts, FiltroLista.tsx, sus tests |
| 1 | `ui-boton-qr` | SecuenciaPerfil.tsx, FlujoLienzo.tsx, lib/medios-automatizacion.ts, tests del ✦ y del QR |
| 1 | `ui-entrada-probar` | ChatAgentApp.tsx, SimuladorWhatsApp.tsx, PanelProbar.tsx, lib/chatbot-puerta.ts, RecorridoAutomations.tsx, recorrido-automations.ts, lib/tab-onboarding-catalogo.ts, sus tests |
| 1 | `fuera` | app/_components/Sidebar.tsx, lib/metodo-catalogo.ts, tests de la barra y de tutoriales |
| 2 | `ia-editar` | lib/flujo-ia.ts, lib/prompt-registry.ts, flujo-ia, flujo-ia-arreglos, tests nuevos de editar |
| 2 | `ia-preguntas-ruta` | lib/flujo-ia-preguntas.ts (nuevo), lib/flujo-ia-crear-core.ts, lib/flujo-ia-crear.ts, app/api/chat-agent/secuencias/ia/route.ts, lib/api-mako/areas/chatbot.run.ts y .def.ts, sus tests |
| 2 | `chat-ui` | ChatMako.tsx (nuevo), stream-ia.ts (nuevo), CrearConIA.tsx, SecuenciaPerfil.tsx, GaleriaPlantillas.tsx, ChatAgentApp.tsx, SimuladorWhatsApp.tsx, lib/flujo-ia-cliente.ts, crear-ia-tercera y tests de UI |
| 2 | `ig-publicar` | lib/disparadores-canales.ts, lib/medios-automatizacion.ts, app/api/whatsapp/secuencias/route.ts, lib/nutricion.ts (sólo el freno de activar) |
| 3 | `cosecha` | docs/hallazgos-*.md, docs/hallazgos.md, docs/relevo/chatbot.md, AGENTS.md, la bitácora y los tests reportados |

**Dependencias blandas dentro de una ola:**
- En la ola 1, `ia-crear` agrega PRIMERO los campos de §3.2. `ia-contexto-chat` los usa, y si todavía no están, sigue
  con lo demás y vuelve después.
- En la ola 2, `ia-editar` publica PRIMERO lo de §3.5. `ia-preguntas-ruta` y `chat-ui` codifican contra §3.3-§3.5.

## 5. Decisiones que Martín puede dar vuelta (la recomendada primero)

1. **El chat se guarda en `app_settings`, sin migración.** La alternativa es la mig 0258 (`nutricion_secuencias.chat_mako`).
2. **Sin el respaldo flash-lite.** Un 429 de Gemini con Groq caído termina en «no pude», en vez de un flujo peor (el
   respaldo fue el que escribió #243 y #245).
3. **La pregunta de canal sólo aparece con una señal social débil.** Si no, va por WhatsApp. La alternativa es
   preguntar siempre que haya 2 canales conectados (más fricción).
4. **Tope de 2 rondas de preguntas, con «Elige tú» siempre.**
5. **«Te sigue» se consulta en vivo.** Quien sólo comentó cae en la rama «si no», porque es una regla de Meta. La
   alternativa es guardarlo (mig 0258 en `ig_conversaciones`), y cubre a la misma gente.
6. **«Tiene Instagram» = tenemos su conversación por Instagram.** No es «tiene cuenta», y el rótulo se puede cambiar.
7. **«Instagram conectado» lo dice Zernio también en el CRON.** Los ws con página de Facebook pero sin Zernio (1, 9 y
   15) van a ver «Sin conectar», que es lo cierto: sin Zernio no llega ningún evento.
8. **Conectar Zernio desde el CRON.** Sin key propia, la cuenta del cliente se conecta en la de la PLATAFORMA, y Zernio
   cobra desde la 3.ª cuenta (lib/metodo-catalogo.ts:270).
9. **El ✦ queda con recuadro claro de 44 y el logo de 32.** Si se refería al ✦ del panel de una tarjeta, va a 26.
10. **El QR salta solo al crear una tarjeta sin medio conectado**, una vez por visita, con WhatsApp, Instagram y
    Messenger. La alternativa es sólo WhatsApp.
11. **El lienzo se ve también con 0 automatizaciones, y el recorrido se abre ahí.** Revierte una decisión de la décima.
12. **El aviso de Probar sale aunque se haya cerrado Probar o tocado ↻**, porque el mensaje salió.
13. **El CRON que propone una edición se guarda sólo al tocar la opción** y no va al borrador.
14. **Una condición o una herramienta que no existe se saca con aviso, o se reintenta.** Nunca «la más parecida».
15. **Un flujo social va sin «Si responde» ni AI Step** hasta que el AI Step conteste por Instagram.
16. **Tutoriales de 3 a 5 pasos**, sin «Para qué sirve» en el de servicio, y se borra la ayuda de `META_ACCESS_TOKEN`.
    Antes de pushear, Martín mira Meta, Resend, Cal.com y Fathom.
17. **Renombrar con MaKo NO entra.**

## 6. Despliegue y datos

- **Sin migraciones y sin datos que aplicar.** Lo de ws10 es una prueba del cliente:
  - #243 está archivada y #244 y #245 están pausadas, con 0 inscripciones;
  - no se tocan;
  - después del deploy se pueden arreglar pidiéndoselo a MaKo, con la edición nueva.
- Las dos olas van en UN deploy: la ola 2 consume los contratos de la 1.
- **Antes del push:** typecheck y todos los tests tocados (ola 3).
- **Medir antes:** si Vercel prod tiene `ZERNIO_API_KEY` (`vercel env ls`). Si no la tiene, todos los negocios sin key
  propia ven «Falta conectar Zernio», y el campo de la key ahí mismo (§2.11) pasa a ser el camino normal.
- **Prompts:** hay 0 overrides de `mako.prompt-overrides`. Los dos templates aceptan el formato viejo y el nuevo.

## 7. Riesgos

- **El presupuesto de Groq:** ≈2.167 tokens para el user (system de crear ≈1.533, salida 3.300, techo 7.000). Todo lo
  que se suma al system le resta al user. Se mide con el test del presupuesto. Si Groq queda afuera, el pedido va a
  Gemini, que hoy da 429.
- **«Te sigue» en vivo:** suma latencia por lead dentro del motor, y Zernio no publica límites. Un 401 o 402 de la
  cuenta del negocio deja «no sé» a todos.
- **Las palabras de canal dan falsos positivos** («la historia de mi negocio»). Por eso decide la palabra fuerte, y la
  débil sólo hace preguntar.
- **Quitar con edición una tarjeta con leads parados** cambia lo que les pasa. Va por el borrador y Publicar, como un
  cambio a mano.
- **Archivos CRLF:** se editan con scripts de node escritos con Write. Un heredoc de Bash se come las barras de las
  regex.
