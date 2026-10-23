import Country from 'country-state-city/lib/country.js';
import State from 'country-state-city/lib/state.js';

export const COUNTRIES = Country.getAllCountries().sort((first, second) =>
  first.name.localeCompare(second.name)
);

export function getStatesForCountry(countryName) {
  const country = COUNTRIES.find(item => item.name === countryName);
  if (!country) return [];

  return State.getStatesOfCountry(country.isoCode).sort((first, second) =>
    first.name.localeCompare(second.name)
  );
}

export async function getCitiesForCountryState(countryName, stateName) {
  const country = COUNTRIES.find(item => item.name === countryName);
  if (!country || !stateName) return [];

  const state = State.getStatesOfCountry(country.isoCode)
    .find(item => item.name === stateName);
  if (!state) return [];

  const { default: City } = await import('country-state-city/lib/city.js');
  return City.getCitiesOfState(country.isoCode, state.isoCode)
    .sort((first, second) => first.name.localeCompare(second.name));
}
