import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, ExternalLink } from 'lucide-react';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite New User</DialogTitle>
          <DialogDescription>
            New users are created through Supabase Auth
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              To add a new user:
            </p>
            <ol className="text-sm text-left space-y-2 pl-4">
              <li>1. Create the user in Supabase Auth dashboard</li>
              <li>2. The user will automatically appear here</li>
              <li>3. Assign their role and organization/branch</li>
            </ol>
          </div>
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => window.open('https://supabase.com/dashboard/project/exapetzvebjmdbjwsipg/auth/users', '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Open Supabase Dashboard
          </Button>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
