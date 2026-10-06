// =============================================================================
// El tablero de un producto dibuja y mueve a los AGREGADOS sin tocar su casa (mig 0207)
// =============================================================================
// Pedido de Martín (06/10/2026), textual: «Le acabo de dar a un lead a "Mover a prueba" y se
// desapareció del producto principal de Mauricio. Eso JAMÁS debe pasar... No se debe "Mover"
// se debe agregar al otro producto».
//
// Un lead AGREGADO a un producto está en su tablero por una fila de `lead_funnel`
// (`Lead.de_fila`); su casa es otro producto. Este test fija las cuatro piezas del tablero:
//
//   1) app/crm/crm-map.ts — un agregado se dibuja con la etapa de SU FILA y, si ésta ya no
//      existe en el embudo, cae a la ETAPA DE ENTRADA, nunca a `deriveStageKey` (que sale del
//      recorrido de la casa). SE EJECUTA.
//   2) app/crm/CrmBoard.tsx — soltar su tarjeta escribe sólo la fila
//      (`moverEtapaEnProductoAction`), sin abrir ningún diálogo de la casa, con optimismo,
//      vuelta atrás y Deshacer que escribe en el server.
//   3) app/crm/page.tsx — las reuniones y los «datos sin marcar» se acotan a los leads cuya
//      CASA es este tablero.
//   4) app/crm/orden-actions.ts — el orden manual de una columna acepta a los agregados.
//
// ⚠️ POR QUÉ EL MAPPER SE CORRE EN UN PROCESO HIJO: crm-map importa `resolverNombreCampana`
// de lib/queries.ts, que abre con `import 'server-only'`, y `npm test` corre sin la condición
// `react-server` — importarlo acá revienta. El hijo corre con `--conditions=react-server`
// (ahí `server-only` es un módulo vacío) y devuelve lo que el mapper contestó en JSON. Es la
// misma frontera que tests/extension-worker-carga.test.ts cruza con un `node` de verdad.
// Tarda (carga el grafo de lib/queries): de 7 a 37 s medidos, según la carga de la máquina.
// Se probó stubear lib/queries con un hook de `resolve` de ESM y no sirve: tsx carga este
// grafo como CommonJS, y un `require` no pasa por esos hooks.
//
// Lo demás se mira sobre el FUENTE SIN COMENTARIOS: la convención de la casa es explicar en el
// comentario lo que se sacó, y un guard sobre el archivo entero se encuentra a sí mismo.
//
// PROBADO ROMPIÉNDOLO (en verde: 7 pases, 0 fallos). Cada rotura con un arnés que guarda el
// original en memoria y lo reescribe al final (nunca `git checkout`):
//   1) crm-map: un agregado vuelve a `deriveStageKey` (`deFila == null ?` → `true ?`)
//      → 1 fallo, 6 pases (el agregado ganado en su casa se dibuja en «ganado»).
//   2) crm-map: sin `...(deFila != null ? { deFila } : {})` → 1 fallo, 6 pases.
//   3) CrmBoard: la rama del agregado DESPUÉS de `if (stageKey === 'manual')` y de Calendly
//      → 1 fallo, 6 pases.
//   4) CrmBoard: el Deshacer sin la segunda `moverEtapaEnProductoAction` (sólo pantalla)
//      → 1 fallo, 6 pases.
//   5) CrmBoard: sin `volverPantalla()` cuando la acción falla → 1 fallo, 6 pases.
//   6) page.tsx: el filtro de las reuniones vuelve a `new Set(leads.map(...))`
//      → 1 fallo, 6 pases.
//   7) orden-actions: sin la consulta a `lead_funnel` → 1 fallo, 6 pases.
//   8) orden-actions: el embudo del negocio sin `idDelFunnelDefault()` → 1 fallo, 6 pases.
// Y restaurado vuelve a 7/0 (06/10/2026).
//
// Correr: npx tsx --test tests/lead-funnel-tablero.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(resolve(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas `//` PRIMERO y los bloques después (un `/*` adentro de un `//` se comería código). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque entre dos marcas, sin comentarios. Tira si alguna de las dos no está. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  return src.slice(i, j);
}

// ── 1) El mapper, ejecutado ────────────────────────────────────────────────────

/** Lo que el hijo devuelve por cada caso. */
type Salida = { entrada: string | null; entradaSinKind: string | null; casos: Record<string, { stage: string; deFila?: number; stageFuera: string | null; derivedStage: string }> };

function correrMapper(): Salida {
  const crmMap = JSON.stringify(resolve(RAIZ, 'app/crm/crm-map.ts'));
  const codigo = `
    import { pathToFileURL } from 'node:url';
    const { mapToCrmLead, etapasDelTablero } = await import(pathToFileURL(${crmMap}).href);
    // Las columnas de ESTE producto: la de entrada NO es la primera, a propósito, para que
    // «cae a la entrada» y «cae a la primera columna» se distingan.
    const etapas = [{ key: 'interesado' }, { key: 'registro', kind: 'entrada' }, { key: 'ganado' }];
    const v = etapasDelTablero(etapas);
    // Un lead GANADO en su casa (estado_lead = ganado deriva «ganado», que este embudo SÍ tiene).
    const base = { id: 7, nombre: 'Prueba', estado_lead: 'ganado', created_at: '2026-10-01T00:00:00Z' };
    const m = (l, keys = v) => {
      const r = mapToCrmLead(l, {}, keys);
      return { stage: r.stage, deFila: r.deFila, stageFuera: r.stageFuera ?? null, derivedStage: r.derivedStage };
    };
    console.log(JSON.stringify({
      entrada: v.entrada ?? null,
      entradaSinKind: etapasDelTablero([{ key: 'a' }, { key: 'b' }]).entrada ?? null,
      casos: {
        agregadoHuerfano: m({ ...base, pipeline_stage: 'vieja', de_fila: 14 }),
        agregadoValido: m({ ...base, pipeline_stage: 'interesado', de_fila: 14 }),
        agregadoSinEtapa: m({ ...base, pipeline_stage: null, de_fila: 14 }),
        agregadoSetPelado: m({ ...base, pipeline_stage: 'vieja', de_fila: 14 }, new Set(etapas.map((s) => s.key))),
        casaHuerfana: m({ ...base, pipeline_stage: 'vieja' }),
      },
    }));
  `;
  const out = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', timeout: 170_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const linea = out.trim().split('\n').filter((x) => x.startsWith('{')).pop();
  assert.ok(linea, `el hijo no devolvió JSON:\n${out}`);
  return JSON.parse(linea) as Salida;
}

test('crm-map: un AGREGADO se dibuja con la etapa de su fila, y si no existe acá cae a la ENTRADA (no a la derivada de su casa)', { timeout: 180_000 }, () => {
  const s = correrMapper();
  assert.equal(s.entrada, 'registro', 'etapasDelTablero trae la etapa de entrada declarada');
  assert.equal(s.entradaSinKind, 'a', 'sin ninguna declarada, la entrada es la primera columna');

  const h = s.casos.agregadoHuerfano;
  assert.equal(h.stage, 'registro', 'etapa huérfana → la de ENTRADA. «ganado» sería el avance de su casa dibujado acá');
  assert.equal(h.deFila, 14, 'la tarjeta sabe que es un agregado: es lo que cambia qué escribe moverla');
  assert.equal(h.stageFuera, 'vieja', 'y el dato no se borra: la tarjeta lo sigue diciendo');
  assert.equal(h.derivedStage, 'registro', 'su «derivada» tampoco sale del recorrido de la casa');

  const ok = s.casos.agregadoValido;
  assert.equal(ok.stage, 'interesado', 'con la etapa de su fila vigente, ésa');
  assert.equal(ok.stageFuera, null);

  assert.equal(s.casos.agregadoSinEtapa.stage, 'registro', 'sin etapa, también la entrada');
  assert.equal(s.casos.agregadoSetPelado.stage, 'interesado', 'con un Set pelado, la entrada es la primera columna');

  const casa = s.casos.casaHuerfana;
  assert.equal(casa.deFila, undefined, 'un lead en su casa NO lleva deFila');
  assert.equal(casa.stage, 'ganado', 'y en su casa se sigue derivando como siempre');
});

// ── 2) El tablero: soltar la tarjeta de un agregado ─────────────────────────────

const BOARD = sinComentarios(leer('app/crm/CrmBoard.tsx'));

test('CrmBoard: soltar un agregado entra por su rama ANTES de cualquier diálogo de la casa', () => {
  const hd = bloque(BOARD, 'const handleDrop = (', 'const [altaPendiente');
  const rama = hd.indexOf('if (lead.deFila != null) { moverEnProducto(lead, lead.deFila, stageKey, guardarLugar); return; }');
  assert.ok(rama > 0, 'falta la rama del agregado en handleDrop');
  assert.ok(hd.indexOf('const guardarLugar') < rama, 'guardarLugar se arma antes, para que la rama lo use');
  for (const desvio of ["if (stageKey === 'manual')", 'esEtapaCalendly(stageKey)', 'senalesAOfrecer(', 'setConfirmacion(', 'persistStage(']) {
    const k = hd.indexOf(desvio);
    assert.ok(k > 0, `no encontré «${desvio}» en handleDrop`);
    assert.ok(rama < k, `«${desvio}» es del recorrido de la casa y va DESPUÉS de la rama del agregado`);
  }
});

test('CrmBoard: mover un agregado escribe SÓLO la fila, optimista, con vuelta atrás y Deshacer al server', () => {
  const mv = bloque(BOARD, 'const moverEnProducto = (', 'const handleDrop = (');
  assert.match(BOARD, /import \{ moverEtapaEnProductoAction \} from '\.\/lead-funnel-actions';/);
  const optimista = mv.indexOf('setLocalStage((m) => ({ ...m, [id]: stageKey }));');
  const accion = mv.indexOf('moverEtapaEnProductoAction(id, producto, stageKey)');
  assert.ok(optimista > 0 && accion > optimista, 'la tarjeta se mueve en pantalla ANTES de que conteste el server');
  assert.match(mv, /if \(!r\.ok\) \{\s*volverPantalla\(\);/, 'si la acción falla, la tarjeta vuelve');
  // El Deshacer vuelve a llamar a la MISMA acción con la etapa anterior: revertir sólo la
  // pantalla mentiría hasta el próximo F5.
  assert.match(mv, /mostrarAviso\(`Movido a \$\{destino\}`, \(\) => \{[\s\S]*moverEtapaEnProductoAction\(id, producto, volverA\)/);
  assert.equal(mv.split('moverEtapaEnProductoAction(').length - 1, 2, 'dos llamadas: mover y deshacer');
  assert.match(mv, /guardarLugar\(\);/, 'el lugar en la columna se guarda igual que en la casa');
  // Y nada del recorrido de la casa.
  assert.doesNotMatch(mv, /setLeadStageAction|undoStageMoveAction|persistStage|openManualNutri|scheduleViaCalendly|setConfirmacion|setUndoInfo/);
});

// ── 3) La página: reuniones y «datos sin marcar» sólo de la casa ────────────────

test('page.tsx: las reuniones y los datos sin marcar se acotan a los leads cuya CASA es este tablero', () => {
  const pg = sinComentarios(leer('app/crm/page.tsx'));
  assert.match(pg, /const idsDeLaCasa = new Set\(leads\.filter\(\(l\) => l\.de_fila == null\)\.map\(\(l\) => l\.id\)\);/);
  assert.match(pg, /juntasRaw = juntasRaw\.filter\(\(j\) => idsDeLaCasa\.has\(j\.lead_id\)\);/);
  assert.match(pg, /pendientesRaw = pendientesRaw\.filter\(\(p\) => idsDeLaCasa\.has\(p\.lead_id\)\);/);
  assert.match(pg, /const validStageKeys = etapasDelTablero\(stages\);/, 'el mapper recibe la etapa de entrada');
});

// ── 4) El orden manual acepta a los agregados ───────────────────────────────────

const ORDEN = sinComentarios(leer('app/crm/orden-actions.ts'));

test('orden-actions: la validación de ids acepta a los agregados de este embudo (filas de lead_funnel)', () => {
  const fn = bloque(ORDEN, 'export async function ordenarColumnaCrmAction', "db.from('lead_orden')");
  assert.match(fn, /db\.from\('lead_funnel'\)\.select\('lead_id'\)\.eq\('funnel_id', idReal\)\.in\('lead_id', tanda\)/);
  assert.match(fn, /for \(const f of \(ag\.data \?\? \[\]\)[^)]*\) ok\.add\(Number\(f\.lead_id\)\);/, 'y los suma a los válidos');
  assert.match(fn, /const validos = pedidos\.filter\(\(id\) => ok\.has\(id\)\);/);
});

test('orden-actions: el embudo del negocio se resuelve a su id REAL (en lead_funnel no es NULL)', () => {
  const fn = bloque(ORDEN, 'export async function ordenarColumnaCrmAction', "db.from('lead_orden')");
  assert.match(fn, /\} else \{\s*idReal = await idDelFunnelDefault\(\);\s*\}/, 'con funnelId null, el id del negocio');
  assert.match(fn, /funnel = f\.esDefault \? null : f\.id;\s*idReal = f\.id;/, 'con su id, ése (también si es el del negocio)');
});

test('orden-actions: se valida en tandas por debajo del techo de 1000 filas de PostgREST', () => {
  const tanda = ORDEN.match(/const TANDA = (\d+);/);
  assert.ok(tanda && Number(tanda[1]) < 1000, 'una tanda de 1000 o más vuelve a cortar en silencio');
  assert.match(ORDEN, /for \(let i = 0; i < pedidos\.length; i \+= TANDA\)/);
});
