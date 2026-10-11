'use client';

// =============================================================================
// El montaje: de siete clips sueltos a un anuncio
// =============================================================================
// El worker (worker/montar-cola.mjs) corta el aire muerto, pone la voz del
// cliente, mezcla y quema los subtítulos. Esta pantalla es todo lo que la persona
// ve de eso.
//
// ⚠️ Y ES TODO LO QUE TIENE QUE VER. El handoff lo dice con todas las letras:
// «lo que el usuario tiene que ver en MaKo: sube o genera sus tomas, y le vuelve
// el anuncio montado. Nada de lo de arriba debería aparecer en pantalla».
//
// Lo único que sí merece estar visible, porque es lo que da confianza y es barato
// de mostrar: **cuánto se recortó y que no se perdió ni una palabra**. Los dos
// números los produce el verificador; acá sólo se pintan.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Alert, Spinner } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { montarAnuncioAction, estadoMontajeAction, type EstadoMontaje } from './video-action';
import { descargarComo } from './descargar';
import { nombreDeAnuncio } from './video-pedido';
import { EditorAnuncio } from './EditorAnuncio';
import { BotonEditarEnEditor } from './editor-video';
import type { Plan } from './plan-montaje';

/** `70.04` → `1:10`. Sin decimales: nadie lee un anuncio en centésimas. */
function reloj(seg: number): string {
  const s = Math.round(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PasoMontaje({ planId, titulo, clips, segundosPorToma }: {
  planId: string;
  titulo: string;
  /** Las tomas originales. Las necesita el editor para previsualizar sin render. */
  clips: string[];
  segundosPorToma: number[];
}) {
  const [estado, setEstado] = useState<EstadoMontaje>({ fase: 'sin_empezar' });
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(false);
  const [musica, setMusica] = useState<string | null>(null);

  const mirar = useCallback(async () => {
    const r = await estadoMontajeAction(planId).catch(() => null);
    if (r?.ok) setEstado(r.estado);
  }, [planId]);

  // ⚠️ SE PREGUNTA AL MONTAR Y NO UN PERÍODO DESPUÉS. Es la misma corrección que
  // el sondeo de las tomas: el `setInterval` dispara recién a los N segundos, y
  // esa primera vuelta perdida la paga entera el cliente mirando un loader.
  useEffect(() => { void mirar(); }, [mirar]);

  const enVuelo = estado.fase === 'encolado' || estado.fase === 'montando';
  useEffect(() => {
    if (!enVuelo) return;
    const t = setInterval(() => { void mirar(); }, 5000);
    return () => clearInterval(t);
  }, [enVuelo, mirar]);

  const montar = useCallback(async (plan?: Plan | null, pista?: string | null) => {
    setOcupado('montar');
    setError('');
    const r = await montarAnuncioAction(planId, plan ?? null, pista ?? null).catch(() => null);
    if (!r) setError('No se pudo empezar el montaje. Vuelve a intentarlo.');
    else if (!r.ok) setError(r.error);
    else await mirar();
    setOcupado('');
  }, [planId, mirar]);

  // ── El montaje ARRANCA SOLO ─────────────────────────────────────────────
  // Esta pantalla sólo existe cuando las tomas están todas filmadas, así que
  // pedirle a la persona que apriete un botón más para ver lo que vino a ver es
  // un paso que no decide nada. El montaje no gasta créditos: lo único que se
  // arriesga es CPU nuestra.
  //
  // ⚠️ EL PESTILLO NO ES EL ESTADO, ES UN REF. Dos efectos de StrictMode leen el
  // mismo `sin_empezar` antes de que ninguna respuesta vuelva, y la guarda de
  // «ya hay uno en vuelo» de la action tampoco los separa: las dos consultas
  // salen antes del primer insert. El resultado serían dos renders del mismo
  // anuncio, uno tirado.
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current || estado.fase !== 'sin_empezar' || ocupado) return;
    arrancado.current = true;
    void montar();
  }, [estado.fase, ocupado, montar]);

  const bajar = async (url: string) => {
    setOcupado('bajar');
    setError('');
    await descargarComo(url, nombreDeAnuncio(titulo))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo descargar.'));
    setOcupado('');
  };

  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center', width: '100%' }}>
      {(enVuelo || estado.fase === 'sin_empezar') && (
        // ⚠️ `Spinner` y NO `.mk-cargando-foto`. Esa clase es `position: absolute;
        // inset: 0`, asi que sin un padre posicionado se estira a la pantalla
        // entera —medido: 1472x788—. Y su propio comentario dice para que es:
        // «es un PUNTO y no un spinner: un spinner promete una espera larga, y
        // esto son decimas». Un montaje son de dos a cinco MINUTOS: aca la
        // espera larga hay que prometerla.
        <div style={{ display: 'grid', gap: 12, justifyItems: 'center', padding: '28px 0' }}>
          <Spinner size={26} color="var(--mako)" />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
            {estado.fase === 'montando' ? 'Montando tu anuncio' : 'En la fila para montar'}
          </div>
          {/* Fija expectativa, adentro del loader. No es un mensaje de estado
              suelto: es parte de la espera, que es lo que la regla permite.
              ⚠️ Y DEJA DE PROMETERLO cuando la espera ya la desmintió: un
              trabajo que lleva diez minutos sin que nadie lo tome no está
              tardando, está sin atender. Seguir diciendo «2 a 5 minutos» sobre
              eso es afirmar algo que el propio reloj ya contradice. */}
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
            {estado.fase === 'encolado' && estado.esperando >= 10
              ? `Lleva ${estado.esperando} minutos esperando turno. Escríbenos si sigue así.`
              : 'Suele tardar entre 2 y 5 minutos.'}
          </div>
        </div>
      )}

      {estado.fase === 'listo' && (
        <>
          <video
            key={estado.url}
            src={estado.url}
            controls
            playsInline
            style={{
              display: 'block', height: '46vh', width: 'auto', maxWidth: '100%',
              aspectRatio: '9 / 16', objectFit: 'cover',
              background: '#000', borderRadius: 'var(--r-md)',
            }}
          />
          {/* ⚠️ LOS DOS NÚMEROS, y son la razón por la que esta pantalla existe.
              Lo que separa «un video con IA» de un anuncio es que no tenga aire
              muerto ni los espasmos del modelo de voz — y eso, dicho en prosa,
              no se cree. Dicho con el antes y el después, sí. */}
          {estado.segundosAntes != null && estado.segundosDespues != null && (
            <div style={{ textAlign: 'center', lineHeight: 1.5 }}>
              <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)' }}>
                De <strong>{reloj(estado.segundosAntes)}</strong> a{' '}
                <strong>{reloj(estado.segundosDespues)}</strong>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>
                Se fue el silencio, no una palabra.
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="primary"
              size="lg"
              loading={ocupado === 'bajar'}
              disabled={!!ocupado}
              icon={<Icon name="descargar" size={17} />}
              onClick={() => void bajar(estado.url)}
            >
              Descargar el anuncio
            </Button>
            {/* ⚠️ EL EDITOR SE OFRECE SÓLO SI EL MONTAJE DEVOLVIÓ SUS CORTES.
                Sin el plan no hay nada que editar, y un botón que abre una línea
                de tiempo vacía es peor que ninguno: promete un control que no
                existe. Un montaje viejo —de antes de que el worker devolviera el
                plan— cae acá, y lo correcto es que el botón no esté. */}
            {estado.plan && (
              <Button
                variant="secondary"
                size="lg"
                disabled={!!ocupado}
                icon={<Icon name="tijera" size={17} />}
                onClick={() => setEditando(true)}
              >
                Ajustar los cortes
              </Button>
            )}
            {/* El anuncio ENTERO en el Video Editor (la copia de CapCut): textos,
                música, transiciones, lo que los cortes no alcanzan. Abre un proyecto
                nuevo con este video en la pista principal. Hoy sólo lo ve el super
                admin (editor-video.tsx). */}
            <BotonEditarEnEditor refVideo={`montaje:${estado.id}`} size="lg" />
          </div>
        </>
      )}

      {editando && estado.fase === 'listo' && estado.plan && (
        <EditorAnuncio
          clips={clips}
          segundosPorToma={segundosPorToma}
          plan={estado.plan}
          musica={musica}
          onCerrar={() => setEditando(false)}
          onAplicar={(plan, pista) => {
            setEditando(false);
            setMusica(pista);
            // El estado pasa a `encolado` en cuanto la action contesta, así que
            // la pantalla vuelve sola al loader: no hace falta pintar nada acá.
            void montar(plan, pista);
          }}
        />
      )}

      {estado.fase === 'error' && (
        <>
          {/* ⚠️ EL MENSAJE DICE DE QUIÉN FUE. `material` es un clip que volvió
              mal de Google: no es del cliente y reintentar no lo arregla, así que
              lo que corresponde es volver a filmar esa toma. Los otros motivos
              son nuestros y se dicen como tales — culpar al cliente por un bache
              ajeno lo manda a tocar algo que está bien. */}
          <Alert tono="bad">
            {estado.motivo === 'material'
              ? 'Una de las tomas volvió dañada de Google y el montaje no pudo usarla. Vuelve a filmar esa toma y monta de nuevo.'
              : estado.motivo === 'verificacion'
                ? 'El montaje quedó con texto de menos, así que no se entrega. Es un problema nuestro: no lo publiques y vuelve a intentarlo.'
                : `No se pudo montar el anuncio. Es un problema nuestro, no tuyo. ${estado.error}`}
          </Alert>
          <Button
            variant="secondary"
            loading={ocupado === 'montar'}
            disabled={!!ocupado}
            onClick={() => void montar()}
          >
            Montar de nuevo
          </Button>
        </>
      )}

      {error && <Alert tono="bad">{error}</Alert>}
    </div>
  );
}
