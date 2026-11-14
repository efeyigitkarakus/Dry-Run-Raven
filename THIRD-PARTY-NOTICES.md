# Third-party notices

Dry Run Raven is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. The full text is in the repository's `LICENSE` file and in
`licenses/GPL-3.0.txt`.

This file collects the attribution and licence notices for the third-party
software that Dry Run Raven uses or redistributes.

## What the packages contain

| Package | Third-party binaries |
| --- | --- |
| `.deb` | None. It depends on the distribution's `libwebkit2gtk-4.1-0` and `libgtk-3-0`, which are installed and licensed by your distribution. |
| `.AppImage` | Unmodified shared libraries taken from Arch Linux packages, for example WebKitGTK 2.54.2, GTK 3.24.52, GLib 2.90.1 and GStreamer 1.28.9. |

The complete inventories are in:

- `licenses/native-libraries.md` — the 109 distribution packages and their shared objects bundled in the AppImage
- `licenses/rust-crates.md` — the Rust dependency graph (245 crates)
- `licenses/*.txt` — the licence texts listed below

Frontend components compiled into the JavaScript bundle:

| Component | Version | Licence |
| --- | --- | --- |
| Svelte | 5.57.3 | MIT |
| `@tauri-apps/api` | 2.12.4 | Apache-2.0 OR MIT |

## LGPL libraries in the AppImage

The AppImage bundles libraries under LGPL-2.0, LGPL-2.1 and LGPL-3.0, notably
GTK 3, GLib, Pango, Cairo, GDK-Pixbuf, AT-SPI, GStreamer, libsoup and
WebKitGTK together with their dependencies. They are included unmodified and
are loaded as separate shared objects at runtime.

The LGPL gives you the right to replace these libraries:

1. Extract the AppImage:
   `./Dry\ Run\ Raven_0.1.0_amd64.AppImage --appimage-extract`
2. Replace any file under `squashfs-root/usr/lib/` with a compatible build.
3. Run the extracted tree with `squashfs-root/AppRun`, or repack it.

Because the libraries are dynamically linked, no relinking of the application
binary is required.

Sources for these libraries:

- upstream project links are in `licenses/native-libraries.md`;
- the exact Arch Linux package recipes are at
  `https://gitlab.archlinux.org/archlinux/packaging/packages/<package>`;
- upstream release archives for the versions listed in that table are
  published by each project.

If a specific source archive cannot be found, please open an issue in this
repository.

## Licence texts

The following texts are included in `licenses/`. They were obtained from the
[SPDX licence list](https://github.com/spdx/license-list-data) and, for the GNU
licences, from <https://www.gnu.org/licenses/>.

| File | Licence |
| --- | --- |
| `0BSD.txt` | BSD Zero Clause Licence |
| `AFL-2.0.txt` | Academic Free Licence 2.0 |
| `AFL-2.1.txt` | Academic Free Licence 2.1 |
| `Apache-2.0.txt` | Apache Licence 2.0 |
| `Autoconf-exception-3.0.txt` | Autoconf exception 3.0 |
| `Bison-exception-2.2.txt` | Bison exception 2.2 |
| `BSD-2-Clause.txt` | BSD 2-Clause "Simplified" Licence |
| `BSD-2-Clause-Views.txt` | BSD 2-Clause with views supplement |
| `BSD-3-Clause.txt` | BSD 3-Clause "New" or "Revised" Licence |
| `BSD-Source-Code.txt` | BSD Source Code Attribution licence |
| `BSL-1.0.txt` | Boost Software Licence 1.0 |
| `bzip2-1.0.6.txt` | bzip2 and libbzip2 Licence 1.0.6 |
| `CC0-1.0.txt` | Creative Commons Zero 1.0 Universal |
| `curl.txt` | curl Licence |
| `FTL.txt` | FreeType Licence |
| `GCC-exception-3.1.txt` | GCC Runtime Library exception 3.1 |
| `GPL-2.0.txt` | GNU General Public Licence 2.0 |
| `GPL-3.0.txt` | GNU General Public Licence 3.0 |
| `HPND-sell-variant.txt` | Historical Permission Notice and Disclaimer, sell variant |
| `IJG.txt` | Independent JPEG Group Licence |
| `ISC.txt` | ISC Licence |
| `LGPL-2.0.txt` | GNU Lesser General Public Licence 2.0 |
| `LGPL-2.1.txt` | GNU Lesser General Public Licence 2.1 |
| `LGPL-3.0.txt` | GNU Lesser General Public Licence 3.0 |
| `libpng-2.0.txt` | libpng Licence 2.0 |
| `Linux-syscall-note.txt` | Linux syscall note |
| `Libtool-exception.txt` | Libtool exception |
| `LLVM-exception.txt` | LLVM exception |
| `MIT.txt` | MIT Licence |
| `MIT-0.txt` | MIT No Attribution Licence |
| `MPL-1.1.txt` | Mozilla Public Licence 1.1 |
| `MPL-2.0.txt` | Mozilla Public Licence 2.0 |
| `NAIST-2003.txt` | NAIST 2003 Licence |
| `NCSA.txt` | University of Illinois/NCSA Open Source Licence |
| `OFL-1.1.txt` | SIL Open Font Licence 1.1 |
| `PCRE2-exception.txt` | PCRE2 exception |
| `SMLNJ.txt` | Standard ML of New Jersey Licence |
| `SunPro.txt` | SunPro Licence |
| `Unicode-3.0.txt` | Unicode Licence 3.0 |
| `Unicode-TOU.txt` | Unicode Terms of Use |
| `Unlicense.txt` | The Unlicense |
| `X11.txt` | X11 Licence |
| `Zlib.txt` | zlib Licence |

## Other licence expressions

Some packages declare licence expressions that are not a single SPDX
identifier, or use a `LicenseRef-`. Examples include `custom` (krb5, hidapi,
libyuv, svt-av1, xz), `LicenseRef-Sqlite` (SQLite is in the public domain),
`LicenseRef-libavif` (BSD-2-Clause plus the Alliance for Open Media patent
licence) and the `LicenseRef-*` entries for ICU, libgcrypt, libxext and
libxkbfile. The licence expressions in the tables are reproduced exactly as the
packages declare them; consult the corresponding upstream project for the full
terms.

## How the inventories were produced

```sh
# Rust crates
cd src-tauri
cargo tree -e normal --prefix none --format '{p}|{l}|{r}' | sort -u

# Bundled native libraries
cd "src-tauri/target/release/bundle/appimage/Dry Run Raven.AppDir/usr/lib"
for f in *.so* webkit2gtk-4.1/*; do pacman -Qo "/usr/lib/$(basename "$f")"; done

# Licence expression of a package
pacman -Qi <package> | sed -n 's/^Licenses *: //p'
```

The inventory describes the 0.1.0 release built on 2026-11-14 on a CachyOS
(Arch-based) system. Rebuilding the AppImage on another distribution or with
updated packages changes the bundled library set.

## No warranty

The third-party components are provided "as is", without warranty of any kind,
as described in their respective licences.
