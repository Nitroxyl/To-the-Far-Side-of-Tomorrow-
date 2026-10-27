# Independent Mega Evolution Assignments — 27 October 2026

This is the **current** implementation for attaching or removing a Mega form on an already registered Pokémon. It supersedes older descriptions of the **Save Mega form only** button.

## Why this was changed
The previous tool attempted to modify `santara_pokemon/{pokemonId}`, even when only linking Mega Charizard Z. Older Pokémon may contain fields or data that fail modern whole-record validation. Firestore then responds with `Missing or insufficient permissions`. The old diagnostic also falsely reported `Unexpected field: id` because `id` was local UI metadata, not part of the write.

## Current architecture
- `santara_pokemon/{pokemonId}`: keeps the original Pokémon, level, stats, HP, moves, owner, notes and party slot.
- `santara_pokemon_mega_assignments/{pokemonId}`: stores **only** `ownerUid`, a validated `megaForm` snapshot (or `null`), `megaActive`, and `updatedAt`.
- GM **Save Mega form only** writes **one independent assignment document**, never the old Pokémon document. Uploaded images that fail WebP/size rules are excluded from the assignment rather than blocking stat/ability linking.
- The GM and Player Pokémon Managers subscribe to the assignments and overlay `megaForm` and `megaActive` in memory for rendering. The underlying regular Pokémon stats are never overwritten.
- The **Mega Evolve / Revert** button updates only `megaActive` on that assignment record. Tera/Dynamax cannot activate while Mega is active; the player must revert Mega first.
- Older Pokémon that have a stored `megaForm` but no independent assignment still display the old form until the GM explicitly saves the isolated assignment. Mega activation requires the independent assignment record.

## Security
The new Firestore rule allows **only an authorized GM** to create, replace, or delete the assignment. It verifies the Pokémon exists, its owner UID matches, and the Mega's regular species matches the actual Pokémon.

An **approved owner** can read their own assignment and change **only** `megaActive` / `updatedAt`, and only if Mega Evolution is unlocked. Approved players cannot replace a form, base stats, artwork, ability or owner. The founding GM can act under the GM permission path.

## Required Firebase rollout
GitHub pushes update the website but **do not deploy database security rules**.

1. Copy the complete latest [GM `firestore.rules`](https://github.com/Nitroxyl/To-the-Far-Side-of-Tomorrow-GM-Edition/blob/main/firestore.rules) into **Firebase Console → Firestore Database → Rules**, then **Publish**. Verify it contains `match /santara_pokemon_mega_assignments/{pokemonId}`.
2. Reload both websites from their Fieldwork sidebars (the scripts are versioned).
3. Open **GM → Trainer Pokémon → your existing Charizard → Edit Pokémon**.
4. Select **Mega Charizard Z** and click **Save Mega form only**. The new assignment is stored separately without changing Charizard's base stats.
5. Ensure Mega Evolution is unlocked for that Trainer. On **Player → My Pokémon**, open Charizard and select **Mega Evolve**. Its Sp. Atk should change to the custom 200 benchmark; revert to restore regular stats.

If step 4 fails after publishing the new rule, copy the **new** message, which explicitly names `santara_pokemon_mega_assignments`. This is different from the earlier Pokémon-record denial. Do not create a new Firebase login or move Pokémon to another owner.

## Verification completed
The committed JavaScript was syntax-checked. Mocked actions confirmed **Save Mega form only** writes a single separate document, **Mega Evolve** updates only that document, and applying Mega Charizard Z's snapshot changes displayed Sp. Atk to **200** while keeping regular Charizard's base Sp. Atk at **109**. Final Firebase production rules compilation and real signed-in write testing still require a live Firebase session.
