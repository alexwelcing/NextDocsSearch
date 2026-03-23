/**
 * CrashCat Physics Integration
 * Physics world provider for 3D rooms
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as CrashCat from 'crashcat';
import { useRoomStore } from '@/lib/rooms/store';
import { Vec3 } from 'navcat';

// =============================================================================
// PHYSICS CONTEXT
// =============================================================================

interface PhysicsContextType {
  world: CrashCat.World | null;
  registerBody: (id: string, body: CrashCat.RigidBody) => void;
  unregisterBody: (id: string) => void;
  raycast: (from: Vec3, to: Vec3) => CrashCat.CollideShapeHit | null;
}

const PhysicsContext = React.createContext<PhysicsContextType>({
  world: null,
  registerBody: () => {},
  unregisterBody: () => {},
  raycast: () => null,
});

export const usePhysics = () => React.useContext(PhysicsContext);

// =============================================================================
// PHYSICS WORLD PROVIDER
// =============================================================================

interface PhysicsWorldProps {
  children: React.ReactNode;
  gravity?: [number, number, number];
  enabled?: boolean;
}

export const PhysicsWorld: React.FC<PhysicsWorldProps> = ({
  children,
  gravity = [0, -9.81, 0],
  enabled = true,
}) => {
  const worldRef = useRef<CrashCat.World | null>(null);
  const bodiesRef = useRef<Map<string, CrashCat.RigidBody>>(new Map());
  const [isReady, setIsReady] = React.useState(false);
  
  // Initialize physics world
  useEffect(() => {
    if (!enabled) return;
    
    // Register all shapes
    CrashCat.registerAll();
    
    // Create world settings
    const worldSettings = CrashCat.createWorldSettings();
    worldSettings.gravity = gravity;
    
    // Create broadphase layers
    const BROADPHASE_LAYER_MOVING = CrashCat.addBroadphaseLayer(worldSettings);
    const BROADPHASE_LAYER_NOT_MOVING = CrashCat.addBroadphaseLayer(worldSettings);
    
    // Create object layers
    const OBJECT_LAYER_MOVING = CrashCat.addObjectLayer(worldSettings, BROADPHASE_LAYER_MOVING);
    const OBJECT_LAYER_NOT_MOVING = CrashCat.addObjectLayer(worldSettings, BROADPHASE_LAYER_NOT_MOVING);
    
    // Enable collisions
    CrashCat.enableCollision(worldSettings, OBJECT_LAYER_MOVING, OBJECT_LAYER_NOT_MOVING);
    CrashCat.enableCollision(worldSettings, OBJECT_LAYER_MOVING, OBJECT_LAYER_MOVING);
    
    // Create world
    const world = CrashCat.createWorld(worldSettings);
    worldRef.current = world;
    
    setIsReady(true);
    
    return () => {
      // Cleanup physics world
      worldRef.current = null;
      bodiesRef.current.clear();
    };
  }, [enabled, gravity]);
  
  // Physics step
  useFrame((_, delta) => {
    if (!worldRef.current || !enabled) return;
    
    // Use fixed timestep for stability
    const PHYSICS_DT = 1 / 60;
    const maxSteps = 3;
    let steps = 0;
    
    // Accumulate time and step physics
    while (delta > 0 && steps < maxSteps) {
      const step = Math.min(delta, PHYSICS_DT);
      CrashCat.updateWorld(worldRef.current, undefined, step);
      delta -= step;
      steps++;
    }
  });
  
  // Register body
  const registerBody = useCallback((id: string, body: CrashCat.RigidBody) => {
    bodiesRef.current.set(id, body);
  }, []);
  
  // Unregister body
  const unregisterBody = useCallback((id: string) => {
    const body = bodiesRef.current.get(id);
    if (body && worldRef.current) {
      CrashCat.rigidBody.remove(worldRef.current, body);
    }
    bodiesRef.current.delete(id);
  }, []);
  
  // Raycast
  const raycast = useCallback((from: Vec3, to: Vec3): any | null => {
    if (!worldRef.current) return null;
    
    const direction: Vec3 = [
      to[0] - from[0],
      to[1] - from[1],
      to[2] - from[2],
    ];
    const length = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
    
    if (length === 0) return null;
    
    const normalizedDirection: Vec3 = [
      direction[0] / length,
      direction[1] / length,
      direction[2] / length,
    ];
    
    // Create query filter
    const queryFilter = CrashCat.filter.create(worldRef.current.settings.layers);
    
    // Cast ray
    const collector = CrashCat.createClosestCastRayCollector();
    const settings = CrashCat.createDefaultCastRaySettings();
    
    CrashCat.castRay(
      worldRef.current,
      collector,
      settings,
      from,
      normalizedDirection,
      length,
      queryFilter
    );
    
    if (collector.hit.status === CrashCat.CastRayStatus.COLLIDING) {
      return collector.hit;
    }
    
    return null;
  }, []);
  
  return (
    <PhysicsContext.Provider
      value={{
        world: worldRef.current,
        registerBody,
        unregisterBody,
        raycast,
      }}
    >
      {children}
    </PhysicsContext.Provider>
  );
};

// =============================================================================
// PHYSICS BODY COMPONENT
// =============================================================================

interface PhysicsBodyProps {
  id: string;
  shape: 'box' | 'sphere' | 'capsule';
  position: [number, number, number];
  rotation?: [number, number, number, number];
  size?: [number, number, number];
  radius?: number;
  motionType: 'static' | 'dynamic' | 'kinematic';
  mass?: number;
  friction?: number;
  restitution?: number;
  children?: React.ReactNode;
  onCollision?: (otherId: string) => void;
}

export const PhysicsBody: React.FC<PhysicsBodyProps> = ({
  id,
  shape,
  position,
  rotation = [0, 0, 0, 1],
  size,
  radius,
  motionType,
  mass = 1,
  friction = 0.5,
  restitution = 0.3,
  children,
}) => {
  const { world, registerBody, unregisterBody } = usePhysics();
  const bodyRef = useRef<CrashCat.RigidBody | null>(null);
  
  useEffect(() => {
    if (!world) return;
    
    // Create shape
    let physicsShape: CrashCat.Shape;
    
    switch (shape) {
      case 'box':
        physicsShape = CrashCat.box.create({
          halfExtents: size ? [size[0] / 2, size[1] / 2, size[2] / 2] : [0.5, 0.5, 0.5],
        });
        break;
      case 'sphere':
        physicsShape = CrashCat.sphere.create({
          radius: radius ?? 0.5,
        });
        break;
      case 'capsule':
        physicsShape = CrashCat.capsule.create({
          halfHeightOfCylinder: size ? size[1] / 2 - (radius ?? 0.5) : 0.5,
          radius: radius ?? 0.5,
        });
        break;
      default:
        physicsShape = CrashCat.box.create({ halfExtents: [0.5, 0.5, 0.5] });
    }
    
    // Map motion type
    const motionTypeMap: Record<string, CrashCat.MotionType> = {
      static: CrashCat.MotionType.STATIC,
      dynamic: CrashCat.MotionType.DYNAMIC,
      kinematic: CrashCat.MotionType.KINEMATIC,
    };
    
    // Create body
    const body = CrashCat.rigidBody.create(world, {
      shape: physicsShape,
      motionType: motionTypeMap[motionType] ?? CrashCat.MotionType.DYNAMIC,
      objectLayer: motionType === 'dynamic' ? 0 : 1,
      position,
      ...(mass && motionType === 'dynamic' ? { mass } : {}),
      friction,
      restitution,
    });
    
    bodyRef.current = body;
    registerBody(id, body);
    
    return () => {
      unregisterBody(id);
      bodyRef.current = null;
    };
  }, [world, id, shape, motionType, registerBody, unregisterBody]);
  
  // Update transform
  useEffect(() => {
    if (!bodyRef.current || !world) return;
    
    CrashCat.rigidBody.setPosition(world, bodyRef.current, position, false);
  }, [world, position]);
  
  return <>{children}</>;
};

// =============================================================================
// PLAYER CONTROLLER
// =============================================================================

interface PlayerControllerProps {
  spawnPosition?: [number, number, number];
  speed?: number;
  jumpForce?: number;
}

export const PlayerController: React.FC<PlayerControllerProps> = ({
  spawnPosition = [0, 2, 0],
  speed = 5,
  jumpForce = 8,
}) => {
  const { world, raycast } = usePhysics();
  const bodyRef = useRef<CrashCat.RigidBody | null>(null);
  const isGroundedRef = useRef(false);
  
  useEffect(() => {
    if (!world) return;
    
    // Create player capsule
    const shape = CrashCat.capsule.create({
      halfHeightOfCylinder: 0.8,
      radius: 0.3,
    });
    
    const body = CrashCat.rigidBody.create(world, {
      shape,
      motionType: CrashCat.MotionType.DYNAMIC,
      objectLayer: 0,
      position: spawnPosition,
      mass: 70, // kg
      friction: 0.3,
      restitution: 0,
      linearDamping: 0.5,
      maxLinearVelocity: 10,
    });
    
    bodyRef.current = body;
    
    // Lock rotation (character stays upright)
    body.motionProperties.allowedDegreesOfFreedom = CrashCat.dof(true, true, true, false, false, false);
    
    return () => {
      if (body) {
        CrashCat.rigidBody.remove(world, body);
      }
    };
  }, [world, spawnPosition]);
  
  // Ground check
  useFrame(() => {
    if (!bodyRef.current) return;
    
    const position = bodyRef.current.position;
    const groundCheckStart: Vec3 = [position[0], position[1] - 1.0, position[2]];
    const groundCheckEnd: Vec3 = [position[0], position[1] - 1.2, position[2]];
    
    const hit = raycast(groundCheckStart, groundCheckEnd);
    isGroundedRef.current = hit !== null;
  });
  
  // Movement input handling (simplified - would connect to input system)
  const move = useCallback((direction: [number, number, number]) => {
    if (!bodyRef.current || !world) return;
    
    const force: Vec3 = [
      direction[0] * speed * 10,
      0,
      direction[2] * speed * 10,
    ];
    
    CrashCat.rigidBody.addForce(world, bodyRef.current, force, true);
  }, [world, speed]);
  
  const jump = useCallback(() => {
    if (!bodyRef.current || !world || !isGroundedRef.current) return;
    
    const impulse: Vec3 = [0, jumpForce * 70, 0]; // mass * velocity
    CrashCat.rigidBody.addImpulse(world, bodyRef.current, impulse);
  }, [world, jumpForce]);
  
  return null; // Invisible controller, just manages physics
};

export default PhysicsWorld;
