# Aleph Vet Staff — color system

This app uses a **light-first** palette: cool neutrals for most of the UI (~70%), **navy** for structure and primary actions (~20%), and **cyan** for focus, progress, and light accents (~10%). Semantic greens, ambers, reds, and blues are reserved for meaning (success, warning, error, info).

## Source of truth

All primitive hex values live in `src/app/globals.css` under `:root` (e.g. `--brand-navy-800`, `--bg-canvas`, `--success-500`). The shadcn layer (`--background`, `--primary`, `--ring`, …) maps those primitives to components.

Tailwind utilities are wired via `@theme inline` in the same file (`--color-brand-navy-800`, `--color-success-100`, …).

## Token roles

| Token / utility | Role |
|-----------------|------|
| `--background` / `bg-background` | App canvas (`#F7FAFC`) |
| `--card` / `bg-card` | White surfaces |
| `--muted` / `bg-muted` | Subtle panels (`#EEF3F8`) |
| `--foreground` | Primary text (`#0F1B2D`) |
| `--muted-foreground` | Secondary body/helper text |
| `--placeholder-foreground` | Input placeholders (readable muted) |
| `--primary` | Navy buttons and strong brand UI |
| `--primary-hover` | Darker navy on hover/active |
| `--ring` | Focus rings (cyan) |
| `--progress-fill` / `bg-progress-fill` | Progress bars, in-progress meters |
| `--accent` | Very light cyan wash (nav active, hovers) |
| `success-*`, `warning-*`, `error-*`, `info-*` | Status and feedback only |

## Usage rules

1. **Do not** sprinkle raw hex in components; add a primitive in `globals.css` and expose it in `@theme` if you need a new utility.
2. **Cyan** — progress, current-step emphasis, focus, and sparse accents; not full-page backgrounds.
3. **Navy** — headers, primary buttons, sidebar wordmark, structural weight.
4. **Semantic colors** — badges and callouts (success = completed, `progress` variant = in-flight, warning = soft issues, destructive = failed/error).

## UI primitives

- **Buttons**: `Button` default = navy + `primary-hover`; outline/secondary = white or subtle fill + navy text.
- **Badges**: Extended variants in `src/components/ui/badge.tsx` (`success`, `warning`, `info`, `progress`). Session and analysis rows use `src/components/shared/status-badges.tsx` for consistent status mapping.

## Dark mode

`.dark` in `globals.css` adjusts the same variables for a navy-based dark shell. The product is optimized for light mode.
