'use client';

import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

/**
 * Form submit button with loading spinner via useFormStatus.
 * Must be a child of a <form> element.
 * Works as plain HTML submit when JS is not available (progressive enhancement).
 */
export function SubmitButton({
  children,
  variant = 'default',
  className,
  pendingText = 'Processing...',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive' | 'ghost';
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      size="sm"
      variant={variant}
      disabled={pending}
      className={className}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
