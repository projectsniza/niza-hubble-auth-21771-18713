import React, { Suspense } from 'react';
import { Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import nizaGroupIcon from '@/assets/niza-group-icon.png';

interface ForecourtTotemProps {
  position: [number, number, number];
  rotation?: [number, number, number];
  branchName?: string;
}

// Crisp NIZA Brand Logo Icon on Illuminated Acrylic Header
function TotemLogoBadge() {
  const logoTexture = useTexture(nizaGroupIcon);
  return (
    <mesh position={[0, 6.78, 0.17]}>
      <planeGeometry args={[0.75, 0.75]} />
      <meshBasicMaterial map={logoTexture} transparent />
    </mesh>
  );
}

// Digital Price Matrix & Branding Face (Flat on totem surface to eliminate clipping)
function TotemFace({ zOffset = 0 }: { zOffset?: number }) {
  return (
    <group position={[0, 0, zOffset]}>
      {/* 1. NIZA Brand Header (Logo Icon & Clean Typography) */}
      <Suspense fallback={null}>
        <TotemLogoBadge />
      </Suspense>
      <Text
        fontSize={0.28}
        color="#ffffff"
        font={undefined}
        position={[0, 6.22, 0.17]}
        anchorX="center"
        anchorY="middle"
      >
        NIZA
      </Text>

      {/* 2. LED Price Display Screen Bezel */}
      <mesh position={[0, 4.4, 0.165]}>
        <planeGeometry args={[1.92, 3.0]} />
        <meshBasicMaterial color="#020617" />
      </mesh>

      {/* Row 1: Unleaded E10 */}
      <group position={[0, 5.35, 0.17]}>
        <mesh position={[-0.72, 0, 0]}>
          <planeGeometry args={[0.38, 0.22]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <Text fontSize={0.12} color="#020617" position={[-0.72, 0, 0.005]} anchorX="center" anchorY="middle">
          E10
        </Text>
        <Text fontSize={0.15} color="#94a3b8" position={[-0.45, 0, 0]} anchorX="left" anchorY="middle">
          UNLEADED
        </Text>
        <Text fontSize={0.24} color="#4ade80" position={[0.82, 0, 0]} anchorX="right" anchorY="middle">
          138.9p
        </Text>
      </group>

      {/* Divider */}
      <mesh position={[0, 4.95, 0.17]}>
        <planeGeometry args={[1.8, 0.015]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>

      {/* Row 2: Diesel B7 */}
      <group position={[0, 4.55, 0.17]}>
        <mesh position={[-0.72, 0, 0]}>
          <planeGeometry args={[0.38, 0.22]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
        <Text fontSize={0.12} color="#ffffff" position={[-0.72, 0, 0.005]} anchorX="center" anchorY="middle">
          B7
        </Text>
        <Text fontSize={0.15} color="#94a3b8" position={[-0.45, 0, 0]} anchorX="left" anchorY="middle">
          DIESEL
        </Text>
        <Text fontSize={0.24} color="#38bdf8" position={[0.82, 0, 0]} anchorX="right" anchorY="middle">
          144.9p
        </Text>
      </group>

      {/* Divider */}
      <mesh position={[0, 4.15, 0.17]}>
        <planeGeometry args={[1.8, 0.015]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>

      {/* Row 3: Super V-Power */}
      <group position={[0, 3.75, 0.17]}>
        <mesh position={[-0.68, 0, 0]}>
          <planeGeometry args={[0.48, 0.22]} />
          <meshBasicMaterial color="#dc2626" />
        </mesh>
        <Text fontSize={0.10} color="#ffffff" position={[-0.68, 0, 0.005]} anchorX="center" anchorY="middle">
          V-POWER
        </Text>
        <Text fontSize={0.15} color="#94a3b8" position={[-0.38, 0, 0]} anchorX="left" anchorY="middle">
          SUPER
        </Text>
        <Text fontSize={0.24} color="#facc15" position={[0.82, 0, 0]} anchorX="right" anchorY="middle">
          154.9p
        </Text>
      </group>

      {/* Divider */}
      <mesh position={[0, 3.35, 0.17]}>
        <planeGeometry args={[1.8, 0.015]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>

      {/* Row 4: 24/7 Amenities Strip */}
      <group position={[0, 2.7, 0.17]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[1.92, 0.45]} />
          <meshStandardMaterial color="#064e3b" emissive="#10b981" emissiveIntensity={0.35} />
        </mesh>
        <Text fontSize={0.12} color="#ffffff" position={[0, 0, 0.01]} anchorX="center" anchorY="middle">
          24 HOURS • COSTA • SHOP • LOTTERY
        </Text>
      </group>
    </group>
  );
}

// Modern High-Fidelity Forecourt Totem Tower
export function ForecourtTotem({
  position,
  rotation = [0, Math.PI / 4.2, 0],
}: ForecourtTotemProps) {
  return (
    <group position={position} rotation={rotation}>
      {/* 1. Concrete Ground Base Plinth */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[2.5, 0.6, 0.65]} />
        <meshStandardMaterial color="#1e293b" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[2.52, 0.06, 0.67]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* 2. Main Pylon Tower Body (Aerodynamic Midnight Pylon) */}
      <mesh position={[0, 4.0, 0]}>
        <boxGeometry args={[2.2, 6.8, 0.32]} />
        <meshStandardMaterial color="#090d16" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* 3. Aerodynamic Brushed Aluminum Side Pylons / Vertical Trim */}
      {[-1.12, 1.12].map((sx) => (
        <group key={`trim-${sx}`} position={[sx, 4.0, 0]}>
          <mesh>
            <boxGeometry args={[0.06, 6.82, 0.36]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.15} />
          </mesh>
          {/* Subtle Emerald Accent Pinstripe */}
          <mesh position={[sx > 0 ? -0.01 : 0.01, 0, 0.185]}>
            <boxGeometry args={[0.02, 6.8, 0.02]} />
            <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.7} />
          </mesh>
        </group>
      ))}

      {/* 4. Top Arched Emerald Brand Crown */}
      <mesh position={[0, 6.6, 0]}>
        <boxGeometry args={[2.24, 1.4, 0.34]} />
        <meshStandardMaterial color="#064e3b" roughness={0.4} />
      </mesh>
      {/* Crown Glowing Border Frame */}
      <mesh position={[0, 7.28, 0]}>
        <boxGeometry args={[2.26, 0.06, 0.36]} />
        <meshStandardMaterial color="#2fad87" emissive="#10b981" emissiveIntensity={0.8} />
      </mesh>

      {/* Front Face Display with NIZA Logo & Digital Prices */}
      <TotemFace zOffset={0} />
    </group>
  );
}
