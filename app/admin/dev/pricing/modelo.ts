// =============================================================================
// El modelo de costos y precios — datos puros, medidos contra producción
// =============================================================================
// Separado del JSX a propósito: son los NÚMEROS de una proyección financiera, y
// enterrados adentro de un componente nadie los revisa ni los puede testear.
//
// ⚠️ REGLA DE ESTE ARCHIVO: cada número dice de dónde salió. Hay tres orígenes y
// no valen lo mismo:
//   · `medido`     — sale de `anthropic_usage` en producción. Es un hecho.
//   · `publicado`  — precio de lista de un proveedor, con su fecha. Envejece.
//   · `supuesto`   — lo pusimos nosotros para poder proyectar. Es discutible, y
//                    es lo primero que hay que mirar cuando el resultado extrañe.
// Un número sin origen es un número inventado. No agregar ninguno así.
//
// El análisis en prosa está en docs/costos-ia-y-planes.md.

export type Origen = 'medido' | 'publicado' | 'supuesto';

/** La ventana de la medición. Todo lo `medido` sale de acá. */
export const MEDICION = {
  desde: '2026-06-29',
  hasta: '2026-08-08',
  dias: 41,
  llamadas: 2249,
  tokens: 23_360_000,
  costUsd: 93.5,
  workspaces: 5,
  /** El día más caro de un solo workspace, en un solo día. */
  picoDiaUsd: 18.98,
} as const;

// ── Lo que cuesta cada acción, HOY ──────────────────────────────────────────
// Ojo con el denominador: es el costo de las llamadas que efectivamente SE
// PAGARON, no el promedio con las gratis adentro. Mezclarlas da un número que no
// sirve para cotizar, porque el free tier no escala.

export type Accion = {
  id: string;
  label: string;
  /** El tag de feature real que se le pasa a chatClaude/chatCheap. */
  feature: string;
  llamadasPagas: number;
  costoUsd: number;
  /** Qué multiplica las llamadas. Es lo que decide si se cobra por acción o por llamada. */
  multiplica: string;
  /** Se dispara solo (cron/webhook) o lo pide el usuario. */
  automatico: boolean;
};

export const ACCIONES: Accion[] = [
  { id: 'reunion', label: 'Extraer tareas de una reunión', feature: 'plan-fathom', llamadasPagas: 170, costoUsd: 35.1059, multiplica: 'por PARTE de transcript (se trocea cada 25.000 caracteres): una reunión de 2 h son 4-5 llamadas', automatico: true },
  { id: 'closing', label: 'Analizar una llamada de venta', feature: 'closing', llamadasPagas: 132, costoUsd: 22.818, multiplica: 'una por llamada de venta', automatico: true },
  { id: 'guardian', label: 'Priorizar un lote de tareas', feature: 'mako-guardian', llamadasPagas: 208, costoUsd: 15.1485, multiplica: 'una por tanda de 10 tareas, más una por lote para rutear a proyecto', automatico: false },
  { id: 'doer', label: 'Un mensaje a MaKo por WhatsApp', feature: 'mako-doer-in', llamadasPagas: 87, costoUsd: 7.7051, multiplica: 'hasta 8 pasos por lote de mensajes (loop de herramientas)', automatico: true },
  { id: 'experimentos', label: 'Retro / experimentos', feature: 'experimentos', llamadasPagas: 47, costoUsd: 4.6466, multiplica: 'una por corrida del retro', automatico: false },
  { id: 'checklist', label: 'Descripción + checklist de tareas', feature: 'checklist-coach', llamadasPagas: 92, costoUsd: 3.6437, multiplica: 'una por tanda de 10 tareas', automatico: false },
  { id: 'campana', label: 'Estructurar campaña de Meta', feature: 'campaign-suggest', llamadasPagas: 14, costoUsd: 0.995, multiplica: 'una por campaña', automatico: false },
  { id: 'validador', label: 'Validar plantilla de WhatsApp', feature: 'validador', llamadasPagas: 20, costoUsd: 0.7994, multiplica: 'una por plantilla', automatico: false },
  { id: 'ads', label: 'Analizar un anuncio', feature: 'ads-analyst', llamadasPagas: 18, costoUsd: 0.5118, multiplica: 'una por anuncio con transcripción', automatico: true },
];

/** Costo unitario real de una acción. */
export const costoUnitario = (a: Accion) => a.costoUsd / a.llamadasPagas;

// ── Los escenarios de ruteo ─────────────────────────────────────────────────
// El MISMO consumo medido, facturado bajo distintas políticas de modelo. Es la
// palanca más grande que hay: entre el piso y el techo hay 8×.

export type Escenario = { id: string; label: string; usdPeriodo: number; que: string; origen: Origen };

export const ESCENARIOS: Escenario[] = [
  { id: 'real', label: 'Lo que se pagó de verdad', usdPeriodo: 91.34, origen: 'medido', que: 'Los free tiers de Gemini/Groq/Mistral cuentan $0 porque hoy no cobran.' },
  { id: 'sinfree', label: 'Mismo ruteo, sin free tier', usdPeriodo: 95.93, origen: 'publicado', que: 'Cada proveedor a su precio de lista. El free tier tapa poco si el ruteo se mantiene.' },
  { id: 'cascada', label: 'Se agota el free tier y todo cae a Sonnet', usdPeriodo: 135.75, origen: 'publicado', que: 'El peor caso realista: los límites gratis son por key y por día, no escalan con la cantidad de clientes.' },
  { id: 'disciplina', label: 'Disciplina de ruteo (Opus → Gemini pago)', usdPeriodo: 63.36, origen: 'publicado', que: 'Bajar de Opus lo que no necesita Opus, pagando Gemini Flash.' },
  { id: 'piso', label: 'Piso: todo Gemini Flash pago', usdPeriodo: 16.38, origen: 'publicado', que: 'El límite teórico con calidad aceptable. No es alcanzable para closing ni para el Perro, pero marca el rango.' },
];

/** Los escenarios están medidos sobre la ventana de 41 días: a mes calendario. */
export const aMes = (usdPeriodo: number) => (usdPeriodo / MEDICION.dias) * 30;

// ── Los planes ──────────────────────────────────────────────────────────────

export type Plan = {
  id: 'free' | 'pro' | 'growth';
  label: string;
  precioUsd: number;
  /** Qué incluye, para la tabla de la landing. */
  incluye: string[];
  noIncluye: string[];
};

/**
 * 1.000 MaKo Tokens = US$1 de **PRECIO DE LISTA** — el inverso de `USD_POR_MT`.
 *
 * ⚠️ Ojo con el rótulo: NO es «US$1 de costo». El costo real de 1.000 MT es
 * US$1 / `MARKUP_MT` ≈ US$0,42. La pantalla dijo «US$1 de costo de IA» durante
 * un rato y hacía parecer que el cupo del Growth costaba US$50 cuando cuesta
 * US$21 — el error se ve recién cuando los dos números están en la misma vista.
 *
 * La unidad es de PRECIO, no tokens de modelo: así se cambia de proveedor sin
 * rehacer los planes.
 */
export const MT_POR_USD = 1000;

// ⚠️ El cupo de cada plan NO vive acá: vive en `CUPO_MT`, junto a la TARIFA que
// lo hace legible. Estuvo duplicado (1.500/12.000/25.000 acá contra
// 600/5.000/50.000 allá) y la pantalla pintaba el viejo. Un cupo es un número
// que solo significa algo contra la tarifa; separarlos es lo que los desincronizó.
export const PLANES: Plan[] = [
  {
    id: 'free', label: 'Free', precioUsd: 0,
    incluye: ['El plan y el Perro Guardián', 'CRM y funnel', 'Un workspace, un usuario', 'MaKo por WhatsApp, con cupo'],
    noIncluye: ['Integraciones que disparan IA sola (Fathom, Meta, Evolution)', 'Análisis de llamadas', 'Generación de creativos', 'BYOK'],
  },
  {
    id: 'pro', label: 'Pro', precioUsd: 47,
    incluye: ['Todo lo del Free', 'Fathom: reuniones → tareas', 'Closing Analyst', 'Ads Analyst', 'Hasta 3 usuarios'],
    noIncluye: ['Generación de video', 'BYOK', 'Usuarios ilimitados'],
  },
  {
    id: 'growth', label: 'Growth', precioUsd: 97,
    incluye: ['Todo lo del Pro', 'Fábrica de creativos (imagen)', 'Nutrición automática', 'Hasta 10 usuarios', 'BYOK de texto'],
    noIncluye: [],
  },
];

/** Margen bruto de un plan dado un costo de IA mensual. */
export function margen(plan: Plan, costoIaUsd: number): number | null {
  if (plan.precioUsd === 0) return null;
  return ((plan.precioUsd - costoIaUsd) / plan.precioUsd) * 100;
}

/** El techo de IA que tolera un plan para sostener el margen objetivo. */
export const MARGEN_OBJETIVO = 0.75;
export const techoIa = (plan: Plan) => plan.precioUsd * (1 - MARGEN_OBJETIVO);

// ── Los bloqueantes del medidor ─────────────────────────────────────────────
// No son "mejoras": sin estos, el cupo de MaKo Tokens no se puede ni medir ni
// cobrar. Verificados contra el código el 08/08/2026.

export type Bloqueante = { id: string; titulo: string; que: string; vive: string; orden: number };

export const BLOQUEANTES: Bloqueante[] = [
  { id: 'atribucion', orden: 1, titulo: 'El gasto de Claude no se puede atribuir a un cliente', vive: 'lib/anthropic-usage.ts:22-25', que: '`wsDeProveedor()` devuelve `OWNER_WS` para todo lo que sea Anthropic, así que TODA fila de Claude se escribe en el workspace 1 venga de donde venga. Como Claude es el ~99% del gasto, hoy el costo por cliente es literalmente inmedible. Es el bloqueante #1: sin esto, el cupo le cobra todo a ws1.' },
  { id: 'ciegos', orden: 2, titulo: 'Tres módulos gastan sin registrar y siempre contra la key de la agencia', vive: 'lib/embeddings.ts · lib/transcribe.ts · app/api/ads-manager/analyze-creatives', que: 'Ninguno llama a `recordUsage` y los tres resuelven la key con `envCred` (que siempre cae al workspace dueño) en vez de `credWs`. Uno de ellos corre en CADA búsqueda del RAG. El baseline medido es un piso, no un total, y el cupo se evade por tres puertas.' },
  { id: 'registro', orden: 3, titulo: 'El registro no es confiable como base de un cobro', vive: 'lib/ai-cheap.ts (6 call-sites) · lib/anthropic-usage.ts:76-87', que: 'Los 6 registros de la IA barata son `void` sin `await` (en serverless la instancia se congela con el INSERT en vuelo), y `insertUsage` nunca lee el `{ error }` que devuelve supabase-js: un rechazo de RLS se pierde sin log. Además un fallo de LECTURA se lee como «cero uso», que es el sentido más caro del error.' },
  { id: 'denegacion', orden: 4, titulo: 'No existe ninguna primitiva que corte una llamada por gasto', vive: 'lib/ia-cuotas.ts:86-93', que: '`ordenarPorCuota` devuelve la misma cantidad de proveedores que entró — «nunca los saca: solo los manda al final». No hay en todo `lib/` una rama que rechace una llamada por dinero. El enforcement hay que escribirlo entero, y el chequeo tiene que ser PRE-flight: los `recordUsage` son posteriores a la llamada.' },
  { id: 'modelo-por-plan', orden: 5, titulo: 'No se puede rutear el Free a barato y dejar Opus en Growth', vive: 'lib/model-registry.ts:99', que: 'Los overrides de modelo son globales del dueño (`leerOverrides` corre en `OWNER_WS`). No hay dimensión de workspace ni de plan, así que bajar el modelo para contener el Free se lo baja también al Growth.' },
];

// ── La IA que se dispara sola ───────────────────────────────────────────────
// La bomba del plan Free: gasta sin que el usuario entre a la app.

export type Automatico = { id: string; label: string; disparador: string; techo: string; proyeccion: string };

export const AUTOMATICOS: Automatico[] = [
  { id: 'fathom-webhook', label: 'Webhook de Fathom → post-llamada', disparador: 'La agenda del cliente (un tercero)', techo: 'ninguno', proyeccion: '10 llamadas/día ≈ US$52/mes — más que el plan Pro entero' },
  { id: 'closing-cron', label: 'Cron closing-sync', disparador: '1×/día, itera todos los workspaces con Fathom', techo: '6 análisis con Opus por workspace', proyeccion: '≈ US$31/mes por cliente' },
  { id: 'fathom-cron', label: 'Cron fathom-plan', disparador: '13×/día', techo: '3 reuniones por corrida (39/día teórico)', proyeccion: 'el feature más caro medido: US$35 en 40 días para UN workspace' },
  { id: 'doer-flush', label: 'Cron doer-flush', disparador: 'cada minuto, barre TODOS los workspaces', techo: '—', proyeccion: 'escala con el WhatsApp del cliente' },
  { id: 'evolution', label: 'Webhook de Evolution', disparador: 'Cada mensaje de grupo de WhatsApp', techo: '8 pasos de herramientas', proyeccion: 'escala con el WhatsApp del cliente' },
  { id: 'ads-cron', label: 'Cron ads-analyst-sync', disparador: '1×/día, todos los workspaces con Meta', techo: '6 análisis con Sonnet', proyeccion: 'escala con la cantidad de creativos' },
];

// ── Lo que va a costar lo que TODAVÍA no existe ─────────────────────────────
// Precios de lista relevados el 08/08/2026 contra la página oficial de cada
// proveedor. Son `publicado`: envejecen, y en generación de medios envejecen
// RÁPIDO — tres modelos de esta lista se apagan dentro del año.

export type Medio = {
  id: string;
  proveedor: string;
  modelo: string;
  usd: number;
  unidad: string;
  nota: string;
  /** Fecha de apagado anunciada. Si está, NO se construye sobre esto. */
  muere?: string;
};

export const VIDEO: Medio[] = [
  { id: 'veo31-lite', proveedor: 'Google', modelo: 'Veo 3.1 Lite', usd: 0.05, unidad: 'por segundo (720p)', nota: 'Lo más barato del mercado CON audio nativo. 1080p $0,08. Clips de 5-8 seg.' },
  { id: 'runway-turbo', proveedor: 'Runway', modelo: 'Gen-4 Turbo', usd: 0.05, unidad: 'por segundo', nota: '5 créditos/seg a $0,01. 480p-1080p. Sin audio.' },
  { id: 'kling25', proveedor: 'Kuaishou', modelo: 'Kling 2.5 Turbo Pro', usd: 0.07, unidad: 'por segundo (mínimo 5 seg)', nota: '$0,35 fijo por los primeros 5 seg + $0,07 el adicional. El mínimo castiga los clips cortos.' },
  { id: 'veo31-fast', proveedor: 'Google', modelo: 'Veo 3.1 Fast', usd: 0.10, unidad: 'por segundo (720p)', nota: '1080p $0,12; 4K $0,30. Audio incluido.' },
  { id: 'sora2', proveedor: 'OpenAI', modelo: 'Sora 2', usd: 0.10, unidad: 'por segundo (720p)', nota: 'Batch a $0,05. NO INTEGRAR: OpenAI apaga toda la Videos API sin reemplazo.', muere: '2026-09-24' },
  { id: 'veo31', proveedor: 'Google', modelo: 'Veo 3.1', usd: 0.40, unidad: 'por segundo', nota: '720p y 1080p al mismo precio; 4K $0,60. Audio nativo.' },
];

/** Ningún modelo genera 15 seg de una: son 2-3 llamadas más un stitch. */
export const VIDEO_15S = {
  que: 'Un anuncio de 15 segundos, un solo intento',
  piso: 0.75,
  pisoQuien: 'Veo 3.1 Lite 720p (2 clips de 8+7 seg)',
  nota: 'Veo hace clips de 5-8 seg, Runway llega a 10, Kling factura en bloques de 5. Los 15 seg SIEMPRE son 2-3 llamadas + un stitch: es la arquitectura, no una optimización pendiente. Y esto es UN intento — en creativos publicitarios nadie acierta al primero.',
};

export const IMAGEN: Medio[] = [
  { id: 'gpt-mini', proveedor: 'OpenAI', modelo: 'gpt-image-1-mini (low)', usd: 0.005, unidad: 'por imagen 1024²', nota: 'medium $0,011 · high $0,036. Lo más barato para borradores en volumen.' },
  { id: 'gpt2-low', proveedor: 'OpenAI', modelo: 'gpt-image-2 (low)', usd: 0.006, unidad: 'por imagen 1024²', nota: 'Vertical y horizontal salen $0,005 — más barato que el cuadrado, único caso invertido del relevamiento.' },
  { id: 'flux-klein', proveedor: 'Black Forest Labs', modelo: 'FLUX.2 klein', usd: 0.014, unidad: 'por imagen de 1 MP', nota: 'Mismo precio generar que editar.' },
  { id: 'flux-pro', proveedor: 'Black Forest Labs', modelo: 'FLUX.2 pro', usd: 0.03, unidad: 'por imagen de 1 MP', nota: 'Editar cuesta $0,045: el ÚNICO proveedor que cobra la edición distinto (+50%).' },
  { id: 'nb2-batch', proveedor: 'Google', modelo: 'Nano Banana 2 — batch', usd: 0.034, unidad: 'por imagen 1K', nota: 'Batch = 50% off. La mejor relación precio/calidad para lotes que no son en vivo.' },
  { id: 'nb2', proveedor: 'Google', modelo: 'Nano Banana 2 (gemini-3.1-flash-image)', usd: 0.067, unidad: 'por imagen 1K', nota: 'Edición conversacional multi-turno: genera y edita en el mismo turno. 2K $0,101 · 4K $0,151.' },
  { id: 'nb-pro', proveedor: 'Google', modelo: 'Nano Banana Pro', usd: 0.134, unidad: 'por imagen 1K/2K', nota: '4K $0,24. La imagen de ENTRADA cuesta $0,0011, o sea editar sale casi lo mismo que generar.' },
  { id: 'imagen4', proveedor: 'Google', modelo: 'Imagen 4', usd: 0.04, unidad: 'por imagen', nota: 'NO ARRANCAR NADA ACÁ. Google lo reemplaza por Nano Banana.', muere: '2026-08-17' },
];

export const AUDIO: Medio[] = [
  { id: 'groq-turbo', proveedor: 'Groq', modelo: 'whisper-large-v3-turbo', usd: 0.04, unidad: 'por hora de audio', nota: 'STT. Lo más barato por lejos: 9× más barato que whisper-1.' },
  { id: 'aai', proveedor: 'AssemblyAI', modelo: 'Universal-2', usd: 0.15, unidad: 'por hora de audio', nota: 'STT. El más barato fuera de Groq.' },
  { id: 'scribe2', proveedor: 'ElevenLabs', modelo: 'Scribe v2', usd: 0.22, unidad: 'por hora de audio', nota: 'STT batch. Realtime $0,39/h.' },
  { id: 'whisper1', proveedor: 'OpenAI', modelo: 'whisper-1', usd: 0.36, unidad: 'por hora de audio', nota: '⚠️ ES EL QUE MaKo USA HOY, hardcodeado en lib/transcribe.ts. gpt-4o-mini-transcribe hace lo mismo por la mitad, y Groq por 1/9.' },
  { id: 'gtts', proveedor: 'Google', modelo: 'Cloud TTS Standard', usd: 0.004, unidad: 'por 1.000 caracteres', nota: 'TTS. Y regala 4 MILLONES de caracteres por mes (~66 horas de voz).' },
  { id: 'el-flash', proveedor: 'ElevenLabs', modelo: 'Flash v2.5 / Turbo v2.5', usd: 0.05, unidad: 'por 1.000 caracteres', nota: 'TTS, ~$0,05 por minuto de audio. Ya está cableado como integración en el repo.' },
  { id: 'el-multi', proveedor: 'ElevenLabs', modelo: 'Multilingual v2 / v3', usd: 0.10, unidad: 'por 1.000 caracteres', nota: 'TTS. El más caro del relevamiento; la calidad que justifica la marca.' },
];

// ── La economía del negocio, no la de la IA ─────────────────────────────────
// Acá está el hallazgo que más pesa de todo el análisis, y no es de costos.

export type Dato = { id: string; titulo: string; numero: string; que: string; fuente: string };

// El hallazgo más fuerte del análisis, en números y no en prosa: ChartMogul midió
// la retención de 200 empresas AI-native SEGMENTADA POR PRECIO DE LISTA, y el
// resultado es monótono — cuanto más barato, peor retiene. Sirve graficado porque
// lo que importa es el salto entre bandas, y eso una tabla no lo muestra.
export type BandaRetencion = { id: string; banda: string; grrAnual: number; nrr: number; cae: string | null };

export const RETENCION: BandaRetencion[] = [
  { id: 'baja', banda: 'Menos de US$50/mes', grrAnual: 23, nrr: 34, cae: 'Pro · US$47' },
  { id: 'media', banda: 'US$50 a 249/mes', grrAnual: 45, nrr: 61, cae: 'Growth · US$97' },
  { id: 'alta', banda: 'Más de US$250/mes', grrAnual: 70, nrr: 85, cae: null },
];

export const RETENCION_FUENTE =
  'ChartMogul, «The SaaS Retention Report: The AI churn wave» — 3.500 empresas de software, 200 de ellas AI-native, datos 2025';

/** Los benchmarks contra los que se lee todo lo de arriba. Sin ellos un número
 *  suelto no dice si está bien o mal. */
export const BENCHMARKS = [
  { id: 'ltvcac', que: 'LTV : CAC', objetivo: '3× mínimo · 4,1× la mediana real', fuente: 'Aleph × Benchmarkit 2026' },
  { id: 'payback', que: 'Payback del CAC', objetivo: '≤ 15 meses · 11 en ACV sub-US$5K', fuente: 'Aleph × Benchmarkit 2026' },
  // Dos fuentes independientes dan casi lo mismo y se citan las dos: promediarlas
  // escondería que coinciden, que es justamente lo que les da peso.
  { id: 'margen', que: 'Margen bruto', objetivo: '75-80% en SaaS · 50-53% en producto de IA', fuente: 'Benchmarkit · ICONIQ 2026 (53% promedio, n≈300) · Poyar 2026 (50% mediana, n=230)' },
];

export const ECONOMIA: Dato[] = [
  {
    id: 'grr-banda', titulo: 'El benchmark que aplica no es «SaaS PyME», es «AI-native» — y el Pro cae en la peor banda',
    numero: '<US$50/mes → GRR 23% anual · US$50-249 → 45% · >US$250 → 70%',
    que: 'ChartMogul segmentó la retención de 200 empresas AI-native por precio de lista y el resultado es monótono: cuanto más barato, peor retiene. Los productos de más de US$250/mes retienen casi como el SaaS tradicional; los de menos de US$50 se desploman. El Pro a US$47 está del lado equivocado del corte, por dos dólares.',
    fuente: 'ChartMogul, «The SaaS Retention Report: The AI churn wave» (3.500 empresas, 200 AI-native, datos 2025)',
  },
  {
    id: 'canales', titulo: 'El CAC real de los dos canales: WhatsApp cierra contra el Pro, el carrito directo no',
    numero: 'CTWA → free → pago: US$83 · carrito directo: US$76-179',
    que: 'CAC = costo_conversación / (conversación→registro × free→pago). Con US$1,50 por conversación (banda B2B en México/Colombia reconstruida desde el CPM) y el caso base 30%×6%, el canal de WhatsApp da US$83: entra en lo máximo que se puede pagar por un Pro con la regla laxa (US$104), no con la estricta (US$53). El carrito frío se pasa de lo que vale un Pro en casi toda su banda y entra cómodo en lo que vale un Growth. Decisión: vender Growth o anual en el carrito y rutear el Pro mensual a WhatsApp. Y el cobro anual mueve ese máximo de US$104 a más de US$700.',
    fuente: 'Cálculo propio sobre CPM/CPC por país (adamigo, 6/8/2026) + free→pago de ChartMogul (n=200, ene 2026)',
  },
  {
    id: 'cobro-latam', titulo: 'El impuesto invisible: en LATAM se pierde ~45% del checkout por cobro, no por copy',
    numero: 'Aprobación cross-border 65-75% vs 85-92% de rieles locales · solo ~28% tiene tarjeta de crédito',
    que: 'Pasar de 70% a 88% de aprobación baja el CAC del carrito de US$119 a US$95 — 20% menos sin tocar el anuncio. Y pega dos veces: el rebill también falla, lo que sube el churn efectivo de ~5% a 8-10% mensual, corta la vida útil de ~20 meses a 10-12 y con ella lo que se puede pagar por un cliente. El US$104 del Pro sería más bien US$55-70 mientras se cobre solo con tarjeta internacional. Se lee como «los clientes se van», nunca como «el cobro está roto».',
    fuente: 'dodopayments / Allied Global / crea.la sobre pagos en LATAM + churn SMB self-serve (Vena/Recurly Q1-Q2 2025)',
  },
  {
    id: 'techo-cac', titulo: 'Lo máximo que se puede pagar por un cliente de cada plan',
    numero: 'Pro: US$53-104 · Growth: US$194-381',
    que: 'Derivado de cruzar la retención AI-native por banda de precio con el margen bruto y una relación LTV:CAC de 3 a 4,1×. El Growth a US$97 tiene una vida media de ~15,5 meses y un LTV de US$797-1.143 sobre margen bruto. Si adquirir un cliente cuesta más que eso, cada venta destruye valor.',
    fuente: 'Derivado: ChartMogul (retención) + ICONIQ State of AI 2026 (margen 53%) + Benchmarkit (LTV:CAC)',
  },
  {
    id: 'ltvcac', titulo: 'La regla de «3:1» quedó vieja como piso: la mediana real es 4,1×',
    numero: 'Mediana 4,1× · cuartil superior 7,8× · cuartil inferior 1,1×',
    que: 'El cuartil inferior literalmente destruye valor con cada cliente que suma. Vertical SaaS llega a 5,6×. Y se calcula sobre MARGEN BRUTO, no sobre facturación — el error más común.',
    fuente: 'Aleph × Benchmarkit, «2026 SaaS & AI Performance Benchmarks» (342 empresas, datos FY2025)',
  },
  {
    id: 'payback', titulo: 'El payback mediano del mercado es 16 meses; con esta retención MaKo necesita 3-4',
    numero: 'Mediana 16 meses · sub-US$5K de ACV: 11 meses · cuartil superior ≤6',
    que: 'Con una vida media de 15,5 meses en la banda del Growth, un payback de 16 meses significa que el cliente se va antes de haber pagado su propia adquisición.',
    fuente: 'Aleph × Benchmarkit 2026',
  },
  {
    id: 'margen', titulo: 'Los dos márgenes brutos que se citan no se contradicen: aplican a cosas distintas',
    numero: 'Software 80% (Benchmarkit) vs producto de IA 53% (ICONIQ)',
    que: 'Benchmarkit mide software clásico y dice que la infraestructura de IA «todavía no comprimió los márgenes». ICONIQ mide productos de IA y le da 53%. MaKo es lo segundo. Planificar con 80% es planificar con el margen de otra industria.',
    fuente: 'Aleph × Benchmarkit + ICONIQ Growth «State of AI: Bi-Annual Snapshot» 2026',
  },
  {
    id: 'inferencia', titulo: 'El COGS de inferencia se lleva ~23%, pero las fuentes discrepan sobre 23% DE QUÉ',
    numero: '23% (del gasto en IA, o de la facturación, según quién lo cite)',
    que: 'El dato de ICONIQ se reporta de dos maneras incompatibles en la prensa secundaria. Se usa como orden de magnitud, no como número fino.',
    fuente: 'ICONIQ Growth «State of AI» 2026',
  },
];

// ── Cómo cobran los que ya lo resolvieron ───────────────────────────────────
// Lo que importa no es el precio: es el MECANISMO. Qué pasa cuando se acaba el
// cupo es una decisión de producto, y hay una sola respuesta buena.

export const COMPETENCIA: Dato[] = [
  {
    id: 'hubspot-mecanica', titulo: 'HubSpot da a elegir QUÉ pasa cuando se acaban los créditos, y el default es frenar',
    numero: 'Pausar (default) · Auto-upgrade · Pay-as-you-go a US$0,010 el crédito',
    que: 'Tres comportamientos configurables. El default para cuentas nuevas es PAUSAR — no cobrar de más sin permiso. El auto-upgrade te sube de plan hasta la renovación del contrato, y por eso la recomendación general es habilitar pay-as-you-go en su lugar: evita el salto de plan sorpresa. Para MaKo la lectura es directa: el cupo agotado no puede degradar la calidad en silencio ni cobrar sin avisar; tiene que frenar y ofrecer.',
    fuente: 'HubSpot AI credits 2026 — eesel.ai / huboexperts.com',
  },
  {
    id: 'hubspot-precio', titulo: 'El crédito de HubSpot cotiza a US$0,01, y publican cuántas acciones rinde',
    numero: 'US$10 por 1.000 créditos (US$9 anual) · 3.000 créditos ≈ 60 conversaciones resueltas',
    que: 'No esconden la tabla: dicen cuántas acciones reales entran en el cupo y cuánto sale cada una pasada esa línea (US$0,45 por resolución en Enterprise). Es exactamente el molde del menú de MaKo Tokens — y valida la unidad elegida: su crédito vale US$0,01, el MaKo Token vale US$0,001, o sea diez veces más granular.',
    fuente: 'HubSpot pricing 2026 — usagepricing.com / eesel.ai',
  },
  {
    id: 'byok-breakeven', titulo: 'BYOK como beneficio del plan anual tiene el punto de equilibrio a favor',
    numero: 'BYOK gana arriba de ~200 salidas de IA por mes · debajo de 50, gana el cupo administrado',
    que: 'El costo directo del proveedor sale 40-60% más barato que un tier administrado, pero recién compensa la fricción de conseguir y cargar la key con volumen alto. Eso valida la tarea #312: BYOK NO va en el Free (a ese volumen solo agrega fricción y no ahorra nada) sino arriba, donde el usuario ya factura suficiente como para que le convenga. El modelo híbrido que se está imponiendo —cuota fija de plataforma US$20-50 más el costo real del proveedor— es casi exactamente el Growth anual con BYOK.',
    fuente: 'Kompozy «BYOK vs managed: the real break-even math» + buildmvpfast.com, 2026',
  },
];

// ── PASO 2: lo que cuesta el producto COMPLETO ──────────────────────────────
// El producto de hoy son 55 áreas cerradas de 122. Esto proyecta las 38 que
// faltan más las 29 a medias, con el ruteo elegido en el paso 1.
//
// ⚠️ Dos tipos de número conviven acá y NO valen lo mismo:
//   · el COSTO UNITARIO es `publicado` — sale de la página del fabricante;
//   · la CANTIDAD MENSUAL es `supuesto` — la pusimos nosotros. Es lo primero
//     que hay que discutir si el resultado extraña, y la palanca de todo.

/** El ruteo del paso 1, en un solo lugar. US$ por millón de tokens. */
export const RUTEO = [
  { id: 'luna', modelo: 'gpt-5.6-luna', inUsd: 0.20, outUsd: 1.20, para: 'Análisis con juicio (llamadas, competidores, VSL)', origen: 'publicado' as Origen },
  { id: 'qwen', modelo: 'Qwen3.7-Flash', inUsd: 0.03, outUsd: 0.13, para: 'Contexto enorme: la reunión entera sin trocear (1M)', origen: 'publicado' as Origen },
  { id: 'kimi', modelo: 'Kimi K2.6', inUsd: 0.95, outUsd: 4.00, para: 'Copy con voz de marca (lo juzga un humano, no un índice)', origen: 'publicado' as Origen },
  { id: 'glm', modelo: 'GLM-4.7-Flash', inUsd: 0, outUsd: 0, para: 'Clasificar contra una rúbrica. Gratis, entrada y salida', origen: 'publicado' as Origen },
  { id: 'opus', modelo: 'Claude Opus 4.8', inUsd: 5, outUsd: 25, para: 'Solo la Retro: su salida gobierna decisiones de plata', origen: 'publicado' as Origen },
];

/** Lo que ya existe, medido, contra lo que costaría con el ruteo nuevo. */
export type Reruteo = { id: string; label: string; hoyUsd: number; nuevoUsd: number; como: string };

export const RERUTEO: Reruteo[] = [
  // ⚠️ Los `nuevoUsd` van SIN redondear a 4 decimales, a propósito: la pantalla
  // calcula el múltiplo dividiendo, y con 0,0021 en vez de 0,00213 el 436× de
  // arriba se pintaba 443× tres párrafos más abajo. Una cifra redondeada para
  // mostrar no sirve para derivar otra.
  { id: 'reunion', label: 'Extraer tareas de una reunión de 2 h', hoyUsd: 0.9293, nuevoUsd: 0.00213, como: 'Qwen3.7-Flash con 1M de contexto: entra entera y desaparecen las 4-5 llamadas del troceo' },
  { id: 'doer', label: 'Un mensaje a MaKo por WhatsApp', hoyUsd: 0.0886, nuevoUsd: 0.00114, como: 'El router barato, hasta 8 pasos de herramientas' },
  { id: 'closing', label: 'Analizar una llamada de venta', hoyUsd: 0.1729, nuevoUsd: 0.0108, como: 'gpt-5.6-luna — mismo nivel de índice que modelos 7,5× más caros' },
  { id: 'campana', label: 'Estructurar una campaña de Meta', hoyUsd: 0.0711, nuevoUsd: 0.0127, como: 'Kimi K2.6, el mejor de los baratos en preferencia humana' },
  { id: 'guardian', label: 'Priorizar un lote de tareas', hoyUsd: 0.0728, nuevoUsd: 0, como: 'GLM-4.7-Flash: clasificar contra rúbrica es gratis' },
  { id: 'checklist', label: 'Descripción + checklist de un lote', hoyUsd: 0.0396, nuevoUsd: 0, como: 'gratis' },
  { id: 'validador', label: 'Validar una plantilla de WhatsApp', hoyUsd: 0.0400, nuevoUsd: 0, como: 'gratis' },
  { id: 'ads', label: 'Analizar un anuncio', hoyUsd: 0.0284, nuevoUsd: 0, como: 'gratis' },
  { id: 'retro', label: 'Retro / experimentos', hoyUsd: 0.0989, nuevoUsd: 0.0989, como: 'NO se mueve: es el único análisis cuya salida gobierna decisiones de plata' },
];

/** Las acciones del producto que todavía no existe. `medio: true` = compra píxeles. */
export type AccionNueva = { id: string; familia: 'Analyze' | 'Sales' | 'Content' | 'Agentes'; label: string; usd: number; usdBarato?: number };

export const ACCIONES_NUEVAS: AccionNueva[] = [
  { id: 'competitor', familia: 'Analyze', label: 'Competitor Spy — un competidor', usd: 0.0086 },
  // «Offer» desde el 11/10/2026: Analyst y Generator son UNA tab (/offer). El costo por acción
  // sigue siendo la estimación de antes de construirla; no se re-midió con el chat real.
  { id: 'offer', familia: 'Analyze', label: 'Offer', usd: 0.0076 },
  { id: 'vsl-an', familia: 'Analyze', label: 'VSL Analyst', usd: 0.0108 },
  { id: 'chat-an', familia: 'Analyze', label: 'Chat Analyst — una conversación', usd: 0.0060 },
  { id: 'cs-an', familia: 'Analyze', label: 'CS Analyst', usd: 0.0076 },
  { id: 'yt-an', familia: 'Analyze', label: 'YouTube Analyst — un video', usd: 0.0086 },
  { id: 'vsl-gen', familia: 'Sales', label: 'VSL Generator — guion completo', usd: 0.0354 },
  { id: 'leadmagnet', familia: 'Sales', label: 'Lead Magnet Generator', usd: 0.0276 },
  { id: 'sales-mail', familia: 'Sales', label: 'Sales Email', usd: 0.0107 },
  { id: 'newsletter', familia: 'Sales', label: 'Newsletter', usd: 0.0157 },
  { id: 'closing-sc', familia: 'Sales', label: 'Closing Script', usd: 0.0196 },
  { id: 'roleplay', familia: 'Sales', label: 'Sales Roleplay — una sesión', usd: 0.0300 },
  { id: 'ideas', familia: 'Content', label: 'Ideas — una tanda', usd: 0 },
  { id: 'yt-writer', familia: 'Content', label: 'YouTube Writer — un guion', usd: 0.0295 },
  { id: 'img', familia: 'Content', label: 'Image Generator — 1 imagen', usd: 0.034, usdBarato: 0.015 },
  { id: 'stories', familia: 'Content', label: 'Story — 1 imagen', usd: 0.034, usdBarato: 0.015 },
  { id: 'thumb', familia: 'Content', label: 'Thumbnail — 2 variantes', usd: 0.068, usdBarato: 0.030 },
  { id: 'carousel', familia: 'Content', label: 'Carrusel — 7 imágenes', usd: 0.238, usdBarato: 0.105 },
  { id: 'video', familia: 'Content', label: 'Video Generator — clip de 8 s', usd: 0.40, usdBarato: 0.15 },
  { id: 'reel', familia: 'Content', label: 'Reel de 15 s — 3 intentos + voz', usd: 2.445, usdBarato: 0.945 },
  { id: 'ads-bot', familia: 'Agentes', label: 'Ads Optimizer Bot — una corrida diaria', usd: 0.0108 },
  { id: 'autoclose', familia: 'Agentes', label: 'Auto-Close / CRM Automation — un lead', usd: 0 },
];

/** El costo mensual de IA de un cliente con el producto completo.
 *  ⚠️ Las CANTIDADES son supuestas. El costo unitario, no. */
export type Perfil = { plan: 'free' | 'pro' | 'growth'; precioUsd: number; iaUsd: number; iaUsdBarato: number; textoUsd: number; mediosUsd: number };

export const PERFILES: Perfil[] = [
  { plan: 'free', precioUsd: 0, iaUsd: 0.02, iaUsdBarato: 0.02, textoUsd: 0.02, mediosUsd: 0 },
  { plan: 'pro', precioUsd: 47, iaUsd: 1.87, iaUsdBarato: 1.15, textoUsd: 0.58, mediosUsd: 1.29 },
  { plan: 'growth', precioUsd: 97, iaUsd: 27.40, iaUsdBarato: 12.60, textoUsd: 2.82, mediosUsd: 24.58 },
];

// ── LA TARIFA DE MaKo TOKENS ────────────────────────────────────────────────
// Decisión del dueño (09/08/2026): «Sí o sí debe ser MaKo Tokens, porque hay
// muchas operaciones de IA… y cada una debe costar diferente cantidad».
//
// 1 MT = US$0,001 de precio de lista. NO es la unidad de HubSpot (US$0,01): con
// el texto adentro de la cuota, a un centavo por token las operaciones baratas
// caen todas debajo de 1 y hay que inventar un piso que sobrecobra. A un décimo
// de centavo, un mensaje a MaKo vale 1 MT de verdad y un Reel vale 2.000.
//
// ⚠️ EL ESTADÍSTICO ES LA MEDIA, y esa es la decisión que más mueve los números.
// La distribución de tokens de SALIDA es asimétrica a la derecha: la media es
// 1,9× a 3× la mediana en casi todas las features medidas. Tarifar por mediana
// subcobra y la cola se come el margen —con la Retro en Opus, el mes malo del
// Growth daba −58%—; tarifar por p90 sobrecobra al 90% de los usuarios. La media
// es, por definición, lo que se paga cuando se corren muchas.
//
// Los `origen: 'medido'` salen de `anthropic_usage` (media real sobre n llamadas,
// 29/06-08/08/2026). Los `supuesto` son de features que todavía no existen: son
// lo PRIMERO a recalibrar cuando corran.

export type OpTarifa = {
  id: string;
  grupo: 'Conversar' | 'Plan' | 'Análisis' | 'Escribir' | 'Automático' | 'Medios';
  label: string;
  /** Costo medio real de UNA operación, en USD. */
  costoUsd: number;
  /** Lo que se le cobra al cliente, en MaKo Tokens. */
  mt: number;
  origen: Origen;
  /** Cuántas llamadas reales respaldan el número. 0 = sin medir. */
  n: number;
};

export const MARKUP_MT = 2.4;
/** 1 MT = US$0,001 de precio de lista. Ver el encabezado de esta sección. */
export const USD_POR_MT = 0.001;

export const TARIFA: OpTarifa[] = [
  { id: 'mako-msg', grupo: 'Conversar', label: 'Un mensaje a MaKo (web o WhatsApp)', costoUsd: 0.00038, mt: 1, origen: 'medido', n: 337 },
  { id: 'mako-chat', grupo: 'Conversar', label: 'Preguntarle a MaKo sobre un gráfico', costoUsd: 0.00009, mt: 1, origen: 'medido', n: 9 },
  { id: 'stt', grupo: 'Conversar', label: 'Transcribir una nota de voz (1 min)', costoUsd: 0.00067, mt: 2, origen: 'publicado', n: 0 },

  { id: 'guardian', grupo: 'Plan', label: 'Priorizar un lote de tareas', costoUsd: 0, mt: 1, origen: 'medido', n: 333 },
  { id: 'checklist', grupo: 'Plan', label: 'Descripción + checklist de un lote', costoUsd: 0, mt: 1, origen: 'medido', n: 132 },
  { id: 'reunion', grupo: 'Plan', label: 'Extraer tareas de una reunión de 2 h', costoUsd: 0.00504, mt: 10, origen: 'medido', n: 437 },
  { id: 'plan-seed', grupo: 'Plan', label: 'Escribir el plan de arranque', costoUsd: 0.0295, mt: 70, origen: 'supuesto', n: 0 },

  { id: 'closing', grupo: 'Análisis', label: 'Analizar una llamada de venta', costoUsd: 0.00712, mt: 15, origen: 'medido', n: 132 },
  { id: 'lead-360', grupo: 'Análisis', label: 'Insight 360 de un lead', costoUsd: 0.00192, mt: 5, origen: 'medido', n: 3 },
  { id: 'retro', grupo: 'Análisis', label: 'Retro / experimentos del negocio', costoUsd: 0.0989, mt: 235, origen: 'medido', n: 47 },
  { id: 'ads-an', grupo: 'Análisis', label: 'Analizar un anuncio', costoUsd: 0, mt: 1, origen: 'medido', n: 18 },
  { id: 'script-an', grupo: 'Análisis', label: 'Analizar un guion de video', costoUsd: 0.00135, mt: 3, origen: 'medido', n: 5 },
  { id: 'landing-an', grupo: 'Análisis', label: 'Diagnosticar una landing', costoUsd: 0.0092, mt: 20, origen: 'supuesto', n: 0 },
  { id: 'competitor', grupo: 'Análisis', label: 'Espiar a un competidor', costoUsd: 0.0086, mt: 20, origen: 'supuesto', n: 0 },
  { id: 'chat-an', grupo: 'Análisis', label: 'Analizar una conversación de WhatsApp', costoUsd: 0.006, mt: 15, origen: 'supuesto', n: 0 },
  { id: 'vsl-an', grupo: 'Análisis', label: 'Analizar un VSL', costoUsd: 0.0108, mt: 25, origen: 'supuesto', n: 0 },
  { id: 'yt-an', grupo: 'Análisis', label: 'Analizar un video de YouTube', costoUsd: 0.0086, mt: 20, origen: 'supuesto', n: 0 },
  { id: 'roleplay', grupo: 'Análisis', label: 'Una sesión de Sales Roleplay', costoUsd: 0.03, mt: 70, origen: 'supuesto', n: 0 },

  { id: 'wa-sugerir', grupo: 'Escribir', label: 'Sugerir la respuesta a un lead', costoUsd: 0.007, mt: 15, origen: 'supuesto', n: 0 },
  { id: 'nutri', grupo: 'Escribir', label: 'Escribir una secuencia de nutrición', costoUsd: 0.0236, mt: 55, origen: 'supuesto', n: 0 },
  { id: 'email', grupo: 'Escribir', label: 'Escribir un email de nutrición', costoUsd: 0.01075, mt: 25, origen: 'supuesto', n: 0 },
  { id: 'campana', grupo: 'Escribir', label: 'Estructurar una campaña de Meta', costoUsd: 0.01213, mt: 30, origen: 'medido', n: 14 },
  { id: 'ads-writer', grupo: 'Escribir', label: 'Escribir un guion de anuncio', costoUsd: 0.00504, mt: 10, origen: 'medido', n: 28 },
  { id: 'landing-gen', grupo: 'Escribir', label: 'Escribir una landing entera', costoUsd: 0.0434, mt: 100, origen: 'supuesto', n: 0 },
  { id: 'vsl-gen', grupo: 'Escribir', label: 'Escribir un guion de VSL', costoUsd: 0.00356, mt: 9, origen: 'medido', n: 17 },
  { id: 'leadmagnet', grupo: 'Escribir', label: 'Escribir un lead magnet', costoUsd: 0.0276, mt: 65, origen: 'supuesto', n: 0 },
  { id: 'yt-writer', grupo: 'Escribir', label: 'Escribir un guion de YouTube', costoUsd: 0.0295, mt: 70, origen: 'supuesto', n: 0 },
  { id: 'archivero', grupo: 'Escribir', label: 'El Archivero resume un documento', costoUsd: 0.00762, mt: 20, origen: 'medido', n: 94 },

  // ⚠️ Lo AUTOMÁTICO cuesta 0 MT a propósito. El usuario no lo dispara ni lo
  // puede parar: cobrarle cuota por un cron es que abra la app y la encuentre
  // vaciada por algo que no hizo. Se gatea por PLAN —el Free no conecta nada con
  // webhook ni cron—, que es el mismo eje que separa los planes.
  { id: 'crm-auto', grupo: 'Automático', label: 'Clasificar un lead (CRM automático)', costoUsd: 0, mt: 0, origen: 'medido', n: 165 },
  { id: 'validador', grupo: 'Automático', label: 'Validar una plantilla contra Meta', costoUsd: 0, mt: 0, origen: 'medido', n: 21 },
  { id: 'aviso', grupo: 'Automático', label: 'Redactar un aviso del semáforo', costoUsd: 0, mt: 0, origen: 'supuesto', n: 0 },
  { id: 'ads-bot', grupo: 'Automático', label: 'Una corrida del Ads Optimizer', costoUsd: 0.0108, mt: 0, origen: 'supuesto', n: 0 },

  { id: 'imagen', grupo: 'Medios', label: 'Generar una imagen', costoUsd: 0.034, mt: 80, origen: 'publicado', n: 0 },
  { id: 'thumb', grupo: 'Medios', label: 'Un thumbnail (2 variantes)', costoUsd: 0.068, mt: 160, origen: 'publicado', n: 0 },
  { id: 'voz', grupo: 'Medios', label: 'Una locución de 1 minuto (~900 chars)', costoUsd: 0.045, mt: 110, origen: 'publicado', n: 0 },
  { id: 'video-seg', grupo: 'Medios', label: 'Un segundo de video generado', costoUsd: 0.05, mt: 120, origen: 'publicado', n: 0 },
  { id: 'carrusel', grupo: 'Medios', label: 'Un carrusel de 7 imágenes', costoUsd: 0.238, mt: 570, origen: 'publicado', n: 0 },
  { id: 'clip8', grupo: 'Medios', label: 'Un clip de 8 segundos', costoUsd: 0.4, mt: 960, origen: 'publicado', n: 0 },
  // Se cobra por INTENTO, no por pieza terminada: se descuenta por segundo
  // GENERADO. Si los fallidos no descuentan, cada pieza cuesta 3× y la paga la agencia.
  { id: 'reel', grupo: 'Medios', label: 'Un INTENTO de Reel de 15 s (2 clips + voz)', costoUsd: 0.845, mt: 2000, origen: 'publicado', n: 0 },
];

/** El cupo de cada plan, en MaKo Tokens. El Free es por ÚNICA VEZ, no mensual. */
export const CUPO_MT: Record<Plan['id'], number> = { free: 600, pro: 5000, growth: 50000 };

/** Lo que expone cada plan si el cupo entero se gasta en la peor operación. */
export const EXPOSICION = [
  { plan: 'Free', cupo: 600, normalUsd: 0.30, maloUsd: 0.78, margenNormal: null, margenMalo: null },
  { plan: 'Pro', cupo: 5000, normalUsd: 2.52, maloUsd: 6.50, margenNormal: 94.2, margenMalo: 85.2 },
  { plan: 'Growth', cupo: 50000, normalUsd: 25.18, maloUsd: 65.00, margenNormal: 72.3, margenMalo: 28.5 },
];

/**
 * El riesgo que queda después de tarifar bien.
 *
 * ⚠️ Y una lección de aritmética que casi se publica al revés: acá el precio de
 * Opus estuvo en US$15/US$75 (los de Opus 4.1, retirado) cuando el oficial es
 * **US$5/US$25** — el propio repo ya lo tenía bien en `lib/anthropic-usage.ts`.
 * Eso cobraba la Retro a 710 MT cuando corresponden 235: **3× de más al
 * cliente**. Pero NO cambia la exposición, porque el error dividía por tres el
 * costo Y el precio a la vez: el markup efectivo —y con él el peor caso— queda
 * igual. Un error de precio de lista mueve lo que se cobra, no el margen.
 */
export const RIESGO_QUE_QUEDA =
  'El «mes malo» del Growth (todo al p90) deja ~28% de margen, y lo empuja UNA sola operación: la Retro, la única que sigue en Opus, cuya salida va de 3.484 tokens de media a 11.288 en el p90 — 3,2× la media. El cupo la acota, pero conviene sumarle un límite de FRECUENCIA propio (corre pocas veces al mes por diseño) en vez de confiar solo en los tokens.';

// ── LA GRILLA DE PLANES ─────────────────────────────────────────────────────
// Cuatro columnas. El eje que las separa NO es una cantidad: es que el Free no
// conecta ninguna integración con webhook ni cron. Free = la IA corre cuando
// apretás un botón; Pro = corre mientras dormís. Se corresponde exactamente con
// la curva de costo: los seis caminos automáticos son los que gastan solos.

export type Columna = 'free' | 'pro' | 'growth' | 'agencia';
/** `true` incluido · `false` no · string = el límite. */
export type Celda = boolean | string;
export type FilaGrilla = { que: string; free: Celda; pro: Celda; growth: Celda; agencia: Celda };
export type GrupoGrilla = { grupo: string; filas: FilaGrilla[] };

export const GRILLA: GrupoGrilla[] = [
  {
    grupo: 'Tu operación diaria',
    filas: [
      { que: 'Plan del día + Perro Guardián', free: true, pro: true, growth: true, agencia: true },
      { que: 'CRM, funnel y ficha del lead', free: true, pro: true, growth: true, agencia: true },
      { que: 'Onboarding, Archivero y plan de arranque', free: true, pro: true, growth: true, agencia: true },
      { que: 'Preguntale a MaKo', free: '20 mensajes/día', pro: 'uso justo', growth: 'uso justo', agencia: 'uso justo' },
    ],
  },
  {
    grupo: 'Lo que MaKo hace solo',
    filas: [
      { que: 'Integraciones con disparador externo (Fathom, Meta, WhatsApp)', free: false, pro: true, growth: true, agencia: true },
      { que: 'Meeting Reader — la reunión se vuelve tareas repartidas', free: false, pro: '20 reuniones/mes', growth: 'sin tope', agencia: 'sin tope' },
      { que: 'Closing Analyst — análisis de llamadas de venta', free: false, pro: '30 llamadas/mes', growth: 'sin tope', agencia: 'sin tope' },
      { que: 'CRM automático + Auto-Close', free: false, pro: true, growth: true, agencia: true },
      { que: 'WhatsApp, email y secuencias de nutrición', free: false, pro: true, growth: true, agencia: true },
      { que: 'Ads Manager con escrituras a Meta + Ads Analyst', free: false, pro: true, growth: true, agencia: true },
    ],
  },
  {
    grupo: 'Análisis',
    filas: [
      { que: 'Lead Insights + WhatsApp Advisor', free: false, pro: true, growth: true, agencia: true },
      { que: 'Landing Analyst + Web Generator', free: false, pro: true, growth: true, agencia: true },
      { que: 'Retro / Experimentos', free: false, pro: '4 corridas/mes', growth: 'sin tope', agencia: 'sin tope' },
    ],
  },
  {
    grupo: 'Contenido',
    filas: [
      { que: 'Ads Writer', free: false, pro: true, growth: true, agencia: true },
      { que: 'Generación de imágenes', free: '6, por única vez', pro: '50/mes', growth: 'dentro del cupo', agencia: 'dentro del cupo' },
      { que: 'Generación de video y Reels', free: false, pro: false, growth: 'dentro del cupo', agencia: 'dentro del cupo' },
    ],
  },
  {
    grupo: 'Tu equipo y tus datos',
    filas: [
      { que: 'Usuarios', free: '1', pro: '3', growth: '10', agencia: 'ilimitados' },
      { que: 'Contactos', free: '500', pro: '2.500', growth: '10.000', agencia: 'ilimitados' },
      { que: 'Workspaces', free: '1', pro: '1', growth: '1', agencia: 'hasta 10 clientes' },
      { que: 'Roles de closer y setter', free: false, pro: false, growth: true, agencia: true },
      { que: 'BYOK de texto — tu propia key de IA', free: false, pro: false, growth: true, agencia: true },
    ],
  },
  {
    grupo: 'MaKo Tokens',
    filas: [
      { que: 'Cupo mensual', free: '600, por única vez', pro: '5.000', growth: '50.000', agencia: '150.000' },
      { que: 'Packs de recarga', free: false, pro: true, growth: true, agencia: true },
    ],
  },
];

/** Por qué alguien sube de escalón. Una línea, la que se pone en la landing. */
export const GANCHO: Record<Columna, string> = {
  free: 'Terminá el onboarding y MaKo ya entendió tu negocio: te dice qué hacer primero, con fecha y con razón.',
  pro: 'Deja de ser una app donde cargás cosas: la reunión se vuelve tareas sola, las llamadas se analizan solas y WhatsApp nutre solo.',
  growth: 'La fábrica de creativos: del guion que ya salió de tu Matriz a la imagen y el video, con tu equipo adentro.',
  agencia: 'Un workspace por cliente, con tu equipo y tu cupo compartido. El mismo MaKo, multiplicado.',
};

/** El precio anual y lo que de verdad entra a la cuenta después de Paddle e IVA. */
export type Precio = { plan: Columna; mensualUsd: number; anualUsd: number | null; descuento: string; netoMensualUsd: number };

export const PRECIOS: Precio[] = [
  { plan: 'free', mensualUsd: 0, anualUsd: null, descuento: '—', netoMensualUsd: 0 },
  { plan: 'pro', mensualUsd: 47, anualUsd: 470, descuento: '2 meses gratis · 16,7%', netoMensualUsd: 43.77 },
  { plan: 'growth', mensualUsd: 97, anualUsd: 970, descuento: '2 meses gratis · 16,7%', netoMensualUsd: 90.87 },
  { plan: 'agencia', mensualUsd: 297, anualUsd: 2970, descuento: '2 meses gratis · 16,7%', netoMensualUsd: 279.62 },
];

/** ⚠️ Lo que NO puede entrar a la grilla porque todavía no existe. */
export const FUERA_DE_GRILLA = {
  // Offer salió de esta lista el 11/10/2026: ya existe (/offer). El «38 de las 122» es la foto
  // del relevamiento de pricing y NO se recalculó — ese día areas.ts contaba 30 áreas
  // «por-construir». Si se vuelve a usar el número, se cuenta de AREAS, no de acá.
  porConstruir: 'Image Generator, Video Generator, Reels, Carousels, Stories, Thumbnails, YouTube Writer, Ideas, Competitor Spy, VSL/Chat/CS/YouTube Analyst, VSL Generator, Lead Magnet, Sales Email, Newsletters, Closing Script, Sales Roleplay, Instagram, Foco, Mindset y Ads Optimizer Bot — 38 de las 122 áreas.',
  trampas: [
    { que: 'Second Brain', por: 'figura `listo` pero su propio alcance dice que todavía no conecta señales ni saca conclusiones. No venderlo como «conecta las señales de tu negocio».' },
    { que: 'Nutrition Writer y Post-Call Follow-up', por: 'escriben el borrador, NO mandan. Falta el go-live del envío. No venderlo como «responde solo».' },
    { que: 'CRM Automation', por: 'está hecho pero gateado por `crmAutoHabilitado`, que es fail-closed. Se puede vender, pero hay que prenderlo en el alta o el cliente compra algo que nunca arranca.' },
  ],
  // Esto es lo que decide que el Growth NO se pueda cobrar todavía.
  growthEnEspera: 'El gancho entero del Growth —Image Generator y Video Generator— son `ComingSoon` de 8 líneas. Un tercer plan vacío no es un ancla de precio: es un reembolso. Va con precio anunciado y lista de espera.',
};

// ── El respaldo de los pasos 3 y 4 ──────────────────────────────────────────

export type Bloque = { id: string; titulo: string; cuerpo: string; fuente?: string };

export const BYOK: Bloque[] = [
  { id: 'veredicto', titulo: 'BYOK es gobernanza, no una palanca de precio', cuerpo: 'Va en el Growth, SIN tocar el precio, y solo para texto. Ahorraría como máximo US$2,82 de los US$27,40 del Growth: el 90% restante son medios, y ahí está prohibido por contrato. Se vende como control —«tus prompts van por tu cuenta, tu factura, tus logs»—, que es el único argumento verdadero: el break-even de texto es NEGATIVO para el cliente (ahorra US$2,82/mes y le cuesta ~US$2,90 de crédito prepago que se vence).' },
  { id: 'prohibido', titulo: 'BYOK de MEDIOS está prohibido, textual', cuerpo: 'fal.ai (ToS act. 31/07/2026): «You may not share or permit others to use your individual account credentials». Replicate dice lo mismo. Y son justo los dos proveedores que el paso 1 eligió por ser los únicos cuyos términos contemplan un SaaS. De los cinco contratos de LLM leídos, ninguno prohíbe explícitamente que un tercero opere la key del titular, pero ninguno lo bendice: no es «no se puede», es «si sale mal, no hay a quién reclamarle».', fuente: 'ToS de fal.ai y Replicate, consultados 9/8/2026' },
  { id: 'mercado', titulo: 'El mercado es unánime en tres cosas', cuerpo: 'Ocho productos con BYOK documentado: (1) nadie inventó un tier para BYOK — Zapier «Pro and Advanced plans only», Gumloop «requires Pro or higher», Warp lo da hasta en el Free y lo gatea por tamaño de organización; (2) nadie baja el precio, y los tres diseños de fee se contradicen (Vercel 0%, OpenRouter 5%, Gumloop DUPLICA su fee de orquestación); (3) lo que baja es la moneda interna — Zapier: tu key consume 1x en vez de 5x.', fuente: 'páginas oficiales, 9/8/2026' },
  { id: 'fee', titulo: 'El fee de Gumloop es inaplicable acá', cuerpo: 'Cobra un porcentaje sobre lo que la corrida HABRÍA costado. En MaKo esa corrida cuesta US$0,0021, así que el 16% da cero. Si se cobra un fee, la base tiene que ser por ACCIÓN, no por costo evitado.' },
];

export const CUARTO_PLAN: Bloque[] = [
  { id: 'techo', titulo: '«El Growth se pasa del 75% de margen» — la vara era la equivocada', cuerpo: 'El 75% es un supuesto de la era SaaS. La mediana publicada de margen bruto de un producto de IA es 50%, y solo el 12% apunta a 80%+. El 72% del Growth está 22 puntos ARRIBA de la mediana de su categoría. El criterio correcto no es el margen promedio: es que ningún cliente INDIVIDUAL quede negativo.', fuente: 'Poyar, n=230, abr-may 2026' },
  { id: 'retencion', titulo: '«Arriba de US$250 se retiene 70%» — es atributo de la empresa, no del cliente', cuerpo: 'El dato de ChartMogul es real, pero dice «las empresas que PUEDEN cobrar caro retienen mejor», no «si subís de US$97 a US$297 vas a retener mejor». El propio reporte atribuye la fuga al bajo costo de cancelar y a la falta de enganche.', fuente: 'ChartMogul, ~3.500 empresas, datos 2025' },
  { id: 'senuelo', titulo: '«Un plan caro ancla al Growth» — el efecto señuelo no replica', cuerpo: 'Con estímulos realistas: Frederick/Lee/Baskin y Yang/Lynn, JMR 51(4) 2014 — 91 intentos, 23 categorías, solo 11 con efecto confiable.', fuente: 'JMR 51(4), 2014' },
  { id: 'ancla', titulo: 'Si hay 4º plan, el ancla es AGENCIA — y el múltiplo real no es 2× ni 3×', cuerpo: 'Múltiplos medidos en páginas oficiales: GoHighLevel US$97→US$297 = 3,06× (compra multi-subcuenta) y US$297→US$497 = 1,67× (compra revender); Zapier 3,45×; HeyGen 1,69× y 3,04×; respond.io 2,01× y 1,75×. El rango real es 1,7×-3,4×. US$247 da 2,55×: no cae en ningún patrón observado y no tiene comparable que el comprador reconozca. MaKo ya es multi-inquilino por dentro (mig 0054 y 0058), así que un plan de agencia es costo de UI y de gating, no de arquitectura.', fuente: 'páginas oficiales, 9/8/2026' },
  { id: 'video', titulo: 'El problema del video lo arregla el TOPE, no un plan más caro', cuerpo: 'Es aritmético: si sacás un plan de US$297 con más video, el cliente que hoy quema US$49 de video dentro del Growth de US$97 NO se muda — se queda, porque ahí le sale más barato. Un tier nuevo captura al que ya está topeado; no defiende el margen de abajo. Y nadie vende video sin tope self-serve: HeyGen capea en los cinco tiers, respond.io corta en seco al 200%.' },
];

export const COBRO: Bloque[] = [
  { id: 'paddle', titulo: 'Paddle como merchant of record, y es más barato que Stripe arriba de US$33', cuerpo: 'Paddle 5% + US$0,50. Stripe directo, para hacer lo mismo, apila 2,9% + US$0,30 + 1,5% internacional + 0,7% Billing + 0,5% Tax = 5,6% + US$0,30. Stripe Managed Payments es el MoR más caro del mercado: 8,6% + US$0,30. Y el fijo de US$0,50 es la palanca del anual: pesa 1,06% sobre US$47 y 0,11% sobre US$470 — doce cobros mensuales del Pro cuestan US$38,76 de fee, uno anual US$27,76.', fuente: 'páginas oficiales, 9/8/2026' },
  { id: 'cfdi', titulo: 'Lo del CFDI era un falso problema', cuerpo: 'Una empresa extranjera no puede emitir CFDI, pero existe la regla 12.1.4 de la RMF: el prestador extranjero inscripto entrega un PDF con el IVA trasladado por separado y con eso el receptor mexicano lo acredita. Paddle está en el padrón del SAT (RFC PML120808ITA, alta 10/11/2021), posición 182 del listado del quinto bimestre 2025. Stripe y Lemon Squeezy NO figuran. En el copy no prometer «factura fiscal»: decir «comprobante con IVA desglosado, acreditable según regla 12.1.4 RMF», y poner el campo RFC/NIT en el checkout.', fuente: 'sidof.segob.gob.mx, listado del 5º bimestre 2025' },
  { id: 'stripe-reloj', titulo: 'Y por eso no se vende «rápido con Stripe» mientras tanto', cuerpo: 'El reloj de 30 días naturales para inscribirse en el RFC arranca con la primera venta a un mexicano, sin monto mínimo, y exige representante legal y domicilio EN territorio nacional. Más e.firma, declaración mensual, y bloqueo del servicio en México por tres meses de incumplimiento.' },
  { id: 'argentina', titulo: 'Argentina es segunda ola, y son dos números, no uno', cuerpo: 'A un monotributista el Pro le aparece ~US$71 (21% de percepción de IVA + 30% a cuenta de Ganancias, este último recuperable). A un responsable inscripto NO le aplica la percepción: importa el servicio, autoliquida y toma crédito fiscal — le sale ~US$61 de tarjeta y le cuesta US$47. Cobrar localmente en ARS no es pago al exterior y no dispara la percepción, pero Rebill tiene mínimo de US$500/mes hasta procesar US$50.000 mensuales.' },
  { id: 'whatsapp', titulo: 'El costo de WhatsApp es casi cero, y estaba en el lugar equivocado', cuerpo: 'Meta abre una ventana gratis de 72 horas en los anuncios click-to-WhatsApp: toda conversación que cierra en 3 días cuesta US$0. Y el WhatsApp que consumen los clientes NO es COGS de MaKo — lib/chatwoot.ts resuelve las cuatro credenciales por credWs, así que Meta le factura a la cuenta de cada cliente. Va presupuestado en CAC, no en producto: ~US$1-3 por lead por mes de reactivación.', fuente: 'documentación oficial de Meta + lib/chatwoot.ts' },
];

export const GRANDFATHER: Bloque[] = [
  { id: 'quienes', titulo: 'Son TRES, y no son los que la lista decía', cuerpo: 'docs/mapa-del-proyecto.md:43 — ws1 = Mauricio, ws3 = Cliente de Prueba, ws9 = Martín/super-admin, ws10 = Leandro, ws11 = Leila. La lista que circulaba («4 vivos: 3, 9, 10, 11») estaba mal en los dos sentidos: incluía el workspace de testing y al propio dueño, y dejaba afuera al ws1, que es un cliente real y el único mezclado en el medidor de Claude. Los destinatarios son Mauricio, Leandro y Leila.' },
  { id: 'como', titulo: 'Con tres clientes que conocés por nombre, el proceso formal es teatro', cuerpo: 'Una llamada de 15 minutos por cliente + un email de constancia de 10 líneas, que es lo que salva de la discusión «a mí me dijiste que era ilimitado»: (1) se te congela el precio y el alcance al 9 de agosto de 2026; (2) las funciones que se lancen después entran con los límites de su plan, iguales para todos; (3) el texto te queda sin tope, los medios van a tener cupo para todos, ustedes incluidos; (4) respondeme SÍ para confirmar, o te doy de baja sin cargo.' },
  { id: 'trampa', titulo: 'No prometer «te queda todo ilimitado»', cuerpo: 'Se grandfatherea lo que existe, nunca lo que todavía no se escribió. Si el email dice «ilimitado» y en tres meses aparece el botón de Reels, esos tres son los únicos usuarios sin tope de la feature más cara del producto. Sacarle un tope a alguien que nunca lo tuvo es la conversación que Docker y Unity perdieron; nacer con tope es gratis, porque nadie extraña lo que nunca tuvo.' },
];

/** Lo que hay que construir, en orden — y el orden ES el del riesgo. */
export const ORDEN_DE_TRABAJO = [
  { n: 1, que: 'Atribuir el gasto de Anthropic al workspace del request. Sin esto ningún tope es implementable, para nadie', vive: 'lib/anthropic-usage.ts:15-25' },
  { n: 2, que: 'Índice (workspace_id, created_at) en anthropic_usage', vive: 'migración nueva' },
  { n: 3, que: 'workspaces.plan + plan_limites + workspace_limites', vive: 'supabase/migrations/0125' },
  { n: 4, que: 'lib/planes.ts — catálogo puro, FAIL-CLOSED: plan desconocido cae al más restrictivo (al revés de capaDef, que cae a «completo»)', vive: 'lib/planes.ts (nuevo)' },
  { n: 5, que: 'El gate DENTRO de cada cron y cada webhook, escrito en positivo. No pasan por la sesión: un gate en capas.ts esconde tabs y no frena un dólar', vive: 'lib/cron-workspaces.ts · app/api/webhooks/*' },
  { n: 6, que: 'presupuestoRestante(ws) PRE-FLIGHT, antes del fetch. Hoy no existe ninguna primitiva de denegación por consumo', vive: 'lib/anthropic.ts · lib/ai-cheap.ts' },
  { n: 7, que: 'Ledger de MaKo Tokens append-only. El saldo se DERIVA de la suma, nunca un contador mutable: ese bug ya se pagó en la mig. 0113', vive: 'migración 0126 · lib/tokens.ts' },
  { n: 8, que: 'Alta pública de usuario y workspace. El callback de Google devuelve no-autorizado si el email no está en usuarios: hoy no hay nada entre el pago y el primer login', vive: 'app/api/auth/callback/google' },
  { n: 9, que: 'Paddle: 4 Prices + pack, /precios, /checkout, webhook, campo RFC/NIT', vive: 'app/precios · app/checkout' },
  { n: 10, que: 'Key de plataforma para el Free. ÚLTIMO — no antes de 1-7', vive: 'lib/credenciales.ts' },
  { n: 11, que: 'Image Generator primero (10× más barato y más simple que el video, y sus dos insumos ya existen), después Video y Reels', vive: 'app/image-generator' },
];

/** Los huecos que quedan abiertos, y son bloqueantes. */
export const HUECOS = [
  'No existe ninguna página legal — ni /terminos, ni /privacidad, ni /reembolsos — en un producto con landing pública de venta. Un merchant of record APRUEBA el negocio antes de activarte y las pide: es un gate de días o semanas ANTES del primer cobro.',
  'Falta el impuesto del que COBRA, no el del que compra. Qué entidad factura y en qué país condiciona todos los netos: si es argentina, el payout en USD entra al régimen cambiario y paga Ingresos Brutos.',
  '¿Los tres clientes actuales pagan algo hoy? `workspaces` no tiene columna de precio, plan ni fecha de renovación. Si son acuerdos de agencia, «congelar el precio» no significa nada y lo único que se congela es el alcance.',
  'El PDF que entrega Paddle en México no está documentado: hay que hacer una compra de prueba en sandbox con RFC y pasárselo a un contador mexicano. Que el contador de un cliente ACEPTE un PDF extranjero es un hecho comercial que nadie verificó.',
];

// ── Lo que este análisis daba por cierto y NO lo es ─────────────────────────
// Salió del crítico de completitud del paso 3 y se verificó a mano contra el
// código. Va EN LA PANTALLA, no en una nota al pie: son las que invalidan
// números que están arriba, y esconderlas es la forma más cara de presentarlas.

export type Salvedad = { id: string; titulo: string; que: string; vive: string };

export const SALVEDADES: Salvedad[] = [
  { id: 'ruteo-no-existe', titulo: 'El ruteo barato no está en el código', vive: 'lib/ai-cheap.ts:35-61', que: 'Ninguno de los cuatro modelos de RUTEO aparece en una línea ejecutable. Hoy corre Groq `gpt-oss-20b`, Gemini `gemini-flash-latest`, Cerebras `llama-3.3-70b`, Mistral `mistral-small-latest` y OpenAI `gpt-4o-mini`. El 436× y el margen del 96% del Pro son proyecciones sobre una configuración que todavía no existe.' },
  { id: 'no-se-mide', titulo: '«El texto dejó de costar» es, en parte, «dejó de medirse»', vive: 'lib/anthropic-usage.ts:70', que: '`costFor` devuelve 0 `if (provider && PROVEEDORES_GRATIS.includes(provider))` — por estar en una LISTA, no porque el tier real sea gratis. Medido el 09/08: los workspaces de clientes (3, 9, 10, 11) tienen 1.005 llamadas y 7,5M de tokens registrados en US$0,04 en total.' },
  { id: 'medios-no-existen', titulo: 'La generación de medios no tiene una sola línea de código', vive: 'grep en lib/ y app/', que: 'Buscar `fal|replicate|kie|apimart|veo|sora|gpt-image|text-to-video` da cero coincidencias ejecutables. Los US$24,58 no son un costo a cubrir: son un producto a construir, y su volumen mensual (20 clips, 4 Reels) es un supuesto que nadie puede derivar todavía.' },
  { id: 'sin-cobro', titulo: 'No existe máquina de cobro', vive: 'lib/agente-redaccion.ts:49', que: 'El único hit de Stripe en todo el repo es un regex que TAPA claves de Stripe en los logs. No hay `/registro`, `/checkout` ni `/precios`, ni ninguna migración de plan, suscripción o saldo. Todo el diseño de overage y packs es billing, y el billing no está en ninguna estimación.' },
  { id: 'precio-neto', titulo: 'Los márgenes están sobre el precio de LISTA, no sobre lo que entra', vive: '—', que: 'El procesador se lleva 3-6% + fee fijo (que sobre US$47 pesa), el IVA de servicios digitales es 16% en México y 19% en Colombia, y una PyME mexicana que no recibe CFDI no puede deducir la suscripción — eso frena la conversión más que cualquier discusión de BYOK.' },
  { id: 'sin-whatsapp', titulo: 'El costo del canal principal no está en ningún número', vive: '—', que: 'MaKo vende y opera por WhatsApp, y Meta cobra por conversación de marketing. En los US$0,02 / US$1,87 / US$27,40 no hay un centavo de WhatsApp. Tampoco de Supabase, Vercel, egress ni Panda.' },
  { id: 'sin-grilla', titulo: 'En el código no hay Free/Pro/Growth', vive: 'lib/capas.ts', que: 'Hay dos capas de cliente, `pm` y `completo`, y `completo` es literalmente «todo el producto». La grilla de qué feature entra en qué plan —lo único que el cliente compara y lo único que permite gatear— no existe todavía.' },
  { id: 'grandfathering', titulo: 'Falta decidir qué pasa con los 4 clientes que ya están adentro', vive: 'lib/capas.ts', que: 'Hoy tienen `completo` sin tope. Meterles cupo, corte duro y overage es un cambio de contrato hacia atrás sobre gente que ya paga: es el movimiento con más riesgo de churn de todo el plan.' },
];

/** El hallazgo del paso 2, en una frase. */
export const EL_COSTO_ES_EL_VIDEO =
  'Con el ruteo del paso 1 el texto deja de importar: extraer una reunión pasa de US$0,93 a US$0,002 (436×) y la mitad de las acciones caen a cero. Lo que queda es que los MEDIOS son el 90% del costo del plan Growth. Un solo Reel de 15 segundos con 3 intentos cuesta US$2,45 — más que TODO el texto del plan Pro en un mes entero. La consecuencia es de diseño de planes, no de ingeniería: el video no puede ser una feature incluida, tiene que ser una unidad medida.';

/** Un número que circula por todos lados y NO hay que usar. */
export const DATO_FALSO = {
  numero: 'US$702 self-serve vs US$11.400 sales-led',
  por_que: 'Aparece en al menos ocho sitios de 2026 con la misma redacción sobre «una brecha de 16×, la más ancha de la historia». Rastreada la cadena de citas, todas terminan en un blog sin estudio primario detrás. No tiene muestra, ni metodología, ni fuente. No usarlo en ninguna proyección.',
};

/** El dato que ordena a todos los demás. */
export const EL_ACCIDENTE =
  'Hoy nada de esto cuesta plata en un cliente, y no es por una cuota: `credWs` solo cae al env si el workspace es el 1, así que un cliente sin key propia no gasta — la llamada EXPLOTA. El modelo de MaKo Tokens implica servirle la key de la plataforma a todos, y en ese momento los seis caminos de arriba empiezan a facturar de golpe. Gatear va ANTES de ese cambio, no después.';

// ─────────────────────────────────────────────────────────────────────────────
// EL ÍNDICE DE LA PANTALLA
// ─────────────────────────────────────────────────────────────────────────────
// Las cinco preguntas que la pantalla contesta, EN ORDEN. Es fuente única: lo
// leen el índice de arriba y el título de cada parte, así que no existe la
// versión donde el índice promete una cosa y abajo hay otra — que es exactamente
// lo que pasaba (el índice prometía el CAC y esa sección no existía).
//
// Si se agrega una parte, se agrega ACÁ y después se pone su <Parte n="…"/>.

export type Pregunta = { n: string; pregunta: string; bajada: string; /** Qué CONCLUYE la parte, no de qué habla. Va debajo de la bajada, antes de la primera card: el que solo lee esto ya se llevó el veredicto. ⚠️ Es prosa, así que no se entera si el dato de al lado cambia — por eso la de la parte 3 tiene su guarda en tests/pricing-modelo.test.ts. */ conclusion: string };

export const INDICE: Pregunta[] = [
  { n: '1', pregunta: '¿Cuánto cuesta?', bajada: 'Medido en producción, y proyectado con el producto entero construido.',
    conclusion: 'Un cliente Pro te cuesta US$10,90 de IA por mes, no US$2,52 — ese número asumía un ruteo barato que no tiene una sola línea escrita. Arreglarlo vale US$15.018 de caja. Y con el producto entero el costo deja de ser el texto: el 90% pasa a ser video e imagen.' },
  { n: '2', pregunta: '¿Cuánto se le cobra?', bajada: 'La tarifa de MaKo Tokens, operación por operación, y qué rinde el cupo de cada plan.',
    conclusion: 'Cada operación cuesta lo que cuesta: un mensaje 1 MT, un Reel 2.000. Ese salto de 1 a 2.000 es todo el diseño de los planes, y es por lo que el video no puede ser una feature incluida sino algo que se mide.' },
  // ⚠️ La conclusión que decía «el orgánico no cuesta plata pero te come 26 horas
  // por cliente» salía del modelo que sumaba las dos monedas, y las 26 h heredan
  // ese error (US$2.601,60 ÷ US$100/h): están pendientes de una pregunta al dueño.
  // Por eso esta conclusión NO se apoya en ese número. Lo que sí es firme es el
  // conteo, y lo cuida el test «la conclusión de la parte 3 no puede contradecir
  // a CAC_CANALES»: si mañana un canal cambia de lado, falla acá.
  { n: '3', pregunta: '¿Cuánto cuesta conseguir un cliente?', bajada: 'El costo de cada canal en las dos monedas que tenés: plata y horas.',
    // Se acortó a la mitad: el gráfico de la sección ya pinta canal por canal los
    // cinco porcentajes que esta frase enumeraba, así que repetirlos acá era
    // obligar a leer dos veces el mismo dato antes de llegar al dibujo.
    conclusion: 'Contra los US$105,84 que vale un cliente Pro entran tres de los cinco canales. Los dos que no entran son los únicos que se compran con pauta. Y los más baratos no cuestan plata: cuestan tus horas, que son la otra moneda y no se suman con la primera.' },
  { n: '4', pregunta: '¿Cómo se empaqueta?', bajada: 'Los cuatro planes, qué entra en cada uno, y qué falta para poder cobrarlos.',
    conclusion: 'Vender el anual en vez del mensual multiplica la caja por 62, porque cobrás el año entero el día 0. Es la decisión más grande del documento, y el límite del descuento está en 19,5%: pasado eso, la pauta deja de cerrar.' },
  { n: '5', pregunta: '¿Y el plan? ¿Cuánto da?', bajada: 'El mes 1 real —30 usuarios, US$1.000 de pauta, tus 1.000 contactos—, la corrida de 24 meses, el programa de US$4.000 y la oferta anual.',
    conclusion: 'Los 30 clientes pagos del mes 1 no salen: salen 11, y las 19 que faltan no se compran a ningún precio. A 24 meses el plan da 160 clientes y US$69.150 sin poner capital — lo que pide son tus horas, no tu plata.' },
];

/**
 * Lo que hay que saber, arriba de todo. SE ESCRIBE ÚLTIMA, derivada de las
 * conclusiones de las cinco partes de arriba. Decisión del dueño, y es un orden
 * de trabajo y no de lectura: escrita antes, sale de lo que uno cree y después
 * se fuerza a los datos.
 *
 * DOS REGLAS, las dos con test en tests/pricing-modelo.test.ts:
 *  1. Ningún número aparece acá si no está en la conclusión de SU parte. Es la
 *     misma falla de siempre —dos versiones del mismo número en la misma
 *     pantalla— pero peor, porque este bloque es lo primero que se lee.
 *  2. RESUME, no copia. Esto vive a un scroll de las cinco conclusiones, así que
 *     repetir la frase textual no agrega nada y se lee como un error de armado.
 *     Ya pasó adentro de la parte 3: el `frase` del Titular decía la conclusión
 *     de la parte palabra por palabra, sesenta píxeles más abajo.
 *
 * Y EL ORDEN NO ES EL DEL DOCUMENTO. Va de lo que se cae primero a lo que queda
 * al final: lo que el plan pide y no pasa → la decisión que lo arregla → lo que
 * cuesta sostenerlo → con qué se compran clientes → dónde termina a 24 meses.
 * Por eso la parte 5 abre y cierra: es el mismo plan visto al mes 1 y al mes 24.
 */
export const CONCLUSION_GENERAL: Array<{ titular: string; que: string; parte: string }> = [
  { parte: '5', titular: 'El mes 1 da 11 altas, no 30',
    que: 'Las 19 que faltan no aparecen poniendo más pauta a ningún precio. La mitad de la brecha la cierra el alta pública, que todavía no está construida.' },

  { parte: '4', titular: 'La decisión más grande es cobrar por año',
    que: 'El año entero entra el día 0, y eso multiplica la caja por 62 con la misma máquina y el mismo gasto. El descuento tiene un tope duro: 19,5%.' },

  { parte: '1', titular: 'Un Pro consume US$10,90 de IA, no US$2,52',
    que: 'El ruteo barato que sostenía ese número no tiene una sola línea escrita en el repo. Escribirlo vale US$15.018 de caja.' },

  { parte: '3', titular: 'Entran tres canales de cinco, y eso es solo la plata',
    que: 'Medidos contra los US$105,84 que se pueden pagar por un Pro. Y los que menos plata cuestan son los que más horas te sacan: dos monedas distintas que nunca se suman.' },

  { parte: '5', titular: 'A 24 meses: 160 clientes y US$69.150',
    que: 'Sin poner un peso de capital. Lo que financia ese crecimiento son tus horas, y por eso el cuello del negocio es el calendario y no la caja.' },
];

// =============================================================================
// PARTE 3 — ¿CUÁNTO CUESTA CONSEGUIR UN CLIENTE?
// =============================================================================
// Esto CIERRA el hueco que el INDICE prometía y la pantalla no tenía
// (Pricing.tsx:485 renderizaba «Todavía no hay número»).
//
// ⚠️ AL PORTAR ESTO HAY QUE BORRAR, EN EL MISMO COMMIT:
//   · modelo.ts:266  «El US$104 del Pro sería más bien US$55-70»
//   · modelo.ts:271  «Pro: US$53-104 · Growth: US$194-381»
//   · docs/costos-ia-y-planes.md:620 y 1058-1059 (US$49-97, US$104, US$53)
// Seis números incompatibles con el mismo rótulo es exactamente cómo se llegó
// acá. No conviven: se reemplazan.
//
// Regla de este bloque, igual que el resto del archivo: cada número dice de
// dónde salió. Y una regla NUEVA, que es la que más plata movió al reconciliar:
// **cada término se cuenta UNA sola vez y en UN solo lugar.** El costo del Free
// va adentro del CAC del canal; en la proyección va en su propia columna. Si
// aparece en los dos, el modelo se descuenta a sí mismo.

// ── Las constantes transversales ────────────────────────────────────────────
// Estas cinco son las que atraviesan las tres tablas de abajo. Cuando un número
// del CAC y uno de la unit economics no coinciden, es porque una de estas se
// duplicó — que es lo que pasó con el costo del Free (tres valores vivos) y con
// la vida útil (12 meses planos contra las bandas GRR del propio repo).

/** Lo que vale una hora del dueño. Entra CUATRO veces —entrega del 1a1 (−15 h),
 *  entrega del grupal (−1 h), la llamada (−2 h) y las horas de canal— y el error
 *  caro es subirla solo en la llamada. La puso el analista, NO el dueño. */
export const VALOR_HORA_DUENO = { usd: 100, origen: 'supuesto' as Origen, banda: [0, 20, 50, 100, 150] as const,
  nota: 'US$0 = vista CAJA (la hora no se paga, se agenda) · US$20/h = hora comprable en LATAM (prolatamwork, publicado) · US$100/h = vista CAPACIDAD. A US$20/h el ascenso pasa a sumar +US$18; a US$150/h resta −US$45.' };

/** La hora del SOPORTE no es la del dueño: el soporte se compra, la cara del
 *  dueño no. Es la separación que el repo trataba como una sola. */
export const VALOR_HORA_SOPORTE = { usd: 20, origen: 'publicado' as Origen, fuente: 'prolatamwork.com, banda US$15-40/h, consultado 09/08/2026' };

/**
 * EL COSTO DE UN USUARIO FREE, DE POR VIDA. Un solo número, usado en las tres
 * tablas. Antes había tres incompatibles: US$0,30 «por única vez» en los
 * canales, US$7,20 (12 meses) en la unit economics y US$0,60/mes en la
 * proyección — y el veredicto de canales usaba el chico.
 *
 * ⚠️ El US$68,41/mes que circulaba como «el techo real de un Free» NO es de un
 * usuario: es `(MEDICION.costUsd / MEDICION.dias) * 30` sobre los CINCO
 * workspaces de la medición, uno de ellos ws1 con los crons de Fathom corriendo
 * y absorbiendo toda fila de Anthropic (BLOQUEANTES #1). El techo real de un
 * Free CON el gate que la GRILLA ya define —sin webhooks ni crons, 20
 * mensajes/día— es 20 × 30 × US$0,00038 (TARIFA `mako-msg`, medido, n=337).
 */
export const COSTO_FREE = {
  iaMes: 0.05, otrosMes: 0.55, totalMes: 0.60, origen: 'supuesto' as Origen,
  techoIaMesConGate: 0.23, techoIaMesAbusivo: 3.00, origenTecho: 'medido' as Origen,
  vidaMeses: 6.67, vidaComo: '1 / churn del Free (15%/mes, escenario base). Antes eran 12 meses planos.',
  totalVida: 4.00, banda: [2.00, 4.00, 8.00] as const,
  nota: 'US$0,60/mes × 6,67 meses. Los US$0,55 de soporte+infra son ÍNTEGRAMENTE nuestros: el repo declara cero (SALVEDADES «sin-whatsapp»). Es el término más blando de todo el modelo y el más barato de medir: dos meses de facturas.',
};

/** Registro→pago. El 6% que usaba el repo es el TECHO de la banda «bueno»
 *  (4-6%) del reverse trial, que es la mecánica que docs:1008 recomienda. El
 *  centro honesto es 5%. */
export const FREE_A_PAGO = { pesimista: 0.03, conservador: 0.04, base: 0.05, optimista: 0.08, origen: 'supuesto' as Origen,
  fuente: 'ChartMogul × ProductLed, n=200 productos B2B, ene-2026 (publicado): mediana 8%, freemium self-serve «bueno» 3-5%, reverse trial 4-6%, «excelente» 8-12%' };

/** Mezcla de plan de todo cliente nuevo. HOY el Agencia no existe como
 *  `Plan['id']` y el Growth vende medios sin una línea de código: hasta que el
 *  paso 11 de ORDEN_DE_TRABAJO exista, lo único vendible es el Pro. */
export const MEZCLA_ALTAS = {
  hoy: { pro: 1.00, growth: 0, agencia: 0 },
  meta: { pro: 0.83, growth: 0.17, agencia: 0 },
  origen: 'supuesto' as Origen,
  nota: 'El 3% del Agencia se reparte al Pro: `CUPO_MT` está tipado Record<Plan[\'id\']> y no incluye «agencia» (Pricing.tsx:485 lo tapa con ?? 150000). Con 92/7/1 el MRR del base cae 24%. Es el supuesto más barato de medir: sale de la primera pantalla de precios que se publique.',
};

// ── EL ASCENSO AL HIGH TICKET ───────────────────────────────────────────────
// Este bloque decide si existe una columna «con ascenso» en la tabla de techos.
// Con las horas reales de la llamada y una tasa de reembolso distinta de cero,
// NO existe: el ascenso mueve el techo ±2%, o sea nada.
//
// ⚠️ Y el rail cambia: Paddle PROHÍBE vender esto. AUP, textual: «Human
// services that are not related to a software offering (e.g., pure consulting
// or advisory services, including but not limited to legal advice, coaching…)».
// Facturar US$108.000 de consultoría por una cuenta aprobada como SaaS no es un
// canal caro: es la causal de suspensión que se lleva puesto también el MRR.

export type Ascenso = {
  precioUsd: number; feeUsd: number; reembolso: number;
  cajaUsd: number; horasEntrega: number; capacidadUsd: number; origen: Origen;
};

/** Stripe como merchant propio: 2,9% + US$0,30 + 1,5% internacional = 4,4% + US$0,30. */
export const FEE_RAIL_PROPIO = (p: number) => p * 0.044 + 0.30;

export const ASCENSO_PROGRAMAS: Record<'unoAUno' | 'grupal', Ascenso> = {
  // M₁. 15 h de entrega repartidas en los 3 meses siguientes a la venta: es el
  // mecanismo que hace que el programa se auto-bloquee — vender uno consume las
  // horas que impiden vender el próximo.
  unoAUno: { precioUsd: 4000, feeUsd: 176.30, reembolso: 0.10, cajaUsd: 3441.33, horasEntrega: 15, capacidadUsd: 1941.33, origen: 'supuesto' },
  // M₂. ⚠️ Las horas del grupal se DERIVAN, no se ponen: `horasCohorte /
  // tamanoCohorte`. Estaban en 3 h POR CABEZA, y a ese ritmo una cohorte de 12
  // son 36 h de entrega por US$1.500 contra 15 h por US$4.000 del 1a1.
  grupal: { precioUsd: 1500, feeUsd: 66.30, reembolso: 0.10, cajaUsd: 1290.33, horasEntrega: 1, capacidadUsd: 1190.33, origen: 'supuesto' },
};

export const COHORTE_GRUPAL = { horasCohorte: 12, tamano: 12, horasPorCabeza: 1.0, origen: 'supuesto' as Origen,
  fuente: 'embudo:377 — «Una sesión de 1,5 h atiende a 12 en vez de a 1». 8 sesiones × 1,5 h.' };

/**
 * La llamada de venta regalada. ⚠️ Son 2,0 h, no 1,5: el guion promete
 * textual «el análisis te lo llevás por escrito digas lo que digas»
 * (embudo:334) y ese informe no estaba contado en ninguna hora.
 */
export const LLAMADA = {
  horas: 2.0, desglose: { prep: 0.5, llamada: 1.0, informe: 0.5 }, origen: 'supuesto' as Origen,
  t: 0.75, tQue: 'comprador agenda × se presenta. El show-up sí tiene fuente (no-show 6,5%, RevenueHero n=6.428); el agendamiento NO tiene ninguna.',
  costoPorComprador: 150.00,
  nota: 'La salida barata es el paso 3 de embudo:378: que MaKo escriba el informe ANTES (cuesta ~US$0,03 de IA) y devuelva la media hora al calendario.',
};

/**
 * P₁ = tasa de ascenso del suscriptor al 1a1 de US$4.000.
 * ⚠️ NO TIENE FUENTE DE NINGÚN TIPO. Se verificó que no existe benchmark para
 * «suscriptor de US$47-97 → programa 1a1 de US$4.000». Se resuelve con 30
 * llamadas propias etiquetadas por plan de origen, no con más research.
 */
export const P1_ASCENSO = { pesimista: 0.03, base: 0.07, optimista: 0.12, origen: 'supuesto' as Origen };
export const P2_GRUPAL = { valor: 0.05, origen: 'supuesto' as Origen, nota: 'embudo:34 lo rotula INVENTADO. Y el grupal está «en evaluación»: no existe como producto.' };

/**
 * EL NÚMERO QUE MATA LA COLUMNA «CON ASCENSO».
 *   valor = t × [P₁·M₁ + (1−P₁)·P₂·M₂]     costo = t × valorHora × horasLlamada
 * A P₁ = 7% (la base del repo, sin fuente) el neto es NEGATIVO, y el
 * break-even está ARRIBA de la base. La llamada regalada no compra techo de
 * CAC: lo baja US$6,57.
 */
export const ASCENSO_NETO = {
  valorEsperadoUsd: 143.43, costoLlamadaUsd: 150.00, netoUsd: -6.57,
  breakEvenP1: 0.0747, origen: 'supuesto' as Origen,
  sinReembolso: { netoUsd: 18.51, breakEvenP1: 0.0591 },
  nota: 'Con 0% de reembolso el neto es +US$18,51 y el break-even 5,91%. Con 10%, −US$6,57 y 7,47%. En los DOS casos la base de 7% cae adentro de la banda del break-even: el ascenso ya no compra aire, empata. Por eso abajo hay UN techo por plan y no dos.',
};

// ── LA UNIT ECONOMICS POR PLAN, CON EL CAC ADENTRO ──────────────────────────
// Lo que la pantalla calcula HOY es `margen()` (modelo.ts:129-132): costo de IA
// contra PRECIO DE LISTA y nada más. Sin comisión, sin soporte, sin infra, sin
// CAC — y devuelve null si precioUsd === 0, o sea que el plan cuya economía hay
// que vigilar es el único que la pantalla se niega a calcular.
//
// La fórmula que sí cierra el negocio:
//   (1) contribucion   = neto − IA − soporte − infra
//   (2) LTV_susc       = contribucion × vida,  vida = 1/(1 − GRR_anual^(1/12))
//   (3) LTV_total      = LTV_susc + ASCENSO_NETO
//   (4) CAC_max 3:1    = LTV_total / 3          ← el CAC es un TECHO, nunca un
//   (5) CAC_max payback= 3 × contribucion          término del margen mensual
//
// ⚠️ Los tres netos son 'supuesto', no 'publicado': son ciertos solo si la
// entidad que factura no paga IIBB. Si es argentina, al 3% el techo del Pro
// baja de US$105,84 a US$102,03 y al 5% a US$99,49.

export type UnitPlan = {
  plan: 'free' | 'pro' | 'growth' | 'agencia' | 'proAnual';
  precioListaUsd: number; netoUsd: number; netoOrigen: Origen;
  iaUsd: number; soporteUsd: number; infraUsd: number;
  contribucionMes: number; grrAnual: number | null; vidaMeses: number;
  ltvSuscripcion: number; ltvTotal: number;
  cacMax3a1: number; cacMaxPayback: number; gobierna: number; reglaQueGobierna: string;
};

export const UNIT: UnitPlan[] = [
  // El Free no puede tener margen en el código actual, y ese es el bug
  // conceptual. Acá sí lo tiene, y es negativo: es un costo de adquisición
  // diferido, no un plan.
  { plan: 'free', precioListaUsd: 0, netoUsd: 0, netoOrigen: 'medido',
    iaUsd: 0.05, soporteUsd: 0.40, infraUsd: 0.15, contribucionMes: -0.60,
    grrAnual: null, vidaMeses: 6.67, ltvSuscripcion: -4.00, ltvTotal: -4.00,
    cacMax3a1: 0, cacMaxPayback: 0, gobierna: 0, reglaQueGobierna: 'no aplica — el Free no se adquiere, se subsidia' },

  // El Pro es el único plan vendible HOY, y es el que gobierna todo el veredicto
  // de canales. Ojo con las dos reglas: para el Pro casi coinciden, y la
  // ESTRICTA es 3:1, no el payback — porque su vida (8,7 meses) es menor a 9.
  { plan: 'pro', precioListaUsd: 47, netoUsd: 43.77, netoOrigen: 'supuesto',
    iaUsd: 2.52, soporteUsd: 3.00, infraUsd: 1.00, contribucionMes: 37.25,
    grrAnual: 23, vidaMeses: 8.7, ltvSuscripcion: 324.08, ltvTotal: 317.51,
    cacMax3a1: 105.84, cacMaxPayback: 111.75, gobierna: 105.84, reglaQueGobierna: 'LTV:CAC 3:1 (la estricta acá, porque la vida es < 9 meses)' },

  { plan: 'growth', precioListaUsd: 97, netoUsd: 90.87, netoOrigen: 'supuesto',
    iaUsd: 25.18, soporteUsd: 8.00, infraUsd: 5.00, contribucionMes: 52.69,
    grrAnual: 45, vidaMeses: 15.5, ltvSuscripcion: 816.70, ltvTotal: 810.13,
    cacMax3a1: 270.04, cacMaxPayback: 158.07, gobierna: 158.07, reglaQueGobierna: 'payback ≤3 meses (la estricta acá — y la que conviene sin capital)' },

  // ⚠️ Vida 15,5 meses, NO 34,1. La banda GRR 70% de ChartMogul es atributo de
  // la EMPRESA, no del cliente: modelo.ts:626 ya lo dice textual. Importarla
  // para el Agencia es hacer justo la lectura que la propia sección prohíbe.
  { plan: 'agencia', precioListaUsd: 297, netoUsd: 279.27, netoOrigen: 'supuesto',
    iaUsd: 75.54, soporteUsd: 30.00, infraUsd: 15.00, contribucionMes: 158.73,
    grrAnual: 45, vidaMeses: 15.5, ltvSuscripcion: 2460.32, ltvTotal: 2453.75,
    cacMax3a1: 817.92, cacMaxPayback: 476.19, gobierna: 476.19, reglaQueGobierna: 'payback ≤3 meses — y el plan no existe todavía en Plan[\'id\']' },

  // EL PLAN QUE CAMBIA EL SIGNO DEL NEGOCIO. Neto US$442,24 verificado contra
  // docs:611 (Paddle cobra su 5% sobre el bruto CON IVA: 545,20 × 5% = 27,26 →
  // 470 − 27,26 − 0,50). El US$446,00 que circulaba y su «0,8% sin documentar»
  // no existen. Contribución del año 1 cobrada ENTERA el día 0.
  { plan: 'proAnual', precioListaUsd: 470, netoUsd: 442.24, netoOrigen: 'publicado',
    iaUsd: 30.24, soporteUsd: 36.00, infraUsd: 12.00, contribucionMes: 364.00,
    grrAnual: 23, vidaMeses: 12, ltvSuscripcion: 472.73, ltvTotal: 466.16,
    cacMax3a1: 155.39, cacMaxPayback: 364.00, gobierna: 155.39,
    reglaQueGobierna: '⚠️ LAS DOS REGLAS SE SEPARAN 2,3× ACÁ Y ES LA DECISIÓN MÁS GRANDE DE LA TABLA: payback dice US$364 (la contribución entera entra el día 0, el payback es instantáneo) y 3:1 dice US$155 (con GRR 23% la serie completa es 364/0,77 = US$473). Payback protege la CAJA; 3:1 protege el VALOR. Comprar a US$364 da 1,3:1 — el cuartil inferior de Benchmarkit, que destruye valor con cada cliente.' },
];

/** Techo mezclado, que es contra lo que se compara una campaña que vende de todo. */
export const TECHO_MEZCLADO = {
  hoy: { regla3a1: 105.84, reglaPayback: 111.75, mezcla: '100% Pro — es lo único vendible' },
  meta: { regla3a1: 133.75, reglaPayback: 119.62, mezcla: '83% Pro / 17% Growth, cuando exista el Image Generator' },
  origen: 'supuesto' as Origen,
};

// ── EL CAC DE LOS CINCO CANALES, EN DOS MONEDAS ─────────────────────────────
// ⚠️ Un canal cuesta PLATA y cuesta HORAS, y las dos NUNCA se suman. La versión
// anterior de esta tabla las sumaba en un solo `cacUsd`, valuando la hora del
// dueño a US$100, y de ahí salía «el único canal que entra es referidos» — que
// es absurdo para alguien que tiene tiempo y no tiene capital: las horas no se
// pagan con plata que no hay, ni la plata se fabrica con horas.
//
// La plata sigue siendo ECONÓMICA COMPLETA dentro de su propia moneda: lo que
// sale del bolsillo (pauta, premios, IA) MÁS el costo de vida de los Free que
// no pagan. La proyección de abajo descompone eso en columnas separadas
// (gastoCac / costoIa+otros / horasDueno) justamente para no contar dos veces:
// comparar `plataPorCliente` de acá contra `gastoCac` de allá es comparar dos
// cosas distintas.

/**
 * Las horas que cuesta un cliente por este canal. NO se convierten a dólares:
 * las horas y la plata no son intercambiables, y menos para alguien que tiene
 * tiempo y no tiene capital. Sumarlas fue el error que dio «el único canal que
 * entra es referidos», que es absurdo.
 */
export type HorasCanal = {
  aMano: number;
  /** Con la feature de MaKo construida. Si no está, rige `aMano`. */
  conMaKo: number;
  /** Qué feature produce el salto. `null` si no hay ninguna. */
  loHabilita: string | null;
};

export type CanalCac = {
  id: string;
  nombre: string;
  cadena: string;
  /** Solo lo que sale del bolsillo: pauta, premios, IA. NUNCA horas. */
  plataPorCliente: number;
  horas: HorasCanal;
  /** Qué se acaba primero y frena el canal. */
  queLoLimita: 'presupuesto' | 'horas' | 'lista' | 'tiempo-hasta-señal';
  escalable: boolean;
  senalEn: string;
  confianza: 'alta' | 'media' | 'baja';
  veredicto: string;
  origen: Origen;
};

export const CAC_CANALES: CanalCac[] = [
  { id: 'referidos', nombre: 'Sistema de referidos',
    cadena: 'premio en crédito → el que recomienda trae → alta',
    plataPorCliente: 43.55, // 7,55 de premio + 36,00 de los Free que no pagan
    horas: { aMano: 0.05, conMaKo: 0.05, loHabilita: null },
    queLoLimita: 'lista', escalable: false,
    senalEn: 'meses — con 3 clientes la base produce ~0',
    confianza: 'media', origen: 'supuesto',
    veredicto: 'El premio (15.000 MT = US$7,55 de costo real) es el único componente MEDIDO de los cinco canales. El premio va al que RECOMIENDA, no al referido (Ryu & Feick, JM 71(1) 2007: vínculos débiles Y marcas débiles).' },

  { id: 'carrito', nombre: 'Campaña de ventas a la landing',
    cadena: 'pauta → landing → checkout → alta',
    plataPorCliente: 136.22, // 124,22 de medios + 12,00 de Free
    horas: { aMano: 0, conMaKo: 0, loHabilita: null },
    queLoLimita: 'presupuesto', escalable: true,
    senalEn: 'días — DESPUÉS de construirlo',
    confianza: 'media', origen: 'supuesto',
    veredicto: 'Hoy el canal está bloqueado por código, no por precio: no existen app/registro, app/checkout ni app/precios. Pasar la aprobación de 70% a 88% con rieles locales baja el costo 20% sin tocar el anuncio.' },

  { id: 'ctwa', nombre: 'Campañas de mensajes a WhatsApp',
    cadena: 'pauta → conversación → registro → alta',
    plataPorCliente: 176.00, // 100,00 de medios + 76,00 de Free
    horas: { aMano: 0.25, conMaKo: 0.02, loHabilita: 'Agente: Chatbot' },
    queLoLimita: 'presupuesto', escalable: true,
    senalEn: 'días — el único que da señal antes de que la decisión esté tomada',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'El 43,2% de su costo en plata es el de los Free que no pagan: un pago arrastra 20 registros y 19 no pagan nunca (19 × US$4,00 = US$76,00 de los US$176,00). Las dos palancas que lo cierran están identificadas: costo por conversación de US$1,50 a US$1,10, y free→pago de 5% a 8%.' },

  { id: 'prospeccion', nombre: 'Prospección con el chatbot',
    cadena: 'lista con permiso → MaKo escribe → conversación → alta',
    plataPorCliente: 0.03, // centavos de IA por contacto trabajado
    horas: { aMano: 0.30, conMaKo: 0.01, loHabilita: 'Agente: Chatbot' },
    queLoLimita: 'lista', escalable: false,
    senalEn: 'semanas',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'Casi no cuesta plata ni horas: lo que lo limita es de DÓNDE salen contactos con permiso. Meta exige opt-in (Messaging Policy §1b) y excluye textual el consentimiento «assumed… from a purchase», así que una base comprada está cerrada. Con vínculo previo se puede, escribiendo desde el número propio y no como campaña.' },

  // ⚠️ LAS 26 h SON HEREDADAS DEL MODELO ROTO y hay que preguntárselas al dueño:
  // salen de dividir los US$2.601,60 de «horas del dueño valuadas» por US$100/h,
  // o sea que arrastran exactamente el error que este archivo vino a sacar. Las
  // reales salen de una pregunta de un minuto: cuántas horas lleva guionar,
  // grabar y editar un Reel, y cuántos Reels hacen falta para un cliente.
  { id: 'organico', nombre: 'Orgánico por Instagram y YouTube',
    cadena: 'contenido → audiencia → registro → alta',
    plataPorCliente: 0, // edición y música; no hay pauta
    horas: { aMano: 26, conMaKo: 26, loHabilita: null },
    queLoLimita: 'tiempo-hasta-señal', escalable: false,
    senalEn: '6-12 meses — el único que no puede dar señal antes de que la decisión ya esté tomada',
    confianza: 'baja', origen: 'supuesto',
    veredicto: 'No cuesta plata: cuesta horas. Sigue valiendo como PRUEBA SOCIAL y como fábrica de creativos para CTWA, que es otro uso y no compite por el mismo presupuesto — pero sí por las mismas horas.' },
];

/**
 * LA REGLA DEL DÓLAR SIGUIENTE. El CAC medio no decide si conviene gastar más:
 * decide el MARGINAL. Con la curva de saturación declarada (+15% por cada
 * duplicación del gasto arriba de US$1.000/mes):
 *     k = log2(1,15) = 0,2016   ·   CAC_marginal = CAC_medio / (1 − k) = /0,7984
 * ⚠️ Y acá está el supuesto más flojo de todo el modelo, dicho de frente: esa
 * curva es tan plana que casi no acota. En cuanto un canal entra en el techo,
 * la fórmula habilita gastos de siete cifras que ninguna audiencia LATAM
 * aguanta. El binding constraint real no es la saturación: es el techo mismo y
 * el tamaño del mercado, y ninguno de los dos está medido.
 */
export const SATURACION = { porDuplicacion: 0.15, exponente: 0.2016, factorMarginal: 0.7984, origen: 'supuesto' as Origen };

/** Dónde el dólar marginal cruza el techo. El número que reemplaza a «gastá más». */
export const GASTO_JUSTIFICABLE_MES = [
  { canal: 'CTWA', vende: 'Pro mensual', usd: 0, nota: 'ni el primer dólar: el CAC base (US$201) ya está 90% arriba del techo' },
  { canal: 'CTWA', vende: 'Pro ANUAL (payback)', usd: 39604, nota: 'sin tope práctico — la saturación deja de acotar acá' },
  { canal: 'Carrito', vende: 'Pro mensual', usd: 81, nota: 'US$81/mes, o sea cero operativo' },
  { canal: 'Carrito', vende: 'Growth mensual (payback)', usd: 731, nota: '' },
  { canal: 'Carrito', vende: 'Pro ANUAL (payback)', usd: 57333, nota: 'sin tope práctico' },
];

// ── LA PROYECCIÓN A 24 MESES ────────────────────────────────────────────────
// Cuatro escenarios, no tres: se agrega el PESIMISTA CONJUNTO, que es el que
// pone todos los supuestos en su percentil malo A LA VEZ. Es el que faltaba, y
// no es paranoia: los trece supuestos están correlacionados porque todos
// dependen del mismo hecho, que es que el producto todavía no se vendió una vez.
//
// TRES COSAS QUE ESTA VERSIÓN AGENDA Y LA ANTERIOR SOLO COBRABA:
//   1. SOPORTE. Estaba en los dólares (US$20/h dentro de otrosCostos) y no en el
//      calendario. Hasta 20 h/mes lo hace el dueño; pasado eso se contrata y le
//      quedan el 15% como gestión.
//   2. PRODUCTO. 60 h/mes durante la construcción y 35 h/mes para siempre
//      después. Antes eran 0 h en los dos tramos, con el dueño como único dev.
//   3. AGENCIA. Los tres clientes actuales (ws1, ws10, ws11) salen del INGRESO
//      con un argumento correcto, pero NO pueden salir de las HORAS: los atiende
//      la misma persona. Va como fila declarada en CERO y marcada — es el único
//      número de todo el modelo que se cierra con una pregunta de 30 segundos.
//
// QUÉ SE VENDE: Pro ANUAL en los canales pagos. Es la única configuración que
// cierra, y la diferencia no es marginal — está en CONTRAFACTUAL_MENSUAL.

export type HitoMes = {
  mes: number; free: number; pagos: number; mrrEquivalente: number;
  cajaAcum: number; horasDueno: number; horasSoporte: number;
  llamadasServidas: number; llamadasPedidas: number; cacMediosSaturado: number; fteSoporte: number;
};

export type EscenarioProy = {
  id: 'pesimista' | 'conservador' | 'base' | 'optimista';
  nombre: string; mesesConstruccion: number; medios: string; freeAPago: number; p1: number;
  hitos: HitoMes[];
  pisoCajaUsd: number; mesPisoCaja: number; mesCajaPositiva: number | null;
  mesTopeHoras: number; mesPrimeraContratacion: number | null; fteSoporteMax: number;
  llamadasServidas: number; llamadasPedidas: number; programas1a1: number; highTicketAcumUsd: number;
  resumen: string;
};

export const PROYECCION: EscenarioProy[] = [
  {
    id: 'pesimista', nombre: 'Pesimista conjunto — los trece supuestos en su percentil malo a la vez',
    mesesConstruccion: 7, medios: 'US$800/mes desde el mes 8, 70% CTWA / 30% carrito', freeAPago: 0.03, p1: 0.03,
    hitos: [
      { mes: 6, free: 0, pagos: 0, mrrEquivalente: 0, cajaAcum: -900, horasDueno: 60.0, horasSoporte: 0, llamadasServidas: 0, llamadasPedidas: 0, cacMediosSaturado: 0, fteSoporte: 0 },
      { mes: 12, free: 292, pagos: 15, mrrEquivalente: 643, cajaAcum: 1918, horasDueno: 49.2, horasSoporte: 6.6, llamadasServidas: 3.7, llamadasPedidas: 3.7, cacMediosSaturado: 222.6, fteSoporte: 0 },
      { mes: 18, free: 563, pagos: 38, mrrEquivalente: 1535, cajaAcum: 6257, horasDueno: 59.2, horasSoporte: 16.3, llamadasServidas: 3.9, llamadasPedidas: 3.9, cacMediosSaturado: 222.6, fteSoporte: 0 },
      { mes: 24, free: 721, pagos: 50, mrrEquivalente: 2029, cajaAcum: 10412, horasDueno: 60.0, horasSoporte: 22.2, llamadasServidas: 2.2, llamadasPedidas: 4.1, cacMediosSaturado: 222.6, fteSoporte: 1 },
    ],
    pisoCajaUsd: -1413, mesPisoCaja: 8, mesCajaPositiva: 10, mesTopeHoras: 19, mesPrimeraContratacion: 22, fteSoporteMax: 1,
    llamadasServidas: 54, llamadasPedidas: 63, programas1a1: 1.2, highTicketAcumUsd: 6685,
    resumen: 'Es el único escenario donde la promesa de la llamada 1a1 se cumple (85% servidas), y es porque casi no hay compradores. 50 clientes pagos y US$2.029 de MRR equivalente en el mes 24, caja +US$10.412 — de los cuales el 64% lo aporta el high ticket, no el SaaS. A este ritmo el SaaS no paga su propia adquisición: la paga la llamada regalada.',
  },
  {
    id: 'conservador', nombre: 'Conservador — el embudo funciona mal y el dueño no puede dedicarle mucho',
    mesesConstruccion: 6, medios: 'US$1.000/mes (m7-12) → US$1.800 (m13-24), 70% CTWA / 30% carrito', freeAPago: 0.04, p1: 0.03,
    hitos: [
      { mes: 6, free: 0, pagos: 0, mrrEquivalente: 0, cajaAcum: -900, horasDueno: 60.0, horasSoporte: 0, llamadasServidas: 0, llamadasPedidas: 0, cacMediosSaturado: 0, fteSoporte: 0 },
      { mes: 12, free: 617, pagos: 44, mrrEquivalente: 1905, cajaAcum: 12043, horasDueno: 60.0, horasSoporte: 17.1, llamadasServidas: 2.5, llamadasPedidas: 8.9, cacMediosSaturado: 118.9, fteSoporte: 0 },
      { mes: 18, free: 1345, pagos: 129, mrrEquivalente: 5519, cajaAcum: 29029, horasDueno: 60.0, horasSoporte: 45.3, llamadasServidas: 0, llamadasPedidas: 16.3, cacMediosSaturado: 123.6, fteSoporte: 1 },
      { mes: 24, free: 1663, pagos: 193, mrrEquivalente: 8290, cajaAcum: 49392, horasDueno: 60.0, horasSoporte: 65.2, llamadasServidas: 0, llamadasPedidas: 17.3, cacMediosSaturado: 123.6, fteSoporte: 1 },
    ],
    pisoCajaUsd: -1343, mesPisoCaja: 7, mesCajaPositiva: 8, mesTopeHoras: 10, mesPrimeraContratacion: 13, fteSoporteMax: 1,
    llamadasServidas: 34, llamadasPedidas: 236, programas1a1: 0.8, highTicketAcumUsd: 4250,
    resumen: '193 clientes pagos y US$8.290 de MRR equivalente en el mes 24, caja +US$49.392 con un piso de −US$1.343. El tope de 60 h se clava en el MES 10 —por soporte y producto, no por llamadas— y a partir de ahí la promesa de la llamada 1a1 deja de cumplirse: 34 de 236 (15%). Primera contratación de soporte en el mes 13.',
  },
  {
    id: 'base', nombre: 'Base — el embudo rinde como el repo lo tiene modelado, corregido',
    mesesConstruccion: 5, medios: 'US$2.000/mes (m6-8) → US$4.000 (m9-14) → US$7.000 (m15-24), 55% CTWA / 45% carrito', freeAPago: 0.05, p1: 0.07,
    hitos: [
      { mes: 6, free: 22, pagos: 7, mrrEquivalente: 326, cajaAcum: 1403, horasDueno: 45.9, horasSoporte: 0, llamadasServidas: 7.2, llamadasPedidas: 7.2, cacMediosSaturado: 276.0, fteSoporte: 0 },
      { mes: 12, free: 1477, pagos: 168, mrrEquivalente: 7471, cajaAcum: 42389, horasDueno: 60.0, horasSoporte: 49.5, llamadasServidas: 0, llamadasPedidas: 35.6, cacMediosSaturado: 126.4, fteSoporte: 1 },
      { mes: 18, free: 3110, pagos: 445, mrrEquivalente: 19498, cajaAcum: 101436, horasDueno: 60.0, horasSoporte: 127.7, llamadasServidas: 0, llamadasPedidas: 61.2, cacMediosSaturado: 141.5, fteSoporte: 1 },
      { mes: 24, free: 4386, pagos: 703, mrrEquivalente: 30925, cajaAcum: 189877, horasDueno: 60.0, horasSoporte: 205.7, llamadasServidas: 0, llamadasPedidas: 69.4, cacMediosSaturado: 141.5, fteSoporte: 2 },
    ],
    pisoCajaUsd: -750, mesPisoCaja: 5, mesCajaPositiva: 6, mesTopeHoras: 7, mesPrimeraContratacion: 10, fteSoporteMax: 2,
    llamadasServidas: 24, llamadasPedidas: 869, programas1a1: 1.3, highTicketAcumUsd: 5457,
    resumen: '703 clientes pagos y US$30.925 de MRR equivalente en el mes 24, caja +US$189.877. ⚠️ Está COMPRANDO POR ENCIMA DEL TECHO DE VALOR: el CAC de medios saturado del mes 24 es US$141,50 (más el Free y las horas, ~US$242 económico) contra el techo 3:1 del anual de US$155,39 — pero por DEBAJO del techo de caja (US$364). La caja crece y el múltiplo LTV:CAC no llega. Y la promesa de la llamada muere en el mes 7: 24 de 869 servidas (3%).',
  },
  {
    id: 'optimista', nombre: 'Optimista — todo rinde y hay plata para empujar',
    mesesConstruccion: 4, medios: 'US$4.000/mes (m5-6) → US$9.000 (m7-12) → US$18.000 (m13-24), 45% CTWA / 55% carrito', freeAPago: 0.08, p1: 0.12,
    hitos: [
      { mes: 6, free: 626, pagos: 94, mrrEquivalente: 4395, cajaAcum: 30769, horasDueno: 60.0, horasSoporte: 6.8, llamadasServidas: 0, llamadasPedidas: 68.6, cacMediosSaturado: 59.5, fteSoporte: 0 },
      { mes: 12, free: 5358, pagos: 911, mrrEquivalente: 41681, cajaAcum: 264894, horasDueno: 60.0, horasSoporte: 237.8, llamadasServidas: 0, llamadasPedidas: 166.3, cacMediosSaturado: 70.0, fteSoporte: 2 },
      { mes: 18, free: 12497, pagos: 2479, mrrEquivalente: 112035, cajaAcum: 724106, horasDueno: 60.0, horasSoporte: 644.8, llamadasServidas: 0, llamadasPedidas: 334.2, cacMediosSaturado: 80.5, fteSoporte: 4 },
      { mes: 24, free: 18318, pagos: 4011, mrrEquivalente: 181386, cajaAcum: 1381678, horasDueno: 60.0, horasSoporte: 1056.1, llamadasServidas: 0, llamadasPedidas: 410.8, cacMediosSaturado: 80.5, fteSoporte: 7 },
    ],
    pisoCajaUsd: -600, mesPisoCaja: 4, mesCajaPositiva: 5, mesTopeHoras: 5, mesPrimeraContratacion: 7, fteSoporteMax: 7,
    llamadasServidas: 17, llamadasPedidas: 4968, programas1a1: 1.5, highTicketAcumUsd: 5872,
    resumen: '4.011 clientes pagos y US$1,38 M de caja acumulada. ⚠️ NO ES UN PLAN, ES UN DIAGNÓSTICO: requiere 7 FTE de soporte contratados por una persona que en el mes 5 ya tiene el calendario 100% lleno, y sirve 17 de 4.968 llamadas (0%). El escenario donde el SaaS funciona es el escenario donde el high ticket deja de existir: US$5.872 de high ticket acumulado sobre US$1,38 M de caja, el 0,4%.',
  },
];

/**
 * EL CONTRAFACTUAL QUE ES EL RESULTADO DE TODA LA CORRIDA.
 * La MISMA máquina, el mismo embudo, el mismo gasto, las mismas horas — y lo
 * único que cambia es si el canal pago vende el Pro MENSUAL o el Pro ANUAL.
 * El anual no es una promoción: es el modelo de negocio.
 */
export const CONTRAFACTUAL_MENSUAL = [
  { escenario: 'pesimista', cajaAnualUsd: 10412, cajaMensualUsd: -2994, pagosAnual: 50, pagosMensual: 26 },
  { escenario: 'conservador', cajaAnualUsd: 49392, cajaMensualUsd: -250, pagosAnual: 193, pagosMensual: 105 },
  { escenario: 'base', cajaAnualUsd: 189877, cajaMensualUsd: 3073, pagosAnual: 703, pagosMensual: 381 },
  { escenario: 'optimista', cajaAnualUsd: 1381678, cajaMensualUsd: 323298, pagosAnual: 4011, pagosMensual: 2046 },
];

/** Lo que hay que poner para arrancar, en las DOS monedas. El modelo anterior
 *  publicaba solo la primera. */
export const CAPITAL_NECESARIO = {
  dolares: { pesimista: 1413, conservador: 1343, base: 750, optimista: 600 },
  conLagDeCobro: 'Si el high ticket se cobra con 2 meses de lag —lo realista para cerrar US$4.000— cada piso se profundiza ~2×.',
  horasDelDueno: { pesimista: 420, conservador: 360, base: 300, optimista: 240 },
  horasQue: '60 h/mes × los meses de construcción, sin un peso de ingreso. Los pasos 1-11 de ORDEN_DE_TRABAJO a un piso explícitamente generoso de 20 h por paso son 220 h; el resto es margen.',
  agencia: '⚠️ FALTA EL TERCER PRECIO: cuántas horas/mes le llevan hoy Mauricio, Leandro y Leila. El modelo las declara en CERO y eso es falso. Si la agencia factura más de ~US$3.400/mes, el escenario base deja al dueño PEOR que hoy hasta el mes 8.',
  origen: 'supuesto' as Origen,
};

/** Lo que el CAC de un canal NO puede arreglar, porque no es un problema de CAC. */
export const RIESGOS_DE_RAIL = [
  { id: 'evolution', titulo: 'El canal por el que corre el producto es un cliente NO AUTORIZADO de WhatsApp',
    que: 'lib/evolution.ts:1-6, textual: «Evolution API — WhatsApp NO oficial (número por QR…). Cuenta única de MaKo, UNA instancia por workspace». WhatsApp: «linking your WhatsApp account to unofficial versions of WhatsApp violates our Terms of Service». El baneo es inmediato y sin escalera —la escalera de 5/7/30 días que el modelo citaba es del régimen de la Cloud API, que no es este. Es feature PAGA del Pro y del Growth. No es un costo: es una caída de producto sobre todo el MRR a la vez.' },
  { id: 'waba', titulo: 'MaKo no tiene WABA propio, y no está en ninguno de los 11 pasos',
    que: 'lib/chatwoot.ts:573-613 saca el WABA del provider_config del inbox de CADA CLIENTE. No existe uno de MaKo. Verificación de negocio en Meta + alta del WABA + número dedicado + aprobación del display name: semanas, en serie, con posibilidad de rechazo, y fuera de la ventana de construcción.' },
  { id: 'wa-del-cliente', titulo: 'La nutrición del Growth se la factura Meta AL CLIENTE, y puede costarle 1-3× el plan',
    que: 'El WABA es del cliente, así que Meta le cobra a él. modelo.ts COBRO «whatsapp» ya cotiza ~US$1-3 por lead por mes de reactivación: un Growth que nutre 100 leads paga US$100-300/mes ENCIMA de los US$97. Hoy el modelo asume US$0, y ese cero solo es cierto mientras el rail sea el ilegal. Es una bomba de precio y de churn que no está en ninguna fila.' },
];

/** Sin estas tres, ninguno de los números de arriba es verificable ex-post. Van
 *  ADENTRO del registro que se está por escribir; después cuestan una migración
 *  y un backfill imposible. */
export const PARA_QUE_ESTO_SE_PUEDA_MEDIR = [
  'Columna `origen` en `workspaces`, sellada en el REGISTRO, first-touch, con catálogo cerrado de 5 valores. Sin ella no se puede atribuir un solo cliente a un canal.',
  'Link de alta trackeado POR CONVERSACIÓN. Es lo único que mide conversación→registro, el eslabón sin dato de todo el modelo y el único que MaKo controla al 100%. Se cierra con US$300-500 de gasto real en México o Colombia.',
  'El arreglo de lib/anthropic-usage.ts:22-25, que hoy escribe TODA fila de Anthropic en el ws1 y hace que el costo de IA por cliente sea literalmente inmedible. Es el único término de la fórmula que se puede medir de verdad, y no se está midiendo.',
];

// =============================================================================
// PARTE 5 — EL PLAN QUE EL DUEÑO DECIDIÓ, CORREGIDO Y CERRADO
// =============================================================================
// Esto reemplaza al panel de 24 meses que circuló en agosto. Se le aplicaron las
// 38 fallas auditadas; las 14 que cambiaban el signo son obligatorias y están
// todas adentro. La regla del archivo sigue en pie: cada número dice de dónde
// salió, y además acá cada bloque dice QUÉ DECIDE.
//
// ⚠️ AL PORTAR ESTO HAY QUE CORREGIR, EN EL MISMO COMMIT:
//   · modelo.ts:597 — PRECIOS growth anualUsd 1067 → 970 ('2 meses gratis · 16,7%')
//   · modelo.ts:822 — COHORTE_GRUPAL.horasPorCabeza es 1,0 y NO 0,125: el 0,125
//     es UNA sesión ÷ 12, no la cohorte de ocho. Ver TRAMOS_CAPACIDAD.
// Dos cards pegadas que dicen «2 meses gratis» y «1 mes gratis» se leen como
// error de tipeo, y un error de tipeo en la página de precios hace dudar del
// resto de los números.
//
// LAS TRES CORRECCIONES QUE MUEVEN TODO LO DEMÁS, en una línea cada una:
//   1. El costo de IA por cliente NO es US$2,52: ese número asume un ruteo que
//      SALVEDADES id 'ruteo-no-existe' declara inexistente. Hoy son US$10,90.
//   2. El techo de CAC se compara contra la MEZCLA de planes vendidos, no contra
//      el Pro anual solo, y con el CAC MARGINAL, no el medio.
//   3. La llamada de bonus se gatea a los que califican. Eso no cambia cuántos
//      programas se venden — cambia cuánto calendario cuesta venderlos.

export type Regla = 'payback' | 'tresAUno';

// ── EL MES 0 QUE NO ESTABA EN NINGUNA FILA ──────────────────────────────────
// DECIDE: cuándo puede arrancar el mes 1. No es una fila de la tabla porque no
// vende nada, y por eso se caía del plan.
export const MES_0 = {
  que: 'Tres páginas legales y la aprobación del merchant of record. Nada de esto vende, y sin esto no se cobra.',
  bloqueantes: [
    '/terminos, /privacidad y /reembolsos no existen — verificado, y HUECOS ya lo decía',
    'Paddle APRUEBA el negocio antes de activarte y pide esas páginas: días o semanas ANTES del primer cobro',
    '⚠️ El atajo «mientras tanto vendo con un link de Stripe» está PROHIBIDO por COBRO id \'stripe-reloj\': la primera venta a un mexicano arranca un reloj de 30 días naturales para inscribirse en el RFC, con representante legal y domicilio en territorio nacional',
  ],
  horasDueno: 12,
  origen: 'medido' as Origen,
  nota: 'Si se decide vender con Stripe igual, hay que decidir explícitamente NO vender a mexicanos los primeros meses — y México es donde el propio repo dice que la aprobación de tarjeta es mejor.',
};

// ── LOS 1.000 CONTACTOS PROPIOS ─────────────────────────────────────────────
// DECIDE: cuántas altas trae la base, y por qué canal se la puede tocar.
//
// ⚠️ NO ES UN CANAL, y por eso vive acá y no en CAC_CANALES: es un EVENTO de
// arranque que se agota en dos meses y no vuelve. Meterlo entre los canales es lo
// que hizo que se contara dos veces con `prospeccion` — que sí es un canal, el
// recurrente con el chatbot, y que trabaja contactos que NO son estos 1.000.
// ⚠️ La corrección más cara de todo el plan: el panel usaba 8% de conversión
// sobre los que responden y lo justificaba con «el ask es 85× más chico». El
// argumento tiene el signo al revés. El 3,5% del propio dueño es la tasa a la
// que un contacto tibio acepta una llamada GRATIS; pedir US$470 prepago baja esa
// tasa, no la multiplica por 2,3.
export const BASE_PROPIA = {
  contactos: 1000,
  responden: 0.20, respondenOrigen: 'supuesto' as Origen,
  respondenFuente: 'Estrategia.tsx:63, textual «20% — la abro yo»',
  cierran: 0.035, cierranOrigen: 'supuesto' as Origen,
  cierranFuente: 'Estrategia.tsx CANAL_A (líneas 60-64), la misma cadena del dueño: 200 responden → 7. Se usa para CIERRE DIRECTO con link de pago, sin llamada de por medio — que es la lectura generosa, porque la cadena original la gastaba en agendar.',
  aprobacionCobro: 0.85, aprobacionOrigen: 'supuesto' as Origen,
  aprobacionFuente: 'CAC_CANALES.carrito cotiza 0,70 de aprobación de tarjeta. Acá sube a 0,85 porque la venta es a mano por WhatsApp y se reintenta en el momento.',
  // ⚠️ CORREGIDO: nacieron como 5,95 + 2,55 = 8,5 y la cadena de arriba da 5,95.
  // Los 8,5 son la cuenta con 5% de cierre, que es de OTRA corrida: convivían dos
  // mundos en la misma línea y el 2,55 era doble conteo. Las tres anclas del propio
  // archivo dicen 5,95 — `cierranFuente` (200 responden → 7), `losQueFaltan.viaBase`
  // («duplicar de 3,5% a 7% son +5,95») y `PLAN_MES_1.desglose.base`.
  // ❓ PENDIENTE DEL DUEÑO: si el mes 2 era una SEGUNDA pasada sobre los que no
  // contestaron, es otra cadena con su propia tasa y hay que declararla aparte.
  // Hasta que lo diga, el mes 2 son las 10 h que faltan para terminar la pasada,
  // no una cosecha nueva. `tests/pricing-modelo.test.ts` no deja que se separen otra vez.
  altasMes1: 5.95, altasMes2: 0, altasTotal: 5.95,
  horasMes1: 30, horasMes2: 10,
  /** Con el chatbot escribiendo y contestando, las 40 h a mano caen a 1. */
  horasConMaKo: 1, loHabilita: 'Agente: Chatbot',
  origen: 'supuesto' as Origen,
  costoIaUsd: 30, costoIaComo: '1.000 mensajes redactados por MaKo con lo que sabe de cada contacto, ~US$0,03 c/u',
  // ── El veredicto legal, y es accionable, no un «ojo» ──
  legal: {
    veredicto: 'Un vínculo comercial previo NO es opt-in. Messaging Policy de Meta §1 exige «(b) you have received opt-in permission from the recipient» y excluye textualmente el consentimiento «assumed… from a purchase».',
    peroQue: 'Eso gobierna la WhatsApp Business Platform (WABA + plantillas + API), y MaKo NI SIQUIERA TIENE WABA propio — lib/chatwoot.ts:573-613 lo saca del inbox de cada cliente. Una persona escribiéndole a sus contactos desde su número no es una campaña de la plataforma de negocios.',
    comoSeHace: [
      'ESCRIBE MARTÍN, desde su número personal, a mano, uno por uno. No MaKo, no Evolution, no plantilla, no lote.',
      'EL CANAL SE PARTE EN DOS: a los que ya le escribieron alguna vez (hay hilo bidireccional), WhatsApp. A los demás, EMAIL primero por Resend desde hola@hola-mako.com, y WhatsApp solo si contestan.',
      'EL TEXTO nombra el vínculo concreto en la primera línea y ofrece salida en el mismo mensaje. Un texto que sirve para los 1.000 iguales ES un broadcast, y lo que mata no es una revisión humana: es la tasa de bloqueo.',
      // Sexta tanda (09/10/2026): decía «ventana 9-21», que era la del motor de entonces. El motor ya no
      // tiene ventana (el horario de envío es opcional, en Configuraciones) y esto lo escribe una
      // persona a mano: el ritmo es suyo, en horas de trabajo de quien lo recibe.
      'EL RITMO: máximo 40 por día, en horas de trabajo de quien lo recibe, nunca dos canales a la misma persona en la misma semana.',
      '⛔ COLOMBIA NO: la Ley 2300/2023, ampliada en 2024, cubre mensajería web con WhatsApp explícito.',
    ],
    origen: 'publicado' as Origen,
  },
  cotizacion: 'US$3.000 de horas del dueño (30 h × US$100) + US$30 de IA para 5,95 altas = US$509 por alta. Es 3,7× la plata que cuesta el carrito y sigue siendo el mejor arranque del mes 1 porque no compite por presupuesto sino por horas que igual no se pueden vender. ⚠️ Y es un activo de UNA SOLA VEZ: en el mes 3 ya está agotado y no vuelve. ⚠️ Ojo con esa comparación: US$509 son horas valuadas a US$100 y los US$136 del carrito son plata de verdad — se ponen al lado para dar escala, no para sumarse ni para elegir por el número más chico.',
};

// ── EL MES 1 ────────────────────────────────────────────────────────────────
// DECIDE: si salen los 30 usuarios que el dueño puso como objetivo.
export const PLAN_MES_1 = {
  objetivoDueno: 30,
  altasCobradas: 11.1,
  cumplimiento: 0.37,
  desglose: { base: 5.95, ads: 5.12, referidos: 0 },
  gastoAds: 1000,
  gastoAdsQue: '⚠️ Rotulado presupuesto de MEDICIÓN, no de adquisición. Compra el dato del CAC real, que es el supuesto más caro del modelo, y US$1.000 es el piso para que Meta salga de aprendizaje. Bajo la regla de valor estos 5,1 clientes están 71% arriba de lo que se puede pagar: CAC económico US$251,67 (US$166 de medios + US$85 de las 0,85 h que cuesta cerrar a mano) contra los US$182,01 que la regla de payback deja pagar sobre la mezcla de planes.',
  cacMediosUsd: 166.00,
  cacEconomicoUsd: 251.67,
  horasDueno: 56.4,
  contribucionUsd: 717,
  // ⚠️ ESTE ES EL NÚMERO DEL MES 1, Y NO ESTABA EN NINGUNA COLUMNA.
  interesadosSinDondeAterrizar: 199,
  elHallazgo: 'EL MES 1 TIRA 199 INTERESADOS A LA BASURA. US$1.000 de CTWA compran 400 conversaciones → 120 registros (CAC_CANALES.ctwa: 66,67 conversaciones por pago, 20 registros, 19 no pagan) y hoy NO HAY DÓNDE PONERLOS: app/api/auth/callback/google/route.ts:12 dice textual «cualquier otro caso → no-autorizado. Los usuarios nuevos se agregan desde /admin», y lib/credenciales.ts:126-132 hace que un workspace sin key propia EXPLOTE en la primera pantalla. El paso 8 de ORDEN_DE_TRABAJO (alta pública) vale más que los US$1.000 de pauta: 199 interesados al 5% de FREE_A_PAGO son 10 altas, casi el doble de lo que compró la pauta, y cuestan cero dólares de medios.',
  // ── Por qué no salen los 30, con el número que cierra la discusión ──
  losQueFaltan: {
    faltan: 18.9,
    viaAds: 'US$3.686 adicionales (US$4.686 de gasto total). A ese gasto el CAC de medios saturado es US$226,60 y el económico US$311,60 = 171% de lo que deja pagar la regla de PAYBACK, que es la más permisiva del modelo. NO SE COMPRAN A NINGÚN PRECIO QUE RESPETE NINGUNA REGLA.',
    viaBase: 'Duplicar la conversión de la base de 3,5% a 7% son +5,95 altas y cuesta US$30 de IA. Cierra 6 de las 19, no las 19.',
    viaProducto: 'El alta pública (paso 8): 199 interesados × 5% = 10 altas. Es la única de las tres que cierra la mitad de la brecha y no cuesta medios.',
    veredicto: '11 de 30. Las 19 que faltan no se compran: se construyen. Y antes de gastar un dólar más, el dueño tiene que decir si «30 usuarios» eran 30 PAGOS o 30 REGISTRADOS — registrados salen 210 el mes 1 y hoy se pierden todos.',
  },
  origen: 'supuesto' as Origen,
};

// ── LAS CONSTANTES CORREGIDAS QUE ALIMENTAN TODO LO DEMÁS ───────────────────

/**
 * EL COSTO DE IA POR CLIENTE PRO. Reemplaza al US$2,52 de EXPOSICION.
 * ⚠️ Aquel número es una proyección sobre el ruteo barato, y SALVEDADES
 * id 'ruteo-no-existe' dice textual: «Ninguno de los cuatro modelos de RUTEO
 * aparece en una línea ejecutable». Un cliente que entra hoy entra con Fathom,
 * Closing Analyst y Ads Analyst prendidos y sin cupo — CUPO_MT no tiene un solo
 * call-site fuera de la pantalla de pricing.
 */
export const IA_POR_PRO = {
  hoyUsd: 10.90, hoyOrigen: 'medido' as Origen,
  hoyComo: '8 reuniones × US$0,93 (ACCIONES id \'reunion\', el número que EL_COSTO_ES_EL_VIDEO ya publica) + 20 llamadas de venta × US$0,173 (ACCIONES id \'closing\')',
  conRuteoUsd: 3.47, conRuteoOrigen: 'supuesto' as Origen,
  conRuteoComo: 'Las reuniones caen a ~US$0 (436×, EL_COSTO_ES_EL_VIDEO) y el closing SE QUEDA en Claude a propósito: es una de las tres features con `pagoPorque` en lib/model-catalogo.ts. 20 × US$0,173 = US$3,46. El US$2,52 del repo asume que TODO se rutea, incluido lo que el catálogo dice que se paga a sabiendas.',
  cuandoBaja: 'Mes 7 — pasos 1 a 6 de ORDEN_DE_TRABAJO.',
  loQueVale: 'US$15.018 de caja a 24 meses. Es el número más grande que produce una decisión de ingeniería en todo el modelo: la corrida con IA a US$10,90 los 24 meses deja US$54.132 contra US$69.150.',
  elLimite: '⚠️ Arriba de US$39,77/mes de IA (43,77 neto − 3,00 de soporte − 1,00 de infra) un Pro mensual es caja NEGATIVA. El único workspace real medido (ws1) está en US$68,39/mes.',
};

/** Renovación del anual. UN solo valor en los dos lados del modelo — antes había
 *  23% adentro del techo (UNIT proAnual: 364/0,77) y 60% adentro de la caja. */
export const RENOVACION_ANUAL = {
  valor: 0.40, origen: 'supuesto' as Origen,
  porQue: 'Punto medio entre el GRR 23% del Pro mensual —que el propio repo dice que NO se puede extrapolar al anual— y el 60% que el panel inventó. Se mide por primera vez en el MES 13, con la cohorte del mes 1.',
  sensibilidad: 'Caja del mes 24: US$66.340 a 23% · US$69.150 a 40% · US$72.457 a 60%. Los extremos separan US$6.117, el 8,8% de la caja. ⚠️ NO es el riesgo de primer orden que el panel decía (afirmaba US$18.000 y son US$3.307 entre 60% y 40%).',
};

/** La llamada de bonus del anual, con el gate puesto y la duración honesta. */
export const LLAMADA_BONUS = {
  horasCalendario: 1.0,
  desglose: { enVivo: 0.75, revisionDelInforme: 0.25 },
  queDiceLaCard: '45 minutos conmigo, con el análisis de tu negocio ya escrito',
  origen: 'supuesto' as Origen,
  porQue: '⚠️ La card del panel prometía «Dos horas conmigo, 1 a 1» y el modelo compraba 1,25 h — y encima derivaba mal (2,0 − 0,5 = 1,5, no 1,25). LLAMADA.desglose dice que de las 2,0 h del repo solo 1,0 es cara a cara. Y el mecanismo que el propio repo propone para abaratarla (embudo:378) es ACORTAR la llamada de 60 a 25 minutos, no estirarla a 120. Acá se honra el presupuesto y el copy dice lo que se entrega.',
  // El gate. Es lo que devuelve el calendario sin tocar el resultado.
  gate: { fase: '≥3 (US$10k+/mes, lib/fase-diagnostico.ts PREGUNTAS[0])', ticket: '≥ US$1.000 (lib/onboarding.ts:30)', pasa: 0.40 },
  t: 0.75, tQue: 'agenda × se presenta (LLAMADA.t)',
  costoPorCompradorAnualUsd: 30.00,
  costoComo: '0,40 que califica × 0,75 de show × 1,0 h × US$100/h. Sin gate son US$75,00.',
  loQueValeElGate: 'CERO diferencia en programas vendidos (0,40 × 0,20 = 1,00 × 0,08) y 39,7 HORAS de calendario en 24 meses — US$3.970 de capacidad del dueño. El gate no vende más: vende lo mismo con la mitad del calendario. ⚠️ Y por eso la card NO puede prometer la llamada a todo comprador anual: se la promete al 40%, y hay que escribirlo así («si tu negocio califica —te lo decimos en el onboarding—»), o son 6 de cada 10 compradores con una promesa incumplida adentro de la ventana de reembolso.',
  bloqueante: '🔧 Hoy no se puede preguntar «quién está en fase ≥3»: el diagnóstico es un blob JSON en app_settings y getSetting está duro-scopeado por workspace (lib/settings.ts:20-27). Se arregla promoviendo `fase` y `oferta_ticket` a COLUMNAS de `workspaces` en la migración 0125, que ya está planificada (ORDEN_DE_TRABAJO #3). Con 11 clientes se califica a mano y está perfecto.',
};

// ── LA UNIT ECONOMICS CORREGIDA ─────────────────────────────────────────────
// Mismo tipo `UnitPlan` de arriba. Lo que cambia: iaUsd real, renovación única,
// y el ascenso al high ticket calculado CON el gate y CON P₂ = 0.
//
// ⚠️ P₂ = 0 A PROPÓSITO. ASCENSO_NETO hereda un P₂ = 5% del programa GRUPAL, y
// el grupal no existe: modelo.ts:844 lo rotula «en evaluación — no existe como
// producto» y este plan decide no lanzarlo. El grupal aportaba el 28,9% del
// valor esperado del ascenso; sacarlo es la corrección honesta.

export const ASCENSO_NETO_V2 = {
  p1SobreLlamadaServida: 0.20, p1Origen: 'supuesto' as Origen,
  p1Que: 'Cierre entre CALIFICADOS. No es comparable con P1_ASCENSO.base (7%), que es sobre todo comprador: con el gate del 40%, 0,40 × 0,20 = 8% efectivo, que sí es el mismo objeto.',
  p2: 0, p2Que: 'El grupal no se lanza en los 24 meses. Ver TRAMOS_CAPACIDAD.',
  m1CapacidadUsd: 1541.33, m1Como: 'US$3.441,33 de caja (ASCENSO_PROGRAMAS.unoAUno) − 19 h × US$100',
  valorEsperadoPorCompradorAnualUsd: 92.48,
  costoPorCompradorAnualUsd: 30.00,
  netoUsd: 62.48,
  breakEvenP1: 0.0649,
  breakEvenComo: 'US$100 (1,0 h de calendario) ÷ US$1.541,33 de M₁. UN break-even, no tres: el panel medía el mismo programa contra 6,44%, 7,47% y 10,3% en tres párrafos distintos.',
  margen: 'El plan corre a 20% contra un break-even de 6,49%: 3,1× de aire. El panel corría a 8% contra 7,47% y titulaba «a 0,53 puntos del break-even» — la diferencia no es research, es el gate.',
  sensibilidad: 'Si el cierre entre calificados es 10% el neto sigue en +US$16,24. Si la entrega se va a 24 h (llamadas de 60\' con preparación a mano) el break-even sube a 9,60% y el neto a +US$32,48. A 40 h de entrega M₁ es NEGATIVO (−US$558,67) y el programa deja de aportar al LTV.',
  origen: 'supuesto' as Origen,
};

export const UNIT_V2: UnitPlan[] = [
  { plan: 'free', precioListaUsd: 0, netoUsd: 0, netoOrigen: 'medido',
    iaUsd: 0.05, soporteUsd: 0.40, infraUsd: 0.15, contribucionMes: -0.60,
    grrAnual: null, vidaMeses: 6.67, ltvSuscripcion: -4.00, ltvTotal: -4.00,
    cacMax3a1: 0, cacMaxPayback: 0, gobierna: 0,
    reglaQueGobierna: 'no aplica — y ojo: en este plan el Free NO EXISTE hasta el mes 10 (paso 10 de ORDEN_DE_TRABAJO). Antes de eso el que entra tiene cuenta provisionada a mano.' },

  { plan: 'pro', precioListaUsd: 47, netoUsd: 43.77, netoOrigen: 'supuesto',
    iaUsd: 3.47, soporteUsd: 3.00, infraUsd: 1.00, contribucionMes: 36.30,
    grrAnual: 23, vidaMeses: 8.7, ltvSuscripcion: 315.81, ltvTotal: 315.81,
    cacMax3a1: 105.27, cacMaxPayback: 108.90, gobierna: 105.27,
    reglaQueGobierna: 'LTV:CAC 3:1. ltvTotal = ltvSuscripcion porque el Pro MENSUAL no recibe la llamada: es bonus del anual y de nadie más. ⚠️ Con la IA de HOY (US$10,90) la contribución es US$28,87 y el techo US$81,50.' },

  { plan: 'growth', precioListaUsd: 97, netoUsd: 90.87, netoOrigen: 'supuesto',
    iaUsd: 25.18, soporteUsd: 8.00, infraUsd: 5.00, contribucionMes: 52.69,
    grrAnual: 45, vidaMeses: 15.5, ltvSuscripcion: 816.70, ltvTotal: 816.70,
    cacMax3a1: 272.23, cacMaxPayback: 158.07, gobierna: 158.07,
    reglaQueGobierna: 'payback ≤3 meses. No se vende hasta el MES 13: su gancho (Image Generator) es un ComingSoon de 8 líneas, FUERA_DE_GRILLA.growthEnEspera.' },

  // EL PLAN QUE SOSTIENE EL NEGOCIO. Contribución del año cobrada entera el día 0.
  { plan: 'proAnual', precioListaUsd: 470, netoUsd: 442.24, netoOrigen: 'publicado',
    iaUsd: 41.64, soporteUsd: 36.00, infraUsd: 12.00, contribucionMes: 352.60,
    grrAnual: 40, vidaMeses: 12, ltvSuscripcion: 587.67, ltvTotal: 650.15,
    cacMax3a1: 216.72, cacMaxPayback: 352.60, gobierna: 216.72,
    reglaQueGobierna: '⚠️ LAS DOS REGLAS SIGUEN SEPARADAS 1,6× Y SIGUEN SIENDO LA DECISIÓN MÁS GRANDE DE LA TABLA — pero ahora está cuantificada: bajo 3:1 la pauta se capa en US$1.000/mes y el mes 24 cierra con 104 clientes y US$50.780; bajo payback se capa en US$1.552-1.940 y cierra con 160 y US$69.150. La diferencia son 56 clientes y US$18.370. Ver PREGUNTAS_ABIERTAS #1.' },
];

/** Techo MEZCLADO — es contra lo que se compara una campaña que vende de todo.
 *  ⚠️ El panel comparaba el CAC contra el techo del Pro ANUAL solo, y el anual
 *  es el 30% de las altas. Ese error solo valía 1,6× de presupuesto de pauta. */
export const TECHO_MEZCLADO_V2 = {
  m1a12: { mezcla: '70% Pro mensual / 30% Pro anual — el Growth no se vende todavía', regla3a1: 138.70, reglaPayback: 182.01 },
  m13a24: { mezcla: '61,6% Pro mensual / 26,4% Pro anual / 8,4% Growth mensual / 3,6% Growth anual', regla3a1: 154.03, reglaPayback: 189.83 },
  derrameFreeUsd: 12.00,
  derrameQue: '3 registros que no pagan por cada pago × US$4,00 de vida (CAC_CANALES.carrito.costoFree). Se RESTA del techo antes de comparar contra el CAC de MEDIOS, porque en la proyección el Free vive en la P&L. CAC_CANALES:941 lo dice textual: «hay que elegir UNA». El panel hacía las dos.',
  origen: 'supuesto' as Origen,
};

/** EL TOPE DE PAUTA, con la regla del dólar siguiente aplicada de verdad.
 *  ⚠️ El panel publicaba US$5.800/mes calculado sobre el CAC MEDIO. modelo.ts
 *  SATURACION dice textual que «el CAC medio no decide si conviene gastar más:
 *  decide el MARGINAL» y da el divisor (0,7984). El panel citó la regla y se
 *  salteó la división. Y hay un segundo detalle: la saturación arranca ARRIBA de
 *  US$1.000/mes, así que por debajo de ese gasto el marginal ES el medio. */
export const TOPE_PAUTA = {
  cacBaseCarrito: 124.22, cacBaseOrigen: 'supuesto' as Origen,
  bajo3a1: { m5a12: 1000, m13a24: 1000, nota: 'Exactamente US$1.000/mes: al CAC base (US$124,22) el carrito entra contra el techo de medios (US$126,70), pero el primer dólar por encima de US$1.000 dispara la saturación y el marginal salta a US$155,59 — 23% arriba del techo.' },
  bajoPayback: { m5a12: 1552, m13a24: 1940, nota: 'Donde el marginal (medio ÷ 0,7984) toca el techo de medios de payback.' },
  loQueCuesta: 'Elegir 3:1 en vez de payback cuesta 56 clientes y US$18.370 de caja a 24 meses. Elegir payback significa comprar a ~1,7:1, que es el cuartil que el propio repo dice que destruye valor con cada cliente.',
  yLoQueNoEsLaPalanca: '⚠️ Ninguna de las dos reglas habilita los US$5.800/mes del panel. Con US$5.800 el mes 24 cierra con 402 clientes y US$120.580 de caja — pero US$119.000 de esa pauta se compraron arriba de lo que vale un cliente, y ahí sí aparece el déficit que el panel decía tener: 29,4 llamadas servidas de 65,1 pedidas. Si se quiere crecer más rápido la palanca NO es presupuesto: es bajar el costo por conversación de US$1,50 a US$1,10 y subir la aprobación del cobro de 70% a 88% con rieles locales. Las dos juntas bajan el CAC ~30% y SUBEN lo que vale un cliente al mismo tiempo.',
  origen: 'supuesto' as Origen,
};

// ── LA PROYECCIÓN A 24 MESES ────────────────────────────────────────────────
// DECIDE: si el plan necesita capital, cuándo se contrata, y qué cierra el mes 24.
//
// Regla de esta tabla, y es la que el panel rompía: `llamadas` es un RESIDUAL,
// no un dato. Se calcula con lo que sobra del calendario después de soporte,
// producto, venta, entrega y agencia — nunca al revés.
//
// EL LIBRO DE HORAS, UNA SOLA REGLA (el panel usaba dos, cada una donde
// convenía): el dueño hace las primeras 20 h/mes de soporte; pasado eso se
// contrata a US$20/h y le queda el 15% como gestión. Y el soporte se cobra UNA
// vez: los US$3,00/cliente de `soporteUsd` en UNIT son EL MISMO DINERO que la
// columna `costoSoporte` de acá, así que acá no se vuelve a cobrar.

export type MesProy = {
  mes: number; que: string;
  gastoAds: number; cacMedios: number;
  /** Los que dieron el paso y NO tienen dónde aterrizar hasta el mes 10. */
  interesados: number; freeVivos: number;
  altasNuevas: number; altasProMensual: number; altasProAnual: number;
  /** ⚠️ Columna propia. El panel las metía adentro de `altasProAnual` y con eso
   *  subestimaba el CAC 14% y le servía la llamada a gente que ya pasó por el pitch. */
  renovacionesAnual: number; altasGrowth: number;
  pagosVivos: number; mrrEquivalente: number; cobradoMes: number;
  costoIa: number; costoInfra: number; costoSoporte: number;
  horasSoporteTotal: number; horasDueno: number;
  llamadasPedidas: number; llamadasServidas: number;
  ventasHighTicket: number; ingresoHighTicket: number;
  contribucion: number; caja: number;
};

export const PROYECCION_24: MesProy[] = [
  { mes: 1, que: 'Lanzamiento. La base propia a mano (30 h) + US$1.000 de MEDICIÓN en CTWA. 11 altas cobradas, no 30. Cero horas de producto.', gastoAds: 1000, cacMedios: 166.00, interesados: 210, freeVivos: 0, altasNuevas: 11.1, altasProMensual: 7.2, altasProAnual: 3.9, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 11.1, mrrEquivalente: 490, cobradoMes: 2028, costoIa: 151, costoInfra: 11, costoSoporte: 0, horasSoporteTotal: 1.7, horasDueno: 56.4, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0, ingresoHighTicket: 0, contribucion: 717, caja: 717 },
  { mes: 2, que: 'Rezagados de la base. Arrancan /precios y /checkout (18 h). Se mide el CAC: si pasa de US$180, se corta la pauta.', gastoAds: 1000, cacMedios: 145.00, interesados: 160, freeVivos: 0, altasNuevas: 8.4, altasProMensual: 5.5, altasProAnual: 2.9, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 18.7, mrrEquivalente: 823, cobradoMes: 1820, costoIa: 203, costoInfra: 19, costoSoporte: 0, horasSoporteTotal: 2.8, horasDueno: 53.9, llamadasPedidas: 0.9, llamadasServidas: 0.9, ventasHighTicket: 0, ingresoHighTicket: 0, contribucion: 448, caja: 1165 },
  { mes: 3, que: 'EL MES MÁS FLACO: US$98 de contribución. La base se agotó y la pauta se BAJA a US$500 a propósito, porque con venta a mano cada alta cuesta 0,85 h del dueño.', gastoAds: 500, cacMedios: 130.00, interesados: 62, freeVivos: 0, altasNuevas: 3.3, altasProMensual: 2.3, altasProAnual: 1.0, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 20.6, mrrEquivalente: 905, cobradoMes: 992, costoIa: 224, costoInfra: 21, costoSoporte: 0, horasSoporteTotal: 3.1, horasDueno: 46.0, llamadasPedidas: 0.3, llamadasServidas: 0.3, ventasHighTicket: 0, ingresoHighTicket: 0, contribucion: 98, caja: 1263 },
  { mes: 4, que: 'Primer programa de US$4.000 (fracción). Antes del mes 4 no se puede vender: el comprador no tiene tres meses de datos propios y la semana 0 no existiría.', gastoAds: 500, cacMedios: 115.00, interesados: 70, freeVivos: 0, altasNuevas: 3.7, altasProMensual: 2.6, altasProAnual: 1.1, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 22.8, mrrEquivalente: 1002, cobradoMes: 1213, costoIa: 248, costoInfra: 23, costoSoporte: 0, horasSoporteTotal: 3.4, horasDueno: 46.6, llamadasPedidas: 0.3, llamadasServidas: 0.3, ventasHighTicket: 0.07, ingresoHighTicket: 114, contribucion: 291, caja: 1554 },
  { mes: 5, que: 'CHECKOUT VIVO. Se deja de vender a mano y recién ahí la pauta puede subir a lo máximo que se banca: US$1.552/mes. Las horas del dueño caen de 46,6 a 41,3.', gastoAds: 1550, cacMedios: 135.69, interesados: 217, freeVivos: 0, altasNuevas: 11.4, altasProMensual: 8.0, altasProAnual: 3.4, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 32.6, mrrEquivalente: 1437, cobradoMes: 2872, costoIa: 356, costoInfra: 33, costoSoporte: 0, horasSoporteTotal: 4.9, horasDueno: 41.3, llamadasPedidas: 1.0, llamadasServidas: 1.0, ventasHighTicket: 0.21, ingresoHighTicket: 468, contribucion: 783, caja: 2337 },
  { mes: 6, que: 'Régimen de construcción: 25 h/mes de producto, la pauta en su máximo, el carrito trabajando solo. Arrancan los referidos.', gastoAds: 1550, cacMedios: 135.69, interesados: 229, freeVivos: 0, altasNuevas: 12.1, altasProMensual: 8.5, altasProAnual: 3.6, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 42.4, mrrEquivalente: 1866, cobradoMes: 3486, costoIa: 462, costoInfra: 42, costoSoporte: 0, horasSoporteTotal: 6.4, horasDueno: 44.2, llamadasPedidas: 1.1, llamadasServidas: 1.1, ventasHighTicket: 0.22, ingresoHighTicket: 728, contribucion: 1277, caja: 3614 },
  { mes: 7, que: 'PASOS 1-6: atribución del gasto de Anthropic, migración 0125, y el gate DENTRO de crons y webhooks. El costo de IA por cliente cae de US$10,90 a US$3,47 y se ve en la fila: de US$462 a US$179 con MÁS clientes.', gastoAds: 1550, cacMedios: 135.69, interesados: 233, freeVivos: 0, altasNuevas: 12.3, altasProMensual: 8.6, altasProAnual: 3.7, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 51.6, mrrEquivalente: 2271, cobradoMes: 3781, costoIa: 179, costoInfra: 52, costoSoporte: 0, horasSoporteTotal: 7.7, horasDueno: 46.5, llamadasPedidas: 1.1, llamadasServidas: 1.1, ventasHighTicket: 0.22, ingresoHighTicket: 754, contribucion: 1844, caja: 5458 },
  { mes: 8, que: 'Régimen. La contribución supera los US$2.000/mes por primera vez.', gastoAds: 1550, cacMedios: 135.69, interesados: 237, freeVivos: 0, altasNuevas: 12.5, altasProMensual: 8.7, altasProAnual: 3.7, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 60.4, mrrEquivalente: 2655, cobradoMes: 4038, costoIa: 210, costoInfra: 60, costoSoporte: 0, horasSoporteTotal: 9.1, horasDueno: 48.0, llamadasPedidas: 1.1, llamadasServidas: 1.1, ventasHighTicket: 0.22, ingresoHighTicket: 766, contribucion: 2060, caja: 7518 },
  { mes: 9, que: 'Régimen. Ledger de MaKo Tokens (paso 7) y alta pública terminada.', gastoAds: 1550, cacMedios: 135.69, interesados: 240, freeVivos: 0, altasNuevas: 12.6, altasProMensual: 8.8, altasProAnual: 3.8, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 68.8, mrrEquivalente: 3019, cobradoMes: 4273, costoIa: 239, costoInfra: 69, costoSoporte: 0, horasSoporteTotal: 10.3, horasDueno: 49.3, llamadasPedidas: 1.1, llamadasServidas: 1.1, ventasHighTicket: 0.23, ingresoHighTicket: 777, contribucion: 2257, caja: 9775 },
  { mes: 10, que: 'PASO 10: key de plataforma, y recién acá EXISTE el plan Free. Los interesados dejan de tirarse: de 240 perdidos a 38 que quedan adentro.', gastoAds: 1550, cacMedios: 135.69, interesados: 38, freeVivos: 38, altasNuevas: 12.8, altasProMensual: 9.0, altasProAnual: 3.8, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 76.8, mrrEquivalente: 3366, cobradoMes: 4489, costoIa: 268, costoInfra: 83, costoSoporte: 0, horasSoporteTotal: 12.3, horasDueno: 51.3, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.23, ingresoHighTicket: 788, contribucion: 2428, caja: 12203 },
  { mes: 11, que: 'Régimen. El stock de Free arranca a acumularse y con él su costo (US$0,60/mes cada uno).', gastoAds: 1550, cacMedios: 135.69, interesados: 39, freeVivos: 72, altasNuevas: 13.0, altasProMensual: 9.1, altasProAnual: 3.9, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 84.5, mrrEquivalente: 3697, cobradoMes: 4687, costoIa: 297, costoInfra: 95, costoSoporte: 0, horasSoporteTotal: 14.1, horasDueno: 53.2, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.23, ingresoHighTicket: 798, contribucion: 2584, caja: 14787 },
  { mes: 12, que: 'Cierre del año 1: 92 clientes pagos, US$4.015 de MRR, US$17.513 de caja. Y las primeras 30 llamadas etiquetadas están completas — el dato que reemplaza al supuesto de P₁.', gastoAds: 1550, cacMedios: 135.69, interesados: 39, freeVivos: 100, altasNuevas: 13.1, altasProMensual: 9.2, altasProAnual: 3.9, renovacionesAnual: 0, altasGrowth: 0, pagosVivos: 91.9, mrrEquivalente: 4015, cobradoMes: 4870, costoIa: 324, costoInfra: 107, costoSoporte: 0, horasSoporteTotal: 15.8, horasDueno: 54.9, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.24, ingresoHighTicket: 807, contribucion: 2726, caja: 17513 },
  { mes: 13, que: 'DOS COSAS A LA VEZ: arranca el Growth (paso 11, Image Generator) y llegan las PRIMERAS RENOVACIONES del anual (cohorte del mes 1, al 40%). La pauta sube a US$1.940 porque el Growth entra en la mezcla y sube lo que se puede pagar por cliente.', gastoAds: 1840, cacMedios: 140.47, interesados: 45, freeVivos: 130, altasNuevas: 14.9, altasProMensual: 9.2, altasProAnual: 3.9, renovacionesAnual: 1.5, altasGrowth: 1.8, pagosVivos: 98.4, mrrEquivalente: 4389, cobradoMes: 6306, costoIa: 387, costoInfra: 125, costoSoporte: 0, horasSoporteTotal: 17.8, horasDueno: 50.0, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.24, ingresoHighTicket: 813, contribucion: 3790, caja: 21304 },
  { mes: 14, que: 'Régimen. El producto baja de 25 a 18 h/mes: los 11 pasos están hechos.', gastoAds: 1840, cacMedios: 140.47, interesados: 45, freeVivos: 156, altasNuevas: 15.1, altasProMensual: 9.3, altasProAnual: 4.0, renovacionesAnual: 1.2, altasGrowth: 1.8, pagosVivos: 105.2, mrrEquivalente: 4768, cobradoMes: 6397, costoIa: 449, costoInfra: 143, costoSoporte: 0, horasSoporteTotal: 19.8, horasDueno: 52.0, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.24, ingresoHighTicket: 818, contribucion: 3801, caja: 25104 },
  { mes: 15, que: 'PRIMERA CONTRATACIÓN, y es de SOPORTE. El soporte cruza las 20 h/mes (21,8) y del mes 15 en adelante el dueño se queda con el 15% como gestión.', gastoAds: 1840, cacMedios: 140.47, interesados: 46, freeVivos: 178, altasNuevas: 15.2, altasProMensual: 9.4, altasProAnual: 4.0, renovacionesAnual: 0.4, altasGrowth: 1.8, pagosVivos: 112.9, mrrEquivalente: 5176, cobradoMes: 6292, costoIa: 513, costoInfra: 160, costoSoporte: 36, horasSoporteTotal: 21.8, horasDueno: 52.5, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.24, ingresoHighTicket: 825, contribucion: 3577, caja: 28681 },
  { mes: 16, que: 'TOPE DE PAUTA ALCANZADO Y SOSTENIDO: US$1.940/mes. No sube más en los 9 meses que quedan, y el freno no es la plata: es lo que vale un cliente.', gastoAds: 1840, cacMedios: 140.47, interesados: 46, freeVivos: 197, altasNuevas: 15.4, altasProMensual: 9.5, altasProAnual: 4.1, renovacionesAnual: 0.4, altasGrowth: 1.8, pagosVivos: 120.2, mrrEquivalente: 5568, cobradoMes: 6546, costoIa: 575, costoInfra: 177, costoSoporte: 74, horasSoporteTotal: 23.7, horasDueno: 52.8, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.24, ingresoHighTicket: 833, contribucion: 3714, caja: 32395 },
  { mes: 17, que: 'Régimen. El crecimiento ya no viene del gasto: viene de renovaciones y referidos.', gastoAds: 1840, cacMedios: 140.47, interesados: 47, freeVivos: 214, altasNuevas: 15.5, altasProMensual: 9.6, altasProAnual: 4.1, renovacionesAnual: 1.4, altasGrowth: 1.9, pagosVivos: 126.0, mrrEquivalente: 5894, cobradoMes: 7174, costoIa: 630, costoInfra: 192, costoSoporte: 106, horasSoporteTotal: 25.3, horasDueno: 53.1, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.25, ingresoHighTicket: 841, contribucion: 4239, caja: 36635 },
  { mes: 18, que: 'Régimen. El soporte contratado ya cuesta US$135/mes y es el tercer gasto después de la pauta y la IA.', gastoAds: 1840, cacMedios: 140.47, interesados: 47, freeVivos: 229, altasNuevas: 15.6, altasProMensual: 9.6, altasProAnual: 4.1, renovacionesAnual: 1.4, altasGrowth: 1.9, pagosVivos: 131.5, mrrEquivalente: 6203, cobradoMes: 7408, costoIa: 682, costoInfra: 205, costoSoporte: 135, horasSoporteTotal: 26.8, horasDueno: 53.3, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.25, ingresoHighTicket: 848, contribucion: 4376, caja: 41011 },
  { mes: 19, que: 'Régimen. Déficit de llamadas: CERO. Todas las que el embudo pide se sirven, y sobran 6 h/mes.', gastoAds: 1840, cacMedios: 140.47, interesados: 47, freeVivos: 242, altasNuevas: 15.7, altasProMensual: 9.7, altasProAnual: 4.2, renovacionesAnual: 1.5, altasGrowth: 1.9, pagosVivos: 136.8, mrrEquivalente: 6499, cobradoMes: 7604, costoIa: 733, costoInfra: 218, costoSoporte: 164, horasSoporteTotal: 28.2, horasDueno: 53.6, llamadasPedidas: 1.2, llamadasServidas: 1.2, ventasHighTicket: 0.25, ingresoHighTicket: 854, contribucion: 4479, caja: 45490 },
  { mes: 20, que: 'Régimen. El stock de Free se estabiliza cerca de 253: entran ~47/mes y se van 38 (churn 15%).', gastoAds: 1840, cacMedios: 140.47, interesados: 48, freeVivos: 253, altasNuevas: 15.8, altasProMensual: 9.8, altasProAnual: 4.2, renovacionesAnual: 1.5, altasGrowth: 1.9, pagosVivos: 141.8, mrrEquivalente: 6783, cobradoMes: 7787, costoIa: 782, costoInfra: 231, costoSoporte: 191, horasSoporteTotal: 29.5, horasDueno: 53.8, llamadasPedidas: 1.3, llamadasServidas: 1.3, ventasHighTicket: 0.25, ingresoHighTicket: 860, contribucion: 4573, caja: 50063 },
  { mes: 21, que: 'Régimen. La caja acumulada pasa los US$50.000.', gastoAds: 1840, cacMedios: 140.47, interesados: 48, freeVivos: 263, altasNuevas: 15.9, altasProMensual: 9.8, altasProAnual: 4.2, renovacionesAnual: 1.5, altasGrowth: 1.9, pagosVivos: 146.7, mrrEquivalente: 7057, cobradoMes: 7959, costoIa: 829, costoInfra: 243, costoSoporte: 216, horasSoporteTotal: 30.8, horasDueno: 54.0, llamadasPedidas: 1.3, llamadasServidas: 1.3, ventasHighTicket: 0.25, ingresoHighTicket: 866, contribucion: 4660, caja: 54722 },
  { mes: 22, que: 'Régimen. Nada nuevo, y eso es el dato: el negocio entró en una meseta que solo se rompe subiendo lo que vale un cliente, no el presupuesto.', gastoAds: 1840, cacMedios: 140.47, interesados: 48, freeVivos: 272, altasNuevas: 16.0, altasProMensual: 9.9, altasProAnual: 4.2, renovacionesAnual: 1.5, altasGrowth: 1.9, pagosVivos: 151.4, mrrEquivalente: 7321, cobradoMes: 8120, costoIa: 875, costoInfra: 254, costoSoporte: 240, horasSoporteTotal: 32.0, horasDueno: 54.3, llamadasPedidas: 1.3, llamadasServidas: 1.3, ventasHighTicket: 0.25, ingresoHighTicket: 871, contribucion: 4739, caja: 59461 },
  { mes: 23, que: 'Régimen. Las horas del dueño están en 54,5 de 60: hay 5,5 h/mes de holgura que el embudo no llena.', gastoAds: 1840, cacMedios: 140.47, interesados: 48, freeVivos: 279, altasNuevas: 16.1, altasProMensual: 9.9, altasProAnual: 4.3, renovacionesAnual: 1.6, altasGrowth: 1.9, pagosVivos: 156.0, mrrEquivalente: 7576, cobradoMes: 8272, costoIa: 919, costoInfra: 265, costoSoporte: 264, horasSoporteTotal: 33.2, horasDueno: 54.5, llamadasPedidas: 1.3, llamadasServidas: 1.3, ventasHighTicket: 0.26, ingresoHighTicket: 877, contribucion: 4811, caja: 64272 },
  { mes: 24, que: 'Cierre: 160 clientes pagos, US$7.823 de MRR, US$69.150 de caja acumulada y 4,8 programas de US$4.000 vendidos.', gastoAds: 1840, cacMedios: 140.47, interesados: 49, freeVivos: 286, altasNuevas: 16.2, altasProMensual: 10.0, altasProAnual: 4.3, renovacionesAnual: 1.6, altasGrowth: 1.9, pagosVivos: 160.4, mrrEquivalente: 7823, cobradoMes: 8415, costoIa: 962, costoInfra: 275, costoSoporte: 286, horasSoporteTotal: 34.3, horasDueno: 54.7, llamadasPedidas: 1.3, llamadasServidas: 1.3, ventasHighTicket: 0.26, ingresoHighTicket: 882, contribucion: 4878, caja: 69150 },
];

/** El resultado, y de dónde salió la diferencia con el panel de agosto. */
export const RESULTADO_24 = {
  pagosVivos: 160.4, mrrEquivalente: 7823, cajaAcumulada: 69150,
  pisoCaja: 717, mesPisoCaja: 1, mesesEnRojo: 0,
  programas1a1: 4.85, highTicketCajaUsd: 16188,
  llamadasServidas: 26.6, llamadasPedidas: 26.6,
  horasDuenoMax: 56.4, mesHorasMax: 1, holguraRegimenH: 5.5,
  capitalEnDolares: 0,
  capitalEnHoras: '56,4 h el mes 1 y 46-55 h/mes sostenidas 24 meses, con 10 h/mes de agencia adentro del tope. La agencia NO se resigna en este plan y no hace falta: sacarla libera 10 h/mes y no cambia una sola fila de caja, porque el cuello dejó de ser el calendario.',
  deDondeSaleLaDiferencia: [
    'El panel decía 441 clientes, US$21.340 de MRR y US$143.861 de caja. Con las MISMAS decisiones de gasto (US$5.800/mes) y solo las correcciones de costo de IA, mortalidad de cobro y base propia, da 402 clientes y US$120.580: −16%. Eso es el error de cálculo.',
    'De US$120.580 a US$69.150 es −43%, y NO es un error: es respetar lo que vale un cliente. US$119.000 de pauta contra US$37.480. Esa parte es una DECISIÓN, no una corrección.',
    'O sea: de los US$74.711 de diferencia, US$23.281 eran cuentas mal hechas y US$51.430 son clientes que el panel compraba por encima de lo que valen.',
  ],
  laConclusionQueCambio: '⚠️ EL CUELLO YA NO ES EL CALENDARIO, ES EL EMBUDO. El panel concluía que el dueño se quedaba sin horas en el mes 11 y por eso reestructuraba el bonus del anual. Con el gate puesto y la pauta capada, se sirven 26,6 de 26,6 llamadas pedidas y sobran 5,5 h/mes: el problema no es que no entren las llamadas, es que el embudo produce 1,3 llamadas calificadas por mes. La palanca del high ticket no es capacidad — es volumen de anuales calificados.',
};

// ── EL PROGRAMA DE US$4.000 ─────────────────────────────────────────────────
// DECIDE: qué se entrega, qué no, y en cuántas horas — que es lo que fija si el
// programa aporta al LTV o lo resta.
//
// ⚠️ UNA sola descomposición, y el TOTAL es la salida, no la entrada. El panel
// tenía dos programas distintos en el mismo documento: «12 llamadas de 1 h, 15 h
// totales» en un lado y «12 sesiones de 45 minutos» en el otro, y las cuatro
// piezas que la segunda vendía (semana 0, pre-reads, entregables, franja de
// acceso) no cabían en las 15 h de la primera.

export type PiezaHt = { que: string; horas: number; comoSaleLaHora: string };

export const HIGH_TICKET = {
  nombre: '12 semanas con Martín',
  precioUsd: 4000, precioOrigen: 'supuesto' as Origen,
  precioQue: '⚠️ Los US$4.000 no están derivados en ningún lado: ni Estrategia.tsx ni modelo.ts los justifican, los dos los toman como input del dueño. Se sostienen por SELECCIÓN, que es lo único que la evidencia respalda (Ashraf, Berry & Shapiro, AER 100(5):2383-2413, 2010, precios asignados al azar: efectos de selección importantes y ninguna evidencia de costo hundido).',
  promesa: 'A las 12 semanas tenés el funnel de adquisición andando y sabés por qué anda, decidido sobre tus propios datos y no sobre teoría.',

  paraQuien: 'Ya adentro de MaKo pagando, con al menos tres meses de datos propios y una fuente conectada (Meta, la landing con el beacon, o el CRM con leads reales). Más los dos calificadores que YA existen en el repo: fase ≥3 (US$10k+/mes, lib/fase-diagnostico.ts) y oferta_ticket ≥ US$1.000 (lib/onboarding.ts:30). Sin diagnóstico completado no califica: fail-closed.',
  noEsPara: 'Fase 1 (US$0-3k/mes), y se dice en la pantalla: el propio producto le dice a ese cliente, textual, «No sumes equipo ni delegues» (FASES[0].noHacer de lib/fase-diagnostico.ts — las fases del negocio del cliente, que no son las FASES_TIEMPO de este archivo). Venderle US$4.000 es el producto diciendo una cosa y el fundador otra, con las dos pantallas abiertas.',

  // ── LA DESCOMPOSICIÓN, con el origen de cada hora ──
  entrega: [
    { que: 'Semana 0 — el diagnóstico escrito ANTES de la primera sesión', horas: 1, comoSaleLaHora: 'MaKo lo genera con lo que ya está en la cuenta (lib/ads-analyst.ts, lib/landing-analyst.ts, lib/vsl-retencion.ts, lib/archivero.ts) por ~US$0,03 de IA. Martín lo corrige y le pone la decisión: 1 h.' },
    { que: '12 sesiones de 45 minutos, una por semana', horas: 9, comoSaleLaHora: '12 × 0,75 h. Duran 45 y no 60 a propósito: el cliente llega con el pre-read leído.' },
    { que: 'El pre-read de cada sesión, escrito por MaKo', horas: 1, comoSaleLaHora: '12 × 5 minutos de revisión de Martín.' },
    { que: 'El entregable escrito de cada sesión, con las tareas cargadas en el plan del cliente', horas: 1, comoSaleLaHora: 'Entra por el camino que el producto ya usa (transcript → reparto de tareas). Martín revisa antes de publicar: 12 × 5 minutos.' },
    { que: 'Franja de acceso entre sesiones — WhatsApp, dos ventanas fijas por semana', horas: 6, comoSaleLaHora: '⚠️ 30 minutos por semana × 12. El panel lo cotizaba en 2 h totales = 5 minutos por ventana, para un cliente de US$4.000: no es enforceable. Éste es el renglón que más se subestima y el que convierte 15 h en 40.' },
    { que: 'Cierre — informe de los 3 meses y plan de los 90 días siguientes', horas: 1, comoSaleLaHora: 'Misma fuente que el diagnóstico de la semana 0, así que la comparación es honesta.' },
  ] as PiezaHt[],
  horasTotales: 19,
  horasTotalesQue: 'La SUMA de los seis renglones, no un número puesto arriba. ASCENSO_PROGRAMAS.unoAUno.horasEntrega dice 15 y ese 15 solo cierra si el acceso se cotiza en 10 min/semana. Se publica 19 y se publica la sensibilidad.',

  noIncluye: [
    'Llamadas de 60 minutos. Son de 45, y es la reducción de alcance explícita: 12×60 con preparación e informe a mano son 24 h, y ahí el break-even de P₁ sube de 6,49% a 9,60%.',
    'Ejecución. No se escriben tus anuncios, no se edita tu VSL, no se opera tu cuenta. Si se ejecuta, esto es una agencia con otro nombre y las 19 h se van a 40 — y a 40 h M₁ es NEGATIVO (−US$558,67).',
    'Tu gasto en ads. El programa decide dónde y cuánto; la plata la ponés vos.',
    'La suscripción a MaKo. Son dos rieles y dos cobros distintos. Si se regalan los 3 meses son ~US$141 de descuento encubierto que hoy no está en ningún modelo.',
    'Soporte del software: va por el canal de tu plan, o la franja se come sola con capturas de pantalla.',
    'Sesiones acumulables. Se reprograman dos veces en las 12 semanas; la que no se toma se pierde. Sin esa cláusula el programa de 3 meses dura 6 y las horas se duplican sin que el precio se mueva.',
    'Garantía de resultado. Lo que hay es una ventana de devolución acotada y escrita.',
  ],

  // ⚠️ El temario NO puede ser el de la llamada gratis. Los seis ejes que el
  // panel proponía viven en Estrategia.tsx:99-106, en una constante llamada
  // ANALISIS cuyo comentario dice textual «Qué se analiza en la llamada» — y el
  // guion promete «el análisis te lo llevás por escrito digas lo que digas».
  // Venderle 12 conversaciones sobre lo que ya se llevó gratis, declarando que
  // no se ejecuta nada, es descubrir eso en la sesión 1, que es justo donde está
  // la garantía del 100%.
  loQueLaLlamadaGratisNoDa: 'EL ARRASTRE. La llamada entrega el diagnóstico de los seis ejes; el programa entrega 12 semanas de revisar lo EJECUTADO contra los números de la semana anterior. La promesa se escribe así: «No te digo qué hacer —eso ya te lo dije gratis y por escrito—. Te acompaño 12 semanas mientras lo hacés, y lo medimos.»',

  garantia: {
    que: 'Garantía de la primera sesión: con el diagnóstico de la semana 0 ya entregado por escrito, si después de la sesión 1 decís que no es para vos se devuelve el 100%, sin preguntas y sin llamada de retención. A partir de la sesión 2 no hay devolución, y se dice ANTES de cobrar.',
    porQueNo30: 'La evidencia que respalda la ventana larga (Janakiraman, Syrdal & Freling, Journal of Retailing 92(2):226-235, 2016, meta-análisis de ~21 papers) mide productos donde la ventana no cuesta entrega. Acá cuesta: a los 60 días ya entregaste 8 de 12 sesiones. Se declara que se está apartando de la regla del SaaS y por qué.',
    reembolsoSupuesto: 0.10,
    bloqueante: '🔧 /reembolsos no existe, y es el único lugar donde el cliente lee qué pasa si se siente estafado. Se escribe antes del primer cobro. Además el merchant of record lo pide para aprobar la cuenta (MES_0).',
  },
  cobranza: '50% al firmar, 50% al día 30. NUNCA 3 cuotas en 3 meses: la última caería cuando ya entregaste casi todo. ⚠️ El panel usaba 60/40 en la proyección y 50/50 en la especificación, en el mismo documento.',
  rail: 'Stripe propio (FEE_RAIL_PROPIO, 4,4% + US$0,30). NUNCA Paddle: su AUP prohíbe textual «coaching». Por eso su botón no puede ir al mismo checkout que los planes.',
  cupoVivos: 3, cupoQue: 'Publicado desde el día uno. Nacer con tope es gratis; sacárselo después a clientes que ya lo tenían es la conversación que no se gana. En este plan el cupo nunca se toca (0,75 programas vivos en el pico) — el tope real lo pone el embudo, no el calendario.',

  economia: {
    cajaUsd: 3441.33, cajaComo: '(4.000 − 176,30 de fee) × 0,90 de reembolso — exactamente ASCENSO_PROGRAMAS.unoAUno.cajaUsd',
    capacidadUsd: 1541.33, usdPorHora: 181.12,
    breakEvenP1: 0.0649,
    vsPro: 'US$181,12 de caja por hora del dueño, 1,8× la hora de US$100 que el modelo le asigna. Un programa entregado equivale a 95 meses de contribución de un Pro (US$36,30/mes) o a 10,9 clientes Pro de por vida. ⚠️ Pero la comparación honesta no es esa: los US$3.441 entran una vez y las 19 h no vuelven, mientras que 19 h puestas en el producto sirven a todos los clientes a la vez. El 1a1 es el negocio mientras el SaaS es chico, y deja de serlo exactamente cuando el SaaS empieza a funcionar.',
    enEstePlan: '4,85 programas y US$16.188 de caja en 24 meses — el 23% de la caja total. El panel proyectaba 13 programas y US$44.030 con el mismo producto: la diferencia es que allá la llamada se le servía a todo comprador anual sin gate y con un embudo 2,7× más grande comprado por encima del techo.',
  },
  origen: 'supuesto' as Origen,
};

// ── EL SWITCH MENSUAL / ANUAL ───────────────────────────────────────────────
// DECIDE: qué se ve en /precios, que hoy no existe (SALVEDADES id 'sin-cobro').
// Esto es una especificación, no una implementación.

export type PlanAnual = {
  plan: Columna; mensualUsd: number; anualUsd: number | null;
  equivalenteMesUsd: number; ahorroUsd: number; descuento: number;
  extraDelAnual: string;
};

export const OFERTA_ANUAL = {
  switch: {
    donde: 'Entre el H1 y las cards, centrado. Es el ÚNICO control de la página: no se repite adentro de las cards y NO envuelve al 1a1 —ese va en banda aparte al pie, con «Aplicar», porque su rail de cobro es otro.',
    rotulo: '[ Mensual ]   [ Anual · 2 meses gratis ]',
    bajada: 'Pagás 10 meses y usás 12. En todos los planes.',
    porQueGratis: '«2 meses gratis» le gana a «Ahorrá 16,7%» por la palabra gratis (Shampanier, Mazar & Ariely, Marketing Science 26(6):742-757, 2007) y porque es el encuadre de los tres comparables de la banda: Systeme.io, ElevenLabs y Ahrefs. Sin «hasta»: los tres planes van al mismo 16,7%, así que decirlo sin hedge es gratis y compra credibilidad.',
    default: 'Anual preseleccionado. ⚠️ ORIGEN SUPUESTO y hay que decirlo: 8 de 16 páginas medidas lo preseleccionan, pero NO existe evidencia experimental pública de que suba la conversión. Es convención observada, no experimento.',
    condicionInnegociable: 'El mensual queda visible a un clic y NUNCA escondido. No es solo el plan barato: es el plan B del COBRO. Con aprobación cross-border en LATAM 30-50% más baja que la doméstica (EBANX Beyond Borders 2025), el anual puede convertir perfecto en la página y morir en el emisor.',
    muestra: 'LOS DOS en el mismo bloque: número grande = equivalente mensual (US$39) con el mensual tachado (US$47), y debajo en tinta normal «Se cobra una vez al año: US$470. Te ahorrás US$94». El desempate no lo da el mercado (GoHighLevel muestra el total, ClickFunnels el equivalente): lo da el cobro. A un monotributista argentino le aparecen ~US$710 con el gross-up del 51%, y esconder el cargo real es cómo se produce un rechazo de emisor que el tablero después lee como «bajó la conversión».',
  },

  planes: [
    { plan: 'free', mensualUsd: 0, anualUsd: null, equivalenteMesUsd: 0, ahorroUsd: 0, descuento: 0,
      extraDelAnual: 'Sin anual. La card no cambia con el switch salvo una línea gris «Sin plan anual», para que el toggle no parezca roto cuando tres cards se mueven y una no. ⚠️ Y no se publica hasta el MES 10: antes de la key de plataforma un Free sin key propia no es «un usuario que no gasta», es una llamada que EXPLOTA (lib/credenciales.ts:126-132).' },

    { plan: 'pro', mensualUsd: 47, anualUsd: 470, equivalenteMesUsd: 39.17, ahorroUsd: 94, descuento: 0.167,
      extraDelAnual: 'SE SOSTIENE EL 16,7%, y el límite está derivado: cada punto de descuento cuesta US$5,31 de contribución y US$2,95 de lo que podés pagar por un cliente. A 19,5% EXACTO lo que se puede pagar en medios, sobre la mezcla de planes, toca US$124,22 = el CAC del carrito, y el único canal escalable deja de cerrar. ⚠️ Y el descuento y la garantía salen del MISMO lugar: cada punto de reembolso del anual cuesta US$0,69 de ese máximo mezclado, así que al 16,7% el presupuesto de reembolso es 3,6%; si el reembolso resulta 10%, el descuento sostenible baja a 11,7% y el 16,7% queda 5,0 puntos por encima del límite. Por eso la respuesta a «hacelo más atractivo» es AGREGAR cosas, no bajar el precio. QUÉ SE AGREGA: (1) 45 minutos 1 a 1 con el análisis ya escrito, solo si el negocio califica —cuesta US$30 por comprador anual con el gate contra US$75 sin él—; (2) precio congelado 12 meses, que cuesta US$0 hoy porque la lista solo puede subir; (3) rollover del cupo no usado hasta un mes, exposición máxima US$2,08 al año; (4) 30 días de devolución. QUÉ NO: cupo de MaKo Tokens adelantado, ni acá ni en ningún plan.' },

    { plan: 'growth', mensualUsd: 97, anualUsd: 970, equivalenteMesUsd: 80.83, ahorroUsd: 194, descuento: 0.167,
      extraDelAnual: '⚠️ ES UNA CORRECCIÓN DE CÓDIGO VIVO: modelo.ts:597 dice hoy US$1.067 con «1 mes gratis · 8,3%». Ese 8,3% queda por debajo del mínimo medido en 16 páginas reales (beehiiv, ~12%) y crea una escalera perversa: el plan que más conviene retener (vida 15,5 meses contra 8,7 del Pro) tiene la peor oferta anual, con las dos cards pegadas. Control de cordura externo: US$970/año es exactamente lo que cobra GoHighLevel por su Starter de US$97/mes, y ClickFunnels cobra US$81 sobre US$97 = US$972/año. Dos comparables independientes aterrizan en el mismo número. LA CARD VA CON PRECIO ANUNCIADO Y LISTA DE ESPERA, SIN COBRAR, hasta el mes 13: prepagar 12 meses contra un ComingSoon de 8 líneas es un reembolso con fecha.' },

    { plan: 'agencia', mensualUsd: 297, anualUsd: 2970, equivalenteMesUsd: 247.50, ahorroUsd: 594, descuento: 0.167,
      extraDelAnual: 'No se le agrega nada y no lleva botón de compra: hoy no existe como Plan[\'id\'] y su cupo es un `?? 150000` hardcodeado en Pricing.tsx:485. Va con «Hablemos». ⚠️ Nota de voz, no de precio: «Agencia» es el único nombre de plan en español contra la regla de nombres en inglés del proyecto. Conviene resolverlo antes de que el nombre esté en un Price de Paddle y en la factura de alguien.' },
  ] as PlanAnual[],

  /** La regla que ordena la página en una frase. */
  laRegla: 'En todos los planes, el anual son 10 meses.',

  copyClave: [
    { donde: 'Card del Pro, estado ANUAL — el renglón del bonus, corregido', texto: 'Si tu negocio califica —te lo decimos en el onboarding— sumás 45 minutos conmigo, 1 a 1, con el análisis de tu negocio ya escrito. No gastamos la llamada en ponernos al día: la usamos para decidir qué hacés primero. El análisis te lo llevás por escrito.' },
    { donde: 'Card del Pro, estado MENSUAL', texto: 'Se cobra todos los meses. Cancelás cuando quieras. Con el anual son US$39/mes. Ver el anual.' },
    { donde: 'Checkout, cuando el emisor rechaza el cargo anual — en la MISMA pantalla', texto: 'Tu banco no aprobó el cargo de US$470. Pasa seguido con montos grandes en dólares: no es tu tarjeta, es el emisor. Probá con otra tarjeta, o arrancá con el mensual a US$47 y pasate al anual cuando quieras — te descontamos lo que ya pagaste.' },
    { donde: 'ANTI-COPY — lo que NO se escribe en ningún lado', texto: '· «Dos horas conmigo»: se entregan 45 minutos y el modelo compra 1,0 h de calendario. · «Cancelás cuando quieras» en la card del anual: es falso en un prepago y se cobra en contracargos. · «Ahorrá hasta un 16,7%»: el «hasta» obliga a buscar cuál plan lo tiene. · «Cupo extra de MaKo Tokens con el anual»: es un pasivo de costo variable prepagado 12 meses sobre la única línea que no es marginal-cero. · «Te queda todo ilimitado»: se congela el precio, nunca el alcance.' },
  ],

  metricasDesdeLaPrimeraCohorte: [
    'Clics al lado «Anual» y checkouts INICIADOS en anual',
    'TASA DE APROBACIÓN DEL COBRO, anual vs mensual — sin ella un rechazo de emisor se lee como «bajó la conversión» y se termina bajando un precio que no era el problema',
    'TASA DE REEMBOLSO del anual a 30 días — el presupuesto es 3,6%, y es lo que decide si el 16,7% era sostenible',
    'Las 30 llamadas etiquetadas con su resultado — es lo único que reemplaza el supuesto de P₁, y se completan en el mes 12',
  ],
  origen: 'supuesto' as Origen,
};

// ── LOS TRES TRAMOS DE CAPACIDAD ────────────────────────────────────────────
// DECIDE: cuándo el dueño deja de poder atender solo, y qué se hace.
// El dueño pidió textual modelar «meter un closer». Está modelado, con el número
// que lo dispara — y el veredicto es que no se contrata, pero por una razón
// distinta a la que el panel daba.

export type Tramo = {
  id: 'a' | 'b' | 'c1' | 'c2';
  nombre: string; mesesEnQueRige: string; techo: string;
  disparadorDelSalto: string; veredicto: string;
};

export const TRAMOS_CAPACIDAD: Tramo[] = [
  { id: 'a', nombre: 'El dueño solo, llamada a TODO comprador', mesesEnQueRige: 'ninguno',
    techo: 'El mes 1 pide 11,1 compradores × 0,75 de show × 1,0 h = 8,3 h. Sí entra en el calendario.',
    disparadorDelSalto: 'No lo descarta la capacidad: lo descarta la economía. Regalarle 1,0 h (US$100) a un comprador Pro MENSUAL son 2,8 meses de su contribución (US$36,30), y se puede ir en el mes 3 — que es exactamente el modo de falla que embudo:75 ya tenía escrito.',
    veredicto: 'NO SE HACE NUNCA. La llamada es del anual y de los que califican, desde el día uno. ⚠️ El panel también lo descartaba, pero por el motivo equivocado (decía que el calendario no daba).' },

  { id: 'b', nombre: 'El dueño con el gate: solo anual Y fase ≥3 Y ticket ≥ US$1.000', mesesEnQueRige: 'meses 1 a 24 — los veinticuatro',
    techo: 'Las horas libres tras soporte, producto, venta, entrega y agencia: 5 a 15 h/mes, o sea 5 a 15 llamadas. El embudo pide 1,3.',
    disparadorDelSalto: 'No se dispara. Déficit de llamadas en los 24 meses: CERO.',
    veredicto: 'RIGE TODO EL PLAN. Y el filtro no es un cuestionario: es el PRECIO más dos campos que ya existen en la base. Pagar US$470 por adelantado ES la calificación (Ashraf/Berry/Shapiro, AER 100(5) 2010: el precio alto selecciona, no motiva).' },

  { id: 'c1', nombre: 'Onboarding grupal en vez de 1a1', mesesEnQueRige: 'ninguno',
    techo: '⚠️ 1,0 h POR CABEZA, no 0,125. COHORTE_GRUPAL dice textual `horasPorCabeza: 1.0` sobre 8 sesiones de 1,5 h para 12 personas. El panel dividió UNA sesión por 12 y le puso la etiqueta de la constante que describe las ocho: un error de 8× sobre la única palanca que decía que «multiplica la capacidad por 10 y cuesta cero».',
    disparadorDelSalto: 'Cinco llamadas del bonus sin servir por mes, sostenidas 3 meses. Máximo del plan: cero.',
    veredicto: 'NO SE ACTIVA, y encima a 1,0 h/cabeza casi no ahorra nada contra la llamada gateada de 1,0 h. Además cambiarle el bonus a cohortes que ya prepagaron 12 meses, justo antes de que se mida la renovación, es la peor forma de descubrir cuánto vale la promesa.' },

  { id: 'c2', nombre: 'Closer contratado', mesesEnQueRige: 'ninguno',
    techo: 'Fijo US$2.000/mes + comisión 10-20% sobre US$4.000, con rampa de 2-3 meses al 50% de la tasa del fundador y ~75% en régimen (el fundador cierra su propio programa; un tercero no).',
    disparadorDelSalto: '4,60 llamadas CALIFICADAS sin servir por mes, sostenidas 3 meses. Sale de US$2.000 de fijo ÷ US$435,20 de caja por llamada servida por el closer (0,20 de cierre × 0,75 de haircut × US$2.901,33 netos con 15% de comisión). ⚠️ El panel publicaba 4,84 con una división que usaba P₁ = 12% (el optimista) mientras el resto del documento corría a 8%, y no cargaba la comisión — embudo:381 ya la cotiza.',
    veredicto: 'NO SE CONTRATA en 24 meses, y la razón NO es la que decía el panel. No es que el calendario alcance a último momento: es que el embudo produce 1,3 llamadas calificadas por mes contra un disparador de 4,60. El día que el embudo triplique, el closer entra — y el prerrequisito (30 llamadas propias etiquetadas) se cumple en el mes 12, así que el dato va a estar.' },
];

// ── LO QUE SIGUE SIENDO DECISIÓN DEL DUEÑO ──────────────────────────────────
// Ordenadas por cuánto mueven el resultado. Ninguna se puede contestar con más
// análisis: las cinco necesitan que él diga un número.

export const PREGUNTAS_ABIERTAS = [
  { n: 1, pregunta: '¿Payback o 3:1?', mueve: 'US$18.370 de caja y 56 clientes al mes 24, y el presupuesto de pauta de US$1.000 a US$1.940/mes.',
    porQue: 'UNIT.proAnual ya decía que las dos reglas se separan y que «es la decisión más grande de la tabla», y la dejó abierta. Payback protege la CAJA (y el dueño no tiene capital); 3:1 protege el VALOR. Comprar a payback es comprar a ~1,7:1, el cuartil que destruye valor con cada cliente. Este plan corre bajo PAYBACK porque no hay capital, y eso está declarado, no elegido en silencio.' },
  { n: 2, pregunta: '¿Cuánto vale tu hora, de verdad?', mueve: 'El break-even del programa de US$4.000 es 2,0% a US$50/h, 6,5% a US$100/h y 25,4% a US$150/h — y arriba de US$181,12/h el programa NO CIERRA a ninguna tasa, porque M₁ se vuelve negativo (3.441,33 ÷ 19 h). La llamada del bonus muere antes: deja de cerrar arriba de US$143,39/h y ahí hay que sacarla de la card.',
    porQue: 'VALOR_HORA_DUENO dice textual que los US$100 «los puso el analista, NO el dueño». Es la perilla más no-lineal de todo el modelo y la única que no se puede estimar desde afuera.' },
  { n: 3, pregunta: '¿«30 usuarios» eran 30 pagos o 30 registrados?', mueve: 'Si son pagos, faltan 19 y no se compran a ningún precio que respete ninguna regla. Si son registrados, sobran: el mes 1 produce 210 y hoy se pierden 199 porque no existe el alta pública.',
    porQue: 'Es la pregunta más barata de todo el documento y cambia qué se construye primero. Si son registrados, el paso 8 de ORDEN_DE_TRABAJO se adelanta al mes 1 y vale más que los US$1.000 de pauta.' },
  { n: 4, pregunta: '¿El programa de US$4.000 arrastra o solo diagnostica?', mueve: 'Si el temario son los seis ejes de Estrategia.tsx, es lo mismo que el cliente ya se llevó gratis y por escrito — y lo descubre en la sesión 1, que es donde está la garantía del 100%. El supuesto de 10% de reembolso pasa a ser un piso optimista, y ese supuesto da vuelta el signo del ascenso.',
    porQue: 'La constante de la que sale el temario se llama ANALISIS y su comentario dice «Qué se analiza en la llamada». La diferencia no puede ser la palabra «cómo»: tiene que ser el arrastre de 12 semanas.' },
  { n: 5, pregunta: '¿Cuántas horas por mes te llevan hoy Mauricio, Leandro y Leila?', mueve: 'Está declarada en 10 h/mes y con eso el plan cierra con holgura. A 30 h/mes el mes 1 se va a 76 h y el plan no arranca.',
    porQue: 'CAPITAL_NECESARIO.agencia dice textual que el modelo las declara en CERO «y eso es falso». Acá se declaran en 10 y se puede sostener, pero sigue siendo el único número del modelo que se cierra con una pregunta de treinta segundos y sigue sin contestar.' },
];

// ── EL MODELO DE TIEMPO ─────────────────────────────────────────────────────
// DECIDE: cuántos clientes de cada canal entran en un mes, y cuántos programas
// de high ticket se pueden entregar.
//
// El dueño trabaja ~12 h de lunes a sábado y ~6 el domingo. Las fases NO cambian
// el total: lo REPARTEN. Y el reparto sale de su regla, textual: «la parte de
// adquisición es la importante, no debo sacrificar nunca ese tiempo. Entonces
// puedo tener un tope de clientes high ticket y un tope de tiempo dedicado a
// debugear e implementar».
//
// ⚠️ SUPUESTO GRANDE Y DECLARADO: 12 h sentado no son 12 h efectivas, y hoy
// nadie lo mide. Todo esto se apoya en un factor de efectividad desconocido.

export const HORAS_MES = 338;
export const HORAS_MES_ORIGEN: Origen = 'supuesto';
export const HORAS_MES_COMO = '12 h de lunes a sábado + 6 h el domingo, × 4,33 semanas. Dicho por el dueño.';

/**
 * ⚠️ Se llama `FaseTiempo` y no `Fase` porque en este repo `Fase`/`FASES` ya son
 * OTRAS dos cosas: las fases 1-5 del negocio del cliente (`lib/fase-diagnostico.ts`)
 * y las de los gráficos (`lib/mako-fases.ts`). Estas reparten las horas del mes del
 * dueño y no tienen nada que ver con aquellas.
 */
export type FaseTiempo = {
  id: 'desarrollo' | 'adquisicion' | 'regimen';
  nombre: string;
  mes: string;
  /** Horas protegidas para conseguir clientes. NO se sacrifican. */
  pisoAdquisicion: number;
  topeDebug: number;
  topeAgencia: number;
};

export const FASES_TIEMPO: FaseTiempo[] = [
  { id: 'desarrollo', nombre: 'Desarrollo', mes: 'agosto',
    pisoAdquisicion: 0, topeDebug: 0, topeAgencia: 10 },
  { id: 'adquisicion', nombre: 'Adquisición', mes: 'septiembre',
    pisoAdquisicion: 328, topeDebug: 0, topeAgencia: 10 },
  { id: 'regimen', nombre: 'Adquisición y entrega', mes: 'octubre en adelante',
    pisoAdquisicion: 169, topeDebug: 60, topeAgencia: 10 },
];

/** Lo que queda después del piso y los topes. De acá sale el high ticket. */
export function horasLibres(f: FaseTiempo): number {
  return HORAS_MES - f.pisoAdquisicion - f.topeDebug - f.topeAgencia;
}

/**
 * El tope de clientes de high ticket. ⚠️ Es SALIDA, no entrada: el dueño lo dijo
 * así — «la cantidad de clientes lo puedes sacar de la promesa de horas que les
 * doy». En desarrollo y en adquisición da 0 a propósito.
 */
export function topeClientes1a1(f: FaseTiempo, horasPorClienteMes: number): number {
  if (f.id !== 'regimen') return 0;
  return Math.floor(horasLibres(f) / horasPorClienteMes);
}

// ── LA MATRIZ: QUÉ CANAL ENTRA EN QUÉ FASE ──────────────────────────────────
// DECIDE: con qué canales se puede trabajar cada mes, y hasta cuántos clientes
// da cada uno antes de quedarse sin lo que lo limita.

/**
 * Qué features de MaKo están vivas HOY. Alimenta `horasDe`: sin la feature, el
 * canal cuesta las horas «a mano».
 * ⚠️ Se actualiza a mano. Si queda vieja, el modelo subestima las horas — y como
 * las horas son la moneda escasa, subestimarlas es el error caro.
 */
export const FEATURES_CONSTRUIDAS: string[] = [];
export const FEATURES_CONSTRUIDAS_ORIGEN: Origen = 'supuesto';

/**
 * Las horas reales de un canal según lo que esté construido.
 *
 * El dueño: «pretendo utilizar MaKo para mi propio negocio, para vender MaKo… no
 * es lo mismo el tiempo que le voy a dedicar a la prospección cuando literal hay
 * un chatbot». Por eso terminar una feature no es solo producto: es capacidad de
 * venta del mes siguiente.
 */
export function horasDe(c: CanalCac, construidas: string[]): number {
  if (!c.horas.loHabilita) return c.horas.aMano;
  return construidas.includes(c.horas.loHabilita) ? c.horas.conMaKo : c.horas.aMano;
}

export type Veredicto = {
  entra: boolean;
  clientesMax: number;
  /** En castellano, para pintar tal cual. `null` si entra. */
  porQueNo: string | null;
};

/**
 * ⚠️ LAS DOS MONEDAS SE CHEQUEAN POR SEPARADO Y NUNCA SE SUMAN.
 * `limitePlata` se compara SOLO contra `plataPorCliente`; las horas se comparan
 * SOLO contra el piso de adquisición de la fase.
 */
export function entraEn(c: CanalCac, f: FaseTiempo, construidas: string[], limitePlata: number): Veredicto {
  const h = horasDe(c, construidas);
  const porHoras = h <= 0 ? Infinity : Math.floor(f.pisoAdquisicion / h);

  if (c.plataPorCliente > limitePlata) {
    return { entra: false, clientesMax: 0,
      porQueNo: `en plata cuesta ${c.plataPorCliente.toFixed(2)} y podés pagar hasta ${limitePlata.toFixed(2)}` };
  }
  if (porHoras < 1) {
    return { entra: false, clientesMax: 0,
      porQueNo: `te come ${h} horas por cliente y en ${f.mes} tenés ${f.pisoAdquisicion} para conseguir clientes` };
  }
  return { entra: true, clientesMax: porHoras === Infinity ? 0 : porHoras, porQueNo: null };
}
