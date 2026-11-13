// =============================================================================
// El «Uso» del cliente en su Ops Center: sus cuentas de IA, conectar, desconectar y lo que gastó cada una (22/10/2026, D3)
// =============================================================================
// Martín: «Que vean el USO, para poder conectar si quieren más cuentas de Claude o GPT... O desconectar». El super admin tiene su
// «Uso» abajo de la barra (PieCentro); el cliente no tenía nada ahí.
//   1. lo que gastó cada clave: sólo las llamadas que CONTESTARON con SU clave (ni la plataforma, ni los fallos), en 30 días;
//   2. el modal de siempre, «Tus cuentas de IA», lo dice por clave, con «Cambiar o quitar» (el modal de su integración);
//   3. «Uso» abajo de la barra, como el del super admin, y en el teléfono una fila; abren el modal SIN ir directo a conectar.
//
// Correr: node --import tsx --test tests/ops-center-uso-cliente.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARCA_SU_CLAVE, PREFIJO_FALLO, estadoDeSuClave, textoDelGasto } from '../lib/su-clave-reglas';
import { MOTIVO_CREDITO_SU_CLAVE } from '../lib/veto-claude';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. lo que gastó cada clave: sólo lo que contestó con SU clave, ni la plataforma ni los fallos', () => {
  const suya = (c: number, at = '2026-10-22T10:00:00Z') => ({ created_at: at, provider: 'anthropic', model: 'claude-haiku', motivo: `${MARCA_SU_CLAVE.anthropic} chat`, cost_usd: c });
  const filas = [
    suya(0.5), suya(0.25, '2026-10-21T10:00:00Z'),
    { created_at: '2026-10-22T11:00:00Z', provider: 'anthropic', model: 'claude-sonnet', motivo: 'el Claude de MaKo', cost_usd: 10 },
    { created_at: '2026-10-22T12:00:00Z', provider: 'anthropic', model: `${PREFIJO_FALLO}401`, motivo: `${MARCA_SU_CLAVE.anthropic} falló: sin crédito`, cost_usd: 1 },
    { created_at: '2026-10-22T09:00:00Z', provider: 'openai', model: 'gpt-4o-mini', motivo: 'chat', cost_usd: 3 },
  ];
  assert.equal(estadoDeSuClave('anthropic', filas).gastado, 0.75, 'ni el Claude de MaKo, ni el fallo, ni otra IA');
  assert.equal(estadoDeSuClave('openai', filas).gastado, 3);
  // Los motivos tal cual están en producción (medido el 22/10/2026): el crédito del onboarding también empieza con «⚠ crédito de
  // Claude de la plataforma», pero lo paga MaKo y no se le cuenta al negocio; el crédito que ES su clave (el ws10) sí.
  const regalo = { created_at: '2026-10-22T08:00:00Z', provider: 'anthropic', model: 'claude-haiku-4-5', motivo: '⚠ crédito de Claude de la plataforma (cuenta 1) · Offer: conversar con el dueño', cost_usd: 2 };
  const suCredito = { ...regalo, motivo: `${MOTIVO_CREDITO_SU_CLAVE} · Crear una automatización con IA`, cost_usd: 0.5 };
  assert.equal(estadoDeSuClave('anthropic', [regalo]).gastado, 0, 'el crédito del onboarding no es gasto del negocio');
  assert.equal(estadoDeSuClave('anthropic', [regalo, suCredito]).gastado, 0.5, 'el crédito que es su clave, sí');
  assert.equal(textoDelGasto(0.75), 'Gastó US$ 0.75 en los últimos 30 días');
  assert.equal(textoDelGasto(0), 'Sin gasto en los últimos 30 días', 'sin gasto se dice');
  // Lo lee de 30 días, con el costo, y con lugar para un negocio con uso.
  const db = sinComentarios(leer('lib/su-clave.ts'));
  assert.match(db, /\.select\('created_at, provider, model, motivo, cost_usd'\)/);
  assert.match(db, /\.limit\(2000\);/);
});

test('2. «Tus cuentas de IA» muestra el USO de cada cuenta, y ya no las claves (23/10/2026)', () => {
  const modal = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // Martín, 23/10: «Fuera "Tu clave de Claude"... Si no le sirven al cliente, no van». El uso que ve es el de cada cuenta.
  assert.doesNotMatch(modal, /SusClaves|textoDelGasto|Tu clave de/, 'volvieron las claves al panel del cliente');
  assert.match(sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx')), /<Barra titulo="Sesión de 5 horas" pct=\{cuenta\.usado5h\}/);
  // Sólo lo del negocio: el estado sale de la sesión (persona.ws), nunca de un parámetro.
  assert.match(sinComentarios(leer('app/api/ia-pc/estado/route.ts')), /await estadoDeSusClaves\(persona\.ws\)/);
});

test('3. «Uso» abajo de la barra, como el del super admin, y en el teléfono; abre el modal sin ir directo a conectar', () => {
  const sb = sinComentarios(leer('app/second-brain/ChatSecondBrain.tsx'));
  assert.match(sb, /\{!centro && <UsoDelCliente conectada=\{k\.iaConectada\} onAbrir=\{\(\) => setVerUso\(true\)\} \/>\}/);
  assert.match(sb, /\{verUso && !k\.conectando && \(\n\s*<Modal titulo="Tus cuentas de IA" onCerrar=\{\(\) => \{ setVerUso\(false\); k\.mirarSuIA\(\); \}\} ancho=\{640\}>\n\s*<TusCuentasIA sinCabecera \/>/, 'el mismo modal, sin `conectar`');
  const pieza = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.match(pieza, /<div className="co-barra__abajo">\n\s*<div className="co-uso">\n\s*<button type="button" className="co-acceso" onClick=\{onAbrir\}/, 'la pieza del super admin (PieCentro)');
  const m = sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx'));
  // En el teléfono, un chip arriba de los chats desde el 13/11/2026 (el prototipo aprobado); sin IA conectada, lo dice.
  assert.match(m, /<button type="button" className="m-ops-chip" onClick=\{\(\) => setVerUso\(true\)\}>\{k\.iaConectada === false \? 'Conecta tu IA' : 'Uso'\}<\/button>/);
  assert.match(m, /<SheetM abierto=\{verUso\}[\s\S]{0,160}?titulo="Tus cuentas de IA">\n\s*<TusCuentasIA sinCabecera \/>/);
});

test('4. el «Uso» del super admin es el MISMO modal del cliente, con lo suyo debajo, y sin el desplegable que salta (23/10/2026)', () => {
  // Martín, la segunda vez: «"USO de IA" sea IGUAL que en los clientes, sólo que SuperAdmin tiene más configuraciones... Pero aún
  // me sigue saltando el desplegable». El desplegable era `.co-uso__panel`: absoluto, encima del botón.
  const uso = sinComentarios(leer('app/admin/operaciones/Uso.tsx'));
  assert.doesNotMatch(uso, /co-uso__panel/, 'ningún panel que salta sobre la barra');
  assert.match(uso, /<Modal titulo="Tus cuentas de IA" onCerrar=\{\(\) => setAbierto\(false\)\} ancho=\{640\}>\n\s*\{tusCuentas\}\n\s*<div className="co-uso__mas">/, 'el modal del cliente, y lo del super admin debajo');
  assert.doesNotMatch(sinComentarios(leer('app/admin/operaciones/centro.css')), /\.co-uso__panel\b/);
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /<BotonUso [^>]*\n\s*tusCuentas=\{<TusCuentasIA sinCabecera \/>\} \/>/, 'con «Tus cuentas de IA» del cliente');
  // El teléfono, igual: la fila «Uso» y la hoja «Tus cuentas de IA», con lo suyo debajo.
  const m = sinComentarios(leer('app/m/operaciones/CentroAppMovil.tsx'));
  assert.match(m, /<FilaM icono="config" titulo="Uso" /);
  assert.match(m, /titulo="Tus cuentas de IA" snap="alto">\n\s*<TusCuentasIA sinCabecera \/>\n\s*<RunnerMovil/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, test 4, base 4/0): el panel de vuelta en Uso.tsx → 3/1; sin `tusCuentas` en PieCentro → 3/1.
// PROBADO ROMPIÉNDOLO (22/10/2026, base 3/0):
//   · el gasto suma también los fallos                → 2/1 (1)
//   · el gasto sin el costo en la lectura             → 2/1 (1)
//   · el modal sin el gasto                           → 2/1 (2)
//   · el «Uso» sin el del cliente                     → 2/1 (3)
//   · el teléfono sin su «Uso»                        → 2/1 (3)
//   · el crédito del onboarding cuenta como su gasto  → 2/1 (1)
