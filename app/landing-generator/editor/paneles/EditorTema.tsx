'use client';

// =============================================================================
// EditorTema — el editor de tema de Gamma (Colores · Fuentes · Logotipo · Diseño · Opciones avanzadas)
// =============================================================================
// Pedido de Martín (11/10/2026): «Replica por completo a Gamma». Es el modal que abre
// «+ Nuevo tema» o «Personalizar» en el panel de Tema (gamma-ui.md §5.12.1, gamma-tokens.md §9):
// nombre editable arriba («Tema sin título» ✎), navegación a la izquierda, el formulario en el
// medio, la vista previa a la derecha y el pie [Cancelar] [Guardar tema].
//
// Un tema propio se guarda como `TemaPropio` = { id, nombre, base, cambios } (api-tipos.ts) en
// `app_settings.landing.temas` por `{accion:'guardarTema'}`: un tema del catálogo (la base) más
// lo que la persona cambió. Lo que se dibuja SIEMPRE es `mezclarTema(base, cambios)`, la misma
// función que usa el render público (temas.ts), y lo que se manda pasa antes por
// `sanearCambiosTema`: la vista previa no puede mostrar algo que la página publicada no vaya a
// dibujar igual.
//
// Lo que NO se copia de Gamma, y por qué:
//   · «Imágenes» (estilos de imagen de IA por tema): las imágenes del editor salen del selector
//     (stock, subida, Google Flow), no de un estilo guardado en el tema.
//   · Sombra de 3 niveles y borde de 4 grosores: el tema de MaKo tiene sombra sí/no y borde
//     sí/no con su color (Tema.tarjeta en temas.ts); la hoja no tiene más niveles.
//   · El CSS libre por tema (contentStyles): sería una puerta de inyección en una página pública.
//   · «Logotipo»: en Gamma es del tema; acá es el logo de la barra del SITIO
//     (`config.sitio.nav.logo`), que es donde una landing lo muestra. Por eso se guarda al
//     elegirlo, sin esperar a «Guardar tema».
// =============================================================================

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { nuevoId } from '@/lib/editor-landing/doc';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import {
  FUENTES, REDONDECES, RADIO_BOTON, RADIO_TARJETA, TEMAS, coloresDeRelleno, colorDeRelleno, esDegradado,
  mezclarTema, sanearCambiosTema, temaPorId, urlFuentes, varsDeTema, type Redondez, type Tema,
} from '@/lib/editor-landing/temas';
import { useEditorLanding } from '../contexto';
import {
  Campo, CampoImagen, EntradaColor, Icono, ModalGma, Segmentado, SelectorGma, cambiarSitio, pedir, useConfigViva, useConfirmaGma,
  type OpcionSelector,
} from '../dialogos/piezas-gma';

/** Con qué abre el editor: un tema propio existente (`id`) o uno nuevo sobre una base del catálogo. */
export type ArranqueEditorTema = { id: string | null; nombre: string; base: string; cambios: Record<string, unknown> };

type Seccion = 'colores' | 'fuentes' | 'logotipo' | 'diseno' | 'avanzadas';

const SECCIONES: { valor: Seccion; texto: string; icono: string }[] = [
  { valor: 'colores', texto: 'Colores', icono: 'paleta' },
  { valor: 'fuentes', texto: 'Fuentes', icono: 'fuente' },
  { valor: 'logotipo', texto: 'Logotipo', icono: 'marca' },
  { valor: 'diseno', texto: 'Diseño', icono: 'diseno' },
  { valor: 'avanzadas', texto: 'Opciones avanzadas', icono: 'ajustes' },
];

const NOMBRE_PESO: Record<number, string> = {
  100: 'Delgada', 200: 'Extraligera', 300: 'Ligera', 400: 'Normal', 500: 'Media', 600: 'Seminegrita', 700: 'Negrita', 800: 'Extranegrita', 900: 'Negra',
};
const TIPO_FUENTE: Record<string, string> = { sans: 'Sans', serif: 'Serif', mono: 'Mono', display: 'Display' };

const CSS_EDITOR_TEMA = [
  '.gmp-et{display:grid;grid-template-columns:184px minmax(0,1fr) 320px;gap:0;height:100%;margin:0 -24px -20px}',
  '.gmp-et-nav{display:grid;align-content:start;gap:2px;padding:8px 12px;border-right:1px solid var(--gmp-borde);overflow-y:auto}',
  '.gmp-et-nav button{display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--gmp-titulo);font-size:14px;font-weight:600;text-align:left;cursor:pointer}',
  '.gmp-et-nav button:hover{background:var(--gmp-hover)}',
  '.gmp-et-nav button[aria-current="true"]{background:var(--gmp-azul-claro);color:var(--gmp-sobre-azul-claro)}',
  '.gmp-et-form{padding:12px 20px 24px;overflow-y:auto;min-height:0}',
  '.gmp-et-vista{display:flex;align-items:center;justify-content:center;padding:20px;border-left:1px solid var(--gmp-borde);overflow:hidden}',
  '.gmp-et-pagina{width:100%;padding:18px;border-radius:12px;background:var(--gm-fondo);background-size:cover;font-size:13px}',
  '.gmp-et-tarjeta{padding:18px;border-radius:var(--gm-radio-tarjeta);background:var(--gm-tarjeta-fondo);box-shadow:var(--gm-tarjeta-borde),var(--gm-tarjeta-sombra);-webkit-backdrop-filter:var(--gm-tarjeta-filtro);backdrop-filter:var(--gm-tarjeta-filtro);color:var(--gm-texto);font-family:var(--gm-fuente-cuerpo);font-weight:var(--gm-peso-cuerpo);line-height:var(--gm-interlineado-cuerpo);letter-spacing:var(--gm-tracking-cuerpo)}',
  '.gmp-et-titulo{margin:0 0 8px;font-family:var(--gm-fuente-titulo);font-weight:var(--gm-peso-titulo);font-size:calc(1.9em * var(--gm-escala-titulos));line-height:var(--gm-interlineado-titulos);letter-spacing:var(--gm-tracking-titulos);color:var(--gm-titulo-relleno);background:var(--gm-titulo-degradado);-webkit-background-clip:text;background-clip:text;padding-bottom:var(--gm-titulo-sangrado)}',
  '.gmp-et-cuerpo{margin:0 0 12px;font-size:calc(1em * var(--gm-escala-cuerpo))}',
  '.gmp-et-cuerpo a{color:var(--gm-enlace);text-decoration:underline}',
  '.gmp-et-boton{display:inline-flex;align-items:center;height:2.6em;padding:0 1.2em;border:0;border-radius:var(--gm-radio-boton);background:var(--gm-boton);color:var(--gm-boton-texto);font:inherit;font-weight:600}',
  '.gmp-et-puntos{display:flex;gap:5px;margin-top:14px}',
  '.gmp-et-puntos i{width:14px;height:14px;border-radius:50%}',
  '.gmp-et-nombre{width:100%;min-width:0;height:34px;padding:0 6px;margin-left:-6px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--gmp-titulo);font:inherit;font-size:22px;font-weight:700}',
  '.gmp-et-nombre:hover{border-color:var(--gmp-borde)}',
  '.gmp-et-nombre:focus{outline:none;border-color:var(--gmp-azul-linea)}',
  '.gmp-redondez{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}',
  '.gmp-redondez button{display:grid;place-items:center;height:54px;border:1.5px solid var(--gmp-borde);border-radius:10px;background:var(--gmp-fondo);cursor:pointer}',
  '.gmp-redondez button[aria-pressed="true"]{border-color:var(--gmp-azul-linea);background:var(--gmp-azul-claro)}',
  '.gmp-redondez i{display:block;width:34px;height:24px;border:2px solid var(--gmp-texto);border-right:0;border-bottom:0}',
  '.gmp-rango{display:flex;align-items:center;gap:10px}',
  '.gmp-rango input{flex:1;accent-color:var(--gmp-azul)}',
  '.gmp-rango output{min-width:46px;text-align:right;font-variant-numeric:tabular-nums;color:var(--gmp-tenue);font-size:13px}',
  '.gmp-paleta{display:flex;flex-wrap:wrap;gap:8px;align-items:center}',
  '.gmp-paleta-item{position:relative}',
  '.gmp-paleta-item input{width:34px;height:34px;padding:2px;border:1px solid var(--gmp-borde);border-radius:8px;background:var(--gmp-fondo);cursor:pointer}',
  '.gmp-paleta-item button{position:absolute;top:-6px;right:-6px;display:none;width:18px;height:18px;padding:0;border:0;border-radius:50%;background:var(--gmp-tinta);color:var(--gmp-fondo);cursor:pointer;align-items:center;justify-content:center}',
  '.gmp-paleta-item:hover button{display:inline-flex}',
  '@media (max-width:900px){.gmp-et{grid-template-columns:150px minmax(0,1fr)}.gmp-et-vista{display:none}}',
  '@media (max-width:600px){.gmp-et{grid-template-columns:minmax(0,1fr)}.gmp-et-nav{display:flex;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--gmp-borde)}}',
].join('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Cambios: un objeto de hojas (`colores.acento`, `tarjeta.borde`…) que se arma de a una
// ─────────────────────────────────────────────────────────────────────────────

type Cambios = Record<string, unknown>;

/** `cambios` con `ruta` = `valor`, sin mutar (y sin la hoja si `valor` es undefined). */
export function ponerCambio(c: Cambios, ruta: readonly string[], valor: unknown): Cambios {
  const [k, ...resto] = ruta;
  const out: Cambios = { ...c };
  if (!resto.length) {
    if (valor === undefined) delete out[k];
    else out[k] = valor;
    return out;
  }
  const hijo = out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? (out[k] as Cambios) : {};
  out[k] = ponerCambio(hijo, resto, valor);
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Un relleno: color sólido o degradado lineal de dos paradas
// ─────────────────────────────────────────────────────────────────────────────

function EntradaRelleno({ etiqueta, valor, onCambiar }: { etiqueta: string; valor: string; onCambiar: (v: string) => void }) {
  const deg = esDegradado(valor);
  const paradas = coloresDeRelleno(valor);
  const a = paradas[0] ?? colorDeRelleno(valor);
  const b = paradas[paradas.length - 1] ?? a;
  const angulo = Number(/(-?\d+(?:\.\d+)?)deg/.exec(valor)?.[1] ?? 135);
  const armar = (x: string, y: string, ang: number) => `linear-gradient(${Math.round(((ang % 360) + 360) % 360)}deg, ${x} 0%, ${y} 100%)`;
  return (
    <Campo etiqueta={etiqueta}>
      <Segmentado etiqueta={etiqueta} valor={deg ? 'deg' : 'solido'}
        opciones={[{ valor: 'solido', texto: 'Sólido' }, { valor: 'deg', texto: 'Degradado' }]}
        onCambiar={(v) => onCambiar(v === 'deg' ? armar(a, b === a ? '#ffffff' : b, angulo) : colorDeRelleno(valor))} />
      {deg ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <EntradaColor etiqueta={`${etiqueta}: inicio`} valor={a} onCambiar={(h) => onCambiar(armar(h, b, angulo))} />
          <EntradaColor etiqueta={`${etiqueta}: final`} valor={b} onCambiar={(h) => onCambiar(armar(a, h, angulo))} />
          <div className="gmp-rango">
            <input type="range" min={0} max={360} step={5} value={angulo} aria-label={`${etiqueta}: ángulo`}
              onChange={(e) => onCambiar(armar(a, b, Number(e.target.value)))} />
            <output>{Math.round(angulo)}°</output>
          </div>
        </div>
      ) : (
        <EntradaColor etiqueta={etiqueta} valor={colorDeRelleno(valor)} onCambiar={onCambiar} />
      )}
    </Campo>
  );
}

function Rango({ etiqueta, valor, min, max, paso, onCambiar, formato }: {
  etiqueta: string; valor: number; min: number; max: number; paso: number; onCambiar: (v: number) => void; formato?: (v: number) => string;
}) {
  return (
    <Campo etiqueta={etiqueta}>
      <div className="gmp-rango">
        <input type="range" min={min} max={max} step={paso} value={valor} aria-label={etiqueta}
          onChange={(e) => onCambiar(Math.round(Number(e.target.value) * 1000) / 1000)} />
        <output>{formato ? formato(valor) : valor}</output>
      </div>
    </Campo>
  );
}

function SelectorRedondez({ etiqueta, valor, onCambiar, radios }: {
  etiqueta: string; valor: Redondez; onCambiar: (r: Redondez) => void; radios: Readonly<Record<Redondez, string>>;
}) {
  const nombres: Record<Redondez, string> = { sm: 'Sin redondear', md: 'Poco', lg: 'Medio', xl: 'Mucho' };
  return (
    <Campo etiqueta={etiqueta}>
      <div className="gmp-redondez" role="group" aria-label={etiqueta}>
        {REDONDECES.map((r) => (
          <button key={r} type="button" aria-pressed={valor === r} title={nombres[r]} aria-label={nombres[r]} onClick={() => onCambiar(r)}>
            <i style={{ borderTopLeftRadius: `calc(${radios[r]} * 1.6)`, fontSize: 14 }} />
          </button>
        ))}
      </div>
    </Campo>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La vista previa (la tarjeta de Gamma: Título, cuerpo con enlace, botón y la paleta)
// ─────────────────────────────────────────────────────────────────────────────

export function VistaTema({ tema }: { tema: Tema }) {
  const v = varsDeTema(tema);
  return (
    <div className="gmp-et-pagina" style={v as CSSProperties}>
      <div className="gmp-et-tarjeta">
        <h3 className="gmp-et-titulo">Título</h3>
        <p className="gmp-et-cuerpo">Cuerpo del texto con un <a href="#vista" onClick={(e) => e.preventDefault()}>enlace</a>.</p>
        <span className="gmp-et-boton">Botón</span>
        <div className="gmp-et-puntos">
          {tema.paleta.slice(0, 8).map((c, i) => <i key={i} style={{ background: c }} />)}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// El editor
// ─────────────────────────────────────────────────────────────────────────────

export function EditorTema({ arranque, onCerrar, onGuardado, onBorrado }: {
  arranque: ArranqueEditorTema;
  onCerrar: () => void;
  /** El tema guardado y la lista entera del workspace (quien abre lo aplica). */
  onGuardado: (tema: TemaPropio, lista: TemaPropio[]) => void;
  onBorrado?: (temaId: string, lista: TemaPropio[]) => void;
}) {
  const { avisar } = useEditorLanding();
  const { config, cambiar: cambiarConfig } = useConfigViva();
  const { confirmar, nodoConfirma } = useConfirmaGma();
  const [seccion, setSeccion] = useState<Seccion>('colores');
  const [nombre, setNombre] = useState(arranque.nombre);
  const [base, setBase] = useState(arranque.base);
  const [cambios, setCambios] = useState<Cambios>(arranque.cambios);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const temaBase = useMemo(() => temaPorId(base), [base]);
  const vista = useMemo(() => mezclarTema(temaBase, cambios), [temaBase, cambios]);
  const poner = (ruta: readonly string[], valor: unknown) => setCambios((c) => ponerCambio(c, ruta, valor));
  const fuentesUrl = urlFuentes([vista]);

  const opcionesBase: OpcionSelector<string>[] = TEMAS.map((t) => ({ valor: t.id, texto: t.nombre, sub: t.grupo === 'oscuro' ? 'Oscuro' : 'Claro' }));
  const opcionesFamilia: OpcionSelector<string>[] = Object.entries(FUENTES).map(([f, d]) => ({ valor: f, texto: f, sub: TIPO_FUENTE[d.tipo] }));
  const opcionesPeso = (familia: string): OpcionSelector<string>[] =>
    (FUENTES[familia]?.pesos ?? [400]).map((p) => ({ valor: String(p), texto: `${p} · ${NOMBRE_PESO[p] ?? ''}`.trim() }));

  const guardar = async () => {
    setOcupado(true);
    setError(null);
    const tema: TemaPropio = {
      id: arranque.id ?? nuevoId('tm'),
      nombre: nombre.trim() || 'Tema sin título',
      base,
      cambios: sanearCambiosTema(cambios),
    };
    const r = await pedir<'guardarTema'>({ accion: 'guardarTema', tema });
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    avisar('Tema guardado');
    onGuardado(r.tema, r.temas);
  };

  const borrar = async () => {
    if (!arranque.id) return;
    const ok = await confirmar({ titulo: 'Eliminar tema', texto: 'Las landings que lo usan vuelven al tema base.', boton: 'Eliminar' });
    if (!ok) return;
    setOcupado(true);
    const r = await pedir<'borrarTema'>({ accion: 'borrarTema', temaId: arranque.id });
    setOcupado(false);
    if (!r.ok) { setError(r.error); return; }
    avisar('Tema eliminado');
    onBorrado?.(arranque.id, r.temas);
  };

  let cuerpo: ReactNode = null;
  if (seccion === 'colores') {
    cuerpo = (
      <>
        <p className="gmp-grupo-tit">Página</p>
        <EntradaRelleno etiqueta="Fondo de página" valor={vista.fondo} onCambiar={(v) => poner(['fondo'], v)} />
        <p className="gmp-grupo-tit">Secciones</p>
        <EntradaRelleno etiqueta="Color de fondo de la sección" valor={vista.tarjeta.fondo} onCambiar={(v) => poner(['tarjeta', 'fondo'], v)} />
        <Campo etiqueta="Transparencia">
          <Segmentado etiqueta="Transparencia" valor={vista.tarjeta.transparencia}
            opciones={[{ valor: 'normal', texto: 'Normal' }, { valor: 'esmerilado', texto: 'Esmerilado' }]}
            onCambiar={(v) => poner(['tarjeta', 'transparencia'], v)} />
        </Campo>
        <p className="gmp-grupo-tit">Texto</p>
        <Campo etiqueta="Color del cuerpo"><EntradaColor etiqueta="Color del cuerpo" valor={vista.colores.texto} onCambiar={(h) => poner(['colores', 'texto'], h)} /></Campo>
        <EntradaRelleno etiqueta="Color de los títulos" valor={vista.colores.titulo} onCambiar={(v) => poner(['colores', 'titulo'], v)} />
        <Campo etiqueta="Acento"><EntradaColor etiqueta="Acento" valor={vista.colores.acento} onCambiar={(h) => poner(['colores', 'acento'], h)} /></Campo>
        <Campo etiqueta="Color del enlace"><EntradaColor etiqueta="Color del enlace" valor={vista.colores.enlace} onCambiar={(h) => poner(['colores', 'enlace'], h)} /></Campo>
        <p className="gmp-grupo-tit">Botones</p>
        <EntradaRelleno etiqueta="Color del botón" valor={vista.colores.boton} onCambiar={(v) => poner(['colores', 'boton'], v)} />
        <Campo etiqueta="Texto del botón"><EntradaColor etiqueta="Texto del botón" valor={vista.colores.botonTexto} onCambiar={(h) => poner(['colores', 'botonTexto'], h)} /></Campo>
      </>
    );
  } else if (seccion === 'fuentes') {
    const fila = (que: 'titulo' | 'cuerpo', rotulo: string) => (
      <>
        <p className="gmp-grupo-tit">{rotulo}</p>
        <Campo etiqueta="Fuente">
          <SelectorGma etiqueta={`${rotulo}: fuente`} valor={vista.fuentes[que].familia} opciones={opcionesFamilia}
            onCambiar={(f) => poner(['fuentes', que, 'familia'], f)} />
        </Campo>
        <Campo etiqueta="Peso">
          <SelectorGma etiqueta={`${rotulo}: peso`} valor={String(vista.fuentes[que].peso)} opciones={opcionesPeso(vista.fuentes[que].familia)}
            onCambiar={(p) => poner(['fuentes', que, 'peso'], Number(p))} />
        </Campo>
      </>
    );
    cuerpo = <>{fila('titulo', 'Encabezados')}{fila('cuerpo', 'Cuerpo')}</>;
  } else if (seccion === 'logotipo') {
    cuerpo = (
      <>
        <p className="gmp-grupo-tit">Logotipo</p>
        <CampoImagen etiqueta="Logotipo" valor={config.sitio.nav.logo} ancho={120} proporcion="3 / 1" ayuda="Va en la barra del sitio."
          onCambiar={(u) => cambiarConfig((c) => cambiarSitio(c, { nav: { ...c.sitio.nav, logo: u, ...(u ? { mostrar: true } : {}) } }))} />
      </>
    );
  } else if (seccion === 'diseno') {
    cuerpo = (
      <>
        <p className="gmp-grupo-tit">Secciones</p>
        <SelectorRedondez etiqueta="Redondez" valor={vista.redondez.tarjeta} radios={RADIO_TARJETA} onCambiar={(r) => poner(['redondez', 'tarjeta'], r)} />
        <Campo etiqueta="Sombra">
          <Segmentado etiqueta="Sombra" valor={vista.tarjeta.sombra ? 'si' : 'no'}
            opciones={[{ valor: 'no', texto: 'Ninguna' }, { valor: 'si', texto: 'Predeterminada' }]}
            onCambiar={(v) => poner(['tarjeta', 'sombra'], v === 'si')} />
        </Campo>
        <Campo etiqueta="Borde">
          <Segmentado etiqueta="Borde" valor={vista.tarjeta.borde ? 'fino' : 'ninguno'}
            opciones={[{ valor: 'ninguno', texto: 'Ninguno' }, { valor: 'fino', texto: 'Fino' }]}
            onCambiar={(v) => poner(['tarjeta', 'borde'], v === 'fino' ? (vista.tarjeta.borde ?? '#e6e6e6') : null)} />
        </Campo>
        {vista.tarjeta.borde && (
          <Campo etiqueta="Color del borde">
            <EntradaColor etiqueta="Color del borde" valor={vista.tarjeta.borde} onCambiar={(h) => poner(['tarjeta', 'borde'], h)} />
          </Campo>
        )}
        <p className="gmp-grupo-tit">Botones y enlaces</p>
        <SelectorRedondez etiqueta="Redondez del botón" valor={vista.redondez.boton} radios={RADIO_BOTON} onCambiar={(r) => poner(['redondez', 'boton'], r)} />
      </>
    );
  } else {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const paleta = vista.paleta;
    cuerpo = (
      <>
        <p className="gmp-grupo-tit">Tamaño</p>
        <Rango etiqueta="Cuerpo" valor={vista.escala.cuerpo} min={0.8} max={1.25} paso={0.05} formato={pct} onCambiar={(v) => poner(['escala', 'cuerpo'], v)} />
        <Rango etiqueta="Títulos" valor={vista.escala.titulos} min={0.8} max={1.4} paso={0.05} formato={pct} onCambiar={(v) => poner(['escala', 'titulos'], v)} />
        <p className="gmp-grupo-tit">Interlineado</p>
        <Rango etiqueta="Cuerpo" valor={vista.interlineado.cuerpo} min={1.1} max={2} paso={0.05} onCambiar={(v) => poner(['interlineado', 'cuerpo'], v)} />
        <Rango etiqueta="Títulos" valor={vista.interlineado.titulos} min={0.9} max={1.6} paso={0.05} onCambiar={(v) => poner(['interlineado', 'titulos'], v)} />
        <p className="gmp-grupo-tit">Espaciado de letras</p>
        <Rango etiqueta="Cuerpo" valor={vista.tracking.cuerpo} min={-0.05} max={0.1} paso={0.005} formato={(v) => `${v}em`} onCambiar={(v) => poner(['tracking', 'cuerpo'], v)} />
        <Rango etiqueta="Títulos" valor={vista.tracking.titulos} min={-0.12} max={0.1} paso={0.005} formato={(v) => `${v}em`} onCambiar={(v) => poner(['tracking', 'titulos'], v)} />
        <p className="gmp-grupo-tit">Paleta</p>
        <div className="gmp-paleta">
          {paleta.map((c, i) => (
            <span key={i} className="gmp-paleta-item">
              <input type="color" value={c} aria-label={`Color ${i + 1} de la paleta`}
                onChange={(e) => poner(['paleta'], paleta.map((x, j) => (j === i ? e.target.value.toLowerCase() : x)))} />
              {paleta.length > 1 && (
                <button type="button" aria-label={`Quitar el color ${i + 1}`} title="Quitar"
                  onClick={() => poner(['paleta'], paleta.filter((_, j) => j !== i))}><Icono nombre="cerrar" tam={11} grosor={2.4} /></button>
              )}
            </span>
          ))}
          {paleta.length < 12 && (
            <button type="button" className="gmp-icono-btn" aria-label="Agregar un color" title="Agregar un color"
              onClick={() => poner(['paleta'], [...paleta, vista.colores.acento])}><Icono nombre="mas" tam={16} /></button>
          )}
        </div>
      </>
    );
  }

  return (
    <ModalGma
      titulo={<input className="gmp-et-nombre" aria-label="Nombre del tema" value={nombre} maxLength={60} placeholder="Tema sin título" onChange={(e) => setNombre(e.target.value)} />}
      etiqueta="Editor de tema"
      onCerrar={onCerrar}
      ancho={1040}
      alto="min(88vh, 740px)"
      ocupado={ocupado}
      pie={(
        <>
          {arranque.id && <BotonBorrar talla="md" texto="Eliminar tema" title="Eliminar este tema" disabled={ocupado} onClick={() => void borrar()} />}
          {error && <p className="gmp-error" style={{ marginLeft: 8 }}>{error}</p>}
          <span style={{ flex: 1 }} />
          <button type="button" className="gmp-btn gmp-btn-contorno" onClick={onCerrar} disabled={ocupado}>Cancelar</button>
          <button type="button" className="gmp-btn gmp-btn-primario" onClick={() => void guardar()} disabled={ocupado}>Guardar tema</button>
        </>
      )}>
      <style href="gmp-editor-tema" precedence="medium">{CSS_EDITOR_TEMA}</style>
      {fuentesUrl && <link rel="stylesheet" href={fuentesUrl} precedence="low" />}
      <div className="gmp-et">
        <nav className="gmp-et-nav" aria-label="Secciones del editor de tema">
          {SECCIONES.map((s) => (
            <button key={s.valor} type="button" aria-current={seccion === s.valor} onClick={() => setSeccion(s.valor)}>
              <Icono nombre={s.icono} tam={16} />{s.texto}
            </button>
          ))}
        </nav>
        <div className="gmp-et-form">
          <Campo etiqueta="Tema base">
            <SelectorGma etiqueta="Tema base" valor={base} opciones={opcionesBase} onCambiar={setBase} />
          </Campo>
          {cuerpo}
        </div>
        <div className="gmp-et-vista"><VistaTema tema={vista} /></div>
      </div>
      {nodoConfirma}
    </ModalGma>
  );
}

export default EditorTema;
