// =============================================================================
// reordenar-boards-clientes — poner los tableros de los clientes en el catálogo
// =============================================================================
// Los tableros de Mauricio (ws1) y Leila (ws11) quedaron con la ontología vieja: los
// proyectos del seed (iniciativas finitas: «Encontrar el primer anuncio ganador») y
// los que el dueño creó a mano para cada cliente, sin el prefijo que el código
// espera. Resultado medido: 0 de 15 y 0 de 8 proyectos están en el catálogo cerrado,
// y la guarda que impide que una tarea de nadie caiga en la cuenta de un cliente
// excluía 0 de 15 (arreglada aparte en lib/todo-rutear.ts).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reordenar-boards-clientes.ts [--ws=1,11] [--apply]
//
// Sin --apply SOLO IMPRIME. Antes de escribir deja backup completo en el setting
// `mako.backup.boards.<ws>` del propio workspace.
//
// LAS TRES GUARDAS (y por qué son distintas entre sí):
//  · BORRAR una tarea: nunca si progreso >= 100, nunca si hay historial de persona
//    con /edit|renombr|cambi/, nunca si tiene ítems de checklist tildados.
//  · BORRAR un proyecto: nunca si le quedan tareas DESPUÉS de mover (se re-cuenta).
//  · MOVER una tarea: se permite aunque tenga historial humano, SALVO que ese
//    historial sea una asignación de proyecto («Asignó a …»). Esa marca significa
//    que el dueño ya decidió dónde va, y una decisión escrita no se corrige por
//    script. Es el caso de #185 en ws1: está en tres proyectos a propósito, con el
//    motivo escrito («por que estaba en lugar incorrecto»).
//
// El objetivo principal del tablero es el proyecto de mayor `prioridad` con trabajo
// pendiente. Fundir proyectos puede MOVERLO sin que nadie lo pida, así que las áreas
// nuevas heredan la prioridad más alta de los proyectos que absorben, y la
// simulación imprime cuál era el norte antes y cuál queda después.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { listTareas, listCategorias, crearCategoria, editarCategoria, editarTarea, borrarCategoria, type Tarea, type Categoria } from '../lib/todo';
import { setSetting } from '../lib/settings';
import { CATALOGO_TODO, delCatalogoTodo, PREFIJO_CLIENTE } from '../lib/todo-proyectos-catalogo';

const APLICAR = process.argv.includes('--apply');
const argWs = process.argv.find((a) => a.startsWith('--ws='));
const WSS = (argWs ? argWs.slice(5).split(',') : ['1', '11']).map(Number).filter(Boolean);

const hoy = () => new Date().toISOString();
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9);

// ── ws1 (Mauricio) ───────────────────────────────────────────────────────────
// Los seis proyectos que SON un cliente. Renombrar (no recrear) conserva id,
// historial, score y las tareas que cuelgan; y `esElProyectoDe` matchea por
// palabras, así que el lead del CRM se sigue reconociendo después del renombre.
const RENOMBRES_WS1: Record<string, string> = {
  'Cuenta Grupo Esquer': 'Cliente: Grupo Esquer',
  'Cliente Baja Teriyaki': 'Cliente: Baja Teriyaki',
  'Cuenta Vértice Industrial': 'Cliente: Vértice Industrial',
  'Cliente Aspro': 'Cliente: Aspro',
  'Cuenta TEXX': 'Cliente: TEXX',
  'Macario Romero — HMO Congelados': 'Cliente: Macario Romero — HMO',
};

// Tarea → área del catálogo. Las bolsas del seed se reparten UNA POR UNA: mandarlas
// enteras a un lado repetiría el error que las juntó.
const DESTINO_WS1: Record<number, string> = {
  39: 'Equipo y procesos', 40: 'Equipo y procesos', 41: 'Equipo y procesos',
  42: 'Equipo y procesos', 43: 'Equipo y procesos', 44: 'Equipo y procesos',
  189: 'Equipo y procesos', 190: 'Equipo y procesos', 192: 'Equipo y procesos',
  194: 'Entrega y clientes', 195: 'Entrega y clientes',
  69: 'Landing y web', 70: 'Landing y web',
  181: 'Anuncios', 182: 'Anuncios', 183: 'Anuncios', 193: 'Anuncios', 191: 'Anuncios',
  186: 'Oferta y precios', 188: 'Oferta y precios',
  187: 'Entrega y clientes',
  184: 'Mensajes de seguimiento',
  73: 'Números y reportes',
};
// #185 NO está en el mapa a propósito: su ubicación es una decisión escrita del dueño.

// ── ws11 (Leila) ─────────────────────────────────────────────────────────────
const DESTINO_WS11: Record<number, string> = {
  // Las 19 de su reunión, hoy todas apiladas en «Setup inicial de MaKo».
  152: 'Mensajes de seguimiento', 155: 'Mensajes de seguimiento', 156: 'Mensajes de seguimiento',
  160: 'Mensajes de seguimiento', 161: 'Mensajes de seguimiento', 162: 'Mensajes de seguimiento',
  167: 'Mensajes de seguimiento',
  153: 'Landing y web', 154: 'Landing y web', 166: 'Landing y web',
  157: 'Contenido orgánico', 168: 'Contenido orgánico', 169: 'Contenido orgánico',
  163: 'Oferta y precios', 164: 'Oferta y precios',
  158: 'Equipo y procesos', 165: 'Equipo y procesos', 159: 'Equipo y procesos',
  170: 'Anuncios',
  // Las del seed.
  115: 'Equipo y procesos', 117: 'Equipo y procesos', 118: 'Equipo y procesos',
  119: 'Equipo y procesos', 120: 'Equipo y procesos',
  121: 'Anuncios', 122: 'Anuncios', 123: 'Anuncios', 124: 'Anuncios', 125: 'Anuncios',
  126: 'Oferta y precios',
  127: 'Llamadas y cierre', 128: 'Llamadas y cierre', 129: 'Llamadas y cierre', 130: 'Llamadas y cierre',
  131: 'Números y reportes', 132: 'Números y reportes', 133: 'Números y reportes',
  134: 'Números y reportes', 135: 'Números y reportes',
  136: 'Mensajes de seguimiento', 137: 'Mensajes de seguimiento',
  138: 'Mensajes de seguimiento', 139: 'Mensajes de seguimiento',
  145: 'Landing y web', 146: 'Landing y web',
  147: 'Contenido orgánico', 148: 'Contenido orgánico',
  149: 'Números y reportes', 150: 'Números y reportes', 151: 'Números y reportes',
  269: 'Entrega y clientes',
};
// El proyecto «Escalar la campaña ganadora» pide fase 3 y Leila está en fase 1: su
// propia fase le dice que todavía no escale. Se poda con sus 5 tareas, re-verificando
// en el momento que sigan en 0%, sin tildar y sin historial de persona.
const PODA_WS11 = { proyecto: 'Escalar la campaña ganadora', tareas: [140, 141, 142, 143, 144] };

// ── guardas ──────────────────────────────────────────────────────────────────
const tocadaPorPersona = (t: Tarea): boolean =>
  (t.historial ?? []).some((h) => h.actor === 'user' && /edit|renombr|cambi/i.test(h.text ?? ''));
/** El dueño ya decidió a mano dónde va: no se mueve. */
const asignadaAMano = (t: Tarea): boolean =>
  (t.historial ?? []).some((h) => h.actor === 'user' && /^asign/i.test((h.text ?? '').trim()));
const conTildes = (t: Tarea): boolean => (t.checklist ?? []).some((c) => c.done);

function norte(cats: Categoria[], tareas: Tarea[]): string {
  const abiertasDe = (id: number) => tareas.filter((t) => t.categorias.includes(id) && t.progreso < 100).length;
  const vivos = cats.filter((c) => abiertasDe(c.id) > 0).sort((a, b) => b.prioridad - a.prioridad);
  return vivos.length ? `${vivos[0].nombre} (prioridad ${vivos[0].prioridad})` : '(ninguno)';
}

async function correr(ws: number) {
  const DESTINO = ws === 1 ? DESTINO_WS1 : DESTINO_WS11;
  const RENOMBRES = ws === 1 ? RENOMBRES_WS1 : {};
  const [tareas, cats] = await Promise.all([listTareas(), listCategorias()]);
  const porNombre = new Map(cats.map((c) => [c.nombre, c]));
  const porId = new Map(cats.map((c) => [c.id, c]));

  console.log(`\n${'='.repeat(72)}\nws ${ws} — ${cats.length} proyectos · ${tareas.length} tareas (${tareas.filter((t) => t.progreso < 100).length} abiertas)`);
  console.log(`NORTE ACTUAL: ${norte(cats, tareas)}`);

  if (APLICAR) {
    await setSetting(`mako.backup.boards.${ws}`, JSON.stringify({ ts: hoy(), cats, tareas }));
    console.log('✓ backup guardado en mako.backup.boards.' + ws);
  }

  // 1) RENOMBRAR los proyectos de cliente al prefijo canónico ------------------
  for (const [viejo, nuevo] of Object.entries(RENOMBRES)) {
    const c = porNombre.get(viejo);
    if (!c) { console.log(`  · renombrar «${viejo}» → no existe, salteado`); continue; }
    console.log(`  RENOMBRAR  «${viejo}» → «${nuevo}»`);
    if (APLICAR) {
      await editarCategoria(c.id, {
        nombre: nuevo,
        historial: [...(c.historial ?? []), { id: uid('h'), ts: Date.now(), actor: 'ia', text: `MaKo lo renombró de «${viejo}» para que el sistema lo reconozca como un cliente y no le meta tareas de otros.` }],
      });
    }
    // También en simulación: si no, el paso de limpieza no reconoce a «Cliente: Aspro»
    // como un cliente y anuncia que lo va a borrar por estar vacío.
    c.nombre = nuevo; porNombre.delete(viejo); porNombre.set(nuevo, c);
  }

  // 2) MOVER las tareas a su área --------------------------------------------
  // La prioridad de cada área se hereda: la más alta de los proyectos que absorbe.
  // La prioridad del área la marca el proyecto que MÁS tareas le aporta, no el
  // máximo de todos: con el máximo, una bolsa grande de prioridad alta («Setup
  // inicial») le contagiaba su número a las siete áreas de golpe y el tablero
  // quedaba plano — sin pirámide no hay norte.
  const aportes = new Map<string, Map<number, number>>();
  const movimientos: Array<{ t: Tarea; area: string }> = [];
  const bloqueadas: Tarea[] = [];
  for (const t of tareas) {
    const area = DESTINO[t.id];
    if (!area) continue;
    if (asignadaAMano(t)) { bloqueadas.push(t); continue; }
    movimientos.push({ t, area });
    const m = aportes.get(area) ?? new Map<number, number>();
    for (const cid of t.categorias) m.set(cid, (m.get(cid) ?? 0) + 1);
    aportes.set(area, m);
  }
  const prioridadDeseada = new Map<string, number>();
  for (const [area, m] of aportes) {
    const dom = [...m.entries()].sort((a, b) => (b[1] - a[1]) || ((porId.get(b[0])?.prioridad ?? 0) - (porId.get(a[0])?.prioridad ?? 0)))[0];
    prioridadDeseada.set(area, dom ? (porId.get(dom[0])?.prioridad ?? 50) : 50);
  }
  console.log(`\n  MOVER: ${movimientos.length} tareas · BLOQUEADAS por decisión escrita: ${bloqueadas.length}`);
  for (const t of bloqueadas) console.log(`   ⛔ #${t.id} ${t.titulo.slice(0, 55)} — el dueño la asignó a mano`);

  // Crear las áreas que falten, con la prioridad heredada.
  const areas = [...new Set(movimientos.map((m) => m.area))];
  for (const nom of areas) {
    if (porNombre.has(nom)) {
      const c = porNombre.get(nom)!;
      const p = prioridadDeseada.get(nom) ?? 0;
      if (p > c.prioridad) {
        console.log(`  SUBIR prioridad de «${nom}»: ${c.prioridad} → ${p}`);
        if (APLICAR) { await editarCategoria(c.id, { prioridad: p }); c.prioridad = p; }
      }
      continue;
    }
    const def = delCatalogoTodo(nom) ?? CATALOGO_TODO[0];
    const p = prioridadDeseada.get(nom) ?? 50;
    console.log(`  CREAR área «${nom}» (prioridad ${p})`);
    if (!APLICAR) { porNombre.set(nom, { id: -areas.indexOf(nom) - 1, nombre: nom, prioridad: p } as Categoria); continue; }
    const c = await crearCategoria(nom, def.color, def.emoji, p, def.que, [{ id: uid('h'), ts: Date.now(), actor: 'ia', text: 'MaKo lo creó al ordenar el tablero: es un área del negocio, no una tarea grande.' }]);
    porNombre.set(nom, c); porId.set(c.id, c);
  }

  for (const { t, area } of movimientos) {
    const destino = porNombre.get(area)!;
    if (t.categorias.length === 1 && t.categorias[0] === destino.id) continue;
    const antes = t.categorias.map((id) => porId.get(id)?.nombre ?? `#${id}`).join(', ') || '(sin proyecto)';
    console.log(`   #${t.id} ${t.titulo.slice(0, 48).padEnd(50)} ${antes} → ${area}`);
    if (!APLICAR) continue;
    await editarTarea(t.id, {
      categorias: [destino.id],
      historial: [...(t.historial ?? []), { id: uid('h'), ts: Date.now(), actor: 'ia', text: `MaKo la movió de «${antes}» a «${area}» al ordenar el tablero por áreas del negocio.` }],
    });
    t.categorias = [destino.id];
  }

  // 3) PODA (solo ws11) -------------------------------------------------------
  if (ws === 11) {
    const c = porNombre.get(PODA_WS11.proyecto);
    if (c) {
      const suyas = tareas.filter((t) => PODA_WS11.tareas.includes(t.id));
      const podables = suyas.filter((t) => t.progreso === 0 && !tocadaPorPersona(t) && !conTildes(t));
      console.log(`\n  PODA «${PODA_WS11.proyecto}» (pide fase 3, ella está en fase 1): ${podables.length}/${suyas.length} podables`);
      for (const t of suyas) console.log(`   ${podables.includes(t) ? '✂' : '⛔'} #${t.id} ${t.titulo.slice(0, 55)} — ${t.progreso}%${conTildes(t) ? ' · con ítems tildados' : ''}${tocadaPorPersona(t) ? ' · editada a mano' : ''}`);
      if (APLICAR && podables.length === suyas.length) {
        const { borrarTarea } = await import('../lib/todo');
        for (const t of podables) await borrarTarea(t.id);
        await borrarCategoria(c.id);
        console.log('   ✓ podado');
      } else if (APLICAR) console.log('   ⛔ NO se poda: alguna tarea tiene trabajo encima');
    }
  }

  // 4) BORRAR los proyectos que quedaron vacíos -------------------------------
  const finales = APLICAR ? await listCategorias() : cats;
  const tareasFin = APLICAR ? await listTareas() : tareas;
  console.log('');
  for (const c of finales) {
    const n = tareasFin.filter((t) => t.categorias.includes(c.id)).length;
    if (n > 0) continue;
    if (delCatalogoTodo(c.nombre) || c.nombre.startsWith(PREFIJO_CLIENTE)) {
      console.log(`  · «${c.nombre}» quedó vacío pero se conserva (${delCatalogoTodo(c.nombre) ? 'es un área del catálogo' : 'es un cliente: la próxima reunión cae acá'})`);
      continue;
    }
    console.log(`  BORRAR proyecto vacío «${c.nombre}»`);
    if (APLICAR) await borrarCategoria(c.id);
  }

  const cf = APLICAR ? await listCategorias() : finales;
  const tf = APLICAR ? await listTareas() : tareasFin;
  console.log(`\n  QUEDA: ${cf.length} proyectos · ${tf.length} tareas`);
  console.log(`  NORTE ${APLICAR ? 'NUEVO' : 'QUE QUEDARÍA'}: ${norte(cf, tf)}`);
  const fuera = cf.filter((c) => !delCatalogoTodo(c.nombre) && !c.nombre.startsWith(PREFIJO_CLIENTE));
  console.log(`  fuera del catálogo: ${fuera.length ? fuera.map((c) => c.nombre).join(' · ') : '(ninguno) ✓'}`);
}

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===' : '=== SIMULACIÓN (sin --apply no se escribe nada) ===');
  for (const ws of WSS) await runWithWorkspace(ws, () => correr(ws));
}
main().catch((e) => { console.error(e); process.exit(1); });
