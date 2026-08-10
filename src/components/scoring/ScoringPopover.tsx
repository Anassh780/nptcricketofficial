import React, { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import "./scoring-popover.css"

export interface ScoringPopoverProps {
  isOpen: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  children: React.ReactNode
  title?: React.ReactNode
}

interface PositionState {
  top: number
  left: number
  arrowLeft: number
  placement: "above" | "below"
  isMeasured: boolean
}

export const ScoringPopover: React.FC<ScoringPopoverProps> = ({
  isOpen,
  anchorEl,
  onClose,
  children,
  title,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<PositionState>({
    top: 0,
    left: 0,
    arrowLeft: 0,
    placement: "above",
    isMeasured: false,
  })

  const updatePosition = () => {
    if (!anchorEl || !popoverRef.current) return

    const anchorRect = anchorEl.getBoundingClientRect()
    const popoverRect = popoverRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const popoverWidth = popoverRect.width || 260
    const popoverHeight = popoverRect.height || 180

    const gap = 10
    const viewportMargin = 12

    // Intelligent vertical positioning: choose above if space allows, else below
    const spaceAbove = anchorRect.top - gap
    const spaceBelow = viewportHeight - anchorRect.bottom - gap

    let placement: "above" | "below" = "above"
    if (spaceAbove >= popoverHeight) {
      placement = "above"
    } else if (spaceBelow >= popoverHeight) {
      placement = "below"
    } else {
      // Pick whichever side has more space
      placement = spaceAbove > spaceBelow ? "above" : "below"
    }

    let top = 0
    if (placement === "above") {
      top = anchorRect.top - popoverHeight - gap
    } else {
      top = anchorRect.bottom + gap
    }

    // Clamp vertical position so it stays inside viewport
    top = Math.max(viewportMargin, Math.min(top, viewportHeight - popoverHeight - viewportMargin))

    // Horizontal centering & collision detection
    const anchorCenter = anchorRect.left + anchorRect.width / 2
    let left = anchorCenter - popoverWidth / 2

    // Clamp horizontal position to avoid hiding outside screen edges
    left = Math.max(viewportMargin, Math.min(left, viewportWidth - popoverWidth - viewportMargin))

    // Calculate relative arrow position pointing to anchor center
    let arrowLeft = anchorCenter - left
    arrowLeft = Math.max(20, Math.min(arrowLeft, popoverWidth - 20))

    setPos({
      top,
      left,
      arrowLeft,
      placement,
      isMeasured: true,
    })
  }

  useLayoutEffect(() => {
    if (!isOpen || !anchorEl) return

    let animationFrameId: number

    const handleUpdate = () => {
      animationFrameId = requestAnimationFrame(updatePosition)
    }

    // Initial position calculation
    updatePosition()

    // Recalculate position on scroll (capture phase catches inner container scrolls) and window resize
    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
    }
  }, [isOpen, anchorEl])

  // Recalculate when children change layout height
  useEffect(() => {
    if (isOpen && anchorEl) {
      updatePosition()
    }
  }, [children])

  // ESC key handler to close popover
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !anchorEl) return null

  return createPortal(
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div
        ref={popoverRef}
        className={`scoring-popover-container placement-${pos.placement}`}
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
          opacity: pos.isMeasured ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`popover-arrow placement-${pos.placement}`}
          style={{ left: `${pos.arrowLeft}px` }}
        />
        {title && (
          <div className="popover-header">
            <h4>{title}</h4>
            <button className="popover-close-btn" onClick={onClose} aria-label="Close popover">
              ×
            </button>
          </div>
        )}
        <div className="popover-body">{children}</div>
      </div>
    </>,
    document.body,
  )
}

export default ScoringPopover
