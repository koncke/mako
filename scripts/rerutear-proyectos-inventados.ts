// =============================================================================
// Limpiar los cinco proyectos que nacieron por el agujero del 11-12/8
// =============================================================================
// Cinco proyectos se crearon saltando al Perro: cuando el ruteador RECHAZABA la propuesta
// de proyecto nuevo, la tarea se quedaba sin destino y `plan-board` la mandaba a crear el
// nombre crudo que había escrito MaKo — justo el que se acababa de rechazar. El detalle
// completo está en docs/hallazgos-plan.md → «El "no" del Perro entraba por la puerta de
// atrás». El agujero ya está cerrado; esto limpia lo que dejó.
//
// LAS DECISIONES ESTÁN TOMADAS Y VAN ESCRITAS ACÁ, no se recalculan. El Perro ya ruteó
// las cinco tareas contra el catálogo cerrado, el dueño vio el resultado, aprobó tres y
// corrigió dos. Volver a llamarlo al aplicar sería re-litigar algo ya decidido y podría
// dar otra cosa — encima ahora que «Feature: Content Machine» está en el catálogo, la
// lista de destinos cambió. Cada fila dice QUIÉN la decidió, que es lo que hace que esto
// se pueda auditar dentro de seis meses.
//
// SEGURO DE CORRER DOS VECES: sin `--aplicar` no escribe nada. Y aplicado, cada paso
// chequea el estado actual antes de tocar — las tareas ya movidas se saltean y los
// proyectos ya borrados no existen.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rerutear-proyectos-inventados.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/rerutear-proyectos-inventados.ts --aplicar
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

const APLICAR = process.argv.includes('--aplicar');
const WS = 9; // el tablero del dueño (super admin)

type Mudanza = { num: number; a: string; quien: 'perro' | 'dueño'; porQue: string };

/**
 * A dónde va cada tarea de los cinco proyectos inventados.
 *
 * Las tres del Perro salieron de correr `asignarTareasAProyectos` con el catálogo cerrado
 * y SIN los cinco inventados en la lista de destinos. La más importante es #687: vuelve a
 * «Feature: Competitor Spy», que es adonde había ido su gemela #686 del mismo lote — el
 * caso exacto que motivó todo esto.
 *
 * Las dos del dueño son una corrección suya, en el acto: «la tarea de la HISTORIA personal
 * va dentro de la Content Machine… Lo mismo que la escalera de contenidos… ¿No es obvio?».
 * Tenía razón por una causa concreta: la capa de ESTRATEGIA del contenido no existía como
 * destino, así que el Perro eligió «Feature: Reels» para la escalera de contenidos porque
 * era lo más parecido que había. Ahora existe y el ruteo futuro ya tiene dónde mandarlas.
 */
const MUDANZAS: Mudanza[] = [
  { num: 687, a: 'Feature: Competitor Spy',      quien: 'perro', porQue: 'insights de un SaaS de la competencia' },
  { num: 683, a: 'Feature: Fábrica de creativos', quien: 'perro', porQue: 'el banco de ángulos vive en la fábrica' },
  { num: 679, a: 'Feature: Foco',                 quien: 'perro', porQue: 'capacidad operativa: qué se puede hacer esta semana' },
  { num: 678, a: 'Feature: Content Machine',      quien: 'dueño', porQue: 'la historia personal es materia prima de contenido' },
  { num: 677, a: 'Feature: Content Machine',      quien: 'dueño', porQue: 'la escalera de contenidos es la estrategia, no un formato' },
];

/**
 * El que se QUEDA. «Content Machine» lo inventó el modelo el 11/8 y estaba mal; el 12/8 el
 * dueño decidió que la capa de estrategia sí hacía falta y la sumó al catálogo. Así que en
 * vez de borrarlo se ADOPTA: se le pone la descripción del catálogo (la que tiene hoy la
 * escribió la IA y habla de una sola tarea) y su historial dice cómo pasó de accidente a
 * decisión. Renombrarlo o borrarlo y recrearlo perdería sus dos tareas y su historia.
 */
const ADOPTAR = 'Feature: Content Machine';

async function main() {
  const { runWithWorkspace, getTenantDb } = await import('../lib/workspace');
  const { delCatalogo, nucleo } = await import('../lib/plan-proyectos-catalogo');

  await runWithWorkspace(WS, async () => {
    const db = await getTenantDb();
    const { data: proyRows } = await db.from('plan_proyectos').select('id, pid, name, detalle, historial, orden');
    const { data: tareaRows } = await db.from('plan_tareas').select('id, num, title, labels, historial');
    type Proy = { id: string; pid: string; name: string; detalle: string; historial: unknown; orden: number };
    type Tarea = { id: string; num: number; title: string; labels: unknown; historial: unknown };
    const proyectos = (proyRows ?? []) as Proy[];
    const tareas = (tareaRows ?? []) as Tarea[];

    const porNucleo = new Map(proyectos.map((p) => [nucleo(p.name), p]));
    const porNum = new Map(tareas.map((t) => [t.num, t]));

    // ── 1. Los proyectos a borrar, detectados por LA FIRMA del agujero ──────────
    // «Creó el proyecto — <origen>» era la rama que corría sin catálogo ni aval del Perro,
    // y ya no existe en el código. Se buscan así y no por una lista escrita a mano, para
    // que caiga también cualquier otro que haya quedado de antes.
    const conFirma = proyectos.filter((p) => {
      if (delCatalogo(p.name)) return false; // adoptado o del catálogo: no se toca
      const h = (p.historial ?? []) as Array<{ text?: string }>;
      return h.some((x) => /^Creó el proyecto — /.test(String(x.text ?? '')));
    });

    console.log('\n═══ PROYECTOS SIN AVAL (la firma «Creó el proyecto — …») ═══');
    if (!conFirma.length) console.log('  (ninguno: ya se limpiaron)');
    for (const p of conFirma) {
      const n = tareas.filter((t) => (t.labels as string[] ?? []).includes(p.id)).length;
      console.log(`  ${p.pid.padEnd(5)} ${p.name.padEnd(34)} ${n} tarea(s)`);
    }

    // ── 2. Las mudanzas ─────────────────────────────────────────────────────────
    console.log('\n═══ MUDANZAS ═══');
    const plan: Array<{ t: Tarea; destino: Proy | { crear: string }; m: Mudanza }> = [];
    for (const m of MUDANZAS) {
      const t = porNum.get(m.num);
      if (!t) { console.log(`  #${m.num} — NO EXISTE, se saltea`); continue; }
      const dest = porNucleo.get(nucleo(m.a));
      const labels = (t.labels as string[]) ?? [];
      // Ya está: UNA etiqueta y es la del destino. Con `labels.includes(dest.id)` a secas,
      // la tarea que quedó con dos etiquetas se leía como «ya está» y el bug sobrevivía a
      // la corrida siguiente — que es justo cuando uno lo quiere ver.
      if (dest && labels.length === 1 && labels[0] === dest.id) {
        console.log(`  #${m.num} ${t.title.slice(0, 46).padEnd(48)} ya está en ${m.a}`);
        continue;
      }
      if (!dest && !delCatalogo(m.a)) { console.log(`  #${m.num} — «${m.a}» no existe ni está en el catálogo. ABORTO.`); process.exit(1); }
      console.log(`  #${m.num} ${t.title.slice(0, 46).padEnd(48)} → ${m.a}${dest ? '' : '  (se crea del catálogo)'}   [${m.quien}]`);
      plan.push({ t, destino: dest ?? { crear: m.a }, m });
    }

    // ── 3. La adopción ──────────────────────────────────────────────────────────
    const adoptado = porNucleo.get(nucleo(ADOPTAR));
    const cat = delCatalogo(ADOPTAR);
    const hayQueAdoptar = !!adoptado && !!cat && adoptado.detalle !== cat.que;
    console.log('\n═══ ADOPCIÓN ═══');
    console.log(hayQueAdoptar
      ? `  ${adoptado!.pid} «${adoptado!.name}» se queda: entra al catálogo con su descripción real.`
      : `  (nada: «${ADOPTAR}» ${adoptado ? 'ya está al día' : 'no existe en el tablero'})`);

    // ── 4. Los borrados ─────────────────────────────────────────────────────────
    // Un proyecto solo se borra si queda VACÍO después de las mudanzas. Si le queda una
    // tarea que nadie mudó, se conserva: esa tarea desaparecería de la vista por proyecto.
    const mudadas = new Set(plan.map((x) => x.t.id));
    const aBorrar = conFirma.filter((p) => {
      const quedan = tareas.filter((t) => ((t.labels as string[]) ?? []).includes(p.id) && !mudadas.has(t.id));
      if (quedan.length) console.log(`\n  ⚠ ${p.name}: NO se borra, le quedan ${quedan.length} tarea(s) sin mudar (#${quedan.map((t) => t.num).join(', #')})`);
      return quedan.length === 0;
    });
    console.log('\n═══ SE BORRAN ═══');
    console.log(aBorrar.length ? aBorrar.map((p) => `  ${p.pid} ${p.name}`).join('\n') : '  (ninguno)');

    if (!APLICAR) { console.log('\n(dry run — con --aplicar se ejecuta)\n'); return; }
    console.log('\n═══ APLICANDO ═══');
    const ahora = Date.now();
    const hid = (s: string) => `h${ahora}${s}`;

    // Crear los destinos que falten, desde el catálogo (la única fuente que puede crear).
    let siguientePid = Math.max(0, ...proyectos.map((p) => Number(p.pid.replace(/^P/, '')) || 0)) + 1;
    for (const x of plan) {
      if (!('crear' in x.destino)) continue;
      const c = delCatalogo(x.destino.crear)!;
      const nid = `p${ahora.toString(36)}${siguientePid}`;
      const fila = {
        id: nid, workspace_id: String(WS), pid: `P${siguientePid++}`, emoji: c.emoji, name: c.nombre,
        color: '#2F6FED', score: 50, detalle: c.que, orden: proyectos.length + siguientePid,
        historial: [{ id: hid(nid), ts: ahora, actor: 'ia', text: 'Creó el proyecto (está en el catálogo) — limpieza de los proyectos inventados del 11-12/8' }],
      };
      const { error } = await db.from('plan_proyectos').insert(fila);
      if (error) { console.error(`  ✗ crear «${c.nombre}»: ${error.message}`); process.exit(1); }
      console.log(`  ✓ creado ${c.nombre}`);
      const nuevo = { ...fila, orden: fila.orden } as unknown as Proy;
      porNucleo.set(nucleo(c.nombre), nuevo);
      for (const y of plan) if ('crear' in y.destino && nucleo(y.destino.crear) === nucleo(c.nombre)) y.destino = nuevo;
    }

    for (const x of plan) {
      const dest = x.destino as Proy;
      // El destino REEMPLAZA, no se suma. La primera versión filtraba solo los proyectos
      // con la firma y le agregaba el destino: #683 salía de «Content Machine» —que se
      // adopta y por lo tanto NO tiene la firma— así que se quedó con las dos etiquetas y
      // apareció en los dos proyectos a la vez. En este tablero una tarea tiene 0 o 1
      // proyecto (`labels: projId ? [projId] : []` en plan-board), así que mudarse es
      // reemplazar. Filtrar «lo que sobra» obliga a acertar la lista de lo que sobra;
      // reemplazar no depende de eso.
      const labels = [dest.id];
      const quien = x.m.quien === 'dueño' ? 'Martín la mandó acá' : 'El Perro la re-ruteó acá';
      const hist = [
        { id: hid(String(x.t.num)), ts: ahora, actor: 'ia',
          text: `${quien}: ${x.m.porQue}. Estaba en un proyecto que se creó sin aval (bug del 11-12/8).`.slice(0, 300) },
        ...((x.t.historial ?? []) as unknown[]),
      ].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({ labels, historial: hist, updated_at: new Date().toISOString() }).eq('id', x.t.id);
      console.log(error ? `  ✗ #${x.t.num}: ${error.message}` : `  ✓ #${x.t.num} → ${dest.name}`);
    }

    if (hayQueAdoptar) {
      const hist = [
        { id: hid('adopt'), ts: ahora, actor: 'ia',
          text: 'Martín lo sumó al catálogo (12/8): la capa de ESTRATEGIA del contenido —la escalera, los pilares, la materia prima— no tenía destino y caía por parecido en los formatos. Nació de un bug y quedó por decisión.' },
        ...((adoptado!.historial ?? []) as unknown[]),
      ].slice(0, 40);
      const { error } = await db.from('plan_proyectos')
        .update({ emoji: cat!.emoji, detalle: cat!.que, historial: hist, updated_at: new Date().toISOString() })
        .eq('id', adoptado!.id);
      console.log(error ? `  ✗ adoptar: ${error.message}` : `  ✓ adoptado ${adoptado!.name}`);
    }

    for (const p of aBorrar) {
      const { error } = await db.from('plan_proyectos').delete().eq('id', p.id);
      console.log(error ? `  ✗ borrar ${p.name}: ${error.message}` : `  ✓ borrado ${p.name}`);
    }
    console.log('');
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
