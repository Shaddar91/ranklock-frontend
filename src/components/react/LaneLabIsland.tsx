//Lane Lab island — the roster comparison surface. One hydration root mounted on /lane-lab.
//The panels live in ./lanelab; this file is only the query provider boundary.
import QueryProvider from './QueryProvider';
import LaneLabPage from './lanelab/LaneLabPage';

export default function LaneLabIsland() {
  return (
    <QueryProvider>
      <LaneLabPage />
    </QueryProvider>
  );
}
