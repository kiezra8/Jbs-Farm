import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

const FARM_NAME = 'JBS Farm Management System'

// ─── PDF Export ───────────────────────────────────────────────
export function exportToPDF({ title, columns, rows, filename, groupBy, groupFormat }) {
  const doc = new jsPDF()
  
  // Header
  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, 210, 30, 'F')
  doc.setTextColor(34, 197, 94)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(FARM_NAME, 14, 12)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text(title, 14, 20)
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 14, 27)

  // Table
  if (groupBy) {
    const groupedData = rows.reduce((acc, row) => {
       const key = row[groupBy]
       if (!acc[key]) acc[key] = []
       acc[key].push(row)
       return acc
    }, {})

    let currentY = 35
    const sortedKeys = Object.keys(groupedData).sort((a, b) => new Date(b) - new Date(a))

    sortedKeys.forEach((key) => {
      if (currentY > doc.internal.pageSize.height - 30) {
        doc.addPage()
        currentY = 20
      }

      const displayKey = groupFormat ? groupFormat(key) : key
      
      doc.setFontSize(11)
      doc.setTextColor(34, 197, 94)
      doc.setFont('helvetica', 'bold')
      doc.text(String(displayKey), 14, currentY)
      currentY += 4
      
      autoTable(doc, {
        head: [columns.map(c => c.header)],
        body: groupedData[key].map(row => columns.map(c => row[c.key] ?? '')),
        startY: currentY,
        theme: 'grid',
        headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [241, 245, 249] },
        styles: { fontSize: 9 },
        margin: { bottom: 20 }
      })
      currentY = doc.lastAutoTable.finalY + 10
    })
  } else {
    autoTable(doc, {
      head: [columns.map(c => c.header)],
      body: rows.map(row => columns.map(c => row[c.key] ?? '')),
      startY: 35,
      theme: 'grid',
      headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      styles: { fontSize: 9 },
    })
  }

  doc.save(`${filename || title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`)
}

// ─── Excel Export ──────────────────────────────────────────────
export function exportToExcel({ title, columns, rows, filename }) {
  const headers = columns.map(c => c.header)
  const data = rows.map(row => columns.map(c => row[c.key] ?? ''))
  
  const ws = XLSX.utils.aoa_to_sheet([
    [FARM_NAME],
    [title],
    [`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`],
    [],
    headers,
    ...data,
  ])

  // Style header row
  ws['!cols'] = columns.map(() => ({ wch: 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
  XLSX.writeFile(wb, `${filename || title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.xlsx`)
}
