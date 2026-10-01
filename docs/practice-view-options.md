# Practice ordering and view options

Coaches can reorder unlocked drills by dragging a card or using the earlier/later arrow controls. Reordering is a local draft edit until the coach chooses **Save draft** or **Use this practice**. If any drill is locked, ordering is disabled until the coach unlocks and saves it; this preserves the existing rule that generated revisions cannot silently move protected content.

The practice toolbar offers four views that also control printing:

- **Flow** keeps the coaching cards and expandable instructions.
- **Table** puts time, activity, coaching focus, and setup in scan-friendly columns.
- **Condensed** keeps the timeline, titles, and primary cues on fewer pages.
- **Detailed** expands setup, easier variation, purpose, and resource needs.

The selected view is presentation-only and is not sent to the server. Reordering uses existing bounded practice blocks, immutable version saves, session ownership checks, exact-duration validation, and locked-content protection. No dependency, new external endpoint, HTML injection, or additional personal data is introduced. React renders all coach and model text as text nodes. Notion OAuth and export remain on the existing encrypted-token flow; the production project contains all three required Notion environment variables.
