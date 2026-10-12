'use client';

// =============================================================================
// NuevaHoja — el modal de «Nueva hoja»: Pídeselo a MaKo, en blanco, o una plantilla (punto 19)
// =============================================================================
// Martín, 11/10/2026: «Al momento de crear un nuevo lienzo, replica el modal que tenemos en
// "Automations", en donde al principio tenemos la opción de "Pídeselo a MaKo" y abajo se le ofrece
// TEMPLATES». El molde es la galería v2 de Automations (docs/diseno-automations-galeria-v2.md §1 y
// §2), no la de hoy: sin rótulos de sección, el pedido ADENTRO del modal con su micrófono, el
// buscador, y «Hoja en blanco» primera siempre (ningún texto la saca).
//
// `onCrear` recibe la hoja YA saneada con ids nuevos (y, si la armó MaKo, el primer aviso de lo que
// ajustó, para el toast). El editor la agrega con `mutar` (una foto de deshacer) y la abre. Después
// de `onCrear` el modal llama a `onCerrar`: que el editor también lo cierre no rompe nada.
//
// ⚠️ LO QUE SE COPIÓ DE AUTOMATIONS ES LA FORMA, NO EL CÓDIGO. Allá la tarjeta y la caja de pedido
//    son CSS y componentes locales que otra sesión está rehaciendo (la décima tanda): de ahí se
//    IMPORTA lo exportado (`BotonDictar`, `CSS_NUEVO`) y lo demás vive acá con otro prefijo de clase.
// ⚠️ EL ESTADO «PENSANDO» VA ADENTRO DEL MODAL, no en una capa por portal: la de Automations es
//    `zIndex: 125` y un Modal de la pila arranca en 130 (app/_components/pila-modales.ts), así que
//    encima de éste quedaría DEBAJO, sin un error.
// ⚠️ CANCELAR SALE GRATIS: la ruta no escribe nada (app/api/graficos/ia/route.ts). Cerrar el modal
//    corta el pedido.
// ⚠️ `onCerrar` CON IDENTIDAD FIJA (`useCerrarEstable`) y el foco con `useFocoInicial`: con una
//    flecha nueva por render el textarea pierde el foco con cada letra, y `autoFocus` no llega porque
//    la caja nace escondida (AGENTS.md, «Todo `<Modal>`…»).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { BotonMako } from '@/app/_ui/BotonMako';
import Link from '@/app/_ui/Link';
import { MakoStar } from '@/app/_components/MakoBrand';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { CSS_NUEVO } from '@/app/automations/NuevoPlaceholder';
import { useCerrarEstable, useFocoInicial } from '@/app/customer-success/curso/dialogo-foco';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { FUENTES, hojaVacia, sanearHoja, type Hoja } from '@/lib/graficos-catalogo';
import { PLANTILLAS_HOJA, instanciarPlantilla } from '@/lib/graficos-plantillas';
import { filtrarPlantillasHoja } from '@/lib/graficos-plantillas-generales';
import { TOPE_PEDIDO_IA } from '@/lib/graficos-ia';

/** El tope de la ruta (`maxDuration = 120`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 125_000;
const ID_PEDIDO = 'nueva-hoja-pedido';

/**
 * Los ejemplos del placeholder: GENÉRICOS a propósito. Lo que mira un negocio cualquiera, sin el
 * nombre de una campaña, un producto ni un cliente (AGENTS.md: un ejemplo de UI es ficticio por regla).
 */
const EJEMPLOS_HOJA = [
  'Cuánto gasto en anuncios y cuánto me cuesta cada lead',
  'Los leads de la semana, por origen y por etapa',
  'Lo que cobré este mes y lo que falta cobrar',
  'Cómo rinden mis automatizaciones de WhatsApp',
  'Las llamadas de mis closers y cuántas cierran',
] as const;
const PLACEHOLDER_QUIETO = 'Escribe o dicta qué quieres ver';

// El ritmo del ejemplo que se escribe solo: el de «Generar con IA» de Automations.
const MS_LETRA = 60;
const MS_BORRAR = 28;
const MS_JITTER = 40;
const MS_QUIETA = 1900;

/**
 * El ejemplo que se escribe y se borra. Arranca con el primero COMPLETO (el HTML del server y el del
 * cliente coinciden) y con `activo` en false deja de moverse para siempre: el primer toque a la caja
 * lo apaga. Con `prefers-reduced-motion` no se mueve nunca.
 * ⚠️ Es el mecanismo de `useEjemploQueSeEscribe` (app/automations/CrearConIA.tsx), que no se exporta
 *    y vive en un archivo que otra sesión está rehaciendo. Cuando se exporte con los ejemplos por
 *    parámetro, esta copia se borra y se importa aquél.
 */
function useEjemplo(ejemplos: readonly string[], activo: boolean): string {
  const [i, setI] = useState(0);
  const [largo, setLargo] = useState<number>(ejemplos[0].length);
  const [borrando, setBorrando] = useState(false);
  const [quieto, setQuieto] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setQuieto(true);
    } catch { /* sin matchMedia */ }
  }, []);
  useEffect(() => {
    if (!activo || quieto) return;
    const frase = ejemplos[i];
    if (!borrando && largo === frase.length) {
      const t = setTimeout(() => setBorrando(true), MS_QUIETA);
      return () => clearTimeout(t);
    }
    if (borrando && largo === 0) {
      const t = setTimeout(() => { setBorrando(false); setI((x) => (x + 1) % ejemplos.length); }, 280);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLargo((l) => l + (borrando ? -1 : 1)), (borrando ? MS_BORRAR : MS_LETRA) + Math.random() * MS_JITTER);
    return () => clearTimeout(t);
  }, [ejemplos, activo, quieto, i, largo, borrando]);
  return ejemplos[i].slice(0, largo);
}

type Estado =
  | { t: 'quieto'; error?: string; link?: string }
  | { t: 'pensando'; desde: number };

// Sin backticks acá adentro: es un template literal. Sólo tokens de la app (se dan vuelta en oscuro).
const CSS = `
.nh-grilla{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(220px,100%),1fr));gap:12px}
.nh-tarjeta{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:16px;min-height:124px;box-sizing:border-box;border-radius:14px;border:1.5px solid var(--border);background:var(--surface);color:var(--ink);font-family:inherit;cursor:pointer;transition:border-color .14s ease,box-shadow .14s ease,transform .14s ease}
.nh-tarjeta:hover:not(:disabled),.nh-tarjeta:focus-visible{border-color:var(--primary);box-shadow:0 2px 12px color-mix(in srgb,var(--ink) 10%,transparent);outline:none}
.nh-tarjeta:active:not(:disabled){transform:scale(.98)}
.nh-blanco{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:124px;box-sizing:border-box;padding:16px;border-radius:14px;font-family:inherit;font-size:15px;font-weight:700;cursor:pointer}
.nh-buscar{display:flex;align-items:center;gap:8px;padding:0 12px;height:40px;box-sizing:border-box;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface);color:var(--dim)}
.nh-buscar:focus-within{border-color:var(--primary)}
.nh-buscar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--ink);font:inherit;font-size:14px}
@media (prefers-reduced-motion: reduce){.nh-tarjeta{transition:none}.nh-tarjeta:active:not(:disabled){transform:none}}
`;

export function NuevaHoja({ onCerrar, onCrear, enBlanco = 'Página nueva' }: {
  onCerrar: () => void;
  /** La hoja nueva, saneada y con ids nuevos. `aviso`: lo primero que MaKo ajustó, para el toast. */
  onCrear: (h: Hoja, aviso?: string) => void;
  /** El nombre de la «Hoja en blanco» (el editor le pasa «Página N»). */
  enBlanco?: string;
}) {
  const cerrar = useCerrarEstable(onCerrar);
  // Las props de AHORA para los handlers asincrónicos (un `onCrear` de hace un minuto cerraría sobre
  // el informe de entonces).
  const props = useRef({ onCrear, enBlanco });
  useEffect(() => { props.current = { onCrear, enBlanco }; });
  useFocoInicial(ID_PEDIDO);

  const [pedido, setPedido] = useState('');
  const [estado, setEstado] = useState<Estado>({ t: 'quieto' });
  const [ahora, setAhora] = useState(() => Date.now());
  const [busca, setBusca] = useState('');
  /** El placeholder ya no se mueve: alguien tocó la caja. No vuelve. */
  const [tocada, setTocada] = useState(false);
  const pensando = estado.t === 'pensando';
  const ejemplo = useEjemplo(EJEMPLOS_HOJA, !tocada && !pedido);
  const ctrl = useRef<AbortController | null>(null);
  const campoRef = useRef<HTMLTextAreaElement | null>(null);

  // El campo crece con lo que tiene (hasta 5 renglones), también cuando lo llena el dictado.
  useEffect(() => {
    const t = campoRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 132)}px`;
  }, [pedido]);

  // El reloj de lo que lleva: progreso real (GRAMATICA.analizando), sólo mientras piensa.
  useEffect(() => {
    if (!pensando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [pensando]);

  // Cerrar el modal corta el pedido: la ruta no escribió nada, así que no queda nada a medias.
  useEffect(() => () => ctrl.current?.abort(), []);

  /** Lo que sea que se eligió: la hoja al editor, y el modal se cierra. */
  const crear = (h: Hoja, aviso?: string) => {
    ctrl.current?.abort();
    ctrl.current = null;
    props.current.onCrear(h, aviso);
    cerrar();
  };

  const cancelar = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setEstado({ t: 'quieto' });
  };

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || pensando) return;
    setTocada(true);
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    setEstado({ t: 'pensando', desde: Date.now() });
    setAhora(Date.now());
    try {
      const res = await fetch('/api/graficos/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto }), signal: c.signal,
      });
      const j = await res.json().catch(() => null) as { ok?: boolean; hoja?: unknown; avisos?: unknown; error?: string; link?: string } | null;
      if (ctrl.current !== c) return;
      if (!res.ok || !j?.ok) { setEstado({ t: 'quieto', error: j?.error || `Error ${res.status}`, link: j?.link }); return; }
      // Lo que llega por la red se vuelve a sanear: la hoja vale por lo que dice el catálogo de acá.
      const h = sanearHoja(j.hoja, 0);
      if (!h || !h.componentes.length) { setEstado({ t: 'quieto', error: 'Llegó una hoja vacía. Prueba de nuevo.' }); return; }
      const avisos = Array.isArray(j.avisos) ? j.avisos.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
      setEstado({ t: 'quieto' });
      crear(h, avisos[0]);
    } catch {
      // Cancelar no es un error: la caja vuelve con el pedido escrito.
      if (ctrl.current !== c) return;
      setEstado({ t: 'quieto', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : 'Sin conexión. Prueba de nuevo.' });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const plantillas = useMemo(() => filtrarPlantillasHoja(PLANTILLAS_HOJA, busca), [busca]);
  const segundos = estado.t === 'pensando' ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;
  const parar = () => { if (!tocada) setTocada(true); };

  return (
    <Modal titulo="Nueva hoja" ancho={980} sinFiletes onCerrar={cerrar}>
      <style>{CSS_NUEVO}</style>
      <style>{CSS}</style>
      <div data-nueva-hoja="" style={S.todo}>
        {/* 1 · Pídeselo a MaKo */}
        <form style={S.caja} data-pedido-mako="" onSubmit={(e) => { e.preventDefault(); void enviar(); }}
          onPointerDownCapture={parar} onFocusCapture={parar}>
          <div style={S.encabezado}>
            <MakoStar size={18} animate={pensando} />
            <label htmlFor={ID_PEDIDO} style={S.titulo}>Pídeselo a MaKo</label>
          </div>
          <div style={S.fila}>
            <textarea
              ref={campoRef}
              id={ID_PEDIDO}
              value={pedido}
              onChange={(e) => { setPedido(e.target.value); parar(); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
              placeholder={tocada ? PLACEHOLDER_QUIETO : ejemplo}
              aria-label="Qué quieres ver en la hoja"
              rows={2}
              maxLength={TOPE_PEDIDO_IA}
              disabled={pensando}
              style={S.campo}
            />
            <BotonDictar titulo="Dictar el pedido" valor={pedido} onValor={(v) => { setPedido(v); parar(); }}
              onError={(m) => setEstado({ t: 'quieto', error: m })} />
          </div>
          {estado.t === 'quieto' && estado.error && (
            <p role="alert" style={S.error}><TextoConLink texto={estado.error} link={estado.link} /></p>
          )}
          <div style={S.pie}>
            {pensando ? (
              <>
                <span role="status" aria-live="polite" style={S.estado}>
                  <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
                  <span style={S.dim}> · {FUENTES.length} conjuntos de datos · {segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
                </span>
                <Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button>
              </>
            ) : (
              <>
                <span />
                {/* El botón de MaKo CHICO: sólo el logo sobre negro (tanda de la topbar, punto 3). Enter
                    también crea (el `onKeyDown` del campo). */}
                <BotonMako lado={36} title="Crear la hoja con MaKo" deshabilitado={!pedido.trim()} onClick={() => { void enviar(); }} />
              </>
            )}
          </div>
        </form>

        {/* 2 · El buscador */}
        <label className="nh-buscar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.4-4.4" />
          </svg>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar plantilla" aria-label="Buscar plantilla" />
        </label>

        {/* 3 · La grilla: «Hoja en blanco» primera SIEMPRE, después las plantillas */}
        <div className="nh-grilla">
          <button type="button" className="mk-nuevo nh-blanco" data-empezar="blanco"
            onClick={() => crear(hojaVacia(props.current.enBlanco))}>
            <span aria-hidden className="mk-nuevo__mas" style={{ fontSize: 22, lineHeight: 1 }}>＋</span>
            Hoja en blanco
          </button>
          {plantillas.map((p) => (
            <button key={p.id} type="button" className="nh-tarjeta" data-plantilla={p.id}
              onClick={() => crear(instanciarPlantilla(p))}>
              <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{p.emoji}</span>
              <span style={S.nombre}>{p.nombre}</span>
              <span style={S.linea}>{p.linea}</span>
            </button>
          ))}
        </div>
        {!plantillas.length && <div style={S.sinResultados}>Ninguna plantilla con eso</div>}
      </div>
    </Modal>
  );
}

/** El error, con la palabra «Integraciones» convertida en el link a donde se arregla (si lo hay). */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <Link href={link} style={S.link}>Abrir</Link></>;
  return <>{texto.slice(0, i)}<Link href={link} style={S.link}>Integraciones</Link>{texto.slice(i + 'Integraciones'.length)}</>;
}

// Sólo tokens que existen en claro y en oscuro (app/globals.css → [data-tema="oscuro"]).
const S: Record<string, CSSProperties> = {
  todo: { display: 'flex', flexDirection: 'column', gap: 16 },
  caja: {
    display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 18px 14px', borderRadius: 16,
    background: 'var(--mako-bg)', border: '1px solid var(--mako-border)',
  },
  encabezado: { display: 'flex', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 15, fontWeight: 700, color: 'var(--ink)' },
  fila: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  campo: {
    flex: 1, minWidth: 0, boxSizing: 'border-box', resize: 'none', padding: '10px 0', border: 'none',
    borderBottom: '2px solid var(--mako-border)', background: 'transparent', color: 'var(--ink)', font: 'inherit',
    fontSize: 16, lineHeight: 1.4, outline: 'none', overflowY: 'auto',
  },
  pie: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 36 },
  estado: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 2, minWidth: 0 },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  dim: { fontSize: 13, color: 'var(--dim)' },
  error: { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
  nombre: { fontSize: 15, fontWeight: 700, lineHeight: 1.25 },
  linea: { fontSize: 13, color: 'var(--dim)', lineHeight: 1.4 },
  sinResultados: { fontSize: 13, color: 'var(--dim)' },
};
