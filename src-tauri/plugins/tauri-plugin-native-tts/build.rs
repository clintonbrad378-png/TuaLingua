const COMMANDS: &[&str] = &["speak", "stop", "status", "voices"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .android_path("android")
        .build();
}
