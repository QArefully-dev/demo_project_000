# QME-418 — Custom Blend configurator

---

## Background

Custom Blend lets a trade customer build a bespoke 25 kg powder mix instead of buying an off-the-shelf product: they choose one base material, add a few ingredients, set the proportions, and add the finished blend to their basket like any other line.

---

## User story

> **As a** trade customer
> **I want to** build a custom powder blend from a base material and my own choice of ingredients
> **So that** I can order a mix suited to my job without contacting sales for a special order.

---

## Screens involved

| Screen | What the customer does there |
| --- | --- |
| **Custom Blend** — *"Build a custom blend"* | The whole configurator. Three labelled steps: **1. Base**, **2. Ingredients**, **3. Ratios**. |
| **Blend summary** (side panel on the same screen) | Live price preview, mix visualisation, safety classification, and the **Add blend to cart** action. |
| **Basket** | Where the finished blend appears as a line item, with an option to edit it. |
| **Checkout** | Where the blend is paid for alongside ordinary products. |

The configurator is reachable from the main category navigation. The customer does **not** need to be signed in.

---

## Acceptance criteria

### AC1 — Happy path to basket
**Given** I am a signed-out customer on the Custom Blend screen
**When** I choose a base material, add at least one ingredient, set valid proportions, and confirm
**Then** the blend is added to my basket as a single line showing the blend total, and I can continue shopping or go to checkout.

### AC2 — Live price preview
**Given** I have a base and at least one ingredient selected
**When** I change any proportion
**Then** the summary updates to show the material total, the blending fee, and the blend total, without a page reload.

### AC3 — Safety classification is visible
**Given** I have configured a blend
**When** the summary is shown
**Then** it states whether the result is a **food-grade blend** or a **non-food blend**, and a non-food result carries handling guidance.

### AC4 — The server has the final say
**Given** I have assembled a combination the screen allowed me to build
**When** the system evaluates it and finds it unacceptable
**Then** I see a clear message explaining why, the blend is **not** added to my basket, and my configuration is preserved so I can correct it rather than start again.

### AC5 — Editing a blend already in the basket
**Given** a configured blend is in my basket
**When** I choose to edit that line
**Then** the configurator reopens with my existing choices loaded, and saving replaces that basket line rather than adding a second one.

### AC6 — The blend survives to checkout
**Given** my basket contains a configured blend
**When** I proceed through checkout
**Then** the blend is priced and presented consistently with what the summary showed, and the order confirmation reflects it.

---