// =============================================================================
// flujo-copia-negocio — lo de «copiar y pegar un flujo» que necesita la BASE del negocio que pega
// =============================================================================
// El formato y las reglas puras viven en lib/flujo-copia.ts. Acá: qué tiene ESTE negocio (para sacar
// de lo pegado lo que no existe, decisión de Martín: «Pegar y marcar en rojo») y crear una
// automatización entera desde lo copiado (el aviso al entrar a la tab y «Pegar» al crear una nueva).
//
// CREAR DESDE LO COPIADO, con las reglas de la galería (lib/plantilla-crear.ts) y de «Duplicar»:
//   · NACE APAGADA en el workspace de quien pega (la base del inquilino, `getTenantDb`).
//   · Los pasos entran por `setSecuenciaPasos` (la puerta de todo escritor de `pasos`). Si la rechaza,
//     se borra: una automatización con el nombre de la copia y sin sus tarjetas dice ser lo que no es.
//   · El CRON entra por `guardarDisparadores`. Si su etapa no existe acá (otro negocio), NO tumba nada:
//     queda «Elige qué la dispara» y se dice (`aviso`), como en la galería.
//   · Dónde estaba cada tarjeta, por `guardarPosicionesSecuencia` (best-effort: es el dibujo).

import 'server-only';
import { getTenantDb } from './workspace';
import { setSecuenciaPasos, type PasoSecuencia } from './nutricion';
import { guardarDisparadores } from './disparadores-guardar';
import { guardarPosicionesSecuencia, type DbPosiciones } from './secuencia-posiciones';
import { productosConEtapas, TriggerInvalidoError } from './setting-secuencias';
import { nombreLibre } from './plantillas-automatizaciones';
import { emojiDeSecuencia } from './flujo-conversacion';
import { limpiarReferencias, type CopiaFlujo, type Existentes, type PasoCopiado } from './flujo-copia';

/** Lo que tiene este negocio, para limpiar lo pegado. Un error de lectura TIRA: «no pude leer» no es «no hay». */
export async function existentesDelNegocio(): Promise<Existentes> {
  const db = await getTenantDb();
  const ids = async (tabla: string, soloVivas = false) => {
    const q = db.from(tabla).select('id');
    const { data, error } = await (soloVivas ? q.is('archivada_at', null) : q);
    if (error) throw new Error(`existentesDelNegocio (${tabla}): ${error.message}`);
    return new Set(((data ?? []) as Array<{ id: number }>).map((r) => Number(r.id)));
  };
  const [audios, adjuntos, etiquetas, secuencias, lineasR, productos] = await Promise.all([
    ids('setting_audios'),
    ids('setting_adjuntos'),
    ids('crm_etiquetas'),
    ids('nutricion_secuencias', true),
    db.from('evolution_instancias').select('instance_name'),
    productosConEtapas(),
  ]);
  if (lineasR.error) throw new Error(`existentesDelNegocio (líneas): ${lineasR.error.message}`);
  const etapas = new Set<string>();
  for (const p of productos) for (const e of p.etapas) { etapas.add(`${p.funnelId}:${e.value}`); etapas.add(`:${e.value}`); }
  return {
    audios, adjuntos, etiquetas, secuencias, etapas,
    lineas: new Set(((lineasR.data ?? []) as Array<{ instance_name: string }>).map((r) => String(r.instance_name))),
  };
}

/** Lo pegado, sin lo que no existe acá. */
export async function limpiarCopia(copia: CopiaFlujo): Promise<PasoCopiado[]> {
  return limpiarReferencias(copia.pasos, await existentesDelNegocio(), copia.guiones ?? {});
}

export type CreadaDesdeCopia = { id: number; nombre: string; aviso: string | null };

/** Crea la automatización de lo copiado, APAGADA. */
export async function crearDesdeCopia(copia: CopiaFlujo): Promise<CreadaDesdeCopia> {
  const db = await getTenantDb();
  const pasos = await limpiarCopia(copia);
  const { data: vivas, error: errNombres } = await db.from('nutricion_secuencias').select('nombre').is('archivada_at', null);
  if (errNombres) throw new Error(`crearDesdeCopia: ${errNombres.message}`);
  const nombre = nombreLibre(copia.nombre ?? 'Automatización copiada', ((vivas ?? []) as Array<{ nombre: string | null }>).map((r) => String(r.nombre ?? '')));
  const clave = `copia-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: nueva, error: errIns } = await db.from('nutricion_secuencias')
    .insert({ clave, nombre, etapa: 'manual', trigger_tipo: 'manual', activa: false, pasos: [], emoji: emojiDeSecuencia(copia.emoji) })
    .select('id').single();
  if (errIns || !nueva) throw new Error(`crearDesdeCopia: ${errIns?.message ?? 'no se creó'}`);
  const id = (nueva as { id: number }).id;
  try {
    await setSecuenciaPasos(id, pasos as unknown as PasoSecuencia[]);
  } catch (e) {
    await Promise.resolve(db.from('nutricion_secuencias').delete().eq('id', id)).catch(() => {});
    throw e;
  }
  if (copia.posiciones) await guardarPosicionesSecuencia(db as unknown as DbPosiciones, id, copia.posiciones).catch(() => null);
  let aviso: string | null = null;
  if (copia.disparadores?.length) {
    try {
      await guardarDisparadores(id, copia.disparadores);
    } catch (e) {
      if (!(e instanceof TriggerInvalidoError)) throw e;
      aviso = 'Elige qué la dispara: su etapa no está en tu negocio.';
    }
  }
  return { id, nombre, aviso };
}
