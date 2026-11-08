# Regional and alternate Pokémon forms + accurate move learnsets

The GM and Player Pokémon pages now use PokéAPI's **species varieties** and **per-variety Pokémon learnsets**, not a single generic Pokémon entry for every form.

## GM: assigning a form
1. Open **Trainer Pokémon → Assign Pokémon**.
2. Enter `Growlithe` in **Species / Form**, then click **Fetch stats from PokéAPI / custom list**.
3. A **Regional / alternate form** selector appears for any species with supported permanent varieties. Choose **Growlithe (Hisuian)** to import its own Fire/Rock typing, base stats, abilities, artwork and official move suggestions.
4. The selector also handles Alolan, Galarian, Paldean and non-regional variants such as Rotom's appliance forms and special default records like Aegislash-Shield when exposed as PokéAPI varieties.
5. **Mega, Gigantamax, Primal, Totem and temporary battle-only forms** are excluded from the ordinary form selector. Mega Evolution remains controlled through the separate Mega field and stone mechanics.
6. The Pokémon's four move slots now display only its **specific imported form's official PokéAPI move list**, plus custom moves explicitly eligible for that species/form.
7. Switching forms refreshes the base stats, abilities, HP baseline, artwork and eligible moves. Existing moves that are not legal on the new form are cleared from the *editing draft*, not secretly changed on saved Pokémon. Review and save the final form to commit it.

You can also enter an exact PokéAPI form ID such as `growlithe-hisui` directly. Friendly labels such as **Growlithe (Hisuian)** can be used when fetching stats again.

## Player: requesting a form
Open **My Pokémon → Request Pokémon**, enter **Growlithe**, fetch its stats, and select **Hisuian** in the same form selector. Requests save the exact variant ID (e.g. `growlithe-hisui`) so the GM receives the requested form and the correct stats on approval.

## Exclusive custom moves
The old issue was that every custom move was added to every Pokémon's learnset. That has been removed.

In **GM → Custom Content → Define/Edit custom move**, you can now set:
- **Eligible Pokémon species/form IDs**, comma-separated. For example, `growlithe-hisui` means Hisuian Growlithe only, not regular Growlithe. For Santara custom species, use `custom:spinotroleum`.
- **Required assigned Mega form** (optional). For example, `mega-charizard-z` means the Pokémon must have that form assigned for the move to appear in the four-slot editor. Actual move use in battle remains a GM ruling.
- An explicit **`*` wildcard**, but only for moves intended for every species. It cannot be combined with a required Mega.

Custom moves with no eligibility list **do not appear in any Pokémon's learnset** by default. Saved legacy versions of **Infernal Sweep**, **Schradebreaker**, and **Schrade's End** retain a compatibility restriction to **Charizard + assigned Mega Charizard Z** even before their Firestore definitions are updated. Likewise, Tar Rend, Riptide Bite and Faultline Gore are respectively scoped to Spinotroleum, Mosasord and Carnotremor.

The editor also **validates manually typed moves on Save**, so bypassing a dropdown cannot assign a foreign Pokémon's signature move. Existing Pokémon records are not silently deleted or rewritten; if an older Pokémon has an invalid move, that must be corrected the next time its GM registration is saved.

### Custom Santara species' ordinary moves
In **GM → Custom species editor**, there's a separate **Official moves this custom species may learn** field (comma/newline-separated). Use it for ordinary moves such as Tackle or Protect. Exclusive custom moves should instead be authorized with the custom-move eligibility fields.

The existing custom Pokémon catalogue defaults to an empty ordinary learnset until the GM supplies one. The old behavior of granting *every custom move* has been removed.

## Implementation and rollout

- New shared logic: `pokemon-forms-learnsets.js`.
- Existing `pokemon-math.js` now retains the base species ID when importing a variant.
- GM registration and Player requests support form selection.
- GM custom move definitions now optionally include `allowedSpeciesKeys` and `requiredMegaSlug`.
- GM custom species definitions now optionally include `knownMoves`.
- The new fields are optional in Firestore Rules to preserve existing imported records; no mass migration of trainer Pokémon occurs.
- `santara-catalog.js` includes eligibility scopes on newly imported signature moves and preserves legacy fallback behavior.

**Firebase rules must be published separately from the GitHub pushes.** Copy the [entire latest GM `firestore.rules` file](https://github.com/Nitroxyl/To-the-Far-Side-of-Tomorrow-GM-Edition/blob/main/firestore.rules) to Firebase Console → Firestore Database → Rules → Publish. This enables saving the new learnset metadata.

No independent combat engine, damage calculator or automation has been added. Move learning remains based on the Pokémon's general PokéAPI moves list across games, not an inferred Santara level-by-level progression or per-generation legality check. The GM still decides appropriate moves for a given level.

## Checks
Mocked PokéAPI lookups cover Growlithe/Hisuian Growlithe, alternate default forms such as Aegislash-Shield, the exclusion of temporary Mega and battle-only forms, per-variety official learnsets and explicit custom-move eligibility. The actual GM Save method rejects an invalid hand-typed Infernal Sweep for Growlithe and accepts it when Mega Charizard Z is assigned to Charizard. Live Firebase publishing and browser interaction still need checking on the deployed sites.
