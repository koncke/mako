// Borrador de tareas nuevas (NO las inserta: las propone y el Perro hace lo suyo).
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/proponer-ronda-e.ts
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace } from '../lib/workspace';
import { crearPropuesta } from '../lib/plan-propuesta';
import { getSupabaseServer } from '../lib/supabase';
import { APP_BASE_URL } from '../lib/app-url';

const TAREAS = [
  {
    titulo: 'Dos cuentas de Claude en paralelo, sin que se pisen el código',
    proyecto: 'Infraestructura y versionado',
    detalle: `**Qué hay que hacer**
Poner a trabajar las dos cuentas Claude x20 (Mauricio y Martín) al mismo tiempo sobre este repo, sin que una cierre la sesión de la otra y sin que se pisen los archivos. Hoy se usa una sola y cuando se agota la cuota el trabajo se corta.

**Por qué**
El límite lo pone la cuota, no las ideas. Con las dos cuentas desfasadas hay procesamiento los 7 días: la de Mauricio resetea los miércoles a las 7:00, así que su ventana buena es miércoles a viernes; si la de Martín se mantiene en cero uso esos días y se estrena un sábado a la mañana, su ciclo queda fijado para el fin de semana y el lunes/martes.

**Detalles concretos**
El aislamiento se hace por variable de entorno: cada cuenta con su propio \`CLAUDE_CONFIG_DIR\` (\`~/.claude-cuenta1\` y \`~/.claude-cuenta2\`) envuelto en dos funciones de PowerShell (\`claude1\`, \`claude2\`) escritas en \`$PROFILE\`. Después se abre VS Code, se divide la terminal en dos y se corre una en cada lado, con \`/login\` una única vez por lado.
El riesgo real no es la sesión: es que las dos sesiones editen los mismos archivos. Avisarles por texto NO alcanza — no ven los cambios de la otra hasta guardar, y se pisan. Hacen falta dos barreras: (a) delimitar por ruta ("trabajá únicamente dentro de X"), y (b) una rama de git por cuenta, con merge manual del desarrollador.
Esto ya nos pasó en este repo esta semana: otra sesión estaba tocando \`lib/credenciales.ts\` mientras esta trabajaba, y los typechecks salían contaminados.

**Listo cuando**
Las dos funciones están en el \`$PROFILE\`, las dos sesiones corren a la vez sin desloguearse, y está escrito en algún lado qué carpeta le toca a cada una y cómo se hace el merge.`,
  },
  {
    titulo: 'Evaluar Deepseek para reemplazar lo que hoy hace Gemini',
    proyecto: 'Infraestructura y versionado',
    detalle: `**Qué hay que hacer**
Medir si Deepseek puede tomar el trabajo que hoy hace Gemini —el Perro que puntúa, el checklist-coach, el ruteo de proyectos, la lectura de documentos— más barato y sin perder calidad.

**Por qué**
Gemini está en casi todas las tareas de clasificación porque hoy es gratis o muy barato, pero ya nos mordió dos veces: cuando devuelve 503 la llamada cae a Claude Sonnet y el costo salta sin aviso, y el razonamiento de Sonnet come el mismo cupo de salida, así que además se corta el JSON y el lote se pierde entero. Tener una segunda opción barata deja de ser un ahorro y pasa a ser una red.

**Detalles concretos**
La app ya tiene el enganche: \`lib/model-registry.ts\` define un modelo por feature con override editable desde /modelos-ia, y \`lib/ai-cheap.ts\` tiene la cascada de proveedores baratos. Agregar un proveedor es sumar su entrada ahí, no reescribir nada.
La comparación tiene que ser contra las MISMAS tareas reales, no contra un benchmark: correr el Perro sobre un lote del tablero con Gemini y con Deepseek y comparar tres cosas — que el JSON salga entero, que la razón cite una tarea concreta con la que compara, y el precio por 1M de tokens de entrada y salida.
Ojo con dos cosas que ya sabemos: los modelos con "thinking" truncan si el techo de salida es corto (pasó con Gemini y con Sonnet), y el override guardado en \`mako.modelos\` GANA sobre el default del código, así que probar cambiando el código no prueba nada si hay un override puesto.

**Listo cuando**
Está el número de costo por feature comparado contra Gemini, corrido sobre un lote real, y la decisión escrita: cuáles features se mudan y cuáles no.`,
  },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  const id = await runWithWorkspace(ws.id, () => crearPropuesta({
    tareas: TAREAS,
    resumen: 'Dos cuentas de Claude en paralelo + evaluar Deepseek',
    origen: 'claude-code',
  }));
  console.log(`\n${APP_BASE_URL}/plan/revisar/${id}\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
