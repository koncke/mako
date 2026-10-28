// =============================================================================
// medir-recuperacion — ¿cuántos tokens ahorra que un chat traiga sólo los nodos que le sirven? Con un caso REAL.
// =============================================================================
//   node --conditions=react-server --import tsx scripts/medir-recuperacion.ts --env <ruta/.env.local> --ws 3
//
// Arma el grafo de un workspace (SÓLO LECTURA: lo mismo que pasa cada vez que alguien abre el Second Brain) y compara,
// para unas preguntas de todos los días, lo que le llega a un chat de tres maneras:
//   · ENTERO EN LÍNEAS: todos los datos, una línea cada uno (lo que hoy manda /api/second-brain/buscar a la IA);
//   · ENTERO EN ARCHIVOS: el vault en markdown (lo que devuelve leer_segundo_cerebro_como_archivos, tope 60.000);
//   · LA VISTA LOCAL: el índice + recuperar(pregunta) con el presupuesto de siempre (lib/cerebro-recuperar.ts).
// Los tokens son ESTIMADOS (caracteres / 4, `tokensDe`): sirven para comparar, no para facturar.
//
// EL TURNO (28/10/2026): lo que el turno de MaKo suma a su system con lo que trae del Second Brain antes del modelo
// (lib/cerebro-para-chat.ts → `paqueteParaElTurno`), para el dueño y para un closer (sin la plata). En la plataforma (el ws 9),
// el grafo lleva «Lo que hace MaKo» y se suman preguntas de producto. No llama a ninguna IA: el system fijo de hoy (~2,3k
// tokens medidos sobre el código, C:/dev/revisiones/2810-second-brain-relevamiento.md) es la vara, no se arma acá.
//
// ⚠️ NUNCA el ws 1 (el cliente real): se mide en el 3 (Cliente de Prueba) o en el 9 (MaKo).
// ⚠️ `--conditions=react-server` hace que `server-only` no reviente fuera de Next; `--env` es el .env.local del clon
//    principal (los worktrees no lo tienen). Apunta a PRODUCCIÓN: por eso este script no escribe nada.
// =============================================================================

import { config } from 'dotenv';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
const env = arg('--env');
const ws = Number(arg('--ws') ?? 3);
if (!env) { console.error('falta --env <ruta al .env.local>'); process.exit(2); }
if (ws === 1) { console.error('el ws 1 es el cliente real: se mide en el 3 o en el 9'); process.exit(2); }
config({ path: env, quiet: true } as Parameters<typeof config>[0]);

const PREGUNTAS = [
  '¿Cuánto cobro y qué incluye mi oferta?',
  '¿Quién es mi cliente ideal y qué le duele?',
  '¿Cómo vienen mis leads y en qué etapa están?',
  '¿Qué anuncios puedo hacer y para qué avatar?',
  '¿Cómo suena mi marca?',
];

async function main() {
  const { runWithWorkspace } = await import('../lib/workspace');
  const { construirCerebro } = await import('../lib/cerebro-grafo');
  const { construirVault } = await import('../lib/vault');
  const { AREAS } = await import('../lib/cerebro-modelo');
  const { indiceDelCerebro, recuperar, tokensDe } = await import('../lib/cerebro-recuperar');

  const cerebro = await runWithWorkspace(ws, () => construirCerebro());
  const datos = cerebro.nodos.filter((n) => n.id !== 'raiz' && !n.id.startsWith('area:') && !n.id.startsWith('n1:'));
  // Lo que hoy manda /api/second-brain/buscar a la IA: una línea por dato (la misma forma que esa ruta).
  const enLineas = datos.map((n) => {
    const area = AREAS.find((a) => a.id === n.area)?.nombre ?? n.area;
    const ds = (n.datos ?? []).filter((d) => d.v).map((d) => `${d.k}: ${d.v}`).join(' · ');
    return `[${n.id}] (${area}) ${n.etiqueta}${n.detalle ? ` — ${n.detalle}` : ''}${ds ? ` — ${ds}` : ''}`;
  }).join('\n');
  const vault = construirVault(cerebro, AREAS.map((a) => a.id)).map((a) => `## ${a.ruta}\n\n${a.texto}`).join('\n\n---\n\n');
  const vaultConTope = vault.slice(0, 60_000);
  const indice = indiceDelCerebro(cerebro);

  console.log(`\nws ${ws} · ${cerebro.negocio} · ${datos.length} datos, ${cerebro.aristas.length} aristas`);
  console.log(`ENTERO en líneas:      ${tokensDe(enLineas)} tokens`);
  console.log(`ENTERO en archivos:    ${tokensDe(vault)} tokens (con el tope de 60.000 caracteres: ${tokensDe(vaultConTope)})`);
  console.log(`EL ÍNDICE:             ${tokensDe(indice)} tokens`);
  let suma = 0;
  for (const q of PREGUNTAS) {
    const p = await runWithWorkspace(ws, async () => recuperar(cerebro, { pregunta: q }));
    suma += p.tokens;
    const ahorro = Math.round(100 * (1 - p.tokens / Math.max(1, tokensDe(enLineas))));
    console.log(`«${q}» → ${p.modo}, ${p.nodos.length} datos, ${p.tokens} tokens (${ahorro}% menos que entero en líneas) · semillas: ${p.semillas.slice(0, 4).join(', ')}`);
  }
  const prom = Math.round(suma / PREGUNTAS.length);
  console.log(`PROMEDIO por pregunta: ${prom} tokens, más el índice una vez por chat (${tokensDe(indice)}).`);
  console.log(`Ahorro medio contra ENTERO en líneas: ${Math.round(100 * (1 - prom / Math.max(1, tokensDe(enLineas))))}% · contra ENTERO en archivos: ${Math.round(100 * (1 - prom / Math.max(1, tokensDe(vaultConTope))))}%`);

  // ── EL TURNO ──
  const { wsSuperAdmin } = await import('../lib/workspace');
  const { conCapa, sinLaPlata, bloqueDelSecondBrain, PRESUPUESTO_TURNO } = await import('../lib/cerebro-union');
  const { CAPA_FUNCIONES, funcionesDeMako, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES } = await import('../lib/cerebro-funciones');
  const plataforma = (await wsSuperAdmin().catch(() => -1)) === ws;
  const negocio = await runWithWorkspace(ws, () => construirCerebro({ sinLayout: true }));
  const grafo = plataforma ? conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES }) : negocio;
  const preguntas = [...PREGUNTAS, '¿Cuál es mi meta del trimestre?', ...(plataforma ? ['hacé de esta copia la landing de los Chats', '¿qué reemplaza a respond.io?', '¿qué no hace la bandeja?'] : [])];
  console.log(`\nEL TURNO (${plataforma ? 'la plataforma, con las funciones' : 'un negocio'}), presupuesto ${PRESUPUESTO_TURNO}: lo que suma al system de cada turno`);
  let sumaTurno = 0;
  let conPaquete = 0;
  for (const q of preguntas) {
    const dueno = bloqueDelSecondBrain(recuperar(grafo, { pregunta: q, presupuesto: PRESUPUESTO_TURNO }));
    const closer = bloqueDelSecondBrain(recuperar(sinLaPlata(grafo), { pregunta: q, presupuesto: PRESUPUESTO_TURNO }));
    sumaTurno += tokensDe(dueno);
    if (dueno) conPaquete++;
    const semillas = recuperar(grafo, { pregunta: q, presupuesto: PRESUPUESTO_TURNO }).semillas.slice(0, 3).join(', ');
    console.log(`«${q}» → dueño ${tokensDe(dueno)} tokens · closer ${tokensDe(closer)} · semillas: ${semillas || '(ninguna: no suma nada)'}`);
  }
  console.log(`PROMEDIO que suma el turno: ${Math.round(sumaTurno / preguntas.length)} tokens (${conPaquete} de ${preguntas.length} preguntas traen algo), contra ${tokensDe(enLineas)} del grafo entero en líneas.`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
