import React, { useState } from "react"
import { ScoringPopover } from "./ScoringPopover"

export interface Batter {
  name: string
  runs: number
  balls: number
  fours: number
  sixes: number
  out: boolean
  dismissal: string
}

export interface Bowler {
  name: string
  balls: number
  runs: number
  wickets: number
  maidens: number
}

export interface Team {
  code: string
  name: string
  color: string
  players: string[]
  logo?: string
  playerPhotos?: Record<string, string>
}

export interface BallEvent {
  id: number
  mark: string
  runs: number
  legal: boolean
}

export interface InningsSummary {
  team: string
  runs: number
  wickets: number
  balls: number
  extras?: { wd: number; nb: number; b: number; lb: number }
  batting?: Array<{ name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }>
  bowling?: Array<{ name: string; balls: number; runs: number; wickets: number; maidens: number }>
}

export interface ScoreState {
  matchId: string
  innings: number
  batting: string
  bowling: string
  runs: number
  wickets: number
  balls: number
  striker: string
  nonStriker: string
  bowler: string
  freeHit: boolean
  partnershipRuns: number
  partnershipBalls: number
  extras: { wd: number; nb: number; b: number; lb: number }
  batters: Record<string, Batter>
  bowlers: Record<string, Bowler>
  overMarks: string[]
  fall: string[]
  result: string
  needsBowler: boolean
  summaries?: InningsSummary[]
  events?: BallEvent[]
  target?: number | null
}

export interface ScoringControlsProps {
  state: ScoreState
  onRuns: (runs: number) => void
  onExtra: (type: "wd" | "nb" | "b" | "lb", amount: number) => void
  onWicket: (
    type: string,
    fielder: string,
    nextBatter: string,
    runOutOptions?: { runOutBatter: "striker" | "nonStriker"; runsCompleted: number },
  ) => void
  onSwapBatters: () => void
  undo: () => void
  endOver: () => void
  onChangeBowler: (name: string) => void
  scoringTeams: Team[]
  remainingBatters: Batter[]
  bowlerOptions: Bowler[]
  overs: number
  oversText: (balls: number) => string
  teamByName: (name: string, teams: Team[]) => Team
}

type ActivePopoverType =
  | { type: "extra"; extraType: "wd" | "nb" | "b" | "lb" }
  | { type: "wicket" }
  | { type: "run"; runs: number }
  | { type: "bowler" }
  | null

export const ScoringControls: React.FC<ScoringControlsProps> = ({
  state,
  onRuns,
  onExtra,
  onWicket,
  onSwapBatters,
  undo,
  endOver,
  onChangeBowler,
  scoringTeams,
  remainingBatters,
  bowlerOptions,
  overs,
  oversText,
  teamByName,
}) => {
  const [activePopover, setActivePopover] = useState<ActivePopoverType>(null)
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const overStripRef = React.useRef<HTMLDivElement | null>(null)

  // Wicket Form Local State
  const [wicketType, setWicketType] = useState<string>("Bowled")
  const [fielder, setFielder] = useState<string>("")
  const [nextBatter, setNextBatter] = useState<string>("")
  const [runOutBatter, setRunOutBatter] = useState<"striker" | "nonStriker">("striker")
  const [runOutCompletedRuns, setRunOutCompletedRuns] = useState<number>(0)
  const [customBowlerInput, setCustomBowlerInput] = useState("")
  const [showCustomBowlerInput, setShowCustomBowlerInput] = useState(false)
  const [selectedShot, setSelectedShot] = useState<string>("Straight")

  // Get all potential bowlers from the bowling team
  const bowlingTeam = teamByName ? teamByName(state.bowling, scoringTeams) : undefined
  const bowlingTeamPlayers = (bowlingTeam?.players || []).filter(
    (p) => p !== state.bowler,
  )

  const handleSelectBowler = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onChangeBowler(trimmed)
    setCustomBowlerInput("")
    setShowCustomBowlerInput(false)
    closePopover()
  }

  const isScoringDisabled = Boolean(state.result || state.needsBowler)
  React.useEffect(() => {
    if (state.needsBowler) {
      const target = overStripRef.current || (document.querySelector(".scoring-controls") as HTMLElement)
      if (target) {
        setAnchorEl(target)
        setActivePopover({ type: "bowler" })
      }
    } else if (!state.needsBowler && activePopover?.type === "bowler") {
      setActivePopover(null)
      setAnchorEl(null)
    }
  }, [state.needsBowler])

  const closePopover = () => {
    setActivePopover(null)
    setAnchorEl(null)
  }

  // Handle clicking End Over button
  const handleEndOverClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    endOver()
    setAnchorEl(e.currentTarget)
    setActivePopover({ type: "bowler" })
  }

  // Handle clicking Extra buttons (WD, NB, B, LB)
  const handleExtraClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    type: "wd" | "nb" | "b" | "lb",
  ) => {
    setAnchorEl(e.currentTarget)
    setActivePopover({ type: "extra", extraType: type })
  }

  // Handle clicking Wicket button (W)
  const handleWicketClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const initialWicketType = state.freeHit ? "Run out" : "Bowled"
    setWicketType(initialWicketType)
    setFielder("")
    setNextBatter(remainingBatters[0]?.name || "")
    setRunOutBatter("striker")
    setRunOutCompletedRuns(0)
    setAnchorEl(e.currentTarget)
    setActivePopover({ type: "wicket" })
  }

  // Handle clicking Run buttons (0, 1, 2, 3, 4, 6)
  const handleRunClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    runs: number,
  ) => {
    setAnchorEl(e.currentTarget)
    setActivePopover({ type: "run", runs })
  }

  // Confirm Extra runs selection
  const handleScoreExtraOption = (amount: number) => {
    if (activePopover?.type === "extra") {
      onExtra(activePopover.extraType, amount)
      closePopover()
    }
  }

  // Confirm Wicket
  const handleConfirmWicket = () => {
    onWicket(wicketType, fielder, nextBatter, {
      runOutBatter,
      runsCompleted: runOutCompletedRuns,
    })
    closePopover()
  }

  // Confirm Run scoring
  const handleConfirmRuns = (runs: number) => {
    onRuns(runs)
    closePopover()
  }

  // Render Popover Title based on active popover type
  const renderPopoverTitle = () => {
    if (!activePopover) return null
    if (activePopover.type === "extra") {
      const type = activePopover.extraType.toUpperCase()
      const isPenalty = type === "WD" || type === "NB"
      return (
        <>
          <span>{type}</span> — select {isPenalty ? "additional" : "byes"} runs
        </>
      )
    }
    if (activePopover.type === "wicket") {
      return (
        <>
          <span>OUT</span> — {state.freeHit ? "Free Hit Wicket" : "Record Wicket"}
        </>
      )
    }
    if (activePopover.type === "run") {
      return (
        <>
          <span>{activePopover.runs} RUNS</span> — Confirm Shot
        </>
      )
    }
    if (activePopover.type === "bowler") {
      return (
        <>
          <span>NEW OVER</span> — Select Bowler
        </>
      )
    }
    return null
  }

  return (
    <section className="panel scoring-controls">
      <div className="panel-label">
        <span>Ball-by-ball scoring</span>
        <small>
          {state.freeHit ? "FREE HIT ACTIVE" : "6 legal balls per over"}
        </small>
      </div>

      {/* Main Run Buttons (0, 1, 2, 3, 4, 6) & Wicket (W) */}
      <div className="run-buttons">
        {[0, 1, 2, 3, 4, 6].map((run) => (
          <button
            key={run}
            className={run >= 4 ? "boundary" : ""}
            onClick={(e) => handleRunClick(e, run)}
            disabled={isScoringDisabled}
          >
            {run}
          </button>
        ))}
        <button
          className="wicket"
          onClick={handleWicketClick}
          disabled={isScoringDisabled}
        >
          W
        </button>
      </div>

      {/* Extra Action Buttons (WD, NB, B, LB, Swap, Undo, End Over) */}
      <div className="extra-buttons">
        <button
          disabled={isScoringDisabled}
          onClick={(e) => handleExtraClick(e, "wd")}
        >
          WD
        </button>
        <button
          disabled={isScoringDisabled}
          onClick={(e) => handleExtraClick(e, "nb")}
        >
          NB
        </button>
        <button
          disabled={isScoringDisabled}
          onClick={(e) => handleExtraClick(e, "b")}
        >
          B
        </button>
        <button
          disabled={isScoringDisabled}
          onClick={(e) => handleExtraClick(e, "lb")}
        >
          LB
        </button>
        <button
          disabled={Boolean(state.result)}
          className="swap-batters"
          onClick={onSwapBatters}
        >
          ⇄ Swap batters
        </button>
        <button onClick={undo}>↶ Undo</button>
        <button onClick={handleEndOverClick}>◎ End over</button>
      </div>

      {/* Over summary strip */}
      <div className="over-strip" ref={overStripRef}>
        <span>OVER {Math.floor((state.balls || 0) / 6) + 1}</span>
        <div>
          {(state.overMarks || []).length ? (
            state.overMarks.map((mark, i) => (
              <i
                className={
                  mark === "W" || mark.startsWith("W+")
                    ? "red"
                    : mark.includes("4") || mark.includes("6")
                      ? "green"
                      : ""
                }
                key={i}
              >
                {mark}
              </i>
            ))
          ) : (
            <small>No balls yet</small>
          )}
        </div>
        <b>
          This over:{" "}
          {(state.overMarks || []).reduce(
            (sum, mark) => sum + (Number.parseInt(mark) || 0),
            0,
          )}{" "}
          runs
        </b>
      </div>

      {/* Dynamic Floating Popover anchored directly to clicked button */}
      <ScoringPopover
        isOpen={Boolean(activePopover && anchorEl)}
        anchorEl={anchorEl}
        onClose={closePopover}
        title={renderPopoverTitle()}
      >
        {activePopover?.type === "extra" && (
          <div>
            <div className="popover-runs-grid">
              {[0, 1, 2, 3, 4, 6]
                .filter(
                  (n) =>
                    !(
                      activePopover.extraType === "b" ||
                      activePopover.extraType === "lb"
                    ) || n > 0,
                )
                .map((n) => (
                  <button
                    key={n}
                    className="popover-run-chip"
                    onClick={() => handleScoreExtraOption(n)}
                  >
                    +{n}
                  </button>
                ))}
            </div>
            <p className="popover-help-text">
              {activePopover.extraType === "wd" || activePopover.extraType === "nb"
                ? "Includes standard +1 run penalty. Does not increment legal ball count."
                : "Extra runs scored without bat contact."}
            </p>
          </div>
        )}

        {activePopover?.type === "wicket" && (
          <div className="popover-wicket-form">
            <label>
              Dismissal Type
              <select
                value={wicketType}
                onChange={(e) => {
                  setWicketType(e.target.value)
                  setFielder("")
                }}
              >
                {(state.freeHit
                  ? ["Run out"]
                  : [
                      "Bowled",
                      "Caught",
                      "LBW",
                      "Run out",
                      "Stumped",
                      "Hit wicket",
                    ]
                ).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>

            {wicketType === "Run out" && (
              <div className="runout-details-box">
                <label>
                  <span>Batter Run Out</span>
                  <div className="runout-batter-select">
                    <button
                      type="button"
                      className={`runout-choice-btn ${runOutBatter === "striker" ? "selected" : ""}`}
                      onClick={() => setRunOutBatter("striker")}
                    >
                      Striker ({state.striker})
                    </button>
                    <button
                      type="button"
                      className={`runout-choice-btn ${runOutBatter === "nonStriker" ? "selected" : ""}`}
                      onClick={() => setRunOutBatter("nonStriker")}
                    >
                      Non-Striker ({state.nonStriker})
                    </button>
                  </div>
                </label>

                <label>
                  <span>Completed Runs</span>
                  <div className="runout-runs-row">
                    {[0, 1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        type="button"
                        className={`runout-run-btn ${runOutCompletedRuns === r ? "selected" : ""}`}
                        onClick={() => setRunOutCompletedRuns(r)}
                      >
                        {r === 0 ? "0 runs" : `+${r}`}
                      </button>
                    ))}
                  </div>
                </label>
              </div>
            )}

            {["Caught", "Run out", "Stumped"].includes(wicketType) && (
              <label>
                Fielder Involved
                <select
                  value={fielder}
                  onChange={(e) => setFielder(e.target.value)}
                >
                  <option value="">Select fielder</option>
                  {(bowlingTeam?.players || []).map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}

            {state.wickets < 9 && (
              <label>
                Next Batter
                <select
                  value={nextBatter}
                  onChange={(e) => setNextBatter(e.target.value)}
                >
                  {(remainingBatters || []).map((b) => (
                    <option key={b.name}>{b.name}</option>
                  ))}
                </select>
              </label>
            )}

            <button
              className="popover-confirm-btn"
              onClick={handleConfirmWicket}
              disabled={
                (!nextBatter && state.wickets < 9) ||
                (["Caught", "Run out", "Stumped"].includes(wicketType) && !fielder)
              }
            >
              Confirm Wicket {runOutCompletedRuns > 0 && `(+${runOutCompletedRuns} Runs)`}
            </button>
          </div>
        )}

        {activePopover?.type === "run" && (
          <div className="popover-run-confirm-body">
            <div className="shot-chips-row">
              {["Straight", "Cover Drive", "Pull Shot", "Lofted", "Swept", "Flick"].map(
                (shot) => (
                  <button
                    key={shot}
                    className={`shot-chip ${selectedShot === shot ? "selected" : ""}`}
                    onClick={() => setSelectedShot(shot)}
                  >
                    {shot}
                  </button>
                ),
              )}
            </div>
            <button
              className="popover-confirm-btn"
              onClick={() => handleConfirmRuns(activePopover.runs)}
            >
              {activePopover.runs === 0
                ? "Record Dot Ball (0)"
                : activePopover.runs >= 4
                  ? `Confirm Boundary (${activePopover.runs})`
                  : `Score ${activePopover.runs} Run${activePopover.runs > 1 ? "s" : ""}`}
            </button>
          </div>
        )}

        {activePopover?.type === "bowler" && (
          <div className="bowler-list">
            <div className="bowler-section-label">SELECT BOWLER FOR NEXT OVER</div>
            {/* Active/previous bowlers */}
            {Object.values(state.bowlers || {})
              .filter((b) => b && b.name !== state.bowler)
              .map((b) => (
                <button
                  key={b.name}
                  onClick={() => handleSelectBowler(b.name)}
                >
                  <span>{b.name}</span>
                  <small>
                    {oversText(b.balls || 0)} overs · {b.runs || 0} runs · {b.wickets || 0} wkt
                  </small>
                </button>
              ))}

            {/* Other roster players from bowling team who haven't bowled yet */}
            {(bowlingTeamPlayers || [])
              .filter((name) => !state.bowlers?.[name])
              .map((name) => (
                <button
                  key={name}
                  onClick={() => handleSelectBowler(name)}
                >
                  <span>{name}</span>
                  <small style={{ color: "var(--lime)" }}>New Bowler</small>
                </button>
              ))}

            {/* Custom Bowler Input Option for Admin */}
            {!showCustomBowlerInput ? (
              <button
                type="button"
                className="add-custom-bowler-trigger"
                onClick={() => setShowCustomBowlerInput(true)}
              >
                <span>➕ Add Custom Bowler</span>
                <small>Type name</small>
              </button>
            ) : (
              <div className="custom-bowler-form">
                <input
                  type="text"
                  placeholder="Enter bowler name..."
                  value={customBowlerInput}
                  onChange={(e) => setCustomBowlerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customBowlerInput.trim()) {
                      handleSelectBowler(customBowlerInput)
                    }
                  }}
                  autoFocus
                />
                <div className="custom-bowler-form-actions">
                  <button
                    type="button"
                    className="popover-confirm-btn"
                    style={{ height: "32px", fontSize: "11px", flex: 1 }}
                    onClick={() => handleSelectBowler(customBowlerInput)}
                    disabled={!customBowlerInput.trim()}
                  >
                    Add & Bowl
                  </button>
                  <button
                    type="button"
                    style={{
                      height: "32px",
                      padding: "0 10px",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: "6px",
                      color: "#9cafb5",
                      cursor: "pointer",
                      fontSize: "11px",
                    }}
                    onClick={() => {
                      setShowCustomBowlerInput(false)
                      setCustomBowlerInput("")
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </ScoringPopover>
    </section>
  )
}

export default ScoringControls
