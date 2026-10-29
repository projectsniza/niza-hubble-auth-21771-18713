import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { FuelingAttendantCharacter } from './StoreCharacters';

// Procedural detailed low-poly vehicle component
interface VehicleModelProps {
  color: string;
  type: 'sedan' | 'suv' | 'van';
  headlightsOn?: boolean;
  braking?: boolean;
}

export function DetailedVehicleMesh({
  color,
  type,
  headlightsOn = true,
  braking = false,
  hazardBlinking = false,
}: VehicleModelProps & { hazardBlinking?: boolean }) {
  const isVan = type === 'van';
  const isSuv = type === 'suv';

  return (
    <group>
      {/* 1. LOWER SCULPTED CHASSIS & AERODYNAMIC SILLS */}
      <mesh position={[0, 0.36, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.86, 0.44, isVan ? 4.4 : 3.9]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.18} />
      </mesh>

      {/* Gloss Black Underbody Diffuser & Wheel Arches */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[1.9, 0.14, isVan ? 4.42 : 3.92]} />
        <meshStandardMaterial color="#090d16" roughness={0.8} />
      </mesh>

      {/* 2. HOOD / FRONT BONNET WITH AERODYNAMIC CONTOUR */}
      {!isVan && (
        <group position={[0, 0.64, 1.18]}>
          <mesh rotation={[-0.08, 0, 0]} castShadow>
            <boxGeometry args={[1.76, 0.22, 1.34]} />
            <meshStandardMaterial color={color} metalness={0.85} roughness={0.18} />
          </mesh>
          {/* Subtle hood center crease */}
          <mesh position={[0, 0.11, 0]}>
            <boxGeometry args={[0.2, 0.03, 1.2]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.15} />
          </mesh>
        </group>
      )}

      {/* Front Radiator Grille & Chrome Surround */}
      <mesh position={[0, 0.36, isVan ? 2.21 : 1.96]}>
        <boxGeometry args={[1.25, 0.24, 0.05]} />
        <meshStandardMaterial color="#020617" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.36, isVan ? 2.22 : 1.97]}>
        <boxGeometry args={[0.3, 0.06, 0.04]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
      </mesh>

      {/* Front UK Registration Number Plate */}
      <mesh position={[0, 0.21, isVan ? 2.22 : 1.97]}>
        <boxGeometry args={[0.56, 0.12, 0.04]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>

      {/* 3. CABIN GREENHOUSE (TINTED GLASS & PILLARS) */}
      {!isVan ? (
        <group position={[0, isSuv ? 0.96 : 0.86, -0.2]}>
          {/* Roof Panel */}
          <mesh position={[0, 0.33, 0]} castShadow>
            <boxGeometry args={[1.48, isSuv ? 0.68 : 0.56, 2.15]} />
            <meshStandardMaterial color={color} metalness={0.85} roughness={0.18} />
          </mesh>
          {/* Panoramic Tinted Glass Roof Inset */}
          <mesh position={[0, 0.62, -0.05]}>
            <planeGeometry args={[1.2, 1.4]} />
            <meshStandardMaterial color="#0b1329" metalness={0.95} roughness={0.05} />
          </mesh>
          {/* Angled Aerodynamic Front Windshield */}
          <mesh position={[0, 0.22, 1.08]} rotation={[0.42, 0, 0]}>
            <boxGeometry args={[1.44, 0.54, 0.06]} />
            <meshStandardMaterial color="#0b1329" metalness={0.9} roughness={0.08} />
          </mesh>
          {/* Angled Rear Windshield */}
          <mesh position={[0, 0.22, -1.08]} rotation={[-0.42, 0, 0]}>
            <boxGeometry args={[1.44, 0.54, 0.06]} />
            <meshStandardMaterial color="#0b1329" metalness={0.9} roughness={0.08} />
          </mesh>
          {/* Tinted Side Window Glasses */}
          {[-0.75, 0.75].map((wx) => (
            <mesh key={`win-side-${wx}`} position={[wx, 0.24, 0]}>
              <boxGeometry args={[0.03, 0.44, 1.85]} />
              <meshStandardMaterial color="#0b1329" metalness={0.9} roughness={0.08} />
            </mesh>
          ))}
          {/* B-Pillar Gloss Black Trim */}
          {[-0.76, 0.76].map((bx) => (
            <mesh key={`bpillar-${bx}`} position={[bx, 0.24, 0.1]}>
              <boxGeometry args={[0.02, 0.44, 0.14]} />
              <meshStandardMaterial color="#020617" roughness={0.5} />
            </mesh>
          ))}
          {/* Silver Roof Rails for SUV */}
          {isSuv &&
            [-0.66, 0.66].map((rx) => (
              <mesh key={`roof-rail-${rx}`} position={[rx, 0.7, 0]}>
                <boxGeometry args={[0.06, 0.08, 1.75]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.15} />
              </mesh>
            ))}
        </group>
      ) : (
        /* High-Capacity Delivery Van Body */
        <group position={[0, 1.18, -0.05]}>
          <mesh castShadow>
            <boxGeometry args={[1.82, 1.3, 4.1]} />
            <meshStandardMaterial color={color} metalness={0.4} roughness={0.3} />
          </mesh>
          {/* Van High Windshield */}
          <mesh position={[0, 0.28, 2.0]} rotation={[0.26, 0, 0]}>
            <boxGeometry args={[1.68, 0.72, 0.06]} />
            <meshStandardMaterial color="#0b1329" metalness={0.9} roughness={0.08} />
          </mesh>
          {/* NIZA Fleet Green Side Livery Stripe */}
          {[-0.92, 0.92].map((sx) => (
            <mesh key={`van-stripe-${sx}`} position={[sx, 0.12, 0]}>
              <boxGeometry args={[0.02, 0.28, 3.5]} />
              <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.65} />
            </mesh>
          ))}
          {/* Rear Van Doors Cutline */}
          <mesh position={[0, 0, -2.06]}>
            <boxGeometry args={[0.04, 1.25, 0.02]} />
            <meshStandardMaterial color="#090d16" />
          </mesh>
        </group>
      )}

      {/* 4. AERODYNAMIC SIDE MIRRORS */}
      {[-0.98, 0.98].map((mx) => (
        <group key={`mirror-${mx}`} position={[mx, 0.76, isVan ? 1.55 : 0.68]}>
          <mesh>
            <boxGeometry args={[0.16, 0.11, 0.14]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Mirror Reflective Chrome Glass Surface */}
          <mesh position={[0, 0, -0.07]}>
            <planeGeometry args={[0.14, 0.09]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.98} roughness={0.05} />
          </mesh>
        </group>
      ))}

      {/* 5. DUAL XENON LED HEADLIGHTS & ROAD PROJECTION */}
      {[-0.68, 0.68].map((hx) => (
        <group key={`headlight-${hx}`} position={[hx, 0.42, isVan ? 2.21 : 1.96]}>
          <mesh>
            <boxGeometry args={[0.28, 0.14, 0.05]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={headlightsOn ? '#fef3c7' : '#334155'}
              emissiveIntensity={headlightsOn ? 1.8 : 0.1}
            />
          </mesh>
          {/* Soft forward headlight beam on ground */}
          {headlightsOn && (
            <mesh position={[0, -0.15, 1.2]} rotation={[0.18, 0, 0]}>
              <coneGeometry args={[0.42, 2.2, 12, 1, true]} />
              <meshBasicMaterial color="#fef08a" transparent opacity={0.09} />
            </mesh>
          )}
        </group>
      ))}

      {/* 6. REAR LED TAILLIGHTS / BRAKE LIGHTS / HAZARD SIGNALS */}
      {[-0.7, 0.7].map((tx) => (
        <group key={`taillight-${tx}`} position={[tx, 0.45, isVan ? -2.21 : -1.96]}>
          <mesh>
            <boxGeometry args={[0.28, 0.14, 0.05]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#dc2626"
              emissiveIntensity={braking ? 2.8 : 0.85}
            />
          </mesh>
          {/* Amber Hazard Blinker */}
          {hazardBlinking && (
            <mesh position={[tx > 0 ? 0.1 : -0.1, 0, 0.01]}>
              <boxGeometry args={[0.08, 0.1, 0.05]} />
              <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={2.5} />
            </mesh>
          )}
        </group>
      ))}

      {/* Rear Yellow License Plate & Chrome Exhaust */}
      <mesh position={[0, 0.28, isVan ? -2.21 : -1.96]}>
        <boxGeometry args={[0.56, 0.12, 0.04]} />
        <meshBasicMaterial color="#fef08a" />
      </mesh>
      {/* Dual Exhaust Tips for Sedan & SUV */}
      {!isVan &&
        [-0.55, 0.55].map((ex) => (
          <mesh key={`exhaust-${ex}`} position={[ex, 0.16, -1.97]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.1} />
          </mesh>
        ))}
    </group>
  );
}

// Optimized Alloy Wheel with Zero-Rerender Direct Transforms
interface CarWheelProps {
  position: [number, number, number];
  isRightSide?: boolean;
  steerRef?: React.RefObject<THREE.Group>;
  spinRef?: React.RefObject<THREE.Group>;
}

function CarWheel({ position, isRightSide = false, steerRef, spinRef }: CarWheelProps) {
  return (
    <group ref={steerRef} position={position}>
      {/* Spinning Assembly */}
      <group ref={spinRef}>
        {/* Black Rubber Tire with Tread */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.34, 0.34, 0.25, 14]} />
          <meshStandardMaterial color="#111827" roughness={0.92} />
        </mesh>
        {/* Silver Diamond-Cut Alloy Rim Lip */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.24, 0.24, 0.252, 12]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.92} roughness={0.14} />
        </mesh>
        {/* 4-Spoke Metallic Alloy Spokes */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={`alloy-spoke-${i}`}
            rotation={[0, 0, (i * Math.PI) / 2]}
            position={[isRightSide ? 0.08 : -0.08, 0, 0]}
          >
            <boxGeometry args={[0.04, 0.22, 0.06]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.12} />
          </mesh>
        ))}
      </group>
      {/* Non-spinning Disc Brake Caliper */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.08, 0.1, 0.16]} />
        <meshStandardMaterial color="#dc2626" metalness={0.7} />
      </mesh>
    </group>
  );
}

// Fueling Attendant Holding Nozzle to Vehicle Fuel Flap
function FuelingAttendant({ position, isFueling }: { position: [number, number, number]; isFueling: boolean }) {
  return <FuelingAttendantCharacter position={position} isFueling={isFueling} />;
}

// Single Autonomous Driving Vehicle Instance (Proper Looping State Machine)
interface DrivingCarProps {
  color: string;
  type: 'sedan' | 'suv' | 'van';
  pathPoints: THREE.Vector3[];
  speed: number;
  stopAtProgress?: number;
  stopDuration?: number;
  initialDelay: number;
  fuelAttendantPos?: [number, number, number];
}

function DrivingCar({
  color,
  type,
  pathPoints,
  speed,
  stopAtProgress = 0,
  stopDuration = 0,
  initialDelay,
  fuelAttendantPos,
}: DrivingCarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [isBraking, setIsBraking] = useState(false);
  const [isFueling, setIsFueling] = useState(false);
  const wasBrakingRef = useRef(false);
  const wasFuelingRef = useRef(false);

  // Wheel refs for direct imperative transform without continuous React tree re-renders
  const flSteerRef = useRef<THREE.Group>(null);
  const frSteerRef = useRef<THREE.Group>(null);
  const flSpinRef = useRef<THREE.Group>(null);
  const frSpinRef = useRef<THREE.Group>(null);
  const rlSpinRef = useRef<THREE.Group>(null);
  const rrSpinRef = useRef<THREE.Group>(null);

  // Smooth CatmullRom 3D Spline Path
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  }, [pathPoints]);

  const stateRef = useRef({
    progress: 0,
    hasStoppedAtPump: false,
    isStopped: false,
    stopTimer: 0,
    delayTimer: initialDelay,
    currentSpeed: speed,
    wheelRotation: 0,
    prevAngle: 0,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;

    // Wait initial spawn / loop respawn delay
    if (s.delayTimer > 0) {
      s.delayTimer -= delta;
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    let shouldBrake = false;
    let shouldFuel = false;

    // Refueling Stop Logic (triggers only once per complete run)
    if (stopAtProgress > 0 && !s.hasStoppedAtPump) {
      const distToStop = stopAtProgress - s.progress;
      if (distToStop <= 0.008 && distToStop >= -0.015) {
        // Arrived at pump bay
        s.isStopped = true;
        s.currentSpeed = 0;
        shouldBrake = true;
        shouldFuel = true;
      } else if (distToStop > 0 && distToStop < 0.12) {
        // Smooth deceleration into pump bay
        shouldBrake = true;
        s.currentSpeed = Math.max(speed * 0.22, speed * (distToStop / 0.12));
      } else {
        shouldBrake = false;
        s.currentSpeed = speed;
      }
    } else if (!s.isStopped) {
      // Normal cruising or accelerating away
      s.currentSpeed = Math.min(speed, s.currentSpeed + speed * delta * 1.8);
      shouldBrake = false;
      shouldFuel = false;
    }

    if (s.isStopped) {
      s.stopTimer += delta;
      s.currentSpeed = 0;
      shouldBrake = true;
      shouldFuel = true;

      if (s.stopTimer >= stopDuration) {
        // Finished fueling, depart and resume loop
        s.isStopped = false;
        s.hasStoppedAtPump = true;
        s.stopTimer = 0;
        shouldFuel = false;
        shouldBrake = false;
      }
    }

    // Progress linear displacement along spline
    s.progress += s.currentSpeed * delta;
    s.wheelRotation += s.currentSpeed * delta * 14;

    // Loop completed: reset and queue for next loop cycle
    if (s.progress >= 1) {
      s.progress = 0;
      s.hasStoppedAtPump = false;
      s.isStopped = false;
      s.stopTimer = 0;
      s.currentSpeed = speed;
      s.delayTimer = Math.max(2.2, initialDelay * 0.65);
      groupRef.current.visible = false;
      return;
    }

    // Only trigger state updates on actual boolean transitions
    if (shouldBrake !== wasBrakingRef.current) {
      wasBrakingRef.current = shouldBrake;
      setIsBraking(shouldBrake);
    }
    if (shouldFuel !== wasFuelingRef.current) {
      wasFuelingRef.current = shouldFuel;
      setIsFueling(shouldFuel);
    }

    // Direct wheel rotation updates (zero React diff overhead)
    if (flSpinRef.current) flSpinRef.current.rotation.x = s.wheelRotation;
    if (frSpinRef.current) frSpinRef.current.rotation.x = s.wheelRotation;
    if (rlSpinRef.current) rlSpinRef.current.rotation.x = s.wheelRotation;
    if (rrSpinRef.current) rrSpinRef.current.rotation.x = s.wheelRotation;

    // Update position and tangent along the spline
    const pos = curve.getPointAt(Math.min(s.progress, 1));
    const tangent = curve.getTangentAt(Math.min(s.progress, 1)).normalize();

    groupRef.current.position.copy(pos);

    // Smooth heading angle with zero jitter
    const targetAngle = Math.atan2(tangent.x, tangent.z);
    groupRef.current.rotation.y = targetAngle;

    // Calculate front wheel steering delta & update directly
    const angleDelta = targetAngle - s.prevAngle;
    s.prevAngle = targetAngle;
    const steerAngle = THREE.MathUtils.clamp(angleDelta * 8, -0.45, 0.45);
    if (flSteerRef.current) flSteerRef.current.rotation.y = steerAngle;
    if (frSteerRef.current) frSteerRef.current.rotation.y = steerAngle;
  });

  return (
    <group>
      <group ref={groupRef}>
        <DetailedVehicleMesh
          color={color}
          type={type}
          braking={isBraking}
          hazardBlinking={isFueling}
        />
        {/* 4 Spinning Alloy Wheels with Steered Front Wheels (Direct ref transforms) */}
        <CarWheel position={[-0.92, 0.34, 1.15]} steerRef={flSteerRef} spinRef={flSpinRef} isRightSide={false} />
        <CarWheel position={[0.92, 0.34, 1.15]} steerRef={frSteerRef} spinRef={frSpinRef} isRightSide={true} />
        <CarWheel position={[-0.92, 0.34, -1.15]} spinRef={rlSpinRef} isRightSide={false} />
        <CarWheel position={[0.92, 0.34, -1.15]} spinRef={rrSpinRef} isRightSide={true} />
      </group>

      {/* Animated Attendant fueling at the pump */}
      {fuelAttendantPos && (
        <FuelingAttendant position={fuelAttendantPos} isFueling={isFueling} />
      )}
    </group>
  );
}

// Master Forecourt Traffic Scene
export function AdvancedVehicles() {
  // Path 1: Cobalt Blue Sports Sedan enters, pulls smoothly into Pump Bay 1, refuels, and exits
  const pathVehicle1 = useMemo(
    () => [
      new THREE.Vector3(26, 0.05, 22),
      new THREE.Vector3(14, 0.05, 22),
      new THREE.Vector3(4, 0.05, 20),
      new THREE.Vector3(-5, 0.05, 18),
      new THREE.Vector3(-5, 0.05, 15), // Refueling position at Pump 1
      new THREE.Vector3(-5, 0.05, 11),
      new THREE.Vector3(-10, 0.05, 13),
      new THREE.Vector3(-18, 0.05, 19),
      new THREE.Vector3(-26, 0.05, 22),
    ],
    []
  );

  // Path 2: Crimson Red Compact SUV pulls into Pump Bay 4, refuels, and exits
  const pathVehicle2 = useMemo(
    () => [
      new THREE.Vector3(26, 0.05, 18),
      new THREE.Vector3(16, 0.05, 18),
      new THREE.Vector3(8.5, 0.05, 18),
      new THREE.Vector3(8.5, 0.05, 15), // Refueling position at Pump 4
      new THREE.Vector3(8.5, 0.05, 11),
      new THREE.Vector3(2, 0.05, 10),
      new THREE.Vector3(-8, 0.05, 13),
      new THREE.Vector3(-18, 0.05, 16),
      new THREE.Vector3(-26, 0.05, 18),
    ],
    []
  );

  // Path 3: NIZA Commercial Fleet Van driving in to make a delivery stop
  const pathVehicle3 = useMemo(
    () => [
      new THREE.Vector3(26, 0.05, 24),
      new THREE.Vector3(12, 0.05, 24),
      new THREE.Vector3(-2, 0.05, 23),
      new THREE.Vector3(-14, 0.05, 19),
      new THREE.Vector3(-14, 0.05, 13), // Store delivery bay
      new THREE.Vector3(-14, 0.05, 9),
      new THREE.Vector3(-19, 0.05, 11),
      new THREE.Vector3(-26, 0.05, 15),
    ],
    []
  );

  // Path 4: Silver Sedan cruising past along the highway road
  const pathVehicle4 = useMemo(
    () => [
      new THREE.Vector3(27, 0.05, 23.5),
      new THREE.Vector3(14, 0.05, 23.5),
      new THREE.Vector3(0, 0.05, 23.5),
      new THREE.Vector3(-14, 0.05, 23.5),
      new THREE.Vector3(-27, 0.05, 23.5),
    ],
    []
  );

  return (
    <group>
      {/* 1. Cobalt Blue Sedan fueling at Pump 1 */}
      <DrivingCar
        color="#0284c7"
        type="sedan"
        pathPoints={pathVehicle1}
        speed={0.065}
        stopAtProgress={0.44}
        stopDuration={5.5}
        initialDelay={0.2}
        fuelAttendantPos={[-6.2, 0.05, 15]}
      />

      {/* 2. Crimson Red Compact SUV fueling at Pump 4 */}
      <DrivingCar
        color="#dc2626"
        type="suv"
        pathPoints={pathVehicle2}
        speed={0.06}
        stopAtProgress={0.46}
        stopDuration={5.0}
        initialDelay={4.5}
        fuelAttendantPos={[7.3, 0.05, 15]}
      />

      {/* 3. NIZA Fleet White Delivery Transit Van */}
      <DrivingCar
        color="#f8fafc"
        type="van"
        pathPoints={pathVehicle3}
        speed={0.055}
        stopAtProgress={0.48}
        stopDuration={6.5}
        initialDelay={9.0}
      />

      {/* 4. Silver Cruiser Sedan on Main Highway */}
      <DrivingCar
        color="#64748b"
        type="sedan"
        pathPoints={pathVehicle4}
        speed={0.075}
        initialDelay={2.0}
      />
    </group>
  );
}
