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
; Lo arma scripts/ia-pc/publicar-binarios.mts (Inno Setup 6 en esta PC: winget install --id JRSoftware.InnoSetup -e --scope user).
; Se arma con: ISCC.exe /DAppVersion=<VERSION_PC> /DPrograma=<ruta de mako-pc.exe> mako.iss
; ⚠️ SIN FIRMA, Windows muestra «Windows protegió su PC» (Más información → Ejecutar de todas formas): la firma la decide Martín.
; =============================================================================

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif
#ifndef Programa
  #define Programa "mako-pc.exe"
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
DisableReadyPage=no
PrivilegesRequired=lowest
OutputBaseFilename=MaKo-Setup-{#AppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; En modo 64 bits (revisión de la 0.4.0, 23/10/2026): el Setup de Inno es de 32 bits, y sin esto `powershell.exe` salía de
; SysWOW64. El instalador de Claude Code corta con «does not support 32-bit Windows» si el proceso no es de 64 bits (medido el
; 23/10/2026: install.ps1 mira [Environment]::Is64BitProcess), y fallaba OCULTO. El programa también es x64.
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayName=MaKo
CloseApplications=force

[Languages]
Name: "es"; MessagesFile: "compiler:Languages\Spanish.isl"

[Messages]
es.WelcomeLabel2=Esto instala MaKo en tu computadora, y Claude Code si no lo tienes. Tu Ops Center va a contestar con tu Claude, en esta computadora. Tiene que quedar prendida.

[Files]
Source: "{#Programa}"; DestDir: "{app}"; DestName: "mako-pc.exe"; Flags: ignoreversion

[Registry]
; Los enlaces mako:// → la app, con el enlace como argumento (scripts/ia-pc/mako-pc.mjs → conectarDesdeEnlace).
Root: HKCU; Subkey: "Software\Classes\mako"; ValueType: string; ValueName: ""; ValueData: "URL:MaKo"; Flags: uninsdeletekey
Root: HKCU; Subkey: "Software\Classes\mako"; ValueType: string; ValueName: "URL Protocol"; ValueData: ""
Root: HKCU; Subkey: "Software\Classes\mako\shell\open\command"; ValueType: string; ValueName: ""; ValueData: """{app}\mako-pc.exe"" ""%1"""
; Arranca sola al prender la computadora (la misma clave que el instalador de consola).
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "MaKo"; ValueData: """{app}\mako-pc.exe"""; Flags: uninsdeletevalue

; «¿Cómo abro MaKo?» (25/10/2026, la llamada con Leandro, f02): el programa corre escondido, y sin un acceso no había nada que
; abrir. «MaKo» en el menú Inicio y en el escritorio corre `mako-pc abrir`: MaKo en el navegador (el Ops Center, o conectar).
[Icons]
Name: "{userprograms}\MaKo"; Filename: "{app}\mako-pc.exe"; Parameters: "abrir"; Comment: "Abrir MaKo"
Name: "{userdesktop}\MaKo"; Filename: "{app}\mako-pc.exe"; Parameters: "abrir"; Comment: "Abrir MaKo"

[Run]
; Claude Code, si no está: el instalador oficial (code.claude.com/docs/en/setup), sin ventana. Lo corre el instalador, nunca la
; persona. A PROBAR en una computadora de verdad: la doc no dice si anda oculto.
; La app, de nuevo en marcha PRIMERO: al actualizar, el instalador la cerró (CloseApplications), y si instalar Claude Code
; tarda, la PC no queda sin conexión mientras tanto. Sin conexión guardada, sale sola; sin Claude todavía, lo busca en cada latido.
Filename: "{app}\mako-pc.exe"; Flags: nowait
; Sin la barra de progreso (en Windows PowerShell 5.1 la bajada tardaba 58,6 s en vez de 4,1: AGENTS.md), sin preguntar nada
; (-NonInteractive: oculto, una pregunta lo dejaba esperando para siempre) y con el PowerShell de 64 bits.
Filename: "powershell.exe"; Parameters: "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""$ProgressPreference = 'SilentlyContinue'; if (-not (Test-Path ([Environment]::GetFolderPath('UserProfile') + '\.local\bin\claude.exe'))) {{ irm https://claude.ai/install.ps1 | iex }"""; StatusMsg: "Instalando Claude Code…"; Flags: runhidden waituntilterminated 64bit
; Al terminar: «Tus cuentas de IA», directo en «Conecta MaKo» (RUTA_TRAS_INSTALAR).
Filename: "https://hola-mako.com/perfil/ia?computadora=1"; Description: "Conectar con MaKo"; Flags: postinstall shellexec nowait

[UninstallRun]
Filename: "{sys}\taskkill.exe"; Parameters: "/F /IM mako-pc.exe"; Flags: runhidden; RunOnceId: "CerrarMaKo"
