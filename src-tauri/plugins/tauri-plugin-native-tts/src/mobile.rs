use serde::de::DeserializeOwned;
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::{SpeakRequest, TtsStatus, VoiceInfo};

const ANDROID_PACKAGE: &str = "com.tualingua.tts";
const ANDROID_CLASS: &str = "TtsPlugin";

pub fn init<R: Runtime, C: DeserializeOwned>(
    _app: &AppHandle<R>,
    api: PluginApi<R, C>,
) -> crate::Result<NativeTts<R>> {
    let handle = api.register_android_plugin(ANDROID_PACKAGE, ANDROID_CLASS)?;
    Ok(NativeTts(handle))
}

pub struct NativeTts<R: Runtime>(PluginHandle<R>);

impl<R: Runtime> NativeTts<R> {
    pub async fn speak(&self, payload: SpeakRequest) -> crate::Result<()> {
        self.0
            .run_mobile_plugin_async("speak", payload)
            .await
            .map_err(Into::into)
    }

    pub async fn stop(&self) -> crate::Result<()> {
        self.0
            .run_mobile_plugin_async("stop", ())
            .await
            .map_err(Into::into)
    }

    pub async fn status(&self) -> crate::Result<TtsStatus> {
        self.0
            .run_mobile_plugin_async("status", ())
            .await
            .map_err(Into::into)
    }

    pub async fn voices(&self) -> crate::Result<Vec<VoiceInfo>> {
        self.0
            .run_mobile_plugin_async("voices", ())
            .await
            .map_err(Into::into)
    }
}
