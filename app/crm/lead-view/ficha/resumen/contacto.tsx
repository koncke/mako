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

import { useState } from 'react';
import { EditableInline } from '@/app/_components/EditableInline';
import { Dropdown } from '@/app/components/Dropdown';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { hrefDeWeb } from '@/lib/contacto-lead';
import { marcaDato } from '@/lib/datos-aviso';
import { SEXOS, seVe } from '@/lib/resumen-ficha';
import { REDES, type Red } from '@/lib/ficha/catalogo';
import { telHref } from '@/app/m/crm/reglas';
import { linkInstagram, usuarioInstagram } from '@/app/crm/campo-inline';
import { InstagramEditable, TelefonoEditable } from '../../CampoEditable';
import { EnviarNoOficial } from '../../InfoPrincipalCard';
import type { PropsBloque } from '../tipos';
import { paginaLegible } from './logica';
import { Bloque, BotonIco, IcoAbrir, IcoCopiar, IcoEmail, IcoRed, Prop, useCopiar, useGuardarMeta } from './piezas';

const gmail = (email: string) => `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;

// ─────────────────────────────────────────────────────────────────────────────
// Contacto
// ─────────────────────────────────────────────────────────────────────────────

export function Contacto({ ctx, titulo, diseno, epico }: PropsBloque) {
  const { lead, data } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  const { copiado, copiar } = useCopiar();
  const [editar, setEditar] = useState(false);
  const tel = lead.telefono && lead.telefono !== '—' ? lead.telefono : null;
  const email = lead.email?.trim() || null;
  const nombre = lead.nombre?.trim() || 'el lead';
  // La cohorte, como la mostraba la tarjeta: sólo si el negocio no la apagó (`crm.resumen.campos`).
  const cohorte = data.cohorte && seVe(data.resumen ?? {}, 'cohorte') ? data.cohorte : null;

  const filas = (
    <div className="fr-props">
      <Prop k="Teléfono" editable marca={marcaDato('telefono')} acciones={tel ? (
        <>
          <BotonIco titulo={copiado === 'tel' ? 'Copiado' : 'Copiar'} onClick={() => copiar(tel, 'tel')}><IcoCopiar /></BotonIco>
          <EnviarNoOficial leadId={lead.id} nombre={nombre} telefono={tel} />
        </>
      ) : null}>
        <TelefonoEditable valor={tel} onGuardar={guardar('telefono', lead.telefono)} />
      </Prop>
      <Prop k="Email" editable acciones={email ? (
        <>
          <BotonIco titulo={copiado === 'email' ? 'Copiado' : 'Copiar'} onClick={() => copiar(email, 'email')}><IcoCopiar /></BotonIco>
          <BotonIco titulo="Escribir por Gmail" href={gmail(email)}><IcoEmail /></BotonIco>
        </>
      ) : null}>
        <EditableInline valor={email ?? ''} onGuardar={guardar('email', lead.email)} placeholder="—" titulo="Edita el email" maxLargo={200} />
      </Prop>
      <Prop k="Empresa" editable marca={marcaDato('empresa')}>
        <EditableInline valor={lead.empresa ?? ''} onGuardar={guardar('empresa', lead.empresa)} placeholder="—" titulo="Edita la empresa" maxLargo={120} />
      </Prop>
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
          {llamar
            ? <a className="fr-boton" href={llamar}><IconoMenu nombre="telefono" size={epico ? 26 : 20} />Llamar</a>
            : <span className="fr-boton" aria-disabled="true" title="Sin teléfono"><IconoMenu nombre="telefono" size={epico ? 26 : 20} />Llamar</span>}
          {tel
            ? <EnviarNoOficial leadId={lead.id} nombre={nombre} telefono={tel} boton={(abrir) => (
                <button type="button" className="fr-boton" onClick={abrir}><IconoMenu nombre="whatsapp" size={epico ? 26 : 20} />WhatsApp</button>
              )} />
            : <span className="fr-boton" aria-disabled="true" title="Sin teléfono"><IconoMenu nombre="whatsapp" size={epico ? 26 : 20} />WhatsApp</span>}
          {email
            ? <a className="fr-boton" href={gmail(email)} target="_blank" rel="noopener noreferrer"><IconoMenu nombre="email" size={epico ? 26 : 20} />Email</a>
            : <span className="fr-boton" aria-disabled="true" title="Sin email"><IconoMenu nombre="email" size={epico ? 26 : 20} />Email</span>}
        </div>
        {filas}
        {aviso}
      </Bloque>
    );
  }

  if (diseno === 'renglon') {
    return (
      <Bloque titulo={titulo} epico={epico} derecha={<button type="button" className="fr-link" onClick={() => setEditar((v) => !v)}>{editar ? 'Listo' : 'Editar'}</button>}>
        {editar ? filas : (
          <div className="fr-chips">
            {tel ? <a className="fr-chip" href={telHref(tel) ?? undefined}><IconoMenu nombre="telefono" size={14} />{tel}</a>
              : <button type="button" className="fr-chip fr-chip--falta" onClick={() => setEditar(true)} data-recorrido={marcaDato('telefono')}>+ Teléfono</button>}
            {email ? <a className="fr-chip" href={gmail(email)} target="_blank" rel="noopener noreferrer"><IconoMenu nombre="email" size={14} />{email}</a>
              : <button type="button" className="fr-chip fr-chip--falta" onClick={() => setEditar(true)}>+ Email</button>}
            {lead.empresa?.trim() ? <span className="fr-chip"><IconoMenu nombre="cliente" size={14} />{lead.empresa}</span>
              : <button type="button" className="fr-chip fr-chip--falta" onClick={() => setEditar(true)} data-recorrido={marcaDato('empresa')}>+ Empresa</button>}
          </div>
        )}
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

/** Las redes del bloque, en su orden (sin elegir: las cuatro). Las elige el admin en «Personalizar» (Opciones). */
export const redesDelBloque = (p: PropsBloque['puesto']): readonly Red[] => p.opciones?.redes ?? REDES;

export function RedesYWeb({ ctx, puesto, titulo, diseno, epico }: PropsBloque) {
  const { lead } = ctx;
  const { guardar, aviso } = useGuardarMeta(lead.id);
  const [editar, setEditar] = useState(false);
  const redes = redesDelBloque(puesto);
  const ig = usuarioInstagram(lead.instagram);
  const crudo = (r: Red): string | null => (r === 'instagram' ? ig : (lead[r] as string | null | undefined)?.trim() || null);
  const ver = (r: Red): string | null => { const v = crudo(r); return v ? (r === 'instagram' ? `@${v}` : paginaLegible(v)) : null; };
  const href = (r: Red): string | null => (r === 'instagram' ? linkInstagram(ig) : hrefDeWeb(crudo(r)));

  const filas = (
    <div className="fr-props">
      {redes.map((r) => (
        <Prop key={r} k={NOMBRE_RED[r]} editable acciones={href(r) ? <BotonIco titulo={`Abrir ${NOMBRE_RED[r]}`} href={href(r)}><IcoAbrir /></BotonIco> : null}>
          {r === 'instagram'
            ? <InstagramEditable leadId={lead.id} valor={lead.instagram ?? null} />
            : <EditableInline valor={(lead[r] as string | null | undefined) ?? ''} onGuardar={guardar(r, (lead[r] as string | null | undefined) ?? null)} placeholder="—" titulo={`Edita ${NOMBRE_RED[r]}`} maxLargo={300} />}
        </Prop>
      ))}
    </div>
  );
  if (diseno === 'filas' || editar) {
    return (
      <Bloque titulo={titulo} epico={epico} derecha={editar ? <button type="button" className="fr-link" onClick={() => setEditar(false)}>Listo</button> : undefined}>
        {filas}{aviso}
      </Bloque>
    );
  }
  const con = redes.filter((r) => crudo(r));
  const destacada = diseno === 'destacada' ? con[0] : undefined;
  const chips = redes.filter((r) => r !== destacada).map((r) => {
    const v = ver(r);
    const h = href(r);
    if (v && h) return <a key={r} className="fr-chip" href={h} target="_blank" rel="noopener noreferrer" title={`Abrir ${NOMBRE_RED[r]}`}><IcoRed red={r} />{v}</a>;
    if (v) return <span key={r} className="fr-chip"><IcoRed red={r} />{v}</span>;
    return <button key={r} type="button" className="fr-chip fr-chip--falta" onClick={() => setEditar(true)}>+ {NOMBRE_RED[r]}</button>;
  });
  return (
    <Bloque titulo={titulo} epico={epico} derecha={<button type="button" className="fr-link" onClick={() => setEditar(true)}>Editar</button>}>
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
