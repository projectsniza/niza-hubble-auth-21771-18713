import { supabase } from '@/integrations/supabase/client';

export type TimesheetVerificationMode = 'disabled' | 'passcode' | 'two_factor';

export interface BranchPasscodeInfo {
  branchId: string;
  isPasscodeSet: boolean;
  passcode?: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export interface TimesheetSecurityConfig {
  mode: TimesheetVerificationMode;
  isPasscodeSet: boolean;
  passcode?: string;
  branchPasscodes?: Record<string, BranchPasscodeInfo>;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const TIMESHEET_MODE_STORAGE_KEY = 'niza_timesheet_verification_mode';
export const TIMESHEET_PASSCODE_CONFIGURED_KEY = 'niza_timesheet_passcode_configured';
export const TIMESHEET_GLOBAL_PASSCODE_KEY = 'niza_timesheet_global_passcode';
export const TIMESHEET_BRANCH_PASSCODES_KEY = 'niza_timesheet_branch_passcodes';
export const TIMESHEET_LAST_UPDATED_KEY = 'niza_timesheet_last_updated';
export const TIMESHEET_UPDATED_BY_KEY = 'niza_timesheet_updated_by';
export const TIMESHEET_SESSION_VERIFIED_KEY = 'niza_timesheet_session_verified_until';

// In-memory cache for instant synchronous evaluation
let memoryTimesheetMode: TimesheetVerificationMode = (() => {
  try {
    const cached = localStorage.getItem(TIMESHEET_MODE_STORAGE_KEY);
    if (cached === 'disabled' || cached === 'passcode' || cached === 'two_factor') {
      return cached;
    }
  } catch {}
  return 'disabled';
})();

let memoryPasscodeConfigured: boolean = (() => {
  try {
    return localStorage.getItem(TIMESHEET_PASSCODE_CONFIGURED_KEY) === 'true';
  } catch {
    return false;
  }
})();

let memoryGlobalPasscode: string = (() => {
  try {
    return localStorage.getItem(TIMESHEET_GLOBAL_PASSCODE_KEY) || '';
  } catch {
    return '';
  }
})();

let memoryBranchPasscodes: Record<string, BranchPasscodeInfo> = (() => {
  try {
    const cached = localStorage.getItem(TIMESHEET_BRANCH_PASSCODES_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {}
  return {};
})();

let memoryTimesheetVerifiedUntil = 0;

/**
 * Returns the currently cached Timesheets verification mode synchronously.
 */
export function getTimesheetVerificationModeSync(): TimesheetVerificationMode {
  return memoryTimesheetMode;
}

/**
 * Returns true if a passcode is configured in Super Admin settings (globally or for the specified branch).
 */
export function isTimesheetPasscodeConfiguredSync(branchId?: string): boolean {
  if (branchId) {
    return Boolean(memoryBranchPasscodes[branchId]?.isPasscodeSet && memoryBranchPasscodes[branchId]?.passcode);
  }
  return memoryPasscodeConfigured;
}

/**
 * Check if the active session is already verified for timesheet actions.
 * Verified tokens persist in memory for the active app session.
 */
export function isTimesheetSessionVerified(branchId?: string): boolean {
  const mode = getTimesheetVerificationModeSync();
  // If disabled, automatically verified
  if (mode === 'disabled') {
    return true;
  }
  // If passcode mode but no passcode set yet: give normal login/access until set!
  if (mode === 'passcode' && !isTimesheetPasscodeConfiguredSync(branchId)) {
    return true;
  }
  return Date.now() < memoryTimesheetVerifiedUntil;
}

/**
 * Mark the current timesheet session as verified.
 * For passcode mode, verification defaults to a 2-minute scheduling window so security remains tight.
 */
export function setTimesheetSessionVerified(durationMinutes = 2): void {
  memoryTimesheetVerifiedUntil = Date.now() + durationMinutes * 60 * 1000;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('niza_timesheet_session_unlocked'));
  }
}

/**
 * Clear timesheet verification session.
 */
export function clearTimesheetSessionVerified(): void {
  memoryTimesheetVerifiedUntil = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('niza_timesheet_session_locked'));
  }
}

/**
 * Determines whether a store account needs verification before editing timesheets.
 * Evaluates mode:
 * - 'disabled': false (never required)
 * - 'passcode': true only if passcode IS set and session NOT yet verified
 * - 'two_factor': true only if session NOT yet verified
 */
export function isTimesheetVerificationRequiredSync(branchId?: string): boolean {
  const mode = getTimesheetVerificationModeSync();
  if (mode === 'disabled') {
    return false;
  }
  if (mode === 'passcode') {
    // Until passcode is set, normal login only!
    if (!isTimesheetPasscodeConfiguredSync(branchId)) {
      return false;
    }
    return !isTimesheetSessionVerified(branchId);
  }
  if (mode === 'two_factor') {
    return !isTimesheetSessionVerified(branchId);
  }
  return false;
}

/**
 * Fetch latest Timesheet security configuration from Edge Function & DB.
 */
export async function getTimesheetSecurityConfig(): Promise<TimesheetSecurityConfig> {
  // Always initialize from memory/localStorage
  let mode: TimesheetVerificationMode = memoryTimesheetMode;
  let isPasscodeSet = memoryPasscodeConfigured;
  let passcode = memoryGlobalPasscode;
  let branchPasscodes: Record<string, BranchPasscodeInfo> = { ...memoryBranchPasscodes };
  let updatedAt = localStorage.getItem(TIMESHEET_LAST_UPDATED_KEY);
  let updatedBy = localStorage.getItem(TIMESHEET_UPDATED_BY_KEY);

  // 1. Direct DB check on dedicated Master Passcode row (immune to branch overrides)
  try {
    const { data: masterRow } = await supabase
      .from('message_settings')
      .select('setting_value, updated_at, description')
      .eq('setting_key', 'timesheet_master_passcode')
      .maybeSingle();

    if (masterRow?.setting_value && typeof masterRow.setting_value === 'object') {
      const mv = masterRow.setting_value as any;
      if (mv.passcode_plain !== undefined && mv.passcode_plain !== '') {
        passcode = mv.passcode_plain;
        isPasscodeSet = Boolean(mv.is_set !== false && mv.passcode_plain);
        memoryGlobalPasscode = passcode;
        memoryPasscodeConfigured = isPasscodeSet;
        try {
          localStorage.setItem(TIMESHEET_GLOBAL_PASSCODE_KEY, passcode);
          localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, String(isPasscodeSet));
        } catch {}
      }
    }
  } catch {}

  // 2. Direct DB check on dedicated Branch Passcodes row
  try {
    const { data: branchRow } = await supabase
      .from('message_settings')
      .select('setting_value')
      .eq('setting_key', 'timesheet_branch_passcodes_config')
      .maybeSingle();

    if (branchRow?.setting_value && typeof branchRow.setting_value === 'object') {
      const bMap = branchRow.setting_value as Record<string, any>;
      for (const [bId, bObj] of Object.entries(bMap)) {
        if (bObj && typeof bObj === 'object') {
          branchPasscodes[bId] = {
            branchId: bId,
            isPasscodeSet: Boolean(bObj.is_set),
            passcode: bObj.passcode_plain || branchPasscodes[bId]?.passcode,
            updatedAt: bObj.updated_at || null,
            updatedBy: bObj.updated_by || null,
          };
        }
      }
      memoryBranchPasscodes = branchPasscodes;
      try {
        localStorage.setItem(TIMESHEET_BRANCH_PASSCODES_KEY, JSON.stringify(branchPasscodes));
      } catch {}
    }
  } catch {}

  // 3. Query Edge Function
  try {
    const { data: edgeData, error } = await supabase.functions.invoke('resend-2fa', {
      body: { action: 'get_timesheet_security_config' },
    });

    if (!error && edgeData && edgeData.success) {
      if (edgeData.mode) {
        mode = edgeData.mode;
        memoryTimesheetMode = mode;
      }
      if (edgeData.isPasscodeSet !== undefined && !passcode) {
        isPasscodeSet = Boolean(edgeData.isPasscodeSet);
        memoryPasscodeConfigured = isPasscodeSet;
      }
      // Only adopt edgeData.passcode if master passcode wasn't already loaded from dedicated row
      if (!passcode && edgeData.passcode !== undefined && edgeData.passcode !== '') {
        passcode = edgeData.passcode;
        memoryGlobalPasscode = passcode;
        try {
          localStorage.setItem(TIMESHEET_GLOBAL_PASSCODE_KEY, passcode);
        } catch {}
      }
      if (edgeData.branchPasscodes && Object.keys(edgeData.branchPasscodes).length > 0) {
        const mergedBranches: Record<string, BranchPasscodeInfo> = { ...branchPasscodes };
        for (const [bId, incoming] of Object.entries(edgeData.branchPasscodes as Record<string, any>)) {
          mergedBranches[bId] = {
            ...mergedBranches[bId],
            ...incoming,
            passcode: incoming.passcode || mergedBranches[bId]?.passcode,
          };
        }
        branchPasscodes = mergedBranches;
        memoryBranchPasscodes = branchPasscodes;
        try {
          localStorage.setItem(TIMESHEET_BRANCH_PASSCODES_KEY, JSON.stringify(branchPasscodes));
        } catch {}
      }
      if (edgeData.updatedAt) updatedAt = edgeData.updatedAt;
      if (edgeData.updatedBy) updatedBy = edgeData.updatedBy;
    }
  } catch (err) {
    console.warn('Error fetching timesheet security config via edge function, using local cache:', err);
  }

  // 4. Retrieve any stored local branch passcode secrets (to survive edge function redactions)
  try {
    const rawSecrets = localStorage.getItem('niza_timesheet_branch_passcodes_local_secrets');
    if (rawSecrets) {
      const secretsMap = JSON.parse(rawSecrets);
      for (const [bId, sec] of Object.entries(secretsMap)) {
        if (sec && typeof sec === 'string') {
          if (!branchPasscodes[bId]) {
            branchPasscodes[bId] = { branchId: bId, isPasscodeSet: true, passcode: sec };
          } else {
            branchPasscodes[bId].passcode = sec;
            branchPasscodes[bId].isPasscodeSet = true;
          }
        }
      }
      memoryBranchPasscodes = branchPasscodes;
      try {
        localStorage.setItem(TIMESHEET_BRANCH_PASSCODES_KEY, JSON.stringify(branchPasscodes));
      } catch {}
    }
  } catch {}

  // 5. Direct DB check on legacy message_settings timesheet_passcode_config as fallback
  try {
    const { data: dbData } = await supabase
      .from('message_settings')
      .select('setting_value')
      .eq('setting_key', 'timesheet_passcode_config')
      .maybeSingle();

    if (dbData?.setting_value && typeof dbData.setting_value === 'object') {
      const val = dbData.setting_value as any;
      if (val.branches && typeof val.branches === 'object') {
        for (const [bId, bObj] of Object.entries(val.branches as Record<string, any>)) {
          if (bObj && typeof bObj === 'object') {
            if (!branchPasscodes[bId]) {
              branchPasscodes[bId] = { branchId: bId, isPasscodeSet: Boolean(bObj.is_set) };
            }
            if (bObj.passcode_plain) {
              branchPasscodes[bId].passcode = bObj.passcode_plain;
              branchPasscodes[bId].isPasscodeSet = true;
            }
          }
        }
        memoryBranchPasscodes = branchPasscodes;
        try {
          localStorage.setItem(TIMESHEET_BRANCH_PASSCODES_KEY, JSON.stringify(branchPasscodes));
        } catch {}
      }
    }
  } catch {}

  try {
    localStorage.setItem(TIMESHEET_MODE_STORAGE_KEY, mode);
    localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, String(isPasscodeSet));
    if (updatedAt) localStorage.setItem(TIMESHEET_LAST_UPDATED_KEY, updatedAt);
    if (updatedBy) localStorage.setItem(TIMESHEET_UPDATED_BY_KEY, updatedBy);
  } catch {}

  return {
    mode,
    isPasscodeSet,
    passcode,
    branchPasscodes,
    updatedAt: updatedAt || null,
    updatedBy: updatedBy || null,
  };
}

/**
 * Super Admin updates timesheet verification mode and/or passcode (global master or branch-specific).
 */
export async function setTimesheetSecurityConfig(
  mode: TimesheetVerificationMode,
  passcode?: string,
  adminUser?: { name?: string; email?: string } | null,
  branchId?: string
): Promise<{ success: boolean; error?: string; config?: TimesheetSecurityConfig }> {
  try {
    const updaterInfo = adminUser?.name || adminUser?.email || 'Super Admin';
    const nowIso = new Date().toISOString();

    // =========================================================================
    // CASE 1: BRANCH-SPECIFIC PASSCODE UPDATE (Does NOT touch Super Admin Master Passcode)
    // =========================================================================
    if (branchId) {
      const currentBranches = { ...memoryBranchPasscodes };
      const cleanBranchPasscode = passcode !== undefined ? passcode.trim() : undefined;

      if (cleanBranchPasscode !== undefined && cleanBranchPasscode.length > 0) {
        currentBranches[branchId] = {
          branchId,
          isPasscodeSet: true,
          passcode: cleanBranchPasscode,
          updatedAt: nowIso,
          updatedBy: updaterInfo,
        };
      } else if (cleanBranchPasscode === '') {
        // Clearing branch passcode -> revert to global master default
        delete currentBranches[branchId];
      }

      memoryBranchPasscodes = currentBranches;
      try {
        localStorage.setItem(TIMESHEET_BRANCH_PASSCODES_KEY, JSON.stringify(currentBranches));
        const secretsRaw = localStorage.getItem('niza_timesheet_branch_passcodes_local_secrets');
        const secretsMap = secretsRaw ? JSON.parse(secretsRaw) : {};
        if (cleanBranchPasscode) {
          secretsMap[branchId] = cleanBranchPasscode;
        } else {
          delete secretsMap[branchId];
        }
        localStorage.setItem('niza_timesheet_branch_passcodes_local_secrets', JSON.stringify(secretsMap));
      } catch {}

      // 1a. Persist to dedicated timesheet_branch_passcodes_config table row
      try {
        const { data: currentBranchDb } = await supabase
          .from('message_settings')
          .select('setting_value')
          .eq('setting_key', 'timesheet_branch_passcodes_config')
          .maybeSingle();

        const branchMap = (currentBranchDb?.setting_value && typeof currentBranchDb.setting_value === 'object')
          ? { ...(currentBranchDb.setting_value as Record<string, any>) }
          : {};

        if (cleanBranchPasscode) {
          branchMap[branchId] = {
            is_set: true,
            passcode_plain: cleanBranchPasscode,
            updated_at: nowIso,
            updated_by: updaterInfo,
          };
        } else {
          delete branchMap[branchId];
        }

        await supabase
          .from('message_settings')
          .upsert({
            setting_key: 'timesheet_branch_passcodes_config',
            setting_value: branchMap,
            description: `Branch passcodes dictionary updated for ${branchId} by ${updaterInfo}`,
            updated_at: nowIso,
          }, { onConflict: 'setting_key' });
      } catch (dbErr) {
        console.warn('Could not sync to timesheet_branch_passcodes_config:', dbErr);
      }

      // 1b. Sync branch map in legacy timesheet_passcode_config row WITHOUT touching global is_set or encrypted
      try {
        const { data: currentDbSetting } = await supabase
          .from('message_settings')
          .select('setting_value')
          .eq('setting_key', 'timesheet_passcode_config')
          .maybeSingle();

        const currentVal = (currentDbSetting?.setting_value && typeof currentDbSetting.setting_value === 'object')
          ? { ...currentDbSetting.setting_value }
          : { is_set: false, encrypted: '', hash: '', branches: {} };
        if (!currentVal.branches) currentVal.branches = {};

        if (cleanBranchPasscode) {
          currentVal.branches[branchId] = {
            is_set: true,
            passcode_plain: cleanBranchPasscode,
            updated_at: nowIso,
            updated_by: updaterInfo,
          };
        } else {
          delete currentVal.branches[branchId];
        }

        await supabase
          .from('message_settings')
          .upsert({
            setting_key: 'timesheet_passcode_config',
            setting_value: currentVal,
            description: `Timesheet passcode for branch ${branchId} updated by ${updaterInfo}`,
            updated_at: nowIso,
          }, { onConflict: 'setting_key' });
      } catch (dbErr) {
        console.warn('Could not sync branch passcode directly to message_settings:', dbErr);
      }

      // Note: We deliberately do NOT invoke resend-2fa with the root passcode field here,
      // preventing older cloud edge functions from treating a branch passcode as the global master passcode!

      const resultConfig: TimesheetSecurityConfig = {
        mode: memoryTimesheetMode,
        isPasscodeSet: memoryPasscodeConfigured,
        passcode: memoryGlobalPasscode, // Master passcode remains 100% UNTOUCHED!
        branchPasscodes: { ...memoryBranchPasscodes },
        updatedAt: nowIso,
        updatedBy: updaterInfo,
      };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('niza_timesheet_security_changed', {
            detail: resultConfig,
          })
        );
      }

      return {
        success: true,
        config: resultConfig,
      };
    }

    // =========================================================================
    // CASE 2: GLOBAL MASTER PASSCODE & MODE UPDATE
    // =========================================================================
    memoryTimesheetMode = mode;
    try {
      localStorage.setItem(TIMESHEET_MODE_STORAGE_KEY, mode);
    } catch {}

    if (passcode !== undefined) {
      const cleanPasscode = passcode.trim();
      memoryGlobalPasscode = cleanPasscode;
      memoryPasscodeConfigured = cleanPasscode.length > 0;
      try {
        if (cleanPasscode.length > 0) {
          localStorage.setItem(TIMESHEET_GLOBAL_PASSCODE_KEY, cleanPasscode);
          localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, 'true');
        } else {
          localStorage.removeItem(TIMESHEET_GLOBAL_PASSCODE_KEY);
          localStorage.setItem(TIMESHEET_PASSCODE_CONFIGURED_KEY, 'false');
        }
      } catch {}

      // Persist to dedicated timesheet_master_passcode setting
      try {
        await supabase
          .from('message_settings')
          .upsert({
            setting_key: 'timesheet_master_passcode',
            setting_value: {
              is_set: cleanPasscode.length > 0,
              passcode_plain: cleanPasscode,
              updated_at: nowIso,
              updated_by: updaterInfo,
            },
            description: `Super Admin Master Passcode updated by ${updaterInfo}`,
            updated_at: nowIso,
          }, { onConflict: 'setting_key' });
      } catch (e) {
        console.warn('Could not save to timesheet_master_passcode:', e);
      }
    }

    try {
      localStorage.setItem(TIMESHEET_LAST_UPDATED_KEY, nowIso);
      localStorage.setItem(TIMESHEET_UPDATED_BY_KEY, updaterInfo);
    } catch {}

    // Invoke edge function for global passcode
    try {
      await supabase.functions.invoke('resend-2fa', {
        body: {
          action: 'set_timesheet_security_config',
          mode,
          passcode: memoryGlobalPasscode,
          updatedBy: updaterInfo,
        },
      });
    } catch (e) {
      console.warn('Edge function global sync warning:', e);
    }

    const resultConfig: TimesheetSecurityConfig = {
      mode: memoryTimesheetMode,
      isPasscodeSet: memoryPasscodeConfigured,
      passcode: memoryGlobalPasscode,
      branchPasscodes: { ...memoryBranchPasscodes },
      updatedAt: nowIso,
      updatedBy: updaterInfo,
    };

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('niza_timesheet_security_changed', {
          detail: resultConfig,
        })
      );
    }

    return {
      success: true,
      config: resultConfig,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error updating timesheet security settings';
    return { success: false, error: message };
  }
}

/**
 * Verify passcode entered by user for a specific branch or globally. Unlocks store scheduling on success.
 * The universally configured passcode (Super Admin master passcode) ALWAYS unlocks any branch,
 * even if the store has its own unique passcode.
 */
export async function verifyTimesheetPasscode(
  passcode: string,
  branchId?: string
): Promise<{ success: boolean; verified?: boolean; error?: string; message?: string }> {
  const cleanInput = passcode.trim();
  if (!cleanInput) {
    return { success: false, verified: false, error: 'Please enter a passcode' };
  }

  // 1. Direct synchronous verification
  // 1a. Check against Universal / Global Default Passcode FIRST
  // The universal passcode acts as the Master Passcode — entering it MUST ALWAYS unlock any branch
  const currentGlobalPasscode = (() => {
    try {
      return (localStorage.getItem(TIMESHEET_GLOBAL_PASSCODE_KEY) || memoryGlobalPasscode || '').trim();
    } catch {
      return (memoryGlobalPasscode || '').trim();
    }
  })();

  if (currentGlobalPasscode && cleanInput === currentGlobalPasscode) {
    setTimesheetSessionVerified(2);
    return { success: true, verified: true, message: 'Authorized by universal master passcode' };
  }

  // 1b. Check against Branch-Specific Passcode (if configured for this branch)
  const currentBranches = (() => {
    try {
      const raw = localStorage.getItem(TIMESHEET_BRANCH_PASSCODES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return memoryBranchPasscodes;
  })();

  // 1b-i. If specific branchId provided, check that branch first
  if (branchId) {
    const bData = currentBranches[branchId];
    const hasBranchPasscode = Boolean(bData?.isPasscodeSet && bData?.passcode);
    if (hasBranchPasscode && bData?.passcode) {
      if (cleanInput === bData.passcode.trim()) {
        setTimesheetSessionVerified(2);
        return { success: true, verified: true, message: 'Passcode verified successfully' };
      }
    }
  }

  // 1b-ii. Check if cleanInput matches ANY branch's unique passcode in memory / localStorage
  for (const [bId, bInfo] of Object.entries(currentBranches)) {
    if (bInfo?.isPasscodeSet && bInfo?.passcode && cleanInput === bInfo.passcode.trim()) {
      setTimesheetSessionVerified(2);
      return { success: true, verified: true, message: 'Passcode verified successfully' };
    }
  }

  // 2. Remote Edge Function Verification
  // 2a. Attempt branch-specific verification via edge function
  try {
    const { data: branchRes } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'verify_timesheet_passcode',
        passcode: cleanInput,
        branchId: branchId || undefined,
      },
    });

    if (branchRes?.verified) {
      setTimesheetSessionVerified(2);
      return {
        success: true,
        verified: true,
        message: branchRes.message || 'Passcode verified successfully',
      };
    }
  } catch {}

  // 2b. Attempt Universal / Global Master Passcode verification on the server
  // If branchId is supplied and failed branch verification, verify against the universal server passcode directly
  try {
    const { data: globalRes } = await supabase.functions.invoke('resend-2fa', {
      body: {
        action: 'verify_timesheet_passcode',
        passcode: cleanInput,
        // Omit branchId to verify against the global default passcode directly
      },
    });

    if (globalRes?.verified) {
      setTimesheetSessionVerified(2);
      return {
        success: true,
        verified: true,
        message: globalRes.message || 'Authorized by universal master passcode',
      };
    }
  } catch {}

  // 2c. Multi-branch verification check via edge function:
  // If specific branchId was omitted or failed, check all candidate branches that have custom passcodes
  const candidateBranchIds = Object.keys(currentBranches).filter(
    (bId) => currentBranches[bId]?.isPasscodeSet && bId !== branchId
  );

  // If memory/cache didn't have candidate branches, try fetching the latest list of branch IDs
  if (candidateBranchIds.length === 0) {
    try {
      const cfg = await getTimesheetSecurityConfig();
      if (cfg.branchPasscodes) {
        for (const [bId, bInfo] of Object.entries(cfg.branchPasscodes)) {
          if (bInfo?.isPasscodeSet && bId !== branchId && !candidateBranchIds.includes(bId)) {
            candidateBranchIds.push(bId);
          }
        }
      }
    } catch {}
  }

  // Also query branches table to get all branch IDs if candidate list is still empty
  if (candidateBranchIds.length === 0) {
    try {
      const { data: bList } = await supabase.from('branches').select('id');
      if (bList) {
        for (const b of bList) {
          if (b.id !== branchId && !candidateBranchIds.includes(b.id)) {
            candidateBranchIds.push(b.id);
          }
        }
      }
    } catch {}
  }

  // Test candidate branches against edge function
  for (const candBranchId of candidateBranchIds) {
    try {
      const { data: candRes } = await supabase.functions.invoke('resend-2fa', {
        body: {
          action: 'verify_timesheet_passcode',
          passcode: cleanInput,
          branchId: candBranchId,
        },
      });
      if (candRes?.verified) {
        setTimesheetSessionVerified(2);
        return {
          success: true,
          verified: true,
          message: candRes.message || 'Passcode verified successfully',
        };
      }
    } catch {}
  }

  // 2d. Direct database check against message_settings table as failover
  try {
    const { data: dbData } = await supabase
      .from('message_settings')
      .select('setting_value')
      .eq('setting_key', 'timesheet_passcode_config')
      .maybeSingle();

    if (dbData?.setting_value && typeof dbData.setting_value === 'object') {
      const val = dbData.setting_value as any;
      if (val.branches && typeof val.branches === 'object') {
        if (branchId && val.branches[branchId]?.passcode_plain) {
          if (val.branches[branchId].passcode_plain.trim() === cleanInput) {
            setTimesheetSessionVerified(2);
            return { success: true, verified: true, message: 'Passcode verified successfully' };
          }
        }
        for (const [bId, bObj] of Object.entries(val.branches as Record<string, any>)) {
          if (bObj?.passcode_plain && bObj.passcode_plain.trim() === cleanInput) {
            setTimesheetSessionVerified(2);
            return { success: true, verified: true, message: 'Passcode verified successfully' };
          }
        }
      }
    }
  } catch {}

  // 3. Fallback check: if disabled or not configured
  const mode = getTimesheetVerificationModeSync();
  if (mode === 'disabled') {
    setTimesheetSessionVerified(2);
    return { success: true, verified: true, message: 'Verification disabled' };
  }
  if (mode === 'passcode' && !isTimesheetPasscodeConfiguredSync(branchId)) {
    setTimesheetSessionVerified(2);
    return { success: true, verified: true, message: 'No passcode configured. Normal access granted.' };
  }

  return {
    success: false,
    verified: false,
    error: 'Incorrect passcode. Please enter the valid authorization passcode provided by Super Admin for this branch.',
  };
}

/**
 * Subscribe to changes in Timesheets security settings
 */
export function subscribeToTimesheetSecurity(
  callback: (config: TimesheetSecurityConfig) => void
): () => void {
  if (typeof window !== 'undefined') {
    const handleCustomEvent = (e: Event) => {
      const custom = e as CustomEvent<TimesheetSecurityConfig>;
      if (custom?.detail) {
        callback(custom.detail);
      } else {
        getTimesheetSecurityConfig().then(callback);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === TIMESHEET_MODE_STORAGE_KEY ||
        e.key === TIMESHEET_PASSCODE_CONFIGURED_KEY ||
        e.key === TIMESHEET_BRANCH_PASSCODES_KEY ||
        e.key === TIMESHEET_GLOBAL_PASSCODE_KEY
      ) {
        getTimesheetSecurityConfig().then(callback);
      }
    };

    window.addEventListener('niza_timesheet_security_changed', handleCustomEvent);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('niza_timesheet_security_changed', handleCustomEvent);
      window.removeEventListener('storage', handleStorage);
    };
  }

  return () => {};
}
