'use client';

// =============================================================================
// /m/experimentos — «Nuevo experimento»: la hipótesis, MaKo la diseña, se revisa y se inicia
// =============================================================================
// El alta guiada de escritorio (ExperimentsTab.tsx, `NuevoExperimentoModal`) en una hoja: los dos
// pasos con su pregunta y sus botones («¿Qué quieres probar?» → «Diseñar con MaKo» → «Iniciar
// experimento»), por las mismas rutas (/api/experimentos/suggest y /api/experimentos). Lo que se
// queda en la computadora: el contexto opcional y AJUSTAR la propuesta (título, qué se cambia, la
// ventana, el objetivo): en el teléfono se inicia como la dejó MaKo o se vuelve a la hipótesis.
//
// ⚠️ Diseñar puede tardar (Claude, hasta 120 s): la hoja se puede cerrar mientras tanto y la
//    respuesta que llega tarde se descarta (`pedido`). Iniciar ES una escritura: mientras va, la
//    hoja no se cierra por ningún camino (`ocupado`).
// =============================================================================

import { useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { FilaDatoM, ListaM, PieM, SheetM, useConexion, useToastM } from '@/app/m/_ui';
import type { Propuesta } from '@/lib/experimentos';
import { dirLabel, fmtVal } from '@/lib/experimentos-formato';
import { disenarExperimento, iniciarPropuesta } from './api';
import { R, diasTexto } from './modelo';

type Paso = 'hipotesis' | 'armando' | 'revision';

/** El ejemplo de escritorio: inventado, ningún dato de un cliente. */
const PLACEHOLDER = 'Ej.: si filtro más fuerte el formulario, baja el costo por agenda…';

export function NuevoExperimentoM({ abierto, onCerrar, hipotesisInicial }: {
  abierto: boolean;
  onCerrar: () => void;
  /** La del link «Probarlo» de Offer (`?hipotesis=`), si vino una. */
  hipotesisInicial: string;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [paso, setPaso] = useState<Paso>('hipotesis');
  const [hip, setHip] = useState(hipotesisInicial);
  const [p, setP] = useState<Propuesta | null>(null);
  const [iniciando, setIniciando] = useState(false);
  /** El diseño en curso: si la hoja se cerró o se pidió otro, el que llega tarde no pisa nada. */
  const pedido = useRef(0);

  const cerrar = () => { pedido.current += 1; if (paso === 'armando') setPaso('hipotesis'); onCerrar(); };

  const disenar = async () => {
    const h = hip.trim();
    if (!h || paso === 'armando') return;
    const n = ++pedido.current;
    setPaso('armando');
    const r = await disenarExperimento(h);
    if (n !== pedido.current) return;
    if (!r.ok) { setPaso('hipotesis'); toast('MaKo no pudo diseñarlo'); return; }
    setP(r.datos);
    setPaso('revision');
  };

  const iniciar = async () => {
    if (!p || iniciando) return;
    setIniciando(true);
    const r = await iniciarPropuesta(p);
    setIniciando(false);
    if (!r.ok) { toast('No se pudo iniciar'); return; }
    onCerrar();
    toast('Experimento en marcha');
    // Después de cerrar: el cierre por código hace replaceState, y un refresh pedido antes se descarta.
    window.setTimeout(() => router.refresh(), 400);
  };

  const pie = paso === 'revision' && p ? (
    <PieM consecuencia="MaKo mide el baseline y arranca hoy.">
      <Button variant="primary" size="lg" full loading={iniciando} disabled={!enLinea} onClick={() => { void iniciar(); }}>{R.iniciar}</Button>
      <Button variant="tertiary" size="lg" full disabled={iniciando} onClick={() => setPaso('hipotesis')}>Volver a la hipótesis</Button>
    </PieM>
  ) : (
    <PieM>
      <Button variant="mako" size="lg" full loading={paso === 'armando'} disabled={!hip.trim() || !enLinea}
        icon={<Icon name="mako" size={18} />} onClick={() => { void disenar(); }}>
        {R.disenar}
      </Button>
    </PieM>
  );

  return (
    <SheetM abierto={abierto} onCerrar={cerrar} titulo={R.nuevo} id="nuevo-experimento" snap="alto"
      ocupado={iniciando} rotuloCerrar="Salir sin crear el experimento" pie={pie}>
      {paso === 'revision' && p ? (
        <div className="m-experimentos-hoja">
          <h3 className="m-experimentos-hoja__titulo">{p.titulo}</h3>
          <p className="m-experimentos-hoja__texto">{p.hipotesis}</p>
          <ListaM>
            <FilaDatoM k="Métrica" v={p.metrica_label} />
            <FilaDatoM k="Objetivo" v={p.objetivo_valor != null ? `${dirLabel(p.direccion)} · ${fmtVal(p.objetivo_valor, p.metrica)}` : dirLabel(p.direccion)} />
            <FilaDatoM k="Ventana" v={diasTexto(p.ventana_dias)} />
          </ListaM>
          {p.cambio?.trim() && (
            <>
              <h4 className="m-experimentos-hoja__sub">{R.queCambia}</h4>
              <p className="m-experimentos-hoja__texto">{p.cambio}</p>
            </>
          )}
          {p.criterio_exito?.trim() && (
            <>
              <h4 className="m-experimentos-hoja__sub">{R.criterio}</h4>
              <p className="m-experimentos-hoja__texto">{p.criterio_exito}</p>
            </>
          )}
        </div>
      ) : (
        <div className="m-experimentos-hoja">
          <label className="m-experimentos-hoja__titulo" htmlFor="m-experimentos-hipotesis">{R.pregunta}</label>
          <textarea id="m-experimentos-hipotesis" className="mk-textarea m-experimentos-area" rows={4} value={hip}
            placeholder={PLACEHOLDER} disabled={paso === 'armando'} onChange={(e) => setHip(e.target.value)} />
        </div>
      )}
    </SheetM>
  );
}
