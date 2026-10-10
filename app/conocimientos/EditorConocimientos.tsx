'use client';

// =============================================================================
// EditorConocimientos — el SUPER ADMIN edita un curso de Conocimientos (item 1, D9)
// =============================================================================
// Pedido de Martín (07/10/2026): «En la tab de CONOCIMIENTOS como SuperAdmin debería poder editar
// todo, aplicalo también allí. Claro que los links compartidos y otros usuarios no deben poder editar
// eso.» Con los MISMOS gestos que el curso de Customer Success: un clic en un texto, el color en el
// menú de la marca, la portada (con la pestaña «Diseños» de las láminas), arrastrar módulos y clases,
// mover una clase de módulo, y ocultar / mostrar.
//
// ⚠️ LO MONTA SÓLO app/conocimientos/Conocimientos.tsx, y sólo si el SERVER dijo que quien mira es el
//    super admin (`puedeEditar`, app/conocimientos/page.tsx). Los links compartidos montan
//    ./CursoConocimientos.tsx sin pasar por acá, así que este código —los menús, el selector de
//    portadas, las acciones— no llega a su navegador. Y aunque llegara: cada acción vuelve a preguntar
//    `getSesionAdmin()` en el server (./ajustes-actions.ts).
// ⚠️ NO SE EDITAN LAS FICHAS: se guarda un ajuste aparte (mig 0221) y se aplica encima
//    (lib/conocimiento-ajustes.ts). Volver a lo de la ficha es borrar el ajuste: dejar un nombre vacío,
//    «Nombre original», «Mostrar».
// ⚠️ OPTIMISTA, como la tab Curso: el cambio se ve en el acto y el server confirma detrás con las filas
//    de verdad, que mandan. Una respuesta vieja no pisa una más nueva (el TURNO), y si el server
//    rechaza, vuelve a lo último CONFIRMADO, no a lo de pantalla.
// ⚠️ TEXTOS EN TÚ Y CORTOS (AGENTS.md): «Ocultar», «Nadie más lo verá».

import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Toast, useToast } from '@/app/_ui';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { ItemMenuUgc, TituloMenuUgc } from '@/app/_cursos/CursoUgc';
import type { ClaseUgc, ControlMenuUgc, EdicionUgc, ModuloUgc, ObjetivoUgc, TextoUgc } from '@/app/_cursos/tipos';
import { ACENTOS, ACENTO_DEFAULT } from '@/lib/curso-estilo';
import {
  aplicarAjustes, antesDeAlMover, conCambios, esErrorGesto, planLlevarClase, planOrdenModulos, sanearValor,
  type Cambios, type FilaAjuste, type QueAjuste, type ResultadoAjuste,
} from '@/lib/conocimiento-ajustes';
import type { Curso } from './curso';
import CursoConocimientos from './CursoConocimientos';
import { clasesUgc, numerosDeModulos } from './modelo-ugc';
import { guardarAjusteConocimientoAction, llevarClaseConocimientoAction, ordenarModulosConocimientoAction } from './ajustes-actions';

/** QUÉ se ajusta, armado en un solo lugar (un `objetoId` mal escrito es un ajuste huérfano). */
const que = {
  curso: (campo: 'titulo' | 'resumen' | 'acento' | 'portada'): QueAjuste => ({ objeto: 'curso', objetoId: '', campo }),
  modulo: (key: string, campo: 'nombre' | 'portada' | 'oculto'): QueAjuste => ({ objeto: 'modulo', objetoId: key, campo }),
  clase: (n: number, campo: 'titulo' | 'portada' | 'oculta'): QueAjuste => ({ objeto: 'clase', objetoId: String(n), campo }),
};

export default function EditorConocimientos({ curso, filas: iniciales, onFilas, onSalir, compartir }: {
  /** El curso del CATÁLOGO, sin ajustes: lo de la ficha. */
  curso: Curso;
  /** Los ajustes de ESTE curso, como los leyó el server. */
  filas: FilaAjuste[];
  /** Avisa las filas confirmadas, así la grilla de cursos dice el título y la portada nuevos sin recargar. */
  onFilas?: (filas: FilaAjuste[]) => void;
  /** Volver a todos los cursos. */
  onSalir: () => void;
  /** El botón de Compartir de este curso. */
  compartir?: ReactNode;
}) {
  const slug = curso.slug;
  const [filas, setFilas] = useState<FilaAjuste[]>(iniciales);
  /** Lo último que el server CONFIRMÓ: a esto se vuelve si rechaza. */
  const confirmadas = useRef<FilaAjuste[]>(iniciales);
  /** El turno del último pedido: sólo su respuesta toca la pantalla. */
  const turno = useRef(0);
  const timerAcento = useRef<number | undefined>(undefined);
  const [picker, setPicker] = useState<{ q: QueAjuste; ancla: HTMLElement } | null>(null);
  const { toast, show, clear } = useToast();

  // Con lo oculto: el super admin lo ve, atenuado, para poder mostrarlo de nuevo.
  const cur = useMemo(() => aplicarAjustes(curso, filas, { conOcultos: true }), [curso, filas]);
  const numeros = useMemo(() => numerosDeModulos(cur), [cur]);
  const vnDe = useMemo(() => new Map(clasesUgc(cur).map((u) => [u.id, u.vn])), [cur]);

  /** Aplica en el acto, manda al server, y se queda con lo que el server contestó. */
  const correr = async (cambios: Cambios, accion: () => Promise<ResultadoAjuste>): Promise<boolean> => {
    if (!cambios.poner.length && !cambios.quitar.length) return true;
    const t = ++turno.current;
    setFilas((f) => conCambios(f, slug, cambios));
    try {
      const r = await accion();
      if (!r.ok) {
        if (t === turno.current) setFilas(confirmadas.current);
        show(r.error, undefined, 'bad');
        return false;
      }
      confirmadas.current = r.filas;
      onFilas?.(r.filas);
      if (t === turno.current) setFilas(r.filas);
      return true;
    } catch {
      if (t === turno.current) setFilas(confirmadas.current);
      show('No se pudo guardar.', undefined, 'bad');
      return false;
    }
  };

  /** UN ajuste. `null` (o lo que el saneo vacía) = volver a lo de la ficha. */
  const guardar = (q: QueAjuste, valor: string | null): Promise<boolean> => {
    const v = valor == null ? null : sanearValor(q, valor);
    const cambios: Cambios = v == null ? { poner: [], quitar: [q] } : { poner: [{ ...q, valor: v }], quitar: [] };
    return correr(cambios, () => guardarAjusteConocimientoAction(slug, q, v));
  };

  const ordenar = (keys: string[]) => {
    const plan = planOrdenModulos(cur, keys);
    if (esErrorGesto(plan)) { show(plan.error, undefined, 'bad'); return; }
    void correr(plan, () => ordenarModulosConocimientoAction(slug, keys));
  };

  const llevar = (n: number, destino: string, antesDe: number | null) => {
    const plan = planLlevarClase(cur, n, destino, antesDe);
    if (esErrorGesto(plan)) { show(plan.error, undefined, 'bad'); return; }
    void correr(plan, () => llevarClaseConocimientoAction(slug, n, destino, antesDe));
  };

  const mover = (n: number, dir: 'arriba' | 'abajo') => {
    const antesDe = antesDeAlMover(cur, n, dir);
    const c = cur.clases.find((x) => x.n === n);
    if (antesDe === undefined || !c) return;
    llevar(n, c.moduloKey, antesDe);
  };

  /**
   * El clic en un texto. Lo que se escribe igual a lo de la ficha BORRA el ajuste (no queda una fila
   * que diga lo mismo que la ficha), y vacío también: es volver a lo de siempre.
   */
  const texto = (t: TextoUgc, valor: string): Promise<boolean> => {
    // La portada muestra el título SIN autor (`tituloCorto`): escribir cualquiera de los dos de la ficha es volver a ella.
    if (t.tipo === 'curso-titulo') return guardar(que.curso('titulo'), valor && valor !== curso.titulo && valor !== curso.tituloCorto ? valor : null);
    if (t.tipo === 'curso-resumen') return guardar(que.curso('resumen'), valor && valor !== curso.resumen ? valor : null);
    if (t.tipo === 'modulo') return guardar(que.modulo(t.key, 'nombre'), valor && valor !== t.key ? valor : null);
    const c = cur.clases.find((x) => x.n === t.id);
    return guardar(que.clase(t.id, 'titulo'), valor && valor !== c?.tituloOriginal ? valor : null);
  };

  const abrirPortada = (o: ObjetivoUgc, ancla: HTMLElement) => {
    const q = o.tipo === 'curso' ? que.curso('portada') : o.tipo === 'modulo' ? que.modulo(o.key, 'portada') : que.clase(o.id, 'portada');
    setPicker({ q, ancla });
  };

  /** Lo que hay puesto hoy en esa portada (lo que el selector marca). */
  const portadaActual = (q: QueAjuste): string | null => {
    if (q.objeto === 'curso') return cur.portadaElegida;
    if (q.objeto === 'modulo') return cur.modulos.find((m) => m.key === q.objetoId)?.portadaElegida ?? null;
    return cur.clases.find((c) => String(c.n) === q.objetoId)?.portadaElegida ?? null;
  };

  /** Con qué número, rótulo y nombre dibuja las láminas la pestaña «Diseños». La portada del curso no tiene número. */
  const disenosDe = (q: QueAjuste): { n: number; rotulo: string; titulo: string } | undefined => {
    if (q.objeto === 'modulo') {
      const i = cur.modulos.findIndex((m) => m.key === q.objetoId);
      return i >= 0 ? { n: numeros[i], rotulo: 'Módulo', titulo: cur.modulos[i].nombre } : undefined;
    }
    if (q.objeto === 'clase') {
      const c = cur.clases.find((x) => String(x.n) === q.objetoId);
      return c ? { n: Number(vnDe.get(c.n) ?? 1) || 1, rotulo: 'Clase', titulo: c.titulo } : undefined;
    }
    return undefined;
  };

  // ── El color: en el menú de la marca, como en la tab Curso ──
  const acentoActual = cur.acento ?? ACENTO_DEFAULT;
  const elegirAcento = (hex: string) => {
    // Uno de la paleta CANCELA al «otro» que esperaba guardarse: si no, a los 450 ms el pendiente
    // pisaba en la base la elección explícita (la misma revisión de la tab Curso, 07/10/2026).
    window.clearTimeout(timerAcento.current);
    void guardar(que.curso('acento'), hex === ACENTO_DEFAULT ? null : hex);
  };
  /** El selector nativo dispara un cambio por movimiento: se ve en el acto y se guarda al quedarse quieto. */
  const probarAcento = (hex: string) => {
    const v = sanearValor(que.curso('acento'), hex);
    setFilas((f) => conCambios(f, slug, v ? { poner: [{ ...que.curso('acento'), valor: v }], quitar: [] } : { poner: [], quitar: [que.curso('acento')] }));
    window.clearTimeout(timerAcento.current);
    timerAcento.current = window.setTimeout(() => { void guardar(que.curso('acento'), hex); }, 450);
  };
  const menuMarca = (cerrar: () => void) => (
    <>
      <ItemMenuUgc icono="curso" onClick={() => { cerrar(); onSalir(); }}>Todos los cursos</ItemMenuUgc>
      <div className="ugc-menu-sep" />
      <TituloMenuUgc>Color del curso</TituloMenuUgc>
      <div className="ugc-swatches">
        {ACENTOS.map((a) => (
          <button key={a.hex} type="button" className="ugc-swatch" style={{ background: a.hex }}
            aria-pressed={acentoActual === a.hex} title={a.nombre} aria-label={a.nombre} onClick={() => elegirAcento(a.hex)} />
        ))}
        {/* Cualquier otro color. Uno muy oscuro vuelve aclarado: el acento es FONDO de texto oscuro. */}
        <label className={`ugc-swatch ugc-swatch--otro${ACENTOS.some((a) => a.hex === acentoActual) ? '' : ' on'}`} title="Otro color">
          <input type="color" value={acentoActual} aria-label="Otro color" onChange={(e) => probarAcento(e.target.value)} />
        </label>
      </div>
    </>
  );

  // ── Los menús «…» (el botón y el desplegable son del dibujo; lo de adentro, de acá) ──
  const menuModulo = (m: ModuloUgc, ctl: ControlMenuUgc) => {
    const ma = cur.modulos.find((x) => x.key === m.key);
    if (!ma) return null;
    const keys = cur.modulos.map((x) => x.key);
    const i = keys.indexOf(ma.key);
    // «Mover antes / después»: lo mismo que arrastrarlo un lugar, para quien no puede arrastrar (el
    // teclado, una pantalla táctil, donde el arrastre nativo no existe).
    const correrA = (j: number) => (j < 0 || j >= keys.length ? null : () => {
      const n = [...keys];
      [n[i], n[j]] = [n[j], n[i]];
      ordenar(n);
    });
    const antes = correrA(i - 1);
    const despues = correrA(i + 1);
    return (
      <>
        {ctl.renombrar && <ItemMenuUgc icono="renombrar" onClick={ctl.renombrar}>Renombrar</ItemMenuUgc>}
        {ma.nombre !== ma.key && (
          <ItemMenuUgc icono="restaurar" title={ma.key} onClick={() => { ctl.cerrar(); void guardar(que.modulo(ma.key, 'nombre'), null); }}>Nombre original</ItemMenuUgc>
        )}
        <ItemMenuUgc icono="imagen" onClick={() => { const a = ctl.ancla; ctl.cerrar(); if (a) abrirPortada({ tipo: 'modulo', key: ma.key }, a); }}>Portada</ItemMenuUgc>
        <ItemMenuUgc icono="arriba" disabled={!antes} onClick={() => { ctl.cerrar(); antes?.(); }}>Mover antes</ItemMenuUgc>
        <ItemMenuUgc icono="abajo" disabled={!despues} onClick={() => { ctl.cerrar(); despues?.(); }}>Mover después</ItemMenuUgc>
        <div className="ugc-menu-sep" />
        <ItemMenuUgc icono={ma.oculto ? 'ver' : 'ocultar'} onClick={() => { ctl.cerrar(); void guardar(que.modulo(ma.key, 'oculto'), ma.oculto ? null : '1'); }}>
          {ma.oculto ? 'Mostrar' : 'Ocultar'}
        </ItemMenuUgc>
        {/* La consecuencia, ANTES del clic y pegada al control. */}
        <div className="ugc-menu-bloque">
          <p className="ugc-menu-nota">{ma.oculto ? 'Hoy solo tú lo ves.' : 'Nadie más lo verá, ni con un link compartido.'}</p>
        </div>
      </>
    );
  };

  const menuClase = (u: ClaseUgc, ctl: ControlMenuUgc) => {
    const c = cur.clases.find((x) => x.n === u.id);
    if (!c) return null;
    const otros = cur.modulos.filter((m) => m.key !== c.moduloKey);
    const porSuModulo = c.oculta && !c.ocultaPropia;
    return (
      <>
        <ItemMenuUgc icono="imagen" onClick={() => { const a = ctl.ancla; ctl.cerrar(); if (a) abrirPortada({ tipo: 'clase', id: c.n }, a); }}>Portada</ItemMenuUgc>
        {c.titulo !== c.tituloOriginal && (
          <ItemMenuUgc icono="restaurar" title={c.tituloOriginal} onClick={() => { ctl.cerrar(); void guardar(que.clase(c.n, 'titulo'), null); }}>Título original</ItemMenuUgc>
        )}
        {otros.length > 0 && (
          <div className="ugc-menu-bloque">
            <label className="ugc-menu-campo">
              Mover a
              <select value="" onChange={(e) => { const k = e.target.value; if (!k) return; ctl.cerrar(); llevar(c.n, k, null); }}>
                <option value="">Elige un módulo</option>
                {otros.map((m) => <option key={m.key} value={m.key}>{m.nombre}</option>)}
              </select>
            </label>
          </div>
        )}
        <div className="ugc-menu-sep" />
        <ItemMenuUgc icono={c.ocultaPropia ? 'ver' : 'ocultar'} onClick={() => { ctl.cerrar(); void guardar(que.clase(c.n, 'oculta'), c.ocultaPropia ? null : '1'); }}>
          {c.ocultaPropia ? 'Mostrar' : 'Ocultar'}
        </ItemMenuUgc>
        <div className="ugc-menu-bloque">
          <p className="ugc-menu-nota">
            {porSuModulo ? 'Su módulo está oculto.' : c.ocultaPropia ? 'Hoy solo tú la ves.' : 'Nadie más la verá, ni con un link compartido.'}
          </p>
        </div>
      </>
    );
  };

  /** «Mostrar», a la vista, en la cabecera de un módulo oculto: el menú solo no se encuentra. */
  const accionesDeModulo = (key: string): ReactNode => {
    const m = cur.modulos.find((x) => x.key === key);
    if (!m?.oculto) return null;
    return (
      <button type="button" className="ugc-btn" onClick={() => { void guardar(que.modulo(key, 'oculto'), null); }}>Mostrar</button>
    );
  };

  /** Lo mismo adentro de una clase oculta: lo dice y ofrece mostrarla. */
  const debajoDelVideo = (n: number): ReactNode => {
    const c = cur.clases.find((x) => x.n === n);
    if (!c?.oculta) return null;
    return (
      <div className="ugc-paper" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <span>{c.ocultaPropia ? 'Clase oculta: solo tú la ves.' : 'Su módulo está oculto: solo tú la ves.'}</span>
        {c.ocultaPropia && (
          <button type="button" className="ugc-btn" onClick={() => { void guardar(que.clase(n, 'oculta'), null); }}>Mostrar</button>
        )}
      </div>
    );
  };

  const edicion: EdicionUgc = {
    onOrdenarModulos: ordenar,
    onLlevarClase: llevar,
    menuModulo,
    menuClase,
    onMover: mover,
    // Con el menú «…» puesto, el dibujo no ofrece borrar: en Conocimientos no se borra una clase de
    // la ficha, se OCULTA (es lo que haría este botón si se dibujara).
    onBorrar: (id) => { void guardar(que.clase(id, 'oculta'), '1'); },
    puedeMover: (id, dir) => antesDeAlMover(cur, id, dir) !== undefined,
    onTexto: texto,
    onPortada: abrirPortada,
  };

  return (
    <>
      <CursoConocimientos curso={cur} onSalir={onSalir} marcaMenu={menuMarca} topbarExtra={compartir}
        edicion={edicion} accionesDeModulo={accionesDeModulo} debajoDelVideo={debajoDelVideo} />
      {picker && (
        // El MISMO selector de la tab Curso: degradados, fotos y subir; y para un módulo o una clase, la
        // pestaña «Diseños». Elegir no lo cierra (se prueba mirando), y lo que se elige se guarda.
        <PortadaPicker
          valor={portadaActual(picker.q)}
          colorBase={acentoActual}
          ancla={picker.ancla}
          titulo="Portada"
          sinAutomatico
          disenos={disenosDe(picker.q)}
          onElegir={(v) => { void guardar(picker.q, v); }}
          onCerrar={() => setPicker(null)}
        />
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}
