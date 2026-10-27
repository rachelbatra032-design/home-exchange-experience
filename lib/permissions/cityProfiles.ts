export type ProfileShape = {
  city: string;
  tier: number;
  enabled: boolean;
  policeIntimation: boolean;
  counselNote: string;
  apartmentRequires: string[];
  houseRequires: string[];
};

export const DEFAULT_CITY_PROFILES: ProfileShape[] = [
  {
    city: "Mumbai",
    tier: 1.2,
    enabled: true,
    policeIntimation: true,
    counselNote:
      "BMC has been considering a licence for paid short stays. This desk collects the society letter and writes a police-intimation pack. It does not claim a municipal lodging licence.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
  {
    city: "Delhi",
    tier: 1.2,
    enabled: true,
    policeIntimation: true,
    counselNote:
      "Some police stations expect a guest intimation. The host records that they filed the pack. The stay is not held back for a police acknowledgement.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
  {
    city: "Bengaluru",
    tier: 1.2,
    enabled: true,
    policeIntimation: false,
    counselNote: "An apartment needs a society letter in date. An independent house needs the association rule that applies to it.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
  {
    city: "Hyderabad",
    tier: 1.2,
    enabled: true,
    policeIntimation: false,
    counselNote: "An apartment needs a society letter in date. An independent house needs the association rule that applies to it.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
  {
    city: "Pune",
    tier: 1,
    enabled: true,
    policeIntimation: false,
    counselNote: "An apartment needs a society letter in date. An independent house needs the association rule that applies to it.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
  {
    city: "Goa",
    tier: 1.3,
    enabled: false,
    policeIntimation: true,
    counselNote: "Goa stays closed until counsel sets the tourism-registration rule.",
    apartmentRequires: ["SOCIETY_NOC", "SOCIETY_MAINTENANCE"],
    houseRequires: ["ASSOCIATION_DECLARATION"],
  },
];

export function permissionTypesFor(
  profile: ProfileShape,
  home: { kind: "APARTMENT" | "INDEPENDENT"; hasAssociation: boolean },
): string[] {
  if (home.kind === "APARTMENT") return profile.apartmentRequires;
  if (home.hasAssociation) {
    return profile.houseRequires.map((type) =>
      type === "ASSOCIATION_DECLARATION" ? "SOCIETY_NOC" : type,
    );
  }
  return profile.houseRequires;
}
