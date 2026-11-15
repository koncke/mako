'use client';

// =============================================================================
// CabeceraLead — la cabecera de la ficha del lead, la MISMA en el pop-up y en la ruta
// =============================================================================
// Pedidos de Martín (12/10/2026), sobre la ficha del lead:
//   · punto 11: «Quiero que a los leads le agregues la opción de configurar la portada y foto de
//     perfil que ya tenemos en varios lugares. Y que si le doy click en el nombre grande, no solo en
//     la tarjeta... Como en la empresa, también se pueda editar»;
//   · punto 9: «que la etiqueta pase a estar arriba del nombre donde dice "Círculo ROJO"» —la
//     pastilla de la etapa se fue: la etapa se lee en el desplegable del funnel, a la derecha—.
//
// ⚠️ ES `CabeceraDetalle` (app/_components/CabeceraDetalle.tsx), no una cuarta copia: la portada a
// sangre, la marca cruzándole el borde, las pastillas «Portada / Reposicionar» al hover y el cerrar
// como círculo oscuro. Es la anatomía del detalle de un proyecto, de un cliente de la plataforma y
// de un cliente de Customer Success, y la regla de esa pieza es «si dos cosas tienen que verse
// igual, tienen que ser el mismo componente».
//
// ⚠️ Y ES UNA SOLA PARA LAS DOS PUERTAS DE LA FICHA (app/crm/LeadSheet.tsx y
// app/crm/[id]/LeadDetailBody.tsx): «la ficha del lead tiene DOS implementaciones», y lo que cambia
// en una y no en la otra es la trampa que ya mordió tres veces. Lo propio de cada puerta entra por
// slots: las etiquetas (`kicker`), el desplegable del funnel con su «N sin marcar» (`acciones`) y el
// cerrar (sólo el pop-up lo tiene).
//
// Qué escribe y por dónde:
//   · el NOMBRE, con `saveLeadMetaAction` —el mismo camino que «Información principal», con su
//     Deshacer en el aviso y su línea en el historial—;
//   · la PORTADA y la CARA, con `guardarCaraLeadAction` (app/crm/lead-cabecera-actions.ts): las
//     mismas columnas y el mismo saneo que la ficha de un cliente de Customer Success.
// =============================================================================

import { useState, useTransition, type ReactNode } from 'react';
import Link from '@/app/_ui/Link';
import { CabeceraDetalle } from '@/app/_components/CabeceraDetalle';
import { Marca } from '@/app/_components/Marca';
import { bajadaDelPanel, TAM_CARA_PANEL } from './cabecera-panel';
import { geometriaCabecera } from '@/app/_components/cabecera-detalle-geo';
import { EditableInline } from '@/app/_components/EditableInline';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { IdentidadPicker, type CambioIdentidad } from '@/app/_components/IdentidadPicker';
import { colorDe } from '@/app/_components/TarjetaEntidad';
import { Toast, useToast } from '@/app/_ui/Toast';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import type { Lead } from '@/lib/leads';
import { saveLeadMetaAction } from '../actions';
import { guardarCaraLeadAction, type CaraLead, type CambioCaraLead } from '../lead-cabecera-actions';
import { useRefrescarFicha } from './ficha-cambio';
import { useCaraDelLead } from './CaraDelLead';

/**
 * Las columnas de la cara que el tipo `Lead` (lib/leads.ts) todavía no declara. Existen desde las
 * migs 0173/0174 y `getLead` las trae (`select('*')`); se declaran acá para no tocar el tipo
 * compartido desde esta pieza.
 */
export type LeadConCara = Lead & { portada?: string | null; portada_y?: number | null; avatar_y?: number | null };

const caraDe = (l: LeadConCara): CaraLead => ({
  portada: l.portada ?? null, portadaY: l.portada_y ?? null, icono: l.icono ?? null, avatarY: l.avatar_y ?? null,
});

/** La cara del lead (px): 88 desde el 16/10/2026, como la de un cliente. */
export const TAM_CARA_LEAD = 88;
/**
 * Dónde empieza el NOMBRE del lead, desde el borde izquierdo de la cabecera (px): el margen, la cara y su aire
 * (`geometriaCabecera`). El título de la hoja abierta de la ficha se alinea con esto (punto 9 del 16/10/2026: «Quiero
 * que esté alineado al título del nombre de la persona. No más a la izquierda»).
 */
export const SANGRIA_NOMBRE_LEAD = geometriaCabecera(0, TAM_CARA_LEAD).sangria;

export function CabeceraLead({ lead, fotoEmail, kicker, junto, acciones, onCerrar, marco = false, panel = false, alto = 92, tam = TAM_CARA_LEAD }: {
  lead: LeadConCara;
  /** La foto del email (Gravatar, `d=404`), armada en el server. */
  fotoEmail: string | null;
  /** ARRIBA del nombre. Desde el 13/10/2026 las etiquetas van en `junto`; queda para otra cosa. */
  kicker?: ReactNode;
  /**
   * AL LADO del nombre, en su mismo renglón: las etiquetas del lead (13/10/2026: «compactes lo que
   * hay arriba de las tabs... poniendo la opción de etiquetas al lado del título»). Antes iban en
   * un renglón propio arriba del nombre (punto 9 del 12/10), y ese renglón y la banda de la portada
   * eran lo que empujaba las pestañas hacia abajo. La banda bajó de 116 a 92 y la cara de 72 a 64.
   * El 16/10/2026 la cara volvió a crecer, a 88 como la ficha de un cliente: «Está mejor en clientes que el nombre se
   * pone cerca de la foto, y la foto es más grande» (Martín). La banda sigue en 92.
   */
  junto?: ReactNode;
  /** A la derecha: el desplegable del funnel y, debajo, «N sin marcar · Solucionar». */
  acciones?: ReactNode;
  /** El pop-up: la cruz sobre la portada. La ruta no tiene: es una pantalla, se vuelve con «Volver». */
  onCerrar?: () => void;
  /** La ruta: la cabecera va en su propia caja, porque ahí atrás está el fondo de la página. */
  marco?: boolean;
  /**
   * El PANEL del tablero (14/11/2026, lead-view/PanelFicha.tsx): sin la banda de la portada, la cara en un círculo de 48,
   * el nombre y «empresa · canal», como en la grabación que le gustó a Martín. Lo demás es lo mismo (el nombre se edita,
   * la cara se cambia tocándola, las etiquetas al lado, el funnel y los datos sin marcar debajo). La portada se sigue
   * eligiendo en la ficha a pantalla completa (/crm/[id]), que el panel abre con su botón.
   */
  panel?: boolean;
  alto?: number;
  tam?: number;
}) {
  const refrescarFicha = useRefrescarFicha();
  const { toast, show, clear } = useToast();
  const [, startGuardar] = useTransition();
  const nombre = lead.nombre?.trim() || 'Sin nombre';
  // El color sale del NOMBRE, como el de un cliente de Customer Success: es la misma fila, y la
  // portada por defecto (el degradado) tiene que ser la misma en las dos pantallas.
  const color = colorDe(nombre);

  // ⚠️ LO GUARDADO LE GANA A LA FOTO DE LA PANTALLA hasta que la pantalla se relee. El pop-up tiene
  // los datos que trajo una action al abrir, y la portada que se acaba de elegir tiene que verse YA,
  // no después del `releer`. Otro lead en la misma pieza (el pop-up se reusa) arranca de cero.
  const [cambios, setCambios] = useState<{ leadId: number; cara: Partial<CaraLead> }>({ leadId: lead.id, cara: {} });
  const propios = cambios.leadId === lead.id ? cambios.cara : {};
  const cara: CaraLead = { ...caraDe(lead), ...propios };
  const poner = (c: Partial<CaraLead>) => setCambios((x) => ({ leadId: lead.id, cara: { ...(x.leadId === lead.id ? x.cara : {}), ...c } }));

  const { icono, foto } = useCaraDelLead({
    telefono: lead.telefono, fotoEmail, fotoGuardada: lead.foto_auto_url,
    icono: cara.icono, avatarUrl: lead.avatar_url,
  });

  const [anclaPortada, setAnclaPortada] = useState<HTMLElement | null>(null);
  const [anclaFoto, setAnclaFoto] = useState<HTMLElement | null>(null);

  /** Se ve al toque y se confirma con lo que el server GUARDÓ (el saneo puede descartar algo). */
  const aplicar = (cambio: CambioCaraLead) => {
    const antes = cara;
    // Lo mismo que hace el server: cambiar la imagen borra su encuadre, salvo que venga en el cambio.
    poner({
      ...cambio,
      ...(cambio.portada !== undefined && cambio.portadaY === undefined ? { portadaY: null } : {}),
      ...(cambio.icono !== undefined && cambio.avatarY === undefined ? { avatarY: null } : {}),
    });
    startGuardar(async () => {
      const r = await guardarCaraLeadAction(lead.id, cambio);
      if (!r.ok) { poner(antes); show(r.error, undefined, 'bad'); return; }
      poner({ portada: r.portada, portadaY: r.portadaY, icono: r.icono, avatarY: r.avatarY });
      refrescarFicha();
    });
  };

  // ⚠️ EL NOMBRE NO PUEDE QUEDAR VACÍO: un lead sin nombre no se encuentra en ninguna lista. Como
  // el campo ya se vació en la pantalla, se lo vuelve a montar con el nombre de antes (la `key`).
  const [vuelta, setVuelta] = useState(0);
  const guardarNombre = (v: string) => {
    const nuevo = v.trim();
    const antes = lead.nombre;
    if (!nuevo) { setVuelta((n) => n + 1); show('Falta el nombre', undefined, 'bad'); return; }
    startGuardar(async () => {
      try {
        await saveLeadMetaAction(lead.id, { nombre: nuevo });
        refrescarFicha();
        // El deshacer escribe en el SERVER: revertir sólo la pantalla sería mentir hasta el F5.
        show('Guardado', () => {
          startGuardar(async () => {
            try { await saveLeadMetaAction(lead.id, { nombre: antes }); refrescarFicha(); setVuelta((n) => n + 1); }
            catch { show('No se pudo deshacer', undefined, 'bad'); }
          });
        });
      } catch (e) {
        setVuelta((n) => n + 1);
        show(e instanceof Error ? e.message : 'No se pudo guardar', undefined, 'bad');
      }
    });
  };

  // El nombre que se edita con un clic, y las etiquetas en su renglón: el mismo en la cabecera grande y en la del panel.
  const nombreEditable = (
    <span className="cl-tit">
    <EditableInline
      key={`${lead.id}:${vuelta}`}
      valor={lead.nombre ?? ''}
      placeholder="Sin nombre"
      titulo="Edita el nombre del lead"
      className={panel ? 'cl-nom clp-nom' : 'cl-nom'}
      maxLargo={160}
      onGuardar={guardarNombre} />
    {junto != null && <span className="cl-junto">{junto}</span>}
    </span>
  );

  const cabecera = panel ? (
    // ⚠️ LA CABECERA DEL PANEL (14/11/2026): la de la grabación de la portada que le gustó a Martín (la cara en un círculo,
    // el nombre y «empresa · canal»), con todo lo que la grande hace. En el teléfono el panel es la pantalla entera y la
    // cruz pasa a ser «Volver», a la izquierda, donde se busca para volver (el CSS de abajo elige cuál se ve).
    <>
      <div className="clp-fila">
        {onCerrar && (
          <button type="button" className="clp-volver" aria-label="Volver" title="Volver" onClick={onCerrar}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
          </button>
        )}
        <button type="button" className="clp-cara" title="Cambiar la foto" aria-label={`Cambiar la foto de ${nombre}`}
          onClick={(e) => { const a = e.currentTarget; setAnclaPortada(null); setAnclaFoto((x) => (x ? null : a)); }}>
          <Marca icono={icono} foto={foto} nombre={nombre} tam={TAM_CARA_PANEL} y={cara.avatarY} color={color} />
        </button>
        <span className="clp-txt">
          {nombreEditable}
          <span className="clp-bajada" title={`Lead #${lead.id} · creado ${fmtDDMMYYYY(lead.created_at)}`}>{bajadaDelPanel(lead)}</span>
        </span>
        <Link className="clp-icono" href={`/crm/${lead.id}`} title="Abrir en pantalla completa" aria-label="Abrir la ficha en pantalla completa">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </Link>
        {onCerrar && (
          <button type="button" className="clp-icono clp-x" aria-label="Cerrar" title="Cerrar (Esc)" onClick={onCerrar}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
              strokeLinecap="round" aria-hidden><path d="M6 6 18 18M18 6 6 18" /></svg>
          </button>
        )}
      </div>
      {acciones && <div className="cl-acc clp-acc">{acciones}</div>}
    </>
  ) : (
      <CabeceraDetalle
        nombre={nombre}
        color={color}
        portada={cara.portada} portadaY={cara.portadaY}
        onPortada={(a) => { setAnclaFoto(null); setAnclaPortada((x) => (x ? null : a)); }}
        onEncuadre={(y) => aplicar({ portadaY: y })}
        icono={icono} foto={foto} avatarY={cara.avatarY}
        onIcono={(a) => { setAnclaPortada(null); setAnclaFoto((x) => (x ? null : a)); }}
        alto={alto} tam={tam} anillo={3}
        onCerrar={onCerrar}
        kicker={kicker}
        titulo={nombreEditable}
        // «Elimina "Sin empresa ·" del subtítulo: que sólo quede el ID y la fecha de creación» (Martín, 16/10/2026). La
        // empresa, si la hay, sigue: es un dato; lo que sobraba era el hueco dicho en voz alta.
        bajada={<span>{lead.empresa?.trim() ? `${lead.empresa.trim()} · ` : ''}Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}</span>}
        acciones={acciones ? <div className="cl-acc">{acciones}</div> : undefined}
      />
  );

  return (
    <div className={panel ? 'cl-cab cl-cab--panel' : 'cl-cab'} style={{
      flex: 'none', position: 'relative',
      ...(marco ? { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' as const } : {}),
    }}>
      {cabecera}

      {/* Los dos selectores, HERMANOS de la cabecera: se portalean a `document.body` y se registran en
          la pila como `anidada`, así la ficha se sigue viendo detrás y Escape cierra sólo el panel. */}
      {anclaPortada && (
        <PortadaPicker
          valor={cara.portada}
          colorBase={color}
          ancla={anclaPortada}
          titulo={`Portada de ${nombre}`}
          onElegir={(v) => aplicar({ portada: v })}
          onCerrar={() => setAnclaPortada(null)} />
      )}
      {anclaFoto && (
        <IdentidadPicker
          icono={cara.icono ?? lead.avatar_url ?? null}
          y={cara.avatarY}
          ancla={anclaFoto}
          titulo={`Foto de ${nombre}`}
          // El mismo reparto que la ficha de un cliente (FichaCliente.tsx): el emoji de una persona
          // va en `icono` como `emoji:<glifo>` (un lead no tiene columna `emoji`), y «Quitar» limpia
          // `icono` sin tocar la foto vieja de `avatar_url`, que vuelve.
          onElegir={(c: CambioIdentidad) => {
            if (c.emoji !== undefined) aplicar({ icono: c.emoji ? `emoji:${c.emoji}` : null, avatarY: null });
            else if (c.icono !== undefined) aplicar({ icono: c.icono, avatarY: c.y ?? null });
            else if (c.y !== undefined) aplicar({ avatarY: c.y });
          }}
          onCerrar={() => setAnclaFoto(null)} />
      )}

      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: adentro de un template literal una sola
// cierra la hoja a la mitad (AGENTS.md).
const CSS = `
/* El nombre grande: el mismo tamaño y peso que el de la ficha de un cliente, sin ninguna caja.
   Se edita con un clic, como la empresa. */
.cl-nom{ font-size:22px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
/* Lo que va arriba del nombre, con aire hasta el nombre. */
.cl-cab .cd-kicker{ margin-bottom:6px; }
/* El nombre y, en su renglon, las etiquetas. Si no entran, las etiquetas bajan debajo del
   nombre (envuelven): nunca lo aplastan a cero. */
.cl-tit{ display:flex; align-items:center; flex-wrap:wrap; gap:6px 12px; min-width:0; }
/* El nombre ARRIBA de su fila, al lado de la mitad de abajo de la foto, como en la ficha de un cliente (16/10/2026).
   Abajo de todo (lo que hace la fila, que alinea por la base) quedaba debajo de la foto cuando a la derecha van el
   funnel y los datos sin marcar, y se leía separado de la cara. */
.cl-cab .cd-txt{ align-self:flex-start; }
.cl-junto{ display:inline-flex; align-items:center; flex:none; }
/* A la derecha: el funnel arriba y el aviso de datos sin marcar debajo (punto 9: «que ese
   desplegable este arriba de donde hoy esta 1 sin marcar»). Pegado a la derecha aunque el nombre
   sea largo: el texto es lo que cede. */
.cl-acc{ display:flex; flex-direction:column; align-items:flex-end; gap:8px; flex:none; margin-left:auto; }
/* En una pantalla angosta (la ruta se abre desde el link de un WhatsApp) la columna de la derecha
   baja de renglon pegada a la izquierda del texto, en vez de dejar el nombre en cero de ancho. */
@media (max-width: 760px){
  .cl-cab .cd-fila{ flex-wrap:wrap; row-gap:10px; }
  .cl-cab .cl-acc{ margin-left:0; align-items:flex-start; flex-basis:100%; }
}
/* En una pantalla tactil (un iPad, que recibe la computadora adaptada: app/globals.css) lo que se toca a la
   derecha, el desplegable del funnel y el Ver de los datos sin marcar, va a los 44 px de toque. Se decide
   por capacidad, no por ancho: un iPad acostado mide 1024 o mas. */
@media (pointer: coarse){
  .cl-cab .cl-acc button{ min-height:var(--touch); }
}

/* LA CABECERA DEL PANEL (14/11/2026): la de la grabacion de la portada. La cara en un circulo de 48, el nombre de 21 y
   «empresa · canal» de 14, en una fila; debajo, el funnel y los datos sin marcar, de izquierda a derecha. */
.clp-fila{ display:flex; align-items:center; gap:14px; padding:20px 16px 12px 24px; min-width:0; }
.clp-cara{ flex:none; padding:0; border:0; background:none; border-radius:999px; cursor:pointer; line-height:0; }
.clp-cara:hover{ filter:brightness(.95); }
.clp-cara:focus-visible{ outline:2px solid var(--primary); outline-offset:2px; }
.clp-txt{ display:flex; flex-direction:column; gap:2px; min-width:0; flex:1; }
.cl-cab--panel .clp-nom{ font-size:21px; font-weight:700; letter-spacing:-.015em; }
.clp-bajada{ font-size:14px; font-weight:500; line-height:1.3; color:var(--dim); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.clp-icono{ flex:none; align-self:flex-start; width:32px; height:32px; display:grid; place-items:center; padding:0; border:0;
  border-radius:9px; background:none; color:var(--dim); cursor:pointer; text-decoration:none; line-height:0; }
.clp-icono:hover{ background:var(--surface-2); color:var(--ink); }
.clp-icono:focus-visible, .clp-volver:focus-visible{ outline:2px solid var(--primary); outline-offset:1px; }
.clp-volver{ display:none; flex:none; width:40px; height:40px; margin-left:-12px; padding:0; border:0; border-radius:10px;
  background:none; color:var(--ink); cursor:pointer; place-items:center; line-height:0; }
.cl-cab--panel .cl-acc.clp-acc{ flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:space-between;
  gap:8px 12px; margin-left:0; padding:0 24px 14px; }
/* En el telefono el panel es la pantalla entera: se vuelve con la flecha de la izquierda, y la cruz sobra. */
@media (max-width: 760px){
  .clp-fila{ gap:10px; padding:12px 12px 10px 16px; }
  .clp-volver{ display:grid; min-width:var(--touch, 44px); min-height:var(--touch, 44px); }
  .clp-x{ display:none; }
  .cl-cab--panel .cl-acc.clp-acc{ padding:0 16px 12px; justify-content:flex-start; }
  .cl-cab--panel .clp-nom{ font-size:19px; }
}
`;

/** La hoja de la cabecera, para quien dibuja la misma fila sin montar la pieza (el esqueleto del panel, app/crm/LeadEditModal.tsx). */
export const CSS_CABECERA_LEAD = CSS;
