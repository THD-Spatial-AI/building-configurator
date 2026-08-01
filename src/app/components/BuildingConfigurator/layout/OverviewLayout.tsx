// Overview workspace: snapshot sidebar (left) + energy/envelope column (right).

import React from 'react';
import { BuildingSnapshotAside, type BuildingSnapshotAsideProps } from '../overview/BuildingSnapshotAside';
import { EnergyEnvelopeColumn, type EnergyEnvelopeColumnProps } from '../overview/EnergyEnvelopeColumn';

export interface OverviewLayoutProps {
  snapshot: BuildingSnapshotAsideProps;
  envelope: EnergyEnvelopeColumnProps;
}

export function OverviewLayout({ snapshot, envelope }: OverviewLayoutProps) {
  return (
    <div className="grid h-full min-h-0 grid-cols-[430px_minmax(0,1fr)] overflow-hidden">
      <BuildingSnapshotAside {...snapshot} />
      <EnergyEnvelopeColumn {...envelope} />
    </div>
  );
}
