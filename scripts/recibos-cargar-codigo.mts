// =============================================================================
// recibos-cargar-codigo — carga al libro los recibos N.º 0001 y 0002 de Código Inmobiliario, que salieron A MANO (5/11/2026)
// =============================================================================
// Los dos salieron el 5/11/2026 a las 16:07 ART por WhatsApp al grupo de Código y por correo, armados a mano (jsPDF 4.2.1). El libro
// (mig 0397) nace con la numeración en 2 para que el próximo sea el 0003; este script deja esos dos ADENTRO, con su número forzado,
// los PDF que de verdad se mandaron (`pdf_path`, con su sha256) y sus comprobantes de Binance. Lo corre el Cerebro desde la PC,
// donde están los archivos (C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario/), DESPUÉS de aplicar la 0397:
//
//   node --conditions=react-server --env-file=C:/dev/mako-api/.env.local --import tsx scripts/recibos-cargar-codigo.mts --dir C:/dev/cerebro-herramientas/cobros/codigo-inmobiliario
//
// y, mirando lo que lista, otra vez con `--aplicar`.
//
// ⚠️ NO MANDA NADA: ni correo, ni WhatsApp. Ya se mandaron: quedan `correo_estado='enviado'` y `wa_estado='enviado'`.
// ⚠️ SIN `--aplicar`, SÓLO LEE Y LISTA: lo que va a cargar, lo que encontró en registro.json y en la carpeta, y el texto de los PDF
//    mandados (para comparar el nombre y los montos con lo de abajo).
// ⚠️ IDEMPOTENTE POR CLAVE: mira la clave ANTES de subir nada (si el recibo ya está, no sube archivos huérfanos); los archivos van
//    con nombre fijo (por la orden) y no se pisan.
// ⚠️ registro.json se leyó sólo de segunda mano (docs/relevo/recibos-encargo.md): esta nube no lo vio. El script lo recorre
//    entero buscando los ids de Resend y los nombres de archivo; lo que no encuentre se pasa a mano con flags (ver `uso`).
// ⚠️ Los 2 USDT de más de octubre NO se toman en cuenta (Martín, 5/11): no son saldo a favor ni salen en el PDF; quedan como
//    `nota_interna` del 0001.
// =============================================================================

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { getSupabaseServer } from '../lib/supabase';
import { wsSuperAdmin } from '../lib/workspace';
import { emisorDe, KEY_EMISOR, sniffComprobante } from '../lib/recibos-reglas';

const arg = (n: string): string | null => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] ?? null : null; };
const args = (n: string): string[] => process.argv.flatMap((a, i) => (a === n ? [process.argv[i + 1] ?? ''] : []));
const flag = (n: string): boolean => process.argv.includes(n);

const uso = `uso: … scripts/recibos-cargar-codigo.mts --dir <carpeta> [--aplicar]
  [--a-nombre "Código Inmobiliario"]           cómo sale el nombre (se compara con el de los PDF mandados)
  [--pdf 1=<archivo.pdf>] [--pdf 2=<archivo.pdf>]     si no se encuentran solos por su número
  [--comprobante <orden>=<archivo.png>]           uno por orden, si no se encuentran solos
  [--correo-id 1=<id de Resend>] [--correo-id 2=<id>]  si no están en registro.json
  [--correo <email>]                               a quién se mandó el correo (registro.json no lo trae)`;

const DIR = arg('--dir');
const APLICAR = flag('--aplicar');
if (!DIR || !existsSync(DIR) || !statSync(DIR).isDirectory()) { console.error(`Falta --dir con la carpeta de Código.\n${uso}`); process.exit(2); }

const ZONA = 'America/Argentina/Buenos_Aires';
const WS_CODIGO = 13;
const EMITIDO_AT = '2026-11-05T19:07:00Z'; // 16:07 ART: el envío a mano (grupo_mensajes 66 y 67).

type Pago = { orden: string; fecha: string; monto: number; de: string | null };
type Recibo = { numero: 1 | 2; clave: string; mes: string; lineas: Array<{ concepto: string; mes: string; monto: number; moneda: string }>; pagos: Pago[]; notaPdf: string | null; notaInterna: string | null; totalEsperado: string };

// Lo que dice el encargo (docs/relevo/recibos-encargo.md §17), con los nombres como salieron en el PDF 0002 («Arratia», «Natalia
// Krywyj»): la base dice «Arriata» y «Natalia», y está mal. Se comparan abajo contra el texto de los PDF mandados.
const RECIBOS: Recibo[] = [
  {
    numero: 1, clave: 'mensualidad:13:2026-10', mes: '2026-10',
    lineas: [
      { concepto: 'Plan Pro', mes: 'octubre', monto: 97, moneda: 'USD' },
      { concepto: 'Brigitte', mes: 'octubre', monto: 47, moneda: 'USD' },
    ],
    pagos: [{ orden: '461213098188603392', fecha: '2026-10-21T15:04:45-03:00', monto: 146, de: 'JZ_' }],
    notaPdf: null,
    notaInterna: 'Los 2 USDT de más no se toman en cuenta (Martín, 5/11).',
    totalEsperado: '146',
  },
  {
    numero: 2, clave: 'mensualidad:13:2026-11', mes: '2026-11',
    lineas: [
      { concepto: 'Plan Pro', mes: 'noviembre', monto: 97, moneda: 'USD' },
      { concepto: 'Brigitte', mes: 'noviembre', monto: 47, moneda: 'USD' },
      { concepto: 'Natalia Krywyj', mes: 'noviembre', monto: 47, moneda: 'USD' },
      { concepto: 'Sergio Arratia', mes: 'noviembre', monto: 47, moneda: 'USD' },
    ],
    pagos: [
      { orden: '463869660353134592', fecha: '2026-11-04T22:42:23-03:00', monto: 94, de: null },
      { orden: '463975050149208064', fecha: '2026-11-05T12:20:19-03:00', monto: 144, de: null },
    ],
    notaPdf: 'Cubre hasta el 4/12/2026. Desde el 5/12 entra en el pago de diciembre.',
    notaInterna: null,
    totalEsperado: '238',
  },
];

// ── Lo que hay en la carpeta y en registro.json ──────────────────────────────────────────────────────────────────

const archivos = readdirSync(DIR).filter((f) => statSync(path.join(DIR, f)).isFile());
const registroPath = path.join(DIR, 'registro.json');
let registro: unknown = null;
if (existsSync(registroPath)) {
  try { registro = JSON.parse(readFileSync(registroPath, 'utf8')); } catch (e) { console.error(`registro.json no es JSON: ${e instanceof Error ? e.message : e}`); }
}

/** Todos los strings de registro.json, con el camino de claves que lleva a cada uno (para ver de qué recibo es). */
function stringsDe(v: unknown, camino: string[] = [], out: Array<{ camino: string; valor: string }> = []): Array<{ camino: string; valor: string }> {
  if (typeof v === 'string') out.push({ camino: camino.join('.'), valor: v });
  else if (Array.isArray(v)) v.forEach((x, i) => stringsDe(x, [...camino, String(i)], out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) stringsDe(x, [...camino, k], out);
  return out;
}
const todos = stringsDe(registro);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Los objetos de registro.json que son de ESTE recibo: los que tienen, como valor propio, su número («0001», «N.º 0001», 1 en una
 * clave `numero`/`recibo`). De ahí salen los ids de Resend (los uuid de adentro).
 */
function objetosDelRecibo(n: 1 | 2, v: unknown = registro, out: unknown[] = []): unknown[] {
  if (Array.isArray(v)) { v.forEach((x) => objetosDelRecibo(n, x, out)); return out; }
  if (!v || typeof v !== 'object') return out;
  const propio = Object.entries(v as Record<string, unknown>).some(([k, x]) =>
    (typeof x === 'string' && new RegExp(`(^|[^0-9])000${n}([^0-9]|$)`).test(x)) || (typeof x === 'number' && x === n && /numero|recibo|nro/i.test(k)));
  if (propio) out.push(v);
  else for (const x of Object.values(v as Record<string, unknown>)) objetosDelRecibo(n, x, out);
  return out;
}

const pares = (n: string): Map<string, string> => new Map(args(n).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)] as [string, string]; }).filter(([a, b]) => a && b));
const pdfFlag = pares('--pdf');
const compFlag = pares('--comprobante');
const idFlag = pares('--correo-id');

function pdfDe(n: 1 | 2): string | null {
  const f = pdfFlag.get(String(n));
  if (f) return path.isAbsolute(f) ? f : path.join(DIR!, f);
  const c = archivos.filter((a) => /\.pdf$/i.test(a) && new RegExp(`000${n}`).test(a));
  return c.length === 1 ? path.join(DIR!, c[0]) : null;
}
function comprobanteDe(orden: string): string | null {
  const f = compFlag.get(orden);
  if (f) return path.isAbsolute(f) ? f : path.join(DIR!, f);
  const c = archivos.filter((a) => /\.(png|jpe?g)$/i.test(a) && a.includes(orden));
  return c.length === 1 ? path.join(DIR!, c[0]) : null;
}
function correoIdDe(n: 1 | 2): string | null {
  const f = idFlag.get(String(n));
  if (f) return f;
  const dentro = objetosDelRecibo(n).flatMap((o) => stringsDe(o)).filter((x) => UUID_RE.test(x.valor));
  const deCorreo = [...new Set(dentro.filter((x) => /resend|correo|email|mail/i.test(x.camino)).map((x) => x.valor))];
  const todosIds = [...new Set(dentro.map((x) => x.valor))];
  return deCorreo.length === 1 ? deCorreo[0] : todosIds.length === 1 ? todosIds[0] : null;
}

async function textoDelPdf(p: string): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf');
  const { text } = await extractText(await getDocumentProxy(new Uint8Array(readFileSync(p))), { mergePages: true });
  return (Array.isArray(text) ? text.join('\n') : text).replace(/\s+/g, ' ');
}

// ── Listar ────────────────────────────────────────────────────────────────────────────────────────────────────

const aNombre = arg('--a-nombre') ?? 'Código Inmobiliario';
const correoA = arg('--correo')?.trim().toLowerCase() ?? null;
console.log(`Carpeta: ${DIR}`);
console.log(`Archivos: ${archivos.join(', ') || '(ninguno)'}`);
console.log(registro == null ? 'registro.json: no está o no se pudo leer.' : `registro.json: ${todos.length} textos; claves de arriba: ${Object.keys(registro as object).join(', ')}`);

type Listo = { r: Recibo; pdf: string; pdfBytes: Buffer; comprobantes: Map<string, { path: string; bytes: Buffer; mime: 'image/png' | 'image/jpeg' }>; correoId: string | null; textoPdf: string };
const listos: Listo[] = [];
let faltan = 0;
for (const r of RECIBOS) {
  console.log(`\n── Recibo N.º 000${r.numero} (${r.clave}) ──`);
  const pdf = pdfDe(r.numero);
  if (!pdf || !existsSync(pdf)) { console.log(`  ✗ no encontré el PDF mandado: pásalo con --pdf ${r.numero}=<archivo>`); faltan++; continue; }
  const pdfBytes = readFileSync(pdf);
  const textoPdf = await textoDelPdf(pdf).catch((e) => { console.log(`  ✗ no pude leer el PDF: ${e instanceof Error ? e.message : e}`); return ''; });
  console.log(`  PDF: ${path.basename(pdf)} (${pdfBytes.length} bytes)`);
  const i = textoPdf.indexOf('Recibimos de');
  console.log(`  En el PDF: «${i >= 0 ? textoPdf.slice(i, i + 90) : textoPdf.slice(0, 90)}…»`);
  console.log(`  Se carga a nombre de «${aNombre}»${textoPdf.includes(aNombre) ? '' : '  ⚠️ ese nombre NO aparece igual en el PDF: usa --a-nombre'}`);
  console.log(`  Total esperado ${r.totalEsperado} USDT: ${textoPdf.includes(r.totalEsperado) ? 'está en el PDF' : '⚠️ NO lo encontré en el PDF'}`);
  for (const l of r.lineas) console.log(`  Renglón: ${l.concepto} · ${l.mes} · ${l.monto} ${l.moneda}${textoPdf.includes(l.concepto) ? '' : '  ⚠️ el concepto no aparece igual en el PDF'}`);
  const comprobantes = new Map<string, { path: string; bytes: Buffer; mime: 'image/png' | 'image/jpeg' }>();
  for (const p of r.pagos) {
    const c = comprobanteDe(p.orden);
    const bytes = c && existsSync(c) ? readFileSync(c) : null;
    const mime = bytes ? sniffComprobante(new Uint8Array(bytes)) : null;
    console.log(`  Pago ${p.orden}: ${p.monto} USDT, ${p.fecha}${textoPdf.includes(p.orden) ? '' : '  ⚠️ la orden no aparece en el PDF'} · comprobante ${c ? path.basename(c) : '✗ no encontrado (--comprobante <orden>=<archivo>)'}${c && !mime ? ' ✗ no es PNG ni JPEG' : ''}`);
    if (!bytes || !mime) { faltan++; continue; }
    comprobantes.set(p.orden, { path: c!, bytes, mime });
  }
  const correoId = correoIdDe(r.numero);
  console.log(`  Correo: ${correoId ?? '⚠️ no encontré el id de Resend en registro.json (--correo-id N=<id>); se carga sin él'}${correoA ? ` · a ${correoA}` : ''}`);
  if (r.notaInterna) console.log(`  Nota interna: ${r.notaInterna}`);
  if (r.notaPdf) console.log(`  Nota del PDF: ${r.notaPdf}${textoPdf.includes('Cubre hasta') ? '' : '  ⚠️ no la encontré en el PDF'}`);
  listos.push({ r, pdf, pdfBytes, comprobantes, correoId, textoPdf });
}

if (!APLICAR) {
  console.log(`\nSólo leí. ${faltan ? `Faltan ${faltan} archivo(s): no se puede aplicar todavía.` : 'Para cargarlos: lo mismo con --aplicar.'}`);
  process.exit(faltan ? 1 : 0);
}
if (faltan) { console.error(`\nFaltan ${faltan} archivo(s): no aplico nada.`); process.exit(1); }

// ── Aplicar ──────────────────────────────────────────────────────────────────────────────────────────────────

const db = getSupabaseServer();
const plataforma = await wsSuperAdmin();
const { data: em, error: eEm } = await db.from('app_settings').select('value').eq('workspace_id', plataforma).eq('key', KEY_EMISOR).maybeSingle();
if (eEm) { console.error(`No pude leer los datos del recibo: ${eEm.message}`); process.exit(1); }
const emisor = emisorDe((em as { value?: unknown } | null)?.value ?? null);

async function subir(p: string, bytes: Buffer, mime: string): Promise<void> {
  const { error } = await db.storage.from('contratos').upload(p, bytes, { contentType: mime, upsert: false });
  if (error && !/exists|duplicate/i.test(error.message)) throw new Error(`No pude subir ${p}: ${error.message}`);
}

for (const l of listos) {
  const { r } = l;
  // La clave PRIMERO: si ya está, no se sube nada (sin archivos huérfanos).
  const { data: ya, error: eYa } = await db.from('recibos').select('id, numero').eq('clave', r.clave).neq('estado', 'anulado').maybeSingle();
  if (eYa) { console.error(`No pude mirar la clave ${r.clave}: ${eYa.message}`); process.exit(1); }
  if (ya) { console.log(`N.º 000${r.numero}: ya estaba (recibo ${String((ya as { numero: number }).numero).padStart(4, '0')}). No toco nada.`); continue; }
  const pdfPath = `plataforma/recibos/pdf/manual-000${r.numero}.pdf`;
  await subir(pdfPath, l.pdfBytes, 'application/pdf');
  const pagos = [];
  for (const p of r.pagos) {
    const c = l.comprobantes.get(p.orden)!;
    const cp = `plataforma/recibos/comprobantes/codigo-${p.orden}.${c.mime === 'image/png' ? 'png' : 'jpg'}`;
    await subir(cp, c.bytes, c.mime);
    pagos.push({ medio: 'binance', referencia: p.orden, fecha: new Date(p.fecha).toISOString(), monto: p.monto, moneda: 'USDT', monto_usd: p.monto, de: p.de, comprobante_path: cp, comprobante_nombre: path.basename(c.path) });
  }
  const { data, error } = await db.rpc('emitir_recibo', {
    p: {
      numero: r.numero, clave: r.clave, origen: 'manual', paga: 'manual', solo_correo: false, destino_ws: WS_CODIGO, a_nombre: aNombre, mes: r.mes,
      lineas: r.lineas, pagos, nota_pdf: r.notaPdf, nota_interna: r.notaInterna, emisor, zona: ZONA,
      pdf_path: pdfPath, pdf_sha256: createHash('sha256').update(l.pdfBytes).digest('hex'),
      fecha_pago: new Date(r.pagos[r.pagos.length - 1].fecha).toISOString(), emitido_por: 'Cerebro (cargado a mano)', emitido_at: EMITIDO_AT,
      correo_estado: 'enviado', ...(l.correoId ? { correo_ids: [l.correoId] } : {}), ...(correoA ? { correo_a: [correoA] } : {}), correo_at: EMITIDO_AT,
      wa_estado: 'enviado', wa_ws: WS_CODIGO, wa_at: EMITIDO_AT,
      historial: [{ at: new Date().toISOString(), que: 'Salió a mano el 5/11/2026 (WhatsApp y correo); cargado al libro por el script' }],
    },
  });
  if (error) { console.error(`N.º 000${r.numero}: ${error.message}`); process.exit(1); }
  const f = (Array.isArray(data) ? data[0] : data) as { numero: number; ya_estaba: boolean };
  console.log(`N.º 000${r.numero}: ${f.ya_estaba ? 'ya estaba' : 'cargado'} (número ${f.numero}). No se mandó nada.`);
}
const { data: num } = await db.from('recibos_numeracion').select('ultimo').maybeSingle();
console.log(`\nEl próximo recibo es el ${String(Number((num as { ultimo?: number } | null)?.ultimo ?? 0) + 1).padStart(4, '0')}.`);
