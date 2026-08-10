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
}

export interface ScoringControlsProps {
  state: ScoreState
  onRuns: (runs: number) => void
  onExtra: (type: "wd" | "nb" | "b" | "lb", amount: number) => void
  onWicket: (type: string, fielder: string, nextBatter: string) => void
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

  // Wicket Form Local State
  const [wicketType, setWicketType] = useState<string>("Bowled")
  const [fielder, setFielder] = useState<string>("")
  const [nextBatter, setNextBatter] = useState<string>("")
  const [selectedShot, setSelectedShot] = useState<string>("Cover Drive")

  const closePopover = () => {
    setActivePopover(null)
    setAnchorEl(null)
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
    onWicket(wicketType, fielder, nextBatter)
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

  const isScoringDisabled = Boolean(state.result || state.needsBowler)

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
        <button onClick={endOver}>◎ End over</button>
      </div>

      {/* Over summary strip */}
      <div className="over-strip">
        <span>OVER {Math.floor(state.balls / 6) + 1}</span>
        <div>
          {state.overMarks.length ? (
            state.overMarks.map((mark, i) => (
              <i
                className={
                  mark === "W"
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
          {state.overMarks.reduce(
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

            {["Caught", "Run out", "Stumped"].includes(wicketType) && (
              <label>
                Fielder Involved
                <select
                  value={fielder}
                  onChange={(e) => setFielder(e.target.value)}
                >
                  <option value="">Select fielder</option>
                  {teamByName(state.bowling, scoringTeams).players.map((p) => (
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
                  {remainingBatters.map((b) => (
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
              Confirm Wicket
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
      </ScoringPopover>
    </section>
  )
}

export default ScoringControls
