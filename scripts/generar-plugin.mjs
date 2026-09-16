// =============================================================================
// generar-plugin — arma el contenido del repo PÚBLICO del plugin de MaKo
// =============================================================================
//   node scripts/generar-plugin.mjs           escribe plugin/
//   node scripts/generar-plugin.mjs --check   falla si quedó viejo (lo usa el pre-push)
//
// El plugin es la forma normal de instalar una skill: el cliente hace
// `/plugin marketplace add <owner>/mako-plugin` y listo. Para eso el repo tiene que ser
// PÚBLICO, y por eso la skill que va ahí es la GENÉRICA: sin token adentro.
//
// ⚠️ POR QUÉ SE GENERA Y NO SE ESCRIBE A MANO. Es el mismo texto que sirve
// /api/agente/skill con el token embebido. Dos copias del contrato de una skill es
// exactamente el bug que este repo ya pagó con el `detalle`: se actualiza una, nadie
// toca la otra, y desde el otro camino sale mal durante días sin que nada avise. Acá
// sale de `agenteSkillMarkdown(base, null)` y el `--check` del pre-push impide que se
// separen.
//
// ⚠️ Y ANTES DE ESCRIBIR, SE VERIFICA QUE NO HAYA CREDENCIALES. Este archivo va a un
// repo público: un `mkoag_` que se cuele ahí queda en el historial de git para siempre,
// y rotarlo después no lo borra. La guarda está en POSITIVO —se busca el patrón de un
// token, no se confía en que la función haga lo correcto— porque el costo de un falso
// negativo es una credencial publicada.
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = path.join(RAIZ, 'plugin');
const BASE = 'https://hola-mako.com';

const { agenteSkillMarkdown } = await import('../lib/agente-skill.ts');

const skill = agenteSkillMarkdown(BASE, null);

// ── LA GUARDA ───────────────────────────────────────────────────────────────
const sospechas = [
  // Con o sin la letra del alcance (mkoag_e_…, lib/api-mako/alcance.ts).
  [/mkoag_(?:[lpe]_)?[0-9a-f]{8,}/i, 'un token de agente'],
  [/sk-ant-[\w-]{8,}/i, 'una API key de Anthropic'],
  [/eyJ[\w-]{20,}\.[\w-]{20,}/, 'un JWT'],
  [/localhost|127\.0\.0\.1/, 'una URL de desarrollo'],
];
for (const [re, que] of sospechas) {
  const m = re.exec(skill);
  if (m) {
    console.error(`\n  ✖ NO SE GENERA: la skill contiene ${que} (${m[0].slice(0, 18)}…).`);
    console.error('    Este archivo va a un repo PÚBLICO y git no olvida.\n');
    process.exit(1);
  }
}

const MARKETPLACE = {
  name: 'mako',
  owner: { name: 'MaKo', url: BASE },
  plugins: [
    {
      name: 'mako',
      source: './',
      description: 'Claude trabaja con tu negocio adentro: tu oferta, tu cliente ideal, tus razones de compra y tu plan.',
      version: '1.0.0',
      author: { name: 'MaKo', url: BASE },
    },
  ],
};

const PLUGIN = {
  name: 'mako',
  description: 'El negocio del cliente —oferta, cliente ideal, avatares, razones de compra, voz de marca y plan— disponible en cualquier conversación.',
  version: '1.0.0',
  author: { name: 'MaKo', url: BASE },
  homepage: BASE,
};

const LEEME = `# MaKo para Claude

Conecta tu negocio a Claude: tu oferta, tu cliente ideal, tus avatares, tus razones de
compra, tu catálogo con precios, cómo suena tu marca y tu plan de trabajo. Dejás de
contarle tu negocio en cada chat.

## Instalar

\`\`\`
/plugin marketplace add mbustos-digital/mako-plugin
/plugin install mako@mako
\`\`\`

## Tu token

La primera vez que Claude necesite tus datos te va a pedir tu token. Lo sacás de
**${BASE}/integraciones → Claude**, con un click. Se guarda en \`~/.mako-token\` y no te
lo vuelve a pedir.

El token identifica tu espacio y **no viaja en este repo**: por eso podés instalar esto
sin que nadie vea tus datos.

## Qué puede hacer

- **Leer tu negocio** — oferta, cliente ideal, fase, gancho, catálogo y voz de marca.
- **Leer secciones grandes bajo demanda** — la matriz de avatares × razones de compra,
  lo que MaKo entendió de tus documentos, o el catálogo completo.
- **Leer tu plan abierto** para no proponerte algo que ya está anotado.
- **Proponerte tareas**, cierres de lo que ya hiciste y detalle sobre lo que ya está.
  Nunca las crea solas: deja un borrador que revisás vos.

---

_Generado desde el repo de MaKo con \`scripts/generar-plugin.mjs\`. No se edita a mano:
la skill vive en \`lib/agente-skill.ts\` y esta copia se regenera desde ahí._
`;

const archivos = [
  ['.claude-plugin/marketplace.json', `${JSON.stringify(MARKETPLACE, null, 2)}\n`],
  ['.claude-plugin/plugin.json', `${JSON.stringify(PLUGIN, null, 2)}\n`],
  ['skills/mako/SKILL.md', skill],
  ['README.md', LEEME],
];

const check = process.argv.includes('--check');
let viejos = 0;

for (const [rel, contenido] of archivos) {
  const destino = path.join(DESTINO, rel);
  const actual = fs.existsSync(destino) ? fs.readFileSync(destino, 'utf8') : null;
  // ⚠️ SIN LOS `\r`, igual que sus dos guards hermanos (`sync-contrato-detalle.mjs` y
  //    `sync-gramatica-doc.mjs`). El archivo se genera con `\n` y git lo deja en CRLF al
  //    sacarlo (`core.autocrlf=true`), así que en el clon donde el script corrió coincide
  //    y en un árbol recién checkouteado —un clon nuevo, un worktree— no, sobre un
  //    contenido IDÉNTICO. Los tres frenaban el push de cualquiera que reclonara.
  const sinCR = (s) => (s === null ? null : s.replace(/\r\n/g, '\n'));
  if (sinCR(actual) === sinCR(contenido)) continue;
  if (check) {
    console.error(`  ✖ plugin/${rel} quedó viejo`);
    viejos += 1;
    continue;
  }
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, contenido);
  console.log(`  ✓ plugin/${rel}`);
}

if (check && viejos) {
  console.error('\n  Corré: node scripts/generar-plugin.mjs\n');
  process.exit(1);
}
console.log(check ? '  ✓ plugin/ al día' : `\n  Listo. ${skill.length} caracteres de skill, sin credenciales.`);
