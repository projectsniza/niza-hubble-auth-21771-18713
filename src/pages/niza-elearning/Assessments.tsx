import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, ClipboardCheck, Loader2, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { NizaLoaderInline } from '@/components/ui/niza-loader';

const QUESTION_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice' },
  { value: 'true_false', label: 'True / False' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'scenario', label: 'Scenario Question' },
];

export default function Assessments() {
  const [assessments, setAssessments] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showQuestionDialog, setShowQuestionDialog] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [assessmentForm, setAssessmentForm] = useState({ course_id: '', title: 'Final Assessment', passing_score: 70, max_attempts: 3, time_limit_minutes: '' });
  const [questionForm, setQuestionForm] = useState({
    question_type: 'multiple_choice', question_text: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 1,
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    const [aRes, cRes] = await Promise.all([
      supabase.from('course_assessments').select('*, courses(title)').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title'),
    ]);
    setAssessments(aRes.data || []);
    setCourses(cRes.data || []);
    setLoading(false);
  };

  const fetchQuestions = async (assessmentId: string) => {
    const { data } = await supabase.from('assessment_questions').select('*').eq('assessment_id', assessmentId).order('sort_order');
    setQuestions(data || []);
  };

  const handleCreateAssessment = async () => {
    if (!assessmentForm.course_id) { toast.error('Select a course'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('course_assessments').insert({
        course_id: assessmentForm.course_id,
        title: assessmentForm.title,
        passing_score: assessmentForm.passing_score,
        max_attempts: assessmentForm.max_attempts,
        time_limit_minutes: assessmentForm.time_limit_minutes ? parseInt(assessmentForm.time_limit_minutes) : null,
      });
      if (error) throw error;
      toast.success('Assessment created');
      setShowCreateDialog(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddQuestion = async () => {
    if (!selectedAssessment || !questionForm.question_text) return;
    setIsSubmitting(true);
    try {
      let correctAnswer: any;
      if (questionForm.question_type === 'true_false') {
        correctAnswer = questionForm.correct_answer;
      } else if (questionForm.question_type === 'multi_select') {
        correctAnswer = questionForm.correct_answer.split(',').map(s => s.trim());
      } else {
        correctAnswer = questionForm.correct_answer;
      }

      const { error } = await supabase.from('assessment_questions').insert({
        assessment_id: selectedAssessment.id,
        question_type: questionForm.question_type,
        question_text: questionForm.question_text,
        options: questionForm.question_type === 'true_false' ? ['True', 'False'] : questionForm.options.filter(o => o.trim()),
        correct_answer: correctAnswer,
        explanation: questionForm.explanation || null,
        points: questionForm.points,
        sort_order: questions.length,
      });
      if (error) throw error;
      toast.success('Question added');
      setShowQuestionDialog(false);
      setQuestionForm({ question_type: 'multiple_choice', question_text: '', options: ['', '', '', ''], correct_answer: '', explanation: '', points: 1 });
      fetchQuestions(selectedAssessment.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><NizaLoaderInline /></div>;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Assessments</h1>
          <p className="text-muted-foreground mt-1">Create and manage course assessments</p>
        </div>
        <Button onClick={() => { setAssessmentForm({ course_id: '', title: 'Final Assessment', passing_score: 70, max_attempts: 3, time_limit_minutes: '' }); setShowCreateDialog(true); }} className="bg-gradient-to-r from-orange-500 to-amber-600 text-white">
          <Plus className="h-4 w-4 mr-2" /> New Assessment
        </Button>
      </div>

      {assessments.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardCheck className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No assessments yet</h3>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map(a => (
            <Card key={a.id} className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{a.title}</h3>
                    <p className="text-sm text-muted-foreground">Course: {a.courses?.title}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline">Pass: {a.passing_score}%</Badge>
                      <Badge variant="outline">Attempts: {a.max_attempts}</Badge>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => { setSelectedAssessment(a); fetchQuestions(a.id); }}>
                    Manage Questions
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Questions Panel */}
      {selectedAssessment && (
        <Card className="border-primary/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Questions for: {selectedAssessment.title}</CardTitle>
              <Button size="sm" onClick={() => setShowQuestionDialog(true)}>
                <Plus className="h-3 w-3 mr-1" /> Add Question
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {questions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No questions added yet</p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{q.question_text}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{QUESTION_TYPES.find(t => t.value === q.question_type)?.label}</Badge>
                        <Badge variant="outline" className="text-xs">{q.points} pts</Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Assessment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Course *</Label>
              <Select value={assessmentForm.course_id} onValueChange={(v) => setAssessmentForm(p => ({ ...p, course_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={assessmentForm.title} onChange={(e) => setAssessmentForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Passing Score (%)</Label>
                <Input type="number" value={assessmentForm.passing_score} onChange={(e) => setAssessmentForm(p => ({ ...p, passing_score: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Attempts</Label>
                <Input type="number" value={assessmentForm.max_attempts} onChange={(e) => setAssessmentForm(p => ({ ...p, max_attempts: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateAssessment} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Question Dialog */}
      <Dialog open={showQuestionDialog} onOpenChange={setShowQuestionDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Question</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Question Type</Label>
              <Select value={questionForm.question_type} onValueChange={(v) => setQuestionForm(p => ({ ...p, question_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Question *</Label>
              <Textarea value={questionForm.question_text} onChange={(e) => setQuestionForm(p => ({ ...p, question_text: e.target.value }))} rows={3} />
            </div>
            {questionForm.question_type !== 'true_false' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {questionForm.options.map((opt, i) => (
                  <Input key={i} value={opt} onChange={(e) => {
                    const newOpts = [...questionForm.options];
                    newOpts[i] = e.target.value;
                    setQuestionForm(p => ({ ...p, options: newOpts }));
                  }} placeholder={`Option ${i + 1}`} />
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label>Correct Answer</Label>
              <Input value={questionForm.correct_answer} onChange={(e) => setQuestionForm(p => ({ ...p, correct_answer: e.target.value }))} placeholder={questionForm.question_type === 'multi_select' ? 'Comma-separated correct answers' : 'Correct option text'} />
            </div>
            <div className="space-y-2">
              <Label>Explanation</Label>
              <Textarea value={questionForm.explanation} onChange={(e) => setQuestionForm(p => ({ ...p, explanation: e.target.value }))} rows={2} placeholder="Why this is correct..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuestionDialog(false)}>Cancel</Button>
            <Button onClick={handleAddQuestion} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Add Question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
