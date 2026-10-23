// =============================================================================
// «Misma persona» apagada por defecto, sin cambiarle nada a ninguna que existía (23/10/2026)
// =============================================================================
// Martín: «"Misma persona" apagado por defecto» y «No quiero nada para todas las automatizaciones». El Cerebro decidió:
// las NUEVAS nacen apagadas (`personaHorasDeLaAutomatizacion`: sin las suyas, 0 h) y las que EXISTÍAN guardan como suyo
// lo que heredaban (`fijarPersonaPropia`, que corre scripts/misma-persona-propia.mts antes del deploy). La condición:
// «el anti-ban efectivo antes y después, medido igual». `antes` es la regla vieja, copiada tal cual.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fijarPersonaPropia, personaHorasDeLaAutomatizacion, sanearConfigAutomatizacion, tieneRitmoPropio, tieneConfigPropia,
  PERSONA_SIN_ESPERA, type ConfigAutomatizacion,
} from '../lib/config-automatizacion';
import { limitesDeFabrica, limitesVigentes, type LimitesEnvio } from '../lib/limites-envio';

/** LA REGLA DE ANTES (hasta el 23/10/2026): sin las suyas, las del negocio. */
const antes = (c: ConfigAutomatizacion, n: LimitesEnvio) => ({
  whatsapp: c.personaHoras?.whatsapp ?? n.wa.personaHoras,
  email: c.personaHoras?.email ?? n.email.personaHoras,
});

const NEGOCIOS: LimitesEnvio[] = [
  limitesDeFabrica({}),
  limitesVigentes('{"wa":{"personaHoras":48},"email":{"personaHoras":72}}', limitesDeFabrica({})),
  limitesVigentes('{"wa":{"dia":65,"hora":15}}', limitesDeFabrica({})), // el ws1: sin horas propias del negocio
  limitesVigentes('{"wa":{"personaHoras":3},"email":{"personaHoras":1}}', limitesDeFabrica({})),
];
// Lo guardado, CRUDO como está en app_settings (pasa por el saneo, como en el script).
const GUARDADOS: Array<string | null> = [
  null,
  '',
  '{}',
  '{"horario":{"activo":true,"desde":9,"hasta":21,"dias":[1,2,3,4,5]}}',
  '{"goteo":{"minutos":5,"dia":50}}',
  '{"personaHoras":{"whatsapp":0}}',
  '{"personaHoras":{"email":0}}',
  '{"personaHoras":{"whatsapp":36}}',
  '{"personaHoras":{"whatsapp":0,"email":0}}',
  '{"personaHoras":{"whatsapp":24,"email":48}}',
  '{"personaHoras":{"whatsapp":999,"email":"x"}}', // fuera de rango: el saneo lo saca (era «del negocio»)
  'no es json',
];

test('el anti-ban de cada automatización que existía es el MISMO antes y después del paso, en todos los casos', () => {
  let casos = 0;
  for (const n of NEGOCIOS) for (const g of GUARDADOS) {
    const c = sanearConfigAutomatizacion(g);
    const r = fijarPersonaPropia(c, n);
    assert.ok(!('error' in r), `no se pudo fijar ${g}`);
    const despues = r.cambia ? sanearConfigAutomatizacion(r.valor) : c;
    assert.deepEqual(personaHorasDeLaAutomatizacion(despues), antes(c, n), `cambió con el negocio ${JSON.stringify(n.wa)} y lo guardado ${g}`);
    // Lo demás de la configuración no se toca.
    assert.deepEqual(despues.horario, c.horario);
    assert.deepEqual(despues.goteo, c.goteo);
    casos++;
  }
  assert.equal(casos, NEGOCIOS.length * GUARDADOS.length);
});

test('idempotente: una segunda pasada no cambia nada, y la que ya tenía las suyas en los dos canales no se toca', () => {
  for (const n of NEGOCIOS) for (const g of GUARDADOS) {
    const r = fijarPersonaPropia(sanearConfigAutomatizacion(g), n);
    if (!r.cambia) continue;
    assert.deepEqual(fijarPersonaPropia(sanearConfigAutomatizacion(r.valor), n), { cambia: false }, `la segunda pasada vuelve a escribir ${g}`);
  }
  assert.deepEqual(fijarPersonaPropia({ personaHoras: { whatsapp: 0, email: 30 } }, NEGOCIOS[0]), { cambia: false });
});

test('las NUEVAS nacen apagadas: sin las suyas, 0 h en los dos canales (ya no hereda las del negocio)', () => {
  assert.deepEqual(personaHorasDeLaAutomatizacion({}), { whatsapp: PERSONA_SIN_ESPERA, email: PERSONA_SIN_ESPERA });
  assert.deepEqual(personaHorasDeLaAutomatizacion({ personaHoras: { whatsapp: 20 } }), { whatsapp: 20, email: PERSONA_SIN_ESPERA });
  assert.equal(personaHorasDeLaAutomatizacion.length, 1, 'volvió a recibir las del negocio');
});

test('si las horas del negocio no entran en el rango de una automatización, no se escribe otra cosa: se dice', () => {
  const fuera: LimitesEnvio = { ...NEGOCIOS[0], wa: { ...NEGOCIOS[0].wa, personaHoras: 100 } };
  const r = fijarPersonaPropia({}, fuera);
  assert.ok('error' in r && /no entran en el rango/.test(r.error));
});

test('el aviso de Prospección mira el RITMO (horario o goteo), no la «Misma persona» que el paso le guardó a todas', () => {
  const soloPersona: ConfigAutomatizacion = { personaHoras: { whatsapp: 20, email: 20 } };
  assert.equal(tieneConfigPropia(soloPersona), true);
  assert.equal(tieneRitmoPropio(soloPersona), false, 'después del paso ninguna vieja volvería a avisar');
  assert.equal(tieneRitmoPropio({ goteo: { minutos: 5 } }), true);
  assert.equal(tieneRitmoPropio({ horario: null }), true);
  const boton = readFileSync(new URL('../app/automations/ConfiguracionesBoton.tsx', import.meta.url), 'utf8');
  assert.match(boton, /return tieneRitmoPropio\(\(await getConfigAutomatizacionAction\(secuenciaId\)\)\.config\);/);
});

test('el script: simulacro por defecto, el corte de fecha obligatorio, compare-and-set y la regla de antes para heredar', () => {
  const s = readFileSync(new URL('../scripts/misma-persona-propia.mts', import.meta.url), 'utf8');
  assert.match(s, /const aplicar = process\.argv\.includes\('--aplicar'\);/);
  assert.match(s, /if \(!corte \|\| Number\.isNaN\(Date\.parse\(corte\)\)\) throw new Error/, 'sin corte se tocarían las NUEVAS');
  assert.match(s, /\.lt\('created_at', new Date\(corte\)\.toISOString\(\)\)/);
  assert.match(s, /\.eq\('value', previo as string\)/, 'sin compare-and-set pisa un cambio hecho mientras tanto');
  assert.match(s, /const delNegocio = limitesVigentes\(lim\.data\?\.value \?\? null, fabrica\);/);
  assert.match(s, /fijarPersonaPropia\(sanearConfigAutomatizacion\(previo \?\? null\), delNegocio\)/);
  // Cada lectura y escritura con su negocio (service role).
  assert.equal((s.match(/\.eq\('workspace_id', ws\)/g) ?? []).length, 3);
});

test('la pantalla: sin las suyas se ve APAGADA, con el número del negocio en gris para prenderla', () => {
  const p = readFileSync(new URL('../app/automations/ConfigAutomatizacionPanel.tsx', import.meta.url), 'utf8');
  assert.match(p, /const on = propio !== undefined && propio !== PERSONA_SIN_ESPERA;/);
});
