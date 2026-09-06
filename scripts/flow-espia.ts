// =============================================================================
// Qué pedidos vio el navegador, con su forma — sin pedir una captura
// =============================================================================
// El diagnóstico dice QUÉ clases hay; esto dice CÓMO SON. Es lo que hace falta
// para identificar una operación que no se puede anclar con una frase: subir una
// imagen, leer el saldo, sondear el estado. Esas tres no llevan prompt, así que no
// hay ningún texto conocido que buscarles.
//
// Lee el `detalle` que la extensión ya manda en cada latido (`flow_puentes`), que
// trae por clase: el método, si hubo respuesta, los nombres de los headers, si tiene
// cuerpo, y una muestra del cuerpo.
//
// ⚠️ SOLO LEE. Y muestra la muestra RECORTADA: ahí puede viajar el `at`.
//
//   npx tsx --conditions=react-server scripts/flow-espia.ts --ws 1
//   npx tsx --conditions=react-server scripts/flow-espia.ts --ws 1 --clase boq:maseQ
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });
import { getSupabaseServer } from '../lib/supabase';

const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : null;
};
const ws = Number(arg('--ws') || 1);
const soloClase = arg('--clase');
/** Con `--grep <txt>` sólo salen las clases cuya muestra lo contenga. */
const grep = arg('--grep');

type Visto = {
  metodo?: string; hayRespuesta?: boolean; deRespaldo?: boolean;
  headers?: string[]; tieneCuerpo?: boolean; esCascara?: boolean;
  cuerpoMuestra?: string | null; edadMs?: number; url?: string;
};

async function main() {
  const db = getSupabaseServer();
  const { data, error } = await db
    .from('flow_puentes')
    .select('workspace_id, estado_detalle, ultimo_visto, version')
    .eq('workspace_id', ws)
    .maybeSingle();

  if (error) { console.error('No pude leer:', error.message); process.exit(1); }
  if (!data) { console.error(`No hay puente para el ws ${ws}.`); process.exit(1); }

  let visto: Record<string, Visto> = {};
  try { visto = JSON.parse(String(data.estado_detalle || '{}')); } catch { visto = {}; }
  const clases = Object.keys(visto);

  if (!clases.length) {
    // «No vi nada» y «no pude mirar» son respuestas distintas.
    console.log(`El puente del ws ${ws} (v${data.version || '—'}) no reportó ningún pedido.`);
    console.log('El `detalle` viaja en el latido; si está vacío, la pestaña no respondió al espía.');
    return;
  }

  console.log(`ws ${ws} · extensión v${data.version || '—'} · ${clases.length} clases vistas\n`);
  let mostradas = 0;
  for (const clase of clases.sort()) {
    if (soloClase && clase !== soloClase) continue;
    const v = visto[clase] || {};
    const m = String(v.cuerpoMuestra || '');
    if (grep && !m.toLowerCase().includes(grep.toLowerCase())) continue;
    mostradas++;
    const edad = v.edadMs ? `${Math.round(v.edadMs / 1000)} s` : '—';
    console.log(`── ${clase}`);
    console.log(`   ${v.metodo || '—'} · respuesta: ${v.hayRespuesta ? 'sí' : 'no'}`
      + `${v.deRespaldo ? ' · DE RESPALDO (no de esta sesión)' : ''}`
      + `${v.esCascara ? ' · ⚠️ CÁSCARA (sin cuerpo)' : ''} · visto hace ${edad}`);
    if (m) {
      console.log(`   cuerpo (${m.length} car): ${m.slice(0, 400).replace(/\s+/g, ' ')}`);
    } else if (v.tieneCuerpo === false) {
      console.log('   sin cuerpo');
    }
    console.log('');
  }
  if (!mostradas) {
    console.log(soloClase ? `No vi la clase ${soloClase}.` : `Ninguna muestra contiene "${grep}".`);
    console.log('Las que sí hay: ' + clases.sort().join(', '));
  }
}

void main();
