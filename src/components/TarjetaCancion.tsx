import { memo } from "react";
import type { Cancion } from "../types.ts";
import { limpiarArtista } from "../utils.ts";

interface Props {
  cancion: Cancion;
  onSeleccionar: (cancion: Cancion) => void;
}

// memo: la tarjeta solo se repinta si cambia su canción, no cuando cambia
// el estado de reproducción, el volumen o la barra de progreso.
function TarjetaCancion({ cancion, onSeleccionar }: Props) {
  return (
    <div className="card" onClick={() => onSeleccionar(cancion)}>
      <div className="card-img-wrapper">
        <img
          src={cancion.miniatura}
          alt={cancion.titulo}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
        <div className="card-play-overlay">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div className="card-title">{cancion.titulo}</div>
      <div className="card-artist">{limpiarArtista(cancion.artista)}</div>
    </div>
  );
}

export default memo(TarjetaCancion);