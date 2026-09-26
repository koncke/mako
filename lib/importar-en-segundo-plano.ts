import 'server-only';

// =============================================================================
// importar-en-segundo-plano — el archivo no te hace esperar dos minutos mirando
// =============================================================================
// Leer un .md de 6 KB y sacarle las tareas tarda ~122 segundos MEDIDOS: la IA lee el
// texto entero, lo trocea y escribe un detalle largo por tarea. Eso es más de lo que
// una respuesta HTTP sobrevive, así que el modal se quedaba con el spinner girando
// para siempre y, si cerrabas, se perdían dos minutos de trabajo.
//
// LA FORMA CORRECTA, y es la que está acá: el POST **no espera**. Crea el borrador
// vacío en estado 'procesando', devuelve su id al instante, y la lectura sigue después
// de que la respuesta ya salió. Cuando termina, el mismo borrador se llena y pasa a
// 'pendiente'. El modal solo mira ese borrador: puede cerrarse, volver más tarde, o
// quedarse esperando — el trabajo no depende de que nadie mire.
//
// POR QUÉ `after()` Y NO UNA COLA: `after()` de Next mantiene viva la invocación hasta
// que el trabajo termina, dentro del `maxDuration` de la ruta (300 s, y esto tarda 122).
// No es durable —si la instancia se cae, se pierde— y por eso el borrador se crea ANTES
// de arrancar: si el trabajo muere, queda la fila en 'procesando' con su error, que es
// visible y reintentable, en vez de silencio. Una cola de verdad (tabla + cron) es el
// paso siguiente si esto alguna vez tiene que sobrevivir a un deploy a mitad de camino.
//
// ⚠️ EL CONTEXTO DE WORKSPACE NO VIAJA SOLO. `after()` corre fuera del
// `runWithWorkspace` del request, así que el ws se captura explícito y se re-envuelve.
// Sin eso, el borrador se llenaría en el workspace equivocado (o en ninguno).
// =============================================================================

import { runWithWorkspace } from './workspace';
import { archivoATexto } from './archivo-a-texto';
import { extraerTareasDeTexto } from './plan-fathom';
import { glosarioTexto } from './glosario';
import { marcarProcesado, marcarFallado } from './plan-propuesta';
import type { ProyectoRef, Yo } from './plan-fathom';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type ArchivoEnMemoria = { nombre: string; file: File };

/**
 * Lee los archivos y llena el borrador que ya existe. Se llama DESDE `after()`, así que
 * nada de lo que pase acá puede romperle la respuesta al usuario: todo termina o en el
 * borrador lleno, o en el borrador marcado con su error.
 */
export async function completarBorradorDeArchivos(opts: {
  ws: number;
  borradorId: string;
  archivos: ArchivoEnMemoria[];
  proyectos: ProyectoRef[];
  yo: Yo;
}): Promise<void> {
  const { ws, borradorId, archivos, proyectos, yo } = opts;
  const t0 = Date.now();
  try {
    await runWithWorkspace(ws, async () => {
      // Los archivos se leen en paralelo; la extracción es UNA sola sobre el texto
      // pegado (son partes de un mismo asunto: extraer cada uno por separado devolvería
      // la misma tarea repetida N veces).
      const lecturas = await Promise.all(archivos.map(async (a) => ({ nombre: a.nombre, ...(await archivoATexto(a.file)) })));
      const avisos = lecturas.filter((l) => l.warning).map((l) => l.warning!);
      const conTexto = lecturas.filter((l) => l.texto.trim());

      if (!conTexto.length) {
        await marcarFallado(borradorId, avisos[0] ?? 'No pude sacar texto de ninguno de esos archivos.');
        return;
      }

      const texto = conTexto
        .map((l) => (conTexto.length > 1 ? `\n\n===== ${l.nombre} =====\n` : '') + l.texto)
        .join('')
        .slice(0, 250_000);
      const etiqueta = conTexto.length === 1 ? conTexto[0].nombre : `${conTexto.length} archivos`;
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeTexto(texto, proyectos, yo, { glosario, usoMotivo: `Extraer tareas de ${etiqueta}` });

      const tareas = (out.tareas ?? [])
        .filter((t) => !t.esDeOtro)
        .map((t) => ({
          titulo: String(t.titulo ?? ''),
          detalle: String(t.detalle ?? ''),
          prioridad: t.prioridad,
          proyecto: t.proyectoNombre ? String(t.proyectoNombre) : undefined,
          // «Se repite para siempre» (mig 0163). Un acta subida a mano trae las mismas
          // recurrentes que una reunión de Fathom: si este map no la copia, el flag que
          // el modelo escribió muere acá.
          recurrente: t.recurrente,
        }));

      await marcarProcesado(borradorId, {
        tareas,
        resumen: conTexto.length === 1 ? `De «${conTexto[0].nombre}»` : `De ${conTexto.length} archivos`,
        avisos,
      });
      console.log(`[importar-bg] ws ${ws} · ${borradorId} · ${tareas.length} tareas en ${Math.round((Date.now() - t0) / 1000)}s`);
    });
  } catch (e) {
    console.error(`[importar-bg] ws ${ws} · ${borradorId}: ${msg(e)}`);
    // El error queda EN el borrador, no solo en el log: si esto falla, el usuario tiene
    // que poder verlo y reintentar, no quedarse mirando un «procesando» eterno.
    await runWithWorkspace(ws, () => marcarFallado(borradorId, msg(e))).catch(() => {});
  }
}
