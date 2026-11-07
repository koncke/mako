// =============================================================================
// Deja la clave de ApiMart en el workspace de la PLATAFORMA, cifrada (7/11/2026)
// =============================================================================
// La generación de video e imagen la paga MaKo (Martín, 7/11: «para que nosotros costeemos eso»), así que su
// clave es de la PLATAFORMA — no de un cliente y no del ws1, que es Mauricio. `envCred` la resuelve contra
// `wsDelEntorno` → `wsSuperAdmin()` porque está en `IA_DE_UNA_CUENTA` (lib/ia-keys.ts).
//
// Por qué a mano: en producción no existe ninguna fila `APIMART_*` (verificado el 7/11), y sin ella la rama de
// generación de MaKo no arranca el día que se despliegue — con un error que parece un bug y es una credencial.
//
// ⚠️ NUNCA imprime el valor: sólo largo y prefijo. Y verifica LEYÉNDOLA de vuelta y descifrando, porque
// guardar algo que después no se puede leer es el modo de falla caro acá.
//
// Correr: node --import tsx scripts/cargar-apimart-plataforma.mts
// Es idempotente: si ya hay fila, no la pisa.
// =============================================================================
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { cifrar, descifrar } from '../lib/cripto-credenciales';

const CLAVE = 'APIMART_API_KEY';
const SERVICIO = 'apimart';

const ENV = join(import.meta.dirname, '..', '.env.local');
const DESDE = [ENV, 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local'];
let env = '';
for (const p of DESDE) { try { env = readFileSync(p, 'utf8'); break; } catch { /* sigo */ } }
const leer = (k: string) => env.match(new RegExp('^' + k + '=(.*)$', 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '');

const valor = leer(CLAVE);
const url = leer('DATABASE_URL');
const secreto = leer('CREDENCIALES_SECRET');
if (!valor) { console.log(`falta ${CLAVE} en .env.local`); process.exit(1); }
if (!url) { console.log('falta DATABASE_URL'); process.exit(1); }
if (!secreto) { console.log('falta CREDENCIALES_SECRET: sin él la app no podría descifrarla'); process.exit(1); }
process.env.CREDENCIALES_SECRET = secreto;

console.log('clave a guardar: %d caracteres, empieza con «%s…»', valor.length, valor.slice(0, 3));

const sql = postgres(url, { max: 2, idle_timeout: 10, connect_timeout: 20 });
try {
  // El ws de plataforma se resuelve POR CAPA, nunca con un 9 a mano (lib/workspace.ts dice por qué).
  const [ws] = await sql`select id, nombre from workspaces where capa = 'superadmin' order by id limit 1`;
  if (!ws) { console.log('no hay workspace con capa superadmin: freno'); process.exit(1); }
  const WS = Number(ws.id);
  console.log('workspace de plataforma: %d (%s)', WS, ws.nombre);

  const ya = await sql`select 1 from credenciales where workspace_id = ${WS} and clave = ${CLAVE}`;
  if (ya.length) { console.log('ya existe una fila: no la piso'); process.exit(0); }

  await sql`insert into credenciales (workspace_id, clave, valor_enc, servicio, updated_by)
            values (${WS}, ${CLAVE}, ${cifrar(valor, WS, CLAVE)}, ${SERVICIO}, 'cerebro-7-11')`;

  const [f] = await sql`select valor_enc from credenciales where workspace_id = ${WS} and clave = ${CLAVE}`;
  const vuelta = descifrar(String(f.valor_enc), WS, CLAVE);
  console.log(vuelta === valor
    ? '✅ guardada en el ws de plataforma y verificada: descifra igual a lo que se guardó'
    : '❌ NO descifra igual: revisar CREDENCIALES_SECRET antes de confiar en esto');
} finally {
  await sql.end();
}
