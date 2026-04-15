"use client";

import { useState } from "react";
import { CompletedMatch, Player } from "@/lib/types";
import { computePlayerStats } from "@/lib/rotation";

const PAGE_SIZE = 10;

type Props = {
  players: Player[];
  history: CompletedMatch[];
};

function nameOf(players: Player[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "?";
}

export function Scoreboard({ players, history }: Props) {
  const [page, setPage] = useState(0);
  const stats = computePlayerStats(players, history);
  const rows = players
    .map((p) => ({
      player: p,
      ...(stats.get(p.id) ?? {
        games: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      }),
    }))
    .sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor);

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const reversed = [...history].reverse();
  const pageStart = currentPage * PAGE_SIZE;
  const pageItems = reversed.slice(pageStart, pageStart + PAGE_SIZE);

  return (
    <section className="rounded-lg border border-border bg-background/60 p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground mb-3">Scoreboard</h2>

      {players.length === 0 ? (
        <p className="text-sm text-muted">No players yet.</p>
      ) : (
        <div className="overflow-auto max-h-80">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted uppercase text-[10px] tracking-wider">
                <th className="py-2 pr-2 font-semibold">Player</th>
                <th className="py-2 px-2 text-right font-semibold">GP</th>
                <th className="py-2 px-2 text-right font-semibold">W</th>
                <th className="py-2 px-2 text-right font-semibold">L</th>
                <th className="py-2 pl-2 text-right font-semibold">PF/PA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.player.id}
                  className="border-t border-border text-foreground"
                >
                  <td className="py-1.5 pr-2">
                    <span className="font-medium">{r.player.name}</span>{" "}
                    <span className="text-muted text-xs">{r.player.skill}</span>
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums">
                    {r.games}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-accent">
                    {r.wins}
                  </td>
                  <td className="py-1.5 px-2 text-right tabular-nums text-muted">
                    {r.losses}
                  </td>
                  <td className="py-1.5 pl-2 text-right tabular-nums text-muted">
                    {r.pointsFor}/{r.pointsAgainst}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-muted uppercase tracking-wider mt-5 mb-2">
            Match History
          </h3>
          <ul className="space-y-1.5 text-sm max-h-80 overflow-y-auto">
            {pageItems.map((m, idx) => {
              const aWon = m.scoreA > m.scoreB;
              const matchNumber = history.length - pageStart - idx;
              return (
                <li
                  key={m.id}
                  className="rounded border border-border bg-background px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-muted text-xs tabular-nums">
                      #{matchNumber}
                    </span>
                    <span className="tabular-nums font-semibold text-foreground text-base">
                      {m.scoreA} – {m.scoreB}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-xs">
                    <span
                      className={`truncate ${
                        aWon ? "font-semibold text-foreground" : "text-muted"
                      }`}
                    >
                      {nameOf(players, m.teamA[0])} &{" "}
                      {nameOf(players, m.teamA[1])}
                    </span>
                    <span className="text-muted">vs</span>
                    <span
                      className={`truncate text-right ${
                        !aWon ? "font-semibold text-foreground" : "text-muted"
                      }`}
                    >
                      {nameOf(players, m.teamB[0])} &{" "}
                      {nameOf(players, m.teamB[1])}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 text-xs">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="rounded px-3 py-1.5 border border-border text-foreground hover:bg-accent/10 hover:border-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-border transition-colors"
              >
                Prev
              </button>
              <span className="text-muted">
                Page {currentPage + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={currentPage >= totalPages - 1}
                className="rounded px-3 py-1.5 border border-border text-foreground hover:bg-accent/10 hover:border-accent disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-border transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
