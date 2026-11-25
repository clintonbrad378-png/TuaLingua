use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{
    plugin::{PluginApi, PluginHandle},
    AppHandle, Runtime,
};

use crate::models::{EngineInfo, SpeakRequest, TtsStatus, VoiceInfo};

#[derive(Serialize)]
struct VoicesRequest {
    engine: Option<String>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum VoicesResponse {
    List(Vec<VoiceInfo>),
    Wrapped { voices: Vec<VoiceInfo> },
}

#[derive(Deserialize)]
#[serde(untagged)]
enum EnginesResponse {
    List(Vec<EngineInfo>),
    Wrapped { engines: Vec<EngineInfo> },
}

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
        let _: serde::de::IgnoredAny = self.0.run_mobile_plugin_async("speak", payload).await?;
        Ok(())
    }

    pub async fn stop(&self) -> crate::Result<()> {
        let _: serde::de::IgnoredAny = self.0.run_mobile_plugin_async("stop", ()).await?;
        Ok(())
    }

    pub async fn status(&self) -> crate::Result<TtsStatus> {
        self.0
            .run_mobile_plugin_async("status", ())
            .await
            .map_err(Into::into)
    }

    pub async fn voices(&self, engine: Option<String>) -> crate::Result<Vec<VoiceInfo>> {
        let res: VoicesResponse = self
            .0
            .run_mobile_plugin_async("voices", VoicesRequest { engine })
            .await?;
        Ok(match res {
            VoicesResponse::List(v) => v,
            VoicesResponse::Wrapped { voices } => voices,
        })
    }

    pub async fn engines(&self) -> crate::Result<Vec<EngineInfo>> {
        let res: EnginesResponse = self.0.run_mobile_plugin_async("engines", ()).await?;
        Ok(match res {
            EnginesResponse::List(v) => v,
            EnginesResponse::Wrapped { engines } => engines,
        })
    }
}
