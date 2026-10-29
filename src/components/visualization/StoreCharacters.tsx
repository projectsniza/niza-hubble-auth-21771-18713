import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Realistic Character Anatomical Base & Subcomponents
// ---------------------------------------------------------------------------

interface DetailedHumanMeshProps {
  skinTone?: string;
  hairColor?: string;
  hairStyle?: 'short' | 'pompadour' | 'bob' | 'bun' | 'curly' | 'cap';
  topColor: string;
  topType?: 'polo' | 'shirt' | 'hoodie' | 'jacket' | 'sweater' | 'hi-vis';
  trouserColor: string;
  shoeColor?: string;
  hasGlasses?: boolean;
  hasIdBadge?: boolean;
  scale?: number;
}

/**
 * Realistic articulated human model with:
 * - Proper anatomical proportions (head, neck, tapered torso, shoulders, articulated upper & lower arms, hands with fingers, hips, articulated thighs, knees, calves, and sculpted shoes)
 * - Head with facial profile (nose, eyes/brows, ears, natural hair contours)
 * - Hierarchical joints for natural kinematics (shoulder -> elbow -> wrist, hip -> knee -> ankle)
 */
export function DetailedHumanBody({
  skinTone = '#fbcfe8',
  hairColor = '#3e2723',
  hairStyle = 'short',
  topColor,
  topType = 'polo',
  trouserColor,
  shoeColor = '#1e293b',
  hasGlasses = false,
  hasIdBadge = false,
  scale = 1,
}: DetailedHumanMeshProps) {
  return (
    <group scale={scale}>
      {/* 1. HEAD & FEATURES */}
      <group position={[0, 1.54, 0]}>
        {/* Cranium / Head */}
        <mesh castShadow>
          <sphereGeometry args={[0.135, 16, 16]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>

        {/* Jaw & Chin Sculpt */}
        <mesh position={[0, -0.06, 0.04]} castShadow>
          <boxGeometry args={[0.13, 0.11, 0.14]} />
          <meshStandardMaterial color={skinTone} roughness={0.65} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.015, 0.14]}>
          <boxGeometry args={[0.032, 0.055, 0.04]} />
          <meshStandardMaterial color={skinTone} roughness={0.6} />
        </mesh>

        {/* Eyes / Brow Ridge */}
        <mesh position={[0, 0.028, 0.125]}>
          <boxGeometry args={[0.11, 0.02, 0.02]} />
          <meshStandardMaterial color={skinTone} roughness={0.7} />
        </mesh>
        {[-0.045, 0.045].map((ex) => (
          <group key={`eye-${ex}`} position={[ex, 0.02, 0.128]}>
            {/* Sclera / Eye White */}
            <mesh>
              <sphereGeometry args={[0.016, 8, 8]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Pupil */}
            <mesh position={[0, 0, 0.012]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
          </group>
        ))}

        {/* Ears */}
        {[-0.14, 0.14].map((ex) => (
          <mesh key={`ear-${ex}`} position={[ex, -0.01, -0.01]}>
            <boxGeometry args={[0.025, 0.06, 0.04]} />
            <meshStandardMaterial color={skinTone} roughness={0.7} />
          </mesh>
        ))}

        {/* Realistic Hair Styles */}
        {hairStyle === 'cap' ? (
          <group position={[0, 0.06, 0]}>
            {/* Cap Crown */}
            <mesh castShadow>
              <sphereGeometry args={[0.142, 16, 16]} />
              <meshStandardMaterial color="#064e3b" roughness={0.8} />
            </mesh>
            {/* Visor Peak */}
            <mesh position={[0, -0.02, 0.14]} rotation={[0.15, 0, 0]}>
              <boxGeometry args={[0.18, 0.025, 0.14]} />
              <meshStandardMaterial color="#064e3b" roughness={0.8} />
            </mesh>
          </group>
        ) : (
          <group position={[0, 0.04, -0.01]}>
            {/* Main Hair Volume */}
            <mesh castShadow>
              <sphereGeometry args={[0.142, 16, 16]} />
              <meshStandardMaterial color={hairColor} roughness={0.9} />
            </mesh>
            {/* Hair Front / Parting */}
            <mesh position={[0, 0.06, 0.06]}>
              <boxGeometry args={[0.18, 0.07, 0.12]} />
              <meshStandardMaterial color={hairColor} roughness={0.9} />
            </mesh>
            {hairStyle === 'bob' && (
              <mesh position={[0, -0.08, -0.04]}>
                <boxGeometry args={[0.26, 0.16, 0.22]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
            {hairStyle === 'bun' && (
              <mesh position={[0, 0.12, -0.1]}>
                <sphereGeometry args={[0.06, 12, 12]} />
                <meshStandardMaterial color={hairColor} roughness={0.9} />
              </mesh>
            )}
          </group>
        )}

        {/* Glasses */}
        {hasGlasses && (
          <group position={[0, 0.02, 0.135]}>
            <mesh>
              <boxGeometry args={[0.19, 0.04, 0.02]} />
              <meshStandardMaterial color="#0f172a" metalness={0.8} />
            </mesh>
            {/* Glass Lenses */}
            {[-0.048, 0.048].map((gx) => (
              <mesh key={`lens-${gx}`} position={[gx, 0, 0.005]}>
                <planeGeometry args={[0.05, 0.035]} />
                <meshStandardMaterial color="#93c5fd" transparent opacity={0.4} roughness={0.1} />
              </mesh>
            ))}
          </group>
        )}

        {/* Neck */}
        <mesh position={[0, -0.15, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.12, 12]} />
          <meshStandardMaterial color={skinTone} roughness={0.7} />
        </mesh>
      </group>

      {/* 2. TORSO & APPAREL */}
      <group position={[0, 1.15, 0]}>
        {/* Chest & Upper Back (Tapered V-Shape) */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.32, 12]} />
          <meshStandardMaterial color={topColor} roughness={0.75} />
        </mesh>
        {/* Waist & Midriff */}
        <mesh position={[0, -0.12, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.17, 0.22, 12]} />
          <meshStandardMaterial color={topColor} roughness={0.75} />
        </mesh>

        {/* Top Details */}
        {topType === 'polo' && (
          <mesh position={[0, 0.22, 0.08]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[0.14, 0.05, 0.06]} />
            <meshStandardMaterial color={topColor} roughness={0.6} />
          </mesh>
        )}
        {topType === 'hi-vis' && (
          <group position={[0, 0.02, 0]}>
            {/* Reflective Silver Stripes */}
            {[-0.08, 0.12].map((sy) => (
              <mesh key={`stripe-${sy}`} position={[0, sy, 0]}>
                <cylinderGeometry args={[0.205, 0.205, 0.04, 12]} />
                <meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.6} />
              </mesh>
            ))}
          </group>
        )}
        {topType === 'jacket' && (
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[0.38, 0.44, 0.22]} />
            <meshStandardMaterial color={topColor} roughness={0.65} />
          </mesh>
        )}

        {/* ID Card / Staff Badge */}
        {hasIdBadge && (
          <group position={[0.11, 0.1, 0.14]}>
            {/* Lanyard Clip */}
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.03, 0.03, 0.015]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
            {/* ID Card */}
            <mesh>
              <boxGeometry args={[0.075, 0.11, 0.01]} />
              <meshStandardMaterial color="#ffffff" />
            </mesh>
            {/* Photo / Chip on Badge */}
            <mesh position={[0, 0.02, 0.007]}>
              <planeGeometry args={[0.045, 0.045]} />
              <meshBasicMaterial color="#0284c7" />
            </mesh>
          </group>
        )}
      </group>

      {/* 3. PELVIS / HIPS */}
      <mesh position={[0, 0.88, 0]} castShadow>
        <cylinderGeometry args={[0.175, 0.165, 0.16, 12]} />
        <meshStandardMaterial color={trouserColor} roughness={0.8} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 1. Office Manager Character (Dual screen review, typing, mouse clicks, head swivel)
// ---------------------------------------------------------------------------
export function OfficeManagerCharacter({ position }: { position: [number, number, number] }) {
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Breathing spine
    if (spineRef.current) {
      spineRef.current.position.y = Math.sin(t * 1.6) * 0.008;
    }
    // Head swivels smoothly across dual monitors and telemetry dashboard
    if (headRef.current) {
      headRef.current.rotation.y = Math.sin(t * 0.9) * 0.35;
      headRef.current.rotation.x = 0.12 + Math.sin(t * 1.8) * 0.05;
    }
    // Left hand typing keystrokes
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -0.72 + Math.sin(t * 11) * 0.08;
      leftArmRef.current.rotation.z = 0.18 + Math.cos(t * 9) * 0.04;
    }
    // Right hand mouse movements and clicks
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = -0.68 + Math.sin(t * 3.5) * 0.04;
      rightArmRef.current.rotation.y = -0.15 + Math.cos(t * 2.2) * 0.08;
    }
  });

  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <group ref={spineRef}>
        {/* Articulated Body with Smart Shirt & Glasses */}
        <DetailedHumanBody
          skinTone="#fde047"
          hairColor="#292524"
          hairStyle="short"
          topColor="#0284c7"
          topType="shirt"
          trouserColor="#1e293b"
          shoeColor="#0f172a"
          hasGlasses={true}
          hasIdBadge={true}
        />

        {/* Head Joint */}
        <group ref={headRef} position={[0, 1.54, 0]} />

        {/* Left Arm Articulation (Shoulder -> Forearm -> Hand) */}
        <group ref={leftArmRef} position={[-0.24, 1.32, 0]}>
          {/* Upper Arm */}
          <mesh position={[0, -0.14, 0.08]} rotation={[-0.45, 0, 0.15]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.28, 8]} />
            <meshStandardMaterial color="#0284c7" roughness={0.7} />
          </mesh>
          {/* Forearm & Wrist */}
          <mesh position={[0, -0.26, 0.26]} rotation={[-1.1, 0, 0.15]} castShadow>
            <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
            <meshStandardMaterial color="#fde047" />
          </mesh>
          {/* Hand Typing */}
          <mesh position={[0, -0.28, 0.38]}>
            <boxGeometry args={[0.065, 0.025, 0.08]} />
            <meshStandardMaterial color="#fde047" />
          </mesh>
        </group>

        {/* Right Arm Articulation (Mouse Operation) */}
        <group ref={rightArmRef} position={[0.24, 1.32, 0]}>
          <mesh position={[0, -0.14, 0.08]} rotation={[-0.45, 0, -0.15]} castShadow>
            <cylinderGeometry args={[0.05, 0.045, 0.28, 8]} />
            <meshStandardMaterial color="#0284c7" roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.26, 0.26]} rotation={[-1.1, 0, -0.15]} castShadow>
            <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
            <meshStandardMaterial color="#fde047" />
          </mesh>
          {/* Hand on Ergonomic Mouse */}
          <mesh position={[0, -0.28, 0.38]}>
            <boxGeometry args={[0.065, 0.025, 0.08]} />
            <meshStandardMaterial color="#fde047" />
          </mesh>
        </group>

        {/* Ergonomic Office Mesh Chair */}
        <group position={[0, 0, -0.12]}>
          {/* Chair Base & Gas Lift */}
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
            <meshStandardMaterial color="#0f172a" metalness={0.9} />
          </mesh>
          {/* 5-Star Wheel Legs */}
          {[-0.22, 0, 0.22].map((cx) => (
            <mesh key={`chair-leg-${cx}`} position={[cx, 0.06, 0]}>
              <boxGeometry args={[0.06, 0.04, 0.52]} />
              <meshStandardMaterial color="#334155" metalness={0.8} />
            </mesh>
          ))}
          {/* Seat Cushion */}
          <mesh position={[0, 0.52, 0.08]} castShadow>
            <boxGeometry args={[0.48, 0.08, 0.46]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
          {/* Breathable Mesh High Backrest */}
          <mesh position={[0, 0.95, -0.14]} rotation={[-0.08, 0, 0]} castShadow>
            <boxGeometry args={[0.44, 0.72, 0.05]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
        </group>

        {/* Realistic Seated Legs (Thigh horizontal, Calf vertical, Shoes planted) */}
        {[-0.12, 0.12].map((lx) => (
          <group key={`mgr-leg-${lx}`} position={[lx, 0.82, 0]}>
            {/* Thigh */}
            <mesh position={[0, -0.05, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.08, 0.07, 0.42, 10]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* Knee Cap */}
            <mesh position={[0, -0.05, 0.43]}>
              <sphereGeometry args={[0.075, 8, 8]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* Calf */}
            <mesh position={[0, -0.42, 0.43]} castShadow>
              <cylinderGeometry args={[0.065, 0.058, 0.44, 10]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            {/* Leather Executive Oxford Shoes */}
            <mesh position={[0, -0.66, 0.48]} castShadow>
              <boxGeometry args={[0.11, 0.08, 0.24]} />
              <meshStandardMaterial color="#090d16" roughness={0.25} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 2. Retail Cashier Character (Interactive scanning, item passing, live laser)
// ---------------------------------------------------------------------------
export function RetailCashierCharacter({ position }: { position: [number, number, number] }) {
  const rightArmRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const laserRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Scanning cadence
    const scanCycle = Math.sin(t * 3.2);
    if (rightArmRef.current) {
      // Sweeps barcode gun over product
      rightArmRef.current.rotation.x = -0.55 + scanCycle * 0.22;
      rightArmRef.current.rotation.y = -0.15 + Math.cos(t * 3.2) * 0.18;
    }
    // Toggle laser beam directly without triggering React re-renders
    if (laserRef.current) {
      laserRef.current.visible = scanCycle > 0.35;
    }
    // Left hand picking up grocery items along belt
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -0.4 + Math.sin(t * 3.2 - 0.8) * 0.25;
      leftArmRef.current.rotation.z = 0.2 + Math.cos(t * 3.2) * 0.1;
    }
    // Head looks between POS screen and scanned items
    if (headRef.current) {
      headRef.current.rotation.y = -0.3 + Math.sin(t * 1.6) * 0.2;
      headRef.current.rotation.x = 0.2 + Math.sin(t * 3.2) * 0.06;
    }
  });

  return (
    <group position={position} rotation={[0, -Math.PI / 2, 0]}>
      {/* Human Body in NIZA Green Polo with ID Badge */}
      <DetailedHumanBody
        skinTone="#fed7aa"
        hairColor="#172554"
        hairStyle="bob"
        topColor="#2fad87"
        topType="polo"
        trouserColor="#0f172a"
        shoeColor="#090d16"
        hasGlasses={false}
        hasIdBadge={true}
      />

      {/* Head Anchor */}
      <group ref={headRef} position={[0, 1.54, 0]} />

      {/* Left Arm Picking / Guiding Groceries on Conveyor */}
      <group ref={leftArmRef} position={[-0.23, 1.32, 0]}>
        <mesh position={[0, -0.16, 0.12]} rotation={[-0.5, 0, 0.2]}>
          <cylinderGeometry args={[0.05, 0.045, 0.3, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.32, 0.28]} rotation={[-1.0, 0, 0.2]}>
          <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
        <mesh position={[0, -0.36, 0.4]}>
          <boxGeometry args={[0.065, 0.03, 0.075]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
      </group>

      {/* Right Arm Operating Zebra Barcode Scanner Gun */}
      <group ref={rightArmRef} position={[0.23, 1.32, 0]}>
        <mesh position={[0, -0.16, 0.12]} rotation={[-0.5, 0, -0.2]}>
          <cylinderGeometry args={[0.05, 0.045, 0.3, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.32, 0.28]} rotation={[-1.0, 0, -0.2]}>
          <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
        {/* Hand Holding Scanner Pistol */}
        <mesh position={[0, -0.36, 0.4]}>
          <boxGeometry args={[0.065, 0.03, 0.075]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
        {/* Industrial Scanner Pistol */}
        <group position={[0, -0.38, 0.48]}>
          <mesh>
            <boxGeometry args={[0.07, 0.14, 0.12]} />
            <meshStandardMaterial color="#0f172a" roughness={0.4} />
          </mesh>
          {/* Scanner Optical Head */}
          <mesh position={[0, 0.04, 0.06]}>
            <boxGeometry args={[0.06, 0.06, 0.06]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          {/* Live Red Laser Fan Projecting across Till (Imperative visibility) */}
          <group ref={laserRef} position={[0, 0.04, 0.35]} rotation={[0.15, 0, 0]}>
            <mesh>
              <coneGeometry args={[0.18, 0.65, 8, 1, true]} rotation={[Math.PI / 2, 0, 0]} />
              <meshBasicMaterial color="#ef4444" transparent opacity={0.65} side={THREE.DoubleSide} />
            </mesh>
            {/* Laser Target Dot */}
            <mesh position={[0, 0, 0.33]}>
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshBasicMaterial color="#ff0000" />
            </mesh>
          </group>
        </group>
      </group>

      {/* Upright Standing Legs with Safety Shoes */}
      {[-0.11, 0.11].map((lx) => (
        <group key={`cashier-leg-${lx}`} position={[lx, 0.85, 0]}>
          {/* Thigh */}
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* Calf */}
          <mesh position={[0, -0.58, 0]} castShadow>
            <cylinderGeometry args={[0.066, 0.058, 0.44, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          {/* Work Safety Shoes */}
          <mesh position={[0, -0.82, 0.06]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.23]} />
            <meshStandardMaterial color="#090d16" roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 3. Break Room Staff Character (Relaxing, holding mug, sipping coffee)
// ---------------------------------------------------------------------------
export function BreakRoomStaffCharacter({ position }: { position: [number, number, number] }) {
  const cupArmRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Sipping cycle: pauses, raises mug to mouth, tilts head back slightly, lowers mug
    const sipPhase = Math.sin(t * 0.9);
    const isSipping = sipPhase > 0.4;
    const sipLerp = Math.max(0, (sipPhase - 0.4) / 0.6);

    if (cupArmRef.current) {
      cupArmRef.current.rotation.x = -0.5 - sipLerp * 0.7;
      cupArmRef.current.rotation.y = 0.1 - sipLerp * 0.3;
    }
    if (headRef.current) {
      headRef.current.rotation.x = isSipping ? -0.12 * sipLerp : 0.05;
    }
  });

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* Seated Staff with NIZA Polo */}
      <DetailedHumanBody
        skinTone="#fcd34d"
        hairColor="#451a03"
        hairStyle="bun"
        topColor="#2fad87"
        topType="polo"
        trouserColor="#0f172a"
        shoeColor="#334155"
        hasGlasses={false}
        hasIdBadge={true}
      />

      <group ref={headRef} position={[0, 1.54, 0]} />

      {/* Coffee Mug Arm */}
      <group ref={cupArmRef} position={[0.22, 1.32, 0]}>
        <mesh position={[0, -0.15, 0.1]} rotation={[-0.45, 0, -0.2]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.28, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.28, 0.24]} rotation={[-0.9, 0, -0.2]} castShadow>
          <cylinderGeometry args={[0.042, 0.038, 0.24, 8]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
        {/* Hand gripping handle of Ceramic Mug */}
        <mesh position={[0, -0.32, 0.34]}>
          <boxGeometry args={[0.06, 0.03, 0.07]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
        {/* Ceramic Coffee Mug with Hot Coffee inside */}
        <group position={[0, -0.32, 0.42]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.065, 0.06, 0.13, 16]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
          </mesh>
          {/* Mug Handle */}
          <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.035, 0.012, 8, 16]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          {/* Hot Espresso / Coffee Surface */}
          <mesh position={[0, 0.055, 0]}>
            <circleGeometry args={[0.058, 12]} />
            <meshBasicMaterial color="#3b1d11" />
          </mesh>
        </group>
      </group>

      {/* Left Arm Resting casually on Lap */}
      <group position={[-0.22, 1.32, 0]} rotation={[0.4, 0, 0.3]}>
        <mesh position={[0, -0.15, 0.1]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.28, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.28, 0.22]} rotation={[-0.7, 0, 0]} castShadow>
          <cylinderGeometry args={[0.042, 0.038, 0.24, 8]} />
          <meshStandardMaterial color="#fcd34d" />
        </mesh>
      </group>

      {/* Lounge Chair */}
      <group position={[0, 0, -0.1]}>
        <mesh position={[0, 0.48, 0.1]} castShadow>
          <boxGeometry args={[0.54, 0.12, 0.52]} />
          <meshStandardMaterial color="#0284c7" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.95, -0.12]} rotation={[-0.12, 0, 0]} castShadow>
          <boxGeometry args={[0.54, 0.74, 0.12]} />
          <meshStandardMaterial color="#0284c7" roughness={0.8} />
        </mesh>
        {/* Chrome Legs */}
        {[-0.24, 0.24].map((cx) =>
          [-0.12, 0.28].map((cz, cidx) => (
            <mesh key={`lounge-leg-${cx}-${cidx}`} position={[cx, 0.22, cz]}>
              <cylinderGeometry args={[0.02, 0.02, 0.44, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
            </mesh>
          ))
        )}
      </group>

      {/* Seated Crossed / Relaxed Legs */}
      {[-0.11, 0.11].map((lx) => (
        <group key={`break-leg-${lx}`} position={[lx, 0.82, 0]}>
          <mesh position={[0, -0.05, 0.22]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.07, 0.42, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, -0.42, 0.43]} castShadow>
            <cylinderGeometry args={[0.065, 0.058, 0.44, 10]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, -0.66, 0.48]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.22]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 4. Realistic Supermarket Shopping Trolley
// ---------------------------------------------------------------------------
interface ShoppingTrolleyProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  hasGroceries?: boolean;
  handleColor?: string;
}

export function ShoppingTrolley({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  hasGroceries = true,
  handleColor = '#dc2626',
}: ShoppingTrolleyProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* 4 Precision Swivel Caster Wheels */}
      {[-0.32, 0.32].map((wx) =>
        [-0.42, 0.42].map((wz, widx) => (
          <group key={`wheel-${wx}-${widx}`} position={[wx, 0.1, wz]}>
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.16, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.08, 0.08, 0.05, 12]} />
              <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
          </group>
        ))
      )}

      {/* Tubular Steel Chassis Base Frame */}
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.66, 0.04, 0.94]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
      </mesh>
      {/* Bottom Wire Cargo Tray */}
      <mesh position={[0, 0.26, 0]}>
        <boxGeometry args={[0.58, 0.02, 0.82]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} />
      </mesh>
      {/* Bottled Water 6-Pack on Bottom Tray */}
      {hasGroceries && (
        <mesh position={[0, 0.36, -0.1]}>
          <boxGeometry args={[0.34, 0.18, 0.42]} />
          <meshStandardMaterial color="#38bdf8" transparent opacity={0.75} />
        </mesh>
      )}

      {/* Wire Mesh Main Shopping Basket (Deep & Tapered) */}
      <group position={[0, 0.65, 0]}>
        <mesh position={[0, -0.22, 0]}>
          <boxGeometry args={[0.64, 0.02, 0.86]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.92} roughness={0.15} />
        </mesh>
        {[-0.32, 0.32].map((sx) => (
          <mesh key={`basket-side-${sx}`} position={[sx, 0.04, 0]}>
            <boxGeometry args={[0.02, 0.48, 0.88]} />
            <meshStandardMaterial
              color="#e2e8f0"
              metalness={0.95}
              roughness={0.1}
              transparent
              opacity={0.65}
            />
          </mesh>
        ))}
        <mesh position={[0, 0.04, 0.44]}>
          <boxGeometry args={[0.64, 0.48, 0.02]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} transparent opacity={0.65} />
        </mesh>
        <mesh position={[0, 0.04, -0.44]}>
          <boxGeometry args={[0.64, 0.48, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.9} transparent opacity={0.65} />
        </mesh>

        {/* Ergonomic Plastic Push Handlebar */}
        <group position={[0, 0.35, -0.52]}>
          {[-0.3, 0.3].map((hx) => (
            <mesh key={`hstrut-${hx}`} position={[hx, -0.1, 0.05]} rotation={[-0.4, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
            </mesh>
          ))}
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 0.66, 12]} />
            <meshStandardMaterial color={handleColor} roughness={0.3} />
          </mesh>
          <mesh position={[0.2, 0.04, 0]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        </group>

        {/* Real Groceries Packed Inside the Basket */}
        {hasGroceries && (
          <group position={[0, -0.06, 0]}>
            {/* Baguette Bread Loaf leaning out */}
            <mesh position={[0.18, 0.22, 0.1]} rotation={[0.4, 0.3, -0.3]}>
              <cylinderGeometry args={[0.06, 0.05, 0.65, 8]} />
              <meshStandardMaterial color="#d97706" roughness={0.8} />
            </mesh>
            {/* Cereal Box */}
            <mesh position={[-0.14, 0.1, -0.15]} rotation={[0, 0.1, 0]}>
              <boxGeometry args={[0.16, 0.36, 0.26]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
            {/* Orange Juice Carton */}
            <mesh position={[0.08, 0.06, -0.22]}>
              <boxGeometry args={[0.12, 0.26, 0.12]} />
              <meshStandardMaterial color="#ea580c" />
            </mesh>
            {/* Soda Cans Multipack */}
            <mesh position={[-0.1, 0.02, 0.2]}>
              <boxGeometry args={[0.22, 0.14, 0.32]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
            {/* Green Apples in produce plastic bag */}
            <mesh position={[0.12, 0.02, 0.18]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color="#22c55e" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 5. Realistic Shopper Pushing Trolley (Kinematic walking stride, arm grasp, head bob)
// ---------------------------------------------------------------------------
interface ShopperPushingTrolleyProps {
  startPos: [number, number, number];
  endPos: [number, number, number];
  speed?: number;
  clothesColor?: string;
  hairColor?: string;
  hairStyle?: 'short' | 'pompadour' | 'bob' | 'bun';
  skinTone?: string;
}

export interface ShopperPushingTrolleyProps {
  startPos?: [number, number, number];
  endPos?: [number, number, number];
  circuitPoints?: THREE.Vector3[];
  speed?: number;
  clothesColor?: string;
  hairColor?: string;
  hairStyle?: 'short' | 'pompadour' | 'bob' | 'bun' | 'curly' | 'cap';
  skinTone?: string;
}

export function ShopperPushingTrolley({
  startPos,
  endPos,
  circuitPoints,
  speed = 0.8,
  clothesColor = '#0284c7',
  hairColor = '#451a03',
  hairStyle = 'short',
  skinTone = '#fed7aa',
}: ShopperPushingTrolleyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const leftCalfRef = useRef<THREE.Group>(null);
  const rightCalfRef = useRef<THREE.Group>(null);
  const humanRef = useRef<THREE.Group>(null);
  const trolleyRef = useRef<THREE.Group>(null);

  // Smooth continuous closed circuit loop (no abrupt moonwalk or reverse snap)
  const curve = useMemo(() => {
    if (circuitPoints && circuitPoints.length >= 3) {
      return new THREE.CatmullRomCurve3(circuitPoints, true, 'catmullrom', 0.25);
    }
    const s = startPos || [-4, 0.08, -5];
    const e = endPos || [-4, 0.08, 1.5];
    const laneOffset = 0.85;
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(s[0], s[1], s[2]),
        new THREE.Vector3(e[0], e[1], e[2]),
        new THREE.Vector3(e[0] + laneOffset, e[1], e[2]),
        new THREE.Vector3(s[0] + laneOffset, s[1], s[2]),
      ],
      true,
      'catmullrom',
      0.3
    );
  }, [circuitPoints, startPos, endPos]);

  const stateRef = useRef({
    progress: Math.random() * 0.5,
    walkCycle: 0,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;
    s.progress = (s.progress + speed * 0.04 * delta) % 1;

    const pos = curve.getPointAt(s.progress);
    const tangent = curve.getTangentAt(s.progress).normalize();

    groupRef.current.position.copy(pos);
    const targetRot = Math.atan2(tangent.x, tangent.z);
    groupRef.current.rotation.y = targetRot;

    // Natural walk cycle directly driven by linear movement
    s.walkCycle += delta * speed * 8;
    if (humanRef.current) {
      humanRef.current.position.y = Math.abs(Math.sin(s.walkCycle)) * 0.035;
    }

    // Articulated legs with hip swing and bending knee action
    const legSwing = Math.sin(s.walkCycle) * 0.45;
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = legSwing;
      rightLegRef.current.rotation.x = -legSwing;
    }
    if (leftCalfRef.current && rightCalfRef.current) {
      leftCalfRef.current.rotation.x = legSwing < 0 ? -legSwing * 0.85 : 0.05;
      rightCalfRef.current.rotation.x = -legSwing < 0 ? legSwing * 0.85 : 0.05;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Walking Human Body */}
      <group ref={humanRef} position={[0, 0, -0.72]}>
        <DetailedHumanBody
          skinTone={skinTone}
          hairColor={hairColor}
          hairStyle={hairStyle}
          topColor={clothesColor}
          topType="jacket"
          trouserColor="#1e293b"
          shoeColor="#090d16"
        />

        {/* Articulated Arms Reaching Forward to Grip the Shopping Cart Handle */}
        {[-0.22, 0.22].map((ax, idx) => (
          <group key={`trolley-arm-${idx}`} position={[ax, 1.32, 0]}>
            {/* Upper Arm angled down & forward */}
            <mesh position={[0, -0.16, 0.14]} rotation={[-0.55, 0, idx === 0 ? 0.12 : -0.12]}>
              <cylinderGeometry args={[0.05, 0.045, 0.32, 8]} />
              <meshStandardMaterial color={clothesColor} />
            </mesh>
            {/* Forearm extending straight to trolley handle */}
            <mesh position={[0, -0.32, 0.36]} rotation={[-0.85, 0, idx === 0 ? 0.1 : -0.1]}>
              <cylinderGeometry args={[0.042, 0.038, 0.32, 8]} />
              <meshStandardMaterial color={clothesColor} />
            </mesh>
            {/* Realistic Hand Wrapping Around Cart Handlebar */}
            <mesh position={[0, -0.42, 0.52]}>
              <boxGeometry args={[0.07, 0.035, 0.08]} />
              <meshStandardMaterial color={skinTone} />
            </mesh>
          </group>
        ))}

        {/* Articulated Walking Legs with Functional Knees */}
        {/* Left Leg */}
        <group ref={leftLegRef} position={[-0.11, 0.85, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Knee Joint */}
          <group ref={leftCalfRef} position={[0, -0.44, 0]}>
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.066, 0.058, 0.44, 10]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0, -0.44, 0.06]}>
              <boxGeometry args={[0.11, 0.08, 0.23]} />
              <meshStandardMaterial color="#090d16" />
            </mesh>
          </group>
        </group>

        {/* Right Leg */}
        <group ref={rightLegRef} position={[0.11, 0.85, 0]}>
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          {/* Knee Joint */}
          <group ref={rightCalfRef} position={[0, -0.44, 0]}>
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.066, 0.058, 0.44, 10]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0, -0.44, 0.06]}>
              <boxGeometry args={[0.11, 0.08, 0.23]} />
              <meshStandardMaterial color="#090d16" />
            </mesh>
          </group>
        </group>
      </group>

      {/* Shopping Trolley Connected Directly in Front */}
      <group ref={trolleyRef}>
        <ShoppingTrolley position={[0, 0, 0.15]} hasGroceries={true} />
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 5B. Forecourt Pedestrian Customer (Crossing Zebra Path in Continuous Loop)
// ---------------------------------------------------------------------------
export function ForecourtPedestrian({
  speed = 0.65,
  clothesColor = '#059669',
  skinTone = '#fed7aa',
}: {
  speed?: number;
  clothesColor?: string;
  skinTone?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftLegRef = useRef<THREE.Group>(null);
  const rightLegRef = useRef<THREE.Group>(null);
  const humanRef = useRef<THREE.Group>(null);

  // Closed loop: approaches across zebra crossing, enters store entrance, loops back
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0.08, 12),
        new THREE.Vector3(0, 0.08, 8.5),
        new THREE.Vector3(0, 0.08, 4.8),
        new THREE.Vector3(0.6, 0.08, 2.5),
        new THREE.Vector3(-0.6, 0.08, 2.5),
        new THREE.Vector3(-0.6, 0.08, 4.8),
        new THREE.Vector3(-0.6, 0.08, 8.5),
        new THREE.Vector3(-0.6, 0.08, 12),
      ],
      true,
      'catmullrom',
      0.25
    );
  }, []);

  const progressRef = useRef(0);
  const walkCycleRef = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    progressRef.current = (progressRef.current + speed * 0.035 * delta) % 1;

    const pos = curve.getPointAt(progressRef.current);
    const tangent = curve.getTangentAt(progressRef.current).normalize();

    groupRef.current.position.copy(pos);
    groupRef.current.rotation.y = Math.atan2(tangent.x, tangent.z);

    walkCycleRef.current += delta * speed * 8;
    if (humanRef.current) {
      humanRef.current.position.y = Math.abs(Math.sin(walkCycleRef.current)) * 0.035;
    }
    const legSwing = Math.sin(walkCycleRef.current) * 0.42;
    if (leftLegRef.current && rightLegRef.current) {
      leftLegRef.current.rotation.x = legSwing;
      rightLegRef.current.rotation.x = -legSwing;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={humanRef}>
        <DetailedHumanBody
          skinTone={skinTone}
          hairColor="#1e293b"
          hairStyle="cap"
          topColor={clothesColor}
          topType="polo"
          trouserColor="#334155"
          shoeColor="#090d16"
        />
        {/* Walking Arms */}
        {[-0.22, 0.22].map((ax, idx) => (
          <group key={`ped-arm-${idx}`} position={[ax, 1.32, 0]}>
            <mesh position={[0, -0.22, idx === 0 ? 0.08 : -0.08]}>
              <cylinderGeometry args={[0.048, 0.042, 0.48, 8]} />
              <meshStandardMaterial color={clothesColor} />
            </mesh>
          </group>
        ))}
        {/* Walking Legs */}
        <group ref={leftLegRef} position={[-0.11, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.06, 0.84, 10]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
        <group ref={rightLegRef} position={[0.11, 0.85, 0]}>
          <mesh position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.07, 0.06, 0.84, 10]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ---------------------------------------------------------------------------
// 6. Realistic Shopper Browsing Shelves (Turning, inspecting goods, holding basket)
// ---------------------------------------------------------------------------
export function ShopperBrowsingAisle({
  position,
  rotation = [0, 0, 0],
  hairColor = '#172554',
  topColor = '#059669',
  skinTone = '#fcd34d',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  hairColor?: string;
  topColor?: string;
  skinTone?: string;
}) {
  const armRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // Reaching and turning to compare products on shelf
    const reach = (Math.sin(t * 1.4) + 1) / 2;
    if (armRef.current) {
      armRef.current.rotation.x = -0.7 - reach * 0.45;
      armRef.current.rotation.y = reach * 0.3;
      armRef.current.rotation.z = -0.15;
    }
    if (headRef.current) {
      // Head tilts up toward higher shelf products
      headRef.current.rotation.x = -0.18 - reach * 0.12;
      headRef.current.rotation.y = Math.sin(t * 1.4) * 0.25;
    }
    if (bodyRef.current) {
      // Subtle weight shift from one hip to the other
      bodyRef.current.rotation.z = Math.sin(t * 0.7) * 0.025;
    }
  });

  return (
    <group ref={bodyRef} position={position} rotation={rotation}>
      <DetailedHumanBody
        skinTone={skinTone}
        hairColor={hairColor}
        hairStyle="short"
        topColor={topColor}
        topType="sweater"
        trouserColor="#334155"
        shoeColor="#0f172a"
      />

      <group ref={headRef} position={[0, 1.54, 0]} />

      {/* Arm Reaching Out Toward High Shelf & Inspecting Product */}
      <group ref={armRef} position={[0.23, 1.32, 0]}>
        <mesh position={[0, -0.16, 0.12]} rotation={[-0.45, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.3, 8]} />
          <meshStandardMaterial color={topColor} />
        </mesh>
        <mesh position={[0, -0.32, 0.28]} rotation={[-0.8, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
          <meshStandardMaterial color={skinTone} />
        </mesh>
        {/* Hand grasping grocery carton */}
        <mesh position={[0, -0.38, 0.42]}>
          <boxGeometry args={[0.065, 0.035, 0.08]} />
          <meshStandardMaterial color={skinTone} />
        </mesh>
        {/* Colorful Grocery Box Held in Hand */}
        <mesh position={[0, -0.38, 0.52]} rotation={[0.1, 0.2, 0]}>
          <boxGeometry args={[0.12, 0.22, 0.12]} />
          <meshStandardMaterial color="#facc15" roughness={0.4} />
        </mesh>
      </group>

      {/* Handheld Red Supermarket Shopping Basket */}
      <group position={[-0.28, 0.76, 0.08]} rotation={[0.05, 0, 0.1]}>
        {/* Basket Handle */}
        <mesh position={[0, 0.18, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.16, 0.015, 8, 16]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        {/* Red Perforated Basket */}
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.22, 0.42]} />
          <meshStandardMaterial color="#dc2626" roughness={0.4} />
        </mesh>
        {/* Items Inside Basket */}
        <mesh position={[0, 0.04, 0.08]} rotation={[0.2, 0.3, 0]}>
          <boxGeometry args={[0.12, 0.16, 0.12]} />
          <meshStandardMaterial color="#3b82f6" />
        </mesh>
        <mesh position={[-0.04, 0.06, -0.08]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#22c55e" />
        </mesh>
      </group>

      {/* Casual Standing Legs */}
      {[-0.11, 0.11].map((lx) => (
        <group key={`browse-leg-${lx}`} position={[lx, 0.85, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -0.58, 0]} castShadow>
            <cylinderGeometry args={[0.066, 0.058, 0.44, 10]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0, -0.82, 0.06]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.23]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 7. General Store Customer (Standing in queue or browsing)
// ---------------------------------------------------------------------------
export function StoreCustomerCharacter({
  position,
  rotation = [0, 0, 0],
  topColor = '#ea580c',
  hairColor = '#451a03',
  trouserColor = '#1e3a8a',
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  topColor?: string;
  hairColor?: string;
  trouserColor?: string;
}) {
  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 1.8) * 0.012;
    }
    if (headRef.current) {
      // Looks around the checkout display
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.3;
      headRef.current.rotation.x = 0.08 + Math.cos(t * 1.2) * 0.04;
    }
  });

  return (
    <group ref={bodyRef} position={position} rotation={rotation}>
      <DetailedHumanBody
        skinTone="#fde047"
        hairColor={hairColor}
        hairStyle="curly"
        topColor={topColor}
        topType="jacket"
        trouserColor={trouserColor}
        shoeColor="#0f172a"
      />

      <group ref={headRef} position={[0, 1.54, 0]} />

      {/* Arms Resting at Sides with Phone or Wallet */}
      <group position={[-0.22, 1.32, 0]}>
        <mesh position={[0, -0.22, 0.06]} rotation={[-0.2, 0, 0.1]} castShadow>
          <cylinderGeometry args={[0.048, 0.042, 0.44, 8]} />
          <meshStandardMaterial color={topColor} />
        </mesh>
      </group>
      <group position={[0.22, 1.32, 0]}>
        <mesh position={[0, -0.2, 0.1]} rotation={[-0.4, 0, -0.1]} castShadow>
          <cylinderGeometry args={[0.048, 0.042, 0.38, 8]} />
          <meshStandardMaterial color={topColor} />
        </mesh>
        {/* Smartphone in Hand (Checking live loyalty app) */}
        <mesh position={[0, -0.34, 0.22]} rotation={[0.4, -0.2, 0]}>
          <boxGeometry args={[0.07, 0.13, 0.01]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, -0.34, 0.228]} rotation={[0.4, -0.2, 0]}>
          <planeGeometry args={[0.06, 0.11]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
      </group>

      {/* Legs & Sneakers */}
      {[-0.11, 0.11].map((lx) => (
        <group key={`cust-leg-${lx}`} position={[lx, 0.85, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.068, 0.44, 10]} />
            <meshStandardMaterial color={trouserColor} />
          </mesh>
          <mesh position={[0, -0.58, 0]} castShadow>
            <cylinderGeometry args={[0.066, 0.058, 0.44, 10]} />
            <meshStandardMaterial color={trouserColor} />
          </mesh>
          <mesh position={[0, -0.82, 0.06]} castShadow>
            <boxGeometry args={[0.11, 0.08, 0.23]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 8. Forecourt Fueling Attendant Character (Safety Hi-Vis, Nozzle Operation)
// ---------------------------------------------------------------------------
export function FuelingAttendantCharacter({
  position,
  isFueling,
}: {
  position: [number, number, number];
  isFueling: boolean;
}) {
  const armRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!isFueling) return;
    const t = state.clock.elapsedTime;
    // Micro adjustments holding the heavy nozzle handle
    if (armRef.current) {
      armRef.current.rotation.x = -0.52 + Math.sin(t * 2.2) * 0.04;
      armRef.current.rotation.z = -0.12 + Math.cos(t * 1.8) * 0.02;
    }
    // Head monitors pump meter display
    if (headRef.current) {
      headRef.current.rotation.y = 0.25 + Math.sin(t * 1.1) * 0.15;
    }
  });

  if (!isFueling) return null;

  return (
    <group position={position} rotation={[0, Math.PI / 2, 0]}>
      {/* Attendant in NIZA Uniform with Hi-Vis Reflective Vest and Branded Cap */}
      <DetailedHumanBody
        skinTone="#fed7aa"
        hairColor="#172554"
        hairStyle="cap"
        topColor="#2fad87"
        topType="hi-vis"
        trouserColor="#1e293b"
        shoeColor="#090d16"
        hasIdBadge={true}
      />

      <group ref={headRef} position={[0, 1.54, 0]} />

      {/* Right Arm Holding Heavy Fuel Dispenser Nozzle */}
      <group ref={armRef} position={[0.24, 1.32, 0]}>
        <mesh position={[0, -0.16, 0.12]} rotation={[-0.45, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.052, 0.046, 0.32, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.34, 0.3]} rotation={[-0.85, 0, -0.15]} castShadow>
          <cylinderGeometry args={[0.044, 0.04, 0.28, 8]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
        {/* Heavy Fuel Dispenser Gun Nozzle */}
        <group position={[0, -0.42, 0.44]}>
          <mesh castShadow>
            <boxGeometry args={[0.09, 0.18, 0.24]} />
            <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Metal Spout inserted into car fuel neck */}
          <mesh position={[0, 0.05, 0.22]} rotation={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.02, 0.26, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.95} />
          </mesh>
          {/* High-Pressure Black Rubber Hose */}
          <mesh position={[-0.28, -0.44, -0.1]} rotation={[0, 0, 0.55]}>
            <cylinderGeometry args={[0.03, 0.03, 0.85, 8]} />
            <meshStandardMaterial color="#090d16" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Left Arm Resting on Hip / Guiding Hose */}
      <group position={[-0.23, 1.32, 0]} rotation={[0.25, 0, 0.35]}>
        <mesh position={[0, -0.18, 0.08]} castShadow>
          <cylinderGeometry args={[0.05, 0.045, 0.32, 8]} />
          <meshStandardMaterial color="#2fad87" />
        </mesh>
        <mesh position={[0, -0.32, 0.18]} rotation={[-0.6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.042, 0.038, 0.26, 8]} />
          <meshStandardMaterial color="#fed7aa" />
        </mesh>
      </group>

      {/* Sturdy Work Stance Legs & Heavy Steel-Toe Safety Boots */}
      {[-0.12, 0.12].map((lx) => (
        <group key={`attendant-leg-${lx}`} position={[lx, 0.85, 0]}>
          <mesh position={[0, -0.22, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.07, 0.44, 10]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, -0.58, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.062, 0.44, 10]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[0, -0.82, 0.08]} castShadow>
            <boxGeometry args={[0.13, 0.1, 0.26]} />
            <meshStandardMaterial color="#090d16" roughness={0.4} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// 9. Nested Shopping Carts Bay (Trolley Park at Supermarket Entrance)
// ---------------------------------------------------------------------------
export function SupermarketTrolleyBay({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Stainless Steel Trolley Guide Rails */}
      {[-0.42, 0.42].map((rx) => (
        <group key={`rail-${rx}`} position={[rx, 0.4, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 3.4, 8]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
          </mesh>
          {[-1.5, 0, 1.5].map((pz, pidx) => (
            <mesh key={`post-${rx}-${pidx}`} position={[0, -0.2, pz]}>
              <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* 4 Nested Supermarket Carts */}
      {[0, 1, 2, 3].map((idx) => (
        <ShoppingTrolley
          key={`parked-cart-${idx}`}
          position={[0, 0, -1.2 + idx * 0.75]}
          hasGroceries={false}
          handleColor={idx % 2 === 0 ? '#dc2626' : '#2563eb'}
        />
      ))}
    </group>
  );
}
