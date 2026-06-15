# Comment exporter en PDF

## 2 approches disponibles

| Approche | Installation | Rendu | Idéal pour |
|----------|-------------|-------|------------|
| `window.print()` | Aucune | Utilise le CSS print du navigateur | Pages simples, rapide |
| `jsPDF` + `html2canvas` | npm install | Capture le HTML comme image | Tableaux, rapports |

---

## Approche 1 — window.print() (aucune dépendance)

### Installation
Rien à installer.

### Utilisation dans un composant

```ts
function exporterPdf() {
  window.print()
}
```

```vue
<button @click="exporterPdf">Exporter PDF</button>
```

### Contrôler ce qui s'imprime avec le CSS

Dans ton fichier CSS, ajouter une section `@media print` :

```css
@media print {
  /* Cacher les éléments inutiles */
  .btn-refresh,
  .kanban-header,
  nav,
  button { display: none !important; }

  /* Forcer le contenu à prendre toute la page */
  .cost-table { width: 100%; }

  /* Saut de page */
  .page-break { page-break-before: always; }
}
```

---

## Approche 2 — jsPDF + html2canvas (recommandée pour les tableaux)

### Installation

```bash
npm install jspdf html2canvas
```

### Utilisation de base — capturer un élément HTML

```ts
import jsPDF  from 'jspdf'
import html2canvas from 'html2canvas'

async function exporterPdf() {
  console.log('[PDF] Export démarré')

  // Cibler l'élément à capturer (ref ou querySelector)
  const element = document.querySelector('.cost-table') as HTMLElement
  if (!element) {
    console.warn('[PDF] Élément introuvable')
    return
  }

  // Capturer en canvas
  const canvas = await html2canvas(element, { scale: 2 })
  console.log('[PDF] Canvas généré :', canvas.width, 'x', canvas.height)

  const imgData = canvas.toDataURL('image/png')

  // Créer le PDF (format A4 paysage ou portrait)
  const pdf = new jsPDF('portrait', 'mm', 'a4')

  const pageWidth  = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth   = pageWidth - 20          // 10mm marge de chaque côté
  const imgHeight  = (canvas.height * imgWidth) / canvas.width

  pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight)
  pdf.save('rapport-couts.pdf')

  console.log('[PDF] Export terminé')
}
```

### Utiliser un ref Vue pour cibler l'élément

```vue
<script setup lang="ts">
import { ref } from 'vue'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const tableRef = ref<HTMLElement | null>(null)

async function exporterPdf() {
  if (!tableRef.value) return
  console.log('[PDF] Export du tableau')

  const canvas  = await html2canvas(tableRef.value, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const pdf     = new jsPDF('landscape', 'mm', 'a4')

  const w = pdf.internal.pageSize.getWidth()  - 20
  const h = (canvas.height * w) / canvas.width

  pdf.addImage(imgData, 'PNG', 10, 10, w, h)
  pdf.save('rapport.pdf')
}
</script>

<template>
  <button @click="exporterPdf">Exporter PDF</button>

  <div ref="tableRef">
    <!-- Contenu à exporter -->
    <table class="cost-table">...</table>
  </div>
</template>
```

---

## Ajouter un titre et une date dans le PDF

```ts
async function exporterPdfAvecTitre() {
  const element = tableRef.value
  if (!element) return

  const canvas  = await html2canvas(element, { scale: 2 })
  const imgData = canvas.toDataURL('image/png')
  const pdf     = new jsPDF('portrait', 'mm', 'a4')

  // Titre
  pdf.setFontSize(16)
  pdf.setTextColor(15, 23, 42)     // #0f172a
  pdf.text('Rapport des coûts', 10, 15)

  // Date
  const date = new Date().toLocaleDateString('fr-FR')
  pdf.setFontSize(10)
  pdf.setTextColor(100, 116, 139)  // #64748b
  pdf.text(`Généré le ${date}`, 10, 22)

  // Tableau (décalé sous le titre)
  const w = pdf.internal.pageSize.getWidth() - 20
  const h = (canvas.height * w) / canvas.width
  pdf.addImage(imgData, 'PNG', 10, 28, w, h)

  pdf.save(`rapport-couts-${date}.pdf`)
  console.log('[PDF] Sauvegardé')
}
```

---

## Exporter plusieurs pages

```ts
async function exporterMultiPages() {
  const pdf      = new jsPDF('portrait', 'mm', 'a4')
  const pageH    = pdf.internal.pageSize.getHeight()
  const pageW    = pdf.internal.pageSize.getWidth() - 20

  const canvas   = await html2canvas(tableRef.value!, { scale: 2 })
  const imgData  = canvas.toDataURL('image/png')
  const imgH     = (canvas.height * pageW) / canvas.width

  let posY = 10
  let restant = imgH

  pdf.addImage(imgData, 'PNG', 10, posY, pageW, imgH)

  // Si le contenu dépasse une page → ajouter des pages
  while (restant > pageH - 20) {
    pdf.addPage()
    posY    = -(pageH - 20) + (imgH - restant) + 10
    restant -= pageH - 20
    pdf.addImage(imgData, 'PNG', 10, posY, pageW, imgH)
  }

  pdf.save('rapport.pdf')
}
```

---

## Récapitulatif — quand utiliser quoi

| Besoin | Solution |
|--------|----------|
| Export rapide sans librairie | `window.print()` |
| Tableau simple à capturer | `html2canvas` + `jsPDF` |
| PDF avec titre, date, mise en forme | `jsPDF` avec `pdf.text()` + `pdf.addImage()` |
| Contenu sur plusieurs pages | `jsPDF` avec `pdf.addPage()` |
