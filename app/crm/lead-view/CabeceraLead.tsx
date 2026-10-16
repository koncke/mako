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
import { CabeceraDetalle } from '@/app/_components/CabeceraDetalle';
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

export function CabeceraLead({ lead, fotoEmail, kicker, junto, acciones, onCerrar, marco = false, alto = 92, tam = 64 }: {
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
   */
  junto?: ReactNode;
  /** A la derecha: el desplegable del funnel y, debajo, «N sin marcar · Solucionar». */
  acciones?: ReactNode;
  /** El pop-up: la cruz sobre la portada. La ruta no tiene: es una pantalla, se vuelve con «Volver». */
  onCerrar?: () => void;
  /** La ruta: la cabecera va en su propia caja, porque ahí atrás está el fondo de la página. */
  marco?: boolean;
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

  return (
    <div className="cl-cab" style={{
      flex: 'none', position: 'relative',
      ...(marco ? { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, overflow: 'hidden' as const } : {}),
    }}>
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
        titulo={
          <span className="cl-tit">
          <EditableInline
            key={`${lead.id}:${vuelta}`}
            valor={lead.nombre ?? ''}
            placeholder="Sin nombre"
            titulo="Edita el nombre del lead"
            className="cl-nom"
            maxLargo={160}
            onGuardar={guardarNombre} />
          {junto != null && <span className="cl-junto">{junto}</span>}
          </span>
        }
        bajada={<span>{lead.empresa?.trim() || 'Sin empresa'} · Lead #{lead.id} · creado {fmtDDMMYYYY(lead.created_at)}</span>}
        acciones={acciones ? <div className="cl-acc">{acciones}</div> : undefined}
      />

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
`;
