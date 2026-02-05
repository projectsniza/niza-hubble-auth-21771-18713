import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Car, 
  Fuel, 
  User, 
  Calendar, 
  PoundSterling,
  Edit,
  Trash2,
  AlertTriangle,
  Shield,
  CreditCard
} from 'lucide-react';
import { DriveOff } from '@/hooks/useDriveOffs';
import { cn } from '@/lib/utils';

interface DriveOffCardProps {
  driveOff: DriveOff;
  onEdit: (driveOff: DriveOff) => void;
  onDelete: (id: string) => void;
}

export function DriveOffCard({ driveOff, onEdit, onDelete }: DriveOffCardProps) {
  const isPaymentStatus = driveOff.tracking_status === 'payment';
  const unpaidAmount = driveOff.amount_drive_off - (driveOff.total_amount_received || 0);
  const isPaid = unpaidAmount <= 0;

  const getStatusBadge = () => {
    switch (driveOff.tracking_status) {
      case 'fuel_guardian':
        return (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
            <Shield className="h-3 w-3 mr-1" />
            Fuel Guardian
          </Badge>
        );
      case 'police_complaint':
        return (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Police Complaint
          </Badge>
        );
      case 'payment':
        return (
          <Badge className={cn(
            isPaid 
              ? "bg-green-500/20 text-green-400 border-green-500/30" 
              : "bg-red-500/20 text-red-400 border-red-500/30"
          )}>
            <CreditCard className="h-3 w-3 mr-1" />
            {isPaid ? 'Paid' : 'Payment Pending'}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Untracked
          </Badge>
        );
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all hover:shadow-lg",
      isPaymentStatus && !isPaid && "border-destructive/50 bg-destructive/5"
    )}>
      <CardContent className="p-0">
        {/* Header with Number Plate */}
        <div className={cn(
          "p-4 flex items-center justify-between",
          isPaymentStatus && !isPaid 
            ? "bg-destructive/10" 
            : "bg-muted/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "px-4 py-2 rounded-md border-2 font-mono",
              isPaymentStatus && !isPaid
                ? "bg-destructive text-destructive-foreground border-destructive font-black text-2xl"
                : "bg-yellow-400 text-black border-black font-bold text-xl"
            )}>
              {driveOff.vehicle_registration || 'UNKNOWN'}
            </div>
            {driveOff.vehicle_model && (
              <span className="text-sm text-muted-foreground">
                {driveOff.vehicle_model}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => onEdit(driveOff)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(driveOff.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Amount Display */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PoundSterling className={cn(
                "h-6 w-6",
                isPaymentStatus && !isPaid ? "text-destructive" : "text-primary"
              )} />
              <span className={cn(
                "text-3xl font-bold",
                isPaymentStatus && !isPaid ? "text-destructive" : ""
              )}>
                £{driveOff.amount_drive_off.toFixed(2)}
              </span>
            </div>
            {getStatusBadge()}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{format(new Date(driveOff.drive_off_date), 'dd/MM/yyyy')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-muted-foreground" />
              <span>{driveOff.fuel_type}</span>
            </div>
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              <span>Pump {driveOff.pump_number}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{driveOff.cashier_name}</span>
            </div>
          </div>

          {/* Till Breakdown */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="text-muted-foreground">{driveOff.total_liters}L</span>
            {driveOff.till_1_amount > 0 && (
              <Badge variant="outline">Till 1: £{driveOff.till_1_amount.toFixed(2)}</Badge>
            )}
            {driveOff.till_2_amount > 0 && (
              <Badge variant="outline">Till 2: £{driveOff.till_2_amount.toFixed(2)}</Badge>
            )}
            {driveOff.till_3_amount > 0 && (
              <Badge variant="outline">Till 3: £{driveOff.till_3_amount.toFixed(2)}</Badge>
            )}
            {driveOff.till_4_amount > 0 && (
              <Badge variant="outline">Till 4: £{driveOff.till_4_amount.toFixed(2)}</Badge>
            )}
            {driveOff.till_5_amount > 0 && (
              <Badge variant="outline">Till 5: £{driveOff.till_5_amount.toFixed(2)}</Badge>
            )}
          </div>

          {/* Payment Info */}
          {driveOff.total_amount_received > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
              <CreditCard className="h-4 w-4" />
              <span>Received: £{driveOff.total_amount_received.toFixed(2)}</span>
              {driveOff.payment_received_date && (
                <span className="text-muted-foreground">
                  on {format(new Date(driveOff.payment_received_date), 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          )}

          {/* Reference */}
          {driveOff.tracking_reference && (
            <div className="text-xs text-muted-foreground">
              Ref: {driveOff.tracking_reference}
            </div>
          )}

          {/* Remarks */}
          {driveOff.remarks && (
            <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
              {driveOff.remarks}
            </p>
          )}

          {/* Branch */}
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Site: {driveOff.branches?.name || 'Unknown'}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
