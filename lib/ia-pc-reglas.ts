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

import { ESTADOS_MX } from './geo-regiones';

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
/**
 * Cuánto espera el chat a la PC, como mucho: después, «tu Claude tardó demasiado». Nunca más que lo que le queda a la ruta
 * (`esperaDelTurno`): el Analyst del lead tiene 300 s y no 420, y Vercel cortaba sin aviso (revisión del 21/10/2026).
 */
export const ESPERA_RESPUESTA_MS = 240_000;
/** Lo que se deja libre al final de la ruta para cerrar el turno y contestar. */
export const MARGEN_RUTA_MS = 25_000;
/** Lo que el chat espera a la PC en ESTE turno: lo que le queda a la ruta, menos el margen, con el tope de siempre. */
export function esperaDelTurno(plazoRutaMs: number, gastadoMs: number): number {
  return Math.max(0, Math.min(ESPERA_RESPUESTA_MS, plazoRutaMs - gastadoMs - MARGEN_RUTA_MS));
}
/**
 * Un turno que la PC no tomó en este tiempo es de una PC que se apagó (el long-poll es de 25 s): no se esperan los 4
 * minutos, se dice «está apagada» (y se prueba con su clave, si la tiene). Sólo si la PC no está ocupada con otro turno.
 */
export const SIN_TOMAR_MS = 35_000;
/** Un turno tomado cuya PC dejó de latir esto está muerto (cerró la tapa a mitad de turno): dos latidos y medio. */
export const SIN_LATIDO_MS = 75_000;
/** Lo que espera un pedido de turnos de la PC antes de volver vacío (long-poll). */
export const ESPERA_TURNO_MS = 25_000;
export const TOPE_RESPUESTA = 20_000;

/**
 * LO QUE ACEPTA LA PERSONA AL CONECTAR SU COMPUTADORA (el Cerebro, 21/10/2026): que quede claro que la usuaria final es
 * ella, con el programa oficial sin tocar y su cuenta (docs/ia-del-cliente.md §10). Se acepta con un toque antes de
 * recibir el código, y queda la versión en el código y en la PC (mig 0321). Si el texto cambia, cambia la versión.
 */
export const TEXTO_CONSENTIMIENTO = 'Tu Claude corre en tu computadora, con tu cuenta, y contesta sólo lo que tú le pides en MaKo. MaKo nunca ve tu clave ni tu sesión.';
export const VERSION_CONSENTIMIENTO = '2026-10-21';

/** Sin 0/O ni 1/I: se lee y se copia de una pantalla a otra. */
export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** 8 (40 bits): ya no se dicta, viaja dentro de la línea que se copia (`lineaDeInstalacion`), así que alargarlo es gratis. */
export const LARGO_CODIGO = 8;

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

/**
 * Lo que contesta una ruta de la PC cuando no hay PC para su token. Distingue lo que el programa tiene que distinguir: un
 * token que no existe o se desconectó (401 con `revocado`: el programa se saca del arranque y sale) de una base que no
 * pudo leer (503: reintenta). Antes las dos eran 401, y un error pasajero de la base apagaba para siempre el programa de
 * Windows (revisión del 21/10/2026). scripts/ia-pc/mako-pc.mjs → `esRevocado` lee `revocado`.
 */
export function respuestaSinPc(fallo: 'revocado' | 'no-pude-leer'): { status: 401 | 503; cuerpo: { ok: false; error: string; revocado?: true } } {
  return fallo === 'revocado'
    ? { status: 401, cuerpo: { ok: false, error: 'MaKo desconectó esta computadora.', revocado: true } }
    : { status: 503, cuerpo: { ok: false, error: 'MaKo no pudo leer ahora: reintenta en unos segundos.' } };
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
  /** ISO de cuándo se repone la semana (con la semana agotada, el chat da ESTA hora: la de las 5 horas era mentira). */
  reponeSemana?: string;
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
    const iso = (v: unknown) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : undefined);
    const repone = iso(o.repone);
    const reponeSemana = iso(o.reponeSemana);
    out.push({
      proveedor: o.proveedor,
      ...(email && /^[^\s@]+@[^\s@]+$/.test(email) ? { email } : {}),
      ...(corta(o.plan, 40) ? { plan: corta(o.plan, 40) } : {}),
      ...(pct(o.usado5h) != null ? { usado5h: pct(o.usado5h) } : {}),
      ...(pct(o.usadoSemana) != null ? { usadoSemana: pct(o.usadoSemana) } : {}),
      ...(repone ? { repone } : {}),
      ...(reponeSemana ? { reponeSemana } : {}),
    });
  }
  return out;
}

/** Por qué no contestó la PC, cuando se sabe: su cuenta al tope, o su Claude sin sesión. El chat dice lo cierto. */
export type TipoFalloPc = 'tope' | 'sesion';
export type RespuestaPc =
  | { ok: true; texto: string; cuenta: string | null; uso: { entrada: number; salida: number } | null }
  | { ok: false; error: string; tipo?: TipoFalloPc; repone?: string };

/** Lo que contesta la PC a un turno. Se trata como lo que contesta un modelo: después pasa por las mismas guardas. */
export function sanearRespuesta(x: unknown): RespuestaPc | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) {
    const tipo = o.tipo === 'tope' || o.tipo === 'sesion' ? o.tipo : undefined;
    const repone = typeof o.repone === 'string' && Number.isFinite(Date.parse(o.repone)) ? new Date(o.repone).toISOString() : undefined;
    return { ok: false, error: o.error.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 300), ...(tipo ? { tipo } : {}), ...(tipo === 'tope' && repone ? { repone } : {}) };
  }
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

/**
 * El % usado que trae el `rate_limit_event` del stream (utilización de 0 a 1, `resetsAt` en segundos), con cuándo se
 * repone cada ventana: la de la semana también (antes se descartaba, y con la semana agotada el chat daba la hora de las
 * 5 horas — segunda revisión, 21/10/2026).
 */
export function limitesDelEvento(e: unknown): { usado5h?: number; usadoSemana?: number; repone?: string; reponeSemana?: string } {
  const o = e && typeof e === 'object' ? (e as Record<string, unknown>) : {};
  const info = (o.rate_limit_info && typeof o.rate_limit_info === 'object' ? o.rate_limit_info : o) as Record<string, unknown>;
  const w = (info.unifiedWindows && typeof info.unifiedWindows === 'object' ? info.unifiedWindows : {}) as Record<string, { utilization?: unknown; resetsAt?: unknown }>;
  const pct = (u: unknown) => (typeof u === 'number' && Number.isFinite(u) && u >= 0 && u <= 1.5 ? Math.min(100, Math.round(u * 100)) : undefined);
  const iso = (r: unknown) => (typeof r === 'number' && Number.isFinite(r) ? new Date(r * 1000).toISOString() : undefined);
  const repone = iso(w.five_hour?.resetsAt);
  const reponeSemana = iso(w.seven_day?.resetsAt);
  return {
    ...(pct(w.five_hour?.utilization) != null ? { usado5h: pct(w.five_hour?.utilization) } : {}),
    ...(pct(w.seven_day?.utilization) != null ? { usadoSemana: pct(w.seven_day?.utilization) } : {}),
    ...(repone ? { repone } : {}),
    ...(reponeSemana ? { reponeSemana } : {}),
  };
}

/** Cuándo se repone una cuenta al tope: con la semana agotada, la semana; si no, las 5 horas. */
export function reponeDelTope(l: { usadoSemana?: number; repone?: string; reponeSemana?: string }): string | undefined {
  return (l.usadoSemana ?? 0) >= 100 && l.reponeSemana ? l.reponeSemana : l.repone;
}

// ── El instalador de un comando (ola 2) ──────────────────────────────────────
// Como el de Claude (`irm https://claude.ai/install.ps1 | iex`): el cliente pega UNA línea, y el script baja el programa,
// conecta la PC con su código, lo deja arrancando solo al prender la computadora y lo prende. Bajado por PowerShell o
// curl, el programa no lleva la marca de «descargado de internet», así que SmartScreen y Gatekeeper no lo frenan.

/** La versión del programa que sirven los instaladores (la misma que `VERSION` de scripts/ia-pc/mako-pc.mjs). */
export const VERSION_PC = '0.4.2';
export const SISTEMAS_PC = ['windows', 'mac'] as const;
export type SistemaPc = (typeof SISTEMAS_PC)[number];
/** Los archivos que sube scripts/ia-pc/publicar-binarios.mts al bucket privado `ia-pc` (comprimidos: entran en 50 MB). */
export const archivoDelPrograma = (archivo: 'windows-x64' | 'mac-arm64' | 'mac-x64'): string => `mako-pc-${VERSION_PC}-${archivo}.gz`;
export const ARCHIVOS_PC = ['windows-x64', 'mac-arm64', 'mac-x64'] as const;
/**
 * El instalador CON ASISTENTE de Windows (0.4.0, installer/windows/mako.iss): Siguiente › Instalar › Finalizar, sin PowerShell
 * (Martín, 22/10/2026: «jamás por Powershell, ni siquiera que se tenga que abrir»). Va SIN comprimir —Inno ya comprime— y se
 * baja con \`nombreDelInstalador\` (GET /api/ia-pc/descargar).
 */
export const archivoDelInstalador = (version: string = VERSION_PC): string => `mako-pc-${version}-windows-setup.exe`;
export const nombreDelInstalador = (version: string = VERSION_PC): string => `MaKo-Setup-${version}.exe`;
/** La UNA línea de la página de descarga para el aviso de Windows mientras no esté firmado (Martín, 22/10/2026). */
export const AVISO_SMARTSCREEN = 'Si Windows dice «protegió su PC»: Más información › Ejecutar de todas formas.';
/**
 * MaKo.app para la Mac (0.4.2; Mauricio conectó su MacBook por la Terminal el 23/10 y le costó): un .zip con la app (un .pkg o
 * un .dmg no se arman en Windows). La app copia el programa de ESA Mac, le pone la firma local y lo abre con `app`
 * (scripts/ia-pc/mako-pc.mjs → abrirLaApp): toma el código del portapapeles, sin Terminal.
 */
export const archivoDelInstaladorMac = (version: string = VERSION_PC): string => `mako-pc-${version}-mac-app.zip`;
export const nombreDelInstaladorMac = (version: string = VERSION_PC): string => `MaKo-${version}-Mac.zip`;
/** La UNA línea para cuando macOS frena la app sin firmar (la firma de Apple espera el D-U-N-S). */
export const AVISO_GATEKEEPER = 'Si macOS dice que no puede comprobarla: Ajustes del Sistema › Privacidad y seguridad › Abrir igualmente.';

/**
 * El ejecutable de MaKo.app: copia el programa de ESTA Mac (chip de Apple o Intel) a ~/.mako-pc/bin —donde lo busca el
 * arranque, el mismo de la línea de la Terminal—, le saca la cuarentena, le pone la firma local que pide el chip de Apple (un
 * ejecutable sin firma no corre ahí) y lo abre con `app`. Un guion: la app no está firmada, y así macOS sólo pregunta por ella.
 */
export function lanzadorDeLaAppMac(): string {
  return [
    '#!/bin/sh',
    '# MaKo.app: copia el programa de esta Mac a ~/.mako-pc/bin, con la firma local, y lo abre sin Terminal (0.4.2).',
    'R="$(cd "$(dirname "$0")/../Resources" && pwd)"',
    'D="$HOME/.mako-pc/bin"',
    'mkdir -p "$D"',
    'if [ "$(uname -m)" = "arm64" ]; then B="$R/mako-pc-arm64"; else B="$R/mako-pc-x64"; fi',
    'cp -f "$B" "$D/mako-pc.nuevo" && chmod +x "$D/mako-pc.nuevo"',
    'xattr -d com.apple.quarantine "$D/mako-pc.nuevo" 2>/dev/null || true',
    'codesign --force --sign - "$D/mako-pc.nuevo" 2>/dev/null || true',
    'mv -f "$D/mako-pc.nuevo" "$D/mako-pc"',
    'exec "$D/mako-pc" app',
    '',
  ].join('\n');
}

/** El Info.plist de MaKo.app: sin ícono en el Dock (las ventanas son del sistema). */
export function infoPlistDeLaAppMac(version: string = VERSION_PC): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    '<key>CFBundleName</key><string>MaKo</string>',
    '<key>CFBundleDisplayName</key><string>MaKo</string>',
    '<key>CFBundleIdentifier</key><string>com.hola-mako.app</string>',
    `<key>CFBundleVersion</key><string>${version}</string>`,
    `<key>CFBundleShortVersionString</key><string>${version}</string>`,
    '<key>CFBundlePackageType</key><string>APPL</string>',
    '<key>CFBundleExecutable</key><string>MaKo</string>',
    '<key>LSMinimumSystemVersion</key><string>11.0</string>',
    '<key>LSUIElement</key><true/>',
    '</dict></plist>',
    '',
  ].join('\n');
}

/** Adónde vuelve el instalador al terminar: «Tus cuentas de IA», directo en «Conecta MaKo». */
export const RUTA_TRAS_INSTALAR = '/perfil/ia?computadora=1';

/**
 * Qué archivos de ESTA versión faltan en el bucket (IA1/IA2, 22/10/2026). La 0.3.2 se desplegó sin sus ejecutables y el
 * instalador contestaba «No pude preparar la descarga» con un 200, a todo cliente nuevo, sin que nada lo marcara. Lo usan
 * publicar-binarios (en seco dice qué falta) y verificar-binarios (lo corre Integración antes de subir un cambio de acá).
 * Las versiones que están, para decirlo: «hay 0.2.0 y 0.3.0».
 */
export function faltanEnElBucket(nombres: readonly string[], version: string = VERSION_PC): { faltan: string[]; versiones: string[] } {
  const hay = new Set(nombres);
  const versiones = [...new Set(nombres.map((n) => /^mako-pc-(\d+\.\d+\.\d+)-/.exec(n)?.[1]).filter((v): v is string => !!v))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  return { faltan: [...ARCHIVOS_PC.map((a) => `mako-pc-${version}-${a}.gz`), archivoDelInstalador(version), archivoDelInstaladorMac(version)].filter((n) => !hay.has(n)), versiones };
}

/** Lo que dice scripts/ia-pc/verificar-binarios.mts: «0.3.2 completa» o «falta 0.3.2: …» (con lo que no firma). */
export function informeDeBinarios(nombres: readonly string[], version: string = VERSION_PC, noFirman: readonly string[] = []): { completa: boolean; texto: string } {
  const { faltan, versiones } = faltanEnElBucket(nombres, version);
  const mal = [...faltan, ...noFirman.map((n) => `${n} (no firma)`)];
  if (!mal.length) return { completa: true, texto: `✓ ${version} completa: el instalador puede bajarla.` };
  return { completa: false, texto: `⛔ falta ${version}: ${mal.join(', ')}. En el bucket hay: ${versiones.join(', ') || 'nada'}. Súbela con scripts/ia-pc/publicar-binarios.mts antes de desplegar.` };
}

/** La línea que el tutorial le da a copiar. El código va en la URL: es de un uso y vence en 10 minutos. */
export function lineaDeInstalacion(servidor: string, sistema: SistemaPc, codigo: string): string {
  const url = `${servidor.replace(/\/+$/, '')}/api/ia-pc/instalar?os=${sistema}&codigo=${codigo}`;
  return sistema === 'windows' ? `irm "${url}" | iex` : `curl -fsSL "${url}" | sh`;
}

/**
 * El subsistema de un ejecutable de Windows (PE): 2 = de ventana, 3 = de consola. El programa tiene que ser DE VENTANA:
 * arrancado por la clave `Run` al iniciar sesión, uno de consola abre una ventana negra. Bun 1.2.21 deja 3 aunque se le
 * pida `--windows-hide-console` (medido el 21/10/2026), así que scripts/ia-pc/publicar-binarios.mts lo cambia a mano
 * (lo mismo que hace `editbin /SUBSYSTEM:WINDOWS`) y lo verifica antes de subirlo.
 */
export function subsistemaPe(exe: Uint8Array): number | null {
  if (exe.length < 0x40 || exe[0] !== 0x4d || exe[1] !== 0x5a) return null; // «MZ»
  const pe = exe[0x3c] | (exe[0x3d] << 8) | (exe[0x3e] << 16) | (exe[0x3f] << 24);
  const sub = pe + 24 + 68; // la firma «PE\0\0» (4) y la cabecera COFF (20); Subsystem está a 68 de la opcional
  if (pe <= 0 || sub + 2 > exe.length || exe[pe] !== 0x50 || exe[pe + 1] !== 0x45) return null;
  return exe[sub] | (exe[sub + 1] << 8);
}
export function marcarDeVentana(exe: Uint8Array): Uint8Array {
  if (subsistemaPe(exe) == null) throw new Error('no es un ejecutable de Windows');
  const pe = exe[0x3c] | (exe[0x3d] << 8) | (exe[0x3e] << 16) | (exe[0x3f] << 24);
  const out = Uint8Array.from(exe);
  out[pe + 24 + 68] = 2;
  out[pe + 24 + 69] = 0;
  return out;
}

/** El nombre del arranque automático en Windows (HKCU\…\Run) y en la Mac (el LaunchAgent). El programa los saca solo. */
export const ARRANQUE_WINDOWS = 'MaKo';
export const ARRANQUE_MAC = 'com.hola-mako.pc';

/**
 * El script que corre en la PC del cliente. Sólo lleva valores que pasaron por una regla: el código (su alfabeto), el
 * servidor (el de la app) y las URL firmadas de los archivos (las arma el servidor). Nada que haya escrito una persona.
 *
 * Lo que hace, en orden: baja el programa NUEVO a un archivo aparte, lo empareja (queda PENDIENTE en MaKo), le muestra a
 * la persona a qué negocio y como quién se conecta y le pregunta si es el suyo. Con «no» (o si emparejar falla) suelta lo
 * pendiente y se va SIN TOCAR lo que ya andaba. Recién con el «sí» para el programa que corría, confirma, reemplaza el
 * ejecutable, deja el arranque y lo PRENDE. Después mira la sesión de Claude y, si falta, abre el login con la ruta que
 * tenga (la ventana del paso 2 no tiene el PATH nuevo; un Claude de winget o Homebrew está en el PATH y no en
 * ~/.local/bin).
 *
 * ⚠️ TERCERA REVISIÓN (21/10/2026): cerrar la ventana NO corre el `finally` (medido por el Cerebro: WM_CLOSE mata
 * PowerShell adentro del `try`, 3 de 3). El programa se prendía recién en el `finally`, DESPUÉS del login, y cerrar la
 * ventana mientras el navegador pedía la sesión lo dejaba apagado. Ahora: confirma con lo de antes todavía corriendo (si
 * falla, no se tocó nada), reemplaza y prende enseguida, y la sesión se mira después (el programa la vuelve a mirar
 * solo en cada latido). El `finally` (el `trap` en la Mac) queda de respaldo, y no prende un segundo programa.
 *
 * ⚠️ El ORDEN es lo que se revisó (segunda revisión del Cerebro, 21/10/2026): antes paraba el programa ANTES de preguntar,
 * así que «no es mi negocio», un código vencido o un 503 dejaban apagada la conexión que andaba («sigue como estaba»,
 * decía); y escribía el .exe en uso justo después de Stop-Process, que no espera a que suelte el archivo (8 de 8 veces
 * «está siendo utilizado por otro proceso»). Ahora: archivo aparte, Kill + WaitForExit, y Move-Item con reintentos.
 *
 * ⚠️ WINDOWS: EL ARRANQUE ES LA CLAVE `Run` DE HKCU, NUNCA UN .vbs EN INICIO. El MaKo.vbs de la 0.2.0
 * (`WScript.Shell.Run` oculto) lo pone en cuarentena Defender como «Trojan:VBS/AgentTesla» (medido el 21/10/2026 en la PC
 * de Martín): el cliente veía una alerta de troyano y el programa no volvía a arrancar. La clave guarda la ruta en UTF-16
 * (una carpeta «José Muñoz» anda; `Set-Content -Encoding ASCII` la volvía «Jos? Mu?oz»), no pide administrador, y el
 * programa es «de ventana» (publicar-binarios.mts), así que arranca sin abrir una consola. Por eso cada llamada al
 * programa va con `| Out-Host`: PowerShell no espera a un programa de ventana si no se lo encadena (medido).
 * `MAKO_PC_SI=1` contesta «sí» sin preguntar: sólo para la prueba de punta a punta (probar-punta-a-punta.mts).
 */
export function scriptDeInstalacion(p: { sistema: SistemaPc; codigo: string; servidor: string; urls: Record<string, string> }): string {
  const codigo = normalizarCodigo(p.codigo);
  if (!codigo) throw new Error('código inválido');
  if (!/^https:\/\/[\w.-]+(:\d+)?$/.test(p.servidor) && !/^http:\/\/localhost(:\d+)?$/.test(p.servidor)) throw new Error('servidor inválido');
  for (const u of Object.values(p.urls)) if (!/^https:\/\/[^\s'"`$]+$/.test(u)) throw new Error('url inválida');
  const otroCodigo = 'No pude conectar esta computadora. Pide otro código en MaKo.';
  const noConfirme = 'No pude confirmar la conexión: tu computadora sigue como estaba. Pide otro código en MaKo.';
  const noLaConecte = 'No la conecté: tu computadora sigue como estaba.';
  const faltaClaude = 'Tu computadora quedó conectada, pero falta Claude Code: instálalo con el paso 2 de MaKo. MaKo lo detecta solo: no hace falta pegar esto de nuevo.';
  const faltaSesion = 'Tu computadora quedó conectada, pero tu Claude no tiene la sesión iniciada: hazlo con el paso 3 de MaKo. MaKo lo detecta solo: no hace falta pegar esto de nuevo.';
  const listo = '¡Listo! Tu computadora quedó conectada a MaKo. Déjala prendida.';
  if (p.sistema === 'windows') {
    return [
      // Sin esto, PowerShell 5.1 muestra «qued�» en vez de «quedó» (medido el 21/10/2026 con el instalador).
      '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
      "$ErrorActionPreference = 'Stop'",
      // ⚠️ SIN LA BARRA DE PROGRESO (22/10/2026, Martín: se quedó en «Descargando MaKo en tu computadora…» para siempre). En
      // Windows PowerShell 5.1 la barra de `Invoke-WebRequest` se redibuja por cada pedazo que llega: con los 42,7 MB del
      // programa: 58,6 s con la barra contra 4,1 s sin ella (medido el 22/10/2026, el mismo archivo, desde un PowerShell sin
      // ventana; con ventana, la barra se dibuja y es peor). Tiene que ir ANTES de bajar (tests/ia-pc-ola2.test.ts).
      "$ProgressPreference = 'SilentlyContinue'",
      "$dir = Join-Path $env:LOCALAPPDATA 'MaKo'",
      'New-Item -ItemType Directory -Force -Path $dir | Out-Null',
      "$exe = Join-Path $dir 'mako-pc.exe'",
      "$nuevo = Join-Path $dir 'mako-pc.nuevo.exe'",
      "Write-Host 'Descargando MaKo en tu computadora...'",
      `$gz = Join-Path $dir 'mako-pc.gz'`,
      `Invoke-WebRequest -UseBasicParsing -Uri '${p.urls['windows-x64']}' -OutFile $gz`,
      '$in = [IO.File]::OpenRead($gz); $out = [IO.File]::Create($nuevo)',
      '$z = New-Object IO.Compression.GZipStream($in, [IO.Compression.CompressionMode]::Decompress); $z.CopyTo($out)',
      '$z.Dispose(); $out.Dispose(); $in.Dispose(); Remove-Item $gz',
      `& $nuevo emparejar '${codigo}' --servidor '${p.servidor}' --nombre $env:COMPUTERNAME | Out-Host`,
      `if ($LASTEXITCODE -ne 0) { Remove-Item -Force $nuevo -ErrorAction SilentlyContinue; throw '${otroCodigo}' }`,
      "if ($env:MAKO_PC_SI -eq '1') { $si = 's' } else { $si = Read-Host '¿Es tu negocio? Escribe s y aprieta Enter para conectarla' }",
      `if ($si -notmatch '^\\s*[sS]') { & $nuevo cancelar | Out-Host; Remove-Item -Force $nuevo -ErrorAction SilentlyContinue; throw '${noLaConecte}' }`,
      // Con el sí: confirma con lo de antes todavía corriendo. Si MaKo no la confirma, no se tocó nada.
      '& $nuevo confirmar | Out-Host',
      `if ($LASTEXITCODE -ne 0) { Remove-Item -Force $nuevo -ErrorAction SilentlyContinue; throw '${noConfirme}' }`,
      'try {',
      "  Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue | ForEach-Object { try { $_.Kill(); [void]$_.WaitForExit(15000) } catch {} }",
      '  $movido = $false',
      '  for ($i = 0; $i -lt 20 -and -not $movido; $i++) { try { Move-Item -Force $nuevo $exe; $movido = $true } catch { Start-Sleep -Milliseconds 500 } }',
      "  if (-not $movido) { throw 'No pude reemplazar el programa: cierra MaKo y pega la línea de nuevo.' }",
      // Lo de la 0.2.0, si quedó: nada de MaKo en Inicio.
      "  Remove-Item -Force (Join-Path ([Environment]::GetFolderPath('Startup')) 'MaKo.vbs') -ErrorAction SilentlyContinue",
      `  New-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${ARRANQUE_WINDOWS}' -Value ('"' + $exe + '"') -PropertyType String -Force | Out-Null`,
      // Se prende YA, antes de la sesión y del login: cerrar la ventana después no lo deja apagado.
      '  Start-Process -FilePath $exe',
      '} finally {',
      "  if ((Test-Path $exe) -and -not (Get-Process -Name 'mako-pc' -ErrorAction SilentlyContinue)) { Start-Process -FilePath $exe }",
      '  Remove-Item -Force $nuevo -ErrorAction SilentlyContinue',
      '}',
      "$claude = Join-Path $env:USERPROFILE '.local\\bin\\claude.exe'",
      'if (-not (Test-Path $claude)) { $c = Get-Command claude -ErrorAction SilentlyContinue; if ($c) { $claude = $c.Source } }',
      '& $exe sesion | Out-Host',
      '$sesion = $LASTEXITCODE',
      "if ($sesion -eq 2 -and (Test-Path $claude)) { Write-Host 'Inicia sesión con tu cuenta de Claude: se abre el navegador.'; & $claude auth login; & $exe sesion | Out-Host; $sesion = $LASTEXITCODE }",
      `if ($sesion -eq 0) { Write-Host '${listo}' } elseif ($sesion -eq 3) { Write-Host '${faltaClaude}' } else { Write-Host '${faltaSesion}' }`,
    ].join('\n');
  }
  // Mac. `curl | sh` lee el script por la entrada: lo que pregunta lee de /dev/tty, y el programa va con < /dev/null para
  // no comerse las líneas que siguen. Con el «sí» confirma con lo de antes cargado; recién ahí descarga el agente,
  // reemplaza y lo CARGA antes de la sesión. El `trap` lo vuelve a cargar al salir por donde sea (de respaldo).
  return [
    'set -e',
    'D="$HOME/.mako-pc/bin"; mkdir -p "$D"',
    `P="$HOME/Library/LaunchAgents/${ARRANQUE_MAC}.plist"; mkdir -p "$HOME/Library/LaunchAgents"`,
    'if [ "$(uname -m)" = "arm64" ]; then U=\'' + p.urls['mac-arm64'] + '\'; else U=\'' + p.urls['mac-x64'] + '\'; fi',
    'echo "Descargando MaKo en tu computadora..."',
    'curl -fsSL "$U" | gunzip > "$D/mako-pc.nuevo"',
    'chmod +x "$D/mako-pc.nuevo"',
    // En una Mac con chip de Apple, un ejecutable sin firma no corre: se le pone la firma local (ad-hoc).
    'codesign --force --sign - "$D/mako-pc.nuevo" 2>/dev/null || true',
    `"$D/mako-pc.nuevo" emparejar '${codigo}' --servidor '${p.servidor}' --nombre "$(scutil --get ComputerName 2>/dev/null || hostname)" < /dev/null || { rm -f "$D/mako-pc.nuevo"; echo "${otroCodigo}"; exit 1; }`,
    'if [ "$MAKO_PC_SI" = "1" ]; then SI=s; else printf "¿Es tu negocio? Escribe s y aprieta Enter para conectarla: "; read -r SI < /dev/tty || SI=; fi',
    `case "$SI" in [sS]*) ;; *) "$D/mako-pc.nuevo" cancelar < /dev/null || true; rm -f "$D/mako-pc.nuevo"; echo "${noLaConecte}"; exit 1 ;; esac`,
    `"$D/mako-pc.nuevo" confirmar < /dev/null || { rm -f "$D/mako-pc.nuevo"; echo "${noConfirme}"; exit 1; }`,
    `trap '[ -f "$P" ] && launchctl load "$P" 2>/dev/null; rm -f "$D/mako-pc.nuevo"' EXIT`,
    'launchctl unload "$P" 2>/dev/null || true',
    'mv -f "$D/mako-pc.nuevo" "$D/mako-pc"',
    'cat > "$P" <<PLIST',
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0"><dict>',
    `<key>Label</key><string>${ARRANQUE_MAC}</string>`,
    '<key>ProgramArguments</key><array><string>$D/mako-pc</string></array>',
    // Relanza sólo si se CAYÓ: al desconectarla el programa sale con 0 y se queda quieto (con `true` la relanzaba cada
    // 10 s para siempre). El registro lo lleva el programa, con tope.
    '<key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>',
    '<key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>',
    '</dict></plist>',
    'PLIST',
    // Se carga YA, antes de la sesión y del login: cerrar la terminal después no lo deja apagado.
    'launchctl load "$P" 2>/dev/null || true',
    'C="$HOME/.local/bin/claude"; [ -x "$C" ] || C="$(command -v claude || true)"',
    'E=0; "$D/mako-pc" sesion < /dev/null || E=$?',
    'if [ "$E" = "2" ] && [ -n "$C" ]; then echo "Inicia sesión con tu cuenta de Claude: se abre el navegador."; "$C" auth login < /dev/tty || true; E=0; "$D/mako-pc" sesion < /dev/null || E=$?; fi',
    `if [ "$E" = "0" ]; then echo "${listo}"; elif [ "$E" = "3" ]; then echo "${faltaClaude}"; else echo "${faltaSesion}"; fi`,
  ].join('\n');
}

/** Pasado este % de las 5 horas, una cuenta se usa sólo si no hay otra (scripts/ia-pc/mako-pc.mjs tiene la copia). */
export const TOPE_CUPO = 95;
/**
 * De varias cuentas, la de más cupo: la de menos uso de las 5 horas. Una cuya ventana ya se repuso (`repone` pasó) cuenta
 * como libre: antes quedaba descartada PARA SIEMPRE, porque sin turnos nada la volvía a medir (revisión del 21/10/2026).
 * Si todas están al tope, igual se usa la de menos uso: que Claude conteste su límite, con la hora en que se repone.
 */
export function cuentaConCupo<T extends { usado5h?: number; usadoSemana?: number; repone?: string; reponeSemana?: string }>(cuentas: readonly T[], ahora = Date.now()): T | null {
  if (!cuentas.length) return null;
  const uso = (c: T) => (c.repone && Date.parse(c.repone) <= ahora ? 0 : (c.usado5h ?? 0));
  // La semana, igual: una que ya se repuso deja de contar como llena (antes, un 100 % semanal viejo no se borraba nunca).
  const semana = (c: T) => (c.reponeSemana && Date.parse(c.reponeSemana) <= ahora ? 0 : (c.usadoSemana ?? 0));
  const libres = cuentas.filter((c) => uso(c) < TOPE_CUPO && semana(c) < 100);
  return (libres.length ? libres : cuentas).reduce((a, b) => (uso(b) < uso(a) ? b : a));
}

/** Qué fue lo que no salió en Claude (la PC tiene la copia): su límite de uso, o su sesión. null = otra cosa. */
export function falloDeClaude(error: unknown, limites: { usado5h?: number; usadoSemana?: number } = {}): TipoFalloPc | null {
  const e = String(error ?? '');
  if ((limites.usado5h ?? 0) >= 100 || (limites.usadoSemana ?? 0) >= 100 || /usage limit|rate.?limit|hit your limit|limit reached|l[ií]mite/i.test(e)) return 'tope';
  if (/\/login|not logged|log ?in|logged out|authenticat|oauth|credential|invalid api key/i.test(e)) return 'sesion';
  return null;
}

/** ¿Ya pasó la hora? Un «Se reinicia a las 15:30» pasadas las 15:30 es mentira: el % de esa ventana ya no vale. */
export const yaPaso = (iso: string | null | undefined, ahora: number): boolean => !iso || !(Date.parse(iso) > ahora);
/**
 * Lo que dice la tarjeta de una PC (computadora y teléfono): en línea sin una cuenta con sesión no contesta nada, así
 * que no se la llama «En línea» (revisión del 21/10/2026: el tutorial decía «¡Listo!» con una PC que nunca iba a contestar).
 */
export function estadoDeLaPc(pc: { enLinea: boolean; ultimoLatido: string | null; cuentas: readonly unknown[]; sinClaude?: boolean }, ahora: number, hace: (t: number, ahora: number) => string): string {
  // Sin Claude Code instalado no es «sin sesión»: el paso que falta es el 2, no el 3 (segunda revisión, 21/10/2026).
  if (pc.enLinea) return pc.cuentas.length ? 'En línea' : pc.sinClaude ? 'Falta instalar Claude' : 'Sin sesión de Claude';
  return pc.ultimoLatido ? `Sin conexión · ${hace(Date.parse(pc.ultimoLatido), ahora)}` : 'Esperando que se conecte';
}

/** ¿Le sirve el turno a esta PC? En línea Y con una cuenta con sesión: «en línea» sin Claude no contesta nada. */
export const pcUsable = (pc: { enLinea: boolean; cuentas: readonly unknown[] } | null | undefined): boolean => !!pc && pc.enLinea && pc.cuentas.length > 0;

/**
 * A QUÉ COMPUTADORA VA EL TURNO, con varias (22/10/2026, Martín: «el usuario debería poder abrir y ejecutar su Claude en varios
 * dispositivos»). Primero las que contestan (`pcUsable`); entre ésas, la que contestó el ÚLTIMO turno (la que la persona está
 * usando), y sin turnos, la última conectada. Antes era «la que latió último»: con dos prendidas, cada 30 s ganaba otra, y
 * el turno saltaba de un Claude a otro. Si ninguna contesta, la que latió último: el turno dice «apagada» o «sin sesión».
 * `ultimoTurno`: por id, su último turno TERMINADO (cuándo, y si contestó bien).
 *
 * Revisión adversarial (22/10/2026): mirando sólo los turnos contestados bien, una que llegó al tope o se colgó (pero sigue
 * latiendo) seguía siendo «la del último turno», y cada turno iba ahí a fallar mientras la otra, que sí contesta, no
 * recibía ninguno. Ahora la que falló su último turno, o tiene la cuenta agotada (100% de las 5 horas o de la semana), va
 * al final; entre las que fallaron, primero la que falló hace más (así, con las dos fallando, se turnan).
 */
export function elegirPc<T extends { id: number; enLinea: boolean; cuentas: readonly unknown[]; ultimoLatido: string | null; conectadaAt?: string | null }>(
  pcs: readonly T[], ultimoTurno: ReadonlyMap<number, { at: string; ok: boolean }>,
): T | null {
  const ms = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);
  const usables = pcs.filter(pcUsable);
  if (usables.length) {
    const sana = (p: T) => !cuentasAgotadas(p.cuentas) && ultimoTurno.get(p.id)?.ok !== false;
    return [...usables].sort((a, b) => {
      if (sana(a) !== sana(b)) return sana(a) ? -1 : 1;
      const t = ms(ultimoTurno.get(b.id)?.at) - ms(ultimoTurno.get(a.id)?.at);
      return (sana(a) ? t : -t) || ms(b.conectadaAt) - ms(a.conectadaAt) || b.id - a.id;
    })[0];
  }
  return [...pcs].sort((a, b) => ms(b.ultimoLatido) - ms(a.ultimoLatido) || b.id - a.id)[0] ?? null;
}

/** ¿Todas sus cuentas llegaron al 100% (de las 5 horas o de la semana)? Así no contesta, aunque lata. */
export function cuentasAgotadas(cuentas: readonly unknown[]): boolean {
  const agotada = (c: unknown) => {
    const u = (c ?? {}) as { usado5h?: unknown; usadoSemana?: unknown };
    return (typeof u.usado5h === 'number' && u.usado5h >= 100) || (typeof u.usadoSemana === 'number' && u.usadoSemana >= 100);
  };
  return cuentas.length > 0 && cuentas.every(agotada);
}

/**
 * El sistema de la PC, de su versión: el programa desde la 0.4.0 manda `0.4.0+windows` o `0.4.0+mac` en el latido (sin
 * migración: el campo ya acepta el `+`). Las de antes no lo dicen: null, y no se muestra.
 */
export function sistemaDeLaVersion(version: string | null | undefined): 'Windows' | 'Mac' | null {
  const m = /\+(windows|mac)$/i.exec(String(version ?? ''));
  return m ? (m[1].toLowerCase() === 'mac' ? 'Mac' : 'Windows') : null;
}

/**
 * Una PC de un negocio, para el super admin (SuperAdmin › Uso → Computadoras). Sin ningún secreto: el email de sus cuentas va
 * ENTERO porque el super admin lo puede ver (decisión del Cerebro, 22/10/2026), y su ubicación es sólo ciudad, provincia y país.
 */
export type PcDeNegocio = {
  id: number; ws: number; negocio: string; persona: string; nombre: string; sistema: 'Windows' | 'Mac' | null;
  enLinea: boolean; conClaude: boolean; conectadaAt: string | null; ultimoLatido: string | null;
  cuentas: CuentaPc[]; ubicacion: string | null; version: string | null;
};

// ── Dónde está cada dispositivo (23/10/2026) ───────────────────────────────────
// Martín: «Cada dispositivo muestra su UBICACIÓN como lo hace Google en "Tus dispositivos": "Grandbourg, Buenos Aires,
// Argentina"». Sale de los headers de geolocalización que Vercel le pone al latido (lib/graficos-datos-puro.ts →
// `ubicacionDeHeaders`, que nunca lee la IP). ⚠️ DATO PERSONAL: sólo ciudad, provincia y país, como texto; nunca la IP ni
// las coordenadas (supabase/migrations/0327_ia_pc_ubicacion.sql). Lo que no se sabe, no se muestra.

/** Las provincias de Argentina por su código ISO 3166-2 (lo que manda `x-vercel-ip-country-region`). */
export const PROVINCIAS_AR: Readonly<Record<string, string>> = {
  A: 'Salta', B: 'Buenos Aires', C: 'Ciudad de Buenos Aires', D: 'San Luis', E: 'Entre Ríos', F: 'La Rioja',
  G: 'Santiago del Estero', H: 'Chaco', J: 'San Juan', K: 'Catamarca', L: 'La Pampa', M: 'Mendoza', N: 'Misiones',
  P: 'Formosa', Q: 'Neuquén', R: 'Río Negro', S: 'Santa Fe', T: 'Tucumán', U: 'Chubut', V: 'Tierra del Fuego',
  W: 'Corrientes', X: 'Córdoba', Y: 'Jujuy', Z: 'Santa Cruz',
};

/** El nombre del país en español («Argentina», «México»), o null. */
export function nombreDePais(iso2: string): string | null {
  try { return new Intl.DisplayNames(['es'], { type: 'region' }).of(iso2.toUpperCase()) ?? null; } catch { return null; }
}

/**
 * «Grandbourg, Buenos Aires, Argentina», como Google: ciudad, provincia y país; lo que no viene se saltea, y un nombre que se
 * repite va una vez («Córdoba, Argentina»). La provincia, sólo donde se sabe su nombre (Argentina y México); si no, nada.
 */
export function textoDeUbicacion(u: { pais: string | null; region: string | null; ciudad: string | null } | null | undefined): string | null {
  if (!u?.pais) return null;
  const pais = u.pais.toUpperCase();
  const region = !u.region ? null : pais === 'AR' ? PROVINCIAS_AR[u.region.toUpperCase()] ?? null : pais === 'MX' ? ESTADOS_MX[`MX-${u.region.toUpperCase()}`] ?? null : null;
  const partes: string[] = [];
  for (const p of [u.ciudad, region, nombreDePais(pais)]) {
    // Ni control (U+0000–U+001F, U+007F), ni los invisibles de ancho cero, ni los que invierten la dirección del texto (U+202A–
    // U+202E, U+2066–U+2069), ni < > (revisión de privacidad, 23/10/2026: deformaban cómo se lee en la pantalla del admin).
    const t = bienFormado((p ?? '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff<>]/g, '')).trim();
    if (t && !partes.some((x) => x.toLowerCase() === t.toLowerCase())) partes.push(t);
  }
  return partes.length ? bienFormado(partes.join(', ').slice(0, 120)) : null;
}

/** Sin medios caracteres sueltos: cortar un texto puede partir un emoji en dos, y la base no acepta la mitad. */
const bienFormado = (s: string): string => ((s as { toWellFormed?: () => string }).toWellFormed?.() ?? s).replace(/\ufffd/g, '');

// ── Las cuentas y sus dispositivos (23/10/2026) ───────────────────────────────
// Martín: cada cuenta conectada es UN bloque, «Cuenta 1», «Cuenta 2» (no el nombre de la PC), con su email, su plan y su uso;
// adentro, sus DISPOSITIVOS. Se agrupa en el SERVIDOR: quien mira recibe el email ajeno enmascarado, y con eso no se puede
// agrupar (dos «m***@gmail.com» pueden ser dos cuentas).

/** Una PC tal cual se agrupa: lo de la tarjeta, con sus cuentas SIN enmascarar. */
export type PcParaAgrupar = {
  id: number; nombre: string; esMia: boolean; de?: string; enLinea: boolean; ultimoLatido: string | null; version: string | null;
  sistema: 'Windows' | 'Mac' | null; ubicacion: string | null; conectadaAt: string | null; sinClaude?: boolean; cuentas: readonly CuentaPc[];
  /** De quién es la PC: sólo para agrupar (no sale en el dispositivo). */
  persona?: string;
};
/** Un dispositivo de «Tus cuentas de IA». `conCuenta`: su Claude tiene la sesión (alguna cuenta). */
export type DispositivoIA = Omit<PcParaAgrupar, 'cuentas' | 'persona'> & { conCuenta: boolean };
/** Una cuenta (de Claude o de ChatGPT) con sus dispositivos. `numero`: «Cuenta 1», por orden de conexión. */
export type CuentaIA = CuentaPc & { numero: number; dispositivos: DispositivoIA[] };
export type CuentasIA = { cuentas: CuentaIA[]; sinCuenta: DispositivoIA[] };

/** «Windows · Grandbourg, Buenos Aires, Argentina», como Google: lo que se sabe; sin nada, null (y no se muestra). */
export const dondeEsta = (d: { sistema?: string | null; ubicacion?: string | null }): string | null => [d.sistema, d.ubicacion].filter(Boolean).join(' · ') || null;

/**
 * Las PC, por cuenta: la misma cuenta en dos computadoras es UN bloque con dos dispositivos, y una PC con dos cuentas está en
 * las dos. Orden: la cuenta del primer dispositivo conectado es la «Cuenta 1». El uso (5 horas, semana) es el del dispositivo
 * que latió último. El email, entero sólo si `verEmail` vale para alguno de sus dispositivos (el suyo, o el super admin); si
 * no, enmascarado. Las PC sin ninguna cuenta (sin Claude, o sin la sesión) van aparte, en `sinCuenta`.
 */
export function agruparPorCuenta(pcs: readonly PcParaAgrupar[], verEmail: (pc: PcParaAgrupar) => boolean): CuentasIA {
  const ms = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);
  const dispositivo = (pc: PcParaAgrupar): DispositivoIA => { const { cuentas, persona: _persona, ...d } = pc; return { ...d, conCuenta: cuentas.length > 0 }; };
  const grupos = new Map<string, { pcs: PcParaAgrupar[]; cuenta: CuentaPc; latido: number }>();
  const sinCuenta: DispositivoIA[] = [];
  for (const pc of pcs) {
    if (!pc.cuentas.length) { sinCuenta.push(dispositivo(pc)); continue; }
    for (const c of pc.cuentas) {
      // Por PERSONA y email (revisión de privacidad, 23/10/2026): el email lo declara la PC, y un miembro podía meter la suya en el
      // bloque del admin con el email de él (y su uso pasaba por el del admin).
      const clave = c.email ? `${c.proveedor}:${pc.persona ?? ''}:${c.email.trim().toLowerCase()}` : `${c.proveedor}:pc${pc.id}`;
      const g = grupos.get(clave) ?? { pcs: [], cuenta: c, latido: -1 };
      if (!g.pcs.includes(pc)) g.pcs.push(pc);
      if (ms(pc.ultimoLatido) > g.latido) { g.cuenta = c; g.latido = ms(pc.ultimoLatido); }
      grupos.set(clave, g);
    }
  }
  const primero = (g: { pcs: PcParaAgrupar[] }) => Math.min(...g.pcs.map((p) => ms(p.conectadaAt) || Number.MAX_SAFE_INTEGER));
  const menorId = (g: { pcs: PcParaAgrupar[] }) => Math.min(...g.pcs.map((p) => p.id));
  const cuentas = [...grupos.values()]
    .sort((a, b) => primero(a) - primero(b) || menorId(a) - menorId(b))
    .map((g, i): CuentaIA => {
      const { email, ...resto } = g.cuenta;
      const ver = g.pcs.some(verEmail);
      return { ...resto, ...(email ? { email: ver ? email : enmascararEmail(email) } : {}), numero: i + 1, dispositivos: g.pcs.map(dispositivo) };
    });
  return { cuentas, sinCuenta };
}
export type LecturaComputadoras = { ok: true; pcs: PcDeNegocio[] } | { ok: false; error: string };

/**
 * El email de la cuenta de Claude de OTRA persona, enmascarado: `m***@gmail.com` (decisión del Cerebro, 22/10/2026). El admin
 * del negocio ve de las computadoras de su equipo el nombre, de quién es, si está en línea, el plan y el % de uso —lo necesita
 * para manejar la capacidad—, pero el email de su Claude es un dato personal. Sin «@», `***`.
 */
export function enmascararEmail(email: string): string {
  const i = email.lastIndexOf('@');
  return i > 0 ? `${email[0]}***${email.slice(i)}` : '***';
}

/**
 * Las cuentas de una PC tal cual las ve quien mira: el email entero sólo con `verEmail` (es SU computadora, o es el super
 * admin); si no, enmascarado. Lo demás (plan, % de uso, cuándo se repone) va igual.
 */
export function cuentasParaVer<T extends { email?: string }>(cuentas: readonly T[], verEmail: boolean): T[] {
  return verEmail ? [...cuentas] : cuentas.map((c) => (c.email ? { ...c, email: enmascararEmail(c.email) } : c));
}

/** La línea de debajo del nombre: el sistema y cuándo se conectó. Sin dato, no se muestra. */
export function detalleDeLaPc(pc: { sistema?: string | null; conectadaAt?: string | null }, fecha: (iso: string) => string): string | null {
  const partes = [pc.sistema ?? null, pc.conectadaAt ? `conectada el ${fecha(pc.conectadaAt)}` : null].filter(Boolean);
  return partes.length ? partes.join(' · ') : null;
}

/** Lo que dice el chat cuando el turno era de la computadora de la persona y no salió (docs/ia-del-cliente.md §5). */
export const AVISO_PC_APAGADA = 'Tu computadora está apagada: préndela y mándamelo de nuevo.';
export const AVISO_PC_TARDE = 'Tu Claude tardó demasiado: mándamelo de nuevo.';
export const AVISO_PC_ERROR = 'Tu Claude no pudo contestar ahora: mándamelo de nuevo en un rato.';
export const AVISO_PC_SIN_SESION = 'Tu Claude no tiene la sesión iniciada en tu computadora: inicia sesión desde «Tus cuentas de IA» y mándamelo de nuevo.';
/** El negocio pasó su tope de turnos por minuto (§3, regla 6). */
export const AVISO_PC_MUCHOS = 'Me mandaron muchos pedidos seguidos: espera un minuto y mándamelo de nuevo.';
/** En la PC no hay Claude Code (el paso que falta es el 2). */
export const AVISO_PC_SIN_CLAUDE = 'Tu computadora no tiene Claude Code instalado: instálalo (paso 2 de «Tus cuentas de IA») y mándamelo de nuevo.';
/** La desconectaron a mitad del turno («Desconectar»): el pedido se cortó, no «tardó». */
export const AVISO_PC_DESCONECTADA = 'Esta computadora se desconectó de MaKo y el pedido se cortó.';
/** No se pudo leer la PC de la persona (un bache de la base): no se le pide que conecte la que ya tiene. */
export const AVISO_PC_ILEGIBLE = 'No pude ver tu computadora ahora: mándamelo de nuevo en un momento.';
/**
 * Por qué no contestó la PC: el tipo que manda ella (`tope`, `sesion`), o lo que vio el servidor (no la tomó o dejó de
 * latir: `apagada`; no volvió a tiempo: `tarde`; el negocio pasó su tope: `muchos`; no tiene Claude: `sin-claude`; la
 * desconectaron: `desconectada`).
 */
export type FalloDeLaPc = 'tarde' | 'error' | 'apagada' | 'muchos' | 'sin-claude' | 'desconectada' | TipoFalloPc;
/** «Tu Claude llegó a su límite de uso: se repone a las 15:30» (o «mañana», o «el jueves»), en la hora del negocio. */
export function avisoTope(repone: string | null | undefined, tz: string, ahora = Date.now()): string {
  const t = repone ? Date.parse(repone) : NaN;
  if (!Number.isFinite(t) || t <= ahora) return 'Tu Claude llegó a su límite de uso: se repone solo en unas horas. Mándamelo de nuevo más tarde.';
  const hora = new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(t);
  const dia = (x: number) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(x);
  const dias = Math.round((Date.parse(dia(t)) - Date.parse(dia(ahora))) / 86_400_000);
  const cuando = dias <= 0 ? '' : dias === 1 ? 'mañana ' : `el ${new Intl.DateTimeFormat('es', { weekday: 'long', timeZone: tz }).format(t)} `;
  return `Tu Claude llegó a su límite de uso: se repone ${cuando}a las ${hora}.`;
}
export function avisoDeLaPc(fallo: FalloDeLaPc | null, apagada: boolean, extra: { repone?: string | null; tz?: string } = {}): string | null {
  if (fallo === 'tarde') return AVISO_PC_TARDE;
  if (fallo === 'error') return AVISO_PC_ERROR;
  if (fallo === 'muchos') return AVISO_PC_MUCHOS;
  if (fallo === 'sin-claude') return AVISO_PC_SIN_CLAUDE;
  if (fallo === 'desconectada') return AVISO_PC_DESCONECTADA;
  if (fallo === 'sesion') return AVISO_PC_SIN_SESION;
  if (fallo === 'tope') return avisoTope(extra.repone, extra.tz ?? 'UTC');
  return fallo === 'apagada' || apagada ? AVISO_PC_APAGADA : null;
}

/** El MCP de MaKo para ESTE turno: por HTTP al servidor, con el token del turno. */
export function mcpDelTurno(url: string, token: string): { mcpServers: Record<string, unknown> } {
  return { mcpServers: { mako: { type: 'http', url, headers: { Authorization: `Bearer ${token}` } } } };
}
