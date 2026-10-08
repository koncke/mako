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
// ── Segunda tanda (08/10/2026, punto 7): «El editor de Acción esta muy complejo, simplificalo…
// sobre todo el desplegable de acciones… Tener barra de busqueda y también que sea modular, como
// tenemos el desplegable de Plan, de una sección se abren opciones.» Vino con la captura de
// «Avisar al equipo» mostrando «Lead» y «Respuesta» a la vista. Lo que cambió:
//   · EL SELECTOR VA POR SECCIONES (`Select secciones`, el patrón del filtro del Plan que ya vivía
//     en el Dropdown): «Más usadas», «Con este lead», una por área y «Avanzado» con las que piden
//     JSON. El buscador aplana. Cada renglón dice qué hace en una línea. Las secciones las arma
//     `seccionesDeAcciones` (lib/editor-acciones.ts), pura y con test.
//   · DEBAJO, LA ACCIÓN ELEGIDA CON UNA LÍNEA DE QUÉ HACE. Ya no hay rótulo «Acción» ni la glosa
//     «Corre sola…»: la tarjeta ya dice que es una acción.
//   · LO QUE LLENA EL FLUJO NO SE DIBUJA: el `respuesta` del aviso (LLENA_EL_FLUJO, la misma lista
//     que lee el motor) y el lead cuando es el del evento, que queda como una línea «Sobre el lead
//     de este flujo · Cambiar».
//   · LO OBLIGATORIO A LA VISTA Y LO OPCIONAL PLEGADO detrás de «Más opciones».
//   · LOS RÓTULOS CON TILDES DESDE UN LUGAR (`rotuloDeParametro`): antes se derivaban acá del
//     camelCase y salían «Titulo», «Razon», «Anio».
//
// El lead: si la acción pide `leadId`, el default es «el lead del evento» (el que entró, el
// que agendó, el de la inscripción). Al ELEGIR una acción que pide lead se guarda
// LEAD_DEL_EVENTO explícito, también si el lead es opcional: sin eso un «Avisar al equipo»
// recién elegido nacía en «Ninguno» y el aviso salía sin el nombre ni el link del lead, al
// revés de lo que decía este mismo encabezado. La excepción es la acción con OTRO destinatario
// (un teléfono): ahí el lead del evento chocaba con él (`naceSobreElLeadDelEvento`,
// lib/editor-acciones.ts). «Ninguno» y «el del evento» siguen a un clic («Cambiar»).
//
// La etiqueta: un `etiquetaId` (poner_etiqueta_lead, sacar_etiqueta_lead, editar y archivar) se
// ELIGE de un desplegable con las etiquetas del CRM y «＋ Nueva», nunca se tipea como número: el
// id es lo que se guarda (renombrar la etiqueta no rompe el paso) y el nombre es lo que se ve.
// =============================================================================

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Select, Input, Textarea, Checkbox, Field } from '@/app/_ui';
import type { AccionEditor, ParametroEditor } from '@/lib/api-mako/flujo';
import { LEAD_DEL_EVENTO, LEAD_A_ELEGIR, LLENA_EL_FLUJO } from '@/lib/api-mako/flujo-params';
import { rotuloDeParametro, resumenDeAccion, seccionesDeAcciones, repartoDelFormulario, naceSobreElLeadDelEvento } from '@/lib/editor-acciones';
import { SelectorEtiqueta } from './etiquetas-cliente';

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

const ES_TEXTO_LARGO = /texto|mensaje|nota|detalle|descripcion|cuerpo|contenido/i;

/** Los parámetros que pone el flujo para esta operación: no se dibujan. */
const ocultosDe = (operacion: string): ReadonlySet<string> => new Set(Object.keys(LLENA_EL_FLUJO[operacion] ?? {}));

/** Lo que se guarda al ELEGIR una acción: vacío, salvo el lead del evento cuando es el default. */
const paramsIniciales = (a: Pick<AccionEditor, 'pideLead' | 'parametros'> | undefined): Record<string, unknown> =>
  (a?.pideLead && naceSobreElLeadDelEvento(a.parametros) ? { leadId: LEAD_DEL_EVENTO } : {});

const tieneValor = (v: unknown): boolean => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length);

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
  const secciones = useMemo(() => {
    if (!acciones) return [];
    const out = seccionesDeAcciones(acciones).map((s) => ({
      title: s.titulo,
      atajo: s.atajo,
      options: s.acciones.map((a) => ({ value: a.id, label: a.titulo, sub: resumenDeAccion(a.descripcion), buscar: `${a.id} ${a.descripcion}` })),
    }));
    // ⚠️ LA QUE ESTÁ PUESTA ENTRA AUNQUE YA NO SE PUEDA ELEGIR (otra capa, una operación que se
    // retiró): un desplegable cuyo valor no está entre sus opciones no muestra nada (AGENTS.md).
    if (valor.operacion && !acciones.some((a) => a.id === valor.operacion)) {
      out.unshift({ title: 'La que tiene puesta', atajo: undefined, options: [{ value: valor.operacion, label: valor.operacion.replace(/_/g, ' '), sub: 'Ya no está en el catálogo', buscar: valor.operacion }] });
    }
    return out;
  }, [acciones, valor.operacion]);

  const params = valor.params ?? {};
  const fijar = (nombre: string, v: unknown) => {
    const p = { ...params };
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) delete p[nombre]; else p[nombre] = v;
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
          search
          disabled={disabled}
          ariaLabel="Acción"
          menuAncho={420}
          menuAlto={460}
        />
        {elegida && <p style={{ margin: '0 2px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.45 }}>{resumenDeAccion(elegida.descripcion)}</p>}
      </div>
      {/* `key` por operación: lo plegado y el «Cambiar» del lead son de ESTA acción. */}
      {elegida && <FormularioAccion key={elegida.id} accion={elegida} valor={valor} params={params} fijar={fijar} disabled={disabled} />}
    </div>
  );
}

/** El formulario de UNA acción ya elegida (exportado para tests/editor-acciones.test.ts). */
export function FormularioAccion({ accion, valor, params, fijar, disabled }: {
  accion: AccionEditor; valor: ValorAccion; params: Record<string, unknown>;
  fijar: (nombre: string, v: unknown) => void; disabled?: boolean;
}) {
  const { lead, obligatorios, opcionales } = repartoDelFormulario(accion.parametros, accion.pideLead, ocultosDe(accion.id));
  // Abierto de entrada si algo de lo plegado ya tiene valor: plegar lo que está puesto lo esconde.
  const [mas, setMas] = useState(() => opcionales.some((p) => tieneValor(params[p.nombre])));
  const campo = (p: ParametroEditor) => (
    <CampoParametro key={`${valor.operacion ?? ''}:${p.nombre}`} p={p} valor={params[p.nombre]} onCambio={(v) => fijar(p.nombre, v)} pideLead={accion.pideLead} disabled={disabled} />
  );
  return (
    <>
      {lead && <FilaLead p={lead} valor={params.leadId} onCambio={(v) => fijar('leadId', v)} disabled={disabled} />}
      {obligatorios.map(campo)}
      {opcionales.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button type="button" onClick={() => setMas((m) => !m)} aria-expanded={mas} style={{ ...botonTexto, alignSelf: 'flex-start' }}>
            {mas ? 'Menos opciones ▴' : 'Más opciones ▾'}
          </button>
          {mas && opcionales.map(campo)}
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
  return <CampoParametro p={p} valor={valor} onCambio={onCambio} pideLead disabled={disabled} />;
}

function CampoParametro({ p, valor, onCambio, pideLead, disabled }: {
  p: ParametroEditor; valor: unknown; onCambio: (v: unknown) => void; pideLead: boolean; disabled?: boolean;
}) {
  const label = rotuloDeParametro(p);
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
      <Field label={label} required={p.obligatorio} error={modo === 'otro' && typeof valor !== 'number' ? 'Falta el id.' : undefined}>
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
  if (p.nombre === 'etiquetaId' && p.tipo === 'number') {
    return (
      <Field label={label} required={p.obligatorio}>
        <SelectorEtiqueta value={typeof valor === 'number' ? valor : null} onElegir={(e) => onCambio(e.id)}
          placeholder="Elige una etiqueta" ariaLabel="Etiqueta" width="100%" disabled={disabled} />
      </Field>
    );
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
