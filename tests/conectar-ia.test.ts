// =============================================================================
// IA4 (22/10/2026): «Conectar tu IA» ofrece Claude y GPT, por la computadora o por clave
// =============================================================================
// El relevamiento del 22/10: el modal del botón del Ops Center ofrecía sólo la computadora con Claude y, al admin, la
// clave de Claude; la de OpenAI sólo se cargaba desde /integraciones. Ahora, un paso por pantalla (lib/conectar-ia-reglas.ts
// y app/integraciones/TusCuentasIA.tsx): ¿qué IA? → ¿cómo? Lo que fija este test:
//   1. Las cuatro vías: Claude por la computadora y por clave, ChatGPT por clave (y por la computadora, «Pronto», hasta IA11).
//   2. A quien no es admin la clave no se le ofrece: «Pídele a <admin> que conecte la IA del negocio».
//   3. El botón del Ops Center (escritorio, la estrella de cada tab y el teléfono) abre directo el paso 1, sin salir de la tab.
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · ChatGPT guardando en la clave de Anthropic → «las cuatro vías» en rojo;
//   · la clave ofrecida a quien no es admin → «a quien no es admin» en rojo;
//   · ChatGPT en la computadora antes de IA11 → «las cuatro vías» en rojo;
//   · el modal del Ops Center sin `conectar` → «el botón del Ops Center» en rojo;
//   · la clave fuera del paso a paso (el BotonIntegracion fijo en anthropic) → «el botón del Ops Center» en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHATGPT_EN_LA_PC, IAS_DEL_CLIENTE, SERVICIO_DE_CLAVE, comoConectar, notaDeConectar, pedirleAlAdmin } from '../lib/conectar-ia-reglas';
import { DEFS } from '../lib/integraciones-catalogo';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
/** Líneas `//` primero y bloques después (AGENTS.md: al revés se come los cierres de JSDoc). */
const sinComentarios = (s: string) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('las cuatro vías: Claude y ChatGPT, por la computadora o por la clave', () => {
  assert.deepEqual([...IAS_DEL_CLIENTE], ['claude', 'chatgpt']);
  assert.deepEqual(SERVICIO_DE_CLAVE, { claude: 'anthropic', chatgpt: 'openai' });
  const catalogo = new Set(DEFS.map((i) => i.key));
  for (const s of Object.values(SERVICIO_DE_CLAVE)) assert.ok(catalogo.has(s), `el modal de ${s} existe en /integraciones`);
  const claude = comoConectar('claude', { esAdmin: true });
  assert.deepEqual(claude.map((o) => [o.que, o.habilitada]), [['pc', true], ['clave', true]]);
  const gpt = comoConectar('chatgpt', { esAdmin: true });
  // ChatGPT en la computadora es IA11 (Codex): hasta entonces se ve y dice «Pronto».
  assert.equal(CHATGPT_EN_LA_PC, false);
  assert.deepEqual(gpt.map((o) => [o.que, o.habilitada, o.detalle === 'Pronto']), [['pc', false, true], ['clave', true, false]]);
  // La línea: la suscripción contesta el chat con la PC prendida; la clave hace que MaKo trabaje solo; Max trae crédito.
  assert.match(claude[0].detalle, /suscripción.*prendida/);
  assert.match(claude[1].detalle, /trabaja solo/);
  assert.match(notaDeConectar('claude') ?? '', /Claude Max trae crédito de API/);
  assert.equal(notaDeConectar('chatgpt'), null, 'ChatGPT Plus no trae crédito de API: no se promete');
});

test('a quien no es admin, la clave no se le ofrece: se le dice a quién pedírsela', () => {
  for (const ia of IAS_DEL_CLIENTE) {
    const o = comoConectar(ia, { esAdmin: false, admin: 'Mauricio' });
    assert.deepEqual(o.map((x) => x.que), ['pc', 'pedir']);
    assert.equal(o[1].habilitada, false);
    assert.equal(o[1].detalle, 'Pídele a Mauricio que conecte la IA del negocio.');
  }
  assert.equal(pedirleAlAdmin(''), 'Pídele al admin de tu negocio que conecte la IA del negocio.');
  // Y el nombre del admin viaja sólo a quien no lo es.
  const estado = sinComentarios(leer('app/api/ia-pc/estado/route.ts'));
  assert.match(estado, /const admin = esAdmin \? undefined : await nombreAdminDelNegocio\(persona\.ws\)/);
  assert.match(estado, /\.\.\.\(esAdmin \? \{ claves \} : \{ admin \}\)/);
});

test('el botón del Ops Center abre «¿Qué IA usas?» ahí mismo, y cada vía llega a su pantalla', () => {
  // El escritorio, la estrella de cada tab y el teléfono montan el mismo componente con `conectar`.
  assert.match(sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx')), /<TusCuentasIA sinCabecera conectar \/>/);
  assert.match(sinComentarios(leer('app/_chat/MakoEnLaTab.tsx')), /<TusCuentasIA sinCabecera conectar \/>/);
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /<TusCuentasIA sinCabecera conectar \/>/);
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // 23/10/2026 (Martín): sin el botón «Conectar tu IA»: «Nueva cuenta» muestra Claude y ChatGPT directo, siempre.
  assert.doesNotMatch(ui, />Conectar tu IA<\/button>/, 'volvió el botón «Conectar tu IA»');
  assert.match(ui, /<NuevaCuenta onElegir=\{setEligiendo\} \/>/);
  assert.match(ui, /\{IAS_DEL_CLIENTE\.map\(\(x\) => \(\s*<button key=\{x\} type="button" className="tci-grande" onClick=\{\(\) => onElegir\(x\)\}>/);
  assert.match(ui, /const \[ia, setIa\] = useState<IaDelCliente \| null>\(iaInicial \?\? null\);/, 'la IA elegida en «Nueva cuenta» no llega a «¿Cómo la conectas?»');
  // La clave: el modal de la integración de ESA IA (Claude → anthropic, ChatGPT → openai), sin salir de la tab.
  assert.match(ui, /<BotonIntegracion key=\{o\.que\} servicio=\{SERVICIO_DE_CLAVE\[ia\]\} className="tci-grande"/);
  assert.doesNotMatch(ui, /<BotonIntegracion servicio="anthropic"/, 'nada fijo en Claude');
  // La computadora: el tutorial de siempre.
  assert.match(ui, /onComputadora=\{\(ia\) => abrirTutorialEn\(1, ia\)\}/, 'el tutorial de la IA que eligió (la ola 3)');
  assert.match(ui, /onClick=\{o\.que === 'pc' \? \(\) => onComputadora\(ia\) : undefined\}/);
  assert.doesNotMatch(ui, /\b(tenés|podés|elegí|pedile|conectá|pegá)\b/i, 'de tú, no de vos');
});
