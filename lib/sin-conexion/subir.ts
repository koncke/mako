// =============================================================================
// MaKo sin conexión — subir UN cambio de la cola (T2, 28/10/2026)
// =============================================================================
// La lógica de la subida, sin servidor adentro: las escrituras, la tabla de idempotencia y el negocio de la sesión llegan
// por `Deps` (las reales las pone app/sin-conexion/acciones.ts; los tests, unas de mentira). El orden de las preguntas:
//
//   1. ¿Es de ESTE negocio, y no mirando la cuenta de otro?           → si no, «rechazada» (sin guardar: se puede reintentar).
//   2. ¿Ya se subió? (`sin_conexion_aplicadas`, por el id del cambio)  → el MISMO resultado, sin aplicarlo otra vez.
//      ¿Se está subiendo (otra ventana)?                                → «reintentar»; si hace más de 10 min, «incierta».
//   3. CAMPO POR CAMPO: el valor de HOY contra el «antes» y el «después» (`decidirCampo`).
//      «ya-estaba» se guarda como hecho; un conflicto no se aplica sin «Aplicar el mío» (`forzar`).
//   4. ¿Tiene consecuencias? (una automatización que le escribe al lead al entrar a esa etapa) → «espera-ok» sin el OK.
//   5. Se reserva el id ANTES de escribir (una fila «en-curso»: otra ventana que suba lo mismo choca con la llave única),
//      se aplica por la MISMA puerta que el teléfono y se guarda el resultado.
//
// Un rechazo de la puerta (sin permiso, el lead ya no está) SUELTA la reserva y vuelve «rechazada»: no se reintenta solo, la
// persona lo ve con su motivo. Un error que TIRA a mitad deja la reserva «en-curso»: no se sabe si la escritura quedó, y a los
// 10 minutos es «incierta» (la persona revisa y decide), nunca un segundo intento a ciegas.
// =============================================================================

import { decidirCampo, type Operacion, type Resultado } from './cola';

/** A partir de cuánto una reserva «en-curso» se da por perdida (se cortó a mitad): la persona decide. */
export const RESERVA_PERDIDA_MS = 10 * 60_000;

export type Reserva = { estado: 'en-curso' | 'final'; resultado: Resultado | null; creado: string };
type Hecho = { ok: true } | { ok: false; motivo: string };

export type Deps = {
  /** El negocio de la sesión (null = sin negocio). */
  ws: number | null;
  impersonando: boolean;
  leerReserva(id: string): Promise<Reserva | null | 'sin-tabla'>;
  /** Inserta la fila «en-curso». `ya` = otra ventana la reservó primero (la llave única). */
  reservar(op: Operacion): Promise<'ok' | 'ya' | 'sin-tabla'>;
  finalizar(id: string, r: Resultado): Promise<void>;
  soltar(id: string): Promise<void>;
  etapaActual(leadId: number, funnelId: number | null): Promise<{ ok: true; etapa: string; rotulo: (key: string) => string } | { ok: false; motivo: string }>;
  consecuenciaDeEtapa(leadId: number, funnelId: number | null, etapa: string): Promise<string | null>;
  moverEtapa(leadId: number, funnelId: number | null, etapa: string): Promise<Hecho>;
  nota(leadId: number, texto: string): Promise<Hecho>;
  contactoActual(leadId: number, campo: 'nombre' | 'email' | 'empresa'): Promise<{ ok: true; valor: string | null } | { ok: false; motivo: string }>;
  guardarContacto(leadId: number, campo: 'nombre' | 'email' | 'empresa', valor: string | null): Promise<Hecho>;
  columnaDeTarea(tareaId: string): Promise<{ ok: true; col: string; rotulo: (key: string) => string } | { ok: false; motivo: string }>;
  moverTarea(tareaId: string, col: string): Promise<Hecho>;
  /** La tarea nueva como BORRADOR (crearPropuesta con `ref`: subirlo dos veces no crea dos). */
  borrador(titulo: string, ref: string): Promise<{ ok: true; link: string } | { ok: false; motivo: string }>;
  ahora(): number;
};

export type OpcionesSubir = { forzar?: boolean; ok?: boolean };

const rechazada = (motivo: string): Resultado => ({ estado: 'rechazada', motivo });

export async function subirCambio(op: Operacion, o: OpcionesSubir, d: Deps): Promise<Resultado> {
  if (d.impersonando) return rechazada('Mirando la cuenta de otro no se sube nada: sube tus cambios desde tu cuenta.');
  if (d.ws == null || op.ws !== d.ws) return rechazada('Es de otro negocio: entra a ese negocio para subirlo.');

  const previa = await d.leerReserva(op.id);
  if (previa === 'sin-tabla') return { estado: 'reintentar', motivo: 'MaKo todavía no puede recibir estos cambios. Se reintenta más tarde.' };
  if (previa?.estado === 'final' && previa.resultado) return previa.resultado;
  if (previa?.estado === 'en-curso') {
    const edad = d.ahora() - Date.parse(previa.creado);
    if (!(edad > RESERVA_PERDIDA_MS)) return { estado: 'reintentar', motivo: 'Se está subiendo desde otra ventana.' };
    if (!o.forzar) return { estado: 'incierta', motivo: 'Se cortó a mitad de subirlo y no se sabe si quedó. Revisa y decide.' };
  }

  // ── 3 y 4: campo por campo, y las consecuencias ──
  const c = op.cambio;
  if (c.tipo === 'etapa') {
    const hoy = await d.etapaActual(c.leadId, c.funnelId);
    if (!hoy.ok) return rechazada(hoy.motivo);
    const decision = decidirCampo(hoy.etapa, c.antes, c.despues);
    if (decision === 'ya-estaba') return guardarYDevolver(op, { estado: 'ya-estaba' }, d, !!previa);
    if (decision === 'conflicto' && !o.forzar) {
      return { estado: 'conflicto', servidor: hoy.rotulo(hoy.etapa), motivo: `Mientras no tenías conexión quedó en «${hoy.rotulo(hoy.etapa)}».` };
    }
    const consecuencia = await d.consecuenciaDeEtapa(c.leadId, c.funnelId, c.despues);
    if (consecuencia && !o.ok) return { estado: 'espera-ok', motivo: consecuencia };
  } else if (c.tipo === 'contacto') {
    const hoy = await d.contactoActual(c.leadId, c.campo);
    if (!hoy.ok) return rechazada(hoy.motivo);
    const decision = decidirCampo(hoy.valor, c.antes, c.despues, c.campo);
    if (decision === 'ya-estaba') return guardarYDevolver(op, { estado: 'ya-estaba' }, d, !!previa);
    if (decision === 'conflicto' && !o.forzar) {
      return { estado: 'conflicto', servidor: hoy.valor, motivo: `Mientras no tenías conexión quedó «${hoy.valor ?? ''}».` };
    }
  } else if (c.tipo === 'tarea-estado') {
    const hoy = await d.columnaDeTarea(c.tareaId);
    if (!hoy.ok) return rechazada(hoy.motivo);
    const decision = decidirCampo(hoy.col, c.antes, c.despues);
    if (decision === 'ya-estaba') return guardarYDevolver(op, { estado: 'ya-estaba' }, d, !!previa);
    if (decision === 'conflicto' && !o.forzar) {
      return { estado: 'conflicto', servidor: hoy.rotulo(hoy.col), motivo: `Mientras no tenías conexión quedó en «${hoy.rotulo(hoy.col)}».` };
    }
  }

  // ── 5: reservar, aplicar por la puerta del teléfono, guardar ──
  if (!previa) {
    const r = await d.reservar(op);
    if (r === 'sin-tabla') return { estado: 'reintentar', motivo: 'MaKo todavía no puede recibir estos cambios. Se reintenta más tarde.' };
    if (r === 'ya') return { estado: 'reintentar', motivo: 'Se está subiendo desde otra ventana.' };
  }
  // ⚠️ Lo que TIRA acá deja la reserva «en-curso» a propósito: no se sabe si la escritura quedó (ver el encabezado).
  let hecho: Hecho;
  let final: Resultado;
  if (c.tipo === 'nota') {
    hecho = await d.nota(c.leadId, c.texto);
    final = { estado: 'aplicada' };
  } else if (c.tipo === 'etapa') {
    hecho = await d.moverEtapa(c.leadId, c.funnelId, c.despues);
    final = { estado: 'aplicada' };
  } else if (c.tipo === 'contacto') {
    hecho = await d.guardarContacto(c.leadId, c.campo, c.despues);
    final = { estado: 'aplicada' };
  } else if (c.tipo === 'tarea-estado') {
    hecho = await d.moverTarea(c.tareaId, c.despues);
    final = { estado: 'aplicada' };
  } else {
    const b = await d.borrador(c.titulo, `sin-conexion:${op.id}`);
    hecho = b.ok ? { ok: true } : b;
    final = b.ok ? { estado: 'borrador', link: b.link } : { estado: 'rechazada' };
  }
  if (!hecho.ok) {
    await d.soltar(op.id);
    return rechazada(hecho.motivo);
  }
  await d.finalizar(op.id, final);
  return final;
}

/** «Ya estaba» también es un hecho: se guarda (con reserva propia si no la había) para que repetirlo dé lo mismo. */
async function guardarYDevolver(op: Operacion, r: Resultado, d: Deps, habiaReserva: boolean): Promise<Resultado> {
  if (!habiaReserva) {
    const x = await d.reservar(op);
    if (x !== 'ok') return r;
  }
  await d.finalizar(op.id, r);
  return r;
}
