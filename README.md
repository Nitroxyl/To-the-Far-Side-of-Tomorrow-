# Santara Fieldwork — GM Console

This is the standalone GM edition. It is independent of the player's website.

## Upload / deploy

1. Extract the ZIP and upload `index.html` to the root of your GM site/repository.
2. Keep `README.md` for instructions; it is not required by the site.
3. Open `index.html` to use the dashboard.

## PRIVACY: IMPORTANT

This HTML contains all unrevealed locations, future requests, encounters, and plot spoilers in the source code. **Never publish it on an unrestricted public website or public GitHub Pages**, even if the source repository is private. A private GitHub repository by itself is *not* a password for the deployed Pages website. For online access, deploy only behind actual access control; otherwise keep it on your own computer.

## Data and player updates

- Saves are in the current browser's localStorage, **not** GitHub or Firestore.
- Before moving to a new browser/site origin, export a private GM JSON backup and reimport it after the move.
- Back up your data after sessions. Do not upload backup JSON to the public player repository.
- To give players new discoveries, use `Publish to players` to export `Santara_Player_Research_Update.json` and share **that export only**, not the private GM file.
- Separate sites do not automatically synchronize. Firestore has not been added.
