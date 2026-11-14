// =============================================================================
// FaltaAnimacion — el lugar de una animación que todavía no está, en vez de un dibujo inventado (12/11/2026)
// =============================================================================
// Martín (12/11/2026, noche): «identifica la cantidad de cosas que hiciste inventándote cosas. Eso yo no lo quiero… elimina
// absolutamente todo. De última, pon un placeholder con que aquí falta una animación… O si ya la tenemos, reemplázala». Lo que
// se muestra de MaKo en el sitio es la app de verdad (una grabación, una captura, una foto real) o este recuadro, que dice QUÉ
// va ahí. Cuando la grabación existe, el lugar que lo usa la pone en su lugar (app/vsl/_sitio/datos.ts → TARJETAS_PORTADA, o
// el visual de cada landing). La lista de lo que falta está en docs/relevo/landings-vsl.md.
// Server component, sin JavaScript.
// =============================================================================

const CSS = `
.mk-falta { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; width: 100%;
  min-height: 260px; aspect-ratio: 16 / 10; padding: 24px; border-radius: 14px; border: 2px dashed rgba(47,111,237,.45);
  /* Fondo propio y opaco: se lee igual sobre una sección clara que sobre una oscura (y el sol y la luna lo lleva al modo). */
  background-color: #F5F8FD; background-image: repeating-linear-gradient(135deg, rgba(47,111,237,.05) 0 14px, rgba(47,111,237,.10) 14px 28px); text-align: center;
  font-family: inherit; color: #12151B; }
.mk-falta-r { font-size: 11px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #2F6FED; }
.mk-falta-t { margin: 0; max-width: 460px; font-size: 17px; line-height: 1.35; font-weight: 700; }
`;

/** `que`: lo que va ahí, dicho como lo pidió Martín («la vista del lienzo de las automatizaciones»). */
export function FaltaAnimacion({ que }: { que: string }) {
  return (
    // `data-tema-fijo`: el sol y la luna no lo tocan (14/11/2026: en una landing oscura le oscurecía el fondo y no el texto, y no se leía).
    <div className="mk-falta" role="img" aria-label={`Aquí falta la animación: ${que}`} data-tema-fijo="">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <span className="mk-falta-r">Aquí falta la animación</span>
      <p className="mk-falta-t">{que}</p>
    </div>
  );
}
