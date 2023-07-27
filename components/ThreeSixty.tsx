import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { X } from 'lucide-react';

const ThreeSixtyView: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);
    const [isModalOpen, setModalOpen] = useState(false);
    const [currentImage, setCurrentImage] = useState('/start.jpg');
    const mainSphereRef = useRef<THREE.Mesh | null>(null);

    const updateTexture = useCallback((url: string) => {
        const object = mainSphereRef.current;
        if (!object) return;

        const textureLoader = new THREE.TextureLoader().setPath('./');
        textureLoader.load(url, (newTexture) => {
            newTexture.generateMipmaps = false;  // Disable mipmaps
            newTexture.minFilter = THREE.LinearFilter;  // Set minFilter to LinearFilter
            const setTextureToMaterial = (mat: THREE.Material) => {
                if (mat instanceof THREE.MeshBasicMaterial) {
                    if (mat.map) {
                        mat.map.dispose();  // Dispose of the old texture
                    }
                    mat.map = newTexture;
                    mat.needsUpdate = true;
                }
            }

            if (Array.isArray(object.material)) {
                object.material.forEach(setTextureToMaterial);
            } else {
                setTextureToMaterial(object.material);
            }
        });
    }, []);


    useEffect(() => {
        if (!mountRef.current) return;

        const width = mountRef.current?.clientWidth || 0;
        const height = mountRef.current?.clientHeight || 0;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        mountRef.current.appendChild(renderer.domElement);

        const geometry = new THREE.SphereGeometry(500, 60, 40);
        geometry.scale(-1, 1, 1);

        const material = new THREE.MeshBasicMaterial({
            map: new THREE.TextureLoader().load(currentImage),
        });

        const sphere = new THREE.Mesh(geometry, material);
        mainSphereRef.current = sphere;  // Link the ref to our sphere
        scene.add(sphere);

        updateTexture(currentImage);  // Set the initial texture

        // Adjust the interactiveSphere
        const interactiveSphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const interactiveSphereMaterial = new THREE.MeshStandardMaterial({
            color: 0x00ff00,
            metalness: 0.9,
            roughness: 0.1
        });
        const light = new THREE.PointLight(0xffffff, 1, 0, 10);
        light.position.set(0, 0, 5);
        scene.add(light);

        const interactiveSphere = new THREE.Mesh(interactiveSphereGeometry, interactiveSphereMaterial);
        interactiveSphere.position.set(4, 0, 0);
        scene.add(interactiveSphere);

        camera.position.set(0, 0, 5);
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableZoom = false;
        controls.minPolarAngle = Math.PI / 4;
        controls.maxPolarAngle = 3 * Math.PI / 4;

        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        mountRef.current.addEventListener('click', (event) => {
            mouse.x = (event.clientX / width) * 2 - 1;
            mouse.y = - (event.clientY / height) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects([interactiveSphere]);

            if (intersects.length > 0) {
                setModalOpen(true);
            }
        });

        const handleResize = () => {
            const width = mountRef.current?.clientWidth || 0;
            const height = mountRef.current?.clientHeight || 0;
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
        };

        window.addEventListener('resize', handleResize);

        const animate = () => {
            requestAnimationFrame(animate);
            sphere.rotation.y += 0.001;
            controls.update();
            renderer.render(scene, camera);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            renderer.dispose();
        };
    }, [currentImage, updateTexture]); // Dependency array updated

    useEffect(() => {
        updateTexture(currentImage);
    }, [currentImage, updateTexture]);

    return (
        <div ref={mountRef} style={{ width: '100%', height: '100vh' }}>
            <button onClick={() => setModalOpen(true)} className="..."></button>
            {isModalOpen && (
                <Dialog open={isModalOpen}>
                    <DialogContent className="sm:max-w-[850px] text-black">
                        <DialogHeader>
                            <DialogTitle>Change 360° Theme</DialogTitle>
                            <DialogDescription>Select a theme from the options below.</DialogDescription>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="absolute top-4 right-4 p-2 rounded-full bg-red-500 text-white"
                            >
                                <X />
                            </button>
                        </DialogHeader>
                        <button
                            onClick={() => { setCurrentImage('/space.jpg'); setModalOpen(false); }}
                            className="dialog-button"
                        >
                            Outer space
                        </button>
                        <button
                            onClick={() => { setCurrentImage('/cave.jpg'); setModalOpen(false); }}
                            className="dialog-button"
                        >
                            In the cave
                        </button>
                        <button
                            onClick={() => { setCurrentImage('/train.jpg'); setModalOpen(false); }}
                            className="dialog-button"
                        >
                            On a train
                        </button>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

export default ThreeSixtyView;
