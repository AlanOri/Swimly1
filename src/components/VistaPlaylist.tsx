import { memo, useCallback, useState } from "react";
import type { Cancion, Playlist } from "../types";
import { limpiarArtista } from "../utils";

interface FilaProps {
  cancion: Cancion;
  indice: number;
  activa: boolean;
  onReproducir: (indice: number) => void;
  onQuitar: (cancionId: string) => void;
}

const Fila = memo(function Fila({ cancion, indice, activa, onReproducir, onQuitar }: FilaProps) {
  return (
    <div className={`fila ${activa ? "fila-activa" : ""}`} onClick={() => onReproducir(indice)}>
      <span className="fila-num">{indice + 1}</span>
      <img
        src={cancion.miniatura}
        alt=""
        referrerPolicy="no-referrer"
        loading="lazy"
        decoding="async"
      />
      <div className="fila-info">
        <div className="fila-titulo">{cancion.titulo}</div>
        <div className="fila-artista">{limpiarArtista(cancion.artista)}</div>
      </div>
      <button
        className="icon-btn fila-quitar"
        title="Quitar de la playlist"
        onClick={(e) => {
          e.stopPropagation();
          onQuitar(cancion.id);
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      </button>
    </div>
  );
});

interface Props {
  playlist: Playlist;
  actualId: string | null;
  onReproducir: (canciones: Cancion[], indice: number) => void;
  onQuitar: (playlistId: string, cancionId: string) => void;
  onRenombrar: (playlistId: string, nombre: string) => void;
  onEliminar: (playlistId: string) => void;
}

export default function VistaPlaylist({
  playlist,
  actualId,
  onReproducir,
  onQuitar,
  onRenombrar,
  onEliminar,
}: Props) {
  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState(playlist.nombre);

  const reproducirIndice = useCallback(
    (indice: number) => onReproducir(playlist.canciones, indice),
    [onReproducir, playlist.canciones]
  );
  const quitar = useCallback(
    (cancionId: string) => onQuitar(playlist.id, cancionId),
    [onQuitar, playlist.id]
  );

  const guardarNombre = () => {
    if (nombre.trim()) onRenombrar(playlist.id, nombre);
    else setNombre(playlist.nombre);
    setEditando(false);
  };

  const total = playlist.canciones.length;

  return (
    <section>
      <div className="pl-cabecera">
        <div>
          {editando ? (
            <input
              className="playlist-input pl-input"
              autoFocus
              value={nombre}
              maxLength={60}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={guardarNombre}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardarNombre();
                if (e.key === "Escape") {
                  setNombre(playlist.nombre);
                  setEditando(false);
                }
              }}
            />
          ) : (
            <h2 className="pl-titulo">{playlist.nombre}</h2>
          )}
          <div className="pl-sub">
            {total} {total === 1 ? "canción" : "canciones"}
          </div>
        </div>

        <div className="pl-acciones">
          <button className="btn-verde" disabled={total === 0} onClick={() => reproducirIndice(0)}>
            Reproducir
          </button>
          <button
            className="btn-suave"
            onClick={() => {
              setNombre(playlist.nombre);
              setEditando(true);
            }}
          >
            Renombrar
          </button>
          <button
            className="btn-suave btn-peligro"
            onClick={() => {
              if (window.confirm(`¿Eliminar la playlist «${playlist.nombre}»?`)) {
                onEliminar(playlist.id);
              }
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      {total === 0 ? (
        <div className="empty-state">
          <p>Esta playlist está vacía. Usa el botón + de cualquier canción para añadirla.</p>
        </div>
      ) : (
        <div className="lista-filas">
          {playlist.canciones.map((c, i) => (
            <Fila
              key={c.id}
              cancion={c}
              indice={i}
              activa={c.id === actualId}
              onReproducir={reproducirIndice}
              onQuitar={quitar}
            />
          ))}
        </div>
      )}
    </section>
  );
}