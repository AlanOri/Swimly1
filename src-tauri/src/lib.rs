use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::sync::OnceLock;
use std::time::Duration;
use tauri::{Manager, State};

const USER_AGENT: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const MAX_RESULTADOS: usize = 15;
const MAX_MIX: &str = "30";
const DURACION_MIN: u32 = 60; // segundos
const DURACION_MAX: u32 = 600; // segundos

#[derive(Serialize, Deserialize)]
pub struct Cancion {
    id: String,
    titulo: String,
    artista: String,
    miniatura: String,
}

struct Http(reqwest::Client);

fn yt_host() -> String {
    ["https://www", "youtube", "com"].join(".")
}

fn img_host() -> String {
    ["https://i", "ytimg", "com"].join(".")
}

fn regex_datos() -> &'static Regex {
    static RE: OnceLock<Regex> = OnceLock::new();
    RE.get_or_init(|| Regex::new(r"var ytInitialData = (\{.*?\});</script>").unwrap())
}

/// Convierte "3:45" o "1:02:03" en segundos.
fn duracion_segundos(texto: &str) -> u32 {
    texto
        .split(':')
        .filter_map(|p| p.parse::<u32>().ok())
        .fold(0, |acc, n| acc * 60 + n)
}

/// Un id de video tiene 11 caracteres. Validarlo evita que se cuelen
/// argumentos raros a yt-dlp.
fn id_valido(id: &str) -> bool {
    id.len() == 11
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Descarta directos, karaokes y reacciones.
fn es_ruido(titulo: &str) -> bool {
    let t = titulo.to_lowercase();
    if t.contains("en vivo") {
        return true;
    }
    t.split(|c: char| !c.is_alphanumeric())
        .any(|w| matches!(w, "live" | "karaoke" | "reaction" | "reaccion" | "reacción"))
}

/// Windows a veces devuelve rutas con el prefijo `\\?\`; se quita por compatibilidad.
fn quitar_prefijo_verbatim(p: PathBuf) -> PathBuf {
    let sin_prefijo = p
        .to_str()
        .and_then(|s| s.strip_prefix(r"\\?\"))
        .map(PathBuf::from);
    sin_prefijo.unwrap_or(p)
}

/// Localiza yt-dlp (versión "onedir": carpeta ya descomprimida).
fn ruta_ytdlp(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let exe = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    let mut candidatos: Vec<PathBuf> = Vec::new();

    // En desarrollo se usa directamente la carpeta del proyecto
    #[cfg(debug_assertions)]
    candidatos.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("yt-dlp")
            .join(exe),
    );

    // En la app instalada vive dentro de los recursos
    if let Ok(dir) = app.path().resource_dir() {
        candidatos.push(dir.join("yt-dlp").join(exe));
    }

    candidatos
        .into_iter()
        .find(|p| p.exists())
        .map(quitar_prefijo_verbatim)
        .ok_or_else(|| {
            "No se encontró yt-dlp. Revisa que exista la carpeta src-tauri/yt-dlp/".to_string()
        })
}

/// Ejecuta yt-dlp y devuelve su salida estándar.
async fn ejecutar_ytdlp(app: &tauri::AppHandle, args: &[&str]) -> Result<String, String> {
    let exe = ruta_ytdlp(app)?;
    let args: Vec<String> = args.iter().map(|s| s.to_string()).collect();

    // El proceso es bloqueante, así que se lanza en un hilo aparte
    let salida = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new(exe);
        cmd.args(["--no-warnings", "--socket-timeout", "15"])
            .args(args)
            .env("PYTHONIOENCODING", "utf-8");

        // Sin esto, en Windows aparece una ventana de consola por cada ejecución
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
        }

        cmd.output()
    })
    .await
    .map_err(|e| format!("Error interno: {e}"))?
    .map_err(|e| format!("Error ejecutando yt-dlp: {e}"))?;

    if !salida.status.success() {
        return Err(String::from_utf8_lossy(&salida.stderr).trim().to_string());
    }

    Ok(String::from_utf8_lossy(&salida.stdout).into_owned())
}

#[tauri::command]
async fn buscar_canciones(query: String, http: State<'_, Http>) -> Result<Vec<Cancion>, String> {
    let url = format!(
        "{}/results?search_query={}",
        yt_host(),
        urlencoding::encode(&query)
    );

    let html = http
        .0
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red: {e}"))?
        .text()
        .await
        .map_err(|e| format!("Error leyendo respuesta: {e}"))?;

    let json_str = regex_datos()
        .captures(&html)
        .and_then(|c| c.get(1))
        .ok_or("No se encontraron datos en la respuesta")?
        .as_str();

    let data: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Error parseando JSON: {e}"))?;

    let secciones = data
        .pointer("/contents/twoColumnSearchResultsRenderer/primaryContents/sectionListRenderer/contents")
        .and_then(|v| v.as_array())
        .ok_or("Formato de respuesta inesperado")?;

    let img = img_host();

    let mut resultados: Vec<Cancion> = secciones
        .iter()
        .filter_map(|s| s["itemSectionRenderer"]["contents"].as_array())
        .flatten()
        .filter_map(|item| item.get("videoRenderer"))
        .filter_map(|v| {
            let id = v["videoId"].as_str().filter(|s| !s.is_empty())?;

            // Sin lengthText = directo, se descarta
            let dur = duracion_segundos(v["lengthText"]["simpleText"].as_str()?);
            if !(DURACION_MIN..=DURACION_MAX).contains(&dur) {
                return None;
            }

            Some(Cancion {
                id: id.to_string(),
                titulo: v["title"]["runs"][0]["text"]
                    .as_str()
                    .unwrap_or("Sin título")
                    .to_string(),
                artista: v["ownerText"]["runs"][0]["text"]
                    .as_str()
                    .unwrap_or("Desconocido")
                    .to_string(),
                miniatura: format!("{img}/vi/{id}/hqdefault.jpg"),
            })
        })
        .collect();

    // Canales "- Topic" primero (el sort es estable, conserva el orden original)
    resultados.sort_by_key(|c| !c.artista.ends_with(" - Topic"));
    resultados.truncate(MAX_RESULTADOS);

    Ok(resultados)
}

#[tauri::command]
async fn obtener_audio(app: tauri::AppHandle, id: String) -> Result<String, String> {
    if !id_valido(&id) {
        return Err("ID de video inválido".into());
    }

    let url = format!("{}/watch?v={}", yt_host(), id);

    let salida = ejecutar_ytdlp(
        &app,
        &["-f", "bestaudio[ext=m4a]/bestaudio", "-g", "--no-playlist", &url],
    )
    .await?;

    salida
        .lines()
        .next()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .ok_or_else(|| "No se obtuvo URL de audio".to_string())
}

/// Devuelve canciones similares usando el Mix (radio) de YouTube para ese video.
#[tauri::command]
async fn obtener_mix(app: tauri::AppHandle, id: String) -> Result<Vec<Cancion>, String> {
    if !id_valido(&id) {
        return Err("ID de video inválido".into());
    }

    let url = format!("{}/watch?v={}&list=RD{}", yt_host(), id, id);

    let salida = ejecutar_ytdlp(
        &app,
        &["-J", "--flat-playlist", "--playlist-end", MAX_MIX, &url],
    )
    .await?;

    let data: serde_json::Value =
        serde_json::from_str(&salida).map_err(|e| format!("Error parseando el mix: {e}"))?;

    let entradas = data["entries"]
        .as_array()
        .ok_or("El mix no devolvió canciones")?;

    let img = img_host();

    let canciones = entradas
        .iter()
        .filter_map(|e| {
            let vid = e["id"].as_str().filter(|s| id_valido(s))?;
            let titulo = e["title"].as_str()?;

            if es_ruido(titulo) || e["live_status"].as_str() == Some("is_live") {
                return None;
            }

            // Si trae duración, debe estar en rango; si no la trae, se acepta.
            if let Some(d) = e["duration"].as_f64() {
                if !(DURACION_MIN..=DURACION_MAX).contains(&(d as u32)) {
                    return None;
                }
            }

            let artista = e["channel"]
                .as_str()
                .or_else(|| e["uploader"].as_str())
                .unwrap_or("Desconocido");

            Some(Cancion {
                id: vid.to_string(),
                titulo: titulo.to_string(),
                artista: artista.to_string(),
                miniatura: format!("{img}/vi/{vid}/hqdefault.jpg"),
            })
        })
        .collect();

    Ok(canciones)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(10))
        .build()
        .expect("no se pudo crear el cliente HTTP");

    tauri::Builder::default()
        .manage(Http(client))
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            buscar_canciones,
            obtener_audio,
            obtener_mix
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}