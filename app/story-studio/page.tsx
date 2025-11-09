import Character360Story from '@/components/Character360Story';

export default function StoryStudioPage() {
  return (
    <main className="w-full h-screen">
      <Character360Story />
    </main>
  );
}

export const metadata = {
  title: '360° Story Studio - Interactive Character Stories',
  description: 'Create interactive 360-degree stories with rigged animated characters',
};
