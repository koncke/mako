# Encargo: Chat de MaKo — 18 pendientes (7/11/2026)

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

### 1. Falta la plantilla «Rechazaron un Pago» en la galeria de Automations

_plata · chico_

El motor ya tiene el CRON («Pagos: Se rechaza un pago», `alCron(c,'rechazado')`) y el evento del lead; falta la plantilla con objetivo `cobrar` y una tarjeta MaKo al equipo, y sumarla a la lista escrita a mano `LAS_13`.

**Dónde:** `docs/relevo/pendientes-barrido.md:134-136 · lib/cobros.ts · tests/plantillas-automatizaciones.test.ts`

### 2. El store de mensajes del ws9 es el default de todos los clientes

_feature · chico_

Que leerPar no caiga al par del ws9 para un negocio sin el suyo. Hecho = un negocio sin plantillas propias no lee las de MaKo.

**Dónde:** `C:/dev/wt-puntas/lib/plantillas.ts (leerPar) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:4037`

### 3. El reporte semanal no sale por WhatsApp desde que se borró Chatwoot

_feature · chico_

Volver a enchufar despacharReporte al canal vigente. Hecho = el reporte semanal llega al grupo del negocio.

**Dónde:** `C:/dev/wt-puntas/lib/notify.ts (despacharReporte) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:4037`

### 4. Un email del lead no pausa la automatización que le está escribiendo

_feature · chico_

Una línea con origen: 'email' en recibirEmailEntrante que llame a pausarPorRespuesta. Hecho = contestar por email pausa la secuencia igual que contestar por WhatsApp.

**Dónde:** `C:/dev/wt-puntas/lib/email-entrante.ts (recibirEmailEntrante) · lib/nutricion.ts (pausarPorRespuesta) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:3272`

### 5. Crear la fila de «Tareas de Reuniones al Plan» después del deploy

_feature · chico_

Correr `scripts/mudanza-avisos-plataforma.mts --eventos=reunion_tareas_al_plan --aplicar` DESPUÉS del deploy que trae la tanda. Nace pausada, con la exclusión del negocio 13. Prenderla es decisión de SuperAdmin, mirando el texto. El Cerebro anotó «No corrí ninguno».

**Dónde:** `C:/dev/wt-puntas/scripts/mudanza-avisos-plataforma.mts ; lib/plantillas-automatizaciones.ts ; docs/relevo/nube-nada-por-detras.md:25-29 ; docs/relevo/cerebro.md:14`

### 6. «Ignorar» del Ops Center nunca se vio en el teléfono de Martín

_feature · chico_

La 0394 ya está aplicada, así que las decisiones de la Ticketera también se ignoran. Falta mirarlo en el Ops Center de verdad, en su teléfono. Y si Martín quiere, «Ignorar todas las viejas» de un toque: no se hizo porque no lo pidió.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-ops-ignorar.md:51-56 ; app/admin/operaciones/`

### 7. Black November de Leila: dos cosas sin verificar antes del lanzamiento

_feature · chico_

(1) Si el número de Leila ya llega a sus 40 envíos por día: si no venía llegando a su tope, el día del lanzamiento arranca en 20 y llega a 40 al día siguiente. Para lanzar con 40 desde el primer día, `cambiar_limites_envio` con `waArranqueDia: 40`. (2) Una landing publicada en producción con los tres bloques (cuenta regresiva, pop de prueba social, barra de escasez) en un teléfono de verdad; acá sólo se miró en Chromium a 1280 y 390.

**Dónde:** `C:/dev/wt-puntas/docs/relevo/nube-black-november.md:96-104 ; lib/limites-envio ; lib/editor-landing/`

### 8. Mauricio (ws1) no tiene un solo mensaje en su grupo desde el 4/10

_feature · chico_

Es el cliente mas activo y puede ser que no escriba o que la entrada este rota (los ws 9, 18 y 22 tampoco tienen filas desde el 22/10). Si esta rota, se perdieron todos sus pedidos. Hecho = saber cual de las dos es.

**Dónde:** `docs/relevo/pedidos-perdidos-2810.md:40,218,282 (mako_doer_buffer / mako_doer_conv)`

### 9. El aviso por la linea secundaria cuando se cae la principal

_feature · chico_

Hoy el aviso sale por mail y nunca se probo con una caida real. El webhook ya guarda cual numero se cayo (tanda 5 del barrido).

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:111-113 · docs/hallazgos-comunicacion.md:368 · lib/lineas-vigilante.ts`

### 10. TikTok en Automations: solo esta la fase 0

_feature · mediano_

Falta el disparador (el boton de TikTok al lado del de IG en el CRON). El disenio limita a contestar, con tope de 10 mensajes en 48 h.

**Dónde:** `docs/relevo/pendientes-pc/pedidos-otras-cuentas-6-11.md:185-186 · lib/nutricion.ts:155 · docs/diseno-tiktok-linkedin.md`

### 11. El ramp-up gradual no se aplica al tope diario de WhatsApp de las secuencias

_feature · mediano_

`topeConRampa` solo rampa el email; el `wa.dia` de las secuencias es fijo. Aplicar `arranqueDia` y `arranqueSube` tambien a `limites.wa`. Es la leccion del bloqueo de 24 h del numero de Mauricio.

**Dónde:** `docs/relevo/pendientes-pc/auditoria-pedidos-5-11.md:40 (5.8) · lib/goteo-db.ts:42 · lib/limites-envio.ts`

### 12. Cinco cosas del anti-ban de WhatsApp sin probar con la línea de verdad

_feature · mediano_

(1) Que el mensaje del `wa.me` llegue al webhook por la voz `mako_ws9` con el número de quien lo manda — si llega como `@lid` sin `remoteJidAlt` ni `senderPn`, no se confirma. (2) Que Martín vea esos mensajes en su WhatsApp personal y le parezca bien. (3) Qué devuelve Evolution 2.3.7 para un 463 y un «rate-overlimit» al MANDAR. (4) Que el mail del freno llegue. (5) El link `wa.me` en iPhone y Android con el texto con tilde.

**Dónde:** `C:/dev/wt-puntas/lib/linea-freno.ts ; lib/mako-salida-reglas.ts ; docs/relevo/nube-whatsapp.md:32-41`

### 13. El diseño de los grupos de la app nunca se vio con sesión

_feature · grande_

`punta/grupos-diseno` (quiénes están debajo del nombre, Invitar y Participantes a la derecha, el modal sin saltos, la cita de MaKo y el 👍 sobre el borde) se miró con capturas en Chromium, no en la app con sesión. Y queda la lista de hallazgos-ops-center: la sesión real de un invitado (y si Joan y Juanfran comparten fila en `usuarios`), el push en un Android, el `?ws=` de WsFetch contra las rutas del grupo, el autollamado que se aborta a los 5 s en arranque en frío, el id de WhatsApp atado por posición, y reacciones/fijar/eliminar.

**Dónde:** `C:/dev/wt-puntas/docs/hallazgos-ops-center.md (las dos listas «Lo que quedó sin hacer», 3 y 4/11) ; docs/relevo/nube-grupos.md:85-99`

### 14. Nada del email salió nunca a un buzón real

_feature · mediano_

Resend fue siempre de mentira. Sin medir: que Resend prenda de verdad el seguimiento con el PATCH y que los emails lleguen con el píxel y los links envueltos; el valor real de `bounce.type` en un rebote (el código acepta Permanent, hard y hardbounce; si Resend manda otra cosa, el rebote no cuenta para el freno); la rampa con días reales en la zona del negocio; la verificación DNS de un dominio de verdad; y la forma exacta del error del tope de dominios (se reconoce por el texto, `esTopeDeDominios`).

**Dónde:** `C:/dev/wt-puntas/lib/resend-dominios.ts ; tests/resend-clave-admin.test.ts ; docs/relevo/nube-email.md:172-199`

### 15. Una respuesta por Instagram no pausa la salida, y el motor contesta siempre por WhatsApp

_feature · mediano_

Que pausarPorRespuesta conteste por el canal donde le escribieron. Hecho = responder por Instagram pausa y la respuesta sale por Instagram.

**Dónde:** `C:/dev/wt-puntas/lib/nutricion.ts (pausarPorRespuesta) · lib/zernio-entrante.ts · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:2578`

### 16. El paso «esperar» de los avisos sigue sin drenador

_feature · mediano_

El paso existe, la UI lo ofrece y corta la ejecución: nadie lo reanuda. Hecho = un aviso con «esperar» sale al vencer la espera.

**Dónde:** `C:/dev/wt-puntas/lib/flujo-aviso.ts · app/agencia/FlujoAviso.tsx · pendiente en C:/dev/wt-puntas/docs/hallazgos-comunicacion.md:7097`

### 17. El clon de configuración se lleva la línea POR MENSAJE y no copia los disparadores

_feature · mediano_

Sumar `linea` a la lista que se vacía al clonar (con su aviso) y copiar `disparadores` de nutricion_secuencias. Hoy en el destino elegirLinea la rechaza y ese mensaje no sale, sin caer a la de default; y una automatización con varios CRON llega con uno. Hecho = clonar una configuración deja la automatización mandando por la línea del destino y con todos sus CRON.

**Dónde:** `C:/dev/wt-puntas/lib/clonar-config.ts (secuenciaParaElDestino, TABLAS) · pendiente en C:/dev/wt-puntas/docs/hallazgos-chatbot.md:2783 y :3272`

### 18. ~~Cinco prompts con la identidad de Mauricio hardcodeada para todos los workspaces~~

_feature_


**Dónde:** `lib/closing.ts:141 (RE_SERVICIO_EXPLICITO) · cosechado en docs/hallazgos-closing.md`
