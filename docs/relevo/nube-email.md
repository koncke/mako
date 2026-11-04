# Relevo — la campaña de email de Mauricio, entera por la API (nube, 4/11/2026)

> Escrito por la sesión de la nube que hizo el trabajo (`cli_fe44de53-c921-5546-aa4a-0d433bbd0829`). Es de primera mano sobre
> lo que se escribió y se probó acá; lo de producción NO se midió desde la nube (no tiene acceso): está marcado como tal.

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

1. **La migración `0380_email_rebotes.sql`** (sólo agrega `rebotado_at` y `queja_at` a `nutricion_envios` y
   `email_broadcast_envios`). Sin ella el webhook no anota los rebotes y **el freno no tiene qué contar**: no frena (lo dice
   `ver_limites_envio`: «falta la migración 0380»). El número lo elegí yo (main terminaba en 0373; 0368-0370 y 0372 no están en
   ninguna rama ni etiqueta): **confirmarlo con el Cerebro antes de aplicarla**, por si estaba reservado.
2. **La clave que administra dominios: `RESEND_ADMIN_API_KEY` en Vercel (Production y Preview), y el plan de Resend.** Lo
   hace Martín. Desde `6b8aae96b` (`punta/email-clave-admin`) la key que MANDA (la fila del ws 1, de sólo envío según midió
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

## Lo que le toca a Mauricio, paso a paso

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

- **Commit `6b8aae96b`**, en `punta/email-clave-admin`. Lo de dominios se mudó de `lib/resend.ts` a
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
