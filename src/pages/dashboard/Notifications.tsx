import { useState } from 'react';
import { Bell, FileText, MessageSquare, Users, Key, ClipboardList, CheckCircle, Filter, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useActivityLogs, ActivityLog } from '@/hooks/useActivityLogs';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';

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
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'messages':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'employees':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'security':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'reports':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
};

export default function Notifications() {
  const { user } = useAuth();
  const { activities, isLoading, unreadCount, markAsRead, markAllAsRead } = useActivityLogs();
  
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  if (user?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const filteredActivities = activities.filter((activity) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !activity.title.toLowerCase().includes(searchLower) &&
        !activity.description?.toLowerCase().includes(searchLower) &&
        !activity.user_name.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Category filter
    if (categoryFilter !== 'all' && activity.activity_category !== categoryFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'unread' && activity.is_read) {
      return false;
    }
    if (statusFilter === 'read' && !activity.is_read) {
      return false;
    }

    // Date filter
    const activityDate = new Date(activity.created_at);
    if (startDate && isBefore(activityDate, startOfDay(startDate))) {
      return false;
    }
    if (endDate && isAfter(activityDate, endOfDay(endDate))) {
      return false;
    }

    return true;
  });

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setStartDate(undefined);
    setEndDate(undefined);
  };

  const handleMarkAsRead = (activity: ActivityLog) => {
    if (!activity.is_read) {
      markAsRead(activity.id);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllAsRead()}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search notifications..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="documents">Documents</SelectItem>
                  <SelectItem value="messages">Messages</SelectItem>
                  <SelectItem value="employees">Employees</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="reports">Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label>Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {startDate && endDate
                      ? `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')}`
                      : startDate
                      ? format(startDate, 'MMM d, yyyy')
                      : 'Select dates'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="flex">
                    <div className="p-3 border-r">
                      <p className="text-xs font-medium mb-2">Start Date</p>
                      <CalendarComponent
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </div>
                    <div className="p-3">
                      <p className="text-xs font-medium mb-2">End Date</p>
                      <CalendarComponent
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? isBefore(date, startDate) : false}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {(search || categoryFilter !== 'all' || statusFilter !== 'all' || startDate || endDate) && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notifications List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">
              Loading notifications...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No notifications found</p>
              <p className="text-sm mt-1">
                {activities.length > 0 ? 'Try adjusting your filters' : 'Activities will appear here'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredActivities.map((activity) => {
                const Icon = getCategoryIcon(activity.activity_category);
                const colorClass = getCategoryColor(activity.activity_category);
                
                return (
                  <div
                    key={activity.id}
                    onClick={() => handleMarkAsRead(activity)}
                    className={`p-4 hover:bg-muted/50 transition-colors cursor-pointer ${
                      !activity.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`p-2 rounded-lg ${colorClass}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className={`text-sm ${!activity.is_read ? 'font-semibold' : 'font-medium'}`}>
                              {activity.title}
                            </p>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {activity.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!activity.is_read && (
                              <Badge variant="default" className="text-xs">New</Badge>
                            )}
                            <Badge variant="outline" className="text-xs capitalize">
                              {activity.activity_category}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          <span>{activity.user_name}</span>
                          {activity.user_role && (
                            <>
                              <span>•</span>
                              <span className="capitalize">{activity.user_role.replace('_', ' ')}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
