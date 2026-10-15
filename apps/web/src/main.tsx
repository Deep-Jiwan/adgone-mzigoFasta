import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/plus-jakarta-sans";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { theme } from "./theme";

const BACKDROP = { classic: "#E9E9EA", pwani: "#E4E4EA", usiku: "#050506", savanna: "#E9E2D1" } as const;
document.body.style.background = BACKDROP[theme.key];

createRoot(document.getElementById("root")!).render(<App />);
