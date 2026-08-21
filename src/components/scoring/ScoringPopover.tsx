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
  placement: "above" | "below" | "center"
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
    top: window.innerHeight ? Math.max(20, Math.floor(window.innerHeight / 3)) : 140,
    left: window.innerWidth ? Math.max(12, Math.floor(window.innerWidth / 2 - 160)) : 20,
    arrowLeft: 160,
    placement: "below",
  })

  const updatePosition = () => {
    const popoverEl = popoverRef.current
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 360
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 640

    if (!anchorEl || !popoverEl) {
      // Safe center fallback
      setPos({
        top: Math.max(20, Math.floor(viewportHeight * 0.2)),
        left: Math.max(12, Math.floor((viewportWidth - 320) / 2)),
        arrowLeft: 160,
        placement: "center",
      })
      return
    }

    const anchorRect = anchorEl.getBoundingClientRect()
    const popoverRect = popoverEl.getBoundingClientRect()

    const popoverWidth = popoverRect.width || 320
    const popoverHeight = popoverRect.height || 220

    const gap = 8
    const viewportMargin = 10

    // Check if on very small screen / mobile -> center dialog
    if (viewportWidth <= 520) {
      const top = Math.max(viewportMargin, Math.min(Math.floor(viewportHeight * 0.15), viewportHeight - popoverHeight - viewportMargin))
      const left = Math.max(viewportMargin, Math.floor((viewportWidth - Math.min(popoverWidth, viewportWidth - 20)) / 2))
      setPos({
        top,
        left,
        arrowLeft: Math.floor(popoverWidth / 2),
        placement: "center",
      })
      return
    }

    // Vertical positioning
    const spaceAbove = anchorRect.top - gap
    const spaceBelow = viewportHeight - anchorRect.bottom - gap

    let placement: "above" | "below" | "center" = "above"
    if (spaceAbove >= popoverHeight) {
      placement = "above"
    } else if (spaceBelow >= popoverHeight) {
      placement = "below"
    } else {
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

    // Horizontal centering relative to anchor
    const anchorCenter = anchorRect.left + anchorRect.width / 2
    let left = anchorCenter - popoverWidth / 2

    // Clamp horizontal position
    left = Math.max(viewportMargin, Math.min(left, viewportWidth - popoverWidth - viewportMargin))

    let arrowLeft = anchorCenter - left
    arrowLeft = Math.max(16, Math.min(arrowLeft, popoverWidth - 16))

    setPos({
      top,
      left,
      arrowLeft,
      placement,
    })
  }

  useLayoutEffect(() => {
    if (!isOpen) return

    let animationFrameId: number
    const handleUpdate = () => {
      animationFrameId = requestAnimationFrame(updatePosition)
    }

    // Execute immediately and in next frame
    updatePosition()
    animationFrameId = requestAnimationFrame(updatePosition)

    window.addEventListener("scroll", handleUpdate, true)
    window.addEventListener("resize", handleUpdate)

    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener("scroll", handleUpdate, true)
      window.removeEventListener("resize", handleUpdate)
    }
  }, [isOpen, anchorEl])

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(updatePosition, 10)
      return () => clearTimeout(timer)
    }
  }, [isOpen, children])

  // ESC key handler
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

  if (!isOpen) return null

  return createPortal(
    <>
      <div className="popover-backdrop" onClick={onClose} />
      <div
        ref={popoverRef}
        className={`scoring-popover-container placement-${pos.placement}`}
        style={{
          top: `${pos.top}px`,
          left: `${pos.left}px`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {pos.placement !== "center" && (
          <div
            className={`popover-arrow placement-${pos.placement}`}
            style={{ left: `${pos.arrowLeft}px` }}
          />
        )}
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
