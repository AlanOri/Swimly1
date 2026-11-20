import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface Cancion {
  id: string;
  titulo: string;
  artista: string;
  miniatura: string;
}

const YT_HOST = ["https://www", "youtube", "com"].join(".");

function App() {
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [actual, setActual] = useState<Cancion | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [volumen, setVolumen] = useState(80);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const enviarComandoYT = (func: string, args: unknown[] = []) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*"
    );
  };

  const ejecutarBusqueda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!busqueda.trim()) return;

    setCargando(true);
    setError("");
    try {
      const resultados = await invoke<Cancion[]>("buscar_canciones", {
        query: busqueda,
      });
      if (resultados.length > 0) {
        setCanciones(resultados);
      } else {
        setError("No se encontraron resultados para tu búsqueda.");
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setCargando(false);
    }
  };

  const seleccionarCancion = (cancion: Cancion) => {
    setActual(cancion);
    setReproduciendo(true);
  };

  const togglePlay = () => {
    if (!actual) return;
    enviarComandoYT(reproduciendo ? "pauseVideo" : "playVideo");
    setReproduciendo(!reproduciendo);
  };

  const cambiarCancion = (direccion: -1 | 1) => {
    if (!actual || canciones.length === 0) return;
    const indice = canciones.findIndex((c) => c.id === actual.id);
    const nuevoIndice = (indice + direccion + canciones.length) % canciones.length;
    seleccionarCancion(canciones[nuevoIndice]);
  };

  const cambiarVolumen = (nuevoVolumen: number) => {
    setVolumen(nuevoVolumen);
    enviarComandoYT("setVolume", [nuevoVolumen]);
  };

  return (
    <div className="app-container">
      {/* Barra lateral minimalista */}
      <aside className="sidebar">
        <div className="logo">MusicFlow</div>

        <div className="sidebar-section">Menú</div>
        <div
          className="nav-item active"
          onClick={() => {
            setCanciones([]);
            setBusqueda("");
            setError("");
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3l9 7.5v10.5h-6v-6h-6v6H3V10.5L12 3z" />
          </svg>
          Inicio
        </div>
      </aside>

      {/* Barra superior estilo Apple Music */}
      <header className="topbar">
        <div className="transport-controls">
          <button className="icon-btn" onClick={() => cambiarCancion(-1)} title="Anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button className="play-btn" onClick={togglePlay} title={reproduciendo ? "Pausar" : "Reproducir"}>
            {reproduciendo ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <button className="icon-btn" onClick={() => cambiarCancion(1)} title="Siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>

        {/* Cápsula central de reproducción */}
        <div className="apple-pill">
          {actual ? (
            <>
              <img src={actual.miniatura} alt={actual.titulo} referrerPolicy="no-referrer" />
              <div className="apple-pill-info">
                <div className="apple-pill-title">{actual.titulo}</div>
                <div className="apple-pill-artist">{actual.artista}</div>
              </div>
            </>
          ) : (
            <div className="apple-pill-info">
              <div className="apple-pill-artist">Sin reproducción</div>
            </div>
          )}
        </div>

        <div className="right-tools">
          <div className="volume-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              {volumen === 0 ? (
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
              ) : (
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
              )}
            </svg>
            <input
              type="range"
              min={0}
              max={100}
              value={volumen}
              onChange={(e) => cambiarVolumen(Number(e.target.value))}
              className="volume-slider"
            />
          </div>
        </div>
      </header>

      {/* Vista principal despejada */}
      <main className="main-view">
        <form onSubmit={ejecutarBusqueda} className="search-container">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <input
              type="text"
              className="search-bar"
              placeholder="Buscar artistas, canciones o álbumes..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </form>

        {error && <p style={{ color: "#fa2d48", marginBottom: "16px" }}>{error}</p>}

        {cargando ? (
          <p style={{ color: "#8e8e93", fontSize: "0.95rem" }}>Buscando...</p>
        ) : canciones.length > 0 ? (
          <>
            <h2 style={{ marginBottom: "18px", fontSize: "1.25rem", fontWeight: 700 }}>
              Resultados
            </h2>
            <div className="grid-canciones">
              {canciones.map((c) => (
                <div
                  key={c.id}
                  className="card"
                  onClick={() => seleccionarCancion(c)}
                >
                  <div className="card-img-wrapper">
                    <img src={c.miniatura} alt={c.titulo} referrerPolicy="no-referrer" />
                    <div className="card-play-overlay">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <div className="card-title">{c.titulo}</div>
                  <div className="card-artist">{c.artista}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Escribe arriba el nombre de una canción o artista para comenzar.</p>
          </div>
        )}
      </main>

      {actual && (
        <iframe
          key={actual.id}
          ref={iframeRef}
          width="1"
          height="1"
          onLoad={() => enviarComandoYT("setVolume", [volumen])}
          style={{
            position: "fixed",
            bottom: 0,
            right: 0,
            opacity: 0,
            pointerEvents: "none",
          }}
          src={`${YT_HOST}/embed/${actual.id}?enablejsapi=1&autoplay=${reproduciendo ? 1 : 0}`}
          allow="autoplay; encrypted-media"
        />
      )}
    </div>
  );
}

export default App;
