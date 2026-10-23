// =============================================================================
// cargar-base-venta — una lista de Martín al CRM «PROSPECCIÓN» del ws9, con su ORIGEN, sin duplicar nunca
// =============================================================================
// Pedido de Martín (22/10/2026): la base de leads para vender MaKo, «con el ORIGEN de cada uno (de la formación de Jan,
// de Mastery House, del evento de Cancún…)» y una clasificación mínima. La clasificación es la que su CRM ya tiene:
// Círculo ROJO (st0) / TIBIO (st1) / FRÍO (st2). El origen va en una etiqueta «Origen: <nombre>», porque `origen_lead`
// es un catálogo cerrado (app/crm/origen-lead.ts) y un texto libre ahí se pinta «Sin origen».
//
// NUNCA DUPLICA (regla de la casa): cada fila se busca con `duplicadosDeLead` (teléfono comparable, email, y el nombre
// sólo si no trae ninguno de los dos), y dentro del archivo con las mismas claves.
//   · Ya está en el CRM → sólo se le suma la etiqueta de origen. No se le cambia la etapa (puede estar conversando).
//   · Es nueva → se crea en PROSPECCIÓN, en la etapa de su círculo, con la etiqueta.
//   · Repetida dentro del archivo → cuenta una vez.
//
// Lee el CSV con el MISMO parser del importador del CRM (`filasDesdeCsv`): nombre, apellido, email, teléfono, empresa.
// Sin `--escribir` es EN SECO: cuenta y muestra, no escribe nada. El ws1 (Mauricio) no se toca nunca.
//
//   node --env-file=<repo>/.env.local --conditions=react-server --import tsx scripts/cargar-base-venta.mts \
//     --archivo lista.csv --origen "Formación de Jan" --circulo tibio [--escribir]
// =============================================================================

import { readFileSync } from 'node:fs';

const base = process.cwd().split(String.fromCharCode(92)).join('/');
const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const escribir = process.argv.includes('--escribir');
const WS = Number(arg('ws') ?? 9);
const CRM = 9; // PROSPECCIÓN, la casa del ws9
const ETAPA_DEL_CIRCULO: Record<string, string> = { rojo: 'st0', tibio: 'st1', frio: 'st2', 'frío': 'st2' };

const archivo = arg('archivo');
const origen = (arg('origen') ?? '').trim();
const circulo = (arg('circulo') ?? '').toLowerCase();
if (WS !== 9) throw new Error('Este script es para el CRM de Martín (ws9). El ws1 no se toca nunca.');
if (!archivo || !origen || !ETAPA_DEL_CIRCULO[circulo]) {
  throw new Error('Uso: --archivo <csv> --origen "<de dónde viene>" --circulo rojo|tibio|frio [--escribir]');
}
const etiquetaNombre = `Origen: ${origen}`.slice(0, 40);
const etapa = ETAPA_DEL_CIRCULO[circulo];

const { runWithWorkspace } = await import(`file:///${base}/lib/workspace.ts`);
const { filasDesdeCsv } = await import(`file:///${base}/app/crm/leads-importar.ts`);
const { createLead, setPipelineStage, duplicadosDeLead } = await import(`file:///${base}/lib/leads.ts`);
const { telefonoComparable, emailComparable } = await import(`file:///${base}/lib/leads-duplicados.ts`);
const { listarEtiquetas, crearEtiqueta, ponerEtiquetaLote } = await import(`file:///${base}/lib/etiquetas.ts`);

const texto = readFileSync(archivo, 'utf8').replace(/^﻿/, '');
const primera = texto.split(/\r?\n/, 1)[0] ?? '';
const delim = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
const { filas, error } = filasDesdeCsv(texto, delim);
if (error) throw new Error(`No pude leer el archivo: ${error}`);

await runWithWorkspace(WS, async () => {
  const vistas = new Set<string>();
  const nuevas: typeof filas = [];
  const existentes = new Map<number, string>();
  let repetidasEnArchivo = 0, sinContacto = 0;

  for (const f of filas) {
    const tel = telefonoComparable(f.telefono), mail = emailComparable(f.email);
    if (!f.nombre.trim() || (!tel && !mail)) { sinContacto++; continue; }
    const claves = [tel && `t:${tel}`, mail && `e:${mail}`].filter(Boolean) as string[];
    if (claves.some((c) => vistas.has(c))) { repetidasEnArchivo++; continue; }
    claves.forEach((c) => vistas.add(c));
    const dup = await duplicadosDeLead({ nombre: f.nombre, email: f.email || null, telefono: f.telefono || null });
    if (dup.length) existentes.set(dup[0].lead.id, f.nombre); else nuevas.push(f);
  }

  console.log(`«${etiquetaNombre}» → ${filas.length} filas · ${nuevas.length} nuevas (a ${circulo.toUpperCase()}) · ${existentes.size} ya están (sólo la etiqueta) · ${repetidasEnArchivo} repetidas en el archivo · ${sinContacto} sin nombre o sin contacto`);
  if (!escribir) { console.log('EN SECO: no escribí nada. Con --escribir, las carga.'); return; }

  const ya = (await listarEtiquetas()).find((e) => e.nombre.trim().toLowerCase() === etiquetaNombre.toLowerCase());
  const etiqueta = ya ?? (await crearEtiqueta({ nombre: etiquetaNombre })).etiqueta;

  const creados: number[] = [];
  for (const f of nuevas) {
    const lead = await createLead({ nombre: f.nombre, email: f.email || null, telefono: f.telefono || null, empresa: f.empresa || null, origen_lead: 'importacion', funnel_id: CRM } as any);
    await setPipelineStage(lead.id, etapa);
    creados.push(lead.id);
  }
  const r = await ponerEtiquetaLote([...creados, ...existentes.keys()], etiqueta.id, { autor: 'Carga de la base de venta' });
  console.log(`Cargado: ${creados.length} creados en ${circulo.toUpperCase()}, ${existentes.size} con la etiqueta sumada · etiqueta #${etiqueta.id} · ${JSON.stringify(r)}`);
});
