'use client';

// =============================================================================
// Copywriter — la tab Copywriting: el shell único de Create con el chat de MaKo, las páginas y la página de Notion
// =============================================================================
// Pedido de Martín (28/10/2026): «Quiero que implementes mila.gg combinado con notion en "copywriter"… con la sidebar de
// mako y el editor a la derecha». Y el 29/10: «quiero que sea una réplica de Notion… con la barra lateral de MaKo… y NO
// quiero otras tabs internas ni nada de ONBOARDING», con el diseño ÚNICO de Create (app/_crear/PantallaCrear.tsx, del chat
// «Create: un solo diseño»): la tarjeta izquierda SIEMPRE abierta es el chat de MaKo de la página (PanelMaKo, que edita lo
// abierto); su «←» la da vuelta a la lista de páginas, con «Nueva página» primero; «Nueva página» muestra «¿Qué vas a crear
// hoy?» con los templates (lib/copywriter/plantillas.ts) y lo escrito en la caja crea una página que MaKo escribe.
// Diseño: docs/diseno-copywriter.md (D2, D11, D12, D15).
//
// LO QUE ES DE ESTE ARCHIVO: el índice de páginas y lo que se hace con él —abrir, crear, renombrar, la Papelera—, siempre
// en el acto en la pantalla y después en el server; si el server dice que no, vuelve a lo que había y lo dice. El DOCUMENTO
// abierto es de EditorGuion (su autoguardado), y la charla, de PanelMaKo.
// Abrir otra página NAVEGA (/copywriter/<id>, con el `?ws=` que pone el Link de la casa): el server la abre por su puerta, y
// el editor se monta de nuevo con `key` (AGENTS.md, «Un useState sembrado de props no se resiembra»).
// Lo que se perdió del árbol de Notion al entrar al shell (el arrastre para reordenar y anidar): la lista es la del shell,
// con las subpáginas debajo de su página («↳») y «Agregar una página adentro» en el ⋯; las migas de la página navegan el
// árbol. En el teléfono: app/m/copywriter (un paso por pantalla).
// =============================================================================

import './notion.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Toast, useToast } from '@/app/_ui';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { PantallaCrear, type PlantillaCrear, type ProyectoCrear } from '@/app/_crear/PantallaCrear';
import { aPapelera, cambiarPagina, dePapelera, enOrdenDeArbol, escondida, restaurar as restaurarEnArbol } from '@/lib/copywriter/arbol';
import { INFO_TIPO, propsNuevas, SIN_TITULO, type GuionAbierto, type PaginaCopy, type TipoGuion } from '@/lib/copywriter/tipos';
import { type CatalogosCopy } from '@/lib/copywriter/catalogos';
import { chipsDe, extractoDe, plantillasDe, plantillasVisibles, type Plantilla } from '@/lib/copywriter/plantillas';
import type { OfertaCorta } from '@/lib/copywriter/iniciativa';
import type { DocVivo } from './editor/propuesta';
import { pedirCrear, pedirPapelera, pedirRenombrar, pedirRestaurar, rutaGuion } from './cliente';
import { guardarPedido } from './pedido-guardado';
import { EditorGuion, type ApiPagina } from './editor/EditorGuion';
import { PanelMaKo, type GuionVivo } from './PanelMaKo';
import { OutliersCopy } from './OutliersCopy';
import type { PortadaCopy } from '@/lib/copywriter/outliers';
// «Compartir para editar» (D9): el MISMO modal de Compartir de la casa (Conocimientos, el Dashboard), con el recurso del
// guion. La puerta y el permiso de editar los pone el server (/api/compartir).
import Compartir from '@/app/conocimientos/Compartir';
import { RECURSO_GUION } from '@/lib/share-nombre';
// Plantillas propias (6/11/2026, Leila): «Guardar como plantilla» en el «⋯» de cada página y «Tus plantillas» en «Nueva».
import { ModalGuardarPlantilla } from '@/app/creaciones/PublicarCreacion';
import { usePlantillasPropias } from '@/app/creaciones/usePlantillasPropias';

export type PropsCopywriter = {
  /** El negocio de la pestaña (del server): va en las claves del navegador. */
  ws: number | null;
  paginas: PaginaCopy[];
  guion: GuionAbierto | null;
  /** La página pedida no se pudo leer (la base): se dice, no es «no existe». */
  error: string | null;
  catalogos: CatalogosCopy;
  /** Las rutas: escritorio (/copywriter) o el teléfono (/m/copywriter, que el proxy sirve en la misma URL). */
  base?: string;
  /** El tipo pedido por un link viejo (`?nuevo=<tipo>`): sus templates van primero en «Nueva página». */
  tipoInicial?: TipoGuion | null;
  /** «Nueva página» desde afuera (`?nueva`): la pantalla arranca en «¿Qué vas a crear hoy?». */
  nuevaInicial?: boolean;
  /** Las ofertas del negocio (la principal primero): MaKo pregunta a cuál adaptar la página nueva (PanelMaKo). */
  ofertas?: readonly OfertaCorta[];
  /**
   * La portada de outliers (D18): va en el CENTRO de la pantalla de Create, con el chat de MaKo a la izquierda, como Image desde el
   * 9/11/2026. 11/11/2026, Martín: «en la vista de outliers no está el chat de MaKo» y «no hay cómo volver a los outliers».
   */
  portada?: PortadaCopy;
};

/** «Nueva página»: los templates (la misma ruta de la tab con `?nueva`). */
export const rutaNueva = (base: string) => `${base}?nueva=1`;

/** La proporción del marco de cada tipo en la tarjeta del template (sin imagen, el shell dibuja ese marco). */
const FORMATO: Readonly<Record<TipoGuion, string>> = {
  ad: '1 / 1', reel: '9 / 16', story: '9 / 16', youtube: '16 / 9', vsl: '16 / 9', email: '3 / 4', post: '4 / 5', pagina: '3 / 4',
};

/** Lo que se escribe solo en la caja de «¿Qué vas a crear hoy?». */
const EJEMPLOS = ['Un guion de reel sobre el error que todos cometen…', 'Un email de bienvenida para los que se registran…', 'El copy de un anuncio para…', 'Una VSL para vender mi programa…'];

export function Copywriter({ ws, paginas: iniciales, guion, error, catalogos, base = '/copywriter', tipoInicial = null, nuevaInicial = false, ofertas, portada }: PropsCopywriter) {
  const router = useRouter();
  const [paginas, setPaginas] = useState<PaginaCopy[]>(iniciales);
  const [editor, setEditor] = useState<DocVivo | null>(null);
  // «Preguntar a MaKo» de la página: lo seleccionado entra como cita en la caja del chat (lo llena PanelMaKo).
  const citar = useRef<((seleccion?: string) => void) | null>(null);
  const [pausa, setPausa] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [comoPlantilla, setComoPlantilla] = useState<{ id: string; nombre: string } | null>(null);
  const propias = usePlantillasPropias('guion', { formato: '3 / 4' });
  const cajaMako = useRef<HTMLTextAreaElement | null>(null);
  // El título y las propiedades de ahora (los pone EditorGuion; el chat los lee al mandar).
  const vivoGuion = useRef<GuionVivo | null>(null);
  const leerVivo = useCallback(() => vivoGuion.current, []);
  const ponerVivo = useCallback((v: GuionVivo) => { vivoGuion.current = v; }, []);
  // Lo que el chat cambia de la página al aceptar una propuesta (lo pone EditorGuion).
  const apiPagina = useRef<ApiPagina | null>(null);
  const leerApi = useCallback(() => apiPagina.current, []);
  const ponerApi = useCallback((a: ApiPagina | null) => { apiPagina.current = a; }, []);
  const { toast, show, clear } = useToast();
  const avisar = useCallback((t: string, deshacer?: () => void, tono?: 'bad') => show(t, deshacer, tono), [show]);

  // El índice que trae el server al navegar (otra página) es el más nuevo: se adopta.
  const vistas = useRef(iniciales);
  useEffect(() => {
    if (vistas.current !== iniciales) { vistas.current = iniciales; setPaginas(iniciales); }
  }, [iniciales]);

  const abierta = guion?.pagina.id ?? null;
  const rutaDe = useCallback((id: string) => (base === '/copywriter' ? rutaGuion(id) : `${base}/${id}`), [base]);
  const abrir = useCallback((id: string) => { if (id !== abierta) router.push(rutaDe(id)); }, [abierta, rutaDe, router]);

  /** Un cambio del índice: en el acto, y si el server dice que no, vuelve a lo de antes y lo dice. */
  const cambiar = useCallback(async (local: (ps: PaginaCopy[]) => PaginaCopy[], server: () => Promise<{ ok: true; paginas: PaginaCopy[] } | { ok: false; error: string }>, fallo: string) => {
    let antes: PaginaCopy[] = [];
    setPaginas((ps) => { antes = ps; return local(ps); });
    const r = await server();
    if (r.ok) { setPaginas(r.paginas); return true; }
    setPaginas(antes);
    avisar(`${fallo}: ${r.error}`, undefined, 'bad');
    return false;
  }, [avisar]);

  /** Crea una página desde un template (el cuerpo, el tipo y la estructura del template) y la abre. Devuelve el error. */
  const creando = useRef(false);
  const crear = useCallback(async (plantilla: Plantilla, padre: string | null, pedido = ''): Promise<string | null> => {
    if (creando.current) return null;
    creando.current = true;
    const { tipo } = plantilla;
    const titulo = pedido ? pedido.replace(/\s+/g, ' ').slice(0, 80) : '';
    // La página nace con la ESTRUCTURA (sus secciones y una guía corta en cada una), no con el ejemplo: el ejemplo de un
    // negocio ficticio parecía el guion que MaKo había escrito para el negocio (Martín, 29/10/2026). Con un ejemplo, la
    // página recuerda de qué plantilla nació: «Ver ejemplo» (EditorGuion) y las preguntas de MaKo (PanelMaKo).
    const props = propsNuevas(tipo, plantilla.estructura, { plantilla: plantilla.ejemplo ? plantilla.id : null, duracion: plantilla.duracion });
    const r = await pedirCrear({ tipo, padre, titulo, props, contenido: plantilla.esqueleto() });
    creando.current = false;
    if (!r.ok) return `No se pudo crear la página: ${r.error}`;
    setPaginas(r.paginas);
    if (pedido) guardarPedido(ws, r.pagina.id, pedido);
    abrir(r.pagina.id);
    return null;
  }, [abrir, ws]);

  const renombrar = useCallback((id: string, titulo: string) => {
    void cambiar((ps) => { const x = cambiarPagina(ps, id, { titulo }); return x.ok ? x.paginas : ps; }, () => pedirRenombrar(id, { titulo }), 'No se pudo renombrar');
  }, [cambiar]);

  const ponerEmoji = useCallback((id: string, emoji: string | null) => {
    void cambiar((ps) => { const x = cambiarPagina(ps, id, { emoji }); return x.ok ? x.paginas : ps; }, () => pedirRenombrar(id, { emoji }), 'No se pudo cambiar el ícono');
  }, [cambiar]);

  const restaurar = useCallback((id: string) => {
    void cambiar((ps) => { const x = restaurarEnArbol(ps, id); return x.ok ? x.paginas : ps; }, () => pedirRestaurar(id), 'No se pudo restaurar');
  }, [cambiar]);

  const papelera = useCallback(async (id: string) => {
    const ok = await cambiar((ps) => { const x = aPapelera(ps, id, new Date().toISOString()); return x.ok ? x.paginas : ps; }, () => pedirPapelera(id), 'No se pudo mover a la Papelera');
    if (!ok) return;
    avisar('Movida a la Papelera', () => restaurar(id));
    // Si era la abierta (o una de las suyas), se va a la última que quede.
    if (abierta === id) router.push(base);
  }, [abierta, avisar, base, cambiar, restaurar, router]);

  /** Lo que cambia mientras se escribe en la página abierta (el título, el tipo): la lista lo dibuja en el acto. */
  const enVivo = useCallback((c: Partial<Pick<PaginaCopy, 'titulo' | 'tipo' | 'emoji'>>) => {
    if (!abierta) return;
    setPaginas((ps) => { const x = cambiarPagina(ps, abierta, c); return x.ok ? x.paginas : ps; });
  }, [abierta]);

  const alMako = useCallback((seleccion?: string) => { if (citar.current) citar.current(seleccion); else cajaMako.current?.focus(); }, []);

  // ── Lo que recibe el shell ────────────────────────────────────────────────
  const todas = useMemo(() => plantillasDe(catalogos), [catalogos]);
  const enBlanco = useMemo(() => todas.find((x) => x.id === 'blanco') ?? todas[todas.length - 1], [todas]);
  const plantillas = useMemo((): PlantillaCrear[] => {
    const visibles = plantillasVisibles(todas);
    const orden = tipoInicial ? [...visibles.filter((x) => x.tipo === tipoInicial), ...visibles.filter((x) => x.tipo !== tipoInicial)] : visibles;
    // La tarjeta muestra lo que se va a crear (Martín, 29/10/2026: «no pueden haber miniaturas en blanco»): el gancho real
    // del ejemplo como hoja, las secciones como chips, la insignia y la cinta «Ejemplo». Sin ejemplo, la descripción.
    return orden.map((x) => ({
      id: x.id, nombre: x.nombre, formato: FORMATO[x.tipo], grupo: x.grupo, ayuda: x.descripcion,
      rotulo: x.insignia ?? `${x.emoji} ${INFO_TIPO[x.tipo].label}`, insignia: x.insignia ?? `${x.emoji} ${INFO_TIPO[x.tipo].label}`,
      extracto: extractoDe(x) || x.descripcion, chips: chipsDe(x),
      ...(x.ejemplo ? { ejemplo: x.ejemplo.negocio } : {}),
    }));
  }, [todas, tipoInicial]);

  // La lista de páginas en el orden del árbol: las subpáginas debajo de la suya, con «↳».
  const proyectos = useMemo((): ProyectoCrear[] => enOrdenDeArbol(paginas).filter(({ p }) => !escondida(paginas, p.id)).map(({ p, nivel }) => ({
    id: p.id,
    nombre: `${nivel ? '↳ ' : ''}${p.emoji ?? INFO_TIPO[p.tipo].emoji} ${p.titulo || SIN_TITULO}`,
    href: rutaDe(p.id),
    cuando: Date.parse(p.actualizado) || null,
    menu: [
      { rotulo: 'Agregar una página adentro', hacer: async () => { const e = await crear(enBlanco, p.id); if (e) avisar(e, undefined, 'bad'); } },
      { rotulo: 'Guardar como plantilla', hacer: () => setComoPlantilla({ id: p.id, nombre: p.titulo || SIN_TITULO }) },
      { rotulo: 'Mover a la Papelera', peligro: true, hacer: () => papelera(p.id) },
    ],
  })), [paginas, rutaDe, crear, enBlanco, avisar, papelera]);

  const enPapelera = dePapelera(paginas);
  // Al pie, sólo la Papelera. Las herramientas de redacción del super admin no tienen mención desde el 29/10/2026 (D15).
  const pieLista: ReactNode = <PapeleraCopy paginas={enPapelera} onRestaurar={restaurar} />;

  const chat = (volver: ReactNode) => (
    <div className="nt" data-en-tarjeta="">
      <PanelMaKo ws={ws} guion={guion} paginas={paginas} editor={editor} leerVivo={leerVivo} leerApi={leerApi} catalogos={catalogos}
        campo={cajaMako} onPausa={setPausa} avisar={avisar} citarRef={citar} volver={volver} ofertas={ofertas} />
    </div>
  );

  return (
    <>
      <PantallaCrear tab="Copywriting" nuevo="Nueva página" proyectos={proyectos} actual={abierta} pieLista={pieLista}
        plantillas={[...propias.plantillas, ...plantillas]} tituloPlantillas="Templates"
        onPlantilla={async (pl) => {
          const propia = await propias.usar(pl);
          if (propia !== false) return propia;
          const x = todas.find((t) => t.id === pl.id);
          return x ? crear(x, null) : 'Ese template ya no está.';
        }}
        ejemplos={EJEMPLOS} onPedido={(texto) => crear(enBlanco, null, texto)} chat={chat} creandoInicial={nuevaInicial || !!tipoInicial || (!guion && !error)}
        // La portada son los outliers, en el centro y con el chat a la izquierda; «Nueva página», desde un guion o desde las
        // plantillas, vuelve a ellos (las plantillas son «Crear desde cero», dentro de la portada).
        nueva={portada ? <OutliersCopy portada={portada} /> : undefined}
        alNuevo={portada ? undefined : () => router.push(base)}>
        {guion ? (
          <div className="nt" data-en-crear="">
            <EditorGuion key={guion.pagina.id} guion={guion} paginas={paginas} catalogos={catalogos}
              onPaginaEnVivo={enVivo} onTitulo={(t) => renombrar(guion.pagina.id, t)} onEmoji={(e) => ponerEmoji(guion.pagina.id, e)}
              onAbrir={abrir} onPapelera={() => void papelera(guion.pagina.id)} onEditor={setEditor} onMako={alMako} pausa={pausa}
              avisar={avisar} onVivo={ponerVivo} onApi={ponerApi} onCompartir={() => setCompartiendo(true)} />
          </div>
        ) : error ? (
          <div className="nt" data-en-crear=""><div className="nt-doc"><div className="nt-inicio"><div className="nt-aviso" role="alert">{error}<ReportarASoporte /></div></div></div></div>
        ) : null}
      </PantallaCrear>
      {guion && (
        <Compartir recurso={RECURSO_GUION} recursoId={guion.pagina.id}
          etiqueta={paginas.find((x) => x.id === guion.pagina.id)?.titulo ?? (guion.pagina.titulo || SIN_TITULO)}
          nota="Quien abra el link puede escribir y cambiar esta página, sin cuenta. Lo que guarde queda marcado con su nombre en «Última edición»."
          abierto={compartiendo} onCerrar={() => setCompartiendo(false)} variante="app" />
      )}
      <ModalGuardarPlantilla tipo="guion" de={comoPlantilla} alSalir={() => setComoPlantilla(null)} alGuardar={propias.recargar} />
      <Toast state={toast} onClose={clear} />
    </>
  );
}

/** El pie de la lista: la Papelera de Notion, con «Restaurar» (no hay «borrar para siempre» en esta versión, D4). */
function PapeleraCopy({ paginas, onRestaurar }: { paginas: readonly PaginaCopy[]; onRestaurar: (id: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <div className="nt-papelera">
      <button type="button" className="cr-item" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta}>
        <span className="cr-item__ico" aria-hidden>✕</span><span className="cr-item__nombre">Papelera{paginas.length ? ` (${paginas.length})` : ''}</span>
      </button>
      {abierta && (
        <div className="nt-papelera-lista">
          {paginas.length === 0 && <p className="cr-lista__aviso">No hay nada en la Papelera.</p>}
          {paginas.map((p) => (
            <div key={p.id} className="nt-papelera-fila">
              <span className="cr-item__nombre">{p.emoji ?? INFO_TIPO[p.tipo].emoji} {p.titulo || SIN_TITULO}</span>
              <button type="button" className="nt-miga" onClick={() => onRestaurar(p.id)}>Restaurar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
