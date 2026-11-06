// =============================================================================
// scripts/probar-broll-ia.mts — el B-roll con la IA DE VERDAD sobre guiones de ejemplo (6/11/2026)
// =============================================================================
// El test (tests/video-editor-broll.test.ts) prueba las reglas y lo que se hace con respuestas de un modelo escritas a
// mano. Esto corre lo MISMO que la ruta /api/video-editor/broll (`elegirBroll`, con la IA del negocio y el prompt
// editable) sobre tres guiones ficticios, y mide lo que importa de la respuesta:
//   · que la IA haya contestado (`conIA`) y cuántas eligió contra el objetivo;
//   · que cada búsqueda sea visual y en inglés (sin tildes ni «ñ»), sin repetir;
//   · el porqué de cada una, para leerlo.
// No escribe nada; gasta la IA del negocio (unas pocas llamadas de ~1.500 tokens). En el Cliente de Prueba, nunca el ws 1:
//
//   node --env-file=<.env.local del clon> --import tsx --conditions=react-server scripts/probar-broll-ia.mts [--ws 3]
// =============================================================================

import { runWithWorkspace } from '../lib/workspace';
import { conSuIADelNegocio } from '../lib/ia-del-negocio';
import { elegirBroll } from '../lib/editor-video/broll-ia';
import { huecosParaBroll, type Frase } from '../lib/editor-video/broll';

const args = process.argv.slice(2);
const ws = Number(args[args.indexOf('--ws') + 1] || 3);
if (!Number.isInteger(ws) || ws === 1) {
  console.error('Usa el Cliente de Prueba (--ws 3), nunca el ws 1 (es un cliente).');
  process.exit(2);
}

const frases = (lista: Array<[string, number, number]>): Frase[] => lista.map(([texto, inicio, fin]) => ({ texto, inicio, fin }));

const GUIONES: Record<string, Frase[]> = {
  cafeteria: frases([
    ['¿Sabías que el 80% de los restaurantes cierran el primer año?', 0, 3.2],
    ['Yo tenía una cafetería y casi la pierdo.', 3.4, 6],
    ['Las mesas estaban vacías todos los martes.', 6.1, 8.5],
    ['Entonces probé algo distinto con Instagram.', 8.7, 11],
    ['Empecé a grabar a mis clientes tomando café.', 11.2, 14],
    ['Y en tres semanas, la fila llegaba a la esquina.', 14.1, 17],
    ['Si tienes un negocio local, esto es para ti.', 19.6, 22],
  ]),
  inmobiliaria: frases([
    ['Comprar tu primera casa no tiene que dar miedo.', 0, 3],
    ['La mayoría se pierde entre bancos, papeles y notarios.', 3.2, 6.5],
    ['Nosotros te acompañamos desde la visita hasta la entrega de llaves.', 6.7, 10.5],
    ['Revisamos el crédito hipotecario contigo, punto por punto.', 10.7, 14],
    ['Y negociamos el precio con el vendedor.', 14.2, 17],
    ['Agenda tu llamada gratis y empieza hoy.', 17.3, 20],
  ]),
  entrenadora: frases([
    ['Si entrenas una hora al día y no ves cambios, escucha esto.', 0, 3.5],
    ['El problema casi nunca es el gimnasio.', 3.7, 6],
    ['Es lo que comes después de entrenar.', 6.2, 8.5],
    ['Una proteína, verduras y agua: así de simple.', 8.7, 12],
    ['Mis alumnas bajan dos tallas en ocho semanas.', 12.2, 15.5],
    ['Escríbeme y te paso el plan de comidas.', 15.7, 18.5],
  ]),
};

await runWithWorkspace(ws, () =>
  conSuIADelNegocio(ws, async () => {
    for (const [nombre, guion] of Object.entries(GUIONES)) {
      const duracion = guion[guion.length - 1].fin + 1;
      const { huecos, objetivo } = huecosParaBroll({ frases: guion, duracion });
      const t0 = Date.now();
      const r = await elegirBroll(huecos, objetivo);
      const busquedas = r.elegidos.map((e) => e.busqueda.toLowerCase());
      const problemas = [
        !r.conIA ? `sin IA: ${r.aviso}` : '',
        r.elegidos.length > objetivo ? `eligió ${r.elegidos.length} con objetivo ${objetivo}` : '',
        busquedas.some((b) => /[áéíóúñ¿¡]/.test(b)) ? 'una búsqueda no está en inglés' : '',
        new Set(busquedas).size !== busquedas.length ? 'repite una búsqueda' : '',
      ].filter(Boolean);
      console.log(`\n${nombre} · ${huecos.length} huecos, objetivo ${objetivo} · ${Date.now() - t0} ms · ${problemas.length ? `⚠ ${problemas.join(' · ')}` : '✔'}`);
      for (const e of r.elegidos) {
        const h = huecos.find((x) => x.i === e.hueco);
        console.log(`  [${e.hueco}] «${h?.frase}» → ${e.busqueda}${e.motivo ? ` (${e.motivo})` : ''}`);
      }
    }
  }),
);
