import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  setGlobalTimeIncrement,
  getGlobalTimeIncrement,
  type TimeIncrement,
} from '@/lib/timeSnap';

let loaded = false;
let inflight: Promise<void> | null = null;

async function loadOnce() {
  if (loaded) return;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from('rota_settings')
        .select('time_increment_minutes')
        .limit(1)
        .maybeSingle();
      const mins = (data as any)?.time_increment_minutes;
      if (mins) setGlobalTimeIncrement(mins);
    } catch (e) {
      console.warn('useTimeIncrement: failed to load', e);
    } finally {
      loaded = true;
    }
  })();
  return inflight;
}

export function useTimeIncrement(): TimeIncrement {
  const [val, setVal] = useState<TimeIncrement>(getGlobalTimeIncrement());
  useEffect(() => {
    loadOnce().then(() => setVal(getGlobalTimeIncrement()));
  }, []);
  return val;
}

export function refreshTimeIncrement() {
  loaded = false;
  inflight = null;
  return loadOnce();
}
