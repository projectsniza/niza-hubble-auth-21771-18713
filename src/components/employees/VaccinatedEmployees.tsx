import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface VaccinatedEmployeesProps {
  searchQuery: string;
}

const vaccinatedEmployees = [
  { id: 1, name: 'Arun Kumar', initials: 'AK', doses: 3, status: 'Fully Vaccinated' },
  { id: 2, name: 'Priya Lakshmi', initials: 'PL', doses: 3, status: 'Fully Vaccinated' },
  { id: 3, name: 'Rajesh Murugan', initials: 'RM', doses: 2, status: 'Partially Vaccinated' },
  { id: 4, name: 'Karthik Sundaram', initials: 'KS', doses: 3, status: 'Fully Vaccinated' },
];

export default function VaccinatedEmployees({ searchQuery }: VaccinatedEmployeesProps) {
  const filtered = vaccinatedEmployees.filter(emp =>
    emp.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const fullyVaccinated = filtered.filter(e => e.doses >= 2).length;
  const totalEmployees = filtered.length;
  const percentage = totalEmployees > 0 ? Math.round((fullyVaccinated / totalEmployees) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-2xl font-bold text-foreground">{percentage}% vaccinated</h3>
            <p className="text-muted-foreground">{fullyVaccinated} of {totalEmployees} employees</p>
          </div>
          <div>
            <h3 className="text-2xl font-bold text-foreground">{totalEmployees - fullyVaccinated} pending</h3>
            <p className="text-muted-foreground">Employees with incomplete vaccination</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Employee</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Doses</th>
                <th className="text-left py-4 px-6 font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => (
                <tr key={emp.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {emp.initials}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{emp.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-foreground">{emp.doses}</td>
                  <td className="py-4 px-6">
                    <Badge 
                      variant={emp.doses >= 2 ? 'secondary' : 'outline'}
                      className={emp.doses >= 2 ? 'bg-green-100 text-green-800' : ''}
                    >
                      {emp.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
