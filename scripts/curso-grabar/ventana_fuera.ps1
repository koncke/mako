# Deja la ventana de la grabación SIEMPRE ARRIBA pero casi entera FUERA de la pantalla: a la vista queda una columna
# de 1 píxel en el borde izquierdo. Así Chrome no la da por tapada (si otra ventana la cubre entera deja de dibujarla
# y la captura se congela) y Martín usa la PC normal. Windows Graphics Capture captura la ventana entera igual.
#   powershell -File ventana_fuera.ps1 [poner|ver|sacar]
param([string]$accion = 'ver', [string]$titulo = 'MaKo grabando clases')
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public class VF {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint f);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int s);
  public struct RECT { public int L, T, R, B; }
  public static IntPtr Buscar(string t) {
    IntPtr res = IntPtr.Zero;
    EnumWindows((h, l) => { var sb = new StringBuilder(512); GetWindowText(h, sb, 512);
      if (IsWindowVisible(h) && sb.ToString().Contains(t)) { res = h; return false; } return true; }, IntPtr.Zero);
    return res;
  }
}
"@
[VF]::SetProcessDpiAwarenessContext([IntPtr](-4)) | Out-Null   # coordenadas FÍSICAS (pantalla 1920x1080)
$h = [VF]::Buscar($titulo)
if ($h -eq [IntPtr]::Zero) { "no encuentro la ventana '$titulo'"; exit 1 }
function Rects { $r = New-Object VF+RECT; [VF]::GetWindowRect($h, [ref]$r) | Out-Null; $e = New-Object VF+RECT; [VF]::DwmGetWindowAttribute($h, 9, [ref]$e, 16) | Out-Null; ,@($r, $e) }
function Texto { $m = Rects; $r = $m[0]; $e = $m[1]; $ex = [VF]::GetWindowLong($h, -20)
  "hwnd=$h zoom=$([VF]::IsZoomed($h)) min=$([VF]::IsIconic($h)) topmost=$(($ex -band 8) -ne 0) rect=$($r.L),$($r.T),$($r.R),$($r.B) visible=$($e.L),$($e.T),$($e.R),$($e.B)" }
if ($accion -eq 'ver') { Texto; exit 0 }
if ($accion -eq 'sacar') { [VF]::SetWindowPos($h, [IntPtr](-2), 0, 0, 0, 0, 0x13) | Out-Null; [VF]::ShowWindow($h, 3) | Out-Null; Texto; exit 0 }
# poner: restaurar, tamaño fijo y fuera de la pantalla salvo 1 px a la izquierda
if ([VF]::IsZoomed($h) -or [VF]::IsIconic($h)) { [VF]::ShowWindow($h, 9) | Out-Null; Start-Sleep -Milliseconds 600 }
$ancho = 1934; $alto = 1044          # ventana de 1920x1037 visibles + bordes invisibles: la página queda de ~1902x930
[VF]::SetWindowPos($h, [IntPtr](-1), -3000, 0, $ancho, $alto, 0x50) | Out-Null; Start-Sleep -Milliseconds 400
$m = Rects; $r = $m[0]; $e = $m[1]
$dx = 1 - $e.R                  # corro la ventana para que su borde visible derecho quede en x = 1
[VF]::SetWindowPos($h, [IntPtr](-1), $r.L + $dx, 0, 0, 0, 0x51) | Out-Null; Start-Sleep -Milliseconds 300
Texto
