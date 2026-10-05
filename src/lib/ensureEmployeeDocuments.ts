import { supabase } from '@/integrations/supabase/client';
import {
  buildApplicationFormPdf,
  buildStarterChecklistPdf,
  buildBankDetailsPdf,
} from '@/lib/onboardingPdfs';

/**
 * Finds or creates the employee's folder inside the Company Documents hierarchy:
 * Company Documents → [Organization Folder] → [Branch Folder] → [Employee Name Folder]
 */
export async function getOrCreateEmployeeFolder(
  employeeId: string,
  employeeData?: any,
  uploadedBy?: string
): Promise<string | null> {
  try {
    let employee = employeeData;
    if (!employee || !employee.first_name) {
      const { data: empRecord } = await supabase
        .from('employees')
        .select('*, organizations(id, name), branches(id, name)')
        .eq('id', employeeId)
        .maybeSingle();
      employee = empRecord;
    }

    if (!employee) return null;

    const empName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || 'Employee';

    // 1. Find or create root folder "Company Documents"
    let rootFolderId: string | null = null;
    const { data: rootFolder } = await supabase
      .from('folders')
      .select('id, path')
      .eq('folder_type', 'root')
      .eq('path', 'Company Documents')
      .maybeSingle();

    if (rootFolder) {
      rootFolderId = rootFolder.id;
    } else {
      const { data: newRoot } = await supabase
        .from('folders')
        .insert({
          name: 'Company Documents',
          path: 'Company Documents',
          folder_type: 'root',
          created_by: uploadedBy || null,
        })
        .select('id')
        .maybeSingle();
      rootFolderId = newRoot?.id || null;
    }

    // 2. Find or create Organization Folder (if org exists)
    let parentFolderId = rootFolderId;
    let currentPath = 'Company Documents';

    const orgName = employee.organizations?.name;
    const orgId = employee.organization_id || employee.organizations?.id;

    if (orgName && parentFolderId) {
      let orgFolderId: string | null = null;
      const { data: existingOrgFolder } = await supabase
        .from('folders')
        .select('id, path')
        .eq('parent_id', parentFolderId)
        .eq('name', orgName)
        .maybeSingle();

      if (existingOrgFolder) {
        orgFolderId = existingOrgFolder.id;
        currentPath = existingOrgFolder.path;
      } else {
        const orgPath = `${currentPath}/${orgName}`;
        const { data: newOrgFolder } = await supabase
          .from('folders')
          .insert({
            name: orgName,
            path: orgPath,
            parent_id: parentFolderId,
            folder_type: 'organization',
            organization_id: orgId || null,
            created_by: uploadedBy || null,
          })
          .select('id')
          .maybeSingle();

        if (newOrgFolder) {
          orgFolderId = newOrgFolder.id;
          currentPath = orgPath;
        }
      }

      if (orgFolderId) {
        parentFolderId = orgFolderId;
      }
    }

    // 3. Find or create Branch Folder (if branch exists)
    const branchName = employee.branches?.name;
    const branchId = employee.branch_id || employee.branches?.id;

    if (branchName && parentFolderId) {
      let branchFolderId: string | null = null;
      const { data: existingBranchFolder } = await supabase
        .from('folders')
        .select('id, path')
        .eq('parent_id', parentFolderId)
        .eq('name', branchName)
        .maybeSingle();

      if (existingBranchFolder) {
        branchFolderId = existingBranchFolder.id;
        currentPath = existingBranchFolder.path;
      } else {
        const branchPath = `${currentPath}/${branchName}`;
        const { data: newBranchFolder } = await supabase
          .from('folders')
          .insert({
            name: branchName,
            path: branchPath,
            parent_id: parentFolderId,
            folder_type: 'branch',
            branch_id: branchId || null,
            organization_id: orgId || null,
            created_by: uploadedBy || null,
          })
          .select('id')
          .maybeSingle();

        if (newBranchFolder) {
          branchFolderId = newBranchFolder.id;
          currentPath = branchPath;
        }
      }

      if (branchFolderId) {
        parentFolderId = branchFolderId;
      }
    }

    // 4. Find or create Employee Folder under parent folder
    let existingEmpFolder: any = null;
    if (employeeId) {
      const { data } = await supabase
        .from('folders')
        .select('id, parent_id, path')
        .eq('folder_type', 'employee')
        .eq('employee_id', employeeId)
        .maybeSingle();
      existingEmpFolder = data;
    }

    if (!existingEmpFolder && parentFolderId) {
      const { data } = await supabase
        .from('folders')
        .select('id, parent_id, path')
        .eq('folder_type', 'employee')
        .eq('parent_id', parentFolderId)
        .eq('name', empName)
        .maybeSingle();
      existingEmpFolder = data;
      if (existingEmpFolder && employeeId) {
        await supabase
          .from('folders')
          .update({ employee_id: employeeId })
          .eq('id', existingEmpFolder.id);
      }
    }

    if (existingEmpFolder) {
      // If employee was transferred to a new branch, cleanly move the existing folder to the new branch
      if (parentFolderId && existingEmpFolder.parent_id !== parentFolderId) {
        const employeeFolderPath = `${currentPath}/${empName}`;
        await supabase
          .from('folders')
          .update({
            parent_id: parentFolderId,
            branch_id: branchId || null,
            organization_id: orgId || null,
            path: employeeFolderPath,
          })
          .eq('id', existingEmpFolder.id);
      }
      return existingEmpFolder.id;
    }

    const employeeFolderPath = `${currentPath}/${empName}`;
    const { data: newEmpFolder, error: createErr } = await supabase
      .from('folders')
      .insert({
        name: empName,
        path: employeeFolderPath,
        parent_id: parentFolderId,
        folder_type: 'employee',
        employee_id: employeeId,
        branch_id: branchId || null,
        organization_id: orgId || null,
        created_by: uploadedBy || null,
      })
      .select('id')
      .single();

    if (createErr) {
      console.error('Failed to create employee folder:', createErr);
      return null;
    }

    return newEmpFolder?.id || null;
  } catch (err) {
    console.error('getOrCreateEmployeeFolder error:', err);
    return null;
  }
}

/**
 * Ensures that all 3 onboarding documents (Application Form, Starter Checklist, Bank Details)
 * exist for the specified employee and are assigned to their Company Documents folder.
 * If any document is missing, it is generated and uploaded automatically.
 */
export async function ensureEmployeeDocuments(
  employeeId: string,
  targetFolderId?: string | null,
  uploadedBy?: string
): Promise<{ success: boolean; folderId: string | null; generatedCount: number }> {
  try {
    // 0. Check if auto-saving onboarding forms to documents is enabled in Onboarding Settings
    const { data: autoSaveSetting } = await supabase
      .from('onboarding_form_settings')
      .select('enabled')
      .eq('form_type', 'auto_save_forms_to_documents')
      .maybeSingle();

    // Default is false: unless toggled ON in Onboarding Settings, do not automatically push form PDFs to documents folder
    if (!autoSaveSetting?.enabled) {
      return { success: true, folderId: targetFolderId || null, generatedCount: 0 };
    }

    // 1. Fetch full employee record
    const { data: employee, error: empErr } = await supabase
      .from('employees')
      .select('*, organizations(id, name), branches(id, name)')
      .eq('id', employeeId)
      .maybeSingle();

    if (empErr || !employee) {
      console.error('Could not find employee for ensureEmployeeDocuments:', empErr);
      return { success: false, folderId: targetFolderId || null, generatedCount: 0 };
    }

    // 2. Resolve folder ID
    let folderId = targetFolderId;
    if (!folderId) {
      folderId = await getOrCreateEmployeeFolder(employeeId, employee, uploadedBy);
    }

    // 3. Fetch all existing documents for this employee with comprehensive deduplication
    const { data: existingDocs } = await supabase
      .from('documents')
      .select('id, title, file_name, file_path, folder_id')
      .eq('employee_id', employeeId);

    const hasDoc = (keyword: string) => {
      const lower = keyword.toLowerCase();
      const slug = lower.replace(/\s+/g, '_');
      return (existingDocs || []).some((d: any) => {
        const titleLower = (d.title || '').toLowerCase();
        const fileLower = (d.file_name || '').toLowerCase();
        return titleLower.includes(lower) || fileLower.includes(slug);
      });
    };

    // Update folder_id for existing documents if transferred to a new folder
    if (folderId && existingDocs && existingDocs.length > 0) {
      for (const d of existingDocs) {
        if (d.folder_id !== folderId) {
          supabase
            .from('documents')
            .update({ folder_id: folderId })
            .eq('id', d.id)
            .then();
        }
      }
    }

    // 4. Fetch all 3 onboarding form responses
    const [appRes, starterRes, bankRes] = await Promise.all([
      supabase
        .from('onboarding_form_responses')
        .select('form_data')
        .eq('employee_id', employeeId)
        .eq('form_type', 'application_form')
        .maybeSingle(),
      supabase
        .from('onboarding_form_responses')
        .select('form_data')
        .eq('employee_id', employeeId)
        .eq('form_type', 'starter_checklist')
        .maybeSingle(),
      supabase
        .from('onboarding_form_responses')
        .select('form_data')
        .eq('employee_id', employeeId)
        .eq('form_type', 'bank_details')
        .maybeSingle(),
    ]);

    const orgName = employee?.organizations?.name;
    const branchName = employee?.branches?.name;

    const uploads: Array<{ title: string; doc: any; baseName: string }> = [];

    // --- APPLICATION FORM ---
    if (!hasDoc('Application Form')) {
      const appData = appRes?.data?.form_data || {
        organization_id: employee.organization_id,
        branch_id: employee.branch_id,
        name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim(),
        position: employee.job_title || '',
        phone: employee.phone || '',
        email: employee.email || '',
        address: employee.address || '',
        start_date: employee.join_date || '',
        declaration_agreed: true,
      };
      try {
        const doc = await buildApplicationFormPdf(appData as any, orgName, branchName);
        uploads.push({ title: 'Application Form', doc, baseName: 'Application_Form' });
      } catch (e) {
        console.error('Error generating Application Form PDF:', e);
      }
    }

    // --- STARTER CHECKLIST ---
    if (!hasDoc('Starter Checklist')) {
      const appData = (appRes?.data?.form_data as any) || {};
      const starterData = starterRes?.data?.form_data || {
        first_names: employee.first_name || appData.name?.split(' ')?.[0] || '',
        last_name: employee.last_name || appData.name?.split(' ')?.slice(1)?.join(' ') || '',
        gender: '',
        date_of_birth: employee.date_of_birth || '',
        address: employee.address || appData.address || '',
        postcode: appData.postcode || '',
        country: 'United Kingdom',
        national_insurance: employee.national_insurance_number || '',
        employment_start_date: employee.join_date || appData.start_date || '',
        statement: 'A',
        has_student_loan: false,
        repaying_direct: false,
        declaration_agreed: true,
      };
      try {
        const doc = await buildStarterChecklistPdf(starterData as any);
        uploads.push({ title: 'Starter Checklist', doc, baseName: 'Starter_Checklist' });
      } catch (e) {
        console.error('Error generating Starter Checklist PDF:', e);
      }
    }

    // --- BANK DETAILS ---
    if (!hasDoc('Bank Details')) {
      const appData = (appRes?.data?.form_data as any) || {};
      const bankData = bankRes?.data?.form_data || {
        your_name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || appData.name || '',
        telephone_number: employee.phone || appData.phone || '',
        bank_name: '',
        bank_address: '',
        bank_telephone: '',
        sort_code: '',
        account_number: '',
        building_society_roll: '',
        account_holder_name: `${employee.first_name || ''} ${employee.last_name || ''}`.trim() || appData.name || '',
        declaration_agreed: true,
      };
      try {
        const doc = await buildBankDetailsPdf(bankData as any);
        uploads.push({ title: 'Bank Details', doc, baseName: 'Bank_Details' });
      } catch (e) {
        console.error('Error generating Bank Details PDF:', e);
      }
    }

    let generatedCount = 0;

    for (const u of uploads) {
      try {
        const blob: Blob = u.doc.output('blob');
        const fileName = `${u.baseName}_${employeeId}_${Date.now()}.pdf`;
        const filePath = `employees/${employeeId}/onboarding-forms/${fileName}`;

        const { error: upErr } = await supabase.storage
          .from('documents')
          .upload(filePath, blob, { contentType: 'application/pdf', upsert: true });

        if (upErr) {
          console.error(`Failed to upload ${u.title}:`, upErr);
          continue;
        }

        const { error: insErr } = await supabase.from('documents').insert({
          title: u.title,
          file_name: `${u.baseName}.pdf`,
          file_path: filePath,
          file_type: 'application/pdf',
          file_size: blob.size,
          employee_id: employeeId,
          folder_id: folderId,
          uploaded_by: uploadedBy || null,
        });

        if (!insErr) {
          generatedCount++;
        } else {
          console.error(`Failed to insert document record for ${u.title}:`, insErr);
        }
      } catch (itemErr) {
        console.error(`Error processing ${u.title}:`, itemErr);
      }
    }

    return { success: true, folderId, generatedCount };
  } catch (err) {
    console.error('ensureEmployeeDocuments error:', err);
    return { success: false, folderId: targetFolderId || null, generatedCount: 0 };
  }
}
