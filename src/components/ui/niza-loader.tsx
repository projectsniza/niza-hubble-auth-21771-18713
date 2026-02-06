import withoutSpikes from '@/assets/loader/without-spikes.png';
import spike1 from '@/assets/loader/spike-1.png';
import spike2 from '@/assets/loader/spike-2.png';
import spike3 from '@/assets/loader/spike-3.png';
import spike4 from '@/assets/loader/spike-4.png';
import spike5 from '@/assets/loader/spike-5.png';
import spike6 from '@/assets/loader/spike-6.png';

interface NizaLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeMap = {
  sm: 'w-24 h-24',
  md: 'w-40 h-40',
  lg: 'w-72 h-72',
};

export function NizaLoader({ size = 'md', className = '' }: NizaLoaderProps) {
  return (
    <div className={`niza-loader-wrapper ${sizeMap[size]} ${className}`}>
      <div 
        className="niza-loader-layer niza-loader-base"
        style={{ backgroundImage: `url(${withoutSpikes})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-1"
        style={{ backgroundImage: `url(${spike1})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-2"
        style={{ backgroundImage: `url(${spike2})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-3"
        style={{ backgroundImage: `url(${spike3})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-4"
        style={{ backgroundImage: `url(${spike4})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-5"
        style={{ backgroundImage: `url(${spike5})` }}
      />
      <div 
        className="niza-loader-layer niza-loader-spike niza-loader-spike-6"
        style={{ backgroundImage: `url(${spike6})` }}
      />
    </div>
  );
}

export function NizaLoaderFullPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <NizaLoader size="lg" />
    </div>
  );
}
