// Player-facing spoiler gate for unreleased Santara story forms.
// A GM assignment of the exact form is an intentional unlock for that trainer.
const normalize = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
export function isUnreleasedEclipse(value) {
  const fields = typeof value === 'string' ? [value] : [
    value?.slug, value?.key, value?.name, value?.speciesName, value?.speciesKey
  ];
  return fields.some(field => normalize(field).includes('yveltaleclipse'));
}
export function ownsEclipseForm(pokemon = []) {
  return pokemon.some(p => isUnreleasedEclipse(p?.speciesKey) || isUnreleasedEclipse(p?.speciesName));
}
export function playerVisibleCustomSpecies(species = [], pokemon = []) {
  const unlocked = ownsEclipseForm(pokemon);
  return species.filter(entry => !isUnreleasedEclipse(entry) || unlocked);
}
