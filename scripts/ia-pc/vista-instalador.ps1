# =============================================================================
# vista-instalador — fotos del asistente de Windows SIN instalarlo (25/10/2026)
# =============================================================================
# El instalador de verdad NO se corre en esta PC: acá corre la computadora del ws1, y el instalador cierra mako-pc.exe
# (CloseApplications=force) y toca el registro. Esto arma installer/windows/mako.iss con /DVista (las mismas páginas, imágenes
# y textos, sin archivos, registro, accesos ni programas), lo abre FUERA de la pantalla, saca una foto de la bienvenida y del
# final con PrintWindow, y lo cierra sin tocar «Finalizar».
# Uso:  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ia-pc/vista-instalador.ps1 [-Salida <carpeta>] [-Oscuro]
# =============================================================================
param([string]$Salida = (Join-Path $env:TEMP 'mako-vista-instalador'), [switch]$Oscuro)
$ErrorActionPreference = 'Stop'
$repo = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$iscc = if ($env:ISCC) { $env:ISCC } else { Join-Path $env:LOCALAPPDATA 'Programs\Inno Setup 6\ISCC.exe' }
New-Item -ItemType Directory -Force $Salida | Out-Null
$estilo = if ($Oscuro) { 'modern dark' } else { 'modern light' }
& $iscc /Q /DVista /DAppVersion=0.0.0 "/DEstilo=$estilo" "/O$Salida" "/FMaKo-Vista" (Join-Path $repo 'installer\windows\mako.iss')
if ($LASTEXITCODE -ne 0) { throw "ISCC salió con $LASTEXITCODE" }

Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Text; using System.Runtime.InteropServices; using System.Collections.Generic;
public static class Ventana {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string t);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public delegate bool Cada(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr p, Cada f, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  public static IntPtr Boton(IntPtr padre, string texto) {
    IntPtr hallado = IntPtr.Zero;
    EnumChildWindows(padre, (h, l) => {
      var s = new StringBuilder(256); GetWindowText(h, s, 256);
      var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (IsWindowVisible(h) && c.ToString().Contains("Button") && s.ToString().Replace("&", "") == texto) { hallado = h; return false; }
      return true;
    }, IntPtr.Zero);
    return hallado;
  }
}
'@ -ReferencedAssemblies System.Drawing

# Con la escala de Windows (125 %, 150 %), sin esto GetWindowRect da el tamaño escalado y la foto sale recortada.
[Ventana]::SetProcessDPIAware() | Out-Null

function Foto([IntPtr]$h, [string]$archivo) {
  $r = New-Object Ventana+RECT; [Ventana]::GetWindowRect($h, [ref]$r) | Out-Null
  $bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
  $g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
  [Ventana]::PrintWindow($h, $dc, 2) | Out-Null   # PW_RENDERFULLCONTENT: anda con la ventana fuera de la pantalla
  $g.ReleaseHdc($dc); $g.Dispose(); $bmp.Save($archivo, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  Write-Output "  foto: $archivo"
}

$p = Start-Process -FilePath (Join-Path $Salida 'MaKo-Vista.exe') -PassThru
try {
  $h = [IntPtr]::Zero
  # ([NullString]::Value: PowerShell le pasa "" a un string $null, y FindWindow con clase "" no encuentra nada.)
  for ($i = 0; $i -lt 100 -and $h -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100; $h = [Ventana]::FindWindow([NullString]::Value, 'Instalar MaKo') }
  if ($h -eq [IntPtr]::Zero) { throw 'no apareció la ventana «Instalar MaKo»' }
  [Ventana]::SetWindowPos($h, [IntPtr]::Zero, -32000, -32000, 0, 0, 0x0001 -bor 0x0010) | Out-Null  # SWP_NOSIZE | SWP_NOACTIVATE
  Start-Sleep -Milliseconds 700
  $sufijo = if ($Oscuro) { '-oscuro' } else { '' }
  Foto $h (Join-Path $Salida "1-bienvenida$sufijo.png")
  $instalar = [Ventana]::Boton($h, 'Instalar')
  if ($instalar -eq [IntPtr]::Zero) { throw 'la bienvenida no tiene el botón «Instalar»' }
  [Ventana]::SendMessage($instalar, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null  # BM_CLICK
  for ($i = 0; $i -lt 100 -and [Ventana]::Boton($h, 'Finalizar') -eq [IntPtr]::Zero; $i++) { Start-Sleep -Milliseconds 100 }
  Start-Sleep -Milliseconds 700
  Foto $h (Join-Path $Salida "2-final$sufijo.png")
} finally {
  # Sin tocar «Finalizar» (abriría MaKo en el navegador): se cierran el cargador y el asistente (el .tmp que lanza).
  Get-Process | Where-Object { $_.ProcessName -like 'MaKo-Vista*' } | Stop-Process -Force -ErrorAction SilentlyContinue
  if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
}
