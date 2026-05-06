import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Upload, FileSpreadsheet } from 'lucide-react';

export default function NizaAnalysisHome() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        Niza Analysis
      </h1>
      <p className="text-muted-foreground mb-6">
        Convert daily till uploads from stores into Xero-ready CSV exports.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/niza-analysis/daily-sales">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <Upload className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold text-lg">Daily Sales Uploads</h3>
            <p className="text-sm text-muted-foreground">View all daily sales files uploaded by stores.</p>
          </Card>
        </Link>
        <Link to="/niza-analysis/xero-export">
          <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
            <FileSpreadsheet className="h-8 w-8 text-primary mb-2" />
            <h3 className="font-semibold text-lg">Xero Export</h3>
            <p className="text-sm text-muted-foreground">Generate the Xero daily sales import CSV.</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
