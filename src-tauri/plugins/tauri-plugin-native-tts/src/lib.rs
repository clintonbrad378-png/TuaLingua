use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

mod commands;
mod error;
mod models;

#[cfg(not(all(mobile, target_os = "android")))]
mod desktop;
#[cfg(all(mobile, target_os = "android"))]
mod mobile;

pub use error::{Error, Result};
pub use models::{EngineInfo, SpeakRequest, TtsStatus, VoiceInfo};

#[cfg(not(all(mobile, target_os = "android")))]
use desktop::NativeTts;
#[cfg(all(mobile, target_os = "android"))]
use mobile::NativeTts;

pub trait NativeTtsExt<R: Runtime> {
    fn native_tts(&self) -> &NativeTts<R>;
}

impl<R: Runtime, T: Manager<R>> NativeTtsExt<R> for T {
    fn native_tts(&self) -> &NativeTts<R> {
        self.state::<NativeTts<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("native-tts")
        .invoke_handler(tauri::generate_handler![
            commands::speak,
            commands::stop,
            commands::status,
            commands::voices,
            commands::engines
        ])
        .setup(|app, api| {
            #[cfg(all(mobile, target_os = "android"))]
            let native_tts = mobile::init(app, api)?;
            #[cfg(not(all(mobile, target_os = "android")))]
            let native_tts = desktop::init(app, api)?;
            app.manage(native_tts);
            Ok(())
        })
        .build()
}
