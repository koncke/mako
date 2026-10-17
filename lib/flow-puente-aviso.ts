// =============================================================================
// flow-puente-aviso — los datos del aviso «Tus videos no se están generando» (puro, con test)
// =============================================================================
// «Nada por detrás», lote 2 (docs/inventario-nada-por-detras.md, 17/10/2026): el aviso `flow-puente-ausente` lo armaba
// el cron flow-abandono con su texto en el código. Pasa a ser una automatización de la plataforma (el evento
// `flow_puente_ausente`) con el texto literal en su fila; el cron pasa sólo cuántas tomas quedaron sin tomar.

/** Los datos por nombre: «{{flow_tomas}}» («1 toma», «3 tomas»; lib/variables-aviso.ts). */
export function datosPuenteAusente(cuantas: number): { flow_tomas: string } {
  const n = Math.max(1, Math.floor(cuantas));
  return { flow_tomas: `${n} ${n === 1 ? 'toma' : 'tomas'}` };
}
