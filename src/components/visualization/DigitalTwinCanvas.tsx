import React, { Suspense, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { ForecourtStoreScene } from './ForecourtStoreScene';
import { CameraController } from './CameraController';
import { ZoneDataMap } from './useDigitalTwinData';

interface DigitalTwinCanvasProps {
  focusedZone: string | null;
  onSelectZone: (zoneId: string) => void;
  metrics: ZoneDataMap;
  pulseTriggeredZones: Record<string, boolean>;
}

export function DigitalTwinCanvas({
  focusedZone,
  onSelectZone,
  metrics,
  pulseTriggeredZones,
}: DigitalTwinCanvasProps) {
  const controlsRef = useRef<any>(null);

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        shadows
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        camera={{ position: [46, 38, 46], fov: 38, near: 0.5, far: 500 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.12,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
        className="w-full h-full bg-slate-950"
      >
        <color attach="background" args={['#080c14']} />

        {/* Ambient & Directional Sun Lighting (Optimized Shadow Map) */}
        <ambientLight intensity={0.45} color="#e0f2fe" />
        <directionalLight
          position={[38, 52, 28]}
          intensity={1.85}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-36}
          shadow-camera-right={36}
          shadow-camera-top={36}
          shadow-camera-bottom={-36}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-bias={-0.00015}
          color="#fffbeb"
        />
        {/* Cool Azure Sky Fill Light */}
        <directionalLight position={[-28, 32, -24]} intensity={0.55} color="#7dd3fc" />
        {/* Warm Ground Bounce Light */}
        <hemisphereLight groundColor="#0f172a" color="#fef3c7" intensity={0.4} />

        {/* Optimized Ground Contact Shadow (baked in frame 1) */}
        <ContactShadows
          position={[0, 0.04, 4]}
          opacity={0.65}
          scale={68}
          blur={1.4}
          far={10}
          resolution={512}
          frames={1}
          color="#020617"
        />

        <Suspense fallback={null}>
          <CameraController focusedZone={focusedZone} controlsRef={controlsRef} />
          <ForecourtStoreScene
            focusedZone={focusedZone}
            onSelectZone={onSelectZone}
            metrics={metrics}
            pulseTriggeredZones={pulseTriggeredZones}
          />
        </Suspense>

        {/* OrbitControls with expanded zoom range for the grand diorama */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={6}
          maxDistance={120}
          enableZoom={true}
          zoomSpeed={1.3}
          enablePan={true}
          enableRotate={true}
        />
      </Canvas>
    </div>
  );
}
