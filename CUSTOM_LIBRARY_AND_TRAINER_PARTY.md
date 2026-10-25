# Santara GM Custom Content Library and Trainer Card party sync

This update preserves existing Pokémon, Trainer Cards, custom species, Mega forms, moves, abilities and battle-progress data. No manual transfer of Pokémon is needed.

## GM: browsing and managing custom content

Open **GM Fieldwork → Trainer Pokémon → Browse Custom Content**. The library shows the current contents of four Firestore collections:

- **Species & forms** from `santara_species_overrides`
- **Mega Evolutions** from `santara_mega_forms`
- **Moves** from `santara_custom_moves`
- **Abilities** from `santara_custom_abilities`

Filter by kind or search names and effects. **Edit** opens the prefilled appropriate editor; **+ Add** opens a blank editor; **Delete** requests explicit confirmation. Existing species artwork survives a stat edit when no replacement is uploaded. You can also launch the existing **Import Santara presets** workflow from the library.

Deleting a template **never deletes an assigned Pokémon**. However, deleting a move or ability definition can remove its descriptive effects from already assigned Pokémon, because Pokémon link to definition names. Deleting a Mega catalog entry leaves already assigned private Mega snapshots unchanged. The confirmation includes a count of assigned Pokémon referencing the definition when possible. There is no automatic cascading deletion.

Renaming a record so that its slug changes is not supported in the editor; create a new definition if you want a new identity.

## Trainer Cards now show My Pokémon party

The Trainer Passport's **Registered Party** grid no longer relies on six manually typed names. Its slots come from each Pokémon's authoritative `slot` value in `santara_pokemon`:

- Slot 1–6 → matching numbered Trainer Card position, including nickname, level and species artwork
- Pokémon in storage (`slot=0`) → not displayed on the Trainer Card
- Empty party positions → show as empty
- Party swaps, captures and releases → reflected when their owner/GM's Pokémon Manager syncs the roster

The **Team** editor tab has become read-only, with a link to **My Pokémon**. Personal Trainer Card customization (colours, portrait, trainer title and motto) remains editable and is still saved to the existing `santara_trainer_cards` record.

Approved Trainers can view another Trainer's card without reading their private Pokémon records. A new `santara_public_parties/{trainerUid}` collection holds **only** party names, species, levels and public artwork. HP, status, abilities, moves, private notes, gimmick states and unrevealed Mega profiles are never copied into this public document.

The public party summary refreshes automatically when the GM or owner opens the Pokémon Manager and the collection changes. Opening your own Trainer Card also brings the summary up to date. A read-only viewer of another Trainer's card sees the most recently published summary rather than accessing private Pokémon data directly. A direct Firestore write outside these site workflows will not publish the mirror until the GM or owner opens their Pokémon Manager/Trainer Card.

## Deployment instructions (must follow order)

1. Open the **GM pull request** and copy its **full** `firestore.rules` from the feature branch into **Firebase Console → Firestore Database → Rules → Publish**. This grants approved players read access to `santara_public_parties` and restricts writes to the GM or the owning approved Trainer.
2. Merge the GM pull request and accompanying Player pull request. Wait for your normal GitHub Pages deployment.
3. Open GM Pokémon Manager, then Player My Pokémon, then the Player Trainer Card. Use the newly versioned sidebar links to avoid browser caching.
4. Test assigning two Pokémon to slots 2 and 5. Verify the Trainer Card shows them in those exact slots with artwork, nicknames and levels, while the remaining slots remain empty.
5. Move a Pokémon to storage; confirm it vanishes from the Card party. Verify a second approved player can view the card but **cannot** read or edit the owner's private Pokémon collection.
6. From GM **Browse Custom Content**, edit one custom move and verify its effects on a Pokémon sheet; delete a disposable definition and ensure assigned Pokémon weren't deleted.

Static module syntax, public-data projection, library rendering and Firestore delimiter integrity have been checked. Final live Firebase compilation and permission tests are required after the rule publication.
