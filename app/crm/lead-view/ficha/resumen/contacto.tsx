'use client';

// =============================================================================
// ficha/resumen/contacto — cómo se le habla: el contacto, las redes y la web, la dirección y el sexo
// =============================================================================
// Reemplaza a InfoPrincipalCard en la ficha del CRM (16/10/2026: «completamente diferente en diseño y funcionalidad»).
// InfoPrincipalCard sigue viva para la ficha de Customer Success, que todavía no está en bloques.
//
// LA REFERENCIA: los «Record details» de Attio (una lista de propiedades: el rótulo a la izquierda, el valor a la
// derecha, la fila entera se edita en el lugar) y, en la botonera, las acciones de un registro de HubSpot (llamar,
// escribir, mandar un email arriba de todo). Documentación oficial; no se entró a las apps.
//
// LO QUE CAMBIA respecto de la tarjeta vieja:
//   · El contacto ya no repite el NOMBRE (está en la cabecera, que lo edita) ni carga las redes, la dirección, el sexo
//     y el ingreso: cada uno es SU bloque, y el admin decide si va. La cohorte sigue acá hasta que Reuniones tenga su
//     bloque (`incluye: ['cohorte']`, ../reglas-resumen.ts).
//   · Tres diseños: la lista de propiedades, un renglón de chips y la BOTONERA grande (Llamar · WhatsApp · Email).
//   · Lo que se escribe es lo de siempre: `saveLeadMetaAction` con «Deshacer» y su línea en el historial, el teléfono
//     con el país primero (`TelefonoEditable`), Instagram normalizado (`InstagramEditable`), el WhatsApp por la línea
//     NO oficial (el envío de InfoPrincipalCard, `EnviarNoOficial`, exportado: no una copia).
// =============================================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { Dropdown } from '@/app/components/Dropdown';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { hrefDeWeb } from '@/lib/contacto-lead';
import { marcaDato } from '@/lib/datos-aviso';
import { SEXOS, seVe } from '@/lib/resumen-ficha';
import { REDES, type Red } from '@/lib/ficha/catalogo';
import { datosDelPuesto } from '@/lib/ficha/config';
import { telHref } from '@/app/m/crm/reglas';
import { linkInstagram, usuarioInstagram } from '@/app/crm/campo-inline';
import { InstagramEditable, TelefonoEditable } from '../../CampoEditable';
import { EnviarNoOficial } from '../../InfoPrincipalCard';
import type { PropsBloque } from '../tipos';
import { paginaLegible } from './logica';
import { Bloque, BotonIco, IcoAbrir, IcoCopiar, IcoEmail, IcoRed, Prop, useCopiar, useGuardarMeta } from './piezas';

const gmail = (email: string) => `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;

/**
 * UN DATO DE UN BLOQUE DE CHIPS, EDITABLE AHÍ MISMO (24/10/2026). Martín, 05/10: «Sería bueno que ya no exista el botón de
 * "editar" en la ruta de cada lead, sino que simplemente en cada campo un lapiz». Los bloques de chips («Renglón» de Contacto
 * y Redes y web) todavía tenían un «Editar» que pasaba el bloque entero a filas. Ahora cada chip lleva su lápiz (y el «+ Dato»
 * de lo que falta hace lo mismo): ESE dato, y sólo ése, pasa a su editor de siempre, ya abierto. Guarda como guarda ese
 * editor (Enter, o un clic afuera; Escape descarta) y vuelve a ser chip solo.
 * Los editores se abren desde su botón `[data-campo-abrir]` (teléfono, Instagram) o son el texto mismo (`.edin`), y marcan
 * `[data-campo-editando]` mientras están abiertos: por eso se sabe cuándo terminó.
 */
function DatoEnChip({ editando, onEditar, onListo, chip, editor, nombre, marca, dato }: {
  /** Qué dato del bloque es este chip: personalizando, la ✕ para sacarlo (ver `Prop`). */
  dato?: string;
  editando: boolean;
  onEditar: () => void;
  onListo: () => void;
  /** El chip con el dato, o null si falta (se dibuja «+ Nombre»). */
  chip: ReactNode | null;
  editor: ReactNode;
  nombre: string;
  marca?: string;
}) {
  const caja = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!editando) return;
    const el = caja.current;
    if (!el) return;
    const abrir = el.querySelector<HTMLElement>('[data-campo-abrir]');
    if (abrir) abrir.click(); else el.querySelector<HTMLElement>('.edin')?.focus();
  }, [editando]);
  // Terminó cuando el editor ya no está abierto y el foco salió: después del evento, cuando el editor ya cerró.
  const siTermino = () => setTimeout(() => {
    const el = caja.current;
    if (!el || el.querySelector('[data-campo-editando]') || el.contains(document.activeElement)) return;
    onListo();
  }, 0);
  if (editando) {
    return (
      <span ref={caja} className="fr-chip fr-chip--editando" onBlur={siTermino}
        onKeyUp={(e) => { if (e.key === 'Enter' || e.key === 'Escape') siTermino(); }}>
        {editor}
      </span>
    );
  }
  if (!chip) return <button type="button" className="fr-chip fr-chip--falta" onClick={onEditar} data-recorrido={marca} data-dato={dato} data-dato-nombre={dato ? nombre : undefined}>+ {nombre}</button>;
  return (
    <span className="fr-chip-dato" data-dato={dato} data-dato-nombre={dato ? nombre : undefined}>
      {chip}
      <button type="button" className="fr-lapiz" onClick={onEditar} title={`Editar ${nombre}`} aria-label={`Editar ${nombre}`}>
        <IconoMenu nombre="editar" size={13} />
      </button>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Contacto
// ─────────────────────────────────────────────────────────────────────────────

export function Contacto({ ctx, puesto, def, titulo, diseno, epico }: PropsBloque) {
  const { lead, data } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  // LOS DATOS QUE VAN (23/10/2026, «Datos ▾» de la barra): de entrada teléfono, email y empresa; la persona saca los que
  // no usa y suma redes o la dirección. Martín: «no puedo decidir sacar a empresa o agregar otra cosa».
  const va = new Set(datosDelPuesto(def, puesto.opciones));
  const extras = datosDelPuesto(def, puesto.opciones).filter((x): x is Red | 'direccion' => (REDES as readonly string[]).includes(x) || x === 'direccion');
  const { copiado, copiar } = useCopiar();
  /** El dato que se está editando en un bloque de chips (sólo uno por vez). */
  const [editando, setEditando] = useState<string | null>(null);
  const tel = lead.telefono && lead.telefono !== '—' ? lead.telefono : null;
  const email = lead.email?.trim() || null;
  const nombre = lead.nombre?.trim() || 'el lead';
  // La cohorte, como la mostraba la tarjeta: sólo si el negocio no la apagó (`crm.resumen.campos`).
  const cohorte = data.cohorte && seVe(data.resumen ?? {}, 'cohorte') ? data.cohorte : null;

  const ig = usuarioInstagram(lead.instagram);
  const verExtra = (x: Red | 'direccion'): string | null => {
    if (x === 'instagram') return ig ? `@${ig}` : null;
    const v = (lead[x] as string | null | undefined)?.trim() || null;
    return v && x !== 'direccion' ? paginaLegible(v) : v;
  };
  const hrefExtra = (x: Red | 'direccion'): string | null => (x === 'instagram' ? linkInstagram(ig) : x === 'direccion'
    ? (lead.direccion?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.direccion.trim())}` : null)
    : hrefDeWeb((lead[x] as string | null | undefined)?.trim() || null));
  const filas = (
    <div className="fr-props">
      {va.has('telefono') && <Prop k="Teléfono" dato="telefono" editable marca={marcaDato('telefono')} acciones={tel ? (
        <>
          <BotonIco titulo={copiado === 'tel' ? 'Copiado' : 'Copiar'} onClick={() => copiar(tel, 'tel')}><IcoCopiar /></BotonIco>
          <EnviarNoOficial leadId={lead.id} nombre={nombre} telefono={tel} />
        </>
      ) : null}>
        <TelefonoEditable valor={tel} onGuardar={guardar('telefono', lead.telefono)} />
      </Prop>}
      {va.has('email') && <Prop k="Email" dato="email" editable acciones={email ? (
        <>
          <BotonIco titulo={copiado === 'email' ? 'Copiado' : 'Copiar'} onClick={() => copiar(email, 'email')}><IcoCopiar /></BotonIco>
          <BotonIco titulo="Escribir por Gmail" href={gmail(email)}><IcoEmail /></BotonIco>
        </>
      ) : null}>
        <EditableInline valor={email ?? ''} onGuardar={guardar('email', lead.email)} placeholder="—" titulo="Edita el email" maxLargo={200} />
      </Prop>}
      {va.has('empresa') && <Prop k="Empresa" dato="empresa" editable marca={marcaDato('empresa')}>
        <EditableInline valor={lead.empresa ?? ''} onGuardar={guardar('empresa', lead.empresa)} placeholder="—" titulo="Edita la empresa" maxLargo={120} />
      </Prop>}
      {extras.map((x) => (
        <Prop key={x} k={NOMBRE_EXTRA[x]} dato={x} editable acciones={hrefExtra(x) ? <BotonIco titulo={`Abrir ${NOMBRE_EXTRA[x]}`} href={hrefExtra(x)}><IcoAbrir /></BotonIco> : null}>
          {x === 'instagram'
            ? <InstagramEditable leadId={lead.id} valor={lead.instagram ?? null} />
            : <EditableInline valor={(lead[x] as string | null | undefined) ?? ''} onGuardar={guardar(x, (lead[x] as string | null | undefined) ?? null)} placeholder="—" titulo={`Edita ${NOMBRE_EXTRA[x]}`} maxLargo={300} />}
        </Prop>
      ))}
      {cohorte && (
        <Prop k="Cohorte">
          <span style={{ color: cohorte.color }}>{cohorte.label}</span>
          {cohorte.texto && <span className="fr-sub" style={{ fontWeight: 500 }}> · {cohorte.texto}</span>}
        </Prop>
      )}
    </div>
  );

  if (diseno === 'botonera') {
    const llamar = telHref(tel);
    return (
      <Bloque titulo={titulo} epico={epico}>
        <div className="fr-botonera">
          {!va.has('telefono') ? null : llamar
            ? <a className="fr-boton" href={llamar}><IconoMenu nombre="telefono" size={epico ? 26 : 20} />Llamar</a>
            : <span className="fr-boton" aria-disabled="true" title="Sin teléfono"><IconoMenu nombre="telefono" size={epico ? 26 : 20} />Llamar</span>}
          {!va.has('telefono') ? null : tel
            ? <EnviarNoOficial leadId={lead.id} nombre={nombre} telefono={tel} boton={(abrir) => (
                <button type="button" className="fr-boton" onClick={abrir}><IconoMenu nombre="whatsapp" size={epico ? 26 : 20} />WhatsApp</button>
              )} />
            : <span className="fr-boton" aria-disabled="true" title="Sin teléfono"><IconoMenu nombre="whatsapp" size={epico ? 26 : 20} />WhatsApp</span>}
          {!va.has('email') ? null : email
            ? <a className="fr-boton" href={gmail(email)} target="_blank" rel="noopener noreferrer"><IconoMenu nombre="email" size={epico ? 26 : 20} />Email</a>
            : <span className="fr-boton" aria-disabled="true" title="Sin email"><IconoMenu nombre="email" size={epico ? 26 : 20} />Email</span>}
        </div>
        {filas}
        {aviso}
      </Bloque>
    );
  }

  if (diseno === 'renglon') {
    // Sin «Editar»: cada chip tiene su lápiz y lo que falta, su «+ Dato» (`DatoEnChip`, arriba).
    const dato = (k: string, nombre: string, chip: ReactNode | null, editor: ReactNode, marca?: string) => (
      <DatoEnChip key={k} dato={k} editando={editando === k} onEditar={() => setEditando(k)} onListo={() => setEditando((e) => (e === k ? null : e))}
        chip={chip} editor={editor} nombre={nombre} marca={marca} />
    );
    return (
      <Bloque titulo={titulo} epico={epico}>
        <div className="fr-chips">
          {va.has('telefono') && dato('telefono', 'Teléfono',
            tel ? <a className="fr-chip" href={telHref(tel) ?? undefined}><IconoMenu nombre="telefono" size={14} />{tel}</a> : null,
            <TelefonoEditable valor={tel} onGuardar={guardar('telefono', lead.telefono)} />, marcaDato('telefono'))}
          {va.has('email') && dato('email', 'Email',
            email ? <a className="fr-chip" href={gmail(email)} target="_blank" rel="noopener noreferrer"><IconoMenu nombre="email" size={14} />{email}</a> : null,
            <EditableInline valor={email ?? ''} onGuardar={guardar('email', lead.email)} placeholder="—" titulo="Edita el email" maxLargo={200} />)}
          {va.has('empresa') && dato('empresa', 'Empresa',
            lead.empresa?.trim() ? <span className="fr-chip"><IconoMenu nombre="cliente" size={14} />{lead.empresa}</span> : null,
            <EditableInline valor={lead.empresa ?? ''} onGuardar={guardar('empresa', lead.empresa)} placeholder="—" titulo="Edita la empresa" maxLargo={120} />, marcaDato('empresa'))}
          {extras.map((x) => {
            const v = verExtra(x);
            const h = hrefExtra(x);
            const chip = v ? (h
              ? <a className="fr-chip" href={h} target="_blank" rel="noopener noreferrer" title={`Abrir ${NOMBRE_EXTRA[x]}`}>{x === 'direccion' ? <IconoMenu nombre="fijar" size={14} /> : <IcoRed red={x} />}{v}</a>
              : <span className="fr-chip">{x === 'direccion' ? <IconoMenu nombre="fijar" size={14} /> : <IcoRed red={x} />}{v}</span>) : null;
            return dato(x, NOMBRE_EXTRA[x], chip, x === 'instagram'
              ? <InstagramEditable leadId={lead.id} valor={lead.instagram ?? null} />
              : <EditableInline valor={(lead[x] as string | null | undefined) ?? ''} onGuardar={guardar(x, (lead[x] as string | null | undefined) ?? null)} placeholder="—" titulo={`Edita ${NOMBRE_EXTRA[x]}`} maxLargo={300} />);
          })}
        </div>
        {aviso}
      </Bloque>
    );
  }

  return <Bloque titulo={titulo} epico={epico}>{filas}{aviso}</Bloque>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redes y web
// ─────────────────────────────────────────────────────────────────────────────

const NOMBRE_RED: Readonly<Record<Red, string>> = { web: 'Web', instagram: 'Instagram', youtube: 'YouTube', linkedin: 'LinkedIn' };
/** Lo que el contacto suma si se elige: las redes y la dirección (también tienen su bloque aparte). */
const NOMBRE_EXTRA: Readonly<Record<Red | 'direccion', string>> = { ...NOMBRE_RED, direccion: 'Dirección' };

/** Las redes del bloque, en su orden (sin elegir: las cuatro). Las elige el admin en «Personalizar» (Opciones). */
export const redesDelBloque = (p: PropsBloque['puesto']): readonly Red[] => p.opciones?.redes ?? REDES;

export function RedesYWeb({ ctx, puesto, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  /** La red que se está editando en el diseño de chips (sólo una por vez). */
  const [editando, setEditando] = useState<Red | null>(null);
  const redes = redesDelBloque(puesto);
  const ig = usuarioInstagram(lead.instagram);
  const crudo = (r: Red): string | null => (r === 'instagram' ? ig : (lead[r] as string | null | undefined)?.trim() || null);
  const ver = (r: Red): string | null => { const v = crudo(r); return v ? (r === 'instagram' ? `@${v}` : paginaLegible(v)) : null; };
  const href = (r: Red): string | null => (r === 'instagram' ? linkInstagram(ig) : hrefDeWeb(crudo(r)));

  const filas = (
    <div className="fr-props">
      {redes.map((r) => (
        <Prop key={r} k={NOMBRE_RED[r]} dato={r} editable acciones={href(r) ? <BotonIco titulo={`Abrir ${NOMBRE_RED[r]}`} href={href(r)}><IcoAbrir /></BotonIco> : null}>
          {r === 'instagram'
            ? <InstagramEditable leadId={lead.id} valor={lead.instagram ?? null} />
            : <EditableInline valor={(lead[r] as string | null | undefined) ?? ''} onGuardar={guardar(r, (lead[r] as string | null | undefined) ?? null)} placeholder="—" titulo={`Edita ${NOMBRE_RED[r]}`} maxLargo={300} />}
        </Prop>
      ))}
    </div>
  );
  if (diseno === 'filas') return <Bloque titulo={titulo} epico={epico}>{filas}{aviso}</Bloque>;
  const con = redes.filter((r) => crudo(r));
  const destacada = diseno === 'destacada' ? con[0] : undefined;
  // Sin «Editar» (Martín, 05/10): cada chip con su lápiz, y lo que falta con su «+ Red» (`DatoEnChip`).
  const chips = redes.filter((r) => r !== destacada).map((r) => {
    const v = ver(r);
    const h = href(r);
    const chip = !v ? null : h
      ? <a className="fr-chip" href={h} target="_blank" rel="noopener noreferrer" title={`Abrir ${NOMBRE_RED[r]}`}><IcoRed red={r} />{v}</a>
      : <span className="fr-chip"><IcoRed red={r} />{v}</span>;
    return (
      <DatoEnChip key={r} dato={r} editando={editando === r} onEditar={() => setEditando(r)} onListo={() => setEditando((e) => (e === r ? null : e))}
        chip={chip} nombre={NOMBRE_RED[r]} editor={r === 'instagram'
          ? <InstagramEditable leadId={lead.id} valor={lead.instagram ?? null} />
          : <EditableInline valor={(lead[r] as string | null | undefined) ?? ''} onGuardar={guardar(r, (lead[r] as string | null | undefined) ?? null)} placeholder="—" titulo={`Edita ${NOMBRE_RED[r]}`} maxLargo={300} />} />
    );
  });
  return (
    <Bloque titulo={titulo} epico={epico}>
      {destacada && (
        <div className="fr-dato">
          <span className="fr-sub"><IcoRed red={destacada} size={14} /> {NOMBRE_RED[destacada]}</span>
          {href(destacada)
            ? <a className={epico ? 'fr-p' : 'fr-num'} href={href(destacada)!} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'var(--ink)' }}>{ver(destacada)}</a>
            : <span className={epico ? 'fr-p' : 'fr-num'}>{ver(destacada)}</span>}
        </div>
      )}
      {chips.length > 0 && <div className="fr-chips">{chips}</div>}
      {aviso}
    </Bloque>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dirección y sexo
// ─────────────────────────────────────────────────────────────────────────────

export function Direccion({ ctx, titulo, epico }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  const dir = lead.direccion?.trim() || null;
  const mapa = dir ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dir)}` : null;
  return (
    <Bloque titulo={titulo} epico={epico}>
      <div className="fr-props">
        <Prop k="Dirección" editable acciones={mapa ? <BotonIco titulo="Ver en el mapa" href={mapa}><IconoMenu nombre="fijar" size={15} /></BotonIco> : null}>
          <EditableInline valor={dir ?? ''} onGuardar={guardar('direccion', lead.direccion ?? null)} placeholder="—" titulo="Edita la dirección" maxLargo={300} />
        </Prop>
      </div>
      {aviso}
    </Bloque>
  );
}

export function Sexo({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  const actual = lead.sexo ?? null;
  const elegir = guardar('sexo', actual);
  if (diseno === 'chip') {
    // Los tres a la vista; tocar el elegido lo borra («sin dato»).
    return (
      <Bloque titulo={titulo} epico={epico}>
        <span className="fr-seg fr-seg--llena" role="group" aria-label="Sexo del lead">
          {SEXOS.map((s) => (
            <button key={s.id} type="button" aria-pressed={actual === s.id} onClick={() => elegir(actual === s.id ? '' : s.id)}>{s.label}</button>
          ))}
        </span>
        {aviso}
      </Bloque>
    );
  }
  return (
    <Bloque titulo={titulo} epico={epico}>
      <div className="fr-props">
        <Prop k="Sexo">
          <span data-no-abre>
            <Dropdown value={actual ?? ''} placeholder="—" width={160} ariaLabel="Sexo del lead" onChange={(v) => elegir(v)}
              options={[...SEXOS.map((s) => ({ value: s.id, label: s.label })), ...(actual ? [{ value: '', label: 'Sin dato', sutil: true }] : [])]} />
          </span>
        </Prop>
      </div>
      {aviso}
    </Bloque>
  );
}
