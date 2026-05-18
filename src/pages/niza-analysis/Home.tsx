import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Upload, FileSpreadsheet, Settings2, ArrowRight, Sparkles } from 'lucide-react';
import XeroExport from './XeroExport';

const TILES = [
  {
    to: '/niza-analysis/daily-sales',
    icon: Upload,
    title: 'Daily Sales Uploads',
    desc: 'Review till files submitted by every store, day by day.',
    accent: 'from-sky-500/20 to-sky-500/0',
  },
  {
    to: '/niza-analysis/branch-formats',
    icon: Settings2,
    title: 'Branch Formats',
    desc: 'Assign an import format to each store so uploads parse cleanly.',
    accent: 'from-violet-500/20 to-violet-500/0',
  },
  {
    to: '/niza-analysis/xero-export',
    icon: FileSpreadsheet,
    title: 'Xero Export',
    desc: 'Generate Xero-ready sales CSV and the daily cash summary.',
    accent: 'from-emerald-500/20 to-emerald-500/0',
  },
];

export default function NizaAnalysisHome() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <div className="p-6 md:p-10 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-card/60 backdrop-blur p-8 md:p-10 mb-8 shadow-sm">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              <Sparkles className="h-3.5 w-3.5" /> Niza Analysis
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent">
              Daily till data, refined for Xero.
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Upload till exports, map them to the right format per branch, then download
              accountant-ready CSVs in a single click.
            </p>
          </div>
        </div>

        {/* Premium tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {TILES.map(({ to, icon: Icon, title, desc, accent }) => (
            <Link key={to} to={to} className="group">
              <Card className="relative h-full overflow-hidden p-6 border-border/60 hover:border-primary/40 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 bg-card/80 backdrop-blur">
                <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-60 pointer-events-none`} />
                <div className="relative">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                  <div className="mt-4 inline-flex items-center text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Open <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {/* Inline Xero Export panel — premium framed */}
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold leading-tight">Xero Export</div>
                <div className="text-xs text-muted-foreground">Generate sales CSV and daily summary</div>
              </div>
            </div>
            <Link to="/niza-analysis/xero-export" className="text-sm text-primary hover:underline inline-flex items-center">
              Open full view <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </div>
          <div className="p-0">
            <XeroExport embedded />
          </div>
        </Card>
      </div>
    </div>
  );
}
