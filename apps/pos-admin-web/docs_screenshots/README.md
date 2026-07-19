# UI screenshots

Generated with preview mode (`VITE_UI_PREVIEW_MODE=true` via `.env.development`):

| File | Contents |
|------|----------|
| `terminal-enrol-preview.png` | Enrolment UI + sample code `AIDA-482731` |
| `pos-1366.png` | Aida Counter after preview staff login |
| `admin-overview-1440.png` | Aida Office overview after preview admin login |

Regenerate:

```powershell
npm run dev
node scripts/capture-preview-screens.mjs
```
