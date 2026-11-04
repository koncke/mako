// =============================================================================
// claves-en-el-diff — ninguna clave real llega a GitHub (01/11/2026, auditoría de seguridad)
// =============================================================================
// Mira las líneas AGREGADAS en lo que se va a publicar (de la base contra HEAD: commits, nunca el disco, por la regla
// de las guardas del push) y frena si alguna tiene la FORMA de una clave: sk-ant-, sk-proj-, sk-or-v1-, re_…_…, ghp_,
// github_pat_, AIza…, xox?-, EAA…, whsec_, sk_live_/rk_live_, una clave privada PEM, una URL de base con contraseña,
// tskey- o una asignación tipo .env (`ALGO_KEY=valor-largo`). Imprime archivo y línea, NUNCA el valor.
//
// Por qué hace falta aunque `.env*` esté en el .gitignore: el 28/10/2026 el sync automático del VPS publicó en el
// repo del Estudio un `.en-7` —una copia del .env de producción con otro nombre— y nada lo vio. Un nombre se puede
// llamar de cualquier forma; el valor de una clave no.
//
// Uso: node scripts/claves-en-el-diff.mjs [base]   (default: el merge-base con origin/main)
//      node scripts/claves-en-el-diff.mjs --todo   (barre TODO el árbol de HEAD: para medir falsos positivos)
// Una línea que de verdad es un dato de prueba se marca con el comentario `claves-en-el-diff: ok` en la misma línea.
// =============================================================================

import { execFileSync } from 'node:child_process';

export const PATRONES = [
  ['clave de Anthropic', /sk-ant-[A-Za-z0-9_-]{20,}/],
  ['clave de OpenAI', /sk-proj-[A-Za-z0-9_-]{20,}/],
  ['clave de OpenRouter', /sk-or-v1-[A-Za-z0-9]{20,}/],
  ['clave sk-', /(?<![A-Za-z0-9_])sk-[A-Za-z0-9]{40,}/],
  ['clave de Resend', /(?<![A-Za-z0-9_])re_[A-Za-z0-9]{8}_[A-Za-z0-9]{16,}/],
  ['token de GitHub', /(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/],
  ['clave de Google', /AIza[0-9A-Za-z_-]{35}/],
  ['token de Slack', /xox[bpas]-[A-Za-z0-9-]{20,}/],
  ['token de Meta', /(?<![A-Za-z0-9_])EAA[A-Za-z0-9]{60,}/],
  ['secreto de webhook', /whsec_[A-Za-z0-9]{20,}/],
  ['clave viva de Stripe', /(?:sk|rk)_live_[A-Za-z0-9]{20,}/],
  ['clave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['URL de base con contraseña', /postgres(?:ql)?:\/\/[^:/\s'"`]+:[^@\s'"`]{6,}@/],
  ['clave de Tailscale', /tskey-[A-Za-z0-9-]{20,}/],
  ['asignación tipo .env', /^\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)\s*=\s*['"]?[A-Za-z0-9_\-./+=]{16,}/],
];

const PERMISO = /claves-en-el-diff:\s*ok/;
// Lo que no es texto de nadie: lockfiles y artefactos generados.
const IGNORAR = /(^|\/)(package-lock\.json|.*\.min\.js|.*\.map)$|^public\/replay\//;

/**
 * ¿El valor tiene cara de INVENTADO? Una clave real es azar: no repite un carácter cinco veces seguidas, usa muchos
 * caracteres distintos y no dice PRUEBA ni CUENTA. Los tests de la casa arman sus claves así («sk-ant-api03-cuenta1-…
 * aaaaaa», «rk_live_CUENTA…»), y frenar cada test nuevo enseñaría a saltear la guarda. Medido el 01/11/2026 sobre el árbol
 * entero: sin este filtro, 82 líneas; con él, las que quedan son de verdad para mirar.
 */
export function pareceInventada(valor) {
  const cuerpo = valor.replace(/^(?:sk-ant-api\d\d-|sk-ant-|sk-proj-|sk-or-v1-|sk-|re_|ghp_|gho_|ghs_|ghu_|github_pat_|AIza|xox[bpas]-|EAA|whsec_|sk_live_|rk_live_|tskey-)/, '');
  if (/(.)\1{4,}/.test(cuerpo)) return true;
  if (/(PRUEBA|prueba|FALSA|falsa|FAKE|fake|TEST|test|EJEMPLO|ejemplo|CUENTA|cuenta|DUMMY|dummy|XXXX|xxxx|EXAMPLE|example)/.test(cuerpo)) return true;
  // Una palabra entre guiones («-plataforma-env», «-del-ws13-»): en 90 caracteres de base64url pasa una vez en ~10^5 claves.
  if (/(^|[-_])[a-z]{3,}[-_]|[-_][a-z]{4,}$/.test(cuerpo)) return true;
  return new Set(cuerpo).size < 12;
}

export function hallazgosEnLinea(linea) {
  if (PERMISO.test(linea)) return [];
  const out = [];
  for (const [nombre, re] of PATRONES) {
    const m = re.exec(linea);
    if (!m) continue;
    // Una URL de base o una clave PEM no tienen «cuerpo» que mirar: cuentan siempre.
    if (nombre !== 'URL de base con contraseña' && nombre !== 'clave privada' && pareceInventada(m[0].replace(/^[^A-Za-z0-9]/, '').replace(/^.*?=\s*['"]?/, (x) => (nombre === 'asignación tipo .env' ? '' : x)))) continue;
    out.push(nombre);
  }
  return out;
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

function baseDefault() {
  try { return git(['merge-base', 'HEAD', 'origin/main']).trim(); } catch { return null; }
}

function lineasAgregadas(base) {
  const diff = git(['diff', '--unified=0', '--no-color', '--no-ext-diff', `${base}`, 'HEAD']);
  const out = [];
  let archivo = null;
  let n = 0;
  for (const l of diff.split('\n')) {
    if (l.startsWith('+++ ')) { archivo = l.startsWith('+++ b/') ? l.slice(6) : null; continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l);
    if (h) { n = Number(h[1]); continue; }
    if (l.startsWith('+') && archivo) { out.push({ archivo, linea: n, texto: l.slice(1) }); n++; }
  }
  return out;
}

function todoElArbol() {
  const out = [];
  const archivos = git(['ls-files']).split('\n').filter(Boolean);
  for (const archivo of archivos) {
    if (IGNORAR.test(archivo)) continue;
    let texto;
    try { texto = git(['show', `HEAD:${archivo}`]); } catch { continue; }
    if (texto.includes('\u0000')) continue;
    texto.split('\n').forEach((t, i) => out.push({ archivo, linea: i + 1, texto: t }));
  }
  return out;
}

function main() {
  const arg = process.argv[2];
  let lineas;
  if (arg === '--todo') lineas = todoElArbol();
  else {
    const base = arg || baseDefault();
    if (!base) { console.log('  [claves] sin base contra la que comparar (no hay origin/main): no se miró nada.'); return 0; }
    lineas = lineasAgregadas(base);
  }
  const malos = [];
  for (const l of lineas) {
    if (IGNORAR.test(l.archivo)) continue;
    const h = hallazgosEnLinea(l.texto);
    if (h.length) malos.push(`${l.archivo}:${l.linea} — ${h.join(', ')}`);
  }
  if (!malos.length) { console.log(`  [claves] ✓ ${lineas.length} línea(s) miradas, ninguna con forma de clave.`); return 0; }
  console.log(`  [claves] ⛔ ${malos.length} línea(s) con forma de clave (el valor no se muestra):`);
  for (const m of malos.slice(0, 40)) console.log(`      ${m}`);
  console.log('  Si es una clave real: sacala del commit y ROTALA (ya está en tu historia local).');
  console.log('  Si es un dato de prueba inventado: armalo sin el literal ("sk-ant-" + "x".repeat(40)) o marcá la línea con «claves-en-el-diff: ok».');
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('claves-en-el-diff.mjs')) process.exit(main());
