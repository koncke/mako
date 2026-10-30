; =============================================================================
; MaKo en tu computadora — el instalador de Windows (docs/plan-instalador-escritorio.md, la parte 2; 0.4.0, 23/10/2026)
; =============================================================================
; Martín: «que sea una app de escritorio con el típico panel de "avanzar"». Inno Setup 6: Siguiente › Instalar › Finalizar, en
; español, POR USUARIO (sin pedir administrador), en la misma carpeta que usa el instalador de consola de hoy
; (%LOCALAPPDATA%\MaKo, así reemplaza a ése), con su desinstalador.
;   · registra los enlaces mako:// (HKCU\Software\Classes\mako): «Conectar mi computadora» abre la app con el código;
;   · deja la app arrancando al prender la computadora (la misma clave Run «MaKo» de hoy);
;   · instala Claude Code si no está, con el instalador OFICIAL y sin ventana (a probar: la doc no dice si anda oculto);
;   · al terminar arranca la app (si ya estaba conectada, sigue conectada) y «Conectar con MaKo» abre «Tus cuentas de IA»
;     directo en «Conecta MaKo» (RUTA_TRAS_INSTALAR, lib/ia-pc-reglas.ts), que abre el enlace mako://conectar con su código.
; Lo arma scripts/ia-pc/publicar-binarios.mts (Inno Setup 6.7 en esta PC: winget install --id JRSoftware.InnoSetup -e --scope user).
; Se arma con: ISCC.exe /DAppVersion=<VERSION_PC> /DPrograma=<ruta de mako-pc.exe> mako.iss
; ⚠️ SIN FIRMA, Windows muestra «Windows protegió su PC» (Más información → Ejecutar de todas formas). La firma (SSL.com IV a
; nombre de Martín) la pone publicar-binarios DESPUÉS de armar esto: docs/plan-instalador-escritorio.md › Firmar.
;
; CON EL DISEÑO DE MAKO (25/10/2026, Martín: «el instalador de MaKo debe estar personalizado con el diseño de mako»). Copia la
; estructura de VS Code, que también es Inno Setup (microsoft/vscode, build/win32/code.iss): WizardStyle=modern, la imagen
; grande a la izquierda de la bienvenida y del final, la chica arriba a la derecha, cada una en los siete tamaños de pantalla, y
; el ícono propio en el instalador, en el desinstalador y en los accesos. Las imágenes salen de la marca con
; scripts/ia-pc/marca.mjs (la criatura de MaKo y el logo) y viven en installer/marca/.
; Lo que NO se copia de VS Code: la licencia, la carpeta, el grupo del menú y las tareas. MaKo no tiene nada que elegir, así
; que son DOS toques: la bienvenida (con «Instalar») y el final (con «Conectar con MaKo» marcado).
; Los textos van en tú y cortos (la regla de la pantalla: AGENTS.md): el Spanish.isl de fábrica habla de usted y explica de más.
; `dynamic`: claro u oscuro según Windows, como MaKo. Las imágenes son oscuras (el fondo del logo) y se ven bien en los dos.
; =============================================================================

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef Programa
  #define Programa "mako-pc.exe"
#endif
#define Marca "..\marca"
; El estilo: el de siempre, o el oscuro para mirarlo (/DEstilo="modern dark", scripts/ia-pc/vista-instalador.ps1).
#ifndef Estilo
  #define Estilo "modern dynamic"
#endif

[Setup]
AppId={{8C7C2A6E-6B2B-4C1E-9F7B-6D9E0B6A4F11}
AppName=MaKo
AppVersion={#AppVersion}
AppVerName=MaKo {#AppVersion}
AppPublisher=MaKo
AppPublisherURL=https://hola-mako.com
DefaultDirName={localappdata}\MaKo
DisableDirPage=yes
DisableProgramGroupPage=yes
; La bienvenida es la página de la marca (la imagen grande), y su botón ya dice «Instalar»: sin la página «Listo para instalar».
DisableWelcomePage=no
DisableReadyPage=yes
PrivilegesRequired=lowest
OutputBaseFilename=MaKo-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle={#Estilo}
WizardImageFile={#Marca}\asistente-202.png,{#Marca}\asistente-269.png,{#Marca}\asistente-336.png,{#Marca}\asistente-403.png,{#Marca}\asistente-430.png,{#Marca}\asistente-498.png,{#Marca}\asistente-534.png
WizardSmallImageFile={#Marca}\logo-58.png,{#Marca}\logo-77.png,{#Marca}\logo-97.png,{#Marca}\logo-116.png,{#Marca}\logo-124.png,{#Marca}\logo-143.png,{#Marca}\logo-159.png
SetupIconFile={#Marca}\mako.ico
UninstallDisplayIcon={app}\mako.ico
; En modo 64 bits (revisión de la 0.4.0, 23/10/2026): el Setup de Inno es de 32 bits, y sin esto `powershell.exe` salía de
; SysWOW64. El instalador de Claude Code corta con «does not support 32-bit Windows» si el proceso no es de 64 bits (medido el
; 23/10/2026: install.ps1 mira [Environment]::Is64BitProcess), y fallaba OCULTO. El programa también es x64.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=MaKo
CloseApplications=force
; VISTA PREVIA (/DVista, scripts/ia-pc/vista-instalador.ps1): las mismas páginas, imágenes y textos SIN instalar nada (ni
; archivos, ni registro, ni accesos, ni programas). Para mirar el asistente en esta PC, donde corre la computadora del ws1.
#ifdef Vista
CreateAppDir=no
Uninstallable=no
#endif

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
es.SetupWindowTitle=Instalar MaKo
es.UninstallAppFullTitle=Desinstalar MaKo
es.WelcomeLabel1=MaKo, en tu computadora
es.WelcomeLabel2=Tu Ops Center va a contestar con tu Claude, desde esta computadora.%n%nSi no tienes Claude Code, también lo instala.
es.WizardInstalling=Instalando MaKo
es.InstallingLabel=Tarda un minuto.
es.FinishedHeadingLabel=¡Listo!
es.FinishedLabelNoIcons=MaKo quedó instalado. Ahora conéctalo a tu negocio.
es.FinishedLabel=MaKo quedó instalado. Ahora conéctalo a tu negocio.
es.ClickFinish=
es.ClickNext=
es.ExitSetupTitle=Salir
es.ExitSetupMessage=MaKo no quedó instalado. ¿Salir igual?
es.SetupAlreadyRunning=El instalador de MaKo ya está abierto.
es.WizardPreparing=Preparando
es.PreparingDesc=Cierro MaKo para actualizarlo.
es.ApplicationsFound=MaKo está abierto: lo cierro y lo vuelvo a abrir al terminar.
es.ApplicationsFound2=MaKo está abierto: lo cierro y lo vuelvo a abrir al terminar.
es.StatusClosingApplications=Cerrando MaKo…
es.StatusRunProgram=Terminando…
es.ConfirmUninstall=¿Desinstalar MaKo? Tu computadora deja de contestar en tu Ops Center.
es.UninstallStatusLabel=Desinstalando MaKo…
es.UninstalledAll=MaKo se desinstaló.

#ifndef Vista
[Files]
Source: "{#Programa}"; DestDir: "{app}"; DestName: "mako-pc.exe"; Flags: ignoreversion
; El ícono de MaKo: lo usan los accesos y «Aplicaciones instaladas» (el programa, armado con Bun, trae el genérico).
Source: "{#Marca}\mako.ico"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
; Los enlaces mako:// → la app, con el enlace como argumento (scripts/ia-pc/mako-pc.mjs → conectarDesdeEnlace).
Root: HKCU; Subkey: "Software\Classes\mako"; ValueType: string; ValueName: ""; ValueData: "URL:MaKo"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\mako"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\mako\DefaultIcon"; ValueType: string; ValueName: ""; ValueData: """{app}\mako.ico"""
Root: HKCU; Subkey: "Software\Classes\mako\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\mako-pc.exe"" ""%1"""
; Arranca sola al prender la computadora (la misma clave que el instalador de consola).
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MaKo"; ValueData: """{app}\mako-pc.exe"""; Flags: uninsdeletevalue

; «¿Cómo abro MaKo?» (25/10/2026, la llamada con Leandro, f02): el programa corre escondido, y sin un acceso no había nada que
; abrir. «MaKo» en el menú Inicio y en el escritorio corre `mako-pc abrir`: MaKo en el navegador (el Ops Center, o conectar).
[Icons]
Name: "{userprograms}\MaKo"; Filename: "{app}\mako-pc.exe"; Parameters: "abrir"; IconFilename: "{app}\mako.ico"; Comment: "Abrir MaKo"
Name: "{userdesktop}\MaKo"; Filename: "{app}\mako-pc.exe"; Parameters: "abrir"; IconFilename: "{app}\mako.ico"; Comment: "Abrir MaKo"

#endif

[Run]
#ifndef Vista
; Claude Code, si no está: el instalador oficial (code.claude.com/docs/en/setup), sin ventana. Lo corre el instalador, nunca la
; persona. A PROBAR en una computadora de verdad: la doc no dice si anda oculto.
; La app, de nuevo en marcha PRIMERO: al actualizar, el instalador la cerró (CloseApplications), y si instalar Claude Code
; tarda, la PC no queda sin conexión mientras tanto. Sin conexión guardada, sale sola; sin Claude todavía, lo busca en cada latido.
Filename: "{app}\mako-pc.exe"; Flags: nowait
; Sin la barra de progreso (en Windows PowerShell 5.1 la bajada tardaba 58,6 s en vez de 4,1: AGENTS.md), sin preguntar nada
; (-NonInteractive: oculto, una pregunta lo dejaba esperando para siempre) y con el PowerShell de 64 bits.
Filename: "powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$ProgressPreference = 'SilentlyContinue'; if (-not (Test-Path ([Environment]::GetFolderPath('UserProfile') + '\.local\bin\claude.exe'))) {{ irm https://claude.ai/install.ps1 | iex }"""; StatusMsg: "Instalando Claude Code…"; Flags: runhidden waituntilterminated 64bit
#endif
; Al terminar: «Tus cuentas de IA», directo en «Conecta MaKo» (RUTA_TRAS_INSTALAR). Marcado: es lo que sigue.
Filename: "https://hola-mako.com/perfil/ia?computadora=1"; Description: "Conectar con MaKo"; Flags: postinstall shellexec nowait

[Code]
// La bienvenida es la última página antes de instalar (sin «Listo para instalar»): su botón dice «Instalar». Inno no lo cambia
// solo (la ayuda de DisableReadyPage).
procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpWelcome then
    WizardForm.NextButton.Caption := SetupMessage(msgButtonInstall);
end;

#ifndef Vista
[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM mako-pc.exe"; Flags: runhidden; RunOnceId: "CerrarMaKo"
#endif
