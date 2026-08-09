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
  /** Cupo mensual en MaKo Tokens. 1.000 MT = US$1 de costo real de IA. */
  cupoMt: number;
  /** Qué incluye, para la tabla de la landing. */
  incluye: string[];
  noIncluye: string[];
};

/** 1.000 MaKo Tokens = US$1 de costo de IA. La unidad es COSTO, no tokens de
 *  modelo: así se puede cambiar de proveedor sin rehacer los planes. */
export const MT_POR_USD = 1000;

export const PLANES: Plan[] = [
  {
    id: 'free', label: 'Free', precioUsd: 0, cupoMt: 1500,
    incluye: ['El plan y el Perro Guardián', 'CRM y funnel', 'Un workspace, un usuario', 'MaKo por WhatsApp, con cupo'],
    noIncluye: ['Integraciones que disparan IA sola (Fathom, Meta, Evolution)', 'Análisis de llamadas', 'Generación de creativos', 'BYOK'],
  },
  {
    id: 'pro', label: 'Pro', precioUsd: 47, cupoMt: 12000,
    incluye: ['Todo lo del Free', 'Fathom: reuniones → tareas', 'Closing Analyst', 'Ads Analyst', 'Hasta 3 usuarios'],
    noIncluye: ['Generación de video', 'BYOK', 'Usuarios ilimitados'],
  },
  {
    id: 'growth', label: 'Growth', precioUsd: 97, cupoMt: 25000,
    incluye: ['Todo lo del Pro', 'Fábrica de creativos (imagen)', 'Nutrición automática', 'Usuarios ilimitados', 'BYOK en el plan anual'],
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
    que: 'CAC = costo_conversación / (conversación→registro × free→pago). Con US$1,50 por conversación (banda B2B en México/Colombia reconstruida desde el CPM) y el caso base 30%×6%, el canal de WhatsApp da US$83: entra en el techo laxo del Pro (US$104), no en el estricto (US$53). El carrito frío rompe el techo del Pro en casi toda su banda y entra cómodo en el del Growth. Decisión: vender Growth o anual en el carrito y rutear el Pro mensual a WhatsApp. Y el cobro anual mueve el techo de US$104 a más de US$700.',
    fuente: 'Cálculo propio sobre CPM/CPC por país (adamigo, 6/8/2026) + free→pago de ChartMogul (n=200, ene 2026)',
  },
  {
    id: 'cobro-latam', titulo: 'El impuesto invisible: en LATAM se pierde ~45% del checkout por cobro, no por copy',
    numero: 'Aprobación cross-border 65-75% vs 85-92% de rieles locales · solo ~28% tiene tarjeta de crédito',
    que: 'Pasar de 70% a 88% de aprobación baja el CAC del carrito de US$119 a US$95 — 20% menos sin tocar el anuncio. Y pega dos veces: el rebill también falla, lo que sube el churn efectivo de ~5% a 8-10% mensual, corta la vida útil de ~20 meses a 10-12 y con ella el techo de CAC. El US$104 del Pro sería más bien US$55-70 mientras se cobre solo con tarjeta internacional. Se lee como «los clientes se van», nunca como «el cobro está roto».',
    fuente: 'dodopayments / Allied Global / crea.la sobre pagos en LATAM + churn SMB self-serve (Vena/Recurly Q1-Q2 2025)',
  },
  {
    id: 'techo-cac', titulo: 'El techo de CAC que tolera cada plan',
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
  { id: 'opus', modelo: 'Claude Opus 4.8', inUsd: 15, outUsd: 75, para: 'Solo la Retro: su salida gobierna decisiones de plata', origen: 'publicado' as Origen },
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
  { id: 'offer', familia: 'Analyze', label: 'Offer Analyst', usd: 0.0076 },
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
  { id: 'retro', grupo: 'Análisis', label: 'Retro / experimentos del negocio', costoUsd: 0.29661, mt: 710, origen: 'medido', n: 47 },
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

/** El riesgo que queda después de tarifar bien, en una frase. */
export const RIESGO_QUE_QUEDA =
  'El «mes malo» del Growth (todo al p90) deja 28,5% de margen, y lo empuja UNA sola operación: la Retro, que es la única que sigue en Opus y cuya salida va de 1.487 tokens de mediana a 11.288 en el p90. El cupo la acota, pero conviene sumarle un límite de FRECUENCIA propio (corre pocas veces al mes por diseño) en vez de confiar solo en los tokens.';

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
