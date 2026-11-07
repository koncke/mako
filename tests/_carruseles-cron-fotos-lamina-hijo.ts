// =============================================================================
// Hijo de tests/carruseles-cron-fotos-lamina.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Corre el HANDLER del cron de verdad (`app/api/cron/carruseles-fotos-lamina/route.ts` → `GET`) contra un PostgREST de
// mentira (tests/_postgrest-de-mentira.ts) y un Storage de mentira. El molde es tests/_carruseles-foto-lamina-hijo.ts: el
// módulo que asienta lleva `server-only`, así que esto corre en un node aparte con `--conditions=react-server`.
//
// De mentira es sólo lo de AFUERA: la base, el bucket y la pestaña del cliente. Lo que corre de verdad es el cron entero
// —la guarda del secreto (`checkCronAuth`), la consulta que BUSCA los negocios con algo anotado, el `runWithWorkspace` de
// cada uno y `asentarFotosDeLamina`, con su compare-and-set del diseño.
//
// ⚠️ Y SE ANOTA CADA CONSULTA A LA BASE (`consultas`). Es el único modo de probar las dos cosas que hacen que este cron
// sea barato y correcto a la vez: que en el caso común (nadie pidió una foto) cueste UNA lectura, y que NO barra los
// workspaces uno por uno —si alguien cambiara la consulta por `listarWorkspaces()`, la tabla `workspaces` aparecería acá.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-de-prueba';
process.env.CRON_SECRET = 'secreto-del-cron-0123456789';

/** La clave bajo la que `lib/carruseles/foto-lamina.ts` anota los pendientes (`KEY_FOTOS_LAMINA`). */
const KEY = 'carruseles.fotos-de-lamina';
/** La url que sube la pestaña del cliente con la firma del puente: NUESTRO Storage, público y sin vencimiento. */
const NUESTRA = 'http://supa.test/storage/v1/object/public/video-clips/video-generator/carrusel-x/escena-2-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
const CAJA = { left: 540, top: 135, width: 486, height: 675 };
/** El diseño de cada negocio: distinto por negocio, para que una foto puesta en el ajeno se vea. */
const disenoDe = (ws: number) => `11111111-2222-4333-8444-5555555555${String(ws).padStart(2, '0')}`;

/** Un JPEG de mentira de 16 × 16 (el molde: el largo del APP0 tiene que ser el de verdad o `medidasDeImagen` se pasa del SOF0). */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x0e, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]);

let proximoTrabajo = 100;
const pg = crearPostgrest({
  tablas: ['workspaces', 'credenciales', 'app_settings', 'flow_puentes', 'flow_trabajos', 'image_disenos', 'image_subidos'],
  defaults: (tabla, f) => {
    if (tabla === 'flow_trabajos') return { id: proximoTrabajo++, created_at: new Date().toISOString(), resultado: null, error: null, intentos: 0, tomado_at: null, ...f };
    if (tabla === 'image_disenos') return { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), borrado_at: null, miniatura: null, ...f };
    return f;
  },
});

/** Cada consulta a la base, en orden: `METODO tabla?query`. */
let consultas: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const u = new URL(url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/rest/')) {
    consultas.push(`${(init.method ?? 'GET').toUpperCase()} ${u.pathname.replace('/rest/v1/', '')}?${u.searchParams.toString()}`);
    return pg.responder(u, init);
  }
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/public/')) {
    // Lo que la pestaña del cliente ya subió: la foto generada, servida desde NUESTRO bucket.
    return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/')) {
    return new Response(JSON.stringify({ Key: u.pathname }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/')) {
    return new Response(JSON.stringify({ signedURL: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('no', { status: 403 });
}) as typeof fetch;

/** El documento que dejó «Editar»: dos láminas, la 1 con el lugar de la foto reservado y su titular al costado. */
const docDeEjemplo = (ws: number) => ({
  schemaVersion: 1,
  width: 1080,
  height: 1350,
  unit: 'px',
  pages: [
    { id: 'p0', name: 'Portada', background: { type: 'solid', color: '#101010' }, objects: [{ id: 't0', type: 'textbox', name: `Titular ws${ws}`, text: 'PORTADA', left: 86, top: 200, width: 907, height: 120, fontSize: 100 }] },
    { id: 'p1', name: 'Lámina 2', background: { type: 'solid', color: '#101010' }, objects: [{ id: 't1', type: 'textbox', name: `Titular ws${ws}`, text: 'LO QUE DICEN', left: 65, top: 270, width: 432, height: 120, fontSize: 92 }] },
  ],
});

export type Salida = {
  status: number;
  cuerpo: Record<string, unknown>;
  /** Cuántos pendientes quedaron anotados por negocio, después de la corrida. */
  pendientes: Record<string, number>;
  /** El `name` de los objetos de la lámina 1 del diseño de cada negocio: así se ve dónde entró cada foto. */
  laminas: Record<string, string[]>;
  /** Lo mismo, pero de TODAS las páginas: para el diseño con dos fotos. */
  paginas: Record<string, string[][]>;
  /** La versión del diseño después de la corrida: cada guardado la sube una (el compare-and-set). */
  version: Record<string, number>;
  /** Cuántas filas quedaron en «Subidos» del Image Editor, por negocio. */
  subidos: Record<string, number>;
  consultas: string[];
};

/** Un negocio del caso: qué tiene anotado y cómo contestó su navegador. */
type Negocio = {
  ws: number;
  /** El trabajo del puente: `listo` con su url, `fallido` o `pendiente` (todavía generando). */
  estado: 'listo' | 'fallido' | 'pendiente';
  url?: string;
  /** Hace cuánto se pidió la foto. `VENCE_MS` son 6 h. */
  haceMs?: number;
  /** Qué láminas tienen una foto en vuelo. Por defecto sólo la 1; con dos, es el tope real (`FOTOS_GENERADAS_MAX`). */
  laminas?: number[];
  /** Sin esto, el diseño del pendiente NO existe (el negocio lo borró entre medio). */
  conDiseno?: boolean;
  /** `[]` anotado: se asentó todo y no hay nada que hacer. */
  vacio?: boolean;
};

async function main() {
  const ahora = new Date().toISOString();
  const { GET } = await import('../app/api/cron/carruseles-fotos-lamina/route');
  const { runWithWorkspace } = await import('../lib/workspace');
  const F = await import('../lib/carruseles/foto-lamina');

  const pedirCron = async (autorizacion?: string): Promise<{ status: number; cuerpo: Record<string, unknown> }> => {
    const req = new Request('https://x.test/api/cron/carruseles-fotos-lamina', autorizacion === undefined ? {} : { headers: { authorization: autorizacion } });
    const r = await GET(req as never);
    return { status: r.status, cuerpo: (await r.json()) as Record<string, unknown> };
  };

  const correr = async (negocios: readonly Negocio[], o: { autorizacion?: string | null; sinTabla?: string } = {}): Promise<Salida> => {
    pg.vaciar();
    proximoTrabajo = 100;
    consultas = [];
    for (const n of negocios) {
      pg.db.workspaces.push({ id: n.ws, capa: 'cliente', nombre: `Negocio ${n.ws}`, created_at: ahora });
      if (n.conDiseno !== false) {
        pg.db.image_disenos.push({
          id: disenoDe(n.ws), workspace_id: n.ws, titulo: `Carrusel · ws${n.ws}`, doc: docDeEjemplo(n.ws), ancho: 1080, alto: 1350,
          paginas: 2, creado_por: 'test', version: 1, created_at: ahora, updated_at: ahora, borrado_at: null, miniatura: null,
        });
      }
      if (n.vacio) { pg.db.app_settings.push({ workspace_id: n.ws, key: KEY, value: '[]' }); continue; }
      const anotados = (n.laminas ?? [1]).map((lamina) => {
        const trabajo = proximoTrabajo++;
        pg.db.flow_trabajos.push({
          id: trabajo, workspace_id: n.ws, tipo: 'generar_imagen', estado: n.estado, pedido: {}, intentos: 0, tomado_at: null,
          created_at: ahora, error: n.estado === 'fallido' ? 'Flow no pudo generar la imagen.' : null,
          resultado: n.estado === 'listo' ? { motor: 'interfaz', propio: true, url: n.url ?? NUESTRA } : null,
        });
        return {
          diseno: disenoDe(n.ws), lamina, trabajo, caja: CAJA, quien: 'otra',
          creadoEn: new Date(Date.now() - (n.haceMs ?? 60_000)).toISOString(),
        };
      });
      pg.db.app_settings.push({ workspace_id: n.ws, key: KEY, value: JSON.stringify(anotados) });
    }
    if (o.sinTabla) pg.faltan.add(o.sinTabla);

    const { status, cuerpo } = await pedirCron(o.autorizacion === null ? undefined : (o.autorizacion ?? `Bearer ${process.env.CRON_SECRET}`));
    if (o.sinTabla) pg.faltan.delete(o.sinTabla);

    // Lo que quedó: los pendientes de cada negocio y la lámina 1 de su diseño. Se lee DESPUÉS de anotar las consultas del
    // cron, así que estas lecturas no entran en `consultas`.
    const consultasDelCron = [...consultas];
    const pendientes: Record<string, number> = {};
    const laminas: Record<string, string[]> = {};
    const paginas: Record<string, string[][]> = {};
    const version: Record<string, number> = {};
    const subidos: Record<string, number> = {};
    for (const n of negocios) {
      pendientes[n.ws] = (await runWithWorkspace(n.ws, () => F.pendientesDeFoto())).length;
      const d = (pg.db.image_disenos as Array<Record<string, unknown>>).find((x) => x.id === disenoDe(n.ws));
      const todas = ((d?.doc as { pages?: Array<{ objects?: Array<Record<string, unknown>> }> } | undefined)?.pages ?? []);
      paginas[n.ws] = todas.map((p) => (p?.objects ?? []).map((x) => String(x.name ?? '')));
      laminas[n.ws] = paginas[n.ws][1] ?? [];
      version[n.ws] = Number(d?.version ?? 0);
      subidos[n.ws] = (pg.db.image_subidos as Array<Record<string, unknown>>).filter((x) => Number(x.workspace_id) === n.ws).length;
    }
    return { status, cuerpo, pendientes, laminas, paginas, version, subidos, consultas: consultasDelCron };
  };

  const out: Record<string, Salida> = {
    // 1. A CIEGAS, sin que nadie abra ningún diseño: tres negocios con una foto lista cada uno. Los ids van desordenados
    //    a propósito: se sirven de menor a mayor (el `order` de la consulta), y la foto de cada uno entra en SU diseño.
    ciego: await correr([
      { ws: 7, estado: 'listo' },
      { ws: 3, estado: 'listo' },
      { ws: 5, estado: 'listo' },
    ]),
    // 2. DOS FOTOS DEL MISMO DISEÑO, que es el tope real (`FOTOS_GENERADAS_MAX`) y lo que el cron más va a ver: las dos
    //    llegan mientras nadie mira, así que se asientan en la misma corrida y encadenan dos compare-and-set.
    dosDelMismoDiseno: await correr([{ ws: 3, estado: 'listo', laminas: [0, 1] }]),
    // 3. El caso de casi todas las corridas: dos negocios que ya asentaron todo (`[]` anotado). UNA lectura y afuera.
    nadaAnotado: await correr([{ ws: 3, estado: 'listo', vacio: true }, { ws: 5, estado: 'listo', vacio: true }]),
    // 4. Sin el secreto del cron: 401 y la base ni se toca.
    sinSecreto: await correr([{ ws: 3, estado: 'listo' }], { autorizacion: null }),
    secretoMalo: await correr([{ ws: 3, estado: 'listo' }], { autorizacion: 'Bearer otro-secreto-cualquiera' }),
    // 5. Un negocio roto (su diseño ya no existe) no corta al otro: el que se puede asentar se asienta igual.
    unoRoto: await correr([{ ws: 3, estado: 'listo', conDiseno: false }, { ws: 5, estado: 'listo' }]),
    // 6. Todavía generando y pedida hace un minuto: NO se suelta, se vuelve a preguntar en la próxima corrida.
    enCurso: await correr([{ ws: 3, estado: 'pendiente' }]),
    // 7. Todavía generando y pedida hace 7 h (`VENCE_MS` son 6): se suelta. Es el único que puede verlo, y es lo que pone
    //    el TECHO de la cadencia: un cron más lento que el vencimiento llegaría a soltar fotos que estaban listas.
    vencido: await correr([{ ws: 3, estado: 'pendiente', haceMs: 7 * 60 * 60 * 1000 }]),
    // 8. Flow falló: el pendiente se suelta y el diseño queda como estaba.
    fallido: await correr([{ ws: 3, estado: 'fallido' }]),
    // 9. La base no contesta la consulta de los pendientes: 500, y ningún negocio corre a ciegas con media lista.
    baseCaida: await correr([{ ws: 3, estado: 'listo' }], { sinTabla: 'app_settings' }),
  };

  // Los dos números del módulo que asienta, para que la cadencia del cron se compare contra el valor REAL y no contra una
  // copia escrita en el test: `VENCE_MS` es el techo de la cadencia, y la clave es por dónde el cron encuentra el trabajo.
  process.stdout.write(`@@RESULTADO@@${JSON.stringify({ ...out, venceMs: F.VENCE_MS, key: F.KEY_FOTOS_LAMINA })}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
