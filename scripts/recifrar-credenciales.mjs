// =============================================================================
// recifrar-credenciales — backfill gcm1 → gcm2 (paso 3 de la migración)
// =============================================================================
//   node --experimental-strip-types scripts/recifrar-credenciales.mjs           → SECO (no escribe)
//   node --experimental-strip-types scripts/recifrar-credenciales.mjs --aplicar → escribe
//
// Idempotente y seguro de correr dos veces. Antes de aplicar, exige:
//   · CREDENCIALES_SECRET seteado (si no, no hay con qué escribir v2).
//   · que TODA fila se pueda abrir con el lector dual. Si alguna no abre, no
//     migra nada: una fila ilegible ya estaba rota de antes y pisarla sería tapar
//     evidencia.
//
// Concurrencia sin locks: el UPDATE lleva el criptograma viejo en el WHERE
// (compare-and-swap). Si alguien guardó esa credencial desde la app mientras esto
// corría, el update no aplica — y no hace falta, porque esa fila ya nació v2.
//
// OJO: .env.local apunta a PROD. Correr en seco primero y mirar lo que dice.

import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local'), quiet: true });

const M = await import('../lib/cripto-credenciales.ts');
const APLICAR = process.argv.includes('--aplicar');

const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', max: 1 });

// OJO: `credenciales` NO es la única tabla con secretos cifrados. El refresh_token
// de Google Calendar vive en `app_settings` y se cifra con la MISMA función. Si el
// backfill mirara solo `credenciales`, cantaría victoria, habilitaría rotar
// AUTH_COOKIE_VALUE y ese token moriría en silencio — sin fila "ilegible" que
// avise. Todo secreto cifrado fuera de `credenciales` va acá.
const SECRETOS_EN_SETTINGS = ['google.calendar.refresh_token'];

try {
  const deCredenciales = await sql`select workspace_id, clave, valor_enc from credenciales order by workspace_id, clave`;
  const deSettings = await sql`
    select workspace_id, key as clave, value as valor_enc from app_settings
    where key = any(${SECRETOS_EN_SETTINGS}) and coalesce(value, '') <> '' order by workspace_id`;

  const filas = [
    ...deCredenciales.map((f) => ({ ...f, tabla: 'credenciales' })),
    ...deSettings.map((f) => ({ ...f, tabla: 'app_settings' })),
  ];
  console.log(`${deCredenciales.length} en credenciales + ${deSettings.length} en app_settings = ${filas.length} secreto(s)\n`);

  const porVersion = {};
  const ilegibles = [];
  const aMigrar = [];

  for (const f of filas) {
    const v = M.versionCripto(f.valor_enc);
    porVersion[v] = (porVersion[v] ?? 0) + 1;
    // 'otro' = texto plano de antes de que esto se cifrara (solo puede pasar en
    // app_settings). No es ilegible: hay que cifrarlo, no re-cifrarlo.
    const plano = v === 'otro' ? f.valor_enc : M.descifrar(f.valor_enc, f.workspace_id, f.clave);
    if (plano === null) { ilegibles.push(`${f.tabla} ws=${f.workspace_id} ${f.clave} (${v})`); continue; }
    if (v !== 'gcm2') aMigrar.push({ ...f, plano });
  }

  console.log('Por formato:', JSON.stringify(porVersion));
  console.log(`Se abren bien: ${filas.length - ilegibles.length}/${filas.length}`);
  if (ilegibles.length) {
    console.log(`\n⚠️  ${ilegibles.length} NO se abren (ya estaban rotas; hay que re-pegarlas a mano):`);
    for (const i of ilegibles) console.log('   - ' + i);
  }

  if (!aMigrar.length) {
    if (ilegibles.length) {
      console.log('\nNada que migrar de lo legible, pero quedan filas rotas (arriba).');
    } else {
      console.log('\n✅ Todo en gcm2, en las dos tablas.');
      console.log('   Ahora sí: CREDENCIALES_V1_OFF=1 (cierra el downgrade), y después');
      console.log('   AUTH_COOKIE_VALUE queda libre para rotarse.');
    }
    process.exit(0);
  }

  console.log(`\n${aMigrar.length} secreto(s) para pasar a gcm2.`);

  if (!APLICAR) {
    console.log('\n(SECO — no se escribió nada. Con --aplicar las migra.)');
    process.exit(0);
  }

  if (!process.env.CREDENCIALES_SECRET?.trim()) {
    console.error('\n❌ Falta CREDENCIALES_SECRET: sin eso no hay con qué escribir v2.');
    process.exit(1);
  }
  if (ilegibles.length) {
    console.error('\n❌ Hay filas ilegibles. No migro nada hasta que eso se resuelva:');
    console.error('   una fila que no abre ya está rota, y pisarla borraría la evidencia.');
    process.exit(1);
  }

  let migradas = 0, saltadas = 0;
  for (const f of aMigrar) {
    // El cifrado NO depende del flag: acá se fuerza v2 a propósito.
    const nuevo = M.cifrarV2(f.plano, f.workspace_id, f.clave);
    // Cinturón: que lo que acabo de escribir se pueda volver a abrir.
    if (M.descifrar(nuevo, f.workspace_id, f.clave) !== f.plano) {
      console.error(`   ✗ ws=${f.workspace_id} ${f.clave}: el re-cifrado no vuelve. NO se escribe.`);
      continue;
    }
    // Compare-and-swap contra el criptograma leído: si alguien lo guardó desde la
    // app mientras esto corría, el update no aplica — y no hace falta, porque esa
    // fila ya nació v2.
    const r = f.tabla === 'credenciales'
      ? await sql`update credenciales set valor_enc = ${nuevo}
                  where workspace_id = ${f.workspace_id} and clave = ${f.clave} and valor_enc = ${f.valor_enc}`
      : await sql`update app_settings set value = ${nuevo}
                  where workspace_id = ${f.workspace_id} and key = ${f.clave} and value = ${f.valor_enc}`;
    if (r.count === 1) { migradas++; console.log(`   ✓ ${f.tabla} ws=${f.workspace_id} ${f.clave}`); }
    else { saltadas++; console.log(`   · ${f.tabla} ws=${f.workspace_id} ${f.clave}: cambió mientras corría, la dejo`); }
  }

  console.log(`\n${migradas} migrado(s), ${saltadas} salteado(s).`);

  const q1 = await sql`select count(*)::int as n from credenciales where valor_enc not like 'gcm2.%'`;
  const q2 = await sql`select count(*)::int as n from app_settings
                       where key = any(${SECRETOS_EN_SETTINGS}) and coalesce(value,'') <> '' and value not like 'gcm2.%'`;
  console.log(`Sin migrar: ${q1[0].n} en credenciales · ${q2[0].n} en app_settings.`);
  if (q1[0].n + q2[0].n === 0) {
    console.log('✅ Todo en gcm2. Siguiente: CREDENCIALES_V1_OFF=1, y después rotar AUTH_COOKIE_VALUE.');
  }
} finally {
  await sql.end({ timeout: 5 });
}
