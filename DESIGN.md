# GDZIEKIBEL.PL — Product Design System v1

Status: Approved direction for implementation  
Reference visual: `docs/design/reference/gdziekibel-approved-direction.png`

## 1. Design objective

Create a mobile web product that is recognisable from one screenshot and still behaves like a serious urgent utility.

The UI should look like **Warsaw street infrastructure with a sense of humour**, not a generic map template.

## 2. Experience hierarchy

Every screen follows this priority:

1. **What should I do now?**
2. **Where is the toilet?**
3. **Can I use it?**
4. **How far is it?**
5. **What else should I know?**
6. **Brand joke / personality.**

Never reverse this hierarchy for visual flair.

## 3. Layout baseline

### Primary viewport

Design mobile-first around widths 360–430 px.

### Safe-area handling

Respect:

- iOS top safe area,
- browser chrome variation,
- bottom home indicator,
- dynamic viewport height.

Use `dvh` where appropriate rather than assuming fixed `100vh`.

### Grid

- 4-column mobile grid.
- 16 px default horizontal page padding.
- 8 px base spacing unit.
- Critical CTA can span full content width.

### Spacing scale

Recommended tokens:

- `space-1`: 4
- `space-2`: 8
- `space-3`: 12
- `space-4`: 16
- `space-5`: 24
- `space-6`: 32
- `space-7`: 48
- `space-8`: 64

Avoid arbitrary spacing unless required by the map or safe areas.

## 4. Colour system

Use CSS variables and semantic aliases.

### Raw palette

- `ink-950`: `#0B0B0B`
- `paper-50`: `#F5F2EA`
- `paper-0`: `#FFFFFF`
- `signal-yellow`: `#FFD800`
- `hot-pink`: `#FF3D8D`
- `status-green`: `#9BEA88`
- `status-red`: `#FF6B5F`
- `status-orange`: `#FFB547`
- `muted-500`: `#767676`
- `line-200`: `#D8D5CE`

These values are v1 implementation targets, not immutable brand law. Adjust only after accessibility contrast checks.

### Semantic tokens

- `bg-primary`: paper
- `bg-inverse`: ink
- `text-primary`: ink
- `text-inverse`: paper
- `action-primary`: signal yellow
- `accent-editorial`: hot pink
- `status-open`: green
- `status-closed`: red
- `status-uncertain`: orange

### Rule

Hot pink is an editorial accent, not a default interactive colour.

## 5. Typography

Do not bind the implementation to a paid font before licensing is confirmed.

### Roles

#### Display / poster

A bold or condensed grotesk with Polish diacritics.

Characteristics:

- narrow to medium width,
- heavy weight,
- uppercase capable,
- strong numerals,
- readable at 40–72 px.

Use for:

- hero,
- campaign punchlines,
- large distance numbers,
- section labels.

#### UI sans

A highly legible sans with complete Polish glyph support.

Use for:

- body,
- labels,
- metadata,
- forms,
- buttons,
- accessibility text.

### Suggested fallback-safe implementation

Use a high-quality open-source sans at foundation stage and keep font tokens abstract so the exact family can change later without layout rewrites.

### Type scale

Mobile recommendation:

- Display XL: 56/52, 800–900
- Display L: 40/40, 800–900
- H1: 32/34, 800
- H2: 24/28, 800
- H3: 20/24, 700
- Body L: 18/26, 500
- Body: 16/24, 450–500
- Small: 14/20, 500
- Meta: 12/16, 600

Large display text may intentionally use tighter leading.

## 6. Shape language

The product should feel constructed, not bubbly.

### Cards

- 0–12 px radius depending on context.
- Critical map sheets can use 16–20 px top corners for ergonomic mobile behaviour.
- Avoid excessive pill cards.

### Buttons

Primary CTA:

- signal yellow,
- black text,
- bold label,
- minimum 52 px height,
- full-width where action is primary.

Secondary:

- white/paper background,
- black 1–2 px border,
- 48–52 px height.

Danger/destructive actions use semantic red, not pink.

### Borders

Use assertive 1–2 px lines. A thick border can be used as an editorial motif, but not on every component.

## 7. Iconography

Style:

- simple black pictograms,
- thick consistent stroke,
- legible at 16–24 px,
- visually closer to signage than emoji.

Required icons:

- toilet,
- user location,
- walking/navigation,
- wheelchair,
- baby changing,
- unisex,
- paid/free,
- clock/opening hours,
- report/warning,
- list,
- filters,
- close,
- retry.

Do not use emojis as primary product icons.

## 8. Map visual language

### Basemap

Prefer a muted dark or desaturated map style so toilet markers dominate.

Do not remove essential street labels.

### User location

- familiar blue location dot,
- accuracy halo only if useful,
- never brand-colour this so heavily that it becomes ambiguous.

### Toilet marker

Default marker:

- compact toilet/signage pictogram,
- high contrast,
- visible at small size.

States:

- recommended: signal yellow or hot-pink emphasis,
- available/open: functional green cue,
- uncertain: orange/neutral cue,
- known closed: de-emphasised or red with reduced priority.

Selected state must be visually obvious beyond colour, e.g. scale + outline.

### Marker clustering

If needed at low zoom, clusters must show count clearly. Avoid custom clustering before dataset density proves it necessary.

## 9. Primary screens

## 9.1 First open / hero

Purpose: explain value and get permission fast.

Composition:

- dark background or strong poster treatment,
- logo small at top,
- huge headline,
- one short supporting line,
- one primary CTA anchored low,
- optional editorial illustration/poster element.

Recommended copy:

`CHCE CI SIĘ SRAĆ?`

`Znajdziemy coś. Szybko.`

CTA:

`GDZIE JESTEM`

No carousel. No onboarding steps. No feature tour.

## 9.2 Location permission

Use a light, utilitarian screen.

Elements:

- simple location icon,
- direct headline,
- one explanation,
- primary CTA,
- secondary manual-map option,
- privacy hint.

Avoid fake OS permission UI. The web page requests permission only after user action.

## 9.3 Main map

The map is the main surface.

Top area:

- compact wordmark,
- optional menu/info action.

Map overlay:

- filter chips only if they fit without crowding,
- selected marker.

Bottom sheet collapsed state:

- label: `NAJBLIŻSZY SENSOWNY KIBEL`,
- large distance,
- approximate walking time,
- status badges,
- CTA.

The sheet should not cover so much map that orientation is lost.

## 9.4 Toilet detail sheet

Information order:

1. name/identifier,
2. distance + ETA,
3. opening status + price,
4. primary CTA,
5. accessibility/features,
6. hours,
7. confidence/source hint,
8. report issue.

Example:

`TOALETA MIEJSKA — PLAC DEFILAD`

`240 M · ~3 MIN PIESZO`

`OTWARTY` `ZA DARMO`

Primary:

`PROWADŹ MNIE`

Supporting punchline below button:

`ZANIM BĘDZIE ZA PÓŹNO.`

## 9.5 List view

Each row/card:

- name,
- distance,
- ETA,
- status,
- price,
- at most two key feature badges.

Sort defaults to recommendation ranking.

Do not create marketplace-style oversized cards.

## 9.6 Filters

Use a full-height sheet or dedicated screen.

Sections:

- `STATUS`
- `CENA`
- `DOSTĘPNOŚĆ`
- `UDOGODNIENIA`

Each control must support `unknown` semantics where relevant.

Primary CTA:

`POKAŻ WYNIKI (N)`

Secondary:

`WYCZYŚĆ`

## 9.7 Report issue

Simple single-screen form.

- issue radio list,
- optional note,
- submit.

No account.

After success:

`ZGŁOSZONE.`

`Może uratujesz komuś dupę.`

## 9.8 No results

Large simple icon/illustration + hard headline.

Recommended:

`NIC BLISKO.`

Body:

`W tym promieniu nie mamy nic sensownego.`

CTA:

`SZUKAJ DALEJ`

## 9.9 Location denied

Headline:

`NIE WIEMY, GDZIE JESTEŚ.`

Body:

`Bez lokalizacji możemy pokazać tylko ogólną mapę Warszawy.`

Primary:

`SPRÓBUJ PONOWNIE`

Secondary:

`OTWÓRZ MAPĘ WARSZAWY`

## 10. Bottom-sheet behaviour

Recommended states:

- collapsed preview,
- half-height detail,
- expanded full detail.

Rules:

- swipe/drag handle visible,
- keyboard does not trap controls,
- selected marker remains synced,
- sheet content remains accessible to screen readers,
- body/map scroll locking must be tested on iOS Safari.

## 11. Motion

Motion should be fast and useful.

Use:

- 120–220 ms transitions for simple UI,
- spring-like but controlled bottom-sheet movement,
- marker selection scale,
- subtle loading transitions.

Avoid:

- cinematic intros,
- long logo animations,
- parallax,
- unnecessary map flyovers,
- effects that delay the CTA.

Respect `prefers-reduced-motion`.

## 12. Loading design

Preferred pattern:

- show layout immediately,
- map shell loads progressively,
- skeleton/placeholder for nearest result,
- direct status line such as `SZUKAM KIBLA…`.

Do not use blocking full-screen spinners after the first interaction unless there is no usable partial state.

## 13. Error design

Two-layer error copy:

1. brand punchline,
2. literal explanation/action.

Example:

`COŚ SIĘ WYSRAŁO.`

`Nie udało się pobrać listy toalet.`

`SPRÓBUJ JESZCZE RAZ`

## 14. Accessibility design rules

- Minimum 44x44 px touch targets.
- Visible focus state.
- Text contrast must meet WCAG AA for normal copy.
- Status badge uses icon/text + colour.
- Map has equivalent list representation.
- No critical meaning in texture/pink annotation.
- Bottom sheets maintain logical focus order.
- Headings are semantic, not only visual.

## 15. Desktop behaviour

Desktop is secondary but must not look broken.

Recommended layout:

- full-screen map,
- fixed left/side panel 360–440 px for list/details,
- same visual system,
- no attempt to create an unrelated desktop dashboard.

## 16. Component inventory for implementation

Foundation components:

- `BrandWordmark`
- `PrimaryButton`
- `SecondaryButton`
- `IconButton`
- `StatusBadge`
- `PriceBadge`
- `FeatureBadge`
- `BottomSheet`
- `ToiletMarker`
- `UserLocationMarker`
- `ToiletPreviewCard`
- `ToiletDetail`
- `ToiletListItem`
- `FilterChip`
- `FilterSection`
- `EmptyState`
- `ErrorState`
- `LoadingState`
- `ReportForm`

Do not build all of these in TASK-001. Create them only when a vertical slice needs them.

## 17. Visual QA checklist

Before accepting a screen:

- Does the core action dominate?
- Can a user read distance/status in one glance?
- Does the UI still work without the joke?
- Is there one main accent, not five?
- Does the map remain readable?
- Are unknown values visibly different from false/closed?
- Are touch targets large enough?
- Does the screen resemble the approved reference direction without copying its incidental mockup errors?

## 18. Approved reference vs implementation truth

The approved reference image is a **creative direction**, not a pixel-perfect specification.

Implementation must preserve:

- visual energy,
- hierarchy,
- typography scale,
- black/yellow/off-white palette,
- street-poster personality,
- direct map utility.

Implementation must not preserve accidental mockup inaccuracies, invented places, fake copy, or non-functional UI from the concept image.
