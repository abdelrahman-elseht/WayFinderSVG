'use client';

import floorDataJson from '@data/buildings/B03/01.json';
import graphJson from '@data/buildings/B03/01.graph.json';
import type { FloorData, NavigationGraph, Point } from '@wayfinding/map-engine';
import './first-floor-read-only.css';

const floorData = floorDataJson as unknown as FloorData;
const graph = graphJson as unknown as NavigationGraph;
const pointList = (points: Point[]) => points.map(point => point.join(',')).join(' ');

export default function FirstFloorReadOnly() {
  const { floor, rooms } = floorData;
  const approachNodes = graph.nodes.filter(node => node.roomId);

  return <main className="first-floor-readonly">
    <header className="first-floor-header">
      <div>
        <span className="first-floor-kicker">B03 / 01</span>
        <h1>First Floor source map</h1>
        <p>Validated drawing and candidate navigation evidence. Read-only view.</p>
      </div>
      <dl aria-label="Floor evidence summary">
        <div><dt>Rooms</dt><dd>{rooms.length}</dd></div>
        <div><dt>Graph nodes</dt><dd>{graph.nodes.length}</dd></div>
        <div><dt>Edges</dt><dd>{graph.edges.length}</dd></div>
        <div><dt>Calibration</dt><dd>Unknown</dd></div>
      </dl>
    </header>
    <div className="first-floor-layout">
      <section className="first-floor-map-panel" aria-label="First Floor source map and graph">
        <svg className="first-floor-map" role="img" aria-label="Source drawing overlaid with candidate navigation graph" viewBox={floor.viewBox.join(' ')}>
          <image href={floor.mapAsset} x={floor.viewBox[0]} y={floor.viewBox[1]} width={floor.viewBox[2]} height={floor.viewBox[3]} preserveAspectRatio="none" />
          {graph.edges.map(edge => <polyline key={edge.id} data-edge={edge.id} points={pointList(edge.geometry)} fill="none" stroke="#167d81" strokeWidth="5" vectorEffect="non-scaling-stroke" opacity=".72" />)}
          {graph.nodes.map(node => <circle key={node.id} data-node={node.id} cx={node.point[0]} cy={node.point[1]} r={node.roomId ? 10 : 6} fill={node.roomId ? '#e58a35' : '#315b70'} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke"><title>{node.id} · {node.type} · {node.status}</title></circle>)}
        </svg>
        <p className="first-floor-map-note">Drawing units, not metres. Candidate graph evidence; no kiosk origin or accessibility claim is supplied.</p>
      </section>
      <section className="first-floor-inventory" aria-labelledby="first-floor-inventory-title">
        <h2 id="first-floor-inventory-title">Room and approach inventory</h2>
        <p>{approachNodes.length} room-linked graph nodes · {graph.navigableAreas.length} navigable-area polygons · {graph.walls.length} source wall segments</p>
        <div className="first-floor-table-wrap">
          <table>
            <thead><tr><th>Code</th><th>Source name</th><th>Geometry</th><th>Approach</th></tr></thead>
            <tbody>{rooms.map(room => {
              const node = approachNodes.find(item => item.roomId === room.id);
              return <tr key={room.id}>
                <th scope="row">{room.code}</th>
                <td>{room.name.en}</td>
                <td>{room.geometryStatus}</td>
                <td>{node ? `${node.type} · ${node.status}` : 'Not mapped'}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}
