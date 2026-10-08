'use client';

// =============================================================================
// EditorAccionMako — el paso «⚡ Acción» de un flujo: qué acción de MaKo y con qué datos
// =============================================================================
// Lo usan los dos lienzos: las secuencias de /chatbot y los avisos de /mensajes. Una sola
// pieza para los dos (AGENTS.md: si la misma pieza sirve a dos pantallas, se extrae ANTES
// de la segunda). El catálogo sale de GET /api/flujos/acciones, armado en el server: el
// registro de la API no se importa desde un componente cliente.
//
// Decisión de Martín (08/10/2026): lo que se configura acá CORRE SOLO cuando el flujo llega
// a este paso, sin pedir un «sí» (lib/api-mako/flujo.ts). Por eso el texto de la pantalla
// dice eso y nada más.
//
// El lead: si la acción pide `leadId`, el default es «el lead del evento» (el que entró, el
// que agendó, el de la inscripción) y se guarda como LEAD_DEL_EVENTO o sin el campo; elegir
// uno a mano es la excepción.
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Select, Input, Textarea, Checkbox, Field } from '@/app/_ui';
import type { AccionEditor, ParametroEditor } from '@/lib/api-mako/flujo';
import { LEAD_DEL_EVENTO, LEAD_A_ELEGIR } from '@/lib/api-mako/flujo-params';

export type ValorAccion = { operacion?: string; params?: Record<string, unknown> };

let catalogoP: Promise<AccionEditor[]> | null = null;
function catalogo(): Promise<AccionEditor[]> {
  catalogoP ??= fetch('/api/flujos/acciones', { cache: 'no-store' })
    .then((r) => r.json())
    .then((j: { ok?: boolean; acciones?: AccionEditor[]; error?: string }) => {
      if (!j.ok) throw new Error(j.error || 'No se pudieron leer las acciones.');
      return j.acciones ?? [];
    })
    .catch((e) => { catalogoP = null; throw e; });
  return catalogoP;
}

/**
 * Los títulos de las acciones, para que la tarjeta de un lienzo diga QUÉ corre el paso sin
 * abrir el panel. Es la MISMA lectura (y la misma caché) que el desplegable del editor: los
 * dos lienzos la pedían cada uno por su cuenta. Se pide sólo si el flujo tiene pasos de
 * acción; mientras no llega, o si falla (no es admin, sin red), devuelve null y la tarjeta
 * dice el id legible.
 */
export function useTitulosAcciones(activo: boolean): Map<string, string> | null {
  const [titulos, setTitulos] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    catalogo()
      .then((a) => { if (vivo) setTitulos(new Map(a.map((x) => [x.id, x.titulo]))); })
      .catch(() => { /* queda el id legible */ });
    return () => { vivo = false; };
  }, [activo]);
  return titulos;
}

/** «fechaJunta» → «Fecha junta». Un rótulo de 1-3 palabras; la descripción va en el title. */
function rotulo(nombre: string): string {
  const s = nombre.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const ES_TEXTO_LARGO = /texto|mensaje|nota|detalle|descripcion|cuerpo|contenido/i;

export function EditorAccionMako({ valor, onCambio, disabled }: {
  valor: ValorAccion;
  onCambio: (v: ValorAccion) => void;
  disabled?: boolean;
}) {
  const [acciones, setAcciones] = useState<AccionEditor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    catalogo().then((a) => { if (vivo) setAcciones(a); }).catch((e) => { if (vivo) setError(e instanceof Error ? e.message : String(e)); });
    return () => { vivo = false; };
  }, []);

  const elegida = useMemo(() => acciones?.find((a) => a.id === valor.operacion) ?? null, [acciones, valor.operacion]);
  const params = valor.params ?? {};
  const fijar = (nombre: string, v: unknown) => {
    const p = { ...params };
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete p[nombre]; else p[nombre] = v;
    onCambio({ operacion: valor.operacion, params: p });
  };

  if (error) return <p style={{ color: 'var(--bad)', fontSize: 13, margin: 0 }}>{error}</p>;
  if (!acciones) return <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Cargando acciones…</p>;

  const opciones = acciones.map((a) => ({ value: a.id, label: a.titulo, sub: a.areaTitulo, buscar: `${a.id} ${a.descripcion}` }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <Select
        label="Acción"
        value={valor.operacion ?? ''}
        onChange={(id) => onCambio({ operacion: id, params: {} })}
        options={opciones}
        placeholder="Elige qué hace MaKo"
        search
        disabled={disabled}
        hint={elegida ? 'Corre sola cuando el flujo llega aquí.' : undefined}
      />
      {elegida?.parametros.map((p) => (
        <CampoParametro key={`${valor.operacion ?? ''}:${p.nombre}`} p={p} valor={params[p.nombre]} onCambio={(v) => fijar(p.nombre, v)} pideLead={elegida.pideLead} disabled={disabled} />
      ))}
    </div>
  );
}

function CampoParametro({ p, valor, onCambio, pideLead, disabled }: {
  p: ParametroEditor; valor: unknown; onCambio: (v: unknown) => void; pideLead: boolean; disabled?: boolean;
}) {
  const label = rotulo(p.nombre);
  const [crudo, setCrudo] = useState<string>(() => (p.tipo === 'object' || p.tipo === 'object[]') && valor != null ? JSON.stringify(valor, null, 1) : '');
  const [jsonMal, setJsonMal] = useState(false);

  if (p.nombre === 'leadId' && pideLead) {
    // El modo se GUARDA, no se deduce de un campo vacío: «Otro lead» sin id vuelve como
    // LEAD_A_ELEGIR. Antes se guardaba '' y `fijar` lo borraba, así que el desplegable volvía
    // solo a «El lead del evento» y la acción corría sobre ese lead.
    const modo = typeof valor === 'number' || valor === LEAD_A_ELEGIR ? 'otro'
      : valor === LEAD_DEL_EVENTO || p.obligatorio ? 'evento' : 'ninguno';
    const opciones = [
      { value: 'evento', label: 'El lead del evento' },
      { value: 'otro', label: 'Otro lead (por id)' },
      // Un lead opcional vacío es «ninguno» (lib/api-mako/flujo-params.ts, paramsDelPaso).
      ...(p.obligatorio ? [] : [{ value: 'ninguno', label: 'Ninguno' }]),
    ];
    return (
      <Field label="Lead" required={p.obligatorio} error={modo === 'otro' && typeof valor !== 'number' ? 'Falta el id.' : undefined}>
        <Select
          value={modo}
          onChange={(v) => onCambio(v === 'evento' ? LEAD_DEL_EVENTO : v === 'ninguno' ? undefined : (typeof valor === 'number' ? valor : LEAD_A_ELEGIR))}
          options={opciones}
          disabled={disabled}
          ariaLabel="De qué lead"
        />
        {modo === 'otro' && (
          <Input type="number" value={typeof valor === 'number' ? String(valor) : ''} placeholder="id del lead" disabled={disabled}
            onChange={(e) => onCambio(e.target.value ? Number(e.target.value) : LEAD_A_ELEGIR)} />
        )}
      </Field>
    );
  }
  // Una lista con opciones cerradas se elige con VARIOS: con el desplegable de un solo valor
  // nunca se podía marcar más de uno (y guardar_diagnostico_fase pide seis).
  if (p.tipo === 'string[]' && p.enum?.length) {
    const lista = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <Select label={label} required={p.obligatorio} value="" placeholder="Elige" varios={lista}
        onChange={(v) => onCambio(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])}
        options={p.enum.map((e) => ({ value: e, label: e }))} disabled={disabled} />
    );
  }
  if (p.enum?.length) {
    return (
      <Select label={label} required={p.obligatorio} value={typeof valor === 'string' ? valor : ''} onChange={(v) => onCambio(v)}
        options={p.enum.map((e) => ({ value: e, label: e }))} disabled={disabled} />
    );
  }
  if (p.tipo === 'boolean') {
    return <Checkbox checked={valor === true} onChange={(v) => onCambio(v)} label={label} disabled={disabled} />;
  }
  if (p.tipo === 'number') {
    return (
      <Field label={label} required={p.obligatorio}>
        <Input type="number" value={typeof valor === 'number' ? String(valor) : ''} disabled={disabled} title={p.descripcion}
          onChange={(e) => onCambio(e.target.value === '' ? undefined : Number(e.target.value))} />
      </Field>
    );
  }
  if (p.tipo === 'string[]') {
    return (
      <Field label={label} required={p.obligatorio} hint="Separados por coma.">
        <Input value={Array.isArray(valor) ? valor.join(', ') : ''} disabled={disabled} title={p.descripcion}
          onChange={(e) => onCambio(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
      </Field>
    );
  }
  if (p.tipo === 'object' || p.tipo === 'object[]') {
    return (
      <Field label={label} required={p.obligatorio} error={jsonMal ? (p.tipo === 'object' ? 'Tiene que ser un objeto { … }.' : 'Tiene que ser una lista [ { … } ].') : undefined}>
        <Textarea rows={4} value={crudo} disabled={disabled} title={p.descripcion}
          onChange={(e) => setCrudo(e.target.value)}
          onBlur={() => {
            if (!crudo.trim()) { setJsonMal(false); onCambio(undefined); return; }
            // «hola» o [ … ] en un campo de objeto son JSON válido y fallaban en cada corrida.
            const esObjeto = (x: unknown) => x != null && typeof x === 'object' && !Array.isArray(x);
            try {
              const v: unknown = JSON.parse(crudo);
              const ok = p.tipo === 'object' ? esObjeto(v) : Array.isArray(v) && v.every(esObjeto);
              if (ok) { onCambio(v); setJsonMal(false); } else setJsonMal(true);
            } catch { setJsonMal(true); }
          }} />
      </Field>
    );
  }
  const largo = ES_TEXTO_LARGO.test(p.nombre);
  return (
    <Field label={label} required={p.obligatorio}>
      {largo
        ? <Textarea rows={3} value={typeof valor === 'string' ? valor : ''} disabled={disabled} title={p.descripcion} onChange={(e) => onCambio(e.target.value)} />
        : <Input value={typeof valor === 'string' ? valor : ''} disabled={disabled} title={p.descripcion} onChange={(e) => onCambio(e.target.value)} />}
    </Field>
  );
}
