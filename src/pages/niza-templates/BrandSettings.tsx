import { Upload, Plus, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function BrandSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Brand Settings</h1>
        <p className="text-muted-foreground mt-1">Manage logos, colors, and brand assets</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Company Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-lg flex items-center justify-center mb-4">
                <span className="text-4xl">🏢</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">No logo uploaded</p>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Recommended: PNG or SVG, minimum 512x512px
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Secondary Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <div className="w-32 h-32 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-600/20 rounded-lg flex items-center justify-center mb-4">
                <span className="text-4xl">📱</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">No secondary logo uploaded</p>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload Alternative Logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional: Light version for dark backgrounds
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Brand Colors</CardTitle>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Color
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Palette className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No brand colors configured</h3>
            <p className="text-muted-foreground mb-4">Add your brand colors to maintain consistency</p>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Color
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline">Reset to Default</Button>
        <Button>Save Changes</Button>
      </div>
    </div>
  );
}
