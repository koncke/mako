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
import { borrarLandingAction, getLandingsAction, guardarLandingAction } from './landing-config-actions';

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

  // ⚠️ A QUE PRODUCTO ES ESTA LANDING YA NO SE PREGUNTA ACA. Vivia al pie de este
  // paso como un desplegable, y el 06/10/2026 Martin lo mudo a un paso propio —el
  // 2— y lo volvio multiple: `app/integraciones/AsignarProducto.tsx`. El porque
  // esta ahi; lo que importa de este lado es que este componente ya no lee ni
  // escribe `funnelIds`, asi que dos pantallas no pueden decidir lo mismo.

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
      {err && <div style={{ marginTop: 7, fontSize: 12.5, color: 'var(--bad)' }}>{err}</div>}
    </div>
  );
}
