# Santara V5.2 Damage Calculator

The **Damage Calculator** is now available on **both the GM and Player Fieldwork websites** at `damage-calculator.html`. It can also be opened from the Fieldwork sidebar or directly from a Pokémon's battle sheet; the clicked Pokémon is preselected as the attacker.

## What it does

- Authenticates with existing Firebase Auth and reads the same live Pokémon, independent Mega assignments, battle-rule overrides and custom move records used by My Pokémon. **No new Firestore permissions or write collections are required**.
- The GM can compare any registered Pokémon (including players' Pokémon); the Player version only queries Pokémon owned by the signed-in Trainer. Either side can be a **manual Pokémon** for wild encounters or hypothetical opponents, with PokéAPI stat lookup for official species.
- Automatically reflects active **Mega Evolution, Tera type and Dynamax HP** through the existing `effectivePokemon` functionality. Our custom Mega Charizard Z uses its 200 Sp. Atk tier when active. GM-custom V5.2 offense and defense tables from `santara_battle_rules/v5_2` take priority over defaults.
- Looks up a chosen move's type, category, BP and accuracy from PokéAPI; **custom move** metadata and its saved damage dice come from `santara_custom_moves`.
- Displays minimum, average-dice estimate, maximum and optionally **rolled damage**, the relevant 20-point Attack/Sp. Atk and Defense/Sp. Def bands, complete multiplier breakdown, damage percentage of defender max HP, and possible/guaranteed KO based on current HP.
- Calculates Pokémon type effectiveness (including dual typing and immunities), standard/tera STAB, sun/rain, critical hits, Physical burn, Choice Band/Specs (+3 once per move), Life Orb (+2 once per move), and Santara's **Calamitous Sun** (removes Fire resistances, not immunities). A Guts user ignores the physical burn reduction.
- Has manual STAB/type override, custom multiplier and flat bonus for unusual abilities, field effects, and homebrew mechanics.
- Displays universal AC for reference using the campaign's GM-provided override, or `11 + PB` (with manually entered proficiency bonus). **It does not roll accuracy or determine hit/miss.**

## Formula

`Final Damage = roundOnce(Dice Total × Offensive V5.2 Tier × STAB × Type × Defensive V5.2 Tier × Weather × Crit × Burn × Other + Flat Bonuses)`

- The default rounding mode is **round down**, but the form allows **nearest whole number**. This is a calculator setting, not an assertion that the campaign has formally finalized a rounding direction.
- **Type immunities always deal zero damage**, even with flat bonuses.
- BP is informational. The V5.2 **official move damage-dice progression has not been finalized in the available campaign materials**. Therefore the tool does not fabricate dice from BP: users enter `3d8`, `2d10+2`, `15`, etc. Custom move records with a valid `dice` field populate automatically.
- The chosen dice expression produces min/average/max base rolls; **Roll damage dice** generates a roll and calculates its final damage without saving any HP change.
- For Tera: pre-Tera types retain ordinary STAB; Tera type gets STAB, or ×2 if it was already an original type. Adaptability is partially supported; use manual overrides for other ability interactions.
- Life Orb recoil, secondary effects, Protect, screens, unusual moves, spread damage, Z-Move/Dynamax move changes, enemy ability immunities, held-item lock effects and terrain are **not automatically resolved**. The GM can apply an override.

## How to use

1. Open **Fieldwork → Damage Calculator** in either website, or select **Calculate Damage** on a Pokémon battle sheet.
2. Pick an attacker from the registered Pokémon, or use manual/wild attacker. Players cannot browse other people's private Pokémon stats.
3. Pick a registered defender or **Manual / wild defender**. Enter its base stats and typing directly, or enter an official species name and select **Fetch species stats**. Set current/max HP to estimate a KO.
4. Choose one of the attacker's four moves, or type another move's name. Move type/category and metadata load automatically where available.
5. Enter the move's tabletop damage dice, or use its custom move's saved expression.
6. Adjust weather, critical hit, burn and any custom multipliers. Read the damage breakdown, or select **Roll damage dice** for an actual roll.

The tool is **read-only**: it never changes HP, applies status, spends items or advances turns. That comes later with the planned Battle Manager.

## Validation

Development checks covered V5.2 offensive/defensive math, GM multiplier overrides, matching types, immunity behavior, Calamitous Sun, Tera STAB, burn, weather, critical hit, damage dice parsing/rolling, custom Mega Charizard Z and both the GM and Player authenticated UI paths. Regression tests are in `tests/pokemon-damage.test.mjs`.

There is **no Firebase rules deployment required** for the calculator. Both repositories have been updated directly on `main`, with no pull requests.
