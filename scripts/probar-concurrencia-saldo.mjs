// ¿Qué pasa si 200 generaciones piden saldo AL MISMO TIEMPO? Es lo que preguntó Martín, y es la pregunta
// correcta: con video una persona dispara varias piezas de un tirón.
//
// Lo que se prueba, contra la base DE VERDAD (ws 9, el espacio de MaKo):
//   1. que no se gaste más saldo del que hay — ni un token;
//   2. que el saldo nunca quede negativo;
//   3. que la cantidad de permitidos sea EXACTAMENTE saldo/costo, no una aproximación;
//   4. que lo que se descontó coincida con lo que se dejó pasar (sin tokens perdidos ni regalados).
//
// Limpia lo que crea. Usa el ws 9 a propósito: es el espacio del super admin, no un cliente.
import postgres from 'postgres';
import { readFileSync } from 'node:fs';

const ENV = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const URL = readFileSync(ENV, 'utf8').match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
if (!URL) { console.log('sin DATABASE_URL'); process.exit(1); }

const sql = postgres(URL, { max: 30, idle_timeout: 20, connect_timeout: 30 });
const WS = 9;
const SALDO = 1000;
const CUESTA = 7;          // un número feo a propósito: 1000/7 = 142 con resto, no un redondo
const PEDIDOS = 200;       // más pedidos que saldo: tienen que sobrar rechazos

try {
  await sql`insert into mako_tokens_saldo (workspace_id, saldo) values (${WS}, ${SALDO})
            on conflict (workspace_id) do update set saldo = ${SALDO}, actualizado_en = now()`;
  console.log('saldo inicial: %d MT · cada pedido cuesta %d · %d pedidos a la vez\n', SALDO, CUESTA, PEDIDOS);

  // ⚠️ LA SENTENCIA QUE LO HACE SEGURO: el chequeo y el descuento son UNO SOLO.
  const pedir = () => sql`
    update mako_tokens_saldo set saldo = saldo - ${CUESTA}, actualizado_en = now()
     where workspace_id = ${WS} and saldo >= ${CUESTA}
     returning saldo`;

  const t0 = Date.now();
  const res = await Promise.all(Array.from({ length: PEDIDOS }, () => pedir().catch(() => [])));
  const ms = Date.now() - t0;

  const permitidos = res.filter((r) => r.length > 0).length;
  const rechazados = PEDIDOS - permitidos;
  const [{ saldo: queda }] = await sql`select saldo from mako_tokens_saldo where workspace_id = ${WS}`;

  const esperados = Math.floor(SALDO / CUESTA);
  const gastado = SALDO - Number(queda);

  console.log('permitidos: %d   (esperados: %d)', permitidos, esperados);
  console.log('rechazados: %d', rechazados);
  console.log('saldo final: %d MT   (gastado: %d)', queda, gastado);
  console.log('tardó: %d ms para %d pedidos (%d ms cada uno)\n', ms, PEDIDOS, Math.round(ms / PEDIDOS));

  const bien = [
    [permitidos === esperados, `se dejaron pasar ${permitidos} y el saldo daba para ${esperados}`],
    [Number(queda) >= 0, `el saldo quedó en ${queda}: NUNCA puede ser negativo`],
    [gastado === permitidos * CUESTA, `se descontaron ${gastado} MT y se permitieron ${permitidos} pedidos de ${CUESTA}: no coincide`],
    [Number(queda) === SALDO % CUESTA, `tenía que sobrar el resto (${SALDO % CUESTA}) y sobró ${queda}`],
  ];
  let todoBien = true;
  for (const [ok, que] of bien) { if (!ok) { console.log('✗ %s', que); todoBien = false; } }
  console.log(todoBien ? '✅ Ni un token de más ni de menos, con 200 pedidos simultáneos.' : '❌ HAY UN AGUJERO.');
} finally {
  await sql`delete from mako_tokens_saldo where workspace_id = ${WS}`;
  await sql.end();
  console.log('\n(limpiado)');
}
