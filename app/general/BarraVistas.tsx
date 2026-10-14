'use client';

// =============================================================================
// BarraVistas — las vistas de /general: las pastillas, «＋ Nueva vista», el alcance y «Personalizar»
// =============================================================================
// Martín (13/10/2026): «Que se puedan crear más de una, e incluso asignarles ofertas y/o funnels.» Una fila al lado
// del título:
//   · una PASTILLA por vista (la activa, llena). La vista viaja en `?vista=` y la LEE EL SERVER (AGENTS.md: la tab
//     en la URL leída en el server, así el link que se copia es la vista que se ve). Si no entran, bajan de renglón:
//     una barra de navegación no scrollea de costado.
//   · «＋ Nueva vista» abre la galería (app/general/NuevaVista.tsx).
//   · el ALCANCE: los funnels y las ofertas de la vista activa, en un desplegable con las dos secciones. Vacío =
//     «Todo el negocio». Lo que se filtra lo dice cada bloque.
//   · «Personalizar» abre el editor de la vista (app/general/EditarVista.tsx).
//
// Lo que no se ve en la firma:
//   · TODO CAMBIO GUARDA LAS VISTAS ENTERAS, CON LA VERSIÓN QUE SE LEYÓ (`guardarVistasAction`): si otra pestaña
//     guardó en el medio, no se pisa — se avisa y se recarga.
//   · CON LA LECTURA CAÍDA (`puedeGuardar` en false) los controles se apagan: el primer guardado pisaría las vistas
//     que la persona ya tenía (lib/general-vistas.ts).
//   · CREAR O BORRAR UNA VISTA NAVEGA DURO (`window.location.href` con `conWs`): cambia QUÉ EXISTE, y ahí
//     `router.refresh()` llega tarde (AGENTS.md). Cambiar el alcance o los bloques es un dato: `router.refresh()`.
//   · El editor se abre también desde el estado vacío de una vista sin bloques (`ABRIR_PERSONALIZAR`): un evento del
//     documento, porque ese botón vive en el cuerpo de la página y este estado acá.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link, { useRouter, useWs } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { Button } from '@/app/_ui/Button';
import { Dropdown } from '@/app/components/Dropdown';
import { Icon } from '@/app/_components/icons';
import { conWs } from '@/lib/ws-tab';
import {
  MAX_VISTAS, agregarVista, cambiarVista, quitarVista, rotuloAlcance,
  type VistaGeneral, type VistasGeneral,
} from '@/lib/general-vistas-modelo';
import { guardarVistasAction } from './actions';
import { NuevaVista } from './NuevaVista';
import { EditarVista } from './EditarVista';

/** El evento que abre «Personalizar» desde el cuerpo de la página. */
const ABRIR_PERSONALIZAR = 'general:personalizar';

type Catalogo = { funnels: Array<{ id: number; nombre: string }>; ofertas: Array<{ id: number; nombre: string }> } | null;

const PASTILLA: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999,
  fontSize: 14, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap', boxSizing: 'border-box',
};

export function BarraVistas({ vistas: inicial, activaId, version: versionInicial, puedeGuardar, catalogo }: {
  vistas: VistasGeneral;
  activaId: string;
  version: string | null;
  puedeGuardar: boolean;
  catalogo: Catalogo;
}) {
  const router = useRouter();
  const ws = useWs();
  const [vistas, setVistas] = useState(inicial);
  const [version, setVersion] = useState(versionInicial);
  const [guardando, setGuardando] = useState(false);
  const [abierto, setAbierto] = useState<'nueva' | 'editar' | null>(null);
  const { toast, show, clear } = useToast(4000);
  const enVuelo = useRef(false);

  // Lo que vino del server manda cuando cambia (otra navegación, un refresh): no se compite con el estado local.
  useEffect(() => { setVistas(inicial); setVersion(versionInicial); }, [inicial, versionInicial]);
  useEffect(() => {
    const abrir = () => setAbierto('editar');
    document.addEventListener(ABRIR_PERSONALIZAR, abrir);
    return () => document.removeEventListener(ABRIR_PERSONALIZAR, abrir);
  }, []);

  const activa = vistas.vistas.find((v) => v.id === activaId) ?? vistas.vistas[0];
  const irA = useCallback((id: string) => { window.location.href = conWs(`/general?vista=${encodeURIComponent(id)}`, ws); }, [ws]);

  /** Guarda las vistas enteras. `despues`: qué hacer si salió bien. Devuelve si salió bien. */
  const guardar = useCallback(async (nuevas: VistasGeneral, despues: 'refrescar' | { ir: string }): Promise<boolean> => {
    if (!puedeGuardar || enVuelo.current) return false;
    enVuelo.current = true;
    setGuardando(true);
    const antes = vistas;
    setVistas(nuevas);
    try {
      const r = await guardarVistasAction(nuevas, version);
      if (!r.ok) {
        setVistas(antes);
        show(r.conflicto ? 'Cambió en otra pestaña' : 'No se pudo guardar', undefined, 'bad');
        if (r.conflicto) setTimeout(() => window.location.reload(), 1200);
        return false;
      }
      setVersion(r.version);
      if (despues === 'refrescar') router.refresh();
      else irA(despues.ir);
      return true;
    } catch {
      setVistas(antes);
      show('Sin conexión', undefined, 'bad');
      return false;
    } finally {
      enVuelo.current = false;
      setGuardando(false);
    }
  }, [puedeGuardar, vistas, version, show, router, irA]);

  const crear = async (v: VistaGeneral, aviso?: string) => {
    const nuevas = agregarVista(vistas, v);
    if (!nuevas) { show(`Hasta ${MAX_VISTAS} vistas`, undefined, 'bad'); return; }
    setAbierto(null);
    if (aviso) show(aviso);
    await guardar(nuevas, { ir: v.id });
  };

  const alcanceSel = useMemo(() => [
    ...activa.funnels.map((id) => `f:${id}`),
    ...activa.ofertas.map((id) => `o:${id}`),
  ], [activa]);
  const nombres = useMemo(() => ({
    funnels: new Map((catalogo?.funnels ?? []).map((f) => [f.id, f.nombre])),
    ofertas: new Map((catalogo?.ofertas ?? []).map((o) => [o.id, o.nombre])),
  }), [catalogo]);
  const secciones = useMemo(() => {
    if (!catalogo) return [];
    const out = [];
    if (catalogo.funnels.length) out.push({ title: 'Funnels', options: catalogo.funnels.map((f) => ({ value: `f:${f.id}`, label: f.nombre })) });
    if (catalogo.ofertas.length) out.push({ title: 'Ofertas', options: catalogo.ofertas.map((o) => ({ value: `o:${o.id}`, label: o.nombre })) });
    return out;
  }, [catalogo]);

  const alternarAlcance = (valor: string) => {
    const [tipo, crudo] = valor.split(':');
    const id = Number(crudo);
    if (!Number.isInteger(id)) return;
    const lista = tipo === 'f' ? activa.funnels : activa.ofertas;
    const nueva = lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id];
    void guardar(cambiarVista(vistas, activa.id, tipo === 'f' ? { funnels: nueva } : { ofertas: nueva }), 'refrescar');
  };
  const sinAlcance = () => { void guardar(cambiarVista(vistas, activa.id, { funnels: [], ofertas: [] }), 'refrescar'); };

  const apagado = !puedeGuardar ? 'No pude leer tus vistas: por ahora no se pueden cambiar.' : undefined;
  const nAlcance = activa.funnels.length + activa.ofertas.length;

  return (
    <>
      {toast && <Toast state={toast} onClose={clear} />}
      <nav aria-label="Vistas de General" data-barra-vistas="" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
        {vistas.vistas.map((v) => {
          const es = v.id === activa.id;
          return (
            <Link key={v.id} href={`/general?vista=${encodeURIComponent(v.id)}`} aria-current={es ? 'page' : undefined} data-vista={v.id}
              style={{
                ...PASTILLA,
                background: es ? 'var(--ink)' : 'transparent',
                color: es ? 'var(--surface)' : 'var(--dim)',
                border: `1px solid ${es ? 'var(--ink)' : 'var(--border-strong)'}`,
              }}>
              <span aria-hidden>{v.emoji}</span>{v.nombre}
            </Link>
          );
        })}
        {vistas.vistas.length < MAX_VISTAS && (
          <button type="button" className="mk-nuevo" data-nueva-vista-boton="" disabled={!puedeGuardar || guardando} title={apagado ?? 'Nueva vista'}
            onClick={() => setAbierto('nueva')}
            style={{ ...PASTILLA, cursor: 'pointer', fontFamily: 'inherit' }}>
            <span aria-hidden className="mk-nuevo__mas">＋</span>Nueva vista
          </button>
        )}
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 'none' }}>
        {secciones.length > 0 && (
          <span data-alcance="" title={apagado}>
            <Dropdown value="" varios={alcanceSel} onChange={alternarAlcance} columns={[secciones]} search={false} align="right"
              alContenido disabled={!puedeGuardar || guardando} ariaLabel="De qué funnels u ofertas es esta vista"
              icono={<Icon name="funnel" size={16} />} botonLabel={rotuloAlcance(activa, nombres)}
              pie={nAlcance ? { label: 'Todo el negocio', onClick: sinAlcance } : undefined}
              buttonStyle={{ height: 36, borderRadius: 10, color: nAlcance ? 'var(--primary)' : 'var(--dim)', borderColor: nAlcance ? 'var(--primary-weak)' : 'var(--border-strong)' }} />
          </span>
        )}
        <span title={apagado}>
          <Button variant="secondary" size="sm" disabled={!puedeGuardar || guardando} onClick={() => setAbierto('editar')}>Personalizar</Button>
        </span>
      </div>

      {abierto === 'nueva' && (
        <NuevaVista existentes={vistas.vistas.map((v) => v.id)} onCerrar={() => setAbierto(null)} onCrear={(v, aviso) => { void crear(v, aviso); }} />
      )}
      {abierto === 'editar' && (
        <EditarVista vista={activa} puedeBorrar={vistas.vistas.length > 1} guardando={guardando}
          onCerrar={() => setAbierto(null)}
          onGuardar={(v) => { void guardar(cambiarVista(vistas, activa.id, v), 'refrescar').then((ok) => { if (ok) setAbierto(null); }); }}
          onBorrar={() => {
            const nuevas = quitarVista(vistas, activa.id);
            void guardar(nuevas, { ir: nuevas.vistas[0].id });
          }} />
      )}
    </>
  );
}

/** El botón del estado vacío de una vista sin bloques: abre «Personalizar» de la barra. */
export function BotonElegirBloques() {
  return (
    <Button variant="primary" onClick={() => document.dispatchEvent(new Event(ABRIR_PERSONALIZAR))}>Elegir bloques</Button>
  );
}
