import { SearchFilter, SearchScope } from '../types.js';

export function getSearchParams(
  filter: SearchFilter | null,
  scope: SearchScope | null,
  ignoreSpelling: boolean
): string | null {
  const filteredParam1 = 'EgWKAQ';
  let paramsVal: string | null = null;
  let param1: string | null = null;
  let param2: string | null = null;
  let param3: string | null = null;

  if (filter === null && scope === null && !ignoreSpelling) {
    return null;
  }

  if (scope === 'Uploads') {
    paramsVal = 'agIYAw%3D%3D';
  }

  if (scope === 'Library') {
    if (filter !== null) {
      param1 = filteredParam1;
      param2 = getParam2(filter);
      param3 = 'AWoKEAUQCRADEAoYBA%3D%3D';
    } else {
      paramsVal = 'agIYBA%3D%3D';
    }
  }

  if (scope === null && filter !== null) {
    switch (filter) {
      case 'Playlists':
        paramsVal = 'Eg-KAQwIABAAGAAgACgB';
        if (!ignoreSpelling) {
          paramsVal += 'MABqChAEEAMQCRAFEAo%3D';
        } else {
          paramsVal += 'MABCAggBagoQBBADEAkQBRAK';
        }
        break;

      case 'FeaturedPlaylists':
        param1 = 'EgeKAQQoA';
        param2 = 'Dg';
        param3 = ignoreSpelling ? 'BQgIIAWoMEA4QChADEAQQCRAF' : 'BagwQDhAKEAMQBBAJEAU%3D';
        break;

      case 'CommunityPlaylists':
        param1 = 'EgeKAQQoA';
        param2 = 'EA';
        param3 = ignoreSpelling ? 'BQgIIAWoMEA4QChADEAQQCRAF' : 'BagwQDhAKEAMQBBAJEAU%3D';
        break;

      default:
        param1 = filteredParam1;
        param2 = getParam2(filter);
        param3 = ignoreSpelling ? 'AUICCAFqDBAOEAoQAxAEEAkQBQ%3D%3D' : 'AWoMEA4QChADEAQQCRAF';
        break;
    }
  }

  if (scope === null && filter === null && ignoreSpelling) {
    paramsVal = 'EhGKAQ4IARABGAEgASgAOAFAAUICCAE%3D';
  }

  return paramsVal ?? (param1! + param2! + param3!);
}

function getParam2(filter: SearchFilter): string {
  switch (filter) {
    case 'Songs':
      return 'II';
    case 'Videos':
      return 'IQ';
    case 'Albums':
      return 'IY';
    case 'Artists':
      return 'Ig';
    case 'Playlists':
      return 'Io';
    case 'Profiles':
      return 'JY';
    case 'Podcasts':
      return 'JQ';
    case 'Episodes':
      return 'JI';
    default:
      return '';
  }
}
