import { useState } from "react";
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Clock } from "lucide-react";

export default function Attendance() {
  const { user } = useAuth();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Employee View - Their own attendance
  if (user?.role === 'employee') {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-foreground mb-6">My Attendance</h1>
        
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-2">No attendance records</h3>
              <p className="text-muted-foreground">Your attendance history will appear here</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Admin/HR/Manager View - Calendar with leave management
  const absenceTypes = [
    { name: "Annual leave", color: "bg-blue-500" },
    { name: "Sickness", color: "bg-yellow-500" },
    { name: "Lateness", color: "bg-red-500" },
    { name: "TOIL", color: "bg-orange-500" },
    { name: "Other absence", color: "bg-teal-500" },
    { name: "Pending", color: "bg-pink-500" },
  ];

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
    setDate(new Date());
  };

  return (
    <div className="p-8 animate-fade-in">
      <h1 className="text-3xl font-bold mb-6">Calendar</h1>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="pending">
            Pending requests
            <Badge variant="secondary" className="ml-2">0</Badge>
          </TabsTrigger>
          <TabsTrigger value="mandatory">Mandatory leave</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <Card className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <Select defaultValue={currentMonth.toLocaleString('default', { month: 'long' })}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const monthName = new Date(2025, i).toLocaleString('default', { month: 'long' });
                      return (
                        <SelectItem key={i} value={monthName}>{monthName}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Select defaultValue={currentMonth.getFullYear().toString()}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() + i - 2;
                      return (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={goToToday}>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Today
                </Button>

                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  Filter absences
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="default">Add time off</Button>
                <Button variant="outline">Sync</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-6">
              {absenceTypes.map((type) => (
                <div key={type.name} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${type.color}`}></div>
                  <span className="text-sm text-muted-foreground">{type.name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous month
              </Button>
              <h3 className="text-lg font-semibold">
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
              <Button variant="ghost" size="sm" onClick={goToNextMonth}>
                Next month
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                className="w-full"
              />
            </div>

            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm">Month view</Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <Card className="p-6">
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">Sort by:</label>
              <Select defaultValue="oldest">
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oldest">Date raised (Oldest first)</SelectItem>
                  <SelectItem value="newest">Date raised (Newest first)</SelectItem>
                  <SelectItem value="employee">Employee name</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <h3 className="text-lg font-semibold mb-4">
              Pending requests (0)
            </h3>

            <div className="text-center py-12 text-muted-foreground">
              No pending requests
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="mandatory">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Mandatory leave</h3>
                <p className="text-sm text-muted-foreground">
                  Dates your employees have to take as leave such as shutdown periods, local bank holidays etc. 
                  Once set, it will appear on employee profile as Mandatory time off as well as in the calendar.
                </p>
              </div>
              <Button variant="default">Add mandatory leave</Button>
            </div>

            <div className="text-center py-12 text-muted-foreground">
              No mandatory leave periods set
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
