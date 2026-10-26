// =============================================================================
// El presupuesto de herramientas del turno de la APP para una frase: el orden REAL y qué entra (25/10/2026)
// =============================================================================
// El turno de la app (lib/doer-herramientas.ts, `herramientasDelTurno`) manda al modelo las operaciones del registro
// en orden de RELEVANCIA (`ordenarPorRelevancia`: 2 puntos si una raíz de la frase está en el id o el título, 1 si está
// en la descripción; la frase va con las palabras que suma el clasificador, `relevancia`) hasta 12.000 caracteres de
// esquema, y la que no entra se SALTEA (las siguientes pueden entrar). Una palabra más en una descripción sube a esa
// operación y puede dejar afuera a la que la frase pedía: pasó el 25/10/2026 con «cambia el formulario de la landing»
// (docs/hallazgos-api-mako.md → «El presupuesto del turno de la app»).
//
// Uso (desde la raíz del repo):
//   node --conditions=react-server --import tsx scripts/presupuesto-turno-app.mts "cambia el formulario de la landing"
// Imprime: posición, + entra / - afuera, largo de la operación, acumulado, id.
// =============================================================================
import { MAKO_TOOLS } from '../lib/mako-tools';
import { MAKO_ACCION_TOOLS } from '../lib/mako-doer-acciones';
import { clasificarIntencion, areasDelMensaje, sinPrefijoDeLote } from '../lib/mako-intencion';
import { sinVerboAlArranque, pideQuitar } from '../lib/mako-intencion-app';
import { puertaDeDestructivas } from '../lib/relevancia-app';
import { toolsDelRegistro } from '../lib/api-mako/registro';
import { PRESUPUESTO_REGISTRO_CHARS } from '../lib/doer-herramientas';

const frase = process.argv[2] ?? '';
const cuantas = Number(process.argv[3] ?? 25);
const vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null } as const;
const v = clasificarIntencion(frase, { canal: 'app' });
const sobre = sinPrefijoDeLote(frase);
const areas = [...new Set([...areasDelMensaje(sobre), ...(v.areas ?? [])])];
const relevanteA = [sobre, v.relevancia ?? ''].filter(Boolean).join('\n');
const excluir = new Set([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t: { name: string }) => t.name));
const todas = toolsDelRegistro({
  vista: vista as never, areas, incluirAcciones: v.intencion === 'actuar', excluir, relevanteA,
  donde: puertaDeDestructivas(sinVerboAlArranque(sobre), pideQuitar(sobre)),
});
console.log(`intención ${v.intencion} · áreas ${JSON.stringify(areas)} · relevancia «${v.relevancia ?? ''}» · tope ${PRESUPUESTO_REGISTRO_CHARS}`);
let usados = 0;
todas.slice(0, cuantas).forEach((t, i) => {
  const largo = JSON.stringify(t).length;
  const entra = usados + largo <= PRESUPUESTO_REGISTRO_CHARS;
  if (entra) usados += largo;
  console.log(`${String(i + 1).padStart(2)} ${entra ? '+' : '-'} ${String(largo).padStart(5)} ${String(usados).padStart(6)} ${t.name}`);
});
