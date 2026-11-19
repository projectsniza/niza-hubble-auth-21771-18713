import { supabase } from '@/integrations/supabase/client';

/**
 * Checks a leave request before it is saved:
 *  - both dates present and the end is not before the start,
 *  - it does not overlap another pending or approved request for the same person.
 * Returns an error message, or null when the request is fine.
 */
export async function validateLeaveRequest(
  employeeId: string,
  startDate: string,
  endDate: string,
  ignoreRequestId?: string
): Promise<string | null> {
  if (!startDate || !endDate) return 'Please choose both a start and an end date';
  if (endDate < startDate) return 'The end date cannot be before the start date';

  let query = supabase
    .from('leave_requests')
    .select('id, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate);
  if (ignoreRequestId) query = query.neq('id', ignoreRequestId);

  const { data, error } = await query.limit(1);
  if (error) return 'Could not check for overlapping leave: ' + error.message;
  if (data && data.length > 0) {
    const o = data[0];
    return `This overlaps leave already ${o.status} from ${o.start_date} to ${o.end_date}`;
  }
  return null;
}
