import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertMessageProps {
  type: 'success' | 'error';
  message: string;
}

export function AlertMessage({ type, message }: AlertMessageProps) {
  if (!message) return null;

  if (type === 'success') {
    return (
      <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-800 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{message}</span>
      </div>
    );
  }

  return (
    <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive flex items-start gap-2">
      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
