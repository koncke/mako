'use client';

// =============================================================================
// GaleriaTab — «¿Qué vas a crear hoy?» y las plantillas de UNA tab de la ficha, en el lugar de la tab
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?... Y que pueda elegir». Y: «en todos los lugares que usamos templates, que al
// principio se posicionen los sugeridos para el negocio... Y que tenga un texto sutil de "Sugerido"».
//
// LA REFERENCIA: «Nueva hoja» del Dashboard (app/dashboard/NuevaHoja.tsx, `CrearHoja`), que es la galería v2 de
// Automations y la portada del Web Generator: la caja de la casa ARRIBA (`CajaPedido`, la MISMA, no una copia) y
// abajo las plantillas como tarjetas con su miniatura, «En blanco» primera siempre, las sugeridas después con
// «Sugerido» chico y gris. Lo que cambia, de la documentación de HubSpot (knowledge.hubspot.com, «Customize the middle
// column of records»: la vista previa de una tarjeta se mira CON UN REGISTRO elegido; no se abrió la app): una
// plantilla de la ficha no se entiende en miniatura, así que tocar una tarjeta la MIRA con los datos de ESTE lead
// (la tab de abajo, ./FichaPorBloques.tsx) y «Usar» la elige. Mirar no guarda nada; elegir sí (./galeria.ts).
//
// ⚠️ LA CAJA ARMA LA TAB con la red barata de la casa (/api/crm/ficha/armar → lib/ficha/ia-generar.ts): lo que arma
//    MaKo se MIRA como cualquier plantilla y se usa con el mismo botón. Cancelar sale gratis (la ruta no guarda).
// ⚠️ SIN FOCO AL ABRIR, a propósito, como «Nueva hoja»: el ejemplo de la caja se escribe solo mientras la caja no tiene
//    el foco.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui/Button';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import { CajaPedido, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/web-generator/CajaPedido';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { BloqueId, TabFicha } from '@/lib/ficha/catalogo';
import type { BloquePuesto } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';
import { galeriaDeTab, plantillaTabPorId, sugeridasDeTab } from '@/lib/ficha/plantillas-tab';
import { TOPE_PEDIDO_TAB } from '@/lib/ficha/ia';
import { EJEMPLOS_TAB, esLaDeHoy, miniaturaDe, rotuloUsar, type VistaGaleria } from './galeria';

/** El tope de la ruta (`maxDuration = 100`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 105_000;

export function GaleriaTab({ tab, ficha, nombreTab, vista, onVista, onUsar, onCerrar, primeraVez, registrado }: {
  tab: TabFicha;
  ficha: FichaDelFunnel;
  /** El nombre que se dibuja de la tab (el del admin, o el de siempre). */
  nombreTab: string;
  /** Lo que se está mirando (la tab de abajo se dibuja con eso). null = lo de hoy (la plantilla en uso o la sugerida). */
  vista: VistaGaleria | null;
  onVista: (v: VistaGaleria) => void;
  /** Elegir lo que se mira: guarda el cambio y cierra. */
  onUsar: () => void;
  /** «Ahora no» (la primera vez) o «Cerrar» (abierta desde «Personalizar»): se queda la de hoy. */
  onCerrar: () => void;
  primeraVez: boolean;
  /** ¿El bloque tiene componente? (lo que se dibuja: la miniatura no muestra lo que no se vería). */
  registrado: (id: BloqueId) => boolean;
}) {
  const ef = ficha.efectiva;
  const galeria = useMemo(
    () => galeriaDeTab(tab, { plantilla: ef.plantilla, porque: ef.plantillaAMano ? undefined : ficha.eleccion.porque }),
    [tab, ef.plantilla, ef.plantillaAMano, ficha.eleccion.porque],
  );
  const sugerida = useMemo(() => sugeridasDeTab(tab, { plantilla: ef.plantilla })[0] ?? null, [tab, ef.plantilla]);
  const configurada = ef.configuradas.includes(tab);
  const enUso = configurada ? ef.plantillasTab[tab] : null;
  // Sin mirar nada, se mira lo de hoy: la plantilla que la tab ya tiene (en una tab sin configurar, la sugerida).
  const mira: VistaGaleria = vista ?? { tipo: 'plantilla', id: ef.plantillasTab[tab] };

  // ── La caja: MaKo arma la tab con un pedido ──────────────────────────────────────────────
  const [pedido, setPedido] = useState('');
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [error, setError] = useState<{ texto: string; link?: string } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const pensando = desde != null;
  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);
  // Cerrar la galería corta el pedido: la ruta no escribió nada.
  useEffect(() => () => { ctrl.current?.abort(); }, []);

  const cancelar = () => { ctrl.current?.abort(); ctrl.current = null; setDesde(null); };
  const enviar = async () => {
    const texto = pedido.trim();
    if (pensando || !texto) return;
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setError(null); setAviso(null); setDesde(Date.now()); setAhora(Date.now());
    try {
      const res = await fetch('/api/crm/ficha/armar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab, pedido: texto }), signal: c.signal,
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; bloques?: unknown; epica?: unknown; avisos?: unknown; error?: string; link?: string } | null;
      if (ctrl.current !== c) return;
      setDesde(null);
      if (!res.ok || !j?.ok || !Array.isArray(j.bloques)) { setError({ texto: j?.error || `Error ${res.status}`, link: j?.link }); return; }
      // Lo que llega por la red se vuelve a sanear al mirarlo y al guardarlo (el motor de lib/ficha/config.ts).
      onVista({ tipo: 'mako', bloques: j.bloques as BloquePuesto[], epica: j.epica === true });
      const avisos = Array.isArray(j.avisos) ? j.avisos.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      setAviso(avisos[0] ?? null);
    } catch {
      if (ctrl.current !== c) return;
      setDesde(null);
      setError({ texto: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };
  const segundos = desde != null ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0;

  const mirando = mira.tipo === 'mako' ? 'Lo que armó MaKo' : (plantillaTabPorId(mira.id)?.nombre ?? '');
  // En una tab configurada, lo de hoy ya está elegido. En una sin configurar, «Usar la sugerida» la deja elegida.
  const yaEsta = configurada && (vista == null || esLaDeHoy(ficha, mira, tab));

  return (
    <>
      <section className="fb-galeria" aria-label={`Plantillas de ${nombreTab}`}>
        <button type="button" className="fb-boton-texto fb-galeria-cerrar" onClick={onCerrar}
          title={primeraVez ? 'Se queda la sugerida' : 'Se queda la de hoy'}>
          {primeraVez ? 'Ahora no' : 'Cerrar'}
        </button>
        {/* 1 · ¿Qué vas a crear hoy? — LA caja de la casa (la de «Nueva hoja», Automations y el Web Generator). */}
        <div className="gp cp-casa fb-galeria-caja" data-pedido-mako="">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={pedido} onValor={setPedido} onEnviar={() => { void enviar(); }}
            ejemplos={EJEMPLOS_TAB[tab]} animar placeholderQuieto="Escribe o dicta qué quieres ver" etiqueta={`Qué quieres ver en ${nombreTab}`}
            tope={TOPE_PEDIDO_TAB} deshabilitado={pensando} onError={(m) => setError(m ? { texto: m } : null)} />
          {pensando && (
            <div role="status" aria-live="polite" style={S.estado}>
              <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
              <span style={S.dim}>· los bloques de {nombreTab} · {segundos} s</span>
              <span style={{ marginLeft: 'auto' }}><Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button></span>
            </div>
          )}
          {error && (
            <p role="alert" style={S.error}>
              {error.texto}{error.link && <> <LinkIntegracion href={error.link} style={S.link}>Abrir</LinkIntegracion></>}
            </p>
          )}
        </div>

        {/* 2 · Las plantillas: «En blanco» primera siempre, las sugeridas y el resto. Tocar una la MIRA abajo. */}
        <div className="fb-gal-grilla">
          {galeria.map(({ plantilla: p, porque }) => {
            const blanco = p.bloques.length === 0;
            const piezas = blanco ? [] : miniaturaDe(p, ficha.respaldo, registrado);
            const mirada = mira.tipo === 'plantilla' && mira.id === p.id;
            const marca = p.id === enUso ? 'En uso' : porque ? 'Sugerido' : null;
            return (
              <button key={p.id} type="button" className="fb-gal-carta" aria-pressed={mirada} data-plantilla={p.id}
                data-sugerida={porque ? 'si' : undefined} title={porque ? `${p.bajada} ${porque}` : p.bajada}
                aria-label={`Mirar la plantilla ${p.nombre}${porque ? ` (sugerida: ${porque})` : ''}`}
                onClick={() => { setAviso(null); onVista({ tipo: 'plantilla', id: p.id }); }}>
                {blanco ? (
                  <span className="fb-gal-mini fb-gal-mini--vacia"><span aria-hidden>＋</span></span>
                ) : (
                  <span className={`fb-gal-mini${p.epico ? ' fb-gal-mini--epica' : ''}`} aria-hidden>
                    {p.epico && <span className="fb-gal-titular" />}
                    {piezas.map((x, i) => (
                      <span key={`${x.id}:${i}`} className="fb-gal-pieza" style={{ '--s': x.span } as CSSProperties}>{x.titulo}</span>
                    ))}
                  </span>
                )}
                <span className="fb-gal-pie">
                  <span className="fb-gal-nombre">{p.nombre}</span>
                  {marca && <span className="fb-gal-sugerido" title={porque ?? undefined}>{marca}</span>}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3 · Lo que se mira, con los datos de este lead (la tab de abajo) y el botón que lo elige. */}
      <div className="fb-gal-barra" role="region" aria-label="Vista previa">
        <span className="fb-gal-barra-txt">
          Vista previa: <strong>{mirando}</strong>
          {aviso && <span className="fb-gal-barra-aviso"> · {aviso}</span>}
        </span>
        <Button size="sm" onClick={onUsar} disabled={yaEsta || pensando}>{yaEsta ? 'En uso' : rotuloUsar(mira, sugerida)}</Button>
      </div>
    </>
  );
}

// Sólo tokens de la casa (se dan vuelta en oscuro). Los mismos del renglón «pensando» de «Nueva hoja».
const S: Record<string, CSSProperties> = {
  estado: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, width: '100%', maxWidth: 720, minHeight: 36, margin: '-6px auto 0' },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  dim: { fontSize: 13, color: 'var(--dim)' },
  error: { margin: '-6px auto 0', width: '100%', maxWidth: 720, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
};
