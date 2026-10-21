// =============================================================================
// ia-pc-reglas — las reglas PURAS de la puerta a la computadora del cliente (docs/ia-del-cliente.md, ola 1)
// =============================================================================
// Martín (D6a, 21/10/2026): el Claude o el GPT del cliente corre en su computadora, con el programa oficial y sus
// cuentas; MaKo le manda los pedidos y nunca toma el token. Esto es lo que se decide sin la base: los formatos de los
// tokens y del código, cuándo una PC está en línea, qué se acepta de lo que manda la PC, y cómo se le arma el pedido.
//
// Sin `server-only`: lo prueba tests/ia-pc.test.ts. El programa de la PC (scripts/ia-pc/mako-pc.mjs) repite el comando de
// Claude Code, y el test compara las dos copias.
// =============================================================================

/** El token de una PC emparejada: un negocio, una PC, una persona. Sólo late, toma turnos y los contesta. */
export const PREFIJO_TOKEN_PC = 'mkopc_';
/** El token de las herramientas de UN turno: lo recibe la PC que lo tomó y vence con el turno. */
export const PREFIJO_TOKEN_TURNO = 'mkotn_';

export const LATIDO_MS = 30_000;
/** Sin latido en este tiempo, la PC está «Sin conexión». Tres latidos perdidos. */
export const EN_LINEA_MS = 90_000;
export const CODIGO_MS = 10 * 60_000;
/** Un turno que nadie contestó en este tiempo vence: la respuesta de después ya no se muestra. */
export const TURNO_MS = 5 * 60_000;
/** Cuánto espera el chat a la PC (la ruta tiene 420 s): después, «tu Claude tardó demasiado». */
export const ESPERA_RESPUESTA_MS = 240_000;
/** Lo que espera un pedido de turnos de la PC antes de volver vacío (long-poll). */
export const ESPERA_TURNO_MS = 25_000;
export const TOPE_RESPUESTA = 20_000;

/**
 * LO QUE ACEPTA LA PERSONA AL CONECTAR SU COMPUTADORA (el Cerebro, 21/10/2026): que quede claro que la usuaria final es
 * ella, con el programa oficial sin tocar y su cuenta (docs/ia-del-cliente.md §10). Se acepta con un toque antes de
 * recibir el código, y queda la versión en el código y en la PC (mig 0319). Si el texto cambia, cambia la versión.
 */
export const TEXTO_CONSENTIMIENTO = 'Tu Claude corre en tu computadora, con tu cuenta, y contesta sólo lo que tú le pides en MaKo. MaKo nunca ve tu clave ni tu sesión.';
export const VERSION_CONSENTIMIENTO = '2026-10-21';

/** Sin 0/O ni 1/I: se dicta y se copia de una pantalla a otra. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const LARGO_CODIGO = 6;

/** El código como lo escribió la persona («abc 123», «ABC-123») → «ABC123», o null si no puede ser uno. */
export function normalizarCodigo(x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const c = x.toUpperCase().replace(/[\s-]/g, '');
  if (c.length !== LARGO_CODIGO) return null;
  return [...c].every((ch) => ALFABETO_CODIGO.includes(ch)) ? c : null;
}

/** Un código nuevo con la fuente de azar que se le pase (crypto en el servidor). */
export function codigoDe(bytes: Uint8Array): string {
  if (bytes.length < LARGO_CODIGO) throw new Error('faltan bytes para el código');
  return [...bytes.slice(0, LARGO_CODIGO)].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join('');
}

/** ¿Tiene la forma de un token de esta puerta? (32 bytes en base64url detrás del prefijo). */
export function tieneFormaDeToken(t: unknown, prefijo: string): t is string {
  return typeof t === 'string' && t.startsWith(prefijo) && /^[A-Za-z0-9_-]{43}$/.test(t.slice(prefijo.length));
}

/** El bearer de un pedido de la PC, o null. */
export function bearer(cabecera: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec((cabecera ?? '').trim());
  return m ? m[1] : null;
}

export function enLinea(ultimoLatido: string | null | undefined, ahora = Date.now()): boolean {
  const t = ultimoLatido ? Date.parse(ultimoLatido) : NaN;
  return Number.isFinite(t) && ahora - t <= EN_LINEA_MS;
}

/** El nombre que la PC dice que tiene («PC de Ana»): sin controles, recortado. */
export function sanearNombrePc(x: unknown): string {
  const n = (typeof x === 'string' ? x : '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return n || 'Mi computadora';
}

/** Una cuenta de IA que reporta la PC. Nunca un secreto: lo que no se reconoce, no entra. */
export type CuentaPc = {
  proveedor: 'claude' | 'chatgpt';
  email?: string;
  plan?: string;
  /** % usado de la ventana corta (las 5 horas) y de la semana, 0 a 100. */
  usado5h?: number;
  usadoSemana?: number;
  /** ISO de cuándo se repone la ventana corta. */
  repone?: string;
};

const pct = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 && x <= 100 ? Math.round(x) : undefined);
const corta = (x: unknown, max: number): string | undefined => {
  const s = typeof x === 'string' ? x.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
  return s || undefined;
};

export function sanearCuentas(x: unknown): CuentaPc[] {
  if (!Array.isArray(x)) return [];
  const out: CuentaPc[] = [];
  for (const c of x.slice(0, 8)) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    if (o.proveedor !== 'claude' && o.proveedor !== 'chatgpt') continue;
    const email = corta(o.email, 200);
    const repone = typeof o.repone === 'string' && Number.isFinite(Date.parse(o.repone)) ? new Date(o.repone).toISOString() : undefined;
    out.push({
      proveedor: o.proveedor,
      ...(email && /^[^\s@]+@[^\s@]+$/.test(email) ? { email } : {}),
      ...(corta(o.plan, 40) ? { plan: corta(o.plan, 40) } : {}),
      ...(pct(o.usado5h) != null ? { usado5h: pct(o.usado5h) } : {}),
      ...(pct(o.usadoSemana) != null ? { usadoSemana: pct(o.usadoSemana) } : {}),
      ...(repone ? { repone } : {}),
    });
  }
  return out;
}

export type RespuestaPc =
  | { ok: true; texto: string; cuenta: string | null; uso: { entrada: number; salida: number } | null }
  | { ok: false; error: string };

/** Lo que contesta la PC a un turno. Se trata como lo que contesta un modelo: después pasa por las mismas guardas. */
export function sanearRespuesta(x: unknown): RespuestaPc | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) return { ok: false, error: o.error.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300) };
  if (typeof o.texto !== 'string') return null;
  const texto = o.texto.replace(/\u0000/g, '').trim().slice(0, TOPE_RESPUESTA);
  const u = o.uso && typeof o.uso === 'object' ? (o.uso as Record<string, unknown>) : null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : 0);
  return { ok: true, texto, cuenta: corta(o.cuenta, 200) ?? null, uso: u ? { entrada: n(u.entrada), salida: n(u.salida) } : null };
}

/** Una herramienta como la pide MCP (`tools/list`). */
export type HerramientaMcp = { name: string; description: string; inputSchema: Record<string, unknown> };
export const herramientasParaMcp = (tools: ReadonlyArray<{ name: string; description: string; input_schema: Record<string, unknown> }>): HerramientaMcp[] =>
  tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.input_schema }));

/**
 * Lo que lee el Claude de la PC: la conversación hasta ahora y el mensaje nuevo, en un solo texto (`claude -p` recibe UN
 * pedido). El system va aparte, en su archivo.
 */
export function armarPrompt(historial: ReadonlyArray<{ role: string; content: unknown }>, mensaje: string): string {
  const texto = (c: unknown): string => (typeof c === 'string' ? c
    : Array.isArray(c) ? c.map((b) => (b && typeof b === 'object' && (b as { type?: string }).type === 'text' ? String((b as { text?: unknown }).text ?? '') : '')).join('\n')
      : '');
  const previos = historial.map((m) => `${m.role === 'assistant' ? 'MaKo' : 'La persona'}: ${texto(m.content).trim()}`).filter((l) => !l.endsWith(': '));
  return [
    ...(previos.length ? ['La conversación hasta ahora:', ...previos, ''] : []),
    'El mensaje nuevo de la persona:',
    mensaje.trim(),
  ].join('\n');
}

/**
 * EL COMANDO DE CLAUDE CODE EN LA PC. La PC es sólo el cerebro, nunca las manos:
 *   · `--tools ""` apaga TODAS las herramientas propias (terminal, archivos, web);
 *   · `--strict-mcp-config` con el MCP del turno deja como únicas las de MaKo, que corren en el servidor;
 *   · ⚠️ nunca `--bare`: apaga el login de la suscripción («OAuth and keychain are never read»).
 * El texto de la persona va por stdin; el system y el MCP, en archivos que arma el programa. Nada de la persona en la
 * línea de comandos. tests/ia-pc.test.ts compara esto con la copia de scripts/ia-pc/mako-pc.mjs.
 *
 * `stream-json` (ola 2): trae el `rate_limit_event` con el % usado de la cuenta (las 5 horas y la semana), que
 * `json` no trae y `/usage` en `-p` tampoco («You are currently using your subscription», medido el 21/10/2026).
 */
export const ARGS_CLAUDE: readonly string[] = [
  '-p', '--output-format', 'stream-json', '--verbose', '--no-session-persistence',
  '--tools', '', '--strict-mcp-config', '--allowedTools', 'mcp__mako', '--max-turns', '12',
];

/**
 * Los modelos que la PC acepta del turno, y nada más: es el ÚNICO valor del comando que viene del servidor, y pasa por
 * esta lista en la PC. Sonnet por default (docs/ia-del-cliente.md §12.12): sin elegir, Claude Code usa Opus y le gasta
 * el cupo de 5 horas al cliente en pocos turnos.
 */
export const MODELOS_PC = ['sonnet', 'opus', 'haiku'] as const;
export type ModeloPc = (typeof MODELOS_PC)[number];
export const MODELO_PC_DEFAULT: ModeloPc = 'sonnet';
/** La configuración del negocio que elige el modelo (app_settings, por workspace). */
export const CLAVE_MODELO_PC = 'ia_pc.modelo';
export const modeloPc = (x: unknown): ModeloPc => ((MODELOS_PC as readonly unknown[]).includes(x) ? (x as ModeloPc) : MODELO_PC_DEFAULT);

/** El % usado que trae el `rate_limit_event` del stream (utilización de 0 a 1, `resetsAt` en segundos). */
export function limitesDelEvento(e: unknown): { usado5h?: number; usadoSemana?: number; repone?: string } {
  const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
  const info = (o.rate_limit_info && typeof o.rate_limit_info === 'object' ? o.rate_limit_info : o) as Record<string, unknown>;
  const w = (info.unifiedWindows && typeof info.unifiedWindows === 'object' ? info.unifiedWindows : {}) as Record<string, { utilization?: unknown; resetsAt?: unknown }>;
  const pct = (u: unknown) => (typeof u === 'number' && Number.isFinite(u) && u >= 0 && u <= 1.5 ? Math.min(100, Math.round(u * 100)) : undefined);
  const r = w.five_hour?.resetsAt;
  return {
    ...(pct(w.five_hour?.utilization) != null ? { usado5h: pct(w.five_hour?.utilization) } : {}),
    ...(pct(w.seven_day?.utilization) != null ? { usadoSemana: pct(w.seven_day?.utilization) } : {}),
    ...(typeof r === 'number' && Number.isFinite(r) ? { repone: new Date(r * 1000).toISOString() } : {}),
  };
}

// ── El instalador de un comando (ola 2) ──────────────────────────────────────
// Como el de Claude (`irm https://claude.ai/install.ps1 | iex`): el cliente pega UNA línea, y el script baja el programa,
// conecta la PC con su código, lo deja arrancando solo al prender la computadora y lo prende. Bajado por PowerShell o
// curl, el programa no lleva la marca de «descargado de internet», así que SmartScreen y Gatekeeper no lo frenan.

/** La versión del programa que sirven los instaladores (la misma que `VERSION` de scripts/ia-pc/mako-pc.mjs). */
export const VERSION_PC = '0.2.0';
export const SISTEMAS_PC = ['windows', 'mac'] as const;
export type SistemaPc = (typeof SISTEMAS_PC)[number];
/** Los archivos que sube scripts/ia-pc/publicar-binarios.mts al bucket privado `ia-pc` (comprimidos: entran en 50 MB). */
export const archivoDelPrograma = (archivo: 'windows-x64' | 'mac-arm64' | 'mac-x64'): string => `mako-pc-${VERSION_PC}-${archivo}.gz`;

/** La línea que el tutorial le da a copiar. El código va en la URL: es de un uso y vence en 10 minutos. */
export function lineaDeInstalacion(servidor: string, sistema: SistemaPc, codigo: string): string {
  const url = `${servidor.replace(/\/+$/, '')}/api/ia-pc/instalar?os=${sistema}&codigo=${codigo}`;
  return sistema === 'windows' ? `irm "${url}" | iex` : `curl -fsSL "${url}" | sh`;
}

/**
 * El script que corre en la PC del cliente. Sólo lleva valores que pasaron por una regla: el código (su alfabeto), el
 * servidor (el de la app) y las URL firmadas de los archivos (las arma el servidor). Nada que haya escrito una persona.
 */
export function scriptDeInstalacion(p: { sistema: SistemaPc; codigo: string; servidor: string; urls: Record<string, string> }): string {
  const codigo = normalizarCodigo(p.codigo);
  if (!codigo) throw new Error('código inválido');
  if (!/^https:\/\/[\w.-]+(:\d+)?$/.test(p.servidor) && !/^http:\/\/localhost(:\d+)?$/.test(p.servidor)) throw new Error('servidor inválido');
  for (const u of Object.values(p.urls)) if (!/^https:\/\/[^\s'"`$]+$/.test(u)) throw new Error('url inválida');
  if (p.sistema === 'windows') {
    return [
      // Sin esto, PowerShell 5.1 muestra «qued�» en vez de «quedó» (medido el 21/10/2026 con el instalador).
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
      "$ErrorActionPreference = 'Stop'",
      "$dir = Join-Path $env:LOCALAPPDATA 'MaKo'",
      'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
      "$exe = Join-Path $dir 'mako-pc.exe'",
      "Write-Host 'Descargando MaKo en tu computadora...'",
      `$gz = Join-Path $dir 'mako-pc.gz'`,
      `Invoke-WebRequest -UseBasicParsing -Uri '${p.urls['windows-x64']}' -OutFile $gz`,
      "Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue | Stop-Process -Force",
      '$in = [IO.File]::OpenRead($gz); $out = [IO.File]::Create($exe)',
      '$z = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress); $z.CopyTo($out)',
      '$z.Dispose(); $out.Dispose(); $in.Dispose(); Remove-Item $gz',
      `& $exe emparejar '${codigo}' --servidor '${p.servidor}' --nombre $env:COMPUTERNAME`,
      "if ($LASTEXITCODE -ne 0) { throw 'No pude conectar esta computadora. Pide otro código en MaKo.' }",
      "$vbs = Join-Path ([Environment]::GetFolderPath('Startup')) 'MaKo.vbs'",
      "Set-Content -Path $vbs -Encoding ASCII -Value ('CreateObject(\"WScript.Shell\").Run \"\"\"' + $exe + '\"\"\", 0, False')",
      'Start-Process -WindowStyle Hidden -FilePath $exe',
      "Write-Host '¡Listo! Tu computadora quedó conectada a MaKo. Déjala prendida.'",
    ].join('\n');
  }
  return [
    'set -e',
    'D="$HOME/.mako-pc/bin"; mkdir -p "$D"',
    'if [ "$(uname -m)" = "arm64" ]; then U=\'' + p.urls['mac-arm64'] + '\'; else U=\'' + p.urls['mac-x64'] + '\'; fi',
    'echo "Descargando MaKo en tu computadora..."',
    'curl -fsSL "$U" | gunzip > "$D/mako-pc.nuevo"',
    'chmod +x "$D/mako-pc.nuevo"; mv -f "$D/mako-pc.nuevo" "$D/mako-pc"',
    // En una Mac con chip de Apple, un ejecutable sin firma no corre: se le pone la firma local (ad-hoc).
    'codesign --force --sign - "$D/mako-pc" 2>/dev/null || true',
    `"$D/mako-pc" emparejar '${codigo}' --servidor '${p.servidor}' --nombre "$(scutil --get ComputerName 2>/dev/null || hostname)"`,
    'P="$HOME/Library/LaunchAgents/com.hola-mako.pc.plist"; mkdir -p "$HOME/Library/LaunchAgents"',
    'cat > "$P" <<PLIST',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    '<key>Label</key><string>com.hola-mako.pc</string>',
    '<key>ProgramArguments</key><array><string>$D/mako-pc</string></array>',
    '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>',
    '<key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>',
    '<key>StandardOutPath</key><string>$HOME/.mako-pc/registro.txt</string>',
    '<key>StandardErrorPath</key><string>$HOME/.mako-pc/registro.txt</string>',
    '</dict></plist>',
    'PLIST',
    'launchctl unload "$P" 2>/dev/null || true; launchctl load "$P"',
    'echo "¡Listo! Tu computadora quedó conectada a MaKo. Déjala prendida."',
  ].join('\n');
}

/** De varias cuentas, la que tiene más cupo: la de menos uso de las 5 horas, salteando la que pasó el 95%. */
export function cuentaConCupo<T extends { usado5h?: number }>(cuentas: readonly T[]): T | null {
  const libres = cuentas.filter((c) => (c.usado5h ?? 0) < 95);
  if (!libres.length) return null;
  return libres.reduce((a, b) => ((b.usado5h ?? 0) < (a.usado5h ?? 0) ? b : a));
}

/** Lo que dice el chat cuando el turno era de la computadora de la persona y no salió (docs/ia-del-cliente.md §5). */
export const AVISO_PC_APAGADA = 'Tu computadora está apagada: préndela y mándamelo de nuevo.';
export const AVISO_PC_TARDE = 'Tu Claude tardó demasiado: mándamelo de nuevo.';
export const AVISO_PC_ERROR = 'Tu Claude no pudo contestar: revisa que tenga la sesión iniciada en tu computadora.';
export function avisoDeLaPc(fallo: 'tarde' | 'error' | null, apagada: boolean): string | null {
  if (fallo === 'tarde') return AVISO_PC_TARDE;
  if (fallo === 'error') return AVISO_PC_ERROR;
  return apagada ? AVISO_PC_APAGADA : null;
}

/** El MCP de MaKo para ESTE turno: por HTTP al servidor, con el token del turno. */
export function mcpDelTurno(url: string, token: string): { mcpServers: Record<string, unknown> } {
  return { mcpServers: { mako: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } };
}
