'use client';

import { useState } from 'react';
import NavigationEditor from './NavigationEditor';
import FirstFloorReadOnly from './FirstFloorReadOnly';
import './admin-floor-view.css';

export default function AdminFloorView() {
  const [floor, setFloor] = useState<'GF' | '01'>('GF');

  return <>
    <div className="admin-floor-switch">
      <label htmlFor="admin-floor-select">Floor</label>
      <select
        id="admin-floor-select"
        aria-label="Floor"
        value={floor}
        onChange={event => setFloor(event.target.value as 'GF' | '01')}
      >
        <option value="GF">Ground Floor (GF)</option>
        <option value="01">First Floor (01)</option>
      </select>
    </div>
    {floor === 'GF' ? <NavigationEditor key="GF" /> : <FirstFloorReadOnly key="01" />}
  </>;
}
