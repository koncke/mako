'use client';

// =============================================================================
// Copywriting › Inspiración: la bandeja de a una tarjeta y las carpetas (19/11/2026, docs/inspiracion/diseno.md §6)
// =============================================================================
// Martín, 19/11: «Un primer filtro que sea literalmente lo que tenemos en la etiquetera de SuperAdmin, como un scroll tipo
// Tinder: si sospechas que debería ir en tal carpeta pero no estás 100 % seguro, lo preguntas… sí o no… Si pone que no, la
// persona crea a mano una nueva carpeta».
//
// El gesto es el del mazo de la Ticketera (app/tickets/decisiones/Mazo.tsx): lo hace `motion` y decide `veredictoGesto`
// (distancia O tirón). Cada gesto tiene su botón y su tecla (→ Sí, ← No, ⌫ Volver), y «Volver» deshace también en la base.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { veredictoGesto } from '@/app/tickets/decisiones/reglas';
import { preguntaDe } from '@/lib/inspiracion/reglas';
import type { Carpeta, Pieza } from '@/lib/inspiracion/servidor';
import { decidirInspiracionAction, leerInspiracionAction, volverInspiracionAction } from './acciones';
import st from './inspiracion.module.css';

type Estado = { carpetas: Carpeta[]; piezas: Pieza[] };
const texto = (v: unknown) => (typeof v === 'string' ? v : '');

export function Inspiracion({ inicial, error: errorInicial, vistaInicial = 'bandeja' }: { inicial: Estado | null; error: string | null; vistaInicial?: 'bandeja' | 'carpetas' }) {
  const [datos, setDatos] = useState<Estado>(inicial ?? { carpetas: [], piezas: [] });
  const [error, setError] = useState<string | null>(errorInicial);
  const [eligiendo, setEligiendo] = useState(false);
  const [hechas, setHechas] = useState<number[]>([]);
  const [vista, setVista] = useState<'bandeja' | 'carpetas'>(vistaInicial);
  const [ocupado, setOcupado] = useState(false);

  const recargar = useCallback(async () => {
    const r = await leerInspiracionAction();
    if (r.ok) { setDatos({ carpetas: r.carpetas, piezas: r.piezas }); setError(null); } else setError(r.error);
  }, []);

  const pendientes = useMemo(() => datos.piezas.filter((p) => p.estado === 'por_revisar' || p.estado === 'sin_leer'), [datos.piezas]);
  const actual = pendientes[0] ?? null;
  const nombreDe = useCallback((id: number | null) => datos.carpetas.find((c) => c.id === id)?.nombre ?? null, [datos.carpetas]);

  const decidir = useCallback(async (p: Pieza, d: { carpetaId: number } | { nueva: { nombre: string; descripcion: string } }) => {
    setOcupado(true);
    const r = await decidirInspiracionAction(p.id, d);
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    setHechas((h) => [...h, p.id]);
    setEligiendo(false);
    await recargar();
  }, [recargar]);

  const si = useCallback((p: Pieza) => {
    if (p.sugerida_id) return decidir(p, { carpetaId: p.sugerida_id });
    if (p.carpeta_nueva) return decidir(p, { nueva: { nombre: p.carpeta_nueva, descripcion: '' } });
    setEligiendo(true);
  }, [decidir]);

  const volver = useCallback(async () => {
    const id = hechas[hechas.length - 1];
    if (id == null) return;
    setOcupado(true);
    const r = await volverInspiracionAction(id);
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    setHechas((h) => h.slice(0, -1));
    await recargar();
  }, [hechas, recargar]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (vista !== 'bandeja' || !actual || ocupado) return;
      if ((e.target as HTMLElement | null)?.closest('input, textarea')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); void si(actual); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); setEligiendo(true); }
      else if (e.key === 'Backspace') { e.preventDefault(); void volver(); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [vista, actual, ocupado, si, volver]);

  const ordenadas = datos.piezas.filter((p) => p.estado === 'ordenada');
  return (
    <div className={st.raiz}>
      <header className={st.cabeza}>
        <div>
          <h1>Inspiración</h1>
          <p className={st.bajada}>Lo que le mandas a MaKo por WhatsApp (el link de un reel o un post) se guarda aquí y se ordena en tus carpetas. Lo que no sabe dónde va, te lo pregunta.</p>
        </div>
        <Link href="/copywriter" className={st.boton}>← Outliers</Link>
      </header>
      <div className={st.pestanas} role="tablist">
        <button type="button" role="tab" aria-selected={vista === 'bandeja'} onClick={() => setVista('bandeja')}>Para decidir ({pendientes.length})</button>
        <button type="button" role="tab" aria-selected={vista === 'carpetas'} onClick={() => setVista('carpetas')}>Carpetas ({ordenadas.length})</button>
      </div>
      {error ? <p className={st.error} role="alert">{error} <ReportarASoporte /></p> : null}

      {vista === 'bandeja' ? (
        <section aria-label="Para decidir" className={st.bandeja}>
          <div className={st.barra}>
            <span>{actual ? `Quedan ${pendientes.length}` : 'Nada por decidir'}</span>
            <button type="button" className={st.boton} onClick={() => void volver()} disabled={!hechas.length || ocupado} title="Deshace la última (⌫)">↶ VOLVER</button>
          </div>
          {actual ? (
            <Tarjeta key={actual.id} p={actual} carpetas={datos.carpetas} sugerida={nombreDe(actual.sugerida_id)} eligiendo={eligiendo} ocupado={ocupado}
              onSi={() => void si(actual)} onNo={() => setEligiendo(true)} onElegir={(d) => void decidir(actual, d)} />
          ) : (
            <div className={st.vacio}>
              <p><b>No hay nada por decidir.</b></p>
              <p>Mándale a MaKo por WhatsApp el link de un reel o un post de Instagram y aparece aquí (o directo en su carpeta, si MaKo está segura).</p>
            </div>
          )}
          <p className={st.ayuda}>SÍ: botón, → o arrastrar a la derecha · NO: botón, ← o arrastrar a la izquierda · ⌫ vuelve atrás</p>
        </section>
      ) : (
        <section aria-label="Carpetas" className={st.carpetas}>
          {datos.carpetas.length ? datos.carpetas.map((c) => {
            const de = ordenadas.filter((p) => p.carpeta_id === c.id);
            return (
              <div key={c.id} className={st.carpeta}>
                <h2>{c.nombre} <span>{de.length}</span></h2>
                {c.descripcion ? <p className={st.que}>{c.descripcion}</p> : null}
                {de.length ? <div className={st.grilla}>{de.map((p) => <Mini key={p.id} p={p} />)}</div> : <p className={st.que}>Todavía nada.</p>}
              </div>
            );
          }) : <p className={st.vacio}>Todavía no hay carpetas: se crean al contestar la primera tarjeta.</p>}
        </section>
      )}
    </div>
  );
}

function Tarjeta({ p, carpetas, sugerida, eligiendo, ocupado, onSi, onNo, onElegir }: {
  p: Pieza; carpetas: Carpeta[]; sugerida: string | null; eligiendo: boolean; ocupado: boolean;
  onSi: () => void; onNo: () => void; onElegir: (d: { carpetaId: number } | { nueva: { nombre: string; descripcion: string } }) => void;
}) {
  const x = useMotionValue(0);
  const rotar = useTransform(x, [-300, 300], [-12, 12]);
  const selloSi = useTransform(x, [0, 110], [0, 1]);
  const selloNo = useTransform(x, [-110, 0], [1, 0]);
  const [nombre, setNombre] = useState('');
  const [que, setQue] = useState('');
  const lectura = p.lectura ?? {};
  const pregunta = preguntaDe({ sugerida, carpetaNueva: p.carpeta_nueva, tipoLink: p.tipo_link });

  const soltar = (_: unknown, info: PanInfo) => {
    const ancho = (typeof window !== 'undefined' ? Math.min(window.innerWidth, 720) : 720);
    const v = veredictoGesto({ dx: info.offset.x, vx: info.velocity.x, ancho });
    if (v === 'derecha') { void animate(x, ancho * 1.4, { duration: 0.25 }).then(onSi); return; }
    void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 });
    if (v === 'izquierda') onNo();
  };

  return (
    <motion.article className={st.tarjeta} style={{ x, rotate: rotar }} drag="x" dragDirectionLock dragConstraints={{ left: 0, right: 0 }} dragElastic={1} onDragEnd={soltar}>
      <a className={st.foto} href={p.url} target="_blank" rel="noopener noreferrer" draggable={false}>
        {p.miniatura_url ? <img src={p.miniatura_url} alt="" draggable={false} /> : <span className={st.sinFoto}>{p.tipo_link === 'cuenta' ? '@' + (p.cuenta ?? '') : 'Sin portada'}</span>}
        <motion.b className={`${st.sello} ${st.selloSi}`} style={{ opacity: selloSi }}>SÍ</motion.b>
        <motion.b className={`${st.sello} ${st.selloNo}`} style={{ opacity: selloNo }}>NO</motion.b>
        <span className={st.abrir}>Abrir en Instagram ↗</span>
      </a>
      <div className={st.cuerpo}>
        <div className={st.quien}>
          {p.cuenta ? <b>@{p.cuenta}</b> : null}
          {texto(lectura.formato) ? <span className={st.etiqueta}>{texto(lectura.formato)}</span> : null}
          {!p.leida_en && p.tipo_link !== 'cuenta' ? <span className={st.etiqueta} title="Se guardó igual: la lectura completa del post llega apenas Instagram deje leerlo">Sin leer todavía</span> : null}
        </div>
        {texto(lectura.de_que_trata) ? <p>{texto(lectura.de_que_trata)}</p> : p.pie ? <p className={st.pie}>{p.pie.slice(0, 280)}</p> : null}
        {texto(lectura.gancho) ? <p className={st.gancho}>{texto(lectura.gancho)}</p> : null}
        {texto(lectura.cta) ? <p className={st.que}><b>CTA:</b> {texto(lectura.cta)}</p> : null}
        {p.nota ? <p className={st.que}><b>Tu nota:</b> {p.nota}</p> : null}
        {p.por_que ? <p className={st.sospecha}>{p.por_que}{p.confianza != null ? ` (${p.confianza} %)` : ''}</p> : null}
        <h2 className={st.pregunta}>{pregunta}</h2>
        <div className={st.acciones}>
          <button type="button" className={st.no} onClick={onNo} disabled={ocupado}>✕ NO</button>
          <button type="button" className={st.si} onClick={onSi} disabled={ocupado}>✓ SÍ</button>
        </div>
        {eligiendo ? (
          <div className={st.elegir}>
            <p><b>¿Dónde va entonces?</b></p>
            <div className={st.chips}>
              {carpetas.filter((c) => c.id !== p.sugerida_id).map((c) => (
                <button key={c.id} type="button" className={st.chip} disabled={ocupado} onClick={() => onElegir({ carpetaId: c.id })}>{c.nombre}</button>
              ))}
            </div>
            <form className={st.nueva} onSubmit={(e) => { e.preventDefault(); if (nombre.trim()) onElegir({ nueva: { nombre: nombre.trim(), descripcion: que.trim() } }); }}>
              <label htmlFor="insp-nueva"><b>O una carpeta nueva</b></label>
              <input id="insp-nueva" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} placeholder="Por ejemplo: Anuncios pagados" />
              <input id="insp-que" value={que} onChange={(e) => setQue(e.target.value)} maxLength={200} placeholder="Qué va ahí (MaKo lo lee para ordenar las próximas)" />
              <button type="submit" className={st.boton} disabled={ocupado || !nombre.trim()}>CREAR Y GUARDAR AQUÍ</button>
            </form>
          </div>
        ) : null}
      </div>
    </motion.article>
  );
}

function Mini({ p }: { p: Pieza }) {
  const lectura = p.lectura ?? {};
  return (
    <a className={st.mini} href={p.url} target="_blank" rel="noopener noreferrer">
      {p.miniatura_url ? <img src={p.miniatura_url} alt="" loading="lazy" /> : <span className={st.sinFoto}>@{p.cuenta ?? ''}</span>}
      <div>
        <b>@{p.cuenta ?? '¿?'}</b>
        <p>{texto(lectura.de_que_trata) || (p.pie ?? '').slice(0, 120)}</p>
        <span className={st.quienOrdeno}>{p.revisada_en ? 'Tú' : `MaKo ${p.confianza ?? ''} %`}</span>
      </div>
    </a>
  );
}
