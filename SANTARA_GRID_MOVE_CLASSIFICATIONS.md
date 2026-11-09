# Santara V5.3 — Grid Movement and Move Classification

## Movement in normal encounters

Each Pokémon's **effective Speed base stat** determines how many squares it can move in a D&D-grid turn:

`Movement squares = min(12, 4 + floor(Speed / 30))`

One square is 5 feet. A Pokémon with 30 Speed moves 5 squares, 90 Speed moves 7, 142 Speed moves 8, and 151 Speed moves 9. The site displays movement on roster cards and battle sheets, including new Speed stats when a Pokémon is Mega Evolved. The value is a normal grid-movement allowance; battle-specific changes from Tailwind, paralysis and other effects must be applied by the GM if not represented in the saved effective Speed stat.

## Competitive move metadata

A local `pokemon-move-metadata.js` catalogue includes 954 moves from Pokémon Showdown's official battle move properties (source: https://github.com/smogon/pokemon-showdown/blob/master/data/moves.ts; snapshot 2026-11-09). The site uses those properties for move category (Physical, Special, Status), makes-contact flag, special move traits (Slicing, Biting, Punching, Sound, Pulse, Bullet, etc.), priority, and competitive target class. PokéAPI still provides type, power and accuracy whenever online.

For example, **Bitter Blade** is **Physical / Contact / Slicing** (and also has the Healing trait). **Rock Slide** is Physical / Non-contact / Spread against opponents. **Shadow Ball** is Special / Non-contact / Ballistic / Single target.

## Santara's house-rule grid ranges

- Contact single-target move: **1 square**.
- Non-contact single-target move: **8 squares**.
- Opposing spread (e.g., Rock Slide): pick a point within **8 squares**; affect eligible opponents within **2 squares** of that point.
- All-adjacent / local spread (e.g., Earthquake): **3-square radius centred on user**, includes allies when its target property allows.
- Self, ally, team, side and field effects are displayed by their actual target class. Ally-targeting moves default to 8 squares.
- Rare reactive moves are marked **GM ruling** instead of being given a made-up universal range.
- Grid movement/ranges only apply to ordinary D&D encounters. Major traditional Doubles use normal Pokémon targeting without square movement.

The category (Physical, Special, Status) does **not** decide range: contact and target properties do. Values are Santara tabletop translations, not distances from the official games.

## Custom moves

GM → Trainer Pokémon → Custom Move editor now has **Contact property**, **Target category**, and **Additional move traits** controls. Classifications appear automatically on the player's and GM's battle sheets. Existing custom moves without these fields show **Contact not set / Target not set** until the GM edits their definition; no flags are invented for them.

The GM repository's `firestore.rules` was extended to accept validated optional `target`, `contact`, and `traits` fields. **Publish the latest complete `firestore.rules` in Firebase Console → Firestore Database → Rules** before saving custom move classifications. Committing code to GitHub Pages does not publish Firestore rules. Official move flags and grid movement require no Firestore migration.

No automatic battle movement, target selection, damage calculation, or enemy search was added. Players and GMs continue running combat manually.
