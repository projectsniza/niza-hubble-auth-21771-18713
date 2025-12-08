import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, Calendar, MapPin, FileText, Clock, User } from 'lucide-react';

export default function MyProfile() {
  const { user } = useAuth();

  if (!user) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-foreground">My Profile</h1>

      {/* Profile Header */}
      <Card className="p-8">
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {getInitials(user.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
            <p className="text-lg text-muted-foreground mb-4">{user.role}</p>
            
            <div className="flex items-center gap-3 mb-6">
              <Badge variant="secondary" className="text-sm">
                {user.role}
              </Badge>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Active
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">Profile not configured</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Leave Remaining</p>
              <p className="text-2xl font-bold text-foreground">0 days</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
              <p className="text-2xl font-bold text-foreground">0</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Documents</p>
              <p className="text-2xl font-bold text-foreground">0</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Training Courses</p>
              <p className="text-2xl font-bold text-foreground">0</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          <TabsTrigger value="leave">My Leave</TabsTrigger>
          <TabsTrigger value="schedule">My Schedule</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="training">Training</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">Personal Information</h3>
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Personal information not configured</p>
              <p className="text-sm text-muted-foreground mt-2">Contact your administrator to update your profile</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="leave">
          <Card className="p-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">My Leave</h3>
              <Button>Request Leave</Button>
            </div>

            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No leave history</p>
              <p className="text-sm text-muted-foreground mt-2">Your leave requests will appear here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="schedule">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Schedule</h3>
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No scheduled shifts</p>
              <p className="text-sm text-muted-foreground mt-2">Your upcoming shifts will appear here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Documents</h3>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No documents</p>
              <p className="text-sm text-muted-foreground mt-2">Your documents will appear here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="payslips">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Payslips</h3>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No payslips</p>
              <p className="text-sm text-muted-foreground mt-2">Your payslips will appear here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="training">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">My Training</h3>
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No training courses</p>
              <p className="text-sm text-muted-foreground mt-2">Your training courses will appear here</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card className="p-8">
            <h3 className="text-xl font-bold mb-6 text-foreground">Attendance History</h3>
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No attendance records</p>
              <p className="text-sm text-muted-foreground mt-2">Your attendance history will appear here</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
