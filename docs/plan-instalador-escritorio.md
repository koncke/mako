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

- **Firmar el instalador de Windows.** Sin firma, Windows muestra «Windows protegió su PC» y hay que tocar «Más información
  → Ejecutar de todas formas» (anda, pero asusta). Las opciones, con precios a verificar antes de comprar:
  - Microsoft **Trusted Signing** (Artifact Signing): unos US$10 por mes; pide validar la identidad (empresa o persona) y no
    está disponible en todos los países.
  - Un certificado **OV** de una autoridad (Sectigo, Certum, DigiCert…): unos cientos de dólares por año; la reputación ante
    SmartScreen se gana con las descargas.
- **Firmar y notarizar la app de la Mac.** Sin eso, macOS no la deja abrir (hay que ir a Ajustes › Privacidad y seguridad ›
  «Abrir igual»). Hace falta la cuenta de **Apple Developer** (US$99 por año).

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
6. **Firmar** (con el OK de Martín, si se compra).
7. Subir la versión (`VERSION` del programa y `VERSION_PC` juntos, en el commit del instalador: hasta entonces nadie corre
   `publicar-binarios` desde main, que pisaría la 0.3.2; `publicar-binarios --aplicar` con el OK de Martín) y la prueba de punta a punta en una
   computadora de verdad con el ws3.
