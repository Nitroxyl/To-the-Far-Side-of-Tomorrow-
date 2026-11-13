> **ARCHIVED — DO NOT USE FOR LIVE PLAY.** Santara now uses the V6 standard Pokémon damage and HP formulas. See [V6 Combat Guide](./combat-guide.html). V5.3 damage dice and tier multipliers are not active. Keep this document only for converting older saved records.

# Santara Combat V5.3 — Pokémon Level / D&D Level Progression

The V5.2 offense and defense tier table is retained. V5.3 adds predictable Pokémon-level scaling and a 1–20 D&D level equivalent, with no damage automation or dice rolling.

## Level conversion and proficiency

- D&D level = ceiling(Pokémon level / 5), capped at 20.
- D&D levels 1–4 (Pokémon 1–20): proficiency +2; levels 5–8 (Pokémon 21–40): +3; levels 9–12 (41–60): +4; levels 13–16 (61–80): +5; levels 17–20 (81–100): +6.
- Default universal AC = 11 + proficiency (+2 to +6, AC 13–17). A GM-set fixed AC from the existing `santara_battle_rules/v5_2` document overrides this value. No rules migration is required.
- The same proficiency bonus is shown for attack rolls. Attack rolls and damage are still calculated manually.

## Maximum HP

V5.3 default HP = floor[8 + (4 + floor(Base HP / 15)) × (1 + (Pokémon level – 1) / 5)].

Examples at Pokémon level 10: Lucario (base HP 70) = 30; Staraptor (85) = 33; Snorlax (160) = 47. At level 50: 94, 105 and 159, respectively. An evolved species uses its own Base HP on recalculation.

## Damage

Level multiplier = 1 + Pokémon level / 100 (level 10 ×1.10; 50 ×1.50; 100 ×2.00).

V5.3 damage = rolled move dice × existing physical/special offense tier × level multiplier × STAB × type effectiveness × existing physical/special defense tier.

Battle sheets display the individual level multiplier, the combined physical/special offense × level multipliers, the converted D&D level, proficiency, and effective AC. All actual move damage still uses manual dice and multiplication; there is no automated damage calculator.

## GM editing and existing Pokémon

- Newly fetched and assigned Pokémon use V5.3 HP as the default. Pending Trainer Pokémon requests use V5.3 HP.
- Existing stored Pokémon **retain their previous HP values**. Their displayed level scaling, proficiency and AC update automatically, but opening or viewing a record does not rewrite Firestore.
- GM → Trainer Pokémon → Edit Pokémon → **Recalculate HP (V5.3)** previews the new maximum and adjusts current HP by the change in maximum. The GM then clicks **Save Pokémon** to persist it. A fainted Pokémon at zero HP remains at zero HP.
- If the maximum HP was previously manually overridden, changing the level preserves the override. If the maximum matches the calculated V5.3 value, changing the level updates HP automatically and preserves the missing HP. The GM can always manually enter a different maximum or current HP for boss fights.
- Switching regional forms or reimporting species stats adjusts existing HP rather than automatically healing a damaged Pokémon.
- Mega assignment links are stored in `santara_pokemon_mega_assignments`, unchanged by V5.3. Dynamax continues to double displayed HP temporarily, with no change to stored HP.
- The original V4 helper remains available for comparing legacy records, but is **not used** in new Pokémon assignment.

## Deployment and testing

Both GM and Player repos use the identical `pokemon-math.js` calculation engine; both have V5.3 battle sheet UI. The GM also has the V5.3 editing controls. Regression tests cover levels, proficiency, AC override, HP examples, damage multipliers and HP adjustments.

No new Firestore fields, collections or security rules were required for this V5.3 change. The original Firestore battle rule document stays named `v5_2` to preserve existing GM overrides.

After GitHub Pages deploys, hard-refresh the Pokémon Party page in both editions. Test a level 10 Staraptor (33 recommended HP, D&D level 2, +2 PB, AC 13, level damage ×1.10), then use the GM Recalculate HP button and Save Pokémon to migrate an older record. Existing manually customized HP is intentionally not bulk-overwritten.
