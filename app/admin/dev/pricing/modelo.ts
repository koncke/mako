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

export const ECONOMIA: Dato[] = [
  {
    id: 'grr-banda', titulo: 'El benchmark que aplica no es «SaaS PyME», es «AI-native» — y el Pro cae en la peor banda',
    numero: '<US$50/mes → GRR 23% anual · US$50-249 → 45% · >US$250 → 70%',
    que: 'ChartMogul segmentó la retención de 200 empresas AI-native por precio de lista y el resultado es monótono: cuanto más barato, peor retiene. Los productos de más de US$250/mes retienen casi como el SaaS tradicional; los de menos de US$50 se desploman. El Pro a US$47 está del lado equivocado del corte, por dos dólares.',
    fuente: 'ChartMogul, «The SaaS Retention Report: The AI churn wave» (3.500 empresas, 200 AI-native, datos 2025)',
  },
  {
    id: 'llamada', titulo: 'Una reunión de venta cuesta más que un año de Pro',
    numero: 'US$666-900 por reunión agendada · ACV mínimo para inside sales: US$3.000',
    que: 'Un SDR cargado sale ~US$10.000/mes y agenda 10-15 reuniones. MaKo tiene un ACV de US$564 (Pro) a US$1.164 (Growth): entre 2,6× y 5,3× por debajo del piso que la industria considera necesario para sostener venta asistida. A este precio el canal tiene que ser self-serve o no cierra.',
    fuente: 'Tomasz Tunguz, «The Smallest ACV to Justify an Inside Sales Team» + benchmarks de lead-gen B2B',
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

/** Un número que circula por todos lados y NO hay que usar. */
export const DATO_FALSO = {
  numero: 'US$702 self-serve vs US$11.400 sales-led',
  por_que: 'Aparece en al menos ocho sitios de 2026 con la misma redacción sobre «una brecha de 16×, la más ancha de la historia». Rastreada la cadena de citas, todas terminan en un blog sin estudio primario detrás. No tiene muestra, ni metodología, ni fuente. No usarlo en ninguna proyección.',
};

/** El dato que ordena a todos los demás. */
export const EL_ACCIDENTE =
  'Hoy nada de esto cuesta plata en un cliente, y no es por una cuota: `credWs` solo cae al env si el workspace es el 1, así que un cliente sin key propia no gasta — la llamada EXPLOTA. El modelo de MaKo Tokens implica servirle la key de la plataforma a todos, y en ese momento los seis caminos de arriba empiezan a facturar de golpe. Gatear va ANTES de ese cambio, no después.';
