export interface LocalProfileFields {
  company: string;
  phone: string;
  website: string;
  address: string;
  tagline: string;
}

const PROFILE_STORAGE_KEY = 'bp_profile_fields';

const EMPTY_PROFILE_FIELDS: LocalProfileFields = {
  company: '',
  phone: '',
  website: '',
  address: '',
  tagline: '',
};

export function readLocalProfileFields(): LocalProfileFields {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROFILE_FIELDS };

    const parsed = JSON.parse(raw) as Partial<LocalProfileFields>;
    return {
      company: typeof parsed.company === 'string' ? parsed.company : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      website: typeof parsed.website === 'string' ? parsed.website : '',
      address: typeof parsed.address === 'string' ? parsed.address : '',
      tagline: typeof parsed.tagline === 'string' ? parsed.tagline : '',
    };
  } catch {
    return { ...EMPTY_PROFILE_FIELDS };
  }
}

export function writeLocalProfileFields(input: LocalProfileFields) {
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(input));
}
