// =============================================================================
// prompt-defaults — defaults de prompts cortos que no tienen otro "hogar" natural
// =============================================================================
// Módulo liviano (sin imports pesados): lo comparten el registro de prompts
// (lib/prompt-registry.ts) y los call sites (rutas /api, lib/mako-context).
// Los prompts grandes (closing, ads-analyst, validador, etc.) viven en su
// propio archivo y se exportan desde ahí; estos son los fragmentos chicos.
// =============================================================================

// ── Chat de gráficos (app/api/chart-insights/route.ts) ───────────────────────
export const CHART_PROMPT_ANALISIS_DEFAULT =
  'Mirá el gráfico y tirame SOLO lo más importante: el insight que más impacta, en 2-4 líneas, con tu voz. Nada de resumen completo ni listar todo.';

export const CHART_PROMPT_SALUDO_DEFAULT =
  'Presentate en 1-2 líneas como MaKo y decime en qué me podés ayudar con los datos del negocio. Breve, con tu voz.';

export const CHART_TITULO_DEFAULT =
  'Devolvé SOLO un título corto (3 a 6 palabras, en español, sin comillas ni punto final) que resuma de qué trata esto. Nada más que el título.';

// ── Encuadres del system prompt de MaKo (lib/mako-context.ts) ────────────────
export const MAKO_CTX_GENERAL_DEFAULT =
  'CONTEXTO: chat general del dashboard del negocio de Martín. Ayudá con lo que pregunte; si te pega datos, analizalos.';

// {{titulo}} = nombre del gráfico · {{contexto}} = datos del gráfico (recortados)
export const MAKO_CTX_CHART_DEFAULT =
  'CONTEXTO: estás mirando el gráfico "{{titulo}}" del PROPIO negocio de Martín. Ya tenés los datos abajo, analizá directo.\n\nDATOS DEL GRÁFICO:\n{{contexto}}';

export const MAKO_CTX_WHATSAPP_DEFAULT =
  'SOS CONSULTOR DE SECUENCIAS Y PLANTILLAS DE WHATSAPP. Cuando Martín te proponga una secuencia o un mensaje, evaluá si Meta lo aprobaría (citá la regla), sugerí mejoras concretas y pensá el timing/copy en función del funnel. Sé directo y accionable.';

// ── Extracción de un contrato: plan de pagos + Deal Details (app/api/extract-contract)
export const CONTRACT_EXTRACT_DEFAULT =
  'Eres un asistente que lee un contrato de servicios profesionales y extrae el PLAN DE PAGOS y los DATOS DEL DEAL. Lee el documento y devuelve SOLO JSON con esta forma exacta: {"total_usd": number|null, "duracion_meses": number|null, "fecha_cierre": "dd/mm/aaaa"|null, "fecha_inicio": "dd/mm/aaaa"|null, "cuotas": [{"monto": number, "fecha": "dd/mm/aaaa"}], "empresa": string|null, "fiscal": {"razon": string|null, "id_fiscal": string|null, "domicilio": string|null, "correo": string|null}, "servicio": {"que_es": string|null, "fecha_inicio": "aaaa-mm-dd"|null, "fecha_termino": "aaaa-mm-dd"|null, "duracion": string|null, "frecuencia": string|null, "modalidad": string|null, "sesiones": string|null}, "promesa": {"resultado": string|null, "garantia": string|null}, "obligaciones": {"cliente": string[], "prestador": string[]}, "nota": string|null}. '
  + 'PLAN DE PAGOS: total_usd = monto total del plan/contrato en USD (solo el número); duracion_meses = duración del servicio en meses; fecha_cierre = fecha de firma o cierre del contrato; fecha_inicio = fecha de inicio del servicio; cuotas = cada pago previsto (incluye el pago inicial si lo hay) con su monto en USD y su fecha. Estas 3 fechas del plan van en dd/mm/aaaa. '
  + 'DATOS DEL DEAL: empresa = nombre de la empresa del cliente (la parte que contrata). fiscal = datos de facturación del CLIENTE: razon = razón social o nombre completo; id_fiscal = identificación fiscal (RFC, CUIT, NIT, EIN… según país); domicilio = domicilio fiscal en una línea; correo = correo de facturación. servicio: que_es = qué se entrega o instala, en UNA frase simple; fecha_inicio y fecha_termino del servicio en aaaa-mm-dd; duracion = ej. "16 semanas"; frecuencia = ej. "Semanal"; modalidad = ej. "Videoconferencia" o "Presencial"; sesiones = cantidad de sesiones, ej. "16 aprox.". promesa: resultado = el resultado prometido al cliente en 1-2 frases; garantia = la garantía ofrecida en 1-2 frases. obligaciones: cliente y prestador = listas de 3 a 6 compromisos cada una, frases cortas de hasta 10 palabras. '
  + 'ESTILO: escribe todo en español, en lenguaje simple y directo, como se lo explicarías al dueño del negocio. NO copies cláusulas legales textuales ni uses jerga legal; resume la idea. '
  + 'MONEDA: todos los montos van en USD. Si el contrato está en otra moneda, convierte con un tipo de cambio aproximado actual e indica en "nota" qué tipo de cambio usaste (ej. "Montos convertidos de MXN a USD a ~17 MXN/USD"). Si ya está en USD, nota = null. '
  + 'Si un dato no aparece en el documento, usa null (o [] para las listas). No inventes datos que no estén en el documento.';

// ── Extracción de un comprobante de pago (app/api/extract-receipt) ───────────
export const RECEIPT_EXTRACT_DEFAULT =
  'Eres un asistente que lee un COMPROBANTE DE PAGO (captura de transferencia, recibo, voucher o ticket bancario). Devuelve SOLO JSON con esta forma exacta: {"monto_usd": number|null, "fecha": "aaaa-mm-dd"|null, "hora": "HH:MM"|null, "nota": string|null}. Definiciones: monto_usd = monto pagado en USD (solo el número; si el comprobante está en otra moneda, conviértelo con un tipo de cambio aproximado actual e indica en "nota" qué tipo de cambio usaste, ej. "Convertido de MXN a USD a ~17 MXN/USD"; si ya está en USD, nota = null); fecha = fecha de la operación en formato aaaa-mm-dd; hora = hora de la operación en formato 24 horas HH:MM. Si un dato no aparece en el comprobante, usa null. No inventes datos que no estén en el comprobante.';
