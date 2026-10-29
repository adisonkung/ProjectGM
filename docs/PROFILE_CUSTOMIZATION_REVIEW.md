# Home and profile cosmetics — 2026-10-29

User scope: compact Home panels, zoom city out, square four-corner-chamfered profile art, contain detail rule, improve tower heading/progress/links contrast, Account decoration button with portrait/frame categories and four themes.

Reference: six original screenshots from user Archive.zip, inspected before edits. These show defects to correct, not a request to preserve their clipping. Existing visual reference rules were read. Decoration UI is new with no supplied target image.

Actual browser review: 1440×900, 1335×533, 390×844, DPR 2. All three routes home/tower/account plus decoration dialog captured. Test state CaraMelz, fresh game floor 0/10 versus original 3/10. Portrait and frame selection retained after reload. No page errors across all sizes. Square portraits remain inside equal corner cuts; chapter details stay contained. Added full viewport sky coverage after observing seams on initial zoom-out. Moved zoom controls from team. Account modal now covers navigation. Mobile dialog scrolls for all portrait choices and completion button.

Evidence delivered separately in docs/profile-review/review.html (paired original screenshots and actual screenshots, with original links), plus all three viewport captures. New frames are CSS-rendered island/gold-blue, Wuxia/jade, Fantasy/lavender, Dark Fantasy/obsidian-rose variations; aesthetic approval remains with user. No deploy/master merge.

Validation: app/spec TypeScript checks pass; 890/890 Karma tests pass including legacy save defaults, invalid cosmetic rejection, independent choices and export/progress preservation. Production build passes with configured font network access (existing size/CommonJS/template warnings retained). Initial sandbox-only build could not download Google Fonts; no source configuration was changed to bypass it.
