// =============================================================================
// ai-cheap-techo — cuánta SALIDA se le puede pedir a cada modelo de OpenAI (revisión adversarial de IA15, 22/10/2026)
// =============================================================================
// Pedir más de lo que acepta el modelo es un 400 («max_tokens is too large»). Con su OpenAI, el Plan del negocio (IA15)
// pedía 32.000 a `gpt-4o-mini`, que acepta 16.384, y fallaba SIEMPRE en las llamadas grandes (leer una reunión,
// re-priorizar), anotado como fallo de SU clave. Un modelo que no está en la tabla va con el más chico: anda, aunque corte
// antes. Los demás proveedores manejan su tope solos.
//
// Pura (sin `server-only`): la prueba la importa. La usa lib/ai-cheap.ts en los tres pedidos de la capa barata.
// =============================================================================

export const TECHO_SALIDA_OPENAI: Readonly<Record<string, number>> = {
  'gpt-4o-mini': 16_384, 'gpt-4o': 16_384, 'gpt-4.1': 32_768, 'gpt-4.1-mini': 32_768, 'gpt-4.1-nano': 32_768,
};

export const conTechoDeSalida = (p: { nombre: string }, model: string, pedido: number): number =>
  p.nombre === 'openai' ? Math.min(pedido, TECHO_SALIDA_OPENAI[model] ?? 16_384) : pedido;
