use tauri::{command, AppHandle, Runtime};

use crate::models::{SpeakRequest, TtsStatus, VoiceInfo};
use crate::{NativeTtsExt, Result};

#[command]
pub(crate) async fn speak<R: Runtime>(
    app: AppHandle<R>,
    text: String,
    lang: Option<String>,
    rate: Option<f64>,
    voice_id: Option<String>,
) -> Result<()> {
    app.native_tts()
        .speak(SpeakRequest {
            text,
            lang,
            rate,
            voice_id,
        })
        .await
}

#[command]
pub(crate) async fn stop<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.native_tts().stop().await
}

#[command]
pub(crate) async fn status<R: Runtime>(app: AppHandle<R>) -> Result<TtsStatus> {
    app.native_tts().status().await
}

#[command]
pub(crate) async fn voices<R: Runtime>(app: AppHandle<R>) -> Result<Vec<VoiceInfo>> {
    app.native_tts().voices().await
}
