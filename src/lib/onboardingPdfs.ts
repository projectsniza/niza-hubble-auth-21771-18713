import { jsPDF } from 'jspdf';
import nizaLogo from '@/assets/niza-group-logo.png';

const loadLogoImage = (): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve('');
    img.src = nizaLogo;
  });

const formatDateDDMMYYYY = (dateStr?: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// ─────────────────────────────  BANK DETAILS ─────────────────────────────
export async function buildBankDetailsPdf(formData: any): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const labelX = margin;
  const valueX = margin + 75;
  const lineHeight = 7;
  let y = 20;

  const logoDataUrl = await loadLogoImage();
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', pageWidth / 2 - 20, y - 10, 40, 12);
    y += 12;
  }

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EMPLOYEE BANK DETAILS FORM', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Please complete the following information carefully.', pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.setTextColor(200, 100, 0);
  doc.text('Incorrect information will result in a delay in payment.', pageWidth / 2, y, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  y += 10;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  const addRow = (label: string, value: string) => {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelX, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value || '____________________', valueX, y);
    y += lineHeight;
  };

  addRow('YOUR NAME:', formData.your_name);
  addRow('YOUR TELEPHONE NUMBER:', formData.telephone_number);
  y += 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('NAME OF BANK OR BUILDING SOCIETY:', labelX, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(formData.bank_name || '____________________', labelX, y);
  y += lineHeight + 4;

  doc.setFont('helvetica', 'bold');
  doc.text('BANK OR BUILDING SOCIETY ADDRESS:', labelX, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(formData.bank_address || '____________________', contentWidth);
  doc.text(addressLines, labelX, y);
  y += addressLines.length * 5 + 4;

  addRow('TELEPHONE NUMBER OF BRANCH:', formData.bank_telephone);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('BANK SORT CODE:', labelX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formData.sort_code || '__ - __ - __', labelX + 45, y);
  doc.setFont('helvetica', 'bold');
  doc.text('ACCOUNT NUMBER:', labelX + 95, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formData.account_number || '________', labelX + 140, y);
  y += lineHeight + 2;
  addRow('BUILDING SOCIETY ROLL NO:', formData.building_society_roll);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('NAME OF ACCOUNT HOLDER:', labelX, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.text(formData.account_holder_name || '____________________', labelX, y);
  y += lineHeight + 8;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Declaration', labelX, y);
  y += lineHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const declText = 'I confirm that the bank details provided above are correct and that payments should be made to this account.';
  const declLines = doc.splitTextToSize(declText, contentWidth);
  doc.text(declLines, labelX, y);
  y += declLines.length * 4 + 4;

  const drawCheckbox = (x: number, yPos: number, checked: boolean) => {
    const size = 3;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos - size, size, size);
    if (checked) {
      doc.line(x + 0.5, yPos - size / 2, x + size / 2, yPos - 0.5);
      doc.line(x + size / 2, yPos - 0.5, x + size - 0.5, yPos - size + 0.5);
    }
  };
  drawCheckbox(labelX, y, formData.declaration_agreed === true);
  doc.text('  I agree to the above declaration', labelX + 5, y);
  y += lineHeight + 4;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Signature:', labelX, y);
  doc.setFont('helvetica', 'italic');
  doc.text(formData.signature || '____________________', labelX + 25, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', labelX + 105, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateDDMMYYYY(formData.signature_date) || '____________________', labelX + 118, y);

  return doc;
}

// ─────────────────────────────  STARTER CHECKLIST ─────────────────────────────
export async function buildStarterChecklistPdf(formData: any): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const headerHeight = 25;
  let y = headerHeight + 5;
  const lineHeight = 6;
  const labelCol = margin;
  const valueCol = margin + 55;

  const drawCheckbox = (x: number, yPos: number, checked: boolean) => {
    const size = 3;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos - size, size, size);
    if (checked) {
      doc.line(x + 0.5, yPos - size / 2, x + size / 2, yPos - 0.5);
      doc.line(x + size / 2, yPos - 0.5, x + size - 0.5, yPos - size + 0.5);
    }
  };

  const logoDataUrl = await loadLogoImage();
  const addHeader = () => {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 40, 10, 40, 12);
    }
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
  };
  addHeader();

  const checkNewPage = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 20) {
      doc.addPage();
      addHeader();
      y = headerHeight + 5;
    }
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Starter checklist', margin, y);
  y += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const instrText = 'This Starter Checklist can be used to gather information about your new employee. You can use this information to help fill in your first Full Payment Submission (FPS) for this employee.';
  const instrLines = doc.splitTextToSize(instrText, contentWidth);
  doc.text(instrLines, margin, y);
  y += instrLines.length * 4 + 6;

  const sectionBar = (label: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(0, 102, 179);
    doc.rect(margin, y - 4, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(label, margin + 3, y + 1);
    doc.setTextColor(0, 0, 0);
    y += 10;
  };

  sectionBar("Employee's personal details");
  doc.setFontSize(10);
  const fields: [string, string][] = [
    ['1  Last name:', formData.last_name],
    ['2  First name(s):', formData.first_names],
    ['3  Gender:', formData.gender === 'male' ? 'Male' : formData.gender === 'female' ? 'Female' : ''],
    ['4  Date of birth:', formatDateDDMMYYYY(formData.date_of_birth)],
    ['5  Home address:', formData.address],
    ['    Postcode:', formData.postcode?.toUpperCase() || ''],
    ['    Country:', formData.country],
    ['6  National Insurance number:', formData.national_insurance],
    ['7  Employment start date:', formatDateDDMMYYYY(formData.employment_start_date)],
  ];
  fields.forEach(([label, value]) => {
    checkNewPage(lineHeight + 2);
    doc.setFont('helvetica', 'bold');
    doc.text(label, labelCol, y);
    doc.setFont('helvetica', 'normal');
    if (label.includes('address')) {
      const valLines = doc.splitTextToSize(value || '', contentWidth - 55);
      doc.text(valLines, valueCol, y);
      y += Math.max(valLines.length, 1) * 5 + 2;
    } else {
      doc.text(value || '', valueCol, y);
      y += lineHeight;
    }
  });
  y += 4;

  checkNewPage(60);
  sectionBar('Employee statement');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('You need to select only one of the following statements A, B or C.', margin, y);
  y += lineHeight + 3;

  const stmt = (letter: 'A' | 'B' | 'C', text: string) => {
    checkNewPage(20);
    drawCheckbox(margin, y, formData.statement === letter);
    doc.setFont('helvetica', 'bold');
    doc.text(letter, margin + 6, y);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - 10);
    doc.text(lines, margin + 10, y);
    y += lines.length * 4 + 5;
  };
  stmt('A', "This is my first job since last 6 April and I have not been receiving taxable Jobseeker's Allowance, Employment and Support Allowance, taxable Incapacity Benefit, State or Occupational Pension.");
  stmt('B', "This is now my only job, but since last 6 April I have had another job, or received taxable Jobseeker's Allowance, Employment and Support Allowance or taxable Incapacity Benefit. I do not receive a State or Occupational Pension.");
  stmt('C', 'As well as my new job, I have another job or receive a State or Occupational Pension.');

  checkNewPage(30);
  sectionBar('Student Loan');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Do you have a student loan which is not fully repaid?', margin, y);
  const slX = margin + 95;
  doc.text('Yes', slX, y);
  drawCheckbox(slX + 10, y, formData.has_student_loan === true);
  doc.text('No', slX + 20, y);
  drawCheckbox(slX + 28, y, formData.has_student_loan === false);
  y += lineHeight + 3;
  if (formData.has_student_loan === true) {
    doc.text('Are you repaying your Student Loan direct to the Student Loans Company?', margin, y);
    y += lineHeight;
    doc.text('Yes', margin + 10, y);
    drawCheckbox(margin + 20, y, formData.repaying_direct === true);
    doc.text('No', margin + 30, y);
    drawCheckbox(margin + 38, y, formData.repaying_direct === false);
    y += lineHeight;
    doc.text(`Student Loan type: ${formData.student_loan_type === 'plan1' ? 'Plan 1' : formData.student_loan_type === 'plan2' ? 'Plan 2' : ''}`, margin, y);
    y += lineHeight + 2;
  }

  checkNewPage(40);
  y += 2;
  sectionBar('Employee declaration');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const declText = 'I confirm that the information I have given on this form is correct and complete to the best of my knowledge and belief.';
  const declLines = doc.splitTextToSize(declText, contentWidth);
  doc.text(declLines, margin, y);
  y += declLines.length * 4 + 4;
  drawCheckbox(margin, y, formData.declaration_agreed === true);
  doc.text('  I agree to the above declaration', margin + 5, y);
  y += lineHeight + 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Signature:', margin, y);
  doc.setFont('helvetica', 'italic');
  doc.text(formData.signature || '............................', margin + 25, y);
  y += lineHeight + 2;
  doc.setFont('helvetica', 'bold');
  doc.text('Date:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDateDDMMYYYY(formData.signature_date) || '............................', margin + 15, y);

  return doc;
}

// ─────────────────────────────  APPLICATION FORM ─────────────────────────────
export async function buildApplicationFormPdf(
  formData: any,
  orgName?: string,
  branchAddress?: string
): Promise<jsPDF> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const headerHeight = 25;
  let y = headerHeight + 5;
  const lineHeight = 6;
  const sectionGap = 8;

  const logoDataUrl = await loadLogoImage();
  const addHeader = () => {
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - 40, 8, 40, 12);
    }
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
  };
  addHeader();

  const checkNewPage = (requiredSpace: number) => {
    if (y + requiredSpace > pageHeight - 20) {
      doc.addPage();
      addHeader();
      y = headerHeight + 5;
    }
  };
  const drawLine = (startY: number) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.1);
    doc.line(margin, startY, pageWidth - margin, startY);
  };
  const drawCheckbox = (x: number, yPos: number, checked: boolean) => {
    const size = 3;
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.rect(x, yPos - size, size, size);
    if (checked) {
      doc.line(x + 0.5, yPos - size / 2, x + size / 2, yPos - 0.5);
      doc.line(x + size / 2, yPos - 0.5, x + size - 0.5, yPos - size + 0.5);
    }
  };

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text((orgName || 'NIZA GROUP').toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 12;
  doc.setFontSize(18);
  doc.text('Application form', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Please contact the site manager at ${branchAddress || 'the branch location'} if you require this form in an alternative format.`, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
  y += 12;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Position', margin, y);
  y += lineHeight + 2;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Closing date for applications: ${formatDateDDMMYYYY(formData.closing_date) || '............................'}`, margin, y);
  y += lineHeight + 2;
  doc.text(`Application for employment as a ${formData.position || '.....................'} at ${branchAddress || '.....................'}`, margin, y, { maxWidth: contentWidth });
  y += sectionGap + 4;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Personal Information', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const personalFields = [
    ['Title:', formData.title || ''],
    ['Name:', formData.name || ''],
    ['Address:', formData.address || ''],
    ['Postcode:', formData.postcode || ''],
    ['Phone:', formData.phone || ''],
    ['Email:', formData.email || ''],
  ];
  personalFields.forEach(([label, value]) => {
    doc.text(label, margin, y);
    doc.text(value || '....................................', margin + 30, y);
    y += lineHeight;
  });
  y += 2;
  doc.text('Are you eligible to work in the U.K. (Evidence will be required)?', margin, y);
  const eligibleX = margin + 110;
  doc.text('Yes', eligibleX, y);
  drawCheckbox(eligibleX + 10, y, formData.eligible_to_work_uk === true);
  doc.text('No', eligibleX + 20, y);
  drawCheckbox(eligibleX + 28, y, formData.eligible_to_work_uk === false);
  y += lineHeight + 2;
  doc.text(`When can you start work?: ${formatDateDDMMYYYY(formData.start_date) || '............................'}`, margin, y);
  y += sectionGap + 4;

  checkNewPage(60);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Employment', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Do you have previous employment to declare?', margin, y);
  const prevEmpX = margin + 80;
  doc.text('Yes', prevEmpX, y);
  drawCheckbox(prevEmpX + 10, y, formData.has_previous_employment === true);
  doc.text('No', prevEmpX + 20, y);
  drawCheckbox(prevEmpX + 28, y, formData.has_previous_employment === false);
  y += sectionGap;

  if (formData.has_previous_employment === true) {
    doc.text('Previous Employment:', margin, y);
    y += lineHeight;
    doc.text(`Job Title: ${formData.current_job_title || '............................'}`, margin, y);
    y += lineHeight;
    doc.text(`Name and Address of Employer: ${formData.employer_address || ''}`, margin, y, { maxWidth: contentWidth });
    y += lineHeight + 2;
    doc.text(`Date Employment Commenced: ${formatDateDDMMYYYY(formData.employment_commenced) || '............................'}`, margin, y);
    y += lineHeight;
    doc.text(`Previous Salary: ${formData.present_salary || '............................'}`, margin, y);
    y += lineHeight + 4;
    doc.text('Please provide a brief summary of your previous duties:', margin, y);
    y += lineHeight;
    doc.text(formData.current_duties || '', margin, y, { maxWidth: contentWidth });
    y += Math.max(15, (formData.current_duties?.length || 0) / 80 * lineHeight);
    doc.text('Reason for leaving:', margin, y);
    y += lineHeight;
    doc.text(formData.reason_leaving || '', margin, y, { maxWidth: contentWidth });
    y += 10;
    doc.text('Are you required to work any period of notice?', margin, y);
    const noticeX = margin + 80;
    doc.text('Yes', noticeX, y);
    drawCheckbox(noticeX + 10, y, formData.notice_required === true);
    doc.text('No', noticeX + 20, y);
    drawCheckbox(noticeX + 28, y, formData.notice_required === false);
    y += lineHeight;
    doc.text(`Length of notice: ${formData.notice_length || '............................'}`, margin, y);
    y += sectionGap;

    checkNewPage(50);
    doc.setFontSize(9);
    doc.text('Please list in order the organisations you have worked for in the last 5 years:', margin, y, { maxWidth: contentWidth });
    y += lineHeight + 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Name and address of employer', margin, y);
    doc.text('Job Title', margin + 80, y);
    doc.text('Dates employed', margin + 130, y);
    y += lineHeight;
    drawLine(y - 3);
    doc.setFont('helvetica', 'normal');
    (formData.employment_history || []).forEach((emp: any) => {
      checkNewPage(10);
      doc.text(emp.employer || '', margin, y, { maxWidth: 75 });
      doc.text(emp.job_title || '', margin + 80, y, { maxWidth: 45 });
      doc.text(emp.dates || '', margin + 130, y, { maxWidth: 40 });
      y += lineHeight + 2;
    });
    y += sectionGap;
  }

  checkNewPage(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Education and Training', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Institution', margin, y);
  doc.text('From', margin + 60, y);
  doc.text('To', margin + 85, y);
  doc.text('Qualifications', margin + 110, y);
  y += lineHeight;
  drawLine(y - 3);
  doc.setFont('helvetica', 'normal');
  (formData.education || []).forEach((edu: any) => {
    checkNewPage(10);
    doc.text(edu.institution || '', margin, y, { maxWidth: 55 });
    doc.text(edu.from || '', margin + 60, y);
    doc.text(edu.to || '', margin + 85, y);
    doc.text(edu.qualifications || '', margin + 110, y, { maxWidth: 60 });
    y += lineHeight + 2;
  });
  if (formData.other_qualifications) {
    y += 4;
    doc.text('Other qualifications:', margin, y);
    y += lineHeight;
    doc.text(formData.other_qualifications, margin, y, { maxWidth: contentWidth });
    y += lineHeight + 4;
  }
  y += sectionGap;

  checkNewPage(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Information in support of your application', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (formData.skills_experience) {
    const skillLines = doc.splitTextToSize(formData.skills_experience, contentWidth);
    checkNewPage(skillLines.length * 5 + 10);
    doc.text(skillLines, margin, y);
    y += skillLines.length * 5 + sectionGap;
  }
  y += sectionGap;

  checkNewPage(30);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Medical', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Do you consider yourself to have a disability?', margin, y);
  const disX = margin + 80;
  doc.text('Yes', disX, y);
  drawCheckbox(disX + 10, y, formData.has_disability === true);
  doc.text('No', disX + 20, y);
  drawCheckbox(disX + 28, y, formData.has_disability === false);
  y += lineHeight + 2;
  if (formData.reasonable_adjustments) {
    doc.text(`Reasonable adjustments: ${formData.reasonable_adjustments}`, margin, y, { maxWidth: contentWidth });
    y += lineHeight + 2;
  }
  if (formData.unavailable_dates) {
    doc.text(`Unavailable dates: ${formData.unavailable_dates}`, margin, y);
    y += lineHeight + 2;
  }
  y += sectionGap;

  checkNewPage(20);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('7. Convictions', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Do you have any unspent criminal convictions or cautions?', margin, y);
  const convX = margin + 100;
  doc.text('Yes', convX, y);
  drawCheckbox(convX + 10, y, formData.has_convictions === true);
  doc.text('No', convX + 20, y);
  drawCheckbox(convX + 28, y, formData.has_convictions === false);
  y += sectionGap + 4;

  checkNewPage(50);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('8. References', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(10);
  const printReferee = (ref: any, label: string) => {
    if (!ref) return;
    checkNewPage(40);
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    y += lineHeight;
    doc.setFont('helvetica', 'normal');
    doc.text(`Name: ${ref.name || '............................'}`, margin, y);
    y += lineHeight;
    doc.text(`Address: ${ref.address || '............................'}`, margin, y, { maxWidth: contentWidth });
    y += lineHeight;
    doc.text(`Telephone: ${ref.telephone || '............................'}`, margin, y);
    doc.text(`Email: ${ref.email || '............................'}`, margin + 80, y);
    y += lineHeight;
    doc.text(`Relationship: ${ref.relationship || '............................'}`, margin, y);
    y += lineHeight + 4;
  };
  printReferee(formData.referee1, 'Referee 1');
  printReferee(formData.referee2, 'Referee 2');

  checkNewPage(40);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DECLARATION', margin, y);
  y += lineHeight + 3;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const declText = 'I declare that to the best of my knowledge the information given on this form is correct. I understand that any false information may result in my application not being considered, or if I am subsequently employed by the organisation, in the termination of my employment.';
  const declLines = doc.splitTextToSize(declText, contentWidth);
  doc.text(declLines, margin, y);
  y += declLines.length * 5 + 8;
  doc.setFontSize(10);
  doc.text(`Signature: ${formData.signature || '............................'}`, margin, y);
  y += lineHeight;
  doc.text(`Date: ${formatDateDDMMYYYY(formData.signature_date) || '............................'}`, margin, y);

  return doc;
}
