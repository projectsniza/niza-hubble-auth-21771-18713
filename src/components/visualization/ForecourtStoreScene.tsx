import React from 'react';
import { Billboard, Text, Float } from '@react-three/drei';
import * as THREE from 'three';
import { ZoneDataMap } from './useDigitalTwinData';
import { AdvancedVehicles } from './AdvancedVehicles';
import { ForecourtTotem } from './ForecourtTotem';
import {
  OfficeManagerCharacter,
  RetailCashierCharacter,
  StoreCustomerCharacter,
  BreakRoomStaffCharacter,
  ShoppingTrolley,
  ShopperPushingTrolley,
  ShopperBrowsingAisle,
  SupermarketTrolleyBay,
  ForecourtPedestrian,
} from './StoreCharacters';
import { RealisticGondolaShelvingUnit } from './RealisticStoreProducts';

interface ForecourtStoreSceneProps {
  focusedZone: string | null;
  onSelectZone: (zoneId: string) => void;
  metrics: ZoneDataMap;
  pulseTriggeredZones: Record<string, boolean>;
}

// Camera Target & Position mapping for each module zone in the grand 3D diorama
export const ZONE_CAMERA_TARGETS: Record<
  string,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  overview: { position: [42, 34, 42], target: [0, 2, 4] },
  employees: { position: [26, 11, 8], target: [18, 2, 2] },      // Dedicated HR & People Hub Room
  documents: { position: [-26, 11, 8], target: [-18, 2, 2] },     // Dedicated Documents Archive Room
  daily_reports: { position: [-26, 11, -3], target: [-18, 2, -8] }, // Back Office & Daily Reports
  sales_analysis: { position: [8, 9, 13], target: [3.5, 2, 5.5] }, // Checkout Tills & Sales Analysis
  scheduling: { position: [26, 11, -3], target: [18, 2, -8] },    // Scheduling Roster Board
  attendance: { position: [26, 11, -3], target: [18, 2, -8] },    // Holiday Diary Wall
  lottery: { position: [-6, 8, 13], target: [-2.5, 2, 5.5] },     // Lottery Counter
  customer_accounts: { position: [-13, 8, 12], target: [-7.5, 2, 5.5] }, // Customer Accounts Counter
  drive_offs: { position: [0, 16, 34], target: [0, 2, 16] },      // Forecourt & Fuel Pumps
  maintenance: { position: [-16, 12, 24], target: [-14, 2, 16] }, // Forecourt Service Bay
  niza_safe: { position: [0, 11, 0], target: [0, 2.5, -6.5] },     // NIZA Safe Hub
  messages: { position: [-26, 10, -5], target: [-18, 2, -7] },
  reminders: { position: [-18, 8, -4], target: [-14, 2, -7] },    // Back Office Reminders Notice Board
  elearning: { position: [24, 10, 6], target: [18, 2, 2] },
};

// Sleek Elevated Holographic Architectural Pin Component
interface ArchitecturalHudPinProps {
  title: string;
  lines: Array<{ text: string; color?: string }>;
  position: [number, number, number];
  color?: string;
  icon?: string;
  onClick: () => void;
  isActive?: boolean;
}

function ArchitecturalHudPin({
  title,
  lines,
  position,
  color = '#2fad87',
  icon = '📍',
  onClick,
  isActive = false,
}: ArchitecturalHudPinProps) {
  return (
    <group position={position}>
      {/* Anchor Ground Glow Circle */}
      <mesh position={[0, -position[1] + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.48, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isActive ? 0.95 : 0.4} />
      </mesh>
      {/* Slender Holographic Light Beam from ground to floating card */}
      <mesh position={[0, -position[1] / 2 + 0.04, 0]}>
        <cylinderGeometry args={[0.012, 0.012, position[1], 8]} />
        <meshBasicMaterial color={color} transparent opacity={isActive ? 0.75 : 0.25} />
      </mesh>

      {/* Floating Holographic Frosted Glass HUD Card */}
      <Float speed={1.2} rotationIntensity={0} floatIntensity={0.12}>
        <Billboard
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          {/* Frosted Dark Glass Backing */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[4.4, 1.35]} />
            <meshBasicMaterial color="#020617" transparent opacity={0.88} />
          </mesh>
          {/* Glowing Top Color Accent Ribbon */}
          <mesh position={[0, 0.63, 0]}>
            <planeGeometry args={[4.4, 0.08]} />
            <meshBasicMaterial color={color} />
          </mesh>
          {/* Subtle Outer Neon Rim */}
          <lineSegments>
            <edgesGeometry args={[new THREE.PlaneGeometry(4.4, 1.35)]} />
            <lineBasicMaterial color={color} transparent opacity={isActive ? 0.95 : 0.45} />
          </lineSegments>

          {/* Header Title with Icon */}
          <Text
            fontSize={0.24}
            color={color}
            position={[0, 0.36, 0]}
            font={undefined}
            anchorX="center"
            anchorY="middle"
          >
            {`${icon} ${title}`}
          </Text>

          {/* Metric Lines */}
          {lines.map((l, idx) => (
            <Text
              key={`hud-line-${idx}`}
              fontSize={idx === 0 ? 0.19 : 0.15}
              color={l.color || '#f8fafc'}
              position={[0, 0.06 - idx * 0.23, 0]}
              font={undefined}
              anchorX="center"
              anchorY="middle"
            >
              {l.text}
            </Text>
          ))}
        </Billboard>
      </Float>
    </group>
  );
}

// Detailed Supermarket Gondola Shelving Unit Packed with Products
// Supermarket Gondola Shelving Unit Packed with Realistic Merchandised Products
function GondolaShelvingUnit({
  position,
  category = 'GROCERY',
  theme = 'pantry',
}: {
  position: [number, number, number];
  category?: string;
  theme?: 'snacks' | 'pantry' | 'drinks' | 'fresh';
}) {
  return <RealisticGondolaShelvingUnit position={position} category={category} theme={theme} />;
}

export function ForecourtStoreScene({
  focusedZone,
  onSelectZone,
  metrics,
  pulseTriggeredZones,
}: ForecourtStoreSceneProps) {
  const isZoneActive = (zoneId: string) => focusedZone === zoneId;

  const getZoneColor = (zoneId: string, normalColor: string, highlightColor = '#2fad87') => {
    if (!focusedZone) return normalColor;
    if (focusedZone === zoneId) return highlightColor;
    return '#64748b';
  };

  return (
    <group>
      {/* ============================================================== */}
      {/* 1. EXPANDED GRAND DIORAMA PEDESTAL & GROUND FOUNDATION         */}
      {/* ============================================================== */}
      {/* Heavy Diorama Foundation Pedestal (Footprint: 66 x 50) */}
      <mesh position={[0, -0.8, 4]} receiveShadow>
        <boxGeometry args={[66, 1.6, 50]} />
        <meshStandardMaterial color="#0b1120" roughness={0.8} metalness={0.2} />
      </mesh>
      {/* Glowing Emerald Perimeter Bevel Accent Line */}
      <mesh position={[0, 0.01, 4]}>
        <boxGeometry args={[66.2, 0.04, 50.2]} />
        <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.65} />
      </mesh>

      {/* Forecourt Asphalt Pavement (Front: 62 x 22) */}
      <mesh position={[0, 0.03, 17]} receiveShadow>
        <boxGeometry args={[62, 0.06, 22]} />
        <meshStandardMaterial color="#1a202c" roughness={0.92} />
      </mesh>

      {/* Store Polished Porcelain Foundation Slab (Back: 62 x 24) */}
      <mesh position={[0, 0.03, -6.5]} receiveShadow>
        <boxGeometry args={[62, 0.06, 24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.35} metalness={0.1} />
      </mesh>

      {/* Concrete Sidewalk Curbs Surrounding Store Front */}
      <mesh position={[0, 0.1, 4.8]} receiveShadow castShadow>
        <boxGeometry args={[56, 0.14, 1.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
      </mesh>

      {/* Road Markings: Fuel Lane Driving Separators */}
      {[-8, 0, 8].map((laneX) => (
        <mesh key={`lane-${laneX}`} position={[laneX, 0.07, 17]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.22, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
      {/* Yellow Forecourt Entrance Stop Line */}
      <mesh position={[0, 0.07, 24.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[36, 0.28]} />
        <meshBasicMaterial color="#eab308" />
      </mesh>

      {/* Pedestrian Zebra Crossing into Store Entrance */}
      {[-3, -2, -1, 0, 1, 2, 3].map((zx) => (
        <mesh key={`zebra-${zx}`} position={[zx * 0.9, 0.07, 4.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.5, 1.8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Living Forecourt Pedestrian walking across zebra crossing in continuous loop */}
      <ForecourtPedestrian speed={0.65} clothesColor="#0284c7" skinTone="#fed7aa" />

      {/* Yellow Diagonal Crosshatch Tanker Delivery Safety Zone */}
      <group position={[14, 0.06, 10]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[6, 4]} />
          <meshBasicMaterial color="#ca8a04" transparent opacity={0.25} />
        </mesh>
        {[-2.2, -1.1, 0, 1.1, 2.2].map((cx) => (
          <mesh
            key={`hatch-${cx}`}
            position={[cx, 0.01, 0]}
            rotation={[-Math.PI / 2, 0, Math.PI / 4]}
          >
            <planeGeometry args={[0.16, 4.8]} />
            <meshBasicMaterial color="#eab308" />
          </mesh>
        ))}
      </group>

      {/* Underground Fuel Storage Tank Inspection Manhole Covers */}
      {[
        { x: -14, z: 10, color: '#22c55e', grade: 'E10' },   // Unleaded 95
        { x: -10, z: 10, color: '#38bdf8', grade: 'B7' },    // Diesel B7
        { x: -6, z: 10, color: '#ef4444', grade: 'SUPER' }, // V-Power Super
        { x: -2, z: 10, color: '#a855f7', grade: 'ADBLUE' },
      ].map((plate, pidx) => (
        <group key={`manhole-${pidx}`} position={[plate.x, 0.08, plate.z]}>
          {/* Cast Iron Octagonal Cover */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.42, 8]} />
            <meshStandardMaterial color="#334155" roughness={0.8} metalness={0.7} />
          </mesh>
          {/* Color-Coded Fuel Grade Ring Collar */}
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.34, 0.42, 16]} />
            <meshBasicMaterial color={plate.color} />
          </mesh>
        </group>
      ))}

      {/* Perimeter Green Landscape Verge with Low-Poly Hedges */}
      {[-30, 30].map((vx) => (
        <group key={`verge-${vx}`} position={[vx, 0.08, 17]}>
          <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
            <boxGeometry args={[1.6, 0.22, 22]} />
            <meshStandardMaterial color="#166534" roughness={0.9} />
          </mesh>
          {/* Decorative Cypress Hedges */}
          {[-8, -4, 0, 4, 8].map((hz) => (
            <mesh key={`hedge-${vx}-${hz}`} position={[0, 0.65, hz]} castShadow>
              <coneGeometry args={[0.45, 1.1, 8]} />
              <meshStandardMaterial color="#15803d" roughness={0.8} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Fuel Price Totem Pylon Sign at Forecourt Entrance */}
      <ForecourtTotem position={[24, 0, 16]} rotation={[0, Math.PI / 4.2, 0]} />

      {/* ============================================================== */}
      {/* 2. FORECOURT CANOPY & FUEL DISPENSING ISLANDS                  */}
      {/* ============================================================== */}
      <group>
        {/* Canopy Steel Support Pylons with Heavy Concrete Crash Plinths */}
        {[-9, 9].map((colX) =>
          [11, 20].map((colZ, idx) => (
            <group key={`pylon-${colX}-${idx}`} position={[colX, 0, colZ]}>
              <mesh position={[0, 0.5, 0]} castShadow>
                <cylinderGeometry args={[0.52, 0.58, 1.0, 16]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
              </mesh>
              {/* High-Grade Brushed Steel Column */}
              <mesh position={[0, 3.4, 0]} castShadow>
                <cylinderGeometry args={[0.26, 0.26, 5.8, 16]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.15} />
              </mesh>
              {/* Emergency Fire Extinguisher Mounted on Column */}
              <group position={[0, 1.6, colZ === 11 ? 0.35 : -0.35]}>
                <mesh castShadow>
                  <cylinderGeometry args={[0.08, 0.08, 0.45, 12]} />
                  <meshStandardMaterial color="#dc2626" />
                </mesh>
              </group>
            </group>
          ))
        )}

        {/* Modern Flat Steel Canopy Roof with Under-Decking Ceiling Panels */}
        <mesh position={[0, 6.4, 15.5]} castShadow>
          <boxGeometry args={[28, 0.6, 16]} />
          <meshStandardMaterial
            color={getZoneColor('drive_offs', '#1e293b', '#2fad87')}
            roughness={0.25}
            metalness={0.5}
          />
        </mesh>
        {/* Illuminated NIZA Green Brand Fascia Ribbon */}
        <mesh position={[0, 6.75, 15.5]}>
          <boxGeometry args={[28.2, 0.4, 16.2]} />
          <meshStandardMaterial
            color="#2fad87"
            emissive="#10b981"
            emissiveIntensity={isZoneActive('drive_offs') ? 1.0 : 0.5}
          />
        </mesh>

        {/* Recessed Canopy Downlight Fixtures with Consolidated Warm Lighting (High Efficiency) */}
        {[-7, 0, 7].map((lx) =>
          [12.5, 18.5].map((lz, idx) => (
            <mesh
              key={`canopy-light-${lx}-${idx}`}
              position={[lx, 6.08, lz]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.5, 12]} />
              <meshBasicMaterial color="#fffbeb" />
            </mesh>
          ))
        )}
        <pointLight position={[0, 5.8, 15.5]} intensity={2.2} distance={22} color="#fef9c3" />

        {/* 2 MAIN FUEL PUMP ISLANDS (Pumps 1-4 and 5-8) */}
        {[-5, 5].map((ix) => (
          <group key={`island-group-${ix}`}>
            {/* Concrete Island Curb with Yellow/Black Safety Edges */}
            <mesh position={[ix, 0.2, 15]} receiveShadow castShadow>
              <boxGeometry args={[2.5, 0.36, 9.2]} />
              <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
            </mesh>
            {/* Windshield Squeegee Bucket on Island End */}
            <mesh position={[ix, 0.55, 19]} castShadow>
              <cylinderGeometry args={[0.2, 0.16, 0.35, 12]} />
              <meshStandardMaterial color="#0284c7" />
            </mesh>

            {/* 2 Multi-Grade Dispensers Per Island */}
            {[13, 17].map((iz, pidx) => (
              <group key={`dispenser-${ix}-${pidx}`} position={[ix, 1.4, iz]}>
                {/* Main Dispenser Housing */}
                <mesh castShadow>
                  <boxGeometry args={[1.15, 2.1, 1.15]} />
                  <meshStandardMaterial
                    color={pulseTriggeredZones.drive_offs ? '#ef4444' : '#0f172a'}
                    metalness={0.7}
                    roughness={0.2}
                  />
                </mesh>
                {/* Green Brand Crown */}
                <mesh position={[0, 1.15, 0]}>
                  <boxGeometry args={[1.16, 0.26, 1.16]} />
                  <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.6} />
                </mesh>
                {/* Digital Lit Price & Volume Screens */}
                {[-0.59, 0.59].map((sx) => (
                  <mesh key={`screen-${sx}`} position={[sx, 0.42, 0]}>
                    <planeGeometry args={[0.7, 0.45]} />
                    <meshBasicMaterial color="#38bdf8" />
                  </mesh>
                ))}
                {/* Flexible Black Rubber Delivery Hoses on Sides */}
                {[-0.6, 0.6].map((hx) => (
                  <group key={`hose-${hx}`} position={[hx, 0.2, 0]}>
                    {/* Hanging Hose Loop */}
                    <mesh position={[0, -0.4, 0]} rotation={[0, 0, hx > 0 ? -0.2 : 0.2]}>
                      <cylinderGeometry args={[0.02, 0.02, 0.9, 8]} />
                      <meshStandardMaterial color="#090d16" roughness={0.9} />
                    </mesh>
                    {/* Chrome Dispenser Nozzle in Holster */}
                    <mesh position={[0, 0.2, 0.25]}>
                      <boxGeometry args={[0.06, 0.18, 0.14]} />
                      <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
                    </mesh>
                  </group>
                ))}
                {/* Stainless Steel U-Shaped Collision Bollards */}
                {[-1.3, 1.3].map((by) => (
                  <mesh key={`disp-bollard-${by}`} position={[0, -0.65, by]} castShadow>
                    <cylinderGeometry args={[0.14, 0.14, 0.95, 12]} />
                    <meshStandardMaterial color="#eab308" metalness={0.7} roughness={0.2} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        ))}

        {/* EV Ultra-Fast Rapid Charging Hub on Far Right Forecourt */}
        <group position={[18, 0, 16]}>
          <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
            <boxGeometry args={[3.8, 0.35, 7.5]} />
            <meshStandardMaterial color="#064e3b" />
          </mesh>
          <mesh position={[0, 1.4, 0]} castShadow>
            <boxGeometry args={[1.2, 2.4, 1]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} />
          </mesh>
          <mesh position={[0, 1.4, 0.52]}>
            <planeGeometry args={[0.8, 1.6]} />
            <meshStandardMaterial color="#22c55e" emissive="#15803d" emissiveIntensity={0.8} />
          </mesh>
        </group>

        {/* Air & Jet Wash Service Bay on Far Left Forecourt */}
        <group position={[-18, 0, 16]}>
          <mesh position={[0, 2.8, 0]} castShadow>
            <boxGeometry args={[5.2, 5.6, 6.2]} />
            <meshStandardMaterial color="#0284c7" transparent opacity={0.35} roughness={0.1} />
          </mesh>
          <mesh position={[0, 5.7, 0]}>
            <boxGeometry args={[5.4, 0.6, 6.4]} />
            <meshStandardMaterial color="#0284c7" />
          </mesh>
        </group>

        {/* DYNAMIC VEHICLE TRAFFIC WITH FUELING ATTENDANTS */}
        <AdvancedVehicles />

        {/* Sleek Elevated Forecourt Holographic HUD Pin */}
        <ArchitecturalHudPin
          title="FORECOURT & FUEL PUMPS"
          icon="⛽"
          color="#38bdf8"
          position={[0, 8.5, 15.5]}
          onClick={() => onSelectZone('drive_offs')}
          isActive={isZoneActive('drive_offs')}
          lines={[
            { text: `${metrics.drive_offs.badgeLabel} • Fuel Dispensing Active`, color: '#ffffff' },
            { text: 'Pumps 1-8 Online • Zero Variance Reported', color: '#4ade80' },
          ]}
        />
      </group>

      {/* ============================================================== */}
      {/* 3. STORE BUILDING ARCHITECTURE (OPEN ARCHITECTURAL CUTAWAY)    */}
      {/* ============================================================== */}
      <group position={[0, 0, -6]}>
        {/* Low-Cut Feature Back Wall with Retail Timber Cladding & Graphics */}
        <mesh position={[0, 1.4, -8.5]} castShadow receiveShadow>
          <boxGeometry args={[56, 2.8, 0.3]} />
          <meshStandardMaterial color="#1e293b" roughness={0.7} />
        </mesh>
        {/* Warm Wood Slat Acoustic Panel Cladding on Back Wall */}
        <mesh position={[0, 0.7, -8.34]}>
          <boxGeometry args={[55.8, 1.4, 0.04]} />
          <meshStandardMaterial color="#78350f" roughness={0.6} />
        </mesh>
        {/* Department Header Graphics along Back Wall */}
        <Billboard position={[-16, 2.2, -8.3]}>
          <Text fontSize={0.28} color="#facc15" font={undefined}>
            🥖 FRESH BAKERY & DELI
          </Text>
        </Billboard>
        <Billboard position={[0, 2.2, -8.3]}>
          <Text fontSize={0.28} color="#38bdf8" font={undefined}>
            ❄️ CHILLED BEVERAGES & BEER CAVE
          </Text>
        </Billboard>
        <Billboard position={[16, 2.2, -8.3]}>
          <Text fontSize={0.28} color="#4ade80" font={undefined}>
            🛒 GROCERY ESSENTIALS & SNACKS
          </Text>
        </Billboard>

        {/* Stepped Cutaway Wing Walls (Open so interior is 100% visible) */}
        <mesh position={[-28, 1.2, -4]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 2.4, 9]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>
        <mesh position={[28, 1.2, -4]} castShadow receiveShadow>
          <boxGeometry args={[0.3, 2.4, 9]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.6} />
        </mesh>

        {/* Supermarket Entrance: Open Cutaway with Sliding Glass Door Frames on Sides */}
        <group position={[0, 0, 4.8]}>
          {/* Low Entrance Foundation Step */}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[20, 0.1, 0.8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Entrance Welcome Floor Mat */}
          <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[4.5, 1.6]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          {/* Glass Door Portals on Far Left and Right */}
          {[-8, 8].map((dx) => (
            <mesh key={`portal-${dx}`} position={[dx, 1.5, 0]}>
              <boxGeometry args={[0.16, 3, 0.16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} />
            </mesh>
          ))}
          {/* Glowing Supermarket Header Band */}
          <group position={[0, 3.4, 0]}>
            <mesh>
              <boxGeometry args={[16, 0.6, 0.2]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh position={[0, 0, 0.11]}>
              <planeGeometry args={[15.6, 0.45]} />
              <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.8} />
            </mesh>
            <Billboard position={[0, 0, 0.15]}>
              <Text fontSize={0.28} color="#ffffff" font={undefined}>
                NIZA EXPRESS SUPERSTORE • 24/7
              </Text>
            </Billboard>
          </group>

          {/* SUPERMARKET TROLLEY PARK AT ENTRANCE (NESTED WIRE SHOPPING CARTS) */}
          <SupermarketTrolleyBay position={[-7, 0.1, -1]} />
        </group>

        {/* ============================================================== */}
        {/* 4. DEDICATED HR & EMPLOYEE HUB ROOM (RIGHT WING: x: 18, z: 2)  */}
        {/* Visualizes ONLY: All Employees, Pending Onboardings, Contract Approvals */}
        {/* ============================================================== */}
        <group position={[18, 0, 2]}>
          {/* Low Glass Partition Wall */}
          <mesh position={[-8.5, 1.2, 0]} castShadow>
            <boxGeometry args={[0.18, 2.4, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} transparent opacity={0.4} />
          </mesh>

          {/* Warm Oak Parquet Flooring */}
          <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[16, 11]} />
            <meshStandardMaterial
              color={getZoneColor('employees', '#b45309', '#2fad87')}
              roughness={0.5}
            />
          </mesh>

          {/* Warm Recessed Ceiling Light */}
          <pointLight position={[0, 3.8, 0]} intensity={1.2} distance={12} color="#fef9c3" />

          {/* HR Executive Management L-Shaped Desk */}
          <mesh position={[0, 0.8, -2.5]} castShadow>
            <boxGeometry args={[4.2, 0.12, 2.2]} />
            <meshStandardMaterial color="#1e293b" roughness={0.4} />
          </mesh>
          {/* Executive Swivel Office Chair */}
          <mesh position={[0, 0.85, -1.2]} castShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.2, 16]} />
            <meshStandardMaterial color="#0284c7" />
          </mesh>
          {/* Laptop with Illuminated Keyboard & Screen on Desk */}
          <group position={[0, 0.9, -2.3]}>
            <mesh castShadow>
              <boxGeometry args={[0.55, 0.03, 0.38]} />
              <meshStandardMaterial color="#334155" metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.18, -0.18]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.55, 0.36, 0.03]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh position={[0, 0.18, -0.16]} rotation={[-0.2, 0, 0]}>
              <planeGeometry args={[0.5, 0.3]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>

          {/* Contract Signing Table with Blue Wax Seal Documents & Pens */}
          <mesh position={[-4.5, 0.8, 1]} castShadow>
            <boxGeometry args={[2.8, 0.1, 1.8]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* Official Contract Documents on Table */}
          <mesh position={[-4.5, 0.88, 1]}>
            <boxGeometry args={[1.2, 0.04, 0.9]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh position={[-4.2, 0.91, 1]}>
            <boxGeometry args={[0.2, 0.02, 0.2]} />
            <meshBasicMaterial color="#0284c7" />
          </mesh>
          {/* Visitor Leather Armchairs */}
          {[-5.4, -3.6].map((cx) => (
            <mesh key={`chair-${cx}`} position={[cx, 0.75, 1]} castShadow>
              <boxGeometry args={[0.55, 0.6, 0.55]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
          ))}

          {/* Employee Digital ID Badge Printing Station */}
          <mesh position={[4.5, 0.8, 1]} castShadow>
            <boxGeometry args={[2.4, 1.4, 1.4]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Potted Indoor Ficus Office Plant */}
          <group position={[6.5, 0.5, -3]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.35, 0.25, 0.7, 16]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0, 0.7, 0]} castShadow>
              <sphereGeometry args={[0.55, 12, 12]} />
              <meshStandardMaterial color="#15803d" roughness={0.8} />
            </mesh>
          </group>

          {/* Sleek Elevated Architectural HUD Pin (ONLY 3 REQUESTED METRICS) */}
          <ArchitecturalHudPin
            title="HR & EMPLOYEE HUB"
            icon="👥"
            color="#34d399"
            position={[0, 4.8, -1]}
            onClick={() => onSelectZone('employees')}
            isActive={isZoneActive('employees')}
            lines={[
              {
                text: `ALL EMPLOYEES: ${metrics.employees.details.activeCount || 24}`,
                color: '#ffffff',
              },
              { text: 'PENDING ONBOARDINGS: 1', color: '#facc15' },
              { text: 'CONTRACT APPROVALS: 2', color: '#38bdf8' },
            ]}
          />
        </group>

        {/* ============================================================== */}
        {/* 5. DEDICATED DOCUMENTS & COMPLIANCE ARCHIVE ROOM (LEFT: x: -18, z: 2) */}
        {/* Visualizes overdue documents beautifully without visual obstruction */}
        {/* ============================================================== */}
        <group position={[-18, 0, 2]}>
          {/* Low Glass Partition Wall */}
          <mesh position={[8.5, 1.2, 0]} castShadow>
            <boxGeometry args={[0.18, 2.4, 12]} />
            <meshStandardMaterial color="#cbd5e1" roughness={0.2} transparent opacity={0.4} />
          </mesh>

          {/* Archive Room Tile Floor */}
          <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[16, 11]} />
            <meshStandardMaterial
              color={getZoneColor('documents', '#1e293b', '#2fad87')}
              roughness={0.4}
            />
          </mesh>
          {/* Warm Recessed Ceiling Light */}
          <pointLight position={[0, 3.8, 0]} intensity={1.2} distance={12} color="#fef9c3" />

          {/* High-Density Steel Document Archive Shelves */}
          {[-4, 4].map((rx) => (
            <group key={`doc-rack-${rx}`} position={[rx, 1.5, -1.5]}>
              <mesh castShadow>
                <boxGeometry args={[1.4, 3.0, 4.8]} />
                <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.2} />
              </mesh>
              {/* Categorized Archive File Storage Boxes */}
              {[-1.4, 0, 1.4].map((fz, fidx) => (
                <mesh key={`archive-box-${rx}-${fidx}`} position={[0, 0.6, fz]}>
                  <boxGeometry args={[1.2, 0.45, 0.8]} />
                  <meshStandardMaterial color={['#f8fafc', '#38bdf8', '#fbbf24'][fidx]} />
                </mesh>
              ))}
            </group>
          ))}

          {/* Document Verification Table & High-Res Scanner */}
          <mesh position={[0, 0.8, 2.5]} castShadow>
            <boxGeometry args={[4.2, 0.12, 1.8]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Red Overdue Audit Folder on Table */}
          <mesh position={[0, 0.88, 2.5]}>
            <boxGeometry args={[0.8, 0.05, 0.6]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>

          {/* Sleek Elevated Compliance Alert HUD Pin */}
          <ArchitecturalHudPin
            title="COMPLIANCE ARCHIVE"
            icon="📁"
            color="#ef4444"
            position={[0, 4.8, 0.5]}
            onClick={() => onSelectZone('documents')}
            isActive={isZoneActive('documents')}
            lines={[
              {
                text: `OVERDUE DOCUMENTS: ${metrics.documents.details.pendingFollowUps || 3} REQUIRED`,
                color: '#ef4444',
              },
              { text: 'Identity & Right-to-Work Follow-up Past Due', color: '#fca5a5' },
              { text: 'Audit Trail Locked & Verified', color: '#10b981' },
            ]}
          />
        </group>

        {/* ============================================================== */}
        {/* 6. BACK OFFICE & DAILY REPORTS (LEFT BACK: x: -18, z: -8)      */}
        {/* ============================================================== */}
        <group position={[-18, 0, -8]}>
          {/* Executive Corner Manager Desk */}
          <mesh position={[0, 0.8, -1]} castShadow>
            <boxGeometry args={[4.6, 0.12, 2.2]} />
            <meshStandardMaterial color="#78350f" roughness={0.4} />
          </mesh>
          {/* Dual Curved Office Monitors */}
          {[-0.8, 0.8].map((mx) => (
            <group key={`office-mon-${mx}`} position={[mx, 1.35, -1.2]}>
              <mesh castShadow>
                <boxGeometry args={[1.1, 0.65, 0.08]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0, 0, 0.05]}>
                <planeGeometry args={[1.05, 0.6]} />
                <meshBasicMaterial color="#38bdf8" />
              </mesh>
            </group>
          ))}

          {/* ANIMATED OFFICE MANAGER TYPING AT WORKSTATION */}
          <OfficeManagerCharacter position={[0, 0, -0.2]} />

          {/* Heavy Commercial Security Safe Vault with Dial Wheel */}
          <group position={[-5, 1, -1.5]}>
            <mesh castShadow>
              <boxGeometry args={[1.6, 2, 1.4]} />
              <meshStandardMaterial color="#0f172a" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.72]}>
              <cylinderGeometry args={[0.22, 0.22, 0.06, 16]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.95} />
            </mesh>
          </group>

          {/* DEDICATED PHYSICAL REMINDERS NOTICE BOARD ON WALL */}
          <group position={[5.5, 0, -1]}>
            <mesh position={[0, 1.8, -0.4]} castShadow>
              <boxGeometry args={[3.2, 1.8, 0.1]} />
              <meshStandardMaterial color="#78350f" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.8, -0.38]}>
              <boxGeometry args={[3.3, 1.9, 0.05]} />
              <meshStandardMaterial color="#451a03" />
            </mesh>
            {[-1, 0, 1].map((rx, idx) => (
              <mesh
                key={`sticky-${idx}`}
                position={[rx * 0.9, 1.8 + (idx % 2 === 0 ? 0.25 : -0.25), -0.32]}
              >
                <planeGeometry args={[0.55, 0.55]} />
                <meshStandardMaterial
                  color={['#fef08a', '#93c5fd', '#f472b6'][idx]}
                  emissive={['#ca8a04', '#1e40af', '#9d174d'][idx]}
                  emissiveIntensity={0.2}
                />
              </mesh>
            ))}
          </group>

          {/* Sleek Architectural HUD Pin for Daily Reports */}
          <ArchitecturalHudPin
            title="BACK OFFICE & DAILY REPORTS"
            icon="🗄️"
            color="#38bdf8"
            position={[0, 4.8, -1]}
            onClick={() => onSelectZone('daily_reports')}
            isActive={isZoneActive('daily_reports')}
            lines={[
              {
                text: `DAILY REPORTS: ${metrics.daily_reports.count || 2} SUBMITTED TODAY`,
                color: '#ffffff',
              },
              { text: 'Shift Till Audits Logged • Zero Variance', color: '#4ade80' },
              { text: 'Manager Active • Communications Synced', color: '#94a3b8' },
            ]}
          />

          {/* Sleek Architectural HUD Pin for Reminders */}
          <ArchitecturalHudPin
            title="REMINDERS & TASKS"
            icon="📌"
            color="#facc15"
            position={[5.5, 4.4, -1]}
            onClick={() => onSelectZone('reminders')}
            isActive={isZoneActive('reminders')}
            lines={[
              { text: `DUE REMINDERS: ${metrics.reminders.count || 2} PENDING`, color: '#ffffff' },
              { text: 'Till Cash Drop & Underground Dip Due', color: '#fde047' },
            ]}
          />
        </group>

        {/* ============================================================== */}
        {/* 7. SCHEDULING & HOLIDAY DIARY LOUNGE (RIGHT BACK: x: 18, z: -8) */}
        {/* ============================================================== */}
        <group position={[18, 0, -8]}>
          {/* Break Room Dining Table */}
          <mesh position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[3.6, 0.12, 1.8]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* Ceramic Coffee Mugs */}
          {[-0.8, 0.8].map((mx) => (
            <mesh key={`mug-${mx}`} position={[mx, 0.92, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.14, 12]} />
              <meshStandardMaterial color="#0284c7" />
            </mesh>
          ))}
          {/* Animated Staff Member Sipping Coffee */}
          <BreakRoomStaffCharacter position={[0, 0, 0.2]} />

          {/* Kitchenette Counter with Coffee Maker */}
          <mesh position={[-5, 1, -1.5]} castShadow>
            <boxGeometry args={[2.2, 2, 1]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Wall-Mounted Roster Corkboard */}
          <mesh position={[0, 1.8, -4.2]}>
            <boxGeometry args={[4.2, 1.6, 0.1]} />
            <meshStandardMaterial color="#78350f" />
          </mesh>

          {/* Sleek Elevated Architectural HUD Pin for Scheduling & Holiday Diary */}
          <ArchitecturalHudPin
            title="SCHEDULING & HOLIDAY DIARY"
            icon="📅"
            color="#4ade80"
            position={[0, 4.8, -1]}
            onClick={() => onSelectZone('scheduling')}
            isActive={isZoneActive('scheduling') || isZoneActive('attendance')}
            lines={[
              {
                text: `HOLIDAY DIARY: ${metrics.attendance.count || 4} PENDING REQUESTS`,
                color: '#ffffff',
              },
              { text: 'SCHEDULING: 8 STAFF ROSTERED TODAY', color: '#fde047' },
              { text: 'Morning, Afternoon & Night Shifts Covered', color: '#4ade80' },
            ]}
          />
        </group>

        {/* ============================================================== */}
        {/* 8. RETAIL SUPERSTORE FLOOR, PRODUCTS, TROLLEYS & CUSTOMERS     */}
        {/* ============================================================== */}
        <group position={[0, 0, 2]}>
          {/* 4 FULLY STOCKED GONDOLA SHELVING UNITS PACKED WITH REALISTIC MERCHANDISED GROCERIES */}
          <GondolaShelvingUnit position={[-8.5, 0, -2]} category="SNACKS & CRISPS" theme="snacks" />
          <GondolaShelvingUnit position={[-3.5, 0, -2]} category="BREAKFAST & PANTRY" theme="pantry" />
          <GondolaShelvingUnit position={[1.5, 0, -2]} category="BAKERY & FRESH PRODUCE" theme="fresh" />
          <GondolaShelvingUnit position={[6.5, 0, -2]} category="WINE, BEER & JUICE" theme="drinks" />

          {/* 14m Wide Illuminated Cold Drink Chiller Wall with Glowing Cans & Bottles */}
          <group position={[0, 2.1, -7.8]}>
            <mesh castShadow>
              <boxGeometry args={[14, 4.2, 1.2]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            {/* Chilled Glowing Backing */}
            <mesh position={[0, 0, 0.58]}>
              <planeGeometry args={[13.6, 3.8]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.25} />
            </mesh>
            {/* Cool White Chiller Interior Downlight */}
            <pointLight position={[0, 1.2, 0.8]} intensity={1.8} distance={9} color="#e0f2fe" />

            {/* 4 Tiers of Chilled Soda Cans & Bottles */}
            {[-1.2, -0.4, 0.4, 1.2].map((ty, tidx) => (
              <group key={`chiller-tier-${tidx}`} position={[0, ty, 0.35]}>
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[13.4, 0.02, 0.7]} />
                  <meshStandardMaterial color="#ffffff" />
                </mesh>
                {[-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map((cx) => (
                  <mesh key={`can-${tidx}-${cx}`} position={[cx * 0.95, 0.12, 0]} castShadow>
                    <cylinderGeometry args={[0.07, 0.07, 0.22, 12]} />
                    <meshStandardMaterial
                      color={
                        ['#dc2626', '#2563eb', '#16a34a', '#ea580c'][(tidx + Math.abs(cx)) % 4]
                      }
                      metalness={0.8}
                      roughness={0.2}
                    />
                  </mesh>
                ))}
              </group>
            ))}

            {/* Glass Doors Grid with Chrome Handles */}
            {[-5, -2.5, 0, 2.5, 5].map((gx) => (
              <group key={`chiller-door-${gx}`} position={[gx, 0, 0.6]}>
                <mesh>
                  <boxGeometry args={[0.06, 3.7, 0.04]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
                </mesh>
                <mesh position={[0.15, 0, 0.04]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
                  <meshStandardMaterial color="#ffffff" metalness={0.95} />
                </mesh>
              </group>
            ))}
          </group>

          {/* ============================================================== */}
          {/* SHOPPING CUSTOMERS WITH TROLLEYS & BASKETS INSIDE STORE        */}
          {/* ============================================================== */}
          {/* Customer 1: Actively pushing shopping cart in grand supermarket circuit */}
          <ShopperPushingTrolley
            circuitPoints={[
              new THREE.Vector3(-5.8, 0.08, 1.2),
              new THREE.Vector3(-5.8, 0.08, -5.5),
              new THREE.Vector3(-0.5, 0.08, -5.8),
              new THREE.Vector3(4.2, 0.08, -5.5),
              new THREE.Vector3(4.2, 0.08, 1.2),
              new THREE.Vector3(0.0, 0.08, 1.8),
            ]}
            speed={0.65}
            clothesColor="#2563eb"
            hairColor="#1e293b"
            hairStyle="short"
            skinTone="#fed7aa"
          />

          {/* Customer 2: Pushing shopping cart in Snacks aisle circuit */}
          <ShopperPushingTrolley
            circuitPoints={[
              new THREE.Vector3(-10.5, 0.08, 1.2),
              new THREE.Vector3(-10.5, 0.08, -5.5),
              new THREE.Vector3(-8.8, 0.08, -5.5),
              new THREE.Vector3(-8.8, 0.08, 1.2),
            ]}
            speed={0.55}
            clothesColor="#dc2626"
            hairColor="#b45309"
            hairStyle="pompadour"
            skinTone="#fde047"
          />

          {/* Customer 3: Standing and inspecting product on Snack Gondola */}
          <ShopperBrowsingAisle
            position={[-0.5, 0.08, -2]}
            rotation={[0, -Math.PI / 2, 0]}
            topColor="#059669"
            hairColor="#172554"
            skinTone="#fed7aa"
          />

          {/* Customer 4: Standing at Cold Drink Cooler Wall reaching for drink */}
          <ShopperBrowsingAisle
            position={[1.5, 0.08, -6.5]}
            rotation={[0, Math.PI, 0]}
            topColor="#9333ea"
            hairColor="#451a03"
            skinTone="#fcd34d"
          />

          {/* Customer 5: Standing in Queue with full shopping cart at Till 1, checking phone */}
          <group position={[3.5, 0.08, 2.8]}>
            <ShoppingTrolley position={[0, 0, 0]} rotation={[0, -0.2, 0]} hasGroceries={true} />
            <StoreCustomerCharacter
              position={[0, 0, -0.9]}
              topColor="#0284c7"
              hairColor="#292524"
              trouserColor="#1e293b"
            />
          </group>

          {/* DUAL CHECKOUT TILLS (TILL 1 & TILL 2) & SALES ANALYSIS DISPLAY */}
          <group position={[3.5, 0, 5.5]}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[4.2, 1.4, 1.4]} />
              <meshStandardMaterial
                color={getZoneColor('sales_analysis', '#f8fafc', '#2fad87')}
                roughness={0.3}
              />
            </mesh>
            {/* Dual NCR POS Registers with Barcode Scanners */}
            {[-1.2, 1.2].map((tx, idx) => (
              <group key={`till-reg-${idx}`} position={[tx, 1.55, 0]} rotation={[0, -0.2, 0]}>
                <mesh>
                  <boxGeometry args={[0.55, 0.45, 0.1]} />
                  <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0, 0, 0.06]}>
                  <planeGeometry args={[0.5, 0.4]} />
                  <meshBasicMaterial color="#10b981" />
                </mesh>
              </group>
            ))}

            {/* Cashier Scanning Items with Red Laser Beam */}
            <RetailCashierCharacter position={[0.8, 0, -1]} />

            {/* Sleek Elevated Sales Analysis HUD Pin */}
            <ArchitecturalHudPin
              title="SALES ANALYSIS & TILLS"
              icon="💳"
              color="#34d399"
              position={[0, 4.8, 0]}
              onClick={() => onSelectZone('sales_analysis')}
              isActive={isZoneActive('sales_analysis')}
              lines={[
                { text: "TODAY'S TILL: £5,420 • 1,240 TRANSACTIONS", color: '#ffffff' },
                { text: 'Fuel 68% • Shop 28% • Lottery 4%', color: '#fde047' },
                { text: 'EPOS Live Sync • Cash Drop Balanced', color: '#4ade80' },
              ]}
            />
          </group>

          {/* 1. DEDICATED LOTTERY COUNTER (LEFT FRONT: x: -2.5, z: 5.5) */}
          <group position={[-2.5, 0, 5.5]}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[3.2, 1.4, 1.4]} />
              <meshStandardMaterial
                color={getZoneColor('lottery', '#f8fafc', '#eab308')}
                roughness={0.3}
              />
            </mesh>
            {/* National Lottery Brand Fascia */}
            <mesh position={[0, 1.42, 0.65]}>
              <boxGeometry args={[3.0, 0.12, 0.1]} />
              <meshStandardMaterial color="#ca8a04" emissive="#eab308" emissiveIntensity={0.6} />
            </mesh>
            {/* Scratchcard Dispenser Tower */}
            <mesh position={[0, 1.9, 0]}>
              <boxGeometry args={[1.8, 1.6, 0.5]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            {/* Colorful Scratchcard Cards */}
            {[-0.45, -0.15, 0.15, 0.45].map((ry, idx) => (
              <mesh key={`scratch-tier-adv-${idx}`} position={[0, 1.9 + ry, 0.28]}>
                <boxGeometry args={[1.6, 0.2, 0.05]} />
                <meshStandardMaterial
                  color={['#eab308', '#ef4444', '#3b82f6', '#10b981'][idx]}
                  emissive={['#ca8a04', '#b91c1c', '#1d4ed8', '#059669'][idx]}
                  emissiveIntensity={0.8}
                />
              </mesh>
            ))}

            {/* Sleek Elevated Lottery HUD Pin */}
            <ArchitecturalHudPin
              title="NATIONAL LOTTERY"
              icon="🎟️"
              color="#facc15"
              position={[0, 4.8, 0]}
              onClick={() => onSelectZone('lottery')}
              isActive={isZoneActive('lottery')}
              lines={[
                {
                  text: `ACTIVE SLOTS: ${metrics.lottery.details.activeGames || 12} • 0 VARIANCES`,
                  color: '#ffffff',
                },
                { text: 'Non-Destructive Slot History Active', color: '#4ade80' },
                { text: 'Daily Pack Audits Validated', color: '#94a3b8' },
              ]}
            />
          </group>

          {/* 2. DEDICATED CUSTOMER & FLEET ACCOUNTS COUNTER (LEFT FRONT: x: -7.5, z: 5.5) */}
          <group position={[-7.5, 0, 5.5]}>
            <mesh position={[0, 0.7, 0]} castShadow>
              <boxGeometry args={[3.2, 1.4, 1.4]} />
              <meshStandardMaterial
                color={getZoneColor('customer_accounts', '#f8fafc', '#38bdf8')}
                roughness={0.3}
              />
            </mesh>
            {/* Corporate Blue Fascia */}
            <mesh position={[0, 1.42, 0.65]}>
              <boxGeometry args={[3.0, 0.12, 0.1]} />
              <meshStandardMaterial color="#0284c7" emissive="#38bdf8" emissiveIntensity={0.6} />
            </mesh>
            {/* B2B Terminal & Fleet Key Pad */}
            <mesh position={[-0.6, 1.55, 0]}>
              <boxGeometry args={[0.65, 0.45, 0.12]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
            <mesh position={[-0.6, 1.55, 0.07]}>
              <planeGeometry args={[0.6, 0.4]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            {/* Fleet Cards Display Stand */}
            <mesh position={[0.7, 1.6, 0]}>
              <boxGeometry args={[0.9, 0.6, 0.3]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>

            {/* Sleek Elevated Customer Accounts HUD Pin */}
            <ArchitecturalHudPin
              title="CUSTOMER & FLEET ACCOUNTS"
              icon="💼"
              color="#38bdf8"
              position={[0, 4.8, 0]}
              onClick={() => onSelectZone('customer_accounts')}
              isActive={isZoneActive('customer_accounts')}
              lines={[
                { text: 'ACTIVE FLEET CARDS: 18 ACCOUNTS', color: '#ffffff' },
                { text: 'Credit Holds: 0 • Month Spend: £14,850', color: '#4ade80' },
                { text: 'Direct Debit & Invoicing Synced', color: '#94a3b8' },
              ]}
            />
          </group>
        </group>

        {/* ============================================================== */}
        {/* 9. NIZA SAFE COMMAND STATION (CENTER BACK: x: 0, z: -8)        */}
        {/* ============================================================== */}
        <group position={[0, 0, -8]}>
          {/* Fire Safety Equipment Station */}
          {[-1.2, 1.2].map((exX) => (
            <group key={`ext-safe-${exX}`} position={[exX, 1.2, -0.3]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.18, 0.18, 0.9, 16]} />
                <meshStandardMaterial color="#dc2626" metalness={0.4} />
              </mesh>
            </group>
          ))}
          {/* First Aid Emergency Cabinet */}
          <mesh position={[0, 1.6, -0.3]}>
            <boxGeometry args={[0.7, 0.7, 0.18]} />
            <meshStandardMaterial color="#16a34a" />
          </mesh>

          {/* 3D Floating Rotating Safety Incident Beacon */}
          <Float speed={1.5} rotationIntensity={0.3} floatIntensity={0.5}>
            <group position={[0, 3.2, 0]}>
              <mesh>
                <octahedronGeometry args={[0.65, 0]} />
                <meshStandardMaterial
                  color={metrics.niza_safe.count > 0 ? '#ef4444' : '#22c55e'}
                  emissive={metrics.niza_safe.count > 0 ? '#dc2626' : '#16a34a'}
                  emissiveIntensity={1.2}
                />
              </mesh>
            </group>
          </Float>

          {/* Sleek Elevated NIZA Safe HUD Pin */}
          <ArchitecturalHudPin
            title="NIZA SAFE COMMAND"
            icon="🛡️"
            color="#22c55e"
            position={[0, 4.8, 0]}
            onClick={() => onSelectZone('niza_safe')}
            isActive={isZoneActive('niza_safe')}
            lines={[
              {
                text: `OPEN INCIDENTS: ${metrics.niza_safe.details.openIncidents || 0}`,
                color: metrics.niza_safe.details.openIncidents > 0 ? '#ef4444' : '#ffffff',
              },
              {
                text: `OVERDUE SAFETY TASKS: ${metrics.niza_safe.details.overdueTasks || 0}`,
                color: metrics.niza_safe.details.overdueTasks > 0 ? '#facc15' : '#4ade80',
              },
              { text: 'Fire Safety & First Aid: COMPLIANT', color: '#4ade80' },
            ]}
          />
        </group>
      </group>
    </group>
  );
}
