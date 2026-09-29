'use client';

// =============================================================================
// EtapasModal — el embudo entero se edita SIN salir del CRM
// =============================================================================
// «Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo
// CRM. Así es más simple. Y que sea simple la edición, nada compleja» (28/09/2026).
//
// ⚠️ NO ES `FunnelEditor` ADENTRO DE UN `Modal`. Ese editor eran 527 líneas que dibujaban
// el mapa de transiciones, las plantillas de canal y la tarjeta de entradas, autoguardaban
// el jsonb ENTERO con un debounce por tecla y asumían que eran la pantalla. Se borró el
// 29/09: dos editores del mismo jsonb divergen, y la única pregunta es cuándo.
//
// ⚠️ Y CADA CAMBIO ES UNA OPERACIÓN, no un «Guardar» al final. Al tablero le llegan las
// etapas ya DERIVADAS —el pipeline crudo nunca sale del server— así que mandar una lista
// reconstruida desde acá le haría perder todo lo que la derivación agrega y quita.
//
// ── Lo que cambió con la segunda tanda del 29/09, con el pedido al lado ────────────────
//  · UN solo botón de cerrar (la ✕ de arriba). «Dos botones de cerrar... no entiendo la
//    lógica de eso»: el pie quedó para lo único que va abajo a la izquierda, eliminar.
//  · SIN líneas divisorias. «Quedan mal».
//  · SIN el bloque de las cuatro terminales. «Si quieren cambiar el nombre ya lo pueden
//    hacer en los 3 puntos de la columna».
//  · SIN FRICCIÓN cuando no hay nada que perder. «Si intento eliminar una columna que NO
//    tiene ningún lead, no debería haber nada de fricción. Solo que me salte el pop-up de
//    deshacer». Con leads adentro, ahí sí un diálogo — y un diálogo, no un recuadro abajo.
//  · Las etapas SE ARRASTRAN, con el molde de las filas del plan.
//  · El input del nombre abre SÓLO desde el texto, no desde toda la fila.
//  · «Cómo entran» dejó de ser una subtab: es un desplegable de acá, y una pregunta del
//    alta de producto.

import { useCallback, useEffect, useRef, useState, useTransition, type CSSProperties, type DragEvent as DragReact } from 'react';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { Modal } from '@/app/_ui/Modal';
import { Confirm } from '@/app/_ui/Confirm';
import { Toast, useToast } from '@/app/_ui/Toast';
import { MAX_LABEL_ETAPA } from '@/lib/pipeline';
import {
  editarEtapaAction, embudoEnDetalleAction, renombrarEmbudoAction, archivarEmbudoAction,
  restaurarEmbudoAction, conteosDeEtapasAction,
  type EmbudoEnDetalle, type EtapaDelFunnel, type OpEtapa, type DeshacerEtapa,
} from './actions';
import { EmbudoEntradas } from './EmbudoEntradas';

const SANS = "'Geist', sans-serif";

/** La línea de 2 px que dice dónde va a caer la etapa que se está arrastrando. */
const MARCA: CSSProperties = { boxShadow: 'inset 0 2px 0 0 var(--primary)' };
const MARCA_FIN: CSSProperties = { boxShadow: 'inset 0 -2px 0 0 var(--primary)' };

/** El botoncito de una acción por fila. Sin texto: el `aria-label` lleva la frase. */
function AccionFila({ etiqueta, onClick, disabled, children }: {
  etiqueta: string; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={etiqueta} title={etiqueta} data-nodrag
      style={{
        width: 28, height: 28, flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 8, border: '1px solid transparent', background: 'transparent', fontFamily: SANS, fontSize: 13,
        color: disabled ? 'var(--faint)' : 'var(--dim)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
      }}
    >{children}</button>
  );
}

/** El loader. Nunca la palabra «Cargando…»: un texto no dice que algo está pasando. */
function Cargando() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
      <span aria-label="Cargando" role="status" style={{
        width: 22, height: 22, borderRadius: '50%',
        border: '2.5px solid var(--border)', borderTopColor: 'var(--primary)',
        animation: 'mk-giro .7s linear infinite', display: 'inline-block',
      }} />
      <style>{'@keyframes mk-giro{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

type Sub = 'etapas' | 'nutricion';

export function EtapasModal({ funnelId, nombre, abrirEntradas, onCerrar }: {
  /** El embudo que se edita. `null`/`undefined` = el del negocio. */
  funnelId?: number | null;
  /** Cómo se llama, para pintar el título sin esperar la lectura. */
  nombre: string;
  /**
   * Abrir con el desplegable de «Cómo entran» ya desplegado.
   *
   * Lo pide la URL (`?embudo=entradas`) para que un link pueda llevar a una CONFIGURACIÓN
   * y no sólo a una pantalla: el panel de tracking que ve el cliente en su landing dice
   * «activar la landing como entrada de leads», y eso es una casilla de ahí adentro.
   */
  abrirEntradas?: boolean;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const ws = useWs();
  const { toast, show, clear } = useToast();
  const [sub, setSub] = useState<Sub>('etapas');
  const [emb, setEmb] = useState<EmbudoEnDetalle | null>(null);
  const [conteos, setConteos] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renombrando, setRenombrando] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<{ titulo: string; cuerpo: string; boton: string; hacer: () => void } | null>(null);
  const [entradasAbierto, setEntradasAbierto] = useState(abrirEntradas === true);
  const [ordenLocal, setOrdenLocal] = useState<EtapaDelFunnel[] | null>(null);
  const [trabajando, startTrabajo] = useTransition();

  const cargar = useCallback(async () => {
    const r = await embudoEnDetalleAction(funnelId ?? undefined);
    if (!r.ok) { setError(r.error); return; }
    setError(null);
    setEmb(r.embudo);
    setOrdenLocal(null);
  }, [funnelId]);

  useEffect(() => { void cargar(); }, [cargar]);
  // Los conteos llegan DESPUÉS y no bloquean la apertura: derivarlos exige traer los leads.
  // Mientras no estén, quitar una etapa pregunta — el default seguro es la fricción.
  useEffect(() => {
    let vivo = true;
    void conteosDeEtapasAction(funnelId ?? undefined).then((c) => { if (vivo) setConteos(c); }).catch(() => {});
    return () => { vivo = false; };
  }, [funnelId]);

  const etapas = ordenLocal ?? emb?.etapas ?? [];

  const aplicar = (op: OpEtapa, onListo?: (d?: DeshacerEtapa) => void) => {
    startTrabajo(async () => {
      const r = await editarEtapaAction(op, funnelId ?? undefined);
      if (!r.ok) { setError(r.error); setOrdenLocal(null); return; }
      setError(null);
      setRenombrando(null);
      await cargar();
      void conteosDeEtapasAction(funnelId ?? undefined).then(setConteos).catch(() => {});
      // El tablero de atrás se refresca en CADA cambio: sus columnas se leen en el server,
      // y sin esto quien renombra una etapa y mira detrás del pop-up ve el nombre viejo.
      router.refresh();
      onListo?.(r.deshacer);
    });
  };

  // ── mover una etapa ────────────────────────────────────────────────────────────────
  // ⚠️ OPTIMISTA. Antes cada flecha esperaba al server y recién después repintaba: «cuando
  // muevo de lugar una columna o etapa, se tarda muchísimo». El orden lo pinta el navegador
  // al instante; el server confirma detrás y `cargar()` resincroniza.
  const mover = (key: string, delta: -1 | 1) => {
    const i = etapas.findIndex((e) => e.key === key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= etapas.length) return;
    const orden = [...etapas];
    [orden[i], orden[j]] = [orden[j], orden[i]];
    setOrdenLocal(orden);
    aplicar({ op: 'mover', key, delta });
  };

  const soltarEn = (key: string, destino: number) => {
    const i = etapas.findIndex((e) => e.key === key);
    if (i < 0) return;
    const resto = etapas.filter((e) => e.key !== key);
    // El índice se corre uno cuando la etapa venía de más arriba, o soltar hacia abajo
    // cae un lugar antes.
    const pos = i < destino ? destino - 1 : destino;
    if (pos === i) return;
    const orden = [...resto.slice(0, pos), etapas[i], ...resto.slice(pos)];
    setOrdenLocal(orden);
    aplicar({ op: 'reordenar', keys: orden.map((e) => e.key) });
  };

  // ── el arrastre, con el molde de las filas del plan ────────────────────────────────
  // La foto que sigue al cursor la dibuja el SISTEMA OPERATIVO y ninguna regla CSS la
  // gobierna: se le pasa una VACÍA y la copia la dibujamos nosotros, movida con `transform`
  // sobre un ref (un `setState` por `dragover` redibuja la lista 60 veces por segundo).
  const agarrada = useRef<string | null>(null);
  const copia = useRef<HTMLElement | null>(null);
  const medios = useRef<number[]>([]);
  const lista = useRef<HTMLDivElement | null>(null);
  const [ins, setIns] = useState<number | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const limpiarDrag = () => {
    setIns(null);
    setArrastrando(null);
    medios.current = [];
    agarrada.current = null;
    copia.current?.remove();
    copia.current = null;
  };

  const agarrar = (e: DragReact<HTMLDivElement>, key: string) => {
    // Donde se escribe texto no arranca el arrastre: ahí arrastrar significa seleccionar.
    if ((e.target as HTMLElement | null)?.closest?.('[data-nodrag]')) { e.preventDefault(); return; }
    const fila = e.currentTarget;
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    try {
      const vacio = document.createElement('canvas');
      vacio.width = 1; vacio.height = 1;
      e.dataTransfer.setDragImage(vacio, 0, 0);
    } catch { /* si no deja, queda la del navegador */ }

    medios.current = [...(lista.current?.querySelectorAll<HTMLElement>('[data-etapa]') ?? [])]
      .map((f) => { const r = f.getBoundingClientRect(); return r.top + r.height / 2; });

    const r = fila.getBoundingClientRect();
    const clon = fila.cloneNode(true) as HTMLElement;
    Object.assign(clon.style, {
      position: 'fixed', top: '0', left: '0', width: `${r.width}px`, margin: '0',
      background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '10px',
      boxShadow: '0 18px 40px rgba(18,21,27,.34)', pointerEvents: 'none', zIndex: '3000',
      transform: `translate3d(${r.left}px, ${r.top}px, 0)`, transition: 'none', opacity: '1',
    });
    document.body.appendChild(clon);
    copia.current = clon;

    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const seguir = (ev: globalThis.DragEvent) => {
      if (!copia.current) { document.removeEventListener('dragover', seguir, true); return; }
      copia.current.style.transform = `translate3d(${ev.clientX - dx}px, ${ev.clientY - dy}px, 0)`;
    };
    document.addEventListener('dragover', seguir, true);
    const fin = () => {
      document.removeEventListener('dragover', seguir, true);
      document.removeEventListener('dragend', fin, true);
      document.removeEventListener('drop', fin, true);
      copia.current?.remove();
      copia.current = null;
    };
    document.addEventListener('dragend', fin, true);
    document.addEventListener('drop', fin, true);
    agarrada.current = key;
    // Al nodo ORIGEN no se le toca el TAMAÑO: se marca. Y va en el tick siguiente, porque
    // el navegador saca la foto del arrastre al terminar este handler.
    setTimeout(() => setArrastrando(key), 0);
  };

  const guardarNombreEtapa = (e: EtapaDelFunnel, valor: string) => {
    const limpio = valor.trim();
    // Sin cambio no se escribe: el `onBlur` también salta al apretar Escape.
    if (!limpio || limpio === e.label) { setRenombrando(null); return; }
    aplicar({ op: 'renombrar', key: e.key, label: limpio });
  };

  const guardarNombreEmbudo = (valor: string) => {
    const limpio = valor.trim();
    if (!emb || !limpio || limpio === emb.nombre) return;
    startTrabajo(async () => {
      const r = await renombrarEmbudoAction(funnelId ?? null, limpio);
      if (!r.ok) { setError(r.error); return; }
      setError(null);
      await cargar();
      router.refresh();
    });
  };

  // ── quitar una etapa ───────────────────────────────────────────────────────────────
  // ⚠️ SIN FRICCIÓN SI NO HAY NADA QUE PERDER. Con cero leads se quita y sale el toast con
  // «Deshacer» los 5 segundos que dura. Con leads adentro se pregunta, porque ahí el
  // deshacer no alcanza: quedan fuera del embudo mientras tanto.
  const quitarEtapa = (e: EtapaDelFunnel) => {
    const n = conteos?.[e.key];
    const hacer = () => aplicar({ op: 'eliminar', key: e.key }, (d) => {
      show(`Quitada «${e.label}»`, d ? () => aplicar({ op: 'insertar', etapa: d.etapa, at: d.at }) : undefined);
    });
    if (n === 0) { hacer(); return; }
    setConfirmar({
      titulo: `Quitar «${e.label}»`,
      cuerpo: n == null
        ? 'No se pudo contar cuántos leads tiene. Los que estén ahí no se borran: quedan fuera del embudo hasta que los muevas.'
        : `Sus ${n} ${n === 1 ? 'lead queda' : 'leads quedan'} fuera del embudo hasta que los muevas. No se borran.`,
      boton: 'Quitar la etapa',
      hacer,
    });
  };

  // ── eliminar el producto ───────────────────────────────────────────────────────────
  const archivar = (conAviso: boolean) => {
    if (funnelId == null || !emb) return;
    startTrabajo(async () => {
      const r = await archivarEmbudoAction(funnelId);
      if (!r.ok) { setError(r.error); return; }
      if (conAviso) {
        onCerrar();
        show(`Eliminado «${emb.nombre}»`, () => {
          void restaurarEmbudoAction(funnelId).then(() => { window.location.href = conWs(`/crm?funnel=${funnelId}`, ws); });
        });
        router.refresh();
        return;
      }
      // ⚠️ NAVEGACIÓN DURA, no `router.refresh()`: lo que cambió no es una fila sino QUÉ
      // EMBUDOS EXISTEN, y medido en el navegador el refresh deja la lista un paso atrás.
      // Y con `conWs`, o el super admin que mira a un cliente termina en su propio CRM.
      window.location.href = conWs('/crm', ws);
    });
  };

  const eliminarProducto = () => {
    if (funnelId == null || !emb) return;
    // Sin leads no hay nada que perder: se elimina y queda el deshacer del toast.
    if (emb.leads === 0) { archivar(true); return; }
    setConfirmar({
      titulo: `Eliminar «${emb.nombre}»`,
      cuerpo: emb.leads > 0
        ? `Sus ${emb.leads} ${emb.leads === 1 ? 'lead deja' : 'leads dejan'} de verse hasta que lo recuperes. Se guarda entero y vuelve desde «Embudos eliminados».`
        : 'No se pudo contar cuántos leads tiene. Se guarda entero y vuelve desde «Embudos eliminados».',
      boton: 'Eliminar el producto',
      hacer: () => archivar(false),
    });
  };

  const fila: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px',
    borderRadius: 10, background: 'var(--surface-2)',
  };

  return (
    <>
      <Modal
        titulo={
          // El título es un CAMPO: «Junto con editar el nombre del funnel/producto».
          // Ojo: si el embudo tiene producto principal, esto renombra el PRODUCTO — la
          // pantalla muestra ese nombre, así que tocar el otro no se vería.
          <input
            defaultValue={emb?.nombre ?? nombre}
            key={emb?.nombre ?? nombre}
            maxLength={60}
            aria-label="Nombre del producto"
            onBlur={(e) => guardarNombreEmbudo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            style={{
              width: '100%', fontFamily: SANS, fontWeight: 600, fontSize: 21, letterSpacing: '-0.01em',
              color: 'var(--ink)', background: 'transparent', border: '1px solid transparent',
              borderRadius: 8, padding: '2px 8px', margin: '0 0 0 -8px', outline: 'none',
            }}
            onFocus={(e) => { e.target.style.background = 'var(--surface-2)'; e.target.style.borderColor = 'var(--primary)'; }}
            onBlurCapture={(e) => { e.target.style.background = 'transparent'; e.target.style.borderColor = 'transparent'; }}
          />
        }
        ancho={760}
        // El alto es un NÚMERO y no un tope: las dos subtabs miden cosas distintas, y una
        // caja que se achica según lo que tenga adentro ya se reportó dos veces.
        alto="min(85vh, 620px)"
        etiqueta={`Editar el producto ${emb?.nombre ?? nombre}`}
        onCerrar={onCerrar}
        pie={
          // ⚠️ UN SOLO BOTÓN DE CERRAR (la ✕ de arriba). Acá abajo va sólo eliminar, a la
          // izquierda y como TEXTO rojo — no como botón.
          emb && !emb.esDefault && funnelId != null ? (
            <div style={{ flex: 1, display: 'flex' }}>
              <button type="button" onClick={eliminarProducto} disabled={trabajando}
                style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bad)', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: trabajando ? 'default' : 'pointer' }}>
                Eliminar producto
              </button>
            </div>
          ) : undefined
        }
      >
        {/* Las dos subtabs. Cortadas por PREGUNTA: por dónde pasa un lead, y qué se le
            manda cuando se enfría. */}
        <div style={{ display: 'inline-flex', background: 'var(--surface-2)', borderRadius: 999, padding: 3, marginBottom: 18 }}>
          {([['etapas', 'Etapas'], ['nutricion', 'Nutrición']] as Array<[Sub, string]>).map(([k, txt]) => (
            <button key={k} type="button" onClick={() => setSub(k)}
              style={{
                border: 'none', background: sub === k ? 'var(--surface)' : 'transparent',
                color: sub === k ? 'var(--ink)' : 'var(--dim)', fontWeight: sub === k ? 600 : 500,
                fontSize: 13.5, padding: '7px 16px', borderRadius: 999, cursor: 'pointer', fontFamily: SANS,
                boxShadow: sub === k ? '0 1px 2px rgba(18,21,27,.08)' : 'none',
              }}>{txt}</button>
          ))}
        </div>

        {!emb && !error && <Cargando />}

        {emb && sub === 'etapas' && (
          <>
            {/* Los avisos de embudo roto. AVISAN, no bloquean: guardar nunca se bloquea.
                Van arriba porque debajo de la lista ya nadie los lee. */}
            {emb.problemas.length > 0 && (
              <div style={{ display: 'grid', gap: 6, marginBottom: 12 }}>
                {emb.problemas.map((t) => (
                  <p key={t} style={{ margin: 0, padding: '9px 12px', borderRadius: 10, background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: 13, lineHeight: 1.5 }}>{t}</p>
                ))}
              </div>
            )}

            <div ref={lista} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              onDragOver={(e) => {
                if (!agarrada.current) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                const m = medios.current;
                let idx = m.length;
                for (let i = 0; i < m.length; i++) { if (e.clientY < m[i]) { idx = i; break; } }
                // Sólo se repinta cuando el destino CAMBIA: un `setState` por `dragover`
                // redibuja la lista 60 veces por segundo y el gesto se siente roto.
                setIns((p) => (p === idx ? p : idx));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const key = e.dataTransfer.getData('text/plain') || agarrada.current;
                const destino = ins ?? etapas.length;
                limpiarDrag();
                if (key) soltarEn(key, destino);
              }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIns(null); }}
            >
              {etapas.map((e, i) => (
                <div key={e.key} data-etapa draggable
                  onDragStart={(ev) => agarrar(ev, e.key)}
                  onDragEnd={limpiarDrag}
                  style={{
                    ...fila,
                    cursor: 'grab',
                    // Al nodo ORIGEN no se le toca el tamaño: se marca con un borde.
                    outline: arrastrando === e.key ? '1px solid var(--border-strong)' : 'none',
                    ...(ins === i ? MARCA : ins === i + 1 && i === etapas.length - 1 ? MARCA_FIN : null),
                  }}>
                  <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: e.dot }} />
                  {renombrando === e.key ? (
                    <input
                      autoFocus defaultValue={e.label} maxLength={MAX_LABEL_ETAPA} data-nodrag
                      onBlur={(ev) => guardarNombreEtapa(e, ev.target.value)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur();
                        if (ev.key === 'Escape') setRenombrando(null);
                      }}
                      style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
                    />
                  ) : (
                    // ⚠️ EL INPUT ABRE SÓLO DESDE EL TEXTO: «solo si clickeo en el texto del
                    // título de esa etapa debería abrirme el input, no en toda la fila».
                    // Por eso el botón NO estira: el hueco lo llena un span, que además es
                    // por donde se agarra para arrastrar.
                    <>
                      <button type="button" data-nodrag onClick={() => setRenombrando(e.key)}
                        title={`Cambiar el nombre de ${e.label}`}
                        style={{ flex: 'none', maxWidth: '70%', textAlign: 'left', fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'none', border: 'none', padding: '4px 0', cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >{e.label}</button>
                      <span style={{ flex: 1 }} />
                    </>
                  )}
                  <AccionFila etiqueta={`Subir ${e.label}`} disabled={trabajando || i === 0}
                    onClick={() => mover(e.key, -1)}>↑</AccionFila>
                  <AccionFila etiqueta={`Bajar ${e.label}`} disabled={trabajando || i === etapas.length - 1}
                    onClick={() => mover(e.key, 1)}>↓</AccionFila>
                  <AccionFila etiqueta={`Quitar ${e.label}`} disabled={trabajando}
                    onClick={() => quitarEtapa(e)}>✕</AccionFila>
                </div>
              ))}

              {/* «Agregar etapa si le paso el cursor debería reaccionar y al apretarle como
                  mínimo que me pida el nombre de la nueva etapa». */}
              <NuevaEtapa disabled={trabajando} onCrear={(label) => aplicar({ op: 'agregar', label })} />
            </div>

            {/* «Cómo entran» dejó de ser una subtab: «esto se debería poder editar con un
                desplegable luego, una vez ya está creado el producto, en la tab de etapas». */}
            <div style={{ marginTop: 20 }}>
              <button type="button" onClick={() => setEntradasAbierto((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', fontFamily: SANS, fontSize: 13.5, fontWeight: 600, color: 'var(--dim)' }}>
                <span style={{ fontSize: 9, transform: entradasAbierto ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>▶</span>
                Cómo entran
                {emb.entradas.length === 0 && <span style={{ fontWeight: 500, color: 'var(--warn)' }}>· sin declarar</span>}
              </button>
              {entradasAbierto && (
                <div style={{ paddingTop: 6 }}>
                  <EmbudoEntradas
                    key={`${emb.id}:${emb.entradas.join(',')}`}
                    initial={emb.entradas} initialEvento={emb.evento} canal={emb.canal}
                    funnelId={funnelId ?? undefined}
                    onGuardado={() => { void cargar(); router.refresh(); }}
                  />
                </div>
              )}
            </div>
          </>
        )}

        {emb && sub === 'nutricion' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {emb.nutriciones.length === 0 ? (
              <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.55 }}>
                Este embudo no tiene nutriciones. Salen de las etapas: agrega una reunión o un pago y aparecen solas.
              </p>
            ) : emb.nutriciones.map((n) => (
              <label key={n.id}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 12px', borderRadius: 10, background: 'var(--surface-2)', cursor: trabajando ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={n.activa} disabled={trabajando}
                  onChange={(e) => aplicar({ op: 'nutricion', id: n.id, activa: e.target.checked })}
                  style={{ width: 16, height: 16, flex: 'none', accentColor: 'var(--primary)', cursor: trabajando ? 'default' : 'pointer' }} />
                <span style={{ minWidth: 0, fontFamily: SANS, fontSize: 14, color: n.activa ? 'var(--ink)' : 'var(--faint)' }}>
                  <strong style={{ fontWeight: 600 }}>{n.desdeLabel}</strong>
                  <span style={{ color: 'var(--faint)', margin: '0 7px' }}>→</span>
                  {n.haciaLabel}
                </span>
              </label>
            ))}
          </div>
        )}

        {error && (
          <div style={{ marginTop: 12, borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{error}</div>
        )}
      </Modal>

      {/* Cuando SÍ hay algo que perder, se pregunta con un DIÁLOGO — no con un recuadro
          abajo, que es lo que se reportó. */}
      {confirmar && (
        <Confirm
          title={confirmar.titulo}
          message={confirmar.cuerpo}
          confirmLabel={confirmar.boton}
          cancelLabel="No, dejarla"
          onCancel={() => setConfirmar(null)}
          onConfirm={() => { const f = confirmar.hacer; setConfirmar(null); f(); }}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

/**
 * «+ Agregar etapa»: reacciona al cursor y PIDE el nombre.
 *
 * Antes creaba una «Nueva etapa» sin preguntar y había que renombrarla después — dos pasos
 * para lo que es uno, y mientras tanto una columna con un nombre que no significa nada.
 */
function NuevaEtapa({ disabled, onCrear }: { disabled?: boolean; onCrear: (label: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [hover, setHover] = useState(false);
  const [txt, setTxt] = useState('');

  const cerrar = (guardar: boolean) => {
    const v = txt.trim();
    setTxt('');
    setAbierto(false);
    if (guardar && v) onCrear(v);
  };

  if (abierto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px 7px 11px', borderRadius: 10, background: 'var(--surface-2)' }}>
        <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: '#5B6472' }} />
        <input
          autoFocus value={txt} maxLength={MAX_LABEL_ETAPA} placeholder="¿Cómo se llama?"
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') cerrar(true);
            if (e.key === 'Escape') cerrar(false);
          }}
          onBlur={() => cerrar(true)}
          style={{ flex: 1, minWidth: 0, fontFamily: SANS, fontWeight: 600, fontSize: 14, color: 'var(--ink)', background: 'var(--surface)', border: '1px solid var(--primary)', borderRadius: 7, padding: '4px 8px', outline: 'none' }}
        />
      </div>
    );
  }
  return (
    <button
      type="button" disabled={disabled}
      onClick={() => setAbierto(true)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        marginTop: 2, padding: '10px 12px', borderRadius: 10,
        border: '1px dashed ' + (hover ? 'var(--primary)' : 'var(--border-strong)'),
        background: hover ? 'var(--primary-weak)' : 'none',
        color: hover ? 'var(--primary)' : 'var(--dim)',
        fontFamily: SANS, fontSize: 13.5, fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer', textAlign: 'left',
        transition: 'background .12s, border-color .12s, color .12s',
      }}
    >
      + Agregar etapa
    </button>
  );
}
