export interface Cancion {
  id: string;
  titulo: string;
  artista: string;
  miniatura: string;
}

export interface Playlist {
  id: string;
  nombre: string;
  canciones: Cancion[];
}

export function esCancion(x: unknown): x is Cancion {
  if (typeof x !== "object" || x === null) return false;
  const c = x as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.titulo === "string" &&
    typeof c.artista === "string" &&
    typeof c.miniatura === "string"
  );
}

export function esPlaylist(x: unknown): x is Playlist {
  if (typeof x !== "object" || x === null) return false;
  const p = x as Record<string, unknown>;
  return typeof p.id === "string" && typeof p.nombre === "string" && Array.isArray(p.canciones);
}