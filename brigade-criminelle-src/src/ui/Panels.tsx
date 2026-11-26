import { CaseView, CasesList } from './Cases';
import { useGame } from './common';
import { Archives, BoardIndex, Budget, Build, Equipment, Justice, Lab, Media, PlaceInfo, RoomInfo, Search, Settings, Stats } from './Management';
import { Career } from './Career';
import { Planning, Recruit, StaffList, StaffProfile, Training, Units } from './Staff';

export function Panels({ onQuit }: { onQuit: () => void }) {
  const [g] = useGame();
  const p = g.panel;
  if (!p) return null;
  switch (p.id) {
    case 'cases': return <CasesList />;
    case 'case': return <CaseView key={p.arg} id={p.arg!} tab={p.tab} />;
    case 'board': return <BoardIndex />;
    case 'staffList': return <StaffList />;
    case 'staff': return <StaffProfile key={p.arg} id={p.arg!} />;
    case 'units': return <Units />;
    case 'planning': return <Planning />;
    case 'lab': return <Lab />;
    case 'justice': return <Justice />;
    case 'recruit': return <Recruit />;
    case 'training': return <Training key={p.arg} id={p.arg} />;
    case 'equipment': return <Equipment />;
    case 'build': return <Build />;
    case 'budget': return <Budget />;
    case 'stats': return <Stats />;
    case 'career': return <Career />;
    case 'archives': return <Archives />;
    case 'media': return <Media />;
    case 'settings': return <Settings onQuit={onQuit} />;
    case 'search': return <Search />;
    case 'room': return <RoomInfo key={p.arg} id={p.arg!} />;
    case 'place': return <PlaceInfo key={p.arg} id={p.arg!} />;
    default: return null;
  }
}
