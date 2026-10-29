import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface VehicleProps {
  color: string;
  cabinColor?: string;
  type?: 'sedan' | 'suv' | 'van';
  pathPoints: THREE.Vector3[];
  speed?: number;
  stopAtProgress?: number;
  stopDuration?: number;
  initialDelay?: number;
}

function AnimatedVehicle({
  color,
  cabinColor = '#0f172a',
  type = 'sedan',
  pathPoints,
  speed = 0.05,
  stopAtProgress = 0.45,
  stopDuration = 4.0,
  initialDelay = 0,
}: VehicleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const wheelsRef = useRef<THREE.Mesh[]>([]);

  // Create smooth CatmullRom spline path
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3(pathPoints, false, 'centripetal', 0.5);
  }, [pathPoints]);

  const stateRef = useRef({
    progress: 0,
    isStopped: false,
    stopTimer: 0,
    delayTimer: initialDelay,
    currentSpeed: speed,
    wheelAngle: 0,
  });

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const s = stateRef.current;

    // Handle initial spawn delay
    if (s.delayTimer > 0) {
      s.delayTimer -= delta;
      groupRef.current.visible = false;
      return;
    }
    groupRef.current.visible = true;

    // Handle stopping at fuel pump
    if (s.isStopped) {
      s.stopTimer += delta;
      s.currentSpeed = 0;
      if (s.stopTimer >= stopDuration) {
        s.isStopped = false;
        s.stopTimer = 0;
      }
    } else {
      // Check if approaching fuel stop point
      const distToStop = Math.abs(s.progress - stopAtProgress);
      if (distToStop < 0.015 && s.stopTimer === 0) {
        s.isStopped = true;
      } else if (distToStop < 0.08) {
        // Slow down smoothly when approaching pump
        s.currentSpeed = Math.max(speed * 0.35, speed * (distToStop / 0.08));
      } else {
        // Normal cruising speed
        s.currentSpeed = speed;
      }

      s.progress += s.currentSpeed * delta;
      if (s.progress >= 1) {
        s.progress = 0;
        s.delayTimer = 2.0; // Wait 2s before next vehicle loop
        groupRef.current.visible = false;
        return;
      }
    }

    // Calculate position & tangent on curve
    const currentPos = curve.getPointAt(Math.min(s.progress, 1));
    const tangent = curve.getTangentAt(Math.min(s.progress, 1)).normalize();

    groupRef.current.position.copy(currentPos);

    // Calculate heading angle for smooth steering
    const targetAngle = Math.atan2(tangent.x, tangent.z);
    groupRef.current.rotation.y = targetAngle;

    // Rotate wheels based on motion
    s.wheelAngle += s.currentSpeed * delta * 25;
    wheelsRef.current.forEach((wheel) => {
      if (wheel) {
        wheel.rotation.x = s.wheelAngle;
      }
    });
  });

  const isVan = type === 'van';
  const isSuv = type === 'suv';

  return (
    <group ref={groupRef} castShadow>
      {/* Chassis Body */}
      <mesh position={[0, isVan ? 0.85 : 0.65, 0]} castShadow>
        <boxGeometry args={[1.8, isVan ? 1.1 : 0.6, isVan ? 4.2 : 3.6]} />
        <meshStandardMaterial color={color} metalness={0.5} roughness={0.2} />
      </mesh>

      {/* Cabin & Tinted Windows */}
      {!isVan ? (
        <mesh position={[0, isSuv ? 1.25 : 1.15, -0.2]} castShadow>
          <boxGeometry args={[1.5, isSuv ? 0.75 : 0.6, 2.0]} />
          <meshStandardMaterial color={cabinColor} roughness={0.1} />
        </mesh>
      ) : (
        /* Van Windshield */
        <mesh position={[0, 1.25, 1.2]} rotation={[0.2, 0, 0]} castShadow>
          <boxGeometry args={[1.6, 0.6, 0.8]} />
          <meshStandardMaterial color={cabinColor} roughness={0.1} />
        </mesh>
      )}

      {/* Glowing Headlights (Front) */}
      {[-0.65, 0.65].map((hx) => (
        <group key={`hl-${hx}`} position={[hx, isVan ? 0.6 : 0.45, isVan ? 2.12 : 1.82]}>
          <mesh>
            <boxGeometry args={[0.25, 0.15, 0.05]} />
            <meshStandardMaterial color="#ffffff" emissive="#fef08a" emissiveIntensity={1.2} />
          </mesh>
        </group>
      ))}

      {/* Taillights / Brake Lights (Rear) */}
      {[-0.65, 0.65].map((tx) => (
        <mesh key={`tl-${tx}`} position={[tx, isVan ? 0.6 : 0.45, isVan ? -2.12 : -1.82]}>
          <boxGeometry args={[0.25, 0.15, 0.05]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.8} />
        </mesh>
      ))}

      {/* 4 Wheels */}
      {[-0.92, 0.92].map((wx) =>
        [-1.1, 1.1].map((wz, widx) => (
          <group
            key={`wheel-grp-${wx}-${widx}`}
            position={[wx, 0.32, wz]}
            rotation={[0, wx > 0 ? 0 : Math.PI, 0]}
          >
            <mesh
              ref={(el) => {
                if (el && !wheelsRef.current.includes(el)) wheelsRef.current.push(el);
              }}
              castShadow
            >
              <cylinderGeometry args={[0.32, 0.32, 0.22, 16]} rotation={[0, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#111827" roughness={0.9} />
            </mesh>
          </group>
        ))
      )}
    </group>
  );
}

export function ForecourtTraffic() {
  // Vehicle 1 Path: Enters from right roadway, pulls into Pump Lane 1 (Pump 1), fuels up, and exits
  const pathVehicle1 = useMemo(() => [
    new THREE.Vector3(16, 0.05, 12),
    new THREE.Vector3(8, 0.05, 12),
    new THREE.Vector3(2, 0.05, 11),
    new THREE.Vector3(-2.2, 0.05, 8.5),
    new THREE.Vector3(-2.2, 0.05, 5.5), // Refueling position at Pump 1
    new THREE.Vector3(-2.2, 0.05, 2.5),
    new THREE.Vector3(-6, 0.05, 4),
    new THREE.Vector3(-11, 0.05, 9),
    new THREE.Vector3(-16, 0.05, 12),
  ], []);

  // Vehicle 2 Path: Enters, drives into Pump Lane 2 (Pump 4), fuels up, and exits
  const pathVehicle2 = useMemo(() => [
    new THREE.Vector3(16, 0.05, 9),
    new THREE.Vector3(9, 0.05, 9),
    new THREE.Vector3(5.8, 0.05, 9),
    new THREE.Vector3(5.8, 0.05, 6.5), // Refueling position at Pump 4
    new THREE.Vector3(5.8, 0.05, 3.5),
    new THREE.Vector3(3, 0.05, 2),
    new THREE.Vector3(-3, 0.05, 3),
    new THREE.Vector3(-10, 0.05, 7),
    new THREE.Vector3(-16, 0.05, 9),
  ], []);

  // Vehicle 3 Path: White Delivery Van driving in to service the store & forecourt
  const pathVehicle3 = useMemo(() => [
    new THREE.Vector3(16, 0.05, 14),
    new THREE.Vector3(6, 0.05, 14),
    new THREE.Vector3(-1, 0.05, 13),
    new THREE.Vector3(-7, 0.05, 11),
    new THREE.Vector3(-7, 0.05, 7), // Delivery unloading spot
    new THREE.Vector3(-7, 0.05, 4),
    new THREE.Vector3(-10, 0.05, 4),
    new THREE.Vector3(-16, 0.05, 6),
  ], []);

  return (
    <group>
      {/* Vehicle 1: Electric Blue Modern SUV */}
      <AnimatedVehicle
        color="#0284c7"
        type="suv"
        pathPoints={pathVehicle1}
        speed={0.07}
        stopAtProgress={0.44}
        stopDuration={5.0}
        initialDelay={0.5}
      />

      {/* Vehicle 2: High-Visibility Yellow Hatchback / Taxi */}
      <AnimatedVehicle
        color="#eab308"
        type="sedan"
        pathPoints={pathVehicle2}
        speed={0.065}
        stopAtProgress={0.46}
        stopDuration={4.5}
        initialDelay={4.0}
      />

      {/* Vehicle 3: White Delivery Van */}
      <AnimatedVehicle
        color="#f8fafc"
        type="van"
        pathPoints={pathVehicle3}
        speed={0.055}
        stopAtProgress={0.48}
        stopDuration={6.0}
        initialDelay={8.0}
      />
    </group>
  );
}
