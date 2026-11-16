import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFReportMetric {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

export interface PDFReportSection {
  title: string;
  tableHead?: string[];
  tableRows?: (string | number)[][];
  emptyText?: string;
}

export interface GenerateReportPDFOptions {
  reportTitle: string;
  role: string;
  targetUser: {
    name: string;
    employeeCode?: string;
    designation?: string;
    plantName?: string;
    shopName?: string;
    email?: string;
  };
  generatedBy: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  metrics?: PDFReportMetric[];
  sections: PDFReportSection[];
  fileName?: string;
}

export function generateReportPDF(options: GenerateReportPDFOptions): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let currentY = margin;

  // 1. BRAND HEADER BANNER
  // Yellow Brand Block
  doc.setFillColor(245, 158, 11); // JCB Yellow #F59E0B
  doc.roundedRect(margin, currentY, 20, 10, 1.5, 1.5, 'F');

  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('JCB', margin + 3.5, currentY + 7);

  // Title & Subtitle beside logo
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SMART CMMS', margin + 24, currentY + 5);

  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Machine Maintenance Management System • Verified Production Report', margin + 24, currentY + 9);

  // Status / Real-time Stamp on Top-Right
  const now = new Date();
  const printDateStr = now.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  const printTimeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${printDateStr} ${printTimeStr}`, pageWidth - margin, currentY + 5, { align: 'right' });
  doc.text(`By: ${options.generatedBy}`, pageWidth - margin, currentY + 9, { align: 'right' });

  currentY += 14;

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 4;

  // 2. REPORT TITLE BAR
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 8, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(options.reportTitle.toUpperCase(), margin + 4, currentY + 5.5);

  currentY += 11;

  // 3. TARGET PERSONNEL & FACILITY METADATA BOX
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 20, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  // Column 1: Personnel
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Subject Personnel:', margin + 4, currentY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  const codeText = options.targetUser.employeeCode ? ` (${options.targetUser.employeeCode})` : '';
  doc.text(`${options.targetUser.name}${codeText}`, margin + 4, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Designation: ${options.targetUser.designation || options.role.toUpperCase()}`, margin + 4, currentY + 15);

  // Column 2: Facility & Location
  const col2X = margin + (pageWidth - margin * 2) * 0.42;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Plant & Facility:', col2X, currentY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text(options.targetUser.plantName || 'JCB Ballabgarh Works', col2X, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Shop / Line: ${options.targetUser.shopName || 'All Plant Shops'}`, col2X, currentY + 15);

  // Column 3: Scope / Period
  const col3X = margin + (pageWidth - margin * 2) * 0.75;
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.text('Report Window:', col3X, currentY + 5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  let periodText = 'All Active DB Records';
  if (options.dateRange?.startDate || options.dateRange?.endDate) {
    periodText = `${options.dateRange.startDate || 'Start'} to ${options.dateRange.endDate || 'Present'}`;
  }
  doc.text(periodText, col3X, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // green-600
  doc.text('Verified Source Data', col3X, currentY + 15);

  currentY += 23;

  // 4. EXECUTIVE SUMMARY METRICS CARDS
  if (options.metrics && options.metrics.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('OPERATIONAL KPI OVERVIEW', margin, currentY + 1);
    currentY += 4;

    const totalMetrics = options.metrics.length;
    const cardGap = 2.5;
    const availableWidth = pageWidth - margin * 2;
    const numCols = Math.min(totalMetrics, 6);
    const cardWidth = (availableWidth - (numCols - 1) * cardGap) / numCols;
    const cardHeight = 16;

    options.metrics.slice(0, numCols).forEach((metric, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);

      // Card Background
      if (metric.highlight) {
        doc.setFillColor(254, 243, 199); // amber-100
        doc.setDrawColor(245, 158, 11); // amber-500
      } else {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
      }
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.2, 1.2, 'FD');

      // Metric Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(metric.highlight ? 180 : 15, metric.highlight ? 83 : 23, metric.highlight ? 9 : 42);
      doc.text(String(metric.value), cardX + cardWidth / 2, currentY + 6.5, { align: 'center' });

      // Metric Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      // Split label if too long
      const splitLabel = doc.splitTextToSize(metric.label.toUpperCase(), cardWidth - 3);
      doc.text(splitLabel, cardX + cardWidth / 2, currentY + 11.5, { align: 'center' });
    });

    currentY += cardHeight + 6;
  }

  // 5. DETAILED SECTIONS & AUTOTABLES
  for (const section of options.sections) {
    // Check remaining height before drawing section title
    if (currentY > pageHeight - 35) {
      doc.addPage();
      currentY = margin;
    }

    // Section Title
    doc.setFillColor(245, 158, 11); // JCB yellow line accent
    doc.rect(margin, currentY, 2.5, 4.5, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(section.title, margin + 4.5, currentY + 3.8);

    currentY += 6;

    if (section.tableHead && section.tableRows && section.tableRows.length > 0) {
      autoTable(doc, {
        startY: currentY,
        head: [section.tableHead],
        body: section.tableRows,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: {
          fillColor: [24, 24, 27],
          textColor: [255, 255, 255],
          fontSize: 7.5,
          fontStyle: 'bold',
          cellPadding: 2,
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2,
          textColor: [39, 39, 42],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        styles: {
          overflow: 'linebreak',
          lineWidth: 0.1,
          lineColor: [226, 232, 240],
        },
        didDrawPage: () => {
          // Keep currentY updated
        },
      });

      // Update currentY to after table
      currentY = (doc as any).lastAutoTable.finalY + 7;
    } else {
      // Empty state box
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(229, 231, 235);
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, 10, 1, 1, 'FD');
      doc.setTextColor(107, 114, 128);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.text(section.emptyText || 'No recorded events or records found for this period.', margin + 4, currentY + 6.5);
      currentY += 15;
    }
  }

  // 6. MULTI-PAGE NUMBERING & FOOTERS
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer divider line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    // Footer text
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(
      'JCB Smart CMMS • Confidential • Official Operational Audit Document',
      margin,
      pageHeight - 6
    );

    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  // Generate Filename
  const cleanName = (options.targetUser.name || 'User')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  const cleanRole = options.role.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = now.toISOString().split('T')[0];
  const finalFileName = options.fileName || `JCB_${cleanRole}_Report_${cleanName}_${dateStr}.pdf`;

  // Trigger Save / Download
  doc.save(finalFileName);

  return finalFileName;
}
