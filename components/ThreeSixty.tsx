import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ThreeSixtyView: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return; // Ensure the ref is available.

        const width = mountRef.current?.clientWidth || 0;  // null check added here
        const height = mountRef.current?.clientHeight || 0;  // null check added here


        // Set up the scene, camera, and renderer.
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        mountRef.current.appendChild(renderer.domElement);

        // Set up the 360-degree sphere.
        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1); // Flip the geometry on the x-axis to ensure the photo isn't mirrored.

        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load('/scifi1.jpg');
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const sphere = new THREE.Mesh(geometry, material);
        scene.add(sphere);

        // Adjust the camera position.
        camera.position.set(0, 0, 5); // Tiny offset to prevent artifacts.

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false; // Disable zooming if not needed.
        controls.minPolarAngle = Math.PI / 4;  // This is 45 degrees from the bottom
        controls.maxPolarAngle = 3 * Math.PI / 4;  // This is 45 degrees from the top
        controls.enableRotate = true;
        const animate = () => {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        // Handle resize events.
        const handleResize = () => {
            const width = mountRef.current?.clientWidth || 0;  // null check added here
            const height = mountRef.current?.clientHeight || 0;  // null check added here
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
          };
        window.addEventListener('resize', handleResize);

        // Cleanup on component unmount.
        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    }, []);

    return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default ThreeSixtyView;
