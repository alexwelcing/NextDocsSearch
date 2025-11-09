import CharacterStudio from '@/components/CharacterStudio';

export default function CharacterStudioPage() {
  return (
    <main className="w-full h-screen">
      <CharacterStudio />
    </main>
  );
}

export const metadata = {
  title: 'Character Studio - Create Animated 3D Characters',
  description: 'Generate rigged and animated 3D characters from text descriptions using Gaussian splatting and procedural mesh generation',
};
