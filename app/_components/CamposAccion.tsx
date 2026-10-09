'use client';

// =============================================================================
// CamposAccion — los controles de los parámetros del paso «⚡ Acción» que son algo del negocio
// =============================================================================
// Tercera tanda (09/10/2026, punto 16), textual: «Le puse "Mover un lead de etapa" y me pide un campo
// abierto para colocar el nombre de la etapa? En lugar de un desplegable para seleccionar las que tengo
// disponible?… cada cosa debes configurar bien los campos.»
//
// Qué control lleva cada parámetro lo decide `controlDe` (lib/editor-acciones.ts), puro y con test. Acá
// están los que piden datos de la base: la ETAPA (producto → etapa de su kanban), el PRODUCTO, la
// AUTOMATIZACIÓN, la PERSONA del equipo, y el MONTO con su moneda. Las listas salen de
// GET /api/flujos/opciones, una vez por carga y compartidas por todos los editores abiertos.
//
// ⚠️ LO QUE ESTÁ PUESTO ENTRA SIEMPRE A LAS OPCIONES, aunque ya no exista (una etapa que se borró, una
// automatización archivada, alguien que dejó el equipo): un desplegable cuyo valor no está entre sus
// opciones no muestra nada, y el primer clic lo pisa (AGENTS.md).
// ⚠️ `null` EN UNA LISTA ES «NO SE PUDO LEER», no «no hay»: se dice, y se conserva lo puesto.
// =============================================================================

import { useEffect, useState } from 'react';
import { Select, Input, Field } from '@/app/_ui';
import { productoDeLaEtapa, type OpcionesAccion, type ProductoDeAccion } from '@/lib/editor-acciones';

let opcionesP: Promise<OpcionesAccion> | null = null;
function pedirOpciones(): Promise<OpcionesAccion> {
  opcionesP ??= fetch('/api/flujos/opciones', { cache: 'no-store', signal: AbortSignal.timeout(30_000) })
    .then((r) => r.json())
    .then((j: Partial<OpcionesAccion> & { ok?: boolean; error?: string }) => {
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer las opciones.');
      return { productos: j.productos ?? null, equipo: j.equipo ?? null, secuencias: j.secuencias ?? null };
    })
    .catch((e) => { opcionesP = null; throw e; });
  return opcionesP;
}

const SIN_LEER: OpcionesAccion = { productos: null, equipo: null, secuencias: null };

/**
 * Las opciones de los controles. `undefined` mientras llegan; si la lectura entera falla, todas las
 * listas en `null` (cada control dice que no pudo leer). Se piden sólo con `activo`.
 */
export function useOpcionesAccion(activo: boolean): OpcionesAccion | undefined {
  const [op, setOp] = useState<OpcionesAccion | undefined>(undefined);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    pedirOpciones().then((o) => { if (vivo) setOp(o); }).catch(() => { if (vivo) setOp(SIN_LEER); });
    return () => { vivo = false; };
  }, [activo]);
  return op;
}

/** Lo que cambia un control: varios parámetros juntos (la etapa trae su producto y limpia el monto). */
export type Cambiar = (patch: Record<string, unknown>) => void;

type Comun = { label: string; required?: boolean; disabled?: boolean };

const CARGANDO = 'Cargando…';
const NO_SE_PUDO = 'No se pudo leer la lista.';

/** Las opciones de un desplegable con lo puesto adentro aunque ya no esté. */
function conLaPuesta(opciones: Array<{ value: string; label: string }>, puesto: string, rotulo: string): Array<{ value: string; label: string }> {
  return !puesto || opciones.some((o) => o.value === puesto) ? opciones : [{ value: puesto, label: rotulo }, ...opciones];
}

// ── La etapa: producto → etapa de su kanban ──────────────────────────────────────────────────

/**
 * La etapa, en dos pasos: el producto (sólo si hay más de uno) y la etapa de SU kanban. Elegir una
 * etapa guarda también su producto (`embudoId`) y limpia el monto o el motivo que esa etapa no pide:
 * un monto que quedó de cuando se eligió Ganado no tiene que viajar al mover a Contactado.
 *
 * Con `proponer_cambio_etapa` el producto es una PISTA para el editor (la acción mueve en el producto
 * principal del lead y su validador no lee `embudoId`); con una acción que declara `embudoId`
 * (`mover_lead_en_producto`) es el parámetro de verdad.
 */
export function SelectorEtapa({ label, required, disabled, params, opciones, cambiar }: Comun & {
  params: Record<string, unknown>; opciones: OpcionesAccion | undefined; cambiar: Cambiar;
}) {
  const etapa = typeof params.etapa === 'string' ? params.etapa : '';
  const lista = opciones?.productos;
  if (!lista) {
    return (
      <Select label={label} required={required} value={etapa} onChange={() => {}} disabled
        options={etapa ? [{ value: etapa, label: etapa }] : []} placeholder={lista === null ? NO_SE_PUDO : CARGANDO}
        hint={lista === undefined ? CARGANDO : undefined} error={lista === null ? NO_SE_PUDO : undefined} />
    );
  }
  const conEtapas = lista.filter((p) => p.etapas.length > 0);
  const producto = productoDeLaEtapa(conEtapas, params.embudoId, etapa || undefined);
  const elegirProducto = (id: string) => cambiar({ embudoId: Number(id), etapa: undefined, monto: undefined, motivo: undefined });
  const elegirEtapa = (key: string) => {
    const e = producto?.etapas.find((x) => x.value === key);
    cambiar({
      etapa: key, embudoId: producto?.embudoId,
      ...(e?.pide.includes('monto') ? {} : { monto: undefined }),
      ...(e?.pide.includes('motivo') ? {} : { motivo: undefined }),
    });
  };
  const opcionesEtapa = conLaPuesta((producto?.etapas ?? []).map((e) => ({ value: e.value, label: e.label })), etapa, `${etapa} (ya no está)`);
  return (
    <>
      {conEtapas.length > 1 && (
        <Select label="Producto" required={required} value={producto ? String(producto.embudoId) : ''} onChange={elegirProducto}
          options={conEtapas.map((p) => ({ value: String(p.embudoId), label: p.nombre }))} placeholder="Elige el producto" disabled={disabled} ariaLabel="Producto" />
      )}
      <Select label={label} required={required} value={etapa} onChange={elegirEtapa} options={opcionesEtapa}
        placeholder="Elige la etapa" disabled={disabled || !producto} ariaLabel="Etapa" />
    </>
  );
}

// ── El producto solo ─────────────────────────────────────────────────────────────────────────

export function SelectorProducto({ label, required, disabled, valor, opciones, onCambio }: Comun & {
  valor: unknown; opciones: OpcionesAccion | undefined; onCambio: (v: number | undefined) => void;
}) {
  const puesto = typeof valor === 'number' ? String(valor) : '';
  const lista: ProductoDeAccion[] | null | undefined = opciones?.productos;
  return (
    <Select label={label} required={required} value={puesto} onChange={(v) => onCambio(v ? Number(v) : undefined)}
      options={conLaPuesta((lista ?? []).map((p) => ({ value: String(p.embudoId), label: p.nombre })), puesto, `Producto ${puesto} (ya no está)`)}
      placeholder={lista === undefined ? CARGANDO : lista === null ? NO_SE_PUDO : 'Elige el producto'}
      error={lista === null ? NO_SE_PUDO : undefined} disabled={disabled || !lista} ariaLabel={label} />
  );
}

// ── La automatización ────────────────────────────────────────────────────────────────────────

export function SelectorSecuencia({ label, required, disabled, valor, opciones, onCambio }: Comun & {
  valor: unknown; opciones: OpcionesAccion | undefined; onCambio: (v: number | undefined) => void;
}) {
  const puesto = typeof valor === 'number' ? String(valor) : '';
  const lista = opciones?.secuencias;
  return (
    <Select label={label} required={required} value={puesto} onChange={(v) => onCambio(v ? Number(v) : undefined)}
      options={conLaPuesta((lista ?? []).map((s) => ({ value: String(s.id), label: s.nombre })), puesto, `Automatización ${puesto} (ya no está)`)}
      placeholder={lista === undefined ? CARGANDO : lista === null ? NO_SE_PUDO : 'Elige la automatización'}
      error={lista === null ? NO_SE_PUDO : undefined} disabled={disabled || !lista} search ariaLabel={label} />
  );
}

// ── La persona del equipo ────────────────────────────────────────────────────────────────────

/**
 * Closer o setter, por NOMBRE: es lo que valida `asignar_closer_setter` (crm.run.ts, contra
 * `nombresAsignables`). Elegirlo de la misma lista que valida es lo que hace que el paso no rebote en
 * cada lead con «"Juan" no es nadie del equipo».
 */
export function SelectorPersona({ label, required, disabled, valor, opciones, onCambio }: Comun & {
  valor: unknown; opciones: OpcionesAccion | undefined; onCambio: (v: string | undefined) => void;
}) {
  const puesto = typeof valor === 'string' ? valor : '';
  const lista = opciones?.equipo;
  const base = [{ value: '', label: 'Nadie' }, ...(lista ?? []).map((n) => ({ value: n, label: n }))];
  return (
    <Select label={label} required={required} value={puesto} onChange={(v) => onCambio(v || undefined)}
      options={conLaPuesta(base, puesto, `${puesto} (ya no está)`)}
      placeholder={lista === undefined ? CARGANDO : lista === null ? NO_SE_PUDO : 'Elige a alguien'}
      error={lista === null ? NO_SE_PUDO : undefined} disabled={disabled || !lista} ariaLabel={label} />
  );
}

// ── El monto ─────────────────────────────────────────────────────────────────────────────────

export function CampoMonto({ label, required, disabled, valor, moneda, onCambio, title }: Comun & {
  valor: unknown; moneda: string; onCambio: (v: number | undefined) => void; title?: string;
}) {
  return (
    <Field label={label} required={required}>
      <Input type="number" min={0} inputMode="decimal" value={typeof valor === 'number' ? String(valor) : ''} disabled={disabled} title={title}
        suffix={moneda || undefined} onChange={(e) => onCambio(e.target.value === '' ? undefined : Number(e.target.value))} />
    </Field>
  );
}
