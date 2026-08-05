// =============================================================================
// probar-ruteo-lotes — que el Perro abra proyecto cuando falta, y NO cuando no
// =============================================================================
// Read-only: NO escribe nada. Dos lotes reales, corridos N veces porque el ruteo es
// estocástico y una sola pasada no dice nada.
//   A) Feature nueva (Mindset) → tiene que abrir UN proyecto con las 3 juntas.
//   B) Regresión legal → tiene que ir 5/5 a «Legal y fiscal» y NO abrir ninguno.
// El lote B es el que importa: es la red que evita volver al tablero de 64 proyectos.
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probar-ruteo-lotes.ts [--n=3]
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });
import { runWithWorkspace, getTenantDb } from '../lib/workspace';
import { asignarTareasAProyectos } from '../lib/mako-guardian';
import { CATALOGO_PROYECTOS, delCatalogo } from '../lib/plan-proyectos-catalogo';
import { getSupabaseServer } from '../lib/supabase';

const a = process.argv.find((x) => x.startsWith('--n='));
const N = a ? Number(a.slice(4)) || 3 : 3;

const LOTE_A = [
  { titulo: 'Diseñar módulo de Diagnóstico de Mindset (Test LOT-R)', grupo: 'Feature Mindset en MaKo', detalle: 'Un test de mindset dentro de MaKo que clasifique al dueño entre optimista extremo, moderado y pesimista, y que el resultado alimente cómo le habla MaKo.' },
  { titulo: 'Crear matriz de impacto Mindset vs Negocio', grupo: 'Feature Mindset en MaKo', detalle: 'Cruzar el resultado del diagnóstico de mindset con la fase del negocio para saber si lo que frena es la cabeza o el sistema.' },
  { titulo: 'Armar herramientas prácticas de Mindset en la app', grupo: 'Feature Mindset en MaKo', detalle: 'El calendario de la vida y los ejercicios, adentro de la app, enganchados al diagnóstico.' },
];
const LOTE_B = [
  { titulo: 'Redactar e integrar Términos de Servicio y Política de Privacidad', grupo: 'Legal y Términos de Servicio', detalle: 'Los ToS de MaKo con las cláusulas de titularidad, licencia de uso y prohibición de ingeniería inversa.' },
  { titulo: 'Investigar estructura fiscal y apertura de LLC para cobrar', grupo: 'Estructura Fiscal y Legales MaKo', detalle: 'Qué estructura societaria conviene para facturarle a clientes de México desde Uruguay.' },
  { titulo: 'Investigar marco legal y exención de responsabilidad de la IA', grupo: 'Legal y Términos de Servicio', detalle: 'Hasta dónde responde MaKo por lo que recomienda su IA, y cómo se escribe esa exención.' },
  { titulo: 'Definir modelo contractual del programa de referidos', grupo: 'Estructura Fiscal y Legales MaKo', detalle: 'El contrato con los partners: comisiones, duración y cómo se factura.' },
  { titulo: 'Registrar la marca MaKo en México', grupo: 'Legal y Términos de Servicio', detalle: 'Búsqueda de antecedentes en el IMPI y presentación en las clases 9 y 42.' },
];

async function main() {
  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  await runWithWorkspace(ws.id, async () => {
    const db = await getTenantDb();
    const { data: pr } = await db.from('plan_proyectos').select('name, detalle');
    const yaEstan = new Set((pr ?? []).map((p) => String((p as { name: string }).name).toLowerCase()));
    const destinos = [
      ...(pr ?? []).map((p) => { const x = p as { name: string; detalle: string }; return { nombre: x.name, que: delCatalogo(x.name)?.que || x.detalle || '' }; }),
      ...CATALOGO_PROYECTOS.filter((c) => !yaEstan.has(c.nombre.toLowerCase())).map((c) => ({ nombre: c.nombre, que: c.que })),
    ];
    console.log(`${destinos.length} destinos · ${N} corridas por lote\n`);

    for (const [nom, lote, espera] of [['A · feature nueva (Mindset)', LOTE_A, 'abre 1 proyecto con las 3 juntas'], ['B · REGRESIÓN legal', LOTE_B, 'las 5 a «Legal y fiscal», sin abrir ninguno']] as const) {
      console.log(`── LOTE ${nom} — se espera: ${espera}`);
      let ok = 0;
      for (let i = 0; i < N; i++) {
        const r = await asignarTareasAProyectos(lote as Array<{ titulo: string; grupo?: string; detalle?: string }>, destinos, 'PRUEBA read-only');
        const destinosUsados = [...new Set(r.asign.map((x) => x.destino))];
        const nuevos = (r.nuevos ?? []).map((n) => n.nombre);
        const paso = lote === LOTE_A
          ? nuevos.length === 1 && destinosUsados.length === 1
          : nuevos.length === 0 && destinosUsados.length === 1 && destinosUsados[0] === 'Legal y fiscal';
        if (paso) ok++;
        console.log(`   ${paso ? '✓' : '✗'} corrida ${i + 1}: nuevos=[${nuevos.join(', ')}] destinos=[${destinosUsados.join(', ')}]`);
      }
      console.log(`   ${ok}/${N}\n`);
    }
  });
}
main().catch((e) => { console.error(e); process.exit(1); });
