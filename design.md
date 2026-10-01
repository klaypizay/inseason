# InSeason.ai — Dashboard Design Direction

## 1. Design intent

InSeason.ai should feel like a calm, capable coaching command center: visual enough to understand at a glance, structured enough to trust during a busy season, and simple enough for a first-time coach to use without training.

The attached TripGuider dashboard is the primary layout reference. InSeason should borrow its strongest patterns:

- a persistent left navigation rail;
- a friendly, personalized top bar;
- a wide visual strip that communicates the current context;
- compact, bordered cards arranged in clear sections;
- one warm, highly visible primary action;
- dense information presented with generous spacing and rounded geometry.

The travel-specific content, floating project brief, carousel controls, and decorative social features should not be copied. Every section must support the InSeason loop: understand the season, prepare the week, run the next practice, record what happened, and adjust the plan.

## 2. Experience principles

1. **The next coaching decision comes first.** The dashboard should answer “What do I need to do next?” before showing history or secondary tools.
2. **Plans are connected.** Practice activities visibly connect to this week’s objective and the larger season goal.
3. **The coach stays in control.** AI output is always presented as a draft, recommendation, or proposed adjustment until the coach accepts it.
4. **Confidence is visible.** Known, likely, and unknown information use plain-language labels with source context; color is never the only indicator.
5. **Calm density.** Show useful information without turning the dashboard into analytics software. Favor short summaries, progressive disclosure, and one clear action per card.
6. **Court-side usability.** Important practice details must remain readable on a phone, in bright environments, and while moving.

## 3. Visual identity

### Brand character

Focused, encouraging, practical, and trustworthy. The interface should feel like a well-prepared assistant coach—not a sports-betting product, corporate BI dashboard, or youth-oriented game.

### Color system

Use the reference image’s white canvas and warm action emphasis, translated into the existing InSeason green identity.

| Token            | Value     | Use                                                      |
| ---------------- | --------- | -------------------------------------------------------- |
| `--ink`          | `#183B35` | Primary text, active navigation, primary buttons         |
| `--ink-soft`     | `#51665E` | Secondary text and metadata                              |
| `--canvas`       | `#F7F8F5` | Application background                                   |
| `--surface`      | `#FFFFFF` | Cards, sidebar, toolbar                                  |
| `--surface-tint` | `#EAF0E4` | Selected or grouped content                              |
| `--line`         | `#D8DED5` | Borders and dividers                                     |
| `--accent`       | `#D9EDB6` | Positive emphasis, selected controls, helpful highlights |
| `--action`       | `#E96F3D` | Primary “Create/Generate” action only                    |
| `--action-hover` | `#CF5C2F` | Primary action hover                                     |
| `--warning`      | `#A65A17` | Constraints or items needing review                      |
| `--danger`       | `#9A2D20` | Destructive actions and errors                           |

The orange action color is inspired by the reference dashboard’s “New Trip” button. It should be reserved for the single most important action in a view, such as **Plan next practice**. Standard save, accept, and navigation actions may use deep green.

### Typography

- Primary family: Geist Sans or Inter; fall back to `Arial, sans-serif`.
- Body: 16px / 1.5 on desktop; never below 14px for functional text.
- Page title: 32–40px, weight 650, slightly tight letter spacing.
- Section heading: 20–24px, weight 650.
- Card title: 15–17px, weight 650.
- Metadata: 12–14px, regular or medium.
- Avoid all-caps except for short 10–12px eyebrow labels.

### Shape, border, and depth

- Large panels: 16px radius.
- Standard cards: 12px radius.
- Buttons and fields: 9px radius.
- Use 1px borders on most surfaces.
- Shadows are subtle and limited to the top toolbar, menus, overlays, and the primary next-step card.
- Images use a 14–16px radius and a soft bottom gradient when text is overlaid.

### Iconography

Use a single outlined icon family with 1.75–2px strokes. Avoid emoji and mixed icon styles in the production interface. Icons must reinforce a visible text label unless the control is universally understood and has an accessible name.

## 4. Application shell

### Desktop structure

The reference layout is a fixed left rail plus a full-width working area. Adapt it as follows:

- **Sidebar:** 248px fixed width, white background, full viewport height.
- **Top bar:** 72px tall, sticky, white, with a bottom border.
- **Content:** fluid width with 24–32px gutters; cap dense dashboard content at approximately 1440px.
- **Main background:** soft off-white canvas so white cards remain distinct.

```text
┌──────────────────┬─────────────────────────────────────────────────────┐
│ InSeason         │ Coach greeting                    Help  Avatar       │
│ Your team.       ├─────────────────────────────────────────────────────┤
│ Your plan.       │ Season phase / team context strip                  │
│                  │                                                     │
│ PLAN & COACH     │ This week                         Next practice      │
│ ● Dashboard      │ ┌────────────────────────────┐    ┌───────────────┐ │
│   Season roadmap │ │ objectives + progress     │    │ date + action │ │
│   Practice plans │ └────────────────────────────┘    └───────────────┘ │
│                  │                                                     │
│ WORKSPACE        │ Upcoming schedule / plan cards                      │
│   Saved plans    │                                                     │
│   Team setup     │ Team pulse / recent observations / suggested edit   │
│                  │                                                     │
│ AI COACH         │                                                     │
│ Ask about plan   │                                                     │
│                  │                                                     │
│ Settings         │                                                     │
└──────────────────┴─────────────────────────────────────────────────────┘
```

### Sidebar

Top to bottom:

1. InSeason mark and the line “Your team. Your plan.”
2. **Plan & Coach:** Dashboard, Season roadmap, Practice plans.
3. **Workspace:** Saved plans, Team setup.
4. Optional folders, limited to the first eight with a “View all” link.
5. A compact AI Coach panel near the bottom with the prompt “What do you want help planning?” and one **Ask AI Coach** action.
6. Settings and sign out in the footer.

The active item uses a deep-green fill with white type. Inactive items are borderless; hover uses the pale green surface tint. The rail may collapse to 76px on medium desktop, preserving icons and tooltips.

### Top bar

Left side:

- mobile/sidebar toggle;
- coach avatar or initials;
- “Good afternoon, Coach {first name}”;
- one-line team context, for example “Lincoln 7th Grade · Week 5 of 12.”

Right side:

- Help;
- notifications only when the product has actionable in-app events;
- account/settings control;
- primary orange button: **Plan next practice**.

Do not display a generic “Plan ready” status. Status belongs to the specific roadmap, week, or practice it describes.

## 5. Dashboard page

### A. Season context strip

Replace the reference image’s travel-photo carousel with a four-card season strip. Each card represents a current or upcoming coaching context:

1. current season phase;
2. this week’s teaching focus;
3. next game or tournament;
4. next scheduled practice.

Cards may use restrained basketball photography or simple court diagrams. Never infer player identity, ability, attendance, or performance from imagery. Use licensed or original imagery with varied, realistic youth-coaching contexts; avoid professional-arena spectacle.

Each visual card contains:

- a short category label;
- a one-line title;
- date or progress metadata;
- a dark gradient behind overlaid text;
- a clear link target.

On desktop, show four cards in one row. On smaller widths, use a horizontal scroll area with visible partial overflow; do not use auto-rotation.

### B. This week

This is the main section and should visually parallel “Popular Trip Packages” from the reference.

Header: **This week** with a **View week plan** text link.

Use a 3-column grid of compact cards:

- **Primary objective:** the teaching priority and why it matters now.
- **Progress to look for:** two or three observable behaviors.
- **Constraints:** practice time, available players, court space, and equipment.
- **Scheduled sessions:** date, time, and duration.
- **Season connection:** the season goal this work supports.
- **Coach checkpoint:** one focused question to answer after practice.

Each card uses an icon or small diagram on the left, a title, and no more than three metadata lines. Unknown information should be shown explicitly as “Not recorded” with an action to add it.

### C. Next practice

Place a larger highlighted card beside or immediately below “This week.” It should contain:

- date, start time, and total minutes;
- practice objective;
- number of activities already planned;
- readiness state: Not started, Draft, Ready to coach, or Completed;
- primary action: **Plan next practice**, **Continue draft**, or **Open practice**;
- secondary action: Print / court view only when a practice exists.

Use the orange action color here. This must be the most visually prominent action on the dashboard.

### D. Upcoming schedule

Use a horizontal row or 2 × 3 grid of schedule cards, borrowing the reference’s compact package-card proportions. Each card includes:

- event type: Practice, Game, Tournament, or Off day;
- date and time;
- planned focus when applicable;
- duration;
- conflict or missing-information badge if needed.

The section header includes date navigation and a “See full roadmap” link. Do not build a full calendar into the dashboard.

### E. Team pulse

Adapt the reference image’s “Travel Partner” section into **Team pulse**. Show recent coach-entered observations, not player rankings or performance scores.

Each compact card includes:

- observation topic or player name, if the coach entered one;
- a behavior-specific summary;
- source and date;
- confidence label: Known, Likely, or Unknown;
- review state when the item is an AI interpretation.

Use initials or neutral avatar placeholders by default. Do not introduce player photos in the MVP.

### F. Suggested adjustment

Adapt the reference image’s weather panel into a four-step planning forecast:

1. **Keep:** what is working and should remain;
2. **Reinforce:** a concept needing another repetition;
3. **Watch:** a focused observation for the next session;
4. **Later:** work intentionally deferred to prevent overload.

This panel is explanatory, not predictive. Its heading should be **Suggested adjustment**, with a visible “Based on…” disclosure listing the coach observations and schedule changes that support it. An AI-generated proposal must offer **Review suggestion** rather than silently changing the active plan.

## 6. Secondary pages

### Season roadmap

- Retain the application shell.
- Use a horizontal phase selector followed by week cards.
- Each week card shows dates, objective, progress markers, scheduled events, and status.
- The current week receives a green outline and “Current week” label.
- Locked or coach-edited content has a visible lock label.
- Draft roadmaps carry a persistent “Draft — not in use” banner and one clear **Use this roadmap** action.

### Practice planner

- Start with a sticky practice summary containing the objective, date, duration, and total planned minutes.
- Present activities as a numbered timeline rather than disconnected cards.
- Each activity shows minutes, setup, teaching cues, likely mistakes, and progression/regression options.
- Keep AI generation controls in a separate “Planning studio” panel so generated content is not confused with saved content.
- Provide a high-contrast **Court view** that removes editing controls and enlarges time, activity name, and coaching cues.

### Saved plans

- Use reference-style compact bordered cards by default, with list/table options for higher density.
- Filters: plan type, folder, status, and date.
- Every item displays its type, title, date range, status, and last updated time.
- Folder management is secondary and must not dominate the page.

### Team setup

- Use a step-based form with a visible completion summary.
- Group fields into Team, Coach, Season, Schedule, Constraints, and Goals.
- Explain why a field is requested when it affects recommendations.
- Allow unknown values; never force invented answers to finish setup.

## 7. Components and states

### Buttons

- **Primary action:** orange fill, white text; one per view whenever possible.
- **Standard action:** deep-green fill, white text.
- **Secondary:** white or transparent, green border and text.
- **Tertiary:** text link with arrow.
- **Destructive:** reserved red styling and confirmation.

Minimum target size is 44 × 44px. Loading buttons retain their label width and add a spinner without shifting nearby content.

### Status badges

Status badges always contain text and use a soft background:

- Draft — neutral gray;
- Ready — pale green;
- Needs review — pale amber;
- Completed — green outline;
- Locked — ink outline with lock icon;
- Known / Likely / Unknown — distinct icon + label combinations.

### Empty states

Every empty state should explain:

1. what is missing;
2. why it is useful;
3. the single next action.

Example: “No practice is scheduled yet. Add your practice availability so InSeason can connect your roadmap to real dates.” Button: **Add practice schedule**.

### Loading and generation

- Keep existing plans readable during generation.
- Show a lightweight progress overlay with plain-language stages.
- Never imply that a draft has been saved or accepted until persistence succeeds.
- On failure, preserve the previous valid content and offer a retry.

## 8. Responsive behavior

### Large desktop: 1280px and above

- Fixed 248px sidebar.
- Four context cards across.
- Three-column weekly card grid.
- Team pulse and suggested adjustment share a row.

### Tablet / small desktop: 768–1279px

- Collapsible 76px icon rail or drawer.
- Two context cards visible with horizontal scrolling.
- Two-column weekly grid.
- Top-bar primary action keeps its text label.

### Mobile: below 768px

- Sidebar becomes a modal drawer.
- Top bar shows menu, page title, and avatar; the primary action moves into the page as a full-width button.
- Sections stack in this order: next practice, this week, schedule, team pulse, suggested adjustment.
- Context cards horizontally scroll with scroll snapping.
- Tables become cards; no essential action relies on horizontal scrolling.
- Court view uses large type, high contrast, wake-lock guidance where supported, and minimal controls.

## 9. Accessibility

- Meet WCAG 2.2 AA contrast targets.
- Provide a visible skip link and logical heading hierarchy.
- Keyboard focus uses a 3px high-contrast ring with at least 2px offset.
- All icon-only controls have accessible names and tooltips.
- Carousels never auto-advance; horizontal lists remain operable by keyboard.
- Do not communicate status, confidence, or errors by color alone.
- Respect reduced-motion preferences; transitions should be 120–200ms and non-essential.
- Form errors appear next to the relevant field and in a summary when submission fails.
- Dates and times follow the coach’s saved preferences and include unambiguous labels.

## 10. Content guidance

Use direct coaching language:

- “Plan next practice,” not “Generate session artifact.”
- “What to look for,” not “Success metric.”
- “Why this is suggested,” not “Model reasoning.”
- “Use this roadmap,” not “Activate.”
- “Not recorded,” not “No data.”

Avoid promises such as “optimal,” “winning,” or “guaranteed improvement.” Do not describe a player with permanent labels. Recommendations should connect to observable actions and clearly stated constraints.

## 11. Reference-to-product mapping

| Attached reference    | InSeason adaptation                            |
| --------------------- | ---------------------------------------------- |
| TripGuider logo rail  | InSeason navigation rail                       |
| User greeting         | Coach greeting + team/week context             |
| New Trip button       | Plan next practice                             |
| Travel photo carousel | Season context strip                           |
| Popular Trip Packages | This week / upcoming schedule cards            |
| Travel Partner        | Team pulse                                     |
| Weather Updates       | Suggested adjustment                           |
| AI Assistant prompt   | Ask AI Coach                                   |
| Project brief pop-up  | Omit; it is unrelated to the coaching workflow |

## 12. Definition of done for implementation

- The dashboard’s primary action is obvious within five seconds.
- A coach can identify the next practice’s date, objective, duration, and readiness without opening another page.
- Every AI-created item is distinguishable from accepted coach-owned content.
- Unknown information is explicit and actionable rather than hidden or invented.
- Navigation, cards, drawers, and horizontal lists work by keyboard and screen reader.
- Layouts are verified at 375px, 768px, 1024px, 1280px, and 1440px widths.
- Existing plans remain usable when AI generation is unavailable.
- The visual system is recognizably inspired by the attached dashboard while remaining clearly branded and purpose-built for InSeason.ai.
