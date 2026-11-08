# Santara Trainer Bag and TM System

The GM and Player sites now each include a Trainer Bag & TMs page (inventory.html), linked from Fieldwork and Pokémon Party. Each bag belongs to a Firebase Auth UID and is shared across both editions via Firestore.

## What the GM can do

Select any approved Trainer, add custom named items with category, description and quantity, and adjust or remove stacks. Grant TMs by selecting Technical Machines and entering the move name (for example, Roost). The GM can teach TMs directly to Pokémon, approve player TM requests or reject them.

## What players can do

See their own assigned item quantities and notes, browse TMs, select one of their Pokémon and request that a TM be used. Players cannot mint, remove or consume items directly. Pending requests have no effect on the bag or Pokémon until GM approval.

## Inventory types

Poké Balls, Medicine, Battle items, Materials, Key items, Evolution items, Technical Machines and Miscellaneous. The freeform name and notes support Mega Stones, Tera Shards, Z-Crystals, fossils, crafting materials and other custom campaign items. General item use, trading and held-item equip are tracked manually for now.

## Teaching a TM

1. The GM grants TM · Roost or another TM to the Trainer.
2. Choose Teach TM on the GM site or Request TM use on the Player site.
3. Select the Pokémon and, if all four moves are occupied, select the move it should forget.
4. The app checks its form-specific and historical PokéAPI movepool, matching regional pre-evolutions, and GM custom species/move definitions. Ordinary TMs cannot teach Mega-exclusive custom moves.
5. Direct GM teaching or request approval uses one Firestore transaction: consume one TM, change exactly the Pokémon move list, and mark the request approved where applicable. A failure rolls back all related writes.

The TM system intentionally uses the campaign's cross-generation moves rather than only Scarlet/Violet or competitive legality. One TM is consumed on each teaching use as the current campaign inventory rule.

## Firestore collections and access

- santara_trainer_bags/{uid}: ownerUid, items map, updatedAt; GM writes, GM/owner reads. Each stack has ID, name, category, quantity, description and optional TM move.
- santara_tm_requests/{id}: pending request information for the player's own Pokémon, plus GM-approved/rejected status.
- santara_pokemon/{id}: GM TM teaching changes only moves and updatedAt; stats, held items, Mega assignment and ownership stay untouched.

## Required setup

Copy the complete latest firestore.rules file from the GM repository into Firebase Console → Firestore Database → Rules → Publish. The Player repository does not host Firestore rules, and committing to GitHub alone does not deploy them.

Source: https://github.com/Nitroxyl/To-the-Far-Side-of-Tomorrow-GM-Edition/blob/main/firestore.rules

After GitHub Pages updates, hard-refresh both sites and visit inventory.html. Grant a Potion and a TM from the GM site, verify the Player bag shows both, then test GM direct teaching and player request approval. No migration of existing Pokémon or Mega assignments is required.

## Safeguards

Items are limited to 9,999 per stack and 120 unique stacks per Trainer bag. TM requests do not reserve an item; approval will fail if another use consumed the last copy. The GM owns all inventory writes and teaching transactions; players cannot bypass those writes. The pure helpers and JavaScript were checked, but no live end-to-end Firebase test has been run in this environment.