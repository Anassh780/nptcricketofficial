import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import MatchReportPDF from "./MatchReportPDF"
import type { ScoreState, Team } from "../scoring/ScoringControls"

export interface MatchReportModalProps {
  isOpen: boolean
  onClose: () => void
  state: ScoreState
  teams: Team[]
  overs: number
}

export const MatchReportModal: React.FC<MatchReportModalProps> = ({
  isOpen,
  onClose,
  state,
  teams,
  overs,
}) => {
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressText, setProgressText] = useState("")
  const [scale, setScale] = useState(1)
  const modalBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    document.body.style.overflow = "hidden"

    const updateScale = () => {
      if (!modalBodyRef.current) return
      const availableWidth = modalBodyRef.current.clientWidth - 20
      if (availableWidth > 0 && availableWidth < 794) {
        setScale(Math.max(0.32, availableWidth / 794))
      } else {
        setScale(1)
      }
    }

    updateScale()
    const timer = setTimeout(updateScale, 60)
    window.addEventListener("resize", updateScale)

    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
      window.removeEventListener("resize", updateScale)
      clearTimeout(timer)
    }
  }, [isOpen])

  if (!isOpen) return null

  const generateJsPDFDocument = async () => {
    const pages = document.querySelectorAll<HTMLElement>(".pdf-page")
    if (!pages.length) return null

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()

    for (let i = 0; i < pages.length; i++) {
      setProgressText(`Rendering page ${i + 1} of ${pages.length}...`)
      const pageEl = pages[i]

      const prevTransform = pageEl.style.transform
      const prevOrigin = pageEl.style.transformOrigin
      pageEl.style.transform = "none"

      const canvas = await html2canvas(pageEl, {
        scale: 2, // High resolution export
        useCORS: true,
        backgroundColor: "#030d13",
        logging: false,
        width: 794,
        height: 1123,
        windowWidth: 1200,
      })

      pageEl.style.transform = prevTransform
      pageEl.style.transformOrigin = prevOrigin

      const imgData = canvas.toDataURL("image/jpeg", 0.92)
      if (i > 0) pdf.addPage()
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight)
    }

    return pdf
  }

  const handleDownloadPDF = async () => {
    try {
      setIsGenerating(true)
      const pdf = await generateJsPDFDocument()
      if (pdf) {
        setProgressText("Saving PDF file...")
        pdf.save(`cricvault_match_report_${state.matchId || "dpl6"}.pdf`)
      }
    } catch (err) {
      console.error("PDF generation failed:", err)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setIsGenerating(false)
      setProgressText("")
    }
  }

  const handleSharePDF = async () => {
    try {
      setIsGenerating(true)
      const pdf = await generateJsPDFDocument()
      if (!pdf) return

      setProgressText("Preparing share document...")
      const pdfBlob = pdf.output("blob")
      const filename = `cricvault_match_${state.matchId || "report"}.pdf`
      const file = new File([pdfBlob], filename, { type: "application/pdf" })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "CricVault Match Report",
          text: `Official match report for ${state.batting} vs ${state.bowling}.`,
        })
      } else {
        pdf.save(filename)
      }
    } catch (err) {
      console.error("Sharing failed:", err)
    } finally {
      setIsGenerating(false)
      setProgressText("")
    }
  }

  return createPortal(
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h3>
            📄 MATCH REPORT <span>PREVIEW</span>
          </h3>
          <div className="report-modal-actions">
            {isGenerating ? (
              <span style={{ fontSize: "12px", color: "#91e521", fontWeight: 600 }}>
                {progressText}
              </span>
            ) : (
              <>
                <button className="report-btn report-btn-secondary" onClick={handleSharePDF}>
                  📲 Share Report
                </button>
                <button className="report-btn report-btn-primary" onClick={handleDownloadPDF}>
                  ⬇ Download PDF
                </button>
              </>
            )}
            <button className="report-close-btn" onClick={onClose} aria-label="Close modal">
              ×
            </button>
          </div>
        </div>

        <div className="report-modal-body" ref={modalBodyRef}>
          <MatchReportPDF state={state} teams={teams} overs={overs} scale={scale} />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default MatchReportModal
