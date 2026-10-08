# Project instructions

- Maintain one Core/UI for standalone preview and SillyTavern. Keep host differences in `host-adapter.js`.
- Sources: `preview.shell.html`, `styles.css`, `app.js`, `core.js`; build `preview.html` with `npm run build`.
- Preserve the source provenance and missing-art markers. Do not count edition variants as distinct species.
- Never send chats, call models, or install into a real host without direct user authorization.
- Validate changes with `npm test`. Browser rendering, actual ST behavior, and user acceptance remain separate evidence.
- Do not commit private machine paths, credentials, browser state, or unrelated historical research logs.
