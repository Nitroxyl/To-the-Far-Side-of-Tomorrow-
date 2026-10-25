# Pokémon Registration Improvements

Both websites retain the same Firestore Pokémon document format. Existing party and storage records do not need migration.

## GM experience

The **Assign Pokémon** screen now has **four independent, searchable move inputs** (Move 1–4). Each uses the selected official Pokémon's PokéAPI learnset and all registered custom moves. You can leave a slot empty when a Pokémon knows fewer than four moves; duplicate moves are rejected. Already-assigned official Pokémon retrieve their learnset again when edited.

The Trainer selector now displays each approved player's **Trainer Card name** from `santara_trainer_cards`, not their email address. Accounts without a completed Trainer Card show a neutral identifier (`Trainer #xxxxxx`).

The GM party screen has **+ Custom Move** and **+ Custom Ability** buttons. You can also open either editor while assigning a Pokémon. An unfinished assignment is retained when you return. Definitions include:

- **Custom move:** name, type, Physical/Special/Status category, optional base power/accuracy, optional D&D damage dice notation, and an effect/range/targeting description.
- **Custom ability:** name and description of its tabletop effects.

To set up **Spinotroleum**, first register its custom species and up to three available abilities (independent fields). Save its custom ability description, then register its signature moves. Finally, assign it to a Trainer; the move and ability autocomplete fields will include the new definitions.

Existing definitions may be updated by entering/selecting the same name in an editor. The editor fills in the saved values for revision. Each assigned Pokémon's battle sheet looks up the descriptions from the latest catalog, without requiring the Pokémon instance to be recreated.

## Firestore Rules — deploy before merging the websites

The GM repository's updated **`firestore.rules`** grants approved players read-only access to:

- `santara_custom_moves/{slug}`
- `santara_custom_abilities/{slug}`

Only the campaign GM account can create, change or remove definitions. These fields are kept separate from Pokémon-instance documents, so the existing owner permissions remain intact.

**Important:** The GM repository's earlier `main` rules file contained three malformed regex validators. The complete `firestore.rules` in this feature branch repairs them. Always copy the **entire file from this feature branch**, not `main` or the previously damaged version, into **Firebase Console → Firestore Database → Rules → Publish**. Firestore Rules do not deploy automatically from GitHub Pages or from a merged pull request.

After Firebase accepts the rules, merge both related PRs. Then reload both Pokémon websites from their Fieldwork sidebars.

## Verify after deployment

1. GM opens Trainer Pokémon, confirms approved players are shown by Trainer Card name.
2. GM fetches an official Pokémon (e.g. Riolu), independently fills Move 1–4 using autocomplete, and assigns it. Reopen the Pokémon and verify each move persists.
3. GM creates a custom ability named `Apex Predator` and a custom move named `Primordial Crush` with power, dice and an effect description, then adds them to a custom Pokémon's sheet.
4. The owning Trainer sees the Pokémon's ability effect and custom move description on their personal battle sheet.
5. Verify another approved Trainer cannot modify species, level, abilities, move definitions or someone else's Pokémon. Unapproved accounts should not read the catalogs or Trainer Cards.
6. Update an existing custom move definition; verify the revised description appears on assigned Pokémon sheets.

JavaScript syntax and mocked UI flows were tested; the Firebase Console remains the authority for security-rule compilation and access checks.
