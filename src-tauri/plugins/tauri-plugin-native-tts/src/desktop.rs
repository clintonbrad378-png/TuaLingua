use serde::de::DeserializeOwned;
use tauri::{plugin::PluginApi, AppHandle, Runtime};

use crate::models::{EngineInfo, SpeakRequest, TtsStatus, VoiceInfo};

pub fn init<R: Runtime, C: DeserializeOwned>(
    app: &AppHandle<R>,
    _api: PluginApi<R, C>,
) -> crate::Result<NativeTts<R>> {
    Ok(NativeTts(app.clone()))
}

pub struct NativeTts<R: Runtime>(#[allow(dead_code)] AppHandle<R>);

impl<R: Runtime> NativeTts<R> {
    pub async fn speak(&self, payload: SpeakRequest) -> crate::Result<()> {
        #[cfg(target_os = "windows")]
        {
            return speak_windows(payload).await;
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = payload;
            Err(crate::Error::Msg(
                "native TTS no disponible en este escritorio; usa Web Speech".into(),
            ))
        }
    }

    pub async fn stop(&self) -> crate::Result<()> {
        Ok(())
    }

    pub async fn status(&self) -> crate::Result<TtsStatus> {
        #[cfg(target_os = "windows")]
        {
            let res = tauri::async_runtime::spawn_blocking(|| {
                tts::Tts::default().map(|_| ()).map_err(|e| e.to_string())
            })
            .await
            .map_err(|e| crate::Error::Msg(e.to_string()))?;
            return Ok(match res {
                Ok(()) => TtsStatus { available: true, engine: "native".into(), error: None },
                Err(e) => TtsStatus { available: false, engine: "native".into(), error: Some(e) },
            });
        }
        #[cfg(not(target_os = "windows"))]
        {
            Ok(TtsStatus {
                available: false,
                engine: "native".into(),
                error: Some("native desktop TTS solo implementado en Windows; usa Web Speech".into()),
            })
        }
    }

    pub async fn voices(&self, _engine: Option<String>) -> crate::Result<Vec<VoiceInfo>> {
        #[cfg(target_os = "windows")]
        {
            let voices = tauri::async_runtime::spawn_blocking(|| {
                let tts = tts::Tts::default().map_err(|e| e.to_string())?;
                let voices = tts.voices().map_err(|e| e.to_string())?;
                Ok::<_, String>(
                    voices
                        .into_iter()
                        .map(|v| VoiceInfo {
                            id: v.id(),
                            name: v.name(),
                            lang: v.language().to_string(),
                            default: false,
                        })
                        .collect::<Vec<_>>(),
                )
            })
            .await
            .map_err(|e| crate::Error::Msg(e.to_string()))?
            .map_err(crate::Error::Msg)?;
            return Ok(voices);
        }
        #[cfg(not(target_os = "windows"))]
        {
            Ok(vec![])
        }
    }

    pub async fn engines(&self) -> crate::Result<Vec<EngineInfo>> {
        Ok(vec![])
    }
}

#[cfg(target_os = "windows")]
async fn speak_windows(payload: SpeakRequest) -> crate::Result<()> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut tts = tts::Tts::default().map_err(|e| crate::Error::Msg(e.to_string()))?;

        if let Some(voice_id) = payload.voice_id.as_deref() {
            if let Ok(voices) = tts.voices() {
                if let Some(voice) = voices.into_iter().find(|v| v.id() == voice_id) {
                    let _ = tts.set_voice(&voice);
                }
            }
        }

        let rate = payload.rate.unwrap_or(1.0).clamp(0.5, 1.5) as f32;
        let _ = tts.set_rate(tts.normal_rate() * rate);

        tts.speak(payload.text, true)
            .map_err(|e| crate::Error::Msg(e.to_string()))?;
        Ok(())
    })
    .await
    .map_err(|e| crate::Error::Msg(e.to_string()))?
}
