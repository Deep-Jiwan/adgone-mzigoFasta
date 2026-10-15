import { c } from "../theme";
import { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Svg } from "./svg";

// Simple flat illustrations in the spirit of the reference's 3D parcel and truck (drawn here, not copied).
export function BoxArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="bx1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F6C777" /><Stop offset="1" stopColor="#E4A24C" />
        </LinearGradient>
        <LinearGradient id="bx2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#D58F3B" /><Stop offset="1" stopColor="#BF7829" />
        </LinearGradient>
      </Defs>
      <Path d="M60 14l44 20v52L60 106 16 86V34l44-20z" fill="url(#bx1)" />
      <Path d="M60 54l44-20v52L60 106V54z" fill="url(#bx2)" />
      <Path d="M60 54L16 34l44-20 44 20-44 20z" fill="#F9D58F" />
      <Path d="M52 20l44 20-8 4-44-20 8-4z" fill="#F3E4C2" opacity={0.9} />
      <Rect x="70" y="68" width="22" height="16" rx="2" fill="#fff" opacity={0.9} transform="skewY(-24) translate(0 38)" />
    </Svg>
  );
}

export function TruckArt({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <LinearGradient id="tr1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.artA} /><Stop offset="1" stopColor={c.artB} />
        </LinearGradient>
        <LinearGradient id="tr2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F6C777" /><Stop offset="1" stopColor="#E4A24C" />
        </LinearGradient>
      </Defs>
      <G>
        <Rect x="44" y="14" width="26" height="24" rx="3" fill="url(#tr2)" />
        <Rect x="72" y="22" width="26" height="16" rx="3" fill="url(#tr2)" />
        <Rect x="30" y="38" width="38" height="26" rx="3" fill="url(#tr2)" />
        <Path d="M14 70c0-8 6-14 14-14h40v38H14V70z" fill="url(#tr1)" />
        <Path d="M68 56h22c8 0 16 8 16 16v22H68V56z" fill="url(#tr1)" />
        <Path d="M76 62h12c5 0 9 4 9 9H76V62z" fill="#FDE3DC" />
        <Rect x="10" y="88" width="98" height="10" rx="5" fill="#2B2B2E" />
        <Circle cx="34" cy="98" r="11" fill="#1A1A1C" /><Circle cx="34" cy="98" r="5" fill="#C8C8CC" />
        <Circle cx="90" cy="98" r="11" fill="#1A1A1C" /><Circle cx="90" cy="98" r="5" fill="#C8C8CC" />
      </G>
    </Svg>
  );
}
