# Verificación de la app de Google de MaKo

App OAuth del proyecto `mako-500317` (cuenta martinkoncke@gmail.com), cliente «MaKo Web».
Publicada («In production») el 07/10/2026 y **sin verificar**: quien conecta su agenda ve
«Google no verificó esta app» y la app tiene un tope de 100 usuarios en toda su vida.

**Estado al 21/10/2026: FRENADA DESDE EL 11/10 ESPERÁNDONOS.** El cartel general sigue diciendo
«Your app's data access is under review», pero adentro («View verification progress») hay un ítem
en rojo desde el 11/10: *App functionality — Your demo video does not show the OAuth consent flow*.
Ese día llegó un mail a martinkoncke@ («[Action Needed] OAuth Verification Request
Acknowledgement», de api-oauth-dev-verification-reply) que nadie contestó: **diez días perdidos**.
El 21/10 se grabó el video nuevo y se subió como oculto al canal de martinkoncke@:
**https://youtu.be/0-i4bJ8w5fo** (2:44; el archivo es `video-verificacion-google-v2.mp4`, en la
carpeta de arriba del repo). Falta que Martín cree la cuenta del revisor y conteste en ese hilo.
El borrador de la respuesta está en `verificacion-google-meta-21-10.md`, en esa misma carpeta.
La marca quedó verificada y publicada el 10/10 ([requisitos oficiales](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)).

**Lo que espera esta verificación desde el 25/10/2026: la agenda AL ENTRAR con Google.** Martín pidió sacar la tarjeta
de Google Calendar de /integraciones y pedir sus permisos al registrarse con Google. Está hecho detrás de un interruptor,
`GOOGLE_LOGIN_CON_AGENDA=1` (lib/google-login-agenda.ts), **apagado**: con la app sin verificar, sumar calendar.readonly y
calendar.events al login le mostraría «Google no verificó esta app» a TODO el que entra con Google y gastaría el tope de
100 usuarios. Para prenderlo: (1) la verificación aprobada; (2) la política de privacidad reescrita (hoy promete dos
consentimientos separados: app/privacidad/page.tsx); (3) la variable en Vercel. Los scopes son los mismos que se están
verificando; lo que cambia es el MOMENTO en que se piden (NO MEDIDO si Google pide verlo en un video nuevo).

## Lo que pidió Google el 11/10, y por qué falló el primer video

El mail pide cuatro cosas: un video con la pantalla de permisos y **todos los scopes desplegados y
legibles** («if the scopes are obscured, click "Show all services"»), los mismos scopes que se
declararon en la consola, **credenciales de prueba sin bloqueos** (sin teléfono, sin tarjeta) e
instrucciones paso a paso. Después se responde **en el mismo hilo**.

El primer video se grabó con martinkoncke@, que **ya le había dado acceso a MaKo**. Con
`include_granted_scopes=true`, Google no muestra la pantalla de permisos completa. Muestra la de
«acceso adicional», con el recuadro *«hola-mako.com already has some access — See the 3
services»*, que esconde los scopes ya concedidos. Además, la marca se verificó DESPUÉS de grabar,
así que la pantalla decía «hola-mako.com» y no «MaKo». Volver a conectar con la misma cuenta
(`prompt=consent`) tampoco sirve: el 21/10 salió *«MaKo already has some access — See the 5
services»*.

**Cómo se graba bien** (medido el 21/10):
- Antes de grabar, quitarle a MaKo el acceso en la cuenta que se va a usar: myaccount.google.com →
  Conexiones → MaKo → «Borrar todo». Así sale «Sign in to MaKo» y después «MaKo wants access to
  your Google Account», con los dos scopes de Calendar listados y con casilleros, sin nada
  escondido. La agenda de ese negocio queda desconectada hasta que se vuelve a conectar en el mismo
  video.
- El idioma se cambia con el selector del pie de la propia pantalla de Google. Queda `hl=en-US`
  para el resto del flujo, aunque el selector de cuenta puede volver a salir en español.
- **Esos clics los hace Martín, no Claude.** El clasificador de seguridad de Claude bloquea elegir
  la cuenta en Google, aceptar permisos OAuth y tocar «Quitar esta agenda» / «Borrar todo», aunque
  Martín lo haya autorizado. Claude abre cada pantalla y graba; Martín da el clic.
- Grabar con `ffmpeg -f gdigrab -i desktop` a un `.mkv` (si se corta el proceso, el archivo sirve
  igual). ⚠️ Un mkv cortado así no tiene índice: `-ss` no cae en el segundo pedido (en el corte
  hubo ~8 s de desfase). Antes de cortar, pasarlo a mp4 a fps constante con un keyframe por
  segundo, y ubicar cada corte con cuadros que tengan el tiempo impreso (`drawtext` con `%{pts}`).
- En la pantalla de Martín aparece la ventana de Claude cada vez que la mira. Hay que revisar el
  video cuadro por cuadro antes de mandarlo.

## Lo que se envió (10/10/2026)

- **El video:** https://youtu.be/sCTIvH1Ilns (no listado, canal de martinkoncke@, 2:50, en
  inglés con subtítulos y sin audio). Orden: la home con los links de privacidad y términos →
  Integraciones → la pantalla de Google con el `client_id` en la barra → «¿Qué hacer ahora?»
  del CRM → la grilla de horarios libres → el evento en Calendar → «agenda una visita» por
  WhatsApp, el «sí» → el evento en Calendar → «Quitar esta agenda».
- **Data Access:** los 3 no sensibles, `calendar.events` y `calendar.readonly`. La consola
  nueva tiene UNA sola caja de justificación para todos los sensibles (1000 caracteres), así
  que van los dos textos de abajo comprimidos en 836.
- **Additional info:** los dos lugares del video donde se usa `calendar.events`, y que el
  proyecto tiene un solo cliente OAuth.
- **El cuestionario:** «No» a uso personal, interno, de pruebas y plugin de WordPress; los dos
  acuses marcados.
- **Antes de enviar:** `hola-mako.com` verificado en Search Console (TXT en Porkbun); fuera
  `makodigital.app` y `dashboard-marketing-six` (orígenes y 3 redirect URIs); borrado el
  cliente de escritorio «MaKo CLI extensión», que no se usaba (Martín: sí; restaurable 30
  días); la agenda de martinkoncke@ quedó conectada al ws9.

⚠️ **El botón de enviar no existe hasta que la marca está verificada Y PUBLICADA.** El
Verification Center sólo dice «You need to verify and publish your branding before you can
request for verification». La verificación de la marca tarda unos 5 minutos, y sin publicarla
vence a los 7 días.

⚠️ **Las preguntas de Google llegan a martinkoncke@gmail.com** (es el correo de soporte y de
contacto: la consola sólo acepta el de la cuenta o un grupo suyo), y se contestan en el mismo
hilo. Hasta que aprueben, quien conecta su agenda sigue viendo «Google no verificó esta app»
y rige el tope de 100 usuarios.

⚠️ **Grabar el video movió un evento ajeno de la agenda de Martín.** El bug está arreglado
(`lib/calendario-reunion.ts`) y la autopsia está en `docs/hallazgos-crm.md` → «Reagendar
movía cualquier evento…».

## Lo que pide Google, y cómo estamos

| # | Requisito | Estado |
|---|---|---|
| 1 | Branding: nombre, inicio, privacidad, términos y correo de soporte | ✅ MaKo · `hola-mako.com` · `/privacidad` · `/terminos` |
| 2 | Cada dominio autorizado, verificado en Search Console por un dueño del proyecto | ✅ `hola-mako.com` verificado el 09/10 (TXT en Porkbun); los dos dominios muertos, fuera |
| 3 | Los permisos declarados en *Data Access*, con su justificación | ✅ Declarados el 09/10, con la justificación |
| 4 | Un video en YouTube, oculto y en inglés | ✅ https://youtu.be/sCTIvH1Ilns |
| 5 | Una política de privacidad que coincida con lo que hace la app | ✅ Desde el 07/10: la agenda no pasa por ninguna IA |

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

La política promete que los datos del calendario **no se usan para entrenar modelos de IA**.
Desde el 07/10 es cierto por construcción: **los eventos de la agenda no pasan por ningún
modelo**. La IA sólo lee lo que escribe la persona; el código busca en la agenda y le muestra
el resultado directo (`lib/agenda-sin-ia.ts`, fijado por `tests/agenda-sin-ia.test.ts`). En
el reparto de tareas de una reunión, a los invitados del calendario los cruza el código.

Primero se había resuelto ruteando esos pedidos a proveedores que no entrenan; Martín lo
cuestionó («limitar el uso de Gemini no tiene sentido») y tenía razón. El detalle, en
`docs/hallazgos-ia.md` → «La promesa de "Uso Limitado"…».

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
> Calendar data is never sent to an AI model: the assistant only reads what the owner writes,
> and our code looks up the calendar and shows the result to the owner directly. We need write access to events because creating and moving events is the feature;
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
2. ~~Verificar `hola-mako.com` y sacar los dos dominios muertos~~ — hecho el 09/10.
3. ~~Declarar los permisos en *Data Access* con los textos de arriba~~ — hecho el 09/10.
4. ~~Grabar y subir el video~~ — hecho el 10/10, después de que Martín lo viera editado.
5. ~~Enviar desde *Verification Center*~~ — enviada el 10/10 (Martín: «Y termina todo el flujo»).
6. ~~Grabar de nuevo la pantalla de permisos~~ — hecho el 21/10, con el acceso borrado antes.
7. ~~Subir el video nuevo como oculto~~ — https://youtu.be/0-i4bJ8w5fo, 21/10.
8. **Pendiente, de Martín:** crear la cuenta del revisor en el ws3 (sin 2FA) y contestar el hilo
   del 11/10 con el link, las credenciales y los pasos.
9. **Después de enviar algo a Google:** revisar «View verification progress» y el Gmail de
   martinkoncke@ cada dos días. El cartel general dice «under review» aunque la revisión esté
   frenada esperándonos.
