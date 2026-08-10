import type { LeagueMatch } from "../components/matches/MatchesScreen"

export type BattingLine = { name: string; runs: number; balls: number; fours: number; sixes: number; out: boolean; dismissal: string }
export type BowlingLine = { name: string; balls: number; runs: number; wickets: number; maidens: number }

export const deriveScorecards = (inningsNumber: number, events: NonNullable<LeagueMatch["record"]>["events"] = []) => {
  const batting = new Map<string, BattingLine>()
  const bowling = new Map<string, BowlingLine>()
  ;[...events].filter((event) => event.innings === inningsNumber).reverse().forEach((event) => {
    const delivery = event.text.match(/^(.+?) to (.+?),/)
    if (!delivery) return
    const [, bowlerName, batterName] = delivery
    const batter = batting.get(batterName) || { name: batterName, runs: 0, balls: 0, fours: 0, sixes: 0, out: false, dismissal: "not out" }
    const bowler = bowling.get(bowlerName) || { name: bowlerName, balls: 0, runs: 0, wickets: 0, maidens: 0 }
    const legal = event.legal ?? !/^(WD|NB)/.test(event.mark)
    const eventRuns = Number(event.runs ?? event.mark.match(/^\d+$/)?.[0] ?? 0)
    if (legal) { batter.balls += 1; bowler.balls += 1 }
    if (/^\d+$/.test(event.mark)) {
      batter.runs += eventRuns
      bowler.runs += eventRuns
      if (eventRuns === 4) batter.fours += 1
      if (eventRuns === 6) batter.sixes += 1
    } else if (/^NB/.test(event.mark)) {
      const batRuns = Math.max(0, eventRuns - 1)
      batter.runs += batRuns
      bowler.runs += eventRuns
      if (batRuns === 4) batter.fours += 1
      if (batRuns === 6) batter.sixes += 1
    } else if (/^WD/.test(event.mark)) bowler.runs += eventRuns
    if (event.mark === "W") {
      batter.out = true
      batter.dismissal = event.text.split(/OUT\s*[—-]\s*/)[1]?.replace(/\.$/, "") || "out"
      if (!/run out/i.test(event.text)) bowler.wickets += 1
    }
    batting.set(batterName, batter)
    bowling.set(bowlerName, bowler)
  })
  return { batting: [...batting.values()], bowling: [...bowling.values()] }
}
