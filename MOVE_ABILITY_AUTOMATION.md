# Santara — Move & Ability Automation

The battle action utility is at **Fieldwork → Move & Ability Automation** or **My Pokémon / Trainer Pokémon → Pokémon → Battle Actions**. It runs in both GM and Player apps and **does not restore the removed damage calculator**.

## What is automated
- Select an already registered Pokémon and one of its four known moves, or select its *currently active* ability (including a Mega form's ability).
- Choose an effect target from available Pokémon. The GM can use any registered Pokémon, including a rival or Gym opponent. Players only see their own team and **cannot execute enemy-target effects**; GM handles those.
- For moves/abilities with built-in or GM-saved profiles, confirm the action and automatically update **status conditions, fixed HP healing or HP loss, Attack/Defense/Sp. Atk/Sp. Def/Speed/Accuracy/Evasion stages**.
- Record moves used, finite maximum uses, optional cooldown turns, and each Pokémon's turn counter. Stat stages are capped at -6 to +6. **Next turn** advances the selected Pokémon's counter, while **Reset stages/uses** resets counters/stages without changing HP/status.
- Status/HP updates go to the existing `santara_pokemon/{pokemonId}` record; volatile stages, usage counts and turns are in `santara_combat_state/{pokemonId}`. A move use and its effects are saved together in one Firestore batch, so a rejected write cannot leave a half-applied action.
- A profile can combine up to four effects, each with a separate chance (1–100%). Configure effect recipients as user or selected target.

**Important:** A GM/Player must explicitly use the move or trigger the ability; the app does **not** continuously watch battle events. Before clicking Apply, confirm accuracy, type/ability immunity, Protect, terrain and legal target distance yourself. The action profile's 100% effect chance means it triggers *after a successful hit*, not that the attack is guaranteed to connect. This is a combat bookkeeping helper, not a damage/accuracy simulation.

## Built-in example profiles
- **Moves:** Thunder Wave (Paralyzed), Will-O-Wisp (Burned), Toxic (Badly poisoned), Spore (Asleep), Swords Dance (+2 Attack), Nasty Plot (+2 Sp. Atk), Dragon Dance (+1 Attack and Speed), Calm Mind (+1 Sp. Atk and Sp. Def), Iron Defense (+2 Defense).
- **Abilities:** Intimidate (on entry, -1 target Attack), Speed Boost (turn end, +1 own Speed), Moxie (after knockout, +1 own Attack).

These are examples for **one selected target** and don't attempt to infer multi-target effects. Official move range, damage dice, special accuracy and full battle interactions are **not** guessed. An action without a profile displays a clear message rather than inventing effects.

## GM: create/edit your own automation profiles

Open **Battle Actions → GM automation library**, or follow **Custom Content Library → Configure move & ability effects**. You can add an automation profile for **any** official or custom move or ability, even before a Pokémon has learned it. Name matching attaches it automatically when a Pokémon later knows that move or gains that ability.

In the profile editor choose:
- **Move or Ability** and action name (same name as the Pokémon's registered move/ability).
- **Trigger event**: manual, on entry, turn start, turn end, after hit, or after knockout. The event is a reminder; **you press Apply when the event happens**.
- **Target category**, priority, grid range (0 = GM adjudicates), cooldown, and maximum uses (0 = unlimited).
- Up to **four structured effects**, each with type (status, heal fixed HP, fixed HP loss, stage change), user/selected target, chance, amount, stat and/or status.
- **Visibility**: Public (approved Trainers can use this profile) or GM only (protect unrevealed boss effects).

Saved profiles override built-in templates with the same name. Deleting a saved override restores the built-in behavior, if one exists. Existing custom move descriptions and dice remain in their original collections; structured automation profiles are separate, so no Pokémon migration is required.

## Firestore security and rollout

**This feature introduces two new Firestore collections and narrowly scoped HP/status update permissions.** GitHub commits do not deploy Firebase rules.

1. Copy **the entire latest GM `firestore.rules` file** from [the GM repository](https://github.com/Nitroxyl/To-the-Far-Side-of-Tomorrow-GM-Edition/blob/main/firestore.rules) into Firebase Console → Firestore Database → Rules, then **Publish**.
2. Reload both GM and Player Fieldwork sites using the newest navigation links.
3. On GM Battle Actions choose a Pokémon with Thunder Wave, choose a different opponent, and select **Apply action effects** after the move hits. Confirm status changes and the acting Pokémon's use counter.
4. On Player Battle Actions ensure you see only your Pokémon. Self/ally effects work for the owning approved Trainer; enemy effects are delegated to the GM.
5. Create a disposable GM-only custom ability profile; verify it is not returned by the Player public-profile query. Remove it when done.

Rules ensure only a GM can create/delete automation profiles, and approved players can edit only the battle states and HP/status of Pokémon they own. The GM can apply effects to opposing Pokémon. GM-only profiles are not listed to players.

## Deliberate limits
There is **no automatic damage formula, accuracy roll, passive-effect simulation, terrain/weather resolver, Pokémon target geometry, end-of-turn poison damage, move immunity resolver, or cross-Trainer player write access** in this first release. For those interactions, the GM adjudicates and can use an appropriate fixed HP or stage effect where desired. Fixed HP loss is an explicitly entered effect, **not** a replacement for Santara's move damage dice. Heal amounts and stat stage changes must follow the campaign's current rules.

This is a foundation for the eventual Live Battle Manager, not a replacement for that manager.

## Checks
Pure-effect and mocked UI tests cover status automation, HP bounds, stage caps, cooldowns, uses, ability triggers, GM cross-Trainer effect application, Player roster privacy, GM-only profile visibility and prevention of unapproved access. Firestore rules have been structurally checked, but publishing/compiling the rules and trying the live signed-in actions must be performed in Firebase.
