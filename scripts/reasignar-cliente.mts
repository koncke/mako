// =============================================================================
// reasignar-cliente — mover tareas al proyecto «Cliente: NOMBRE» del tablero
// =============================================================================
// Uso:  node --conditions react-server --import tsx scripts/reasignar-cliente.mts [--aplicar]
//
// Las tareas que salen de una llamada con un CLIENTE y que son trabajo PARA ese
// cliente van a su proyecto, no al proyecto temático que eligió el modelo. La regla
// ya estaba escrita para el tablero de un cliente (lib/reunion-cliente.ts); acá se
// aplica al tablero del super-admin, donde sus clientes son los WORKSPACES de la
// plataforma y no filas del CRM — por eso el resolver de siempre nunca disparó.
//
// Por defecto es un ENSAYO: imprime qué movería. Con `--aplicar` lo hace, y deja
// rastro en el historial de cada tarjeta (regla de la casa: todo lo que toca la IA
// deja rastro con actor MaKo).
// =============================================================================
import { config } from 'dotenv';
config({ path: '.env.local' });

const APLICAR = process.argv.includes('--aplicar');

const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
const { crearPlanProyecto } = await import('../lib/plan-board');

/** #num → cliente. La decisión es por tarea: de una misma llamada salen cosas del
 *  cliente y features del producto, y meter las features en el proyecto del cliente
 *  esconde trabajo de producto adentro de una carpeta que nadie va a mirar. */
const MOVER: Record<number, string> = {
  724: 'Mauricio', 725: 'Mauricio', 726: 'Mauricio',
  711: 'Código Inmobiliario', 712: 'Código Inmobiliario', 713: 'Código Inmobiliario',
  714: 'Código Inmobiliario', 719: 'Código Inmobiliario', 721: 'Código Inmobiliario',
  722: 'Código Inmobiliario',
};

await runWithWorkspace(9, async () => {
  const db = await getTenantDb();
  const { data: proj } = await db.from('plan_proyectos').select('id,name,pid');
  const porNombre = new Map((proj ?? []).map((p: { id: string; name: string }) => [p.name.toLowerCase(), p.id]));
  const { data: tareas } = await db.from('plan_tareas').select('id,num,title,labels,historial').in('num', Object.keys(MOVER).map(Number));

  const idDe = new Map<string, string>();
  const nuevos: string[] = [];
  for (const cliente of [...new Set(Object.values(MOVER))]) {
    const nombre = `Cliente: ${cliente}`;
    const ya = porNombre.get(nombre.toLowerCase());
    if (ya) { idDe.set(cliente, ya); console.log(`· proyecto ya existe: ${nombre}`); continue; }
    if (!APLICAR) { idDe.set(cliente, `(nuevo) ${nombre}`); console.log(`+ crearía el proyecto: ${nombre}`); continue; }
    const p = await crearPlanProyecto({
      // 50 es el PLACEHOLDER de la casa (agregarTareasPlanOwner hace lo mismo), no una
      // prioridad: la pone el Perro en la línea de abajo. Un número puesto a mano acá es
      // exactamente lo que la regla prohíbe — y ya pasó: estos dos nacieron en 70.
      id: '', emoji: '🤝', name: nombre, color: '#7C5CFF', score: 50, detalle:
        `Todo lo que se hace PARA ${cliente} — su cuenta, su contenido, sus campañas y lo que se le entrega. No entra acá el producto: una feature que sale de una charla con ${cliente} igual la usan todos, y se archiva en su tab.`,
      historial: [{ id: 'h' + Date.now().toString(36), ts: Date.now(), actor: 'ia', text: 'Creó el proyecto — el trabajo de un cliente va a SU proyecto (regla del 2026-08-02)' }],
    });
    idDe.set(cliente, p.id);
    console.log(`+ proyecto creado: ${nombre} (${p.pid}) — sin prioridad todavía`);
    nuevos.push(p.id);
  }

  for (const t of tareas ?? []) {
    const cliente = MOVER[t.num as number];
    const destino = idDe.get(cliente)!;
    const antes = (t.labels ?? []).map((l: string) => (proj ?? []).find((p: { id: string }) => p.id === l)?.name ?? l).join(', ') || '(sin proyecto)';
    console.log(`#${t.num} ${antes} → Cliente: ${cliente}   «${String(t.title).slice(0, 52)}»`);
    if (!APLICAR) continue;
    const hist = [{ id: 'h' + Date.now().toString(36) + t.num, ts: Date.now(), actor: 'ia', text: `Movida a «Cliente: ${cliente}» — salió de la llamada con ${cliente} y es trabajo para él (antes: ${antes})` }, ...(t.historial ?? [])].slice(0, 40);
    const { error } = await db.from('plan_tareas').update({ labels: [destino], historial: hist, updated_at: new Date().toISOString() }).eq('id', t.id);
    if (error) console.error(`   ✖ ${error.message}`);
  }
});
console.log(APLICAR ? '\n✓ aplicado' : '\n(ensayo — agregá --aplicar)');
