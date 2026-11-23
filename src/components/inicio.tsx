import { memo } from "react";
import type { Cancion } from "../types";
import TarjetaCancion from "./TarjetaCancion";
import "./Inicio.css";

interface Props {
  recientes: Cancion[];
  onSeleccionar: (cancion: Cancion) => void;
  onAnadir: (cancion: Cancion, x: number, y: number) => void;
  onLimpiar: () => void;
}

function Inicio({ recientes, onSeleccionar, onAnadir, onLimpiar }: Props) {
  if (recientes.length === 0) {
    return (
      <div className="empty-state">
        <p>Escribe arriba el nombre de una canción o artista para comenzar.</p>
      </div>
    );
  }

  return (
    <section>
      <div className="seccion-cabecera">
        <h2 className="seccion-titulo">Escuchado recientemente</h2>
        <button className="enlace-btn" onClick={onLimpiar}>
          Borrar historial
        </button>
      </div>
      <div className="grid-canciones">
        {recientes.map((c) => (
          <TarjetaCancion key={c.id} cancion={c} onSeleccionar={onSeleccionar} onAnadir={onAnadir} />
        ))}
      </div>
    </section>
  );
}

export default memo(Inicio);