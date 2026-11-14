// =============================================================================
// Probar el desarme de un video SIN la pantalla (ticket 97, 14/11/2026)
// =============================================================================
// Corre el MISMO código que la ruta (/api/video-editor/desarmar): el Gemini del negocio `ws` mira el video y salen el desarme,
// la receta, la plantilla «toca para reemplazar», el texto del chat y el paquete VIDEO.md. Deja todo en <salida>/ y NO escribe
// en la base (no guarda el desarme: eso lo hace la ruta). Lo que sí queda es el uso de IA del negocio (`recordUsage`): es lo
// que se gastó de verdad.
//
//   npx tsx --conditions=react-server --env-file=<.env.local> scripts/desarmar-probar.mts <ws> <salida> <red> <id> [archivo.mp4] [cuenta] [duracionS]
//
// Ejemplos (desde un worktree con node_modules):
//   … 9 out/pistachos instagram DdTdIIPDzHU C:/dev/reel-mentores/josep/josep-reel.mp4 tacho
//   … 9 out/mindvalley youtube lQpJatw_uM8 "" mindvalley 138
// Un reel va con su archivo (la File API); un video de YouTube, por su enlace (no se baja nada).
// =============================================================================

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runWithWorkspace } from '../lib/workspace';
import { mirarVideoConGemini } from '../lib/video-desarmar-gemini';
import {
  ESQUEMA_DESARME, VERSION_DESARME, comoMirar, estiloMasParecido, instruccionDesarme, leerDesarme, plantillaDeDesarme, recetaDeDesarme,
  ritmoDe, textoDeDesarme, type DesarmeGuardado, type EstiloDeGaleria, type RedDesarme,
} from '../lib/video-desarmar';
import { paqueteVideoMd } from '../lib/video-desarmar-videomd';
import { PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';

const [wsTxt, salida, red, id, archivo, cuenta, duracionTxt] = process.argv.slice(2);
const ws = Number(wsTxt);
if (!Number.isInteger(ws) || !salida || !red || !id) {
  console.error('Uso: desarmar-probar.mts <ws> <salida> <red> <id> [archivo.mp4] [cuenta] [duracionS]');
  process.exit(2);
}
const duracionS = duracionTxt ? Number(duracionTxt) : null;
const fuente = { red: red as RedDesarme, id, url: red === 'youtube' ? `https://www.youtube.com/watch?v=${id}` : `https://www.instagram.com/reel/${id}/`, cuenta: cuenta || null, titulo: null };

const t0 = Date.now();
const visto = await runWithWorkspace(ws, () => mirarVideoConGemini({
  video: archivo
    ? { tipo: 'archivo', bytes: new Uint8Array(readFileSync(archivo)), mime: 'video/mp4', nombre: `${red}-${id}` }
    : { tipo: 'youtube', url: `https://www.youtube.com/watch?v=${id}` },
  duracionS,
  mirar: (d) => {
    const c = comoMirar(d, fuente.red);
    return { ...c, instruccion: instruccionDesarme({ fps: c.fps, duracionS: d, hastaS: c.hastaS, cuenta: fuente.cuenta, titulo: null }) };
  },
  esquema: ESQUEMA_DESARME,
  feature: 'video-desarmar',
  motivo: `Probar el desarme de ${red}:${id}`,
  plazoMs: 700_000,
}));
const segundos = Math.round((Date.now() - t0) / 1000);
mkdirSync(salida, { recursive: true });
if (!visto.ok) {
  console.error(`NO (${segundos} s): ${visto.motivo} — ${visto.error}`);
  process.exit(1);
}
writeFileSync(join(salida, 'crudo.json'), JSON.stringify(visto.json, null, 2));
const leido = leerDesarme(visto.json, { duracionS: visto.duracionS ?? duracionS });
if (!leido.ok) {
  console.error(`La respuesta no sirvió: ${leido.error}`);
  process.exit(1);
}
const g: DesarmeGuardado = {
  version: VERSION_DESARME,
  fuente,
  miro: { modelo: visto.modelo, fps: visto.como.fps, cuadros: Math.round(leido.desarme.duracionS * visto.como.fps), tokens: visto.tokens, resolucion: visto.como.resolucion, hastaS: visto.como.hastaS, cuando: new Date().toISOString() },
  desarme: leido.desarme,
};
const estilo = estiloMasParecido(g.desarme.subtitulos, PLANTILLAS_SUBTITULO as unknown as readonly EstiloDeGaleria[]);
const { plantilla, recorte, textosFuera } = plantillaDeDesarme(g, estilo);
writeFileSync(join(salida, 'desarme.json'), JSON.stringify(g, null, 2));
writeFileSync(join(salida, 'receta.json'), JSON.stringify(recetaDeDesarme(g, estilo), null, 2));
writeFileSync(join(salida, 'plantilla.json'), JSON.stringify(plantilla, null, 2));
writeFileSync(join(salida, 'chat.txt'), textoDeDesarme(g, estilo, { recorte, textosFuera }));
for (const [ruta, texto] of Object.entries(paqueteVideoMd(g))) {
  const destino = join(salida, 'videomd', ruta);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto);
}
const r = ritmoDe(g.desarme);
console.log(`OK en ${segundos} s · ${visto.modelo} · ${visto.como.fps} fps (${visto.como.resolucion}) · ${visto.tokens} tokens`);
console.log(`${r.planos} planos en ${g.desarme.duracionS} s · corte cada ${r.planoMedioS} s · el más corto ${r.masCortoS} s · ${r.menosDeUnSegundo} de menos de 1 s`);
console.log(`subtítulos: ${g.desarme.subtitulos.hay ? `${estilo} (${g.desarme.subtitulos.descripcion})` : 'no'} · textos: ${g.desarme.textos.length} · frases: ${g.desarme.frases.length} · dudas: ${g.desarme.dudas.length}`);
