import { Medal, Award, Trophy, Gem, Crown, LucideIcon } from 'lucide-react';

export type TierKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface TierMeta {
  key: TierKey;
  label: string;
  defaultPoints: number;
  icon: LucideIcon;
  /** CSS class for filled colored icon/text */
  fg: string;
  /** CSS class for soft background badge */
  bg: string;
  border: string;
}

export const TIERS: Record<TierKey, TierMeta> = {
  bronze:   { key: 'bronze',   label: 'Bronze',   defaultPoints: 1,  icon: Medal,  fg: 'text-[hsl(var(--tier-bronze))]',   bg: 'bg-[hsl(var(--tier-bronze-bg))]',   border: 'border-[hsl(var(--tier-bronze))]/30' },
  silver:   { key: 'silver',   label: 'Silver',   defaultPoints: 3,  icon: Award,  fg: 'text-[hsl(var(--tier-silver))]',   bg: 'bg-[hsl(var(--tier-silver-bg))]',   border: 'border-[hsl(var(--tier-silver))]/30' },
  gold:     { key: 'gold',     label: 'Gold',     defaultPoints: 5,  icon: Trophy, fg: 'text-[hsl(var(--tier-gold))]',     bg: 'bg-[hsl(var(--tier-gold-bg))]',     border: 'border-[hsl(var(--tier-gold))]/30' },
  platinum: { key: 'platinum', label: 'Platinum', defaultPoints: 10, icon: Crown,  fg: 'text-[hsl(var(--tier-platinum))]', bg: 'bg-[hsl(var(--tier-platinum-bg))]', border: 'border-[hsl(var(--tier-platinum))]/30' },
  diamond:  { key: 'diamond',  label: 'Diamond',  defaultPoints: 20, icon: Gem,    fg: 'text-[hsl(var(--tier-diamond))]',  bg: 'bg-[hsl(var(--tier-diamond-bg))]',  border: 'border-[hsl(var(--tier-diamond))]/30' },
};

export const TIER_ORDER: TierKey[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];

export function resolveTier(tier: string | null | undefined): TierMeta {
  const key = (tier || 'gold').toLowerCase() as TierKey;
  return TIERS[key] || TIERS.gold;
}
