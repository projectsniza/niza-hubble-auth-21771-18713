import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface CriteriaRating {
  criteriaId: string;
  rating: number;
}

interface ReviewFormData {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  feedback: string;
  goals: string;
  goalsProgress: number;
  overallRating: number;
  criteriaRatings: CriteriaRating[];
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
}

interface Criteria {
  id: string;
  name: string;
  description: string | null;
  weight: number;
}

interface ReviewFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isEdit?: boolean;
  reviewForm: ReviewFormData;
  onFormChange: (form: ReviewFormData) => void;
  employees: Employee[];
  criteria: Criteria[];
  onSave: () => void;
}

export default function ReviewFormDialog({
  isOpen,
  onClose,
  isEdit = false,
  reviewForm,
  onFormChange,
  employees,
  criteria,
  onSave
}: ReviewFormDialogProps) {
  const updateCriteriaRating = (criteriaId: string, rating: number) => {
    const existingIndex = reviewForm.criteriaRatings.findIndex(cr => cr.criteriaId === criteriaId);
    let newRatings: CriteriaRating[];
    
    if (existingIndex >= 0) {
      newRatings = [...reviewForm.criteriaRatings];
      newRatings[existingIndex] = { criteriaId, rating };
    } else {
      newRatings = [...reviewForm.criteriaRatings, { criteriaId, rating }];
    }
    
    onFormChange({ ...reviewForm, criteriaRatings: newRatings });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit' : 'Add'} Performance Review</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Employee *</Label>
            <Select 
              value={reviewForm.employeeId} 
              onValueChange={(v) => onFormChange({ ...reviewForm, employeeId: v })}
              disabled={isEdit}
            >
              <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Period Start</Label>
              <Input 
                type="date"
                value={reviewForm.periodStart}
                onChange={(e) => onFormChange({ ...reviewForm, periodStart: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Period End</Label>
              <Input 
                type="date"
                value={reviewForm.periodEnd}
                onChange={(e) => onFormChange({ ...reviewForm, periodEnd: e.target.value })}
              />
            </div>
          </div>

          {/* Performance Criteria Ratings */}
          {criteria.length > 0 && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Performance Criteria Ratings</Label>
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                {criteria.map(c => {
                  const rating = reviewForm.criteriaRatings.find(cr => cr.criteriaId === c.id)?.rating || 3;
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium">{c.name}</p>
                        {c.description && (
                          <p className="text-xs text-muted-foreground">{c.description}</p>
                        )}
                        <Badge variant="outline" className="mt-1">Weight: {c.weight}</Badge>
                      </div>
                      <Select 
                        value={rating.toString()} 
                        onValueChange={(v) => updateCriteriaRating(c.id, parseInt(v))}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map(n => (
                            <SelectItem key={n} value={n.toString()}>{n} Star{n > 1 ? 's' : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {criteria.length === 0 && (
            <div className="space-y-2">
              <Label>Overall Rating (1-5)</Label>
              <Select 
                value={reviewForm.overallRating.toString()} 
                onValueChange={(v) => onFormChange({ ...reviewForm, overallRating: parseInt(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={n.toString()}>{n} Star{n > 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Goals</Label>
            <Textarea 
              value={reviewForm.goals}
              onChange={(e) => onFormChange({ ...reviewForm, goals: e.target.value })}
              placeholder="Employee goals..."
            />
          </div>
          <div className="space-y-2">
            <Label>Goals Progress (%)</Label>
            <Input 
              type="number"
              min="0"
              max="100"
              value={reviewForm.goalsProgress}
              onChange={(e) => onFormChange({ ...reviewForm, goalsProgress: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label>Feedback</Label>
            <Textarea 
              value={reviewForm.feedback}
              onChange={(e) => onFormChange({ ...reviewForm, feedback: e.target.value })}
              placeholder="Manager feedback..."
            />
          </div>
          <Button onClick={onSave} className="w-full">Save Review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
