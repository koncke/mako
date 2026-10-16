import 'server-only';

// =============================================================================
// leer-reunion-en-segundo-plano — «Extraer» una reunión ya no te tiene mirando un spinner
// =============================================================================
// 16/10/2026, «Fathom sin fricción» (decisión 7). Leer una reunión a mano desde el modal de Fathom
// era SINCRÓNICO: `/api/plan-fathom` `extraer` hacía la extracción entera adentro del pedido (1 a 5
// minutos medidos en vivo, decenas de llamadas por tramos) y el modal giraba hasta que volviera. Si
// lo cerrabas, el trabajo seguía o no según tuviera suerte, y no había dónde verlo.
//
// Ahora es el MISMO molde que la lectura de archivos (lib/importar-en-segundo-plano.ts): el pedido
// deja el borrador de esa reunión en 'procesando' y contesta al instante; la lectura sigue en
// `after()`, y cuando termina llena ese borrador (o lo marca con su error). El modal sólo mira el
// borrador: puede cerrarse y volver, o quedarse esperando. Antes de mostrarlo, la lectura CRUZA las
// tareas contra el tablero y las escribe ya selladas (lib/reunion-cruce.ts): el navegador ya no
// corre ninguna IA, y nunca ve un borrador a medio cruzar.
//
// ⚠️ EL CONTEXTO DE WORKSPACE NO VIAJA SOLO: `after()` corre fuera del `runWithWorkspace` del
// pedido. El ws se captura en la ruta y se re-envuelve acá (docs/hallazgos-infra.md).
// ⚠️ `after()` COMPARTE EL `maxDuration` de la ruta (300 s): `hasta` es ese reloj, y el cruce
// sólo corre si le queda tiempo (si no, lo hace el barrido del cron).
// =============================================================================

import { runWithWorkspace } from './workspace';
import { extraerTareasDeReunion, cacheKeyReunion, type ProyectoRef, type Yo, type TareaCandidata, type Participante, type DudaTermino } from './plan-fathom';
import { glosarioTexto } from './glosario';
import { getSetting, setSetting } from './settings';
import { marcarProcesado, marcarFallado, marcarSinCompromisos, type PropuestaTarea } from './plan-propuesta';
import { resolverClienteDeReunion, nombreDeProyectoPara } from './reunion-cliente';
import { cruzarTareas } from './reunion-cruce';
import { soltarLectura } from './reunion-leyendo';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Lo que la lectura dejó para el MODAL además de las tareas: las dudas del glosario y quiénes
 * estuvieron (para repartir). Vive al lado del borrador, por reunión, y lo lee el sondeo
 * (`estado-borrador`). Sin esto, leer en segundo plano perdía el paso de «¿qué es X?».
 */
export const KEY_LECTURA = (recordingId: number): string => `mako.reunion.lectura.${recordingId}`;
export type ExtrasDeLectura = { dudas: DudaTermino[]; participantes: Participante[]; partesFallidas: number; fin: string };

export async function extrasDeLectura(recordingId: number): Promise<ExtrasDeLectura | null> {
  const raw = await getSetting(KEY_LECTURA(recordingId)).catch(() => null);
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<ExtrasDeLectura>;
    return { dudas: Array.isArray(o.dudas) ? o.dudas : [], participantes: Array.isArray(o.participantes) ? o.participantes : [], partesFallidas: Number(o.partesFallidas) || 0, fin: String(o.fin ?? '') };
  } catch { return null; }
}

/**
 * Las candidatas de la extracción como tareas de BORRADOR. Una sola definición para la lectura en
 * segundo plano y para la rama de caché de la ruta (`asegurarBorrador`): si divergen, una de las
 * dos pierde un campo — ya pasó con el `minuto` (12/8) y con `recurrente`.
 *
 * Con cliente reconocido, MANDA el cliente: todas van a su proyecto.
 */
export function tareasDeLaExtraccion(tareas: TareaCandidata[], proyectos: ProyectoRef[], proyCliente: string): PropuestaTarea[] {
  const nombreProy = new Map(proyectos.map((pr) => [pr.id, pr.nombre]));
  return tareas.map((t) => ({
    titulo: t.titulo, detalle: t.detalle || undefined, prioridad: t.prioridad,
    proyecto: proyCliente || (t.proyectoId ? nombreProy.get(t.proyectoId) : (t.proyectoNombre?.trim() || undefined)),
    dueno: t.dueño || undefined, duenoEmail: t.dueñoEmail || undefined,
    esDeOtro: t.esDeOtro || undefined, minuto: t.minuto, minutos: t.minutos,
    // «Se repite para siempre» (mig 0163): lo que no se copie acá, el modelo lo escribió para nadie.
    recurrente: t.recurrente,
  }));
}

/**
 * Lee la reunión y llena el borrador que ya existe. Se llama DESDE `after()`: nada de lo que pase
 * acá puede romperle la respuesta al usuario. Todo termina en el borrador lleno, o marcado con su
 * error, y el candado de lectura suelto.
 */
export async function completarBorradorDeReunion(opts: {
  ws: number; borradorId: string; recordingId: number; titulo: string | null;
  proyectos: ProyectoRef[]; yo: Yo; uso?: string; hasta: number;
}): Promise<void> {
  const { ws, borradorId, recordingId, titulo, proyectos, yo } = opts;
  const t0 = Date.now();
  try {
    await runWithWorkspace(ws, async () => {
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeReunion(recordingId, proyectos, yo, { glosario, usoMotivo: opts.uso });
      const partesFallidas = out.partesFallidas ?? 0;
      // EL CACHÉ, con el mismo criterio que antes en la ruta y en el cron: sólo una lectura ENTERA
      // y con tareas. Uno a medias se serviría para siempre como «esto es todo».
      if (out.tareas.length && !partesFallidas) {
        await setSetting(cacheKeyReunion(recordingId), JSON.stringify({ tareas: out.tareas, participantes: out.participantes ?? [], ts: Date.now() })).catch(() => {});
      }
      await setSetting(KEY_LECTURA(recordingId), JSON.stringify({
        dudas: out.dudas ?? [], participantes: out.participantes ?? [], partesFallidas, fin: new Date().toISOString(),
      } satisfies ExtrasDeLectura)).catch(() => {});

      if (!out.tareas.length) {
        if (partesFallidas) await marcarFallado(borradorId, `no pude leer ${partesFallidas} tramo(s) de la reunión. Prueba de nuevo en un rato.`);
        else await marcarSinCompromisos(borradorId);
        return;
      }
      const cli = await resolverClienteDeReunion({ titulo, participantes: out.participantes ?? [] }).catch(() => null);
      const proyCliente = cli ? await nombreDeProyectoPara(cli).catch(() => '') : '';
      const mias = out.tareas.filter((t) => !t.esDeOtro).length;
      // EL CRUCE, ACÁ Y ANTES DE MOSTRARLAS (16/10/2026): el modal ya no lo corre, y tampoco ve el
      // borrador hasta que esté cruzado. Hasta ese día esto marcaba «pendiente» y DESPUÉS cruzaba: el
      // sondeo del modal tomaba las filas sin el cruce, su autosave lo borraba (con el sello puesto),
      // y cargar creaba la duplicada (`cruzarTareas`, lib/reunion-cruce.ts). Con el reloj que quede;
      // si no entra o el modelo no contesta, sale sin sello y lo cruza el barrido del cron.
      const tareas = tareasDeLaExtraccion(out.tareas, proyectos, proyCliente);
      const cruce = await cruzarTareas(tareas, { excluirId: borradorId, hasta: opts.hasta })
        .catch((e) => ({ tareas, cruzado: false, marcadas: 0, motivo: msg(e) }));
      await marcarProcesado(borradorId, {
        tareas: cruce.tareas, cruzado: cruce.cruzado,
        resumen: `MaKo leyó «${titulo ?? 'la reunión'}» y sacó ${mias} compromiso${mias === 1 ? '' : 's'} tuyo${mias === 1 ? '' : 's'}.${partesFallidas ? ` (${partesFallidas} tramo(s) sin leer)` : ''}`,
        clienteNombre: cli?.nombre, clienteLeadId: cli?.leadId,
      });
      console.log(`[leer-reunion-bg] ws ${ws} · ${borradorId} · ${out.tareas.length} tareas en ${Math.round((Date.now() - t0) / 1000)}s · ${cruce.cruzado ? 'cruzada' : `sin cruzar (${cruce.motivo ?? ''})`}`);
    });
  } catch (e) {
    console.error(`[leer-reunion-bg] ws ${ws} · ${borradorId}: ${msg(e)}`);
    await runWithWorkspace(ws, () => marcarFallado(borradorId, msg(e))).catch(() => {});
  } finally {
    await runWithWorkspace(ws, () => soltarLectura(recordingId)).catch(() => {});
  }
}
