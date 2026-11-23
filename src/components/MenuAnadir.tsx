import { useEffect, useState } from "react";
import type { Cancion, Playlist } from "../types";
import { MAX_CANCIONES } from "../hooks/usePlaylists";

interface Props {
  cancion: Cancion;
  x: number; 
  y: number; 
  playlists: Playlist[];
  onAnadir: (playlistId: string) => void;
  onCrear: (nombre: string) => void;
  onCerrar: () => void;
}

const ANCHO = 240;
const ALTO_MAX = 340;

export default function MenuAnadir({ cancion, x, y, playlists, onAnadir, onCrear, onCerrar }: Props) {
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  const izquierda = Math.max(8, Math.min(x - ANCHO, window.innerWidth - ANCHO - 8));
  const arriba = Math.max(8, Math.min(y + 6, window.innerHeight - ALTO_MAX));

  return (
    <div className="menu-fondo" onClick={onCerrar}>
      <div
        className="menu-anadir"
        style={{ left: izquierda, top: arriba }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="menu-titulo">Añadir a playlist</div>

        <div className="menu-lista">
          {playlists.map((p) => {
            const ya = p.canciones.some((c) => c.id === cancion.id);
            const llena = p.canciones.length >= MAX_CANCIONES;
            return (
              <button
                key={p.id}
                className="menu-item"
                disabled={ya || llena}
                onClick={() => onAnadir(p.id)}
              >
                <span>{p.nombre}</span>
                <span className="menu-estado">{ya ? "Ya está" : llena ? "Llena" : ""}</span>
              </button>
            );
          })}
          {playlists.length === 0 && <div className="menu-vacio">Aún no tienes playlists</div>}
        </div>

        <input
          className="playlist-input"
          placeholder="Nueva playlist… (Enter)"
          value={nombre}
          maxLength={60}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && nombre.trim()) onCrear(nombre);
          }}
        />
      </div>
    </div>
  );
}