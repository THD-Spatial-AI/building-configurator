// Confirmation dialog shown when the user tries to close the configurator,
// warning about unsaved changes and offering to save-and-close or discard.

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CloseConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasUnsavedChanges: boolean;
  onSaveAndClose: () => void;
  onDiscardOrClose: () => void;
}

export function CloseConfirmDialog({
  open, onOpenChange, hasUnsavedChanges, onSaveAndClose, onDiscardOrClose,
}: CloseConfirmDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border border-border rounded-md p-6 shadow-xl w-full max-w-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center gap-2 mb-3">
            {hasUnsavedChanges && <AlertTriangle className="size-4 text-amber-500 shrink-0" />}
            <DialogPrimitive.Title className="text-base font-semibold text-foreground">
              {hasUnsavedChanges ? 'Unsaved Changes' : 'Close Configurator'}
            </DialogPrimitive.Title>
          </div>

          <div className="mb-4">
            {hasUnsavedChanges ? (
              <>
                <p className="text-sm text-foreground mb-2">
                  You have unsaved changes to this building configuration. What would you like to do?
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-[6px] px-3 py-2">
                  <p className="text-xs text-amber-800">
                    Closing without saving will discard all modifications made since the last Apply.
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm text-foreground">
                Close the building configurator and return to the map?
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 text-sm font-medium text-foreground border border-border rounded-[6px] hover:bg-muted transition-colors cursor-pointer"
            >
              Continue Editing
            </button>
            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={onSaveAndClose}
                className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-[6px] hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Save &amp; Close
              </button>
            )}
            <button
              type="button"
              onClick={onDiscardOrClose}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-[6px] transition-colors cursor-pointer',
                hasUnsavedChanges
                  ? 'text-destructive border border-destructive/30 hover:bg-destructive/5'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
            >
              {hasUnsavedChanges ? 'Discard Changes' : 'Close'}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
