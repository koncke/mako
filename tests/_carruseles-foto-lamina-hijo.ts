// =============================================================================
// Hijo de tests/carruseles-foto-lamina.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// `lib/carruseles/foto-lamina.ts` lleva `server-only`: corre en un node aparte con `--conditions=react-server`. Corre
// `pedirFotosDeLamina` y `asentarFotosDeLamina` DE VERDAD contra un PostgREST de mentira (tests/_postgrest-de-mentira.ts) y
// un Storage de mentira. De mentira es sólo lo de AFUERA: la base, el bucket y la pestaña del cliente. La cola
// (`encolar`, lib/flow-cola.ts), la puerta del puente, el prompt de Flow (`promptFinal`, lib/flow-imagen.ts) y el
// compare-and-set del diseño (lib/image-editor/server.ts) corren de verdad.
//
// ⚠️ LA URL QUE DEVUELVE FLOW VENCE (~6 h). Acá eso se prueba con una url de Flow que NO EXISTE: `fetchSeguro` usa node:https
// con DNS real, así que falla rápido e igual en todas las máquinas, y lo que se mira es la DECISIÓN — que esa url nunca
// termine escrita como `src` adentro del documento, porque mañana se dibuja rota.
// =============================================================================

import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-de-prueba';

const WS = 3;
const DISENO = '11111111-2222-4333-8444-555555555555';
const FOTO_ID = 'foto-1';
const CARA_EN_FLOW = 'media-de-la-cara';
/** La url que sube la pestaña con la firma del puente: NUESTRO Storage, público y sin vencimiento. */
const NUESTRA = 'http://supa.test/storage/v1/object/public/video-clips/video-generator/carrusel-x/escena-2-aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee.jpg';
/** Una url firmada de Flow, con su `Expires`: la que NO se puede guardar en el documento. El host no existe a propósito. */
const DE_FLOW = 'https://flow-content-de-prueba-que-no-existe.google/image/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee?Expires=99999999999&Signature=x';

/**
 * Un JPEG de mentira de 16 × 16: `tipoDeImagen` mira la firma y `medidasDeImagen` CAMINA los segmentos hasta el SOF0.
 *
 * ⚠️ El largo del APP0 (`00 0e`) tiene que ser el de verdad. Con uno de más, el caminador se pasa del `ff c0`, no encuentra
 * las medidas y `subirAlEditor` devuelve null — y el síntoma es idéntico a «el diseño no se asentó»: puestas 0, caídas 0, el
 * pendiente ahí. Medido escribiéndolo mal.
 */
const JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x0e, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x10, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  0xff, 0xd9,
]);

let proximoTrabajo = 100;
const pg = crearPostgrest({
  tablas: ['workspaces', 'credenciales', 'app_settings', 'flow_puentes', 'flow_trabajos', 'image_disenos', 'image_subidos', 'anthropic_usage'],
  defaults: (tabla, f) => {
    if (tabla === 'flow_trabajos') return { id: proximoTrabajo++, created_at: new Date().toISOString(), resultado: null, error: null, intentos: 0, tomado_at: null, ...f };
    if (tabla === 'image_disenos') return { version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), borrado_at: null, miniatura: null, ...f };
    return f;
  },
});

/** Lo que se le pidió a Storage: así se ve si la foto se COPIÓ a «Subidos» en vez de apuntar a la url que vence. */
let subidas: string[] = [];
/** Los hosts pedidos afuera de la base. */
let red: string[] = [];

globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const url = typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const u = new URL(url);
  if (u.host === 'supa.test' && u.pathname.startsWith('/rest/')) return pg.responder(u, init);
  red.push(u.host);
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/public/')) {
    // Lo que la pestaña ya subió: la foto generada, servida desde NUESTRO bucket.
    return new Response(JPEG, { status: 200, headers: { 'content-type': 'image/jpeg' } });
  }
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/object/')) {
    subidas.push(u.pathname.replace('/storage/v1/object/', ''));
    return new Response(JSON.stringify({ Key: u.pathname }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (u.host === 'supa.test' && u.pathname.startsWith('/storage/v1/')) {
    return new Response(JSON.stringify({ signedURL: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('no', { status: 403 });
}) as typeof fetch;

/** El documento que dejó «Editar»: dos láminas, la 1 con el lugar de la foto reservado y su titular en la columna izquierda. */
const docDeEjemplo = () => ({
  schemaVersion: 1,
  width: 1080,
  height: 1350,
  unit: 'px',
  pages: [
    { id: 'p0', name: 'Portada', background: { type: 'solid', color: '#101010' }, objects: [{ id: 't0', type: 'textbox', name: 'Titular', text: 'PORTADA', left: 86, top: 200, width: 907, height: 120, fontSize: 100 }] },
    { id: 'p1', name: 'Lámina 2', background: { type: 'solid', color: '#101010' }, objects: [{ id: 't1', type: 'textbox', name: 'Titular', text: 'LO QUE DICEN', left: 65, top: 270, width: 432, height: 120, fontSize: 92 }] },
  ],
});

const CAJA = { left: 540, top: 135, width: 486, height: 675 };

export type Salida = {
  /** Los trabajos que quedaron encolados: por dónde salen y con qué. */
  trabajos: Array<{ tipo: string; prompt: string; referencias: string[]; ruta: string; vertical: boolean }>;
  pedidas: number;
  nota: string | null;
  pendientes: number;
  asentar?: { puestas: number; caidas: number };
  /** Los objetos de cada página del diseño, después de asentar. */
  paginas?: Array<Array<{ type: string; name: string; src?: string; left?: number; top?: number; ancho?: number }>>;
  subidos?: number;
  subidas?: string[];
  red?: string[];
};

async function main() {
  const ahora = new Date().toISOString();
  pg.db.workspaces.push({ id: WS, capa: 'cliente', nombre: 'Sonrisa Llena', created_at: ahora });

  const { runWithWorkspace } = await import('../lib/workspace');
  const { KEY_CARAS_FLOW } = await import('../lib/flow-protocolo');
  const F = await import('../lib/carruseles/foto-lamina');
  const { RUTA_SUBIDA } = await import('../lib/flow-interfaz');

  /** El negocio tiene su cara de marca cargada y YA subida a Flow (el mapa que cachea `caraDeFoto`). */
  const sembrarApp = (conCaraEnFlow: boolean) => {
    pg.db.app_settings.length = 0;
    pg.db.app_settings.push({
      workspace_id: WS, key: 'mako.persona',
      value: JSON.stringify({ descripcion: '', fotos: [{ id: FOTO_ID, nombre: 'cara.jpg', mime: 'image/jpeg', path: `${WS}/cara.jpg` }] }),
    });
    if (conCaraEnFlow) pg.db.app_settings.push({ workspace_id: WS, key: KEY_CARAS_FLOW, value: JSON.stringify({ [FOTO_ID]: CARA_EN_FLOW }) });
  };

  /** El puente del cliente: `vivo` = latió hace un segundo; `version` decide si genera por la interfaz de Flow. */
  const sembrarPuente = (o: { estado: string; vivo: boolean; version: string }) => {
    pg.db.flow_puentes.length = 0;
    pg.db.flow_puentes.push({
      workspace_id: WS, estado: o.estado, estado_detalle: '', etiqueta: 'Chrome', project_id: 'p',
      ultimo_visto: new Date(Date.now() - (o.vivo ? 1_000 : 60 * 60 * 1000)).toISOString(), version: o.version,
      token_hash: 'x', created_at: ahora,
    });
  };

  const sembrarDiseno = () => {
    pg.db.image_disenos.length = 0;
    pg.db.image_subidos.length = 0;
    pg.db.image_disenos.push({
      id: DISENO, workspace_id: WS, titulo: 'Carrusel · x', doc: docDeEjemplo(), ancho: 1080, alto: 1350, paginas: 2,
      creado_por: 'test', version: 1, created_at: ahora, updated_at: ahora, borrado_at: null, miniatura: null,
    });
  };

  const trabajosEncolados = () => (pg.db.flow_trabajos as Array<Record<string, unknown>>).map((t) => {
    const p = (t.pedido ?? {}) as Record<string, unknown>;
    return {
      tipo: String(t.tipo), prompt: String(p.prompt ?? ''), referencias: (p.referencias as string[]) ?? [],
      ruta: String(p.ruta ?? ''), vertical: p.vertical === true,
    };
  });

  /** Lo que «Editar» ya calculó (lib/carruseles/replica.ts, `fotosAGenerar`): la lámina 1, con y sin la cara del dueño. */
  const pedido = (conCara: boolean) => ({
    lamina: 1, caja: CAJA, quien: (conCara ? 'dueno' : 'otra') as 'dueno' | 'otra', conCara,
    escena: 'A vertical 4:5 photo for one slide of an Instagram carousel. Scene: la dueña en su consultorio. No lettering, captions or logos anywhere in the image.',
  });

  const correr = async (o: {
    puente: { estado: string; vivo: boolean; version: string };
    conCaraEnFlow?: boolean;
    pedidos: Array<ReturnType<typeof pedido>>;
    /** Cómo contesta la pestaña del cliente cada trabajo encolado, en orden. */
    responde?: Array<{ estado: 'listo' | 'fallido' | 'pendiente'; url?: string }>;
    asentar?: boolean;
  }): Promise<Salida> => {
    pg.db.flow_trabajos.length = 0;
    proximoTrabajo = 100;
    subidas = []; red = [];
    sembrarApp(o.conCaraEnFlow !== false);
    sembrarPuente(o.puente);
    sembrarDiseno();

    const r = await runWithWorkspace(WS, () => F.pedirFotosDeLamina(WS, DISENO, o.pedidos, { fotoId: FOTO_ID }));
    const pendientes = (await runWithWorkspace(WS, () => F.pendientesDeFoto())).length;
    const salida: Salida = { trabajos: trabajosEncolados(), pedidas: r.pedidas, nota: r.nota, pendientes };
    if (!o.asentar) return salida;

    // La pestaña del cliente contesta: cada trabajo pasa a `listo` con su url, o a `fallido`.
    const filas = pg.db.flow_trabajos as Array<Record<string, unknown>>;
    (o.responde ?? []).forEach((resp, i) => {
      if (!filas[i]) return;
      filas[i].estado = resp.estado;
      if (resp.estado === 'listo') filas[i].resultado = { motor: 'interfaz', propio: true, url: resp.url ?? NUESTRA };
      if (resp.estado === 'fallido') filas[i].error = 'Flow no pudo generar la imagen.';
    });

    salida.asentar = await runWithWorkspace(WS, () => F.asentarFotosDeLamina(WS, DISENO));
    const d = (pg.db.image_disenos as Array<Record<string, unknown>>).find((x) => x.id === DISENO)!;
    const paginas = ((d.doc as { pages?: Array<{ objects?: Array<Record<string, unknown>> }> }).pages ?? []).map((p) =>
      (p.objects ?? []).map((x) => ({ type: String(x.type), name: String(x.name ?? ''), src: typeof x.src === 'string' ? x.src : undefined, left: x.left as number, top: x.top as number })));
    salida.paginas = paginas;
    salida.subidos = (pg.db.image_subidos as unknown[]).length;
    salida.subidas = [...subidas];
    salida.red = [...new Set(red)];
    salida.pendientes = (await runWithWorkspace(WS, () => F.pendientesDeFoto())).length;
    return salida;
  };

  const VIVO = { estado: 'listo', vivo: true, version: '0.70.0' };
  const out: Record<string, Salida> = {
    // 1. El puente listo y latiendo: se le pide la foto de la lámina ajena, sin la cara del dueño.
    ajena: await correr({ puente: VIVO, pedidos: [pedido(false)] }),
    // 2. La lámina de SU autor: el mismo pedido, con su cara como referencia de identidad.
    suya: await correr({ puente: VIVO, pedidos: [pedido(true)] }),
    // 3. LAS DOS EN EL MISMO DISEÑO: la de su autor lleva su cara, la de otra persona NO. Sin este caso, mandar la cara en
    //    las dos no da ningún rojo — con un solo pedido `otra`, `cara` ni se busca (medido rompiéndolo).
    mixta: await correr({ puente: VIVO, pedidos: [pedido(true), pedido(false)] }),
    // 4. Su cara todavía se está subiendo a Flow (`caraDeFoto` devuelve ''): esa se saltea y la ajena igual se pide.
    caraEnVuelo: await correr({ puente: VIVO, conCaraEnFlow: false, pedidos: [pedido(true), pedido(false)] }),
    // 4. El navegador del cliente no está: no se encola nada (un trabajo que nadie toma deja la lámina esperando para siempre).
    sinPuente: await correr({ puente: { estado: 'listo', vivo: false, version: '0.70.0' }, pedidos: [pedido(false)] }),
    // 5. Una extensión vieja no sabe poner la cara: tampoco.
    extensionVieja: await correr({ puente: { estado: 'listo', vivo: true, version: '0.68.0' }, pedidos: [pedido(false)] }),
    // 6. La pestaña devolvió la foto en NUESTRO Storage: se copia a «Subidos» y se asienta en su lámina.
    asentada: await correr({ puente: VIVO, pedidos: [pedido(false)], asentar: true, responde: [{ estado: 'listo' }] }),
    // 7. Flow falló: el pendiente se suelta y el diseño queda como estaba (nunca una imagen a medias).
    fallida: await correr({ puente: VIVO, pedidos: [pedido(false)], asentar: true, responde: [{ estado: 'fallido' }] }),
    // 8. Todavía generando: el pendiente SE QUEDA (se vuelve a preguntar al abrir el diseño).
    enCurso: await correr({ puente: VIVO, pedidos: [pedido(false)], asentar: true, responde: [{ estado: 'pendiente' }] }),
    // 9. La url que devolvió es una FIRMADA de Flow, que vence: no se puede guardar en el documento.
    urlQueVence: await correr({ puente: VIVO, pedidos: [pedido(false)], asentar: true, responde: [{ estado: 'listo', url: DE_FLOW }] }),
  };
  // La ruta de subida tiene que tener la forma que el puente sabe FIRMAR: con otra, el trabajo se genera y la pestaña no
  // puede subir el archivo (lib/flow-cola.ts, `firmarSubidas`).
  const rutaValida = RUTA_SUBIDA.test(out.ajena.trabajos.find((t) => t.tipo === 'generar_imagen')?.ruta ?? '');
  process.stdout.write(`@@RESULTADO@@${JSON.stringify({ ...out, rutaValida })}`);
}

main().then(() => process.exit(0), (e) => { process.stdout.write(`@@RESULTADO@@${JSON.stringify({ error: e instanceof Error ? e.stack : String(e) })}`); process.exit(0); });
