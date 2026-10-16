import 'server-only';

// =============================================================================
// todo-rutear — a qué proyecto va cada tarea NUEVA del tablero de un cliente
// =============================================================================
// Es el gemelo del ruteo del board del dueño (agregarTareasPlanOwner), y existe por
// lo mismo: sin una lista cerrada de destinos, cada tarea que entra por WhatsApp, por
// una reunión o por su agente se lleva su propio proyecto. Tres nombres para el mismo
// trabajo y un tablero de 60 proyectos de una tarea cada uno.
//
// El orden de decisión —de la señal más dura a la más blanda— es:
//   1. ¿La tarea NOMBRA a un cliente suyo? → «Cliente: NOMBRE». Sale del CRM
//      (lib/reunion-cliente.ts), no de que el modelo lo intuya.
//   2. ¿El texto nombra un proyecto que YA existe? → ese. El dueño ya decidió.
//   3. Si no, el Perro elige UNA de las áreas: los proyectos que ya tiene + las del
//      catálogo (lib/todo-proyectos-catalogo.ts) que todavía no creó.
//   4. Si el ruteo falla entero, queda lo que propuso quien cargó la tarea.
//
// Devuelve NOMBRES (no ids): quien llama crea o reusa la categoría. Una sola llamada
// al modelo para todo el lote — puntuar de a una es lo que hacía que dos tareas del
// mismo tema cayeran en proyectos distintos.
// =============================================================================

import { listCategorias } from './todo';
import { proyectoParaTarea } from './reunion-cliente';
import { asignarTareasAProyectos } from './mako-guardian';
import { CATALOGO_TODO, delCatalogoTodo, PREFIJO_CLIENTE } from './todo-proyectos-catalogo';
import { esProyectoDeCliente, esProyectoBandeja, destinoSinIA, type DestinoSinIA } from './plan-bandeja';

const norm = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** ¿Este proyecto ES un cliente? (para dejarlo afuera del menú del Perro).
 *
 *  Antes esto era `norm(nombre).startsWith(norm(PREFIJO_CLIENTE))`, y estaba MUERTO:
 *  `norm` no borra puntuación, así que el patrón buscado era literalmente «cliente:»
 *  con los dos puntos, y ningún proyecto real del tablero de Mauricio se llama así
 *  («Cuenta Grupo Esquer», «Cliente Baja Teriyaki», «Cuenta TEXX»…). Medido en prod:
 *  excluía 0 de 15 proyectos en ws1 y 0 de 8 en ws11 — o sea que una tarea que no
 *  nombra a NADIE podía caer en la cuenta de Grupo Esquer solo porque el tema se
 *  parecía, que es exactamente lo que esta guarda existe para impedir.
 *
 *  Ahora se reconoce la familia de prefijos que el dueño usa de verdad (con o sin
 *  dos puntos) Y el prefijo canónico que crea `nombreProyectoCliente`. Lo que no
 *  lleva prefijo —un proyecto llamado con el nombre pelado del cliente— sigue sin
 *  detectarse: para eso está el renombre. */
// La regla vive en lib/plan-bandeja.ts desde el 16/10/2026 (sin `server-only`): la usa también
// la carga SIN IA de un borrador, que tiene que reconocer el proyecto del cliente de la reunión.
export { esProyectoDeCliente };

export type TareaARutear = { titulo: string; detalle?: string | null; proyectoSugerido?: string };
export type DestinoTarea = {
  /** El NOMBRE del proyecto destino (o undefined si no hubo ninguno). */
  nombre?: string;
  /** Por qué fue ahí — va al historial de la tarjeta. */
  razon: string;
  /** Del catálogo: el color y el emoji con el que hay que crearlo si no existe. */
  color?: string;
  emoji?: string;
  /**
   * DE DÓNDE SALIÓ el destino (16/10/2026, «Re-priorizar todo»). Quien llama decide con esto qué
   * puede CREAR: un «Cliente: X» que sale del CRM y un área del catálogo sí; un proyecto que propuso
   * el modelo (`nuevo`) o quien cargó la tarea (`sugerido`), no — en un trabajo que corre solo,
   * sin nadie mirando, un nombre inventado abriría un proyecto (lib/plan-bandeja.ts).
   */
  via?: 'cliente' | 'proyecto' | 'perro' | 'nuevo' | 'sugerido';
};

export async function rutearTareasCliente(items: TareaARutear[]): Promise<DestinoTarea[]> {
  const out: DestinoTarea[] = items.map(() => ({ razon: '' }));
  if (!items.length) return out;

  const cats = await listCategorias().catch(() => [] as Array<{ id: number; nombre: string }>);

  // ── 1 y 2: las señales duras, una por tarea ────────────────────────────────
  const pendientes: number[] = [];
  await Promise.all(items.map(async (it, i) => {
    const r = await proyectoParaTarea({ titulo: it.titulo, detalle: it.detalle, proyectoSugerido: it.proyectoSugerido }).catch(() => null);
    if (r?.cliente && r.nombre) { out[i] = { nombre: r.nombre, razon: `es de ${r.cliente.nombre}, un cliente del CRM`, via: 'cliente' }; return; }
    if (r?.porProyecto) { out[i] = { nombre: r.porProyecto, razon: `el texto nombra el proyecto «${r.porProyecto}», que ya existe`, via: 'proyecto' }; return; }
    pendientes.push(i);
  }));
  if (!pendientes.length) return out;

  // ── 3: el Perro elige un área, contra una lista CERRADA ────────────────────
  // Los proyectos que ya tiene mandan (con su tamaño, que le dice cuál es el grande),
  // y el catálogo aporta solo los que le faltan. Los proyectos que SON un cliente se
  // dejan afuera del menú: una tarea que no nombra a nadie no puede caer en el
  // proyecto de un cliente cualquiera solo porque el tema se parece.
  const yaEstan = new Set(cats.map((c) => norm(c.nombre)));
  const destinos = [
    // La BANDEJA tampoco es un destino (16/10/2026): una tarea no «va» a «Sin proyecto», cae ahí
    // cuando nada la reclama — y este ruteo es justamente lo que la saca de ahí.
    ...cats.filter((c) => !esProyectoDeCliente(c.nombre) && !esProyectoBandeja(c.nombre))
      .map((c) => ({ nombre: c.nombre, que: delCatalogoTodo(c.nombre)?.que ?? '' })),
    ...CATALOGO_TODO.filter((c) => !yaEstan.has(norm(c.nombre))).map((c) => ({ nombre: c.nombre, que: c.que })),
  ];
  if (!destinos.length) return out;

  const r = await asignarTareasAProyectos(
    // Con el DETALLE: el cliente también manda tareas de un tema que su tablero todavía
    // no tiene, y con el título solo el ruteador no puede saberlo.
    pendientes.map((i) => ({ titulo: items[i].titulo, grupo: items[i].proyectoSugerido, detalle: items[i].detalle ?? undefined })),
    destinos,
    'Rutear tareas nuevas del cliente a sus proyectos',
  ).catch((e) => { console.error('[todo-rutear] asignar:', e instanceof Error ? e.message : String(e)); return { asign: [] as Array<{ i: number; destino: string; razon: string }>, nuevos: [] as Array<{ nombre: string; que: string; porQue: string; tareas: number[] }> }; });

  for (const a of r.asign) {
    const idx = pendientes[a.i];
    if (idx == null) continue;
    const cat = delCatalogoTodo(a.destino);
    out[idx] = { nombre: a.destino, razon: a.razon || 'lo eligió MaKo entre los proyectos que ya hay', color: cat?.color, emoji: cat?.emoji, via: 'perro' };
  }

  // Los proyectos que el Perro pidió abrir. El camino del cliente los TIRABA entero:
  // tenía menos capacidad que el del dueño sin ninguna razón.
  //
  // ⚠️ VA DESPUÉS DE `asign`, NO ANTES (mismo orden que lib/plan-board.ts). Los índices
  // que vienen con el proyecto nuevo MANDAN: si el modelo propuso «Mindset» para las
  // tareas 0,1,2 pero en `asign` las mandó a tres lugares distintos, el que tiene razón
  // es `nuevos`. Al revés —nuevos primero— `asign` lo pisaba y el proyecto nacía vacío,
  // que es exactamente el bug que este bloque venía a cerrar.
  for (const n of (r.nuevos ?? [])) {
    for (const k of (n.tareas ?? [])) {
      const idx = pendientes[k];
      if (idx == null) continue;
      out[idx] = { nombre: n.nombre, razon: n.porQue.slice(0, 200) || 'MaKo lo abrió: ninguno de los que tenías lo cubría', via: 'nuevo' };
    }
  }
  // ── 4: red. Lo que propuso quien la cargó, si el ruteo no la alcanzó.
  for (const i of pendientes) {
    if (!out[i].nombre && items[i].proyectoSugerido) out[i] = { nombre: items[i].proyectoSugerido, razon: 'lo propuso quien cargó la tarea (el ruteo no respondió)', via: 'sugerido' };
  }
  return out;
}

/**
 * EL RUTEO SIN IA del tablero del cliente (16/10/2026, «Fathom sin fricción»): los pasos 1, 2 y 4
 * de `rutearTareasCliente` —los que no llaman a ningún modelo— y, en vez del Perro, la BANDEJA
 * «Sin proyecto». Es lo que usa «Cargar» un borrador (aplicarPropuestas): la carga tiene que tardar
 * segundos y no gastar nada; a qué ÁREA va lo que no se pudo deducir lo decide «Re-priorizar todo».
 *
 * La regla entera (qué propuesta se acepta y cuál va a la bandeja) es `destinoSinIA`
 * (lib/plan-bandeja.ts, pura y con test). Acá sólo se hacen las lecturas: los proyectos que hay y,
 * por tarea, si el texto nombra a un cliente del CRM o a un proyecto existente.
 *
 * `clienteDeLaReunion`: el borrador sabe con qué cliente fue la reunión (mig 0160). Sólo así un
 * «Cliente: X» que todavía no existe puede nacer: es la señal del CRM, no el modelo.
 */
export async function rutearSinIA(items: TareaARutear[], opts: { clienteDeLaReunion?: boolean } = {}): Promise<DestinoSinIA[]> {
  if (!items.length) return [];
  const cats = await listCategorias().catch(() => [] as Array<{ id: number; nombre: string }>);
  const existentes = new Set(cats.map((c) => norm(c.nombre)));
  return Promise.all(items.map(async (it) => {
    const r = await proyectoParaTarea({ titulo: it.titulo, detalle: it.detalle }).catch(() => null);
    const deTexto = r?.cliente && r.nombre ? { nombre: r.nombre, via: 'cliente-en-texto' as const }
      : r?.porProyecto ? { nombre: r.porProyecto, via: 'proyecto-en-texto' as const }
        : null;
    return destinoSinIA({
      deTexto,
      propuesto: it.proyectoSugerido,
      existe: (n) => existentes.has(norm(n)),
      delCatalogo: (n) => delCatalogoTodo(n)?.nombre,
      esClienteDeLaReunion: (n) => !!opts.clienteDeLaReunion && esProyectoDeCliente(n),
    });
  }));
}
