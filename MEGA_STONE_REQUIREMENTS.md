# Mega Stone equipment requirement

Mega Evolution now requires all of the following:
1. The GM has unlocked **Mega Evolution** for the Trainer.
2. The GM has assigned a compatible Mega form to the Pokémon.
3. The GM has saved the **Required Mega Stone** name on that specific assignment.
4. The Pokémon's real **Held item** matches the required stone (case-insensitive, whitespace-trimmed).

The Mega Evolve button is disabled while any prerequisite is missing. The Pokémon **keeps its assigned Mega form** even if it lacks the stone. A Pokémon that is already Mega-Evolved can always select **Revert Mega** (including if its held item was changed afterward).

## GM workflow
- **GM Fieldwork → Trainer Pokémon → choose Pokémon → Edit Pokémon.**
- Choose its Mega Evolution form. The editor suggests a stone name: **Mega Charizard X → Charizardite X; Y → Charizardite Y; custom Z → Charizardite Z**. Official Mega names have recommended standard names; the Required Mega Stone field is editable for Santara-specific custom stones.
- Save the form with **Save Mega form only**. This stores the required stone in the GM-managed `santara_pokemon_mega_assignments/{pokemonId}` document even if the Pokémon isn't currently holding it. This DOES NOT modify its permanent Pokémon data.
- To equip, click **Equip required Mega Stone** beside the Held item field. This updates only the Pokémon's held item and timestamp, avoiding full-record rewrites on legacy Pokémon. The GM can instead edit Held item normally and save the Pokémon if desired.
- When registering a new Pokémon in the main GM form, a selected Mega form and required stone are saved in the independent assignment after the new Pokémon has been created.

An older Mega assignment without a `requiredStone` value must be opened once and saved again with **Save Mega form only**. The Player button will show an explanatory message instead of allowing the old assignment to bypass the new requirement.

## Security and Firebase
The updated `firestore.rules` adds `requiredStone` (up to 80 characters) to the independent Mega assignment schema and enforces the same held-item check *server-side* whenever a Trainer attempts to set `megaActive=true`. The name must match `santara_pokemon/{pokemonId}.heldItem` after trimming and lowercasing.

The GM alone can set/replace the required stone or Mega form. A Trainer may only toggle the active state of their own assigned Mega, after unlocking Mega Evolution and equipping its matching stone. Founding/delegated GM accounts can also toggle Megas on their own Pokémon when unlocked. Players cannot use the old main-Pokémon `megaActive` update path as an alternative. The GM's single-purpose **Equip required Mega Stone** is also protected by a narrowly scoped rule that permits only a held-item/timestamp change.

**GitHub pushes do not publish Firestore rules.** Copy [the entire current GM rules file](https://github.com/Nitroxyl/To-the-Far-Side-of-Tomorrow-GM-Edition/blob/main/firestore.rules) into Firebase Console → Firestore Database → Rules → Publish. Confirm Firebase accepts it, then reload GM and Player Pokémon Managers.

This change has been pushed directly to `main` in both repositories. JavaScript syntax, stone-name lookups, disabled/active/revert UI cases, single-purpose GM held-item updates and independent Mega assignments were verified with mocked tests. Live production permission tests must occur after the latest rules are published.
