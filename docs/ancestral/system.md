# Growtopia Ancestral Artifacts — System Reference

Facts about the Ancestral items *as a game system*, sourced from the
Growtopia Wiki (growtopia.fandom.com). This complements
`docs/rendering-spec.md`, which covers how they render.

## The five families

| Family | Mod | Base effect | Per level | Max (L6) |
|---|---|---|---|---|
| [Totem of Wisdom](https://growtopia.fandom.com/wiki/Ancestral_Totem_of_Wisdom) | Extra XP... | 5% chance of double XP | +1% | 10% |
| [Lens of Riches](https://growtopia.fandom.com/wiki/Ancestral_Lens_of_Riches) | Extra Wealth... | 5% chance of extra gems when breaking blocks | +1% | 10% |
| [Tesseract of Dimensions](https://growtopia.fandom.com/wiki/Ancestral_Tesseract_of_Dimensions) | Extra Blocks... | 5% chance a broken block drops an extra of itself | +1% | 10% |
| [Seed of Life](https://growtopia.fandom.com/wiki/Ancestral_Seed_of_Life) | Reduced Growtime... | -2% seed grow time | -2% | -12% |
| [Orb of Time](https://growtopia.fandom.com/wiki/Ancestral_Orb_of_Time) | Provider Time Reduced... | -1% provider time | -1% | -6% |

All five are unsplicable artifacts worn in the **Ancestral** clothing slot.
Family colors match the aura: totem golden, lens red, tesseract blue,
seed green, orb magenta.

## Update history

| Update | Date | What it added |
|---|---|---|
| [Hidden Riches](https://growtopia.fandom.com/wiki/Hidden_Riches_(update)) | September 1, 2017 | Level 1 of four families (Totem, Lens, Tesseract, Seed) |
| [Ancestral Power](https://growtopia.fandom.com/wiki/Ancestral_Power_(update)) | October 16, 2017 | Ancient Altar upgrading, Levels 2-5 |
| Stuff! | October 1, 2018 | The fifth family: Orb of Time |
| WinterFest 2019 | December 12, 2019 | Level 6, gated behind 9,000 [Royal Winter Seals](https://growtopia.fandom.com/wiki/Royal_Winter_Seal) |

## Obtaining and upgrading

* Base artifacts are made in a Chemical Combiner (the wiki classifies them
  as *unsplicable* — they are combined from components, not spliced from
  seeds), e.g. [Totem of Wisdom](https://growtopia.fandom.com/wiki/Guide:Combining)
  = 1 Crystallized Brilliance + 2 Ancient Hinge + 5 Ancient Lens; Tesseract
  = 1 Crystallized Reality + 2 Ancient Bracket + 5 Ancient Pin.
* The **[Ancient Altar](https://growtopia.fandom.com/wiki/Guide:Combining)**
  (itself combined: 75 Ghost-In-A-Jars + 50 Silver Idols + 1 Ancestor
  Mooncake) upgrades artifacts. Wrench it, meet the Ancient Goddess, pick
  an artifact, then complete four riddles: deliver Soul Stones; a Plasma
  Globe, Harmonic Chimes or Celestial Kaleidoscope; the crystallized
  object used to create the artifact; and a daily riddle (changes at 20:00
  Growtopia Time).
* Soul Stones come from Crazy Jim's Biweekly Soul Quest (three tasks,
  every two weeks), or from Locke the Traveling Salesman for 30 World
  Locks — one per visit.
* **Upgraded artifacts become untradeable and undroppable** ([Ancestral
  Power update](https://growtopia.fandom.com/wiki/Ancestral_Power_(update))).
  Ancient Altars are not consumed by upgrading.
* Level 6 additionally requires having spent 9,000 Royal Winter Seals
  (WinterFest currency from crackers / gem purchases).

## Trivia relevant to rendering

* Each artifact has an item counterpart that reacts to its upgrade level
  (e.g. Techno Visor + Tesseract, Monocle + Lens, Winter Robe + Totem)
  ([Ancestral Power update](https://growtopia.fandom.com/wiki/Ancestral_Power_(update))).
* The aura is visible on the character at all times when equipped —
  this is what the renderer reproduces.

## Sources

- https://growtopia.fandom.com/wiki/Ancestral_Totem_of_Wisdom
- https://growtopia.fandom.com/wiki/Ancestral_Lens_of_Riches
- https://growtopia.fandom.com/wiki/Ancestral_Tesseract_of_Dimensions
- https://growtopia.fandom.com/wiki/Ancestral_Seed_of_Life
- https://growtopia.fandom.com/wiki/Ancestral_Orb_of_Time
- https://growtopia.fandom.com/wiki/Ancestral_Power_(update)
- https://growtopia.fandom.com/wiki/Hidden_Riches_(update)
- https://growtopia.fandom.com/wiki/Guide:Combining
