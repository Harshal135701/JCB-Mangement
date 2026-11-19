import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { JCB_OFFICIAL_LOGO_BASE64 } from './jcbOfficialLogo';

export interface PDFReportMetric {
  label: string;
  value: string | number;
  subtext?: string;
  highlight?: boolean;
}

export interface PDFSummaryBlock {
  title: string;
  tableHead: string[];
  tableRows: (string | number)[][];
}

export interface GenerateReportPDFOptions {
  reportTitle: string;
  role: string;
  targetUser?: {
    name: string;
    employeeCode?: string;
    designation?: string;
    department?: string;
    responsibilities?: string;
    status?: string;
    plantName?: string;
    shopName?: string;
    email?: string;
  };
  machineSubject?: {
    name: string;
    machineCode: string;
    category: string;
    oemManufacturer: string;
    modelNumber?: string;
    serialNumber?: string;
    criticality?: string;
    status: string;
    plantName?: string;
    shopName?: string;
    bayLineLocation?: string;
    operatingHours?: number | string;
    commissionDate?: string;
    assignedOperator?: string;
    operatorCode?: string;
    responsiblePerson?: string;
    assignmentStatus?: string;
  };
  generatedBy: string;
  dateRange?: {
    startDate?: string;
    endDate?: string;
  };
  metrics?: PDFReportMetric[];
  executiveSummary?: string;
  summaryBlocks?: PDFSummaryBlock[];
  fileName?: string;
}

/**
 * Concise, Professional Summary-Based PDF Generator for JCB Smart CMMS.
 * Designed to produce an enterprise management-level operational summary strictly formatted to 1-2 pages.
 */
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
  // Official JCB Logo (identical to sidebar branding)
  const logoWidth = 28;
  const logoHeight = 9.1; // aspect ratio 370:120 ≈ 3.08
  try {
    doc.addImage(JCB_OFFICIAL_LOGO_BASE64, 'PNG', margin, currentY, logoWidth, logoHeight);
  } catch (_err) {
    // Fallback if image fails
    doc.setFillColor(245, 158, 11);
    doc.roundedRect(margin, currentY, 20, 10, 1.5, 1.5, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('JCB', margin + 3.5, currentY + 7);
  }

  // Title & Subtitle beside logo
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('SMART CMMS', margin + 32, currentY + 5);

  doc.setTextColor(100, 116, 139); // slate-500
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const subtitle = options.machineSubject
    ? 'Machine Maintenance Management System • Equipment Operational Performance Summary'
    : 'Machine Maintenance Management System • Operational Performance Summary';
  doc.text(subtitle, margin + 32, currentY + 9);

  // Real-time Stamp on Top-Right
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

  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text(`Generated: ${printDateStr} ${printTimeStr}`, pageWidth - margin, currentY + 4.5, { align: 'right' });
  doc.text(`By: ${options.generatedBy}`, pageWidth - margin, currentY + 8.5, { align: 'right' });

  currentY += 13;

  // Divider Line
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 3.5;

  // 2. REPORT TITLE BAR
  doc.setFillColor(24, 24, 27); // zinc-900
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 7.5, 1, 1, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(options.reportTitle.toUpperCase(), margin + 4, currentY + 5);

  currentY += 10.5;

  // 3. TARGET METADATA BOX (MACHINE OR PERSONNEL)
  const isMachine = Boolean(options.machineSubject);
  const boxHeight = isMachine ? 22 : 19;

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 1.2, 1.2, 'FD');

  doc.setFontSize(7.5);

  if (isMachine && options.machineSubject) {
    const m = options.machineSubject;

    // Column 1: Machine Identification (width: ~38%)
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Machine Identification:', margin + 4, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(`${m.name} (${m.machineCode})`, margin + 4, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Type: ${m.category || 'Not Available'}  |  Model: ${m.modelNumber || 'Not Available'}`, margin + 4, currentY + 13.5);
    doc.text(`OEM: ${m.oemManufacturer || 'Not Available'}  |  S/N: ${m.serialNumber || 'Not Available'}`, margin + 4, currentY + 17.5);

    // Column 2: Location Information (width: ~34%)
    const col2X = margin + (pageWidth - margin * 2) * 0.40;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Operating Location:', col2X, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(m.plantName || 'JCB Ballabgarh Works', col2X, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Shop: ${m.shopName || 'Main Production Shop'}`, col2X, currentY + 13.5);
    doc.text(`Location: ${m.bayLineLocation || 'Standard Line'}`, col2X, currentY + 17.5);

    // Column 3: Current Condition & Personnel Assignment (width: ~28%)
    const col3X = margin + (pageWidth - margin * 2) * 0.72;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Condition & Assignment:', col3X, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const statusText = `Status: ${m.status.toUpperCase()} (${m.criticality ? m.criticality.toUpperCase().replace(/_/g, ' ') : 'CLASS B'})`;
    doc.text(statusText, col3X, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const opText = m.assignedOperator
      ? `Operator: ${m.assignedOperator}${m.operatorCode ? ` (${m.operatorCode})` : ''}`
      : 'Operator: Shift Operator Pool';
    doc.text(opText, col3X, currentY + 13.5);
    const respText = `Supervisor: ${m.responsiblePerson || 'Shop Maintenance Lead'}`;
    doc.text(respText, col3X, currentY + 17.5);
  } else if (options.targetUser) {
    const u = options.targetUser;

    // Column 1: Personnel Identification
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Report Subject:', margin + 4, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    const codeText = u.employeeCode ? ` (${u.employeeCode})` : '';
    doc.text(`${u.name}${codeText}`, margin + 4, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Designation: ${u.designation || options.role.toUpperCase()}`, margin + 4, currentY + 13.5);
    doc.text(`Department: ${u.department || 'Plant Engineering & Maintenance'}`, margin + 4, currentY + 17.5);

    // Column 2: Facility & Location
    const col2X = margin + (pageWidth - margin * 2) * 0.40;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Plant & Facility:', col2X, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(u.plantName || 'JCB Ballabgarh Works', col2X, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Shop / Section: ${u.shopName || 'All Assigned Facilities'}`, col2X, currentY + 13.5);
    doc.text(`Status: ${u.status || 'Active / On-Duty'}`, col2X, currentY + 17.5);

    // Column 3: Scope Window
    const col3X = margin + (pageWidth - margin * 2) * 0.72;
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text('Report Window:', col3X, currentY + 4.5);

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    let periodText = 'All Historic Records';
    if (options.dateRange?.startDate || options.dateRange?.endDate) {
      periodText = `${options.dateRange.startDate || 'Start'} to ${options.dateRange.endDate || 'Present'}`;
    }
    doc.text(periodText, col3X, currentY + 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(16, 185, 129); // emerald-600
    doc.text('Live Production Verified', col3X, currentY + 13.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Role Scope: ${options.role.toUpperCase()}`, col3X, currentY + 17.5);
  }

  currentY += boxHeight + 3;

  // 4. EXECUTIVE SUMMARY METRICS CARDS (KPIs)
  if (options.metrics && options.metrics.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('OPERATIONAL KPI OVERVIEW', margin, currentY + 0.5);
    currentY += 3.5;

    const totalMetrics = options.metrics.length;
    const cardGap = 2;
    const availableWidth = pageWidth - margin * 2;
    const numCols = Math.min(totalMetrics, 6);
    const cardWidth = (availableWidth - (numCols - 1) * cardGap) / numCols;
    const cardHeight = 14;

    options.metrics.slice(0, numCols).forEach((metric, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);

      if (metric.highlight) {
        doc.setFillColor(254, 243, 199); // amber-100
        doc.setDrawColor(245, 158, 11); // amber-500
      } else {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.setDrawColor(226, 232, 240); // slate-200
      }
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1, 1, 'FD');

      // Metric Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(metric.highlight ? 180 : 15, metric.highlight ? 83 : 23, metric.highlight ? 9 : 42);
      doc.text(String(metric.value), cardX + cardWidth / 2, currentY + 5.5, { align: 'center' });

      // Metric Label
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      const splitLabel = doc.splitTextToSize(metric.label.toUpperCase(), cardWidth - 2);
      doc.text(splitLabel, cardX + cardWidth / 2, currentY + 10, { align: 'center' });
    });

    currentY += cardHeight + 5;
  }

  // 5. EXECUTIVE SUMMARY PARAGRAPH (Industrial assessment from verified data)
  if (options.executiveSummary) {
    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(251, 191, 36); // amber-400
    doc.setLineWidth(0.3);

    const summaryText = options.executiveSummary.trim();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - margin * 2 - 16);
    const summaryBoxHeight = Math.max(16, splitSummary.length * 3.8 + 8);

    doc.roundedRect(margin, currentY, pageWidth - margin * 2, summaryBoxHeight, 1.2, 1.2, 'FD');

    // Left accent bar
    doc.setFillColor(245, 158, 11);
    doc.rect(margin, currentY, 2, summaryBoxHeight, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9); // amber-700
    const summaryTitle = isMachine
      ? 'EXECUTIVE MACHINERY ASSET & MAINTENANCE ASSESSMENT'
      : 'EXECUTIVE PERFORMANCE & ACTIVITY ASSESSMENT';
    doc.text(summaryTitle, margin + 5, currentY + 4.5);

    // Text
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85); // slate-700
    doc.text(splitSummary, margin + 5, currentY + 9);

    currentY += summaryBoxHeight + 5;
  }

  // 6. SUMMARY ACTIVITY BLOCKS (Concise Summary Tables Instead of Raw Records)
  if (options.summaryBlocks && options.summaryBlocks.length > 0) {
    for (const block of options.summaryBlocks) {
      // Check remaining page height before drawing next summary block
      if (currentY > pageHeight - 38) {
        doc.addPage();
        currentY = margin;
      }

      // Block Title
      doc.setFillColor(245, 158, 11);
      doc.rect(margin, currentY, 2, 4, 'F');

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text(block.title.toUpperCase(), margin + 4, currentY + 3.2);

      currentY += 5;

      if (block.tableHead && block.tableRows && block.tableRows.length > 0) {
        autoTable(doc, {
          startY: currentY,
          head: [block.tableHead],
          body: block.tableRows,
          margin: { left: margin, right: margin },
          theme: 'striped',
          headStyles: {
            fillColor: [24, 24, 27],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            cellPadding: 2,
          },
          bodyStyles: {
            fontSize: 6.8,
            cellPadding: 1.8,
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
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      }
    }
  }

  // 7. GOVERNANCE & VERIFICATION SIGN-OFF BLOCK
  if (currentY > pageHeight - 32) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, pageWidth - margin * 2, 18, 1, 1, 'FD');

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const certText = isMachine
    ? 'AUTHENTICITY CERTIFICATION: This document is an official machine lifecycle summary generated by JCB Smart CMMS. ' +
      'All operating hours, maintenance histories, and downtime metrics are computed directly from verified database records.'
    : 'AUTHENTICITY CERTIFICATION: This document is an official management summary generated by JCB Smart CMMS. ' +
      'All metrics, activities, and operational figures are computed directly from verified database records.';
  doc.text(certText, margin + 4, currentY + 4.5, { maxWidth: pageWidth - margin * 2 - 8 });

  // Signatures Line
  const sigY = currentY + 12;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);

  // Left signature
  doc.line(margin + 6, sigY, margin + 55, sigY);
  const leftLabel = isMachine ? 'Inspecting Technician / Operator' : 'Employee / Report Subject';
  doc.text(leftLabel, margin + 6, sigY + 3.5);

  // Right signature
  const sig2X = pageWidth - margin - 55;
  doc.line(sig2X, sigY, pageWidth - margin - 6, sigY);
  const rightLabel = isMachine ? 'Plant Maintenance Manager' : 'Authorized Supervisor / Plant Manager';
  doc.text(rightLabel, sig2X, sigY + 3.5);

  // 8. MULTI-PAGE NUMBERING & FOOTERS
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    const footerText = isMachine
      ? 'JCB Smart CMMS • Confidential • Official Machinery Asset Lifecycle Audit Document'
      : 'JCB Smart CMMS • Confidential • Official Operational Audit Document';
    doc.text(footerText, margin, pageHeight - 5);

    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }

  // Generate Filename
  const subjectName = isMachine
    ? options.machineSubject?.machineCode || options.machineSubject?.name || 'Machine'
    : options.targetUser?.name || 'User';
  const cleanName = (subjectName || 'Report')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_');
  const cleanRole = (isMachine ? 'Machine' : options.role).replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = now.toISOString().split('T')[0];
  const finalFileName = options.fileName || `JCB_${cleanRole}_Report_${cleanName}_${dateStr}.pdf`;

  // Save / Download
  doc.save(finalFileName);

  return finalFileName;
}
