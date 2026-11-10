// =============================================================================
// Una automatización VACÍA (o sin CRON) no se activa (10/11/2026)
// =============================================================================
// La auditoría de Automations para un usuario nuevo (Martín, 9/11: «Leandro lo estuvo intentando utilizar y no lo pudo»):
// una recién creada, sin tarjetas o sin elegir qué la dispara, se activaba y quedaba «Activa» sin hacer nada. Se lee como que
// la app está rota. Lo que fija, ejecutando:
//   1. la regla de la pantalla (`motivoParaNoActivar`): vacía o sin CRON, el motivo; con las dos cosas, nada;
//   2. el SERVER frena la vacía por la puerta del motor y cuando MaKo propone activarla, sin prenderla (el arnés de la
//      campaña de email: el código real contra una base de mentira); el CRON sin elegir NO se frena ahí, porque la
//      difusión nace `manual` y se activa por código (lib/difusion.ts);
//   3. el botón «Activar» pregunta la regla antes de seguir.
// Probado rompiéndolo (10/11/2026, base 3/0): sin el freno del server → 1 rojo; `sinTarjetas` contando el CRON como
// tarjeta → 1 rojo; el botón sin preguntar → 1 rojo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { motivoParaNoActivar, sinTarjetas, SIN_TARJETAS_AL_ACTIVAR } from '../lib/flujo-conversacion';
import type { PasoGrafo } from '../lib/flujo-grafo';

const RAIZ = join(import.meta.dirname, '..');
const BASE = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, template_wa: null, proveedor: 'no_oficial' } as const;
const msj = { ...BASE, id: 'm1', cuerpo: 'Hola', siguiente: null } as PasoGrafo;
const inicio = { ...BASE, id: '__inicio', nodo: 'inicio', cuerpo: '', siguiente: null } as unknown as PasoGrafo;

test('1. la regla: vacía o sin CRON no se activa; con las dos, sí', () => {
  assert.equal(sinTarjetas([]), true);
  assert.equal(sinTarjetas([inicio]), true, 'el CRON solo no es una tarjeta');
  assert.equal(sinTarjetas([msj]), false);
  assert.equal(motivoParaNoActivar({ cronSinElegir: false, pasos: [] }), SIN_TARJETAS_AL_ACTIVAR);
  assert.match(motivoParaNoActivar({ cronSinElegir: true, pasos: [msj] }) ?? '', /Elige qué la dispara/);
  assert.equal(motivoParaNoActivar({ cronSinElegir: false, pasos: [msj] }), null);
});

test('2. el server no prende una vacía, ni por el motor ni cuando MaKo lo propone', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_email-campana-hijo.ts'), 'vacia'], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'], timeout: 180_000,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, any>;
  assert.deepEqual(R.pasos, [], 'la fila está vacía');
  assert.match(String(R.motor), /No se activó: Todavía no tiene ninguna tarjeta/);
  assert.equal(R.activaTrasMotor, false, 'no quedó prendida');
  assert.match(String(R.propuesta), /ninguna tarjeta/, 'MaKo no deja una propuesta que va a fallar');
  assert.equal(R.pendientes, 0, 'y no queda una pendiente');
  assert.doesNotMatch(String(R.conTarjeta), /ninguna tarjeta/, 'con una tarjeta, ese freno ya no contesta');
  assert.deepEqual(R.otros, [], 'nada salió a la red');
});

test('3. el botón «Activar» pregunta la regla antes de seguir', () => {
  const src = readFileSync(join(RAIZ, 'app/automations/SecuenciaPerfil.tsx'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(src, /const noActivar = motivoParaNoActivar\(\{ cronSinElegir: cronSinElegir\(crons\.lista\), pasos: abiertoPublicado \}\);\s*if \(noActivar\) \{ setErr\(noActivar\); return; \}\s*conAvisoDuplicada\(true, 'Activar igual'/);
});
