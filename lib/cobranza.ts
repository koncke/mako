// =============================================================================
// Cobranza por WhatsApp: QUÉ cuota hay que avisar hoy
// =============================================================================
// Martín, 04/10/2026, repartiendo la tarjeta #19 al chat del chatbot: «debería hacer
// recordatorios a clientes como en el grupo de MaKo en WhatsApp». Y sobre la cadencia:
// «Para eso estamos configurando el chatbot, que cada usuario lo pueda editar! Y en la
// plantilla por defecto, haz lo que te parezca mejor».
//
// De ahí sale el reparto de responsabilidades, que es lo único que este módulo decide:
//
//   · ACÁ se decide CUÁNDO ENTRA una cuota al recordatorio — una sola vez por cuota.
//   · La CADENCIA (cada cuántos días insistir y cuántas veces) NO vive acá: vive en el
//     FLUJO del mensaje, que se edita en el lienzo de /mensajes con pasos de espera.
//     Cablear los días acá sería justo lo que él pidió que no: un número que el cliente
//     no puede cambiar.
//   · Y el CORTE al cobrar tampoco: lo hace `marcarPago`, cerrando las corridas de esa
//     cuota (`cerrarCorridasDeCuota`). Un recordatorio de cobranza que sale cuando ya
//     se pagó es la misma falla que la preparación de una reunión que llegó después de
//     la reunión, y esa está medida.
//
// ⚠️ MÓDULO SIN `server-only`: lo que vive acá es la DECISIÓN, y adentro del cron
// ningún test la podría importar. La lectura de `pagos` la hace el cron.
//
// ⚠️ Y LA VENTANA EXISTE PORQUE EL DEDUP ES POR CUOTA. Avisar sólo el día exacto del
// vencimiento hace que un tick fallado —o un workspace que ese día no tenía la línea
// conectada— pierda la cuota para siempre, en silencio. Con una ventana de días y una
// clave de dedup por cuota, cualquier día de esa ventana sirve y la cuota entra UNA vez.

import type { VariableAviso } from './variables-aviso';
import { plata, fecha } from './variables-del-lead';

/** Lo que el cron necesita de una cuota para decidir. Es el molde de `CuotaPendiente`
 *  (lib/pagos.ts), copiado como forma mínima para no arrastrar el server a este módulo. */
export type CuotaParaAvisar = {
  pago_id: number;
  lead_id: number;
  lead_nombre: string;
  numero: number;
  monto_usd: number;
  fecha_esperada: string;
  /** negativo = venció hace N días; positivo = vence en N días. */
  dias: number;
};

export type DisparoCobranza = {
  avisoId: 'cuota-vencida' | 'cuota-por-vencer';
  cuota: CuotaParaAvisar;
  /** Una por cuota y por aviso: el `tipo` entra en la clave del lado del emisor. */
  dedupKey: string;
  /** Los valores EXACTOS, puestos por código. Las claves son del catálogo de variables. */
  datos: Record<string, string>;
  /**
   * Los que VIAJAN con la corrida, para los mensajes que salen días después.
   *
   * ⚠️ `cuota_dias` NO ESTÁ ACÁ, y es la razón de que este campo exista aparte. Un dato
   * que viaja en el `ctx` de una corrida es la FOTO del momento en que la corrida se
   * abrió: tres días más tarde, un `{{cuota_dias}}` guardado diría «1 día» sobre un
   * atraso de cuatro. Los que no envejecen son el número, el monto y la fecha de
   * vencimiento. Es la misma familia que «un mensaje que habla de un MOMENTO se
   * re-pregunta al salir», aplicada a un dato en vez de a una condición.
   */
  datosEstables: Record<string, string>;
};

/** Hasta cuántos días después del vencimiento se puede dar la entrada. Ver la cabecera. */
export const VENTANA_VENCIDA_DIAS = 7;
/** Cuántos días antes se avisa que una cuota está por vencer. */
export const DIAS_ANTES = 1;
/**
 * La ventana del dedup: 120 días. No es «cada cuánto se repite» —eso es la cadencia del
 * flujo— sino «esta cuota ya entró». Tiene que cubrir cómodamente el plan de pagos más
 * largo (6 cuotas mensuales) para que una cuota no vuelva a entrar al mes siguiente.
 */
export const TTL_UNA_POR_CUOTA_MIN = 60 * 24 * 120;

/** «3 días» / «1 día». En singular cuando corresponde: el texto lo lee una persona. */
export const enDias = (n: number): string => `${Math.abs(n)} ${Math.abs(n) === 1 ? 'día' : 'días'}`;

/** Los que no envejecen: se pueden guardar y volver a usar días después. */
function datosEstablesDe(c: CuotaParaAvisar): Record<string, string> {
  return {
    cuota_numero: String(c.numero),
    cuota_monto: plata(c.monto_usd),
    cuota_vence: fecha(c.fecha_esperada),
  };
}

/** Todos, para el mensaje de ENTRADA, que sale hoy. */
function datosDe(c: CuotaParaAvisar): Record<string, string> {
  return { ...datosEstablesDe(c), cuota_dias: enDias(c.dias) };
}

/** La clave que es una foto del momento, y por eso no viaja. Se exporta para el test. */
export const CLAVE_QUE_ENVEJECE = 'cuota_dias';

/**
 * Las cuotas que entran HOY al recordatorio, con lo que el mensaje necesita.
 *
 * ⚠️ UNA CUOTA NO PUEDE ENTRAR POR LAS DOS PUERTAS. Si ya venció, el aviso de «por
 * vencer» no corresponde — y al revés no pasa, porque el dedup es por cuota y por tipo:
 * la misma cuota puede haber avisado ayer que vencía y hoy que venció, y eso está bien.
 * Lo que no puede es salir las dos el mismo día sobre el mismo hecho.
 */
export function disparosDeCobranza(p: {
  vencidas: CuotaParaAvisar[]; porVencer: CuotaParaAvisar[];
}): DisparoCobranza[] {
  const out: DisparoCobranza[] = [];
  for (const c of p.vencidas) {
    if (c.dias > -1 || c.dias < -VENTANA_VENCIDA_DIAS) continue;
    out.push({ avisoId: 'cuota-vencida', cuota: c, dedupKey: `cuota:${c.pago_id}`, datos: datosDe(c), datosEstables: datosEstablesDe(c) });
  }
  for (const c of p.porVencer) {
    if (c.dias < 0 || c.dias > DIAS_ANTES) continue;
    out.push({ avisoId: 'cuota-por-vencer', cuota: c, dedupKey: `cuota:${c.pago_id}`, datos: datosDe(c), datosEstables: datosEstablesDe(c) });
  }
  return out;
}

/**
 * Las claves del catálogo que este módulo sabe llenar. Se exporta para que el test
 * compare contra el catálogo: una variable de alcance `cuota` que acá no se llene es
 * una fila que el selector ofrece y nadie resuelve, que es el modo de falla que esta
 * familia ya pagó.
 */
export const CLAVES_DE_CUOTA: ReadonlyArray<VariableAviso['key']> = [
  'cuota_numero', 'cuota_monto', 'cuota_vence', 'cuota_dias',
];
