# MaKo en Google Play y App Store: el plan (22/10/2026; cuentas PERSONALES desde el 23/10/2026)

Pedido de Martín (22/10, 09:48): «quiero trabajar en subir la app a la Play y app store».
Fuentes oficiales al final, cada una con su fecha. Medido sobre origin/main `f6bd295e7` y sobre producción el 22/10; las
cuentas, revisadas otra vez el 23/10 en las páginas oficiales.
**23/10, 02:17, Martín: «Sí, a mi nombre ahora».** No hay empresa registrada, así que no hay D-U-N-S: las dos cuentas son PERSONALES.
**3/11/2026, Martín: «Sí, a propósito»: la de Apple va a nombre de Leandro Tejado** (con su gmail), y la de Play, a nombre de Martín
(`martinkoncke@gmail.com`). En cada tienda el vendedor es el nombre legal de su titular. Los pasos, cortos y en orden, están en la (b).
**Para Martín (5 minutos): «Dónde estamos», la §0 y la (b).** La (a) y la (c) son para el chat de código. Los textos para pegar: [tiendas-fichas-borradores.md](tiendas-fichas-borradores.md).

## Dónde estamos (medido el 3/11/2026, sobre la rama `tiendas-0311`)

**Lo único que le queda a Martín, en orden.** Lo demás lo hace un chat de código.

1. ~~Decidir qué responsable dicen las páginas legales.~~ **Decidido el 4/11/2026** (Martín: «Si, el responsable legal es Leandro»). `/privacidad` y `/terminos` siguen nombrando a «Tejado Gonzalvez Leandro Martin» (`lib/titular-mako.ts`), y suman una línea con quién publica en cada tienda: ese mismo nombre en la App Store y «Martín Carballo Koncke» en Google Play (`PUBLICA_EN_PLAY`). Lo fija `tests/tiendas-quien-publica.test.ts`.
2. **Terminar las verificaciones de Play Console.** La cuenta personal ya está abierta (3/11/2026, con martinkoncke@gmail.com y el nombre público MaKo). Google está revisando la identidad (unos días); faltan el teléfono Android con la app Play Console y el número de contacto. Hasta entonces la consola no deja crear la app, y **el reloj de los 14 días todavía no arrancó**. Cuando llegue el mail, aceptar los términos del Android SDK para compilar el `.aab`.
3. **Juntar de 15 a 16 testers con Android**, en un Grupo de Google (paso 4 de la (b)).
4. **Crear la app en Play y pegar los borradores:** `docs/tiendas-fichas-borradores.md`. Data safety y la política van **antes** de la prueba cerrada: Play los pide también ahí. Después, subir el `.aab`. Desde ese día corren los 14.
5. **Apple Developer, a nombre de Leandro Tejado:** aprobada el 3/11/2026 (Team ID `99V2VV9FP2`, ya en `apple-app-site-association`, en `codemagic.yaml` y en el proyecto), con `com.holamako.app` registrado, y la app creada en App Store Connect (SKU `mako-ios`, Apple ID `6830383006`, idioma principal Spanish (Mexico)). Las claves ya existen, y falta cargarlas (lo hace Martín: los `.p8` quedan fuera del repo y un chat no los lee). En Integraciones › Apple Push: `APNS_KEY_ID` = `2T63A9DQMC`, `APNS_TEAM_ID` = `99V2VV9FP2` y el `.p8` en «La clave». Y la API key en Codemagic, con su cuenta (paso 2 de la (b)).
6. **Elegir qué IA usa el negocio de la cuenta de revisión** (`WS_REVISION`, el 900001) para que el revisor pueda probarla: hoy no tiene ninguna. No puede ser una credencial (su entrada exige 0 credenciales): el camino es asignarle un crédito de Claude de la plataforma en `CREDITO_DE_UN_NEGOCIO` (`lib/veto-claude.ts`), como el del ws1, mientras dure la revisión. Es plata: lo decide Martín (`docs/relevo/nube-tiendas.md`).
7. **A los 14 días, pedir el acceso a producción** en Play, con el borrador completo con lo que haya pasado.

| Paso de la (a) | Estado | Evidencia |
|---|---|---|
| 1. `/.well-known` público | **Hecho**, falta la huella | Dan 200 (medido el 3/11). El de Apple ya lleva el Team ID. `assetlinks.json` sigue vacío hasta tener la huella: la pone `scripts/tiendas-asociar.mjs` |
| 2. El teléfono no vende | **Hecho el 3/11** | Medido antes: «Tu plan» abría el pago, Agency tenía «Pagar su primer mes», los carteles de la prueba y More ofrecían pasar de plan, y la cuenta pausada, pagar. `tests/tiendas-telefono-no-vende.test.ts`. Desde el 4/11, MaKo Partners («Ya cobraste») y Agency Dashboard («Falta pagar») no van en ningún teléfono, Android incluido: `TABS_QUE_VENDEN`, `lib/tienda.ts` |
| 3. Modo iOS | **Hecho el 3/11** | `lib/tienda.ts`: sin Google, sin relleno, y lo que vende no se abre. Mismo test |
| 4. Borrar la cuenta, `/soporte`, `/eliminar-cuenta`, privacidad | **Hecho el 3/11** | `lib/baja-cuenta.ts`, `tests/baja-cuenta.test.ts`. Hay que agregar una tabla nueva a la base de producción (`0371_bajas_cuenta.sql`), que sólo agrega, antes de subir |
| 5. La cuenta de revisión | **Código en main desde `punta/tiendas-revisor` (4/11); el script, sin correr** | La segunda revisión (4/11) encontró cuatro fallas altas y se cerraron: una lista de lo PERMITIDO en el proxy (páginas incluidas), la guarda de envío, un negocio propio (`WS_REVISION`) y los tickets sin despacho (`docs/hallazgos-seguridad.md`). El comando y lo que trae, en `docs/relevo/nube-tiendas.md`. Lo corre el Cerebro con el sí de Martín |
| 6. IA: el permiso y la denuncia | **Hecho el 3/11** | `lib/ia-permiso.ts`, `app/_chat/ReportarRespuesta.tsx`, `tests/ia-permiso.test.ts`. Sólo en iPhone: ver R7 |
| 7. Android (TWA) | **Proyecto listo, falta compilar** | Generado el 3/11 con `targetSdkVersion 36`. `nativo/android/compilar.mjs` arma el `.aab` firmado. **No se compila todavía** (el Cerebro, 3/11): va cuando llegue el mail de Google con la identidad aprobada, con el sí de Martín a los términos del Android SDK y una ventana de RAM |
| 8. iOS: guardar, compartir, links, hápticos, sin conexión | **Del lado de la web, hecho el 3/11** | `lib/nativo.ts`, `tests/tiendas-nativo-web.test.ts`. Falta mirarlo en TestFlight |
| 9. Push por APNs | **Del lado del servidor, hecho el 3/11** | `lib/push-apns.ts`, `tests/push-apns.test.ts`, contra un servidor HTTP/2 local. Falta la clave, y que llegue a un iPhone |
| 10. Compilar iOS y armar la ficha | **Textos y feature graphic listos** | `docs/tiendas-fichas-borradores.md`, `nativo/android/feature-graphic.png`. `codemagic.yaml` sigue sin correr. Faltan las capturas, que piden la cuenta de revisión |

## Qué cambió en las reglas al 3/11/2026 (leído en las páginas oficiales)

- **Play, la prueba cerrada:** sigue en 12 testers y 14 días seguidos, y los 12 tienen que seguir anotados el día que se pide producción. **Data safety y la política se piden también para la prueba cerrada**: sólo la prueba interna está exenta.
- **Android, verificación de desarrollador:** nueva. Rige desde el 30/09/2026 en Brasil, Indonesia, Singapur y Tailandia, y en todo el mundo en 2027. Argentina no aparece. Para quien publica en Play, «no new action» en la mayoría de los casos, y el id se registra solo al crear la app. A mirar en Settings › Developer Account al abrir la cuenta.
- **Android, API:** sigue en 36 para apps nuevas. La prórroga al 1/11/2026 era para actualizar apps viejas, y ya pasó. El proyecto generado da 36.
- **Apple, guías:** actualizadas el 16/10/2026. La 4.2 no cambió. Se suma al plan la **1.2** (contenido de usuarios: denunciar, bloquear y moderar): riesgo R13.
- **Apple, edades:** 4+, 9+, 13+, 16+ y 18+, y desde septiembre de 2026 la pregunta de redes sociales es obligatoria. «Unrestricted web access» da 16+: por eso la app navega sólo hola-mako.com.
- **Apple, capturas:** la obligatoria es la de iPhone con Dynamic Island mediana (1179×2556 o 1206×2622). Con la de 1320×2868 no hace falta la de Face ID grande. Desde abril de 2027, las de iPhone Duo para apps con el SDK de iOS 27.1.
- **Apple, otros:** desde el 9/9/2026, iOS 13 como mínimo. Xcode 26 sigue obligatorio. Capacitor sigue diciendo que `server.url` no es para producción (R12).

## En 6 líneas

- **Android:** una Trusted Web Activity (TWA) hecha con Bubblewrap sobre `hola-mako.com`. Es la misma PWA, con Chrome
  por debajo y a pantalla completa. Google, la contraseña, el 2FA, las passkeys, el micrófono y el Web Push andan como hoy.
- **iPhone:** Capacitor (sólo iOS) apuntando a `hola-mako.com`, más lo nativo que pide la guía 4.2: push por APNs, el
  micrófono, compartir y guardar, los links universales y una pantalla sin conexión. Se compila en Codemagic, sin Mac.
- **No hay pantallas nuevas.** La app de las tiendas es `/m`, y lo nativo sólo suma capacidades del aparato. La regla «el
  teléfono DESTILA el escritorio» sigue igual, y la decisión «PWA y no nativa» también: los envoltorios son de la PWA.
- **Camino crítico, que es de Martín:** las cuentas, PERSONALES (sin D-U-N-S). En Play, la cuenta personal pide **14 días
  seguidos de prueba cerrada con 12 testers** antes de poder pedir producción, y el reloj arranca con el primer AAB: es lo que
  más tarda. En Apple, después de pagar llega la confirmación por email (si no llega en 24 horas, se escribe a soporte).
- **`/.well-known/assetlinks.json` y `/.well-known/apple-app-site-association`** devolvían 307 a /login el 22/10; dan 200 desde
  ese arreglo. Sin eso no anda ni la TWA ni los links universales.
- **No hay `Mac`, no hay iPhone propio** (Martín usa Android). Para TestFlight hace falta alguien con iPhone. Y Apple
  verifica la identidad con su app **Apple Developer**, que corre en iPhone, iPad o Mac: sin uno, el alta va por la web y, si
  pide la verificación, se usa un iPhone prestado de punta a punta o se le pide otro método a soporte (paso 2 de la (b)).

## 0. Decisiones de Martín (antes de todo)

| # | Decisión | Recomendación |
|---|---|---|
| T1 | ¿Cuenta **personal** o de **empresa**, en las dos tiendas? | **DECIDIDO: PERSONAL**, sin empresa registrada ni D-U-N-S (23/10, 02:17). **Apple, a nombre de Leandro Tejado, y Play, a nombre de Martín** (3/11/2026, Martín: «Sí, a propósito»). El vendedor que se ve es el nombre legal de cada titular (ver «Dónde estamos», punto 1). En Play se ven su nombre legal, su país y el email de desarrollador (va `equipo@hola-mako.com`); la dirección completa sólo si la app cobra, y no cobra (T5). Cuando haya sociedad, las dos tiendas dejan pasar la cuenta a la empresa. |
| T2 | El id de la app (`com.holamako.app`). Una vez publicado **no se cambia**. | `com.holamako.app` en las dos. |
| T3 | ¿Se publica en la UE? España es UE, y el ws19 está en Madrid. | **DECIDIDO (3/11/2026, Martín): se publica en la UE**, «sin problemas», con los datos de Leandro como vendedor (la cuenta de Apple es suya). |
| T4 | ¿Qué borra «Eliminar mi cuenta»? Para el dueño de un negocio, ¿es el workspace entero? ¿En cuánto tiempo? | Para el dueño, el workspace entero. Plazo de hasta 30 días, con un email al terminar. Pasa por la doble confirmación de la D2. |
| T5 | ¿El teléfono vende? (plan, saldo de IA, precios, links de pago) | **No, en ningún lado.** Apple y Google prohíben vender algo digital sin su cobro, o mandar a pagar afuera. La compra queda en la computadora. Es lo más simple y lo más robusto (ver el riesgo R2). |
| T6 | ¿Cómo se entra en iPhone? | Con correo, contraseña y 2FA, **sin el botón de Google** (ver R3). Sign in with Apple puede venir más adelante. |

## (b) Lo que hace Martín: cuentas, plata, identidad

**Nosotros no creamos cuentas ni cargamos tarjetas:** cada paso de acá es suyo. Va en este orden porque Play es lo que más tarda.

1. **Google Play Console, cuenta PERSONAL (USD 25, una sola vez).** Primero, porque los 14 días de prueba no arrancan sin ella.
   - Entrar a play.google.com/console/signup con su Gmail y elegir **«Para mí» / «Yourself»** (personal).
   - Pagar los USD 25 con una **tarjeta de crédito a su nombre legal** (no sirve una prepaga).
   - Completar el perfil de pagos con su nombre legal y su dirección, el email y el teléfono de contacto (se verifican con un
     código), y como **email de desarrollador `equipo@hola-mako.com`**: es el que se ve en la tienda.
   - Cuando la consola lo pida, **verificar la identidad** con su DNI o pasaporte.
   - Instalar la app **Play Console** en su Samsung y **verificar el teléfono** desde ahí.
   - Avisarnos: subimos el primer AAB a la prueba cerrada y desde ese día corren los 14.
2. **Apple Developer Program, cuenta INDIVIDUAL (USD 99 por año), a nombre de Leandro Tejado** (con su gmail): aprobada el 3/11/2026. Lo que dice abajo vale para esa cuenta, y el nombre legal es el de Leandro.
   - Un Apple Account con su **nombre legal** (sin apodos): si no tiene, se crea en account.apple.com.
   - Prender la **verificación en dos pasos** en account.apple.com → «Mejorar la seguridad de la cuenta», con su número de
     teléfono.
   - Inscribirse en developer.apple.com/programs/enroll como **persona**: nombre legal, teléfono y dirección (no una casilla
     postal). En Argentina no hay Apple Store online, así que se paga con una **tarjeta de crédito a su nombre que cobre en
     dólares**.
   - Si Apple pide **verificar la identidad en la app Apple Developer** (sólo corre en iPhone, iPad o Mac), hay dos salidas:
     un iPhone prestado, usado de principio a fin (Apple pide el mismo aparato para todo el alta), o pedirle otro método a
     Apple Developer Support. Tenerlo previsto antes de empezar.
   - Ya aprobada: crear en App Store Connect la **API key** (rol App Manager, la usa Codemagic) y la **clave de APNs (.p8)**
     (la usa `lib/push.ts`), y cargarlas él en `credenciales` del workspace de plataforma. **El chat nunca las ve en texto.**
   - **La misma cuenta firma el instalador de Mac** (y ahí también el nombre que se ve es el de Leandro): el certificado «Developer ID Application» y otra clave de App Store
     Connect, «MaKo notarización» (acceso Developer), que nunca va a un chat ni a `credenciales`. Los pasos:
     docs/plan-instalador-escritorio.md › «Firmar la Mac: lo que hace Martín» (del chat «IA del cliente»).
3. **Codemagic.** Abrir la cuenta con su GitHub. El plan gratis trae 500 minutos de macOS por mes; después, USD 0,095 por minuto.
   Compila el iPhone sin una Mac.
4. **Los testers.**
   - **Android: 12 personas con un teléfono Android y una cuenta de Google, anotadas 14 días SEGUIDOS** en la prueba cerrada.
     Quien se baja antes no cuenta, y si vuelve a entrar, los 14 días empiezan de nuevo. Conviene **juntar 15 o 16**, por las
     que se caigan, y pedirles que la abran unas cuantas veces en esas dos semanas: Google pregunta qué probaron.
     - De dónde salen: el equipo de MaKo; los clientes con Android (Mauricio y su equipo de closers y setters; el ws13, Código
       Inmobiliario); el Grupo Makito; y familia o amigos con Android.
     - Lo más fácil de manejar es **un Grupo de Google** (por ejemplo `testers-mako@googlegroups.com`): se carga el grupo una
       vez en la consola y se suma o se saca gente sin tocarla. Cada tester entra al link de la prueba, acepta y la instala
       desde Play.
   - **iPhone:** una o dos personas con iPhone para TestFlight (¿Mauricio?).
5. **Los formularios de la consola.** El chat deja los borradores (paso 10 de la (a)) y Martín los revisa y los manda.
   - Data safety (Play) y App Privacy (Apple).
   - Clasificación de contenido: el cuestionario IARC en Play, y el nuevo de edades en Apple (13+, 16+, 18+, con la
     sección de redes sociales obligatoria desde septiembre de 2026).
   - Público objetivo **sólo 18+**, con «Restrict minor access».
   - Anuncios: no.
   - Trader UE (T3).
6. **Aprobar los textos y las capturas de la ficha** antes de enviar.
7. **Al pasar la prueba cerrada**, contestar en Play el «Solicitar acceso a producción»: cómo consiguió los testers, qué
   probaron, qué cambió por lo que dijeron y cuántas instalaciones espera el primer año. El chat deja el borrador. La revisión
   «suele tardar 7 días o menos».

## (a) Lo que hace un chat de código

Va en un worktree propio desde origin/main, con `tsc-acotado`, tests probados ROMPIÉNDOLOS y el commit firmado. Cada paso
cosecha en `docs/hallazgos-mobile.md`.

1. **`/.well-known` público.**
   - Archivos: `public/.well-known/assetlinks.json` y `apple-app-site-association` (sin extensión, servido como
     `application/json`), el matcher de `proxy.ts` (que hoy no exime `.well-known/`) y `lib/rutas-publicas.ts`.
   - Las huellas SHA-256 van **dos**: la de subida (la de Bubblewrap) y la de **Play App Signing** (Play Console →
     Configuración → Integridad de la app). La segunda existe recién después del primer AAB, así que este paso se hace dos
     veces.
   - **Hecho cuando** `curl -sI https://hola-mako.com/.well-known/assetlinks.json` da 200 `application/json` sin `Location`,
     y el test del matcher falla si se saca la exención.
2. **El teléfono no vende** (T5). `app/m/configuraciones/plan/PlanM.tsx`, `CuentaM.tsx` y lo que muestre saldo de IA o
   precios pasan a mostrar el estado («Plan Pro, activo») sin botón ni link de pago.
   - **Hecho cuando** `git grep` en `app/m` no encuentra links a checkout, Stripe o MercadoPago. `/m/cobros` (los cobros
     del negocio a SUS clientes) no es una compra dentro de la app y se queda.
3. **Modo iOS.** Lo marca el user agent (`appendUserAgent: 'MaKoApp-iOS'` de Capacitor), que se lee en el server y en el
   cliente con una función pura `lib/tienda.ts`.
   - Esconde el botón de Google (`app/login/LoginForm.tsx`) y las filas «Coming soon» / «En la computadora» de More
     (`EN_CAMINO`, `/m/pronto`).
   - **No agrega pantallas.**
   - ⚠️ Para Android no sirve una cookie: la TWA **comparte las cookies y el storage con Chrome**, y la marca se filtraría
     al navegador. Por eso el T5 va para todos y Android no tiene «modo».
   - **Hecho cuando** con ese user agent no hay Google ni «Coming soon», y sin él todo queda igual (un test de cada lado).
4. **Borrar la cuenta, soporte y privacidad.**
   - «Eliminar mi cuenta» en `/m/cuenta` y en Perfil de escritorio, a 2 toques como mucho, con el alcance y el plazo de T4.
   - Una página pública `/eliminar-cuenta`, porque Play pide un link web que nombre la app.
   - Una página pública `/soporte`, porque Apple pide una URL de soporte.
   - En `app/privacidad/page.tsx:381` hoy dice que **no existe** el botón: hay que corregirlo, y sumar la lista de
     proveedores de IA, el audio del micrófono y los tokens de push.
   - **Hecho cuando** las dos páginas dan 200 sin sesión y el borrado deja una marca que el SuperAdmin ve.
5. **La cuenta de revisión.** Es un closer de su PROPIO negocio (`WS_REVISION`, 4/11: no el ws3, donde «Datos de Mau» y
   «simular» dejan datos de verdad), con leads de ejemplo y entrada por correo y contraseña.
   - Google exige **credenciales reutilizables que se salten el 2FA**. Los códigos de recuperación son de un solo uso y no
     alcanzan.
   - Hace falta una excepción **atada a ESE email Y a su negocio**, que quede registrada en cada login. **La revisa el chat de
     Ciberseguridad antes de subir.**
   - **Hecho cuando** el test prueba que cualquier otro usuario o workspace sigue pidiendo 2FA, y lo prueba rompiéndolo.
6. **IA: el permiso y la denuncia.**
   - Apple 5.1.2(i): antes de mandar datos personales a una IA de terceros (Claude, GPT, Groq, ElevenLabs…) hay que
     **avisar y pedir permiso explícito**. Se pide una vez por persona y queda guardado.
   - Play (contenido generado por IA): hace falta una forma de **denunciar desde la app** una respuesta ofensiva. Puede ser
     un «Reportar» en el mensaje del Ops Center que use el «Reportar problema» que ya existe.
   - **Hecho cuando** sin el permiso no sale nada a la IA, y lo prueba un test.
7. **Android (TWA)** en `nativo/android/`.
   - `bubblewrap init --manifest=https://hola-mako.com/manifest.webmanifest` (requiere JDK 17 y Node 18+).
   - En `twa-manifest.json`: `packageId` del T2, `enableNotifications: true` (delega el Web Push a la app; en Android 13+
     pide el permiso de notificaciones), **target API 36** (obligatorio desde el 31/08/2026) y `startUrl: /inicio`.
   - La keystore y su clave quedan **fuera del repo**: Martín guarda una copia. Con Play App Signing, perderla no es fatal.
   - **Hecho cuando** el `.aab` instalado en el Samsung de Martín abre **sin barra de URL** (si aparece la barra, falló
     Asset Links) y el push de prueba de `/m/cuenta` llega con el ícono de MaKo.
8. **iOS (Capacitor)** en `nativo/ios/`.
   - `server.url = https://hola-mako.com/inicio`, `errorPath` con la pantalla sin conexión, sólo iPhone
     (`TARGETED_DEVICE_FAMILY=1`).
   - Info.plist: `NSMicrophoneUsageDescription` y `NSCameraUsageDescription` (en español) y
     `ITSAppUsesNonExemptEncryption=NO`.
   - Associated Domains: `applinks:` y `webcredentials:hola-mako.com` (para los links universales, las passkeys y el autofill).
   - El delegado de permisos de WKWebView, para que el micrófono se pida **una sola vez**.
   - Compartir y guardar nativos, porque en WKWebView `<a download>` no anda. Eso rompe «Guardar en el teléfono» del Video
     Editor y `app/login/2fa/descargar-codigos.ts`.
   - Hápticos al enviar o aprobar.
   - **Hecho cuando** en TestFlight: se entra con 2FA, se dicta en el Ops Center, se guarda un MP4 en Fotos, se descargan
     los códigos, un link `hola-mako.com/...` de WhatsApp abre la app, y en modo avión sale la pantalla de MaKo (no una en
     blanco).
9. **Push por APNs en el server.** Web Push **no existe dentro de una app con WebView en iOS**: sólo en la web instalada.
   - `push_suscripciones` suma `tipo` (`web` o `apns`) y el token que da `@capacitor/push-notifications`. En iOS ese token
     es de APNs, no de FCM.
   - `lib/push.ts` manda por HTTP/2 a APNs con la `.p8` de `credenciales` (regla 1 del módulo: nunca variables de Vercel).
   - El catálogo, la preferencia por persona, el TTL y la urgencia son los mismos: TTL → `apns-expiration` y `high` →
     `apns-priority: 10`.
   - El toque abre la ruta de `lib/push-payload.ts`. Una «MaKo te pide confirmar» abre **la tarjeta** del Ops Center
     (D1 y D3a). ¿Aprobar desde la notificación misma, con el teléfono desbloqueado? **Lo decide el chat del Ops Center.**
   - **Hecho cuando** el test del armado de APNs falla al romperlo, y «Probar avisos» de `/m/cuenta` llega al iPhone de
     TestFlight.
10. **Compilar y armar la ficha.**
    - `codemagic.yaml`: `npx cap sync ios`, firma automática con la API key, `xcode: latest` (desde el 28/04/2026 es
      obligatorio Xcode 26 con el SDK de iOS 26) y `submit_to_testflight`. **No en GitHub Actions**: los minutos no alcanzan.
    - Capturas del `/m` real **con el ws3 y datos ficticios**: Play pide al menos 4 de 1080×1920 o más, y Apple de
      1320×2868 y 1206×2622, sin transparencia.
    - Feature graphic de 1024×500 sin transparencia.
    - El ícono de Play ya está: `public/icon-512.png` es de 512×512 RGBA y pesa 20 KB. Apple pide otro de 1024×1024
      **sin transparencia**.
    - Los textos: el título (30 caracteres), la descripción corta (80) y la larga.
    - El borrador de Data safety y App Privacy, sacado del código. Va a declarar:
      - Datos de contacto y user ID.
      - Mensajes, audio, fotos y videos.
      - Contactos de los leads, porque el CRM guarda datos de OTRAS personas.
      - Diagnósticos.
      - Proveedores: Anthropic, OpenAI, Groq, ElevenLabs, Meta, Google, Stripe, MercadoPago, Resend y Evolution.
      - Cifrado en tránsito: sí. Borrado: sí (paso 4). Rastreo publicitario: no.
    - Las notas para el revisor, en inglés: el usuario demo, qué es MaKo y **qué hace de nativo** (paso 8 y paso 9).

**Orden:**

| Etapa | Qué |
|---|---|
| Semana 1 | Martín abre las dos cuentas personales (Play primero). El chat hace los pasos 1 a 7. Apenas está el AAB, **arranca la prueba cerrada** de Play con los testers: corren los 14 días. |
| Semana 2 | El chat hace los pasos 8 a 10. TestFlight interno: hasta 100 personas, sin revisión. |
| Semana 3 | Pasados los 14 días, Martín pide el acceso a producción en Play (su revisión «suele tardar 7 días o menos») y se envía a Apple. |

Los cambios web llegan a las dos apps con el deploy de Vercel. Una versión nueva en la tienda sólo hace falta si cambia el
envoltorio.

## (c) Riesgos de rechazo y cómo se evitan

| # | Riesgo | Tienda | Cómo se evita |
|---|---|---|---|
| R1 | **4.2: «web envuelta»** | Apple | Lo nativo del paso 8 y del paso 9: push APNs, micrófono, guardar en Fotos y compartir, links universales, pantalla sin conexión y hápticos. Las notas al revisor lo enumeran. Si igual rechaza, se contesta en el Resolution Center con un video. El plan B es sumar una Share Extension que mande cosas al Ops Center. |
| R2 | **Vender sin IAP o sin Play Billing**, o mandar a pagar afuera | Las dos | T5: el teléfono no vende ni muestra precios ni links de pago (3.1.1 y 3.1.1(a); en Play, la política de pagos prohíbe desviar al usuario). La 3.1.3(f) no aplica: es para VoIP, almacenamiento, email y hosting. |
| R3 | **4.8: login con Google sin una alternativa equivalente**, y Google **prohíbe su OAuth en un WebView** («embedded user-agent») | Apple | En iOS no hay botón de Google (T6, paso 3). Se entra con correo, contraseña y 2FA, que ya existe desde el 15/10. Quien entraba con Google arma su contraseña en `/login/restablecer`. |
| R4 | **No se puede borrar la cuenta** (5.1.1(v); política de borrado de Play) | Las dos | Paso 4. Apple no acepta «escribinos un email», y desactivar la cuenta no alcanza: hay que borrarla. |
| R5 | **El revisor no puede entrar** (2.1(a); Play pide credenciales reutilizables que se salten el OTP) | Las dos | Paso 5. La cuenta es closer, y el onboarding sólo tapa la app a un admin (`onboardingPendiente`): no hace falta cerrarlo. |
| R6 | **Contenido de relleno**: «Coming soon» y «En la computadora» (2.1) | Apple | El modo iOS los esconde (paso 3). |
| R7 | **IA sin permiso** (5.1.2(i)) y sin forma de denunciar (Play) | Las dos | Paso 6. El permiso se exige sólo con la marca de la app de iPhone: es lo que pide Apple, la TWA no se puede distinguir de Chrome, y cortarlo en el navegador rompería la IA de los clientes de hoy. Lo automático de un negocio (sus crons, su bot) no tiene a quién preguntarle: lo cuenta la política. |
| R8 | **La TWA abre con barra de URL**: Asset Links con la huella equivocada o con una redirección | Play | Paso 1: las dos huellas y sin 307. Hoy da 307. |
| R9 | **Target API viejo** (36, desde el 31/08/2026) o **Xcode viejo** (26, desde el 28/04/2026) | Las dos | Paso 7 y paso 10. |
| R10 | **Las capturas no muestran la app real**, o muestran datos de clientes (2.3) | Las dos | Se capturan del `/m` real con el ws3 ficticio. |
| R11 | **Se ve roto en iPad**: una app sólo de iPhone igual corre en iPad y el revisor puede probarla ahí | Apple | Mirar `/m` a 768 px antes de enviar. |
| R13 | **Contenido de usuarios sin bloquear** (1.2): Community no tiene cómo bloquear a alguien desde el teléfono | Apple | En iPhone no va (paso 3). En Android, Reportar desde la publicación y el comentario. Volver a sumarla a iPhone pide bloquear y moderar desde el teléfono. |
| R14 | **El revisor entra a una IA vacía**: el negocio de revisión no tiene ninguna, y el chat contesta «No hay ninguna IA conectada» | Las dos | Asignarle un crédito de Claude de la plataforma (`CREDITO_DE_UN_NEGOCIO`) mientras dure la revisión: una credencial no sirve, porque la entrada exige 0. Es una decisión de plata de Martín («Dónde estamos», punto 6). |
| R12 | Capacitor dice que `server.url` **«no está pensado para producción»** | Apple | Es un riesgo técnico aceptado: lo usan muchas apps así. `errorPath` cubre la falta de red. Si molesta, la alternativa es un envoltorio WKWebView propio en Swift, con más código y sin plugins. |

## Cómo encaja con lo que ya existe

- **Login con 2FA.** La TWA es Chrome y comparte las cookies con Chrome: quien ya entró en Chrome, entra directo. iOS
  entra por correo; las passkeys y el autofill necesitan `webcredentials` (paso 8).
- **Ops Center.** Sigue siendo la portada: la app abre `/inicio` igual que la PWA. Las decisiones siguen siendo tarjetas
  del chat. El push sólo abre la tarjeta: tocar «Enviar» en la tarjeta sigue siendo la aprobación (D3a).
- **Notificaciones.** Android usa el Web Push actual sin tocar el server; sólo se delega a la app. iOS suma el canal APNs
  (paso 9), con las mismas preferencias por persona.
- **Micrófono.** `app/_components/useDictar.ts` y el `VoiceRecorder` de WhatsApp: en la TWA es el permiso del sitio en
  Chrome; en iOS es la descripción de Info.plist más el delegado (getUserMedia en WKWebView existe desde iOS 14.3).
- **«El teléfono DESTILA el escritorio».** Las tiendas sólo **esconden** (la compra y lo que está «en camino») y suman
  capacidades del aparato. Nunca tienen una pantalla propia. El guardián `tests/movil-toda-tab.test.ts` sigue valiendo.

## Fuentes (consultadas el 22/10/2026; las de las cuentas personales, otra vez el 23/10/2026; todas, de nuevo el 3/11/2026; la fecha entre paréntesis es la que muestra cada página)

**Lo que se sumó el 3/11/2026:**
- Verificación de desarrollador de Android (efectiva el 30/09/2026): developer.android.com/developer-verification y su guía de Play Console, …/guides/google-play-console.
- Verificar el teléfono en Play Console: support.google.com/googleplay/android-developer/answer/14316361 (sin fecha).
- Target API para apps nuevas y prórroga: …/answer/11926878 (sin fecha).
- App Review Guidelines: «Last Updated: October 16, 2026». Lo que viene: developer.apple.com/news/upcoming-requirements. Pregunta de redes sociales en las edades: developer.apple.com/news/?id=tlur8uvi (9/7/2026).
- Valores y definiciones de las edades: developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions. Capturas, trader y App Privacy, leídas el mismo día en sus páginas de arriba.

**Las cuentas personales (23/10/2026):**
- Play, la prueba de las cuentas personales: «at least 12 testers… opted in continuously for at least 14 days», para las
  cuentas creadas después del 13/11/2023; después se pide producción con un formulario de tres partes, revisión «seven days or
  less»: support.google.com/googleplay/android-developer/answer/14151465 (sin fecha). Era de 20 testers hasta diciembre de 2024.
- Play, el alta: USD 25 una vez, 18 años, DNI y tarjeta a nombre legal, sin prepagas, y verificar un Android con la app Play
  Console: …/answer/6112435 (sin fecha). Lo que se ve en la tienda con cuenta personal (nombre legal, país y email de
  desarrollador; la dirección completa sólo si se monetiza) y la verificación por código del email y el teléfono:
  …/answer/13628312 (sin fecha).
- Apple, el alta individual: Apple Account con 2FA, nombre legal (sin alias), dirección sin casilla postal, USD 99 por año, el
  nombre legal es el vendedor: developer.apple.com/programs/enroll (sin fecha). Pago en USD con tarjeta donde no hay Apple
  Store online, y la app o la web para inscribirse: developer.apple.com/support/enrollment (sin fecha).
- Apple, verificar la identidad: «Verification of your legal identity is currently required», con la app Apple Developer o, si
  no, «contact support»: developer.apple.com/help/account/membership/identity-verification (sin fecha). La app pide iPhone o iPad
  con Face ID, Touch ID o código, o Mac con T2 o Apple silicon, y «the same device for the entire enrollment process»:
  developer.apple.com/support/app-account (sin fecha).
- Apple Account, la verificación en dos pasos desde la web (account.apple.com → «Upgrade Account Security»):
  support.apple.com/en-us/102660 (sin fecha).

**El resto del plan (22/10/2026):**

- Google Play, requisitos de prueba de las cuentas personales nuevas (12 testers, 14 días, cuentas de después del
  13/11/2023): support.google.com/googleplay/android-developer/answer/14151465 (sin fecha en la página).
- Play Console, registro (USD 25, DNI y tarjeta, verificar el dispositivo): …/answer/6112435 (sin fecha). Datos de la cuenta
  y D-U-N-S de empresa (gratis, hasta 30 días): …/answer/13628312 (sin fecha).
- Target API 36 desde el 31/08/2026: developer.android.com/google/play/requirements/target-sdk (actualizada 16/10/2026).
- Recursos de la ficha (ícono 512, feature 1024×500, capturas): …/answer/9866151 (sin fecha).
- Borrar la cuenta en Play: …/answer/13327111. Data safety: …/answer/10787469. Credenciales para la revisión y el 2FA:
  …/answer/15748846. Público objetivo: …/answer/9867159. Pagos: …/answer/9858738. Spam y webviews: …/answer/9899034.
  Contenido generado por IA: …/answer/13985936. (Ninguna muestra fecha.)
- TWA: developer.android.com/develop/ui/views/layout/webapps/trusted-web-activities (26/02/2026). Quick start de Bubblewrap:
  developer.chrome.com/docs/android/trusted-web-activity/quick-start (28/08/2019). Huella de Play App Signing:
  developer.chrome.com/docs/android/trusted-web-activity/android-for-web-devs (22/07/2021). README del CLI de Bubblewrap
  (JDK 17, `enableNotifications`, `fingerprint add`): github.com/GoogleChromeLabs/bubblewrap, packages/cli (sin fecha).
- Política OAuth de Google, sin «embedded user-agents»: developers.google.com/identity/protocols/oauth2/policies
  (05/08/2026).
- App Review Guidelines (4.2, 4.2.2, 4.8, 3.1.1, 3.1.1(a), 3.1.3(c y f), 5.1.1(v), 5.1.2(i), 2.1(a) y 2.3):
  developer.apple.com/app-store/review/guidelines (sin fecha).
- Borrar la cuenta en Apple: developer.apple.com/support/offering-account-deletion-in-your-app (sin fecha).
- Inscripción a Apple Developer (USD 99 por año, D-U-N-S, entidad legal): developer.apple.com/programs/enroll (sin fecha).
- Xcode 26 obligatorio desde el 28/04/2026: developer.apple.com/news/upcoming-requirements (vigente). Edades nuevas y la
  sección de redes sociales desde septiembre de 2026: developer.apple.com/news/?id=tlur8uvi.
- Capturas de pantalla: developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications.
  TestFlight (100 internos, 10.000 externos, 90 días): …/test-a-beta-version/testflight-overview. Trader de la DSA:
  …/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements. App Privacy:
  developer.apple.com/app-store/app-privacy-details. (Ninguna muestra fecha.)
- Configuración de Capacitor (`server.url` «not intended for production», `appendUserAgent`, `errorPath` desde la 4.0):
  capacitorjs.com/docs/config. Push en Capacitor (token APNs en iOS, FCM en Android):
  capacitorjs.com/docs/apis/push-notifications. (Sin fecha.)
- Codemagic con Capacitor y TestFlight: docs.codemagic.io/yaml-quick-start/building-an-ionic-app (unos 4 meses de
  antigüedad). Precios (500 minutos gratis, USD 0,095 por minuto): codemagic.io/pricing.
- getUserMedia en WKWebView (iOS 14.3+) y el delegado de permisos: developer.apple.com/documentation/webkit/wkuidelegate
  y la sesión de la WWDC21 10032.
