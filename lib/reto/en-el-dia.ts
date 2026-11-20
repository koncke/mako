// =============================================================================
// LO QUE SALE DENTRO DE UN DÍA DEL RETO, POR LA COLA DE SALIDA (20/11/2026, el Cerebro)
// =============================================================================
// Martín, probando el reto: cada paso de un día (la extensión, las integraciones, la hora, el perfil, la prueba por WhatsApp,
// «¡Hiciste todo…!» y el clip del día 6) entraba de golpe, sin puntitos: bastaba que /api/reto dijera «hecha» para que apareciera el
// paso siguiente con su mensaje y su tarjeta en el mismo cuadro. Su regla vale para todo: cada mensaje de MaKo con sus puntitos, y la
// tarjeta después del texto.
// Esto dice QUÉ sale dentro de un día y en qué orden. Lo usan los dos lados, para que no se separen:
//   · el chat del reto (app/second-brain/reto/ChatDelReto.tsx) arma con esto las filas de la cola compartida (app/_chat/useColaDeSalida.ts),
//     retenidas hasta que el día mostró su mensaje y su tarjeta;
//   · `Dia` dibuja cada paso sólo cuando su fila ya salió de la cola, y su tarjeta (`pieza`) cuando salió su pieza.
// Lo prueba tests/reto-dia-por-la-cola.test.ts.
// =============================================================================
import { RETO_D2_EXT, RETO_D2_HORA, RETO_D2_INT, RETO_D2_INT_LISTAS, RETO_D2_PERFIL, diaTerminado, tareaDespues, tareaHecha, type DiaReto, type EstadoReto } from './dias';

/** Un paso de adentro de un día: su id en la cola, el texto de MaKo (lo que duran sus puntitos) y si trae su tarjeta después. */
export type PasoEnElDia = { id: string; que: QueEnElDia; texto: string; pieza: boolean };
export type QueEnElDia = 'ext' | 'int' | 'clip' | 'hora' | 'hora-ok' | 'prueba' | 'perfil' | 'todo';

/** El id de un paso en la cola del chat del reto: `en:<día>:<qué>`. */
export const idEnElDia = (n: number, que: QueEnElDia): string => `en:${n}:${que}`;
/** El día de un paso de la cola (`en:2:ext` → 2), o null si la fila no es de adentro de un día. */
export const diaDelPaso = (id: string): number | null => { const m = /^en:(\d+):/.exec(id); return m ? Number(m[1]) : null; };

/**
 * Lo que sale dentro de un día, en el orden en que `Dia` lo dibuja (después del mensaje del día, su video y su tarjeta, que van con su
 * propia entrada). `hoy`: el día abierto. El día 2 de HOY va en pasos (d24-08): la extensión, las integraciones y, con esas tres
 * tareas hechas o para después, la hora y el perfil. Un día que ya pasó se ve entero.
 */
export function pasosEnElDia(dia: DiaReto, e: EstadoReto, o: { hoy: boolean; integraciones: ReadonlyArray<{ conectada: boolean }> }): PasoEnElDia[] {
  const out: PasoEnElDia[] = [];
  const poner = (que: QueEnElDia, texto: string, pieza: boolean) => out.push({ id: idEnElDia(dia.n, que), que, texto, pieza });
  const tarea = (id: string) => dia.tareas.find((t) => t.id === id);
  const pasos2 = dia.n === 2 && o.hoy;
  const paso2 = pasos2 ? ['app', 'extension', 'integraciones'].findIndex((id) => !tareaHecha(e, 2, id) && !tareaDespues(e, 2, id)) : -1;
  const llega2 = (i: number) => !pasos2 || paso2 === -1 || i <= paso2;
  // La extensión, con su mensaje y su tarjeta.
  if (pasos2 && llega2(1) && tarea('extension')) poner('ext', RETO_D2_EXT, true);
  // Las integraciones de lo que eligió: el mensaje y la tarjeta «Te falta integrar esto». Sin ninguna, la fila de la tarea sola.
  if (dia.n === 2 && llega2(2)) {
    if (o.integraciones.length > 0) poner('int', o.integraciones.every((i) => i.conectada) ? RETO_D2_INT_LISTAS : RETO_D2_INT, true);
    else if (pasos2 && tarea('integraciones')) poner('int', tarea('integraciones')!.titulo, false);
  }
  // El clip de regalo del día 6: su tarjeta (el formulario, o el clip).
  if (dia.n === 6) poner('clip', 'Tu clip de regalo', false);
  // La prueba por WhatsApp va al FINAL del día (f24-02); la hora del día 2 es un paso del día: su mensaje y su tarjeta. Guardada, el
  // mensaje queda (sin la tarjeta) y la confirmación llega como mensaje nuevo, con sus puntitos.
  const p = dia.whatsapp;
  if (p && dia.n === 2 && llega2(3)) {
    poner('hora', RETO_D2_HORA, !e.horaWa);
    if (e.horaWa) poner('hora-ok', `✓ MaKo te escribe cada día a las ${e.horaWa}, por WhatsApp.`, false);
  }
  if (p && dia.n !== 2 && dia.n !== 7 && diaTerminado(e, dia)) poner('prueba', p.texto, false);
  // El perfil, último paso del día 2: recién con la hora guardada o dejada para después.
  const perfil = dia.n === 2 ? tarea('perfil') : undefined;
  if (perfil && llega2(3) && (!pasos2 || !!e.horaWa || tareaDespues(e, 2, 'hora'))) poner('perfil', RETO_D2_PERFIL, true);
  // Con todo hecho, la felicita (sólo el día 2, R57-F4).
  if (dia.n === 2 && dia.tareas.every((t) => tareaHecha(e, dia.n, t.id))) poner('todo', `¡Hiciste todo lo del día ${dia.n}!`, false);
  return out;
}
