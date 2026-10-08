# Verificación de la app de Google de MaKo

App OAuth del proyecto `mako-500317` (cuenta martinkoncke@gmail.com), cliente «MaKo Web».
Publicada («In production») el 07/10/2026 y **sin verificar**: quien conecta su agenda ve
«Google no verificó esta app» y la app tiene un tope de 100 usuarios en toda su vida.

**Estado al 07/10/2026: no se envió nada a Google; el Uso Limitado quedó resuelto.** Google tarda 3 a 5 días hábiles una vez
enviada ([requisitos oficiales](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)).

## Lo que pide Google, y cómo estamos

| # | Requisito | Estado |
|---|---|---|
| 1 | Branding: nombre, inicio, privacidad, términos y correo de soporte | ✅ MaKo · `hola-mako.com` · `/privacidad` · `/terminos` |
| 2 | Cada dominio autorizado, verificado en Search Console por un dueño del proyecto | ❌ `hola-mako.com` no está verificado en martinkoncke@. Y sobran dos dominios muertos |
| 3 | Los permisos declarados en *Data Access*, con su justificación | ❌ No hay ninguno declarado |
| 4 | Un video en YouTube, oculto y en inglés | ❌ Hay que grabarlo (guion abajo) |
| 5 | Una política de privacidad que coincida con lo que hace la app | ✅ Desde el 07/10 (decisión de Martín: los datos de Google van sólo a una IA que no entrena) |

⚠️ **El Verification Center dice «Verification is not required».** Lo dice porque *Data
Access* tiene cero permisos declarados, no porque la app no los use: el código pide
`calendar.events` y `calendar.readonly` al conectar la agenda, y por eso el cliente ve la
pantalla de app no verificada. Es un verde engañoso.

### 2 · Dominios

- **`hola-mako.com`**: agregar en Search Console una propiedad de tipo *Dominio*, poner el
  registro TXT que da Google en Porkbun y verificar. La API de Porkbun ya funciona
  (`PORKBUN_API_KEY` en `.env.local`).
- **Sacar `makodigital.app` y `dashboard-marketing-six.vercel.app`** de los dominios
  autorizados, con sus 3 redirect URIs. Los dos contestan 410 «Nos mudamos» en
  `/api/auth/...` (`proxy.ts`, `EXENTAS_DE_HOST` no lo incluye), así que ningún login pasa
  por ahí hoy. Si se quedan, también habría que verificarlos.

### 5 · Privacidad: el Uso Limitado

La política promete que los datos del calendario **no se usan para entrenar modelos de IA**,
y hasta el 07/10 no era cierto para los clientes con la key gratis de Gemini (Google
entrena con el plan gratis). Martín decidió:

- **Un pedido a una IA que lleve datos de Google Calendar lo atiende sólo un proveedor que
  no entrena** (Groq, OpenAI, Anthropic). Lo aplica `lib/datos-google-ia.ts` en el loop de
  herramientas, y lo fija `tests/datos-google-ia.test.ts`.
- **En el reparto de tareas de una reunión, los invitados del calendario ya no van al
  prompt**: el código les pone el email por nombre (`resolverDueño`).

El detalle, con lo que quedó sin tratar, en `docs/hallazgos-ia.md` → «La promesa de
"Uso Limitado"…».

## Para pegar en *Data Access* (en inglés: lo lee un revisor de Google)

**Non-sensitive:** `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`, para
iniciar sesión.

**`https://www.googleapis.com/auth/calendar.events`**

> MaKo is a CRM for small businesses (real estate agencies, coaches, agencies). When the
> business owner connects their Google Calendar, MaKo creates the calendar event for a
> meeting or property visit with a lead (inviting the lead by email), and reschedules that
> event when the owner asks for it, either from the lead's page in the CRM or by writing to
> MaKo on WhatsApp ("move Juan's visit to Friday at 10"). Every change is shown to the owner
> and only applied after the owner confirms it. Google notifies the attendees of the change.
> When a request carries calendar data, MaKo only sends it to AI providers that contractually
> do not train on it (Groq, OpenAI, Anthropic). We need write access to events because creating and moving events is the feature;
> a read-only scope cannot do it.

**`https://www.googleapis.com/auth/calendar.readonly`**

> MaKo reads the owner's primary calendar to (1) know which account and time zone the
> calendar belongs to (`calendars.get` on `primary`), so meetings are scheduled in the
> business's local time; (2) show the owner's free and busy slots before booking or moving
> a meeting (`freeBusy.query`), so MaKo does not propose a time that collides with another
> event; and (3) find the attendees of a recorded meeting by its date, so the action items
> of that meeting can be assigned to the right person (this matching is done by our code;
> the attendee list is never sent to an AI model). `calendar.events` does not allow
> `calendars.get` or `freeBusy.query`, which is why both scopes are requested.

## Guion del video (3 a 4 minutos, en inglés)

Antes de grabar: Chrome con el idioma en **inglés** (la pantalla de permiso tiene que salir
en inglés) y una cuenta de Google de prueba con un par de eventos. Se graba la pantalla
entera, con la barra de direcciones a la vista todo el tiempo.

1. **La home.** Abrir `https://hola-mako.com`, bajar hasta el pie y mostrar los links a
   Privacy y Terms. Decir en una línea qué es MaKo.
2. **Entrar.** Iniciar sesión en MaKo.
3. **Conectar la agenda.** Ir a `/integraciones` → Google Calendar → *Conectar*. Cuando
   aparezca la pantalla de Google, **frenar ahí y mostrar la barra de direcciones**: se tiene
   que leer `client_id=118392241323-j98eqnvhq1okn311tio5vmeg3l9qc3e3...`. Mostrar que dice
   «MaKo» y los dos permisos de Calendar. Aceptar.
4. **`calendar.readonly`.** En el tablero del CRM, *Reagendar* un lead: mostrar la grilla
   del día con los horarios ocupados que salen del calendario.
5. **`calendar.events`, desde la app.** Elegir un horario libre, confirmar, y abrir Google
   Calendar en otra pestaña: el evento quedó en el horario nuevo.
6. **`calendar.events`, por WhatsApp.** Escribirle a MaKo en el grupo «agenda una visita con
   [lead] el viernes a las 10», mostrar que MaKo pide confirmación, contestar «sí» y mostrar
   el evento creado en Google Calendar.
7. **Desconectar.** En `/integraciones`, mostrar *Quitar esta agenda*.

Subir a YouTube como **Unlisted** («Oculto») y pegar el link en el formulario.

## El orden para enviarla

1. ~~Decidir el Uso Limitado y aplicarlo en el código y en `/privacidad`~~ — hecho el 07/10.
2. Verificar `hola-mako.com` y sacar los dos dominios muertos.
3. Declarar los permisos en *Data Access* con los textos de arriba.
4. Grabar y subir el video.
5. Enviar desde *Verification Center* → la confirmación final de enviar la da Martín.
