import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, AlertCircle, Clock, CheckCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Maintenance() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateTicket, setShowCreateTicket] = useState(false);
  const [title, setTitle] = useState('');
  const [explanation, setExplanation] = useState('');
  const [priority, setPriority] = useState('medium');
  const [images, setImages] = useState<File[]>([]);

  const tickets = [
    {
      id: 1,
      title: 'Refrigerator malfunction',
      description: 'Main refrigerator unit not cooling properly',
      priority: 'high',
      status: 'pending',
      date: '2025-03-01',
      branch: 'ADDLESTONE',
    },
    {
      id: 2,
      title: 'Broken door lock',
      description: 'Front entrance door lock needs replacement',
      priority: 'medium',
      status: 'in_progress',
      date: '2025-02-28',
      branch: 'BUCKSKIN',
    },
    {
      id: 3,
      title: 'Parking lot lighting',
      description: 'Several lights in parking area not working',
      priority: 'low',
      status: 'resolved',
      date: '2025-02-25',
      branch: 'ADDLESTONE',
    },
  ];

  const handleSubmit = () => {
    if (!title || !explanation || !priority) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Ticket Created",
      description: "Your maintenance request has been submitted to the admin",
    });

    setTitle('');
    setExplanation('');
    setPriority('medium');
    setImages([]);
    setShowCreateTicket(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages(prev => [...prev, ...files]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-destructive text-destructive-foreground';
      case 'medium': return 'bg-warning text-warning-foreground';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'in_progress': return <AlertCircle className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-warning';
      case 'in_progress': return 'text-primary';
      case 'resolved': return 'text-success';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Maintenance</h1>
          <p className="text-muted-foreground mt-1">Manage maintenance requests and tickets</p>
        </div>
        <Dialog open={showCreateTicket} onOpenChange={setShowCreateTicket}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Raise Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Maintenance Ticket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  placeholder="Brief description of the issue"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="explanation">Explanation *</Label>
                <Textarea
                  id="explanation"
                  placeholder="Detailed explanation of the maintenance issue..."
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="images">Attach Images</Label>
                <div className="flex items-center gap-4">
                  <label htmlFor="images" className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      <span className="text-sm">Upload Images</span>
                    </div>
                    <input
                      id="images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {images.length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {images.length} image(s) selected
                    </span>
                  )}
                </div>
                {images.length > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {images.map((img, idx) => (
                      <div key={idx} className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-sm">
                        <ImageIcon className="h-3 w-3" />
                        <span>{img.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={handleSubmit} className="w-full">
                Submit Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search maintenance tickets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tickets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tickets.map((ticket) => (
          <Card key={ticket.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg text-foreground">{ticket.title}</h3>
                  <p className="text-sm text-muted-foreground">{ticket.description}</p>
                </div>
                <Badge className={getPriorityColor(ticket.priority)}>
                  {ticket.priority}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className={getStatusColor(ticket.status)}>
                    {getStatusIcon(ticket.status)}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {ticket.status.replace('_', ' ')}
                  </span>
                </div>
                <span className="text-muted-foreground">{ticket.branch}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Created: {new Date(ticket.date).toLocaleDateString('en-GB')}
              </div>

              <Button variant="outline" size="sm" className="w-full">
                View Details
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
