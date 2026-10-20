# UI Component Styling Standardization

## Purpose
Maintain visual hierarchy and consistency across UI components by standardizing spacing, typography, and sizing conventions. This ensures intentional design decisions rather than inconsistent styling that appears accidental.

## Core Principles

### 1. Table Row Height Strategy
**Rule:** Use differentiated row heights to create visual hierarchy between header and data rows.
- **Header rows:** `px-4 py-2.5` (≈40px height) — minimum for comfortable reading
- **Detail/data rows:** `px-4 py-1` (≈20px height) — compact for content density
- **Rationale:** Larger headers establish column identity; smaller data rows maximize viewport capacity

### 2. Modal Content Hierarchy  
**Rule:** Inside modals, increase header prominence and reduce detail compactness.
- **Modal headers:** `px-3 py-2` with `font-bold`
- **Modal detail rows:** `px-3 py-0.5` (extremely compact for form tables)
- **Form inputs:** `px-3 py-1.5` — balanced touch target size

### 3. Typography Consistency
**Rule:** Apply a single typeface family per page with size/weight variations indicating hierarchy.
- **Font family:** `SF Pro` (not Inter) — use the system's preferred body font
- **Header text:** `text-xs font-bold uppercase tracking-[0.1em]`
- **Body text:** `text-xs font-medium` or `text-xs` (no monospace)
- **Warning:** Never mix font families within the same view (e.g., Inter + SF Pro)

### 4. Padding Scale
**Rule:** Use consistent horizontal padding across all cells, vary vertical only by semantic role.
- **Horizontal padding:** `px-3` or `px-4` (16–24px) — uniform across table
- **Vertical padding:** Scale by element type (header > detail > modal form)

## Common Patterns

### Standard Table Structure
```jsx
<table className="w-full min-w-[980px] whitespace-nowrap text-xs">
  <thead className="sticky top-0 z-10 bg-[#F8FAFC]">
    <tr>
      <th className="px-4 py-2.5 text-left font-bold uppercase tracking-[0.1em]">Header</th>
    </tr>
  </thead>
  <tbody className="divide-y divide-[#EEF0F4]">
    <tr>
      <td className="px-4 py-1 text-sm">Data</td>
    </tr>
  </tbody>
</table>
```

### Modal Section Headers
```jsx
<h3 className="text-xs font-bold uppercase tracking-wide text-text mb-3 flex items-center gap-2">
  <Icon className="h-4 w-4" />
  Section Title
</h3>
```

## Decision Flow

1. **Identify element semantic role** → header, data row, form input, label
2. **Apply height rule** → use standardized padding for that role
3. **Verify consistency** → check adjacent columns use same vertical alignment
4. **Remove width constraints** → header text should be bold, not monospace

## Pitfalls

- **Don't:** Mix `py-1` and `py-2` randomly — creates uneven baseline grid
- **Don't:** Use `font-mono` for non-code identifiers — breaks visual hierarchy
- **Don't:** Change font families mid-page — confuses user's eye
- **Do:** Test by viewing on actual screen at 100% zoom — pixel-perfect spacing matters for tables with many rows

## References
- Receiving table implementation: `components/receiving/ReceivingTable.tsx`
- Modal component: `components/receiving/PtrDetailModal.tsx`