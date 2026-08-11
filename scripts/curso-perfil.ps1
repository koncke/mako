# Abre un Chrome DEDICADO para bajar cursos: perfil aparte + CDP encendido.
#
# Por que un perfil aparte y no el tuyo (medido 2026-08-11, ver
# docs/hallazgos-conocimiento.md):
#   1. El perfil por defecto escribe cookies v20 (App-Bound Encryption) y yt-dlp
#      solo sabe leer v10/DPAPI -> "Extracted 0 cookies", sin fallar.
#      Un --user-data-dir NO estandar no recibe ABE: escribe v10 y yt-dlp las lee.
#   2. Desde Chrome 136 --remote-debugging-port se IGNORA sobre el directorio por
#      defecto. Exige un --user-data-dir no estandar. El mismo flag arregla las dos.
#   3. Tu Chrome de siempre queda intacto: no le cerramos las pestañas.
#
# Se loguea UNA vez a mano aca. La sesion queda en el perfil y sobrevive reinicios.
#
#   powershell -File scripts/curso-perfil.ps1 -Url https://cursoselite.com.mx/

param(
  [string]$Url  = 'https://cursoselite.com.mx/',
  [int]   $Port = 9333,
  [string]$Raiz = 'C:\cursos'
)

$ErrorActionPreference = 'Stop'

$perfil = Join-Path $Raiz 'perfil'
$chrome = Join-Path $env:PROGRAMFILES 'Google\Chrome\Application\chrome.exe'

if (-not (Test-Path $chrome)) { throw "No encuentro Chrome en $chrome" }
if (-not (Test-Path $perfil)) { New-Item -ItemType Directory -Force -Path $perfil | Out-Null }

# Ya esta escuchando? No relanzar: abrir otra instancia sobre el mismo
# user-data-dir hace que el singleton de Windows reenvie la linea de comandos y
# el proceso muera, DESCARTANDO los flags. Se veria como "CDP no anda".
$vivo = $false
try {
  $v = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 2
  $vivo = $true
  Write-Output "Ya hay un Chrome escuchando en $Port -> $($v.Browser)"
} catch { }

if (-not $vivo) {
  # --user-data-dir va entre comillas por si $Raiz tiene espacios.
  # OJO: la variable NO se puede llamar $args — es automática de PowerShell.
  $flags = @(
    "--user-data-dir=`"$perfil`"",
    "--remote-debugging-port=$Port",
    '--no-first-run',
    '--no-default-browser-check',
    $Url
  )
  Start-Process -FilePath $chrome -ArgumentList $flags | Out-Null
  Write-Output "Chrome dedicado lanzado (perfil: $perfil, CDP: $Port)"

  # Esperar a que CDP conteste, sin dormir a ciegas.
  $ok = $false
  foreach ($i in 1..30) {
    try {
      $v = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 1
      Write-Output "CDP arriba: $($v.Browser)"
      $ok = $true
      break
    } catch { Start-Sleep -Milliseconds 400 }
  }
  if (-not $ok) { throw "CDP no contesto en $Port. Verifica que no quede otro chrome.exe sobre $perfil." }
}

# OJO: /json/version devuelve webSocketDebuggerUrl, NO webSocketDebuggerVersion.
# Pedir el campo equivocado imprime vacio y parece que CDP fallo cuando anda.
$v = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version"
Write-Output ""
Write-Output "  Browser : $($v.Browser)"
Write-Output "  WS      : $($v.webSocketDebuggerUrl)"
Write-Output "  Cookies : $perfil\Default\Network\Cookies  (v10, legibles por yt-dlp)"
Write-Output ""
Write-Output "AHORA, a mano en esa ventana:"
Write-Output "  1. Login con tu cuenta (una sola vez; la sesion queda en el perfil)."
Write-Output "  2. Abri UNA leccion y dale play unos segundos."
Write-Output "  3. Volve aca y corre:  node scripts/curso-sniff.mjs"
