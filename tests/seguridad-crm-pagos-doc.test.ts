// =============================================================================
// CRM: un lead de OTRO negocio no recibe cuotas, y un documento sólo se firma si es de ESTE lead
// =============================================================================
// Auditoría de seguridad del 14/10/2026 (paquete g3). Dos agujeros, los dos sin un solo error a la vista:
//
// 1) PAGOS. `getTenantDb` estampa el workspace en el insert, pero `pagos.lead_id` sólo tiene FK a `leads(id)` y
//    el índice único (lead_id, numero) es GLOBAL. Con el id de un lead de otro negocio (los ids son secuenciales),
//    saveCuotasAction / registrarPagoSuelto / cobrarCuota / saveLeadPlanManual dejaban una cuota en ESTE cash
//    apuntando a una persona ajena; el join `leads(nombre, monto_cierre_usd, …)` de Outstanding y de las alertas
//    traía su nombre y su monto; y el dueño real ya no podía numerar sus cuotas (el insert chocaba). La regla:
//    `asegurarLeadDelNegocio(leadId)` (lib/pagos.ts) antes de escribir en `pagos`.
// 2) DOCUMENTOS. /api/doc (y /api/contract) firmaban con la service role la ruta guardada en el lead, y
//    deal_fiscal.doc_path lo escribía el navegador (saveDealSectionsAction guardaba deal_fiscal ENTERO). El
//    prefijo `<ws>/<lead>/` solo no alcanzaba: storage-js arma `…/object/sign/contratos/${path}` y fetch normaliza
//    `..` y `%2e%2e`, así que `5/60/../../7/50/x.pdf` firmaba lo de otro negocio (o de otro bucket).
//
// Cómo se prueba: lo de verdad se EJECUTA. Este mismo archivo, con SEG_PAGOS_DOC_HIJO=1, corre en un node aparte
// con `--conditions=react-server` (lib/pagos.ts lleva `server-only`; el precedente es tests/_cobros-conexion-hijo.ts)
// y llama a las funciones reales con un `fetch` de mentira que hace de PostgREST y de Storage. Además: los casos
// de la validación de rutas, y una regla sobre el fuente para el próximo escritor de `pagos`.
//
// Probado ROMPIÉNDOLO (14/10/2026), una rotura por vez, restaurando de memoria (nunca git). Con el código como
// está: 6 pases, 0 fallos. Rota (pases / fallos):
//   · asegurarLeadDelNegocio sin el `if (!data) throw`                                   → 4 / 2
//   · sin la guarda en saveLeadPlanManual (lo mismo en cobrarCuota, registrarPagoSuelto,
//     registrarCobroDeProveedor y saveCuotasAction, cada una por separado)                → 4 / 2
//   · sin la guarda en savePlanPagos (queda su `.single()`: corta, pero por accidente)     → 4 / 2
//   · saveDealSectionsAction con `upd.deal_fiscal = patch.deal_fiscal` (como antes)        → 5 / 1
//   · saveDealSectionsAction sin el `if (!enBase) throw`                                   → 5 / 1
//   · /api/doc sin validar la ruta (lo mismo /api/contract)                                → 5 / 1
//   · /api/doc sólo con el prefijo `<ws>/<lead>/`, el arreglo que proponía la auditoría
//     (lo mismo /api/contract): firma `contratos/7/50/…` y `wa-media/…`                    → 4 / 2
//   Con el formato viejo del contrato (`<lead>/…`, revisión del 14/10: el del lead 31 del ws1 es así):
//   · rutaDeEsteLead aceptando el legado SIEMPRE (sin mirar aceptaLegado)                → 5 / 1
//   · rutaDeEsteLead sin el legado (como lo dejó la auditoría)                           → 5 / 1
//   · /api/doc pidiendo el legado también para el doc fiscal (`true` en vez del kind)    → 5 / 1
//   · /api/contract sin pedirlo                                                          → 5 / 1
//   Restaurado: 6 / 0.
// Correr: node --import tsx --test tests/seguridad-crm-pagos-doc.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import ts from 'typescript';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

// Los dos negocios del escenario. El atacante opera en A; el lead 50 es de B; el 60 es de A.
const WS_A = 5;
const WS_B = 7;
const LEAD_AJENO = 50;
const LEAD_PROPIO = 60;
const DOC_AJENO = `${WS_B}/${LEAD_AJENO}/fiscal/1700000000000_constancia.pdf`;
const DOC_PROPIO = `${WS_A}/${LEAD_PROPIO}/fiscal/1700000000001_mio.pdf`;

// ─────────────────────────────────────────────────────────────────────────────
// El HIJO: corre lo real contra una base de mentira y contesta un JSON
// ─────────────────────────────────────────────────────────────────────────────

type Fila = Record<string, unknown>;
type Corrida = { error: string | null; escrituras: string[]; firmadas: string[]; valor?: unknown };

async function hijo(): Promise<void> {
  let db: Record<string, Fila[]> = {};
  let escrituras: string[] = [];
  let firmadas: string[] = [];
  let proximoId = 1000;

  const json = (status: number, body: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  function cumple(f: Fila, u: URL): boolean {
    for (const [k, v] of u.searchParams) {
      if (['select', 'order', 'limit', 'columns', 'on_conflict'].includes(k)) continue;
      if (v.startsWith('eq.') && String(f[k]) !== v.slice(3)) return false;
      if (v.startsWith('neq.') && String(f[k]) === v.slice(4)) return false;
      if (v === 'is.null' && f[k] != null) return false;
      if (v.startsWith('in.(') && !v.slice(4, -1).split(',').includes(String(f[k]))) return false;
    }
    return true;
  }
  const quien = (f: Fila) => `lead=${String(f.lead_id ?? f.id)} ws=${String(f.workspace_id)}`;

  async function postgrest(u: URL, init: RequestInit): Promise<Response> {
    const tabla = u.pathname.replace('/rest/v1/', '');
    const filas = (db[tabla] ??= []);
    const metodo = (init.method ?? 'GET').toUpperCase();
    const h = new Headers(init.headers);
    const uno = (h.get('Accept') ?? '').includes('vnd.pgrst.object');
    const devolver = (h.get('Prefer') ?? '').includes('return=representation');
    const responder = (rs: Fila[]) => {
      if (!uno) return json(200, rs);
      return rs.length === 1 ? json(200, rs[0]) : json(406, { code: 'PGRST116', message: `${rs.length} filas` });
    };
    if (metodo === 'GET') return responder(filas.filter((f) => cumple(f, u)));
    if (metodo === 'DELETE') {
      escrituras.push(`DELETE ${tabla}`);
      db[tabla] = filas.filter((f) => !cumple(f, u));
      return json(204, undefined);
    }
    if (metodo === 'PATCH') {
      const cambios = JSON.parse(String(init.body ?? '{}')) as Fila;
      const tocadas = filas.filter((f) => cumple(f, u));
      for (const f of tocadas) Object.assign(f, cambios);
      escrituras.push(`PATCH ${tabla} (${tocadas.length})`);
      return devolver ? responder(tocadas) : json(204, undefined);
    }
    // POST: insert o upsert. El índice único (lead_id, numero) de `pagos` es GLOBAL, como en prod.
    const cuerpo = JSON.parse(String(init.body ?? 'null')) as Fila | Fila[];
    const nuevas: Fila[] = [];
    for (const fila of Array.isArray(cuerpo) ? cuerpo : [cuerpo]) {
      escrituras.push(`POST ${tabla} ${quien(fila)}`);
      if (tabla === 'pagos' && filas.some((f) => f.lead_id === fila.lead_id && f.numero === fila.numero)) {
        return json(409, { code: '23505', message: 'duplicate key value violates unique constraint "idx_pagos_lead_numero"' });
      }
      const nueva = { id: proximoId++, ...fila };
      filas.push(nueva);
      nuevas.push(nueva);
    }
    return devolver ? responder(nuevas) : json(201, undefined);
  }

  globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
    // `new URL` normaliza `..` y `%2e%2e` igual que el fetch de verdad: lo que se anota es lo que se FIRMARÍA.
    const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (u.host !== 'supa.test') throw new Error(`fetch sin mock: ${u.href}`);
    if (u.pathname.startsWith('/rest/v1/')) return postgrest(u, init);
    if (u.pathname.startsWith('/storage/v1/object/sign/')) {
      firmadas.push(u.pathname);
      return json(200, { signedURL: `${u.pathname.replace('/storage/v1', '')}?token=prueba` });
    }
    throw new Error(`fetch sin mock: ${u.href}`);
  }) as typeof fetch;

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

  const pagos = await import('../lib/pagos');
  const acciones = await import('../app/crm/[id]/deal-actions');
  const rutaDoc = await import('../app/api/doc/route');
  const rutaContrato = await import('../app/api/contract/route');
  const { runWithWorkspace } = await import('../lib/workspace');

  function sembrar() {
    proximoId = 1000;
    db = {
      leads: [
        { id: LEAD_AJENO, workspace_id: WS_B, nombre: 'De otro negocio', estado_lead: 'ganado', fecha_cierre: '2026-09-01',
          deal_fiscal: { razon: 'Ajena SA', doc_path: DOC_AJENO, doc_nombre: 'constancia.pdf' },
          contrato_path: `${WS_B}/${LEAD_AJENO}/1700000000000_contrato.pdf`, contrato_nombre: 'contrato.pdf' },
        { id: LEAD_PROPIO, workspace_id: WS_A, nombre: 'Propia', estado_lead: 'ganado', fecha_cierre: '2026-09-01',
          deal_fiscal: { razon: 'Vieja SA', doc_path: DOC_PROPIO, doc_nombre: 'mio.pdf' },
          contrato_path: `${WS_A}/${LEAD_PROPIO}/1700000000001_contrato.pdf`, contrato_nombre: 'contrato.pdf' },
      ],
      pagos: [
        // Una fila cruzada como las que dejaba el agujero: workspace A, lead de B.
        { id: 900, workspace_id: WS_A, lead_id: LEAD_AJENO, numero: 1, monto_usd: 100, pagado: false, fecha_esperada: '2026-11-01' },
        { id: 901, workspace_id: WS_B, lead_id: LEAD_AJENO, numero: 2, monto_usd: 100, pagado: false, fecha_esperada: '2026-12-01' },
        { id: 910, workspace_id: WS_A, lead_id: LEAD_PROPIO, numero: 1, monto_usd: 100, pagado: false, fecha_esperada: '2026-11-01',
          comprobante_path: `${WS_A}/${LEAD_PROPIO}/comprobantes/1700000000002_recibo.jpg` },
      ],
    };
    escrituras = [];
    firmadas = [];
  }

  const R: Record<string, Corrida> = {};
  async function correr(nombre: string, fn: () => Promise<unknown>, preparar?: () => void) {
    sembrar();
    preparar?.();
    let error: string | null = null;
    let valor: unknown;
    try { valor = await runWithWorkspace(WS_A, fn); } catch (e) { error = e instanceof Error ? e.message : String(e); }
    R[nombre] = { error, escrituras, firmadas, valor };
  }
  const leadEnBase = (id: number) => db.leads.find((l) => l.id === id);
  const fecha = '2026-10-14';

  // ── Un lead de OTRO negocio: nada se escribe ──────────────────────────────
  await correr('ajeno.saveLeadPlanManual', () => pagos.saveLeadPlanManual(LEAD_AJENO, {
    total_usd: null, duracion_meses: null, fecha_cierre: null, fecha_inicio: null,
    cuotas: [{ monto_usd: 1, fecha_esperada: '2026-12-01' }],
  }));
  await correr('ajeno.registrarPagoSuelto', () => pagos.registrarPagoSuelto(LEAD_AJENO, { monto: 1, fecha }));
  await correr('ajeno.cobrarCuota', () => pagos.cobrarCuota(900, LEAD_AJENO, { monto: 40, fecha }));
  await correr('ajeno.savePlanPagos', () => pagos.savePlanPagos(LEAD_AJENO, { cobro_inicial_usd: 0, monto_cuota_usd: 10, total_cuotas: 2, dia_de_pago: 5 }));
  await correr('ajeno.registrarCobroDeProveedor', () => pagos.registrarCobroDeProveedor({
    leadId: LEAD_AJENO, cobroId: 1, proveedor: 'stripe', proveedorPagoId: 'pi_prueba', montoUsd: 10, montoOriginal: 10, moneda: 'USD', fechaPago: fecha,
  }));
  await correr('ajeno.saveCuotasAction', () => acciones.saveCuotasAction(LEAD_AJENO, [{ monto: 1, fecha: '2026-12-01', pagado: true }]));
  await correr('ajeno.saveDealSectionsAction', () => acciones.saveDealSectionsAction(LEAD_AJENO, { deal_fiscal: { razon: 'x' } }));

  // ── El lead PROPIO sigue andando como siempre ─────────────────────────────
  await correr('propio.saveLeadPlanManual', () => pagos.saveLeadPlanManual(LEAD_PROPIO, {
    total_usd: null, duracion_meses: null, fecha_cierre: null, fecha_inicio: null,
    cuotas: [{ monto_usd: 50, fecha_esperada: '2026-12-01' }],
  }));
  await correr('propio.registrarPagoSuelto', () => pagos.registrarPagoSuelto(LEAD_PROPIO, { monto: 25, fecha }));
  // El documento lo pone la base: un doc_path armado a mano, y la foto vieja de la pantalla (sin el documento).
  await correr('propio.fiscalArmado', async () => {
    try {
      await acciones.saveDealSectionsAction(LEAD_PROPIO, { deal_fiscal: { razon: 'Nueva SA', doc_path: DOC_AJENO, doc_nombre: 'constancia.pdf' } });
    } catch (e) {
      // revalidatePath necesita el runtime de Next: corre DESPUÉS de escribir, y acá no hay Next.
      if (!/static generation store/.test(e instanceof Error ? e.message : '')) throw e;
    }
    return leadEnBase(LEAD_PROPIO)?.deal_fiscal;
  });
  await correr('propio.fiscalFotoVieja', async () => {
    try {
      await acciones.saveDealSectionsAction(LEAD_PROPIO, { deal_fiscal: { razon: 'Foto vieja SA' } });
    } catch (e) {
      if (!/static generation store/.test(e instanceof Error ? e.message : '')) throw e;
    }
    return leadEnBase(LEAD_PROPIO)?.deal_fiscal;
  });

  // ── Firmar: sólo rutas de ESTE lead en ESTE negocio ───────────────────────
  const pedir = async (ruta: { GET: (r: never) => Promise<Response> }, url: string) => {
    const res = await ruta.GET({ nextUrl: new URL(url) } as never);
    return { status: res.status, location: res.headers.get('location') };
  };
  const conFiscal = (doc_path: string) => () => { (leadEnBase(LEAD_PROPIO)!.deal_fiscal as Fila).doc_path = doc_path; };
  const fiscal = `http://mako.test/api/doc?leadId=${LEAD_PROPIO}&kind=fiscal`;
  await correr('doc.propio', () => pedir(rutaDoc, fiscal));
  await correr('doc.ajeno', () => pedir(rutaDoc, fiscal), conFiscal(DOC_AJENO));
  await correr('doc.puntos', () => pedir(rutaDoc, fiscal), conFiscal(`${WS_A}/${LEAD_PROPIO}/../../${DOC_AJENO}`));
  await correr('doc.puntosCodificados', () => pedir(rutaDoc, fiscal), conFiscal(`${WS_A}/${LEAD_PROPIO}/%2e%2e/%2E%2e/${DOC_AJENO}`));
  await correr('doc.otroBucket', () => pedir(rutaDoc, fiscal), conFiscal(`${WS_A}/${LEAD_PROPIO}/../../../wa-media/${WS_B}/inst/ABC.ogg`));
  await correr('doc.contratoAjeno', () => pedir(rutaDoc, `http://mako.test/api/doc?leadId=${LEAD_PROPIO}&kind=contrato`),
    () => { leadEnBase(LEAD_PROPIO)!.contrato_path = `${WS_B}/${LEAD_AJENO}/1700000000000_contrato.pdf`; });
  await correr('doc.comprobantePropio', () => pedir(rutaDoc, `http://mako.test/api/doc?leadId=${LEAD_PROPIO}&kind=comprobante&pagoId=910`));
  await correr('doc.comprobanteAjeno', () => pedir(rutaDoc, `http://mako.test/api/doc?leadId=${LEAD_PROPIO}&kind=comprobante&pagoId=910`),
    () => { db.pagos.find((p) => p.id === 910)!.comprobante_path = `${WS_A}/${LEAD_PROPIO}/comprobantes/../../../${WS_B}/${LEAD_AJENO}/x.jpg`; });
  await correr('contrato.propio', () => pedir(rutaContrato, `http://mako.test/api/contract?leadId=${LEAD_PROPIO}`));
  await correr('contrato.puntos', () => pedir(rutaContrato, `http://mako.test/api/contract?leadId=${LEAD_PROPIO}`),
    () => { leadEnBase(LEAD_PROPIO)!.contrato_path = `${WS_A}/${LEAD_PROPIO}/../../${WS_B}/${LEAD_AJENO}/1700000000000_contrato.pdf`; });

  process.stdout.write(`@@RESULTADO@@${JSON.stringify(R)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// El PADRE: los tests
// ─────────────────────────────────────────────────────────────────────────────

if (process.env.SEG_PAGOS_DOC_HIJO === '1') {
  hijo().catch((e) => { process.stdout.write(`@@ERROR@@${e instanceof Error ? e.stack : String(e)}`); });
} else {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', 'seguridad-crm-pagos-doc.test.ts')], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
    env: { ...process.env, SEG_PAGOS_DOC_HIJO: '1' },
  });
  if (salida.includes('@@ERROR@@')) throw new Error(`el hijo se cayó: ${salida.slice(salida.indexOf('@@ERROR@@'))}`);
  const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Corrida>;

  // Saca una función top-level del fuente real y la vuelve llamable (molde: tests/lead-funnel-ficha.test.ts).
  function traer<T>(rel: string, nombre: string): T {
    const src = leer(rel);
    const ini = src.indexOf(`function ${nombre}(`);
    assert.ok(ini >= 0, `${nombre}() ya no está en ${rel}: el test quedó viejo`);
    const fin = src.indexOf('\n}\n', ini);
    const js = ts.transpileModule(src.slice(ini, fin + 2), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    // eslint-disable-next-line no-new-func
    return new Function(`${js}; return ${nombre};`)() as T;
  }

  test('un lead de OTRO negocio: ningún escritor de pagos le escribe nada, ni la ficha ni la pasarela', () => {
    const ajenos = Object.keys(R).filter((k) => k.startsWith('ajeno.'));
    assert.equal(ajenos.length, 7, 'faltan escenarios del lead ajeno');
    for (const k of ajenos) {
      assert.match(R[k].error ?? '', /No encontré (ese|este) lead/, `${k}: tenía que cortar con «no encontré el lead», y dio ${R[k].error}`);
      // Lo que importa: NADA escrito. Ni la cuota (la fila cruzada), ni el lead, ni el historial.
      assert.deepEqual(R[k].escrituras, [], `${k} escribió con un lead de otro negocio: ${R[k].escrituras.join(' · ')}`);
    }
  });

  test('el lead PROPIO sigue cobrando como siempre (la guarda no le corta el paso al dueño)', () => {
    for (const k of ['propio.saveLeadPlanManual', 'propio.registrarPagoSuelto']) {
      assert.equal(R[k].error, null, `${k} falló con su propio lead: ${R[k].error}`);
      assert.ok(R[k].escrituras.includes(`POST pagos lead=${LEAD_PROPIO} ws=${WS_A}`), `${k} no insertó la cuota: ${R[k].escrituras.join(' · ')}`);
    }
    assert.ok(R['propio.registrarPagoSuelto'].escrituras.includes('PATCH pagos (1)'), 'el pago suelto se inserta y se MARCA cobrado');
  });

  test('el documento fiscal lo pone la base, no el navegador (y una foto vieja ya no lo borra)', () => {
    const armado = R['propio.fiscalArmado'];
    assert.equal(armado.error, null, String(armado.error));
    assert.deepEqual(armado.valor, { razon: 'Nueva SA', doc_path: DOC_PROPIO, doc_nombre: 'mio.pdf' }, 'el doc_path armado a mano llegó a la base');
    const vieja = R['propio.fiscalFotoVieja'];
    assert.equal(vieja.error, null, String(vieja.error));
    assert.deepEqual(vieja.valor, { razon: 'Foto vieja SA', doc_path: DOC_PROPIO, doc_nombre: 'mio.pdf' }, 'guardar sin el documento lo borró');

    // Los bordes, con la función recortada del fuente.
    type F = { razon?: string | null; doc_path?: string | null; doc_nombre?: string | null } | null | undefined;
    const fiscalConDocDeLaBase = traer<(nuevo: unknown, enBase: F) => F>('app/crm/[id]/deal-actions.ts', 'fiscalConDocDeLaBase');
    const enBase = { razon: 'Vieja SA', doc_path: DOC_PROPIO, doc_nombre: 'mio.pdf' };
    assert.deepEqual(fiscalConDocDeLaBase({ razon: 'X', doc_path: DOC_AJENO, doc_nombre: 'y.pdf' }, null), { razon: 'X' }, 'sin documento en la base, el del navegador no entra');
    assert.deepEqual(fiscalConDocDeLaBase({ razon: 'X', doc_path: DOC_AJENO }, { doc_path: null }), { razon: 'X' });
    assert.deepEqual(fiscalConDocDeLaBase(null, enBase), { doc_path: DOC_PROPIO, doc_nombre: 'mio.pdf' }, 'vaciar la sección no borra el documento');
    assert.equal(fiscalConDocDeLaBase(null, null), null);
    assert.throws(() => fiscalConDocDeLaBase('7/50/x.pdf', enBase), /Datos fiscales inválidos/);
    assert.throws(() => fiscalConDocDeLaBase([DOC_AJENO], enBase), /Datos fiscales inválidos/);
  });

  test('/api/doc y /api/contract firman SÓLO rutas de este lead en este negocio', () => {
    for (const k of ['doc.propio', 'doc.comprobantePropio', 'contrato.propio']) {
      const v = R[k].valor as { status: number; location: string | null };
      assert.equal(R[k].error, null, `${k}: ${R[k].error}`);
      assert.equal(v.status, 302, `${k}: el documento propio dejó de abrir (${v.status})`);
      assert.equal(R[k].firmadas.length, 1, `${k}: se tenía que firmar una vez`);
      assert.ok(R[k].firmadas[0].startsWith(`/storage/v1/object/sign/contratos/${WS_A}/${LEAD_PROPIO}/`), `${k}: firmó ${R[k].firmadas[0]}`);
    }
    for (const k of ['doc.ajeno', 'doc.puntos', 'doc.puntosCodificados', 'doc.otroBucket', 'doc.contratoAjeno', 'doc.comprobanteAjeno', 'contrato.puntos']) {
      const v = R[k].valor as { status: number } | undefined;
      assert.equal(R[k].error, null, `${k}: ${R[k].error}`);
      assert.deepEqual(R[k].firmadas, [], `${k}: firmó una ruta de otro lugar → ${R[k].firmadas.join(', ')}`);
      assert.equal(v?.status, 403, `${k}: tenía que contestar 403`);
    }
  });

  test('la ruta se valida por SEGMENTOS: el prefijo solo se salta con `..` (el fetch los resuelve)', () => {
    // El mecanismo, medido: así arma storage-js la URL de la firma, y así la deja el fetch.
    const base = 'http://supa.test/storage/v1/object/sign/contratos/';
    assert.equal(new URL(`${base}5/60/../../7/50/x.pdf`).pathname, '/storage/v1/object/sign/contratos/7/50/x.pdf');
    assert.equal(new URL(`${base}5/60/%2e%2e/%2E%2e/7/50/x.pdf`).pathname, '/storage/v1/object/sign/contratos/7/50/x.pdf');
    assert.equal(new URL(`${base}5/60/../../../wa-media/7/x.ogg`).pathname, '/storage/v1/object/sign/wa-media/7/x.ogg');

    type Ruta = (path: string, ws: number, leadId: number, aceptaLegado?: boolean) => boolean;
    const copias: Array<[string, Ruta]> = [
      ['app/api/doc/route.ts', traer<Ruta>('app/api/doc/route.ts', 'rutaDeEsteLead')],
      ['app/api/contract/route.ts', traer<Ruta>('app/api/contract/route.ts', 'rutaDeEsteLead')],
    ];
    const valen = ['5/60/1700000000001_contrato.pdf', '5/60/fiscal/1700000000001_Constancia_RFC-2026.pdf', '5/60/comprobantes/1700_recibo.jpg', '5/60/1700_..'];
    const no = [
      '7/50/fiscal/1700_x.pdf', '5/6/1700_x.pdf', '5/600/1700_x.pdf', '55/60/1700_x.pdf', '/5/60/1700_x.pdf',
      '5/60/../../7/50/x.pdf', '5/60/%2e%2e/%2e%2e/7/50/x.pdf', '5/60/.%2E/x.pdf', '5/60/./x.pdf', '5/60//x.pdf', '5/60/',
      '5/60/..\\..\\7\\50\\x.pdf', '5/60/x.pdf?download=1', '5/60/x.pdf#a', '5/60/fiscal/..', '5/60',
    ];
    for (const [donde, ruta] of copias) {
      for (const p of valen) assert.equal(ruta(p, 5, 60), true, `${donde}: una ruta legítima no abre: ${p}`);
      for (const p of no) assert.equal(ruta(p, 5, 60), false, `${donde}: firma una ruta armada: ${p}`);
      // El formato viejo del contrato (`<lead>/…`, antes de 7ee06bb15): sólo con aceptaLegado, y con las
      // mismas reglas de segmentos. Sin esto, el contrato real del lead 31 del ws1 dejaba de abrir.
      assert.equal(ruta('60/1700_contrato.pdf', 5, 60, true), true, `${donde}: el contrato viejo no abre`);
      assert.equal(ruta('60/1700_contrato.pdf', 5, 60), false, `${donde}: el formato viejo abre sin aceptaLegado`);
      for (const p of ['61/1700_x.pdf', '60/../61/x.pdf', '60/%2e%2e/x.pdf', '6/1700_x.pdf']) {
        assert.equal(ruta(p, 5, 60, true), false, `${donde}: el legado firma una ruta armada: ${p}`);
      }
    }
    // Y quién lo pide: /api/doc SÓLO para el contrato (el doc_path lo escribía el navegador), /api/contract siempre.
    const doc = sinComentarios(leer('app/api/doc/route.ts'));
    assert.equal(doc.split('rutaDeEsteLead(path, ws, leadId').length - 1, 1, '/api/doc valida la ruta en más de un lugar');
    assert.match(doc, /rutaDeEsteLead\(path, ws, leadId, kind === 'contrato'\)/, '/api/doc acepta el formato viejo para el doc fiscal');
    assert.match(sinComentarios(leer('app/api/contract/route.ts')), /rutaDeEsteLead\(lead\.contrato_path as string, ws, leadId, true\)/,
      '/api/contract dejó de aceptar el contrato viejo: el del lead 31 del ws1 no abre');
  });

  test('regla para el próximo escritor de `pagos`: asegurarLeadDelNegocio ANTES del insert, en la misma función', () => {
    const guarda = sinComentarios(leer('lib/pagos.ts'));
    const g = guarda.slice(guarda.indexOf('export async function asegurarLeadDelNegocio('), guarda.indexOf('\n}\n', guarda.indexOf('export async function asegurarLeadDelNegocio(')));
    assert.match(g, /await getTenantDb\(\)\)\.from\('leads'\)\.select\('id'\)\.eq\('id', leadId\)/, 'la guarda tiene que leer el lead con getTenantDb (el del negocio de la sesión)');
    assert.match(g, /if \(!data\) throw/, 'la guarda tiene que TIRAR si el lead no está');

    const guardadas: string[] = [];
    for (const rel of ['lib/pagos.ts', 'app/crm/[id]/deal-actions.ts']) {
      const src = sinComentarios(leer(rel));
      // Cada insert/upsert cuyo `.from(...)` más cercano es `pagos`.
      for (const m of src.matchAll(/\.(insert|upsert)\(/g)) {
        const antes = src.slice(0, m.index);
        const from = antes.slice(antes.lastIndexOf('.from('));
        if (!from.startsWith(".from('pagos')")) continue;
        const ini = antes.lastIndexOf('\nexport async function ');
        const nombre = src.slice(ini + 23, src.indexOf('(', ini + 23));
        const cuerpo = src.slice(ini, m.index);
        assert.match(cuerpo, /await asegurarLeadDelNegocio\(/, `${rel}: ${nombre}() escribe en pagos sin asegurarLeadDelNegocio antes`);
        guardadas.push(nombre);
      }
    }
    // Que el barrido vea a los escritores de hoy (si dejara de verlos, pasaría sin mirar nada).
    for (const f of ['savePlanPagos', 'saveLeadPlanManual', 'cobrarCuota', 'registrarPagoSuelto', 'registrarCobroDeProveedor', 'saveCuotasAction']) {
      assert.ok(guardadas.includes(f), `el barrido no encontró el insert de ${f}`);
    }
  });
}
