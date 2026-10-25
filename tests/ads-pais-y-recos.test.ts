// =============================================================================
// Los dos bugs de Ads Manager del 2026-09-08, congelados en tests
// =============================================================================
// Los dos hacían que la app AFIRMARA algo falso con cara de dato, así que los dos
// se prueban contra respuestas REALES de la Graph API v25.0, capturadas en vivo:
//   · act_564003520636790 (Mauricio) para el edge de recomendaciones;
//   · act_1357728489423123 (Código Inmobiliario, ws13) para el país de la cuenta.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRecosCuenta } from '../lib/meta-recos-cuenta';
import { paisDeCuentaMeta } from '../lib/meta-pais';

// lib/meta-ads-create.ts lleva `server-only`: ningún test de node:test lo puede
// importar (mismo precedente que tests/ads-manager-credenciales.test.ts). El país
// cableado se fija entonces sobre el FUENTE — que además es donde reaparecería si
// alguien vuelve a escribir la constante.
const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

// Recorte literal de GET act_564003520636790/recommendations?locale=es_MX (2 de 5).
// Ojo la forma: data[0].recommendations[] — NO data[] con title/message.
const EDGE_CUENTA_REAL = {
  data: [
    {
      recommendations: [
        {
          object_ids: ['120247089094350570', '120237959905750570', '120243409187230570', '120244630334630570'],
          recommendation_content: {
            lift_estimate: 'Costo por compra 14% más bajo',
            body: 'Configurar eventos de compra con el píxel ayuda a entregar anuncios a las personas con más probabilidades de realizar una conversión.  Origen de datos: Pixel Landing DOS',
            opportunity_score_lift: '8',
          },
          type: 'PIXEL_OPTIMIZATION_HIE',
          recommendation_stage: 'pre_create_guidance',
          recommendation_time: '2026-08-31T09:26:14+0000',
          url: 'https://adsmanager.facebook.com/adsmanager/manage/accounts?act=564003520636790',
        },
        {
          object_ids: ['120247089094350570'],
          recommendation_content: {
            lift_estimate: 'Más conversiones por dólar',
            body: 'Usa una combinación de anuncios con imagen y video en tu conjunto de anuncios.',
            opportunity_score_lift: '2',
          },
          type: 'CREATIVE_DIVERSIFICATION',
          url: 'https://adsmanager.facebook.com/adsmanager/manage/accounts?act=564003520636790',
        },
      ],
    },
  ],
};

test('parseRecosCuenta lee la forma anidada real del edge de cuenta', () => {
  const r = parseRecosCuenta(EDGE_CUENTA_REAL);
  assert.equal(r.length, 2);
  // Meta NO manda título: lo arma el tipo. Antes salía "Recomendación de Meta".
  assert.equal(r[0].titulo, 'Optimiza con eventos del píxel');
  assert.match(r[0].detalle, /eventos de compra con el píxel/);
  assert.equal(r[0].lift, 'Costo por compra 14% más bajo');
  assert.equal(r[0].entidades, 4);
  // opportunity_score_lift 8 → alta; 2 → baja. Y el orden respeta la prioridad.
  assert.equal(r[0].importancia, 'ALTA');
  assert.equal(r[1].importancia, 'BAJA');

  // ROTO A PROPÓSITO (2026-09-08). Le hice ignorar el anidado y falló en el primer
  // assert: actual 0, expected 2.
  // El bug ORIGINAL fallaba distinto y peor: `raw.map(o => ({ titulo: o.title ??
  // 'Recomendación de Meta', detalle: o.message ?? '' }))` sobre `body.data` NO
  // daba cero — daba UNA fila, titulada "Recomendación de Meta" y con detalle "".
  // Por eso nadie lo vio como error: la pantalla pintaba una tarjeta, vacía.
});

test('parseRecosCuenta también acepta la forma de NODO, y descarta filas sin texto', () => {
  // El campo `recommendations` de una campaña/conjunto/anuncio sí trae title/message.
  const nodo = { data: [{ title: 'Sube el presupuesto', message: 'Tu conjunto sale del aprendizaje.', importance: 'HIGH' }] };
  const r = parseRecosCuenta(nodo);
  assert.equal(r.length, 1);
  assert.equal(r[0].titulo, 'Sube el presupuesto');
  assert.equal(r[0].detalle, 'Tu conjunto sale del aprendizaje.');
  // Vacíos de verdad: nada que pintar, ninguna tarjeta fantasma.
  assert.deepEqual(parseRecosCuenta({ data: [] }), []);
  assert.deepEqual(parseRecosCuenta({ data: [{ recommendations: [{ type: 'X' }] }] }), []);
  assert.deepEqual(parseRecosCuenta(null), []);
});

test('paisDeCuentaMeta: manda la zona horaria, no el país fiscal', () => {
  // El caso real de ws13: LLC en EE.UU. que vende en Argentina.
  assert.equal(paisDeCuentaMeta({ timezone_name: 'America/Argentina/Buenos_Aires', business_country_code: 'US' }), 'AR');
  //   ROTO A PROPÓSITO: puse el país fiscal primero y falló acá — actual 'US',
  //   expected 'AR'. Ese orden invertido es el mismo bug con otro país encima.
  assert.equal(paisDeCuentaMeta({ timezone_name: 'America/Mexico_City' }), 'MX');
  assert.equal(paisDeCuentaMeta({ timezone_name: 'Europe/Madrid' }), 'ES');
  // Zona que no está en el mapa → respaldo fiscal.
  assert.equal(paisDeCuentaMeta({ timezone_name: 'Antarctica/Troll', business_country_code: 'cl' }), 'CL');
  // Sin nada afirmable: null. NO 'MX' — inventar el país es el bug entero.
  assert.equal(paisDeCuentaMeta({ timezone_name: 'Antarctica/Troll' }), null);
  assert.equal(paisDeCuentaMeta(null), null);
});
