// =============================================================================
// scripts/probar-clips-ia.mts — «Clips mágicos» con la IA DE VERDAD sobre transcripciones de ejemplo (6/11/2026)
// =============================================================================
// El test (tests/video-editor-clips.test.ts) prueba las reglas y lo que se hace con respuestas de un modelo escritas a
// mano. Esto corre lo MISMO que la ruta /api/video-editor/clips (`elegirClips`, con la IA del negocio y el prompt
// editable) sobre dos videos largos ficticios, y mide lo que importa de la respuesta:
//   · que la IA haya contestado (`conIA`) y cuántos clips eligió contra lo pedido;
//   · que cada clip dure de 15 a 60 s, no se pise más de la mitad con otro y empiece en una frase que arranca una idea;
//   · el título y el porqué de cada uno, para leerlos.
// No escribe nada; gasta la IA del negocio (un pedido de ~4.000 tokens por cada 20 minutos). En el Cliente de Prueba,
// nunca el ws 1:
//
//   node --env-file=<.env.local del clon> --import tsx --conditions=react-server scripts/probar-clips-ia.mts [--ws 3]
// =============================================================================

import { runWithWorkspace } from '../lib/workspace';
import { conSuIADelNegocio } from '../lib/ia-del-negocio';
import { elegirClips } from '../lib/editor-video/clips-ia';
import { solape, TOPES_CLIPS, type Frase } from '../lib/editor-video/clips';

const args = process.argv.slice(2);
const ws = Number(args[args.indexOf('--ws') + 1] || 3);
if (!Number.isInteger(ws) || ws === 1) {
  console.error('Usa el Cliente de Prueba (--ws 3), nunca el ws 1 (es un cliente).');
  process.exit(2);
}

/** Arma un video largo repitiendo los temas: cada frase dura lo que pide su largo (~2,8 palabras por segundo). */
function video(temas: string[][], vueltas: number): Frase[] {
  const out: Frase[] = [];
  let t = 0;
  for (let v = 0; v < vueltas; v++) {
    for (const tema of temas) {
      for (const texto of tema) {
        const dur = Math.max(1.5, texto.split(/\s+/).length / 2.8);
        out.push({ texto, inicio: t, fin: t + dur });
        t += dur + 0.3;
      }
      t += 1.2; // la pausa entre una idea y la otra
    }
  }
  return out;
}

const VIDEOS: Record<string, Frase[]> = {
  podcastVentas: video([
    [
      '¿Por qué la mayoría de los vendedores pierde la venta en el primer minuto?',
      'Porque hablan de su producto antes de entender al cliente.',
      'Yo lo hice durante años y cerraba una de cada veinte llamadas.',
      'El día que empecé a preguntar primero, pasé a cerrar una de cada cinco.',
      'La pregunta que cambió todo fue: ¿qué te hizo agendar esta llamada hoy?',
      'Esa respuesta te dice cuánto le urge y cuánto está dispuesto a pagar.',
    ],
    [
      'Bueno, antes de seguir, gracias a todos los que nos escuchan cada semana.',
      'Recuerden que pueden dejar sus preguntas en los comentarios.',
      'Y si les gusta el episodio, compártanlo con alguien que venda.',
    ],
    [
      'El error más caro que veo en los equipos de venta es no hacer seguimiento.',
      'El ochenta por ciento de las ventas se cierra después del quinto contacto.',
      'Y la mayoría de los vendedores abandona después del segundo.',
      'Un mensaje corto a los tres días, otro a la semana, y una llamada a los diez.',
      'Con eso solo, un cliente nuestro duplicó sus cierres en un mes.',
    ],
    [
      'Ahora, hablemos de precios, que es lo que todos preguntan.',
      'Nunca digas el precio antes de que el cliente diga cuánto le cuesta su problema.',
      'Si su problema le cuesta cincuenta mil al año, diez mil es barato.',
      'Si no sabes cuánto le cuesta, cualquier precio le va a parecer caro.',
    ],
  ], 6),
  claseCocina: video([
    [
      'Hoy les enseño la salsa que más me piden en el restaurante.',
      'Son cinco ingredientes y la hacen en diez minutos.',
      'Tomate, ajo, aceite de oliva, albahaca y una pizca de azúcar.',
      'El secreto está en el azúcar: le quita la acidez al tomate.',
    ],
    [
      'Primero, el ajo va en el aceite frío, nunca en el caliente.',
      'Si lo echas en el aceite caliente se quema y la salsa queda amarga.',
      'Lo calientan juntos, a fuego bajo, hasta que el ajo se pone dorado.',
    ],
    [
      'Mientras tanto, les cuento que el restaurante abrió hace doce años.',
      'Empezamos con cuatro mesas y hoy tenemos tres locales.',
      'Y esta salsa estuvo en el menú desde el primer día.',
    ],
  ], 8),
};

await runWithWorkspace(ws, () =>
  conSuIADelNegocio(ws, async () => {
    for (const [nombre, frases] of Object.entries(VIDEOS)) {
      for (const pedidos of [3, 5]) {
        const t0 = Date.now();
        const r = await elegirClips(frases, pedidos);
        const problemas = [
          !r.conIA ? `sin IA: ${r.aviso}` : r.aviso ? `aviso: ${r.aviso}` : '',
          r.clips.length > pedidos ? `eligió ${r.clips.length} con ${pedidos} pedidos` : '',
          r.clips.some((c) => c.fin - c.inicio < TOPES_CLIPS.minSeg || c.fin - c.inicio > TOPES_CLIPS.maxSeg) ? 'un clip fuera de 15-60 s' : '',
          r.clips.some((a, i) => r.clips.some((b, j) => j > i && solape(a, b) > TOPES_CLIPS.solapeMax)) ? 'dos clips se pisan' : '',
        ].filter(Boolean);
        const largo = Math.round(frases[frases.length - 1].fin / 60);
        console.log(`\n${nombre} (${largo} min) · ${pedidos} pedidos · ${r.clips.length} clips · ${Date.now() - t0} ms · ${problemas.length ? `⚠ ${problemas.join(' · ')}` : '✔'}`);
        for (const c of r.clips) {
          console.log(`  ${c.puntaje} · ${Math.round(c.inicio)}-${Math.round(c.fin)} s · «${c.titulo}» → «${c.primera}»${c.motivo ? ` (${c.motivo})` : ''}`);
        }
      }
    }
  }),
);
