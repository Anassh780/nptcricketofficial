import React from "react"
import type { BallEvent, ScoreState, Team } from "../scoring/ScoringControls"

export interface MatchReportPDFProps {
  state: ScoreState
  teams: Team[]
  overs: number
  scale?: number
}

const PDFPage: React.FC<{
  pageClass: string
  scale?: number
  children: React.ReactNode
}> = ({ pageClass, scale, children }) => {
  if (scale && scale < 0.98) {
    return (
      <div
        className="pdf-page-scaler"
        style={{
          width: `${Math.round(794 * scale)}px`,
          height: `${Math.round(1123 * scale)}px`,
          overflow: "hidden",
          position: "relative",
          flexShrink: 0,
          borderRadius: `${Math.max(6, Math.round(16 * scale))}px`,
          boxShadow: "0 10px 32px rgba(0, 0, 0, 0.75)",
          margin: "0 auto",
        }}
      >
        <div
          className={`pdf-page ${pageClass}`}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: "794px",
            height: "1123px",
            boxShadow: "none",
          }}
        >
          {children}
        </div>
      </div>
    )
  }
  return <div className={`pdf-page ${pageClass}`}>{children}</div>
}

export const MatchReportPDF: React.FC<MatchReportPDFProps> = ({
  state,
  teams,
  overs,
  scale,
}) => {
  const teamByName = (name: string) =>
    teams.find((t) => t.name === name) || {
      name,
      code: name.slice(0, 3).toUpperCase(),
      logo: undefined,
    }

  const battingTeam = teamByName(state.batting)
  const bowlingTeam = teamByName(state.bowling)

  const summaries = state.summaries || []
  const firstInnings = summaries[0]

  const firstRuns = firstInnings ? firstInnings.runs : 0
  const firstWickets = firstInnings ? firstInnings.wickets : 0
  const firstOversText = firstInnings ? (firstInnings.balls / 6).toFixed(1) : "0.0"

  const secondRuns = state.runs
  const secondWickets = state.wickets
  const secondOversText = (state.balls / 6).toFixed(1)

  // Current innings batters & bowlers
  const currentBatters = Object.values(state.batters || {})
  const currentBowlers = Object.values(state.bowlers || {})

  // First innings batters & bowlers if available
  const firstBatters = firstInnings?.batting || []
  const firstBowlers = firstInnings?.bowling || []

  // Combine all batters for top scorer award calculation
  const allBattersCombined = [...firstBatters, ...currentBatters]
  const topScorer = allBattersCombined.reduce((top, current) => {
    return current.runs > (top?.runs || -1) ? current : top
  }, allBattersCombined[0] || currentBatters[0])

  // Combine all bowlers for top bowler award calculation
  const allBowlersCombined = [...firstBowlers, ...currentBowlers]
  const topBowler = allBowlersCombined.reduce((top, current) => {
    if (current.wickets > (top?.wickets || -1)) return current
    if (current.wickets === top?.wickets && current.runs < (top?.runs || 999)) return current
    return top
  }, allBowlersCombined[0] || currentBowlers[0])

  // Player of the match
  const potm = topScorer?.runs >= 20 || !topBowler ? topScorer : topBowler

  // Over-by-over ball timeline
  const eventsList: BallEvent[] = state.events || []
  const overTimeline: Record<number, BallEvent[]> = {}
  eventsList.forEach((ev) => {
    const overNum = Math.floor((ev.id - 1) / 6) + 1
    if (!overTimeline[overNum]) overTimeline[overNum] = []
    overTimeline[overNum].push(ev)
  })

  // Cumulative runs graph data
  let cumScore = 0
  const graphPoints = eventsList.map((ev: BallEvent, i: number) => {
    cumScore += ev.runs
    const x = (i / Math.max(eventsList.length - 1, 1)) * 300
    const y = 120 - (cumScore / Math.max(state.runs, 10)) * 100
    return { x, y, score: cumScore }
  })
  const polylinePoints = graphPoints.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(" ")

  return (
    <div className="pdf-export-container" id="pdf-report-root">
      {/* ---------------- PAGE 1: HERO COVER ---------------- */}
      <PDFPage pageClass="page-1" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>CRIC<span>VAULT</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>OFFICIAL MATCH REPORT</span>
            <small>DPL 6 TOURNAMENT BOOKLET</small>
          </div>
        </div>

        <div className="hero-cover">
          <div className="hero-tournament-badge">Diamond Premier League · Match #{state.matchId?.slice(-4) || "001"}</div>

          <div className="hero-title-group">
            <h1>GRAND MATCH REPORT</h1>
            <p>{new Date().toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} · CricVault Arena</p>
          </div>

          <div className="hero-teams-vs">
            <div className="hero-team-card">
              <div className="hero-team-logo">
                {battingTeam.logo ? <img src={battingTeam.logo} alt={battingTeam.name} /> : battingTeam.code}
              </div>
              <h2>{battingTeam.name}</h2>
              <div className="hero-team-score">{secondRuns}/{secondWickets} <small>({secondOversText} ov)</small></div>
            </div>

            <div className="hero-vs-badge">VS</div>

            <div className="hero-team-card">
              <div className="hero-team-logo">
                {bowlingTeam.logo ? <img src={bowlingTeam.logo} alt={bowlingTeam.name} /> : bowlingTeam.code}
              </div>
              <h2>{bowlingTeam.name}</h2>
              <div className="hero-team-score">{firstRuns}/{firstWickets} <small>({firstOversText} ov)</small></div>
            </div>
          </div>

          <div className="victory-banner">
            🏆 {state.result || "MATCH IN PROGRESS"}
          </div>
        </div>

        <div className="pdf-footer">
          <span><i></i> Generated by CricVault Broadcast Engine</span>
          <span>PAGE 1 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 2: MATCH SUMMARY DASHBOARD ---------------- */}
      <PDFPage pageClass="page-2" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>MATCH SUMMARY <span>DASHBOARD</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 2</span>
            <small>DPL 6 OFFICIAL</small>
          </div>
        </div>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-card-head">
              <h3>{battingTeam.name}</h3>
              <span>{secondRuns}/{secondWickets}</span>
            </div>
            <div className="summary-metrics">
              <div className="summary-metric"><small>OVERS</small><strong>{secondOversText}</strong></div>
              <div className="summary-metric"><small>RUN RATE</small><strong>{state.balls ? ((secondRuns / state.balls) * 6).toFixed(2) : "0.00"}</strong></div>
              <div className="summary-metric"><small>EXTRAS</small><strong>{Object.values(state.extras || {}).reduce((a: number, b: number) => a + b, 0)}</strong></div>
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-card-head">
              <h3>{bowlingTeam.name}</h3>
              <span>{firstRuns}/{firstWickets}</span>
            </div>
            <div className="summary-metrics">
              <div className="summary-metric"><small>OVERS</small><strong>{firstOversText}</strong></div>
              <div className="summary-metric"><small>RUN RATE</small><strong>{firstInnings?.balls ? ((firstRuns / firstInnings.balls) * 6).toFixed(2) : "0.00"}</strong></div>
              <div className="summary-metric"><small>EXTRAS</small><strong>{firstInnings?.extras ? Object.values(firstInnings.extras).reduce((a: number, b: number) => a + b, 0) : 0}</strong></div>
            </div>
          </div>
        </div>

        <div className="comparison-box">
          <h4>Match Performance Indicators</h4>

          <div className="stat-bar-group">
            <div className="stat-bar-label"><span>Batting Strike Power ({battingTeam.name})</span><strong>{secondRuns} Runs</strong></div>
            <div className="stat-bar-bg">
              <div className="stat-bar-fill" style={{ width: `${Math.min((secondRuns / Math.max(firstRuns + secondRuns, 1)) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="stat-bar-group">
            <div className="stat-bar-label"><span>Boundary Count (4s & 6s)</span><strong>{allBattersCombined.reduce((acc: number, b) => acc + b.fours + b.sixes, 0)} Boundaries</strong></div>
            <div className="stat-bar-bg">
              <div className="stat-bar-fill" style={{ width: "75%" }} />
            </div>
          </div>
        </div>

        <div className="pdf-footer">
          <span><i></i> Verified Tournament Data</span>
          <span>PAGE 2 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 3: BATTING PERFORMANCE ---------------- */}
      <PDFPage pageClass="page-3" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>BATTING <span>PERFORMANCE</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 3</span>
            <small>DPL 6 OFFICIAL</small>
          </div>
        </div>

        {topScorer && (
          <div className="top-scorer-award">
            <div className="award-left">
              <div className="award-badge">🥇</div>
              <div className="award-details">
                <h3>TOP SCORER AWARD</h3>
                <p>{topScorer.name} · {topScorer.out ? topScorer.dismissal : "NOT OUT"}</p>
              </div>
            </div>
            <div className="award-stat">
              {topScorer.runs} <small>({topScorer.balls} balls · SR {topScorer.balls ? ((topScorer.runs / topScorer.balls) * 100).toFixed(1) : 0})</small>
            </div>
          </div>
        )}

        {/* 1st Innings Batting Scorecard if available */}
        {firstInnings && firstBatters.length > 0 && (
          <div className="table-section">
            <h4>Innings 1 Batting Scorecard — {firstInnings.team} ({firstInnings.runs}/{firstInnings.wickets})</h4>
            <table className="pdf-data-table">
              <thead>
                <tr>
                  <th>BATSMAN</th>
                  <th>DISMISSAL / STATUS</th>
                  <th>RUNS</th>
                  <th>BALLS</th>
                  <th>4s</th>
                  <th>6s</th>
                  <th>SR</th>
                </tr>
              </thead>
              <tbody>
                {firstBatters.map((b) => (
                  <tr key={b.name} className={b.name === topScorer?.name ? "top-row" : ""}>
                    <td><strong>{b.name}</strong></td>
                    <td><small>{b.out ? b.dismissal || "out" : "not out"}</small></td>
                    <td><strong>{b.runs}</strong></td>
                    <td>{b.balls}</td>
                    <td>{b.fours}</td>
                    <td>{b.sixes}</td>
                    <td>{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Current Innings Batting Scorecard */}
        <div className="table-section">
          <h4>{firstInnings ? "Innings 2 Batting Scorecard" : "Batting Scorecard"} — {state.batting} ({secondRuns}/{secondWickets})</h4>
          <table className="pdf-data-table">
            <thead>
              <tr>
                <th>BATSMAN</th>
                <th>DISMISSAL / STATUS</th>
                <th>RUNS</th>
                <th>BALLS</th>
                <th>4s</th>
                <th>6s</th>
                <th>SR</th>
              </tr>
            </thead>
            <tbody>
              {currentBatters.map((b) => (
                <tr key={b.name} className={b.name === topScorer?.name ? "top-row" : ""}>
                  <td><strong>{b.name}</strong></td>
                  <td><small>{b.out ? b.dismissal || "out" : "not out"}</small></td>
                  <td><strong>{b.runs}</strong></td>
                  <td>{b.balls}</td>
                  <td>{b.fours}</td>
                  <td>{b.sixes}</td>
                  <td>{b.balls ? ((b.runs / b.balls) * 100).toFixed(1) : "0.0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pdf-footer">
          <span><i></i> Official Scorecard</span>
          <span>PAGE 3 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 4: BOWLING PERFORMANCE ---------------- */}
      <PDFPage pageClass="page-4" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>BOWLING <span>ANALYSIS</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 4</span>
            <small>DPL 6 OFFICIAL</small>
          </div>
        </div>

        {topBowler && (
          <div className="top-scorer-award" style={{ borderColor: "rgba(76, 143, 247, 0.4)", background: "linear-gradient(135deg, rgba(76, 143, 247, 0.12), rgba(7, 23, 32, 0.95))" }}>
            <div className="award-left">
              <div className="award-badge">🏅</div>
              <div className="award-details">
                <h3 style={{ color: "#4c8ff7" }}>BEST BOWLER AWARD</h3>
                <p>{topBowler.name} · Economy {topBowler.balls ? ((topBowler.runs / topBowler.balls) * 6).toFixed(2) : "0.00"}</p>
              </div>
            </div>
            <div className="award-stat">
              {topBowler.wickets} Wkts <small>({topBowler.runs} runs · {(topBowler.balls / 6).toFixed(1)} ov)</small>
            </div>
          </div>
        )}

        {/* First Innings Bowling Figures if available */}
        {firstInnings && firstBowlers.length > 0 && (
          <div className="table-section">
            <h4>Innings 1 Bowling Analysis ({bowlingTeam.name})</h4>
            <table className="pdf-data-table">
              <thead>
                <tr>
                  <th>BOWLER</th>
                  <th>OVERS</th>
                  <th>RUNS</th>
                  <th>WICKETS</th>
                  <th>ECONOMY</th>
                </tr>
              </thead>
              <tbody>
                {firstBowlers.map((bw) => (
                  <tr key={bw.name} className={bw.name === topBowler?.name ? "top-row" : ""}>
                    <td><strong>{bw.name}</strong></td>
                    <td>{(bw.balls / 6).toFixed(1)}</td>
                    <td>{bw.runs}</td>
                    <td><strong>{bw.wickets}</strong></td>
                    <td>{bw.balls ? ((bw.runs / bw.balls) * 6).toFixed(2) : "0.00"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Current Innings Bowling Figures */}
        <div className="table-section">
          <h4>{firstInnings ? "Innings 2 Bowling Analysis" : "Bowling Analysis"} ({bowlingTeam.name})</h4>
          <table className="pdf-data-table">
            <thead>
              <tr>
                <th>BOWLER</th>
                <th>OVERS</th>
                <th>RUNS</th>
                <th>WICKETS</th>
                <th>ECONOMY</th>
              </tr>
            </thead>
            <tbody>
              {currentBowlers.map((bw) => (
                <tr key={bw.name} className={bw.name === topBowler?.name ? "top-row" : ""}>
                  <td><strong>{bw.name}</strong></td>
                  <td>{(bw.balls / 6).toFixed(1)}</td>
                  <td>{bw.runs}</td>
                  <td><strong>{bw.wickets}</strong></td>
                  <td>{bw.balls ? ((bw.runs / bw.balls) * 6).toFixed(2) : "0.00"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pdf-footer">
          <span><i></i> Verified Bowling Analysis</span>
          <span>PAGE 4 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 5: MATCH TIMELINE ---------------- */}
      <PDFPage pageClass="page-5" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>MATCH <span>TIMELINE</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 5</span>
            <small>BALL-BY-BALL REPORT</small>
          </div>
        </div>

        <div className="timeline-over-list">
          {Object.entries(overTimeline).length ? (
            Object.entries(overTimeline).map(([overNum, events]) => (
              <div key={overNum} className="timeline-over-row">
                <span>Over {overNum}</span>
                <div className="balls-flex">
                  {events.map((ev: BallEvent, i: number) => {
                    const isFour = ev.runs === 4
                    const isSix = ev.runs === 6
                    const isWicket = ev.mark === "W"
                    const isExtra = ev.mark.startsWith("WD") || ev.mark.startsWith("NB")
                    return (
                      <div
                        key={i}
                        className={`ball-chip ${
                          isWicket ? "wicket" : isFour ? "four" : isSix ? "six" : isExtra ? "extra" : ""
                        }`}
                      >
                        {ev.mark}
                      </div>
                    )
                  })}
                </div>
                <small>{events.reduce((sum: number, e: BallEvent) => sum + e.runs, 0)} runs</small>
              </div>
            ))
          ) : (
            <p style={{ textAlign: "center", color: "#8da0a7" }}>No ball events recorded yet.</p>
          )}
        </div>

        <div className="pdf-footer">
          <span><i></i> Ball-by-Ball Event Stream</span>
          <span>PAGE 5 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 6: ADVANCED ANALYTICS ---------------- */}
      <PDFPage pageClass="page-6" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>ADVANCED <span>ANALYTICS</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 6</span>
            <small>DPL 6 OFFICIAL</small>
          </div>
        </div>

        <div className="analytics-grid">
          <div className="analytics-card" style={{ gridColumn: "span 2" }}>
            <h4>Innings Run Rate Curve</h4>
            <div style={{ height: "140px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="320" height="130" viewBox="0 0 320 130">
                <line x1="10" y1="120" x2="310" y2="120" stroke="#24434e" strokeWidth="1" />
                <line x1="10" y1="10" x2="10" y2="120" stroke="#24434e" strokeWidth="1" />
                {polylinePoints && (
                  <polyline
                    fill="none"
                    stroke="#91e521"
                    strokeWidth="3"
                    points={polylinePoints}
                  />
                )}
              </svg>
            </div>
          </div>

          <div className="analytics-card">
            <h4>Partnership ({state.partnershipRuns} runs)</h4>
            <p style={{ fontSize: "11px", color: "#a8b7ba" }}>
              Active stand between <strong>{state.striker}</strong> & <strong>{state.nonStriker}</strong>: {state.partnershipRuns} runs off {state.partnershipBalls} balls.
            </p>
          </div>

          <div className="analytics-card">
            <h4>Boundary Breakdown</h4>
            <p style={{ fontSize: "11px", color: "#a8b7ba" }}>
              Total 4s: <strong>{allBattersCombined.reduce((a: number, b) => a + b.fours, 0)}</strong> · Total 6s: <strong>{allBattersCombined.reduce((a: number, b) => a + b.sixes, 0)}</strong>
            </p>
          </div>
        </div>

        <div className="pdf-footer">
          <span><i></i> Advanced Statistical Breakdown</span>
          <span>PAGE 6 OF 7</span>
        </div>
      </PDFPage>

      {/* ---------------- PAGE 7: PLAYER OF THE MATCH ---------------- */}
      <PDFPage pageClass="page-7" scale={scale}>
        <div className="pdf-header">
          <div className="pdf-brand">
            <div className="pdf-shield">CV</div>
            <strong>AWARD <span>CEREMONY</span></strong>
          </div>
          <div className="pdf-header-meta">
            <span>PAGE 7</span>
            <small>DPL 6 OFFICIAL</small>
          </div>
        </div>

        <div className="potm-hero-card">
          <div className="potm-trophy">🏆</div>
          <h2>PLAYER OF THE MATCH</h2>
          <h1>{potm ? potm.name : "Match Highlight"}</h1>
          <p>Outstanding match-winning performance in Diamond Premier League 6 tournament.</p>

          <div className="potm-stats-row">
            {potm && "runs" in potm && (
              <div className="potm-stat-pill">
                <small>RUNS</small>
                <strong>{potm.runs}</strong>
              </div>
            )}
            {potm && "balls" in potm && (
              <div className="potm-stat-pill">
                <small>BALLS</small>
                <strong>{potm.balls}</strong>
              </div>
            )}
            {potm && "wickets" in potm && (
              <div className="potm-stat-pill">
                <small>WICKETS</small>
                <strong>{potm.wickets}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="pdf-footer">
          <span><i></i> CricVault Official Tournament Document</span>
          <span>PAGE 7 OF 7</span>
        </div>
      </PDFPage>
    </div>
  )
}

export default MatchReportPDF
