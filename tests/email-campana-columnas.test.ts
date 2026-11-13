// =============================================================================
// Las columnas que siguen al email y el corte al comprar (4/11/2026, puntos 5 y 6 de la campaña de email de Mauricio)
// =============================================================================
// Lo que se le dijo en la llamada: «si ya lo abrió me lo pones aquí», el clic en el botón pasa a otra columna, y quien
// compró no recibe el email siguiente. Cada automatización elige sus columnas (`columnasEmail`, por
// `configurar_automatizacion`, con `columnasEmail`), en el CRM al que está atada; lib/email-eventos-crm.ts las mueve.
//
// Corre el motor REAL (`procesarEnvios`), la ruta REAL del webhook de Resend (firmada como Svix) y los runners de la API
// sobre una base en memoria (tests/_email-campana-hijo.ts, escenario «columnas»). Nada sale a la red.
//
// Probado ROMPIÉNDOLO (4/11/2026), sobre una base de 10 / 0: sin la llamada del motor al enviar → 8 / 2; sin el «nunca hacia
// atrás» de `decidirMovimiento` → 8 / 2; sin el «nunca desde una terminal» → 9 / 1 (en el tablero las terminales van al
// final, así que sólo lo ve la regla sola); sin el corte en el motor → 8 / 2; con el corte para toda automatización (sin
// `tieneColumnasEmail`) → 8 / 2; el webhook sin mover la tarjeta al abrir → 9 / 1; sin el rechazo de una columna de cierre
// → 9 / 1. Restaurado, 10 / 0.
//
// Correr: node --import tsx --test tests/email-campana-columnas.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { columnaDeRebote, decidirMovimiento, dejaDeRecibir } from '../lib/email-eventos-crm-reglas';

const RAIZ = join(import.meta.dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'columnas'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;

test('las columnas se eligen del CRM de la automatización, y nunca una de cierre', () => {
  assert.match(R.sinCrm.error, /no está atada a un CRM/);
  assert.match(R.columnaQueNoEs.error, /no tiene la columna «no_existe»/);
  assert.match(R.columnaDeCierre.error, /columna de cierre/);
  assert.match(R.eventoQueNoEs.error, /evento enviado, abrio, clic o rebote/);
  assert.deepEqual(R.prepColumnas.payload.cambio, { columnasEmail: { enviado: 'em_enviado', abrio: 'em_abrio', clic: 'em_clic' } });
  assert.equal(R.ejecColumnas.ok, true);
  assert.deepEqual(R.leidas, { enviado: 'em_enviado', abrio: 'em_abrio', clic: 'em_clic', rebote: null }, 'configuracion_automatizacion las muestra');
});

test('al salir el email, la tarjeta pasa a «Enviado» (agregado o casa), y el email lleva el reply_to', () => {
  assert.equal(R.run1.enviados, 3);
  assert.deepEqual(R.tarjetas1, { 601: 'em_enviado', 606: 'casa:em_enviado', 608: 'em_enviado' });
  for (const e of R.emails1) assert.equal(e.reply_to, 'mauricio@personal.test');
});

test('al abrirlo pasa a «Abrió» y al hacer clic a «Hizo clic»; el webhook contesta 200', () => {
  assert.equal(R.abrio601.status, 200);
  assert.equal(R.tarjetaTrasAbrir, 'em_abrio');
  assert.equal(R.tarjetaTrasClic, 'em_clic');
  assert.equal(R.tarjeta606, 'casa:em_abrio', 'si el CRM es su casa, se mueve la casa');
  assert.ok(R.historial606.includes('MaKo · email'), 'el historial dice quién la movió');
});

test('nunca hacia atrás: quien hizo clic no vuelve a «Enviado» ni a «Abrió» con el email siguiente', () => {
  assert.equal(R.abrioOtraVez.status, 200);
  assert.equal(R.tarjetaTrasAbrirOtraVez, 'em_clic');
  assert.equal(R.tarjeta601TrasEmailDos, 'em_clic', 'le salió el email dos');
  assert.equal(R.abrioEmailDos.status, 200);
  assert.equal(R.tarjeta601TrasAbrirDos, 'em_clic', 'y lo abrió');
});

test('la regla, sola: nunca desde una terminal aunque esté antes en el tablero, ni a una columna que no está', () => {
  const etapas = [{ key: 'a' }, { key: 'ganado' }, { key: 'b' }];
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'ganado', destino: 'b' }), { mover: false, motivo: 'terminal' });
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'a', destino: 'b' }), { mover: true });
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'b', destino: 'a' }), { mover: false, motivo: 'atras' });
  assert.deepEqual(decidirMovimiento({ etapas, actual: null, destino: 'b' }), { mover: false, motivo: 'no-esta' });
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'a', destino: 'zz' }), { mover: false, motivo: 'columna-que-no-existe' });
  assert.equal(dejaDeRecibir({ estadoLead: 'abierto', etapaEnCrm: 'b' }), false);
  assert.equal(dejaDeRecibir({ estadoLead: 'perdido', etapaEnCrm: null }), true);
  assert.equal(dejaDeRecibir({ estadoLead: 'abierto', etapaEnCrm: 'ganado' }), true);
});

test('sin columnas configuradas no se mueve nada (la apertura se anota igual)', () => {
  assert.equal(R.tarjeta608SinColumnas, 'em_enviado');
  assert.equal(R.marcaSinColumnas, true);
});

test('desde Ganado un clic no mueve la tarjeta', () => {
  assert.equal(R.clic608Ganado.status, 200);
  assert.equal(R.tarjeta608, 'ganado');
});

test('quien compró no recibe el email siguiente: su inscripción se cierra, con su rastro', () => {
  assert.deepEqual(R.emails2.filter((e: { asunto: string }) => e.asunto === 'Dos').map((e: { to: string }) => e.to), ['a601@cliente.test']);
  const de = (lead: number, secuencia: string) => R.inscripciones.find((i: { lead: number; secuencia: string }) => i.lead === lead && i.secuencia === secuencia)?.estado;
  assert.equal(de(606, 'campaña'), 'cancelada', 'ganó como lead');
  assert.equal(de(608, 'campaña'), 'cancelada', 'llegó a Ganado en el CRM de la campaña');
  assert.equal(de(601, 'campaña'), 'completada');
  assert.deepEqual(R.rastros.map((r: { lead: number }) => r.lead).sort(), [606, 608]);
});

test('las demás automatizaciones siguen como siempre', () => {
  assert.ok(R.emails2.some((e: { to: string; asunto: string }) => e.to === 'a608@cliente.test' && e.asunto === 'Otra'), 'la otra campaña, sin columnas, le manda igual');
});

test('nada salió a la red', () => {
  assert.deepEqual(R.otros, []);
});

// =============================================================================
// Ticket #93 (13/11/2026): los rebotados, a su columna. Mauricio: «debemos poner en una columna o fase del CRM los correos
// rebotados para sacarlos de la secuencia pero no apagarla». La baja del email ya lo sacaba de la secuencia; faltaba verlo.
// =============================================================================
test('#93: un rebote lleva la tarjeta a «Rebotados» —sin elegirla, aunque esté antes en el tablero— y le da de baja el email', () => {
  assert.equal(R.rebote601.status, 200);
  assert.equal(R.tarjeta601TrasRebote, 'em_rebotado', 'desde «Hizo clic», hacia atrás: un rebote no es avanzar');
  assert.equal(R.baja601, true, 'sale de la secuencia: el motor no le manda a una baja');
  assert.ok(R.autorRebote.includes('MaKo · email'), 'el historial dice quién la movió');
});

test('#93, la regla sola: la columna elegida gana; si no, la que se llama «Rebotado»; un rebote no mueve desde Ganado', () => {
  const etapas = [{ key: 'lead', label: 'Nuevo lead' }, { key: 'st0', label: 'Correo enviado' }, { key: 'st7', label: 'Correos rebotados' }, { key: 'ganado', label: 'Ganado' }];
  assert.equal(columnaDeRebote(undefined, etapas), 'st7');
  assert.equal(columnaDeRebote({ rebote: 'st0' }, etapas), 'st0', 'la elegida gana');
  assert.equal(columnaDeRebote(undefined, [{ key: 'x', label: 'Rebotó' }]), 'x');
  assert.equal(columnaDeRebote(undefined, [{ key: 'x', label: 'Sobre todo' }, { key: 'y', label: 'Abrió' }]), null, 'sin columna, ninguna');
  // Hacia atrás sí (sólo el rebote), desde una terminal no.
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'st0', destino: 'lead', evento: 'rebote' }), { mover: true });
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'st0', destino: 'lead', evento: 'abrio' }), { mover: false, motivo: 'atras' });
  assert.deepEqual(decidirMovimiento({ etapas, actual: 'ganado', destino: 'st7', evento: 'rebote' }), { mover: false, motivo: 'terminal' });
});

// Ticket #93 (13/11/2026, decisión del Cerebro): el tope por día de UNA automatización sigue a la cuenta del negocio.
test('#93: el goteo por día llega a 2.000 con su Resend y su dominio, y a 500 con la de la plataforma (por la API)', () => {
  assert.equal(R.goteoPropia.error, undefined, 'con su cuenta, 1.200 entra antes del «sí»');
  assert.equal(R.goteoPropiaEjec.ok, true, 'y al guardar (lib/config-automatizacion-db.ts)');
  assert.equal(R.goteoGuardado?.dia, 1200);
  assert.match(R.goteoPropiaMal.error, /El tope por día van de 1 a 2000\./);
  assert.match(R.goteoPlataforma.error, /El tope por día van de 1 a 500\./, 'con la de la plataforma, 500');
});
