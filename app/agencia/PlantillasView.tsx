'use client';

// =============================================================================
// PlantillasView — plantillas de MaKo COMO CHAT + CRUD (crear/editar/activar/borrar)
// =============================================================================
// Lista del store (catálogo + custom). "Crear nueva" arriba (contacto gris). El
// ejemplo se "escribe" solo (preview interactiva). La topbar / Editar abre el
// detalle (que cubre todo el chat) con edición + activar/desactivar + probar IA.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { ChatHilo, type HiloMsg } from '../whatsapp/_shared/ChatHilo';
import { TemplateDetalleModal, type PlantillaVista } from './TemplateDetalleModal';
import { EMOJI_CATEGORIA, type CategoriaAviso } from '@/lib/avisos-catalogo';

const ORDEN: CategoriaAviso[] = ['reporte', 'aviso', 'accion', 'pregunta'];
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reportes', aviso: 'Avisos', accion: 'Acciones', pregunta: 'Preguntas' };

const respuestaDueno = (a: PlantillaVista) => (a.categoria === 'accion' ? 'Sí, adelante 👍' : a.categoria === 'pregunta' ? 'Adelante, pásamelo' : '👍');
const replicaMaKo = (a: PlantillaVista) => (a.categoria === 'accion' ? '✅ Listo, lo hago ahora y te confirmo cuando esté. — MaKo' : 'Genial, te lo preparo y te lo paso en un rato. 🙌 — MaKo');

type Paso = { t: 'typing'; lado: 'left' | 'right'; autor?: string } | { t: 'msg'; msg: HiloMsg };
function guion(a: PlantillaVista): Paso[] {
  const g: Paso[] = [
    { t: 'typing', lado: 'left', autor: 'MaKo' },
    { t: 'msg', msg: { id: `${a.id}-1`, fromMe: false, autor: 'MaKo', texto: a.ejemplo, fecha: new Date().toISOString() } },
  ];
  if (a.requiereRespuesta) {
    g.push({ t: 'typing', lado: 'right' });
    g.push({ t: 'msg', msg: { id: `${a.id}-2`, fromMe: true, texto: respuestaDueno(a), fecha: new Date().toISOString() } });
    g.push({ t: 'typing', lado: 'left', autor: 'MaKo' });
    g.push({ t: 'msg', msg: { id: `${a.id}-3`, fromMe: false, autor: 'MaKo', texto: replicaMaKo(a), fecha: new Date().toISOString() } });
  }
  return g;
}

export function PlantillasView({ endpoint = '/api/admin/plantillas', iniciales }: {
  endpoint?: string;
  /** Las plantillas que ya trajo el SERVER: sin esto la pantalla las pide al montar y
   *  la lista aparece ~800 ms después de que se dibuja todo lo demás. */
  iniciales?: PlantillaVista[];
} = {}) {
  const [plantillas, setPlantillas] = useState<PlantillaVista[] | null>(iniciales ?? null);
  const [filtro, setFiltro] = useState<CategoriaAviso | 'todas'>('todas');
  const [busq, setBusq] = useState('');
  const [selId, setSelId] = useState<string>('');
  const [mensajes, setMensajes] = useState<HiloMsg[]>([]);
  const [typing, setTyping] = useState<{ lado: 'left' | 'right'; autor?: string } | null>(null);
  /**
   * ⚠️ EDITAR ES LA VISTA POR DEFAULT, Y EL CHAT PASÓ A SER «PROBAR».
   *
   * Pedido el 04/10/2026: «quiero que la vista de editar sea la vista por default en
   * lugar del chat… cuando quiera simular el chat, o la preview, pon un botón arriba a
   * la derecha… que diga "Probar"».
   *
   * Antes esto era `PlantillaVista | 'crear' | null`, o sea que el estado guardaba la
   * plantilla ABIERTA y `null` significaba «mostrá el chat». Eso tenía el default
   * escondido en dos lugares: acá y en `elegir`, que hacía `setDetalle(null)` al cambiar
   * de mensaje. Ahora el estado dice qué VISTA se mira y la plantilla sale de `selId`,
   * que es donde ya vivía: invertir el default es una sola línea y cambiar de mensaje no
   * puede devolverte al chat sin que alguien lo escriba.
   */
  const [vista, setVista] = useState<'editar' | 'probar'>('editar');
  const [creando, setCreando] = useState(false);

  const recargar = useCallback(async () => {
    try { const j = await (await fetch(endpoint)).json(); if (j.ok) setPlantillas(j.plantillas as PlantillaVista[]); } catch { setPlantillas([]); }
  }, []);
  /**
   * ⚠️ SI EL SERVER YA LAS MANDÓ, NO SE VUELVEN A PEDIR.
   *
   * Medido el 05/10/2026: la pantalla pintaba a los 268-412 ms y la LISTA recién a los
   * 1.100-1.308, porque el componente se montaba vacío y recién ahí pedía
   * `GET /api/…/plantillas` (264-472 ms, 44,6 kB). Eran ~800 ms de spinner por una ida y
   * vuelta que el server podía ahorrar: la página ya es `force-dynamic` y ya resuelve la
   * sesión, o sea que leer el catálogo ahí no cuesta una request más.
   *
   * Se sigue pudiendo recargar: `recargar()` es el camino de después de cada cambio, y
   * el salto es SÓLO el primer efecto.
   */
  const sembradas = useRef(Boolean(iniciales?.length));
  useEffect(() => { if (sembradas.current) { sembradas.current = false; return; } recargar(); }, [recargar]);
  useEffect(() => { if (!selId && plantillas && plantillas.length) setSelId(plantillas[0].id); }, [plantillas, selId]);

  const lista = useMemo(() => {
    if (!plantillas) return [];
    const q = busq.trim().toLowerCase();
    return plantillas.filter((a) => {
      if (filtro !== 'todas' && a.categoria !== filtro) return false;
      if (q && !(a.titulo.toLowerCase().includes(q) || a.ejemplo.toLowerCase().includes(q) || a.disparador.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [plantillas, filtro, busq]);
  const sel = plantillas?.find((a) => a.id === selId);
  const conteo = (k: CategoriaAviso | 'todas') => (!plantillas ? 0 : k === 'todas' ? plantillas.length : plantillas.filter((a) => a.categoria === k).length);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setMensajes([]); setTyping(null);
    if (!sel) return;
    const pasos = guion(sel);
    const acc0: HiloMsg[] = [];
    let acc = 150;
    for (const p of pasos) {
      if (p.t === 'typing') { timers.current.push(setTimeout(() => setTyping({ lado: p.lado, autor: p.autor }), acc)); acc += 500; }
      else { acc0.push(p.msg); const snap = [...acc0]; timers.current.push(setTimeout(() => { setTyping(null); setMensajes(snap); }, acc)); acc += 250; }
    }
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [selId, sel]);

  if (plantillas === null) {
    return (
      <div style={{ height: 620, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>
        <span style={{ width: 30, height: 30, border: '3px solid var(--border)', borderTopColor: 'var(--accent-soft)', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
      </div>
    );
  }

  /**
   * Elegir una plantilla la abre EN LA VISTA QUE ESTÉS. Antes hacía `setDetalle(null)`,
   * que te devolvía al chat: con el editor como default eso era el segundo lugar que
   * decidía el default, y cambiar de mensaje deshacía lo que el pedido pide.
   *
   * Y sale de `creando`: si estabas en el alta y elegís una plantilla de la lista, lo
   * que querés ver es ésa.
   */
  const elegir = (id: string) => { setSelId(id); setCreando(false); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12, height: 620 }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar por título o texto…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
          <div style={{ marginTop: 10 }}>
            <Dropdown value={filtro} onChange={(v) => setFiltro(v as CategoriaAviso | 'todas')} width={172} ariaLabel="Filtrar por categoría"
              buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
              options={[{ value: 'todas', label: `Todas · ${conteo('todas')}` }, ...ORDEN.map((k) => ({ value: k, label: `${EMOJI_CATEGORIA[k]} ${LABEL[k]} · ${conteo(k)}` }))]} />
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {/* Crear nueva (contacto gris, arriba de todo) */}
          <button type="button" onClick={() => { setCreando(true); setVista('editar'); }}
            style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', marginBottom: 6, opacity: 0.85 }}>
            <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'var(--faint)' }}>+</span>
            <div style={{ fontWeight: 600, fontSize: 13.5 }}>Crear nueva plantilla</div>
          </button>

          {lista.length === 0 && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna plantilla coincide.</div>}
          {lista.map((a) => {
            const on = a.id === selId;
            return (
              <button key={a.id} type="button" onClick={() => elegir(a.id)}
                style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2, opacity: a.enabled ? 1 : 0.5 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{EMOJI_CATEGORIA[a.categoria]}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.titulo}{!a.enabled && <span style={{ color: 'var(--faint)', fontWeight: 500 }}> · inactiva</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.ejemplo.replace(/[*_\n]/g, ' ').slice(0, 40)}</div>
                </div>
                {/* ⚠️ ACÁ VIVE EL AVISO QUE ANTES ERA UN CONFIRM AL CERRAR EL EDITOR.
                    Al sacarse la ✕ (04/10/2026) se fue con ella el «¿Publicar los
                    cambios?» de salida. El texto del borrador nunca estuvo en riesgo —se
                    guarda al desmontar y por `visibilitychange`, con test—, así que lo
                    único que ese Confirm agregaba era el aviso de que MaKo sigue mandando
                    el texto VIEJO. Un aviso al salir es un EVENTO: se lee una vez y se
                    olvida. Acá es un ESTADO, y por eso sobrevive a cambiar de mensaje, a
                    la vista de Probar y al reload — y encima se ve de los OTROS mensajes,
                    que un Confirm no podía mostrar nunca. */}
                {a.borrador && <span title="Tiene cambios sin publicar: MaKo todavía manda el texto anterior" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warn)', flex: 'none' }} />}
                <span title={a.enabled ? 'Activa' : 'Inactiva'} style={{ width: 8, height: 8, borderRadius: '50%', background: a.enabled ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }} />
                {a.esCustom && <span style={{ flex: 'none', fontFamily: "'Geist Mono', monospace", fontSize: 8.5, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 5, padding: '1px 4px' }}>tuya</span>}
              </button>
            );
          })}
        </div>
      </div>

      {creando || (vista === 'editar' && sel) ? (
        <TemplateDetalleModal
          /*
           * ⚠️ EL `key` NO ES DECORACIÓN: SIN ÉL EL EDITOR MUESTRA OTRA PLANTILLA.
           *
           * `TemplateDetalleModal` siembra seis `useState` de sus props (título,
           * categoría, texto, el publicado contra el que compara, y el interruptor), y
           * un `useState` sembrado NO se resiembra cuando la prop cambia. Mientras el
           * editor era la vista que se ABRÍA, eso no se notaba: cambiar de mensaje
           * hacía `setDetalle(null)`, lo desmontaba, y al volver a abrirlo nacía con
           * los datos nuevos. Con el editor como vista por DEFAULT ya no se desmonta
           * nunca, así que al tocar otra fila la lista marcaba una y el editor seguía
           * mostrando —y guardando— la anterior.
           *
           * Lo encontró la captura, no el código: no hay error, no hay pantalla rota,
           * hay dos nombres distintos en la misma pantalla. El `key` fuerza el
           * remonte, que además es el camino que YA guarda el borrador al desmontar.
           */
          key={creando ? 'crear' : (sel?.id ?? 'ninguna')}
          plantilla={creando ? null : (sel ?? null)}
          onClose={() => setCreando(false)}
          onCambio={recargar}
          onVerChat={creando ? undefined : () => setVista('probar')}
          endpoint={endpoint}
        />
      ) : sel ? (
        <ChatHilo
          readOnly
          accent="var(--accent-soft)"
          accentBubble="var(--wa-noof-bubble)"
          mensajes={mensajes}
          typing={typing}
          header={(
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <button type="button" onClick={() => setVista('editar')} title="Ver detalle / editar" style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{EMOJI_CATEGORIA[sel.categoria]}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sel.titulo}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>{EMOJI_CATEGORIA[sel.categoria]} {LABEL[sel.categoria]}{sel.requiereRespuesta ? ' · espera respuesta' : ''}{sel.enabled ? '' : ' · inactiva'} · toca para editar</div>
                </div>
              </button>
              <button type="button" onClick={() => setVista('editar')} title="Editar plantilla"
                style={{ flex: 'none', padding: '7px 13px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
            </div>
          )}
        />
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>Elige una plantilla.</div>
      )}
    </div>
  );
}
