import { useState, useRef, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import type { Cancion } from "./types.ts";
import { limpiarArtista } from "./utils.ts";
import BarraProgreso from "./components/BarraProgreso.tsx";
import TarjetaCancion from "./components/TarjetaCancion.tsx";
import "./App.css";

type Resultado = "ok" | "error" | "cancelado";

const TTL_URL = 4 * 60 * 60 * 1000; // las URLs de audio caducan en ~6 h
const MAX_CACHE = 20;
const MAX_INTENTOS = 3; // canciones que se prueban seguidas si alguna falla

function App() {
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [actual, setActual] = useState<Cancion | null>(null);
  const [siguienteVista, setSiguienteVista] = useState<Cancion | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [repetir, setRepetir] = useState(false);
  const [volumen, setVolumen] = useState(80);

  const audioRef = useRef<HTMLAudioElement>(null);
  const peticion = useRef(0); // evita que una canción lenta pise a una más reciente
  const sesionRef = useRef(0); // cambia cada vez que eliges una canción de los resultados
  const actualRef = useRef<Cancion | null>(null);
  const colaRef = useRef<Cancion[]>([]); // canciones por venir (similares)
  const historialRef = useRef<Cancion[]>([]); // canciones ya reproducidas (para "Anterior")
  const vistosRef = useRef<Set<string>>(new Set()); // reproducidas o en cola: evita repetir
  const mixEnVuelo = useRef<Promise<void> | null>(null);
  const urlCache = useRef(new Map<string, { url: string; ts: number }>());
  const urlEnVuelo = useRef(new Map<string, Promise<string>>());

  // Comprueba actualizaciones en GitHub al abrir la ventana
  useEffect(() => {
    const buscarActualizacion = async () => {
      try {
        const update = await check();
        if (update) {
          const confirmar = window.confirm(
            `Nueva versión ${update.version} de Swimly disponible. ¿Deseas descargarla e instalarla ahora?`
          );
          if (confirmar) {
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (e) {
        console.log("Sin actualizaciones disponibles o sin conexión:", e);
      }
    };

    buscarActualizacion();
  }, []);

  // El volumen y la repetición viven en el elemento <audio>
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volumen / 100;
  }, [volumen]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repetir;
  }, [repetir]);

  /* ---------- Audio: URL con caché y precarga ---------- */

  const obtenerUrl = (id: string): Promise<string> => {
    const guardada = urlCache.current.get(id);
    if (guardada && Date.now() - guardada.ts < TTL_URL) {
      return Promise.resolve(guardada.url);
    }

    const pendiente = urlEnVuelo.current.get(id);
    if (pendiente) return pendiente;

    const p: Promise<string> = invoke<string>("obtener_audio", { id })
      .then((url) => {
        urlCache.current.set(id, { url, ts: Date.now() });
        if (urlCache.current.size > MAX_CACHE) {
          const masAntigua = urlCache.current.keys().next().value;
          if (masAntigua) urlCache.current.delete(masAntigua);
        }
        return url;
      })
      .finally(() => {
        urlEnVuelo.current.delete(id);
      });

    urlEnVuelo.current.set(id, p);
    return p;
  };

  /* ---------- Cola de canciones similares (Mix de YouTube) ---------- */

  // Actualiza la vista previa "A continuación" con la cabeza de la cola
  const sincronizarVista = () => setSiguienteVista(colaRef.current[0] ?? null);

  const asegurarCola = (base: Cancion): Promise<void> => {
    if (colaRef.current.length > 0) return Promise.resolve();
    if (mixEnVuelo.current) return mixEnVuelo.current;

    const sesion = sesionRef.current;
    const p: Promise<void> = invoke<Cancion[]>("obtener_mix", { id: base.id })
      .then((mix) => {
        if (sesion !== sesionRef.current) return; // el usuario ya cambió de sesión
        for (const c of mix) {
          if (!vistosRef.current.has(c.id)) {
            vistosRef.current.add(c.id);
            colaRef.current.push(c);
          }
        }
        sincronizarVista();
      })
      .catch((e) => console.log("No se pudo obtener el mix:", e))
      .finally(() => {
        if (mixEnVuelo.current === p) mixEnVuelo.current = null;
      });

    mixEnVuelo.current = p;
    return p;
  };

  // Mientras suena una canción: prepara la cola y resuelve el audio de la siguiente
  const precargar = async (base: Cancion) => {
    await asegurarCola(base);
    const siguienteEnCola = colaRef.current[0];
    if (siguienteEnCola) obtenerUrl(siguienteEnCola.id).catch(() => {});
  };

  /* ---------- Reproducción ---------- */

  const iniciar = async (cancion: Cancion): Promise<Resultado> => {
    const audio = audioRef.current;
    if (!audio) return "cancelado";

    const mia = ++peticion.current;
    actualRef.current = cancion;
    setActual(cancion);
    setError("");
    audio.pause();

    try {
      const url = await obtenerUrl(cancion.id);
      if (mia !== peticion.current) return "cancelado"; // el usuario ya eligió otra
      audio.src = url;
      await audio.play();
      return "ok";
    } catch (err) {
      if (mia !== peticion.current) return "cancelado";
      setError(String(err));
      return "error";
    }
  };

  // Elegir una canción de los resultados: empieza una sesión nueva
  const seleccionarCancion = async (cancion: Cancion) => {
    sesionRef.current++;
    mixEnVuelo.current = null;
    colaRef.current = [];
    historialRef.current = [];
    vistosRef.current = new Set([cancion.id]);
    setSiguienteVista(null);

    const res = await iniciar(cancion);
    if (res === "ok") precargar(cancion);
  };

  // Referencia siempre actualizada: permite pasar a las tarjetas una función
  // estable y que React.memo evite repintarlas.
  const seleccionarRef = useRef(seleccionarCancion);
  useEffect(() => {
    seleccionarRef.current = seleccionarCancion;
  });
  const onSeleccionar = useCallback((c: Cancion) => {
    seleccionarRef.current(c);
  }, []);

  const tomarSiguiente = (): Cancion | undefined => {
    const deCola = colaRef.current.shift();
    if (deCola) {
      sincronizarVista();
      return deCola;
    }

    // Respaldo: si el mix falló, seguir con los resultados de la búsqueda
    const deResultados = canciones.find((c) => !vistosRef.current.has(c.id));
    if (deResultados) vistosRef.current.add(deResultados.id);
    return deResultados;
  };

  const siguiente = async () => {
    const origen = actualRef.current;
    if (!origen) return;

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await asegurarCola(origen);
      const proxima = tomarSiguiente();
      if (!proxima) {
        setError("No se encontraron más canciones similares.");
        return;
      }

      const res = await iniciar(proxima);
      if (res === "ok") {
        historialRef.current.push(origen);
        precargar(proxima);
        return;
      }
      if (res === "cancelado") return;
      // res === "error": se prueba con la siguiente de la cola
    }
  };

  const anterior = async () => {
    const audio = audioRef.current;
    const base = actualRef.current;
    if (!audio || !base) return;

    // Pasados 3 segundos, "Anterior" reinicia la canción actual
    if (audio.currentTime > 3 || historialRef.current.length === 0) {
      audio.currentTime = 0;
      return;
    }

    const previa = historialRef.current.pop()!;
    colaRef.current.unshift(base); // "Siguiente" vuelve a la que estaba sonando
    sincronizarVista();
    const res = await iniciar(previa);
    if (res === "ok") precargar(previa);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !actual) return;
    if (audio.paused) {
      audio.play().catch((err) => setError(String(err)));
    } else {
      audio.pause();
    }
  };

  const ejecutarBusqueda = async (e: FormEvent) => {
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

  return (
    <div className="app-container">
      {/* Barra lateral minimalista */}
      <aside className="sidebar">
        <div className="logo">Swimly</div>

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

        {/* Vista previa de la siguiente canción */}
        {siguienteVista && (
          <div className="proxima-wrap">
            <div className="sidebar-section">A continuación</div>
            <div className="proxima" onClick={siguiente} title="Reproducir ahora">
              <img
                src={siguienteVista.miniatura}
                alt=""
                referrerPolicy="no-referrer"
                loading="lazy"
                decoding="async"
              />
              <div className="proxima-info">
                <div className="proxima-titulo">{siguienteVista.titulo}</div>
                <div className="proxima-artista">{limpiarArtista(siguienteVista.artista)}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Barra superior estilo Apple Music */}
      <header className="topbar">
        <div className="transport-controls">
          <button className="icon-btn" onClick={anterior} title="Anterior">
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

          <button className="icon-btn" onClick={siguiente} title="Siguiente">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>

          <button
            className={`icon-btn ${repetir ? "activo" : ""}`}
            onClick={() => setRepetir((r) => !r)}
            title={repetir ? "Repetir canción: activado" : "Repetir canción"}
            aria-pressed={repetir}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              {repetir ? (
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z" />
              ) : (
                <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z" />
              )}
            </svg>
          </button>
        </div>

        {/* Cápsula central de reproducción con barra de progreso */}
        <div className="apple-pill">
          {actual ? (
            <>
              <div className="apple-pill-main">
                <img
                  src={actual.miniatura}
                  alt={actual.titulo}
                  referrerPolicy="no-referrer"
                  decoding="async"
                />
                <div className="apple-pill-info">
                  <div className="apple-pill-title">{actual.titulo}</div>
                  <div className="apple-pill-artist">{limpiarArtista(actual.artista)}</div>
                </div>
              </div>
              <BarraProgreso audioRef={audioRef} />
            </>
          ) : (
            <div className="apple-pill-main">
              <div className="apple-pill-info">
                <div className="apple-pill-artist">Sin reproducción</div>
              </div>
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
              onChange={(e) => setVolumen(Number(e.target.value))}
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
                <TarjetaCancion key={c.id} cancion={c} onSeleccionar={onSeleccionar} />
              ))}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <p>Escribe arriba el nombre de una canción o artista para comenzar.</p>
          </div>
        )}
      </main>

      {/* Reproductor solo audio: sin video, sin iframe */}
      <audio
        ref={audioRef}
        onPlay={() => setReproduciendo(true)}
        onPause={() => setReproduciendo(false)}
        onEnded={siguiente}
        onError={() => setError("No se pudo reproducir el audio")}
      />
    </div>
  );
}

export default App;