use regex::Regex;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Serialize, Deserialize)]
pub struct Cancion {
    id: String,
    titulo: String,
    artista: String,
    miniatura: String,
}

#[tauri::command]
async fn buscar_canciones(query: String) -> Result<Vec<Cancion>, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Error configurando cliente: {:?}", e))?;

    let encoded_query = urlencoding::encode(&query);
    let dominio = ["https://www", "youtube", "com"].join(".");
    let url = format!("{}/results?search_query={}", dominio, encoded_query);

    let html = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Error de red: {:?}", e))?
        .text()
        .await
        .map_err(|e| format!("Error leyendo respuesta: {}", e))?;

    let re = Regex::new(r"var ytInitialData = (\{.*?\});</script>").map_err(|e| e.to_string())?;
    let caps = re
        .captures(&html)
        .ok_or("No se encontraron datos en la respuesta de YouTube")?;

    let json_str = caps.get(1).ok_or("Error capturando JSON")?.as_str();
    let data: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Error parseando JSON: {}", e))?;

    let mut resultados = Vec::new();
    let img_host = ["https://i", "ytimg", "com"].join(".");

    if let Some(sections) =
        data["contents"]["twoColumnSearchResultsRenderer"]["primaryContents"]["sectionListRenderer"]
            ["contents"]
            .as_array()
    {
        for section in sections {
            if let Some(items) = section["itemSectionRenderer"]["contents"].as_array() {
                for item in items {
                    if let Some(video) = item.get("videoRenderer") {
                        let id = video["videoId"].as_str().unwrap_or_default();
                        let titulo = video["title"]["runs"]
                            .get(0)
                            .and_then(|v| v["text"].as_str())
                            .unwrap_or("Sin título");
                        let artista = video["ownerText"]["runs"]
                            .get(0)
                            .and_then(|v| v["text"].as_str())
                            .unwrap_or("Desconocido");

                        if !id.is_empty() {
                            resultados.push(Cancion {
                                id: id.to_string(),
                                titulo: titulo.to_string(),
                                artista: artista.to_string(),
                                miniatura: format!("{}/vi/{}/hqdefault.jpg", img_host, id),
                            });
                        }

                        if resultados.len() >= 15 {
                            break;
                        }
                    }
                }
            }
        }
    }

    Ok(resultados)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![buscar_canciones])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
