---
name: laptopshop-interface-design
description: Visual/interaction design methodology for Laptop Shop (adapted from the community "Interface Design" skill for dashboards/admin panels/internal tools — explicitly NOT a marketing-page skill, framework-agnostic). Load alongside laptopshop-ui whenever a page should look genuinely designed rather than like a generic Bootstrap template — new pages, dashboards, or any "make this look nicer" request. Pre-answers the exploration questions for THIS product so the design direction is consistent across sessions instead of reinvented each time.
---

# Laptop Shop — Interface design methodology

Adapted from the community "Interface Design" skill (dashboards/admin panels/SaaS
tools, not marketing pages — https://claudeskills.info/skills/aiskillstore/marketplace/interface-design/).
Its core warning applies directly here: an LLM has seen thousands of generic
Bootstrap dashboards in training, and the gravitational pull is toward
template-looking output unless you deliberately design *for this product*.
This file pre-answers its "required exploration" for Laptop Shop so every
session builds toward the same direction instead of drifting.

Pair this with `laptopshop-ui` (mechanics: EJS/Bootstrap patterns, security,
accessibility, the concrete CSS already in `public/css/app.css`) and
`laptopshop-backend`/`laptopshop-database` (the system this UI exposes).

## The exploration, already done

**Who is this human?** Not "a user" — four specific humans: a sales
employee approving/cancelling orders between phone calls, a warehouse worker
checking a goods-receipt against a stack of boxes (often on a tablet, not a
desk), an admin auditing who changed what, and a retail customer comparing
RAM/SSD compatibility before buying. Three of the four are *working*, not
browsing — speed and scanability beat delight.

**What must they accomplish?** Approve/cancel this specific order correctly.
Find this specific serial number among hundreds. Confirm this price is right
before charging a customer. Not "manage the system."

**What should this feel like?** A well-organized parts counter, not a SaaS
landing page: precise, labeled, nothing hidden behind an icon no one's sure
about, status always visible at a glance. Confidence through clarity, not
through decoration.

**Domain vocabulary** (use it in copy/labels, not generic "item"/"record"):
SKU, Serial/IMEI, tồn kho (QtyOnHand) vs. giữ chỗ (QtyReserved), bảo hành
(warranty), phiếu nhập (goods receipt), đơn hàng + trạng thái
(Pending/Approved/Completed/Cancelled), hoá đơn, nhà cung cấp (NCC), chuẩn
RAM/SSD tương thích, hạng thành viên (membership tier).

**Color world:** This product already has one, mostly by accident — keep it
and make it deliberate. A device retailer + warehouse operation lives in:
graphite/slate (device chassis, the admin "control center"), teal (circuit
traces, trust, the sales desk), rust/amber (cardboard, warehouse warmth,
the physical stockroom), plus the semantic greens/reds every inventory
system needs for in-stock/low-stock/out-of-stock. The existing per-role
sidebar colors (`panel-admin` slate `#1f2937`, `panel-staff` teal `#0f766e`,
`panel-warehouse` rust `#9a3412`) are *already this color world* — the
mistake would be flattening it into one generic Bootstrap-blue-everywhere
palette. Extend it; don't discard it.

**Signature** (one element nobody else would have): SKU, serial numbers, and
order/invoice/receipt numbers render in a monospace "part number" chip —
`font-family: var(--ls-mono); letter-spacing: .02em` on a faint tinted
background — the way a parts catalog or shipping label treats an identifier,
not plain inline text. Paired with each role's primary-action color actually
matching its sidebar accent (teal buttons on staff pages, rust on warehouse,
slate/graphite on admin — not generic Bootstrap blue everywhere), this reads
as "a real inventory system" instead of "a Bootstrap starter kit."

**Defaults to reject for this interface type:**
1. Generic Bootstrap-blue primary button on every page regardless of role —
   defeats the whole point of the color-coded areas.
2. Plain black-on-white data tables where status is only a tiny badge buried
   in a column — for a workflow that's 80% "what state is this order/serial
   in," status needs to be scannable at a glance (row-level tint or a
   consistently-positioned badge, not just text).
3. Flat, shadow-less "admin template #4312" look — a touch of real depth is
   what signals "this is a distinct, cared-about workspace" in an app with
   four visually-separated areas; business-as-usual flatness undermines the
   one thing (role separation) this app already does well.

## Craft rules to hold the line on

- **One depth strategy, applied everywhere:** this project uses *subtle
  shadows* (`--ls-shadow-sm/md/lg` in `app.css`), not borders-only and not
  heavy layered/premium shadows. Don't mix — a page with hard 1px borders
  next to a page with soft shadows reads as two different products.
- **Squint test:** before shipping a new page, blur your eyes (or just
  glance away and back). You should still see where sections divide and what
  sits above what. If everything merges into one gray field, the hierarchy
  isn't there yet.
- **Spacing:** stick to Bootstrap's own 4px-based spacing scale
  (`.p-1`…`.p-5`, `.g-3`, etc.) and the rhythm already in the layouts
  (`container py-4`, `p-4` panel content, `mb-3`/`mb-4` between sections).
  Inconsistent one-off `margin: 13px` style values are the clearest sign of
  no system — don't introduce them.
- **Border radius:** one scale, `var(--ls-radius-sm)` (.5rem) for buttons/
  inputs, `var(--ls-radius)` (.75rem) for cards — already defined in
  `app.css`. Don't invent a third radius for a new component.
- **Typography:** headings stay Bootstrap's default weight/scale (this is a
  data tool, not an editorial site — don't go hunting for a display font).
  The one deliberate typographic move is **data in monospace**: SKUs,
  serials, order/invoice numbers, and anything meant to be scanned
  column-by-column (prices in a table) should use a monospace/tabular-nums
  treatment so digits line up — see the `.part-no`/`.tabular-nums` utility
  classes in `app.css`.
- **Animation:** fast (120–350ms), `var(--ls-ease)` easing, never a bouncy/
  spring curve — already the rule in `app.css`; keep new motion inside that
  range. This is a tool people use all day; motion should feel instant, not
  showy.
- **States:** every interactive element needs default/hover/active/focus —
  **never remove Bootstrap's focus ring** (`:focus-visible` outline) for
  aesthetics; several users of this app are on a warehouse tablet with a
  keyboard/scanner, not just a mouse. Every data view needs an explicit empty
  state (already a `laptopshop-ui` rule) and should visibly distinguish
  loading state from "genuinely zero rows."
- **One accent per screen's focal action.** A page can use its role's accent
  color for the primary action, plus semantic green/amber/red for status —
  don't add a second decorative accent color competing for attention (e.g.
  no gradient text, no rainbow chart palette) unless it's carrying real
  meaning (a chart series, a status).

## Before shipping a new page, check

- Would this page be visually distinguishable from a generic Bootstrap admin
  template if you removed the Laptop Shop logo? If not, it's missing the
  signature (role accent color + monospace identifiers) above.
- Did you reuse the existing depth strategy, radius scale, and spacing
  rhythm, or invent new ones?
- Does every status (order, payment, stock, serial) read at a glance, not
  just on hover/click?
- Does it still work with a keyboard only (focus states intact)?
