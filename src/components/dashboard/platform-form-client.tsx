'use client';

import { useFormStatus } from 'react-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Submit button that shows loading spinner when form is submitting.
 * Must be a child of a <form> element to work with useFormStatus.
 */
export function PlatformSubmitButton({
  children,
  variant = 'default',
  className = 'w-full mt-1',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'destructive';
  className?: string;
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
          Processing...
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/**
 * Disconnect button with confirmation dialog and loading state.
 */
function DisconnectSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
          Disconnecting...
        </>
      ) : (
        'Disconnect'
      )}
    </Button>
  );
}

export function DisconnectButton({
  platformName,
  platform,
  formAction,
}: {
  platformName: string;
  platform: string;
  formAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disconnect {platformName}</DialogTitle>
          <DialogDescription>
            This will remove the platform connection and delete all stored
            credentials. You can reconnect later.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <form action={formAction}>
            <input type="hidden" name="platform" value={platform} />
            <DisconnectSubmitButton />
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
