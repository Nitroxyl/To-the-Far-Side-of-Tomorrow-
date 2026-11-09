# Santara Trainer Move Memory — Player / GM Guide

## What is unlocked versus equipped?

Every Pokémon has **four active move slots** and its own persistent **Move Memory**. Active moves can be swapped outside combat without consuming items, provided the Pokémon has already unlocked those moves. Move Memory belongs to an individual Pokémon, not to the Trainer's account or to its species.

### Players

1. Open **Player Dex → My Pokémon**, select your Pokémon, then choose **Manage Moves / Remember Moves**.
2. The first time, the system safely records only the Pokémon's four existing GM-assigned moves. It cannot grant new techniques.
3. Use the four selectors to equip any remembered moves, leaving unused slots empty if desired. Click **Save equipped moves**.
4. Egg Moves, tutor moves, unused TMs and unearned level-up moves cannot be equipped just because they exist in the species' learnset. The GM must unlock them through the appropriate method first.

### GM

1. Open **GM Fieldwork → Trainer Pokémon**, choose a Trainer, then open one of their Pokémon and select **Manage Moves / Remember Moves**.
2. **Unlock move**: enter a name (the official/custom learnset offers suggestions), choose **GM unlocked / Egg training / Tutor / TM taught / Evolution / Level-up**, then save. The move becomes available to the Trainer; it is not automatically equipped.
3. **Revoke**: remove an unlocked move. If equipped, it is removed from the Pokémon's active slots in the same transaction.
4. **Unlock reached level-up moves**: consult the exact form's historical level-up requirements and grant the moves with a required level no higher than the Pokémon's current level.
5. **Assign Pokémon / edit its level**: a GM save automatically adds reached level-up moves, assigned moves and any preserved old move history. Genuine evolution preserves previously learned moves; replacing the Pokémon with an unrelated species does not.

## Learning methods

| Method | First acquisition | Free to re-equip later? |
| --- | --- | --- |
| Level-up | GM assignment/level update, or GM's "Unlock reached level-up moves" | Yes |
| TM | Consume one compatible TM via the Trainer Bag; GM completes or approves teaching | Yes |
| Egg | Hatched with the move, or complete Mirror Herb training (with a suitable tutor) and GM grants it | Yes |
| Tutor | Complete GM-approved tutoring, then GM grants it | Yes |
| Evolution / reminder | GM confirms special requirement and grants it, or it was already remembered | Yes |
| GM story exception | GM explicitly grants the move | Yes |

**Egg training house rule:** The learner must be compatible with the Egg Move, train with a Pokémon that already knows it, possess a Mirror Herb and complete one short-rest training session. The GM validates the requirements and grants the Egg Move. This system records the unlock; it does not automatically verify the role-play session or consume the Herb.

## What the eligibility checker actually does

- Official level-up unlocks use **PokéAPI's level_learned_at** for the Pokémon's current form, scanning historical version data and taking the earliest level. Egg, tutor and machine moves **do not** count as level-up moves.
- A pre-evolution's level-up move is not freely granted to the evolved form. If learned before evolution and recorded in Move Memory, it is retained.
- The TM system checks the real **machine/TM** source for official Pokémon (across supported generations), not simply whether the Pokémon could ever learn that move by breeding or leveling. A pre-evolution-only TM is not first-time teachable to an evolved form.
- Custom species do not yet have source-tagged learnsets. Their GM-curated `knownMoves` entries serve as their TM compatibility list; special moves can always be manually granted after GM review.

## How it is secured

Firestore collection: `santara_pokemon_move_memory/{pokemonId}`

Each record contains `ownerUid`, `speciesKey`, `unlockedMoves`, `sources`, and `updatedAt`. The GM can change grants, while the Trainer can **only create their initial memory from the exact currently equipped moves** if the document does not already exist. Trainers cannot add new memory entries, grant TMs, or approve Egg training. Trainers can edit the Pokémon's four `moves` values only when every selected move exists in their stored Move Memory. All other Pokémon properties remain protected.

GM grants/revocations and player move swaps use Firestore transactions. TM teaching now writes the bag, active Pokémon moves, and Move Memory in **one transaction**, preventing partial unlocks or item consumption. TMs are not consumed again when the move is selected from Move Memory.

### Deployment

**Required:** Copy and publish the GM repository's complete latest `firestore.rules` at Firebase Console → Firestore Database → Rules → Publish. Merely updating GitHub Pages does not deploy Firestore security rules. Both GM and Player sites must use the same Firebase project.

Once both sites deploy, hard-refresh **Pokémon Party** and **Trainer Bag & TMs** using Ctrl + Shift + R. On an old Pokémon, open Manage Moves to seed its existing moves. After that, use the GM panel to sync level-up access or grant an Egg/Tutor move. Check that the Player can swap remembered moves but cannot add unearned moves or edit their levels.

**Existing forgotten moves:** Before this update the app did not track move history, so previously forgotten TM/Egg moves cannot be reconstructed automatically. The GM may re-grant known legitimate moves.

The source includes tests and static validation, but a live Firebase end-to-end test is still required after rule publication.
