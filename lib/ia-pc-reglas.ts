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
 */
export const ARGS_CLAUDE: readonly string[] = [
  '-p', '--output-format', 'json', '--no-session-persistence',
  '--tools', '', '--strict-mcp-config', '--allowedTools', 'mcp__mako', '--max-turns', '12',
  '--model', 'sonnet',
];

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
