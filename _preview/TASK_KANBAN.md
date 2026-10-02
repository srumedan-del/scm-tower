# 📋 Task: UI/UX Pro Max Integration ke SCM Tower — Kanban

**Status terakhir update:** 2026-10-02
**Assignee:** @tika + @Erwin
**Restore points:** `v0.1-restore-point`, `v0.2-restore-point-improve`

---

## 🟢 Done

- [x] **Restore point v0.1** (`e5cd9d2`) — sebelum install UI/UX Pro Max CLI
- [x] **Install CLI** `ui-ux-pro-max-cli@2.15.0` global
- [x** **Init skill CodeBuddy** → `.codebuddy/skills/` (7 skills terpasang)
- [x] **Design system generated** → `design-system/scm-tower/MASTER.md`
- [x] **Restore point v0.2** (`3967a25`) — sebelum improve komponen UI
- [x] **Design tokens** tambahan di `app/globals.css`:
  - Typography: `--font-sans` (Inter), `--font-mono` (JetBrains Mono)
  - Spacing: `--space-xs` … `--space-3xl`
  - Shadows: `--shadow-sm` … `--shadow-xl`
  - `--focus-ring`, `--transition-fast/normal/smooth`
- [x] **Utility classes** baru:
  - `.focus-ring`, `.hover-lift`, `.cursor-interactive`
  - `.transition-interactive`, `.font-mono-enhanced`
- [x] **Komponen baru** (`components/ui/`):
  - `Card.tsx` → `<Card>`, `<CardHeader>`, `<CardBody>`, `<CardFooter>`
  - `Badge.tsx` → `<Badge>`, `<StatusBadge>` dengan `SHIPMENT_STATUS_TONE` map
- [x] **Komponen upgraded** (non-destructive):
  - `Button.tsx` → `hover-lift` + `focus-ring` + `transition-interactive`
  - `Modal.tsx` → `border-t-blue`, lucide icons, `focus-ring`, `shadow-[var(--shadow-xl)]`
  - `Login page` → `focus-ring` + `hover-lift` + `transition-interactive` di semua input & submit
- [x] **Google Fonts** Inter + JetBrains Mono di-import via `@import` di globals.css
- [x] **TypeScript build** `npx tsc --noEmit` → exit 0, no errors
- [x] **Dokumentasi** → `IMPROVEMENTS.md`, `RESTORE_POINT.md`
- [x] **Commit** final → `3688bce`

---

## 🟡 In Progress

- [ ] **Verifikasi visual di browser** — server sudah siap di `http://localhost:3000`
  - ⚠️ Browser tool tidak tersedia di environment ini (butuh Chromium default)
  - **Action required:** Erwin buka `http://localhost:3000/login` di browser sendiri, cek:
    - Focus ring pada input (biru, 3px)
    - Hover-lift pada button (naik 1px + shadow)
    - Font Inter (teks lebih konsisten)
  - Jika CSS error masih muncul → hapus `.next`, restart dev server

---

## 🔴 Blocked / Known Issues

- **Browser tool error:** `RuntimeError: browser.use_real_profile is on, but your default browser is not a supported Chromium browser`
  - Solusi: gunakan RealVNC atau buka langsung di browser lokal
- **CSS error `@import rules must precede all rules`** — sudah diperbaiki (dipindah ke baris 3)
- **`.next` cache lama** — perlu `rm -rf .next` setelah perubahan CSS global agar error tidak persisten

---

## ⏭️ Backlog (Phase 2)

Priority berdasar dampak visual:

1. **Halaman lain** — terapkan utility classes ke halaman berikut (mirip login page):
   - `app/(app)/dashboard/page.tsx`
   - `app/(app)/receiving/page.tsx`
   - `app/(app)/shipment/page.tsx`
   - `app/(app)/shipment/budget-request/page.tsx`
   - `app/(app)/vendor/page.tsx`

2. **Ganti inline status badges** — gunakan `<StatusBadge status={row.status} />` di tabel dashboard/receiving/shipment

3. **Bungkus card-container** — gunakan `<Card>` di halaman detail (misalnya detail shipment, detail vendor)

4. **Utility tambahan** — tambahkan `.scrollbar-thin` untuk tabel scroll, `.skeleton` untuk loading states

5. **Accessibility audit** — pastikan semua interactive element memakai `.focus-ring` dan `aria-label`

---

## 🔄 Cara Rollback

Rollback penuh:
```bash
cd /d/project/scm-tower
git reset --hard v0.2-restore-point-improve   # sebelum improve
# atau
git reset --hard v0.1-restore-point           # sebelum install skill sama sekali
```

Rollback selektif (hanya file UI baru):
```bash
git rm components/ui/Card.tsx components/ui/Badge.tsx
git checkout HEAD -- components/ui/Button.tsx components/ui/Modal.tsx app/login/page.tsx app/globals.css
```
