'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** The trigger button/element that opens the dialog */
  trigger: React.ReactNode;
  /** Called when user confirms - submit a hidden form, etc. */
  onConfirm?: () => void;
  /** If provided, renders a form with this action instead of calling onConfirm */
  formAction?: string | ((formData: FormData) => void);
  /** Hidden form fields to include when using formAction */
  formFields?: Record<string, string>;
  children?: React.ReactNode;
}

/**
 * Reusable confirmation dialog for destructive or important actions.
 * Supports both client-side callbacks and server action form submissions.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  trigger,
  onConfirm,
  formAction,
  formFields,
  children,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {cancelLabel}
          </Button>
          {formAction ? (
            <form action={formAction}>
              {formFields &&
                Object.entries(formFields).map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
              <Button type="submit" variant={variant}>
                {confirmLabel}
              </Button>
            </form>
          ) : (
            <Button
              variant={variant}
              onClick={() => {
                onConfirm?.();
                setOpen(false);
              }}
            >
              {confirmLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
