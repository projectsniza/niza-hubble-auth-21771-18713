import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { ZONE_CAMERA_TARGETS } from './ForecourtStoreScene';

interface CameraControllerProps {
  focusedZone: string | null;
  controlsRef: React.RefObject<any>;
}

export function CameraController({ focusedZone, controlsRef }: CameraControllerProps) {
  const { camera } = useThree();
  const isTransitioningRef = useRef(false);
  const targetCamPos = useRef(new THREE.Vector3(46, 38, 46));
  const targetLookAt = useRef(new THREE.Vector3(0, 2, 4));

  useEffect(() => {
    const config = focusedZone
      ? ZONE_CAMERA_TARGETS[focusedZone] || ZONE_CAMERA_TARGETS.overview
      : ZONE_CAMERA_TARGETS.overview;

    targetCamPos.current.set(...config.position);
    targetLookAt.current.set(...config.target);
    isTransitioningRef.current = true;
  }, [focusedZone]);

  // When user interacts (mouse wheel zoom, drag), immediately hand over full control to OrbitControls
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const handleUserInteraction = () => {
      isTransitioningRef.current = false;
    };

    controls.addEventListener('start', handleUserInteraction);
    return () => {
      controls.removeEventListener('start', handleUserInteraction);
    };
  }, [controlsRef]);

  useFrame((_, delta) => {
    if (!isTransitioningRef.current || !controlsRef.current) return;

    const step = Math.min(delta * 4, 1);
    camera.position.lerp(targetCamPos.current, step);
    controlsRef.current.target.lerp(targetLookAt.current, step);
    controlsRef.current.update();

    // Check if smoothly arrived at target
    if (
      camera.position.distanceTo(targetCamPos.current) < 0.1 &&
      controlsRef.current.target.distanceTo(targetLookAt.current) < 0.1
    ) {
      isTransitioningRef.current = false;
    }
  });

  return null;
}
