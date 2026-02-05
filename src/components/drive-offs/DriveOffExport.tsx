import { format } from 'date-fns';
import { DriveOff } from '@/hooks/useDriveOffs';

export function exportDriveOffsToCSV(driveOffs: DriveOff[], month: Date, siteName?: string) {
  const monthStr = format(month, 'MMMM yyyy');
  
  // CSV Headers matching the template format
  const headers = [
    'Site',
    'Date of Drive off',
    'Vehicle Registration No.',
    'Model',
    'Pump No.',
    'Name of cashier',
    'Fuel Type',
    'Total Liters',
    'Amount Drive Offs',
    'Till - 1',
    'Till - 2',
    'Till - 3',
    'Till - 4',
    'Till - 5',
    'Total Amount Received',
    'Payment Date',
    'Payment Till - 1',
    'Payment Till - 2',
    'Date Handed to Guardian',
    'Tracking Status',
    'Reference Number',
    'Head Office Notes',
    'Remarks'
  ];

  // Build CSV rows
  const rows = driveOffs.map(d => [
    d.branches?.name || siteName || '',
    format(new Date(d.drive_off_date), 'dd/MM/yyyy'),
    d.vehicle_registration,
    d.vehicle_model || '',
    d.pump_number.toString(),
    d.cashier_name,
    d.fuel_type,
    d.total_liters.toFixed(2) + 'L',
    '£' + d.amount_drive_off.toFixed(2),
    d.till_1_amount > 0 ? '£' + d.till_1_amount.toFixed(2) : '',
    d.till_2_amount > 0 ? '£' + d.till_2_amount.toFixed(2) : '',
    d.till_3_amount > 0 ? '£' + d.till_3_amount.toFixed(2) : '',
    d.till_4_amount > 0 ? '£' + d.till_4_amount.toFixed(2) : '',
    d.till_5_amount > 0 ? '£' + d.till_5_amount.toFixed(2) : '',
    d.total_amount_received > 0 ? '£' + d.total_amount_received.toFixed(2) : '',
    d.payment_received_date ? format(new Date(d.payment_received_date), 'dd/MM/yyyy') : '',
    d.payment_till_1 > 0 ? '£' + d.payment_till_1.toFixed(2) : '',
    d.payment_till_2 > 0 ? '£' + d.payment_till_2.toFixed(2) : '',
    d.date_handed_to_guardian ? format(new Date(d.date_handed_to_guardian), 'dd/MM/yyyy') : '',
    d.tracking_status ? d.tracking_status.replace('_', ' ').toUpperCase() : '',
    d.tracking_reference || '',
    d.head_office_notes || '',
    d.remarks || ''
  ]);

  // Calculate totals
  const totals = {
    liters: driveOffs.reduce((sum, d) => sum + d.total_liters, 0),
    amount: driveOffs.reduce((sum, d) => sum + d.amount_drive_off, 0),
    till1: driveOffs.reduce((sum, d) => sum + (d.till_1_amount || 0), 0),
    till2: driveOffs.reduce((sum, d) => sum + (d.till_2_amount || 0), 0),
    till3: driveOffs.reduce((sum, d) => sum + (d.till_3_amount || 0), 0),
    till4: driveOffs.reduce((sum, d) => sum + (d.till_4_amount || 0), 0),
    till5: driveOffs.reduce((sum, d) => sum + (d.till_5_amount || 0), 0),
    received: driveOffs.reduce((sum, d) => sum + (d.total_amount_received || 0), 0),
  };

  // Add totals row
  const totalsRow = [
    'TOTAL',
    '',
    '',
    '',
    '',
    '',
    '',
    totals.liters.toFixed(2) + 'L',
    '£' + totals.amount.toFixed(2),
    totals.till1 > 0 ? '£' + totals.till1.toFixed(2) : '',
    totals.till2 > 0 ? '£' + totals.till2.toFixed(2) : '',
    totals.till3 > 0 ? '£' + totals.till3.toFixed(2) : '',
    totals.till4 > 0 ? '£' + totals.till4.toFixed(2) : '',
    totals.till5 > 0 ? '£' + totals.till5.toFixed(2) : '',
    totals.received > 0 ? '£' + totals.received.toFixed(2) : '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ];

  // Build CSV content
  const titleRow = [`DAILY DRIVE OFFS - ${monthStr}`];
  const emptyRow: string[] = [];
  
  const csvContent = [
    titleRow,
    emptyRow,
    headers,
    ...rows,
    emptyRow,
    totalsRow
  ]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  // Create and trigger download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `Drive_Offs_${format(month, 'MMM_yyyy')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
