# Dry Run Raven

> An editor that lets you write pseudocode for an algorithm diagram and run or test it.

Dry Run Raven is a fully offline desktop application built for studying the
**Introduction to Algorithms and Programming** course. You can write algorithms
in the pseudocode style used in lecture notes, run them, step through them,
test them, and turn the same algorithm into a flow chart.

## Development status

> **Important note:** This project was created with the help of AI so that I
> could study for the course. I have not yet reviewed the code line by line,
> so please evaluate the correctness of the generated code and its output
> independently if you use this as a learning resource. I plan to rewrite the
> project from scratch myself in the future. Until then, this repository will
> remain a learning/experimental project.

In short: the project is currently usable, but the code has not yet been
reviewed end to end by its author. The future version will be a from-scratch,
hand-written implementation of the same idea.

## What it does

- Lets you write pseudocode with step labels such as `1-`, `2)`, `3.2`.
- Runs the algorithm inside a Web Worker; **Stop** terminates it immediately.
- Supports step-by-step execution (`F10`), highlighting the current line and memory state.
- Defines test scenarios, runs them all, and reports an `x/y passed` summary.
- Optionally compares against a reference algorithm using random inputs.
- Generates a flow chart from the same algorithm; exports it as SVG or PNG.
- Ships with a bank of 27 questions: TR/EN problem text, tests, and a hidden reference solution.
- Offers a Turkish/English interface and system/light/dark themes.

The application is fully offline. It uses no telemetry, updater, tray icon,
external fonts, or CDN resources.

## Features

### Editor

- Line numbers, error line, and active-step highlighting.
- Three-tone syntax highlighting for keywords, numbers/strings, and comments.
- Automatic step numbering on `Enter` (`4-`, `3.2`, etc.).
- Breakpoints by clicking a line number.
- `.alg` files with a `.alg.json` sidecar file.
- Automatic saving of the latest draft to `localStorage`.

### Running

- `F5` or **Run**.
- Input queue; when the queue is empty, input is requested in the console.
- Both `,` and `.` accepted as decimal separators in input values.
- Output, duration, and step count.
- Default limits: **1,000,000 steps** and **10,000 output lines**.

### Testing

- Add, edit, and delete scenarios.
- Expected/actual output comparison with the first difference shown.
- Case-insensitive and whitespace-insensitive comparison.
- `1e-9` tolerance for numbers.
- Reference algorithm comparison with 10–50 random trials.

### Memory

- Value history for scalar variables: `0 → 1 → 2 → 3`.
- Indexed cells for arrays, with the most recently changed cell highlighted.
- The memory panel is computed only while its tab is open.

### Flow chart

- Start/End ovals, process rectangles, input/output parallelograms, decision
  diamonds, and empty merge circles.
- `E/H` labels on decision edges (`Y/N` in the English interface).
- Loop edges routed from the left, with a “Loop” label and an optional hexagon
  representation.
- Display mode by step number or by algorithm expression.
- Zoom/pan and SVG/PNG export.
- Highlighting of the current shape in step mode.

## Installation

Requirements:

- Node.js 20+ and pnpm
- Rust (stable) and the Tauri 2 Linux dependencies
  (`webkit2gtk-4.1`, `gtk-3`, `librsvg2`; package names may vary by distribution)

In the project directory:

```sh
pnpm install
```

## Development

```sh
pnpm tauri dev      # desktop window + Vite
pnpm dev            # browser preview only
```

In the browser preview, opening/saving files uses the browser's file picker and
download mechanism. In the desktop build, Rust commands open native dialogs and
write the `.alg.json` sidecar automatically.

## Building

```sh
pnpm build          # tsc + vite build → dist/
pnpm tauri build    # installer packages
```

Linux packages are created under `src-tauri/target/release/bundle/`:

```text
deb/Dry Run Raven_0.1.0_amd64.deb
appimage/Dry Run Raven_0.1.0_amd64.AppImage
```

The release profile is tuned for a small binary: `opt-level="s"`, `lto=true`,
`codegen-units=1`, `panic="abort"`, `strip=true`.

## Usage

Example algorithm:

```text
1- Başla
2- say = 0
3- Sayı Gir (n)
4- if (n > 0) Then
5-     Print ("Pozitif")
6- else
7-     Print ("Pozitif değil")
8- Dur.
```

Run it with `F5` and step through it with `F10`. Add test scenarios from the
**Test** tab.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `F5` / `Ctrl+Enter` | Run |
| `F10` | Step |
| `F8` | Continue |
| `F9` | Toggle breakpoint on the current line |
| `Ctrl+T` / `F6` | Run tests |
| `Ctrl+S` / `Ctrl+Shift+S` | Save / Save as |
| `Ctrl+O` | Open |
| `Ctrl+N` | New |
| `Ctrl+Shift+F` | Flow chart tab |
| `Ctrl+G` | Go to line |
| `Ctrl+,` | Settings |

## Supported pseudocode

- Step labels: `1-`, `2)`, `3.`, `3.2`, `3.2.1`. Labels are optional.
- `Başla` / `Dur` are optional; a warning is shown when they are missing.
- Variables are created on first assignment; names are case-insensitive.
- Arrays are 0-based: `Dizi A[10]`, `A[0] = 5`, `A[i]`.
- Input: `Sayı Gir`, `Sayıları Gir`, `Gir`, `Oku`, `Tahmin Et`,
  `Hedef Sayıyı Gir`, `Read`, `Input`, `Enter`.
- Output: `Print`, `Yazdır`, `Yaz`, `Write`, `Output`.
- Conditionals: `if` / `Eğer` / `İf`, `Then` / `ise`, `else` / `değilse`,
  `else if` / `değilse eğer`.
- Loops: `Goto 3` / `Git 3`.
- Operators: `+ - * / ^ % mod div`, `sqrt`, `abs`, `ve/and`, `veya/or`,
  `değil/not`; comparisons `== != < > <= >=`.
- Comments: `// ...`, `# ...`, or `→ ...`.
- A comma separates statements outside parentheses: `say = 0, i = 1`.
- Decimal separator is `.` in source code; both `,` and `.` are accepted in input values.
- Typo tolerance: `+ +` → `++`, `= =` → `==`, `< =` → `<=`, Turkish quotation marks.

## File format

- `file.alg`: UTF-8 plain-text algorithm.
- `file.alg.json`: sidecar file holding test scenarios, the linked question, and the input queue.

```json
{
  "version": 1,
  "tests": [
    { "id": "t...", "name": "Test 1", "inputs": "3 1 2 3", "expected": "6" }
  ],
  "problemId": 4,
  "inputQueue": "3 1 2 3"
}
```

## Question bank

The built-in bank in `src/lib/problems/problems.json` contains 27 questions.
Each question has TR/EN text, tests, and a hidden reference solution. Loading a
question from the **Questions** tab fills the editor with a skeleton and loads
its tests automatically. “Show solution” is off by default.

You can add your own question via **Add question** in the app, or add an entry to
the JSON using the same schema:

```json
{
  "id": 28,
  "titleTr": "Başlık",
  "titleEn": "Title",
  "textTr": "Soru metni…",
  "textEn": "Problem text…",
  "tests": [{ "name": "Test 1", "inputs": "3", "expected": "6" }],
  "solution": "1- Başla\n2- …\n3- Dur."
}
```

User questions are stored in `localStorage` and can be exported as JSON via
**Export questions**.

## Tests

```sh
pnpm test
pnpm exec tsc --noEmit
```

Vitest coverage:

- Turkish `i/İ/ı/I` tolerance and spelling normalisation
- Dangling else, nested if, and `else if` chains
- Comma-separated statements, array bounds, uninitialised variables
- Infinite loop / step limit and output limit
- All 27 questions passing their own tests
- CFG/flow chart layout and multi-loop edges
- App shell and tab wiring

Current status: **43 tests passing**.

## Architecture

```text
src/lib/lang       normalise → lexer → line/indent parser → AST
src/lib/lang       AST → flat instructions (compiler)
src/lib/interp     generator VM, Web Worker, protocol, worker client
src/lib/cfg        control flow graph and merge nodes from instructions
src/lib/flow       layered layout, pure SVG rendering, PNG export
src/lib/tests      output comparison and random reference comparison
src/lib/problems   27-question bank + loader
src/ui             Svelte 5 components and application state
src-tauri          Rust shell: file dialogs, writing, CSP
```

The same flat instruction sequence feeds both the interpreter and the flow
chart, so step numbers, breakpoints, and chart nodes follow the same order.

The error object is independent of the UI:
`{ line, label, code, params, hint }` (line, step, code, parameters, hint).
The displayed text and hint are produced from the
`src/lib/lang/messages.ts` table according to the selected interface language.

## Extending the keyword table

The single source of truth is `src/lib/lang/keywords.ts`. Add the Turkish or
English spelling to the relevant entry:

```ts
{ meaning: 'giris', tr: ['Sayı Gir', 'Girdi Al'], en: ['Read', 'Input'] },
```

Comparison goes through `norm()`: `i / İ / ı / I` are treated as the same letter,
and case is ignored. Multi-word keywords are joined automatically. Additional
aliases can also be defined as a comma-separated list under
**Settings → Additional input aliases**.

## Size and privacy

Production measurements:

```text
index JS       169.75 kB raw   / 56.41 kB gzip
worker JS       30.30 kB raw   /  9.39 kB gzip
CSS             20.98 kB raw   /  4.66 kB gzip
.deb             1.56 MiB
AppImage       107.98 MiB      (includes WebKitGTK libraries)
```

Idle measurement over 20 seconds in a Wayland session:

```text
CPU:           0.0%
Main process:  ≈198 MB RSS
Total process: ≈532 MB RSS (including WebKit child processes)
```

The application makes no network requests while running; the CSP allows no
external resources. It uses system fonts, with no idle animations or polling.
Memory and flow chart tabs are computed only when opened.

Third-party components and their licence texts are listed in
`THIRD-PARTY-NOTICES.md`. The installers include the same notices and licence
texts under `usr/lib/Dry Run Raven/`.
