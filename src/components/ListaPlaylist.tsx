import { useState } from "react";
import type { Playlist } from "../types";

interface Props {
  playlists: Playlist[];
  activaId: string | null;
  onAbrir: (id: string) => void;
  onCrear: (nombre: string) => void;
}

export default function ListaPlaylists({ playlists, activaId, onAbrir, onCrear }: Props) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState("");

  const confirmar = () => {
    onCrear(nombre);
    setNombre("");
    setCreando(false);
  };

  const cancelar = () => {
    setNombre("");
    setCreando(false);
  };

  return (
    <div className="playlists-bloque">
      <div className="sidebar-section playlists-cabecera">
        <span>Playlists</span>
        <button className="icon-btn" title="Nueva playlist" onClick={() => setCreando(true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
          </svg>
        </button>
      </div>

      {creando && (
        <input
          className="playlist-input"
          autoFocus
          placeholder="Nombre de la playlist"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirmar();
            if (e.key === "Escape") cancelar();
          }}
          onBlur={cancelar}
        />
      )}

      <div className="lista-playlists">
        {playlists.map((p) => (
          <div
            key={p.id}
            className={`nav-item ${activaId === p.id ? "active" : ""}`}
            onClick={() => onAbrir(p.id)}
            title={p.nombre}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z" />
            </svg>
            <span className="playlist-nombre">{p.nombre}</span>
            <span className="playlist-cuenta">{p.canciones.length}</span>
          </div>
        ))}
        {playlists.length === 0 && !creando && (
          <div className="playlists-vacio">Aún no tienes playlists</div>
        )}
      </div>
    </div>
  );
}