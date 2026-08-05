// =============================================================================
// arreglar-ronda-agosto — lo que quedó mal en el tablero, y la arquitectura al plan
// =============================================================================
// Sin --apply solo IMPRIME.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/arreglar-ronda-agosto.ts
//   ... --apply
//
// TRES cosas, en este orden:
//
//  1. BORRAR los 4 duplicados que el wizard dijo que borraba y NO borró (el paso del
//     checkbox mandaba los ids pero el server los ignoraba). Son cuatro copias del
//     Modo Simple (#159) y una del video del onboarding (#206).
//
//  2. RE-PUNTUAR las 20 tareas del documento de rediseño (#516-#535), que entraron
//     TODAS con score 62 —el default de 'media'—, sin razón y sin fecha: el JSON del
//     Perro se cortó a la mitad (20 tareas contra un techo de 3000 tokens de salida) y
//     el fallo fue silencioso. El fix del techo ya está en lib/mako-guardian.ts.
//
//  3. AMPLIAR esas tareas con el documento «Arquitectura de Información + App Shell»
//     y con la RESPUESTA que Martín dejó al final. NO se crean tareas nuevas: es el
//     mismo trabajo, ahora decidido. La única cosa de verdad nueva (cada rol con su
//     propio Plan) va por una propuesta aparte, como manda la skill.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { ampliarTareasPlanOwner, priorizarNuevasOwner } from '../lib/plan-board';

const APLICAR = process.argv.includes('--apply');
const DOC = 'el documento «Arquitectura de Información + App Shell» (MaKo · Fase 1 · v1)';

/** Los 4 duplicados que el wizard no llegó a borrar. */
const BORRAR = [
  { id: 'tms1t3k1p6u8l8', num: 203, que: 'copia de #159 (Modo Simple/Avanzado)' },
  { id: 'tms9yy0ks5pu7m', num: 304, que: 'copia de #159' },
  { id: 'tms95nvcg2d8qa', num: 283, que: 'copia de #159 (restringir tabs es parte del Modo Simple)' },
  { id: 'tms9yy0ks22ouf', num: 297, que: 'copia de #206 (videos del onboarding)' },
];

/** Lo que el documento de arquitectura le AGREGA a cada tarea que ya existe. */
const AMPLIAR: Array<{ num: number; texto: string }> = [
  {
    num: 517,
    texto: `AMPLIACIÓN — ${DOC} ya cierra la arquitectura, con los nombres en inglés y cortos:
· FOCUS — ¿qué es lo más importante que debo hacer ahora? → General renovado, Objectives, actividad del Guardián.
· OPERATE — ¿qué tengo que ejecutar hoy? → CRM · WhatsApp · Email · Instagram · Plan · Ads Manager.
· ANALYZE — ¿qué está pasando y por qué? → Dashboard · Second Brain · Closing Analyst · Ads Analyst.
· CREATE — ¿qué quiero construir o automatizar? → Chat Agent · Content Machine · Writers · Landing Builder · VSL Builder · Competitor Spy.
· ADMIN — ¿cómo configuro el contexto y la cuenta? → Onboarding · Integrations · Settings · Profile.
Chat Agent vive en CREATE (se configura, se entrena y se despliega); la operación diaria de las conversaciones queda en OPERATE. Ads Manager es la herramienta de EJECUCIÓN y Ads Analyst la de COMPRENSIÓN.

Y ACÁ ESTÁ EL CAMBIO GRANDE, que es la respuesta de Martín al documento: SE VA EL GLOBAL HEADER. Textual: «Yo le quitaría la Global Header». Cada cosa que vivía ahí se muda:
· Context Selector → adentro de Second Brain: «justamente el second brain se alimenta de esa info que el usuario le carga de su negocio».
· Period → solo en las tabs que lo necesitan, no siempre presente.
· Ask MaKo → a la sidebar.
· Notificaciones → NO como tab: un contador que sube en Focus y en Operate, «ya que son los 2 únicos que notifican».
· Simple/Advanced → adentro de Configuraciones.
· AI Balance → adentro de Integraciones.
· Profile → REEMPLAZA a «Admin» en la sidebar, con el patrón que ya existe hoy: la foto, y al pasar el cursor el desplegable con sus tabs.

El shell de ADMINISTRACIÓN (Clients, Plan Agencia, MaKo WhatsApp, Guiones, Grafo, Integrations de plataforma, AI Models, Knowledge) queda separado visualmente del shell de cliente: no es prioridad de la Fase 1, pero la arquitectura no debe impedir que convivan limpio.
Reglas de descubrimiento: el estado activo usa contraste de superficie + indicador lateral + peso tipográfico (no solo el dorado); «si todo tiene badge, nada tiene badge»; y lo de uso diario nunca vive en un tercer nivel de menú.`,
  },
  {
    num: 522,
    texto: `AMPLIACIÓN — decisión tomada, y cambia dónde vive esto: el Context Selector NO va en un header global. Martín: «Context Selector debe vivir dentro de "Second Brain", ya que justamente el second brain se alimenta de esa info que el usuario le carga de su negocio».
O sea: elegir negocio / producto / oferta / funnel deja de ser un control de navegación y pasa a ser parte del cerebro que analiza. Lo que sigue en pie del planteo original: el usuario nunca tiene que analizar datos ni ejecutar una acción sin saber sobre qué contexto opera, y las métricas y las acciones tienen que saber leer de ahí.
Sigue PENDIENTE (y no hay que inventarlo): la herencia entre niveles, los permisos de agencias y el cambio rápido entre varios negocios.`,
  },
  {
    num: 525,
    texto: `AMPLIACIÓN — ${DOC} le da a Second Brain una forma concreta, y queda registrada como decisión de producto: se presenta con un GRAFO DE CONOCIMIENTO (inspiración Obsidian) que conecta señales, cuellos de botella, hipótesis, experimentos y resultados. Textual: «Es el elemento visual más diferencial del módulo y debe sentirse vivo y explorable, no como un informe largo de texto».
Además fija su lugar: Second Brain vive en ANALYZE y es una CAPA TRANSVERSAL, no un silo de informes — alimenta a Focus y a Experiments. En la Fase 1 solo se fija su ubicación y su rol; el diseño detallado del grafo es Fase 2 de ese módulo.
Descripción funcional estable, para que se entienda antes de aprender el nombre: «Second Brain · Analiza todo tu negocio, conecta las señales y encuentra qué mover».`,
  },
  {
    num: 520,
    texto: `AMPLIACIÓN — ${DOC} termina diciendo que ESTE es el bloque de trabajo que sigue a la arquitectura: «Gramática de interacción de MaKo + reglas formales de Simple / Advanced». Ahí se define, junto: los 9 estados (Detectó → Vigila), cómo se ve y se comporta cada uno, las reglas exactas de profundidad Simple vs Advanced, cómo se traducen Second Brain y Perro Guardián en la interfaz, y qué puede ejecutarse con y sin aprobación (a nivel de experiencia, no de código).
O sea: no es una tarea de "ponerle un ícono a cada estado" — es el contrato que hace que la IA se sienta la misma en las 20 tabs. Va inmediatamente después de la arquitectura y antes de tocar cualquier tab.`,
  },
  {
    num: 523,
    texto: `AMPLIACIÓN — en la arquitectura definitiva esta pantalla se llama FOCUS y es la primera de la sidebar. Su pregunta: «¿qué es lo más importante que debo hacer ahora?». Consume señales de Objectives, Plan, Second Brain, CRM y Ads para proponer LA acción prioritaria — por eso tiene que mostrar de cuál de esos módulos salió.
Y lo que agrega Martín sobre el modo simple cambia lo que Focus tiene que saber hacer: «si estás navegando en el modo simple, me imagino que la tab de FOCUS te dice "Ve a la Content Machine y crea 7 anuncios de..." y que te deje el enlace allí mismo». Es decir: la prioridad no es un texto, es una acción con su BOTÓN al lugar donde se hace.
Las notificaciones del Guardián se cuentan acá (y en Operate): son las dos únicas familias que notifican.`,
  },
  {
    num: 521,
    texto: `AMPLIACIÓN — ${DOC} fija las bases mobile que la Fase 1 ya no puede ignorar: una columna como layout base · navegación inferior o rail reducido con los destinos de MAYOR FRECUENCIA POR ROL (tres a cinco, no más) · filtros y acciones secundarias en sheets · page headers compactos · tablas que se TRANSFORMAN, no que se comprimen · objetivos táctiles cómodos.
La frase que resume el criterio: «El App Shell desktop no se diseña como algo que luego haya que "aplastar"».
Los candidatos claros a uso en movimiento, por si hay que elegir qué probar primero: Focus, los Chats y las acciones prioritarias.`,
  },
  {
    num: 533,
    texto: `AMPLIACIÓN — la respuesta de Martín al documento de arquitectura le mete tres mudanzas concretas a esta tarea, y las tres son de acá:
· El AI Balance deja de ser un elemento del header y vive DENTRO de Integraciones.
· El toggle Simple/Advanced deja de ser un elemento del header y vive DENTRO de Configuraciones.
· «Profile debe reemplazar "admin" en la sidebar, que sea como está hoy en día: es el típico perfil que tiene tu foto y al pasar el cursor te sale el desplegable con las tabs».
Con eso, el grupo administrativo deja de ser una familia más de la navegación y pasa a colgar del avatar, que es donde la gente ya lo busca.`,
  },
  {
    num: 518,
    texto: `AMPLIACIÓN — con el Global Header afuera, la regla del color pesa más todavía: el estado activo de la navegación NO puede depender del dorado. ${DOC} lo dice explícito: «El estado activo no depende solo del dorado. Usa contraste de superficie + indicador lateral + peso tipográfico».
Y los badges entran en la misma regla de significado único: «Badges representan obligación o novedad concreta. Si todo tiene badge, nada tiene badge».`,
  },
  {
    num: 516,
    texto: `AMPLIACIÓN — el orden de trabajo queda fijado por ${DOC}: primero la arquitectura y el App Shell, después la gramática de MaKo + las reglas de Simple/Advanced, y recién ahí las tabs. Esta biblioteca es lo que hace posible ese orden: sin primitives, cada tab vuelve a resolver localmente lo mismo.
Piezas del shell que el documento nombra y que hay que tener antes de tocar cualquier tab: AppShell · Sidebar por familias (con rail de iconos + tooltip al colapsar) · PageHeader (título, una línea de propósito, estado, filtros y UNA acción primaria) · Contextual Panel (detalle, evidencia o configuración rápida sin abandonar la lista; los flujos largos NO van acá, van a full-screen o modal).`,
  },
];

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe) ===\n');
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');
  console.log(`workspace: #${ws.id} «${ws.nombre}»\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data } = await db.from('plan_tareas').select('id, num, title, score, score_razon, deadline');
    const filas = (data ?? []) as Array<{ id: string; num: number; title: string; score: number; score_razon: string | null; deadline: string | null }>;
    const porNum = new Map(filas.map((t) => [t.num, t]));
    const porId = new Map(filas.map((t) => [t.id, t]));

    // ── 1. duplicados ──────────────────────────────────────────────────────
    console.log('BORRAR (duplicados que el wizard no borró):');
    const existen = BORRAR.filter((b) => porId.has(b.id));
    for (const b of BORRAR) console.log(`  ${porId.has(b.id) ? '·' : '⚠ ya no está:'} #${b.num} ${porId.get(b.id)?.title.slice(0, 50) ?? ''} — ${b.que}`);

    // ── 2. las que quedaron sin puntuar ────────────────────────────────────
    const delDoc = filas.filter((t) => t.num >= 516 && t.num <= 535);
    const sinPuntuar = delDoc.filter((t) => !t.score_razon);
    console.log(`\nRE-PUNTUAR: ${sinPuntuar.length} de ${delDoc.length} están sin razón (score de fábrica)`);

    // ── 3. ampliaciones ────────────────────────────────────────────────────
    console.log('\nAMPLIAR con el documento de arquitectura:');
    const items: Array<{ id: string; detalle: string }> = [];
    for (const a of AMPLIAR) {
      const t = porNum.get(a.num);
      if (!t) { console.log(`  ⚠ #${a.num}: no existe`); continue; }
      console.log(`  #${a.num} ${t.title.slice(0, 56)}  (+${a.texto.length} caracteres)`);
      items.push({ id: t.id, detalle: a.texto });
    }

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    for (const b of existen) {
      const { error } = await db.from('plan_tareas').delete().eq('id', b.id);
      console.log(error ? `  ✗ #${b.num}: ${error.message}` : `  ✓ #${b.num} borrada`);
    }

    const r = await ampliarTareasPlanOwner(items, { tipo: 'claude-code', etiqueta: 'Arquitectura de Información + App Shell' });
    console.log(`\n✓ ${r.n}/${items.length} tareas ampliadas`);

    // El Perro, de a 10 (con 20 el JSON se cortaba y quedaban todas en 62).
    const ids = sinPuntuar.map((t) => t.id);
    const contexto = 'Las 20 salen del documento de rediseño de producto (v1, 4/8/2026) y de su anexo de arquitectura. Son trabajo de DISEÑO y de plataforma: la Fase 1 (sistema global, App Shell, primitives, estados, color) BLOQUEA a la Fase 2 (cada tab), así que lo del sistema global desbloquea al resto. Nada de esto tiene fecha comprometida con un cliente todavía.';
    for (let i = 0; i < ids.length; i += 10) {
      const lote = ids.slice(i, i + 10);
      console.log(`\nPerro, tanda ${Math.floor(i / 10) + 1}: ${lote.length} tareas…`);
      const res = await priorizarNuevasOwner(lote, [], contexto).catch((e) => { console.error('  ✗', e instanceof Error ? e.message : String(e)); return null; });
      if (res) console.log(`  alta ${res.tareas.alta} · media ${res.tareas.media} · baja ${res.tareas.baja} · futuro ${res.tareas.futuro}${res.sinPuntuar ? ` · ⚠ ${res.sinPuntuar} SIN puntuar` : ''}`);
    }
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
