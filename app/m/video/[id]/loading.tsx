// =============================================================================
// /m/video/<id> — mientras se lee el anuncio: el escenario oscuro y el cuadro 9:16 vacíos
// =============================================================================
// Sin esto se vería el esqueleto de la LISTA (../loading.tsx), que no es la forma de esta pantalla.

import '../video.css';

export default function VideoAnuncioCargando() {
  return (
    <div aria-busy="true" aria-label="Cargando el anuncio">
      <div className="m-video-escenario">
        <div className="m-video-player m-video-player--vacio" />
        <span className="m-video-dur" />
      </div>
    </div>
  );
}
