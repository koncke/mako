// =============================================================================
// probar-contrato-fathom — ¿el contrato de 600 chars funciona? Medilo, no lo supongas.
// =============================================================================
// El prompt de Fathom declara un piso de 600 chars y un molde de 4 partes, y en el
// tablero NINGUNA de las 150 tareas lo cumple. Pero las 150 son del 30/7 al 4/8 y el
// contrato se escribió el 5/8 a las 14:58: nunca corrió. Esto lo corre contra un
// transcript real y mide lo que sale. NO ESCRIBE NADA en el tablero.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probar-contrato-fathom.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { extraerTareasDeTexto } from '../lib/plan-fathom';
import { evaluarDetalle } from '../lib/detalle-contrato';
import { getSupabaseServer } from '../lib/supabase';

// Un pedazo de conversación real y densa, del estilo del que produce las tareas.
const TEXTO = `
Martín: Che, una cosa que vi y me quedé pensando. El botón de importar del plan, cuando le doy, me abre el buscador de archivos de Windows directo. Y eso está mal, porque yo quiero ver primero qué estoy por subir.
Mauricio: ¿Como el de subir videos a la campaña?
Martín: Exacto, igual a ese. Que me abra el modal y ahí yo arrastro. Y que me deje meter varios, no de a uno. El otro día quise subir el PDF del contrato y el audio de la reunión juntos y no pude.
Mauricio: ¿Y si falla uno?
Martín: Ahí está el tema. Ahora si falla desaparece y no sabés cuál fue. Tiene que decirme cuál falló y por qué, y los otros que sigan. Que no se caiga todo por uno.
Martín: Otra cosa, el historial de la tab de proyectos. Eso es un scroll infinito, tenés que bajar como treinta segundos para llegar a lo de abajo. Poneme un "ver más" que cargue de a poco.
Mauricio: ¿De a cuánto?
Martín: No sé, diez. Y que me diga cuántas faltan, si no no sé si vale la pena abrirlo. Y que sea un texto centrado, no un botonzote.
Martín: Y lo del Perro. Le mandé por WhatsApp cinco tareas de una feature nueva de mindset y las tiró en cuatro proyectos distintos. Ni siquiera dejó juntas las tres que eran del mismo tema. Eso no puede pasar, si le digo que es un tema nuevo tiene que abrirle su proyecto.
Mauricio: ¿Y no lo hizo nunca?
Martín: Nunca. Y encima por WhatsApp me dijo que las había puesto en un proyecto que después no existía. Eso es lo peor, me prometió una cosa y en el tablero había otra.
`.trim();

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  await runWithWorkspace(ws.id, async () => {
    console.log(`Corriendo la extracción REAL con el prompt de hoy (${TEXTO.length} chars de entrada). No escribe nada.\n`);
    const out = await extraerTareasDeTexto(TEXTO, [], { nombre: 'Martín Koncke', email: 'martin@makodigital.app' } as never);
    const tareas = out.tareas ?? [];
    console.log(`${tareas.length} tareas\n`);
    let ok = 0;
    for (const t of tareas) {
      const e = evaluarDetalle(t.detalle ?? '');
      if (e.conForma) ok++;
      console.log(`[${String(e.chars).padStart(4)} ch · ${e.partes.length}/4 partes] ${String(t.titulo).slice(0, 62)}`);
      if (e.faltan.length) console.log(`        faltan: ${e.faltan.join(', ')}`);
    }
    const largos = tareas.map((t) => (t.detalle ?? '').length).sort((a, b) => a - b);
    console.log(`\nmediana=${largos[Math.floor(largos.length / 2)]} · máx=${largos[largos.length - 1]} · con 600+=${largos.filter((x) => x >= 600).length}/${largos.length} · con forma=${ok}/${tareas.length}`);
    console.log(`\n--- EJEMPLO COMPLETO ---\n${tareas[0]?.detalle ?? '(nada)'}`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
