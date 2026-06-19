"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-muted/80 text-xs/relaxed transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className
      )}
      {...props}
    />
  )
}

function stopDismissEvent(event: Event): void {
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

function suppressCurrentOutsideClickSequence(targetWindow: Window): void {
  const events = ["pointerup", "mousedown", "mouseup", "click", "touchend"] as const
  const controller = new AbortController()

  function stopAndCleanup(event: Event) {
    stopDismissEvent(event)
    if (event.type === "click" || event.type === "touchend") {
      cleanup()
    }
  }

  function cleanup() {
    controller.abort()
    targetWindow.clearTimeout(timeoutId)
  }

  for (const eventName of events) {
    targetWindow.addEventListener(eventName, stopAndCleanup, {
      capture: true,
      signal: controller.signal,
    })
  }

  const timeoutId = targetWindow.setTimeout(cleanup, 800)
}

function DialogContent({
  className,
  children,
  onPointerDownOutside,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  onPointerDownOutside?: (event: PointerEvent) => void
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!onPointerDownOutside) return
    const handleOutside = onPointerDownOutside
    const targetWindow = contentRef.current?.ownerDocument.defaultView ?? window

    function handlePointerDown(event: PointerEvent) {
      const content = contentRef.current
      const target = event.target

      if (!content || !(target instanceof Node)) return
      if (event.composedPath().includes(content)) return

      stopDismissEvent(event)
      suppressCurrentOutsideClickSequence(targetWindow)
      handleOutside(event)
    }

    targetWindow.addEventListener("pointerdown", handlePointerDown, true)
    return () => {
      targetWindow.removeEventListener("pointerdown", handlePointerDown, true)
    }
  }, [onPointerDownOutside])

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        ref={contentRef}
        data-slot="dialog-content"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[85svh] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col border border-border bg-background bg-clip-padding text-xs/relaxed shadow-lg transition duration-150 ease-out data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-3 right-3"
                size="icon-sm"
              />
            }
          >
            <XIcon data-icon="inline-start" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-sm font-medium text-foreground", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-xs/relaxed text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
