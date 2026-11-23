import { memo } from "react";
import type { Cancion } from "../types";
import { limpiarArtista } from "../utils";

interface Props {
  cancion: Cancion;
  onSeleccionar: (cancion: Cancion) => void;
  onAnadir: (cancion: Cancion, x: number, y: number) => void;
}

function TarjetaCancion({ cancion, onSeleccionar, onAnadir }: Props) {
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
        <button
          className="card-add"
          title="Añadir a playlist"
          onClick={(e) => {
            e.stopPropagation();
            const caja = e.currentTarget.getBoundingClientRect();
            onAnadir(cancion, caja.right, caja.bottom);
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
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