// Keep in sync with palette-presets.json, the portable native-app interchange source.
export const palettePresets = [
  {
    "id": "original",
    "name": "はじめの色",
    "colors": [
      "#eb8c91",
      "#edae83",
      "#dfc76e",
      "#b8c886",
      "#8bb89d",
      "#85c4bb",
      "#8abbd8",
      "#9aace0",
      "#b3a0d4",
      "#cb9fc6",
      "#dc9fb6",
      "#dfaaa0"
    ]
  },
  {
    "id": "garden",
    "name": "花と若葉",
    "colors": [
      "#e5a1ae",
      "#ebba9a",
      "#ead59d",
      "#c3d29b",
      "#9bbb98",
      "#8bbdb0",
      "#a5c8ce",
      "#b2bfd4",
      "#c4b1d2",
      "#dbafcc",
      "#e4b1bd",
      "#d8bca4"
    ]
  },
  {
    "id": "water",
    "name": "水と空",
    "colors": [
      "#d7abbc",
      "#cfbdce",
      "#c4c7d4",
      "#b3cdd1",
      "#9fcbbf",
      "#83bfc0",
      "#83b7ce",
      "#98b0d5",
      "#afacd3",
      "#c1b0d3",
      "#c9b6ca",
      "#c8bec0"
    ]
  },
  {
    "id": "twilight",
    "name": "夕暮れ",
    "colors": [
      "#d88c9c",
      "#e3a082",
      "#e5be89",
      "#cab994",
      "#a8b7a3",
      "#94b8b5",
      "#91abc4",
      "#9c9bc2",
      "#b59ac5",
      "#ca9aba",
      "#d6a2ad",
      "#cfab99"
    ]
  }
];
export function presetIdFor(colors){return palettePresets.find(p=>p.colors.every((c,i)=>c.toLowerCase()===colors[i]?.toLowerCase()))?.id||"custom";}
