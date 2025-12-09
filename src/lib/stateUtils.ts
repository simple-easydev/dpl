export interface StateCoordinates {
  [key: string]: { lat: number; lng: number };
}

export const stateCoordinates: StateCoordinates = {
  'Alabama': { lat: 32.806671, lng: -86.79113 },
  'Alaska': { lat: 61.370716, lng: -152.404419 },
  'Arizona': { lat: 33.729759, lng: -111.431221 },
  'Arkansas': { lat: 34.969704, lng: -92.373123 },
  'California': { lat: 36.116203, lng: -119.681564 },
  'Colorado': { lat: 39.059811, lng: -105.311104 },
  'Connecticut': { lat: 41.597782, lng: -72.755371 },
  'Delaware': { lat: 39.318523, lng: -75.507141 },
  'Florida': { lat: 27.766279, lng: -81.686783 },
  'Georgia': { lat: 33.040619, lng: -83.643074 },
  'Hawaii': { lat: 21.094318, lng: -157.498337 },
  'Idaho': { lat: 44.240459, lng: -114.478828 },
  'Illinois': { lat: 40.349457, lng: -88.986137 },
  'Indiana': { lat: 39.849426, lng: -86.258278 },
  'Iowa': { lat: 42.011539, lng: -93.210526 },
  'Kansas': { lat: 38.5266, lng: -96.726486 },
  'Kentucky': { lat: 37.66814, lng: -84.670067 },
  'Louisiana': { lat: 31.169546, lng: -91.867805 },
  'Maine': { lat: 44.693947, lng: -69.381927 },
  'Maryland': { lat: 39.063946, lng: -76.802101 },
  'Massachusetts': { lat: 42.230171, lng: -71.530106 },
  'Michigan': { lat: 43.326618, lng: -84.536095 },
  'Minnesota': { lat: 45.694454, lng: -93.900192 },
  'Mississippi': { lat: 32.741646, lng: -89.678696 },
  'Missouri': { lat: 38.456085, lng: -92.288368 },
  'Montana': { lat: 46.921925, lng: -110.454353 },
  'Nebraska': { lat: 41.12537, lng: -98.268082 },
  'Nevada': { lat: 38.313515, lng: -117.055374 },
  'New Hampshire': { lat: 43.452492, lng: -71.563896 },
  'New Jersey': { lat: 40.298904, lng: -74.521011 },
  'New Mexico': { lat: 34.840515, lng: -106.248482 },
  'New York': { lat: 42.165726, lng: -74.948051 },
  'North Carolina': { lat: 35.630066, lng: -79.806419 },
  'North Dakota': { lat: 47.528912, lng: -99.784012 },
  'Ohio': { lat: 40.388783, lng: -82.764915 },
  'Oklahoma': { lat: 35.565342, lng: -96.928917 },
  'Oregon': { lat: 44.572021, lng: -122.070938 },
  'Pennsylvania': { lat: 40.590752, lng: -77.209755 },
  'Rhode Island': { lat: 41.680893, lng: -71.51178 },
  'South Carolina': { lat: 33.856892, lng: -80.945007 },
  'South Dakota': { lat: 44.299782, lng: -99.438828 },
  'Tennessee': { lat: 35.747845, lng: -86.692345 },
  'Texas': { lat: 31.054487, lng: -97.563461 },
  'Utah': { lat: 40.150032, lng: -111.862434 },
  'Vermont': { lat: 44.045876, lng: -72.710686 },
  'Virginia': { lat: 37.769337, lng: -78.169968 },
  'Washington': { lat: 47.400902, lng: -121.490494 },
  'West Virginia': { lat: 38.491226, lng: -80.954453 },
  'Wisconsin': { lat: 44.268543, lng: -89.616508 },
  'Wyoming': { lat: 42.755966, lng: -107.30249 },
};

const stateAbbreviations: { [key: string]: string } = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'DC': 'District of Columbia',
};

const stateNameVariations: { [key: string]: string } = {
  'district of columbia': 'District of Columbia',
  'd.c.': 'District of Columbia',
  'washington dc': 'District of Columbia',
  'washington d.c.': 'District of Columbia',
};

export function normalizeStateName(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  const upperCased = trimmed.toUpperCase();
  if (stateAbbreviations[upperCased]) {
    return stateAbbreviations[upperCased];
  }

  const lowerCased = trimmed.toLowerCase();
  if (stateNameVariations[lowerCased]) {
    return stateNameVariations[lowerCased];
  }

  const titleCased = trimmed
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

  if (stateCoordinates[titleCased]) {
    return titleCased;
  }

  return null;
}

export function isValidState(stateName: string | null): boolean {
  if (!stateName) return false;
  return stateCoordinates[stateName] !== undefined;
}

export function getStateCoordinates(stateName: string): { lat: number; lng: number } | null {
  return stateCoordinates[stateName] || null;
}
