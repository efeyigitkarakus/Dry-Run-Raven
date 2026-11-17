//! Bu oturumda kullanıcının yerel bir dosya diyaloğuyla seçtiği yollar.
//!
//! Webview'den gelen bir yol dizgesine tek başına güvenilmez: arayüzde
//! çalıştırılabilen herhangi bir betik `save_alg` komutuna istediği mutlak
//! yolu gönderebilir. Bu yüzden diyalogsuz yazmaya yalnızca daha önce bir
//! diyalogdan dönmüş, birebir aynı yol için izin verilir.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Default)]
pub struct ApprovedPaths(Mutex<HashSet<PathBuf>>);

impl ApprovedPaths {
    fn set(&self) -> std::sync::MutexGuard<'_, HashSet<PathBuf>> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Diyalogdan dönen bir yolu onaylı olarak kaydeder.
    pub fn approve(&self, path: &Path) {
        self.set().insert(path.to_path_buf());
    }

    /// Yol, daha önce onaylananlardan biriyle birebir aynı mı?
    ///
    /// Bilerek normalleştirme yapılmaz: `..` içeren, göreli ya da farklı
    /// yazılmış bir yol onaylı bir dosyayı gösterse bile kabul edilmez.
    pub fn is_approved(&self, path: &Path) -> bool {
        self.set().contains(path)
    }

    /// Ön yüzün istediği yolu yalnızca onaylıysa döndürür; aksi hâlde `None`
    /// (çağıran taraf kullanıcıya diyalog açmalıdır).
    pub fn resolve(&self, requested: Option<&str>) -> Option<PathBuf> {
        let path = PathBuf::from(requested.filter(|p| !p.is_empty())?);
        self.is_approved(&path).then_some(path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approved(paths: &[&str]) -> ApprovedPaths {
        let a = ApprovedPaths::default();
        for p in paths {
            a.approve(Path::new(p));
        }
        a
    }

    #[test]
    fn onaylanmamis_mutlak_yol_reddedilir() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(a.resolve(Some("/home/u/.bashrc")), None);
        assert_eq!(a.resolve(Some("/etc/passwd")), None);
        assert_eq!(a.resolve(Some("C:\\Windows\\System32\\x.dll")), None);
    }

    #[test]
    fn onayli_yol_birebir_kabul_edilir() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(
            a.resolve(Some("/home/u/odev.alg")),
            Some(PathBuf::from("/home/u/odev.alg"))
        );
        assert!(a.is_approved(Path::new("/home/u/odev.alg")));
    }

    #[test]
    fn ust_dizin_iceren_esdeger_yol_reddedilir() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(a.resolve(Some("/home/u/x/../odev.alg")), None);
        assert_eq!(a.resolve(Some("/home/u/./odev.alg/../.bashrc")), None);
    }

    #[test]
    fn goreli_yol_reddedilir() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(a.resolve(Some("odev.alg")), None);
        assert_eq!(a.resolve(Some("../../etc/cron.d/x")), None);
    }

    #[test]
    fn bos_veya_eksik_yol_diyaloga_duser() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(a.resolve(None), None);
        assert_eq!(a.resolve(Some("")), None);
    }

    #[test]
    fn yan_dosya_yolu_kendiliginden_onayli_degildir() {
        let a = approved(&["/home/u/odev.alg"]);
        assert_eq!(a.resolve(Some("/home/u/odev.alg.json")), None);
    }

    #[test]
    fn hicbir_sey_onaylanmadiysa_her_yol_reddedilir() {
        let a = ApprovedPaths::default();
        assert_eq!(a.resolve(Some("/home/u/odev.alg")), None);
    }
}
