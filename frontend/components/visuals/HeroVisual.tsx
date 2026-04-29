"use client";

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Sphere, MeshDistortMaterial, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

function AnimatedNode() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use useMemo for geometry to prevent re-creation
  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < 50; i++) {
      const t = Math.random() * Math.PI * 2;
      const u = Math.random() * Math.PI * 2;
      const x = Math.cos(t) * Math.sin(u) * 2;
      const y = Math.sin(t) * Math.sin(u) * 2;
      const z = Math.cos(u) * 2;
      temp.push(new THREE.Vector3(x, y, z));
    }
    return temp;
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.getElapsedTime() * 0.2;
      meshRef.current.rotation.y = state.clock.getElapsedTime() * 0.3;
    }
  });

  return (
    <group>
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <Sphere args={[1.5, 64, 64]} ref={meshRef}>
          <MeshDistortMaterial
            color="#ee8326"
            attach="material"
            distort={0.4}
            speed={2}
            roughness={0.2}
            metalness={0.8}
            emissive="#ee8326"
            emissiveIntensity={0.5}
          />
        </Sphere>
      </Float>
      
      {/* Orbital Particles */}
      {particles.map((pos, i) => (
        <Float key={i} speed={3} rotationIntensity={2} floatIntensity={1}>
          <mesh position={pos}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#374175" emissive="#374175" emissiveIntensity={2} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

export default function HeroVisual() {
  return (
    <div className="absolute inset-0 z-0 opacity-40 pointer-events-none">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 5]} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ee8326" />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#374175" />
        <spotLight position={[0, 5, 0]} intensity={1.5} angle={0.3} penumbra={1} castShadow />
        <AnimatedNode />
      </Canvas>
    </div>
  );
}
