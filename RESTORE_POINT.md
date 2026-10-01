# Restore Point

**Dibuat:** 2026-10-01
**Tag:** `v0.1-restore-point`
**Commit:** `e5cd9d2`

## Cara Rollback ke Sebelum Perubahan Design System

```bash
cd /d/project/scm-tower
git checkout v0.1-restore-point -- .
git reset HEAD -- .
```

Atau untuk rollback penuh termasuk commit:

```bash
git reset --hard v0.1-restore-point
```

> ⚠️ Perintah `git reset --hard` akan menghapus semua perubahan yang belum di-commit. Gunakan dengan hati-hati.

## Apa yang Berubah Setelah Restore Point

Setelah commit `v0.1-restore-point`, dilakukan integrasi UI/UX Pro Max dengan perubahan non-destruktif:

1. Folder `.codebuddy/skills/` (AI skill ui-ux-pro-max + design system)
2. Folder `design-system/scm-tower/` (MASTER.md hasil design system generator)
3. File `app/globals.css`:
   - Tambah import Google Fonts (Inter + JetBrains Mono)
   - Tambah design tokens (spacing, shadow, focus-ring, transition)
   - Tambah utility classes `.focus-ring`, `.hover-lift`, `.cursor-interactive`, `.transition-interactive`, `.font-mono-enhanced`
4. File `RESTORE_POINT.md` ini

Tidak ada perubahan pada struktur project, logic aplikasi, routing, database, API, atau komponen yang sudah ada.
