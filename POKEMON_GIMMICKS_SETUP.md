# Santara — Trainer Gimmicks and Mega Evolution

This release adds per-Trainer progression unlocks and temporary Pokémon battle forms to the existing Pokémon Party Manager. Pokémon previously assigned to Trainers remain fully compatible.

## GM workflow

Open **GM Fieldwork → Trainer Pokémon**, then choose an approved Trainer in the dropdown.

1. In **Unlock Trainer gimmicks**, enable Terastallization, Z-Moves, Mega Evolution and/or Dynamax for that particular Trainer. Save the unlocks. All four start locked. This does not automatically tie unlocks to Gym milestones; the GM grants them when appropriate.
2. In **Registered Mega Evolutions**, click **+ Register Mega form**. Enter the regular Pokémon's **base species key**, such as `charizard` or `custom:spinotroleum`.
3. To import an official Mega, type its PokéAPI identifier (such as `charizard-mega-x`) and click **Import official stats**. Confirm the base species, name, six base stats, typings, ability and artwork, then save.
4. To define a *reworked* Mega, manually enter its six base stats, typings, ability and optional uploaded artwork, then save it. For instance, the custom Mega Charizard Z can use a 200 Sp. Atk stat. A unique Mega is reusable across different trainers' Pokémon.
5. Open an assigned *regular* Pokémon → **Edit Pokémon** → **Mega Evolution form**. Select a compatible saved Mega and save the Pokémon. Compatible means the form's `baseSpeciesKey` matches that Pokémon's `speciesKey`. This saves a private Mega-form snapshot on the owner's Pokémon record.
6. The same editor allows the GM to choose that Pokémon's initial **Tera Type**; an approved player can change it on their own sheet once Terastallization is unlocked.

When editing a Mega definition later, reopen each affected Pokémon and save its linked Mega form to refresh the saved snapshot. Previous assignments do not silently change mid-battle.

## Player workflow

Open **Player Dex → My Pokémon**, select a Pokémon and find **Battle mechanics**. Only mechanics unlocked by the GM are shown.

- **Tera Type:** choose any of the 18 Pokémon types; **Terastallize** and **Revert Tera** toggle the active type display.
- **Mega Evolve / Revert Mega:** available only if the GM has both unlocked Mega Evolution for this Trainer and assigned a compatible Mega form to that Pokémon. The Pokémon sheet recalculates **all six displayed base stats and the V5.2 offense/defense multipliers** using the Mega's values. It also changes the displayed typing, ability and art, and reverts to the original species on demand. The original Pokémon base stats remain unmodified in Firestore.
- **Z-Moves:** **Mark Z-Move Used** and **Reset Z-Move** track use between battles. This is a usage toggle, not an automated damage calculation.
- **Dynamax:** **Dynamax** begins a three-turn counter; **Next Turn** decrements it. Displayed maximum and current HP double temporarily. **End Dynamax** and **Reset Dynamax** finish the state and restore normal displayed HP without changing stored base HP.

The manager prevents two different Pokémon owned by the same Trainer from actively Mega Evolving simultaneously. Trainers and their GM remain responsible for enforcing match-wide usage limits for other gimmicks and special formats. Using or cancelling a gimmick does not award or revoke it; only the GM controls unlocks.

**HP note:** standard Mega Evolution does not change maximum HP, and the app preserves the GM-set maximum HP across Mega transformations. If your custom Mega changes base HP, its displayed stat changes, but the GM must determine whether its maximum HP needs a separate house-rule adjustment. V5.2 damage tiers are calculated automatically; this is a tracking system, not a complete battle engine.

## Privacy and Firestore

Two new collections require the updated rules in the GM repository:

- `santara_trainer_gimmicks/{trainerUid}`: GM can create/update/delete an exact set of four Boolean unlock flags. The owning approved Trainer can read their own unlocks; cannot grant themselves any mechanics.
- `santara_mega_forms/{slug}`: **GM-only** read/write. Players cannot enumerate future Mega forms. A selected Mega snapshot is stored in `santara_pokemon/{id}.megaForm`, where only the Pokémon's owner and the GM can read it.

The existing `santara_pokemon` validation permits optional new fields (`teraType`, `megaForm`, `megaActive`, `teraActive`, `zUsed`, `dynamaxTurns`, `dynamaxUsed`) without requiring migration of existing Pokémon. Approved owners may change only their battle state fields when the corresponding gimmick is unlocked; **species, custom Mega base stats, level, moves and Mega form assignment remain GM-only**.

### Deployment sequence

1. Open the **GM pull request**, view `firestore.rules` from its **feature branch** and copy the **entire** file to Firebase Console → Firestore Database → Rules. Click **Publish** and confirm Firebase accepts it. GitHub Pages does not deploy rules.
2. Merge the matching GM and Player pull requests and allow the sites to deploy.
3. Reload the Pokémon Manager from each Fieldwork sidebar, which now uses versioned assets to bypass stale cached files.
4. Test with a disposable Pokémon and Trainer account first: unlock Mega, assign an official/custom Mega form, Mega Evolve, confirm different stats and typing, revert, change Tera type, and track Dynamax.
5. Verify that an approved player **cannot** grant themselves an unlock, replace Mega stats or fetch the GM-only Mega library.

Static JavaScript and rules-delimiter validation pass in development. Real Firestore permissions and browser behavior still require testing after Firebase publishes the security rules.
