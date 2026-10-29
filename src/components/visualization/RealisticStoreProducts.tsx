import React from 'react';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';

// ---------------------------------------------------------------------------
// High-Performance Merchandised Supermarket Items
// Optimized for 60 FPS: zero micro-shadow passes, zero screen-space transmission,
// streamlined geometries.
// ---------------------------------------------------------------------------

// 1. Cereal / Cracker / Pasta Box
export function RealisticBoxProduct({
  brandColor,
  subColor = '#ffffff',
  accentColor = '#facc15',
  width = 0.22,
  height = 0.32,
  depth = 0.14,
}: {
  brandColor: string;
  title?: string;
  subColor?: string;
  accentColor?: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  return (
    <group position={[0, height / 2, 0]}>
      {/* Main Box */}
      <mesh>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={brandColor} roughness={0.55} />
      </mesh>
      {/* Front Face Graphic Banner */}
      <mesh position={[0, height * 0.1, depth / 2 + 0.002]}>
        <planeGeometry args={[width * 0.88, height * 0.5]} />
        <meshStandardMaterial color={subColor} roughness={0.4} />
      </mesh>
      {/* Accent Badge */}
      <mesh position={[0, -height * 0.22, depth / 2 + 0.003]}>
        <planeGeometry args={[width * 0.72, height * 0.18]} />
        <meshStandardMaterial color={accentColor} roughness={0.4} />
      </mesh>
    </group>
  );
}

// 2. Realistic Tin / Can
export function RealisticCanProduct({
  labelColor,
  labelStripe = '#ffffff',
  radius = 0.055,
  height = 0.16,
}: {
  labelColor: string;
  labelStripe?: string;
  radius?: number;
  height?: number;
}) {
  return (
    <group position={[0, height / 2, 0]}>
      {/* Can Body with Metallic Rim Style */}
      <mesh>
        <cylinderGeometry args={[radius, radius, height, 12]} />
        <meshStandardMaterial color={labelColor} roughness={0.4} />
      </mesh>
      {/* Top Metallic Lid Rim */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius * 0.98, radius * 0.98, 0.012, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Contrast Center Stripe */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[radius * 1.01, radius * 1.01, height * 0.35, 12]} />
        <meshStandardMaterial color={labelStripe} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 3. Realistic Snack Foil Bag
export function RealisticSnackBag({
  foilColor,
  accentColor = '#facc15',
  width = 0.2,
  height = 0.26,
  tilt = 0,
}: {
  foilColor: string;
  accentColor?: string;
  width?: number;
  height?: number;
  tilt?: number;
}) {
  return (
    <group position={[0, height / 2, 0]} rotation={[0, 0, tilt]}>
      {/* Puffed Foil Body */}
      <mesh>
        <boxGeometry args={[width, height * 0.85, 0.11]} />
        <meshStandardMaterial color={foilColor} metalness={0.65} roughness={0.3} />
      </mesh>
      {/* Center Brand Graphic */}
      <mesh position={[0, 0.01, 0.058]}>
        <planeGeometry args={[width * 0.75, height * 0.45]} />
        <meshStandardMaterial color={accentColor} roughness={0.3} />
      </mesh>
      {/* Top & Bottom Crimp Flanges */}
      <mesh position={[0, height / 2 - 0.008, 0]}>
        <boxGeometry args={[width * 1.02, 0.018, 0.018]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[0, -height / 2 + 0.008, 0]}>
        <boxGeometry args={[width * 1.02, 0.018, 0.018]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
}

// 4. Realistic Beverage Bottle (Lightweight Standard Material without costly physical transmission)
export function RealisticBottleProduct({
  liquidColor,
  capColor = '#dc2626',
  labelColor = '#ffffff',
  height = 0.28,
  radius = 0.05,
}: {
  liquidColor: string;
  capColor?: string;
  labelColor?: string;
  height?: number;
  radius?: number;
}) {
  return (
    <group position={[0, height / 2, 0]}>
      {/* Bottle Body */}
      <mesh position={[0, -height * 0.08, 0]}>
        <cylinderGeometry args={[radius * 0.85, radius, height * 0.68, 12]} />
        <meshStandardMaterial
          color={liquidColor}
          transparent
          opacity={0.85}
          roughness={0.15}
          metalness={0.1}
        />
      </mesh>
      {/* Paper Wrap Label */}
      <mesh position={[0, -height * 0.12, 0]}>
        <cylinderGeometry args={[radius * 1.02, radius * 1.02, height * 0.32, 12]} />
        <meshStandardMaterial color={labelColor} roughness={0.35} />
      </mesh>
      {/* Slender Bottle Neck & Cap */}
      <mesh position={[0, height * 0.34, 0]}>
        <cylinderGeometry args={[radius * 0.38, radius * 0.42, height * 0.18, 10]} />
        <meshStandardMaterial color={liquidColor} transparent opacity={0.85} roughness={0.1} />
      </mesh>
      <mesh position={[0, height * 0.46, 0]}>
        <cylinderGeometry args={[radius * 0.44, radius * 0.44, 0.035, 10]} />
        <meshStandardMaterial color={capColor} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 5. Juice / Milk Tetra Pak Carton
export function RealisticTetraPakCarton({
  bodyColor,
  capColor = '#2563eb',
  accentColor = '#f97316',
  width = 0.14,
  height = 0.26,
  depth = 0.13,
}: {
  bodyColor: string;
  capColor?: string;
  accentColor?: string;
  width?: number;
  height?: number;
  depth?: number;
}) {
  return (
    <group position={[0, height / 2, 0]}>
      {/* Carton Body */}
      <mesh>
        <boxGeometry args={[width, height * 0.88, depth]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      {/* Front Accent Graphic */}
      <mesh position={[0, 0, depth / 2 + 0.002]}>
        <planeGeometry args={[width * 0.82, height * 0.48]} />
        <meshStandardMaterial color={accentColor} roughness={0.35} />
      </mesh>
      {/* Gable Roof & Spout */}
      <mesh position={[0, height * 0.46, 0]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[width * 0.98, height * 0.12, depth * 0.8]} />
        <meshStandardMaterial color={bodyColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, height * 0.5, depth * 0.15]} rotation={[0.35, 0, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.025, 10]} />
        <meshStandardMaterial color={capColor} roughness={0.3} />
      </mesh>
    </group>
  );
}

// 6. Bakery & Fresh Produce Wooden Crates
export function RealisticBakeryCrate({
  position,
  type = 'baguette',
}: {
  position: [number, number, number];
  type?: 'baguette' | 'croissant' | 'apples' | 'oranges';
}) {
  return (
    <group position={position}>
      {/* Rustic Timber Display Box */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[0.55, 0.18, 0.42]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.49, 0.16, 0.36]} />
        <meshStandardMaterial color="#451a03" />
      </mesh>

      {type === 'baguette' && (
        <group position={[0, 0.18, 0]}>
          {[-0.12, -0.04, 0.04, 0.12].map((bx, idx) => (
            <mesh
              key={`baguette-${idx}`}
              position={[bx, 0.08, 0]}
              rotation={[0.3, idx * 0.1, -0.2 + idx * 0.1]}
            >
              <cylinderGeometry args={[0.038, 0.032, 0.54, 8]} />
              <meshStandardMaterial color="#d97706" roughness={0.85} />
            </mesh>
          ))}
        </group>
      )}

      {type === 'croissant' && (
        <group position={[0, 0.14, 0]}>
          {[-0.11, 0.11].map((cx) =>
            [-0.07, 0.07].map((cz, cidx) => (
              <mesh
                key={`croissant-${cx}-${cidx}`}
                position={[cx, 0.02, cz]}
                rotation={[0, cx + cz, 0]}
              >
                <torusGeometry args={[0.055, 0.032, 6, 8, Math.PI * 1.2]} />
                <meshStandardMaterial color="#f59e0b" roughness={0.7} />
              </mesh>
            ))
          )}
        </group>
      )}

      {type === 'apples' && (
        <group position={[0, 0.14, 0]}>
          {[-0.14, 0, 0.14].map((ax) =>
            [-0.08, 0.08].map((az, aidx) => (
              <mesh key={`apple-${ax}-${aidx}`} position={[ax, 0.02, az]}>
                <sphereGeometry args={[0.048, 8, 8]} />
                <meshStandardMaterial color="#16a34a" roughness={0.4} />
              </mesh>
            ))
          )}
        </group>
      )}

      {type === 'oranges' && (
        <group position={[0, 0.14, 0]}>
          {[-0.14, 0, 0.14].map((ax) =>
            [-0.08, 0.08].map((az, aidx) => (
              <mesh key={`orange-${ax}-${aidx}`} position={[ax, 0.02, az]}>
                <sphereGeometry args={[0.048, 8, 8]} />
                <meshStandardMaterial color="#ea580c" roughness={0.5} />
              </mesh>
            ))
          )}
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------
// High-Performance Gondola Shelving Unit (Zero Lag, Optimized Draw Calls)
// ---------------------------------------------------------------------------
interface RealisticGondolaProps {
  position: [number, number, number];
  category: string;
  theme: 'snacks' | 'pantry' | 'drinks' | 'fresh';
}

export function RealisticGondolaShelvingUnit({
  position,
  category,
  theme = 'pantry',
}: RealisticGondolaProps) {
  // 6 balanced columns per shelf (half the draw calls of 11, visually dense & authentic)
  const COL_POSITIONS = [-2.2, -1.3, -0.4, 0.5, 1.4, 2.3];

  return (
    <group position={position}>
      {/* 1. Heavy Industrial Steel Gondola Structure */}
      {/* Center Upright Backing Wall */}
      <mesh position={[0, 1.25, 0]} castShadow>
        <boxGeometry args={[1.3, 2.5, 6.4]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.2} roughness={0.6} />
      </mesh>
      {/* Steel Base Plinth */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[1.4, 0.2, 6.5]} />
        <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Category Signage Header */}
      <group position={[0, 2.55, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.32, 0.28, 6.42]} />
          <meshStandardMaterial color="#0f172a" roughness={0.5} />
        </mesh>
        <Billboard position={[0, 0, 0]}>
          <Text
            fontSize={0.2}
            color="#38bdf8"
            font={undefined}
            anchorX="center"
            anchorY="middle"
          >
            {category}
          </Text>
        </Billboard>
      </group>

      {/* 2. Shelves & Merchandising on Both Sides (-X and +X) */}
      {[-0.68, 0.68].map((sideX, sideIdx) => (
        <group key={`gondola-side-${sideX}`}>
          {/* 4 Tier Shelves */}
          {[0.35, 0.85, 1.35, 1.85].map((sy, tierIdx) => (
            <group key={`tier-${sideIdx}-${tierIdx}`} position={[sideX, sy, 0]}>
              {/* Galvanized Steel Shelf Plate */}
              <mesh position={[sideX > 0 ? 0.2 : -0.2, 0, 0]}>
                <boxGeometry args={[0.42, 0.035, 6.2]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.6} roughness={0.3} />
              </mesh>
              {/* Shelf Edge Scanner Rail */}
              <mesh position={[sideX > 0 ? 0.415 : -0.415, 0, 0]}>
                <boxGeometry args={[0.015, 0.045, 6.2]} />
                <meshStandardMaterial color="#dc2626" roughness={0.4} />
              </mesh>

              {/* Price Strip Tag Markers */}
              {[-1.8, 0, 1.8].map((tx) => (
                <mesh
                  key={`tag-${tx}`}
                  position={[sideX > 0 ? 0.425 : -0.425, -0.01, tx]}
                >
                  <planeGeometry args={[0.22, 0.05]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.3} />
                </mesh>
              ))}

              {/* Merchandised Products Across Shelf Length */}
              {COL_POSITIONS.map((pz, colIdx) => {
                const prodX = sideX > 0 ? 0.2 : -0.2;

                return (
                  <group key={`slot-${tierIdx}-${colIdx}`} position={[prodX, 0.02, pz]}>
                    {/* Pantry & Breakfast Gondola Theme */}
                    {theme === 'pantry' && (
                      <>
                        {tierIdx === 3 && (
                          <RealisticBoxProduct
                            brandColor={
                              ['#dc2626', '#eab308', '#2563eb', '#16a34a'][colIdx % 4]
                            }
                            accentColor={['#fde047', '#ef4444', '#f97316', '#ffffff'][colIdx % 4]}
                            width={0.22}
                            height={0.36}
                            depth={0.15}
                          />
                        )}
                        {tierIdx === 2 && (
                          <RealisticBoxProduct
                            brandColor={
                              ['#0284c7', '#ea580c', '#ca8a04', '#059669'][colIdx % 4]
                            }
                            accentColor="#ffffff"
                            width={0.2}
                            height={0.28}
                            depth={0.12}
                          />
                        )}
                        {tierIdx === 1 && (
                          <RealisticCanProduct
                            labelColor={
                              ['#0284c7', '#dc2626', '#16a34a', '#eab308'][colIdx % 4]
                            }
                            labelStripe="#f8fafc"
                            radius={0.06}
                            height={0.17}
                          />
                        )}
                        {tierIdx === 0 && (
                          <RealisticBottleProduct
                            liquidColor={
                              ['#eab308', '#78350f', '#dc2626', '#ca8a04'][colIdx % 4]
                            }
                            capColor={['#facc15', '#dc2626', '#16a34a', '#2563eb'][colIdx % 4]}
                            height={0.3}
                            radius={0.055}
                          />
                        )}
                      </>
                    )}

                    {/* Snacks & Confectionery Gondola Theme */}
                    {theme === 'snacks' && (
                      <>
                        {tierIdx >= 2 ? (
                          <RealisticSnackBag
                            foilColor={
                              ['#2563eb', '#dc2626', '#16a34a', '#eab308', '#9333ea', '#ea580c'][
                                colIdx % 6
                              ]
                            }
                            accentColor={
                              ['#facc15', '#ffffff', '#fde047', '#dc2626'][colIdx % 4]
                            }
                            tilt={colIdx % 2 === 0 ? 0.05 : -0.05}
                            width={0.22}
                            height={0.28}
                          />
                        ) : (
                          <RealisticBoxProduct
                            brandColor={
                              ['#7c2d12', '#1e3a8a', '#991b1b', '#065f46'][colIdx % 4]
                            }
                            accentColor="#facc15"
                            width={0.24}
                            height={0.2}
                            depth={0.16}
                          />
                        )}
                      </>
                    )}

                    {/* Beverage, Juice & Wine Theme */}
                    {theme === 'drinks' && (
                      <>
                        {tierIdx === 3 && (
                          <RealisticTetraPakCarton
                            bodyColor={
                              ['#ea580c', '#eab308', '#dc2626', '#16a34a'][colIdx % 4]
                            }
                            capColor="#2563eb"
                            accentColor="#ffffff"
                          />
                        )}
                        {tierIdx === 2 && (
                          <RealisticBottleProduct
                            liquidColor={
                              ['#f97316', '#3b82f6', '#10b981', '#ef4444'][colIdx % 4]
                            }
                            capColor="#ffffff"
                            height={0.26}
                            radius={0.048}
                          />
                        )}
                        {tierIdx === 1 && (
                          <RealisticCanProduct
                            labelColor={
                              ['#0f172a', '#1e293b', '#3b82f6', '#10b981'][colIdx % 4]
                            }
                            labelStripe="#f59e0b"
                            radius={0.05}
                            height={0.19}
                          />
                        )}
                        {tierIdx === 0 && (
                          <RealisticBottleProduct
                            liquidColor={
                              ['#581c87', '#7f1d1d', '#14532d', '#713f12'][colIdx % 4]
                            }
                            capColor="#ca8a04"
                            labelColor="#fef08a"
                            height={0.32}
                            radius={0.052}
                          />
                        )}
                      </>
                    )}

                    {/* Fresh Bakery & Fruit Theme */}
                    {theme === 'fresh' && (
                      <>
                        {tierIdx >= 2 ? (
                          <RealisticBakeryCrate
                            position={[0, 0, 0]}
                            type={colIdx % 2 === 0 ? 'baguette' : 'croissant'}
                          />
                        ) : (
                          <RealisticBakeryCrate
                            position={[0, 0, 0]}
                            type={colIdx % 2 === 0 ? 'apples' : 'oranges'}
                          />
                        )}
                      </>
                    )}
                  </group>
                );
              })}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
