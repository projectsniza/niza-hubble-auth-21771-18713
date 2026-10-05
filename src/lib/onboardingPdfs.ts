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
export async function buildBankDetailsPdf(formDataInput: any): Promise<jsPDF> {
  const formData = formDataInput || {};
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
export async function buildStarterChecklistPdf(formDataInput: any): Promise<jsPDF> {
  const formData = formDataInput || {};
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
  formDataInput: any,
  orgName?: string,
  branchAddress?: string
): Promise<jsPDF> {
  const formData = formDataInput || {};
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

// ─────────────────────────────  COMPLETE MULTI-PAGE CONTRACT  ─────────────────────────────
export interface CompleteContractPdfParams {
  contractData: any;
  employeeData: any;
  organizationData?: any;
  branchData?: any;
  approvalData?: any;
}

export async function buildCompleteContractPdf({
  contractData = {},
  employeeData = {},
  organizationData = {},
  branchData = {},
  approvalData = {},
}: CompleteContractPdfParams): Promise<jsPDF> {
  const doc = new jsPDF();
  doc.setLineHeightFactor(1.42);
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  const headerHeight = 25;
  let y = headerHeight + 10;
  const lineHeight = 5;
  const sectionGap = 8;

  const logoDataUrl = await loadLogoImage();

  const addHeader = () => {
    if (logoDataUrl) {
      const logoWidth = 40;
      const logoHeight = 12;
      doc.addImage(logoDataUrl, 'PNG', pageWidth - margin - logoWidth, 10, logoWidth, logoHeight);
    }
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, headerHeight, pageWidth - margin, headerHeight);
  };

  addHeader();

  const addPage = () => {
    doc.addPage();
    addHeader();
    y = headerHeight + 10;
  };

  const checkPageBreak = (height: number) => {
    if (y + height > pageHeight - 20) {
      addPage();
    }
  };

  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, indent: number = 0) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(text, contentWidth - indent);
    checkPageBreak(lines.length * lineHeight + 2);
    doc.text(lines, margin + indent, y, { align: 'left' });
    y += lines.length * lineHeight + 2;
  };

  const addSectionTitle = (title: string) => {
    y += 3;
    checkPageBreak(7 + lineHeight * 2);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 7;
  };

  const addSubTitle = (title: string) => {
    checkPageBreak(6 + lineHeight * 2);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, y);
    y += 6;
  };

  const formatDateWithDay = (dateStr?: string) => {
    if (!dateStr) return '…………………………………………………';
    const parts = dateStr.split('-');
    const dt = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : new Date(dateStr);
    if (isNaN(dt.getTime())) return dateStr;
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()} - ${days[dt.getDay()]}`;
  };

  const formatDateDDMMYYYY = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    const dt = parts.length === 3 ? new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])) : new Date(dateStr);
    if (isNaN(dt.getTime())) return dateStr;
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${dt.getFullYear()}`;
  };

  // Resolve merged values with fallbacks across data structures
  const empName = contractData.employee_name || `${employeeData.first_name || ''} ${employeeData.last_name || ''}`.trim() || 'Employee';
  const empAddress = contractData.employee_address || employeeData.address || '';
  const orgName = organizationData?.name || employeeData.organizations?.name || employeeData.organization?.name || contractData.employer_name || 'SantoGe TECH';
  const orgRegNo = contractData.registered_number || organizationData?.registration_number || organizationData?.registered_number || '________';
  const orgVatNo = contractData.vat_number || organizationData?.vat_number || '';
  const orgOffice = contractData.registered_office || organizationData?.address || employeeData.organizations?.address || '________________';
  const commencementDate = contractData.commencement_date || contractData.start_date || employeeData.join_date || '……………………….';
  const jobTitle = contractData.job_title || employeeData.job_title || '………………………….';
  const hoursPerWeek = contractData.hours_per_week || contractData.weekly_hours || '………………………';
  const salaryRate = contractData.salary_rate || contractData.salary || contractData.hourly_rate || '………………………';
  const salaryType = contractData.salary_type || 'hourly';
  const placeOfWork = contractData.place_of_work || branchData?.address || employeeData.branches?.address || contractData.work_location || '…………………………………………………….....................';
  const holidayDays = contractData.holiday_days || '………………………';
  const contractDateStr = contractData.contract_date || employeeData.join_date || '';

  // Page 1 - Header
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('THIS CONTRACT OF EMPLOYMENT', pageWidth / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`is made on ${formatDateWithDay(contractDateStr)}`, pageWidth / 2, y, { align: 'center' });
  y += 12;

  // PARTIES
  addSectionTitle('PARTIES');
  const vatPart = orgVatNo ? ` (VAT: ${orgVatNo})` : '';
  addText(`1. ${orgName} a company incorporated in England and Wales (registered number ${orgRegNo})${vatPart} whose registered office is at ${orgOffice} (the Employer); and`);
  y += 2;
  addText(`2. ${empName || '[                  ]'} of ${empAddress || '[                                                                 ]'} (you).`);
  y += sectionGap;

  // THE PARTIES AGREE
  addSectionTitle('THE PARTIES AGREE:');

  // 1. Appointment
  addSectionTitle('1. Appointment');
  addText('1.1. The Employer will employ you on the terms and conditions set out in this contract.');
  addText(`1.2. Your employment with the Employer under this contract will commence on the date hereof ${commencementDate} (The Commencement Date).`);
  addText('1.3. Your period of continuous employment with the Employer commenced on the Commencement Date, and no period of employment with any previous employer counts as part of your period of continuous employment with the Employer.');
  addText('1.4. You warrant to the Employer that you have the unconditional right to work in the U.K. Should this right be withdrawn, or should your status materially change, you agree to notify the Employer immediately. The Employer reserves the right to terminate your employment, with or without notice (as appropriate), should your right to work in the U.K. be withdrawn.');
  addText('1.5. Any misrepresentation of your employment status is a serious disciplinary offence which may result in your dismissal.');
  addText('1.6. The first 6 months of your employment will be a probationary period (the Probationary Period), during which the Employer will monitor your performance and conduct. The Employer will confirm your continued employment to you when you have completed your Probationary Period to the Employer\'s satisfaction. During the Probationary Period, either the Employer or you may terminate your employment by giving one week\'s notice.');

  // 2. Duties
  addSectionTitle('2. Duties');
  addText(`2.1. You will be employed as a ${jobTitle} or in such other capacity as the Employer may from time to time reasonably direct.`);
  addText('2.2. In addition to your normal duties, you may be required to undertake alternative, additional, or ancillary duties from time to time or to transfer to another part of the business as the Employer may reasonably direct.');
  addText('2.3. Unless otherwise notified, you will report to the site manager (your Manager). The Employer may from time to time change your Manager.');

  // 3. Hours of work
  addSectionTitle('3. Hours of work');
  addText(`3.1. Your normal hours of work are ${hoursPerWeek} hours per week.`);
  addText('3.2. The Employer may vary your hours of work or the pattern of your normal hours, as it considers necessary to meet the needs of the business.');
  addText('3.3. You are required to work such additional hours as are deemed necessary by the Employer for the proper performance of your duties. You will not be entitled to any further remuneration for any such additional hours worked.');
  addText('3.4. If you are late for work this will result in you losing pay. The equivalent of one quarter of an hour\'s gross pay will be deducted in respect of each 15 minute period, or part thereof, for which you fail to attend. Persistent poor time-keeping may result in disciplinary action being taken against you.');
  addText('3.5. Subject to clauses 3.5.i. to iv. (inclusive) below, you will be entitled to a break during your hours of work on the basis set out below:');
  
  // Break table
  y += 3;
  doc.setFontSize(9);
  const breakData = [
    ['Less than 4 hours:', 'None'],
    ['4 < 6 hours:', '1x15mins unpaid'],
    ['6 < 7.5 hours:', '1x20mins unpaid'],
    ['7.5 or above:', '2x15mins unpaid, 1x30mins unpaid']
  ];
  breakData.forEach(([hours, breaks]) => {
    checkPageBreak(6);
    doc.text(`• ${hours} ${breaks}`, margin + 5, y);
    y += 5;
  });
  y += 3;

  // 4. Salary
  addSectionTitle('4. Salary');
  const salaryUnit = salaryType === 'annual' ? 'annum' : 'hour';
  addText(`4.1. The Employer will pay you a salary at the rate of £${salaryRate} per ${salaryUnit} (Salary).`);
  addText('4.2. All payments of Salary are subject to deductions for income tax and national insurance contributions and other authorised deductions or deductions required by law.');
  addText('4.3. You authorise the Employer at any time during your employment and/or on its termination to deduct any sums owed by you to the Employer at any time (to include, without limitation, the balance of salary, repayment of pay for holiday taken in excess of your accrued entitlement) from your Salary and/or from any other sums due to you under this contract.');

  // 5. Place of work
  addSectionTitle('5. Place of work and mobility');
  addText(`Your normal place of work will be at ${placeOfWork}`);

  // 6. Holiday
  addSectionTitle('6. Holiday');
  addText(`6.1. You will be entitled to ${holidayDays} days' paid holiday in each holiday year, which runs from 1st of April to 31st of March, excluding bank and public holidays which you normally work. Your holiday entitlement includes your statutory basic entitlement. If your employment starts or finishes part way through the holiday year, your holiday entitlement during that year shall be calculated on a pro-rata basis rounded up to the nearest whole day.`);
  addText('6.2. You acknowledge that the Employer trades on the usual bank holidays in England and Wales and that you may be scheduled to work in accordance with availability unless on Annual Leave.');
  addText('6.3. You must take all of your entitlement in the holiday year in which it accrues and carrying forward holiday is not permitted.');
  addText('6.4. You must give your Manager not less than 6 weeks\' written notice of your proposed holiday dates. Holidays are to be taken at such time or times as your Manager agrees and your Manager may refuse a request having regard to the reasonable requirements of the business for example, if someone in a similar position to you has already booked your requested holiday dates.');
  addText('6.5. The Employer reserves the right to require you to take holidays on particular dates including during any notice period or garden leave. You will be given reasonable notice of any such requirement, which may be less than is required under statute.');
  addText('6.6. On termination of your employment, you will be paid in lieu of accrued but untaken holiday entitlement in respect of the holiday year in which your employment terminates. You will be required to pay the Employer for holiday taken in excess of your accrued entitlement on termination.');

  // 7. Sickness
  addSectionTitle('7. Sickness');
  addText('7.1. If you are absent from work for any reason, you must inform your Manager by no later than 9.30 am on the first day of absence. The reason for absence and the expected duration of the absence should be given. If your absence from work is due to sickness or injury and continues for a period exceeding 7 consecutive days, you should provide your Manager with a Statement of Fitness for Work from your GP/other treating doctor as soon as possible after the 7th day of absence and weekly after that. You must keep your Manager informed on a regular basis of your progress and the date of your expected return to work.');
  addText('7.2. There is no pay for any absence due to illness or injury, other than statutory sick pay if you are eligible.');
  addText('7.3. At any time during your employment, you will, at the Employer\'s request, submit yourself to a medical examination by a medical practitioner nominated by the Employer. You authorise any nominated practitioner to disclose to the Employer the results of any such examination, your prognosis, your likely recovery time and/or fitness to return to work and any recommended treatment and to discuss it with the Employer. The Employer will pay all expenses associated with any such examination. The Employer reserves the right to postpone your return to work after a period of absence until it has received a report from a medical practitioner confirming that you are fit to return.');

  // 8. Disciplinary and grievance matters
  addSectionTitle('8. Disciplinary and grievance matters');
  addText('8.1. You are subject to the Employer\'s disciplinary and grievance rules and procedures. Such rules and procedures do not form part of this contract and may be altered or added to from time to time.');
  addText('8.2. The Employer may, in its absolute discretion, suspend you in order to investigate any claim or allegation which it considers could constitute serious misconduct, where relationships have broken down, where the Employer has any grounds to consider that its property or responsibilities to other parties are at risk, and/or where the Employer considers that your continued presence at the Employer\'s premises could hinder an investigation. Any such suspension is without prejudice to the Employer\'s right to subsequently terminate your employment on the same or any other ground and will last no longer than is necessary to carry out any inquiry or investigation into the circumstances and to hold any appropriate disciplinary hearings.');
  addText('8.3. If you wish to appeal against any disciplinary decision or decision to dismiss you, your appeal must be made in writing, and you should set out in detail the reasons for your appeal.');
  addText('8.4. If you wish to raise a grievance, you may do so by writing. You should set out in detail the circumstances of your complaint.');
  addText('8.5. The following acts or omissions may result in disciplinary action being taken against you:');
  
  const disciplinaryItems = [
    '8.5.1. Failure or refusal to comply with a reasonable and lawful instruction given to you by a manager or supervisor.',
    '8.5.2. Unauthorised absence for a reason other than illness or injury.',
    '8.5.3. Poor time keeping',
    '8.5.4. Any act of theft or dishonesty',
    '8.5.5. Fighting',
    '8.5.6. Drinking or being under the influence of drink or drugs',
    '8.5.7. Smoking in or near the shop floor, forecourt, or stockroom',
    '8.5.8. Being impolite or discourteous to members of the public',
    '8.5.9. Being inappropriately dressed whilst on duty. You should be clean and tidy.',
    '8.5.10. Failure to follow the appropriate procedure in relation staff purchases from the store. If you wish to purchase goods from your store you should ensure that:'
  ];
  disciplinaryItems.forEach(item => {
    addText(item, 10, false, 5);
  });
  const subDisciplinary = [
    '8.5.10.1. You are served by your immediate manager or supervisor',
    '8.5.10.2. You pay for the goods immediately; and',
    '8.5.10.3. You obtain and retain a receipt for the goods'
  ];
  subDisciplinary.forEach(item => {
    addText(item, 10, false, 10);
  });
  addText('This list is not exhaustive.', 10, false, 5);

  // 9. Grievance Procedure
  addSectionTitle('9. Grievance Procedure');
  addText('9.1. The object of the grievance procedure is to enable employees who consider they have a grievance or complaint arising from their employment with the Employer to have it dealt with at the nearest appropriate level within as short a time as possible. Anyone wishing to use this procedure can do so freely and without prejudice to his/her position in the Employer. It applies to all employees, irrespective of job or grade.');
  addText('9.2. At all stages of the grievance procedure, you may be accompanied by a fellow worker or a trade union official of your choice. Each step of the grievance procedure will be processed without unreasonable delay.');
  
  addSubTitle('Informal Resolution');
  addText('In many cases grievances can be resolved informally without activating the formal procedure. Employees should aim to resolve grievances informally by either writing to or speaking with their line manager or the person responsible for causing the grievance to arise. There is of course no obligation for an employee to use the informal procedure. By seeking to resolve grievances on an informal basis, this will often allow for problems to be resolved quickly. If the employee considers that the nature of the grievance is such that it cannot be resolved informally, or if the informal process does not resolve the issue, then the formal procedure should be used.');
  
  addSubTitle('Formal Procedure');
  addText('STEP 1: In the first instance all grievances must be submitted in writing to your Manager who will attempt to deal with the matter after making such consultations as are necessary. Employees are expected to submit the full details of their grievance in writing and any documents relied upon in support to their employer at the earliest opportunity.');
  addText('STEP 2: Every opportunity will be given for your grievance to be stated and thoroughly discussed. You will be invited to attend a meeting to discuss your grievance and have the right to be accompanied by a union representative or workplace colleague. It is the responsibility of the employee to ensure that their union representative or workplace colleague is available to accompany them at the meeting. As appropriate further investigation may take place and action taken. After the meeting, you will be informed of the result, and what further action will be taken where appropriate. A decision will be given within 10 working days of the meeting unless further investigation is required or where this has been extended by mutual consent. If you are not satisfied with the response, you can appeal against the decision in writing within 5 working days of being informed of the outcome of the grievance.');
  addText('STEP 3: If you wish to appeal, you will be invited to a further meeting. Employees are expected to submit the grounds for appealing the earlier decision and relevant documentation in advance of the appeal hearing. This will be heard by a more senior manager where this is reasonably practicable. You will have the right to be accompanied by a union representative or workplace colleague and to make a submission for consideration. After the appeal meeting, you will be informed of the Employer\'s decision. This decision is final and the grievance procedure is exhausted following this stage.');

  // 10. Disciplinary Action
  addSectionTitle('10. Disciplinary Action');
  addText('10.1. If your grievance concerns the imposition of an oral or written disciplinary warning, you may use the grievance procedure to seek redress rather than appealing under the Employer\'s disciplinary procedure.');
  addText('10.2. If your grievance is that the imposition of a disciplinary sanction amounts to discrimination or victimisation, or where you do not accept that the disciplinary sanction was imposed for the reasons relied upon by the Employer, you may seek redress under the grievance procedure.');
  addText('10.3. The Employer reserves the right to deal with such grievances through the disciplinary procedure where this is deemed to be more appropriate. If you are in any doubt as to which procedure to use, advice can be obtained from the Manager.');
  addText('10.4. In circumstances where it is not practicable to adhere to the above procedure within a reasonable period of time, the Employer will modify the procedure as appropriate following consultation with the employee.');
  addText('10.5. The Employer requires good standards of discipline from its employees, together with satisfactory standards of work. These disciplinary procedures apply to any misconduct or failure to meet standards of performance or attendance.');
  addText('10.6. The purpose of this procedure is to be corrective rather than punitive and it should be recognised that the existence of procedures such as these is to help and encourage the employee to achieve and maintain standards of conduct, attendance, and job performance and to ensure consistent and fair treatment for all employees.');
  addText('10.7. If your standard of work or conduct falls, and, after warnings, remains below the level which is acceptable, you may be dismissed.');
  addText('10.8. Summary dismissal without notice will take place if an act of gross misconduct is committed. Gross misconduct is any deliberate act by an employee that is detrimental to the good conduct of the Employer\'s business. Examples of misconduct and gross misconduct are listed at 8.5.');

  // 11. Disciplinary Procedure
  addSectionTitle('11. Disciplinary Procedure');
  addText('11.1. The following stages in the disciplinary procedure are outlined below. The Employer reserves the right to activate any stage of the procedure where appropriate.');
  
  addSubTitle('STAGE 1 – Improvement Notice: Unsatisfactory Performance');
  addText('If your performance does not meet the acceptable standards expected by the Employer, you may normally be given an improvement notice. This will set out the performance problem, the improvement that is required, and the time-scale and will also include details of any help that may be given following discussion with you. You will be advised that this constitutes the first stage of the formal procedure. A record of the improvement notice will remain live for 12 months, subject to satisfactory performance.');
  
  addSubTitle('STAGE 2 – First Written Warning');
  addText('If your conduct does not meet acceptable standards you will normally be given a written warning. This will set out the nature of the misconduct and the standard of conduct expected. The written warning will confirm that a final written warning may be considered appropriate if there is no sustained satisfactory improvement. A record of the warning will be kept on file, and will be disregarded for disciplinary purposes after a specified period of 12 months depending upon satisfactory conduct/performance.');
  
  addSubTitle('STAGE 3 – Second Written Warning');
  addText('If your conduct continues to fall below acceptable standards you may be given a second written warning. This will set out the nature of the misconduct and the standard of conduct expected. The second written warning will confirm that a final written warning may be considered appropriate if there is no sustained satisfactory improvement. A record of the warning will be kept on file, and will be disregarded for disciplinary purposes after a specified period of 12 months depending upon satisfactory conduct/performance. The decision to issue a sanction at Stage 3 is at the Employer\'s discretion depending upon the nature and circumstances of the unsatisfactory conduct or performance in question.');
  
  addSubTitle('STAGE 4 – Final Written Warning');
  addText('If the offence is sufficiently serious, or there is a failure to improve during the currency of a prior warning for the same type of offence, a final written warning may be given to the employee. This will give details of the complaint, the improvement required and the timescale. It will also warn that failure to improve may lead to action under Stage 5 (dismissal or some other action short of dismissal), and will refer to the right of appeal. A copy of this written warning will be kept on file and will be disregarded for disciplinary purposes after 12 months subject to satisfactory conduct/performance.');
  
  addSubTitle('STAGE 5 – Dismissal or Other Sanction');
  addText('If there is still a failure to improve, or where the conduct or performance is sufficiently serious, the final step in the procedure may be dismissal or some other action short of dismissal such as demotion or disciplinary suspension or transfer (as allowed in the contract of employment). Dismissal decisions can only be taken by your Manager and the employee will be provided, as soon as reasonably practicable, with written reasons for dismissal, the date on which the employment will terminate, as well as their right of appeal. The decision to dismiss will be confirmed in writing. In cases of gross misconduct, you will normally be dismissed without notice or pay in lieu of notice. In exceptional circumstances, or if there are any genuine mitigating circumstances, alternative disciplinary action may be taken.');

  addText('11.2. In circumstances where an employee faces dismissal, or certain action short of dismissal such as loss of pay or demotion (but excluding oral or written warnings) the minimum statutory procedure will be followed consisting of three steps. Step 1 consists of a written note to the employee setting out the allegation and the basis for it. Step 2 consists of a meeting to consider and discuss the allegation, following which a decision is taken. Step 3 involves the employee submitting a letter of appeal (including the reasons and basis for the appeal and documentation relied upon in support) followed by an appeal meeting. The employee will be reminded of their right to be accompanied prior to any meeting which is convened.');

  // 12. Appeals Procedure
  addSectionTitle('12. Appeals Procedure');
  addText('12.1. If you are dissatisfied with any disciplinary decision affecting you, you may appeal to your Manager within five working days of the disciplinary decision.');
  addText('12.2. Any appeal must be put in writing, stating the grounds for the appeal and including any documentation or evidence relied upon in support. If the disciplinary action which is the subject of the appeal is your dismissal, the decision to dismiss will stand unless it is reversed on appeal.');
  addText('12.3. You will be invited to attend an appeal meeting. A more senior manager will hear this where this is reasonably practicable. At the appeal hearing, you will be permitted to state your case.');
  addText('12.4. Within a reasonable period of time after the appeal meeting, you will be informed of the decision. The decision of the manager hearing the appeal is final. There is no further right of internal appeal.');

  // 13. Pension
  addSectionTitle('13. Pension');
  addText('The Employer will comply with the employer pension duties concerning pension auto-enrolment in accordance with Part 1 of the Pensions Act 2008 from that date that it is legally required to do so. Subject to your age and earnings level, you will be automatically enrolled into either a qualifying pension scheme or the National Employment Savings Trusts ("NEST") whichever the Employer chooses. You can decide to opt out of auto-enrolment. Further information about your pension choices will be provided at the appropriate time.');

  // 14. Termination
  addSectionTitle('14. Termination of employment');
  addText('14.1. You may terminate your employment at any time on giving to the Employer not less than three weeks prior written notice and the Employer may terminate your employment at any time on giving you the statutory minimum notice.');
  addText('14.2. Nothing in this contract will prevent the Employer from terminating your employment, without notice or payment in lieu of notice, in a case of gross misconduct justifying summary dismissal without notice, or if you cease to be permitted to work in the United Kingdom. Examples of matters which will usually be regarded as gross misconduct are listed in clause 8.5.');
  addText('14.3. The Employer may in its sole and absolute discretion terminate your employment at any time with immediate effect by making a payment to you in lieu of notice.');

  // 15. Data protection
  addSectionTitle('15. Data protection and monitoring');
  addText('15.1. You consent to the Employer processing personal data and sensitive personal data (as defined in the Data Protection Act 1998) concerning you in its manual and computerised/automated filing systems internally and, so far as is reasonably necessary, externally, for the purposes of complying with statutory requirements, meeting the Employer\'s legitimate interests, properly conducting the Employer\'s business, complying with the terms of this contract and for all purposes in connection with your employment with the Employer.');
  addText('15.2. You consent to your personal data and sensitive personal data for the purposes envisaged in clause 15.1 above being transferred to and processed by:');
  const dpItems = [
    '15.2.1. any Group Employer and their employees;',
    '15.2.2. professional advisors of the Employer or of the Group;',
    '15.2.3. any third-party providing services to the Employer or to the Group for the benefit of its employees;',
    '15.2.4. HM Revenue and Customs or other authorities; and',
    '15.2.5. Prospective purchasers of all or any part of the Employer\'s business in return for suitable confidentiality undertakings regardless of the country to which the data is to be transferred.'
  ];
  dpItems.forEach(item => {
    addText(item, 10, false, 5);
  });
  addText('15.3. You consent to the Employer monitoring, intercepting, reading, and recording your telephone, email, and other electronic communications for the purpose of monitoring and recording to establish facts, to establish compliance with regulatory procedures, to prevent or detect crime, to investigate or detect the unauthorised use of the Employer\'s systems or to ascertain compliance with the Employer\'s practices or procedures. The Employer may also monitor and record communications to check that they are relevant to its business.');

  // 16. Variation
  addSectionTitle('16. Variation');
  addText('The Employer reserves the right to make reasonable changes to any of your terms and conditions of employment. Changes to your terms and conditions of employment will be notified to you in writing before the date upon which they come into force.');

  // 17. Policies
  addSectionTitle('17. Policies and Procedures');
  addText('You agree to comply with the rules, policies, and procedures of the Employer from time to time in force, although these do not form part of your contract of employment (unless stated otherwise).');

  // 18. Collective Agreement
  addSectionTitle('18. Collective Agreement');
  addText('There is no collective agreement which directly affects your employment.');

  // 19. Entire agreement
  addSectionTitle('19. Entire agreement');
  addText('19.1. This contract is the entire agreement between you and the Employer in relation to its subject matter and replaces all previous agreements and arrangements (whether written or oral, express, or implied) relating to your employment by the Employer. Any such previous agreements and arrangements will be deemed to have been terminated by mutual consent as from the date of this contract.');
  addText('19.2. The information contained in this contract contains the particulars required for a written statement under Section 1 of the Employment Rights Act 1996.');

  // Signatures — keep the heading with the whole employee block on one page
  y += 10;
  checkPageBreak(75);
  addSectionTitle('AGREED by the parties');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // ── Employee Section ──
  const empSig = contractData.employee_signature_data || contractData.employee_signature;
  if (empSig && typeof empSig === 'string' && empSig.startsWith('data:image')) {
    try {
      doc.addImage(empSig, 'PNG', margin, y, 60, 15);
      y += 18;
    } catch {}
  }
  doc.text('______________________________', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('(Employee Signature)', margin, y);
  doc.setFontSize(10);
  y += 8;

  doc.text('I agree to the above terms', margin, y);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.text('Signed: ', margin, y);
  const signedLabelWidth = doc.getTextWidth('Signed: ');
  doc.setFont('helvetica', 'bold');
  doc.text(empName?.toUpperCase() || '______________________________', margin + signedLabelWidth, y);
  doc.setFont('helvetica', 'normal');
  y += 7;
  
  const empSignDate = formatDateDDMMYYYY(contractData.employee_signed_date || contractData.contract_date);
  doc.text(`Date: ${empSignDate || '______________________________'}`, margin, y);
  y += 25;

  // ── Employer Section ── keep the whole block together on one page
  checkPageBreak(60);

  const employerSig = approvalData?.employer_signature || contractData.employer_signature;
  const employerSigType = approvalData?.employer_signature_type || contractData.employer_signature_type;
  
  if (employerSig && (employerSigType === 'drawn' || employerSigType === 'uploaded') && typeof employerSig === 'string' && employerSig.startsWith('data:image')) {
    try {
      doc.addImage(employerSig, 'PNG', margin, y, 60, 15);
      y += 18;
    } catch {}
  } else if (employerSig && employerSigType === 'typed') {
    doc.setFont('helvetica', 'bolditalic');
    doc.setFontSize(14);
    doc.text(employerSig, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    y += 12;
  }
  doc.text('______________________________', margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.text('(Authorized Signature)', margin, y);
  doc.setFontSize(10);
  y += 10;

  doc.setFont('helvetica', 'normal');
  doc.text('Signed on behalf of the Employer', margin, y);
  y += 10;
  
  const employerNameVal = approvalData?.employer_name || contractData.employer_name || (approvalData?.contract_content as any)?.employer_name || '';
  if (employerNameVal) {
    doc.setFont('helvetica', 'bold');
    doc.text(employerNameVal.toUpperCase(), margin, y);
    doc.setFont('helvetica', 'normal');
    y += 7;
  }

  const employerSignedDate = approvalData?.employer_signed_date || contractData.employer_signed_date || approvalData?.approved_at || '';
  const formattedEmployerDate = formatDateDDMMYYYY(employerSignedDate);
  doc.text(`Date: ${formattedEmployerDate || '______________________________'}`, margin, y);
  y += 8;

  return doc;
}



