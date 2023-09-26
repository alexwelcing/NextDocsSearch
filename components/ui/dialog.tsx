// Dialog.tsx

import React, { HTMLAttributes, ElementType, forwardRef, Ref } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>;

const Dialog: ElementType<DialogProps> = DialogPrimitive.Root;

type DialogTriggerProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>;

const DialogTrigger: ElementType<DialogTriggerProps> = DialogPrimitive.Trigger;

type DialogPortalProps = DialogPrimitive.DialogPortalProps;

const DialogPortal: React.FC<DialogPortalProps> = ({ className, children, ...props }) => (
  <DialogPrimitive.Portal className={cn(className)} {...props}>
    <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
      {children}
    </div>
  </DialogPrimitive.Portal>
);
DialogPortal.displayName = 'DialogPortal';

type DialogOverlayProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>;

const DialogOverlay = forwardRef<ElementType<DialogOverlayProps>, DialogOverlayProps>(
  ({ className, children, ...props }, ref: Ref<any>) => (
    <DialogPrimitive.Overlay
      className={cn(
        'data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-all duration-100',
        className
      )}
      {...props}
      ref={ref}
    />
  )
);
DialogOverlay.displayName = 'DialogOverlay';

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  link?: string; // Add this line to define the 'link' prop
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps // Use the extended type here
>(({ className, children, link, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'animate-in data-[state=open]:fade-in-90 data-[state=open]:slide-in-from-bottom-10 sm:zoom-in-90 data-[state=open]:sm:slide-in-from-bottom-0 fixed z-50 grid w-full gap-4 rounded-b-lg bg-white p-6 sm:max-w-lg sm:rounded-lg overflow-y-auto max-h-[80vh]',
        'dark:bg-slate-900',
        className
      )}
      {...props}
    >
      {children}
      {link && <a href={link}>Read more</a>}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = 'DialogContent';

const DialogHeader: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left text-slate-900', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter: React.FC<HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

type DialogTitleProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>;

const DialogTitle = forwardRef<ElementType<DialogTitleProps>, DialogTitleProps>(
  ({ className, ...props }, ref: Ref<any>) => (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold text-slate-900', 'dark:text-slate-50', className)}
      {...props}
    />
  )
);
DialogTitle.displayName = 'DialogTitle';

type DialogDescriptionProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>;

const DialogDescription = forwardRef<ElementType<DialogDescriptionProps>, DialogDescriptionProps>(
  ({ className, ...props }, ref: Ref<any>) => (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-slate-400', 'dark:text-slate-400', className)}
      {...props}
    />
  )
);
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
