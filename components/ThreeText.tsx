import { Text } from "@react-three/drei";

interface ThreeTextProps {
  text: string;
  position: [number, number, number];
}

const ThreeText: React.FC<ThreeTextProps> = ({ text, position }) => {
  return (
    <Text position={position} color="white" fontSize={1}>
      {text}
    </Text>
  );
};

export default ThreeText;