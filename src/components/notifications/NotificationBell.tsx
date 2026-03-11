import { useState, useEffect } from 'react';
import { Bell, FileText, MessageSquare, Users, Key, ClipboardList, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useActivityLogs, ActivityLog } from '@/hooks/useActivityLogs';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'documents':
      return FileText;
    case 'messages':
      return MessageSquare;
    case 'employees':
      return Users;
    case 'security':
      return Key;
    case 'reports':
      return ClipboardList;
    default:
      return Bell;
  }
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'documents':
      return 'text-blue-500';
    case 'messages':
      return 'text-green-500';
    case 'employees':
      return 'text-purple-500';
    case 'security':
      return 'text-red-500';
    case 'reports':
      return 'text-orange-500';
    default:
      return 'text-muted-foreground';
  }
};

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { activities, unreadCount, markAsRead, markAllAsRead, refetch } = useActivityLogs(10);

  // Subscribe to realtime updates
  useEffect(() => {
    if (user?.role !== 'super_admin') return;

    const channel = supabase
      .channel('activity-logs-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_logs',
        },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.role, refetch]);

  if (user?.role !== 'super_admin') return null;

  const handleNotificationClick = (activity: ActivityLog) => {
    if (!activity.is_read) {
      markAsRead(activity.id);
    }
    setOpen(false);
    
    // Navigate based on activity category and metadata
    const metadata = activity.metadata as Record<string, unknown> || {};
    
    // If there's an employee_id in metadata, navigate to that employee's profile
    if (metadata.employee_id && activity.activity_category === 'employees') {
      navigate(`/dashboard/employees/${metadata.employee_id}`);
      return;
    }
    
    switch (activity.activity_category) {
      case 'documents':
        navigate('/dashboard/documents?tab=submissions');
        break;
      case 'messages':
        navigate('/dashboard/messages');
        break;
      case 'employees':
        navigate('/dashboard/employees');
        break;
      case 'reports':
        navigate('/dashboard/daily-reports');
        break;
      default:
        navigate('/dashboard/notifications');
    }
  };

  const handleSeeAll = () => {
    setOpen(false);
    navigate('/dashboard/notifications');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs animate-pulse"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end" 
        sideOffset={8}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs h-7"
              onClick={() => markAllAsRead()}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[400px]">
          {activities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {activities.map((activity) => {
                const Icon = getCategoryIcon(activity.activity_category);
                const colorClass = getCategoryColor(activity.activity_category);
                
                return (
                  <button
                    key={activity.id}
                    onClick={() => handleNotificationClick(activity)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      !activity.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`mt-0.5 ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${!activity.is_read ? 'font-medium' : ''}`}>
                            {activity.title}
                          </p>
                          {!activity.is_read && (
                            <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        {activity.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {activity.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {activity.user_name}
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
        
        <div className="p-2 border-t">
          <Button 
            variant="ghost" 
            className="w-full text-sm"
            onClick={handleSeeAll}
          >
            See all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
