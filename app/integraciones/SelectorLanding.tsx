'use client';

// =============================================================================
// SelectorLanding — el PASO 1: cuál de tus páginas estás configurando
// =============================================================================
// ⚠️ VA PRIMERO PORQUE GOBIERNA TODO LO DEMÁS. El código que se copia, si Clarity
// está conectado, si el Pixel está al día, qué pasos tiene la prueba: todo eso es
// distinto en cada landing. El dueño lo dijo así: «tal vez en una landing aún no
// pegue el token y el ID de Clarity y en otra sí».
//
// Mientras la landing se elegía al FINAL, la pantalla afirmaba cosas sobre «tu
// página» sin saber cuál — y con dos publicadas, la mitad de esas afirmaciones
// eran falsas.

import { useEffect, useState } from 'react';
import { Button, Input, Select } from '@/app/_ui';
import { IconBtn } from './ServicioConfigForm';
import { mismaPagina } from '@/lib/landing-paginas';
import type { LandingConfig } from '@/lib/landing-config';
import { borrarLandingAction, getLandingsAction, getProductosAction, guardarLandingAction } from './landing-config-actions';
import type { ProductoAsignable } from '@/lib/landing-funnel';

const NUEVA = '__nueva__';

export function SelectorLanding({ elegida, onElegir, onCargando }: {
  elegida: string | null;
  onElegir: (url: string | null) => void;
  /** Avisa mientras se está resolviendo cuál es la página. Lo necesita el paso 1
   *  para que lo de abajo muestre un esqueleto en vez de la nada: con una sola
   *  landing guardada, la elección la hace este componente solo, y entre que el
   *  modal abre y la lista llega hay un rato en que la pantalla está vacía y
   *  parece rota. */
  onCargando?: (b: boolean) => void;
}) {
  const [landings, setLandings] = useState<LandingConfig[]>([]);
  const [nueva, setNueva] = useState(false);
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Los productos del negocio, para poder decir «esta landing vende este».
  const [productos, setProductos] = useState<ProductoAsignable[]>([]);

  useEffect(() => {
    onCargando?.(true);
    // ⚠️ UN PISO DE TIEMPO, y va al revés de lo habitual. Lo normal es RETRASAR
    // un loader para que una consulta rápida no lo haga parpadear; acá el
    // problema es el opuesto: la consulta tarda tan poco que el hueco de abajo
    // aparece y desaparece sin que se llegue a ver, y lo que queda es la
    // sensación de que la pantalla se dibujó mal. El dueño lo reportó dos veces
    // seguidas —«aún no aparece el loader»— sobre un loader que sí estaba.
    // 450 ms es el piso para que un cambio de estado se perciba como tal.
    const arranque = Date.now();
    let vivo = true;
    getLandingsAction()
      .then((l) => { if (vivo) setLandings(l); })
      .catch(() => { /* sin lista, se agrega */ })
      .finally(() => {
        const falta = Math.max(0, 450 - (Date.now() - arranque));
        // Se apaga SIEMPRE, también si falló: un esqueleto que no termina nunca
        // es peor que la pantalla vacía que vino a tapar.
        setTimeout(() => { if (vivo) onCargando?.(false); }, falta);
      });
    return () => { vivo = false; };
  }, [onCargando]);

  // Los productos no gobiernan nada de lo que viene abajo, así que no entran en
  // `onCargando`: si tardan, lo único que falta un instante es este desplegable.
  useEffect(() => {
    let vivo = true;
    getProductosAction()
      .then((p) => { if (vivo) setProductos(p); })
      .catch(() => { /* sin productos, no se ofrece asignar */ });
    return () => { vivo = false; };
  }, []);

  // Con UNA sola landing no hay nada que elegir: se selecciona sola. Un
  // desplegable de un elemento es un paso que solo existe para ser confirmado.
  useEffect(() => {
    if (!elegida && landings.length === 1) onElegir(landings[0].url);
  }, [landings, elegida, onElegir]);

  const guardar = async () => {
    setOcupado(true); setErr(null);
    const r = await guardarLandingAction(texto);
    setOcupado(false);
    if (!r.ok) { setErr(r.error); return; }
    setLandings(r.landings);
    // Se queda elegida la que se acaba de agregar: es lo que se venía a hacer.
    onElegir(r.landings.find((l) => mismaPagina(l.url, texto))?.url ?? null);
    setNueva(false); setTexto('');
  };

  // ── A que PRODUCTO es esta landing ─────────────────────────────────────────
  // Pedido de Martin, 04/10/2026: «la configuracion que falta es que el pixel
  // deberiamos poder ASIGNAR a un PRODUCTO. Con la implementacion que hicimos,
  // para que lleguen los leads a ese CRM y no a otro».
  //
  // Va ACA y no en una pantalla nueva: esto es el paso 1, donde la persona ya
  // eligio de que pagina esta hablando, y «de que producto es» es una propiedad
  // de esa pagina igual que su proyecto de Clarity.
  const cfg = landings.find((l) => mismaPagina(l.url, elegida)) ?? null;
  // ⚠️ EL DEL NEGOCIO NO SE OFRECE COMO OPCION PROPIA. Un lead del embudo por
  // defecto se guarda con `funnel_id = null` —asi lo busca su tablero— asi que
  // asignarlo por su id lo sacaria de la unica pantalla que el cliente mira.
  // Aca es el valor VACIO, rotulado con su nombre para que se sepa donde caen.
  const delNegocio = productos.find((p) => p.esDefault) ?? null;
  const otros = productos.filter((p) => !p.esDefault);
  // ⚠️ El valor guardado entra a la lista aunque ya no se pueda elegir. Un
  // `<select>` cuyo `value` no esta entre sus opciones no muestra nada y el
  // primer click escribe la primera: un embudo archivado borraria la asignacion
  // sin que nadie la toque.
  const asignado = cfg?.funnelId ?? null;
  const huerfano = asignado != null && !productos.some((p) => p.id === asignado);

  const asignarProducto = async (v: string) => {
    if (!elegida) return;
    setOcupado(true); setErr(null);
    // `0` es lo que DESASIGNA (ausente seria «no lo toques», ver `conLanding`).
    const r = await guardarLandingAction(elegida, { funnelId: Number(v) || 0 });
    setOcupado(false);
    if (!r.ok) { setErr(r.error); return; }
    setLandings(r.landings);
  };

  const borrar = async (url: string) => {
    setOcupado(true); setErr(null);
    const r = await borrarLandingAction(url);
    setOcupado(false);
    if (!r.ok) { setErr(r.error); return; }
    setLandings(r.landings);
    if (mismaPagina(url, elegida)) onElegir(null);
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 11, lineHeight: 1.55, maxWidth: '64ch' }}>
        {landings.length > 1
          ? 'Cada página tiene su propio código y su propia configuración. Elige cuál vas a configurar.'
          : 'Es la página donde vas a instalar el Pixel. Si tienes más de una, agrégalas todas: cada una lleva su propia configuración.'}
      </p>

      {!nueva ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Select
              ariaLabel="Tu landing"
              value={elegida ?? ''}
              onChange={(v) => { if (v === NUEVA) { setNueva(true); return; } onElegir(v); }}
              placeholder="Elige tu página…"
              options={[
                ...landings.map((l) => ({
                  value: l.url,
                  label: l.url,
                  // Se dice de un vistazo qué tiene CADA una: es la información
                  // que vuelve útil tener varias.
                  sub: l.clarityProjectId ? 'con grabaciones' : undefined,
                  acciones: [{
                    icono: <span aria-hidden style={{ fontSize: 13 }}>✕</span>,
                    title: 'Quitar esta página',
                    tone: 'bad' as const,
                    onClick: () => { void borrar(l.url); },
                  }],
                })),
                { value: NUEVA, label: 'Agregar otra página…', sub: 'escribe la dirección' },
              ]}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="https://tu-pagina.com" inputMode="url" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && texto.trim()) void guardar(); }} />
          </div>
          <IconBtn name="check" title="Guardar esta página" tone="good" disabled={!texto.trim() || ocupado} onClick={() => void guardar()} />
          <Button variant="secondary" size="sm" onClick={() => { setNueva(false); setTexto(''); }}>Cancelar</Button>
        </div>
      )}
      {/* Solo cuando hay OTRO producto al que mandar los leads: con uno solo, el
          desplegable no ofrece una decision — ofrece confirmar la unica que hay. */}
      {elegida && !nueva && otros.length > 0 && (
        <div style={{ marginTop: 13 }}>
          <Select
            label="Producto"
            hint="Sus leads entran a este CRM."
            value={asignado != null ? String(asignado) : ''}
            onChange={(v) => { void asignarProducto(v); }}
            disabled={ocupado}
            options={[
              { value: '', label: delNegocio?.nombre ?? 'El del negocio' },
              ...otros.map((p) => ({ value: String(p.id), label: p.nombre })),
              ...(huerfano ? [{ value: String(asignado), label: 'Producto archivado', sub: 'sus leads entran al del negocio' }] : []),
            ]}
          />
        </div>
      )}

      {err && <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
