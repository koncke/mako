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
// a este paso, sin pedir un «sí» (lib/api-mako/flujo.ts).
//
// ── Tercera tanda (09/10/2026, punto 16) ── «Le puse "Mover un lead de etapa" y me pide un campo
// abierto para colocar el nombre de la etapa? En lugar de un desplegable…? Y abajo me aparece "Monto" y
// "Motivo", no tiene nada de sentido… cada cosa debes configurar bien los campos. También siento que
// pusiste muchísimas acciones que tal vez no son necesarias». Lo que cambió:
//   · EL SELECTOR OFRECE LA LISTA CORTA (`ACCIONES_DEL_FLUJO`, lib/editor-acciones.ts), por grupo.
//     Las otras ~190 siguen en el registro para la API y el doer; un paso ya guardado con una de ellas
//     aparece en «La que tiene puesta» y se edita igual.
//   · CADA PARÁMETRO CON SU CONTROL (`controlDe`): la etapa es producto → etapa de su kanban, la
//     etiqueta el `SelectorEtiqueta`, la automatización y la persona del equipo se eligen de la lista
//     del negocio, el monto lleva su moneda. Los controles con datos viven en ./CamposAccion.tsx.
//   · LO QUE DEPENDE DE OTRO CAMPO APARECE SÓLO CUANDO APLICA (`repartoDelFormulario` con contexto):
//     monto y motivo sólo al mover a una etapa que los pide (y ahí obligatorios), el motivo del estado
//     del cliente sólo para una baja o una pausa.
// ── Segunda tanda (08/10/2026, punto 7) ── lo que sigue valiendo: lo que llena el FLUJO no se dibuja
// (el `respuesta` del aviso, LLENA_EL_FLUJO), el lead del evento es una línea «Sobre el lead de este
// flujo · Cambiar», lo opcional va plegado detrás de «Más opciones», y los rótulos salen de UN lugar
// (`rotuloDeParametro`).
//
// El lead: si la acción pide `leadId`, el default es «el lead del evento» (el que entró, el
// que agendó, el de la inscripción). Al ELEGIR una acción que pide lead se guarda
// LEAD_DEL_EVENTO explícito, también si el lead es opcional: sin eso un «Avisar al equipo»
// recién elegido nacía en «Ninguno» y el aviso salía sin el nombre ni el link del lead. La
// excepción es la acción con OTRO destinatario (un teléfono): ahí el lead del evento chocaba con
// él (`naceSobreElLeadDelEvento`, lib/editor-acciones.ts). «Ninguno» y «el del evento» siguen a un
// clic («Cambiar»).
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Select, Input, Textarea, Checkbox, Field } from '@/app/_ui';
import type { AccionEditor, ParametroEditor } from '@/lib/api-mako/flujo';
import { LEAD_DEL_EVENTO, LEAD_A_ELEGIR, LLENA_EL_FLUJO } from '@/lib/api-mako/flujo-params';
import {
  rotuloDeParametro, resumenDeAccion, seccionesDeAcciones, repartoDelFormulario, naceSobreElLeadDelEvento,
  controlDe, monedaDe, rotuloDeOpcion, SECCION_PUESTA, type OpcionesAccion,
} from '@/lib/editor-acciones';
import { SelectorEtiqueta } from './etiquetas-cliente';
import { useOpcionesAccion, SelectorEtapa, SelectorProducto, SelectorSecuencia, SelectorPersona, CampoMonto, type Cambiar } from './CamposAccion';

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
 * dice el id legible. Trae también las que no están en la lista corta: un paso viejo sigue
 * diciendo qué hace.
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

/** Los parámetros que pone el flujo para esta operación: no se dibujan. */
const ocultosDe = (operacion: string): ReadonlySet<string> => new Set(Object.keys(LLENA_EL_FLUJO[operacion] ?? {}));

/** Lo que se guarda al ELEGIR una acción: vacío, salvo el lead del evento cuando es el default. */
const paramsIniciales = (a: Pick<AccionEditor, 'pideLead' | 'parametros'> | undefined): Record<string, unknown> =>
  (a?.pideLead && naceSobreElLeadDelEvento(a.parametros) ? { leadId: LEAD_DEL_EVENTO } : {});

const tieneValor = (v: unknown): boolean => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);

/** La línea de qué hace: la de la lista corta, o la sacada de la descripción del registro. */
const lineaDe = (a: Pick<AccionEditor, 'que' | 'descripcion'>): string => a.que ?? resumenDeAccion(a.descripcion);

/** El botón de texto de la casa para «Cambiar» y «Más opciones»: sin caja, en el color del link. */
const botonTexto: CSSProperties = {
  background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  fontSize: 12.5, fontWeight: 600, color: 'var(--primary-strong)',
};

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
  // Las listas de la base se piden recién cuando hay una acción elegida que las puede necesitar.
  const opciones = useOpcionesAccion(!!elegida);
  const secciones = useMemo(() => {
    if (!acciones) return [];
    const out = seccionesDeAcciones(acciones, valor.operacion).map((s) => ({
      title: s.titulo,
      options: s.acciones.map((a) => ({ value: a.id, label: a.titulo, sub: lineaDe(a), buscar: a.id })),
    }));
    // ⚠️ LA QUE ESTÁ PUESTA ENTRA AUNQUE YA NO EXISTA (otra capa, una operación que se retiró): un
    // desplegable cuyo valor no está entre sus opciones no muestra nada (AGENTS.md).
    if (valor.operacion && !acciones.some((a) => a.id === valor.operacion)) {
      out.unshift({ title: SECCION_PUESTA, options: [{ value: valor.operacion, label: valor.operacion.replace(/_/g, ' '), sub: 'Ya no está disponible', buscar: valor.operacion }] });
    }
    return out;
  }, [acciones, valor.operacion]);

  const params = valor.params ?? {};
  const cambiar: Cambiar = (patch) => {
    const p = { ...params };
    for (const [nombre, v] of Object.entries(patch)) {
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete p[nombre]; else p[nombre] = v;
    }
    onCambio({ operacion: valor.operacion, params: p });
  };

  if (error) return <p style={{ color: 'var(--bad)', fontSize: 13, margin: 0 }}>{error}</p>;
  if (!acciones) return <p style={{ color: 'var(--faint)', fontSize: 13, margin: 0 }}>Cargando acciones…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
        <Select
          value={valor.operacion ?? ''}
          onChange={(id) => onCambio({ operacion: id, params: paramsIniciales(acciones.find((a) => a.id === id)) })}
          secciones={secciones}
          placeholder="Elige qué hace MaKo"
          disabled={disabled}
          ariaLabel="Acción"
          menuAncho={340}
          menuAlto={420}
        />
        {elegida && <p style={{ margin: '0 2px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>{lineaDe(elegida)}</p>}
      </div>
      {/* `key` por operación: lo plegado y el «Cambiar» del lead son de ESTA acción. */}
      {elegida && <FormularioAccion key={elegida.id} accion={elegida} valor={valor} params={params} cambiar={cambiar} opciones={opciones} disabled={disabled} />}
    </div>
  );
}

/**
 * El formulario de UNA acción ya elegida (exportado para tests/editor-acciones.test.ts, que lo
 * renderiza con `opciones` puestas: el fetch no corre en un render del server).
 */
export function FormularioAccion({ accion, valor, params, cambiar, opciones, disabled }: {
  accion: AccionEditor; valor: ValorAccion; params: Record<string, unknown>;
  cambiar: Cambiar;
  /** Las listas de la base. `undefined` = todavía no llegaron. */
  opciones?: OpcionesAccion;
  disabled?: boolean;
}) {
  const { lead, obligatorios, opcionales, plegar } = repartoDelFormulario(accion.parametros, accion.pideLead, ocultosDe(accion.id), { accionId: accion.id, params, opciones });
  // Abierto de entrada si algo de lo plegado ya tiene valor: plegar lo que está puesto lo esconde.
  const [mas, setMas] = useState(() => opcionales.some((p) => tieneValor(params[p.nombre])));
  const campo = (p: ParametroEditor, required: boolean) => (
    <CampoParametro key={`${valor.operacion ?? ''}:${p.nombre}`} p={p} required={required} params={params} cambiar={cambiar}
      opciones={opciones} pideLead={accion.pideLead} disabled={disabled} />
  );
  return (
    <>
      {lead && <FilaLead p={lead} valor={params.leadId} onCambio={(v) => cambiar({ leadId: v })} disabled={disabled} />}
      {obligatorios.map((p) => campo(p, true))}
      {!plegar && opcionales.map((p) => campo(p, false))}
      {plegar && opcionales.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" onClick={() => setMas((m) => !m)} aria-expanded={mas} style={{ ...botonTexto, alignSelf: 'flex-start' }}>
            {mas ? 'Menos opciones ▴' : 'Más opciones ▾'}
          </button>
          {mas && opcionales.map((p) => campo(p, false))}
        </div>
      )}
    </>
  );
}

/**
 * El lead, cuando es el del EVENTO, es una línea y no un formulario: es el caso normal y no hay
 * nada que decidir. «Cambiar» abre el selector de siempre (el del evento, otro por id, ninguno).
 */
function FilaLead({ p, valor, onCambio, disabled }: { p: ParametroEditor; valor: unknown; onCambio: (v: unknown) => void; disabled?: boolean }) {
  const [cambiando, setCambiando] = useState(false);
  const delEvento = valor === LEAD_DEL_EVENTO || (valor === undefined && p.obligatorio === true);
  if (delEvento && !cambiando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)' }}>
        <span>Sobre el lead de este flujo</span>
        <span aria-hidden style={{ color: 'var(--faint)' }}>·</span>
        <button type="button" onClick={() => setCambiando(true)} disabled={disabled} style={botonTexto}>Cambiar</button>
      </div>
    );
  }
  return <SelectorLead p={p} valor={valor} onCambio={onCambio} disabled={disabled} />;
}

function SelectorLead({ p, valor, onCambio, disabled }: { p: ParametroEditor; valor: unknown; onCambio: (v: unknown) => void; disabled?: boolean }) {
  // El modo se GUARDA, no se deduce de un campo vacío: «Otro lead» sin id vuelve como
  // LEAD_A_ELEGIR. Antes se guardaba '' y se borraba, así que el desplegable volvía solo a
  // «El lead del evento» y la acción corría sobre ese lead.
  const modo = typeof valor === 'number' || valor === LEAD_A_ELEGIR ? 'otro'
    : valor === LEAD_DEL_EVENTO || p.obligatorio ? 'evento' : 'ninguno';
  const opciones = [
    { value: 'evento', label: 'El lead del evento' },
    { value: 'otro', label: 'Otro lead (por id)' },
    // Un lead opcional vacío es «ninguno» (lib/api-mako/flujo-params.ts, paramsDelPaso).
    ...(p.obligatorio ? [] : [{ value: 'ninguno', label: 'Ninguno' }]),
  ];
  return (
    <Field label={rotuloDeParametro(p)} required={p.obligatorio} error={modo === 'otro' && typeof valor !== 'number' ? 'Falta el id.' : undefined}>
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

/** Un parámetro con SU control (`controlDe`, lib/editor-acciones.ts). */
function CampoParametro({ p, required, params, cambiar, opciones, pideLead, disabled }: {
  p: ParametroEditor; required: boolean; params: Record<string, unknown>; cambiar: Cambiar;
  opciones: OpcionesAccion | undefined; pideLead: boolean; disabled?: boolean;
}) {
  const label = rotuloDeParametro(p);
  const valor = params[p.nombre];
  const onCambio = (v: unknown) => cambiar({ [p.nombre]: v });
  const [crudo, setCrudo] = useState<string>(() => (p.tipo === 'object' || p.tipo === 'object[]') && valor != null ? JSON.stringify(valor, null, 1) : '');
  const [jsonMal, setJsonMal] = useState(false);
  const comun = { label, required, disabled };

  switch (controlDe(p)) {
    case 'lead':
      return pideLead ? <SelectorLead p={p} valor={valor} onCambio={onCambio} disabled={disabled} /> : null;
    case 'etapa':
      return <SelectorEtapa {...comun} params={params} opciones={opciones} cambiar={cambiar} />;
    case 'producto':
      return <SelectorProducto {...comun} valor={valor} opciones={opciones} onCambio={onCambio} />;
    case 'secuencia':
      return <SelectorSecuencia {...comun} valor={valor} opciones={opciones} onCambio={onCambio} />;
    case 'persona':
      return <SelectorPersona {...comun} valor={valor} opciones={opciones} onCambio={onCambio} />;
    case 'monto':
      return <CampoMonto {...comun} valor={valor} moneda={monedaDe(p) ?? ''} onCambio={onCambio} title={p.descripcion} />;
    case 'etiqueta':
      return (
        <Field label={label} required={required}>
          <SelectorEtiqueta value={typeof valor === 'number' ? valor : null} onElegir={(e) => onCambio(e.id)}
            placeholder="Elige una etiqueta" ariaLabel="Etiqueta" width="100%" disabled={disabled} />
        </Field>
      );
    case 'fecha':
      return (
        <Field label={label} required={required}>
          <Input type="date" value={typeof valor === 'string' ? valor : ''} disabled={disabled} title={p.descripcion} onChange={(e) => onCambio(e.target.value || undefined)} />
        </Field>
      );
    case 'si_no':
      // Un sí/no OBLIGATORIO no es una casilla: destildada se lee «no», y sin tocarla el paso no tiene valor.
      return (
        <Select label={label} required={required} value={valor === true ? 'si' : valor === false ? 'no' : ''} onChange={(v) => onCambio(v === 'si')}
          options={[{ value: 'si', label: 'Sí' }, { value: 'no', label: 'No' }]} placeholder="Elige" disabled={disabled} />
      );
    case 'casilla':
      return <Checkbox checked={valor === true} onChange={(v) => onCambio(v)} label={label} disabled={disabled} />;
    case 'varias': {
      // Una lista con opciones cerradas se elige con VARIOS (guardar_diagnostico_fase pide seis).
      const lista = Array.isArray(valor) ? (valor as string[]) : [];
      return (
        <Select label={label} required={required} value="" placeholder="Elige" varios={lista}
          onChange={(v) => onCambio(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v])}
          options={(p.enum ?? []).map((e) => ({ value: e, label: rotuloDeOpcion(e) }))} disabled={disabled} />
      );
    }
    case 'opcion':
      return (
        <Select label={label} required={required} value={typeof valor === 'string' ? valor : ''} onChange={(v) => onCambio(v)}
          options={(p.enum ?? []).map((e) => ({ value: e, label: rotuloDeOpcion(e) }))} placeholder="Elige" disabled={disabled} />
      );
    case 'numero':
      return (
        <Field label={label} required={required}>
          <Input type="number" value={typeof valor === 'number' ? String(valor) : ''} disabled={disabled} title={p.descripcion}
            onChange={(e) => onCambio(e.target.value === '' ? undefined : Number(e.target.value))} />
        </Field>
      );
    case 'lista':
      return (
        <Field label={label} required={required} hint="Separados por coma.">
          <Input value={Array.isArray(valor) ? valor.join(', ') : ''} disabled={disabled} title={p.descripcion}
            onChange={(e) => onCambio(e.target.value.split(',').map((x) => x.trim()).filter(Boolean))} />
        </Field>
      );
    case 'json':
      return (
        <Field label={label} required={required} error={jsonMal ? (p.tipo === 'object' ? 'Tiene que ser un objeto { … }.' : 'Tiene que ser una lista [ { … } ].') : undefined}>
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
    case 'texto_largo':
      return (
        <Field label={label} required={required}>
          <Textarea rows={3} value={typeof valor === 'string' ? valor : ''} disabled={disabled} title={p.descripcion} onChange={(e) => onCambio(e.target.value)} />
        </Field>
      );
    case 'texto':
      return (
        <Field label={label} required={required}>
          <Input value={typeof valor === 'string' ? valor : ''} disabled={disabled} title={p.descripcion} onChange={(e) => onCambio(e.target.value)} />
        </Field>
      );
  }
}
