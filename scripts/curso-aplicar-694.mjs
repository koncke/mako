// =============================================================================
// curso-aplicar-694 — lleva a curso_clases del ws1 los dos cambios de #694 que la semilla ya trae
// =============================================================================
// Tarea #694 (dictado de Mauricio del 12/08, docs/programa-mauricio.md):
//   1. «El objetivo de cada área» (catalogo:m4c3): la tabla `objetivo-por-area` suma AL FINAL la
//      columna «¿A qué MCI sube? (1, 2 o las dos)».
//      + su ayuda decía «La última columna importa…» hablando de «¿El área ya lo calcula hoy?»,
//        que deja de ser la última. Si la ayuda sigue siendo la ORIGINAL se corrige; si alguien
//        la editó, se deja y se avisa.
//   2. «Elegir las palancas» (catalogo:m6c3): suma como PRIMER campo la tabla
//      `palancas-candidatas-por-objetivo` (Objetivo del área · Palanca candidata · Responsable),
//      con la ayuda «Máximo tres por objetivo.».
//
// POR QUÉ HACE FALTA: lib/curso-programa-nqe.ts es la SEMILLA, no la fuente de verdad. Una vez
// cargado, el curso vive en la base y scripts/curso-cargar-programa.ts SALTEA todo origen que ya
// existe. Cambiar la semilla no cambia lo cargado.
//
// ⚠️ MIENTRAS NO CORRA CON --commit CONTRA EL ws1, la base NO tiene ninguno de los dos campos, y
// tres textos del repo lo dicen así: docs/programa-mauricio.md («Lo que cambia con el feedback de
// Mau», el aviso de Historia), el paso «El curso del servicio, adentro de MaKo» de
// app/admin/dev/customer-success/roadmap-cs.ts (su `falta` y su `ojo`) y la nota de #694 en
// lib/curso-programa-nqe.ts. El commit que lo corra los pasa a «hecho».
//
// ── Uso: desde la RAÍZ del repo, en un árbol que tenga la semilla con #694 ─────
//   node --import tsx scripts/curso-aplicar-694.mjs            ← SECO (default): imprime antes/después
//   node --import tsx scripts/curso-aplicar-694.mjs --commit   ← escribe
//
//   · Lee DATABASE_URL de `.env.local` del cwd, y la semilla y `sanearCampos` del cwd: lo que
//     se escribe es EXACTAMENTE lo que la semilla commiteada dice, no una copia a mano.
//   · `--import tsx` hace falta por eso: importa dos `.ts`. Sin él, sale con el comando.
//
// SE NIEGA (no escribe NADA, tampoco el otro cambio) si:
//   · encuentra 0 o más de 1 clase para un cambio (se buscan por `origen` O por `titulo`, en el
//     ws1 y el producto 1, nunca por id);
//   · hay filas en curso_progreso para cualquiera de las dos clases (las respuestas de una tabla
//     se guardan por POSICIÓN de columna: con respuestas, no se toca nada sin mirar);
//   · `campos` no es un array jsonb, o la tabla de m4c3 ya no tiene las siete columnas de la
//     semilla (alguien la editó: no se adivina);
//   · el resultado no sobrevive intacto a `sanearCampos` (la pantalla lo reescribiría distinto);
//   · entre la lectura y la escritura la fila cambió (se relee con FOR UPDATE adentro de la
//     transacción).
// Un cambio que YA está aplicado se saltea y lo dice: correrlo dos veces no duplica nada.
//
// ⚠️ jsonb VA COMO OBJETO (`sql.json`), NUNCA como `JSON.stringify(...)::jsonb`: el driver ya
// serializa, y el texto guarda un jsonb que CONTIENE UN STRING (AGENTS.md, «El respaldo CORROMPIÓ
// lo que venía a proteger»). Y se verifica con `jsonb_typeof(campos) = 'array'`, una pregunta
// que un lector propio no puede contestar mal.
//
// Las funciones puras (`cambioM4c3`, `cambioM6c3`) las EJECUTA tests/curso-aplicar-694.test.ts
// contra la semilla de este árbol: si la semilla cambia y el script no, el test cae.
//
// No manda nada a nadie: sólo dos UPDATE sobre curso_clases.
// =============================================================================

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const WS = 1;
const PRODUCTO = 1;
const PRODUCTO_NOMBRE = 'Negocio que Escala';

/** Los dos cambios, con cómo se ubica cada clase. Los valores NUEVOS salen de la semilla. */
const M4C3 = { origen: 'catalogo:m4c3', titulo: 'El objetivo de cada área', campo: 'objetivo-por-area' };
const M6C3 = { origen: 'catalogo:m6c3', titulo: 'Elegir las palancas', campoPuente: 'palancas-candidatas-por-objetivo' };

/** La ayuda con la que se CARGÓ m4c3 el 06/10 (eba4f12f). La semilla ya no la tiene: va literal. */
export const AYUDA_M4C3_ORIGINAL = 'La última columna importa. Si el área no lo calcula hoy, no se puede exigir la semana que entra.';

// ── Lo puro: qué hacerle a los `campos` de cada clase ──────────────────────────
// Devuelve { estado: 'aplicar' | 'ya' | 'rechazo', nuevos?, motivo?, avisos[] }.

/**
 * m4c3: agrega la columna AL FINAL de la tabla. `colsSemilla` = las columnas de la semilla
 * (con la nueva al final). Rechaza si las siete de antes no están tal cual y en su lugar.
 */
export function cambioM4c3(campos, { colsSemilla, ayudaSemilla, ayudaOriginal = AYUDA_M4C3_ORIGINAL }) {
  const avisos = [];
  if (!Array.isArray(campos)) return { estado: 'rechazo', motivo: '`campos` no es un array', avisos };
  const i = campos.findIndex((c) => c && c.id === M4C3.campo);
  if (i < 0) return { estado: 'rechazo', motivo: `no tiene el campo «${M4C3.campo}»`, avisos };
  const t = campos[i];
  if (t.tipo !== 'tabla' || !Array.isArray(t.columnas)) return { estado: 'rechazo', motivo: `«${M4C3.campo}» no es una tabla con columnas`, avisos };
  const nueva = colsSemilla[colsSemilla.length - 1];
  const viejas = colsSemilla.slice(0, -1);
  if (isDeepStrictEqual(t.columnas, colsSemilla)) {
    if (t.ayuda === ayudaOriginal) avisos.push('la columna ya está, pero la ayuda sigue diciendo «La última columna importa»: corrígela a mano en la tab Curso');
    return { estado: 'ya', avisos };
  }
  if (t.columnas.includes(nueva)) return { estado: 'rechazo', motivo: `la columna «${nueva}» ya está, pero no al final: no se mueve sin mirar (las respuestas van por posición)`, avisos };
  if (!isDeepStrictEqual(t.columnas, viejas)) {
    return { estado: 'rechazo', motivo: `las columnas no son las de la semilla (alguien las editó):\n      hoy:     ${JSON.stringify(t.columnas)}\n      semilla: ${JSON.stringify(viejas)}`, avisos };
  }
  const campo = { ...t, columnas: [...t.columnas, nueva] };
  if (t.ayuda === ayudaOriginal) campo.ayuda = ayudaSemilla;
  else avisos.push(`la ayuda no es la original (alguien la editó), se deja como está: «${t.ayuda ?? ''}»`);
  const nuevos = campos.slice();
  nuevos[i] = campo;
  return { estado: 'aplicar', nuevos, avisos };
}

/** m6c3: agrega el campo del puente como PRIMERO. Si ya hay un campo con ese id, no hace nada. */
export function cambioM6c3(campos, puente) {
  const avisos = [];
  if (!Array.isArray(campos)) return { estado: 'rechazo', motivo: '`campos` no es un array', avisos };
  if (campos.some((c) => c && c.id === puente.id)) return { estado: 'ya', avisos };
  if (campos[0]?.id !== 'enunciado-de-la-palanca') {
    avisos.push(`el primer campo hoy es «${campos[0]?.id ?? '(ninguno)'}», no «enunciado-de-la-palanca»: alguien editó el formulario; el puente igual va primero`);
  }
  return { estado: 'aplicar', nuevos: [puente, ...campos], avisos };
}

// ── El script ─────────────────────────────────────────────────────────────────

async function main() {
  const COMMIT = process.argv.includes('--commit');
  const cwd = process.cwd();
  const req = createRequire(resolve(cwd, 'package.json'));
  req('dotenv').config({ path: resolve(cwd, '.env.local') });
  const postgres = req('postgres');

  // 1. La semilla y el saneo, del árbol desde donde se corre.
  let semillaMod, cursoMod;
  try {
    semillaMod = await import(pathToFileURL(resolve(cwd, 'lib/curso-programa-nqe.ts')).href);
    cursoMod = await import(pathToFileURL(resolve(cwd, 'lib/curso.ts')).href);
  } catch (e) {
    console.error(`✖ No pude importar la semilla (${e?.code ?? e?.message}). Se corre desde la raíz del repo y con tsx:\n   node --import tsx scripts/curso-aplicar-694.mjs${COMMIT ? ' --commit' : ''}`);
    process.exit(1);
  }
  const { programaNqe, CURSO_NQE } = semillaMod;
  const { sanearCampos } = cursoMod;
  if (CURSO_NQE.workspaceId !== WS || CURSO_NQE.productoId !== PRODUCTO) throw new Error(`la semilla apunta a ws${CURSO_NQE.workspaceId}/producto ${CURSO_NQE.productoId}, no a ws${WS}/producto ${PRODUCTO}`);
  const semilla = programaNqe();
  const sM4 = semilla.find((c) => c.origen === M4C3.origen);
  const sM6 = semilla.find((c) => c.origen === M6C3.origen);
  const tablaSemilla = sM4?.campos.find((c) => c.id === M4C3.campo);
  const puente = sM6?.campos[0];
  if (!tablaSemilla?.columnas || tablaSemilla.columnas.at(-1) !== '¿A qué MCI sube? (1, 2 o las dos)' || puente?.id !== M6C3.campoPuente) {
    throw new Error('la semilla de este árbol NO trae #694 (falta la columna de la MCI o el puente): se corre desde un árbol con ese commit');
  }

  const conn = process.env.DATABASE_URL;
  if (!conn) { console.error('✖ Falta DATABASE_URL en .env.local'); process.exit(1); }
  const sql = postgres(conn, { ssl: 'require', connect_timeout: 60, max: 1 });

  try {
    // 2. El proyecto es el que creemos: el producto 1 del ws1 se llama como dice la semilla.
    const prod = await sql`select id, nombre from productos where workspace_id = ${WS} and id = ${PRODUCTO}`;
    if (prod.length !== 1 || prod[0].nombre !== PRODUCTO_NOMBRE) {
      throw new Error(`el producto ${PRODUCTO} del ws${WS} es «${prod[0]?.nombre ?? 'inexistente'}», no «${PRODUCTO_NOMBRE}». Base equivocada: no se toca nada.`);
    }

    // 3. Ubicar cada clase: por origen O por título, nunca por id. Exactamente una.
    const ubicar = async (q) => sql`
      select id, titulo, origen, etapa, campos, jsonb_typeof(campos) as tipo_campos, updated_at
      from curso_clases
      where workspace_id = ${WS} and producto_id = ${PRODUCTO}
        and (origen = ${q.origen} or titulo = ${q.titulo})
      order by id`;
    const filas4 = await ubicar(M4C3);
    const filas6 = await ubicar(M6C3);
    const rechazos = [];
    const unica = (filas, q) => {
      if (filas.length !== 1) {
        rechazos.push(`«${q.titulo}» (${q.origen}): ${filas.length} clases${filas.length ? ` → ${filas.map((f) => `id ${f.id} «${f.titulo}» [${f.origen ?? 'sin origen'}]`).join(', ')}` : ''}. Tiene que ser exactamente UNA.`);
        return null;
      }
      return filas[0];
    };
    const c4 = unica(filas4, M4C3);
    const c6 = unica(filas6, M6C3);
    for (const c of [c4, c6]) if (c && c.tipo_campos !== 'array') rechazos.push(`clase id ${c.id}: campos es jsonb '${c.tipo_campos}', no 'array' (¿doble codificación?). No se toca.`);

    // 4. Sin respuestas guardadas. Se cuentan TODAS las filas, contestadas o no.
    const ids = [c4, c6].filter(Boolean).map((c) => c.id);
    const prog = ids.length ? await sql`
      select clase_id, count(*)::int as n from curso_progreso
      where workspace_id = ${WS} and clase_id in ${sql(ids)} group by clase_id` : [];
    for (const p of prog) if (p.n > 0) rechazos.push(`clase id ${p.clase_id}: tiene ${p.n} fila(s) en curso_progreso. Con respuestas no se toca nada sin mirar.`);

    // 5. Qué cambia en cada una.
    const r4 = c4 ? cambioM4c3(c4.campos, { colsSemilla: tablaSemilla.columnas, ayudaSemilla: tablaSemilla.ayuda }) : null;
    const r6 = c6 ? cambioM6c3(c6.campos, puente) : null;
    for (const [r, c] of [[r4, c4], [r6, c6]]) {
      if (!r) continue;
      if (r.estado === 'rechazo') rechazos.push(`clase id ${c.id} «${c.titulo}»: ${r.motivo}`);
      if (r.estado === 'aplicar' && !isDeepStrictEqual(sanearCampos(r.nuevos), r.nuevos)) rechazos.push(`clase id ${c.id}: el resultado no sobrevive intacto a sanearCampos.`);
    }

    console.log(`ws${WS} · producto ${PRODUCTO} «${prod[0].nombre}» · ${COMMIT ? 'ESCRIBE (--commit)' : 'SECO (no escribe; --commit para escribir)'}\n`);
    imprimir('1. m4c3', c4, r4, (cs) => cs.find((x) => x?.id === M4C3.campo));
    imprimir('2. m6c3', c6, r6, (cs) => cs.slice(0, 2));

    if (rechazos.length) {
      console.error(`\n✖ SE NIEGA, no se escribe nada:\n${rechazos.map((x) => `   · ${x}`).join('\n')}`);
      process.exitCode = 1;
      return;
    }
    const pendientes = [[c4, r4], [c6, r6]].filter(([, r]) => r.estado === 'aplicar');
    if (!pendientes.length) { console.log('\n→ los dos cambios ya están aplicados: no hay nada que escribir.'); return; }
    if (!COMMIT) { console.log(`\n→ seco: se escribirían ${pendientes.length} clase(s). Para escribir: --commit`); return; }

    // 6. Escribir, en UNA transacción: se relee con FOR UPDATE y se exige que nada haya cambiado.
    await sql.begin(async (tx) => {
      const [{ n: conProgreso }] = await tx`
        select count(*)::int as n from curso_progreso where workspace_id = ${WS} and clase_id in ${tx(ids)}`;
      if (conProgreso > 0) throw new Error(`aparecieron ${conProgreso} fila(s) en curso_progreso entre la lectura y la escritura`);
      for (const [c, r] of pendientes) {
        const [ahora] = await tx`select campos, updated_at from curso_clases where id = ${c.id} and workspace_id = ${WS} for update`;
        if (!ahora || !isDeepStrictEqual(ahora.campos, c.campos)) throw new Error(`la clase id ${c.id} cambió desde que se leyó: volver a correr en seco`);
        const upd = await tx`
          update curso_clases set campos = ${sql.json(r.nuevos)}, updated_at = now()
          where id = ${c.id} and workspace_id = ${WS} and producto_id = ${PRODUCTO}
          returning id`;
        if (upd.length !== 1) throw new Error(`el UPDATE de la clase id ${c.id} tocó ${upd.length} filas`);
        // Verificación con una pregunta que un lector propio no puede contestar mal.
        const [v] = await tx`select jsonb_typeof(campos) as tipo, campos from curso_clases where id = ${c.id}`;
        if (v.tipo !== 'array') throw new Error(`clase id ${c.id}: quedó jsonb '${v.tipo}', no 'array' — se deshace`);
        if (!isDeepStrictEqual(v.campos, r.nuevos)) throw new Error(`clase id ${c.id}: lo que quedó no es lo que se mandó — se deshace`);
      }
    });

    // 7. Releer AFUERA de la transacción: lo que ve la pantalla.
    for (const [c] of pendientes) {
      const [v] = await sql`select jsonb_typeof(campos) as tipo, jsonb_array_length(campos) as n, updated_at from curso_clases where id = ${c.id}`;
      console.log(`✔ clase id ${c.id} «${c.titulo}»: campos ${v.tipo} con ${v.n} campo(s), updated_at ${v.updated_at.toISOString?.() ?? v.updated_at}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

function imprimir(rotulo, clase, r, foco) {
  console.log(`── ${rotulo}`);
  if (!clase) { console.log('   (no ubicada)\n'); return; }
  console.log(`   clase id ${clase.id} · «${clase.titulo}» · origen ${clase.origen ?? '(ninguno)'} · etapa ${clase.etapa} · ${Array.isArray(clase.campos) ? clase.campos.length : '?'} campos`);
  if (!r) return;
  console.log(`   estado: ${r.estado}${r.motivo ? ` — ${r.motivo}` : ''}`);
  for (const a of r.avisos) console.log(`   ⚠️ ${a}`);
  const antes = Array.isArray(clase.campos) ? foco(clase.campos) : clase.campos;
  console.log(`   ANTES:   ${JSON.stringify(antes, null, 2).replace(/\n/g, '\n            ')}`);
  if (r.estado === 'aplicar') console.log(`   DESPUÉS: ${JSON.stringify(foco(r.nuevos), null, 2).replace(/\n/g, '\n            ')}`);
  console.log('');
}

// Corre siempre que se lo llame, SALVO con APLICAR_694_SOLO_IMPORTAR=1: así el test que prueba
// las funciones puras lo importa sin tocar la base. (No se compara `import.meta.url` contra
// `argv[1]`: en Windows la mayúscula de la unidad o un loader pueden hacer que no coincidan, y
// entonces el script no haría NADA sin decirlo.)
if (process.env.APLICAR_694_SOLO_IMPORTAR !== '1') {
  main().catch((e) => { console.error('✖', e instanceof Error ? e.message : e); process.exit(1); });
}
