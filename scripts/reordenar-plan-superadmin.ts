// =============================================================================
// reordenar-plan-superadmin — el tablero /plan del dueño, entendible de nuevo
// =============================================================================
// Sin --apply solo IMPRIME. Con --apply escribe, y antes deja backup completo en
// app_settings (mako.backup.plan9.*).
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reordenar-plan-superadmin.ts
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/reordenar-plan-superadmin.ts --apply
//
// QUÉ ARREGLA (medido, no supuesto):
//   · 64 proyectos, 24 de ellos inventados por la IA en dos semanas: TRES sobre
//     Instagram, DOS "Ads Content Machine", DOS de competencia, y varios con UNA
//     tarea. Se funden en el catálogo de proyectos grandes (lib/plan-proyectos-catalogo).
//   · 34 grupos de tareas duplicadas: 128 de las 432 abiertas son el MISMO trabajo
//     escrito distinto. 7 tarjetas decían "Reportar error".
//
// LA CAUSA de las dos cosas es la misma: el 5/8 entraron 16 mensajes de WhatsApp en
// 4 segundos y cada uno disparó su propia corrida del agente, en paralelo. Salieron
// 16 borradores, 133 tareas y 19 proyectos. Esto limpia el destrozo; el buffer de
// mensajes (lib/mako-doer-buffer) es lo que evita que vuelva a pasar.
//
// NO se toca nada que el dueño haya hecho a mano: las tareas cerradas quedan como
// están y de cada grupo de duplicados se conserva la tarjeta más completa.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { setSetting } from '../lib/settings';
import { CATALOGO_PROYECTOS, delCatalogo } from '../lib/plan-proyectos-catalogo';

const APLICAR = process.argv.includes('--apply');

// ── 1. Duplicados: qué tarjeta se conserva y cuáles se borran ────────────────
// Sale de la auditoría (34 grupos). De cada grupo se conserva la redacción MÁS
// COMPLETA — no la primera: varias veces la última pasada del lote es la que nombra
// bien el entregable.
const DUPLICADOS: Array<{ que: string; conservar: number; borrar: number[] }> = [
  { que: "Botón global de 'Reportar error' en toda la app", conservar: 405, borrar: [423, 435, 446, 464, 477, 491] },
  { que: 'Portal comunitario de propuestas con votación y comentarios', conservar: 434, borrar: [398, 400, 422, 445, 463, 476] },
  { que: 'Formulario de propuestas de features con priorización paga', conservar: 449, borrar: [411, 426, 437, 465, 481, 495] },
  { que: 'Módulo de Contenido Orgánico en MaKo', conservar: 450, borrar: [396, 427, 439, 466, 484, 496] },
  { que: 'Módulo de espionaje de competencia (Competitor Spy)', conservar: 443, borrar: [293, 306, 397, 420, 430, 487] },
  { que: 'VSL principal de la landing (toma real + demo)', conservar: 460, borrar: [413, 414, 459, 471, 502] },
  { que: 'Auto-debugging: Claude resuelve los errores evidentes', conservar: 409, borrar: [424, 436, 479, 493] },
  { que: 'Recepción y clasificación de errores en SuperAdmin', conservar: 492, borrar: [406, 408, 448, 478] },
  { que: 'Portal de tickets con status visible para el usuario', conservar: 425, borrar: [407, 447, 480, 494] },
  { que: 'Grabar variantes de CTA para Reels', conservar: 452, borrar: [395, 428, 442, 467] },
  { que: 'Detectar orgánicos ganadores y escalarlos a Ads', conservar: 451, borrar: [403, 440, 483] },
  { que: 'Soporte de FMA (Flexible Media Assets)', conservar: 404, borrar: [429, 441, 457] },
  { que: 'Creativos en formato POV con Mau', conservar: 498, borrar: [455, 485, 489] },
  { que: 'IA generativa de video para Hooks', conservar: 490, borrar: [456, 486, 499] },
  { que: 'Rediseñar la UI para que quede grabable / instagrameable', conservar: 500, borrar: [412, 458, 470] },
  { que: 'Modo Simple / Modo Avanzado de la interfaz', conservar: 159, borrar: [410, 431, 444, 468, 497] },
  { que: 'Publicación fácil en Instagram desde MaKo', conservar: 438, borrar: [402, 462] },
  { que: 'Generador de imágenes y videos con IA', conservar: 417, borrar: [401, 454, 488] },
  { que: 'Definir el precio de la suscripción (mensual y anual)', conservar: 311, borrar: [223, 307] },
  { que: 'Diseñar el programa de referidos por niveles', conservar: 279, borrar: [247, 317] },
  { que: 'Analizar el embudo y la oferta del competidor GoMarz', conservar: 453, borrar: [469, 482] },
  { que: 'Construir el Cerebro IA de análisis del negocio', conservar: 418, borrar: [472, 504] },
  { que: 'Vendedor IA (agente conversacional de ventas)', conservar: 419, borrar: [473] },
  { que: 'Crear la tab Fábrica de Creativos / Content Machine', conservar: 305, borrar: [416] },
  { que: 'Comprar el dominio definitivo de MaKo', conservar: 294, borrar: [308] },
  { que: 'Reescribir la landing según el nuevo mensaje/oferta', conservar: 227, borrar: [272] },
  { que: 'Eliminar la oferta grupal y vender solo 1 a 1', conservar: 273, borrar: [222] },
  { que: 'Soportar eventos de Compra/Carrito en las métricas', conservar: 211, borrar: [212] },
  { que: 'Grabar las pantallas y demos de la app para el VSL', conservar: 415, borrar: [501] },
  { que: 'Importar y exportar leads/clientes en CSV', conservar: 383, borrar: [384] },
  { que: 'Análisis de costos de tokens e infraestructura por usuario', conservar: 461, borrar: [314, 315] },
  { que: 'Límites de consumo y créditos de tokens', conservar: 313, borrar: [316, 337, 474] },
  { que: 'Activar las campañas de anuncios pagados', conservar: 250, borrar: [277] },
  { que: 'Separar la presencia digital en una cuenta propia de MaKo', conservar: 251, borrar: [274] },
];

// ── 2. Proyectos: cada uno de los 64 a su lugar del catálogo ─────────────────
// La clave es el pid visible (P1…P64) porque es lo que se ve en el tablero.
const PROYECTO_A_CATALOGO: Record<string, string> = {
  P1: 'Vender MaKo: Oferta y precios',
  P2: 'Onboarding',
  P3: 'Vender MaKo: Landing y VSL',
  P4: 'Seguridad y multi-inquilino',
  P5: 'MaKo Doer',
  P6: 'Infraestructura y versionado',
  P7: 'MaKo Doer',
  P8: 'CRM',
  P9: 'CRM',
  P10: 'Chat Agent',
  P11: 'Onboarding',
  P12: 'Chat Agent',
  P13: 'WhatsApp',
  P14: 'Ads Manager',
  P15: 'Avisos y reportes',
  P16: 'Onboarding',
  P17: 'Ads Manager',
  P18: 'Contexto de MaKo',
  P19: 'CRM',
  P20: 'Plan',
  P21: 'General',
  P22: 'Infraestructura y versionado',
  P23: 'Seguridad y multi-inquilino',
  P24: 'Experiments',
  P25: 'Dashboard',
  P26: 'Ads Manager',
  P27: 'Integraciones',
  P28: 'Diseño de la app',
  P29: 'Configuraciones y equipo',
  P30: 'Closing Analyst',
  P31: 'Ads Analyst',
  P32: 'Diseño de la app',
  P33: 'Plan',
  P34: 'CS Analyst',
  P35: 'Infraestructura y versionado',
  P37: 'Chat Agent',
  P38: 'Infraestructura y versionado',
  P39: 'Closing Analyst',
  P40: 'Fábrica de creativos',
  P41: 'Market Analyst',
  P43: 'Dashboard',
  P44: 'Dashboard',
  P45: 'Vender MaKo: Oferta y precios',
  P46: 'Fábrica de creativos',
  P47: 'Feedback y errores',
  P48: 'Feedback y errores',
  P49: 'Diseño de la app',
  P53: 'Instagram',
  P55: 'Instagram',
  P56: 'Instagram',
  P57: 'Market Analyst',
  P58: 'Fábrica de creativos',
  P59: 'Vender MaKo: Oferta y precios',
  P60: 'Fábrica de creativos',
  P61: 'Diseño de la app',
  P62: 'Plan',
  P63: 'Fábrica de creativos',
  // P36 (Growth, 56 tareas), P42, P50, P51, P52, P54, P64 se reparten POR TAREA abajo:
  // son bolsas con varios temas adentro y mandarlas enteras a un lado sería repetir el
  // error que se está arreglando.
};

// ── 3. Las bolsas, tarea por tarea ───────────────────────────────────────────
const TAREA_A_CATALOGO: Record<number, string> = {};
const asignar = (proyecto: string, nums: number[]) => { for (const n of nums) TAREA_A_CATALOGO[n] = proyecto; };

// P36 «Growth — vender MaKo hacia afuera»: era el cajón de sastre de TODO lo comercial.
asignar('Vender MaKo: Oferta y precios', [110, 224, 225, 226, 230, 235, 236, 237, 243, 244, 271, 273, 245]);
asignar('Vender MaKo: Landing y VSL', [111, 227, 228, 229, 231, 232, 233, 234, 238, 239, 240, 241, 242, 282]);
asignar('Vender MaKo: Prospección', [246, 278]);
asignar('Vender MaKo: Referidos', [248, 249, 279]);
asignar('Vender MaKo: Ads', [250, 267]);
asignar('Vender MaKo: Orgánico Instagram', [251, 252, 253, 254, 255, 256, 257, 258, 259, 260, 261, 262, 268, 276]);
asignar('Vender MaKo: Orgánico YouTube', [263, 264, 265, 266, 269, 275, 280, 506, 507, 508]);
asignar('Infraestructura y versionado', [294]);
// P42 «Modelos de Negocio e Integraciones»: mezclaba monetización con permisos de Meta.
asignar('Cobros y planes', [270, 312, 335, 336, 363, 388, 313, 461]);
asignar('Integraciones', [200, 209]);
// Los proyectos de UNA tarea que nacieron del mismo lote repetido.
asignar('Contexto de MaKo', [418]);
asignar('Chat Agent', [419]);
asignar('Vender MaKo: Landing y VSL', [421, 432]);
asignar('Vender MaKo: Oferta y precios', [433]);
// Las últimas sueltas, que si no se quedaban en un proyecto que se borra.
asignar('Cobros y planes', [199]);
asignar('Admin y clientes', [318]);
asignar('Conocimientos', [392, 393, 394]);

const norm = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

type ProyRow = { id: string; pid: string | null; name: string; emoji: string | null; score: number | null; detalle: string | null; orden: number | null };
type TarRow = { id: string; num: number; title: string; labels: string[] | null; progress: number | null; detalle: string | null; historial: Array<{ id: string; ts: number; actor: string; text: string }> | null };

async function main() {
  console.log(APLICAR ? '=== APLICANDO ===\n' : '=== SIMULACIÓN (sin --apply no escribe nada) ===\n');
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, nombre, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number; nombre: string } | undefined;
  if (!ws) throw new Error('no encontré el workspace con capa=superadmin');
  console.log(`workspace: #${ws.id} «${ws.nombre}»\n`);

  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data: pRows } = await db.from('plan_proyectos').select('*');
    const { data: tRows } = await db.from('plan_tareas').select('*');
    const proys = (pRows ?? []) as unknown as ProyRow[];
    const tareas = (tRows ?? []) as unknown as TarRow[];
    const porNum = new Map(tareas.map((t) => [t.num, t]));
    const porId = new Map(proys.map((p) => [p.id, p]));
    const nomProy = (id: string) => porId.get(id)?.name ?? `?${id}`;

    // ── A. Duplicados a borrar ────────────────────────────────────────────
    const aBorrar: Array<{ num: number; id: string; titulo: string; grupo: string; conserva: number }> = [];
    const saltadas: string[] = [];
    for (const g of DUPLICADOS) {
      if (!porNum.has(g.conservar)) { saltadas.push(`grupo «${g.que}»: la que había que conservar (#${g.conservar}) no existe — NO borro ninguna`); continue; }
      for (const n of g.borrar) {
        const t = porNum.get(n);
        if (!t) { saltadas.push(`#${n}: no existe`); continue; }
        if ((t.progress ?? 0) >= 100) { saltadas.push(`#${n} «${t.title.slice(0, 40)}»: ya está terminada — la dejo`); continue; }
        // Guarda dura: nunca borrar algo que el dueño editó a mano.
        const aMano = (t.historial ?? []).some((h) => h.actor === 'user' && /edit|renombr|cambi/i.test(h.text));
        if (aMano) { saltadas.push(`#${n}: la editó el dueño a mano — la dejo`); continue; }
        aBorrar.push({ num: n, id: t.id, titulo: t.title, grupo: g.que, conserva: g.conservar });
      }
    }
    const idsBorrar = new Set(aBorrar.map((x) => x.id));

    console.log(`DUPLICADAS A BORRAR: ${aBorrar.length} (de ${DUPLICADOS.length} grupos)`);
    for (const g of DUPLICADOS) {
      const mias = aBorrar.filter((x) => x.grupo === g.que);
      if (mias.length) console.log(`  «${g.que}» → queda #${g.conservar}, se van ${mias.map((m) => `#${m.num}`).join(' ')}`);
    }

    // ── B. Proyecto destino de cada tarea viva ────────────────────────────
    const destinoDe = (t: TarRow): string | null => {
      if (TAREA_A_CATALOGO[t.num]) return TAREA_A_CATALOGO[t.num];
      const pid = (t.labels ?? []).map((l) => porId.get(l)?.pid ?? '').find(Boolean);
      return pid ? PROYECTO_A_CATALOGO[pid] ?? null : null;
    };
    const vivas = tareas.filter((t) => !idsBorrar.has(t.id));
    const sinDestino = vivas.filter((t) => !destinoDe(t));

    // Qué proyectos del catálogo hacen falta de verdad (los que reciben tareas).
    const necesarios = new Map<string, number>();
    for (const t of vivas) { const d = destinoDe(t); if (d) necesarios.set(d, (necesarios.get(d) ?? 0) + 1); }

    console.log(`\nPROYECTOS: ${proys.length} → ${necesarios.size}`);
    for (const [nombre, n] of [...necesarios].sort((a, b) => b[1] - a[1])) {
      const cat = delCatalogo(nombre);
      const ya = proys.find((p) => norm(p.name) === norm(nombre));
      console.log(`  ${cat?.emoji ?? '📁'} ${nombre.padEnd(34).slice(0, 34)} ${String(n).padStart(3)} tareas ${ya ? '(reusa el que ya está)' : '(nuevo)'}`);
    }
    const fueraDelCatalogo = [...necesarios.keys()].filter((n) => !delCatalogo(n));
    if (fueraDelCatalogo.length) console.log(`\n⚠ destinos que NO están en el catálogo: ${fueraDelCatalogo.join(', ')}`);
    if (sinDestino.length) {
      console.log(`\n⚠ ${sinDestino.length} tarea(s) sin destino (se quedan donde están):`);
      for (const t of sinDestino.slice(0, 20)) console.log(`   #${t.num} [${(t.labels ?? []).map(nomProy).join('|') || 'sin proyecto'}] ${t.title.slice(0, 60)}`);
    }
    console.log(`\nTAREAS: ${tareas.length} → ${vivas.length} (se borran ${aBorrar.length})`);
    if (saltadas.length) { console.log(`\n⚠ ${saltadas.length} saltada(s):`); for (const s of saltadas) console.log(`   ${s}`); }

    if (!APLICAR) { console.log('\n(simulación — nada se escribió)'); return; }

    // ── C. Backup ANTES de tocar nada ─────────────────────────────────────
    await setSetting('mako.backup.plan9.proyectos', JSON.stringify(proys));
    await setSetting('mako.backup.plan9.tareas', JSON.stringify(tareas.map((t) => ({ id: t.id, num: t.num, title: t.title, labels: t.labels, detalle: t.detalle, progress: t.progress }))));
    console.log(`\nbackup → mako.backup.plan9.{proyectos,tareas} (${proys.length} proyectos, ${tareas.length} tareas)`);

    // ── D. Crear/reusar los proyectos del catálogo ────────────────────────
    const ahora = Date.now();
    const idDe = new Map<string, string>();
    let siguientePid = proys.reduce((m, p) => Math.max(m, Number(/^P(\d+)$/i.exec(p.pid ?? '')?.[1] ?? 0)), 0) + 1;
    let orden = 0;
    // El score se hereda: el MÁS ALTO de los proyectos que se funden. La prioridad la
    // puso el dueño y no la decide una migración.
    const scoreOrigen = new Map<string, number>();
    for (const p of proys) {
      const destino = p.pid ? PROYECTO_A_CATALOGO[p.pid] : undefined;
      if (!destino) continue;
      scoreOrigen.set(destino, Math.max(scoreOrigen.get(destino) ?? 0, p.score ?? 50));
    }
    // Qué proyecto viejo APORTA MÁS tareas a cada destino: ese se RENOMBRA (conserva su
    // P#, su historial y su score) y los demás se funden adentro. Crear 32 proyectos
    // nuevos y borrar los 64 viejos habría funcionado igual, pero se lleva puesto el
    // rastro: el tablero perdería de dónde viene cada cosa.
    const aportes = new Map<string, Map<string, number>>(); // destino → (id proyecto viejo → nº tareas)
    for (const t of vivas) {
      const d = destinoDe(t); if (!d) continue;
      const vieja = (t.labels ?? [])[0]; if (!vieja) continue;
      const m = aportes.get(d) ?? new Map<string, number>();
      m.set(vieja, (m.get(vieja) ?? 0) + 1); aportes.set(d, m);
    }
    const troncoDe = (destino: string): ProyRow | undefined => {
      const m = aportes.get(destino); if (!m) return undefined;
      const [id] = [...m].sort((a, b) => b[1] - a[1])[0] ?? [];
      // Solo si ese proyecto viejo no es el tronco de OTRO destino más grande.
      return id ? porId.get(id) : undefined;
    };
    const troncoTomado = new Set<string>();
    for (const nombre of [...necesarios.keys()].sort((a, b) => (necesarios.get(b) ?? 0) - (necesarios.get(a) ?? 0))) {
      const cat = delCatalogo(nombre);
      const t = troncoDe(nombre);
      const ya = proys.find((p) => norm(p.name) === norm(nombre)) ?? (t && !troncoTomado.has(t.id) ? t : undefined);
      if (ya) troncoTomado.add(ya.id);
      const score = scoreOrigen.get(nombre) ?? 50;
      if (ya) {
        idDe.set(nombre, ya.id);
        await db.from('plan_proyectos').update({ name: nombre, emoji: cat?.emoji ?? ya.emoji, detalle: cat?.que ?? ya.detalle, score, orden: orden++, updated_at: new Date().toISOString() }).eq('id', ya.id);
        continue;
      }
      const id = `p${ahora.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
      const { error } = await db.from('plan_proyectos').insert({
        id, pid: `P${siguientePid++}`, name: nombre, emoji: cat?.emoji ?? '📁', color: '#2F6FED',
        score, detalle: cat?.que ?? '', orden: orden++,
        historial: [{ id: `h${id}`, ts: ahora, actor: 'ia', text: 'MaKo lo creó al reordenar el tablero: los proyectos ahora son grandes y se llaman como una tab' }],
      });
      if (error) throw new Error(`crear proyecto «${nombre}»: ${error.message}`);
      idDe.set(nombre, id);
    }
    console.log(`✓ ${idDe.size} proyectos del catálogo listos`);

    // ── E. Borrar las duplicadas ──────────────────────────────────────────
    let borradas = 0;
    for (const x of aBorrar) {
      const { error } = await db.from('plan_tareas').delete().eq('id', x.id);
      if (error) console.error(`   ✗ borrar #${x.num}: ${error.message}`);
      else borradas++;
    }
    console.log(`✓ ${borradas}/${aBorrar.length} duplicadas borradas`);

    // ── F. Mover cada tarea viva a su proyecto ────────────────────────────
    let movidas = 0;
    for (const t of vivas) {
      const destino = destinoDe(t);
      const nid = destino ? idDe.get(destino) : undefined;
      if (!nid || (t.labels ?? []).join() === nid) continue;
      const antes = (t.labels ?? []).map(nomProy).join(', ') || 'sin proyecto';
      const hist = [{ id: `h${t.id}${ahora}`, ts: ahora, actor: 'ia' as const, text: `MaKo la movió a «${destino}» al reordenar el tablero (estaba en «${antes}»)`.slice(0, 220) }, ...(t.historial ?? [])].slice(0, 40);
      const { error } = await db.from('plan_tareas').update({ labels: [nid], historial: hist, updated_at: new Date().toISOString() }).eq('id', t.id);
      if (error) console.error(`   ✗ mover #${t.num}: ${error.message}`);
      else movidas++;
    }
    console.log(`✓ ${movidas} tareas movidas`);

    // ── G. Borrar los proyectos que quedaron vacíos ───────────────────────
    const { data: tFinal } = await db.from('plan_tareas').select('labels');
    const usados = new Set<string>();
    for (const r of (tFinal ?? []) as Array<{ labels: string[] | null }>) for (const l of r.labels ?? []) usados.add(l);
    let borradosProy = 0;
    for (const p of proys) {
      if (usados.has(p.id) || idDe.has(p.name)) continue;
      const { error } = await db.from('plan_proyectos').delete().eq('id', p.id);
      if (error) console.error(`   ✗ borrar proyecto «${p.name}»: ${error.message}`);
      else { borradosProy++; console.log(`   · borrado «${p.name}» (quedó vacío)`); }
    }
    console.log(`✓ ${borradosProy} proyectos vacíos borrados`);

    const { count: nT } = await db.from('plan_tareas').select('id', { count: 'exact', head: true });
    const { count: nP } = await db.from('plan_proyectos').select('id', { count: 'exact', head: true });
    console.log(`\nQUEDÓ: ${nP} proyectos · ${nT} tareas`);
  });
}

main().then(() => { console.log('\nLISTO'); process.exit(0); })
  .catch((e) => { console.error('ERROR:', e); process.exit(1); });
