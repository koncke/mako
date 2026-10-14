// =============================================================================
// «Si el lead contesta: se corta» → la CONDITION «No contestó desde que entró» (14/10/2026)
// =============================================================================
// Hasta el 14/10 una respuesta del lead cortaba todo lo que tenía por delante salvo el carril del recordatorio (una
// regla escondida del motor). Esa mañana pasó a ser una opción de cada flecha del CRON (`si_contesta` en el inicio:
// «sigue» / «se corta», y scripts/migrar-si-contesta.ts le escribió «se corta» a las de antes). Esa tarde, Martín:
// «"Si el lead contesta" NO debería ir en el CRON, debería ser una CONDITION... Es obvio eso». El motor ya no corta
// nada cuando el lead contesta; lo corta la condición `contesto` negada, que la persona ve en el lienzo.
//
// Este script deja a cada automatización haciendo LO MISMO que hacía, con la condición a la vista. En cada camino que
// decía «se corta», después de cada DELAY por tiempo (es donde un lead puede contestar antes de lo que sigue):
//   · si lo que sigue es una tarjeta, se le pone delante una condición «No contestó desde que entró»;
//   · si lo que sigue ya es una condición, se le suma esa fila con «y» a cada grupo de cada rama (dos condiciones
//     seguidas no se pueden guardar). Si esa condición tiene un «Si no» que lleva a algo, se avisa: a quien contestó
//     lo mandaría por ahí, y eso lo decide una persona.
// Lo que va sin espera de por medio no cambia: sale apenas llega el lead, antes de que pueda contestar. El DELAY «N
// antes de la reunión» (el carril) nunca se cortaba: tampoco se toca. Y se borra `si_contesta` del inicio.
//
// Sólo las que no están archivadas. Toca `pasos` y `pasos_borrador`. Se puede correr dos veces: una fila que ya
// tiene la condición no se repite, y sin `si_contesta` no hay nada que convertir.
//
// ⚠️ VA DESPUÉS DEL DEPLOY del código que conoce `contesto`: el de antes no conoce la fila, la da por no cumplida y
// el camino termina ahí.
//
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-contesto-condicion.ts            (dry run)
//   ENV_FILE=/ruta/.env.local node --import tsx scripts/migrar-contesto-condicion.ts --apply
// =============================================================================
import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: process.env.ENV_FILE ?? resolve(process.cwd(), '.env.local') });
import postgres from 'postgres';

const APLICAR = process.argv.includes('--apply');
const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });

type Fila = { campo: string; no?: boolean; union?: 'y' | 'o' } & Record<string, unknown>;
type Rama = { id: string; modo?: 'todas' | 'cualquiera'; filas?: Fila[]; siguiente?: string | null; paralelos?: string[] };
type Paso = Record<string, unknown> & {
  id?: string; nodo?: string; siguiente?: string | null; paralelos?: string[]; orden?: number; canal?: string;
  espera?: { modo?: string }; ramas?: Rama[]; si_no?: string | null; paralelos_si_no?: string[]; casos?: Array<{ siguiente?: string | null }>;
  si_contesta?: Record<string, string>;
};

const NO_CONTESTO: Fila = { campo: 'contesto', no: true };
const esNoContesto = (f: Fila): boolean => f.campo === 'contesto' && f.no === true;

/** Las flechas que salen de una tarjeta. */
function salidas(p: Paso): string[] {
  const out: string[] = [];
  if (p.siguiente) out.push(p.siguiente);
  for (const x of p.paralelos ?? []) out.push(x);
  for (const r of p.ramas ?? []) { if (r.siguiente) out.push(r.siguiente); for (const x of r.paralelos ?? []) out.push(x); }
  if (p.si_no) out.push(p.si_no);
  for (const x of p.paralelos_si_no ?? []) out.push(x);
  return out;
}

/** Las filas de una rama con «No contestó» sumado con «y» a CADA grupo (las «o» abren grupo: `gruposDeRama`). */
function conNoContesto(r: Rama): Fila[] {
  const filas = r.filas ?? [];
  const union = (k: number): 'y' | 'o' => (filas[k]?.union === 'y' || filas[k]?.union === 'o' ? filas[k].union! : r.modo === 'cualquiera' ? 'o' : 'y');
  const grupos: Fila[][] = [];
  filas.forEach((f, k) => { if (k === 0 || union(k) === 'o') grupos.push([f]); else grupos[grupos.length - 1].push(f); });
  if (!grupos.length) return filas;
  return grupos.flatMap((g, k) => {
    const yaEsta = g.some(esNoContesto);
    const primera = { ...g[0], union: k === 0 ? undefined : ('o' as const) };
    if (k === 0) delete primera.union;
    const resto = g.slice(1).map((f) => ({ ...f, union: 'y' as const }));
    return yaEsta ? [primera, ...resto] : [primera, ...resto, { ...NO_CONTESTO, union: 'y' as const }];
  });
}

function convertir(crudos: unknown, donde: string): { pasos: Paso[] | null; notas: string[] } {
  if (!Array.isArray(crudos) || !crudos.length) return { pasos: null, notas: [] };
  const pasos = (crudos as Paso[]).map((p) => ({ ...p }));
  const ini = pasos.find((p) => p.nodo === 'inicio');
  if (!ini || !ini.si_contesta) return { pasos: null, notas: [] };
  const sc = ini.si_contesta;
  const notas: string[] = [];
  const porId = new Map(pasos.map((p) => [String(p.id), p]));
  let orden = Math.max(0, ...pasos.map((p) => Number(p.orden) || 0));
  const raices = [ini.siguiente, ...(ini.paralelos ?? [])].filter((x): x is string => !!x);
  const tocadas = new Set<string>();
  raices.forEach((raiz, k) => {
    const clave = k === 0 ? 'p' : raiz;
    if (sc[clave] !== 'corta') return;
    // Las tarjetas del camino: desde su primera, sin entrar a «Si responde» ni volver al inicio.
    const vistos = new Set<string>();
    const pila = [raiz];
    while (pila.length) {
      const id = pila.pop()!;
      if (vistos.has(id)) continue;
      vistos.add(id);
      const p = porId.get(id);
      if (!p || p.nodo === 'respuesta' || p.nodo === 'inicio') continue;
      for (const d of salidas(p)) pila.push(d);
      if (p.nodo !== 'esperar' || p.espera?.modo === 'antes_reunion' || tocadas.has(id)) continue;
      tocadas.add(id);
      const destinos: Array<{ d: string; poner: (nuevo: string) => void }> = [];
      if (p.siguiente) destinos.push({ d: p.siguiente, poner: (n) => { p.siguiente = n; } });
      (p.paralelos ?? []).forEach((d, j) => destinos.push({ d, poner: (n) => { p.paralelos = (p.paralelos ?? []).map((x, i) => (i === j ? n : x)); } }));
      for (const { d, poner } of destinos) {
        const q = porId.get(d);
        if (!q) continue;
        if (q.nodo === 'condicion') {
          const antes = JSON.stringify(q.ramas ?? []);
          q.ramas = (q.ramas ?? []).map((r) => ({ ...r, filas: conNoContesto(r) }));
          if (JSON.stringify(q.ramas) !== antes) notas.push(`${donde}: «No contestó» sumado a la condición ${d} (después de ${id})`);
          if (q.si_no || (q.paralelos_si_no ?? []).length) notas.push(`${donde}: ⚠️ la condición ${d} tiene «Si no» → ${q.si_no ?? q.paralelos_si_no}: quien contestó iría por ahí. Revisar a mano.`);
          continue;
        }
        const nuevo = `${d}_nc`;
        if (porId.has(nuevo)) continue;
        orden += 1;
        const c: Paso = {
          id: nuevo, nodo: 'condicion', canal: q.canal ?? 'whatsapp', orden,
          ramas: [{ id: `${nuevo}_si`, modo: 'todas', filas: [{ ...NO_CONTESTO }], siguiente: d }],
          si_no: null, asunto: null, cuerpo: '', delay_horas: 0, template_wa: null,
        };
        pasos.push(c);
        porId.set(nuevo, c);
        poner(nuevo);
        notas.push(`${donde}: condición «No contestó desde que entró» entre ${id} y ${d}`);
      }
    }
  });
  delete ini.si_contesta;
  notas.push(`${donde}: sin si_contesta (${JSON.stringify(sc)})`);
  return { pasos, notas };
}

async function main(): Promise<void> {
  const filas = await sql<Array<{ id: number; workspace_id: number; nombre: string; activa: boolean; pasos: unknown; pasos_borrador: unknown }>>`
    select id, workspace_id, nombre, activa, pasos, pasos_borrador from nutricion_secuencias where archivada_at is null order by workspace_id, id`;
  let cambian = 0;
  for (const f of filas) {
    const pub = convertir(f.pasos, 'pasos');
    const bor = convertir(f.pasos_borrador, 'borrador');
    if (!pub.pasos && !bor.pasos) continue;
    cambian += 1;
    console.log(`#${f.id} ws${f.workspace_id} ${f.activa ? 'ACTIVA' : 'apagada'} «${f.nombre}»`);
    for (const n of [...pub.notas, ...bor.notas]) console.log(`   ${n}`);
    if (!APLICAR) continue;
    if (pub.pasos) await sql`update nutricion_secuencias set pasos = ${sql.json(pub.pasos as never)} where id = ${f.id}`;
    if (bor.pasos) await sql`update nutricion_secuencias set pasos_borrador = ${sql.json(bor.pasos as never)} where id = ${f.id}`;
  }
  console.log(`${cambian} automatización(es) ${APLICAR ? 'convertidas' : 'a convertir (dry run: --apply para escribir)'}`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
