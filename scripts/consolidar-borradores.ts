// =============================================================================
// consolidar-borradores — juntar lo que quedó suelto en UN solo link
// =============================================================================
// Se fueron acumulando borradores míos sin cargar y el dueño terminó con varios links
// abiertos. Esto descarta los que YO dejé pendientes y arma uno solo con todo lo que
// quedaba adentro, más las tareas del auto-debug.
//
// NO toca los borradores de OTRAS sesiones ni los que ya se aplicaron: solo los que
// están en la lista de abajo, explícita.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/consolidar-borradores.ts [--apply]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { crearPropuesta, type PropuestaTarea } from '../lib/plan-propuesta';
import { getSupabaseServer } from '../lib/supabase';
import { APP_BASE_URL } from '../lib/app-url';

const APLICAR = process.argv.includes('--apply');
/** Los borradores MÍOS que quedaron pendientes. Explícito a propósito. */
const A_ABSORBER = ['propmsggy7osk6tfo'];

// ── Las tareas del auto-debug ────────────────────────────────────────────────
// Salen de la explicación que pidió Martín («¿cómo podrías saber solo las tareas de
// debug, clasificarlas y ejecutarlas? ¿necesito la PC prendida?»). El orden importa:
// el limitador va ANTES que el agente, porque un agente que arregla código solo,
// colgado de una puerta sin límite, es exactamente el riesgo que él nombró.
const AUTO_DEBUG: Array<{ titulo: string; proyecto: string; detalle: string }> = [
  {
    titulo: 'Guardar los errores de la app en vez de perderlos en el log',
    proyecto: 'Feedback y errores',
    detalle: `**Qué hay que hacer**
Una tabla donde caigan los errores que la app ya atrapa, con su contexto, en vez de morir en un \`console.error\` del log de Vercel.

**Por qué**
Es el primer eslabón de todo lo demás: MaKo no puede proponer arreglar un bug que no sabe que pasó. Hoy los errores se escriben al log y se pierden a los pocos días; nadie los mira y no se pueden contar. Sin este registro, las tareas de «Feedback y errores» las va a seguir escribiendo Martín a mano.

**Detalles concretos**
Tres fuentes, no una: (1) las excepciones que ya se atrapan en los route handlers y las libs; (2) lo que reporta el cliente desde la app; (3) —la más importante y la que más nos costó— las **fallas silenciosas**, que no tiran error. Los dos casos reales de esta semana: el Perro devolvía 12 tareas de un lote de 20 porque el JSON se cortaba, y la señal del funnel daba verde para todos los workspaces. Ninguno de los dos tiró una excepción. Para esos hace falta AFIRMAR («si pedí 20 y volvieron 12, eso es una falla») y registrar la afirmación rota.
Cada fila necesita: qué pasó, dónde (archivo/ruta), en qué workspace, cuántas veces, y si ya está resuelto. Sin el workspace no se puede saber si es de un cliente o de todos.

**Listo cuando**
Los errores de una semana se pueden listar y contar desde la app, y las tres fallas silenciosas conocidas (JSON cortado, señal global, credencial que no hidrata) dejan fila cuando ocurren.`,
  },
  {
    titulo: 'Límite de pedidos y tope de body en la puerta del agente',
    proyecto: 'Seguridad y multi-inquilino',
    detalle: `**Qué hay que hacer**
Ponerle límite de pedidos por minuto y tope de tamaño a \`/api/agente/*\` antes de que un agente automático empiece a usarla.

**Por qué**
Va ANTES que el auto-debug, no después. El riesgo que nombró Martín textual es «que entre un hacker y comience a mandar muchísimas cosas y rompa toda la app»; un agente que arregla código solo, colgado de una puerta sin límite, es ese riesgo con un robot atado. Hoy el repo tiene un limitador (\`lib/rate-limit.ts\`) usado en UNA sola ruta.

**Detalles concretos**
El contrato de seguridad correcto ya existe y hay que heredarlo tal cual: \`lib/agente-token.ts\` es un token por workspace, rotable, que solo puede **crear un borrador** — nunca escribir directo al tablero. El auto-debug tiene que quedar exactamente así de acotado.
Sumar: límite por token (no por IP), tope de body por ruta —ojo que \`next.config.ts\` sube el global a 20mb por los adjuntos de WhatsApp, así que va por ruta— y un log de cuántas veces se llamó cada token.

**Listo cuando**
Una ráfaga de 100 pedidos con el token del agente devuelve 429 antes del 20, un body de 5 MB se corta con 413, y queda registrado quién llamó y cuántas veces.`,
  },
  {
    titulo: 'Semáforo: qué puede arreglar MaKo solo y qué te tiene que preguntar',
    proyecto: 'Feedback y errores',
    detalle: `**Qué hay que hacer**
Escribir la regla —y después el código— que decide si un arreglo se aplica solo o espera confirmación.

**Por qué**
No puede depender de cuán seguro esté el modelo: eso ya se midió y dio 8 de 17. Tiene que ser ESTRUCTURAL, o sea decidible mirando qué toca el cambio, no qué opina la IA.

**Detalles concretos**
· **Verde (lo arregla y avisa):** el cambio está contenido en un archivo que tiene test, el test fallaba antes y pasa después, el typecheck pasa, y NO toca ninguna de las de la lista roja.
· **Amarillo (muestra el diff y espera):** el arreglo se entiende pero toca código compartido, o no hay test que lo pruebe.
· **Rojo (nunca solo):** migraciones, RLS y auth, \`runWithWorkspace\`/\`TENANT_TABLES\`, credenciales, cualquier escritura a Meta/WhatsApp/email, borrados, y **cambios de prompt** — que le cambian el comportamiento a todos los clientes de una.
La salida es SIEMPRE un PR, nunca un push a main. Ese contrato ya lo tiene el repo: el canal \`cerrar\` y \`/plan/revisar\` son literalmente «propongo, vos confirmás».

**Listo cuando**
La lista roja está escrita en AGENTS.md, el clasificador la aplica leyendo los archivos tocados por el diff, y un cambio que toca una migración sale amarillo aunque el test pase.`,
  },
  {
    titulo: 'Que Claude corra sin tu PC prendida (runner en la nube)',
    proyecto: 'Infraestructura y versionado',
    detalle: `**Qué hay que hacer**
Mover el paso que toca código de tu máquina a un runner de GitHub Actions, para que el auto-debug no dependa de tener la PC encendida.

**Por qué**
Es la respuesta concreta a «¿debo tener mi PC encendida todo el tiempo con Claude abierto?». Hoy sí, y esa es la única razón. Hay tres capas y hacen cosas distintas: la app en Vercel está siempre prendida pero no tiene el repo ni puede correr los tests —solo detecta y propone—; Claude Code en tu PC puede arreglar de verdad pero necesita la máquina; Claude Code en un runner tiene el mismo poder y no necesita nada tuyo.

**Detalles concretos**
El workflow clona el repo, corre Claude en modo headless con la tarea, y abre un PR. Nunca mergea. Se dispara por: una tarea del plan marcada como candidata, o un error nuevo en el registro (la otra tarea de este mismo lote).
Cuidados propios de este repo: el typecheck vive en \`.git/hooks/pre-push\`, que **no se versiona** — un runner nuevo no lo hereda, así que el workflow tiene que correr \`npm run typecheck\` explícito. Y cada push a main cuesta ~US$0.09 de build en Vercel: los PRs no deberían disparar deploy de producción.

**Listo cuando**
Una tarea marcada como candidata dispara el workflow, Claude abre un PR con el arreglo y el typecheck en verde, y todo eso pasa con tu computadora apagada.`,
  },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string };
  console.log(`${APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN ==='}  ws ${ws.id}\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_propuestas').select('id, estado, resumen, tareas').in('id', A_ABSORBER);
    const viejos = (data ?? []) as Array<{ id: string; estado: string; resumen: string; tareas: PropuestaTarea[] }>;

    const heredadas: PropuestaTarea[] = [];
    for (const p of viejos) {
      if (p.estado !== 'pendiente') { console.log(`  · ${p.id} está «${p.estado}» — no se toca`); continue; }
      console.log(`  ← ${p.id}: ${p.tareas.length} tareas · ${p.resumen.slice(0, 60)}`);
      heredadas.push(...p.tareas);
    }

    const tareas: PropuestaTarea[] = [...heredadas, ...AUTO_DEBUG];
    console.log(`\n  ${heredadas.length} heredadas + ${AUTO_DEBUG.length} del auto-debug = ${tareas.length} tareas`);
    for (const t of AUTO_DEBUG) console.log(`  + ${t.proyecto.padEnd(28)} ${t.titulo}`);

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    const id = await crearPropuesta({
      tareas,
      resumen: 'Todo lo que quedó sin cargar: las 2 de Claude/Deepseek + el auto-debug',
      origen: 'claude-code',
    });
    // Los viejos se descartan DESPUÉS de crear el nuevo: si algo falla, no se pierde nada.
    for (const p of viejos) {
      if (p.estado !== 'pendiente') continue;
      const { error } = await db.from('plan_propuestas').update({ estado: 'descartada' }).eq('id', p.id);
      console.log(error ? `  ✗ ${p.id}: ${error.message}` : `  ✓ ${p.id} descartado (sus tareas viajaron al nuevo)`);
    }
    console.log(`\n${APP_BASE_URL}/plan/revisar/${id}\n`);
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
