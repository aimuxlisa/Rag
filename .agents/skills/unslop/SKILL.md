---
name: unslop
description: Turns vibecoded, AI-looking UI into a designed interface with its own character. Finds a direction from the product itself, then fixes spacing, color, icons, copy, type, layout, details, visuals and motion in that order, and can generate a real hero visual with an image tool when one is available. Use when the user asks to unslop, polish, clean up or redesign a screen so it stops looking AI-generated, or when a UI shows the usual tells like purple gradients, glows, gradient text, emoji labels, "New ✨" badges, glossy blobs, uppercase tracked labels, pulsing elements or uneven spacing. Works on React, Tailwind, HTML and CSS, for dashboards, apps and landing pages.
license: CC-BY-4.0
metadata:
  author: Damir Sokolovsky
  x: https://x.com/heydamir
  site: https://heydamir.design/unslop
---

# Unslop

unslop was created by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), who started the Unslopping series on X. It is licensed under CC BY 4.0, so keep this credit in any copy or adaptation.

Vibecoded UI fails in the same predictable ways. Every surface glows, every label has an emoji, spacing is whatever the model typed that day, and the copy shouts. Unslopping fixes the craft and keeps the product. The features, content and order of sections stay. What changes is that every size, color, word and image becomes deliberate.

Removing slop is only half the job. A screen that is clean but could belong to any product is the next template. Every run ends with a screen that only this product could have.

The difference between slop and craft is where the richness goes. Slop spreads color and effects over the chrome, the backgrounds, buttons, borders and labels. Craft keeps the chrome quiet and puts the richness into one or two moments of content that people remember, like a rendered object, a beautiful chart or an image from the product's world.

Work like a designer doing a redline pass, one layer at a time, across the whole screen.

## What good looks like

- **One bright element.** Each screen has one polished thing that carries the color and the craft, a rendered object, a painted scene or a rich chart. Everything around it is quiet, so it reads instantly.
- **Quiet chrome.** Navigation, buttons and text use the tinted neutrals and one accent. Nothing glows, nothing competes with the bright element.
- **A clear idea.** You can say in one sentence what the visual shows and why it belongs to this product.
- **Text on calm space.** The headline sits on a part of the image or layout that was left empty for it, short and specific, with one primary and one secondary action and nothing stacked under them.
- **Real product, real material.** Previews look like the real app with plausible data, and objects look like real things with weight, light and shadow.

## Run it

1. **Look at the screen.** Find the files that render it.
2. **Audit.** Go through references/signs.md and list every sign you find, one line each with where it lives.
3. **Decide how much to change.** Read the audit honestly before planning anything.
   - **Heavy slop**, many signs across color, type, icons and copy. Run the full process below.
   - **Light slop**, a screen that is mostly designed with a few signs left. Polish mode.
   - **No slop.** Say so plainly and suggest two or three small refinements at most.
4. **Set the direction and stop.** Write the five lines (Product, Character, World, Moments, Signature).
5. **Fix in nine passes, in order.** (Spacing, Color, Icons, Copy, Type, Layout, Details, Visuals, Motion).
6. **Check.** Run the checklist.
7. **Report.**

## Direction

- **Product.** What it does and for whom, in one plain sentence.
- **Character.** Two or three concrete words (e.g., `calm, exact, a little warm`).
- **World.** The place or material the product naturally belongs to.
- **Moments.** One or two places where the screen gets rich color, material and detail.
- **Signature.** One small detail only this product would have.

## 1. Spacing
- Everything sits on a 4px grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128).
- Same thing, same size. Rows in a list share one height and gap.
- Space shows grouping.

## 2. Color
- One neutral ramp (Graphite, Warm, or Ink).
- Three text roles: primary, secondary, muted.
- In chrome: one accent, used rarely.
- No hue gradients on surfaces, no gradient text, no colored glows or neon borders.

## 3. Icons
- Line icons from one set at 16 or 18px with 1.5 stroke.
- No emoji decoration in labels or buttons.

## 4. Copy
- Headlines say what the product does for whom in plain words.
- No exclamation marks, no trailing periods on labels.
- No hype words (supercharge, seamless, unlock, magic, revolutionize, AI-powered).

## 5. Type
- Pick type for the character. Weights 400 and 500 (max 600 for rare emphasis).
- Sentence case everywhere. No uppercase tracked labels. Tabular figures for numbers.

## 6. Layout
- Keep sections and their order.
- One primary action and at most one secondary action in hero.
- Quiet navigation.

## 7. Details
- Nested radius: inner = outer - padding.
- Quiet hairline borders. Focus rings for accessibility.

## 8. Visuals
- No glossy blobs, orbs, floating cubes or glowing grids. Show the real product or a concrete metaphor.

## 9. Motion
- No unneeded loops (animate-pulse, animate-ping on static items).
- Easing curve: `cubic-bezier(0.22, 1, 0.36, 1)`. Motion explains state changes.

## Checklist
- [ ] Direction written and followed
- [ ] 4px scale spacing
- [ ] Aligned columns
- [ ] One neutral ramp, 3 text roles, 1 accent
- [ ] No hue gradients, no gradient text, no glows
- [ ] No emoji in UI
- [ ] Clean type hierarchy (400-600)
- [ ] Plain copy without hype words
- [ ] Tabular numbers
- [ ] Nested radii math
