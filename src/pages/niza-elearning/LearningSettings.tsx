import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Plus, Settings, Loader2, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

const LEARNING_MODES = [
  { value: 'assigned_only', label: 'Assigned Courses Only', desc: 'Employees can only access courses assigned to them' },
  { value: 'hybrid', label: 'Hybrid Mode', desc: 'Assigned courses required + employees can also start any course on their own' },
];

export default function LearningSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [learningMode, setLearningMode] = useState('hybrid');
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const [settingsRes, catsRes] = await Promise.all([
      supabase.from('learning_settings').select('*').limit(1).maybeSingle(),
      supabase.from('course_categories').select('*').order('name'),
    ]);
    if (settingsRes.data) {
      setSettings(settingsRes.data);
      setLearningMode(settingsRes.data.learning_mode);
    }
    setCategories(catsRes.data || []);
    setLoading(false);
  };

  const saveLearningMode = async (mode: string) => {
    setLearningMode(mode);
    try {
      if (settings) {
        await supabase.from('learning_settings').update({ learning_mode: mode }).eq('id', settings.id);
      } else {
        await supabase.from('learning_settings').insert({ learning_mode: mode, created_by: user?.id });
      }
      toast.success('Learning mode updated');
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('course_categories').insert({ name: categoryName.trim(), created_by: user?.id });
      if (error) throw error;
      toast.success('Category added');
      setCategoryName('');
      setShowCategoryDialog(false);
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from('course_categories').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Category deleted');
    fetchSettings();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Learning Settings</h1>
        <p className="text-muted-foreground mt-1">Configure e-learning access and categories</p>
      </div>

      {/* Learning Mode */}
      <Card className="border-primary/20">
        <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Settings className="h-5 w-5" /> Learning Access Mode</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {LEARNING_MODES.map(mode => (
            <div key={mode.value} className={`flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-colors ${learningMode === mode.value ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:bg-muted/30'}`} onClick={() => saveLearningMode(mode.value)}>
              <div>
                <p className="font-medium text-foreground">{mode.label}</p>
                <p className="text-sm text-muted-foreground">{mode.desc}</p>
              </div>
              {learningMode === mode.value && <Badge className="bg-orange-500/10 text-orange-600">Active</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Course Categories</CardTitle>
            <Button size="sm" onClick={() => setShowCategoryDialog(true)}>
              <Plus className="h-3 w-3 mr-1" /> Add Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No categories yet</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <span className="font-medium text-foreground">{cat.name}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteCategory(cat.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Add Category</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Category Name</Label>
            <Input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="e.g., Health & Safety" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryDialog(false)}>Cancel</Button>
            <Button onClick={addCategory} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
