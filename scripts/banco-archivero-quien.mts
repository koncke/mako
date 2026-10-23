// =============================================================================
// banco-archivero-quien — el banco de casos de la extracción del Archivero: ¿de QUIÉN habla cada documento? (22/10/2026)
// =============================================================================
// La regla (AGENTS.md): un documento que habla DEL negocio pero no es DEL negocio no llena su perfil; y un documento de venta
// DEL negocio cuyo tema es un PROSPECTO no llena «qué hace tu negocio» con el negocio del prospecto (ws13, OF3).
// Antes de tocar el prompt compartido de la extracción (lib/onboarding.ts → ARCHIVERO_EXTRACT_TEMPLATE), este banco con
// documentos REALES tiene que dar todo bien antes y después.
//
// SÓLO LEE la base: los textos salen de `offer_sesiones.documentos`. La extracción corre con la IA de la PLATAFORMA (ws9):
// el gasto queda ahí, no en los negocios de los documentos. Los textos no se copian a ningún lado.
// Uso: node --env-file=<.env.local> --conditions=react-server --import tsx scripts/banco-archivero-quien.mts
// Sale con 1 si algún caso no da lo esperado.
// =============================================================================
export {};
import postgres from 'postgres';

type Espera = 'llena' | 'llena-oferta' | 'sin-que-hace';
// Cada documento por su id (no por su título: nombraría a personas). Lo que es, en `porque`.
const CASOS: Array<{ ws: number; sesion: number; doc: string; espera: Espera; porque: string }> = [
  { ws: 20, sesion: 17, doc: '1fe6ca3e-d353-465a-b426-72106cf61e67', espera: 'llena', porque: 'su documento maestro: es DEL negocio' },
  { ws: 21, sesion: 14, doc: '0eaa96a4-892c-46d6-9641-c756df2aa0c9', espera: 'llena', porque: 'la descripción de su negocio' },
  { ws: 22, sesion: 16, doc: '7184882a-f122-4c89-b83f-cb1dde5eb944', espera: 'llena', porque: 'los fundamentos de su negocio' },
  { ws: 1, sesion: 18, doc: '7e2aa559-f3a2-43ba-b7e2-06e2b78f2ea2', espera: 'llena-oferta', porque: 'su guion de venta: les habla a sus clientes de «tú», pero es suyo' },
  { ws: 13, sesion: 8, doc: '1afcbbd6-806f-4897-9ff5-cb2d91a59be3', espera: 'sin-que-hace', porque: 'su propuesta a un prospecto: el «qué hace» sería el del prospecto' },
  { ws: 13, sesion: 8, doc: 'f7e95743-9945-48de-9bea-45f056723722', espera: 'sin-que-hace', porque: 'su llamada de venta con un prospecto' },
];
const PLATAFORMA = 9;

const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require', max: 1 });
const { runWithWorkspace } = await import('../lib/workspace');
const { extraerDeArchivo } = await import('../lib/onboarding');
const { camposParaExtraer } = await import('../lib/archivero');

let mal = 0;
for (const c of CASOS) {
  const [s] = await sql`select documentos from offer_sesiones where workspace_id = ${c.ws} and id = ${c.sesion}`;
  const d = ((s?.documentos ?? []) as Array<{ id: string; texto: string }>).find((x) => x.id === c.doc);
  if (!d) { console.log(`✗ ws${c.ws} ${c.doc.slice(0, 8)}: no encontré el documento`); mal++; continue; }
  const ex = await runWithWorkspace(PLATAFORMA, async () => extraerDeArchivo(d.texto, await camposParaExtraer(), 24000, { motivo: 'Banco de casos de la extracción (sólo lectura)' }));
  const claves = Object.keys(ex.campos);
  const ok = ex.sinIA ? false
    : c.espera === 'llena' ? !!ex.campos.negocio_que_hace && ex.hablaDe !== 'proveedor'
      : c.espera === 'llena-oferta' ? claves.some((k) => k.startsWith('oferta_')) && ex.hablaDe !== 'proveedor'
        : !ex.campos.negocio_que_hace;
  if (!ok) mal++;
  console.log(`${ok ? '✓' : '✗'} ws${c.ws} ${c.doc.slice(0, 8)} (${c.porque}) · habla_de: ${ex.hablaDe ?? '(no lo dijo)'} · ${ex.sinIA ? `SIN IA: ${ex.motivoSinIA ?? ''}` : `${claves.length} claves`}${ex.campos.negocio_que_hace ? ` · qué hace: «${ex.campos.negocio_que_hace.slice(0, 90)}»` : ''}`);
}
await sql.end();
console.log(mal ? `✗ ${mal} de ${CASOS.length} casos no dan lo esperado` : `✓ los ${CASOS.length} casos dan lo esperado`);
process.exit(mal ? 1 : 0);
