// =============================================================================
// Publicar y Activar miran también el CRON social, y aseguran el webhook de Zernio (duodécima tanda, §2.11)
// =============================================================================
// Lo que medimos el 12/10/2026 (docs/diseno-duodecima-tanda.md §1.9):
//   · `mediosQueUsa` miraba sólo las TARJETAS: una automatización con un CRON de Instagram y tarjetas de WhatsApp se
//     publicaba y se ACTIVABA sin Instagram conectado, y no arrancaba nunca, sin un error;
//   · el webhook de Zernio se registraba SÓLO con el `estado` del modal de conectar (app/api/zernio/route.ts): ws10, 11
//     y 13 estaban con `webhook_ok=false` y 0 eventos.
//
// Lo que se fija:
//   1. lib/medios-automatizacion.ts, EJECUTADO: el CRON suma su medio (Instagram y Messenger, por `claseDeDisparador`,
//      la función del editor del CRON) y frena con el texto de siempre;
//   2. DE VERDAD, en un node aparte (`--experimental-test-module-mocks`; se reemplaza SÓLO lo que toca la base, Zernio
//      y Evolution): la ruta de Publicar (PATCH /api/whatsapp/secuencias) y `validarActivacion` (Activar):
//        · CRON de Instagram con tarjetas de WhatsApp y sin Instagram → 409 / «No se activó», y el webhook ni se toca;
//        · con Instagram conectado → pasa y llama a `asegurarWebhook` con el ws, explícito;
//        · sin nada social → ni una llamada a Zernio;
//        · el webhook que falla no frena: Publicar vuelve `aviso`;
//        · la lista del CRON se lee de la fila (y sin la 0241, de las columnas).
//
// PROBADO ROMPIÉNDOLO (12/10/2026, arnés scratchpad/wf-duodecima/ig-publicar/romper.mjs: una rotura por vez, el
// original guardado en memoria y comprobado con sha1 al restaurar). Base: 9 pass / 0 fail (pass / fail):
//   R1. `mediosQueUsa` sin el CRON (el `for` de `disparadores` fuera)                             → 5 / 4
//   R2. `usosDeMedios` sin el CRON (mide Instagram pero no lo frena)                               → 6 / 3
//   R3. la ruta no pasa la lista del CRON (`medioSinConectar(…, linea)`)                           → 6 / 3
//   R4. Activar no pasa la lista del CRON                                                         → 6 / 3
//   R5. la ruta sin `asegurarAvisosSociales` (Publicar no asegura el webhook)                     → 6 / 3
//   R6. `asegurarAvisosSociales` deja pasar el error (una falla del webhook tumba Publicar)        → 8 / 1
//   R7. `socialesConectados` cuenta «no pude comprobarlo» como conectado                           → 8 / 1
// Restaurado: 9 / 0. (R3 y R4 tumban además 1 de tests/medios-automatizacion.test.ts: 12 / 1.)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MOTIVO_MEDIO, avisoSinWebhook, faltantes, frenoDeMedios, medioDeDisparador, mediosQueUsa, socialesConectados, usosDeMedios,
  type EstadoMedios,
} from '../lib/medios-automatizacion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
const bloque = (src: string, desde: string, hasta: string) => {
  const ini = src.indexOf(desde);
  assert.ok(ini >= 0, `no encontré «${desde}»`);
  const fin = src.indexOf(hasta, ini + desde.length);
  assert.ok(fin > ini, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(ini, fin);
};

const WA = { id: 'a', canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola' } as unknown as PasoGrafo;
const CRON_IG = [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'dm' }];
const CRON_MS = [{ id: 'd1', trigger_tipo: 'messenger', subtipo: 'dm' }];
const SI = { conectado: true };
const NO_IG = { conectado: false, motivo: MOTIVO_MEDIO.instagram };

// ── 1. Las funciones puras ───────────────────────────────────────────────────────────────────────

test('el CRON suma su medio: Instagram y Messenger sí; el email recibido, los pagos, una etapa y un horario no', () => {
  assert.equal(medioDeDisparador(CRON_IG[0]), 'instagram');
  assert.equal(medioDeDisparador(CRON_MS[0]), 'messenger');
  for (const t of ['email_recibido', 'pago', 'etapa', 'manual', 'etiqueta']) assert.equal(medioDeDisparador({ trigger_tipo: t }), null, t);
  assert.equal(medioDeDisparador(null), null);
  assert.deepEqual(mediosQueUsa([WA], CRON_IG), ['whatsapp', 'instagram']);
  assert.deepEqual(mediosQueUsa([WA], CRON_MS), ['whatsapp', 'messenger']);
  assert.deepEqual(mediosQueUsa([], CRON_IG), ['instagram'], 'un CRON social sin tarjetas también usa Instagram');
  // Sin la lista (la tarjeta, el lienzo): lo de siempre.
  assert.deepEqual(mediosQueUsa([WA]), ['whatsapp']);
  assert.deepEqual(usosDeMedios([WA], null, CRON_IG), [{ medio: 'whatsapp', linea: null }, { medio: 'instagram', linea: null }]);
});

test('CRON de Instagram con tarjetas de WhatsApp y sin Instagram → frena con «Conecta tu Instagram»', () => {
  const estado: EstadoMedios = { whatsapp: { porDefecto: SI, lineas: {} }, instagram: NO_IG };
  assert.deepEqual(frenoDeMedios(faltantes(usosDeMedios([WA], null, CRON_IG), estado)), { medio: 'instagram', error: 'Conecta tu Instagram' });
  // Sin la lista no lo ve: era el agujero.
  assert.equal(frenoDeMedios(faltantes(usosDeMedios([WA], null), estado)), null);
});

test('los sociales CONECTADOS (los que piden el webhook): «no pude comprobarlo» no cuenta; el aviso es corto', () => {
  assert.deepEqual(socialesConectados(['whatsapp', 'instagram', 'messenger'], { instagram: SI, messenger: { conectado: null } }), ['instagram']);
  assert.deepEqual(socialesConectados(['whatsapp'], { whatsapp: { porDefecto: SI, lineas: {} } }), []);
  assert.deepEqual(socialesConectados(['instagram'], null), []);
  assert.equal(avisoSinWebhook(['instagram']), 'Los avisos de Instagram no se activaron');
  assert.equal(avisoSinWebhook(['instagram', 'messenger']), 'Los avisos de Instagram y Messenger no se activaron');
  assert.equal(avisoSinWebhook([]), null);
});

// ── 2. De verdad: la ruta de Publicar y `validarActivacion`, con la base, Zernio y Evolution de mentira ───────────

type Escenario = {
  publicar: { status: number; body: Record<string, unknown> } | { tiro: string };
  activar: string;
  webhook: number[];
  zernio: number;
  guardado: number;
};
type Salida = Record<'sinIg' | 'conIg' | 'nadaSocial' | 'webhookFalla' | 'tarjetaIg', Escenario> & {
  sinColumna: Array<{ trigger_tipo: string }>;
  conLista: Array<{ trigger_tipo: string; subtipo?: string | null }>;
};

let salida: Salida | null = null;
function correr(): Salida {
  if (salida) return salida;
  const url = (rel: string): string => JSON.stringify(pathToFileURL(join(raiz, rel)).href);
  const codigo = `
import { mock } from 'node:test';
const real = (m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
const log = { webhook: [], zernio: 0, guardado: 0 };
let zernio = { configurado: true, ig: [], webhookFalla: false };
let fila = null;
let sinColumna = false;
const db = { from: () => ({ select: (cols) => ({ eq: () => ({ maybeSingle: async () => (
  sinColumna && /disparadores/.test(cols) ? { data: null, error: { code: '42703', message: 'column nutricion_secuencias.disparadores does not exist' } } : { data: fila, error: null }
) }) }) }) };

const z = await import(${url('lib/zernio.ts')});
mock.module(${url('lib/zernio.ts')}, { exports: { ...real(z),
  zernioConfigurado: async () => { log.zernio++; return zernio.configurado; },
  cuentasConectadas: async (_ws, plataforma) => { log.zernio++; return plataforma === 'instagram' ? zernio.ig : []; },
  asegurarWebhook: async (ws) => { log.zernio++; log.webhook.push(ws); if (zernio.webhookFalla) throw new Error('Zernio 500'); return 'actualizado'; },
} });
const w = await import(${url('lib/workspace.ts')});
mock.module(${url('lib/workspace.ts')}, { exports: { ...real(w),
  getWorkspaceActual: async () => 10, getTenantDb: async () => db, getRolWsEfectivo: async () => 'admin',
} });
const ev = await import(${url('lib/evolution.ts')});
mock.module(${url('lib/evolution.ts')}, { exports: { ...real(ev),
  listarLineas: async () => [{ id: 1, instance_name: 'mako_ws10', estado: 'conectado', numero: '5215550000000', es_default: true, etiqueta: null }],
} });
const nutri = await import(${url('lib/nutricion.ts')});
mock.module(${url('lib/nutricion.ts')}, { exports: { ...real(nutri),
  setSecuenciaPasos: async () => { log.guardado++; }, vozDeAIStepQueFalta: async () => null,
} });
const { PATCH } = await import(${url('app/api/whatsapp/secuencias/route.ts')});
const dc = await import(${url('lib/disparadores-canales.ts')});

const WA = { id: 'a', canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola' };
const IG = { id: 'b', canal: 'instagram', delay_horas: 0, cuerpo: 'hola' };
const filaDe = (pasos, trigger, lista) => ({
  id: 7, pasos, instance_name: null, trigger_tipo: trigger, etapa: '', etapas: null, funnel_id: null, producto_id: null,
  etiqueta_id: null, cron: null, cron_proxima_at: null, disparadores: lista, disparadores_rev: 1,
});
const CRON_IG = [{ id: 'd1', trigger_tipo: 'instagram', subtipo: 'dm' }];
const MANUAL = [{ id: 'd1', trigger_tipo: 'manual' }];

async function escenario(pasos, trigger, lista, z) {
  fila = filaDe(pasos, trigger, lista);
  zernio = { configurado: true, ig: [], webhookFalla: false, ...z };
  log.webhook = []; log.zernio = 0; log.guardado = 0;
  let publicar;
  try {
    const r = await PATCH({ json: async () => ({ id: 7, pasos }) });
    publicar = { status: r.status, body: await r.json() };
  } catch (e) { publicar = { tiro: String(e && e.message || e) }; }
  let activar = 'ok';
  try { await nutri.validarActivacion(7); } catch (e) { activar = String(e && e.message || e); }
  return { publicar, activar, webhook: [...log.webhook], zernio: log.zernio, guardado: log.guardado };
}

const CUENTA = [{ _id: 'acc1', username: 'fiestamusic', platform: 'instagram' }];
const out = {
  sinIg: await escenario([WA], 'instagram', CRON_IG, { ig: [] }),
  conIg: await escenario([WA], 'instagram', CRON_IG, { ig: CUENTA }),
  nadaSocial: await escenario([WA], 'manual', MANUAL, { ig: CUENTA }),
  webhookFalla: await escenario([WA], 'instagram', CRON_IG, { ig: CUENTA, webhookFalla: true }),
  tarjetaIg: await escenario([IG], 'manual', MANUAL, { ig: CUENTA }),
};
fila = filaDe([WA], 'instagram', CRON_IG);
out.conLista = await dc.disparadoresDeSecuencia(7);
sinColumna = true;
out.sinColumna = await dc.disparadoresDeSecuencia(7);
console.log(JSON.stringify(out));
`;
  const texto = execFileSync(process.execPath, [
    '--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', '--input-type=module', '-e', codigo,
  ], { cwd: raiz, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const lineas = texto.trim().split('\n');
  salida = JSON.parse(lineas[lineas.length - 1]!) as Salida;
  return salida;
}

test('DE VERDAD: CRON de Instagram con tarjetas de WhatsApp y sin Instagram → Publicar 409 y Activar frena; el webhook ni se toca', () => {
  const s = correr().sinIg;
  assert.deepEqual(s.publicar, { status: 409, body: { ok: false, error: 'Conecta tu Instagram', medio: 'instagram' } });
  assert.equal(s.activar, 'No se activó: Conecta tu Instagram.');
  assert.equal(s.guardado, 0, 'Publicar guardó con Instagram sin conectar');
  assert.deepEqual(s.webhook, []);
});

test('DE VERDAD: con Instagram conectado → pasa, y Publicar y Activar aseguran el webhook del ws (explícito)', () => {
  const s = correr().conIg;
  assert.deepEqual(s.publicar, { status: 200, body: { ok: true } });
  assert.equal(s.activar, 'ok');
  assert.equal(s.guardado, 1);
  assert.deepEqual(s.webhook, [10, 10], 'uno al publicar y otro al activar, con el ws 10');
  // La tarjeta de Instagram sola (sin CRON social) también lo asegura.
  assert.deepEqual(correr().tarjetaIg.webhook, [10, 10]);
});

test('DE VERDAD: sin nada social → ni una llamada a Zernio', () => {
  const s = correr().nadaSocial;
  assert.deepEqual(s.publicar, { status: 200, body: { ok: true } });
  assert.equal(s.activar, 'ok');
  assert.equal(s.zernio, 0, 'se habló con Zernio sin nada social');
  assert.deepEqual(s.webhook, []);
});

test('DE VERDAD: el webhook que falla no frena: Publicar guarda y vuelve el aviso corto; Activar activa', () => {
  const s = correr().webhookFalla;
  assert.deepEqual(s.publicar, { status: 200, body: { ok: true, aviso: 'Los avisos de Instagram no se activaron' } });
  assert.equal(s.guardado, 1);
  assert.equal(s.activar, 'ok');
  assert.deepEqual(s.webhook, [10, 10]);
});

test('DE VERDAD: la lista del CRON sale de la fila (`disparadoresDe`); sin la 0241, de las columnas', () => {
  const { conLista, sinColumna } = correr();
  assert.deepEqual(conLista.map((d) => [d.trigger_tipo, d.subtipo ?? null]), [['instagram', 'dm']]);
  assert.deepEqual(sinColumna.map((d) => d.trigger_tipo), ['instagram']);
});

// ── 3. El cableado que el node aparte no ve ────────────────────────────────────────────────────

test('el webhook va DESPUÉS de lo que frena: en Publicar, después de guardar; en Activar, después del freno', () => {
  const ruta = fuente('app/api/whatsapp/secuencias/route.ts');
  const patch = bloque(ruta, 'if (Array.isArray(body.pasos)) {', 'if (typeof body.activa');
  const iGuarda = patch.indexOf('await setSecuenciaPasos(id, body.pasos as PasoSecuencia[]);');
  const iWebhook = patch.indexOf('aviso = await asegurarAvisosSociales(ws, medios.sociales);');
  assert.ok(iGuarda > 0 && iWebhook > iGuarda, 'el webhook se asegura antes de saber si se guardó');
  const val = bloque(fuente('lib/nutricion.ts'), 'export async function validarActivacion(', '\nexport async function setSecuenciaActiva(');
  const iFreno = val.indexOf('if (medios.falta) throw new PasosInvalidosError(');
  const iAct = val.indexOf('await asegurarAvisosSociales(ws, medios.sociales);');
  assert.ok(iFreno > 0 && iAct > iFreno);
  // El webhook no se toca en lib/zernio.ts ni se registra por otro camino.
  assert.match(fuente('lib/disparadores-canales.ts'), /const r = await conTope\(asegurarWebhook\(ws\), 8000\);/);
});
