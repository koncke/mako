# Relevo: MaKo Desktop (la app de escritorio), 25/10/2026

Chat «MaKo Desktop», cuenta 5 (Ananda). Rama `desktop-2510`, worktree `C:/dev/wt-desktop-2510` (su `node_modules` es un
junction al del clon: antes de borrar el worktree, `cmd /c rmdir C:\dev\wt-desktop-2510\node_modules`). El plan de siempre vive
en [`../plan-instalador-escritorio.md`](../plan-instalador-escritorio.md); lo que costó, en
[`../hallazgos-ia.md`](../hallazgos-ia.md) → «"No es seguro", el instalador con la marca y "Conecta MaKo" sin texto».

El pedido (Martín, 25/10 ~11:30): «con respecto a instalar mako desktop, me dice que no es seguro, que podemos hacer para que
no salga eso? Y el instalador de MaKo debe estar personalizado con el diseño de mako... En "tus cuentas de IA" cuando le doy a
conectar, una vez instalado, rediseña eso, que se vea facil, mira la cantidad de texto...».

## Hecho en la rama (NO está en producción)

- **«Conecta MaKo», rediseñado** (`app/integraciones/TusCuentasIA.tsx` → `Tutorial`): dos pantallas, un botón grande cada una
  («Descarga MaKo» y «Conecta esta computadora»), con el dibujo de «Instalar MaKo desktop». El botón «Conectar» es el «acepto»
  y abre la app solo (`mako://conectar`); la pantalla dice qué tocar («Toca «Abrir» y después «Sí»») y, si en 6 s no pasa nada,
  «¿No se abrió? Probar de nuevo · Descargar MaKo» (la página de Zoom). Se fueron el «Paso 3 de 3», los párrafos, el código a
  la vista, «Pedir otro código» y todo comando: la línea plegada queda SÓLO para una PC de la 0.3.x (`abreEnlacesMako`). En la
  Mac, el mismo botón deja el código en el portapapeles. Visto en el navegador con la API simulada (once estados, claro y
  oscuro), no en hola-mako.com.
- **El instalador con la marca** (`installer/windows/mako.iss`): la criatura y el logo de MaKo en el asistente, el ícono en el
  instalador, el desinstalador y los accesos, dos toques, textos en tú, claro u oscuro. Fotos del asistente con
  `scripts/ia-pc/vista-instalador.ps1` (no instala nada). MaKo.app con su ícono, también en sus ventanas.
- **«No es seguro»:** las fuentes y la tabla de qué cambia con la firma, en el plan. `verificarFirmaWindows`: `publicar-binarios`
  no sube un .exe que Windows no acepte, y `node scripts/ia-pc/firmar-windows.mjs verificar <archivo>` lo mira a mano.

## «La app de desktop jamás me pidió login» (25/10 ~12:00, urgente)

- **Medido:** el «MaKo» del escritorio de Martín es una app web de Chrome instalada el 26/08 en el perfil de Chrome de Mauricio
  («Profile 9», el de su cuenta de trabajo), con la sesión de ese perfil. No es `mako-pc` ni el emparejamiento: el token de la PC no
  es una sesión (`tests/ia-pc-nunca-sesion.test.ts`). Detalle: docs/hallazgos-seguridad.md.
- **Arreglado (tanda 2):** cada ventana nueva de la app pide el login de la persona (`PuertaDeLaApp`, `/login?app=1`, la sesión con
  `iat`). Le llega a lo ya instalado con el deploy de la web, sin reinstalar nada, y cerrar sesión no toca la PC conectada.
- **De Martín:** desinstalar esa app del perfil de Mauricio (clic derecho en el ícono › Desinstalar) o, si la quiere, entrar con
  su cuenta cuando la app la pida.

## Tanda 3d de docs/conexiones-y-ayuda.md (25/10, con «MaKo en WhatsApp: conexiones»)

- **Hecho:** `?abrir=ia` abre «Tus cuentas de IA» (`TarjetaTusCuentasIA`; `ABRIR_IA`, `LINK_TUS_CUENTAS_IA`; 'ia' en
  `SIN_MODAL_SUELTO`). `/perfil/ia` sigue igual. `app=1` sobrevive al login nuevo (`pideLaApp`).
- **La API de MaKo** (regla de Martín del 25/10: leer Y cambiar):
  - leer el estado de la computadora va en `ver_ia_del_negocio`, que declara «MaKo en WhatsApp» (tanda 2);
  - `desconectar_computadora` (confirmación `chat`; el admin o el dueño de esa PC) queda para declarar encima de esa tanda, para
    no pisar `integraciones.def/run`, la referencia y el snapshot. Coordinado por mensaje, sin respuesta todavía;
  - conectar NO va por la API: pide a la persona frente a su PC y que acepte el texto. El login, el 2FA, el instalador y la firma
    tampoco: son entrar y armar el programa, no algo que el negocio hace.
- **Sin hacer:** la puerta de la PC para el grupo de WhatsApp del dueño (punto 2, `encolarTurno`), cuando escriba ese chat.

## Lo de Martín: qué comprar y qué hacer para que no salga «no es seguro»

Lo hace él (nosotros nunca cargamos tarjetas, documentos ni claves). Los pasos exactos, en el plan: «Firmar: lo que hace Martín»
y «Firmar la Mac: lo que hace Martín». En corto:

1. **Windows — SSL.com «IV Code Signing», a su nombre** (US$129 el año) **+ eSigner Tier 1** (US$180 el año con 240 firmas, o
   US$20 por mes con 20; los primeros 30 días gratis). En https://secure.ssl.com/certificates/iv-codesigning/buy. NO el token
   USB (no firma desde un script) y NO un EV (desde 2024 no acelera nada).
   - Validación: **el DNI** (frente y dorso; el pasaporte no trae domicilio, que piden), una **selfie con el DNI en la mano** y
     una llamada de confirmación. Tarda 3 a 5 días hábiles.
   - eSigner: PIN de 4 dígitos y el **QR con una app de autenticación** (no SMS). Copiar el «secret code» que sale al lado: se ve
     UNA vez.
   - CodeSignTool en `C:\herramientas\CodeSignTool` y el archivo `C:\Users\marti\.mako-firma.env` (fuera de OneDrive) con
     `CODESIGNTOOL`, `SSL_COM_USUARIO`, `SSL_COM_CLAVE`, `SSL_COM_TOTP`. Después, avisarle al Cerebro.
2. **Mac — Apple Developer Program individual** (US$99 el año, con su tarjeta y su nombre legal; 24-48 h, a veces semanas).
   Después, el certificado «Developer ID Application» (con el pedido que arma `firmar-mac.mjs pedido`) y la clave de App Store
   Connect para notarizar (el .p8, el Key ID y el Issuer ID). rcodesign en `C:\herramientas\rcodesign`.
3. **Cuando esté firmado y SmartScreen siga avisando:** mandar el instalador a https://www.microsoft.com/wdsi/filesubmission
   como desarrollador, producto «Microsoft Defender SmartScreen». La reputación igual tarda semanas: la firma cambia el cartel
   a «Editor: Martín Koncke» desde el primer día y destraba Smart App Control, pero no lo saca enseguida.

## Publicar (el Cerebro; nada de esto lo hace este chat)

La 0.4.3 junta esto con lo de la llamada con Leandro (el acceso «MaKo» y «¿Otra cuenta de Claude?"). **Primero el bucket,
después el deploy:** `VERSION_PC` arma el nombre de lo que se baja.

1. En la rama: `VERSION` (`scripts/ia-pc/mako-pc.mjs`) y `VERSION_PC` (`lib/ia-pc-reglas.ts`) a `0.4.3`, y los tests que dicen
   `0.4.2` (`tests/ia-pc-instalador-040.test.ts` → 2, y los que salgan con `grep -rn "0\.4\.2" tests`).
2. Desde la raíz del worktree: `npx tsx --conditions=react-server scripts/ia-pc/publicar-binarios.mts --env <.env.local del clon>`
   (en seco: arma todo y dice qué falta). Con la firma cargada: sumar `--probar-firma` (gasta 2 firmas).
3. Con el OK de Martín: lo mismo con `--aplicar`. Firma (si está el archivo), verifica, sube y comprueba que cada archivo se baje.
4. `verificar-binarios` en verde → deploy. Para firmar una versión ya publicada sin firma: volver a correr el 3 con la misma
   versión (reemplaza los archivos).

## Pendiente, con su archivo

- **Nada se probó en una PC de verdad**: el asistente nuevo se miró en la vista (`/DVista`), no instalando; el botón que abre la
  app se miró con la API simulada; las ventanas de la Mac con el ícono, en ninguna Mac (`dialogoMac` cae al genérico si falla).
- El ícono del programa (`mako-pc.exe`): el de Bun. `bun build --windows-icon` sin probar (`publicar-binarios.mts`).
- Un `.dmg` con fondo y que el `mako://` le llegue a MaKo.app (hace falta un ejecutable que reciba el Apple Event).
- La Microsoft Store como segundo canal sin SmartScreen.

## P3 de docs/pendientes.md: alcance (sin empezar)

«Login en el navegador de la app + app de escritorio con todas las tabs + Mac y Linux» (f04 de la llamada del 24/10: «es
básicamente duplicar la aplicación en una aplicación desktop»). No es `mako-pc`: es MaKo entero en una ventana propia.
- **Qué es:** una ventana que carga hola-mako.com (todas las tabs), con su ícono, que se instala con el MISMO asistente y abre
  `mako-pc` por detrás. Candidatos: Tauri 2 (usa el WebView del sistema: WebView2 en Windows, WKWebView en la Mac, WebKitGTK en
  Linux; instaladores de pocos MB) o Electron (Chromium entero, ~100 MB). Se decide copiando una app que lo haga (Linear,
  Notion o Figma de escritorio).
- **La trampa conocida:** Google bloquea su login dentro de un WebView embebido («disallowed_useragent»). «Continuar con Google»
  tiene que abrir el navegador del sistema y volver a la app con un enlace (el `mako://` que ya existe), como hacen Slack y
  Notion. Ésa es la mitad «login en el navegador» del pedido.
- **Mac y Linux:** la Mac ya tiene MaKo.app (sin ventana); Linux no tiene nada. Firmar Linux no aplica; un AppImage o un .deb.
- Es trabajo de varios días y pide decisiones de Martín (qué hace la ventana con las notificaciones, si reemplaza al
  navegador). No se empezó: este chat cerró lo pedido el 25/10.
