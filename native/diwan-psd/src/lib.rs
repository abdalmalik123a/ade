use napi_derive::napi;

#[napi]
pub fn psd_engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
