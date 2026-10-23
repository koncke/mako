# MaKo en tu computadora, sin PowerShell: el instalador de escritorio (plan, 22/10/2026)

Martín, textual: «el proceso de instalación jamás sea por Powershell, ni siquiera que se tenga que abrir, que sea una app de
escritorio con el típico panel de "avanzar"... Que al darle conectar si no tenes instalada la app, te deje descargarla. Que
sea fácil para el usuario».

## Hoy

«Conectar mi computadora» (app/integraciones/TusCuentasIA.tsx) son cuatro pasos y **tres son pegar una línea en una
terminal**: instalar Claude Code, iniciar sesión en Claude y conectar MaKo (`/api/ia-pc/instalar`, un script de PowerShell o de
bash que baja `mako-pc`, lo empareja con un código, pregunta «¿Es tu negocio?» en la consola y lo deja arrancando solo).

## Cómo queda (lo que ve la persona)

1. **«Conectar mi computadora»** abre MaKo con un enlace `mako://conectar?codigo=…`. Si la app está instalada, se abre sola.
   Si no se abre en un par de segundos, la pantalla ofrece **«Descargar MaKo para Windows»** (o para Mac).
2. **El instalador** es el de siempre: Siguiente › Instalar › Finalizar. Sin pedir permisos de administrador. Instala MaKo,
   lo deja arrancando al prender la computadora y registra los enlaces `mako://`. Al terminar, «Conectar con MaKo» abre la
   página de MaKo, que vuelve a abrir el enlace con un código nuevo.
3. **La app pregunta, en una ventana de Windows o de Mac** (no en una consola): «¿Conectar esta computadora a «Negocio» como
   Persona?». Sí: queda conectada y arrancando. No: no se toca nada.
4. **La pantalla espera sola** a que la computadora aparezca «En línea» (como hoy, el paso 4).

## Decisiones (con su porqué)

- **Windows: Inno Setup** (gratis, el asistente de siempre en español, instala por usuario sin pedir administrador, registra
  el `mako://` y el arranque, y trae su desinstalador). Descartados: NSIS (lo mismo con más trabajo), MSI/WiX (pensado para
  empresas, pide administrador), Electron o Tauri (cientos de MB para una app que no tiene pantalla).
- **Mac: un `.pkg`** (pkgbuild/productbuild: Continuar › Instalar › Cerrar), con una `MaKo.app` que declara el `mako://` y el
  LaunchAgent de hoy. Se arma en una Mac (o en un runner de macOS de GitHub).
- **El enlace no puede elegir el servidor.** Cualquier página puede abrir un `mako://`: si el enlace trajera el servidor, un
  sitio malicioso se llevaría la computadora (y la suscripción de Claude de la persona) a su MaKo. La app usa siempre el suyo,
  y la ventana dice a qué negocio y como quién se conecta, igual que el «¿Es tu negocio?» de hoy.
- **La ventana de confirmación es del sistema, sin consola:** en Windows, `MessageBoxW` de user32 (desde la app, con
  `bun:ffi`); en la Mac, `osascript` (`display dialog`).
- **Detectar si la app está:** el navegador no puede preguntarlo. Se intenta el enlace y, si la página no pierde el foco en
  ~2 s, se ofrece la descarga. Si la persona ya tiene una computadora conectada, se sabe que la app está.
- **La línea de PowerShell queda como «Avanzado»** mientras el instalador se prueba con clientes.

## Claude Code sin terminal (lo que dice la doc oficial, leída el 22/10/2026)

- **Instalar:** el método oficial es el script (`irm https://claude.ai/install.ps1 | iex`; en la Mac, `install.sh`), sin
  administrador; queda en `%USERPROFILE%\.local\bin\claude.exe`. También `winget install Anthropic.ClaudeCode` (no se
  actualiza solo). Que el script ande OCULTO desde otro instalador no está confirmado: se prueba en una computadora de verdad.
- **Iniciar sesión:** `claude auth login` es el flujo de Anthropic (abre el navegador). La doc lo describe en una terminal
  (al final pide Enter); que ande sin ventana no está confirmado. La app lo abre por la persona; nunca se escribe nada.
- **Saber si hay sesión, sin gastar:** `claude auth status` sale 0 con sesión y 1 sin ella (JSON con `authMethod`).
- **Nunca `claude setup-token` para MaKo:** imprime un token de un año, y la doc dice que un tercero no puede «collect, store,
  or intermediate Claude.ai credentials or session tokens». La sesión queda en Claude Code, como hoy.
- **⚠️ Para Martín, los términos de Anthropic** (code.claude.com/docs/en/legal-and-compliance): no permiten que un tercero
  «route requests through Free, Pro, or Max plan credentials on behalf of their users», y excluyen al usuario que entra «with
  their own Claude subscription» en el Claude Code sin modificar. La doc no dice de qué lado cae MaKo en la PC del cliente y
  manda a preguntar a ventas. Es la decisión D6a de siempre; el instalador sólo la hace más fácil.

## Lo que cuesta plata (lo decide Martín)

- **Firmar el instalador de Windows: DECIDIDO el 23/10, SSL.com IV a nombre de Martín.** No hay empresa registrada, y
  Azure Artifact Signing sólo acepta empresas de algunos países. Cuesta unos US$309 el primer año: el certificado US$129 por
  año y la firma en la nube (eSigner, plan 1) US$180 por año, con 240 firmas (cada versión gasta 2). Sin firma, Windows
  muestra «Windows protegió su PC» (anda con «Más información → Ejecutar de todas formas», pero asusta). Lo que hace Martín
  está en «Firmar: lo que hace Martín», abajo.
- **Firmar y notarizar la app de la Mac.** Sin eso, macOS no la deja abrir (hay que ir a Ajustes › Privacidad y seguridad ›
  «Abrir igual»). **DECIDIDO el 23/10: Apple Developer individual a nombre de Martín (US$99 por año)**, la misma cuenta de
  las tiendas (los pasos del alta, en la nota tiendas-pasos-de-martin-2310.md). Hasta que tenga el certificado, la Mac sale
  sin firmar, con esa línea en la pantalla. Lo que hace Martín está en «Firmar la Mac: lo que hace Martín», abajo.

## Firmar: lo que hace Martín (SSL.com IV + eSigner)

Lo compra y lo valida Martín: nosotros no cargamos tarjetas, documentos ni claves. Los precios se confirman en el carrito
(consultados el 23/10/2026).

1. **Comprar.** En ssl.com › Code Signing, el certificado **«IV Code Signing»** (Individual Validation, a su nombre), por
   1 año. Sumar **eSigner**, la firma en la nube, en el plan **Tier 1 anual** (240 firmas). El token USB no sirve: no
   firma desde un script. Los primeros 30 días de eSigner son gratis.
2. **Validar la identidad.** En el pedido (ssl.com › Dashboard › Orders), subir:
   - un documento con foto vigente (DNI o pasaporte), **frente y dorso**;
   - una **selfie con el documento en la mano**, con la cara y los datos legibles.
   Si SSL.com pide algo más (una llamada, otro dato), lo contesta Martín.
3. **Activar eSigner**, cuando el pedido diga «eSigner Ready»:
   - crear un **PIN de 4 dígitos**;
   - elegir el código **QR**, con una app de autenticación (no SMS: el SMS no sirve para firmar desde un script).
   El QR aparece **una sola vez**. Hay que escanearlo con la app Y copiar el **«secret code»** que sale al lado (es el
   secreto TOTP). El PIN y el secret code van a su gestor de contraseñas.
4. **Bajar CodeSignTool** (gratis): el .zip para Windows de ssl.com (trae su propio Java), descomprimido en una carpeta, por
   ejemplo `C:\herramientas\CodeSignTool`.
5. **Dejar las claves en esta PC.** Martín crea el archivo `C:\Users\marti\.mako-firma.env`. Va fuera de OneDrive y NUNCA
   en el `.env.local` del clon: el Escritorio está en OneDrive, que lo sube a la nube, y `publicar-binarios` corta si las
   encuentra ahí. El archivo:
   ```
   CODESIGNTOOL=C:\herramientas\CodeSignTool
   SSL_COM_USUARIO=<el usuario de ssl.com>
   SSL_COM_CLAVE=<la contraseña de ssl.com>
   SSL_COM_TOTP=<el secret code del paso 3>
   ```
   Si la cuenta tiene más de un certificado, también `SSL_COM_CREDENCIAL=<el id>`. El id sale de
   `CodeSignTool get_credential_ids`.
6. **Avisar al Cerebro.** De ahí en más, del lado nuestro:
   - `publicar-binarios --probar-firma` en seco firma sin subir nada (gasta 2 firmas);
   - con el OK de Martín, `--aplicar` firma el programa y el instalador antes de subirlos;
   - si la firma falla, no sube nada.
   Para comprobarlo: clic derecho en `MaKo-Setup-<versión>.exe` › Propiedades › Firmas digitales tiene que decir «Martín
   Koncke», con marca de tiempo.

El aviso de SmartScreen no se va enseguida: Windows arma la reputación con semanas de instalaciones limpias.

## Firmar la Mac: lo que hace Martín (Apple Developer, Developer ID y notarización)

Firmada y notarizada, macOS abre MaKo.app con un «¿Abrirla?» común, sin pasar por Ajustes. Se firma DESDE ESTA PC con
rcodesign, sin una Mac: lo único que hace falta de Apple es el certificado y una clave para notarizar. Las dos se sacan con
la cuenta de Martín, y nosotros no cargamos tarjetas, documentos ni claves.

1. **El alta en Apple Developer**, como persona: los pasos están en la nota tiendas-pasos-de-martin-2310.md (Chats de las
   tabs). Sólo el titular de la cuenta (él) puede pedir un certificado Developer ID.
2. **Bajar rcodesign** (gratis, código abierto): en github.com/indygreg/apple-platform-rs/releases, la versión
   **apple-codesign 0.29.0**, el archivo `apple-codesign-0.29.0-x86_64-pc-windows-msvc.zip` (8,5 MB). Descomprimirlo, por
   ejemplo en `C:\herramientas\rcodesign`, y sumar al archivo de la firma (`C:\Users\marti\.mako-firma.env`, el mismo de
   Windows) la línea `RCODESIGN=C:\herramientas\rcodesign\rcodesign.exe`.
3. **Avisar al Cerebro.** Corremos `node scripts/ia-pc/firmar-mac.mjs pedido`. Arma la clave (queda en esta PC, en
   `C:\Users\marti\.mako-firma-mac`, fuera de OneDrive) y el pedido del certificado, `developer-id.csr`, en esa carpeta.
4. **El certificado.** En developer.apple.com/account/resources/certificates/add:
   - elegir «Developer ID Application» › Continue;
   - Profile Type «G2 Sub-CA (Xcode 11.4.1 or later)»;
   - subir `developer-id.csr` › Continue › Download.
   El archivo que baja, `developerID_application.cer`, va a `C:\Users\marti\.mako-firma-mac`.
5. **La clave para notarizar.** En appstoreconnect.apple.com › Usuarios y acceso › Integraciones › App Store Connect API:
   - la primera vez, «Solicitar acceso» (Apple lo aprueba);
   - en Claves del equipo, «+»: nombre «MaKo notarización», acceso **Developer** › Generar;
   - «Descargar clave»: el archivo `AuthKey_XXXX.p8` se baja **una sola vez**. Anotar el **Key ID** y el **Issuer ID**
     (arriba de la lista).
   Es una clave aparte de la de las tiendas (rol App Manager): ésta queda sólo en esta PC, y si hay que revocarla, la otra
   sigue. El .p8 va a `C:\Users\marti\.mako-firma-mac`, y una copia a su gestor de contraseñas.
6. **Avisar al Cerebro** con el Key ID y el Issuer ID (no son secretos; el .p8 sí, nunca en un chat). De ahí en más, del
   lado nuestro:
   - `node scripts/ia-pc/firmar-mac.mjs clave-api <Issuer ID> <Key ID> <ruta del .p8>` arma `api-key.json`;
   - `publicar-binarios --probar-firma` en seco firma y notariza las dos (Windows y Mac) sin subir nada;
   - con el OK de Martín, `--aplicar`;
   - si algo falla, no sube nada.
   Para comprobarlo, en una Mac (la de Mauricio): bajar MaKo para Mac, abrirla y ver que no pida «Abrir igualmente».

Con la app firmada, la pantalla todavía dice la línea de «Abrir igualmente» (`AVISO_GATEKEEPER`). Se saca en la versión que
salga firmada.

## Por partes

1. **La app abre `mako://conectar` y pregunta en una ventana** (scripts/ia-pc/mako-pc.mjs) — HECHO (rama
   instalador-escritorio-2210, tests/ia-pc-enlace.test.ts). La ventana de Windows sale de user32 con `bun:ffi`: probado con
   Bun 1.2.21 sin mostrarla (el texto llega entero en UTF-16). La revisión adversarial (22/10) quedó cerrada: «No» por
   defecto, el cambio de negocio dicho primero, dos enlaces a la vez y la configuración de la 0.2.0 (docs/hallazgos-ia.md).
2. **El instalador de Windows** (installer/windows/mako.iss) — BORRADOR escrito; falta armarlo (Inno Setup no está en esta
   computadora: se instala gratis, o se arma en GitHub Actions, que trae Inno Setup) y sumarlo a `publicar-binarios`.
3. **La pantalla nueva** de «Conectar mi computadora» (abrir, o descargar) y la página que abre el enlace al terminar.
4. **Claude Code sin terminal** (según lo que se mida).
5. **El `.pkg` de la Mac.**
6. **Firmar.** Windows: el lado nuestro está HECHO (rama firma-2310, scripts/ia-pc/firmar-windows.mjs,
   tests/ia-pc-firma.test.ts). Espera el certificado de Martín (los pasos, arriba). La Mac: el lado nuestro también está
   HECHO (scripts/ia-pc/firmar-mac.mjs, tests/ia-pc-firma-mac.test.ts). Espera la cuenta de Apple Developer de Martín.
7. Subir la versión (`VERSION` del programa y `VERSION_PC` juntos, en el commit del instalador: hasta entonces nadie corre
   `publicar-binarios` desde main, que pisaría la 0.3.2; `publicar-binarios --aplicar` con el OK de Martín) y la prueba de punta a punta en una
   computadora de verdad con el ws3.
