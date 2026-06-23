import { Match, Player } from "@/lib/types";

type Props = {
  match: Match;
  players: Player[];
};

export function MatchDisplay({ match, players }: Props) {
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "—";

  return (
    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 text-center">
      <div className="flex-1 w-full">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Team A</p>
        <p className="text-lg font-bold text-foreground leading-tight wrap-break-word">{nameOf(match.teamA[0])}</p>
        <p className="text-lg font-bold text-foreground leading-tight wrap-break-word">{nameOf(match.teamA[1])}</p>
      </div>
      <span className="text-muted font-semibold shrink-0">vs</span>
      <div className="flex-1 w-full">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Team B</p>
        <p className="text-lg font-bold text-foreground leading-tight wrap-break-word">{nameOf(match.teamB[0])}</p>
        <p className="text-lg font-bold text-foreground leading-tight wrap-break-word">{nameOf(match.teamB[1])}</p>
      </div>
    </div>
  );
}
