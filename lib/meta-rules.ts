// =============================================================================
// Reglas de Meta para aprobación de plantillas de WhatsApp
// =============================================================================
// Base de conocimiento compilada de la documentación oficial de Meta + guías de
// la industria (2024-2026). Se usa para (a) el validador de riesgo de rechazo
// (lib/template-validator.ts) y (b) inyectarle el contexto al asistente MaKo
// cuando se le pregunta por secuencias (lib/mako-context.ts).
// =============================================================================

// Reglas en prosa — se inyectan a Claude como conocimiento.
export const META_RULES_TEXT = `REGLAS DE META PARA APROBACIÓN DE PLANTILLAS DE WHATSAPP

Meta revisa cada plantilla antes de permitir enviarla (chequeo automático con ML + a veces revisión humana). La trata como un sistema antiabuso, NO como copy de marketing: exige claridad, valor explícito para el usuario y una categoría defendible. Las plantillas vagas se rechazan aunque la intención sea legítima.

1) CATEGORÍAS (obligatorio elegir una):
- UTILITY: seguimiento de una acción/solicitud del usuario; transaccional (confirmación de pedido/cita, recordatorio, recibo, alerta de cuenta). SIN promoción. Más barata y sin límites de marketing.
- MARKETING: promociones, ofertas, novedades, recordatorios con gancho de venta, reactivación, upsell/cross-sell, invitaciones. Regla de Meta: "si no es estrictamente Utility ni Authentication, es Marketing". Suele exigir opt-out ("Responde STOP..."). Es la más cara y la más vigilada.
- AUTHENTICATION: SOLO códigos OTP de verificación/login. Cuerpo fijo, sin texto libre, sin URLs, sin emojis, sin media.
- TRAMPA FRECUENTE: una Utility con redacción persuasiva/promocional se recategoriza a Marketing (Meta lo hace a diario y desde 2025 sin aviso previo) → empieza a costar como Marketing. Si el mensaje vende, va en Marketing.

2) FORMATO Y VARIABLES:
- Header TEXT: <=60 chars, máx 1 variable, sin emojis. Footer: <=60 chars, texto estático, SIN variables ni emojis. Body: <=1024 chars. Botón: texto <=25 chars (apuntar a <=20).
- Variables con dobles llaves {{1}}, {{2}} secuenciales y sin saltos (positional) o {{nombre}} en minúsculas con guion bajo (named).
- NO empezar ni terminar el cuerpo con una variable (rechazo casi seguro).
- NO variables consecutivas {{1}} {{2}} sin texto fijo entre medio.
- Suficiente texto fijo respecto a las variables (guía: palabras fijas >= 3 x nº variables + 1). Si casi todo el mensaje es dinámico, Meta sospecha spam.
- Cada variable necesita un EJEMPLO/sample real obligatorio en el alta. Sin sample → rechazo.
- Cada variable rodeada de contexto (no "Recordatorio: {{1}}" suelto).

3) CONTENIDO Y TONO:
- Sin ALL CAPS (gritar), máximo un signo de exclamación, sin urgencia agresiva ni amenazas ("actúa ya o perdés el acceso").
- Sin pedir datos sensibles (contraseña, PIN, tarjeta completa, datos bancarios, identificación). Derivar a portal seguro; a lo sumo identificadores parciales.
- Sin claims engañosos ("resultados garantizados", "100% seguro"), sin mencionar competidores/otras marcas.
- Sin productos prohibidos/restringidos (alcohol, tabaco, armas, drogas, apuestas, contenido adulto, política, préstamos predatorios, MLM).
- Links: dominio propio y limpio. PROHIBIDO acortadores (bit.ly, tinyurl) y enlaces wa.me dentro de la plantilla.
- Idioma declarado debe coincidir con el idioma del texto. Ortografía y gramática impecables.
- Nombre de la plantilla: solo minúsculas y guiones bajos, sin espacios, sin "test".

4) MOTIVOS DE RECHAZO MÁS COMUNES:
contenido promocional en categoría Utility; pedir datos sensibles; tono amenazante/urgente; demasiadas variables o variables sin contexto; empezar/terminar con variable; formato de variable inválido; falta de samples; emojis/caracteres en header/footer; categoría equivocada; propósito vago sin CTA; mal uso de Authentication; mismatch de idioma; URL con acortador o fuera del dominio; errores de ortografía; plantilla duplicada.

5) BUENAS PRÁCTICAS (aprobar a la primera): categoría defendible y redacción consistente con ella; empezar y terminar con texto fijo; variables secuenciales con contexto y sample; ratio texto/variable holgado; tono neutro; header/footer en texto plano; idioma declarado = escrito; ortografía impecable; en Marketing incluir opt-out.`;

// Rúbrica accionable — el validador la aplica para estimar riesgo.
export const VALIDATOR_RUBRIC = `RÚBRICA DE VALIDACIÓN (estimar riesgo de rechazo).

BLOQUEANTES (cualquiera presente → riesgo = ALTO):
- B1: el cuerpo empieza o termina con una variable {{...}}.
- B2: variable mal formada (una sola llave, llaves desbalanceadas, índice salteado como {{1}},{{3}}, o named que no sea [a-z_]+).
- B3: falta el ejemplo/sample de alguna variable.
- B4: pide datos sensibles (contraseña, PIN, tarjeta completa, CVV, datos bancarios, identificación).
- B5: categoría AUTHENTICATION con cuerpo custom/URL/media/emoji (no es un OTP fijo).
- B6: contenido prohibido (alcohol/tabaco/armas/drogas/apuestas/adulto/política/MLM/préstamos predatorios).
- B7: excede límites (header >60, body >1024, footer >60, botón >25 chars).
- B8: footer con variable o emoji, o header con más de 1 variable o con emoji.

SEÑALES FUERTES (cada una suma; 2+ tienden a ALTO):
- S1: densidad de variables alta (palabras fijas < 3 x nº variables + 1).
- S2: variables consecutivas sin texto entre medio.
- S3: variable sin contexto (cuerpo muy corto alrededor de la variable).
- S4: categoría Utility con señales de marketing (oferta, descuento, % off, "comprá ahora", upsell, CTA promocional) → recategorización o rechazo.
- S5: URL con acortador (bit.ly/tinyurl) o wa.me en el contenido.
- S6: lenguaje de urgencia/amenaza ("actúa ya", "última oportunidad", "o perdés el acceso").

SEÑALES MEDIAS (suman menos):
- M1: ALL CAPS en >=3 palabras o más de un signo de exclamación.
- M2: idioma declarado distinto al idioma del texto.
- M3: errores de ortografía/gramática.
- M4: propósito vago / sin CTA clara.
- M5: formato sucio (tabs, >=3 saltos de línea seguidos, emojis excesivos).
- M6: nombre con mayúsculas/espacios o con "test".
- M7: botón con texto >20 chars, >2 botones URL, >1 botón de teléfono, o URL fuera del dominio propio.
- M8: menciona competidores/otras marcas o hace claims absolutos ("garantizado", "100%").

Criterio: con un bloqueante → ALTO. Sin bloqueantes: 0-1 señales → BAJO; 2-3 → MEDIO; 4+ → ALTO.`;

// Etapas del funnel (espejan nutricion_secuencias.etapa) para los filtros.
export const ETAPAS_FUNNEL: Array<{ key: string; label: string }> = [
  { key: 'nutri', label: 'Nutrición' },
  { key: 'postagenda', label: 'Post-agenda' },
  { key: 'noshow', label: 'No-show' },
  { key: 'nopaga', label: 'No paga' },
  { key: 'manual', label: 'Manual' },
];
