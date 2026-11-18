// =============================================================================
// Hijo de tests/api-acciones-octubre.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// Las tres acciones que la API de MaKo sumó el 18/11/2026 (pendiente O19), por las funciones REALES de la API
// (`ejecutarOperacion`, `aplicarEnElActo`, `confirmarPendiente`) sobre un PostgREST de mentira (tests/_postgrest-de-mentira.ts).
// De mentira son sólo los modelos y lo que les pregunta si hay IA: la cascada (`chatCheapCascade`, lib/ai-cheap.ts), el motor
// de editar con IA (`editarFlujoConIA`, lib/flujo-ia-editar.ts), lib/flujo-ia-crear.ts (`hayIAParaCrear`, `crearNuevas`) y el
// perfil del negocio. Datos inventados.
// Corre con `--conditions=react-server --experimental-test-module-mocks`. Escribe una línea `@@OCT@@<json>` por escena.
//
// ⚠️ lib/flujo-ia-crear.ts y lib/flujo-ia-editar.ts se mockean ANTES de importar nada real: importar el módulo real primero
// carga el registro de la API (chatbot.run.ts) con el módulo real adentro, y el mock ya no llega (medido: la primera versión
// de este hijo contestaba «No tienes una IA conectada» con `hayIAParaCrear` mockeado a true).
// =============================================================================

import { mock } from 'node:test';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { crearPostgrest } from './_postgrest-de-mentira';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://supa.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-de-prueba';

let n = 900;
const pg = crearPostgrest({
  tablas: [
    'workspaces', 'app_settings', 'prompts', 'propuestas', 'mako_acciones_pendientes', 'nutricion_secuencias', 'nutricion_inscripciones',
    'nutricion_envios', 'crm_etiquetas', 'leads', 'funnels', 'ofertas', 'productos', 'usuarios', 'anthropic_usage', 'errores_app', 'tickets',
  ],
  defaults: (t, f) => ({ id: ++n, ...(t === 'mako_acciones_pendientes' || t === 'propuestas' ? { created_at: new Date().toISOString(), estado: 'pendiente' } : {}), ...f }),
});
const red: string[] = [];
globalThis.fetch = (async (entrada: RequestInfo | URL, init: RequestInit = {}) => {
  const u = new URL(typeof entrada === 'string' ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
  if (u.host === 'supa.test') return pg.responder(u, init);
  red.push(u.host + u.pathname);
  return new Response(JSON.stringify({ error: 'red de mentira' }), { status: 500 });
}) as typeof fetch;

const url = (r: string) => pathToFileURL(join(__dirname, '..', r)).href;
const WS = 3;
const ahora = () => new Date().toISOString();
const salida = (nombre: string, datos: unknown) => console.log(`@@OCT@@${JSON.stringify({ nombre, ...(datos as object) })}`);

// ── Lo de mentira ─────────────────────────────────────────────────────────────────────────────────────────────────
/** Lo que contesta la cascada para la matriz (feature «razones»), en el formato del prompt (los avatares numerados). */
let matrizIA = '';
const llamadasIA: string[] = [];
type Editar = { t: 'contesta'; respuesta: string; ia: null } | { t: 'error'; error: string } | { t: 'edicion'; r: Record<string, unknown>; ia: string | null };
let editarIA: Editar = { t: 'error', error: 'sin escena' };
const pedidosEditar: Array<{ pedido: string; hastaMs: number; enviadoEn: number }> = [];

mock.module(url('lib/flujo-ia-editar.ts'), { namedExports: {
  editarFlujoConIA: async (o: { pedido: string; hastaMs: number }) => { pedidosEditar.push({ pedido: o.pedido, hastaMs: o.hastaMs, enviadoEn: Date.now() }); return editarIA; },
} });
mock.module(url('lib/flujo-ia-crear.ts'), { namedExports: {
  INTENTO_CREAR_MS: 45_000,
  hayIAParaCrear: async () => true,
  // Las etiquetas nuevas se crean de verdad en la base de mentira (la ref del modelo → el id que la base le dio).
  crearNuevas: async (nuevas: Array<{ ref: number; nombre: string }>) => {
    const ids = new Map<number, number>();
    const creadas: Array<{ id: number; nombre: string }> = [];
    for (const x of nuevas) { const id = ++n; pg.db.crm_etiquetas.push({ id, workspace_id: WS, nombre: x.nombre }); ids.set(x.ref, id); creadas.push({ id, nombre: x.nombre }); }
    return { ids, creadas };
  },
  armarContexto: async () => { throw new Error('armarContexto no se mockeó'); },
  generar: async () => { throw new Error('generar no se mockeó'); },
  contarCohorte: async () => null,
  crearFlujoConIA: async () => { throw new Error('crearFlujoConIA no se mockeó'); },
} });

const AVATARES = [{ id: 'av1', nombre: 'Dueña de agencia', descripcion: 'Tiene una agencia chica y quiere escalar' }, { id: 'av2', nombre: 'Coach que empieza', descripcion: 'Vende sesiones sueltas' }];
const CUERPO_1 = '¿Tienes una agencia chica y todavía vendes a mano cada servicio? Te muestro cómo otras dueñas de agencia llenaron su agenda sin perseguir a nadie por mensajes. Agenda tu llamada y te cuento el método completo.';
const CUERPO_2 = 'Si eres coach y cobras por sesión suelta, cada mes empiezas de cero. Mira cómo pasar a un programa de tres meses que tus clientas pagan por adelantado y que te deja la agenda tranquila. Escríbeme y te lo explico.';
const GUION_GUARDADO = { id: 'g-viejo', anguloId: 'propios', anguloNombre: 'Guiones propios', texto: CUERPO_1, creadoEn: 1, estado: 'borrador', estructuraId: '', estructuraNombre: '' };

function base(): void {
  pg.vaciar();
  pg.db.workspaces.push({ id: 9, nombre: 'Plataforma', capa: 'superadmin', estado: 'activo' }, { id: WS, nombre: 'Negocio de prueba', capa: 'completo', estado: 'activo' });
  pg.db.app_settings.push(
    { id: 1, workspace_id: WS, key: 'mako.avatares', value: JSON.stringify(AVATARES), updated_at: ahora() },
    {
      id: 2, workspace_id: WS, key: 'mako.razones', updated_at: ahora(), value: JSON.stringify([
        { id: 'c-trabajo', avatarId: 'av1', nombre: 'Dejar de vender a mano', descripcion: 'd', copy: 'c', guiones: [GUION_GUARDADO], imagenUrl: '', anguloImagen: '', anguloVideo: '' },
        { id: 'c-vacia', avatarId: 'av1', nombre: 'Tener más clientes', descripcion: 'd', copy: 'c', guiones: [], imagenUrl: '', anguloImagen: '', anguloVideo: '' },
        { id: 'c-av2', avatarId: 'av2', nombre: 'Cobrar más por sesión', descripcion: 'd', copy: 'c', guiones: [], imagenUrl: '', anguloImagen: '', anguloVideo: '' },
      ]),
    },
  );
  pg.db.nutricion_secuencias.push({
    id: 41, workspace_id: WS, clave: 's41', nombre: 'Bienvenida', emoji: null, activa: false, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'nuevo',
    etapas: null, funnel_id: null, producto_id: null, etiqueta_id: null, cron: null, cron_proxima_at: null, instance_name: null, estrategia: null,
    disparadores: null, posiciones: null, created_at: ahora(), updated_at: ahora(),
    pasos: [
      { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
      { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola, te escribo por lo que dejaste en el formulario', siguiente: null },
    ],
  }, {
    id: 42, workspace_id: 77, clave: 's42', nombre: 'De otro negocio', activa: false, archivada_at: null, trigger_tipo: 'etapa_actual', etapa: 'nuevo',
    pasos: [{ id: 'm1', canal: 'whatsapp', cuerpo: 'Ajena', siguiente: null }], created_at: ahora(), updated_at: ahora(),
  });
}
const matriz = () => JSON.parse(String(pg.db.app_settings.find((s) => s.workspace_id === WS && s.key === 'mako.razones')?.value ?? '[]')) as Array<Record<string, unknown>>;
const cuerpoM1 = () => (pg.db.nutricion_secuencias.find((s) => s.id === 41)?.pasos as Array<{ id: string; cuerpo: string }>).find((p) => p.id === 'm1')?.cuerpo;

const detallado = {
  ws: WS, canal: 'http', canalKey: `http:${WS}`, rol: 'admin', alcance: 'ejecutar',
  permisos: { chatbot: 'escritura', contenido: 'escritura' }, token: { id: 'tk', nombre: 'Claude' }, actor: 'API · token «Claude»', persona: 'duena@negocio-ficticio.test',
};
/** Lo que arma `ejecutarDesdeFlujo` (lib/api-mako/flujo.ts): canal de la app y la clave con el prefijo de los flujos. */
const deUnFlujo = { ...detallado, canal: 'app', canalKey: 'app:flujo:secuencia:41', permisos: undefined, token: undefined };

async function main() {
  // El real con UNA función cambiada (como tests/_contrato-ruta-hijo.ts), por `namedExports`: Node 22 (el de la PC y del
  // pre-push sin el PATH de scripts/node24.sh) ignora `exports` y deja el módulo vacío (medido: «perfilNegocioTexto is not a
  // function» en el filtro del pre-push, verde con Node 24).
  const sinDefault = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'default' && k !== 'module.exports'));
  const ia = await import(url('lib/ai-cheap.ts'));
  mock.module(url('lib/ai-cheap.ts'), { namedExports: {
    ...sinDefault(ia),
    chatCheapCascade: async (o: { feature?: string; validar?: (t: string) => boolean }) => {
      llamadasIA.push(String(o.feature));
      if (o.feature === 'razones') return o.validar && !o.validar(matrizIA) ? '' : matrizIA;
      return ''; // ordenar un guion: «no se pudo» es válido (se guarda sin rótulos)
    },
  } } as unknown as Parameters<typeof mock.module>[1]);
  const onb = await import(url('lib/onboarding.ts'));
  mock.module(url('lib/onboarding.ts'), { namedExports: {
    ...sinDefault(onb),
    perfilNegocioTexto: async () => 'Agencia de marketing que vende un programa de 3 meses para dueñas de agencias chicas.',
  } } as unknown as Parameters<typeof mock.module>[1]);

  const { ejecutarOperacion } = await import('../lib/api-mako/ejecutar');
  const { aplicarEnElActo, NO_EN_FLUJOS } = await import('../lib/api-mako/flujo');
  const { confirmarPendiente } = await import('../lib/api-mako/acciones');
  const { porId } = await import('../lib/api-mako/registro');
  const { runWithWorkspace } = await import('../lib/workspace');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const def = (id: string) => porId(id) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = detallado as any;
  const enElActo = (id: string, input: Record<string, unknown>) => runWithWorkspace(WS, () => aplicarEnElActo(def(id), input, ctx, { ws: WS, origen: 'api:tk' }));
  const proponer = (id: string, input: Record<string, unknown>, c: Record<string, unknown> = ctx) => runWithWorkspace(WS, () => ejecutarOperacion(id, input, c as never, 'json'));

  // ── cargar_guiones_anuncio ──
  base();
  // El 1 ya está guardado (con otro encabezado: la huella no mira el rótulo); el 3 repite al 2 dentro del texto.
  const texto = ['# Guion 1: El de la agenda', CUERPO_1, '', '# Guion 2: El de la coach', CUERPO_2, '', '# Guion 3: Copia', CUERPO_2].join('\n');
  const propuesta = await proponer('cargar_guiones_anuncio', { texto });
  const propuestaFila = pg.db.propuestas.find((p) => propuesta.ok && propuesta.tipo === 'propuesta' && p.id === propuesta.propuesta.id);
  const guionesTrasProponer = (matriz().find((c) => c.id === 'guiones-propios')?.guiones as unknown[] | undefined)?.length ?? 0;
  const cargado = await enElActo('cargar_guiones_anuncio', { texto });
  const propios = matriz().find((c) => c.id === 'guiones-propios');
  const otraVez = await enElActo('cargar_guiones_anuncio', { texto });
  const guionesTrasOtraVez = (matriz().find((c) => c.id === 'guiones-propios')?.guiones as unknown[] | undefined)?.length ?? 0;
  const sinTexto = await proponer('cargar_guiones_anuncio', {});
  salida('cargar', {
    propuesta, resumenPropuesta: propuestaFila?.resumen ?? null, guionesTrasProponer, cargado, otraVez, guionesTrasOtraVez, sinTexto,
    propios: propios ? { nombre: propios.nombre, guiones: (propios.guiones as Array<{ texto: string; estado: string; id: string }>).map((g) => ({ texto: g.texto, estado: g.estado, id: g.id })) } : null,
    trabajoIntacto: (matriz().find((c) => c.id === 'c-trabajo')?.guiones as unknown[] | undefined)?.length ?? 0,
  });

  // ── generar_anuncios_planteados ──
  base();
  matrizIA = JSON.stringify({ matriz: [
    { avatar: 1, razones: [{ nombre: 'Dejar de vender a mano', descripcion: 'x', copy: 'x' }, { nombre: 'Tener su tarde libre', descripcion: 'x', copy: 'x' }, { nombre: 'Contratar a su primera vendedora', descripcion: 'x', copy: 'x' }] },
    { avatar: 2, razones: [{ nombre: 'Llenar su agenda', descripcion: 'x', copy: 'x' }] },
  ] });
  const propGen = await proponer('generar_anuncios_planteados', {});
  const resumenGen = pg.db.propuestas.find((p) => propGen.ok && propGen.tipo === 'propuesta' && p.id === propGen.propuesta.id)?.resumen ?? null;
  const iaTrasProponer = llamadasIA.filter((f) => f === 'razones').length;
  const generado = await enElActo('generar_anuncios_planteados', {});
  const trasGenerar = matriz();
  // Sólo un avatar: el prompt lo numera 1 (es el único que va), y las celdas del otro no se tocan.
  base();
  matrizIA = JSON.stringify({ matriz: [{ avatar: 1, razones: [{ nombre: 'Llenar su agenda', descripcion: 'x', copy: 'x' }, { nombre: 'Cobrar por adelantado', descripcion: 'x', copy: 'x' }] }] });
  const soloAv2 = await enElActo('generar_anuncios_planteados', { avatarId: 'av2' });
  const trasSoloAv2 = matriz();
  base();
  const avatarFalso = await proponer('generar_anuncios_planteados', { avatarId: 'no-existe' });
  const desdeFlujo = await proponer('generar_anuncios_planteados', {}, deUnFlujo);
  base();
  matrizIA = JSON.stringify({ matriz: [{ avatar: 1, razones: [{ nombre: 'Dejar de vender a mano', descripcion: 'x', copy: 'x' }] }, { avatar: 2, razones: [{ nombre: 'Cobrar más por sesión', descripcion: 'x', copy: 'x' }] }] });
  // Con todo lleno de trabajo y la IA repitiendo lo que ya está, no queda nada que cambiar: no se escribe.
  const fila = pg.db.app_settings.find((s) => s.workspace_id === WS && s.key === 'mako.razones');
  if (fila) fila.value = JSON.stringify(matriz().map((c) => ({ ...c, guiones: [GUION_GUARDADO] })));
  const antesNada = fila?.value;
  const nadaNuevo = await enElActo('generar_anuncios_planteados', {});
  salida('generar', {
    propGen, resumenGen, iaTrasProponer, generado, soloAv2, avatarFalso, desdeFlujo, nadaNuevo,
    nadaEscrito: fila?.value === antesNada,
    trasGenerar: trasGenerar.map((c) => ({ id: c.id, avatarId: c.avatarId, nombre: c.nombre, guiones: (c.guiones as unknown[]).length })),
    trasSoloAv2: trasSoloAv2.map((c) => ({ id: c.id, avatarId: c.avatarId, nombre: c.nombre })),
  });

  // ── editar_armada_con_ia ──
  base();
  const pasosNuevos = [
    { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
    { id: 'm1', canal: 'whatsapp', cuerpo: 'Hola {{lead_nombre}}, gracias por escribirnos', siguiente: 'm2' },
    // Una tarjeta TAG con una etiqueta NUEVA: el modelo la nombra por un ref negativo (lib/flujo-ia.ts, `conEtiquetasReales`).
    { id: 'm2', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { etiquetaId: -1 } }, siguiente: null },
  ];
  const edicion: Editar = {
    t: 'edicion', ia: 'Gemini',
    r: { pasos: pasosNuevos, etiquetasNuevas: [{ ref: -1, nombre: 'Saludado' }], avisos: [], nombre: null, agregadas: ['m2'], cambiadas: ['m1'], quitadas: [], resumen: 'Cambié 1 · agregué 1. Está en el borrador: toca Publicar.' },
  };
  editarIA = edicion;
  const pedido = 'que el saludo diga gracias por escribirnos y que le ponga la etiqueta Saludado';
  const pendiente = await proponer('editar_armada_con_ia', { secuenciaId: 41, pedido });
  const pendFila = pendiente.ok && pendiente.tipo === 'pendiente' ? pg.db.mako_acciones_pendientes.find((p) => p.id === pendiente.pendiente.id) : null;
  const cuerpoTrasProponer = cuerpoM1();
  const etiquetasTrasProponer = pg.db.crm_etiquetas.length;
  const editado = await enElActo('editar_armada_con_ia', { secuenciaId: 41, pedido });
  const tras = pg.db.nutricion_secuencias.find((s) => s.id === 41)?.pasos as Array<Record<string, unknown>>;
  // La propuesta de ANTES ya no vale: la automatización cambió (la editó otro, o la edición de recién). Se cierra sin tocar nada.
  const vieja = pendFila ? await runWithWorkspace(WS, () => confirmarPendiente(ctx, pendFila.id as number)) : null;
  const cuerpoTrasVieja = cuerpoM1();
  const estadoVieja = pendFila?.estado ?? null;
  editarIA = { t: 'contesta', respuesta: 'Eso ya está así: el saludo ya dice gracias.', ia: null };
  const contesta = await proponer('editar_armada_con_ia', { secuenciaId: 41, pedido: 'que diga gracias' });
  editarIA = edicion;
  const llamadasAntesDeLasGuardas = pedidosEditar.length;
  const ajena = await proponer('editar_armada_con_ia', { secuenciaId: 42, pedido: 'que diga gracias' });
  const sinPedido = await proponer('editar_armada_con_ia', { secuenciaId: 41 });
  const deFlujo = await proponer('editar_armada_con_ia', { secuenciaId: 41, pedido: 'que diga gracias' }, deUnFlujo);
  salida('editar', {
    pendiente: pendiente.ok ? { tipo: pendiente.tipo } : pendiente, resumenPendiente: pendFila?.resumen ?? null,
    payloadPendiente: pendFila?.payload ?? null, cuerpoTrasProponer, etiquetasTrasProponer,
    editado, tras, etiquetas: pg.db.crm_etiquetas.map((e) => ({ id: e.id, nombre: e.nombre })),
    vieja, cuerpoTrasVieja, estadoVieja, contesta, ajena, sinPedido, deFlujo,
    llamadasAntesDeLasGuardas, llamadasDespues: pedidosEditar.length,
    plazoHttpMs: pedidosEditar.length ? pedidosEditar[0].hastaMs - pedidosEditar[0].enviadoEn : null,
  });

  salida('fin', { red, sinMock: [...pg.sinMock], noEnFlujos: ['cargar_guiones_anuncio', 'generar_anuncios_planteados', 'editar_armada_con_ia'].filter((id) => NO_EN_FLUJOS.has(id)) });
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
