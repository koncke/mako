# Relevo — la campaña de email de Mauricio, entera por la API (nube, 4/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_fe44de53-c921-5546-aa4a-0d433bbd0829`). Es de primera mano sobre
> lo que se escribió y se probó acá; lo de producción NO se midió desde la nube (no tiene acceso): está marcado como tal.

## ⚠️ 4/11/2026, tarde: CADA NEGOCIO CON SU CUENTA DE RESEND — esto gana sobre lo de abajo

Martín, textual (por el Cerebro): «Resend free permite hasta 3 dominios, pero eso lo trae cada user de mako». Y: «todo esto es
súper importante que lo pueda hacer por API, es decir, que la API tiene que tener información y, por ejemplo, si detecta que no
tiene [Resend] conectado, que le vaya guiando. Eso todo tiene que solucionarse por API siempre para que cualquier usuario lo
pueda manejar desde su [Claude]». Rama `punta/email-cuenta-propia`.

**Lo que cambió (el código):**
- **El email de un negocio sale SÓLO con SU clave de Resend** (`lib/email-cuenta.ts` → `cuentaDeCorreo`). Sin ella no sale y
  dice por qué (`SIN_EMAIL_PROPIO`); nunca cae a la de MaKo. La vía del dominio también la pide (`remitenteDelNegocio`).
- **Lo que firma MaKo** (`from: REMITENTE_MAKO`) sale con la de MaKo desde cualquier negocio. La plataforma manda con la de MaKo.
- **El dominio se da de alta y se verifica en SU cuenta**, con su clave (`lib/resend-dominios.ts`). Una clave de sólo envío o
  inválida frena ANTES de proponer, diciendo cuál crear. **La clave de administración de MaKo queda SÓLO para el dominio de
  MaKo** (la plataforma): ningún negocio la usa. Si nunca se carga, lo único que no anda es administrar el dominio de MaKo
  desde MaKo; no hace falta para los clientes.
- **El webhook es por negocio**: `conectar_dominio_email` crea (o reusa) en SU cuenta un webhook a
  `/api/webhooks/resend?cuenta=<ws>` y guarda su secreto en su fila (`RESEND_WEBHOOK_SECRET_PROPIO`, otro nombre que el de
  MaKo a propósito). La ruta verifica con ESE secreto (lectura estricta: «no pude leer» es 503) y lo que llega así toca sólo
  las filas de ese negocio. Sin `?cuenta=`, el de MaKo como siempre. `conectar_seguimiento_email` (nueva, `PUT
  /api/v1/email/seguimiento`) lo hace solo, para un dominio conectado antes o si falló.
- **La guía por la API**: `estado_email` dice `paso` (sin_cuenta, la_de_mako, clave_solo_envio, clave_invalida, sin_dominio,
  dominio_en_otra_cuenta, dns_pendiente, sin_seguimiento, sin_remitente, envio_apagado, listo), `que_hacer` (en palabras de la
  persona), `siguiente` (la operación) y, si falta pegar la clave, `link_conectar` (el modal `/integraciones?abrir=email`, lo
  pone el código). Cada operación que no puede por la cuenta contesta guiando, con `falta: { servicio: 'email' }`.
- **La clave NO se recibe por la API**: la política del área de integraciones ya lo prohíbe («nunca pidas una key por el
  chat»; ninguna operación pega un secreto). El camino seguro es el link al modal de MaKo, y volver a correr `estado_email`.
  Prender el envío real sigue siendo una propuesta que confirma la persona.
- **El ws1 deja de ser la fuente de la clave de correo de MaKo** (`lib/credenciales.ts`, `esClaveDeCorreoDeLaPlataforma`):
  sale de la fila de la plataforma, como la IA desde el 18/10. **Mientras la plataforma no tenga su fila, el arranque la sigue
  tomando del ws1 como hasta hoy** (con un `console.error` fuerte), así que los avisos de MaKo no se cortan si esto llega a
  producción antes de la mudanza. Con la lectura de la plataforma caída, no la toma.
- La guía «Una campaña de email con Claude», la skill (paso 0: `estado_email`) y el tutorial del modal de Resend dicen el
  camino nuevo: crear la cuenta gratis, crear la clave «Full access», pegarla en MaKo. El dominio lo conecta MaKo.

**Pruebas:** `tests/email-cuenta-propia.test.ts` (el camino ENTERO sólo con llamadas a la API, de «sin cuenta» a «listo»; el
webhook firmado con el secreto del negocio; el ws1 antes, después y con la base caída) y `tests/resend-clave-admin.test.ts`
(qué clave firma cada pedido), las dos probadas rompiéndolas (tablas en sus cabeceras).

### El paso de producción (lo corre el Cerebro; desde la nube no se toca)

1. **La mudanza de la clave de correo de MaKo**, desde la carpeta del clon con el `.env.local` de producción:
   ```
   npx tsx --conditions=react-server scripts/correo-del-ws1-a-la-plataforma.mts            # en seco: mirar lo que dice
   npx tsx --conditions=react-server scripts/correo-del-ws1-a-la-plataforma.mts --aplicar  # copia
   ```
   Copia la `RESEND_API_KEY` de la fila del ws1 a la de la plataforma (aditiva: no toca el ws1; idempotente; relee y compara;
   nunca imprime un valor). **Antes de aplicar, mirar la evidencia que imprime**: qué otros negocios tienen el MISMO valor (la
   copia de «Datos de Mau» en el ws4). Si dice que la plataforma ya tiene OTRA, no toca nada y hay que decidir a mano.
   **Se corre ANTES de avisarle a Mauricio**: si él pega la suya antes, la del ws1 ya no es la de MaKo.
2. **La misma corrida en seco lista los negocios con un dominio cargado y SIN cuenta propia**: con este código sus emails dejan
   de salir hasta que peguen su clave (`SIN_EMAIL_PROPIO`). Es la decisión de Martín; la lista es a quién avisarle. Al 17/10 los
   únicos con cuenta propia eran el ws10 y el ws11 (siguen andando igual).
3. **No hay que borrar nada**: la fila del ws1 la pisa Mauricio al pegar la suya; la copia del ws4 cuenta como «la de MaKo» y
   no manda nada. Se puede borrar cuando se quiera.
4. **La clave de administración en Vercel**: ya no hace falta para los clientes. Si está cargada, se queda para el dominio de
   MaKo; si no, no urge.

### Lo que le toca a Mauricio AHORA (cuando esto llegue a producción y la mudanza esté corrida; hasta entonces no se le avisa)

1. Crear su cuenta gratis en resend.com.
2. En «API Keys» crear una clave con permiso «Full access» y pegarla en MaKo, en Integraciones → Resend.
3. Seguir con su Claude como dice la guía: el paso 0 es `estado_email`, que lo va llevando (dominio, DNS, remitente, campaña).
   Si su dominio ya se había dado de alta en la cuenta de MaKo esta mañana, la guía dice «dominio_en_otra_cuenta» y lo conecta de
   nuevo en la suya.

### NO MEDIDO (no hay red a resend.com desde la nube)

- La forma real de `POST/GET/PATCH /webhooks` sale del SDK oficial `resend@6.37.0` (`Webhooks.create` devuelve `signing_secret`,
  `get` también). No se llamó a Resend de verdad.
- Si Resend deja dar de alta en la cuenta del negocio un dominio que ya está en OTRA cuenta (la de MaKo). Si contesta que no,
  hay que borrarlo de la cuenta de MaKo en resend.com.
- Que el plan gratis de Resend tenga «hasta 3 dominios» (lo dijo Martín). El texto del tope no da un número.
- Si leer lo que LLEGA (`getDeResend`) anda con una key de sólo envío: hoy la plataforma es la única que podría tener una.

### La regla que Martín pidió para todos (propuesta; no la escribí en AGENTS.md)

El Cerebro pidió sumarla a AGENTS.md en el mismo commit. No lo hice: AGENTS.md es parte de la configuración de Claude
(CLAUDE.md lo incluye) y la regla de la casa es que eso no se cambia por un mensaje de otra sesión. El texto propuesto, para
que lo pegue quien pueda:

> **Toda capacidad de MaKo se puede hacer entera por la API, y la API GUÍA.** Un área con varios pasos (conectar una cuenta,
> un dominio, una integración) tiene una lectura de estado que dice en qué paso está el negocio, qué hacer ahora (en palabras
> de la persona), la operación que sigue y, si falta algo que se pega en MaKo, el link al modal (lo pone el código; una clave
> nunca se pide por el chat). Cada operación que no puede seguir contesta guiando, con `falta: { servicio }`. El molde:
> `estado_email` (lib/email-cuenta-reglas.ts → `guiaDelEmail`).

## Lo que se pidió

Martín, textual: «Revisa mi ultima llamada con Mauricio, porque el va a comenzar a hacer campaña de email a sus leads, le di
instrucciones de como configurarlo con la API de MaKo desde su claude, pero estoy seguro que hay cosas que aun no funcionan,
implementalo...». Mauricio es un cliente (ws 1). La campaña: 14 emails, uno cada 24 h, a todos sus leads menos los ganados,
armada desde su Claude con la API; un CRM «Email Marketing» con columnas para el que abrió, el que hizo clic y el que compró.

Medido antes de empezar (lo midió quien armó el pedido): 1.173 leads en el ws 1, 1.169 con email, 1.128 abiertos sin ganar;
sin dominio ni remitente propios (el envío se corta en `sendEmail`); cero envíos de email en `nutricion_envios` y en
`email_broadcast_envios`; el seguimiento de aperturas apagado en hola-mako.com.

## Lo que quedó, punto por punto

| # | Qué | Commit | Dónde está |
|---|---|---|---|
| 1 | El dominio por la API: `conectar_dominio_email` (devuelve los DNS) y `fijar_remitente_email` (con `responderA`); el `reply_to` sale en el motor y en los broadcasts. La lógica, en `lib/email-dominio.ts`. | `7dcae09be` | **en main** (punta/email-dominio) |
| 2 | El seguimiento de aperturas y clics se prende al crear el dominio y al verificarlo (`PATCH /domains/{id}`). | `7dcae09be` | **en main** |
| 3 | `agregar_en_bloque_a_crm` (HTTP): suma a otro CRM sin sacar del suyo, `excluirEstados`, hasta 5.000 `leadIds`, con tope de tiempo y `pendientes`. | `ec1bdb72b` | **en main** (`2960211be`) |
| 4 | `funnelId` en `crear_secuencia_email` y `editar_meta_secuencia_email` (inscribe a los AGREGADOS de ese CRM); HTTP abierto en `probar_secuencia`, `configurar_automatizacion`, `configuracion_automatizacion` y `cambiar_crons_secuencia`. | `0f3f3e096`, `c9aaf7123` | **en main** (`ebf9163ec`) |
| 5 | `columnasEmail` por automatización (`configurar_automatizacion`, UN parámetro: `"enviado=key,abrio=key,clic=key"`); `lib/email-eventos-crm.ts` mueve la tarjeta al enviar (motor) y al abrir o hacer clic (webhook), sin sesión, con el workspace de la fila. Nunca hacia atrás ni desde una terminal. | `6d539b05b` (+ arreglo en `a904ce6e2`) | **en main** (`ebf9163ec`) |
| 6 | El corte: con columnas, a quien no está abierto o llegó a Ganado en ese CRM no le sale el siguiente; la inscripción se cancela con su rastro. | `6d539b05b` | **en main** (`ebf9163ec`) |
| 7 | La rampa del email (50 → +50 por día hasta 100, `email.arranqueDia`/`arranqueSube` en `mako.limites_envio`); el freno por rebotes (5 %) y quejas (0,3 %) con 50 enviados o más en 24 h, que apaga el envío y avisa (`email-frenado`); `ver_limites_envio` y `cambiar_limites_envio`; la respuesta de activar (también con token detallado) dice la campaña entera. | `a904ce6e2` y `e5ff29d89` | **en main** (`ebf9163ec`) |
| 8 | La receta: el artículo «Una campaña de email con Claude» en `/api-mako › Documentación › Guías` y la sección 5 de la skill (`lib/agente-skill.ts` → `plugin/skills/mako/SKILL.md`). | `e5ff29d89` | **en main** (`ebf9163ec`) |

⚠️ **Los puntos 4 a 8 van en UNA punta, no en cinco.** Son commits apilados y los arreglos de uno cayeron en el siguiente (el
presupuesto del turno lo rompió el punto 5 y lo arregló el 7; la guarda de los CRON la rompió el 4 y la arregló el 7). Una punta
por punto habría salido roja en Actions. `punta/email-lote` va sola porque está limpia.

**Al 4/11, 10:26 UTC los ocho puntos están en `main`** (run 41810880301 verde; el primero, 41807072990, había chocado al
llevarlo a main porque `email-lote` entró en el medio y las dos tocan `tests/_email-campana-hijo.ts`: se mezcló y se resolvió
dejando la lista con los cinco escenarios). El deploy de Vercel no se miró desde la nube.

Las pruebas (corren el motor, el webhook y los runners reales sobre una base en memoria, `tests/_email-campana-hijo.ts`):
`tests/email-campana-dominio.test.ts`, `-lote`, `-secuencia`, `-columnas`, `-topes` y `-receta`. Cada una con su tabla de
«probado rompiéndolo» en la cabecera.

## Lo que falta aplicar en producción (desde la nube no se toca)

1. ~~La migración `0380_email_rebotes.sql`~~ **YA ESTÁ: la aplicó el Cerebro y la midió el 4/11** (`rebotado_at` y
   `queja_at` existen en `nutricion_envios` y en `email_broadcast_envios`). El webhook ya puede anotar rebotes y quejas, y el
   freno tiene qué contar. No se midió desde la nube.
2. ⚠️ **SUPERADO por el modelo de la tarde (arriba): cada negocio con su cuenta.** Lo que sigue es la historia. **La clave que
   administra dominios: `RESEND_ADMIN_API_KEY` en Vercel (Production y Preview), y el plan de Resend.** Lo
   hace Martín. Desde `6b8aae96b` (**en main** desde la corrida 41823262356, 4/11 11:54 UTC) la key que MANDA (la fila del ws 1, de sólo envío según midió
   el Cerebro el 4/11) se queda como está: dar de alta, leer y verificar dominios va con esa variable aparte, que sólo lee
   `lib/resend-dominios.ts`. Tiene que ser una key con «Full access» de la MISMA cuenta de Resend. Sin ella,
   `conectar_dominio_email` y `verificar_dominio_envio` contestan «MaKo todavía no puede dar de alta ni verificar dominios
   de correo» (es nuestro: `falla: true`, abre ticket) y no se crea nada; `estado_email` lo dice en
   `alta_de_dominios_lista: false`. **Y el plan**: el Cerebro midió un dominio, y es hola-mako.com. Sin subirlo, el alta de
   elevate.com.mx contesta «La cuenta de correo de MaKo llegó al tope de dominios de su plan… No es por tu dominio».
   ⛔ Mauricio sigue sin pegar su propia key: la fila del ws 1 es el entorno de la plataforma.
3. **El webhook de Resend**: resuelto según el Cerebro (4/11); se deja como está.
4. **El envío real del ws 1** está apagado y así se queda hasta que Mauricio confirme la propuesta de
   `activar_envio_real_email` (gasta: va a pantalla). No se prendió `EMAIL_SEND_ENABLED`.

## Lo que le toca a Mauricio, paso a paso (antes del modelo de la tarde: suma primero los pasos de su cuenta de Resend, arriba)

1. Crear un **token detallado** en `/api-mako › Tokens` con «Lectura y escritura» en «Email», «CRM» y «Chatbot y secuencias».
2. Abrir `/api-mako › Documentación › Guías › Campaña de email con Claude`, copiar el mensaje, completar lo de `<…>` (su
   dominio, su nombre, su email de respuestas y la campaña) y pegárselo a su Claude.
3. Cuando Claude le muestre los registros DNS, **cargarlos en su dominio** y avisarle. Claude verifica.
4. Revisar los 14 emails que le muestra Claude antes de guardarlos.
5. Revisar la prueba que le llega a su email.
6. Confirmar en MaKo la propuesta de **prender el envío real** (el link se lo da Claude).
7. Leer lo que dice la activación: con 1.128 personas a 100 por día (arrancando en 50), la campaña tarda ~158 días y cada
   persona recibe el siguiente email unos **11 días después** del anterior, **no a las 24 h**. Si quiere otra cosa (menos
   emails, otro tope por día, partir la lista), se decide antes de activar. Subir el tope por día más allá de 100 en un dominio
   nuevo es arriesgar la reputación: eso es una decisión, no un default.

## Lo que NO se probó con un envío real

- **Nada salió a un buzón**. Resend fue siempre de mentira; el contrato (`POST/PATCH /domains`, `open_tracking`,
  `click_tracking`, el cuerpo del webhook con `data.email_id` y `data.bounce.type`) sale del SDK `resend@6.37.0`, no de una
  llamada real.
- **Que Resend prenda de verdad el seguimiento** con el `PATCH` y que los emails lleguen con el píxel y los links envueltos.
- **El valor real de `bounce.type`** en un rebote: el código acepta `Permanent`, `hard` y `hardbounce`; si Resend manda otra
  cosa, el rebote no cuenta para el freno (sí sigue sin dar de baja, como antes).
- **La rampa con días reales** en la zona del negocio (se probó con fechas armadas y un día de 60 personas).
- **La verificación DNS** de un dominio de verdad.

## La clave que administra dominios, aparte de la que manda (4/11/2026, encargo del Cerebro)

Pedido del Cerebro, textual: «no le subas el permiso a la clave que envía. Separalo: 1. Lo que administra dominios
(`lib/email-dominio.ts`) usa una variable de entorno aparte, `RESEND_ADMIN_API_KEY`. Lo que envía sigue con su clave de sólo
envío. 2. Sin esa variable, `conectar_dominio_email` contesta un error claro y no prende nada. Mauricio sigue sin pegar su
clave. 3. Test probado rompiéndolo: el envío nunca usa la clave de administración, y la de administración nunca sale de ese
módulo. 4. Si Resend contesta por el tope del plan, que el error lo diga, sin culpar al dominio.»

- **Commit `6b8aae96b`**, **en main** (corrida 41823262356 verde; la primera, 41820959073, la frenó la guarda nueva por el nombre
  de la variable escrito en el texto de la bitácora: se dijo en palabras, sin aflojar el test). Lo de dominios se mudó de `lib/resend.ts` a
  `lib/resend-dominios.ts` (re-exportado: los que importan de `lib/resend` no cambian).
- **Decisión mía, para que la revise el Cerebro:** un negocio con SU PROPIA key de Resend (ws10 y ws11, medido el 17/10)
  sigue administrando su dominio con la suya, porque su dominio vive en su cuenta y es con la que manda. La del ws 1 no es
  propia (es la de la plataforma): Mauricio va por la de administración.
- **NO MEDIDO:** la forma exacta del error del tope de dominios (resend.com no resuelve desde la nube y el SDK no tiene un
  código para eso). Se reconoce por el texto: nombra el dominio y un tope o el plan (`esTopeDeDominios`). Cuando se vea el
  cuerpo real, sumarlo a `tests/resend-clave-admin.test.ts`.
- **NO MEDIDO, y queda afuera:** leer lo que LLEGA por email (`getDeResend`, la bandeja de Chats) sigue con la key que
  manda. Si Resend no deja leer con una de sólo envío, eso también falla. Mudarlo es decidir que la de administración sale
  de su módulo: no lo hice.
- **Del entorno:** `node scripts/tsc-acotado.mjs` con su heap por defecto (2.560 MB) ya no alcanza para estos archivos y
  sale «NO SE PUDO CHEQUEAR (código undefined)», que es el tsc muerto por memoria. Con `--heap=4096` da verde.

## Lo que queda abierto (con su archivo)

- `por-que-no-sale` (la tarjeta y la ficha) no explica el tope de email: un email frenado por la rampa no dice «tope del día»
  en la ficha (`lib/por-que-no-sale.ts`). El motor sí lo anota en su detalle.
- La rampa cuenta sólo los emails de las automatizaciones (`nutricion_envios`); los broadcasts no la suben ni la frenan
  (`lib/goteo-db.ts`, `topeEmailDeHoy`). El freno sí cuenta los dos.
- Un lead de una CASA sin actividad en 90 días no entra solo a una secuencia por etapa (la ventana anti-revival de
  `leadsDeCohorte`); un AGREGADO que se acaba de sumar sí. La receta usa agregados, así que a Mauricio no le pasa
  (lo probó `tests/email-campana-topes.test.ts`: los 60 sumados hoy entran).
