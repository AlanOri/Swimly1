import { useCallback, useEffect, useRef, useState } from "react";
import { cargar, guardar } from "../almacen";
import { esCancion, esPlaylist } from "../types";
import type { Cancion, Playlist } from "../types";

const CLAVE = "swimly:playlists";
const VERSION = 1;
export const MAX_PLAYLISTS = 30;
export const MAX_CANCIONES = 500;
const MAX_NOMBRE = 60;

const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const limpiarNombre = (nombre: string) => nombre.trim().slice(0, MAX_NOMBRE) || "Nueva playlist";

function leerInicial(): Playlist[] {
  const datos = cargar<unknown>(CLAVE, VERSION, []);
  if (!Array.isArray(datos)) return [];
  return datos
    .filter(esPlaylist)
    .slice(0, MAX_PLAYLISTS)
    .map((p) => ({
      id: p.id,
      nombre: limpiarNombre(p.nombre),
      canciones: p.canciones.filter(esCancion).slice(0, MAX_CANCIONES),
    }));
}

export function usePlaylists() {

  const [playlists, setPlaylists] = useState<Playlist[]>(leerInicial);
  const ref = useRef(playlists);
  const primera = useRef(true);

  useEffect(() => {
    ref.current = playlists;

    if (primera.current) {
      primera.current = false;
      return;
    }
    guardar(CLAVE, VERSION, playlists);
  }, [playlists]);

  const crear = useCallback((nombre: string, inicial?: Cancion): string | null => {
    if (ref.current.length >= MAX_PLAYLISTS) return null;
    const id = nuevoId();
    setPlaylists((previas) => [
      ...previas,
      { id, nombre: limpiarNombre(nombre), canciones: inicial ? [inicial] : [] },
    ]);
    return id;
  }, []);

  const renombrar = useCallback((id: string, nombre: string) => {
    setPlaylists((previas) =>
      previas.map((p) => (p.id === id ? { ...p, nombre: limpiarNombre(nombre) } : p))
    );
  }, []);

  const eliminar = useCallback((id: string) => {
    setPlaylists((previas) => previas.filter((p) => p.id !== id));
  }, []);

  const anadir = useCallback((id: string, cancion: Cancion) => {
    setPlaylists((previas) =>
      previas.map((p) => {
        const repetida = p.canciones.some((c) => c.id === cancion.id);
        if (p.id !== id || repetida || p.canciones.length >= MAX_CANCIONES) return p;
        return { ...p, canciones: [...p.canciones, cancion] };
      })
    );
  }, []);

  const quitar = useCallback((id: string, cancionId: string) => {
    setPlaylists((previas) =>
      previas.map((p) =>
        p.id === id ? { ...p, canciones: p.canciones.filter((c) => c.id !== cancionId) } : p
      )
    );
  }, []);

  return { playlists, crear, renombrar, eliminar, anadir, quitar };
}