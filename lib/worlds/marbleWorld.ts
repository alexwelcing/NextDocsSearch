export interface WorldAssetSet {
  id: string;
  name: string;
  panoUrl: string;
  splatUrl: string;
  splatLowUrl: string;
  colliderUrl: string;
}

export const MARBLE_WORLD: WorldAssetSet = {
  id: 'marble-ornate-outside',
  name: 'Ornate Outside Architecture',
  panoUrl:
    'https://bcxkuhobfbstigdeocix.supabase.co/storage/v1/object/public/threesixty/world/ornate-outside-architecture-pano.png',
  splatUrl:
    'https://bcxkuhobfbstigdeocix.supabase.co/storage/v1/object/public/threesixty/world/ornate-outside-architecture.spz',
  splatLowUrl:
    'https://bcxkuhobfbstigdeocix.supabase.co/storage/v1/object/public/threesixty/world/ornate-outside-architecture-low.spz',
  colliderUrl:
    'https://bcxkuhobfbstigdeocix.supabase.co/storage/v1/object/public/threesixty/world/ornate-outside-architecture_collider.glb',
};
