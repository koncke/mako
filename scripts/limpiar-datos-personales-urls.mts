// =============================================================================
// limpiar-datos-personales-urls — saca los datos de una persona de las URL YA GUARDADAS (24/10/2026, P6)
// =============================================================================
// Desde el 24/10 las rutas del Pixel guardan la URL sin los datos de una persona (lib/url-datos-personales.ts). Lo que se
// guardó antes sigue ahí: medido el 24/10 (sólo lectura), 487 filas de `vsl_events` y 112 de `landing_visits` de Código
// Inmobiliario (ws 13, ~75 personas) y P2P Consulting (ws 14, 3 personas), con `?name=…&email=…` de la página de gracias
// de Calendly. `replay_sesiones`: ninguna.
//
// Qué hace: a cada fila cuya `landing_url` cambia con `urlSinDatosPersonales`, le pone la URL limpia. NO borra filas: la
// visita a /gracias es la prueba de que alguien agendó (docs/hallazgos-landing.md, «casi se borra la única evidencia del
// agendado») y se queda; sólo pierde el nombre y el email, que ya están en el lead.
//
// Uso (desde el clon, que tiene .env.local con DATABASE_URL de PRODUCCIÓN):
//   node --import tsx scripts/limpiar-datos-personales-urls.mts               → cuenta, por negocio. No escribe.
//   node --import tsx scripts/limpiar-datos-personales-urls.mts --aplicar     → escribe (con el OK del Cerebro: son datos
//                                                                                de clientes reales).
//   … --ws 13                                                                 → sólo ese negocio.
// Nunca imprime una URL ni un valor: sólo conteos.
// =============================================================================

import postgres from 'postgres';
import { urlDeLaBase } from './url-de-la-base.mjs';
import { config } from 'dotenv';
import { urlSinDatosPersonales } from '../lib/url-datos-personales';

config({ path: '.env.local' });
const aplicar = process.argv.includes('--aplicar');
const iWs = process.argv.indexOf('--ws');
const soloWs = iWs >= 0 ? Number(process.argv[iWs + 1]) : null;
if (iWs >= 0 && !Number.isInteger(soloWs)) { console.error('--ws necesita un número'); process.exit(1); }
if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL (correlo desde el clon, que tiene .env.local)'); process.exit(1); }

/** Dónde se guardaron URLs del navegador: la página, el referrer de la visita y el detalle de un clic (el link). */
const COLUMNAS = [['vsl_events', 'landing_url'], ['vsl_events', 'detalle'], ['landing_visits', 'landing_url'], ['landing_visits', 'referrer'], ['replay_sesiones', 'landing_url']] as const;
/** Un filtro AMPLIO en la base (que traiga de más es barato); la que decide es `urlSinDatosPersonales`. */
const CANDIDATAS = String.raw`[?&#;][^=]*(name|nombre|nome|apellido|mail|correo|phone|tel|celular|movil|mobile|whats|wpp|dni|cuit|cuil|cpf|cnpj|cedula|curp|rfc|doc|rut|documento|invitee|answer|rescheduled|reminder|a[0-9])[^=]*=|%40|%2540|@`;

const sql = postgres(urlDeLaBase(), { ssl: 'require', connect_timeout: 60, max: 1 });
try {
  for (const [t, col] of COLUMNAS) {
    const cols = (await sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = ${t}`).map((c) => c.column_name as string);
    if (!cols.includes(col) || !cols.includes('id')) { console.log(`${t}.${col}: no existe (o sin id), se saltea`); continue; }
    const filas = await sql.unsafe(
      `select id, workspace_id as ws, ${col} as u from public.${t} where ${col} ~* $1${soloWs != null ? ' and workspace_id = $2' : ''}`,
      soloWs != null ? [CANDIDATAS, soloWs] : [CANDIDATAS],
    ) as unknown as Array<{ id: string | number; ws: number | null; u: string }>;
    const cambian = filas.filter((f) => urlSinDatosPersonales(f.u) !== f.u);
    const porWs = new Map<number | null, number>();
    for (const f of cambian) porWs.set(f.ws, (porWs.get(f.ws) ?? 0) + 1);
    console.log(`${t}.${col}: ${cambian.length} filas con datos personales · ` + ([...porWs].map(([w, n]) => `ws${w}=${n}`).join(', ') || 'ninguna'));
    if (!aplicar || !cambian.length) continue;
    let hechas = 0;
    await sql.begin(async (tx) => {
      for (const f of cambian) {
        // Sólo si la fila sigue como se leyó: nada que otro escriba en el medio se pisa.
        const r = await tx.unsafe(`update public.${t} set ${col} = $1 where id = $2 and ${col} = $3`, [urlSinDatosPersonales(f.u), f.id, f.u]);
        hechas += r.count;
      }
    });
    console.log(`  → ${hechas} filas limpias`);
  }
  if (!aplicar) console.log('\n(Sólo se contó. Para escribir: --aplicar, con el OK del Cerebro.)');
} finally {
  await sql.end({ timeout: 5 });
}
