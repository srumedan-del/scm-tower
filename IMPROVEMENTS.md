# UI/UX Pro Max Improvements — Phase 1

**Restore point:** `v0.2-restore-point-improve` (commit sebelum perubahan)
**Tanggal:** 2026-10-01

## Apa yang Di-improve

Pendekatan: **additive only** — tidak ada struktur/logic yang berubah. Komponen baru ditambahkan, komponen existing di-upgrade dengan utility classes dari design system.

### 1. Komponen Baru

#### `components/ui/Card.tsx`
Card primitive reusable dengan sub-komponen:
- `<Card>` — container utama
- `<CardHeader title={...} action={...}>` — header dengan border-bottom
- `<CardBody>` — body dengan vertical spacing
- `<CardFooter>` — footer untuk actions
- Props `interactive` untuk clickable cards (hover-lift + cursor-pointer)

#### `components/ui/Badge.tsx`
Badge primitive dengan tone & size variants:
- Tone: `neutral | blue | green | orange | red | muted`
- Size: `sm | md`
- `<StatusBadge status="In Transit" />` — auto-mapping ke tone via `SHIPMENT_STATUS_TONE`
- Single source of truth untuk status → color mapping

### 2. Komponen Existing yang Di-upgrade

#### `components/ui/Button.tsx`
- ✅ `transition-all` → `transition-interactive` (cubic-bezier smooth)
- ✅ `focus:outline-none focus:ring-2 focus:ring-blue/30` → `focus-ring` (var-based, lebih konsisten)
- ✅ Primary & Danger variants tambah `hover-lift` (subtle translateY + shadow)
- **Logic & variants:** tetap sama, tidak berubah

#### `components/ui/Modal.tsx`
- ✅ `border-t-indigo-600` → `border-t-blue` (konsisten dengan design system palette)
- ✅ `shadow-xl` → `shadow-[var(--shadow-xl)]` (pakai design token)
- ✅ Inline SVG icons → `CheckCircle2` / `AlertCircle` / `Info` dari lucide-react (konsisten dengan pattern project yang pakai lucide)
- ✅ Close button: `transition-colors` → `transition-interactive focus-ring` (keyboard accessibility)
- **Props interface, type variants, dan behavior:** tidak berubah

#### `app/login/page.tsx`
- ✅ Email & password inputs: `focus:outline-none focus:ring-2 focus:ring-blue/25 focus:border-blue transition-all duration-200` → `focus-ring focus:border-blue transition-interactive`
- ✅ Submit button: `transition-all duration-200` → `transition-interactive focus-ring hover-lift`
- ✅ Submit button shadow: `shadow-md shadow-blue/25` → `shadow-[var(--shadow-md)]`
- **Animation logic (framer-motion), validation, auth flow:** tidak berubah

### 3. Utility Classes yang Dipakai

| Class | Lokasi Definisi | Dipakai Di |
|---|---|---|
| `.focus-ring` | `app/globals.css` | Button, Modal, Login form |
| `.hover-lift` | `app/globals.css` | Button (primary/danger), Login submit |
| `.transition-interactive` | `app/globals.css` | Button, Modal, Login form |
| `.transition-smooth` | var(--transition-smooth) | Card, Modal |
| `.shadow-[var(--shadow-*)]` | `app/globals.css` | Modal, Login submit |

## Cara Rollback

```bash
cd /d/project/scm-tower
git reset --hard v0.2-restore-point-improve
```

Atau rollback selektif (mis. hanya komponen baru):
```bash
git reset --hard v0.2-restore-point-improve
# kemudian re-apply hanya perubahan komponen existing
git checkout HEAD -- components/ui/Button.tsx components/ui/Modal.tsx app/login/page.tsx
```

## Verifikasi

- ✅ TypeScript build: `npx tsc --noEmit` → exit 0, no errors
- ✅ Struktur project: tidak ada folder/route/function yang dihapus
- ✅ `package.json`: tidak ada dependency baru
- ✅ Design system palette: tidak diganti, hanya diperkuat konsistensinya
- ✅ Lucide-react icons: dipakai konsisten di seluruh project

## Yang Bisa Dilakukan Berikutnya (Phase 2)

1. Replace inline status badges di `app/(app)/dashboard/page.tsx` dengan `<StatusBadge>`
2. Tambah `<Card>` ke receiving/shipping pages
3. Tambah utility `.scrollbar-thin` untuk tabel
4. Tambah `.skeleton` untuk loading states
5. Apply design system ke halaman lain (vendor, reports, settings)
