// =============================================================================
// El webhook de Instagram y Messenger contra el CRON: los dos vocabularios del evento
// =============================================================================
// Sexta tanda (09/10/2026), segunda pasada, parte «motor». La parte «canales» escribió el lector del
// webhook de Zernio (`eventoSocialDe`, lib/canal-social.ts) y la parte «disparadores» el CRON
// (`EVENTOS_INSTAGRAM` / `EVENTOS_MESSENGER`, lib/disparadores.ts), en paralelo y cada una con su
// palabra: el webhook dice `mensaje`, `comentario_vivo`, `referencia`; el CRON guarda `dm`, `en_vivo`,
// `ref`. Sacar el cast de `dispararEventoSocial` sin traducir compilaba perfecto y dejaba «El usuario
// envía un mensaje» sin arrancar NUNCA. Esto CRUZA las dos tablas: cada evento que llega cae en un
// evento del CRON de su canal, y cada evento que el CRON ofrece encendido lo produce el webhook.
//
// Y la pregunta «¿alguien escucha ESTE evento?», antes de crear un lead (`escuchaElEvento`): por cada
// CRON y con el subtipo. Preguntaba por el primer CRON y por cualquier evento del canal: un CRON
// «comenta tu publicación» creaba un lead por cada DM.
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISPARADORES_SOCIALES } from '../lib/canal-social';
import {
  subtipoDelEvento, escuchaElEvento, tieneRecurrenteAlGrupo, eventosDe, disparaPorEvento,
  TRIGGER_INSTAGRAM, TRIGGER_MESSENGER, TRIGGER_SOLO_GRUPO, TRIGGER_ETIQUETA_AGREGADA, SOLO_DESDE_EL_CRON, TRIGGERS_NUEVOS,
  type SecuenciaConDisparo, type Disparador,
} from '../lib/disparadores';

test('cada evento que el webhook entrega cae en UN evento del CRON de su canal', () => {
  for (const d of DISPARADORES_SOCIALES.filter((x) => x.disponible)) {
    const sub = subtipoDelEvento(d.canal, d.subtipo);
    assert.ok(sub, `${d.canal}/${d.subtipo} llega por el webhook y ningún CRON lo escucha`);
    assert.ok(eventosDe(d.canal).some((e) => e.subtipo === sub), `${d.canal}/${d.subtipo} → «${sub}», que el CRON de ${d.canal} no ofrece`);
  }
  // Las tres palabras que no coincidían.
  assert.equal(subtipoDelEvento('instagram', 'mensaje'), 'dm');
  assert.equal(subtipoDelEvento('instagram', 'comentario_vivo'), 'en_vivo');
  assert.equal(subtipoDelEvento('messenger', 'referencia'), 'ref');
  // Lo que no escucha nadie, y un evento de un canal en el otro.
  assert.equal(subtipoDelEvento('instagram', 'mencion_historia'), null);
  assert.equal(subtipoDelEvento('messenger', 'historia'), null, 'Messenger no tiene historias');
  assert.equal(subtipoDelEvento('instagram', 'qr'), null);
  assert.equal(subtipoDelEvento('instagram', null), null);
});

test('cada evento que el CRON ofrece ENCENDIDO lo produce el webhook (si no, una automatización que no arranca nunca)', () => {
  for (const canal of ['instagram', 'messenger'] as const) {
    const llegan = new Set(DISPARADORES_SOCIALES.filter((x) => x.canal === canal && x.disponible).map((x) => subtipoDelEvento(canal, x.subtipo)));
    for (const e of eventosDe(canal).filter((x) => !x.apagado)) {
      assert.ok(llegan.has(e.subtipo), `${canal}/${e.subtipo} se ofrece encendido y el webhook nunca lo produce`);
    }
  }
});

const sec = (id: number, disparadores: Disparador[]): SecuenciaConDisparo => ({
  id, trigger_tipo: disparadores[0].trigger_tipo, etapa: 'x', etapas: [], funnel_id: null, producto_id: null, etiqueta_id: null,
  cron: null, cron_proxima_at: null, disparadores,
});

test('¿alguien escucha ESTE evento?: por cada CRON y con el subtipo', () => {
  const comenta = sec(1, [{ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'comentario' }]);
  assert.equal(escuchaElEvento([comenta], 'instagram', { subtipo: 'comentario' }), true);
  assert.equal(escuchaElEvento([comenta], 'instagram', { subtipo: 'dm' }), false, 'un CRON «comenta» creaba un lead por cada DM');
  assert.equal(escuchaElEvento([comenta], 'messenger', { subtipo: 'comentario' }), false);
  // El segundo CRON también cuenta (antes se miraba sólo el primero, `trigger_tipo`).
  const segundo = sec(2, [{ id: 'd1', trigger_tipo: TRIGGER_ETIQUETA_AGREGADA }, { id: 'd2', trigger_tipo: TRIGGER_MESSENGER, subtipo: 'dm' }]);
  assert.equal(escuchaElEvento([segundo], 'messenger', { subtipo: 'dm' }), true, 'un segundo CRON de Messenger no contaba');
  // Un Recurrente no escucha eventos; nada, nadie.
  assert.equal(escuchaElEvento([sec(3, [{ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm', cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 } }])], 'instagram', { subtipo: 'dm' }), false);
  assert.equal(escuchaElEvento([], 'instagram', { subtipo: 'dm' }), false);
  // Y es la MISMA pregunta que al inscribir.
  assert.equal(disparaPorEvento(comenta.disparadores![0], 'instagram', { subtipo: 'comentario' }), true);
});

test('el Recurrente al grupo de MaKo: con horario y el grupo marcado, en cualquiera de los CRON', () => {
  const CRON = { unidad: 'semana' as const, cada: 1, hora: 9, minuto: 0, diaSemana: 1 };
  assert.equal(tieneRecurrenteAlGrupo(sec(1, [{ id: 'd1', trigger_tipo: TRIGGER_SOLO_GRUPO, cron: CRON, grupo: true }])), true);
  assert.equal(tieneRecurrenteAlGrupo(sec(2, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'x' }, { id: 'd2', trigger_tipo: 'etapa_actual', etapa: 'y', cron: CRON, grupo: true }])), true);
  assert.equal(tieneRecurrenteAlGrupo(sec(3, [{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'x', cron: CRON }])), false, 'un Recurrente sólo a la cohorte no es del grupo');
  assert.equal(tieneRecurrenteAlGrupo(sec(4, [{ id: 'd1', trigger_tipo: TRIGGER_INSTAGRAM, subtipo: 'dm' }])), false);
});

test('los que sólo se eligen en el CRON: los que piden el evento o el horario, y ninguno más', () => {
  assert.deepEqual([...SOLO_DESDE_EL_CRON].sort(), ['email_recibido', 'grupo_mako', 'instagram', 'messenger']);
  for (const t of SOLO_DESDE_EL_CRON) assert.ok(TRIGGERS_NUEVOS.includes(t), t);
});

// ── ROTURAS (09/10/2026) ───────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo, restaura DE MEMORIA con md5; nunca git).
// Base: 5 / 0. Las cuatro cayeron:
//   · `mensaje` sin traducir a `dm` (el webhook y el CRON con dos palabras)        → 3 / 2
//   · la tienda de Facebook encendida (con tests/disparadores.test.ts, base 24/0)  → 22 / 2
//   · `escuchaElEvento` mirando sólo el primer CRON                                 → 4 / 1
//   · `tieneRecurrenteAlGrupo` sin mirar el grupo (cualquier Recurrente)            → 4 / 1
// Restaurado: 5 / 0.
