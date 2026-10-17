'use client';

// =============================================================================
// GaleriaTab — «¿Qué vas a crear hoy?» y las plantillas de UNA tab de la ficha (o de una hoja propia), en su lugar
// =============================================================================
// Martín, 16/10/2026: «Si nunca configuró una tab, y entra por primera vez al detail de un lead, que le salten los
// templates y el ¿Qué vas a crear hoy?... Y que pueda elegir». Y: «en todos los lugares que usamos templates, que al
// principio se posicionen los sugeridos para el negocio... Y que tenga un texto sutil de "Sugerido"».
//
// LA REFERENCIA: «Nueva hoja» del Dashboard (app/dashboard/NuevaHoja.tsx, `CrearHoja`), que es la galería v2 de
// Automations y la portada del Web Generator: la caja de la casa ARRIBA (`CajaPedido`, la MISMA, no una copia) y
// abajo las plantillas como tarjetas con su miniatura, «En blanco» primera siempre, las sugeridas después con
// «Sugerido» chico y gris. Tocar una plantilla la ELIGE; lo que arma MaKo con la caja se MIRA abajo con los datos de
// este lead y se elige con «Usar» (./galeria.ts).
//
// 17/10/2026 (punto 5 del feedback del 16/10):
//   · LA MINIATURA ES LA TAB (`miniatura`, ./MiniaturaFicha.tsx): los bloques de verdad con los datos de este lead, en
//     chico. Antes era un boceto de rectángulos que se veía igual en todas las tabs («Las miniaturas de los TEMPLATES
//     son todos iguales en todas las tabs, y no debería ser así»). Sin `miniatura`, el boceto de respaldo.
//   · UNA HOJA PROPIA también tiene galería (`galeriaDeLugar`): las plantillas de TODAS las tabs, cada una con la tab
//     de la que es en el lugar de «Sugerido». «Nueva hoja» (`nueva`) es esta galería antes de que la hoja exista.
//   · «TODA LA FICHA» PASÓ A SER TEMPLATES («que no salgan las opciones de "Toda la ficha" esos deben ser templates»):
//     en una de las cuatro tabs, abajo, las plantillas de toda la ficha como tarjetas (con la miniatura de ESTA tab con
//     esa plantilla), la que eligió MaKo con «Sugerido», y «Volver toda la ficha». Era el desplegable de la barra
//     lateral de «Personalizar», que se fue.
//
// ⚠️ LA CAJA ARMA LA TAB con la red barata de la casa (/api/crm/ficha/armar → lib/ficha/ia-generar.ts): lo que arma
//    MaKo se MIRA como cualquier plantilla y se usa con el mismo botón. Cancelar sale gratis (la ruta no guarda).
// ⚠️ SIN FOCO AL ABRIR, a propósito, como «Nueva hoja»: el ejemplo de la caja se escribe solo mientras la caja no tiene
//    el foco.
// ⚠️ LA TARJETA NO ES UN <button> QUE ENVUELVE LA MINIATURA: los bloques de adentro tienen sus botones, y un botón
//    adentro de otro no vale. El botón es una capa encima de toda la tarjeta (`fb-gal-tocar`).
// =============================================================================

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/app/_ui/Button';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import { CajaPedido, CSS_CAJA_PEDIDO, CSS_TOKENS_CASA, TITULO_CAJA } from '@/app/web-generator/CajaPedido';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { esTabFicha, NOMBRE_TAB, type BloqueId, type LugarFicha } from '@/lib/ficha/catalogo';
import { listaDeEntrada, listaDeEntradaTab, type BloquePuesto } from '@/lib/ficha/config';
import type { FichaDelFunnel } from '@/lib/ficha/config-server';
import { PLANTILLAS_FICHA, type PlantillaId } from '@/lib/ficha/plantillas';
import { plantillaTabPorId, sugeridasDeTab, type PlantillaTab } from '@/lib/ficha/plantillas-tab';
import { TOPE_PEDIDO_TAB } from '@/lib/ficha/ia';
import { EJEMPLOS_HOJA, EJEMPLOS_TAB, EN_BLANCO_HOJA, esLaDeHoy, galeriaDeLugar, miniaturaDe, rotuloUsar, type VistaGaleria } from './galeria';

/** El tope de la ruta (`maxDuration = 100`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 105_000;

export function GaleriaTab({ tab, ficha, nombreTab, vista, onVista, onElegir, onUsar, onCerrar, registrado, miniatura, nueva = false, onTodaLaFicha }: {
  /** Una de las cuatro tabs o una hoja propia (en «Nueva hoja», la clave que va a tener). */
  tab: LugarFicha;
  ficha: FichaDelFunnel;
  /** El nombre que se dibuja de la tab (el del admin, o el de siempre). */
  nombreTab: string;
  /** Lo que se está mirando (la tab de abajo se dibuja con eso). null = lo de hoy (la plantilla en uso o la sugerida). */
  vista: VistaGaleria | null;
  onVista: (v: VistaGaleria) => void;
  /** Tocar una plantilla la ELIGE: guarda y cierra, sin vista previa (16/10/2026). */
  onElegir: (v: VistaGaleria) => void;
  /** Elegir lo que se mira: guarda el cambio y cierra. */
  onUsar: () => void;
  /** «Cerrar»: se queda la de hoy. */
  onCerrar: () => void;
  /** ¿El bloque tiene componente? (lo que se dibuja: el boceto no muestra lo que no se vería). */
  registrado: (id: BloqueId) => boolean;
  /** La tab dibujada en chico con los datos de este lead (./MiniaturaFicha.tsx). */
  miniatura?: (lista: BloquePuesto[], epico: boolean) => ReactNode;
  /** «Nueva hoja»: la hoja todavía no existe; lo que se elige la crea. */
  nueva?: boolean;
  /** Elegir una plantilla de TODA la ficha (null = la que elige MaKo), o volver toda la ficha a su plantilla (`'volver'`). */
  onTodaLaFicha?: (p: PlantillaId | null | 'volver') => void;
}) {
  const ef = ficha.efectiva;
  const esTab = esTabFicha(tab);
  const galeria = useMemo(
    () => galeriaDeLugar(tab, { plantilla: ef.plantilla, porque: ef.plantillaAMano ? undefined : ficha.eleccion.porque }),
    [tab, ef.plantilla, ef.plantillaAMano, ficha.eleccion.porque],
  );
  const sugerida = useMemo(() => (esTabFicha(tab) ? sugeridasDeTab(tab, { plantilla: ef.plantilla })[0] ?? null : null), [tab, ef.plantilla]);
  const configurada = esTabFicha(tab) && ef.configuradas.includes(tab);
  const enUso = esTabFicha(tab) && configurada ? ef.plantillasTab[tab] : null;
  // Sin mirar nada, se mira lo de hoy: la plantilla que la tab ya tiene (en una tab sin configurar, la sugerida).
  const mira: VistaGaleria = vista ?? { tipo: 'plantilla', id: esTabFicha(tab) ? ef.plantillasTab[tab] : EN_BLANCO_HOJA.id };

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
  const yaEsta = !nueva && configurada && (vista == null || esLaDeHoy(ficha, mira, tab));

  /** Una tarjeta: la miniatura (o el boceto), el nombre y su marca chica. Tocarla la elige. */
  const carta = (o: { id: string; nombre: string; lista: BloquePuesto[]; epico: boolean; blanco: boolean; mirada: boolean; marca: string | null; titulo: string; etiqueta: string; pt?: PlantillaTab; onTocar: () => void }) => (
    <div key={o.id} className="fb-gal-carta" data-plantilla={o.id} data-elegida={o.mirada || undefined} data-sugerida={o.marca === 'Sugerido' ? 'si' : undefined}>
      <button type="button" className="fb-gal-tocar" aria-pressed={o.mirada} title={o.titulo} aria-label={o.etiqueta} onClick={o.onTocar} />
      {o.blanco ? (
        <span className="fb-gal-mini fb-gal-mini--vacia"><span aria-hidden>＋</span></span>
      ) : miniatura ? miniatura(o.lista, o.epico) : (
        <span className={`fb-gal-mini${o.epico ? ' fb-gal-mini--epica' : ''}`} aria-hidden>
          {o.epico && <span className="fb-gal-titular" />}
          {o.pt && miniaturaDe(o.pt, ficha.respaldo, registrado).map((x, i) => (
            <span key={`${x.id}:${i}`} className="fb-gal-pieza" style={{ '--s': x.span } as CSSProperties}>{x.titulo}</span>
          ))}
        </span>
      )}
      <span className="fb-gal-pie">
        <span className="fb-gal-nombre">{o.nombre}</span>
        {o.marca && <span className="fb-gal-sugerido">{o.marca}</span>}
      </span>
    </div>
  );

  // «Toda la ficha» como templates: la que eligió MaKo primero (con «Sugerido»), después las demás.
  const deMako = ficha.eleccion.id;
  const todas = esTabFicha(tab) && onTodaLaFicha && !nueva
    ? [PLANTILLAS_FICHA.find((p) => p.id === deMako), ...PLANTILLAS_FICHA.filter((p) => p.id !== deMako)].filter((p): p is (typeof PLANTILLAS_FICHA)[number] => !!p)
    : [];
  const tocada = ef.configuradas.length > 0 || ef.avisos.some((a) => a.por === 'a-mano') || ef.plantillaAMano;

  return (
    <>
      <section className="fb-galeria" aria-label={nueva ? 'Nueva hoja' : `Plantillas de ${nombreTab}`}>
        {/* Sin «Ahora no» desde el 16/10/2026 (Martín): la galería se abre sólo con «Templates» y «Cerrar» se queda con
            la de hoy. */}
        <button type="button" className="fb-boton-texto fb-galeria-cerrar" onClick={onCerrar} title={nueva ? 'Sin crear la hoja' : 'Se queda la de hoy'}>
          Cerrar
        </button>
        {/* 1 · ¿Qué vas a crear hoy? — LA caja de la casa (la de «Nueva hoja», Automations y el Web Generator). */}
        <div className="gp cp-casa fb-galeria-caja" data-pedido-mako="">
          <style>{CSS_TOKENS_CASA + CSS_CAJA_PEDIDO}</style>
          <CajaPedido titulo={{ texto: TITULO_CAJA, nivel: 2 }} valor={pedido} onValor={setPedido} onEnviar={() => { void enviar(); }}
            ejemplos={esTabFicha(tab) ? EJEMPLOS_TAB[tab] : EJEMPLOS_HOJA} animar placeholderQuieto="Escribe o dicta qué quieres ver"
            etiqueta={nueva ? 'Qué quieres ver en la hoja nueva' : `Qué quieres ver en ${nombreTab}`}
            tope={TOPE_PEDIDO_TAB} deshabilitado={pensando} onError={(m) => setError(m ? { texto: m } : null)} />
          {pensando && (
            <div role="status" aria-live="polite" style={S.estado}>
              <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
              <span style={S.dim}>· los bloques de {nueva ? 'la hoja' : nombreTab} · {segundos} s</span>
              <span style={{ marginLeft: 'auto' }}><Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button></span>
            </div>
          )}
          {error && (
            <p role="alert" style={S.error}>
              {error.texto}{error.link && <> <LinkIntegracion href={error.link} style={S.link}>Abrir</LinkIntegracion></>}
            </p>
          )}
        </div>

        {/* 2 · Las plantillas: «En blanco» primera siempre, las sugeridas y el resto. Tocar una la elige. */}
        <div className="fb-gal-grilla">
          {galeria.map(({ plantilla: p, porque }) => {
            const blanco = p.bloques.length === 0;
            // Sin nada mirándose (no hay lo que armó MaKo abajo), la marcada es la que la tab ya usa.
            const mirada = vista ? mira.tipo === 'plantilla' && mira.id === p.id : p.id === enUso;
            // En una hoja propia, en el lugar de «Sugerido», la tab de la que es la plantilla.
            const marca = p.id === enUso ? 'En uso' : porque ? 'Sugerido' : !esTab && !blanco ? NOMBRE_TAB[p.tab] : null;
            return carta({
              id: p.id, nombre: p.nombre, lista: blanco ? [] : listaDeEntradaTab(p, p.tab, ficha.respaldo), epico: !!p.epico, blanco, mirada, marca, pt: p,
              titulo: porque ? `${p.bajada} ${porque}` : p.bajada,
              etiqueta: `Usar la plantilla ${p.nombre}${porque ? ` (sugerida: ${porque})` : ''}`,
              onTocar: () => { setAviso(null); onElegir({ tipo: 'plantilla', id: p.id }); },
            });
          })}
        </div>

        {/* 3 · Toda la ficha, como templates: cambian las cuatro tabs (y los avisos que nacen apagados). La miniatura es
            ESTA tab con esa plantilla. */}
        {todas.length > 0 && esTabFicha(tab) && onTodaLaFicha && (
          <div className="fb-gal-toda">
            <div className="fb-gal-sub">
              <span>Para toda la ficha</span>
              <span className="fb-gal-sub-linea">Cambia las cuatro tabs de este funnel.</span>
              {tocada && <button type="button" className="fb-boton-texto" onClick={() => onTodaLaFicha('volver')} title="Las tabs, sus nombres y los avisos como los trae su plantilla. El estilo y las hojas propias quedan.">Volver toda la ficha</button>}
            </div>
            <div className="fb-gal-grilla">
              {todas.map((p) => {
                const enUsoToda = ef.plantilla === p.id;
                return carta({
                  id: `ficha-${p.id}`, nombre: p.nombre, lista: listaDeEntrada(p, tab, ficha.respaldo), epico: false, blanco: false, mirada: false,
                  marca: enUsoToda && ef.plantillaAMano ? 'En uso' : p.id === deMako ? 'Sugerido' : null,
                  titulo: p.id === deMako ? `La que elige MaKo: ${ficha.eleccion.porque}` : 'Cambia las cuatro tabs de este funnel.',
                  etiqueta: `Usar ${p.nombre} en toda la ficha`,
                  // La de MaKo se elige como «la de MaKo» (null): si mañana el funnel cambia, la ficha la sigue.
                  onTocar: () => onTodaLaFicha(p.id === deMako ? null : p.id),
                });
              })}
            </div>
          </div>
        )}
      </section>

      {/* 4 · SÓLO para lo que armó MaKo con la caja: se mira abajo, con los datos de este lead, y se elige acá. Una
          plantilla de la grilla se elige con un toque y no se previsualiza: «si el usuario aún no eligió plantilla no
          le salte toda la plantilla abajo con el botón de "usar sugerida"... Es confuso eso» (Martín, 16/10/2026). */}
      {vista?.tipo === 'mako' && <div className="fb-gal-barra" role="region" aria-label={`Elegir ${mirando}`}>
        {/* Sin «Vista previa: …» (16/10/2026, mismo pedido): la tab de abajo ya ES la vista previa. */}
        <span className="fb-gal-barra-txt">
          {aviso && <span className="fb-gal-barra-aviso">{aviso}</span>}
        </span>
        <Button size="sm" onClick={onUsar} disabled={yaEsta || pensando}>{nueva ? 'Crear la hoja' : yaEsta ? 'En uso' : rotuloUsar(mira, sugerida)}</Button>
      </div>}
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
