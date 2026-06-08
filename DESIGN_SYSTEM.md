# 🎨 GLPI Vue - Premium Design System

## Overview

Your project has been completely redesigned with a **professional dark theme** featuring:
- Premium color palette with 100+ design tokens
- Responsive component system
- Modern animations and transitions
- Accessibility-first approach

## 📦 CSS Files Structure

### Core System
- **`global.css`** - Color variables, typography, base styles, utilities
- **`components.css`** - Reusable UI components (cards, tables, forms, modals)
- **`views.css`** - View-specific layouts for data tables and lists

### Layout Components
- **`AppLayout.css`** - Main app shell, topbar, header
- **`AppSidebar.css`** - Navigation sidebar with animations

### View-Specific Styles
- **`DashboardView.css`** - KPI cards and dashboard layouts
- **`TicketsView.css`** - Ticket management views
- **`LoginView.css`** - Authentication pages
- Others as needed...

## 🎯 Color Palette

### Backgrounds
```css
--bg-base:          #0f1419;  /* Primary background */
--bg-surface:       #131820;  /* Elevated surface */
--bg-elevated:      #1e2330;  /* Secondary elevated */
--bg-hover:         #242a38;  /* Hover state */
--bg-active:        #2a3142;  /* Active state */
```

### Primary Brand
```css
--primary-600:      #2563eb;  /* Default button */
--primary-500:      #3b82f6;  /* Hover state */
--primary-400:      #60a5fa;  /* Accent text */
```

### Status Colors
```css
--success:          #10b981;  /* Success operations */
--warning:          #f59e0b;  /* Warnings */
--error:            #ef4444;  /* Errors */
--info:             #3b82f6;  /* Information */
```

## 🧩 Component Usage

### Cards
```html
<div class="card">
  <div class="card-header">
    <h3>Card Title</h3>
    <a href="#" class="card-link">View All →</a>
  </div>
  <div class="card-body">
    <!-- Content -->
  </div>
</div>

<!-- Variants -->
<div class="card primary">...</div>
<div class="card success">...</div>
<div class="card elevated">...</div>
```

### Buttons
```html
<!-- Primary -->
<button class="btn btn-primary">Action</button>

<!-- Secondary -->
<button class="btn btn-secondary">Cancel</button>

<!-- Danger -->
<button class="btn btn-danger">Delete</button>

<!-- Sizes -->
<button class="btn btn-sm">Small</button>
<button class="btn btn-lg">Large</button>

<!-- Icon -->
<button class="btn-icon">⚙️</button>
```

### Badges
```html
<span class="badge primary">Active</span>
<span class="badge success">Completed</span>
<span class="badge warning">Pending</span>
<span class="badge error">Failed</span>
```

### Data Tables
```html
<div class="table-container">
  <div class="table-scroll">
    <table class="data-table">
      <thead>
        <tr>
          <th class="sortable">Column Name</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Data</td>
          <td><span class="status-badge active">Active</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

### Forms
```html
<div class="form-group">
  <label>Field Label</label>
  <input class="form-group input" type="text" placeholder="Enter value...">
  <span class="form-group-hint">Helper text</span>
</div>

<div class="form-group required">
  <label>Required Field</label>
  <input type="text" required>
</div>
```

### Alerts
```html
<div class="alert success">
  <div class="alert-icon">✓</div>
  <div class="alert-content">
    <div class="alert-title">Success</div>
    <div class="alert-message">Operation completed successfully</div>
  </div>
</div>

<!-- Variants: warning, error, info -->
```

### Empty States
```html
<div class="empty-state">
  <div class="empty-state-icon">📭</div>
  <div class="empty-state-title">No data found</div>
  <div class="empty-state-message">
    There are no items to display at the moment.
  </div>
</div>
```

## 📐 Spacing System

```css
--spacing-xs:       2px;
--spacing-sm:       4px;
--spacing-md:       8px;
--spacing-lg:       16px;
--spacing-xl:       24px;
--spacing-2xl:      32px;
--spacing-3xl:      48px;
--spacing-4xl:      64px;
```

## 🔲 Border Radius

```css
--radius-xs:        2px;
--radius-sm:        4px;
--radius-md:        8px;
--radius-lg:        12px;
--radius-xl:        16px;
--radius-2xl:       20px;
--radius-3xl:       24px;
--radius-full:      9999px;
```

## ✨ Animations

### Transitions
```css
--transition:       150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-slow:  300ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-base:  200ms ease-in-out;
```

### Built-in Animations
- `fadeInUp` - Fade in with up movement
- `slideInRight` - Slide in from right
- `pulse` - Pulse animation
- `spin` - Rotation animation
- `shimmer` - Loading shimmer effect

## 📱 Responsive Breakpoints

```css
/* Large screens */
@media (max-width: 1024px) { }

/* Tablets */
@media (max-width: 768px) { }

/* Mobile */
@media (max-width: 480px) { }
```

## 🎭 Utility Classes

### Text Colors
```html
<span class="text-primary">Primary</span>
<span class="text-secondary">Secondary</span>
<span class="text-muted">Muted</span>
<span class="text-success">Success</span>
<span class="text-error">Error</span>
```

### Flexbox
```html
<div class="flex justify-between items-center gap-4">
  <!-- Content -->
</div>
```

### Sizing
```html
<div class="w-full h-full">Full width & height</div>
```

### Typography
```html
<p class="text-bold">Bold text</p>
<p class="text-center">Centered text</p>
<p class="truncate">Truncated text...</p>
```

## 🔗 Z-Index Stack

```css
--z-dropdown:       100;
--z-sticky:         200;
--z-fixed:          300;
--z-modal:          1000;
--z-toast:          1100;
--z-tooltip:        1200;
```

## 📋 Shadows

```css
--shadow-xs:        0 1px 2px rgba(0, 0, 0, 0.4);
--shadow-sm:        0 2px 4px rgba(0, 0, 0, 0.45);
--shadow-md:        0 4px 12px rgba(0, 0, 0, 0.5);
--shadow-lg:        0 10px 28px rgba(0, 0, 0, 0.55);
--shadow-xl:        0 15px 40px rgba(0, 0, 0, 0.6);
--shadow-2xl:       0 25px 60px rgba(0, 0, 0, 0.65);
--shadow-glow:      0 0 20px rgba(59, 130, 246, 0.2);
```

## 🚀 Quick Start

1. **Import CSS files in your main component:**
   ```vue
   <style scoped>
   @import '../../styles/global.css';
   @import '../../styles/components.css';
   @import '../../styles/views.css';
   </style>
   ```

2. **Use design tokens in Vue:**
   ```vue
   <template>
     <div class="card primary">
       <div class="card-header">
         <h3>Example</h3>
       </div>
       <div class="card-body">
         <table class="data-table">
           <!-- Your table content -->
         </table>
       </div>
     </div>
   </template>
   ```

3. **Customize with CSS variables:**
   ```css
   :root {
     --primary-600: #2563eb; /* Customize if needed */
   }
   ```

## 📚 Best Practices

- ✅ Use semantic HTML
- ✅ Leverage CSS variables for consistency
- ✅ Follow responsive design patterns
- ✅ Use utility classes for quick styling
- ✅ Test on mobile devices
- ✅ Maintain color contrast for accessibility

## 🎓 Design Principles

1. **Consistency** - Use the same spacing, colors, and typography across all views
2. **Hierarchy** - Use size, weight, and color to establish visual hierarchy
3. **Spacing** - Maintain consistent gaps between elements
4. **Responsiveness** - Ensure all components work on mobile
5. **Accessibility** - Sufficient color contrast and semantic HTML

## 🔧 Customization

To customize the theme globally:

```css
/* In global.css */
:root {
  --primary-600: #your-color;
  --bg-base: #your-bg-color;
  /* ... other variables */
}
```

## 📖 Documentation

For component examples and live previews, refer to:
- Individual CSS file comments
- Component class documentation
- Vue component implementations

---

**Design System Version:** 1.0  
**Last Updated:** June 2026  
**Status:** Production Ready ✅
