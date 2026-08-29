'use client';

// =============================================================================
// El cuaderno de trabajo del cliente
// =============================================================================
// LA TESIS: esto NO es un reproductor de curso, es un CUADERNO DE TRABAJO. Quien
// entra es un empresario de cincuenta y pico que dirige supermercados o una
// cadena de restaurantes, probablemente desde el teléfono, y viene a contestar
// preguntas difíciles sobre su propia empresa. La forma es la de Skool —módulos
// a la izquierda, la clase en el centro— pero el carácter es el de un cuaderno.
//
// De ahí salen las tres decisiones que gobiernan todo:
//
//   · LA PREGUNTA ES EL HÉROE. Va en 22px, no en 12px gris arriba de un input.
//     Todo formulario achica su etiqueta; acá la etiqueta ES el contenido, y lo
//     único que hay que lograr es que la lea de verdad antes de escribir.
//   · UNA CLASE A LA VEZ. Las 44 están en el lomo de la izquierda, no adelante.
//   · SE GUARDA SOLO. Un botón «Guardar» que no se toca pierde media hora de
//     trabajo, y a este señor no le vas a pedir que se acuerde.
//
// LA FIRMA: el lomo. Una línea vertical continua que atraviesa los doce módulos
// y se llena hasta donde llegó, con un punto por clase. Es una REGLA de medir, y
// eso no es decoración: el producto que está comprando se llama «Sistema Negocio
// que Escala» y su tesis entera es que lo que no se mide no se sostiene. El
// avance del cuaderno se lee igual que el tablero que va a terminar teniendo.
//
// Y LO QUE NO HAY: ni tarjetas adentro del formulario, ni sombras, ni íconos
// decorativos. La única tinta de color son los puntos de estado y el dorado
// cuando MaKo propuso algo.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ModuloVista, ClaseVista } from '@/lib/cs-tarea-vista';
import type { Campo } from '@/lib/programa-campos';
import { tieneValor, tablaParaEditar, filaVacia, type Valor, type Valores } from '@/lib/cs-valores';

type Guardado = 'limpio' | 'escribiendo' | 'guardando' | 'guardado' | 'error';

export default function TareaCliente({ token, nombre, modulos, inicial, totales }: {
  token: string;
  nombre: string | null;
  modulos: ModuloVista[];
  inicial: string;
  totales: { clases: number; listas: number; esperandoSuOk: number };
}) {
  const [abierta, setAbierta] = useState(inicial);
  const [datos, setDatos] = useState<Record<string, ClaseVista>>(
    () => Object.fromEntries(modulos.flatMap(m => m.clases).map(c => [c.claseId, c])),
  );
  const [lomoAbierto, setLomoAbierto] = useState(false);
  const [estado, setEstado] = useState<Guardado>('limpio');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clase = datos[abierta] ?? Object.values(datos)[0];
  const moduloDe = useMemo(
    () => modulos.find(m => m.clases.some(c => c.claseId === clase?.claseId)),
    [modulos, clase],
  );

  const listas = Object.values(datos).filter(c => c.estado === 'aprobada').length;
  const contestadas = Object.values(datos).filter(c => c.estado !== 'pendiente').length;

  // ── Guardado ───────────────────────────────────────────────────────────────
  const mandar = useCallback(async (claseId: string, valores: Valores) => {
    setEstado('guardando');
    try {
      const r = await fetch('/api/compartido/tarea', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, claseId, valores }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { estado: ClaseVista['estado'] };
      setDatos(d => ({ ...d, [claseId]: { ...d[claseId], estado: j.estado } }));
      setEstado('guardado');
    } catch {
      // Que se VEA. Acaba de escribir a mano media pantalla: dejarlo creer que
      // quedó guardado es la peor forma de fallar acá.
      setEstado('error');
    }
  }, [token]);

  const cambiar = (campoId: string, valor: Valor) => {
    const claseId = clase.claseId;
    const valores = { ...clase.valores, [campoId]: valor };
    setDatos(d => ({
      ...d,
      [claseId]: { ...d[claseId], valores, faltan: faltanDe(d[claseId].campos, valores) },
    }));
    setEstado('escribiendo');
    if (timer.current) clearTimeout(timer.current);
    // Dos segundos de quietud es lo que separa «terminó una idea» de «está
    // pensando». Un POST por tecla es ruido.
    timer.current = setTimeout(() => { void mandar(claseId, valores); }, 2000);
  };

  // Si cierra la pestaña con algo sin mandar, se manda igual: `sendBeacon`
  // sobrevive a la navegación, un `fetch` normal no.
  useEffect(() => {
    const alSalir = () => {
      if (estado !== 'escribiendo') return;
      navigator.sendBeacon?.(
        '/api/compartido/tarea',
        new Blob([JSON.stringify({ token, claseId: clase.claseId, valores: clase.valores })],
          { type: 'application/json' }),
      );
    };
    window.addEventListener('pagehide', alSalir);
    return () => window.removeEventListener('pagehide', alSalir);
  }, [estado, token, clase]);

  const irA = (claseId: string) => {
    if (timer.current) { clearTimeout(timer.current); void mandar(clase.claseId, clase.valores); }
    setAbierta(claseId);
    setLomoAbierto(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };

  async function aprobar(texto: string) {
    setEstado('guardando');
    const r = await fetch('/api/compartido/tarea', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, claseId: clase.claseId, texto, accion: 'aprobar' }),
    }).catch(() => null);
    if (!r?.ok) { setEstado('error'); return; }
    setDatos(d => ({ ...d, [clase.claseId]: { ...d[clase.claseId], estado: 'aprobada', respuesta: texto } }));
    setEstado('guardado');
  }

  if (!clase) return null;
  const enAprobacion = clase.estado === 'revisada_ia' && Boolean(clase.respuestaIa);

  return (
    <div className="cd">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="cd-top">
        <div className="cd-marca">
          <span className="m1">Sistema Negocio que Escala</span>
          <span className="m2">{nombre ? `Cuaderno de ${nombre}` : 'Tu cuaderno'}</span>
        </div>
        <div className="cd-marcador">
          <span className="n">{listas}</span>
          <span className="d">de {totales.clases} bloques listos</span>
        </div>
        <button className="cd-verlomo" onClick={() => setLomoAbierto(v => !v)} aria-expanded={lomoAbierto}>
          {lomoAbierto ? 'Cerrar' : `Los ${totales.clases} bloques`}
        </button>
      </header>

      <div className="cd-cuerpo">
        {/* EL LOMO. Una regla de medir: la línea lo atraviesa entero y cada
            clase es una marca. El punto dice su estado sin depender del color
            solo — el relleno y el anillo son formas distintas. */}
        <nav className={`cd-lomo${lomoAbierto ? ' abierto' : ''}`} aria-label="Bloques del programa">
          <div className="cd-lomo-in">
            <p className="cd-lomo-tit">
              {contestadas} de {totales.clases} contestados
            </p>
            {modulos.map((m) => (
              <section key={m.moduloId} className="cd-mod">
                <h2>
                  <span className="mn">{m.numero}</span>
                  <span className="mt">{m.titulo}</span>
                </h2>
                {m.loContestaElLider && <p className="cd-mod-nota">Lo contesta el líder del área</p>}
                <ul>
                  {m.clases.map((c) => {
                    const d = datos[c.claseId] ?? c;
                    return (
                      <li key={c.claseId}>
                        <button
                          className={`cd-cl e-${d.estado}${c.claseId === abierta ? ' es' : ''}`}
                          onClick={() => irA(c.claseId)}
                          aria-current={c.claseId === abierta ? 'true' : undefined}
                        >
                          <span className="pt" aria-hidden />
                          <span className="nu">{d.numero}</span>
                          <span className="ti">{d.titulo}</span>
                          {d.estado === 'revisada_ia' && <span className="ok" title="Esperando tu ok">●</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </nav>

        <main className="cd-hoja">
          <p className="cd-migas">
            Módulo {moduloDe?.numero} · {moduloDe?.titulo}
          </p>
          <h1 className="cd-h1">
            <span className="nu">{clase.numero}</span>
            {clase.titulo}
          </h1>
          <p className="cd-res">{clase.pregunta}</p>

          {clase.atoro && (
            <aside className="cd-ojo">
              <b>Ojo con esto.</b> {clase.atoro}
            </aside>
          )}
          {moduloDe?.loContestaElLider && (
            <aside className="cd-ojo">
              Este bloque lo contesta <b>el líder del área</b>, no el dueño. Los umbrales los pone
              quien va a responder por ellos.
            </aside>
          )}

          {enAprobacion ? (
            <Aprobacion clase={clase} onAprobar={aprobar} guardando={estado === 'guardando'} />
          ) : (
            <>
              <ol className="cd-campos">
                {clase.campos.map((campo, i) => (
                  <li key={campo.id} className="cd-campo">
                    <span className="cd-num" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
                    <div className="cd-campo-in">
                      <label className="cd-preg" htmlFor={`c-${campo.id}`}>
                        {campo.label}
                        {campo.obligatorio && <span className="req" title="Hace falta"> *</span>}
                      </label>
                      {campo.ayuda && <p className="cd-ayuda">{campo.ayuda}</p>}
                      <CampoEditor
                        campo={campo}
                        valor={clase.valores[campo.id]}
                        onCambio={(v) => cambiar(campo.id, v)}
                      />
                    </div>
                  </li>
                ))}
              </ol>

              <footer className="cd-pie">
                <p className={`cd-est e-${estado}`}>
                  {estado === 'guardado' && 'Guardado.'}
                  {estado === 'guardando' && 'Guardando…'}
                  {estado === 'escribiendo' && 'Se guarda solo en unos segundos.'}
                  {estado === 'error' && 'No se pudo guardar. Revisa la conexión y vuelve a escribir algo.'}
                  {estado === 'limpio' && (clase.faltan > 0
                    ? `Te faltan ${clase.faltan} de este bloque. Se guarda solo mientras escribes.`
                    : 'Se guarda solo mientras escribes.')}
                </p>
                <Siguiente modulos={modulos} actual={clase.claseId} onIr={irA} />
              </footer>
            </>
          )}
        </main>
      </div>

      <p className="cd-ft">Tu enlace es privado. No hace falta cuenta ni contraseña.</p>
    </div>
  );
}

// ── Los seis tipos de campo ──────────────────────────────────────────────────

function CampoEditor({ campo, valor, onCambio }: {
  campo: Campo; valor: Valor | undefined; onCambio: (v: Valor) => void;
}) {
  if (campo.tipo === 'tabla') return <Tabla campo={campo} valor={valor} onCambio={onCambio} />;

  if (campo.tipo === 'eleccion') {
    return (
      <div className="cd-ops" role="radiogroup" aria-label={campo.label}>
        {(campo.opciones ?? []).map((o) => (
          <label key={o} className={`cd-op${valor === o ? ' es' : ''}`}>
            <input type="radio" name={campo.id} checked={valor === o} onChange={() => onCambio(o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  }

  if (campo.tipo === 'checks') {
    const marcadas = Array.isArray(valor) && !Array.isArray(valor[0]) ? (valor as string[]) : [];
    return (
      <div className="cd-ops">
        {(campo.opciones ?? []).map((o) => (
          <label key={o} className={`cd-op${marcadas.includes(o) ? ' es' : ''}`}>
            <input
              type="checkbox" checked={marcadas.includes(o)}
              onChange={() => onCambio(marcadas.includes(o) ? marcadas.filter(x => x !== o) : [...marcadas, o])}
            />
            <span>{o}</span>
          </label>
        ))}
      </div>
    );
  }

  if (campo.tipo === 'linea' || campo.tipo === 'numero') {
    return (
      <input
        id={`c-${campo.id}`} className="cd-linea"
        type={campo.tipo === 'numero' ? 'number' : 'text'}
        inputMode={campo.tipo === 'numero' ? 'decimal' : undefined}
        value={typeof valor === 'string' ? valor : ''}
        onChange={(e) => onCambio(e.target.value)}
      />
    );
  }

  return <AreaQueCrece id={`c-${campo.id}`} valor={typeof valor === 'string' ? valor : ''} onCambio={onCambio} />;
}

/** El textarea crece con lo escrito. Un cuadro fijo con scroll adentro esconde
 *  lo que la persona ya escribió, que es justo lo que necesita releer. */
function AreaQueCrece({ id, valor, onCambio }: { id: string; valor: string; onCambio: (v: string) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(96, el.scrollHeight)}px`;
  }, [valor]);
  return (
    <textarea id={id} ref={ref} className="cd-area" rows={3} value={valor}
      onChange={(e) => onCambio(e.target.value)} />
  );
}

/** La tabla, como tabla. En el teléfono se da vuelta: cada renglón pasa a ser un
 *  bloque con sus columnas etiquetadas, porque cinco columnas en 375px no se
 *  leen y el scroll lateral en un formulario largo se pierde. */
function Tabla({ campo, valor, onCambio }: { campo: Campo; valor: Valor | undefined; onCambio: (v: Valor) => void }) {
  const cols = campo.columnas ?? [];
  const filas = tablaParaEditar(campo, valor);
  const fijas = campo.filasFijas?.length ?? 0;

  const set = (i: number, j: number, v: string) => {
    const n = filas.map(f => [...f]);
    n[i][j] = v;
    onCambio(n);
  };

  return (
    <div className="cd-tabla-wrap">
      <table className="cd-tabla">
        <thead>
          <tr>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i}>
              {cols.map((col, j) => (
                <td key={j} data-col={col}>
                  {j === 0 && i < fijas ? (
                    <span className="cd-fija">{fila[0]}</span>
                  ) : (
                    <input
                      value={fila[j] ?? ''} onChange={(e) => set(i, j, e.target.value)}
                      aria-label={`${col}, renglón ${i + 1}`}
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!fijas && (
        <button type="button" className="cd-mas" onClick={() => onCambio([...filas, filaVacia(campo)])}>
          Agregar renglón
        </button>
      )}
      {campo.filasMin && filas.length < campo.filasMin && (
        <p className="cd-ayuda">Hacen falta al menos {campo.filasMin} renglones.</p>
      )}
    </div>
  );
}

/** El estado que BLOQUEA. Los dos textos ENTEROS, uno al lado del otro: aprobar
 *  lo que no se leyó es aprobar sin leer, así que acá no hay resumen ni link. */
function Aprobacion({ clase, onAprobar, guardando }: {
  clase: ClaseVista; onAprobar: (texto: string) => void; guardando: boolean;
}) {
  const [texto, setTexto] = useState(clase.respuestaIa ?? '');
  return (
    <section className="cd-apr">
      <p className="cd-apr-int">
        Después de la sesión, MaKo reescribió lo que habías contestado incorporando lo que
        hablaron. Compara las dos y quédate con la que prefieras. Puedes editarla antes de aprobar.
      </p>
      <div className="cd-dos">
        <div>
          <h3>Lo que contestaste tú</h3>
          <div className="cd-txt">{clase.respuesta || <em>Estaba vacío.</em>}</div>
        </div>
        <div>
          <h3>Lo que propone MaKo</h3>
          <textarea className="cd-area" rows={14} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </div>
      </div>
      <div className="cd-btns">
        <button className="cd-ok" disabled={guardando} onClick={() => onAprobar(texto)}>
          {guardando ? 'Guardando…' : 'Aprobar este texto'}
        </button>
        <button className="cd-no" disabled={guardando} onClick={() => onAprobar(clase.respuesta)}>
          Dejar el mío
        </button>
      </div>
      <p className="cd-cons">Lo que apruebes queda como la respuesta final de este bloque.</p>
    </section>
  );
}

function Siguiente({ modulos, actual, onIr }: {
  modulos: ModuloVista[]; actual: string; onIr: (id: string) => void;
}) {
  const todas = modulos.flatMap(m => m.clases);
  const i = todas.findIndex(c => c.claseId === actual);
  const sig = todas[i + 1];
  if (!sig) return null;
  return (
    <button className="cd-sig" onClick={() => onIr(sig.claseId)}>
      Sigue: {sig.numero} · {sig.titulo} →
    </button>
  );
}

function faltanDe(campos: Campo[], valores: Valores): number {
  return campos.filter(c => c.obligatorio && !tieneValor(valores[c.id])).length;
}

// =============================================================================
// El CSS. Todo scopeado bajo `.cd` para no tocar nada de la app: esta pantalla
// la abre alguien que no es usuario de MaKo y no comparte su chrome.
// =============================================================================
const CSS = `
.cd{
  --hoja:#FFFFFF; --papel:#F7F8FA; --tinta:#12151B; --tenue:#5B6472; --gris:#98A0AC;
  --linea:#E7EAEF; --linea-f:#D6DAE2; --oro:#8F6709; --oro-cl:#F2B01E; --verde:#1E9E57;
  min-height:100vh; background:var(--papel); color:var(--tinta);
  font-family:'Geist', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing:antialiased;
}
.cd *{ box-sizing:border-box; }
.cd button{ font:inherit; color:inherit; cursor:pointer; }
.cd :focus-visible{ outline:2px solid var(--oro); outline-offset:2px; border-radius:3px; }

/* ── Cabecera ─────────────────────────────────────────────────────────────── */
.cd-top{ position:sticky; top:0; z-index:20; display:flex; align-items:center; gap:20px;
  padding:14px 22px; background:rgba(255,255,255,.88); backdrop-filter:blur(10px);
  border-bottom:1px solid var(--linea); }
.cd-marca{ display:flex; flex-direction:column; gap:1px; min-width:0; }
.cd-marca .m1{ font-size:10px; letter-spacing:.16em; text-transform:uppercase; color:var(--gris); }
.cd-marca .m2{ font-size:15px; font-weight:600; letter-spacing:-.01em;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cd-marcador{ margin-left:auto; display:flex; align-items:baseline; gap:6px; }
.cd-marcador .n{ font-size:26px; font-weight:700; letter-spacing:-.04em; font-variant-numeric:tabular-nums; }
.cd-marcador .d{ font-size:12px; color:var(--tenue); }
.cd-verlomo{ display:none; background:none; border:1px solid var(--linea-f); border-radius:8px;
  padding:8px 12px; font-size:13px; }

/* ── Cuerpo: lomo + hoja ──────────────────────────────────────────────────── */
.cd-cuerpo{ display:grid; grid-template-columns:1fr; }
@media(min-width:1000px){ .cd-cuerpo{ grid-template-columns:296px 1fr; } }

.cd-lomo{ display:none; border-right:1px solid var(--linea); background:var(--papel); }
@media(min-width:1000px){
  .cd-lomo{ display:block; position:sticky; top:57px; height:calc(100vh - 57px); overflow-y:auto; }
}
.cd-lomo.abierto{ display:block; border-right:0; border-bottom:1px solid var(--linea); }
.cd-lomo-in{ padding:22px 18px 40px; }
.cd-lomo-tit{ font-size:10px; letter-spacing:.14em; text-transform:uppercase; color:var(--gris);
  margin:0 0 18px; }

.cd-mod{ margin:0 0 20px; }
.cd-mod h2{ display:flex; align-items:baseline; gap:9px; margin:0 0 7px; font-size:12.5px;
  font-weight:600; letter-spacing:.01em; }
.cd-mod h2 .mn{ font-size:10px; color:var(--gris); font-variant-numeric:tabular-nums; min-width:11px; }
.cd-mod-nota{ margin:-3px 0 7px 20px; font-size:11px; color:var(--oro); }
.cd-mod ul{ list-style:none; margin:0; padding:0; }

/* LA FIRMA: el lomo es una regla. La línea atraviesa el módulo entero y cada
   clase es una marca sobre ella. */
.cd-mod ul{ position:relative; }
.cd-mod ul::before{ content:''; position:absolute; left:5px; top:9px; bottom:9px; width:1px;
  background:var(--linea-f); }
.cd-cl{ position:relative; display:flex; align-items:center; gap:9px; width:100%;
  background:none; border:0; padding:5px 8px 5px 0; text-align:left; border-radius:7px; }
.cd-cl:hover{ background:#EEF0F4; }
.cd-cl .pt{ position:relative; z-index:1; flex:none; width:11px; height:11px; border-radius:50%;
  background:var(--papel); border:1.5px solid var(--linea-f); margin-left:0; }
.cd-cl.e-contestada .pt{ border-color:var(--tenue); background:var(--tenue); }
.cd-cl.e-revisada_ia .pt{ border-color:var(--oro-cl); background:var(--oro-cl); }
.cd-cl.e-aprobada .pt{ border-color:var(--verde); background:var(--verde); }
.cd-cl .nu{ font-size:10.5px; color:var(--gris); font-variant-numeric:tabular-nums; min-width:22px; }
.cd-cl .ti{ font-size:12.5px; line-height:1.35; color:var(--tenue); }
.cd-cl.es{ background:#E9ECF1; }
.cd-cl.es .ti{ color:var(--tinta); font-weight:600; }
.cd-cl .ok{ margin-left:auto; color:var(--oro-cl); font-size:9px; }

/* ── La hoja ──────────────────────────────────────────────────────────────── */
.cd-hoja{ background:var(--hoja); padding:34px 22px 64px; min-height:calc(100vh - 57px); }
@media(min-width:1000px){ .cd-hoja{ padding:52px 56px 90px; } }
.cd-hoja > *{ max-width:660px; margin-left:auto; margin-right:auto; }

.cd-migas{ font-size:10.5px; letter-spacing:.13em; text-transform:uppercase; color:var(--gris);
  margin:0 0 14px; }
.cd-h1{ display:flex; align-items:baseline; gap:13px; margin:0 0 14px;
  font-size:clamp(25px,4.2vw,34px); font-weight:700; letter-spacing:-.032em; line-height:1.1; }
.cd-h1 .nu{ font-size:15px; font-weight:500; color:var(--gris); font-variant-numeric:tabular-nums; }
.cd-res{ font-size:16px; line-height:1.6; color:var(--tenue); margin:0 0 26px; }
.cd-ojo{ border-left:2px solid var(--oro-cl); padding:10px 0 10px 16px; margin:0 0 26px;
  font-size:14.5px; line-height:1.55; color:var(--tenue); }
.cd-ojo b{ color:var(--tinta); }

/* Las preguntas. Numeradas porque SON una secuencia: el cuestionario las hizo en
   ese orden y cada una se apoya en la anterior. */
.cd-campos{ list-style:none; margin:0; padding:0; }
.cd-campo{ display:flex; gap:16px; padding:30px 0; border-top:1px solid var(--linea); }
.cd-campo:first-child{ border-top:0; padding-top:6px; }
.cd-num{ flex:none; width:26px; padding-top:5px; font-size:11px; color:var(--gris);
  font-variant-numeric:tabular-nums; letter-spacing:.04em; }
.cd-campo-in{ flex:1; min-width:0; }

/* LA PREGUNTA ES EL HÉROE. */
.cd-preg{ display:block; font-size:20px; line-height:1.4; font-weight:520; letter-spacing:-.012em;
  margin:0 0 8px; }
.cd-preg .req{ color:var(--oro); font-weight:600; }
.cd-ayuda{ font-size:13.5px; line-height:1.55; color:var(--gris); margin:0 0 12px; }

.cd-area, .cd-linea{ width:100%; font:inherit; font-size:16px; line-height:1.65; color:var(--tinta);
  background:var(--hoja); border:0; border-bottom:1.5px solid var(--linea-f); border-radius:0;
  padding:10px 2px; resize:none; transition:border-color .14s; }
.cd-area:focus, .cd-linea:focus{ outline:none; border-bottom-color:var(--tinta); }
.cd-area::placeholder, .cd-linea::placeholder{ color:var(--gris); }
.cd-linea{ padding:9px 2px; }

.cd-ops{ display:flex; flex-direction:column; gap:7px; margin-top:4px; }
.cd-op{ display:flex; align-items:flex-start; gap:11px; padding:12px 14px; border-radius:10px;
  border:1px solid var(--linea-f); font-size:14.5px; line-height:1.5; cursor:pointer;
  transition:border-color .14s, background .14s; }
.cd-op:hover{ border-color:var(--gris); }
.cd-op.es{ border-color:var(--tinta); background:#F6F7F9; }
.cd-op input{ margin:3px 0 0; accent-color:var(--tinta); flex:none; }

.cd-tabla-wrap{ margin-top:6px; }
.cd-tabla{ width:100%; border-collapse:collapse; font-size:14px; }
.cd-tabla th{ text-align:left; font-size:10.5px; letter-spacing:.09em; text-transform:uppercase;
  font-weight:600; color:var(--gris); padding:0 9px 7px; white-space:nowrap; }
.cd-tabla td{ padding:0; border-top:1px solid var(--linea); }
.cd-tabla input{ width:100%; font:inherit; font-size:14.5px; border:0; background:none;
  padding:11px 9px; color:var(--tinta); }
.cd-tabla input:focus{ outline:none; background:#F6F7F9; }
.cd-fija{ display:block; padding:11px 9px; font-size:14px; font-weight:560; }
.cd-mas{ margin-top:9px; background:none; border:1px dashed var(--linea-f); border-radius:8px;
  padding:8px 13px; font-size:13px; color:var(--tenue); }
.cd-mas:hover{ border-color:var(--gris); color:var(--tinta); }

/* En el teléfono la tabla se da vuelta: cada renglón es un bloque con sus
   columnas etiquetadas. Cinco columnas en 375px no se leen. */
@media(max-width:700px){
  .cd-tabla thead{ position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); }
  .cd-tabla, .cd-tabla tbody, .cd-tabla tr, .cd-tabla td{ display:block; width:100%; }
  .cd-tabla tr{ padding:12px 0; border-top:1px solid var(--linea); }
  .cd-tabla td{ border:0; display:flex; align-items:baseline; gap:10px; }
  .cd-tabla td::before{ content:attr(data-col); flex:none; width:34%; font-size:10.5px;
    letter-spacing:.07em; text-transform:uppercase; color:var(--gris); }
  .cd-tabla input{ padding:7px 0; border-bottom:1px solid var(--linea); }
}

.cd-pie{ display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
  margin-top:34px; padding-top:22px; border-top:1px solid var(--linea); }
.cd-est{ font-size:12.5px; color:var(--gris); margin:0; }
.cd-est.e-guardado{ color:var(--verde); }
.cd-est.e-error{ color:#D0504A; }
.cd-sig{ background:none; border:0; padding:8px 0; font-size:14.5px; font-weight:560;
  color:var(--tinta); text-align:right; }
.cd-sig:hover{ color:var(--oro); }

/* ── Aprobación ───────────────────────────────────────────────────────────── */
.cd-apr-int{ font-size:15px; line-height:1.6; color:var(--tenue); margin:0 0 22px; }
.cd-dos{ display:grid; gap:24px; grid-template-columns:1fr; }
@media(min-width:900px){ .cd-dos{ grid-template-columns:1fr 1fr; } }
.cd-dos h3{ font-size:10.5px; letter-spacing:.12em; text-transform:uppercase; color:var(--gris);
  margin:0 0 9px; font-weight:600; }
.cd-txt{ white-space:pre-wrap; font-size:15px; line-height:1.65; color:var(--tenue); }
.cd-btns{ display:flex; gap:10px; flex-wrap:wrap; margin-top:26px; }
.cd-ok, .cd-no{ font-size:15px; font-weight:600; padding:13px 22px; border-radius:10px; }
.cd-ok{ background:var(--tinta); color:#fff; border:1px solid var(--tinta); }
.cd-no{ background:none; border:1px solid var(--linea-f); }
.cd-ok:disabled, .cd-no:disabled{ opacity:.45; cursor:default; }
.cd-cons{ font-size:13.5px; line-height:1.5; color:var(--tenue); margin:11px 0 0; }

.cd-ft{ text-align:center; font-size:12px; color:var(--gris); padding:22px; margin:0; }

@media(max-width:999px){
  .cd-verlomo{ display:block; }
  .cd-hoja > *{ max-width:none; }
}
@media(prefers-reduced-motion:reduce){ .cd *{ transition:none !important; } }
`;
