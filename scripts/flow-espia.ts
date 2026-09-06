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

  // ⚠️ EL JSON LLEGA TRUNCADO, Y UN `catch` QUE DEVUELVE `{}` LO CONVIERTE EN «VACIO».
  //
  // El `detalle` se corta con `.slice(0, 7500)` antes de mandarse, asi que casi
  // siempre es JSON invalido — le falta el cierre. La primera version de este script
  // hacia `catch { visto = {} }` y contestaba «no reporto ningun pedido» sobre 7500
  // caracteres de datos perfectamente utiles.
  //
  // Es «no encontre» != «no esta», cometido en la herramienta que existe para
  // contestar exactamente esa pregunta. Ahora se RECUPERA lo que se pueda y se DICE
  // que vino cortado.
  const crudo = String(data.estado_detalle || '');
  let visto: Record<string, Visto> = {};
  let truncado = false;
  try {
    visto = JSON.parse(crudo || '{}');
  } catch {
    truncado = true;
    // Se cierra el objeto en la ultima entrada COMPLETA. Cada entrada es
    // `"clase":{…},` — se corta en la ultima llave que cierra a nivel 1.
    let nivel = 0; let enCadena = false; let escape = false; let corte = -1;
    for (let i = 0; i < crudo.length; i++) {
      const c = crudo[i];
      if (escape) { escape = false; continue; }
      if (c === '\\') { escape = true; continue; }
      if (c === '"') { enCadena = !enCadena; continue; }
      if (enCadena) continue;
      if (c === '{') nivel++;
      else if (c === '}') { nivel--; if (nivel === 1) corte = i; }
    }
    if (corte > 0) {
      try { visto = JSON.parse(crudo.slice(0, corte + 1) + '}'); } catch { visto = {}; }
    }
  }
  const clases = Object.keys(visto);

  if (!clases.length) {
    // «No vi nada» y «no pude mirar» son respuestas distintas.
    console.log(`El puente del ws ${ws} (v${data.version || '—'}) no reportó ningún pedido.`);
    console.log('El `detalle` viaja en el latido; si está vacío, la pestaña no respondió al espía.');
    return;
  }

  console.log(`ws ${ws} · extensión v${data.version || '—'} · ${clases.length} clases vistas`);
  if (truncado) {
    // Se dice, porque «vi 12 de 12» y «vi 12 y el resto se cortó» son respuestas
    // distintas y la segunda cambia lo que se puede concluir de un faltante.
    console.log(`⚠️  el detalle vino CORTADO en ${crudo.length} caracteres (tope 7500):`
      + ' hay mas clases de las que se ven acá.');
  }
  console.log('');
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
