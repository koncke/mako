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

import { useCallback, useEffect, useState } from 'react';
import { Button, Alert, Spinner } from '@/app/_ui';
import { Icon } from '@/app/_components/icons';
import { montarAnuncioAction, estadoMontajeAction, type EstadoMontaje } from './video-action';
import { descargarComo } from './descargar';
import { nombreDeAnuncio } from './video-pedido';

/** `70.04` → `1:10`. Sin decimales: nadie lee un anuncio en centésimas. */
function reloj(seg: number): string {
  const s = Math.round(seg);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function PasoMontaje({ planId, titulo }: { planId: string; titulo: string }) {
  const [estado, setEstado] = useState<EstadoMontaje>({ fase: 'sin_empezar' });
  const [ocupado, setOcupado] = useState('');
  const [error, setError] = useState('');

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

  const montar = async () => {
    setOcupado('montar');
    setError('');
    const r = await montarAnuncioAction(planId).catch(() => null);
    if (!r) setError('No se pudo empezar el montaje. Vuelve a intentarlo.');
    else if (!r.ok) setError(r.error);
    else await mirar();
    setOcupado('');
  };

  const bajar = async (url: string) => {
    setOcupado('bajar');
    setError('');
    await descargarComo(url, nombreDeAnuncio(titulo))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo descargar.'));
    setOcupado('');
  };

  return (
    <div style={{ display: 'grid', gap: 16, justifyItems: 'center', width: '100%' }}>
      {estado.fase === 'sin_empezar' && (
        <>
          <p style={{
            margin: 0, maxWidth: '46ch', textAlign: 'center',
            fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55,
          }}>
            MaKo le quita el aire muerto, le pone tu voz y le quema los subtítulos.
            Tarda unos minutos y no gasta créditos de Flow.
          </p>
          <Button
            variant="mako"
            size="xl"
            loading={ocupado === 'montar'}
            disabled={!!ocupado}
            icon={<Icon name="ia" size={19} />}
            onClick={() => void montar()}
          >
            Montar el anuncio
          </Button>
        </>
      )}

      {enVuelo && (
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
              suelto: es parte de la espera, que es lo que la regla permite. */}
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
            Suele tardar entre 2 y 5 minutos.
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
        </>
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
