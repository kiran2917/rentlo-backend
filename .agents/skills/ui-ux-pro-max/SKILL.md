---
name: ui-ux-pro-max
description: >-
  Advanced UI/UX design framework for high-converting, visually stunning web
  applications with modern typography, glassmorphism, curated color harmony,
  micro-interactions, and responsive design systems. Use this skill whenever
  creating or redesigning user interfaces for maximum visual impact.
---

# UI/UX Pro Max Skill Guide

This skill provides an elite design system and UI/UX framework to transform web interfaces into world-class, modern, and engaging user experiences.

---

## 🎨 1. Design Aesthetics & Visual Excellence

1. **Avoid Plain Browser Defaults**: Never use generic `#ff0000`, `#0000ff`, or `#ffffff` without carefully chosen theme tokens. Use curated color palettes (Slate, Emerald, Sapphire, Cyber Cyan, Midnight Glass).
2. **Glassmorphism & Depth**:
   - Background: `backdrop-filter: blur(16px) saturate(180%)`
   - Light Glass: `background: rgba(255, 255, 255, 0.75)`, border `1px solid rgba(255, 255, 255, 0.3)`
   - Dark Glass: `background: rgba(15, 23, 42, 0.82)`, border `1px solid rgba(255, 255, 255, 0.12)`
   - Multi-Layer Shadows: `box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.25), 0 0 30px rgba(16, 185, 129, 0.1)`
3. **Vibrant Gradients**:
   - Text Gradients: `bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent`
   - Button Gradients: `linear-gradient(135deg, #10b981, #059669)` with glowing drop shadow `shadow-lg shadow-emerald-500/30`

---

## ✍️ 2. Modern Typography & Hierarchy

1. **Font Pairings**:
   - Display Headings: **Outfit**, **Fraunces**, **Plus Jakarta Sans**, **Inter**
   - Body Text: **Inter**, **Roboto**, **System Sans**
2. **Type Scale**:
   - Hero Titles: `clamp(36px, 5.5vw, 64px)` with tight letter spacing (`tracking-tight`, line-height `1.08`)
   - Section Titles: `clamp(22px, 3.5vw, 38px)`
   - Subtitles / Leads: `16px` to `19px` with relaxed line height (`leading-relaxed`)
   - Metadata / Badges: `10px` to `12px` font weight `800` (extrabold), uppercase, `tracking-widest`

---

## 🧩 3. Component Design System

### 🃏 Property & Feature Cards
- Large border-radius (`rounded-3xl` or `rounded-2xl`).
- Hover lift animation: `hover:-translate-y-1 hover:shadow-2xl transition-all duration-300`.
- Image containers: `aspect-[16/10]` or `aspect-[4/3]`, `overflow-hidden`, with subtle zoom effect on hover (`group-hover:scale-105 transition-transform duration-500`).

### 🔍 Floating Search Containers
- Unified floating search bar with category pills on top.
- Clear field dividers and Material Symbols / Lucide icons inside inputs (`text-emerald-500`).
- Integrated GPS / Distance radius sub-bars with toggle states.

### 🏷️ Status Badges & Pills
- Rounded pill badges: `px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase tracking-widest`.
- Glowing pulse dot indicator (`w-2 h-2 rounded-full animate-pulse`).

---

## ⚡ 4. Dynamic Theme System (Light & Dark Mode)

1. **CSS Custom Variables**:
   - `--bg`: Main canvas background.
   - `--surface`: Card container background.
   - `--surface-alt`: Input / sub-container background.
   - `--ink`: Primary high-contrast text color.
   - `--text-muted`: Secondary muted text color.
   - `--accent`: Primary brand accent color.
   - `--border`: Subtly defined border color.
2. **Theme Adaptability**:
   - Ensure components gracefully switch between **Light Mode** (airy slate-to-emerald gradient) and **Dark Mode** (deep midnight obsidian glass) when the admin toggles theme settings.

---

## ✨ 5. Micro-Animations & Interaction Physics

1. **Hover Physics**: Subtly scale elements (`hover:scale-[1.02] active:scale-98 cursor-pointer`).
2. **Shimmer Effects**: Add shimmering shimmer loading effects (`btn-shimmer`, `animate-pulse`).
3. **Smooth Transitions**: Use `transition-all duration-300 ease-out` across all interactive elements.

---

## 📱 6. Mobile Responsiveness & Accessibility

1. **Touch Targets**: Minimum `44px x 44px` height (`h-12`) for all clickable buttons, inputs, and dropdowns on touch screens.
2. **Grid Reflow**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-12` for seamless reflow from mobile to ultrawide desktop screens.
3. **Contrast Verification**: Ensure WCAG AA compliance for body text contrast against all background states.
