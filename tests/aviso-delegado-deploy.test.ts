// =============================================================================
// Un pedido DELEGADO que cierra el deploy no dice «Listo: ya quedó» (18/11/2026, el #110 de Marcela)
// =============================================================================
// `ESTADOS_QUE_CIERRA_EL_DEPLOY` incluye `esperando_decision`: un pedido delegado con su hito `tickets: [n]` se cierra solo al
// desplegar, con `decision = null`, y `textoDelAviso` le mandaba al grupo «Listo: ya quedó tu pedido #n». Pero lo que se arregló fue
// la CAPACIDAD (MaKo no tenía con qué agendar la llamada): lo que pidió no se hizo, y lo tiene que pedir de nuevo. Para el #110 el
// Cerebro lo evitó a mano (dejó `decision = 'responder'` con su respuesta, que el cierre conserva). Lo que fija:
//   1. el aviso de un delegado cerrado por el deploy pide que lo vuelva a pedir; `responder` sigue ganando; uno que el equipo HIZO
//      (sin la marca) sigue diciendo «ya quedó»; un ticket que no es delegado, como siempre;
//   2. el cierre REAL del cron (tests/_aviso-delegado-deploy-hijo.ts): marca al delegado en su contexto, no toca a los demás, y el
//      aviso que sale de esa fila es el nuevo; /tickets dice lo mismo (`paraElCliente` usa el mismo texto).
// Probado rompiéndolo (18/11/2026): sin la marca en `cerrarLosDesplegados` → falla 2; sin la línea en `textoDelAviso` → fallan 1 y 2.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { textoDelAviso, conCierreDelDeploy, cerradoPorElDeploy, paraElCliente, CERRADO_POR_EL_DEPLOY } from '../lib/tickets-reglas';

const RAIZ = join(__dirname, '..');
const DELEGADO = { delegado: true, pedido: 'agrega una nota al lead Valery: agendar llamarla en dos semanas' };
const base = { id: 110, titulo: 'Lo que faltó de: agendar la llamada a Valery', estado: 'resuelto', respuesta: 'Ya está arreglado: MaKo agenda la llamada.', duplicado_de: null, workspace_id: 23 };

test('1. el aviso: cerrado por el deploy, que lo pida de nuevo; «responder» gana; hecho por el equipo, «ya quedó»', () => {
  const porDeploy = textoDelAviso({ ...base, contexto: conCierreDelDeploy(DELEGADO), decision: null });
  assert.match(porDeploy, /MaKo ahora puede hacer tu pedido #110/);
  assert.match(porDeploy, /Pídeselo de nuevo aquí en el grupo/);
  assert.doesNotMatch(porDeploy, /ya quedó/i, 'lo que pidió no se hizo: no se dice «ya quedó»');

  const respondido = textoDelAviso({ ...base, contexto: conCierreDelDeploy(DELEGADO), decision: 'responder', respuesta: 'Ya está. Pídeselo de nuevo aquí en el grupo.' });
  assert.equal(respondido, 'Sobre tu pedido #110 («Lo que faltó de: agendar la llamada a Valery»): Ya está. Pídeselo de nuevo aquí en el grupo.', 'lo que hizo el Cerebro para el #110 se conserva');

  const hecho = textoDelAviso({ ...base, contexto: { ...DELEGADO }, decision: null });
  assert.match(hecho, /^Listo: ya quedó tu pedido #110/, 'uno que el equipo hizo (scripts/tickets-cerrar-resueltos.mjs, sin la marca) sigue diciendo «ya quedó»');

  // La marca sólo vale en un pedido delegado: en otro ticket no se pone ni se lee.
  assert.equal(conCierreDelDeploy({ pagina: '/crm' }), null);
  assert.equal(conCierreDelDeploy(null), null);
  assert.equal(cerradoPorElDeploy({ pagina: '/crm', [CERRADO_POR_EL_DEPLOY]: true }), false);
  assert.deepEqual(conCierreDelDeploy(DELEGADO), { ...DELEGADO, [CERRADO_POR_EL_DEPLOY]: true }, 'lo demás del contexto queda');
  assert.match(textoDelAviso({ ...base, id: 112, titulo: 'La etapa', contexto: { pagina: '/crm', [CERRADO_POR_EL_DEPLOY]: true }, decision: null }), /^Listo: tu ticket #112 \(«La etapa»\) está resuelto\./);

  // Y /tickets dice lo mismo que el grupo.
  const fila = { ...base, contexto: conCierreDelDeploy(DELEGADO), decision: null, created_at: '2026-11-18T07:24:00Z', descripcion: null, despacho: null } as unknown as Parameters<typeof paraElCliente>[0];
  assert.equal(paraElCliente(fila).respuesta, porDeploy);
});

test('2. el cierre REAL del cron marca al delegado y su aviso es el nuevo (base de mentira)', () => {
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', join(RAIZ, 'tests/_aviso-delegado-deploy-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000,
  });
  const linea = (r.stdout || '').split('\n').find((l) => l.startsWith('@@DEPLOY@@'));
  assert.ok(linea, `el hijo no escribió su salida: ${(r.stderr || '').slice(-2000)}`);
  const o = JSON.parse(linea.slice(10)) as {
    error?: string; cerrados: number[]; sinMock: string[];
    filas: Record<string, { estado: string; decision: string | null; contexto: Record<string, unknown> | null; respuesta: string | null }>;
    avisos: Record<string, string>; avisar: { avisados: number; fallidos: number };
  };
  assert.equal(o.error, undefined, o.error);
  assert.deepEqual(o.cerrados.sort((a, b) => a - b), [110, 111, 112]);
  assert.equal(o.filas['110'].contexto?.[CERRADO_POR_EL_DEPLOY], true, 'el delegado queda marcado');
  assert.equal(o.filas['110'].contexto?.delegado, true, 'sin perder lo que ya tenía');
  assert.equal(o.filas['112'].contexto?.[CERRADO_POR_EL_DEPLOY], undefined, 'un ticket que no es delegado no se toca');
  assert.match(o.avisos['110'], /MaKo ahora puede hacer tu pedido #110.*Pídeselo de nuevo aquí en el grupo/);
  assert.doesNotMatch(o.avisos['110'], /ya quedó/i);
  assert.equal(o.filas['111'].decision, 'responder');
  assert.match(o.avisos['111'], /^Sobre tu pedido #111/, 'la respuesta del Cerebro se conserva');
  assert.match(o.avisos['112'], /^Listo: tu ticket #112/);
  assert.equal(o.avisar.fallidos, 0);
  assert.deepEqual(o.sinMock, []);
});
