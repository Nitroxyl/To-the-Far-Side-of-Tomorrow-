# Pokémon Party Manager — rollout

This feature is staged on the `feature/pokemon-party-manager` branches of both Santara repositories. Existing fieldwork and Trainer Card data are left intact.

## What it provides

- GM assigns an official Pokémon to any **approved** Trainer. Fetch its six official base stats, typing, abilities and artwork from [PokéAPI](https://pokeapi.co/) by species name. Select level, current/max HP, ability, item, up to four moves, location obtained and party slot.
- GM can register reusable custom species/forms, including six base stats, typing, abilities and optional compressed WebP artwork upload. The custom species registry lives in Firestore.
- Pokémon instances have their own Firestore records. Evolution/form changes can be made in the GM editor by importing the new species without deleting the individual record.
- Every approved player sees only their own Pokémon. Trainers can save HP, status, nickname, personal notes and party/storage position. Occupied slots are swapped with a batched write; a party contains at most six active slots.
- The Player Pokémon page now offers **+ Request Pokémon**: pick an official or registered custom species, fetch its official stats, and send it to the GM. The GM sees **Pokémon requests**, can review and assign it (atomic approval plus Pokémon creation), or decline it. This prevents unauthorized changes to species/levels/moves.
- Move type, category, base power and accuracy come from PokéAPI when an individual Pokémon sheet is opened. Custom moves are displayed by name.
- Official base stats now automatically calculate the agreed V5.2 offensive and defensive multipliers without Firestore configuration. Stat tiers are 0–19, 20–39, … 180–199, 200–249 and 250+. Universal AC is **11 + proficiency bonus**; this is shown as a formula unless the GM enters a fixed AC override. The GM can optionally override the tier arrays in `GM Pokémon → Edit battle rules`.
- Maximum HP initially offers the *older V4 HP baseline* `6 + 3×level + floor(base HP/2)` solely as an editable starting value. Change the GM's HP field to the finalized V5.2 value whenever it differs. HP defaults re-preview when level changes; custom HP overrides remain under GM control.

## Firebase rules: REQUIRED before rollout

The **GM repo** contains the new `firestore.rules`. Copy its entire contents into the Firebase console → Firestore Database → Rules and **Publish**. GitHub commits/merges alone do not deploy rules. Existing publication, trainer approval and Trainer Card rules remain included.

New Firestore paths:

- `santara_pokemon/{id}`: GM owns species, levels, move set, ownership and HP limits; approved Trainers can only change current HP, status, nickname, notes and slot, and can only read their own records.
- `santara_species_overrides/{slug}`: approved members can read custom templates; GM writes them.
- `santara_battle_rules/v5_2`: optional GM overrides; built-in V5.2 multipliers work even before this document exists.
- `santara_pokemon_requests/{id}`: approved players create and view their own pending requests; only GM can review, approve or decline them.

Apply the rules **before** merging the site PRs, then merge/deploy both PRs. Player site has the source in the separate `To-the-Far-Side-of-Tomorrow-` repository (with a final hyphen). The URL without that hyphen currently redirects to the GM repository.

## Test procedure

1. Sign in on the GM website, open **Trainer Pokémon** in the sidebar, and select an approved Trainer in the dropdown.
2. Assign `Riolu`: click **Fetch stats**, confirm official base stats `40/70/40/35/40/60`, choose its level and party slot, then save.
3. Open the player site as that verified, approved Trainer; click **My Pokémon**, check the Party and Storage tabs and open Riolu's battle sheet.
4. Change current HP, status and nickname as the player; reload both sites and verify the updates persist. Try swapping two Pokémon between party slots.
5. As GM, register a new custom species or form and assign it; verify custom stats and uploaded artwork display on the player site.
6. Open Riolu's battle sheet and confirm V5.2 multipliers are **Atk ×1.20, SpA ×0.80, Def ×1.05, SpD ×1.05**, with **AC 11 + PB**. A GM override should replace only the overridden values.
7. As an approved player, click **+ Request Pokémon**, fetch Dreepy, and submit the request. In the GM console review and assign it; verify the player sees it immediately. Test rejecting another request.
8. Sign in as a different approved Trainer and verify they cannot see, modify, or query another player's Pokémon or requests. Verify unapproved or unverified accounts cannot access either.

## Notes

- This is stat importing and party management, **not a full battle automation engine**. Custom move dice, damage/typing resolution, held-item effects, and initiative conditions remain separate development work.
- Fetching an official species requires access to `https://pokeapi.co`; if unavailable the GM cannot import that species until the service is reachable. Already assigned Pokémon remain accessible in Firestore.
- Existing browser-local GM campaign notes are not uploaded to Firestore.
- Do not put unrevealed campaign descriptions inside the player-facing custom species names or images: approved Trainers can read the custom species template catalogue.
- This change does not modify Firebase Auth providers; players continue to use existing verified and approved accounts.

## Fixing "Missing or insufficient permissions" / infinite loading

If the Player Pokémon page displays a Firestore permissions error, the **live Firebase security rules** are missing the Pokémon collection rules. GitHub Pages cannot publish Firestore rules by itself. From the GM repository's `firestore.rules` file on this branch, **copy the complete rules file** to Firebase Console → Firestore Database → Rules → **Publish**. Then reload the Player and GM pages. The UI now shows a clear permissions panel instead of waiting forever when Pokémon collection access is denied. Optional combat override reads no longer block built-in V5.2 calculations.

Do **not** publish only the new rules snippet: that would remove existing access and Trainer Card permissions. The entire GM `firestore.rules` file is the source of truth.
